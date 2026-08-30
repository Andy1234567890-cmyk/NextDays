# Monatsbericht — was die vier Wettbewerber tun

**Stand 30.08.2026.** Grundlage für den Bau von `/gaeste/monatsbericht` (die
Route ist in `app-sidebar.tsx` verlinkt, existiert aber nicht — ebenso wenig
`/gaeste/kategorien` und `/gaeste/gutscheine`).

Vier parallele Recherchen, zusammen ~3.100 Zeilen, jede mit Quell-URL und
eigenem Abschnitt „nicht geprüft". Rohberichte im Scratchpad:
`recherche-hostaway.md` (498) · `recherche-lodgify.md` (661) ·
`recherche-guesty.md` (916) · `recherche-smoobu-beds24.md` (1004).

Zugangslage: **keine Konten**. Alles stammt aus offener Doku, Hilfe-Centern
(Zendesk-API im Originalwortlaut, weil der Browser maschinell übersetzt) und
Screenshots in Artikeln. `support.hostaway.com`, `lodgify.com` und das
Beds24-Wiki liefern WebFetch durchgängig **403** — der Weg führt über den
Debug-Chrome und die offenen APIs. Die LAUFENDEN Oberflächen hat niemand
gesehen; das steht in jedem Rohbericht unter H.

---

## 1. Es gibt keine gemeinsame Struktur — vier verschiedene Antworten

| Anbieter | Wie „Bericht" dort organisiert ist |
|---|---|
| **Hostaway** | EIN Bereich `Financial Reporting` mit 6 Unterpunkten: Analytics · Rental Activity · Occupancy Report · Expenses & Extras · Owner Statements · Financial Settings |
| **Lodgify** | `Advanced → Reports`, darin eine ZWEITE Seitenspalte mit 3 Gruppen: Analytics (14 Kennzahlseiten + Overview) · Financial overview (4) · Daily management (3) |
| **Guesty** | KEIN Reporting-Menü. Vier getrennte Welten: Analytics (Standard) · Advanced Analytics (Premium, max. 3 Nutzer, 19 Dashboards) · Listenberichte (der Bericht IST die Reservierungsliste) · Accounting reports (Premium, 15 Berichte) |
| **Smoobu** | Kein Modul. EINE Seite „Statistiken" mit KPI-Karten und drei Ansichten (Charts/Tables/Rechnungen) |
| **Beds24** | Volles Modul `REPORTS`, 25+ Standardberichte in 7 Gruppen, dazu ein Berichtsbaukasten (~150 wählbare Spalten, 32 Kriterien) |

**Folgerung:** Es gibt kein „so macht man das". Die Spanne reicht von einer
Seite (Smoobu) bis zu einem Baukasten mit 150 Spalten (Beds24). Wir müssen
selbst entscheiden, wo wir liegen — die Analyse liefert die Bausteine, nicht
die Antwort.

---

## 2. Die Kennzahlen — und wo sie sich widersprechen

| Kennzahl | Hostaway | Lodgify | Guesty | Smoobu | Beds24 |
|---|---|---|---|---|---|
| Auslastung | `Nights booked × 100 / total nights` | „Occupancy rate" | `booked ÷ **bookable** days` | belegt | über Custom Report |
| ADR | `Revenue / nights booked` | **fehlt** (s. u.) | `ANR` = host payout ÷ Nächte | belegt | — |
| RevPAR | `Revenue / nights available` | **fehlt** | `RevPAL` = ANR × Auslastung | **fehlt** | — |
| Stornoquote | `storniert / (gesamt + storniert) × 100` | „Reservations cancelled" | `storniert ÷ alle` (nach Check-in) | belegt | — |

Drei Dinge, die beim Nachbau zählen:

**Guestys Nenner ist der bessere.** `bookable days` statt `total nights`:
gesperrte Tage zählen nicht als „nicht verkauft". Guesty listet dazu sieben
Sperrarten auf. Hostaway rechnet gegen alle Tage — das drückt die Auslastung
künstlich, sobald jemand einen Wartungsblock setzt.

**Lodgify führt weder ADR noch RevPAR.** Was dort „Average price per night"
heißt, ist mittlerer Buchungspreis ÷ mittlere Buchungslänge — nicht die
branchenübliche ADR-Formel. Wer sich an Lodgify orientiert, baut die
Standardkennzahl der Branche falsch.

**Die Stornoquote hat zwei Nenner.** Hostaway rechnet
`storniert / (gesamt + storniert)`, Guesty `storniert / alle`. Bei 10 aktiven
und 5 stornierten Buchungen ergibt das 33 % gegen 50 %. Wir müssen uns für
einen entscheiden und ihn BENENNEN.

---

## 3. Der Fund, der jeden Monatsbericht trägt: die Zeitraum-Zuordnung

Welcher Buchung welcher Monat zugerechnet wird, ist **die** Entscheidung eines
Monatsberichts — und drei der vier machen sie ausdrücklich sichtbar.

**Beds24** (`Standard-Reports`, wörtlich):

| Wert | Bedeutung |
|---|---|
| `average over stay` | Werte auf die Monate verteilt, nach Nächten je Monat |
| `by check-in date` | Buchungen, deren Anreise im Zeitraum liegt |
| `by check-out date` | Buchungen, deren Abreise im Zeitraum liegt |
| `by booking date` | Buchungen, die im Zeitraum GEBUCHT wurden |

**Hostaway** nennt dasselbe „Event-Filter": `check-in` · `check-out` ·
`creation` · `calendar` — und beschreibt im Update 09/2025 selbst, was vorher
schieflief: *„Bisher wurden Kennzahlen anhand unterschiedlicher Logiken
berechnet, was einen Vergleich der Ergebnisse erschwerte."* Seither steuert
EIN Filter alle Kennzahlen.

**Aber:** Hostaways Auslastungsrate ignoriert den Filter bewusst und rechnet
immer auf Kalenderdaten. Hostaway dokumentiert das als „zu erwarten". Guesty
hat dieselbe Zwei-Klassen-Lage zwischen Analytics und Advanced Analytics.

**Für uns:** Der Bezugszeitpunkt gehört sichtbar in die Oberfläche, nicht in
eine Voreinstellung. Und wenn eine Kennzahl ihm nicht folgen kann, muss das AN
DER KENNZAHL stehen — nicht in einem Hilfe-Artikel. Sonst ist es genau der
stille Widerspruch, den Hostaway fünf Jahre mit sich herumtrug.

---

## 4. Kanal-/OTA-Aufschlüsselung — der Kern der Anforderung

**Alle vier weisen Umsatz je Portal aus.** Die Wege unterscheiden sich:

| Anbieter | Wie |
|---|---|
| **Hostaway** | 4 Wege: Channels-Filter · Diagramm-Gruppierung (Channels/Listings/None) · Formeln „Apply only to specific channels" (→ eigene Spalte je OTA) · Spalte `Channel name` im Export |
| **Lodgify** | 4 Stellen: Seite `Channel revenue` · Seite `Nights per channel` · Zeile `OTA comm.` im Statement · `Booking source` je Buchung |
| **Guesty** | „Revenue by channel"; Portale EINZELN modelliert (Expedia AFE, Booking.com payment processing fee, Airbnb Resolution Center, Total guest payout/Vrbo) |
| **Smoobu** | Buchungsanteil, Umsatz und Nächte je Kanal als Widgets (4 Diagrammtypen) |
| **Beds24** | `Channel occupancy report` (nur namentlich belegt) + Custom Report mit `Sort By` = Kanaldimension |

### Der wichtigste Satz der ganzen Recherche

Hostaway begründet seine Kanalformeln so:

> *„since each OTA calculates totals differently"* — und empfiehlt: *„Ideally,
> you should have a formula for each channel and a sum of all channels."*

Das deckt sich exakt mit unserem eigenen Befund (`total_amount` heißt je Portal
etwas anderes: Airbnb Netto-Payout, Booking Gastpreis brutto). **Kein Anbieter
löst das automatisch.** Hostaway schiebt es dem Kunden als Formel zu, Guesty
modelliert jedes Portal einzeln fest ein.

### Drei dokumentierte Lücken der Wettbewerber

1. **Lodgify zeigt keine Vrbo-Provision.** Wörtlich: `OTA comm.` enthält nur
   Airbnb und Booking.com; *„Commissions paid for Vrbo reservations are not
   shown in this line."* Wer über Vrbo verkauft, sieht seine Provision nicht.
2. **Guestys „Revenue by channel" rechnet auf `Source`, nicht auf `Channel`** —
   Guesty warnt selbst, dass beide auseinanderfallen. Es gibt dort VIER
   Herkunftsdimensionen (Source, Platform, Integration, Point of sale).
3. **Smoobu weist Provision nie aus.** Alles brutto:
   `Umsatz = Übernachtung + Provision + Reinigung + Kurtaxe`.

---

## 5. Was wir übernehmen sollten

**Aus Hostaway:**
- Der EINE Event-/Bezugszeitpunkt-Filter über alle Kennzahlen.
- Spaltenauswahl per Zahnrad rechts neben der letzten Spalte, Drag & Drop.
- Gespeicherte Ansichten mit DYNAMISCHEN Zeiträumen („Letzter Monat", „YTD"),
  gespeichert PRO BENUTZER.
- Die Mehr-Einheiten-Regel: deckt eine Reservierung mehrere Einheiten ab,
  zählen die TAGE, nicht Tage × Einheiten. (8 Einheiten/Woche, zwei
  Reservierungen à 4 → 14 Tage, nicht 56.) **Das trifft unser Datenmodell
  direkt** — 1 Objekt = 1 Typ mit n Einheiten.

**Aus Guesty:**
- `bookable days` als Nenner der Auslastung, nicht `total days`.
- Portale einzeln modellieren statt einen Sammeltopf.
- Zwei CSV-Formate (Komma/Semikolon) — für DE/PL/FR nötig.

**Aus Lodgify:**
- Vergleichszeiträume (bis zu vier vorangehende), grün/rot gegen die Vorperiode.
  Das hat sonst keiner.
- Die Doppelachse `<Kennzahl> by period` und `<Kennzahl> by rental`.

**Aus Beds24:**
- Der Bezugszeitpunkt als SICHTBARE Wahl mit vier Werten.
- Gruppierung Property/Room/Day/Week/Month/Quarter/Year.
- Die Trennung „eingefrorener Buchungswert" gegen „lebende Rechnungswahrheit"
  (s. Warnung unten).

## 6. Was wir NICHT übernehmen

- **Hostaways Formel-Löschung:** eine gelöschte Formel wird überall
  stillschweigend durch `0` ersetzt. Stiller Datenverlust statt lautem
  Fehlschlag (Wurzel 5). Bei uns: Löschen verweigern, solange referenziert.
- **Hostaways geschätzte Booking.com-Provision** (`Gesamtpreis * 0,15`, weil
  die API sie nicht liefert). Ein erfundener Ersatzwert (Wurzel 4). Falls wir
  so etwas anbieten, muss es als SCHÄTZUNG gekennzeichnet sein.
- **Hostaways Mehrwährungs-Verzicht:** wörtlich *„does not support
  multi-currency or currency conversions"*, änderbar ist nur das Symbol — ohne
  Umrechnung. Unser Ansatz (Währung aus den Daten, sonst 422) ist strenger.
  Hier gibt es nichts abzuschauen, wir sind besser.
- **Guestys Export-Sperre** in der Standardstufe (gar kein Export).

## 7. Warnungen aus den Rohberichten

- **Beds24:** `Price`/`Tax`/`Commission` sind *„indicative … not
  recalculated"* — eingefrorene Werte vom Buchungszeitpunkt. Die lebende
  Wahrheit steht in den Invoice-Spalten. Beides in EINER Tabelle mischen
  erzeugt stille Differenzen.
- **Guesty:** Widerspruch in der eigenen Doku — eine Stelle sagt, Analytics
  rechnet Stornos mit, eine andere sagt, nur bestätigte.
- **Smoobu:** zwei ungeklärte Widersprüche — ob „Umsatz" und „GBV" dieselbe
  Zahl sind, und ob die Statistiken exportierbar sind (Marketing sagt
  PDF/Excel/CSV, Hilfe-Center sagt „weder exportieren noch kopieren").
- **Hostaway:** Owner Stays zählen in Analytics **als Direktbuchungen** mit.

## 8. Offene Entscheidungen für den Bau

1. **Umfang:** eine Seite (Smoobu) oder ein Baukasten (Beds24)? Der Menüpunkt
   sitzt unter *Gäste* — das spricht für einen fokussierten Gäste-/
   Buchungsbericht, nicht für ein Finanzmodul (das haben wir bereits unter
   `/eigentuemer/reporting` und `/buchhaltung/berichte`).
2. **Verhältnis zu den bestehenden Seiten:** `/eigentuemer/reporting`,
   `/eigentuemer/reporting/statistiken`, `/buchhaltung/statistik`,
   `/buchhaltung/berichte` existieren schon. Was davon gehört hierher, was
   bleibt dort? Sonst bauen wir die vierte Statistikseite.
3. **Stornoquote:** welcher Nenner (s. Abschnitt 2)?
4. **Die zwei anderen toten Links** (`/gaeste/kategorien`,
   `/gaeste/gutscheine`) — mitbauen oder aus der Sidebar entfernen?

## 9. Nicht geprüft

- **Keine laufende Oberfläche.** Kein Konto bei einem der fünf Anbieter; alles
  stammt aus Doku und Artikel-Screenshots.
- **Guesty:** Spalten von 15 Accounting-Berichten und 14 der 19 Dashboards.
- **Hostaway:** Standard-Spaltenauswahl von Expenses & Extras, Owner Portal,
  Mobile, QuickBooks; die Wizard-Formeln je OTA stehen nur im Bild.
- **Lodgify:** exakte CSV-Kopfzeilen, Währungsfilter-Element.
- **Smoobu:** beide Widersprüche aus Abschnitt 7.
- **Beds24:** Inhalt des `Channel occupancy report` (nur der Name ist belegt).

---

# TEIL 2 — Was bei uns fehlt (Bestandsaufnahme 30.08.2026)

Hostaways sechs Bereiche gegen unseren Ist-Stand. Geprüft am Code, nicht geraten.

| Hostaway-Bereich | Bei uns | Zustand |
|---|---|---|
| **Analytics** (Diagramme, Kennzahlen, Widgets) | `/buchhaltung/statistik` | **ComingSoon-Attrappe** |
| **Rental Activity** (Buchungen als Tabelle, Spaltenwahl) | `/buchhaltung/berichte` | **ComingSoon-Attrappe** |
| **Occupancy Report** (Auslastung) | — | **fehlt ganz** |
| **Expenses & Extras** | `/buchhaltung/ausgaben` | **ComingSoon-Attrappe** |
| **Owner Statements** | `/eigentuemer/reporting` + Slice `owner_reporting` (10 Endpunkte) + `owner_statements` | **echt gebaut** |
| **Financial Settings** (Formeln, Steuern) | `property_taxes`, `subscriptions` (Provision) | teilweise, keine Formeln |

**Der Befund:** Von Hostaways sechs Bereichen haben wir EINEN echt gebaut
(Owner Statements, und der ist stark: `KanalZeile` mit Provision je Kanal,
`MietZeile`, `GebuehrZeile`, `BuchungPosten`, Zeitpläne, Empfänger,
Zahlungsabgleich). Drei sind ComingSoon-Attrappen, einer fehlt ganz.

Dazu die drei toten Sidebar-Links unter *Gäste*: `/gaeste/monatsbericht`,
`/gaeste/kategorien`, `/gaeste/gutscheine`.

## Was das Backend schon kann (und wiederverwendbar ist)

`owner_reporting` liefert bereits:
- `KanalZeile` — Kanal, `ota_name`, Provision, Einkommen, Ausstehendes je Kanal
- `MietZeile` mit `nights`, `BuchungZeile` mit `nights`
- `ReportSummary` mit `nights`
- `StatistikResponse` mit Zeitreihe (`points`), Kategorien, Vorperioden-Vergleich
  (`change_pct`) und Mehrwährungs-Behandlung (`other_currencies`)

**Das ist die halbe Miete.** Was für Hostaways Analytics/Occupancy fehlt, sind
die Kennzahlen selbst: Auslastung, ADR, RevPAR, Stornoquote — und der
Bezugszeitpunkt-Filter.

## Vorschlag: was wo hingehört

Hostaways Modell auf unsere Struktur übertragen, OHNE eine vierte
Statistikseite zu erzeugen:

**`/buchhaltung` wird unser `Financial Reporting`** — die drei Attrappen dort
werden echt:
- `/buchhaltung/statistik` → **Analytics** (Kennzahlen + Diagramme + Widgets)
- `/buchhaltung/berichte` → **Rental Activity** (Buchungstabelle, Spaltenwahl)
- `/buchhaltung/ausgaben` → **Expenses & Extras**
- NEU `/buchhaltung/auslastung` → **Occupancy Report**
- `/eigentuemer/reporting` bleibt, wo es ist (= Owner Statements, fertig)

**`/gaeste/monatsbericht`** wird das, was der Menüpunkt verspricht und was
Hostaway NICHT hat: der Gäste-Monatsbericht — Herkunft, Nächte je Kanal,
Wiederkehrer, Aufenthaltsdauer, Gäste je Objekt. Kein Finanzbericht.

**Zu klären mit dem Betreiber**, bevor gebaut wird:
Soll `/gaeste/monatsbericht` wirklich der GÄSTE-Bericht sein (dann obiger
Vorschlag), oder soll der Menüpunkt das ganze Finanzmodul aufnehmen (dann
gehört er nicht unter *Gäste*, sondern nach `/buchhaltung`)?
