---
{
  "schema": "subactor.doc/v1",
  "id": "docs.architecture.planfile-http-audit-2026-07-20",
  "version": 1,
  "status": "current",
  "updated": "2026-07-21"
}
---

# Audyt i naprawa Planfile HTTP `127.0.0.1:8765`

Data: 2026-07-20
Ticket nadrzędny: `PLF-580`
Zakres URI: `http://127.0.0.1:8765/**`

## Wynik

Planfile działa poprawnie na porcie `8765` po przebudowie kontenera. Produkcyjna macierz kontrolna zakończyła się wynikiem **44/44**, test przeglądarkowy nie wykazał błędów konsoli ani nieudanych żądań, a pełny zestaw testów źródłowych zakończył się wynikiem **257 passed, 6 skipped**.

Ticket `PLF-580` powstał przed rozpoczęciem operacji i zawiera AQL, EQL, OQL oraz URI. Kontrolowane tickety `PLF-581`, `PLF-582` i `PLF-583` służyły wyłącznie do testów lifecycle/UI i zostały usunięte po weryfikacji. Pusty sprint testowy `plf580-http-audit` oraz jego mirror zostały również usunięte po sprawdzeniu zawartości.

## Znalezione i naprawione problemy

1. **Odczyt powodował mutację.** Samo otwarcie szczegółów interaktywnego ticketu automatycznie uruchamiało `/start` i zmieniało `ready/open` na `running/in_progress`. Usunięto automatyczny start. Uruchomienie jest teraz możliwe wyłącznie przez jawny przycisk **Start work**.
2. **Dashboard ukrywał rekordy.** Lista była bez komunikatu obcinana do 80 ticketów. Limit usunięto, dodano licznik widocznych rekordów. Test przeglądarkowy wyrenderował wszystkie 532 z 532 rekordów obecnych w chwili próby.
3. **Niespójna wersja.** OpenAPI publikowało `0.3.0`, a `/health` `0.1.117`. Oba źródła zwracają teraz `0.1.117` z jednego źródła wersji pakietu.
4. **Parametr `limit` był ignorowany.** Klient sterujący wywoływał `/tickets?limit=1000`, ale API ignorowało parametr. Dodano walidowane `limit` i `offset` oraz nagłówki `X-Total-Count` i `X-Result-Count`.
5. **`/ready` tworzył sprzeczny lifecycle.** Po retry pozostawał `status=in_progress`, stare przypisanie i stare czasy wykonania. Przejście `ready` atomowo przywraca teraz `status=open` i czyści claim oraz czasy poprzedniej próby.
6. **`/move` kończył się HTTP 500.** API, DSL, CLI i MCP odwoływały się do nieistniejącej metody magazynu. Dodano atomowe przenoszenie między sprintami, historię `move_ticket`, rollback przy błędzie i walidację identyfikatora sprintu.
7. **Możliwy path traversal przez nazwę sprintu.** Wartości typu `../../escape` są teraz odrzucane kodem 422 przed dostępem do systemu plików.
8. **`/sprints` czytał nieaktualne źródło.** Endpoint szukał starego `planfile.yaml` i zwracał pustą listę. Teraz czyta kanoniczne `.planfile/sprints/*.yaml`, podaje stabilny identyfikator pliku i `ticket_count`; POST tworzy sprint atomowo i odrzuca duplikaty.
9. **Runtime Context analizował pusty wolumen.** Kontener widział `/workspace`, więc raportował 0 usług i 0 workspace'ów. Repozytorium jest teraz zamontowane read-only jako `/project`; wynik produkcyjny: `subactor`, 31 usług i 13 workspace'ów.
10. **Runtime Context mógł ujawniać wartości environment.** API zwraca teraz tylko nazwy kluczy z wartością `<redacted>`.
11. **GET zapisywał dane.** Pierwszy odczyt konfiguracji Runtime Context tworzył plik. GET jest teraz bez efektów ubocznych; zapis PUT jest atomowy.
12. **Brak obsługi błędów UI.** Dashboard i Runtime Context sprawdzają `response.ok`, walidują typ listy ticketów i pokazują błąd zamiast generować nieobsłużony wyjątek Promise.
13. **CORS był otwarty dla każdej strony.** Domyślnie nie jest emitowane zezwolenie cross-origin. Opcjonalna, jawna allowlista jest dostępna przez `PLANFILE_CORS_ORIGINS` i została dodana zarówno do `.env`, jak i `.env.example`.
14. **Mutowalne wartości domyślne modeli request.** Zastąpiono je `default_factory`, aby instancje requestów nie współdzieliły kolekcji.

## Weryfikacja live

Sprawdzono dashboard, Swagger, ReDoc, health, OpenAPI, tickets list/detail/next/create/update/delete, pełny lifecycle (`claim`, `start`, `input-required`, `respond`, `fail`, `ready`, `complete`, `done`), przenoszenie sprintu, delegację, events, DSL, Runtime Context, redirect panelu dostępu, favicon oraz WebSocket `/ws`.

Najważniejsze wyniki:

- macierz HTTP/WS: `44/44`;
- `/health`: `status=ok`, `version=0.1.117`;
- OpenAPI: 26 ścieżek, 32 operacje, wersja `0.1.117`;
- przeglądarka: 0 błędów konsoli, 0 nieudanych requestów;
- odczyt szczegółów: `open/ready → open/ready`;
- jawny start: `open/ready → in_progress/running`;
- lista: wszystkie `532/532` ticketów w chwili testu;
- Runtime Context: 31 usług, 13 workspace'ów, wartości environment zredagowane;
- pełne testy: `257 passed, 6 skipped`;
- lint zmienionych modułów: bez błędów;
- logi kontenera po finalnej przebudowie: bez `ERROR`, tracebacków i odpowiedzi 500.

## Zachowanie świadome i pozostałe ograniczenia

- `GET/PATCH /yaml` zwraca 404 w tej instancji, ponieważ repozytorium nie zawiera opcjonalnego, legacy `planfile.yaml`. Kanoniczne tickety i sprinty działają przez `.planfile/`, `/tickets` i `/sprints`; 404 nie wpływa na kolejkę.
- Port `8765` pozostaje lokalnym panelem operatorskim bez logowania aplikacyjnego i jest publikowany wyłącznie na `127.0.0.1`. Nie należy wystawiać go bezpośrednio publicznie; interfej Foundera pozostaje na uwierzytelnionym panelu `8091`.
- Historia `/events` jest buforem pamięci procesu i znika po restarcie. Trwałym źródłem audytu pozostają historia i outputs ticketu Planfile.
- Runtime Context uczciwie pokazuje `pipelines=0` i `topology_nodes=0`, ponieważ w zamontowanym źródle nie ma głównego `Taskfile.yml` ani wygenerowanego `.testql/topology.json`.

## Pliki objęte zmianą

- Planfile: `planfile/__init__.py`, `planfile/api/server.py`, `planfile/core/store.py`, `planfile/runtime_context.py`;
- testy: `tests/test_ticket_api_events.py`, `tests/test_ticket_execution.py`, `tests/test_store_concurrency.py`;
- wdrożenie: `platform/docker-compose.yml`, `platform/.env`, `platform/.env.example`.

Istniejące przed audytem zmiany współbieżności w `planfile/core/store.py` i `tests/test_store_concurrency.py` zostały zachowane; nowe testy i implementacja zostały do nich dopisane bez cofania wcześniejszej pracy.
