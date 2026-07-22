---
{
  "schema": "subactor.doc/v1",
  "id": "docs.architecture.adr.007-canonical-component-paths",
  "version": 1,
  "status": "current",
  "updated": "2026-07-18"
}
---

# ADR-007: Canonical component paths

- **Status:** Accepted  
- **Data:** 2026-07-18  
- **Kontekst:** roadmap unit 1; [`../canonical-component-paths.md`](../canonical-component-paths.md)

## Decyzja

1. Kanonicznym źródłem kodu komponentów są repozytoria `subactor/<name>` (`core`, `connectors`, …).
2. `platform/components/<name>` to **submoduły Gita** (pin deployowalny), nie vendor, nie generator, nie druga linia edycji.
3. Compose buduje z pinu submodule — po zmianie w komponencie trzeba zaktualizować wskazanie w `platform`.
4. Drift treści drzew serwisowych między sibling a submodule = błąd bramki (`scripts/check-component-drift.mjs`).

## Konsekwencje

- Edycje LLM routes / connectorów: commit w repo komponentu, potem bump submodule w `platform`.
- Intent pack **JSON** pozostaje w `platform/config/intent-packs/` (assembly).
- Brak dużego refaktoru layoutu monorepo.
