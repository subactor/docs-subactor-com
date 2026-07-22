---
{
  "schema": "subactor.doc/v1",
  "id": "docs.platform.task.process.runtime",
  "version": 1,
  "status": "current",
  "updated": "2026-07-16"
}
---

# Integracja listy zadań (planfile) i runtime procesów (urirun)

Relcom może opcjonalnie oprzeć **listę zadań** o standard ticketów
[`planfile`](https://github.com/semcod/planfile), a **uruchamianie i monitorowanie
procesów** o runtime URI [`urirun`](https://github.com/if-uri/urirun), zamiast
traktować takie operacje jako czyste zdarzenia audytowe.

Integracja jest *best-effort* i wyłączona domyślnie. Bez zainstalowanych narzędzi
Python cały system działa jak dotychczas — operacje degradują się przezroczyście
do wyniku `mode: "lab-audit"`. Nie wprowadza to twardej zależności.

## Model

| Operacja planu (OQL) | Backend gdy `TASK_RUNTIME_ENABLED=true` | Fallback |
|----------------------|------------------------------------------|----------|
| `task.create`, `manual.task` | `planfile ticket create` → ticket PLF-NNN | `lab-audit` |
| `process.run`, `workflow.request` | `urirun run <uri> <registry> --execute` | `lab-audit` |

Most żyje w `@subactor/runtime/task-runtime` (klasa `TaskRuntime`) i jest instancjonowany
w `services/bridge`. Zwraca ustrukturyzowane koperty i **nigdy nie rzuca** przy
braku binarki lub martwym node — zwraca
`{ok:false, available:false, source:"lab-audit-fallback", reason:...}`, a bridge
kontynuuje plan z wynikiem lab-audit. Realne błędy CLI (np. zła nazwa ticketu przy
dostępnym `planfile`) są zgłaszane jako błąd kroku, nie ukrywane.

Uwaga implementacyjna: CLI `planfile` jest zakresowane katalogiem roboczym
(`.planfile/` w cwd) i nie ma flagi `--project`; projekt wybiera się przez `cwd`
procesu. `ticket create` nie wspiera `--format json`, więc identyfikator ticketu
jest parsowany z linii `✓ Created PLF-NNN: ...`, a pełne dane odczytuje
`ticket list --format json`.

## Konfiguracja

Zmienne (zadeklarowane w `config/env-contract.json`, propagowane do `.env`):

```bash
TASK_RUNTIME_ENABLED=false      # główny przełącznik
PLANFILE_BIN=planfile           # binarka planfile w PATH
PLANFILE_PROJECT_DIR=           # katalog projektu (.planfile/); puste = cwd bridge
URIRUN_BIN=urirun               # binarka urirun w PATH
URIRUN_REGISTRY_PATH=           # skompilowany rejestr URI dla `urirun run`
URIRUN_ALLOW=proc://**          # polityka allow deny-by-default dla wykonania
```

## Weryfikacja

Test jednostkowy: `npm run test` uruchamia `components/testkit/tests/task-runtime.test.mjs`
(fallback przy wyłączeniu, budowa komend, degradacja przy braku binarki,
parsowanie JSON/loose i ID ticketu).

Sprawdzenie na żywo wobec prawdziwego CLI planfile:

```bash
node --input-type=module -e '
import {TaskRuntime} from "@subactor/runtime/task-runtime";
const rt = new TaskRuntime({enabled:true, planfileProject:"/tmp/pf"});
console.log(await rt.createTicket({name:"Relcom onboarding", priority:"high", labels:["subactor"]}));
console.log(await rt.listTickets());
'
# → CREATE ok=true source=planfile id=PLF-001
# → LIST   ok=true tickets=[["PLF-001","Relcom onboarding","high"]]
```

## Granica

To integracja warstwy developerskiej/laboratoryjnej. Produkcyjnie należy uruchamiać
`urirun` jako node HTTP (`urirun node serve --execute`) i wołać `POST /run` oraz
`GET /events` zamiast CLI, a `planfile` wystawić przez `planfile serve` (REST), z
kolejką, tenancy i audytem zgodnie z `docs/PRODUCTION_READINESS.md`.
