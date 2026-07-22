---
{
  "schema": "subactor.doc/v1",
  "id": "docs.architecture.public-pages-subdomains-deployment-2026-07-20",
  "version": 1,
  "status": "current",
  "updated": "2026-07-21"
}
---

# Raport subdomen i wdrożeń stron Subactor — 2026-07-20

## Werdykt

Nie wszystkie strony używane przez system mają obecnie działające publiczne
subdomeny. Cztery hosty są poprawne (`subactor.com`, `docs.subactor.com`,
`docs-stage.subactor.com`, `logo.subactor.com`), trzy publiczne hosty mają
niepoprawny certyfikat dla swojej nazwy (`www`, `contracts`, `founder`), a
`status.subactor.com` jest publicznie rozwiązywany mimo zadeklarowanej polityki
`private`.

Nie każda lokalna usługa powinna dostać publiczną subdomenę. Planfile, Mailpit,
Grafana, Prometheus, browser/vault agent, LLM gateway, mock Plesk, konektory i
pozostałe runtime'y zawierają dane lub funkcje administracyjne. Pozostają na
`127.0.0.1` albo mogą otrzymać wyłącznie prywatny DNS/VPN.

Produkcja nie została zmieniona podczas tego zadania. Nowy mechanizm wdrożenia
odmówił publikacji przed mutacją, ponieważ aktywny Plesk ma niespójną
konfigurację: katalog konektorów zwraca `configured:false`, a
`PLESK_BASE_URL=http://mock-plesk:8082`, mimo że ogólny doctor URI deklaruje
`production_publish_ready:true`.

## Jawny ślad procesu

Operacja została rozpoczęta ticketem nadrzędnym `PLF-584`, utworzonym przed
inwentaryzacją. Ticket zawiera `SUBACTOR_PROCESS_MANIFEST_V1` oraz definicje
AQL, EQL, OQL i URI. Preflight konektora utworzył osobny wykonawczy ticket
`PLF-585` z rezultatem i odwołaniami do logów.

`deploy.sh tickets` utworzył idempotentnie tickety docelowe:

| Ticket | Host | Stan | Powód oczekiwania |
|---|---|---|---|
| PLF-586 | `subactor.com` | `waiting_input` | realny profil Plesk nie jest skonfigurowany |
| PLF-587 | `www.subactor.com` | `waiting_input` | zmiana DNS i zapewnienie TLS wymagają decyzji człowieka |
| PLF-588 | `docs.subactor.com` | `waiting_input` | realny profil Plesk nie jest skonfigurowany |
| PLF-589 | `docs-stage.subactor.com` | `waiting_input` | realny profil Plesk nie jest skonfigurowany |
| PLF-590 | `logo.subactor.com` | `waiting_input` | realny profil Plesk nie jest skonfigurowany |
| PLF-591 | `contracts.subactor.com` | `waiting_input` | brak profilu Plesk, recepty PHP, DNS i TLS |
| PLF-592 | `founder.subactor.com` | `waiting_input` | brak publicznego ingressu, DNS i TLS |
| PLF-593 | `status.subactor.com` | `waiting_input` | wymagana decyzja: usunąć publiczny rekord albo dodać chroniony status |

Powtórne uruchomienie `tickets` wykorzystało istniejące tickety zamiast tworzyć
duplikaty.

## Stan hostów (strict DNS/TLS/HTTPS)

| Host | DNS | Strict TLS/HTTP | Ocena |
|---|---|---|---|
| `subactor.com` | A `217.160.250.222` | 200 | działa |
| `www.subactor.com` | CNAME `subactor.github.io` | `ERR_TLS_CERT_ALTNAME_INVALID` | nie działa poprawnie |
| `docs.subactor.com` | A `217.160.250.222` | 200 | działa |
| `docs-stage.subactor.com` | A `217.160.250.222` | 200 | działa |
| `logo.subactor.com` | A `217.160.250.222` | 200 | działa |
| `contracts.subactor.com` | CNAME `subactor.github.io` | `ERR_TLS_CERT_ALTNAME_INVALID` | nie działa publicznie; lokalnie `/health.php` zwraca OK |
| `founder.subactor.com` | CNAME `subactor.github.io` | `ERR_TLS_CERT_ALTNAME_INVALID` | nie działa publicznie; lokalny control zwraca OK |
| `status.subactor.com` | CNAME `subactor.github.io` | publiczny rekord przy polityce `private` | naruszenie polityki ekspozycji; lokalny status zwraca OK |

## Wprowadzone rozwiązanie

1. `platform/config/public-pages.json` jest kanonicznym rejestrem stron,
   ekspozycji, lokalnych źródeł, sposobu wdrożenia i wymagań granicznych.
2. `platform/deploy.sh` obsługuje `inventory`, `tickets`, `verify` i `deploy`.
   Każde uruchomienie wymaga istniejącego aktywnego ticketu nadrzędnego albo
   tworzy go przed pierwszym zapytaniem do publicznego URI.
3. Publikacja jest dozwolona dopiero po jednoczesnym spełnieniu warunków:
   jawne `SUBACTOR_DEPLOY_CONFIRM=1`, `PLESK_MODE=live`, zewnętrzny (nie mock)
   `PLESK_BASE_URL`, `connectors.plesk.configured=true` i zielony capability
   preflight. Sam ogólny doctor nie wystarcza.
4. Wspierane publikacje statyczne są wykonywane przez `subactor ask --apply
   --yes`; ten przepływ tworzy plan i ticket URI Process przed efektem, wydaje
   ograniczony grant/lease, a potem zapisuje wynik.
5. Weryfikacja HTTPS nigdy nie używa `curl -k` ani wyłączonej walidacji TLS.
   Stary `bin/subactor-live-publish.sh` deleguje teraz do kanonicznego,
   fail-closed `deploy.sh`.
6. Dodano publiczny wariant Caddy dla Panelu Foundera z automatycznym ACME,
   Basic Auth i nagłówkami bezpieczeństwa. Domyślny ingress nadal wiąże się
   wyłącznie z `127.0.0.1`; publiczne wystawienie wymaga jawnej zmiany.
7. Wszystkie zmienne ingressu są obecne w `.env.example`; kontrakt środowiska
   został zsynchronizowany bez kopiowania realnych sekretów.

## Testy

- testy jednostkowe `deploy-public-pages`: 7/7;
- test kontraktu środowiska i metadanych platformy: 3/3;
- konfiguracja Docker Compose z overlayem ingressu: poprawna;
- publiczny Caddyfile: `Valid configuration`;
- próba `SUBACTOR_DEPLOY_CONFIRM=1 ./deploy.sh deploy --target main`:
  oczekiwana odmowa z kodem 2 i przyczynami
  `plesk_live_profile_not_configured` oraz
  `plesk_base_url_is_mock_or_loopback`;
- lokalny control, Contractor Portal i System Status: health OK;
- cały system: 15/16 usług zdrowych, 0 krytycznych błędów,
  `operational_with_degraded_services`, `autonomy_ready=false`.

## Co pozostało do realnego wdrożenia

1. Founder powinien wprowadzić prawdziwy profil Plesk przez bezpieczny formularz
   integracji/secret intake w Panelu Foundera. Loginów i haseł nie należy
   podawać w tickecie, poleceniu CLI ani w rozmowie z LLM.
2. Po uzyskaniu `connectors.plesk.configured=true` można wznowić `PLF-586`,
   `PLF-588`, `PLF-589`, `PLF-590` i uruchomić publikację statyczną.
3. Dla `contracts.subactor.com` trzeba dodać do kontraktu bota receptę
   bezpiecznego bundla PHP, backup/rollback, docroot `app/public`, sekrety poza
   httpdocs oraz test `/health.php`. Dopiero potem wykonać zatwierdzony cutover
   DNS i certyfikat.
4. Dla `founder.subactor.com` trzeba wskazać publiczny host ingressu, ustawić
   hash hasła poza repozytorium, skierować DNS na właściwy serwer i dopiero
   wtedy uruchomić publiczny Caddyfile/ACME. Link magiczny Foundera pozostaje
   drugą warstwą logowania aplikacyjnego.
5. Founder musi zdecydować, czy `status.subactor.com` ma zostać usunięty z
   publicznego DNS, czy wdrożony jako osobny, ograniczony i niezawierający
   danych administracyjnych status page. Obecnego lokalnego panelu nie należy
   publikować bezpośrednio.

Po uzupełnieniu profilu Plesk bezpieczna komenda dla wspieranych stron
statycznych to:

```bash
cd /home/tom/github/subactor/platform
SUBACTOR_DEPLOY_CONFIRM=1 ./deploy.sh deploy \
  --parent PLF-584 --target managed-static
```

Skrypt ponownie wykona pełny preflight i przerwie działanie, jeśli konfiguracja
lub certyfikaty nie będą zgodne z kontraktem.

## Aktualizacja 2026-07-21 — PLF-592 i obiekt Plesk

Founder zatwierdził rozpoczęcie procesu od utworzenia domeny w Plesku. `PLF-592`
został przeniesiony z ogólnego `waiting_input` do kolejki
`project-operator-bot/ready` i otrzymał pełny envelope v2 z uporządkowanymi
definicjami AQL, EQL, OQL oraz URI. Reużywalna recepta znajduje się w
`deployment/founder-ingress-plesk.urirun.json`.

Wykonanie produkcyjne użyło kolejno:

1. `plesk://host/doctor/query/report` — connector `0.12.4` gotowy (`PLF-750`);
2. `plesk://host/subscription/query/capabilities` — uwierzytelniony profil
   subskrypcji `subactor.com` (`PLF-751`);
3. `plesk://host/site/command/subdomain-ensure` — dry-run i niezmienny
   `plan_hash` (`PLF-752`);
4. tę samą komendę w trybie apply z jednorazowym grantem ryzyka `boundary` —
   utworzono i odczytowo potwierdzono `founder.subactor.com`, Plesk object ID
   `314`, docroot `founder.subactor.com`; receipt znajduje się bezpośrednio w
   `PLF-592`;
5. `plesk://host/dns/query/authority` — autorytatywnym providerem pozostaje
   Cloudflare.

Po wykonaniu bramki wróciły do `AUTONOMY_MUTATIONS_ENABLED=0` oraz pustego
`PLESK_SUBDOMAIN_APPLY`. Bezpośrednie sprawdzenie originu
`217.160.250.222` z nagłówkiem `Host: founder.subactor.com` potwierdza działający
vhost: HTTP przekierowuje na HTTPS, HTTPS zwraca jeszcze `404`, a origin
prezentuje domyślny certyfikat Pleska bez SAN.

Następna zależność jest jawna: przed publicznym cutoverem DNS i ACME trzeba
zapewnić osiągalny, uwierzytelniony upstream aplikacji oraz zaimplementować
recenzowaną trasę connectora
`plesk://host/site/command/reverse-proxy-ensure`. Lokalny
`http://127.0.0.1:8091` na Lenovo nie jest osiągalny z serwera Plesk i nie może
być wpisany jako upstream Pleska. Dopiero po zielonym teście upstreamu wolno
wykonać `dns/command/reconcile`, `site/command/ssl-ensure`, propagację i strict
HTTPS postflight.

## Aktualizacja 2026-07-21 — dynamiczne rozszerzenia Plesk

Wniosek o „braku profilu Plesk” opisuje historyczny stan z 2026-07-20. W dniu
2026-07-21 profil live `https://prototypowanie.pl:8443` działa w URI node, a
`urirun-connector-plesk` obsługuje warstwy REST v2, XML API, SFTP/FTPS oraz
dynamiczny katalog zainstalowanych extensions.

Nowe procesy URI:

- `plesk://host/extensions/query/catalog` — oficjalny XML `extension.get`;
- `plesk://host/extensions/query/capabilities` — połączenie stanu live z
  zatwierdzonymi profilami operacji;
- `plesk://host/extension/query/call` — wyłącznie profilowane zapytania XML;
- `plesk://host/extension/command/call` — dry-run i mutacja dopiero po bramkach,
  dokładnym `plan_hash` i jednorazowym podpisanym grancie.

Zainstalowany moduł jest obiektem dynamicznym: pojawia się automatycznie w
discovery, lecz pozostaje `discovery-only`, dopóki jego operacja nie otrzyma
przejrzanego profilu. Zapobiega to utożsamianiu przycisku GUI z bezpiecznym,
stabilnym API. SSL It! jest modelowany jako extension, ale operacje certyfikatu
delegują do istniejącego `plesk://host/site/command/ssl-ensure`, zamiast wywoływać
nieudokumentowane endpointy panelu.

Root SSH/CLI pozostaje osobną przyszłą powierzchnią uprawnień. Konto systemowe
subskrypcji używane przez SFTP nie może zostać automatycznie podniesione do
administratora serwera Plesk.

## Aktualizacja 2026-07-21 — status produkcyjny i DNS API

Founder zdecydował o publicznym `status.subactor.com`. Nie jest publikowany lokalny
panel z portu `8199`, ponieważ zawiera nazwy kontenerów, adresy wewnętrzne i szczegóły
odpowiedzi usług. Zamiast niego powstał ograniczony serwis PHP w
`observability/services/public-status`, który odpytuje wyłącznie stałą listę publicznych
HTTPS, wymusza ścisłą walidację TLS i zwraca tylko nazwę hosta, kod HTTP, opóźnienie i
znormalizowany błąd. Nie przyjmuje URL od użytkownika, więc nie może działać jako SSRF.

Connector Plesk jest jednym wejściem URI, ale nie zakłada już, że lokalna strefa
Pleska jest autorytatywna. `subactor.com`, `autonomicznosc.pl` i
`prototypowanie.pl` są delegowane do Cloudflare. Zmiana lokalnej strefy Pleska
dla tych domen nie zmienia publicznego DNS. Connector udostępnia:

- `plesk://host/dns/query/records` — filtrowany odczyt `dns.get_rec`;
- `plesk://host/dns/command/replace` — konfliktowe A/AAAA/CNAME → jeden rekord
  docelowy przez `dns.del_rec` + `dns.add_rec` dla stref Pleska;
- `plesk://host/dns/query/authority` — consensus NS z Cloudflare i Google;
- `plesk://host/dns/command/reconcile` — provider-aware dry-run/apply, delegujący
  zapis do Cloudflare API, gdy Cloudflare jest autorytatywny;
- `plesk://host/dns/query/propagation` — porównanie oczekiwanej wartości i TTL
  między publicznymi resolverami oraz lokalnym resolverem runtime dla A/AAAA.

Każdy receipt podaje faktyczny `provider`, strefę i nameservery. Cloudflare token
oraz `zone_id` są pobierane z wpisu vault `cloudflare-dns` dla originu
`https://api.cloudflare.com` i nigdy nie trafiają do payloadu ani wyniku. Mutacja
wymaga dry-run, identycznego `plan_hash`, podpisanego jednorazowego grantu ryzyka
`boundary`, master gate oraz odpowiednio `PLESK_DNS_APPLY=1` lub
`CLOUDFLARE_DNS_APPLY=1`. Weryfikacja API providera i propagacja publiczna są
osobnymi stanami, ponieważ rozproszony DNS może zachowywać poprzednią wartość do
wygaśnięcia cache.

Odczyt live `extensions/query/capabilities` zwrócił aktywny
`panel-migrator 2.34.0` jako `discovery-only`. SSL It! nie został zwrócony przez
oficjalny `extension.get`, mimo że jego ekran jest dostępny w panelu. To jest
dodatkowy argument, by nie uzależniać obsługi certyfikatów od samej listy
extensions i zachować osobny, weryfikowany proces `ssl-ensure`.

## Aktualizacja 2026-07-21 — stan po PLF-730

Read-only inventory został powtórzony po uruchomieniu profilu live Plesk. Ticket
`PLF-730` zawiera receipt audytu 8 hostów. Platforma lokalna ma 16/16 zdrowych
usług, a bramka odczytowa Plesk jest zielona.

Publicznie działają cztery hosty:

- `subactor.com`, `docs.subactor.com`, `docs-stage.subactor.com` i
  `logo.subactor.com` wskazują na `217.160.250.222`, przechodzą strict TLS i
  zwracają HTTP 200;
- `www.subactor.com`, `contracts.subactor.com`, `founder.subactor.com` i
  `status.subactor.com` nadal dziedziczą publiczny CNAME
  `subactor.github.io` i kończą się `ERR_TLS_CERT_ALTNAME_INVALID`.

Edycja strefy subskrypcji w Plesku nie wymaga credentiala Cloudflare i może być
wykonana przez panel lub `plesk://host/dns/command/replace`. Nie oznacza to
jednak, że strefa Pleska jest publicznym autorytetem. Delegacja `subactor.com`
wskazuje obecnie na `addyson.ns.cloudflare.com` i `roman.ns.cloudflare.com`,
więc resolver publiczny nie odczytuje rekordów z lokalnej strefy Pleska.

Zgodnie z ostatnią decyzją Foundera rekord `*.subactor.com` pozostaje nieobecny
w lokalnej strefie Pleska. Nie należy go automatycznie odtwarzać. Publiczny
wildcard/CNAME widoczny przez resolvery jest osobnym stanem u obecnego
autorytetu DNS. Cutover konkretnych hostów wymaga albo zmiany rekordów w
autorytatywnej strefie, albo świadomej zmiany delegacji całej domeny; tych dwóch
operacji nie wolno przedstawiać jako lokalnej edycji Pleska.

Narzędzie `deploy-public-pages.mjs` domyka teraz read-only tickety
`inventory`/`verify` z completion receiptem również wtedy, gdy wykryje problemy.
Stan `findings_detected` jest prawidłowym wynikiem zakończonego audytu, a nie
powodem pozostawienia ticketu w `running`. Kod procesu nadal zwraca niezerowy
exit code, aby CI i operator zauważyli czerwone hosty.

### Scope profilu SFTP

Read-only proces `PLF-690` wykazał, że wspólny profil SFTP z parametrami
`host=prototypowanie.pl`, `domain=autonomicznosc.pl`, `remote_path=/httpdocs`
otwierał katalog zawierający 21 plików innego wdrożenia, a nie oczekiwane 9
plików projektu. Sam argument `domain` nie zmienia chrootu konta SFTP.

Od `urirun-connector-plesk` v0.12.4 (`PLF-736`) read-only remote inventory
odrzuca taki niejednoznaczny zakres kodem
`plesk_site_inventory_scope_unbound` przed pobraniem credentiala. `/httpdocs`
jest dozwolone tylko wtedy, gdy hostname efektywnego `credential_origin` w
vault odpowiada żądanej domenie. Alternatywą jest jawna ścieżka domenowa, np.
`/var/www/vhosts/autonomicznosc.pl/httpdocs`. `PLF-690` pozostaje otwarty do
czasu utworzenia domenowo związanego profilu lub potwierdzenia jawnej ścieżki;
nie wykonano mutacji.

## Aktualizacja 2026-07-21 — publikacja statusu i realny bloker Foundera

Nowszy live audit oraz wykonanie opisuje
[`../operations/public-ingress-ticket-runtime-review-2026-07-21.md`](../operations/public-ingress-ticket-runtime-review-2026-07-21.md).
`status.subactor.com` jest już opublikowany i ma receipts PLF-685/PLF-593.
`founder.subactor.com` ma poprawny DNS i TLS, lecz nadal nie ma osiągalnego
upstreamu aplikacyjnego; dlatego PLF-592 pozostaje `waiting_input`, a nie
`ready`.
