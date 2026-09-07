# Framer-Editor — Canvas-Analyse (live vermessen)

Live vermessen am 05.09.2026 im Projekt „Adaptable Breakfast"
(`framer.com/projects/Adaptable-Breakfast--v2T65fa1QUvhPaNeMxtv-gMzjL`),
Seite `/ferienhaus-agentur`, Breakpoint „Desktop 1200". Werkzeug:
`scripts/diagnose/chrome-steuern.mjs` gegen den Debug-Chrome (Port 9222),
gemäß `.claude/skills/seite-auslesen/SKILL.md`. Es wurde **nichts** gespeichert,
veröffentlicht, gelöscht oder inhaltlich verändert — siehe Abschnitt H für den
Unverändert-Beweis.

Struktur A–H wie von der Skill-Datei vorgegeben.

---

## A Aufbau

Der Framer-Editor gliedert sich in vier feste Bereiche plus zwei schwebende
Werkzeugleisten:

| Bereich | Position/Größe (Vollbild, hier 2810×1478 CSS-Px, Zoom variabel) | Inhalt |
|---|---|---|
| Obere Werkzeugleiste | oben, volle Breite, ca. 50px hoch | Canvas-Menü-Knopf, Insert/Layout/Text/Vector-Werkzeuge, Projektname + Branch („main"), Konto-Avatar (AS), Preview-Knopf, Invite, Publish |
| Linkes Seitenpanel | links, ca. 355px breit, volle Höhe unter der Werkzeugleiste | Reiter Pages/Layers/Assets (im Normalzustand) bzw. das Insert-Panel (Elements/CMS), je nach Modus |
| Canvas (Arbeitsfläche) | Mitte, nimmt den Rest der Breite ein | Breakpoint-Rahmen mit Kopfzeile („Desktop 1200"), darunter die gerenderte Seite, grauer Leerraum drumherum |
| Rechtes Eigenschaften-Panel | rechts, ca. 355px breit, volle Höhe | Reiter „Agent" (KI-Chat) / „Style" (Eigenschaften des gewählten Elements) |
| Untere Canvas-Werkzeugleiste | unten mittig, schwebend über dem Canvas | Select, Pan, Comment, Theme (Tag/Nacht), Zoom-Prozentanzeige, „Upgrade Now"-Knopf (Free-Plan-Hinweis) |
| Breakpoint-Kopfzeile | direkt über dem Frame im Canvas | Play-Icon (Preview dieses Breakpoints), Name + Breite („Desktop 1200"), „+"-Knopf (Breakpoint hinzufügen) |

Der Canvas selbst ist ein unendliches, zoom- und pan-bares Feld (grauer
Hintergrund `#most likely neutral grey`, nicht exakt vermessen — siehe H); der
Breakpoint-Frame liegt darauf wie ein Blatt Papier mit gestricheltem
Auswahlrahmen, sobald er (mit-)ausgewählt ist.

---

## B Bedienelemente

### B.1 Obere Werkzeugleiste

| Element | Ort (px, Zoom 50%) | Kürzel | Wirkung |
|---|---|---|---|
| Canvas-Menü-Knopf („Canvas ⌄") | 57,25 | — | öffnet das Hauptmenü (siehe B.2) |
| Insert („+") | 129,25 | I | öffnet das Insert-Seitenpanel (Elements/CMS), siehe B.5 |
| Layout (Rechteck-Icon) | 164,25 | — | Werkzeug-Wahl: zeichnet einen neuen Layout-Container; zweiter Klick öffnet Insert→Layout-Auswahl (Frame F, Stack S, Grid ⇧G, Masonry ⇧M, Image ⇧I, Video ⇧V) |
| Text (T-Icon) | 199,25 | T | Werkzeug-Wahl: nächster Canvas-Klick erzeugt eine Textebene |
| Vector (Dreieck-Icon) | 233,25 | — | Werkzeug-Wahl: Vector-Zeichenmodus; zweiter Klick öffnet Formen-Auswahl (Rectangle R, Oval O, Polygon, Star, Path P) |
| Projektname „Adaptable Breakfast" | 673,25 | — | klickbar (Umbenennen/Projektinfo — nicht geöffnet, siehe H) |
| Branch-Knopf „main" | 769,25 | — | Branch-Auswahl (zugeklappt angetroffen, nicht geöffnet — siehe H) |
| Konto-Avatar „AS" | 1203,25 | — | Konto-Menü (nicht geöffnet — siehe H) |
| Preview (Play-Icon) | 1243,25 | ⌘P | öffnet die Live-Vorschau |
| Invite | 1295,25 | — | Team-Einladung (nicht geöffnet — siehe H) |
| Publish | 1363,25 | — | veröffentlicht das Projekt (NICHT geklickt) |

### B.2 Canvas-Hauptmenü (Klick auf „Canvas ⌄")

Oberste Ebene, mit Modus-Wahl und Menüleiste:

| Eintrag | Kürzel | Bemerkung |
|---|---|---|
| Canvas | ⌥1 | aktueller Modus (aktiv) |
| CMS | ⌥2 | Modus-Wechsel |
| Localization | ⌥3 | Modus-Wechsel |
| Analytics | ⌥4 | Modus-Wechsel |
| Settings | ⌥5 | Modus-Wechsel |
| Go to Dashboard | — | verlässt das Projekt |
| Quick Actions | ⌘K | Befehlspalette |
| File | ▸ | Untermenü (Inhalt nicht geöffnet — H) |
| Edit | ▸ | Untermenü (Inhalt nicht geöffnet — H) |
| View | ▸ | siehe B.2.1 |
| Tool | ▸ | siehe B.2.2 |
| Layout | ▸ | Untermenü (Inhalt nicht geöffnet — H) |
| Text | ▸ | Untermenü (Inhalt nicht geöffnet — H) |
| Vector | ▸ | Untermenü (Inhalt nicht geöffnet — H) |
| Component | ▸ | Untermenü (Inhalt nicht geöffnet — H) |
| Plugins | ▸ | siehe B.2.3 |
| Code | ▸ | Untermenü (Inhalt nicht geöffnet — H) |
| Preferences | ▸ | siehe B.2.4 |
| Help | ▸ | Untermenü (Inhalt nicht geöffnet — H) |
| Your Account | — | (nicht geöffnet — H) |

#### B.2.1 View (Untermenü)

| Eintrag | Kürzel |
|---|---|
| Open Preview | ⌘P |
| Appearance | ▸ (Untermenü, Inhalt trotz drei Versuchen nicht angezeigt — H) |
| Show Pages | ⌥⇧1 |
| Show Layers | ⌥⇧2 |
| Show Assets | ⌥⇧3 |
| Show Agent | A |
| Show Style | E |
| Show Interface | ⌘. (mit Häkchen aktiv angetroffen) |
| Show All Links | — |
| Show Handoff | — |
| Show Rulers | ⌃R |
| Show Guides | ⌃G |
| Show Pixel Grid | — |
| Zoom In | ⌘+ |
| Zoom Out | ⌘− |
| Zoom to 100% | ⌘0 |
| Zoom to Fit | ⌘1 |
| Zoom to Selection | ⌘2 (ausgegraut ohne Auswahl) |
| Collapse Layers | ⌥L |

#### B.2.2 Tool (Untermenü)

| Eintrag | Kürzel |
|---|---|
| Insert | I |
| Agent Select | ⌃A |
| Layout | ▸ (identisch mit Insert→Layout: Frame F, Stack S, Grid ⇧G, Masonry ⇧M, Image ⇧I, Video ⇧V — aus B.5 bestätigt, im Tool-Menü selbst nicht erneut geöffnet, siehe H) |
| Text | T |
| Link | L (ausgegraut ohne Auswahl eines linkfähigen Elements) |
| Scale | K |
| Vector | ▸ (Rectangle R, Oval O, Polygon, Star, Path P) |
| Zoom | Z |
| Comment | C |
| Cursor Chat | / |
| Sample Color | ⌃C (ausgegraut ohne Auswahl) |
| Library | ⌘/ |

#### B.2.3 Plugins (Untermenü)

| Eintrag | Kürzel |
|---|---|
| Browse All | — |
| Run Recent Plugin | ⌥⌘P |
| Clear Recent Plugins | — |
| Open Development Plugin | ⌥⌘L |
| Show Developer Tools | — |
| API Documentation | — |

#### B.2.4 Preferences (Untermenü)

Häkchen = aktiv angetroffen im Ausgangszustand des Projekts.

| Eintrag | Zustand |
|---|---|
| Animate on Zoom | ✓ aktiv |
| Auto-Draft Content | inaktiv |
| Auto-Layout Pinning | inaktiv (ausgegraut) |
| Auto-Switch to Layers Panel | inaktiv |
| Exit Canvas on Double Click | inaktiv |
| Fast Zoom | inaktiv |
| Keyboard Zooms to Selection | inaktiv |
| Off-Screen Content Hint | ✓ aktiv |
| Reverse Zoom Direction | inaktiv |
| Use Direct Selection | ✓ aktiv |
| Nudge Amount | Untermenü/Eingabe (Inhalt nicht geöffnet — H) |
| Performance Mode | Untermenü/Eingabe (Inhalt nicht geöffnet — H) |
| Reset Default Frame Fill | Aktion (ausgegraut, nicht ausgelöst) |

### B.3 Untere Canvas-Werkzeugleiste

Schwebende Leiste, unten mittig über dem Canvas.

| Element | Ort (px, Zoom 50%) | Kürzel | Wirkung |
|---|---|---|---|
| Select (Pfeil-Icon) | 552,704 | V (Framer-Standard, aus Kontext erschlossen — nicht im Menü bestätigt, siehe H) | Zeiger-/Auswahlmodus (Vorgabe) |
| Pan (Hand-Icon) | 587,704 | — | Verschiebemodus; Ziehen verschiebt den sichtbaren Ausschnitt |
| Comment (Sprechblase-Icon) | 622,704 | C | Kommentarmodus: Klick auf den Canvas würde einen Kommentar-Pin setzen (nicht ausgelöst) |
| Theme (Mond-Icon) | 657,704 | — | schaltet die Editor-Oberfläche zwischen hell/dunkel (nicht ausgelöst) |
| Zoom-Prozentanzeige „50%" | 702,704 | — | Klick öffnet das Zoom-Menü (siehe B.4); Zahl ist der aktuelle Zoomfaktor |
| Upgrade Now | 821,704 | — | Hinweis auf Plan-Limit („Out of credits" im KI-Agenten-Panel gleichzeitig beobachtet); führt zum Upgrade-Dialog (nicht geöffnet) |

### B.4 Zoom-Menü (Klick auf die Prozentanzeige)

| Eintrag | Kürzel |
|---|---|
| Zoom | Z (Werkzeug-Wahl) |
| Zoom In | ⌘+ |
| Zoom Out | ⌘− |
| Zoom to 100% | ⌘0 |
| Zoom to Fit | ⌘1 |
| Zoom to Selection | ⌘2 |
| Fast Zoom | (Umschalter, Zustand nicht klar ablesbar — H) |
| Nudge Amount | (Eingabe/Untermenü, Inhalt nicht geöffnet — H) |

Deckt sich inhaltlich mit dem Zoom-Teil des View-Menüs (B.2.1) — hier als
eigener, über die Canvas-Werkzeugleiste erreichbarer Zugang bestätigt.

### B.5 Insert-Panel (Klick auf „+" in der oberen Werkzeugleiste)

Öffnet ein volles linkes Seitenpanel (ersetzt Pages/Layers/Assets), mit
Suchfeld oben und zwei Gruppen:

**Elements** (jede Zeile mit „▸", Untermenü-Inhalt nur bei „Media" geöffnet):
- Icons ▸ (nicht geöffnet — H)
- Shaders ▸ (nicht geöffnet — H)
- Media ▸ — geöffnet, Inhalt: Image, Video, YouTube, MP3, GIF, Vimeo,
  Dot Lottie, Spotify, Apple Music, SoundCloud, Podcasts, Simplecast
  (als anklickbare Kacheln mit Vorschau-Icon dargestellt)
- Forms ▸ (nicht geöffnet — H)
- Interactive ▸ (nicht geöffnet — H)
- Social ▸ (nicht geöffnet — H)
- Utility ▸ (nicht geöffnet — H)
- Creative ▸ (nicht geöffnet — H)

**CMS**:
- Collections ▸ (nicht geöffnet — H)
- Fields ▸ (nicht geöffnet — H)

Insert-Werkzeug wird durch Klick auf „Select" in der unteren Werkzeugleiste
wieder verlassen, ohne dass ein Element eingefügt wird.

### B.6 Insert→Layout-Auswahl (zweiter Klick auf das Layout-Werkzeug oben)

| Eintrag | Kürzel | Icon |
|---|---|---|
| Frame | F | Rechteck |
| Stack | S | zwei Balken |
| Grid | ⇧G | Raster |
| Masonry | ⇧M | versetztes Raster |
| Image | ⇧I | Bild-Icon |
| Video | ⇧V | Play-Icon |

### B.7 Vector-Formen-Auswahl (zweiter Klick auf das Vector-Werkzeug oben)

| Eintrag | Kürzel | Icon |
|---|---|---|
| Rectangle | R | Quadrat |
| Oval | O | Kreis |
| Polygon | — | Sechseck |
| Star | — | Stern |
| Path | P | Punkt-Linie-Symbol |

### B.8 Rechtsklick-Kontextmenü auf einem Element

Getestet auf der Sektion „Einführung" und dem CMS-Element „Ferienwohnungen
Liste"; identischer Grundaufbau, einzelne Einträge (z. B. „Align") je nach
Elementtyp aktiv/ausgegraut:

| Eintrag | Kürzel | Bemerkung |
|---|---|---|
| Suchfeld „Type to search…" | — | filtert das Menü |
| Add To Agent | — | übergibt das Element an den KI-Agenten |
| Create Component | ⌥⌘K | — |
| Create Layout Template | — | — |
| Fit Content | ⇧A | passt die Größe an den Inhalt an |
| Select | ▸ | Untermenü, siehe B.8.1 |
| Align | ▸ | bei Root-nahen Elementen ausgegraut; Untermenü-Inhalt bei einem alignfähigen Element trotz drei Versuchen nicht angezeigt — H |
| Copy | ▸ | Untermenü (Inhalt nicht geöffnet — H) |
| Paste | ▸ | Untermenü (Inhalt nicht geöffnet — H) |
| Move | ▸ | Untermenü (Inhalt nicht geöffnet — H) |
| Duplicate | ⌘D | — |
| Delete | ⌫ | NICHT ausgelöst |
| Rename | ⌘R | — |
| Auto Rename | ⌥R | — |
| Lock | ⌘L | — |
| Hide | ⌘; | — |
| Overflow | ▸ | Untermenü (Inhalt nicht geöffnet — H) |
| Add Frame | ⌘↩ | fügt einen umschließenden Frame hinzu |
| Add Stack | ⌥⌘↩ | fügt einen umschließenden Stack hinzu |
| Remove Stack | ⌘⌫ | entfernt den umschließenden Stack |
| Set as Default Fill | — | nur bei Bild-/Farbelementen sichtbar |

#### B.8.1 Select (Untermenü im Kontextmenü)

| Eintrag | Kürzel |
|---|---|
| Top Parent | ⌘ESC |
| Parent | ESC (NICHT geklickt — Skill-Regel: nie Escape) |
| All | ⌘A |
| Siblings | ⇧⌘A |
| Children | — |
| Text Layers | — |
| Layers Using This Background | — |

### B.9 Rechtsklick auf leere Canvas-Fläche

**Befund:** Rechtsklick auf den grauen Bereich außerhalb des Breakpoint-Frames
öffnet **kein** Kontextmenü. Getestet bei 450,150 (deutlich links vom Frame) —
keine Reaktion, nur die vorherige Elementauswahl wurde aufgehoben.

### B.10 Rechtsklick auf den Breakpoint-Rahmen/-Kopf

Ein Rechtsklick im Bereich der Breakpoint-Kopfzeile („Desktop 1200") trifft in
der Praxis das oberste sichtbare Kind-Element an dieser Y-Position (hier die
Sektion „Einführung", da die Kopfzeile nur ca. 30px hoch ist und der
Klickpunkt leicht darunter lag) — Ergebnis ist dasselbe Kontextmenü wie B.8,
mit „Align" hier ausgegraut, da „Einführung" direktes Kind des Root-Desktop-
Frames ist. Ein eigenständiges „Breakpoint-Rahmen"-Kontextmenü (z. B. für
„Breakpoint löschen") wurde nicht gefunden — siehe H.

---

## C Daten (elementbezogene Eigenschaftsfelder im Style-Panel)

Beispielhaft am ausgewählten CMS-Element „Ferienwohnungen Liste" (Content Type
„Collection List") abgelesen:

| Feld | Typ | Pflicht/optional | Vorgabewert (angetroffen) |
|---|---|---|---|
| Link → Link To | Text/URL-Auswahl | optional | leer („Page or URL…") |
| Position → Type | Auswahlfeld | Pflicht | Relative |
| Size → Width | Zahl + Einheit-Auswahl | Pflicht | 1120, Fixed |
| Size → Height | Zahl (berechnet, ausgegraut) + Einheit | Pflicht | 438, Fit |
| Size → Max Width | Zahl/Prozent + Einheit-Auswahl | optional | 100%, Rel |
| Size → Min Max | Bereich | optional | leer („Add…") |
| Content → Source | Auswahlfeld (CMS-Collection) | Pflicht bei CMS-Element | „Ferienwohnungen" |
| Content → State | Umschalter | Pflicht | Default / Empty |
| Content → Filters | Liste | optional | leer („Add…") |
| Content → Sorting | Liste | optional | leer („Add…") |

Am generischen Frame/Bild-Element (z. B. „Einführung"-Sektion) zusätzlich
beobachtet:

| Feld | Typ | Vorgabewert |
|---|---|---|
| Styles → Opacity | Zahl 0–1 + Schieberegler | 1 |
| Styles → Visible | Ja/Nein-Umschalter | Yes |
| Styles → Fill | Farbfeld („Add…") | leer |
| Styles → Overflow | Auswahlfeld | Clip (weitere Optionen: Visible, Hidden, Scroll) |
| Styles → Radius | Zahl + zwei Radius-Modus-Knöpfe (einheitlich/pro Ecke) | 0 |
| Styles → Border | Farbfeld („Add…") | leer |
| Styles → Shadows | Liste („Add…") | leer |
| Transforms | Abschnitt, aufklappbar („+") | zugeklappt |
| Selection → Colors | Farbfelder aus dem Element (4 Swatches, „+1" für weitere) | z. B. `#526259`, `#19352C`, `#718077` (Hex, per `stil:`/Text abgelesen) |
| Scroll Section | Abschnitt, aufklappbar („+") | zugeklappt |
| Accessibility | Abschnitt, aufklappbar („+") | zugeklappt |
| Code Overrides | Abschnitt, aufklappbar („+") | zugeklappt |

Am Text-Element ohne Auswahl (Root-Style-Ansicht) zusätzlich:

| Feld | Typ | Vorgabewert |
|---|---|---|
| Typography → Base | Zahl + Einheit (PX) + Stepper | 16 PX |
| Template | Abschnitt, aufklappbar („+") | zugeklappt |

---

## D Abläufe

- **Werkzeugwechsel (Layout/Text/Vector, obere Leiste):** einfacher Klick
  wählt das Werkzeug (Cursor ändert Icon); der nächste Canvas-Klick/-Zug würde
  ein neues Element erzeugen. Zurück zu „Select" hebt den Modus auf, ohne
  etwas anzulegen, solange nicht auf den Canvas geklickt/gezogen wurde.
- **Zweiter Klick auf ein bereits aktives Werkzeug** (Layout, Vector) öffnet
  eine Unterauswahl konkreter Typen (siehe B.6/B.7), statt sofort zu zeichnen.
- **Insert („+")** öffnet ein Panel mit Katalog-Kacheln; ein Klick auf eine
  Kachel fügt das Element vermutlich beim nächsten Canvas-Klick ein (nicht
  ausgelöst, um das Projekt nicht zu verändern — siehe H).
- **Zoom:** ⌘0 (100%), ⌘1 (Fit — zoomt auf den ganzen Breakpoint-Inhalt),
  ⌘2 (Selection — zentriert und zoomt auf das aktuell gewählte Element,
  live geprüft: Zoom sprang von 50 % auf 108 % bei Auswahl eines Textelements).
  „Animate on Zoom" ist standardmäßig aktiv, d. h. Zoomschritte sind animiert.
- **Pan:** Hand-Werkzeug in der unteren Leiste; zusätzlich vermutlich per
  gehaltener Leertaste + Ziehen (Framer-Standard, hier nicht gesondert
  bestätigt — siehe H). Echtes Mausrad scrollt den Ausschnitt (vertikal
  bestätigt: `scrolle:` verschob die Ansicht von der Kopfzeile zur Sektion
  „Ausgewählte Orte").
- **Auswahl:** Einfacher Klick wählt das oberste passende Element an dieser
  Stelle (z. B. eine ganze Sektion oder ein CMS-Collection-Element); die
  Auswahl zeigt einen blauen Rahmen mit Eckgriffen (blaue Kreise) und bei
  CMS-Listen zusätzlich ein Namensschild-Tag oben links („🔄 Ferienwohnungen
  List") plus einen „+"-Knopf am unteren Rand zum Hinzufügen eines weiteren
  Listenelements.
- **Doppelklick** auf ein bereits ausgewähltes verschachteltes Element hat in
  der Stichprobe (CMS-Liste → Bild) NICHT tiefer in die Verschachtelung
  navigiert (gleiche Auswahl blieb bestehen) — abweichend von der in Figma
  üblichen "in die Gruppe hineinklicken"-Erwartung; nicht abschließend
  verifiziert, da nur ein Fall getestet — siehe H.
- **Rechtsklick auf ein Element** öffnet immer dasselbe Grundmenü (B.8), mit
  kontextabhängig aktiven/ausgegrauten Einträgen (z. B. „Align" nur bei
  Elementen mit auszurichtenden Geschwistern; „Set as Default Fill" nur bei
  Bild-/Farbelementen).
- **Rechtsklick auf leere Fläche** zeigt kein Menü — bestätigt in B.9.
- **Zurücksetzen der Auswahl:** Klick auf eine leere Canvas-Fläche hebt die
  aktuelle Auswahl auf und wechselt das rechte Panel auf die Root-/Seiten-
  Style-Ansicht (Typography/Template).
- **Fenster/Panel-Umschaltung:** „Style"/„Agent"-Reiter rechts oben wechseln
  zwischen Elementeigenschaften und dem in das Projekt eingebauten
  KI-Chat-Agenten (im Testkonto ohne verbleibendes Guthaben: „Out of
  credits").

---

## E Gestaltung

Gemessene Werte (Editor-Chrome, nicht die gerenderte Website selbst):

- **Hex-Farbwerte aus der „Selection → Colors"-Palette eines Frames:**
  `#526259` (gedecktes Grün), `#19352C` (dunkles Tannengrün), `#718077`
  (helleres Graugrün) — jeweils mit „100%"-Deckkraftangabe daneben; ein
  vierter Swatch war über „+1" zusammengefasst (Inhalt nicht extra
  aufgeklappt — H).
- **Typography → Base:** 16 PX als globale Basis-Schriftgröße der Seite
  (Root-Style-Ansicht ohne Elementauswahl).
- **Zoomstufen angetroffen:** 50 % (Ausgangszustand beim Sitzungsstart),
  16 % (Zoom to Fit auf die komplette Seite bei diesem Breakpoint), 100 %
  (Zoom to 100%), 108 % (Zoom to Selection auf ein Textelement).
- **Icon-/Werkzeuggrößen (obere Leiste):** einzelne Werkzeug-Buttons (Insert,
  Layout, Text, Vector) jeweils 30×30 px (Zoom 50 % der Bildschirmaufnahme,
  reale CSS-Px identisch, da die Werkzeugleiste zoomunabhängig ist).
- **Seitenpanel-Breite:** ca. 355 px links wie rechts (aus Bildschirmfoto-
  Geometrie abgeleitet, nicht per `stil:` auf ein CSS-Grid-Attribut
  zurückgeführt — siehe H).
- Weitere Farben (Canvas-Hintergrund grau, Frame-Auswahlrahmen blau,
  Kontextmenü weiß mit Schatten) wurden visuell beobachtet, aber nicht per
  `stil:` in exakte Hex-/RGB-Werte umgerechnet — siehe H.

---

## F Zustände

- **Ruhe:** Element ohne Hover/Auswahl zeigt keinen sichtbaren Rahmen im
  Canvas.
- **Hover:** In dieser Sitzung wurde kein separater Hover-Hervorhebungsrahmen
  (dünne graue/blaue Kontur beim bloßen Überfahren, vor einem Klick)
  gesondert isoliert dokumentiert — die Werkzeug-eigene rote „Zeiger auf"-
  Anzeige überlagerte den nativen Framer-Hover-Zustand in den Bildschirm-
  fotos. Als Canvas-Funktion (Hover-Hervorhebung existiert in Framer
  üblicherweise als dünner Rahmen vor dem Klick) nur aus dem Kontext
  erschlossen, nicht direkt fotografisch belegt — siehe H.
- **Auswahl (einfach):** blauer durchgezogener Rahmen mit vier/acht blauen
  Kreis-Griffen an Ecken/Kanten; bei CMS-Elementen zusätzlich ein blaues
  Namensschild-Tag mit Icon oberhalb des Elements und (bei Collection-
  Listen) ein „+"-Rundknopf am unteren Rahmenrand.
  Ein zusätzlicher **gestrichelter blauer Rahmen**, der über den sichtbaren
  Frame-Bereich hinausragt, wurde bei der CMS-Liste beobachtet (linker Rand
  bei x≈458 reichte über den linken Bildschirmrand hinaus) — vermutlich der
  volle Container-Umriss der Collection List, auch wenn nur ein Teil davon
  im aktuellen Zoom/Scroll sichtbar ist.
- **Auswahl (Parent/Root):** bei Auswahl des Root-Frames „Desktop" zeigt die
  Ebenenliste diesen fett/blau markiert; das Style-Panel wechselt auf globale
  Frame-Eigenschaften.
- **Leer (keine Auswahl):** rechtes Panel zeigt nur „Typography/Base/
  Template" (Root-Seiten-Defaults), keine Size/Position/Content-Abschnitte.
- **Fehler/Hinweis:** Der KI-Agent-Reiter zeigte durchgehend „Out of credits –
  Your workspace has used all of its available credits" mit „Upgrade"-Knopf
  — ein Plan-Limit-Hinweis, keine Canvas-Funktion im engeren Sinn, aber als
  Zustand der Oberfläche dokumentiert.
- **Ausgegraute Menüeinträge:** in Kontextmenüs konsistent für nicht
  anwendbare Aktionen genutzt (z. B. „Zoom to Selection" ohne Auswahl,
  „Link"/„Sample Color" im Tool-Menü ohne passendes Zielelement, „Align" bei
  Elementen ohne ausrichtbare Geschwister).

---

## G Für den Nachbau

- Die **Drei-Spalten-Aufteilung** (schmales Ebenen-/Seiten-Panel links,
  Canvas Mitte, schmales Eigenschaften-Panel rechts, je ca. 355 px) plus
  **schwebende Werkzeugleisten** (oben fix, unten mittig über dem Canvas) ist
  das prägende Strukturmerkmal und sollte 1:1 übernommen werden.
  Kernidee: die untere Leiste bündelt NUR Canvas-Navigation (Select, Pan,
  Comment, Theme, Zoom), alles Erzeugende (Insert, Layout, Text, Vector)
  sitzt oben.
- Das **Insert-Panel als Vollflächen-Ersatz** des linken Panels (statt eines
  Dropdowns) ist übernehmenswert: es erlaubt Suche + Kategorien + Vorschau-
  Kacheln in einem Zug, ohne den Canvas zu verdecken.
- Das **einheitliche Rechtsklick-Kontextmenü** mit Suchfeld an erster Stelle
  (statt einer reinen Liste) ist ein starkes Muster für viele Aktionen — hier
  übernehmenswert, wenn ein Editor viele kontextabhängige Aktionen anbietet.
- Die **Zoom-Logik** (drei feste Anker 100%/Fit/Selection statt nur
  In/Out) deckt die relevanten Fälle ab und sollte übernommen werden;
  „Animate on Zoom" als abschaltbare Präferenz ist ein sinnvoller Kompromiss
  zwischen Orientierung und Geschwindigkeit.
- **Nicht zwingend zu übernehmen:** dass Rechtsklick auf leere Fläche
  überhaupt nichts anbietet (kein „Paste hier", kein „Zoom to Fit" als
  Kontext-Kürzel) — das ist eine Lücke, kein Vorbild; ein eigener Nachbau
  könnte hier mehr bieten (z. B. „Einfügen", „Auf Bildschirm einpassen").
- **Ausgegraute statt versteckte Einträge** in Menüs (z. B. „Align" ohne
  Geschwister, „Zoom to Selection" ohne Auswahl) ist übernehmenswert:
  zeigt dem Nutzer die volle Aktionsfläche, auch wenn gerade nicht nutzbar.

---

## H Nicht geprüft

Vollständig, auch wenn die Liste lang ist — jeder Punkt mit Grund:

1. **View-Menü → „Appearance"-Untermenü:** Pfeil vorhanden, Inhalt trotz
   mehrerer Hover-/Klick-Versuche nicht angezeigt (Framer schließt das
   Untermenü zuverlässig innerhalb der Zeit zwischen zwei CDP-Aufrufen bzw.
   beim Bildschirmfoto-Trigger). Vermutlich Hell/Dunkel-Themawahl des
   Editors selbst.
2. **Canvas-Hauptmenü → File, Edit, Layout, Text, Vector, Component, Code,
   Help, Your Account:** Pfeile/Einträge gesehen, Untermenü-Inhalt nicht
   geöffnet — gleiches Zeitfenster-Problem wie oben; nach drei Versuchen
   (Hover mit 150–500 ms Pause in verschiedenen Kombinationen) aufgegeben,
   um die Sitzung nicht unnötig zu verlängern und das Risiko ungewollter
   Klicks in Edit/Component (potenziell verändernde Aktionen) zu vermeiden.
3. **Tool-Menü → Layout- und Vector-Untermenü aus dem Menü selbst:** aus dem
   Menü heraus nicht erneut geöffnet (Hover-Kette brach ab); inhaltlich aber
   über den identischen Weg der oberen Werkzeugleiste (B.6/B.7) bestätigt,
   da beide vermutlich denselben Optionssatz zeigen.
4. **Kontextmenü → Align/Copy/Paste/Move/Overflow-Untermenüs:** Pfeile
   vorhanden, Inhalt trotz drei Versuchen (Hover auf verschiedene Y-
   Koordinaten, mit/ohne Zwischenpause) nicht sichtbar geworden — Framer
   scheint diese Untermenüs nur bei einer bestimmten, hier nicht getroffenen
   Mausbewegungsdynamik zu öffnen (reines `Input.dispatchMouseEvent`-Hover
   ohne Zwischenbewegung reicht offenbar nicht immer).
5. **Preferences → Nudge Amount, Performance Mode:** als Zeilen gesehen,
   vermutlich mit eigenem Eingabefeld/Untermenü, nicht geöffnet (drohte,
   einen Zahlenwert zu verändern, ohne dass der Rückweg vorher klar war —
   in Zweifelsfällen nicht riskiert).
6. **Zoom-Menü → „Fast Zoom"-Zustand:** Umschalter gesehen, aktueller
   Ein/Aus-Zustand nicht eindeutig aus dem Text ablesbar (kein Häkchen-
   Symbol im Rohtext erfasst).
7. **Insert-Panel → Icons, Shaders, Forms, Interactive, Social, Utility,
   Creative, Collections, Fields:** Kategorie-Zeilen gesehen (aus dem
   Grundpanel), nur „Media" tatsächlich aufgeklappt; die übrigen acht
   Kategorien wurden aus Zeitgründen und weil das Grundmuster (Kachel-Katalog
   mit Suchfeld) bereits belegt ist, nicht einzeln geöffnet.
8. **Projektname- und Branch-Knopf (obere Leiste):** als klickbare Elemente
   identifiziert (`karte:`), nicht geöffnet — vermutete Funktionen
   (Umbenennen, Branch-Wechsel/-Verwaltung) nicht verifiziert.
9. **Konto-Avatar „AS" (obere Leiste):** nicht geöffnet — vermutetes
   Konto-/Abmelde-Menü nicht verifiziert.
10. **Invite-Dialog:** nicht geöffnet, da er potenziell echte
    Team-Einladungs-Formulare mit E-Mail-Versand enthalten könnte (Risiko
    einer versehentlichen Aktion an einem Live-Projekt).
11. **Publish-Dialog:** absichtlich NICHT geöffnet/geklickt — echte
    Veröffentlichung des Live-Projekts, explizit verboten.
12. **Comment-Modus (Klick auf das Sprechblasen-Icon unten):** nicht
    ausgelöst, weil ein Klick auf den Canvas in diesem Modus einen echten
    Kommentar-Pin im Projekt anlegen würde (schreibende Aktion ohne
    unmittelbaren, geprüften Rückweg — Regel „Rückweg zuerst beweisen").
13. **Theme-Umschalter (Mond-Icon unten):** nicht geklickt — schaltet
    vermutlich nur die Editor-Oberfläche (hell/dunkel) um, birgt aber
    unklares Rückwirkungsrisiko auf laufende Messungen/Screenshots und wurde
    daher ausgelassen.
14. **Pan per gehaltener Leertaste + Ziehen:** nicht gesondert getestet
    (nur das Pan-Werkzeug in der unteren Leiste angeklickt); die
    Leertasten-Variante ist Framer-Standardverhalten, hier aber nicht
    live bestätigt.
15. **Abstands-/Ausrichtungshilfslinien beim Ziehen, Snapping, Distanzanzeige
    bei gedrückter Alt/Option:** NICHT geprüft — jede Prüfung hätte
    tatsächliches Ziehen/Verschieben eines echten Elements erfordert, was
    laut Auftrag nur mit sofortigem Meta+Z-Rückgängigmachen erlaubt gewesen
    wäre; angesichts der Fülle bereits gefundener, risikofreier Funktionen
    wurde dieses Restrisiko nicht eingegangen.
16. **Lineale (Rulers) und Raster (Pixel Grid) im sichtbaren Zustand:** die
    Menüpunkte „Show Rulers"/„Show Pixel Grid" wurden im View-Menü
    dokumentiert, aber nicht angeklickt, um den optischen Ausgangszustand
    des Canvas (für die Vergleichs-Screenshots) nicht zu verändern.
17. **Komponenten-Instanz-Markierung (lila Rahmen):** in dieser Seite wurde
    keine Component-Instanz gefunden/ausgewählt (die Seite nutzt Frames,
    Stacks, Text und eine CMS-Collection-Liste, aber keine erkennbare
    Framer-Component-Instanz) — daher nicht fotografisch belegt.
18. **Inline-Textbearbeitung per Doppelklick:** nicht getestet, weil ein
    Doppelklick in ein Textelement direkt in den Bearbeitungsmodus
    (blinkender Cursor) wechselt und ein versehentlicher Tastendruck sofort
    echten Seiteninhalt verändert hätte („nie etwas tippen in Textebenen").
19. **Bild ersetzen per Drop:** nicht getestet — echtes Datei-Drag&Drop lässt
    sich mit dem Werkzeug (Klick-/Tastatur-Aktionen) nicht risikofrei
    simulieren und hätte ein reales Bild ersetzt.
20. **Tastenkürzel-Übersicht über ein „?"-Menü:** kein eigenes „?"-Icon in der
    Werkzeugleiste gefunden; „Help" im Canvas-Hauptmenü wurde nicht geöffnet
    (siehe Punkt 2), könnte eine solche Übersicht enthalten.
21. **Exakte Hex-/RGB-Werte für Canvas-Hintergrund, Auswahlrahmen-Blau,
    Kontextmenü-Weiß/Schatten:** visuell klar erkennbar, aber nicht per
    `stil:` auf ein konkretes DOM-Element zurückgeführt, da die betroffenen
    Flächen im Framer-eigenen Editor-Chrome liegen (nicht im vom Nutzer
    gestalteten Seiteninhalt) und die Selektoren dafür nicht ermittelt
    wurden.
22. **Ein direkter Beweis für Snapping/Ausrichtungslinien beim Verschieben
    eines Elements** fehlt aus denselben Gründen wie Punkt 15.
23. Mehrere `hover:`-Sequenzen auf Untermenüs schlugen wiederholt fehl, weil
    Framers Menü-Overlay offenbar ein knappes Zeitfenster hat, das zwischen
    zwei getrennten CDP-Kommandoaufrufen (mit jeweils eigenem Roundtrip)
    regelmäßig verstrich, bevor der nächste Hover ankam — dies ist eine
    Eigenschaft des Zusammenspiels Werkzeug/Framer-UI, kein inhaltlicher
    Fund, wird hier aber transparent gemacht, weil es die Vollständigkeit
    einzelner Untermenüs einschränkt (Punkte 1–4).

---

## Unverändert-Beweis

- Elementanzahl im Canvas-iframe (`document.querySelectorAll('[data-framer-name]').length`)
  vor Beginn der Interaktion: **45**. Nach Abschluss aller Interaktionen
  (nach Werkzeugwechseln, Menü-Öffnungen, Zoom-Änderungen, Scroll, Element-
  Auswahl): erneut **45** — keine Veränderung.
- Der Ebenenbaum im linken Panel zeigt am Ende exakt dieselben Top-Level-
  Sektionen in derselben Reihenfolge wie beim allerersten Bildschirmfoto:
  Navigation → Einführung → Ausgewählte Ferienwohnungen → Service für
  Eigentümer → Ablauf → Kontaktabschluss → Fußzeile.
- Der sichtbare Seiteninhalt (Texte, Bilder, Reihenfolge der Sektionen) ist
  im letzten Zoom-to-Fit-Bildschirmfoto identisch mit dem allerersten
  Bildschirmfoto.
- Es wurde **kein** `taste:Meta+z` benötigt, weil zu keinem Zeitpunkt ein
  neues Element angelegt, ein bestehendes gelöscht/verschoben oder ein
  Wert verändert wurde — alle potenziell schreibenden Klicks (Publish,
  Invite, Comment-Pin-Setzen, Theme-Umschalten, Delete, Insert-Kachel-Klick,
  Ziehen/Verschieben) wurden bewusst ausgelassen (siehe Abschnitt H).
- Werkzeug-Wechsel (Select→Layout→Text→Vector→Select, Select→Pan→Select)
  verändern laut Beobachtung nur den Cursor-Modus, nicht den Projektinhalt,
  solange nicht zusätzlich auf den Canvas gezeichnet/geklickt wird — dies
  wurde in jedem Fall vor einem Canvas-Klick wieder auf „Select"
  zurückgesetzt.

**Ergebnis: Das Projekt „Adaptable Breakfast" ist nach dieser Analyse-Sitzung
unverändert.**
