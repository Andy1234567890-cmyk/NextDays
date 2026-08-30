# KI-Vergleich: myNextDays gegen Hostaway AI

**Stand 30.08.2026.** Grundlage ist die Hostaway-Seite „Hostaway AI" und eine
Prüfung unseres Codes Datei für Datei. Jede Aussage hier ist am Code belegt,
nicht aus dem Gedächtnis geschrieben. Wo etwas fehlt, steht das ohne Beschönigung;
wo wir weiter sind als Hostaway, steht das auch.

Die Zählung vorweg, damit die Lage nicht schöngeredet wird: von den sieben
Kategorien, mit denen Hostaway wirbt, haben wir **drei vollständig**, **drei
teilweise** und **eine gar nicht**. Der größte Rückstand liegt nicht dort, wo
man ihn vermutet — nicht bei den Gastantworten, sondern bei den **Bewertungen**.
Und die zwei billigsten Zugewinne sind kein Neubau, sondern das Anschließen von
Dingen, die fertig herumliegen.

---

## Überblick

| Hostaway-Kategorie | Bei uns | Kurz |
|---|---|---|
| AI Replies (Gastantworten) | 🟢 **vollständig** | 3.832 Zeilen; Regeln, Wissensdatenbank, Kontext aus 5 Quellen, 24 Sprachen |
| AI Revenue Management | 🟢 **vollständig, tiefer** | 10 Faktoren, gelernte Pickup-Kurve, ereignisgetrieben |
| Task Management | 🟡 **teilweise** | Checklisten, Fotopflicht, Abnahme da — **Auto-Zuweisung fehlt** |
| AI Sentiment & Escalations | 🟡 **teilweise** | binärer Marker statt Stimmungsskala; **eine Regel-Art wirkt gar nicht** |
| Payments & Protections | 🟡 **teilweise** | Einzug erstklassig — **kein Betrugsschutz, keine Gast-Nachricht bei Fehlschlag** |
| AI CoHost (Assistent) | 🟡 **gebaut, abgeschaltet** | 1.942 Zeilen Sprachassistent liegen brach; 71 MCP-Werkzeuge über Claude |
| Hosting Quality / Review Insights | 🔴 **fehlt** | Zahlen-Dashboard steht, aber **null KI in den Bewertungen** |

KI läuft bei uns in genau **zwei** Slices: `inbox` und `site_config`. In
`reviews/`, `guest_reviews/`, `properties/`, `dashboard/` und `pricing/` gibt es
keinen einzigen Vertex-Aufruf.

---

## 1. Was wir haben — und wo wir vorn liegen

### AI Replies 🟢

Hostaway wirbt mit „bis zu 90 % automatisiert". Unsere Umsetzung ist
funktional gleichwertig und in zwei Punkten strenger:

* **Senden oder Entwurf, je Regel** — `ki_regeln.py:341` `zustellart_entscheiden`,
  fünfstufige Rangfolge.
* **Nicht abschaltbare Sperre** für Geld, Zahlung, Sicherheit, Verfügbarkeit
  (`ki_regeln.py:59-87`). Greift auch dann, wenn eine Regel es ausdrücklich
  erlaubt. Hostaway beschreibt nichts Vergleichbares.
* **Zugangsdaten erst bei bestätigter Buchung** (`ki_kontext.py:646`) — Türcode
  und WLAN gehen bei unbestätigter Reservierung nicht in den Prompt.
* **Kontext aus fünf Quellen**, bei jedem Aufruf frisch (`ki_kontext.py:563`).
* **Sprache des Gastes**, nicht geraten sondern aus der Buchung
  (`ki_antwort.py:212`).
* **Lernen aus manuellen Antworten** (`ki_lernen.py:136`), eigene KI-Antworten
  bewusst ausgeschlossen: `QUELLEN_ZUM_LERNEN = frozenset({"manuell"})`.

### AI Revenue Management 🟢 — hier sind wir weiter

Hostaway nennt eine Zahl (25,1 % mehr Umsatz), aber kein Verfahren. Unseres ist
belegbar tief:

* **Zehn Faktoren** multiplikativ (`engine.py:427-446`): Saison, Ereignis,
  Wochenende, Auslastung, Pickup, Last-Minute, Lücken, Markt, Wetter, eigene Regeln.
* **Gelernte Pickup-Kurve je Objekt und Saison** (`forecast.py:59`), trainiert
  aus echten Momentaufnahmen, mit Kaltstart-Schutz (`_MIN_OBSERVATIONS = 8`).
* **Ereignisgetriebene Neuberechnung**: jede Buchung und jeder Storno stößt sie an
  (`reservations/_base.py:327`), zusätzlich ein Cron über 540 Tage.
* **Gap Nights** erkannt und verbilligt (`recompute.py:658`, Standard 15 %).

### Aufgaben — das Umfeld ist stark 🟡

* Checklisten je Aufgabe mit Räumen und Reihenfolge, Vorlagen je Regel
* **Fotopflicht, hart durchgesetzt**: fehlt ein Nachweis, schlägt der Abschluss
  mit 422 fehl (`service.py:1874`)
* Abnahme durch Inspektion (`service.py:1998`)
* **Automatische Verschiebung bei geänderten Gastzeiten** (`engine.py:684`) —
  idempotent, an sechs Aufrufstellen verdrahtet, Erledigtes bleibt erledigt

### Zahlungseinzug 🟢

Echter Off-Session-Einzug mit gemerkter Karte, stündlicher Lauf, Idempotenz-Schlüssel
je Zahlung, Claim-Guard. Das ist solide gebaut.

---

## 2. Was fehlt

### 🔴 A. Bewertungen sind eine KI-freie Zone

**Das ist die größte Lücke.** Hostaway macht daraus zwei beworbene Merkmale
(„Review Insights", „Hosting Quality Dashboard"); bei uns steht die Statistik,
aber keine Auswertung.

Belegt: `grep` nach `VertexClient|core.ki|sentiment` über `reviews/` und
`guest_reviews/` — **null Treffer**.

Was da ist: ein echtes Qualitäts-Dashboard (`reviews/router.py:156`,
`/qualitaet`, seit 30.08.2026 eigener Menüpunkt) mit Durchschnitt, 5-Sterne-Quote, Antwortquote,
Kategorie-Scores, Zeitreihe und Objekt-Rangliste — schwächstes Objekt zuerst.

Was fehlt:

1. **Stimmungs-Trends über Bewertungen hinweg.** Welche Themen tauchen wiederholt
   negativ auf?
2. **Zusammenfassung des Verbesserungspotenzials.** Das Dashboard sortiert das
   schwächste Objekt nach vorn, sagt aber nicht, *warum* es schwach ist.
3. **Antwortvorschläge auf Bewertungen.** Antworten geht nur von Hand
   (`reviews/service.py:548`), ohne jeden Vorschlag — während es für
   Gast*nachrichten* längst einen gibt.

Der Rohstoff liegt vollständig vor: alle Bewertungen mit Text, Note, Kategorien
und Kanal.

### 🔴 B. Keine KI für Objekt- und Inseratstexte

`ki_texte.py` kann Umschreiben, SEO, Abschnitte, Blogbeiträge — aber
**ausschließlich für Website-Seiten des Baukastens** (`seo_erzeugen` arbeitet auf
`req.page_id`, `_seite_lesen` liest `site_pages`).

Objektdaten werden nur **gelesen**, als Faktenquelle (`ki_profil.py:224`). Der
`properties`-Slice enthält null KI-Treffer, und in `web/components/objekte/`
gibt es keinen KI-Knopf — die Beschreibungsfelder sind reine Textfelder.

Hostaway wirbt ausdrücklich mit „Optimize your listing descriptions with AI".

### 🟡 C. Stimmung ist binär, nicht dreistufig

Wir erkennen negativ oder nicht (`ki_antwort.py:287`, Marker
`[STIMMUNG NEGATIV: <grund>]`). Hostaway unterscheidet positiv / neutral / negativ.

Das war eine **bewusste Entscheidung** und steht so im Code (`ki_antwort.py:100`):
*„Kein zweiter Vertex-Aufruf je Gastnachricht: bei 556 Reservierungen wäre der auf
der Rechnung spürbar."* Die Entscheidung ist verteidigbar — sie sollte nur nicht
aus Versehen bestehen bleiben, falls die Skala später gebraucht wird.

Filtern nach eskalierten Gesprächen geht (`inbox-list.tsx:144`), allerdings
clientseitig; ein serverseitiger Filter fehlt.

### 🟡 D. Kein Betrugsschutz

Hostaway wirbt mit „AI fraud protections". Bei uns:

* Kein Stripe Radar, keine eigenen Risikoregeln
* `radar.early_fraud_warning.created` und `review.opened` laufen in
  `case _: log.info("stripe_webhook_ignored")` (`webhook.py:127-252`)
* 3DS nur implizit über `automatic_payment_methods`

Was es gibt, ist Schadensbegrenzung *nach* dem Fall: bei einer Rückbuchung wird
die Auszahlung 45 Tage zurückgehalten (`webhook.py:191`).

### 🟡 E. Keine Auto-Zuweisung von Aufgaben

Suche nach `auto_assign|round_robin|workload|skill|verfuegbar|distance` im
tasks-Slice: **0 Treffer**. Die Zuweisung kommt statisch aus der Regel
(`engine.py:361`) oder von Hand (`service.py:1552`). Die Auswahlliste filtert
nach Berechtigung, nicht nach Eignung.

Hostaway nennt das „intelligent routing … adapted to your guests' ever-changing
schedules". Die *Zeitanpassung* haben wir vollständig — nur die *Personenwahl* nicht.

### 🟡 F. Keine Regel-Generierung aus dem Schriftverkehr

Hostaway wirbt damit konkret, mitsamt Kundenstimme: *„The AI generated 12 rules
for replies covering check-in/check-out, tone of voice, discounts…"*

Bei uns: Regeln selbst anlegen geht voll (bis 50 Stück). Aber die Suche nach
`regel_vorschlag|regeln_vorschlagen|regel_generier|suggest_rule` über Backend und
alle Frontends ergibt **null Treffer**. Was existiert, sind **8 fest verdrahtete
Vorlagen** in `web/components/inbox/ki-vorlagen-regeln.tsx:21-34` — eine statische
Liste zum Übernehmen, nicht aus dem eigenen Schriftverkehr gelernt.

Der Rohstoff wäre da: `ki_lernen.py` wertet manuell gesendete Nachrichten bereits
aus, allerdings zu *Fakten*, nicht zu *Regeln*.

### 🟡 G. Keine Automatisierungsquote

`kennzahlen.py` misst gesendet, empfangen, per Automation, ungelesen — aber nicht,
welchen Anteil die KI übernimmt. Hostaway stellt genau diese Zahl in den
Mittelpunkt („90 % automatisiert").

Die Daten liegen **vollständig** in `ki_antwort_protokoll` (0493): jede Antwort mit
Zustellart, Sendezeitpunkt, Grund und Tokenverbrauch. Es fehlt nur die Auswertung.

### 🟡 H. Kein Upsell durch Gast-Signale

Der Zusatzleistungs-Katalog ist vollständig (3.514 Zeilen), aber er ist Auslage,
kein Workflow. Die Automatisierungs-Trigger sind rein datumsbasiert
(`inbox/ausloeser.py:16-20`): `booking_new`, `before_checkin`, `after_checkin`,
`before_checkout`, `after_checkout`, `message_received`.

Kein Auslöser reagiert auf ein Gast-*Signal* (Anfragetext, Aufenthaltsdauer,
Gästezahl, frühere Käufe).

---

## 3. Zwei Befunde, die keine Hostaway-Lücke sind, sondern Fehler bei uns

### 🐞 Eskalationsregeln wirken nicht — drei Schalter ohne Funktion

Der Betrieb kann eine Regel als Eskalationsregel anlegen und dabei zwei Schalter
setzen: `eskalation_posteingang` und `benachrichtigen`. Beide werden gespeichert
(`ki_regeln.py:227-228`) und wieder ausgeliefert — **und nie ausgewertet**.

Was die Regel tatsächlich bewirkt, ist ausschließlich ein erzwungener Entwurf
(`ki_regeln.py:361-367`). Sie erzeugt **keinen** Eintrag in der Eskalationsliste
und **keine** Benachrichtigung.

Das Schema kennt zwei Auslöser (`schemas.py:703`,
`Literal["stimmung", "regel"] = "stimmung"`), aber beide Aufrufstellen setzen hart
`"stimmung"` (`ki_autoantwort.py:222`, `vorlagen.py:110`). Der Wert `"regel"` wird
nie erzeugt. Zudem setzt `ki_autoantwort.py:229` `benachrichtigen=True` fest — der
Wert aus der Regel wird gar nicht gelesen.

Besonders unangenehm: die Doku im Modulkopf verspricht das Gegenteil
(`ki_eskalation.py:6`, *„Regel — Eine Regel des Betriebs mit `ist_eskalation` hat
gegriffen"*).

**Das ist Wurzel 5**: ein Kontrollsignal, das still verschluckt wird. Und es ist
Wurzel 9 in der Oberfläche — ein Schalter, der nichts tut, ist schlimmer als
keiner, weil sich der Betrieb darauf verlässt.

### 🐞 Zahlung fehlgeschlagen → nur eine Logzeile

```python
case "payment_intent.payment_failed":
    res_id = _set_payment_status(db, obj["id"], "failed")
    if res_id:
        _mark_platform_fee_failed(db, res_id)
```
`webhook.py:184` — das ist alles.

* **Keine Nachricht an den Gast.** Weder eine Mailvorlage in `core/mail_texte.py`
  noch ein Eintrag im Melde-Katalog noch ein Automations-Trigger. `webhook.py`
  importiert den Mailversand nicht einmal.
* **Kein zweiter Versuch.** `service.py:1725` liest nur
  `.eq("scheduled_status", "scheduled")` — einmal `failed`, nie wieder.
* **`needs_action` (3DS) wird geschrieben, aber nirgends angezeigt.** Die einzige
  Reaktion ist `log.warning("balance_charge_failed", ...)`.
* Bei ausgeschaltetem `auto_charge_scheduled` verspricht der Migrationskommentar
  (0169:46) sogar „Zahlungslink/Erinnerung" — die Zeile bleibt in Wahrheit ewig
  auf `scheduled` liegen.

**Das ist unbezahltes Geld, das niemand sieht.** Hostaway wirbt genau damit:
*„Set smart messaging rules to automatically notify guests to update their payment
methods following a failed payment."*

### ⚠️ Nebenbefund: Gap-Rabatt und Mindestaufenthalt heben sich auf

`_is_orphan_gap` verbilligt eine Ein-Nacht-Lücke um 15 %, aber
`_dynamic_min_stay` (`engine.py:413`) kennt nur die Auslastung — das Lücken-Signal
geht dort nicht ein. Eine Ein-Nacht-Lücke kann also verbilligt und gleichzeitig
durch einen auslastungsbedingten Mindestaufenthalt von 3 Nächten unverkäuflich
bleiben.

---

## 4. Der Assistent — gebaut und abgeschaltet

Hostaways „AI CoHost" ist ihr Aushängeschild. Wir haben zwei Antworten darauf,
und beide sind nicht sichtbar:

**„Andy", der Sprachassistent** — 1.942 Zeilen fertiger Code
(`web/components/dashboard/voice-assistant.tsx`), Wake-Word „Hallo Andy",
Einwilligungs-Gate, Dauerlauschen, Backend unter `/dashboard/voice` mit
Groq-Anbindung. Er ist **bewusst abgeschaltet**, mit begründetem Kommentar im
Layout (`layout.tsx:188-194`): *„die Sprachsteuerung ist noch nicht fertig, und ein
Knopf zu einer halbfertigen Funktion kostet Vertrauen."*

Die Begründung ist richtig. Sie sollte nur nicht dauerhaft gelten.

**Der MCP-Server** — 71 Werkzeuge, lesend und schreibend, auf den Live-Daten
(`mcp/katalog.py`). Funktional ist das *mehr* als Hostaways CoHost: ein KI-Agent,
der Preise setzt, Aufgaben anlegt und Buchungen verschiebt. Nur ist der Zugang ein
anderer — der Betrieb verbindet Claude per OAuth, statt ein Chatfenster im
Dashboard zu öffnen.

Was fehlt, ist also weniger die Fähigkeit als die **Sichtbarkeit**: Hostaway hat
ein Chatfenster im eigenen Dashboard, wir haben zwei bessere Wege, die niemand
findet.

---

## 5. Empfehlung nach Aufwand

**Sofort, ohne Neubau — kaputte Dinge reparieren:**

1. **Eskalationsregeln zum Wirken bringen** (Abschnitt 3). Drei Schalter, die
   nichts tun, sind ein Vertrauensschaden. Der Eskalationspfad existiert bereits —
   er wird nur aus dem Regel-Zweig nicht aufgerufen.
2. **Gast benachrichtigen, wenn eine Zahlung scheitert** (Abschnitt 3). Der
   Mailversand ist da, der Melde-Katalog ist da, der Zahlungslink ist da. Es fehlt
   die Verbindung.

**Billig, weil die Daten schon liegen:**

3. **Automatisierungsquote** aus `ki_antwort_protokoll` — eine Auswertung über
   vorhandene Zeilen, sonst nichts.
4. **Gap-Rabatt und Mindestaufenthalt zusammenführen** — ein Signal, das bereits
   berechnet wird, in eine zweite Funktion durchreichen.

**Echter Neubau, nach Wirkung sortiert:**

5. **Bewertungs-KI** (Abschnitt 2A) — die größte inhaltliche Lücke. Stimmungs-Trends,
   Verbesserungs-Zusammenfassung, Antwortvorschläge. Alle Daten liegen vor, das
   Dashboard existiert, es fehlt die Auswertung.
6. **KI für Objektbeschreibungen** (2B) — `ki_texte.py` kann das Verfahren bereits,
   es müsste auf `properties` angewandt werden statt nur auf `site_pages`.
7. **Regel-Vorschläge aus dem Schriftverkehr** (2F) — Hostaways stärkstes Argument
   im Posteingang, und `ki_lernen.py` liefert die halbe Mechanik.
8. **Auto-Zuweisung von Aufgaben** (2E).
9. **Betrugsschutz** (2D) — mindestens die beiden Stripe-Events behandeln, statt
   sie zu verwerfen.

**Entscheidung, keine Lücke:**

10. **„Andy" wieder einschalten** oder ersatzlos entfernen. Ein fertiger Assistent,
    der im Layout auskommentiert ist, nutzt niemandem. Wenn die Sprachsteuerung
    nicht weitergeführt wird, ist der ehrlichere Weg ein **Text**-Chat auf denselben
    Backend-Endpunkt — das Schwierige (Kontext-Snapshot, Prompt, Groq-Anbindung)
    ist gebaut, nur die Spracherkennung ist der wacklige Teil.

---

## Was dieses Dokument nicht sagt

Es vergleicht **Funktionsumfang**, nicht Qualität. Ob unsere Gastantworten besser
oder schlechter sind als Hostaways, sagt kein Code-Vergleich — das zeigt nur der
Betrieb.

Hostaways Zahlen (90 %, 25,1 %, 150 Stunden) sind Marketing ohne offengelegte
Methode. Sie taugen als Zielmarke, nicht als Messlatte.
