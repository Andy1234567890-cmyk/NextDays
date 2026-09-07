# Framer-Editor — Design-Bereich (Pages-Panel „Design", Assets → Styles, Layout Templates, Site Settings) (Recherche 05.09.2026)

Auftrag: vollständige Recherche des **site-weiten Design-Bereichs** des
Framer-Editors (framer.com) — im Unterschied zum Element-Inspektor (dort
bereits erfasst in `docs/FRAMER-STYLE-INSPEKTOR-FUNKTIONEN.md` und
`docs/FRAMER-EDITOR-TEXT-RECHERCHE.md`). Ausschließlich Web-Recherche
(WebSearch/WebFetch gegen framer.com/help, framer.com/updates,
framer.com/academy sowie Sekundärquellen, wo Framer selbst keine dedizierte
Hilfeseite führt).

**Bereits an anderer Stelle erfasst — hier NICHT wiederholt, nur verwiesen:**
- Color Styles anlegen/verwalten/Light-Dark/Ordner via „/", Text Styles
  anlegen/verwalten/Breakpoints, Variablen (Color/Number/Text/Boolean,
  Component Properties, bedingte Transforms): `docs/FRAMER-EDITOR-DESIGNSYSTEM-CODE-RECHERCHE.md`,
  Abschnitt D (D1.1–D1.8 Color Styles, D2.1–D2.6 Text Styles, D3.1–D3.9
  Variablen).
- Font Picker, Font Weight, Line Height/Letter Spacing/Paragraph Spacing je
  Breakpoint, Text-Style-Breakpoints, Variable-Font-Achsen, OpenType, Tag-Wahl
  (H1–H6), RTL-Grundverweis: `docs/FRAMER-EDITOR-TEXT-RECHERCHE.md`, Abschnitt
  T2 (insb. T2.4, T2.6, T2.8, T2.16–T2.20, T2.23).
- Design Pages als Seitentyp (Kurzeintrag): `docs/FRAMER-EDITOR-PANELS-LINKS-RECHERCHE.md`,
  P1.4.

Diese Datei ergänzt: das „Design +"-Menü im Pages-Panel im Detail, Link
Styles (bislang in keiner der drei Dateien erfasst), die Anlegen-/Edit-Dialoge
von Color/Text Styles feldweise, Layout Templates/Breakpoint-Vorlagen, und
die designrelevanten Site-Settings-Reiter (General, Fonts, Performance,
RTL/Theme, Cursor/Scroll/Preloader — letztere drei als **nicht belegt als
Site-Setting**, siehe unten).

Nummernpräfixe: **DP** = Design Pages, **ST** = Styles (Assets-Panel), **LT** =
Layout Templates, **SS** = Site Settings.

---

## DP — „Design +" im Pages-Panel

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| DP1.1 | Seitentyp „Design Page" | Pages-Panel → „+" → Typwahl-Menü | https://www.framer.com/help/articles/how-to-use-pages/ | Privater, nicht veröffentlichter Canvas — Framer nennt es „turns Framer from a web builder into a true design tool"; siehe auch P1.4 in der Panels-Recherche. |
| DP1.2 | Unterschied zu Web Pages | Pages-Panel | https://www.framer.com/help/articles/how-to-use-pages/, https://www.framer.com/updates/design-pages | Web Pages sind für „responsive Layouts, Navigation, Effekte, Breakpoints" gebaut und werden veröffentlicht; Design Pages sind bewusst OHNE Responsive-Zwang — man kann „experiment and play without having to think about responsiveness". |
| DP1.3 | Unterschied zu CMS Pages | Pages-Panel | https://www.framer.com/help/articles/how-to-use-pages/ | CMS Pages entstehen aus einer CMS-Collection über eine gemeinsame Vorlage (Blogartikel, News, Produkte); Design Pages haben keinen Collection-Bezug, jede ist ein eigenständiger freier Canvas. |
| DP1.4 | Was das „+" konkret anbietet | Pages-Panel → „+" | https://www.framer.com/help/articles/how-to-use-pages/ | Menü mit der Aufforderung „Select the type of page you want to create" — zur Wahl stehen Web Page, CMS Page (falls Collections vorhanden) und Design Page. |
| DP1.5 | Werkzeuge auf dem Design-Page-Canvas | Design Page, Werkzeugleiste | https://www.framer.com/updates/design-pages | Vektor-Editing, P3-Farbunterstützung, Bild-Export, erweiterte Masken-Funktionen — laut Ankündigung zusätzliche, nicht einzeln benannte Werkzeuge. |
| DP1.6 | Design Page → Web Page konvertieren | Design Page, Kontext-/Umwandlungsaktion | https://www.framer.com/updates/design-pages | Ein-Klick-Umwandlung einer Design Page in eine veröffentlichbare Web Page, „eliminating traditional friction points like imports or copy-pasting". |
| DP1.7 | Wireframer auf Design Pages | Design Page | https://www.framer.com/updates/design-pages | Framers Layout-Generator „Wireframer" arbeitet auf Design Pages und kann mehrere Layout-Varianten nebeneinander erzeugen. |
| DP1.8 | Kosten | Design Pages, produktweit | https://www.framer.com/updates/design-pages | Laut Ankündigung „completely free to use", unbegrenzte Projekte/Seiten — kein separates Preis-Tier. |
| DP1.9 | Kontextmenü je Seite (gilt für alle Seitentypen inkl. Design Page) | Pages-Panel, Rechtsklick/Hover auf eine Seite | https://www.framer.com/help/articles/how-to-use-pages/ | URL anpassen, Seite samt Inhalt duplizieren, Seite löschen, Umbenennen per Doppelklick. |
| DP1.10 | Nutzung für Komponentenbibliothek/Styleguide | — | unbelegt | Framers eigene Dokumentation nennt für Design Pages ausdrücklich Mockups, Social-Media-Grafiken, wiederverwendbare Assets und Design-Exploration — eine Nutzung explizit ALS Komponentenbibliothek oder Styleguide-Seite wird in keiner gefundenen Quelle benannt, ist aber durch den freien Canvas naheliegend (nicht belegt, daher nur als Vermutung markiert). |

---

## ST — Assets → Styles (Color Styles, Text Styles, Link Styles)

Die Grundfunktionen (Anlegen, Anwenden, Umbenennen/Löschen, Light/Dark,
Ordner via „/", Breakpoints an Text Styles) stehen in
`FRAMER-EDITOR-DESIGNSYSTEM-CODE-RECHERCHE.md` D1/D2 — hier NICHT dupliziert.
Diese Tabelle trägt nach, was dort fehlte: Link Styles vollständig, sowie die
Einzelfelder der Anlegen-/Edit-Dialoge, soweit sie sich belegen ließen.

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| ST1.1 | Color-Style-Dialog: Name | Assets-Panel → Style anlegen/öffnen | https://www.framer.com/help/articles/light-and-dark-mode-options/ | Freitext-Namensfeld (siehe auch D1.2); „/" im Namen bildet Ordner (D1.3). Die genauen Bedienelemente des Anlegen-Dialogs (Hex/RGB/HSL/P3-Umschalter, Alpha-Slider, Pipette) waren in keiner der geprüften Framer-Hilfeseiten einzeln aufgeführt. |
| ST1.2 | Color-Style-Dialog: Farbwert | Assets-Panel, Farbfeld | https://www.framer.com/help/articles/light-and-dark-mode-options/ | Farben werden intern als RGBA gespeichert (siehe D1.1); P3-Farbraum ist für Framer als Canvas-Fähigkeit belegt (DP1.5, Design Pages), eine dedizierte Aussage, dass DERSELBE P3-Umschalter auch im Color-Style-Dialog des normalen Editors erscheint, ist **unbelegt**. |
| ST1.3 | Color-Style-Dialog: Alpha/Opazität | Assets-Panel, Farbfeld | https://www.framer.com/help/articles/light-and-dark-mode-options/ | Alpha ist nativer Bestandteil des gespeicherten RGBA-Werts (D1.1); ein separat benanntes „Alpha-Slider"-UI-Element ist in der Quelle nicht wörtlich benannt — funktional aber vorhanden, da RGBA-Werte gespeichert werden. |
| ST1.4 | Color-Style-Dialog: Pipette/Eyedropper | Assets-Panel, Farbfeld | unbelegt | In keiner geprüften Framer-Quelle als eigenes Bedienelement am Style-Dialog dokumentiert (aus allgemeiner Colorpicker-Erfahrung in Design-Tools plausibel, aber NICHT belegt). |
| ST1.5 | Color-Style-Dialog: Light/Dark-Werte | Assets-Panel → Style öffnen | https://www.framer.com/help/articles/light-and-dark-mode-options/, https://www.framer.com/updates/light-and-dark-mode | Pflicht-Light-Wert + optionaler Dark-Wert (siehe D1.4); Entfernen des Dark-Werts über „…" → „Remove Dark Style" (siehe D1.5). |
| ST1.6 | Color-Style-Dialog: Umbenennen/Löschen inkl. Auswirkung | Assets-Panel → Style-Kontextmenü | https://www.framer.com/help/articles/light-and-dark-mode-options/ | Deckungsgleich mit D1.7: Umbenennen bricht keine Verweise; Löschen wirkt auf ALLE Verwendungsstellen, betroffene Elemente fallen auf einen festen Hex-Wert zurück statt auf den Stil zu verweisen. |
| ST1.7 | „Edit Style" als eigener Dialog-Einstieg | Assets-Panel bzw. Style-Chip am Element | https://www.framer.com/help/articles/how-to-use-text-styles/ | Für Text Styles explizit als „Edit Style" benannter Einstieg (siehe D2.3/T2.14); für Color Styles funktional identisch über das Style-Kontextmenü, aber ohne denselben Wortlaut in der Quelle. |
| ST1.8 | Verwendung zählen, Suche, Sortierung im Assets-Panel | Assets-Panel, Styles-Liste | unbelegt | Keine der geprüften Framer-Hilfeseiten (light-and-dark-mode-options, how-to-use-text-styles) beschreibt eine Verwendungszähler-Anzeige, eine Suchleiste oder eine Sortierfunktion innerhalb der Styles-Liste — als **unbelegt** markiert, nicht als „gibt es nicht" zu lesen. |
| ST2.1 | Text-Style-Dialog: Font, Weight, Size, Line Height, Letter Spacing, Paragraph Spacing, Color | Assets-Panel → Text Style → „Edit Style" | https://www.framer.com/help/articles/how-to-use-text-styles/ | Konfigurierbare Grundfelder eines Text Styles; siehe auch D2.1–D2.6 und T2.1–T2.6 für Details je Feld. |
| ST2.2 | Text-Style-Dialog: Size in px vs. rem | Edit Style | https://www.framer.com/updates/april-update-2025 | Schriftgröße lässt sich in REM angeben mit einem je Breakpoint änderbaren Basiswert (siehe T2.4, LT-Abschnitt unten); ob im selben Feld wahlweise auch px eingebbar ist, wird in der Quelle nicht ausdrücklich unterschieden — als „REM-Angabe mit Basiswert" belegt, ein px/rem-Umschalter selbst ist unbelegt. |
| ST2.3 | Text-Style-Dialog: Transform, Decoration, Align | Edit Style, Typography-Abschnitt | unbelegt | Wie bereits in T2.7/T2.9/T2.10 vermerkt: keine offizielle Quelle mit belastbarer Feldliste gefunden; als unbelegt übernommen, nicht neu behauptet. |
| ST2.4 | Text-Style-Dialog: Tag-Zuordnung | Edit Style bzw. Accessibility-Panel | https://www.framer.com/help/articles/text-styles-and-semantic-tags/ | Ein Text Style erhält automatisch ein semantisches HTML-Tag (H1–H6, p, span); pro Instanz im Accessibility-Panel überschreibbar (siehe T2.23). |
| ST2.5 | Text-Style-Dialog: Breakpoints-Abschnitt „Add Breakpoints" | Edit Style → Abschnitt „Breakpoints" | https://www.framer.com/help/articles/setting-text-styles-breakpoints/ | Eigene Werte je Breakpoint (Desktop/Tablet/Mobil) für Font Size, Line Height, Letter Spacing, Paragraph Spacing; siehe D2.4/T2.16. Funktioniert laut eigenem Hilfe-Artikel NICHT zuverlässig innerhalb von Components (T2.17). |
| ST2.6 | Text-Style-Dialog: Variable-Font-Achsen | Font Picker, Filter „Variable" | https://www.framer.com/updates/variable-fonts | Siehe T2.19 — Achsen (Width/Weight/Slant) einstellbar, laut Update animierbar über Variants. |
| ST2.7 | Text-Style-Dialog: OpenType-Features | Font Picker/Typography-Abschnitt | https://www.framer.com/updates/july-update-2024, https://www.framer.com/updates/opentype-google-fonts | Siehe T2.20 — Stylistic Sets, Character Variants, Ligaturen; Suche + Live-Vorschau. |
| ST2.8 | Text Highlights (Fill/Radius/Padding) | Typography-Abschnitt (vermutlich Text-Effekte-Bereich) | unbelegt | Kein offizieller Beleg für ein Feld „Text Highlights" mit Fill/Radius/Padding gefunden; T2.21 belegt für dasselbe Juli-2024-Update nur Text Effects/Text Balance/Text Stroke/Text Masks — „Text Highlights" mit genau diesen drei Unterfeldern bleibt unbelegt. |
| ST3.1 | Link Style anlegen | Text-Ebene mit Link → Panel-Abschnitt „Link" → „Style" | https://www.framer.com/help/articles/how-to-use-text-styles/ | Link Styles funktionieren wie Text Styles, gelten aber speziell für Links: Textfarbe, Hover-, Active- und Current-Zustand separat stylebar. |
| ST3.2 | Link Style: Zustände Hover/Active/Current | Link-Abschnitt im Panel | https://www.framer.com/help/articles/how-to-use-text-styles/ | Drei benannte Zustände; „Current" kennzeichnet vermutlich die aktuell aktive Navigations-Seite (analog zu CSS `:current`/aria-current-Mustern) — Quelle nennt die drei Begriffe, ohne „Current" inhaltlich weiter zu erläutern. |
| ST3.3 | Link Style: zentrale Verwaltung | Assets-Panel (analog zu Text Styles) | https://www.framer.com/help/articles/how-to-use-text-styles/ | Aktualisierung eines Link Styles wirkt automatisch auf alle Verwendungsstellen — „when you update a link style, all links using that style update automatically". |
| ST3.4 | Link Decoration-Panel (Juli 2025) | Link-Abschnitt, eigener Unterbereich „Decoration" | https://www.framer.com/updates/july-update-2025 | Redesignte Link Styles mit dediziertem Decoration-Panel: Color, Style, Thickness, Offset „und mehr" (weitere Felder in der Ankündigung nicht einzeln benannt); wirkt sowohl auf eigenständige Text-Ebenen als auch auf Inline-Links aus dem CMS. |
| ST3.5 | Link Decoration: Transition beim Zustandswechsel | Decoration-Panel | unbelegt | Die Ankündigung nennt einen unrelated Bugfix („transition issue when hovering Fit Text layers"), aber keine eigene Transition-Einstellung für Link-Zustandswechsel — als unbelegt markiert. |
| ST3.6 | Link Style vs. Text Style — Abgrenzung | — | https://www.framer.com/help/articles/how-to-use-text-styles/ | Ein Link Style sitzt zusätzlich zu einem Text Style auf demselben Textelement, wenn Teiltext ein Link ist — die Quelle beschreibt beide im selben Artikel, ohne eine explizite Vererbungs-/Prioritätsregel zwischen ihnen zu benennen (unbelegt, welcher gewinnt bei Farb-Konflikt). |
| ST4.1 | Standard-Styles neuer Projekte | Neues Projekt, Assets-Panel | unbelegt | Keine geprüfte Quelle beschreibt, mit welchen vorbelegten Color-/Text-Styles ein frisch angelegtes Framer-Projekt startet (leer vs. Beispielset) — als unbelegt markiert. |

---

## LT — Layout Templates / Breakpoint-Vorlagen (April 2025)

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| LT1.1 | Layout Template als Seitentyp | Pages-Panel bzw. eigener Layout-Templates-Bereich | https://www.framer.com/updates/layout-templates, https://www.framer.com/help/articles/using-layout-templates/ | Wiederverwendbare Navigationen/Seitenlayouts (Header, Footer, Banner, Overlays), die auf mehrere Seiten zugleich wirken, ohne pro Seite einzeln editiert zu werden. |
| LT1.2 | Breakpoints je Layout Template | Layout Template, Breakpoint-Leiste | https://www.framer.com/updates/layout-template-updates | Layout Templates unterstützen eigene Tablet-/Mobil-Breakpoints wie normale Seiten, je Breakpoint individuell anpassbar; Standard-Overflow an Layout-Template-Breakpoints ist inzwischen „hidden". |
| LT1.3 | REM-Basiswert je Breakpoint | Layout Template bzw. Text-Style-Editor, Breakpoint-Einstellung | https://www.framer.com/updates/april-update-2025 | Ein REM-Basiswert (Standard 16 px) je Breakpoint skaliert alle darauf bezogenen Schriftgrößen proportional — zentral gesetzt statt jeden Style einzeln zu ändern (siehe auch T2.4/T2.18). |
| LT1.4 | Primary Breakpoint | Breakpoint-Leiste (Layout Templates wie normale Seiten) | https://www.framer.com/updates/layout-template-updates, https://www.framer.com/help/articles/using-layout-templates/ | Ein Breakpoint gilt als Ausgangspunkt/Referenz, von dem die übrigen (Tablet/Mobil) abgeleitet werden — Framer nennt diesen Mechanismus in den Layout-Template-Updates, ohne im geprüften Ausschnitt den exakten UI-Begriff „Primary Breakpoint" wörtlich zu belegen; funktional aber beschrieben. |
| LT1.5 | Anlegen/Ändern/Löschen eines Layout Templates | Pages-Panel bzw. Layout-Templates-Verwaltung | https://www.framer.com/help/articles/using-layout-templates/ | Eigener Hilfe-Artikel zur Nutzung von Layout Templates; die genauen Dialogfelder für Anlegen/Umbenennen/Löschen sind im Abruf nicht einzeln aufgeschlüsselt — nur die Existenz eines eigenen Verwaltungswegs ist belegt. |
| LT1.6 | Mobile-Verbesserungen, Page Effects, Sidebars (Ausbau) | Layout Templates | https://www.framer.com/updates/layout-template-updates | Nachfolge-Update erweitert Layout Templates um bessere Mobile-Unterstützung, Page Effects und Sidebar-Layouts. |
| LT1.7 | Best Practices für Templates (Preloader-Regel) | Template-Erstellung (Marketplace-Kontext) | https://www.framer.com/help/articles/preloader-guidelines-for-templates/ | Eigener Regelsatz NUR für Marketplace-Templates: ein Preloader darf max. 1,5 s dauern, muss leicht deaktivierbar sein und darf Layout/Funktion nach Entfernen nicht stören — kein allgemeines Site-Settings-Feature (siehe SS5 unten). |

---

## SS — Site Settings, designrelevant

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung/Felder |
|---|---|---|---|---|
| SS1.1 | Site Name | Site Settings → General | https://www.framer.com/academy/lessons/framer-fundamentals-site-and-page-settings | In der Academy-Lektion zu Site/Page Settings als Grundfeld genannt; Einzeldetails (Zeichenlimit etc.) nicht weiter belegt. |
| SS1.2 | Favicon (Light/Dark) | Site Settings → General → Site Images → Favicon | https://www.framer.com/help/articles/how-to-add-icons-and-set-up-a-favicon/ | Zwei Felder: Favicon Light Mode + Favicon Dark Mode (optional); empfohlen 64×64 px PNG. |
| SS1.3 | Social Image (OG-Bild) | Site Settings → General → Site Images → Social Image | https://wizetemplates.com/blog/how-to-add-a-social-image-og-image-in-framer | Bild, das beim Teilen des Website-Links angezeigt wird; empfohlenes Seitenverhältnis 1.91:1 (Beispiel 1200×600 px). Primärquelle framer.com selbst für dieses Einzelfeld nicht direkt abrufbar — Sekundärquelle, Angabe als „plausibel, nicht framer-eigen belegt" zu werten. |
| SS1.4 | Layout Direction / Reverse Layout (RTL) | Site Settings → General → Layout Direction | https://www.framer.com/help/articles/rtl-best-practices/ | Schalter „Reverse Layout"; site-weit (nicht je Seite) — Stacks und Grids drehen bei aktiver RTL-Locale automatisch. Ergänzt durch layout-direction-bewusste Variablen an Links/Layout/Styles/Components-Eigenschaften (z. B. Rotate-Transform für Icon-Spiegelung, Padding/Margin-Tausch links/rechts). Siehe auch T2.8/T4.7. |
| SS1.5 | Reduced Motion | Site Settings → General | https://www.framer.com/help/articles/reduced-motion-settings/ | Checkbox „disable movement animations and custom cursors if the user prefers reduced motion" (Wortlaut laut Hilfeseite); deaktiviert bei aktivem System-Preference Parallax-, Transform- und Layout-Animationen sowie Custom Cursors. Ob die Framer-Checkbox selbst manuell EIN/AUS schaltbar ist oder rein die System-Preference spiegelt, blieb im Abruf uneindeutig — als teilweise unbelegt markiert. |
| SS2.1 | Projektweite Font-Verwaltung | Site Settings → Fonts (bzw. Workspace Settings für kontoweite Fonts) | https://www.framer.com/help/articles/how-to-add-custom-fonts/ | Google Fonts, Fontshare und Custom Fonts stehen projektweit zur Verfügung (siehe T2.1); Custom Fonts werden separat hochgeladen. |
| SS2.2 | Custom Fonts hochladen | Fonts-Bereich → „Upload Fonts" | https://www.framer.com/help/articles/how-to-add-custom-fonts/ | Dateiauswahl vom Rechner, danach Auswahl im Custom-Tab des Font-Pickers; unterstützte Formate .woff2, .woff, .ttf, .otf — .woff2 für beste Performance empfohlen. |
| SS2.3 | Custom Fonts löschen | Fonts-Bereich, Font-Kontextmenü | unbelegt | Die geprüfte Quelle beschreibt nur das Hochladen; ein expliziter Lösch-Workflow ist nicht einzeln dokumentiert (naheliegend vorhanden, aber unbelegt). |
| SS2.4 | Font-Lizenzhinweis | Fonts-Bereich (Custom Fonts) | https://www.framer.com/help/articles/how-to-choose-the-right-font-license-for-framer/ | Eigener Hilfe-Artikel warnt, vor dem Hochladen die passende Lizenz für die Web-Nutzung zu prüfen. |
| SS2.5 | Kontoweite (Workspace-)Fonts | Workspace Settings → Fonts | https://www.framer.com/help/articles/how-to-add-custom-fonts/ | Fonts, die auf Workspace-Ebene hochgeladen werden, erscheinen automatisch in JEDEM neuen Projekt dieses Workspace — Unterschied zu projektgebundenen Custom Fonts. |
| SS3.1 | Font Loading: Auto | Site Settings → Performance → Font Loading | https://www.framer.com/help/articles/how-are-fonts-optimized-in-framer/ | Standardwert: `font-display: swap` NUR dort, wo die Systemschrift dem Zielfont nahekommt genug, dass der Wechsel nicht auffällt. Löst den in T2.3 offen gelassenen Widerspruch auf — der Schalter Auto/Always/Never existiert live in Site Settings → Performance. |
| SS3.2 | Font Loading: Always | Site Settings → Performance → Font Loading | https://www.framer.com/help/articles/how-are-fonts-optimized-in-framer/ | Jede Schrift nutzt `font-display: swap` unabhängig von Gewicht/Kategorie — Text sofort lesbar, Schriftwechsel ggf. sichtbarer. |
| SS3.3 | Font Loading: Never | Site Settings → Performance → Font Loading | https://www.framer.com/help/articles/how-are-fonts-optimized-in-framer/ | Kein `font-display: swap`; Browser entscheidet, Text bleibt oft bis zu 3 s unsichtbar, bis die Schrift geladen ist. |
| SS3.4 | Automatische Font-Optimierungen (nicht abschaltbar) | Performance, technischer Unterbau | https://www.framer.com/help/articles/how-are-fonts-optimized-in-framer/ | WOFF2-Konvertierung, Subsetting, size-adjusted Fallbacks, Inter/Inter Display als Standardschrift — laufen unabhängig vom Font-Loading-Schalter. |
| SS4.1 | Image Optimization: Resolution-Stufen | Element-Ebene (Fill → Image), NICHT Site Settings | https://www.framer.com/help/articles/how-are-images-optimized-in-framer/ | Auto (Standard, Framer wählt je Besucher die beste Größe), Small (512 px), Medium (1024 px), Large (2048 px), Full (4096 px) — dieser Schalter sitzt am EINZELNEN Bildelement, nicht in einem projektweiten Site-Settings-Performance-Feld; als designrelevant hier trotzdem aufgeführt, weil er dieselbe Performance-Systematik wie Font Loading ist. |
| SS4.2 | Verlustfreie Konvertierung „Auto (Lossless)" | Fill → Image, Resolution-Dropdown | https://www.framer.com/help/articles/how-are-images-optimized-in-framer/ | Erzwingt verlustfreies WebP statt des Standard-AVIF-Lossy-Pfads (AVIF-Standardqualität 80, initiale WebP-Anfragequalität 90). |
| SS4.3 | Projektweiter „Image Optimization"-Schalter in Site Settings → Performance | Site Settings → Performance | unbelegt | In keiner geprüften Framer-Quelle als EIGENER projektweiter Schalter (getrennt vom Element-Feld SS4.1) belegt — nur Sekundärquellen sprechen pauschal von „Performance-Modus umschalten", ohne Feldname/Ort zu nennen. Als unbelegt markiert, NICHT als bestätigtes Site-Settings-Feld. |
| SS5.1 | Nativer Dark-Mode-Schalter (site-weit, für Besucher) | — | unbelegt | Keine geprüfte Quelle belegt einen Schalter, der Framer-Websites für BESUCHER zwischen Light/Dark umschaltbar macht. Belegt ist nur der EDITOR-seitige Wechsel der Arbeitsoberfläche (Canvas-Menü-Button bzw. ⌃⌘N, siehe D1.4-Kontext) sowie Light/Dark-WERTE je Color Style (D1.4/D1.5/ST1.5). Ein Theme-Umschalt-Widget für den Website-Besucher ist damit NICHT als natives Framer-Feature belegt — vermutlich über Components/Variablen selbst gebaut (siehe Abschnitt „Theme-artige Funktionen" unten). |
| SS5.2 | Color-Style-Varianten als Dark-Mode-Mechanismus | Assets-Panel, Color Styles | https://www.framer.com/help/articles/light-and-dark-mode-options/, https://www.framer.com/updates/light-and-dark-mode | Der tatsächliche Framer-Mechanismus für Dark Mode sind die Light/Dark-WERTE JEDES Color Styles (D1.4) — kein separates „Theme-Panel", sondern Style-interne Variantenwerte, die site-weit umschalten, sobald der Besucher-/System-Modus wechselt. |
| SS6.1 | Cursor-Einstellungen als Site-Setting | — | unbelegt | Custom Cursors sind laut Framer Academy/Updates ein ELEMENT-/Breakpoint-Feature (rechtes Panel, „Cursor"-Abschnitt an einer Ebene oder am Desktop-Breakpoint für Site-weite Wirkung), KEIN eigener Site-Settings-Reiter. Site-weite Wirkung entsteht dadurch, dass der Cursor am Haupt-Desktop-Breakpoint gesetzt wird, nicht durch ein zentrales Cursor-Einstellungsfeld. |
| SS7.1 | Scroll Behaviour / Smooth Scroll als Site-Setting | — | unbelegt | Kein Beleg für ein natives Site-Settings-Feld „Smooth Scroll". Alle gefundenen Quellen (Framer University, Marketplace) beschreiben Smooth Scroll als Marketplace-KOMPONENTE (z. B. mit Fixed-Position auf einer Page-Template-Ebene platziert) oder als Interaktions-/Scroll-Target-Feature aus der Academy — nicht als projektweiten Schalter in Site Settings. |
| SS8.1 | Preloader/Loading Screen als Site-Setting | — | unbelegt | Kein natives Site-Settings-Feld gefunden. Preloader werden laut allen geprüften Quellen über Marketplace-Komponenten (z. B. mit „Show on All Pages"-Option DER KOMPONENTE selbst) oder eigene Interaktionen umgesetzt; Framers einziger offizieller Bezug ist der Regelkatalog für Marketplace-TEMPLATES (LT1.7: max. 1,5 s, leicht deaktivierbar), kein allgemeines Editor-Feature. |
| SS9.1 | Custom Code (Head/Body) | Site Settings → Custom Code | — (nur Verweis, laut Auftrag keine Detailrecherche hier) | Auftragsgemäß nur als Verweis aufgenommen, nicht im Detail recherchiert — siehe ggf. `docs/FRAMER-EDITOR-PUBLISH-SETTINGS-RECHERCHE.md` für Publish-/Settings-nahe Funktionen. |
| SS10.1 | Vollständige Site-Settings-Reiterliste | Site Settings, Reiterleiste | unbelegt (nur Teilliste belegbar) | Aus den geprüften Quellen einzeln belegte Reiter: General (SS1), Fonts (SS2), Performance (SS3/SS4), SEO (eigener Hilfe-Bereich framer.com/help/seo/, hier nicht im Detail recherchiert). Eine vollständige, autoritative Aufzählung ALLER Reiter (z. B. ob „Redirects" und „Localization" eigene Reiter oder Unterpunkte von General/SEO sind) ließ sich in keiner einzelnen Quelle bestätigen — als unbelegt markiert. |

---

## Gegenstück zu unserem Design-Panel

Unsere sieben Design-Unterseiten (`web/components/website/design/design-leiste.tsx`,
Router-Kopfkommentar: seit 0468 als Hostaway-Unterseiten statt einer langen
Rolle; `unterseite`-Zweige `site-layout`, `farben`, `text`, `buttons`, `bilder`,
`breite-abstand`, `logo`) im Vergleich zu Framers Lösung:

| Unsere Unterseite | Was sie tut (Dateiname/Kopfkommentar) | Wie Framer dasselbe löst |
|---|---|---|
| `site-layout.tsx` (`unterseite === "site-layout"`) | Theme-Wahl mit Bild-Vorschau (`ThemeVorschau`), u. a. „Seitlich" = Menü in einer Seitenleiste statt im Kopf, mit Umbruchschwelle 1090 px | Kein site-weites „ein Theme wählen"-Raster. Framer baut Kopf-/Seitenleisten-Navigation als eigene Elemente/Components auf dem Canvas bzw. inzwischen als **Layout Template** (LT1.1), das auf mehreren Seiten zugleich wirkt — es gibt keinen fertigen Theme-Umschalter, nur die Bausteine dafür. |
| `designfarben.tsx` (`unterseite === "farben"`) | Bis zu 30 benannte „Designfarben" (Werte) + Farbrollen (Stellen), inkl. „Farben aus Logo" ableiten; zwei Ebenen laut Kopfkommentar „ZWEI EBENEN, EINE WAHRHEIT" | Entspricht Framers **Color Styles** (ST1/D1): benannte, wiederverwendbare Farbwerte mit Light/Dark-Variante, zentral im Assets-Panel verwaltet. Framers Rollen-Ebene (welches Element welchen Style trägt) ist implizit über die Zuweisung „Style anwenden" gelöst, nicht als separate benannte Rollen-Liste wie bei uns. Keine „Farbe aus Logo ableiten"-Funktion belegt. |
| `text-rollen.tsx` (`unterseite === "text"`) | Acht Text-Rollen (u. a. DFLT als Fallback für alles ohne eigene Zuordnung) | Entspricht Framers **Text Styles** (ST2/D2): zentral verwaltete, benannte Stile mit Font/Weight/Size/Line-Height/Letter-Spacing/Paragraph-Spacing/Breakpoints, je Element als Style-Chip zugewiesen. Ein DFLT-artiger „Alles, was keine eigene Zuordnung hat"-Fallback ist in Framer nicht als eigenes Konzept belegt — dort trägt jedes Textelement explizit einen Style oder gar keinen. |
| `design-leiste.tsx`, Zweig `buttons` | Button-Füllung (solid/outline), Button-Ecken (sharp/rounded/pill), Button-Schrift, GLOBAL für alle Buttons der Site | Framer hat **kein globales Buttons-Panel**. Ein „Button" ist in Framer eine gewöhnliche Component/Frame-Struktur; site-weite Konsistenz entsteht NUR dadurch, dass alle Buttons dieselbe Component-Instanz sind (Component-Overrides) oder denselben Color/Text-Style referenzieren — ändert man den Style/die Component, ändern sich alle Instanzen. Kein zentraler „Ecken-Radius für alle Buttons"-Schalter unabhängig von der Struktur. |
| `design-leiste.tsx`, Zweig `bilder` | Hero-Bild global für die Site setzen | Kein Äquivalent als Site-Setting. Bilder werden pro Element/Seite gesetzt; site-weite Bildoptimierung läuft ausschließlich über Elementfeld „Resolution" (SS4.1), nicht über ein zentrales „Standard-Hero-Bild". |
| `breite-abstand.tsx` (`unterseite === "breite-abstand"`) | Inhaltsbreite (px/eigener Wert), Vollbreite-Schalter, vertikaler/horizontaler Sektionsabstand — site-weit | Kein site-weiter „Max-Content-Width"-Schalter belegt. Framer regelt Breite/Abstand pro Frame/Stack über Fixed/Fill/Max-Width-Eigenschaften am Element bzw. am **Layout Template** (LT1); ein zentrales Feld, das alle Sektionen gleichzeitig auf eine Breite zwingt, ist nicht belegt — am ehesten über eine gemeinsame Container-Component lösbar. |
| `design-leiste.tsx`, Zweig `logo` | Logo-Verwaltung inkl. Farben-Ableitung aus dem Logo | Kein eigenes „Logo"-Site-Setting belegt. Ein Logo ist in Framer ein normales Bildelement, meist innerhalb einer Navigation/eines Layout Templates platziert; Site Settings selbst kennt nur Favicon und Social Image (SS1.2/SS1.3) als bildbezogene GLOBALE Felder, kein „Firmenlogo"-Feld. |

**Zusammenfassend zum Abschnitt „Theme-artige Funktionen" (Auftragspunkt 5):**
Framer hat kein globales Theme-Panel im Sinn von „Buttons: Ecken/Farbe
site-weit an einer Stelle ändern". Belegt ist stattdessen eine Drei-Bausteine-
Lösung: **Components** (eine Button-Component mit Varianten/Overrides, deren
Änderung alle Instanzen aktualisiert), **Variables** (D3.1–D3.9, zentral
gesetzte Werte, die an beliebige Eigenschaften gebunden werden — inklusive
layout-direction-bewusster Varianten für RTL, SS1.4) und **Styles**
(Color/Text/Link Styles, ST1–ST3, mit Light/Dark-Werten als De-facto-
Theme-Mechanismus, SS5.2). Ein Nutzer baut sein „Theme" damit selbst aus
diesen drei Bausteinen zusammen, statt ein fertiges Panel wie unser
`design-leiste.tsx` vorzufinden.

---

## Zählung

- DP (Design Pages): 10 Zeilen (DP1.1–DP1.10)
- ST (Styles): 20 Zeilen (ST1.1–ST1.8, ST2.1–ST2.8, ST3.1–ST3.6, ST4.1) — genau: ST1 = 8, ST2 = 8, ST3 = 6, ST4 = 1 → 23 Zeilen
- LT (Layout Templates): 7 Zeilen (LT1.1–LT1.7)
- SS (Site Settings): 22 Zeilen (SS1.1–SS1.5, SS2.1–SS2.5, SS3.1–SS3.4, SS4.1–SS4.3, SS5.1–SS5.2, SS6.1, SS7.1, SS8.1, SS9.1, SS10.1)

**Gesamt: 62 Tabellenzeilen** (10 + 23 + 7 + 22).

Davon als **unbelegt** markiert (kein tragfähiger Primär- oder eindeutiger
Sekundärbeleg gefunden): DP1.10, ST1.4, ST1.8, ST2.3, ST2.8, ST3.5, ST3.6,
ST4.1, LT1.4 (teilweise), LT1.5 (teilweise), SS1.3 (nur Sekundärquelle),
SS1.5 (teilweise), SS2.3, SS4.3, SS5.1, SS6.1, SS7.1, SS8.1, SS10.1 — 19 von
62 Zeilen ganz oder teilweise unbelegt.
