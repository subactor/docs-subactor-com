# Changelog

## 2026-07-19

- Documented constitutional continuity, digital twin isolation and generic publishing.
- Added live Plesk blockers, project-folder dry-run results and communication-channel status.
- Replaced Platform submodules with a pinned source workspace of ordinary Git checkouts and verified a full bootstrap and test run from a fresh clone.
- Added the first Autonomous Access Acquisition Loop: access lifecycle AQL, secret-free contracts, a generic resolver and Plesk auth conformance.
- Verified the Plesk auth conformance routes in the live urirun node and recorded the fail-closed `plesk_https_required` environment blocker.
- Connected the read-only Access Resolver path to live urirun discovery and auth routes using planner/Digital Twin connector candidates; live probing preserves the HTTPS blocker without triggering bootstrap.
- Added replay-safe access child grants, a grant-gated command executor and a tamper-evident access evidence outbox; live validation remained read-only and persisted a verified three-record chain.
