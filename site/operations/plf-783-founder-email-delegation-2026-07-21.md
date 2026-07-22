---
{
  "schema": "subactor.doc/v1",
  "id": "docs.operations.plf-783-founder-email-delegation-2026-07-21",
  "version": 1,
  "status": "current",
  "updated": "2026-07-21"
}
---

# PLF-783 — jednoklikowa delegacja z e-maila Foundera

Data: 2026-07-21. Zleceniodawca: `authority:founder`.

## Zakres

Powiadomienia wymagające reakcji Foundera otrzymały podwójne adresowanie:
lokalne na hoście Subactor i publiczne pod `founder.subactor.com`. Linki panelu
zawierają już numer ticketu. Jeżeli Delegation Manager znajdzie wykonawców z
pokryciem kontraktu AQL, e-mail zawiera osobne linki dla każdej konkretnej osoby
lub maszyny.

Kliknięcie linku deleguje ticket bez wyszukiwania go w kolejce. Mutacja wymaga
aktywnej sesji Foundera, scope `routing:manage`, jednorazowego tokenu oraz
ponownej walidacji roli i kontraktu AQL. Automatyczny skaner e-maila nie ma sesji
i nie może zużyć tokenu.

## Implementacja

- `core/services/control/src/founder-delegation-access.mjs` — hash tokenu,
  allowlista aktorów i atomowy cykl życia;
- `core/services/control/src/routes/founder-delegation.mjs` — bezpieczna strona
  oraz POST wykonujący Delegation Manager;
- `core/services/control/src/founder-communication-process.mjs` — nowy format
  wiadomości;
- `platform/docs/FOUNDER_EMAIL_ONE_CLICK_ACTIONS.md` — instrukcja operacyjna.

Historyczny `PLF-770` był już zakończony przed wdrożeniem i nie został ponownie
delegowany. Weryfikacja live używa osobnego, kontrolowanego ticketu testowego.
