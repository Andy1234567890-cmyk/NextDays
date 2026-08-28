# Website-Baukasten — Nachprüfung vom 27.08.2026

Nachprüfung der 19 Behebungen und der drei offenen Aufträge aus
`docs/BAUKASTEN-PRUEFBERICHT-2026-08-27.md`.

| | |
|---|---|
| **Wann** | 27.08.2026, ca. 09:55–13:15 Uhr |
| **Womit** | Claude in Chrome (echter Browser). Kein Playwright. Laufzeitmessungen als JavaScript IN der Seite. |
| **Tenant** | AirSmil, Startseite `d53e253d-043a-46dc-8f51-336bff5e1702` |
| **Dashboard** | `http://localhost:3000` — lief |
| **Renderer** | `http://localhost:3200` — lief |
| **API** | `http://localhost:8000` — lief (`/health` = 200) |
| **Fensterbreite** | 1600 × 1000 px (Ausnahmen bei B9 vermerkt) |

Nichts am Code geändert. Datenänderungen zum Prüfen wurden im selben Durchlauf
zurückgesetzt — Endstand am Schluss des Berichts.

Zwei Randbedingungen, die im ganzen Bericht mitgelesen werden müssen:

* **Die Sitzung lief gegen 12:20 Uhr ab.** Der Nutzer hat sich selbst neu
  angemeldet; danach wurden B8, B9 und D6 nachgeholt.
* **Die „1 Issue"-Blase von React** stammt in JEDEM Fall aus der
  Tag-Assistant-Browsererweiterung (`data-tag-assistant-prod-present` am
  `<html>` des Renderers), nicht aus dem Code. Kein einziger Hydration-Fehler
  mit der Signatur aus B6 („server rendered text didn't match") ist aufgetreten.

---

## Ergebnistabelle

| Punkt | Ergebnis |
|---|---|
| A1 Rückgängig | **TEILWEISE** |
| A2 Sprachwechsel schaltet den Inspektor mit | **BEHOBEN** |
| B1 Theme-Menüspalte zeigt Wörter statt IDs | **TEILWEISE** |
| B2 Roher i18n-Schlüssel auf `/website/einstellungen/erweitert` | **BEHOBEN** |
| B3 Roher Schlüssel in Blog → Layouts | **BEHOBEN** |
| B4 Schalter „Kontaktformular anzeigen" | **BEHOBEN** (Absendeweg s. u.) |
| B5 Anschrift mit sichtbarem `\n` | **BEHOBEN** |
| B6 Hydration-Fehler (Serverzahl ≠ Clientzahl) | **BEHOBEN** |
| B7 SEO nennt zwei verschiedene Zahlen | **BEHOBEN** |
| B8 Seitenliste unterscheidet Seitentypen | **BEHOBEN** |
| B9 Burger-Menü auf dem Handy | **TEILWEISE** |
| C1 URL folgt dem Panel | **BEHOBEN** |
| C2 „Mehr" ist keine Sackgasse mehr | **TEILWEISE** |
| C3 Toter Link `/website/seo/uebersicht` | **BEHOBEN** |
| C4 Design-Unterpunkte verlassen den Editor | **TEILWEISE** |
| D1 Reiter heißt „Design" | **BEHOBEN** |
| D2 Werkzeugleiste verdeckt das Menü der Vorschau | **BEHOBEN** |
| D3 Vorschau scrollt nicht mit dem Mausrad | **NICHT PRÜFBAR** (Messartefakt bewiesen, s. eigener Abschnitt) |
| D4 Auswahl aus dem Ebenen-Baum scrollt mit | **TEILWEISE** |
| D5 Nacktes `<select>` auf `/website/vorlagen` | **BEHOBEN** |
| D6 Erster Klick aufs „+" wirkungslos | **NICHT BEHOBEN** — jetzt reproduzierbar, Ursache gefunden |
| D7 Blog-Panel schiebt sich sichtbar herein | **NICHT BEHOBEN** — die Annahme des Berichts ist **widerlegt** |

---

## Die Punkte, die nicht glatt BEHOBEN sind

### A1 — Rückgängig: TEILWEISE

**Adresse:** `http://localhost:3000/website/seiten/d53e253d-043a-46dc-8f51-336bff5e1702`

**Was jetzt funktioniert (der Kern des Datenverlusts ist weg):**

Abschnitt löschen → ↺ → der Abschnitt ist **zurück, mit derselben DB-ID und mit
seinem Inhalt**. Gegenprobe an der API vor und nach dem Klick:

```
vor  dem Löschen : hero 3999185b · contact 8acc5b2a · rich_text 50deee26  ("<p>PRUEFTEXT-A1XY</p>")
nach dem Löschen : hero 3999185b · contact 8acc5b2a
nach ↺           : hero 3999185b · contact 8acc5b2a · rich_text 50deee26  ("<p>PRUEFTEXT-A1XY</p>")
```

Die rote Meldung **„Ein Abschnitt gehört nicht zu dieser Seite." kam nicht mehr**.
Der Speicher-Haken blieb auf „Gespeichert" (`title="Gespeichert"`,
`text-muted-foreground`), der Editor blieb bedienbar, kein „Leave site?".
Auch nach ↺ ↻ ↺ ↻ blieb die Seite bei 3 Abschnitten — **sie wächst nicht**
(Prüfpunkt 3 der Aufgabe: bestanden).

**Was NICHT funktioniert:**

1. **↺ nimmt das Hinzufügen eines Abschnitts nicht zurück.** Zweimal sauber
   reproduziert (Baustein „Button", Baustein „Text"):

   ```
   nach dem Hinzufügen : … button befa36ee, rich_text 7b81005a
   nach ↺              : … button befa36ee, rich_text 116de7c3
   ```

   Der Abschnitt bleibt stehen — und seine DB-Zeile wird dabei **gelöscht und
   unter einer NEUEN ID neu angelegt**. Für den Kunden sieht ↺ aus wie „passiert
   nichts"; in der DB ist es ein Identitätswechsel.

2. **↻ (Wiederholen) wird nie aktiv.** Nach jedem ↺ steht
   `Rückgängig disabled=false, Wiederholen disabled=true` — programmatisch
   ausgelesen. Es gibt also keinen Weg zurück nach vorn.

3. **Nur EIN Schritt ist zurücknehmbar.** Weitere Klicks auf ↺ lösen gar nichts
   mehr aus (kein Request, keine Änderung), obwohl der Knopf aktiv aussieht.

**Ursache (im Code belegt):**
`web/components/website/editor/abschnitts-editor.tsx:846` legt einen neuen
Abschnitt mit `id: null` an. Der Verlauf (`use-verlauf.ts:74-92`) merkt sich
einen Stand nach 700 ms Ruhe, das Autospeichern schickt ihn nach 900 ms und
bekommt erst dann die Server-ID. Damit liegen zwei Stände im Verlauf: einer
OHNE ID und einer MIT. ↺ spielt den Stand ohne ID ein → `replace_blocks` sieht
eine Zeile ohne ID, legt sie NEU an und löscht die alte. Der danach
zurückkommende Stand unterscheidet sich von dem, was `springe()` in
`eigenerSprung` hinterlegt hat (`use-verlauf.ts:68-71`) — der Hook hält ihn
deshalb für eine neue Nutzeränderung, hängt ihn als neuen Schritt an und der
Zeiger steht wieder am Ende. Genau das erklärt beide Symptome: ↻ bleibt tot und
ein zweites ↺ findet nichts mehr.

**Erwartet war:** ↺ entfernt den neuen Abschnitt, ↻ wird aktiv.

---

### B1 — Theme-Menüspalte: TEILWEISE

**Behoben AUSSERHALB des Editors.** `/website/design` und jede
`/website/design/*` zeigen jetzt
„Layout · Farben · Text · Buttonform · Bilder · Breite und Abstand · Logo",
jeweils mit eigenem Symbol. Gegengeprüft in drei Sprachen:

* DE: Layout · Farben · Text · Buttonform · Bilder · Breite und Abstand · Logo
* EN: Layout · Colours · Text · Button shape · Images · Width and spacing · Logo
* DA: Layout · Farver · Tekst · Knapform · Billeder · Bredde og afstand · Logo

**NICHT behoben IM Editor.** Auf
`/website/seiten/<id>?panel=design` steht in derselben Spalte weiterhin
wörtlich:

```
site-layout · farben · text · buttons · bilder · breite-abstand · logo
```

Die Symbole sind dort richtig, nur die Wörter fehlen.
Screenshot: `/var/folders/qq/zg704zg53vdct7h421l2x5w00000gn/T/claude-chrome-screenshots-aBBHQR/screenshot-1787821474709-0.png`

**Ursache (Datei:Zeile):** Es gibt ZWEI `menueBeschriften`-Implementierungen.
`web/components/website/rahmen.tsx:148` schlägt zuerst in
`MENUE_I18N_SCHLUESSEL` nach — das ist die Behebung.
`web/components/website/editor/abschnitts-editor.tsx:1269-1288` ist die Kopie im
Editor und hat diesen Schritt **nicht**; sie geht direkt in die Namensraum-Kette
`menue · editor.gruppe · reiter · seo · einstellungen` und fällt für die sieben
Design-Kennungen auf `return id` zurück.

---

### B4 — Kontaktformular: BEHOBEN, mit einer offenen Stelle im Absendeweg

**1. Schalter AN → Formular in der Vorschau:** ja. Vier Felder mit richtigen
Beschriftungen (nicht „name"/"email"), alle als Pflichtfeld ausgezeichnet:

```
name    text      required  "Ihr Name"      / "Your name"
email   email     required  "Ihre E-Mail-Adresse" / "Your email address"
message textarea  required  "Ihre Nachricht"      / "Your message"
consent checkbox  required  "Ich habe die Datenschutzerklärung gelesen und stimme ihr zu."
                            / "I have read and accept the privacy policy."
Knopf: "Nachricht senden" / "Send message"
```

**2. Schalter AUS → weg:** ja. `document.querySelectorAll('form').length === 0`,
keine Eingabefelder mehr.

**3. Sprache umschalten → Beschriftungen übersetzt:** ja, DE und EN oben
gegenübergestellt.

**4. Absenden:** Der Server antwortet

```
POST /api/v1/site/form?host=localhost
→ 404 {"detail":"Formular nicht gefunden."}
```

Das ist **kein Fehler, sondern die dokumentierte Regel**:
`apps/api/src/features/site_config/weiterleitungen.py:790-799` verlangt, dass
die Seite `is_published = true` ist. Die Startseite von AirSmil ist ein
Entwurf. Ich habe die Website **nicht veröffentlicht**, um die Live-Sichtbarkeit
nicht zu ändern — damit sind reCAPTCHA-Prüfung, Speicherung und Mailversand
**nicht geprüft**. Unter `/website/anfragen` kam folgerichtig keine neue
Einsendung an (dort stehen weiterhin nur `zzz-e2e-render` und
`zzz-e2e-ohnedatei` vom 25.08.).

**5. Ohne Zustimmungshäkchen absenden:** wird abgewiesen. Der Browser blockt
schon vor dem Request (`form.checkValidity() === false`,
`validationMessage: "Klicke dieses Kästchen an, wenn du fortfahren möchtest."`),
und es ging **kein** Request hinaus.

**Randbefund (nur Vorschau, nicht Kundenseite):** Im Renderer-Vorschaumodus
lässt sich das Zustimmungshäkchen gar nicht setzen — weder per Klick auf die
Box noch auf den Text noch per `element.click()`. Ursache:
`builder/components/blocks/canvas-bridge.tsx:258-262` ruft für JEDEN Klick
innerhalb eines Abschnitts `e.preventDefault()` auf, um die Auswahl zu melden.
Auf der ausgelieferten Website ist die CanvasBridge nicht eingebunden (nur in
`builder/app/render/[pageId]/page.tsx:62`), dort ist das Häkchen normal
bedienbar. Für die Prüfung heißt es: **das Formular ist in der Vorschau nicht
ausfüllbar.**

---

### B9 — Burger-Menü: TEILWEISE

**Der Burger ist da und er funktioniert — in allen vier Themes.**
Geprüft im Geräteumschalter auf Handy (390 px):

| Theme | Burger statt gestapelter Liste | Klappt auf | Symbol wird zum Kreuz |
|---|---|---|---|
| klar | ja | ja | ja |
| mitte | ja | ja | ja |
| karte | ja | ja | ja |
| seitlich | ja | *nicht geprüft* (s. u.) | *nicht geprüft* |

Auf dem Desktop steht die waagerechte Liste wie vorher, ohne Burger — geprüft
bei 1600 px in allen Screenshots dieses Berichts.

Auf der **echten Seite** (Renderer-Route, Browserfenster schmal gezogen,
`innerWidth` 500 bzw. 606 px) ist alles in Ordnung: Burger da, klappt auf,
Symbol wird zum Kreuz, und die Links führen ans richtige Ziel — programmatisch
ausgelesen:

```
Startseite → /          Über uns → /ueber-uns          Kontakt → /kontakt
Menü-Rechteck: links 199, rechts 407 bei innerWidth 606  → vollständig im Bild
```

**Was NICHT stimmt:** Bei **390 px** läuft das aufgeklappte Menü nach LINKS aus
dem Bild. Es ist rechtsbündig am Burger verankert und 208 px breit; sitzt der
Burger weit links, beginnt das Menü bei einem negativen x.

* Theme **mitte**: das aufgeklappte Feld ist eine **leere weiße Fläche** — die
  drei Menüpunkte stehen vollständig außerhalb des Bildes.
  Screenshot: `/var/folders/qq/zg704zg53vdct7h421l2x5w00000gn/T/claude-chrome-screenshots-aBBHQR/screenshot-1787824403866-4.png`
* Theme **karte**: die ersten Buchstaben sind abgeschnitten — sichtbar steht
  dort „rtseite / er uns / ntakt".
* Theme **klar**: der Anfangsbuchstabe wird knapp angeschnitten.

Erst ab etwa 500 px CSS-Breite passt das Menü wieder vollständig ins Bild.
Ein echtes Telefon (375–430 px) liegt darunter.

---

### C2 — „Mehr": TEILWEISE

**Die Menüspalte steht jetzt überall.** Geprüft und je einzeln bestätigt:

| Adresse | Spalte mit den sechs Geschwistern | richtiger Eintrag hervorgehoben | Inhalt vollständig sichtbar |
|---|---|---|---|
| `/website/objekte` | ja | Objekte | ja |
| `/website/regeln` | ja | Regeln | ja |
| `/website/anfragen` | ja | Anfragen | ja |
| `/website/widgets` | ja | Widgets | ja |
| `/website/vorlagen` | ja | Vorlagen | ja |
| `/website/einstellungen/erweitert` | ja | Einstellungen ⌃ → Erweitert | ja |

Bei `/website/objekte` steht **keine** leere Panel-Spalte neben dem Inhalt
(Prüfpunkt 4: bestanden). Nichts ist abgeschnitten oder doppelt gerendert.

**Was NICHT stimmt (Prüfpunkt 5):** Auf `/website/einstellungen/*` steht die
Navigation **zweimal nebeneinander**:

1. die Menüspalte (x ≈ 50–190): *Objekte · Regeln · Anfragen · Widgets ·
   Vorlagen · Einstellungen ⌃ → Adresse · Sprachen · Kontakt · Anzeige · Blog ·
   Erweitert*
2. direkt daneben (x ≈ 200–400) die eigene Navigation der Einstellungen:
   *Adresse der Website · Verfügbare Sprachen · Kontakt und soziale Medien ·
   Anzeigeeinstellungen · Blog · Erweitert*

Das ist genau das Muster, das C3 für SEO beseitigt hat (die zweite Navigation in
`seo/rahmen.tsx` wurde entfernt) — für die Einstellungen steht es noch.

---

### C4 — Design-Unterpunkte im Editor: TEILWEISE

**Prüfpunkt 1 (die eigentliche Beschwerde): behoben.** Im Editor „Kopfzeile" in
den Ebenen anklicken → Theme-Panel öffnet sich (`?panel=design`), dann in der
Spalte „site-layout"/„farben"/„logo" anklicken:

* Die Seite bleibt stehen. `location.search` bleibt `?panel=design`,
  `performance.getEntriesByType('navigation')[0].type` bleibt `navigate` vom
  ersten Aufruf — **kein Seitenwechsel**.
* Logo, Seitenwahl, Sprachwähler und Geräteumschalter bleiben stehen.
* Die Vorschau lädt **nicht** neu (kein „Vorschau wird geladen", das Titelbild
  bleibt durchgehend stehen).

**Prüfpunkte 2 und 3: nicht erfüllt.** Ein Klick auf einen Unterpunkt **wechselt
das Panel nicht**. Er setzt nur die Hervorhebung um; im Panel steht weiterhin
die Design-Übersicht (LAYOUT · FARBEN · BUTTONFORM · TEXT · BREITE UND ABSTAND ·
BILDER · LOGO). Nachgestellt:

```
Klick „site-layout" → Hervorhebung site-layout, Panel = Design-Übersicht
Klick „farben"      → Hervorhebung farben,      Panel = Design-Übersicht
Klick „logo"        → Hervorhebung logo,        Panel = zuletzt geöffnetes Unterpanel
```

Der Wechsel funktioniert nur über die Zeilen IM Panel: ein Klick auf das „›"
neben „FARBEN" öffnet den Farben-Editor korrekt und ohne Seitenwechsel. Die
Menüspalte ist damit im Editor eine reine Anzeige.

Nebenbefund: Der Panel-Titel bleibt in diesem Zustand „DESIGN", während
`/website/design/farben` außerhalb des Editors korrekt „FARBEN" mit
Zurück-Pfeil zeigt.

**Prüfpunkt 4: bestanden.** Auf `/website/design` navigieren die Einträge
weiterhin, jeder mit eigener Adresse (`/website/design/farben` usw.), und der
richtige Eintrag ist hervorgehoben.

---

### D4 — Auswahl scrollt die Vorschau mit: TEILWEISE

**Die Mechanik ist da und sie ist richtig gebaut.** Ich habe die
`postMessage`-Aufrufe des Editors an den iframe mitgeschnitten (Proxy auf
`iframe.contentWindow.postMessage`):

```
Klick „Titelbild" in der Abschnittsliste → {type:"scrollTo", id:"3999185b…"}   (richtige DB-ID)
Klick „Text" (letzter Abschnitt)         → {type:"scrollTo", id:"116de7c3…"}   (richtige DB-ID)
```

Der Renderer nimmt sie an: Dieselbe Nachricht von Hand geschickt scrollt die
Vorschau zuverlässig an die richtige Stelle (`[data-block-id]` ist im
gerenderten DOM vorhanden, für alle fünf Abschnitte geprüft).

**Prüfpunkt 2 (kein Sprung bei sichtbarem Abschnitt): erfüllt.** `block:"nearest"`
wirkt: ein Abschnitt, der schon im Bild steht, bewegt nichts. Auch der
Kontakt-Abschnitt (985 px hoch bei 855 px Sichtfeld) bewegt korrekt nichts,
solange er das Sichtfeld überlappt.

**Prüfpunkt 4 (Vorschau markiert denselben Abschnitt wie der Inspektor):
erfüllt** — in allen Durchläufen stimmten Auswahlrahmen, Werkzeugleisten-Text
(„Titelbild bearbeiten" / „Kontakt bearbeiten" / „Text bearbeiten") und
Inspektor überein. Die alte Falle ist zu.

**Prüfpunkt 1 (weit unten liegender Abschnitt): unzuverlässig.** In 3 von 5
Durchläufen sprang die Vorschau korrekt; in 2 Durchläufen bewegte sie sich
innerhalb von 6–8 s gar nicht, obwohl die Nachricht mit der richtigen ID
nachweislich hinausging. Betroffen war beide Male der Sprung **nach OBEN** (aus
dem Seitenende zurück zum Titelbild). Ein Muster, das sicher genug für eine
Ursachenaussage wäre, habe ich nicht gefunden; `behavior:"smooth"` über ~1600 px
dauert außerdem spürbar länger als eine Sekunde, was das Nachmessen erschwert.

---

## Die drei offenen Aufträge

### D3 — Mausrad über der Vorschau: NICHT PRÜFBAR mit diesem Werkzeug

**Kurz:** Der Befund aus dem Prüfbericht ist mit Claude in Chrome nicht
belegbar — und auch nicht widerlegbar. Ich habe bewiesen, dass die Messung
selbst falsch ist.

**Was ich gemessen habe:**

1. **Das Mausrad über der Vorschau bewegt tatsächlich nichts.** An mehreren
   Stellen probiert (über dem Titelbild, über der Kopfzeile, über leerer
   Fläche), mit und ohne ausgewählten Abschnitt. Bild vorher/nachher identisch.

2. **Welches Element bekommt das wheel-Ereignis? Keines im Dashboard.**
   Ein `wheel`-Listener in der Capture-Phase auf `document` UND auf `window`
   der Editor-Seite protokollierte über mehrere Scroll-Versuche
   **null Ereignisse**. Das Ereignis geht also gar nicht an das
   Dashboard-Dokument, sondern in den iframe-Prozess.

3. **Ruft etwas `preventDefault`? Nein.** Im Renderer selbst (als eigener Tab
   geöffnet) protokolliert derselbe Listener das Ereignis mit
   `cancelable:false, defaultPrevented:false` — und die Seite scrollt normal
   (`scrollY 0 → 500`).

4. **Ist der iframe-Inhalt höher als der iframe? Ja, deutlich.**
   Im Renderer-Dokument: `documentElement.scrollHeight = 2443`,
   `clientHeight = 853`, `overflow-y: visible` auf `html` und `body`, kein
   eigener Scroll-Container. Das iframe-Element im Editor ist 1018 × 855 px und
   hängt in einer Kette aus `overflow-hidden`-Containern — der Bildlauf MUSS
   also im iframe stattfinden, und dort ist er möglich.

5. **Der Gegenversuch.** Ich habe per JavaScript einen **nackten `<iframe>`**
   in die Editor-Seite gehängt, der dieselbe Renderer-Adresse OHNE `edit=1`
   lädt — kein Overlay, kein Editor-Code, keine CanvasBridge. Auch dieser
   Kontroll-iframe scrollte auf das synthetische Mausrad **nicht**, obwohl
   dieselbe Adresse als eigener Tab einwandfrei scrollt.

6. **Was stattdessen funktioniert:** Der Scrollbalken am rechten Rand der
   Vorschau lässt sich ziehen und scrollt die Vorschau korrekt. **Bild ab**
   bewegt nichts (die Taste geht an das Dashboard, nicht in den iframe).

**Schluss:** `localhost:3200` und `localhost:3000` sind verschiedene Origins,
der Vorschau-iframe läuft deshalb als eigener Prozess (Site-Isolation). Die
synthetischen Mausrad-Ereignisse dieses Werkzeugs erreichen einen solchen
Fremdprozess nicht — bewiesen durch den Kontroll-iframe. **Jede Aussage über
das Mausrad, die im Browser mit diesem Werkzeug gemessen wurde, ist wertlos —
auch die im ursprünglichen Prüfbericht.**

Was ich mit Gewissheit sagen kann: Am Aufbau liegt es nicht. Kein
`scrolling="no"` am iframe (`sandbox="allow-scripts allow-same-origin
allow-forms allow-popups"`, sonst nichts), kein `overflow:hidden` im Renderer,
kein `preventDefault` auf `wheel`, Inhalt höher als der Rahmen, und der
Scrollbalken tut es. Ob ein echtes Mausrad an einem echten Rechner scrollt,
muss der Nutzer von Hand prüfen — **das ist eine Ein-Minuten-Probe und die
einzige belastbare.**

---

### D6 — Erster Klick aufs „+": NICHT BEHOBEN, aber jetzt reproduzierbar — mit Ursache

**Reproduziert.** Protokoll pro Versuch: Seite neu laden → „Titelbild" in der
Abschnittsliste anklicken (Auswahl) → das „+" über dem Abschnitt anklicken →
programmatisch prüfen, ob der Katalog offen ist.

| Versuch | Klickpunkt (Screenshot) | Katalog geöffnet |
|---|---|---|
| R1 | y = 64 | **nein** |
| R2 | y = 64 | ja |
| R3 | y = 64 | **nein** |
| R4 | y = 64 | **nein** |
| R5 | y = 64 | ja |
| R6 | y = 70 | ja |
| R7 | y = 70 | ja |
| R8 | y = 70 | ja |

In R4 habe ich nach dem Auswahl-Klick zusätzlich gemessen, dass das „+"
tatsächlich existierte (`zwei Knöpfe mit title="Hier einen Abschnitt einfügen"`,
Inspektor offen) — der Klick ging also nicht ins Leere, weil etwas fehlte.

**Ursache, gemessen in der Seite.** Das „+" über dem ERSTEN Abschnitt liegt
teilweise UNTER der Kopfzeile des Editors. Zeile für Zeile mit
`document.elementFromPoint` über die Höhe des Knopfes:

```
oberes „+"   Rechteck y 54 … 78 (24 px hoch)  →  nur 12 von 25 Pixelzeilen treffen den Knopf
unteres „+"  Rechteck y 598 … 622             →     24 von 25 Pixelzeilen treffen den Knopf
```

Bei `y = 60` liefert `elementFromPoint` nicht den Knopf, sondern den
Layout-Container der Kopfzeile. Die obere Hälfte des „+" ist also ein toter
Bereich: der Klick landet, aber nicht auf dem Knopf, und es passiert sichtbar
nichts. Wer eine Spur tiefer trifft, hat Erfolg — genau das Bild „erster Klick
nichts, zweiter Klick öffnet".

Das ist **kein Wackelkontakt und keine Race Condition**, sondern eine
Überlappung. Es betrifft nur das „+" über dem obersten Abschnitt; das „+"
zwischen zwei Abschnitten und unter dem letzten ist vollständig frei
(24/25 Zeilen) und hat in keinem Versuch versagt.

Die Konsole ist bei einem Fehlversuch **leer** — kein Fehler, keine Warnung.

**Nebenbei, dieselbe Wurzel:** Auch andere Bedienelemente direkt unter der
Kopfzeile brauchten in dieser Sitzung wiederholt zwei Klicks (Zeile im
Ebenen-Baum, Papierkorb-Symbol in der Abschnittsliste, Kachel auf
`/website/design/site-layout`). Ob dort dieselbe Überlappung vorliegt, habe ich
nicht einzeln nachgemessen.

---

### D7 — Blog-Panel: die Annahme ist widerlegt

**Deine Annahme war:** die beobachteten ~3 s sind die Ladezeit der Blog-Daten;
das Panel steht schon, bevor sein Inhalt kommt.

**Das stimmt nicht.** Drei Messwerte:

1. **Die CSS-Animation ist tatsächlich 200 ms.** Am Großpanel ausgelesen:

   ```
   Klasse:               absolute inset-y-0 left-[3.75rem] z-30 flex w-3/4 flex-col …
   transitionDuration:   0.2s
   transitionProperty:   transform, translate, scale, rotate
   ```

2. **Der Inhalt ist von der ERSTEN Bildaufnahme an da.** Im ersten Screenshot
   nach dem Aufruf von `/website/blog` stehen bereits „Neuer Beitrag",
   „Nur Entwürfe", „Neueste zuerst" und die Tabellenkopfzeile
   („Status", „Datum"). Es wird also nicht auf Daten gewartet.

3. **Der entscheidende Beweis:** Dieser Betrieb hat **null Blogbeiträge**. Es
   gibt gar keine Daten, auf die man warten könnte — und das Panel steht
   trotzdem sekundenlang falsch.

**Was wirklich passiert:** `/website/blog` ist keine eigene Seite, sondern
leitet in den Editor um — die Adresse lautet danach
`/website/seiten/<id>?panel=blog`. Was man in den ersten ein bis zwei Sekunden
sieht, ist der Editor beim Aufbau: die linke Bereichsleiste ist noch nicht
gerendert, deshalb sitzt das Panel (`left-[3.75rem]`, also 60 px = Breite der
Leiste) bei x = 0 statt bei x = 60, seine Breite (`w-3/4`) rechnet gegen einen
noch nicht endgültigen Container, und der Titel „BLOG" samt erster Spalte steht
links außerhalb des Bildes. Die Vorschau daneben zeigt in dieser Zeit
„Vorschau wird geladen".

Bildfolge (Screenshots unmittelbar nacheinander):

```
t ≈ 0,0 s   Panel bei x = 0, Leiste fehlt, Titel + erste Spalte abgeschnitten,
            Tabellenkopf aber schon da
t ≈ 0,8 s   Panel weiter verschoben, Leiste noch nicht da
t ≈ 1,8 s   richtige Position, Leiste da
t ≈ 4 s     unverändert richtig
```

**Wie lange es wirklich kaputt aussieht: rund 1–2 Sekunden**, nicht 3 s und
nicht 200 ms.

**Grenze der Messung, ausdrücklich:** Ein Zeitgeber IN der Seite überlebt diesen
Vorgang nicht — der Aufruf von `/website/blog` ist ein echter Dokumentwechsel,
der JavaScript-Kontext stirbt nach etwa 800 ms (mein `setInterval` brach dort
ab, 15 Messpunkte statt der erwarteten 300). Die Zeitangabe oben stammt deshalb
aus der Screenshot-Folge und ist auf etwa ±0,5 s genau. Die 200 ms und der
„Inhalt ist von Anfang an da"-Befund sind dagegen exakt.

**Zusatzbefund derselben Sache:** Öffnet man das Blog-Panel aus dem Editor
heraus (Klick auf „Blog" in der Bereichsleiste), passiert dasselbe — auch dort
ist es ein voller Dokumentwechsel, und das Panel stand in einer Messung sogar
**über sieben Sekunden** falsch, bevor es einrastete.

---

## Was ich beim freien Durchklicken NEU gefunden habe

Sortiert nach Schwere.

### 1. Datenverlust-nah — Rückgängig tauscht die Identität eines Abschnitts

Siehe A1. Der Punkt verdient eine eigene Erwähnung, weil er über „↺ tut nichts"
hinausgeht: die DB-Zeile wird gelöscht und unter einer **neuen ID** neu
angelegt. Alles, was auf die alte ID zeigt, zeigt danach ins Leere. Konkret
betroffen ist mindestens der Absendeweg des Formulars: `POST /site/form`
adressiert das Formular über `block_id`
(`apps/api/src/features/site_config/formulare.py:44-63`,
`weiterleitungen.py:770-789`). Eine bereits ausgelieferte Seite mit einem
Formular, dessen Block-ID nach einem ↺ eine andere ist, sendet gegen eine ID,
die es nicht mehr gibt — und bekommt „Formular nicht gefunden." zurück.
**Nicht geprüft**, weil dafür veröffentlicht werden müsste; die ID-Rotation
selbst ist zweimal belegt.

### 2. Falsche Anzeige — `/website/vorlagen` hängt dauerhaft auf „Vorschau wird geladen"

**Adresse:** `http://localhost:3000/website/vorlagen`

Einmal aufgetreten und dann über mehrere Minuten und mehrere Klicks stabil: die
Vorschau blieb bei „Vorschau wird geladen — Einen Moment, die Seite wird
vorbereitet." Das Wechseln der Seite im Auswahlfeld half nicht. Nach einem
späteren, normalen Seitenaufruf war es wieder in Ordnung.

Konsole zum Zeitpunkt des Hängens:

```
TypeError: Failed to fetch
  at fetchServerAction (next/dist/client/components/router-reducer/reducers/server-action-reducer.js:48)
```

Die dahinterliegende API ist gesund — von Hand aufgerufen antwortet sie sofort:

```
POST /api/v1/site-config/templates/agentur/preview-token → 200 {"token":"…"}
```

**Warum es hängen BLEIBT (Datei:Zeile):**
`web/components/website/vorlagen-ansicht.tsx:164-168`

```ts
createTemplatePreviewToken(gewaehlt).then((res) => {
  if (!lebt) return;
  if (res.ok) setToken(res.data.token);
  else setTokenFehler(true);
});
```

Kein `.catch`. Wirft die Server-Action (Netzfehler, abgelaufene Sitzung,
veralteter Action-Bezeichner nach einem Hot-Reload), läuft weder der
Erfolgs- noch der Fehlerzweig. `token` bleibt `null`, `tokenFehler` bleibt
`false` — und die Ansicht zeigt für immer den Ladezustand statt der
vorbereiteten Fehlermeldung („Vorschau nicht möglich"), die direkt darüber
schon programmiert ist. Ein verschluckter Fehler, der als „lädt noch" aussieht
(Wurzel 5).

Nebenbefund zur Ursache des Netzfehlers: die Stapelspur nennt
`next@15.5.19`, während die übrigen Meldungen derselben Seite
`next@15.5.21` nennen — im Reiter lagen also Teile aus zwei Übersetzungsständen
nebeneinander. Das spricht für einen veralteten `.next`-Stand im
Entwicklungsserver, nicht für einen Fehler im Produktcode. Der **fehlende
`.catch` ist trotzdem einer.**

### 3. Falsche Anzeige — B1 im Editor (siehe oben)

Rohe Programm-IDs in der Design-Menüspalte, aber nur innerhalb des Editors.
Datei:Zeile in Abschnitt B1.

### 4. Falsche Anzeige — doppelte Navigation unter `/website/einstellungen/*`

Siehe C2. Zwei Navigationsspalten nebeneinander, die dasselbe anbieten.

### 5. Kaputte Bedienung (nur Vorschau) — Klicks im Kontaktformular werden verschluckt

Siehe B4. `canvas-bridge.tsx:258-262` unterdrückt jeden Klick innerhalb eines
Abschnitts. Auf der Kundenseite nicht vorhanden; in der Vorschau heißt es, dass
der Betrieb sein eigenes Formular nicht ausprobieren kann.

### 6. Beschriftung — Logo und Seitenwahl fehlen außerhalb von Editor und Vorlagen

`/website/vorlagen` hat jetzt (richtig, D5) das myNextDays-Logo links und die
gestaltete Seitenwahl daneben. `/website/design`, `/website/design/*`,
`/website/objekte`, `/website/regeln`, `/website/anfragen`, `/website/widgets`,
`/website/einstellungen/*` und `/website/seo*` haben in derselben Kopfzeile
**gar nichts** — die linke Hälfte ist leer. Drei verschiedene Kopfzeilen für
denselben Bereich.

### 7. Beschriftung — Panel-Titel bleibt „DESIGN"

Siehe C4: im Editor bleibt der Titel „DESIGN", auch wenn darunter der
Farben-Editor steht. Außerhalb heißt derselbe Panel korrekt „FARBEN".

### 8. Nur Entwicklung — Realtime-Abzeichen liegt über dem Knopf

Auf `/website/regeln` überdeckt das Abzeichen „Realtime 0/3" oben rechts den
Knopf „Neue Regel". In Produktion ist das Overlay aus (`RealtimeDebugPanel`),
deshalb hier nur als Notiz.

---

## Ausdrücklich geprüft und in Ordnung

* **A2 in allen vier Prüfschritten.** Kopfzeile DE → English: Der Wähler IM
  Inspektor springt auf „EN · English ✓" mit, die Felder zeigen englischen Text
  („Talk to us"). Umgekehrt genauso. Umschalten IM Inspektor (auf Dansk):
  die Vorschau folgt (`iframe src` trägt `locale=da`), die Oberfläche wird
  dänisch. Und der eigentliche Schaden ist weg: nach dem Umschalten auf EN in
  das Adressfeld getippt, gespeichert, an der API gegengeprüft →
  `{"de":"Hirtshalsvej 21\n9881 Bindslev…","en":"PRUEF-EN-ADRESSE"}`.
  **Die deutsche Fassung blieb unangetastet.**
* **B2** in DE, EN und DA: der Satz steht als Text da
  („Nur `meta`, `link` und `title`. Skripte gehören in das JavaScript-Feld
  unten." / „Only `meta`, `link` and `title`. …" / „Kun `meta`, `link` og
  `title`. …"). Konsole frei von `IntlError`/`UNCLOSED_TAG`.
* **B3**: Blog → Layouts zeigt „Letzte Beiträge" und **„Beitragssuche"**.
* **B5**: Die Anschrift steht in der Vorschau auf **zwei Zeilen**
  („Hirtshalsvej 21" / „9881 Bindslev, Nordjylland, Denmark") und im
  Inspektor-Feld ebenso. In der DB steht Zeichen 15 als Code **10** (echter
  Umbruch), nicht mehr als Backslash+n. Und der Schreibweg: selbst `\n` in ein
  Adressfeld getippt, gespeichert, zurückgelesen → wieder Code 10.
* **B6** auf allen vier genannten Seiten. `/website/einstellungen/erweitert`
  zeigt „8.000"/„20.000" (DE), „8,000"/„20,000" (EN), „8.000"/„20.000" (DA) —
  jeweils server- und clientseitig gleich. `/website/design/farben`,
  `/website/design/logo` und `/website/anfragen` (Datum
  „Dienstag, 25. August 2026 um 07:23") ohne Textabweichung. Kein einziger
  Treffer auf „server rendered text didn't match".
* **B7** in DE, EN und DA: „Gezählt werden nur veröffentlichte Seiten. Der
  Reiter „Seiten" zeigt alle, auch Entwürfe." — und die zwei Zahlen ergeben
  damit Sinn: 4 veröffentlichte Systemseiten ohne Meta-Titel gegenüber 9
  insgesamt (dieselben 4 plus die 5 Entwürfe Startseite · Über uns · Kontakt ·
  Übersicht · test).
* **B8** in allen vier Punkten. Verschiedene Symbole: Haus (Startseite), Blatt
  (Über uns, Kontakt), **Ordner** (Übersicht), **Sprechblase** (test).
  „Übersicht" und „test" sind sichtbar gedimmt. Der Tooltip lautet wörtlich
  **„Diese Seite erscheint nicht im Menü der Website."** Damit erklärt die Liste
  den Unterschied zur gerenderten Kopfzeile (dort drei Punkte: Startseite ·
  Über uns · Kontakt).
* **C1** in allen sechs Punkten. Jeder Bereichswechsel schreibt die Adresse:
  `?panel=hinzufuegen`, `?panel=seiten`, `?panel=ebenen`, `?panel=blog`,
  `?panel=design`. Panel schließen (✕) → der Parameter verschwindet.
  „Kopfzeile" in den Ebenen → `?panel=design`. Adresse in einem neuen Aufruf →
  dieselbe Ansicht. F5 → das Panel bleibt offen. Zurück-Knopf → springt durch
  die Panels (design → blog → …), nicht aus dem Editor.
* **C3** vollständig. `/website/seo` zeigt die Menüspalte mit hervorgehobener
  „Übersicht", **einmal** (die zweite SEO-Navigation ist weg). Alle sechs
  Unterpunkte durchgeklickt: Übersicht → `/website/seo` (kein 404),
  KI-Profil → `/website/seo/ki`, Seiten → `/website/seo/seiten`,
  Schema → `/website/seo/schema`, Messung → `/website/seo/messung`,
  Weiterleitungen → `/website/seo/weiterleitungen` — jeweils richtige Seite und
  richtiger Eintrag hervorgehoben.
* **D1**: Die Bereichsleiste zeigt auf Deutsch „Design".
* **D2**: Beim obersten Abschnitt (Titelbild) sitzt die schwebende Leiste jetzt
  **unter** der Kopfzeile der Vorschau. „Startseite · Über uns · Kontakt" sind
  vollständig lesbar. Beim Kontakt-Abschnitt (Mitte/unten) sitzt die Leiste über
  dem Abschnitt und überdeckt nichts. Einzige Restüberlappung: die Unterkante
  des Knopfes „Jetzt buchen" wird von der Leiste um wenige Pixel angeschnitten —
  die Beschriftung bleibt lesbar.
* **D5**: `/website/vorlagen` hat jetzt links das myNextDays-Logo und daneben
  dieselbe gestaltete Seitenwahl wie der Editor. Sie klappt auf (Startseite ·
  Über uns · Für Eigentümer · Kontakt · Impressum · Datenschutz · AGB ·
  Widerruf · Cookie-Richtlinie), schließt bei der Auswahl und übernimmt die
  Seite in die Kopfzeile. Kein Sprachwähler — wie beabsichtigt. Das nackte
  `<select>` ist weg.
* **Kanten, die beim Prüfen mitliefen:** Abschnitt hinzufügen landet an der
  richtigen Stelle; Löschen entfernt sofort in Vorschau und DB; Auswahl in der
  Vorschau und im Ebenen-Baum treffen denselben Abschnitt; der Geräteumschalter
  ändert die Vorschaubreite tatsächlich; das Speicher-Zeichen steht durchgehend
  auf „Gespeichert".

---

## Nicht geprüft

* **Abschnitte per Ziehen umsortieren** und die Pfeile ↑/↓ — Drag & Drop ist mit
  diesem Werkzeug nicht verlässlich nachstellbar.
* **„Veröffentlichen"** und die Entwurfs-Vorschau — hätte die Website live
  geschaltet. Deshalb bleibt auch der **vollständige Absendeweg des
  Kontaktformulars** (reCAPTCHA, Speicherung, Bestätigungsmail) ungeprüft; der
  Server lehnt Einsendungen auf unveröffentlichte Seiten ab.
* **Objekt-Schalter auf `/website/objekte`** — hätte die Sichtbarkeit von 18
  echten Objekten geändert.
* **Seite anlegen / löschen / umbenennen, Vorlage anwenden** — hätte den
  Bestand überschrieben.
* **„Cookie-Hinweis einschalten"** und die Schalter unter „Strukturierte Daten"
  — sie ändern die ausgelieferte Website.
* **CSV-Import bei den Weiterleitungen, RSS-Import im Blog.**
* **B9 Theme „seitlich" im aufgeklappten Zustand** und **B9 Theme „mitte" auf
  der echten schmalen Seite** — beides hätte einen weiteren Wechsel des
  Live-Themes gebraucht; das Theme steht am Ende wieder auf „klar", und ich
  wollte es nicht erneut anfassen.
* **B9 bei exakt 390 px auf der echten Seite** — das Browserfenster ließ sich
  nicht unter etwa 500 px CSS-Breite bringen. Der Befund stammt aus dem
  Geräteumschalter (der bei 390 px rendert) und aus der Rechnung
  (Menübreite 208 px, rechtsbündig am Burger).
* **Andere Sprachen als DE, EN und DA.**
* **Das Mausrad über der Vorschau** — siehe D3: mit diesem Werkzeug nicht
  messbar.

---

## Endstand der Daten

| Was | Geändert zum Prüfen | Zurückgesetzt | Stand jetzt |
|---|---|---|---|
| Abschnitte der Startseite | 3 Text-/Button-Abschnitte angelegt (A1, D4, D6) | ja, alle drei gelöscht | **2/60: `hero` 3999185b · `contact` 8acc5b2a** |
| Kontakt · Adresse (EN) | „PRUEF-EN-ADRESSE", dann „Zeile1\nZeile2" (A2, B5) | ja, Feld geleert | **`{"de":"Hirtshalsvej 21\n9881 Bindslev, Nordjylland, Denmark"}`** — nur DE, mit echtem Umbruch, wie vorher |
| Kontakt · „Kontaktformular anzeigen" | aus und wieder an (B4) | ja | **an (`show_form: true`)** |
| Theme | mitte, karte, seitlich (B9) | ja | **`klar`** |
| Oberflächensprache (`nd_locale`) | en, da (B1, B2, B7) | ja | **de** |
| Blog-Beiträge, Seiten, Weiterleitungen, Objekte | nichts geändert | — | unverändert |
| Formular-Einsendungen | Absendeversuch endete mit 404 | — | keine neue Einsendung unter `/website/anfragen` |

Die Startseite trägt am Ende dieselben zwei Abschnitte mit denselben IDs und
demselben Inhalt wie zu Beginn.
