---
{
  "schema": "subactor.doc/v1",
  "id": "docs.connectors.proposed-urirun-connectors",
  "version": 1,
  "status": "current",
  "updated": "2026-07-18"
}
---

# Proposed urirun-connectors

Which connectors to build next for the [urirun-connectors org](https://github.com/orgs/urirun-connectors/repositories),
grounded in what Subactor actually needs but does not yet have. The org already
has 74 connectors — including `urirun-connector-plesk` (REST v2),
`urirun-connector-namecheap-dns`, `urirun-connector-email`, and
`urirun-connector-domain-monitor` — so these are the confirmed gaps, not
duplicates.

Each entry: the concrete need, the URI surface, whether secrets are involved,
and the priority.

## P0 — `urirun-connector-cloudflare-dns`

**Why now.** The docs cutover runbook (`PR9-docs-cutover-runbook.md`) is
**blocked** on exactly this: *"G2 Certificate plan — RED: no Cloudflare API for
DNS-01"* and *"G3 DNS provider readiness — YELLOW: Cloudflare NS known; no API
token"*. The zone lives on Cloudflare, but the org only has a Namecheap DNS
connector. This is the connector standing between the current state and a valid
certificate on `docs.subactor.com` — which today serves a `*.github.io` cert
because DNS still points at GitHub Pages.

| | |
|---|---|
| URI surface | `dns://cloudflare/zone/query/records`, `dns://cloudflare/record/command/upsert`, `dns://cloudflare/record/command/delete` |
| Secrets | Cloudflare API token (scoped to the zone, DNS edit) — vault-backed |
| Read-only default | `query/records` is R0; `upsert`/`delete` are R2 (reversible, HITL) |
| Unblocks | DNS-01 TXT records for ACME, the A/AAAA flip from GitHub Pages to Plesk origin |

## P0 — `urirun-connector-acme`

**Why now.** Pairs with the DNS connector to close the same runbook blocker: a
certificate. G2 is RED until a cert is issued; the chosen path is *DNS-01 before
cutover*. An ACME connector that requests a Let's Encrypt cert via a DNS-01
challenge (writing the TXT through `cloudflare-dns`, then collecting the cert)
turns cert issuance from a manual HITL step into a governed URI process.

| | |
|---|---|
| URI surface | `acme://letsencrypt/cert/command/request`, `acme://letsencrypt/cert/query/status` |
| Secrets | ACME account key — vault-backed; no long-lived secret in the recipe |
| Read-only default | `query/status` is R0; `command/request` is R3 (issues a real cert) — HITL |
| Composition | depends on a DNS connector for the DNS-01 TXT; provider-agnostic challenge |

## P1 — `urirun-connector-plesk-topology`

**Why.** Already built and manifested in this repo
(`connectors/services/bridge/src/plesk-topology/connector.manifest.json`): the
docroot rule, live www_root observation over the XML API, and the
declared→rule→observed reconciliation that refuses publishing a subdomain over
the main site's `/httpdocs`. Two dependency-free, secrets-free modules
(`site-topology.mjs`, `plesk-docroot-observe.mjs`) that import only node
builtins — they lift out cleanly. This extends the existing `plesk` connector
rather than competing with it: `plesk` writes, `plesk-topology` decides *where*.

| | |
|---|---|
| URI surface | `plesk://host/site/query/docroot` → `plesk.docroot.decision/v1` fact |
| Secrets | none of its own — the XML API credential is injected by the caller |
| Read-only default | entirely R0 (query + reconcile); it never writes |
| Status | code + 22 tests exist; extraction is packaging, not new work |

## P2 — `urirun-connector-site-generator`

**Why.** Subactor renders markdown to a publishable site (the docs site, the
`build-docs.mjs` renderer, the PHP `PageRenderer`/`MarkdownRenderer`). Exposing
"render this source tree to a deployable bundle" as a URI process would let a
publish recipe generate *and* sync in one governed flow, instead of a separate
build step. Lower priority because a plain folder sync already works.

| | |
|---|---|
| URI surface | `site://generator/bundle/command/render` → files + manifest |
| Secrets | none (pure transform) |
| Read-only default | R1 (produces artifacts, writes nothing external) |

---

## Priority summary

| Connector | Priority | Unblocks | Status |
|---|---|---|---|
| `cloudflare-dns` | P0 | cert issuance, DNS cutover | to build |
| `acme` | P0 | valid cert on docs/www | to build (needs DNS connector) |
| `plesk-topology` | P1 | safe docroot targeting | **built, ready to extract** |
| `site-generator` | P2 | render+publish in one flow | to build |

The two P0s are the same story: `docs.subactor.com` serves the wrong certificate
because the cert was never issued, because there is no Cloudflare DNS-01 path.
Building `cloudflare-dns` + `acme` closes it.
