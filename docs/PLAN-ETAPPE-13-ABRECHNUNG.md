# Plan — Etappe 13: Eigentümer-Abrechnung (Stand 07.09.2026)

Grundlage: `docs/PLAN-LASTENHEFT-LUECKEN.md` Etappe 13 (Wunschliste),
Slice `apps/api/src/features/owner_statements` (README dort), UI
`web/components/owner-statements/*`, `web/components/eigentuemer/
owner-statements-for-owner.tsx`, Beleg `web/lib/statement-pdf.ts`.

Migrationen: **0601 ff.** — 0589–0600 sind für Etappen 5/6/8 reserviert,
höchste eingespielte ist 0598.

Anlass, live (07.09.2026): die Abrechnung von **René Dahl Nielsen** (Sprache
`da`, drei FeWo Vidstrup, DKK), Zeitraum 28.07.–31.08.2026, 8 Buchungen.
Eine Website-Buchung (Erwin Kintop, 4.513,75 DKK) reißt die GANZE Abrechnung:
Eigentümer- und Verwaltungs-Auszahlung stehen auf „—“. Das ist der Punkt
„Webseite / Eigentümer – René“ der Wunschliste.

## Entscheidungen des Nutzers (07.09.2026)

1. **Miteigentümer werden gebaut.** ADR-0026 („ein Eigentümer je Objekt“)
   wird durch **ADR-0028** ersetzt (wird mit 13.3 geschrieben). Ein Objekt
   kann mehreren Eigentümern mit Anteil gehören.
2. **Website ist kein Portal, aber eine Buchung wie jede andere:** Portal-Abzug
   0, Verwaltungsprovision (z. B. 20 %) und Pauschale laufen weiter.

## Stand der Umsetzung (07.09.2026, Ende des Tages)

| Schritt                                    | Stand                               | Beleg                                                                                                                   |
| ------------------------------------------ | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 13.1 Website ohne Portal-Abzug             | **fertig** (`c36e5508`)             | René live: `owner_payout` 24.594,29 DKK statt „—"; Erwin Kintop 3.736,00 DKK                                            |
| 13.2 Miteigentümer (0601 + 0602, ADR-0028) | **fertig** (`c36e5508`, `d0aadf2f`) | durch die Oberfläche: zuordnen → 50/50 → entfernen → 100 %; 70/30 → 30/70 → 50/50, Summe je Schritt 100 %               |
| 13.8 Hilfetexte ℹ (neu, Ansage)            | **fertig** (`c36e5508`)             | 6 Spalten + Stammdatenfelder + `sprache-auswahl.tsx`; „alle Informationstexte ins ℹ" projektweit (MEMORY)               |
| 13.3 Abrechnung pro Objekt (**0603**)      | **fertig**                          | live: René nur „FeWo Lille Vidstrup" → 2 Buchungen, 2.358,66 DKK statt 13.394,24; Überschneidungs-409 beim Finalisieren |
| 13.4 Adressat anpassen                     | **fertig**                          | Kopffelder im Entwurf editierbar, Knopf „Aus Stammdaten übernehmen" (`header_aus_stammdaten`)                           |
| 13.5 Sprache des Belegs (**0604**)         | **fertig**                          | René: `language = da` aus Stammdaten; `statementPdf.*` in 24 Sprachen; Zahlen/Datum nach Beleg-Sprache                  |
| 13.6 Sortierung (0604)                     | **fertig**                          | live: `owner_payout desc` → 8.521,34 zuerst; klickbare Spaltenköpfe, je Abrechnung gespeichert                          |
| 13.7 Kanalname vereinheitlichen            | **fertig**                          | `channelLabelLoose` in Editor UND Beleg — kein zweiter Normalisierer                                                    |

**Nummern verschoben:** Im Plan unten steht 13.3 = 0602 und 13.5/13.6 = 0603.
Real ist **0602** der Trigger-Fix (Anteils-Ausschluss über `owner_id`, gefunden
beim Ändern eines Anteils), **0603** = `property_ids`, **0604** = `language` +
`sort_key`/`sort_dir`. Alle vier Migrationen sind live.

**Zwei Befunde beim Bauen, die kein Test fand:**

- Miteigentum war nach 0601 im Datenmodell möglich, aber in der Oberfläche
  NICHT anlegbar — die Auswahlliste filterte fremd vergebene Objekte weiter
  heraus, und der Default `ownership_share = 100` machte jeden Zweiten zu
  100 + x (500 im Log). Gefunden vom Nutzer, nicht von 963 grünen Tests
  (MEMORY „fertig-heisst-durch-die-oberflaeche-bedient").
- Die Fake-DB der Tests hatte für `in_` nur EINEN Slot; `_reservations`
  filtert erst `property_id`, dann `status` — der zweite Aufruf überschrieb
  den ersten. Mit einem Objekt in den Basistabellen fiel es nie auf.

Offen aus 13.8: Hilfetexte auf dem Beleg selbst (das PDF hat keine ℹ).

**Nachtrag 07.09.2026 (abends) — 0605 + Je-Objekt-Sicht:**

- **0605** `column_order text[]`: Spaltenreihenfolge der Buchungstabelle per
  Drag-and-drop im Editor, am Beleg gespeichert → Vorschau und PDF gleich.
- **13.3 ergänzt — „einmal für alle Objekte … und nach Objekten für jedes
  einzelne" (René, 3 Objekte):** Umfang-Dropdown VOR „Speichern" (Alle
  Objekte | je Objekt). Die Gesamtabrechnung trägt je Objekt eine Zeile
  (`listing_rows` jetzt für JEDES Objekt des Umfangs, auch ohne Buchung, mit
  `owner_payout`/Posten/`payout`; Rest `ohne_objekt`), der Beleg eine
  „Übersicht je Objekt", und Vorschau/Herunterladen liefern einen **Auszug je
  Objekt** (Objektsicht der EINEN Abrechnung, ohne eigene Nummer — dieselbe
  Buchung darf nicht zweimal abgerechnet werden, 409 bleibt). Alle Zahlen vom
  Server; das PDF rechnet weiterhin nicht.
- **Zwei Befunde durch die Oberfläche („alles leer", „ich finde keine einzige
  buchung mehr"):** (1) Die Monatsvorbelegung lief über `toISOString()` und
  stand auf 31.08.–29.09. statt 01.09.–30.09. (UTC-Verschiebung, Kopenhagen
  UTC+2) → `lib/dates.lokalIso`/`monatsAnfangIso`/`monatsEndeIso`. (2) Renés
  Objekte haben im September real keine Anreise (letzte 15.08./28.08., nächste
  02.10./23.10.) — keine Lücke im Code. Die zur Klärung eingebaute
  Leer-Diagnose in der Maske wurde auf Ansage wieder entfernt; geblieben ist
  das Server-Log `abrechnung_reservierungen_geladen` (Filter + Treffer).

## Befund vor dem Bau (was heute ist)

| Wunsch                               | Bestand                                                                                                                                                                                                                                                                                                                                       | Lücke                                                          |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Website-Buchung („René“)             | `portal_abzug()` verlangt für JEDEN Kanal Satz oder gemeldete Provision; `website` bietet die Abrechnungsregeln-UI gar nicht an (`KANAELE`, `portal-abzugssaetze.tsx:53`) → `PayoutUnbekannt` → die Zeile UND die Summen stehen auf „—“                                                                                                       | Direktkanäle müssen mit Abzug 0 durch die Kette                |
| Abrechnung pro Objekt                | `owner_statements` kennt nur `owner_id` + Zeitraum; `_reservations` lädt ALLE Objekte des Eigentümers                                                                                                                                                                                                                                         | kein Objektfilter in Schema, UI, Beleg                         |
| Miteigentümer                        | `owner_properties.ownership_share` (0063, Default 100) + `unique(owner_id, property_id)` **sind da**, Eingabe in `owner-detail.tsx:326/786` **ist da**; 0073 legte `unique(property_id)` darüber und `assign_property` weist einen zweiten Eigentümer mit 409 ab; die Rechenkette liest `ownership_share` **nie** (nur Kartei/PDF zeigen ihn) | Sperre lösen, Anteil rechnen, Miteigentümer auf Vorschau/Beleg |
| Eigentümer anpassen                  | Kopf-Snapshot (`owner_name/…`) aus Stammdaten; im Editor `disabled` (`statement-editor.tsx:598–606`), obwohl `PATCH header` es könnte                                                                                                                                                                                                         | Adressat im Entwurf nicht änderbar                             |
| Sprache des Belegs                   | `statement-pdf.ts:122` `const txt = {…}` **hart deutsch**; `locale` = UI-Sprache des BETRACHTERS (`useLocale()`); `owners.language` (0335, René = `da`) wird nicht gelesen                                                                                                                                                                    | René lädt einen deutschen Beleg                                |
| Sortierung                           | Ladereihenfolge (`.order("id")`), keine Option                                                                                                                                                                                                                                                                                                | keine, weder Vorschau noch Beleg                               |
| Kanalname „Booking.com“/„BookingCom“ | `kanalText()` nimmt `ota_name` der Buchung vor dem Label                                                                                                                                                                                                                                                                                      | CSV-Import und Feed schreiben es verschieden                   |

Portal-Login ist von all dem unabhängig: `owner_property_assignments` ist
`unique(user_id, property_id)` — mehrere Eigentümer-Logins je Objekt gehen
heute schon; `owner_can_see_property` (0425) prüft die Mitgliedschaft dort.
0389 (Familienzugänge, zweistufige Sperrfreigabe) bleibt unberührt.

---

## 13.1 Website und Direktkanäle: Portal-Abzug 0, Rest der Kette wie immer

Backend, keine Migration. Zuerst — blockiert reale Abrechnungen.

- `common.py`: `DIREKTKANAELE` aus `core.sales_channels` (keine zweite Liste):
  `website`, `direct`, `phone`, `email`, `walk_in`. `portal_abzug()` gibt für
  sie `PortalAbzug(provision=0, zahlungsgebuehr=0)` zurück, OHNE Satz zu
  verlangen. **Nicht** darunter: `portal` (myBestDays nimmt Provision — dort
  bleibt Satz oder Meldung Pflicht).
- Die Kette läuft danach unverändert weiter: Auszahlungsbasis = Gastpreis,
  Verwaltungsprovision (Vertrag/Eigentümersatz, im Beispiel 20 %), Pauschale,
  Gebühren, Zusatzleistungen, Eigentümer-Anteil. Für Erwin Kintop also
  4.513,75 − 902,75 (20 %) − 50,00 = 3.561,00 DKK Eigentümer-Anteil, sofern
  keine Gebühren.
- `zeilen.py::_portal_saetze`: Direktkanäle nicht bei
  `OwnerBillingService.portal_satz_aufloesen` anfragen.
- Vorschau/Beleg: Portal-Abzug „0,00 DKK“, nicht „—“ (Wurzel 4: ein bekannter
  Wert 0 ist kein fehlender Wert). Der Hinweis „Gedankenstrich = fehlender
  Wert“ bleibt für echte Lücken richtig.
- Tests: Website ohne Satz → Anteil gerechnet, Provision 20 % ausgewiesen;
  `portal` ohne Satz → weiterhin `PayoutUnbekannt` (422 mit Grund).

## 13.2 Miteigentümer (0601, ADR-0028)

- **0601**:
  - `alter table owner_properties drop constraint owner_properties_property_id_key`
    (die 0073-Sperre). `unique(owner_id, property_id)` aus 0063 bleibt.
  - Trigger `owner_properties_anteile_pruefen` (before insert/update, Wurzel 6
    — gilt auch für den DB-Direktpfad): Summe `ownership_share` je
    `property_id` ≤ 100, sonst Exception mit den beteiligten Namen.
    Danach `bash scripts/diagnose/db-trigger-pruefen.sh`.
  - `owner_statements.ownership_share_snapshot numeric(5,2)`: Anteil zum
    Zeitpunkt der Erzeugung (eingefroren wie der Kopf; ändert der Betrieb den
    Anteil später, bleibt der Beleg wahr).
- `owners/service.assign_property`: 409 fällt; stattdessen 422, wenn die
  Anteile mit dem neuen Link 100 überschreiten (dieselbe Regel wie der
  Trigger, in einem Satz für Menschen). `co_owners` (0014) bleibt tot —
  Miteigentümer SIND `owners`.
- Rechenkette `zeilen.py`/`common.auszahlung_berechnen`: der Eigentümer-Anteil
  je Buchung wird mit `ownership_share/100` des Eigentümers AN DIESEM OBJEKT
  multipliziert — NACH Portal-Abzug, Verwaltungsprovision, Pauschale und
  Gebühren (der Betrieb bekommt seine Provision auf das Ganze, geteilt wird
  der Rest). Verwaltungs-Auszahlung bleibt ungeteilt in der Abrechnung des
  jeweiligen Eigentümers ausgewiesen, aber nur anteilig ihm zugeordnet
  (`pm_payout` × Anteil), sonst zählt der Betrieb sie bei zwei Eigentümern
  doppelt.
- Verrechnungsposten (`owner_expenses`): mit `owner_id` → voll diesem
  Eigentümer; nur mit `listing_id` (Objektposten ohne Eigentümer) → anteilig.
  Wiederkehrende Posten je Objekt → anteilig; je Eigentümer → voll.
- Vorschau und Beleg zeigen: Spalte/Zeile „Anteil 50 %“ je Buchung bei
  Anteil < 100; im Kopf unter dem Eigentümer die Miteigentümer desselben
  Objekts mit Anteil („Miteigentümer: Lene Dahl Nielsen 50 %“) — die Liste
  kommt aus `owner_properties` der abgerechneten Objekte.
- „Auswählen“: die Eigentümer-Seite zeigt bei Objekten mit mehreren Eigentümern
  einen Umschalter „Abrechnung für: René · Lene“ (springt zur Abrechnung des
  Miteigentümers, jede Abrechnung bleibt je Eigentümer — kein Sammelbeleg).
- Owner-Rolle: sieht wie bisher nur die eigenen Abrechnungen
  (`_fuer_owner_sichtbar`, Wurzel 9); Miteigentümer-Namen auf dem Beleg sind
  Stammdaten, die er sowieso kennt.
- `auto-run`: je Eigentümer, unverändert — jeder Miteigentümer bekommt seine.
- **ADR-0028** „Miteigentümer über `owner_properties.ownership_share`“ ersetzt
  ADR-0026 (Status dort: _ersetzt durch 0028_). Lastenheft §6 wird damit
  umgesetzt, `REQUIREMENTS-GAP.md` nachziehen.

## 13.3 Abrechnung pro Objekt (0602)

- **0602**: `owner_statements.property_ids uuid[] null` — NULL = alle Objekte
  des Eigentümers (Bestand bedeutungsgleich). CHECK: nicht leer, wenn gesetzt.
- Schema: `property_ids: list[str] | None` in Generate/Update/Preview,
  `StatementResponse.property_ids`.
- Service: `property_ids ⊆ _owner_property_ids(owner)` sonst 422 (Wurzel 3/9);
  Reservierungen, Listing-Zeilen, wiederkehrende und Verrechnungsposten
  filtern über EINE Funktion (Wurzel 1). Finalisieren: 409, wenn eine
  finalisierte Abrechnung desselben Eigentümers Zeitraum UND Objektmenge
  überschneidet (heute fehlt diese Prüfung ganz — kommt mit).
- `auto-run` bleibt `property_ids = NULL`.
- UI: Objekt-Mehrfachauswahl (Checkboxen, Standard alle) neben dem Zeitraum;
  Liste zeigt die Objektmenge; Beleg-Kopf nennt sie („Objekte: FeWo Lille
  Vidstrup“ / „alle Objekte“).

## 13.4 Adressat anpassen

Keine Migration. Kopf-Felder im Status `draft` editierbar (das `disabled`
fällt; `PATCH header` existiert), Knopf „Aus Stammdaten übernehmen“ →
`_header_from_stammdaten`. Finalisiert → read-only (bestehende 409-Regel).
Storno-Beleg übernimmt den Snapshot des Originals (schon so).

## 13.5 Sprache des Belegs (0603)

- **0603**: `owner_statements.language text null` (BCP-47 wie `owners.language`).
  Snapshot beim Erzeugen über die bestehende Kette
  `core.mail_sprache.aufloesen(owner.language, tenant.default_language)` →
  `en` als letzte Stufe (dieselbe Regel wie Mail, keine zweite Kette). Im
  `draft` per `PATCH` änderbar (Dropdown der 24 App-Sprachen); finalisiert
  eingefroren.
- Beleg-Texte: `txt` aus `statement-pdf.ts` nach `web/messages/<lang>.json`
  Namensraum `statementPdf.*` — 24 Sprachen über `scripts/i18n/uebersetzen.py`
  (Quelle flach!), danach `pruefe-uebersetzungen.mjs web` und
  `deutsche-restwerte-pruefen.mjs`. `buildStatementHtml(statement, texte, …)`
  bekommt die Texte des Beleg-Sprachraums; Zahlen/Datum nach
  `statement.language`, NICHT mehr nach `useLocale()` des Betrachters. Alle
  fünf Aufrufer (`statement-editor`, `statement-preview-modal`,
  `my-statements`, `portal-berichte`, `owner-statements-for-owner`).
- Dashboard-Vorschau bleibt in der UI-Sprache des Mitarbeiters; nur der BELEG
  (Modal + PDF) folgt der Beleg-Sprache — Hinweiszeile „Beleg in Dansk“.

## 13.6 Sortierung von Vorschau und Beleg (in 0603)

- `owner_statements.sort_key text not null default 'check_in'` (CHECK
  `check_in|check_out|property|guest|channel|gross|owner_payout`) und
  `sort_dir text not null default 'asc'`. Je Abrechnung gespeichert, damit
  Vorschau und Beleg gleich stehen.
- Server sortiert `rentals` in `_to_response`; Preview/Update nehmen beide
  Felder an. UI: klickbare Spaltenköpfe in `RentalActivity`, gespeichert per
  `PATCH` (draft) bzw. lokal (Vorschau ohne id).

## 13.7 Kanalname vereinheitlichen

`kanalText()`: `ota_name` nur, wenn es NICHT auf einen bekannten Kanal
normalisiert (`booking.com`/`bookingcom` → Label `calendar.channel.booking`).
Anzeige-Regel, kein Datenumbau.

## 13.8 Hilfetexte am ℹ-Symbol (Ansage 07.09.2026)

_„wichtig auch das die Eigentümer und berechnungsseite einfache hilfe texte
bekommt ℹ icon das versteht keiner"_ — **fertig für die Tabellenspalten.**

Die Seite hatte 12 Hilfetexte, aber keinen an den Spalten, die die Rechenkette
zeigen. Genau dort entsteht die Frage: „Provision" konnte die des Portals oder
die des Betriebs sein, und „Portal-Abzug 0" sah aus wie ein fehlender Wert.

Neu mit ℹ: Kanal, Portal-Abzug, Provision, Pauschale, Eigentümer-Anteil,
Gesamt-Auszahlung — jeder Text in einfacher Sprache und mit dem, was ihn vom
Nachbarn unterscheidet (z. B. „fällt bei JEDER Buchung an, auch bei einer über
die eigene Website"). Der `th`-Helfer nimmt dafür einen `info.*`-Schlüssel;
`InfoHinweis` gab es schon. 24 Sprachen über `uebersetzen.py`.

Noch offen: die Eigentümer-Stammdatenseite (`/eigentuemer/[id]`) und der
Beleg selbst.

---

## Reihenfolge und Gates

1. 13.1 → Slice-Tests → allein deploybar (René bekommt eine Zahl).
2. 13.2 → 0601 → Trigger-Prüfskript → Tests (Anteil 50/50, 100/0, Summe > 100
   → 422/Trigger) → UI → ADR-0028, ADR-0026 ersetzt, REQUIREMENTS-GAP.
3. 13.3 → 0602 → Tests → UI.
4. 13.4 (UI).
5. 13.5 + 13.6 → 0603 → i18n-Lauf → fünf Beleg-Aufrufer.
6. 13.7.

Je Schritt: `uv run pytest src/features/owner_statements src/features/owners -q`
(nur die Slices), `ruff`, `pylint` auf geänderte Module, `tsc --noEmit` +
`bun run lint` in `web`; Migrationen einzeln über
`supabase/apply-migrations.sh`; `bash scripts/realtime/abos-pruefen.sh`
(keine neue Tabelle). Wurzel-Check: 1 (Filter/Anteil an EINER Stelle), 2
(Finalisieren idempotent, Überschneidungs-409), 3/9 (Objektfilter ⊆
Eigentümer; Owner sieht nur finalized/invoice), 4 (Abzug 0 ist 0; Sprache nie
erraten, Kette endet in `en`), 5 (`PayoutUnbekannt` bleibt 422 mit Grund),
6 (Anteils-Trigger auch am Direktpfad; `owner_statements` bleibt server-only).

## Nicht in dieser Etappe

-
- Sammelbeleg für alle Miteigentümer eines Objekts (jede Abrechnung bleibt je
  Eigentümer).
