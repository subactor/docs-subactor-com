---
{
  "schema": "subactor.doc/v1",
  "id": "docs.operations.plf-808-connector-lan-health-topology-2026-07-21",
  "version": 1,
  "status": "current",
  "updated": "2026-07-21"
}
---

# PLF-808 — trwała topologia Connector LAN i pełny health

## Przyczyna

`urirun-lan-gateway` działał w prywatnej sieci `connector-execution` i łączył
się z aliasem `hr-bridge-process-guard`. Bridge otrzymywał tę sieć wyłącznie z
opcjonalnego pliku `docker-compose.connector-lan.yml`. Zwykłe odtworzenie
Bridge z bazowego `docker-compose.yml` usuwało jego członkostwo w sieci. Gateway
pozostawał uruchomiony, ale `/health` kończyło się błędem upstream/timeout.

Równocześnie gateway nie należał do listy wymaganych usług ani w Control, ani w
System Status. Wynik 16/16 mógł więc być zielony przy realnie niedziałającym
wejściu LAN.

## Naprawa

- `hr-bridge` zawsze należy do wewnętrznej sieci `connector-execution` i ma
  alias `hr-bridge-process-guard` już w bazowym Compose;
- Control i System Status należą do klienckiej sieci `company-lan`;
- obie usługi otrzymują tylko certyfikat `connector-auditor`, którego polityka
  zezwala na endpointy `health` i `routes`, ale nie `run`;
- oba dashboardy wykonują prawdziwy probe HTTPS mTLS gatewaya;
- gateway jest krytycznym probe w Control i wymaganym probe w System Status.

Certyfikat operatora ani administratora nie jest przekazywany usługom
monitorującym. Sieć executora nadal jest `internal: true`.

## Postflight

- Docker health `urirun-lan-gateway`: `healthy`;
- mTLS jako `connector-auditor`: HTTP 200, `node.ok=true`, 618 tras;
- System Status: 17/17, 100%, gateway widoczny jawnie;
- Control: gateway `ok=true`, `ready=true`, `critical=true`;
- test regresyjny: `docker compose up -d --no-deps --force-recreate hr-bridge`
  z użyciem wyłącznie bazowego Compose zachował sieci `subactor`,
  `uri-executor`, `connector-execution`; gateway powrócił do `healthy` i mTLS
  nadal zwrócił HTTP 200.

Control nadal raportował 14/15 z jednego niezależnego powodu:
`inbound-email` ma stan `waiting_credentials`. Nie jest to regresja LAN i
pozostaje oddzielnym problemem operacyjnym. Został zapisany i przypisany do
`administrator-bot` jako `PLF-818`; ticket obejmuje także ujednolicenie
funkcjonalnej semantyki readiness między oboma dashboardami.

## Artefakty

- `subactor/core@27400bf`
- `subactor/platform@3250e29`
- `subactor/observability@33d6aa1`
