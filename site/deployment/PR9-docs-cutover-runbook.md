---
{
  "schema": "subactor.doc/v1",
  "id": "docs.deployment.pr9-docs-cutover-runbook",
  "version": 1,
  "status": "current",
  "updated": "2026-07-18"
}
---

# PR9 — docs.subactor.com Pages → Plesk cutover (runbook)

**Status:** preparation only — **do not** flip production DNS until every gate below is green.  
**Related:** ADR-002 (DNS SSOT), ADR-004 (publish DoD), ADR-005 (rollback), PR8 verify ladder.  
**Staging preference:** `docs-stage.subactor.com` (infra optional; origin Host / `curl --resolve` works without it).

## Honesty (2026-07-18 continuation #4 — formal origin release + cert block)

Observed **public** `docs.subactor.com` (read-only):

| Check | Result | Implication |
| --- | --- | --- |
| DNS CNAME | `subactor.github.io.` | Still on **GitHub Pages** |
| DNS A | `185.199.108–111.153` (Pages anycast) | ≠ Plesk origin |
| TLS SAN | `*.github.io` / `*.github.com` — **not** `docs.subactor.com` | Pages TLS is an **unhealthy** last_known_good for hostname DoD |
| `GET /__subactor_release.json` | TLS verify fails (SAN mismatch) | Public fingerprint DoD **cannot** pass until cutover + cert |

Observed **origin** via `curl --resolve docs.subactor.com:443:217.160.250.222`:

| Check | Result | Implication |
| --- | --- | --- |
| HTTPS `/` | **200** Subactor Docs `index.html` | Formal release live (not probe) |
| `/__subactor_release.json` | **200** `rel_20260718T085927Z_a7f1328e`; `Cache-Control: no-store` | Origin fingerprint ready |
| Origin TLS | self-signed `CN=Plesk` | G2 still red for public DoD / strict TLS |
| `www_root` | `/var/www/vhosts/subactor.com/docs.subactor.com/current` | Symlink activate serves live docroot |
| HTTP `:80` | **301** → HTTPS | Expected |

**Release path (gates honored):** dry-run `release-upload` → signed `apply_grant` + `plan_hash` → apply upload (24 files) → new grant → `release-activate` (`symlink`) → set subdomain `www_root` → `current`. Apply used `AUTONOMY_MUTATIONS_ENABLED=1` + `PLESK_SYNC_APPLY=1` only for this window; both **cleared** after (fail-closed). Recipe: [`docs-origin-release.urirun.json`](./docs-origin-release.urirun.json).

**Certificate attempt (honest):**

| Path | Result |
| --- | --- |
| DNS-01 (preferred pre-cutover) | **Blocked** — zone on Cloudflare (`addyson`/`roman`); **no** Cloudflare API token in platform env |
| HTTP-01 via Plesk LE now | **Would fail** — public DNS still Pages; ACME challenge would not hit origin |
| Plesk XML `extension/letsencrypt` | **1013** — `Hook ApiRpc is not implemented in letsencrypt` |
| Subscription `certificate/get-pool` | **1006** Permission denied |
| Apex LE today | SAN = `subactor.com`, `mail.subactor.com` only — **no** `docs.subactor.com` |

**Connector:** `plesk://host/site/command/subdomain-ensure` wired (idempotent XML add). Subdomains 308/309 already existed; ensure returned `existed=true`.

**Cutover today: NO** — G2/G6 red; DNS HITL must not run.

## Gate status (2026-07-18 continuation #4)

| Gate | Status | Evidence / blocker |
| --- | --- | --- |
| **G0** Intent & ownership | **YELLOW** | Desired A filled; Pages CNAME emergency saved. Boundary HITL approval **not** recorded. |
| **G1** Origin content ready | **GREEN** | Formal `release-upload`→`activate` + `www_root`→`current`; marker 200 + `Cache-Control: no-store` via `--resolve`. |
| **G2** Certificate plan | **RED** | Path chosen (DNS-01 preferred) but **blocked**: no Cloudflare API for DNS-01; HTTP-01 unsafe until DNS flip; Plesk LE XML/API unavailable to subscription. Origin still `CN=Plesk`. |
| **G3** DNS provider readiness | **YELLOW** | Cloudflare NS known; no API token; live mutate still HITL; TTL not lowered. |
| **G4** Verify ladder | **YELLOW** | Origin content fingerprint OK (`curl -k --resolve`); strict TLS / public Pages still fail (expected). |
| **G5** Rollback targets | **YELLOW** | Content rollback via `release-rollback` now possible (release on origin); DNS emergency = unhealthy Pages LKG. |
| **G6** Go / no-go | **RED** | Stop — do not mutate production DNS (cert + HITL). |

## Gates (all required before DNS mutate)

### G0 — Intent & ownership

- [ ] Cutover owned as **boundary-class** HITL (ADR-003) — not zero-touch reversible publish.
- [x] Desired DNS recorded in [`dns-desired-state.json`](./dns-desired-state.json) with real Plesk A/AAAA (no placeholder).
- [x] Previous desired (Pages → `subactor.github.io`) saved as emergency DNS rollback target (HITL only; **not** content LKG).

### G1 — Origin content ready (no public DNS required)

- [x] **Plesk subdomain** `docs.subactor.com` (+ optional `docs-stage`) under subscription `subactor.com` — **created 2026-07-18** via XML API (`subdomain.add`; ids 308/309). Separate docroots (not primary `/httpdocs`).
- [x] SFTP probe: `__subactor_release.json` + `index.html` on origin docroot; `--resolve` HTTPS 200 (2026-07-18).
- [x] Formal release uploaded under Plesk release root (`releases/rel_…` + activate `current`) via connector — **2026-07-18** `rel_20260718T085927Z_a7f1328e`; `www_root` → `…/current`.
- [x] Marker `Cache-Control: no-store` on live responses (`.htaccess` + confirmed header).
- [ ] Prefer rehearsal content on **`docs-stage.subactor.com`** origin before production DNS.
- [x] Subscription permissions OK — **not** the blocker (`manage_subdomains` / `create_domains` true; unlimited `max_subdom`).
- [x] Connector URI `plesk://host/site/command/subdomain-ensure` — **wired 2026-07-18**. Do not upload into primary prototypowanie.pl `httpdocs`.
- [x] Rebuild urirun-node with paramiko (SFTP) — **done 2026-07-18** (`production_publish_ready=true`; live methods sftp+ftp ok).

### G2 — Certificate plan

- [x] Choose path: **DNS-01 before cutover (preferred)**; HTTP-01 only immediately after DNS flip.
- [ ] Cert will include SAN `docs.subactor.com` (and `docs-stage.subactor.com` if used) — **not issued yet**.
- [x] Who runs issuance: founder/HITL via **Cloudflare DNS-01** (API token) **or** Plesk panel LE after DNS→Plesk — not LLM; XML LE hook unavailable on this host.

### G3 — DNS provider readiness

- [ ] Authoritative zone editable (Cloudflare API or panel) — API token **missing**.
- [ ] Intent stub [`dns-record-reconcile`](./dns-record-reconcile.urirun.json) reviewed; live mutate still HITL.
- [ ] TTL lowered ahead of cutover (e.g. 60–300s) with enough wait for caches.
- [ ] No residual CNAME to `*.github.io` after cutover.

### G4 — Verify ladder (PR8) against **desired** targets

Enable on recipe / CLI:

```text
plesk://host/site/command/publish-verify
  hostname=docs.subactor.com
  release_id=…
  artifact_sha256=…
  origin_ip=217.160.250.222          # pre-cutover
  dns_targets=[217.160.250.222]      # post-cutover
  verify_origin=true
  verify_public=true              # only after DNS+TLS green
  check_dns=true
  check_tls=true
```

- [x] Pre-cutover: origin content fingerprint green via `--resolve` (insecure TLS expected until G2); public DNS check still fails (Pages) — expected.
- [ ] Post-cutover: full ladder green → plan may reach `completed`.
- [ ] `200 + stale fingerprint` → `applied_unverified` → content rollback (`release-rollback`) or ticket — **never** `ok`/`completed`.

### G5 — Rollback targets (healthy)

| Layer | Healthy target | Unhealthy / notes |
| --- | --- | --- |
| Content | Previous Plesk release (`activate(previous)`) | Current: `rel_20260718T085927Z_a7f1328e`; rollback URI ready after next release |
| DNS emergency | Prior CNAME → `subactor.github.io` (HITL) | Restores Pages; TLS SAN still wrong for `docs.subactor.com` until Pages/custom-domain cert fixed — **ops emergency only** |
| Staging | `docs-stage.subactor.com` on Plesk | Subdomain exists (309); rehearsal content still optional |

### G6 — Go / no-go

Cutover is allowed only when:

1. G1 origin fingerprint green,  
2. G2 cert path agreed (DNS-01 ready **or** immediate LE plan),  
3. G3 TTL↓ + provider access,  
4. Founder/admin HITL approval recorded,  
5. On-call can run content rollback + DNS emergency.

**If any gate is red → stop. Do not mutate production DNS.**

## Cutover sequence (when gates green)

1. Final origin verify (`--resolve`).
2. Issue/confirm cert (DNS-01 on Cloudflare) **or** prepare HTTP-01 after DNS.
3. HITL: apply DNS A/AAAA (or ALIAS) → Plesk; remove Pages CNAME.
4. Wait TTL / check authoritative + public resolvers.
5. Confirm TLS SAN includes `docs.subactor.com`.
6. `publish-verify` with `verify_public=true` → fingerprint match.
7. Only then report publish / plan `completed`.
8. If verify fails → content `release-rollback` and/or DNS emergency HITL; status `rolled_back` / `applied_unverified`, never fake success.

## Automation hooks (prep)

| Hook | State |
| --- | --- |
| `plesk://…/publish-verify` | **PR8 done** (mocked + optional live) |
| `__subactor_release.json` on upload | **PR8 done** |
| Orchestrator `applied_unverified` | **PR8 done** |
| Desired DNS file | [`dns-desired-state.json`](./dns-desired-state.json) — A=`217.160.250.222` |
| Origin release recipe | [`docs-origin-release.urirun.json`](./docs-origin-release.urirun.json) |
| `plesk://…/subdomain-ensure` | **wired** (connector) |
| `dns-record-reconcile` recipe stub | [`dns-record-reconcile.urirun.json`](./dns-record-reconcile.urirun.json) — **not** in intent-pack registry yet (avoids dual-run churn); register in PR9 when AQL + provider connector wired |
| Intent pack `dns-record-reconcile.v1.json` | Deferred until AQL model + Cloudflare/dns connector grant exist |

## Out of scope here

- Flipping production DNS without green gates / explicit HITL.
- Claiming public `docs.subactor.com` is on Plesk.
- Uploading docs into primary `prototypowanie.pl` httpdocs as a substitute for the docs addon.

## Parallel work while PR9 blocked

See [`PR10-legacy-resolver-cleanup.md`](./PR10-legacy-resolver-cleanup.md) — reduce dual-run / legacy resolvers (pack-first already stable for docs/www).
