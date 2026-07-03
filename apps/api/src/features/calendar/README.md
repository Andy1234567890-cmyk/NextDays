# Slice: calendar

Multi-Kalender — die eine Wahrheit über Verfügbarkeit (`/api/v1/calendar`):
Tages-Verfügbarkeit (`GET /availability`), Buchbarkeits-Check (`GET /check`),
manuelle Sperrungen (`POST /block`), Preis-Overrides pro Tag
(`POST /price-override`) und Bulk-Edit über Zeiträume (`POST /bulk-edit`).

Außerdem: **Verkaufsstopp/Stop-Sell** (`GET/POST /stop-sell`,
`POST /stop-sell/clear`; Migration 0089 — optional mit Reisebüro als
Adressat) und Saisonpreis-Zeilen (`GET/POST /season-price`).
Schreibende Endpunkte sind Capability-geschützt.
