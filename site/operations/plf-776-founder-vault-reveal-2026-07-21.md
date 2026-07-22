---
{
  "schema": "subactor.doc/v1",
  "id": "docs.operations.plf-776-founder-vault-reveal-2026-07-21",
  "version": 1,
  "status": "current",
  "updated": "2026-07-21"
}
---

# PLF-776 — jednorazowy dostęp Foundera do vault

Data wdrożenia: 2026-07-21. Zleceniodawca: `authority:founder`.

## Rezultat

Dodano ticket-bound proces pozwalający Founderowi odebrać pojedyncze pole
sejfu przez krótko ważny, jednorazowy URL. Automaty i tokeny administracyjne nie
mogą odczytać URL z odpowiedzi API: mogą wyłącznie zlecić dostarczenie go przez
zatwierdzony zewnętrzny kanał e-mail. Sam odczyt wymaga aktywnej sesji Foundera.

## Zabezpieczenia

- AQL/OQL/URI wiążą ticket z dokładnym wpisem, origin i polem vault;
- operacja wymaga jawnego `human_approval: true`;
- w rejestrze przechowywany jest wyłącznie solony hash tokenu;
- token znajduje się w fragmencie URL i jest usuwany z paska adresu;
- ujawnienie jest atomowo jednorazowe, z TTL 1–15 minut;
- sekret nie trafia do e-maila, URL, ticketu, audytu ani receiptu;
- odpowiedź i strona mają politykę `no-store`, brak referrera i restrykcyjny CSP;
- strona usuwa wartość z widoku po 60 sekundach;
- nieudana wysyłka unieważnia utworzony token.

## Implementacja i weryfikacja

Warstwa znajduje się w `core/services/control/src/founder-vault-access.mjs` i
`core/services/control/src/routes/founder-vault.mjs`. Operator korzysta z
`platform/scripts/create-founder-vault-reveal-link.mjs`. Instrukcja i przykład
manifestu są w `platform/docs/FOUNDER_VAULT_REVEAL.md`.

Testy tras i linków obejmują zgodność ticketu, wymóg sesji, dostarczenie przez
zewnętrzny SMTP, brak URL w odpowiedzi dla bearera, jednokrotność i brak sekretu
w dowodach. Pełny zestaw `core`: 303/303 testy zaliczone; testy celowane:
15/15 zaliczonych. Test live utworzył `PLF-780`, dostarczył link transportem
zewnętrznym i pozostawił w rejestrze wyłącznie hash tokenu.
