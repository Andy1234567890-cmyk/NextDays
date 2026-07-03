# Slice: public_portal

Eigentümer-Portal (`/api/v1/public-portal`): Eigentümer sehen **nur die ihnen
zugeordneten Objekte** (Owner-Scope, Lastenheft §4.2) — Objektliste
(`/properties`), Belegungskalender (`/calendar`), Erträge (`/earnings`) und
Abrechnungen (`/statements`).

Aktiv werden dürfen sie nur begrenzt: Sperrung **beantragen**
(`POST /block-requests`, Freigabe durch die Agentur) und Zählerstände
erfassen (`POST /meter-readings`).
