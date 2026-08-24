# Website-Baukasten: Vollständiger Abgleich mit Hostaway „Booking Website Pro"

**Stand 24.08.2026.** Grundlage: alle **71 Artikel** der Hostaway-Support-Sektion
„Booking Website Pro" (über die Zendesk-API im Volltext geholt, nicht überflogen)
plus **99 Produkt-Screenshots** aus diesen Artikeln, die das echte Editor-UI
zeigen. Die interaktive Produkt-Tour im Artikel „Editorübersicht" wurde
durchgeklickt; der Editor selbst liegt hinter dem Pro-Abo und war nicht
zugänglich.

Wichtig für die Einordnung: **Hostaways Baukasten ist ein White-Label von Duda**
(die Screenshots kommen von `multiscreensite.com`, Dudas CDN). Wir vergleichen
uns hier also nicht mit einem Feriendomizil-Spezialisten, sondern mit einem
ausgereiften, generischen Website-Baukasten, den Hostaway zugekauft und um
Buchungs-Widgets ergänzt hat. Das erklärt beides: den enormen Funktionsumfang
(30 Theme-Farben, Bildeditor, Shutterstock-Anbindung) **und** die Bruchstellen
(zwei Domains, zwei Design-Bereiche, „das Property-Design stellst du woanders
ein").

---

## 1. Das Editor-UI, wie es wirklich aussieht

Aus `create-about-us-and-contact-us-pages-8.png` und `editor-overview-1.png`
abgelesen:

**Kopfzeile (links → rechts):** ☰ Hamburger · Hostaway-Logo · Trennstrich ·
**Seiten-Wähler** („About us ⌄") · **Sprach-Wähler** (Landesflagge ⌄) ·
*(Mitte)* **drei Geräte-Symbole** (Desktop/Tablet/Mobil, aktives teal
hinterlegt) · *(rechts)* ↶ ↷ · **✓ Speicher-Anzeige** · ⤴ Share ·
`Preview` · **`Republish`** (teal, gefüllt) · ⌂ Home.

**Linke Leiste** — schmal, Symbol über Beschriftung, mit Trennlinien gruppiert:

| Gruppe | Punkte |
|---|---|
| Bauen | **Add** · **Pages** · **Layers** · **Theme** |
| Inhalt | **Content** (CMS) |
| Auffindbarkeit | **SEO/AEO** |
| Rest | **More** (…) |

**Panels** klappen als Überlagerung neben der Leiste auf (überdecken den Canvas
links), mit eigener Kopfzeile aus Titel + `?` + `✕`.

**Pages-Panel:** zwei Reiter **„Pages | Popups"** · Knopf **`+ Add Page ⌄`** ·
darunter **„✨ Page Recommendations"** · dann die Seitenliste: je Zeile ein
Drag-Griff (⋮), Haus-Symbol bei der Startseite, **„…"-Menü** rechts.

**`+ Add Page`-Dropdown** — fünf Einträge, jeder mit Symbol, Titel und
Erklärungssatz:

| Eintrag | Erklärung |
|---|---|
| Page Builder | „Plan the page layout before finalizing its design" |
| Blank Page | „Start with a clean canvas" |
| Designed Page | „Get a head start with a page template" |
| Navigation Folder | „Group sub-navigation items like anchors and pages" |
| Page URL | „Add an external page by entering a link" |

**Was davon für uns zählt** (und was nicht):

* **Übernehmen:** die Erklärungszeile unter jedem Eintrag einer Auswahl. Sie
  kostet nichts und beantwortet die Frage, die sonst zum Support führt.
* **Übernehmen:** SEO als eigenständiger Bereich, nicht als Unterpunkt der
  Einstellungen. Genau so ist `/website/seo` gebaut (0430) — das war die
  richtige Entscheidung, hier bestätigt.
* **Übernehmen:** das „…"-Menü je Seitenzeile statt eines Zahnrads. Es ist die
  Konvention, die auch unser Dashboard sonst verwendet.
* **NICHT übernehmen:** die vertikale Symbol-Leiste. Unser Baukasten liegt
  *innerhalb* des PMS-Dashboards, das links schon eine Navigation hat. Eine
  zweite vertikale Leiste daneben wäre die dritte Ebene senkrechter Reiter —
  unsere horizontale Reiterleiste bleibt.
* **NICHT übernehmen:** Undo/Redo in der Kopfzeile. Sie setzen einen
  Bearbeitungs-Stack voraus, den unser Autospeichern nicht hat. Ein Undo-Knopf,
  der nur den letzten Feldwert zurücknimmt, ist schlimmer als keiner.

---

## 2. Vollständige Gegenüberstellung

### 2.1 Seiten und Navigation

| Hostaway | Wir | Bewertung |
|---|---|---|
| Seiten anlegen: 5 Typen mit Erklärung | ein Typ (Titel + Slug) | **Lücke** — „Designed Page" (Vorlage) und „Page URL" (externer Link) fehlen |
| Page Builder: Layout aus bis zu 50 Abschnitten vorplanen, „Save for later" | direkt im Editor | **bewusst anders** — unser Abschnitts-Stapel *ist* der Page Builder |
| Navigations-Ordner (Untermenüs, bis 3 Ebenen) | flache Liste, `nav_area` | **Lücke** |
| Bis 1000 Seiten, 1500 Blog-Seiten | unbegrenzt (kein Deckel!) | **Mangel bei uns** — Wurzel 8 |
| Einzelseite veröffentlichen (ohne die ganze Site) | nur ganze Seite | **Lücke** |
| Seite als Entwurf setzen | `is_published` | ✅ da |
| Startseite wechseln (alte behält Slug) | `set_home_page` | ✅ da |
| Passwortschutz je Seite / „Members only" | — | **Lücke** |
| In dynamische Seite umwandeln | — | siehe 2.2 |
| Duplizieren, umbenennen, in Navigation verbergen | Duplizieren fehlt | **kleine Lücke** |
| 404-Seite anpassbar | — | **Lücke** |
| Pop-ups (eigener Reiter, per Link oder Regel ausgelöst) | — | **Lücke** |

### 2.2 Dynamische Objektseiten

Hostaway hat das erst am **23.07.2026** ausgeliefert, und die Doku gibt zu, dass
Bestandskunden weiter mit dem **Zwei-Domain-Behelf** leben: Startseite auf
`domain.com`, Objektseiten auf `book.domain.com` — oder ohne eigene Domain
sogar auf zwei fremden Domains (`thebookingportal.com` + `holidayfuture.com`).

| Hostaway | Wir |
|---|---|
| Eine Vorlage, automatisch je Listing gefüllt | `/inserat/[id]` — ein Renderer für alle |
| Objekt hinzufügen → Seite + SEO-URL entsteht automatisch | ✅ dasselbe |
| Objekt deaktivieren → Seite verschwindet | ✅ über `listed_on_website` |
| Design nur über die Vorlage, nicht je Objekt | ✅ dasselbe |
| Text/Ausstattung nur im PMS änderbar, nicht im Editor | ✅ dasselbe |
| „Visibility rules" je Objekt-Attribut | — |
| **Zwei Domains / zwei Design-Bereiche** | **wir haben EINE Domain und EIN Design** |

**Das ist unser strukturell größter Vorsprung**, und er ist keine Funktion,
sondern das Fehlen eines Bruchs. In der Launch-Checkliste steht bei Hostaway
wörtlich, man müsse Logo, Favicon und Google-Analytics-ID **zweimal** eintragen
(Dashboard *und* Editor) und die Farben an zwei Stellen pflegen, „damit die
Erfahrung konsistenter wird". Bei uns gibt es diesen Satz nicht.

### 2.3 Abschnitte / Widgets

Hostaways Katalog, nach seinen sechs Bibliotheks-Gruppen:

**Basic (10):** Text · H1 · H3 · Button · Spacer · File · List · Countdown ·
Table (bis 150×30, CSV-Import) · Breadcrumbs · Accordion · Copyright · Tabs ·
Text&Image
**Visual/Audio (6):** Media Slider (bis 25 Slides) · Image · Photo Gallery
(Instagram-Feed, Lightbox) · Video (Upload/YouTube/Vimeo/Dailymotion +
Video-Schema) · Shape · Before&After · Audio (SoundCloud/Mixcloud)
**Business (7):** Click-to-Call · Map (HERE-Datenbank) · Click-to-Email ·
Contact Form · Business Hours (Feiertage, 24-h-Format) · Multi-Location ·
Google Calendar
**Social (6):** Share · X-Feed · Social Icons (eigene SVGs) · RSS · Facebook
Feed · WhatsApp
**Blog (2):** All/Recent Posts · Search Posts
**Advanced (4):** Advanced Forms (mehrstufig!) · Advanced Tabs · Advanced
Accordion · HTML
**Dazu:** KI-generierte eigene Widgets („Remix"), Designed Sections
(Vorlagen-Abschnitte nach Kategorie: Intro, Features, About, Team,
Testimonials).

Unsere 12: hero · rich_text · image · gallery · button · spacer · contact ·
search · properties_grid · featured_properties · reviews · **faq** (0431).

**Ehrlich:** wir haben 12 von ~40. Aber die Zahl ist die falsche Kennzahl. Von
Hostaways 40 sind für einen Ferienwohnungs- oder Hotelbetrieb **fünf** wirklich
wichtig, und die haben wir teils. Was zählt, steht in Etappe A unten.

### 2.4 Design / Theme

| Hostaway | Wir |
|---|---|
| Theme-Text je Ebene DFLT/PAR/H1–H6: Schrift, Größe (Desktop+Mobil getrennt), Farbe, Gewicht, Zeilenhöhe, Laufweite, Kapitälchen, Schatten, „Scale text" | drei Schrift-Achsen, keine Größen/Gewichte je Ebene |
| **Bis 30 Theme-Farben**, benennbar, an Widgets *gebunden* (Änderung wirkt überall) | 6 feste Farbrollen (0426) |
| Farben **aus dem Logo generieren** · Auto-Erkennung der häufigsten Farben der Seite | — |
| **Kontrast-Prüfer AA/AAA im Farbwähler** | — (aber `paletten`/`kontrast` existiert im Dashboard!) |
| Gradienten, Pipette, 48 gespeicherte Farben, „letzte Farben" | einfacher Hex-Wähler |
| Buttons: primär/sekundär, Layouts, Hover, Ecken, Schatten, „auf Theme zurücksetzen" | Stil (solid/outline) + Eckenform + Schrift |
| Seitenbreite 1200/1440/frei (960–1920 px) · Abstände je Abschnitt/Spalte | — |
| Hintergrund site-weit **und je Seite** · Bild-Slider als Hintergrund · Video-Hintergrund | Hintergrundfarbe je Abschnitt |
| **Sidebar-Layout** als Site-Layout | 4 Themes (klar/mitte/karte/seitlich) — „seitlich" ist genau das ✅ |
| Sticky Header · Shrinking Header · Header über dem Hero (Overlap) · Expandable Menu | Header aus dem Theme, nicht konfigurierbar |
| Bildeditor: Zuschneiden, Rahmen, Helligkeit/Sättigung/Kontrast, Filter, Effekte, Blur | — |
| Medienverwaltung: Ordner, 15 000 Dateien, Import aus Dropbox/Drive/Facebook/Instagram, Pexels gratis, Shutterstock 3 $ | `site_media`, Upload |
| **Alt-Text per KI**, „All Alt Text"-Übersicht | Alt-Text-Feld je Bild |

### 2.5 SEO/AEO — der Bereich, den wir gerade gebaut haben

| Hostaway | Wir (0430) |
|---|---|
| Site-weit: noindex, Meta-Titel, -Beschreibung, Keywords | ✅ identisch |
| Je Seite: Titel, Beschreibung, Keywords, noindex, Kopf-HTML | ✅ identisch |
| Hierarchie „Seite schlägt Site" | ✅ `_seo_meta`, an EINER Stelle |
| Lazy-Loading + System-Schriften-Schalter | ✅ **mit Wirkung** — erstes Bild lädt bewusst sofort (LCP), den Fall nennt Hostaway nicht |
| Google-Tag (G-/UA-/AW-/DC-) | ✅ + **Consent Mode v2** |
| Schema-Markup | ⚠️ **anders**: Hostaway verweist auf drei FREMDE Generatoren (Merkle, Rank Ranger) und lässt den Kunden JSON-LD per Hand ins Kopf-HTML kleben. Nur Local-Business und FAQ (Accordion-Widget) und Video (Video-Widget) generiert es selbst. Wir generieren Organization/LodgingBusiness/WebSite/Breadcrumb/FAQ automatisch aus Firmenprofil und Objektdaten. |
| URL-Weiterleitungen 301/302, CSV bis 200, **Wildcards `*`/`**` und Variablen `{name}`** | ✅ ohne Muster-Matching |
| Core Web Vitals: reine Erklärseite | ✅ dieselben Schalter |
| **„SEO-Zusammenfassung mit Befunden + `Fix it`-Knopf"** | ❌ **fehlt** |
| **„Generate Meta Tags" (KI, alle Seiten auf einen Klick, „nur fehlende" / „alle" / „importieren")** | ❌ bewusst nicht |
| **KI-Business-Profil** als Grundlage aller KI-Texte | ❌ |
| `llms.txt` (AEO) | ✅ **nur wir** |
| Bilder-/Link-SEO im SEO-Bereich („pages, images, internal and external links") | ❌ |

### 2.6 Was Hostaway hat und wir gar nicht

* **Blog** — vollständiges Modul: bis 12 Post-Layouts, Layout- und Post-Modus,
  verbundene Felder (Titel/Autor/Bild), Tags, geplantes Veröffentlichen,
  RSS-Import (bis 300 Posts), RSS-Ausgabe, Schema automatisch je Post,
  Post-SEO, „Draft with AI", Statistik.
* **CMS / Collections** — eigene Datensammlungen (intern, extern, Google Sheets,
  Airtable) als Quelle für dynamische Seiten und Tabellen.
* **Personalisierungsregeln** — Auslöser (Gerät, Ort, Zeit, Besuchszahl,
  Kampagnen-Parameter) → Aktion (Hinweisleiste, Pop-up, JavaScript, Effekte),
  30-Minuten-Fenster je Besucher, Prioritäten.
* **Formulare** — Contact Form mit 13 Feldtypen, reCAPTCHA (nicht abschaltbar),
  Auto-Antwort, Google-Sheets- und Webhook-Anbindung, Antworten-Verwaltung mit
  CSV-Export; Advanced Forms zusätzlich mehrstufig.
* **Backups** — 50 automatische + 50 manuelle, Wiederherstellung, gelöschte
  Site 30 Tage rettbar.
* **Layers-Panel** — Baumansicht aller Elemente, „pro Gerät verbergen".
* **Dev-Mode** — site.css, page.css, eigenes HTML/CSS je Seite.
* **Site-Kommentare** — Kommentar-Fäden im Editor für die Abstimmung.
* **Mehrsprachigkeit** — mit Google-Translate-Automatik, aber: Seiten-SEO wird
  *nicht* übersetzt, Personalisierung und Blog gehen dann gar nicht, ~200 Seiten
  Obergrenze. **Unsere 24-Sprachen-Lösung ist hier klar besser.**

---

## 3. Der Plan

Reihenfolge nach **Wirkung für einen Betrieb**, nicht nach Hostaways
Reihenfolge. Jede Etappe ist für sich abgeschlossen und einzeln deploybar.

### Etappe A — die drei fehlenden Abschnitte, die wirklich fehlen

*Warum diese drei: sie stehen auf jeder Ferienobjekt-Website, und ohne sie muss
der Kunde Rich-Text missbrauchen.*

1. **Karte** (`map`) — Ort des Betriebs oder eines Objekts. Wir haben Google
   Maps schon im Dashboard (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`), die CSP im
   geteilten Paket kennt `googleMaps` bereits.
2. **Bewertungs-Slider / Testimonials** (`testimonials`) — der
   `reviews`-Abschnitt zeigt echte Bewertungen; hier geht es um frei
   eingetippte Zitate (Gästestimmen aus Gästebuch, Presse).
3. **Aufzählung mit Symbolen** (`features`) — „Was wir bieten": Symbol +
   Überschrift + Text, 2–4 Spalten. Ersetzt heute drei Rich-Text-Blöcke.

Dazu **je Abschnitt eine Bild-Hintergrund-Option** in `BlockSettings` (heute nur
Hintergrundfarbe).

Aufwand: eine Migration (CHECK erweitern), drei content-Schemas, drei
Renderer-Komponenten, drei Katalog-Einträge, ~14 i18n-Schlüssel × 24.

### Etappe B — SEO-Zusammenfassung mit Befunden

Das eine SEO-Muster von Hostaway, das wir nicht haben und das wirklich hilft:
eine Liste dessen, was fehlt, mit Sprung zur Behebung. Bei uns ohne KI-Knopf,
aber mit mehr Prüfungen, weil wir die Daten haben:

* Seiten ohne Meta-Titel / -Beschreibung (haben wir schon als Zahl — hier je
  Seite mit Direktlink)
* Doppelte Meta-Titel über mehrere Seiten (Hostaway prüft das nicht)
* Kein Firmenprofil → kein Organization-Schema
* Objekte ohne Beschreibung → dünne Objektseiten
* Keine Custom-Domain → Sitemap/robots/llms existieren nicht
* Website auf `noindex`, obwohl veröffentlicht
* Kein Google-Tag hinterlegt

Als eigene Ansicht auf `/website/seo` **über** den Feldern, mit Ampel und
„Beheben"-Link je Zeile.

### Etappe C — Seiten-Verwaltung nachziehen

1. **Seiten-Deckel** (200 Seiten) — heute unbegrenzt, das ist ein Wurzel-8-Loch.
2. **Seite duplizieren** — mit allen Blöcken.
3. **Externer Menüpunkt** („Page URL") — ein Navigationseintrag, der auf eine
   fremde Adresse zeigt. Nötig für „Bewertungen bei Google", „Anfahrt".
4. **Navigations-Ordner** — Untermenüs, zwei Ebenen (nicht drei: bei drei
   verliert der Gast die Orientierung, und `nav_area` reicht dann nicht mehr).
5. **404-Seite** aus Blöcken komponierbar.
6. **Einzelseite veröffentlichen** — nur wenn `publish_page` das schon leistet;
   sonst zurückstellen.

### Etappe D — Vorlagen für Seiten („Designed Page")

Wir haben Site-Vorlagen (`templates.py`: bergchalet, kueste, stadt) — aber keine
**Seiten**-Vorlagen. Hostaways Weg für „Über uns"/„Kontakt" ist genau das: ein
fertiger Abschnitts-Satz, den man in eine leere Seite legt.

Für uns: 6 Seiten-Vorlagen (Über uns · Kontakt · Anfahrt · Hausordnung ·
Umgebung · FAQ), jede als Liste von Abschnitten mit gefüllten Beispieltexten in
der Sprache des Betriebs. Die Kontaktdaten kommen aus dem Firmenprofil (wie
schon in `kontakt_mit_firmendaten`).

### Etappe E — Theme ausbauen

1. **Schriftgrößen und -gewichte je Ebene** (H1–H3, Absatz), Desktop und Mobil
   getrennt.
2. **Kontrast-Prüfer** im Farbwähler — AA/AAA, wie Hostaway. Das
   `kontrast`-Modul existiert im Dashboard schon; hier nur anschließen.
3. **Farben aus dem Logo** ableiten (der Betrieb hat sein Logo hochgeladen).
4. **Seitenbreite** wählbar (1200 / 1440 / frei).
5. **Hintergrundbild je Abschnitt** (fällt schon in Etappe A an).

### Etappe F — Formular-Abschnitt mit Antworten-Verwaltung

Unser `contact`-Abschnitt zeigt Kontaktdaten; ein echtes **Formular** mit
Feldern gibt es nicht. Was wir bauen würden, hätten wir mit Hostaway gemeinsam:
Feldtypen, Pflichtfelder, Erfolgs-/Fehlermeldung, Weiterleitung nach dem
Absenden, Empfänger-Adresse, Auto-Antwort, reCAPTCHA (Enterprise ist schon im
Einsatz, siehe Kontaktseite), Antworten-Liste mit CSV-Export.

**Kein** mehrstufiges Formular in v1 und **keine** Google-Sheets-/Webhook-
Anbindung: für eine Unterkunfts-Website ist das Anfrageformular der Fall, und
den deckt ein einstufiges Formular ab.

### Etappe G — Pop-ups + Personalisierung

In dieser Reihenfolge, weil Pop-ups ohne Auslöser wenig nützen und die
Auslöser-Logik der teurere Teil ist.

* Pop-up als eigene Block-Sammlung (wie eine Seite ohne Navigation), ausgelöst
  per Link **oder** Regel.
* Regeln: Gerät · Land · Zeitfenster · Besuchszahl · Kampagnen-Parameter →
  Aktion: Hinweisleiste · Pop-up. **Kein** JavaScript als Aktion (das ist
  `custom_js`, und dort gehört es hin), **keine** „Special Effects"
  (Schneeflocken).

### Etappe H — Blog

Das größte Einzelmodul und bewusst zuletzt. Ein Blog ist für die Auffindbarkeit
wertvoll („Ausflugsziele in der Umgebung"), aber er verlangt: Beiträge,
Layouts, Autoren, Tags, Übersichts- und Suchabschnitt, RSS, Schema je Beitrag,
Planung, und in 24 Sprachen. Vorher lohnt jede andere Etappe mehr.

### Was NICHT gebaut wird — und warum

| Nicht bauen | Grund |
|---|---|
| CMS/Collections (eigene Datensammlungen) | Unsere dynamischen Seiten haben eine Datenquelle: das PMS. Eine zweite, freie wäre ein Produkt im Produkt. |
| Dev-Mode (site.css je Seite) | `head_css`/`custom_js` deckt den Fall ab, mit Allowlist. Ein Datei-Editor ohne Versionierung ist eine Falle. |
| Shutterstock-Verkauf, Pexels-Katalog | Wir haben `website-stock.ts`; Bilder verkaufen ist ein anderes Geschäft. |
| Bildeditor (Filter, Blur, Effekte) | Zuschneiden ja (später), Instagram-Filter nein. |
| Layers-Baum, Flex-Mode, Snap-to-Grid | Setzt freies Canvas voraus. Unser Abschnitts-Stapel ist die bewusste Gegenentscheidung: der Kunde kann seine Seite nicht zerlegen. |
| Site-Kommentare im Editor | Agentur-Funktion (Duda verkauft an Agenturen). Unser Kunde ist der Betrieb selbst. |
| Facebook-/X-Feed | Beide laut Hostaways eigener Doku kaputt oder eingeschränkt („may not function as expected", Safari blockt). Ein Abschnitt, der bei manchen Besuchern leer bleibt, ist schlechter als keiner. |
| Google-Calendar-Abschnitt | Zeigt keine mehrtägigen Termine — für Unterkünfte also genau das Falsche. |
| Automatische Übersetzung per Google Translate | Wir führen 24 Sprachen gepflegt. Maschinentexte, die „review before publishing" verlangen, wären ein Rückschritt. |
| Undo/Redo, „Backups mit 50 Stufen" | Braucht einen Bearbeitungs-Stack bzw. Site-Snapshots. Erst sinnvoll, wenn der Baukasten freier wird. |

---

## 4. Was heute schon besser ist als bei Hostaway

Nicht als Eigenlob, sondern damit es beim Ausbau nicht verloren geht:

1. **Eine Domain, ein Design.** Hostaway trennt Startseite und Objektseiten auf
   zwei Domains und zwei Design-Bereiche und verlangt Logo, Favicon und
   Analytics-ID **doppelt**.
2. **Strukturierte Daten automatisch** aus Firmenprofil und Objektdaten statt
   Copy-Paste aus einem Fremdgenerator — inklusive „ab"-Preis als
   `priceSpecification/minPrice` (nicht als fester `price`, was Google
   beanstandet, sobald der Gast im Checkout mehr sieht).
3. **`llms.txt`** — Hostaway nennt seinen Bereich „SEO/AEO" und liefert für
   Antwortmaschinen nichts.
4. **Google-Tag mit Consent Mode v2.** Hostaways Doku räumt für ihren Weg
   ausdrücklich ein, dass ein Consent-Banner den Code nicht aufhalten kann.
5. **Lazy-Loading mit Ausnahme für das erste Bild.** Ihr Schalter kann die
   LCP-Kennzahl verschlechtern, ohne dass es jemand erfährt.
6. **24 gepflegte Sprachen** statt Google-Translate mit Prüfbitte — und ohne
   deren Einschränkungen (kein Seiten-SEO, kein Blog, keine Personalisierung in
   Fremdsprachen).
7. **Keine Attrappen.** Jeder Schalter im Baukasten hat nachweisbare Wirkung im
   Renderer; wo etwas (noch) nicht wirkt, steht es im Text und nicht im
   Schalter.

---

## 5. Quellen

* 71 Artikel, Volltext: `support.hostaway.com/api/v2/help_center/en-us/sections/47672020137115/…`
  (Sektionen: Getting Started · Editor · Content · Pages and Pop-ups · Widgets
  mit 7 Untergruppen · Site Settings and Performance · AI Tools)
* 99 Produkt-Screenshots aus diesen Artikeln (Duda-CDN `multiscreensite.com`)
* Interaktive Produkt-Tour im Artikel „Editorübersicht" (24 Schritte)
* `hostaway.com/features` und `hostaway.com/features/ai-cohost`
* Eigener Stand: Migrationen 0086/0087/0159/0264/0421/0424/0426/**0430**/**0431**,
  `apps/api/src/features/site_config/`, `web/app/(dashboard)/website/`, `builder/`
