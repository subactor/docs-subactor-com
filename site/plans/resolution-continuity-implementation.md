---
{
  "schema": "subactor.doc/v1",
  "id": "docs.plans.resolution-continuity-implementation",
  "version": 1,
  "status": "current",
  "updated": "2026-07-19"
}
---

# Resolution Continuity — plan i mapa wdrożenia

Status: wdrożony rdzeń P0–P3; integracje produkcyjne wymagają podpisanych mandatów i adapterów dostawców.

## Niezmienniki

- technicznym rootem jest `organization:constitutional-authority`, nie osoba;
- AQL odwzorowuje istniejące umocowanie i nigdy go nie tworzy;
- aktywacja następcy zmienia wykonawcę, nie zakres praw;
- pojedynczy brak odpowiedzi nie aktywuje praw awaryjnych;
- zablokowane zadanie nie zatrzymuje niezależnych procesów;
- platforma używa stanów `normal`, `degraded`, `continuity`, `emergency`, bez globalnego `waiting_input`.

## Mapa istniejących plików i zmian

| Zakres | Pliki | Zmiana |
|---|---|---|
| Runtime AQL | `runtime/src/autonomy-contract.mjs`, `runtime/src/contract-aql.mjs` | Principal organizacji/provider/quorum, constitutional authority oraz routing do `resolving`. |
| Orkiestracja | `orchestrator/src/pipeline.mjs`, `orchestrator/src/resolve-plan.mjs` | Human approval staje się wymaganiem capability; niezależne kroki są nadal wykonywane. |
| Resolution Engine | `orchestrator/src/resolution-engine/*.mjs` | Klasyfikacja blokera, strategie, aktorzy, authority, providerzy, budżet i continuity mode. |
| Graf uprawnień | `contracts/authority-succession.yaml` | Founder, deputy, continuity officer, quorum 2/3 i operator zewnętrzny. |
| Dostawcy | `contracts/human-capability-registry.yaml` | Dwa sloty providerów, SLA, jurysdykcja, capability i zakazy. Domyślnie nieaktywne do podpisania. |
| Budżety | `contracts/continuity-budgets.yaml` | Limity zdarzenia/miesiąca i jawna rezerwa awaryjna. |
| Kontrakty aktorów | `contracts/actors/**`, manifesty | Root organizacyjny i delegacje od constitutional authority. |
| Dokumenty prawne | `contracts/legal/templates/04-*`, `09-*` | Work orders, zastępstwo, odrębna tożsamość, minimalny dostęp i sukcesja. |

## Etapy produkcyjne

### P0 — authority bez SPOF

Rdzeń i konfiguracja są gotowe. 
Przed aktywacją należy uzupełnić dane następców,
uzyskać właściwe pełnomocnictwa/uchwały i oznaczyć ich mandaty jako aktywne. 
Testy muszą potwierdzić dwa niezależne sygnały niedostępności.

### P1 — Human Capability Registry

Format i selektor są gotowe. Należy podłączyć wiarygodne źródła dostępności, weryfikację tożsamości, konfliktów i statusu umowy. Rekord bez aktywnej umowy pozostaje niewybieralny.

### P2 — connector outsourcing

Adapter powinien implementować URI `human://registry/actor/query/available`, `human://provider/work/command/assign`, `human://provider/work/query/status`, `human://provider/work/command/replace`, `human://provider/work/query/evidence`, `human://provider/work/command/accept-result` oraz równoważne URI `outsourcing://approved-providers/**`. Każde wywołanie wymaga idempotency key, Evidence Bundle i zamknięcia dostępu.

### P3 — ciągłe rozwiązywanie

Rdzeń Resolution Engine jest gotowy. Kolejna integracja to trwały store blockerów, timer SLA i worker ponawiający wybór strategii. Scheduler nie może blokować kroków połączonych wyłącznie relacją `after` ani innych planów.

### P4 — Business Survival Mode

Do schedulerów platformy należy dodać kolejkę priorytetową: bezpieczeństwo/usługi, płynność, aktywni klienci, zobowiązania, przychód, odzyskanie zdolności, rozwój. Wejście w continuity nie nadaje dodatkowych praw.

## Kryteria wdrożenia produkcyjnego

1. Każda krytyczna capability ma dwóch aktywnych wykonawców lub provider fallback.
2. Mandaty i umowy są zweryfikowane poza AQL, wersjonowane i mają datę wygaśnięcia.
3. Providerzy mają odrębne tożsamości, minimalny dostęp i automatyczne odebranie dostępu.
4. Budżet, jurysdykcja, konflikt interesów i capability są sprawdzane przed work order.
5. Audyt zapisuje sygnały niedostępności, wybraną strategię, podstawę mandatu i evidence.
6. Test awarii całej ścieżki potwierdza `authority_exhausted` oraz kontynuację operacji w istniejących mandatach.

## Repozytorium scenariuszy jurysdykcyjnych

Uruchamialne przykłady znajdują się w sąsiednim repozytorium `examples/`.
Obejmują Polskę/EU, Niemcy/EU, Wielką Brytanię i Kalifornię oraz relacje:
employee, B2B/contractor, temporary agency, director/office holder i authorized
representative. Fixture prawny bez kompletu faktów zawsze przechodzi do
preautoryzowanej capability prawnej i nigdy nie tworzy umocowania.

```bash
cd ../examples
npm test
npm run scenario:all
```
