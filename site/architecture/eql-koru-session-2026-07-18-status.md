---
{
  "schema": "subactor.doc/v1",
  "id": "docs.architecture.eql-koru-session-2026-07-18-status",
  "version": 1,
  "status": "current",
  "updated": "2026-07-18"
}
---

# EQL v0.6 web demo + Koru development-defect classification — status sesji

**Data:** 2026-07-18
**Zakres:** (1) live-testing i naprawa `eql/` web runtime v0.6.0 (demo + biblioteka), (2) test pipeline'u `subactor ask` → Koru `development` queue i naprawa błędnej klasyfikacji defektów.
**Powiązane dokumenty:** [`subactor-koru-development-bridge.md`](./subactor-koru-development-bridge.md), [`../ops/subactor-ask-troubleshooting.md`](../ops/subactor-ask-troubleshooting.md), [`koru-subactor-autonomy-assessment-2026-07-18.md`](./koru-subactor-autonomy-assessment-2026-07-18.md)

---

## 1. EQL Web Runtime v0.6.0 — live testing i bugfixy

Repo: `~/github/subactor/eql` (osobne repo prototypowe, **nie pushowane do origin** — decyzja właściciela z wcześniejszej sesji, `main` istnieje tylko lokalnie).

### 1.1 Metoda testowania

Zamiast polegać wyłącznie na testach jednostkowych, uruchomiono żywe demo (`examples/web-adaptive-site/`) pod `node scripts/serve-web-example.mjs` i przetestowano je narzędziem właściciela **TestQL** (`~/github/oqlos/testql`, zainstalowane w `~/github/subactor/.venv`) z prawdziwym Playwrightem — klikanie przycisków scenariuszy w realnej przeglądarce i asercje na faktycznym stanie DOM (klasy CSS, zmienne `--eql-accent`, widoczność sekcji, `document.body.classList`), a nie tylko na odpowiedziach HTTP.

Uwaga: rozszerzenie `claude-in-chrome` (CDP) miało w tej sesji zablokowany/zawieszony `Page.captureScreenshot` (timeout na dwóch niezależnych tabach) — zrzuty ekranu nie działały, więc weryfikacja wizualna poszła przez `read_page`/TestQL zamiast screenshotów. To ograniczenie środowiska, nie appki.

### 1.2 Bug #1 — SVG: nieznany model renderował się jako `process-flow`

**Plik:** `src/svg/models.ts`
**Commit:** `e9555e0`

`generateSvgModel()` używał łańcucha ternary bez domyślnego odrzucenia — każda nierozpoznana wartość `request.model` cicho renderowała się jako `process-flow` zamiast zwrócić błąd. Ścieżka EQL-syntax (`src/svg/parser.ts:44`) miała już poprawną walidację (`eql_svg_unknown_model:<name>`), więc to była niespójność między dwoma wejściami do tej samej funkcjonalności, nie zamierzone zachowanie.

**Fix:** dodano `KNOWN_SVG_MODELS` + jawny `throw` przy nieznanym modelu, zgodnie z konwencją nazewnictwa błędów już używaną w parserze.

**Weryfikacja:**
```
POST /api/eql/svg {"model":"bogus-model",...} → {"error":"eql_svg_unknown_model:bogus-model"}
```

### 1.3 Bug #2 — `ADD_CLASS "body"` nigdy nie działał (żaden scenariusz)

**Plik:** `src/dql/safety.ts`
**Commit:** `5081786`
**Znaleziony przez:** żywy test TestQL (nie wykryty przez istniejący `tests/web-runtime.test.ts`, który nigdy nie asercjonował `document.body.classList`).

`normalizeDqlTarget()` sprawdzał ogólny wzorzec `SAFE_TARGET` (dowolny bezpieczny identyfikator) **przed** specjalnym przypadkiem literału `"body"`:

```ts
// PRZED (błąd)
if (SAFE_TARGET.test(trimmed)) return `[data-eql="${trimmed}"]`;   // "body" pasuje tu pierwsze
if (trimmed === ":root" || trimmed === "body" || ...) return trimmed;  // ten branch nigdy nieosiągalny dla "body"
```

Efekt: `ADD_CLASS "body" "eql-fast"` (i analogicznie dla **każdego** z 8 scenariuszy demo — `eql-default`, `eql-fast`, `eql-recovery`, `eql-reduced-motion`, `eql-price`, `eql-deliberate`, `eql-returning`, `eql-mobile`) rozwiązywał się do selektora `[data-eql="body"]`, który nie pasuje do żadnego elementu na stronie (atrybut `data-eql` nie jest nigdzie ustawiony na `<body>`). `document.body.className` zostawał pusty niezależnie od wybranego scenariusza. Zmienne CSS i teksty (inna ścieżka kodu w `apply.ts`) działały poprawnie — dlatego błąd był niewidoczny przy powierzchownym teście przez `curl`/HTTP.

**Fix:** zamieniono kolejność sprawdzeń — literalne `"body"`/`":root"` sprawdzane pierwsze.

**Regresja:** dodano `assert.equal(document.body.classList.contains("eql-fast"), true)` (+ sprawdzenie po rollbacku) do `tests/web-runtime.test.ts`.

**Weryfikacja (przed/po, live TestQL, 8 scenariuszy + rollback):**

| Scenariusz | Przed | Po |
| --- | --- | --- |
| `default` (auto na starcie) | `body.className = ""` | `body.className = "eql-default"` |
| `fast-path` (wymaga zgody) | `""` | `"eql-fast"` |
| `recovery` | `""` | `"eql-recovery"` |
| `reduced-motion` | `""` | `"eql-reduced-motion"` |
| `price-transparency` | `""` | `"eql-price"` |
| powrót do `default` (rollback) | n/d | `--eql-accent` i widoczność sekcji `price` poprawnie przywrócone |

Pełny zestaw jednostkowy po fixie: **67/67 pass** (`node --test dist/tests/*.test.js`).

### 1.4 Drobna poprawka kosmetyczna

`examples/web-adaptive-site/index.html`: `<title>`/`.eyebrow` pokazywały „v0.5" mimo że faktycznie ładowany bundle to `cdn/v0.6.0/...` (backend `/health` już raportował `0.6.0`). Poprawiono na „v0.6" — nie miało wpływu na działanie, tylko na etykietę.

### 1.5 Nie-bug: „Mobile" scenariusz w demie

Kontekst przycisku „Mobile" (`pace:"fast", decisionStage:"acting"`) spełnia jednocześnie warunki scenariusza `fast-path` (priorytet 100) i `mobile-focus` (priorytet 70) — `fast-path` poprawnie wygrywa (`rankScenarios` sortuje malejąco po `priority`). Zamierzone działanie systemu priorytetów, nie błąd — odnotowane jako obserwacja, nie zmieniane.

### 1.6 Recurring ryzyko: zewnętrzny proces „refactoring"

W trakcie sesji repo `eql` otrzymywało kilkukrotnie automatyczne commity z komunikatem `refactoring` (poza kontrolą tej sesji — prawdopodobnie zewnętrzny proces mergowania pakietów po stronie właściciela). Wcześniej w tej sesji (przed bieżącym fragmentem) proces ten czterokrotnie spłaszczał `src/mock/openrouter-server.ts` z powrotem do monolitycznej wersji, wymagając ręcznego odtworzenia ekstrakcji funkcji. W tym fragmencie sesji jeden taki commit (`40e40a4`) nadpisał `examples/web-adaptive-site/index.html`, ale **zachował** wcześniejszą poprawkę tytułu v0.6 zamiast ją cofnąć — więc mechanizm wygląda na okresowy snapshot/merge stanu roboczego, niekoniecznie destrukcyjny, ale nieprzewidywalny.

---

## 2. `subactor ask` → Koru `development` queue — test na żywo i fix klasyfikacji

Repo: `orchestrator` (`~/github/subactor/orchestrator`), zmiana **wypchnięta na `main`** (`309ee9c..a3628b1`) zgodnie z wcześniej ustaloną zasadą tej sesji „push bezpośrednio na main, bez PR" dla repozytoriów umbrella `subactor`.

### 2.1 Test na żywo (bezpieczny — bez `--execute`/`--apply`)

```bash
./bin/subactor ask "wykonaj identity pod domena id.subactor.com"
```

„Identity" w tym kontekście nie oznacza IAM/domeny — repo `identity` to strona brandingowa pod `identity.subactor.com`, nie istnieje żadna ścieżka provisioningu domeny `id.subactor.com`. Zapytanie zostało poprawnie sklasyfikowane przez LLM-intent jako model AQL `onboarding-communications.pl.aql` (onboarding pracownika), a że nie podano wymaganych pól (`employee_name`, `requested_email`, ...), propozycja planu zakończyła się `invalid_inputs`.

Bare `subactor ask` (bez `--execute`/`--apply`) nigdy nie wykonuje ani nie aplikuje niczego — potwierdzone czytaniem `platform/bin/subactor` (`cmd_ask`): brak TTY → skrypt kończy się na `exit 1` zaraz po `record_improvement_failure`, przed jakąkolwiek bramką execute/apply-grant/mutate-lease.

### 2.2 Znalezisko: błędna klasyfikacja `invalid_inputs` jako defektu kodu

Porażka `invalid_inputs` została automatycznie przekazana do kolejki Koru `development` (przez `classifyDevelopmentFailure()` w `orchestrator/src/development-defect.mjs`) i **zdedupliła się** (po fingerprintcie `control-plan-gate:invalid_inputs`) na już istniejący ticket `SELFDEV-005` (`~/github/subactor-improvement/.planfile/`), założony wcześniej tego samego dnia z innego źródłowego ticketu (`PLF-371`). Ten ticket miał już za sobą **jedną nieudaną próbę autonomicznej naprawy** (`agent_did_not_commit_repair` — agent LLM nie znalazł nic do załatania, poddał się po ~70s), 1/3 prób zużyte.

**Analiza źródła:** `invalid_inputs` jest emitowany wyłącznie przez `resolveAql()`/`validateInputs()` w `runtime/src/aql-runtime.mjs:207`, gdy `situation` (dane od foundera) nie zawiera pól wymaganych przez plan AQL. To **zawsze** brak danych od człowieka — nigdy błąd kodu. Mimo to `classifyDevelopmentFailure()` łapał ten kod przez zbyt ogólny wzorzec `/invalid_/` (miał on obsługiwać prawdziwie strukturalne kody typu `invalid_runner_response`), więc każde niekompletne zapytanie foundera generowało bezużyteczny ticket repair w Koru.

**Fix (`orchestrator/src/development-defect.mjs`):** dodano `HUMAN_INPUT_CODES = new Set(["invalid_inputs"])`, sprawdzane przed regexem strukturalnym → klasyfikacja `{action: "ignore", category: "needs_human_input"}`. Ticket founderowy (`waiting_input`, z podpowiedzią `--field k=v`) zostaje — to jedyna poprawna ścieżka.

**Weryfikacja:** ten sam `subactor ask` puszczony drugi raz → nowy ticket `PLF-411` utworzony normalnie, ale **bez** linii `↻ development: SELFDEV-…` (poprzednio się pojawiała przy `PLF-410`). Zero nowych wpisów `SELFDEV` w planfile `subactor-improvement`.

**Testy:** `orchestrator/tests/development-defect.test.mjs` — nowy test `"invalid_inputs is a human-input gap, not a code defect"`; pełny `npm test`: **32/32 pass**.

### 2.3 Świadomie NIE naprawione: `urirun_node_unavailable`

Ticket `SELFDEV-006` w tym samym planfile ma identyczny wzorzec (`agent_did_not_commit_repair`), ale fingerprint `urirun_node_unavailable` (emitowany w `runtime/src/task-runtime.mjs:170`, gdy klient HTTP `urirun-node` rzuci nieoczekiwany wyjątek). W przeciwieństwie do `invalid_inputs` **nie mam dowodu**, że to niemożliwe do naprawienia w kodzie — może to być realny bug w obsłudze połączenia/timeoutu. Zostawione bez zmian, patrz sekcja 3.

---

## 3. Problemy nadal otwarte

### 3.1 Koru / development queue

- **`SELFDEV-006` (`urirun_node_unavailable`) nieprzebadany.** Ten sam objaw co naprawiony `invalid_inputs` (`agent_did_not_commit_repair`), ale bez potwierdzenia czy to zła klasyfikacja czy prawdziwy bug w `runtime/src/task-runtime.mjs`. Wymaga osobnego dochodzenia zanim ktokolwiek odpali na nim `koru --queue`.
- **`SELFDEV-005` nadal `blocked`, nierozwiązany.** Ma teraz 1/3 prób zużyte i dodatkową notatkę z mojego testu (`PLF-410`). Nie zdecydowano, czy ręcznie zamknąć ten ticket (bo po fixie z sekcji 2.2 nie powinien już nigdy się odtworzyć), czy zostawić do naturalnego wygaśnięcia.
- **`PLF-410` i `PLF-411` wiszą w kolejce `founder`** (`waiting_input`) — testowe zapytania, nikt nie uzupełnił pól onboardingowych. Do ręcznego zamknięcia/zignorowania przez właściciela.
- **Regex-catch-all w `classifyDevelopmentFailure()` (`/not_implemented|invalid_|truncated|parse_error|schema_/`) może mieć inne fałszywe trafienia** poza `invalid_inputs` — nie przeprowadzono pełnego audytu wszystkich kodów błędów w systemie pod kątem tego wzorca. Naprawiono tylko przypadek z konkretnym dowodem.

### 3.2 EQL

- **Repo `eql` nadal nie jest pushowane do `origin`** — cała historia (w tym oba dzisiejsze fixy) istnieje tylko lokalnie. Ryzyko utraty przy awarii dysku; decyzja o pushu należy do właściciela (wcześniejsze wyraźne „zostaw lokalnie, nie pushuj").
- **Zewnętrzny proces „refactoring" pozostaje nieprzewidywalny** (patrz 1.6) — może w przyszłości ponownie nadpisać pliki źródłowe niezależnie od tej sesji. Nie ma obecnie żadnego mechanizmu ochrony poza czujnością przy kolejnych rundach testów.
- **Weryfikacja wizualna przez zrzuty ekranu (`claude-in-chrome`/CDP) nie działała w tej sesji** (`Page.captureScreenshot` timeout na dwóch tabach) — nieznana przyczyna (środowisko, nie appka). Testy TestQL to obeszły przez odczyt DOM zamiast pikseli, ale prawdziwa weryfikacja wizualna (kolory, layout) nie została wykonana.
- **Brak testu end-to-end na `EQL_API_TOKEN`/CORS gate** (`examples/node-server/server.ts`) wprowadzonych w v0.6.0 — przetestowano tylko happy-path bez tokenu/originu.

### 3.3 Poza zakresem tej sesji (bez zmian)

Zgodnie z wcześniej ustalonymi granicami (`docs/ops/subactor-ask-troubleshooting.md` §5, §6): real intake kolejki Koru z mock LLM na masową skalę, `subactor ask --apply`, jakiekolwiek mutacje DNS/Plesk/credentials/apply-grant. Żadna z tych granic nie została naruszona ani przesunięta w tej sesji.
