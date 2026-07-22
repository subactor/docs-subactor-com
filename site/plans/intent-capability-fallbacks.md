---
{
  "schema": "subactor.doc/v1",
  "id": "docs.plans.intent-capability-fallbacks",
  "version": 1,
  "status": "current",
  "updated": "2026-07-18"
}
---

# Design note: intent packs + recipe policy

**Status:** skrót / pointer.  
**Dokument kanoniczny:**
[`../architecture/intent-orchestration-and-fallbacks.md`](../architecture/intent-orchestration-and-fallbacks.md)

Ten plik pozostaje jako krótka nota planowa. Pełna analiza stanu stacku,
gap analysis, model generyczny (intent packs, recipe policy, connector
capabilities, rola LLM), szkice schematów, migracja, non-goals i acceptance
criteria są w dokumencie architektury powyżej.

## Werdykt (1 akapit)

Ease-of-intent blokuje **N-krotne ręczne wiring** oraz **liniowy fail-fast**
w `runTask`, nie brak OpenRouter. Fallback transportu (np. SFTP→FTP przy
`transport=auto`) należy do konektora; `optional` / `on_fail` / `try_in_order`
— do recipe + orchestratora; named intent + situation — do intent pack SSOT.
LLM wybiera pack id i sloty, nie URI DAG.

## Uzupełnienia

- Rekomendacja autonomii: [`../architecture/autonomy-recommended-solution.md`](../architecture/autonomy-recommended-solution.md)
- Roadmapa faz 0–8: [`autonomy-implementation-roadmap.md`](autonomy-implementation-roadmap.md)
- ADR: [`../architecture/adr/README.md`](../architecture/adr/README.md)
- Status ops: [`../architecture/autonomy-ops-status-and-open-questions.md`](../architecture/autonomy-ops-status-and-open-questions.md)
- Runbook CLI: [`../autonomy-cli-runbook.md`](../autonomy-cli-runbook.md)
- Przykład publish docs: [`docs-subactor-com-publish.md`](docs-subactor-com-publish.md)
