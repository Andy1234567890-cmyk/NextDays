# Framer-Editor — linkes Panel: Pages · Assets · Insert · Templates · Seitenstruktur (Recherche 05.09.2026)

Vollständige Funktionsliste aus offizieller Framer-Doku (`framer.com/help`,
`framer.com/academy`, `framer.com/updates`, `framer.com/dictionary`,
`framer.com/shortcuts`) plus punktuell belegte Drittquellen, wo die
offizielle Doku selbst darauf verweist oder sie Framer-Release-Inhalte
1:1 wiedergeben (gekennzeichnet). Kein Fließtext — nur Tabellen, je Nr.
mit Quelle. Was nicht belegt werden konnte, ist als „unbelegt" markiert
oder ausgelassen.

Nummerierung: **P** = Pages-Panel, **A** = Assets-Panel, **I** = Insert-Menü,
**T** = Templates, **S** = Seitenstruktur.

---

## P — Pages-Panel

| Nr | Funktion | Wo in Framer (Panel/Menü/Kürzel) | Quelle (URL) | Beschreibung in einem Satz |
|---|---|---|---|---|
| P1.1 | Seite anlegen über „+" | Pages-Panel, „+"-Button | https://www.framer.com/help/articles/how-to-use-pages/ | Klick auf „+" im Pages-Panel öffnet die Auswahl des Seitentyps. |
| P1.2 | Seitentyp „New Page" (Web Page) | „+"-Menü im Pages-Panel | https://www.framer.com/help/articles/how-to-use-pages/ , https://janeui.com/articles/pages-in-framer | Der Basis-Seitentyp ohne CMS-Anbindung, Inhalt komplett auf der Fläche gestaltet. |
| P1.3 | Seitentyp „New CMS Page" | „+"-Menü im Pages-Panel, auch je Collection über „+" neben „Pages" | https://www.framer.com/help/articles/how-do-i-add-another-cms-collection-in-a-cms-detail-page/ , https://janeui.com/articles/pages-in-framer | Automatisch aus einer CMS-Collection generierte Detailseiten-Vorlage („einmal gestalten, je Inhalt variieren"). |
| P1.4 | Seitentyp „Design Page" | „+"-Menü im Pages-Panel | https://www.framer.com/help/articles/how-to-use-pages/ | Private, nicht veröffentlichte Fläche für Mockups, Social-Grafiken, Entwürfe und Experimente. |
| P1.5 | Seitentyp „New 404 Page" | „+"-Menü im Pages-Panel | https://www.framer.com/help/articles/creating-a-custom-not-found-404-page/ | Framer legt die Seite an und weist sie automatisch als projektweite 404-Seite zu. |
| P1.6 | Home-Seite unlöschbar | Pages-Panel | https://www.framer.com/help/articles/how-to-use-pages/ | Die Home-Seite ist die primäre Einstiegsseite des Projekts und kann nicht gelöscht werden. |
| P1.7 | Seite umbenennen | Doppelklick auf den Seitennamen im Pages-Panel | https://www.framer.com/help/articles/how-to-use-pages/ | Doppelklick auf den Namen öffnet das Umbenennen-Feld. |
| P1.8 | Automatische Slug-Ableitung beim Umbenennen | Pages-Panel | https://www.framer.com/help/articles/how-to-use-pages/ | Framer wandelt Seitennamen automatisch in gültige URL-Pfade um, ein „/" muss nicht manuell ergänzt werden. |
| P1.9 | URL/Slug manuell anpassen | Drei-Punkte-Menü je Seite → URL bearbeiten | https://www.framer.com/help/articles/how-to-use-pages/ | Im Kontextmenü lässt sich die Seiten-URL gezielt anpassen statt sie aus dem Namen abzuleiten. |
| P1.10 | Seite duplizieren (inkl. Inhalt) | Drei-Punkte-Menü bzw. Rechtsklick → „Duplicate" | https://www.framer.com/help/articles/how-to-use-pages/ | Dupliziert die Seite samt ihrem gesamten Inhalt. |
| P1.11 | Seite löschen | Drei-Punkte-Menü bzw. Rechtsklick → „Delete" | https://www.framer.com/help/articles/how-to-use-pages/ | Entfernt die Seite (außer Home) aus dem Projekt. |
| P1.12 | Kontextmenü per Hover/Rechtsklick | Pages-Panel, Drei-Punkte-Icon beim Überfahren einer Seite | https://www.framer.com/help/articles/how-to-use-pages/ | Beim Überfahren einer Zeile erscheint das Drei-Punkte-Menü mit den Seitenoptionen. |
| P1.13 | Seiten per Ziehen sortieren/verschachteln | Pages-Panel, Drag & Drop | https://www.framer.com/help/articles/how-to-use-pages/ | Ziehen einer Seite legt fest, wo sie in der Seitenstruktur erscheint, inklusive Verschachtelung als Dropdown-Eintrag unter einer anderen Seite. |
| P1.14 | Seiten übereinander ziehen = Verschachtelung/Nesting | Pages-Panel, Drag & Drop | https://www.framer.com/updates/december-update-2023 | Seiten werden aufeinandergezogen, um sie hierarchisch zu verschachteln; die URLs der Unterseiten werden automatisch an den übergeordneten Pfad angepasst. |
| P1.15 | Ordner im Pages-Panel anlegen | Pages-Panel, „+"-Icon → „New Folder" | https://www.framer.com/updates/december-update-2023 | Ordner gruppieren Seiten unter einem gemeinsamen Pfadsegment, auch mehrstufig verschachtelbar. |
| P1.16 | Ordner-Umbenennung ändert alle enthaltenen Pfade | Pages-Panel, Ordner umbenennen | https://www.framer.com/updates/december-update-2023 | Umbenennen eines Ordners aktualisiert die Pfade aller enthaltenen Seiten in einem Schritt (Batch-Pfadänderung). |
| P1.17 | Vereinheitlichtes Pages-Panel (alle Seitentypen in einer Hierarchie) | Pages-Panel | https://www.framer.com/updates/unified-pages | CMS-Seiten erscheinen jetzt verschachtelt unter ihrer jeweiligen Index-Seite, statt als getrennte Kategorie. |
| P1.18 | Neue CMS-Seite über Top-Level-Menü statt Scrollen | Pages-Panel, oberes „+"-Menü | https://www.framer.com/updates/unified-pages | Bei großen Seitenzahlen lässt sich eine neue CMS-Seite direkt aus dem oberen Menü anlegen, ohne die lange Liste zu durchscrollen. |
| P1.19 | Design/Canvas-Seiten standardmäßig ausgeblendet | Pages-Panel, Einstellungen/Preferences | https://www.framer.com/updates/unified-pages | In neuen Projekten sind Canvas-/Design-Seiten per Default verborgen, einblendbar über die Präferenzen. |
| P1.20 | Mehrfachauswahl von Seiten | Pages-Panel | https://www.framer.com/updates/september-update-2025 | Mehrere Seiten lassen sich gleichzeitig markieren, um Sammel-Aktionen auszuführen. |
| P1.21 | Mehrere Seiten gleichzeitig verschieben/Pfad ändern | Pages-Panel, Mehrfachauswahl | https://www.framer.com/updates/september-update-2025 | Verschieben und Pfadänderung lassen sich auf mehrere ausgewählte Seiten zugleich anwenden. |
| P1.22 | Mehrere Seiten duplizieren/als Entwurf markieren/entwurfsfrei machen/löschen | Pages-Panel, Mehrfachauswahl | https://www.framer.com/updates/september-update-2025 | „Duplicate, draft, un-draft und delete" lassen sich in einem Schritt auf mehrere markierte Seiten anwenden. |
| P1.23 | Entwurfsstatus einer Seite („Draft"/„Un-draft") | Pages-Panel, Kontextmenü bzw. Mehrfachauswahl-Aktion | https://www.framer.com/updates/september-update-2025 | Eine Seite lässt sich als Entwurf markieren (nicht live) oder der Entwurfsstatus wieder aufheben. |
| P1.24 | Ordner für Design-Pages | Pages-Panel, Design-Pages-Bereich | https://www.framer.com/updates/design-page-folders | Verwandte Entwürfe/Experimente lassen sich in Ordnern gruppieren, u. a. für Icons, Favicons, Social-Bilder, Mockups. |
| P1.25 | Seitentitel (Page Title) je Seite | Page Settings im linken/rechten Panel | https://www.framer.com/help/articles/how-to-update-page-titles-descriptions-and-social-images/ | Individueller Titel je Seite, der den globalen Site-Titel überschreibt, inkl. CMS-Variablen wie `{{Title}}`. |
| P1.26 | Seitenbeschreibung (Page Description) je Seite | Page Settings | https://www.framer.com/help/articles/how-to-update-page-titles-descriptions-and-social-images/ | Individuelle Meta-Description je Seite, ebenfalls mit CMS-Variablen möglich. |
| P1.27 | Social-Preview-Bild je Seite (Open Graph) | Page Settings → Social preview | https://www.framer.com/help/articles/how-to-update-page-titles-descriptions-and-social-images/ | Bild im Format 1200×630 px für die Vorschau beim Teilen; bei CMS-Seiten per CMS-Variable aus einem Bildfeld wählbar. |
| P1.28 | Suchmaschinen-Indexierung je Seite steuern | Page Settings | https://www.framer.com/help/articles/how-to-update-page-titles-descriptions-and-social-images/ | Schalter, ob die Seite in Suchmaschinen erscheinen darf. |
| P1.29 | 404-Seite live testen | veröffentlichte Site, beliebige nicht existierende URL | https://www.framer.com/help/articles/creating-a-custom-not-found-404-page/ | Aufruf einer nicht existierenden URL auf der publizierten Domain zeigt die zugewiesene 404-Seite statt Framers Standardfehler. |
| P1.30 | Lokalisierte Seitenpfade (Translate Page Paths) | Settings → Localization View, Schalter „Translate Page Paths" | https://www.framer.com/updates/localized-page-paths | Übersetzt die Pfade ganzer Seiten (nicht nur CMS-Slugs) je Sprache, mit Konflikterkennung gegen doppelte Pfade. |
| P1.31 | Sprachumschalter je Seite im Seitenpanel | Canvas, Locale-Umschalter im Seitenpanel (bei mehreren Sprachen) | https://www.framer.com/updates/localized-page-paths | Erscheint ein zweiter/weiterer Locale, kann der Seitenname/-pfad direkt je Sprache umbenannt werden. |
| P1.32 | Seiten und Übersetzungsstrings in der Localization-Tabelle je Seite gruppiert | Localization View | https://www.framer.com/help/articles/adding-a-new-locale/ | Alle Textstrings (Titel, Beschreibungen, Alt-Texte) werden nach Seite organisiert in der Tabelle angezeigt. |
| P1.33 | Redirects (Weiterleitungen) alte URL → neue URL | Site Settings → Hosting → Redirects | https://www.framer.com/help/articles/how-to-setup-redirects-to-maintain-seo-ranking/ | Zwei Eingabefelder (alte/neue URL) legen eine dauerhafte Weiterleitung fest. |
| P1.34 | Redirects mit Wildcards (`*`, Segment-Erfassung) | Site Settings → Hosting → Redirects | https://www.framer.com/help/articles/how-to-setup-redirects-to-maintain-seo-ranking/ | `*` matcht beliebige Pfadsegmente, z. B. `/blog/*` erfasst alle Unterpfade von `/blog/`. |
| P1.35 | Redirects per Ziehen priorisieren | Site Settings → Hosting → Redirects | https://www.framer.com/help/articles/how-to-setup-redirects-to-maintain-seo-ranking/ | Reihenfolge der Regeln per Drag & Drop, bestimmt welche Regel zuerst zieht. |
| P1.36 | Redirects bearbeiten/löschen | Site Settings → Hosting → Redirects, „…"-Menü | https://www.framer.com/help/articles/how-to-setup-redirects-to-maintain-seo-ranking/ | Über das „…"-Menü je Regel editieren oder entfernen. |
| P1.37 | Passwortschutz einzelner Seiten — kein Bordmittel | — | https://www.framer.com/academy/lessons/password-protection , https://www.framer.community/c/requests/password-protection-of-individual-pages | Framer besitzt laut Community/Marketplace-Lage keinen nativen Passwortschutz je Seite; Lösung nur über Marketplace-Plugins/-Komponenten (unbelegt als natives Feature). |
| P1.38 | CMS-Detailseite: weitere Collection per Insert-Menü ergänzen | Insert-Menü → „Collection Lists" auf einer CMS-Detailseite | https://www.framer.com/help/articles/how-do-i-add-another-cms-collection-in-a-cms-detail-page/ | Eine zweite CMS-Collection lässt sich zusätzlich zum primären CMS-Item auf derselben Detailseite anzeigen. |
| P1.39 | Bedingte Sichtbarkeit von Elementen nach CMS-Inhalt | CMS-Seite, Sichtbarkeits-Bedingung am Element | https://www.framer.com/help/cms/ | Elemente lassen sich abhängig vom CMS-Feldwert ein-/ausblenden. |
| P1.40 | Dynamische Filter auf CMS-Listen (Suche, Tabs, Toggles, Dropdowns) | CMS-Listenseite | https://www.framer.com/help/cms/ | CMS-Listen lassen sich über Sucheingabe, Reiter, Schalter oder Dropdown filtern. |

## A — Assets-Panel

| Nr | Funktion | Wo in Framer (Panel/Menü/Kürzel) | Quelle (URL) | Beschreibung in einem Satz |
|---|---|---|---|---|
| A1.1 | Bilder hochladen (PNG, JPG, WebP, AVIF, GIF) | Assets-Panel, Upload/Drag & Drop | https://www.framer.com/help/articles/how-are-images-optimized-in-framer/ , https://framerwebsites.com/blog/framer-asset-library-guide | Bilder lassen sich per Drag & Drop auf die Fläche oder ins Assets-Panel hochladen. |
| A1.2 | Automatische Bildoptimierung nach Upload | Assets-Panel | https://www.framer.com/help/articles/how-are-images-optimized-in-framer/ | Framer erzeugt für jedes hochgeladene JPEG/PNG/WebP/GIF automatisch größenangepasste Varianten. |
| A1.3 | Auflösung „Auto" für responsive Bildgrößen | Fill → Image → Resolution: Auto | https://www.framer.com/help/articles/how-are-images-optimized-in-framer/ | Lässt Framer die passende Bildgröße je Bildschirm automatisch wählen. |
| A1.4 | Videos hochladen (MP4/H.264 empfohlen) | Assets-Panel, Upload | https://www.framer.com/help/articles/how-are-videos-optimized-in-framer/ | Empfohlenes Format H.264/`.mp4`; unveränderte Auflösung wird ausgeliefert (kein automatisches Downscaling). |
| A1.5 | Video-Poster-Bild für Optimierung/SEO | Video-Komponente, Assets → Components | https://www.framer.com/help/articles/how-are-videos-optimized-in-framer/ | Jedes Video benötigt ein Poster-Bild, damit Framers Video-Optimierungen greifen und die SEO verbessert wird. |
| A1.6 | SVG-Import über Frame mit Bildfüllung | Canvas: Frame anlegen → Fill → Image → SVG wählen | https://www.framer.com/help/articles/how-are-images-optimized-in-framer/ | SVGs werden durch Anlegen eines Frames und Zuweisen als Bildfüllung eingebunden. |
| A1.7 | Ordner im Assets-Panel | Assets-Panel | https://framerwebsites.com/blog/framer-asset-library-guide | Ordner lassen sich anlegen, Dateien lassen sich zwischen Ordnern verschieben, Umbenennung inline. |
| A1.8 | Sortierung nach Dateigröße | Assets-Panel | https://framerwebsites.com/blog/framer-asset-library-guide | Sortierung nach Größe hilft, die zehn schwersten Dateien zu identifizieren. |
| A1.9 | Schriften: Google-Fonts-Katalog | Typografie-Panel, Font-Picker | https://www.framer.com/help/articles/site-optimization/ | Der komplette Google-Fonts-Katalog ist direkt im Font-Picker verfügbar, inkl. automatischer Gewichte/Subsets. |
| A1.10 | Eigene Schriften hochladen (WOFF/WOFF2) | Font-Panel, Upload | https://www.framer.com/help/articles/site-optimization/ , https://framerwebsites.com/blog/framer-asset-library-guide | WOFF/WOFF2-Dateien lassen sich hochladen und benennen, verhalten sich danach wie Google Fonts im Picker. |
| A1.11 | Farbstile (Color Styles) anlegen | Assets-Panel → Styles → „+" → Color | https://www.framer.com/academy/lessons/framer-fundamentals-styles , https://framerwebsites.com/blog/framer-asset-library-guide | Farbtoken mit Hell-/Dunkel-Thema lassen sich anlegen und projektweit verwenden. |
| A1.12 | Farbstile projektweit aktualisieren | Assets-Panel → Styles | https://framerwebsites.com/blog/framer-asset-library-guide | Ändern eines Farbstil-Werts aktualisiert sofort jedes Element, das ihn nutzt (Hintergrund, Text, Buttons, Rahmen). |
| A1.13 | Textstile (Text Styles) anlegen | Assets-Panel → Styles → „+" → Text | https://www.framer.com/help/articles/how-to-use-text-styles/ | Wiederverwendbare Typografie-Einstellungen (Schrift, Größe, Zeilenhöhe, Farbe) für Überschriften/Absätze. |
| A1.14 | Textstile bearbeiten (Edit-Style-Dialog, je Breakpoint) | Assets-Panel → Styles, Textstil öffnen | https://www.framer.com/help/articles/how-to-use-text-styles/ | Schriftgröße, Zeilenhöhe, Buchstaben-/Absatzabstand je Breakpoint (Desktop L, Tablet M, Mobile S) konfigurierbar. |
| A1.15 | Textstile anwenden | Rechtes Panel → Text → Styles | https://www.framer.com/help/articles/how-to-use-text-styles/ | Ausgewähltem Text-Layer wird ein vorhandener Textstil aus einer Auswahlliste zugewiesen. |
| A1.16 | Textstil entfernen | Rechtes Panel → Text → Styles, „×" | https://www.framer.com/help/articles/how-to-use-text-styles/ | Ein „×" neben dem angewendeten Stil entfernt die Zuweisung wieder. |
| A1.17 | Umbenennen/Löschen von Stilen | Assets-Panel → Styles | https://www.framer.com/help/articles/how-to-use-text-styles/ | Stile lassen sich im Assets-Panel umbenennen oder löschen; Änderungen wirken überall, wo der Stil verwendet wird. |
| A1.18 | Link-Zustände in Textstilen (hover/active/current) | Assets-Panel → Styles, Textstil | https://www.framer.com/help/articles/how-to-use-text-styles/ | Textstile können unterschiedliche Zustände für Links definieren (hover, active, current). |
| A1.19 | Komponenten im Assets-Panel | Assets-Panel → Components | https://framerwebsites.com/blog/framer-asset-library-guide , https://www.framer.com/academy/lessons/sharing-components | Komponenten leben als eigene Kategorie im Assets-Panel und lassen sich in Ordnern organisieren. |
| A1.20 | Komponenten-Instanz einfügen | Assets-Panel → Components, per Drag oder ⌘K | https://uxdesign.cc/heres-the-clear-cut-way-to-build-a-component-in-framer-cbd0cf719995 | Eine Instanz lässt sich aus dem Assets-Panel, per Quick-Actions (⌘K) oder durch Ersetzen einer bestehenden Ebene einfügen. |
| A1.21 | Ordner-Namenskonvention für Komponenten via „/" | Assets-Panel → Components, Namensschema „Ordner/Name" | https://www.framer.com/academy/lessons/framer-fundamentals-components | Ein Schrägstrich im Komponentennamen (z. B. „Buttons/ Primary CTA") erzeugt automatisch eine Ordnerstruktur im Panel. |
| A1.22 | Komponente einfügen/bearbeiten/umbenennen/duplizieren/löschen aus dem Assets-Menü | Assets-Panel → Components, Kontextmenü | https://www.framer.com/academy/lessons/framer-fundamentals-components | Die Standardaktionen für Komponenten stehen direkt im Assets-Panel-Menü zur Verfügung. |
| A1.23 | Vektor-Sets (Icon-Bibliotheken) im Assets-Panel | Assets-Panel → Vector Sets | https://www.framer.com/help/articles/how-to-add-icons/ , https://www.framer.com/updates/vector-updates | Vektor-Sets bündeln Icon-Gruppen mit visueller Vorschau, durchsuchbar nach Namen. |
| A1.24 | Eingebaute Icon-Bibliotheken (Phosphor, Feather, Meteor, Basicons, Lucide) | Assets-Panel → Vector Sets | https://www.framer.com/updates/vector-updates | Framer liefert mehrere fertige Icon-Sets direkt mit, inkl. Stroke-Width- und Duotone-Varianten. |
| A1.25 | Icons als Variablen (Stroke Width) | Assets-Panel → Vector Sets, Variablen | https://www.framer.com/updates/vector-updates | Eigenschaften wie Strichstärke lassen sich in eigenen Icon-Sets als Variable steuern. |
| A1.26 | Code-Dateien / Code Components | Assets-Panel → Code → New File | https://framerwebsites.com/blog/framer-asset-library-guide , https://segmentui.com/learn/framer-code-components-and-code-override-masterclass | Öffnet Framers eingebauten Code-Editor für React/TypeScript; die fertige Komponente erscheint im Assets-Panel und ist wie ein visueller Baustein einsetzbar. |
| A1.27 | Code Overrides im Assets-/Eigenschaften-Panel | Rechtes Panel → Code Overrides, „+" | https://segmentui.com/learn/framer-code-components-and-code-override-masterclass | Eine neue Override-Datei lässt sich anlegen und einer ausgewählten Ebene zuweisen. |
| A1.28 | Mehrfachauswahl im Assets-Panel | Assets-Panel | https://www.framer.com/updates/september-update-2025 | Mehrfachauswahl vereinfacht die Organisation von Components, Styles und Vector Sets. |
| A1.29 | Mehrere Komponenten gleichzeitig auf die Fläche ziehen | Assets-Panel, Mehrfachauswahl | https://www.framer.com/updates/september-update-2025 | Mehrere markierte Komponenten lassen sich in einem Zug auf die Fläche ziehen. |
| A1.30 | Vector-Set-Link kopieren | Assets-Panel → Vector Sets | https://www.framer.com/updates/september-update-2025 | Ein Link auf ein Vektor-Set lässt sich kopieren und teilen. |
| A1.31 | Schnellere Asset-Suche | Assets-Panel, Suchfeld | https://www.framer.com/updates/september-update-2025 | Die Suchleistung im Assets-Panel wurde verbessert. |

## I — Insert-Menü

| Nr | Funktion | Wo in Framer (Panel/Menü/Kürzel) | Quelle (URL) | Beschreibung in einem Satz |
|---|---|---|---|---|
| I1.1 | Insert-Panel öffnen | Linkes Panel, Reiter „Insert"/„+" | https://www.framer.com/dictionary/insert-panel | Zentrales Panel zum Hinzufügen von Elementen, Komponenten, Sektionen und Assets zu einer Seite. |
| I1.2 | Insert-Menü als Schnellzugriff | Kontext-/Werkzeugleiste | https://www.framer.com/dictionary/insert-menu | Bietet schnellen Zugriff, um neue Elemente wie Text, Formen, Bilder und Komponenten hinzuzufügen. |
| I1.3 | Slash-Befehle („/" tippen fügt ein) | Canvas, „/" tippen | https://www.framer.com/dictionary/insert-menu | Ein „/"-Tastendruck öffnet ebenfalls eine schnelle Einfüge-Option für Elemente. |
| I1.4 | Insert 2.0: neu gestaltetes Insert-Panel | Insert-Panel | https://www.framer.com/updates/insert-pages | Grundlegend überarbeitetes Panel, das Seiten-Vorlagen direkt einfügbar macht. |
| I1.5 | 14 neue einfügbare Seiten-Vorlagen (Pages) | Insert-Panel → Pages | https://www.framer.com/updates/insert-pages | 14 neue vollständige Einzelseiten-Layouts für gängige Zwecke wie Landingpages, Portfolios, Teaser. |
| I1.6 | Sektionen (Sections) im Insert-Panel, überarbeitet | Insert-Panel → Sections | https://www.framer.com/updates/insert-pages | Wiederverwendbare, modulare Abschnitts-Bausteine, in diesem Release aufgefrischt. |
| I1.7 | Minimal gestylte Vorlagen als Grundgerüst | Insert-Panel → Pages/Sections | https://www.framer.com/updates/insert-pages | Vorlagen sind bewusst schlicht gestaltet, um als anpassbare Grundlage zu dienen statt fertigen Stil vorzugeben. |
| I1.8 | „Add Section"-Button | Canvas/Insert-Panel | https://www.framer.com/updates/insert-pages | Eigener Button, um schnell eine weitere Sektion hinzuzufügen. |
| I1.9 | Bild-Platzhalter für leere Bild-Ebenen | Insert-Panel/Canvas | https://www.framer.com/updates/insert-pages | Leere Bild-Layer zeigen automatisch einen Platzhalter. |
| I1.10 | Insert-fokussiertes Onboarding für neue Projekte | Neues Projekt, App-Tour | https://www.framer.com/updates/insert-pages | Neue Projekte starten mit einer Einführung, die auf die Nutzung des Insert-Panels ausgerichtet ist. |
| I1.11 | Verbessertes Einfügen von CMS-Collections per Paste | Insert-Panel / Canvas, Paste-Workflow | https://www.framer.com/updates/insert-pages | Das Einfügen von CMS-Collection-Inhalten per Copy/Paste wurde überarbeitet. |
| I1.12 | Prebuilt Sections (Navigation, Hero, Pricing, Testimonials u. a.) | Insert-Panel → Sections | https://framebite.com/blog/how-to-add-pages-and-sections-to-framer-templates | Fertige Abschnitts-Bausteine von Navigationsleisten über Hero-Bereiche bis Preistabellen und Testimonial-Karussells. |
| I1.13 | Prebuilt Sections übernehmen nicht automatisch den Vorlagen-Stil | Insert-Panel → Sections | https://framebite.com/blog/how-to-add-pages-and-sections-to-framer-templates | Eingefügte Sektionen müssen nachträglich an den Stil des eigenen Templates angepasst werden. |
| I1.14 | Formen/Buttons als Insert-Elemente | Insert-Panel | https://framebite.com/blog/how-to-add-pages-and-sections-to-framer-templates | Formulare, Buttons und weitere UI-Standardelemente gehören zu den Insert-Kategorien. |
| I1.15 | Collection Lists im Insert-Menü | Insert-Menü → „Collection Lists" | https://www.framer.com/help/articles/how-do-i-add-another-cms-collection-in-a-cms-detail-page/ | Eigene Kategorie, um weitere CMS-Collections per Drag auf die Fläche zu ziehen. |
| I1.16 | Search-Komponente aus dem Insert-Panel | Insert-Panel → Search | https://www.framer.com/updates/site-search | Fertige Suchkomponente mit Fuzzy-Suche lässt sich direkt aus dem Insert-Panel auf die Seite ziehen. |
| I1.17 | Site-Search-Layouts (Quick Menu, Sidebar, Fixed Top) | Insert-Panel → Search, Eigenschaften | https://www.framer.com/updates/site-search | Drei Layout-Varianten für die eingefügte Suchkomponente. |
| I1.18 | Site-Search-Scope auf bestimmte Pfade begrenzen | Search-Komponente, Eigenschaften-Panel | https://www.framer.com/updates/site-search | Die Suche lässt sich auf bestimmte Bereiche der Site einschränken. |
| I1.19 | Komponenten-Erstellung aus Insert/Kontextmenü | Kontextmenü → „Create Component" bzw. ⌥⌘K (Mac) / ⌃⌥K (Windows) | https://uxdesign.cc/heres-the-clear-cut-way-to-build-a-component-in-framer-cbd0cf719995 | Ein ausgewähltes Element lässt sich per Rechtsklick oder Tastenkombination in eine Komponente umwandeln. |
| I1.20 | Vektor-Sets im Insert-Kontext (Icons einfügen) | Insert-Panel/Assets → Vector Sets | https://www.framer.com/help/articles/how-to-add-icons/ | Icons aus Vektor-Sets lassen sich per Drag & Drop aus dem Panel auf die Fläche ziehen. |
| I1.21 | Command-Palette / Quick Actions | ⌘K (Mac) / Ctrl+K (Windows) | https://www.framer.com/shortcuts , https://superfiles.in/framer-keyboard-shortcuts-list-for-designers-superfiles.php | Öffnet eine Befehlspalette mit durchsuchbaren Aktionen für schnellen Zugriff. |
| I1.22 | Vollständige Kürzelliste im Editor | Projektmenü → Help → „Keyboard Shortcuts" | https://superfiles.in/framer-keyboard-shortcuts-list-for-designers-superfiles.php | Ein Pop-up zeigt die komplette Kürzelliste des aktuellen Editors an. |

## T — Templates

| Nr | Funktion | Wo in Framer (Panel/Menü/Kürzel) | Quelle (URL) | Beschreibung in einem Satz |
|---|---|---|---|---|
| T1.1 | Framer-Marketplace für Templates | framer.com/marketplace | https://www.framer.com/help/articles/how-templates-work/ | Zentraler Ort zum Durchsuchen von Templates, Entdecken neuer Creator und Inspiration. |
| T1.2 | Kostenlose Templates „Use for Free" | Marketplace, Template-Detailseite | https://www.framer.com/help/articles/how-templates-work/ | Ein Klick fügt das kostenlose Template direkt dem eigenen Konto hinzu. |
| T1.3 | Kostenpflichtige Templates per Checkout + Remix-Link | Marketplace, Template-Detailseite | https://www.framer.com/help/articles/how-templates-work/ | Kauf über den Checkout des Creators, danach Zugriff per per E-Mail zugesandtem Remix-Link. |
| T1.4 | Template komplett anpassbar nach Kopie | Editor, nach Kopieren des Templates | https://www.framer.com/help/articles/how-templates-work/ | Inhalt, Stil, Layout und Komponenten lassen sich wie in jedem anderen Framer-Projekt bearbeiten. |
| T1.5 | Remix-Link erstellen | Dashboard, Projekt-Karte → „…" → „Copy Remix Link" | https://www.framer.com/help/articles/how-to-create-a-remix-link/ | Erzeugt einen Link, über den andere das Projekt als editierbare Kopie in ihr eigenes Konto übernehmen können. |
| T1.6 | Remix erstellt vollständig editierbare Kopie | Empfänger-Konto nach Klick auf Remix-Link | https://www.framer.com/help/articles/why-is-a-template-s-remix-count-higher-than-its-sales/ | Ein Remix dupliziert das Projekt inklusive Text, Bilder, Layout, Farben, Animationen. |
| T1.7 | Remix-Zähler vs. Verkäufe | Creator-Dashboard, Marketplace | https://www.framer.com/help/articles/why-is-a-template-s-remix-count-higher-than-its-sales/ | Jede Duplizierung zählt als Remix (auch unbezahlte und interne Framer-Kopien), unabhängig vom tatsächlichen Verkauf. |
| T1.8 | Template zum Verkauf einreichen | Creator-Dashboard → Marketplace-Einreichung | https://www.framer.com/help/articles/how-templates-work/ | Ein Template wird über das Creator-Dashboard zur Prüfung eingereicht, danach Preis- und Checkout-Verknüpfung möglich. |
| T1.9 | Support/Rückerstattung liegt beim Creator | Template-Detailseite, Support-Kontakt | https://www.framer.com/help/articles/how-templates-work/ | Zahlungen und Rückerstattungsentscheidungen laufen direkt über den Creator, Eskalation über creators@framer.com. |
| T1.10 | Sections/Pages-Bibliothek als Vorlagen im Insert-Panel | Insert-Panel → Pages/Sections | https://www.framer.com/updates/insert-pages | Zusätzlich zu Marktplatz-Templates lassen sich fertige Einzelseiten-/Abschnitts-Vorlagen direkt im Insert-Panel einfügen. |
| T1.11 | Duplicate Project (ganzes Projekt kopieren) | Menü File → „Duplicate" | https://www.framer.com/help (Menüinventar, projekt-internes File-Menü) | Kopiert das gesamte Projekt als neue eigenständige Kopie. |

## S — Seitenstruktur

| Nr | Funktion | Wo in Framer (Panel/Menü/Kürzel) | Quelle (URL) | Beschreibung in einem Satz |
|---|---|---|---|---|
| S1.1 | Home als Wurzel der Struktur | Pages-Panel | https://www.framer.com/help/articles/how-to-use-pages/ | Home ist die unlöschbare Wurzel-Seite, von der aus die restliche Struktur ausgeht. |
| S1.2 | Ordner als Pfadsegmente | Pages-Panel, Ordner | https://www.framer.com/updates/december-update-2023 | Ein Ordner bildet ein gemeinsames URL-Pfadsegment für alle enthaltenen Seiten. |
| S1.3 | Mehrstufige Ordner-Verschachtelung | Pages-Panel, Ordner in Ordner | https://www.framer.com/updates/december-update-2023 | Ordner lassen sich ineinander verschachteln für mehrstufige Hierarchien. |
| S1.4 | Verschachtelte Seiten (Nested Pages) per Drag-Overlap | Pages-Panel, Seite auf Seite ziehen | https://www.framer.com/updates/december-update-2023 | Eine Seite über den Namen einer anderen ziehen und dort loslassen erzeugt eine Unterseiten-Hierarchie. |
| S1.5 | Automatische Pfad-Anpassung bei Verschachtelung | Pages-Panel | https://www.framer.com/updates/december-update-2023 | Framer passt die URL der Unterseite automatisch an den Pfad der übergeordneten Seite an. |
| S1.6 | CMS-Seiten als Teil der Seiten-Hierarchie unter ihrer Index-Seite | Pages-Panel | https://www.framer.com/updates/unified-pages | CMS-Detailseiten erscheinen jetzt verschachtelt unter der zugehörigen Listen-/Index-Seite statt in einer getrennten Kategorie. |
| S1.7 | Slugs automatisch aus Seitennamen | Pages-Panel | https://www.framer.com/help/articles/how-to-use-pages/ | Der URL-Pfad wird automatisch aus dem Seitennamen abgeleitet, manuell überschreibbar. |
| S1.8 | Locale-Präfixe in Seitenpfaden | Localization View, Site Settings | https://www.framer.com/updates/localized-page-paths | Übersetzte Seitenpfade können je Sprache eigene Segmente im Pfad tragen, inkl. Konflikterkennung. |
| S1.9 | Automatic Locale (Spracherkennung/Redirect) | Site Settings → Localization | https://www.framer.com/help/articles/how-does-automatic-locale-work/ | Steuert, ob Besucher automatisch zur passenden Sprachversion der Seitenstruktur weitergeleitet werden. |
| S1.10 | `lang`-Attribut je Seite/Locale | Localization-Einstellungen | https://www.framer.com/help/articles/language-attribute/ | Jede Sprachversion einer Seite erhält das korrekte HTML-`lang`-Attribut. |
| S1.11 | Redirects als struktureller Umbau-Mechanismus | Site Settings → Hosting → Redirects | https://www.framer.com/help/articles/how-to-setup-redirects-to-maintain-seo-ranking/ | Dient dazu, alte Pfade nach Restrukturierung der Seitenhierarchie auf neue umzuleiten. |
| S1.12 | Batch-Pfadänderung über Ordner-Umbenennung | Pages-Panel, Ordner umbenennen | https://www.framer.com/updates/december-update-2023 | Ein umbenannter Ordner ändert die Pfade aller darunterliegenden Seiten gleichzeitig. |

---

## Zählung

| Bereich | Zeilen |
|---|---|
| P — Pages-Panel | 40 |
| A — Assets-Panel | 31 |
| I — Insert-Menü | 22 |
| T — Templates | 11 |
| S — Seitenstruktur | 12 |
| **Gesamt** | **116** |
