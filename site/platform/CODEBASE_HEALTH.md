---
{
  "schema": "subactor.doc/v1",
  "id": "docs.platform.codebase.health",
  "version": 1,
  "status": "current",
  "updated": "2026-07-17"
}
---

# Stan kodu i plan refaktoru (code2llm)

**Data indeksu:** 2026-07-17  
**Źródła:** `project/analysis.toon.yaml`, `project/map.toon.yaml`, `project/evolution.toon.yaml`, `project/planfile-tickets.yaml`

## Źródło prawdy (monorepo workspace)

| Ścieżka | Rola |
|---------|------|
| `core/`, `agents/`, `connectors/`, `runtime/`, `contracts/`, … | Kanoniczne repozytoria komponentów (osobne `.git`) |
| `platform/components/<name>/` | **Submoduły** montowane do assembly deploy (`gitdir: …/modules/components/…`) |
| `platform/` | Docker Compose, config, skrypty, dokumentacja operacyjna |

**Zasada edycji:** zmiany logiki w kanonicznym komponencie **i** w odpowiadającym submodule `platform/components/*` (workspace trzyma oba drzewa; testy platformy importują z `components/`).

Skan code2llm widzi obie kopie — metryki CC/duplikacji są **sztucznie podwojone**. Przy triażu ticketów planfile bierz ścieżki bez prefiksu `platform/components/`.

## Metryki (indeks 2026-07-17)

| Metryka | Skan surowy | Po deduplikacji lustra |
|---------|-------------|------------------------|
| LOC | ~52 382 | ~26 645 |
| Funkcje | 5 063 | — |
| Moduły | 409–427 | ~238 kanonicznych |
| CC̄ | 3.9 | — |
| high-CC (≥15) | 226+ | połowa to mirror |
| Cykle importów | 0 | OK |

**Języki:** JavaScript/MJS dominuje, potem PHP (portal, site-generator), shell, mało Pythona.

## Hotspoty (kolejność refaktoru)

| Priorytet | Plik | Problem |
|----------:|------|---------|
| P0 | `core/.../control/src/server.mjs` | ~1038 L, handler `server` CC≈280, fan-out≈91 |
| P0 | `connectors/.../bridge/src/server.mjs` | ~1313 L, `execute` CC≈72 |
| P0 | `core/.../control/public/app.js` | ~2485 L monolit UI |
| P1 | `core/.../control/src/delegation-manager.mjs` | `delegationDecision` CC≈57, `normalize…` CC≈32 |
| P1 | `org-core/.../server.mjs` | CC≈46 |
| P1 | `agents/.../browser-agent/src/server.mjs` | CC≈64 |
| P2 | `contractor-portal/.../index.php` | ~1124 L |
| P2 | `project-importer` blueprint / scenario-editor | CC 27–38 |

## Cele ewolucji (code2llm)

- CC̄: 3.9 → ≤2.8  
- max-CC: 280 → ≤20  
- god-modules: 27 → 0  
- high-CC (≥15): 226 → ≤113  

## Faza w toku (2026-07-17)

| Krok | Status |
|------|--------|
| Dokumentacja health + plan | **done** |
| Split `delegation-manager` → config / coverage / decision | **done** |
| Extract `access-registry`, `integration-records`, `delegation-summary` z control server | **done** (`server.mjs` ~1038 → ~954 L) |
| Routing HTTP control server (handlery per domena) | **next** |
| Split bridge `execute` | planned |
| Modularizacja `app.js` | planned |

Testy: `delegation-manager`, `scenario-editor`, `panel-contract`, `panel-router` — zielone (platform).

## Jak odświeżyć indeks

```bash
# z roota workspace; wyklucz node_modules i venv
code2llm ./ -f all --toon-yaml -o project --no-png \
  --exclude node_modules .venv platform/node_modules
```

Ticket’y z code2llm: `project/planfile-tickets.yaml` (495 sygnałów; ~połowa to mirror).  
Aktywna kolejka Koru/planfile w workspace może być pusta — backlog refaktoru trzymamy w docs + PR.

## Powiązane

- [ORGANIZATION_OS_ARCHITECTURE.md](./ORGANIZATION_OS_ARCHITECTURE.md)  
- [platform/docs/refactoring-summary-and-next-steps-2026-07-16.md](../../platform/docs/refactoring-summary-and-next-steps-2026-07-16.md)  
- [platform/docs/DELEGATION_MANAGER.md](../../platform/docs/DELEGATION_MANAGER.md)  
- Indeksy: `project/analysis.toon.yaml`, `project/map.toon.yaml`
