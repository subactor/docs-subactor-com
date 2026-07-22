---
{
  "schema": "subactor.doc/v1",
  "id": "docs.operations.plf-794-founder-public-link-eql-gate-2026-07-21",
  "version": 1,
  "status": "current",
  "updated": "2026-07-21"
}
---

# PLF-794 — bramka EQL dla publicznych linków Foundera

Data: 2026-07-21. Zleceniodawca: `authority:founder`.

## Problem

`founder.subactor.com` ma poprawny DNS i TLS, ale ścieżki aplikacyjne zwracają
404. Dotychczas generator e-maili mógł mimo to umieszczać link publiczny, co
powodowało nieudane wejście do vault lub delegacji.

## Rozwiązanie

Control przed wysłaniem linku wykonuje read-only EQL preflight: dokładny HTTPS
host i ścieżka, brak redirectu, HTTP 200 i `text/html`. Niegotowy link publiczny
jest pomijany, e-mail wskazuje PLF-592 i podaje działający wariant lokalny. Gdy
nie ma żadnego gotowego adresu dostawy vault, token jest od razu unieważniany.

Warstwy procesu opisano w
`platform/docs/FOUNDER_OPERATIONAL_DSL_LAYERS.md`. Implementacja znajduje się w
`core/services/control/src/founder-endpoint-readiness.mjs` oraz generatorach
powiadomień i trasie vault.

## Dowody

- testy ukierunkowane: 19/19;
- pełne testy `@subactor/core`: 311 zaliczonych, 0 błędów, 6 pominiętych;
- osobny bloker publicznego ingressu pozostaje w PLF-592.
