# Handover — Preise-Seite auf Branchenstandard, Stand 04.08.2026

Übergabe an die nächste Session. **Ein Themenstrang: die Preise-Seite eines
Objekts** (`/objekte/<id>/preise`), live abgeglichen gegen Lodgify
`/pricing/573936` und auf gleichen Funktionsstand gebracht.

**Alles uncommitted** (Nutzer-Regel: nur auf ausdrückliche Ansage committen).

Im Baum liegen zusätzlich Änderungen aus einer PARALLELEN Session
(`subscriptions/`, `pricing/recompute.py`, `reservations/`, `worker.py`,
`web/lib/erweiterungen.ts`, `supabase/migrations/0277_dynpricing_ledger.sql`,
`deploy/billing/`). **Die gehören nicht hierher** — nicht mit dieser Arbeit in
einem Commit vermischen. `web/lib/erweiterungen.ts` hat gerade einen
Syntaxfehler (typografische Anführungszeichen in einem String, Zeile 76 ff.) und
ist der EINZIGE Grund, warum `tsc` im `web`-Ordner rot ist.

---

## 1. Woher der Auftrag kam

Der Nutzer hat die Lodgify-Seite verlinkt, jeden Knopf durchklicken lassen und
gefordert: *„vergleiche … und baue features die fehlen bei uns ein."* Zwei
Korrekturen kamen während der Arbeit dazu:

1. *„Längenabhängige Preise nur Direktbuchungen — das stimmt nicht, das muss auch
   über channax zu den otas senden!!"*
2. *„Wir müssen es auch umbenennen nach Preise nach Aufenthaltsdauer"* — samt
   Lodgify-Wortlaut der Zeilen („Wochenpreis für den Aufenthalt").
3. *„die logos kleppen zusammen und sind nicht ordentlich posioniert"* → Abstände
   gefixt.

Alle drei sind umgesetzt.

---

## 2. Was fachlich neu ist

### 2.1 Preise nach Aufenthaltsdauer gehen an die PORTALE

Das war vorher als „nur Direktbuchungen" gekennzeichnet — falsch. Ein Wochen-
oder Monatspreis **ist** ein Längenrabatt, und Airbnb kennt ihn als
`STAYED_AT_LEAST_X_DAYS`.

Der Weg ist bewusst **derselbe** wie bei einer Aktion mit Mindestaufenthalt: der
Längenpreis wird in die Form einer `property_discounts`-Zeile gebracht
(`airbnb_aktionen.aktion_aus_laengenpreis`) und durch dieselbe Pipeline
geschickt. Dadurch gelten automatisch dieselben Airbnb-Grenzen, und ein
Längenpreis konkurriert mit einer Aktion um die EINE Regel dieser Art (höherer
Rabatt gewinnt, wie im Resolver). Ein zweiter Übersetzungspfad wäre die zweite
Wahrheit über Airbnbs Grenzen gewesen.

**Zwei Dinge, die man wissen muss:**

- Airbnbs Regel ist **prozentual**, unser Längenpreis ein **absoluter**
  Nachtpreis. Der Prozentsatz kommt aus dem Grundpreis des Objekts
  (`rate_plans`, nur der property-weite Plan; bei mehreren Plänen gibt es keinen
  einen Grundpreis → „nicht darstellbar", kein aus dem zufällig ältesten Plan
  geratener Wert). Läuft der verkaufte Tagespreis auseinander (Wochentagspreise,
  Dynamic Pricing, Datumspreise), trifft der Prozentsatz den absoluten
  Wunschpreis nicht auf den Cent — das ist eine Eigenschaft von Airbnbs Modell,
  nicht unserer Umsetzung.
- Gerundet wird **abwärts**. 8,9 % gehen als 8 % raus. Aufwärts hieße, bei Airbnb
  billiger zu verkaufen als eingestellt — der teurere Fehler. Bleibt 0 % übrig,
  wird nichts gesendet und die Zeile meldet „Manuelle Synchronisierung".

Alle anderen Portale (Booking.com, Expedia, Vrbo …) haben für einen Längenrabatt
kein Feld → sie stehen im Chip „Manuelle Synchronisierung".

**Gegenzustand (Wurzel 1):** jede Änderung an `lengthPrices` reiht
`sync_airbnb_aktionen` ein — `gebuehren.laengenpreise_geaendert`, aufgerufen in
`properties.service.update`. Ohne diesen Anstoß bliebe ein **gelöschter**
Wochenpreis bei Airbnb als Rabatt stehen.

**Rundungsfalle, die ein Test gefunden hat:** `int((1 - 405/450) * 100)` ergibt in
Gleitkomma **9** statt 10 (`1 - 405/450 == 0.09999999999999998`). Deshalb erst
multiplizieren, dann teilen, und vor dem Abschneiden auf sechs Stellen runden.
Hätte man das nicht gemerkt, hätte Airbnb dauerhaft einen Prozentpunkt zu wenig
Rabatt bekommen.

### 2.2 Extras waren eine Attrappe

`type_attributes.pricing.addOns` wurde von **niemandem** gelesen — nicht vom
Preis-Resolver, nicht von der Buchungsstrecke, nicht von der Rechnung. Wer dort
„Wäschepaket 150 kr" pflegte, sah es im Gast-Angebot **nie**. Dieselbe Klasse
Fehler wie die Blob-Promotions davor, deshalb dieselbe Lösung: die Seite pflegt
jetzt den echten Katalog `property_addons` (Migrationen 0074/0075, `lib/addons.ts`),
der vom Resolver gerechnet und auf der Buchungsstrecke verkauft wird. Das
Blob-Feld ist aus `Pricing` **entfernt**, mit dem Grund daneben.

Der Editor `pricing/extra-editor.tsx` hat zwei bewusste Abweichungen vom
Standard: kein Prozent-Modus (`property_addons.price` ist ein Betrag) und statt
„Einschränkungen auf Kanäle" die drei echten Flächen „erscheint in"
(booking_engine/guest_portal/checkin) — Portale haben für ein dazubuchbares
Extra kein Feld.

### 2.3 „Gilt für · Nicht unterstützt von" in jedem Editor

Der Branchenstandard schreibt diese Zeile in **jeden** Editor. Ohne sie sieht
eine Eingabe, die kein Portal je bekommt, genauso verbindlich aus wie der
Grundpreis.

Die Aussage kommt vom SERVER, aus derselben Quelle, aus der der Sync sendet —
eine Regeltabelle in der Oberfläche wäre die zweite Wahrheit, die genau dann
auseinanderläuft, wenn es darauf ankommt. Feste Schlüssel in der
`abgaben-status`-Antwort:

| Schlüssel | Reichweite | Belegstelle im eigenen Code |
|---|---|---|
| `base_price` | jeder verbundene Kanal | `ari_push` (Tagespreis) |
| `extra_guest` | jeder verbundene Kanal | `content_sync._rate_plan_options` (`per_person`) |
| `short_stay` | `internal_only` | nichts sendet ihn; Channex hat keine `logic` dafür |
| `addons` | `internal_only` | `property_addons.appears_in` = drei eigene Flächen |
| `length_prices` | Airbnb ja, Rest `manual_portals` | `airbnb_aktionen` (siehe 2.1) |

Zusätzlich kommt **jeder einzelne** Aufenthaltsdauer-Preis als eigener Posten
(`kind: "length_price"`, `key` = seine Kennung) mit `reason`/`airbnb_reason` —
weil der abgeleitete Prozentsatz beim Abrunden auf 0 landen kann und der Chip
dann nicht „geht raus" behaupten darf.

### 2.4 Längenpreis = Gesamtpreis in der Eingabe

Der Standard führt den **Gesamtpreis** des Aufenthalts („kr 2835"), weil man so
einkauft. **Gespeichert bleibt der Nachtpreis** (`pricePerNight`): nur er ist
eindeutig, wenn die Regel „7 Nächte ODER MEHR" heißt, und nur ihn liest
`_PricingConfig.length_price_per_night`. Der Gesamtpreis ist eine ANSICHT
(`lengthTotal`/`lengthPerNight` in `lib/pricing-meta.ts`), keine zweite Zahl im
Datensatz. Beide stehen in der Zeile, damit niemand rätselt, was bei 9 Nächten
passiert.

### 2.5 Kleineres

- **Grundpreis-Editor**: echter Dynamic-Pricing-Zustand („AN/AUS" + Deep-Link auf
  DIESES Objekt) statt eines Werbetexts mit Link auf die Übersicht. Das
  Grundpreis-Feld ist gesperrt, wenn Wochentagspreise an sind — sonst stehen zwei
  widersprüchliche Zahlen editierbar da.
- **Gebühr** hat jetzt `names` (gastseitiger Name je Sprache, alle 24) wie die
  lokale Steuer. `clean_names` ist von `steuern.py` nach `gebuehren.py`
  gewandert (untere Schicht, EINE Quelle). Die Liste zeigt den Namen, den der
  GAST sieht (`feeDisplayName`).
- **„Preise von einem anderen Objekt übernehmen"** im Seitenmenü ⋯ →
  `POST /properties/{id}/pricing/copy-from`, `properties/preise_kopieren.py`.
  Überschreibt den Preis-Block vollständig und spiegelt den Grundpreis in
  `rate_plans`. Prüft VOR dem ersten Schreiben: Quelle ≠ Ziel, gleiche Währung
  (nie umgerechnet — das wäre ein erfundener Kurs), alle `portalScope` hier
  erfüllbar. Aktionen, Extras und Verfügbarkeit bleiben außen vor, und der
  Dialog sagt das an.
- **Hartcodiertes Deutsch entfernt**: `FEE_BASIS_LABELS`, `TAX_KIND_LABELS`,
  `STAY_KIND_LABELS` enthielten deutschen Klartext — eine dänische Oberfläche las
  „Einmalig pro Aufenthalt". Jetzt `FEE_BASIS_KEYS`/`TAX_KIND_KEYS`/
  `STAY_KIND_KEYS` mit vorhandenen i18n-Schlüsseln, keine neue Übersetzung nötig.

---

## 3. Geänderte Dateien

### Backend (`apps/api/src`)

| Datei | Was |
|---|---|
| `features/properties/preise_kopieren.py` | **neu** — `PreiseKopierenMixin.copy_pricing_from` |
| `features/properties/gebuehren.py` | `clean_names` (hierher gewandert), `names` in `normalize_fees`, `laengenpreise_geaendert`, Kommentar an den toten `add_ons`-Spalten |
| `features/properties/steuern.py` | nutzt `clean_names` aus `gebuehren` statt eigener Kopie |
| `features/properties/service.py` | Mixin eingehängt, `try_enqueue_airbnb_aktionen` bei Längenpreis-Änderung |
| `features/properties/schemas.py` | `PricingCopyRequest`/`PricingCopyResponse` |
| `features/properties/router.py` | `POST /{id}/pricing/copy-from` |
| `features/channel_manager/airbnb_aktionen.py` | `laengenpreis_prozent`, `aktion_aus_laengenpreis`, `laengenpreise_als_aktionen`, `grundpreis_des_objekts`, `laengenpreise_des_objekts`; im Push angehängt |
| `features/channel_manager/abgaben_status.py` | `preisblock_status`, `laengenpreis_mechanik`, Längenpreise in `_aktionen_status` |
| Tests | 4 in `properties/tests`, 3 in `channel_manager/tests` |

### Frontend (`web`)

| Datei | Was |
|---|---|
| `components/objekte/pricing/portal-reichweite.tsx` | **neu** — `PortalReichweite` (Editor-Kopfzeile) + `PortalReichweiteChip` (Karten-Chip) |
| `components/objekte/pricing/extra-editor.tsx` | **neu** — Extra über `property_addons` |
| `components/objekte/pricing/preise-uebernehmen.tsx` | **neu** — Übernahme-Dialog |
| `components/objekte/pricing-form.tsx` | Seitenmenü ⋯, Reichweite-Zeilen, Gesamtpreis, Extras-Sektion auf echten Katalog, `ManuellerSyncChip` ausgelagert, `AddOnEditor`/`BasisSelect` entfernt |
| `components/objekte/pricing/gebuehren-editor.tsx` | mehrsprachiger gastseitiger Name |
| `components/objekte/pricing/preis-bausteine.tsx` | `PreisSeitenkopf` mit `action`-Slot |
| `lib/pricing-meta.ts` | `Fee.names`, `feeDisplayName`, `lengthTotal`/`lengthPerNight`, `*_KEYS` statt deutscher Labels, `AddOn`/`addOns` entfernt |
| `lib/properties.ts` | `copyPricingFrom` |
| `messages/*.json` (24) | 60 neue Keys + 8 umbenannte, alle Sprachen vollständig |

### Doku

`docs/API.md`, `docs/ARCHITECTURE.md`,
`apps/api/src/features/properties/README.md`,
`apps/api/src/features/channel_manager/README.md`.

---

## 4. Qualitätsgate — Stand

| Prüfung | Ergebnis |
|---|---|
| `pytest` (apps/api, vollständig) | **1454 passed**, 6 skipped |
| `ruff check src/` | sauber |
| `pylint` auf allen geänderten Modulen | **10.00/10** |
| `tsc --noEmit` (web) | sauber — **außer** `lib/erweiterungen.ts` (fremde Session, s. o.) |
| `bun run lint` (web) | **0 Fehler** (292 vorbestehende Warnungen) |
| `pruefe-uebersetzungen.mjs web` | 24 Sprachen, 5924 Keys, 0 fehlerhaft |
| `pruefe-locales-vollstaendig.mjs web` | ✓ |
| `kanal-enums-pruefen.mjs` | ✓ |
| `realtime/abos-pruefen.sh` | ✓, inkl. `property_addons` (Grant + Publikation) |
| `next build` | erfolgreich (vor der `erweiterungen.ts`-Fremdänderung) |

---

## 5. Live verifiziert — und was NICHT

Geprüft am Objekt **Alm-Chalet Bergblick**
(`79bbb033-988a-59d9-bed3-6d159eecc9ba`, Grundpreis 320 €, verbunden mit
AirBNB · BookingCom · Vrbo):

- Grundpreis-Chip: `320,00 € │ [airbnb] [Booking.com] [Vrbo]`
- Grundpreis-Editor: „Gilt für Eigene Website · myBestDays · [airbnb]
  [Booking.com] [Vrbo]", „Dynamische Preise: AUS" + Einstellungen; Feld gesperrt
  nach Einschalten der Wochentagspreise
- Kurzaufenthalts-Editor: „Gilt für Eigene Website · myBestDays │ Nicht
  unterstützt von [Booking.com] [Vrbo] [airbnb]"
- Wochenpreis-Editor: „Gilt für … [airbnb] │ Nicht unterstützt von
  [Booking.com] [Vrbo]"; Eingabe **2016** → „Reduzierter Preis pro Nacht
  288,00" abgeleitet
- Zeile nach dem Speichern: `2.016,00 € · 288,00 € / Nacht · Manuelle
  Synchronisierung [Booking.com] [Vrbo] · Mindestaufenthalt` — Airbnb fehlt
  korrekt, weil es die Regel bekommt
- Job `sync_airbnb_aktionen` wurde eingereiht und ist `done`, `last_error: null`

**NICHT verifiziert — und das ist wichtig:** die Übertragung an ein echtes
Airbnb-Listing. **Keine** Zeile in `channex_channel_connection` dieser Datenbank
hat eine `channex_channel_id` für `AirBNB` (live geprüft). `_airbnb_channel_id`
gibt daher `None` zurück und der Push kehrt VOR dem Channex-Call zurück. Der
Code-Pfad und der Job sind belegt, die tatsächliche Regel bei Airbnb ist es
nicht. Das ist die erste Sache, die mit einem echten Mapping nachzuholen ist.

**Residuum:** der Test-Wochenpreis (2016 € / 7 Nächte) steht noch am Objekt. Ein
Klick auf den Papierkorb entfernt ihn.

---

## 6. Offen / nächste Schritte

1. **Airbnb-Regel end-to-end prüfen**, sobald ein Listing mit
   `channex_channel_id` verbunden ist: `POST
   /channel-manager/properties/{id}/aktionen/airbnb-sync` aufrufen und in der
   Antwort `rules[]` gegen `{rule_type: STAYED_AT_LEAST_X_DAYS, price_change,
   threshold_one}` prüfen.
2. **`web/lib/erweiterungen.ts` reparieren** (fremde Session) — bis dahin ist
   `tsc` im `web`-Ordner rot und der Produktionsbuild bricht.
3. **Test-Wochenpreis** am Alm-Chalet entfernen, falls nicht gewollt.
4. **Foto am neuen Extra**: der Upload braucht die Kennung, ist also erst nach
   dem ersten Speichern möglich (der Editor sagt es an). Wenn das störend ist,
   wäre ein zweistufiges Anlegen die Alternative — bewusst nicht gebaut, weil der
   Standard es genauso hält.
5. **`promoReason`-Schlüsselraum** heißt historisch so, trägt aber jetzt auch die
   Gründe der Aufenthaltsdauer-Preise. Die Texte sind allgemein gehalten; ein
   Rename auf `syncReason` wäre Kosmetik über 24 Dateien.
6. **Commit-Trennung** beachten: diese Arbeit NICHT mit den parallelen
   `subscriptions`/`dynpricing`-Änderungen in einem Commit.
