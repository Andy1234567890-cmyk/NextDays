# Framer-Editor — Gesamtabgleich mit unserem Baukasten (Stand 06.09.2026)

Quelle je Zeile: `docs/FRAMER-EDITOR-VOLLERFASSUNG-2026-09-05.md` (Kapitel 1–23,
Live-DOM des Kundenprojekts), ergänzt um `docs/FRAMER-STYLE-PANEL-LIVE-2026-09-05.md`
(§1–10) und die sechs Recherche-Dateien `docs/FRAMER-EDITOR-*-RECHERCHE.md`.

Spalte **Wir**: ✓ gebaut · ◐ teilweise/anders · ✗ fehlt · — bewusst nicht
(passt nicht zum Modell, Begründung in der Zeile). Dateipfade zeigen, wo es steht.

## 1 Fensteraufbau (Kap. 1, 12)

| Framer | Wir | Wo / Warum |
|---|---|---|
| Kopfleiste 51 px, Panels 260 px, Fläche dazwischen | ✓ | `editor/framer-schale.tsx` |
| Kopf links: Canvas ▾ · Insert · Layout · Text · Vector | ◐ | Canvas ▾ (unsere Bereiche) · Einfügen · Layout (öffnet Katalog) · Text · Bild; kein Vektor-Werkzeug (kein Vektormodell) |
| Kopf Mitte: Projektname · Branch `main` | ◐ | Seite · Sprache · Stand; keine Branches |
| Kopf rechts: Avatar · Preview · Invite · Publish | ◐ | Vorschau · Veröffentlichen; Invite = Team-Route, kein Popover |
| Schwebende Fußleiste: Select · Pan · Comment · Theme · Zoom % · Upgrade | ◐ | Auswahl · Hand · Dunkel/Hell · Zoom-Menü (`buehne.tsx`); kein Comment-Modus |
| Chrome per CSS-Variablen (`--framerInternalUI-*`), Panels absolut | — | drei Flex-Spalten; gleiche Maße, andere Technik |
| Editor-Theme Dark/Light über Body-Klasse | ✓ | `dunkel` in `abschnitts-editor.tsx`, localStorage |
| Panel-Ziehgriffe (resize-zone 6 px) | ✓ | `framer-schale.tsx` `usePanelBreiten` (200–420 px, localStorage) |

## 2 Linke Leiste (Kap. 2, 14)

| Framer | Wir | Wo / Warum |
|---|---|---|
| Reiter Pages · Layers · Assets | ✓ | Seiten · Ebenen · Mediathek |
| Pages: Suchfeld, Köpfe „Design +"/„Pages +", Zeilen mit 12-px-Symbol, Auswahl markiert | ✓ | `seiten/seiten-leiste.tsx` (06.09.2026) |
| Pages +: New Page · New CMS Page · New 404 · New Folder · Sort Alphabetically | ◐ | „+"-Menü: Neue Seite (Dialog kennt Seite/Ordner/404/extern/Pop-up) · Alphabetisch sortieren; CMS-Seite = Blog-Route |
| Seiten-Kontextmenü: Settings · Draft · Rename · Duplicate · Copy · Delete · A/B · Analytics · Set Home · Convert to CMS · Custom Code | ◐ | „…"-Menü: Bearbeiten · Einstellungen · hoch/runter · Bereich wechseln · Startseite · Entwurf halten · Veröffentlichen · Duplizieren · Löschen; kein A/B, kein Analytics, kein Copy |
| Layers: Seiten-Combobox, Suche, Baum mit Expand/Collapse, Badge Primary, Typ-Symbole, `#` Scroll Section, Ketten-Symbol Link, Blitz Effekte | ✓ | `ebenen-liste.tsx`: Baum, Suche, Auf-/Zuklappen, Primär-Badge, Symbole, Sperre, `#`/Kette/Blitz (06.09.2026) |
| Layers-Kürzel ⌘D ⌘L ⌘; ⌘R ⌫ ⌥↑↓ Pfeile | ✓ | `ebenen-liste.tsx` `tastatur()` |
| Layer-Drag im Baum (auch über Eltern) | ✓ | `EbenenZug` |
| Assets: Templates · Components · Styles · Vectors · Code | ◐ | Mediathek (Bilder/Videos) und Vorlagen-Panel; keine Komponenten/Styles/Vektoren/Code |

## 3 Rechte Leiste — Style-Panel (Kap. 4–11, 18, 19; Live-Doc §1–10)

| Framer | Wir | Wo / Warum |
|---|---|---|
| Reiter Agent · Style | ✓ | Agent = Platzhalter bis `OPENAI_API_KEY` (`agent-reiter.tsx`) |
| Ausrichtungsreihe 8 Knöpfe, Framers Symbole, ⌥A/H/D/W/V/S, ⌃⌥H/V | ✓ | `ausrichtungs-leiste.tsx`, `ausrichtungs-symbole.tsx` |
| Breakpoint-Wurzel: Template · Haltepunkt · Layout · Typography · Overlays · Cursor · Effects · Stile · Code | ✓ | `seiten-inspektor.tsx` (Werte aus Design/Vorlagen, Sprünge dorthin) |
| Link: Link zu · Abschnitt · Neuer Tab · Scrollen | ◐ | href · Abschnitt (Anker der Seite) · Neuer Tab; „Scrollen smooth/instant" nicht (global) |
| Link + : Rel · Parameters · Tracking | ◐ | Rel (4 Werte) · Parameter (Abfrageteil); Tracking fehlt (kein Ereignismodell) |
| Position: Typ Relative/Absolute/Fixed/Sticky, T/L/R/B, Pin-Widget, Sticky Top | ✓ | `PositionKarte` + `PinFeld` |
| Größe: Breite/Höhe mit Modus Fixed/Relative/Fill/Fit/Viewport, Lock Aspect Ratio, Min/Max Add…, Grow | ✓ | `GroesseKarte`: Modus, Kette (gemessen), Min/Max, Wachsen (3 Knöpfe, Bausteine) |
| Layout: Stack/Grid, Richtung, Verteilen (6), Ausrichten, Wrap, Gap Slider, Padding/per side | ✓ | Stapel (Richtung, Verteilen 5, Ausrichten 4, Umbruch, Abstand-Schieber, Innen/Außen je Seite) · Raster (Spalten, Zeilen, Abstand X/Y) — `layout_typ`, `raster_*` |
| Content (Collection List): Quelle · Zustand · Filter · Sortierung · Limit | — | CMS-Listen sind Bausteine mit eigenen Feldern (Objekte, Blog) |
| Effects +: Appear · Hover · Press · Loop · Drag · Lightbox · Ticker · Scroll ▸ · Flow, je Dialog | ◐ | `effekte`: Erscheinen (5 Arten, Dauer, Verzögerung, Wiederholen) · Überfahren · Drücken · Schleife (4 Arten) · Scroll-Tempo; Live-Skript `builder/components/blocks/effekte.tsx`. Fehlen: Drag, Lightbox, Ticker, Flow, Scroll Transform/Variant (Struktur-/Variantenmodell) |
| Overlays +: Relative · Fixed, Editing-Overlay-Modus | ✗ | Etappe 6 |
| Cursor +: Web Cursor · Custom · Set Variant | ◐ | Web-Cursor (11 Werte, `cursor`); Custom/Variant brauchen Komponenten |
| Styles: Opacity Slider · Visible · Fill (Solid/Linear/Radial/Conic/Image, Crop) · Overflow · Radius/per corner · Border · Shadows | ◐ | alles außer Conic-Verlauf und Crop |
| Styles +: Blending · Draggable · Filters · Mask · Overflow X/Y · Pointer Events · Selection · Tap Color · User Select · Z Index | ◐ | Mischmodus (12) · Filter (5) · Überlauf X/Y · Zeiger-Ereignisse · Textauswahl · Tippfarbe · Z Index (Position); fehlen Draggable, Mask, Selection |
| Transform: Scale · Skew · Rotate 2D/3D · Depth · Perspective · Origin · Backface · Preserve 3D | ✓ | `TransformKarte` (06.09.2026: X/Y-Drehung, Tiefe, Rückseite, 3D-Raum) |
| Text (Typography): Text Styles · Font-Picker · Schnitt · Size Px/Rem/Fit · Line · Letter · Align · Color · Tag · Content · OpenType | ◐ | Schrift-Rolle, Gewicht, Farbe, Größe px/rem, Laufweite, Zeilenhöhe, Ausrichten, Balance, Transformation, Dekoration, Kürzen, **OpenType (13 Merkmale)**; kein freier Font-Picker, keine Text Styles |
| Farben (Selection · Swatch · +1) | — | Projektfarben im Design-Panel |
| Scroll Section: Name · Offset Y | ✓ | `ScrollKarte` |
| Accessibility: Tag · Aria Label · Tab Index · Google Bot | ✓ | `ZugaenglichkeitKarte` (+ „für Vorlesehilfen verborgen") |
| Code Overrides: Datei · Override · Edit Code | — | kein Kundencode am Element (Wurzel 8); Kopf als Platzhalter |
| ⊕ Variable erzeugen (Komponenten-Property) | ✗ | keine Komponenten |
| Kopf „+" legt sofort an / „−" entfernt | — | bei uns öffnet „+" die Zeile leer, nichts wird erfunden (Wurzel 4) |
| Undo/Redo ⌘Z/⌘⇧Z | ◐ | Stil- und Inhaltsänderungen an Bausteinen (Verlauf im Editor, auch aus dem iframe); Strukturänderungen nicht (Server ohne Rückweg) |

## 4 Fläche (Kap. 6, 13, 16; Live-Doc §9)

| Framer | Wir | Wo / Warum |
|---|---|---|
| Breakpoint-Rahmen mit Titel-Pille (Akzent, 22 px), Abspielknopf 20 px, „+" Breakpoint | ✓ | `buehne.tsx` |
| Breakpoint +: Generate… · Tablet 810 · Phone 390 · Custom… | ◐ | Tablet · Mobil; kein Custom, kein Generate |
| Auswahlkante 1 px Akzent, Eckgriffe 9 px, Kantengriffe | ◐ | Kante ja; Griffe nein (Rahmenbreiten sind Konstanten) |
| Kamera: Zoom Z · ⌘+ · ⌘− · ⌘0 · ⌘1 · ⌘2, Space = Hand | ✓ | `useKamera` |
| Fast Zoom · Nudge Amount | ✗ | |
| Werkzeug-Kürzel (S Stack, T Text, I Insert, F Frame, R/O/P Vektor) | ◐ | Einfügen/Text über Kopfknöpfe; keine Buchstaben-Werkzeuge |
| Drag Insert-Kachel → Canvas/Stack | ✗ | Einfügen per Klick an die Auswahl; Etappe Canvas 3 |
| Canvas-Verschieben / Größe ziehen / Hilfslinien / Marquee | ✗ | Etappe Canvas 3–5 |
| Kontextmenü (Kap. 15): Component · Layout Template · Fit Content · Select ▸ · Align ▸ · Replace With ▸ · Copy ▸ · Paste ▸ · Move ▸ · Duplicate · Delete · Rename · Auto Rename · Lock · Hide · Overflow ▸ · Add Frame · Add Stack · Remove Frame | ◐ | Ebenen-Menü: Elternteil · Geschwister wählen ⇧⌘A · Duplizieren · Löschen · Umbenennen · Sperren · Verstecken · hoch/runter · Stil kopieren ⌥⌘C · Stil einfügen ⌥⌘V · Überlauf (4); fehlen: Align ▸ (steht in der Leiste), Replace With, Add/Remove Frame, Component |
| Comment-Modus | ✗ | |
| Multiplayer-Cursor | — | |

## 5 Hauptmenü, Modi, Settings (Kap. 20–22)

| Framer | Wir | Wo / Warum |
|---|---|---|
| Hauptmenü (Logo): File · Edit · View · Tool · Layout · Text · Vector · Component · Plugins · Code · Preferences · Help | ◐ | Canvas ▾ mit unseren Bereichen (Vorlagen, Design, Blog, Mediathek, SEO, Objekte, Regeln, Anfragen, Widgets, Einstellungen, Hilfe, Dashboard); keine Preferences |
| Modi ⌥1–⌥5: Canvas · CMS · Localization · Analytics · Settings | ◐ | CMS = Blog-Panel/Objekte; Localization = Sprachen im Design + Übersetzung; Analytics = Auswertung (eigene Route); Settings = Website-Einstellungen |
| Settings: General · Performance · Versions · Usage · Forms · Plans · Code · Domains · Multi Site · Headers · Redirects · Files · Page Settings | ◐ | General/SEO/Code/Domains/Redirects/Seiten-Einstellungen vorhanden; keine Versions, Usage, Plans, Multi Site, Headers, Files |
| Preview (⌘P): Kopf mit Back · Reload · Gerät · W/H | ◐ | Vorschau-Route |
| Publish-Popover: Domain · Stand · Update | ◐ | Veröffentlichen-Menü (Entwurf/Live) |
| Insert-Panel (Kap. 21): Icons-Packs, Shaders, Media, Forms, Interactive, Social, Utility, Creative, Collections, Fields | ◐ | Katalog nach Kategorien mit unseren Bausteinen; keine Shader/Third-Party-Embeds/Icon-Packs |
| Agent-Tab: Kontext-Combobox, Verlauf, Changes mit Undo | ◐ | Platzhalter bis Schlüssel |

## 6 Gebaut am 06.09.2026 (Etappen 4a + 4b)

- Modell: `link.anker · rel · parameter`, `transform` 3D, `a11y.nosnippet`, `cursor`,
  `stil.mischmodus · filter · ueberlauf_x/y · zeiger_ereignisse · text_auswahl ·
  tippfarbe`, `text.opentype`, `layout_typ`/`raster_*`, `effekte` — Schema, Paket
  (`effekteLesen`, `effekteCss`, `linkZiel`, `linkRel`, `EFFEKTE_KEYFRAMES`), Renderer
  (`effekte.tsx` einmal im Layout), Tests (Backend 41, Paket 49).
- Panel: Link-Abschnitt/Rel/Parameter, Pin-Widget, Wachsen, Gap-Schieber, Raster-Layout,
  Transform-3D, Google Bot, Cursor-Karte, Effekte-Karte, Stile-„+" (7), OpenType.
- Editor: Rückgängig/Wiederholen (⌘Z/⌘⇧Z, auch aus dem iframe), Stil kopieren/einfügen,
  Überlauf-Untermenü, Geschwister wählen, Ebenen-Marker (#, Kette, Blitz), ziehbare Panels.
- Seiten-Panel: „+"-Menü mit Alphabetisch sortieren.
- Sprachen: 24 Dateien, 12 951 Schlüssel, 0 fehlerhaft; Gleichstände begründet.

## 7 Offen (mit Grund)

| Framer | Grund |
|---|---|
| Overlays (Kap. 9), Drag/Lightbox/Ticker/Flow, Scroll Transform/Variant | brauchen Kind-Ebenen als Overlay bzw. Komponenten/Varianten — kein Modell |
| Code Overrides, Custom Cursor, Set Variant, ⊕ Variablen, Text Styles, Font-Picker | Kundencode (Wurzel 8) bzw. Komponenten-/Schriftenmodell fehlt |
| Canvas-Direktmanipulation (Ziehen, Griffe, Marquee), Insert per Drag | Etappe Canvas 3–5 |
| Rückgängig für Strukturänderungen | Struktur-Endpunkte haben keinen Rückweg |
| Comment-Modus, Multiplayer, Branches, A/B-Tests, Analytics-Modus, Plans/Usage/Versions | keine Entsprechung im Produkt |
| Breakpoint Custom/Generate, Fast Zoom, Nudge, Preferences | drei feste Geräte; Kürzel-Feinheiten offen |
