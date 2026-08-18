# Storylane-Demo: Live-Anwendung oder eingefrorener Schnappschuss?

**Untersucht am:** 18.08.2026
**Objekt:** `https://hostaway.storylane.io/share/ppbjuji5fzqg?page_id=1c499c95-c4fb-43f4-8731-8326529aefcc`
**Methode:** Chrome (Claude-in-Chrome) — DOM-/Iframe-Inspektion, Performance-API, Netzwerk-Panel,
Cache-Storage, Interaktionstests; zusätzlich `curl` gegen die Auslieferungs-URLs.

---

## Urteil

**Snapshot.** Der Produktinhalt der Demo ist ein Satz von **23 statischen HTML-Dateien**, die als
Objekte in einem Amazon-S3-Bucket liegen (ausgeliefert über CloudFront) und **am 20.08.2025 in einem
Rutsch hochgeladen** wurden. Sie werden vom Storylane-Player in ein `about:blank`-Iframe injiziert.
Es läuft **kein einziges Skript** des Produkts, es wird **kein einziger Request an Hostaway**
gestellt.

### Die drei stärksten Belege

1. **Der gezeigte Inhalt hat null Skripte und null Subressourcen.**
   Das Iframe mit dem Produktinhalt (`about:blank`, `sandbox="allow-same-origin allow-scripts
   allow-modals"`) enthält ~4 MB DOM, davon:
   `document.scripts.length = 0`, `window.React = undefined`, `jQuery/Vue/angular = undefined`,
   `performance.getEntriesByType('resource').length = **0**`,
   64 inline `<style>`-Blöcke, alle Bilder als `data:image/...;base64`.
   Eine laufende Anwendung hat Skripte und lädt Subressourcen. Hier passiert beides nicht.

2. **Die 23 Seiten sind unveränderliche S3-Dateien mit identischem Upload-Zeitstempel.**
   Alle 23 URLs antworten mit `HTTP 200`, `server: AmazonS3`, `via: … cloudfront.net` und
   **ausnahmslos** `last-modified: Wed, 20 Aug 2025 18:08:47 GMT`. Größe: 45,7 MB gzip
   (233 KB bis 17,4 MB pro Seite), `etag` fix, `x-amz-server-side-encryption: AES256`.
   Das ist ein Datei-Ablage-Fingerabdruck, kein Anwendungs-Endpunkt.

3. **Kein Netzwerkverkehr zu Hostaway — über die ganze Sitzung, in keinem Frame.**
   Ressourcen-Hosts laut Performance-API:
   - Top-Frame: `assets.storylane.io` (27), `hostaway.storylane.io` (1), `fonts.gstatic.com` (1)
   - Player-Frame: `assets.storylane.io` (33), `app-pages.storylane.io` (1), `fonts.gstatic.com` (1)
   - Inhalts-Frame: **0**
   Netzwerk-Panel beim Durchklicken: nur `app-pages.storylane.io/…/page/*.html`,
   `assets.storylane.io/apps/prod/467/player/…`, `api.storylane.io/…/events` (Telemetrie, antwortete
   mit 503), `translate.googleapis.com/element/log` sowie viele `data:`-URIs (die eingebetteten
   Bilder). **Kein `*.hostaway.com`.** WebSockets: keine.

---

## Korrektur des Vorbefunds

> „Ein direkter curl darauf gibt HTTP 403 mit `<?xml?><Error><Code>AccessDenied</Code>`.“

**Widerlegt.** Alle 23 vollständigen Datei-URLs liefern per `curl` **200** — ohne Referer, ohne
Origin, ohne User-Agent-Trick:

```
curl -sI '…/page/3caubtirtddrsybs817kcszkxfgz.html'
HTTP/2 200
content-type: multipart/form-data
content-length: 831139
server: AmazonS3
last-modified: Wed, 20 Aug 2025 18:08:47 GMT
content-encoding: gzip
x-cache: Miss from cloudfront
```

Der 403 `AccessDenied` entsteht bei S3, wenn man ein **Präfix ohne Dateinamen** anfragt
(Verzeichnis-Listing ist gesperrt) — nicht bei der Datei selbst. Die *Schlussfolgerung* des
Vorbefunds („Dateien, nicht Anwendung“) bleibt richtig; die *Begründung* war falsch. Zwei
Nebenfunde derselben Herkunft: `content-type: multipart/form-data` (Upload-Artefakt, nicht
`text/html`) und `cache-control: no-cache`.

---

## Die sieben Tests im Einzelnen

### 1. Läuft JavaScript im gezeigten Inhalt? — Nein

Die Frame-Kette:

| Ebene | Herkunft | Skripte | `<style>` | Ressourcen | Größe |
|---|---|---|---|---|---|
| Top | `hostaway.storylane.io/share/…` | 24 | 2 | 29 | 34 KB |
| Iframe 1 | `hostaway.storylane.io/demo/…` (echtes `src`) | 25 | 2 | 44 | 100 KB |
| **Iframe 2** | **`about:blank`, sandboxed** | **0** | **64** | **0** | **~4 MB** |

Das einzige `<script>` in der Quelldatei ist ein Polyfill, der sich selbst entfernt:

```html
<script data-template-shadow-root>(()=>{document.currentScript.remove();
processNode(document);function processNode(node){node.querySelectorAll(
"template[shadowrootmode]").forEach(element=>{…attachShadow…})}})()</script>
```

Das ist die Rehydrierung von *declarative Shadow DOM* — Teil des Snapshot-Serialisierers, kein
Produktcode. In der ausgelieferten Fassung ist selbst dieses Tag entfernt (siehe Test 5).

### 2. Netzwerk beim Durchklicken — nur Storylane

Siehe Beleg 3 oben. Bemerkenswert: die Snapshot-Datei **enthält** Hostaway-URLs, aber
ausschließlich als Link- und Preload-Ziele, die nie abgerufen werden:

```
href="https://dashboard.hostaway.com/listing/67289"      (und ~20 weitere Listings)
href="https://dashboard.hostaway.com/assets/constants.eba575f4.js"   (rel=modulepreload, 3×)
href="https://support.hostaway.com/", "https://changelog.hostaway.com/"
```

`<link rel="modulepreload">` auf echte Hostaway-JS-Bundles ist im injizierten DOM wirkungslos —
Ressourcen-Zähler im Inhalts-Frame bleibt 0.

### 3. Ist es eingefroren? — Ja, und die Daten liegen in der Vergangenheit

Werte auf der Übersicht, **identisch vor und nach vollständigem Reload**:

| Kachel | Wert |
|---|---|
| Today's check-outs | 5 |
| Today's check-ins | 4 |
| Reservations that need your approval | 0 |
| Upcoming reservation(s) — „Next 7 days“ | 18 |
| Staying guest(s) | 10 |
| Pending inquiries | 0 |

Namen und Zeiträume ebenfalls unverändert (u. a. „Logan Willis, Bayview Grean
(2025-04-06 @3:00pm – 2025-04-08 @11:00am)“). Die Datumsspanne der Übersicht liegt bei
**2025-04-03 bis 2025-04-14**; in einer der geladenen Detailseiten stehen ausschließlich
Datumsangaben aus **2024-01**. Heute ist der **18.08.2026** — die Kachel „Today's check-outs“
behauptet also Abreisen von vor knapp 1,5 Jahren als „heute“. Die Dateien selbst sind seit
20.08.2025 unverändert (Beleg 2).

### 4. Verhalten bei Interaktion — Text wird angenommen, nichts passiert

- Ins Suchfeld oben rechts `Madrid` getippt: **erscheint im Feld** (es ist ein echtes
  `<input>` im DOM). `Enter` gedrückt: **keine Filterung, kein Dropdown, kein Request,
  keine DOM-Änderung.**
- Klick auf eine Reservierungszeile („Logan Willis…“): **nichts**. Netzwerk danach: nur `data:`-Bilder.
- Klicks auf „Calendar“, „Reservations“ in der Seitenleiste: **nichts** — es gibt nur den
  vorgezeichneten Tour-Pfad (13 Schritte, Overlay „Start The Tour“ / „Next“ / „RESUME DEMO“).

Vor der Tour blockt außerdem ein Gate „Your screen size looks too small for the demo experience“;
darunter liegt das Snapshot-Bild bereits sichtbar (verwaschen), noch bevor man interagiert hat.

### 5. Wie kommt der Inhalt in den Iframe? — Injektion aus Cache Storage

- `iframe.src` der Inhalts-Ebene: **leer** (`about:blank`, erbt die Storylane-Origin, deshalb ist
  sie von außen inspizierbar).
- `iframe.sandbox`: `allow-same-origin allow-scripts allow-modals`.
- `srcdoc`: **nein** auf dieser Ebene. Innerhalb des Snapshots gibt es dagegen 6 verschachtelte
  Iframes, davon eines per `srcdoc` (11 049 Zeichen, `sandbox="allow-popups
  allow-top-navigation … allow-scripts allow-same-origin"`, 340×500 px) — das mitkopierte
  Support-Chat-Widget.
- `navigator.serviceWorker.getRegistrations()`: **leer**.
- `caches.keys()` — hier liegt die Antwort:

```
demoplayer-html-documents-v2   15 Einträge   erster: 1 679 237 Zeichen, 1 <script>, 7 <style>
demoplayer-html-substituted    15 Einträge   erster:   424 944 Zeichen, 0 <script>, 0 <style>
```

Zwei Cache-Schichten: die **rohen** Seiten-Dokumente von S3 und dieselben Seiten nach
Token-/Personalisierungs-Substitution. In der substituierten Fassung ist das Skript-Tag
**entfernt**. Diese Fassung wird in das Iframe geschrieben.
`localStorage`: `eid`, `fp_id` (Besucher-Fingerprint). `sessionStorage`: `demoplayer-muted`.

### 6. Login/Session — es gibt keine

Es existiert keine Hostaway-Session, weil der Browser **nie** mit `hostaway.com` gesprochen hat
(Beleg 3). Cookies für `hostaway.com` wären aus der `storylane.io`-Origin ohnehin nicht lesbar; der
belastbare Test ist der Netzwerkverkehr, und der ist eindeutig. Vorhanden sind nur
Storylane-Telemetrie-Kennungen (`eid`, `fp_id`) und ein `translate.googleapis.com`-Log-Request, den
das mitkopierte Google-Translate-Widget auslöst.

### 7. Der Abruf einer app-pages-URL — 200, und darin steht ein Snapshot

`fetch(url)` aus dem Browser-Kontext (ohne `credentials`, sonst CORS-Konflikt mit `ACAO: *`):

```
status: 200
content-type: multipart/form-data
last-modified: Wed, 20 Aug 2025 18:08:47 GMT
Länge: 1 679 237 Zeichen (831 KB gzip)
<script>: 1 (der Shadow-DOM-Polyfill)   <style>: 7   <link rel=stylesheet>: 0
data:image/…;base64: 80  (2× jpeg, 2× png, 74× svg+xml)
externe src=: 1  (Facebook-Pixel-Fallback-Bild im <noscript>)
<link rel>: modulepreload ×3, icon ×1, canonical ×1
```

Eine zweite, kleinere Seite (`nwmpf5x26wihf8cz8xyt2wzc3r4y.html`, 313 KB entpackt) enthält
**0 `<script>`, 0 `<style>`, 0 externe `src=`** — reines serialisiertes DOM mit Inline-Attributen.

Inhaltlich: das komplette Hostaway-Dashboard-Markup samt Seitenleiste, Kacheln, Gastnamen,
Objektnamen und Buchungszeiträumen. Die Namen und Objekte wirken wie das Demo-Inventar des
Anbieters („Bayview Grean“, „Ataraxia Apartment by Izzy“, „Center of Madrid by Izzy“); von außen
lässt sich nicht beweisen, ob es synthetische oder anonymisierte echte Daten sind — sichtbar ist
nur, dass sie **fest in der Datei stehen**.

---

## Warum es sich trotzdem „real“ anfühlt

Genau das ist der Punkt, an dem die Verwirrung entsteht. Ein Screenshot-Tool erkennt man sofort;
dieser Aufbau nicht, weil er *dieselbe Substanz* liefert wie die App, nur ohne Verhalten:

1. **Es ist echtes DOM + CSS, kein Bild.** Text ist markierbar, Schriften sind echte Webfonts,
   Kanten sind pixelscharf bei jedem Zoom, `overflow`-Bereiche scrollen wirklich.
2. **Echte Formularelemente.** Das Suchfeld nimmt Tastatureingaben an, weil es ein echtes `<input>`
   ist. Das Ausbleiben der Reaktion fällt erst auf, wenn man bewusst darauf achtet.
3. **CSS-Interaktion lebt weiter.** Hover-Zustände, Fokus-Ringe, `:active`, Tooltips, aufklappbare
   Menüs, Akkordeons — alles, was ohne JavaScript funktioniert, funktioniert.
4. **Shadow DOM wird rehydriert.** Web-Components sehen aus wie im Original, statt zu zerfallen.
5. **Mitkopierte Fremdwidgets.** Das Support-Chat-Widget (als `srcdoc`-Iframe) und der
   Google-Translate-Sprachwähler stehen da, wo sie in der echten App stehen — inklusive echter
   Zähler-Badges („Inbox 99+“, Glocke mit „3“).
6. **Der geführte Pfad verdeckt die Grenzen.** 13 Tour-Schritte lenken die Aufmerksamkeit auf genau
   die Klicks, für die ein Snapshot existiert. Alles daneben ist tot, aber man wird nicht dorthin
   geschickt. Ohne Tour merkt man es sofort (Sidebar-Klicks tun nichts).
7. **Es lädt schnell und fällt nie aus.** Keine Backend-Latenz, keine leeren Zustände, keine
   Fehlermeldungen — was subjektiv *besser* wirkt als die echte Anwendung.

Der einzige verlässliche Hinweis für einen normalen Betrachter sind die **eingefrorenen Daten**:
„heute“ ist der 06.04.2025.

---

## Anbieter-Vergleich: Wer zeigt wirklich die laufende App?

**Kurzantwort: kein Anbieter für einen anonymen Link.** „Live“ heißt in diesem Markt entweder
*Overlay auf der echten App im Browser des Verkäufers* oder *geklonte Umgebung mit eigenem Backend* —
beides braucht einen Login und/oder eine eigene Umgebung, keines funktioniert als öffentlicher
Marketing-Link.

| Anbieter / Produkt | Technik | Zeigt der Besucher die laufende App? | Voraussetzungen | Quelle |
|---|---|---|---|---|
| **Storylane** — HTML-Demo | Chrome-Erweiterung serialisiert HTML/CSS je Seite; 3 Aufnahmemodi (Single / Continuous / Timed) | Nein — „responsive, editable HTML/CSS replica of your product UI“ | Erweiterung + Zugang zur eigenen App zum Aufnahmezeitpunkt | [docs.storylane.io](https://docs.storylane.io/recording-demos/recording-html-demos), [Screenshot or HTML](https://www.storylane.io/plot/screenshot-or-html-picking-the-right-demo-format) |
| **Storylane** — Screenshot-Demo | Bildserie mit Klick-Hotspots | Nein | Erweiterung | [docs.storylane.io](https://docs.storylane.io/recording-demos/recording-screenshot-demos) |
| **Navattic** | Chrome-Erweiterung, „full DOM snapshot“, klont den Frontend-Code | Nein | Erweiterung | [docs.navattic.com](https://docs.navattic.com/build/captures/web) |
| **Walnut** | Chrome-Erweiterung erfasst DOM/CSS, „HTML clone … runs independently … sandboxed environment“ | Nein | Erweiterung; CRM-Anbindung für Daten je Interessent | [help.walnut.io](https://help.walnut.io/hc/en-us/articles/32035634230803-Create-Demos-Part-3-Capture-Screens), [walnut.io](https://www.walnut.io/product/) |
| **Supademo** | Mehrere Modi: HTML-Capture, Screenshot, Video, Desktop, Figma | Nein | Erweiterung | [supademo.com](https://supademo.com/blog/interactive-product-demo-software) |
| **Arcade** | überwiegend Screenshot-Capture; HTML-Capture erst im höheren Tarif | Nein | Erweiterung | [arcade.software](https://www.arcade.software/post/best-interactive-demo-software-2026) |
| **Reprise Replay** | HTML-Capture des Frontends (dieselbe Klasse wie Storylane) | Nein — „an imitation of your product“ | Erweiterung | [reprise.com Buyer's Guide](https://www.reprise.com/resources/blog/which-live-demo-tech-is-best-for-you-the-complete-buyers-guide) |
| **Reprise Reveal** | Browser-Erweiterung, die die **echte laufende App** zur Laufzeit überlagert / Daten injiziert | **Ja — aber nur im Browser des Vorführenden** | Erweiterung + Login in die echte Umgebung; nicht als öffentlicher Link nutzbar | [reprise.com](https://www.reprise.com/resources/blog/meet-the-reprise-integrated-demo-creation-platform-and-reprise-reveal) |
| **Reprise Replicate** | erfasst Frontend **und** Requests/Responses → eigenständige, lauffähige Klon-Umgebung | Nicht die Produktion, aber eine **echt laufende** Kopie mit Backend-Verhalten | Klon-Umgebung wird aufgebaut und betrieben; PII-Anonymisierung; Demo-Daten einspielen | [reprise.com/platform/reprise-replicate](https://www.reprise.com/platform/reprise-replicate) |
| **Saleo Live** | Erweiterung injiziert Daten in die **native, laufende** App | **Ja — im Browser des Vorführenden** | gestagte Live-/Demo-Umgebung + Login | [saleo.io/platform/saleo-live](https://saleo.io/platform/saleo-live/) |
| **Demostack** | „Digital Twin“ / Sandbox-Umgebung | laufende Kopie, nicht Produktion | eigene Umgebung | [demostack.com](https://www.demostack.com/demostack-vs-saleo) |

**Die Kategorie-Grenze**, die Reprise selbst zieht (Buyer's Guide): *HTML-Capture = „an imitation of
your product“*; *Data-Injection = „your live production environment“*; *Full-App-Cloning =
„self-contained demo environment … separate from your production environment“*. Nur die mittlere
Kategorie ist die echte Anwendung — und die setzt Produktionszugang voraus.

### Voraussetzungen für „echte Live-App“ konkret

- **Login für anonyme Besucher:** in keinem der Produkte vorgesehen. Wer einer anonymen Öffentlichkeit
  die laufende App zeigen will, muss selbst einen Gast-/Demo-Mandanten mit Auto-Login bauen.
- **Proxy:** kein Anbieter arbeitet im Auslieferungspfad als Proxy vor der echten App. Aufgenommen
  wird per Chrome-Erweiterung, ausgeliefert wird aus dem eigenen CDN.
- **Read-only-Erzwingung:** wird von keinem Anbieter als Mechanismus beworben. Reprise Replicate
  argumentiert stattdessen mit Isolation („keine Kollisionen durch gleichzeitige Nutzer“), also
  Trennung statt Schreibsperre.

### Aufnahme und Neu-Aufnehmen

Alle Snapshot-Anbieter nehmen per **Chrome-Erweiterung** auf, nicht per Proxy. Storylane bietet drei
Modi: *Single capture* (Seite für Seite manuell), *Continuous capture* (automatisch beim
Durchklicken), *Timed capture* (je Seite nach 3-Sekunden-Countdown).

Zur Frage „wie oft muss man neu aufnehmen“ gibt es **keine belastbare Herstellerangabe**. Die
offizielle Doku sagt dazu nichts; die Marketing-Texte behaupten, Texte/Zahlen/Diagramme ließen sich
im Editor ändern, sodass man nicht jede Seite neu aufnehmen müsse — und dass bei
**Struktur**-Änderungen einzelne Screens neu erfasst und in die bestehende Demo eingesetzt werden
können. Walnuts Aussage „When your product ships updates, your demos reflect them instantly. No
re-capturing“ ist eine **Anbieter-Behauptung auf der eigenen Website** und widerspricht der
Snapshot-Architektur; sie ist nicht verifiziert und passt nicht zu dem, was hier messbar ist.

**Der Messwert aus diesem Fall ist deutlicher als jede Doku-Aussage:** die 23 Dateien der
Hostaway-Demo sind seit dem **20.08.2025** unverändert, zeigen Buchungsdaten aus **April 2025** bzw.
**Januar 2024** und wurden in **einem Upload-Vorgang** erzeugt. Wer nicht neu aufnimmt, zeigt Stand
Aufnahmetag — dauerhaft.

---

## Was das für myNextDays bedeutet

1. Eine „interaktive Produkt-Demo“ dieser Klasse ist ein **Redaktions-Artefakt mit Verfallsdatum**,
   kein Live-Zugang. Sie muss wie Dokumentation gepflegt werden, sonst zeigt sie in einem Jahr
   „heute“ von vorletztem Frühjahr — genau der Fehlertyp aus **Wurzel 5b** (fremde Uhr ≠ eigene
   Uhr), nur in der Marketing-Oberfläche.
2. Wer stattdessen die echte Anwendung zeigen will, braucht **einen eigenen Demo-Mandanten mit
   Auto-Login** (siehe die Demo-Tenants „Nordlicht“/„Seeblick“) und keinen Snapshot-Anbieter. Das ist
   die einzige Variante, die für anonyme Besucher funktioniert — und dann gilt für sie das volle
   Sicherheits-Gate (Wurzel 3/6/9: Mandanten-Scope, `revoke`, Item-Level-Autorisierung), weil ein
   öffentlich erreichbarer Login ein realer Angriffsvektor ist.
3. Der Snapshot-Weg hat einen echten Vorteil, der nichts mit „Live“ zu tun hat: er kann **keine
   Kundendaten leaken und nichts kaputtmachen**, weil er nichts mit dem Backend verbindet. Das ist
   der Grund, warum Hostaway ihn nutzt.

---

## Reproduktion

```bash
# 1. Alle Seiten-URLs aus dem Player holen
curl -s --compressed 'https://hostaway.storylane.io/demo/ppbjuji5fzqg?page_id=1c499c95-c4fb-43f4-8731-8326529aefcc' \
  | grep -oE 'app-pages\.storylane\.io/company[^"'"'"' \\]*\.html' | sort -u

# 2. Auslieferung prüfen (erwartet: 200, AmazonS3, identisches last-modified)
while read p; do curl -sI "https://$p" | egrep -i '^(HTTP|server|last-modified|content-length)'; done < pages.txt

# 3. Snapshot-Natur prüfen (erwartet: 0-1 script, kein stylesheet-link, data:-Bilder)
curl -s --compressed "https://$(head -1 pages.txt)" -o p.html
grep -o '<script' p.html | wc -l; grep -o '<style' p.html | wc -l
grep -oE 'src="https?://[^"]*"' p.html | wc -l
grep -o 'data:image/[a-z+]*;base64' p.html | sort | uniq -c
```

Im Browser (Konsole, Top-Frame der Share-Seite):

```js
// Inhalts-Frame: Skripte und Subressourcen zählen
const d = document.querySelector('iframe').contentDocument.querySelector('iframe').contentDocument;
({scripts: d.scripts.length, styles: d.querySelectorAll('style').length,
  res: d.defaultView.performance.getEntriesByType('resource').length});
// -> {scripts: 0, styles: 64, res: 0}

// Woher der Inhalt kommt
await caches.keys();   // -> ['demoplayer-html-documents-v2', 'demoplayer-html-substituted']
```
