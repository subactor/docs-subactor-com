---
{
  "schema": "subactor.doc/v1",
  "id": "docs.architecture.versioned-knowledge-strategy-and-error-runtime-2026-07-22",
  "version": 1,
  "status": "current",
  "updated": "2026-07-22"
}
---

# Wersjonowana wiedza, Strategy DSL i reakcje ERROR

Data stanu: 2026-07-22

## Wynik

Control korzysta z dwóch uzupełniających się, deterministycznych źródeł kontekstu:

- wersjonowanej bazy wiedzy Markdown, która opisuje fakty, decyzje, ograniczenia,
  relacje i jawne luki badawcze;
- registry artefaktów tekstowych, które wskazuje właściwy dokument, konfigurację,
  schemat albo DSL wraz z wersją treści, formatem, governing schema, hashem i
  wynikiem walidacji.

Klasyfikacja problemów oraz plan DNS nie są już zaszyte jako lista wyjątków w
funkcjach domenowych. Strategy DSL wybiera intencję i capability, a osobne
bindingi mapują capability na aktualne URI konektorów.

## Przepływ decyzji

```text
zadanie / problem
  -> Artifact Registry: właściwy kontrakt i jego poprawność
  -> Knowledge Base: fakty, relacje, ograniczenia i luki
  -> Strategy DSL: intencja, authority, warunki i capability
  -> URI binding: aktualny konektor domenowy
  -> ticket + AQL + kontrolowany URIrun + EQL receipt
```

Pierwsze cztery etapy są zaimplementowane dla opisanego zakresu. Ostatni etap
nie jest jeszcze kompletną, ogólną pętlą wykonawczą dla wszystkich zdarzeń
`ERROR`; szczegóły opisuje sekcja „Stan reakcji ERROR”.

## Baza wiedzy Markdown

Źródłem prawdy są wpisy w `platform/config/knowledge/entries`. Każdy wpis ma:

- stabilne `id` i wersję, tworzące URI
  `knowledge://subactor/<id>/v<version>`;
- provenance, okres ważności i właścicieli;
- relacje do innych wpisów;
- perspektywy takie jak fakty, decyzje, ograniczenia i alternatywy;
- zadeklarowane luki badawcze oraz informację, czy wymagają obserwacji systemu,
  czy precyzyjnego zapytania internetowego;
- wskazówki dla LLM, kiedy użyć wpisu i czego nie wywnioskowywać.

Control udostępnia widok dla ludzi oraz API:

- `GET /knowledge` i `GET /knowledge/<id>/v<version>`;
- `GET /api/knowledge`;
- `GET /api/knowledge/context?q=<temat>`;
- `GET /api/knowledge/research-queries?...`.

Kontekst jest ograniczony rozmiarem i rozszerzany relacjami. Wpis po terminie
przeglądu jest domyślnie odrzucany. Źródło zewnętrzne może być provenance, ale
nie staje się zależnością runtime ani zamiennikiem wewnętrznego, wersjonowanego
wniosku.

## Registry artefaktów tekstowych

`platform/config/artifact-registry.json` jest generowaną projekcją plików
wskazanych przez `platform/config/artifact-registry.policy.json`. Dla każdego
artefaktu przechowuje między innymi:

- stabilne `artifact_id`;
- dokładne, niemutowalne `canonical_uri` w postaci
  `artifact://subactor/<path>/r<revision>`;
- wersję deklarowaną albo rewizję wyliczoną z treści;
- nazwę i wersję formatu oraz media type;
- `schema_ref`, SHA-256 i profil treści;
- receipt walidacji na poziomach syntax, schema, semantic i version.

Wersja formatu mówi, jak parsować dokument. Wersja deklarowana opisuje kontrakt
autora. Rewizja identyfikuje konkretną treść. Te trzy wartości nie są zamienne.

Jawnie wersjonowany dokument nie może zmienić treści bez zwiększenia wersji.
Dokument legacy może korzystać z `registry-revision`, co pozwala wdrażać model
stopniowo. Błędny lub rozjechany registry zatrzymuje start Control fail-closed.

API registry:

- `GET /artifacts` i `GET /api/artifacts`;
- `GET /api/artifacts/context?q=<zadanie>`;
- `GET /api/artifacts/resolve?ref=<artifact-uri-lub-path>`;
- `GET /api/artifacts/validate?ref=<artifact-uri-lub-path>`.

Wszystkie endpointy wymagają scope `audit:read`.

### Procedura zmiany tekstu

1. Odszukaj artefakt w registry i sprawdź jego wersję, format, `schema_ref` oraz
   receipt.
2. Zmień źródło. Jeśli `version_source=declared`, podnieś wersję dokumentu.
3. W katalogu Platform uruchom `npm run artifacts:build`.
4. Uruchom `npm run artifacts:check`; drift lub błąd walidacji blokuje commit.
5. W strategii, tickecie albo raporcie używaj stabilnego URI, a przy dowodzie
   dokładnej treści używaj URI z rewizją.

## Strategy DSL

Katalog `platform/config/problem-strategies/catalog.v1.json` oddziela:

- warunki i priorytet wyboru strategii;
- intencję, authority, oczekiwany wynik i referencje wiedzy;
- atomowe kroki wyrażone jako capability;
- binding capability do URI konkretnego konektora.

Interpreter jest deterministyczny i fail-closed: brak strategii, remis
priorytetów, brak bindingu, nieznany operator albo brak wartości slotu kończą
się błędem zamiast zgadywaniem przez LLM.

Dla `management_plane=plesk` i `sync_extension=cloudflaredns` capability
`dns.record.reconcile` wybiera binding:

```text
plesk://host/dns/command/replace
```

Plesk pozostaje miejscem wykonania zmiany DNS, a rozszerzenie synchronizuje stan
do Cloudflare. Bezpośredni token Cloudflare nie jest w tym wariancie wymagany.

## Stan reakcji ERROR

Zakończone są:

- Problem Profile i normalizacja zdarzenia;
- `problem.detected`, fingerprint i trwała deduplikacja w oknie;
- wybór strategii `observe`, `retry_candidate`, `escalate_candidate` albo
  `containment_candidate`;
- ograniczony exponential backoff i progi eskalacji z polityki DSL;
- jawne authority oraz referencje do wersjonowanej wiedzy;
- zakaz bezpośredniej mutacji (`automatic_mutation_allowed=false`).

Nie jest zakończona ogólna pętla:

```text
reaction -> deduplikowany ticket -> AQL -> idempotentny URIrun -> EQL -> completion receipt
```

Dlatego `retry_candidate` jest klasyfikacją i propozycją reakcji, a nie dowodem,
że retry lub naprawa zostały wykonane. Brak ten jest zapisany jako wewnętrzna
luka badawczo-implementacyjna, nie jako temat do zastąpienia ogólnym wynikiem z
Internetu.

## Stan PLF-592

Warstwa DNS jest zakończona: dry-run Plesk nie wykazał zmiany, publiczny rekord
A wskazuje `217.160.250.222`, a bezpośredni token Cloudflare nie jest potrzebny.
Aktywny blocker to `public_application_route_not_ready`: strict HTTPS dociera do
originu, lecz `/founder/action` zwraca HTTP 404. System czeka na obserwowalny,
uwierzytelniony upstream zamiast wymyślać topologię aplikacji.

## Kontrakty i dowody

- wiedza: `platform/config/knowledge/schema.v1.json`;
- strategie: `platform/config/problem-strategies/schema.v1.json`;
- registry: `platform/config/artifact-registry/schema.v1.json`;
- dokumenty Markdown: `platform/config/artifact-registry/document.schema.v1.json`;
- polityka zakresu: `platform/config/artifact-registry.policy.json`;
- implementacja runtime: `core/services/control/src/knowledge-base.mjs`,
  `artifact-registry.mjs` i `strategy-dsl.mjs`;
- walidacja: testy Core, testy meta Platform i runtime smoke Control.

