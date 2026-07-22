---
{
  "schema": "subactor.doc/v1",
  "id": "docs.operations.plf-798-founder-vault-token-input-and-layered-assurance-2026-07-21",
  "version": 1,
  "status": "current",
  "updated": "2026-07-21"
}
---

# PLF-798 — pole tokenu vault i warstwowa diagnostyka

Data: 2026-07-21. Zleceniodawca: `authority:founder`. Wykonawca:
`bot:project-operator-bot`.

## Pole tokenu

Widok `/founder/vault` pokazuje token w osobnym, domyślnie zamaskowanym polu.
Founder może użyć przełącznika pokaż/ukryj lub wkleić token ręcznie. Fragment URL
jest usuwany natychmiast, a token nie jest zapisywany w cookies, query string,
`localStorage`, `sessionStorage`, tickecie ani audycie. Po sukcesie i przy
opuszczeniu strony pole jest czyszczone.

## Diagnostyka

`npm run verify:layers` tworzy maszynowy raport
`subactor.layered-readiness.v1` i osobno sprawdza:

- agregat 16 usług;
- lokalne powierzchnie aplikacyjne;
- Planfile i warstwę control plane;
- publiczne ścieżki Foundera.

Tryb `npm run verify:layers:production` wymaga zielonego publicznego ingressu i
kończy się błędem przy 404. Pełna strategia znajduje się w
`platform/docs/LAYERED_SYSTEM_ASSURANCE.md`.
