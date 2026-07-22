---
{
  "schema": "subactor.doc/v1",
  "id": "docs.architecture.adr.006-secrets-ownership",
  "version": 1,
  "status": "current",
  "updated": "2026-07-18"
}
---

# ADR-006: Ownership sekretów

- **Status:** Accepted  
- **Data:** 2026-07-18  
- **Kontekst:** [`../autonomy-recommended-solution.md`](../autonomy-recommended-solution.md) §9  
- **Pytanie statusowe:** „Ownership sekretów?” / „Ensure SFTP → vault?” — **rozstrzygnięte**

## Decyzja

| Rola | Odpowiedzialność |
| --- | --- |
| Człowiek | tworzy i rotuje credential (bootstrap / boundary HITL) |
| Vault | jedyny **SSOT** sekretu |
| Recipe | tylko logiczny `credential_ref` / vault entry id |
| Runtime | krótkotrwały lease; revoke po runie / crash path |

Zachowanie:

```text
credential istnieje → lease test → kontynuuj automatycznie
credential nie istnieje → needs_human + ticket „bootstrap credential” → bez publikacji
```

System **nie** pyta LLM o hasło i **nie** zapisuje sekretów w ticketach, recipe ani logach NL.

### Lease / revoke / audit (wymagania)

| Temat | Reguła |
| --- | --- |
| **Lease TTL** | Domyślnie ≤ **5 minut**; nie dłuższy niż budżet kroku recipe; odnawialny tylko w tym samym `run_id` |
| **Revoke on success** | Po zakończeniu upload/kroku — revoke lease (best effort) |
| **Revoke on crash** | Process/signal handler + TTL expiry jako backstop; urirun-node nie trzyma hasła poza scope wywołania |
| **Audit** | Loguj `vault.lease`, `vault.revoke`, `entry_id`, `run_id`, `actor` — **nigdy** wartości sekretu |
| **Staging vs prod** | Osobne vault entry id / origin (np. `plesk-sftp-staging` vs `plesk-sftp`); zakaz cross-env ref w prod recipes |
| **Expiry mid-upload** | Jeśli lease wygasa w trakcie: przerwij upload → `needs_human` lub retry z **nowym** lease + ten sam `plan_hash` grant; częściowy upload **nie** aktywuje release |

### CURRENT

- Lab: vault via browser-agent + env tokens; `.env` nie zastępuje modelu prod.
- Apply grant HMAC: `APPLY_GRANT_HMAC_SECRET` / `TOKEN_PEPPER` — osobny od SFTP password (ADR-003).

## Konsekwencje

- Ensure SFTP/FTP → vault jest krokiem preflight (capability), nie częścią free-form LLM.
- Kryterium D9 statusu pozostaje twarde.
