---
{
  "schema": "subactor.doc/v1",
  "id": "docs.operations.plf-767-canonical-agent-mailbox-2026-07-21",
  "version": 1,
  "status": "current",
  "updated": "2026-07-21"
}
---

# PLF-767 — kanoniczna skrzynka `agent@subactor.com`

Data wykonania: 2026-07-21. Decydent: `authority:founder`.

## Korekta

Kanoniczną skrzynką operacyjną Subactora jest `agent@subactor.com`. Poprzednia
konfiguracja runtime'u wskazująca `hello@subactor.com` została zastąpiona.
Żadnej skrzynki nie usunięto.

Odczyt connectora i niezależny odczyt surowego Plesk REST API potwierdziły, że
przed korektą istniały trzy konta. Odczyt po operacji ponownie potwierdził:

- `agent@subactor.com`: `exists=true`;
- `hello@subactor.com`: `exists=true`;
- `agent@prototypowanie.pl`: `exists=true`.

## Wykonanie AQL → OQL → URI → EQL

1. AQL dopuścił inspekcję, rotację credentiala kanonicznej skrzynki, zapis do
   vault i zmianę konfiguracji runtime'u. Zabronił usuwania skrzynek i
   zwracania sekretów.
2. OQL zaplanował `mailbox.ensure` wyłącznie dla `agent@subactor.com`, zmianę
   konfiguracji oraz kontrolowany test `email.send`.
3. Dry-run connectora zwrócił akcję `rotate` i plan
   `dc6e6fff465e285948a4a882526c1db1aef56e4215759b983c3197ab6c87cc24`.
4. URI `plesk://host/mailbox/command/ensure` wykonało dokładnie ten plan po
   sprawdzeniu jednorazowego grantu klasy `governance`.
5. Wygenerowane hasło trafiło bezpośrednio do `agent-mailbox-runtime` dla
   `imap://mail.prototypowanie.pl` oraz `smtp-system-email` dla
   `https://prototypowanie.pl`; nie pojawiło się w wyniku, pliku `.env`,
   tickecie ani dokumentacji.
6. Bramki `AUTONOMY_MUTATIONS_ENABLED` i `PLESK_MAILBOX_APPLY` zostały po
   operacji ponownie zamknięte.

## Dowody end-to-end

- Plesk: `SUCCESS: Update of mailname 'agent@subactor.com' complete`;
- runtime IMAP: `INBOUND_AGENT_EMAIL=agent@subactor.com`, stan `ready`,
  `last_poll_error=null`;
- runtime SMTP: użytkownik i nadawca `agent@subactor.com`;
- SMTP: kontrolowana wiadomość `[PLF-767 E2E 20260721T1513Z]` została wysłana
  transportem `external`;
- IMAP: ta sama wiadomość została odebrana i zarejestrowana jako syntetyczny
  ticket PLF-771;
- ochrona treści: PLF-771 miał `command_authorized=false`, kolejkę
  `customer-support` i stan `waiting_input`; po potwierdzeniu testu został
  zamknięty bez wykonania treści;
- testy parsera i polityki inbound: 13/13 zaliczone;
- `docker compose config --quiet`: konfiguracja poprawna.

Pliki konfiguracyjne nadal rejestrują `hello@subactor.com` i
`agent@prototypowanie.pl` jako istniejące, niekanoniczne adresy kompatybilności.
Runtime nie podstawia ich automatycznie zamiast `agent@subactor.com`.
