# Smoobu-UI — gemessene Design-Wahrheit (02.09.2026)

Quelle der Messung: `https://login.smoobu.com/en/login` über den Chrome-Debug-Port
(`scripts/diagnose/chrome-steuern.mjs`, rohes CDP). Kein Playwright, kein
AppleScript. **Nur lesend** — Felder wurden clientseitig gefüllt, um den
Aktiv-Zustand des Login-Knopfs zu sehen; nichts wurde abgeschickt.

Anlass: Auftrag „iOS- und Android-App für die Eigentümer in diesem UI-Design",
belegt mit einem Smoobu-Marketing-Screenshot (4 Telefone: Smarter Data ·
Manage Rates · Unified Inbox · Dynamic Guide).

## A Aufbau (Login-Seite, gemessen)

| Bereich | Position/Größe |
|---|---|
| E-Mail-Feld | x 163, y 227, 394 × 23 px (Innenmaß des `input`) |
| Login-Knopf | Höhe 41 px, Padding `8px 24px` |
| Icon-Knopf (Passwort-Auge) | 40 × 40 px, Padding 8 px, Radius 100 px |

Die eingeloggte Oberfläche (das Ziel-Design aus dem Screenshot) war **nicht**
erreichbar — siehe Abschnitt H.

## E Gestaltung — GEMESSENE Werte

**Technischer Unterbau:** MUI (Material-UI) v5-Klassen (`MuiButtonBase-root`,
`MuiButton-contained`, `MuiPaper-root`, `MuiIconButton-edgeEnd`). Die
`:root`-CSS-Variablen (`--primary: #007bff` usw.) sind **Bootstrap-4-Werkswerte
aus einem Altbestand-Stylesheet und NICHT Smoobus Marke** — wer sie als
Akzentfarbe übernimmt, baut Bootstrap-Blau nach, nicht Smoobu.

| Token | Gemessener Wert | Beleg |
|---|---|---|
| Akzent (Marke) | `#0F62FE` | Farbe von „Passwort vergessen?", „Jetzt registrieren", „Impressum", „Datenschutzrichtlinie" — allen eigenen Links |
| Ink (Text/Icon) | `#21272A` | `color` der Eingabefelder und Icon-Knöpfe |
| Ink sekundär | `#6D757D` | Label des inaktiven Login-Knopfs |
| Flächen-Grau | `#F2F5FA` | Hintergrund des inaktiven Login-Knopfs |
| Grau (Meta) | `#9A9A9A`, `#343A3F` | häufigste Textfarben nach Ink |
| Linie | `#E5E7EB` | `borderColor` der Trennlinien |
| Grund | `#FFFFFF` | `body` |
| Schrift | **Manrope**, sans-serif Fallback | `fontFamily` aller eigenen Elemente |
| Gewichte | 400 / 500 / 600 / 700 | 600 = Knopf, 700 = Betonung |
| Größen | 16 px Feld · 16 px Knopf · 15 px Fließtext · 12 px Meta | |
| Radius Pill | `100px` | Knöpfe UND Icon-Knöpfe — Smoobu ist Pill-basiert |
| Radius Fläche | `8px`, dazu `4px`, `12px`, `24px`, `32px` | Icon-Buttons 8 px |
| Schatten weich | `rgba(52,58,63,0.13) 0 0 16px 0` | die Smoobu-Karte |
| Schatten mittel | `rgba(0,0,0,0.2) 0 4px 16px 0` | |
| Schatten stark | `rgba(0,0,0,0.3) 0 30px 70px 0` | Overlay/Dialog |

**Fremde Werte, die NICHT übernommen werden:** `#0F62FE`-Treffer im
Cookiebot-Dialog (`CybotCookiebotDialogBodyButton`, Radius 3.75 px, `sans-serif`)
stammen von Usercentrics/Cookiebot, nicht von Smoobu. Ebenso `"Google Sans"`
und `system-ui` in der Fontliste (Drittanbieter-Widgets) sowie der rosa
Inset-Schatten `rgba(255,45,85,0.06)`.

## G Für den Nachbau

Übernommen: Manrope, Akzent `#0F62FE`, Ink `#21272A`, Pill-Knöpfe (100 px),
Flächenradius 8–12 px, weicher Karten-Schatten `0 0 16px rgba(52,58,63,.13)`,
Grau-Flächen `#F2F5FA`, Linie `#E5E7EB`.

Nicht übernommen: die Bootstrap-`:root`-Variablen (Altbestand), Cookiebot-Stile,
Drittanbieter-Fonts.

**Zwei Design-Generationen bei Smoobu — wichtig:** die Login-Seite ist MUI mit
Pill-Knöpfen und weichen Schatten. Der als Vorlage gelieferte Screenshot zeigt
die **ältere** Bootstrap-Generation: eckige gerahmte Karten, blaue Kanalzeilen
im Rate-Grid, Gauge- und Doughnut-Widgets, grüner runder FAB unten rechts,
Kopfzeile mit Hamburger + Lupe + Avatar. Beides gleichzeitig nachzubauen ergibt
einen Stilbruch. Für die Eigentümer-App gilt deshalb die **neuere** Generation
(Manrope, Pills, weiche Schatten) als Zielbild, ergänzt um die im Screenshot
gezeigten Bausteine (Gauge, Doughnut, FAB) in dieser neueren Sprache.

## Aus dem Screenshot GESCHÄTZT (nicht gemessen)

Diese Werte stammen aus der Pixelbetrachtung des Marketing-Bildes und sind
ausdrücklich keine Messung:

- FAB-Grün ≈ `#22C55E`, Durchmesser ≈ 56 px, unten rechts, Schatten.
- Rate-Grid: Kanalzeilen „Airbnb +15 %", „Booking.com +10 %", „Vrbo/HomeAway
  +15 %", „vacation.apart… +10 %", „Agoda +15 %" in Akzentblau; Basispreis-Zeile
  grün beschriftet; Datumsspalten als Kopfzeile (07.05–11.05).
- Occupancy-Gauge: Halbkreis, Skala 0–100 %, Wert mittig groß (63,33 %).
- Doughnut „Revenues / Portal" mit farbigen Segmenten.
- Kopfzeile: Hamburger links, Lupe daneben, Logo mittig, Avatar rechts.

## H Nicht geprüft

- **Die eingeloggte Oberfläche in Gänze** — Dashboard, Kalender, Rate-Grid,
  Unified Inbox, Guest Guide. Grund: `login.smoobu.com` verlangt ein Konto; es
  liegen keine Zugangsdaten vor, und ein fremdes Live-Konto wird nicht
  angemeldet. Alle Aussagen zu diesen Ansichten stammen ausschließlich aus dem
  Marketing-Screenshot und sind oben als geschätzt gekennzeichnet.
- MUI-Theme-Objekt (Paletten-Abstufungen, Spacing-Einheit, Breakpoints): nicht
  aus dem Laufzeit-Theme gelesen, da das Theme nur im gebündelten JS liegt und
  ohne Login keine App-Instanz existiert.
- Hover-, Fokus- und Fehlerzustände der eingeloggten Bedienelemente.
- Dark Mode: nicht geprüft, ob Smoobu einen anbietet.
- Die native Smoobu-App (iOS/Android) selbst — der Screenshot zeigt Telefon-
  Rahmen um Web-Ansichten, ob die App identisch aussieht, ist offen.
