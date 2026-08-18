# Plan — myBestDays-Marktplatz (`plattform`, :3100) mobil machen

Auftrag (wie ich ihn verstehe): Der Gäste-Marktplatz unter `http://localhost:3100`
ist durchgehend nur für Desktop gebaut. Ich habe alle Unterseiten in Chrome bei
Mobil-Breite angesehen, mit dem Airbnb-Mobil-Web verglichen und schreibe hier den
Umbau-Plan. **Gebaut wird erst nach deiner Freigabe.**

## Messmethode und ihre Grenzen (ehrlich benannt)

- Gemessen in Chrome (Claude in Chrome) bei **500 × 719 px**. Das ist die
  kleinste Fensterbreite, die Chrome auf macOS zulässt — 390 px (iPhone 14) ging
  nicht. 500 px liegt unter Tailwinds `sm` (640 px), also greift überall der
  Mobil-Zweig; bei 390 px werden die gefundenen Fehler **stärker**, nicht andere.
- **Angemeldete Seiten** (`/konto`, `/buchungen`, `/nachrichten`, `/merkzettel`,
  `/bewertungen`, `/aufenthalt/…`) leiten unangemeldet auf `/anmelden` um. Ich
  darf keine Zugangsdaten eingeben, deshalb sind diese Seiten **aus dem Code**
  analysiert, nicht am Bildschirm. Vor dem Abschluss müssen sie einmal
  angemeldet gegengesehen werden — das ist ein offener Punkt, keine Annahme.
- Zahlenbeleg für „nicht angepasst": von 40 Dateien in `plattform/components` +
  `app/**/page.tsx` haben **21 null** Responsive-Prefix (`sm:`/`md:`/`lg:`),
  darunter `such-leiste.tsx` (454 Zeilen), `buchungs-widget.tsx` (379),
  `anmelden-form.tsx`, `legal-document.tsx`, `listing-card.tsx`.

## Was Airbnb mobil anders macht (live abgelesen, 500 px)

| # | Airbnb-Muster | myBestDays heute |
|---|---|---|
| 1 | Suche ist **ein** Vollbreiten-Knopf „Jetzt suchen", der ein Vollbild-Blatt öffnet | Drei-Feld-Desktop-Pille bleibt stehen; der „Suchen"-Knopf ragt **2 px aus dem Viewport** (`scrollWidth` 502 > 500) und ist angeschnitten |
| 2 | Kategorie-Chips (Alles · Unterkünfte · Erlebnisse · Services) als scrollbare Pillen-Leiste, **sticky** unter der Suche | Tab-Zeile ist `hidden md:block` — mobil **komplett weg**, der Gast sieht die Kanäle nicht |
| 3 | **Fixe untere Tab-Leiste** (Erkunden · Wunschlisten · Einloggen) auf allen Browse-Seiten | Keine. Navigation nur über Kopfzeilen-Menü |
| 4 | Inserat: randlose Wisch-Galerie, Zähler „1 / 8", Zurück/Teilen/Herz als Kreise **über** dem Bild, Inhalt in abgerundeter Karte darüber | Fixes 4×2-Desktop-Mosaik (5 Bilder, Thumbnails ~90 px), Titel über der Galerie, kein Zurück/Teilen/Herz |
| 5 | Inserat: **sticky Fußleiste** „Gesamtpreis 372 € **234 €** · [Reservieren]" | Buchungs-Widget liegt inline weit unten, hinter Beschreibung + Karte; kein Preis im Blick |
| 6 | Karten-Bänder zeigen ~1,85 Karten (nächste Karte „lugt" rein), Pfeil rechts neben der Überschrift | Genau 2 Karten (`w-[calc((100%-1.25rem)/2)]`) — kein Hinweis, dass es weitergeht; Pfeile sind `hidden md:flex` + `opacity-0 group-hover` (Hover gibt es mobil nicht) |
| 7 | Fußzeile mobil einspaltig, Abschnitte gestapelt | 2 Spalten × ~30 Links; die Städte-Liste („Inspirationen") füllt mobil zwei Bildschirme |

## Stufe 0 — Fundament (einmal, wirkt überall)

0.1 **Breakpoint-Regel festschreiben.** `plattform` bekommt dieselbe Staffelung
wie der Rest: Basis = Mobil, `sm:` ab 640, `md:` ab 768, `lg:` ab 1024. Bisher
ist die Basis-Klasse überall der Desktop-Zustand — der Umbau dreht das um
(Mobile-first), damit nicht bei jeder neuen Zeile wieder eine Desktop-Basis
entsteht.

0.2 **`components/mobil/`** mit vier neuen Bausteinen, die alle Seiten teilen:
  - `TabLeisteUnten` — fixe untere Navigation (Suchen · Merkzettel · Buchungen ·
    Nachrichten · Konto), `md:hidden`, mit Unread-Badge. Sichtbarkeit
    rollenabhängig: nicht angemeldet → „Anmelden" statt Konto.
  - `BlattModal` (bottom sheet) — Vollbild-/Halbblatt mit Griff, Escape,
    Fokus-Falle, `overscroll-contain`. Ersetzt alle Desktop-Dropdowns mobil.
  - `WischGalerie` — Snap-Scroll-Galerie mit Punkt-Indikator und Zähler.
  - `StickyAktionsleiste` — untere Aktionsleiste (Preis links, CTA rechts) für
    Inserat und Checkout.

0.3 **Safe-Area + Höhe.** `env(safe-area-inset-bottom)` in `globals.css` als
`--safe-b`, jede fixe untere Leiste rechnet damit; `min-h-screen` →
`min-h-[100dvh]`, sonst schneidet die iOS-Adressleiste ab.

0.4 **Touch-Ziele ≥ 44 px.** Betrifft konkret: Herz auf der Inserat-Karte
(`size-8` = 32 px), Zähler-Knöpfe in Suchleiste und Buchungs-Widget (`size-8`),
Monatspfeile im Kalender (`size-8`), Sozial-Icons in der Fußzeile.

0.5 **Kein Hover als einzige Bedienung.** Die Band-Pfeile
(`opacity-0 group-hover/reihe:opacity-100`) sind mobil unerreichbar — mobil
entfällt der Pfeil, das Band wird gewischt (Punkt-Indikator statt Pfeil).

0.6 **i18n mitziehen.** Alle neuen Labels gehen in `messages/*.json` (24
Sprachen) — die Tab-Namen in `plattform-nav.tsx` und die komplette
`reise-inspirationen.tsx` sind heute **hart deutsch** im Code. Neuer Namespace
`mobil` + `nav`. `node scripts/i18n/pruefe-feld-labels.mjs` muss danach sauber sein.

0.7 **Überlauf-Wächter.** Kleines Skript `scripts/mobile/ueberlauf-pruefen.mjs`:
lädt jede Route bei 360/390/414 px und schlägt fehl, wenn
`documentElement.scrollWidth > innerWidth`. Damit ist „mobil ok" nachprüfbar und
nicht Ansichtssache (Regel: Debugging immer einbauen).

## Stufe 1 — Kopfzeile und Suche (`plattform-nav.tsx`, `such-leiste.tsx`, `site-header.tsx`)

1.1 `such-leiste.tsx` bekommt zwei Erscheinungsformen:
  - **mobil (< md)**: eine Vollbreiten-Pille „Wohin? · Datum · Gäste" (eine
    Zeile, `truncate`) → öffnet `BlattModal` im Vollbild mit drei Schritten
    (Ziel → Datum → Gäste) und einem Abschluss-Knopf „Suchen". Der Suchen-Knopf
    wandert also **ins Blatt**; damit ist der 502-px-Überlauf weg, nicht nur
    kaschiert.
  - **ab md**: die heutige Drei-Feld-Leiste, unverändert.
1.2 Die drei Dropdowns (`w-[42rem]`, `w-96`, `max-w-md` absolut positioniert)
werden mobil zu Blatt-Inhalten. Der Kalender wird einspaltig: Schnellwahl als
Chip-Reihe **über** dem Monat statt als 11-rem-Spalte links.
1.3 Kategorie-Tabs (Unterkünfte · Erlebnisse · Services): `hidden md:block`
entfällt; mobil scrollbare Chip-Leiste unter der Suchpille, sticky.
1.4 „myBestDays für Gastgeber" bleibt mobil aus der Kopfzeile weg (ist es schon),
wandert aber in das Konto-Menü, damit der Weg mobil überhaupt existiert.
1.5 `site-header.tsx` (Inserat/Checkout/Konto-Seiten) erhält die gleiche
Mobil-Pille statt der `hidden md:flex`-Attrappe, und auf Detailseiten eine
Zurück-Pfeil-Variante.
1.6 **Auf `/rechtliches` und `/agb` fliegt die Suchleiste raus** — dort wird
heute die volle Startseiten-Navigation gerendert, samt abgeschnittenem
Suchen-Knopf, obwohl auf einer Rechtsseite nichts zu suchen ist.

## Stufe 2 — Startseite `/`

2.1 `listing-reihe.tsx`: Kartenbreite mobil `w-[78%]` (nächste Karte lugt rein,
Airbnb-Muster) statt exakt 2 Karten; `snap-start` bleibt.
2.2 Pfeile mobil aus, statt dessen Punkt-Indikator; ab `md` wie heute.
2.3 `app/page.tsx`: Seitenabstand `px-6` → `px-4 sm:px-6 md:px-10`; Reihenabstand
`py-6` → `py-4 sm:py-6`.
2.4 Überschrift `text-xl` → `text-lg sm:text-xl`, damit „Unterkünfte in
Tversted" nicht umbricht.
2.5 „Alle anzeigen"-Karte hat `href="#"` — mobil ein toter 78-%-Block. Entweder
echtes Ziel (`/?q=<stadt>`) oder die Karte entfällt. Das ist kein Mobil-Fehler,
fällt aber mobil auf, weil sie ein Drittel des Bandes belegt.
2.6 Untere Tab-Leiste aktiv („Suchen"), Inhalt bekommt
`pb-[calc(4rem+var(--safe-b))]`.

## Stufe 3 — Inserat `/inserat/[id]`

3.1 Reihenfolge mobil wie Airbnb: **Galerie zuerst**, dann Titel/Ort. Heute steht
`h1` über der Galerie.
3.2 Galerie: `grid grid-cols-4 grid-rows-2` bleibt ab `md`; mobil `WischGalerie`
randlos (`-mx-4`), 4:3, Zähler „1 / n" unten rechts.
3.3 Über der Galerie: Zurück, Teilen, Herz als Kreise (44 px, weißer Grund) —
existiert mobil bisher gar nicht.
3.4 Inhaltsspalten `grid gap-12 lg:grid-cols-[1fr_24rem]` bleiben; mobil
`gap-8`.
3.5 **Buchungs-Widget mobil aus dem Fluss nehmen** → `StickyAktionsleiste`
unten: „550,00 DKK / Nacht" links, „Verfügbarkeit prüfen" rechts; Tippen öffnet
das Widget als Blatt. Die inline-Karte wird `hidden lg:block`.
3.6 `buchungs-widget.tsx`: `<input type="date">` (zeigt mobil `tt.mm.jjjj`)
bleibt als Fallback, bekommt aber mobil den gleichen Kalender wie die Suche —
zwei verschiedene Datumsbedienungen in einer App sind der eigentliche Bruch.
3.7 Karten-Platzhalter `h-72` → `h-56 sm:h-72`.
3.8 `ausstattung-liste.tsx` / `objekt-bewertungen.tsx`: `sm:grid-cols-2` heißt
mobil einspaltig — passt; nur Abstände (`gap-4` → `gap-3`) und Zeilenhöhe.

## Stufe 4 — Checkout `/checkout/[id]`, `/checkout/abgeschlossen`

4.1 **Reihenfolge drehen.** Heute steht mobil erst der Zahlungsablauf, die
Preis-Zusammenfassung darunter — der Gast zahlt, bevor er die Summe sieht.
Zusammenfassung mobil als **aufklappbare Karte oben** (`order-first lg:order-2`),
zugeklappt nur „Gesamt <Betrag>".
4.2 Sticky Fußleiste: Gesamtbetrag links, „Jetzt bezahlen" rechts.
4.3 Fußzeile + Reise-Inspirationen auf Checkout mobil ausblenden (Airbnb hat im
Bezahlfluss keine Fußzeile — hier hängen unter dem Bezahlknopf ~30 Links).
4.4 Stripe-Element: Breite prüfen, `p-6` → `p-4 sm:p-6`, damit das
Karten-Eingabefeld bei 360 px nicht randlos klebt.
4.5 `checkout-ablauf.tsx` `grid-cols-1 sm:grid-cols-2` ist ok; Knopf `px-7` →
`w-full`.

## Stufe 5 — Anmelden `/anmelden`

5.1 `flex min-h-screen flex-col md:flex-row` — mobil steht die dunkle
Marken-Spalte **über** dem Formular und schiebt es aus dem ersten Bildschirm.
Mobil: Marken-Spalte auf Logo + einen Satz kürzen oder `hidden md:flex`.
5.2 Formular `max-w-md` + `px-6`: bei 360 px zu wenig Rand → `px-4`.
5.3 Eingaben `text-base` erzwingen (unter 16 px zoomt iOS Safari beim Fokus).
5.4 Tab „Anmelden / Registrieren" ist ok, Höhe auf 44 px.
5.5 `autoComplete`/`inputMode` setzen (`email`, `current-password`) — mobil
entscheidet das über die Tastatur.

## Stufe 6 — Geschützter Bereich (`konto-shell.tsx`, `konto-nav.tsx`)

6.1 `konto-shell.tsx`: `grid lg:grid-cols-[16rem_1fr]` — mobil wird die
Seitennavigation zur horizontalen Chip-Leiste (ist schon
`overflow-x-auto lg:flex-col`), **doppelt** sie sich aber mit der neuen unteren
Tab-Leiste. Entscheidung: mobil bleibt nur die untere Tab-Leiste, die Chip-Reihe
wird `hidden md:flex`.
6.2 `px-6 py-8` → `px-4 py-5 sm:px-6 sm:py-8`; `max-w-4xl`-Klammer bleibt.
6.3 Titelzeile `text-2xl` → `text-xl sm:text-2xl`; Aktions-Knopf mobil unter den
Titel (`flex-wrap` ist da, aber der Knopf soll `w-full sm:w-auto` werden).

### 6a `/konto`
- Hero-Kachel: `p-*`, Überschrift und die zwei Knöpfe (`flex-wrap gap-3`)
  mobil untereinander, je `w-full`.
- Nächste-Reise-Karte `sm:flex-row`: mobil Bild 16:9 oben — passt, nur
  Bildhöhe festlegen, sonst springt das Layout beim Laden.
- Kachel-Raster `sm:grid-cols-2 lg:grid-cols-4` → mobil 2 Spalten statt 1
  (die Kacheln sind nur Icon + Wort, einspaltig wirkt leer).
- Support-Diagnose-Schalter: Beschriftung mobil unter den Schalter.

### 6b `/buchungen`, `/buchungen/[id]`
- Liste (`sm:flex-row sm:items-center`) mobil ok; Status-Badge und Datum
  in eine Zeile mit `flex-wrap`.
- Detail: `grid sm:grid-cols-2` ok. **Storno-Dialog** ist
  `fixed inset-0 … p-4` + `max-w-md` — mobil als Bottom-Sheet mit
  `max-h-[85dvh] overflow-y-auto`, sonst ist der Bestätigen-Knopf bei
  kleinem Gerät unter dem Rand.
- Zeitleiste/Belegzeilen: `justify-between` mit langen Labels bricht — Label
  und Betrag als zweizeiliger Block mobil.

### 6c `/nachrichten` — größter Umbau
- Heute: `grid md:grid-cols-[20rem_1fr] md:h-[36rem]`, mobil stapeln
  **Liste und Verlauf untereinander** (`min-h-[24rem]`) — man scrollt durch die
  Liste, um zum Verlauf zu kommen, und der Verlauf hat keine Überschrift.
- Umbau auf Master/Detail wie jede Messenger-App: mobil zeigt die Route die
  **Liste**; Tippen öffnet den Verlauf als eigene Ansicht mit Zurück-Pfeil im
  Kopf (`?thread=<id>` als Zustand, damit Zurück-Taste funktioniert).
- Eingabezeile mobil sticky am unteren Rand über der Tab-Leiste, `dvh`-basiert.
- Realtime-Abo bleibt unverändert (`guest_messages`), nur die Hülle ändert sich.

### 6d `/merkzettel`
- `grid sm:grid-cols-2 lg:grid-cols-3` → mobil 1 Spalte, ok. Herz-Knopf
  `size-8` → 44 px, Titel-Zeile `truncate`.

### 6e `/bewertungen`
- `sm:grid-cols-2` ok; Sterne-Auswahl mobil größer (Tippziel), Textfeld
  `text-base`.

### 6f `/aufenthalt/[reservationId]`
- `grid sm:grid-cols-2` ok; Türcode/Anreise-Block mobil zuerst, weil das der
  Grund ist, warum man die Seite am Handy öffnet.

## Stufe 7 — Rechtstexte `/rechtliches`, `/rechtliches/[dokument]`, `/agb`

7.1 Startseiten-Navigation → schlanke Kopfzeile mit Zurück (siehe 1.6).
7.2 `legal-document.tsx` (`max-w-3xl`, 0 Responsive-Prefix): `px-4`,
`text-[0.9375rem] leading-relaxed`, Überschriften kleiner.
7.3 Inhaltsverzeichnis der Dokumente mobil als aufklappbarer Block statt fester
Spalte.
7.4 Sprachwahl (`legal-sprachwahl.tsx` / `select.tsx`) `w-full sm:w-auto`.
7.5 Tabellen in den Rechtstexten (Cookie-/Drittanbieter-Listen) in
`overflow-x-auto`-Hüllen — sonst schieben sie die Seite seitlich.

## Stufe 8 — Fußzeile (`site-footer.tsx`, `reise-inspirationen.tsx`)

8.1 Link-Spalten mobil als **Akkordeon** (4 Abschnitte zugeklappt) statt
`grid-cols-1` mit ~30 offenen Links.
8.2 `reise-inspirationen.tsx`: Tab-Leiste mit `snap-x` und ohne sichtbare
Scrollbar; Ziel-Raster mobil 2 Spalten (ist es), aber auf 6 Einträge + „mehr
anzeigen" begrenzen — 12 Städte × 2 Zeilen sind mobil zwei Bildschirme.
8.3 Rechtsleiste: `·`-getrennte Kette bricht mobil unschön → mobil als Liste.
8.4 Sprache/Währung-Knöpfe 44 px, `w-full`-Zeile.
8.5 **Nebenbefund, kein Mobil-Thema:** in `site-footer.tsx` steht
`€ EUR` fest im Code. Das verstößt gegen Wurzel 4 (keine Währungs-Hardcodes,
27 EU-Länder) — die Startseite zeigt oben korrekt DKK. Ich melde es hier, fasse
es im Mobil-Umbau aber nur an, wenn du es freigibst.

## Reihenfolge und Umfang

| Schritt | Inhalt | Warum in dieser Reihenfolge |
|---|---|---|
| 1 | Stufe 0 (Fundament, 4 Bausteine, i18n-Namespace, Überlauf-Skript) | Alles Weitere benutzt es |
| 2 | Stufe 1 + 2 (Kopf/Suche/Startseite) | Der Einstieg; hier ist der einzige echte Überlauf |
| 3 | Stufe 3 (Inserat) | Meistbesuchte Detailseite |
| 4 | Stufe 4 (Checkout) | Geldweg — danach ist der Gast-Kernpfad mobil vollständig |
| 5 | Stufe 5 + 6 (Anmelden + geschützter Bereich, inkl. Nachrichten-Umbau) | Braucht einen angemeldeten Gegenblick |
| 6 | Stufe 7 + 8 (Rechtstexte, Fußzeile) | Wirkt auf allen Seiten, aber kein Blocker |

Kein Schritt ändert Datenwege, Endpunkte, Preise oder Realtime-Abos — es ist
ausschließlich Layout, plus die drei Verhaltensänderungen, die ich hier
ausdrücklich als solche kennzeichne: Suche als Blatt (1.1), Nachrichten als
Master/Detail (6c), Buchungs-/Bezahl-CTA als sticky Leiste (3.5 / 4.2).

## Prüfliste vor „fertig"

- `bunx tsc --noEmit` in `plattform` fehlerfrei; `bun run lint` fehlerfrei.
- **Kein `next build` lokal** (CLAUDE.md) — der Build läuft bei Coolify.
- `node scripts/mobile/ueberlauf-pruefen.mjs` grün für alle 14 Routen bei
  360 / 390 / 414 px.
- Jede Route bei 500 px in Chrome gegengesehen; die sechs angemeldeten Routen
  zusätzlich **mit deiner Anmeldung** (brauche ich von dir, ich logge mich nicht
  selbst ein).
- 24 Sprachdateien vollständig; `scripts/i18n/pruefe-feld-labels.mjs` sauber.
- Keine neue Tabelle, keine Migration, kein neues Abo → Wurzel 6/9 und das
  Realtime-Gate sind nicht betroffen; `bash scripts/realtime/abos-pruefen.sh`
  läuft trotzdem einmal mit.

## Offene Frage an dich

Untere Tab-Leiste (Stufe 0.2): Airbnb zeigt sie **immer**, auch unangemeldet
(dritter Punkt heißt dann „Einloggen"). Soll ich es genauso machen, oder soll die
Leiste erst nach Anmeldung erscheinen? Ich baue Airbnb-gleich, wenn du nichts
anderes sagst.

---

# Umsetzung (18.08.2026)

Alle neun Stufen sind gebaut. 34 Dateien in `plattform` geändert, 5 neu
(`components/mobil/`), 24 Sprachdateien erweitert, ein Prüfskript neu.

## Was abweicht — und warum

Drei Punkte des Plans habe ich bewusst NICHT so gebaut. Sie stehen hier, damit
niemand später glaubt, sie seien vergessen worden:

1. **Kein Punkt-Indikator an den Karten-Bändern (2.2).** Die Reihen haben
   zwischen 2 und 19 Karten; eine Punktreihe wäre bei 19 Karten breiter als das
   Bild. Das Vorbild hat dort auch keine — es arbeitet mit der hereinlugenden
   nächsten Karte, und genau die gibt es jetzt (`w-[78%]`). Die Blätter-Pfeile
   bleiben mobil aus, weil sie an `:hover` hängen.
2. **Kein eigener Range-Kalender im Buchungs-Widget (3.6).** Der Plan wollte dort
   dieselbe Datumsbedienung wie in der Suche. `<input type="date">` öffnet mobil
   aber den Picker des Betriebssystems — das ist die bessere Bedienung, nicht die
   schlechtere. Ein selbst gebauter Zeitraum-Kalender wäre die DRITTE
   Datumsoberfläche der App. Geändert wurden Schriftgröße (16 px, sonst zoomt
   iOS Safari) und Touch-Höhe. Der Bruch „zwei Datumsbedienungen" bleibt damit
   bestehen und ist bewusst in Kauf genommen.
3. **Keine sticky Bezahlleiste im Checkout (4.2).** Am Vorbild nachgesehen: die
   sticky Leiste steht dort auf der INSERAT-Seite, im Bezahlfluss sitzt der
   Knopf inline unter dem Formular. Eine zweite, schwebende Kopie desselben
   Knopfes wäre eine doppelte Aktion für denselben Vorgang. Gebaut ist statt
   dessen 4.1 (Zusammenfassung aufklappbar GANZ OBEN), 4.3 (keine Fußzeile im
   Bezahlfluss) und ein Bezahlknopf in voller Breite.

Zusätzlich zum Plan erledigt, weil es beim Anfassen derselben Stellen auffiel:
- Monats- und Wochentagsnamen im Kalender kamen aus zwölf deutschen Strings im
  Code — jetzt aus `Intl.DateTimeFormat` in der Gast-Sprache.
- Die Such-Pille in `site-header.tsx` war ein `<button>` ohne `onClick`, also
  eine Attrappe. Jetzt ein Link auf die Suche.
- Die „Alle anzeigen"-Karte am Ende jeder Reihe hatte `href="#"`. Sie erscheint
  jetzt nur bei Stadt-Reihen (dort gibt es ein echtes Ziel, `?q=<stadt>`) und
  entfällt sonst.
- Hilfe-Center und „Gastgeber werden" fehlten im angemeldeten Konto-Menü; die
  Kopfzeilen-Links dorthin sind `hidden lg:block`, mobil gab es also keinen Weg.

## Belege

- `node scripts/mobile/ueberlauf-pruefen.mjs` → **0 Routen mit Überlauf,
  0 Touch-Warnungen** bei 360 × 640, 390 × 844 und 414 × 896 (echte Mobil-
  Emulation: Touch, iPhone-User-Agent, dpr 2).
- `bunx tsc --noEmit` in `plattform`: fehlerfrei.
- `bun run lint`: 0 Fehler (1 vorbestehende `<img>`-Warnung in `logo.tsx`).
- `node scripts/i18n/pruefe-locales-vollstaendig.mjs plattform` → 24 Locales,
  alle Labels vorhanden. `pruefe-uebersetzungen.mjs plattform` → 527/527 Keys je
  Sprache. `pruefe-feld-labels.mjs` → sauber.
- `bash scripts/realtime/abos-pruefen.sh` → alle Abos haben Grant und
  Publikation (es wurde kein Abo geändert; der Lauf war die Gegenprobe).
- Sichtprüfung bei 390 px: Startseite, Inserat, Such-Blatt, Buchungs-Blatt,
  Fußzeile, Rechtsverzeichnis, Rechtstext, Anmelden, Reise-Inspirationen.
  Desktop-Gegenprüfung bei 1440 px: Startseite, Inserat, Fußzeile, Rechtstext,
  Anmelden — Layout unverändert.
- **Kein `next build`** (CLAUDE.md); der Build läuft bei Coolify.

## Was NICHT geprüft ist

Die sechs angemeldeten Routen (`/konto`, `/buchungen`, `/buchungen/<id>`,
`/nachrichten`, `/merkzettel`, `/bewertungen`, `/aufenthalt/<id>`) sind aus dem
Code umgebaut und übersetzen/kompilieren sauber, aber **nicht am Gerät gesehen** —
unangemeldet leiten sie auf `/anmelden` um, und Zugangsdaten gebe ich nicht ein.
Der größte Umbau liegt genau dort (`nachrichten-client.tsx` von gestapelt auf
Master/Detail). Nachzuholen mit:

```
node scripts/mobile/ueberlauf-pruefen.mjs --cookie "nd_access=<TOKEN>"
```

## Offen aus dem Plan, unverändert

`site-footer.tsx` enthält weiterhin `€ EUR` fest im Code (Abschnitt 8.5). Das ist
ein Wurzel-4-Verstoß und war ausdrücklich als „nur auf Freigabe anfassen"
vermerkt — er steht also noch da.

---

## Nachtrag (18.08.2026, nach deinen zwei Rückmeldungen)

### 1. `€ EUR` in der Fußzeile — behoben

Ausgangslage: zwei `<button>` ohne `onClick` („Deutsch (DE)" und „€ EUR"), also
Attrappen. Der zweite war zusätzlich in zwei Richtungen falsch — er behauptete
Euro, während die Startseite DKK zeigt, und versprach eine Währungsumschaltung,
die es nicht gibt (Preise stehen in der Währung der Unterkunft, Wurzel 4).

- **Sprachknopf ist jetzt echt**: `SprachWaehrungModal` hat eine zweite
  Auslöse-Form (`variante="text"`) und öffnet in der Fußzeile dasselbe Modal wie
  in der Kopfzeile. Der Sprachname kommt aus dem AKTIVEN Locale
  (`LOCALE_LABELS[aktiv]`), nicht als fester Text.
- **Währungsknopf ersatzlos entfernt** — nicht durch einen anderen festen Wert
  ersetzt. Der Hinweis „Preise stehen in der Währung der jeweiligen Unterkunft"
  steht im Modal.
- **Totes Cookie entfernt**: `CURRENCY_COOKIE = "nd_gast_currency"` in
  `i18n/locales.ts` wurde nirgends im Repo geschrieben oder gelesen. Statt der
  Konstante steht dort jetzt der Grund, warum es sie nicht gibt.

### 2. Bug in der Sprachwahl (dein Screenshot 12:44) — behoben

Ursache war mein eigener Mobil-Umbau: der Modal-Rahmen hatte `items-stretch`.
Damit bekommt das Panel die Bildschirmhöhe zugewiesen, sein Inhalt (24 Sprachen
einspaltig ≈ 1940 px) ist aber höher — die Liste lief unten aus dem gefärbten
Kasten heraus und stand ohne Hintergrund über der Seite.

- `items-start` + `min-h-full` am Panel: füllt den Bildschirm, erzwingt die Höhe
  aber nicht. Gegengemessen: `panel.scrollHeight − panel.height = 0`.
- Zusätzlich: Schließen-Knopf und Titel laufen mobil in einer `sticky`-Kopfzeile
  mit — vorher war der Knopf nach dem ersten Wisch aus dem Bild.

### 3. „unsere Objekte sind zu groß" (dein Screenshot 12:49) — behoben

Nachgemessen am Vorbild: bei ~333 px Bildschirm ist die Karte dort ~144 px, also
**zwei vollständige Karten plus Anschnitt der dritten** (≈ 43 %). Ich hatte
78 % — eine Karte füllte die Zeile fast allein.

- `listing-reihe.tsx`: Kartenbreite mobil `w-[78%]` → **`w-[43%]`**.
- Kartentext maßstabsgerecht: Titel `text-sm sm:text-base`, Ort/Preis
  `text-xs sm:text-sm`, „Gäste-Favorit"-Plakette kleiner.
- Herz: Trefferfläche 40 px, sichtbarer Kreis nur 36 px — ein 40-px-Kreis nahm
  auf einer 155-px-Karte ein Viertel des Bildes ein.
- **Blätter-Pfeile sind mobil jetzt sichtbar** (40 px, ab md wieder 32 px und
  hover-gebunden wie bisher). Das Vorbild zeigt sie mobil ebenfalls — damit ist
  die im Plan (2.2) angekündigte Abweichung „kein Indikator" hinfällig: es gibt
  jetzt eine sichtbare Bedienung, nur als Pfeil statt als Punktreihe.

Gegenprüfung nach allen drei Punkten: `ueberlauf-pruefen.mjs` → 0 Überlauf,
**0 Touch-Warnungen** bei 360/390/414 px; `tsc` und `bun run lint` sauber;
24 Locales vollständig; Desktop bei 1440 px unverändert (Startseite, Inserat,
Fußzeile, Sprachmodal gegengesehen).
