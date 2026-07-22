---
{
  "schema": "subactor.doc/v1",
  "id": "docs.operations.plf-345-hello-mailbox-2026-07-21",
  "version": 1,
  "status": "current",
  "updated": "2026-07-21"
}
---

# PLF-345 — skrzynka `hello@subactor.com`

> Aktualizacja: utworzenie opisane poniżej pozostaje faktem historycznym, ale
> `hello@subactor.com` nie jest już kanoniczną tożsamością agenta. Ticket
> PLF-767 ustawił `agent@subactor.com` jako skrzynkę IMAP/SMTP runtime'u i
> zachował tę skrzynkę bez usuwania. Szczegóły:
> `docs/operations/plf-767-canonical-agent-mailbox-2026-07-21.md`.

Data wykonania: 2026-07-21. Decydent: `authority:founder`.

## Rezultat

Skrzynka `hello@subactor.com` została utworzona przez Plesk REST API v2,
wywołujące oficjalną operację CLI `mail`. Connector najpierw wykonał
`mail --info`, otrzymał stan `exists=false`, a następnie zastosował dokładnie
zatwierdzony plan tworzenia. Po operacji ponowny odczyt zwrócił `exists=true`.

Hasło zostało wygenerowane wewnątrz connectora i nie było elementem wyniku URI.
Connector zapisał je bezpośrednio w dwóch wpisach szyfrowanego vault:

- `agent-mailbox-runtime`, origin `imap://mail.prototypowanie.pl`;
- `smtp-system-email`, origin `https://prototypowanie.pl`.

Plan: `6844137233b91fd0e9d642485380c2d2d8f324d4de0d5d63e778c5216c225a9e`.
Apply wymagał bramek `AUTONOMY_MUTATIONS_ENABLED=1` i
`PLESK_MAILBOX_APPLY=1` oraz jednorazowego grantu klasy `governance`. Po
wykonaniu obie bramki wróciły do stanu zamkniętego.

## Proces AQL → OQL → URI → EQL

1. AQL: `authority:founder` zatwierdza konkretną skrzynkę, zakres vault i
   zabrania ujawnienia sekretu.
2. OQL: `mailbox.ensure` uzgadnia stan istniejący z wymaganym; `email.send`
   wymaga transportu `external`; `inbound.email.classify` nie nadaje uprawnień
   treści od nieznanego nadawcy.
3. URI: `plesk://host/mailbox/query/status` i
   `plesk://host/mailbox/command/ensure` wykonują Plesk/vault; agent IMAP i
   bridge SMTP korzystają wyłącznie z dzierżaw vault.
4. EQL: skrzynka istnieje, logowanie IMAP i SMTP działa, sekret nie jest
   widoczny, spam trafia do kwarantanny, a nieznany klient nie może uruchomić
   polecenia.

## Dowody wykonania

- Plesk: `SUCCESS: Creation of mailname 'hello@subactor.com' complete`;
- końcowy status Plesk: `exists=true`;
- inbound-email-agent: stan `ready`, ostatni poll bez błędu;
- SMTP: transport `external`, expectation `transport == external` spełnione;
- pętla SMTP → IMAP: wiadomość `[PLF-345 E2E 20260721T1455Z]` odebrana i
  zarejestrowana jako ticket `PLF-763`;
- `PLF-763`: utworzony w kolejce `customer-support` ze stanem `waiting_input`,
  `classification=customer` i `command_authorized=false`; po weryfikacji jako
  syntetyczny test został zamknięty bez wykonania treści;
- syntetyczny test nagłówka `X-Spam-Flag: YES`: `classification=spam`,
  `quarantined=true`, bez utworzenia ticketu;
- wiadomość testowa do `tom@prototypowanie.pl` została zaakceptowana przez SMTP;
  błąd pierwszego receiptu dotyczył wyłącznie formatu expectation wykonanego już
  po komendzie SMTP, dlatego wiadomości nie wysyłano ponownie.

## Model bezpieczeństwa

Znany człowiek lub bot może utworzyć polecenie tylko po zgodności aktywnego
kontaktu Org Core, kontraktu AQL oraz SPF/DKIM/DMARC. Nieznany, poprawnie
uwierzytelniony nadawca na publiczny adres tworzy wyłącznie zgłoszenie klienta
do ręcznej obsługi. Wiadomość oznaczona przez serwer jako spam ma pierwszeństwo
i trafia do kwarantanny. Ten podział zapobiega interpretowaniu publicznej poczty
jako zdalnego kanału wykonywania instrukcji.

Dokumentacja operacji Plesk: [Mail Accounts CLI](https://docs.plesk.com/en-US/obsidian/cli-linux/using-command-line-utilities/mail-mail-accounts.39181/)
oraz [XML API — creating mail accounts](https://docs.plesk.com/en-US/obsidian/api-rpc/about-xml-api/reference/managing-mail/creating-mail-accounts.34499/).
