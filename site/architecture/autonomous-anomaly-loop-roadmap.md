---
{
  "schema": "subactor.doc/v1",
  "id": "docs.architecture.autonomous-anomaly-loop-roadmap",
  "version": 1,
  "status": "current",
  "updated": "2026-07-18"
}
---

# Autonomiczna pętla anomalii — stan i roadmapa refaktoryzacji

**Data:** 2026-07-18
**Kod:** `orchestrator/src/anomaly-loop.mjs`, `openrouter-llm.mjs`, `anomaly-probes-extended.mjs`, `bin/anomaly-loop.mjs`
**Cel:** system, który samodzielnie ogarnia dowolne anomalie i znajduje rozwiązanie w trakcie działania przez pętlę zwrotną opartą na LLM (OpenRouter), także gdy startowy kontekst jest niewystarczający.
**Powiązane:** [`eql-koru-session-2026-07-18-status.md`](./eql-koru-session-2026-07-18-status.md), [`subactor-koru-development-bridge.md`](./subactor-koru-development-bridge.md), [`../ops/subactor-ask-troubleshooting.md`](../ops/subactor-ask-troubleshooting.md)

---

## 1. Co już działa (zweryfikowane na żywo)

Pętla: `anomalia → LLM proponuje jedną typowaną akcję → silnik wykonuje pod strażnikami → realny wynik wraca do ledgera → kolejna tura`, aż do `classified` / `patched` / `escalated`.

**Akcje:** `probe` (zbierz dowody), `classify` (4 kategorie: operational_transient / operational_boundary / needs_human_input / development_defect), `patch` (naprawa z weryfikacją), `escalate`.

**Dowody na żywo (prawdziwy OpenRouter, prawdziwe usługi):**

| Scenariusz | Wynik | Iteracje / koszt |
| --- | --- | --- |
| `urirun_node_unavailable` bez hints | sam odkrył kontener przez `docker_ps`, sprawdził health, sklasyfikował `operational_transient` | 3 / $0.0025 |
| `invalid_inputs` (brak pól foundera) | `needs_human_input` od razu, bez zbędnych sond | 1 / $0.0007 |
| Prawdziwy bug składniowy (`JSON.parse` bez try/catch) | przejrzał drzewo → przeczytał źródło+test → napisał fix → verify pass → branch `anomaly/*`, main nietknięty | 4 / $0.0040 |
| `urirun_node_unavailable` z rozszerzonymi sondami | `operational_transient`, samo-korekta błędnego argumentu sondy przez feedback | 5 / $0.0064 |

**Bezpieczeństwo wbudowane w konstrukcję** (nie w prompt): sondy tylko z allowlisty po id, spawn argv bez shella; HTTP loopback-only; `env_configured` zwraca obecność, nigdy wartość; pliki ograniczone do target-repo minus `FORBIDDEN_PATH`; patch = pełna treść pliku w izolowanym worktree, przeżywa tylko po `verify`, ląduje jako branch `anomaly/*` — nigdy merge/push; twarde budżety (iteracje, próby patcha, nieprawidłowe akcje, koszt USD); audytowalny ledger JSONL.

**Sondy kontekstu** (13 łącznie). Rdzeń: `docker_inspect`, `docker_ps`, `http_health`, `env_configured`, `git_recent`, `repo_tree`, `read_file`. Rozszerzone: `ticket_history` (planfile :8765 + historia wykonania), `urirun_routes`/`urirun_health` (:18765 — introspekcja tras `proc://`/`plesk://`), `docker_logs`, `git_log_file`, `koru_events` (journal napraw JSONL), `complexity_snapshot` (code2llm HEALTH/CC).

**Kluczowa lekcja z testów:** więcej sond = więcej błądzenia. Rozszerzony zestaw sond spowodował regresję decyzyjności (łatwy przypadek: 3 → wyczerpanie 6 iteracji). Naprawione świadomością budżetu: pętla mówi modelowi ile tur zostało i twardo wymaga akcji terminalnej, gdy są dowody i ≤2 tury.

---

## 2. Skąd system bierze dane do promptów — audyt źródeł

Odpowiedź na pytanie „czy wystarcza informacji z logów, registry itd.": **tak, dla większości klas anomalii — pod warunkiem że pętla ma sondę do danego źródła.** Zweryfikowany, żywy inwentarz:

### WYSOKA wartość (strukturalne, działają, tanie w sondowaniu) — już podpięte

- **urirun-node :18765** — `GET /routes` (521 tras z `inputSchema`, `meta.connector`), `GET /health` (polityka, `registryEtag`), a w kontenerze `connectors.report.json` z listą **duplikatów URI** — konkretny sygnał „dlaczego wywołanie `plesk://` padło". *(sonda: `urirun_routes`, `urirun_health`; duplikaty — patrz §3 P2)*
- **planfile :8765** — `GET /tickets/{id}` z osadzoną `history[]`, `execution`, `outputs.notes`. Źródłowy ticket + jego log wykonania. *(sonda: `ticket_history`)*
- **code2llm** `project/analysis.toon.yaml` (regenerowane dziś) — `HEALTH[20]` mapuje funkcje o wysokim CC → pliki. „Które funkcje w padającym komponencie są zamieszane." *(sonda: `complexity_snapshot`)*
- **config/registry** — `subactor-improvement/config/targets.json` (komponent→repo→quality gate), `policy.json` (forbidden paths, branch prefix). *(nie podpięte — patrz §3 P1)*

### ŚREDNIA wartość (podpięte lub łatwe do dodania)

- **docker logs** — urirun-node emituje strukturalne linie JSON (`{"event":"urirun.node.started",...}`). *(sonda: `docker_logs`)*
- **Koru event JSONL** — `.koru/event-store.jsonl`, `.koru/events/observability.jsonl` (`exit_code`, `ticket_id`, `executor_kind`). *(sonda: `koru_events`)*
- **git log -p / blame** na plikach komponentu. *(sonda: `git_log_file`; blame — patrz §3 P2)*
- **Prometheus :9096 + ops-observer :8135/metrics** — `subactor_plesk_failures_window`, `subactor_observability_open_incidents`, `subactor_security_events_total`. Korelacja anomalii z metrykami systemu. *(nie podpięte — patrz §3 P1)*

### NISKA / pominąć

control `/status` (404, tylko `/health`), Grafana (dashboardy nie dla LLM), urirun `/services`/`/events`/`/resolve` (puste/authed/absent), testql-watchdog (brak referencji).

**Wniosek:** logi + registry + planfile + code2llm razem pokrywają diagnozę operacyjną, human-input i większość defektów kodu. Luka to **korelacja czasowo-metryczna** (Prometheus) i **mapowanie komponent→repo→gate** (targets.json) — oba w P1 poniżej.

---

## 2a. Pilot na prawdziwym defekcie (SELFDEV-030) — wynik

Uruchomiono pętlę na realnym, zablokowanym tickecie kolejki development: `agents/services/intent-pack-adapter.mjs` czyta `INTENT_PACKS_DIR`/`INTENT_PACK_DUAL_RUN` bezpośrednio z `process.env` (`direct_process_env_forbidden`). Target: kanoniczny `agents/` (nie submodule platform), izolowany worktree, `main` nietknięty.

**Bieg 1 — eskalacja, przyczyna po stronie verify (nie pętli).** Pętla 3× próbowała patcha, za każdym razem `verify_failed` z **pustym** stdout/stderr, wyczerpała budżet (10 iter, $0.083). Diagnoza: mój GATE miał `>/dev/null 2>&1` + brak setupu środowiska. Reprodukcja potwierdziła: w izolowanym worktree w `/tmp` testy padają, bo rozpoznanie intent-pack registry zależy od ścieżki `../../platform/config` względem lokalizacji repo — prawdziwe `quality_commands` ustawiają symlink `../platform/config`, którego brakowało. **Pętla zachowała się wzorowo: bezpiecznie, bez fałszywego sukcesu, czysty cleanup po 3 porażkach.**

**Bieg 2 — sukces end-to-end.** Z wiernym GATE (symlink `platform/config` + `@subactor/runtime`, output testów ujawniony): pętla przeczytała źródło i test → 1. patch przeszedł testy (dodał regresję 7→9) ale zostawił resztkowy `process.env` w linii 19 → **grep w outpucie verify pokazał to pętli** → 2. patch poprawił → verify pass. Wynik: branch `anomaly/selfdev-030-agents-env-a2`, `main` nietknięty, 6 iteracji, $0.029.

**Jakość fixu (kontrola ręczna):** poprawny, nie „oszukanie gate'a" — wprowadził obiekt `env_contract` z getterami (dokładnie „validated environment helper pattern" z anomalii), przekierował oba odczyty, **zachował domyślne shadow** (`?? "shadow"`), dodał sensowny test regresji (3 tryby, custom/unset, poprawne save/restore `process.env`). Jedna asercja pusta (`compare !== null || true`) — drobiazg. Niezależna reweryfikacja: 9/9 testów, zero bezpośrednich `process.env`.

**Wnioski dla P0:**
1. **Verify musi mieć wierność środowiska.** Izolowany worktree nie ma zależności ani sibling-ścieżek (`platform/config`, `node_modules/@subactor/runtime`). Executor pętli **musi** uruchamiać ten sam preambuł co `targets.json:quality_commands` (setup symlinków + trap cleanup), inaczej verify zawodzi niezależnie od jakości patcha. To najważniejszy blocker P0.
2. **Verify nie może dusić outputu** — pusty feedback zagładza pętlę. Dodano strażnik `verify_uninformative` (eskalacja natychmiast zamiast ślepych prób) — commit `19e4321`.
3. **Ścieżki w anomalii bywają submodule-relative** (`components/agents/...` zamiast `services/...`) — pętla samo-skorygowała przez `repo_tree`, ale enrichment (P1.4) powinien normalizować.
4. **Pełen łańcuch feedbacku działa** — pętla naprawiła prawie-dobry patch dzięki temu, że *zobaczyła* konkretną linię z grepa. To potwierdza rdzeń projektu.

## 3. Roadmapa refaktoryzacji — do pełnej autonomii

Priorytety: **P0 = blokuje adopcję produkcyjną**, **P1 = domyka autonomię**, **P2 = odporność/skala**, **P3 = dopracowanie**.

### P0 — integracja z żywym systemem (dziś pętla to samodzielne CLI)

0. **Wierność środowiska verify** *(nowy P0, z pilota — najwyższy priorytet).* Executor pętli musi uruchamiać komendę verify z tym samym preambułem środowiskowym co `targets.json:quality_commands` (symlinki `platform/config`, `node_modules/@subactor/runtime`, trap cleanup). Bez tego verify w izolowanym worktree zawodzi niezależnie od poprawności patcha (dowiedzione: bieg 1 pilota). Najprościej: `verifyCommands[].argv = ["bash","-lc", <quality_command z targets.json>]` pobierany z konfiguracji targetu, nie ręcznie. Verify NIE jest kontrolowane przez LLM, więc `bash -lc` tu nie narusza zasady no-shell (dotyczy sond).
1. **Executor kolejki `development`.** Zastąp jednostrzałowy `AutonomousRepairExecutor` (`subactor-improvement/src/repair-executor.mjs`, dziś `agent_did_not_commit_repair`) adapterem pętli anomalii. Pętla diagnozuje przed patchowaniem — dokładnie to, czego zabrakło SELFDEV-005/006. Pilot potwierdził, że przy poprawnym verify pętla naprawia realny defekt end-to-end (SELFDEV-030, 6 iter, $0.029), którego stary executor nie ruszył.
2. **Wpięcie w `record_improvement_failure`** (`platform/bin/subactor`). Zamiast od razu tworzyć ticket repair, uruchom pętlę; twórz ticket dopiero gdy pętla zwróci `development_defect` lub `escalated`. Kategorie `operational_transient`/`needs_human_input` nie generują wtedy ticketów-śmieci (usuwa klasę problemu z `invalid_inputs`/`urirun_node_unavailable`).
3. **Automatyczne wzbogacanie zdarzenia o kontekst uruchomieniowy.** Dziś `docker_container`/`health_url` podaję ręcznie w `hints`. Trzeba mapować `component` → kontener/URL/repo z `docker-compose.yml` + `targets.json`, żeby pętla startowała z pełnym kontekstem bez ręcznej ingerencji. Pilot pokazał też, że ścieżki w anomalii bywają submodule-relative i wymagają normalizacji do repo kanonicznego.

### P1 — domknięcie autonomii kontekstu

4. **Sonda `component_map`** czytająca `targets.json` + `docker-compose.yml`: `component` → `{repo_root, container, health_url, quality_gate}`. Zamienia zgadywanie nazw kontenerów (dziś model próbuje `docker_ps` z filtrem) na deterministyczne rozwiązanie. To bezpośrednio adresuje „jak system może uzupełniać dane".
5. **Sonda `metrics_query`** (Prometheus :9096 `/api/v1/query`, ops-observer :8135). Korelacja: „czy `subactor_plesk_failures_window` skoczył w oknie anomalii?". Domyka klasę anomalii operacyjnych, których nie widać z samych logów.
6. **Pamięć międzybiegowa (`resolution_memory`).** Zapisuj `{fingerprint → (kategoria, skuteczna ścieżka sond, rozwiązanie)}` w JSONL. Kolejna anomalia z tym samym fingerprintem startuje od podpowiedzi „poprzednio to było X, sprawdź Y najpierw" — redukuje iteracje i koszt, buduje uczenie się systemu.
7. **Eskalacja z konkretem, nie tylko `reason`.** Gdy pętla eskaluje, niech generuje strukturalny ticket HITL z zebranym ledgerem jako dowodem — człowiek dostaje diagnozę, nie surową anomalię.

### P2 — odporność i skala

8. **Panel weryfikatorów zamiast pojedynczego przebiegu** dla patchy wysokiego ryzyka: N niezależnych ocen „czy ten fix jest poprawny i minimalny?" przed promocją brancha (wzorzec adversarial-verify). Redukuje fałszywe naprawy.
9. **Wielomodelowy fallback OpenRouter** — gdy model podstawowy zwraca `openrouter_invalid_json` lub timeout, degraduj do tańszego/innego modelu zamiast eskalować. Dziś 2 błędy LLM = eskalacja.
10. **Wykrywanie duplikatów URI** jako pierwszorzędna sonda (`urirun_duplicates` czytająca `connectors.report.json`) — dla anomalii `connector_not_implemented`/`uri_process_not_allowed` to często root cause.
11. **Równoległe sondy w jednej turze.** Dziś jedna akcja/turę. Pozwól na wiązkę niezależnych sond (np. `docker_inspect` + `ticket_history` + `git_log_file` naraz), by ciąć iteracje na złożonych anomaliach.
12. **Adaptacyjny budżet** — prosty fingerprint dostaje 3 iteracje, złożony (nieznany kod, patch) do 10. Dziś stały limit.

### P3 — dopracowanie

13. **Klasyfikator AQL (`development-defect-classifier.pl.aql`) jako szybka ścieżka** przed LLM: znane kody klasyfikują się deterministycznie za darmo; LLM tylko dla nieznanych/niejednoznacznych. Łączy prototyp AQL (commit `1f3f564`) z pętlą.
14. **Redakcja sekretów w ledgerze** — druga warstwa poza `FORBIDDEN_PATH`: filtruj wartości wyglądające jak tokeny/klucze z `stdout` sond, zanim trafią do promptu.
15. **Metryki samej pętli** — eksportuj `anomaly_loop_iterations`, `_cost_usd`, `_outcome` do Prometheus, żeby obserwować autonomię (meta-monitoring).

---

## 4. Znane ograniczenia / ryzyka (stan na dziś)

- **Pętla nie jest jeszcze wpięta w żywy bridge** — to samodzielne CLI (`bin/anomaly-loop.mjs`). Cała wartość produkcyjna zależy od P0.
- **Patch tylko pełną treścią pliku** — świadomie (eliminuje malformed-diff), ale dla dużych plików model musi odtworzyć całość; limit 200 KB/plik, 1–3 pliki. Duże refaktory poza zasięgiem — i słusznie, to mają robić ludzie.
- **Brak realnego testu ścieżki `patch` na żywym repo subactor** — testowany na fixture'ach git i jednym prawdziwym bugu składniowym w scratchpadzie. Przed P0 wymaga pilota na prawdziwym, izolowanym defekcie z kolejki.
- **Koszt jest funkcją liczby iteracji** — świadomość budżetu pomaga, ale złożona anomalia z patchem to realnie $0.01–0.05/bieg. Przy dużym wolumenie potrzebny cache/pamięć (P1.6) i szybka ścieżka AQL (P3.13).
- **Model może błędnie sklasyfikować** — dlatego kategorie `operational_*`/`needs_human` tylko `ignore` (nic nie psują), a `patch` zawsze przez `verify` + branch (człowiek zatwierdza merge). Najgorszy przypadek to niepotrzebna eskalacja, nie zła mutacja.
