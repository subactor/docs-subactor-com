---
{
  "schema": "subactor.doc/v1",
  "id": "docs.architecture.semcod-koru-diagnostics-2026-07-21",
  "version": 1,
  "status": "current",
  "updated": "2026-07-21"
}
---

# Diagnostyka Subactor przez Koru i semcod — 2026-07-21

## Wynik

Diagnostyka została wykonana z katalogu `/home/tom/github/subactor` przy
użyciu `code2llm`, `redup 0.4.35` i `koru 0.1.400`. Koru pracował w trybie
dry-run; podczas audytu nie utworzono ticketów i nie wykonano refaktoryzacji.

`project/analysis.toon.yaml` obejmuje 716 plików i wskazuje:

- 35 god modules;
- 324 funkcje z CC >= 15;
- maksymalne CC 107;
- pięć głównych hotspotów modułowych w `runtime`, `orchestrator` i `testkit`;
- dwadzieścia funkcji wybranych przez Koru do pierwszej kolejki redukcji CC.

Skan Koru zwrócił 28 sugestii: pięć podziałów modułów, dwadzieścia redukcji
złożoności, jedno zbiorcze zadanie refaktoryzacyjne oraz brak konfiguracji
bramek `regix` i `testql` na poziomie płaskiego katalogu projektu.

## Korekta raportu duplikacji

Pierwotny `project/duplication.toon.yaml` raportował zero grup, ale przeskanował
tylko 10 plików i 1566 linii. Przyczyną był domyślny filtr `redup`, który
uwzględniał wyłącznie `.py`, podczas gdy Subactor jest głównie projektem
JavaScript/TypeScript.

Pełny skan wielojęzykowy objął 440 plików i 59 724 linie. Znalazł 96 grup oraz
5747 potencjalnie powtarzających się linii, ale ten wynik wymaga klasyfikacji:

- 66 grup pochodzi z wersjonowanych, wygenerowanych bundle'i `eql/cdn`;
- 13 grup to nakładające się zakresy tej samej funkcji wykryte ponownie przez
  ekstraktor;
- 17 grup pozostaje do przeglądu jako potencjalnie rzeczywista duplikacja.

Bundle'i CDN są artefaktami dystrybucyjnymi. Nie należy ich ręcznie
refaktoryzować; trzeba utrzymywać jedno źródło i odtwarzać bundle przez build.
Nie należy również automatycznie stosować sugestii `redup`, które proponują
pliki `.py` dla kodu `.mjs` lub `.js`.

## Najbardziej wartościowe duplikaty do usunięcia

1. `core/services/control/src/docs-sync-intent.mjs` i
   `www-sync-intent.mjs`: dokładnie powtórzone `loadPack` oraz `matchPhrase`.
   Kandydat na wspólny moduł obsługi intent packów.
2. `platform/scripts/configure-inbound-email-vault.mjs` i
   `configure-plesk-admin-vault.mjs`: powtórzona obsługa ukrytego hasła i
   wejścia terminalowego. Kandydat na wspólny helper CLI bez zmiany granic
   sekretów.
3. `connectors/services/bridge/src/plesk-docroot-observe.mjs` i
   `plesk-subscription-probe.mjs`: dokładnie powtórzone `xmlEscape`.
4. `agents/services/browser-agent/src/server.mjs`: podobne strony oraz handlery
   formularzy Plesk, mailbox i SMTP. Kandydat na fabrykę routingu formularzy,
   z zachowaniem osobnych schematów walidacji.
5. `core/services/control/src/delegation-coverage.mjs` i
   `platform/packages/capability-preflight/src/preflight.mjs`: podobne
   dopasowanie URI/allow pattern. Wymaga najpierw decyzji o właścicielu
   kontraktu, ponieważ kod leży po dwóch stronach granicy repozytoriów.

## Kolejność refaktoryzacji

### Faza 0 — jakość sygnału

- Używać rozszerzeń `.py,.js,.mjs,.cjs,.ts,.tsx,.jsx,.php,.sh`.
- Szybki skan ograniczać do `core`; pełny skan uruchamiać jawnie.
- Odfiltrować `eql/cdn`, wygenerowane SDK/bundle i nakładające się zakresy
  przed utworzeniem ticketów.
- Nie stosować automatycznych sugestii ścieżek z `redup` bez przeglądu.

### Faza 1 — bezpieczne ekstrakcje

- Wspólny helper intent packów dla docs/www.
- Wspólny helper terminalowego pobierania sekretu w skryptach platformy.
- Wspólny `xmlEscape` w konektorze bridge.
- Każda ekstrakcja z testem regresyjnym i bez zmiany kontraktu URI.

### Faza 2 — hotspoty `core`

- `process-pack-registry.mjs::validateGraph` — CC 88.
- `routes/founder-access.mjs::handleFounderAccessRoutes` — CC 107.
- `interactive-form.mjs` — trzy funkcje CC 27–33.
- `autonomy-remediation-planner.mjs::validateLlmRemediationProposal` — CC 39.
- `project-remediation.mjs::ensureProjectRemediationTickets` — CC 38.

`core/services/control/public/app.js` ma 2957 linii i bardzo szeroki fan-in.
Jego podział powinien następować po wydzieleniu stabilnych helperów i testów,
nie jako jednorazowe przeniesienie pliku.

### Faza 3 — runtime i orchestrator

- `runtime/src/oql-runtime.mjs`;
- `runtime/src/eql-pressure-runtime.mjs`;
- `runtime/src/testql-runtime.mjs`;
- `orchestrator/src/pipeline.mjs`.

Najpierw należy rozdzielić parsowanie, walidację i wykonanie, pozostawiając
dotychczasowe entry pointy jako cienkie fasady kompatybilności.

## Powtarzalne uruchomienie

Szybka diagnostyka, domyślnie z godzinnym cache raportu duplikacji:

```bash
bash platform/scripts/run-semcod-diagnostics.sh .
```

Pełny audyt całej płaskiej przestrzeni:

```bash
REDUP_MODE=full REDUP_MAX_AGE_SECONDS=0 \
  bash platform/scripts/run-semcod-diagnostics.sh .
```

Wyłączenie kosztownego skanu duplikacji i samo odświeżenie Koru:

```bash
REDUP_MODE=off bash platform/scripts/run-semcod-diagnostics.sh .
```

Koru pozostaje dry-run. Dopiero po przeglądzie wyniku można osobno uruchomić
`koru scan --apply --semcod-artifacts`, aby deduplikować i utworzyć zaakceptowane
tickety w Planfile.
