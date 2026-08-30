# Ausbauplan Bewertungen

**Stand 30.08.2026.** Grundlage: [BEWERTUNGEN-HOSTAWAY-ANALYSE.md](BEWERTUNGEN-HOSTAWAY-ANALYSE.md)
(Hostaways Funktionsumfang und Oberfläche, aus API-Doku, Hilfe-Center und acht
Bildschirmfotos) und die vollständige Kartierung unseres Moduls.

**Dieser Plan ist noch nicht freigegeben.** Nichts davon ist gebaut.

---

## Ausgangslage in einem Absatz

Unser Bewertungsmodul ist Hostaways in fast allem ebenbürtig oder überlegen: 6
Kategorien statt 5 Tags, eigene Double-Blind-Umsetzung, echte Warteschlange mit
Frist und Fehlergrund, frei wählbare Auto-Note statt fest verdrahteter 5, beide
Notenskalen erhalten. Es fehlen drei Dinge: **die Deutung der Texte** (KI), **ein
paar Bedienelemente**, und es gibt **zwei Fehler**, die vorher weg müssen.

Die Reihenfolge unten folgt daraus: erst reparieren, dann die KI (die den
Vergleich entscheidet), dann die Oberfläche, dann aufräumen.

---

## Etappe 0 — Zwei Fehler reparieren

Beides ist klein und beides ärgert den Betrieb heute schon.

### 0.1 Manuelle Bewertung räumt die Warteschlange nicht ab

**Was passiert:** Ein Betrieb bewertet einen Gast von Hand
(`POST /reviews/ota/{id}/guest-review`). In `guest_review_queue` liegt noch ein
Entwurf mit `status='geplant'` für dieselbe Reservierung. Tage später versucht der
Worker ihn zu senden, bekommt vom eigenen Dienst einen 409 und schreibt
`status='fehler'` mit dem Text *„Für diese Bewertung wurde der Gast bereits
bewertet."*

**Entwarnung:** Es geht **keine** Doppelbewertung ans Portal — der Schutz greift
(`service.py:743-748`). Der Fehler ist die falsche Meldung, nicht ein Datenschaden.

**Fix:** `send_ota_guest_review` und `insert_guest_rating` setzen einen offenen
Eintrag derselben Reservierung auf `uebersprungen`, Grund „von Hand bewertet".
Das ist der Gegenzustand aus Wurzel 1.

Hostaway macht das explizit und schreibt es dem Nutzer sogar in den Dialog:
*„This review will substitute any auto-review for that reservation."*

Berührt: `reviews/service.py`, Test im Slice.

### 0.2 Falsche Typannotation

`run_maintenance` ist als `tuple[int, int, int, int]` annotiert
(`service.py:1106`), gibt aber sechs Werte zurück (`:1129`). Beide Aufrufer
entpacken korrekt sechs. Annotation und Docstring berichtigen.

---

## Etappe 1 — KI-Auswertung der Bewertungen

Die einzige echte Lücke gegenüber Hostaway. Drei Bausteine, aufsteigend im
Aufwand; jeder für sich nützlich.

### 1.1 Stimmung und Themen je Bewertung, beim Import

**Wann:** einmal je neuer Bewertung, im Spiegel-Pfad (`reviews_sync.py`) und beim
Abgeben einer Marktplatz-Bewertung — **nicht** beim Ansehen.

Das ist die entscheidende Entwurfsentscheidung. Unser Posteingang hat sie schon
einmal getroffen, mit Begründung im Code (`ki_antwort.py:100`): *„Kein zweiter
Vertex-Aufruf je Gastnachricht: bei 556 Reservierungen wäre der auf der Rechnung
spürbar."* Bei Bewertungen ist die Lage günstiger — es gibt viel weniger
Bewertungen als Nachrichten, und eine Bewertung ändert sich nach dem Import nicht
mehr. Ein Aufruf je Bewertung, das Ergebnis wird gespeichert.

**Was das Modell liefert:**

| Feld | Inhalt |
|---|---|
| `stimmung` | `positiv` \| `neutral` \| `negativ` |
| `themen` | Liste aus einem **festen Katalog**, z. B. `sauberkeit`, `lage`, `ausstattung`, `kommunikation`, `anreise`, `laerm`, `preis` |
| `kernaussage` | ein Satz, der die Bewertung zusammenfasst |

Der Themen-Katalog ist bewusst **geschlossen**. Freie Themen aus einem Modell sind
nicht vergleichbar — „Bad war schmutzig" und „Sauberkeit mangelhaft" wären zwei
Themen, und jede Trendauswertung darüber wäre wertlos. Hostaway löst dasselbe
Problem, indem es die fünf Airbnb-Kategorien nimmt; unser Katalog darf reicher
sein, muss aber fest bleiben.

**Migration:** drei Spalten an `reviews` und `channex_review`
(`ki_stimmung`, `ki_themen jsonb`, `ki_kernaussage`), dazu `ki_bewertet_at`.
Fehlt die Auswertung, wird nichts angezeigt — kein Ersatzwert (Wurzel 4).

**Neue Bewertungen** laufen automatisch durch. Für den Bestand ein einmaliger
Nachziehlauf über den Worker, gedeckelt, mit Fortschritt im Log.

### 1.2 Auswertung im Qualitäts-Dashboard

Mit 1.1 im Rücken ist das reine Aggregation, kein weiterer Modellaufruf:

* **Stimmungsverteilung** über den Zeitraum (positiv/neutral/negativ)
* **Häufigste negative Themen**, absteigend — „7× Sauberkeit, 4× Lärm"
* **Verlauf je Thema**, damit sichtbar wird, ob etwas schlimmer wird

Das beantwortet die Frage, die unser Dashboard heute offenlässt: Es sortiert das
schwächste Objekt nach vorn, sagt aber nicht, **warum** es schwach ist.

### 1.3 Zusammenfassung je Objekt

Ein Modellaufruf **auf Knopfdruck**, nicht automatisch: „Was sollte ich an diesem
Objekt verbessern?" — aus allen Bewertungen des gewählten Zeitraums.

Auf Knopfdruck, weil es der teuerste Aufruf ist und weil eine Zusammenfassung, die
niemand liest, verbranntes Geld ist. Ergebnis wird gespeichert und mit Datum
angezeigt, damit nicht bei jedem Aufruf neu gerechnet wird.

### 1.4 Antwortvorschlag

Für eine einzelne Bewertung einen Antwortentwurf erzeugen — Sprache der Bewertung,
Tonfall aus dem vorhandenen KI-Profil, Fakten nur aus der Bewertung selbst.

**Nie automatisch senden.** Eine Bewertungsantwort ist öffentlich und bei den
Portalen nicht zurücknehmbar; das ist eine andere Risikoklasse als eine Nachricht
an einen Gast. Vorschlag hinlegen, Mensch entscheidet.

**Hostaway hat das nicht** — sie verweisen für KI-Antworten auf Bewertungen auf
zugekaufte Partner (Revyoos, Review Lawyers). Hier würden wir vorziehen.

---

## Etappe 2 — Die Oberfläche

Was wir von Hostaway übernehmen, in der Reihenfolge des Nutzens. Gebaut wird in
**unserem** Design-System, nicht als Nachbau ihres Aussehens.

### 2.1 Kanal-Herkunft an jeder Kategorie-Kennzahl

**Hostaways beste Idee.** Jede Kachel trägt die Logos der Portale, aus denen ihr
Wert stammt. Dadurch ist sofort erkennbar, dass „Comfort", „Facilities" und
„Staff" nur von Booking kommen, „Accuracy" und „Checkin" nur von Airbnb.

Wir zeigen unsere Kategorie-Balken heute **ohne jeden Herkunftshinweis** — ein
Durchschnitt über verschiedene Grundgesamtheiten, der so aussieht wie ein
Durchschnitt über dieselbe.

Das Muster gibt es bei uns schon: `packages/ui/src/channel-badge.tsx` macht
genau das für Formularfelder („wohin geht dieses Feld?"). Es auf Kennzahlen
anzuwenden ist eine Erweiterung, kein Neubau. Logos aus `lib/channel-logos.ts`.

### 2.2 Kennzahl als Anteil statt als nackte Zahl

`196 / 394` mit eingefärbtem Zähler und grauem Nenner ordnet die Zahl sofort ein.
Unsere Kacheln zeigen „Anzahl: 175" ohne Bezugsgröße.

Betrifft „unbeantwortet" (von wie vielen?) und die 5-Sterne-Quote.

### 2.3 Objektfilter, Notenbereich, Namenssuche

`property_id` ist als API-Filter längst da (`router.py:52`) und hat **kein
Bedienelement**. Dazu Notenbereich (Hostaway: `ratingMin`/`ratingMax`) und
Namenssuche.

### 2.4 Filterknopf mit Zähler-Abzeichen

Statt einer immer offenen Leiste ein Knopf `Filter` mit der Anzahl aktiver Filter
als Abzeichen, aktive Filter als entfernbare Marken daneben, `Zurücksetzen`.
Spart dauerhaft Platz und zeigt trotzdem, dass gefiltert wird.

### 2.5 Herkunft als Spalte und Filter

Hostaway unterscheidet Gast-Bewertung und Betriebs-Bewertung nicht nur farblich,
sondern als eigene Spalte `Origin` **mit Filter**. Farbe allein ist kein
Bedienelement — man kann nicht danach filtern, und für farbschwache Nutzer ist sie
wertlos.

Bei uns steht die Betriebs-Bewertung heute gar nicht in der Liste; sie ist nur
über den Knopf „Gast bewerten" an der Gast-Bewertung erreichbar.

**Nicht übernehmen:** Hostaways zwei getrennte Zeilen je Reservierung
(dunkel/hell). Für eine Tabelle mit konfigurierbaren Spalten mag das gehen; unser
Kartenlayout wird davon unübersichtlich. Besser: eine Karte je Reservierung, die
beide Richtungen zeigt.

### 2.6 Warnung vor unumkehrbaren Handlungen

Hostaways Antwort-Dialog sagt: *„Review responses will be posted immediately after
you publish them, and they cannot be edited once posted."*

Bei uns ist das genauso wahr — Portale kennen kein Zurücknehmen, nur der
Marktplatz —, steht aber **nirgends**. Ein Satz an der Handlung, nicht in der
Hilfe.

### 2.7 Platzhalter-Knopf mit Vorschau

An den Textfeldern der Automatik und der Warteschlange: ein `{}`-Knopf, der den
Platzhalter-Katalog öffnet, und eine Klappe „Vorschau", die den Text mit
aufgelösten Werten zeigt.

Wir haben einen Platzhalter-Katalog (`nachrichten-platzhalter`), aber in den
Bewertungstexten keinen Zugriff darauf — die Felder sind heute reine Textareas.

### 2.8 Die drei Kategorien beim Bewerten des Gastes

API und DB führen `GuestScores` (Sauberkeit, Kommunikation, Hausregeln), die
Oberfläche schickt **nur Note und Text** (`bewertungs-cockpit.tsx:369-378`).
Hostaway fragt alle drei ab, als Sternereihen.

### 2.9 Ändern und Senden als getrennte Knöpfe

In der Warteschlange: „Ändern und zum geplanten Termin senden" ist etwas anderes
als „jetzt abschicken". Beide Vorgänge gibt es bei uns bereits
(`update_queue_entry`, `send_queue_entry`) — die Oberfläche sollte sie so deutlich
trennen wie Hostaways `UPDATE` / `SEND`.

---

## Etappe 3 — Fachliche Ergänzungen

### 3.1 Mehrere Textvorlagen mit Zufallsauswahl

**Der wichtigste Übernahme-Kandidat.** Hostaway verlangt **mindestens drei**
Vorlagen und begründet es wörtlich: *„Airbnb may penalize this practice, and it may
affect the SEO."*

Wir schicken heute **einen** festen Text aus
`review_automation.auto_review_public` — bei 500 Reservierungen also 500-mal
denselben Satz unter demselben Objekt. Genau das Muster, vor dem sie warnen.

Umsetzung: `auto_review_public` von `text` auf eine Liste erweitern (neue Tabelle
oder jsonb), beim Befüllen der Warteschlange zufällig eine wählen. Der Text steht
danach in der Warteschlangen-Zeile und ist dort einzeln änderbar — das
funktioniert schon so.

### 3.2 Benachrichtigung bei schlechter Bewertung

Ein neues Ereignis im Melde-Katalog: Bewertung unterhalb einer einstellbaren
Schwelle. Der Katalog steht, `reviews` fehlt als Ereignis.

**Hostaway hat das nachweislich nicht** — ihre komplette Benachrichtigungsliste
(Reservations 5, Tasks 5, Messages 4, Payment 6, Listings 4, Account 2,
Exceptions 1) enthält keinen einzigen Bewertungs-Eintrag. Hier ziehen wir vor.

Pflichtprüfung dabei: `melde-ziele-pruefen.mjs`, damit der Link in der Mail nicht
ins Leere geht.

### 3.3 Sechs Status statt fünf

Uns fehlt die Unterscheidung zwischen „beim Portal erzeugt, noch nicht abgegeben"
(`pending`) und „abgegeben, aber noch verdeckt" (`submitted`). Wir bilden das über
`is_hidden` ab, was weniger klar ist.

Hostaways Statusfluss ist belegt:

```
Awaiting ──▶ Pending ──┬──▶ Submitted ──▶ Published
                       │         ▲
                       └──▶ Scheduled ──┘
                                  └──────────────▶ Expired
```

Zu prüfen, ob sich das lohnt oder ob `is_hidden` plus unsere Warteschlangen-Status
ausreichen. **Meine Einschätzung: eher nicht übernehmen** — wir haben die
Information, nur anders benannt, und ein Statuswechsel ist eine Migration mit
Folgen in fünf Frontends.

### 3.4 Export mit Spaltenwahl

Hostaways Zahnrad steuert Spalten **und** Export in einem. Wir haben weder das eine
noch das andere. CSV reicht.

---

## Etappe 4 — Aufräumen

Kein Neubau, aber es reduziert die Fläche für künftige Fehler.

* **`is_read`, `is_archived`, `assigned_user_id`** (`channex_review`, 0262:54-56):
  angelegt, aber nirgends gesetzt oder gefiltert. Nur `is_archived = false` wird
  beim Lesen vorausgesetzt. **Zuweisung an einen Mitarbeiter existiert als Spalte
  und sonst nirgends.** Entweder anschließen (Etappe 2) oder streichen.
* **`channex_review.tags`** wird gespiegelt, aber nie angezeigt.
  **`guest_review_queue.tags`** steht im Schema, wird nie befüllt.
* **`get_property_scores`** (Channex-Score je Objekt, `ota_extras.py:196`)
  existiert im Backend und wird von keinem Frontend genutzt.
* **Kein Realtime für Portal-Bewertungen** — bewusst gesperrt (Migration 0337), an
  drei Stellen ehrlich kommentiert. Folge: eine neue Booking- oder
  Airbnb-Bewertung erscheint erst beim nächsten Seitenaufruf. Der saubere Weg wäre
  ein Abo auf eine erlaubte Quelle, **nicht** ein Grant auf die gesperrte Tabelle.

---

## Vorschlag zur Reihenfolge

| # | Etappe | Warum hier |
|---|---|---|
| 1 | **0.1 + 0.2** | Fehler, die heute Meldungen erzeugen. Klein. |
| 2 | **1.1 Stimmung + Themen** | Fundament für alles Weitere; ohne die Daten kein Dashboard. |
| 3 | **1.2 Auswertung im Dashboard** | Macht 1.1 sichtbar. Reine Aggregation. |
| 4 | **3.1 Mehrere Vorlagen** | Betriebsrisiko (Airbnb-Penalty), kleine Änderung. |
| 5 | **2.1 Kanal-Herkunft** | Behebt eine irreführende Darstellung, die wir heute haben. |
| 6 | **2.3 + 2.4 Filter** | Sichtbarer Nutzen je Handgriff. |
| 7 | **1.4 Antwortvorschlag** | Hier ziehen wir an Hostaway vorbei. |
| 8 | **2.6 Warnung** | Ein Satz, verhindert einen echten Fehlgriff. |
| 9 | **Rest** | 1.3, 2.2, 2.5, 2.7–2.9, 3.2, 3.4, Etappe 4 |

Etappen 1–4 sind ein zusammenhängender Block: danach hat das Modul die KI-Hälfte,
die ihm fehlt, und der bekannte Betriebsfehler ist weg.

---

## Was dieser Plan bewusst NICHT vorschlägt

* **Hostaways Aussehen nachbauen.** Übernommen werden Ideen (Kanal-Herkunft,
  Anteilszahlen, Filterabzeichen), nicht Farben und Abstände. Unser Design-System
  bleibt maßgeblich.
* **Auf 0–10 normalisieren.** Hostaway zwingt alle Kanäle auf eine Skala und zeigt
  nur die. Wir führen die Rohnote mit und rechnen nur fürs Sortieren um. Das ist
  ehrlicher und bleibt.
* **Die Auswertung an einen anderen Ort legen.** Hostaway verteilt Bewertungen auf
  *Reservations* und *Hosting Quality* — zwei Hauptmenüpunkte für eine Sache.
  Unsere vier Reiter an einem Ort sind besser.
* **Auto-Note fest verdrahten.** Hostaway kann nur 5 Sterne
  (*„It is not possible to modify this in the auto-review"*). Unsere freie Wahl
  plus `min_rating`-Bedingung ist reifer.
* **Bewertungen automatisch beantworten.** Vorschlag ja, Automatik nein — siehe
  1.4.

---

## Offene Fragen an dich

1. **Themen-Katalog:** Reichen die sieben genannten (`sauberkeit`, `lage`,
   `ausstattung`, `kommunikation`, `anreise`, `laerm`, `preis`), oder fehlt etwas,
   das du in euren Bewertungen regelmäßig siehst?
2. **Bestand nachziehen:** Sollen vorhandene Bewertungen einmalig durch die
   KI-Auswertung laufen? Das kostet einen Modellaufruf je Bewertung — bei ein paar
   hundert vernachlässigbar, die Zahl sollte ich vorher aus der Live-DB holen.
3. **Etappe 3.3 (sechs Status):** Meine Einschätzung ist „nicht lohnend". Wenn du
   das anders siehst, sag es — es ist eine Migration mit Folgen in fünf Frontends.
