---
{
  "schema": "subactor.doc/v1",
  "id": "docs.architecture.capability-tooling-evaluation",
  "version": 1,
  "status": "current",
  "updated": "2026-07-18"
}
---

# Capability tooling evaluation (touri / uri2verify / TestQL / dockfra / hypervisor)

**Date:** 2026-07-18  
**Goal gap:** pack `required_capabilities` ↔ connector doctor readiness (Subactor / Plesk)  
**Scope:** smoke-test candidate packages; apply only what closes the gap; minimal refactors.

## Summary

| Package | Smoke result | Verdict for gap | Applied? |
| --- | --- | --- | --- |
| **tellmesh/touri** | Core import + `validate`/`list` OK; 14 pass / voice+markpact failures unrelated | **Helpful** — capability id + `.uri.capability.yaml` manifest shape | Yes (pattern + local manifests) |
| **tellmesh/uri2verify** | Unit tests pass; `capability-plan` was broken without hypervisor | **Helpful** — capability verification plan builder | Yes (touri fallback + used as design cue) |
| **semcod / TestQL** | Installed (`1.2.60`); `testql analyze` on platform OK | **Partial** — good scenario orchestrator, not SSOT for pack⊆doctor | Thin wrapper scenario only |
| **wronai/dockfra doctor** | CLI runs; reports wizard offline without dockfra stack | **Not useful** for Plesk capability ⊆ gate | No |
| **wronai/hypervisor** | Examples = touri capability registry copy; package not importable without install | **Partial** — contract-registry pattern; too heavy as dependency | No (uri2verify still prefers it when present) |
| **wronai/vdisplay** | Present; display orchestration | **Not useful** for this gap | No |

## Test results (detail)

### touri (`/home/tom/github/tellmesh/touri`)

- `pytest` (ignoring markpact): core registry/validate path works; voice optional extras fail without backends.
- CLI: `touri validate` / `touri list` on `examples/20_touri_capabilities` succeed.
- Takeaway: **capability ids + YAML manifests** are the right vocabulary for pack `required_capabilities`.

### uri2verify (`/home/tom/github/tellmesh/uri2verify`)

- Data-quality / replay / result-check tests: **pass**.
- Before refactor: `uri2verify capability-plan` → `ModuleNotFoundError: hypervisor.contract_registry`.
- After refactor: falls back to **touri** `*.uri.capability.yaml` registries; smoke OK on touri examples and on Subactor `platform/config/connector-capabilities/`.
- New regression: `tests/test_touri_capability_plan.py`.

### TestQL

- Installable from local oqlos tree; CLI works.
- Thin wrapper: `platform/components/testkit/tests/testql/capability-preflight.testql.toon.yaml` shells the preflight CLI (fixture green + red doctor → exit 1).
- Ownership (unchanged): TestQL may **call** the preflight CLI and assert exit codes; it must not own capability SSOT ([testing-intents-and-deploy-results.md](./testing-intents-and-deploy-results.md)).

### dockfra doctor

- `dockfra cli doctor` → wizard offline (expected without running dockfra root).
- Diagnoses Docker Compose wizard health, not connector capability readiness → **out of scope**.

### hypervisor

- `examples/20_touri_capabilities` mirrors touri manifests (same pattern).
- `pytest` collection fails without editable install (`No module named 'hypervisor'`).
- Useful as optional backend for uri2verify when `contracts/` exists; not required for Subactor preflight.

## Integration shipped in Subactor

| Artefact | Role |
| --- | --- |
| `platform/config/connector-capabilities/catalog.v1.json` | Pack id ↔ doctor keys + `aql.oql` / `aql.uri_processes` |
| `platform/config/connector-capabilities/plesk.doctor.fixture.json` | CI fixture mirroring live short-key + `available` shape |
| `platform/config/connector-capabilities/*.uri.capability.yaml` | Touri-style docs (sync / sftp / tls / ssl_ensure) |
| `platform/config/connector-capabilities/preflight.mjs` | ⊆ doctor library + AQL ⊆ check + live fetch |
| `platform/scripts/capability-preflight.mjs` | CLI (`--live`, `--aql-only`, `capability_unavailable` / `capability_not_in_aql`) |
| `platform/test/capability-preflight.test.mjs` | Unit/regression (doctor + AQL) |
| `core/.../capability-preflight-gate.mjs` | Fail-closed gate for control |
| `core/.../routes/llm.mjs` + `plans.mjs` + `apply-grants.mjs` | Deny before NL success / propose / grant issue |
| `platform/bin/subactor` | Surfaces `capability_unavailable` / `preflight_failed` on `ask` |

```bash
# Fixture (CI) — doctor ⊆ + AQL ⊆
node platform/scripts/capability-preflight.mjs --json
node platform/scripts/capability-preflight.mjs --aql-only --json
node platform/scripts/capability-preflight.mjs --require-publish-ready

# Live doctor from running urirun-node
URIRUN_NODE_TOKEN=$SUBACTOR_ADMIN_TOKEN \
  node platform/scripts/capability-preflight.mjs --live --via urirun --urirun-url http://127.0.0.1:18765 --json

# Live via bridge (in-compose)
BRIDGE_INTERNAL_URL=http://hr-bridge:8081 BRIDGE_SERVICE_TOKEN=… \
  node platform/scripts/capability-preflight.mjs --live --via bridge --json
```

**Live doctor URI:** `plesk://host/doctor/query/report`  
Shape: short keys + `{available|boolean}` + `production_publish_ready`. Pack ids use catalog aliases; `plesk.site.sync` is derived when SFTP is ready.

**Packs (docs/www)** declare: `plesk.site.sync`, `plesk.transport.sftp`, `plesk.tls_san_check`, `plesk.ssl_ensure`.  
`letsencrypt` stays **not** required — never claim public LE success.

**Control env:** `CAPABILITY_PREFLIGHT=1` (default), `CAPABILITY_PREFLIGHT_LIVE=1` (bridge/urirun when configured; else fixture). Inject `CAPABILITY_DOCTOR_PATH` or test `doctorReport` for red-path smoke.

## What was refactored

1. **uri2verify** — `capability-plan` CLI: hypervisor when `contracts/` present, else **touri registry**.
2. **platform** — live doctor normalize (`available`↔`ready`), CLI `--live`, pack/catalog SSL+SFTP alignment.
3. **core/control** — fail-closed on `/api/llm/intent` + `/api/plans/propose-from-intent`.

No dockfra / vdisplay / hypervisor wholesale changes. **No production DNS flip / no LE public success claim.**

## Test table (this continuation)

| Check | Result |
| --- | --- |
| Unit fixture ⊆ packs (doctor) | PASS |
| Unit live-shape normalize (`available` + short keys) | PASS |
| Unit red sftp → `capability_unavailable` | PASS |
| Unit pack caps ⊆ AQL (catalog + contracts) | PASS |
| Unit unmapped / URI-not-allowed → `capability_not_in_aql` | PASS |
| CLI fixture exit 0 (+ `aql_ok`) / red exit 1 | PASS |
| CLI `--aql-only` exit 0 | PASS |
| Gate mocked red → deny (`model_name: null`) | PASS |
| `POST /api/apply-grants` red doctor → 409 deny | PASS |
| Live `--via urirun` against stack | PASS when stack up (not claimed in offline CI) |
| TestQL thin wrapper | Shells CLI |
| Make / `test:meta` runs CLI doctor+AQL | Wired |

## Closed in this continuation

1. **AQL ⊆ CI** — catalog `aql.oql` / `aql.uri_processes` + actor `*.contract.aql` allows; CLI `--aql-only` / default fixture run fails on `capability_not_in_aql`. Wired into `make test-capability-preflight` / `npm run test:meta`.
2. **Apply-grants defense in depth** — `POST /api/apply-grants` denies when pack preflight would be red (`capability_unavailable`), audits `apply_grant.denied_capability`.

## Remaining gaps

1. **touri voice/markpact flakes** — unrelated; leave for tellmesh maintainers.
2. **PR9 DNS cutover / public LE** — still blocked; do not claim success.
3. **logo pack** — registered (pack + AQL + step-catalog); origin dry-run/apply still gated — **no DNS flip**.

## Polish one-liner

Pack caps ⊆ live doctor **and** ⊆ AQL (catalog→URI/OQL + contract allows); control ask/propose/`apply-grants` fail-closed on red (`capability_unavailable` / `capability_not_in_aql`) — no DNS flip, no LE public success claim.
