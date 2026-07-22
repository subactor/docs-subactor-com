---
{
  "schema": "subactor.doc/v1",
  "id": "docs.operations.public-ingress-ticket-runtime-review-2026-07-21",
  "version": 1,
  "status": "current",
  "updated": "2026-07-21"
}
---

# Public ingress i wykonanie ticketów — przegląd 2026-07-21

## Wynik

Przegląd objął bieżący stan publicznych hostów, PLF-592, PLF-593, PLF-685,
PLF-706 i PLF-713 oraz zgodność aktywnych URI Process z rejestrem runtime.

- `status.subactor.com` został opublikowany przez
  `plesk://host/site/command/sync`. PLF-685 i PLF-593 są `done` i mają EQL
  receipts. Root i `/health.php` zwracają HTTP 200 z poprawnym TLS.
- Dashboard świadomie zwraca `degraded`: 5/7 publicznych testów jest zdrowych;
  niedostępne pozostają aplikacja Foundera oraz Contracts.
- PLF-592 nie jest już fałszywie `ready`. Jest `waiting_input`, ponieważ brakuje
  publicznie osiągalnego, uwierzytelnionego upstreamu HTTPS do Control.
- PLF-706 i PLF-713 były duplikatami jednego intake Cloudflare. Oba zostały
  anulowane: pierwszy był zastąpiony, drugi wygasł, żaden nie zapisał sekretu.
- Watchdog nie wykazał zawieszonych egzekucji botów.

## Dlaczego Founder nie został opublikowany wcześniej

Nie blokował go sam certyfikat ani brak obiektu domeny w Plesku. Obiekt
`founder.subactor.com` istnieje, DNS wskazuje `217.160.250.222`, a certyfikat
obejmuje hostname. Plesk serwuje jednak stronę domyślną i 404 dla endpointów
Foundera, ponieważ nie ma trasy do działającego Control.

Lenovo nie udostępnia obecnie takiego originu publicznie. Jego publiczny port
443 kończy TLS na routerze Orange, a porty lokalnego ingressu nie są osiągalne.
Plesk nie może więc bezpiecznie reverse-proxy'ować do `127.0.0.1:8091` ani do
prywatnej nazwy kontenera.

## Błędy systemowe, które utrudniały diagnozę

1. Ticket deklarował
   `plesk://host/site/command/reverse-proxy-ensure`, zanim route istniał w
   runtime.
2. Nierozwiązana wartość `pending:reachable-subactor-control` trafiła do
   wykonywalnego procesu.
3. Lifecycle dopuszczał stan `ready` mimo kroku z blokerem.
4. Bridge zastępował dokładny błąd connectora ogólnym
   `urirun_handler_failed`.
5. Wdrożenie strony uznawało udany transfer za wynik końcowy. Test root URL
   wykrył pozostawiony `index.html` Pleska, mimo że `/health.php` już działał.
6. Secret intake używał losowej korelacji jako idempotency key, dlatego dwie
   próby tego samego `source_ticket + provider` tworzyły osobne tickety.
7. Zmiana DNS została wykonana bez powiązanego receiptu providera. Stan live był
   nowszy niż wynik zapisany w ticketach.

## Wprowadzone zabezpieczenia

- Plesk connector v0.14.0 obsługuje bounded route
  `site/command/reverse-proxy-ensure`. Dry-run wymaga publicznego HTTPS upstreamu
  z obserwowalnym challenge 401/403. Apply dodatkowo wymaga root SSH/CLI,
  przypiętego fingerprintu, dokładnego plan hash, jednorazowego grantu i osobnej
  bramki `PLESK_REVERSE_PROXY_APPLY=1`.
- Connector zachowuje obce dyrektywy nginx, zarządza tylko oznaczonym blokiem,
  uruchamia reconfigure i `nginx -t`, a przy błędzie przywraca poprzedni plik.
- Bridge zachowuje teraz dokładny kod handlera. Powtórny test PLF-592 zapisał
  `plesk_reverse_proxy_upstream_https_required`.
- Secret intake odrzuca drugi aktywny request o tym samym kluczu biznesowym;
  nowy może powstać po wygaśnięciu poprzedniego.
- Audyt `npm run tickets:routes` porównuje wszystkie aktywne procesy z live
  registry, wykrywa placeholdery i `false-ready`, a zadeklarowane
  `blueprint-only` raportuje osobno.
- Public status ma jawny `DirectoryIndex index.php`, dzięki czemu domyślne
  `index.html` Pleska nie przykrywa aplikacji. EQL końcowy sprawdza root,
  health JSON, strict TLS i brak wewnętrznych nazw/URL.

Aktualny audyt: 42 aktywne tickety, 21 z problemem wykonawczym, 28
nieobsługiwanych route, 10 jawnych blueprintów, 1 nierozwiązany placeholder i 0
przypadków `false-ready`. Liczby mają być traktowane jako kolejka refaktoryzacji,
nie jako 28 nowych connectorów.

## Granice connectorów i kolejność modularizacji

| Priorytet | Odpowiedzialność | Docelowy moduł | Decyzja |
|---|---|---|---|
| P0 | lifecycle ticketu, kolejki, respond/complete/reconcile | istniejący `urirun-connector-planfile` | rozszerzyć o exact routes; usunąć bezpośrednie wywołania Planfile z usług |
| P0 | publiczny tunnel/ingress do host runtime | istniejący `urirun-connector-proxy` | dodać profil zarządzanego outbound tunnel; nie mieszać z administracją Pleska |
| P1 | registry projektów i remediation | `urirun-connector-subactor-governance` | przenieść adaptery `project://...` z Control po ustabilizowaniu kontraktów |
| P1 | bezpieczne akcje Foundera i vault intake | `urirun-connector-human-twin` + `urirun-connector-planfile` | connector ma wykonywać bounded operation, UI i sesja pozostają w Control |
| P1 | research i lejek Connect | istniejące browser-control, linkedin, document, sheet, email | składać w process packs; nie tworzyć jednego dużego connectora marketingowego |
| P2 | walidacja AQL/EQL/OQL/TestQL | runtime + `urirun-connector-verify` | utrzymać czyste walidatory bez dostępu do sekretów i mutacji |

Najpierw należy implementować route wykorzystywane przez gotowe tickety, a nie
wydzielać kod tylko według katalogów. Każdy kandydat musi mieć stabilny URI,
ograniczony kontrakt wejścia/wyjścia, właściciela, dry-run lub read-only,
idempotencję, znormalizowany błąd i test przez Control → Bridge → URI node.

## Pozostała decyzja dla PLF-592

Potrzebny jest jeden stabilny upstream HTTPS:

1. zarządzany outbound tunnel z Lenovo do publicznego endpointu — preferowany,
   bo nie wymaga przekierowania portów routera; albo
2. wdrożenie Control na stale osiągalnym VPS/Plesk i wskazanie tego originu.

Po wskazaniu upstreamu connector wykona probe, wygeneruje hash planu i zatrzyma
się przed apply do czasu jednorazowej zgody authority. Dopiero zielony test
`/founder/action`, `/founder/form` i sesji Foundera pozwala zamknąć PLF-592.
