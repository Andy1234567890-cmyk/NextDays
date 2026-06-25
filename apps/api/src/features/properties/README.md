# Slice: properties

Vertical Slice für die Objekt-Verwaltung (Lodgify-„Rentals"). Enthält:
router.py, service.py, schemas.py, dependencies.py, tests/.
Regeln: explizite Pydantic-Typisierung, kein direkter DB-Zugriff aus Routern,
kein Exception-Swallowing. Siehe PROJECT.md.

## Endpunkte (`/api/v1/properties`)

CRUD + Veröffentlichung:
- `GET /` · `POST /` · `GET /{id}` · `PATCH /{id}` · `DELETE /{id}`
- `POST /{id}/publish` — draft→active, Channex-Sync, Kalender-Init (erfordert Preis).
- `POST /{id}/image` — Einzelbild-Upload (z. B. „custom-map"-Slot), gibt URL zurück.

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
