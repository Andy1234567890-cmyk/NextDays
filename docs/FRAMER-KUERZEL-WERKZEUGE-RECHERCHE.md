# Framer-Editor: Tastenkürzel & Werkzeuge (Recherche)

Stand der Recherche: 05.09.2026. Methode: WebSearch + WebFetch (kein Zugriff auf
laufendes Chrome mit Debug-Port in dieser Sitzung, daher keine Live-Auslesung
der JS-App `framer.com/shortcuts` möglich — diese Seite liefert per Fetch nur
ein serverseitig vorgerendertes Teilfragment, keinen vollständigen DOM-Inhalt).
Jede Zeile trägt ihre Quelle. Vermutetes/nicht belegtes steht separat unter
„Unbelegt".

WICHTIGER VORBEHALT zu Teil A: Framer war ursprünglich „Framer X", ein
React-Prototyping-Tool (2019), und ist seit ca. 2020/21 zum No-Code-Website-
Baukasten umgebaut, der heute unter framer.com läuft. Mehrere Community-Quellen
(z. B. usethekeyboard.com/framer-x) katalogisieren explizit die ALTE
Framer-X-Oberfläche. Diese Kürzel sind unten als „Framer X (Altprodukt,
2019)" gekennzeichnet und NICHT ungeprüft mit dem heutigen Editor
gleichzusetzen — einzelne Kürzel (z. B. Frame=F, Text=T, Cmd+D=Duplizieren)
dürften weiterhin gelten, andere (z. B. „Path"-Werkzeug=P als eigenständiges
Tool) sind im heutigen Editor so nicht bestätigt.

Die offizielle, aktuell gepflegte Quelle ist ausschließlich:
- https://www.framer.com/shortcuts (interaktive Referenzseite, JS-Anwendung)
- https://www.framer.com/help/articles/keyboard-shortcuts/ (verweist im Produkt
  auf: Projektmenü → Help → Keyboard Shortcuts, öffnet ein Pop-up im Editor)

Beide ließen sich in dieser Sitzung nur TEILWEISE per Fetch auslesen (siehe
unten, Abschnitt A1). Für eine lückenlose Erfassung müsste die Seite in einem
echten Browser mit aktivem JS geöffnet werden (in dieser Sitzung nicht
verfügbar: kein laufender Chrome-Debug-Port).

---

## A) Tastenkürzel

### A1) Aus der offiziellen Seite framer.com/shortcuts tatsächlich ausgelesen

Diese Zeilen stammen direkt aus dem (partiell vorgerenderten) Inhalt von
https://www.framer.com/shortcuts, abgerufen per WebFetch am 05.09.2026.
Die Seite ist eine Suchoberfläche; ohne interaktive JS-Ausführung wurden nur
die folgenden Einträge im Rohtext sichtbar:

| Kürzel (Mac) | Kürzel (Windows) | Funktion | Bereich | Quelle |
|---|---|---|---|---|
| ⌘⇧H | Ctrl+Shift+H | Toggle Highlights | Preview | https://www.framer.com/shortcuts |
| ⌘R | Ctrl+R | Refresh | Preview | https://www.framer.com/shortcuts |
| ⌘I | Ctrl+I | Inspect | Preview | https://www.framer.com/shortcuts |
| Z | Z | Toggle Responsive | Preview | https://www.framer.com/shortcuts |
| — | Ctrl+. | Preview Next Breakpoint | Preview | https://www.framer.com/shortcuts |
| — | — | Preview Previous Breakpoint (Kürzel im Fragment nicht lesbar) | Preview | https://www.framer.com/shortcuts |
| Tab | Tab | Cycle Selection (Forwards) | Selection | https://www.framer.com/shortcuts |
| — | — | Cycle Selection (Backwards) (Kürzel im Fragment nicht lesbar) | Selection | https://www.framer.com/shortcuts |

Das ist NICHT die vollständige Liste — die Seite enthält laut eigener
Beschreibung eine durchsuchbare Gesamtübersicht „für Design, Bearbeitung,
Vorschau und Publizieren", von der per Fetch nur ein kleiner, offenbar
zufällig vorgerenderter Ausschnitt (Kategorien „Preview" und „Selection")
zugänglich war. Die Kategorien Canvas, Layers, Inspector, Text, Tools, View,
Insert sind darin NICHT enthalten gewesen (technische Grenze dieser
Recherche-Sitzung, kein inhaltlicher Befund über deren Nichtexistenz).

### A2) Quick Actions / Command Palette (offizielle Framer-Ankündigung)

| Kürzel (Mac) | Kürzel (Windows) | Funktion | Bereich | Quelle |
|---|---|---|---|---|
| ⌘K | Ctrl+K | Quick Actions öffnen (Projekt-Navigation, Seiten/Komponenten springen, Einstellungen, Mitarbeiter einladen, Aktionen inkl. ihrer Kürzel entdecken) | View / Tools | https://www.framer.com/updates/quick-actions |
| ↑ / ↓ | ↑ / ↓ | In der Quick-Actions-Liste navigieren | View | https://www.framer.com/updates/quick-actions |
| Enter | Enter | Ausgewählte Quick Action ausführen | View | https://www.framer.com/updates/quick-actions |

### A3) Zoom (offizielle Hilfe-Seite „Using the canvas")

| Kürzel (Mac) | Kürzel (Windows) | Funktion | Bereich | Quelle |
|---|---|---|---|---|
| ⌘ + / ⌘ − | Ctrl + / Ctrl − | Zoomstufe erhöhen/verringern (jede Stufe verdoppelt/halbiert den aktuellen Zoom) | Canvas / View | https://www.framer.com/help/articles/how-to-use-the-canvas/ |
| Leertaste + Ziehen (Maus) | Leertaste + Ziehen | Canvas schwenken (Pan) | Canvas | https://www.framer.com/help/articles/how-to-use-the-canvas/ |

Hinweis zur Quelle: Der Artikel beschreibt zusätzlich Trackpad-Gesten
(Klick-und-Ziehen, Zweifinger-Scrollen, Pinch-Zoom) sowie einen
Zoom-Prozent-Dropdown im unteren Toolbar-Bereich — das sind KEINE
Tastenkürzel, sondern Zeigegeräte-/Menü-Bedienungen, deshalb hier nicht als
Kürzel-Zeile geführt.

### A4) Sekundärquellen (Community, NICHT offiziell) — mit Herkunfts-Kennzeichnung

**Framer X (Altprodukt, 2019) — Quelle: https://usethekeyboard.com/framer-x/**
Diese Tabelle katalogisiert ausdrücklich „Framer X", das React-Prototyping-Tool
vor dem Umbau zum No-Code-Website-Baukasten. Ob und welche dieser Kürzel im
heutigen framer.com-Editor identisch fortbestehen, ist NICHT verifiziert.

| Kürzel | Funktion | Bereich | Quelle |
|---|---|---|---|
| F | Frame (Werkzeug) | Tools | https://usethekeyboard.com/framer-x/ |
| U | Round (Werkzeug) | Tools | https://usethekeyboard.com/framer-x/ |
| T | Text (Werkzeug) | Tools | https://usethekeyboard.com/framer-x/ |
| S | Stack (Werkzeug) | Tools | https://usethekeyboard.com/framer-x/ |
| L | Link (Werkzeug) | Tools | https://usethekeyboard.com/framer-x/ |
| Leertaste | Canvas schwenken (Pan) | Tools | https://usethekeyboard.com/framer-x/ |
| G | Graphic (Werkzeug) | Tools/Vector | https://usethekeyboard.com/framer-x/ |
| P | Path (Werkzeug) | Tools/Vector | https://usethekeyboard.com/framer-x/ |
| R | Rectangle (Werkzeug) | Tools/Vector | https://usethekeyboard.com/framer-x/ |
| O | Oval (Werkzeug) | Tools/Vector | https://usethekeyboard.com/framer-x/ |
| V | Vector (Werkzeug) | Tools/Vector | https://usethekeyboard.com/framer-x/ |
| ⌘G | Group | Layers | https://usethekeyboard.com/framer-x/ |
| ⌘⇧G | Ungroup | Layers | https://usethekeyboard.com/framer-x/ |
| ⌘Enter | Add Frame | Layout | https://usethekeyboard.com/framer-x/ |
| ⌘⌥Enter | Add Stack | Layout | https://usethekeyboard.com/framer-x/ |
| ⌘Rückschritt (Del) | Remove Wrapper | Layout | https://usethekeyboard.com/framer-x/ |
| ⌘⌥↑ | Move Forward | Layout | https://usethekeyboard.com/framer-x/ |
| ⌘⌥↓ | Move Backward | Layout | https://usethekeyboard.com/framer-x/ |
| ⌘K | Create Component from Design | Components | https://usethekeyboard.com/framer-x/ |
| ⌘⇧K | Create Component from Code | Components | https://usethekeyboard.com/framer-x/ |
| ⌘B | Bold | Text | https://usethekeyboard.com/framer-x/ |
| ⌘I | Italic | Text | https://usethekeyboard.com/framer-x/ |
| ⌘U | Underline | Text | https://usethekeyboard.com/framer-x/ |
| ⌘T | Select Typeface | Text | https://usethekeyboard.com/framer-x/ |
| ⌘+Pfeiltasten | Objektgröße anpassen | Inspector | https://usethekeyboard.com/framer-x/ |
| ⌘⇧+Pfeiltasten | Objektgröße um 10px anpassen | Inspector | https://usethekeyboard.com/framer-x/ |
| 0–9 | Deckkraft setzen | Inspector | https://usethekeyboard.com/framer-x/ |
| ⌥ (halten) | Abstand anzeigen | Canvas | https://usethekeyboard.com/framer-x/ |
| ⌘D | Duplizieren an Ort | Canvas | https://usethekeyboard.com/framer-x/ |
| ⌘⌥C | Stil kopieren | Inspector | https://usethekeyboard.com/framer-x/ |
| ⌘⌥V | Stil einfügen | Inspector | https://usethekeyboard.com/framer-x/ |
| Ctrl+C | Farbpipette | Tools | https://usethekeyboard.com/framer-x/ |
| ⌘A | Alle Ebenen auswählen | Layers | https://usethekeyboard.com/framer-x/ |
| ⌘⇧A | Alle Geschwister auswählen | Layers | https://usethekeyboard.com/framer-x/ |
| ⌘⌥A | Alle Kinder auswählen | Layers | https://usethekeyboard.com/framer-x/ |
| Z | Zoom-Werkzeug | View | https://usethekeyboard.com/framer-x/ |
| ⌘+ | Zoom In | View | https://usethekeyboard.com/framer-x/ |
| ⌘− | Zoom Out | View | https://usethekeyboard.com/framer-x/ |
| ⌘1 | Zoom to Fit | View | https://usethekeyboard.com/framer-x/ |
| ⌘2 | Zoom to Fit Selection | View | https://usethekeyboard.com/framer-x/ |
| ⌘0 | Zoom to 100% | View | https://usethekeyboard.com/framer-x/ |
| Ctrl+R | Lineale anzeigen | View | https://usethekeyboard.com/framer-x/ |
| ⌘M | Minimieren | View | https://usethekeyboard.com/framer-x/ |
| ⌘⇧1 | Willkommen-Bildschirm | View | https://usethekeyboard.com/framer-x/ |
| ⌘P | Preview | View | https://usethekeyboard.com/framer-x/ |

**Framebite.com (Blog, Datum/Version nicht ausgewiesen) — Quelle:
https://framebite.com/blog/framer-shortcuts-and-tips**
Nicht als offiziell gekennzeichnet; teils deckungsgleich mit A4-Framer-X-Liste,
teils abweichend (z. B. „I = Farbpipette" statt „Ctrl+C"), was auf
Versions-/Plattform-Unterschiede oder Ungenauigkeit der Blog-Quelle
hindeutet — NICHT aufgelöst, da keine offizielle Gegenprobe verfügbar war.

| Kürzel | Funktion | Bereich | Quelle |
|---|---|---|---|
| F | Frame erzeugen | Canvas/Tools | https://framebite.com/blog/framer-shortcuts-and-tips |
| ⌘/Ctrl+0 | Gesamten Canvas einpassen | View | https://framebite.com/blog/framer-shortcuts-and-tips |
| ⌘/Ctrl+2 | Auf Auswahl zoomen | View | https://framebite.com/blog/framer-shortcuts-and-tips |
| Leertaste+Ziehen | Canvas schwenken (Hand-Werkzeug) | Canvas | https://framebite.com/blog/framer-shortcuts-and-tips |
| T | Text-Werkzeug aktivieren | Tools | https://framebite.com/blog/framer-shortcuts-and-tips |
| I | Farbpipette aktivieren | Tools | https://framebite.com/blog/framer-shortcuts-and-tips |
| ⌘/Ctrl+D | Duplizieren (merkt sich Abstand) | Canvas | https://framebite.com/blog/framer-shortcuts-and-tips |
| ⌘/Ctrl+K | In Komponente umwandeln | Components | https://framebite.com/blog/framer-shortcuts-and-tips |
| ⌘/Ctrl+G | Ebenen gruppieren | Layers | https://framebite.com/blog/framer-shortcuts-and-tips |
| ⌘/Ctrl+⇧+G | Gruppierung aufheben | Layers | https://framebite.com/blog/framer-shortcuts-and-tips |
| ⌘/Ctrl+⇧+H | Sichtbarkeit umschalten | Layers | https://framebite.com/blog/framer-shortcuts-and-tips |
| ⌘/Ctrl+L | Ebene sperren | Layers | https://framebite.com/blog/framer-shortcuts-and-tips |
| Enter | Übergeordnete Ebene auswählen | Layers | https://framebite.com/blog/framer-shortcuts-and-tips |
| ⌘/Ctrl+Enter | Erstes Kind-Element auswählen | Layers | https://framebite.com/blog/framer-shortcuts-and-tips |
| ⌘/Ctrl+P | Vorschau-Modus öffnen | Preview | https://framebite.com/blog/framer-shortcuts-and-tips |
| Esc | Vorschau-Modus verlassen | Preview | https://framebite.com/blog/framer-shortcuts-and-tips |
| Rechtsklick-Menü | „Copy as Code" (React-Snippet) | Tools | https://framebite.com/blog/framer-shortcuts-and-tips |

### A5) Nicht auflösbare Widersprüche zwischen Quellen
- ⌘P wird von framebite.com als „Preview öffnen" geführt, von der Framer-X-
  Liste (usethekeyboard) ebenfalls als „Preview" — konsistent.
- „I" wird von framebite.com als Farbpipette geführt, von usethekeyboard als
  „Ctrl+C" — Widerspruch, keine offizielle Quelle konnte dies auflösen.
- Die offizielle Seite framer.com/shortcuts nennt „⌘I" NICHT als Farbpipette,
  sondern im ausgelesenen Fragment als „Inspect" (Preview-Kategorie) — ein
  weiterer Hinweis, dass Community-Quellen teils veraltete/abweichende
  Zuordnungen führen. Dies weist darauf hin, dass NUR A1–A3 als verlässlich
  gelten sollten; A4 ist Kontext, kein Beleg für den heutigen Editor.

---

## B) Werkzeuge und Insert-Kategorien

### B1) Grundstruktur des Insert-Menüs (offiziell)

| Werkzeug/Kategorie | Was es tut | Wo | Quelle |
|---|---|---|---|
| Insert-Panel (allgemein) | Zentrale Oberfläche zum Hinzufügen von Elementen, Komponenten, Sektionen und Assets zu einer Seite | Toolbar oben, öffnet Seitenpanel | https://www.framer.com/dictionary/insert-menu |
| Slash-Befehle | Alternative Methode, Elemente ohne Maus-Klick auf das Insert-Panel einzufügen | Direkt im Editor per Tastatureingabe „/" | https://www.framer.com/dictionary/insert-menu |

### B2) Layout-Werkzeuge

| Werkzeug | Was es tut | Wo | Quelle |
|---|---|---|---|
| Frame | Grundlegendes Container-Element; hält Inhalt, definiert Grenzen für Layout, Größe und visuelle Eigenschaften; Baustein für kleine Elemente bis komplette Seiten | Toolbar (Layout-Menü) | https://www.framer.com/dictionary/frame |
| Grid | Layout wie eine Tabelle/Excel-Sheet mit fester Zeilen-/Spaltenzahl; anlegbar über das Layout-Werkzeug in der oberen Toolbar oder durch Umwandeln eines Frames über die Layout-Eigenschaft | Toolbar (Layout-Menü) | WebSearch-Auszug aus offiziellen Framer-Quellen (siehe unten „Herkunft") |
| Bild als Frame mit Bildfüllung | Bild-Datei per Drag-and-drop auf den Canvas ziehen erzeugt automatisch einen Frame mit Bild-Füllung; alternativ Frame zeichnen und Füllung auf „Image" setzen | Canvas / Layout-Menü („Image") | Aggregiert aus WebSearch-Zusammenfassung offizieller Framer-Hilfeinhalte |

Hinweis: Die Grid- und Image-Zeilen stammen aus einer WebSearch-Zusammenfassung,
die sich ausdrücklich auf offizielle Framer-Hilfe-/Academy-Inhalte bezieht,
konnten aber nicht durch direkten WebFetch der Originalseite mit Volltext
bestätigt werden (die betreffenden Academy-Seiten sind videobasiert, der Text
der Zusammenfassung liegt jedoch inhaltlich konsistent mit dem Frame-Dictionary-
Eintrag). Als „offiziell abgeleitet, nicht wortgetreu verifiziert" zu werten.

### B3) Text

| Werkzeug | Was es tut | Wo | Quelle |
|---|---|---|---|
| Text-Werkzeug | Fügt Text-Elemente ein; alternativ Doppelklick in einen Frame erzeugt eine Textbox | Toolbar / Insert-Panel | Aggregierte WebSearch-Zusammenfassung offizieller Framer-Inhalte (Academy „Adding images, video and text") |

### B4) Vektor-Werkzeuge

Für Pen/Rectangle/Oval/Path/Boolean als eigenständige, im HEUTIGEN Editor
benannte Werkzeuge konnte in dieser Sitzung KEINE offizielle Framer-Quelle
(Help/Dictionary/Academy) mit Volltext bestätigt werden — die Suchtreffer
dazu führten überwiegend zu Drittanbieter-Blogs oder zur veralteten Framer-X-
Dokumentation (siehe A4). Diese Werkzeuge stehen daher unter „Unbelegt".

### B5) Video, Embed

| Werkzeug | Was es tut | Wo | Quelle |
|---|---|---|---|
| Video (in CMS) | Video von YouTube, Vimeo oder eigenem Hosting in CMS-Detailseiten einbetten, oder direkt ins CMS hochladen | CMS-Feld / formatiertes Textfeld | https://www.framer.com/help/articles/how-to-add-video-components-to-your-cms-pages/ (laut WebSearch-Zusammenfassung dieser offiziellen Seite) |
| Embed-Komponente | Fremde HTML-Skripte/Codes (z. B. externe Formularanbieter wie Beehiiv, Tally) per Copy-Paste in eine Embed-Komponente einbinden | Insert-Panel | Aggregierte WebSearch-Zusammenfassung zu „Adding a contact form" (offizielle Framer-Hilfe: https://www.framer.com/help/articles/how-can-i-add-a-contact-form-to-my-framer-website/) |

### B6) Components

| Werkzeug | Was es tut | Wo | Quelle |
|---|---|---|---|
| Components | Erlaubt, jede auf dem Canvas erstellte Komponente direkt in Inhalte einzufügen — z. B. animierte Galerien, interaktive Embeds, Newsletter-Anmeldungen | Insert-Panel | WebSearch-Zusammenfassung mit Bezug auf Framer-Updates „CMS Components" (https://www.framer.com/updates/cms-components) |
| CMS-Komponenten-Menü | Beim Bearbeiten eines CMS-Elements erscheint ein Menü mit Standardblöcken (Bilder, Videos) sowie einem Bereich für Projekt-Komponenten, organisiert wie das Assets-Panel | Innerhalb der CMS-Item-Bearbeitung | WebSearch-Zusammenfassung, Bezug https://www.framer.com/updates/cms-components |

### B7) CMS Collection Lists

| Werkzeug | Was es tut | Wo | Quelle |
|---|---|---|---|
| Collection List | Eine Collection (Datenbank für Inhalte wie Blogbeiträge) als Liste in die Seite einfügen; Elemente innerhalb der Liste erhalten automatisch Zugriff auf die Feldinhalte der Collection | Insert-Panel → Abschnitt „Collection Lists" | WebSearch-Zusammenfassung mit Bezug auf offizielle Framer-Academy-Lektionen zu CMS Collections (https://www.framer.com/academy/lessons/understanding-cms-collections-items-fields, https://www.framer.com/academy/lessons/creating-cms-collection-lists) |

### B8) Forms & Fields

| Werkzeug | Was es tut | Wo | Quelle |
|---|---|---|---|
| Native Forms | Formular-Komponente zum Sammeln von Besucherdaten; Felder, Styling und Absende-Einstellungen anpassbar | Insert-Panel → „Forms" | WebSearch-Zusammenfassung offizieller Framer-Hilfe (https://www.framer.com/help/articles/how-can-i-add-a-contact-form-to-my-framer-website/) |
| Eingebaute Formular-Integrationen | Anbindung an Formspark, Calendly, HubSpot, Intercom, Typeform | Formular-Eigenschaftenpanel | Dieselbe Quelle wie oben |
| Input-Komponente | E-Mail-Anmeldungen erfassen, Anbindung an Loops.so, Mailchimp, Formspark, GetWaitlist | Insert-Panel | Dieselbe Quelle wie oben |

### B9) Icons / Iconify

| Werkzeug | Was es tut | Wo | Quelle |
|---|---|---|---|
| Iconify (Marketplace-Komponente) | Zugriff auf über 150.000 Icons aus mehr als 100 Icon-Sets (Material Design, Phosphor, Lucide, Remix, Carbon, Bootstrap, Tabler, Font Awesome, Heroicons u. a.) mit Live-Vorschau direkt auf dem Canvas | Über Framer Marketplace/Community installierbare Komponente, danach im Insert-Panel/Assets verfügbar | https://www.framer.com/marketplace/plugins/iconify/ |

### B10) Assets

Keine offizielle Framer-Quelle mit Volltext zum Assets-Panel selbst konnte in
dieser Sitzung geladen werden (die Dictionary-Seite `framer.com/dictionary/
toolbar` lieferte 404). Aus dem CMS-Components-Kontext (B6) geht hervor, dass
das Assets-Panel eine Ordnerstruktur besitzt, die im CMS-Komponenten-Menü
gespiegelt wird — das ist der einzige belegte Fakt dazu. Weiteres zu Assets
siehe „Unbelegt".

### B11) Templates / Sections / Pages (Layouts-Bibliothek)

| Werkzeug | Was es tut | Wo | Quelle |
|---|---|---|---|
| Sections (Insert-Menü) | Fügt vorgefertigte, minimal gestylte Header, Footer und gängige Layouts ein; das Insert-Menü bleibt beim Einfügen offen und zoomt automatisch, sodass Seiten in einer Ansicht komponiert werden können; Seiten werden bei Bedarf automatisch in einen Stack mit Auto-Height umgewandelt | Insert-Panel → „Sections" | https://www.framer.com/updates/sections |
| Pages (Insert 2.0) | 14 einfügbare Seiten-Vorlagen für gängige Layouts (Landingpages, Portfolios, Teaser); minimal gestylt, vollständig anpassbar; per Klick aus dem Insert-Panel einfügbar | Insert-Panel → „Pages" | https://www.framer.com/updates/insert-pages |
| Layout-Templates (Eigenschaftenpanel) | Wiederverwendbare Layout-Vorlagen für sich wiederholende Elemente wie Navigation, Footer, Ankündigungsbanner; zuweisbar/änderbar über den Bereich „Template" im Eigenschaftenpanel | Eigenschaftenpanel (rechts), nicht das Insert-Menü selbst | WebSearch-Zusammenfassung mit Bezug auf https://www.framer.com/help/articles/using-layout-templates/ |
| Add-Section-Button | Schneller Zugriff, um weitere Sections hinzuzufügen | Toolbar/Insert-Kontext | https://www.framer.com/updates/insert-pages |
| Bild-Platzhalter für leere Ebenen | Neue Funktion im Zuge von Insert 2.0 | Insert-Panel-Workflow | https://www.framer.com/updates/insert-pages |

### B12) Pages (Seitenverwaltung)

Keine eigene, per Volltext bestätigte offizielle Quelle zur Seiten-Navigation
(„Pages"-Tab im linken Panel) konnte in dieser Sitzung geladen werden über die
gezielt versuchte URL `framer.com/dictionary/toolbar` (404). Siehe „Unbelegt".

### B13) Zoom-Menü, Breakpoints, Preview, Publish

| Werkzeug | Was es tut | Wo | Quelle |
|---|---|---|---|
| Zoom-Menü | Zoom-Prozent-Dropdown; Standard 100 %; Schnellzugriffe zum Vergrößern/Verkleinern bzw. Anpassen an Auswahl/Prozentwert | Rechte Seite der (unteren) Toolbar | https://www.framer.com/help/articles/how-to-use-the-canvas/ sowie WebSearch-Zusammenfassung |
| Breakpoints | Layouts für verschiedene Bildschirmgrößen (Desktop, Tablet, Mobile) optimieren; pro Breakpoint unabhängig anpassbar; Wechsel zwischen Breakpoints direkt im Editor | Toolbar oben / eigener Breakpoints-Bereich | WebSearch-Zusammenfassung mit Bezug auf https://www.framer.com/academy/lessons/framer-fundamentals-breakpoints |
| Toolbar (allgemein) | Enthält u. a. Preview, Publish, Undo/Redo sowie den Breakpoint-Umschalter | Oben im Editor | WebSearch-Zusammenfassung offizieller Framer-Inhalte |

### B14) Plugins

| Werkzeug | Was es tut | Wo | Quelle |
|---|---|---|---|
| Plugin-Menü/-Marketplace | Kleine Apps, die mit dem Editor interagieren: Bilder, Ebenen oder Code-Komponenten einfügen, Canvas-Inhalte verändern; können eine eigene UI in einem schwebenden Plugin-Fenster zeigen oder ohne UI direkt wirken; Marketplace bietet 30+ Plugins (Kreativ-Tools, CMS-Integrationen, Produktivität) | Neues „Plugin-Menü" im Projekt-Toolbar; Installation auch über Plugin-Symbol in der linken Seitenleiste | https://www.framer.com/updates/plugins sowie WebSearch-Zusammenfassung |
| Framer Community (seit Framer 3.0) | Templates, Plugins und Komponenten sind in die neue „Framer Community" integriert; durchsuch- und einfügbar, ohne Framer zu verlassen | Innerhalb des Editors verlinkt | WebSearch-Zusammenfassung (keine Primärseite direkt geladen) |

### B15) AI / Wireframer

| Werkzeug | Was es tut | Wo | Quelle |
|---|---|---|---|
| Wireframer | KI-Layout-Generator: erzeugt aus einer Text-Eingabe ein bearbeitbares, responsives Wireframe direkt auf dem Canvas; Fokus auf Struktur statt Stil, voll editierbar; für alle Nutzer ohne Beta-Zugang verfügbar (seit Mai 2025) | Chat-Eingabefeld im Editor | WebSearch-Zusammenfassung mit Bezug auf https://www.framer.com/dictionary/wireframer und https://www.framer.com/updates/wireframer (Ankündigung: businesswire.com, 21.05.2025) |

Hinweis: Der direkte WebFetch von `framer.com/dictionary/wireframer` scheiterte
mit HTTP 404 in dieser Sitzung (möglicherweise clientseitiges Routing); der
Inhalt liegt daher nur als WebSearch-Zusammenfassung vor, nicht als
Original-Volltext.

### B16) Localization-Umschalter

| Werkzeug | Was es tut | Wo | Quelle |
|---|---|---|---|
| Localization-Ansicht | Sprachen/Regionen für die Website verwalten; neue Locale hinzufügen, Standard-/Fallback-Sprache festlegen | Menü oben links → „Localization" | WebSearch-Zusammenfassung mit Bezug auf https://www.framer.com/help/localization/ |
| Automatic Locale | Leitet Besucher anhand von Browsersprache/Geräte-Zeitzone automatisch auf die passende Sprachversion | Einstellung innerhalb Localization-Ansicht | https://www.framer.com/help/articles/how-does-automatic-locale-work/ (laut WebSearch-Zusammenfassung) |
| Auto Translate / KI-Übersetzung | Inhalte automatisch über alle Locales hinweg übersetzt halten; „AI Style" steuert den Übersetzungston | Localization-Ansicht | WebSearch-Zusammenfassung mit Bezug auf https://www.framer.com/help/localization/ |
| Language Switcher (Marketplace-Komponente) | Fertige Sprach-Umschalter-Komponente, arbeitet mit der Framer-Localization zusammen, unterstützt mehrere Sprachen/Flaggen, Styling über das rechte Eigenschaftenpanel | Insert-Panel / Marketplace-Komponente | https://www.framer.com/community/marketplace/components/language-switcher/ (laut WebSearch-Zusammenfassung) |

### B17) Comments / Share/Invite

Für „Comments" als Framer-Editor-Feature (Kommentare direkt im Canvas, nicht
zu verwechseln mit dem unternehmensfremden Produkt „Frame.io") konnte in
dieser Sitzung KEINE offizielle Framer-Quelle gefunden werden — die
Web-Suche lieferte ausschließlich Treffer zu Frame.io (einem anderen,
gleichnamigen Adobe-Produkt für Video-Feedback) oder zu einer
Community-Komponente „Comments Section" für veröffentlichte Websites (also
ein Website-Frontend-Baustein, kein Editor-Werkzeug). Als „Unbelegt" geführt.

Für „Share/Invite" (Mitarbeiter einladen) liegt nur der indirekte Beleg aus
den Quick Actions vor (siehe A2/B13: „Invite collaborators" wird als
Quick-Action-Fähigkeit genannt) — https://www.framer.com/updates/quick-actions.

---

## Unbelegt (Vermutungen ohne belastbare Quelle)

Diese Punkte wurden in der Aufgabenstellung erwartet, konnten aber in dieser
Recherche-Sitzung NICHT durch eine ladbare, primäre oder zumindest
eindeutig-offizielle Sekundärquelle belegt werden. Sie sind Vermutungen bzw.
unverifizierte Fragmente und dürfen nicht als gesichert gelten:

- Eigenständige Vektor-Werkzeuge „Pen", „Rectangle", „Oval", „Path", „Boolean"
  als benannte Buttons im HEUTIGEN Insert-Menü (nur für das alte Framer X
  1:1 belegt, siehe A4).
- Genaue Tastenkürzel für Frame/Stack/Grid/Text/Vector im heutigen Editor
  (F/S/G/T als Zahlen kursieren in mehreren Sekundärquellen übereinstimmend,
  aber ohne primäre Bestätigung durch framer.com/shortcuts selbst in dieser
  Sitzung).
- Vollständiger Inhalt des „Assets"-Panels (Struktur, Dateitypen, Limits).
- „Pages"-Tab/-Panel als eigene Seitenverwaltung (Struktur, Unterseiten,
  Ordner) — nur indirekt über Insert-Pages-Templates (B11) berührt, nicht
  über die Seiten-Navigation selbst.
- Ein Editor-internes Kommentarsystem („Comments" als Canvas-Feature analog zu
  Figma) — nicht auffindbar; möglich, dass es dieses Feature in Framer in
  dieser Form nicht gibt (nicht verifiziert, weder positiv noch negativ).
- Vollständige, kategorisierte Kürzelliste für Canvas, Layers, Inspector,
  Text, Tools, View, Insert aus der Primärquelle framer.com/shortcuts — die
  Seite ist eine JS-Anwendung; ohne echten Browser mit aktivem JavaScript
  (z. B. laufendes Chrome mit Debug-Port) ließ sie sich in dieser Sitzung
  nicht vollständig auslesen.
- Genaue Namen/Funktionsumfang eines „Zoom-Menüs" als Dropdown mit
  festgelegten Prozentstufen (z. B. 50/100/200 %) — nur die grobe Beschreibung
  „Zoom-Prozent-Dropdown" ist belegt, keine Liste der Stufen.

## Empfehlung für lückenlose Erfassung

Um Teil A vollständig und Teil B lückenlos für Vektor-Werkzeuge/Assets/Pages
zu belegen, müsste `framer.com/shortcuts` und ein laufendes Framer-Editor-
Projekt in einem echten Browser mit aktivem JavaScript geöffnet werden (z. B.
über den in diesem Repo vorgesehenen Weg: eigenes Chrome-Profil mit
`--remote-debugging-port=9222`, dann `chrome-devtools`-MCP oder
`scripts/diagnose/chrome-lesen.mjs`). In dieser Recherche-Sitzung war kein
Chrome-Prozess mit Debug-Port aktiv, weshalb ausschließlich WebSearch/WebFetch
zum Einsatz kam.
