---
{
  "schema": "subactor.doc/v1",
  "id": "docs.architecture.testing-intents-and-deploy-results",
  "version": 1,
  "status": "current",
  "updated": "2026-07-18"
}
---

# Testowanie intentów i wyników deployu

**Status:** nota architektoniczna (pointer).  
**Data:** 2026-07-18  
**Kanoniczne modele:** [`autonomy-recommended-solution.md`](./autonomy-recommended-solution.md),
[`intent-orchestration-and-fallbacks.md`](./intent-orchestration-and-fallbacks.md),
[`autonomy-ops-status-and-open-questions.md`](./autonomy-ops-status-and-open-questions.md) (D1–D11).  
**EQL:** [`subactor/eql` SUBACTOR_KORU_INTEGRATION.md](https://github.com/subactor/eql/blob/main/docs/SUBACTOR_KORU_INTEGRATION.md).  
**Koru (governance shapes):** `semcod/koru` → `docs/architecture/autonomy-determinism-refactor-plan.md`.

## Werdykt (1 akapit)

**TestQL nie zastępuje** pętli autonomy (pack → preflight → dry-run → grant → apply →
origin/public verify). Jest dobry jako **orkiestrator scenariuszy** (CLI/API/GUI/desktop)
i bramka metryk projektu ([`TESTQL_PROJECT_GATES.md`](../platform/TESTQL_PROJECT_GATES.md)).
Prawda intentów, capability, `plan_hash`/grant i fingerprint należy do **orchestrator /
connector / Control / EQL tests** — TestQL może je wywołać i asertować kody wyjścia /
JSON, nie powinien być SSOT tych kontraktów.

## Ownership (kto czym włada)

| Warstwa | Właściciel testów | Artefakt |
| --- | --- | --- |
| NL → pack id / slots | Control + pack registry unit | `ask --json` → `pack_id`, `model_name`, `status` |
| Dual-run default | Control + agents | `INTENT_PACK_DUAL_RUN=shadow` (retain until metrics); pack-only ≠ drift |
| Capability preflight | Connector doctor + pack `required_capabilities` ⊆ AQL | `status: capability_unavailable` / `preflight_failed` + CI ⊆-check |
| Dry-run / `plan_hash` / grant / jti | Orchestrator + Control apply-grants | deny codes ADR-003; grant `status: authorized` |
| Origin vs public verify / fingerprint | Connector `publish-verify` + orchestrator stages | `applied_unverified` ≠ `completed` |
| EQL determinism (`eqlHash` / `artifactHash`) | `@subactor/eql` matrix (mock); grant may echo advisory `eql_hash` | przed bind do `plan_hash` |
| GUI / IDE / health smoke | TestQL (+ Koru MCP) | `*.testql.toon.yaml` |
| Evidence bundle / import gates | TestQL project gates + Planfile | preflight/postflight suite |

## Co TestQL ma / czego brakuje

| Potrzeba | TestQL dziś | Luka |
| --- | --- | --- |
| Intent pack selection | Pośrednio: `SHELL`/`EXEC` + assert JSON | Brak natywnych kroków `INTENT_*` / pack fixtures |
| Capability preflight (np. historyczny brak ssl-ensure) | Może wołać doctor CLI | Brak deklaratywnego `EXPECT capability.X == ready` powiązanego z packiem |
| Dry-run / grant gates | Może uruchomić recipe | Brak typów asercji `plan_hash_mismatch` / grant deny |
| Origin vs public verify | HTTP assert możliwy | Brak ladder DoD (`dns`/`tls`/`fingerprint` → `applied_unverified`) |
| EQL hash ladder | Można owinąć skrypt | Brak pierwszoklasowego `EQL_DETERMINISM` |

**Rekomendacja:** rozszerzać TestQL tylko o **cienkie asserty wyjścia** (status planu,
deny code, fingerprint JSON) + scenariusze smoke; logikę kontraktów zostawić w
orchestrator/connector/EQL. Nie budować drugiego silnika deployu w TestQL.

## Minimalne macierze (CI)

### Intenty

1. Phrase → pack (bez OpenRouter).  
2. LLM fallback → ten sam pack (shadow dual-run).  
3. Złe sloty → reject (nie expand URI).  
4. Pack `required_capabilities` ⊆ AQL (CI).  
5. Preflight red → brak obietnicy sukcesu NL.

### Deploy results

1. Dry-run → `manifest` + `plan_hash`.  
2. Apply bez grant / kill → deny.  
3. Grant + matching hash → origin upload/activate.  
4. Public verify fail → `applied_unverified` (nigdy fake `ok`).  
5. Stale fingerprint → rollback lub ticket.  
6. (Opcjonalnie) EQL core/mock determinism przed grantem.

## Semcod — co przejąć algorytmicznie

- **Koru** — intent pack + capability SSOT, grant/`plan_hash`, hard verify (ADR-AD-*).  
- **Intract** — kontrakty intent na artefaktach (kod/CI/Dockerfile), nie runtime URI.  
- **EQL** — SemanticPatch allowlist + hash ladder przed apply.  
- **Regix / Pyqual / Vallm** — bramki jakości kodu, nie publish DoD.  
- **Redeploy / Rebuild** — ops recipes; weryfikacja przez connector verify, nie GUI.
