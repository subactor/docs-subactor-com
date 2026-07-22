---
{
  "schema": "subactor.doc/v1",
  "id": "docs.architecture.adr.004-publish-definition-of-done",
  "version": 1,
  "status": "current",
  "updated": "2026-07-18"
}
---

# ADR-004: Definition of Done publikacji (verify)

- **Status:** Accepted  
- **Data:** 2026-07-18  
- **Kontekst:** [`../autonomy-recommended-solution.md`](../autonomy-recommended-solution.md) §2.4  
- **Pytanie statusowe:** „Monitoring / verify obowiązkowe?” — **rozstrzygnięte**  
- **Kryteria statusowe:** D6, D7 w [`../autonomy-ops-status-and-open-questions.md`](../autonomy-ops-status-and-open-questions.md)

## Decyzja

Dla intentu typu `publish` verify **nie** jest opcjonalnym ostrzeżeniem.

```text
upload OK + public verify FAIL
= applied_unverified
≠ sukces planu
→ rollback treści (ADR-005) lub ticket
```

`ok: true` / `status: completed` dopiero gdy łącznie:

1. DNS prowadzi do oczekiwanego celu (ADR-002) — observed == desired,
2. TLS SAN zawiera hostname,
3. HTTPS zwraca 200,
4. fingerprint treści = wdrożony release (np. `/__subactor_release.json`).

### CURRENT vs TARGET

| | |
| --- | --- |
| CURRENT (PR8) | Verify ladder + marker + orchestrator `applied_unverified`; public HTTPS docs may nadal być Pages |
| TARGET | Pełny DoD D1–D9 na Plesk origin po cutoverze |
| Nearest milestone | PR9 blocked on G1/G2/G6 (no DNS flip); PR10 dual-run shadow started |

## Konsekwencje

- API nie redukuje lifecycle do jednego boolean.
- Kryteria D1–D11 statusu pozostają mierzalne; D6/D7 stają się twardym DoD produkcyjnym.
- Nie deklarować sukcesu live HTTPS publish, gdy DNS nadal wskazuje GitHub Pages.
