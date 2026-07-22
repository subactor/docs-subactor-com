---
{
  "schema": "subactor.doc/v1",
  "id": "docs.architecture.sodl-operational-event-and-replay-2026-07-21",
  "version": 1,
  "status": "current",
  "updated": "2026-07-21"
}
---

# SODL/1 — wspólny dziennik decyzji, zadań i replay

Status: wdrożona podstawa w ramach `PLF-819`  
Data: 2026-07-21

## Decyzja

Subactor nie wprowadza nowego języka opisującego logikę biznesową. Zachowuje istniejący podział:

- AQL określa, kto i w jakim zakresie ma authority;
- OQL określa operację;
- URI Process wskazuje wykonawcę i adres procesu;
- EQL określa oczekiwany, niezależnie sprawdzany skutek;
- Planfile przechowuje zamiar, stan pracy i completion receipt.

`SODL/1` (Subactor Operational DSL) jest odwracalną, jednoliniową kopertą zdarzenia nad tymi językami. Ta sama linia służy do obserwacji, parsowania, korelacji i przygotowania kontrolowanego replay.

## Dlaczego ten format

Przed implementacją porównano istniejące rozwiązania w `~/github/*/*`:

| Projekt | Element wykorzystany w SODL | Dlaczego nie został użyty samodzielnie |
| --- | --- | --- |
| `semcod/koru` | czytelna linia zdarzenia, correlation, command/replay i kilka widoków jednego źródła | Koru opisuje głównie sterowanie IDE/shell/GUI; historyczny shell nie może być domyślnym replay produkcji |
| `if-uri/urirun-flow` | URI jako kanoniczna jednostka wykonania oraz zależności kroków | YAML flow jest dobry dla całego procesu, ale nie jest jedną linią zdarzenia |
| `if-uri/urirun-declarative` | typed URI bindings i connector ownership | opisuje connector, nie historię decyzji |
| `semcod/deta` ChangeDSL | prosty, grep-friendly zapis jednej zmiany | nie ma parsera, autoryzacji ani ochrony replay |
| `semcod/redsl` | append-only JSONL, event envelope, projekcje i replay agregatu | wprowadzałby drugi model semantyczny obok AQL/OQL/EQL/URI |
| `founder-pl/DSL` | CQRS/event sourcing, read models, undo/redo | jest szerszym systemem, a Subactor ma już Planfile i URI runtime |
| `semcod/iterun` | rozdzielenie intentu od wykonania | DSL jest receptą, a nie audytowalnym zdarzeniem wykonania |

## Format linii

Przykład skrócony:

```text
SODL/1 id=evt_... event_hash=... timestamp=... kind=decision source=control.audit ticket_id=PLF-819 actor=authority%3Afounder oql=ticket.delegate uri=planfile%3A%2F%2Ftickets%2FPLF-819%2Fcommand%2Frespond mode=apply status=succeeded ... data=<base64url-canonical-json>
```

Widoczne pola pozwalają filtrować linię bez dekodowania. `data` zawiera kanoniczny JSON umożliwiający round-trip bez utraty struktury. `event_hash` wykrywa zmianę któregokolwiek pola lub payloadu.

Wymagane pola semantyczne:

- `id`, `event_hash`, `timestamp`, `kind`, `source`;
- `ticket_id`, `actor`, `oql`, `uri`;
- `mode`: `observe`, `dry-run` albo `apply`;
- `status`, `correlation_id`, `causation_id`;
- `input_hash`, `receipt_ref`, `replayable`;
- `data`: zredagowany, kanoniczny JSON.

Sekrety nie są częścią DSL. Pola o nazwach takich jak `password`, `credential`, `token`, `authorization`, `api_key` są redagowane. Tokeny w URL i fragmentach również są zastępowane. Linia może przechować wyłącznie referencję do credentiala w vault.

## Gdzie zdarzenia są zapisywane

### Zadania

Planfile zapisuje:

- linię `ticket.create` w polu `ticket.dsl`;
- linię każdej zmiany w `ticket.history[*].dsl`;
- te same zdarzenia do append-only `.planfile/events/operations.jsonl`.

API Planfile:

```text
GET http://127.0.0.1:8765/operations?ticket_id=PLF-819&limit=200
```

### Decyzje i operacje Control

Każdy nowy wpis `audit.jsonl` otrzymuje `sodl_event` oraz `dsl`. Dotyczy to m.in. decyzji authority, delegowania, grantów, planów i dispatchu URI Process.

Zunifikowany widok Control:

```text
GET http://127.0.0.1:8091/api/operations?ticket_id=PLF-819&limit=200
```

Endpoint wymaga zakresu `audit:read`. Bez `ticket_id` zwraca ostatnie decyzje Control i zdarzenia task journal Planfile.

## Protokół replay

Replay nigdy nie wykonuje tekstu linii jako shell ani nie ufa historycznej authority.

1. Parser sprawdza wersję, wymagane pola, kanoniczną serializację i `event_hash`.
2. Powstaje nowe zdarzenie `kind=replay` z `causation_id` wskazującym źródło.
3. Powstaje nowy idempotency key `sodl-replay:<event-id>:<mode>`.
4. `observe` jest trybem domyślnym.
5. Dispatch `observe` jest możliwy wyłącznie dla jawnie odczytowego URI; `dry-run` wymusza `apply=false`.
6. `apply` nie jest wykonywany bezpośrednio przez endpoint SODL. Musi przejść zatwierdzony plan, nowy process ticket, aktualne AQL/EQL oraz jednorazowy apply grant.
7. Wynik tworzy nowe zdarzenie i receipt; historia nie jest nadpisywana.

API Control:

```text
POST /api/operations/parse
{"line":"SODL/1 ..."}

POST /api/operations/replay
{"line":"SODL/1 ...","mode":"observe","dispatch":false}
```

`dispatch:false` tylko pokazuje dokładny plan replay. `dispatch:true` tworzy śledzony URI Process wyłącznie wtedy, gdy polityka read-only/dry-run na to pozwala. Próba bezpośredniego `apply` zwraca `sodl_apply_replay_requires_approved_plan`.

## Relacja do flow

`urirun-flow` pozostaje formatem wielokrokowej recepty. Każdy krok flow powinien emitować własną linię SODL z tym samym `correlation_id`; `causation_id` tworzy łańcuch przyczynowy. Dzięki temu można odtworzyć pojedynczy krok bez udawania, że ponowne wykonanie całego historycznego flow jest zawsze bezpieczne.

## Weryfikacja

Testy obejmują:

- identyczną serializację Node i Python;
- unicode i round-trip `parse → serialize`;
- wykrywanie manipulacji;
- redakcję sekretów oraz tokenów URL;
- domyślne `observe` i blokadę `apply` bez nowego ticketu;
- zapis DSL przy utworzeniu i zmianie ticketu;
- append-only task journal;
- wspólny widok decyzji Control i historii Planfile.

Postflight produkcyjny `PLF-825` potwierdził ścieżkę Planfile/Python → Control/Node → plan replay → audit Control. W trakcie postflightu wykryto i poprawiono różnicę `30.0` (Python) kontra `30` (Node): całkowite wartości float są normalizowane przed hashowaniem, dzięki czemu oba runtime'y emitują identyczne bajty.

Znane ograniczenie: istniejące zdarzenia sprzed wdrożenia nie są przepisywane. Są nadal widoczne w dotychczasowej historii, ale SODL powstaje dla nowych ticketów i nowych zmian. Backfill powinien być osobnym, niemutującym procesem projekcji oznaczającym zdarzenia jako `source=legacy-projection`.
