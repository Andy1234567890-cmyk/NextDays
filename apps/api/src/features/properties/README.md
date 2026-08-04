# Slice: properties

Vertical Slice für die Objekt-Verwaltung („Rentals"). Enthält:
router.py, service.py, schemas.py, dependencies.py, tests/.
Regeln: explizite Pydantic-Typisierung, kein direkter DB-Zugriff aus Routern,
kein Exception-Swallowing. Siehe PROJECT.md.

## Endpunkte (`/api/v1/properties`)

CRUD + Veröffentlichung:
- `GET /` · `POST /` · `GET /{id}` · `PATCH /{id}` · `DELETE /{id}`
- `POST /{id}/publish` — draft→active, Channex-Sync, Kalender-Init (erfordert Preis).
- `POST /{id}/image` — Einzelbild-Upload (z. B. „custom-map"-Slot), gibt URL zurück.

### Preise, Gebühren, Steuern (`MANAGE_PROPERTY_SETTINGS`, tenant-gescoped)

Die Posten selbst liegen im Preis-Blob `type_attributes.pricing` und werden beim
Speichern serverseitig geprüft und gesäubert (`gebuehren.normalize_fees`,
`steuern.normalize_taxes` — der Client bestimmt weder die USt-Anzahl noch das
erlaubte HTML noch die erlaubten Portale). Von dort spiegelt
`gebuehren.sync_pricing_config` sie nach `property_pricing_config`, wo der
Preis-Resolver liest.

- `GET /{id}/fee-library` — bestehende Gebühren des Betriebs, übernehmbar auf
  DIESES Objekt (speist „neue oder bestehende Gebühr hinzufügen").
- `POST /{id}/fees/{fee_id}/apply` · `POST /{id}/taxes/{tax_id}/apply` — EINEN
  Posten auf weitere eigene Objekte übertragen.
- `POST /{id}/pricing/copy-from` — den GANZEN Preis-Block von einem anderen
  eigenen Objekt übernehmen (`preise_kopieren.py`). Überschreibt vollständig und
  spiegelt den Grundpreis in `rate_plans`; Aktionen, Extras und Verfügbarkeit
  bleiben außen vor. Währung und Kanal-Einschränkungen werden VOR dem ersten
  Schreiben geprüft — eine halb durchgelaufene Übernahme wäre schwer zu erkennen
  und noch schwerer zurückzunehmen.

Gebühren und lokale Steuern tragen beide einen gastseitigen Namen je Sprache
(`names`, Locale→Text) neben dem internen `name`; gesäubert von
`gebuehren.clean_names` (EINE Quelle, steuern.py importiert sie).

**Extras gehören NICHT hierher.** Sie liegen im `addons`-Slice
(`property_addons`, Migrationen 0074/0075). Das Feld
`type_attributes.pricing.addOns` war bis 04.08.2026 eine Attrappe: es wurde von
niemandem gelesen — nicht vom Preis-Resolver, nicht von der Buchungsstrecke,
nicht von der Rechnung. Die Preise-Seite pflegt jetzt den echten Katalog.

### Foto-/Galerieverwaltung (`PM_MANAGE_PROPERTY_IMAGES`, tenant-gescoped)

- `GET /{id}/photos` — Fotos, nach Reihenfolge sortiert.
- `POST /{id}/photos` — ein Galerie-Foto hochladen (JPEG/PNG, 50 KB–20 MB);
  ans Ende einsortiert, erstes Foto wird Cover. Multi-Upload = mehrere Aufrufe.
- `PATCH /{id}/photos/reorder` — neue Reihenfolge (vollständige Foto-ID-Liste).
- `PATCH /{id}/photos/{photo_id}` — Bildunterschrift je Locale und/oder Cover.
- `DELETE /{id}/photos/{photo_id}` — Datei + Zeile; Cover wird ggf. neu vergeben.

## Daten

- `properties` (Migration 0003): Stammdaten; `photos text[]` ist ab Migration
  0061 ein **abgeleiteter Kompat-Spiegel** (Cover zuerst, dann sort_order).
- `property_photos` (Migration 0061): **Wahrheit** der Galerie — eine Zeile je
  Foto mit `sort_order`, `is_cover` (genau eins je Objekt, partieller
  Unique-Index) und mehrsprachiger `caption jsonb` (Locale→Text). RLS via
  property→tenant (Muster wie `price_overrides`). Backfill aus `properties.photos`.

Leser von `properties.photos` (Kalender-Thumbnail, öffentliche booking_engine-
Listings, DP-Übersicht, Inbox) bleiben unverändert und lesen den Spiegel.
