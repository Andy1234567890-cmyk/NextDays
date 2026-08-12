# Plan — Website-Baukasten (`/website`) auf Hostaway-/Lodgify-Niveau

> Auftrag (11.08.2026): „Der Builder soll wie bei Hostaway funktionieren, eine
> Mischung aus Framer und Lodgify."
>
> Dieses Dokument plant die **Website-Ebene** — den Rahmen um den Editor.
> Die Editor-Innereien (Canvas, Layer, Inspektor, Snapping, Breakpoints) sind
> in `docs/FRAMER-FEATURES.md` mit Status je Funktion erfasst; hier wird nicht
> wiederholt, was dort steht.
>
> Noch NICHTS davon ist gebaut. Reihenfolge und Umfang stehen zur Entscheidung.

---

## 1. Ausgangslage — belegt, nicht geschätzt

**Was da ist (Code gelesen, 11.08.2026):**

| Stück | Stand |
| --- | --- |
| `components/website/editor/` | 42 Dateien, ~3.500 Zeilen, Craft.js: Canvas, Layer-Tree, Properties-Inspektor, Insert-Panel, Palette, Font-Picker, Code-Editor, Selection-Overlay, Kamera (Zoom/Pan) |
| Blocktypen (Backend) | 11: `hero`, `rich_text`, `image`, `gallery`, `button`, `spacer`, `contact`, `search`, `properties_grid`, `featured_properties`, `reviews` |
| Editor-Container | Frame, Stack, Grid, Masonry — einfügbar (Kürzel F/S/⇧G) |
| `site_pages` | slug, title, seo_title, seo_description, og_image_url, is_home, is_published, nav_order |
| `site_blocks` | page_id, type, position, content jsonb, settings jsonb |
| `lib/site-config.ts` | Branding (site_name, tagline, logo, hero_image, primary_color, secondary_color, font_family, about/contact-Texte, social_links) + Custom-Domains inkl. Cloudflare-for-SaaS-Anbindung |
| `lib/site-pages.ts` | listPages, createPage, updatePage, setHomePage, **publishPage** |

**Was `/website` heute zeigt:** drei Vorlagenkacheln (Klassik, Vermittler,
Minimal) und ein Feld „Neue Seite". Nicht mehr — der Editor liegt hinter
`/website/<pageId>` und ist ohne angelegte Seite unerreichbar. Der Eindruck
„da ist nichts" täuscht also; es fehlt die Ebene DAVOR.

**Der offene Bruch (schon in `FRAMER-FEATURES.md` als „nicht persistiert"
vermerkt, hier mit der Codestelle):** `serialize.ts → craftJsonToBlocks()`
läuft nur über `root.nodes` — die erste Ebene — und verwirft alles, dessen
Typ nicht in den 11 `BlockType`s steht:

```ts
if (!type || !(type in NODE_BY_TYPE)) continue;
```

Ein Stack, ein Grid oder ein Frame ist damit beim Speichern **still weg**,
samt allem, was darin liegt. Der Editor bietet sie mit Tastenkürzel an. Das
ist kein Schönheitsfehler, sondern Datenverlust ohne Meldung (Wurzel 4/5) —
und die erste Entscheidung, die dieser Plan braucht.

---

## 2. Die Referenzen — was die beiden wirklich tun

### Lodgify (live abgelesen, `app.lodgify.com/website-builder/514319`)

Theme-basiert und geführt. Kopf-Tabs: **Stile · Seiten · Einstellungen ·
Unterkünfte · Externe Widgets**, rechts „Website anzeigen ⌄" und
**Webseite veröffentlichen**.

* **Stile:** vier Themes als Vorschaukacheln (Livingstone, Tideway, Capucine,
  Brooklyn). Farbpalette plus **Farbrollen**: Firmenname, Header-Hintergrund,
  Header-Links, Buttons und Elemente, Links, Footer-Hintergrund. Schriftarten
  getrennt für Überschrift/Text.
* **Seiten:** drei Gruppen — **Header-Navigation**, **Footer-Navigation**,
  **Nicht verlinkt** (jede mit Erklärtext und „+"). Je Zeile ein „…"-Menü:
  Bearbeiten · Seiteneinstellungen · Seite duplizieren · Löschen.
* **Editor:** eine Seite ist eine **Abschnittsliste** mit „+ Hinzufügen".
  Katalog (13 Abschnitte, vier Gruppen):
  * *Grundeinstellungen*: Titel · Inhalt · Inhalt und Inhalt · Ausgewählte Unterkünfte
  * *Medien*: Bild · Bild und Inhalt · Video · Video und Inhalt · Slideshow
  * *Buchungsablauf*: Buchungsanfrage · Kontakt · Aktionsangebot · Suchen
  * *Andere*: Benutzerdefiniertes HTML · Admin-Anmeldung
* **Bearbeiten:** Klick auf einen Abschnitt markiert ihn im Canvas und öffnet
  eine **schwebende Rich-Text-Leiste** direkt darüber (Undo/Redo, Absatzformat,
  B/I/U/S, Link, Ausrichtung, Listen, Einzug, Code, Bild, Trennlinie). Kein
  separates Formular — Text wird an der Stelle geschrieben, an der er steht.
* **Canvas:** Desktop-/Mobil-Umschalter, Sprachwahl (die Website ist mehr-
  sprachig), Status „Gespeichert", Panel einklappbar.

### Hostaway („Booking Website Pro", Doku-Struktur)

Widget-basiert, sichtbar von einem Website-Baukasten-Anbieter zugekauft
(Vokabular: Widgets, Pop-ups, Image Editor, Site Settings & Performance).
Abschnitte der Doku: Getting Started · **Editor** · **Content** ·
**Pages and Pop-ups** · **Widgets** · **Site Settings and Performance** ·
**AI Tools**.

Belegte Widgets: HTML, Facebook-Feed, Multi-Location, Datei, Copyright,
Tabs/Text/Bild, **Bild-Editor**. Dazu **URL-Redirects**, Google
Tools/Analytics, „Make Your Site Live" und eine **Launch-Checkliste**.

### Framer

Liefert die **Bedienung**, nicht das Datenmodell: Direktmanipulation auf dem
Canvas, Inspektor rechts, Layer links, Snapping, Breakpoints. Status je
Funktion in `docs/FRAMER-FEATURES.md`.

---

## 3. Die Entscheidung, die alles andere bestimmt

**Flache Abschnittsliste oder verschachtelter Baum?**

| | Flach (Lodgify/Hostaway) | Baum (Framer) |
| --- | --- | --- |
| Datenmodell | `site_blocks` bleibt wie es ist | `parent_id` + Reihenfolge je Ebene, rekursives Laden/Speichern |
| Bedienung | Abschnitt wählen, Inhalt füllen | frei platzieren, verschachteln, Auto-Layout |
| Wer kommt damit klar | jeder Betrieb | wer Design-Werkzeuge kennt |
| Aufwand | klein (Modell steht) | groß (Serialisierung, Undo, Constraints, Breakpoint-Kaskade) |
| Ergebnisqualität | verlässlich ordentlich | beliebig gut **und** beliebig kaputt |

**Empfehlung: flach bleiben.** Der Auftrag heißt „wie Hostaway funktionieren" —
und beide Vorbilder sind flach. Ein Vermieter soll eine verkaufende Seite
bekommen, nicht ein Layout-Werkzeug. Die Framer-Anleihe ist die BEDIENUNG
(Canvas statt Formular, Inline-Text, Inspektor), nicht die Verschachtelung.

**Folge für den Bruch aus §1:** Frame/Stack/Grid/Masonry werden aus dem
Insert-Panel **entfernt**, statt sie halb zu persistieren. Ein Werkzeug, das
anbietet, was es nicht speichern kann, ist schlimmer als eines, das es nicht
anbietet. Was von den Containern gebraucht wird — zwei Spalten, Abstände,
Hintergrund — liefern die Abschnittstypen selbst („Inhalt und Inhalt",
„Bild und Inhalt") plus die `settings` je Abschnitt.

Wer den Baum später doch will, hat mit `parent_id` einen additiven Weg — aber
nicht als Nebenprodukt dieses Umbaus.

---

## 4. Zielbild `/website`

```
┌────────────────────────────────────────────────────────────────────┐
│ Stile │ Seiten │ Einstellungen │ Objekte │ Widgets   [Ansehen ⌄] [Veröffentlichen] │
├───────────────────┬────────────────────────────────────────────────┤
│ (Tab-Inhalt)      │  ⌐ Desktop │ Mobil ⌐    Sprache ⌐   Gespeichert │
│                   │                                                │
│ Seiten:           │  ┌──────────────────────────────────────────┐  │
│  Header-Nav       │  │  Live-Vorschau der Seite                 │  │
│   • Start         │  │  Klick auf Abschnitt → Auswahl +         │  │
│   • Objekte       │  │  schwebende Text-Leiste                  │  │
│   • Über uns      │  │                                          │  │
│  Footer-Nav       │  └──────────────────────────────────────────┘  │
│  Nicht verlinkt   │                                                │
│                   │                                                │
│ Abschnitte:       │                                                │
│  + Hinzufügen     │                                                │
│  ⣿ Titel      …   │                                                │
│  ⣿ Inhalt     …   │                                                │
└───────────────────┴────────────────────────────────────────────────┘
```

---

## 5. Datenmodell — was fehlt

### 5.1 Navigation in Gruppen

`site_pages.nav_order` allein kann die drei Gruppen nicht ausdrücken. Neu:

```sql
alter table public.site_pages
    add column if not exists nav_gruppe text not null default 'header'
        check (nav_gruppe in ('header', 'footer', 'unlinked'));
```

`nav_order` bleibt die Reihenfolge INNERHALB der Gruppe. Kein Flag
`is_in_nav` — drei Zustände in einer Spalte, nicht zwei Spalten, die sich
widersprechen können.

### 5.2 Farbrollen statt zweier Farben

Branding hat heute `primary_color`/`secondary_color`. Lodgify vergibt sechs
Rollen. Vorschlag: **eine** JSONB-Spalte `farbrollen` mit festen Schlüsseln
(`firmenname`, `header_hintergrund`, `header_links`, `buttons`, `links`,
`footer_hintergrund`) statt sechs Spalten — die Rollen wachsen mit dem Theme,
Spalten nicht. `primary_color`/`secondary_color` bleiben als Rückfall für
bestehende Seiten; fehlt eine Rolle, greift die Theme-Vorgabe (kein erfundenes
Blau, Wurzel 4).

### 5.3 Theme

```sql
alter table public.site_pages … -- nein: gehört an die SITE, nicht an die Seite
```

Das Theme gilt für die ganze Website → an `tenant_site_config` (dort, wo
Branding schon liegt): `theme text not null default 'klassik'`. Die vorhandenen
drei Vorlagen (Klassik/Vermittler/Minimal) sind heute **Startinhalte**, kein
Theme — der Unterschied gehört benannt, sonst heißt später zweierlei gleich.

### 5.4 Mehrsprachigkeit der Website

Lodgify hat einen Sprachumschalter im Canvas. Unsere `site_blocks.content` ist
JSONB — mehrsprachig ginge als `{"de": …, "da": …}`. **Offen und bewusst nicht
entschieden:** ob eine Seite pro Sprache existiert (SEO-freundlich, mehr
Pflege) oder ein Inhalt mit Sprachschlüsseln. Das ist eine eigene Entscheidung
mit Folgen für Slugs, Sitemap und `hreflang` — sie hängt nicht am Editor und
sollte den Umbau nicht aufhalten.

---

## 6. Abschnittskatalog — Abgleich

| Lodgify | Wir heute | zu tun |
| --- | --- | --- |
| Titel | — | neu (schlanker Kopf, nicht `hero`) |
| Inhalt | `rich_text` | ✅ |
| Inhalt und Inhalt | — | neu (zwei Spalten) |
| Ausgewählte Unterkünfte | `featured_properties` | ✅ |
| Bild | `image` | ✅ |
| Bild und Inhalt | — | neu |
| Video / Video und Inhalt | — | neu |
| Slideshow | `gallery` | ✅ (Darstellung prüfen) |
| Buchungsanfrage | — | neu (Formular → `inquiries`) |
| Kontakt | `contact` | ✅ |
| Aktionsangebot | — | neu (an `property_discounts` anbinden, nicht frei tippen) |
| Suchen | `search` | ✅ |
| Benutzerdefiniertes HTML | — | neu — **nur** mit Allowlist-Sanitizer beim Speichern (`nh3`), Schema-Whitelist für `href`/`src`, kein Script (Wurzel 8) |
| Admin-Anmeldung | — | neu (Link, kein Formular) |
| — | `hero` | bleibt (größer als „Titel") |
| — | `button`, `spacer`, `reviews`, `properties_grid` | bleiben |

Sieben neue Typen, davon einer (HTML) sicherheitsrelevant.

---

## 7. Stufen

Jede Stufe ist für sich benutzbar und einzeln abnehmbar.

**Stufe 0 — den Bruch schließen** *(klein, sollte zuerst)*
Frame/Stack/Grid/Masonry aus dem Insert-Panel entfernen; `craftJsonToBlocks`
meldet unbekannte Knoten statt sie zu verschlucken. `FRAMER-FEATURES.md`
nachziehen.

**Stufe 1 — Rahmen**
Kopf-Tabs, „Veröffentlichen" mit Entwurf/Live-Unterscheidung, Desktop-/
Mobil-Umschalter, Sprachumschalter (Anzeige), Status „Gespeichert".
Der Veröffentlichen-Weg existiert serverseitig (`publishPage`) — er ist
bislang nur nicht bedienbar.

**Stufe 2 — Stile**
Theme-Kacheln, Farbrollen, Schriften für Überschrift und Text. Setzt auf
Branding auf; braucht 5.2 + 5.3.

**Stufe 3 — Seiten & Navigation**
Drei Gruppen mit Drag zwischen ihnen, Seiten-Menü (Bearbeiten,
Seiteneinstellungen mit Slug/SEO, Duplizieren, Löschen). Braucht 5.1.

**Stufe 4 — Inline-Text**
Schwebende Rich-Text-Leiste am gewählten Abschnitt. Das ist der Teil, der
sich wie Lodgify/Framer anfühlt. `inline-text.tsx` existiert als Ansatz.

**Stufe 5 — die sieben neuen Abschnitte** (§6), HTML zuletzt und mit Sanitizer.

**Stufe 6 — Hostaway-Extras**
Pop-ups, Widget-Begriff, URL-Redirects, Launch-Checkliste, Google-Analytics-
Anbindung.

---

## 8. Bewusst NICHT in diesem Umbau

* **Verschachtelte Layouts / Auto-Layout** — siehe §3.
* **Komponenten mit Varianten** (Framer-Master/Instance) — eine eigene Welt.
* **KI-Texte** („AI Tools" bei Hostaway) — erst wenn die Seite steht.
* **Zweiter Builder.** `builder/` ist die White-Label-Anwendung für den
  Marktplatz-Gastgeber, `/website` der Baukasten des Betriebs. Beide teilen
  dieselben `site_blocks` — es darf keine zweite Block-Definition entstehen.

---

## 9. Was zu klären ist, bevor Stufe 2 beginnt

1. **Themes: eigene bauen oder die drei Vorlagen zu Themes machen?** Vier
   Lodgify-Themes sind vier Gestaltungen, keine Farbschemata — das ist
   Design-Arbeit, nicht Programmierarbeit.
2. **Mehrsprachigkeit** (§5.4) — Seite je Sprache oder Inhalt je Sprache.
3. **Wer darf veröffentlichen?** `access_homepage_builder` gibt es bereits als
   Berechtigung; Lodgify trennt Bauen und Veröffentlichen nicht. Wir könnten.
