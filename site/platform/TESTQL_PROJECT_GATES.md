---
{
  "schema": "subactor.doc/v1",
  "id": "docs.platform.testql.project.gates",
  "version": 1,
  "status": "current",
  "updated": "2026-07-15"
}
---

# TestQL jako bramka projektu

TestQL w tej wersji jest małym, deterministycznym runtime'em do testowania metryk i
warunków projektu.

## Składnia

```testql
VERSION: 1
SUITE project_readiness "Gotowość projektu":
  TEST markdown "Wiedza jest kompletna":
    EXPECT metrics.markdown_chars >= 1000
  TEST processes "Procesy istnieją":
    EXPECT metrics.process_count >= 17
```

Operatory:

```text
== != > >= < <= contains exists
```

## Bramka importu

Import jest oznaczany jako `completed` tylko wtedy, gdy TestQL potwierdzi minimalną
jakość. W przeciwnym razie otrzymuje `needs_review`.

## Bramka wykonania OQL

Ostatni krok planu biznesowego uruchamia `testql.project.run`. Bridge pobiera bieżący
workspace, oblicza metryki, zapisuje `test_run` i przerywa plan, jeśli test nie przejdzie.

## Evidence Bundle

Dla dalszego rozwoju rekomendowany jest pakiet dowodowy:

```json
{
  "project_id": "...",
  "import_id": "...",
  "source_hash": "...",
  "aql_model": "project-business-bootstrap.pl.aql",
  "decision_id": "...",
  "oql_hash": "...",
  "approved_by": "...",
  "preflight_test_run": "...",
  "postflight_test_run": "...",
  "outcome_measurements": [],
  "rollback_reference": "..."
}
```

Wersja developerska przechowuje podstawowe rekordy `evidence`, `test_suites`,
`test_runs`, `outcomes` i hash OQL. W produkcji należy dodać podpisy, trwałą bazę i
retencję.
