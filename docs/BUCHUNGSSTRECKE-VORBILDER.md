# Die Buchungsstrecke bei Hostaway, SiteMinder, Guesty und Lodgify

Erhoben am 25.08.2026. Quellen: 95 Artikel aus dem Hostaway-Hilfe-Center über
die Zendesk-API (508 000 Zeichen, 200 UI-Screenshots), dazu die echten
Editor-Screenshots und die Doku von SiteMinder, Guesty und Lodgify.

Anlass: Die Buchungsstrecke war bei uns weder Block noch Seite — sie lief als
vier Routen im Renderer, die im Baukasten nicht vorkamen.

## Das gemeinsame Muster: DREI Stufen, nicht eine

Alle vier Anbieter fahren dasselbe Modell, nur anders benannt:

| Stufe | SiteMinder | Hostaway | Guesty | Lodgify |
|---|---|---|---|---|
| **1 Widget für FREMDE Seiten** | TheBookingButton | Embeddable Search Bar / Calendar Widget | Booking Engine Widget | Search box / Booking box |
| **2 Eigene Seiten mit Adresse und SEO** | Website Builder | Booking Website (Standard / **Pro**) | Guesty Websites | Website Builder |
| **3 Reine API** | Direct Booking API | Hostaway-API | Booking Engine API | nicht belegt |

**Der entscheidende Satz:** Bei drei von vier Anbietern hat das Widget selbst
**keine eigene, indexierbare Adresse**. Es ist ein JS-Schnipsel ohne
Server-Rendering. Erst das getrennt verkaufte „Website"-Produkt gibt einem
Objekt eine echte URL mit eigenem `<title>` und Meta-Beschreibung.

Guesty sagt das in der eigenen Doku ausdrücklich: das SEO-Suchergebnis-Widget
gehört „auf eine dedizierte Seite mit eigener URL", sonst wirkt es nicht.
SiteMinder bewirbt „unique titles and descriptions, a full sitemap" nur beim
Website Builder, nicht beim Widget. Hostaway hängt das SEO/AEO-Panel an **Pro**.

Nur Lodgify behauptet eine echte Inline-Buchung ohne Seitenwechsel — und
verweist für Objekt-Einzelseiten trotzdem auf seinen Website-Builder.

## Hostaway im Detail (das direkteste Vorbild)

### Standard: acht feste Seiten
Nicht löschbar, aber ausblendbar. Eigenes SEO nur für diese sechs:
Home · All listings · About us · Privacy policy · Terms & conditions · Contact us.
Dazu zwei ohne eigenes SEO: **Reservation confirmation** und **Inquiry received**.
Beide mit Titel, Untertitel, Fließtext, Bild — und **Platzhaltern** für
Buchungsnummer und Gastportal-Link.

Eigene Seiten sind möglich, bekommen aber **kein** eigenes SEO. Höchstens fünf
Menüpunkte je Leiste (Kopf und Fuß).

### Pro: die dynamische Objektseite
Seit dem 23.07.2026 nativ. Der entscheidende Baustein:

> „In Booking Website Pro fungiert eine dynamische Seite als intelligente,
> wiederverwendbare Masterseite."

- **Ein Entwurf, viele Objekte.** Man baut das Layout EINMAL; das System füllt
  Text, Galerie, Lage und Preise je Objekt aus den Live-Daten.
- Sie steht **im selben Seiten-Auswahlfeld** wie Home/About us/Contact us —
  als Eintrag „Listings" bzw. „Property".
- **Connected Data:** über ein eigenes Symbol am Widget wird bestimmt, WELCHES
  Datenfeld dort erscheint (Titel, Beschreibung, …).
- **Automatisch angelegt und entfernt:** neues Objekt im PMS → neue dynamische
  Seite samt SEO-freundlicher URL. Objekt deaktiviert → Seite sofort weg.
- Inhalt ist **nicht** im Editor änderbar — Texte, Namen und Ausstattung pflegt
  man im PMS. Der Editor bestimmt nur Aussehen und Anordnung.
- Ein einheitliches Layout ist erzwungen; über **Sichtbarkeitsregeln** lassen
  sich einzelne Widgets je Objekt ein- und ausblenden.

### Das Buchungs-Widget heißt „Property book-form"
Aus dem echten Editor-Screenshot:

- Inhalt: „Select dates and number of guests to see the total price per night",
  darunter zwei Felder — **Select Dates** (Kalendersymbol) und **Gästezahl** —
  und zwei Knöpfe: **Send Inquiry** (Umriss) und **Book now** (gefüllt).
- Im rechten Panel: Brotkrume **`Section › Column ›`**, darunter der Widget-Name,
  dann die Abschnitte **Alignment · Spacing · Size · Animation · Position ·
  Book form**.
- Es ist ein **Widget wie jedes andere** — es liegt in einer Spalte, hat
  Content- und Design-Bereich und lässt sich verschieben.

Die weiteren Widgets der Objektseite: **Image Gallery** (Fotos aus dem PMS),
**Property Description** (Text), **Amenities List**, **Location Map** (Google,
Koordinaten aus dem Objekt), **Reservation Flow / Booking Widget**.

### Die einbettbaren Widgets sind etwas anderes
Für FREMDE Websites, per `<script>`:
- **Suchleiste** `window.searchBar({baseUrl, showLocation, color, rounded,
  openInNewTab, font})`
- **Kalender je Objekt** `window.hostawayCalendarWidget({listingId,
  numberOfMonths, button.action: 'checkout'|'inquiry', button.text, mainColor,
  frameColor, textColor})`

Beide führen den Gast **weg** — auf die gehostete Buchungsseite. Die eigentliche
Strecke (Zimmer, Extras, Gastdaten, Zahlung, Bestätigung) liegt **immer** dort.
`openInNewTab` steuert nur, ob im selben Tab oder einem neuen.

### Suchergebnisse und Checkout (Standard)
- **Suchergebnisse:** Filterleiste oben, Filter nach Betten, Schlafzimmern,
  Bädern und den zehn wichtigsten Ausstattungsmerkmalen. Betten-Filter ist
  **nicht ausschließend** (ein Bett = ein Bett oder mehr). Objekt-Karten zeigen
  den niedrigsten Preis der gewählten Tage, ohne Daten den Grundpreis. Karte mit
  anklickbaren Ortsmarken.
- **Checkout:** links Reservierungs- und Gastdaten (Termin, Gästezahl,
  Gastdaten, Zahlung, Hausordnung, Stornobedingungen, optionale Nachricht),
  darunter ein Rahmen mit den optionalen Direktkanal-Gebühren; rechts die
  Preisaufschlüsselung und ein Feld für einen Rabattcode.

## Der Editor-Aufbau (aus dem echten Screenshot)

**Obere Leiste:** ≡ · Logo · **Seiten-Auswahlfeld** · Sprache · [Mitte]
Geräte-Umschalter · [rechts] Rückgängig · Wiederholen · ✓ · Teilen · **Preview**
· **Republish** · ⌂

**Linke Leiste (Symbol + Beschriftung):** Add · Pages · Layers · Theme ·
**AEO/SEO** · Blog · ⋯ More

**Auswahl auf der Fläche:** blauer Rahmen mit **acht Anfassern** und einer
Ziehpille oben mittig; Etikett `› Property book-form` an der Kante; schwebende
Leiste `⋮ | Content | Design | + | ⧉ | ⊫ | 🗑 | ⋯`.

**Widget-Bibliothek:** eigenes Panel mit Suchfeld „Search for widgets", Einträge
nach Kategorien (u. a. MEDIA: Media Slider, Image, Photo Gallery, Icon, Video,
Shape, Before & After). Widgets werden per Ziehen auf die Fläche gesetzt; ein
blauer Balken zeigt die Zielstelle. **Widgets können nur in bestehende Spalten**
— eine neue Spalte entsteht dabei nicht.

## Was das für uns heißt

Die Buchungsstrecke ist **kein Entweder-oder**. Sie ist beides:

1. **Ein Buchungs-Block** im Editor (unser Gegenstück zu „Property book-form"),
   den man auf jede Seite setzen kann.
2. **Eine dynamische Objektseite** — ein Master-Layout, das je Objekt mit
   Live-Daten gefüllt wird, mit eigener Adresse und eigenem SEO je Objekt.
3. **Feste Seiten** für Bestätigung und Anfrage-erhalten.

Der Grund, warum Punkt 2 nicht durch Punkt 1 ersetzbar ist, steht oben: ein
reiner Widget-Zustand hat keine Adresse und keinen Titel. Suchmaschinen können
ihm kein Objekt zuordnen — egal wie viel darin sichtbar ist.

**Bei uns bereits vorhanden:** einbettbare Widgets für fremde Seiten
(`builder/app/widget/[typ]`, Suche und Buchen) — das ist Stufe 1 des Musters.
Die Routen `/inserat/[id]`, `/checkout/[id]`, `/checkout/abgeschlossen`
existieren und antworten; sie waren nur im Baukasten unsichtbar (behoben mit
0466, Systemseiten).

**Nicht belegt:** die genaue Redirect-Mechanik von SiteMinders
TheBookingButton — `help.siteminder.com` ist nur mit Kundenlogin erreichbar.
