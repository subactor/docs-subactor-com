---
{
  "schema": "subactor.doc/v1",
  "id": "docs.operations.operational-review-2026-07-21",
  "version": 1,
  "status": "current",
  "updated": "2026-07-21"
}
---

# Przegląd operacyjny Subactor — 2026-07-21

## Werdykt

Projekt `autonomicznosc-pl` jest wdrożony i zgodny z manifestem. Publiczne
`https://autonomicznosc.pl/` zwraca HTTP 200, certyfikat obejmuje domenę, a hash
publicznego `index.html` jest identyczny z lokalnym źródłem. Kontroler zamknął
`PLF-614` jako `converged`; wykonanie produkcyjne ma osobny receipt w `PLF-687`.

Lokalny runtime działa. `http://127.0.0.1:8199/api/status` zwraca `healthy`:
16/16 usług, 0 błędów. Po odtworzeniu usług z overlayem Connector LAN wszystkie
kontenery są uruchomione, a usługi posiadające Docker healthcheck są zdrowe.
Grafana i Prometheus nie mają healthchecka w Compose, więc ich stan trzeba nadal
oceniać osobnym probe'em.

Publiczna powierzchnia Subactor nie jest w pełni zdrowa. `status.subactor.com`,
`contracts.subactor.com` i `founder.subactor.com` nadal rozwiązują się przez
Cloudflare do `subactor.github.io` i prezentują certyfikat `*.github.io`.
Plesk origin dla statusu działa pod adresem `217.160.250.222`, lecz wpis w strefie
Plesk nie zmienia publicznego DNS, ponieważ autorytatywne nameservery domeny
`subactor.com` to `addyson.ns.cloudflare.com` i `roman.ns.cloudflare.com`.

## Co zostało wykonane

| Obszar | Wynik | Dowód |
|---|---|---|
| Dokumenty prawne Autonomiczność.pl | treść kompletna 5/5; publiczne strony jeszcze niewdrożone | `PLF-617`, `PLF-697` |
| DNS i TLS Autonomiczność.pl | gotowe | A `217.160.250.222`; SAN `autonomicznosc.pl`, `mail`, `www` |
| Publikacja Autonomiczność.pl | 9 plików, 41 014 B przez SFTP | `PLF-687`, plan `ec65f065…` |
| Publiczny postflight | HTTP 200, asset 200, hash zgodny | `PLF-614` = `converged` |
| Rejestr niezależnych webspace Plesk | docroot i profil transportu w SSOT | `core@f7e4cb1`, `platform@9297ce4` |
| Semantyka wyniku URI Process | rozróżnia transport, dry-run i apply | `connectors@d127d4c` |
| Diagnostyka SFTP | ograniczona inwentaryzacja docroot bez treści i sekretów | `urirun-connector-plesk@a8cfb9a` |
| Ticket-first capability preflight | ticket + idempotency key przechodzą do bridge | `platform@9297ce4`, `core@f7e4cb1` |
| Connector LAN po restartach | odtworzony z właściwym overlayem | `hr-bridge` i `urirun-lan-gateway` healthy |
| Lokalny status platformy | 16/16 usług, 0 błędów | `127.0.0.1:8199/api/status` = `healthy` |

## Rozszerzona walidacja po wdrożeniu

Kolejna sesja testowa potwierdziła pełny agregat `npm test` platformy oraz:

| Zestaw | Wynik |
|---|---:|
| Core control | 276 passed, 6 skipped, 0 failed |
| Bridge connectors | 34/34 |
| Plesk connector | 94/94 |
| Observability | 5/5 |
| Panel | 25/25 |
| Reliability | 9/9 |
| Connector LAN live mTLS/ACL | PASS |

Negatywne wywołanie dozwolonego URI bez `ticket_id` zwróciło HTTP 409
`process_ticket_required`. Bramki mutacji pozostały wyłączone, a lease mutacji
nie istniał. Publiczny hash Autonomiczność.pl nadal wynosi
`5bb84efbf8bee4d19691cca012a2a9d75840360a377d77f0763036eab4b93ce1`.

Test obserwowalności wykrył fałszywie otwarty historyczny incydent. Planfile
zwracał zamknięty `PLF-107` po dokładnym ID, ale nie umieszczał archiwalnego
ticketu na bieżącej liście. Observer traktował brak na liście jako stan otwarty.
Po poprawce wykonuje ograniczony lookup po ID, zachowując fail-safe przy błędzie;
liczba otwartych incydentów spadła z 1 do 0 (`observability@f54c26a`).

Test ujawnił też lukę publikacyjną: zatwierdzone dokumenty z `projekty/06_legal`
nie należą do synchronizowanego katalogu `projekty/02_landing`, więc nie mają
publicznych URL-i ani odnośników w stopce. Cały katalog `projekty/` jest ponadto
poza repozytorium Git. `PLF-697` wymaga najpierw wersjonowanego źródła, następnie
pięciu stron HTML, dry-runu, grantu i publicznego postflightu.

## Dlaczego wcześniejsza publikacja nie zadziałała

Wystąpiły cztery niezależne problemy, które wcześniej zlewały się w jeden status:

1. `PLF-652` wykonał poprawny dry-run (`executed:false`, `dry_run:true`), lecz
   warstwa evidence nie schodziła dostatecznie głęboko przez envelope
   `bridge → urirun → function-subprocess`. W skrócie procesu pola były `null`.
2. Reguła `domena różna od subactor.com → /<domena>` działa dla domen w webspace
   `subactor.com`, ale `autonomicznosc.pl` jest osobnym webspace. Jego rzeczywisty
   transportowy docroot to
   `/var/www/vhosts/autonomicznosc.pl/httpdocs`.
3. Endpoint wydający apply-grant uruchamiał live doctor przez chroniony bridge,
   ale nie przekazywał `ticket_id` ani `idempotency_key`. Grant był więc
   odrzucany kodem 503 przed mutacją.
4. Normalizator capability doctora nie rozpakowywał głębokiego envelope bridge,
   przez co wszystkie wymagane capabilities wyglądały na brakujące.

Każdy z tych przypadków ma teraz test regresyjny. Produkcyjny apply odbył się
dopiero po nowym dry-runie, grancie związanym z dokładnym `plan_hash` i
krótkim lease. Lease został usunięty po operacji.

## Stan publicznych hostów

| Host | Stan strict HTTPS | Następna akcja |
|---|---:|---|
| `subactor.com` | 200 | brak |
| `docs.subactor.com` | 200 | brak |
| `docs-stage.subactor.com` | 200 | brak |
| `logo.subactor.com` | 200 | brak |
| `autonomicznosc.pl` | 200, hash zgodny | monitoring |
| `status.subactor.com` | certyfikat `*.github.io` | `PLF-685`, `PLF-689` |
| `contracts.subactor.com` | certyfikat `*.github.io` | `PLF-591`, po connectorze Cloudflare |
| `founder.subactor.com` | certyfikat `*.github.io` | `PLF-592`, po connectorze Cloudflare |

Wniosek operacyjny: panel DNS Plesk jest właściwym miejscem tylko wtedy, gdy
Plesk obsługuje autorytatywną strefę. Dla `subactor.com` źródłem prawdy jest
obecnie Cloudflare. Utworzenie rekordu w Plesk może przygotować przyszłą strefę,
ale nie wykonuje publicznego cutover.

## Aktualne tickety

### Zamknięte i zweryfikowane

| Ticket | Wynik |
|---|---|
| `PLF-617` | dokumenty prawne kompletne; historyczny `last_error` usunięty |
| `PLF-614` | projekt `converged`, publiczny content zgodny |
| `PLF-650` | cel generycznej publikacji osiągnięty przez `PLF-687` |
| `PLF-673` | jednorazowa zgoda/apply rozwiązana; historyczny blocker usunięty |
| `PLF-687` | produkcyjny upload i postflight zakończone receipt'em |

### Wymagają dalszej pracy technicznej

| Priorytet | Ticket | Następny rezultat |
|---|---|---|
| critical | `PLF-689` | connector Cloudflare DNS: query, exact upsert, vault, dry-run/grant/postflight |
| high | `PLF-685` / `PLF-593` | publiczny cutover `status.subactor.com`; wcześniejszy receipt został unieważniony |
| high | `PLF-591` | deploy/cutover `contracts.subactor.com` po obsłudze autorytatywnego DNS |
| high | `PLF-592` | cutover `founder.subactor.com`, potem strict TLS i ingress |
| high | `PLF-690` | ograniczenie profilu SFTP do docrootu; brak listowania systemowego `/` |
| high | `PLF-697` | wersjonowane źródło i pięć publicznych stron prawnych Autonomiczność.pl |
| high | `PLF-682` | exact URI komunikacji i odpowiedzi Foundera |
| normal | `PLF-683` | exact URI dashboardu, reconciliation i recruitment |
| high | `PLF-684` | exact URI secret intake i dowodów vault |

### Wymagają danych albo działania Foundera

| Priorytet | Ticket | Brakujące wejście |
|---|---|---|
| critical | `PLF-679` | złożenie sprawozdań Softreck OÜ za 2024–2025 |
| high | `PLF-653` | podstawa stażu, wynagrodzenie, czas, start, opiekun, pracodawca, URL aplikacji oraz sprawny surface Lenovo/KVM |

`PLF-597` pozostaje ticketem zbiorczym, ale jego stare blokery
`legal_documents_incomplete` i TLS Autonomiczność.pl zostały usunięte. Aktualny
zakres to autorytatywny DNS dla `status`, `contracts` i `founder`.

## Plan dalszej refaktoryzacji

1. Zrealizować `PLF-689` jako osobny `urirun-connector-cloudflare-dns`.
   Provider DNS musi być częścią desired-state; Plesk connector nie może
   raportować publicznego sukcesu na podstawie swojej nieautorytatywnej strefy.
2. Dodać EQL „authoritative DNS observed” do definicji ukończenia każdego
   publicznego hosta. Receipt ma powstawać dopiero po zapytaniu autorytatywnych
   NS i strict TLS z publicznego resolvera.
3. Zrealizować `PLF-690`: capability discovery dla dostępnych profili shell,
   konto/chroot ograniczone do webspace i negatywny test listowania `/`.
4. Ujednolicić `site-resources.json` z obserwacją `plesk://…/site/query/docroot`.
   Docroot, profil credential i provider DNS są danymi topologii, nie slotami
   wybieranymi przez LLM.
5. Rozszerzyć completion receipt o obowiązkowe biznesowe EQL. Sukces transportu
   i `dry_run_passed` nie mogą same zamknąć nadrzędnego celu publikacji.
6. Utrwalić regułę restartu: usługi należące do Connector LAN należy odtwarzać
   z `docker-compose.connector-lan.yml`; restart tylko z bazowym Compose usuwa
   sieć `connector-execution` z `hr-bridge`.

## Bezpieczne wznowienie

Najbliższa automatyczna praca nie wymaga kolejnego uploadu Autonomiczność.pl.
Najpierw wykonawca `security-bot` powinien podjąć `PLF-689` i `PLF-690`.
Do czasu gotowego konektora Cloudflare nie należy ponawiać zmian DNS
`status.subactor.com` przez Plesk ani oznaczać `PLF-685` jako zakończonego.
