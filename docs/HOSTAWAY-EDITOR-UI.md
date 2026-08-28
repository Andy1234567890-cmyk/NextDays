# Hostaway „Booking Website Pro" — der Editor, live abgelesen (25.08.2026)

Quelle: die Screenshots der Hilfe-Artikel, im Browser angesehen (nicht der
Fließtext). Artikel-Volltexte und Bilder liegen unter `/tmp/hostaway`.
Grund für dieses Dokument: die Leiste wurde dreimal am Vorbild vorbei gebaut,
weil nur Text gelesen wurde. Was hier steht, ist gesehen.

## 1. Grundraster — VIER Spalten, nicht zwei

    ┌──────────────────────────────────────────────────────────────────┐
    │ ≡  Hostaway │ Seite ⌄ │ 🇺🇸⌄ │  🖥▭▯  │ ↺ ↻ ✓ ⤴ Preview [Republish] ⌂ │
    ├────┬──────────────┬───────────────────────────────┬──────────────┤
    │ ▤  │ PANEL        │                               │ INSPEKTOR    │
    │ ▤  │ (Reiter,     │        Arbeitsfläche          │ (rechts,     │
    │ ▤  │  Suche,      │                               │  angedockt)  │
    │ ▤  │  Inhalt)     │                               │              │
    └────┴──────────────┴───────────────────────────────┴──────────────┘
      55px    ~360px                                        ~320px

Eingeklappt bleibt rechts ein Griff `‹` am Fensterrand stehen.

## 2. Leiste — SIEBEN Einträge, Gruppen durch WEISSRAUM

    +    Add
    ⧉    Pages
    ◈    Layers
    ◫    Theme
         ← Lücke, keine Linie
    ⌕    SEO/AEO
         ← Lücke
    ⋯    More

- Breite ~55 px, Symbol über winziger Beschriftung, alles einfarbig.
- **Aktiv = hellgraues abgerundetes Quadrat hinter dem Symbol.** Keine Marken-
  farbe, keine Fettschrift, kein Balken.
- **„Add" ist NICHT getönt** — es sieht aus wie jeder andere Eintrag.
- „Store"/„Blog"/„Bookings" erscheinen NUR, wenn installiert.
- In der älteren Editor-Fassung war die Leiste länger (Theme · Pages · Widgets ·
  Content · Personalize · Sell Online · Membership · Blog · App Store ·
  SEO & Settings) und das aktive Symbol ORANGE. Unten saß ein eigener Knopf
  „Unhide Elements" (Auge) und ganz unten der KI-Kreis.

## 3. Panel — Kopf, eigene Reiter, Suche

Kopf: `TITEL` (klein, versal, grau) rechts `? ▣ ✕`.
- `?` Hilfe, `▣` Breite umschalten, `✕` schließen.
- Bei mehrstufigen Panels zusätzlich `«` zum Zurückklappen auf die Menüspalte.

**Das Panel hat EIGENE REITER, keine zweite Leiste:**
- Pages-Panel: `Pages | Popups` (Teal-Unterstrich am aktiven)
- Abschnitts-Wähler: `Designed | Custom`
- Inspektor rechts: `Button style | Button text`, darin nochmals `Color | Image`

Darunter je nach Bereich: Suchfeld (Pille, `🔍 Search for widgets`), ein
Haupt-Knopf (`[+ Add Page ⌄]`, teal gefüllt, zentriert), ein KI-Link
(`✨ Page Recommendations`).

### Pages-Panel
Jede Seite ist eine **umrandete Karte**: `⋮⋮` Ziehgriff AUSSERHALB links, Symbol,
Name, `⋯` Menü rechts. Die aktive Seite hat einen kräftigeren Rand.

`+ Add Page ⌄` öffnet:
| Eintrag | Beschreibung |
|---|---|
| Page Builder | Plan the page layout before finalizing its design |
| Blank Page | Start with a clean canvas |
| Designed Page | Get a head start with a page template |
| Navigation Folder | Group sub-navigation items like anchors and pages |
| Page URL | Add an external page by entering a link |

→ Diese Liste gehört unter „Seite hinzufügen", NICHT an die Kopfzeile.

### Widget-Panel („Add")
Suchfeld, Hinweis „**Drag & drop** widgets into your site", dann ein
**3-spaltiges Kartenraster**: Symbol über Beschriftung, umrandetes Quadrat.
Kategorien als zentrierte Überschriften (`Frequently Used`, `Popular`, `MEDIA`).
`BETA`-Abzeichen und ✨-Funken an KI-Widgets.
Untergliederung als Menüspalte zwischen Leiste und Panel: `Widgets › / Media ›
/ Site Text ›`.

### Site-Theme-Panel
Aufklappbare Bänder mit `›`:
- `COLORS` — Farbfelder als Raster + `[+]`
- `BUTTONS` — **echte Vorschau**: `( Primary )` `( Secondary )` im Ist-Stil
- `TEXT` — `DFLT Inter, 16` · `PAR Inter, 16` · `H1 Inter, 70` · `H2 Inter, 70`
  · `H3 Inter, 56`, **jede Zeile in ihrer tatsächlichen Größe gerendert**

## 4. Arbeitsfläche

- Überfahren: oranger Rahmen um das Element.
- **Blaue Pille** `Section` am linken Rand der Zeile; `› Photo Gallery` über dem
  gewählten Baustein. Das `›` springt zum Elternteil.
  Eigene/dynamische Bausteine bekommen eine **violette** Pille.
- Auswahl: gestrichelter blauer Rahmen mit acht quadratischen Griffen.
- `+`-Kreis am linken Rand zwischen zwei Zeilen = Abschnitt einfügen.

### Schwebeleiste
- Baustein: `⋮ | Content | Design | + ⧉ ⇹ 🗑 ⋯`
- Baustein mit eigenem Editor: `⋮ | Manage Photos | Edit Design | ← → | + ⧉ ⇹ 👁̶ 🗑`
- Abschnitt: `⋮ | Design | ↓ ↑ | ⧉ ▣ 🗑 ⋯`

### Kontextmenü (Rechtsklick)
    PHOTO GALLERY            ← Titelzeile, versal, dunkel
    Manage Photos
    Edit Design
    Select Layer          ›  ← Elternkette
    Duplicate
    Copy
    Edit HTML/CSS        </>
    Add CSS Class Name   </>
    Add Comment           💬
    Lock Editing for Client
    Set As Anchor          ⚓
    Hide from             ›  → All Devices · Desktop · Tablet · Mobile
    Delete                   ← ROT

`Hide from`: bereits ausgeblendete Geräte stehen **orange mit durchgestrichenem
Gerätesymbol**.

## 5. Inspektor rechts

    Search button                    ← Titel, zentriert
    Button style | Button text       ← Reiter
    🖥 Change affects desktop and tablet   ← Geltungsbereich als Hinweis
    Width   ──●───── [120px]
    Height  ─●────── [42px]
    Keep proportions          (○ )
    ─────────────────────────
    BACKGROUND                       ← zentriertes versales Band
    Color | Image                    ← verschachtelte Reiter

Alternativ als schwebender Dialog: dunkler Kopf mit `CONTENT | DESIGN`,
`⚙ ? ✕`, Titelband (`TABLE CONTENT`, `BUTTON CONTENT`), darunter der Inhalt.

Design-Panel eines Containers:
    ◫                      ? ✕
    Section › Column ›               ← BREADCRUMB, anklickbar
    Contact Form Design
    › Alignment
    › Spacing
    › Size ⓘ
    › Animation
    Layout                           ← graues Band
    [Vorschaubild]              ›

Aufgeklappt: Beschriftung links, Bedienelement rechts, Schieber mit Zahlenfeld,
unten `Reset to default` und `( Preview )`.

**Die Verschachtelung zeigt Hostaway über den Breadcrumb und die Pille auf der
Fläche — nicht über einen Baum in der Seitenleiste.**

## 6. Abschnitt hinzufügen — eigener Vollbildmodus

    SECTION │ 🖥▭▯ │ 50% ⌄ │ Save & Add Another │ [Save Section] │ ✕

Links die Kategorien: `✨ Start With AI`, `All Sections`, dann Hero · Inner Page
Hero · Sell Online · Blank · Coming Soon · Services · Steps · About · Stats ·
Logos · Text Blocks · List · Tabs · Team · Restaurant Menu · Testimonials ·
Contact Us · Service Areas · Portfolio · Call-To-Action · Gallery · Events ·
Promotion …
Daneben `KATEGORIE  ☰ ✕` mit Reitern `Designed | Custom` und Vorschaubildern.
Die Seite dahinter ist abgedunkelt auf 50 % — man sieht, WO der Abschnitt landet.

## 7. Kopf- und Fußzeile

Werden **auf der Fläche** bearbeitet, nicht in einem Leisten-Bereich:
- Darüberfahren → Pille `Header` → `Edit Design`
- Reiter: `Design` (Layout, Spacing, Background, Position) · `Content`
  (Set As Sticky Header) · `Shrinking Header`
- `Overlap first row` legt den Kopf über das erste Bild
- Fußzeile: Pille `Footer` → `Style`, `Spacing`, Schalter
  „Hide footer on this page"

Im **Layers-Panel** steht dazu nur:
- `Site Layout` → je Gerät (Desktop/Tablet/Mobile) das Kopf-Layout wählen
  (Top-Bar oder Expandable Menu), dazu `Enter from`, `Entrance effect`,
  `Width`, `Background`, `Close icon color`, `Spacing`
- das **durchgestrichene Auge** neben ausgeblendeten Elementen zum
  Wiedereinblenden

Kopfzeile = **Navigation**: Logo + Menü. Mit `Navigation Links`-Widget, bis zu
drei Ebenen, Seiten oder eigene Links, Mega-Menü möglich. Widgets, die im
schrumpfenden Kopf funktionieren: Navigation, Multi-language, Social Icons,
Click to Call, Click to Email, PayPal, Images/Logos, Paragraph, Title, Buttons.

## 8. Was unsere Umsetzung davon verfehlt hat

| | Hostaway | Wir (Stand 25.08.2026) |
|---|---|---|
| Spalten | 4 (Leiste · Panel · Fläche · Inspektor rechts) | 3, Inspektor liegt LINKS |
| Leisten-Einträge | 7 | **11**, sechs verlassen den Editor |
| Leistenbreite | ~55 px | 72 px |
| „Add" | nicht getönt | getönt |
| Gruppentrennung | Weißraum | Haarlinien |
| Aktiv-Zustand | graues Quadrat hinter dem Symbol | derselbe Grauton wie Hover |
| Untermenüs | eigene Menüspalte bzw. Reiter IM Panel | gibt es nicht |
| Verschachtelung | Breadcrumb + Pille auf der Fläche | Baum in der Leiste |
| Seitentypen | unter `+ Add Page` | an der **Kopfzeile** (falsch) |
| Kopfzeile | auf der Fläche, Layers zeigt nur Site Layout | Sackgasse „aus dem Theme" |
| Panel-Reiter | ja (Pages\|Popups, Designed\|Custom) | nein |
| Suche im Panel | ja | nein |

---

# Teil 2 — nachgetragen nach dem zweiten Durchgang (25.08.2026)

Der erste Durchgang hatte das **Layers-Panel selbst nie gesehen** und die
Untermenüs übersprungen. Beides ist jetzt abgelesen.

## 9. Layers-Panel — so sieht es WIRKLICH aus

    LAYERS                        ▣  ?  ✕
    ────────────────────────────────────────
    ⌄  ▤  Header                       👁̶      ← gewählt: hellblaue Fläche,
      ›  ▤  Section                              Symbol ORANGE
      ⌄  ▤  Section
        ⌄  ⊞  Column
              ▤  Text Block
              ▤  Text Block
      ⌄  ▤  Section
        ⌄  ⊞  Column
          ⌄  ⊞  Inner Column
                ▤  Text Block
                ▤  Text Block

Und mit Inhalt:

    ⌄  ▤  Header
      ⌄  ▤  Section
        ⌄  ⊞  Column
              🖼  Image
        ⌄  ⊞  Column
              ✨  Navigation Links
        ⌄  ⊞  Column

**Was daran zählt:**
- **Die Kopfzeile IST ein Knoten des Baums.** Kein „aus dem Theme"-Hinweis,
  keine Sackgasse. Darunter hängen Section → Column → Image / Navigation Links.
- Die Navigation ist ein **Widget** (`Navigation Links`) in einer Spalte der
  Kopfzeile. Genau das meinte der Nutzer mit „eine Kopfzeile ist eine Nav".
- **`Inner Column` ist eine eigene Ebene im Baum**, mit eigener Einrückung.
- **KEINE Abzeichen.** Kein `12/12`, keine Anzahl, kein Gerätehinweis. Nur
  Pfeil, Symbol, Name. Rechts erscheint das Auge nur, wo etwas versteckt ist.
- Einrückung ~30 px je Ebene, **ohne Führungslinien**. Zeilenhöhe ~36 px.
- Gewählte Zeile: **volle Breite hellblau**, kein Balken, keine Fettschrift.
- Symbole: Header = Fensterrahmen (orange), Section = waagerechte Linien,
  Column und Inner Column = Kästchen mit Plus, Text Block = Textlinien,
  Image = Bildsymbol, Navigation Links = Funken.
- Panel-Kopf: `LAYERS` links, rechts `▣ ? ✕`.

## 10. Kopfzeile — Kontextmenü und rechtes Panel

Rechtsklick auf die Kopfzeile:

    HEADER
    Change Preset
    Edit Design
    Undo Sticky Header
    Lock Editing for Client
    </> Edit CSS
    Enable Advanced Editing
    Hide on this Device   › → From this Page Only
                              From All Pages

Schwebeleiste der Kopfzeile: `⋮ | Change Preset | Edit Design | ⋯`
Rechts öffnet sich **`Header Design`** mit `⌄ Presets` (Layout-Vorschaubilder
zum Anklicken), `✏ Enable …`, `› Spacing`, `Background`.

## 11. Seiten-Menü (`⋯` an jeder Seite)

    Rename                  ← benennt nur im Editor um, ändert die URL NICHT
    Hide in navigation      ← bleibt über die direkte Adresse erreichbar
    Duplicate
    Publish page            ← EINE Seite veröffentlichen; Kalendersymbol danach
    Page URL
    SEO
    Set Access              ← Passwort oder „nur Mitglieder"
    Convert to Dynamic Page ← Sammlung wählen
    Set as a draft / Stage draft to publish

Theme-Änderungen (Kopf, Fuß, Site-Theme) werden beim Einzelseiten-
Veröffentlichen NICHT mitgenommen. Startseite, Fremdlinks und Ordner lassen
sich nicht als Entwurf setzen.

## 12. Medien

**Media Panel** (Add → Media, in der Leiste):
- Suchfeld — die Eingabe bleibt stehen, bis man sie löscht
- Reiter `Site Media | Stock Media`
- Filter und Sortierung: Datum, Alphabet, Ordner
- unten `Upload Media` und `⋯` (Import aus fremder Website, Dropbox, Facebook,
  Google Drive, Content-Collection-Formular)
- oben das Symbol `Manage Media` → Media Manager
- Bedienung: Element aus dem Panel auf die Fläche ziehen; beim Schweben zeigt
  sich eine Vorschau, eingesetzt wird erst beim Loslassen

**Media Manager** (Vollbild-Dialog, dunkler Kopf `MEDIA MANAGER` + `✕`):

    🔍 Search for images        Images · Icons · Videos · Audio · Files
    ┌──────────────┬───────────────────────────────┬──────────────────┐
    │ [+ Upload]   │ All Images    ▽ Images ↑↓ Sort│ Image   Unselect │
    │ ⤓ Import     │ Site Images   ▦ ☰             │  [Vorschau]      │
    │ ─────────────│ ┌────┐┌────┐┌────┐            │  Name: …         │
    │ FREE IMAGES  │ │Ordn││Ordn││Bild│            │  Size: 1920×1080 │
    │ PREMIUM      │ └────┘└────┘└────┘            │  ( Rename )      │
    │ SITE IMAGES  │  Linens(3) Blankets(2)        │  Selected (2)    │
    │  UPLOADED(65)│                               │  [▤][▤]  ‹ ›     │
    │  PURCHASED(0)│                               │  Move to folder ⌄│
    │  📁 Blankets │                               │  🗑 Delete Sel.  │
    │  + Add Folder│                               │                  │
    │ Manage Images (○ )                           │                  │
    │ All Alt Text ↗                               │                  │
    └──────────────┴───────────────────────────────┴──────────────────┘

- Auswahl = blaue Pille mit Haken ÜBER dem Bild, Rahmen blau
- unausgewählt beim Überfahren: Knopf `Select`
- Ordner sehen aus wie Ordner, mit Anzahl in Klammern
- `Manage Images`-Schalter blendet die Verwaltungsfunktionen ein

**Image Picker – Quick View** (kleiner Dialog):
Suchfeld, zwei Dropdowns `All Images ⌄` und `Images ⌄`, zweispaltiges Raster,
unten `( + Upload )` und `( Full View )`.

## 13. Site Settings (More → Settings)

Site Icons · Site Domain · Preview (mit Kopier-Knopf für die Vorschau-Adresse) ·
Unpublish Site · Site SSL (Let's Encrypt) · Load Site in an iFrame ·
Google Analytics · URL Redirect · Header HTML · Backup

## 14. SEO/AEO

Die Leiste führt in den **SEO/AEO-Bereich des Site-Dashboards**, nicht in ein
Panel. Dort in der Seitenleiste `Additional Settings`:
No index (ganze Site) · Site meta title (≤ 60 Zeichen) ·
Site meta description (≤ 160) · Site Keywords (kommagetrennt).
Je Seite gibt es eigene Titel/Beschreibungen über `Page Settings`.
Knopf **`Generate Meta Tags`** erzeugt fehlende Angaben per KI.

## 15. Die ZWEITE Navigationsform — Akkordeon, nicht Leiste

Der Verwaltungsbereich (außerhalb des Editors) sieht völlig anders aus:

    ← Booking Websites                                    [◫]
    [Unpublished]  Plan Standard  Site 10638-022.holidayfuture.com
                              Upgrade  ( ✓ Save )  [ 🚀 Publish ]  ( ⋮ )
    ┌────────────────────┬─────────────────────────────────────────
    │ 🖥 Design          │  Check-out & Pricing
    │ ☰  Listings        │  ─────────────────────────────────────
    │ ▤  Pages         ⌄ │  (○ ) Include fees & discounts …
    │ ⚙  Settings      ⌃ │  (●) Show opt-in for promotional emails
    │      Branding      │  (○ ) Enable guest checkout …        ⓘ
    │      Domain & Security
    │      Content Display
    │      Check-out & Pricing   ← aktiv: grau hinterlegt
    │      Reservation Settings
    │      Analytics
    │      SEO Settings
    │ 🌐 Translations  ⌄ │
    │ </> Scripts & Widgets ⌄
    └────────────────────┴─────────────────────────────────────────

`Pages ⌃` klappt auf: Home · All listings · About us · Privacy policy ·
Terms & conditions · Contact us · Booking confirmation · Inquiry received ·
**Add custom page**.

**Das ist das Muster für unsere Untermenüs** (Einstellungen 6, SEO 6): ein
Akkordeon in der linken Navigation mit eingerückten Kindern und grau
hinterlegtem aktivem Eintrag — KEINE zweite senkrechte Leiste, KEIN verstecktes
Untermenü hinter einem Symbol.

Statusband oben: `Unpublished` rot umrandet bzw. `Published` grün,
dann Plan und Site-Adresse, rechts `Upgrade`, `Save` (Umriss),
`Publish` (dunkel gefüllt, Raketensymbol), `⋮`.
Ganz rechts oben `◫` blendet das Vorschau-Panel ein — das ist die RECHTE
Seitenleiste: `Preview` mit `⛶` (Vollbild) und `◫` (geteilt).

## 16. Formsprache des Verwaltungsbereichs

- Beschriftung links (feste Breite), Bedienelement rechts
- Abschnittsüberschriften fett, darunter eine Haarlinie
- Schalter: dunkel gefüllt = an, hellgrau = aus, Beschriftung rechts daneben,
  Erläuterung darunter in Grau
- Auswahlkarten: umrandet, ausgewählt mit **Teal-Rahmen** + gefülltem Radio
- Upload: gestrichelte Fläche, Wolkensymbol, „**Click to upload** or drag and
  drop", darunter „SVG, PNG, JPG or GIF (max. 800×400px)"
- Geteiltes Eingabefeld: `[10638-022][.holidayfuture.com]` + Kopier-Knopf
- Tabellen: Kopfzeile mit Auswahlkästchen, Zeilen mit Vorschaubild, Etiketten
  als Pillen (`3guests`, `+1`), unten `Page 4 of 5`, Blätterknöpfe,
  `Items per page: 20 ⌄`
- Reiter über Tabellen mit Anzahl-Pille: `Included ⑧⑥ | Excluded ③`
- Rich-Text: `Normal ⌄` `16 ⌄` `Font ⌄` 🎨 │ B I U S {} x² x₂ │ Listen │
  Ausrichtung │ 🔗 🔗̸ </> 😊 🖼 ⌫ ↩ ↪ │ `Preview` `{+}` (Platzhalter)

## 17. Vollständige Leisten-Belegung beider Generationen

**Aktuell (Booking Website Pro, Hostaway-Branding):**
`Add · Pages · Layers · Theme · SEO/AEO · More` — sechs, aktiv = graues Quadrat.
Mit installierten Zusätzen zusätzlich `Content` und `Store`.

**Ältere Fassung (orange aktiv, Beschriftungen daneben):**
`Layers · Theme · Pages · Widgets · Content · Personalize · Sell Online ·
Membership · Blog · App Store · SEO & Settings`, unten ein eigener Knopf
`Unhide Elements` (Auge mit ×) und ganz unten der KI-Kreis.

`More` enthält: Blog · Store · Bookings · Personalization · Settings ·
Site Dashboard.

## 18. Die Menüspalte im Klartext (Screenshot des Nutzers, 25.08.2026 18:48)

    LEISTE ~60px   MENÜSPALTE ~140px      PANEL ~330px
    ┌──────────┐   ┌──────────────┐   ┌─────────────────────────┐
    │ + Add    │◄  │ Elements   ⌃ │   │ « ELEMENTS       ▣ │ ✕  │
    │ ⧉ Pages  │   │   Recent     │◄  │ 🔍 Search for widgets   │
    │ ◈ Layers │   │   Layout     │   │ RECENT                  │
    │ ◫ Theme  │   │   Basic      │   │ ▤ Text                  │
    │ ──────── │   │   Form       │   │ 🎟 Coupon               │
    │ ⌕ SEO/AEO│   │   Visuals &  │   │ ▤ All Posts             │
    │ ▤ Blog   │   │     Audio    │   │ LAYOUT                  │
    │ ──────── │   │   Business   │   │ ▦ Advanced Tabs         │
    │ ⋯ More   │   │   Social     │   │ ☰ Advanced Accordion    │
    └──────────┘   │   Blog       │   │ ⊞ Advanced Grid         │
                   │   Other      │   │ ⊟ Inner Column          │
                   │ Media        │   │ ◫ Inner Column          │
                   │ Site Text    │   │ BASIC                   │
                   └──────────────┘   │ ▤ Text · 🔘 Button      │
                                      │ — Divider · ↕ Spacer    │
                                      │ H₁ Large · H₃ Small     │
                                      └─────────────────────────┘

**Drei Erkenntnisse:**

1. **Die Menüspalte ist ein AKKORDEON**, kein flaches Menü: `Elements ⌃` ist eine
   aufklappbare Gruppe mit eingerückten Kindern, `Media` und `Site Text` stehen
   als eigene Einträge daneben. Es ist DASSELBE Muster wie die Navigation im
   Verwaltungsbereich (Abschnitt 15) — das ganze Produkt kennt genau ein
   Untermenü-Muster, nicht zwei.
2. **`Inner Column` ist ein WIDGET aus dem Katalog** (in zwei Varianten,
   waagerecht und senkrecht geteilt). So werden Spalten angelegt: man zieht
   eine hinein. Es gibt KEINEN „Spalte teilen"-Knopf.
   Das beantwortet die offene Frage, wie ein Kunde bei uns je zu einer zweiten
   Spalte kommen soll.
3. Die Widgetliste ist **einspaltig mit umrandeten Karten**: Symbol in einem
   hellen abgerundeten Quadrat links, Beschriftung daneben, Kategorie als
   kleines graues Versalband darüber (`RECENT`, `LAYOUT`, `BASIC`). Überfahren
   füllt die Karte hellgrau.

Panel-Kopf hier: `«` (zurück zur Menüspalte) · `ELEMENTS` · `▣` (Breite) ·
Trennstrich · `✕`. Die Leiste zeigt `Blog`, weil der Zusatz installiert ist.

---

# Teil 3 — aus der klickbaren Demo und den Screenshots des Nutzers
(Storylane-Rundgang, 24 Schritte, und `docs/UI/*.png`, 25.08.2026)

## 19. Das vollständige Grundraster

    ┌──────────────────────────────────────────────────────────────────────┐
    │ Hostaway │ Home ⌄ │ 🇺🇸⌄ │ 🖥▭▯ │        │ 🔍 ⓘ ✓ ↺ ↻ │ Preview ▶ │ [Publish] │ ? │ ⌂ │
    ├────┬────────────┬──────────────────────────────────┬────────────────┤
    │ +  │ Elements ⌃ │                                  │ ◫        ? ✕   │
    │Add │  Recent    │                                  │ …›Col›InnerCo› │
    │ ⧉  │  Layout    │        Arbeitsfläche             │ Text Block     │
    │Page│  Basic     │                                  │ Frame          │
    │ ◈  │  Form      │      [Section]                   │ › Style        │
    │Layr│  Visuals   │                                  │ › Alignment    │
    │ ◫  │  Business  │                                  │ › Spacing      │
    │Them│  Social    │                                  │ › Size ⓘ       │
    │────│  Blog      │                                  │ › Animation ●  │
    │ ⌕  │  Other     │                                  │ › Position     │
    │SEO │ Media      │        + Add Section             │                │
    │ ▤  │ Site Text  │                                  │                │
    │Blog│            │                                  │                │
    │────│            │                                  │                │
    │ ⋯  │            │                                  │                │
    │More│            │                                  │                │
    └────┴────────────┴──────────────────────────────────┴────────────────┘
      60px   140px                                            320px

Eingeklappt bleibt rechts nur ein Griff `‹` am Fensterrand.
Ist der Inspektor offen, RÜCKT DIE FLÄCHE ZUSAMMEN — sie wird nicht überdeckt.

## 20. Kopfzeile: Top-Bar im Klartext

`Hostaway`-Logo · `Home ⌄` (Seitenwahl) · `🇺🇸 ⌄` (Sprachwahl) ·
`🖥 ▭ ▯` (Gerät, aktiv = teal gefülltes Quadrat, Desktop mit Krönchen) ·
… · `🔍` Suche · `ⓘ` Info · `✓` Speicherstand · `↺ ↻` · `⤴` Teilen ·
`Preview ▶` · `[Publish]` bzw. `[Republish]` (teal Pille) · `?` · `⌂`

Sprachmenü: Kopfzeile `⊟ Manage Languages`, dann Flagge + Name,
`English (default)` hervorgehoben.

## 21. Panels haben UNTERSCHIEDLICHE Breiten

- Elements / Site Theme / Pages: ~330 px
- **Blog: fast bildschirmbreit** (~1070 px) mit EIGENER Unter-Navigation
  `Posts · Settings · Layouts · Import` (flache Liste, aktiv grau hinterlegt)
- Site Dashboard (SEO): Vollbild-Überlagerung mit eigener linker Navigation

Eine feste Panel-Breite ist also falsch. Listen mit Tabellen brauchen Platz.

## 22. Site Theme — vollständig

    SITE THEME                    ? ▣ ✕
    COLORS                          ›     ← Farbraster + [+]
    BUTTONS                         ›     ← ( Primary ) ( Secondary ) echte Vorschau
    TEXT                            ›
      DFLT  Inter, 16
      PAR   Inter, 16
      H1    Inter, 70   ← in ECHTER Größe gerendert
      H2    Inter, 70
      H3    Inter, 56
      H4    Inter, 32
      H5    Inter, 24
      H6    Inter, 14
    WIDTH & SPACING              ●  ›     ← teal Punkt = vom Standard abweichend
    IMAGES                          ›
    BACKGROUNDS                     ›

Der **teal Punkt** markiert geänderte Gruppen. Denselben Punkt trägt der
Inspektor an `Animation ●`.

## 23. Inspektor rechts — der Aufbau

    ◫                              ? ✕
    … ›  Col… ›  Inner Co… ›  Inner Co… ›   ← BREADCRUMB, gekürzt, scrollbar
    Text Block                              ← Name des Elements
    Frame                                   ← Gruppenüberschrift
    › Style      › Alignment    › Spacing
    › Size ⓘ     › Animation ●  › Position

Bei einem gesperrten Baustein steht darunter ein blauer Hinweis:
„ℹ This content cannot be edited. Contact your administrator."
Danach einzelne Werte, z. B. `Background color  ○`.

Breadcrumb-Beispiele: `Main section › Column ›` · `Section › Column ›`.

## 24. Text bearbeiten — die Schwebeleiste

    ✨ AI Assistant ⌄ │ B I U ⋯ │ A ✕ │ paragraph* ⌄ │ Inter ⌄ │ 14 ⌄ │ ⤢ │
    🔗 │ ≡ ≡ │ ⋮≡ ⋮≡ ⌄ │ ¶ │ ↺ ↻ │ ✓

`AI Assistant ⌄` öffnet:

    Write with AI
      New Title
      Title for This Text      ›
      Paragraph
      Custom Text
    Quick edits
      ⚡ Improve Writing
      ⇥ Make Shorter
      ⇤ Make Longer
      🌐 Translate             ›

## 25. Abschnitt einfügen

Am unteren Rand eines Abschnitts erscheint mittig eine blaue Pille
**`+ Add Section`**. Das ist der Einstieg in den Vollbild-Wähler (Abschnitt 6).

## 26. Blog-Bereich

    BLOG                                        ? ✕
    ┌──────────┬──────────────────────────────────────┐
    │ Posts    │ Posts                                │
    │ Settings │ Create, manage and organize your …   │
    │ Layouts  │                    [ New Post ⌄ ]    │
    │ Import   │ 🔍 Search by title, description, …   │
    │          │                         ▽ Filter     │
    │          │ ☐ Posts (3)      Status              │
    │          │ ☐ [▤] Make the most of the season …  │
    │          │      Created: Mar 25, 2026 | By: tech│
    │          │      [Published]  Mar 25, 2026   ⋯   │
    └──────────┴──────────────────────────────────────┘

`New Post ⌄` → **„Draft a post with AI"**: Assistent mit Schritt-Reitern
`Business Details › Post Details`, Pflichtfelder mit `*`, Zeichenzähler
`0/5000`, Hilfszeile `✨ Need an idea? ›`, rechts eine Live-Vorschau-Spalte,
unten `Cancel` / `Post Details →`.

## 27. SEO/AEO — das „Site Dashboard"

Die Leiste öffnet KEIN Panel, sondern eine Vollbild-Überlagerung:

    SITE DASHBOARD                                              ✕
    ┌─────────────────┬────────────────────────────────────────┐
    │ 188389_13    «  │ View a summary of your site's SEO …    │
    │ ⌕ SEO/AEO       │ ⚙ Looking for site settings?           │
    │   Site Audit    │   Find URL redirects, favicon and …    │
    │   Page SEO      │   [ Take Me There ]                    │
    │   Image Alt Text│                                        │
    │   Internal Links│ (All) (Needs Attention) (Recommended)  │
    │   External Links│ ↻ Last update: Today at 11:13 AM       │
    │   Additional …  │ English ⌄    ☐ Indexed only            │
    │ ▤ Blog       ↗  │ Category │ Status │ Description │      │
    │                 │ › Page Meta Tags │High priority│1 issue│View Details →│
    │                 │ › Image Alt Text │High priority│…      │
    │                 │ › Internal Links │Notice       │…      │
    │                 │ Site's Open Graph│Medium       │No OG image yet│Fix It →│
    │                 │ Blog Content Freshness │Medium │…      │
    │                 │ Favicon          │Medium       │…      │
    └─────────────────┴────────────────────────────────────────┘

Statuspillen: `High priority` rot, `Medium priority` orange, `Notice` grau.
Aktion rechts je Zeile: `View Details →` oder `Fix It →`.

**Meta-Tags in Serie bearbeiten** (`View Details` bei Page Meta Tags):
Modal mit Schritt-Reitern `Review Meta Tags › Save Changes`, Tabelle
`Page Name │ Title (55 ch.) ⓘ │ Description (160 ch.) ⓘ │ No Index?`,
Zeichenzähler ÜBER jedem Feld (`55 ch.`, `88 ch.`), in jedem Feld ein teal
`+` zum KI-Erzeugen, Auswahl per Kästchen, unten `Next`.

## 28. Widget-Katalog — alle Kategorien

`Recent · Layout · Basic · Form · Visuals & Audio · Business · Social · Blog ·
Other`, daneben `Media` und `Site Text`.

- **Layout**: Advanced Tabs · Advanced Accordion · Advanced Grid ·
  **Inner Column** (zwei Varianten) 
- **Basic**: Text · Button · Divider · Spacer · Large Title · Small Title
- **Form**: Advanced Form `BETA` · Contact Form
- **Visuals & Audio**: Media Slider · Image · Photo Gallery · Icon · Video ·
  Shape · Before & After · Lottie Animation · Audio
- **Business**: Bookings `NEW` · Click To Call · Coupon · Google Calendar · Yext
- **Social**: Share · Twitter Feed · Social Icons · RSS Feed · Disqus Comments ·
  Facebook Feed · WhatsApp
- **Blog**: All Posts · Recent Posts

Abzeichen: `BETA` grau, `NEW` teal, ✨-Funken an KI-fähigen Bausteinen.

## 29. Pillen auf der Fläche — die Farben bedeuten etwas

- **blau** `Section`, `› Photo Gallery`, `› Button` — normaler Abschnitt/Baustein
- **violett** `› Search form`, `› transfer-search` — dynamischer/gesperrter Baustein
- **orange** `HEADER`, `FOOTER` — die site-weiten Regionen

## 30. Was daraus für UNSEREN Umbau folgt

1. Leiste auf ~60 px, SECHS bis SIEBEN Einträge, Gruppen durch Weißraum,
   aktiv = graues Quadrat hinter dem Symbol, „Hinzufügen" NICHT getönt.
2. Menüspalte (~140 px) als Akkordeon dazwischen — dort leben die Unterpunkte
   von Hinzufügen, SEO und Einstellungen.
3. Inspektor nach RECHTS, mit Breadcrumb der Elternkette und Akkordeon-Gruppen.
   Die Fläche rückt zusammen, statt überdeckt zu werden.
4. Ebenen-Baum ohne Abzeichen; Kopf- und Fußzeile als echte Knoten.
5. `Inner Column` wird ein Baustein im Katalog — so entstehen Spalten.
6. `+ Add Section` als Pille am unteren Rand jedes Abschnitts.
7. Panel-Breite je Bereich, nicht fest.
8. Änderungs-Punkt (teal) an Gruppen, die vom Standard abweichen.
