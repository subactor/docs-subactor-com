---
{
  "schema": "subactor.doc/v1",
  "id": "docs.architecture.koru-subactor-autonomy-assessment-2026-07-18",
  "version": 1,
  "status": "current",
  "updated": "2026-07-18"
}
---

# Ocena autonomii Koru ↔ Subactor ask — raport 2026-07-18

**Data:** 2026-07-18  
**Zakres:** (A) weryfikacja publikacji domen przez `subactor ask` bez redeploy; (B) ocena implementacji Koru względem wytycznych „Werdykt” (transakcyjny workspace, bezpieczeństwo dirty tree, manifest, retry, promotion).  
**Repozytoria:** `/home/tom/github/subactor`, `/home/tom/github/semcod/koru`  
**Metoda:** inspekcja kodu + lekka weryfikacja filesystem (bez live apply / bez cutover DNS).

---

## 2. Werdykt skrótowy

Subactor ask działa jako founder CLI z poprawną ścieżką symlinku; pełny apply produkcyjny wymaga **`--execute --apply --yes`**, a zmiany `step-catalog.json` wymagają restartu **`hr-control`**. Publikacje logo, www i docs-stage na origin Plesk (200 przez `curl --resolve`) są potwierdzone; `docs.subactor.com` celowo bez apply. Koru **częściowo spełnia** wytyczne transakcyjnego patchowania: worktree, seed dirty, manifest drift, retry (max 1) i kody `PatchOutcome` są zaimplementowane w warstwie queue, ale ADR-005 pozostaje „Proposed”, `promotion_mode=commit` nie commituje po apply, a manifest nie jest trwale wiązany z każdym runem jak Subactor `plan_hash`. Most `development_defect` Subactor→Koru jest gotowy; Koru nie powinien dotykać Plesk/DNS — tylko naprawiać kod po błędach strukturalnych z ask.

---

## 3. Raport: subactor ask / publikacje domen (Part A)

### 3.1 CLI i środowisko

| Element | Wartość | Dowód |
| --- | --- | --- |
| CLI użytkownika | `~/.local/bin/subactor` → `platform/bin/subactor` | symlink na dysku (2026-07-17) |
| Katalog roboczy | `/home/tom/github/subactor` | `WORKSPACE_DIR` w `platform/bin/subactor` |
| Control | `http://127.0.0.1:8091` (domyślnie) | `platform/bin/subactor` |

### 3.2 Semantyka flag ask

- **`--execute`** — approve planu + dry-run orchestratora; **nie** wykonuje apply produkcyjnego w trybie nieinteraktywnym.
- **`--apply`** — implikuje `--execute` **oraz** osobną autoryzację produkcji (grant + lease); wymagane razem z **`--yes`** / `--non-interactive` poza TTY.
- **`--execute --yes` bez `--apply`** — kończy na dry-run; apply pomijany (log: „apply pominięty decyzją użytkownika”).

Implementacja: `platform/bin/subactor` (`cmd_ask`, linie ~354–563).

### 3.3 step-catalog i hr-control

Po edycji `platform/config/step-catalog.json` usługa **hr-control** trzyma katalog kroków w pamięci. Wymagany restart:

```bash
cd /home/tom/github/subactor/platform
docker compose restart hr-control
```

**Lekcja (logo):** pierwszy apply logo trafił na `/httpdocs` zamiast `/logo.subactor.com` przez **stale in-memory step-catalog**; po restarcie hr-control pack `logo-httpdocs-publish` wiąże `remote_path=/logo.subactor.com` (intent pack, nie `/httpdocs`).

### 3.4 Intent packi — remote_path

| Pack | Plik | `remote_path` (defaults / resolver) |
| --- | --- | --- |
| logo-httpdocs-publish | `platform/config/intent-packs/logo-httpdocs-publish.v1.json` | `/logo.subactor.com` |
| www-httpdocs-publish | `platform/config/intent-packs/www-httpdocs-publish.v1.json` | `/httpdocs` |
| docs-httpdocs-publish | `platform/config/intent-packs/docs-httpdocs-publish.v1.json` | prod `/httpdocs`; **docs-stage** via `registry.mjs` → `/docs-stage.subactor.com/current` |

Subdomena logo utworzona w Plesk; docroot ≠ `/httpdocs`.

### 3.5 Tabela wyników (2026-07-18)

| domain | pack | remote_path | apply | origin HTTP |
| --- | --- | --- | --- | --- |
| logo.subactor.com | logo-httpdocs-publish | /logo.subactor.com | applied 73 files PLF-407 | 200 via `curl -k --resolve logo.subactor.com:443:217.160.250.222` |
| subactor.com | www-httpdocs-publish | /httpdocs | applied 23 files PLF-404 | 200 |
| docs-stage.subactor.com | docs-httpdocs-publish | /docs-stage.subactor.com/current | applied 27 files PLF-409 | 200 |
| docs.subactor.com | *(skipped apply)* | pack nadal domyślnie `/httpdocs` | **celowo nie apply** | — |

**DNS/Cloudflare:** brak cutover dla logo (możliwy nadal GitHub Pages publicznie); testy origin używają `--resolve` na `217.160.250.222`.

### 3.6 Działające komendy (lab, bez ponownego apply)

```bash
# Ścieżka CLI
readlink -f ~/.local/bin/subactor
cd /home/tom/github/subactor

# Dry-run (bez apply)
subactor ask "opublikuj logo na logo.subactor.com" --execute --yes

# Pełny łańcuch: dry-run → grant → apply (nieinteraktywnie)
subactor ask "opublikuj logo na logo.subactor.com" --execute --apply --yes

# Po zmianie step-catalog
cd platform && docker compose restart hr-control

# Origin probe (logo, bez publicznego DNS)
curl -k -sS -o /dev/null -w '%{http_code}\n' \
  --resolve logo.subactor.com:443:217.160.250.222 \
  https://logo.subactor.com/

# www / docs-stage (publiczne lub origin wg stanu DNS)
curl -sS -o /dev/null -w '%{http_code}\n' https://subactor.com/
curl -sS -o /dev/null -w '%{http_code}\n' https://docs-stage.subactor.com/
```

### 3.7 Lekcje operacyjne

1. **Trzy bramki apply:** `--apply`, signed grant (`plan_hash` + `jti`), env kill switches (`AUTONOMY_MUTATIONS_ENABLED`, `PLESK_SYNC_APPLY`).
2. **Pack SSOT ≠ runtime cache** — restart hr-control po sync step-catalog.
3. **Logo ≠ httpdocs** — osobny docroot subdomeny; błąd ścieżki = błąd konfiguracji, nie transportu.
4. **docs.subactor.com** — świadomie poza apply (PR9 / DNS HITL); staging na docs-stage.

---

## 4. Ocena Koru względem założeń (checklist)

Legenda: ✅ spełnione · ⚠️ częściowo · ❌ brak / niezgodne

| # | Założenie | Status | Dowód (ścieżka) |
| --- | --- | --- | --- |
| 1 | **Milestone:** reply → normalize diff → worktree → seed dirty → apply → verify → promote → cleanup | ⚠️ | `patch_transaction.py`, `workspace.py` (`staging_worktree` kopiuje dirty seed), `diff_repair.py`; promote = ponowny `git apply` na main po verify w worktree + `manifest_drift`; ADR `docs/architecture/adr/005-transactional-workspace.md` nadal **Proposed** |
| 2 | **P0:** direct mode nie czyści dirty przez `git checkout --`; odmowa lub snapshot | ✅ | `workspace.py` (`dirty_paths`, komentarz L131–137); `patch_transaction.py` L191–205 → `UNSAFE_DIRTY_WORKSPACE`; testy `test_planfile_queue.py` |
| 3 | **P0:** promotion conflict — fingerprint przed promote, drift HEAD/plików | ✅ | `manifest.py` (`manifest_drift`, SHA256 plików); `patch_transaction.py` L181–190 → `PROMOTION_CONFLICT`; testy drift/promotion conflict |
| 4 | **Strukturalne kody** (`PatchFailure` / `PatchTransactionResult`) vs `assertIn` | ⚠️ | `PatchOutcome` + `PatchApplyResult` w `patch_mode.py` / `workspace.py`; runner używa `[{code}]` (`runner.py` L581–582); **brak** typu `PatchTransactionResult`; część testów nadal `assertIn` na message |
| 5 | **Retry loop** na orchestratorze, max 1, tabela retryable | ✅ | `patch_retry.py` (`patch_retry_budget` default 1, `KORU_QUEUE_PATCH_RETRIES`); `runner.py` woła `apply_patch_with_retry`, nie `_apply_proposed_patch` bezpośrednio; retryable: `no_patch_emitted`, `patch_does_not_apply`; nie-retry: verify failures |
| 6 | **Immutable run manifest** (plan_hash analogue) | ⚠️ | `manifest.py` (`manifest_hash`, `patch_sha256`, `base_files`); wiązanie w retry (`patch_retry.py` L74–87); **brak** obowiązkowego zapisu manifestu na dysk dla trybu `apply` (tylko `artifact` → `.koru/runs/<id>/evidence.json`) |
| 7 | **Promotion modes:** apply / branch / commit / artifact | ⚠️ | `patch_mode.py` L265–291; `apply`+`branch`+`artifact` w `patch_transaction.py`; **`commit`**: tylko odmowa dirty repo (L147–155), **brak** `git commit` po udanym apply na main |
| 8 | **Pilot Subactor:** orchestrator-only, branch, 1–2 pliki, bez Plesk/live | ⚠️ | Most `development_defect`: `subactor/docs/architecture/subactor-koru-development-bridge.md`, `orchestrator/src/development-defect.mjs`, `eql/.../failure-bridge.ts`; `subactor/docs/koru.yaml` zabrania DNS/Plesk; brak dedykowanego „pilot ticket template” w Koru pod subactor checkout |
| 9 | **Rozmiar runner / patch_mode i miejsce logiki** | ✅ | `runner.py` **635** linii; `patch_mode.py` **334**; logika transakcji w `patch_transaction.py` (**309**), retry w `patch_retry.py` (**129**), git w `workspace.py` (**280**) — zgodne z celem „cienki runner” |
| 10 | **Index health** (opcjonalnie) | ✅ | `project/map.toon.yaml`: ~1054 modułów, **cycles:0**, CC̄≈3.7; hotspoty poza queue (vdisplay, scan) |

### Przepływ patch (skrót)

```text
LLM stdout → extract_unified_diff (diff_repair)
  → [artifact?] zapis .koru/runs/
  → [worktree?] staging_worktree + seed dirty files
  → baseline verify → git apply --check → apply → verify
  → [branch?] commit_worktree na koru/run-<id>
  → [apply?] manifest_drift → git apply na main checkout
  → cleanup worktree (finally)
Retry (≤1): patch_retry.apply_patch_with_retry → manifest pin → build_retry_prompt
```

---

## 5. Czy wskazówki z Werdyktu są nadal aktualne?

**Status: częściowo aktualne, częściowo zrealizowane w kodzie, częściowo superseded przez dokument planu.**

| Obszar Werdyktu | Ocena |
| --- | --- |
| Transakcyjny workspace + dirty safety + promotion conflict | **Zrealizowane w queue** (2026-07-18 kod); Werdykt nadal aktualny jako **spec**, ADR-005 jeszcze nie „Accepted” |
| PatchOutcome zamiast string matching | **Mostly done** w runtime; testy i ticket notes czasem po message |
| Retry max 1 na orchestratorze | **Done** — zgodne z Werdyktem |
| Immutable manifest on disk dla każdego runu | **Nadal aktualna luka** — Subactor ma `plan_hash` + grant; Koru manifest jest in-memory / artifact-only |
| promotion_mode=commit | **Werdykt nadal aktualny** — tryb nie dokończony |
| Pilot bez Plesk | **Nadal aktualny** — Subactor governance (ADR-003) i bridge docs to potwierdzają |
| Szeroki refactor autonomous.py / capability SSOT | **Superseded / przesunięte** przez `docs/architecture/autonomy-determinism-refactor-plan.md` (wielo-PR, borrow governance z Subactor) |

**Wniosek:** Werdykt nie jest przestarzały jako lista P0 bezpieczeństwa, ale **implementacja queue wyprzedziła status ADR**. Kolejne PR-y powinny: Accept ADR-005, trwały manifest, dokończyć `commit`, spiąć z Subactor `development_defect`.

---

## 6. Synergia Koru ↔ Subactor ask

### Jak powinno działać (docelowe)

```text
subactor ask "…" [--execute [--apply --yes]]
  → intent pack + AQL + dry-run + plan_hash
  → [apply] grant + verify origin
  → błąd strukturalny (invalid_runner_response, plan_hash_mismatch jako bug, capability_unimplemented w kodzie)
      → development_defect (fingerprint dedupe)
      → kolejka Koru `development`
      → Koru patch_mode (worktree, 1–2 pliki, regression test)
      → subactor-improvement resolve → resume PLF-xxx (dry-run + grant + Y/n)
  → błąd operacyjny (dns_mismatch, apply_grant_*, credential_*)
      → HITL, NIE kolejka development
```

### Co już jest

- Klasyfikacja: `orchestrator/src/development-defect.mjs` (`STRUCTURAL_DEFECT_CODES` vs `OPERATIONAL_BOUNDARY_CODES`).
- EQL bridge: `eql/src/integrations/koru/failure-bridge.ts`.
- Koru config: `subactor/docs/koru.yaml` — queue `development`, jawny zakaz prod mutation.
- CLI hook: `record_improvement_failure` w `platform/bin/subactor`.

### Czego brakuje pod `subactor ask`

1. **Automatyczny fingerprint** dla typowych awarii ask (np. stale step-catalog → ticket na `platform/config/step-catalog.json` + test sync).
2. **Korelacja plan_hash ↔ Koru manifest_hash** w evidence development ticket.
3. **Szablon ticketu** „repair ask capability plan” z `acceptance_tests` wskazującymi na `subactor ask "…" --execute --yes` (dry-run green).
4. **Zero coupling** Koru → Plesk URI / SFTP — tylko kod subactor/orchestrator/connectors.

Koru **może** wspierać użytkownika ask, o ile ogranicza się do naprawy **planów i kodu**, nie do „wolnego deployu”.

---

## 7. Rekomendowana kolejność prac (P0 / P1 / P2)

### P0 — wspólny bezpieczeństwo i spójność

| # | Zadanie | Projekt | Uzasadnienie |
| --- | --- | --- | --- |
| P0-1 | Accept ADR-005 + dokument „queue patch = transactional workspace v1” | Koru | Zamyka lukę status vs kod |
| P0-2 | Trwały zapis manifestu (`.planfile/.koru/runs/<run_id>/manifest.json`) przy każdym patch run | Koru | Parity z Subactor `plan_hash` / audyt |
| P0-3 | Dokończyć `promotion_mode=commit` (commit po verify) lub usunąć z API | Koru | Werdykt / honest API |
| P0-4 | Test regresji: hr-control reload step-catalog (bez silent stale path) | Subactor | Powtórka incydentu logo |
| P0-5 | Jedna ścieżka E2E: structural failure ask → development_defect → Koru patch → resume dry-run | Subactor + Koru | Dowód mostu |

### P1 — pilot użytkownika ask

| # | Zadanie | Projekt |
| --- | --- | --- |
| P1-1 | Ticket template SELFDEV-* z polami `discovered_in`, `plan_hash`, `acceptance_tests` | subactor-improvement |
| P1-2 | Koru tickets: `patch_mode: true`, `promotion_mode: branch`, 1–2 `files`, verify = `task quality:regix:local` lub targeted pytest | Koru / planfile |
| P1-3 | Mapowanie `plan_hash_mismatch` → development gdy wskazuje bug manifestu, nie ops | Subactor orchestrator |
| P1-4 | Dokument „ask troubleshooting” z tabelą flag CLI | Subactor docs |

### P2 — dojrzałość architektury

| # | Zadanie | Projekt |
| --- | --- | --- |
| P2-1 | PR-y z `autonomy-determinism-refactor-plan.md` (capability SSOT, ExecutionPlan) | Koru |
| P2-2 | PR9 DNS cutover docs.subactor.com (HITL) | Subactor |
| P2-3 | Metryki dual-run intent pack → wyłączenie shadow | Subactor |
| P2-4 | `PatchTransactionResult` jako alias/ wrapper publiczny + testy tylko po `code` | Koru |

---

## 8. Świadomie poza zakresem

- Publiczny **DNS cutover** (logo, docs.prod) i Cloudflare.
- **Live apply** przez ten raport (brak redeploy / brak `subactor ask --apply`).
- **Koru bezpośrednio na Plesk** (SFTP, sync, grant bypass).
- Szeroki refactor `autonomous.py` / vdisplay hotspot w jednym tickecie.
- Commit tego raportu do git (dokument lokalny unless requested).

---

## Załącznik: pliki kluczowe

| Temat | Ścieżka |
| --- | --- |
| Subactor CLI | `/home/tom/github/subactor/platform/bin/subactor` |
| Bridge doc | `/home/tom/github/subactor/docs/architecture/subactor-koru-development-bridge.md` |
| Logo pack | `/home/tom/github/subactor/platform/config/intent-packs/logo-httpdocs-publish.v1.json` |
| Koru patch transaction | `/home/tom/github/semcod/koru/src/koru/queue/patch_transaction.py` |
| Koru retry | `/home/tom/github/semcod/koru/src/koru/queue/patch_retry.py` |
| Koru manifest | `/home/tom/github/semcod/koru/src/koru/queue/manifest.py` |
| Koru ADR workspace | `/home/tom/github/semcod/koru/docs/architecture/adr/005-transactional-workspace.md` |
| Koru refactor plan | `/home/tom/github/semcod/koru/docs/architecture/autonomy-determinism-refactor-plan.md` |
