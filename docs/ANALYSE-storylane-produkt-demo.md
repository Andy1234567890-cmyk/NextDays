# Storylane — Analyse der interaktiven Produkt-Demo

**Untersuchtes Objekt:** `https://hostaway.storylane.io/share/ppbjuji5fzqg?page_id=1c499c95-c4fb-43f4-8731-8326529aefcc`
**Datum:** 18.08.2026 · **Werkzeug:** Claude-in-Chrome (DOM, Cache-Storage, Netzwerk, Performance-API)
**Zweck:** eigene, selbst gehostete Produkt-Tour für die Marketing-Seite (`marketing/`) bauen — ohne Storylane.

Alle Angaben unten sind im Browser gemessen, nicht aus Vorwissen.

---

## 1. Darstellungstechnik

**Echtes, geklontes DOM. Kein Bild, kein Canvas.** (`canvas: 0` im Renderer, `project.kind: "html"`, `page.kind: "html"` für alle 23 Seiten.)

Schachtelung — drei Ebenen:

```
hostaway.storylane.io/share/<shareId>     Next.js-Seite (__NEXT_DATA__ = nur Projekt-Config)
└─ <iframe src="/demo/<shareId>">         Next.js-Player (__NEXT_DATA__ = Tour-Daten, 69 KB)
   └─ <iframe sandbox="allow-same-origin allow-scripts allow-modals"
              class="RendererHtmlIframe_iframe…">   src = about:blank, HTML injiziert
      └─ der geklonte Hostaway-Screen
   + <div class="RendererHtmlSlot_root…">  Overlay-Schwester, absolut, z-index 2147483647
```

Kein Shadow-DOM für den Klon (`shadow_dom_editing: true` ist nur ein Editor-Flag). Der Klon-Iframe ist `about:blank` — seine eigene Performance-Timeline enthält **null** Subresources, alles ist inline.

**Stile:** 64 `<style>`-Blöcke im `<head>` des Klons, zusammen **1.050.913 Zeichen CSS**. Kein einziges externes Stylesheet.

**Schriften/Bilder — vollständig auf Storylane gespiegelt, nichts zeigt zum Kunden:**

- 20 × `@font-face` mit `src: url(data:font/woff2;base64,…)` (Abel, Raleway, …)
- alle 7 `<img>` = `data:image/png;base64` bzw. `data:image/svg+xml;base64`
- Favicon = `data:image/vnd.microsoft.icon;base64`
- 0 `<script>` im Klon — die App ist tot, reines Markup

**Spuren des Schnappschusses:**

- `<link rel="canonical" href="https://dashboard.hostaway.com/overview">` — steht noch im Klon
- die Original-Klassennamen sind unverändert (`sidebar-item-multi-label`, `metismenu`, `navbar-static-side`), **kein** Storylane-Präfix, **keine** injizierten `data-`-Attribute
- übrig gebliebene Fremd-Artefakte: Google-Translate-Widget (`goog-te-combo`), Zendesk-„Help"-Bubble, `data-react-helmet`, `data-reactroot`
- `ext_capture_version: "v1"` je Seite → Aufnahme per Browser-Extension
- der Klon enthält **echte Kundendaten**: Gästenamen, `Bobby@hostaways.com`, Telefonnummern, Beträge

---

## 2. Interaktion und Führung

### Hotspots sind an ein Element gebunden, nicht an Pixel

Jedes Widget trägt ein `dom_id` = CSS-Selektor:

| # | kind | dom_id |
|---|------|--------|
| 3 | tooltip | `#Sidebar-scrolable` |
| 4 | hotspot | `:nth-child(2) > .sidebar-item-children-wrapper > .sidebar-item-multi-label` |
| 6 | hotspot | `img` |
| 9 | tooltip | `#body` |
| 10 | hotspot | `:nth-child(6) > .sidebar-item-children-wrapper > .sidebar-item-multi-label` |

Zur Laufzeit wird der Selektor im Klon-Iframe aufgelöst, `getBoundingClientRect()` gelesen und das Overlay per CSS-Variable positioniert: `--translate-x/--translate-y` → `transform: translate(…)`.
Verifiziert: Ziel `#Sidebar-scrolable` endet bei x = 235, Widget steht bei `--translate-x: 233px`. Dazu ein gespeicherter Feinversatz `options.root.offset {x,y}` und `alignment: "lc"`.

Markup des Hotspots:

```
BUTTON.Hotspot_beaconClickableArea… aria-label="Hotspot-step clickable beacon"  [106×106]
  DIV.WidgetHotspotBeaconV2_beacon…  [26×26]  ← sichtbarer Punkt
```

Klickfläche 106 px, sichtbarer Punkt 26 px.

**Falscher Klick:** nichts. Kein Toast, kein Wackeln, kein Hinweis (bei 900/520 getestet, Schritt blieb 4/13). `page_link_toast_text` ist leer.

### Freies Klicken/Scrollen — ja, beides

- **Scrollen:** die Reservierungsliste im Klon scrollt nativ (CSS-`overflow`).
- **Tippen:** `<input>` im Suchfeld nimmt Text an — „Nordlicht" stand drin. Rein kosmetisch, es gibt kein JS dahinter.
- **Navigieren:** nur über die **12 gemappten `page_links`**:

```json
{ "id":"503i8rTctuFV8m_qEkNep", "type":"page",
  "target":"f460ac09-7cd0-4b5f-9c98-d6a6ecac410a",
  "selector":"a[href=\"https://dashboard.hostaway.com/v3/calendar/multi\"]" }
```

Der Klon wird dafür **nicht angefasst** (keine injizierten Attribute) — der Player fängt Klicks ab und matcht gegen die Selektorliste. Live verifiziert: Klick auf „Calendar" wechselte die Seite und setzte `?page_id=f460ac09-…`.

### Navigation

Kein Seitenwechsel, kein Neuladen. Der Player schreibt neues HTML in denselben `about:blank`-Iframe (`document.write`).

- Während der geführten Tour bleibt die URL **unverändert** — Schritte sind nicht deep-linkbar, der Zurück-Button verlässt die Demo.
- Im Frei-Modus wird die äußere URL per `pushState` aktualisiert: `?page_id=1c499c95…` → `?page_id=f460ac09…` (history.length 3 → 4).
- `page_id` in der Einstiegs-URL wählt nur die Startseite; ein laufender Flow überschreibt sie (die Test-URL zeigte auf `/message-templates`, gestartet wurde auf `/overview`).

### Steuerung

- Weiter/Zurück-Buttons pro Popup, Schrittzähler `n/13`, X zum Schließen — alles pro Widget schaltbar (`next_button`, `prev_button`, `close_button`, `show_step_number`).
- Fortschrittsleiste unten: ein `<button class="ImageCard_stepButton…">` **pro Schritt**, anklickbar zum Springen; beim Hovern erscheint eine Rasterthumbnail (`thumbnail_url` → `hcti.io`, htmlcsstoimage.com).
- Kapitelübersicht: `<button aria-label="steps navigation">` (Drei-Punkte).
- **Tastatur: ArrowRight/ArrowLeft steuern die Tour** — verifiziert, 4/13 → 5/13 inklusive Seitenwechsel. Sie überspringen sogar Hotspot-Schritte, die per Maus einen Klick auf den Beacon verlangen.
- X schließen → **Frei-Modus**: Toast „Click around to explore the product." + Button **„RESUME DEMO"** (aus `resume_demo_text`/`resume_demo_bg_color`).

---

## 3. Lead-Formular

**In dieser Tour gibt es keins.** 13 Widgets, Arten nur `popup | tooltip | hotspot`. Schritt 13 ist ein reines CTA-Popup:

```json
"cta": { "extUrl": "https://www.hostaway.com/get-free-demo", "extUrlBlank": true }
```

→ neuer Tab, nichts blockiert, X ist immer da.

Das Produkt *kann* es: das `widget_locale`-Schema führt `email_label`, `email_placeholder`, `name_label`, `name_placeholder`, `terms_and_conditions` (hier alle `null`), das Projekt hat `lead_cookie_tracking_enabled: true` und `lead_info: {ttl: 0.041}`.

**Wohin Daten gehen** — jeder Schritt feuert `POST https://api.storylane.io/api/v1/shared/projects/<projectId>/event`:

```json
{"demo":{"fingerprint":"6EkI0ALdkjamO0nHFzu4O",
         "permanent_cookie_id":"Chu7A00X-CLfMtr6olEyR",
         "current_cookie_id":"YZSk2yCVvj9551L-BUy9Q",
         "event":"page_viewed",
         "event_options":{},
         "referer":"<base64 der Einbett-URL>",
         "target_id":"2639a2cc-…",
         "locale_id":"e8a14b98-…"},
 "link_value":"ppbjuji5fzqg","url_query":null,"lead_info":null}
```

`event` ist u. a. `page_viewed` / `widget_viewed`. `lead_info` ist das Feld, in das Formulardaten wandern würden. Antworten kamen teils mit `503` — die Events sind best-effort und stören die Tour nicht.

---

## 4. Datenmodell

`__NEXT_DATA__` der Share-Seite enthält nur Projekt-Config. Die Tour steckt in `props.pageProps.ssResponseDataStr` des **inneren** `/demo`-Players (69 KB JSON), normalisiert als
`{entities:{projects,flows,widgets}, result:{project,substitutions,locale,link}}`.

```jsonc
{
  "entities": {
    "projects": { "<projectId>": {
      "id": "dbccfa65-…",
      "kind": "html",                    // html | image
      "start_page_id": "76011414-…",
      "pages_count": 23, "widgets_count": 13, "flows_count": 1,

      // ── SEITEN: je ein eingefrorener Screen ──────────────────────
      "pages": [{
        "id": "ba605226-…",
        "url": "https://dashboard.hostaway.com/overview",   // Herkunft
        "kind": "html",
        "name": "Hostaway Dashboard",
        "file_url": "https://app-pages.storylane.io/company/company_<cid>/project/project_<pid>/page/<hash>.html",
        "dimensions": { "width": 1905, "height": 873 },     // Aufnahmegröße
        "scale_config": { "scale":"fit","position":"center","frameBackgroundColor":"#B4B3C1" },
        "thumbnail_url": "https://hcti.io/v1/image/…",      // NUR Hover-Vorschau
        "preview_url":   "https://hcti.io/v1/image/…",
        "ext_capture_version": "v1"
      }],

      // ── FREIE NAVIGATION: Selektor → Zielseite ───────────────────
      "page_links": {
        "503i8rTctuFV8m_qEkNep": {
          "type": "page",
          "target": "f460ac09-…",                            // page.id
          "selector": "a[href=\"https://dashboard.hostaway.com/v3/calendar/multi\"]"
        }
      },

      "display_config": {
        "min_width": 800, "min_width_warning": true,
        "min_width_warning_text": "Your screen size looks too small…",
        "auto_scale": true, "renderer_html_scale_mode": "default",
        "mobile_viewport": false,
        "renderer_dimensions": { "width": 1905, "height": 873 },
        "page_link_hints": true, "page_link_hover_hints": false,
        "nav_bar": true, "nav_bar_color": "#9939EB", "nav_bar_display_mode": "auto",
        "auto_play": -1, "cta_enabled": false, "cta_text": "Book a Demo",
        "resume_demo_text": "Resume Demo", "replay_demo_text": "Replay Demo"
      },
      "feature_flags": { "responsive_html_demo_player": false, "html_tokens": false }
    }},

    // ── FLOW = geordnete Schrittliste ────────────────────────────
    "flows": { "<flowId>": { "id":"d3895a7e-…", "name":"Default", "widgets":[ /* ids in Reihenfolge */ ] } },

    // ── WIDGET = ein Schritt ─────────────────────────────────────
    "widgets": { "<widgetId>": {
      "id": "2e16c83d-…",
      "kind": "hotspot",                 // popup | tooltip | hotspot
      "page_id": "76011414-…",           // auf welcher Seite
      "flowId":  "d3895a7e-…",
      "dom_id":  ":nth-child(2) > .sidebar-item-children-wrapper > .sidebar-item-multi-label",
      "target_id": null, "target_type": null,   // Alternative zu dom_id, hier ungenutzt

      "widget_locale": {                 // ALLE Texte, je Sprache eigener Datensatz
        "description": "<p>Lets check out the Multi-Calendar module</p>",   // HTML!
        "cta": "Next", "secondary_cta": "CTA",
        "email_label": null, "name_label": null, "terms_and_conditions": null   // ← Lead-Form
      },

      "options": {
        "root": {
          "alignment": "lc",             // left-center: Andockseite am Zielelement
          "offset": { "x": 94.80, "y": 56.04 },        // Feinversatz in px
          "offsetFromOriginPx": { "x": 0, "y": 0 },
          "frameWidth": 275.81, "maxFrameWidth": null,
          "theme": "light", "backgroundColor": "#EF7B48", "borderColor": "#EF7B48",
          "beaconColor": "#EF7B48", "beaconOpacity": 1,
          "close_button": true, "next_button": false, "prev_button": true,
          "show_step_number": true, "hide_arrow": false,
          "spot": "none", "hasSpotlight": false, "spotlightColor": "#9939eb",
          "backdropRect": null, "backdropSelector": null,   // Spotlight-Ausschnitt
          "doNotScroll": false,          // sonst scrollt der Klon das Ziel in den Blick
          "zoom": null, "trigger": null
        },
        "cta": { "extUrl": "https://www.hostaway.com/get-free-demo", "extUrlBlank": true,
                 "flowId": null, "widgetId": null, "backgroundColor": {"hex":"#EF7B48"} }
      }
    }}
  },

  "result": {
    // Personalisierungs-Platzhalter, zur Laufzeit ins HTML ersetzt
    "substitutions": [
      {"key":"first_name","kind":"text","value":null},
      {"key":"company_name","kind":"text","value":null},
      {"key":"company_logo","kind":"logo","value":null}     // im Klon sichtbar als "YOUR LOGO HERE"
    ],
    "locale": { "lang":"en","default":true,"convert_cta":"Book a Demo","widget_locales":[] }
  }
}
```

### Datenmengen und Tempo

Gemessen an der Cache-Storage des Players (`caches.keys()` → `demoplayer-html-documents-v2`, `demoplayer-html-substituted`):

- **15 Seiten gecacht = 62,57 MB** unkomprimiert.
  Je Seite: 389 KB · 415 KB · 1,5 · 1,6 · 1,6 · 1,8 · 1,9 · 3,1 · 4,0 · 4,0 · 7,2 · **9,8** · **23,7 MB**
- Übertragung einer 4,0-MB-Seite: `content-length: 2.415.484` (2,4 MB), 875 ms, `cache-control: no-cache`
- Der Anteil ist **Assets, nicht DOM**: die 23,7-MB-Seite hat nur **3074 Knoten**; eine 1,6-MB-Seite besteht zu 27 % aus base64-`data:`-URIs (80 Stück), bei zwei Seiten zu 100 %
- **Injektion ist schnell**: `document.write` einer 1,6-MB-Seite 67 ms · 4,0 MB 88 ms · **23,7 MB 205 ms**
- Im Betrieb ist der Schrittwechsel **netzwerkfrei** — beim zweiten Durchlauf null HTTP-Requests für Seiten-HTML (nur die Analytics-Events). Nur die Startseite kommt per `<link rel="preload" as="fetch">`.

---

## 5. Responsivität und Barrierefreiheit

### 390 px — live getestet

(Player-Iframe auf 390×780 gezwungen, `resize` gefeuert.)

- `feature_flags.responsive_html_demo_player: false`, `mobile_viewport: false`
- der Klon-Iframe behält **starr 1905 px Breite**, der Wrapper skaliert per
  `transform: matrix(0.204724, 0, 0, 0.204724, 0, 0)` → **20 % Größe**, unlesbar
- darüber legt sich ein ganzflächiges Overlay:
  **„Your screen size looks too small for the demo experience"** + Button **„I can continue"**
  (`min_width: 800`, `<p role="alert">`)

Es bricht also nicht, es skaliert — nur eben auf Briefmarkengröße, mit ehrlicher Warnung. Kein Reflow, kein Scrollen der Desktop-Breite.

### Barrierefreiheit — gemischt bis schlecht

Vorhanden:

| Element | Rolle/Label |
|---|---|
| Widget-Körper | `role="dialog"` `aria-label="Step dialog"` |
| Hotspot-Beacon | `<button aria-label="Hotspot-step clickable beacon">` |
| Kapitel-Button | `aria-label="steps navigation"` |
| Klon-Iframe | `aria-label="demoplayer-renderer"` |
| Größen-Warnung | `role="alert"` |
| Tastatur | ArrowLeft / ArrowRight ✔ |

Fehlend:

- **Der Klon-Iframe trägt `tabindex="-1"` und `aria-hidden="true"`** → das gesamte gezeigte Produkt ist für Screenreader nicht existent und per Tab nicht erreichbar. Nur die Maus kommt hinein.
- Weiter-/Zurück-Pfeile: **kein** `aria-label`, kein Text (nur SVG)
- die Schritt-Buttons der Fortschrittsleiste: **kein** Label
- kein Fokus-Trap im `role="dialog"`, keine `aria-live`-Ansage beim Schrittwechsel
- Gesamt nur 13 fokussierbare Elemente auf der ganzen Seite

---

## Empfehlung für myNextDays

### Entscheidung: **(b) HTML/CSS-Schnappschuss — mit Playwright statt Extension erzeugt**

Nicht (a), nicht (c). Begründung an dem, was oben tatsächlich gemessen wurde.

**Gegen (a) Screenshots + absolute Hotspots.**
Genau die Schwäche, die vermutet wird, ist bei Storylane *gelöst* — und zwar nicht durch Bilder, sondern dadurch, dass sie DOM behalten haben. Hotspots hängen an `dom_id`-Selektoren, nicht an Koordinaten. Ändert sich das Layout, wandert der Hotspot mit, solange der Selektor hält. Mit Screenshots gibt man das auf und handelt sich zusätzlich ein: kein Text-Scrollen, kein Copy/Paste, keine Suche, kein Antippen von Eingabefeldern, unscharfe Skalierung, kein SEO-Text. Storylane nutzt Rasterbilder nur noch für die Hover-Vorschau der Fortschrittsleiste — genau dafür sind sie gut.

**Gegen (c) echte App read-only im Iframe.**
Drei harte Blocker: (1) Login-Zwang — der Marketing-Besucher hat keinen. (2) Ein „Nur-Lese-Modus" ist eine zweite Autorisierungs-Achse quer durch die ganze API — genau die Klasse, die Wurzel 3/6/9 immer wieder kippt. (3) Es wäre Live-Last aus Marketing-Traffic auf der Produktions-API, mit realen Tenant-Daten hinter einem read-only-Flag. Der Nutzen („immer aktuell") wiegt das nicht auf.

**Für (b).**
Der Schnappschuss ist echtes DOM: skaliert scharf, scrollt, ist durchsuchbar, indexierbar, mehrsprachig (unser i18n-Bau greift, wenn vor der Aufnahme die Sprache gesetzt wird) — und das Kernproblem „wie hält man ihn aktuell" ist bei uns leichter als bei Hostaway, weil wir die App selbst bauen und Nordlicht/Seeblick als Demo-Tenants ohnehin pflegen. Die Aufnahme wird ein CI-Job, kein Handgriff.

### Bausteine

**1. Aufnahme-Job (Playwright, Node, im Repo neben den bestehenden Skripten)**

- Login in Nordlicht/Seeblick, Seite ansteuern, `networkidle`, dann Serialisierung:
  - alle Stylesheets (`document.styleSheets` → `cssRules`) in `<style>`-Blöcke ausrollen, inkl. der CSS-in-JS-Blöcke
  - alle `<img>`, `background-image`, Icons zu `data:`-URIs **oder** (bevorzugt) zu Dateien daneben
  - **Schriften nicht inlinen** — hier weichen wir bewusst von Storylane ab (siehe Fallstricke). Wir laden unsere eigenen woff2 aus `/fonts` der Marketing-Seite.
  - **alle `<script>` entfernen**, `<link rel=canonical>` entfernen, `<base>` setzen
  - `<meta name="robots" content="noindex">` **nicht** setzen — die Snapshots sollen indexiert werden
- Aufnahme in fester Breite (Vorschlag **1440×900**, nicht 1905 — kleinere Bytes, bessere Skalierung auf Laptops)
- Ausgabe: `marketing/public/tour/<tourId>/<pageKey>.html` + ein `tour.json`

**2. Maskierung — Pflichtschritt, nicht optional**

Vor dem Serialisieren läuft ein Ersetzungs-Durchgang über den DOM: Gastnamen, E-Mails, Telefonnummern, Adressen, Beträge. Nordlicht/Seeblick sind Fotomodell-Tenants, aber ein Snapshot friert *alles* ein, was im DOM steht — auch Attribute und `title`-Texte.
Der Job **schlägt fehl** (nicht: warnt), wenn er nach der Maskierung noch etwas findet, das wie eine E-Mail oder eine `+`-Telefonnummer aussieht. Fail-closed, Wurzel 5.

**3. Datenmodell — Storylanes Struktur übernehmen, um zwei Dinge erweitert**

```jsonc
{
  "id": "pms-rundgang",
  "captureWidth": 1440,
  "minWidth": 900,                      // darunter Hinweis statt 20%-Briefmarke
  "pages": [{ "key":"kalender", "file":"kalender.html", "sourceUrl":"/kalender",
              "capturedAt":"2026-08-18", "appCommit":"fa16242c" }],   // ← Erweiterung 1
  "links": [{ "selector":"a[href='/objekte']", "target":"objekte" }],
  "steps": [{
    "page":"kalender", "kind":"tooltip",
    "anchor": { "selector":"[data-tour='kalender-stopsell']",         // ← Erweiterung 2
                "fallback":".calendar-toolbar button:nth-child(3)" },
    "align":"bottom-center", "offset":{"x":0,"y":8},
    "i18nKey":"tour.pms.kalender.stopsell"                            // Text NICHT im JSON
  }]
}
```

- **Erweiterung 1 (`appCommit`)** macht Veralterung sichtbar.
- **Erweiterung 2 (`data-tour`)** ist der entscheidende Unterschied zu Storylane: Storylane muss mit `:nth-child(2) > .sidebar-item-children-wrapper > .sidebar-item-multi-label` arbeiten, weil sie fremden Code filmen. Wir nicht. Ein `data-tour="kalender-stopsell"` im Kalender-Component überlebt jedes Redesign, und wenn es gelöscht wird, bricht der Aufnahme-Job — genau der Alarm, den man will.

**4. Player (Next.js, `marketing/`)**

Storylanes Architektur ist gut, die kopieren wir:

- Snapshot in einen `<iframe sandbox="allow-same-origin">` **ohne** `allow-scripts` (wir haben keine Skripte drin, also brauchen wir es nicht — enger als Storylane)
- Overlay als Geschwister-Div, `pointer-events:none` am Container, `auto` nur an Beacon/Karte, Position per `--translate-x/y` aus dem live aufgelösten Selektor
- Auto-Scale per `transform: scale(viewportWidth / captureWidth)`
- Vorwärts/Rückwärts, Schrittzähler, klickbare Fortschrittsleiste, ArrowLeft/Right
- Frei-Modus nach dem Schließen + „Rundgang fortsetzen"

**5. Aktualisierung**

- GitHub Action, wöchentlich + bei jedem Merge in `main`, der `plattform/` oder `web/` berührt
- Der Job nimmt neu auf und **prüft jeden `anchor.selector` gegen den frischen Snapshot**. Findet ein Selektor kein Element → roter Build, mit Angabe von Tour, Schritt und Selektor. Das ist die eine Sache, die den Bau trägt: **der Rundgang kann nicht still veralten.**
- Bytes: das Diff der `.html`-Dateien im Git wäre unbrauchbar. Snapshots gehören **nicht ins Git** — Aufnahme im CI, Ablage in unserem S3/Storage, Auslieferung über die Marketing-Domain. (Passt zur laufenden S3-Migration.)

**6. Aufwand-Realität**

Der Player ist der kleinere Teil (~2–3 Tage). Der Serialisierer frisst die Zeit — CSS-in-JS, Web-Fonts, `<canvas>`-Charts. Ein echtes `<canvas>` kommt im Snapshot **leer** heraus und muss vor dem Serialisieren zu einem PNG-`data:`-URI gemacht werden (Hostaways Charts sind SVG, unsere sind zu prüfen).

### Fallstricke, die in Storylanes Umsetzung sichtbar sind

1. **Bytes explodieren durch inline-base64.** 62,6 MB für 15 Seiten, eine einzelne Seite 23,7 MB — bei nur 3074 DOM-Knoten. Alles Assets. Base64 kostet zusätzlich +33 % gegenüber der Binärdatei.
   → Bei uns: Bilder und Schriften als **normale Dateien neben dem Snapshot**, nicht inline. Wir hosten beides selbst, es gibt keinen Grund für Storylanes Zwang zur Selbstgenügsamkeit. Damit fällt eine 4-MB-Seite auf wenige hundert KB, und die Assets werden über alle Seiten hinweg **einmal** gecacht statt 23-mal dupliziert.

2. **Duplizierte Seiten.** 23 Seiten, aber viele identische `/overview`- und `/message-templates`-Captures — die Extension nimmt bei jedem Besuch neu auf.
   → Dedup über einen Content-Hash, eine Seite pro `sourceUrl`.

3. **Snapshots driften auseinander.** Zwei Seiten desselben Rundgangs zeigen unterschiedliche Sidebar-Reihenfolgen (auf der Kalender-Seite ist „Smart Locks" nach oben gerutscht, „Inbox" zeigt 29 statt 99+) — sie stammen aus verschiedenen Aufnahmesitzungen. Der Nutzer klickt und die Navigation springt.
   → Ein Rundgang wird **in einem Lauf** aufgenommen, alle Seiten oder keine. Ein Teil-Update gibt es nicht.

4. **Echte Kundendaten eingefroren.** Im Klon stehen Gästenamen, `Bobby@hostaways.com`, Telefonnummern, Buchungsbeträge — dauerhaft öffentlich abrufbar unter `app-pages.storylane.io`, ohne Auth.
   → siehe Maskierungs-Gate oben.

5. **Fremdes Zeug wird mitgefilmt.** Google-Translate-Leiste und Zendesk-„Help"-Bubble kleben im Snapshot und sehen aus wie Teil des Produkts.
   → Blocklist im Serialisierer, außerdem Aufnahme in einem sauberen Profil ohne Extensions.

6. **Brüchige Selektoren.** `:nth-child(2) > .sidebar-item-children-wrapper > .sidebar-item-multi-label` und `dom_id: "img"` (Schritt 5 und 6 — „das erste Bild") halten kein Refactoring aus.
   → `data-tour`, plus CI-Prüfung.

7. **Mobil ist nicht gelöst, nur abgeschottet.** 20 % Skalierung + „Screen too small". Für eine Marketing-Seite, auf die die Hälfte der Besucher vom Handy kommt, ist das zu wenig.
   → `minWidth: 900`; darunter kein geschrumpfter Desktop, sondern eine **eigene mobile Fassung**: die Schritt-Texte als vertikale Story mit je einem beschnittenen Ausschnitt-Bild des relevanten Bereichs (aus derselben Playwright-Aufnahme per `element.screenshot()` erzeugt — dieselbe Quelle, kein zweiter Pflegepfad).

8. **Barrierefreiheit ist ein Nachgedanke.** `aria-hidden="true"` + `tabindex="-1"` auf dem gesamten Produkt-Iframe, unbeschriftete Weiter-/Zurück-Pfeile.
   → Bei uns: Iframe nicht `aria-hidden`, Weiter/Zurück mit `aria-label`, Schrittwechsel per `aria-live="polite"` angesagt, Fokus-Trap im Dialog, Fortschritts-Buttons beschriftet („Schritt 4 von 13: Kalender").

9. **Keine Deep-Links auf Schritte.** Während der Tour ändert sich die URL nicht — man kann Schritt 7 nicht verlinken, und der Zurück-Button verlässt die Demo.
   → `?schritt=7` per `replaceState` mitführen. Kostet nichts und macht den Rundgang teilbar, was der eigentliche Marketing-Zweck ist.

10. **Analytics best-effort halten.** Storylanes `/event`-Endpunkt antwortete im Test mehrfach mit `503`, ohne dass die Tour stockt — richtig so.
    → Bei uns: Events feuern, Fehler schlucken, nie den Hauptpfad kippen (Wurzel 5, `# noqa: BLE001`-Denkweise).
