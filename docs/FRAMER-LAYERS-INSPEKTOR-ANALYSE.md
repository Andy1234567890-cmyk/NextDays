# Framer Canvas — Layers-Panel und Style-Inspektor für Breakpoint, Stack, Bild (live vermessen 05.09.2026)

Ergänzt `FRAMER-STYLE-PANEL-ANALYSE.md` (28.08.2026, nur der Textfall). Gemessen
im Debug-Chrome per `scripts/diagnose/chrome-steuern.mjs` am Projekt
„Adaptable Breakfast", Seite `/ferienhaus-agentur` (Ebenen: Desktop → Navigation,
Einführung, Ausgewählte Ferienwohnungen, Service für Eigentümer, Ablauf,
Kontaktabschluss, Fußzeile). Fenster 1405 × 739 CSS-px. Alle Maße CSS-px.

**Warnung für spätere Messungen:** Framer schreibt beim Klick sofort ins
Dokument. `Add…` bei Fill/Border/Shadows legt einen Wert an, der Kopf einer
GEFÜLLTEN Sektion (Layout) entfernt sie, `+` bei Scroll Section und Code
Overrides legt eine Zeile an. Rückweg ist ⌘Z (`taste:Meta+z`). Alle sechs
versehentlichen Schreibvorgänge dieser Messung wurden so zurückgenommen und
per Panel-Dump gegengeprüft (Fill/Border/Shadows wieder `Add…`, Layout wieder
`Stack`, Höhe wieder `Fit`).

## A · Aufbau

| Bereich | Position | Größe / Stil |
|---|---|---|
| Linkes Panel | 0,51 | 260 breit, `#ffffff`, Seite dahinter `#eeeeee` |
| Reiter `Pages · Layers · Assets` | y 61 | je 30 hoch, aktiv `#f3f3f3` Radius 8, 12px/600 `#222`; inaktiv 12px/500 `#999` |
| Seitenwahl (nur im Layers-Reiter) | 10,112 | 239 × 30, `#f3f3f3` Radius 8, Symbol Seite + Name + ⌄; öffnet Liste „Pages: Home · /ferienhaus-agentur" |
| Suchfeld | 10,152 | 239 × 30, `#f3f3f3` Radius 8, Lupe 12 × 12, Platzhalter „Search…" |
| Baum (`data-testid="sortable-tree"`) | ab y 203 | Zeilen 239 × 30 bei x 10, kein Abstand, keine Trennlinien |
| Rechtes Panel | 1146,51 | 259 × 688, `#ffffff`; Reiter `Agent · Style` bei y 61 (Agent 57 × 30, Style 52 × 30) |
| Ausrichtungsleiste | y 119 | 8 Knöpfe 22 × 50, Abstand 31 (siehe B4) |

### Baumzeile (Layers)
- Einrückung **21 px je Ebene**: Name bei x 55 (Breakpoint), 76 (Ebene 1), 97 (Ebene 2).
- Aufbau von links: Pfeil `Expand`-Knopf (6 breit, `#aaa`, nur bei Kindern) ·
  Typ-Symbol 12 × 12 · Name 12px/400 Inter `#999`.
- Symbolfarben: Stack/Frame **`#0099ff`**, Text `#999`, Bild `#9aacc0`.
- Rechts am Zeilenende Badges 12 × 12 `#999`: `Scroll Section` (Raute `#`, `title`
  „Scroll Section") bei Sektionen mit Anker; beim Breakpoint das Wort `Primary`.
- **Ausgewählt:** Hintergrund `#0099ff`, Radius **8 8 0 0** (oben gerundet, unten
  eckig, weil der Teilbaum darunter anschließt), Name und Symbole weiß.
  **Kinder der Auswahl:** Hintergrund `display-p3 0 0.6 1 / 0.1` (hellblau 10 %),
  Text bleibt `#999`.
- Kein Hover-Symbol: Überfahren blendet nichts ein (gemessen an „Ablauf").
- Kein Auge, kein Schloss in der Zeile — Ausblenden/Sperren nur über Menü/Kürzel.

## B · Bedienelemente

### B1 Kontextmenü einer Ebene (Rechtsklick, 181 × 636, Suchfeld oben)
Reihenfolge, Gruppen durch Linien getrennt:
1. `Add To Agent`
2. `Create Component ⌥⌘K` · `Create Layout Template`
3. `Fit Content ⇧A` (ausgegraut bei Text)
4. `Select ›` · `Align ›` (ausgegraut bei Einzelauswahl)
5. `Copy ›` · `Paste ›` · `Move ›` · `Duplicate ⌘D` · `Delete ⌫`
6. `Rename ⌘R` · `Auto Rename ⌥R` · `Lock ⌘L` · `Hide ⌘;` · `Overflow ›`
7. `Add Frame ⌘↩` · `Add Stack ⌥⌘↩` · `Remove Frame ⌘⌫` (bei Stack: `Remove Stack`)

Untermenüs:
- **Select ›**: Top Parent `⌘ESC` · Parent `ESC` · All `⌘A` · Siblings `⇧⌘A` · Children · Text Layers · Layers Using This Background
- **Copy ›**: Copy `⌘C` · Copy Style `⌥⌘C` · Copy Fill `⇧⌘C` · Copy Link · Copy CSS · Copy SVG · Copy Text · Copy Guides · Copy Effects · Copy Cursor · Copy Node ID
- **Paste ›**: Paste `⌘V` · Paste Style `⌥⌘V` · Paste Fill · Paste in Place `⇧⌘V` · Paste Effects · Paste Cursor
- **Move ›**: Bring to Front `]` · Bring Forward `⌥⌘↑` · Send Backward `⌥⌘↓` · Send to Back `[`
- **Overflow ›**: Visible · Hidden · Scroll
- **Align ›**: nicht geöffnet (deaktiviert bei Einzelauswahl).

### B2 Kontextmenü des Breakpoints (Rechtsklick auf „Desktop")
`Add To Agent` · `Edit Breakpoint…` · `Add Breakpoint` · Select › · Align › ·
Copy › · Paste › · Move › · Duplicate ⌘D · Delete ⌫ · Rename ⌘R · Auto Rename ⌥R ·
Lock ⌘L · Hide ⌘; · Overflow › · Add Frame ⌘↩ · Add Stack ⌥⌘↩ ·
`Remove Stack ⌘⌫` · **`Set as Default Fill`**.

### B3 Reiter „Agent"
`New chat` (200 × 30) + Chat-Symbolknopf (30 × 30); darunter Hinweis „Out of
credits — Your workspace has used all of its available credits" + `Upgrade`.
Der Chat selbst war ohne Guthaben nicht zu öffnen (→ H).

### B4 Ausrichtungsleiste (`title` mit Kürzel)
Align Left ⌥A · Align Horizontally ⌥H · Align Right ⌥D · Align Top ⌥W ·
Align Vertically ⌥V · Align Bottom ⌥S · Distribute Horizontally ⌃⌥H ·
Distribute Vertically ⌃⌥V.

## C · Style-Inspektor je Elementart (Reihenfolge von oben)

Zeilenmuster: Label bei x + 30 (12px/500 `#666`), Wert bei x + 115 (135 breit);
geteilte Zeile Zahl 61 + Klappliste 63; Eingabe-Hülle `#f3f3f3` Radius 8, Text
12px/500 `#222`; Segment aktiv 12px/600 `#0099ff`, Radius 6; Abschnittskopf
12px/600 `#222`; Trennlinie 239 × 1 `#eeeeee`. Höhen: Zeile 40 (Chip 35),
Abschnittsabstand 48.

### C1 Breakpoint (Desktop gewählt)
| Abschnitt | Zeilen |
|---|---|
| Template | Kopf mit `+` |
| Breakpoint | Position `X` `Y` (je 61) · Width `1200` Fixed/Relative/Fill/Fit Content · Height `3272` (Platzhalter, Fit) Fixed/Relative/Fill/Fit Content/Viewport · Kette (`Lock Aspect Ratio`, 14 × 70) |
| Layout | Type `Stack \| Grid` · Direction `Horizontal \| Vertical` · Distribute Start/Center/End/Space Between/Space Around/Space Evenly · Align Start/Center/End · Wrap Yes/No · Gap `0` (+ ⊕) · Padding `0` mit Umschalter „Padding \| Padding per side" |
| Typography | Base `16 PX` mit `−` `+` |
| Overlays · Cursor · Effects | leer, Kopf `+` |
| Styles | Fill `F4F1E9` (Farbchip, Entfernen ×) · Overflow Clip/Visible/Hidden/Scroll |
| Selection | Colors: vier Farbknöpfe 22 × 22 |
| Code Overrides | Kopf `+` |

### C2 Stack (Einführung gewählt)
| Abschnitt | Zeilen |
|---|---|
| Link | Link To `Page or URL…` |
| Position | Type Absolute/**Relative**/Fixed/Sticky |
| Size | Width `100%` Rel · Height `728` (Platzhalter) Fit · **Max Width `1120` Fixed** (Relative/Fixed) · Min Max `Add…` · Kette |
| Layout | Type Stack/Grid · Direction · Distribute · Align · Wrap · Gap `56` · Padding `72 32 96 32` (per side) |
| Effects | `+` → Menü mit Suche: Appear · Hover · Press · Loop · Drag · Lightbox · Ticker · **Scroll ›** (Scroll Animation · Scroll Speed · Scroll Transform · Scroll Variant) · Flow |
| Overlays | `+` → Relative „Dropdowns, popovers" · Fixed „Modals, toasts, videos" |
| Cursor | `+` → Web Cursor „Pick a default cursor" · Custom Cursor „Pick a component" · Set Variant „Animate your cursor" |
| Styles | Opacity `1` (Zahl + Schieber, ⊕) · Visible Yes/No (⊕) · Fill `Add…` · Overflow Clip · Radius `0` mit „Radius \| Radius per corner" · Border `Add…` · Shadows `Add…` |
| Transforms | `+` → Scale · Skew · Rotate · Depth · Perspective · Origin · Backface · Preserve 3D |
| Selection | Colors: 526259 · 19352C · 6F7F72 · BFC8BD · FFFFFF (je „100 %") |
| Scroll Section | `+` → legt sofort an: Name `#` (Eingabe „name") · Offset Y `0` |
| Accessibility | `+` → Tag · Aria Label · Tab Index · Google Bot |
| Code Overrides | `+` → legt sofort an: File `Select… \| New File…` |

Popover **Border** (öffnet links vom Panel bei x 890, nach `Add…`): Color `222222` ·
Width `1` · Style Solid/Dashed/Dotted/Double; Wert in der Zeile „Solid".
Popover **Shadow**: Type `Box \| Realistic` · Position `Outside \| Inside` ·
Color `000000 25%` · X `0` · Y `1` · Blur `2` · Spread `0`; Zeile zeigt „0, 1, 2";
mehrere Schatten stapeln (zweiter erhält 0, 2, 4), darunter erneut `Add…`.

### C3 Bild (Ferienhaus am Wasser gewählt)
Wie Stack, aber: Size Width `1fr` **Fill** (Liste Fixed/Relative/Fill/Fit Content/
**Fit Image**) · Height `560` Fixed (… /Fit Image/Viewport) · Layout leer (`+`) ·
Styles: Fill **`Image`** (Chip) · Radius per corner `160 160 18 18`.

### C4 Text (Küstenkind gewählt) — bestätigt gegen die Analyse vom 28.08.
Link · Position Type · Size Width `114.5` Fit, Height `14` Fit, Grow
`Auto Width \| Auto Height \| Fixed Size`, Min Max · Effects · Overlays · Cursor ·
Styles (Opacity, Visible) · Transforms · Text (Styles `Select…`, Content, Font
`Inter`, Weight 20 Schnitte, Color `19352C`, Size `14` Px/Rem/Fit, Letter `0.16`
Em/Px, Line `1` Em/Px/%, Align Start/Center/End/Justify, Direction Auto/Fixed,
Variable `Add…`, OpenType `Add…`) · Scroll Section · Accessibility Tag
h1–h6/p/span · Code Overrides.

### C5 Nichts gewählt (Template, leere Home-Seite)
Template `+` · Breakpoint (Position X/Y, Width 1200 Fixed, Height 1000 Fixed,
Kette) · Layout `+` · Typography Base 16 · Overlays `+` · Cursor `+` · Effects `+` ·
Styles Fill FFFFFF, Overflow Clip · Code Overrides.

## D · Abläufe
- Klick auf Zeile wählt die Ebene, färbt sie `#0099ff`, hinterlegt ihre Kinder
  hellblau und klappt sie auf; der Inspektor wechselt sofort.
- Pfeil klappt auf/zu, ohne die Auswahl zu ändern.
- Rechtsklick wählt die Zeile UND öffnet das Menü (Küstenkind wurde durch den
  Rechtsklick gewählt).
- Der Kopf einer leeren Sektion öffnet ein Menü; der Kopf einer gefüllten
  Sektion (Layout) **entfernt** ihren Inhalt (gemessen, per ⌘Z zurückgenommen).
- `Add…` legt sofort einen Standardwert an und öffnet den Editor-Popover links
  neben dem Panel.
- Berechnete Werte stehen als Platzhalter (Height `728` bei Fit).

## E · Gestaltung (Werte)
Panel `#fff` auf `#eee`; Eingabe-Hülle `#f3f3f3` Radius 8, 30 hoch; Segment
aktiv Text `#0099ff` 600; Auswahl `#0099ff`; Kind-Hinterlegung `display-p3 0 0.6 1 / 0.1`;
Label `#666` 500; Kopf `#222` 600; Zeilentext Baum `#999` 400; alles Inter 12px;
Trennlinie `#eee`; Radius Zeile 8/8/0/0 bei Auswahl.

## F · Zustände
Ruhe (Baumzeile transparent) · Ausgewählt (blau, weiß) · Kind der Auswahl
(hellblau) · Hover (keine Änderung gemessen) · Sektion leer (`+`) / gefüllt
(kein Zeichen bei Layout; Chip mit `×` bei Fill) · Text: `Fit Content` im Menü
ausgegraut · Align ausgegraut bei Einzelauswahl.

## G · Für den Nachbau
- Baum = eine Wurzel je Breakpoint, 30-px-Zeilen, 21-px-Einrückung, Symbole
  nach Typ mit Farbe (Stack/Frame blau, Text grau, Bild blaugrau), Badge rechts
  für Scroll-Section-Anker, `Primary` am Haupt-Breakpoint.
- Auswahl hinterlegt den ganzen Teilbaum: das ersetzt Führungslinien.
- Kontextmenü mit Suchfeld und sieben Gruppen; Kürzel echt binden (⌘D ⌫ ⌘R ⌥R
  ⌘L ⌘; ⌘↩ ⌥⌘↩ ⌘⌫ ⇧A, Select-Kürzel ⌘ESC/ESC/⌘A/⇧⌘A, Move `]`/`[`/⌥⌘↑/⌥⌘↓).
- Inspektor: Sektionen als Liste `Link · Position · Size · Layout · Effects ·
  Overlays · Cursor · Styles · Transforms · Selection · Scroll Section ·
  Accessibility · Code Overrides` (Text zusätzlich `Text`, Breakpoint zusätzlich
  `Template`, `Breakpoint`, `Typography`). Kopf-„+" = Menü bei leer; bei gefüllt
  bauen WIR ein Zuklappen, kein Entfernen (Framers Verhalten ist eine Falle).
- `Add…`-Zeilen legen bei uns NICHT sofort an, sondern öffnen den Editor mit
  Standardwerten und schreiben erst beim Bestätigen (Wurzel 2: ein Klick ist
  keine Absicht).
- Sizing-Modi: Fixed / Relative / Fill / Fit Content / Viewport (Höhe) / Fit
  Image (Bild). Position: Absolute / Relative / Fixed / Sticky. Overflow: Clip /
  Visible / Hidden / Scroll.

## H · Nicht geprüft
- **Agent-Chat** — Workspace ohne Guthaben („Out of credits"); nur Startzustand.
- **Align ›** — deaktiviert bei Einzelauswahl; Mehrfachauswahl nicht ausgelöst.
- **Edit Breakpoint…**, **Add Breakpoint**, Canvas-`+` am Breakpoint-Kopf,
  **Create Component**, **Create Layout Template**, **Set as Default Fill** — alle
  schreiben ins Projekt; nicht geklickt.
- **Effects-Einträge** (Appear … Flow) selbst — Klick legt einen Effekt an; nur
  das Menü und das Scroll-Untermenü per Hover.
- **Fill-Farbwähler** — `Add…` legte `FFFFFF` an (zurückgenommen); der Wähler
  wurde nicht geöffnet.
- **Assets-Reiter**, **Pages-Reiter im Detail** (siehe `FRAMER-CMS-ANALYSE.md`).
- **Tastatur im Baum** (↑/↓/→/←, Shift-Mehrfachauswahl) — nicht ausgelöst.
- **Tablet/Phone-Breakpoints** — dieses Projekt hat nur Desktop; Breitenbereiche
  „958—810 / 809—0" stammen aus dem Bildschirmfoto des Nutzers.
- **Hover-Farbe einer Baumzeile** — Messung ergab keine Änderung; ob Framer
  einen Hover-Ton hat, der nur bei echter Maus erscheint, bleibt offen.
