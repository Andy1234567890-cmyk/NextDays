# Hostaways Bewertungssystem — Analyse und Vergleich

**Stand 30.08.2026.** Grundlage sind drei Quellen, in dieser Verlässlichkeitsordnung:
die **API-Dokumentation** (`api.hostaway.com/documentation`, 3 MB, Review-Abschnitt
vollständig gelesen — sie verrät das Datenmodell aus erster Hand), das
**Zendesk-Hilfecenter** (7 Artikel im Bereich „Guest Reviews", Volltext über die
offene JSON-API geholt) und die Marketing-Seite (praktisch inhaltsleer:
„All your channels, messages, and reviews in one place").

Dazu **acht Bildschirmfotos der echten Oberfläche**: drei vom Nutzer
(Reviews-Liste mit Bearbeiten-Dialog, Antwort-Dialog, Auto-Reviews) und fünf aus
den Hilfeartikeln (Listings Quality mit Navigation, Kachel-Detail, Reviews
Quality, Auto-Reviews, Statusdiagramm). Abschnitt 1.3 beruht darauf.

Unsere Seite ist Datei für Datei am Code kartiert.

Das Ergebnis vorweg, weil es meiner eigenen früheren Einschätzung widerspricht:
**Unser Bewertungsmodul ist Hostaways in fast jedem Punkt ebenbürtig oder
überlegen — mit genau einer echten Ausnahme: der KI-Auswertung.** Im
[KI-Vergleich](KI-VERGLEICH-HOSTAWAY.md) hatte ich „Bewertungen = KI-freie Zone"
notiert und daraus einen großen Rückstand abgeleitet. Das war zu pauschal: die
Statistik, die Automatik, die Warteschlange und die Zwei-Wege-Bewertung sind bei
uns **weiter** als bei Hostaway. Was fehlt, ist die Deutung der Texte.

---

## Teil 1 — Was Hostaway hat

### 1.1 Das Datenmodell (aus der API, wörtlich)

```
id, accountId, listingMapId, reservationId,
autoReviewId, autoReviewTemplateId,        // Herkunft aus Auto-Review/Vorlage
timeDelta, scheduledDateTime,              // Versandsteuerung AM REVIEW
channelId,
type: "guest-to-host" | "host-to-guest",   // beide Richtungen, EINE Tabelle
status: awaiting|pending|scheduled|submitted|published|expired,
rating,                                    // 0-10, auch bei Stern-Kanälen
externalReviewId, externalReservationId,
publicReview, privateFeedback,             // Text + private Notiz
revieweeResponse,                          // die Antwort des Gastgebers
isRevieweeRecommended, isCancelled,
reviewCategory: [],                        // im Doku-Beispiel LEER
departureDate, arrivalDate, listingName, guestName
```

Vier Entwurfsentscheidungen, die daraus ablesbar sind:

1. **`type` trennt beide Richtungen in EINER Tabelle.** Gast→Gastgeber und
   Gastgeber→Gast sind dasselbe Objekt. Daher auch die farbliche Trennung in der
   Liste (siehe 1.3).
2. **`timeDelta` und `scheduledDateTime` sitzen am Review selbst**, nicht in einer
   Job-Tabelle. Die geplante Bewertung *ist* eine Zeile mit Status `scheduled`,
   bevor sie rausgeht — deshalb lässt sie sich einzeln bearbeiten und abbrechen.
3. **`rating` läuft durchgehend 0–10**, auch bei Kanälen, die in Sternen denken.
   Normalisierung passiert beim Import.
4. **`reviewCategory` ist im Beispiel ein leeres Array** und in der Feldtabelle
   nicht weiter dokumentiert. Die Kategoriestruktur ist damit **nicht offiziell
   belegt**.

**Nur zwei öffentliche Endpunkte, beide lesend:** `GET /v1/reviews` und
`GET /v1/reviews/{reviewId}`. Schreiben geht über die öffentliche API **nicht**,
obwohl das Rechte-Objekt `createReview`/`updateReview`/`deleteReview` führt.

### 1.2 Funktionsumfang

**Kanäle** (wörtlich aus *Guest Reviews: Overview*): „Airbnb, Booking.com, Vrbo,
and Hostaway reservations", technisch über „Airbnb Official API, the Booking.com
Reviews API, and the Vrbo Reviews API".

Was je Kanal geht — das ist der wichtigste Befund:

| Kanal | lesen | antworten | Gast bewerten | Auto-Review |
|---|---|---|---|---|
| Airbnb | ja | ja | ja | **ja**, ≥ 3 Textvorlagen Pflicht |
| Booking.com | ja | ja | **nein** (Portal kennt es nicht) | nein |
| Vrbo | ja | ja | ja, 14-Tage-Frist | ja, aber **ohne Text** |
| Hostaway-eigene | ja | — | — | — |
| Expedia | **nicht gefunden** | | | |
| Google Business | **nicht gefunden** | | | |

**Bewertungsanfrage an den Gast:** kein eigener Mechanismus. Der Weg ist ein
Platzhalter `{{review_url}}` in der allgemeinen Nachrichten-Automation. Kein
eigenes Vorlagenset, keine belegte Mehrsprachigkeit.

**Auto-Reviews (Gastgeber → Gast)** — voll ausgebaut, und hier steckt Wissen drin,
das wir übernehmen sollten:

* Note **fest 5 Sterne**, wörtlich: *„It is not possible to modify this in the
  auto-review."* Nachträglich an der Einzelbewertung änderbar.
* Versand **1 bis 13 Tage** nach Abreise.
* **Mindestens 3 Textvorlagen Pflicht** — Begründung wörtlich: *„Airbnb may
  penalize this practice, and it may affect the SEO."* Der Versand wählt zufällig
  eine aus.
* Ein Objekt darf **nur eine** Auto-Review haben.
* Gegenzustands-Semantik, offen dokumentiert: Aktivieren plant rückwirkend;
  Deaktivieren wirkt **nicht** auf bereits Geplantes; Löschen storniert
  Geplantes **nicht**.

**Antworten** gehen ans Portal zurück. Booking.com nur bei vorhandenem Kommentar
und mit Vorabprüfung durch das Portal; Vrbo prüft bis zu 14 Tage.

**Benachrichtigung bei schlechter Bewertung: nachweislich nicht vorhanden.** Die
vollständige Benachrichtigungsliste (Reservations 5, Tasks 5, Messages 4,
Payment 6, Listings 4, Account 2, Exceptions 1) enthält **keinen einzigen**
Bewertungs-Eintrag.

**Widget für die eigene Website: nein.** Nur Ausspielung in der eigenen
Buchungsstrecke; für Fremdseiten wird auf den Marktplatz-Partner *Revyoos*
verwiesen. Bemerkenswert offener Hinweis in ihrer Doku: *„we can't show reviews if
they don't have text or if they are from Airbnb, so the final rating shown on the
listing can mismatch the real number of reviews."*

### 1.3 Die Oberfläche

> **Belegquelle:** Die folgenden Angaben stammen aus **Bildschirmfotos der echten
> Oberfläche** (Reviews-Liste mit Bearbeiten-Dialog, Antwort-Dialog,
> Auto-Reviews-Reiter). Wo etwas darauf nicht zu sehen war, steht es als solches
> gekennzeichnet.

**Zwei Reiter sichtbar**: `MANAGE REVIEWS` · `AUTO-REVIEWS`. Die Hilfe nennt
zusätzlich `Review Templates`; auf den Bildern erscheint er nicht — möglicherweise
kontoabhängig oder inzwischen entfallen. Kein Insights-Reiter.

**Filterleiste** über der Tabelle, sieben Felder plus Knopf: `From (check-out)`
und `To (check-out)` (je mit Kalendersymbol), drei im Bild verdeckte Felder,
`Tags` (Auswahl) und `Origin` (Auswahl, Vorgabe „All") — rechts `RESET`.

`Origin` ist bemerkenswert: es unterscheidet `Guest` von `Host` als **eigene
Spalte und eigener Filter**, zusätzlich zur Zeilenfarbe. Hostaway verlässt sich
also nicht auf die Farbe allein.

**Die Tabellenspalten** (von links): `Guest name` (als Link) · `Channel` (farbiger
Punkt + Name, z. B. „● Airbnb Pro", „● Booking.com") · `Origin` (Guest/Host) ·
`Listing` (als Link) · Bewertungstext (gekürzt, mit „More"-Link) · `Replies` ·
`Rating` (fünf Sterne) · `Action`. In der Kopfzeile rechts ein **Filter-Trichter**.

Spalten sind konfigurierbar: Zahnrad öffnet die Spaltenwahl, Felder per Ziehen
umsortierbar — und **dieselbe Auswahl steuert den Export**.

Unten links: `Show [25] per page`.

**Farbliche Trennung statt Gruppierung**, wörtlich: *„Darker rows for guests,
lighter rows for the Host."* Gast- und Gastgeber-Bewertung derselben Reservierung
stehen als **zwei getrennte Zeilen** untereinander — im Bild gut sichtbar an
„John Bowi / Guest" direkt über „John Bowi / Host".

**Aktionsspalte**, im Bild nur bei der überfahrenen Zeile sichtbar: drei Symbole —
Kreis-mit-Kreuz (Bewertung abbrechen), Stift (bearbeiten), Pfeil nach rechts
(antworten).

**Sechs Status** mit klaren Definitionen — `awaiting` (Anfangszustand),
`pending` (beim Portal erzeugt), `scheduled` (Auto-Review geplant), `submitted`
(abgegeben, aber noch verdeckt — Airbnb double-blind), `published`, `expired`.

**Keine Detailseite** — ein Bearbeiten-Dialog hinter dem Stift. Bearbeitbarkeit
hängt an der Quelle: eigene Reservierungen komplett, **OTA-Bewertungen nur der
Name des Bewertenden**.

#### Der Bearbeiten-Dialog „Airbnb manual review"

Einleitungstext, wörtlich: *„You can send right away a review to your guest. This
review will substitute any auto-review for that reservation. Here you can choose
lower scores and add specific explanations for any of the categories. You can also
update the scores and text and it will be sent when it was originally programmed."*

Damit ist eine Frage beantwortet, die die Hilfe offenlässt: Eine manuelle
Bewertung **ersetzt** die geplante Auto-Bewertung derselben Reservierung — das ist
der Gegenzustand, den man beim Nachbau leicht übersieht.

Aufbau von oben nach unten:

| Element | Bemerkung |
|---|---|
| `Message` | Textfeld, rechts oben ein Knopf **`{}`** für Platzhalter |
| `Message preview ⌄` | Klappe — zeigt den Text mit **aufgelösten** Platzhaltern |
| `Private note` | Textfeld („Type private note"), ebenfalls mit `{}` |
| `Private note preview ⌄` | zweite Klappe |
| `Cleanliness rating` | fünf Sterne, anklickbar |
| `Communication rating` | fünf Sterne |
| `Observance of house rules rating` | fünf Sterne |
| `Recommend the guest` | Schalter, Vorgabe **Yes** (grün) |

Vier Aktionen: **`CANCEL REVIEW`** (rot) · **`UPDATE`** (grün) · **`SEND`** (blau)
· **`CLOSE`** (weiß).

Die Trennung `UPDATE` / `SEND` ist die sichtbare Umsetzung dessen, was der
Einleitungstext sagt: *ändern und zum geplanten Zeitpunkt senden* oder *sofort
abschicken*. Zwei verschiedene Absichten, zwei Knöpfe — nicht ein „Speichern",
das beides meint.

Der `{}`-Knopf mit Vorschau-Klappe ist die Oberfläche zum `preview`-Parameter der
API (*„template variables in publicReview and privateFeedback are replaced with
their actual values"*).

#### Der Antwort-Dialog „Replying an Airbnb review"

Minimal: eine Warnzeile, ein Textfeld, zwei Knöpfe (`SEND` blau, `CLOSE` weiß).

Die Warnung wörtlich, und sie ist der ganze Punkt des Dialogs:
*„Review responses will be posted immediately after you publish them, and they
cannot be edited once posted."*

#### Der Reiter „AUTO-REVIEWS"

Überschrift `Airbnb reviews`, rechts oben blauer Knopf **`ADD AUTO-REVIEW`**.
Darunter `Auto-review names` mit einem Suchfeld („Search by auto-review name").

Je Auto-Review **eine Karte**, links die Angaben:

* Name (fett), z. B. „Airbnb review"
* `Event: 1 day after checkout`
* `Listings: <Objektname>`
* `Creation date: 2020-10-14 14:22:14`

Rechts ein abgesetzter Bereich mit `Active` und einem grünen Schalter, daneben
drei Symbole: **Stift** (bearbeiten), **Kopieren**, **Papierkorb**.

Das Kopieren-Symbol entspricht dem „Duplicate" aus der Hilfe — sinnvoll, weil
jedes Objekt nur **eine** Auto-Review haben darf und man sie deshalb je Objekt
neu anlegt.

#### Der Statusfluss (aus dem Diagramm der Hilfe)

Nicht nur die sechs Zustände, sondern ihre Übergänge:

```
Awaiting ──▶ Pending ──┬──▶ Submitted ──▶ Published
                       │         ▲
                       └──▶ Scheduled ──┘
                                  └──────────────▶ Expired
```

`Awaiting` → `Pending` → dann verzweigt es: entweder direkt `Submitted` (der Gast
oder das Portal hat eingereicht) oder über `Scheduled` (unsere Auto-Bewertung
wartet auf ihren Termin) und von dort ebenfalls nach `Submitted`. Aus `Scheduled`
führt zusätzlich ein Weg nach `Expired` — die Frist lief ab, bevor der Termin kam.
`Published` ist die einzige Senke.

Wichtig für den Nachbau: **`Expired` erreicht man nur aus `Scheduled`**, nicht aus
`Submitted`. Was abgegeben ist, kann nicht mehr verfallen.

#### Hosting Quality — zwei Unterreiter

**Eigener Menüpunkt `Hosting Quality`** in der Hauptnavigation (mit
`new`-Abzeichen), darunter der Untereintrag `Listings Quality`. **Nur für Admins.**
Innerhalb der Seite zwei Reiter: `Listings Quality` · `Reviews Quality`.

**Gemeinsame Filterzeile** in beiden: ein Knopf `Filters` mit **orangefarbenem
Zähler-Abzeichen** (Anzahl aktiver Filter), daneben die aktiven Filter als
hellblaue Marken (`From: 2024-09-04`, `To: 2024-12-04`) und rechts `Clear filters`
in Rot. Überschrift darunter: `Metrics`.

Das Zähler-Abzeichen ist eine gute Lösung: der Nutzer sieht, *dass* gefiltert wird,
ohne dass die Leiste aufgeklappt bleiben muss.

**Reiter `Listings Quality`** — vier Kacheln, jeweils als **Anteil an der
Gesamtzahl**, was die Zahl sofort einordnet:

| Kachel | Beispiel | Farbe der Zahl |
|---|---|---|
| Listings in „Good" status | **196** / 394 | grün |
| Listings in „Warning" status | **146** / 394 | orange |
| Listings at risk | **35** / 394 | rot |
| Suspended Listings | **17** / 394 | schwarz |

Nur der Zähler ist eingefärbt und groß, der Nenner bleibt grau — man liest zuerst
die Zahl, dann den Bezug.

Darunter die Tabelle `Listings` mit den Spalten: `Listing name` · `Average review
score` (z. B. 4.67) · `Airbnb quality status` (farbige Marke: **Educate** grün,
**Warning** gelb, **Probation** orange) · `Airbnb review issues` · `Airbnb
cancellations` · `Airbnb CS violations` · `Read more` (Link). Fehlwerte stehen als
`-`, nicht als 0 — dieselbe Regel wie bei uns.

Unten: `Show [10] per page` und eine Seitenzahl-Leiste mit `FIRST` / `LAST`.

**Reiter `Reviews Quality`** — **13 Kacheln in einem Vierer-Raster**, und hier
steckt die beste Idee des ganzen Dashboards:

| Reihe | Kacheln |
|---|---|
| 1 | Overall AVG review score `4.76` · 5-star rate view `84 %` · Accuracy `4.84` · Checkin `4.92` |
| 2 | Cleanliness `4.77` · Communication `4.87` · Location `4.82` · Value `4.74` |
| 3 | Comfort `4.61` · Facilities `4.14` · Staff `4.67` · Respect house rules `5.00` |
| 4 | Reviews that need response `155 / 175` |

**Jede Kachel trägt rechts die Logos der Kanäle, aus denen ihr Wert stammt** —
Airbnb-Symbol, Booking-„B", Vrbo-„V", teils mehrere übereinander. Damit ist auf
einen Blick klar, warum „Comfort", „Facilities" und „Staff" nur ein
Booking-Symbol tragen: **diese Kategorien gibt es nur bei Booking.com.** „Accuracy"
und „Checkin" tragen nur Airbnb.

Das löst ein Problem, das wir auch haben und heute schlechter lösen: Kategorien
sind je Portal verschieden, und ein Durchschnitt über verschiedene Grundgesamtheiten
ist ohne diese Kennzeichnung irreführend. Wir zeigen unsere Kategorie-Balken ohne
jeden Hinweis darauf, aus welchem Kanal sie kommen.

**Die Werte sind farbcodiert**: 4.61, 4.14 und 4.67 stehen in Orange, alles ab
etwa 4.7 in Schwarz. Eine Schwelle ist nicht dokumentiert; sichtbar ist, dass
schwächere Werte hervorgehoben werden, ohne dass die Kachel selbst Alarm schlägt.

**Kein Diagramm, keine Zeitreihe** — das gesamte Reviews-Quality-Dashboard besteht
aus Kacheln. Unsere Ansicht hat zusätzlich einen Tagesverlauf und eine
Objekt-Rangliste; in diesem Punkt sind wir weiter.

**Ein zusammengesetzter Quality-Score existiert nicht** — es gibt nur Durchschnitte
plus die durchgereichten Airbnb-Zustände. Eine Warnung vor drohendem
Superhost-/Genius-Verlust: **nicht gefunden**; die Statusmarken *sind* die Warnung.

#### Rahmen und Navigation

Linke Seitenleiste, hell, mit Symbol und Text je Eintrag, aufklappbar (`›`):
Overview · Calendar · Dynamic Pricing · Reservations · Smart Locks · Inbox
(Zähler `11.71k`) · Tasks · **Reviews** · Guest Payments · Financial Reporting ·
Owner Statements · **Hosting Quality** (`new`) → Listings Quality · Listings ·
Channel Manager · User Management · Booking Engine · Marketplace · Settings.

Kopfzeile: Hamburger-Symbol, Wortmarke in Orange, Suchfeld, zwei Zähler-Symbole
(1 und 1128), `Need help?`, Kontobild.

Bestätigt die Verteilung auf zwei Orte: **Reviews** und **Hosting Quality** sind
getrennte Hauptmenüpunkte.

**Navigation:** seit der Umstellung vom 25.02.2026 (73 → 44 Reiter) liegt
*Reviews* unter **Reservations**, *Listing Quality* unter **Listings**. Das
Bewertungswesen ist bei Hostaway also **auf zwei Orte verteilt**.

### 1.4 Review Insights — die dünnste Belegkette

Es gibt **keinen einzigen Hilfeartikel** namens „Review Insights". Belegt ist nur
die Produktseite: *„Review Insights uses AI to analyze sentiment trends in
reviews, providing a summary of potential improvements that lead to more positive
ratings"* — und ein Dreizeiler im Artikel *What is Hostaway AI?*, der drei Nutzen
nennt: Muster im Gastfeedback erkennen, KI-Vorschläge zur Verbesserung,
**Vergleich gegen Benchmarks**.

Was daraus folgt: **Stimmungs-Trends und eine Verbesserungs-Zusammenfassung sind
belegt.** Freie Themen-Extraktion ist es **nicht** — was das Dashboard als
„Themen" zeigt, sind die fünf fest verdrahteten Airbnb-Kategorien. Auf welcher
Ebene aggregiert wird, ist nicht dokumentiert.

**Einen KI-Antwortvorschlag auf Bewertungen hat Hostaway nicht.** Die
AI-Replies-Suite ist ausdrücklich der Inbox zugeordnet. Für KI-Antworten auf
Bewertungen verweisen sie auf Marktplatz-Partner (Revyoos, Review Lawyers).

---

## Teil 2 — Was wir haben

Deutlich mehr, als im KI-Vergleich stand. Die Kartierung ergab vier Bausteine:
`reviews` (Betriebs-Cockpit), `guest_reviews` (Gast-/Marktplatzseite),
`reviews_sync` (Portal-Spiegelung) und fünf Frontends.

**Drei Reiter plus ein eigener Menüpunkt** (Stand 30.08.2026, nach dem Umbau
auf Hostaways Struktur): `/bewertungen` (Tabelle) ·
`/bewertungen/geplant` (Warteschlange) · `/bewertungen/einstellungen`
(Auto-Bewertungen als Vorlagen-Karten, entspricht ihrem `AUTO-REVIEWS`).
Die Auswertung liegt seither unter `/qualitaet` als eigener Hauptmenüpunkt —
so wie ihr `Hosting Quality`.

Vorher waren es vier Reiter in einer Seitenspalte; die kostete ein Sechstel
der Breite für vier Wörter, und der Tabelle fehlte genau die.

**18 Endpunkte** im Slice, dazu 7 im Gast-Slice und 4 im Kanalmanager.

Wo wir **besser** sind:

| | Hostaway | Wir |
|---|---|---|
| Kategorien Gast→Objekt | 5 feste Tags | **6 Spalten**, 1–5, in der DB |
| Kategorien Betrieb→Gast | 3 (Airbnb) | 3, mit Abbildung auf Airbnb |
| Double-Blind | nur Airbnb-Weiterreichung | **eigene Umsetzung** (`publication.py`, 14 Tage, beidseitig) |
| Warteschlange | Status am Review | **eigene Tabelle** mit Frist, Fehlergrund, Bearbeiten/Überspringen/Sofort senden |
| Note der Auto-Bewertung | **fest 5**, nicht änderbar | **frei wählbar** 1–5 |
| Bedingung | keine | **`min_rating`** — nur bewerten, wenn der Gast selbst ≥ n gab |
| Gast-Erinnerung | Bastelweg über `{{review_url}}` | **eigener Vorgang**, mehrsprachig aus `guest_language` |
| Notenskalen | alles auf 0–10 gezwungen | **beide erhalten** (`score`, `scale`, `score_5`) |
| Website-Einbindung | nur eigene Buchungsstrecke | **Baukasten-Block** `reviews` |
| Öffentliche API | nur lesen | lesen **und** schreiben |

Der Punkt mit den Skalen ist mehr als Kosmetik: Hostaway rechnet Airbnb-Sterne auf
0–10 und zeigt nur noch das. Wir führen die Rohnote mit und rechnen nur fürs
Sortieren um — *„damit niemand die Umrechnung für die Wahrheit hält"*
(`bewertungs-cockpit.tsx:6-8`).

---

## Teil 3 — Was uns wirklich fehlt

### 🔴 1. KI-Auswertung der Bewertungstexte

Die einzige große Lücke. `grep` nach `VertexClient|core.ki|sentiment` über
`reviews/` und `guest_reviews/`: **null Treffer**.

Konkret fehlen drei Dinge:

* **Stimmungs-Trend über die Zeit** — welche Themen tauchen wiederholt negativ auf?
* **Verbesserungs-Zusammenfassung je Objekt** — unser Dashboard sortiert das
  schwächste Objekt nach vorn, sagt aber nicht, *warum* es schwach ist.
* **Antwortvorschlag** — es gibt einen für Gastnachrichten (`ki_antwort.py`),
  aber keinen für Bewertungen.

Der dritte Punkt hat **Hostaway auch nicht** — dort verweisen sie auf zugekaufte
Partner. Das ist eine Gelegenheit, nicht nur ein Rückstand.

### 🟡 2. Benachrichtigung bei schlechter Bewertung

Hat Hostaway ebenfalls nicht (nachgewiesen: kein Bewertungs-Eintrag in ihrer
gesamten Benachrichtigungsliste). Bei uns wäre es billig, weil der Melde-Katalog
steht — nur `reviews` ist kein Ereignis darin.

### 🟡 3. Spaltenwahl und Export

Hostaways Zahnrad-Spaltenwahl steuert zugleich den Export. Wir haben **weder das
eine noch das andere** — kein CSV, kein PDF, an keiner Stelle des Moduls.

### 🟡 4. Filter, die die API kann und die UI nicht zeigt

Unser `GET /reviews` kennt `property_id` als Filter (`router.py:52`) — es gibt
**kein Bedienelement** dafür. Ebenso fehlen Volltextsuche und Sortierwahl.
Hostaway hat 15 Filter und 18 Sortierfelder.

### 🟡 5. Datenmodell ohne Oberfläche

Drei Felder in `channex_review` sind angelegt, werden aber **nirgends gesetzt oder
gefiltert**: `is_read`, `is_archived`, `assigned_user_id` (`0262:54-56`). Nur
`is_archived = false` wird beim Lesen vorausgesetzt. **Zuweisung an einen
Mitarbeiter existiert als Spalte und sonst nirgends.**

Ebenso: `channex_review.tags` wird gespiegelt, aber nie angezeigt.
`guest_review_queue.tags` steht im Schema, wird nie befüllt.
`get_property_scores` (Channex-Score je Objekt) existiert im Backend und wird von
keinem Frontend genutzt.

### 🟡 6. Kategorien beim Bewerten des Gastes

API und DB führen drei Kategorien (`GuestScores`), **die Oberfläche schickt nur
Note und Text** (`bewertungs-cockpit.tsx:369-378`). Hostaway fragt alle drei ab.

### 🟡 7. Keine Live-Aktualisierung für Portal-Bewertungen

Bewusst gestrichen (Migration 0337 sperrt `channex_review` für den Direktpfad),
an drei Stellen ehrlich kommentiert. Folge: eine neue Booking- oder
Airbnb-Bewertung erscheint erst beim nächsten Seitenaufruf. Der saubere Weg wäre
ein Abo auf eine erlaubte Quelle, nicht ein Grant auf die gesperrte Tabelle.

### ⚠️ 8. Kleinigkeit mit Fehlerpotenzial

`run_maintenance` ist als `tuple[int, int, int, int]` annotiert
(`service.py:1106`), gibt aber **sechs** Werte zurück (`:1129`). Beide Aufrufer
entpacken korrekt sechs — die Annotation und der Docstring sind schlicht falsch.

---

## Teil 4 — Was wir von Hostaway übernehmen sollten

**Übernehmen:**

1. **Mehrere Textvorlagen mit Zufallsauswahl.** Ihre Begründung ist ein echter
   Betriebsbefund, den wir sonst schmerzhaft selbst lernen: *„Airbnb may penalize
   this practice, and it may affect the SEO."* Wir schicken heute **einen** festen
   Text aus `review_automation.auto_review_public` — bei 500 Reservierungen also
   500-mal denselben Satz. Das ist genau das Muster, vor dem Hostaway warnt.
2. **Spaltenwahl, die zugleich den Export steuert.** Ein Mechanismus, zwei Nutzen.
3. **Filter auf Notenbereich** (`ratingMin`/`ratingMax`) und **Namenssuche** —
   beides billig, beides fehlt uns.
4. **Sechs Status statt fünf.** Uns fehlt die Unterscheidung zwischen „beim Portal
   erzeugt, aber noch nicht abgegeben" (`pending`) und „abgegeben, aber noch
   verdeckt" (`submitted`). Wir bilden das heute über `is_hidden` ab, was weniger
   klar ist.
5. **`UPDATE` und `SEND` als getrennte Knöpfe.** „Ändern und zum geplanten
   Zeitpunkt senden" ist etwas anderes als „jetzt abschicken". Unsere
   Warteschlange hat beides (`update_queue_entry`, `send_queue_entry`) — die
   Oberfläche sollte es genauso deutlich trennen.
6. **Platzhalter-Knopf `{}` mit Vorschau-Klappe** an jedem Textfeld. Wir haben
   einen Platzhalter-Katalog (`nachrichten-platzhalter`), aber in den
   Bewertungstexten keinen Zugriff darauf — die Texte sind heute reine Textareas.
7. **Die Warnung im Antwort-Dialog.** *„cannot be edited once posted"* — bei uns
   ist das genauso wahr (Portale kennen kein Zurücknehmen, nur der Marktplatz),
   steht aber nirgends. Ein Satz, der eine irreversible Handlung ankündigt, gehört
   an die Handlung.
8. **`Origin` als eigene Spalte und eigener Filter**, nicht nur als Zeilenfarbe.
   Farbe allein ist kein Bedienelement — man kann nicht danach filtern, und sie
   ist für farbschwache Nutzer wertlos.
9. **Kanal-Logos an jeder Kategorie-Kennzahl.** Die stärkste Idee des ganzen
   Dashboards. Kategorien sind je Portal verschieden — „Comfort", „Facilities",
   „Staff" gibt es nur bei Booking, „Accuracy" und „Checkin" nur bei Airbnb. Ein
   Durchschnitt über verschiedene Grundgesamtheiten ohne diesen Hinweis ist
   irreführend. **Unsere Kategorie-Balken zeigen heute keinerlei Herkunft.**
10. **Kennzahl als Anteil, nicht als nackte Zahl.** `196 / 394` statt „196", mit
    eingefärbtem Zähler und grauem Nenner. Ordnet die Zahl sofort ein. Unsere
    Kacheln zeigen „Anzahl: 175" ohne Bezugsgröße.
11. **Filterknopf mit Zähler-Abzeichen.** Zeigt, *dass* gefiltert wird, ohne dass
    die Leiste aufgeklappt bleiben muss. Bei uns steht die Filterleiste immer offen
    und kostet dauerhaft Platz.

**Nicht übernehmen:**

1. **Zwei getrennte Zeilen je Reservierung** (dunkel/hell). Für eine Tabelle mit
   konfigurierbaren Spalten mag das gehen; unser Kartenlayout wird davon nur
   unübersichtlich. Besser: eine Karte je Reservierung mit beiden Richtungen.
2. **Alles auf 0–10 zwingen.** Unsere Zwei-Skalen-Lösung ist ehrlicher.
3. **Auswertung an einen anderen Ort legen.** Hostaway verteilt Bewertungen auf
   *Reservations* und *Listings* — unsere vier Reiter an einem Ort sind besser.
4. **Note der Auto-Bewertung fest verdrahten.** Unsere freie Wahl plus
   `min_rating`-Bedingung ist die reifere Lösung.

---

## Teil 5 — Vorschlag zur Reihenfolge

**Zuerst, weil es die Lücke schließt, die den Vergleich verloren hat:**

1. **KI-Auswertung der Bewertungen.** Drei Bausteine, aufsteigend im Aufwand:
   Stimmung je Bewertung beim Import (ein Vertex-Aufruf je neuer Bewertung, nicht
   je Ansicht) → Themen-Zusammenfassung je Objekt über einen Zeitraum →
   Antwortvorschlag. Der Rohstoff liegt vollständig vor, das Dashboard existiert,
   und Vertex läuft bereits in `europe-west4`.

**Danach, weil billig und mit klarem Nutzen:**

2. **Mehrere Auto-Text-Vorlagen** statt eines festen Textes (Hostaways
   Penalty-Warnung).
3. **Objektfilter, Notenbereich, Namenssuche** in der Cockpit-Oberfläche — der
   API-Filter existiert teils schon.
4. **Benachrichtigung bei schlechter Bewertung** — Melde-Katalog steht,
   `reviews` fehlt als Ereignis. Hier wären wir **vor** Hostaway.
5. **Die drei Kategorien beim Bewerten des Gastes** in die Oberfläche holen.

**Aus den Bildschirmfotos, noch nicht bedacht:**

5b. **Eine manuelle Bewertung muss die geplante ersetzen — bei uns tut sie es
    nicht.** Hostaway sagt es im Dialog ausdrücklich: *„This review will
    substitute any auto-review for that reservation."*

    **Am Code nachgeprüft, mit Entwarnung und einem Restfehler.** Der Ablauf bei
    uns: `send_ota_guest_review` (`service.py:736`) prüft `guest_review_sent_at`
    und wirft 409, wenn schon bewertet wurde. Die Warteschlange ruft über
    `_senden_ota` (`queue.py:398`) genau diese Methode auf, `send_entry` fängt den
    Fehler und schreibt `status='fehler'` mit Grund.

    **Es geht also keine Doppelbewertung ans Portal** — Wurzel 2 ist gewahrt.

    Der Fehler liegt eine Ebene höher: `send_ota_guest_review` **räumt die
    Warteschlange nicht auf** (kein `update` auf `guest_review_queue`). Folge: Wer
    einen Gast von Hand bewertet, findet Tage später einen roten Eintrag in seiner
    Warteschlange — *„Für diese Bewertung wurde der Gast bereits bewertet."* Ein
    gemeldeter Fehler, obwohl der Betrieb alles richtig gemacht hat.

    Richtig wäre: beim manuellen Bewerten den offenen Eintrag derselben
    Reservierung auf `uebersprungen` setzen, mit Grund „von Hand bewertet". Das
    ist der Gegenzustand aus Wurzel 1 — eine Handlung, die einen geplanten Vorgang
    gegenstandslos macht, muss ihn auch abräumen. Dasselbe gilt für den
    Marktplatz-Pfad (`insert_guest_rating`, `service.py:625`), der bei
    UNIQUE-Verletzung 409 wirft.

**Aufräumen, kein Neubau:**

6. **`is_read` / `is_archived` / `assigned_user_id`** entweder anschließen oder
   ersatzlos streichen. Spalten ohne Oberfläche sind Ballast, der bei jeder
   späteren Änderung mitgedacht werden muss.
7. **Typannotation von `run_maintenance`** berichtigen.
8. **Export** (CSV), gekoppelt an eine Spaltenwahl.

---

## Nicht geprüft

* **Der Reiter „Review Templates"** — auf keinem Bild zu sehen; die Hilfe nennt
  ihn, die Oberfläche zeigt nur zwei Reiter. Möglicherweise kontoabhängig oder
  entfallen.
* **Die drei verdeckten Filterfelder** in der Reviews-Leiste (zwischen
  „To (check-out)" und „Tags") — im Bild vom Dialog überlagert.
* **Der Dialog hinter `ADD AUTO-REVIEW`** — nur die Kartenansicht ist belegt, die
  Felder des Anlege-Formulars stammen aus der Hilfe.
* **Die Filter-Klappe** des Quality-Dashboards — der Knopf ist sichtbar, sein
  Inhalt nicht. Datumsspanne ist belegt, weitere Filter sind es nicht.
* **Der Schwellwert der Farbcodierung** bei den Reviews-Quality-Kacheln. Sichtbar
  ist orange unter ~4,7 und schwarz darüber; ob das eine feste Grenze oder ein
  Vergleich gegen einen Richtwert ist, sagt kein Bild.
* **Was „Read more" in der Listings-Tabelle öffnet.**
* **Konkrete Gestaltungswerte** — Farbwerte, Abstände, Radien, Schriftgrößen sind
  aus Bildschirmfotos nur geschätzt, nicht gemessen. Für den Nachbau bleibt unser
  eigenes Design-System maßgeblich.
* **Struktur von `reviewCategory`** — im Doku-Beispiel leer, nicht dokumentiert.
* **Exportformat** — „Download report" ist belegt, das Format nicht.
* **Aggregationsebene der Review Insights** (Objekt/Kanal/gesamt).
* **Unsere eigene Oberfläche im Browser.** Der Debug-Zugang scheiterte an der
  Anmeldung; die Beschreibung unserer Seiten stammt aus dem Quelltext. Für den
  Funktionsumfang reicht das, für ein Urteil über die Gestaltung nicht.
