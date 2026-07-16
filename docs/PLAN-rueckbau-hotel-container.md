# Umbau-Plan: „Hotel-Container"-Zweig zurückbauen — 1 Objekt = 1 Einheit

**Status:** Vorschlag, wartet auf Freigabe. Nichts davon ist umgesetzt.

## Problem (verbindliches Modell vs. Ist)

**Modell (unverhandelbar, CLAUDE.md):** Jede `properties`-Zeile ist GENAU EINE buchbare
Einheit — ein einzelnes Zimmer (Hotel) ODER ein Ferienobjekt. Ein Hotel mit 8 Zimmern
hat 8 Objekte, NICHT 1 Objekt mit `count_of_rooms=8`.

**Ist (per 3-Agenten-Kartierung belegt):** Seit den Migrationen 0140–0143 existiert ein
zweiter, paralleler „Hotel-Container"-Zweig: 1 Objekt = n Zimmerkategorien (`room_types`)
mit je `count_of_rooms` Zimmern, count-basierte Verfügbarkeit (`room_type_availability.
booked_count`), eigener RPC-Zweig, eigener Push-Pfad, eigener UI-Slice, eigener
i18n-Namespace. Der Schalter ist die **Existenz von `room_types`-Zeilen**.

### Zwei entscheidende Fakten aus der Live-DB
1. **Nur EIN Objekt nutzt den Container-Zweig: das Zert-Testobjekt** `956747c8`
   („Twin & Double Testhotel", 2 room_types Twin/Double, count 8/4). **Alle 6 echten
   Objekte haben 0 room_types** → laufen bereits im korrekten Modell.
2. Der Container-Zweig ist **intern unvollständig integriert** und erzeugt dadurch echte
   Fehler, sobald eine `room_types`-Zeile existiert:
   - Booking-Engine, Kundenportal, Kalender-Blocks lesen/schreiben NUR die binäre
     `availability`-Tabelle → eine Container-Property erscheint dort trotz Buchung als
     frei (**Überbuchungslücke**).
   - OTA-Inbound (`bookings_sync`) projiziert ohne `room_type_id` → der count-Zähler
     wird bei Hotels nie gepflegt → lokaler Zähler und OTA-Wahrheit divergieren.
   - Der Rooms-Import nimmt „1 synthetischer Room-Type/Property" an → kollidiert mit dem
     Hotel-Zweig, der n Room-Types je Objekt anlegt.

## Ziel

Ein einziges, konsistentes Modell: **1 Objekt = 1 Einheit**, binäre `availability`.
Channex: je Objekt EIN synthetischer Room-Type (`local_unit_ref = property_id`,
`count_of_rooms = 1`). Rate-Pläne hängen am **Objekt** (`property_id`), nicht an
Kategorien. Der gesamte Container-Zweig entfällt — samt der Überbuchungslücke.

---

## Umfang (was entfernt/umgebaut wird)

### A. Datenbank (Migration, additiv + Cleanup)
- **Neue Migration 0154+** (Reihenfolge wichtig, EINE Transaktion je Schritt):
  1. Zert-Testobjekt umstellen (siehe Abschnitt „Zert-Objekt"), BEVOR Constraints greifen.
  2. `rate_plans.room_type_id` → alle auf `NULL` setzen (Pläne gehören ans Objekt).
  3. `reservations.room_type_id` → auf `NULL` (nur das Zert-Objekt hat welche).
  4. `room_type_availability`, `room_types` leeren und **droppen** (nach 2./3.).
  5. RPC `create_reservation_atomic` auf den binären Single-Unit-Pfad zurückführen
     (Hotel-Zweig raus); `decrement_room_type_booked` droppen; EXCLUDE-Constraint
     `reservations_no_local_overlap` wieder OHNE die `room_type_id is null`-Ausnahme.
  6. `ari_outbox.room_type_id`, `reservations.room_type_id`, `rate_plans.room_type_id`
     Spalten droppen (nach Code-Deploy, der sie nicht mehr liest — Reihenfolge!).
- **Risiko:** RPC-Umbau ist der heikelste Teil (Doppelbuchungsschutz). Muss gegen die
  Live-DB getestet werden (echte DB, nicht Mock — Memory `echte-db-testen-nicht-mocken`).
- **Migrations-Runner** wie immer: `supabase/apply-migrations.sh`, nie automatisch.

### B. Backend (apps/api)
Entfernen/zurückbauen (Slice → Kern):
- `src/core/room_inventory.py` — der Modus-Schalter. **Löschen**; alle Aufrufer auf den
  FeWo-Pfad festverdrahten.
- `src/features/room_types/` (router/schemas/service + Tests) — **kompletter Slice raus**,
  aus `main.py` aushängen.
- `src/features/reservations/`:
  - `schemas.py`: `room_type_id` aus `ReservationCreate` raus (`rate_plan_id` bleibt).
  - `writes.py`: room_type-Scoping (58-98), Push-Verzweigung (254-263), Move-Block
    (418-429), Storno-Freigabe (758) auf den Single-Unit-Pfad reduzieren.
  - `_base.py`: `_push_hotel_room_type_availability` + `_release_hotel_nights` (257-323,
    442-464) entfernen; nur der binäre Push/Release bleibt.
- `src/worker.py:223-233` — `room_type_id` aus dem ARI-Job raus.
- `src/features/channel_manager/content_sync.py` — Hotel-Zweig (558-768) entfernen; nur
  der synthetische 1-Room-Type-Pfad bleibt. **Wichtig:** auch der synthetische Pfad darf
  nur `count_of_rooms = 1` pushen (heute liest er `occupancy.rooms` → kann >1, Zeile 551).
- `full_sync.py:263-336`, `ari_push.py:317-356,407-454` — kategorie-getrennten Pfad raus;
  `local_unit_ref = property_id` fest.
- `rates/service.py:206-332` — `rate_grid` (kategorie-verschachtelt) und die
  room_type-Bindung von Rate-Plänen zurückbauen; Rate-Pläne hängen am Objekt.
- `bookings_sync.py` — Inbound bleibt (nutzt schon `local_unit_ref = property_id`); die
  Divergenz-Lücke verschwindet mit dem Container-Zweig von selbst.

### C. Frontend (apps/web)
- `lib/room-types.ts` — **löschen**.
- `lib/rates.ts` — `RateGridResponse.room_types[]` → flache Plan-Liste je Objekt.
- `components/objekte/room-types-manager.tsx`, `hotel-rate-grid.tsx` — **löschen**;
  Route `objekte/[id]/zimmerkategorien` + Subnav-Eintrag (`property-subnav.tsx:33`) raus.
- `components/objekte/pricing-form.tsx` — `multiPlan`-Weiche raus; Preise/Pläne immer am
  Objekt.
- `components/kalender/views/rates-view.tsx` — Kategorie-Band raus; eine Plan-Zeilen-Ebene
  je Objekt (Objekt kann mehrere Rate-Pläne haben, aber KEINE Kategorien).
- `components/kalender/calendar-board.tsx` — `bulkPlans` aus room_types (515-533) und die
  „kein Preis für Hotel"-Sonderregel (1807) zurückbauen.
- `components/kalender/bulk-edit-dialog.tsx` — optgroup-nach-Kategorie → flache Plan-Liste.
- `components/stop-sell/stop-sell-calendar.tsx` — Kategorie-Bänder raus; Plan-Zeilen je
  Objekt.
- `messages/*.json` (24 Sprachen) — Namespace `roomTypes` + zugehörige Keys entfernen
  (i18n-Workflow: mergen → tsc → committen → übersetzen).

### D. Was bleibt (ist schon korrekt)
- `/objekte`-Übersicht, `new-property-button.tsx`, `property-meta.ts` (HOTEL_TYPES als
  `property_type`), `app-sidebar.tsx` „Zimmer" → `/objekte`. Rate-Pläne PRO OBJEKT
  (mehrere Pläne je Objekt bleiben erlaubt, z. B. BAR/Non-Refundable) — nur die
  Kategorie-Zwischenebene entfällt.

---

## Das Zert-Testobjekt `956747c8`

Aktuell falsch: 1 Objekt mit 2 room_types (Twin/Double). Für ein sauberes Modell zwei
Optionen:

- **Option Z1 (empfohlen, modellkonform):** Das Zert-Objekt zu **einem** Zimmer machen
  (z. B. „Double Room"), room_types entfernen, die 4 Rate-Pläne auf 2 reduzieren (BAR/B&B
  am Objekt). Für die noch offenen Zert-Tests (#10 ff.) ggf. ein **zweites** Objekt
  „Twin Room" anlegen — dann sind Twin und Double zwei Objekte, wie das Modell es will.
  **Achtung:** Channex-Zert läuft auf das bestehende Testobjekt/die bestehenden
  Room-Type-IDs. Ein Umbau mitten in der Zertifizierung kann die schon abgegebenen
  Task-IDs/Struktur invalidieren → **erst Zert abschließen, dann Zert-Objekt umbauen**.
- **Option Z2:** Zert mit dem aktuellen (falschen) Testobjekt zu Ende bringen, den
  gesamten Rückbau (inkl. Zert-Objekt) als geschlossenes Projekt DANACH.

## Empfohlene Reihenfolge

1. **Jetzt:** falsches Zert-Setup, das ICH angelegt habe, zurücknehmen (die
   `count_of_rooms`-Änderungen Twin 8/Double 4 + die 5 Twin-Testbuchungen) — das ist
   unabhängig vom großen Rückbau und stellt den Stand vor meinem Fehler wieder her.
2. **Zert #10 ff. abschließen** auf dem bestehenden Objekt (Z2), damit die laufende
   Zertifizierung nicht bricht.
3. **Dann** den Container-Rückbau als eigenes Projekt in der Reihenfolge D→C→B→A
   (UI zuerst entkoppeln, dann Backend, Migration/Spalten-Drop zuletzt), jeder Schritt
   mit vollem Qualitätsgate + echter DB-Verifikation.

## Offene Fragen an den Nutzer
- **Rate-Pläne je Objekt:** Sollen mehrere Rate-Pläne pro Objekt (BAR/B&B) erhalten
  bleiben (nur ohne Kategorie-Ebene), oder auch das vereinfachen?
- **Zert-Objekt:** Z1 (nach Zert umbauen) oder Z2 (Container erst nach kompletter Zert)?
- **Timing:** Rückbau direkt nach Zert, oder als späteres, eigenes Arbeitspaket?
