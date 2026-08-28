# Website-Baukasten — Prüfbericht vom 27.08.2026

Geprüft im echten Browser (Claude in Chrome) gegen `http://localhost:3000/website/*`
(Dashboard) und `http://localhost:3200` (Renderer im Vorschau-iframe).
Tenant: **AirSmil**, Startseite `d53e253d-043a-46dc-8f51-336bff5e1702`.

Nichts am Code geändert. Die eine Datenänderung, die zum Prüfen nötig war
(ein Text-Abschnitt auf der Startseite), wurde im selben Durchlauf wieder
entfernt — Endstand ist wie vorher: `hero` + `contact`, 2/60 Abschnitte.

Sortiert nach Schwere: **Datenverlust → falsche Anzeige → kaputte Adresse → Beschriftung**.

---

## A — Datenverlust

### A1. Rückgängig ist vollständig funktionslos, sobald ein Abschnitt dazukam oder wegfiel

**Adresse:** `http://localhost:3000/website/seiten/d53e253d-043a-46dc-8f51-336bff5e1702`

**Schritte:**
1. Abschnitts-Panel öffnen, „+" über dem Titelbild anklicken → Katalog öffnet sich.
2. „Text" anklicken → Textblock landet korrekt an erster Stelle (3/60).
3. Auf ↺ (Rückgängig) in der Kopfzeile klicken. Drei Mal wiederholt.
4. Gegenprobe per API: `GET /api/v1/site-config/pages/<id>/blocks`

**Was passiert:**
- Nach jedem Klick auf ↺ steht der Block weiter in der Vorschau **und in der DB**:
  `["rich_text","hero","contact"]`.
- ↺ bleibt dunkel (aktiv), ↻ (Wiederholen) bleibt ausgegraut — der Zeiger im
  Verlauf bewegt sich also gar nicht.
- Nach dem Löschen eines Abschnitts und anschließendem ↺ erscheint eine rote
  Meldung: **„Ein Abschnitt gehört nicht zu dieser Seite."**
- Danach steht der Editor dauerhaft im Fehlerzustand: der Speicher-Haken wird
  zum roten Warndreieck, jeder weitere Speicherversuch scheitert, und der
  Browser blockt das Verlassen der Seite mit „Leave site?" — die Arbeit lässt
  sich weder speichern noch sauber verwerfen.

**Was ich erwartet habe:** ↺ nimmt den Schritt zurück (Block weg), ↻ wird aktiv.

**Ursache (im Code belegt):**
`apps/api/src/features/site_config/bloecke.py:480-493` — der Replace-Endpunkt
weist **jede** gesendete Zeile ab, deren `id` gerade nicht auf der Seite liegt:

```python
if item.id not in vorhanden:
    raise SiteConfigError("Ein Abschnitt gehört nicht zu dieser Seite.", status_code=400)
```

Rückgängig spielt einen FRÜHEREN Stand ein — der trägt zwangsläufig die ID
eines inzwischen gelöschten Blocks (bzw. der neue Block fehlt darin). Der
Server lehnt die ganze Nutzlast ab, also wird **nichts** zurückgenommen.
Der Verlauf selbst (`web/components/website/use-verlauf.ts`) ist in Ordnung;
er kann nur nicht speichern.

**Warum das Datenverlust ist:** Löschen eines Abschnitts fragt **nicht** nach.
Der Kommentar in `use-verlauf.ts:6-10` nennt genau das als Begründung dafür,
dass es Rückgängig gibt („Wer einen Abschnitt löscht, hat ihn 900 ms später
gelöscht, und der einzige Rückweg war, ihn neu anzulegen"). Dieser Rückweg
existiert nicht. Ein versehentlich gelöschter Abschnitt samt Inhalt in 24
Sprachen ist unwiederbringlich.

---

### A2. Sprachwechsel schaltet Vorschau und Oberfläche, aber NICHT den Inspektor

**Adresse:** `http://localhost:3000/website/seiten/<id>`

**Schritte:**
1. In der Vorschau den Titelbild-Abschnitt anklicken → Inspektor rechts öffnet
   sich, Wähler darin steht auf „DE · Deutsch", Felder tragen deutschen Text.
2. Oben in der Kopfzeile auf die Flagge „DE" klicken → „English" wählen.

**Was passiert:**
- Vorschau wechselt korrekt auf Englisch („WELCOME TO THE MOUNTAINS",
  „Check availability").
- Die ganze Oberfläche wechselt auf Englisch (Add · Pages · Layers · Design …).
- **Der Inspektor bleibt auf „DE · Deutsch" stehen** und zeigt weiter
  „Willkommen in den Bergen", „Bergchalet Nordlicht", „Verfügbarkeit prüfen".
- Umgekehrt genauso: von EN zurück auf DE → Vorschau deutsch, Inspektor „EN · English".
- Erst wenn man den Abschnitt abwählt und neu anklickt, zieht der Inspektor nach.

**Was ich erwartet habe:** Beides zugleich — genau das steht als Vorgabe im Code:

> `web/components/website/editor/abschnitts-editor.tsx:212-216`
> „`locale` — die Sprache des INHALTS, also welche Sprachfassung die Vorschau
> zeigt und der Inspektor bearbeitet. Sie ist umschaltbar … und geht an BEIDE
> Stellen zugleich — getrennte Zustände hießen: der Kunde tippt in der Vorschau
> auf Dänisch und im Formular auf Deutsch."

**Ursache:** `web/components/website/editor/abschnitt-inspektor.tsx:113`

```ts
const [sprache, setSprache] = useState(uiLocale);
```

Der Inspektor liest die Sprache **einmal beim Mounten** aus `useLocale()` und
führt sie danach nie nach. Er bekommt die aktive Inhaltssprache auch gar nicht
als Prop. Der Editor gibt sie nicht weiter.

**Warum das Datenverlust ist:** Wer nach dem Umschalten in die sichtbar
englische Vorschau hinein tippt, schreibt in die **deutsche** Fassung und
überschreibt sie. Nichts in der Oberfläche warnt davor — der Wähler im
Inspektor ist klein und steht neben dem Abschnittsnamen.

---

## B — Falsche Anzeige

### B1. Theme-Menüspalte zeigt rohe Programm-IDs statt Beschriftungen

**Adresse:** `http://localhost:3000/website/design` (und jede `/website/design/*`)

**Was zu sehen ist:** Die Spalte zwischen Leiste und Panel listet wörtlich

```
· site-layout
· farben
· text
· buttons
· bilder
· breite-abstand
· logo
```

kleingeschrieben, mit Bindestrich, und jede Zeile trägt statt eines Symbols den
Platzhalter-Punkt (`ph:dot-outline`). Das Panel daneben heißt korrekt „LAYOUT",
„FARBEN", „BREITE UND ABSTAND" — die Spalte und ihr eigenes Panel sagen also
Verschiedenes.

**Was ich erwartet habe:** „Site-Layout · Farben · Text · Buttons · Bilder ·
Breite & Abstand · Logo", jeweils mit Symbol.

**Ursache:** `web/components/website/rahmen.tsx:139-160` sucht die Beschriftung
in genau fünf Namensräumen: `menue`, `editor.gruppe`, `reiter`, `seo`,
`einstellungen`. Die Design-Wörter liegen aber unter `website.design.*`
(`layoutTitel`, `farbenTitel`, `breiteTitel`, …). Kein Treffer → `return id`.
Zusätzlich fehlen alle sieben in `MENUE_SYMBOL` (`reiter.ts:322-341`), deshalb
der Punkt.

Geprüft in `web/messages/de.json`: unter `website.menue` gibt es keine
Schlüssel `site-layout`/`farben`/`text`/`buttons`/`bilder`/`breite-abstand`/`logo`.

---

### B2. „Erweitert" zeigt einen rohen i18n-Schlüssel auf dem Bildschirm

**Adresse:** `http://localhost:3000/website/einstellungen/erweitert`

**Was zu sehen ist:** Unter der Überschrift „HTML für den Seitenkopf" steht als
Hilfetext wörtlich

```
website.einstellungen.erweitert.headHtmlHinweis
```

**Konsole:**
```
IntlError: INVALID_MESSAGE: UNCLOSED_TAG
(Nur <meta>, <link> und <title>. Skripte gehören in das JavaScript-Feld unten.)
  at ErweitertLeiste (components/website/einstellungen/erweitert-leiste.tsx:291)
```

**Ursache:** Der Text enthält `<meta>`, `<link>`, `<title>`. next-intl liest
alles in spitzen Klammern als Rich-Text-Tag; ohne schließendes Gegenstück wirft
es `UNCLOSED_TAG` und rendert den Schlüsselpfad. Der Schlüssel ist **vorhanden
und übersetzt** — er lässt sich nur nicht rendern.

**Reichweite:** in **allen 24** Sprachdateien (`web/messages/*.json`,
`website.einstellungen.erweitert.headHtmlHinweis`). Ein Scan über die gesamte
`de.json` zeigt: das ist der **einzige** Schlüssel mit einem öffnenden Tag ohne
Gegenstück; alle anderen (`<agb>…</agb>`, `<strong>…</strong>`, `<plus>…</plus>`)
sind saubere Paare.

**Verwendung:** `web/components/website/einstellungen/erweitert-leiste.tsx:188`

---

### B3. Blog → Layouts zeigt einen rohen i18n-Schlüssel

**Adresse:** `http://localhost:3000/website/blog` → im Großpanel links „Layouts"

**Was zu sehen ist:** Unter „Bausteine für Beitragslisten" steht

```
▤ Letzte Beiträge              über „Hinzufügen"
🔍 website.abschnitte.search_posts   über „Hinzufügen"
```

**Ursache:** `web/components/website/blog/blog-layouts.tsx:34` + `:97`

```ts
const LISTEN_BAUSTEINE = ["posts", "search_posts"] as const;
...
{t(`abschnitte.${typ}`)}
```

Der Blocktyp heißt `search_posts` (snake_case), der i18n-Schlüssel heißt aber
`website.abschnitte.searchPosts` (camelCase — belegt in allen 24 Sprachdateien).
`posts` fällt nicht auf, weil dort Typ und Schlüssel zufällig gleich heißen.

---

### B4. Schalter „Kontaktformular anzeigen" ist eine Attrappe

**Adresse:** `http://localhost:3000/website/seiten/<id>` → Kontakt-Abschnitt
anklicken → Inspektor rechts

**Was zu sehen ist:** Schalter „Kontaktformular anzeigen", eingeschaltet.
In der Vorschau **und auf der ausgelieferten Seite** gibt es kein Formular —
nur Überschrift, E-Mail, Telefon, Anschrift.

**Ursache:** `builder/components/blocks/simple-blocks.tsx:113-152` — `ContactBlock`
liest `headline`, `email`, `phone`, `address`. `content.show_form` kommt darin
**nicht vor**, und es gibt kein Formular-Markup im Kontakt-Block.

Das Feld existiert überall sonst:
- Katalog/Inspektor: `web/components/website/abschnitte.ts:720`
- Pydantic-Schema: `apps/api/src/features/site_config/block_inhalte.py:186`
- Vorlagen setzen es: `templates.py:236, 546, 768, 1246, 1283, 1320`,
  `templates_rechtliches.py:79`

Nur der Renderer kennt es nicht. Ein-/Ausschalten hat keinerlei Wirkung
(Wurzel 4 — ein Bedienelement ohne Deckung).

---

### B5. Anschrift erscheint auf der Kundenseite mit sichtbarem `\n`

**Adresse:** Vorschau der Startseite, Kontakt-Abschnitt

**Was zu sehen ist**, sowohl in der Vorschau als auch im Inspektor-Feld:

```
Hirtshalsvej 21\n9881 Bindslev, Nordjylland, Denmark
```

**Gegenprobe an der API:**
`GET /api/v1/site-config/pages/<id>/blocks` liefert
`{"de":"Hirtshalsvej 21\\n9881 Bindslev, Nordjylland, Denmark"}` — der
gespeicherte Wert enthält also die **zwei Zeichen** Backslash + n, keinen
Zeilenumbruch.

**Was ich erwartet habe:** zwei Zeilen. Der Renderer setzt dafür extra
`whitespace-pre-line` (`simple-blocks.tsx:146`), und der Erzeuger im Backend
verbindet mit einem echten Zeilenumbruch
(`apps/api/src/features/site_config/konto_daten.py:96`, byteweise geprüft:
`"\n".join(zeilen)`).

**Nicht geprüft:** wo die Escape-Sequenz entsteht (Schreibpfad, KI-Assistent
oder Altbestand). Der Fehlerzustand selbst ist reproduzierbar und für den Gast
sichtbar.

Zur Gegenprobe: dieselbe Anschrift steht auf
`/website/einstellungen/kontakt` korrekt als
„Hirtshalsvej 21, 9881 Bindslev, Nordjylland, Denmark" — diese Seite baut sie
aus den Einzelfeldern des Firmenprofils zusammen und liest den Block gar nicht.

---

### B6. Hydration-Fehler: Serverzahl ≠ Clientzahl (das „1 Issue"-Abzeichen)

**Adresse:** `http://localhost:3000/website/einstellungen/erweitert`

**Konsole:**
```
Error: Hydration failed because the server rendered text didn't match the client.
  <span className="self-end text-xs text-muted-foreground">
+   8.000
-   8,000
```

**Ursache:** `web/components/website/einstellungen/erweitert-leiste.tsx:67`

```ts
{rest.toLocaleString()}
```

Ohne Locale-Argument: Node nimmt seine Systemvorgabe (`8,000`), der Browser die
Nutzer-Locale (`8.000`). React verwirft daraufhin den Teilbaum und rendert ihn
neu.

---

### B7. SEO nennt zwei verschiedene Zahlen für dieselbe Frage

**Adressen:** `/website/seo` (Übersicht) gegen `/website/seo/seiten`

| Ansicht | Aussage |
|---|---|
| Übersicht → „Was noch fehlt" | **4 Seiten** ohne Meta-Titel · 4 ohne Meta-Beschreibung |
| Seiten | **9 Seiten** ohne Titel oder Beschreibung, Knopf „Für alle Seiten erzeugen (9)" |

**Ursache:** `apps/api/src/features/site_config/seo.py:222-225` zählt bewusst
nur `is_published = true`; `weiterleitungen.py:553-559` ebenso. Der Reiter
„Seiten" listet alle. Beides ist für sich begründet — nur sagt die Oberfläche
das nirgends, und die vier gemeldeten sind ausgerechnet die Systemseiten
(`/inserat/[id]`, `/checkout/[id]`, `/checkout/abgeschlossen`, `/blog`), an
denen ein Betrieb wenig ändern kann und will.

---

### B8. Die Seitenliste unterscheidet keine Seitentypen — „Kopfzeile" stimmt nicht mit dem Menü überein

**Adresse:** `/website/seiten/<id>?panel=seiten`

**Was zu sehen ist:** Unter „Kopfzeile" stehen fünf Seiten:
Startseite · Über uns · Kontakt · Übersicht · test — alle mit demselben
Blatt-Symbol.

Die gerenderte Kopfzeile der Website zeigt **drei**: Startseite · Über uns · Kontakt.

**Warum:** `GET /api/v1/site-config/pages` zeigt
`Übersicht` = `page_type: "folder"` (leerer Ordner) und `test` = `page_type: "popup"`.
Der Renderer lässt beide zu Recht weg
(`apps/api/src/features/site_config/seiten.py:434-471`: Pop-ups und leere Ordner
raus). Die Liste im Editor sagt darüber nichts.

**Zusätzlich:** `web/components/website/seiten/seiten-leiste.tsx:432-433` kennt
nur zwei Symbole:

```tsx
icon={seite.is_home ? "ph:house-fill" : "ph:file"}
```

Ordner, Pop-up, externer Link und 404 sehen alle aus wie eine normale Seite —
obwohl `neue-seite.tsx:31-32` die passenden Symbole (`ph:folder`,
`ph:chat-centered-dots`) bereits führt.

---

### B9. Mobile Vorschau: die Website hat kein Burger-Menü

**Adresse:** Editor → Geräteumschalter auf Handy (390 px)

**Was zu sehen ist:** Die Menüpunkte stapeln sich untereinander neben dem Logo
und laufen aus der Kopfzeile heraus; „Kontakt" sitzt auf der Unterkante.

**Ursache:** `builder/components/site-header.tsx:396-419` (Theme „klar",
Standard) — `<div className="… flex h-20 …">` mit fester Höhe, darin
`NavLinks` mit `flex flex-wrap` (`:150`). Kein Umschlagen in ein Menü, keine
Breakpoint-Behandlung. Nur das Theme „seitlich" hat überhaupt eine Schwelle
(`min-[68.125rem]`).

Aktuell fällt es kaum auf, weil nur drei Punkte im Menü stehen. Mit fünf oder
sechs ist die Kopfzeile auf dem Handy kaputt.

---

## C — Kaputte Adresse

### C1. Im Editor folgt die URL dem Panel nicht — kein Link ist verschickbar

**Adresse:** `http://localhost:3000/website/seiten/<id>?panel=…`

**Schritte und Ergebnis (jedes einzeln nachgestellt):**

| Handlung | URL danach | tatsächlich sichtbares Panel |
|---|---|---|
| `/website/ebenen` aufrufen | `…?panel=ebenen` | Ebenen ✔ |
| dort „Kopfzeile" anklicken | `…?panel=ebenen` | **THEME** ✘ |
| `/website/blog` aufrufen | `…?panel=blog` | Blog ✔ |
| Blog-Panel schließen (✕) | `…?panel=blog` | **ABSCHNITTE** ✘ |

Programmatisch bestätigt:
`{"url":"…?panel=ebenen","panelTitel":"THEME"}`

**Ursache:** `web/components/website/editor/abschnitts-editor.tsx:281, 383-395`

```ts
const [panel, setPanel] = useState<PanelId>(null);
...
const panelVerbraucht = useRef(false);
useEffect(() => {
  if (panelVerbraucht.current || !panelWunsch) return;
  panelVerbraucht.current = true;
  ...
```

`?panel=` wird **einmal beim Mounten gelesen** und danach nie zurückgeschrieben.
Folgen: ein weitergegebener Link öffnet nicht die Ansicht, die der Absender
sah; der Zurück-Knopf des Browsers springt nicht durch die Panels, sondern aus
dem Editor heraus; ein Neuladen wirft den Panel-Stand weg.

Genau das ist die Begründung, mit der `reiter.ts:1-12` die Reiter überhaupt zu
Pfaden gemacht hat („wer einem Kollegen ‚schau dir mal die Domain-Einstellung
an' schicken will, braucht dafür eine Adresse"). Innerhalb des Editors gilt sie
nicht.

---

### C2. „Mehr" ist auf 5 von 6 Bereichen eine Sackgasse

**Adressen:** `/website/objekte`, `/website/regeln`, `/website/anfragen`,
`/website/widgets`, `/website/einstellungen/*` gegen `/website/vorlagen`

**Was passiert:** Auf `/website/vorlagen` steht die versprochene Menüspalte
(Objekte · Regeln · Anfragen · Widgets · Vorlagen · Einstellungen ⌃ →
Adresse · Sprachen · Kontakt · Anzeige · Blog · Erweitert).

Auf `/website/objekte` und `/website/regeln` ist die Leiste links zwar auf
„Mehr" hervorgehoben, **die Spalte fehlt aber ganz**. Da die Leiste selbst
keine Einträge für Regeln, Anfragen, Widgets oder Vorlagen hat, führt von dort
kein sichtbarer Weg zu den Geschwistern.

`/website/anfragen`, `/website/widgets` und `/website/einstellungen/*` zeigen
statt der Spalte ihre je eigene Navigation — drei verschiedene Muster für
denselben Bereich.

**Ursache:** `web/components/website/schale.tsx:354`

```tsx
{breit || !seitenleiste ? (
  <div className="min-h-0 flex-1 overflow-y-auto">{inhalt}</div>
) : ( … MenueSpalte … )}
```

Die Menüspalte wird nur gerendert, wenn die Route **nicht** `breit` ist **und**
eine `seitenleiste` mitgibt. `breit` setzen: `objekte-ansicht.tsx:84`,
`widgets-ansicht.tsx:107`, `anfragen-rahmen.tsx:34`,
`einstellungen/rahmen.tsx:47`, `seo/rahmen.tsx` (via `BaukastenRahmen breit`).
`/website/regeln` gibt keine `seitenleiste` mit.

Der Kommentar in `reiter.ts:236-244` behauptet das Gegenteil:
„Wer auf `/website/objekte` steht, steht für die Leiste also in ‚Mehr'; die
Menüspalte daneben zeigt dann die sechs Geschwister."

**Zusatz:** `REITER_HREF.mehr` zeigt weiterhin auf `/website/objekte`
(`reiter.ts:170`) — der Reiter „Mehr" springt also auf einen fremden Reiter,
ohne das zu sagen. Genau der Punkt aus der Aufgabenstellung; er ist nicht behoben.

---

### C3. Toter Link im Datenmodell: `REITER_MENUE.seo` zeigt auf `/website/seo/uebersicht`

**Ort:** `web/components/website/reiter.ts:398-402`

```ts
seo: SEO_UNTERPUNKTE.map((u) => ({ art: "ziel", id: u,
  href: `${BAUKASTEN_BASIS}/seo/${u}` })),
```

`SEO_UNTERPUNKTE[0]` ist `"uebersicht"`, eine Route
`web/app/(baukasten)/website/seo/uebersicht/` gibt es aber **nicht** —
die Übersicht liegt auf `/website/seo` selbst.

**Aktuell nicht sichtbar**, weil der SEO-Reiter `breit` ist und die Menüspalte
deshalb nie rendert (siehe C2); die zweite, eigene SEO-Navigation
(`seo/rahmen.tsx:52-56`) macht es richtig. Es sind damit zwei Definitionen
derselben Navigation nebeneinander, von denen die eine falsch ist und nur
zufällig nicht gezeigt wird. Sobald C2 behoben wird, ist es ein 404.

Dasselbe Muster bei `/website/seo` selbst: `menueAusPfad("/website/seo")` gibt
`"seo"` zurück, kein Unterpunkt heißt so — es wäre also nie ein Eintrag
hervorgehoben.

---

### C4. Design-Unterpunkte verlassen den Editor

**Adresse:** Editor mit offenem Theme-Panel

**Schritte:** Im Editor „Kopfzeile" in den Ebenen anklicken → Theme-Panel
öffnet sich. In der Menüspalte „farben" anklicken.

**Was passiert:** Vollständiger Seitenwechsel auf `/website/design/farben` —
Logo, Seitenwahl, Sprachwähler und der Abschnitts-Kontext sind weg, die
Vorschau lädt neu („Vorschau wird geladen", ca. 8 s).

**Was ich erwartet habe:** Panelwechsel ohne Seitenwechsel. So steht es als
Regel im Code:

> `web/components/website/menue-spalte.tsx:60-64`
> „Ein Eintrag OHNE `href` wird nicht navigiert, sondern gemeldet — dann
> wechselt nur das Panel und die Seite bleibt stehen. Das ist der Kern der
> Beschwerde ‚alles lädt neu statt realtime': ein Bereichswechsel darf keinen
> Seitenwechsel bedeuten."

Alle sieben Design-Einträge tragen aber ein `href` (`reiter.ts:355-363`).

---

## D — Beschriftung / Kleinkram

### D1. Reiter heißt „Theme", Adresse heißt `/website/design`
`de.json` → `website.reiter.design = "Theme"`, Route `/website/design`,
Panel-Titel „THEME", Menüspalten-ID `site-layout`. In der englischen Fassung
heißt derselbe Reiter „Design". Vier Namen für eine Sache.

### D2. Abschnitts-Werkzeugleiste verdeckt das Menü der Website
Bei ausgewähltem Abschnitt liegt die schwebende Leiste
(„Titelbild bearbeiten | Design bearbeiten | + ⧉ 👁 🗑") über der Kopfzeile der
Vorschau und verdeckt „Kontakt" und „Jetzt buchen". Reproduzierbar bei jedem
Abschnitt am oberen Rand.

### D3. Vorschau lässt sich nicht mit dem Mausrad scrollen
Auf `/website/seiten/<id>` (Desktop-Ansicht) bewegt das Mausrad über der
Vorschau nichts — dreimal an drei Positionen geprüft. Nur der schmale
Scrollbalken am rechten Rand des Vorschaubereichs funktioniert.

### D4. Auswahl aus dem Ebenen-Baum scrollt die Vorschau nicht mit
„Kontakt" im Ebenen-Baum anklicken markiert den richtigen Abschnitt (Inspektor
zeigt „Kontakt", Werte stimmen) — die Vorschau bleibt aber am Titelbild stehen,
der markierte Abschnitt ist nicht im Bild.

### D5. Seitenwahl auf `/website/vorlagen` ist ein unformatiertes `<select>`
`web/components/website/vorlagen-ansicht.tsx:137` benutzt ein nacktes
`<select>`, während der Editor die gestaltete `SeitenWahl` verwendet. Dort
fehlen außerdem Logo und Sprachwähler, die der Editor in derselben Zeile hat.

### D6. Erster Klick auf das „+" zwischen Abschnitten blieb einmal wirkungslos
Genau einmal beobachtet: erster Klick auf das „+" über dem Titelbild → nichts;
zweiter Klick an derselben Stelle → Katalog öffnet sich. **Nicht sicher
reproduzierbar** — als Beobachtung notiert, nicht als bestätigter Befund.

### D7. Blog-Panel schiebt sich sichtbar von außerhalb des Fensters herein
Beim Öffnen von `/website/blog` steht das Großpanel für rund 3 s so weit links,
dass Titel und erste Tabellenspalte abgeschnitten sind. Danach sitzt es
richtig. Einlauf-Animation, kein Dauerzustand — fällt aber auf, weil die Seite
in dieser Zeit kaputt aussieht.

---

## Ausdrücklich geprüft und in Ordnung

- **Kopf-/Fußzeile aus dem Theme:** Der Ebenen-Baum benennt beide als
  „aus dem Theme" und bietet dort nichts an, was pro Seite wirken würde. Eine
  seitenweise Navigation wird nirgends versprochen. Der Klick auf „Kopfzeile"
  führt folgerichtig ins Theme-Panel (dass die URL dabei lügt, ist C1).
- **Abschnitt in der Vorschau anklicken → Inspektor zeigt denselben.**
  Titelbild und Kontakt einzeln geprüft, Beschriftung und Feldwerte stimmen.
- **Ebenen-Baum gegen Vorschau:** Kopfzeile · Abschnitt·Titelbild → Spalte →
  Titelbild · Abschnitt·Kontakt → Spalte → Kontakt · Fußzeile · Site-Layout.
  Deckt sich mit der Vorschau.
- **Abschnitt einfügen an der gezeigten Stelle:** „+" über dem Titelbild →
  neuer Text-Abschnitt landet an **erster** Stelle. Korrekt.
- **Duplizieren:** Kopie landet direkt unter dem Original, Auswahl bleibt beim
  Original. Korrekt.
- **Löschen:** entfernt den Abschnitt sofort in Vorschau und DB. (Ohne
  Rückfrage — siehe A1.)
- **Geräteumschalter:** Desktop/Tablet/Handy ändern die Vorschaubreite
  tatsächlich (Renderdefekt auf dem Handy siehe B9).
- **Formulare speichern wirklich:** `/website/design/breite-abstand` von
  960 px auf 1440 px gestellt → Vorschau folgt sofort, nach F5 steht 1440 px.
  Anschließend auf 960 px zurückgesetzt, Ausgangszustand wiederhergestellt.
- **Direktaufruf im neuen Tab:** `/website/design/farben`, `/website/seo/messung`,
  `/website/einstellungen/blog` u. a. liefern jeweils dieselbe Ansicht, mit
  richtig hervorgehobenem Unterpunkt. (Nur die Editor-Panels nicht — C1.)
- **Panel-Titel gegen Panel-Inhalt** auf allen `/website/design/*`- und
  `/website/seo/*`-Seiten geprüft: passt.
- **Leerzustände** sagen, was zu tun ist: „Noch keine Regeln angelegt.",
  „Noch keine Beiträge. Leg den ersten an.", „Noch keine Weiterleitungen
  angelegt.", „Es ist noch keine Sprache gewählt. Bis dahin zeigt die Website
  die erste vorhandene Textfassung."
- **Widget-Code** (`/website/widgets`) zeigt auf `/widget/suche` — die Route
  existiert (`builder/app/widget/[typ]/page.tsx`), kein toter Link.
- **`/website/seo/*`, `/website/einstellungen/*`:** kein weiterer roher
  i18n-Schlüssel gefunden.

## Nicht geprüft

- Abschnitte per Ziehen umsortieren (Drag & Drop) und die Pfeile
  ↑/↓ im Ebenen-Baum.
- „Veröffentlichen", „Website ansehen" und die Entwurfs-Vorschau.
- Objekt-Schalter auf `/website/objekte` (hätte Live-Sichtbarkeit geändert).
- Seite anlegen/löschen/umbenennen, Vorlage anwenden (hätte den Bestand
  überschrieben).
- „Cookie-Hinweis einschalten" (`/website/seo/messung`) und die Schalter unter
  „Strukturierte Daten" — sie ändern die ausgelieferte Website.
- CSV-Import bei den Weiterleitungen, RSS-Import im Blog.
- Der Baukasten in einer anderen Sprache als DE/EN.
- Ursprung der `\n`-Escape-Sequenz aus B5.
