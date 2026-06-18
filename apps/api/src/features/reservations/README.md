# Slice: reservations

Vertical Slice. Enthält: router.py, service.py, schemas.py, tests/.
Regeln: explizite Pydantic-Typisierung, kein direkter DB-Zugriff aus Routern,
kein Exception-Swallowing. Siehe PROJECT.md.

Status: **implementiert**.

## Endpunkte (`/api/v1/reservations`)

- `GET /health` — Smoke.
- `GET /` — Reservierungen des Tenants (optional `?property_id=`). Cap: `VIEW_CALENDAR`.
- `POST /` — Reservierung anlegen. Cap: `MANAGE_CALENDAR`.

## Verhalten beim Anlegen (`POST /`)

1. Prüft, dass das Objekt dem Tenant gehört (sonst 404).
2. **Double-Booking-Schutz:** ist ein Tag in `[check_in, check_out)` bereits
   `booked`/`blocked`, → **409**.
3. Legt den Gast an (oder verwendet einen bestehenden per E-Mail wieder) in `guests`.
4. Schreibt die Reservierung in `reservations` (Status, Kanal, Summe, Währung vom Objekt).
5. Belegt den Kalender: alle Übernachtungstage werden in `availability` auf
   `booked` ge-upsertet → derselbe Schutzmechanismus wie der calendar-Slice.

tenant_id stammt immer aus dem JWT (AuthContext), nie aus User-Input.
