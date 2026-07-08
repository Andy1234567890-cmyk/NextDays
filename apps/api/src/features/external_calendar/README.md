# external_calendar — externe iCal-Kalender abonnieren (Belegungs-Sync)

Der Kunde hinterlegt pro Objekt eine oder mehrere externe **iCal-URLs** (Lodgify,
Airbnb, Booking, Vrbo, Google-Kalender …). Ein Worker liest die `.ics`-Feeds
periodisch und trägt belegte Zeiträume als `availability` (`status='blocked'`,
`source='ical'`) ein → verhindert Doppelbuchungen plattformübergreifend.

**Das ist KEIN Datenimport.** Es werden keine Objekte, Preise oder Gästedaten
kopiert — nur Verfügbarkeit synchronisiert (wie Lodgifys „Import Calendar").
Für den Lodgify-Wechsel: der Kunde exportiert in Lodgify pro Objekt die iCal-URL
und fügt sie hier ein.

## Datenmodell (Migration 0119)

- `external_calendar`: abonnierte Feeds pro Objekt (name, ical_url, is_active,
  last_synced_at/status/error/event_count). UNIQUE(property_id, ical_url) =
  Idempotenz-Backstop. RLS (eigener Tenant) + Realtime (Status live in der UI).
- `availability.external_calendar_id`: Herkunft einer ical-Sperre → erlaubt
  gezieltes Aufräumen bei Feed-Änderung (Gegenzustand).
- `availability_source` um `'ical'` erweitert.

## iCal-Parser (`ical.py`)

Schmaler, getesteter Parser (kein Fremdpaket). Liest VEVENT → DTSTART/DTEND/UID/
SUMMARY. **DTEND ist EXKLUSIV** (Abreisetag frei = korrekte Nächte-Semantik).
Defekte Events (fehlende Felder, start>=end) werden übersprungen (kein Raten),
doppelte UIDs dedupliziert. Line-unfolding (RFC 5545). Gegen ECHTE Lodgify-Daten
getestet.

## Sync (`service.py`)

- **SSRF-Schutz (Wurzel 5):** die URL kommt vom Kunden → nur http(s), aufgelöste
  IP darf nicht privat/loopback/link-local/reserved sein (fail-closed).
- **Idempotenz (Wurzel 2):** availability-Upsert per (property_id, date).
- **Gegenzustand (Wurzel 1):** Tage, die der Feed nicht mehr liefert, werden aus
  den ical-Sperren DIESES Feeds entfernt (nur eigene, fremde bleiben).
- **Kein Überschreiben echter Buchungen (Wurzel 1):** liegt ein iCal-Tag auf einer
  fremd belegten Zeile (echte Buchung / OTA-Sperre / anderer Feed), wird sie NICHT
  angefasst — sonst ginge die echte Buchung im Kalender verloren.
- **Robust (Wurzel 5):** ein kaputter Feed schreibt seinen Fehler an
  `last_status/last_error`, wirft aber nicht → der Worker synct die anderen weiter.

## Worker

`_ical_tick` (worker.py): alle 30 min prüfen, Feeds > 2h synchronisieren
(analog Lodgify „alle 2 Stunden"), max. `ICAL_BATCH` pro Tick. Kein Job-Queue-
Umweg — direkter Sync im Thread.

## Endpunkte (`/api/v1/external-calendar`, MANAGE_CALENDAR)

- `GET /property/{id}` — Feeds eines Objekts
- `POST /` — Feed hinzufügen (SSRF-geprüft)
- `POST /{id}/sync` — „Jetzt synchronisieren"
- `DELETE /{id}` — Feed entfernen (gibt seine Sperren frei, Gegenzustand)

## UI

`ExternalCalendarSection` auf der Objekt-Verfügbarkeitsseite
(`/objekte/[id]/verfuegbarkeit`): Feed hinzufügen, Status live (Realtime),
Sync/Löschen. White-label, `formatCurrency` n/a (keine Beträge).
