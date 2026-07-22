---
{
  "schema": "subactor.doc/v1",
  "id": "docs.architecture.unified-operational-runtime-aql-oql-uri-eql-2026-07-21",
  "version": 1,
  "status": "current",
  "updated": "2026-07-21"
}
---

# Jeden runtime operacyjny Subactor — AQL → OQL → URI → EQL

Data audytu: 2026-07-21

## Werdykt

Subactor powinien utrzymywać **jeden operacyjny punkt wykonywania efektów**:
`urirun-node` z connectorami `urirun-connector-*`. Control, portal, agenci, boty
i użytkownicy nie powinni wykonywać zmian bezpośrednio przez SDK, `fetch`, SSH,
CLI ani GUI. Powinni tworzyć ten sam typ żądania procesu, a warstwa wykonawcza
powinna zawsze realizować je jako konkretne URI.

Nie oznacza to przeniesienia całej logiki AQL, planowania OQL i oceny EQL do
procesu noda. Najprostszy logicznie podział to:

- **Control/Planfile** — tożsamość, decyzja AQL, kanoniczny plan OQL, approval i
  trwały ticket utworzony przed efektem;
- **Subactor runtime/Bridge** — jedna bramka wykonawcza: weryfikacja dowodu,
  idempotency claim, najmniejsza projekcja uprawnienia i ocena wyniku EQL;
- **urirun-node** — jedyny runtime efektów: routing dokładnego URI, izolacja,
  timeout, transport, registry etag i provenance;
- **connector** — implementacja jednej capability; pobiera sekret przez
  referencję dopiero na granicy wykonania i nie podejmuje decyzji biznesowych.

Takie rozdzielenie zmniejsza liczbę zabezpieczeń rozrzuconych po usługach, ale
nie usuwa pięciu niezbędnych inwariantów. Zamiast powtarzać je w każdym bocie i
connectorze, egzekwujemy je raz w kanonicznym pipeline.

## Stan zastany

Live `urirun-node` działa w trybie `execute`, wersja `0.4.200`, udostępnia 555
tras, wymaga auth dla `/run` i nie pozwala zdalnie rozwiązywać sekretów. Globalna
polityka noda ma jednak `allow=["**"]`; bezpieczeństwo wieloaktorskie musi więc
pozostać w jedynym gatewayu, a token noda nie może trafić do portali, agentów ani
użytkowników.

Obecna ścieżka produkcyjna ma już dobre elementy:

1. Process Pack zawiera osobne NL, AQL, EQL, OQL i receptę URI.
2. Planfile przechowuje `subactor.process-envelope.v2` przed wykonaniem.
3. Bridge sprawdza ticket, kolejność czasową, OQL/URI i idempotency.
4. `TaskRuntime` wywołuje uwierzytelnione `POST /run` w `urirun-node`.
5. Bridge ocenia `EXPECT` i zapisuje wynik/evidence z powrotem do ticketu.

Rozproszenie nadal występuje w kilku miejscach:

| Obszar | Stan | Skutek |
|---|---|---|
| Bridge `EXECUTE_HANDLERS` | część e-mail/Plesk/Slack/Teams/Calendar/Org działa bezpośrednio | istnieją dwa wykonawcze tory: adapter i URI runtime |
| `TaskRuntime` | HTTP node plus legacy CLI i `lab-audit` fallback | fallback może wyglądać jak sukces, choć efektu nie było |
| URI allowlist | bywała dostarczana przez callera lub zastępowana szerokim fallbackiem Plesk | dodatkowa polityka mogła różnić się od ticketu/AQL |
| Auth noda | jeden sekret gatewayu, brak tożsamości aktora w nodzie | bez gatewayu node nie rozróżnia Foundera, usera i bota |
| EQL | część `EXPECT` jest sprawdzana przez Bridge, część jako TestQL/postflight | nie ma jeszcze jednego formatu receipt dla każdego runu |
| Sekrety | część connectorów korzysta z vault refs, część usług ma legacy env | więcej miejsc materializacji credentiali |

## Kanoniczny przepływ wielowarstwowy

```text
NL / API / bot / user
        │  dane nieufne, bez prawa wykonania
        ▼
Process Pack + schema
        │
        ▼
AQL: kto, co, gdzie, koszt, limit, ważność, delegacja
        │  wynik = allow / deny / needs-human
        ▼
OQL: kanoniczny AST + zależności + EXPECT + plan_hash
        │
        ▼
Planfile: ticket v2 utworzony przed efektem + approval/grant
        │
        ▼
Runtime authorization projection
        │  ticket ∩ kontrakt aktora ∩ approval
        │  wynik = dokładnie jedno konkretne URI
        ▼
Bridge execution gateway
        │  idempotency lease + correlation run-id
        ▼
urirun-node /run
        │  node auth + route registry + isolation + timeout
        ▼
urirun-connector-*
        │  secretRef → zewnętrzna capability
        ▼
provenance + result
        │
        ▼
EQL/TestQL: expected kontra actual
        │
        ▼
completion receipt + audit + Planfile status
```

### AQL — authority, nie wykonanie

AQL powinno odpowiadać wyłącznie na pytania o autoryzację i wybór zatwierdzonego
procesu. Kontrakt aktora określa modele, operacje OQL, URI Process, limity,
koszt, wymagane dowody, ważność i możliwość delegacji. LLM może zaproponować
typowaną intencję, ale nie tworzy dowolnego URI i nie dostaje tokenu noda.

### OQL — jedyny plan operacji

OQL jest kanonicznym, hashowanym planem. Każdy krok mutujący musi wskazywać
receptę URI oraz oczekiwany wynik. Zmiana payloadu, kolejności, URI albo targetu
po approval unieważnia `plan_hash` i grant. OQL nie powinno zawierać sekretów —
wyłącznie identyfikatory profili i `secretRef`.

### URI — jedyny sposób wykonania efektu

Gateway przekazuje do runtime projekcję
`subactor.process-runtime-authorization.v1`. Powstaje ona z już zweryfikowanego
ticketu i opcjonalnego kontraktu/delegacji aktora. Delegacja może tylko zawęzić
powierzchnię ticketu. Do noda trafia najmniejsze uprawnienie: jedno konkretne
URI, nie wildcard dostarczony przez callera.

Node wykonuje routing i techniczną izolację. Mutacje powinny mieć ścieżkę
`/command/` i `isolated=true`; zapytania `/query/` mogą pozostać in-process,
jeżeli connector nie materializuje sekretu i nie ma efektu ubocznego.

### EQL — warunek uznania wyniku, nie ozdoba

Sukces HTTP lub exit code nie kończy procesu. Gateway porównuje wynik z `EXPECT`
i definicją EQL, zapisuje actual/expected/verifier/evidence, a dopiero potem
tworzy completion receipt. Nieudane EQL oznacza failed/needs-review nawet wtedy,
gdy connector zwrócił `ok=true`.

## Minimalny zestaw zabezpieczeń po konsolidacji

Pozostają tylko zabezpieczenia o różnych odpowiedzialnościach:

1. **Identity + AQL** — czy aktor ma prawo zlecić capability.
2. **Ticket/plan/grant** — czy dokładny plan istniał i został zatwierdzony przed
   efektem; grant jest związany z hashem i jednorazowy.
3. **Runtime projection** — przecięcie ticketu i kontraktu daje jedno konkretne
   URI; caller nie wysyła własnej allowlisty.
4. **Node/connector boundary** — prywatny token noda, allow policy, izolacja,
   timeout, ograniczony filesystem/network i sekret przez referencję.
5. **EQL receipt** — efekt jest zaakceptowany tylko z dowodem expected=actual.

Można następnie usunąć duplikaty: ręczne allowlisty w botach, osobne bezpośrednie
SDK w Bridge, biznesowe RBAC w connectorach, plaintext env w wielu usługach oraz
lokalne retry/idempotency implementowane dla każdego adaptera osobno. Nie usuwa
się natomiast uwierzytelnienia zewnętrznego API, walidacji wejścia connectora ani
izolacji mutacji — są to inne granice.

## Model wielu organizacji, userów i botów

Node powinien ufać wyłącznie execution gatewayowi, nie każdemu końcowemu
aktorowi. Gateway zapisuje i egzekwuje:

- `organization_id` / tenant;
- principal `{kind,id}`: human, bot, provider, organization lub quorum;
- fingerprint kontraktu AQL i identyfikator delegacji;
- `ticket_id`, `plan_id`, `decision_id`, `step_id`, `plan_hash`;
- konkretne URI i hash payloadu;
- idempotency key, budżet, deadline i correlation/run id;
- wymagany poziom approval i EQL receipt.

Connector nie musi znać całej hierarchii organizacyjnej. Otrzymuje zatwierdzony,
minimalny payload i profil credentiali przypisany do tenant/capability. Wspólny
node może obsługiwać wielu aktorów tylko wtedy, gdy nie da się ominąć gatewayu;
token `/run` pozostaje dostępny wyłącznie Bridge, a zdalne nody korzystają z
osobnego LAN gatewayu/key-auth i zawężonej polityki środowiska.

## Plan migracji

### P0 — jedna projekcja uprawnień (wdrożone w tej sesji)

- runtime wylicza projekcję z ticketu v2 i delegacji AQL;
- delegacja nie może poszerzyć URI zadeklarowanego w tickecie;
- Bridge przestał ufać `allowed_uri_processes` z requestu i usunął szerokie
  fallbacki Plesk dla ścieżek URI;
- node run otrzymuje correlation id powiązane z rekordem idempotency;
- odpowiedź runtime zawiera bezsekretną projekcję autoryzacji.

### P1 — wszystkie efekty przez URI

Przenieść w tej kolejności bezpośrednie handlery Bridge:

1. `email.send`, Slack, Teams, webhook i Calendar — małe, dobrze odseparowane
   connectory z jasnym rezultatem;
2. Organization Core i Planfile commands — wewnętrzne connectory z tokenem
   service-to-service przez secretRef;
3. Site Generator i TestQL — deterministyczne query/build/postflight;
4. pozostałe Plesk mail/domain/certificate/extensions — mutacje dopiero po
   `plan_hash` + grant; istniejące query można migrować wcześniej;
5. browser/KVM/LinkedIn — osobny node Lenovo, jawna sesja/lease i dowód wizualny.

Po każdym przeniesieniu stary handler pozostaje chwilowo tylko jako shadow
comparison. Nie może stanowić automatycznego fallbacku dla mutacji.

### P2 — Bridge jako cienki execution gateway

Bridge ma zachować wyłącznie: ticket proof, AQL projection, approval/grant,
idempotency, wywołanie noda, EQL i evidence. `EXECUTE_HANDLERS` domenowe znikają.

### P3 — wyłączenie alternatywnych runtime'ów w produkcji

- CLI `urirun run` tylko dla development/diagnostyki;
- `lab-audit` nigdy nie raportuje sukcesu operacji mutującej;
- brak bezpośrednich wywołań z agentów do zewnętrznych systemów;
- każdy produkcyjny efekt bez `runId`, provenance i ticketu jest błędem audytu.

### P4 — receipt i obserwowalność

Jeden trace przechodzi przez ticket → OQL → Bridge execution → node run →
connector → EQL. UI „Uruchomienia URI” pokazuje plan, principal, node, exact URI,
czas, wynik, dowód i retry/DLQ bez ujawniania sekretów.

## Kryteria ukończenia konsolidacji

- 100% mutujących OQL kończy się wywołaniem `urirun-node /run`;
- 0 caller-controlled URI allowlists;
- 0 produkcyjnych sukcesów `lab-audit` dla mutacji;
- 0 sekretów w OQL, ticketach, payload logs i odpowiedziach;
- każdy run ma ticket v2, actor/tenant, exact URI, idempotency key i EQL receipt;
- connector coverage i live route catalog pokrywają wszystkie aktywne kontrakty
  AQL, bez kolizji właścicieli tras;
- wyłączenie lub utrata noda daje jawny `runtime_unavailable`, nigdy pozorny
  sukces alternatywnego adaptera.

## Walidacja P0

Po przebudowaniu lokalnych usług `hr-control` i `hr-bridge` wykonano proces
`plesk://host/doctor/query/report` przez publiczne wejście Control, bez pola
`allowed_uri_processes` w żądaniu. System utworzył ticket `PLF-657`, zweryfikował
process envelope v2, wyliczył
`subactor.process-runtime-authorization.v1` ograniczone dokładnie do tego URI i
wykonał proces w `urirun-node`. Node zwrócił run id
`exec_1784627771785_962288e95b7f`, a ticket otrzymał completion receipt oraz
evidence.

Regresję sprawdzono testami automatycznymi:

- runtime: 91/91;
- klient `urirun-process-client`: 6/6;
- Bridge/connectors: 29/29;
- Control/core: 265/265;
- capability preflight: 18/18;
- przekrojowy testkit platformy: 179/179.

P0 zamyka caller-controlled allowlist i szerokie fallbacki URI. Nie oznacza
jeszcze ukończenia całej konsolidacji: domenowe handlery Bridge czekają na P1,
a jednolity fingerprint kontraktu aktora i wykonywalny receipt EQL dla każdego
typu procesu pozostają zakresem P4.

Zdalną granicę runtime sprawdzono dodatkowo symulacją Connector LAN. Test
`PLF-667` przeszedł przez mTLS i Bridge do tego samego `urirun-node`, potwierdził
role klientów, filtrowanie tras, brak bezpośredniego dostępu klienta LAN do noda
oraz brak sekretnego markera w audycie. Topologia pozostawia node wyłącznie w
sieci `uri-executor`; tylko Bridge łączy ją z izolowaną siecią
`connector-execution`, a gateway wystawia na LAN zawężony kontrakt mTLS.

## Decyzja architektoniczna

Docelowy standard to **jeden runtime efektów, jeden gateway polityki, wiele
connectorów**. Nie należy budować jednego monolitycznego connectora ani przenosić
AQL/EQL do każdego handlera. Modularność pozostaje na poziomie capability, a
jednolitość na poziomie envelope, autoryzacji, wykonania i receipt.
