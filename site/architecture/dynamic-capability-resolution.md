---
{
  "schema": "subactor.doc/v1",
  "id": "docs.architecture.dynamic-capability-resolution",
  "version": 1,
  "status": "current",
  "updated": "2026-07-18"
}
---

# Dynamiczne rozwiązywanie capability — specyfika projektu i mapa DSL

**Data:** 2026-07-18
**Cel dokumentu:** pokazać, jak `subactor ask "<NL>"` dochodzi od zdania do realnej operacji Plesk, **gdzie siedzi hardkod per-domena**, a gdzie mechanika jest już generyczna — żeby publish (i podobne operacje) działał dynamicznie na dynamicznych danych, bez pisania recepty na każdą domenę. Zawiera wskazówki „gdzie szukać podobnych rozwiązań".
**Powiązane:** [`autonomous-anomaly-loop-roadmap.md`](./autonomous-anomaly-loop-roadmap.md), [`intent-orchestration-and-fallbacks.md`](./intent-orchestration-and-fallbacks.md), [`subactor-koru-development-bridge.md`](./subactor-koru-development-bridge.md)

---

## 0. Obserwacja, która uruchomiła ten dokument

Trzy realne domeny, trzy różne wyniki `subactor ask`:

| Zapytanie | Wynik | Przyczyna |
|---|---|---|
| „zsynchronizuj dokumentację do plesk httpdocs dla **docs**.subactor.com" | ✓ `resolved` → dry-run 62 pliki | ma resolver parafraz |
| „opublikuj folder logo pod **logo**.subactor.com **w** plesk" | ✗ `capability_unavailable` | fraza nie pasuje (`w`≠`na`) |
| „sync logo to logo.subactor.com" (dokładna zarejestrowana fraza) | ✓ `preflight_passed` | dosłowne dopasowanie |
| „opublikuj stronę **identity** pod identity.subactor.com" | ✗ `capability_unavailable` | brak jakiegokolwiek artefaktu |

**Wniosek kluczowy:** to nie jest brak capability. Warstwa wykonawcza (URI Plesk, docroot, sync) jest **w pełni generyczna**. Blokada siedzi wyłącznie w **warstwie rozpoznania intentu** — kruchym, dosłownym dopasowaniu fraz i imperatywnym `if/else` per-domena. Logo działa dokładną frazą, a pada parafrazą „w plesk" vs „na plesk".

---

## 1. Pipeline i katalog DSL (co jest dynamiczne, co statyczne)

Rdzeń: `NL → intent → plan (AQL→OQL) → deploy (urirun) → verify → NL`
Orkiestracja: `orchestrator/src/pipeline.mjs` (etapy `resolvePlan → aql → oql → dispatchUrirun`).

| # | DSL / mechanizm | Rozszerzenie / lokalizacja parsera | Rola w pipeline | Parametryzacja |
|---|---|---|---|---|
| 1 | **AQL** (Autonomy Query Language) | `.pl.aql` → `runtime/src/aql-runtime.mjs:23` | Tablica decyzyjna: `WEJŚCIE` (typy) + `DECYZJA/GDY/WTEDY/MODUŁY` → wariant + kroki planu. Auth SSOT etapu plan. | **Dynamiczna** — typed inputs + warunki `GDY` nad kontekstem sytuacji |
| 2 | **OQL** (Operation Query Language) | `.oql` → emiter `runtime/src/compiler.mjs:13`, resolver `orchestrator/src/resolve-plan.mjs:46` | Konkretny plan kroków `STEP id op target WITH k=v EXPECT ... SAVE`. Między AQL a urirun. | **Dynamiczna** — `WITH` + interpolacja `$path`/`${path}` (`renderValue`) |
| 3 | **Intent packs** | `platform/config/intent-packs/*.v1.json` → loader `registry.mjs:44` | NL → kanoniczny URI; wiąże `aql_model` + `recipe` + `step_module`. `situation_schema` + `defaults`. `llm_policy.may_generate_uri=false` (LLM **nie** wymyśla URI). | **Dynamiczny schema** (sloty) — ale *frazy* i `defaults.domain` są statyczne per plik |
| 4 | **nlp-uri-phrases** | `agents/nlp-uri-phrases.yaml` (GENEROWANY) | Mapa `match[]` → `uri` + `payload`. | **Statyczny** — payload zapieczony per target |
| 5 | **URI processes** | `proc://`, `plesk://` → dispatcher `orchestrator/src/urirun-dispatch.mjs:11`; recepty `*.urirun.json` | Adresowalna warstwa wykonawcza (JAK). `plesk://{host}/site/command/sync`. | **URI template dynamiczny**; recepty `.urirun.json` **statyczne** (literalny host/domain/source_dir) |
| 6 | **step-catalog** | `platform/config/step-catalog.json` | Moduł AQL (`create_*_httpdocs_sync_ticket`) → kroki urirun. | **Częściowo dynamiczny** — krok www używa już `$situation.source_dir/host/domain` |
| 7 | **capability manifest** | `platform/config/connector-capabilities/*.capability.yaml` | Katalog: pack capability id ↔ URI template + typy params. | **Dynamiczny** — `uri_template` + params `{host,domain,source_dir,apply}` |
| 8 | **EQL** `WEB_SCENARIO` | `.eql` → `eql/src/web/scenario-parser.ts:24` | Adaptacyjne scenariusze web (osobny podprojekt). | Selekcja dynamiczna, wartości statyczne |
| 9 | **DQL** | `.eql`/`.patch.eql` → `eql/src/dql/parser.ts:14` | Deterministyczne patche DOM/SVG po id. | **Statyczny** |
| 10 | **TestQL** | `.testql.toon.yaml`/`.oql` → `runtime/src/testql-runtime.mjs:44`; pełne narzędzie `~/github/oqlos/testql` | Testy GUI/REST/hardware; `EXPECT` nad kontekstem. | **Dynamiczny** — `EXPECT` + wiersze TOON |
| 11 | **TOON** | `.toon.yaml` → code2llm/topology, TestTOON | Kompaktowy format tabel (topologia kodu, scenariusze). Nieuruchamiany. | Format danych |

**Do wyrażenia „opublikuj folder $X na domenę $Y" generycznie służą DSL-e z parametrami: AQL (`WEJŚCIE`), OQL (`${...}`), intent pack (`situation_schema`), step-catalog (`$situation.*`).** Statyczne (jeden-plik-na-target) są: recepty `.urirun.json`, generowany `nlp-uri-phrases.yaml`, EQL, DQL.

---

## 2. Warstwa wykonawcza jest JUŻ generyczna

Docroot dowolnej subdomeny liczony jest algorytmicznie, nie z tabeli per-domena:

- `connectors/services/bridge/src/site-topology.mjs:47` — `docrootFor(domain)` zwraca `/httpdocs` dla domeny głównej subskrypcji, inaczej `/{domain}`. **Jedna reguła obsługuje każdą subdomenę.**
- `connectors/services/bridge/src/plesk-httpdocs-sync.mjs:229` — `planHttpdocsSync({domain, remotePath, source_dir})` — zero kodu per-domena; `remote_path` domyślnie z `docrootFor`.
- `platform/config/connector-capabilities/plesk.site.sync.uri.capability.yaml` — `uri_template: plesk://{host}/site/command/sync`, params `{host,domain,source_dir,apply}`. **Jedna trasa na wszystkie domeny.**
- `platform/config/intent-packs/registry.mjs:44` — `loadIntentPacks` dynamicznie skanuje katalog; schema packa dopuszcza slot `domain` + `may_fill_slots=true`. Jeden generyczny pack jest z punktu widzenia schematu **dozwolony**.

---

## 3. Gdzie DOKŁADNIE siedzi hardkod per-domena (6 miejsc)

| # | Miejsce | Plik | Natura hardkodu |
|---|---|---|---|
| 1 | **Imperatywny `if/else` na nazwach domen** | `platform/config/intent-packs/registry.mjs:75-99` | rozgałęzia na literały `docs-stage/logo/docs.subactor.com` i ręcznie ustawia `situation.remote_path` — **dokładnie to, co `docrootFor()` liczy algorytmicznie**. To jest reimplementacja generycznej funkcji per-domena. |
| 2 | **Resolver parafraz tylko dla docs/www** | `core/services/control/src/routes/llm.mjs:32`, `core/services/control/src/docs-sync-intent.mjs:62` | `legacyPublishIntent` = tylko `resolveDocsSyncIntent ‖ resolveWwwSyncIntent`. To dlatego docs toleruje parafrazy, a logo/identity nie. |
| 3 | **Frazy per-domena** | `platform/config/intent-packs/{docs,www,logo}-httpdocs-publish.v1.json` (`phrases[]`) | dosłowne dopasowanie substring (`registry.mjs:68`). „na plesk" ≠ „w plesk". |
| 4 | **3 modele AQL** | `contracts/models/{docs,www,logo}-httpdocs-sync.pl.aql` | niemal identyczne, różnią się `MODUŁY "create_<X>_httpdocs_sync_ticket"`. |
| 5 | **3 step_module** | `platform/config/step-catalog.json` | `create_docs/www/logo_httpdocs_sync_ticket` — jeden na target (choć www już templatuje `$situation.*`). |
| 6 | **3 recepty urirun** | `{docs,logo,www}/deployment/*-httpdocs-sync.urirun.json` | literalne `source_dir/domain/remote_path` w każdym payloadzie. |

Generator fraz `platform/scripts/sync-intent-pack-derived.mjs` produkuje `nlp-uri-phrases.yaml` **z ręcznie pisanych `phrases[]` każdego packa** — nie z listy domen. Więc dziś „dodać domenę" = napisać nowy pack (6 artefaktów), a nie dopisać wpis do konfiguracji.

---

## 4. Najkrótsza ścieżka do dynamiki (bez nowych recept)

Warstwa wykonawcza, URI template i `docrootFor` już rozwiązują dowolną domenę z danych. Praca jest wyłącznie w warstwie rozpoznania/autoringu:

1. **Jeden generyczny pack** z slotami `domain` + `source_dir` (`situation_schema` już to wspiera, `may_fill_slots=true`) i frazami z wzorcem — „opublikuj folder {X} na {Y}.subactor.com" — zamiast dosłownych fraz per-domena.
2. **Usunąć `if/else` z `registry.mjs:75-99`**; wyekstrahować `domain`/`source_dir` z NL (slot-filling), a `remote_path` domyślnie z `docrootFor(domain)` — czyli **wywołać istniejącą funkcję zamiast ją powielać**.
3. **Jeden generyczny model AQL** (`WEJŚCIE domain/source_dir`, `MODUŁY "create_httpdocs_sync_ticket"`) + **jeden generyczny step_module** templatujący `$situation.*` (skopiować krok www, dodać templatowanie `remote_path`).
4. Recepty `.urirun.json` stają się opcjonalne — templatowany wpis step-catalog zastępuje 3 literalne pliki.
5. **Generyczny matcher parafraz** (jak `matchDocsPublishParaphrase`) wpięty w `legacyPublishIntent`, ekstrahujący `{folder, domain}` z dowolnego wariantu „publish/opublikuj/sync ... {domena}" i wiążący do jednego sparametryzowanego packa/modelu.

Efekt: dodanie domeny = zero plików (działa od razu z NL), a najwyżej wpis w jednym SSOT `subdomena → source_dir`, gdyby folder nie dał się wywnioskować z nazwy.

**Uwaga o bezpieczeństwie:** `llm_policy.may_generate_uri=false` musi zostać — LLM ekstrahuje **sloty** (domena, folder), ale URI składa deterministyczny `uri_template`, nie model. Capability preflight (fail-closed) i allowlist source_dir zostają bez zmian. Dynamika dotyczy rozpoznania intentu, nie rozluźnienia bramek.

---

## 5. Gdzie szukać podobnych rozwiązań (wskazówki nawigacyjne)

- **Slot-filling z NL bez wymyślania URI:** `platform/config/intent-packs/schema.v1.json` (`may_fill_slots`, `situation_schema`), `registry.mjs:resolveIntentPack`. Wzorzec do naśladowania dla każdej operacji, nie tylko publish.
- **Algorytmiczne rozwiązywanie zasobu z nazwy:** `site-topology.mjs:docrootFor` — wzorzec „reguła zamiast tabeli". Szukaj podobnych tam, gdzie jest imperatywny `if/else` na literałach.
- **Templatowanie planu:** `runtime/src/compiler.mjs:renderValue` (`${state.path}`), `step-catalog.json` krok `create_www_httpdocs_sync_ticket` jako referencja `$situation.*`.
- **Parafrazy zamiast dosłownych fraz:** `core/services/control/src/docs-sync-intent.mjs` (`matchDocsPublishParaphrase`) — jedyny dziś generyczny matcher; wzorzec do rozszerzenia.
- **Katalog capability ↔ URI:** `platform/config/connector-capabilities/*.capability.yaml` — deklaratywny manifest, dodajesz operację nie dotykając kodu connectora.
- **Dynamiczne odkrywanie tras:** urirun-node `GET /routes` (:18765) — 521 tras z `inputSchema`; źródło prawdy „co można wywołać".
- **Model AQL jako tablica decyzyjna dla nowej klasy operacji:** `runtime/src/aql-runtime.mjs` + dowolny `contracts/models/*.pl.aql`. Patrz też prototyp `orchestrator/models/development-defect-classifier.pl.aql` (AQL użyte poza publish — do klasyfikacji defektów).

---

## 6. Podsumowanie w jednym zdaniu

System ma **generyczną warstwę wykonawczą** (URI template + `docrootFor` + `$situation` templating) i **dynamiczny schema intent-packów**, ale nakłada na to **statyczną, per-domenową warstwę rozpoznania** (dosłowne frazy + imperatywny `if/else` + 6 plików na domenę). Uczynienie publish dynamicznym to **usunięcie duplikacji w routingu**, nie dopisywanie recept — cała maszyneria „na dynamicznych danych" już istnieje pod spodem.
