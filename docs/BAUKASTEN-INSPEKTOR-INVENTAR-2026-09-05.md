# Inventar: Einstellungsleiste (Inspektor) des Website-Baukasten-Editors

Nur lesend erstellt am 2026-09-05. Grundlage: die im Auftrag genannten Dateien,
Stand des Arbeitsbaums zum Zeitpunkt der Untersuchung. Zeilenangaben beziehen
sich auf die gelesenen Dateien und können sich bei künftigen Änderungen
verschieben.

## Legende

- **Bereich**: Container-Inspektor / Baustein-Inhalt / Baustein-Design /
  Region / Design-Panel-Unterseite
- **Speicherort**: der `settings`-Schlüssel am Block (`site_blocks.settings`,
  jsonb), der `content`-Schlüssel (`site_blocks.content`), oder das
  Branding-Feld (`site_configs`-Tabelle über `BrandingBase`/`ThemeFelder`)

---

## 1. Container-Inspektor (`web/components/website/editor/container-inspektor.tsx`)

Gilt für Abschnitt, Spalte, innere Spalte (`kind` = `section`/`column`/`inner_column`).

| Nr | Bereich | Feld | Datei:Zeile | Typ/Optionen | Speicherort | Einschränkung |
|---|---|---|---|---|---|---|
| 1 | Container | Ausrichten waagerecht (Anfang/Mitte/Ende) | `ausrichtungs-leiste.tsx:176-183` | Symbolgruppe (3 Knöpfe), Klick auf aktives setzt zurück | `settings.layout_verteilen` ODER `layout_ausrichten` (abhängig von `layout_richtung`) | nur an Containern, die Kinder haben |
| 2 | Container | Ausrichten senkrecht (Anfang/Mitte/Ende) | `ausrichtungs-leiste.tsx:189-196` | Symbolgruppe (3 Knöpfe) | jeweils das andere der beiden Felder oben | s.o. |
| 3 | Container | Breite füllen (Spalte auf 12/12) | `ausrichtungs-leiste.tsx:147-168`, `container-inspektor.tsx:196-204` | Umschaltknopf | `block.span = 12` | nur an Spalten (`istSpalte`), an Abschnitten ausgeblendet |
| 4 | Container | Name der Ebene | `container-inspektor.tsx:206-231` | Textfeld, max. 60 Zeichen, leer = Standardname | `settings.name` | — |
| 5 | Container | Breite (Spalte) | `container-inspektor.tsx:242-269` | Select: 1/4, 1/3, 1/2, 2/3, 3/4, 1/1 (Zwölftel-Werte 3/4/6/8/9/12) | `block.span` | nur sichtbar, wenn ≥2 Spalten sich den Abschnitt teilen |
| 6 | Container | Spaltenzahl (Anzeige) | `container-inspektor.tsx:277-283` | reine Anzeige | Anzahl Kind-Container | nur an Nicht-Spalten (Abschnitt/innere Spalte) |
| 7 | Container | Spalte hinzufügen | `container-inspektor.tsx:284-304` | Knopf, teilt Breite gleichmäßig neu auf | legt neuen `column`-Block an | deaktiviert ab 6 Spalten |
| 8 | Container | Spaltenliste (zu Spalte springen / löschen) | `container-inspektor.tsx:305-346` | Liste mit Navigations- und Löschknopf je Spalte | — | — |
| 9 | Container | Layout: Richtung | `container-inspektor.tsx:358-368` | Segment: untereinander (spalte) / nebeneinander (zeile) | `settings.layout_richtung` | — |
| 10 | Container | Layout: Verteilen | `container-inspektor.tsx:373-389` | Select: automatisch/Anfang/Mitte/Ende/Zwischen/Umgeben | `settings.layout_verteilen` | dieselbe Werte-Achse wie Ausrichtungsleiste (Ziel hängt von Richtung ab) |
| 11 | Container | Layout: Ausrichten | `container-inspektor.tsx:390-402` | Segment: Anfang/Mitte/Ende/Strecken | `settings.layout_ausrichten` | s.o. |
| 12 | Container | Layout: Abstand (gap) | `container-inspektor.tsx:403-412` | Schieber+Zahl, 0-160px, Standard 16 | `settings.layout_abstand` | Obergrenze 160 (Backend-CHECK) |
| 13 | Container | Layout: Umbruch | `container-inspektor.tsx:413-431` | Segment Ja/Nein | `settings.layout_umbruch` | dreiwertig (nicht gesetzt/ja/nein) |
| 14 | Container | Größe: Mindesthöhe | `container-inspektor.tsx:437-446` | Zahlfeld 0-2000px | `settings.min_hoehe` | — |
| 15 | Container | Größe: Maximale Breite | `container-inspektor.tsx:448-457` | Zahlfeld 320-2560px | `settings.max_breite` | nur an Nicht-Spalten |
| 16 | Container | Struktur: nach oben | `container-inspektor.tsx:465-471` | Knopf | `moveContainer` (Rang -1) | deaktiviert am ersten Platz |
| 17 | Container | Struktur: nach unten | `container-inspektor.tsx:472-479` | Knopf | `moveContainer` (Rang +1) | deaktiviert am letzten Platz |
| 18 | Container | Struktur: duplizieren | `container-inspektor.tsx:480-487` | Knopf | `duplicateContainer` | — |
| 19 | Container | Struktur: löschen | `container-inspektor.tsx:488-503` | Knopf, gefahr-Stil | `removeBlock`, danach Auswahl aufgehoben | — |
| 20 | Container → Design | (siehe Baustein-Design unten, `AbschnittDesign`) | `container-inspektor.tsx:510-520` | — | `settings` (dieselben Felder wie 21-31) | identische Komponente wie beim Baustein |

## 2. Baustein-Design (`AbschnittDesign`, `web/components/website/editor/abschnitt-design.tsx` + `abstands-feld.tsx` + `sichtbarkeit.ts`)

Wird sowohl im Container-Inspektor als auch (unten in) `AbschnittInspektor` (`StilBereich`) verwendet — zwei unterschiedliche Ausprägungen, s. Zeilen 21-31 vs. 32-36.

| Nr | Bereich | Feld | Datei:Zeile | Typ/Optionen | Speicherort | Einschränkung |
|---|---|---|---|---|---|---|
| 21 | Baustein-Design | Sichtbarkeit je Gerät (Desktop/Tablet/Mobil) | `abschnitt-design.tsx:37-69`, `sichtbarkeit.ts:30-53` | Toggle-Knöpfe je Gerät (Auge/durchgestrichenes Auge) | `settings.hidden_on` (Menge aus `desktop`/`tablet`/`mobil`) | Editor blendet nie wirklich aus (nur durchscheinend); Hinweis, falls auf allen Geräten versteckt |
| 22 | Baustein-Design | Abstand außen (Margin) oben/rechts/unten/links | `abstands-feld.tsx:108-114, 178-201` | Klick-Feld mit Zahl+Einheit (px/%/vh/vw), je Seite | `settings.margin_top/right/bottom/left` | 0 löscht den Schlüssel; links/rechts koppelbar |
| 23 | Baustein-Design | Abstand innen (Padding) oben/rechts/unten/links | `abstands-feld.tsx:116-123, 178-201` | wie oben, Einheit ohne Minus | `settings.padding_top/right/bottom/left` | wie oben |
| 24 | Baustein-Design | Kopplung links/rechts (Kettensymbol) | `abstands-feld.tsx:124-153` | Umschaltknopf | `settings.spacing_x_gekoppelt` | gilt für Margin UND Padding gemeinsam |

## 3. Baustein-Inhalt: `StilBereich` in `abschnitt-inspektor.tsx` (Darstellung je Abschnitt, zweite/ältere Implementierung)

Erscheint am Ende jedes Baustein-Formulars unter „Darstellung" (eingeklappt).

| Nr | Bereich | Feld | Datei:Zeile | Typ/Optionen | Speicherort | Einschränkung |
|---|---|---|---|---|---|---|
| 25 | Baustein-Inhalt | Hintergrundfarbe | `abschnitt-inspektor.tsx:330-355` | Farbwähler (`<input type=color>`) + Entfernen-Knopf | `settings.background_color` | Hex 6-stellig |
| 26 | Baustein-Inhalt | Hintergrundbild | `abschnitt-inspektor.tsx:357-361` | `BildFeld` (Mediathek) | `settings.background_image_url` | href-Allowlist (http(s)/relativ) |
| 27 | Baustein-Inhalt | Abdunkeln (Overlay-Deckung) | `abschnitt-inspektor.tsx:363-387` | Schieber 0-90%, Schritt 5 | `settings.background_overlay` | nur sichtbar, wenn Hintergrundbild gesetzt ist |
| 28 | Baustein-Inhalt | Abstand (Innenabstand-Preset) | `abschnitt-inspektor.tsx:389-403` | Select: none/sm/md/lg | `settings.padding` | Backend-Standard "md" |

Explizit NICHT angeboten, obwohl im Backend-Schema (`BlockSettings`) vorhanden: `full_width`, `opacity`, `radius`, `rotation` (Kommentar Zeile 405-412: stammen vom alten Framer-Canvas, Renderer liest sie nicht aus, wären Attrappen).

## 4. Ausrichtungsleiste (`web/components/website/editor/ausrichtungs-leiste.tsx`)

Bereits vollständig unter Container-Inspektor (Zeilen 1-3) erfasst — sie ist ein eigenständiges, wiederverwendbares Bauteil, das nur am Container-Inspektor eingebunden wird.

## 5. Region-Inspektor (`web/components/website/editor/region-inspektor.tsx`)

Gilt für Kopf-/Fußzeile und ihre Teile (Logo, Navigation, Sprachwähler, Buchen-Knopf, Social, Bildnachweise, Copyright, Slogan).

| Nr | Bereich | Feld | Datei:Zeile | Typ/Optionen | Speicherort | Einschränkung |
|---|---|---|---|---|---|---|
| 29 | Region | Sichtbarkeit je Gerät | `region-inspektor.tsx:102-134` | Toggle-Knöpfe je Gerät, aktuelles Vorschaugerät markiert (Ring) | `header_teile`/`footer_teile` → Teil-Stand `hidden_on` (`@nextdays/baukasten-stil`, `teilStand`) | — |
| 30 | Region | Sperren | `region-inspektor.tsx:136-144` | Checkbox | Teil-Stand `locked` | gesperrt = nicht verschiebbar |
| 31 | Region | Reihenfolge (nach oben/unten) | `region-inspektor.tsx:146-171` | zwei Knöpfe | Reihenfolge der beweglichen Teile (`teileReihenfolge`) | nur bei Teilen mit Platz in der beweglichen Gruppe; deaktiviert bei `locked` oder an den Rändern; „fest im Theme" als Hinweis, wenn kein Platz |
| 32 | Region | Einstellungen-Verweise (z. B. „Farben", „Layout", „Logo", „Seiten", „Sprachen", „Kontakt", „Mediathek") | `region-inspektor.tsx:32-51, 174-192` | Verweis-Knöpfe, führen in Design-Unterseite oder Baukasten-Pfad | — (Navigation, kein eigener Speicherort) | abhängig vom Teiltyp (`ZIELE`-Tabelle) |

## 6. Design-Panel-Unterseiten (`web/components/website/design/*.tsx`, geroutet über `DesignPanel`/`DesignLeiste`)

### 6a. Logo (`design-leiste.tsx:242-345`)

| Nr | Feld | Zeile | Typ/Optionen | Speicherort | Einschränkung |
|---|---|---|---|---|---|
| 33 | Logo-Bild | 249-253 | `BildFeld` (Mediathek) | `logo_url` | href-Allowlist |
| 34 | Logo-Größe | 255-267 | Schieber 0.5×-3.0×, Schritt 0.1 | `logo_scale` | — |
| 35 | Logo-Ziel (Link) | 269-280 | Textfeld, max. 500 Zeichen | `logo_link_url` | href-Allowlist |
| 36 | Firmenname (Site-Name) | 285-292 | Textfeld, max. 80 Zeichen | `site_name` | — |
| 37 | Firmenname: Schriftart | 295-300 | `SchriftFeld` (Select aus Font-Katalog) | `logo_name_font` | „erbt Marken-Schrift" als Leerwert |
| 38 | Firmenname: Größe | 301-315 | Schieber 8-48px | `logo_name_size` | — |
| 39 | Slogan-Text | 320-327 | Textfeld, max. 120 Zeichen | `tagline` | — |
| 40 | Slogan: Schriftart | 328-333 | `SchriftFeld` | `slogan_font` | — |
| 41 | Favicon | 336-343 | `BildFeld` | `favicon_url` | href-Allowlist |

### 6b. Site-Layout (`design-leiste.tsx:349-399`)

| Nr | Feld | Zeile | Typ/Optionen | Speicherort | Einschränkung |
|---|---|---|---|---|---|
| 42 | Theme (Layout) | 355-387 | 4 Bild-Kacheln: klar/mitte/karte/seitlich | `theme` | „seitlich" fällt unter 1090px auf waagerechte Kopfzeile zurück (Hinweistext) |

### 6c. Farben (`design-leiste.tsx:402-490`, `designfarben.tsx`, `farbwaehler.tsx`, `paletten-waehler.tsx`)

| Nr | Feld | Zeile | Typ/Optionen | Speicherort | Einschränkung |
|---|---|---|---|---|---|
| 43 | Designfarben-Palette (Liste) | `designfarben.tsx:124-243` | Liste aus Farbkreis+Name+Hex, umbenennbar, löschbar | `theme_colors` (Liste `{id,name,color}`) | max. 30 Einträge (`MAX_FARBEN`) |
| 44 | Designfarbe hinzufügen | `designfarben.tsx:210-219` | Knopf (neu #000000) | ergänzt `theme_colors` | deaktiviert wenn voll |
| 45 | Farben aus Logo übernehmen | `designfarben.tsx:220-230` | Knopf, KI-artige Farbauslese aus Logo | ergänzt `theme_colors` | nur wenn Logo gesetzt; Fehlermeldungen (kein Logo/nicht lesbar/gesperrt/leer) |
| 46 | Fertige Farbpalette wählen | `design-leiste.tsx:440-470` | `PalettenWaehler`, kuratierte Kombinationen | setzt `primary_color`, `secondary_color`, `background_color`, `foreground_color`; löst Verknüpfungen | — |
| 47 | Farbrolle: Firmenname | `design-leiste.tsx:472-486`, `FARBROLLEN`-Tabelle Z.77-79 | `Farbwaehler` (Hex + Palette-Verknüpfung + Kontrastwarnung) | `brand_name_color` | Kontrast gegen Kopf-Hintergrund/-Vordergrund |
| 48 | Farbrolle: Kopf-Hintergrund | 82-90 | wie oben | `header_background` | Kontrast gegen Kopf-Link/-Vordergrund |
| 49 | Farbrolle: Kopf-Links | 87-90 | wie oben | `header_link_color` | Kontrast gegen Kopf-Hintergrund |
| 50 | Farbrolle: Primär (Buttons) | 94 | wie oben | `primary_color` | Kontrast gegen weiß (Button-Text) |
| 51 | Farbrolle: Links | 95 | wie oben | `link_color` | Kontrast gegen Hintergrund |
| 52 | Farbrolle: Fuß-Hintergrund | 97-100 | wie oben | `footer_background` | Kontrast gegen Link/Vordergrund |
| 53 | Farbrolle: Hintergrund | 102-105 | wie oben | `background_color` | Kontrast gegen Vordergrund |
| 54 | Farbrolle: Schrift (Vordergrund) | 107-110 | wie oben | `foreground_color` | Kontrast gegen Hintergrund |
| 55 | Farbrolle: Fläche (Sekundär) | 112-115 | wie oben | `secondary_color` | Kontrast gegen Vordergrund |
| 56 | Farbe mit Designfarbe verknüpfen/lösen | `design-leiste.tsx:210-221`, `farbwaehler.tsx` | Knopf je Farbwähler | `theme_color_links` (dict Rolle→Farb-ID) | serverseitig durchgesetzt; feldweise Bindung |

### 6d. Text (`design-leiste.tsx:493-585`, `text-rollen.tsx`)

| Nr | Feld | Zeile | Typ/Optionen | Speicherort | Einschränkung |
|---|---|---|---|---|---|
| 57 | Schrift Überschriften | `design-leiste.tsx:501-506` | `SchriftFeld` (Select) | `heading_font` | — |
| 58 | Schrift Absatz | 507-512 | `SchriftFeld` | `font_family` | — |
| 59-66 | Text-Rolle je DFLT/PAR/H1-H6: Schrift | `text-rollen.tsx:134-148` | Select, „erbt Marken-Schrift" als Leerwert | `text_styles.<rolle>.font` | 8 Rollen (dflt, par, h1-h6) |
| 67-... | …: Größe Desktop | 150-159 | Zahl 8-200px, dritter Zustand „Standard" | `text_styles.<rolle>.size_desktop` | — |
| ... | …: Größe Mobil | 160-169 | Zahl 8-200px | `text_styles.<rolle>.size_mobile` | — |
| ... | …: Text skalieren | 171-176 | Checkbox | `text_styles.<rolle>.scale_text` | — |
| ... | …: Schriftstärke | 178-196 | Select 100-900 (Hunderterschritte) | `text_styles.<rolle>.weight` | Backend erzwingt Hunderterschritt |
| ... | …: Zeilenhöhe | 198-207 | Zahl 0.8-3.0, Schritt 0.05 | `text_styles.<rolle>.line_height` | — |
| ... | …: Laufweite | 208-217 | Zahl -0.1 bis 0.5em, Schritt 0.01 | `text_styles.<rolle>.letter_spacing` | — |
| ... | …: Großbuchstaben | 219-223 | Checkbox | `text_styles.<rolle>.uppercase` | — |
| ... | …: Schatten | 225-238 | Select: keiner/weich/hart | `text_styles.<rolle>.shadow` | — |
| ... | …: Farbe | 241-250 | `Farbwaehler` (mit Palette-Verknüpfung, Kontrast) | `text_styles.<rolle>.color` | — |
| 68 | DFLT: Link-Farbe normal | `text-rollen.tsx:260-269` | `Farbwaehler` | `text_styles.dflt.link_color` | nur bei Rolle DFLT |
| 69 | DFLT: Link-Farbe Hover | 270-279 | `Farbwaehler` | `text_styles.dflt.link_hover_color` | nur bei Rolle DFLT |
| 70 | DFLT: Link-Farbe besucht | 280-289 | `Farbwaehler` | `text_styles.dflt.link_visited_color` | nur bei Rolle DFLT |
| 71 | DFLT: Link unterstrichen | 290-296 | Checkbox | `text_styles.dflt.link_underline` | nur bei Rolle DFLT |
| 72 | Größe Überschriften (global) | `design-leiste.tsx:560-570` | Schieber 80-130%, Schritt 5, mit Zurücksetzen | `heading_scale` | — |
| 73 | Größe Text (global) | 571-581 | Schieber 80-130% | `body_scale` | — |

### 6e. Buttons (`design-leiste.tsx:588-656`)

| Nr | Feld | Zeile | Typ/Optionen | Speicherort | Einschränkung |
|---|---|---|---|---|---|
| 74 | Button-Füllung | 595-607 | Select: solide/umrandet | `button_style` | — |
| 75 | Button-Ecken | 609-645 | 3 Bild-Kacheln: sharp/rounded/pill | `button_radius` | — |
| 76 | Button-Schrift | 647-652 | `SchriftFeld` | `button_font` | „wie Absatz" als Leerwert |

### 6f. Bilder (`design-leiste.tsx:659-677`)

| Nr | Feld | Zeile | Typ/Optionen | Speicherort | Einschränkung |
|---|---|---|---|---|---|
| 77 | Hero-Bild | 666-670 | `BildFeld` | `hero_image_url` | — |

(`lazy_loading` wird im Theme-Band als „geändert"-Indikator ausgelesen, hat aber keine eigene Eingabe in dieser Unterseite — siehe „Nur im Datenmodell" unten für den Aspekt der fehlenden UI, hier jedoch nicht zutreffend, da es sich um ein Branding-Feld mit Default handelt, das nirgends gesetzt werden kann.)

### 6g. Breite & Abstand (`design-leiste.tsx:680-708`, `breite-abstand.tsx`)

| Nr | Feld | Zeile | Typ/Optionen | Speicherort | Einschränkung |
|---|---|---|---|---|---|
| 78 | Vollbreite | `breite-abstand.tsx:100-113` | Checkbox | `content_full_width` | blendet Breitenregler aus, wenn aktiv |
| 79 | Inhaltsbreite: Vorgabe 1200px/1440px | 120-141 | Knöpfe | `content_width` + `content_width_unit="px"` | — |
| 80 | Inhaltsbreite: Eigener Wert | 142-157 | Knopf, aktiviert Schieber | `content_width` | — |
| 81 | Inhaltsbreite: Schieber+Einheit | 159-205 | Schieber (Grenzen je Einheit: px 960-1920, vw 50-100) + Select px/vw | `content_width`, `content_width_unit` | Umrechnung beim Einheitswechsel |
| 82 | Abstand vertikal (Abschnitte) | 214-219 | Schieber 0-200px, Schritt 4, mit Zurücksetzen | `section_spacing_y` | — |
| 83 | Abstand horizontal (Abschnitte) | 220-225 | Schieber 0-200px | `section_spacing_x` | — |
| 84 | Beide Abstände auf 0 | 226-232 | Knopf | setzt `section_spacing_y`/`_x` = 0 | anders als „Standard"-Reset (0 ≠ nicht gesetzt) |

### 6h. Grundansicht (Theme-Bänder, `theme-baender.tsx`)

Reine Übersichts-/Navigationsebene (keine eigenen Eingabefelder außer den „+"-Knöpfen, die in Unterseiten führen); Vorschauen der o. g. Felder (Palette-Streifen, Beispiel-Buttons, Text-Zeilen je Rolle).

---

## Zusammenfassung Feldanzahl

Rund 84 einzeln benannte Bedienelemente/Eingabefelder (manche Zeilen fassen mehrere Text-Rollen-Unterfelder zusammen, siehe Bereich 6d) über 6 Bereiche: Container-Inspektor, Baustein-Design (gemeinsame Komponente), Baustein-Inhalt (Darstellung/StilBereich), Region-Inspektor, Design-Panel (7 Unterseiten + Grundansicht).

Zusätzlich bietet der Baustein-Inhalts-Formularteil (`abschnitt-inspektor.tsx`, aus dem Katalog `abschnitte.ts` generiert) je Bausteintyp weitere fachliche Felder (Text, Bild, Liste, Formular, FAQ, Countdown, …) — diese sind NICHT Teil dieses Inventars, da sie inhaltliche Felder (`content`) und keine Darstellungs-/Layout-Einstellungen sind. Die Feldarten dafür sind in `abschnitte.ts:34-91` (FeldArt) und `98-108` (UnterFeldArt) katalogisiert.

---

## Nur im Datenmodell, ohne Oberfläche

Grundlage: `apps/api/src/features/site_config/schemas_darstellung.py` (`ContainerDarstellung`) und `packages/baukasten-stil/src/index.ts`. Geprüft per `grep` auf die Schlüsselnamen in `web/components/website/**/*.tsx` — keine Treffer als tatsächliches Eingabefeld (nur Kommentare/Kommentar-Erwähnungen bzw. Typdeklarationen im Stil-Paket selbst).

| Schlüssel (Backend/Stil-Paket) | Beschreibung | Fundort Modell | Fund in UI? |
|---|---|---|---|
| `position` (Unterobjekt: `typ`, `oben`, `rechts`, `unten`, `links`, `ebene`) | Framer-„Position": relativ/absolut/fixiert/klebend, Kantenabstände, z-Index | `schemas_darstellung.py:90-105`, `index.ts:71-78` | Nein — kein Eingabefeld in `container-inspektor.tsx`, `abschnitt-inspektor.tsx` oder sonstwo |
| `groesse` (Unterobjekt: `breite`/`hoehe` als `Mass` mit `modus`, `min_breite`, `max_breite`, `min_hoehe`, `max_hoehe`, `seitenverhaeltnis`) | Framer-„Size": Sizing-Modi (fest/relativ/viewport/füllen/inhalt), Seitenverhältnis-Kette | `schemas_darstellung.py:65-118`, `index.ts:79-87` | Nein — nur die flachen `min_hoehe`/`max_breite` (Zahlfeld in Container-Inspektor Karte „Größe") sind bedienbar, das ganze `groesse`-Unterobjekt (inkl. Sizing-Modus, Seitenverhältnis) nicht |
| `stil` (Unterobjekt: `opazitaet`, `sichtbar`, `fuellung`, `ueberlauf`, `radius`, `grenze`, `schatten`) | Framer-„Styles": Opazität, Sichtbarkeitsschalter, Verlaufs-/Bild-Füllung, Überlauf, Eckenradius je Ecke, Rahmen/Grenze, Schlagschatten (Liste) | `schemas_darstellung.py:127-211`, `index.ts:99-140` | Nein — Hintergrundfarbe/-bild/-abdunkeln existieren nur als separate Altbestand-Felder (`background_color`, `background_image_url`, `background_overlay`), NICHT als `stil.fuellung`; kein Radius-, Rahmen-, Schatten- oder Überlauf-Feld irgendwo |
| `transform` (Unterobjekt: `rotation`, `skalierung`, `versatz_x`, `versatz_y`, `neigung_x`, `neigung_y`, `ursprung`, `perspektive`) | Framer-„Transforms": Drehen, Skalieren, Verschieben, Neigen, Ursprung, Perspektive | `schemas_darstellung.py:213-229`, `index.ts:141-150` | Nein — keine einzige Transform-Einstellung im Editor |
| `scroll` (Unterobjekt: `anker`, `versatz_y`) | Framer-„Scroll Section": Sprungmarke (HTML-id) + Offset für feste Kopfzeile | `schemas_darstellung.py:232-237`, `index.ts:151` | Nein — kein Anker-/Sprungmarken-Feld im Editor (nur DOM-`scroll`-Ereignisse in unrelated Code) |
| `a11y` (Unterobjekt: `tag`, `label`, `tab_index`, `fuer_leser_verborgen`) | Framer-„Accessibility": HTML-Tag-Wahl, Aria-Label, Tab-Reihenfolge, Für-Screenreader-verborgen | `schemas_darstellung.py:240-249`, `index.ts:152-166` | Nein — kein Aria-Label-, Tag-Wahl- oder Tabindex-Feld; `aria-*`-Treffer im Code sind ausschließlich technische Attribute der Editor-Oberfläche selbst (Buttons/Inputs), nicht Kunden-Einstellungen |
| `je_geraet` (`tablet`, `mobil`, je mit vollem `GeraeteUeberschreibung`-Satz: Position/Größe/Stil/Transform + flache Layout-/Abstandsfelder) | Geräte-Überschreibungen für ALLE obigen Framer-Abschnitte plus Layout/Margin/Padding | `schemas_darstellung.py:252-291`, `index.ts:189-194, 536-546` | Nein — kein `je_geraet`-Schlüssel wird irgendwo im Frontend geschrieben; die Kaskaden-Logik in `baukasten-stil` liest ihn, aber es gibt keinen Editor-Weg, ihn zu befüllen. Die einzige geräteweise UI-Einstellung ist `hidden_on` (Sichtbarkeit je Gerät), was NICHT dasselbe ist wie eine Werte-Überschreibung |
| `opacity`, `radius`, `rotation` (flache Altfelder in `BlockSettings`, nicht die neuen Unterobjekte) | Reste vom alten Framer-Canvas | `schemas.py:614-617` | Nein — im Kommentar `abschnitt-inspektor.tsx:278-280, 405-412` ausdrücklich als „vom Renderer nicht ausgelesen" benannt und deshalb bewusst nicht angeboten |
| `full_width` (Block-Ebene, `BlockSettings.full_width`) | Baustein soll volle Breite nutzen | `schemas.py:612` | Nein — Kommentar in `abschnitt-inspektor.tsx:405-410`: jeder Abschnitt setzt seine Breite selbst im Renderer, ein Schalter dafür wäre wirkungslos |
| `visible` (Block-Ebene, `BlockSettings.visible`) | Baustein sichtbar/unsichtbar (Alt-Feld, unabhängig von `hidden_on`) | `schemas.py:615` | Nein — kein Schalter dafür; nur `hidden_on` (je Gerät) ist bedienbar |
| `lazy_loading` (Branding/`ThemeOeffentlich`) | Lazy-Loading der Bilder an/aus | `schemas.py` (`BrandingBase`, Zeile 251) | Nein — kein Schalter im Design-Panel; taucht nur als „geändert"-Indikator im Bilder-Band (`theme-baender.tsx:267`) auf, ohne eigenes Eingabefeld |
| `system_fonts_first` (Branding) | Systemschriften zuerst laden | `schemas.py:254` | Nein |
| `head_html`, `head_css`, `custom_js`, `checkout_js` (Branding, Code-Injection) | Freier Code in `<head>`/CSS/JS | `schemas.py:221-224` | Nein — in den untersuchten Design-/Editor-Dateien kein Eingabefeld (liegt vermutlich in einem separaten „Fortgeschritten"-Bereich außerhalb des Suchauftrags) |
| `schema_organization`, `schema_breadcrumbs`, `schema_lodging`, `schema_faq` (Branding, strukturierte Daten) | JSON-LD-Schalter | `schemas.py:246-249` | Nein — nicht in den untersuchten Dateien |
| `cookie_banner`, `privacy_consent`, `is_offline`, `cookie_policy_page_id`, `privacy_policy_page_id` (Branding) | Rechtliches/Hauptschalter | `schemas.py:227-231` | Nein — nicht in den untersuchten Dateien |
| `seo_title`, `seo_description`, `seo_keywords`, `noindex`, `gtag_id` (Branding) | SEO/AEO site-weit | `schemas.py:239-243` | Nein — nicht in den untersuchten Dateien (liegt vermutlich unter einem SEO-Reiter außerhalb des Suchauftrags) |
| `about_text`, `contact_text`, `social_links`, `booking_mode`, `show_guest_breakdown`, `show_base_prices` (Branding) | Diverse Konto-/Anzeigefelder | `schemas.py:186-215` | Nein — nicht in den untersuchten Design-Dateien (vermutlich Kontakt-/Buchungs-Einstellungen an anderer Stelle im Baukasten) |
| `languages`, `default_language` (Branding) | Sprachliste der Website | `schemas.py:210-211` | Nein — nicht in den untersuchten Dateien (Region-Inspektor verweist per Knopf auf `/website/einstellungen/sprachen`, das eigentliche Formular liegt aber außerhalb des Suchauftrags) |

---

## Nicht vorhanden

Geprüft per `grep -rn` über `web/components/website` (Editor- und Design-Verzeichnisse) nach den Suchbegriffen. Alle Treffer waren Fehlalarme (deutsche Wörter mit zufälligem Teilstring, Tailwind-Utility-Klassen, DOM-APIs) — keiner bezeichnet ein tatsächliches Kunden-Einstellungsfeld:

- **effekt/effect** — keine Treffer außer `dataTransfer.effectAllowed` (Drag&Drop-API des Browsers) und `useEffect` (React-Hook). Kein Effekt-Feld (z. B. Fade-in, Parallax) im Editor.
- **hover** — keine Hover-Zustands-Einstellung außer `link_hover_color` (bereits in Bereich 6d, Text-Rollen, dokumentiert). Kein generischer "Hover-Effekt" für Bausteine/Buttons.
- **appear** (Erscheinungsanimation) — keine Treffer außer CSS-Utility `appearance-none`. Keine "Appear on scroll"-Einstellung.
- **scroll animation** — keine Treffer. Der Begriff „scroll" kommt nur in unrelated Kontexten vor (Popup-Auslöser „bei X% gescrollt" in `regeln/schritte.tsx`, DOM-`scroll`-Ereignis-Listener, `scroll-margin-top` für Anker — letzteres ist Teil des nicht angebundenen `scroll`-Unterobjekts, siehe oben).
- **overlay** — nur `background_overlay` (Abdunkeln-Regler, Bereich 3/6f) und die UI-interne Komponente `FlaechenOverlay` (Editor-Auswahlrahmen, keine Kunden-Einstellung). Kein CSS-„Overlay"-Effekt-Feld.
- **cursor** — keine Treffer. Keine Cursor-Stil-Einstellung.
- **blend** (Blend-/Mischmodus) — keine Treffer außer dem deutschen Wortteil in „ausblenden"/„einblenden". Kein `mix-blend-mode`-Feld.
- **blur** (Weichzeichnung) — keine Treffer außer der DOM-Methode `element.blur()` (Fokus verlassen). Kein Weichzeichnungs-/Backdrop-Filter-Feld.
- **variable** (Variablen-Bindung) — keine Treffer außer im Kommentar zu variablen vs. nicht-variablen Schriftschnitten (`text-rollen.tsx:48`). Keine CSS-Variablen-/Token-Bindung als Nutzerfeld.
- **override** (Wert-Überschreibung als Konzept/Label) — keine Treffer. Die Geräte-Kaskade existiert im Datenmodell (`je_geraet`), aber es gibt keine UI, die das Wort oder das Konzept einer sichtbaren "Override"-Markierung nutzt.
- **mixed** (gemischter Zustand bei Mehrfachauswahl) — keine Treffer. Es gibt keine Mehrfachauswahl von Blöcken im Editor, folglich auch keinen "gemischt"-Zustand in Feldern.
- **link_to** (Ziel-Verknüpfung als generisches Konzept) — keine Treffer. Verlinkung existiert nur feldspezifisch (`logo_link_url`, Feldart `link` im Abschnitts-Katalog), nicht als generisches "Link zu"-Konzept am Container/Baustein.
- **aria** (als Kunden-Einstellung) — keine Treffer. Alle `aria-*`-Vorkommen in den durchsuchten Dateien sind technische Attribute der Editor-Bedienelemente selbst (z. B. `aria-label` an einem Icon-Knopf), keine vom Kunden editierbaren Aria-Label-Felder für Bausteine. Das einzige dafür vorgesehene Modellfeld ist `a11y.label`, das (wie oben dokumentiert) ohne Oberfläche ist.

