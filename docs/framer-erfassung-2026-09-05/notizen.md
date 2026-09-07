# Framer-Editor — Vollerfassung (Projekt „Adaptable Breakfast“, 05.09.2026)

Quelle: Live-Editor `framer.com/projects/Adaptable-Breakfast--v2T65fa1QUvhPaNeMxtv-gMzjL`, gelesen mit
Claude Chrome (DOM-Dump je Zustand + Screenshot). Jede Interaktion, die das Projekt ändert, wurde sofort mit ⌘Z
zurückgenommen und per DOM-Diff gegengeprüft (Diff leer = Ausgangszustand steht).

**Übersetzungs-Vorbehalt:** Chrome übersetzte die Framer-Oberfläche automatisch ins Deutsche. Sichtbare
Beschriftungen (`text`) sind daher teilweise deutsch und mitunter falsch übersetzt („Auswirkungen“ = Effects,
„Wickeln“ = Wrap, „Polsterung“ = Padding, „Grenze“ = Border, „Lücke“ = Gap, „Haltepunkt“ = Breakpoint,
„Wachsen“ = Grow, „Füllen“ = Fill, „Überlauf“ = Overflow, „Transformiert“ = Transform, „Stile“ = Styles,
„Zugänglichkeit“ = Accessibility, „Codeüberschreibungen“ = Code Overrides, „Scrollabschnitt“ = Scroll Section,
„Einladen“ = Invite, „Veröffentlichen“ = Publish, „Jetzt aktualisieren“ = Upgrade Now, „Opazität“ = Opacity,
„Sichtbar“ = Visible, „Größe“ = Size, „Breite/Höhe“ = Width/Height, „Maximale Breite“ = Max Width,
„Richtung“ = Direction, „Verteilen“ = Distribute, „Ausrichten“ = Align, „Typ“ = Type, „Quelle“ = Source,
„Zustand“ = State, „Auflösung“ = Resolution, „Alternativtext“ = Alt Text, „Farben“ = Colors).
Tooltips (`title`) und `aria-label` blieben englisch und sind die verlässliche Originalbezeichnung.

## Zwischenbericht 1 — Gerüst, Elementtypen, Fill-Popover, Position-Typen

### 1. Fensteraufbau (drei Spalten + zwei Leisten)
| Bereich | Inhalt |
|---|---|
| Kopfleiste links | `Canvas ▾` (Modus-Menü), dann vier Werkzeug-Knöpfe: **Insert** (+), **Layout** (Rahmen-Symbol; nach Taste `S` wird er zu **Stack** und bleibt als Werkzeug armiert), **Text** (T), **Vector** (△) |
| Kopfleiste Mitte | Projektname `Adaptable Breakfast` · Branch-Knopf `main` (aria `main`, `aria-expanded`) |
| Kopfleiste rechts | Avatar `AS` (Button), **Preview** (▷), **Invite**, **Publish** (blau) |
| Linke Leiste | Tabs **Pages / Layers / Assets**, darunter Suche `Search…` |
| Canvas | Breakpoint-Rahmen mit Kopf `▷ Desktop 1200` und `+`-Knopf (aria `Breakpoint`) rechts |
| Schwebende Fußleiste | **Select**, **Pan**, **Comment**, **Theme** (Mond), Zoom `50% ▾`, `Upgrade Now` |
| Rechte Leiste | Tabs **Agent / Style**; Style beginnt mit 8 Align-Knöpfen |

### 2. Linke Leiste
**Pages:** Abschnitt `Design` mit `+` (aria `Add Design Page`), Abschnitt `Pages` mit `+` (aria `Add Page`);
Zeilen `Home`, `/ferienhaus-agentur` (role presentation, `aria-selected`, `aria-expanded`).
**Layers:** Seitenwahl als Combobox (`/ferienhaus-agentur`, `aria-expanded`), Suche, Baum: Wurzel `Desktop`
mit Badge `Primary`; Knöpfe `Expand item`/`Collapse item` (title Expand/Collapse) je Zeile; Sektionen mit
Anker tragen rechts ein `#`-Symbol (title `Scroll Section`); Layer mit Link tragen ein Ketten-Symbol, mit
Interaktion/Komponente ein weiteres Symbol. Layer-Icons: Frame (⧉), Stack (≡), Text (T), Vektor (△), Bild (▭),
Collection-List (Stapel).
**Assets:** Abschnitte `Templates +`, `Components +`, `Styles +`, `Vectors +` (enthält Ordner `Framer`), `Code +`
(enthält `Examples.tsx`).

### 3. Agent-Tab (rechts)
Kontext-Combobox (`Ferienwohnung agency s…`) + `+`-Knopf (neuer Chat), Verlaufsblock mit Prompt (`neue startseite`)
und Zurück-Pfeil, Antwort mit nummerierter Liste, Block `Changes` mit `Undo` und `…`-Menü, je Zeile
Seite/Collection + Anzahl (`Home 1 Layer`, `/ferienhaus-agentur 84 Layers`, `Ferienwohnungen 3 Items`),
Hinweiskarte `Out of credits … Upgrade`.

### 4. Style-Panel — Aufbau je Elementtyp (Sektionen von oben nach unten)
Eine Sektion mit `+` rechts ist LEER (Klick legt einen Standardwert an = Schreibvorgang); Sektion mit `−` ist
gefüllt (Klick auf den Kopf ENTFERNT den Inhalt — nie zum Zuklappen benutzen).

| Sektion | Bild | Stack/Frame | Text | Button-Frame mit Link | Breakpoint „Desktop“ | Collection List | Vektor |
|---|---|---|---|---|---|---|---|
| Align-Leiste (8) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Template `+` | – | – | – | – | ✓ | – | – |
| Link | ✓ | ✓ | ✓ | ✓ gefüllt | – | ✓ | – |
| Position | ✓ | ✓ | ✓ | ✓ | „Haltepunkt“: Position X/Y, Breite, Höhe | ✓ | ✓ |
| Größe | ✓ (Lock Aspect Ratio) | ✓ + Max Width | ✓ + **Wachsen/Grow** (3 Knöpfe) | ✓ | – | ✓ | ✓ (Lock) |
| Layout | `+` leer | ✓ Stack/Grid… | – | ✓ | ✓ | ✓ | – |
| Content | – | – | – | – | – | ✓ Quelle/Zustand/Filter… | – |
| Effects `+` | ✓ | ✓ | ✓ | ✓ | – | ✓ | ✓ |
| Overlays `+` | ✓ | ✓ | ✓ | ✓ | – | ✓ | – |
| Cursor `+` | ✓ | ✓ | ✓ | ✓ | – | ✓ | ✓ |
| Styles (Opacity, Visible, Fill, Overflow, Radius, Border, Shadow) | ✓ | ✓ | ✓ (Text-Stile) | ✓ | – | ✓ | ✓ (Opacity, Visible) |
| Transform `+` | ✓ | ✓ | ✓ | ✓ | – | ✓ | ✓ |
| Farben (Selection, Swatch, `+1`) | – | ✓ | – | – | – | – | – |
| Scroll Section `+` | ✓ | ✓ | ✓ | ✓ | – | ✓ | – |
| Accessibility `+` | ✓ | ✓ | ✓ | ✓ | – | ✓ | – |
| Code Overrides `+` | ✓ | ✓ | ✓ | ✓ | – | ✓ | – |

#### 4.1 Align-Leiste (immer oben)
`Align Left ⌥A` · `Align Horizontally ⌥H` · `Align Right ⌥D` · `Align Top ⌥W` · `Align Vertically ⌥V` ·
`Align Bottom ⌥S` · `Distribute Horizontally ⌃⌥H` · `Distribute Vertically ⌃⌥V`.

#### 4.2 Link
Leer: Zeile `Link zu` mit Combobox `Page or URL…` (Kopf hat `+`). Gefüllt (Button „Unterkünfte entdecken“):
`Link zu` = `/ferienhaus-agentur`, `Abschnitt` = Select `#unterkuenfte` (Anker der Zielseite),
`Neuer Tab` Yes/No, `Scrollen` Smooth/Instant. Die Zeilen `Neuer Tab`/`Scrollen` tragen links ein ⊕-Symbol
(Breakpoint-Override-Marker).

#### 4.3 Position
Select `Typ` = Absolute / Relative / Fixed / Sticky.
- **Relative** (Standard): nur der Select.
- **Absolute**: 4 Zahlenfelder `T`, `L`, `R`, `B` um ein Pin-Widget (Quadrat mit vier anklickbaren Pins,
  aktive Kante blau) — Größe wechselt dabei auf feste Pixel (Breite 500 Fixed).
- **Sticky**: zusätzliches Feld `Top` mit `−`/`+`-Steppern.
- **Fixed**: wie Absolute (Pins gegen Viewport) — beim ersten Setzen kam der Wert nicht an, wird wiederholt.

#### 4.4 Größe
`Breite` Zahl + Select (Fixed / Relative / Fill / Fit Content [/ Fit Image bei Bildern]);
`Höhe` Zahl + Select (Fixed / Relative / Fill / Fit Content [/ Fit Image] / Viewport);
Lock-Symbol `Lock Aspect Ratio` zwischen beiden. Werte: `1fr` (Fill), `100%` (Relative), Pixel (Fixed),
graue Platzhalterzahl (Fit = berechnet). `Maximale Breite` Zahl + Select (Relative / Fixed), wenn gesetzt.
`Min Max` → Knopf `Add…` (title `Add Size Constraint`). Text-Layer zusätzlich `Wachsen` (Grow):
3 Knöpfe (horizontal / vertikal / beide = Fixed).

#### 4.5 Layout (Stack)
`Typ` Stack | Grid (Segment-Knöpfe) · `Richtung` Horizontal | Vertical · `Verteilen` Select
(Start / Center / End / Space Between / Space Around / Space Evenly) · `Ausrichten` Start | Center | End ·
`Wickeln` Yes | No · `Lücke` Zahl + Slider 0–100 (Kopf klickbar, aria `Gap`) · `Polsterung` Zahl + zwei
Knöpfe `Padding` / `Padding per side`; je Seite Felder `T R B L`.

#### 4.6 Content (Collection List)
`Quelle` Select (CMS-Collection, hier `Ferienwohnungen`) · `Zustand` Default | Empty · `Filter` `Add…` ·
weitere Zeilen siehe Roh-Dump 13 (Sortierung, Limit).

#### 4.7 Styles
`Opazität` Zahl + Slider 0–1 (Step 0.01), Kopf klickbar (aria `Opacity`) · `Sichtbar` Yes | No ·
`Füllen`: leer = `Add Fill`; gefüllt = Chip mit Vorschau + Name (`Image`, `FFFFFF`, `Linear`, `Radial`,
`Conic`) + `×` (title `Remove`) · `Überlauf` Select (Clip / Visible / Hidden / Scroll) ·
`Radius` Zahl + Knöpfe `Radius` / `Radius per corner`; je Ecke Felder mit Unterschrift `TL TR BR BL` ·
`Grenze` `Add…` (title `Add Border`) · `Schatten` `Add…` (title `Add Shadow`).

#### 4.8 Fill-Popover (Klick auf den Fill-Chip; erneuter Klick schließt)
Kopf `Fill` + `×`. Fünf Typ-Reiter (Icons): **Solid**, **Linear**, **Radial**, **Conic**, **Image**.
Ein Reiterwechsel ist ein Schreibvorgang (Fill wird sofort ersetzt; ⌘Z stellt zurück, Popover bleibt offen).
- Solid: großes Sättigung/Helligkeit-Feld, Hue-Regler, Alpha-Regler, Felder `FFFFFF` + `100%`,
  Format-Select `HEX` (weitere Optionen siehe Dump), Pipette, Knopf `New Style`.
- Linear/Radial/Conic: zusätzlich oben Stop-Leiste mit zwei Stops (Ringe); auf dem Canvas erscheinen
  Griffe (Linie mit zwei Endpunkten; Radial: Mittelpunkt + Radius; Conic: Kreis).
- Image: Vorschau (Dropzone), `Auflösung` Select (`Auto`…), `Typ` Select (`Fill`…), `Position` (`Center`,
  9-Punkt-Symbol), `Alternativtext` Textfeld, Knöpfe `Crop` und `Plugins`.
- **Crop** öffnet Modal `Crop Image`: Bild mit vier Eckgriffen, Felder `W` `H` (1600 × 1067), Knopf `Crop`, `×`.

### 5. Layer-Typen und ihre Sonderfelder (bisher gesehen)
- Breakpoint-Frame: Sektion `Template +`, Block `Haltepunkt` mit `Position` X/Y, `Breite` (1200 Fixed),
  `Höhe` (Fit) — danach normales Layout.
- Frame „Einführung“: Sektion `Farben` mit Zeile `Selection`, Farb-Swatch-Knopf, Knopf `+1`.
- Sektion mit Anker: Layer-Zeile trägt `#` (title `Scroll Section`).

### 6. Tastenfalle (gemessen)
Buchstaben, die nicht in ein Feld gehen, sind Canvas-Kürzel: `A` `b` `s` + Return legte sofort einen **Stack**
um die Auswahl und armierte das Stack-Werkzeug im Kopf (Knopf `Layout` → `Stack`). ⌘Z hob den Stack auf,
das Werkzeug blieb armiert, bis `Select` in der Fußleiste geklickt wurde.

## Zwischenbericht 2 — Effekte, Overlays, Cursor, Sektions-Menüs, Editor-CSS

### 7. Menüs hinter den `+`-Köpfen (Bild-Layer)
| Kopf | Verhalten beim Klick | Einträge |
|---|---|---|
| Link `+` | Menü | `Rel ›` (Untermenü), `Parameters`, `Tracking` — alle drei **ausgegraut**, solange kein Link gesetzt ist |
| Größe `+` und `Min Max → Add…` | dasselbe Menü | `Max Width`, `Min Width`, `Max Height`, `Min Height` |
| Layout `+` | **schreibt sofort** (Stack-Layout wird angelegt, Kopf wird `−`) | – |
| Effects `+` | Menü mit Suchfeld `Type to search…` | `Appear`, `Hover`, `Press`, `Loop`, `Drag`, `Lightbox`, `Ticker`, `Scroll ›`, ─, `Flow` |
| Effects › Scroll | Untermenü | `Scroll Animation`, `Scroll Speed`, `Scroll Transform`, `Scroll Variant` |
| Overlays `+` | Menü mit Untertiteln | `Relative` („Dropdowns, popovers“), `Fixed` („Modals, toasts, videos“) |
| Cursor `+` | Menü mit Untertiteln | `Web Cursor` („Pick a default cursor“), `Custom Cursor` („Pick a component“), `Set Variant` („Animate your cursor“, ausgegraut ohne Komponente) |
| Transform `+` | Menü | `Scale`, `Skew`, `Rotate`, `Depth`, `Perspective`, `Origin`, `Backface`, `Preserve 3D` |
| Accessibility `+` | Menü | `Tag`, `Aria Label`, `Tab Index`, `Google Bot` |
| Code Overrides `+` | **schreibt sofort**: Zeile mit Select `Datei` (Code-Dateien des Projekts, hier `Examples.tsx`), Select `Override` (`Select…`, `withHover`, `wi…` = exportierte Overrides), Knopf `Edit Code` | – |
| Scroll Section `+` | siehe Roh-Dump `s-scroll-section-plus` | – |
| Fill `Add…`/Border `Add…`/Shadow `Add…` | schreiben sofort und öffnen Popover | – |
Menü-Technik: jedes Menü ist `div[role=menu]` mit unsichtbarem 1×1-Knopf `Dismiss popup`, Einträge `role=menuitem`
(Untermenü: `aria-haspopup=menu`, `aria-expanded`), die Effekt-Liste ist eine `combobox`+`listbox` mit `role=option`.
Ein Klick auf den Kopf bei offenem Menü schließt es nur (der Klick wird verbraucht). Nach dem Schließen bleibt das
Menü kurz unsichtbar im DOM stehen.

### 8. Effekte — jeder Typ legt einen Chip in der Effects-Sektion an und öffnet einen Dialog (Popover links neben dem Panel, mit `Back` und `Close`)
Chip-Zeile: `<Name>` links, Chip mit Icon + Beschriftung (`Effect`, `Animation`, `Speed`, `Transform`), rechts `×` (title `Remove`). Der Layer erhält im Layers-Baum ein Blitz-Symbol (title `Has Effects`).
| Effekt | Dialog-Titel | Felder |
|---|---|---|
| Appear | `Appear Effect` | `Trigger` Select (On Appear / On Scroll / Layer in View / Section in View), `Preset` Select (Fade In …), `Enter` Chip `Effect` (öffnet Sub-Dialog mit Opacity/Scale/Rotate/Skew/Offset/Fill/Shadow) |
| Hover | `Hover Effect` | `Opacity` Slider 0–1 (Step 0.1), `Scale` Zahl 1.1 + Slider 0–10, `Rotate` Zahl + `2D`/`3D`, `Skew` Zahl° + `X`/`Y`, `Offset` X/Y, `Fill` Add…, `Shadow` Add…, `Transition` Chip `Spring` |
| Press | `Press Effect` | wie Hover, Scale-Vorgabe 0.9 |
| Loop | `Loop Effect` | `Type` Loop/Mirror, `Delay` Zahl S mit −/+, Opacity, Scale, `Rotate` 360 2D/3D, Skew, Offset, `Off Screen` Play/Pause, `Transition` Chip `Linear` |
| Drag | `Drag Effect` | `Freeform` Yes/No, `Snap Back` Yes/No, `Transition` Spring; zusätzlich wird in der Cursor-Sektion automatisch `Web` → Chip `Grab` gesetzt |
| Lightbox | `Lightbox` | `Max Width` 800 (−/+), `Padding` 20 + Padding/Padding per side, `Z Index` 10 (−/+), `Backdrop` Farb-Chip `000000`, `Transition` Spring |
| Ticker | `Ticker` | `Speed` 100 % (−/+), `Hover` (Slow/Stop …), `Direction` Up/Down (bzw. Left/Right), `Draggable` Yes/No. **Struktur-Eingriff:** der Layer wird in ein Stack-Layout umgewandelt (Direction/Align/Gap erscheinen), das Bild-Fill wird entfernt (Fill zeigt `Add Fill`); `×` am Chip nimmt das NICHT zurück — nur ⌘Z (drei Schritte) |
| Flow | `Flow Effect` | `Transition` Spring, Hinweis „Animate content near interactive sections.“; wandelt den Layer ebenfalls in einen Stack um (Type/Direction/Distribute/Align/Wrap/Gap/Padding) |
| Scroll Animation | `Scroll Animation` | `Trigger` Select (On Appear / On Scroll / Layer in View / Section in View), `Start` Top/Center/Bottom, `Replay` Yes/No, `Preset` Select (Fade In, Scale In, Scale In Bottom, Flip Horizontal, Flip Vertical, Slide In Top/Left/Right/Bottom …), `Enter` Chip `Effect`, `Exit` Add… |
| Scroll Speed | `Scroll Speed` | `Speed` 110 % (−/+) — Parallax |
| Scroll Transform | `Scroll Transform` | `Trigger` Select (On Scroll / Layer in View / Section in View), `From` Chip `Effect`, `To` Add…, `Transition` Add… |
| Scroll Variant | – | auf einem Bild-Layer ohne Komponente: kein Dialog, kein Chip (braucht Varianten) |
Chip `Effect` (Transition-Popover) je Effekt: Roh-Dumps `e-*-chip-effect`.

### 9. Overlays
`Relative` oder `Fixed` legt SOFORT einen neuen Layer `Overlay` als Kind des Layers an und schaltet den Canvas in den
Modus **Editing Overlay** (Kopfzeile des Breakpoints: `Editing Overlay · Desktop`, rechts Knopf `Done`; Canvas
abgedunkelt, Overlay-Vorschau als weißer Kasten). Style-Panel dann:
`Show On`: `Interaction` Select (Click / Hover), `Trigger` Add… (title `Add Trigger`);
`Overlay`: `Position` Select (Top / Right / Bottom / Left) mit Icon, `Align` Start/Center/End, `Offset` X 0 / Y 10,
`Dismiss` Auto/Click, `Collision` Select `Auto` + Zahl 20 PX; danach `Link`, `Size` (200 Fixed) usw. für den Overlay-Layer.
`Done` verlässt den Modus (rechtes Panel springt auf **Agent**), der Overlay bleibt und erscheint als Chip in der
Overlays-Sektion mit `×`. Fixed-Variante: Roh-Dump `o-overlay-fixed`.
Nach `Done` ohne Auswahl zeigt der Style-Tab den **Seiten-Zustand**: `Typography` → `Base` 16 PX (−/+) und `Template +`.

### 10. Cursor
`Web Cursor` setzt sofort Chip `Pointer` (Popover mit Cursor-Liste, Roh-Dump `c-web-cursor-dialog`). Der Chip hat
KEIN `×`; der Kopf zeigt weiter `+` (weitere Cursor). Entfernen nur per ⌘Z. `Custom Cursor` verlangt eine Komponente.

### 11. Tasten und Undo — was gemessen wurde
- ⌘Z wirkt nur, wenn der Fokus nicht in einem Popover/Menü/Select liegt; sonst wird es verschluckt. Nach Klick auf den
  Style-Tab oder eine Layer-Zeile greift es wieder. ⌘⇧Z = Redo.
- Bei offenem Effekt-Dialog: erst `Close`, dann ⌘Z.
- Ein ⌘Z zu viel macht den letzten Löschvorgang rückgängig (Effekt kommt zurück). Deshalb nie „blind“ undo.
- Tastenkürzel im Canvas: Buchstaben ohne Fokusfeld sind Werkzeuge (`S` = Stack-Werkzeug im Kopf, `A` … ).

### 12. Editor-Layout per CSS (dein Zusatzauftrag: `position:absolute; top/right/bottom/left: var(--framerInternalUI-chromeMargin*)`)
Zwei Container liegen exakt im Canvas-Fenster (260 px vom linken Rand, 51 px von oben, 260 px vom rechten Rand,
0 px unten; hier 920 × 642 px):
- Container A: `position:absolute; top:var(--framerInternalUI-chromeMarginTop); right:…Right; bottom:…Bottom; left:…Left` — der Canvas-Viewport (nimmt Maus-Events).
- Container B: dieselben vier Kanten + `pointer-events:none; z-index:0` — die Overlay-Ebene für Rahmen, Griffe, Maße (durchklickbar).
`:root`-Variablen (alle in `:root` definiert, keine Media-Queries):
| Variable | Wert | Bedeutung |
|---|---|---|
| `--framerInternalUI-chromeToolbarHeight` | 51px | Kopfleiste |
| `--framerInternalUI-chromeMarginTop` | 51px | = Kopfleiste |
| `--framerInternalUI-chromeMarginLeft` | 260px | linke Leiste |
| `--framerInternalUI-chromeMarginRight` | 260px | rechte Leiste |
| `--framerInternalUI-chromeMarginBottom` | 0px | keine Statusleiste |
| `--framerInternalUI-chromeMarginBottomWithoutStatusBar` | 0px | |
| `--framerInternalUI-tabContentWidth` / `propertyPanelWidth` / `rightPanelWidth` / `automationRunOverlayWidth` | 260px | alle Panels gleich breit |
| `--framerInternalUI-responsiveLeftPanel` / `responsiveLeftOffset` | 260px | |
| `--framerInternalUI-floatingToolbarTop` | 60px | |
| `--framerInternalUI-floatingToolbarBottom` | 10px | Abstand der schwebenden Fußleiste |
Die Leisten liegen also NICHT im Flow: Kopf, links, rechts sind absolut positionierte Chrome-Elemente, der Canvas
bekommt seine Fläche über diese vier Variablen. Ändert sich eine Leiste (z. B. Panel eingeklappt), ändert Framer nur
die Variable.
Design-Tokens des Editors heißen `--framer-fresco-*` („Fresco“ = Framers UI-Kit), immer mit Fallback im `var()`:
`--framer-fresco-tint-color` (#0099ff), `-panelBackground-color` (#ffffff), `-canvasBackground-color` (#eeeeee),
`-panelPadding-dimension` (10px), `-panelGap-dimension` (10px), `-inputSpacing-dimension` (10px),
`-floatingToolbarPadding-dimension` (10px), `-floatingToolbarIconGap-dimension` (5px), `-avatarSize-dimension` (30px),
`-avatarOverlap-shadow`, `-swatchBorderPlaceholder-color` (rgba(0,0,0,.05)), `-invitePopoverSendButtonBackground-color`
(rgba(0,0,0,.08)), `-heading-font-weight` (600), `-breakpointTitle-color` (#999999), `-breakpointTitleBackground-color`
(rgba(153,153,153,.1)). Layers-Baum: `--tree-available-width: calc(260px - 1px - panelPadding*2)`.
`<body class="framer-theme-dark framer-release-stable">` — Theme über Body-Klasse. Vollständige Listen: Roh-Dumps
`css-framerInternalUI`, `css-fresco-tokens`, `css-chrome-layout`, `css-alle-custom-properties`.

## Zwischenbericht 3 — Kopfleiste, Insert-Panel, Kontextmenüs, Drag & Drop, Text-Popover, Transform/Accessibility-Felder

### 13. Kopfleiste und Fußleiste (Menüs)
| Element | Öffnet | Inhalt |
|---|---|---|
| `Canvas ▾` | Modus-Menü | `Canvas ⌥1`, `CMS ⌥2`, `Localization ⌥3`, `Analytics ⌥4`, `Settings ⌥5` |
| `+` Insert (Kürzel `I`) | linkes Panel wird zum Insert-Panel mit Suchfeld | Gruppe **Elements**: `Icons ›`, `Shaders ›`, `Media ›`, `Forms ›`, `Interactive ›`, `Social ›`, `Utility ›`, `Creative ›`; Gruppe **CMS**: `Collections ›`, `Fields ›`. Jede Kategorie öffnet rechts daneben eine zweite Spalte mit Kacheln (Icon + Name, 115×115 px, `aria-label`) |
| Insert › Icons | Icon-Packs | Iconic, Phosphor, Hero, Feather, Meteor, Material, Basicons, Flowbite, Nonicons, Sargam … (Klick öffnet das Pack; ein Pack ist nicht auf den Canvas ziehbar) |
| Insert › Media | Komponenten | Image, Video, YouTube, MP3, GIF, Vimeo, Dot Lottie, Spotify, Apple Music, SoundCloud … |
| Insert › Shaders / Forms / Interactive / Social / Utility / Creative | Komponenten | siehe Roh-Dumps `k-insert-*` (21/22/12/12/20/8 Einträge) |
| Insert › Collections | CMS-Collections des Projekts | `Ferienwohnungen` (Kachel) |
| Insert › Fields | Hinweis | „Collections — Content fields can be used on detail pages“ |
| Layout-Werkzeug | Menü | `Frame F`, `Stack S`, `Grid ⇧G`, `Masonry ⇧M`, ─, `Image ⇧I`, `Video ⇧V` |
| Text-Werkzeug (T) | kein Menü | armiert das Text-Werkzeug (Knopf bleibt hervorgehoben, Auswahl geht verloren); zurück per `Select` in der Fußleiste |
| Vektor-Werkzeug (△) | Menü | `Rectangle R`, `Oval O`, `Polygon`, `Star`, `Path P` |
| Breakpoint `+` (rechts im Rahmen-Kopf) | Menü | `Generate…`, `Tablet 810`, `Phone 390`, `Custom…` (der Klick wählt zugleich den Breakpoint-Frame aus) |
| `main` (Branch) | Popover | ließ sich weder per Klick noch per Pointer-Event öffnen — nicht erfasst |
| Avatar `AS` | Popover **Invite** | Feld `name@email.com` + Senden-Pfeil, Select `Full Access`, Zeile „andy's Workspace — All members can access“, `Project Link — Anyone can view ▾` + `Copy`, Mitglied „andy staudinge · Owner · Viewing now“ |
| `Invite` | dasselbe Popover | – |
| `Publish` | **publiziert sofort** (siehe 17) und zeigt dann das Popover: `<slug>.framer.app`, `1m ago · by …` ›, `No changes`/`View changes` ›, `Get Free Domain`, `Update` | – |
| `Preview` (▷) | Vollbild-Vorschau (`?view=preview`) | Kopf: `‹ Back`, Neu laden, In neuem Tab öffnen, Select `Desktop ▾`, Felder `W 1200` `H 593`; rechts Avatar/Preview/Invite/Publish; Seite läuft in einem iframe (6 iframes gesamt) |
| Fußleiste `Select` / `Pan` / `Comment` / `Theme` | Werkzeuge | Comment schaltet die rechte Leiste auf **Comments** („Click anywhere on the canvas to comment.“); Theme schaltet den EDITOR zwischen Dark/Light (`body.framer-theme-dark` kommt/geht) — kein Seiten-Theme |
| Zoom `50% ▾` | Menü | `Zoom Z`, `Zoom In ⌘+`, `Zoom Out ⌘–`, ─, `Zoom to 100% ⌘0`, `Zoom to Fit ⌘1`, `Zoom to Selection ⌘2`, ─, `Fast Zoom`, `Nudge Amount` |
| `Upgrade Now` | Framer-Preisseite | nicht geöffnet |

### 14. Linke Leiste — Menüs
- **Pages `+`**: `New Page`, `New CMS Page ›` (Untermenü = Collections: `Ferienwohnungen`), `New 404 Page`, ─, `New Folder`, ─, `Sort Alphabetically`.
- **Design `+`**: `New Design Page`, `New Folder`.
- **Seiten-Zeile Rechtsklick**: `Settings`, `Draft`, ─, `Rename`, `Duplicate`, `Copy`, `Delete`, ─, `New A/B Test…`, `View Analytics`, ─, `Set Home Page`, `Replace This Page With` (aus), `Convert to CMS Page`, `View Custom Code`.
- **Assets**: `Templates +` → `New Template`, `New Folder`; `Components +` → `New Component`, `New Folder`; `Styles +` → `Text ›` (Paragraph, Heading 1–6, New Folder), `Link ›` / `Blockquote ›` / `Code ›` / `Color ›` (je `New Style`, `New Folder`), `CMS ›` (Code Block, Video, Vimeo, YouTube, Image, Table, New Folder); `Vectors +` und `Code +` öffneten per Pointer-Event kein Menü (vermutlich Datei-Dialog bzw. Direktanlage) — nicht erfasst. Nach dem Einfügen einer eingebauten Komponente (Video) erscheint unter `Components` ein Ordner `Framer` mit den benutzten Framer-Komponenten.

### 15. Kontextmenü Layer (Canvas-Rechtsklick = Layers-Rechtsklick, mit Suchfeld `Type to search…`)
`Add To Agent`, ─, `Create Component ⌥⌘K`, `Create Layout Template`, ─, `Fit Content ⇧A`, ─, `Select ›`, `Align ›`, `Replace With ›`, ─, `Copy ›`, `Paste ›`, `Move ›`, `Duplicate ⌘D`, `Delete ⌫`, ─, `Rename ⌘R`, `Auto Rename ⌥R`, `Lock ⌘L`, `Hide ⌘;`, ─, `Overflow ›`, `Add Frame ⌘↩`, `Add Stack ⌥⌘↩`, `Remove Frame ⌘⌫` (Liste scrollt, Pfeil unten).
Untermenüs: **Select** → Top Parent ⌘ESC, Parent ESC, All ⌘A, Siblings ⇧⌘A, Children (aus), Text Layers (aus), Layers Using This Background · **Align** → die 8 Align/Distribute-Befehle + `Align to Selection`, `Align to Parent` (alle aus bei Einzelauswahl) · **Replace With** → `Video` · **Copy** → Copy ⌘C, Copy Style ⌥⌘C, Copy Fill ⇧⌘C, Copy Link, Copy CSS, Copy SVG (aus), Copy Text (aus), Copy Guides (aus), Copy Effects, Copy Cursor, Copy Node ID · **Paste** → Paste ⌘V, Paste Style ⌥⌘V, Paste Fill, Paste in Place ⇧⌘V, Paste Effects, Paste Cursor · **Move** → Bring to Front `]` (aus), Bring Forward ⌥⌘↑ (aus), Send Backward ⌥⌘↓, Send to Back `[` · **Overflow** → Clip, Visible, Hidden, Scroll.

### 16. Drag & Drop (gemessen)
- **Insert-Kachel → Canvas (außerhalb des Breakpoint-Rahmens)**: legt einen frei stehenden Layer auf Seitenebene an (`Image`, 400×300). Panel zeigt dann statt `Position/Größe` die Sektion **Position & Size** mit `Position X/Y` (1160/184), `Width 400 Fixed`, `Height 300 Fixed`. Roh-Dump `dnd-insert-image-js-voll`.
- **Insert-Kachel → in einen Stack**: wird an der Drop-Position als Kind eingefügt (Video zwischen Überschrift und Absatz in `Einführung Text`); Panel zeigt die Komponenten-Props (Video: `URL`/`Upload` …). Roh-Dump `dnd-insert-video-in-stack`.
- **Layer-Zeile → andere Position im Layers-Baum**: verschiebt den Layer, auch über Eltern-Grenzen (Arrow Right aus dem Button heraus vor den Button in `Aktionen`); Canvas folgt sofort. Roh-Dump `dnd-layer-reorder`.
- **Bild auf dem Canvas verschieben / Griff ziehen**: mit der Extension nicht messbar — die Extension-Drag-Geste ist ein sofortiger Press/Release und wird als Klick am Zielpunkt gewertet; eine synthetische Pointer-Sequenz auf dem Canvas ließ den Renderer 45 s hängen. Sichtbar: bei Breite `Fill` zeigt das Bild nur zwei Griffe (oben/unten Mitte), Frames zeigen Seitengriffe; Frame-Auswahl blendet die Eltern-Kontur gestrichelt ein; Stack-Kinder zeigen beim Einfügen eine magenta Einfügelinie.
- Alle Drag-Vorgänge sind EIN Undo-Schritt.

### 17. Vorfall: Publish
Der Klick auf `Veröffentlichen` (oben rechts) hat die Seite SOFORT publiziert — Toast „Ihre Website wurde veröffentlicht“, Popover „adaptable-breakfast-663042.framer.app · 1m ago · by andy staudinge · No changes“. Der Projektstand war zu diesem Zeitpunkt exakt der Ausgangsstand (alle Testschritte zurückgenommen), d. h. live steht der Stand von vor der Sitzung inkl. der Agent-Seite `/ferienhaus-agentur`. Ich habe Publish danach nicht mehr berührt. Wenn die Seite nicht live sein soll: Page-Kontextmenü → `Draft`, oder Site Settings → Unpublish.

### 18. Text-Layer (Überschrift „Orte, an denen der Alltag leiser wird.“)
Panel: Link · Position · Größe (`1fr Fill` / `Fit`, **Grow** 3 Knöpfe) · Effects · Overlays · Cursor · **Typography**-Block: Chip `Select…` (Text Styles: Dialog `Text Styles` mit `New Style`), Chip `Baskervville` (Dialog `Fonts`: Suche, Select `All / Web / Custom / Google / Fontshare / Open Source / Collletttivo / Variable`, Listbox `Font selection` mit `role=option` je Familie), Select Schnitt (`Regular, Italic, Medium, … Bold Italic, Variable, Variable Italic`), `Size` Zahl + `Px/Rem/Fit`, `Line`, `Letter`, `Align` (Knöpfe), `Color` Chip `19352C` (Dialog `Color`: `Solid / Linear Gradient / Radial Gradient / Conic Gradient`, Feld HEX, `Alpha 100%`, Select `RGB/HSL/HEX/P3`, `Sample Color`, `New Style`), `Tag`, `Content`, Knopf-Chips `Add…` für **OpenType** (Dialog: Suche, `No Preview`, Ligatures: Discretionary Yes/No, Standard; Numbers: Denominators, Fractions, Lining, Numerators, Oldstyle, Ordinals, Proportional, Subscript, Superscript, Tabular; Letter Case: Case Sensitive, Small Capitals, All Capitals Small; Horizontal Spacing: Capital Spacing, Kerning; More Features: Scientific Inferiors …) — Klick auf `Add…` legt sofort eine Zeile `Enabled` mit `×` an. Roh-Dumps `18-style-text-headline-voll`, `txt-chip-*`.
Messfehler dabei: ein zweiter Klick in den Font-Dialog änderte den Schnitt von `500` auf `Variable`; beides per ⌘Z zurück, ein ⌘Z zu viel holte das zuvor entfernte Grid-Layout des Bildes zurück → ⌘⇧Z. Endzustand geprüft: Bild-Layer Diff 0, Text-Schnitt wieder 500, keine OpenType-Zeile.

### 19. Transform-/Accessibility-/Scroll-Section-Zeilen (jede Wahl legt SOFORT eine Zeile an; Entfernen nur per ⌘Z)
| Zeile | Felder |
|---|---|
| Scale | Zahl `1` mit `−`/`+` (aria Decrease/Increase); ⊕ vor dem Namen → Menü `Create Variable` |
| Skew | `0°` X, `0°` Y |
| Rotate | `0°` + `2D`/`3D` |
| Depth | Zahl 0 + Slider −500…500 |
| Perspective | Zahl 1200 + Slider 500…5000 |
| Origin | `50%` X, `50%` Y |
| Backface | `Visible`/`Hidden` |
| Preserve (3D) | `Yes`/`No` — setzt zugleich Overflow auf `Visible` |
| Accessibility › Tag | Select `div` (article, aside, button, div, fig…) |
| Accessibility › Aria Label | Textfeld |
| Accessibility › Tab Index | Zahl `1` + `Clear` |
| Accessibility › Google Bot | Select `Skip (data-nosnippet)`, `Include…` |
| Scroll Section `+` | `Name` (`# name`), `Offset Y` 0 mit `−`/`+`; Kopf wird `−` |
| Layout `+` (Bild) | legt Stack an; `Grid` schaltet auf Grid-Felder (Roh-Dump `p22-layout-grid`: Columns/Rows/Gap X/Y/Padding, `Advanced`-Chip) |
Das ⊕-Symbol vor Zeilen wie `Opacity`, `Visible`, `Scale` bedeutet „Variable erzeugen“ (Komponenten-Property), nicht „hinzufügen“.

## Zwischenbericht 4 — Hauptmenü, Settings, Modi, Insert-Inhalte, offene Punkte

### 20. Hauptmenü (Klick auf das Framer-Logo links oben; mit Suchfeld `Type to search…`)
`Canvas ⌥1`, `CMS ⌥2`, `Localization ⌥3`, `Analytics ⌥4`, `Settings ⌥5`, ─, `Go to Dashboard`, `Quick Actions ⌘K`, ─,
`File ›`, `Edit ›`, `View ›`, `Tool ›`, `Layout ›`, `Text ›`, `Vector ›`, `Component ›`, `Plugins ›`, `Code ›`, `Preferences ›`, ─, `Help ›`, `Your Account`.
| Untermenü | Einträge |
|---|---|
| File | New ⌥⌘N · New Page · New Page Folder · New chat ⌘J · ─ · Import from Figma… ⇧⌘I · Upload Image… ⌥⌘I · Upload Video… · Publish Update ⇧⌘P · Open Site ⇧⌘O · Duplicate · Archive · Transfer Project · Copy Remix Link · Invite Collaborators… · Version History ⇧⌘H · Sort Pages Alphabetically · Sort Layers Alphabetically |
| Edit | Undo ⌘Z · Redo ⇧⌘Z · ─ · Back ⌘[ · Forward ⌘] · Cut ⌘X · Copy › · Paste › · Duplicate ⌘D · Delete ⌫ · Find Content ⌘F · Text Search… ⇧⌘F · Rename ⌘R · Auto Rename ⌥R · Lock ⌘L · Hide ⌘; · Back To Page ⌥ESC · Select Top Parent ⌘ESC · Select Parent ESC · Select All ⌘A · Select All Siblings ⇧⌘A · Select All Children · Select All Top Parents · Select All Text Layers |
| View | Open Preview ⌘P · ─ · Appearance › (System Default, Day Mode ⌃⌘N) · Show Pages ⌥⇧1 · Show Layers ⌥⇧2 · Show Assets ⌥⇧3 · Show Agent A · Show Style E · Show Interface ⌘. (✓) · Show All Links · Show Handoff · Show Rulers ⌃R · Show Pixel Grid · Zoom In ⌘+ · Zoom Out ⌘– · Zoom to 100% ⌘0 · Zoom to Fit ⌘1 · Zoom to Selection ⌘2 · Collapse Layers ⌥L |
| Tool | Insert I · ─ · Agent Select ⌃A · Layout › · Text T · Link L · Scale K · Vector › · Zoom Z · Comment C · Cursor Chat / · Sample Color ⌃C · Library ⌘/ |
| Layout | Add Frame ⌘↩ · Add Stack ⌥⌘↩ · Remove Wrapper ⌘⌫ · ─ · Fit Content ⇧A · Resize to Fit Content ⌃⌥R · Bring to Front ] · Bring Forward ⌥⌘↑ · Send Backward ⌥⌘↓ · Send to Back [ · Align › |
| Text | Bold ⌘B · Italic ⌘I · Underline ⌘U · Select Typeface ⌘T |
| Vector | Group ⌘G · Ungroup ⇧⌘G · ─ · Flip Horizontally · Flip Vertically · Convert to Outline · Flatten · Reverse Path Direction · Unite ⌥⇧U · Subtract ⌥⇧S · Intersect ⌥⇧I · Exclude ⌥⇧E · Join ⌥⇧J |
| Component | Create Component… ⌥⌘K · Create From Code… ⇧⌘K · ─ · Show Primary · Detach From Primary · Update Primary From Instance · Reset Overrides |
| Plugins | Browse All · Run Recent Plugin ⌥⌘P · Clear Recent Plugins · Open Development Plugin ⌥⌘L · ─ · Show Developer Tools · API Documentation |
| Code | Create Code Component… · Create Code Override… · ─ · API Documentation |
| Preferences | Animate on Zoom (✓) · Auto-Draft Content · Auto-Layout Pinning · Auto-Switch to Layers Panel · Exit Canvas on Double Click · Fast Zoom · Keyboard Zooms to Selection · Off-Screen Content Hint (✓) · Reverse Zoom Direction · Use Direct Selection · ─ · Nudge Amount · Performance Mode · Reset Default Frame Fill |
| Help | Watch Tutorials · Browse Marketplace · ─ · Request Feature · Join Community · Copy Version Number |

### 21. Insert-Panel — Kacheln je Kategorie
- Shaders: Liquid Gradient, Holo, Wave Gradient, Bands, Rings, Logo Gradient, Logo Glass, Logo Spectrum, Logo Crystal, Blockify, Pixels, Truchet, Fluted Glass, Chromatic, Ripple, Mesh, Particles
- Forms: Forms, Loops, Kit, Typeform, Intercom, Waitlist, Mailchimp, Cal.com, FormSpark, Calendly, Hubspot
- Interactive: Ticker, Carousel, Slideshow, Cookie Banner, Search, Locale Selector
- Social: Instagram, Facebook, X, Google Maps, Trustpilot, Tagembed
- Utility: Lemon Squeezy, Gumroad, Download, Copy, Embed, OpenTable, Product Hunt, The Fork, Eventbrite, Contra
- Creative: Arc, Scribbles, Countdown, Time & Date
- Media: Image, Video, YouTube, MP3, GIF, Vimeo, Dot Lottie, Spotify, Apple Music, SoundCloud (+ weitere, Roh-Dump)
- Icons (Packs): Iconic, Phosphor, Hero, Feather, Meteor, Material, Basicons, Flowbite, Nonicons, Sargam …

### 22. Modi (Kopf-Menü / ⌥1–⌥5)
- **CMS** (⌥2): linke Leiste Tabs `Collections / Fields / Plugins`, Suche, Collection `Ferienwohnungen 3`, `Add…`; Tabelle mit Drag-Griff, Checkbox, Spalten `Titel · Status (Live ▾) · Slug · Region · Kurzbeschreibung · Bild …`; Werkzeugleiste `+ (Add)`, Sortieren, Filter, Suche, `…`. Detailanalyse steht bereits in `docs/FRAMER-CMS-ANALYSE.md`.
- **Localization** (⌥3): Tabs `Locales / Plugins`, leer: „Add a Locale to start localizing your site.“ + `Add Locale`; unten `Words 0 / 5.000` + `Upgrade`.
- **Analytics** (⌥4): Kopf mit Neu-laden; links Suche, `Overview`, `Funnels +`, `A/B Tests +`; Inhalt: Zeitraum `Last 30 days ▾`, Datumsbereich, Kennzahlen `Live Visitors · Unique Visitors · Total Pageviews · Bounce Rate · Average Session`, Diagramm, Tabellen `Sources (Referrer ▾)`, `Pages (All ▾)`, `Devices`.
- **Settings** (⌥5): linke Navigation **Site Settings** (`General`, `Performance`, `Versions`, `Usage`, `Forms`, `Plans`, `Code`), **Hosting** (`Domains`, `Multi Site`, `Headers`, `Redirects`, `Files`), **Page Settings** (je Seite: `Home`, `/ferienhaus-agentur`).
  - General: `Title`, `Language` (Combobox `Add…`), `Description`, Vorschau-Karte; Schalter `Accessibility` (reduced motion), `Navigation` (URL-Parameter erhalten), `Layout Direction` (RTL, hier an), `Automatic Locale`, `Password Protect` (UPGRADE); `Danger Zone` → `Unpublish`; `Site Images` → `Favicon` (Light/Dark) …
  - Performance: `Font Loading` Select `Auto`, `Automatic Optimizations` (Images ENABLED: WebP/AVIF, lazy-load; Fonts …).
  - Domains: Tabelle `Base · Status (READY) · Version (Latest) · Updated · Custom`; Radio `Get a free Framer subdomain` (Feld `mywebsite`, Submit) / `Claim a free custom domain` (UPGRADE).
  - Code: `Custom Code — Add custom scripts that run on selected pages.` → `Add Script`, `Learn More`.
  - Redirects / Files: Upgrade-Plan-Hinweis. Versions/Usage/Forms/Plans/Multi Site/Headers: Roh-Dumps `s-settings-*`.
  - Page Settings: `Title`, `URL`, `Description`, Vorschau; Schalter `Search Engines`, `Site Search`; `Page Images` → `Social Preview 1200 × 630` (`Upload`, Dropzone) …
- **Preview** (▷ / ⌘P): Kopf `‹ Back`, `Reload`, `Fullscreen`, Select `Desktop`, `W`/`H`, `Close Preview`; die Seite läuft im iframe.

### 23. Nicht geprüft / Grenzen dieser Messung
- Branch-Popover (`main`), `Vectors +`, `Code +` (öffneten kein Menü — vermutlich Datei-Dialog/Direktanlage), `Plugins`-Knopf im Fill-Popover, `Upgrade Now`, `Go to Dashboard`, `Quick Actions ⌘K`, `Your Account`, Version History, Import from Figma — nicht ausgelöst (Modal/Navigation bzw. Schreibgefahr).
- Canvas-Direktmanipulation (Verschieben, Größe ziehen, Hilfslinien, Mehrfachauswahl per Rahmen, Zahlenfeld-Scrubbing) — mit dem Extension-Werkzeug nicht messbar (siehe 16).
- Position `Fixed` bei einem Stack-Kind wird still verworfen (kein Panelwechsel); `Scroll Variant` und `Set Variant`/`Custom Cursor` brauchen eine Komponente.
- Settings-Unterseiten `Versions`/`Usage`/`Forms`/`Plans` wurden je 2 s nach Klick gedumpt — bei identischer Länge (Performance = Versions) ist der Inhalt evtl. noch nicht geladen gewesen.
- Text-Layer: Alignment-/Line-/Letter-Popover nicht einzeln geöffnet (Felder sind im Roh-Dump 18).
- Einzelne Schreibvorgänge (Ticker, Flow, Overlay, Video-Insert) hinterließen Nebenwirkungen (Assets-Ordner `Framer` mit benutzten Komponenten; Ticker/Flow wandeln in Stack um und entfernen Fill) — alle per ⌘Z/⌘⇧Z zurückgenommen; Endkontrolle: Bild-Layer Diff 0, Text-Schnitt 500, Layer-Baum wie zu Beginn. Nicht rückgängig: die Publikation (17) und der Assets-Ordner `Framer` (nur Anzeige benutzter Systemkomponenten).
