# Canvas wie Framer — Umsetzungsplan (06.09.2026)

Auftrag vom 06.09.2026: *„schau dir das canvas in der mitte an wie das arbeitet
mit dem style pannel rechts an"* und *„auch das drag and drop wenn du einen text
erstellst oder ein bild einfügst … unser canvas muss genau so funktionieren"*.

Quelle ist der Live-Editor (`framer.com/projects/Adaptable-Breakfast…`, Knoten
`G6IB3qcXF`), heute noch einmal durchgeklickt, plus die Vollerfassung
`docs/FRAMER-EDITOR-VOLLERFASSUNG-2026-09-05.md` §13/§16 und
`docs/FRAMER-STYLE-PANEL-LIVE-2026-09-05.md` §9.

## 1 Was heute gemessen wurde — Canvas und Panel sind EIN Werkzeug

Drei Klicks auf dieselbe Stelle (Überschrift → ⎋ → ⎋) zeigen die Kopplung:

| Auswahl | Fläche | Panel |
|---|---|---|
| Text „Orte, an denen der Alltag leiser wird." | 1 px durchgezogene Akzentkante um den TEXT; der Stack darum erscheint **gestrichelt** (Elternteil) | Größe: Breite `1fr Fill`, Höhe `126.5` **grau** (gemessen) `Fit`, dazu **Grow** (3 Knöpfe) |
| ⎋ → der Stack | Kante um den Stack; zwischen den Kindern stehen **magenta Striche** (der Gap) | zusätzlich die Karte **Layout** (Stack/Grid, Richtung, Verteilen, Ausrichten) |
| ⎋ → der Abschnitt | Kante um den Abschnitt, **zwei runde Griffe** links und rechts auf halber Höhe | Breite `100% Rel`, Höhe `728` grau `Fit`, **Max Width 1120 Fixed** |
| ⎋ → der Breakpoint | Rahmenkopf-Pille wird VOLL blau | Template · Breakpoint (X/Y, Breite 1200 Fixed, Höhe 3272 Fit) · Layout · Typography |

Daraus die vier Regeln, die unser Canvas übernehmen muss:

1. **Griffe zeigt nur, wer sie einlösen kann.** Beim Abschnitt (`100% Rel`)
   sind es zwei — links und rechts, also genau die Achse, die eine Zahl hat.
   Die Höhe steht auf `Fit`, sie wird gemessen, und es gibt keinen Höhengriff.
   Ein Bild mit `Fill` zeigt umgekehrt nur die zwei Griffe oben/unten
   (Vollerfassung §16). **Ein Griff ist ein Versprechen, dass Ziehen wirkt.**
2. **Der graue Wert im Panel ist die Messung von der Fläche.** `126.5`, `336`,
   `728`, `3272` — nirgends gespeichert, nur angezeigt. Wer ihn überschreibt,
   macht aus der Messung eine Einstellung (`Fixed`).
3. **⎋ geht eine Ebene nach oben**, ↩ eine hinein. Der Panel-Inhalt folgt.
4. **Abstände sind auf der Fläche sichtbar** (magenta), nicht nur als Zahl.

## 1b Zweite Messung: die GANZE Fläche (06.09.2026, live geklickt)

Auftrag: *„schau dir doch die komplette fläche an bei framer"* und *„jeder text
und bild und alles ist eine einzelne Funktion, die individuell einzeln
gestaltbar ist durch das Style-Panel"*. Gemessen wurde durch Klicken, Ziehen
und Doppelklicken im echten Projekt; jeder Schreibvorgang wurde mit ⌘Z
zurückgenommen und der Ausgangszustand am Bild gegengeprüft.

| Handgriff | Was Framer tut |
|---|---|
| Klick auf eine Kartenüberschrift | Auswahl ist der TEXT selbst — nicht die Karte. Im Baum: Karte › Icon · Überschrift · Absatz, jedes eine eigene Ebene. Das Panel zeigt Größe (`1fr Fill` / `21 Fit`), Grow, Link, Position, Effekte, Overlays, Cursor … für genau dieses Textstück |
| Klick auf den Absatz darunter | dieselbe Karte, anderer Text, eigene Werte (`43.5 Fit`) |
| Doppelklick auf einen Text | Textcursor auf der Fläche, das Wort unter dem Zeiger markiert |
| Doppelklick auf ein Bild | öffnet dessen **Fill**-Popover samt `Crop` und `Plugins` |
| Ziehen an einem Griff | Höhe/Breite ändern sich live, das Layout fließt mit, der Panel-Wert wird `Fixed` |
| Ziehen eines Elements im Stack | UMSORTIEREN (Bild nach links, Text nach rechts) — kein freies Ablegen |
| `T` + Aufziehen | neuer Textlayer mit `Fixed`/`Fixed` aus dem gezogenen Rechteck, eingefügt als Kind an der Zeigerstelle |
| ⎋ | eine Ebene nach oben, das Panel folgt |
| Herauszoomen (⌘1 → 15 %) | die GANZE Seite steht als EIN hoher Rahmen auf der Fläche (hier 3272 px). Es gibt keinen Innenscroll — man bewegt die Kamera, nicht die Seite |
| Kamera ins Leere | Hinweis „Your content is out of view" mit Knopf `Show` |
| Aufbau | die Fläche ist ein eigener, cross-origin iframe über das ganze Fenster; die Seite darin ist DOM, die Auswahl-Overlays liegen daneben |

**Die eine Folge, die alles andere nach sich zieht:** in Framer ist jedes
Textstück und jedes Bild eine eigene Ebene mit eigenem Style-Panel. Unser
Baustein ist gröber — ein „Titelbild" trägt Eyebrow, Überschrift, Text, Knopf
und Bild in EINER Zeile. Damit dasselbe möglich wird, bekommen die TEILE eines
Bausteins ihre eigene Darstellung; der Anker dafür steht längst im Renderer
(`editierbar(modus, feld)` → `data-feld`), er wurde bisher nur zum Tippen
benutzt. Umgesetzt als `settings.teile.<feld>` mit derselben Struktur wie ein
ganzer Block, ohne Migration.

## 1c Wie sich das Style-Panel je Auswahl ändert (06.09.2026, DOM-Messung)

Auftrag: *„messe auch das verhalten wenn du ein element auswählst wie das style
pannel sich verändert / anpasst"*. Gemessen wurde nicht am Bild, sondern am
DOM des rechten Panels (`[data-is-right-panel]`), nach jeder Auswahl neu
ausgelesen. Die Kette entstand durch WIEDERHOLTEN DOPPELKLICK auf dieselbe
Stelle — das ist Framers Weg nach innen.

**Auswahlregel auf der Fläche (gemessen, vorher falsch angenommen):**
Ein Klick auf eine leere Auswahl trifft den ÄUSSERSTEN Rahmen (den Abschnitt).
Jeder DOPPELKLICK geht eine Ebene tiefer: Abschnitt → Raster → Karte → Text.
Steht die Auswahl schon in dieser Kette, wählt ein einfacher Klick die
GESCHWISTER auf derselben Ebene. ⎋ geht wieder hinaus.

| Ebene | Größe-Karte | Layout-Karte | Stile | Sonderkarten |
|---|---|---|---|---|
| **Abschnitt** (Frame, Stack) | Breite `100% Rel`, Höhe `547.5 Fit` (grau), `Max Width 1120 Fixed`, `Add…` | Stack \| Grid, Richtung, Verteilen, Ausrichten, Wrap, **Gap 48 mit Regler**, Padding je Seite `104/32/104/32` | Opacity, Visible, Fill `Add…`, Overflow `Clip`, Radius, Border `Add…`, Shadows `Add…` | **Selection Colors** (drei Projektfarben mit %), **Scroll Section** gefüllt (`# service`, Offset Y mit −/+) |
| **Raster** (Grid) | Breite `1056 Fixed`, Höhe `192 Fit`, `Max Width 100% Rel` | **Grid**: Masonry Yes/No, **Columns 3**, **Rows 1** (je −/+), **Gap X 16 · Y 16**, Padding, **Advanced** | wie oben | Selection Colors |
| **Karte** (Frame im Raster) | **Columns `Span 1` · Rows `Span 1`** — nur weil der ELTERNTEIL ein Raster ist —, Breite `Auto Fill`, Höhe `Auto Fill` | Stack, Gap 18, Padding 24 | Radius `24`, **Border `Solid`** (gesetzt, kein „Add…") | Selection Colors |
| **Text** | Breite `1fr Fill`, Höhe `43.5 Fit` (grau), **Grow** (3 Knöpfe), Min Max | **fehlt ganz** | nur **Opacity und Visible** | **Text**: Styles `Select…`, Content, Font `Inter`, Weight, Color, Size `14 Px`, Letter `Em`, Line `Em`, Align, Direction, Variable, OpenType · Accessibility **Tag `p`** |

**Die sechs Regeln, nach denen sich das Panel anpasst**

1. **Layout gibt es nur, wo Kinder sind.** Am Text fehlt die ganze Karte.
2. **Grow gibt es nur, wo keine eigene Größe steht** — beim Text statt der
   Kette „Seitenverhältnis".
3. **Der Elternteil bestimmt mit:** ein Kind im Raster bekommt `Columns/Rows
   Span` ÜBER Breite und Höhe. Im Stack steht dort nichts davon.
4. **Layout=Grid tauscht die Zeilen der Karte aus** (Masonry, Columns, Rows,
   Gap X/Y, Advanced statt Richtung/Verteilen/Ausrichten/Wrap).
5. **Stile schrumpfen am Text** auf Deckkraft und Sichtbar; Farbe, Größe und
   Schnitt stehen in der Text-Karte, nicht bei den Stilen.
6. **Gesetzte Werte ersetzen „Add…"** (Border zeigt `Solid`), und eine
   gefüllte Karte klappt auf (Scroll Section zeigt Name und Offset).

## 2 Was unser Modell anders kann — und warum das kein Mangel ist

Framer legt Layer mit freien `x/y` an; eine Seite bei uns ist ein BAUM
(Abschnitt → Spalte → Baustein, 0472) und wird als Stapel gerendert. Damit:

* **Kein „Drop außerhalb des Rahmens"** (Framer legt dort einen frei stehenden
  Layer an). Bei uns gibt es außerhalb der Seite keinen Ort, an dem etwas
  stehen könnte. Wer frei positionieren will, setzt `Position: Absolut` samt
  Pins — das gibt es im Panel und wirkt im Renderer.
* **Kein Ziehen an beliebige Bildpunkte.** Die Einfügestelle ist immer eine
  NAHT zwischen zwei Bausteinen oder das Innere einer Spalte. Genau das zeigt
  Framer beim Ziehen in einen Stack ebenfalls: eine magenta Einfügelinie
  (Vollerfassung §16).

Beides bleibt so und wird benannt, statt eine Freiheit vorzutäuschen, die die
Datenstruktur nicht hergibt (Wurzel 4).

## 3 Ist-Stand (Code, 06.09.2026)

| Teil | Datei | Stand |
|---|---|---|
| Kamera, Rahmen, Fußleiste | `web/.../editor/buehne.tsx` | ✓ Zoom, Hand, Breakpoint-Rahmen, Rahmenkopf als Akzent-Pille |
| Auswahl-Schicht | `web/.../editor/flaechen-overlay.tsx` | ◐ **gestrichelte** Kante, **acht tote Griffe** (`pointer-events-none`), Etikett, Leiste, Nähte mit „+" |
| Brücke | `web/.../editor/use-canvas-bruecke.ts` · `builder/.../canvas-bridge.tsx` | ✓ Rechtecke, Hover, Klick, Kontextmenü, Text; **neu heute**: `sendeStil` (Live-CSS ohne Neuladen) |
| Einfügen | `hinzufuegen-panel.tsx` + `onZiehen`/`onAbwurf` | ◐ Ziehen aus dem Katalog auf eine Naht/Spalte; kein Text-/Bild-Werkzeug auf der Fläche |
| Panel | `editor/stil-inspektor.tsx` | ✓ nach §3 der Gesamtliste vollständig |

## 4 Etappen

### Canvas 3 — Auswahl und Panel als eine Sache
* Kante **durchgezogen** 1 px Akzent (Framer), Elternteil **gestrichelt**.
* Griffe NUR auf Achsen, die eine Zahl tragen können: Achse `inhalt` (Fit) →
  kein Griff; `fest`/`relativ`/`viewport`/`fuellen` → zwei Griffe je Achse.
* ⎋ = Elternteil, ↩ = erstes Kind, direkt auf der Fläche (heute nur im Baum).
* Die acht toten Griffe verschwinden; was bleibt, zieht wirklich (Etappe 4).

### Canvas 4 — Griffe ziehen, Abstände ziehen
* Ziehen an einem Griff schreibt `groesse.breite`/`groesse.hoehe` als
  `{modus:"fest", wert}` — dieselbe Zeile, die das Panel zeigt, live über
  `sendeStil`, gespeichert über den normalen Weg (ein Undo-Schritt).
* Während des Ziehens ein Maß-Etikett an der Kante (`420 × 260`).
* Magenta **Gap-Marker** zwischen den Kindern eines Containers mit
  `layout_abstand`; Ziehen daran ändert den Abstand.
* **Padding-Marker** an den vier Innenkanten des gewählten Containers.

### Canvas 5 — Einfügen wie im Vorbild
* **Werkzeuge im Kopf**: `T` armiert Text, `I` öffnet den Katalog, `⇧I` Bild.
  Ein armiertes Werkzeug + Klick auf die Fläche fügt an der nächsten Naht ein
  (Framer: Klick setzt an die Zeigerstelle).
* **Ziehen aus dem Katalog**: magenta Einfügelinie an der Naht unter dem
  Zeiger, Rahmen um die Spalte, in die es fällt — beides gibt es schon, es
  bekommt Framers Farbe und die Linie über die volle Breite.
* **Bild ziehen**: aus der Mediathek direkt auf die Fläche; die Adresse reist
  mit (`ziehtBild`), damit niemand das Bild zweimal wählt.
* Jeder Abwurf ist EIN Schritt im Verlauf.

### Canvas 6 (offen, mit Grund)
Mehrfachauswahl per Rahmen (Marquee) und Hilfslinien: sie brauchen freie
Koordinaten. In einem Stapel ist die Reihenfolge die Position — ein Rahmen um
zwei Bausteine wählt zwei Zeilen einer Liste, kein Rechteck. Kommt, wenn es
einen Anwendungsfall gibt, der nicht schon über den Ebenen-Baum geht.

## 4b Gebaut und live geprüft (06.09.2026)

| Was | Beleg im laufenden Editor |
|---|---|
| **Teile als eigene Ebenen** — jedes Textstück, jeder Knopf | Klick wählt den Abschnitt, Doppelklick die Überschrift „Bergchalet Nordlicht" mit eigener Kante; der Baustein darum wird gestrichelt |
| **Eigenes Style-Panel je Teil** | Größe (768 × 73 gemessen), Wachsen, Effekte, Overlays, Cursor, Stil, Transform, **Text** — ohne Layout-Karte, genau wie bei Framer für ein Textelement |
| **Live-Stil ohne Neuladen** | Textgröße des Absatzes auf 26 px gesetzt: die Fläche zog sofort nach, der Knopf rutschte mit; Wert geleert → sofort zurück |
| **Auswahlkette wie Framer** | Klick = äußerster Rahmen, Doppelklick = eine Ebene tiefer, ⎋ = eine hinauf |
| **Doppelklick auf Text** | öffnet den Schreibcursor und markiert das Wort; erst dann ist die Stelle beschreibbar |
| **Knopf einzeln** | Doppelklick auf „Verfügbarkeit prüfen" wählt die Beschriftung als eigene Ebene |
| **Ebenen-Baum** | unter „Titelbild" stehen Kleine Zeile darüber · Überschrift · Unterüberschrift · Beschriftung des Buttons; ein Klick darauf wählt das Teil |
| **Griffe** | nur auf Achsen mit einer Zahl, sie ziehen wirklich und schreiben `groesse.<achse>` |
| **Fläche ruhig** | Werkzeugleiste und Namensetikett am Element entfernt, Kante 1 px in Framers Blau, Elternteil gestrichelt |

Prüfungen: `tsc` und ESLint in `web` und `builder` ohne Fehler, 59 Pakettests,
421 Backend-Tests grün.

## 4d Auswahl auf der Fläche zieht die Ebenen mit (06.09.2026)

Auftrag: *„das verhalten wenn ich das element über die fläche auswähle muss in
ebene mit ziehen, erst verhalten messen und dann im code anpassen"*.

**Gemessen bei Framer** (Klick auf die Fußzeile im Canvas, Baum per DOM
ausgelesen): `scrollTop` sprang von 0 auf 64 — der Baum scrollte gerade so
weit, dass die Zeile sichtbar wurde (`nearest`, nicht zentriert). Die Kette
darüber war aufgeklappt, der gewählte Knoten SELBST ebenfalls, und schon
offene Zweige blieben offen.

**Bei uns geändert:** der vorhandene Effekt klappte nur die VORFAHREN auf.
Jetzt öffnet er auch den gewählten Knoten, und ein zweiter Effekt tut dasselbe
für einen gewählten TEIL — dessen Zeile hängt unter dem Baustein und trägt die
Kennung `<blockId>#<feld>`, war also für den alten Effekt unsichtbar.

**Dazu die Auswahlfarbe:** der Baum markierte in der Markenfarbe (rot), die
Fläche in Framers Blau. Dieselbe Auswahl in zwei Farben sieht aus wie zwei
Dinge — beide stehen jetzt auf `#0099ff`.

Geprüft im laufenden Editor: Doppelklick auf einen Abschnitt weit unten wählt
ihn, der Baum klappt auf und markiert die Kette; ein Klick auf „Überschrift"
im Baum wählt das Teil auf der Fläche. Verschiedene Teile zeigen verschiedene
Werte (Überschrift: Textstil gesetzt, Kleine Zeile darüber: leer) — die
Trennung je Teil trägt.

## 4e Die ganze Struktur als Ebenen (06.09.2026)

Auftrag: *„jedes Dom, Eltern, Column, Frame, Stack, Grid, Masonry, Image, Video
muss über Style anpassbar sein und auch im Baum von Anfang bis Ende erfasst"*.
Framers Einfügemenü führt genau diese Namen (Frame `F` · Stack `S` · Grid `⇧G`
· Masonry `⇧M` · Image `⇧I` · Video `⇧V`), und jedes davon ist dort eine Ebene.

**Gebaut:** die Brücke meldet nicht mehr nur die `data-feld`-Stellen, sondern
den ganzen Teilbaum eines Bausteins — jeden Knoten mit eigener Box, dazu Bilder
und Videos, samt Elternteil, Art und dem Text als Namenszusatz. Der Editor baut
daraus die Ebenen unterhalb des Bausteins; jeder Knoten hat sein eigenes
Style-Panel.

**Der Schlüssel** ist entweder der Feldname (`heading`, sprechend und stabil)
oder ein Pfad aus Kind-Nummern (`c1_3_2`). Aus beiden baut `teilSelektor` die
CSS-Regel: `[data-feld="heading"]` bzw. `> :nth-child(1) > :nth-child(3) >
:nth-child(2)`. Grenzen: acht Ebenen tief, achtzig Knoten je Baustein.

**Live geprüft:** unter „Titelbild" steht jetzt Stapel → Bild · Rahmen · Rahmen
→ Kleine Zeile darüber · Überschrift · Unterüberschrift · Beschriftung des
Buttons. Ein Klick auf „Bild" wählt es mit eigener Kante und Griffen; Breite
auf 600 px gesetzt → das Bild schrumpfte sofort; Wert geleert → zurück.

**Dabei gefunden und behoben:** das Zahlenfeld für Breite und Höhe war
gesperrt, solange kein Modus gesetzt war — und ohne Größe steht dort keiner.
Man musste erst „Fest" wählen und dann tippen. Bei Framer tippt man die Zahl,
und daraus WIRD „Fixed". Jetzt auch bei uns.

**Ebenfalls gebaut:** Padding-Marker an den Innenkanten (bei Framer nachgemessen
und herangezoomt: kurze Striche in `#0099ff`, nicht magenta — die Gap-Marker
wurden auf dieselbe Form gebracht) und `Columns/Rows Span` für Kinder eines
Rasters (`raster_span_x/y`, neu im Schema und im Paket).

## 4f Umsortieren per Ziehen auf der Fläche (06.09.2026)

**Gemessen bei Framer:** ein Element im Stapel wird gezogen und UMSORTIERT —
das Bild wanderte nach links, der Text nach rechts. Kein freies Ablegen.

**Gebaut:** die Brücke erkennt die Geste im iframe (gedrückte Maustaste plus
mehr als 5 px Bewegung) und meldet `zug` mit `start`/`bewegt`/`ende`. Das
Overlay zeigt die Einfügelinie an der Naht unter dem Zeiger und setzt den
Baustein beim Loslassen dorthin — die Stelle kommt aus der Geometrie, nicht aus
einem Index (dieselbe Regel wie beim Abwurf aus dem Katalog). Unter der
Schwelle bleibt es ein Klick.

**Zwei Fehler, die erst der Live-Test zeigte:**

1. **Die Vorschau blieb stehen.** Die neue Optimierung „nur Stil geändert →
   nicht neu laden" traf auch das Umsortieren: der Baum zeigte die neue
   Reihenfolge, die Seite die alte. Jede Strukturänderung setzt jetzt
   ausdrücklich `nurStilRef = false` — Verschieben, Ziehen, Duplizieren,
   Löschen.
2. **Der Zug markierte den Text** unter der Maus, die halbe Seite wurde blau.
   Während der Geste steht `user-select: none`, und die Markierung wird
   geleert.

Dazu ein Absturz beim ersten Versuch („Cannot access 'bausteinRechtecke' before
initialization"): die neue Zug-Auswertung stand VOR der Deklaration der
Rechtecke. TypeScript sieht das nicht, weil der Zugriff in einer Funktion
liegt — die Live-Probe schon.

## 4c Noch offen für „1:1"

1. **Bild als Teil**, wo der Baustein es als CSS-Hintergrund rendert: es hat
   kein eigenes Element, also auch keine Ebene. (Ein `<img>` im Markup ist seit
   der Strukturerfassung erfasst.)
2. **Werkzeuge auf der Fläche**: `T` und `⇧I` mit Aufziehen.
3. **„Inhalt außer Sicht"**-Hinweis mit Knopf zurück.

## 5 Reihenfolge und Belege

Gebaut wird 3 → 4 → 5. Jede Etappe endet mit: `tsc --noEmit` und `bun run lint`
in `web` und `builder`, Pakettests (`bun test` in `packages/baukasten-stil`),
und einer Live-Probe im laufenden Chrome über den Debug-Port
(`node scripts/diagnose/chrome-lesen.mjs`) — kein Playwright.

## §4g — Einzelne Elemente (Knopf, Bild, Rasterkind), 06.09.2026

**Bei Framer gemessen** (Projekt „Adaptable Breakfast", Knopf „Kontakt" in der
Navigation):
- Rahmen MIT Kind (`Kontakt`, Tag `a`): Link · Position · Size · **Layout**
  (Type Stack/Grid, Direction, Distribute, Align, Wrap, Gap, Padding 11/18/11/18)
  · Effects · Overlays · Cursor (Web → Pointer) · Styles (Opacity, Visible,
  Fill 19352C, Overflow, Radius 100, Border, Shadows) · Transforms · Selection ·
  Scroll Section · Accessibility (Tag) · Code Overrides. **Keine Text-Sektion.**
- Text-Layer darin: Link · Position · Size (mit **Grow**) · Effects · Overlays ·
  Cursor · Styles · Transforms · **Text** (Styles, Content, Font, Weight, Color).
  **Keine Layout-Sektion.**

**Daraus gebaut** (`stil-inspektor.tsx`, `abschnitts-editor.tsx`):
- `layout` — Layout-Karte am TEIL, sobald seine gemeldete Art ein Rahmen ist
  (`frame`, `stack`, `grid`, `masonry`, `link`, `knopf`). Damit hat der Knopf
  seinen Innenabstand; live geprüft: Innen 28 → Höhe 56 → 80, zurückgesetzt.
- `textKarte` — Text-Karte nur am Element, das den Text selbst trägt: nicht am
  Rahmen mit Kindern, nicht an Bild/Video.
- `imRaster` — Spalten-/Zeilen-Span am TEIL, wenn sein Elternteil im gemeldeten
  Teilbaum ein `grid`/`masonry` ist (vorher nur über den Block-Baum, also für
  Teile nie).
- Doppelklick wählt das INNERSTE Kettenglied (`ketteAus`), sonst landete man
  über Abschnitt + Spalte nach zwei Doppelklicks erst bei „Inhalt".
