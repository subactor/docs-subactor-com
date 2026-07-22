---
{
  "schema": "subactor.doc/v1",
  "id": "docs.deployment.dns-provider-control-2026-07-21",
  "version": 1,
  "status": "current",
  "updated": "2026-07-21"
}
---

# Provider-aware DNS przez connector Plesk

Data diagnozy: 2026-07-21.

## Wynik

Plesk jest originem i panelem hostingu, lecz nie jest autorytatywnym operatorem DNS
dla badanych stref. Delegacja potwierdzona przez Cloudflare DNS i Google DNS:

| Strefa | Autorytatywne NS | Provider |
| --- | --- | --- |
| `subactor.com` | `addyson.ns.cloudflare.com`, `roman.ns.cloudflare.com` | Cloudflare |
| `autonomicznosc.pl` | `apollo.ns.cloudflare.com`, `rita.ns.cloudflare.com` | Cloudflare |
| `prototypowanie.pl` | `apollo.ns.cloudflare.com`, `rita.ns.cloudflare.com` | Cloudflare |

Dotychczasowy `plesk://host/dns/command/replace` poprawnie zmieniał obiekt lokalnej
strefy Pleska, ale taka zmiana nie mogła wpłynąć na odpowiedzi wymienionych wyżej
nameserverów. Dlatego cutover wykonany w panelu Cloudflare był dla Subactor zmianą
poza kontrolą: nie miał planu, apply-grantu ani receiptu providera.

## Nowy kontrakt URI

Connector Plesk `v0.12.1` pozostaje pojedynczym wejściem operacyjnym:

1. `plesk://host/dns/query/authority` ustala strefę i wymaga zgodności dwóch
   niezależnych resolverów co do NS.
2. `plesk://host/dns/command/reconcile` zatrzymuje się przy rozbieżności
   `expected_provider`; dla stref Cloudflare używa Cloudflare API, a dla stref
   Pleska istniejącej ścieżki XML.
3. Dry-run zwraca deterministyczny `plan_hash`, konflikty A/AAAA/CNAME i
   `provider=cloudflare` albo `provider=plesk`.
4. Apply wymaga globalnej bramki mutacji, bramki providera, podpisanego grantu
   `boundary` z dokładnym targetem i jednokrotnego JTI.
5. `plesk://host/dns/query/propagation` raportuje osobno consensus wartości oraz
   zakres pozostałych TTL na Cloudflare DNS i Google DNS, a dla A/AAAA porównuje
   je również z resolverem systemowym runtime.

Cloudflare apply używa batch API: najpierw usuwa rekordy konfliktowe, następnie
tworzy jeden rekord docelowy i ponownie odczytuje stan przez API. Transakcja u
providera nie oznacza natychmiastowej propagacji w cache resolverów, dlatego receipt
API i wynik propagacji są dwoma różnymi dowodami.

## Sekret i najmniejsze uprawnienia

W vault potrzebny jest wpis `cloudflare-dns` związany dokładnie z originem
`https://api.cloudflare.com`, zawierający pola:

- `api_token` — token ograniczony do właściwej strefy z Zone DNS Edit oraz Zone
  Read (odczyt strefy służy do sprawdzenia powiązania `zone_id` przed zmianą);
- `zone_id` — identyfikator strefy `subactor.com`.

Tokenu ani `zone_id` nie wolno umieszczać w tickecie, pliku `.env`, payloadzie URI,
logu ani receipcie. Do czasu uzupełnienia wpisu działają zapytania authority i
propagation; provider API dry-run/apply kończy się fail-closed na etapie lease.

## Stan sprawdzony

Cloudflare DNS i Google DNS zwracają dla `status.subactor.com` A
`217.160.250.222` (odpowiednio TTL `86400` i `21600`). Resolver systemowy runtime
wciąż zwracał cztery adresy GitHub Pages, dlatego pełny wynik ma
`consensus=false` i `propagated=false`. To wyjaśnia przejściowy certyfikat
`*.github.io` widziany bez wymuszenia originu; Plesk origin odpowiada już poprawnie
po `--resolve`. Connector nie ukrywa tego stanu jako zakończonej propagacji.

Pozostałe kroki wdrożeniowe:

1. opublikować connector `v0.12.1` i odświeżyć obraz/registry `urirun-node`;
2. dodać token i `zone_id` przez jednorazowy formularz vault;
3. uruchomić provider-aware dry-run dla `status.subactor.com` — oczekiwane
   `changed=false`, ponieważ publiczny rekord jest już prawidłowy;
4. zachować receipt dry-run jako przejęcie kontroli nad stanem wykonanym wcześniej
   poza connectorami;
5. następne zmiany DNS wykonywać wyłącznie przez plan → grant → apply → provider
   verify → propagation verify.
