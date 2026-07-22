---
{
  "schema": "subactor.doc/v1",
  "id": "docs.architecture.unresolved-live-autonomy-blockers-2026-07-19",
  "version": 1,
  "status": "current",
  "updated": "2026-07-19"
}
---

# Blokery pełnej autonomii, których nie można zamknąć lokalnie

**Stan na:** 2026-07-19, Europe/Warsaw
**Zakres:** produkcyjna praca platformy Subactor: publikowanie stron, komunikacja
z ludźmi, telefon, e-mail, kontrakty, outsourcing i działanie w wielu
jurysdykcjach.
**Charakter dokumentu:** rejestr brakujących uprawnień, danych, umów i decyzji
zewnętrznych. Dokument nie zawiera sekretów i nie jest opinią prawną.

## 1. Co oznacza „nie można rozwiązać teraz”

Problem należy do tej listy, jeżeli kod może przygotować plan, wykonać dry-run,
pilnować SLA lub utworzyć eskalację, ale nie może legalnie albo technicznie
stworzyć brakującego faktu. Takimi faktami są między innymi:

- uprawnienie nadane przez właściciela konta lub infrastruktury;
- sekret API, którego platforma nigdy nie otrzymała;
- podpisana umowa, pełnomocnictwo lub mandat osoby;
- decyzja właściciela DNS albo subskrypcji hostingowej;
- numer telefonu, skrzynka pocztowa lub konto dostawcy;
- interpretacja prawa zatwierdzona dla konkretnej jurysdykcji;
- zgoda człowieka, gdy wymaga jej prawo albo wcześniej przyjęta polityka.

Subactor nie może rozwiązać takich braków przez rozszerzenie własnego AQL,
wygenerowanie pozornego sekretu, zaakceptowanie regulaminu w imieniu
nieumocowanej osoby ani uznanie testu mock za dowód działania produkcyjnego.

## 2. Podsumowanie blokad

| Priorytet | Blokada | Właściciel zewnętrznego działania | Wpływ |
| --- | --- | --- | --- |
| P0 | Endpoint Plesk skonfigurowany po HTTP, podczas gdy auth probe wymaga HTTPS | operator Plesk / infrastruktury | `auth/query/status` kończy się `plesk_https_required`; brak produkcyjnego scope proof |
| P0 | Nieznany limit domen subskrypcji Plesk | właściciel konta Plesk / hosting | brak bezpiecznego utworzenia nowej domeny |
| P0 | Brak docelowego DNS i certyfikatów TLS | właściciel stref DNS / operator Plesk | brak publicznego HTTPS i proxy dla chatu |
| P0 | Brak aktywacji produkcyjnych mandatów mutacji | constitutional authority | apply pozostaje prawidłowo zablokowane |
| P0 | Brak danych dostępowych realnego e-maila | administrator poczty | agent nie odbiera i nie wysyła realnej poczty |
| P0 | Brak kompletnej konfiguracji telefonii | właściciel konta telekomunikacyjnego | brak realnych rozmów telefonicznych |
| P0 | Brak zatwierdzonej matrycy prawnej jurysdykcji | prawnik i umocowany reprezentant organizacji | brak autonomicznego zatrudniania i podpisywania umów |
| P1 | Brak rzeczywistych mandatów grafu sukcesji | władze organizacji | nie można aktywować następców tylko na podstawie YAML |
| P1 | Brak aktywnych umów ramowych z dostawcami | procurement / prawnik / finance | connector nie może legalnie utworzyć work order |
| P1 | Brak kont i umocowania na marketplace | właściciele kont sprzedażowych | scenariusze sprzedaży pozostają symulacją |
| P1 | Brak produkcyjnej tożsamości i ingressu chatu | operator DNS/TLS/IdP | chat działa lokalnie, ale nie publicznie per-user |
| P1 | Brak kontrolowanego testu live end-to-end | właściciele powyższych zasobów | zielony TestQL nie dowodzi gotowości produkcyjnej |
| P1 | Child grant jest sprawdzany przez oficjalny executor, ale jeszcze nie natywnie przez każdy connector/urirun command boundary | właściciel urirun policy i connectorów | klient posiadający zbyt szeroki token node mógłby ominąć executor; produkcyjne auth commands pozostają wyłączone |

## 3. Nieznany limit domen subskrypcji Plesk

### Blokada transportu auth probe

Po wdrożeniu auth conformance żywy runtime urirun poprawnie odkrywa i wykonuje
`plesk://host/auth/query/acquisition-methods`. Odczytowe
`plesk://host/auth/query/status` dociera do connectora, ale zwraca
`plesk_https_required`, ponieważ bieżący endpoint Plesk jest skonfigurowany po
HTTP. Jest to poprawna odmowa fail-closed. Operator musi udostępnić zaufany
endpoint HTTPS z prawidłową walidacją certyfikatu; wyłączenie kontroli TLS nie
jest akceptowalną naprawą. Dopiero wtedy można wykonać scope probe i dołączyć
jego wynik do evidence.

### Dowód

Ostatni bezpieczny probe subskrypcji zwrócił:

```json
{
  "authenticated": true,
  "permission": true,
  "domains_used": 0,
  "domains_limit": null,
  "limit_known": false,
  "can_create_domain": false,
  "reason": "subscription_domain_limit_unknown"
}
```

SFTP i FTP są dostępne, ale dostęp do transportu nie jest dowodem prawa ani
limitu utworzenia domeny. Dry-run `projekty/02_landing` dla
`autonomicznosc.pl` przeszedł: 8 plików, 32 934 bajty, plan hash
`8cec51cdbf70dcaa0c795f1b1f4e826bcdd7b62d60472435c795d3c47c794c23`.
Nie wykonano produkcyjnego apply.

### Dlaczego Subactor nie może zamknąć problemu sam

Platforma nie może przyjąć, że `null` oznacza brak limitu. Nie może również
zmienić planu hostingowego, kupić rozszerzenia ani zaakceptować nowej umowy z
hostingiem bez istniejącego mandatu i budżetu. Próba utworzenia domeny „dla
sprawdzenia” byłaby mutacją produkcyjną i mogłaby wywołać koszt lub konflikt z
istniejącą konfiguracją.

### Wymagane działanie zewnętrzne

Właściciel subskrypcji albo operator hostingu musi dostarczyć autorytatywny
odczyt liczbowego limitu i potwierdzić, czy konto może tworzyć domeny dodatkowe.
Jeżeli API tego nie udostępnia, wymagany jest eksport z panelu albo odpowiedź
dostawcy przypisana do audytowalnego ticketu.

### Warunek zamknięcia

- `domains_limit` jest znaną liczbą albo istnieje jawny status „unlimited”;
- connector potwierdza wolny slot i wymagane uprawnienie;
- testowa domena może zostać utworzona i usunięta w uzgodnionym sandboxie;
- wynik jest zapisany jako evidence bundle bez sekretów.

### Bezpieczna kontynuacja

System może nadal generować treść, walidować źródło, wyliczać manifest i
wykonywać dry-run. Nie może obiecywać publicznej publikacji nowej domeny.

## 4. DNS, TLS i publiczny routing

### Dowód

Lokalny portal i agent chatu działają, lecz `chat.subactor.com` nie ma
potwierdzonego docelowego DNS/TLS prowadzącego do właściwego ingressu. Rejestr
TODO wymienia również korektę DNS/TLS dla `identity.subactor.com`. Historyczne
testy `docs.subactor.com` wykazały rozdział między treścią na Plesku a domeną
obsługiwaną przez GitHub Pages. Każda domena musi więc być zweryfikowana osobno;
sam upload plików nie dowodzi publikacji.

### Dlaczego Subactor nie może zamknąć problemu sam

Zmiana DNS wpływa na ruch publiczny, pocztę, certyfikaty i możliwość wycofania
zmiany. Platforma nie może odgadnąć, który operator jest source of truth, ani
przejąć strefy bez credentiali i umocowania. Certyfikatu dla publicznej nazwy
nie można wiarygodnie uzyskać przed poprawnym routingiem i spełnieniem challenge
dostawcy.

### Wymagane działanie zewnętrzne

- wskazanie właściciela strefy i kanonicznego operatora DNS;
  - udostępnienie ograniczonego connectorowi mandatu do konkretnych rekordów;
  - decyzja, które domeny pozostają na GitHub Pages, a które przechodzą na Plesk;
  - określenie publicznego ingressu dla chatu i callbacków webhook;
  - zatwierdzenie okna cutover oraz rollbacku.

### Warunek zamknięcia

Dla każdej domeny jednocześnie muszą przechodzić:

1. zgodny rekord A/AAAA/CNAME;
2. certyfikat zawierający hostname w SAN;
3. HTTP 200 po ścisłej weryfikacji TLS;
4. oczekiwany fingerprint treści;
5. test rollbacku do ostatniej dobrej wersji.

### Bezpieczna kontynuacja

Można przygotowywać desired state DNS, plan cutover, cert request i testy
`--resolve`. Bez mandatu connector nie powinien zmieniać publicznych rekordów.

## 5. Produkcyjny apply i prawne umocowanie

### Dowód

Próba produkcyjna `apply: true` bez aktywnych bramek została prawidłowo
odrzucona:

```json
{
  "ok": false,
  "error": "autonomy_mutations_disabled",
  "dry_run": true
}
```

### Dlaczego Subactor nie może zamknąć problemu sam

Kill switch, podpisany apply grant, AQL, limit kosztu i kontrakt aktora są
niezależnymi zabezpieczeniami. System nie może sam nadać sobie szerszego AQL,
podpisać grantu jako constitutional authority ani uznać braku odpowiedzi
Foundera za automatyczną zgodę. Byłoby to obejście modelu odpowiedzialności, a
nie autonomia.

### Wymagane działanie zewnętrzne

Umocowany reprezentant musi wcześniej zatwierdzić politykę mutacji, role,
limity, budżety i graf sukcesji. Aktywacja powinna nastąpić przez podpisany,
czasowy grant związany z konkretnym `plan_hash`, nie przez edycję flagi podczas
awarii.

### Warunek zamknięcia

- istnieje aktywny kontrakt AQL dla aktora wykonawczego;
- grant jest podpisany, ograniczony czasowo i związany z planem oraz celem;
- kill switch i budżet pozwalają na operację;
- preflight, apply, verify i rollback mają kompletne evidence;
- ponowne użycie grantu jest odrzucane.

### Bezpieczna kontynuacja

Dry-run, przygotowanie dowodów i wyszukiwanie alternatyw mogą działać bez
mutacji. Brak grantu nie może zatrzymywać niezależnych procesów firmy.

## 6. Realna poczta e-mail

### Dowód

Usługa `inbound-email-agent` jest zdrowa jako proces, ale jej stan funkcjonalny
to `waiting_credentials`; worker nie pracuje, a ostatni błąd wskazuje brak
lease dla nazwy użytkownika IMAP. Testy autoryzacji, idempotencji, kwarantanny i
sejfowego vaultu przechodzą, lecz używają kontrolowanego środowiska testowego.

### Dlaczego Subactor nie może zamknąć problemu sam

Platforma nie może wygenerować hasła do istniejącej skrzynki, utworzyć konta u
dostawcy bez uprawnienia ani wysłać sobie sekretu e-mailem. Nie może też uznać
samego pola `From` za dowód tożsamości nadawcy.

### Wymagane działanie zewnętrzne

- utworzenie dedykowanej skrzynki lub konta API;
- przekazanie IMAP/SMTP albo OAuth przez jednorazowy intake do vaultu;
- konfiguracja SPF, DKIM i DMARC;
- potwierdzenie dozwolonych nadawców, odbiorców i polityki retencji;
- ustalenie limitów wysyłki i procedury rotacji credentiali.

### Warunek zamknięcia

Agent odbiera podpisaną/autoryzowaną wiadomość z realnej domeny, tworzy dokładnie
jeden ticket, odpowiada przez dozwolony kanał, poprawnie odrzuca spoofing i po
rotacji nadal działa bez zapisu sekretu w logach.

### Bezpieczna kontynuacja

Można używać Mailpit i scenariuszy E2E. Nie należy przedstawiać ich jako
realnego kanału komunikacji z Founderem.

## 7. Telefon i rozmowy głosowe

### Dowód

Doctor connectora głosowego zwraca obecnie:

```json
{
  "credentials": false,
  "from_number": false,
  "allowed_destinations": 0,
  "mutations": false,
  "webhook_signature_required": true,
  "live_ready": false
}
```

Connector i jego testy fail-closed działają, ale nie istnieje kompletna
konfiguracja produkcyjna.

### Dlaczego Subactor nie może zamknąć problemu sam

Numer, konto rozliczeniowe i zweryfikowane destination należą do dostawcy i
organizacji. System nie może zaakceptować regulaminu telekomunikacyjnego,
ustalić zasad nagrywania rozmów ani wyprowadzić zgody rozmówcy z samego faktu
posiadania numeru. Wymagania zależą od jurysdykcji, celu połączenia i tego, czy
rozmowa jest nagrywana lub transkrybowana.

### Wymagane działanie zewnętrzne

- aktywne konto dostawcy i numer źródłowy;
- sekret API umieszczony w vault;
- jawna allowlista numerów i limity kosztu;
- publiczny HTTPS webhook z walidacją podpisu;
- zatwierdzony komunikat identyfikacyjny, zasady zgody, retencji i nagrywania;
- opinia prawna dla używanych jurysdykcji.

### Warunek zamknięcia

Kontrolowane połączenie testowe dochodzi do dozwolonego numeru, callback ma
poprawny podpis, retry nie powoduje duplikatu, koszt mieści się w limicie, a
retencja nagrania/transkrypcji jest zgodna z zatwierdzoną polityką.

### Bezpieczna kontynuacja

Można testować payloady i walidację webhooków lokalnie. Połączenia wychodzące
pozostają wyłączone.

## 8. Publiczny chat per-user

### Dowód

Lokalny `autonomy-chat-agent` działa w trybie `normal`. Test digital twin
potwierdził, że 8 zarejestrowanych aktorów może czytać wyłącznie własną,
read-only projekcję; dostęp cross-subject jest blokowany. Nie ma jednak
potwierdzonego publicznego ingressu `chat.subactor.com` z docelowym DNS/TLS i
produkcyjnym źródłem tożsamości użytkowników.

### Dlaczego Subactor nie może zamknąć problemu sam

Lokalny reverse proxy nie daje automatycznie publicznego, trwałego endpointu.
Platforma nie może tworzyć kont ludzi ani wiązać ich z kontraktami bez
potwierdzenia tożsamości i podstawy organizacyjnej. Nie powinna również wystawiać
lokalnego tokenu administracyjnego do Internetu.

### Wymagane działanie zewnętrzne

- DNS/TLS i publiczny ingress z kontrolowanym tunelem albo wdrożeniem;
- produkcyjny IdP lub zatwierdzony mechanizm logowania;
- procedura zapraszania, zawieszania i usuwania użytkowników;
- mapowanie principal → kontrakt AQL → digital twin;
- polityka sesji, MFA, rate limitu i odzyskania konta.

### Warunek zamknięcia

Dwóch różnych użytkowników loguje się publicznie przez HTTPS, każdy widzi tylko
własny twin i własne rozmowy, próba cross-user kończy się odmową, wylogowanie i
unieważnienie sesji działają, a logi nie zawierają tokenów.

### Bezpieczna kontynuacja

Portal może pozostać dostępny wyłącznie na loopbackie. Można rozwijać UI i
testować izolację bez publikowania panelu administracyjnego.

## 9. Prawo pracy, staże, rekrutacja i umowy w wielu jurysdykcjach

### Problem

Scenariusz bezpłatnego stażu edukacyjnego, rozmowy rekrutacyjnej, przydzielania
ticketów, przetwarzania CV i podpisu elektronicznego nie ma jednej uniwersalnej
kwalifikacji prawnej. Znaczenie mają co najmniej: kraj organizacji, kraj i wiek
kandydata, faktyczny zakres pracy, podporządkowanie, korzyść ekonomiczna,
wynagrodzenie, czas pracy, ubezpieczenie, podatki, dane osobowe i rodzaj podpisu.

### Dlaczego Subactor nie może zamknąć problemu sam

DSL może egzekwować zatwierdzone reguły, ale nie może sam stworzyć legalnej
podstawy bezpłatnej pracy ani przesądzić, że nazwanie relacji „edukacją” zmienia
jej rzeczywisty charakter. Nie może zastąpić prawnika, urzędu, opiekuna osoby
małoletniej ani umocowanego podpisującego. Nie może również stosować szablonu z
jednego kraju do wszystkich kandydatów.

### Wymagane działanie zewnętrzne

Dla każdej obsługiwanej jurysdykcji prawnik powinien zatwierdzić wersjonowany
pakiet zawierający:

- dozwolone typy relacji i kryteria kwalifikacji;
- minimalny wiek i wymagane zgody;
- obowiązkowe wynagrodzenie, świadczenia, ubezpieczenie i limity czasu;
- obowiązki informacyjne i retencję danych kandydatów;
- dopuszczalne pytania rekrutacyjne i zakazane kryteria;
- wymagany rodzaj podpisu i dowodu doręczenia;
- reguły zakończenia relacji oraz wydania dokumentów;
- organ lub osobę uprawnioną do podpisu po stronie organizacji.

Każdy pakiet musi wskazywać źródło, datę weryfikacji, prawnika/owner i termin
ponownego przeglądu. Brak dopasowanego, aktywnego pakietu powinien blokować tylko
daną czynność prawną, nie pozostałe procesy firmy.

### Warunek zamknięcia

- kandydat jest przypisany do jednoznacznej jurysdykcji i statusu;
- aktywny jurisdiction pack pasuje do relacji i wersji umowy;
- umowa pochodzi z zatwierdzonego szablonu i nie ma pustych pól prawnych;
- podpisujący ma ważny mandat;
- e-sign provider zwraca evidence doręczenia, tożsamości i integralności;
- onboarding nie uruchamia pracy przed spełnieniem wszystkich warunków.

### Bezpieczna kontynuacja

System może prowadzić symulacje na fikcyjnych danych, generować drafty oznaczone
`NOT FOR SIGNATURE`, tworzyć checklisty oraz przydzielać wyłącznie szkoleniowe
tickety w sandboxie. Nie powinien publikować realnej oferty „stażu za darmo” ani
wysyłać realnej umowy przed zatwierdzeniem właściwego pakietu prawnego.

## 10. Graf sukcesji i zastępstwo ludzi

### Problem

Architektura przewiduje `organization:constitutional-authority`, następców,
quorum i operatorów zewnętrznych. Sam wpis w `authority-succession.yaml` nie
tworzy jednak pełnomocnictwa, stosunku umownego ani dostępu do konta.

### Dlaczego Subactor nie może zamknąć problemu sam

System nie może wymyślić danych następców, nadać im praw ani uznać ich zgody bez
ważnej czynności organizacyjnej. Nie może też aktywować większych praw wyłącznie
na podstawie jednego braku odpowiedzi Foundera.

### Wymagane działanie zewnętrzne

- wyznaczenie konkretnych osób i zastępców;
- podpisanie mandatów, pełnomocnictw albo umów odpowiednich dla organizacji;
- konfiguracja quorum i niezależnych kanałów potwierdzenia niedostępności;
- nadanie odrębnych tożsamości i minimalnego dostępu;
- ćwiczenie ciągłości z kontrolowanym odwołaniem uprawnień.

### Warunek zamknięcia

Test ciągłości potwierdza sekwencję founder → deputy → quorum → operator
zewnętrzny, bez rozszerzenia scope roli, bez współdzielonych credentiali i z
pełnym audytem aktywacji oraz cofnięcia.

## 11. Outsourcing, e-sign i marketplace

### Problem

Istnienie connectora, URI Process albo repozytorium publicznego nie oznacza, że
organizacja posiada aktywne konto, zaakceptowane warunki, prawo sprzedaży,
umowę ramową, metodę płatności lub limit wydatków. Audyt wykrywa obecnie 76
repozytoriów connectorów: 41 kompatybilnych, 34 częściowe i 1 bez wykrywalnego
manifestu/kontraktu/bindingu (`urirun-connector-scanner`).

### Dlaczego Subactor nie może zamknąć problemu sam

Platforma nie może zawrzeć pierwszej umowy ramowej bez mandatu, dopisać firmy do
marketplace bez weryfikacji właściciela ani uznać testowego webhooka za dowód
produkcyjnego podpisu. Nie może też sam ustalić zobowiązań podatkowych i
konsumenckich dla sprzedawanych produktów w każdym kraju.

### Wymagane działanie zewnętrzne

- aktywne konta organizacji u wybranych dostawców;
- zweryfikowana tożsamość/KYB oraz role administratorów;
- podpisane MSA/DPA i katalog usług albo zatwierdzone warunki marketplace;
- budżety, stawki, waluta, podatki, refundacje i odpowiedzialność;
- sekrety API przekazane do vaultu;
- sandbox i produkcyjny webhook dla e-sign/płatności;
- co najmniej dwóch zakontraktowanych dostawców dla funkcji krytycznych.

### Warunek zamknięcia

Kontrolowany proces quote → work order → identity → minimal access → evidence →
accept/reject → invoice przechodzi u rzeczywistego dostawcy, a zastąpienie
primary przez secondary działa w granicach SLA i budżetu.

## 12. Brak pełnego dowodu live end-to-end

### Dowód

Pełny TestQL, API E2E, portale ról, digital twin, URI Process, Core, Runtime,
kontrakty i testy niezawodności przechodzą. TestQL Plesk korzysta jednak również
z mocków oraz bezpiecznych bramek. Zielony wynik potwierdza logikę i odmowę
nieautoryzowanych mutacji, lecz nie potwierdza publicznego DNS, realnej poczty,
realnego telefonu, podpisania umowy ani sprzedaży na marketplace.

### Dlaczego Subactor nie może zamknąć problemu sam

Test produkcyjny wymaga zasobów i mandatów opisanych w sekcjach 3–11. Ominięcie
ich tylko po to, by test był zielony, zniszczyłoby znaczenie testu autonomii.

### Wymagany scenariusz akceptacyjny

Po dostarczeniu zewnętrznych zależności należy przeprowadzić kontrolowany
scenariusz:

```text
cel Foundera
→ plan i dry-run
→ preflight capability/authority/budget/jurisdiction
→ utworzenie domeny testowej
→ publikacja i publiczny verify HTTPS
→ kontakt e-mail i chat z dwoma odrębnymi użytkownikami
→ testowe połączenie głosowe do allowlisty
→ draft umowy z zatwierdzonego jurisdiction pack
→ podpis w sandboxie e-sign
→ przydział sandboxowego ticketu
→ evidence bundle
→ rollback i zamknięcie dostępów
```

Sukces wymaga dowodu każdego kroku, a nie tylko statusu procesu.

## 13. Problemy techniczne, które nie są blokadami zewnętrznymi

Poniższe problemy są otwarte, ale można je rozwiązać zmianą kodu albo
metadanych. Nie należy używać ich jako uzasadnienia oczekiwania na Foundera:

| Problem | Stan | Następne działanie techniczne |
| --- | --- | --- |
| Nieaktualny pin Core w teście meta | `test:meta` oczekuje `36130b5`, platforma wskazuje `a9ac816`; Core przechodzi 158/158 | zaktualizować oczekiwany pin, uruchomić pełne `npm test`, dopiero potem push |
| Dry-run klasyfikuje niewykonywany apply jako wymagający człowieka | powstają eskalacje `PLF-506` / `SELFDEV-074` | w dry-run mapować apply na `skipped_dry_run`; zachować authority gate dla realnego apply |
| Niespójny dowód odmowy Plesk | bezpośredni connector zwraca `files_uploaded: null`, bridge oczekuje `0` | ujednolicić schemat odpowiedzi odmowy i dodać test kontraktowy Python ↔ JS |
| Niepełne metadane connectorów | 34 partial, 1 not-detected | dodać manifesty, contracts, bindings i declared routes; nie zmienia to samo w sobie uprawnień live |
| Historyczny incydent obserwowalności | 1 critical w historii, 0 otwartych incydentów | zachować historię, zweryfikować klasyfikację i regułę zamknięcia |

Te zadania powinny zostać wykonane przed bramką release, ale nie wymagają
sekretów, zawarcia umowy ani decyzji prawnej.

## 14. Minimalny pakiet danych potrzebny od organizacji

Aby przejść z bezpiecznego dry-run do kontrolowanego live, organizacja powinna
dostarczyć przez bezpieczne kanały:

1. potwierdzenie limitu i praw subskrypcji Plesk;
2. listę domen, właścicieli DNS, oczekiwanych originów i politykę rollbacku;
3. produkcyjne konta e-mail, telefon, e-sign i marketplace;
4. sekrety przekazane wyłącznie przez jednorazowy intake do vaultu;
5. listę principalów, następców, quorum i podpisane mandaty;
6. zatwierdzone jurisdiction packs oraz wersje szablonów umów;
7. budżety zdarzeń, limity miesięczne i emergency reserve;
8. umowy ramowe primary/secondary dla krytycznych usług;
9. zgodę na konkretny, ograniczony scenariusz testu live;
10. właściciela akceptacji evidence i procedury cofnięcia dostępu.

## 15. Reguła operacyjna do czasu zamknięcia blokad

```text
brak zewnętrznego faktu
→ nie twórz go pozornie
→ zapisz typowany blocker i wymagany capability/authority
→ kontynuuj dry-run, przygotowanie, ochronę usług i niezależne zadania
→ pilnuj SLA oraz szukaj wcześniej umocowanego zastępcy
→ wykonaj mutację dopiero po uzyskaniu ważnego dowodu i mandatu
```

Brak jednej zależności nie powinien zatrzymywać całej platformy. Powinien
zatrzymać wyłącznie operację, której bez tej zależności nie da się wykonać
legalnie, bezpiecznie i weryfikowalnie.

## 16. Powiązane dokumenty

- [`../plans/full-platform-remediation-plan-2026-07-19.md`](../plans/full-platform-remediation-plan-2026-07-19.md)
- [`plesk-publish-status-report-2026-07-19.md`](plesk-publish-status-report-2026-07-19.md)
- [`autonomy-ops-status-and-open-questions.md`](autonomy-ops-status-and-open-questions.md)
- [`../plans/resolution-continuity-implementation.md`](../plans/resolution-continuity-implementation.md)
- [`../plans/autonomy-implementation-roadmap.md`](../plans/autonomy-implementation-roadmap.md)
- [`../deployment/PLESK.md`](../deployment/PLESK.md)
- [`adr/002-dns-ssot.md`](adr/002-dns-ssot.md)
- [`adr/003-approval-hitl-model.md`](adr/003-approval-hitl-model.md)
- [`adr/006-secrets-ownership.md`](adr/006-secrets-ownership.md)
