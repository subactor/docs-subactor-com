---
{
  "schema": "subactor.doc/v1",
  "id": "docs.architecture.adr.005-rollback",
  "version": 1,
  "status": "current",
  "updated": "2026-07-18"
}
---

# ADR-005: Rollback i failure semantics

- **Status:** Accepted  
- **Data:** 2026-07-18  
- **Kontekst:** [`../autonomy-recommended-solution.md`](../autonomy-recommended-solution.md) §5, §8, §11  
- **Pytanie statusowe:** „Rollback / failure semantics?” — **rozstrzygnięte**

## Decyzja

1. **Deploy release-based** — nie destrukcyjny sync do aktywnego `/httpdocs`; aktywacja atomowa (`current` / `previous`) — **CURRENT (PR7)**.
2. **Recipe policy** (`on_fail`): `halt` (domyślne, legacy) \| `continue` \| `ticket` \| `rollback`.
3. **Dwa osobne procesy rollbacku:**
   - **Treść / release:** `activate(previous_release)` → verify (PR8 publish-verify) → `rolled_back` (+ ticket).
   - **DNS / boundary:** przywrócenie poprzedniego *desired* DNS (HITL) — **nie** mylić z content rollback.
4. Stany planu bogatsze niż boolean: m.in. `applied_unverified`, `rolled_back`, `rollback_failed`, `needs_human`, `ticket_failed`.

### CURRENT (orchestrator PR7)

- `on_fail: rollback` wykonuje kompensację: alias `release-rollback` →
  `plesk://host/site/command/release-rollback` (lub `compensationRunner` /
  `compensation_uri`).
- Sukces kompensacji → `stage: rolled_back`, **`ok: false`** (nie udawać completed).
- Brak targetu/runnera lub wyczerpane retry (max 3, backoff 0/1s/3s) → `rollback_failed`.
- Aktywacja: `PLESK_RELEASE_ACTIVATION=auto|symlink|pointer` (Plesk docroot API nie zakładane).

### `rollback_failed`

Gdy compensation niedostępna, connector niedostępny, lub verify po rollbacku fail:

1. Ustaw `rollback_failed` (plan **nie** `completed`, **nie** ciche `ok: true`).
2. **Retry content rollback:** max **2** dodatkowe próby `activate(previous)` z backoff (1s / 3s) — tylko gdy release API dostępne.
3. Po wyczerpaniu → **critical ticket** (`needs_human`, label `rollback_failed`) z `release_id` / `previous_release` / ostatnim błędem — **bez sekretów**.
4. DNS rollback **nie** jest automatyczną konsekwencją `rollback_failed` treści.

### GitHub Pages vs last_known_good

**GitHub Pages nie jest healthy `last_known_good`** dla treści wdrożonej na Plesk:

- DNS→Pages przywraca *inny* origin (często starą/inną treść).
- Do czasu cutoveru na Plesku: traktować Pages wyłącznie jako możliwy **DNS emergency** (boundary HITL), nie jako content rollback. Fingerprint verify (PR8) jest dostępny jako capability; live cutover = PR9.

## Konsekwencje

- Connector = właściciel transportu i rollbacku technicznego (PR7).
- Orchestrator = semantyka `on_fail` / zależności; nie wolno oznaczać planu `completed` po nieudanym ticket/rollback.
