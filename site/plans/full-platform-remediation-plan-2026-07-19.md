---
{
  "schema": "subactor.doc/v1",
  "id": "docs.plans.full-platform-remediation-plan-2026-07-19",
  "version": 1,
  "status": "current",
  "updated": "2026-07-19"
}
---

# Szczegółowy plan naprawczy platformy Subactor

**Stan planu:** 2026-07-19, Europe/Warsaw
**Cel:** przejście z bezpiecznego `dry-run` do kontrolowanego działania
produkcyjnego bez obchodzenia uprawnień, prawa, budżetów ani zabezpieczeń.
**Dokument bazowy:**
[`Blokery pełnej autonomii, których nie można zamknąć lokalnie`](../architecture/unresolved-live-autonomy-blockers-2026-07-19.md).

## 1. Diagnoza

Autonomia działa częściowo i prawidłowo w trybie fail-closed. System potrafi
przygotować plan, wykonać testy, zebrać dowody i odmówić mutacji, gdy brakuje
mandatu, credentiali, umowy, konfiguracji albo podstawy prawnej. Naprawa nie
polega na wyłączeniu bramek, lecz na domknięciu ścieżki:

```text
cel → plan → dry-run → capability → authority → budżet i jurysdykcja
→ jednorazowy grant związany z plan_hash → apply → verify → evidence
→ rollback albo utrwalenie zmiany
```

Każdy brak zewnętrzny ma być typowanym blockerem z właścicielem, wymaganym
dowodem i terminem ważności. Kod nie może stworzyć brakującej zgody, umowy,
konta ani sekretu.

## 2. Pierwszy pion produkcyjny

Pierwszy płatny pilot obejmuje:

1. publikację treści na istniejącej domenie i vhoście;
2. grant ograniczony do konkretnego `plan_hash` i targetu;
3. publiczny HTTPS verify oraz fingerprint treści;
4. evidence wykonania i rzeczywisty test rollbacku;
5. monitoring oraz automatyczny incydent;
6. zatwierdzenie umocowanej osoby przed mutacją.

Poza pilotem pozostają: tworzenie domen przy nieznanym limicie, telefonia,
produkcyjne e-sign, rekrutacja, wydatki marketplace i zmiana DNS bez osobnego
mandatu. Oferta pilota brzmi: **kontrolowane publikowanie i autonomiczne
utrzymanie jednej strony**, nie „pełna autonomia organizacji”.

## 3. Stany gotowości integracji

```text
UNCONFIGURED
EXTERNAL_ACTION_REQUIRED
CONFIGURED
SANDBOX_VERIFIED
LIVE_CANARY
PRODUCTION_READY
SUSPENDED
REVOKED
```

```json
{
  "resource_id": "mail:inbound:operations",
  "state": "EXTERNAL_ACTION_REQUIRED",
  "capabilities": ["mail.receive", "mail.send"],
  "owner": "administrator-poczty",
  "blocker_code": "MAIL_CREDENTIALS_MISSING",
  "required_evidence": [
    "vault_lease_id",
    "provider_account_id",
    "live_canary_result"
  ],
  "last_verified_at": null,
  "valid_until": null,
  "evidence_bundle_id": null
}
```

`CONFIGURED` nie oznacza `PRODUCTION_READY`. Capability i evidence wygasają.
Brak ważnego dowodu oznacza fail-closed. Mock nie może ustawić `LIVE_CANARY`, a
stan jednego connectora nie rozszerza praw innego.

## 4. Rejestr pakietów prac

| ID | Pakiet | Fala | Pilot |
| --- | --- | --- | --- |
| REL-001 | Kanoniczny pin Core | A | wymagany |
| REL-002 | Dry-run bez fałszywej eskalacji | A | wymagany |
| REL-003 | Wspólny wynik connectora | A | wymagany |
| REL-004 | Manifesty connectorów | A | wymagany dla ścieżki pilota |
| REL-005 | Lifecycle incydentów | A | wymagany |
| AUTH-001 | Jednorazowy grant mutacji | A/B | wymagany |
| AUTH-002 | Rejestr blockerów i capability | A | wymagany |
| EVID-001 | Evidence bundle | A | wymagany |
| INF-001 | Typowany limit Plesk | B | niewymagany dla istniejącego vhosta |
| INF-002 | DNS desired state | B/C | wymagany tylko przy cutoverze |
| INF-003 | Bezpieczny publish na vhost | A/B | wymagany |
| MAIL-001 | E-mail live | C | później |
| CHAT-001 | Publiczny chat/IdP | C | później |
| VOICE-001 | Telefonia | D | później |
| LEGAL-001 | Jurisdiction packs | E | później |
| ESIGN-001 | E-sign | E | później |
| GOV-001 | Graf sukcesji | E | później |
| VENDOR-001 | Vendor/marketplace | E | później |

## 4.1. Stan realizacji — 2026-07-19

| ID | Stan | Dowód |
| --- | --- | --- |
| REL-001 | zakończony dla komponentów Platformy | `platform@46dd037`, `core@5631ce4`; source lock 8/8, czysty klon bez submodułów, Core 158/158, meta 43/43 |
| REL-002 | zakończony | `orchestrator@69e4aeb`; testy 79/79 oraz live dry-run bez ticketu eskalacyjnego |
| REL-003 | etap bazowy zakończony | odmowa publish Python ↔ JS: `contracts@cb270ab`, `connectors@4c990b3`, `urirun-connector-plesk@1f82dd2`, `platform@db6b09a`; pozostały partial/rollback i inne route'y |
| REL-004 | oczekuje | manifesty należy domknąć najpierw dla Plesk, DNS i verify |
| REL-005 | oczekuje | wymagane odtworzenie i dowód zamknięcia historycznego incydentu |

REL-001 wprowadził `platform/dependencies.lock.json` jako jedno źródło prawdy
dla ośmiu niezależnych repozytoriów źródłowych. Submoduły, `.gitmodules` i
gitlinki trybu `160000` zostały usunięte. `npm run dependencies:sync` tworzy w
ignorowanym `components/*` zwykłe checkouty Git, a verifier sprawdza URL
originu, dokładny commit, czystość drzewa i zgodność źródeł. Negatywne testy
odrzucają `.gitmodules`, gitlink, inny remote i lokalny drift. Nowy klon z
GitHub bez `--recurse-submodules` pobrał wszystkie źródła, odtworzył zależności
i przeszedł AQL preflight na 17 kontraktach. Naprawiono też ścieżkę preflight
tak, aby używała przypiętego `components/contracts`, a nie przypadkowego
sąsiedniego checkoutu.

Pełny `npm test` Platformy przeszedł w świeżym układzie umbrella po source
bootstrapie: meta 43/43, runtime 69/69, contracts 10/10, testkit 146/146, Core
158/158 i connector LAN 3/3. Repozytoria receptur `docs`, `logo` i `www`
pozostają jawnie niezależnymi sąsiadami umbrella; nie są zależnościami
komponentowymi Platformy. Ich bootstrap wymaga nadal manifestu nadrzędnego,
jeżeli pełny układ umbrella ma być odtwarzany jednym poleceniem.

REL-002 dodał wspólny enum wyników wykonania. Krok wymagający zatwierdzenia w
trybie dry-run zwraca teraz `SKIPPED_DRY_RUN`, nie uruchamia resolvera authority
i nie tworzy eskalacji. Ten sam krok w trybie mutacji bez mandatu nadal zwraca
`DENIED_AUTHORITY`. Bezpieczny test live planu publikacji
`autonomicznosc.pl` przygotował 8 plików i zachował plan hash
`8cec51cdbf70dcaa0c795f1b1f4e826bcdd7b62d60472435c795d3c47c794c23`;
produkcyjny apply nie został wykonany.

Bazowy etap REL-003 opublikował kanoniczny, domenowo neutralny JSON Schema
`subactor.connector-result.v1` wraz z fixture odmowy authority. Bridge JS i
connector Python zwracają te same pola wykonania, weryfikacji, dry-run, próby
mutacji, liczników plików i bajtów, `plan_hash`, evidence oraz retry. Dla
kompatybilności zachowano dotychczasowe pole `error`, ale nie jest ono już
jedynym nośnikiem semantyki. Odmowa przed mutacją zawsze raportuje zera i
`mutation_attempted: false`; `null` nie oznacza już „nie wykonano”. Testy:
kontrakty 12/12, bridge 4/4, connector Python 57/57, Platform meta 41/41 i
connector LAN 3/3.

Do pełnego zamknięcia REL-003 pozostaje objęcie tym envelope wyników
`capability_unavailable`, błędu częściowego i rollbacku oraz dodanie testów
kontraktowych dla pozostałych mutacyjnych route'ów. Aktualna zmiana celowo
rozwiązuje pierwotną rozbieżność odmowy publish Python ↔ JS bez deklarowania,
że wszystkie connectory zostały już zmigrowane.

## 4.2. Autonomous Access Acquisition Loop — pierwszy pion

Zaimplementowano domenowo neutralny pion `human daje ALLOW → system zdobywa
ACCESS → vault przechowuje SECRET → connector wykonuje ACTION → runtime tworzy
EVIDENCE`:

- `runtime@5614168` rozszerza Contract AQL o capability- i target-bound
  `ALLOW ACCESS`, `ALLOW ACCESS_TARGET` oraz limit TTL credentiala. Delegacja
  nie może rozszerzyć lifecycle action, targetu ani TTL;
- `contracts@a888af9` publikuje `AccessRequirement`, secret-free `AuthStatus`,
  pierwszy standing contract infrastruktury oraz jawnych kandydatów
  connectorów pochodzących z plannera/Digital Twin;
- `orchestrator@f9cd6e2` dodaje Access Resolver: route discovery, existing
  handle, refresh, child delegation, acquisition, scope proof oraz osobne
  blockery AQL/consent/MFA/root credential;
- `orchestrator@b9e6940` podłącza jego odczytową część do żywych `/routes`,
  `auth/query/status`, `auth/query/scopes` i
  `auth/query/acquisition-methods`, bez stałej mapy providerów;
- `runtime@95e7e71` kompiluje, weryfikuje i jednorazowo zużywa podpisane child
  grants dla acquire/refresh/delegate/rotate/revoke, używając istniejącego
  apply-grant HMAC i replay store;
- `orchestrator@4268748` dodaje hash-chained append-only evidence outbox oraz
  opt-in command executor związany z dokładnym URI i hashem payloadu;
- `urirun-connector-plesk@4db9c48` jest pierwszym connector-em referencyjnym
  z `auth/query/status`, `auth/query/scopes` i
  `auth/query/acquisition-methods` bez ujawniania sekretu;
- `platform@75f0511` przypina aktualny runtime i contracts w source lock.

Testy: runtime 74/74, Orchestrator 95/95, contracts 4/4, generator kontraktów
10/10, Plesk 80/80 oraz pełny `npm test` Platformy. Po restarcie żywy runtime
urirun odkrył trzy trasy auth Plesk. Autoryzowane, odczytowe wywołanie
`auth/query/acquisition-methods` zakończyło się powodzeniem i zwróciło
secret-free strategię `bootstrap-api-key`. `auth/query/status` dotarło do
connectora, lecz zakończyło się typowanym `plesk_https_required`, ponieważ
aktualny endpoint środowiska jest HTTP. Nie wykonano bootstrapu ani mutacji.

Odczytowa część Access Resolvera jest już podłączona do live `/routes` i tras
auth. Próba wykonana przez publiczne API Orchestratora odnalazła Plesk,
wywołała auth status, zapisała zdarzenia `route_discovery`, `auth_status` i
`access_resolution`, po czym zachowała `plesk_https_required`. Nie wywołała
bootstrapu. Evidence może być teraz zapisane do pliku JSONL `0600` z
monotoniczną sekwencją i łańcuchem SHA-256. Próba live zapisała i ponownie
zweryfikowała trzy rekordy.

Command executor obsługuje bootstrap/refresh/delegate dopiero po weryfikacji i
atomowym zużyciu podpisanego child grantu związanego z `plan_hash`, targetem,
fingerprintem środowiska, URI, hashem payloadu, credential handles, TTL,
budżetem i jednym wykonaniem. Testy potwierdzają odmowę replay oraz zmienionego
payloadu bez wywołania `/run`. Nie wykonano komendy w środowisku live.

Pozostaje wymusić ten grant także na natywnej granicy connectora/urirun i
ograniczyć token node tak, aby bezpośrednie `/run` nie mogło ominąć executora.
DNS, GitHub, e-mail, voice i e-sign wymagają kolejnych implementacji
conformance. Do czasu scope proof brak credentiala nie może być raportowany
jako automatycznie rozwiązany.

E-mail do Foundera nie jest globalnym fallbackiem każdego błędu. Powiadomienie
powstaje dopiero dla typowanego `AQL_ALLOW_REQUIRED`, native provider consent,
MFA, braku root of trust, umowy zewnętrznej albo authority prawnej, po
wyczerpaniu dozwolonych strategii automatycznych. Wiadomość nie może zawierać
sekretu; przekazuje bezpieczne podsumowanie i korelację z ticketem.

# Część I — naprawy lokalne

## 5. REL-001 — kanoniczny pin Core

Historycznie `platform/test/platform.test.js` oczekiwał `36130b5`, podczas gdy
źródło Core było już nowsze. Problem zamknięto przez kanoniczny source lock;
nie przez ręczne osłabienie asercji.

Realizacja:

1. znaleźć piny w testach, konfiguracji, CI, obrazach i dokumentacji;
2. zweryfikować repo, branch, autora, historię i czystość `a9ac816`;
3. potwierdzić Core 158/158 oraz zgodność API z Platformą;
4. wprowadzić `platform/dependencies.lock.json` jako SSOT;
5. generować asercję meta z lockfile;
6. blokować `.gitmodules`, gitlinki i drift checkout ↔ lockfile;
7. wykonać pełne `npm test` i start z czystego checkoutu;
8. commit/push dopiero przy zielonej bramce.

Lockfile przechowuje repozytorium, pełny commit, verifiera, czas i URI evidence.
Akceptacja: jeden pin, zielony czysty checkout, CI wykrywające drift i evidence
wersji oraz środowiska.

## 6. REL-002 — rozdzielenie dry-run od authority

Wspólny outcome:

```text
PLANNED
SKIPPED_DRY_RUN
DENIED_AUTHORITY
BLOCKED_CAPABILITY
BLOCKED_BUDGET
BLOCKED_JURISDICTION
EXECUTED
VERIFIED
FAILED
ROLLED_BACK
```

```text
DRY_RUN           → SKIPPED_DRY_RUN, escalation=false
capability missing→ BLOCKED_CAPABILITY, owner action
authority missing → DENIED_AUTHORITY, approval may be requested
apply succeeded   → EXECUTED
verify passed     → VERIFIED
```

Zmiana obejmuje model domenowy, API, UI, alerty, SLA, raporty, unit/E2E i
ewentualną migrację statystyk. Dry-run nie tworzy `PLF-506`/`SELFDEV-074`, ale
realny apply bez grantu nadal kończy się `DENIED_AUTHORITY`.

## 7. REL-003 — schemat wyników connectorów

Docelowy `subactor.connector-result.v1` zawiera `ok`, `executed`, `verified`,
`dry_run`, `reason_code`, `mutation_attempted`, liczniki planowane/wykonane,
`plan_hash`, evidence ID i `retryable`.

Reguły:

- licznik jest zawsze liczbą;
- `null` oznacza wyłącznie „nieznane”;
- odmowa ma `executed:false`, `mutation_attempted:false` i liczniki wykonania 0;
- Python i JS walidują jedno JSON Schema;
- bridge nie zmienia semantyki;
- testy obejmują dry-run, authority deny, capability deny, sukces, partial fail
  i rollback;
- klient starszej wersji dostaje jawny błąd wersji.

## 8. REL-004 — manifesty connectorów

Pierwsza kolejność: Plesk, HTTP/TLS verify, DNS, identity/chat, e-mail, voice,
e-sign, marketplace. Manifest opisuje właściciela, runtime, declared routes,
capabilities, mutacje i ich bramki, input/output schema, binding oraz sekrety z
vaultu.

Scanner ma raportować brakujące pola, generować szablon, sprawdzać
route ↔ capability ↔ mutation policy i blokować release connectora używanego w
profilu produkcyjnym. Connector eksperymentalny nie blokuje całej platformy.

## 9. REL-005 — incydenty

Każdy incydent zawiera severity, timeline, detector, affected capabilities,
root cause, containment, resolution, zamykającego, evidence i recurrence test.

Należy odtworzyć historyczny critical, potwierdzić jego zamknięcie, dodać test
regresji, rozdzielić liczniki active/history, ustalić SLO i runbook zawieszenia
grantów po incydencie bezpieczeństwa.

# Część II — authority i evidence

## 10. AUTH-001 — podpisany grant

Grant zawiera: ID, issuer, subject, capability, target, `plan_hash`, limit
kosztu, `valid_from`, `valid_until`, one-time nonce, wymóg rollbacku, evidence
policy i podpis.

Walidator sprawdza podpis, konstytucyjne uprawnienie issuera, subject, target,
hash, czas, nonce, kill switch, AQL, budżet, jurisdiction pack, rollback i
gotowość zależnych connectorów. Nonce jest atomowo rezerwowany przed mutacją.
Zmiana planu unieważnia grant. Grant nie zawiera sekretów i nie rozszerza się
automatycznie.

Negatywne testy: expiry, zły podpis/aktor/target/hash, budget, replay, kill
switch, brak rollbacku, brak jurisdiction pack i zmiana planu po zatwierdzeniu.

## 11. AUTH-002 — rejestr blockerów

```yaml
id: BLK-PLESK-DOMAIN-LIMIT
priority: P0
scope: hosting
state: EXTERNAL_ACTION_REQUIRED
owner_role: plesk-account-owner
blocks:
  - hosting.domain.create
does_not_block:
  - hosting.files.prepare
  - hosting.publish.existing-domain
required_evidence:
  - type: provider-capability-export
  - type: sandbox-create-delete-test
closure_conditions:
  - domain_limit_known
  - free_slot_confirmed
  - permission_confirmed
validity:
  recheck_after_days: 30
```

Rejestr wspiera ownerów, SLA, zależności, external/local, evidence, ważność i
historię. Problem blokuje tylko jawnie wskazane capability.

## 12. EVID-001 — standard evidence bundle

```text
manifest.json
plan.json
plan.sha256
capability-snapshot.json
authority-grant.json
preflight.json
apply-result.json
verify-result.json
rollback-plan.json
rollback-result.json
logs.ndjson
artifacts/before/
artifacts/after/
artifacts/screenshots/
checksums.txt
```

Bundle nie zawiera sekretów, ma stabilne ID, UTC, wersje connector/runtime,
hash każdego artefaktu i korelację z ticketem, planem, grantem oraz incydentem.
`evidence verify` działa offline, a storage jest append-only/WORM lub podpisany.

# Część III — hosting i DNS

## 13. INF-001 — limit domen Plesk

Model rozróżnia:

```text
known(used, limit)
unlimited(used)
unknown(reason)
forbidden(reason)
```

Tylko `known` z wolnym slotem albo `unlimited` pozwala na create. `unknown` i
`forbidden` zawsze odmawiają. Capability pochodzi z autorytatywnego źródła,
ma krótki TTL i evidence surowej odpowiedzi po redakcji. Test create/delete
wymaga sandboxu i osobnej zgody. Pilot korzysta z istniejącego vhosta.

## 14. INF-002 — DNS desired state

Każda domena ma ownera strefy, providera, current/desired origin, rekordy, TTL,
snapshot rollbacku, expected SAN i fingerprint.

```text
discover → diff → plan → snapshot → preflight → grant → apply
→ authoritative/multi-resolver verify → TLS → fingerprint
→ stabilization → rollback albo utrwalenie
```

Standardowy grant nie zmienia MX, apex ani NS. Zmiana strefy jest
serializowana, a drift od dry-run wymusza nowy plan i grant.

## 15. INF-003 — publish na istniejącym vhoście

1. manifest stanu przed;
2. diff, skan sekretów i `plan_hash`;
3. backup plików zmienianych/usuwanych;
4. grant na plan i target;
5. upload do staging;
6. checksumy;
7. atomowy switch lub kontrolowane rename;
8. publiczny HTTPS/fingerprint;
9. rollback przy błędzie;
10. evidence bundle.

Zabronione: upload bez backupu, poza katalogiem, bez grantu, po drift albo bez
publicznego verify.

# Część IV — kanały

## 16. MAIL-001 — e-mail live

Administrator tworzy dedykowane konto, wybiera IMAP/SMTP lub OAuth, przekazuje
sekret przez one-time vault intake i ustala SPF/DKIM/DMARC, allowlisty,
retencję, limity oraz rotację.

Connector korzysta z krótkotrwałego lease, oddziela receive/send, nie ufa
`From`, używa wyników zaufanego systemu pocztowego i kwarantannuje spoof.
Idempotencja obejmuje mailbox, Message-ID, body hash i attachment hashes.

Canary: realna wiadomość → jeden ticket; redelivery → zero duplikatu; spoof →
kwarantanna; odpowiedź do allowlisty; rotacja; skan logów.

## 17. VOICE-001 — telefonia

Domyślnie outbound, recording i transcription są wyłączone, allowlista pusta,
limity niskie, a podpis webhooka obowiązkowy. `voice.call.prepare` i
`voice.call.start` są osobnymi capability. Start wymaga allowlisty, budżetu,
grantu i idempotency key. Callback wymaga podpisu i ochrony replay. Live canary
obejmuje tylko zatwierdzony numer testowy.

## 18. CHAT-001 — publiczny chat

Publiczny endpoint używa HTTPS i OIDC Authorization Code + PKCE. Sesja jest
`HttpOnly`, `Secure`, ma właściwy `SameSite`, krótki idle timeout i rotację ID.

```text
IdP principal → internal principal → AQL contract → digital twin
```

Subject pochodzi z sesji, nie z parametru klienta. Testy obejmują dwóch
użytkowników, cross-user/admin deny, expiry, revoke, CSRF, rate limit i skan
tokenów. Token administracyjny nie jest wystawiany publicznie.

# Część V — prawo i organizacja

## 19. LEGAL-001 — jurisdiction packs

Kod wybiera dokładnie dopasowany, zatwierdzony i niewygasły pakiet; nie tworzy
reguł prawnych z LLM. Pack określa jurysdykcję, relację, status kandydata,
kompensację, czas, prywatność, zakazane pytania, podpis, role, wersje szablonów,
źródła, reviewerów i ważność.

```text
brak exact match       → LEGAL_PACK_MISSING
pakiet wygasł          → LEGAL_PACK_EXPIRED
szablon niezatwierdzony→ TEMPLATE_NOT_APPROVED
zły podpisujący        → SIGNATORY_NOT_AUTHORIZED
```

Draft ma watermark `NOT FOR SIGNATURE`. Nie można wysłać dokumentu z pustymi
polami prawnymi ani uruchomić pracy przed kompletnym onboardingiem.

## 20. ESIGN-001 — draft a podpis

```text
DRAFT → LEGAL_VALIDATED → READY_FOR_SIGNATURE → SENT → VIEWED → SIGNED
DECLINED | EXPIRED | VOIDED | ARCHIVED
```

LLM tworzy tylko `DRAFT`. Wysyłka wymaga packa, zatwierdzonego szablonu,
kompletnych pól, uprawnionego podpisującego, polityki danych i authority.
Sandbox/production są rozdzielone. Webhook jest podpisany i idempotentny, a
hash dokumentu wykrywa zmianę po wysłaniu.

## 21. GOV-001 — sukcesja

YAML nie tworzy mandatu. Organizacja wskazuje osoby, podpisuje umocowania,
nadaje tożsamości, definiuje quorum, aktywację, scope i expiry. Aktywacja daje
czasowy grant; jedna osoba nie zatwierdza własnej sukcesji; powrót primary
unieważnia emergency grants. Współdzielone credentiale są zabronione.

Test: founder → deputy → quorum → external operator → restoration primary →
pełne cofnięcie i audit.

## 22. VENDOR-001 — vendor i marketplace

Przed work order sprawdzane są: approved vendor, MSA/DPA, cennik, budżet,
authority, zakres danych, odbiór, anulowanie i secondary.

```text
quote → normalize → policy/budget → grant → work order → minimal access
→ evidence → accept/reject → invoice match → revoke access
```

Konto marketplace nie oznacza prawa sprzedaży w każdej jurysdykcji.

# Część VI — test live E2E

## 23. Warunki wejścia

Zielony release z czystego checkoutu, manifesty, capability snapshot, granty,
budżet, DNS/TLS użytego targetu, konta, retencja, wymagany jurisdiction pack,
rollback oraz owner evidence.

## 24. Scenariusz

1. ograniczony cel, `plan.json`, `plan.sha256`;
2. dry-run → `SKIPPED_DRY_RUN`, bez mutacji i eskalacji;
3. preflight capability/authority/budget/jurisdiction/lease/rollback/version;
4. istniejący vhost;
5. staging, checksum, switch, HTTPS i fingerprint;
6. dwóch użytkowników chatu i cross-user deny;
7. e-mail: allowlist, idempotencja, spoof quarantine;
8. voice: tylko numer testowy, podpis webhooka, koszt w limicie;
9. e-sign sandbox z zatwierdzonym szablonem;
10. sandboxowy ticket bez realnej pracy przed onboardingiem;
11. wspólny correlation ID i evidence;
12. rzeczywisty rollback, revoke grantów, lease i dostępu.

Status bez kompletnego dowodu nie zalicza testu.

# Część VII — bramki release

## 25. G0–G7

| Gate | Warunek |
| --- | --- |
| G0 Source | czysty checkout, source lock=origin+commit, brak gitlinków, odtwarzalne deps, SBOM |
| G1 Tests | unit, integration, contract, TestQL, negative auth, replay, rollback, redaction |
| G2 Capability | wymagane capability ≥ sandbox, świeże evidence, brak unknown dla mutacji |
| G3 Authority | issuer/hash/target/budget/nonce/kill switch poprawne |
| G4 Security | vault, redakcja, retencja, least privilege, isolation, podpis webhooka |
| G5 Sandbox | pełny flow, retry, idempotencja, timeout, rollback |
| G6 Canary | minimalny target/budżet, allowlista, monitoring, owner i rollback |
| G7 Production | canary/evidence zaakceptowane, runbook, alerty, rotacja, owner+zastępca |

# Część VIII — podział pracy

## 26. Zadania delegowalne stażyście

REL-001–005, AUTH-002, EVID-001, INF-001/003, negatywne testy, runbooki,
dashboard readiness, raport release i sandbox E2E.

Stażysta nie akceptuje regulaminów, nie zakłada kont bez mandatu, nie
przechowuje produkcyjnych sekretów, nie zatwierdza własnego kodu, nie definiuje
prawa, nie aktywuje apply i nie kontaktuje kandydatów jako firma.

## 27. Zadania ownera/tech leada

Zakres pilota, architektura grant/evidence, review, właściciele integracji,
konta/umowy/vault/budżety, prawnik i packi, mandaty, canary/rollback, akceptacja
evidence oraz decyzja o wyłączonych capability.

# Część IX — fale

## 28. Fala A

REL-001–005, AUTH-001/002, EVID-001, lokalny/staging publish i rollback.
Rezultat: platforma jest gotowa przyjąć zewnętrzne capability.

## 29. Fala B

Istniejący vhost, pojedynczy grant, HTTPS verify, monitoring i rollback.
Rezultat: pierwszy płatny pilot.

## 30. Fala C

DNS/TLS chatu, IdP, dwóch użytkowników, realny e-mail, cross-user testy i
rotacja credentiali.

## 31. Fala D

Telefonia dopiero po decyzji prawnej, numerze, allowliście, webhooku, budżecie i
grant engine.

## 32. Fala E

E-sign, rekrutacja i outsourcing dopiero po packach, szablonach, mandatach,
umowach, sandboxie i politykach danych.

# Część X — DoR, DoD i go/no-go

## 33. Definition of Ready

Jednoznaczny cel/target, odwracalność, klasyfikacja danych, ownerzy, capability,
authority, budżet, rollback, verify i brak nierozpoznanego wymagania prawnego.

## 34. Definition of Done

Review drugiej osoby, pozytywne i negatywne testy, zgodne schematy, zero
sekretów, wiarygodny dry-run, właściwy grant, realny verify, wykonany rollback,
kompletny evidence bundle, sprawdzony runbook, akceptacja ownera i data
ponownego sprawdzenia capability.

## 35. GO

Znana zmiana i target, stabilny hash, świeża capability, jednorazowy grant,
budżet, wymagany pack, vault, zgodny connector, backup, publiczny verify,
rollback, redakcja, owner incydentu i evidence.

## 36. NO-GO

- unknown limit przy create domain;
- brak DNS source of truth;
- zły/wygasły/użyty grant, hash lub target;
- kill switch;
- wygasła capability;
- brak rollbacku lub kontraktu connectora;
- sekret w logach;
- brak wymaganego jurisdiction pack;
- nieudany publiczny verify;
- koszt ponad limit;
- niepodpisany webhook;
- drift od dry-run.

## 37. Oczekiwany rezultat

Platforma wykonuje realne operacje tylko tam, gdzie istnieją wszystkie
wymagane fakty zewnętrzne, a poza tym pozostaje fail-closed. Pilot może ruszyć
przed telefonią, rekrutacją, e-sign i marketplace, bez udawania pełnej
autonomii i bez samodzielnego rozszerzania praw systemu.
