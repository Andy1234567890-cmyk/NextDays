# Prompt — Objekt-Übersicht auf Lodgify-Niveau (Zimmer, Schlafmöglichkeiten, Objekt-Infos)

> Recherche-Stand 01.08.2026. Alle Lodgify-Angaben stammen aus dem Lodgify-Help-Center
> (Artikel-URLs unten), alle Channex-Angaben aus `docs/CHANNEX-FELDER.md` (dort live
> per PUT + Rücklesen geprüft, Stand 01.08.2026). Nichts davon ist geraten.

## Auftrag

Bau die Objekt-Übersicht (`web/components/objekte/property-overview.tsx`,
Route `/objekte/{id}`) auf den Funktionsstand der Lodgify-Rental-Overview (BETA) aus.
Referenz ist der Screenshot der Lodgify-Oberfläche: linke Objekt-Navigation,
Karten-Liste in der Mitte, Bearbeitung in einem Slide-over von rechts.
Struktur übernehmen, Design bleibt myNextDays.

## Ist-Stand bei uns (verifiziert, uncommittet im Arbeitsverzeichnis)

Die Übersicht hat bereits fünf Karten: Name und Beschreibung · Objekt-Infos ·
Zimmer · Schlafgelegenheiten · Ausstattung. Jede öffnet ein Slide-over
(`EditorShell`). Datenlage:

| Bereich | Speicherort | Form |
|---|---|---|
| Größe | `type_attributes.size_m2` | Zahl, Einheit fest m² |
| Einheiten | `type_attributes.units` | Zahl, rein lokal (`FieldLabel channel="local"`) |
| Belegung | `type_attributes.occupancy` | `{children, infants, rooms}` |
| Zimmer | `type_attributes.rooms` | Zählwerk `{privat:{slug:n}, gemeinschaftlich:{slug:n}}` (0244) |
| Schlafgelegenheiten | `type_attributes.beds` | Zählwerk `{slug:n}` (0242) |
| Objekt-Ausstattung | `properties.amenities` | Slugs → Channex `/property_facilities` |
| Zimmer-Ausstattung | `properties.room_amenities` | Slugs → Channex `/room_facilities` (0243) |

Kanal-Badges an den Feldern kommen aus `web/lib/kanal-felder.ts`; die Übersichtsseite
„Was wird synchronisiert?" liegt unter `web/app/(dashboard)/channels/synchronisation/`.

## Was Lodgify hat und wir nicht

**1. Zimmer sind bei Lodgify eigene Entitäten, bei uns ein Zählwerk.**
Lodgify: „Add room" legt ein Zimmer an, mit Typ (Schlafzimmer, Badezimmer, Toilette,
Wohnzimmer, Schlafbereich, …) und einem Schalter privat/gemeinschaftlich. Je Zimmer
gibt es dann Zusatzangaben:
* Bad/Toilette → **en suite** (ja/nein) und, wenn ja, **an welches Schlafzimmer** gekoppelt
* Schlafzimmer / Wohnzimmer / Schlafbereich → **Schlafmöglichkeiten pro Zimmer**
* alle außer Schlafbereich → **eigene Ausstattung pro Zimmer**
* **Fotos pro Zimmer** (Foto-Bereich hat einen Reiter „nach Zimmern"; ein Foto hängt
  an genau einem Zimmer, dasselbe Bild darf mehrfach hochgeladen werden)

Bei uns hängen Betten und Zimmer-Ausstattung am ganzen Objekt, nicht am Zimmer.

**2. Objekt-Infos-Slide-over.** Lodgify fragt dort: Unterkunftstyp · Maßeinheit
(m²/ft²) · Größe (Pflichtfeld) · Gäste (Stepper) · Einheiten (Stepper).
Uns fehlt die Maßeinheit; Typ liegt bei uns in der Namens-Karte; Gäste/Einheiten
sind Zahlenfelder statt Stepper.

**3. Hausregeln in der Übersicht.** Lodgify hat eine eigene Karte „House rules"
(Gästelimit, Haustiere inkl. Anzahl/Art, Events, Rauchen, Ruhezeiten). Bei uns liegt
das unter „Richtlinien" in der Objekt-Navigation — **prüfen, ob dort dieselben Felder
existieren, bevor irgendetwas neu gebaut wird.** Kein Doppelbau.

## Channex-Realität — das begrenzt, was davon überhaupt an Portale geht

Live geprüft (PUT + Rücklesen), dokumentiert in `docs/CHANNEX-FELDER.md`:

* `facilities` am Room-Type: **schreibbar** → Zimmer-Ausstattung geht raus.
* `beds`, `bed_configuration`, `bedrooms`, `bathrooms` am Room-Type: **quittieren 200/201
  und werden verworfen.** Bettenaufstellung geht NICHT über Channex.
* `room_size`, `size`, `square_meters` am Room-Type: **verworfen.**
* Es gibt weder `/bed_types` noch `/room_type_content` (404). Betten erscheinen nur als
  Belegungszahlen (`occ_adults`, `occ_children`, `occ_infants`, `capacity`) und als
  Merkmal im Ausstattungskatalog („Sofa bed").

Daraus folgt hart: **Zimmer-Entitäten, en-suite-Kopplung, Bettenaufstellung und
Zimmergröße sind bei uns lokale Daten** — für die eigene Strecke und myBestDays.
Lodgify sendet Zimmerdetails an Airbnb und Vrbo (laut deren Kanal-Matrix: Zimmer als
Entität ✅ Airbnb, ✅ Vrbo, ❌ Booking.com, ❌ Website; Schlafmöglichkeit-Zuordnung
ebenso; en suite nirgends) — das läuft über deren Direktanbindungen, nicht über einen
Aggregator. Über Channex haben wir diesen Weg heute nicht.

**Konsequenz für die UI:** jedes neue Feld bekommt sein Kanal-Badge aus
`lib/kanal-felder.ts`, und für Betten/Zimmergröße/en suite lautet es „nur myNextDays
und myBestDays". Keine Portal-Logos an Feldern, die Channex verwirft.

## Geprüft am 01.08.2026 — „Einheiten" und „Anzahl Zimmer" sind dasselbe Feld

Beides wurde live gegen Channex-Staging getestet (POST `/availability` + Rücklesen).
Ergebnis, wörtlich aus der Channex-Antwort:

```
count_of_rooms = 3, availability 5 gepusht →
  "Provided value is greater than max availability (3). Value changes to max availability."
count_of_rooms = 1, availability 2 gepusht →
  "Provided value is greater than max availability (1). Value changes to max availability."
Rücklesen: 3 bzw. 1 gespeichert. Testwerte danach auf 0 zurückgesetzt.
```

**`count_of_rooms` ist die harte Obergrenze, wie oft ein Objekt am selben Tag
verkauft werden kann** — exakt Lodgifys „Units". Damit ist entschieden:

* **`type_attributes.units` fliegt raus.** Es ist ein zweites Feld für dasselbe
  Konzept, das bei den Portalen nichts bewirkt — ein Fantasiewert (Wurzel 4).
  Ein Container mit n Einheiten ist nach `CLAUDE.md` ohnehin verboten.
* **`occupancy.rooms` ist keine Zimmerzahl, sondern die Verkaufsobergrenze.**
  Bei „1 Objekt = 1 Einheit" muss `count_of_rooms` fest **1** sein. Das UI-Feld
  „Anzahl Zimmer" in der Belegungs-Box entfällt; `content_sync.py:708` sendet 1.
  Die Zimmerzahl der Wohnung ist ab P1 die Zimmer-Entität und hat mit dem
  Aggregator nichts zu tun.

Warum das heute noch nicht überbucht: der gesamte Push-Pfad ist binär —
`full_sync.py:192` (`base = 1`), `bookings_sync.py:573/907` (1 bzw. 0),
`reservations/writes.py` (Freigabe 1, Belegung 0). Die Lücke ist die Kopplung,
nicht der aktuelle Wert. Betroffener Bestand: **ein** Objekt („Smoke-Testhaus",
`occupancy.rooms = 2`), in Channex steht dafür `count_of_rooms = 2` — also zwei
gleichzeitige Verkäufe erlaubt, sobald jemand availability > 1 pusht.
Migration muss diesen Wert mitziehen und den Room-Type bei Channex nachführen
(Wurzel 1: Gegenzustand).

**Rahmenbedingung:** Solange Booking.com oder Airbnb uns keinen Direktzugang
geben, ist Channex der einzige Weg zu den Portalen. Kein Paket dieses Auftrags
darf einen Direktanschluss voraussetzen.

## Arbeitspakete

**P1 — Zimmer als Entität.**
Migration: Zimmer aus dem Zählwerk in eine eigene Tabelle überführen
(`property_rooms`: id, property_id, typ-slug, privat/gemeinschaftlich, Position, Name
optional). Wurzel 1: bestehende Zählwerke verlustfrei überführen, Lesepfad
(`readZimmer` in `web/lib/property-meta.ts`) versteht das Altformat weiter.
Wurzel 6: RLS **und** `revoke` für anon/authenticated, Spalten-Grants wie bei 0243;
gedanklich per anon-Key-`curl` gegenprüfen — lesen und schreiben.
API: CRUD im `properties`-Slice, jeder `{id}`-Endpunkt mit demselben Tenant-Scope wie
die Liste (Wurzel 3/9), Load und Scope in einem Schritt (`load_scoped`).
UI: Karte „Zimmer" listet die Zimmer, Slide-over legt an/bearbeitet/sortiert.
Realtime: neue Tabelle abonnieren — Grant und Publikation live gegenprüfen, sonst ist
das Abo eine stumme Attrappe.

**P2 — Schlafmöglichkeiten pro Zimmer.**
Betten-Zählwerk vom Objekt an das Zimmer hängen (Schlafzimmer, Wohnzimmer,
Schlafbereich). Objekt-Ebene bleibt als Summe lesbar, damit Listing und Suche nicht
brechen. Bettentyp-Katalog aus `ZIMMER_SLUGS`/Betten-Slugs weiterverwenden, keine
zweite Liste anlegen.

**P3 — Ausstattung pro Zimmer.**
`room_amenities` (0243) von der Objekt- auf die Zimmer-Ebene heben. Was an Channex
geht, ist die Vereinigungsmenge über alle Zimmer — der Aggregator kennt nur einen
Room-Type. Das muss die UI sagen, sonst erwartet der Nutzer eine Zimmer-Auflösung,
die es bei den Portalen nicht gibt.

**P4 — en suite.**
Bad/Toilette bekommt „en suite" plus optionale Kopplung an ein Schlafzimmer
(Fremdschlüssel auf dasselbe Objekt, serverseitig prüfen). Badge: rein lokal.

**P5 — Fotos pro Zimmer.**
Zuordnung Foto → Zimmer (ein Foto genau ein Zimmer), Reiter „nach Zimmern" im
Foto-Bereich, Zuweisen aus der Foto-Liste heraus.

**P0 — Verkaufsobergrenze schließen (zuerst, unabhängig von allem anderen).**
`type_attributes.units` entfernen (Feld, Label, i18n-Keys, Anzeige `unitsSuffix`).
Feld „Anzahl Zimmer" aus der Belegungs-Box entfernen; `content_sync.py:708` sendet
fest `count_of_rooms = 1`. Migration: `occupancy.rooms` und `units` aus
`type_attributes` räumen und für betroffene Objekte einen Content-Resync auslösen,
damit Channex den Room-Type nachzieht. Danach gegen Channex zurücklesen, dass
`count_of_rooms = 1` steht — nicht auf den 200er vertrauen.

**P6 — Objekt-Infos-Slide-over.**
Maßeinheit m²/ft² ergänzen (gespeicherter Wert, keine Umrechnung raten), Größe als
Pflichtfeld, Gäste als Stepper. Kein Einheiten-Feld (siehe P0).

Reihenfolge: P0 → P1 → P2 → P3 → P6 → P4 → P5. P0 schließt die Überbuchungstür,
P1 trägt alles Weitere.

## Regeln (gelten für jedes Paket)

* Ein Objekt = eine buchbare Einheit. Kein Container, keine Zimmerkategorie-Ebene.
* Wurzel 1: jede neue Struktur braucht ihren Gegenzustand — was passiert beim Löschen
  eines Zimmers mit dessen Betten, Ausstattung, Fotos, en-suite-Verweis?
* Wurzel 4: keine Fallback-Werte. Fehlt die Größe, fehlt sie — kein geschätzter Wert,
  keine Umrechnung ohne gespeicherte Einheit.
* Wurzel 6: neue Tabelle → RLS + `revoke` + Spalten-Grant, live gegengeprüft.
* Wurzel 9: `{id}`-Endpunkte prüfen denselben Scope wie der List-Pfad.
* Kein Kunden-Wording „Channex" — im UI heißt es „Portale".
* Realtime statt Reload: keine `load()`-Aufrufe nach eigenen Aktionen.
* i18n: jeder neue Text als Key in allen 24 Sprachen, `pruefe-uebersetzungen.mjs web`
  muss 0 fehlerhaft melden.

## Qualitätsgate

`pytest` grün · `ruff check` sauber · `pylint` 10.00/10 auf den geänderten Modulen ·
`tsc --noEmit` in `web` und `builder` ohne Fehler · Migration über
`supabase/apply-migrations.sh` eingespielt (nie automatisch) · neue Abos gegen die
Live-DB auf Grant und Publikation geprüft.

## Quellen

* Lodgify: [Set up your rental overview (BETA)](https://help.lodgify.com/hc/en-us/articles/24199827644700-Set-up-your-rental-overview-BETA)
* Lodgify: [Manage your rental's rooms details (BETA)](https://help.lodgify.com/hc/en-us/articles/21285360759324-Manage-your-rental-s-rooms-details-BETA)
* Lodgify: [Use the Bookable Units App to increase the number of units](https://help.lodgify.com/hc/en-us/articles/360004960033-Use-the-Bookable-Units-App-to-increase-the-number-of-units)
* Lodgify: [Use bookable units with OTA](https://help.lodgify.com/hc/en-us/articles/360020188139-Use-bookable-units-with-OTA)
* Channex-Feldreferenz (eigene Live-Messung): `docs/CHANNEX-FELDER.md`
* Ausbau-Plan Channel-Manager: `docs/CHANNEL-MANAGER-AUSBAU.md`
