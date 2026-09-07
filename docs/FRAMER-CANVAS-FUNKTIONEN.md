# Framer-Canvas — alle Funktionen und was uns fehlt (05.09.2026)

Auftrag: *„schau dir bitte das canvas von framer an und finde alle funktionen
mit agenten raus, es fehlen viele funktionen, besonders das canvas ist nicht so.
Wir müssen alle funktionen auflisten."*

Vier Quellen, zusammengeführt in EINER Liste:

| Quelle | Datei | Umfang |
|---|---|---|
| **Live** — Framer-Editor im Debug-Chrome vermessen (Projekt „Adaptable Breakfast") | `FRAMER-CANVAS-ANALYSE.md` (Agent) + Nachlese der Untermenüs File/Edit/Layout/Component/Code/Help/View in dieser Datei (§ 12) | 90+ Bedienelemente, Kontextmenü, Menüs, Zoom, Insert |
| **Kürzel** — `framer.com/shortcuts`, im Browser aus dem DOM gelesen | `FRAMER-KUERZEL-VOLLSTAENDIG.md` | 132 Kürzel, 16 Bereiche |
| **Doku** — offizielle Framer-Hilfe/Academy/Updates | `FRAMER-CANVAS-DOKU-RECHERCHE.md`, `FRAMER-KUERZEL-WERKZEUGE-RECHERCHE.md` | 129 belegte Funktionen + Unbelegtes |
| **Wir** — Inventar unseres Editors (nur gelesen) | `BAUKASTEN-CANVAS-INVENTAR-2026-09-05.md` | 55 vorhandene Funktionen, Lückenliste |

Spalte **Wir**: ✓ vorhanden · ◐ teilweise · ✗ fehlt · — nicht sinnvoll für uns
(Grund in „Hinweis"). Bezugspunkt ist der Seiten-Editor
`web/components/website/editor/*` mit dem Renderer-iframe (`builder`).

**Kernbefund vorweg:** Unser „Canvas" ist eine gescrollte Live-Vorschau mit
Auswahlrahmen, Nähten und Kontextmenü. Framers Canvas ist eine **unendliche,
zoom- und schwenkbare Fläche**, auf der Elemente **direkt gezogen, in der Größe
verändert, gestapelt und mit Hilfslinien ausgerichtet** werden, mit
**Breakpoints als nebeneinander liegende Rahmen**. Die größten Lücken sind
darum nicht einzelne Knöpfe, sondern fünf Fähigkeiten: Zoom/Pan · Ziehen &
Größe ziehen auf der Fläche · Mehrfachauswahl auf der Fläche · Hilfslinien &
Abstandsmaße · Kopieren/Einfügen (Inhalt, Stil, Füllung). Alles Weitere hängt
daran.

---

## 1 Fläche, Navigation, Ansicht

| Nr | Funktion | Framer | Kürzel | Wir | Hinweis |
|---|---|---|---|---|---|
| 1.1 | Unendliche Fläche, Breakpoints als Rahmen nebeneinander („Desktop 1200", Tablet, Phone), grauer Leerraum als Ablage | Live A, Doku 122 | — | ✗ | Bei uns EIN iframe in fester Gerätebreite; Breakpoints nur als Umschalter |
| 1.2 | Zoom In / Out (verdoppelt/halbiert) | Live B.2.1, Kürzel | ⌘+ / ⌘− | ✗ | kein Zoom im Editor |
| 1.3 | Zoom auf 100 % · Zoom to Fit · Zoom to Selection | Live B.4, Kürzel | ⌘0 · ⌘1 · ⌘2 | ✗ | |
| 1.4 | Zoom-Werkzeug (Klick zoomt hinein, ⌥ heraus) | Kürzel Tools | Z | ✗ | |
| 1.5 | Zoom per ⌘+Mausrad und Pinch, Prozentanzeige mit Menü unten | Doku 3–5, Live B.3/B.4 | ⌘+Scroll | ✗ | |
| 1.6 | Präferenzen Animate on Zoom · Fast Zoom · Keyboard Zooms to Selection · Reverse Zoom Direction | Live B.2.4 | — | ✗ | |
| 1.7 | Pan: Hand-Werkzeug, Leertaste+Ziehen, Zwei-Finger-Scroll | Live B.3, Doku 8–10 | Leertaste | ✗ | Wir scrollen nur den iframe |
| 1.8 | Nudge Amount (Schrittweite der Pfeiltasten) | Live B.2.4 | — | ✗ | folgt aus 3.4 |
| 1.9 | Off-Screen Content Hint (Pfeil zu Inhalt außerhalb der Sicht) | Live B.2.4 | — | ✗ | |
| 1.10 | Show Rulers · Show Guides (aus dem Lineal ziehen) · Show Pixel Grid · Layout-Grid je Breakpoint (Spalten/Zeilen, Gap, Margin, Breite) | Live B.2.1, Doku 32–40 | ⌃R · ⌃G | ✗ | Layout-Grid ist reine Editor-Hilfe, wirkt nicht live |
| 1.11 | Night Mode / Appearance (Editor hell/dunkel; Farbstile im Theme vorgeschaut) | Live B.3, Doku 43 | ⌃⌘N | ✗ | Dashboard-Theme ist global, kein Canvas-Umschalter |
| 1.12 | Show Interface (Oberfläche aus, nur Fläche) | Live B.2.1 | ⌘. | ✗ | |
| 1.13 | Show All Links (alle Link-Ziele auf der Fläche markieren) | Live B.2.1 | — | ✗ | |
| 1.14 | Show Handoff (Maße/Abstände für Entwickler) | Live B.2.1 | — | ✗ | |
| 1.15 | Untere Canvas-Leiste: Select · Pan · Comment · Theme · Zoom % | Live B.3 | — | ✗ | Wir haben keine Canvas-Leiste |
| 1.16 | Panel-Umschalter Pages · Layers · Assets links, Agent · Style rechts | Live A, Kürzel Views | ⌥⇧1/2/3 · A · E | ◐ | Seiten/Ebenen/Design als Bereiche vorhanden, keine Kürzel, kein Assets-Panel, kein Agent (Etappe 6) |
| 1.17 | Modi Canvas · CMS · Localization · Analytics · Settings | Live B.2 | ⌥1–⌥5 | ◐ | Blog/Einstellungen/Sprachen vorhanden, kein Analytics-Modus, keine Kürzel |
| 1.18 | Quick Actions (Befehlspalette mit Suche) | Live B.2, Doku 108 | ⌘K | ✗ | |
| 1.19 | Collapse Layers | Live B.2.1 | ⌥L | ✗ | Baum klappt nur je Zeile |
| 1.20 | Auto-Switch to Layers Panel · Exit Canvas on Double Click · Use Direct Selection (Präferenzen) | Live B.2.4 | — | ✗ | |

## 2 Auswahl

| Nr | Funktion | Framer | Kürzel | Wir | Hinweis |
|---|---|---|---|---|---|
| 2.1 | Klick wählt Element, blauer Rahmen mit Eck-/Kantengriffen, Namensschild | Live D/F | — | ✓ | Rahmen + Etikett + Aktionsleiste vorhanden |
| 2.2 | Direct Selection (innerstes Element) vs. Deep Select per Doppelklick | Live B.2.4, D | — | ◐ | Baustein gewinnt immer; Container über Krümelweg |
| 2.3 | Mehrfachauswahl auf der Fläche (⇧-Klick) | Doku, Kürzel | ⇧ | ✗ | nur im Ebenen-Baum |
| 2.4 | Rahmen aufziehen (Marquee) | Doku „Unbelegt" | — | ✗ | |
| 2.5 | Select All · All Siblings · Parent · Top Parent · All Children · All Top Parents · All Text Layers · Layers Using This Background · Back To Page | Live B.8.1, Menü Edit, Kürzel | ⌘A · ⇧⌘A · ESC · ⌘ESC · ↩ · ⌥ESC | ✗ | Wir haben nur „Elternteil wählen" im Baum-Menü |
| 2.6 | Cycle Selection vor/zurück durch überlappende Ebenen | Kürzel | Tab · ⇧Tab | ✗ | |
| 2.7 | Hover-Hervorhebung | Live F, Wir 10 | — | ✓ | orange Rahmen; für Container fehlt er (Befund 9) |
| 2.8 | Kind-Hinterlegung im Baum bei Auswahl | Layers-Analyse | — | ✓ | Etappe 1 |
| 2.9 | Gesperrte Ebene nicht anklickbar, Klick geht an freien Elternteil | Live, Wir 12 | ⌘L | ✓ | Etappe 1 |
| 2.10 | Agent Select (Element an KI-Agent übergeben) · „Add To Agent" im Kontextmenü | Live B.8, Kürzel | ⌃A | ✗ | Etappe 6 |
| 2.11 | Find Content · Text Search über das ganze Projekt | Menü Edit, Kürzel | ⌘F · ⇧⌘F | ◐ | Ebenen-Suche vorhanden, keine Textsuche über Inhalte |

## 3 Bewegen, Größe, Anordnen auf der Fläche

| Nr | Funktion | Framer | Kürzel | Wir | Hinweis |
|---|---|---|---|---|---|
| 3.1 | Element auf der Fläche ziehen (in Stacks mit Einfüge-Indikator, Platzhalter im Quell-Stack, zwischen Stacks) | Doku 86–87 | — | ✗ | Ziehen nur im Ebenen-Baum und aus dem Katalog auf Nähte |
| 3.2 | Größe an Griffen ziehen (dynamische Resize-Cursor, auch rotiert/3D) | Doku 97 | — | ✗ | Unsere 8 Griffe sind bewusst funktionslos (`pointer-events-none`) |
| 3.3 | Rotieren am Griff (dynamischer Rotations-Cursor) | Doku 96 | — | ✗ | Rotation seit Etappe 2 im Datenmodell (`transform.rotation`), kein Griff |
| 3.4 | Pfeiltasten verschieben 1 px / ⇧ 10 px (Nudge), ⌘+Pfeil Größe | Kürzel-Recherche A4, Live Nudge Amount | ↑↓←→ | ✗ | Pfeiltasten wandern nur im Baum |
| 3.5 | ⌥-Ziehen dupliziert | Doku „Unbelegt" (Branchenstandard) | ⌥ | ✗ | |
| 3.6 | Smart Guides: Kanten/Mitten rasten ein, rote Linien | Doku 42 | — | ✗ | |
| 3.7 | Abstandsmaße bei gedrückter ⌥ (Distanz zu Nachbarn) | Doku 41 | ⌥ halten | ✗ | |
| 3.8 | Align Left/Center/Right/Top/Middle/Bottom · Distribute H/V (Menü Layout → Align, Ausrichtungsleiste im Inspektor) | Menü Layout, Kürzel Arrange & Align | ⌥A ⌥H ⌥D ⌥W ⌥V ⌥S · ⌃⌥H ⌃⌥V | ◐ | Ausrichtungsleiste nur für Text im Baustein-Inspektor, nicht für Elemente zueinander |
| 3.9 | Bring to Front · Send to Back · Bring Forward · Send Backward (Stapelreihenfolge) | Menü Layout, Kürzel | ] · [ · ⌥⌘↑ · ⌥⌘↓ | ◐ | „hoch/runter" nur als Listenreihenfolge, kein z-Index (seit Etappe 2 `position.ebene` im Modell) |
| 3.10 | Add Frame · Add Stack (umschließen) · Remove Wrapper | Kontextmenü, Kürzel Layout | ⌘↩ · ⌥⌘↩ · ⌘⌫ | ✗ | Container entstehen nur über Layout-Vorlagen |
| 3.11 | Fit Content · Resize to Fit Content | Kontextmenü, Kürzel | ⇧A · ⌃⌥R | ✗ | Größenmodus „inhalt" seit Etappe 2 im Modell, kein Griff/Kürzel |
| 3.12 | Position absolut/fixed/sticky mit Pins (oben/rechts/unten/links, Mitte) auf der Fläche sichtbar | Doku 89–90 | — | ◐ | Etappe 2: Datenmodell + Renderer; Inspektor/Fläche fehlen (Etappe 3) |
| 3.13 | Auto-Layout Pinning (Präferenz) | Live B.2.4 | — | ✗ | |
| 3.14 | Größe fixed/relative/fill/fit/viewport, Kette (Seitenverhältnis) | Style-Analyse, Doku 92 | — | ◐ | Etappe 2 im Modell, UI fehlt |

## 4 Einfügen, Werkzeuge

| Nr | Funktion | Framer | Kürzel | Wir | Hinweis |
|---|---|---|---|---|---|
| 4.1 | Insert-Panel (ersetzt linkes Panel): Suche, Kategorien Icons · Shaders · Media (Image, Video, YouTube, MP3, GIF, Vimeo, Lottie, Spotify, Apple Music, SoundCloud, Podcasts, Simplecast) · Forms · Interactive · Social · Utility · Creative · CMS Collections · Fields | Live B.5 | I | ◐ | Katalog-Panel mit Kategorien vorhanden; kein Lottie/Spotify/Shaders/Iconify-Bibliothek |
| 4.2 | Slash-Befehle („/" tippen fügt ein) | Doku B1 | / | ✗ | (bei Framer ist / zugleich Cursor Chat) |
| 4.3 | Sections/Pages-Bibliothek (fertige Header/Footer/Layouts/14 Seitenvorlagen), Insert bleibt offen und zoomt mit | Doku B11 | — | ◐ | Seiten-Vorlagen und Layout-Bausteine vorhanden, keine Sektions-Bibliothek |
| 4.4 | Zeichenwerkzeuge: Frame · Stack · Rows · Columns · Grid · Masonry · Image · Video (Klick-und-Ziehen auf der Fläche) | Live B.6, Kürzel Tools | F S ⇧R ⇧C ⇧G ⇧M ⇧I ⇧V | ✗ | Kein Zeichnen; Container entstehen nur als Vorlage |
| 4.5 | Text-Werkzeug, Doppelklick in Frame erzeugt Text | Live B.1, Kürzel | T | ✗ | Text nur als Baustein aus dem Katalog |
| 4.6 | Vector: Rectangle · Oval · Rounded · Polygon · Star · Path/Pen · Boolean Unite/Subtract/Intersect/Exclude · Join · Group/Ungroup · Vector Sets | Live B.7, Kürzel Tools/Vector Editing, Doku 78–82 | R O U P · ⌥⇧U/S/I/E/J · ⌘G ⌘⇧G | ✗ | Formen-Baustein `shape` vorhanden, kein Zeichnen |
| 4.7 | Link-Werkzeug (Link auf Element setzen) | Menü Tool, Kürzel | L | ◐ | Links nur in Baustein-Feldern |
| 4.8 | Scale-Werkzeug (proportional skalieren) | Menü Tool, Kürzel | K | ✗ | |
| 4.9 | Sample Color (Pipette von der Fläche) | Menü Tool, Kürzel | ⌃C | ✗ | Farbwähler hat Pipette nur im Dialog (`design.pipette`) |
| 4.10 | Bild per Drop auf die Fläche (wird Frame mit Bildfüllung), Bild ersetzen, Crop, Fit-Modi | Doku 52–54, B2 | — | ◐ | Bild-Baustein per Drag aus Katalog/Mediathek; kein Drop von Dateien auf die Fläche, kein Crop |
| 4.11 | Upload Image · Upload Video · Import from Figma | Menü File | ⌥⌘I · ⇧⌘I | ◐ | Mediathek-Upload vorhanden; kein Figma-Import |
| 4.12 | Library (Workspace-Komponenten/Vektoren) | Menü Tool, Kürzel | ⌘/ | ✗ | |
| 4.13 | Plugins: Browse · Run Recent · Development Plugin · Developer Tools | Live B.2.3 | ⌥⌘P · ⌥⌘L | — | Kein Plugin-System geplant |
| 4.14 | Wireframer / KI erzeugt Layout auf der Fläche | Doku B15 | — | ✗ | Etappe 6 (Agent) |

## 5 Kontextmenü, Bearbeiten, Zwischenablage

| Nr | Funktion | Framer | Kürzel | Wir | Hinweis |
|---|---|---|---|---|---|
| 5.1 | Kontextmenü auf Element mit Suchfeld an erster Stelle | Live B.8 | — | ◐ | Suchfeld nur im Baum-Menü, nicht auf der Fläche |
| 5.2 | Cut · Copy · Paste · Paste in Place · Copy Fill · Copy Style · Paste Style (System-Zwischenablage, über Seiten/Projekte) | Menü Edit, Kürzel | ⌘X ⌘C ⌘V ⇧⌘V ⇧⌘C ⌥⌘C ⌥⌘V | ✗ | nur „Duplizieren" |
| 5.3 | Duplicate · Delete · Rename · Auto Rename · Lock · Hide | Live B.8, Kürzel | ⌘D ⌫ ⌘R ⌥R ⌘L ⌘; | ◐ | alles außer Auto Rename; Kürzel nur bei Fokus im Baum |
| 5.4 | Undo · Redo · Back · Forward (Navigationsverlauf) | Menü Edit, Kürzel | ⌘Z ⇧⌘Z ⌘[ ⌘] | ◐ | Undo/Redo nur für die Bausteinliste, nicht für Container/Struktur/Branding; kein Back/Forward |
| 5.5 | Create Component · Create Layout Template · Show Primary · Detach · Update Primary From Instance · Reset Overrides | Kontextmenü, Menü Component | ⌥⌘K ⇧⌘K | ✗ | Keine Komponenten; Layout-Vorlagen nur global |
| 5.6 | Overflow (Untermenü) · Set as Default Fill · Reset Default Frame Fill | Live B.8, B.2.4 | — | ◐ | Überlauf seit Etappe 2 im Modell |
| 5.7 | Code: Create Code Component · Create Code Override · API Documentation | Menü Code | — | — | Etappe 4 bringt CSS-Overrides (Allowlist), kein JS |
| 5.8 | Rechtsklick auf leere Fläche: kein Menü | Live B.9 | — | — | Lücke bei Framer, kein Vorbild |
| 5.9 | Inline-Textbearbeitung per Doppelklick, Bold/Italic/Underline/Typeface | Doku 48, Kürzel Typography | ⌘B ⌘I ⌘U ⌘T | ◐ | einzeilig, ohne Formatierung |
| 5.10 | Sort Pages/Layers Alphabetically · New Page · New Page Folder · Duplicate/Archive/Transfer Project · Copy Remix Link | Menü File | — | ◐ | Seiten anlegen/ordnen vorhanden; kein Ordner-Sortieren, kein Archiv |

## 6 Breakpoints & Responsivität auf der Fläche

| Nr | Funktion | Framer | Kürzel | Wir | Hinweis |
|---|---|---|---|---|---|
| 6.1 | Breakpoints nebeneinander, Kopf mit Play (Preview), Name+Breite, „+" für neuen Breakpoint, Breite ziehbar | Live A, Doku 19–20 | — | ✗ | drei feste Breiten |
| 6.2 | Eigene Breakpoints bei beliebiger Breite | Doku 20 | — | ✗ | |
| 6.3 | Primary Breakpoint, Kaskade nach unten, Override blau, Reset Override | Doku 21–24 | — | ◐ | Etappe 2: Kaskade + `herkunft()` gebaut; Inspektor-UI Etappe 3 |
| 6.4 | Breakpoint-Preview deaktiviert bei zu schmalem Fenster | Doku 25–26 | — | ✗ | |
| 6.5 | Text-Style-Breakpoints in Komponenten | Doku 65 | — | — | keine Komponenten |

## 7 Vorschau, Zusammenarbeit, Verlauf

| Nr | Funktion | Framer | Kürzel | Wir | Hinweis |
|---|---|---|---|---|---|
| 7.1 | Preview in der Fläche (Play): Vollbild, Responsive umschalten, Highlights, Inspect, Refresh, nächster/vorheriger Breakpoint | Kürzel Preview, Doku 27–31 | ⌘P ⇧⌘F Z ⇧⌘H ⌘I ⌘R ⌘. ⌘, | ◐ | nur „Website ansehen" in neuem Tab |
| 7.2 | Comment-Werkzeug: Pins auf der Fläche, Threads, Auflösen | Live B.3, Doku 13 | C | ✗ | bewusst nicht übernommen (Kommentar in `flaechen-overlay.tsx`) — Entscheidung des Nutzers |
| 7.3 | Multiplayer: Cursor anderer, Follow (Auge), Cursor Chat | Doku 14–18, Kürzel | / | ◐ | Realtime-Fremdänderungen werden gemeldet; keine Cursor |
| 7.4 | Version History (Snapshots 5 min/1 h/täglich, zurückkopieren) | Menü File, Kürzel | ⇧⌘H | ✗ | |
| 7.5 | Branching: Branch-Knopf „main", Merge to Main | Live B.1, Kürzel | ⇧⌘M | — | |
| 7.6 | Publish · Open Site · Staging & Versions · Rollback | Menü File, Doku 126–129 | ⇧⌘P ⇧⌘O | ◐ | Veröffentlichen vorhanden; keine Versionen/Staging |
| 7.7 | Invite Collaborators | Live B.1 | — | ◐ | Mitarbeiter über Konto, nicht aus dem Editor |

## 8 Was wir haben und Framer nicht (behalten)

| Funktion | Datei |
|---|---|
| „+"-Nähte zwischen Abschnitten mit Layout-Sofortwahl | `flaechen-overlay.tsx` |
| Abwurf in leere und gefüllte Spalten mit Balken | `flaechen-overlay.tsx` |
| Auge je Gerät direkt am Rahmen mit Einblenden-Knopf | `flaechen-overlay.tsx` |
| Ebenen-Baum mit Suche, Kürzeln, Sperre, Regionen Kopf-/Fußzeile | `ebenen-liste.tsx`, `ebenen-regionen.tsx` |
| Live-Renderer im iframe = exakt die Gast-Seite (keine zweite Rendering-Wahrheit) | `vorschau.tsx`, `canvas-bridge.tsx` |

---

## 9 Zählung

| | Framer (Funktionen in §1–7) | ✓ | ◐ | ✗ | — |
|---|---|---|---|---|---|
| Summe | 81 Zeilen | 4 | 24 | 48 | 5 |

Von 76 für uns sinnvollen Framer-Canvas-Funktionen sind 4 vollständig da,
24 teilweise (meist: Datenmodell seit Etappe 2 vorhanden, Fläche/Inspektor
fehlen), 48 fehlen ganz.

## 10 Reihenfolge des Nachbaus (Vorschlag für den Plan)

Die 48 Lücken hängen an fünf Fähigkeiten. In dieser Reihenfolge, weil jede die
nächste braucht:

1. **Kamera** — Zoom (⌘+/−/0/1/2, ⌘+Rad, Pinch), Pan (Leertaste, Hand), untere
   Canvas-Leiste mit Prozent-Menü, Präferenzen. Technisch: die Bühne wird ein
   `transform: scale()`-Container um den iframe, alle Overlay-Rechtecke
   werden durch die Kamera gerechnet (eine Funktion, wie `stilCss`).
   Deckt 1.2–1.9, 1.15.
2. **Breakpoints als Rahmen** — drei (später n) iframes nebeneinander, Kopf
   mit Name/Breite/Play, „+" für eigenen Breakpoint. Deckt 1.1, 6.1–6.4, 7.1.
3. **Direkte Manipulation** — Ziehen auf der Fläche (Nähte + Stacks), Griffe
   ziehen für Breite/Höhe (schreibt `groesse.*`), Rotation, Pfeiltasten,
   ⌥-Duplizieren, Smart Guides und ⌥-Abstandsmaße. Deckt 3.1–3.7, 3.11.
4. **Auswahl & Zwischenablage** — ⇧-Klick und Marquee auf der Fläche, Select-
   Kürzel, Tab-Cycle, ⌘C/⌘V/⇧⌘V, Copy/Paste Style und Fill, Kontextmenü mit
   Suche auf der Fläche, Undo über alles (Struktur, Branding), Quick Actions.
   Deckt 2.3–2.6, 2.11, 5.1–5.4, 1.18.
5. **Erzeugen auf der Fläche** — Frame/Stack/Grid/Text/Image zeichnen,
   Add Frame/Stack/Remove Wrapper, Align/Distribute/Stapelreihenfolge,
   Rulers/Guides/Layout-Grid, Sample Color, Link-Werkzeug. Deckt 3.8–3.10,
   4.4–4.9, 1.10.

Nicht auf die Liste: Vector-Zeichnen und Boolean (4.6), Plugins (4.13),
Branching (7.5), Kommentare (7.2, Entscheidung des Nutzers), Code-Komponenten
(5.7). Komponenten/Varianten (5.5) sind eine eigene Etappe außerhalb des
Canvas.

---

## 11 Vollständige Kürzelliste

132 Einträge in `FRAMER-KUERZEL-VOLLSTAENDIG.md` (live gelesen). Die
Bereiche: Project 7 · Views 14 · Edit 19 · Selection 8 · Zoom & Guides 9 ·
Tools 19 · Layout 5 · Arrange & Align 12 · Vector Editing 7 · Components 3 ·
Typography 4 · Developer Tools 3 · Preview 8 · CMS 3 · Agent 10 · Branching 1.
Bei uns gebunden: ⌘D ⌘L ⌘; ⌘R ⌫ ⌥↑ ⌥↓ (nur mit Fokus im Ebenen-Baum) und
Escape auf der Fläche — 8 von 132.

## 12 Nachlese der Untermenüs (live, 05.09.2026, ergänzt A–H des Agenten)

Gelesen aus dem DOM (`[role=menuitem]`) in einem Lauf, weil die Menüs zwischen
zwei Werkzeugaufrufen zuklappen:

- **File:** New ⌥⌘N · New Page · New Page Folder · New chat ⌘J · Import from
  Figma… ⇧⌘I · Upload Image… ⌥⌘I · Upload Video… · Publish Site ⇧⌘P · Open
  Site ⇧⌘O · Duplicate · Archive · Transfer Project · Copy Remix Link · Invite
  Collaborators… · Version History ⇧⌘H · Sort Pages Alphabetically · Sort
  Layers Alphabetically
- **Edit:** Undo ⌘Z · Redo ⇧⌘Z · Back ⌘[ · Forward ⌘] · Cut ⌘X · Copy ·
  Paste · Duplicate ⌘D · Delete ⌫ · Find Content ⌘F · Text Search… ⇧⌘F ·
  Rename ⌘R · Auto Rename ⌥R · Lock ⌘L · Hide ⌘; · Back To Page ⌥ESC ·
  Select Top Parent ⌘ESC · Select Parent ESC · Select All ⌘A · Select All
  Siblings ⇧⌘A · Select All Children · Select All Top Parents · Select All
  Text Layers
- **Layout:** Add Frame ⌘↩ · Add Stack ⌥⌘↩ · Remove Wrapper ⌘⌫ · Fit Content
  ⇧A · Resize to Fit Content ⌃⌥R · Bring to Front ] · Bring Forward ⌥⌘↑ ·
  Send Backward ⌥⌘↓ · Send to Back [ · Align ▸ (Inhalt siehe Kürzel Arrange
  & Align)
- **Text · Vector:** ausgegraut ohne Text-/Vektor-Auswahl (nicht geöffnet)
- **Component:** Create Component… ⌥⌘K · Create From Code… ⇧⌘K · Show
  Primary · Detach From Primary · Update Primary From Instance · Reset
  Overrides
- **Code:** Create Code Component… · Create Code Override… · API Documentation
- **Help:** Watch Tutorials · Browse Marketplace · Request Feature · Join
  Community · Copy Version Number
- **View:** wie in `FRAMER-CANVAS-ANALYSE.md` B.2.1; Appearance-Untermenü
  blieb zu.

Unverändert-Beweis nach der Nachlese: kein sichtbares Menü mehr,
`[data-framer-name]` im Canvas = 45 (wie vor der Sitzung). Framer zeigte
danach „Reconnecting" — seine eigene Websocket-Verbindung, nicht durch uns
ausgelöst.
