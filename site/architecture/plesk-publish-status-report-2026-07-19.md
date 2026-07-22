---
{
  "schema": "subactor.doc/v1",
  "id": "docs.architecture.plesk-publish-status-report-2026-07-19",
  "version": 1,
  "status": "current",
  "updated": "2026-07-19"
}
---

# Raport stanu platformy Subactor — publikacja Plesk

**Data:** 2026-07-19 · **Zakres:** ścieżka `subactor ask` → intent pack → ticket → plan → dry-run → apply (Plesk), stan po promocji generycznego packa `site-publish` (SELFDEV-062).

> **Aktualizacja 2026-07-19 (po refaktoryzacji):** wykonano punkty **2.1** (commit promocji), **2.2** (tokenowy matcher fraz), **2.5** (cały stack z repo, zero mountów `/tmp`), **3.1** (podział `registry.mjs` na 4 moduły) i **3.3** (wspólny `config-paths.mjs`). Szczegóły w treści — wykonane pozycje oznaczone ✅. Testy po refaktoryzacji: intent-packs 30/30, control 113 (0 fail), modele AQL OK; e2e `ask` z identycznymi `plan_hash` (www `1418bcbd…`, identity `3b19a968…`). Fraza z wtrąconym słowem („opublikuj stronę **identity** na plesk") rozwiązuje się teraz poprawnie do packa `site-publish`.
>
> **Aktualizacja 2026-07-19 (wieczór):** domknięto prace wokół digital twin / ciągłości decyzyjnej — subject-bound scope `digital-twin:self:read`, synchronizację env-contract (`npm run env:sync`) i plan „constitutional continuity". Szczegóły w sekcji **6**.

Powiązane dokumenty:

| Dokument | Zakres |
| --- | --- |
| [`autonomy-cli-runbook.md`](../autonomy-cli-runbook.md) | Runbook CLI: NL goal → URI Process |
| [`koru-subactor-autonomy-assessment-2026-07-18.md`](koru-subactor-autonomy-assessment-2026-07-18.md) | Ocena autonomii (dzień wcześniej) |
| `platform/docs/GITHUB_PLESK_URI_PROCESSES.md` | Przepisy GitHub + Plesk |

---

## 1. Co działa poprawnie (zweryfikowane e2e)

Wszystkie testy wykonano wyłącznie przez `subactor ask`, na `PLESK_MODE=mock` (bezpieczne apply do mocka; ścieżka produkcyjna wymaga świadomej decyzji foundera).

| Obszar | Dowód | Źródło |
| --- | --- | --- |
| Control plane `:8091`, bridge, urirun-node | 15/15 usług zdrowych, 0 błędów krytycznych | `platform/docker-compose.yml` |
| Intent → ticket → plan → dry-run (4 domeny) | www 23 pliki · docs 82 · docs-stage 82 · logo 73; deterministyczne packi, koszt LLM $0, preflight OK | `platform/config/intent-packs/*.v1.json` |
| Apply z pełnym governance | podpisany apply-grant związany z `plan_hash` → mutate lease TTL 900 s → upload SFTP z manifestem SHA-256 → lease cleared | `platform/components/runtime/src/apply-grant.mjs`, `platform/bin/subactor` |
| **Nowe domeny — generyczny pack `site-publish`** (aktywowany 2026-07-19) | `--field source_ref=workspace:identity` → `identity.subactor.com`, dry-run 22 pliki → docroot `/identity.subactor.com`, mock apply OK | `platform/config/intent-packs/site-publish.v1.json`, `platform/components/core/services/control/src/site-publish-resolver.mjs` |
| Testy | intent-packs 30/30 · control 113 (0 fail) · modele AQL OK · regresja 4 domen z identycznymi `plan_hash` | `platform/test/intent-packs.test.mjs`, `platform/components/core/services/control/tests/` |
| Preflight produkcyjny | vault kompletny (`plesk-runtime`, `plesk-subscription`, `plesk-ftp/sftp`, `deploy-ftp/sftp`), HTTPS 200 na docs/logo/www/identity.subactor.com | `platform/bin/subactor-live-publish.sh` |

Przykładowe wywołania (działające):

```bash
subactor ask "zsynchronizuj www do httpdocs subactor.com" --execute --yes     # dry-run
subactor ask "zaktualizuj zawartość folderu www i opublikuj na subactor.com" --apply --yes
subactor ask "opublikuj stronę na plesk" --field source_ref=workspace:identity --execute --yes
```

Co było potrzebne do promocji `site-publish` (wykonane):

- zdjęcie flagi `shadow` z packa — `platform/config/intent-packs/site-publish.v1.json`
- model AQL — `platform/components/contracts/models/site-publish.pl.aql`
- recipe — `platform/config/recipes/site-publish.urirun.json`
- scenariusz wykonywalny — `platform/config/scenarios.json`
- hook deterministycznego rozwiązania `source_ref → source_dir + domain + remote_path` przed walidacją AQL — `platform/components/core/services/control/src/routes/plans.mjs` (`handleProposeFromIntent` → `buildSitePublishSituation`)
- mounty zasobów workspace (ro) do hr-control i `identity` do urirun-node — `platform/docker-compose.yml`
- `PLESK_SYNC_ALLOWED_SOURCES=/home/tom/github/subactor` na urirun-node (tryb prefiksowy zamiast basename `{www,docs,logo}`) — `platform/docker-compose.yml`, logika: `urirun-connectors/urirun-connector-plesk/urirun_connector_plesk/core.py` (`_source_allowed`)

---

## 2. Co wymaga poprawy

### 2.1 ✅ Nieskomitowane zmiany promocji site-publish — WYKONANE

Zmiany skomitowane w submodułach i platformie (commity „refactoring" + `chore: pin agents submodule at 712bc45`). Submoduły `components/core` i `components/contracts` zakotwiczone na branchu `main` (były detached HEAD — ryzyko utraty commitów). Pin agents w `platform/test/intent-packs.test.mjs` zaktualizowany do `712bc455…`.

### 2.2 ✅ Dopasowanie fraz jest substring-owe — WYKONANE (tier tokenowy)

Nowy `platform/config/intent-packs/phrase-matcher.mjs`: tier 1 to historyczny exact/substring (wyczerpywany w całości dla wszystkich packów — zero zmian rankingu istniejących dopasowań), tier 2 to podciąg tokenów z ograniczonymi wtrąceniami (≤2 tokeny między kolejnymi słowami frazy). „opublikuj stronę **identity** na plesk" trafia teraz w pack `site-publish` (potwierdzone e2e, `plan_hash` identyczny z czystą frazą). `resolveNlpUriFromPacks` celowo pozostał substring-only (bezpośrednia mapa fraza→URI pozostaje konserwatywna).

*Pozostało (opcjonalnie):* wpięcie ekstraktora slotów `site-intent-extractor.mjs` w ścieżkę `ask`, żeby `source_ref` wyciągał się z NL bez `--field`.

### 2.3 Rosnący backlog eskalacji

„Do uwagi człowieka": 105 → 135 w ciągu jednej sesji; 436 ticketów, w tym dziesiątki duplikatów `Przygotuj dostęp zdalny: Anna Nowak [pending]` i auto-zakładane SELFDEV przy każdym nieudanym ask (`SELFDEV-005/-011/-062/-073…`).

**Propozycja:** deduplikacja ticketów po `(typ, hash sytuacji)` przy tworzeniu oraz TTL/auto-close dla SELFDEV, których przyczyna zniknęła. Miejsca: `platform/components/core/services/control/src/routes/plans.mjs` (ścieżka tworzenia), planfile.

### 2.4 Vault zaśmiecony wpisami testowymi

~90 wpisów `plesk-mailbox-*@example.test` obok produkcyjnych credentiali. Utrudnia audyt, zwiększa powierzchnię pomyłki.

**Propozycja:** flaga/prefiks `test:` przy tworzeniu + komenda czyszcząca wpisy z originem `example.test` (browser-agent vault API).

### 2.5 ✅ Uruchamianie stacka ze snapshotu `/tmp` — WYKONANE

`docker compose --env-file .env up -d` z katalogu `platform/` przejęło cały projekt: `docker compose ls` pokazuje wyłącznie ścieżki repo, zero bind-mountów `/tmp` na wszystkich kontenerach, 17/17 usług up (15 z healthcheckiem — healthy). Smoke test `ask` po przejęciu: `plan_hash` bez zmian. Klasa awarii „ENOENT po czyszczeniu `/tmp`" zamknięta.

### 2.6 Kontenery spoza platformy w restart-loopie

`service-manager-pilot-backend`, `service-id-pilot-backend` (`~/github/maskservice/c2004`), `proxym` (`~/github/semcod/proxym`). Poza zakresem subactora, ale szumią w monitoringu hosta.

### 2.7 ✅ Preflight live-publish oparty o `pgrep` — WYKONANE

`platform/bin/subactor-live-publish.sh` sprawdza teraz HTTP `GET /health` urirun-node (konfigurowalne `URIRUN_NODE_HEALTH_URL`, domyślnie `http://127.0.0.1:18765/health`) zamiast `pgrep` po procesie w kontenerze.

---

## 3. Co wymaga modularyzacji

### 3.1 ✅ `platform/config/intent-packs/registry.mjs` — WYKONANE (podział na 4 moduły)

Zrealizowany podział (registry.mjs pozostał fasadą z niezmienionym publicznym API — wszyscy importerzy działają bez zmian):

| Moduł | Odpowiedzialność |
| --- | --- |
| `pack-loader.mjs` | load + shape assert + shadow gating |
| `phrase-matcher.mjs` | dopasowanie NL: tier substring + tier tokenowy (patrz 2.2) |
| `docroot-rules.mjs` | branche domain/remote_path wyniesione verbatim (parytet `plan_hash`) |
| `derived-artifacts.mjs` | nlp-uri entries, render YAML, LLM slice, compare recipe/step-catalog |

*Pozostało (TODO w `docroot-rules.mjs`):* przenieść reguły per-domain do danych packów i domykać generyczną `docrootConvention` z `site-publish-resolver.mjs` — wtedy żadna nazwa domeny nie będzie hardkodowana w kodzie.

### 3.2 `platform/bin/subactor` (764 linie bash + inline Python)

Cała orkiestracja ask→ticket→plan→grant→apply w jednym skrypcie; nietestowalne, logika lifecycle zduplikowana z orchestratorem.

**Propozycja:** logika do `orchestrator/` (Node, testy jednostkowe), bash jako cienki wrapper na REST.

### 3.3 ✅ Zduplikowana logika ścieżek konfiguracji — WYKONANE

Nowy `platform/components/core/services/control/src/config-paths.mjs` (`configFileCandidates` / `resolveConfigFile` / `packsDirCandidates`) zastąpił 4 kopie łańcucha „env → CONTROL_CONFIG_DIR → umbrella → submodule pin" w: `docs-sync-intent.mjs`, `www-sync-intent.mjs`, `site-resource-resolver.mjs`, `publish-autonomy.mjs`. Testy control 113 (0 fail), e2e bez zmian `plan_hash`.

### 3.4 Legacy intent-moduły vs packi

`docs-sync-intent.mjs` i `www-sync-intent.mjs` duplikują logikę packów; dual-run `shadow` (PR10) miał je wygasić. Utrzymywanie obu = dryf (realny przypadek: stash „docs-sync-intent stage bind" z 2026-07-18 vs HEAD).

**Propozycja:** po okresie shadow bez mismatchy → `INTENT_PACK_DUAL_RUN=off` i usunięcie obu plików.

### 3.5 ✅ Podwójny `agents/nlp-uri-phrases.yaml` — WYKONANE

`platform/scripts/sync-intent-pack-derived.mjs` pisze/sprawdza teraz **oba** cele: umbrella `agents/nlp-uri-phrases.yaml` i pinowany klon `platform/components/agents/nlp-uri-phrases.yaml` (dedup po realpath — w testowej umbrelli to ten sam plik przez symlink). Koniec ręcznego `cp` po zmianie packów.

### 3.6 ✅ Generyczne id kroków w step-catalog — WYKONANE

`create_site_publish_ticket` (`platform/config/step-catalog.json`) i recipe `platform/config/recipes/site-publish.urirun.json` używają neutralnych id: `site-methods` / `site-sync-dry-run` / `site-sync-apply`. Zweryfikowane e2e — nowe id płyną przez ticket → orchestrator → urirun, dry-run identyczny (22 pliki identity). Uwaga operacyjna: control cache'uje step-catalog — po zmianie katalogu potrzebny restart `hr-control`.

### 3.7 ✅ „Zduplikowany" testkit — BŁĘDNA DIAGNOZA, wycofane

Root `testkit/` to osobne repo git (komponent umbrelli), a `platform/components/testkit` to jego pinowany submoduł — identyczność plików jest **zamierzona** i pilnowana przez `platform/scripts/check-component-drift.mjs` (ten sam wzorzec co `agents`, `runtime`, `contracts`…). Symlink/usunięcie zepsułoby drift-gate. Pozycja zamknięta bez zmian.

---

## 4. Rekomendowana kolejność

1. ~~**Commit promocji site-publish** (2.1)~~ ✅ wykonane 2026-07-19
2. ~~**Przejęcie całego stacka z repo** (2.5)~~ ✅ wykonane 2026-07-19
3. ~~**`phrase-matcher`** (2.2 + 3.1)~~ ✅ wykonane 2026-07-19 (bez wpięcia ekstraktora slotów — opcjonalne follow-up)
4. **Dedup ticketów / SELFDEV TTL** (2.3) — zatrzymuje puchnięcie backlogu. **← następny krok**
5. Pozostałe: 2.4 (vault cleanup), 2.6 (kontenery obce), 2.7 (`pgrep`→HTTP), 3.2 (CLI→orchestrator), 3.4 (wygaszenie legacy intents), 3.5 (podwójny YAML), 3.6 (neutralne id kroków), 3.7 (zduplikowany testkit) — osobne, małe PR-y.

## 5. Wykonane commity (2026-07-19)

| Repo | Commit | Zakres |
| --- | --- | --- |
| `platform` | „refactoring" (użytkownik) + `chore: pin agents submodule at 712bc45` | promocja site-publish, pin agents |
| `platform` | `refactor(intent-packs): split registry.mjs into focused modules + token-tier phrase matching` (`eb70758`) | 3.1 + 2.2 |
| `platform/components/core` | `refactor(control): extract shared config-paths.mjs (4 copies -> 1)` (`1d6133d`) + bump pinu w platform (`7e1b2b0`) | 3.3 |
| `platform/components/contracts` | `chore: ignore __pycache__` (`96b7245`) | porządek |

## 6. Prace domknięte po refaktoryzacji (2026-07-19, wieczór)

Zmiany niezwiązane bezpośrednio ze ścieżką publikacji Plesk, ale dotykające tej samej platformy:

### 6.1 Subject-bound digital twin

Scope `digital-twin:self:read` jest dostępny w presetach tokenów i E2E. Endpoint `GET /api/digital-twin/self` wiąże widok z principalem tokenu, sprawdza AQL `twin://actor/digital-twin/query/self`, zwraca wyłącznie projekcję read-only i nie udostępnia lookupu cross-subject.

Test live potwierdził tę izolację dla 8/8 zarejestrowanych aktorów. Implementacja: Core `075fc0f`, kontrakty `a47e34b`, testkit `4959261`, pin platformy `fb741ec`.

### 6.2 Tooling env-contract

`platform/scripts/sync-env-contract.mjs` i npm script **`env:sync`** wciągają aktualny `.env.example` jako `template` do `platform/config/env-contract.json`. `.env.example` jest SSOT, a kontrakt jest generowany i kontrolowany przez test driftu.

Konfiguracja Foundera nie zakłada już nazwy kontraktu w kodzie Organization Core: `FOUNDER_PRINCIPAL` i `FOUNDER_CONTRACT_NAME` są częścią kontraktu środowiska.

### 6.3 Plan „constitutional continuity" (skomitowane w `docs`)

Commit `88702f5 docs: plan constitutional continuity rollout`: nowy `docs/plans/resolution-continuity-implementation.md` + aktualizacja sprintu `.planfile/sprints/current.yaml` (±130 linii). Kierunek: ciągłość decyzyjna organizacji (digital twin) — spójny z nowym scope z 6.1.

### 6.4 Wpływ na rekomendowaną kolejność

Bez zmian dla punktu 4 (dedup ticketów / SELFDEV TTL — nadal następny krok ścieżki Plesk). Punkty 6.1 i 6.2 są już skomitowane, przetestowane w pełnej bramce platformy i uruchomione w lokalnym trybie live/mock.

## 7. Druga fala refaktoryzacji + analiza prac digital-twin (2026-07-19, noc)

### 7.1 ✅ Wykonane pozycje refaktoryzacji (commit `f59a463` w `platform`)

| Pozycja | Zmiana |
| --- | --- |
| 2.7 | preflight live-publish przez HTTP `/health` zamiast `pgrep` |
| 3.6 | neutralne id kroków `site-*` w step-catalog + recipe (zweryfikowane e2e) |
| 3.5 | `sync-intent-pack-derived.mjs` pisze YAML do umbrelli **i** `components/agents` |
| 3.7 | zamknięte jako błędna diagnoza (wzorzec komponent-umbrella + pin z drift-gate) |

### 7.2 Równoległe prace foundera (w locie, częściowo nieskomitowane w `platform`)

- **Domeny zewnętrzne w generycznym packu:** `components/core` commit `5a10aee feat(control): authorize exact project domains` — `validateDomain` przyjmuje `allowedDomains` (dokładne dopasowania z rejestru) obok sufiksu `.subactor.com`.
- **Nowy zasób `workspace:autonomicznosc-pl`** → `projekty/02_landing` → domena **`autonomicznosc.pl`**; mounty w `hr-control` i `urirun-node` (`docker-compose.yml`), kontrakt autonomii rozszerzony o `autonomicznosc.pl` (`config/autonomy-contracts.json`). **E2E zweryfikowane: dry-run przechodzi** (docroot `/autonomicznosc.pl`, source spoza konwencji `<name>.subactor.com` — pierwszy taki przypadek).
- **Warstwa digital-twin authority:** `runtime/src/autonomy-contract.mjs` — reguła `authorized_human_capability_required` dla kroków `human_approval: true`; commity `fix(core): reject expired digital twin authority`, `feat(platform): pin constitutional authority and digital twin`.

### 7.3 ⚠ Obserwacja: lifecycle dry-run pod nową regułą authority

Po włączeniu reguły **każdy** przebieg `ask ... --execute` (www, identity, autonomicznosc — wszystkie packi) kończy się `⚑ urirun / authorized_human_capability_required` zamiast `✓ dry_run_passed`, mimo że sam dry-run **succeeded**. Krok apply (`human_approval: true`, w trybie `--execute` celowo niewykonywany) jest teraz oceniany jako `required` i „resolving", a każdy przebieg dopisuje się do SELFDEV-074.

**Propozycja (obszar prac foundera — do decyzji):** w trybie dry-run krok z `human_approval: true` powinien rozwiązywać się jako `skipped_dry_run` (nie `required`), np. w `orchestrator/src/pipeline.mjs` (okolice linii 126) albo przez warunek `plan.dry_run` w regule `runtime/src/autonomy-contract.mjs:161`. Wtedy `--execute` wraca do czystego `dry_run_passed`, a wymóg autorytetu digital-twin obowiązuje tam, gdzie ma sens — przy realnym apply.

### 7.4 Zaktualizowany plan refaktoryzacji (pozostałe)

| # | Pozycja | Status / warunek wejścia |
| --- | --- | --- |
| 1 | **2.3 dedup ticketów / SELFDEV TTL** | następny krok; poczekać aż osiądą zmiany foundera w `components/core` (kolizja plików) |
| 2 | 7.3 dry-run vs authority rule | decyzja foundera (propozycja wyżej) |
| 3 | 3.1-TODO: reguły docroot do danych packów | po stabilizacji `allowedDomains` — obejmie też domeny zewnętrzne |
| 4 | 3.4 wygaszenie legacy intents (`docs/www-sync-intent.mjs`) | wymaga przeniesienia paraphrase-matchera do packów (pokrycie, którego packi nie mają) + `INTENT_PACK_DUAL_RUN=off` po okresie shadow bez mismatchy |
| 5 | 3.2 CLI (764 linie bash) → orchestrator | największy; osobny PR, fazami: najpierw lifecycle-mapping, potem grant/lease |
| 6 | 2.4 vault cleanup (`example.test`) | małe, niezależne |
| 7 | 2.6 obce kontenery w restart-loopie | poza subactorem (c2004, proxym) |

## 8. Ekstrakcja paczek workspace — koniec kodu w `config/` (2026-07-19, noc)

Trzecia fala refaktoryzacji: `platform/config/` przewoziło **ponad 1000 linii wykonywalnego kodu** (`intent-packs/*.mjs`, `connector-capabilities/preflight.mjs`). Kod wyprowadzony do dwóch nowych paczek workspace w nowym katalogu `platform/packages/`:

| Paczka | Zawartość (kod) | Dane zostają w |
| --- | --- | --- |
| **`@subactor/intent-packs`** | `pack-loader`, `phrase-matcher`, `docroot-rules`, `derived-artifacts`, `registry` (fasada) | `platform/config/intent-packs/*.v1.json` |
| **`@subactor/capability-preflight`** | bramka preflight (607 linii), zależy od `@subactor/intent-packs` | `platform/config/connector-capabilities/` (catalog, fixtures, `*.uri.capability.yaml`) |

Mechanika kompatybilności:

- `config/intent-packs/registry.mjs` i `config/connector-capabilities/preflight.mjs` to **1-linijkowe shimy** (`export * from "@subactor/…"`) — dynamiczne importy po `packsDir`/`configDir` (`intent-pack-bridge.mjs`, `capability-gate/config.mjs`) oraz względne importy testów działają bez zmian w obu układach (repo i kontener).
- Ścieżki do DANYCH rozwiązywane kandydatami: `INTENT_PACKS_DIR` / `CONNECTOR_CAPABILITIES_DIR` → `CONTROL_CONFIG_DIR` → układ repo (`packages/*/src → ../../../config/…`).
- Obraz control: `COPY packages/* → /app/node_modules/@subactor/*` (ten sam wzorzec co `@subactor/runtime`); workspaces w `platform/package.json` linkują lokalnie.

Weryfikacja: intent-packs 30/30 · control **158/158** · modele OK · `capability-preflight.mjs --json` ok · rebuild kontenera + e2e `ask` (intent www, dry-run identity 22 pliki — wyniki identyczne). Commity: `build(control): bake @subactor/* into image` (components/core) + `refactor(platform): extract @subactor/intent-packs + @subactor/capability-preflight workspace packages`.

**Efekt architektoniczny:** `config/` to od teraz wyłącznie dane (JSON/YAML + 2 shimy), kod ma wersjonowane paczki z jawnymi zależnościami — gotowe do wydzielenia jako osobne repo komponentu (wzorzec umbrella+pin), jeśli koru ma się dalej odchudzać.

### 8.1 Dalsze kandydatury do paczek (kolejność wg zysku)

| Kandydat | Dziś | Docelowo |
| --- | --- | --- |
| logika lifecycle/grant/lease z `platform/bin/subactor` (764 linie bash) | bash + inline Python | `@subactor/founder-cli` (Node) — pokrywa się z 3.2 |
| `site-*` moduły control (`site-intent-extractor`, `site-publish-resolver`, `site-resource-resolver`, `site-domain-validator`, `publish-source-guard`, ~800 linii) | luzem w `services/control/src` | `@subactor/site-publish` — po osadzeniu prac digital-twin |
| `capability-gate/` + `capability-preflight-gate.mjs` | w control | dołączyć do `@subactor/capability-preflight` |
| `delegation-*` (~390 linii) | w control | `@subactor/delegation` |

## 9. Końcowa weryfikacja live (2026-07-19)

### 9.1 Publikacja `projekty/*`

Rzeczywisty profil integracyjny uwierzytelnił się do Plesk pod
`https://prototypowanie.pl:8443`. Query capability potwierdziło dostęp do
subskrypcji `subactor.com`, ale panel nie zwrócił limitu domen. Dlatego wynik
pozostaje bezpiecznie negatywny: `can_create_domain=false`,
`reason=subscription_domain_limit_unknown`.

SFTP i FTP przeszły capability check z lease'ów vault. Dry-run dla
`workspace:autonomicznosc-pl` (`projekty/02_landing`) i domeny
`autonomicznosc.pl` zakończył się powodzeniem: 8 plików, 32 934 B, docroot
`/autonomicznosc.pl`, plan hash
`8cec51c...`. Nie wykonano mutacji produkcyjnej.

Blokery apply:

- brak wiarygodnego limitu/pojemności domen subskrypcji;
- `autonomicznosc.pl` nie ma rekordu A kierującego do docelowego hosta;
- brak potwierdzonego TLS dla nowej domeny;
- master mutation gate oraz `PLESK_SYNC_APPLY` pozostają wyłączone;
- brak lease `plesk-runtime` dla administracyjnego API (SFTP/FTP są dostępne).

### 9.2 Kanały komunikacji

`autonomy-chat-agent` działa jako usługa i przeszedł test end-to-end: wiadomość
foundera w prywatnym portalu została pobrana przez outbound relay, obsłużona
przez kontrolowany endpoint LLM i zwrócona wyłącznie do rozmowy tego użytkownika.
`chat.subactor.com` nie jest jeszcze wdrożonym portalem: obecny DNS kieruje do
GitHub Pages, a certyfikat nie pasuje do tej nazwy. Bezpieczny układ docelowy to
portal na publicznym hostingu oraz wychodzący relay do agenta — bez reverse
proxy z Internetu do lokalnego hosta.

Kanał e-mail jest `waiting_credentials`: brakuje lease'ów
`agent-mailbox-runtime` i `smtp-system-email`; lokalny Mailpit nie wysyła poczty
do foundera. Powstał osobny `urirun-connector-twilio-voice` (5/5 testów,
widoczny w live node: 539 tras). Doctor działa fail-closed i zwraca
`live_ready=false`: nadal brakuje konta/numeru, vault credentials, allowlisty
numeru, polityki podstawy kontaktu/zgody i callbacka weryfikującego podpis
Twilio. Nie wykonano realnego połączenia.

### 9.3 Ocena autonomii

System kontynuuje zadania niezablokowane i ma działający kanał czatu, lecz nie
spełnia jeszcze definicji pełnej autonomii operacyjnej. Brakujące elementy to:
ważny authority graph i kontrakty następców, redundantne kanały komunikacji,
prekontraktowani dostawcy, aktywne budżety continuity, provider replacement,
obserwowalny Resolution Continuity Engine oraz zamknięte bramki DNS/TLS/Plesk.

## 10. `@subactor/founder-cli` — CLI foundera przeniesione do paczki (2026-07-19, noc)

Zrealizowany punkt **3.2** (największa pozycja modularyzacji): `platform/bin/subactor` — 764 linie basha z wklejkami Pythona — jest teraz **20-liniowym wrapperem** wykonującym `packages/founder-cli/bin/subactor.mjs`.

| Moduł paczki | Odpowiedzialność |
| --- | --- |
| `config.mjs` | env-file, URL-e, token, ANSI |
| `api.mjs` | fetch z parytetem curl (body przy 4xx/5xx) + semantyka `jget` |
| `lifecycle.mjs` | **czyste** mapowanie stage→lifecycle + ekstraktory dry-run/error/grant (testy jednostkowe 5/5) |
| `prompts.mjs` | `confirmYn` (honoruje `--yes`/TTY) vs `confirmYnInteractive` (bramka produkcyjna — nigdy z flagi) |
| `apply-grant.mjs` / `mutate-lease.mjs` | grant związany z `plan_hash`, lease TTL przez docker-exec z cleanupem na exit/INT/TERM |
| `improvement.mjs` | klasyfikator defektów + relay do subactor-improvement |
| `orchestrator-runner.mjs` | przebiegi ticketów, `/tmp/subactor-ask-last-orch.json` |
| `ask.mjs` / `commands.mjs` | pełna powierzchnia komend |

Zweryfikowane e2e na żywej platformie: `help/health/status/tickets/plans/get`, `ask --json`, `ask --execute --yes` — format wyjścia, semantyka bramek i pliki uboczne identyczne z bashem (łącznie z zapisem ticketu SELFDEV przy znanym ostrzeżeniu authority z §7.3). Zysk: logika lifecycle/grant/lease jest wreszcie testowalna jednostkowo i re-używalna (orchestrator może importować `@subactor/founder-cli/lifecycle` zamiast duplikować mapowanie).

**Stan planu paczek (§8.1):** founder-cli ✅ · site-publish → po osadzeniu digital-twin · capability-gate merge → otwarte · delegation → otwarte.

### 10.1 ⚠→✅ Regresja migracji CLI i jej domknięcie

Port founder-cli **złamał bramkę governance** `platform/test/founder-cli-confirmation.test.mjs` (test interaktywnego apply stubował stary przepływ, a analiza statyczna czytała usunięty bash) — regresja niewykryta, bo weryfikacja portu objęła `make test-intent-packs` + testy paczki, a **nie pełne `npm test` platformy**. Wykrył ją równoległy przegląd foundera; bramka zmigrowana do modułu Node w `628b78c test(platform): migrate founder CLI governance gate coverage` (zmiana wyłącznie w teście — źródła paczki bez zmian; niezmienniki: odmowa produkcji nie wydaje grantu ani lease, `--execute` pozostaje dry-run-only, cleanup lease na sygnałach).

Po migracji: bramka 2/2, **pełne `npm test` platformy: 7 suite'ów, 0 fail**.

**Lekcja procesowa:** każda zmiana w `platform/` przechodzi pełne `npm test` (meta+runtime+contracts+testkit+site-generator+core+connector-lan) przed commitem — selektywne suite'y nie wystarczają przy przenoszeniu kodu między warstwami.

## 10. Rdzeń capability-gate w `@subactor/capability-preflight` (2026-07-19, noc)

Domknięta trzecia pozycja z §8.1: `capability-gate/{config,pack-loader,preflight-run}.mjs` + orkiestrator `gateResolvedPackCapabilities` przeniesione z control do paczki (`packages/capability-preflight/src/gate.mjs`, export `./gate`). Uproszczenia przy okazji:

- `loadPreflight` importuje `../preflight.mjs` **bezpośrednio** — dynamiczna rezolucja po config-dir istniała tylko dlatego, że kod jechał w montowanym katalogu config;
- pack-loader bramki używa `@subactor/intent-packs` wprost (koniec `pathToFileURL(packsDir/registry.mjs)`).

W control zostały: 14-liniowy shim `capability-preflight-gate.mjs` (API dla routes/testów bez zmian) i `capability-gate/denial.mjs` — formatka odpowiedzi HTTP ze słownikiem lifecycle, celowo poza paczką (paczka jest właścicielem **decyzji**, nie jej renderowania).

Weryfikacja (z lekcją z §9.1): control 158/158 · **pełne `npm test`: 7 suite'ów, 0 fail** · rebuild kontenera + e2e `ask` www → `preflight_passed` przez spakowaną bramkę.

**Stan planu paczek (§8.1):** founder-cli ✅ · capability-gate merge ✅ · site-publish → po osadzeniu digital-twin · delegation → otwarte.
