---
{
  "schema": "subactor.doc/v1",
  "id": "docs.architecture.adr.003-approval-hitl-model",
  "version": 1,
  "status": "current",
  "updated": "2026-07-18"
}
---

# ADR-003: Model zatwierdzania i Human-in-the-loop

- **Status:** Accepted  
- **Data:** 2026-07-18  
- **Kontekst:** [`../autonomy-recommended-solution.md`](../autonomy-recommended-solution.md) §2.3, §6  
- **Pytanie statusowe:** „Kto zatwierdza apply?” / „HITL when?” / „Dry-run zawsze przed apply?” — **rozstrzygnięte**  
- **Implementacja:** roadmap **PR5a** (manifest) → **PR5b** (grant) → **PR5c** (replay); nie shipować grant-required bez tego ADR.

## Decyzja

**Nie** zatwierdzać ręcznie każdego deployu. Podział klas operacji:

| Klasa | Przykład | Tryb |
| --- | --- | --- |
| Read-only | DNS query, methods, health | automatyczny |
| Reversible mutate | publikacja kolejnego release | automatyczny **po obowiązkowym dry-run** + grant |
| Boundary change | nowa domena, DNS, utworzenie credential | **jednorazowy HITL** |
| Governance change | nowy intent pack, AQL allow, polityka | **obowiązkowy review człowieka** |

Po bootstrapie domeny/credentials/polityki publikacja docs = **zero-touch** (w środowisku z zielonym preflightem).

### Bramki apply (fail-closed)

1. **Master kill switch:** `AUTONOMY_MUTATIONS_ENABLED` — jawne `0` blokuje; `1` otwiera master.
2. **Domain kill switch:** `PLESK_SYNC_APPLY=1` dla syncu Plesk (legacy ops gate).
3. **Signed apply grant** związany z bindingami poniżej.
4. **Immutable manifest** z dry-run — apply weryfikuje `plan_hash`, nie przelicza swobodnie listy plików.

Founder bypass (`SUBACTOR_ADMIN_TOKEN`) **nie** zastępuje grantu w modelu produkcyjnym.

---

## Specyfikacja apply grant (krytyczna)

### Signer / issuer / audience

| Pole | Wartość |
| --- | --- |
| **Signer / issuer** | Control service (`hr-control`) — endpoint `POST /api/apply-grants` |
| **Wymagany scope** | `plans:approve` (founder/admin / approver) |
| **Audience (verifier)** | Bridge planner + `urirun-connector-plesk` (oraz przyszłe mutate connectors) |
| **Algorytm** | `HMAC-SHA256` (`alg: "HS256"`), signature **base64url** (bez paddingu `=`) |
| **Canonical payload** | JSON object z **ustałą kolejnością kluczy** (nie alfabetyczną): `run_id`, `actor`, `intent_pack`, `plan_hash`, `artifact_sha256`, `target`, `expires_at`, `risk_class` — wartości string, `JSON.stringify` bez spacji (`separators (',', ':')` w Pythonie) |

### Klucz

| | |
| --- | --- |
| **Preferowany** | `APPLY_GRANT_HMAC_SECRET` (vault lub env noda; nigdy w ticketach/logach) |
| **Fallback lab** | `TOKEN_PEPPER` (tylko gdy primary unset; ten sam sekret na control + verifier) |
| **Brak sekretu** | **fail-closed:** `apply_grant_secret_missing` — brak mutacji |
| **Rotacja** | Wprowadzić nowy sekret jako `APPLY_GRANT_HMAC_SECRET_NEXT`, dual-verify (current \|\| next) przez ≤ TTL max, potem drop old; audit `apply_grant.key_rotated` |
| **Verifier unavailable** | Brak sekretu lub błąd crypto → **deny** (nie allow-open) |

### Claims (binding)

Wymagane: `run_id`, `actor`, `intent_pack`, `plan_hash`, `artifact_sha256`, `target`, `expires_at`, `risk_class`.

Opcjonalne w ADR (pełny replay = **PR5c**): `jti`, `iat`.
**PR5b wydaje `jti` w tokenie**; store użytych `jti` pozostaje PR5c.

`risk_class` ∈ `read_only` \| `reversible` \| `boundary` \| `governance`. Mutate sync = zwykle `reversible`.

### TTL / clock skew

| | |
| --- | --- |
| **Default TTL** | 15 minut |
| **Max TTL** | 60 minut (control odrzuca dłuższe) |
| **Clock skew** | verifier: `expires_at` ważny jeśli `now <= expires_at + 60s` (skew); reject jeśli `expires_at < now - 60s` już przy issue |
| **Expired** | `apply_grant_expired` |

### Replay (PR5c) — **done**

- Każdy grant ma `jti` (uuid/base64url).
- Verifier (mutate path) utrzymuje short-TTL store użytych `jti` (memory lub plik `APPLY_GRANT_JTI_STORE`) ≥ grant `expires_at` + skew.
- Ponowne użycie → `apply_grant_replay` (zero drugiej mutacji).
- Bridge planner: verify bez consume; `urirun-connector-plesk`: consume po `plan_hash`, przed upload.

### Immutable manifest (PR5a)

- Dry-run zwraca `manifest` + `plan_hash`.
- `plan_hash` = SHA-256 hex kanonicznego JSON nad `{source_sha256, files[{path,sha256}], deletes, target}` — **bez** `release_id` (metadane).
- Apply z podanym `plan_hash` ≠ recomputed → `plan_hash_mismatch`.

### Deny codes (kontrakt)

`plesk_sync_apply_required` \| `autonomy_mutations_disabled` \| `apply_grant_required` \| `apply_grant_secret_missing` \| `apply_grant_signature_invalid` \| `apply_grant_expired` \| `apply_grant_plan_hash_mismatch` \| `apply_grant_target_mismatch` \| `apply_grant_artifact_mismatch` \| `apply_grant_replay` \| `plan_hash_mismatch`

Sekrety **nigdy** w grant body, ticketach, recipe, NL logs.

## Konsekwencje

- Bot bez grantu i bez otwartego kill switcha nigdy nie mutuje.
- Ship kodu: najpierw PR5a (manifest), potem PR5b (verify grant), potem PR5c (jti replay).
