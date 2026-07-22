---
{
  "schema": "subactor.doc/v1",
  "id": "docs.architecture.canonical-component-paths",
  "version": 1,
  "status": "current",
  "updated": "2026-07-18"
}
---

# Canonical component paths vs `platform/components/`

**Status:** decided (Workstream 1 / roadmap unit 1)  
**Date:** 2026-07-18  
**Related:** [`adr/007-canonical-component-paths.md`](./adr/007-canonical-component-paths.md),
[`../plans/autonomy-implementation-roadmap.md`](../plans/autonomy-implementation-roadmap.md),
[`../../platform/docs/SUBACTOR_MULTI_REPO_MIGRATION.md`](../../platform/docs/SUBACTOR_MULTI_REPO_MIGRATION.md)

## Decision

| Role | Path | Nature |
| --- | --- | --- |
| **Canonical source** | Sibling repos: `core/`, `connectors/`, `agents/`, … (remotes `github.com/subactor/<name>`) | Edit and commit here (or in an equivalent clone of the same remote) |
| **Deploy pin** | `platform/components/<name>/` | **Git submodules** of those remotes — not vendors, not generated mirrors, not independent copies |
| **Runtime build context** | `platform/docker-compose.yml` → `dockerfile: components/...` | Images are built from the **submodule pin**, not from umbrella sibling checkouts |

`platform/components/*` are recorded in `platform/.gitmodules`. Docker Compose and Dockerfiles under `platform/` always reference `components/…`.

## Edit rule

1. Change code in the **component repository** (umbrella `core/` / `connectors/` / … **or** the submodule working tree — same remote).
2. Push the component commit to `origin`.
3. Update the **platform** submodule pointer (`git -C platform add components/<name>` + commit) so deploy matches.
4. Do **not** maintain long-lived divergent patches only in one checkout.

Umbrella siblings (`/home/tom/github/subactor/core`) and submodule checkouts (`platform/components/core`) may both exist for convenience. Content for service trees should match; tooling-only files (`.koru`, `.planfile`, local `koru.yaml`) may differ and are ignored by drift checks.

## What runs in production / local compose

| Concern | Canonical edit location | What compose runs |
| --- | --- | --- |
| Control / LLM routes (`llm.mjs`, `*-sync-intent.mjs`) | `core` | `platform/components/core` (pinned) |
| Connectors / Plesk bridge | `connectors` | `platform/components/connectors` (pinned) |
| Intent pack **data** | `platform/config/intent-packs/` | Mounted as `/app/config` (platform-owned) |

Intent pack JSON lives only under `platform/config/` (assembly SSOT). Resolvers that consume packs live in component code (`core`, optionally `agents` adapters).

## Drift detection

```bash
# from platform/
node scripts/check-component-drift.mjs          # core + connectors (default gate)
node scripts/check-component-drift.mjs --all    # every submodule
make check-component-drift
```

The script:

- confirms listed `platform/components/*` are gitlinks / submodules;
- when an umbrella sibling checkout exists, compares **service source trees** (excludes `.git`, `node_modules`, `.koru`, `.planfile`, …);
- exits non-zero on content drift so CI / local gates catch “fixed in sibling, forgot submodule”.

SHA inequality alone is a **warning** (parallel commits with identical trees are possible); **file content** drift is the hard failure.

Default scope is `core` + `connectors` (LLM routes + bridge). `--all` also reports known historical drift in other components (e.g. agents phrase files present only in the umbrella sibling) without blocking the default gate until those are reconciled.

## Out of scope

- Mass deletion of umbrella siblings or forced single-checkout layout.
- Rewriting Docker contexts to point at `../core` (keeps platform self-contained with recursive clone).
