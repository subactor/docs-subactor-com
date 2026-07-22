---
{
  "schema": "subactor.doc/v1",
  "id": "docs.deployment.plesk",
  "version": 1,
  "status": "current",
  "updated": "2026-07-18"
}
---

# Plesk deployment (docs.subactor.com httpdocs)

Static docs tree in this repository (`index.html`, markdown under `platform/`,
`plans/`, `autonomy-cli-runbook.md`, …) is published to the subscription
`httpdocs/` for domain `docs.subactor.com`.

Keep remote `.htaccess` and `.well-known/` (sync does not delete them).

## Automated path

Same architecture as [`www/deployment/PLESK.md`](../../www/deployment/PLESK.md):

```text
NL / agent intent
  → Planfile ticket (uri_processes) or OQL plesk.site.sync
    → process.run / urirun-node
      → plesk://host/site/command/sync
        → SFTP (preferred) or FTP tree upload to /httpdocs
```

Recipe: `docs-httpdocs-sync.urirun.json`. Plan:
[`docs/plans/docs-subactor-com-publish.md`](../plans/docs-subactor-com-publish.md).

Source must be a directory named `docs` (or under `PLESK_SYNC_ALLOWED_SOURCES`).

```bash
cd ~/github/subactor/orchestrator
node bin/subactor-run.mjs --recipe ../docs/deployment/docs-httpdocs-sync.urirun.json
# apply: export PLESK_SYNC_APPLY=1 && … --execute
```

NL phrases live in `agents/nlp-uri-phrases.yaml` (docs-httpdocs-sync-dry-run).
