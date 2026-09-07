# Slice: calendar

Multi-Kalender — die eine Wahrheit über Verfügbarkeit (`/api/v1/calendar`):
Tages-Verfügbarkeit (`GET /availability`), Buchbarkeits-Check (`GET /check`),
manuelle Sperrungen (`POST /block`), Preis-Overrides pro Tag
(`POST /price-override`) und Bulk-Edit über Zeiträume (`POST /bulk-edit`).

Außerdem: **Verkaufsstopp/Stop-Sell** (`GET/POST /stop-sell`,
`POST /stop-sell/clear`; Migration 0089 — optional mit Reisebüro als
Adressat) und Saisonpreis-Zeilen (`GET/POST /season-price`).
Schreibende Endpunkte sind Capability-geschützt.

## Sonder-Events und Saison-Vorlagen (§2.3, 0583/0584)

- `events.py` — `EventService`: `GET/POST/PATCH/DELETE /events`. Ein Event hat
  n auch unterbrochene Zeiträume (`event_periods`) und eine Objektzuweisung
  (`event_property_assignments`, leer = alle Objekte). Es ist KEINE Saison,
  sondern ein Faktor im Dynamic Pricing (`pricing/recompute.py`); der
  Gegenzustand jeder Änderung ist deshalb der `recompute_property`-Job für
  ALTE und NEUE betroffene Objekte.
- `saison_vorlagen.py` — `SeasonTemplateService`: `GET/POST/PATCH/DELETE
  /season-templates`, `POST /season-templates/from-property`, `POST
  /season-templates/{id}/apply`. Anwenden läuft über
  `CalendarService.saison_uebernehmen` (Fassade von `_apply_season_to_one`),
  also denselben Pfad wie „Saison auf andere Objekte übertragen" — keine
  zweite Materialisierung (ADR-0024).
