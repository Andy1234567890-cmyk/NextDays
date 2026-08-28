# Framer Canvas — die rechte Sidebar („Style"), Nachbau-Spezifikation (28.08.2026)

Quelle: `framer.com/projects/Pearl-FREE-Portfolio-Template-copy--S6TIWpCjBdmnBgd8Zayq-eHJy7?node=augiA20Il`
— ausgewählt ist das **Überschriften-Textelement** „Discover the essence of Pearl…"
auf der Seite `Home`, Breakpoint `Desktop 1100`.

Ausgelesen mit **Claude in Chrome** — durchgeklickt, nicht abgeschrieben.
Fenster: **1920 × 902 CSS-Pixel** (Bildschirmfotos 1568 breit, Faktor 0,8167).

> **Wichtig vorweg — die deutschen Beschriftungen sind nicht von Framer.**
> Das Dokument ist `<html class="translated-ltr" lang="de">`, `<div id="goog-gt-tt">`
> ist vorhanden und 64 Textknoten stecken in eingefügten `<font>`-Tags:
> **Chrome übersetzt die Oberfläche live**. Framers Original ist englisch.
> Die `aria-label`-Attribute bleiben unübersetzt und liefern deshalb den echten
> Namen — sie stehen unten jeweils in Klammern.
> Beim Nachbau gilt das englische Original als Referenz.

---

## A · Aufbau

| Bereich | Position | Größe |
|---|---|---|
| Panel gesamt | 1660,51 | **260 × 851**, `#ffffff` |
| Reiterzeile | 1671,61 | `Agent` 57 × 30 · `Style` 52 × 30 |
| Ausrichtungsleiste | 1671,102 | 8 Knöpfe je **22 × 50**, Abstand 31 |
| Abschnitt (Kopf) | x 1671 | Überschrift 12px/600 `#222222`, rechts ein Zeichen 15 × 30 bei x 1895 |
| Feldzeile | x 1671 | **239 × 40** (bei Chips 35) |
| Feld-Label | x 1691 | 94 × 30 Klickfläche, Text 12px/500 **`#666666`** |
| Wert-Spalte | x 1775 | 135 × 30 |
| geteilte Wert-Spalte | 1776 + 1847 | Zahl 61 × 30, Klappliste 63 × 30 |

Das Zeichen rechts am Abschnittskopf ist **kein reines „Plus"**: bei einem leeren
Abschnitt öffnet es ein Auswahlmenü, bei einem gefüllten klappt es den Abschnitt zu.

### A1 Ausrichtungsleiste (8 Knöpfe, `aria-label` mit Tastenkürzel)

`Align Left ⌥A` · `Align Horizontally ⌥H` · `Align Right ⌥D` ·
`Align Top ⌥W` · `Align Vertically ⌥V` · `Align Bottom ⌥S` ·
`Distribute Horizontally ⌃⌥H` · `Distribute Vertically ⌃⌥V`

---

## B · Die Abschnitte in der Reihenfolge von oben nach unten

Für dieses Textelement zeigt das Panel **13 Abschnitte**:
Link · Position · Größe (Size) · Auswirkungen (Effects) · Overlays · Cursor ·
Stile (Styles) · Transformiert (Transform) · Text · Selection · Scrollabschnitt
(Scroll Section) · Zugänglichkeit (Accessibility) · Codeüberschreibungen (Code Overrides)

### B1 Link
| Zeile | Bedienelement |
|---|---|
| `Link zu` | Eingabefeld **`#framerUI-link-input`**, Platzhalter `Page or URL…`, 133 × 30 |

**Kopfzeichen** → Menü: `Rel` · `Parameters` · `Tracking`

### B2 Position
| Zeile | Bedienelement |
|---|---|
| `Typ` | echte `<select>`: **`Absolute` / `Relative` / `Fixed` / `Sticky`** (hier `Relative`) |

Kein Kopfzeichen.

### B3 Größe (Size)
| Zeile | Bedienelement |
|---|---|
| `Breite` | Zahl `1fr` (61 × 30) + `<select>` **`Fixed` / `Relative` / `Fill` / `Fit Content`** (hier `Fill`) |
| `Höhe` | Zahl `308` + `<select>` **`Fixed` / `Relative` / `Fill` / `Fit Content` / `Viewport`** (hier `Fit Content`) |
| `Wachsen` | drei Knöpfe je 44 × 28: `Auto Width` · `Auto Height` · `Fixed Size` |
| `Min Max` | Knopf `Add…` (`aria-label` **`Add Size Constraint`**) |

Die Höhe steht grau (`308` als Platzhalter), weil `Fit Content` sie berechnet.
**Kopfzeichen** öffnet hier nichts (dreimal geprüft).

### B4 Auswirkungen (Effects)
| Zeile | Bedienelement |
|---|---|
| `Text` | blauer Chip **`Effect`** + `Remove` (22 × 28) |
| `Scrollen` | blauer Chip **`Animation`** + `Remove` |

**Kopfzeichen** → Menü: `Hover` · `Press` · `Loop` · `Drag` · **`Scroll ›`**
`Scroll ›` → `Scroll Speed` · `Scroll Transform` · `Scroll Variant` *(grau, weil bereits gesetzt)*

#### B4a Chip `Effect` → Popover **„Text Effect"** (260 breit)
Vorschaufeld „Hello World", darunter:

| Zeile | Werte |
|---|---|
| `Auslösen` (Trigger) | `On Appear` / `Layer in View` / `Section in View` — hier `On Appear` |
| `Voreinstellung` (Preset) | `Blur` / `Flip` / `Shake` / `Shoot` / `Rotate` / `Scale` / `Stagger` / `Custom` — hier `Custom` |
| `Pro` (Per) | `Character` / `Word` / `Line` / `Element` — hier `Line` |
| `Eingeben` (Enter) | Chip `Effect` |
| `Verzögerung` (Delay) | Zahl `0` mit Einheit `S` und den Knöpfen `−` / `+` |

#### B4b Chip `Animation` → Popover **„Scroll Animation"** (260 breit)
| Zeile | Werte |
|---|---|
| `Auslösen` (Trigger) | `On Appear` / `On Scroll` / `Layer in View` / `Section in View` — hier `Layer in View` |
| `Start` | drei Symbolknöpfe (Ausrichtung des Auslösepunkts) |
| `Wiederholung` (Replay) | `Yes` / `No` — hier `No` |
| `Voreinstellung` (Preset) | `Fade In` / `Scale In` / `Scale In Bottom` / `Flip Horizontal` / `Flip Vertical` / `Slide In Top` / `Slide In Left` / `Slide In Right` / `Slide In Bottom` / `Custom` — hier `Custom` |
| `Eingeben` (Enter) | Chip `Effect` + `×` |
| `Ausfahrt` (Exit) | Chip `Effect` + `×` |

### B5 Overlays *(leer)*
**Kopfzeichen** → Menü mit Untertiteln:
- **`Relative`** — *„Dropdowns, popovers"*
- **`Fixed`** — *„Modals, toasts, videos"*

### B6 Cursor *(leer)*
**Kopfzeichen** → Menü mit Untertiteln:
- **`Web Cursor`** — *„Pick a default cursor"*
- **`Custom Cursor`** — *„Pick a component"*
- **`Set Variant`** — *„Animate your cursor"*

### B7 Stile (Styles)
| Zeile | Bedienelement |
|---|---|
| `Opazität` (`aria=Opacity`) | Zahl `1` (61 × 30) + Schieberegler (63 × 30, `input[type=range]`) |
| `Sichtbar` (`aria=Visible`) | Segmente `Yes` / `No` je 66 × 28 — hier `Yes` |

**Kopfzeichen** → Menü mit Suchfeld `Type to search…` und **12 Einträgen**:
`Blending` · `Draggable` · **`Filters ›`** · `Mask` · `Overflow` · `Overflow X` ·
`Overflow Y` · `Pointer Events` · `Selection` · `Tap Color` · `User Select` · `Z Index`

`Filters ›` → **9 Einträge**: `Blur` · `BG Blur` · `Brightness` · `Contrast` ·
`Grayscale` · `Hue` · `Invert` · `Saturate` · `Sepia`

### B8 Transformiert (Transform)
| Zeile | Bedienelement |
|---|---|
| `Perspektive` (`aria=Perspective`) | Zahl `1200` + Schieberegler |

**Kopfzeichen** → Menü: `Scale` · `Skew` · `Rotate` · `Depth` ·
`Perspective` *(✓ und grau, weil gesetzt)* · `Origin` · `Backface` · `Preserve 3D`

### B9 Text
| Zeile | Bedienelement |
|---|---|
| `Stile` | Chip mit Tag-Kürzel `H1` + Name `Display` + Größe `(L)` + `Remove` |
| `Inhalt` (`aria=Content`) | Eingabefeld mit dem Text des Elements (135 × 30) |
| `Farbe` | Farbfeld + Name **`Mixed`** + `Remove` |
| `Ausrichten` | vier Knöpfe je 33 × 28: `Start` · `Center` · `End` · `Justify` |
| `Richtung` | Segmente `Auto` / `Fixed` je 66 × 28 — hier `Auto` |

`Mixed` heißt: die Auswahl enthält mehrere Farben (im Beispiel schwarz + grau).

**Kopfzeichen** öffnet hier nichts (dreimal geprüft).

#### B9a Chip `H1 Display (L)` → Popover **„Text Styles"**
Suchfeld, dann die Stil-Liste mit Tag, Name, Größe/Zeilenhöhe:

| Tag | Name | Größe / Zeilenhöhe |
|---|---|---|
| H1 | Display | 64px / 1.2 |
| H1 | Heading L | 40px / 1.4 |
| H2 | Heading M | 32px / 1.4 |
| H3 | Heading S | 24px / 1.4 |
| H4 | Heading XS | 18px / 1.4 |
| P | Body Default | 16px / 1.4 |

Unten ein Knopf **`New Style`**.

#### B9b Farbfeld → Popover **„Color"**
- Vier Reiter je 59 × 28: **`Solid` · `Linear Gradient` · `Radial Gradient` · `Conic Gradient`**
- Sättigungs-/Helligkeitsfläche, darunter Farbton-Regler und Alpha-Regler
- Wertfeld `000000` + Deckkraft `100%`
- Format-`<select>`: **`RGB` / `HSL` / `HEX` / `P3`**
- Pipette (`aria=Sample Color`), Alpha-Feld (`aria=Alpha`)
- Suchfeld, darunter die **Farbstile des Projekts**:
  `Primary / Black` · `Primary / White` · `Dark / 70` · `Dark / 50` ·
  `Grey / 30` · `Grey / 20` · `Grey / 5` — jeder Eintrag zeigt beim Überfahren `Edit`
- Knopf **`New Style`**

### B10 Selection
| Zeile | Bedienelement |
|---|---|
| `Farben` | zwei Farbzeilen: `Dark / 50` (Hintergrund der Auswahl) und `Primary / Black` (Text) |

### B11 Scrollabschnitt (Scroll Section) *(leer)*
Kopfzeichen öffnet nichts (dreimal geprüft).

### B12 Zugänglichkeit (Accessibility)
| Zeile | Bedienelement |
|---|---|
| `Etikett` (Tag) | `<select>`: **`h1` / `h2` / `h3` / `h4` / `h5` / `h6` / `p` / `span`** — hier `h1` |

**Kopfzeichen** → Menü: `Tag` · `Tab Index` · `Google Bot`

### B13 Codeüberschreibungen (Code Overrides)
Nur die Überschrift sichtbar; Kopfzeichen nicht geöffnet (siehe H).

---

## C · Der zweite Reiter: Agent

`Agent` (57 × 30) neben `Style` (52 × 30). Inhalt:
- Klappliste **`New Chat`** (200 × 30) + Knopf `+` (30 × 30, `aria=Chat`)
- Textfeld **`Ask Framer…`** (217 × 80)
- Modellwahl **`Opus 4.8 ⌄`** (im CMS-Reiter desselben Projekts stand dort
  `GPT 5.6 Terra` — die Wahl ist also pro Chat, nicht pro Projekt)
- drei Knöpfe je 20 × 20: `Select` · `Add` · `Send`

---

## D · Gestaltung (gemessene Werte)

| Element | Größe | Hintergrund | Text | Schrift | Radius |
|---|---|---|---|---|---|
| Panel | 260 × 851 | `#ffffff` | — | Inter 12px/400 | 0 |
| Reiter aktiv (`Style`) | 52 × 30 | `rgb(243,243,243)` | `#222222` | 12px/**600** | 8 |
| Reiter inaktiv (`Agent`) | 57 × 30 | transparent | `#999999` | 12px/500 | 8 |
| Abschnittsüberschrift | 26 × 15 | transparent | `#222222` | 12px/**600** | 0 |
| Feld-Label | 49 × 15 | transparent | **`#666666`** | 12px/500 | 0 |
| Klappliste (`select`) | 135 × 30 | transparent | `#333333` | 12px/500 | 8 |
| Zahlenfeld | 61 × 30 | transparent | `#222222` | 12px/500 | 8 |
| Textfeld (breit) | 133–135 × 30 | transparent | `#222222` | 12px/500 | 8 |
| Segment aktiv (`Yes`) | 66 × 28 | transparent | **`#0099ff`** | 12px/**600** | — |
| Segment inaktiv (`No`) | 66 × 28 | transparent | `#999999` | 12px/500 | — |
| Symbolknopf (Ausrichten) | 33 × 28 | transparent | — | — | — |
| Chip (`Effect`, `Animation`) | ~78 × 15 Text, Icon 22 × 22 blau | — | — | — | — |
| Ausrichtungs-Knopf | 22 × 50 | transparent | — | — | — |
| `Remove`-Knopf | 22 × 28 | transparent | — | — | — |

Farbrollen wie im CMS: Primär `#0099ff`, Flächen `#f3f3f3`, Text stark `#222222`,
Text schwach `#999999`, **Labels `#666666`** (im CMS sind es `#999999` — das ist
der einzige Farbunterschied zwischen den beiden Oberflächen).

---

## E · Der DOM

Das Panel hängt in einem Container bei `x = 1660`, Breite 260, und besteht aus
398 Elementen (davon 96 mit Text, `aria-label` oder Formularrolle).
Wiederkehrende Bausteine mit ihren echten Klassennamen:

    div.p1oxlfbn.w1chribc[aria=Opacity]        (1671,208 239x35)   ← Feldzeile
      font                                      (1691,215 49x15)   ← Label (Chrome-Übersetzung)
      input.tarvkue.i1v4gay9.n1obifo6           (1776,208 61x30)   ← Zahlenfeld
      input.s142amrw                            (1847,208 63x30)   ← Schieberegler
    div.p1oxlfbn.w1chribc[aria=Visible]         (1671,243 239x40)
      button.b1dxn7q.s8ln65c.t1295uka.s56pukx   ← Segment AKTIV (Zusatzklasse s56pukx)
      button.b1dxn7q.s8ln65c.t1295uka           ← Segment inaktiv
    select.p17vy09d.t1295uka                    (1775,288 135x30)  ← echte <select>
    input#framerUI-link-input.tarvkue…[ph=Page or URL…]
    div.t1295uka.t1k6az3b                       ← Abschnittsüberschrift

Drei Dinge, die man nur im DOM sieht:

- **Die Klapplisten sind echte `<select>`-Elemente.** Ihre Optionen stehen im DOM,
  auch ohne dass das Menü geöffnet wird — deshalb ließen sich alle Auswahllisten
  in einem einzigen Aufruf auslesen.
- **Der aktive Zustand eines Segments ist eine zusätzliche Klasse** (`s56pukx`),
  nicht ein Attribut.
- **Die Beschriftungen stecken in `<font>`-Tags**, die Chrome beim Übersetzen
  eingefügt hat. Framers Originaltext ist damit aus dem DOM verschwunden; nur die
  `aria-label` tragen ihn noch (`Opacity`, `Visible`, `Content`, `Perspective`,
  `Start`/`Center`/`End`/`Justify`, `Auto Width`/`Auto Height`/`Fixed Size`,
  `Add Size Constraint`, `Sample Color`, `Alpha`, `Remove`).

---

## F · Zustände

| Zustand | Aussehen |
|---|---|
| Segment aktiv | Text `#0099ff` / 600, Zusatzklasse `s56pukx` |
| Segment inaktiv | Text `#999999` / 500 |
| Wert von einer anderen Ebene berechnet | Zahl steht **grau als Platzhalter** (`Höhe 308` bei `Fit Content`) |
| Menüeintrag bereits gesetzt | grau **mit Häkchen** (`Perspective` im Transform-Menü) |
| Menüeintrag nicht anwendbar | grau ohne Häkchen (`Scroll Variant`) |
| Mehrere Werte in der Auswahl | Wortwert **`Mixed`** statt einer Farbe |
| Abschnitt ohne Inhalt | nur die Überschrift, Kopfzeichen öffnet ein Auswahlmenü |
| Chip | blaues Icon 22 × 22 + Name + `Remove` beim Überfahren |

---

## G · Für den Nachbau

**Alles ist eine Zeile aus Label und Wert**, 239 × 40, Label bei x + 20 (94 breit,
`#666666`), Wert bei x + 115 (135 breit). Nur die Größen-Zeile teilt die
Wert-Spalte in Zahl (61) + Klappliste (63). Mit diesen drei Mustern —
Zeile, geteilte Zeile, Chip-Zeile — ist das ganze Panel gebaut.

**Der Abschnittskopf hat zwei Bedeutungen**, je nachdem ob der Abschnitt Inhalt
hat: Menü zum Hinzufügen (leer) oder Zuklappen (gefüllt). Wer nur ein „+" baut,
verliert die Hälfte.

**Ein gesetzter Wert verschwindet nicht aus dem Menü**, er wird grau mit Häkchen
(`Perspective`). Das erspart die Frage „warum fehlt der Eintrag".

**Berechnete Werte werden als Platzhalter gezeigt, nicht ausgegraut** — der
Nutzer sieht die Zahl (308), kann sie aber nicht bearbeiten, solange `Fit Content`
gilt.

**Farbe und Textstil sind Verweise auf Projekt-Stile**, keine Rohwerte: der
Farbwähler listet `Primary / Black`, `Dark / 50` usw. und bietet `New Style`.
Genau dieses Muster brauchen wir für die Farbpalette des Baukastens.

**`Mixed`** ist ein eigener Anzeigewert für „mehrere Werte in der Auswahl" —
kein leeres Feld, keine erste Farbe.

---

## H · Nicht geprüft

- **Kopfzeichen von `Größe`, `Text`, `Scrollabschnitt` und `Codeüberschreibungen`** —
  je dreimal geklickt, es öffnete sich kein Menü und es kam keine Zeile hinzu.
  Ob dort etwas passieren soll, ist damit offen.
- **Modellwahl `Opus 4.8 ⌄`** im Agent-Reiter — zweimal geklickt, die Liste ging
  nicht auf.
- **Die drei `Start`-Symbolknöpfe** im Scroll-Animation-Popover — nur ihre Existenz
  und Größe erfasst, keine `aria-label` gelesen.
- **Werte ändern** — kein Segment umgeschaltet, keine Klappliste umgestellt, keine
  Farbe gewählt, kein Effekt entfernt: das Panel schreibt sofort in das Dokument.
  Alle Auswahllisten stammen deshalb aus dem DOM (`<select>`), nicht aus dem Klick.
- **`New Style`** (Farbe und Textstil) — nicht geklickt, würde einen Stil anlegen.
- **`Rel`, `Parameters`, `Tracking`** (Link-Menü) — nur die Namen, die Untermenüs
  wurden nicht geöffnet.
- **Andere Elementtypen.** Das Panel ist elementabhängig: für ein Textelement
  zeigt es 13 Abschnitte. Für Rahmen, Bilder, Komponenten oder für „nichts
  ausgewählt" (dort stand `Template` mit `Layout`, `Fußzeile a…` und `Edit`) sieht
  es anders aus — **nur der Textfall ist hier vermessen**.
- **Breakpoint-Leiste** (`Desktop 1100`, `Tablet 1099 — 768`, `Phone 767`) — sie
  gehört zum Canvas, nicht zur Sidebar, und wurde nicht durchgeklickt.
