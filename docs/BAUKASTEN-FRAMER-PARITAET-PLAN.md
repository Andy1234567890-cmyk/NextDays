# Baukasten → Framer-Parität: Ebenen, Style-Inspektor, Agent (Plan vom 05.09.2026)

Auftrag (05.09.2026): *„unser pagebuilder soll wie bei framer sein bei layer … der
ganze layer/ebenenbereich hat bugs … wir bauen OpenAI ein, alles muss rein."*
Referenz sind die drei Bildschirmfotos des Nutzers (Style-Panel für Frame und
Template, Layers-Panel mit Breakpoints) sowie `docs/FRAMER-STYLE-PANEL-ANALYSE.md`
(Textfall, live vermessen 28.08.2026) und `docs/FRAMER-FEATURES.md`.

Hinweis zum Ist-Stand: `FRAMER-FEATURES.md` führt unter „Bereits gebaut" Pins,
Snapping, Variablen-Editor, motion-Effekte. **Davon steht nichts im Repo**
(`grep Pins|Snapping|setVariable|motion/react web/components/website` → leer).
Der Abschnitt beschreibt einen Prototyp, der nicht eingecheckt wurde. Der
Ist-Stand ist der unten beschriebene.

## Ist-Stand (Code, 05.09.2026)

| Bereich | Datei | Stand |
|---|---|---|
| Ebenen | `web/components/website/ebenen-liste.tsx` | Baum Abschnitt → Spalte → innere Spalte → Baustein, Rechtsklick-Menü mit Suche, Auge je Gerät (`settings.hidden_on`), Drag „vor/nach/hinein" nur für Bausteine. **Fehlerprüfung läuft** (Ergebnis unten anhängen). Keine Breakpoint-Wurzeln, keine Seitenwahl, kein Suchfeld oben, kein Sperren, kein Umbenennen inline, keine Mehrfachauswahl. |
| Inspektor Container | `editor/container-inspektor.tsx` | Name, Breite, Spalten, Layout (Richtung/Verteilen/Ausrichten/Abstand/Umbruch), Größe (Min-Höhe/Max-Breite), Struktur (hoch/runter/duplizieren/löschen), Design-Karte. |
| Inspektor Baustein | `editor/abschnitt-inspektor.tsx` | Felder je Blocktyp, Stil-Bereich (`StilBereich`), Ausrichtungsleiste. |
| Stil-Modell | `apps/api/.../schemas_darstellung.py` `ContainerDarstellung` | `locked`, `layout_*`, `min_hoehe`, `max_breite`, `margin_*`, `padding_*`, `spacing_x_gekoppelt`. Ein Wert für alle Geräte; nur `hidden_on` ist gerätespezifisch. |
| Renderer | `builder/components/blocks/block-renderer.tsx` | `bgStyle`, `abstandStil`, `groessenStil`, `layoutStil`, `sichtbarkeitKlasse`. |
| KI | `apps/api/src/core/ki/client.py` `VertexClient` (Gemini) · `site_config/ki_router.py` (umschreiben, seo, abschnitt, blogbeitrag, alt-text, profil) | Ein Anbieter, fest verdrahtet. Kein OpenAI (kein Paket, kein Schlüssel in `.env`/`config.py`). |

## Zielbild (aus den Fotos)

**Ebenen (links, Reiter Pages · Layers · Assets)**
- Kopf: Seitenwahl `⌂ Home ⌄`, darunter Suchfeld.
- Wurzeln = Breakpoints: `Desktop · Primary`, `Tablet · 958—810`, `Phone · 809—0`,
  auf-/zuklappbar. Darunter je Breakpoint derselbe Baum `Frame → Stack → …`.
- Zeile: Pfeil · Symbol je Typ (Frame, Stack, Text, Bild, Komponente) · Name;
  gesperrt = Schloss, ausgeblendet = Auge grau; aktiv = blau gefüllt.
- Rechtsklick: Duplizieren ⌘D, Löschen ⌫, Umbenennen ⌘R (inline), Sperren ⌘L,
  Ausblenden ⌘;, Gruppieren/Wrap in Stack, Auflösen. Alle Kürzel echt gebunden.
- Ziehen für ALLE Ebenen inkl. Abschnitte und Spalten; Shift = Mehrfachauswahl.

**Style (rechts, Reiter Agent · Style)** — kontextabhängig:
- *Nichts gewählt (Template)*: Ausrichtungsleiste · Template + · Haltepunkt
  (Position X/Y, Breite/Höhe mit Fixed/Relative/Fill/Fit/Viewport) · Layout + ·
  Typography (Base px) · Overlays + · Cursor + · Effects (Seite: All Pages) ·
  Stile (Füllen, Überlauf) · Selection (drei Farben) · Codeüberschreibungen.
- *Frame/Stack*: Position (Typ relative/absolute/fixed/sticky) · Größe (Breite/
  Höhe + Modus, Min Max, Kette) · Layout · Auswirkungen · Overlays · Cursor ·
  Stile (Opazität, Sichtbar, Füllen, Überlauf, Radius, Grenze, Schatten) ·
  Transformiert · Scrollabschnitt · Zugänglichkeit · Codeüberschreibungen.
- *Text*: die 13 Abschnitte aus `FRAMER-STYLE-PANEL-ANALYSE.md` §B.
- Muster: Zeile Label+Wert 239×40; Kopf-„+" = Menü (leer) bzw. Zuklappen
  (gefüllt); gesetzte Werte bleiben grau mit Häkchen im Menü; „Mixed" bei
  Mehrfachauswahl; berechnete Werte als Platzhalter.
- **Jeder Wert je Breakpoint überschreibbar** (Desktop-first-Kaskade, Override
  blau markiert, „Zurücksetzen auf Desktop").

**Agent (rechts, erster Reiter)** — mit OpenAI:
- Chat über die gewählte Ebene/Seite: „mach den Abschnitt dunkler", „drei Spalten",
  „Text kürzen". Der Agent bekommt den Baum + Settings der Auswahl als
  Werkzeugkontext und liefert **strukturierte Änderungen** (JSON-Patch auf
  `settings`/Blöcke), die der Editor zeigt und der Nutzer übernimmt oder verwirft.
  Kein freier Code, keine direkten DB-Schreibzugriffe durch das Modell.
- Anbieterabstraktion: `core/ki/anbieter.py` mit `VertexClient` und
  `OpenAIClient` hinter EINER Schnittstelle (`erzeuge`, `erzeuge_strukturiert`);
  Wahl per `KI_ANBIETER_AGENT=openai`. Schlüssel `OPENAI_API_KEY` (Coolify api +
  worker, lokal `.env`); fehlt er → 503 „nicht eingerichtet", nie stiller
  Ausweich auf Gemini (Wurzel 4).
- Nutzungszähler wie heute (`ki_nutzung.py`), eigener Rate-Limit-Bucket (Wurzel 8).

**Variablen · Code-Overrides · Effekte** (Foto-Abschnitte, „alles muss rein"):
- Variablen (Text/Zahl/Bool/Farbe/Option) je Site mit ⊕-Bindung an Stilwerte.
- Codeüberschreibungen: ein pro Ebene hinterlegter CSS-Block (Allowlist von
  Eigenschaften, kein JS — Wurzel 8), im Renderer als `style`-Attribut gemergt.
- Effekte: Appear/Hover/Press/Scroll mit Scale/Offset/Rotation/Opacity; Renderer
  über `motion/react`, persistiert in `settings.effekte`.

## Datenmodell

`site_page_blocks.settings` (jsonb) bleibt der Ort — sechs Zusammenbau-Stellen
reichen es unverändert durch (siehe `editor/sichtbarkeit.ts`). Erweiterung von
`ContainerDarstellung` um Unterobjekte, jedes optional:

```
position:  { typ: relative|absolute|fixed|sticky, x, y, pins: {top,right,bottom,left} }
groesse:   { breite: {wert, modus: fixed|relative|fill|fit|vw}, hoehe: {…, vh}, min_breite, max_breite, min_hoehe, max_hoehe, kette: bool }
stil:      { opazitaet 0–1, sichtbar, fuellung {art: farbe|verlauf|bild, …}, ueberlauf: visible|hidden|scroll, radius {alle|je_ecke}, grenze {breite, farbe, art, position}, schatten [ {x,y,blur,spread,farbe,innen} ] }
transform: { rotation, skalierung, verschiebung_x/y, perspektive }
effekte:   [ {ausloeser: appear|hover|press|scroll, eigenschaften: {…}, uebergang: {…}} ]
scroll:    { abschnitt_id }
a11y:      { rolle, label, tab_index, verborgen_fuer_leser }
code:      { css: "…" }   # Allowlist
name:      string          # Ebenenname
locked:    bool            # vorhanden
hidden_on: [desktop|tablet|phone]   # vorhanden
je_geraet: { tablet: {<Teilmenge derselben Felder>}, phone: {…} }   # Overrides
```

Regeln: Pydantic `extra="forbid"` auf jedem Unterobjekt (Wurzel 5: ein Tippfehler
im Schlüssel darf nicht still verschwinden); Grenzen (ge/le) auf jeder Zahl
(Wurzel 8); Farben nur als Verweis auf Farbrollen oder Hex (Wurzel 4: keine
erfundenen Defaults — fehlender Wert = Erbe vom Elternteil/Theme, nicht „#000").
Renderer: `darstellung.ts` (eine Funktion `stilAus(settings, geraet)`) mit
Desktop→Tablet→Phone-Kaskade als CSS-Variablen + `@media`; Editor nutzt DIESELBE
Funktion für die Vorschau (eine Wahrheit).

## Etappen (jede: Tests · Diagnose-Anzeige · Doku · Commit nach Freigabe)

**Stand 05.09.2026:** Etappe 0 abgeschlossen (`FRAMER-LAYERS-INSPEKTOR-ANALYSE.md`),
Etappe 1 gebaut und agentengeprüft (`BAUKASTEN-EBENEN-BEFUNDE-2026-09-05.md`,
uncommitted). **Etappe 2 gebaut (05.09.2026):** `schemas_darstellung.py` mit
`Mass`/`Position`/`Groesse`/`Stil`/`Transform`/`Scroll`/`A11y`/`je_geraet`
(`extra="forbid"`, Grenzen auf jeder Zahl, Farben Hex oder `rolle:`), 18 Tests;
neues Paket `packages/baukasten-stil` (`@nextdays/baukasten-stil`) mit
`darstellungFuer`/`herkunft`/`rahmenStil`/`layoutStil`/`stilCss`/
`rahmenAttribute`, 21 Bun-Tests; Renderer schreibt je Block ein `<style>` mit
Grundregel + Media-Queries statt Inline-Stilen (`bgStyle`/`abstandStil`/
`groessenStil`/`layoutStil` entfernt), Element aus `a11y.tag`, `id` aus
`scroll.anker`; Editor bezieht `GERAETE_BEREICHE` aus dem Paket;
`baukasten-doppel-kopien-pruefen.mjs` wacht über beides; E2E um Stil-Roundtrip
erweitert (noch nicht gegen laufende API/Renderer gefahren). Keine Migration
nötig. **Etappe 2b gebaut (05.09.2026, Auftrag „Kopfzeile und Fußzeile im Layer
bearbeiten wie bei Framer"):** Kopf- und Fußzeile sind aufklappbare Ebenen
mit Kindern (Kopf: Logo · Slogan · Navigation · Sprachwähler · Buchen-Knopf;
Fuß: Navigation · Social-Links · Bildnachweise · Copyright). Je Kind Auge je
Gerät, Schloss, Ziehen innerhalb der Gruppe (Logo/Slogan stehen im Theme
fest); Klick auf der Fläche wählt die Ebene (`data-region`/`data-teil` in
`site-header.tsx`/`site-footer.tsx`, gemessen von `canvas-bridge.tsx`);
rechts der `RegionInspektor` mit Sichtbarkeit, Sperre, Reihenfolge und
Verweisen auf die bestehenden Einstellungsorte (kein zweites Formular).
Gespeichert site-weit in `tenant_site_config.header_teile`/`footer_teile`
(Migration 0570, `schemas_regionen.py`, `extra="forbid"`), gelesen über
`regionLesen` aus `@nextdays/baukasten-stil` (Renderer und Editor, 7 Tests).
Nicht gebaut: Kopf-/Fußzeile als freie Block-Bäume (eigene Etappe, neuer
Speicherort, Migration bestehender Kopfzeilen). **Migration 0570 muss
eingespielt sein, sonst antwortet der Resolver 500** (Spaltenliste
`_BRANDING_COLS`). **Etappe 3 gebaut (05.09.2026, Auftrag „umsetzen" nach
der Inspektor-Liste):** EIN Stil-Inspektor für Container und Baustein
(`editor/stil-inspektor.tsx`) mit den Karten Position · Größe · Stil ·
Transform · Scroll-Abschnitt · Zugänglichkeit; Zeilenmuster, „+"-Kopf mit
Suchmenü, Chips und Farbfeld (Hex + Deckung oder Farbrolle) in
`editor/stil-felder.tsx`; Füllungs-Popover Farbe · Verlauf · Bild in
`editor/fuellung-feld.tsx`. Jede Zeile kennt ihren Pfad und schreibt über
`stift()` → `mitWert()` aus dem Paket: Desktop in die Grundfassung,
Tablet/Mobil nach `je_geraet` (Label blau, ↺ setzt nur die Überschreibung
zurück, geerbte Werte tragen das Gerätesymbol der Quelle); Scroll und
Zugänglichkeit nur in der Grundfassung (`jeGeraetMoeglich`). Gerätezeile oben
im Inspektor mit Punkt an Geräten, die eigene Werte tragen; Umschalten =
dieselbe Bühne wie die Kopfleiste. Layout-Karte, Größe-Karte und Abstände des
Container-Inspektors schreiben jetzt ebenfalls je Gerät (`darstellungFuer`
zum Lesen). Ausrichtungsleiste auf acht Knöpfe (Verteilen H/V schreibt
Richtung + `zwischen` in EINEM Schreibvorgang) mit Framers Kürzeln
⌥A/H/D/W/V/S und ^⌥H/V (Tastencode, nicht Zeichen — ⌥A liefert „å"). Gemessene
Breite/Höhe aus den Canvas-`rects` stehen grau als Platzhalter (Framers
berechnete Werte); die Kette rastet das gemessene Verhältnis ein. Kein Wert
wird ohne Eingabe gespeichert: „+" öffnet eine leere Zeile, Grenze und
Verlauf halten einen Entwurf, bis die Pflichtfelder stehen. Paket:
`mitWert`/`eigenerWert`/`wirksamerWert`/`jeGeraetMoeglich` (+6 Tests, 34
gesamt). Texte `website.stil.*` (112) und zwei Container-Schlüssel in 24
Sprachen (Gemini). Protokoll: jeder Schreibvorgang als `[editor:klick] Stil
setzen` mit Pfad, Gerät, vorher/nachher (`editor-debug`). Nicht in Etappe 3:
Text am Element (§17 Schritt 3), Stil-Verweise/Variablen (4), Effekte (5),
Seiten-Inspektor bei leerer Auswahl (0.12), Mehrfachauswahl (0.10),
Copy/Paste Style (0.11).

**Schale + Canvas nach Framer gebaut (05.09.2026 abends, Auftrag „alles genau
so umsetzen", Foto `framer-canvas-2.png`, DOM-Messung 1440 px: Panels
#111111 · Fläche #171717 · Kopf 51 px · Panels 260 px):** neue Editor-Schale
`editor/framer-schale.tsx` (dunkel, drei Spalten, beide Seiten immer da;
die Hostaway-Schale `schale.tsx` bleibt für die übrigen Website-Routen),
Kopf: „Canvas ▾"-Menü mit allen Bereichen (Panels wechseln, Arbeitsbereiche
navigieren) · Einfügen · Layout · Text · Bild | Seite · Sprache · Stand |
Verlauf · Übersetzen · ⓘ · ▷ Website · Veröffentlichen. Links Reiter
Pages · Layers · Assets (Mediathek), Einfügen/Vorlagen/Design als Panel mit
Kopf und ✕ darüber. Fläche `editor/buehne.tsx`: Kamera (`useKamera`:
Zoom ⌘+/−/0/1/2, ⌘+Rad, Pinch, Rad = Pan, Hand H/Leertaste, V = Auswahl)
als EIN `translate() scale()` um alle Rahmen; je Breakpoint ein Rahmen
(Desktop 1200 · Tablet 810 · Mobil 390) mit Kopf „▷ Name Breite" und „+" für
den nächsten; die Seite so hoch, wie der Renderer meldet (`seitenHoehe` in
`rects`); Rad/Pinch und Kürzel im iframe leitet die Brücke weiter (`rad`,
`taste`); Auswahl-Schicht und Brücke nur am aktiven Rahmen, Klick auf einen
anderen macht ihn aktiv; untere schwebende Leiste Auswahl · Hand ·
Dunkel/Hell · Zoom % ▾. Rechts Reiter Agent · Style: Style ohne Auswahl =
`SeitenInspektor` (Seite, Breakpoints), mit Auswahl NUR Stil-Karten — kein
Kopf, kein Inhaltsformular („was soll das rechts … ich will dieselbe Sidebar
genau so wie Framer"): Texte auf der Fläche, Inhalt (Bilder, Listen,
Felder, Sprachfassung) im `InhaltDialog` über den Inhalt-Knopf an der
Auswahl und das Kontextmenü. Agent-Reiter = Platzhalter bis
`OPENAI_API_KEY`. Texte `website.canvas.*` (35) in 24 Sprachen. Nicht
gebaut (Canvas 3–5): Ziehen/Griffe auf der Fläche, Marquee, Zwischenablage,
Zeichnen von Frames; Kontextmenü klemmt sich am Kameraraum statt am Fenster
fest.

**Rechte Leiste nach Framer neu geordnet (05.09.2026 spät, „deine Arbeit
rechts am Side-Panel ist miserabel"):** `StilInspektor` ist jetzt das ganze
Style-Panel für Container UND Baustein, in Framers Reihenfolge und ohne
Sonderkarten: Ausrichtungsreihe (am Baustein schreibt sie in seinen
Rahmen) · Link (neu: `settings.link` mit `href`/`neuer_tab`,
`LinkDarstellung` im Schema, `linkLesen`/`rahmenAttribute` im Paket, der
Renderer macht das Element zum `<a>` außer bei Bausteinen mit eigenen
Links/Formularen) · Position · Größe (mit Spaltenbreite als Zeile und
„↔ Hinzufügen …" für Min/Max/Verhältnis) · Layout (Richtung · Verteilen ·
Ausrichten · Umbruch · Abstand · Innen/Außen mit „je Seite" · Spalten) ·
Stil (alle Zeilen immer da: Deckkraft · Sichtbar je Breakpoint =
`hidden_on` · Füllung/Rahmen als „Hinzufügen …"-Chip · Überlauf · Radius ·
Schatten) · Transform · Scroll · Zugänglichkeit. Gestrichen: Gerätezeile
„Bearbeiten für", Name-Karte, Breite-/Spalten-/Struktur-Karten,
Design-Karte mit Geräteknöpfen und Abstandsrechtecken, Kopf mit
Breadcrumb.

**Style-Panel live vermessen und „Text am Element" gebaut (05.09.2026,
Nacht):** `docs/FRAMER-STYLE-PANEL-LIVE-2026-09-05.md` — das rechte Panel
per DOM in fünf Auswahlzuständen (Text, Stack, Bild, Desktop-Wurzel, ohne
Auswahl) und alle „+"-Menüs der Abschnittsköpfe; zwei versehentliche
Eigenschafts-Anlagen (Scroll Section, Code Overrides) per ⌘Z zurück.
Daraus gebaut: `TextDarstellung` (`settings.text`: Schrift-Rolle, Farbe,
Größe px/rem, Gewicht 100–900, Laufweite em/px, Zeilenhöhe em/px/%,
Ausrichtung, Transformation, Dekoration, Balance, Kürzen), je Gerät
überschreibbar; Paket `textStil`/`stilCss(..., {text})`, Renderer setzt die
Regel auf alle Textknoten eines Bausteins; Karte „Text" im Style-Panel
(Bausteine) mit Framers Zeilen und „+"-Menü (Transformation · Dekoration ·
Kürzen). Leiste in Framers Reihenfolge: Link · Position · Größe · Layout ·
Auswirkungen · Overlays · Cursor · Stile · Transformiert · Text ·
Scrollabschnitt · Zugänglichkeit · Codeüberschreibungen — die vier ohne
Modell als ausgegraute Köpfe mit Hinweis. Zeilen 30 px, Beschriftung 88 px,
Kopf 40 px, Rand 10 px (gemessen). Nächste: Effekte (Etappe 5) oder Canvas 3.

**Breakpoint-Wurzel und Ausrichtungssymbole (05.09.2026, abends).** Der
Nutzer fügte den DOM eines leeren Breakpoints und der Ausrichtungsreihe ein
(`docs/FRAMER-STYLE-PANEL-LIVE-2026-09-05.md` §5 zweite Lesung, §8).
`seiten-inspektor.tsx` ist nun Framers Wurzel-Panel (Template · Haltepunkt ·
Layout · Typography · Overlays · Cursor · Effects · Stile · Codeüberschreibungen)
mit Sprüngen ins Design- und Vorlagen-Panel statt zweiter Formulare; die acht
Ausrichtungssymbole sind Framers Pfade (`ausrichtungs-symbole.tsx`).

**Etappe 4a — Vollerfassung umgesetzt, Teil 1 (06.09.2026).** Grundlage
`docs/FRAMER-EDITOR-VOLLERFASSUNG-2026-09-05.md` (Kapitel 1–23), Abgleich in
`docs/FRAMER-EDITOR-FUNKTIONEN-GESAMT.md`. Modell: `link.anker` (§4.2
„Abschnitt"), `transform.rotation_x/y · tiefe · rueckseite · raum_3d` (§19),
`a11y.nosnippet` (§19 Google Bot), `cursor` (§10 Web Cursor) — Schema, Paket
(`cursorLesen`, `linkZiel`, CSS/Attribute), Tests. Panel: Link-Abschnitt aus den
Ankern der Seite, Pin-Widget an Position (§4.3), Wachsen-Segment an Bausteinen
(§4.4), Gap-Schieber (§4.5), Transform-3D-Zeilen, Google-Bot-Auswahl,
Cursor-Karte statt Platzhalterkopf. Seiten-Panel: „+"-Menü mit Neue Seite ·
Alphabetisch sortieren (§14). Nicht gebaut (Modell fehlt, Etappe 5/6): Effekte
(§8), Overlays (§9), Code Overrides, Grid-Layout, Selection Colors, Font-Picker,
OpenType, Variablen (⊕), Hauptmenü/Preferences (§20), Insert-Komponenten (§21),
Modi CMS/Localization/Analytics/Settings (§22), Canvas-Direktmanipulation (§16).

**Etappe 4b — Vollerfassung, Teil 2 (06.09.2026).** Nutzer: „du hast nicht
alles umgesetzt". Modell: `effekte` (Erscheinen · Überfahren · Drücken ·
Schleife · Scroll-Tempo; CSS + Live-Skript `builder/components/blocks/effekte.tsx`,
im Editor ohne Marker), `stil.mischmodus/filter/ueberlauf_x/y/zeiger_ereignisse/
text_auswahl/tippfarbe`, `text.opentype`, `link.rel/parameter`, Raster-Layout
(`layout_typ`, `raster_*`). Editor: Rückgängig/Wiederholen für Stil und Inhalt,
Stil kopieren/einfügen, Überlauf-Untermenü, Geschwister wählen, Ebenen-Marker,
ziehbare Panels (200–420 px). Offen mit Grund: `docs/FRAMER-EDITOR-FUNKTIONEN-GESAMT.md` §7.

0. **Recherche live** — Framer im Debug-Chrome (`chrome-lesen.mjs`) für Frame,
   Stack, Template und Layers vermessen (§H der Style-Analyse: „nur der Textfall").
   **Blocker: Framer-Login im Debug-Profil** (`~/.cache/claude-chrome-debug`).
1. **Ebenen-Fehler beheben** (Befundliste aus der laufenden Prüfung) + Umbau auf
   Framer: Kopf mit Seitenwahl und Suche, Breakpoint-Wurzeln, Symbole, Sperren,
   Umbenennen inline, Ausblenden, Kürzel, Ziehen für Container, Shift-Mehrfachauswahl.
2. **Datenmodell + Renderer** — `ContainerDarstellung`-Erweiterung, Migration
   nur falls Spalten nötig (voraussichtlich keine), `darstellung.ts` mit
   Geräte-Kaskade, Tests für jede Kaskadenregel; `website-baukasten-e2e.py`
   um Stil-Roundtrip erweitern.
3. **Style-Inspektor** — Abschnittsgerüst (Kopf-Menü/Zuklappen, Zeile, geteilte
   Zeile, Chip-Zeile, „Mixed"), dann Abschnitte in Foto-Reihenfolge; je Breakpoint
   Override mit blauer Markierung; Ausrichtungsleiste 8 Knöpfe.
4. **Variablen + ⊕-Bindung + Codeüberschreibungen (CSS-Allowlist).**
5. **Effekte** (Appear/Hover/Press/Scroll) im Editor und Renderer.
6. **Agent-Reiter mit OpenAI** — Anbieterabstraktion, strukturierte Änderungen
   als Vorschlag, Übernehmen/Verwerfen, Nutzungszähler, Rate-Limit.
   **Blocker: `OPENAI_API_KEY`** (lokal + Coolify api/worker).
7. **Übersetzungen** (24 Sprachen, Gemini-Skript) · Doku (`API.md`, `ARCHITECTURE`,
   Storybook für die Inspektor-Bausteine) · Abschlussprüfung 3 Agenten.

## Canvas-Lücke (05.09.2026, Auftrag „alle Funktionen auflisten")

Vier Agenten (Live-Vermessung, Kürzelseite, offizielle Doku, eigenes Inventar)
→ `docs/FRAMER-CANVAS-FUNKTIONEN.md`: 81 Canvas-Funktionen, davon bei uns
4 vollständig, 24 teilweise, 48 fehlend, 5 bewusst nicht. Die Lücken hängen an
fünf Fähigkeiten, in Baureihenfolge: **Kamera** (Zoom/Pan/Canvas-Leiste) →
**Breakpoints als Rahmen nebeneinander** → **direkte Manipulation** (Ziehen,
Griffe, Pfeiltasten, Smart Guides, ⌥-Maße) → **Auswahl & Zwischenablage**
(⇧/Marquee, Select-Kürzel, ⌘C/⌘V, Copy Style, Undo über alles, ⌘K) →
**Erzeugen auf der Fläche** (Frame/Stack/Grid/Text zeichnen, Align/Distribute,
Rulers/Guides). Diese fünf werden als Etappen 3a–3e VOR dem Style-Inspektor
(3) eingeplant bzw. mit ihm verzahnt — der Inspektor ohne Fläche wäre ein
Formular, kein Canvas. Vollständige Kürzelliste (132):
`docs/FRAMER-KUERZEL-VOLLSTAENDIG.md`.

**Inspektor-Lücke (05.09.2026, „rechts die Sidebar fehlt komplett"):**
`docs/FRAMER-STYLE-INSPEKTOR-FUNKTIONEN.md` — die rechte Leiste je Elementart
mit allen Abschnitten, Popovern, Effekt-Editoren und Agent-Reiter, aus vier
Quellen (drei Live-Messungen, offizielle Doku, eigenes Inventar). Die Zählung
steht in §16 der Datei; 19 Felder liegen seit Etappe 2 als Modell + Renderer
vor und brauchen nur das Eingabefeld. Baureihenfolge (§17): Inspektor-Gerüst
mit den drei Zeilenmustern und Override-Blau → die Modell-Felder anbinden →
Text am Element → Variablen/Stil-Verweise → Effects/Overlays/Cursor → Agent →
Grid/CMS-Content.

## Offene Entscheidungen (Nutzer)
- Framer-Login im Debug-Chrome (Etappe 0).
- OpenAI-Schlüssel und Modell (Vorschlag: Structured Outputs, `gpt-5`-Klasse;
  Kosten je Anfrage sichtbar im Nutzungszähler).
- Text-Abschnitte des Inspektors: Textstile als Projekt-Stile (Framer) statt
  Rohwerte — Vorschlag ja, es sind unsere Farbrollen/Theme-Schriften.
