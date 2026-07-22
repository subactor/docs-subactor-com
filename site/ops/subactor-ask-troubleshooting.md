---
{
  "schema": "subactor.doc/v1",
  "id": "docs.ops.subactor-ask-troubleshooting",
  "version": 1,
  "status": "current",
  "updated": "2026-07-18"
}
---

# Subactor ask — troubleshooting (CLI, origin, Koru)

**Status:** operacyjny (P1-4)  
**Audience:** founder CLI, ops, Koru `development` queue  
**Powiązane:** [assessment 2026-07-18](../architecture/koru-subactor-autonomy-assessment-2026-07-18.md), [most development_defect](../architecture/subactor-koru-development-bridge.md)

Krótki przewodnik po flagach `subactor ask`, typowych pułapkach `remote_path`, weryfikacji origin bez publicznego DNS oraz klasyfikacji awarii (Koru `development_defect` vs HITL/ops).

---

## 1. Tabela flag CLI

Implementacja: `platform/bin/subactor` (`cmd_ask`).

| Polecenie | Co robi | Apply produkcyjny | Uwagi |
| --- | --- | --- | --- |
| `subactor ask "…"` | LLM intent → plan w Planfile; **bez** auto-wykonania (resolve / dry intent) | **Nie** | W TTY pyta o zatwierdzenie planu + dry-run; poza TTY plan zostaje bez wykonania |
| `subactor ask "…" --execute` | Zatwierdza plan + **dry-run** orchestratora (`subactor-run`) | **Nie** (apply pominięty) | W TTY po dry-run osobna brama produkcji (`confirm_yn_interactive`) |
| `subactor ask "…" --execute --yes` | Jak wyżej, nieinteraktywnie (plan + dry-run) | **Nie** | `--yes` omija pytania o plan i retry dry-run; **nie** włącza apply |
| `subactor ask "…" --execute --apply --yes` | Pełna ścieżka foundera: dry-run → **apply-grant** → **mutate lease** → apply | **Tak** (gdy grant + env OK) | `--apply` implikuje `--execute`; wymagane poza TTY razem z `--yes` |

### Co `--yes` pomija (a czego nie)

| Etap | `--yes` / `--non-interactive` | TTY bez `--yes` |
| --- | --- | --- |
| Zatwierdzenie planu + start dry-run | Tak (gdy podano `--execute`) | Pytanie domyślnie **tak** |
| Retry po nieudanym dry-run | Tak | Pytanie |
| Decyzja o apply produkcyjnym | **Nie** — wymaga `--apply` | Osobna brama interaktywna (niezależna od `--yes`) |
| Retry po nieudanym apply | Tak (gdy `--apply --yes`) | Pytanie |
| Wydanie apply-grant | Automatyczne po decyzji apply | Po potwierdzeniu apply |

Poza TTY bez `--execute`: plan pozostaje bez wykonania (komunikat: użyj `--execute [--yes]`).

---

## 2. Po edycji `step-catalog.json`

**hr-control** przeładowuje `platform/config/step-catalog.json` z dysku przy każdym użyciu katalogu (sprawdzenie `mtime`) — restart nie jest wymagany dla nowych planów po zapisie pliku.
Regresja reload-on-read (P0-4): `npm run test:core` w repozytorium platform (w tym `step-catalog-loader.test.mjs`).


W starszych wersjach (przed P0-4) katalog był trzymany w pamięci; po zmianie pliku restart był konieczny:

```bash
cd /home/tom/github/subactor/platform
docker compose restart hr-control
```

**Incydent (logo):** pierwszy apply trafił na `/httpdocs` zamiast `/logo.subactor.com`, bo hr-control miał **stale** step-catalog. Po restarcie (lub po wdrożeniu reload-on-read) pack `logo-httpdocs-publish` wiąże poprawny `remote_path`.

---

## 3. Pułapki `remote_path` (intent packi)

| Domena / pack | Oczekiwany docroot | Pułapka |
| --- | --- | --- |
| `logo.subactor.com` (`logo-httpdocs-publish`) | `/logo.subactor.com` | ≠ `/httpdocs`; subdomena ma osobny docroot w Plesk |
| `subactor.com` (`www-httpdocs-publish`) | `/httpdocs` | Kanoniczny www |
| `docs-stage.subactor.com` (`docs-httpdocs-publish`) | `/docs-stage.subactor.com/current` | Resolver `registry.mjs`, nie domyślny prod path |
| `docs.subactor.com` | pack nadal może domyślnie wskazywać `/httpdocs` | **Celowo bez apply** (PR9 / DNS HITL); staging na docs-stage |

Błąd ścieżki to **konfiguracja / cache**, nie sam transport SFTP. Sprawdź pack JSON + restart hr-control przed apply.

---

## 4. Weryfikacja origin (gdy publiczne DNS ≠ Plesk)

Gdy Cloudflare / GitHub Pages wskazuje inaczej niż origin Plesk (`217.160.250.222`), testuj origin bez cutover:

```bash
curl -k -sS -o /dev/null -w '%{http_code}\n' \
  --resolve logo.subactor.com:443:217.160.250.222 \
  https://logo.subactor.com/

curl -k -sS -o /dev/null -w '%{http_code}\n' \
  --resolve docs-stage.subactor.com:443:217.160.250.222 \
  https://docs-stage.subactor.com/
```

Oczekiwany wynik po udanym apply: **200** na origin. Publiczny DNS może nadal pokazywać stary front — to nie jest automatyczny dowód błędu syncu.

---

## 5. Koru `development_defect` vs HITL / ops

| Klasa | Przykładowe kody | Kolejka Koru | Działanie |
| --- | --- | --- | --- |
| **Strukturalny / kod** | `invalid_runner_response`, `plan_hash_mismatch`, `capability_unavailable`, `connector_not_implemented` | `development` → szablon repair | Patch 1–2 plików, test regresji, **bez** Plesk/DNS |
| **Operacyjny / HITL** | `dns_mismatch`, `credential_*`, `apply_grant_*` (w tym `apply_grant_plan_hash_mismatch`), `applied_unverified` | **Poza** `development` | Grant, DNS, credentials, ręczna weryfikacja |

**Ważne rozróżnienie `plan_hash_mismatch`:**

- **`plan_hash_mismatch`** (recomputed dry-run manifest ≠ bound `plan_hash`) → **defekt kodu/manifestu** → `development_defect` (P1-3).
- **`apply_grant_plan_hash_mismatch`** (JWT grant vs plan) → **ops/HITL**, nie ticket development.

Klasyfikacja: `orchestrator/src/development-defect.mjs` (`STRUCTURAL_DEFECT_CODES` vs `OPERATIONAL_BOUNDARY_CODES`).

### Powiązane dokumenty

| Temat | Link |
| --- | --- |
| Most Subactor → Koru | [subactor-koru-development-bridge.md](../architecture/subactor-koru-development-bridge.md) |
| Ocena autonomii (Part A/B) | [koru-subactor-autonomy-assessment-2026-07-18.md](../architecture/koru-subactor-autonomy-assessment-2026-07-18.md) |
| Szablon ticketu repair (Koru) | [`subactor-development-repair-template.md`](https://github.com/semcod/koru/blob/main/docs/subactor-development-repair-template.md) (lokalnie: `~/github/semcod/koru/docs/subactor-development-repair-template.md`) |
| Konfiguracja Koru w repo docs | [`koru.yaml`](../koru.yaml) |

Po zamknięciu SELFDEV-*: resume źródłowego ticketu (`subactor-run --ticket PLF-…`) — nadal wymaga preflight → AQL → dry-run → grant → Y/n.

### Smoke test mostu (kontrakt, bez Plesk / LLM)

Lokalna regresja Subactor → Koru (klasyfikacja, upsert, szablon repair):

```bash
# Subactor (orchestrator)
cd /home/tom/github/subactor/orchestrator && npm test

# Koru (cross-repo + render szablonu)
cd /home/tom/github/semcod/koru
SUBACTOR_ROOT=/home/tom/github/subactor \
  python -m pytest tests/test_subactor_bridge_e2e.py tests/test_subactor_development_bridge.py -q
```

Pokrycie: `plan_hash_mismatch` → `development_defect` + `blocked_by`; `apply_grant_*` → brak ticketu development; render `subactor-development-repair` (`executor.kind=llm`, `promotion_mode=branch`, `declared_files`, `verify_command` / `acceptance_criteria` z `acceptance_tests`). Realny patch LLM i live queue intake pozostają poza tym smoke.

### Real-LLM repair (Koru queue, izolowany pilot)

Jednorazowa weryfikacja pełnej ścieżki patch (OpenRouter, worktree, branch `koru/run-*`) **bez** Plesk/DNS/`subactor ask --apply`:

```bash
cd /home/tom/github/semcod/koru
source .env                    # OPENROUTER_API_KEY, LLM_MODEL — nie commituj sekretów
export KORU_LLM_SHELL_FALLBACK=0
python scripts/subactor-development-repair-pilot.py
# opcjonalnie: --keep /tmp/koru-subactor-pilot-fixture
```

Skrypt renderuje szablon `subactor-development-repair` (`executor.kind=llm`,
`inputs.llm_model` z `LLM_MODEL`), importuje ticket do tymczasowego repo git i
odpala `koru --queue` raz. Po imporcie planfile Koru **hydratuje** politykę
patch (`patch_mode`, `promotion_mode=branch`, …) z pakietowego szablonu;
`verify_command` może zostać w `acceptance_criteria`. Dla ticketów bridge
zwykle **nie** trzeba ustawiać `KORU_QUEUE_*` — wystarczą klucze LLM w `.env`.

Dokumentacja szablonu: [`subactor-development-repair-template.md`](https://github.com/semcod/koru/blob/main/docs/subactor-development-repair-template.md) (lokalnie: `~/github/semcod/koru/docs/subactor-development-repair-template.md`).

---

## 6. Czego nie robić

1. **Nie** wymyślaj wolnych URI/connectorów przez LLM — używaj intent packów, recipe i allowlist (`subactor-run` stub NL).
2. **Nie** rób cichego cutover DNS / Cloudflare bez HITL i runbooka (np. PR9 docs.prod).
3. **Nie** trzymaj na stałe `AUTONOMY_MUTATIONS_ENABLED=1` / omijaj grantów — apply wymaga signed grant + lease + env gates (`PLESK_SYNC_APPLY`).
4. **Nie** kieruj Koru na Plesk/SFTP/DNS — tylko naprawa kodu po `development_defect`.
5. **Nie** ignoruj restartu hr-control po sync `step-catalog.json`.

---

## 7. Szybkie komendy (lab)

```bash
readlink -f ~/.local/bin/subactor
cd /home/tom/github/subactor

# Tylko intent + plan
subactor ask "opublikuj logo na logo.subactor.com"

# Dry-run (bez apply)
subactor ask "opublikuj logo na logo.subactor.com" --execute --yes

# Pełny łańcuch produkcyjny (nieinteraktywnie)
subactor ask "opublikuj logo na logo.subactor.com" --execute --apply --yes

# Po zmianie step-catalog
cd platform && docker compose restart hr-control
```

Więcej kontekstu runbook: [autonomy-cli-runbook.md](../autonomy-cli-runbook.md).
