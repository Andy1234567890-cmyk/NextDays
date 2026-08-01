# NOTES.md — Live-Session-Status NextDays

> Bei jeder neuen Session ZUERST diese Datei lesen. Nach jeder Session aktualisieren.
> Historie: docs/history/

## Stand: 01.08.2026 · Branch: main

## Was läuft

- API: 55 Slices, `pytest` 1343 passed / 100 deselected, `ruff` sauber.
- web + builder: `tsc --noEmit` ohne Fehler. Keine Testsuite vorhanden (kein `test`-Skript).
- i18n web: `pruefe-uebersetzungen.mjs web` 0 fehlerhaft, 5313 Keys je Sprache. Die
  311 zuletzt offenen Keys (`zimmer`, `roomAmenities`, `roomAmenityGroups`,
  `amenityCategories`, `eigeneAusstattung` + 5 in `objects.propertyOverview`) sind in
  allen 22 Sprachen eingespielt; ein Nachlauf je Sprachgruppe hat Fremdsprachen-Reste
  korrigiert (el 10, hr 5, mt 2, bg 1, sv 1).
- mobile-bestdays: Jest 2 Suites / 7 Tests. mobile-nextdays: Jest 3 Suites / 14 Tests.
  Runner ist Jest (`npx jest`), NICHT `bun test`.
- DB: Migrationen bis `0244_zimmer_zaehlwerk` live angewendet (gegen Server-DB geprüft).
- Channel-Manager (13.594 LOC): ARI-Push, Buchungs-Feed, Storno-/Modifikations-Diff,
  Voll-Abgleich, Mapping-Assistent, Portal-Katalog.

## Angefangen, unfertig

- 65 Pfade uncommittet (53 geändert, 12 neu): Channel-Manager-Ausbau Paket 7
  (Feld-Kanal-Matrix `web/lib/kanal-felder.ts` + Seite `channels/synchronisation`),
  Objekt-Zusatzfelder (Betten/Zimmer-Ausstattung), OTA-Zahlungsweg + Provision (0240),
  Übersetzungen in 24 Sprachen dazu.
- Vier Migrationen live angewendet, aber NICHT committet: `0240_ota_zahlungsweg_und_provision`,
  `0242_schlafgelegenheiten_zaehlwerk`, `0243_zimmer_ausstattung`, `0244_zimmer_zaehlwerk`.
- `docs/CHANNEL-MANAGER-AUSBAU.md` (untracked): 12 Pakete, offen ab Paket 2.
  Paket 2 (Ereignis-/Fehler-Center) hat noch keine Route unter `web/app/(dashboard)/channels/`.
- `apps/api/src/features/crm` und `.../ocr`: je 38 LOC, reine Health-Stubs.
- 13 Slices ohne `tests/`-Ordner, überwiegend die Gast-Slices: guest_auth, guest_blocks,
  guest_bookings, guest_messages, guest_reviews, guest_stay, guest_wishlist,
  host_messages, host_profiles, login_devices, privacy_settings,
  property_custom_fields, property_discounts.
- `guest_auth/service.py:103,234` — Gast-Signup bestätigt E-Mail selbst
  (`email_confirm=True`), E-Mail-Wechsel ohne Re-Auth (Wurzel 7, dokumentiert offen).

## Bekannte Probleme

- Doppelte Migrationsnummern: 0238 und 0242 je zweimal vergeben. Beide Paare sind live
  angewendet, der Runner trackt Dateinamen — aber ein frischer Deploy auf leere DB
  reproduziert die ursprüngliche Reihenfolge nicht mehr.
- 8 tote Realtime-Abos in web auf Tabellen ohne `authenticated`-SELECT-Grant
  (live geprüft: payments, invoices, invoice_line_items, commission_ledger,
  owner_statements): konto-abo-section:160, guest-detail:1447, booking-timeline:277,
  owner-realtime:31, my-statements:33, invoices-client:54+55, use-reservation-detail:92.
  Grant-Entzug ist gewollt (Wurzel 6) → auf `reservations` hören.

## Nächster Schritt

Die 8 toten Finanz-Abos in web auf `reservations` umhängen (Liste oben abarbeiten).

## Blockiert durch Andy

- Stornobedingungen: bei Channex bestätigen lassen, über welchen Endpunkt ein PMS
  die Policy setzt — blockiert Paket 1 und damit Booking/Expedia-Connect.
