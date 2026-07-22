---
{
  "schema": "subactor.doc/v1",
  "id": "docs.architecture.adr.readme",
  "version": 1,
  "status": "current",
  "updated": "2026-07-18"
}
---

# ADR — indeks decyzji autonomii

**Cel:** krótkie ADR-y zaakceptowane jako SSOT decyzji (Faza 0 + luki grant/rollback/vault).  
**Pełna rekomendacja:** [`../autonomy-recommended-solution.md`](../autonomy-recommended-solution.md)  
**Status implementacji / evidence:** [`../autonomy-implementation-status.md`](../autonomy-implementation-status.md)  
**Roadmapa:** [`../../plans/autonomy-implementation-roadmap.md`](../../plans/autonomy-implementation-roadmap.md)  
**Baseline:** commit docs `5894906` (status ops + pytania otwarte).

| ADR | Temat | Status |
| --- | --- | --- |
| [001](./001-autonomy-scope.md) | Zakres autonomii (katalog zdolności) | **Accepted** |
| [002](./002-dns-ssot.md) | DNS jako SSOT | **Accepted** |
| [003](./003-approval-hitl-model.md) | Apply / HITL + **grant crypto spec** | **Accepted** |
| [004](./004-publish-definition-of-done.md) | Verify / DoD publikacji | **Accepted** |
| [005](./005-rollback.md) | Rollback i failure semantics | **Accepted** |
| [006](./006-secrets-ownership.md) | Ownership sekretów / vault | **Accepted** |
| [007](./007-canonical-component-paths.md) | Kanoniczne ścieżki vs `platform/components` | **Accepted** |

Akceptacja ADR-001–006 zamyka odpowiadające pytania w
[`../autonomy-ops-status-and-open-questions.md`](../autonomy-ops-status-and-open-questions.md) §5
(sekcja governance/DNS/verify/secrets/scope/rollback).

**Uwaga:** Accepted ≠ zaimplementowane end-to-end. Evidence PR1–PR4:
[`../autonomy-implementation-status.md`](../autonomy-implementation-status.md).
