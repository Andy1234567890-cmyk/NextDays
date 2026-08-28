# Framer CMS — vollständige Nachbau-Spezifikation (28.08.2026)

Quelle: `framer.com/projects/Pearl-FREE-Portfolio-Template-copy--S6TIWpCjBdmnBgd8Zayq-eHJy7`,
Collection **Work** (6 Einträge, 24 Felder) + Collection **Notion** (synchronisiert, 0 Einträge).

Ausgelesen im laufenden Chrome über die Erweiterung „Claude in Chrome" — **jedes
Bedienelement wirklich angeklickt**, Untermenüs und Dialoge im Dialog geöffnet,
Maße und Farben als `getComputedStyle`-Werte abgegriffen. Fenster: **1920 × 902 CSS-Pixel**.

Zweck: Vorlage für den Blog-/CMS-Bereich des Baukastens (`/website/seiten/<id>?panel=blog`).

> Ersetzt die Fassung vom Vormittag. Neu darin: die vollständige Feldtyp-Liste,
> das Collection-Kontextmenü, alle Plugin-Dialoge, der Bild-Dialog samt Zuschneiden,
> das Kopfleisten-Menü, Einladen/Branches, die Zustände und die gemessenen Farben.

---

## A · Aufbau

| Bereich | Position | Größe | CSS-Variable |
|---|---|---|---|
| Kopfleiste | 0,0 | 1920 × **51** | `--framerInternalUI-chromeToolbarHeight: 51px` |
| Linke Spalte | 0,51 | **260** × 851 | `--framerInternalUI-tabContentWidth: 260px` |
| Arbeitsfläche (Tabelle) | 260,51 | 1400 × 851 | `--framerInternalUI-chromeMarginLeft: 260px` |
| Agent-Spalte (rechts) | 1660,51 | 260 × 851 | — |
| Editor-Dialog (über allem) | 780,0 | **880** × 902 | — |

Weitere Variablen des Wurzelelements:

    --framerInternalUI-chromeMarginTop:      51px
    --framerInternalUI-chromeMarginRight:     0px
    --framerInternalUI-chromeMarginBottom:    0px
    --framerInternalUI-propertyPanelWidth:  260px
    --framerInternalUI-responsiveLeftPanel: 260px
    --framerInternalUI-responsiveLeftOffset:260px
    --framerInternalUI-rightPanelWidth:       1px
    --framerInternalUI-floatingToolbarTop:   60px
    --framerInternalUI-floatingToolbarBottom:10px

### A1 Kopfleiste

| Element | Position (CSS) | Größe | Öffnet |
|---|---|---|---|
| `CMS ⌄` | 10,10 | 78 × 30 | App-Menü (siehe B1) |
| Projektname `Pearl FREE Portfolio Template (copy)` | mittig | — | nichts (reiner Text) |
| `⑂ main` | 1051,16 | 46 × 18 | Branches-Popover (B2) |
| Avatar `AS` | 1638,10 | 30 × 30 | Einladen-Panel (B3) |
| `▷` Preview | 1678,10 | 30 × 30 | **nicht geprüft** (siehe H) |
| `Einladen` | 1718,10 | 73 × 30 | Einladen-Panel (B3) |
| `Veröffentlichen` | 1800,10 | **110 × 30** | **nicht geklickt** (Auftrag: nichts veröffentlichen) |

Im geöffneten Editor-Dialog wird die Kopfleiste ersetzt durch:
`×` (790,0 · 30×51) · `⋯` More (B7) · `▷` Preview · Zustandstext **`Saved`** bzw. Knopf
**`Save`** · `Veröffentlichen`.

### A2 Reiter der linken Spalte (y = 61, je 30 hoch, Radius 8)

`Collections` (88 breit) · `Fields` (57) · `Plugins` (65)

### A3 Werkzeugleiste über der Tabelle (y = 62, je 30 × 30, Radius 8)

| Knopf | Position | Öffnet |
|---|---|---|
| `+` New Item | 270,62 | Editor-Dialog, leer (B8) |
| Sorting | 304,62 | Sortier-Panel (B4) |
| Filter | 338,62 | Filter-Menü (B5) |
| Search | 372,62 | Suchfeld inline in der Leiste (B6) |
| `⋯` Show Columns | 1620,62 | Spaltenwahl (B6) |

Bei Zeilenauswahl wird `+` ersetzt durch **`N Selected ⌄`** (Sammelaktionen, B9).
Bei einer **synchronisierten** Collection ist `+` weg; stattdessen stehen dort
`⟳` (Resync) und ein Zahnrad-Knopf **`Manage`**.

### A4 Tabelle

| Teil | Maß |
|---|---|
| Kopfzeile | **50** hoch, `#ffffff`, Text `#999999` 13px/600, Innenabstand 10px |
| Zeile | **51** hoch |
| Spalte Griff + Kontrollkästchen | **67** |
| Spalte `Project Thumbnail Title` | **250** |
| Spalte `Status` | **94** |
| Spalte `Main Image / Thumbnail Image` | **130** |
| Spalte `Show on the homepage` | **100** |
| jede weitere Spalte | **210** |
| Spaltentrenner | Knopf 12 × 50 zwischen zwei Köpfen → Breite ziehen |

Je Zeile: `⠿ Reorder row N` (24 × 24, bei 275) · `Select row N` (14 × 14, bei 298) ·
beim Überfahren zusätzlich `Expand row` / `Toggle Overlay` rechts in der Titelzelle.
In der Kopfzeile `Select all rows` (14 × 14, bei 298,120).
Unter der letzten Zeile eine leere Zeile `New item` (Klick legt einen Eintrag an).

**Die Tabelle scrollt waagerecht** (Gesamtbreite 4302 px bei 24 Feldern). Dabei bleibt
die Spalte `Project Thumbnail Title` **fixiert** stehen, alle anderen — auch `Status`
und `Main Image` — scrollen weg. Reihenfolge der Spalten von links nach rechts:

`Project Thumbnail Title` · `Status` · `Main Image / Thumbnail Image` ·
`Show on the homepage` · `Slug` · `Industry` · `Client` · `Full Project Title` ·
`Intro Section Heading` · `Intro Section Body` · `Button Text` · `Website Link` ·
`Gallery Top` · `Gallery Side Left` · `Gallery Side Right` · `Gallery Bottom` ·
`Final Section Heading` · `Final Section Body` · `Show Image Carousel` ·
`Carousel Img 1` · `Carousel Img 2` · `Carousel Img 3` · `Carousel Img 4` ·
**`Created`** · **`Edited`**

`Created` und `Edited` sind also **doch Standardspalten** — sie stehen ganz rechts.
Gemessen: `Created` ist bei allen sechs Einträgen **leer**, `Edited` gefüllt
(`18.07.2025, 10:31` … `28.08.2026, 11:30`). Beide Spalten sind **schreibgeschützt**:
ein Klick setzt nur den Auswahlrahmen, ein Doppelklick öffnet kein Eingabefeld.

Galerie-Zellen zeigen **mehrere Miniaturbilder nebeneinander** in einer Zelle
(bis zu drei sichtbar, Rest abgeschnitten); eine leere Galerie zeigt eine graue
Platzhalter-Pille.

---

## B · Bedienelemente — vollständige Menüinhalte

### B1 `CMS ⌄` — App-Menü

Suchfeld `Type to search…`, dann:

`Canvas ⌥1` · `CMS ⌥2` · `Localization ⌥3` · `Analytics ⌥4` · `Settings ⌥5`
— der aktive Eintrag steht grau.

`Go to Dashboard` · `Quick Actions ⌘K`

`File ›` · `Edit ›` · `View ›` · `Tool ›`(grau) · `Layout ›`(grau) · `Text ›`(grau) ·
`Vector ›`(grau) · `Component ›`(grau) · `Plugins ›` · `Code ›`(grau) · `Preferences ›`

`Help ›` · `Your Account`

Die grauen Einträge sind nur im Canvas aktiv.

**`File ›`** (17 Einträge, mit Tastenkürzeln):
`New ⌥⌘N` · `New Page` · `New Page Folder` · `New Chat ⌘J` ·
`Import from Figma… ⇧⌘I` · `Upload Image… ⌥⌘I` · `Upload Video…` ·
`Publish Update ⇧⌘P` · `Open Site ⇧⌘O` · `Duplicate` · `Archive` ·
`Transfer Project` · `Copy Remix Link` · `Invite Collaborators…` ·
`Version History ⇧⌘H` · `Sort Pages Alphabetically` · `Sort Layers Alphabetically`

**`View ›`** (18 Einträge):
`Open Preview ⌘P` · `Appearance` · `Show Pages ⌥⇧1` · `Show Layers ⌥⇧2` ·
`Show Assets ⌥⇧3` · `Show Agent A` · `Show Style E` · `Show Interface ⌘.` ·
`Show All Links` · `Show Handoff` · `Show Rulers ⌃R` · `Show Pixel Grid` ·
`Zoom In ⌘+` · `Zoom Out ⌘–` · `Zoom to 100% ⌘0` · `Zoom to Fit ⌘1` ·
`Zoom to Selection ⌘2` · `Collapse Layers ⌥L`

**`Preferences ›`** (13 Einträge):
`Animate on Zoom` · `Auto-Draft Content` · `Auto-Layout Pinning` ·
`Auto-Switch to Layers Panel` · `Exit Canvas on Double Click` · `Fast Zoom` ·
`Keyboard Zooms to Selection` · `Off-Screen Content Hint` ·
`Reverse Zoom Direction` · `Use Direct Selection` · `Nudge Amount` ·
`Performance Mode` · `Reset Default Frame Fill`

`Edit ›`, `Plugins ›` und `Help ›` gingen nicht auf (siehe H).

### B2 `⑂ main` — Branches

Popover „Branches" mit Text
*„Branches let you explore changes, share previews, and publish when you're ready."*
und einem Knopf **`Upgrade`**. Es gibt in diesem Tarif **keine** Branch-Liste.

### B3 `Einladen` / Avatar — dasselbe Panel

- Eingabefeld `name@email.com` + Sende-Pfeil
- Rollen-Auswahl, Vorgabe `Full Access`:
  **`Full Access`** ✓ · **`Content Editor`** · **`View Only`**
- Zeile `andy's Workspace — Alle Mitglieder haben Zugriff`
- Zeile `Projektlink — Jeder kann es sehen ⌄` + Knopf `Copy`
  Auswahl: **`Anyone can view`** · **`Only members can access`**
- Zeile `Andy Staudinger — Eigentümer` + `Jetzt ansehen`

### B4 Sorting

Leerzustand: Symbol, Überschrift **„Keine Sortierung"**, Text
*„Wenden Sie mehrere Sortierregeln an, um die Reihenfolge der Elemente in der Tabelle
zu steuern."*, Knopf **`Add Sorting`**.

`Add Sorting` öffnet eine Feldliste mit Suchfeld. **15 sortierbare Felder** (Bild-,
Galerie- und Link-Felder fehlen bewusst):

`Status` · `Project Thumbnail Title` · `Show on the homepage` · `Slug` · `Industry` ·
`Client` · `Full Project Title` · `Intro Section Heading` · `Intro Section Body` ·
`Button Text` · `Final Section Heading` · `Final Section Body` · `Show Image Carousel` ·
`Created` · `Edited`

Untermenü je Feldtyp:

| Typ | Richtungen |
|---|---|
| Text / Slug | `A → Z` · `Z → A` |
| Auswahl (Status) | `Draft → Live` · `Live → Draft` |
| Schalter | `Yes → No` · `No → Yes` |
| Datum (Created/Edited) | `Old → New` · `New → Old` |

Nach dem Wählen steht die Regel als Zeile `Projekttitel… [T] A → Z ×` im Panel,
darunter `+ Add…` für eine **zweite** Regel (bereits benutzte Felder fallen aus der
Liste), darunter die Knöpfe **`Discard`** und **`Save`** (blau).
Die Tabelle sortiert sofort als Vorschau; der Sorting-Knopf bekommt einen blauen Punkt.
`Discard` stellt die alte Reihenfolge wieder her. Eine einzelne Regel entfernt das `×`.
**Panel schließen speichert nicht** — der Entwurf bleibt beim erneuten Öffnen stehen.

### B5 Filter

Direkt eine Feldliste mit Suchfeld, **21 filterbare Felder** (ohne `Slug`,
`Gallery Top`, `Gallery Bottom`; dafür `Updated` statt `Edited`):

`Status` · `Project Thumbnail Title` · `Main Image / Thumbnail Image` ·
`Show on the homepage` · `Industry` · `Client` · `Full Project Title` ·
`Intro Section Heading` · `Intro Section Body` · `Button Text` · `Website Link` ·
`Gallery Side Left` · `Gallery Side Right` · `Final Section Heading` ·
`Final Section Body` · `Show Image Carousel` · `Carousel Img 1` · `Carousel Img 2` ·
`Carousel Img 3` · `Carousel Img 4` · `Created` · `Updated`

Untermenü je Feldtyp:

| Typ | Operatoren |
|---|---|
| Auswahl (Status) | `Live` · `Draft` |
| Text | `Is Set` · `Isn't Set` |
| Schalter | `Yes` · `No` |
| Datum | `Is Set` · `Isn't Set` · `Equals` · `Doesn't Equal` · `Is Before` · `Is After` · `Is Between Dates` |

**Es gibt keine `enthält`/`beginnt mit`-Operatoren für Text.**
Der Filter greift **sofort** (kein Save/Discard) und erscheint als Chip
`Live ×` rechts neben den Werkzeugknöpfen; das `×` entfernt ihn.

### B6 Search und Show Columns

**Search** klappt ein Eingabefeld direkt in die Werkzeugleiste (`Search…`).
Es sucht über **alle** Felder, nicht nur den Titel: „fintech" findet auch
*Healthcare Mobile App*, weil deren Fließtext „Dello Fintech" enthält.
Ohne Treffer zeigt die Fläche mittig **`No search results`**.

**Show Columns** (`⋯`) öffnet eine **Mehrfachauswahl** mit Suchfeld: alle 24 Felder
plus `Created` und `Edited`, jeweils mit Häkchen. Ein Klick schaltet ein Feld um,
**das Menü bleibt offen**.

### B7 Editor-Dialog · `⋯` More

`New Item` · `Draft Item` · `Open in Canvas` · `Open in Localization` *(grau)* ·
`View Analytics` · `Edit Fields` · `Copy Link` · `Copy as Markdown` · `Delete`

- `Edit Fields` wechselt die linke Spalte auf den Reiter **Fields** derselben Collection.
- `View Analytics` verlässt das CMS und öffnet die Analytics-Ansicht:
  linke Spalte `Analytics › Overview`, `Funnels +` mit Eintrag `Funnel`, `A/B Tests +`;
  Fläche leer mit *„Analytics — Publish your website to track and view insights."*
  Rückweg über `CMS ⌄ → CMS`.
- `Copy Link` / `Copy as Markdown` schreiben in die System-Zwischenablage
  (Inhalt nicht gegengeprüft, siehe H).
- `Draft Item` und `Delete` wurden auftragsgemäß **nicht** ausgeführt.

### B8 Spaltenkopf, Zeile, Zelle

**Klick auf einen Spaltenkopf** → `Edit Field` · `Sort by ›` (`A → Z`, `Z → A`) · `Hide`

**Rechtsklick auf eine Zeile ODER eine beliebige Zelle** → derselbe Inhalt:
`Edit` · `Open` · `Draft` · `Duplicate` · `Delete`

Nachgeprüft, was die beiden ersten Einträge wirklich tun:

| Eintrag | Wirkung (gemessen) |
|---|---|
| `Edit` | **öffnet NICHT den Dialog**, sondern setzt den Schreibcursor in die Zelle — dieselbe Inline-Bearbeitung wie ein Doppelklick |
| `Open` | in dieser Vorlage **ohne sichtbare Wirkung** (dreimal versucht) |

Den Editor-Dialog öffnet ausschließlich der **`Expand row`**-Knopf, der beim
Überfahren rechts in der Titelzelle erscheint.

### B8a Zellen bedienen — Einfachklick, Doppelklick, Feldtyp

| Zelltyp | Einfachklick | Doppelklick |
|---|---|---|
| Text (`Industry`, `Client`, `Slug`, `Full Project Title`, …) | **Auswahl**: Hintergrund `rgb(242,250,255)`, 3 px blauer Rahmen, Text wechselt von `#999` auf `#222` | **Inline-Eingabefeld**: die Zelle wird zu einem echten `<input>` mit dem Wert, Text markiert bzw. Cursor am Ende |
| Status | Klappliste `Draft` / `Live` (✓ am aktuellen Wert) | — |
| Schalter | schaltet sofort um | — |
| Bild (`Main Image`, `Carousel Img n`) | **öffnet das Bild-Popover direkt aus der Tabelle** (Vorschau, Auflösung, Alternativtext, Mittelpunkt, `Crop`, `Plugins`) | — |
| Galerie | nur Auswahl | nur Auswahl |
| `Created` / `Edited` | nur Auswahl | kein Eingabefeld — schreibgeschützt |

Das ist der zentrale Unterschied zu unserer heutigen Tabelle: **die Zelle selbst ist
das Eingabefeld**, der Dialog ist nur der zweite Weg.

**Status-Chip in der Zelle** (Pfeil): die Zelle wird zur Klappliste
`Draft` · `Live` (✓ beim aktuellen Wert).

**Schalter in der Zelle**: schaltet `Show on the homepage` sofort um
(30 × 20, Spur an `#0099ff`, aus `#eeeeee`, Radius 10, Knauf 16 × 16 rund).

**Ziehgriff `⠿`**: Maustaste halten und ziehen sortiert die Zeile um —
nur beschrieben, **nicht ausgeführt** (würde die Reihenfolge verändern).

**Kontrollkästchen**: eine Zeile wählen → Werkzeugleiste wird `1 Selected ⌄`;
`Select all rows` in der Kopfzeile → `6 Selected`.

### B9 Sammelaktionen (`N Selected ⌄`)

`Add To Agent` · `Draft` · `Undraft` *(grau, weil alle Ausgewählten Live sind)* ·
`Duplicate` · `Delete`

### B10 Collections-Spalte

**`⋯` neben einer eigenen Collection (`Work`)**
`Add To Agent` · `Edit Fields` · `Rename` · `Duplicate` · `Copy` · `Paste` *(grau)* · `Delete`

**`⋯` neben einer synchronisierten Collection (`Notion`)**
`Add To Agent` · **`View Fields`** *(statt Edit Fields)* · `Rename` · `Duplicate` ·
`Copy` · `Paste` *(grau)* · `Delete`

**`Add…` unter dem Block „Collections"**
`Add Collection` · `Import Collection` · `Paste Collection ⌘V` *(grau)* · `Add Collection Folder`

**`Add…` unter dem Block „Synced"**
Plugin-Auswahl: Abschnitt *Marketplace* mit `Browse Plugins  ⏎ to Open`,
Abschnitt *Featured* mit `Google Sheets`, `Notion`, `HubSpot`.
`Browse Plugins` öffnet einen **neuen Browser-Tab** auf
`https://www.framer.com/marketplace/plugins/`.

Ein Rechtsklick auf eine Collection öffnet **kein** Menü — nur der `⋯`-Knopf.

### B11 Synchronisierte Collection (Notion)

Leere Fläche mit Symbol, Text *„Ihre Sammlung ist leer. Synchronisieren Sie, um
loszulegen."* und blauem Knopf **`Sync`**.
Der Zahnrad-Knopf der Werkzeugleiste heißt **`Manage`** und öffnet den Plugin-Dialog
„Notion": Illustration, nummerierte Anleitung
`1. Log in to your Notion account` · `2. Pick the database you want to import` ·
`3. Map the database fields to the CMS`, darunter ein Knopf `Log In`.
**Nicht angemeldet** (Auftrag: keine OAuth-Verbindung).

### B12 Reiter „Plugins"

Suchfeld; Abschnitt **Recents**: `Notion`.
Abschnitt **Featured**: `Google Sheets` · `Airtable` · `Ashby` · `HubSpot` ·
`CSV Import` · `CMS Export` · `Browse All`.

| Plugin | Was sich öffnet |
|---|---|
| `Google Sheets`, `Airtable`, `Ashby`, `HubSpot` | identischer Dialog **„New Collection"**: Namensfeld mit dem Plugin-Namen vorbelegt, Text *„This Plugin will create a new Collection for you that can be synced at any time."*, Knöpfe `Cancel` / `Create` (blau). Erst danach käme die Anmeldung — **nicht ausgeführt**. |
| `CSV Import` | Fenster mit Collection-Klappliste (`Work`), Ablagefläche, Text *„Select a CMS collection and upload or drop your CSV here."*, blauer Knopf `Upload File` (öffnet den System-Dateidialog — **nicht geklickt**). |
| `CMS Export` | Fenster mit Vorschautabelle (Spalten `Slug`, `Project Thu…`, `Main Image…`, waagerecht scrollbar, alle 6 Zeilen), darunter Collection-Klappliste `Work ⌄` und die Knöpfe `Copy` / `Export`. |
| `Browse All` | neuer Tab auf den Framer-Marketplace. |

---

## C · Daten — die 24 Felder der Collection „Work"

Reihenfolge wie im Editor. „Pflicht" = Schalter `Erforderlich` in der Feldkonfiguration.

| # | Feld | Typ | Platzhalter / Besonderheit | Pflicht |
|---|---|---|---|---|
| 1 | Project Thumbnail Title | Plain Text | `Short project title for the thumbnail`, **Maximale Zeichen 30** | Ja |
| 2 | Status | Auswahl (fest eingebaut) | `Draft` / `Live` — **nicht konfigurierbar** | — |
| 3 | Main Image / Thumbnail Image | Image | Standardbild + `Upload` | Ja |
| 4 | Show on the homepage | Toggle | Standard `Yes` | — |
| 5 | Slug | Slug | `Bezogen auf` → Textfeld; Hinweis `e.g. /blog/post-title/` | — |
| — | *(Divider)* | Divider | leere Trennzeile im Editor | — |
| 6 | Industry | Plain Text | `Enter Industry` | Ja |
| 7 | Client | Plain Text | `Enter Client Name` | Nein |
| 8 | Full Project Title | Plain Text | **abgeleiteter Standardwert** (`Default → Value` + `Based on`), Knopf `Reset` | **Ja** |
| 9 | Intro Section Heading | Plain Text, **Textbereich = Yes** | mehrzeilig | Nein |
| 10 | Intro Section Body | Plain Text, Textbereich | mehrzeilig, hoch | Nein |
| 11 | Button Text | Plain Text | `Enter Button CTA` | Nein |
| 12 | Website Link | Link | `Page or URL…`, Knopf `Clear page link` | Nein |
| 13 | Gallery Top | Gallery | `Min` / `Max` je mit `Clear` | Nein |
| 14 | Gallery Side Left | **Image** (nicht Gallery!) | `Default` + `Upload` | Nein |
| 15 | Gallery Side Right | **Image** (nicht Gallery!) | wie 14 | nicht geprüft |
| 16 | Gallery Bottom | Gallery | `Min`/`Max` + `Clear`, mehrere Bilder + `+`-Kachel | Nein |
| 17 | Final Section Heading | Plain Text, Textbereich | — | Nein |
| 18 | Final Section Body | Plain Text, Textbereich | — | nicht geprüft |
| 19 | Show Image Carousel | Toggle | `Standard` = No | — |
| 20–23 | Carousel Img 1–4 | Image | je ein Bild, `Default` + `Upload` | Nein (für Img 1 geprüft) |
| 24 | Created | Datum, automatisch | **Standardspalte ganz rechts**, in dieser Collection durchweg **leer**, schreibgeschützt | — |
| 25 | Edited (im Filter `Updated`) | Datum, automatisch | Standardspalte ganz rechts, gefüllt, schreibgeschützt | — |

### C1 Feldkonfiguration (Klick auf einen Feldnamen — im Editor **oder** im Reiter Fields)

Das Popover trägt den Feldnamen als Überschrift und hat oben rechts ein `×`.
Welche Zeilen erscheinen, hängt vom Typ ab:

| Typ | Zeilen |
|---|---|
| Plain Text (einzeilig) | `Name` · `Beschreibung` · `Erforderlich` Yes/No · `Textbereich` Yes/No · `Platzhalter` · `Maximale Zeichen` + `Clear` · `+ Add…` |
| Plain Text (Textbereich = Yes) | `Name` · `Beschreibung` · `Erforderlich` · `Textbereich` · `+ Add…` |
| Image | `Name` · `Beschreibung` · `Erforderlich` · `Standard` (Bildvorschau + `Upload`) |
| Toggle | `Name` · `Beschreibung` · `Standard` Yes/No |
| Slug | `Name` · `Beschreibung` · `Bezogen auf` (Klappliste) · Hinweis `e.g. /blog/post-title/` |
| Link | `Name` · `Beschreibung` · `Erforderlich` |
| Gallery | `Name` · `Beschreibung` · `Erforderlich` · `Min` + `Clear` · `Max` + `Clear` |
| Status | **kein** Popover — das Feld ist nicht konfigurierbar |

Zusätzlich bei **`Full Project Title`** (und nur dort gemessen): die Zeilen
**`Default`** mit dem Unterpunkt **`Value`** und **`Based on`** mit einer
Auswahlliste aller Textfelder — `Project Thumbnail Title` · `Industry` · `Client` ·
`Intro Section Heading` · `Intro Section Body` · `Button Text` ·
`Final Section Heading` · `Final Section Body`.
**Daraus kommt der `Reset`-Knopf im Editor**: der Wert ist von einem anderen Feld
abgeleitet, `Reset` stellt die Ableitung wieder her. Ein Feld kann seinen
Vorgabewert also aus einem anderen Feld ziehen — nicht nur eine Konstante.

**Die deutschen Beschriftungen sind NICHT von Framer.** Nachgemessen am
28.08.2026: das Dokument ist `<html class="translated-ltr" lang="de">`, es enthält
`<div id="goog-gt-tt">` und dutzende eingefügte `<font>`-Tags — **Chrome übersetzt
die Oberfläche live**. Framers Original ist durchgehend englisch. Deshalb wechselt
dasselbe Popover scheinbar die Sprache (`Erforderlich` vs. `Required`,
`Textbereich` vs. `Text Area`): Chrome hatte den einen Knoten schon ersetzt und den
anderen noch nicht. Die `aria-label`-Attribute bleiben unübersetzt und tragen den
echten Namen. **Beim Nachbau ist das englische Original die Referenz**, nicht das,
was hier auf Deutsch stand.

`Bezogen auf` (Slug) listet: `None` · `Project Thumbnail Title` · `Industry` · `Client` ·
`Full Project Title` · `Intro Section Heading` · `Intro Section Body` · `Button Text` ·
`Final Section Heading` · `Final Section Body` — also **alle Textfelder**.

**`+ Add…`** im Popover fügt eine weitere Einstellzeile hinzu und öffnet:
`Default` · `Placeholder` · `Max Length` · `Localization`

### C2 Feld anlegen, umbenennen, löschen

Reiter **Fields** → oben die Collection-Klappliste (`Work ⌄`), Überschrift `Fields`
mit einem **`+`** rechts (194,145). Der `+` öffnet die **vollständige Typenliste**
mit Suchfeld `Type to search…`:

`Plain Text` · `Formatted Text` · `Date` · `Link` · `Image` · `Gallery` · `Color` ·
`Toggle` · `Number` · `Option` · `File` ·
`Reference ›` · `Multi-Reference ›` · `Divider`

`Reference ›` und `Multi-Reference ›` öffnen jeweils die Liste der Collections
des Projekts: **`Work`** · **`Notion`**.

**Umbenennen**: `Name`-Feld im Konfigurations-Popover.
**`⋯` neben einem Feld in der Liste**: `Duplicate` · `Remove`.
**Umsortieren**: die Feldliste hat Ziehgriffe — nur beschrieben, nicht ausgeführt.

### C3 Bildfeld

Klick auf ein **vorhandenes** Bild öffnet das Popover „<Feldname>":
Vorschau, `Auflösung` (Klappliste: `Auto` · `Auto (Lossless)` · `Small` · `Medium` ·
`Large` · `Full`), `Alternativtext` (Wert z. B. `Main Project Image`),
`Mittelpunkt` (`+ Add…`), Knöpfe **`Crop`** und **`Plugins`**.

- **`Crop`** öffnet den Dialog „Crop Image": Bild mit Ziehrahmen, Zahlenfelder
  `2596 W` und `1568 H`, Knopf `Crop` (grau, bis etwas verändert wurde).
- **`Plugins`** öffnet eine durchsuchbare Plugin-Liste (`3D Shapes`, `AI Logo Generator`,
  `Alt Text Generator`, `Alt Text Generator AI`, `Alt Text Go`, `AltTextify – Alt Text
  Generator`, `AltWise`, `Angled Screen`, `ASCII`, … — die Liste ist lang und wurde
  nicht bis zum Ende gescrollt).

Das kleine Kreuz am Bild heißt **`Clear`** und entfernt das Bild aus dem Feld
(nicht geklickt).

Klick auf ein **leeres** Bildfeld (`+`) öffnet dasselbe Popover mit leerer
Ablagefläche und dem Knopf **`Choose Images…`** (System-Dateidialog, nicht geklickt);
`Alternativtext` steht dann auf `Describe Image…`, `Crop` ist grau.
Schließt man ohne Auswahl, bleibt das Feld unverändert.

**Der Alternativtext hängt am Bildfeld, nicht als eigenes Feld daneben.**

### C4 Slug-Feld im Editor

Unter dem Eingabefeld steht die URL-Vorschau als Knopf. Sie zeigt die echte
Framer-Adresse des Projekts: **`rotating-organization-714551.framer.app/work/<slug>`**
(vor dem ersten Veröffentlichen steht dort `yoursite.url/work/<slug>`).
Ein Klick darauf bewirkt sichtbar nichts.

---

## D · Abläufe

| Aktion | Wirkung |
|---|---|
| Klick auf eine Zeile | öffnet den Editor-Dialog (880 breit, rechts) |
| `Expand row` beim Überfahren | derselbe Editor-Dialog |
| `+ New Item` | Editor-Dialog mit leeren Feldern; `Status` steht auf `Live`, `Show on the homepage` auf `Yes` |
| Editor mit Änderungen | Kopfzeile zeigt **`Save`** (Knopf); ohne Änderung **`Saved`** (Text) |
| `Veröffentlichen` | betrifft die **Website**, nicht den Eintrag. Solange ein Eintrag ungespeichert ist, ist er grau. → **`Save` ≠ `Veröffentlichen`** |
| Filter setzen | wirkt sofort, kein Speichern |
| Sortierung setzen | wirkt als **Vorschau**, wird erst mit `Save` dauerhaft; `Discard` verwirft |
| Spalte ausblenden | `Show Columns` oder Spaltenkopf → `Hide` |
| Schalter in der Zelle | schreibt sofort |
| Status-Chip | Klappliste `Draft`/`Live`, schreibt sofort |
| Ein Eintrag ohne Bild schließen | nichts wird angelegt; ein geöffneter leerer Editor erzeugt **keinen** Eintrag beim Schließen (`Work` blieb bei 6) |

---

## E · Gestaltung (gemessene Werte)

### E1 Farben

| Rolle | Wert |
|---|---|
| Seitenhintergrund (`body`) | `rgb(238,238,238)` — `#eeeeee` |
| Flächen, Tabelle, Popover | `#ffffff` |
| Eingabefelder, Sekundärknöpfe, aktiver Reiter | `rgb(243,243,243)` — `#f3f3f3` |
| Primärfarbe | `rgb(0,153,255)` — `#0099ff` |
| Text stark | `#222222` (Reiter aktiv, Eingaben) |
| Text Titelzelle | `rgb(85,85,85)` — `#555555` |
| Text sekundär (Kopfzeile, Zellen, inaktiver Reiter) | `#999999` |
| Symbole in Werkzeugknöpfen | `#888888` |
| Sekundärknopf-Text | `#333333` |
| Live / Erfolg | Text `rgb(0,187,136)`, Fläche `rgba(0,187,136,0.1)` |
| Zelle mit Fokus | `rgb(242,250,255)` |
| Schalter aus | `#eeeeee` |

### E2 Schrift

**Inter**, Grundgröße 12px.
Tabellenkopf 13px/600 · Tabellenzelle 13px/500 · Reiter aktiv 12px/600 ·
Reiter inaktiv 12px/500 · Knöpfe 12px/600 · Eingaben 12px/500.

### E3 Maße je Elementart

| Element | Größe | Hintergrund | Radius | Innenabstand |
|---|---|---|---|---|
| Reiter aktiv (`Collections`) | 88 × 30 | `#f3f3f3` | 8 | 0 10px |
| Reiter inaktiv (`Plugins`) | 65 × 30 | transparent | 8 | 0 10px |
| Werkzeugknopf | 30 × 30 | transparent | 8 | 0 |
| Primärknopf (`Veröffentlichen`) | 110 × 30 | `#0099ff`, Text weiß | 8 | 0 10px |
| Sekundärknopf (`Einladen`) | 73 × 30 | `#f3f3f3`, Text `#333` | 8 | 0 10px |
| Tabellenkopf-Zelle | 94 × 50 | `#ffffff` | 0 | 10 |
| Tabellenzelle | 94 × 51 | `#ffffff` | 0 | 0 |
| Status-Chip | 57 × 20 | `rgba(0,187,136,0.1)` | **9999** | 0 4 0 8 |
| Schalter | 30 × 20, Knauf 16 × 16 rund | an `#0099ff`, aus `#eeeeee` | 10 | 0 |
| Eingabefeld im Popover | 139 × 30 | `#f3f3f3` | 8 | — |
| Textarea (`Beschreibung`) | 139 × 48 | `#f3f3f3` | 8 | — |
| Segment (`Yes`/`No`) | 68 × 28 | transparent; aktiv Text `#0099ff`/600, inaktiv `#999`/500 | 6 | — |
| **Popover (Feldkonfiguration)** | **260 × 318** | `#ffffff` | **18** | Schatten `rgba(0,0,0,0.08) 0 3px 6px` + Ring `rgba(0,0,0,0.05) 0 0 0 1px` |
| Editor-Dialog | 880 × 902 | `#ffffff` | 0 | Labelspalte bei x = 800, Breite 140; Feldspalte 950 – 1635 |

Zeilenhöhen im Editor: Standardfeld **51**, Bildfeld **86**, Textbereich **74** bzw. **135**.

### E4 Bewegung (gemessene `transition`-Werte)

| Element | Übergang |
|---|---|
| Overlay-Hintergrund (`hudBackgroundSurface`) | `opacity 0.15s ease` |
| Schalter-Spur | `background-color 0.2s ease` |
| Schalter-Knauf | `transform 0.2s ease` |
| Werkzeugknopf (30 × 30) | `background-color, color 0.15s ease` |
| Kopfleisten-Knopf | `border-color, background-color 0.15s ease` |
| Reiter / Primärknopf | `background-color, box-shadow, color 0.15s ease` |
| Knopf mit Rahmen | `background-color, color, border-color 0.12s ease` |
| Symbol (SVG) | `color 0.1s ease` |
| Menüeintrag | `color, background-color 0.1s ease` |
| Auswahl-Fix (Safari) | `animation _selected_sibling_safari_fix 0.001s steps(1)` |

**Der Editor-Dialog hat KEINE CSS-Transition** (`transition: all 0s`). Er trägt
keinen Schlagschatten, sondern eine 1-px-Trennlinie links:
`box-shadow: inset 1px 0 0 rgb(238,238,238)`. Sein Ein- und Ausfahren macht Framer
per JavaScript (Motion), nicht per CSS — wer die Bewegung nachbauen will, findet
sie deshalb **nicht** im Stylesheet.

### E5 Der DOM

Der vollständige Elementbaum der CMS-Oberfläche liegt daneben als
**`docs/framer-cms-dom.txt`** (1 213 Zeilen, Klassennamen, ARIA-Rollen, Position
und Größe je Knoten). Drei Dinge, die man dort sieht und sonst nicht:

- Die Oberfläche hängt **nicht** unter `div#root` — dessen Höhe ist 0. Wer
  `#root` als Wurzel nimmt, bekommt zwei Zeilen und schließt fälschlich „da ist
  nichts". Wurzel ist `document.body`, die Oberfläche liegt rund 25 Ebenen tief.
- **244 von 1 213 Knoten sind 0 × 0**: die Canvas-Panels (`Design`, `Pages`,
  `Layers`, `Assets`) bleiben im DOM stehen, während das CMS sichtbar ist.
  Framer blendet die Bereiche nicht aus, es setzt sie auf Größe null.
- Solange der Tab im **Hintergrund** liegt, liefert `getBoundingClientRect()` für
  **alle** Knoten 0 × 0, obwohl `innerWidth/innerHeight` stimmen. Vor jeder
  Vermessung muss der Tab aktiviert werden
  (`curl http://127.0.0.1:9222/json/activate/<zielId>`).

---

## F · Zustände

| Zustand | Aussehen |
|---|---|
| Zeile in Ruhe | Zellen `#ffffff`, Titel `#555`, übrige Werte `#999` |
| Zeile überfahren | Hintergrund **ändert sich nicht**; rechts in der Titelzelle erscheint der `Expand row`-Knopf, links werden Griff und Kästchen sichtbar |
| Zelle ausgewählt (Einfachklick) | `rgb(242,250,255)`, 3 px blauer Rahmen, Text von `#999` auf `#222` |
| Zelle in Bearbeitung (Doppelklick) | echtes `<input>` in der Zelle, Wert markiert, weißer Grund |
| Zeile ausgewählt (Kästchen) | Kästchen blau, Werkzeugleiste wird `N Selected ⌄` |
| Eingabefeld mit Fokus | blauer Rahmen, Inhalt markiert |
| Sortierung aktiv | blauer Punkt am Sorting-Knopf |
| Filter aktiv | Chip `Live ×` in der Werkzeugleiste |
| Leere Suche | mittig `No search results` |
| Leere synchronisierte Collection | Symbol + *„Ihre Sammlung ist leer. Synchronisieren Sie, um loszulegen."* + `Sync` |
| Leeres Feld im Editor | Platzhaltertext grau (`Empty`, `Enter Industry`, `Page or URL…`) |
| Leeres Bildfeld | graue Kachel mit `+` |
| Analytics ohne Veröffentlichung | *„Publish your website to track and view insights."* |

---

## G · Für den Nachbau

**Zwei unabhängige Sichtbarkeitsachsen.** `Status` (Draft/Live) UND
`Show on the homepage` sind getrennte Felder — dasselbe Muster wie unsere
Kanal-Sichtbarkeit (`status='active'` + `listed_on_marketplace`).
„Fertig" und „wo sichtbar" sind zwei Fragen.

**`Save` ≠ `Veröffentlichen`.** Der Eintrag wird gespeichert, die Website getrennt
veröffentlicht. Der Kopf zeigt den Zustand als Wort (`Saved`) bzw. als Knopf (`Save`).

**Alt-Text hängt AM Bildfeld**, nicht als eigenes Feld daneben — sonst zwei
Wahrheiten (Wurzel 2). Ebenso `Auflösung` und `Mittelpunkt`.

**Thumbnail-Titel und voller Titel sind ZWEI Felder**, nicht ein gekürzter.

**Ein Mehrfach-Bildfeld ist ein eigener Typ** (`Gallery` mit `Min`/`Max`),
keine vier Einzelfelder.

**Die Feldkonfiguration gehört ins Produkt**, nicht in eine Migration: Name,
Beschreibung, Pflichtfeld, ein-/mehrzeilig, Platzhalter, Maximallänge, Vorgabewert
und Lokalisierung sind pro Feld einstellbar.

**Sortierbar/filterbar ist mehr als sichtbar.** `Created`/`Edited` stehen in
Sortierung, Filter und Spaltenwahl, sind aber keine Standardspalte. Sortier- und
Filterliste sind **nicht** deckungsgleich (15 vs. 21 Felder) — die Auswahl folgt
dem Feldtyp, nicht der Spaltenliste.

**Sortierung ist ein Entwurf, Filter nicht.** Sortierung hat `Discard`/`Save`,
der Filter greift sofort. Wer beides gleich baut, baut eines davon falsch.

**Textfilter kennen nur `Is Set`/`Isn't Set`.** Für „enthält" gibt es die Suche.

**Synchronisierte Collections sind schreibgeschützt**: kein `+ New Item`,
`View Fields` statt `Edit Fields`, dafür `Resync` und `Manage`.

**Die Zelle ist das Eingabefeld.** Einfachklick wählt, Doppelklick macht die Zelle
zum `<input>`. Der Dialog ist der zweite Weg, nicht der einzige. Wer nur einen
Dialog baut, baut die halbe Tabelle.

**Ein Vorgabewert darf aus einem anderen Feld abgeleitet sein** (`Based on`), und
genau dafür gibt es den `Reset`-Knopf am Feld. Das ist mehr als ein Default: es ist
eine Ableitung, die man überschreiben und wiederherstellen kann.

**Die Titelspalte bleibt beim waagerechten Scrollen stehen.** Bei 24 Feldern
(4 302 px) ist das der Unterschied zwischen benutzbar und unbenutzbar.

**Feldtypen, die wir noch nicht haben** und die der Blog-Baukasten braucht:
`Formatted Text` (Rich Text), `Date`, `Color`, `Number`, `Option`, `File`,
`Reference`/`Multi-Reference`, `Divider`.

---

## H · Nicht geprüft

- **`Veröffentlichen`** (Kopfleiste) — bewusst nicht geklickt: würde die Website
  veröffentlichen.
- **`▷ Preview`** — nicht geklickt; öffnet eine Vorschau der Website, nicht des CMS.
- **`Draft Item`, `Delete`, `Remove`, `Duplicate`, `Create`, `Sync`, `Log In`** —
  alle verändernden Einträge wurden bewusst ausgelassen.
- **`Open in Canvas`** (More-Menü) und **`Open`** (Zeilen-Kontextmenü) — je dreimal
  geklickt, **ohne sichtbare Wirkung**; die Ansicht blieb im CMS. Nachtrag: der
  Canvas dieser Vorlage existiert (Seiten `Home`, `/about`, `/work`, `/contact`,
  `/404`, Canvas-Rahmen `Thumbnail`) und war zwischenzeitlich einmal offen — der
  Zusammenhang zum Menüeintrag ließ sich aber nicht reproduzieren. *Nicht belegt.*
- **`Copy Link` / `Copy as Markdown`** — angeklickt, aber der Inhalt der
  Zwischenablage ließ sich aus der Seite nicht zurücklesen
  (`navigator.clipboard.readText()` lieferte 0 Zeichen). Das **Format** ist unbekannt.
- **`Open in Localization`** — im Menü grau, nicht anklickbar.
- **`Edit ›`, `Plugins ›` und `Help ›`** im App-Menü — je dreimal per Überfahren
  geöffnet, das Untermenü erschien nicht. Grund: an demselben Chrome arbeitete
  parallel eine zweite Sitzung, die Menüs schlossen sofort wieder.
  `File ›`, `View ›` und `Preferences ›` sind vollständig erfasst (siehe B1).
- **`Import Collection`** und **`Upload File`** (CSV Import), **`Choose Images…`** —
  nicht geklickt: sie öffnen den System-Dateidialog, der die Sitzung blockiert.
- **Plugin-Liste am Bildfeld** — nur die ersten neun Einträge gelesen
  (`3D Shapes`, `AI Logo Generator`, `Alt Text Generator`, `Alt Text Generator AI`,
  `Alt Text Go`, `AltTextify – Alt Text Generator`, `AltWise`, `Angled Screen`,
  `ASCII`), nicht bis zum Ende gescrollt.
- **Framer-Marketplace** (`Browse Plugins` / `Browse All`) — öffnet einen neuen Tab
  auf `framer.com/marketplace/plugins/`; der Inhalt wurde nicht erfasst.
- **Ziehen** — Zeile umsortieren (`⠿`), Feld umsortieren und Spaltenbreite ziehen
  (12 × 50-Griffe zwischen den Spaltenköpfen): die Griffe sind gefunden und
  vermessen, das Ziehen wurde **nicht ausgeführt**, weil es Reihenfolge bzw.
  Ansicht dauerhaft verändert.
- **Pflichtfeld-Status** von `Gallery Side Right`, `Final Section Body` und
  `Carousel Img 2–4` — deren Popover wurden nicht einzeln geöffnet; die
  gleichartigen Nachbarfelder stehen alle auf `Erforderlich = No`.
- **Die rechte Sidebar des Canvas** ist getrennt ausgelesen: `docs/FRAMER-STYLE-PANEL-ANALYSE.md`.
- **Agent-Spalte rechts** (`New Chat`, `Ask Framer…`, Modellwahl `Opus 4.8` bzw.
  `GPT 5.6 Terra`, Knöpfe `Select`/`Add`/`Send`) — gehört zu Framers KI-Assistent,
  nicht zum CMS; nur die Bedienelemente sind im DOM-Auszug enthalten, die Funktion
  wurde nicht ausprobiert.
