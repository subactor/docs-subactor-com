---
{
  "schema": "subactor.doc/v1",
  "id": "docs.plans.docs-subactor-com-publish",
  "version": 1,
  "status": "current",
  "updated": "2026-07-18"
}
---

# Plan: docs → docs.subactor.com (NL → publish)

Goal: make this founder CLI prompt work end-to-end:

```bash
subactor ask "stwórz dokumentację w folderze docs i opublikuj na docs.subactor.com"
```

Mirror of the proven **www → subactor.com** path (`www/deployment/PLESK.md`).

## Steps (implementation order)

| # | Work | Status target |
| --- | --- | --- |
| 1 | Allowlist basename `docs` in bridge planner + urirun-connector-plesk `_source_allowed` | required |
| 2 | Recipe `docs/deployment/docs-httpdocs-sync.urirun.json` + Planfile import | required |
| 3 | NL phrases in `agents/nlp-uri-phrases.yaml` + deterministic control intent (`docs-sync-intent`) | required |
| 4 | AQL model `docs-httpdocs-sync.pl.aql` + llm-organization-intents + step-catalog + bot ALLOW MODEL | required |
| 5 | Minimal public landing `docs/index.html` (do not wipe existing markdown) | required |
| 6 | Domain on Plesk + DNS (today CNAME → GitHub Pages; Plesk needs A/CNAME → subscription) | ops |
| 7 | Dry-run sync → apply with `PLESK_SYNC_APPLY=1` + founder token | test |
| 8 | Verify `https://docs.subactor.com/` (TLS SAN must include docs host) | verify |

## Pipeline

```text
NL (subactor ask)
  → deterministic phrase / intent model docs-httpdocs-sync.pl.aql
  → Planfile ticket uri_processes (methods → dry-run → apply)
  → AQL gate (project-operator / founder bypass)
  → urirun plesk://host/site/command/sync
  → SFTP/FTP upload to docs.subactor.com /httpdocs
```

OpenRouter / llm-gateway: **intent only**. Upload is connector + vault + apply env gate.

## Safety

- Default dry-run (`apply=false`)
- Live write only with `PLESK_SYNC_APPLY=1`
- Source allowlist: `www` **or** `docs` (or `PLESK_SYNC_ALLOWED_SOURCES`)
- No secrets in tickets / recipes / this plan

## Operator commands

```bash
# Intent only
subactor ask "stwórz dokumentację w folderze docs i opublikuj na docs.subactor.com" --json

# Deterministic recipe (dry-run)
cd ~/github/subactor/orchestrator
node bin/subactor-run.mjs --recipe ../docs/deployment/docs-httpdocs-sync.urirun.json

# Live apply (urirun-node host)
export PLESK_SYNC_APPLY=1
node bin/subactor-run.mjs --recipe ../docs/deployment/docs-httpdocs-sync.urirun.json --execute
```

## DNS note

As of this plan, `docs.subactor.com` resolves to GitHub Pages (`*.github.io`).
Plesk publish writes the subscription `httpdocs` for that domain name; public HTTPS
only shows Plesk content after DNS (and TLS cert) point at the Plesk host
(same pattern as `subactor.com` → `217.160.250.222`).

## Test results (2026-07-18)

| Check | Result |
| --- | --- |
| `subactor ask "…" --json` | OK — `docs-httpdocs-sync.pl.aql`, deterministic phrase map |
| `subactor ask "…"` | OK — ticket `PLF-352`, plan proposed |
| Recipe dry-run (`docs-httpdocs-sync.urirun.json`) | OK — methods + sync plan (~10 files), FTP available |
| Live apply (`PLESK_SYNC_APPLY=1`) | FAIL — urirun subprocess **timeout 30s** on FTP upload (vault/FTP path) |
| `https://docs.subactor.com/` | Serves **GitHub Pages** (Jekyll); TLS SAN mismatch on strict verify |

Ops follow-ups: add `docs.subactor.com` on Plesk + DNS/TLS; raise urirun exec timeout or fix FTP/SFTP (paramiko) for apply; prefer addon docroot `/docs.subactor.com` so primary `/httpdocs` is not overwritten.

## Powiązane (rekomendacja autonomii)

- Kanoniczna rekomendacja: [`../architecture/autonomy-recommended-solution.md`](../architecture/autonomy-recommended-solution.md)
- Roadmapa (faza 7 migracji + PR 9): [`autonomy-implementation-roadmap.md`](./autonomy-implementation-roadmap.md)
- Status + pytania: [`../architecture/autonomy-ops-status-and-open-questions.md`](../architecture/autonomy-ops-status-and-open-questions.md)
- ADR DNS / DoD / rollback: [`../architecture/adr/README.md`](../architecture/adr/README.md)