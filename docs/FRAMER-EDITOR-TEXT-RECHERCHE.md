# Framer-Editor — Text und Typografie (vollständige Recherche)

Quellen: framer.com/help, framer.com/academy, framer.com/updates (2023–2026),
framer.com/dictionary, framer.com/blog. Nur belegte Aussagen; unbelegtes ist
als „unbelegt" markiert oder weggelassen. Nummern `T1.1` … je Abschnitt,
Gesamtzählung am Ende.

---

## T1 — Textbearbeitung auf dem Canvas

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung |
|---|---|---|---|---|
| T1.1 | Doppelklick zum Editieren | Canvas, Textelement | https://www.framer.com/updates/inline-content-editing | Doppelklick auf ein Textelement öffnet den Editiermodus direkt auf der Fläche; bei CMS-verbundenen Layern genügt ein Doppelklick, um sofort zu tippen, die Änderung synchronisiert ins CMS. |
| T1.2 | Editierbare CMS-Feldtypen inline | Canvas, CMS-verbundener Layer | https://www.framer.com/updates/inline-content-editing | Direkt auf der Fläche editierbar sind Plain Text, Rich Text, Dates, References und Images. |
| T1.3 | Editierbarkeits-Badge | Canvas, ausgewählter CMS-Layer | https://www.framer.com/updates/inline-content-editing | Ein Badge am ausgewählten Layer zeigt an, dass der Inhalt inline editierbar ist. |
| T1.4 | Slash-Command-Menü im Rich Text | Canvas, Rich-Text-Editiermodus | https://www.framer.com/updates/inline-content-editing | Eingabe von „/" öffnet ein Menü für Headings, Lists, Blockquotes, Tables, Images, Videos direkt im Textfluss. |
| T1.5 | On-Page-Editing (Hover+Klick) | Canvas / Preview-naher Editiermodus | https://www.framer.com/help/articles/on-page-editing/ | Elemente werden per Hover und Klick direkt editiert; „Show All Fields" blendet zusätzlich versteckte CMS-Felder ein. |
| T1.6 | Listen im Text starten | Canvas, Textelement | https://www.framer.com/updates/lists | „-" oder eine Zahl gefolgt von Leertaste startet eine Liste (Bullet bzw. Numbered); Tab verschachtelt eine Ebene tiefer; zweimal Enter oder Shift+Tab verlässt die Liste; Listen-Marker übernehmen die Textfarbe. |
| T1.7 | Listen-Einzug/Abstand aus dem Text-Layer statt Text-Style | Canvas/Community | https://www.framer.com/community/c/support/paragraph-bullet-points-and-indented-text | Nur als Community-Diskussion belegt, keine offizielle Doku-Bestätigung — unbelegt als offizielles Verhalten. |
| T1.8 | Text Balance | Canvas, Textlayer-Property | https://www.framer.com/dictionary/text-balance , https://www.framer.com/updates/june-update-2024 | Property an Text-Layern, die die Zeilenumbrüche von (meist mehrzeiligen) Überschriften visuell ausbalanciert, damit keine kurze Restzeile entsteht. |
| T1.9 | Text Truncation / Max Lines | Canvas, Text-Menü am Layer | https://www.framer.com/updates/text-truncation | Begrenzt Text auf eine maximale Zeilenzahl (ein- oder mehrzeilig), einstellbar „under the Text menu", kompatibel mit Variablen. Ob das Ellipsis-Zeichen konfigurierbar ist: unbelegt. |
| T1.10 | Fit Text (mehrzeilig, mit Grenzen) | Canvas, Textelement | https://www.framer.com/updates/fit-text | Text kann per Enter mehrzeilig sein; Min/Max Width am Text-Layer oder am Elternteil begrenzen, wie weit die Schriftgröße beim Skalieren wächst/schrumpft. |
| T1.11 | Text Highlights (Inline-Hervorhebung) | Canvas, Textauswahl | https://www.framer.com/updates/text-highlights | Auf eine Textauswahl anwendbar: Fill, Radius, Padding; verknüpft mit Link Styles, Text Layers und Text Styles — Beispiel „Links that feel like buttons". |
| T1.12 | Inline-Links im Text | Canvas/Properties Panel, Link-Sektion | https://www.framer.com/help/articles/how-do-i-add-clickable-email-phone-number-links/ | Links werden über die Link-Sektion im Properties Panel gesetzt („+" neben Link), auch für klickbare E-Mail-/Telefonnummern-Links. |
| T1.13 | Text Style auf Teilauswahl anwenden | Canvas, markierter Textteil | https://www.framer.com/help/articles/how-to-use-text-styles/ | Einen Teil eines Textes markieren und im Properties Panel einen Text Style zuweisen. |
| T1.14 | Zeilenumbruch Enter vs. Shift+Enter | Canvas, Textelement | unbelegt | Kein offizieller Beleg für unterschiedliches Verhalten von Enter/Shift+Enter im Framer-Texteditor gefunden. |
| T1.15 | Inline-Formatierung per Tastenkürzel (Bold/Italic/Underline) | Canvas, Textelement | unbelegt | Nur schwach über Drittanbieter-Aggregatoren angedeutet, keine offizielle Framer-Quelle gefunden. |
| T1.16 | Mixed-Auswahl mehrerer Textlayer | Canvas, Mehrfachauswahl | unbelegt | Kein offizieller Beleg dafür gefunden, was der Editor bei gleichzeitiger Auswahl mehrerer Textelemente anzeigt. |
| T1.17 | Rechtschreibprüfung im Editiermodus | Canvas, Textelement | https://www.framer.com/marketplace/plugins/spelly-multilingual-spell-check/ | Keine native Rechtschreibprüfung; nur über Drittanbieter-Plugin „Spelly" (mehrsprachig) im Marketplace verfügbar. |
| T1.18 | Suchen/Ersetzen im Text | — | unbelegt | Keine Funktion in der offiziellen Dokumentation gefunden. |
| T1.19 | Editiermodus verlassen (Esc) | Canvas, Textelement | unbelegt | Nur ein schwacher Hinweis im CMS-Editierkontext, keine belastbare eigenständige Quelle. |
| T1.20 | Granularität der Textauswahl (Wort/Zeile per Doppel-/Dreifachklick) | Canvas, Textelement | unbelegt | Kein offizieller Beleg für das genaue Auswahlverhalten gefunden. |

## T2 — Text-Inspektor (rechte Seitenleiste am Textelement)

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung |
|---|---|---|---|---|
| T2.1 | Font Picker mit Tabs Google/Fontshare/Custom | Inspektor, Typography-Abschnitt | https://www.framer.com/help/articles/how-to-add-custom-fonts/ | Der Font-Picker gliedert sich in Tabs für Google Fonts, Fontshare und eigene hochgeladene Custom Fonts. |
| T2.2 | Font Weight 300–800 | Inspektor, Typography-Abschnitt | https://www.framer.com/help/articles/how-to-use-text-styles/ | Schriftstärke einstellbar im Bereich 300–800 (abhängig von den verfügbaren Schnitten der gewählten Schrift). |
| T2.3 | Font Loading Auto/Always/Never | Site Settings → Performance (Reichweite in Inspektor umstritten) | https://www.framer.com/help/articles/how-are-fonts-optimized-in-framer/ | Diese Quelle beschreibt Lade-/Optimierungsverhalten (size-adjust, Subsetting, WOFF2-Konvertierung, Inter/Inter Display als Standardschrift); ein separater Unteragent fand keinen expliziten Auto/Always/Never-Schalter — als **widersprüchlich, im Zweifel selbst live prüfen** markiert. |
| T2.4 | Größe in REM-Einheiten | Inspektor, Typography-Abschnitt, Text Styles | https://www.framer.com/updates/april-update-2025 | Schriftgröße als REM angebbar, mit einem Basiswert, der pro Breakpoint änderbar und in Layout Templates zentral definierbar ist. |
| T2.5 | Fit Text (technische Umsetzung) | Inspektor, Größen-Modus | https://www.framer.com/blog/fit-text-feature/ | Serverseitig über SVG viewBox/foreignObject umgesetzt, mit Min/Max Width als Begrenzung — vermeidet Layout-Flashes. |
| T2.6 | Letter Spacing, Line Height, Paragraph Spacing je Breakpoint | Inspektor, Text Style Editor | https://www.framer.com/help/articles/setting-text-styles-breakpoints/ | Diese drei Werte sind Teil eines Text Styles und lassen sich je Breakpoint (Desktop/Tablet/Mobile) unterschiedlich setzen. |
| T2.7 | Align (Start/Center/End/Justify) | Inspektor, Typography-Abschnitt | unbelegt | Die referenzierte Lektion (framer.com/academy/lessons/framer-fundamentals-text-properties) war nicht abrufbar; keine andere offizielle Bestätigung der genauen Wertliste gefunden. |
| T2.8 | Text Direction / RTL | Site Settings → General → Layout Direction (site-weit, nicht je Element) | https://www.framer.com/help/articles/rtl-best-practices/ | RTL wird site-weit über „Reverse Layout" umgeschaltet, ergänzt um Layout-Direction-Variablen — kein reines Element-Feld. |
| T2.9 | Text Transform (uppercase/lowercase/capitalize) | Inspektor, Typography-Abschnitt | unbelegt | Nur über inoffizielle „Classic"-Dokumentation angedeutet, keine tragfähige offizielle Quelle gefunden. |
| T2.10 | Text Decoration (Underline/Strikethrough) | Inspektor, Typography-Abschnitt | unbelegt | Ebenfalls nur inoffiziell angedeutet, nicht offiziell belegt. |
| T2.11 | Color-Override ohne neuen Style + Link-States (Hover/Active/Current) | Inspektor, Typography-Abschnitt | https://www.framer.com/help/articles/how-to-use-text-styles/ | Die Farbe lässt sich pro Instanz überschreiben, ohne einen neuen Text Style zu erzeugen; für Links existieren eigene Zustände Hover/Active/Current. |
| T2.12 | Style-Chip (Text Styles am Element) | Inspektor, Text-Abschnitt | https://www.framer.com/help/articles/how-to-use-text-styles/ | Ein zugewiesener Text Style erscheint als Chip; „×" entfernt ihn; mehrere Styles können an einem Element kombiniert sein. |
| T2.13 | Neuen Text Style anlegen | Assets-Panel → Styles → „+" → Text | https://www.framer.com/help/articles/how-to-use-text-styles/ | Neue Text Styles werden zentral im Assets-Bereich angelegt, nicht nur ad hoc am Element. |
| T2.14 | Text Style bearbeiten (Edit Style) | Assets-Panel bzw. Style-Chip → Edit | https://www.framer.com/help/articles/how-to-use-text-styles/ | Ein Dialog „Edit Style" erlaubt zentrales Ändern; Styles lassen sich in den Assets umbenennen oder löschen. |
| T2.15 | Text Style lösen/entkoppeln (Detach) | — | unbelegt | Nur für Components dokumentiert („Unlink Components", https://www.framer.com/help/articles/unlink-components/); für Text Styles selbst keine eigene Detach-Funktion belegt. |
| T2.16 | Breakpoint-Overrides an Text Styles | Text Style Editor → „Add Breakpoints" | https://www.framer.com/help/articles/setting-text-styles-breakpoints/ | Fügt Desktop/Tablet/Mobile-Varianten eines Styles hinzu, mit eigenen Werten für Font Size, Line Height, Letter Spacing, Paragraph Spacing. |
| T2.17 | Text-Style-Breakpoints funktionieren nicht in Components | Components (Einschränkung) | https://www.framer.com/help/articles/why-aren-t-my-text-style-breakpoints-working-in-components/ | Dokumentierte Einschränkung: Breakpoint-Overrides von Text Styles greifen innerhalb von Components nicht wie erwartet. |
| T2.18 | Responsive Font Size / Fluid Type über REM-Basiswert | Layout Templates, Text Style Editor | https://www.framer.com/updates/april-update-2025 | Ein zentraler REM-Basiswert je Breakpoint skaliert alle darauf bezogenen Textgrößen proportional, ohne jeden Style einzeln anzufassen. |
| T2.19 | Variable Fonts (Slider Weight/Width) | Font Picker, Filter „Variable" | https://www.framer.com/updates/variable-fonts | Zeigt Schriften mit variablen Achsen (Width/Weight/Slant je nach Schrift); Achsen sind laut Update animierbar über Variants. Ein separater, nur über hyperframer.com (Drittanbieter) belegter Hinweis auf Slider mit Rechtsklick-Reset ist als unbelegt zu behandeln. |
| T2.20 | OpenType-Features | Font Picker / Typography-Abschnitt, Suche + Live-Vorschau | https://www.framer.com/updates/july-update-2024 , https://www.framer.com/updates/opentype-google-fonts | Stylistic Sets, Character Variants, Ligaturen; eingeführt Juli 2024 zunächst für Fontshare/Custom/Inter 4.0, später auf über 1.400 Google Fonts erweitert (16.01.2025). Tabular Numbers als eigenes Feature: unbelegt. |
| T2.21 | Weitere Juli-2024-Typografie-Funktionen im selben Update wie OpenType | Inspektor, Typography-Abschnitt | https://www.framer.com/updates/july-update-2024 | Im selben Update kamen Text Effects, Text Balance, Text Stroke und Text Masks hinzu. |
| T2.22 | Rich Text aus dem CMS | CMS-Feldtyp „Rich Text", Editor + Markdown | https://www.framer.com/help/articles/using-markdown-in-the-cms/ | Unterstützt Headings, Absätze, Listen, Tabellen, Code, Blockquotes; Einfügen von Markdown wird automatisch konvertiert, Export als Markdown möglich; Links relativ oder absolut. |
| T2.23 | Tag-Wahl (H1–H6, p, span) | Accessibility-Panel am Textelement | https://www.framer.com/help/articles/text-styles-and-semantic-tags/ | Text Styles erhalten automatisch ein semantisches HTML-Tag; das lässt sich pro Instanz im Accessibility-Panel überschreiben. |
| T2.24 | Accessibility bei Text (Aria Label, Tab-Reihenfolge, Reduced Motion) | Accessibility-Panel | https://www.framer.com/help/articles/guide-to-web-accessibility-in-framer/ , https://www.framer.com/help/articles/improving-accessibility-with-aria-labels/ | Aria-Label je Element setzbar; Tab-Reihenfolge und eine Reduced-Motion-Option sind Teil desselben Accessibility-Leitfadens. |
| T2.25 | Text-Variablen in Komponenten | Component Properties | unbelegt (nur Snippet ohne tragfähige Primärquelle) | Genannte Variablentypen (plain text, formatted text, link, image, color, toggle, option, number, event, date) ließen sich nicht an einer offiziellen Einzelquelle festmachen — als unbelegt markiert. |
| T2.26 | Text Style als Component-Variable | Community-Feature-Request | https://www.framer.com/community/c/requests/add-text-style-as-a-component-variable | Laut Community-Diskussion aktuell NICHT möglich, einen Text Style selbst als Component-Variable zu führen (Feature-Wunsch, kein bestehendes Feature). |

## T3 — Fonts

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung |
|---|---|---|---|---|
| T3.1 | Google Fonts Integration | Font Picker, Tab „Google" | https://www.framer.com/help/articles/how-are-fonts-optimized-in-framer/ | Google Fonts direkt im Picker wählbar; Schriften werden automatisch subgesetzt (Subsetting) für kleinere Dateigrößen. |
| T3.2 | OpenType für Google Fonts | Font Picker, Tab „Google" | https://www.framer.com/updates/opentype-google-fonts | Seit 16.01.2025 stehen OpenType-Features (Stylistic Sets, Character Variants u. a.) für über 1.400 Google Fonts zur Verfügung. |
| T3.3 | Fontshare Integration | Font Picker, Tab „Fontshare" | https://www.framer.com/updates/fontshare | Seit 04.07.2023 alle Fontshare-Fonts nutzbar, inklusive `font-display: swap`. |
| T3.4 | Custom Fonts hochladen | Textlayer → Typography → Font-Name → Font Picker → Tab „Custom" → „Upload Fonts" | https://www.framer.com/help/articles/how-to-add-custom-fonts/ | Unterstützte Formate: WOFF2, WOFF, TTF, OTF (WOFF2 empfohlen); je Schriftschnitt eine eigene Datei hochladen; Fonts sind projektbezogen; Hinweis auf Lizenzprüfung durch den Nutzer. |
| T3.5 | Custom Fonts 2.0 | Font Picker, Tab „Custom" | https://www.framer.com/updates/november-update-2025 | Update November 2025: Gruppierung hochgeladener Schriften nach Familie, Live-Vorschau im Picker. |
| T3.6 | Font-Preloading als eigene Einstellung | Site Settings (vermutet) | unbelegt | Kein eigener Preloading-Schalter in der Doku gefunden; verwandtes Verhalten (Subsetting, WOFF2, size-adjust) ist unter „Wie Fonts optimiert werden" beschrieben, aber ohne expliziten „Preload"-Begriff. |
| T3.7 | Fallback-Fonts / Font-Stack-Verhalten | automatisch, site-weit | https://www.framer.com/help/articles/how-are-fonts-optimized-in-framer/ | Über `font-display: swap` und `size-adjust` wird das Layout-Verschieben beim Nachladen einer Schrift reduziert; Inter/Inter Display gelten als Standardschrift. |
| T3.8 | Variable Fonts | Font Picker, Filter „Variable" | https://www.framer.com/updates/variable-fonts | Zeigt Schriften mit variablen Achsen (Width/Weight/Slant abhängig von der jeweiligen Schriftfamilie); Achsenwerte laut Update über Variants animierbar. |

## T4 — Localization / Lokalisierung von Text

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung |
|---|---|---|---|---|
| T4.1 | Unterstützte Sprachen | Localization-Bereich | https://www.framer.com/help/articles/supported-languages-for-localization/ | Framer unterstützt 238 Sprachen für die Lokalisierung einer Site. |
| T4.2 | Neue Locale hinzufügen | Menü oben links → Localization → „Add Locale" | https://www.framer.com/help/articles/adding-a-new-locale/ | Legt eine neue Sprachversion an, mit wählbarer Fallback-Sprache; eine Lokalisierungstabelle zeigt den Stand je Seite; ein Locale-Symbol in der unteren Leiste erlaubt das Umschalten der Bearbeitungssprache direkt im Canvas. |
| T4.3 | Auto Translate | Localization-Bereich | https://www.framer.com/help/articles/auto-translate-for-localization/ , https://www.framer.com/help/localization/ | Automatische Übersetzung per LLM, mit Modellwahl oder „Auto"; deckt auch CMS-Inhalte und Shopify-Inhalte ab. |
| T4.4 | Lokalisierte Seitenpfade | URL-Struktur je Locale | https://www.framer.com/help/articles/localized-page-paths/ | Pfade wie `/en/about`; „Translate Page Paths" übersetzt auch den URL-Slug; Rechtsklick → „Rename in [Language]" für einzelne Pfad-Anpassungen. |
| T4.5 | Zusammenspiel mit Rewrites/Custom Headers | Site Settings, Locale-Pattern | https://www.framer.com/help/articles/localized-paths-how-they-work-with-rewrites-and-custom-headers/ | Rewrites und benutzerdefinierte Headers lassen sich je Locale-Pfadmuster konfigurieren. |
| T4.6 | Automatic Locale (Browser-/Zeitzonenerkennung) | Site-weite Einstellung | https://www.framer.com/help/articles/how-does-automatic-locale-work/ | Leitet Besucher automatisch anhand von Browsersprache und Zeitzone weiter; nur die kanonische URL wird dabei berücksichtigt, und die Erkennung greift nur ausgehend von der Default-Locale. |
| T4.7 | RTL-Unterstützung in der Lokalisierung | Localization-Bereich | https://www.framer.com/help/localization/ | Rechts-nach-links-Sprachen werden im Rahmen der Lokalisierung unterstützt (siehe auch T2.8 zur site-weiten Layout-Direction). |
| T4.8 | Collection Groups für lokalisierten CMS-Content | CMS + Localization | https://www.framer.com/updates/localization-update-collection-groups | Erlaubt, CMS-Collections im Rahmen der Lokalisierung zu gruppieren (Update-Ankündigung). |
| T4.9 | Default-Locale ohne URL-Präfix | URL-Struktur | unbelegt | Kein expliziter Beleg gefunden, ob/dass die Standardsprache ohne Sprachpräfix in der URL läuft. |

## T5 — Text-Effekte

| Nr | Funktion | Wo in Framer | Quelle (URL) | Beschreibung |
|---|---|---|---|---|
| T5.1 | Text Effect (Reveal/Appear) | Properties → Effects → Text Effect | https://www.framer.com/academy/lessons/framer-animations-text-effects | Trigger „On Appear" / „Layer in View" / „Section in View"; Gliederung per Character/Word/Line/Element; Presets u. a. Blur, Flip, Shake; Parameter Opacity, Scale, Blur, Y-Offset, Transition, Delay, Stagger. |
| T5.2 | Ticker (Laufband) | Effects-Menü am Element | unbelegt (nur Snippet) | Vermutete Parameter Richtung, Geschwindigkeit, Abstand, Hover-Verhalten sind nicht an einer tragfähigen offiziellen Quelle belegt. |
| T5.3 | Ticker RTL-Unterstützung | Effects-Menü, Ticker | https://www.framer.com/updates/november-update-2025 | Im November-2025-Update wird RTL-Unterstützung für den Ticker-Effekt genannt — indirekter Beleg, dass der Ticker-Effekt existiert. |

---

## T6 — Zählung

| Bereich | Zeilen |
|---|---|
| T1 Textbearbeitung auf dem Canvas | 20 |
| T2 Text-Inspektor | 26 |
| T3 Fonts | 8 |
| T4 Localization | 9 |
| T5 Text-Effekte | 3 |
| **Gesamt** | **66** |

Davon als „unbelegt" markiert: T1.7, T1.14, T1.15, T1.16, T1.18, T1.19, T1.20,
T2.7, T2.9, T2.10, T2.15 (teilweise — für Components belegt, für Text Styles
nicht), T2.19 (Slider-Detail), T2.21 (Tabular Numbers), T2.25, T3.6, T4.9, T5.2
— 17 von 66 Zeilen. T2.3 (Font Loading Auto/Always/Never) ist als
„widersprüchlich, im Zweifel selbst live prüfen" markiert, nicht als
vollständig unbelegt, da eine Quelle verwandtes Optimierungsverhalten
bestätigt, ein expliziter Dreiwege-Schalter aber nicht auffindbar war.
