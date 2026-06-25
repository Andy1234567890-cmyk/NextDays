# Slice: owners

Vertical Slice für die verwaltete **Eigentümer-Partei** (Agentur verwaltet Objekte
für fremde Eigentümer). Getrennt vom Owner-Login-User (`owner_property_assignments`,
auth-Slice) und von der reinen Kontaktliste `co_owners` (deprecated ab 0063).

Enthält: router.py, service.py, schemas.py, dependencies.py, tests/.
Regeln: explizite Pydantic-Typisierung, kein DB-Zugriff aus Routern, kein
Exception-Swallowing. Siehe PROJECT.md.

## Endpunkte (`/api/v1/owners`, alle `MANAGE_OWNERS`, tenant-gescoped)

- `GET /` — Eigentümer-Liste (Stammdaten + Objekt-Anzahl).
- `POST /` — anlegen.
- `GET /{id}` — Detail inkl. Objekt-Zuordnungen.
- `PATCH /{id}` — Stammdaten/Bank/Provision/Statement-Frequenz aktualisieren.
- `DELETE /{id}` — löschen.
- `POST /{id}/properties` — Objekt zuordnen / Anteil + Provisions-Override setzen.
- `DELETE /{id}/properties/{property_id}` — Zuordnung entfernen.

## Daten (Migration 0063)

- `owners`: verwaltete Eigentümer-Partei — Stammdaten, Adresse, Steuer-/USt-ID,
  Bankverbindung, `default_commission_pct`, `default_payout_method`,
  `statement_frequency` (none/monthly), optionale `user_id` (Owner-Login fürs Portal).
  RLS via tenant.
- `owner_properties`: Link owner↔property mit `ownership_share` (%) und
  `commission_override_pct` (überschreibt Default je Objekt). RLS via owner→tenant.
- `reservations.channel_fee`: explizite Kanalgebühr; Total Payout = total_amount −
  channel_fee (Owner-Statements, Teil B).
- Backfill aus `co_owners` (share_percent → ownership_share). `co_owners` bleibt als
  Kontaktliste, ist aber deprecated.

Verknüpft ein Owner einen Login-User (`user_id`, Rolle `owner`), steuert das
zusammen mit `owner_property_assignments` (auth-Slice) das Portal-Scoping.
