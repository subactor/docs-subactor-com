---
{
  "schema": "subactor.doc/v1",
  "id": "docs.architecture.problem-profile-and-reaction-2026-07-21",
  "version": 1,
  "status": "current",
  "updated": "2026-07-21"
}
---

# Problem Profile v1 i reakcje na błędy

Status: wdrożony kontrakt błędu, deduplikacja i klasyfikacja obserwacyjna;
automatyczne strategie mutujące pozostają fail-closed
Data: 2026-07-21

## Decyzja

Subactor używa RFC 9457 `application/problem+json` jako publicznego kontraktu
błędu. RFC 9457 zastępuje RFC 7807. Problem Profile nie jest kolejnym językiem
wykonawczym: opisuje wystąpienie problemu, natomiast istniejące warstwy nadal
dzielą odpowiedzialności:

- SODL zapisuje fakt, korelację, fingerprint i historię;
- AQL określa authority do diagnozy, naprawy i odbioru powiadomienia;
- OQL określa operację naprawczą;
- URI Process wybiera jednoznaczny connector/runtime;
- EQL weryfikuje rezultat;
- TestQL sprawdza kontrakt i scenariusze awaryjne;
- Planfile przechowuje pracę, ownera i completion receipt.

## Kontrakt

`subactor.problem.v1` zawiera pola RFC 9457: `type`, `title`, `status`, `detail`
i `instance`. Rozszerzenia Subactora to między innymi `code`, `legacy_code`,
`category`, `severity`, `retryable`, `security`, `component`, `resource`,
`correlation_id`, `ticket_id` oraz deterministyczny `fingerprint`.

Pole `error` pozostaje tymczasowo aliasem bezpiecznego `legacy_code`, aby
istniejące klienty mogły przejść na `code` bez jednoczesnego breaking change.
Dowolne komunikaty wyjątków, stack trace, sekrety i query string nie są
publikowane jako `detail`.

Wspólny helper automatycznie podnosi ręczne odpowiedzi HTTP 4xx/5xx do Problem
Profile i zachowuje ich rozszerzenia. Odpowiedzi, w których stare API używało
tekstowego pola `status` jako statusu lifecycle, publikują tę wartość jako
`lifecycle_status`. Pole `status` jest zawsze liczbą HTTP wymaganą przez RFC
9457.

Kod kanoniczny ma format `subactor.<domain>.<component>.<condition>`. HTTP status
opisuje transport i nie służy samodzielnie do wyboru reakcji. Severity używa
wartości zgodnych z telemetryką (`warn`, `error`, `fatal`), a incydent
bezpieczeństwa jest osobną klasyfikacją, nie poziomem severity.

## Zdarzenie

Każdy nieobsłużony błąd Control jest normalizowany i zapisany jako
`problem.detected`. Jego linia SODL ma `kind=problem`, `mode=observe`,
`status=failed` i `replayable=false`. Ponowienie dotyczy dopiero zatwierdzonego
process packa naprawczego, nigdy samego wyjątku.

Fingerprint jest hashem kanonicznego zestawu:

```text
code + component + environment + resource
```

Pozwala grupować powtórzenia bez tworzenia osobnego ticketu i e-maila dla
każdego timeoutu.

## Klasyfikacja reakcji

Process pack `problem.reaction.observer` wykonuje wyłącznie obserwację,
deduplikację i klasyfikację `problem.detected`. Request-scoped observer obejmuje
zarówno wyjątki, jak i kontrolowane odpowiedzi HTTP Problem Profile. Stan okien jest trwały w
`problem-reactions.json`, a operator z zakresem `audit:read` odczytuje go przez:

```text
GET /api/problems/reactions
GET /api/problems/reactions?fingerprint=<sha256>
```

Klasyfikator zwraca jedną z decyzji `observe`, `retry_candidate`,
`escalate_candidate` lub `containment_candidate`. Każda ma
`automatic_mutation_allowed=false`. Dla transient failure dwa pierwsze
wystąpienia w pięciominutowym oknie wskazują bounded exponential backoff, a
trzecie wskazuje eskalację. To nadal sugestia strategii, nie wykonanie.

## Następny przyrost

Kolejny process pack może połączyć klasy problemów z wykonywalnymi strategiami:
retry z idempotency key, circuit breaker, secure credential intake, kompensacja,
containment albo eskalacja do właściwej authority. LLM może porządkować
zatwierdzone strategie, ale nie może wymyślać kodu, URI, odbiorcy, authority ani
operacji.

Automatyczny apply pozostaje zabroniony bez wcześniejszego ticketu, aktualnego
AQL/EQL, dry-run, dokładnego plan hash i jednorazowego grantu.
