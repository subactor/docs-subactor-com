---
{
  "schema": "subactor.doc/v1",
  "id": "docs.architecture.autonomy-recommended-solution",
  "version": 1,
  "status": "current",
  "updated": "2026-07-18"
}
---

# Rekomendowane rozwiązanie — autonomia Subactor

**Status:** rekomendacja kanoniczna (do akceptacji ADR-ami). Bez implementacji kodu.  
**Data:** 2026-07-18  
**Baseline diagnostyczny:** commit docs [`5894906`](https://github.com/subactor/docs/commit/5894906) — snapshot statusu ops i pytań otwartych; **nie mieszać** z dużym refaktorem orchestratora.

**Powiązane:**

| Dokument | Rola |
| --- | --- |
| [`autonomy-ops-status-and-open-questions.md`](./autonomy-ops-status-and-open-questions.md) | Stan ops + pytania (z proponowanymi odpowiedziami) |
| [`intent-orchestration-and-fallbacks.md`](./intent-orchestration-and-fallbacks.md) | Model intent packs / policy / fallbacki |
| [`adr/README.md`](./adr/README.md) | Indeks ADR (decyzje Phase 0) |
| [`../plans/autonomy-implementation-roadmap.md`](../plans/autonomy-implementation-roadmap.md) | Fazy 0–8 + kolejność PR |
| [`../plans/docs-subactor-com-publish.md`](../plans/docs-subactor-com-publish.md) | Plan publish docs.subactor.com |
| [`../plans/intent-capability-fallbacks.md`](../plans/intent-capability-fallbacks.md) | Skrót intent + fallbacki |
| [`../autonomy-cli-runbook.md`](../autonomy-cli-runbook.md) | Runbook CLI |
| [EQL ↔ Subactor/Koru](https://github.com/subactor/eql/blob/main/docs/SUBACTOR_KORU_INTEGRATION.md) | Prototyp 0.2: SemanticPatch (typed) + hash ladder przed apply grant (repo `subactor/eql`) |

---

## Teza

System powinien być autonomiczny **w ramach kontrolowanego katalogu zdolności**, a nie przez pozwolenie LLM-owi na generowanie dowolnych URI i operacji.

Docelowa pętla:

```text
NL
→ (opcjonalnie) EQL: analiza + allowlistowany SemanticPatch → eqlHash / artifactHash
→ wybór named intent pack
→ walidacja parametrów i kontraktu AQL
→ rozwinięcie recipe
→ capability preflight
→ obowiązkowy dry-run
→ autoryzacja konkretnego planu
→ apply
→ verify origin
→ verify public HTTPS
→ success albo automatyczny rollback/ticket
```

EQL nie zastępuje intent packów ani signed apply grants: LLM może tylko wzbogacić semantykę; URI / transport / vault / approval pozostają poza modelem. Mapowanie `eqlHash`↔`plan_hash` i `artifactHash`↔`artifact_sha256`: [SUBACTOR_KORU_INTEGRATION.md](https://github.com/subactor/eql/blob/main/docs/SUBACTOR_KORU_INTEGRATION.md).

Obecnie pierwsza połowa tej ścieżki działa, ale sukces publikacji nie może być raportowany, ponieważ domena wskazuje GitHub Pages, certyfikat nie obejmuje `docs.subactor.com`, SFTP jest niedostępne, a FTP kończy się timeoutem.

---

## 1. Dwa strumienie prac

### Strumień A — refaktoryzacja platformy

- intent packs jako SSOT,
- deduplikację fraz, recipes i katalogów,
- policy engine w orchestratorze,
- autoryzację apply,
- retry, timeout, rollback i failure semantics,
- publiczny verify jako element Definition of Done.

### Strumień B — infrastruktura `docs.subactor.com`

- jednoznaczny wybór Plesk zamiast GitHub Pages,
- konfigurację vhostu i docrootu,
- DNS,
- TLS,
- SFTP,
- vault,
- release-based deployment.

Prace mogą iść równolegle; **produkcyjny test pełnej autonomii** dopiero po domknięciu obu.

---

## 2. Decyzje architektoniczne

Szczegóły formalne: [`adr/`](./adr/). Poniżej treść rekomendacji.

### 2.1 Zakres autonomii → [ADR-001](./adr/001-autonomy-scope.md)

> System autonomicznie wykonuje zadania z wersjonowanego katalogu intent packów. LLM może wybrać pack i wypełnić dozwolone parametry, ale nie może tworzyć URI, transportów, identyfikatorów vault ani polityk wykonania.

LLM rozpoznaje cel; deterministyczny orchestrator i connectorzy wykonują. „Dowolne zadanie” = dowolna kompozycja **zatwierdzonych** zdolności, nie dowolny kod ani operacja wymyślona przez model.

### 2.2 DNS jako SSOT → [ADR-002](./adr/002-dns-ssot.md)

- **repozytorium** przechowuje desired state DNS,
- provider DNS przechowuje observed state,
- connector DNS wykonuje reconcile,
- Plesk **nie** jest SSOT DNS — tylko odbiorca konfiguracji.

Dla obecnego przypadku:

```text
docs.subactor.com → Plesk
```

Jeśli dokumentacja miałaby zostać na GitHub Pages, należy usunąć z publicznego procesu intent „docs → Plesk”. Utrzymywanie obu prawd jest źródłem mismatchu.

### 2.3 Apply i Human-in-the-loop → [ADR-003](./adr/003-approval-hitl-model.md)

Nie rekomenduje się ręcznego zatwierdzania każdego deployu.

| Klasa operacji | Przykład | Tryb |
| --- | --- | --- |
| Read-only | DNS query, methods, health | automatyczny |
| Reversible mutate | publikacja kolejnego release | automatyczny po dry-run |
| Boundary change | nowa domena, zmiana DNS, utworzenie credential | jednorazowy HITL |
| Governance change | nowy intent pack, AQL allow, zmiana polityki | obowiązkowy review człowieka |

Po jednorazowym przygotowaniu domeny, credentiali i polityki zwykłe publikowanie dokumentacji powinno być **zero-touch**.

### 2.4 Verify jako obowiązkowa część sukcesu → [ADR-004](./adr/004-publish-definition-of-done.md)

Dla intentu typu `publish` verify nie jest opcjonalnym ostrzeżeniem:

```text
upload OK + public verify FAIL
= applied_unverified
= plan nie jest zakończony sukcesem
= rollback lub ticket
```

`ok: true` dopiero gdy:

- DNS prowadzi do oczekiwanego celu,
- TLS SAN zawiera hostname,
- HTTPS zwraca 200,
- fingerprint treści odpowiada wdrożonemu release.

### 2.5 Rollback → [ADR-005](./adr/005-rollback.md)

Release-based deploy z atomową aktywacją i automatycznym `activate(previous_release)` przy nieudanym verify.

### 2.6 Ownership sekretów → [ADR-006](./adr/006-secrets-ownership.md)

Człowiek tworzy/rotuje credential; vault = SSOT; recipe używa tylko `credential_ref`; runtime bierze krótkotrwały lease.

---

## 3. Faza 0 — punkt startowy (dokumentacja)

1. Zachować commit **`5894906`** jako osobny snapshot diagnostyczny.
2. Branch / commit ADR-ów i rekomendacji (ten dokument + roadmapa) — **bez** kodu orchestratora.
3. Wypchnąć docs (w tym `5894906`) na origin.
4. Dopiero później osobne PR-y / commity implementacyjne.

**Nie mieszać** snapshotu stanu obecnego z dużym refaktorem orchestratora.

### Duplikaty ścieżek (ryzyko PR1)

Mapa repozytorium (`project/map.toon.yaml` w monorepo Subactor — [`../../project/map.toon.yaml`](../../project/map.toon.yaml), jeśli workspace to monorepo) ujawnia powielone ścieżki, m.in.:

```text
core/services/...
platform/components/core/services/...

connectors/services/...
platform/components/connectors/services/...
```

**Rozstrzygnięte (ADR-007):** `platform/components/*` to **git submodules** (pin deployowy dla Compose), nie vendor ani generator. Kanoniczny kod = repozytoria `subactor/<name>`. Bramka driftu: `platform/scripts/check-component-drift.mjs`. Szczegóły: [`canonical-component-paths.md`](./canonical-component-paths.md).

---

## 4. Faza 1 — Intent Pack Registry jako SSOT

### 4.1 Schemat packa

Przykładowa lokalizacja:

```text
platform/config/intent-packs/
  docs-httpdocs-publish.v1.json
  www-httpdocs-publish.v1.json
  dns-record-ensure.v1.json
  https-verify.v1.json
  vault-credential-ensure.v1.json
```

Minimalny model:

```json
{
  "id": "docs-httpdocs-publish",
  "version": 1,
  "aql_model": "docs-httpdocs-sync.pl.aql",
  "phrases": [
    "opublikuj dokumentację",
    "opublikuj docs na docs.subactor.com"
  ],
  "situation_schema": {
    "source_dir": { "type": "string", "required": true },
    "domain": { "type": "string", "required": true },
    "remote_root": { "type": "string", "required": true }
  },
  "defaults": { "domain": "docs.subactor.com" },
  "recipe": "docs/deployment/docs-httpdocs-publish.v1.urirun.json",
  "required_capabilities": [
    "plesk.site.query",
    "vault.lease",
    "plesk.site.release-upload",
    "plesk.site.activate-release",
    "https.verify"
  ],
  "llm_policy": {
    "may_select": true,
    "may_fill_slots": true,
    "may_generate_uri": false,
    "may_select_transport": false,
    "may_select_vault_entry": false
  }
}
```

### 4.2 Korekta: pack **nie** definiuje `ALLOW`

Bezpieczniejszy podział:

- pack deklaruje `required_capabilities`,
- kontrakt AQL pozostaje jedynym źródłem autoryzacji,
- CI sprawdza, że wymagania packa ⊆ prawa kontraktu.

Dodanie/zmiana packa nie może pośrednio rozszerzać uprawnień.

### 4.3 Wspólny loader

Ten sam loader zasila: control LLM routes, `agents/services/nlp-uri-map.mjs`, katalog LLM, generator ticketów, walidator recipe.

Następnie usunąć (lub zostawić jako adaptery) inline:

```text
core/services/control/src/docs-sync-intent.mjs
core/services/control/src/www-sync-intent.mjs
```

### 4.4 Migracja bez big-bang

1. Dodać registry.
2. Przenieść tylko `docs` i `www`.
3. Resolver legacy i nowy równolegle; porównać `pack_id`, `model_name`, `situation`.
4. Po zgodności usunąć inline `PHRASES`.
5. CI blokujące nowe inline resolvery.

---

## 5. Faza 2 — Recipe Policy Engine

**Status (PR4):** zaimplementowane w `@subactor/orchestrator`
(`normalizeStep`, `runTask`, `orderSteps`). Domyślnie `on_fail: halt` —
istniejące recipes bez zmiany zachowania. `on_fail: rollback` uruchamia
kompensację (`compensation_step` / alias `release-rollback` → PR7).
`strategy: try_in_order` — poza zakresem PR4.

Dzisiejszy `runTask` zatrzymuje plan przy pierwszym błędzie. Rozszerzyć `UriProcess`, zachowując obecne zachowanie jako domyślne.

### 5.1 Minimalne pola policy

```json
{
  "id": "upload-release",
  "uri": "plesk://host/site/command/release-upload",
  "depends_on": ["preflight"],
  "on_fail": "rollback",
  "timeout_ms": 180000,
  "retry": {
    "max_attempts": 3,
    "backoff_ms": [1000, 3000, 9000]
  },
  "idempotency_key": "${run_id}:upload-release"
}
```

`on_fail`: `halt` | `continue` | `ticket` | `rollback`.  
Dodatkowo: `required`, `timeout_ms`, `retry`, `idempotency_key`, `compensation_step`.  
`optional: true` = wsteczny alias (`required: false`, `on_fail: continue`).

### 5.2 Semantyka zależności

- `depends_on` — uruchom tylko, gdy poprzednik **sukces**,
- `after` — uruchom po zakończeniu poprzednika **niezależnie od wyniku**.

Bez tego `on_fail: continue` jest niejednoznaczne.

### 5.3 Kolejność implementacji

1. `normalizeStep` — nowe pola — **done (PR4)**
2. Stare recipes → `on_fail: halt` — **done (domyślne)**
3. `runTask` zapisuje wynik każdego kroku — **done**
4. Retry + timeout — **done**
5. `ticket` — **done** (hook `ticketEscalator`; CLI → `development_defect` upsert / fingerprint / `blocked_by`; stub lub ops-HITL → `ticket_failed`, nigdy fake `completed`). Zob. [subactor-koru-development-bridge.md](./subactor-koru-development-bridge.md).
6. `rollback` — kompensacja release (PR7); `rolled_back` / `rollback_failed`
7. Na końcu `strategy: try_in_order`  

Nie zaczynać od skomplikowanych grup fallbacków.

---

## 6. Faza 3 — autoryzacja konkretnego apply

`PLESK_SYNC_APPLY=1` jest dobrym kill switchem, ale **nie** jedyną autoryzacją.

### 6.1 Dwupoziomowa brama — **spec Accepted (ADR-003); kod PR5a→5b**

**Poziom infrastrukturalny (dual layer):**

- Master: `AUTONOMY_MUTATIONS_ENABLED` — jawne `0` blokuje mutacje; `1` otwiera bramę.
- Domenowy: `PLESK_SYNC_APPLY=1` — istniejący kill switch syncu Plesk.

**Poziom wykonania:** Control wydaje krótko żyjący, podpisany **apply grant**
(`POST /api/apply-grants`, scope `plans:approve`) — pełna spec w ADR-003.

**Źródło klucza HMAC:** `APPLY_GRANT_HMAC_SECRET` (preferowane) albo fallback `TOKEN_PEPPER`.

### 6.2 Dry-run → immutable plan — **PR5a done**

Po dry-run apply weryfikuje `plan_hash` (pliki + target; bez `release_id` w hashu).
**CURRENT:** bridge + `urirun-connector-plesk` require
`AUTONOMY_MUTATIONS_ENABLED=1` + `PLESK_SYNC_APPLY=1` + signed `apply_grant`
+ matching `plan_hash` + single-use `jti` (replay store on mutate). Control issues grants via `POST /api/apply-grants`.
**CURRENT (PR6):** `paramiko` in `urirun-node` image build; doctor reports
`capabilities.sftp|ftp` + `production_publish_ready`; structured transport
errors; FTP fallback only with `PLESK_SYNC_ALLOW_FTP_FALLBACK=1`. Publish packs
require `plesk.transport.sftp`.

**CURRENT (PR7):** release-based deploy URIs
(`release-upload` / `release-verify` / `release-activate` / `release-current` /
`release-rollback`); activation `auto|symlink|pointer` (Plesk docroot API not
assumed); orchestrator `on_fail:rollback` → real compensation; plan stage
`rolled_back` (never fake `ok`).

**CURRENT (PR8):** DNS/TLS/HTTPS + `/__subactor_release.json` fingerprint ladder
(`plesk://host/site/command/publish-verify`); origin via Host / `--resolve`;
`200 + stale fingerprint` → `applied_unverified` (rollback or ticket, ≠ `completed`).
Staging recommendation: `docs-stage.subactor.com` (optional infra).
**Does not** switch production DNS for `docs.subactor.com`.

**Next:** PR9 cutover **only when G0–G6 green** — see [`../deployment/PR9-docs-cutover-runbook.md`](../deployment/PR9-docs-cutover-runbook.md). As of 2026-07-18 continuation: **blocked** (no docs addon on origin, SFTP paramiko_missing, cert HITL, DNS HITL). Parallel: [`../deployment/PR10-legacy-resolver-cleanup.md`](../deployment/PR10-legacy-resolver-cleanup.md).
---

## 7. Faza 4 — connector capabilities i SFTP

### 7.1 Paramiko w obrazie

`paramiko` w buildzie `urirun-node` (nie ręczny `pip install` w kontenerze). Healthcheck:

```json
{
  "capabilities": {
    "sftp": { "available": true },
    "ftp": { "available": true },
    "release_activation": true,
    "rollback": true
  }
}
```

Brak SFTP blokuje readiness produkcyjnego publish packa. FTP może zostać fallbackiem konektora, ale nie jedyną ścieżką produkcyjną.

### 7.2 Timeouty (nie stałe ~30 s)

```text
connect timeout:       15 s
single operation:     120 s
total upload budget:  180 s
attempts:               3
backoff:              1/3/9 s + jitter
```

Wartości z policy connectora / recipe — nie z LLM.

### 7.3 Strukturalne błędy

`transport_connect_timeout`, `authentication_failed`, `remote_permission_denied`, `transfer_timeout`, `partial_upload`, `remote_hash_mismatch`, `capability_unavailable` — na tej podstawie orchestrator: retry / rollback / eskalacja.

---

## 8. Faza 5 — release-based deployment i rollback

Nie syncować destrukcyjnie prosto do aktywnego `/httpdocs`.

```text
/docs.subactor.com/
  releases/
    rel_001/
    rel_002/
  current -> releases/rel_002
  previous -> releases/rel_001
```

Proces: upload → hash compare → verify release → atomowa aktywacja (symlink / docroot API / rename) → verify origin → verify public HTTPS → retencja starych release.

Rollback:

```text
activate(previous_release) → verify → status rolled_back → ticket z przyczyną
```

Jeśli Plesk nie pozwala na symlinki, connector udostępnia `release-upload` /
`release-activate` / `release-rollback` i ukrywa szczegóły przed recipe
(`PLESK_RELEASE_ACTIVATION=auto` → symlink, potem pointer JSON). Plesk REST
„set docroot” **nie** jest założone na stagingu — potwierdzić na hoście przed
wymuszeniem `symlink`.

---

## 9. Faza 6 — vault i sekrety

- Człowiek tworzy i rotuje credential.
- Vault = jedyny SSOT sekretu.
- Recipe operuje wyłącznie logicznym `credential_ref`.
- Runtime pobiera krótkotrwały lease; unieważnienie po runie.

Brak credential → `needs_human` + ticket „bootstrap credential” — **bez** publikacji i **bez** pytania LLM o hasło / sekretów w ticketach.

---

## 10. Faza 7 — migracja `docs.subactor.com` na Plesk

1. **Zachować rollback DNS** — zapisać `docs.subactor.com → subactor.github.io` jako poprzednią wersję desired state.
2. **Vhost** — addon domain, osobny docroot (nie główny `/httpdocs` `subactor.com`), release root.
3. **Transport** — obraz z paramiko, konto SFTP, vault, lease test, prawa tylko w katalogu docs.
4. **Origin deploy przed cutoverem** — plik `/__subactor_release.json` z `release_id`, `git_commit`, `content_sha256`; verify origin (Host header / staging / `curl --resolve`).
5. **TTL ↓ + DNS** — osobny intent boundary-class `dns-record-reconcile`; sprawdzić authoritative + public resolvers; brak starego CNAME do Pages.
6. **Certyfikat** — DNS-01 przed cutoverem jeśli możliwe; inaczej LE po DNS; verify SAN.
7. **Publiczny verify** — `GET https://docs.subactor.com/__subactor_release.json` + porównanie fingerprintów.
8. **Automatyczny rollback** — przy nieudanym TLS/verify: DNS z powrotem na Pages i/lub poprzedni release; ticket; status `rolled_back`, nie `ok`.

---

## 11. Faza 8 — model stanów wykonania

```text
proposed → resolved → preflight_passed → dry_run_passed → authorized
→ applying → applied → origin_verified → publicly_verified → completed
```

Błędy: `preflight_failed`, `dry_run_failed`, `apply_failed`, `applied_unverified`, `rollback_started`, `rolled_back`, `needs_human`, `failed`.

API **nie** redukuje tego do jednego boolean `ok`.

Przykład końcowej odpowiedzi NL:

```json
{
  "status": "completed",
  "intent": "docs-httpdocs-publish",
  "release_id": "rel_...",
  "public_url": "https://docs.subactor.com/",
  "artifact_sha256": "...",
  "dns_target_verified": true,
  "tls_verified": true,
  "content_verified": true
}
```

---

## 12. Macierz testów

### Intent registry

- fraza działa w control i agents,
- usunięcie frazy usuwa ją z obu ścieżek,
- LLM zwraca tylko istniejący `pack_id`,
- nie może zwrócić własnego URI,
- błędne situation slots są odrzucane.

### Policy engine

- legacy recipe nadal halt on fail,
- `on_fail: continue` / `ticket` / timeout / retry / rollback / pomijanie dependency po fail wymaganego kroku.

### Bezpieczeństwo

- apply bez master kill switch / bez grantu / z innym plan hash / inną domeną / po wygaśnięciu — blokowane,
- sekrety nie w logach ani ticketach.

### Connector

- SFTP działa; brak SFTP w readiness; FTP tylko wg policy; partial upload; remote hash mismatch; idempotency_key.

### E2E

```text
NL → pack → ticket → preflight → dry-run → grant → upload release
→ activate → DNS/TLS/public verify → completed
```

Awarie: brak credential, timeout, zły docroot, DNS→Pages, brak SAN, 200 ze starą treścią, zerwany upload, błąd po aktywacji → rollback.

---

## 13. Kolejność PR-ów

Pełna tabela: [`../plans/autonomy-implementation-roadmap.md`](../plans/autonomy-implementation-roadmap.md#kolejność-pr).

| PR | Zakres |
| -- | --- |
| 0 | Commit `5894906`, ADR-y i stan początkowy |
| 1 | Kanoniczne ścieżki + kontrola kopii `platform/components` — **done** (ADR-007) |
| 2 | Intent pack schema, registry, migracja docs/www — **done** (dual-run) |
| 3 | Deduplikacja phrase map, katalogu LLM, step-catalog — **done** (pack SSOT + sync script; dual-run retained) |
| 4 | `on_fail`, retry, timeout, statusy kroków — **done** (`@subactor/orchestrator`) |
| 5a | Immutable manifest + plan_hash |
| 5b | Signed apply grants (ADR-003) |
| 5c | Grant replay (`jti`) — **done** |
| 6 | Paramiko/SFTP, capability readiness, błędy strukturalne |
| 7 | Release upload, activation, rollback |
| 8 | DNS/TLS preflight + public content fingerprint verify — **done** |
| 9 | Migracja `docs.subactor.com` Pages → Plesk — **next** |
| 10 | Usunięcie legacy resolverów i starego wiring |

Każdy PR odwracalny; kompatybilność ze starymi recipes do końca migracji.

---

## Końcowy werdykt — cztery fundamenty

Pełnej autonomii nie zapewni samo dodanie `paramiko`, zwiększenie timeoutu ani `PLESK_SYNC_APPLY=1`. To tylko naprawi pojedynczy transport.

1. **Intent pack jako SSOT celu.**
2. **Policy engine jako SSOT przebiegu i awarii.**
3. **Connector jako właściciel transportu i rollbacku technicznego.**
4. **Verify jako obowiązkowy warunek sukcesu.**

Dla `docs.subactor.com` pierwszym reprezentatywnym sukcesem powinien być autonomiczny, wersjonowany deploy na Plesk z obowiązkowym dry-runem, signed apply grantem, SFTP, atomową aktywacją release, publicznym HTTPS fingerprint verify i automatycznym rollbackiem. Dopiero taki przebieg spełnia kryteria **D1–D11** w [`autonomy-ops-status-and-open-questions.md`](./autonomy-ops-status-and-open-questions.md).
