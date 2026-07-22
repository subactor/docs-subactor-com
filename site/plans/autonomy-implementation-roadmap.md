---
{
  "schema": "subactor.doc/v1",
  "id": "docs.plans.autonomy-implementation-roadmap",
  "version": 1,
  "status": "current",
  "updated": "2026-07-18"
}
---

# Roadmapa implementacji autonomii

**Status:** plan wdrożenia (Fazy 0–8 + kolejność PR).  
**Evidence CURRENT/TARGET:** [`../architecture/autonomy-implementation-status.md`](../architecture/autonomy-implementation-status.md)  
**Rekomendacja kanoniczna:** [`../architecture/autonomy-recommended-solution.md`](../architecture/autonomy-recommended-solution.md)  
**ADR:** [`../architecture/adr/README.md`](../architecture/adr/README.md) (**001–007 Accepted**)  
**Status ops:** [`../architecture/autonomy-ops-status-and-open-questions.md`](../architecture/autonomy-ops-status-and-open-questions.md)  
**Intent/fallbacki:** [`../architecture/intent-orchestration-and-fallbacks.md`](../architecture/intent-orchestration-and-fallbacks.md)  
**Publish docs:** [`docs-subactor-com-publish.md`](./docs-subactor-com-publish.md)  
**EQL prototype 0.2:** [`subactor/eql` integration note](https://github.com/subactor/eql/blob/main/docs/SUBACTOR_KORU_INTEGRATION.md) — typed SemanticPatch + determinism gates before apply grant (mock CI; no live OpenRouter in CI).

**Baseline diagnostyczny:** docs commit `5894906` — nie mieszać z refaktorem orchestratora.

**Nearest milestone:** safe autonomous mutation w **mocked** environment — nie production cutover DNS.

Dwa strumienie (równolegle, E2E dopiero po obu):

- **A** — platforma (packs, policy, grants, verify DoD)
- **B** — infrastruktura docs.subactor.com (DNS, TLS, SFTP, vault, releases)

---

## Faza 0 — dokumentacja i ADR

- Zachować `5894906` jako snapshot diagnostyczny.
- ADR-001–007 **Accepted** (grant crypto w ADR-003; rollback_failed / Pages caveat w ADR-005; lease/revoke w ADR-006).
- Evidence PR1–PR4: [`../architecture/autonomy-implementation-status.md`](../architecture/autonomy-implementation-status.md).
- Uwaga PR1: **rozstrzygnięte** — `platform/components/*` = submoduły (pin deploy);
  kanoniczny kod w `subactor/<name>`; drift: `platform/scripts/check-component-drift.mjs`
  ([`../architecture/canonical-component-paths.md`](../architecture/canonical-component-paths.md), ADR-007).

## Faza 1 — Intent Pack Registry

- Schemat packa w `platform/config/intent-packs/`.
- Pack **bez** `ALLOW`; tylko `required_capabilities` + CI ⊆ AQL.
- Wspólny loader (control, agents, LLM catalog, ticket generator, recipe validator).
- Migracja docs/www bez big-bang; dual-run legacy vs registry.
- **Unit 2–3 (verified / partial):** frazy docs/www SSOT w packach; control **pack-first**;
  `agents/nlp-uri-phrases.yaml` generowany; LLM fields sync z `situation_schema`;
  step-catalog annotated + `sync-intent-pack-derived.mjs --check`. Dual-run do PR10.
  Planfile imports **nie** przepisywane automatycznie (**PR3 = partial**).

## Faza 2 — Recipe Policy Engine

- Pola: `on_fail`, `depends_on` / `after`, `timeout_ms`, `retry`, `idempotency_key`, `compensation_step`.
- Domyślnie legacy `halt`; dopiero później `try_in_order`.
- **Unit 4 (partial / hardening):** policy core w `@subactor/orchestrator` — **done**.
  Retry tylko dla kroków idempotent/query (enforce). `on_fail:ticket` bez stub-success.
  `on_fail:rollback` → `rolled_back` / `rollback_failed` (PR7). Compensation/`try_in_order` → PR7+/later.

## Faza 3 — Apply grants (split)

- **PR5a** — immutable manifest + canonical JSON + `plan_hash` (no free re-scan) — **done**
  (`urirun-connector-plesk` + bridge `plesk-httpdocs-sync`; deny `plan_hash_mismatch`).
- **PR5b** — signed apply grant per ADR-003 (HMAC, issuer control, fail-closed) — **done**.
- **PR5c** — `jti` replay store — **done** (consume on mutate; `APPLY_GRANT_JTI_STORE` optional).
- Dual kill switch: `AUTONOMY_MUTATIONS_ENABLED` + `PLESK_SYNC_APPLY`.
- Evidence: [`../architecture/autonomy-implementation-status.md`](../architecture/autonomy-implementation-status.md).

## Faza 4 — Connector / SFTP

- **PR6 done:** Paramiko w obrazie urirun-node; capability readiness w doctor;
  timeouty 15/120/180; błędy strukturalne; FTP fallback tylko z
  `PLESK_SYNC_ALLOW_FTP_FALLBACK=1`; brak SFTP → `production_publish_ready=false`.

## Faza 5 — Release deploy + rollback

- `releases/` + `current`/`previous`; `release-upload` / `activate` / `rollback` — **PR7 done**.
  Strategy: `PLESK_RELEASE_ACTIVATION=auto|symlink|pointer` (Plesk docroot API not assumed).
  Orchestrator `on_fail:rollback` → `release-rollback`; stage `rolled_back` / `rollback_failed`.

## Faza 6 — Vault

- Ownership wg ADR-006; brak credential → `needs_human`.

## Faza 7 — Migracja docs.subactor.com → Plesk

- Desired DNS w repo (`docs/deployment/dns-desired-state.json`); vhost; SFTP; origin deploy z `__subactor_release.json`; **PR8 verify ladder done** (mocked + origin/`--resolve`); cutover DNS = **PR9**; TLS; public verify; auto-rollback.
- Staging recommendation: `docs-stage.subactor.com` (infra optional — Host header / `--resolve` works without it).
- Pages ≠ healthy content last_known_good (ADR-002/005).

## Faza 8 — Lifecycle stanów

- Pełna maszyna stanów planu; odpowiedź NL ze statusem bogatszym niż `ok`.
- **PR8:** `applied_unverified` when verify enabled and fingerprint/DNS/TLS fail (≠ `completed`).

Szczegóły każdej fazy: dokument rekomendacji §3–§11.

---

## Kolejność PR {#kolejność-pr}

| PR | Zakres |
| -- | --- |
| 0 | Commit `5894906`, ADR-y i stan początkowy — **ADRs Accepted** |
| 1 | Kanoniczne ścieżki + drift gate — **verified** |
| 2 | Intent pack schema/registry — **verified** (dual-run) |
| 3 | Phrase/LLM/step dedupe onto packs — **partial** (Planfile still separate) |
| 4 | Recipe policy core — **partial** (ticket hardening; rollback wired in PR7) |
| 5a | Immutable manifest + plan_hash binding — **done** |
| 5b | Signed apply grants (ADR-003) — **done** |
| 5c | Grant replay (`jti`) — **done** |
| 6 | Paramiko/SFTP, capability readiness i strukturalne błędy — **done** |
| 7 | Release upload, activation i rollback — **done** |
| 8 | DNS/TLS preflight oraz public content fingerprint verify — **done** |
| 9 | Migracja `docs.subactor.com` z Pages do Pleska — **prep / blocked** (G1 addon+SFTP, G2 cert, G6 HITL; **no DNS flip**) |
| 10 | Usunięcie legacy resolverów — **started** (`INTENT_PACK_DUAL_RUN` shadow/off; cold fallbacks retained) |

Każdy PR odwracalny; kompatybilność ze starymi recipes do końca migracji.

**Uwaga projektowa:** w tym repo docs shipping = commit (+ push), bez otwierania GitHub PR — tabela „PR” oznacza **jednostki zmian implementacyjnych** w monorepo Subactor.

---

## Macierz testów (skrót)

Pełna lista: rekomendacja §12. Evidence: [`../architecture/autonomy-implementation-status.md`](../architecture/autonomy-implementation-status.md).

## Werdykt

Cztery fundamenty: intent pack SSOT · policy engine · connector (transport+rollback) · verify obowiązkowy.  
Reprezentatywny sukces produkcyjny: autonomiczny release docs na Plesk — **po** PR9 cutover.  
Najbliższy kamień: odblokować **PR9 G1** (addon docs + SFTP/paramiko + `__subactor_release.json` na origin); DNS cutover tylko przy G0–G6 green. Równolegle **PR10** dual-run shadow/off — [`PR10-legacy-resolver-cleanup.md`](../deployment/PR10-legacy-resolver-cleanup.md).
