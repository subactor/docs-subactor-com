---
{
  "schema": "subactor.doc/v1",
  "id": "docs.architecture.adr.001-autonomy-scope",
  "version": 1,
  "status": "current",
  "updated": "2026-07-18"
}
---

# ADR-001: Zakres autonomii

- **Status:** Accepted  
- **Data:** 2026-07-18  
- **Kontekst:** [`../autonomy-recommended-solution.md`](../autonomy-recommended-solution.md) §2.1  
- **Pytanie statusowe:** „Scope dowolne zadanie vs katalog intent packs?” — **rozstrzygnięte**

## Decyzja

System autonomicznie wykonuje zadania z **wersjonowanego katalogu intent packów**
(`platform/config/intent-packs/`).

LLM może:

- wybrać istniejący pack (`pack_id`),
- wypełnić dozwolone parametry (situation slots z `situation_schema`).

LLM **nie może**:

- tworzyć URI,
- wybierać transportów,
- wybierać identyfikatorów vault,
- definiować polityk wykonania (`on_fail`, timeout, retry).

„Dowolne zadanie” = dowolna kompozycja **zatwierdzonych** zdolności, nie dowolny kod ani operacja wymyślona przez model.

### CURRENT vs TARGET

| | |
| --- | --- |
| CURRENT | Pack registry + pack-first control/agents resolvers; derived phrases/LLM/step sync; dual-run via `INTENT_PACK_DUAL_RUN` (default `shadow`) |
| TARGET | Pack jedynym SSOT wiring; zero dual-run; Planfile generowany z packa |
| LEGACY | Planfile imports ręczne; cold FALLBACK_PHRASES; dual-run `on` for mismatch debug |

## Konsekwencje

- Intent pack = SSOT celu; AQL contract = SSOT autoryzacji (pack **nie** zawiera `ALLOW`).
- Nowy cel = nowy pack + review governance (HITL), nie free-form LLM.
- Align z [`../intent-orchestration-and-fallbacks.md`](../intent-orchestration-and-fallbacks.md).
