# Framer — rechte Seitenleiste (Style · Agent): alle Funktionen und was uns fehlt (05.09.2026)

Auftrag: *„das ist nicht alles, besonders rechts die Sidebar fehlt komplett."*
Gegenstück zu `FRAMER-CANVAS-FUNKTIONEN.md` (Fläche). Hier: jede Zeile, jedes
Feld, jede Klappliste, jeder Popover der rechten Leiste, je Elementart.

| Quelle | Datei | Umfang |
|---|---|---|
| **Live** Text-Element (28.08.) | `FRAMER-STYLE-PANEL-ANALYSE.md` | 13 Abschnitte, Popover Text Effect/Scroll Animation/Color/Text Styles, Styles-Kopfmenü (12+9), Transform-Menü, Agent-Reiter |
| **Live** Breakpoint · Stack · Bild · Nichts (05.09.) | `FRAMER-LAYERS-INSPEKTOR-ANALYSE.md` §C | Border-/Shadow-Popover, Effects-Menü mit Lightbox/Ticker |
| **Live** CMS-Liste · Grid · Fill-Popover · Link/Button (05.09.) | `FRAMER-STYLE-INSPEKTOR-ANALYSE.md` | Content-Popover (Filter/Order/Pagination), Grid/Masonry, Fill 5 Reiter, New Tab |
| **Doku** offizielle Hilfe/Updates/Dictionary/Developers | `FRAMER-INSPEKTOR-DOKU-RECHERCHE.md` | 150 belegte Felder, Trigger-System, Property Controls, Agent-Modelle |
| **Wir** Inventar unserer Inspektoren (nur gelesen) | `BAUKASTEN-INSPEKTOR-INVENTAR-2026-09-05.md` | 84 Bedienelemente, „nur im Datenmodell" |

Spalte **Wir**: ✓ vorhanden · ◐ teilweise · ✗ fehlt · — nicht sinnvoll (Grund im
Hinweis). „Modell" heißt: seit Etappe 2 im Datenmodell (`schemas_darstellung.py`)
und im Renderer (`baukasten-stil`) vorhanden, aber **ohne Eingabefeld** — das
Inventar bestätigt per grep, dass kein `position`/`groesse`/`stil`/`transform`/
`scroll`/`a11y`/`je_geraet` je aus der Oberfläche geschrieben wird.

**Kernbefund:** Framers Inspektor ist EIN Panel für JEDE Elementart, aus drei
Zeilenmustern gebaut (Zeile · geteilte Zeile · Chip-Zeile), Abschnitte erscheinen
je Elementart, leere Abschnitte haben einen „+"-Kopf mit Menü, Werte sind
Verweise auf Projekt-Stile (Farben, Textstile) und je Breakpoint überschreibbar.
Wir haben drei verschiedene Inspektoren (Container · Baustein · Region) plus ein
Design-Panel, jeder mit eigenem Aufbau, ohne Stil-Verweise, ohne Overrides.
Die größten Lücken: **Styles** (Füllung/Radius/Grenze/Schatten/Überlauf/Filter),
**Effects** (alle), **Position/Size-Modi**, **Text-Abschnitt am Element**,
**Variablen/Stile als Verweise**, **Breakpoint-Overrides**, **Agent**.

---

## 0 Aufbau und Muster

| Nr | Funktion | Framer | Wir | Hinweis |
|---|---|---|---|---|
| 0.1 | Ein Panel rechts (260 px), Reiter Agent · Style; Abschnitte nach Elementart | Live A | ◐ | drei getrennte Inspektoren links im Panel; Reihenfolge und Karten unterschiedlich |
| 0.2 | Drei Zeilenmuster: Label+Wert (239×40) · geteilt Zahl 61 + Liste 63 · Chip mit Remove | Live G | ✓ | `InspektorZeile`, `FeldZeile`, `Segment`, `Zahlfeld`, `Schieber` vorhanden; kein Chip-Muster, keine geteilte Zeile mit Modus-Liste; Etappe 3: `StilZeile` (Label+Wert, geteilt Zahl+Modus), `Chip`, `PlusKarte` in `editor/stil-felder.tsx` |
| 0.3 | Abschnittskopf: „+" öffnet Menü (leer) · gefüllt: Zuklappen; gesetzte Einträge grau mit Häkchen | Live A/F | ✓ | `InspektorKarte` klappt; kein „+"-Menü je Abschnitt; Etappe 3: `PlusKarte` — „+" öffnet Suchmenü, gesetzte Einträge grau mit Häkchen, gefüllt klappt der Kopf zu |
| 0.4 | Ausrichtungsleiste 8 Knöpfe (Align L/H/R/T/V/B, Distribute H/V) mit Kürzeln | Live A1 | ✓ | 6 Knöpfe für Container-Kinder, keine Kürzel, kein Distribute; Etappe 3: 8 Knöpfe (L/H/R, T/V/B, Verteilen H/V) mit ⌥A/H/D/W/V/S, ^⌥H/V |
| 0.5 | Berechnete Werte als grauer Platzhalter (Höhe bei Fit) | Live F | ✓ | |; Etappe 3: gemessene Breite/Höhe aus `rects` als Platzhalter (`Zahlfeld.platzhalter`) |
| 0.6 | Suchfeld in Kopfmenüs („Type to search…") | Live B7 | ✓ | |; Etappe 3: Suchfeld im „+"-Menü jeder Karte |
| 0.7 | Werte als Verweis auf Projekt-Stile (Farbstile mit Namen, Textstile), „New Style", „Edit" | Live B9a/B9b | ◐ | Designfarben-Palette mit Verknüpfung (Rollen), Text-Rollen — aber nicht am Element wählbar, nur im Design-Panel |
| 0.8 | ⊕ neben Wert: an Variable binden | Layers-Analyse C1/C2 | ✗ | Etappe 4 |
| 0.9 | Override je Breakpoint blau, „Reset Override" | Doku 20.x, Style-Analyse | ✓ | Kaskade + `herkunft()` seit Etappe 2 im Paket, keine UI (Etappe 3); Etappe 3: Label blau + ↺ auf Tablet/Mobil (`herkunft`), geerbter Wert mit Gerätesymbol; Gerätezeile oben im Inspektor |
| 0.10 | „Mixed" bei Mehrfachauswahl | Live B9 | ✗ | keine Mehrfachauswahl im Inspektor |
| 0.11 | Copy Style · Paste Style · Copy Fill | Kürzel Edit | ✗ | |
| 0.12 | Panel wechselt sofort mit Auswahl; Klick auf leere Fläche → Seiten-Style (Typography/Template) | Live D | ◐ | Inspektor wechselt; ohne Auswahl leeres Panel statt Seiten-Einstellungen |

## 1 Link

| Nr | Funktion | Framer | Wir | Hinweis |
|---|---|---|---|---|
| 1.1 | Link To: Page · URL · Section (Scroll Section) · Email · Phone · File · Overlay | Live B1, Doku 1.1 | ◐ | Links nur als Inhaltsfeld einzelner Bausteine (Button, Bild), nicht an jedem Element |
| 1.2 | New Tab Yes/No (erscheint nur bei gesetztem Link) | Live D1 | ◐ | nur bei Button-Baustein |
| 1.3 | Kopfmenü Rel (nofollow/sponsored/ugc/noopener) · Parameters (UTM weiterreichen) · Tracking | Live B1, Doku 1.3–1.4 | ✗ | |
| 1.4 | Smooth Scroll zu Section | Doku 1.2 | ◐ | Scroll-Anker seit Etappe 2 im Modell (`scroll.anker`), kein Feld; Etappe 3: Anker-Feld in Karte „Scroll-Abschnitt"; Link-Ziel per `#anker` noch von Hand |
| 1.5 | Link Styles: Decoration (Color/Style/Thickness/Offset), Hover-Transition | Doku 1.5–1.6 | ◐ | Text-Rollen: Linkfarbe normal/hover/besucht, Unterstreichung ja/nein |

## 2 Position

| Nr | Funktion | Framer | Wir | Hinweis |
|---|---|---|---|---|
| 2.1 | Type Relative · Absolute · Fixed · Sticky | Live B2 | ✓ | Modell `position.typ`; Etappe 3: Karte „Position" |
| 2.2 | Pins/Constraints oben/rechts/unten/links, Mitte, X/Y | Doku 2.7 | ✓ | Modell `position.oben…links`; Etappe 3: vier Kantenabstände mit Einheit, sobald Typ ≠ relativ |
| 2.3 | Z-Index | Doku 2.8, Styles-Kopfmenü | ✓ | Modell `position.ebene`; Etappe 3: „Ebene" (−10…100) über „+" |
| 2.4 | Absolute/Fixed innerhalb von Stacks | Doku 2.6 | ✗ | Renderer setzt `position: relative` am Elternteil (Etappe 2), kein Feld |

## 3 Size

| Nr | Funktion | Framer | Wir | Hinweis |
|---|---|---|---|---|
| 3.1 | Width/Height Zahl + Modus Fixed · Relative · Fill · Fit Content · Viewport · Fit Image (Bild) | Live B3, C2/C3 | ✓ | Container: Spaltenbreite in Zwölfteln, Min-Höhe, Max-Breite als Zahlen; Modell `groesse.breite/hoehe` mit Modus; Etappe 3: Zahl + Modus-Liste je Achse; Messwert grau bei Füllen/Inhalt |
| 3.2 | Text: Grow Auto Width · Auto Height · Fixed Size | Live B3 | ✗ | |
| 3.3 | Min Max „Add Size Constraint" (Min/Max Width/Height, vh) | Live B3, Doku 3.3–3.5 | ✓ | Modell `groesse.min_/max_*`; Etappe 3: Min/Max Breite/Höhe über „+", px/%/vh/vw |
| 3.4 | Kette Lock Aspect Ratio, ⇧ beim Ziehen | Live C1, Doku 3.6–3.7 | ✓ | Modell `groesse.seitenverhaeltnis`; Etappe 3: Kette rastet das gemessene Verhältnis ein, Feld für „16 / 9" |
| 3.5 | Fit Text (Schrift skaliert mit Breite) | Doku 3.2 | ✗ | |
| 3.6 | Max Width zusätzlich bei CMS-Liste (Rel/Fixed) | Live B1 (Inspektor) | ✓ | `max_breite` am Container |

## 4 Layout

| Nr | Funktion | Framer | Wir | Hinweis |
|---|---|---|---|---|
| 4.1 | Type Stack · Grid | Live B3 (CMS) | ◐ | Stack-Eigenschaften ja; Grid nur als feste Spalten-Vorlagen |
| 4.2 | Direction Horizontal/Vertical · Distribute Start/Center/End/Space Between/Around/Evenly · Align Start/Center/End · Wrap Yes/No · Gap | Layers C1/C2 | ✓ | `layout_richtung/verteilen/ausrichten/umbruch/abstand` (ohne Space Evenly) |
| 4.3 | Padding mit „Padding \| Padding per side" | Layers C1 | ✓ | Abstandsfeld je Seite, Kette links/rechts |
| 4.4 | Grid: Masonry Yes/No · Columns mit Stepper · Gap Spalte/Zeile getrennt · Advanced (Min Column Width/Auto-fill) | Live B3 (Inspektor), Doku 4.3–4.5 | ✗ | |
| 4.5 | Right-to-Left Direction | Doku 4.2 | ✗ | |
| 4.6 | Stack Variables (Gap/Padding/Direction als Komponenten-Variable) | Doku 4.1 | — | keine Komponenten |
| 4.7 | Layout Grid als Hilfslinien je Breakpoint | Doku 4.6 | ✗ | Canvas-Liste 1.10 |

## 5 Content (CMS Collection List)

| Nr | Funktion | Framer | Wir | Hinweis |
|---|---|---|---|---|
| 5.1 | Source (Collection wählen) | Live B2 | ◐ | Objekt-/Beitrags-/Bewertungslisten sind feste Bausteine mit eigenen Feldern (Anzahl, Filter je Typ) |
| 5.2 | State Default · Empty (gestalteter Leerzustand) | Live B2, Doku 19.2 | ✗ | |
| 5.3 | Filters: Feldwähler (alle Felder der Collection), Operator, Dynamic Filters (Search, Tabs, Toggles, Dropdown, Checkboxes, Number, Date), Clear Filters | Live B2a, Doku 19.3–19.4 | ◐ | Objektliste hat feste Filter (Region, Gäste …); Beitragssuche-Baustein |
| 5.4 | Sorting: Order-Dialog Field/Richtung, mehrere Regeln | Live B2b, Doku 19.5 | ◐ | feste Sortierung je Baustein |
| 5.5 | Pagination · Limit · Start Offset · Infinite Scroll | Live B2c, Doku 19.6–19.9 | ◐ | `limit` bei Beiträgen/Objekten; keine Pagination, kein Offset, kein Infinite Scroll |
| 5.6 | Gallery Field | Doku 19.10 | — | Galerie ist eigener Baustein |

## 6 Effects

| Nr | Funktion | Framer | Wir | Hinweis |
|---|---|---|---|---|
| 6.1 | Kopfmenü mit Suche: Appear · Hover · Press · Loop · Drag · Lightbox · Ticker · Scroll ▸ (Animation · Speed · Transform · Variant) · Flow | Layers C2, Style B4 | ✗ | Etappe 5 (`settings.effekte`), noch nicht im Modell |
| 6.2 | Appear/Text Effect: Trigger On Appear · Layer in View · Section in View; Preset Blur/Flip/Shake/Shoot/Rotate/Scale/Stagger/Custom; Per Character/Word/Line/Element; Enter-Chip; Delay | Style B4a | ✗ | |
| 6.3 | Scroll Animation: Trigger On Appear · On Scroll · Layer in View · Section in View; Start (3 Knöpfe); Replay Yes/No; Preset Fade In/Scale In/Scale In Bottom/Flip H/V/Slide In T/L/R/B/Custom; Enter/Exit-Chips | Style B4b | ✗ | |
| 6.4 | Hover · Press (Fill, Shadow, Transform-Ziele) | Doku 5.2–5.3 | ✗ | Editor-Felder nicht live gemessen (H) |
| 6.5 | Loop (Mirror, Delay je Wiederholung) | Doku 5.4 | ✗ | |
| 6.6 | Drag (Sections als Grenze) | Doku 5.5 | ✗ | |
| 6.7 | Lightbox (Bild → Overlay, CMS in einem Klick) | Doku 5.6 | ◐ | Galerie-/Objektgalerie-Baustein hat eigene Lightbox (`lichtkasten.tsx`), nicht als Effekt an beliebigem Bild |
| 6.8 | Ticker (Laufband, je Breakpoint, Draggable) | Doku 5.7 | ✗ | |
| 6.9 | Scroll Speed (Parallax) · Scroll Transform (beliebige Eigenschaft über Scrollposition, sequenzierbar) · Scroll Variant | Doku 5.8–5.11 | ✗ | |
| 6.10 | Flow (Nachbarabschnitte animieren mit, z. B. Akkordeon) | Doku 5.12 | ✗ | |
| 6.11 | Stagger (Versatz in Listen) | Doku 5.13 | ✗ | |
| 6.12 | Transition: Spring (Time/Bounce) · physikalischer Spring · Ease/Bezier; Duration, Delay | Doku 5.14 | ✗ | |
| 6.13 | Effekt-Marker an der Ebene im Layers-Panel | Doku 5.16 | ✗ | |

## 7 Overlays

| Nr | Funktion | Framer | Wir | Hinweis |
|---|---|---|---|---|
| 7.1 | Relative („Dropdowns, popovers") · Fixed („Modals, toasts, videos") | Style B5 | ◐ | Pop-ups als eigene Seiten mit Auslöser (delay/exit/scroll), nicht am Element |
| 7.2 | Trigger-System: Actions (Show Overlay, Set Variant) · Conditions (Repeat, Cookie, Parameter, Visited Pages, Start/End, Form Submit, Link Click, Include/Exclude Page) · Interactions (Time, Scroll %, Exit) · Tracking | Doku 6.5–6.10 | ◐ | Regeln-Bereich (`regeln`) mit Zeit/Scroll/Exit-Auslösern für Hinweisleisten und Pop-ups; keine Cookie/Parameter/Visited-Bedingungen |
| 7.3 | Dynamic Safe Area, Collision Detection, Backdrop-Transitions | Doku 6.2–6.4 | ✗ | |

## 8 Cursor

| Nr | Funktion | Framer | Wir | Hinweis |
|---|---|---|---|---|
| 8.1 | Web Cursor (CSS-Cursor-Liste) · Custom Cursor (Komponente, Replace/Follow) · Set Variant | Style B6, Doku 7.x | ✗ | |

## 9 Styles

| Nr | Funktion | Framer | Wir | Hinweis |
|---|---|---|---|---|
| 9.1 | Opacity Zahl + Schieber (⊕) | Style B7 | ✓ | Modell `stil.opazitaet`; Etappe 3: Zahl + Schieber in % |
| 9.2 | Visible Yes/No (⊕) | Style B7 | ✓ | `hidden_on` je Gerät; Modell `stil.sichtbar`; Etappe 3: Ja/Nein; `hidden_on` bleibt daneben die Geräteliste |
| 9.3 | Fill „Add…" → Popover mit 5 Reitern Solid · Linear · Radial · Conic · Image; Hex/RGB/HSL/P3, Alpha, Pipette, Projekt-Farbstile mit Suche, New Style; mehrere Fill-Ebenen mit Blend | Live B4 (Inspektor), Doku 8.2 | ◐ | Hintergrundfarbe (Hex) + Hintergrundbild + Abdunkeln nur an Abschnitten; Modell `stil.fuellung` (farbe/verlauf/bild, Rollen); Etappe 3: Popover mit Farbe · Verlauf · Bild, Hex+Deckung, Farbrollen; ohne Radial/Conic (nicht im Modell), ohne mehrere Ebenen |
| 9.4 | Image-Fill: Fit Fill/Fit/Stretch/Tile, Alt, Crop, Patterns (8 Presets) | Doku 8.3, 8.6 | ◐ | Bild-Baustein: Alt, kein Fit/Crop; Modell `fuellung.groesse/lage/wiederholen`; Etappe 3: Größe/Lage/Kacheln/Abdunkeln im Bild-Reiter; kein Crop, keine Patterns |
| 9.5 | Masking (Gradient/Bild-Masken), Shader-Fills (Liquid, Holo …), Video-Fill | Doku 8.4–8.5 | — | |
| 9.6 | Overflow Clip · Visible · Hidden · Scroll · Auto; Overflow X/Y getrennt | Layers C1, Doku 8.7–8.8 | ◐ | Modell `stil.ueberlauf`; Etappe 3: eine Liste (sichtbar/verborgen/abschneiden/scrollen); X/Y nicht getrennt (nicht im Modell) |
| 9.7 | Radius mit „Radius \| Radius per corner", px/%, Squircle | Layers C2/C3, Doku 8.9 | ◐ | nur Button-Ecken global (sharp/rounded/pill); Modell `stil.radius`; Etappe 3: Radius | je Ecke mit Übertrag beim Umschalten; kein %, kein Squircle |
| 9.8 | Border-Popover: Color · Width · Style Solid/Dashed/Dotted/Double, per side | Layers C2 | ✓ | Modell `stil.grenze`; Etappe 3: Breite · Farbe · Art · Seiten; Entwurf bis beide Pflichtfelder stehen |
| 9.9 | Shadows-Popover: Type Box/Realistic · Position Outside/Inside · Color · X Y Blur Spread; mehrere gestapelt | Layers C2, Doku 8.10 | ◐ | Modell `stil.schatten[]`; Etappe 3: bis 6 Schatten als Chips, X/Y/Weich/Ausbreitung/Farbe/Innen; kein „Realistic" |
| 9.10 | Kopfmenü (12): Blending · Draggable · Filters ▸ (Blur, BG Blur, Brightness, Contrast, Grayscale, Hue, Invert, Saturate, Sepia) · Mask · Overflow · Overflow X · Overflow Y · Pointer Events · Selection · Tap Color · User Select · Z Index | Style B7 | ✗ | nichts davon |
| 9.11 | Backdrop Filter / Blur, Blend Mode | Doku 8.11–8.12 | ✗ | |
| 9.12 | Selection Colors (Text-Markierungsfarben) | Style B10, Doku 8.13 | ✗ | |
| 9.13 | Set as Default Fill · Reset Default Frame Fill | Canvas B.8/B.2.4 | ✗ | |

## 10 Transforms

| Nr | Funktion | Framer | Wir | Hinweis |
|---|---|---|---|---|
| 10.1 | Kopfmenü: Scale · Skew · Rotate · Depth · Perspective · Origin · Backface · Preserve 3D; Zahl + Schieber je Wert | Style B8, Doku 9.1 | ◐ | Modell `transform.*` (ohne Depth/Backface/Preserve 3D); Etappe 3: Drehung · Skalierung · Versatz · Neigung · Ursprung · Perspektive über „+"; ohne Depth/Backface/Preserve 3D |
| 10.2 | 3D (Rotate X/Y/Z), Element bleibt auf der Fläche editierbar | Doku 9.1 | ✗ | |

## 11 Text (am Textelement)

| Nr | Funktion | Framer | Wir | Hinweis |
|---|---|---|---|---|
| 11.1 | Styles-Chip (Tag + Name + Größe), Popover mit Stil-Liste, New Style, Edit Style mit Breakpoints L/M/S | Style B9/B9a, Doku 10.2 | ◐ | Text-Rollen global im Design-Panel (DFLT/PAR/H1–H6, Größe Desktop/Mobil); Zuordnung nur per Überschriftenebene, kein Stil-Wähler am Element |
| 11.2 | Content (Textfeld) | Style B9 | ✓ | Inhaltsfelder je Baustein |
| 11.3 | Font (Picker mit Kategorien, Variable-Filter) · Weight (alle Schnitte) · Color (Farbstil oder Wert, „Mixed") | Style B9, Doku 10.6 | ◐ | Schrift/Stärke/Farbe nur je Rolle global |
| 11.4 | Size px/rem/Fit · Letter em/px · Line em/px/% | Layers C4, Doku 10.5 | ◐ | Größe/Laufweite/Zeilenhöhe nur je Rolle |
| 11.5 | Align Start/Center/End/Justify · Direction Auto/Fixed | Style B9 | ◐ | Ausrichtung als Baustein-Feld bei einigen Typen |
| 11.6 | Transform (uppercase) · Decoration · Balance · Truncate/Max Lines | Doku 10.4, 10.8–10.9 | ◐ | Großbuchstaben je Rolle; kein Balance/Truncate |
| 11.7 | Variable „Add…" (Rich Text Variable) · OpenType „Add…" (Stylistic Sets, Ligaturen) | Layers C4, Doku 10.7 | ✗ | |
| 11.8 | Text Shadow | Text-Rollen | ✓ | je Rolle keiner/weich/hart (Framer hat das nicht als eigene Zeile) |

## 12 Typography · Template · Breakpoint (Seite / Breakpoint gewählt)

| Nr | Funktion | Framer | Wir | Hinweis |
|---|---|---|---|---|
| 12.1 | Typography Base 16 PX mit −/+ (rem-Basis je Breakpoint) | Layers C1, Doku 11.1 | ◐ | Überschriften-/Textgröße in % global; keine rem-Basis |
| 12.2 | Template „+" (Layout Template zuweisen: Navigation, Footer, Banner) | Layers C1/C5, Doku 12.1 | ◐ | Site-Layout-Theme (klar/mitte/karte/seitlich), Kopf-/Fußzeile als Regionen (Etappe 2b) |
| 12.3 | Breakpoint: Position X/Y · Width Fixed/Relative/Fill/Fit · Height +Viewport · Kette | Layers C1 | ✗ | drei feste Breiten |
| 12.4 | Layout des Breakpoints (Stack/Grid, Gap ⊕, Padding) | Layers C1 | ◐ | Breite & Abstand: Inhaltsbreite px/vw, Abstand vertikal/horizontal |
| 12.5 | Styles der Seite: Fill · Overflow | Layers C1/C5 | ◐ | Hintergrundfarbe global |
| 12.6 | Selection Colors der Seite | Layers C1 | ✗ | |

## 13 Scroll Section · Accessibility · Code Overrides

| Nr | Funktion | Framer | Wir | Hinweis |
|---|---|---|---|---|
| 13.1 | Scroll Section „+": Name (#anker) · Offset Y; Marker im Layers-Panel | Layers C2, Doku 15.x | ✓ | Modell `scroll.anker/versatz_y`, kein Feld; Etappe 3: Anker + Versatz oben; Versatz erst mit Anker |
| 13.2 | Accessibility „+": Tag (div/section/…/h1–h6/p/span) · Aria Label · Tab Index · Google Bot (Skip) | Style B12, Layers C2, Doku 16.x | ◐ | Modell `a11y.*`, kein Feld; Bild-Alt vorhanden; Etappe 3: Element · Beschriftung · Tab-Reihenfolge · für Vorlesehilfen verborgen; kein Google-Bot-Schalter |
| 13.3 | Reduced Motion (Site-Einstellung) | Doku 16.5 | ✗ | |
| 13.4 | Code Overrides „+": File Select…/New File… (JS-Override) | Layers C2, Doku 17.x | — | Etappe 4: CSS-Override mit Allowlist, kein JS (Wurzel 8) |

## 14 Komponenten · Variablen

| Nr | Funktion | Framer | Wir | Hinweis |
|---|---|---|---|---|
| 14.1 | Komponenten-Instanz: Variablen-Felder (Text, Number, Boolean, Color, Enum, Image, Link, Date, File, Event, Instance, Array, Object …), Variant-Wahl, Detach/Reset Overrides | Doku 18.x, Menü Component | — | keine Komponenten; Bausteine haben feste Katalog-Felder |
| 14.2 | ⊕ „Create Variable" an jeder Eigenschaft, Conditionals (Color/Number Transforms) | Doku 18.18, Layers C2 | ✗ | Etappe 4 (Site-Variablen Text/Zahl/Bool/Farbe/Option) |

## 15 Agent (Reiter)

| Nr | Funktion | Framer | Wir | Hinweis |
|---|---|---|---|---|
| 15.1 | New Chat-Klappliste (Verlauf) + „+" | Style C | ✗ | Etappe 6 |
| 15.2 | Textfeld „Ask Framer…", Send/Shift-Enter/Cmd-Enter, Prompt-Historie ⌥↑/↓ | Style C, Kürzel Agent | ✗ | |
| 15.3 | Modellwahl je Chat (GPT 5.6 Terra Standard · Sonnet 5 · Opus 4.8 · Fable 5) mit Reasoning-Stufen, Credit-Anzeige | Style C, Doku 23.x | ✗ | Wir: OpenAI-Anbieter geplant, Nutzungszähler vorhanden |
| 15.4 | Kontext: Select (Element wählen, ⌃A Agent Select) · Add (Datei/Bild) · „Add To Agent" im Kontextmenü | Style C, Canvas B.8 | ✗ | |
| 15.5 | Fähigkeiten: Seiten bauen, Breakpoints, Effekte, Komponenten, Code, CMS, Styles, 3D-Transforms | Doku 23.1, 23.7–23.8 | ✗ | Wir: strukturierte Änderungen als Vorschlag mit Übernehmen/Verwerfen (Plan) |
| 15.6 | „Out of credits"-Zustand mit Upgrade | Live | — | |

---

## 16 Zählung

| Zeilen | ✓ | ◐ | ✗ | — |
|---|---|---|---|---|
| 98 | 21 | 31 | 40 | 6 |

Von 92 für uns sinnvollen Inspektor-Funktionen sind 21 vollständig da, 31
teilweise, 40 fehlen (Stand nach Etappe 3, 05.09.2026 — vorher 5 / 32 / 55:
die 19 Modell-Felder aus Etappe 2 haben ihr Eingabefeld; Gerüst und Felder aus
§17 Schritt 1 und 2 stehen in `web/components/website/editor/stil-inspektor.tsx`,
`stil-felder.tsx`, `fuellung-feld.tsx`).

## 17 Reihenfolge des Nachbaus (Vorschlag)

1. **Ein Inspektor-Gerüst** (Etappe 3, GEBAUT 05.09.2026 für Container und
   Baustein; Region behält ihren eigenen Inspektor, Seite offen): ein Panel für Container, Baustein,
   Region, Seite; Abschnittsliste je Elementart; die drei Zeilenmuster; „+"-Kopf
   mit Suchmenü; Platzhalter für berechnete Werte; Override-Blau aus
   `herkunft()` mit Reset; Ausrichtungsleiste 8 Knöpfe mit Kürzeln.
   Deckt 0.1–0.6, 0.9.
2. **Die 19 Modell-Felder anbinden** (GEBAUT 05.09.2026): Position (Type, Pins, Z-Index), Size
   (Modus, Min/Max, Kette), Styles (Opacity, Visible, Fill-Popover mit
   Solid/Verlauf/Bild und Farbrollen, Overflow, Radius per corner, Border,
   Shadows), Transforms, Scroll Section, Accessibility. Deckt 2.x, 3.x, 9.1–9.9,
   10.1, 13.1–13.2.
3. **Text am Element**: Stil-Chip mit Wähler aus den Text-Rollen, Overrides für
   Font/Weight/Color/Size/Letter/Line/Align, Balance/Truncate. Deckt 11.x.
4. **Variablen und Stil-Verweise** (Etappe 4): Farbstile am Element wählbar,
   ⊕-Bindung, New Style, Copy/Paste Style. Deckt 0.7, 0.8, 0.11, 14.2.
5. **Effects** (Etappe 5): Appear/Hover/Press/Scroll Animation/Scroll
   Transform/Stagger mit Transition-Editor; Overlays am Element; Cursor.
   Deckt 6.x, 7.x, 8.x, 9.10–9.11.
6. **Agent** (Etappe 6) mit OpenAI: Chat, Kontext aus Auswahl, Modellwahl,
   Vorschlag/Übernehmen. Deckt 15.x.
7. **Grid-Layout und CMS-Content** (Masonry, Columns, Gap ×2; Filters/Sorting/
   Pagination/Empty State an Objekt- und Beitragslisten). Deckt 4.4, 5.x.

Nicht auf die Liste: Komponenten (14.1), JS-Code-Overrides (13.4),
Shader/Masking (9.5), Gallery Field (5.6).

## 18 Nicht live gemessen (Restlücke)

Die Editoren von Hover, Press, Loop, Drag, Ticker, Scroll Transform, Flow und
der Overlay-/Cursor-Editor: das „+"-Menü ließ sich am Stack per CDP nicht
zuverlässig öffnen (`FRAMER-STYLE-INSPEKTOR-ANALYSE.md` §H), und jeder Klick
darauf legt sofort einen Effekt an. Die Felder stehen aus der offiziellen Doku
(`FRAMER-INSPEKTOR-DOKU-RECHERCHE.md` 5.x, 6.x, 7.x); wer sie exakt braucht,
misst sie an einem Wegwerf-Projekt, nicht am Kundenprojekt.
