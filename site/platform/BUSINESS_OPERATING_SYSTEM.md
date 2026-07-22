---
{
  "schema": "subactor.doc/v1",
  "id": "docs.platform.business.operating.system",
  "version": 1,
  "status": "current",
  "updated": "2026-07-15"
}
---

# Project Business Operating System

Celem modułu jest zamiana wiedzy o projekcie w kontrolowany system prowadzenia
biznesu. Import nie wykonuje kampanii ani nie wysyła ofert. Najpierw tworzy wiedzę,
blueprint, testy i plan proposed.

## Pełna mapa procesów

Blueprint zawiera siedemnaście obszarów:

1. pozycjonowanie i oferta;
2. reklama i pozyskiwanie ruchu;
3. treści i edukacja rynku;
4. pozyskanie i kwalifikacja leadów;
5. sprzedaż i domykanie;
6. monetyzacja i Revenue Operations;
7. wdrożenie i dostarczenie wartości;
8. wsparcie klienta;
9. utrzymanie, rozwój i polecenia;
10. produkt, roadmapa i eksperymenty;
11. finanse, fakturowanie i należności;
12. umowy, prawo i zgodność;
13. ludzie, kompetencje i capacity;
14. partnerstwa i zakupy;
15. analityka, eksperymenty i decyzje;
16. bezpieczeństwo, prywatność i ciągłość;
17. TestQL, dowody i odpowiedzialność.

Plan może dodatkowo utworzyć proces badania braków informacyjnych.

## Odpowiedzialność

Każdy proces ma:

- `owner_role`;
- cel;
- KPI;
- status;
- powiązanie z projektem;
- źródło utworzenia;
- historię zmian.

AI nie jest właścicielem rezultatu. LLM proponuje strukturę i treść roboczą.
Outcome owner i approver są ludźmi lub formalnymi rolami organizacji.

## Cykl od importu do wykonania

```text
1. Utwórz projekt
2. Zaimportuj WWW/repozytorium/katalog
3. Przejrzyj Markdown i blueprint
4. Sprawdź TestQL importu
5. Utwórz plan AQL/OQL
6. Przeczytaj dokładny OQL
7. Zatwierdź plan tokenem approvera
8. Wykonaj adaptery
9. Uruchom postflight TestQL
10. Przeglądaj procesy, zadania, kampanie i wyniki w workspace
```

## AQL

`project-business-bootstrap.pl.aql` wybiera wariant:

- przegląd bezpieczeństwa przy możliwych sekretach;
- dalsze badanie przy słabych dowodach;
- pełny system biznesowy dla projektu rynkowego;
- system produktu technicznego dla repozytorium;
- standardowy bootstrap.

AQL jest deterministyczne: identyczne wejście daje identyczną decyzję.

## OQL

OQL pokazuje wszystkie operacje przed wykonaniem. Dla pełnego projektu może utworzyć:

- procesy biznesowe;
- kampanię startową;
- ofertę do review;
- zadania lejka sprzedaży;
- zadanie bazy wiedzy wsparcia;
- zadanie pomiaru przychodu;
- outcome projektu;
- suite TestQL;
- postflight TestQL.

Plan ma hash OQL. Przy zatwierdzaniu zapisuje się hash, a przed wykonaniem system
sprawdza, czy plan nie został zmieniony.

## TestQL

Importer uruchamia TestQL dla:

- liczby poprawnie pobranych źródeł;
- rozmiaru Markdownu;
- proweniencji;
- liczby procesów;
- liczby zadań;
- wykrytych sekretów.

Po wykonaniu OQL Bridge uruchamia postflight TestQL dla workspace projektu:

- co najmniej 17 procesów;
- obecny proces reklamy;
- obecny proces sprzedaży;
- obecny Revenue Operations;
- obecne wsparcie;
- backlog zadań;
- zdefiniowany outcome.

Niepowodzenie TestQL zatrzymuje plan jako `failed`, a nie `completed`.

## Automatyzacja marketingu i sprzedaży

System przygotowuje strukturę, ale działania zewnętrzne muszą być osobnymi,
zatwierdzonymi planami. Przykładowe kolejne modele AQL:

```text
campaign-planning.pl.aql
lead-qualification.pl.aql
offer-approval.pl.aql
sales-followup.pl.aql
customer-onboarding.pl.aql
support-triage.pl.aql
renewal-and-upsell.pl.aql
```

Wysłanie reklamy, oferty, wiadomości klientowi, zmiana ceny lub zobowiązanie umowne
powinny wymagać odpowiedniego poziomu approval.
