---
{
  "schema": "subactor.doc/v1",
  "id": "docs.operations.plf-806-delegation-capacity-and-routing-2026-07-21",
  "version": 1,
  "status": "current",
  "updated": "2026-07-21"
}
---

# PLF-806 — pojemność wykonawców i bezpieczne delegowanie

## Wynik

Manager delegowania pod adresem
`http://127.0.0.1:8091/?tab=delegation` pokazuje dla każdego aktywnego
człowieka, bota i maszyny:

- wykonywane teraz tickety oraz ich estymowany pozostały czas;
- liczbę ticketów w kolejce i sumę estymat;
- osobno liczbę ticketów `waiting_input` i procesów tła;
- przewidywany czas zwolnienia, wykorzystanie najbliższej godziny i liczbę
  dodatkowych typowych zadań możliwych do przyjęcia;
- skrót operacji dozwolonych przez aktywny kontrakt AQL;
- liczbę istniejących przypisań, których URI Process nie mieści się w
  kontrakcie przypisanego wykonawcy.

Endpoint źródłowy: `GET /api/delegation/manager`, pole `workloads`.

## Model estymacji

Ticket może podać etykietę `estimate-minutes:N` (1–1440). Bez etykiety
stosowane są jawne wartości planistyczne: Founder 30 min, inny człowiek 45 min,
bot/maszyna/usługa 20 min, pozostałe typy 30 min. Priorytet modyfikuje wartość
domyślną. Dla zadania rozpoczętego odejmowany jest czas od `started_at`, ale
pozostaje minimum pięć minut.

To jest estymata bufora, nie SLA. Procesy z etykietą `controller`, `scheduler`,
`background`, nazwą controller/scheduler/watchdog albo `max_attempts >= 1000`
są widoczne jako tło i nie zajmują bufora wykonawczego.

## Zasady routingu

1. Najpierw musi pasować reguła i aktywny kontrakt AQL musi pokrywać wszystkie
   wymagane operacje oraz URI Process.
2. Dopiero wśród wykonawców z pokryciem polityka `least_loaded` porównuje
   estymowane minuty, pracę bieżącą i długość kolejki.
3. `waiting_input`, sekrety wymagające authority, zadania terminalne i zadania
   bez pokrycia nie są automatycznie delegowane.
4. Dispatcher zapisuje delegację, ale sama delegacja nie jest dowodem wykonania.
   Wykonanie wymaga konsumenta kolejki oraz terminalnego receiptu.

Naprawiono również wcześniejsze zawyżanie obciążenia: tickety `failed` nie są
już klasyfikowane jako aktywne. Zwykły snapshot nie opisuje `waiting_input` jako
„gotowy”, tylko jako `waiting_for_input`.

## Tickety remediacyjne utworzone z audytu

| Ticket | Odpowiedzialność | Dlaczego ten wykonawca |
| --- | --- | --- |
| `PLF-808` | sieć LAN gateway i pełny monitoring | `administrator-bot`, kontrakt obejmuje proces repozytorium wymagany do naprawy konfiguracji |
| `PLF-809` | churn reconciliation i publiczne postconditions | `project-operator-bot`, kontrakt obejmuje `project.reconcile` i `project://*` |
| `PLF-810` | stare blokery, duplikaty i notification wrappers | `project-operator-bot`, kontrakt obejmuje `planfile.ticket.ensure` i `planfile://*` |
| `PLF-811` | rozbieżne kontrakty exact URI oraz brak konsumentów kolejek | `administrator-bot`, kontrakt obejmuje repozytoryjne procesy naprawcze |

`PLF-682`, `PLF-683` i `PLF-684` nie powinny być uznane za poprawnie
wykonywane tylko dlatego, że mają `assigned_to`: wymagają `repo://`, a wskazani
w nich wykonawcy nie mają spójnego aktywnego kontraktu (dla `security-bot` nie
ma nawet aktywnego bytu w rejestrze). PLF-811 ma usunąć tę rozbieżność bez
automatycznego rozszerzania praw.

## Testy

- jednostkowe: rozdzielenie current/queue/waiting/background, estymaty,
  wykrywanie przypisań poza AQL, wybór po ETA oraz fail-closed dla
  `waiting_input`;
- kontrakt panelu: obecność tabeli workload i poprawne ścieżki do płaskiego
  katalogu `platform/config`;
- pełny pakiet Control: 318 testów, 312 zaliczonych i 6 świadomie pominiętych.
