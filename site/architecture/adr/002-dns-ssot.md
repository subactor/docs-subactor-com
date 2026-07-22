---
{
  "schema": "subactor.doc/v1",
  "id": "docs.architecture.adr.002-dns-ssot",
  "version": 1,
  "status": "current",
  "updated": "2026-07-18"
}
---

# ADR-002: DNS jako SSOT

- **Status:** Accepted  
- **Data:** 2026-07-18  
- **Kontekst:** [`../autonomy-recommended-solution.md`](../autonomy-recommended-solution.md) §2.2  
- **Pytanie statusowe:** „Gdzie żyje prawda DNS/domen?” / „GitHub Pages vs Plesk?” — **rozstrzygnięte**

## Decyzja

| Warstwa | Rola |
| --- | --- |
| Repozytorium | **desired state** DNS (pliki CNAME / deklaracje w repo) |
| Provider DNS | **observed state** (dig / API providera) |
| Connector DNS | reconcile desired ↔ observed |
| Plesk | odbiorca vhost/docroot — **nie** SSOT DNS |

Dla dokumentacji publicznej (cel migracji):

```text
docs.subactor.com → Plesk
```

### CURRENT (ops)

- Publiczny `docs.subactor.com` nadal może wskazywać **GitHub Pages** (mismatch względem intentu Plesk).
- **GitHub Pages nie jest healthy `last_known_good` dla treści na Plesku** — rollback DNS do Pages przywraca *inną* treść/origin, nie poprzedni release Plesk.
- Cutover DNS = **boundary-class** (HITL); nie część nearest milestone (mocked safe mutate).

Jeśli docs miałyby świadomie zostać na Pages, intent „docs → Plesk” musi zniknąć z publicznego DoD.

## Konsekwencje

- Migracja DNS to operacja **boundary-class** (HITL / ADR-003).
- Publiczny verify (ADR-004) obejmuje zgodność DNS z desired state.
- Rollback DNS (ADR-005) jest **osobnym** procesem od rollbacku treści release; Pages ≠ bezpieczny content rollback.
