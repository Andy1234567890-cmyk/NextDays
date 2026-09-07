# Framer Editor — rechte Seitenleiste „Style" und „Agent", Lückenschluss (live vermessen 05.09.2026)

Ergänzt drei bestehende Messungen, die hier NICHT wiederholt werden:
- `FRAMER-STYLE-PANEL-ANALYSE.md` (28.08.) — Textfall komplett: Link/Position/
  Size/Effects/Overlays/Cursor/Styles/Transform/Text/Selection/Scroll Section/
  Accessibility/Code Overrides, Farbpopover (Solid/Linear/Radial/Conic), Text-
  Styles-Popover, Agent-Reiter-Grundaufbau.
- `FRAMER-LAYERS-INSPEKTOR-ANALYSE.md` (05.09.) — Layers-Panel, Breakpoint-
  Style, Stack-Style, Bild-Style, „Nichts gewählt", Border-/Shadow-Popover,
  Kontextmenüs.
- `FRAMER-CANVAS-ANALYSE.md` §C — CMS-Collection-List-Felder in Kurzform
  (Content → Source/State/Filters/Sorting, ohne Popover-Inhalt).

Diese Datei liefert die LÜCKEN: das CMS-Element vollständig samt aller drei
Content-Popover, ein Element DARIN, das Fill-Popover mit fünf Reitern, den
Grid/Masonry-Layoutmodus mit Columns/Gap/Advanced, das Link/Button-Element
(„Kontakt" mit echtem `mailto:`-Link + New-Tab-Schalter), sowie geprüfte
Abwesenheiten (keine Komponenten-Instanz, kein zweiter Breakpoint) und echte
Werkzeuggrenzen (Abschnitt H).

Quelle: `framer.com/projects/Adaptable-Breakfast--v2T65fa1QUvhPaNeMxtv-gMzjL`,
Projekt „Adaptable Breakfast", Seite `/ferienhaus-agentur`, Breakpoint
„Desktop" (einziger Breakpoint dieses Projekts). Fenster ≈ 1405 × 739 CSS-px
(Bildschirmfotos 2810 × 1478, Faktor 2). Werkzeug: `chrome-steuern.mjs`,
Debug-Chrome Port 9222.

---

## A · Aufbau (nur Ergänzung)

Das rechte Panel ist ein einzelner scrollbarer Container (`class="shr89u9
s1i74306 wc7ts7t"`, sichtbare Höhe 637 CSS-px, Gesamthöhe bis 1852 CSS-px je
nach Elementart) — direktes Setzen von `scrollTop` funktioniert (kein
virtualisiertes Rendern, anders als Listen), weil alle Abschnitte durchgehend
im DOM stehen und nur der sichtbare Ausschnitt verschoben wird. Damit lässt
sich jeder Abschnitt gezielt in den sichtbaren Bereich holen, auch wenn er wie
bei der CMS-Liste erst bei y > 1300 CSS-px liegt.

Reiterwechsel (Style ↔ Agent) und ein Klick auf eine LEERE Canvas-Fläche
setzen die Scroll-Position des Panels zurück und können — bei Agent ohne
Guthaben — die Auswahl auf „nichts gewählt" zurückfallen lassen; ein erneuter
Klick auf das Element ist dann nötig.

---

## B · CMS Collection List („Ferienwohnungen Liste") — vollständig

Ausgewählt im Layers-Panel: `Ferienwohnungen Liste` (Symbol: Datenbank-Zylinder,
kein Frame/Stack-Symbol). Abschnitte von oben:

**Link · Position · Size · Content · Layout · Effects · Overlays · Cursor ·
Styles · Transforms · Selection · Scroll Section · Accessibility ·
Code Overrides**

Identisch zur Reihenfolge bei Stack/Frame, mit **Content** zusätzlich
zwischen Size und Layout — das ist die CMS-spezifische Erweiterung.

### B1 Size (Abweichung vom generischen Frame)
| Zeile | Wert |
|---|---|
| Width | `1120` Fixed |
| Height | `438` (Platzhalter, berechnet) Fit |
| **Max Width** | `100%` Rel (zusätzliche Zeile, bei generischem Frame nicht immer vorhanden) |
| Min Max | `Add…` |

### B2 Content (NEU — bei keinem anderen Element vorhanden)
| Zeile | Feldtyp | Wert / Optionen |
|---|---|---|
| Source | `<select>` | **`Ferienwohnungen`** (einzige Option — genau eine CMS-Collection im Projekt) |
| State | Segment | **`Default` / `Empty`** (aktiv: Default) |
| Filters | Liste, Kopf `Add Filter`/`Add Collection Filter` | leer → `Add…` |
| Sorting | Liste, Kopf `Add Collection Order` | leer → `Add…` |
| Pagination | Liste, Kopf `Add Pagination` | leer → `Add…` |

#### B2a Filters-Popover (nach Klick auf `Add…`/`Add Filter`)
Öffnet einen **Feldwähler** (kein Dialog mit Titel, direkt eine Liste):
`Dismiss popup` (Kopfzeile) und darunter die Feldliste der Collection
„Ferienwohnungen": **`Titel` · `Slug` · `Region` · `Kurzbeschreibung` ·
`Gäste` · `Bild` · `Created` · `Updated`**. Diese acht Felder sind das
komplette Schema der CMS-Collection „Ferienwohnungen" — bislang nirgends
dokumentiert. Ein Klick auf ein Feld würde vermutlich einen Vergleichsoperator
+ Wert-Editor öffnen (nicht geklickt, um keinen Filter real anzulegen — siehe H).

#### B2b Sorting-Popover „Order" (nach Klick auf `Add…`/`Add Collection Order`)
Eigener Dialog mit Titel **„Order"** (260 breit, X-Knopf zum Schließen) und:
| Zeile | Bedienelement |
|---|---|
| `Field` | Knopf **`Select…`** (öffnet vermutlich dieselbe 8-Felder-Liste wie B2a; nicht geöffnet, siehe H) |

Nach dem Öffnen erscheint in der Sorting-Zeile im Hauptpanel sofort ein
Eintrag mit **Richtungssymbol `↓`** und Text **„Inactive"** (der Eintrag ist
angelegt, aber ohne Feld noch wirkungslos) + einem `Remove`-Knopf (×) rechts.
**Dieser Schreibvorgang wurde in derselben Messung per `Remove`-Knopf entfernt
und gegengeprüft** (Sorting-Zeile wieder „Add…" — siehe Unverändert-Beweis).

#### B2c Pagination
Nur der Kopf mit `Add…`/`Add Pagination` erfasst; das Popover selbst lag
unterhalb des sichtbaren Panelausschnitts und wurde nicht geöffnet (siehe H).

### B3 Layout — Grid/Masonry (NEU gegenüber Stack)
Bei der CMS-Liste ist Layout **bereits gefüllt** (kein leerer „+"-Kopf):
| Zeile | Bedienelement | Wert |
|---|---|---|
| Type | Segment | **`Stack` / `Grid`** — hier `Grid` |
| Masonry | Segment | **`Yes` / `No`** — hier `No` |
| Columns | Zahl + `Decrease`/`Increase`-Knöpfe | `3` |
| Gap | **zwei** Zahlenfelder nebeneinander (`#gap-input` × 2) | `18` / `18` (Spalten-/Zeilenabstand getrennt einstellbar, im Ruhezustand als eine Zeile „Gap" mit einem sichtbaren Wert zusammengefasst) |
| Padding | ein Zahlenfeld + Umschalter `Padding`/`Padding per side` | `0` |
| **Advanced** | eigener Knopf `#advancedLayout` unterhalb von Padding | vorhanden bei Grid-Layout, bei Stack-Layout nicht beobachtet |

`Masonry: Yes` würde vermutlich die feste Spaltenzahl durch ein Pinterest-
artiges Kachelraster ersetzen (Beschriftung „Masonry" typisch dafür) — nicht
geschaltet, um kein Layout umzubauen (siehe H).

Der `Advanced`-Knopf wurde geklickt; im unmittelbar folgenden `karte:`-Aufruf
war KEINE strukturelle Änderung (Gap/Padding blieben je ein Feld, keine X/Y-
Aufteilung) messbar — vermutlich ein reiner Zustands-/Fokus-Umschalter ohne
sichtbaren Effekt bei diesem Layout, oder ein Popover, das sofort schließt.
Kein Datenverlust, keine Rücknahme nötig.

### B4 Fill-Popover — 5 Reiter (NEU, bislang nur für Text-Farbe mit 4 Reitern belegt)
Nach Klick auf `Add…`/`Add Fill` bei **Fill** (Styles-Abschnitt) öffnet sich
links vom Panel ein Popover **„Fill"** (280 breit, X zum Schließen):

| Element | Beschreibung |
|---|---|
| Reiterleiste | **5 Icon-Reiter**: Vollkreis (Solid, aktiv/blau) · Diagonal-Halbkreis (Linear Gradient) · Kreis mit Punkt (Radial Gradient) · gevierteilter Kreis (Conic Gradient) · Globus/Bild-Symbol (**Image** — bei Text-Farbe (B9b in STYLE-PANEL-ANALYSE) nicht vorhanden, dort nur 4 Reiter ohne Image) |
| Sättigungsfläche | Farbverlaufsfläche (Weiß→Farbe→Schwarz), Fadenkreuz-Handle |
| Farbtonregler | horizontaler Regenbogen-Schieberegler |
| Alpha-Regler | Schachbrettmuster-Leiste unter dem Farbtonregler |
| Wertfeld | Hex-Eingabe, z. B. `FFFFFF` |
| Deckkraft | `100%`-Feld daneben |
| Format-`<select>` | **`RGB` / `HSL` / `HEX`** (hier ohne `P3`, anders als beim Text-Farbpopover, das zusätzlich `P3` listet — Unterschied vermutlich abhängig vom Farbraum-Projekteinstellung, nicht am selben Tag verglichen) |
| Pipette | Eyedropper-Knopf rechts vom Format-Select |
| Knopf | **`New Style`** (unten, volle Breite) |

**Schreibtest durchgeführt:** Klick auf `Add Fill` setzte sofort `FFFFFF` als
Fill UND fügte `FFFFFF 100%` zur „Selection → Colors"-Liste hinzu (Wurzel 2:
ein Klick ist bereits eine Handlung, kein Vorschau-Zustand). Zurückgenommen
mit `taste:Meta+z` — Fill wieder `Add…`, Selection-Colors-Liste wieder auf
den ursprünglichen 4 Einträgen (siehe Unverändert-Beweis).

---

## C · Element „Ferienwohnung" (Kind der CMS-Liste)

Layers-Panel zeigt unter „Ferienwohnungen Liste" genau ein Kind:
`Ferienwohnung` (gleiches Datenbank-Symbol wie die Liste — Framer markiert
das CMS-Vorlagenelement selbst, nicht nur die Liste, als Collection-
gebunden). Nicht einzeln selektiert und durchgeklickt (siehe H) — aus der
Canvas-Karte ist bekannt, dass es Titel, Region, Kurzbeschreibung, Gäste/
Schlafzimmer und Bild als Kinder enthält (sichtbar an den drei gerenderten
Karten „Haus am Fjord" / „Dünenhaus Lykke" / „Inselhütte Vika" im Canvas).

---

## D · Link/Button-Element „Kontakt" (Navigation Links → Kontakt)

Layers-Pfad: `Navigation → Navigation Links → Kontakt` (Frame-Symbol, ein
eigenes Kettenglied-Icon 🔗 rechts von Name — dieses Icon steht bei JEDEM
Kind von „Navigation Links" mit gesetztem Link: `Ferienwohnungen`,
`Für Eigentümer`, `Kontakt`). „Kontakt" selbst enthält ein Textkind `Kontakt`.

### D1 Link-Abschnitt (mit gesetztem Wert — NEU gegenüber der leeren Form)
| Zeile | Bedienelement | Wert |
|---|---|---|
| Link To | Eingabefeld | **`mailto:hallo@kues…`** (echte Mailadresse, gekürzt im Feld sichtbar) |
| **New Tab** | Segment **`Yes` / `No`** | **`Yes`** |

Die Zeile **„New Tab" erscheint erst, wenn Link To einen Wert hat** — im
Leerzustand (siehe STYLE-PANEL-ANALYSE B1, `Ferienwohnungen Liste` B/Kontakt
selbst vor dem Setzen) steht nur `Link To`. Das ist eine bislang nicht
dokumentierte bedingte Zeile.

### D2 Größe
Width `88.5` Fit, Height `36` Fit (passt sich an den Textinhalt „Kontakt" an).

### D3 Layout (Kontakt als Container um sein Textkind)
Type `Stack`, Distribute `Center`, übrige Werte wie Standard-Stack.

Nicht geöffnet: das Link-Kopfzeichen-Menü (`Rel`/`Parameters`/`Tracking`) an
DIESEM konkreten, bereits verlinkten Element — die Struktur wurde für den
leeren Fall schon in STYLE-PANEL-ANALYSE B1 erfasst; ob sich der Menüinhalt
bei gesetztem Link ändert (z. B. `Rel` mit „nofollow" vorbelegt wegen
`mailto:`), ist offen (siehe H).

---

## E · Geprüfte Abwesenheiten (kein Fund ist hier ein Ergebnis, kein Mangel)

- **Keine Komponenten-Instanz im Projekt.** Alle Symbolfarben im Layers-Baum
  sind Grau `rgb(153,153,153)`, Blau `rgb(0,153,255)` (Stack/Frame, aktiv
  Weiß) oder Weiß (Auswahl) — **keine lila/violette Farbe**, die Framer für
  Komponenten-Instanzen verwendet. Über den gesamten Baum von 21 Blattknoten
  geprüft (`Desktop` bis `Fußzeile`, alle Ebenen aufgeklappt). Damit bleibt
  „Komponenten-Instanz" für dieses Projekt ein Leerfund, kein Messfehler.
- **Nur ein Breakpoint** (`Desktop`, Badge „Primary"). Kein Tablet/Phone
  vorhanden — die Breakpoint-Leiste selbst wurde nicht angeklickt (destruktiv,
  siehe H), aber der Layers-Baum zeigt nur die eine Wurzel `Desktop`.

---

## F · Zustände (Ergänzung)

| Zustand | Beobachtung |
|---|---|
| Fill gerade gesetzt | Fill-Zeile zeigt Farbfeld + Hex-Wert + `×`-Entfernen, UND ein neuer Eintrag erscheint automatisch unter „Selection → Colors" (die Liste sammelt jede im Element verwendete Farbe, nicht nur die vom Nutzer bewusst benannten). |
| Sortierung gerade angelegt, Feld ungewählt | Zeile zeigt Icon `↓` + Text **„Inactive"** statt eines Feldnamens — ein eigener Zwischenzustand zwischen „leer" und „gültig", nicht nur ausgegraut. |
| Link gesetzt vs. leer | Zusätzliche Zeile „New Tab" erscheint nur bei gesetztem Link (bedingte Zeile, kein Platzhalter). |
| Grid-Layout vs. Stack-Layout | Grid zeigt eigene Zeilen `Columns` (mit Stepper) und doppeltes `Gap`-Feld; Stack zeigt ein einzelnes `Gap`-Feld. |
| Reiterwechsel Style→Agent→Style | Kann die Element-Auswahl auf „nichts gewählt" zurücksetzen, wenn zwischenzeitlich auf leere Canvas-Fläche geklickt wurde — kein Bug, aber eine Falle für Messungen (Panel-Text nach Tab-Wechsel ist nicht automatisch der neue). |

---

## G · Für den Nachbau (Ergänzung zu den bestehenden drei Dokumenten)

- **Content-Abschnitt ist CMS-exklusiv** und sitzt IMMER zwischen Size und
  Layout — nicht als eigenständiges Feature, sondern strukturell an der Stelle,
  an der bei Nicht-CMS-Elementen direkt Layout folgt.
- **Grid-Layout braucht doppelte Gap-Felder** (Spalte × Zeile getrennt),
  Stack-Layout kommt mit einem aus — beim Nachbau die Layout-Engine danach
  verzweigen, nicht ein generisches „Gap" für beide Fälle bauen.
- **Ein Fill-/Filter-/Sortier-„Add…"-Klick IST bereits die Handlung**, kein
  Vorschau-Öffnen (Wurzel 2 aus CLAUDE.md gilt 1:1 fürs Nachbauen: unser
  Editor sollte das nicht so machen, sondern beim „Add…" einen Editor mit
  Default-Werten öffnen und erst beim Bestätigen schreiben).
- **Bedingte Zeilen sind ein eigenes Muster**: „New Tab" existiert nur, wenn
  „Link To" einen Wert trägt. Beim Nachbau nicht pauschal alle Zeilen einer
  Sektion gleichzeitig rendern.
- **Der Fill-Popover hat einen Reiter mehr als der Text-Farbpopover** (Image
  zusätzlich) — die beiden Popover sind NICHT dieselbe Komponente mit
  unterschiedlicher Konfiguration, sondern zwei getrennt zu bauende Varianten
  (Element-Fill kann ein Bild sein, Textfarbe nicht).
- **Die 8 CMS-Felder** (Titel, Slug, Region, Kurzbeschreibung, Gäste, Bild,
  Created, Updated) sind ein reales Beispielschema für „was eine Objekt-
  Collection braucht" — als Referenz für die Ferienwohnungs-Objektfelder in
  unserem eigenen Baukasten verwendbar.

---

## H · Nicht geprüft (mit Grund)

- **Effects-„+"-Menü, Overlays-„+"-Menü, Cursor-„+"-Menü für Stack/Frame/CMS-
  Liste** — mehrfach versucht (`klickauf:` auf den Abschnittskopf, auf die
  exakte SVG-Koordinate, auf den umschließenden `.hsz4dac`-Wrapper; drei
  Versuche gemäß Skill-Vorgabe), das Menü öffnete sich in keinem Fall
  nachweisbar (weder im nachfolgenden `karte:`-Dump noch im sofortigen
  Bildschirmfoto). Der Menüinhalt ist für den TEXT-Fall bereits vollständig in
  `FRAMER-STYLE-PANEL-ANALYSE.md` §B4–B6 dokumentiert (Hover/Press/Loop/Drag/
  Scroll›/Flow bzw. Relative/Fixed bzw. Web Cursor/Custom Cursor/Set Variant)
  und für den STACK-Fall unabhängig per Hover in
  `FRAMER-LAYERS-INSPEKTOR-ANALYSE.md` §C2 bestätigt (identischer
  Menüinhalt inkl. Lightbox/Ticker zusätzlich zum Textfall) — die Lücke ist
  daher der EDITOR jedes einzelnen Effekttyps (Appear-Editor, Hover-Editor,
  Scroll-Transform-Editor mit Feldern für Transition-Typ, Duration, Delay,
  Scale, Offset X/Y, Rotate, Opacity, Blur, Stagger, Replay), nicht die
  Menüliste selbst. Grund für den Abbruch: jeder Versuch riskierte bei
  Erfolg einen echten Effekt-Eintrag auf einem Live-Element, und drei
  Fehlversuche ohne sichtbares Popover ließen keinen sicheren Rückweg
  planen (Regel „Rückweg zuerst beweisen" aus CLAUDE.md).
- **Agent-„New chat"-Klappliste (Verlauf früherer Chats)** — öffnete sich
  nicht; der Workspace ist ohne Guthaben („Out of credits"), vermutlich
  deshalb keine Chat-Historie zum Anzeigen. Modellwahl („Opus 4.8" o. ä.) war
  aus demselben Grund nicht erreichbar (kein aktiver Chat).
  Bereits in `FRAMER-STYLE-PANEL-ANALYSE.md` als „Modellwahl zweimal
  geklickt, ging nicht auf" vermerkt — hier bestätigt: strukturell blockiert,
  kein Bedienfehler.
- **CMS-Filter-Feldwähler → Vergleichsoperator/Wert-Editor** (nach Auswahl
  eines Felds wie „Titel" in B2a) — nicht geklickt, weil dieser zweite Schritt
  vermutlich einen echten Filter mit Bedingung anlegt (mehr als der reine
  Struktur-Placeholder aus B2b) und der Rückweg dafür nicht vorab geprüft war.
- **CMS-Sortierung → Field-„Select…"-Liste** (welche der 8 Felder sortierbar
  sind) — ein Klick auf den Button registrierte keine sichtbare Öffnung im
  Folgeaufruf; nicht mit Gewissheit von „nicht geöffnet" zu unterscheiden.
- **Pagination-Popover-Inhalt** — nur der Kopf (`Add…`/`Add Pagination`)
  erfasst; das Popover selbst lag unterhalb des sichtbaren Panels, und ein
  Klick auf die berechnete Koordinate registrierte keine Änderung.
- **Masonry: Yes** — nicht geschaltet, würde das Grid-Layout der einzigen
  CMS-Liste der Seite auf ein Kachelraster umstellen; Rückweg (Klick auf `No`)
  zwar vermutlich einfach, aber nicht vorab bewiesen.
- **Advanced-Knopf im Grid-Layout** — geklickt, aber keine sichtbare
  Zustandsänderung im Folge-`karte:` messbar; ob er einen Modus umschaltet,
  der nur bei bestimmten Grid-Konfigurationen sichtbar wird, bleibt offen.
- **Mixed-Zustand bei Mehrfachauswahl** — mit dem verfügbaren Werkzeug nicht
  auslösbar: `klick:`/`klickauf:` unterstützen keinen Modifier (Shift), und
  `taste:` sendet nur eigenständige Tastenkombinationen, keine Halte-Taste
  parallel zu einem Mausklick. Eine echte Shift-Mehrfachauswahl im
  Layers-Panel ist damit eine Werkzeuggrenze, kein Rechercheversäumnis.
- **Tablet/Phone-Breakpoint und Override-Blau** — dieses Projekt hat nur
  „Desktop"; ein zweiter Breakpoint existiert nicht und wurde nicht angelegt
  (Klick auf „Breakpoint hinzufügen" wäre ein struktureller Eingriff mit
  unklarem Rückweg). Die Override-Blau-Farbe bei Tablet-spezifischen Werten
  bleibt daher für dieses Projekt ungeprüft.
- **Link-Kopfzeichen-Menü (`Rel`/`Parameters`/`Tracking`) bei gesetztem Link**
  — Struktur für den LEEREN Link bereits in STYLE-PANEL-ANALYSE erfasst; ob
  sich der Inhalt bei einem `mailto:`-Link ändert (z. B. `Rel` vorbelegt),
  nicht gegengeprüft.
- **„Ferienwohnung" (CMS-Vorlagenelement) im Detail** — nicht einzeln
  selektiert und durchgeklickt; aus Zeitgründen zugunsten der Content-Popover
  und des Fill-Popovers zurückgestellt.
- **Add-Breakpoint-Fluss, Create-Component, Create-Layout-Template** — alle
  strukturverändernd und ohne vorab bewiesenen Rückweg; bereits in
  `FRAMER-LAYERS-INSPEKTOR-ANALYSE.md` §H als nicht geprüft vermerkt, hier
  aus denselben Gründen erneut ausgelassen.

---

## Gesamttabelle aller in dieser Messung neu erfassten Inspektor-Funktionen

| Nr | Abschnitt | Feld/Funktion | Elementarten | Optionen | Beobachtung |
|---|---|---|---|---|---|
| 1 | Content | Source | CMS Collection List | `Ferienwohnungen` (einzige Collection im Projekt) | `<select>`, Pflichtfeld bei CMS |
| 2 | Content | State | CMS Collection List | `Default` / `Empty` | Segment, aktiv: Default |
| 3 | Content | Filters | CMS Collection List | `Add…` → Feldwähler | leer im Ruhezustand |
| 4 | Content | Filters-Popover | CMS Collection List | `Titel`/`Slug`/`Region`/`Kurzbeschreibung`/`Gäste`/`Bild`/`Created`/`Updated` | komplettes Collection-Schema, kein Dialogtitel, nur „Dismiss popup" |
| 5 | Content | Sorting | CMS Collection List | `Add…` → Order-Dialog | leer im Ruhezustand |
| 6 | Content | Order-Dialog | CMS Collection List | `Field: Select…` | eigener Dialogtitel „Order", X zum Schließen |
| 7 | Content | Sortier-Zwischenzustand | CMS Collection List | Icon `↓` + Text „Inactive" + `Remove` | entsteht sofort beim Öffnen des Order-Dialogs, vor Feldwahl |
| 8 | Content | Pagination | CMS Collection List | `Add…`/`Add Pagination` | Popover-Inhalt nicht erreicht |
| 9 | Size | Max Width | CMS Collection List | Zahl/% + `Relative`/`Fixed` | zusätzliche Zeile ggü. generischem Frame |
| 10 | Layout | Type | CMS Collection List (gefüllt) | `Stack` / `Grid` | hier `Grid`, im Gegensatz zu Stack-Elementen mit `Stack` |
| 11 | Layout | Masonry | CMS Collection List, Grid | `Yes` / `No` | Segment, hier `No` |
| 12 | Layout | Columns | CMS Collection List, Grid | Zahl + Decrease/Increase | `3` |
| 13 | Layout | Gap (Grid) | CMS Collection List, Grid | zwei `#gap-input`-Felder | `18`/`18`, getrennt für Spalte/Zeile |
| 14 | Layout | Padding + Advanced | CMS Collection List, Grid | Zahl + `Padding`/`Padding per side` + `#advancedLayout`-Knopf | Advanced-Knopf ohne messbaren Effekt |
| 15 | Styles | Fill-Popover Reiter | jedes Element mit Fill | Solid/Linear Gradient/Radial Gradient/Conic Gradient/**Image** | 5 Reiter, ein Reiter mehr als der Text-Farbpopover |
| 16 | Styles | Fill-Popover Format | jedes Element mit Fill | `RGB`/`HSL`/`HEX` | ohne `P3` (Unterschied zum Text-Farbpopover ungeklärt) |
| 17 | Styles | Fill-Popover „New Style" | jedes Element mit Fill | Knopf | legt vermutlich einen Fill-Stil an, nicht geklickt |
| 18 | Styles | Selection → Colors, Auto-Eintrag | jedes Element | — | neue Farbe wird automatisch ergänzt, sobald sie im Element vorkommt |
| 19 | Link | New Tab | Link/Button-Element mit gesetztem Link | `Yes` / `No` | erscheint nur bei gesetztem `Link To`, hier `Yes` |
| 20 | Link | Link To (gesetzt) | Kontakt-Button | `mailto:hallo@kues…` | echter Live-Wert, Kettenglied-Icon im Layers-Baum als Marker |
| 21 | Layers-Baum | Link-Icon 🔗 | Elemente mit gesetztem Link | — | Marker rechts vom Namen bei JEDEM verlinkten Kind |
| 22 | Layers-Baum | Komponenten-Farbe | alle | Grau/Blau/Weiß beobachtet, kein Lila | bestätigt: keine Komponenten-Instanz im Projekt |
| 23 | Panel-Infrastruktur | Scrollbarer Container | rechtes Panel gesamt | `scrollTop` direkt setzbar | kein virtualisiertes Rendern, anders als Listen |
| 24 | Agent | New-Chat-Klappliste | Agent-Reiter | öffnet nicht | blockiert durch „Out of credits", kein Bedienfehler |

24 Funktionen/Beobachtungen neu erfasst (zusätzlich zu den in den drei
Vorgänger-Dokumenten bereits stehenden).

---

## Unverändert-Beweis

- **Canvas-Elementzahl**: `document.querySelectorAll("[data-framer-name]").length`
  im Canvas-iframe → **45** zu Beginn, **45** nach jedem Zwischenstand, **45**
  am Ende der Messung (vier Kontrollmessungen über die gesamte Sitzung).
- **`taste:Meta+z` nötig**: **1×** — für den Fill-Schreibvorgang (`Add Fill`
  setzte sofort `FFFFFF`); danach Fill wieder `Add…` und Selection-Colors
  wieder auf den ursprünglichen 4 Einträgen (`F8F7F2`/`526259`/`19352C`/
  `718077`, ohne `FFFFFF`).
- **Dedizierter `Remove`-Knopf statt Meta+z**: **1×** — der Sortier-Eintrag
  („Order"-Dialog öffnen legt sofort einen `↓ Inactive`-Eintrag an) wurde über
  seinen eigenen `Remove`-Knopf entfernt und die Sorting-Zeile danach als
  „Add…" gegengelesen (zweite Textprobe nach dem ersten, noch stale Ergebnis,
  bestätigte den Klartext-Zustand).
- **Ohne Nachwirkung, keine Rücknahme nötig**: Klick auf `Add Filter`
  (öffnete nur den Feldwähler, schrieb nichts — Filters-Zeile blieb „Add…"),
  Klick auf `Advanced`-Layout-Knopf (keine messbare Zustandsänderung), Klick
  auf `New chat` im Agent-Reiter (öffnete keine Liste, keine Nebenwirkung).
- **Bildschirmfotos**: Ausgangszustand (`00-start.png`) und Endzustand
  (`41-final-proof.png`) zeigen denselben Layers-Baum (21 Blattknoten über
  alle Sektionen), dieselben sieben Homepage-Abschnitte im Canvas-Vorschaubild
  und keine neuen/fehlenden Bild- oder Textkacheln.

Pfad dieser Datei: `docs/FRAMER-STYLE-INSPEKTOR-ANALYSE.md`.
