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

## Verhalten beim Verschieben/Verlängern (`PATCH /{id}/move`)

Ein neues `(property_id, check_in, check_out)` für eine bestehende Buchung —
Verlängern, Verkürzen, Verschieben und Objektwechsel sind derselbe Vorgang.

1. Nicht änderbar sind: storniert, ausgecheckt, eingecheckt, OTA-importiert
   (`source_channex_booking_id` — die Änderung gehört ins Portal).
2. **Die eigene Einheit ist der Dreh- und Angelpunkt.** Der Double-Booking-
   Vorcheck fragt je Einheit „bleibt eine im ganzen Zeitraum frei?" und nimmt
   die EIGENEN Alt-Tage auf der EIGENEN Einheit aus. Trägt die Buchung keine
   `unit_id` (nullable seit 0265, `on delete set null`, Direkt-Inserts an der
   RPC vorbei), wird sie über `_gehaltene_einheit` aus dem Kalender abgeleitet:
   bei einem Objekt mit einer Einheit ist es diese, sonst die Einheit, die an
   ALLEN eigenen Nächten belegt ist und die keine andere aktive Buchung für
   sich benennt. Bleibt es mehrdeutig → **409 „keiner Einheit zugeordnet"**,
   nicht die irreführende Belegt-Meldung.
   Ohne diese Ableitung zählte eine Buchung ohne Einheit ihre eigenen Nächte
   als Fremdbelegung und war dauerhaft unveränderbar (live 24.08.2026, alle 10
   `channel='website'`-Buchungen; Bestand per 0431 nachgezogen, Dauerprüfung:
   `scripts/diagnose/buchung-einheit-pruefen.sh`).
3. Stop-Sell im Ziel-Zeitraum (kanal- und plan-bewusst) → 409.
4. Preis bleibt UNVERÄNDERT, außer `reprice=true` (protel-Modell: der
   vereinbarte Preis ist bindend, Neurechnen ist eine bewusste Entscheidung).
5. Reihenfolge: Reservierungszeile zuerst (EXCLUDE-Constraint 0104/0315 prüft
   atomar) → Alt-Nächte über `_release_nights` freigeben (`push=False` am
   gleichen Objekt) → Ziel-Nächte belegen → EIN Push über
   `min(alt,neu)..max(alt,neu)`. Ein Push dazwischen meldete gerade geräumte
   Tage als frei, obwohl sie Sekunden später wieder belegt sind.
