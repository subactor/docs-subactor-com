---
{
  "schema": "subactor.doc/v1",
  "id": "docs.architecture.autonomy-implementation-status",
  "version": 1,
  "status": "current",
  "updated": "2026-07-18"
}
---

# Autonomy implementation status (evidence)

**Date:** 2026-07-18  
**Nearest milestone:** Safe autonomous mutation in a **mocked** environment — not production `docs.subactor.com` deploy.  
**Roadmap:** [`../plans/autonomy-implementation-roadmap.md`](../plans/autonomy-implementation-roadmap.md)  
**ADRs:** [`adr/README.md`](./adr/README.md)

## CURRENT / TARGET / PLANNED / LEGACY

| Layer | CURRENT (implemented) | TARGET | PLANNED | LEGACY (still present) |
| --- | --- | --- | --- | --- |
| Intent | Pack registry + pack-first resolvers; derived phrases/LLM/step-catalog sync; **PR10:** `INTENT_PACK_DUAL_RUN=shadow` default; **cold FALLBACK_PHRASES removed** (fail closed) | Single pack SSOT end-to-end | Flip dual-run `off` after metrics; full Planfile auto from pack | Planfile ticket body hand-maintained (ids synced); dual-run shadow retained |
| Policy | `on_fail` / retry / timeout / `depends_on` vs `after`; **rollback → release-rollback** (PR7); **verify → `applied_unverified`** (PR8) | Full lifecycle + `try_in_order` | — | Default `halt` |
| Apply auth | Dual kill switch + signed apply grant + `plan_hash` + **jti replay** (PR5a–5c) | production verify DoD on live DNS | PR9 cutover (blocked) | Founder token ≠ grant (ADR-003) |
| Transport | **SFTP readiness (PR6)** + **release paths (PR7):** upload→verify→activate; symlink/pointer | Live SFTP apply on Plesk + docroot cutover | PR9 | **Live urirun-node rebuilt 2026-07-18:** paramiko OK, `production_publish_ready=true`; FTP ok; legacy direct `/httpdocs` sync still present |
| DNS / verify | **PR8:** publish-verify ladder; **PR9 prep:** runbook + desired A=`217.160.250.222` | DNS→Plesk + live public DoD | **PR9 execute when G0–G6 green** | **GitHub Pages unhealthy LKG**; origin subdomain+probe marker OK (**needs_human:** cert + DNS HITL) |
| Vault | Lease via browser-agent vault in recipes; lease error mapping (401→`credential_expired`) | ADR-006 lease/revoke/audit | — | `.env` tokens in lab |

## PR0–PR8 evidence table

Commands run 2026-07-18 (PR8):

- `urirun-connector-plesk` `pytest tests/` → **64/64 pass** (verify ladder mocks + prior PR5–7)
- `orchestrator` `node --test tests/pipeline.test.mjs` → **24/24 pass** (`applied_unverified` + rollback after stale fingerprint)
- No claim of live production publish / DNS cutover (PR9)

| Unit | Component commit (sibling) | Platform pin | Tests | Status |
| --- | --- | --- | --- | --- |
| **PR1** canonical paths + drift | ADR-007 docs; gate in platform | `platform` `fbd0692`; drift script | `check-component-drift.mjs` ok | **verified** |
| **PR2** intent pack registry | `core` `d44fbb2` (pack-first intents earlier in history); packs in `platform/config/intent-packs/` | core pin `d44fbb2`; agents `771053d` | intent-pack-registry 6/6 | **verified** (dual-run retained) |
| **PR3** phrase/LLM/step dedupe | `agents` `771053d`; sync script on platform | agents pin `771053d` | sync `--check` ok; nlp-uri-pack 4/4 | **partial** — pack SSOT for resolvers + derived artifacts; **Planfile imports still separate**; dual-run until PR10 |
| **PR4** recipe policy engine | `orchestrator` (policy core + hardening) | orchestrator not a compose submodule (CLI package) | pipeline tests | **partial→hardened** — ticket/rollback stages; compensation → PR7 |
| **PR5a** immutable manifest | `urirun-connector-plesk` `63a4fe1`; `connectors` `580ba39`; `testkit` `8675a5d` | connectors/testkit pins updated | plesk pytest; testkit; smoke dry-run | **done** |
| **PR5b** signed apply grant | runtime `31d2cb6`; core `011e763`; connectors `a42dcfc`; plesk `66be5c5`; testkit `531170c` | platform `385b24c` | runtime 12; plesk 33; testkit 9 | **done** — grant-required apply |
| **PR5c** jti replay | runtime `c6ba013`; plesk `cecfb36`; core `79d3178`; connectors `c578cc2` | platform `17740cc` | runtime 17; plesk 34 | **done** — single-use jti |
| **PR6** SFTP/paramiko readiness | plesk `7d8ab5b`; connectors `cc4c4e5` | platform `0ab75d1` | plesk 42; Dockerfile test | **done** |
| **PR7** release upload/activate/rollback | plesk `d72e8d8`; orchestrator `2adf375`; connectors `d8895c9` | platform `d302def` | plesk 53; orchestrator 22 | **done** |
| **PR8** DNS/TLS + fingerprint verify | plesk `530dda9`; orchestrator `9c687f5`; connectors `866cc96` | platform `803aa45` | plesk 64; orchestrator 24 | **done** |
| **PR9** docs Pages→Plesk cutover | — | docs (this update) | formal origin release + marker; public Pages | **prep / blocked on G2/G6** — G1 green; cert + DNS HITL; no DNS flip |
| **PR10** dual-run reduce | core `f679796`; agents `b8fa969` | platform `f22763c` | control 9/9; agents 5/5; sync `--check` OK | **in progress** (shadow retained) |

Honesty notes:

- **PR3 ≠ full migration.** Resolvers and derived YAML/JSON track packs; Planfile ticket YAML and some recipes remain hand-wired.
- **PR4+PR7+PR8:** Retry/timeout/`on_fail` work; verify failures → `applied_unverified`; `on_fail:rollback` → `rolled_back` / `rollback_failed`. Never fake `ok` / `completed` on stale fingerprint.
- **PR5c ≠ DNS cutover.** Replay-safe grants in mock.
- **PR6 ≠ live Plesk publish.** Image + connector readiness.
- **PR7 ≠ docs.subactor.com cutover.** Release APIs + orchestrator compensation in mock/lab.
- **PR8 ≠ production DNS switch.** Capability + mocked ladder + optional origin/`curl --resolve`. Staging hostname recommendation: `docs-stage.subactor.com` (infra not required). **Public docs may still be GitHub Pages.**

## Fail-closed apply gates (CURRENT)

| Gate | Env / artifact | Deny code | Status |
| --- | --- | --- | --- |
| Master kill | `AUTONOMY_MUTATIONS_ENABLED≠1` | `autonomy_mutations_disabled` | **CURRENT (PR5b)** |
| Domain kill | `PLESK_SYNC_APPLY≠1` | `plesk_sync_apply_required` | **CURRENT** |
| Grant | missing / bad sig / expired / wrong binding | `apply_grant_*` | **CURRENT (PR5b)** |
| Manifest | apply `plan_hash` ≠ recomputed dry-run | `plan_hash_mismatch` | **CURRENT (PR5a)** |
| Replay | reused `jti` | `apply_grant_replay` | **CURRENT (PR5c)** |
| SFTP required | no paramiko / FTP-only without fallback | `capability_unavailable` | **CURRENT (PR6)** |
| Publish verify | DNS/TLS/HTTPS/fingerprint mismatch when enabled | `dns_mismatch` / `tls_san_mismatch` / `fingerprint_stale` → stage `applied_unverified` | **CURRENT (PR8)** |

### Founder / admin grant path

After dry-run: `POST /api/apply-grants` (scope `plans:approve`) with `run_id`, `plan_hash`, `artifact_sha256`, `target`, pack, `risk_class`.  
HMAC: `APPLY_GRANT_HMAC_SECRET` (preferred) or `TOKEN_PEPPER`; rotation via `APPLY_GRANT_HMAC_SECRET_NEXT`.  
Pass returned `grant` as `apply_grant` on mutate. Each `jti` is single-use (replay store; optional `APPLY_GRANT_JTI_STORE` file). Secrets never in tickets/logs.

### Transport policy (PR6) + release (PR7) + verify (PR8)

- Doctor: `capabilities.sftp|ftp|release_activation|rollback|publish_verify|dns_preflight|tls_san_check|content_fingerprint`, `production_publish_ready`, timeouts 15/120/180.
- FTP fallback only when `PLESK_SYNC_ALLOW_FTP_FALLBACK=1`.
- Publish packs list `required_capabilities: ["plesk.site.sync", "plesk.transport.sftp"]`.
- Release: `PLESK_RELEASE_ACTIVATION=auto|symlink|pointer` (default `auto`).
- Verify URI: `plesk://host/site/command/publish-verify` (+ `release-verify` with `verify_origin`/`verify_public`).
- Marker: `/__subactor_release.json` (`Cache-Control: no-store`; fields `release_id`, `artifact_sha256`, `source_commit`, `built_at`, `pack_version`).
- Desired DNS doc: `docs/deployment/dns-desired-state.json` (staging note `docs-stage.subactor.com`).

## PR5–PR8 split

1. ADR-003 **Accepted** (crypto/TTL/replay/rotation/fail-closed).
2. **PR5a–5c done:** manifest, grant, jti replay.
3. **PR6 done:** paramiko in image, capability readiness, structured errors, SFTP-required prod policy.
4. **PR7 done:** release upload / activate / rollback + orchestrator compensation.
5. **PR8 done:** DNS/TLS preflight + public content fingerprint verify (mocked; no cutover claim).
6. **PR9 prep:** cutover runbook + desired A=`217.160.250.222` + **formal origin release** — **no production DNS flip** (G2/G6 red; G1 green).
7. **PR10 in progress:** `INTENT_PACK_DUAL_RUN=shadow|off|on` (default shadow); cold FALLBACK_PHRASES removed; dual-run shadow kept until metrics OK.

Do **not** treat GitHub Pages as safe DNS/content rollback without noting it is an
**unhealthy** last_known_good until Plesk cutover + verify (ADR-002/005).

### PR9 dry preflight (public + origin, 2026-07-18 continuation #5)

- CNAME `docs.subactor.com` → `subactor.github.io` (Pages) — **unchanged; no cutover**.
- TLS SAN public = `*.github.io` (does **not** include `docs.subactor.com`).
- Public fingerprint fetch fails TLS verify — expected `applied_unverified` until cutover.
- **`docs-stage.subactor.com`:** public A=`217.160.250.222`, LE TLS green, HTTPS `/` 200; `/__subactor_release.json` still **404** (rehearsal release not uploaded).
- Origin `--resolve` `docs.subactor.com` → marker **200** `rel_20260718T085927Z_a7f1328e` + LE domain cert.
- **NL lifecycle:** intent/propose/execute surface `status` (`preflight_passed` / `proposed` / `authorized` / `capability_unavailable` / `applied_unverified`) — not bare boolean.
- **needs_human:** Cloudflare API (or panel) for production DNS A cutover; explicit HITL (G6). No token in platform env — do not silent-flip.
- Runbook: [`../deployment/PR9-docs-cutover-runbook.md`](../deployment/PR9-docs-cutover-runbook.md).
- PR10 notes: [`../deployment/PR10-legacy-resolver-cleanup.md`](../deployment/PR10-legacy-resolver-cleanup.md).

## CLI autonomy (founder ask)

**CURRENT (2026-07-18):** `subactor ask "…docs-stage…" --execute --yes` completes reversible apply without permanent kill switches:

1. pack-first + capability preflight
2. dry-run (publish-verify skipped on dry-run)
3. session mutate lease on urirun-node (TTL)
4. signed apply-grant
5. apply → `applied`; lease cleared

docs-stage docroot bound to `/docs-stage.subactor.com` (or `…/current`). Production `docs.subactor.com` public DNS cutover remains HITL (Pages → Plesk).

