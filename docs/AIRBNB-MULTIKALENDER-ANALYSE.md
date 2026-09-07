# Airbnb-Multikalender — vollständige Analyse

Aufgenommen am 06.09.2026 aus `https://www.airbnb.de/multicalendar` im
angemeldeten Konto (19 Inserate), gelesen über Claude Chrome. **Nur lesend**:
Dialoge wurden geöffnet und mit „Abbrechen" geschlossen, kein „Speichern",
kein „Löschen" — das Konto ist Produktion.

Maße stammen aus `getBoundingClientRect()` bei einem Fenster von 1920 CSS-px,
Farben aus `getComputedStyle`. Sie sind gemessen, nicht geschätzt.

---

## A. Seitenaufbau

```
┌ Globale Kopfzeile (Airbnb-Logo · Heute · Kalender · Inserate · Nachrichten …) ─┐
├──────────────────┬───────────────────────────────────────┬────────────────────┤
│ 19 Inserate      │ [Monat ▾] [Heute]   [Chancen] [Ebenen▾]│                    │
│ [Suche] [Filter] ├───────────────────────────────────────┤   Rechtes Panel    │
│ ─────────────────│ September 2026        ‹            ›  │   (3 Zustände)     │
│ Bild Titel       ├───────────────────────────────────────┤                    │
│      Adresse     │ Fr 4 │ Sa 5 │ So 6 │ Mo 7 │ …         │                    │
│ ⋮ (19 Zeilen)    │ Preiszellen + Buchungsbalken          │                    │
└──────────────────┴───────────────────────────────────────┴────────────────────┘
```

| Element | Maß |
| --- | --- |
| Inserate-Spalte | 280 px breit |
| Tagesspalte | 80 px |
| Objektzeile | 48 px, Trennlinie 1 px `rgb(235,235,235)` |
| Tageskopf gesamt | 146 px hoch (Monatstitel + Wochentagszeile) |
| Buchungsbalken | 24 px hoch, Radius vollrund (`9001px`) |
| Vorschaubild Inserat | 40 × 32 px |
| Heute-Marke | 40 × 40 px, Radius 4 px, `rgb(0,132,137)`, Text weiß fett |

Drei getrennte Rollbereiche, die synchron laufen: Tageskopf (waagerecht),
Inserate-Spalte (senkrecht), Raster (beides). Kein `position: sticky`.

---

## B. Kopfleiste über dem Raster

| Element | Verhalten |
| --- | --- |
| Monatswahl | `<select>`, August 2025 bis Oktober 2029 — 51 Monate, kein freies Datum |
| „Heute" | Knopf, 58 × 28 px, Radius 6 px, Rahmen `rgb(216,216,216)` |
| „14 verfügbare Chancen" | Link auf `/performance/opportunities` |
| „Ebenen ▾" | Menü mit zwei Kästchen: **Preis** und **Regeln**, beide standardmäßig AN |
| ‹ › | „Vorherige Woche" / „Nächste Woche", 32 × 71 px, am Rand des Tageskopfs |
| Monatstitel | wandert beim Rollen mit |

---

## C. Inserate-Spalte

- Überschrift „19 Inserate".
- Suchfeld „Deine Inserate durchsuchen" (181 × 34 px) und daneben der
  **Inserats-Filter** (34 × 34 px).
- Je Zeile: Bild 40 × 32, Titel 12 px/500 `#222`, darunter die interne
  Objektnummer/Adresse 12 px/400 `rgb(106,106,106)`.

### Filter-Panel (vollständig)

**Zimmer und Betten** — drei Zähler mit − / + und dem Wert „Egal" bei 0:
Schlafzimmer, Betten, Badezimmer.

**Ausstattung** — 18 Kästchen, zweispaltig:
Küche, Klimaanlage, Heizung, Waschmaschine, Trockner, Kamin, WLAN,
Kostenloser Parkplatz auf dem Grundstück, Fitnessraum, Pool, Whirlpool, Grill,
Terrasse oder Balkon, Garten, Direkt am Strand, Zugang zum See, Skipiste,
Direkt am Wasser.

**Status des Inserats** — Inseriert / Nicht inseriert (Kästchen, nicht Radios).

**Weitere Optionen** — Sofortbuchung, Inserate als Co-Gastgeber:in.

Fuß: „Filter aufheben" (links) und „Anwenden" (rechts, gefüllt).

---

## D. Tageskopf

Je Spalte zwei Zeilen: Wochentag kurz (14 px/400, `#222`) über der Tageszahl.
Der heutige Tag bekommt das gefüllte Quadrat in `rgb(0,132,137)`.
Die Vorlesehilfe nennt „6. September 2026, Heute".

---

## E. Raster

### Zelle

Jede Zelle ist ein `[role="gridcell"]` mit einem versteckten Satz als
Beschriftung:

```
<Objekt>, <Tag>. <Monat> <Jahr>, [Nicht verfügbar, ]Als Startdatum auswählen.
```

- Preis 12 px/400 `#222`, mittig oben.
- Vergangene/gesperrte Nächte: Überlage `rgba(242,242,242,0.5)` plus diagonale
  Schraffur als Farbverlauf
  `linear-gradient(to left top, #fff 0 calc(50% - 1px), rgb(106,106,106) 50%, #fff calc(50% + 1px) 100%)`.
- Belegte Nächte zeigen **keinen** Preis.
- Ein Klick wählt den Tag als Startdatum, Ziehen wählt ein Rechteck aus
  Objekten × Tagen.

### Buchungsbalken

- Beginnt in der Mitte des Anreisetages, endet in der Mitte des Abreisetages:
  `left = index × 80 + 40 + 2`, `width = Nächte × 80 − 4`. Gemessen: 2 Nächte
  ergeben 156 px.
- Farbe `rgb(0,132,137)`, Text weiß 12 px/700.
- Inhalt: Vorname des Gastes, Gesamtbetrag, und **rechtsbündig am Balkenende**
  ein Status: „Aktueller Gast" bei laufendem Aufenthalt, sonst „Bestätigt".

---

## F. Rechtes Panel, Zustand 1: Regelsätze (Standardansicht)

Überschrift **„Lege deine saisonalen Preise und Verfügbarkeiten fest"**,
darunter eine lange Liste von Karten, unten fest „Neue Regeln erstellen".
Links oben ein Pfeil zum Einklappen.

Eine Karte:

```
A - sæson +30%                     ← Name des Regelsatzes
30 % nächtliche Preiserhöhung      ← Preisregel
10 % Rabatt·Mindestens 2 Wochen    ← Rabattregel
+1 weitere Regeln                  ← klappt den Rest auf
Speichern            Bearbeiten
```

Aufgeklappt erscheint die verborgene Zeile, hier **„Mindestanzahl Nächte: 2"**,
und der Aufklapper wird zu „Weniger anzeigen".

Ein Regelsatz bündelt also **drei Arten von Regeln**:

1. Preisänderung pro Nacht (Prozent, Erhöhung oder Senkung)
2. Rabatte (Aufenthaltsdauer, Last-Minute, Frühbucher)
3. Verfügbarkeits-Anforderungen (Mindestaufenthalt, Check-in-/-out-Tage)

Im geprüften Konto sind es 30 Karten: 22 reine Rabattsätze mit Zahlennamen
(„91769 — 5 % Rabatt·innerhalb von 7 Tagen vor Ankunft", „91771 — 5 % Rabatt·6
Monate im Voraus", „91770 — 7 % Rabatt·3 Monate im Voraus") und 7 benannte
Saisons („A - sæson +30%" bis „G - sæson").

Die Karte hat **keine Eingabefelder** — nur Text und die beiden Knöpfe.

---

## G. Regel-Editor (Dialog hinter „Bearbeiten" und „Neue Regeln erstellen")

Titel „Regeln bearbeiten" bzw. „Neue Regeln erstellen".
Untertitel: „Bearbeite Regeln für Preise und Verfügbarkeit, die für alle
Reisedaten und Inserate gelten."

Erklärblock „So erstellst du Regeln":
1. Gib deiner Regel einen Namen und wähle eine Farbe für die Darstellung in
   deinem Kalender aus.
2. Lege Preisrabatte, Verfügbarkeits-Anforderungen und Werbeaktionen fest.
3. Wähle die Reisedaten und Inserate, für die die Regel gelten soll, in deinem
   Kalender aus.
Dazu ein Link „Mehr über Regeln erfahren".

### Felder

| Bereich | Feld |
| --- | --- |
| Kopf | **Name der Regel – erforderlich** (Textfeld, 242 × 46 px) |
| Kopf | **Farbe**: 8 Radios — Rot, Braun, Orange, Gelb, Grün, Blau, Lila, Rosa |
| Preisgestaltung | **Preis pro Nacht**: „Lege eine Preisanpassung für alle Buchungen innerhalb eines bestimmten Zeitraumes fest. Dies wird vor anderen Preisregelungen angewendet." → Zahlenfeld mit `%` und Wahl **Senkung / Erhöhung** |
| Preisgestaltung | **Rabatte für die Aufenthaltsdauer**: „Füge einen Rabatt für andere Aufenthalte hinzu" → Auswahl der Dauer: 2/3/4/5/6 Nächte, Wöchentlich (1 Woche), 2/3 Wochen, Monatlich (4 Wochen), 5/6/8/10 Wochen |
| Preisgestaltung | **Last-minute-Rabatte**: „Biete einen Rabatt auf den Preis pro Nacht an für Buchungen, die kurz vor der Ankunft getätigt werden." → „Weiteren hinzufügen" |
| Preisgestaltung | **Frühbucher-Rabatte**: „Biete einen Rabatt für Buchungen an, die weit im Voraus …" |
| Hinweis | „Preisregeln haben keine Auswirkungen auf die Inseratspreise, wenn die intelligente Preisgestaltung aktiviert ist." |
| Verfügbarkeit | **Länge des Aufenthalts**: Mindestaufenthalt (Nächte), Höchstaufenthalt (Nächte), Schalter „Passe den Mindestaufenthalt an den Tag des Check-in an" |
| Verfügbarkeit | **Check-in- und Check-out-Tage**: je sieben Schalter „Gäste können nicht einchecken am" / „… nicht auschecken am" (Montage … Sonntage) |
| Fuß | „Diese Reihe von Regeln löschen" · „Abbrechen" · „Speichern" |

Alle Bereiche sind Aufklapp-Zeilen; zugeklappt steht dort die
Zusammenfassung („30 % nächtliche Preiserhöhung", „Mindestanzahl Nächte: 2").

---

## H. Rechtes Panel, Zustand 2: „Ausgewählte Reisedaten"

Erscheint, sobald Tage markiert sind.

| Element | Inhalt |
| --- | --- |
| Zeitraum | zwei **Textfelder** (Startdatum → Enddatum) plus Zurücksetzen-Kreuz |
| Umfang | „1 Inserat" bzw. „2 Inserate" |
| Verfügbarkeit | zwei Radios **Verfügbar / Geblockt** |
| Preis pro Nacht | Feld mit Währungspräfix (`kr`); bei uneinheitlicher Auswahl steht die Spanne, z. B. `682-824` |
| Regeln | `<select>` mit „Keine", allen Regelsätzen und **„Regeln hinzufügen …"** |
| Private Notiz | „Hinzufügen" (aufklappend) |
| Fuß | „Speichern" |

---

## I. Rechtes Panel, Zustand 3: Buchung

Öffnet sich beim Klick auf einen Balken.

```
Buchung
Bestätigt · 4 Gäste · 2 Nächte
[Avatar] Julian Hollingbery
Profil anzeigen · Nachricht
Check-in              Fr., 11. Sept.
Check-out             So., 13. Sept.
Gesamt anreisend      4 Erwachsene
Gesamt-Auszahlung     1.738,16 kr DKK
Private Notiz
Dies wird Gästen nicht angezeigt.  [Textfeld]
[Vollständigen Reiseplan anzeigen]
```

---

## J. Abgleich mit unserem Bestand

| Airbnb | Bei uns vorhanden | Endpunkt |
| --- | --- | --- |
| Raster, Preise, Verfügbarkeit | ja | `GET /calendar/board` |
| Buchungsbalken | ja | `GET /reservations` |
| Sperren / Freigeben | ja | `POST /calendar/block` · `/unblock` |
| Preis je Zeitraum | ja | `POST /calendar/bulk-edit` (Preis, Min-Stay, Sperre, Stop-Sell, CTA/CTD in einem Aufruf) |
| Regelsatz-Name + Farbe | ja, als **Saison** | `GET/POST/PATCH /calendar/seasons` (name, color, mode percent/fixed, amount) |
| Regelsatz einem Zeitraum zuweisen | ja | `POST /calendar/seasons/assign` · `/clear` |
| Preisänderung in Prozent | ja | Saison `mode=percent` |
| Rabatt Aufenthaltsdauer | ja | `property_discounts`, `discount_type=length_of_stay`, `min_nights` |
| Last-Minute-Rabatt | ja | `discount_type=last_minute`, `lead_max_days` |
| Frühbucher-Rabatt | ja | `discount_type=early_booker`, `lead_min_days` |
| Mindest-/Höchstaufenthalt | ja, aber **objektweit** (`rate_plans.min_stay`), nicht je Tag | `bulk-edit` |
| Check-in-/Check-out-Tage sperren | ja | `closed_to_arrival` / `closed_to_departure` je Tag |
| Inserats-Filter | Daten vorhanden (Zimmerzahlen, Ausstattung, Status) | rein clientseitig auf `GET /properties` |
| Private Notiz je Tag | **nein** — `availability` hat keine Notizspalte | — |
| „Verfügbare Chancen" | **nein** — Airbnbs Empfehlungs-Engine | — |
| Gastprofil / Reiseplan | **nein** im Gastgeber-Bereich | — |

Die drei Unterschiede, die beim Bauen zu entscheiden sind:

1. **Regelsatz ist bei uns zweigeteilt.** Airbnb bündelt Preisänderung,
   Rabatte und Aufenthaltsregeln in EINEM Objekt mit Name und Farbe. Bei uns
   trägt die *Saison* Name, Farbe und Preisänderung, die *Rabatte* hängen am
   Objekt und kennen weder Name noch Farbe. Entweder man zeigt sie als eine
   Karte zusammen (dann ist die Zuordnung „welcher Rabatt gehört zu welcher
   Saison" erfunden) oder man trennt sie sichtbar.
2. **Mindestaufenthalt.** Airbnb setzt ihn je Regelsatz und damit je Zeitraum.
   Unser `rate_plans.min_stay` gilt für das ganze Objekt. Ein Panel, das ihn
   neben dem Zeitraum anbietet, verspricht eine Genauigkeit, die die Daten
   nicht haben.
3. **Was „Speichern" auf der Karte tut, ist ungeklärt.** Die Karte hat keine
   Eingabefelder, der Knopf ist trotzdem aktiv. Ohne Klick auf dem
   Produktivkonto lässt sich das nicht feststellen.

---

## K. Nachtrag 06.09.2026 — was am ersten Durchgang offen blieb

Zweiter Durchgang, wieder NUR lesend auf dem Produktivkonto: kein „Speichern",
kein „Löschen". Gemessen wurde über die React-Props der Komponenten und über
die Bedienelemente der geöffneten Dialoge, nicht über Klicks, die schreiben.

### „Speichern" auf einer Regelsatz-Karte = ANWENDEN

Der Knopf speichert nichts. Die Props der Karte (`SeasonalRuleSetListItem`)
sind:

```
seasonalRuleSet: { id, title, color, can_edit, can_be_reused,
                   pricing_rules[], availability_rules{} }
onEdit()      → öffnet den Regel-Editor
onApply()     → DIESER Knopf („Speichern")
showApplyRuleSetsTooltip, dismissApplyRuleSetNux   ← Einführungshinweis
```

Dazu passt Schritt 3 im Dialog „Neue Regeln erstellen" wörtlich: *„Wähle die
Reisedaten und Inserate, für die die Regel gelten soll, in deinem Kalender
aus."* Der Knopf startet also die Zuweisung an eine Auswahl; die deutsche
Beschriftung „Speichern" ist dort eine schiefe Übersetzung von *apply*.

### „Regeln hinzufügen …" ist die letzte Option des Regeln-Feldes

Das Auswahl-Panel hat unter „Regeln" EIN `<select>`:

```
-1        Keine
<id>      <Name jedes Regelsatzes>   ← alle Sätze des KONTOS, nicht des Objekts
add       Regeln hinzufügen …        ← öffnet den Regel-Editor
```

### Auswahl-Panel, vollständige Bedienelemente

| Element | Form | Werte |
| --- | --- | --- |
| Startdatum / Enddatum | zwei Textfelder mit Pfeil dazwischen | `5.9.2026 → 6.9.2026` |
| Eingaben zurücksetzen | Knopf (×) | leert die Auswahl |
| Verfügbarkeit | zwei Radios | `available`, `unavailable_persistent`; ausgegraut, sobald eine Buchung im Bereich liegt |
| Preis pro Nacht | Feld `type=tel` mit Währungspräfix | |
| Regeln | Select (siehe oben) | |
| Private Notiz | Knopf „Hinzufügen" klappt ein Textfeld auf | „Dies wird Gästen nicht angezeigt." |
| Speichern | Submit | deaktiviert, solange nichts geändert ist |

### Ebenen-Menü

Genau zwei Kontrollkästchen, beide standardmäßig an: **Preis** und **Regeln**.

### Regel-Editor, vollständige Feldliste

Preisgestaltung: *Preis pro Nacht* (Prozentfeld + Radios Senkung/Erhöhung),
*Rabatte für die Aufenthaltsdauer* (Select mit 2–6 Nächte, 1/2/3 Wochen,
4 Wochen „Monatlich", 5/6/8/10/12 Wochen — Werte 2,3,4,5,6,7,14,21,28,35,42,
56,70,84), *Last-minute-Rabatte* („Rabatt beginnt N Tage vor Ankunft" + „Rabatt
%", mehrere Zeilen über „Weiteren hinzufügen"), *Frühbucher-Rabatte* („Rabatt
endet N Monate vor Ankunft" + „Rabatt %").

Verfügbarkeit: *Länge des Aufenthalts* (Mindest-/Höchstaufenthalt in Nächten
plus Schalter **„Passe den Mindestaufenthalt an den Tag des Check-in an"** →
sieben Felder „Montage einchecken … Nächte"), *Check-in- und Check-out-Tage*
(je sieben Kontrollkästchen `MONDAY` … `SUNDAY`).

Farben: acht Radios, Werte 0–7 = Rot, Braun, Orange, Gelb, Grün, Blau, Lila,
Rosa (bestätigt am Bestand: `color: 1` = Braun, `6` = Lila).

### Datenform eines Regelsatzes (aus den Props des Beta-Kontos)

```json
{ "id": 651965173, "title": "B - sæson +25%", "color": 1,
  "can_edit": true, "can_be_reused": true,
  "pricing_rules": [
    { "rule_type": "SEASONAL_ADJUSTMENT",        "price_change": 25,  "price_change_type": "PERCENT" },
    { "rule_type": "STAYED_AT_LEAST_X_DAYS",     "price_change": -10, "threshold_one": 14 },
    { "rule_type": "BOOKED_WITHIN_AT_MOST_X_DAYS","price_change": -5, "threshold_one": 7  },
    { "rule_type": "BOOKED_BEYOND_AT_LEAST_X_DAYS","price_change": -5,"threshold_one": 180 }
  ],
  "availability_rules": { "min_nights": { "UNSPECIFIED": 2 },
                          "max_nights": {},
                          "closed_for_checkin": [], "closed_for_checkout": [] } }
```

`min_nights` ist eine Abbildung Wochentag → Nächte; `UNSPECIFIED` ist der
allgemeine Wert. Genau das bildet bei uns `min_stay` + `min_stay_by_weekday`
(0576) ab.

`can_be_reused` zeigt den einen Modellunterschied: dort gehört ein Regelsatz
dem KONTO, bei uns dem Objekt (`property_seasons.property_id`). Wir schließen
die Lücke beim Anwenden statt im Datenmodell — siehe `wendeRegelsatzAn`.

### Die rechte Spalte des Editors WECHSELT ihren Inhalt

Der wichtigste Fund des zweiten Durchgangs, und der einzige, der sich nur mit
einem ECHTEN Klick zeigt: Ein Klick per Skript (`element.click()`) klappt den
Abschnitt zwar auf, lässt die rechte Spalte aber unverändert — deshalb sah sie
zunächst wie eine statische Anleitung aus. Über CDP-Eingabeereignisse wechselt
sie sofort.

Solange kein Abschnitt offen ist, steht dort „So erstellst du Regeln" mit den
drei nummerierten Schritten. Sobald einer geöffnet wird, steht dort eine Karte
mit Titel und Erklärung zu genau diesem Abschnitt, auf seiner Höhe:

| Abschnitt | Karte |
| --- | --- |
| Preis pro Nacht | „Passe deinen Preis pro Nacht an, indem du eine prozentuale Erhöhung oder Minderung hinzufügst. Wenn du deinen Regelsatz auf Reisedaten anwendest, passt es jeden Preis pro Nacht an." |
| Rabatte für die Aufenthaltsdauer | „Wissenswertes zu Aufenthaltsdauer-Preisen — … gelten für die von dir gewählte Anzahl an Übernachtungen oder darüber hinaus. Ein Wochenrabatt gilt also zum Beispiel für mindestens 7 Tage. Ein Monatsrabatte gilt für mindestens 28 Tage. Hinweis: Alle bestehenden Rabatte werden ersetzt." |
| Last-minute-Rabatte | „… solange es weniger als 28 Tage bis zum Check-In sind … Diese Rabatte werden Gästen nicht angezeigt. Hinweis: Alle bestehenden Last-minute-Rabatte werden ersetzt." |
| Frühbucherrabatte | „… die 1 bis 36 Monate im Voraus gebucht werden … Diese Rabatte werden Gästen nicht angezeigt. Hinweis: Alle bereits bestehenden Frühbucherrabatte werden ersetzt." |
| Länge des Aufenthalts | „Füge alle Anforderungen hinzu, die du für Mindest- oder Höchstaufenthalte deiner Gäste hast. Du kannst Anforderungen festlegen, an welchem Wochentag ein Gast einchecken kann. Hinweis: Alle deine bestehenden Anforderungen … werden ersetzt." |
| Check-in- und Check-out-Tage | „Gib Wochentage an, an denen Gäste nicht ein- oder auschecken können. Wenn du deinen Regelsatz anwendest, werden deine bestehenden Anforderungen … ersetzt." |

Der „… werden ersetzt"-Hinweis ist bei uns NICHT übernommen: unser Editor legt
Rabatte einzeln an und löscht einzeln, ersetzt also nichts pauschal. Ein
übernommener Satz wäre eine Falschaussage über unser eigenes Verhalten.

### Maße des Editor-Dialogs

Dialog 1032 × (Inhalt) px, Innenabstand 56 px; Formularspalte 608 px,
Kontextkarte 312 px rechts daneben. Titel und Abschnittsüberschriften
24 px/30 px, Gewicht 800, `#484848`; Abschnittstitel 16 px/20 px, `#222`;
Zeilenhöhe 68 px, Trennlinie 1 px `#EBEBEB`. Namensfeld 242 × 46 px,
Platzhalter „z. B. Hochsaison". Farbkreise 24 px, rund, Farbe mit 30 %
Deckkraft plus 1 px Rand (aktiv: Rand in der Farbe mit 60 %, dazu ein Ring aus
4 px Weiß und 5 px `#222`). Schließen-X oben LINKS, 30 px, runder Umriss.
Fußzeile über die volle Breite: „Abbrechen" als unterstrichener Textlink links,
„Speichern" rechts (Radius 8 px, 18 px/500, Innenabstand 16/32 px, im
deaktivierten Zustand `#DDD`).

## M. Der Kalender EINES Objekts (`/multicalendar/{listing_id}`)

Dorthin führt der Klick auf ein Objekt in der Inserate-Spalte des Rasters.

### Aufbau

| Bereich | Maß | Inhalt |
| --- | --- | --- |
| Fotoleiste links | 56 × 60 je Eintrag, Abstand 84 px | alle Inserate, aktives mit Rahmen; unten „Inserats-Auswahl ausklappen" (48 × 48) |
| Kopf | — | Monatsname als KNOPF (öffnet ein Monatsgitter), rechts „Preistipps" (40 × 40), „Monat" (Ansicht, 102 × 40), „Tastaturkürzel-Fenster öffnen" (40 × 40) |
| Raster | Kachel 169 × 132 | Monate untereinander, Mo–So; je Kachel Tageszahl, Status, Preis; Buchungen als Balken über die Zeile |
| schwebend unten rechts | — | „Heute" (Pfeil hoch) und ein Währungs-Chip |
| Panel rechts | 364 px | „N neue Tipps"-Pille, darunter vier Zeilen mit Chevron |

### Typografie — gemessen, nicht geschätzt

| Element | Wert |
| --- | --- |
| Monatstitel im Kopf | 40 px / 44 px, Gewicht 500, Laufweite −1,2 px, `#222` |
| Monatsüberschrift im Raster | 40 px / 44 px, Gewicht 600, Laufweite −1,2 px |
| Wochentagskopf | 14 px / 18 px, Gewicht 400, `#6C6C6C`, zentriert |
| Tageszahl | 18 px / 32 px, Gewicht 500, `#6C6C6C`, Kreis 32 × 32, zentriert |
| Heute | derselbe Kreis, gefüllt `#DA1249`, Text weiß |
| Preis in der Kachel | 18 px / 26 px, Gewicht 400, `#6C6C6C` |
| Kachelinhalt | ZENTRIERT (nicht linksbündig) |
| Panel-Zeile | 364 × 72; Titel 16 / 20 Gewicht 500 `#222`, Wert 16 / 20 Gewicht 400 `#6C6C6C` |
| Panel-Unterseite | Titel 16 / 20 Gewicht 600 ZENTRIERT; Betrag 47,9 px / 62,3 px Gewicht 700 zentriert; Zurück-Knopf 40 px rund, gefüllt `#F2F2F2`, ohne Rahmen |

### Das Panel hat mehrere Ebenen

Die Zeilen sind keine Sprünge auf andere Seiten, sondern führen im Panel eine
Ebene tiefer (eigene Adresse, aber dieselbe Fläche), mit Zurück-Pfeil oben
links:

```
Preisgestaltung  /pricing-settings          Basispreis · Individueller Wochenendpreis · Gebühren
  Basispreis     …/rates/base               großer Betrag, „Du erhältst … ", Preistipp, „Ähnliche Inserate zeigen"
  Wochenendpreis …/rates/weekend            „Freitag- und Samstagnacht", Betrag, Speichern/Abbrechen
  Gebühren       …/fees                     Reinigung (pro Aufenthalt), Betrag pro Kurzzeitaufenthalt,
                                            Haustiere, zusätzliche Gäste (ab N Gästen/Nacht),
                                            Verwaltung, Gemeinschaftskosten, Bettwäsche, sonstige
Rabatte          /discounts                 Wochen-, Monatsrabatt, Top bewertete Gäste, Last minute,
                                            Frühbucher, Aufenthaltsdauer, benutzerdefinierte Aktion
Verfügbarkeit    /availability-settings     Mindest-/Höchstnächte, Vorankündigung, Vorbereitungszeit,
                                            Verfügbarkeitsfenster, Kalender verknüpfen
Stornierungen    /cancellation              Kurzzeit, Langzeit, nicht erstattungsfähige Option
```

Eine Tagesauswahl bekommt ebenfalls eine eigene Adresse:
`/multicalendar/{id}/edit-selected-dates/{von}/{bis}`.

### Was bei uns davon fehlt und warum

`Stornierungen` (keine Stornorichtlinie am Objekt), `Gebühren`
(Reinigung/Haustiere/zusätzliche Gäste liegen nicht am Objekt des Gastgebers),
`Preistipps`/„N neue Tipps" (Empfehlungs-Engine). Alles drei wäre ohne Daten
eine Attrappe.

## L. Weiterhin nicht geprüft

- „Diese Reihe von Regeln löschen": nicht geklickt (löschende Aktion auf einem
  Produktivkonto).
- Was `onApply` serverseitig sendet: nicht geklickt (schreibende Aktion).
- Tastaturbedienung des Rasters: nicht geprüft.
- „14 verfügbare Chancen" (`/performance/opportunities`): nur als Verweis
  erfasst, die Zielseite nicht ausgelesen.
