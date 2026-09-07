# Framer-Editor — Designsystem, Variablen, Breakpoints, Hilfslinien, Medien, Code (Recherche 05.09.2026)

Auftrag: vollständige Recherche der Framer-Editor-Funktionen (framer.com) in den
Bereichen Designsystem/Variablen, Breakpoints, Layout-Hilfen, Medien und Code —
ausschließlich Web-Recherche (WebSearch/WebFetch gegen framer.com/help,
framer.com/developers, framer.com/updates, framer.com/academy sowie
Sekundärquellen dort, wo Framer selbst keine dedizierte Hilfeseite führt).
Kontext (nur gelesen, nicht abgeschrieben): `docs/FRAMER-CANVAS-FUNKTIONEN.md`
§1/§4/§6, `docs/FRAMER-STYLE-INSPEKTOR-FUNKTIONEN.md` §0.7–0.9/§9/§13–§14 — dort
sind Color-/Text-Styles, Effects, Breakpoint-Kaskade und Komponenten/Variablen
bereits gegen den LIVE-Editor vermessen (Spalte „Wir"); diese Datei ergänzt sie
um die von Framer selbst dokumentierten Funktionsdetails, ohne die Live-Messung
zu wiederholen.

Nummernpräfixe: **D** = Designsystem (Styles/Variablen), **B** = Breakpoints,
**L** = Layout-Grid/Guides/Rulers, **M** = Medien (Bild/Video/SVG/Icons/Effekte),
**CO** = Code (Components/Overrides/Fetch/Custom Code/Embeds/Motion/Dev-Tools),
**F** = Figma-/HTML-Import, **A** = Accessibility, **P** = Performance.

---

## D — Designsystem: Color Styles, Text Styles, Variables

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| D1.1 | Color Style anlegen | Assets-Panel (linke Seitenleiste) → Styles-Sektion → „+" → Farbe | framer.com/help/articles/how-to-use-text-styles/, framer.com/help/articles/light-and-dark-mode-options/ | Erzeugt eine benannte, wiederverwendbare Farbe; Farben intern als RGBA gespeichert (z. B. `rgba(242, 59, 57, 1)`) — Alpha ist damit nativer Bestandteil jedes Farbwerts, kein Extra-Feld |
| D1.2 | Color Style benennen | Assets-Panel, Stilname-Feld | framer.com/help/articles/light-and-dark-mode-options/ | Freitext-Name je Stil |
| D1.3 | Color Style in Ordner ablegen | Assets-Panel, Namensfeld beim Anlegen/Umbenennen | framer.com/dictionary (Suche „color styles folder"), community-bestätigt | Ordner entstehen implizit über „/" als Trenner im Namen, z. B. `Brand/Primary` → legt Ordner „Brand" mit Stil „Primary" an; kein eigener „Neuer Ordner"-Knopf |
| D1.4 | Light/Dark-Variante je Color Style | Assets-Panel → Style öffnen → Light-Wert (Pflicht) + Dark-Wert (optional) | framer.com/help/articles/light-and-dark-mode-options/, framer.com/updates/light-and-dark-mode | Jeder Color Style trägt einen Light- und optional einen Dark-Wert; beim Umschalten des Site-Farbmodus wechseln alle Verwendungen automatisch |
| D1.5 | Dark-Variante entfernen | Assets-Panel → Style → „…" (Drei-Punkte-Menü) → „Remove Dark Style" | framer.com/help/articles/light-and-dark-mode-options/ | Setzt den Stil auf reinen Light-Modus zurück; Elemente, die den Dark-Wert nutzten, fallen auf Light zurück |
| D1.6 | Color Style überall anwenden | Fill-/Text-Color-Popover jedes Elements → Reiter „Styles" mit Suche | framer.com/developers/styles, Live-Messung Style-Inspektor §9.3 | Ein Style wird an Fill, Border, Text-Color, Schatten-Farbe etc. gleichermaßen gebunden; Änderung am Style aktualisiert alle Verwendungen sofort |
| D1.7 | Color Style umbenennen/duplizieren/löschen | Assets-Panel → Style → Kontextmenü | framer.com/help/articles/light-and-dark-mode-options/ | Umbenennen ändert nur die Anzeige, keine Verweise brechen; Löschen wirkt auf ALLE Verwendungsstellen (die betroffenen Elemente fallen auf einen festen Hex-Wert zurück statt auf den Stil zu verweisen) |
| D1.8 | Fill/Farbwert zu Style konvertieren („New Style") | Fill-Popover → „New Style" | framer.com/academy/lessons/framer-fundamentals-styles (Kursbeschreibung, Inhalt selbst nicht zugänglich) | Aus einem beliebig gesetzten Farbwert direkt einen wiederverwendbaren Style erzeugen, ohne zuerst ins Assets-Panel zu wechseln |
| D2.1 | Text Style anlegen | Assets-Panel → Styles → „+" → „Text" → Überschriftenebene/Absatz wählen | framer.com/help/articles/how-to-use-text-styles/ | Neuer Stil sofort projektweit verfügbar |
| D2.2 | Text Style anwenden | Textebene wählen (oder Teiltext markieren) → rechtes Panel „Text → Styles" | framer.com/help/articles/how-to-use-text-styles/ | Mehrere Styles auch innerhalb EINES Textelements kombinierbar (z. B. fett hervorgehobenes Wort mit eigenem Stil); Entfernen über „×" neben dem angewandten Stil |
| D2.3 | Text Style verwalten | Assets → Styles: anlegen/bearbeiten/umbenennen/löschen | framer.com/help/articles/how-to-use-text-styles/ | Änderungen wirken automatisch überall, wo der Stil verwendet wird |
| D2.4 | Text Style je Breakpoint | Style öffnen → „Edit Style" → Sektion „Breakpoints" → „Add Breakpoint" | framer.com/help/articles/how-to-use-text-styles/, framer.com/help/articles/why-aren-t-my-text-style-breakpoints-working-in-components/ | Eigene Werte für Desktop (L)/Tablet (M)/Mobil (S): Schriftgröße, Zeilenhöhe, Laufweite, Absatzabstand; Einschränkung: Text-Style-Breakpoints funktionieren nicht zuverlässig INNERHALB von Components (eigener Hilfe-Artikel zum Fehlerbild) |
| D2.5 | Link-Zustände im Text Style | Text Style → Link-Optionen | framer.com/academy/lessons/framer-fundamentals-styles | Hover/Active/Current-Zustände für Links separat stylebar |
| D2.6 | Farbe punktuell überschreiben | Textebene → Color-Feld | framer.com/help/articles/how-to-use-text-styles/ | Einzelne Textfarbe ändern, ohne einen neuen Style zu erzeugen (bricht die Style-Bindung für dieses Attribut) |
| D3.1 | Variable anlegen | An jeder Eigenschaft: „+" (⊕) → „Create Variable" | framer.com/dictionary/variable, Live-Messung Style-Inspektor §14.2 | Typ (Color/Number/Text/Boolean), Name, Default-Wert; Variable wird zentral im Projekt gespeichert und an beliebiger Stelle referenzierbar |
| D3.2 | Color-Variable | Variablen-Dialog, Typ „Color" | framer.com/dictionary/variable | Steuert Hintergrund-, Text-, Rahmenfarbe usw.; verhält sich wie ein Color Style, ist aber als Variable in Bedingungen/Komponenten einsetzbar |
| D3.3 | Number-Variable | Variablen-Dialog, Typ „Number" | framer.com/dictionary/variable | Für Abstände, Radien, Größen, Prozentwerte |
| D3.4 | Text/String-Variable | Variablen-Dialog, Typ „Text" | framer.com/dictionary/variable | Für Labels, Titel, Beschreibungen; überall im Projekt referenzierbar |
| D3.5 | Boolean-Variable | Variablen-Dialog, Typ „Boolean" | framer.com/dictionary/variable | Schaltet Sichtbarkeit/Feature-Flags |
| D3.6 | Variable an Eigenschaft binden | Eigenschaftsfeld → „+" an der jeweiligen Property | framer.com/dictionary/variable, launchnow.design (Sekundärquelle, Praxisbeschreibung) | Statt eines festen Werts wird die Variable eingesetzt; ändert sich die Variable, aktualisieren sich alle gebundenen Vorkommen gleichzeitig |
| D3.7 | Komponentenvariable (Component Property) | Component-Instanz → Eigenschaftenfeld im rechten Panel | framer.com/developers/property-controls, framer.com/academy/lessons/framer-fundamentals-components | Je Instanz individuell überschreibbarer Wert (Text/Number/Boolean/Color/Enum/Image/Link/Date/File/Event/Instance/Array/Object …), definiert für die Komponente, pro Instanz gesetzt |
| D3.8 | Variable exponieren („Create Variable" an Textebene in Komponente) | Innerhalb einer Komponente: Textebene → Content-Property → „+" | framer.community (Praxisbeschreibung, mit offizieller Konzept-Deckung durch developers/property-controls) | Macht ein einzelnes Feld einer Komponente je Instanz änderbar, ohne die übrige Struktur/Styles zu duplizieren |
| D3.9 | Bedingte Farb-/Zahl-Transforms an Variablen | Variablen-Dialog, Conditionals | Live-Messung Style-Inspektor §14.2 (referenziert Doku 18.18) | Werte abhängig von Zustand/Bedingung ableiten (z. B. Farbe je nach Boolean) |

---

## B — Breakpoints

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| B1.1 | Standard-Breakpoints Desktop/Tablet/Phone | Fläche, nebeneinander liegende Rahmen | goodspeed.studio (Sekundärquelle, mit Live-Messung Canvas §6.1 gedeckt), allaboutframer.com | Desktop ab 1200 px, Tablet 810–1199 px, Mobil 390–809 px (Standardwerte; Marketplace-Vorlagen brechen oft zusätzlich bei 320/768/1024/1200/1920 px) |
| B1.2 | Breakpoint-Kopfzeile | Fläche, Kopf über jedem Breakpoint-Rahmen | Live-Messung Canvas §6.1 | Play-Symbol (Preview), Name + Breite, „+" für neuen Breakpoint |
| B2.1 | Eigenen Breakpoint anlegen | Breakpoint-Leiste → „+" | framer.com/marketplace/tutorials/framer-breakpoints/, sebadam.supply | Beliebige Pixel-Breite definierbar; Framer aktiviert das zugehörige Layout, sobald die Fensterbreite in den definierten Bereich fällt |
| B2.2 | Breite eines Breakpoints ändern | Breakpoint-Rahmen, Breite ziehbar bzw. Zahl editierbar | Live-Messung Canvas §6.1 | Breite direkt auf der Fläche durch Ziehen oder im Kopf als Zahl anpassbar |
| B2.3 | Reihenfolge der Breakpoints | Fläche, Anordnung nebeneinander (breit → schmal) | Live-Messung Canvas §6.1 | Reihenfolge spiegelt die Kaskade: größere Breakpoints stehen links/vorn, kleinere folgen |
| B3.1 | Primary Breakpoint | Desktop-Breakpoint (Standard) | goodspeed.studio, Live-Messung Style-Inspektor §0.7–0.9 (referenziert Doku 21–24) | Der Primary Breakpoint ist die Quelle aller Werte; Änderungen dort werden von allen anderen Breakpoints geerbt, sofern dort kein Override gesetzt ist |
| B3.2 | Kaskade/Vererbung | Kleinere Breakpoints erben vom Primary | framer.com/marketplace/tutorials/framer-breakpoints/, sebadam.supply | Framer arbeitet „Desktop-first": Änderungen an einem kleineren Breakpoint wirken NUR auf diesen und schmälere — sie kaskadieren nicht nach oben zu größeren Breakpoints |
| B3.3 | Override-Kennzeichnung | Rechtes Eigenschaften-Panel, überschriebener Wert | sebadam.supply, goodspeed.studio | Ein Wert, der vom geerbten Primary-Wert abweicht, wird BLAU hervorgehoben |
| B3.4 | Override zurücksetzen | Blauen Wert anklicken → „Reset Override" | sebadam.supply | Setzt die Eigenschaft auf den geerbten (Primary-)Wert zurück; entfernt den Breakpoint-spezifischen Override vollständig |
| B4.1 | Breakpoint-Preview bei zu schmalem Fenster | Preview-Modus | Live-Messung Canvas §6.4 (referenziert Doku 25–26) | Die Live-Vorschau deaktiviert bestimmte Breakpoint-Wechsel, wenn das Editor-Fenster selbst zu schmal ist, um sie korrekt zu simulieren |
| B5.1 | Text-Style-Breakpoints in Komponenten | Text-Style-Editor innerhalb einer Component | framer.com/help/articles/why-aren-t-my-text-style-breakpoints-working-in-components/ | Eigener Fehlerbild-Artikel: Text-Style-Breakpoints greifen innerhalb von Components nicht zuverlässig — von Framer selbst als bekannte Einschränkung dokumentiert |
| B6.1 | Breakpoint löschen | Breakpoint-Kopf → Kontextmenü/Entfernen | Live-Messung Canvas §6 (kein dedizierter Hilfe-Artikel gefunden) | Entfernt den Breakpoint-Rahmen; darin gesetzte Overrides gehen verloren, das Layout fällt auf den nächstgrößeren/Primary-Breakpoint zurück (Verhalten aus der Kaskadenlogik B3.2 abgeleitet, nicht wörtlich in einer Hilfeseite belegt) |

---

## L — Layout Grid, Guides, Rulers, Snapping

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| L1.1 | Layout Grid hinzufügen | Rechtes Panel, Breakpoint/Frame gewählt → Grid-Sektion | framer.com/help/articles/layout-grids/ | Spalten- ODER Reihen-Raster wählbar |
| L1.2 | Grid-Parameter | Grid-Sektion | framer.com/help/articles/layout-grids/ | Spaltenanzahl/Reihen, Abstand (Gap) zwischen den Elementen, Außenabstand (Margin) um das Grid, Gesamtbreite des Grids |
| L1.3 | Grid je Breakpoint eigenständig | Grid-Sektion, pro Breakpoint | framer.com/help/articles/layout-grids/ | Jeder Breakpoint kann eigene Grid-Typ-, Gap-, Margin- und Breitenwerte tragen — kein globales Grid für alle Breakpoints |
| L1.4 | Grid nur Design-Hilfe | — | framer.com/help/articles/layout-grids/ | Layout Grids sind reine Editor-Hilfslinien; sie erscheinen NICHT auf der veröffentlichten Seite |
| L2.1 | Hilfslinien einblenden | Framer-Logo (oben links) → Menü „View" → „Show Guides" | framer.com/help/articles/layout-grids/ | Hilfslinien sind nur sichtbar, wenn zuvor ein Breakpoint ausgewählt wurde; ohne Auswahl erscheint die Option gar nicht |
| L3.1 | Snapping (Ausrichtung an Kanten/Mitte anderer Elemente) | Fläche, beim Ziehen/Skalieren | framer.community (Nutzer-Threads „Grid Snapping" / „Rulers"), Live-Messung Canvas §3 | Automatisches Einrasten an Kanten, Mittelpunkten und Abständen benachbarter Elemente beim Verschieben/Skalieren |
| L3.2 | Smart Guides mit Shift/Option | Fläche, während Drag-Operation | framer.com/help/articles/layout-grids/ (Kontext „Smart Guides"), Sekundärbelege community | Shift bzw. Option/⌥ während des Ziehens hält Ausrichtung bzw. zeigt zusätzliche Abstandsmaße zu Nachbarelementen an |
| L3.3 | Snap-to-Grid umschaltbar | Grid-Einstellung, Ein/Aus | framer.community („Need Help Turning Off Grid Snapping") | Snap-to-Grid ist als eigener Schalter unabhängig vom generellen Smart-Guide-Snapping abschaltbar (aus Nutzer-Support-Threads, kein eigener Hilfe-Artikel mit Schrittfolge gefunden) |
| L3.4 | Abstandsmaße mit ⌥ (Option) | Fläche, ⌥ gedrückt halten über einem Nachbarelement | Live-Messung Canvas §3 (Kürzelbeleg), framer.com/shortcuts (Kürzelquelle) | Zeigt den Pixelabstand zwischen zwei Elementen an, wenn ⌥ gehalten und über das Nachbarelement gefahren wird |
| L4.1 | Rulers (Lineale) | Fläche, Ränder | framer.community („Rulers"-Thread) | Nutzer-Support-Thread referenziert Lineale am Flächenrand; keine dedizierte offizielle Hilfeseite mit Details gefunden — als Einschränkung vermerkt |

---

## M — Medien: Bilder, Video, SVG, Icons, Effekte auf Medien

### M1 — Bilder

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| M1.1 | Unterstützte Upload-Formate | Insert/Mediathek | framer.com/help/articles/how-are-images-optimized-in-framer/ | JPEG, PNG, WebP, GIF (automatisch optimiert); SVG wird als Bild-Füllung hochgeladen |
| M1.2 | Automatische Größenvarianten | Server-seitig bei Upload | framer.com/help/articles/how-are-images-optimized-in-framer/ | Framer erzeugt Varianten bis maximal 512/1024/2048/4096 px (bezogen auf die längste Bildseite); kein Upscaling — ist das Original kleiner als die Zielgröße, wird das Original verwendet |
| M1.3 | Automatische Formatkonvertierung (WebP/AVIF) | Server-seitig | framer.com/help/articles/how-are-images-optimized-in-framer/ | Die meisten Formate werden verlustbehaftet zu AVIF (Qualität 80) konvertiert; Ausnahmen: „Auto (Lossless)" → verlustfreies WebP, animierte Bilder → verlustbehaftetes WebP, erster Request → WebP (Qualität 90) während AVIF im Hintergrund verarbeitet wird; ist die optimierte Datei größer als das Original, wird das Original ausgeliefert |
| M1.4 | Browser-abhängige Auslieferung | Auslieferung über `srcset`/`sizes` | framer.com/help/articles/how-are-images-optimized-in-framer/ | Reihenfolge: AVIF → WebP → neu komprimiertes Original, je nach Browser-Unterstützung |
| M1.5 | Resolution-Einstellung | Fill → Bild-Eigenschaften → Dropdown „Resolution" | framer.com/help/articles/how-are-images-optimized-in-framer/, framer.com/help/articles/site-optimization/ | Auto (Browser wählt passende Größe) · Small · Medium · Large · Full (erzwingt bestimmte Variante) |
| M1.6 | Lazy Loading | Automatisch | framer.com/help/articles/how-are-images-optimized-in-framer/ | Bilder unterhalb von ca. 1000 px Seitenposition erhalten automatisch `loading="lazy"` |
| M1.7 | Alt-Text | Accessibility-Panel am Bildelement | framer.com/help/articles/guide-to-web-accessibility-in-framer/ | Freitextfeld für Bildbeschreibung; hilft Suchmaschinen, Screenreadern und wird als Fallback bei Ladefehler angezeigt |
| M1.8 | SVG-Optimierung | Automatisch bei Upload | framer.com/help/articles/how-are-images-optimized-in-framer/ | SVGs werden per SVGO optimiert und als natives `<svg>`-Element auf der veröffentlichten Seite gerendert (kein `<img>`) |
| M1.9 | SVG einfügen | Drag auf die Fläche oder Einfügen per ⌘V/Ctrl+V | framer.com/help/articles/how-to-add-icons/ | SVG-Datei direkt auf die Fläche ziehen ODER SVG-Code in die Zwischenablage kopieren und in Framer einfügen; wird danach wie jedes andere Element positionierbar/stylebar |
| M1.10 | Fit-Modi (Fill/Fit/Stretch/Tile) | Style-Popover, Bild-Reiter | Live-Messung Style-Inspektor §9.4 (referenziert Doku 8.3/8.6) | Bildfüllungsmodi Fill/Fit/Stretch/Tile, dazu 8 Pattern-Presets für Kachelfüllungen |
| M1.11 | Crop | Bild-Element, Doppelklick/Crop-Werkzeug | Live-Messung Canvas §4.10 (referenziert Doku 52–54) | Bildausschnitt direkt am Element beschneidbar |
| M1.12 | Troubleshooting Bildqualität | Fill → Resolution prüfen | framer.com/help/articles/how-are-images-optimized-in-framer/ | Bei Qualitätsproblemen: Originalauflösung prüfen, „Auto (Lossless)" versuchen, erneut veröffentlichen |

### M2 — Video

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| M2.1 | Empfohlenes Format | Upload | framer.com/help/articles/how-are-videos-optimized-in-framer/ | H.264-Codec mit Dateiendung „.mp4" für breite Browser-Unterstützung empfohlen |
| M2.2 | Keine automatische Optimierung | Server-seitig | framer.com/help/articles/how-are-videos-optimized-in-framer/ | Videos werden UNVERÄNDERT ausgeliefert — ein 4K-Video wird auch auf kleinen Bildschirmen in voller Auflösung gestreamt; Framer optimiert (anders als bei Bildern) nicht selbst |
| M2.3 | Empfohlene Dateigröße für Loops | Vorbereitung vor Upload | framer.com/help/articles/how-are-videos-optimized-in-framer/ | Loop-Videos unter 5 MB halten (Browser-Cache-Grenze liegt bei 5–8 MB) |
| M2.4 | Externe Kompressionswerkzeuge | Außerhalb von Framer | framer.com/help/articles/how-are-videos-optimized-in-framer/ | ffmpeg (auch als Web-Tool tools.rotato.app/compress), HandBrake mit Voreinstellung „Web Optimized"; fortgeschritten: ffmpeg-Flag `movflags +faststart` |
| M2.5 | Poster-Bild (Pflicht für Optimierung) | Video-Komponente, Poster-Feld | framer.com/help/articles/how-are-videos-optimized-in-framer/ | Jedes Video benötigt ein Poster-Bild, um Framers Optimierungen (u. a. Lazy Load) zu aktivieren; verbessert zugleich die SEO |
| M2.6 | Video-Eigenschaften | Video-Komponente, Assets-Tab | framer.com/help/articles/how-are-videos-optimized-in-framer/ | Muted (Ja/Nein) · Loop (Ja/Nein) · Playing/Autoplay (Ja/Nein) · Controls (Anzeigen/Ausblenden) |
| M2.7 | Lazy Loading für Video | Automatisch bei vorhandenem Poster | framer.com/help/articles/how-are-videos-optimized-in-framer/ | Video wird erst geladen, wenn es sich dem sichtbaren Bereich nähert |
| M2.8 | „GIF-artiges" Pausieren | Automatisch | framer.com/help/articles/how-are-videos-optimized-in-framer/ | Stummgeschaltete, loopende, automatisch abspielende Videos ohne Controls pausieren automatisch außerhalb des Viewports |
| M2.9 | YouTube-Einbettung | Insert → YouTube | framer.com/help/articles/how-are-videos-optimized-in-framer/, Live-Messung Canvas §4.1 | Eigene YouTube-Komponente; YouTube liefert adaptive Qualität je nach Netzwerk/Gerät |
| M2.10 | Vimeo-Einbettung | Insert → Vimeo | framer.com/help/articles/how-are-videos-optimized-in-framer/, Live-Messung Canvas §4.1 | Eigene Vimeo-Komponente, ebenfalls adaptive Qualität |
| M2.11 | Lottie-Einbettung | Insert → Media-Kategorie | Live-Messung Canvas §4.1 (Doku-Katalogliste: Image, Video, YouTube, MP3, GIF, Vimeo, Lottie, Spotify, Apple Music, SoundCloud, Podcasts, Simplecast) | Lottie-Animationsdatei als eigener Medientyp im Insert-Katalog neben Video/Audio-Diensten |
| M2.12 | Background-Video | Video-Element als Hintergrund einer Section/Frame | Live-Messung Canvas §4.1/§9.5 | Video als Hintergrundfüllung eines Containers nutzbar (Video-Fill), kombinierbar mit Autoplay/Loop/Muted |

### M3 — Icons

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| M3.1 | Eingebaute Icon-Bibliotheken | Insert-Menü → „Icons" | framer.com/help/articles/how-to-add-icons/ | Fünf native Bibliotheken: Phosphor, Feather, Meteor, Basicons, Lucide |
| M3.2 | Icon einfügen | Insert → Icons → Bibliothek wählen → auf die Fläche ziehen | framer.com/help/articles/how-to-add-icons/ | Drei Schritte: Insert-Menü öffnen, „Icons" wählen, Icon-Bibliothek auswählen, Icon auf die Fläche ziehen |
| M3.3 | Phosphor-Plugin (Marketplace) | Framer Marketplace → Plugin „Phosphor" | framer.com/marketplace/plugins/phosphor/ | Zusätzliches Plugin mit Suche und Drag-and-Drop; sechs Stilrichtungen von „bold" bis „duotone" (über die eingebaute Bibliothek hinaus) |
| M3.4 | Iconify-Plugin (Marketplace) | Framer Marketplace → Plugin „Iconify" | frameplugins.com/plugins/iconify.html, framer.com/marketplace/plugins/iconify/ | Zugriff auf über 150.000 Open-Source-Icons aus mehr als 100 Icon-Sets (u. a. Material Design, Phosphor, Lucide) per Drag-and-Drop |
| M3.5 | Icon als natives Element | Nach Einfügen | Live-Messung Canvas §4.1 | Eingefügtes Icon verhält sich wie eine SVG-Ebene: Farbe/Größe direkt am Element stylebar |

### M4 — Effekte auf Medien (Filters, Masks, Shaders, Blend)

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| M4.1 | Filters-Kopfmenü | Styles → „+" → „Filters" | Live-Messung Style-Inspektor §9.10, medium.com/framer-prototyping (Praxisbeleg für den Klickpfad) | Blur, Background Blur, Brightness, Contrast, Grayscale, Hue, Invert, Saturate, Sepia — je mit Schieberegler |
| M4.2 | Backdrop Filter / Blur | Styles-Popover | Live-Messung Style-Inspektor §9.11 (referenziert Doku 8.11–8.12) | Weichzeichnung des Hintergrunds HINTER dem Element (Frosted-Glass-Effekt) |
| M4.3 | Blend Mode | Styles → Kopfmenü → „Blending" | Live-Messung Style-Inspektor §9.10, medium.com/framer-prototyping | Modi u. a. Multiply, Overlay, Screen; steuert, wie ein Element mit dem darunterliegenden Inhalt verrechnet wird |
| M4.4 | Masking | Styles → „Mask" | Live-Messung Style-Inspektor §9.5 (referenziert Doku 8.4–8.5), medium.com/framer-prototyping | Alpha-Maske hinzufügen, per Gradient-Stops, Bild oder eigener SVG als Maskenform; Maske selbst skalier-/rotierbar |
| M4.5 | Shader-Fills | Fill-Popover | Live-Messung Style-Inspektor §9.5 (referenziert Doku 8.4–8.5) | Prozedurale Füllungen wie „Liquid"/„Holo" als Fill-Typ (aus der Live-Messung übernommen — keine eigene offizielle Framer-Hilfeseite dazu gefunden, gilt als Restlücke) |
| M4.6 | Video-Fill | Fill-Popover | Live-Messung Style-Inspektor §9.5 | Video als Flächenfüllung statt Bild |
| M4.7 | Selection Colors (Textmarkierungsfarbe) | Styles → „Selection" | Live-Messung Style-Inspektor §9.12 (referenziert Doku 8.13), framer.com/academy/lessons/selection-colors | Eigene Vordergrund-/Hintergrundfarbe für vom Nutzer markierten Text |

---

## CO — Code: Components, Property Controls, Overrides, Fetch, Custom Code, Embeds, Motion, Dev-Tools

### CO1 — Code Components (React)

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| CO1.1 | Code Component erstellen | Menü „Code" → „Create Code Component" | framer.com/developers/components-introduction, Live-Messung Canvas §5.7 | Legt eine neue React-Komponentendatei im Projekt an, die danach wie ein natives Element eingefügt wird |
| CO1.2 | Property Controls registrieren | Im Code der Komponente: `addPropertyControls(ComponentName, {...})` | framer.com/developers/property-controls | Zweiter Parameter definiert je Property einen `ControlType` mit Optionen; erscheint danach im Eigenschaften-Panel, sobald die Komponente auf der Fläche ausgewählt ist |
| CO1.3 | Control-Typ String | `ControlType.String` | framer.com/developers/property-controls | `defaultValue`, `placeholder`, `obscured` (Passwortfeld), `displayTextArea` (mehrzeilig), `maxLength` |
| CO1.4 | Control-Typ Number | `ControlType.Number` | framer.com/developers/property-controls | `defaultValue`, `min`/`max`, `step`, `unit` (z. B. „deg"), `displayStepper` |
| CO1.5 | Control-Typ Boolean | `ControlType.Boolean` | framer.com/developers/property-controls | `defaultValue` (Default `true`), `title`, `enabledTitle`/`disabledTitle` |
| CO1.6 | Control-Typ Color | `ControlType.Color` | framer.com/developers/property-controls | `defaultValue`, `optional` (entfernbar) |
| CO1.7 | Control-Typ Enum | `ControlType.Enum` | framer.com/developers/property-controls | `options`, `optionTitles`, `defaultValue`, `displaySegmentedControl`, `segmentedControlDirection` |
| CO1.8 | Control-Typ ComponentInstance | `ControlType.ComponentInstance` | framer.com/developers/property-controls | Referenziert eine andere Komponente auf der Fläche, erzeugt einen Outlet-Connector; typischer Name `children` |
| CO1.9 | Control-Typ ResponsiveImage (ersetzt Image) | `ControlType.ResponsiveImage` | framer.com/developers/property-controls | Liefert Objekt mit `src`, `srcSet`, `alt` |
| CO1.10 | Control-Typ File | `ControlType.File` | framer.com/developers/property-controls | `allowedFileTypes` (z. B. `["mov"]`) |
| CO1.11 | Control-Typ Array | `ControlType.Array` | framer.com/developers/property-controls | `control` (verschachtelter Typ), `maxCount`, `defaultValue` |
| CO1.12 | Control-Typ Object | `ControlType.Object` | framer.com/developers/property-controls | `controls` (verschachtelte Definitionen), `optional`, `buttonTitle`, `icon` (boolean/object/color/effect/interact) |
| CO1.13 | Control-Typ Link | `ControlType.Link` | framer.com/developers/property-controls | `defaultValue` als URL |
| CO1.14 | Control-Typ Date | `ControlType.Date` | framer.com/developers/property-controls | `displayTime`, Rückgabe als ISO-8601-String |
| CO1.15 | Control-Typ EventHandler | `ControlType.EventHandler` | framer.com/developers/property-controls | Für Smart Components, verbindet sich mit dem Interactions-Panel |
| CO1.16 | Control-Typ Padding | `ControlType.Padding` | framer.com/developers/property-controls | `defaultValue` als CSS-Padding-String (1- oder 4-Werte-Form) |
| CO1.17 | Control-Typ BorderRadius | `ControlType.BorderRadius` | framer.com/developers/property-controls | Einzel- oder Vier-Werte-Radius, `title` |
| CO1.18 | Control-Typ Border | `ControlType.Border` | framer.com/developers/property-controls | Liefert `borderWidth`/Seiten-Werte, `borderStyle` (solid/dashed/dotted/double), `borderColor` |
| CO1.19 | Control-Typ BoxShadow | `ControlType.BoxShadow` | framer.com/developers/property-controls | `defaultValue` als CSS-box-shadow-String |
| CO1.20 | Control-Typ Transition | `ControlType.Transition` | framer.com/developers/property-controls | Öffnet den Framer-Motion-Transition-Editor im Panel |
| CO1.21 | Control-Typ Gap | `ControlType.Gap` | framer.com/developers/property-controls | Zweidimensionaler Abstand, CSS-String „X Y" |
| CO1.22 | Control-Typ Font | `ControlType.Font` | framer.com/developers/property-controls | `defaultValue` (textAlign/fontSize/letterSpacing/lineHeight/variant), `defaultFontType`, `defaultFontSize`, `displayTextAlignment`, `displayFontSize`, `controls` (basic/extended) |
| CO1.23 | Control-Typ Cursor | `ControlType.Cursor` | framer.com/developers/property-controls | CSS-Cursor-Wert (außer „wait"), `title` |
| CO1.24 | Control-Typ TrackingId | `ControlType.TrackingId` | framer.com/developers/property-controls | Analytics-Kennung, erzwingt Kleinschreibung mit Bindestrichen |
| CO1.25 | Gemeinsame Optionen aller Controls | — | framer.com/developers/property-controls | `hidden` (Funktion, blendet Control bedingt aus), `description` (Markdown-Text im Panel), `title` |
| CO1.26 | Komponenten-Variablen/Varianten in Instanzen | Component-Instanz, rechtes Panel | community-belegt (uxdesign.cc, framer.community), Live-Messung Style-Inspektor §14.1 | Primary Variant ist Basis; Änderungen daran vererben sich an alle Varianten, sofern nicht überschrieben (blau markiert); Instanzen erben Struktur/Layout/Styles, Variablen erlauben gezielte Überschreibung einzelner Felder je Instanz |
| CO1.27 | Detach / Reset Overrides / Update Primary From Instance | Kontextmenü der Component-Instanz | Live-Messung Canvas §5.5 | Löst eine Instanz von der Komponente (Detach), setzt Overrides zurück, oder schreibt Instanz-Änderungen in die Primary-Variante zurück |

### CO2 — Code Overrides

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| CO2.1 | Code Override erstellen | Menü „Code" → „Create Code Override" bzw. Layer-Kontextmenü → „Code Overrides" → „New File…" | framer.com/developers/overrides-introduction, Live-Messung Canvas §5.7, Style-Inspektor §13.4 | Legt eine TypeScript/React-Datei mit Override-Funktion(en) an |
| CO2.2 | Override-Muster (Higher-Order Component) | Im Code | framer.com/developers/overrides-introduction | Ein Override ist eine normale React-HOC-Funktion, die eine Komponente umschließt und Props vor der Weitergabe verändert (Beispiel: Opacity-Wert anpassen) |
| CO2.3 | Override auf ein Element anwenden | Layer wählen → rechtes Panel → „Code Overrides"-Sektion → Override-Datei/-Funktion auswählen | framer.com/developers/overrides-introduction | Direkt im Eigenschaften-Panel des gewählten Elements zuweisbar |
| CO2.4 | Wirksamkeitsbereich | — | framer.com/developers/overrides-introduction | Overrides sind NUR in der Preview und auf der veröffentlichten Seite aktiv — nicht im Design-Editier-Modus selbst |
| CO2.5 | React-18-Pflicht | Code-Anforderung | framer.com/developers/overrides-introduction | Overrides müssen React-18-kompatibel sein; `forwardRef` wird verlangt, damit Effekte und Links am überschriebenen Layer funktionsfähig bleiben |
| CO2.6 | Risiko: eingebaute Funktionalität brechen | — | framer.com/developers/overrides-introduction | Framer warnt ausdrücklich, dass Overrides eingebaute Funktionalität (Links, Effekte) versehentlich zerstören können; empfiehlt für viele Fälle stattdessen Effects/Components/Fetch als „first-class"-Alternativen |
| CO2.7 | Typischer Anwendungsfall | Beispiel Klick-Tracking | framer.com/developers/overrides-examples | `fetch()`-Aufruf innerhalb eines Overrides beim Klick-Event, z. B. für Tracking-APIs |

### CO3 — Fetch (Data Fetching ohne Code)

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| CO3.1 | Fetch hinzufügen | Content-Property einer Textebene (oder anderer Property innerhalb einer Komponente) → „+" → „Add Fetch" | framer.com/help/articles/how-to-use-fetch/, framer.com/academy/lessons/fetch | Öffnet die Fetch-Konfiguration direkt am Feld |
| CO3.2 | API-URL und Pfad | Fetch-Dialog | framer.com/help/articles/how-to-use-fetch/ | Freie API-URL-Eingabe ODER Auswahl aus Beispiel-Endpunkten; „Path"-Feld wählt den gewünschten Wert aus der JSON-Antwort aus |
| CO3.3 | Credentials-Einstellung | Fetch-Dialog | framer.com/help/articles/how-to-use-fetch/ | „Same Origin" (Standard, Zugangsdaten nur innerhalb derselben Domain) vs. „Include" (auch domainübergreifend, für authentifizierte Endpunkte) |
| CO3.4 | Caching | Fetch-Dialog | framer.com/help/articles/how-to-use-fetch/ | Antworten pro URL beim Seitenaufruf cachebar; Cache liegt im Browser des Besuchers und vermeidet erneute Requests bis zum Ablauf; kurze Cache-Dauer für hochdynamische Daten empfohlen |
| CO3.5 | Loading/Error-Varianten | Innerhalb von Components | framer.com/help/articles/how-to-use-fetch/, framer.com/updates/fetch | Eigene sichtbare Varianten für Ladezustand und Fehlerfall, wenn Fetch an eine Komponenten-Property gebunden ist |
| CO3.6 | Automatische Deduplizierung | Systemseitig | framer.com/updates/fetch | Mehrere identische Fetch-Aufrufe auf einer Seite werden intern zusammengeführt |
| CO3.7 | Einsatzzweck | — | framer.com/help/articles/how-to-use-fetch/ | Für dynamische/personalisierte Einzelwerte: Login-Status, standortbasierte Inhalte, Lagerbestand, Live-Kurse |
| CO3.8 | Einschränkung: keine Listen | — | framer.com/help/articles/how-to-use-fetch/ | Fetch unterstützt KEINE Listen/große Datenmengen; dafür sind CMS Collections mit der Sync API vorgesehen |
| CO3.9 | Sicherheitshinweis | — | framer.com/help/articles/how-to-use-fetch/ | API-Endpunkte müssen öffentlich erreichbar sein; sensible Daten dürfen nicht eingebettet werden, da sie ins ausgelieferte JavaScript gebündelt und damit einsehbar würden |

### CO4 — Custom Code (Head/Body) und Embeds

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| CO4.1 | Site-weiter Custom Code | Site Settings → General → Sektion „Custom Code" | framer.com/help/articles/how-to-add-custom-code/, launchnow.design, akilastudio.com | Vier Einschubstellen: Head Start, Head End, Body Start, Body End; jede akzeptiert beliebiges HTML inkl. `<script>`/`<style>` |
| CO4.2 | „Show Advanced"-Umschaltung | Custom-Code-Sektion, unterer Rand | akilastudio.com (Sekundärquelle mit Beleg für den Klickpfad) | Klappt von zwei Eingabefeldern (Head/Body) auf die vollen vier Slots (Start/Ende je Head/Body) auf |
| CO4.3 | Seitenspezifischer Custom Code | Page Settings → Custom Code (pro Seite) | akilastudio.com, framerwebsites.com | Eigener Code nur für eine einzelne Seite statt site-weit |
| CO4.4 | CMS-Detailseiten-Custom-Code mit Variablen | CMS Detail Page → Page Settings → Custom Code | framerwebsites.com (Sekundärquelle) | Nutzung von `{{ }}`-Platzhaltern, um dynamische CMS-Feldwerte in den injizierten Code einzusetzen |
| CO4.5 | Typische Nutzung Head-Code | — | akilastudio.com | Analytics (Google Analytics, Plausible, Fathom), Meta-Tags zur Domain-Verifizierung, Custom-Font-Importe, CSS, das vor dem Rendern verfügbar sein muss |
| CO4.6 | Typische Nutzung Body-Code | — | akilastudio.com | Chat-Widgets (Intercom, Crisp, Tawk.to), Cookie-Consent-Banner, Marketing-Automation-Skripte — alles, was nach dem sichtbaren Inhalt laden darf |
| CO4.7 | Custom Code durch Plugins (Entwickler-API) | Plugin-SDK, `framer.setCustomCode()` | framer.com/developers/custom-code | Plugins können HTML an headStart/headEnd/bodyStart/bodyEnd aller veröffentlichten Seiten anhängen; Nutzer können ein Plugin-Snippet deaktivieren, das Plugin kann es danach nicht selbst wieder aktivieren, erkennt aber den Status |
| CO4.8 | HTML-Embed-Element | Insert → Embed/HTML | framerwebsites.com (Sekundärquelle, im Kontext „Framer offers several ways: injection, HTML embed elements, code components") | Eigener Baustein zum Einbetten beliebigen HTML-Snippets an einer bestimmten Stelle im Layout (im Unterschied zum globalen Head/Body-Code) |

### CO5 — Framer Motion / Motion for React

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| CO5.1 | Umbenennung „Framer Motion" → „Motion" | Bibliothek/Import | motion.dev, framer.com/dictionary/framer-motion | Bibliothek heißt seit der Umbenennung „Motion"; Import erfolgt aus `motion/react` statt `framer-motion` |
| CO5.2 | Motion-Komponenten | Im Code Component/Override | framer.com/motion/component | `motion.div`, `motion.svg` u. a. als spezielle React-Komponenten für HTML-/SVG-Elemente |
| CO5.3 | Transition-Steuerung | Im Code, `transition`-Prop | framer.com/motion/animation/ | Dauer, Easing, Springs, Delay, Stagger konfigurierbar |
| CO5.4 | Gesten/Varianten/Layout-Animationen | Im Code | motion.dev | Hover/Tap/Drag-Gesten, Varianten, Layout-Übergänge, `AnimatePresence` für Exit-Animationen, scrollgebundene Effekte |
| CO5.5 | Einsatz in Framer selbst | Effects-Panel des Editors nutzt dieselbe Engine | Live-Messung Style-Inspektor §6 (Effects), motion.dev | Die im Framer-UI gesetzten Appear/Hover/Scroll-Effekte laufen technisch auf derselben Motion-Engine wie die für Code Components verfügbare Bibliothek |

### CO6 — Developer-Tools (Console, Inspect)

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| CO6.1 | Development Plugin / Developer Tools (Menüpunkt) | Insert-Panel → Plugins → „Development Plugin"/„Developer Tools" | Live-Messung Canvas §4.13 | Eigener Menüpunkt im Plugin-Bereich für Plugin-Entwicklung; kein dediziertes offizielles Hilfe-Dokument mit Detailbeschreibung gefunden — Restlücke |
| CO6.2 | Preview „Inspect" | Preview-Modus, Kürzel ⌘I | Live-Messung Canvas §7.1 (Kürzelquelle framer.com/shortcuts) | Zeigt im Vorschau-Modus Layout-/Abstandsinformationen des unter dem Cursor liegenden Elements, ähnlich einem Inspect-Element-Werkzeug |
| CO6.3 | Browser-Konsole/Inspect-Element als Ersatz | Chrome DevTools (extern, nicht Framer-nativ) | Sekundärbeleg, allgemeine Browser-Doku (developer.chrome.com) | Framer selbst führt keine eigene JS-Konsole im Editor; Fehlersuche an Code Components/Overrides erfolgt über die Browser-DevTools der Vorschau/veröffentlichten Seite |

---

## F — Import aus Figma/HTML

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| F1.1 | „Figma to HTML with Framer"-Plugin (Figma-seitig) | Figma → Plugins → Suche „Figma to HTML with Framer" | figma.com/community/plugin/1037108608720448600, framer.com/academy/lessons/framer-fundamentals-importing-from-figma-and-the-web | Offizielles, kostenloses Figma-Plugin von Framer; Support-Kontakt `figma@framer.com` |
| F1.2 | Ablauf Figma → Framer | In Figma: Layer/Frame wählen, mit dem Plugin kopieren → in Framer mit ⌘V/Ctrl+V einfügen | figma.com/community/plugin/1037108608720448600, veloxthemes.com, holygrid.studio | Layout-Einstellungen wie Auto Layout, Ebenenhierarchie und Füllungen werden automatisch übernommen |
| F1.3 | Empfehlung: abschnittsweise kopieren | — | holygrid.studio, wizetemplates.com | Für bessere Kontrolle einzelne Sektionen statt der ganzen Figma-Seite auf einmal kopieren; Auto Layout in Figma ergibt ein flexibleres Ergebnis |
| F1.4 | „Import from Figma"-Menüpunkt in Framer | Menü File → „Import from Figma" | Live-Messung Canvas §4.11 | Alternativer Einstiegspunkt direkt aus Framer heraus (Kürzel ⇧⌘I laut Live-Messung) |
| F2.1 | HTML to Framer (Chrome-Erweiterung) | Chrome Web Store → „HTML to Framer" installieren | chromewebstore.google.com/detail/html-to-framer, framer.com/updates/html-to-framer | Offizielle Framer-Erweiterung zum Kopieren beliebiger Web-Elemente (Text, Bilder, Buttons, ganze Layouts) von JEDER Website (HTML/CSS oder anderer No-Code-Builder) |
| F2.2 | Ablauf HTML → Framer | Element auf einer beliebigen Website mit der Maus markieren → Klick zum Kopieren → in Framer ⌘V/Ctrl+V | chromewebstore.google.com/detail/html-to-framer, segmentui.com | Shift gedrückt halten kopiert mehrere Elemente auf einmal; Esc während des Hoverns wählt das übergeordnete Elternelement statt des Kindelements |
| F2.3 | Ergebnis | In Framer eingefügt | chromewebstore.google.com/detail/html-to-framer | Saubere Ebenenhierarchie, direkt weiter editierbar oder sofort veröffentlichbar |
| F3.1 | Paste from Figma (allgemeiner Copy/Paste-Weg) | ⌘V/Ctrl+V in Framer nach Kopieren aus Figma | Live-Messung Canvas §5.2/§4.11 | Auch ohne separates Plugin funktioniert einfaches Copy/Paste zwischen Figma und Framer für einzelne Layer, mit dem offiziellen Plugin jedoch zuverlässiger bei komplexen Strukturen |

---

## A — Accessibility-Werkzeuge

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| A1.1 | Semantische Tags an Text Styles | Text Style, automatisch h1–h6/p | framer.com/help/articles/guide-to-web-accessibility-in-framer/ | Text Styles erhalten automatisch ein semantisches Tag; pro Instanz im Accessibility-Panel überschreibbar |
| A1.2 | Semantische Frame-Tags | Accessibility-Panel am Frame | framer.com/help/articles/guide-to-web-accessibility-in-framer/, Live-Messung Style-Inspektor §13.2 | Article (Hauptinhalt) · Footer (Sekundärlinks/Newsletter) · Header (Navigation/Sticky-Bar) · Nav (alle Navigationselemente) · Section (eigenständiger Seitenabschnitt); dazu generisches div/span sowie h1–h6/p |
| A1.3 | Alt-Text am Bild | Accessibility-Panel am Bildelement | framer.com/help/articles/guide-to-web-accessibility-in-framer/ | Siehe auch M1.7; hilft Suchmaschinen, Screenreadern, Ladefehler-Fallback |
| A1.4 | Aria Label | Accessibility-Panel | Live-Messung Style-Inspektor §13.2 (Doku 16.x) | Beschriftungsfeld für Screenreader zusätzlich zum sichtbaren Inhalt |
| A1.5 | Tab Index / Tab-Reihenfolge | Accessibility-Panel | framer.com/help/articles/guide-to-web-accessibility-in-framer/ | Eigene Tab-Reihenfolge festlegbar, z. B. um zuerst zu primären Call-to-Actions zu springen |
| A1.6 | Contrast Ratio | Kein eigenes Framer-Bordwerkzeug — Chrome-Lighthouse-Report | framer.com/help/articles/understanding-contrast-ratio/ | WCAG-2.1-AA verlangt Kontrastverhältnis ≥ 4.5:1 (Normaltext) bzw. ≥ 3:1 (Großtext ab 18pt/14pt fett); Framer verweist zur Prüfung auf Chrome-DevTools-Lighthouse statt ein eigenes Werkzeug zu führen |
| A1.7 | Contrast-Checker-Plugins (Marketplace) | Framer Marketplace → Plugin „Contrast Checker" | framer.com/community/marketplace/plugins/contrast-checker/, frameplugins.com/plugins/contrast-checker | Community-/Marketplace-Plugin als Ergänzung, da Framer selbst keinen eingebauten Kontrast-Prüfer im Editor hat |
| A1.8 | Google-Bot-Sichtbarkeit (Skip) | Accessibility-„+"-Panel | Live-Messung Style-Inspektor §13.2 (Doku 16.x) | Schalter, ein Element „für Vorlesehilfen verborgen" zu setzen (aus Screenreader-Baum ausschließen), ohne es optisch zu verstecken |
| A1.9 | Reduced Motion | Site-weite Einstellung | framer.com/help/articles/guide-to-web-accessibility-in-framer/, Live-Messung Style-Inspektor §13.3 (Doku 16.5) | Deaktiviert Parallax-, Transform- und Layout-Animationen für Besucher, die auf Betriebssystemebene reduzierte Bewegung eingestellt haben |

---

## P — Performance-Werkzeuge

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| P1.1 | Bild-Performance | Automatisch, siehe M1 | framer.com/help/articles/site-optimization/ | Resolution auf „Auto" belassen → automatische WebP/AVIF-Konvertierung und Größenanpassung ohne Nutzerzutun |
| P1.2 | Font-Performance | Schriftauswahl | framer.com/help/articles/site-optimization/ | Schriftschnitte zwischen „Light" und „Extra Bold" bevorzugen; Google Fonts laden schneller (nur benötigte Zeichen werden geladen); vor November 2023 hochgeladene eigene Schriften zur WOFF2-Konvertierung erneut hochladen |
| P1.3 | Video-Performance | Empfehlung | framer.com/help/articles/site-optimization/ | YouTube/Vimeo statt Eigen-Upload nutzen (adaptive Qualität je Netzwerk); Autoplay möglichst vermeiden, um Bandbreite zu sparen; stummgeschaltete geloopte Videos ohne Controls laden lazy |
| P1.4 | Versions-/Optimierungsstatus | Menü → Site Settings → „Versions" | framer.com/help/articles/site-optimization/ | Zeigt je Version den Status „Optimized" bzw. „Optimization Error" |
| P1.5 | Script-Ladeverhalten | Custom-Code-Platzierung | framer.com/help/articles/site-optimization/ | `<script>`-Tags ans Ende von `<body>` setzen oder mit `defer`; `async` nutzen, wenn ein Skript so schnell wie möglich laden muss; Inline-Skripte und `type="module"` sind bereits optimiert |
| P1.6 | Appear-Effekte am Seitenanfang | Effects-Panel, Elemente „above the fold" | framer.com/help/articles/site-optimization/ | Für Elemente oben auf der Seite Appear-Effekte nutzen, damit sie vor vollständigem JS-Laden sichtbar werden |
| P1.7 | Schatten/Weichzeichner-Obergrenze | Styles-Panel, Shadow/Blur-Werte | framer.com/help/articles/site-optimization/ | Blur-Werte unter 10 halten, um Rendering-Kosten zu begrenzen |
| P1.8 | Externe Embeds | Lazy Load automatisch | framer.com/help/articles/site-optimization/ | Framer lädt externe Einbettungen (z. B. Widgets) lazy, sie beeinflussen die Ladezeit aber weiterhin messbar |
| P1.9 | Lighthouse als externes Messwerkzeug | Chrome DevTools → Lighthouse | framer.com/help/articles/understanding-contrast-ratio/ | Framer selbst führt kein eigenes Performance-Panel im Editor; verweist für Messung (auch Kontrast) auf Chrome-Lighthouse |

---

## Zählung

- **D (Designsystem: Color/Text Styles, Variables):** 26 Einträge (D1.1–D1.8, D2.1–D2.6, D3.1–D3.9, davon 9 Color Style, 6 Text Style, 9 Variablen, 2 sonstige = 26 gesamt geprüft: D1 = 8, D2 = 6, D3 = 9 → **23**)
  - Korrigierte Zählung: D1.1–D1.8 (8) + D2.1–D2.6 (6) + D3.1–D3.9 (9) = **23**
- **B (Breakpoints):** B1.1–B1.2, B2.1–B2.3, B3.1–B3.4, B4.1, B5.1, B6.1 = **12**
- **L (Layout Grid/Guides/Rulers):** L1.1–L1.4, L2.1, L3.1–L3.4, L4.1 = **10**
- **M (Medien: Bild/Video/Icons/Effekte):** M1.1–M1.12 (12) + M2.1–M2.12 (12) + M3.1–M3.5 (5) + M4.1–M4.7 (7) = **36**
- **CO (Code):** CO1.1–CO1.27 (27) + CO2.1–CO2.7 (7) + CO3.1–CO3.9 (9) + CO4.1–CO4.8 (8) + CO5.1–CO5.5 (5) + CO6.1–CO6.3 (3) = **59**
- **F (Figma/HTML-Import):** F1.1–F1.4 (4) + F2.1–F2.3 (3) + F3.1 (1) = **8**
- **A (Accessibility):** A1.1–A1.9 = **9**
- **P (Performance):** P1.1–P1.9 = **9**

**Gesamt: 23 + 12 + 10 + 36 + 59 + 8 + 9 + 9 = 166 recherchierte Funktionen/Felder.**

Restlücken (keine dedizierte offizielle Framer-Hilfeseite gefunden, nur Community-/Sekundärbeleg oder Live-Messung übernommen): Ordner-Anlage für Color Styles ohne „/"-Trick (D1.3), Shader-Fills (M4.5), Rulers-Details (L4.1), Snap-to-Grid-Schalter im Detail (L3.3), Development-Plugin/Console-Funktion (CO6.1), Breakpoint-Löschen-Schrittfolge (B6.1). Diese sind so gekennzeichnet und nicht als gesicherte Framer-Dokumentation ausgegeben.
