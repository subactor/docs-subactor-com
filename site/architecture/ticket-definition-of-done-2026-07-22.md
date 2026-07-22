---
{
  "schema": "subactor.doc/v1",
  "id": "docs.architecture.ticket-definition-of-done-2026-07-22",
  "version": 1,
  "status": "current",
  "updated": "2026-07-22"
}
---

# Definition of Done ticketu wyrażony w DSL

Data: 2026-07-22

## Problem

Ticket mógł mieć komplet definicji `aql`/`eql`/`oql`/`uri` w process envelope v2 i
nadal nie dawało się stwierdzić, kiedy jest skończony. Oczekiwania EQL były listą
zdań, a kroki URI osobną listą wywołań. Nic nie łączyło jednego z drugim, więc
„done" oznaczało tyle, że kroki się wykonały — a nie, że oczekiwany stan
zaistniał i został odczytany.

Kryteria akceptacji pisane prozą nie są DoD. Nie da się ich wykonać, więc nie da
się ich zaudytować.

## Kontrakt

DoD ticketu to jego oczekiwania EQL, z których **każde** wskazuje, czym jest
weryfikowane:

```json
{"id": "encrypted", "expected": "plaintext_is_written_only_to_encrypted_origin_bound_vault",
 "verified_by": ["write-encrypted"]}
{"id": "ticket-first", "expected": "ticket_exists_before_effect",
 "verified_by_control": ["process-envelope.v2"]}
```

- `verified_by` — identyfikatory kroków URI **tego samego** ticketu (`inputs.uri_processes`,
  w packu `recipe.v1.urirun.json`). To dowód wykonawczy: konkretny URI, konkretny receipt.
- `verified_by_control` — nazwana kontrola platformy, która sama zamyka się fail-closed.
  Dozwolony zbiór jest skończony i zdefiniowany w `scripts/audit-ticket-definition-of-done.mjs`:
  `process-envelope.v2`, `capability-preflight`, `autonomy-contract`, `apply-grant`,
  `secret-redaction`, `idempotency-key`, `human-approval`.

Kontrola nie jest furtką na „zaufaj mi". Służy niezmiennikom, których żaden krok
URI nie może udowodnić, bo są egzekwowane zanim krok w ogóle powstanie —
np. „ticket istnieje przed efektem" albo „sekret nie trafia do audytu".

## Reguły audytu

`npm run tickets:dod` (`scripts/audit-ticket-definition-of-done.mjs`) sprawdza
process packi i aktywne tickety tym samym ewaluatorem:

| kod | znaczenie |
| --- | --- |
| `definition_of_done_missing` | brak oczekiwań EQL — ticket nie ma DoD |
| `expectation_without_expected` | oczekiwanie bez treści (`expected` lub `assert`) |
| `expectation_without_verification` | oczekiwanie bez `verified_by` i bez `verified_by_control` |
| `expectation_verified_by_unknown_step` | wiązanie do kroku, którego ticket nie ma |
| `expectation_verified_by_unknown_control` | kontrola spoza zamkniętego zbioru |
| `step_without_expectation` | krok URI, którego żadne oczekiwanie nie sprawdza |

`step_without_expectation` jest równie ważny jak brak weryfikacji: efekt, którego
nie sprawdza żadne oczekiwanie, jest efektem bez DoD.

Osobno raportowana jest obserwacja `verified_without_read_back` — oczekiwanie
wiązane wyłącznie krokami `command`, bez żadnego `query`. Wywołanie dowodzi
wywołania, nie skutku. To sygnał do domknięcia read-backu, a nie błąd: dla części
oczekiwań odczyt jest wykonywany przez kontrolę albo przez człowieka.

## Zakres egzekwowania

- **Process packi — egzekwowane.** Wszystkie 11 aktywnych packów wiąże komplet
  oczekiwań; gate `test/ticket-definition-of-done.test.mjs` chodzi w `npm test`
  na prawdziwym `config/process-packs`, więc nowy pack bez wiązań nie przejdzie.
  Tickety cięte z packa dziedziczą wiązania — `processPackPublicView` kopiuje
  `definitions.eql` bez zmian.
- **Tickety historyczne — raportowane.** Domyślne wyjście kończy się kodem błędu
  tylko dla packów. `--strict` czyni zaległość ticketową błędem; to docelowy stan
  po migracji backlogu.

## Stan zaległości na 2026-07-22

42 aktywne tickety, żaden nie ma jeszcze wiązalnego DoD:

- 25 bez jakichkolwiek oczekiwań — to podzbiór 31 ticketów `legacy_without_v2`
  z `npm run tickets:governance`; DoD wymaga wcześniejszej migracji do envelope v2;
- 17 z oczekiwaniami, ale bez wiązań (52 oczekiwania, 51 kroków bez oczekiwania);
- 9 oczekiwań w ticketach ręcznych używa klucza `assert` z treścią prozą
  („10 organizations have primary-source evidence") — ewaluator je czyta, ale
  wiązanie i tak trzeba dopisać.

Automatyczne dowiązanie zaległości zostało świadomie odrzucone. Przy jednym kroku
w tickecie wiązanie jest formalnie jednoznaczne, ale semantycznie fałszywe:
oczekiwanie „0 external messages sent" nie jest dowodzone przez krok, który
wykonuje research. Wiązanie negatywnych niezmienników należy do kontroli, a nie
do kroku, i wymaga decyzji właściciela ticketu.

## Następny przyrost

1. Przenieść walidację wiązań do `core/services/control/src/process-pack-registry.mjs`,
   żeby pack bez `verified_by` nie ładował się w ogóle, nie tylko nie przechodził
   gate'u platformy.
2. Wymagać wiązań przy tworzeniu ticketu z envelope v2 — wtedy zaległość przestaje
   rosnąć.
3. Zmigrować 31 ticketów legacy do envelope v2 i dopisać DoD partiami, z właścicielem
   kolejki jako autorem oczekiwań.
4. Domknąć `verified_without_read_back` tam, gdzie istnieje realna trasa `query`
   (41 obserwacji w packach).
