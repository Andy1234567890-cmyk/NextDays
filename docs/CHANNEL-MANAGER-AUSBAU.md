# Channel-Manager-Ausbau — Plan (Stand 31.07.2026)

Ziel: das leisten, was ein etablierter Channel-Manager leistet. Referenz ist der
Lodgify-Artikel „Welche Daten werden über den API-Channel-Manager exportiert und
importiert" (Help-Center 360024014254) — er beschreibt Feld für Feld, was ein
PMS an Airbnb, Booking.com, Expedia und Vrbo schickt, was zurückkommt und was
bewusst im Kanal gepflegt wird.

Gegengeprüft mit zwei weiteren Erhebungen:
* **Channex-API** (docs.channex.io) — was der Aggregator überhaupt annimmt.
* **Unser Code** — `apps/api/src/features/channel_manager/` (13.180 LOC) und
  das Dashboard in `web/`.

> **Ort der Umsetzung:** `/Users/andystaudinger/NextDays/web` ist das reale
> Dashboard. `apps/web/` ist leer (nur ein verwaister `.next`-Ordner) — dort
> gehört nichts hin.

---

## 0. Zwei Dinge, die vor der Umsetzung geklärt werden müssen

1. **Stornobedingungen an Channex.** Die öffentliche v1-PMS-API dokumentiert
   *kein* schreibbares Storno-Feld; `cancellation_policy` erscheint nur lesend in
   der Shopping-API. Unsere eigene Feldreferenz (`docs/CHANNEX-FELDER.md:175`)
   führt die fehlende Storno-Richtlinie dagegen als **kritisch — blockiert
   Booking/Expedia-Connect**. → Bei Channex bestätigen lassen, über welchen
   Endpunkt ein PMS die Policy setzt, bevor Paket 1 gebaut wird.
2. ~~**Zahlungseinzug.**~~ **ERLEDIGT (31.07.2026).** Die Frage war falsch
   gestellt: Es braucht keine Auslegung des Lodgify-Artikels, weil der
   Aggregator es in JEDER Buchung mitliefert — `payment_collect`
   (`property` | `ota` | null) und `payment_type` (`credit_card` |
   `bank_transfer` | null). Beides wird jetzt gelesen (Migration 0240) und in
   der Buchungsansicht angezeigt. Gleiches gilt für `ota_commission`, die vom
   Portal einbehaltene Provision — laut Doku für Booking.com und Airbnb
   verfügbar.

---

## 1. Was Lodgify kann und wir noch nicht

Nur echte Lücken; alles Übrige (ARI-Push, Buchungs-Feed, Storno-/Modifikations-
Diff, Voll-Abgleich, Mapping-Assistent, Portal-Katalog) ist vorhanden und läuft.

| # | Lücke | Heute bei uns | Wirkung |
|---|---|---|---|
| 1 | **Stornobedingungen** | nur Freitext in `important_information` (`content_builder.py:114`) | Booking/Expedia-Anbindung blockiert |
| 2 | **Kanal-Ereignisse unsichtbar** | `channex_webhook_event` wird befüllt, Endpunkte `GET /events` existieren — **keine UI** | Airbnb-Anfragen mit ~24-h-Frist, `sync_error`, `booking_unmapped_room` laufen ins Leere |
| 3 | **Gebühren je Kanal** | nur `taxes[]`; `meal_type`, `children_fee`, `infant_fee` nie gesendet | Reinigungs-/Zusatzgast-Gebühren landen still in der Nachtrate |
| 4 | **Kanal-Aufschlag (Mark-up)** | fehlt ganz | kein kanalabhängiger Preisaufschlag (Lodgify: Pflichtfeld beim Mapping) |
| 5 | **Room-Type-Facilities, Betten, Bundesland** | nur Property-Facilities (`content_sync.py:656`) | dünnes Listing bei Booking/Vrbo |
| 6 | **OTA-Nachrichten** | live gelesen, **nicht gespeichert** (`inbox/service.py:318`) | kein Verlauf, keine Suche, keine Badges, nichts offline |
| 7 | **Reviews** | Endpunkte da (`router.py:602-653`), keine UI | Bewertungen unbeantwortet |
| 8 | **Availability Rules** | CRUD da (`router.py:657-713`), keine UI | kanalspezifisches Aussteuern nur per API |
| 9 | **Sync-Fehler & Retry** | `last_sync_error` nur als HTML-`title`-Tooltip | Fehler faktisch unsichtbar, nur pauschaler Voll-Abgleich |
| 10 | **Multi-Room-Buchungen** | „Split existiert noch nicht" (`bookings_sync.py:453`) | Mehrzimmer-Buchung nur teilweise zugeordnet |
| 11 | **Zahlungen / VCC** | keine Verarbeitung; `channex_booking.raw` speichert die **komplette** Payload | Karten-Metadaten ungefiltert in der DB |
| 12 | **Transparenz „was wird synchronisiert"** | nirgends | Support-Last, falsche Erwartungen |

### Inbound: Felder, die in jeder Buchung ankommen und die wir verwerfen

Erhoben am 31.07.2026 gegen die Buchungs-Doku des Aggregators; alle Angaben mit
`grep` im Slice gegengeprüft (null Treffer = wird nicht gelesen).

| Feld | Inhalt | Stand |
|---|---|---|
| `payment_collect`, `payment_type` | wer einzieht, womit | **erledigt (0240)** |
| `ota_commission` | einbehaltene Portalprovision | **erledigt (0240)** |
| `guarantee` | Kreditkarte, virtuelle Karten mit Guthaben/Gültigkeit | offen — braucht PCI-DSS-Zertifikat + IP-Freigabe beim Aggregator, **keine reine Programmieraufgabe** |
| `taxes[]` je Zimmer | Steuern/Gebühren der Buchung, `is_inclusive` | offen |
| `collected_taxes` | vom Portal **einbehaltene** Steuern (nur Booking.com) | offen |
| `notes` | Anmerkung des Gastes | offen |
| `arrival_hour` | angekündigte Ankunftszeit | offen |
| `rooms[].guests[]`, `occupancy.ages` | Mitreisende, Alter der Kinder | offen |
| `rooms[].is_cancelled` | Teilstorno einzelner Zimmer | offen — Voraussetzung für Paket 12 |
| `meta.cancel_penalties`, `meta.policies`, `meta.meal_plan` | Stornostaffel, Richtlinien, Verpflegung der Buchung | offen |

---

## 2. Pakete

Jedes Paket ist einzeln lieferbar und endet mit einem sichtbaren Ergebnis.

### P0 — blockiert Anbindung und Betrieb

**Paket 1 — Stornobedingungen** (nach Klärung 0.1)
* DB: `cancellation_policies` je Tenant (Titel, Frist, Frist-Typ, Strafe,
  Nichtanreise-Regel) + `properties.cancellation_policy_id`; RLS + `revoke` wie
  bei allen sensiblen Tabellen (Wurzel 6).
* API: Policy an Channex setzen, im Rate-Plan referenzieren; Push beim
  Content-Sync und beim Verbinden.
* `web/`: Policy-Verwaltung im Konto, Auswahl je Objekt, Auswahl im
  Verbinden-Assistenten (Lodgify fragt sie genau dort ab).

**Paket 2 — Kanal-Ereignisse & Fehler-Center** *(größter Nutzen pro Aufwand)*
* `web/app/(dashboard)/channels/ereignisse/page.tsx`: Liste aus `GET /events`,
  gefiltert nach Schweregrad, „erledigt"-Aktion über den vorhandenen
  Resolve-Endpunkt.
* Badge in der Kanal-Navigation; Realtime über `channex_webhook_event` (Tabelle
  ist bereits publiziert, `0132:57-69`) — kein Polling.
* Airbnb-Anfragen (`reservation_request`, Frist!) oben, mit Restzeit.

**Paket 3 — Sync-Status, Fehler und gezielter Retry**
* Panel je Objekt × Kanal: letzter Push, letzter Fehler im Klartext, Anzahl
  offener Outbox-Zeilen, Knopf „nur diesen Bereich erneut senden".
* Backend: Retry-Endpunkt je Outbox-Zeile (heute nur pauschaler Voll-Abgleich).
* Vorsicht: `ari_outbox`/`ari_restriction_outbox` sind bewusst **nicht**
  realtime-publiziert — Status über die API liefern, nicht die Tabellen öffnen.

### P1 — Datenqualität am Listing

**Paket 4 — Gebühren & Verpflegung vollständig**
* `meal_type`, `children_fee`, `infant_fee` am Rate-Plan senden.
* Reinigungsgebühr und Zusatzgast-Gebühr als eigene, benannte Felder statt
  generischer „taxes"-Zeilen; Kennzeichnung, welcher Kanal welche Kategorie
  annimmt (Lodgify: nicht kompatible Gebühren wandern **still in die
  Nachtrate** — das muss die UI sagen).
* `web/`: Gebühren-Tab am Objekt mit Kanal-Kompatibilitätshinweis.

**Paket 5 — Kanal-Aufschlag (Mark-up)**
* Prozentualer Auf-/Abschlag je (Objekt × Portal), abgebildet über
  Channex-`derived`-Rate-Plans.
* Regel aus der Referenz: Airbnb/Vrbo erlauben negative Werte, Booking/Expedia
  nur positive — serverseitig erzwingen, nicht nur im Formular.

**Paket 6 — Listing-Daten vervollständigen**
* Room-Type-Facilities (eigener Channex-Katalog, getrennt von Property).
* Bettenkonfiguration, `state`/Bundesland.
* Währungs-Gleichheit Objekt ↔ Kanal beim Verbinden prüfen (Lodgify warnt
  ausdrücklich; falsche Währung = falsche Preise).

**Paket 7 — Kanal-Transparenz je Feld** *(Kernstück, siehe Abschnitt 5)*
* Zentrale Feld-Kanal-Matrix als einzige Quelle, Badges je Feld mit Kanal-Detail,
  Sichtbarkeit im Anlege-Assistenten, Bereitschafts-Check je Portal und eine
  Übersichtsseite „Was wird synchronisiert?".

### P2 — Betrieb

**Paket 8 — OTA-Nachrichten speichern**
* Threads und Nachrichten persistieren (heute nur Live-Abruf), Anhänge
  referenzieren; Posteingang mit Verlauf, Suche, Ungelesen-Zähler, Realtime.
* Achtung Abgrenzung: das ist der **Channex/OTA**-Posteingang, **nicht** der
  Plattform-Posteingang (`guest_messages`) — zwei getrennte Flächen.

**Paket 9 — Bewertungen**
* Liste, Antwort, Airbnb-Gastbewertung, Score je Objekt; Endpunkte existieren
  bereits vollständig.

**Paket 10 — Availability Rules**
* UI für `close_out`, `availability_offset`, `max_availability` je Kanal und
  Zeitraum — heute nur per API erreichbar.

### P3 — Modellgrenzen

**Paket 11 — Zahlungen / Virtual Credit Card** (nach Klärung 0.2)
* Zahlungsart und Einzugsweg je Buchung sichtbar machen; VCC-Metadaten
  strukturiert statt nur in `raw`.
* Gleichzeitig: `channex_booking.raw` filtern — heute landet die komplette
  Payload inklusive Karten-Metadaten ungefiltert in der DB.

**Paket 12 — Multi-Room-Split**
* Eine OTA-Buchung über mehrere Zimmer in eine Reservierung je Einheit
  zerlegen (genau das macht Lodgify).
* Voraussetzung: der EXCLUDE-Overlap-Schutz greift für OTA-Buchungen derzeit
  nicht (`0156:198-204`) — beim Split mitdenken, sonst entstehen
  Doppelbelegungen ohne DB-Backstop.

---

## 3. Reihenfolge

```
P0: 2 → 3 → 1        (Sichtbarkeit zuerst, dann die Connect-Blockade)
P1: 4 → 5 → 6 → 7
P2: 8 → 9 → 10
P3: 11 → 12
```

Begründung für 2 vor 1: Paket 1 hängt an einer offenen Frage bei Channex,
Paket 2 nicht — und es hebt sofort etwas, das heute schon passiert, aber
niemand sieht.

---

## 4. Regeln, die für jedes Paket gelten

* **Wurzel 1** — jede neue Push-Art braucht ihren Gegenzustand (was passiert
  beim Entfernen einer Gebühr, einer Policy, eines Kanals?).
* **Wurzel 3/9** — jeder neue `{id}`-Endpunkt bekommt denselben Tenant-Scope wie
  die Liste.
* **Wurzel 6** — jede neue Tabelle: RLS **und** `revoke` für anon/authenticated,
  gedanklich per anon-Key-`curl` gegengeprüft (lesen *und* schreiben).
* **Realtime** — neue Listen abonnieren ihre Quelltabellen; Abo nur, wenn Grant
  und Publikation live wirklich stimmen, sonst ist es eine stumme Attrappe.
* **Kein Kunden-Wording „Channex"** — im UI heißt es „Portale".
* **Ein Objekt = eine buchbare Einheit** — kein Container-Zweig, auch nicht für
  Multi-Room (Paket 12 zerlegt in Einheiten, es baut keine Zimmerkategorie).

---

## 5. Paket 7 im Detail — Kanal-Transparenz je Feld

**Anlass:** Heute kennt `packages/ui/src/channel-badge.tsx` genau zwei Zustände:
`ota` („Booking, Airbnb & Co.") und `local` („Nur myNextDays"). Das ist zu grob.
Die Referenz zeigt, dass die Wahrheit **pro Feld × Kanal** unterschiedlich ist:
Beschreibung und Fotos gehen an Airbnb und Vrbo, an Booking.com nur bei Full
Sync, an Expedia **nie**. Reinigungsgebühr geht an Airbnb/Vrbo nur als
Festbetrag. Nicht kompatible Gebühren verschwinden nicht — sie wandern still in
die Nachtrate. Wer das nicht sieht, pflegt ins Leere.

Zusätzlich fehlt die Information genau dort, wo sie am meisten nützt: beim
**Anlegen eines Objekts** (`web/components/objekte/new-property-button.tsx`
fragt heute nur Name, Typ, max. Gäste — ohne jeden Kanal-Hinweis).

### 5.1 Die Matrix (eine Quelle, kein zweites Wissen)

Neue Datei `web/lib/kanal-felder.ts`:

```ts
type Kanalstatus = "voll" | "bedingt" | "portal" | "nein";
// voll    = wird übertragen
// bedingt = wird übertragen, aber eingeschränkt (Grund im Text)
// portal  = existiert dort, muss aber IM Portal gepflegt werden
// nein    = der Kanal kennt das nicht

type Feldregel = {
  feld: string;                 // stabiler Schlüssel, z. B. "beschreibung"
  kanaele: Record<KanalCode, { status: Kanalstatus; hinweis?: string }>;
};
```

Kanäle in der ersten Ausbaustufe: `airbnb`, `booking`, `mynextdays`
(unsere eigene Plattform + Direktbuchung). Danach `expedia`, `vrbo`.

Die Matrix ist **Anzeige-Wissen**, kein Push-Verhalten — sie beschreibt, was der
Server ohnehin tut. Damit sie nicht auseinanderläuft, gehört zu jedem Eintrag ein
Verweis auf die Stelle im `channel_manager`-Slice, die das Feld tatsächlich
sendet (Kommentar mit Datei:Zeile). Ändert sich der Push, ändert sich die Zeile.

### 5.2 Badge mit Kanal-Detail

`packages/ui/src/channel-badge.tsx` erweitern (abwärtskompatibel, `ota`/`local`
bleiben gültig): optional `feld="beschreibung"` → das Badge zeigt weiterhin eine
kurze Kennzeichnung, das Popover listet die Kanäle einzeln:

```
Beschreibung
  Airbnb        übertragen
  Booking.com   nur bei vollständiger Anbindung
  myNextDays    übertragen
```

Portal-Logos aus `web/lib/channel-logos.ts` (nur echte Markenlogos, kein
Platzhalter-Icon). Kein „Channex" im Kundentext — es heißt „Portale".

### 5.3 Anlege-Assistent

`new-property-button.tsx` wird vom Ein-Schritt-Dialog zu einem kurzen Assistenten
(Muster: der vorhandene `onboarding-wizard.tsx`):

1. **Objekt** — Name, Typ, max. Gäste (wie heute), jedes Feld mit Kanal-Badge.
2. **Kanäle** — welche Portale sollen es verkaufen? Airbnb / Booking.com /
   myNextDays-Plattform / Website. Schaltet die drei vorhandenen Achsen
   (`listed_on_marketplace`, `listed_on_website`, Channex-`sync_enabled`) —
   keine vierte erfinden.
3. **Bereitschaft** — je gewähltem Portal die Liste dessen, was noch fehlt
   (siehe 5.4), mit Sprung ins jeweilige Feld. Anlegen ist trotzdem möglich; das
   Objekt startet dann als Entwurf für dieses Portal.

### 5.4 Bereitschafts-Check je Portal

Serverseitig (`GET /channel-manager/properties/{id}/readiness`), damit dieselbe
Prüfung auch der Verbinden-Assistent nutzt und nichts doppelt implementiert wird.
Geprüft wird gegen die Pflichtfelder des jeweiligen Portals, u. a.:

| Prüfung | Airbnb | Booking.com | myNextDays |
|---|---|---|---|
| Titel, Beschreibung, ≥ 1 Foto | ja | ja | ja |
| Adresse + Geokoordinaten | ja | ja | ja |
| Währung gesetzt und = Kanalwährung | ja | ja | ja |
| Stornobedingung hinterlegt | ja | **blockierend** | ja |
| Check-in/-out-Zeiten, Haus-Richtlinien | ja | ja | ja |
| Ausstattung (Property **und** Room Type) | ja | ja | ja |
| Lizenz-/Registriernummer (regional) | je Region | **ja** | nein |
| Belegung (Erwachsene/Kinder/Kleinkinder) | ja | ja | ja |

Ergebnis pro Portal: `bereit` · `unvollständig` (Liste der Felder) ·
`blockiert` (Grund). Dieselbe Anzeige am Objekt-Tab „Kanäle" und im
Kanal-Detail.

### 5.5 Übersichtsseite

`web/app/(dashboard)/channels/synchronisation/page.tsx` rendert die Matrix aus
5.1 als Tabelle Feld × Kanal — das Äquivalent zum Lodgify-Artikel, aus dem
dieser Plan stammt, nur für unsere tatsächlichen Felder. Reduziert Support-Last
und beugt der häufigsten Fehlerwartung vor („ich habe es im Portal geändert und
myNextDays überschreibt es wieder").

### 5.6 Was dabei nicht passieren darf

* **Keine Kopie der Wahrheit.** Die Matrix beschreibt, was der Server sendet.
  Wenn ein Feld laut Matrix „übertragen" ist, aber der Slice es nicht sendet, ist
  das ein Fehler in der Matrix — nicht ein Feature.
* **Kein neues Sichtbarkeits-Flag.** Es gibt genau drei Achsen
  (Portale / Plattform / Website); der Assistent bedient sie, er erfindet keine
  vierte.
* **Ein Objekt = eine buchbare Einheit.** Der Assistent legt für ein Hotel mit
  acht Zimmern acht Objekte an — keine Zimmerkategorie mit `count_of_rooms`.
