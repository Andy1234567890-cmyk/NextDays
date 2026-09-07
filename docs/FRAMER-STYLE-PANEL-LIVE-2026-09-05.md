# Framer Style-Panel — live gemessen (05.09.2026)

Projekt „Adaptable Breakfast", Seite `/ferienhaus-agentur`, Debug-Chrome
1440 px breit. Gemessen per DOM-Auslesen des rechten Panels
(`[data-is-right-panel=true]`) in fünf Auswahlzuständen, dazu jedes
„+"-Menü der Abschnittsköpfe geöffnet und gelesen. Fotos im Scratchpad
(`style-01-textklick.png`, `style-text-2/3.png`, `style-stack-1..3.png`,
`style-bild-1/2.png`, `style-desktop-1/2.png`, `plus-*.png`, `plus2-*.png`).
Zwei „+"-Klicks (Scroll Section, Code Overrides) legten am Text
Eigenschaften an — mit zwei ⌘Z zurückgenommen, 45 Elemente unverändert.

Die Oberfläche lief zuerst deutsch (Größe · Auswirkungen · Stile ·
Transformiert · Zugänglichkeit · Codeüberschreibungen · Brief · Linie ·
Gleichgewicht · Etikett · Wachsen · Füllen · Überlauf · Grenze · Schatten ·
Haltepunkt · Lücke · Polsterung), nach einer Fenstergröße-Änderung englisch.
Unten stehen die englischen Namen, deutsche in Klammern, wo sie abweichen.

## 1 Aufbau des Panels (aus dem DOM)

| Nr | Element | Maß / Verhalten |
|---|---|---|
| A1 | Panel rechts, `data-is-right-panel`, links eine `resize-zone` 6 px (Cursor `w-resize`) — das Panel ist in der Breite ziehbar | Innenabstand `--panelPadding` 10 px, Abstand `--panelGap` 10 px |
| A2 | Reiterzeile: zwei Knöpfe „Agent" (`chat-tab`) · „Style" (`properties-tab`), aktiver Reiter als helle Pille | oben, 10 px Rand |
| A3 | Scrollbereich darunter (`overflow-y:auto`), Höhe 100 % | bei Text 1516 px Inhalt |
| A4 | Ausrichtungsreihe: 8 `alignment-button` mit `title` „Align Left ⌥A" · „Align Horizontally ⌥H" · „Align Right ⌥D" · „Align Top ⌥W" · „Align Vertically ⌥V" · „Align Bottom ⌥S" · „Distribute Horizontally ⌃⌥H" · „Distribute Vertically ⌃⌥V" | SVG 14–16 px, Titel per Tooltip |
| A5 | Abschnitt (`ptswoqr`): Kopfzeile (`h10l6u5c`) mit Titel (`span.translate`) links und rechts einem 10×10-Symbol: „+" (Plus, zwei Balken) wenn zuklappbar/erweiterbar, „−" wenn Inhalt gesetzt und wieder entfernbar; Abschnitte ohne Symbol (Position) | Kopf ca. 40 px |
| A6 | Zeile (`p1oxlfbn`): Raster mit Beschriftung links (`t1ih3ztb`, 12 px, grau) und Steuerelement rechts, `grid-column: 2 / -1` für volle Breite | Höhe 30 px (`--height: 30px`) |
| A7 | Beschriftung mit ⊕ (`wkaasce`, 10×10 Kreis mit Plus) = an Variable bindbar: Opacity, Visible, Content, Size (Text) | Zeile trägt `role=button aria-label` |
| A8 | Zahlfeld (`i1ubxgci`): Textinput + Stepper rechts (zwei 8×8-Pfeile übereinander, ziehbar) | z. B. Width 1fr, Height 126.5 (Platzhalter grau, wenn berechnet) |
| A9 | Geteilte Zeile: Zahlfeld + Dropdown (`ph6ilvd` `<select>` mit 8×8-Chevron) | Width/Height, Size/Letter/Line |
| A10 | Segment (`sv2ybzu`): Knöpfe mit gleitendem Hintergrund (`s1qqapws`, width 33 %/50 %/25 %), Trenner (`dyiclh3`) | Grow, Visible, Align, Direction, Balance |
| A11 | Popout-Knopf (`bwfcdld`, `data-is-popout-button`): 22×22-Symbolkachel + Text; leer „Select…"/„Add…" grau | Text Styles, Color, Variable, OpenType, Min Max |
| A12 | Farbfeld: Popout mit Swatch (`iyiuvk1`, Inset-Rand 1 px) + Hex ohne „#" | Color 19352C |
| A13 | Dropdown-Optionen können `disabled` sein (Position Type „Fixed" bei Text) und `<hr>`-Trenner tragen (Weight: Regular … Bold Italic ‖ Variable · Variable Italic) | |
| A14 | „Add…"-Zeile mit Symbolkachel (`wkxdsnf`, 22×22, Hintergrund 8 % weiß) — Min Max „Add Size Constraint" | |

## 2 Text-Element (Überschrift, h1)

| Abschnitt | Zeile | Wert / Steuerelement |
|---|---|---|
| Link + | Link To | Textfeld `combobox` „Page or URL…" (Listbox mit Seiten) |
| Position | Type | Dropdown Absolute · Relative · Fixed (disabled) · Sticky |
| Size + | Width | 1fr · Dropdown Fixed · Relative · Fill · Fit Content |
| | Height | 126.5 (Platzhalter) · Dropdown Fixed · Relative · Fill · Fit Content · Viewport |
| | Grow (Wachsen) | Segment Auto Width · Auto Height · Fixed Size |
| | Min Max | ↔ Add… (Add Size Constraint) |
| Effects (Auswirkungen) + | — | leer |
| Overlays + | — | leer |
| Cursor + | — | leer |
| Styles (Stile) + | ⊕ Opacity | 1 · Schieber 0–1 Schritt 0.01 |
| | ⊕ Visible | Segment Yes · No |
| Transforms + | — | leer |
| Text + | Styles | Popout „Select…" (Textstil-Chip) |
| | ⊕ Content | Textfeld mit dem Inhalt |
| | Font | Popout „Baskervville ▾" (Font-Picker) |
| | Weight | Dropdown Regular · Italic · Medium · Medium Italic · Semibold · Semibold Italic · Bold · Bold Italic ‖ Variable · Variable Italic |
| | Color | Farb-Popout 19352C |
| | ⊕ Size | 62 · Dropdown Px · Rem · Fit |
| | Letter (Brief) | -0.035 · Dropdown Em · Px |
| | Line (Linie) | 1.02 · Dropdown Em · Px · % |
| | Align | Segment Start · Center · End · Justify |
| | Direction | Segment Auto · Fixed |
| | Balance (Gleichgewicht) | Segment Yes · No |
| | Variable | Popout „Add…" (Variable-Font-Achsen) |
| | OpenType | Popout „Add…" |
| Scroll Section + | (nach Klick auf +) Name | Textfeld „# name" |
| | Offset Y | 0 · Stepper − / + |
| Accessibility + | Tag (Etikett) | Dropdown h1 · h2 · h3 · h4 · h5 · h6 · p · span |
| Code Overrides + | (nach Klick auf +) File | Dropdown „Examples" · New File… |
| | Override | Dropdown Select… · withHover · withRandomColor · withRotate · „Edit Code" |

## 3 Stack (Abschnitt „Einführung")

| Abschnitt | Zeile | Wert / Steuerelement |
|---|---|---|
| Link + | Link To | wie oben |
| Position | Type | Absolute · Relative · Fixed · Sticky |
| Size + | Width | 100% · Rel (Fixed · Relative · Fill · Fit Content) |
| | Height | 728 (Platzhalter) · Fit (+ Viewport) |
| | Max Width | 1120 · Fixed (Relative · Fixed) |
| | ↔ Add… | weitere Min/Max |
| Layout − | Type | Segment Stack · Grid |
| | Direction | Segment Horizontal · Vertical |
| | Distribute | Dropdown Start · Center · End · Space Between · Space Around · Space Evenly |
| | Align | Segment Start · Center · End |
| | Wrap | Segment Yes · No |
| | Gap | 56 · Schieber |
| | Padding | Zahl · Umschalter Padding / Padding per side → T 72 · R 32 · B 96 · L 32 |
| Effects + / Overlays + / Cursor + | — | leer |
| Styles + | Opacity 1 · Visible Yes/No · Fill „Add…" · Overflow Clip · Visible · Hidden · Scroll · Radius 0 (Radius / Radius per corner) · Border „Add…" · Shadows „Add…" | |
| Transforms + | — | leer |
| Selection | Colors | fünf Farbfelder 526259 · 19352C · 6F7F72 · BFC8BD · FFFFFF je 100 % (Projektfarben) |
| Scroll Section + · Accessibility + · Code Overrides + | — | leer |

## 4 Bild („Ferienhaus am Wasser")

| Abschnitt | Zeile | Wert |
|---|---|---|
| Size + | Width | 1fr · Fill (Fixed · Relative · Fill · Fit Content · **Fit Image**) |
| | Height | 560 · Fixed (… · Fit Image · Viewport) |
| | Min Max | ↔ Add… |
| Layout + | — | leer (kein Container) |
| Styles + | Opacity · Visible · **Fill (Füllen) „Image"** (Bild-Popout) · Overflow Clip … · **Radius je Ecke TL 160 · TR 160 · BR 18 · BL 18** · Border (Grenze) Add… · Shadows (Schatten) Add… | |
| übrige | Effects · Overlays · Cursor · Transforms · Scroll Section · Accessibility · Code Overrides | leer |

## 5 Breakpoint-Wurzel „Desktop"

| Abschnitt | Zeile | Wert |
|---|---|---|
| Template | — | Kopf (Vorlage der Seite) |
| Breakpoint (Haltepunkt) | — | Kopf |
| Position | X 0 · Y 0 | Zahlfelder |
| Size | Width 1200 · Fixed; Height 3272 (Platzhalter) · Fit (+ Viewport) | |
| Layout | Type Stack · Grid; Direction; Distribute (6 Werte); Align; Wrap; Gap 0; Padding / per side | |
| Typography | Base 16 PX · Stepper Decrease / Increase | REM-Basiswert des Breakpoints |
| Overlays + · Cursor + · Effects + | — | |
| Styles | Fill F4F1E9 · Overflow Clip … | |
| Selection | Colors: fünf Felder „+10" | Projektfarben |
| Code Overrides + | — | |

Zweite Lesung (DOM eines LEEREN Breakpoints, vom Nutzer eingefügt, 05.09.2026):

| Abschnitt | Zeile | Wert / Befund |
|---|---|---|
| Template + | — | Kopf mit „+" (`.hsz4dac`), Rumpf leer |
| Haltepunkt | Position | X 0 · Y 0 als Zahlfelder mit Stepper (`.n1dddmlm`), Kürzel „X"/„Y" rechts im Feld |
| | Breite | 1200 · Dropdown Fixed · Relative (deaktiviert) · Fill (deaktiviert) · Fit Content (deaktiviert); links das Schloss „Lock Aspect Ratio" (`data-testid=padlock`) als 12×70-Klammer über Breite UND Höhe |
| | Höhe | 1000 · Dropdown Fixed · Relative · Fill · Fit Content · **Viewport** — an der Wurzel alle außer Fixed deaktiviert |
| Layout + | — | `data-testid=stacklayoutpanel-enable-stack-button`: das „+" schaltet den Stack sofort EIN (Schreibvorgang, kein Menü) |
| Typography | Base | 16 · Suffix „PX" · Segment mit Decrease/Increase (`--height: 30px`) |
| Overlays + · Cursor + · Effects + | — | Köpfe mit „+", Rümpfe leer |
| Stile + | Füllen | Popout-Knopf `#fill` (`data-is-popout-button`): 22×22-Farbkachel · „FFFFFF" · Entfernen-Kreuz |
| | Überlauf | Select Clip · Visible · Hidden · Scroll (Wert `auto`) |
| Codeüberschreibungen + | — | Kopf mit „+" |

Reihenfolge an der Wurzel also: Template · Haltepunkt · Layout · Typography ·
Overlays · Cursor · Effects · Stile · Codeüberschreibungen — KEINE Zeilen Link,
Transforms, Scroll Section, Accessibility. Die Ausrichtungsreihe (8 Knöpfe,
`.alignment-button[title]`) steht auch hier oben. Rechts außen die
`resize-zone` (left −3 px, Breite 6 px, `cursor: w-resize`) — das Panel ist
ziehbar. Auffällig: „Haltepunkt" ist als EINZIGER Kopf ohne „+" und ohne
„−", also nicht einklappbar.

## 6 Die „+"-Menüs der Abschnittsköpfe (Text-Element)

| Abschnitt | Einträge |
|---|---|
| Link | Rel · Parameters · Tracking |
| Size | Max Width · Min Width · Max Height · Min Height |
| Effects | Text · Appear · Hover · Press · Loop · Drag · Scroll ▸ |
| Overlays | Relative („Dropdowns, popovers") · Fixed („Modals, toasts, videos") |
| Cursor | Web Cursor („Pick a default cursor") · Custom Cursor („Pick a component") · Set Variant („Animate your cursor") |
| Styles | Blending · Draggable · Filters · Mask · Overflow · Overflow X · Overflow Y · Pointer Events · Selection · Tap Color · User Select · Z Index |
| Transforms | Scale · Skew · Rotate · Depth · Perspective · Origin · Backface · Preserve 3D |
| Text | Fill · Radius · Squircle · Padding · Shadows · Stroke · Paragraph · Transform · Decoration · Balance · Truncate |
| Scroll Section | kein Menü — „+" legt sofort die Zeilen Name · Offset Y an |
| Accessibility | Tag · Tab Index · Google Bot |
| Code Overrides | kein Menü — „+" legt sofort die Zeilen File · Override an |

Jedes Menü trägt als erstes Element „Dismiss popup" (die Klick-Fangfläche).

## 7 Folgen für unsere rechte Leiste

1. Panel-Kopf: Reiter Agent · Style als Pillen; Panelrand 10 px; Panel in der Breite ziehbar.
2. Ausrichtungsreihe: acht Knöpfe mit genau diesen Tooltips und Kürzeln.
3. Abschnitte in dieser Reihenfolge und mit diesen Namen (deutsch): Link · Position · Größe · Layout · Auswirkungen · Overlays · Cursor · Stile · Transformiert · Text · Scrollabschnitt · Zugänglichkeit · Codeüberschreibungen. Kopf mit „+" (leer) bzw. „−" (gefüllt); Position ohne Symbol.
4. Zeilen 30 px hoch, Beschriftung grau 12 px, ⊕ vor bindbaren Zeilen, Zahlfeld mit Stepper, geteilte Zeile Zahl + Dropdown, Segment mit gleitendem Hintergrund, Popout-Knopf mit 22×22-Kachel und „Select…"/„Add…".
5. Größe: Breite/Höhe mit Modus, Grow-Segment (Text/Bild) statt Kette, „↔ Add…" für Min/Max.
6. Stile: Opacity mit Schieber, Visible Yes/No, Fill Add…, Overflow-Dropdown, Radius mit „per corner", Border Add…, Shadows Add…; „+"-Menü mit den zwölf Einträgen.
7. Text-Abschnitt am Textelement mit Stil-Chip, Inhalt, Font, Weight (mit Trenner vor Variable), Color, Size Px/Rem/Fit, Letter Em/Px, Line Em/Px/%, Align 4-fach, Direction, Balance, Variable, OpenType; „+"-Menü mit elf Einträgen.
8. Scroll Section und Code Overrides legen per „+" direkt Zeilen an (kein Menü).
9. Breakpoint-Wurzel (ohne Auswahl): Template + · Haltepunkt (Position X/Y, Breite Fest, Höhe) · Layout + · Typography Base · Overlays + · Cursor + · Effects + · Stile (Füllen, Überlauf) · Codeüberschreibungen +. Haltepunkt als einziger Kopf ohne „+"/„−".
10. Die acht Ausrichtungssymbole sind Framers eigene Pfade (Kante 1 px voll, Block 30 % gefüllt mit 2 px Innenrand) — nicht die Phosphor-Näherung.

## 8 Gebaut daraus (Stand 05.09.2026, 22:50)

- `seiten-inspektor.tsx` neu: die Breakpoint-Wurzel in Framers Reihenfolge und Maßen (Kopf 40 px, Zeile 30 px, Beschriftung 88 px). Template zeigt Seite · Adresse · Sprachen · Status, sein „+" öffnet die Vorlagen; Haltepunkt zeigt X/Y aus `rahmenUrsprung`, Breite `RAHMEN_BREITE` · Fest, Höhe = gemessene Inhaltshöhe der Brücke · Inhalt, darunter die drei Rahmen mit Auge; Layout ausgegraut mit Hinweis (die Abschnitte SIND der Stapel); Typography Base und Stile › Füllen zeigen `branding.font_family` bzw. `branding.background_color` und springen ins Design-Panel (eine Wahrheit, kein zweites Formular); Overlays · Cursor · Effects · Codeüberschreibungen als `SpaeterKopf`.
- `ausrichtungs-symbole.tsx` neu: die acht Framer-Pfade als React-Komponenten (`useId` für die Clip-Pfade); `ausrichtungs-leiste.tsx` nutzt sie statt Phosphor.
- Übrig aus §7: ⊕-Variablenbindung, Grow-Segment, Font-Picker/Variable/OpenType, Popout-Kacheln, Effekte/Overlays/Cursor/Code als Modell, Panel-Ziehgriff, Selection Colors, Überlauf an der Wurzel.

## 9 Fläche, Rahmenkopf und linkes Panel (DOM eines leeren Projekts, 05.09.2026)

Aus dem vollständigen `<body>` eines frisch angelegten Projekts (Seite „Home",
Rahmen „Desktop 1200" mit 600×500, vom Nutzer eingefügt):

| Ort | Befund |
|---|---|
| Maße (CSS-Variablen `--framerInternalUI-*`) | Kopfleiste 51 px; linkes und rechtes Panel 260 px; schwebende Leiste unten 10 px, oben 60 px; unter 640 px Fensterbreite füllt das linke Panel 100 % |
| Rahmentitel (`.ScreenTitle`) | Pille 10 px ÜBER der Seite (`translateY(-100%) translateY(-10px)`), Mindesthöhe 22 px, Radius 10, Innenrand 5 px, 12 px / 600; Farbe Akzent `#0099ff`, Hintergrund Akzent 10 %; darin Abspielknopf 20×20 voll Akzent mit weißem Dreieck, dann „Desktop" · „1200", rechts „+" 20×20 (`aria-label="Breakpoint"`) |
| Auswahlkasten (`selection-box-overlay`) | vier Balken in Akzent, 1 px (`scaleY(0.01)` auf 100 px); vier Eckgriffe 9×9, Radius 8, Akzent; vier Kantengriffe 9 px breit, transparent; eigene Cursor als Daten-URL-SVG (Doppelpfeil, gedreht je Kante/Ecke) |
| Flächen (`hudSurface`, `richTextEditorSurface`, `gridSurface`) | getrennte fixierte Schichten, die mit der Kamera verschoben werden (`translateX(420px) translateY(72px)` = Panelbreite + Kopf, Zoom als `scale(0.5)` an der Textschicht) |
| Linkes Panel | Reiter Pages · Layers · Assets als Pillen; Suchfeld (`Search…`, Lupe 12×12) mit 10 px Rand; Abschnittsköpfe „Design" (+ Add Design Page) und „Pages" (+ Add Page) im SELBEN Kopfstil wie rechts (`.h10l6u5c`, 40 px, „+" 10×10); Seitenzeilen mit 12×12-Symbol (Haus mit 15 % Füllung für die Startseite, Blatt für andere), Name bzw. „/pfad", drei Punkte rechts; gewählte Zeile `aria-selected` |
| Ziehgriffe | beide Panels haben eine `resize-zone` 6 px (links `e-resize`, rechts `w-resize`), Deckkraft 0,5 |

Übernommen (05.09.2026, 23:00): Rahmentitel als Akzent-Pille mit 20-px-Abspielknopf,
Auswahlkante 1 px durchgezogen in `#0099ff` statt gestrichelt (`buehne.tsx`). Seiten-Panel
(`seiten/seiten-leiste.tsx`) auf Framers Stil: Suchfeld oben (filtert Titel/Pfad),
Abschnittsköpfe 40 px wie rechts mit „+", Zeilen 30 px mit 12-px-Symbol, geöffnete
Seite markiert; der gefüllte „Neue Seite"-Knopf ist weg. Nicht übernommen: Eckgriffe
(unsere Rahmenbreiten sind Konstanten; ein Griff ohne Wirkung wäre eine Attrappe),
Panel-Ziehgriffe (offen).

## 10 Etappe 4a aus der Vollerfassung (06.09.2026)

Aus `docs/FRAMER-EDITOR-VOLLERFASSUNG-2026-09-05.md` gebaut: Link › Abschnitt
(Anker der Seite), Position › Pin-Widget, Größe › Wachsen (3 Knöpfe), Layout ›
Gap als Schieber, Transform › Drehung X/Y · Tiefe · Rückseite · 3D-Raum,
Zugänglichkeit › Google Bot, Cursor › Web-Cursor (eigene Karte). Stand der
Abgleichliste: `docs/FRAMER-EDITOR-FUNKTIONEN-GESAMT.md`.

Etappe 4b (06.09.2026, „du hast nicht alles umgesetzt"): Effekte-Karte (Erscheinen ·
Überfahren · Drücken · Schleife · Scroll-Tempo), Stile-„+" (Mischmodus, Filter, Überlauf
X/Y, Zeiger-Ereignisse, Textauswahl, Tippfarbe), OpenType am Text, Raster-Layout,
Link-Rel/Parameter; Editor: ⌘Z/⌘⇧Z, Stil kopieren/einfügen, Überlauf-Untermenü,
Geschwister wählen, Ebenen-Marker, ziehbare Panels. Offen mit Grund: Gesamtliste §7.

