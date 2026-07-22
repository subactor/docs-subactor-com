---
{
  "schema": "subactor.doc/v1",
  "id": "docs.architecture.authority-principals-machine-decisions-2026-07-21",
  "version": 1,
  "status": "current",
  "updated": "2026-07-21"
}
---

# Authority principals i decyzje machine-to-machine

## Werdykt

`Founder` jest kanałem i pierwszym reprezentantem organizacji, ale nie jest
technicznym źródłem uprawnienia. Źródłem uprawnienia jest authority związane z
konkretnym ticketem i kontraktem AQL. Principal może reprezentować człowieka,
maszynę, usługę, bota albo zewnętrznego providera.

Obsługiwane identyfikatory:

- `human:<id>`;
- `machine:<id>`;
- `service:<id>`;
- `bot:<id>`;
- `provider:<id>`.

Sam typ principal, posiadanie tokenu lub rola Foundera nie wystarcza do wydania
decyzji. Authority jest przyznawane wyłącznie przez co najmniej jeden jawny
mechanizm ticketu:

1. `execution.assigned_to` wskazuje principal;
2. etykieta `authority:<principal>`;
3. etykieta `approver:<principal>`;
4. etykieta `principal:<principal>`;
5. AQL ticketu wskazuje tego aktora i capability `decision.respond`,
   `ticket.approve`, `plan.approve` albo `apply_grant.issue`.

Nie istnieje globalny wyjątek dla `human:founder`. Ticket, który ma zatwierdzić
Founder, musi jawnie zawierać np. `authority:human:founder`.

## Endpoint M2M

Zdalny policy engine odpowiada przez:

```http
POST /api/authority/decisions/respond
Authorization: Bearer <token powiązany z principal>
Content-Type: application/json

{"ticket_id":"PLF-123","decision":"approve"}
```

Dozwolone decyzje to `approve`, `defer` i `reject`. Token musi mieć scope
`plans:approve`, ale scope jest tylko pierwszą bramką. Control odczytuje principal
z uwierzytelnionej tożsamości i niezależnie sprawdza jego authority w docelowym
tickecie. Nie przyjmuje principal w body, dzięki czemu wywołująca maszyna nie
może podszyć się pod innego decydenta.

Każda decyzja zapisuje principal, metodę uwierzytelnienia i ticket w audycie.
Brak przypisania zwraca `403 authority_principal_not_assigned` bez zmiany stanu.

## E-mail i GUI

E-mail pozostaje jednym z transportów authority. Parser skorelowanej odpowiedzi
akceptuje teraz także `principal:machine:*`, `principal:service:*`, `bot` i
`provider`, ale nadal wymaga uwierzytelnienia nadawcy, ticketu procesu oraz
authority w docelowym zadaniu. Brak jawnego principal nie jest już zamieniany
na `human:founder`.

Panel Foundera i jednorazowy link są zachowane jako kompatybilny kanał dla
człowieka. Kolejnym etapem refaktoryzacji powinno być przemianowanie transportu
na `authority action`, bez zmiany istniejących URL-i do czasu migracji klientów.

## Przykład ticketu kontrolowanego przez maszynę

```json
{
  "labels": ["authority:machine:policy-engine-prod"],
  "execution": {
    "state": "waiting_input",
    "assigned_to": "machine:policy-engine-prod"
  },
  "inputs": {
    "process_manifest": {
      "definitions": {
        "aql": [
          {
            "actor": "machine:policy-engine-prod",
            "allow": ["decision.respond"],
            "deny": ["scope.expand", "principal.override"]
          }
        ]
      }
    }
  }
}
```

Maszyna po drugiej stronie powinna posiadać osobny, rotowany token związany z
jej principal. Nie należy współdzielić bootstrapowego tokenu administratora ani
przenosić credentiali w treści ticketu.

Tożsamość `machine`, `service` lub `provider` jest rejestrowana z kontraktem
`aql:contract/v1`. Kompilator dopuszcza te typy zarówno jako principal, jak i
delegatora, ale delegacja nadal wymaga aktywnego kontraktu nadrzędnego,
capability `autonomy.contract.delegate` oraz niewykraczania poza jego zakres.
Typ tożsamości sam w sobie nie stanowi authority.
