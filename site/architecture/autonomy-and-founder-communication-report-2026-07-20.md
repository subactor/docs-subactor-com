---
{
  "schema": "subactor.doc/v1",
  "id": "docs.architecture.autonomy-and-founder-communication-report-2026-07-20",
  "version": 1,
  "status": "current",
  "updated": "2026-07-21"
}
---

# Raport autonomii i kanałów komunikacji z Founderem

**Stan na:** 2026-07-20, Europe/Warsaw
**Zakres:** lokalny stos Subactor, autonomia bez self-evolution, komunikacja Founder ↔ system, delegowanie pracy
**Charakter raportu:** wyniki testów kodu i działającego środowiska; test mock/lokalny nie jest dowodem gotowości produkcyjnej

> **Aktualizacja naprawcza 2026-07-20 18:45 CEST:** sekcje poniżej zachowują
> wcześniejszy stan diagnostyczny. Poniższy blok jest aktualnym, nadrzędnym
> wynikiem po realizacji ticketu `PLF-597`.

## 0. Stan po naprawie PLF-597

### Werdykt bieżący

- lokalny stack: **19/19 kontenerów uruchomionych, brak unhealthy**;
- dashboard: **16/16 usług zdrowych**, zero failed/degraded;
- inbound e-mail: **ready**, prawidłowy poll IMAP, brak ostatniego błędu;
- outbound e-mail: **działa przez realny SMTP**; świeży link Plesk wysłano do
  Foundera z `transport=external`;
- jawność URI Process: generatory intake Plesk/IMAP/SMTP wymagają istniejącego
  ticketa z co najmniej jedną definicją AQL/EQL/OQL/URI i zachowują manifest;
- autonomia pozostaje `false`, ponieważ **44 aktywne tickety oczekują na
  człowieka**. To rzeczywisty backlog, nie wcześniejsze zawyżone 146;
- mutacje produkcyjne są ponownie **fail-closed**:
  `AUTONOMY_MUTATIONS_ENABLED=0`.

### Naprawione usterki

1. Dashboard nie zalicza już terminalnych ticketów `done`, `canceled` i
   `blocked` do `human_attention`, nawet jeżeli stary rekord ma historyczne
   `execution.state=waiting_input`.
2. Planfile atomowo synchronizuje terminalny status z `execution.state`, czyści
   `assigned_to` i lease oraz zapisuje `finished_at`. Live regresja `PLF-598`
   potwierdziła przejście `open/waiting_input → canceled/canceled`.
3. Connector LAN odzyskał sieć `connector-execution`; mTLS health jest zielony,
   a gateway widzi 541 tras. Nie poszerzono dostępu do prywatnego executora.
4. IMAP nie omija już walidacji TLS. Dodano osobny SNI
   `INBOUND_EMAIL_IMAP_SERVERNAME=webmail.prototypowanie.pl`, zgodny z SAN
   certyfikatu, przy zachowaniu hosta i origin binding istniejącego sekretu.
5. Błąd IMAP nie jest już redukowany do ogólnego `imap_poll_failed`; bezpieczna
   przyczyna trafia do audytu i health.
6. Skrypty secret intake nie mogą utworzyć realnej operacji bez wcześniejszego
   ticketa i definicji procesu. Dowód jest dopisywany między markerami, więc
   ponowienie nie niszczy manifestu ani uzasadnienia.
7. `.env` Platformy i `.env.example` mają ten sam komplet **502 nazw**;
   `env-contract.json` jest zsynchronizowany. Portal kontraktora ma **30/30**,
   a `init-env.mjs` uzupełnia brakujące bezpieczne wartości domyślne bez
   nadpisywania istniejących sekretów.
8. Gate wdrożenia uznaje dynamiczny, wybrany profil Plesk za nadrzędny wobec
   bootstrapowego `PLESK_BASE_URL`; po zapisaniu profilu live nie zablokuje go
   już pozostawiony lokalny URL mocka.

### Komunikacja z Founderem teraz

| Kierunek | Stan |
| --- | --- |
| Founder → system przez IMAP | **Gotowe technicznie i zdrowe.** Ścisła autoryzacja nadawcy nadal obowiązuje. |
| System → Founder przez SMTP | **Gotowe i potwierdzone live.** `PLF-599` dostarczono transportem zewnętrznym. |
| Founder → system przez WWW lokalnie | **Działa.** Magic link i sesja HttpOnly były wcześniej przetestowane. |
| Publiczny `founder.subactor.com` | **Jeszcze nie.** DNS wskazuje GitHub Pages z niepasującym TLS; wymagany Plesk/ingress preflight. |
| Delegowanie przez sam adres e-mail | **Działa tylko dla jednoznacznie zarejestrowanego aktora** (np. `tom@prototypowanie.pl → founder`); nieznana lub niejednoznaczna osoba nadal fail-closed. |

### Co nadal wymaga działania

1. **Founder musi otworzyć link z e-maila dla `PLF-599` i podać dane
   administratora Plesk.** Dopiero potem system może utworzyć i sprawdzić
   dynamiczny profil live. Hasła nie należy wklejać do ticketu ani odpowiedzi.
2. Po zielonym Plesk preflight pozostają realne zmiany DNS/TLS:
   `www.subactor.com`, `contracts.subactor.com` i `founder.subactor.com` mają
   CNAME do GitHub Pages oraz błędny certyfikat; `status.subactor.com` narusza
   deklarację prywatnej ekspozycji.
3. Nie istnieje jeszcze bezpieczny panel zapisujący **każdą** zmienną runtime i
   restartujący wszystkie usługi. Integracje i secret intake są konfigurowalne
   przez WWW, ale pełne nadpisania instalacyjne nadal przechodzą przez
   `.env`/`.env.example`, walidator, ticket i kontrolowany deploy. Dodanie
   jednego zapisu z kontenera bez mechanizmu restartu dawałoby fałszywe
   poczucie zastosowania konfiguracji.
4. `44` aktywne eskalacje wymagają przeglądu/deduplikacji według intencji;
   system nie może bezpiecznie masowo zamknąć realnych poleceń Foundera.
5. Zmiany w wielu repozytoriach pozostają lokalnie niezatwierdzone i są
   wymieszane z równoległą pracą. Nie wykonano zbiorczego commita ani push,
   aby nie przejąć cudzych zmian.

### Dowody testowe po naprawie

| Zakres | Wynik |
| --- | --- |
| Core control | **167/167 PASS** |
| Agenci, vault, IMAP i chat | **28/28 PASS** |
| Integracje | **1/1 PASS** |
| Portal kontraktora | **10/10 PASS** |
| Planfile lifecycle | **20/20 PASS**, 1 test API pominięty przez warunek środowiska |
| Secret-intake process gate | **2/2 PASS** |
| Connector LAN | **3/3 PASS** i live mTLS health PASS |
| Public deploy gate | **8/8 PASS** |
| Planfile `127.0.0.1:8765` | Wszystkie bezpieczne GET-y sprawdzone; `/yaml` zwraca oczekiwane 404, bo bieżąca instancja używa `.planfile/sprints/*` i nie ma opcjonalnego strategicznego `planfile.yaml`. |

Tickety dowodowe: nadrzędny `PLF-597`, regresja terminalnego stanu `PLF-598`
(canceled po poprawnym teście) oraz aktywny intake Plesk `PLF-599`.

### Dzienny raport Foundera — PLF-600

Dodano deterministyczny scheduler raportu firmy. O 08:00 Europe/Warsaw zbiera
stan usług, dane Organization Core, zakończone prace oraz kolejkę decyzji
Foundera i wysyła jedną wiadomość przez wymagany zewnętrzny SMTP. Każdy raport
ma własny ticket utworzony przed odczytami i wysyłką, manifest AQL/EQL/OQL/URI,
klucz idempotencji oparty o dzień oraz wynik bridge. Dokumentacja operacyjna:
[FOUNDER_DAILY_DIGEST.md](../../platform/docs/FOUNDER_DAILY_DIGEST.md).

Walidacja live zakończona powodzeniem: scheduler utworzył `PLF-601` przed
pierwszym odczytem i wysyłką, bridge wykonał `email.send` przez transport
`external`, a ticket zakończył się jako `done` z odwołaniem do
`bridge-audit.jsonl`. Audyt control zawiera
`founder_daily_digest.delivered`. Ponowne wymuszenie raportu tego samego dnia
zwróciło `already_sent_today`; nie powstał drugi ticket ani druga wiadomość.

### Process Pack v1 — PLF-602

Rozpoczęto wyodrębnianie procesów z kodu serwera. Dzienny raport jest pierwszym
aktywnym `Process Pack v1`: osobno przechowuje NL, model AQL, oczekiwania EQL,
operacje OQL i graf URI. Loader odrzuca dynamiczne URI, traversal referencji,
sekretne lub nieznane pola, nieznane bindingi, brak modelu oraz niespójny graf.
Control udostępnia autoryzowane API listy, szczegółów, rozpoznania NL i preview
manifestu; żaden z tych endpointów nie wykonuje procesu. Dokumentacja:
[PROCESS_PACKS.md](../../platform/docs/PROCESS_PACKS.md).

Walidacja live: aktywny pack zwraca wszystkie cztery definicje, polskie NL jest
rozpoznawane deterministycznie, preview kompiluje manifest na kolejny dzień,
błędny binding kończy się `422`, nieznany pack `404`, a ponowne uruchomienie
raportu zachowuje `already_sent_today`. Po wdrożeniu system ma `16/16` zdrowych
usług i nadal dokładnie jeden ticket raportu za 2026-07-20.

### Process Packi Founder notify/reply — PLF-603

Powiadomienia o wymaganej decyzji i odpowiedzi w wątku Foundera zostały
przeniesione z manifestów zapisanych w `server.mjs` do dwóch aktywnych packów.
Obie ścieżki wymagają zewnętrznego SMTP, stałego `FOUNDER_EMAIL`, wcześniejszego
ticketu oraz pełnego AQL/EQL/OQL/URI. Reply zachowuje threading, odrzuca próbę
podmiany odbiorcy i czyści nagłówki z CR/LF. Szczegóły:
[FOUNDER_COMMUNICATION_PROCESS_PACKS.md](../../platform/docs/FOUNDER_COMMUNICATION_PROCESS_PACKS.md).

Walidacja live nie wykonywała testowej dostawy: licznik `email.send` w audycie
bridge pozostał `719 → 719`. Oba preview zwróciły pełne AQL/EQL/OQL/URI i
`require_external=true`, NL wybrało pack reply, a dashboard po stabilizacji
raportuje `16/16 healthy`.

## 1. Werdykt

System ma działający lokalny pion autonomii dla jawnie wspieranych procesów, ale
nie jest jeszcze w pełni autonomiczny produkcyjnie.

| Pytanie | Odpowiedź na dziś |
| --- | --- |
| Czy lokalny proces AQL → OQL → wykonanie → Planfile działa? | **Tak.** Live E2E przeszedł po synchronizacji konfiguracji i odtworzeniu bridge. |
| Czy Founder może zarządzać i delegować przez WWW? | **Tak, lokalnie.** Zweryfikowano logowanie, manager delegowania i przekazanie ticketu do `operations-lead`. Panel jest związany z `127.0.0.1`, więc nie jest publicznym portalem internetowym. |
| Czy Founder może dziś wysłać prawdziwy e-mail i wydać nim zadanie? | **Nie w środowisku produkcyjnym.** Kod i kontrolowany webhook działają, ale agent IMAP ma stan `waiting_credentials`. |
| Czy system może dziś wysłać prawdziwy e-mail do Foundera? | **Tak.** `PLF-569` zakończył `email.send` przez `transport=external`; serwer SMTP zaakceptował wiadomość z jednorazowym hasłem dla `tom@prototypowanie.pl`. Odbiór w skrzynce i pierwsze logowanie wymagają potwierdzenia Foundera. |
| Czy samo wskazanie adresu e-mail osoby wystarcza do delegowania? | **Nie.** Delegowanie działa po `actor_id`/roli i kontrakcie AQL. Brak resolvera `email → aktywny aktor → kontrakt → kolejka`. |
| Czy dowolne polecenie e-mail zostanie autonomicznie wykonane? | **Nie.** E-mail tworzy ticket `ready` w kolejce `project-operator-bot`, ale nie kompiluje jeszcze ogólnego polecenia do planu URI Process ani nie dowodzi wykonania przez osobnego consumera tej kolejki. |

Najkrócej: **WWW jest obecnie najlepszym działającym kanałem operacyjnym**, a
e-mail jest zaimplementowany i bezpiecznie bramkowany, lecz nadal wymaga
credentiali oraz domknięcia pętli `mail → intent → plan → execute → reply`.

## 2. Co zostało zaimplementowane

### Rdzeń autonomii

- kontrakty AQL dla ludzi i botów, ograniczenia modeli, operacji, URI Process,
  domen e-mail, liczby kroków i czasu ważności;
- podpisane apply granty związane z `plan_hash`, czasem i celem, wraz z ochroną
  przed replay (`jti`);
- rozdzielenie dry-run, odmowy authority, wykonania, weryfikacji i rollbacku;
- capability preflight przed obietnicą wykonania;
- intent packs i deterministyczne rozpoznawanie wspieranych poleceń;
- Planfile jako rejestr pracy, eskalacji i decyzji człowieka;
- Digital Twin z izolacją principal/kontrakt dla 8 aktorów;
- fail-closed: brak kontraktu, scope, capability, grantu lub sekretu nie jest
  raportowany jako sukces.

Szczegółowy stan wcześniejszych faz znajduje się w
[autonomy-implementation-status.md](autonomy-implementation-status.md) oraz
[unresolved-live-autonomy-blockers-2026-07-19.md](unresolved-live-autonomy-blockers-2026-07-19.md).

### Kanał e-mail przychodzący

Zaimplementowano:

- skrzynkę poleceń `agent@prototypowanie.pl`;
- allowlistę nadawców i odbiorców;
- zgodność nadawcy z aktywnym kontaktem Org Core;
- zgodność z kontraktem AQL i `ALLOW EMAIL_SENDER`;
- weryfikację SPF/DKIM/DMARC w trybie `strict`;
- deduplikację po `Message-ID`/fingerprincie;
- kwarantannę nieautoryzowanych wiadomości bez przechowywania ich treści;
- zapis zaakceptowanego polecenia jako ticketu Planfile;
- routing zaakceptowanego polecenia do `project-operator-bot`.

Dowody implementacji:

- [INBOUND_EMAIL_AUTHORIZATION.md](../../platform/docs/INBOUND_EMAIL_AUTHORIZATION.md),
- [processor.mjs](../../agents/services/inbound-email-agent/src/processor.mjs),
- [authorization.mjs](../../agents/services/inbound-email-agent/src/authorization.mjs),
- [inbound-email-policy.json](../../platform/config/inbound-email-policy.json).

### WWW i delegowanie

Zaimplementowano:

- panel Foundera z logowaniem administracyjnym;
- widok stanu systemu, modeli, planów, integracji i dostępów;
- manager delegowania `ticket → reguła → rola → kandydat → pokrycie AQL`;
- ręczne delegowanie ticketu do aktora/kolejki;
- ograniczony scheduler automatycznej delegacji;
- audyt zdarzeń `delegation.ticket.assigned`;
- osobne zarządzanie uprawnieniami aktora i delegowaniem ticketu.

Automatyczna delegacja jest obecnie skonfigurowana, lecz w żywym store ma
`automation_enabled=false`. Ręczne delegowanie działa.

Dowody implementacji:

- [DELEGATION_MANAGER.md](../../platform/docs/DELEGATION_MANAGER.md),
- [delegation-manager.mjs](../../core/services/control/src/delegation-manager.mjs),
- [delegation-config.mjs](../../core/services/control/src/delegation-config.mjs),
- [planfile-delegation-actors.json](../../platform/config/planfile-delegation-actors.json).

## 3. Testy wykonane 2026-07-20

### Wyniki pozytywne

| Test | Wynik | Co potwierdza |
| --- | --- | --- |
| `npm test` w `platform/` | **PASS** | Pełna lokalna bramka Platformy: meta, runtime, kontrakty, testkit, site-generator, Core i connector LAN. |
| `npm run test:agents` | **PASS** | Browser Agent, inbound-email-agent i autonomy-chat-agent. |
| `npm run test:panel` | **PASS** | Kontrakt i routing panelu WWW. |
| `bash scripts/test-inbound-email-flow.sh` | **PASS** | Autoryzowany payload utworzył `PLF-527`; obcy nadawca został poddany kwarantannie. Test używa wewnętrznego webhooka, nie realnego IMAP. |
| `autonomy-e2e.mjs` po naprawie driftu env | **PASS** | Kontrakt `contract_mrswhl0s_b7546caab2`, plan `plan_mrswhl1t_1604916258`, zadanie bota `PLF-532` i eskalacja `PLF-533`. |
| `digital-twin-self-live-e2e.mjs` | **PASS** | 8/8 aktorów widzi wyłącznie własną projekcję Digital Twin. |
| `digital-twin-human-e2e.mjs` | **PASS** | Eskalacja `PLF-534`, lokalny e-mail w Mailpit, jednorazowa akceptacja i wykonanie planu `plan_mrswhx33_9843bc8934`. |
| Niezależny Playwright headless | **PASS** | Logowanie do panelu, widoczny manager delegowania i przekazanie ticketu z WWW do `operations-lead`, stan `ready`. Fixture został usunięty. |
| Końcowy `docker compose ps` | **PASS** | Wszystkie uruchomione usługi aplikacyjne raportowały healthy. |

### Wykryte problemy i ważne ograniczenia testów

1. Pierwsze live E2E autonomii zakończyło się błędem na
   `create_plesk_mailbox`, ponieważ `hr-bridge` restartował się bez
   `PLESK_PANEL_XML_API_PATH`.
2. `node --env-file=.env scripts/validate-env.mjs` automatycznie dopisał pięć
   brakujących ustawień Pleska i utworzył backup
   `.env.backup-20260720T072344Z`.
3. Po odtworzeniu bridge ponowiony live E2E przeszedł. Był to drift lokalnego
   środowiska, a nie błąd kontraktu autonomii.
4. Standardowy pakiet GUI TestQL nie wykonał scenariuszy ról, ponieważ jego
   środowisko Python nie ma dodatku Playwright. Ten sam kluczowy workflow
   zweryfikowano niezależnym Playwright z zależności Platformy. Brak dodatku w
   TestQL pozostaje luką bramki testowej.
5. Końcowy dashboard raportuje 16/16 usług osiągalnych, ale nadal
   `autonomy_ready=false`, ponieważ istnieje 151 ticketów `waiting_input`.
   Interpretacja dashboardu: `operational_with_human_escalations`.
6. Dashboard uznaje inbound-email-agent za zdrowy na podstawie HTTP 200, mimo
   że jego stan funkcjonalny to `waiting_credentials`. Readiness e-maila jest
   więc obecnie zawyżany przez ogólny dashboard.

## 4. Rzeczywista gotowość kanałów Foundera

### Founder → system przez e-mail

**Stan: częściowo zaimplementowane, aktualnie nieaktywne live.**

Agent jest uruchomiony z `INBOUND_EMAIL_ENABLED=true`, polityką `strict`,
IMAP TLS i docelowym hostem pocztowym. Jego aktualny stan to jednak:

```json
{
  "state": "waiting_credentials",
  "last_poll_at": null,
  "last_poll_error": "inbound_email_vault_lease_failed:username"
}
```

W konsekwencji prawdziwa wiadomość nie zostanie teraz pobrana. Kontrolowany
webhook potwierdza autoryzację i utworzenie ticketu, ale nie zastępuje testu z
realnej skrzynki.

Nawet po dodaniu credentiali obecna implementacja kończy się na utworzeniu
ticketu z:

- kolejką `project-operator-bot`;
- stanem `ready`;
- tekstem wiadomości jako `inputs.prompt`;
- pustą listą `inputs.uri_processes`.

Brakuje przetestowanego, generycznego workera, który pobierze taki ticket,
zinterpretuje polecenie, utworzy ograniczony kontraktem plan, wykona go i odeśle
Founderowi wynik. Dziś e-mail jest bezpiecznym wejściem do rejestru pracy, a nie
pełnym kanałem autonomicznego wykonania dowolnego polecenia.

### System → Founder przez e-mail

**Stan bieżący: działa przez realny SMTP; wcześniejszy test lokalny ujawnił i
pozwolił usunąć dwa blokery.**

Test Digital Twin wysłał wiadomość trybem `smtp` z `transport="local"`.
Bezpieczna kontrola lease realnego SMTP zwróciła:

```json
{
  "credential_available": false,
  "error": "vault_entry_not_found"
}
```

Był to stan początkowy. Po jednorazowym secret intake credential został zapisany
w `smtp-system-email`. Pierwsza próba live następnie zatrzymała się na poprawnej
walidacji TLS: certyfikat serwera nie zawierał `mail.prototypowanie.pl` w SAN.
Nie wyłączono weryfikacji certyfikatu. Probe wykazał, że `prototypowanie.pl:465`
wskazuje ten sam adres IP i przechodzi weryfikację TLS; zaszyfrowany wpis vault
został przepięty na ten origin. Końcowa próba `PLF-569` zakończyła się
`status=succeeded`, `mode=smtp`, `transport=external`, odbiorca
`tom@prototypowanie.pl`.

### Founder → system przez WWW

**Stan: działa lokalnie dla wspieranych workflow.**

Zweryfikowano w prawdziwej przeglądarce headless:

1. otwarcie panelu;
2. logowanie Foundera;
3. wejście do managera delegowania;
4. otwarcie ticketu w Planfile;
5. wskazanie `operations-lead`;
6. zapis delegacji i potwierdzenie kolejki przez API.

Ograniczenie: panel jest wystawiony na `127.0.0.1`. Founder może używać go na
hoście albo przez kontrolowany dostęp LAN/VPN/tunel. Nie ma tu dowodu
publicznego ingressu, TLS, IdP ani MFA dla Internetu.

### Delegowanie przez samo wskazanie osoby adresem e-mail

**Stan: niezaimplementowane.**

Aktualna lista delegowania jest zamkniętym katalogiem aktorów. Rekord aktora ma
`id`, `principal`, `queue` i ścieżkę kontraktu, ale nie adres e-mail. Agent
poczty używa adresu wyłącznie do uwierzytelnienia nadawcy; nie wyciąga adresu
wykonawcy z treści i zawsze kieruje zaakceptowane polecenie do
`project-operator-bot`.

Nie można więc dziś bezpiecznie napisać „deleguj do osoba@example.com” i
oczekiwać wykonania bez wcześniejszego zarejestrowania tej osoby jako aktora.

## 5. Co jeszcze nie działa w pełni autonomicznie

### P0 — konieczne dla komunikacji z Founderem

1. Umieścić username/password skrzynki `agent@prototypowanie.pl` w szyfrowanym
   vault przez jednorazowy secret intake.
2. Umieścić credential realnego SMTP w vault i ustawić
   `SMTP_EXTERNAL_REQUIRED=true` po kontrolowanym teście.
3. Wykonać live test: realny e-mail Foundera → IMAP → autoryzacja
   SPF/DKIM/DMARC → dokładnie jeden ticket → odpowiedź realnym SMTP.
4. Dodać worker `email-ticket-executor`, który realizuje
   `prompt → intent → contract preflight → plan → execute/needs_human → reply`.
5. Zmienić readiness inbound-email: `waiting_credentials` i `degraded` nie mogą
   być raportowane przez dashboard jako pełne healthy.

### P0 — delegowanie osoby przez e-mail

Potrzebny jest osobny, fail-closed resolver:

```text
adres e-mail
  → dokładnie jeden aktywny kontakt Org Core
  → zweryfikowana tożsamość/principal
  → aktywny aktor na zamkniętej liście Planfile
  → ważny kontrakt AQL pokrywający wymagania ticketu
  → actor_id i kolejka
  → audytowalna delegacja
```

Reguły bezpieczeństwa:

- brak dopasowania lub wiele dopasowań → `waiting_input`, nie zgadywanie;
- osoba zewnętrzna bez kontraktu → zaproszenie/onboarding, nie wykonanie;
- samo istnienie adresu w treści e-maila nie nadaje uprawnień;
- delegacja nie może rozszerzać kontraktu AQL;
- należy potwierdzić odporność na spoofing, look-alike domains i prompt
  injection.

### P1 — autonomia operacyjna

- żywa automatyczna delegacja jest wyłączona (`automation_enabled=false`);
- 151 ticketów oczekuje na decyzję człowieka i obniża deklarowaną gotowość;
- produkcyjne mutacje są domyślnie wyłączone
  (`AUTONOMY_MUTATIONS_ENABLED=0`, brak `PLESK_SYNC_APPLY`);
- realny Plesk/DNS/TLS, publiczny publish i scope proof nadal wymagają zewnętrznych
  credentiali, mandatów i weryfikacji;
- publiczny panel/chat wymaga ingressu HTTPS, IdP/MFA, rate limitu i procedury
  unieważniania dostępu;
- nie wszystkie connectory mają jeszcze pełny, jednolity envelope wyniku oraz
  natywne wymuszanie child grantu na ostatniej granicy wykonawczej;
- GUI TestQL wymaga naprawy zależności Playwright, aby oficjalna bramka ról znów
  była samodzielnie zielona.

## 6. Rekomendowana kolejność domknięcia

1. **Realny inbound e-mail:** secret intake IMAP i jedno kontrolowane polecenie
   z prawdziwej domeny.
2. **Realny outbound:** SMTP vault, brak fallbacku w profilu produkcyjnym i
   odpowiedź korelowana z ticketem.
3. **Mail-to-execution worker:** tylko dla zamkniętego katalogu intentów;
   unsupported/ambiguous → Founder.
4. **Resolver osoby po e-mailu:** Org Core + aktor + kontrakt AQL + audyt.
5. **Publiczne WWW:** TLS, IdP/MFA i bezpieczny ingress albo formalnie
   wspierany dostęp tylko przez VPN/LAN.
6. **Readiness i backlog:** funkcjonalne health checki oraz przegląd 151
   `waiting_input` przed włączeniem automatycznego dispatchera.
7. **Kontrolowany pilot:** trzy scenariusze Founder → system:
   zadanie informacyjne, zadanie odwracalne i zadanie wymagające approval;
   każdy musi zakończyć się odpowiedzią, evidence i brakiem duplikatu.

## 7. Kryterium „gotowe do użycia przez Foundera”

Kanał e-mail można uznać za gotowy dopiero, gdy jednocześnie:

- agent ma `state=ready` oraz niepusty `last_poll_at`;
- realna wiadomość przechodzi DMARC/DKIM/SPF i tworzy dokładnie jeden ticket;
- ticket otrzymuje plan z konkretnymi URI Process albo jawne `needs_human`;
- wspierane zadanie zostaje wykonane i zweryfikowane;
- wynik wraca realnym SMTP do właściwego wątku;
- nieznany nadawca, spoofing, duplikat i delegacja do nieznanego adresu są
  blokowane;
- sekret nie pojawia się w ticketach, odpowiedziach ani logach.

Do tego czasu zalecany kanał operacyjny to lokalny panel WWW/Planfile, a e-mail
należy traktować jako funkcję w fazie aktywacji produkcyjnej.

## 8. Audyt konfiguracji nowej instancji i domeny `subactor.com`

### Zgodność `.env.example` z `.env`

Porównanie wykonane wyłącznie po nazwach zmiennych, bez ujawniania wartości:

```json
{
  "env": 479,
  "example": 479,
  "only_env": [],
  "only_example": []
}
```

`node --env-file=.env scripts/validate-env.mjs` zakończył się wynikiem
`Environment contract OK`. Na poziomie nazw pól `.env.example` jest więc
kompletny względem bieżącego `.env` i kanonicznego
`config/env-contract.json`.

Szablon nie zawiera realnych haseł ani tokenów. Sekrety wewnętrzne mają
placeholdery `__GENERATE_*__`, a credentiale usług zewnętrznych są puste.
`make init` tworzy `.env` z prawami `0600`, generuje wspierane sekrety
wewnętrzne, dobiera porty i sieć oraz migruje brakujące pola z backupem.

Nie oznacza to jednak, że czysty klon jest obecnie kompletną, bezobsługową
instalacją:

- profil domyślny jest profilem lokalnym/deweloperskim: mock Plesk, Mailpit,
  wyłączone mutacje autonomii i brak realnych credentiali zewnętrznych;
- szablon zawiera konkretne adresy tożsamości
  `@prototypowanie.pl`; nie są sekretami, ale nie są neutralnymi wartościami
  dla nowego tenanta;
- Compose wymaga czterech ignorowanych przez Git plików:
  `.secrets/browser-agent-vault-key`, `.secrets/mock-plesk-token`,
  `.secrets/contractor-chat-relay-token` i
  `.secrets/autonomy-chat-control-token`;
- `make init` uruchamia tylko `init-env.mjs` i walidator. Nie tworzy tych
  czterech plików. Skrypt `configure-autonomy-chat.mjs` tworzy dwa z nich,
  ale nie jest częścią `make init`; nie znaleziono analogicznego kroku init
  dla pozostałych dwóch.

Wniosek: **kontrakt zmiennych jest kompletny, lecz bootstrap czystej instancji
nie jest jeszcze w pełni samowystarczalny**. Potrzebny jest jeden idempotentny
`init-secrets`, wywoływany przez `make init`, oraz test uruchomienia z czystego
checkoutu.

### Konfiguracja przez WWW

Nie ma obecnie strony pozwalającej edytować wszystkie 480 zmiennych i
nadpisywać nimi `.env`. Endpoint `/api/runtime-config` jest tylko do odczytu i
publikuje bezpieczne metadane, a nie pełną zawartość środowiska.

Panel **Integracje** obsługuje typowane profile dla 12 providerów i 65 pól,
w tym Pleska, SMTP i komunikatory. Sekrety integracji są szyfrowane, maskowane
przy odczycie i mogą działać jako dynamiczny profil systemowy bez zapisywania
ich do `.env`. Jest to jednak częściowa warstwa override, nie uniwersalny
edytor konfiguracji.

Docelowa implementacja powinna rozdzielać:

1. bazową konfigurację instalacyjną `.env`/Compose;
2. typowane, dozwolone override runtime dla pól niesekretnych;
3. szyfrowany vault dla sekretów;
4. widok wartości efektywnej ze źródłem `default/env/panel/vault`, walidacją,
   audytem, rollbackiem i oznaczeniem `restart required`.

Nie należy umożliwiać zdalnej edycji wszystkich pól. Klucze vaulta, token
administracyjny, bindy, ścieżki i parametry sieci Docker powinny pozostać poza
zwykłym panelem runtime.

### Czy system może sam utworzyć pocztę na Plesku dla `subactor.com`

Stan jest **częściowo gotowy technicznie, ale nie domknięty end-to-end**:

- zapisany profil `plesk_subscription` poprawnie uwierzytelnił dostęp do
  subskrypcji/domeny `subactor.com` na realnym panelu Plesk;
- operacja `plesk.mailbox.create` potrafi wygenerować silne hasło, utworzyć
  skrzynkę i schować credential w vault bez zwracania sekretu do planu/logów;
- bieżący systemowy connector Pleska nadal używa jednak
  `PLESK_MODE=mock` i `http://mock-plesk:8082`;
- profil `plesk_subscription` służy do probe subskrypcji. Nie jest profilem
  systemowym `plesk`, z którego korzysta autonomiczne tworzenie skrzynek;
- utworzone credentiale trafiają pod ogólny identyfikator
  `plesk-mailbox-<hash>`, podczas gdy inbound oczekuje
  `agent-mailbox-runtime`, a outbound SMTP `smtp-system-email`;
- operacja nie aktualizuje atomowo `INBOUND_AGENT_EMAIL`,
  `REAL_SYSTEM_EMAIL`, `SMTP_EXTERNAL_USER/FROM`, polityki inbound ani kontaktu
  Org Core. Zmiana części pól startowych wymaga też odtworzenia procesu;
- przy polityce `existing=accept` istniejąca skrzynka może dać sukces bez
  credentialu. System nie odzyska wtedy hasła automatycznie;
- aktualny agent inbound nadal ma `waiting_credentials`, a credential realnego
  SMTP nie istnieje w oczekiwanym wpisie vault.

Wniosek: **dzisiaj system nie potrafi autonomicznie wykonać całego procesu
„utwórz skrzynki na `subactor.com` → podepnij inbound i SMTP → przełącz
tożsamości → skomunikuj się z Founderem”**. Ma większość klocków, ale brakuje
bezpiecznej orkiestracji i aktywnego live connectora.

Minimalne domknięcie:

1. zapisać i aktywować systemowy profil **Plesk API** w trybie live;
2. dodać operację `provision_mail_identity`, która tworzy lub kontrolowanie
   resetuje skrzynkę, wiąże credential z rolą inbound/SMTP i aktualizuje
   typowane override w jednej audytowanej transakcji;
3. rozdzielić skrzynkę poleceń systemu od adresu Foundera; adres Foundera jest
   zweryfikowaną tożsamością człowieka, a nie wartością do nadpisania;
4. uaktualnić policy/Org Core/AQL i odtworzyć tylko usługi wymagające restartu;
5. sprawdzić MX, SPF, DKIM i DMARC, logowanie IMAP, realną wysyłkę SMTP,
   korelację odpowiedzi oraz dokładnie jeden ticket na wiadomość;
6. w produkcji ustawić fail-closed dla wysyłki, np.
   `SMTP_EXTERNAL_REQUIRED=true`, bez cichego fallbacku do Mailpit.

## 9. Zrealizowane naprawy kodu (2026-07-20)

Poniższe pozycje zostały zaimplementowane i pokryte testami jednostkowymi w
lokalnej bramce (`npm test`, `test:testkit`, `test:meta`). Nie zmieniają one
faktu, że realne credentiale IMAP/SMTP, DNS/MX/SPF/DKIM oraz publiczny ingress
pozostają zadaniami operacyjnymi poza tym repo.

### 9.1. Uczciwy health/readiness (dot. §3.6 i P0.5) — **zrobione**

Dashboard rozróżnia teraz osiągalność transportową (`ok`, HTTP 200) od
gotowości funkcjonalnej (`ready`). Sonda czyta pole `state` z odpowiedzi
`/health` i traktuje `waiting_credentials` oraz `degraded` jako **nie w pełni
gotowe**: krytyczna usługa w takim stanie nie psuje `ok`, ale blokuje
`autonomy_ready` i daje interpretację `operational_with_degraded_services`.
Panel pokazuje takie usługi na żółto z opisem stanu. Inbound-email w
`waiting_credentials` nie jest już raportowany jako pełne healthy.

- `core/services/control/src/system-dashboard.mjs` (`evaluateServiceReadiness`,
  `services_degraded`/`critical_degraded`);
- `core/services/control/src/server.mjs` (`probeSystemService` czyta body);
- `core/services/control/public/app.js`, `.../public/style.css`;
- testy: `testkit/tests/system-dashboard.test.mjs`.

### 9.2. Idempotentny bootstrap sekretów (dot. §8) — **zrobione**

`make init` uruchamia teraz `scripts/init-secrets.mjs`, który idempotentnie
tworzy pięć plików `.secrets/*` wymaganych przez Compose i **nigdy** nie nadpisuje
istniejących. Trzy sekrety losowe są generowane offline, `contractor-chat-relay-token`
jest reużywany z `contractor-portal/.env`, a `autonomy-chat-control-token`
dostaje jawnie niefunkcjonalny placeholder z ostrzeżeniem, bo realny token musi
zostać wykuty przez control po `make up` (`make configure-autonomy-chat`).

- `platform/scripts/init-secrets.mjs`, `platform/Makefile`;
- testy: `platform/test/init-secrets.test.mjs` (czysty checkout, idempotencja, perms 0600).

### 9.3. Resolver e-mail → aktor, fail-closed (dot. „P0 — delegowanie osoby”) — **rdzeń zrobiony**

Nowy, czysty resolver realizuje łańcuch `adres → dokładnie jeden aktywny kontakt
→ principal → dokładnie jeden aktywny aktor z zamkniętej listy → pokrycie
kontraktu AQL → actor_id + kolejka`. Brak dopasowania osoby nieznanej →
`onboarding`; wiele dopasowań lub luka pokrycia → `waiting_input`; sam adres w
treści nie nadaje uprawnień; look-alike domeny nie pasują (dopasowanie ścisłe po
normalizacji); delegacja nie może rozszerzyć kontraktu. Wystawiony jako
read-only `POST /api/delegation/resolve-email`. Źródłem aktywnych kontaktów jest
ta sama polityka co ścieżka autoryzacji inbound.

- `core/services/control/src/delegation-actor-resolver.mjs`;
- `core/services/control/src/routes/delegation.mjs`, `.../server.mjs`;
- testy: `testkit/tests/delegation-actor-resolver.test.mjs` (10 przypadków, w tym
  spoofing/look-alike/ambiguity/coverage/expiry).

Pozostaje: podłączyć żywe kontakty Org Core jako alternatywne źródło oraz
ścieżkę onboardingu osoby zewnętrznej.

### 9.4. Worker mail → wykonanie (dot. P0.4) — **zrobione (bez auto-mutacji), wpięte w endpoint**

Dostarczono przetestowany rdzeń orkiestracji `prompt → intent (zamknięty
katalog) → preflight kontraktu → plan → execute/needs_human → reply`. Fail-closed:
nierozpoznane/niejednoznaczne polecenie nie jest zgadywane, luka kontraktu i
prośba o approval → `needs_human`, każde zakończenie zawsze generuje odpowiedź do
Foundera, a treść odpowiedzi jest redagowana z sekretów. Dodano kotwicę
korelacji `inputs.source` w tickecie inbound (message_id/reply_to/subject) oraz
nagłówki wątkowania `In-Reply-To`/`References`/`Message-ID` w wysyłce SMTP
bridge, aby odpowiedź trafiała we właściwy wątek.

Worker jest wpięty realnymi zależnościami i wystawiony jako
`POST /api/email-tickets/execute` (scope `routing:manage`):

- `recognizeIntent` → deterministyczny rejestr intent-packów (**zamknięty
  katalog**, bez fallbacku LLM/HR): `resolveIntentPack` → `{aql_model, situation,
  required_capabilities, uri_hint}`; brak dopasowania → `unsupported_operation`;
- `coverageFor` → `actorCoversRequirements` względem kontraktu
  `project-operator-bot` (delegacja nie rozszerza zakresu);
- `createPlan` → istniejące `createPlan` (plan `proposed`);
- `executePlan` → **domyślnie zawsze `needs_human` (approval_required)**, bo
  `AUTONOMY_MUTATIONS_ENABLED=0`; realny `executeApprovedPlan` uruchamia się tylko
  przy jawnie włączonych mutacjach i `apply=true`. Founder dostaje w odpowiedzi
  `plan_id` do zatwierdzenia;
- `sendReply` → bridge `email.send` z argumentami wątkowania (Mailpit lokalnie,
  realny SMTP po dzierżawie).

Pliki:

- `core/services/control/src/email-ticket-executor.mjs` (rdzeń);
- `core/services/control/src/email-ticket-worker.mjs` (recognizer/gate/glue);
- `core/services/control/src/routes/email-tickets.mjs`, `.../routes/dispatch.mjs`, `.../server.mjs`;
- `agents/services/inbound-email-agent/src/processor.mjs` (`inputs.source`);
- `connectors/services/bridge/src/server.mjs` (`sendSmtp` threading);
- testy: `testkit/tests/email-ticket-executor.test.mjs` (11) i
  `testkit/tests/email-ticket-worker.test.mjs` (6, w tym recognizer na realnym rejestrze).

Pozostaje wyłącznie operacyjne: realny SMTP/IMAP oraz świadoma decyzja o
włączeniu `AUTONOMY_MUTATIONS_ENABLED` dla ścieżki auto-wykonania.

### 9.5. Poza zakresem zmian kodu

Bez zmian pozostają pozycje wymagające dostępu operacyjnego: secret intake
realnego IMAP/SMTP do vaulta, DNS/MX/SPF/DKIM/DMARC, publiczny HTTPS
ingress/IdP/MFA oraz live connector Plesk. Kolejność ich domknięcia jak w §6.

---

Raport nie zawiera sekretów. Testy mutacyjne dotyczyły środowiska lokalnego i
mock Pleska. Produkcyjny apply, DNS cutover ani wysłanie prawdziwej wiadomości
nie zostały wykonane.

## 10. Globalny dowód wykonania procesu

Po decyzji Foundera z 2026-07-20 wprowadzono niezmiennik wykonawczy:

```text
ticket utworzony wcześniej
  + manifest SUBACTOR_PROCESS_MANIFEST_V1
  + co najmniej jedna definicja AQL/EQL/OQL/URI
  + zgodność bieżącego OQL lub dokładnego URI
  + idempotency key
  -> wykonanie connectora
  -> SUBACTOR_PROCESS_RESULT_V1
  -> wynik zbiorczy + evidence + referencje do logów w tym samym tickecie
```

Guard działa fail-closed w `hr-bridge` dla `/execute` i `/processes/run`, czyli
na ostatniej wspólnej granicy przed efektem. Control automatycznie tworzy ticket
dla zatwierdzonych planów, bezpośrednich URI Process i live capability
preflightów. Brama LAN nie wywołuje już executora bezpośrednio; `/run` przechodzi
przez bridge i wymaga `ticket_id` oraz `idempotency_key`.

Dowód live:

- próba bez ticketu: `409 process_ticket_required`, brak wykonania;
- poprawny proces: ticket `PLF-540` powstał przed wykonaniem
  `time://host/clock/query/now`;
- poprawny proces przez bramę LAN: ticket `PLF-542` powstał przed wykonaniem,
  a wywołanie przeszło `gateway → bridge guard → urirun-node`;
- po izolacji executora ticket `PLF-544` potwierdził poprawną ścieżkę control,
  a `PLF-545` ścieżkę `LAN gateway → bridge → urirun-node`;
- ticket zawiera manifest, dokładny URI, rezultat kroku, identyfikator
  wykonania, referencje do `bridge-audit.jsonl`/`audit.jsonl` i stan `done`.

Regresja po wdrożeniu: runtime 80/80, bridge 26/26, LAN gateway 3/3 oraz core
158/158. Oba warianty Compose przechodzą walidację konfiguracji.

Administracyjny bypass został domknięty w `PLF-543`:

- `urirun-node` nie publikuje żadnego portu hostowego;
- node działa wyłącznie w sieci `uri-executor`;
- oddzielny `urirun-node-token` jest generowany przez `make init` i montowany
  tylko do node oraz bridge; nie jest wartością ogólnego `.env`;
- gateway i control nie osiągają DNS/portu node, a gateway pobiera health/routes
  przez bridge;
- próba `/processes/run` bez ticketu nadal kończy się
  `409 process_ticket_required`;
- test pokrycia potwierdził 541 tras i 95 schematów; uzupełniono brakującego
  właściciela `dns://` (`urirun-connector-namecheap-dns`).

Na poziomie wdrożenia Compose nie istnieje już wspierana ścieżka wykonania URI
Process omijająca ticket guard. Osoba z uprawnieniami root/Docker nadal może
technicznie wejść do kontenera lub odczytać Docker secret; jest to granica
administracyjna hosta, a nie API autonomii i wymaga osobnego audytu dostępu do
hosta.

## 11. Dynamiczna komunikacja człowiek ↔ LLM przez formularze Markdown

W ramach ticketu implementacyjnego `PLF-553` dodano deklaratywny format
`subactor.interactive-form.v1`. LLM może zaproponować formularz w ścisłym JSON
Schema, a system może przedstawić go w Markdown:

````markdown
```subactor-form
{
  "schema": "subactor.interactive-form.v1",
  "title": "Wybierz priorytet",
  "description": "Odpowiedź trafi do ticketu.",
  "fields": [
    {
      "id": "priority",
      "type": "radio",
      "label": "Priorytet",
      "required": true,
      "options": [
        {"value": "normal", "label": "Normalny"},
        {"value": "high", "label": "Wysoki"}
      ]
    }
  ],
  "submit": {"kind": "ticket.respond", "label": "Przekaż odpowiedź"},
  "single_use": true
}
```
````

### Przepływ i miejsca zapisu

```text
prompt człowieka
  → LLM (strict JSON Schema)
  → walidacja serwera i biała lista pól
  → ticket Planfile z manifestem OQL/URI
  → publikacja deklaracji Markdown
  → render DOM bez wykonywania HTML
  → odpowiedź człowieka
      ├─ ticket.respond → Planfile
      ├─ uri.process → nowy ticket wykonawczy → bridge guard → urirun
      └─ secret_link → jednorazowy URL → zaszyfrowany Browser Agent vault
  → audyt + status submission
```

Zwykłe odpowiedzi są przechowywane w `interactive-forms.json` z prawami store
`0600` oraz dopisywane do powiązanego ticketu Planfile. URI Process otrzymuje
osobny ticket wykonawczy utworzony przez `runTrackedUriProcess` **przed**
wykonaniem. Hasło, token ani klucz nie mogą być polem zwykłego formularza:
serwer wymaga `secret_link`, a sekret trafia z jednorazowej strony bezpośrednio
do vaulta i nie przechodzi przez control, Markdown, ticket ani log formularza.

Dozwolone typy pól to: `text`, `textarea`, `email`, `url`, `number`, `select`,
`radio`, `checkbox`, `date` i `secret_link`. Zabroniono surowego HTML, skryptów,
CSS, dowolnych metod/URL formularza, nieznanych właściwości, nazw sugerujących
sekret, wildcardów URI, dodatkowych pól odpowiedzi i kluczy prototype pollution.
Renderer używa `document.createElement`/`textContent`; test kontraktowy blokuje
`innerHTML`, `insertAdjacentHTML`, `eval` i `new Function` w tym module.

API:

- `POST /api/interactive-forms/propose` — LLM proponuje, serwer waliduje,
  tworzy ticket i publikuje;
- `POST /api/interactive-forms` — publikuje zweryfikowany JSON lub dokładnie
  jeden blok Markdown `subactor-form`;
- `GET /api/interactive-forms[/:id]` — lista/szczegóły;
- `POST /api/interactive-forms/:id/submit` — walidowana odpowiedź do ticketu
  lub dokładnego URI Process;
- `POST /api/interactive-forms/:id/secret-link` — krótko ważny, jednorazowy
  link dla providera `mailbox` albo `plesk`.

Panel Foundera udostępnia te operacje w zakładce **Asystent LLM**: prompt dla
LLM, edytor bloku Markdown, listę opublikowanych formularzy, bezpieczny podgląd,
wysłanie odpowiedzi oraz utworzenie linku do sejfu.

### Dowód testowy i live

- 8/8 testów walidatora, publikacji, Planfile, single-use, trwałości dowodu i
  dokładnego URI;
- 20/20 testów kontraktu panelu, w tym brak wykonania modelowego HTML;
- mock OpenRouter potwierdził endpoint `subactor_interactive_form` i ścisły
  JSON Schema;
- live OpenRouter zaproponował formularz `form_mrt0rl8y_97d988fe75`; control
  zwalidował go, opublikował i utworzył `PLF-563`, który po ponownym odczycie
  nadal miał `HTTP 200`, `state=waiting_input`, manifest i ścisłą korelację
  form/ticket;
- Compose po zmianach jest poprawny, `hr-control` i `llm-gateway` zostały
  przebudowane, uruchomione i osiągnęły `healthy`;
- live formularz `form_mrt0nl1l_78b92b4fa8` utworzył wcześniej trwały ticket
  `PLF-562`, skorelowany przez `plan_id=interactive-form:<form_id>`; po
  odpowiedzi ticket nadal istniał (`HTTP 200`, `status=open`,
  `execution.state=ready`) i zawierał manifest;
- ten sam test wygenerował jednorazowy request vault
  `intake_mrt0nlzm_8ada19afe7` i zapisał niesekretną odpowiedź
  `form-response_mrt0nm05_a5e6500bb1` przez `ticket.respond`.

Pierwszy test live wykrył anomalię współbieżnego store Planfile: `PLF-557`
istniał przy publikacji i odpowiedzi (co potwierdzają trzy wpisy audytu), lecz
później zniknął z trwałego sprint store między zapisami `PLF-554` i `PLF-558`.
Nie został uznany za dowód końcowy. W odpowiedzi dodano fail-closed
`ensureEvidenceTicket`: przed submission, utworzeniem linku vault i tym samym
przed URI Process control ponownie pobiera ticket, sprawdza etykietę, manifest
oraz korelację `interactive-form:<form_id>`. Powtórzenie operacji na starym
formularzu zwraca teraz `409 interactive_form_evidence_ticket_missing` i nie
wykonuje skutku. Źródło utraty zostało następnie odtworzone i naprawione w
`PLF-564`; szczegóły znajdują się w §12.

### Pozostałe ograniczenia

- formularze są dziś dostępne w lokalnym panelu; publiczna wymiana przez WWW
  nadal wymaga HTTPS, IdP/MFA, rate limitu i polityki sesji;
- `secret_link` obsługuje obecnie tylko gotowe intake `mailbox` i `plesk`;
- LLM nie może sam wymyślić URI: dla `uri.process` potrzebny jest konkretny URI
  w zatwierdzonym kontekście, a serwer/bridge nadal egzekwują dokładny scope;
- odpowiedzi formularzy nie zastępują brakujących realnych credentiali
  IMAP/SMTP ani konfiguracji DNS;
- nie dodano jeszcze dostarczania linku formularza jako bezpiecznego,
  publicznego URL w realnym wątku e-mail; obecnie Founder otwiera go w panelu.
- pozostaje długookresowy monitoring Planfile w realnym ruchu; deterministyczna
  utrata ze starego snapshotu jest naprawiona i pokryta testem 8 writerów/201
  ticketów, a formularze nadal niezależnie wymagają aktualnego dowodu.

Po tej zmianie najlepszym wspieranym kanałem operacyjnym pozostaje panel WWW,
ale komunikacja nie musi już polegać na ręcznej edycji JSON-u: system może
dynamicznie poprosić człowieka o minimalny, typowany zestaw danych i zachować
pełny dowód przed/po wykonaniu.

## 12. Trwałość Planfile przy współbieżnych writerach

Naprawę wykonano w osobnym, utworzonym wcześniej tickecie `PLF-564` z EQL/OQL.
Utrata `PLF-557` nie wynikała z braku blokady samego zapisu. Przyczyną był
interfejs `Store.save_sprint()`:

```text
writer A: load_sprint() → stary snapshot
writer B: create_ticket() → nowy ticket zapisany pod lockiem
writer A: save_sprint(stary snapshot) → lock → pełne nadpisanie pliku
wynik: ticket writera B znika
```

Scenariusz został odtworzony deterministycznie w izolowanym katalogu:

```json
{"ticket_id":"PLF-001","survived":false}
```

`save_sprint()` pobiera teraz świeży stan **wewnątrz** `mutation_lock()` i
scala snapshot zamiast zastępować nim cały sprint:

- tickety nieobecne w przekazanym snapshotcie są zachowywane;
- jawne usuwanie nadal musi używać dedykowanego API delete;
- przy konflikcie tego samego ticketu wygrywa rekord z nowszym `updated_at`,
  więc stary bulk-save nie cofa nowszego przejścia lifecycle;
- `save_backlog()` korzysta z tych samych gwarancji.

Dowody:

- ta sama deterministyczna reprodukcja po poprawce: `survived=true`;
- 21/21 testów store, fast mirror i archiwizacji;
- pełna bramka Planfile: 248 passed, 6 skipped;
- po wdrożeniu obrazu test 8 procesów utworzył 201/201 unikalnych ticketów w
  izolowanym katalogu tymczasowym, bez luk ID i z poprawnymi exit code;
- po restarcie produkcyjnego kontenera `PLF-562`, `PLF-563` i `PLF-564`
  pozostały odczytywalne z właściwymi stanami.

Pliki źródłowe:

- `../../../semcod/planfile/planfile/core/store.py`;
- `../../../semcod/planfile/tests/test_store_concurrency.py`.

Fail-closed `ensureEvidenceTicket` w formularzach pozostaje celowo aktywny:
naprawa trwałości warstwy bazowej nie usuwa potrzeby sprawdzenia dowodu na
ostatniej granicy przed skutkiem.

Aktualny Compose zbudował poprawkę z lokalnego źródła
`/home/tom/github/semcod/planfile`. Aby gwarancja przeszła na nową instancję,
zmianę trzeba jeszcze opublikować jako commit/tag Planfile i przypiąć wersję
źródła/obrazu w Platformie; sama lokalna przebudowa nie jest dystrybucją
poprawki do czystego checkoutu na innym hoście.

## 13. Dostęp Foundera i hasło dostarczane e-mailem

Zmianę wykonano pod utworzonym wcześniej ticketem `PLF-569`. Ticket zawiera
manifest `subactor.process-manifest.v1` z AQL, EQL, OQL i URI, w tym jawny krok
`deliver / email.send`. Bridge zweryfikował, że ticket powstał przed próbą
wysyłki oraz że `plan_id`, krok i operacja odpowiadają manifestowi.

### Zaimplementowany przepływ

Lokalne wejście Foundera jest dostępne pod:

```text
http://127.0.0.1:8091/founder
```

`GET /founder` przekierowuje do panelu Asystenta z akcją `founder-login`.
Docelowym adresem konfiguracyjnym pozostaje `FOUNDER_PORTAL_URL`; po
uruchomieniu bezpiecznego ingressu powinien otrzymać wartość
`https://founder.subactor.com/`.

Bootstrap dostępu działa następująco:

1. uprawniony administrator wywołuje `POST /api/founder/access/bootstrap` z
   identyfikatorem istniejącego ticketa procesu;
2. control tworzy losowe jednorazowe hasło, ale zapisuje wyłącznie jego hash;
3. hasło może być wysłane wyłącznie przez `email.send` z
   `require_external=true`; Mailpit nie jest dozwolonym kanałem;
4. Founder wpisuje e-mail i hasło na stronie;
5. poprawne hasło jest atomowo zużywane i wymieniane na ograniczoną sesję w
   cookie `HttpOnly; SameSite=Strict`; token sesji nie jest zwracany w JSON ani
   zapisywany w localStorage;
6. kolejne użycie hasła jest odrzucane, obowiązuje czas ważności i limit prób;
7. mutacje wykonywane przez sesję cookie wymagają zgodnego `Origin`, co
   ogranicza CSRF; sesja ma scopes Foundera skonfigurowane osobno i nie zawiera
   `tokens:manage` ani dostępu do sekretów integracji.

Hasło nie trafia do Planfile, control audit ani bridge execution store. Bridge
utrwala identyfikator kroku i operację, ale nie argument `body`; wynik SMTP
zawiera wyłącznie tryb transportu i odbiorcę.

### Konfiguracja nowej instancji

Do `.env.example`, aktywnego `.env` i `config/env-contract.json` dodano:

- `FOUNDER_PORTAL_URL`;
- `FOUNDER_ACCESS_PASSWORD_TTL_MINUTES`;
- `FOUNDER_ACCESS_SESSION_TTL_MINUTES`;
- `FOUNDER_ACCESS_MAX_ATTEMPTS`;
- `FOUNDER_ACCESS_STORE_FILENAME`;
- `FOUNDER_ACCESS_SCOPES`.

Gate kompletności wykrył również wcześniejszy brak
`URIRUN_NODE_TOKEN_FILE` w szablonie. Pole dodano z pustą, bezsekretną wartością
domyślną. Kontrakt środowiska raportuje teraz 486 zadeklarowanych zmiennych i
brak referencji Compose spoza `.env.example`.

### Testy i live preflight

- 3/3 nowych testów: brak plaintextu w store/API/audycie, jednorazowość,
  `HttpOnly`, limit kanału external-only;
- pełny gate control w workspace Platformy: 161/161;
- `hr-control` i `hr-bridge` przebudowane i `healthy`;
- live `GET /founder`: HTTP 302 do ekranu logowania;
- live `GET /api/founder/access/status`: kanoniczny e-mail zamaskowany i
  `password_delivery=external_email_only`;
- kontrolowana próba `PLF-569` zakończyła się HTTP 503 i dowodem
  `smtp_vault_secret_unavailable:vault_entry_not_found`;
- stan Mailpit przed i po próbie był identyczny, więc hasło nie zostało
  zdegradowane do kanału lokalnego;
- skan trwałych `/data` control i bridge nie znalazł plaintextu wiadomości z
  hasłem.

### Aktualny stan

Kod, lokalny URL i realna wysyłka SMTP działają. Rekord dostępu ma
`status=delivered`; SMTP zaakceptował wiadomość dla `tom@prototypowanie.pl`.
Pozostaje potwierdzenie odbioru i pierwsze logowanie Foundera. Jednorazowe hasło
jest ważne 15 minut i po poprawnym użyciu zostaje wymienione na sesję `HttpOnly`.

Publiczne wystawienie `founder.subactor.com` nadal wymaga DNS, HTTPS, reverse
proxy oraz IdP/MFA/rate limitu. Jednorazowe hasło i sesja aplikacyjna nie są
zamiennikiem tych warstw infrastruktury.

### Jednorazowy intake credentialu SMTP

Browser Agent został rozszerzony o provider `smtp`. Formularz przyjmuje tylko
hasło; adres `info@prototypowanie.pl`, wpis vault `smtp-system-email` oraz host i
origin pochodzą z
konfiguracji serwera, a nie z danych podanych przez przeglądarkę. Publiczny MX
domeny został odczytany jako `10 mail.prototypowanie.pl.`. Ze względu na SAN
certyfikatu aktywny transport używa certyfikowanej nazwy `prototypowanie.pl`;
obie nazwy wskazują `217.160.250.222`.

Zabezpieczenia intake:

- token występuje w `#fragment`, więc nie jest wysyłany przez HTTP;
- strona natychmiast usuwa fragment przez `history.replaceState`;
- `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, CSP
  `default-src 'none'` i `frame-ancestors 'none'`, `X-Frame-Options: DENY`;
- link jest jednorazowy, wygasa i ma limit prób;
- hasło jest szyfrowane w vault i wiązane z dokładnym originem;
- origin z hostem innym niż host SMTP jest odrzucany;
- do Planfile i audytu trafiają tylko request ID i fingerprint tokenu.

Testy Browser Agenta: 15/15. Live request
`intake_mrt2eaby_b0fcbd17cd` utworzono dla `PLF-569`; został zużyty raz i ma
stan `completed`. Pełny URL z tokenem nie jest zapisany w raporcie ani
tickecie. Końcowy execution bridge to `exec_1784543009273_2c60ea185b15c`:
`succeeded`, `smtp`, `external`. Mailpit pozostał bez zmian, a skan `/data`
control/bridge nie znalazł treści zawierającej hasło.

## 14. Jednoklikowy link dostępu Foundera

Wariant z kopiowaniem hasła opisany w sekcji 13 został zastąpiony
jednorazowym linkiem. Zmianę wykonano pod utworzonym wcześniej ticketem
`PLF-570`, zawierającym manifest `subactor.process-manifest.v1` z AQL, EQL,
OQL i URI. Jawne operacje to wysyłka `email.send`, aktywacja
`founder.access.magic_login` i unieważnienie poprzedniego dostępu.

Hasło ujawnione w rozmowie było już zużyte, ale powiązana z nim sesja nadal
istniała. Rekord oznaczono `revoked_compromised`, a sesję unieważniono przed
utworzeniem nowego dostępu. W logach i raporcie nie utrwalono wartości hasła.

Nowy przepływ:

1. `POST /api/founder/access/magic-bootstrap` przyjmuje identyfikator
   istniejącego ticketa i przed skutkiem weryfikuje `plan_id`, `step_id` oraz
   operację OQL;
2. control generuje losowy token, ale zapisuje tylko jego hash;
3. e-mail zawiera jeden adres `FOUNDER_PORTAL_URL#access=...`, wysyłany z
   `require_external=true`;
4. `GET /founder` zwraca bezpośrednio panel (HTTP 200), dzięki czemu fragment
   nie przechodzi przez przekierowanie;
5. JavaScript odczytuje sekret z fragmentu i natychmiast wykonuje
   `history.replaceState`, zanim wyśle go w ciele żądania do
   `POST /api/founder/access/magic-login`;
6. endpoint ponownie waliduje ticket i krok `activate-magic`, atomowo zużywa
   link, tworzy sesję `HttpOnly; SameSite=Strict` i dopiero po poprawnym
   zapisaniu rezultatu kończy ticket;
7. błąd zapisu dowodu cofa dostęp: sesja jest unieważniana, a rekord przechodzi
   do `activation_failed`.

Po wysyłce ticket automatycznie przechodzi do `execution.state=waiting_input`.
Jego wynik zawiera status dostarczenia, identyfikator dostępu, czas i nazwę
transportu, bez tokenu. Kliknięcie linku uzupełnia wynik aktywacji i kończy
ticket. Jest to rozdzielenie dwóch skutków: dostarczenia oraz udzielenia sesji.

### Konfiguracja i testy

Dodano `FOUNDER_ACCESS_MAGIC_LINK_TTL_MINUTES` do `.env.example`, aktywnego
`.env`, walidatora oraz kanonicznego `config/env-contract.json`. Oba pliki env
mają po 487 kluczy; liczba kluczy brakujących w dowolną stronę wynosi zero.

Dowody testowe i live:

- testy Founder access: 7/7;
- pełny gate control: 165/165;
- kontrakt Platformy: 3/3, `validate-env` poprawny;
- live `GET /founder`: HTTP 200;
- bridge execution `exec_1784543920491_aae4ff75fa9e6`: `succeeded`, `smtp`,
  `external`;
- lokalny Mailpit nie otrzymał wiadomości;
- skan `/data` control i bridge: zero plików z jawnym tokenem magic linku;
- `PLF-570`: `open`, `execution.state=waiting_input`,
  `delivery.status=succeeded`, `transport=external`.

Link został wysłany na kanoniczny adres Foundera. Ticket pozostaje otwarty do
kliknięcia; to oczekiwany stan fail-closed, ponieważ samo dostarczenie e-maila
nie jest dowodem przyznania dostępu.

## 15. Ponowna wysyłka linku na żądanie Foundera

Na kolejne jawne żądanie utworzono przed skutkiem ticket `PLF-578` z manifestem
AQL/EQL/OQL/URI. Pierwsze dwie próby przygotowania payloadu ticketa zostały
odrzucone przez walidację lub lokalny parser przed utworzeniem dowodu; nie
uruchomiły wysyłki. Poprawny ticket otrzymał stan `running`, a dopiero później
wykonano `deliver-magic / email.send`.

Wynik live:

- bridge execution: `exec_1784559464309_c5d118b52931f`;
- status: `succeeded`, tryb `smtp`, transport `external`;
- `PLF-578`: `open`, `execution.state=waiting_input`,
  `delivery.status=succeeded`;
- liczba aktywnych rekordów `delivered`: dokładnie 1;
- poprzedni link: `superseded`;
- nowy link: `delivered`;
- lokalny Mailpit bez nowej wiadomości;
- skan `/data` control i bridge: zero plików z jawnym tokenem.

Nowy link został wysłany wyłącznie na kanoniczny adres Foundera. Po kliknięciu
endpoint ma zużyć rekord, utworzyć sesję HttpOnly i zakończyć `PLF-578` wraz z
wynikiem aktywacji.

## 16. Kopiowanie sekcji i formularzy panelu

Kontekst formularza przesłany przez Foundera potwierdził działającą sesję
`Founder web session`. `PLF-578` po kliknięciu linku ma stan `done`, wynik
`succeeded` i `access_method=magic_link`, więc pełna pętla dostępu została
potwierdzona również live.

Rozbudowę kopiowania wykonano pod utworzonym wcześniej ticketem `PLF-579` z
manifestem AQL/EQL/OQL/URI. Panel udostępnia teraz:

- `Kopiuj sekcję jako JSON` dla każdej głównej sekcji;
- dotychczasowe `Kopiuj formularz jako JSON` dla każdego formularza;
- `Kopiuj wszystkie sekcje`;
- `Kopiuj wszystkie formularze`;
- `Kopiuj cały panel`, zawierający oba kompletne zbiory.

Eksport zawiera kontekst trasy, środowiska i jawnej tożsamości, pola formularza,
bezpieczny tekst sekcji, tabele i jawnie oznaczone outputy. Pola hasła,
credentiale, tokeny oraz rozpoznane wartości sekretne są zastępowane przez
`[REDACTED]`. Elementy formularzy są eksportowane strukturalnie, a wartości
kontrolek nie są kopiowane jako surowy tekst sekcji.

Dowody:

- panel contract: 25/25;
- control gate: 165/165;
- live Playwright na `/?tab=dashboard`: HTTP 200;
- 14 sekcji i 14 odpowiadających kontrolek kopiowania;
- 14 formularzy z indywidualnym eksportem;
- poprawny JSON dla pojedynczego formularza, pojedynczej sekcji, wszystkich
  sekcji, wszystkich formularzy i całego panelu;
- sztuczny sekret nie wystąpił w żadnym z pięciu odczytów schowka;
- `PLF-579`: `done`, `result.status=succeeded`, siedem odwołań do artefaktów i
  logów testowych.

## Walidacja live: pełna pętla polecenie-e-mail → plan → approval → wykonanie (2026-07-20)

Zweryfikowano na działającym stacku komendą `subactor`, że autoryzowane polecenie
Foundera przechodzi cały obieg autonomiczny z człowiekiem-w-pętli:

```
tom@prototypowanie.pl → agent@prototypowanie.pl ("opublikuj dokumentację na docs-stage.subactor.com")
  → autoryzacja (kontakt + kontrakt) → ticket PLF-573 (queue project-operator-bot, ready)
  → email-ticket-worker: intent (pack docs-stage-httpdocs-publish, zamknięty katalog)
      → preflight kontraktu project-operator-bot: POKRYCIE OK
      → createPlan → plan_mrt8jayl_11e9cd3fb6 (proposed, model docs-httpdocs-sync.pl.aql)
      → needs_human: approval_required (bo AUTONOMY_MUTATIONS_ENABLED=0), PLF-573 → waiting_input
  → Founder: POST /api/plans/…/approve → approved
  → Founder: POST /api/plans/…/execute → executed (krok task.create, mode planfile-rest,
      utworzył ticket wykonawczy docs-httpdocs-sync)
Ślad audytu: email_ticket.batch → plan.proposed → plan.approved → process.ticket.created → plan.executed
```

Zrealizowane w tej iteracji (kod + testy jednostkowe zielone, walidacja live):

1. **Uczciwy readiness** — dashboard rozróżnia osiągalność od gotowości; inbound-email
   `waiting_credentials` raportowane jako `degraded`, `interpretation=operational_with_degraded_services`.
2. **Resolver e-mail → aktor** (fail-closed) — `POST /api/delegation/resolve-email`.
3. **email-ticket-worker** — zamknięty katalog intentów, preflight, plan/`needs_human`, korelowana
   odpowiedź (label `emailsrc:`), threading SMTP, zawsze reply, redakcja sekretów; endpoint
   `POST /api/email-tickets/execute`.
4. **Idempotentny `init-secrets`** wpięty w `make init`.
5. **Ingress Foundera** — nakładka `docker-compose.ingress.yml` + Caddy (HTTPS + auth); `caddy validate` OK.
6. **TLS altname** — konfigurowalny `servername` w obu ścieżkach SMTP bridge (`SMTP_EXTERNAL_SERVERNAME`
   / pole `servername` profilu), bez wyłączania weryfikacji.
7. **Kontrakt `project-operator-bot`** rozszerzony o `plesk.transport.sftp`, `plesk.tls_san_check`,
   `plesk.ssl_ensure` — polecenie publikacji trafia do planu zamiast eskalacji.

Nie wykonano realnej mutacji Plesk ani nie włączono `AUTONOMY_MUTATIONS_ENABLED` —
ostatnia bariera pozostaje świadomie zamknięta. Kanał `System → Founder` wysyła
przez realny zewnętrzny SMTP (`transport=external`); dostarczenie do skrzynki nie
jest weryfikowalne z tego środowiska.

## 17. Audyt panelu Planfile `127.0.0.1:8765`

Pełny audyt HTTP, UI, WebSocket i lifecycle wykonano pod ticketem `PLF-580`.
Usunięto mutację przy samym otwarciu szczegółów, cichy limit 80 rekordów,
niespójność `/ready`, niedziałające `/move`, niekanoniczne `/sprints`, błędny
Runtime Context, otwarty CORS i pozostałe problemy opisane w osobnym raporcie:
[planfile-http-audit-2026-07-20.md](planfile-http-audit-2026-07-20.md).

Wynik końcowy: macierz produkcyjna `44/44`, browser bez błędów, pełne testy
Planfile `257 passed, 6 skipped`, kontener po przebudowie zdrowy.

## 18. Stan operacyjny, GitHub i kolejne plany (2026-07-20, aktualizacja)

### Scalenie na GitHub

Cała funkcjonalność „autonomia + komunikacja z Founderem" jest na `main` we
wszystkich repozytoriach (`core`, `agents`, `connectors`, `contracts`, `testkit`,
`platform`) — **jedna gałąź `main`, brak gałęzi feature ani przestarzałych**.
Wiring `server.mjs`/`dispatch.mjs`/`delegation.mjs` oraz bridge (threading +
`servername`) zrekonstruowano na czystej bazie i scalono. Świadomie poza `main`
pozostaje jedynie `scripts/init-secrets.mjs` (splątany lokalnie z równoległym
`urirun-node-token`; wejdzie razem z tamtym commitem).

### Kolejka Foundera — sprzątnięta

Kolejka Foundera została odszumiona: zamknięto demo onboarding i zdeduplikowano
powtórzone polecenia (każda distinct operacja → najnowszy ticket). Efekt:

- aktywne tickety Foundera: **135 → 31 unikalnych operacji**;
- `human_attention`: **155 → 26**;
- dashboard uwzględnia teraz, że `done/canceled/blocked` nie zawyżają uwagi
  człowieka (poprawka w `system-dashboard.mjs`).

Pozostałe 31 to realne pozycje: ~20 poleceń publikacji `[founder]` do
`*.subactor.com`, 5 publikacji systemowych, 3 realne konfiguracje (aktywacja
SMTP `info@`, dostęp admina Plesk, skrzynka `agent@`) oraz warianty onboardingu.

### Kryterium „aktualne" — spełnione

Nie ma już starych/osieroconych ticketów: wszystkie ≤ 7 dni, kolejka jest
zdeduplikowana i odzwierciedla realne intencje, a nie szum testowy.

### Kolejne plany (proponowane, w kolejności)

1. **Kontrolowany pilot wykonania na mock Plesk** — włączyć `AUTONOMY_MUTATIONS_ENABLED`
   *tylko* dla `PLESK_MODE=mock`, wykonać realny `plesk.site.sync` przeciw mockowi
   z podpisanym apply grantem; udowadnia pełne `plan → execute` bez ruszania
   prawdziwej infrastruktury.
2. **Realny outbound e-mail do skrzynki** — ustawić `SMTP_EXTERNAL_SERVERNAME`
   na nazwę z certyfikatu (`webmail.prototypowanie.pl`), wysłać jedno powiadomienie
   i **potwierdzić odbiór w realnej skrzynce** (dziś potwierdzamy tylko transakcję SMTP).
3. **Realny inbound IMAP** — secret intake credentiali `agent@prototypowanie.pl`
   do vaulta, jedno kontrolowane polecenie z prawdziwej domeny → ticket → odpowiedź.
4. **Publiczny ingress Foundera** — wdrożyć nakładkę `docker-compose.ingress.yml`
   z realną domeną, certyfikatem ACME i IdP/MFA (dziś Basic auth + internal CA).
5. **`init-secrets` na `main`** — scommitować połączoną wersję (moja logika +
   `urirun-node-token`) razem z pracą urirun, uzupełnić `.env.example`/`env-contract.json`.
6. **Obsłużyć 31 realnych ticketów Foundera** — zatwierdzić/wykonać polecenia
   publikacji i domknąć 3 zadania konfiguracji tożsamości poczty.

Fail-closed pozostaje domyślną postawą na każdym etapie; kroki 1–3 wymagają
świadomej decyzji o włączeniu mutacji i realnych credentiali.
