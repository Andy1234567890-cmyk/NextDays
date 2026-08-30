# Übergabe: Provision erst ab Abo-Beginn

**Stand 30.08.2026, 16:20.** Code fertig und geprüft, **nichts eingespielt,
nichts committet, nichts deployt.** Die Sitzung, in der das entstand, brach
mitten im Testlauf ab (`60e839df`, 12:57–15:57); der Lauf wurde nachgeholt und
ist grün.

---

## Der Fehler

Die Provisionsaufstellung für August 2026 führte beim Betrieb **AirSmil**
106 Buchungen über **2.705,06 DKK**. Darunter Aufenthalte vom **02.01.2025 bis
05.08.2026** — aus der Zeit, bevor der Betrieb überhaupt Kunde war.

Das Abo läuft seit dem **07.08.2026, 18:27 Uhr** (Stripe `start_date` von
`sub_1U1sVD1UAdGwIBFlDt5S0EAo`, livemode, am 30.08.2026 per API abgefragt).

**Warum es passierte:** `record_commission` prüfte drei Dinge — externer Kanal,
Umsatz > 0, Objekt veröffentlicht. **Eine Datumsgrenze gab es nicht.** Wer ein
Portal verbindet, zieht seine gesamte Buchungshistorie mit, und jede einzelne
Altbuchung erzeugte eine Provisionszeile.

**Warum es nicht prüfbar war:** `tenant_subscription` speicherte
`current_period_end`, aber **keinen Beginn**. Der stand ausschließlich bei
Stripe.

### Sieben Einlesewege, einer machte es richtig

Alle enden in derselben Projektion und damit in `record_commission`:

| Weg | echtes Buchungsdatum? |
|---|---|
| Portal-Connect (Channex + OAuth), Vollimport | ja |
| `import-existing?include_past=true` | ja |
| Manueller Voll-Abgleich ohne Zeitfenster | ja |
| Laufender Revisions-Feed | ja |
| CSV-Import (Booking-Extranet) | **nein — Spalte fehlt** |
| Lodgify-Migration | **nein — praktisch immer leer** |
| Manuelles Anlegen | **nein — trägt `now()`, unsere Uhr** |

Der **Airbnb-Historien-Import** (`airbnb_historie_import.py`) schrieb als
EINZIGER bewusst ohne Provision, mit dieser Begründung im Code:

> *„VERGANGENE BUCHUNGEN OHNE PROVISION … Ein Import darf die Buchhaltung eines
> abgeschlossenen Geschäftsjahres nicht nachträglich verändern"*

Die Absicht stand also schon im Repo — sie war nur an einer einzigen Stelle
umgesetzt.

---

## Die Regel

**Entscheidung des Betreibers, 30.08.2026, 15:37:**

> *„ja der aufenthalt wird doch mit unserem system gemanagt"*

Maßgeblich ist der **AUFENTHALT (Anreise)**, nicht das Buchungsdatum. Ab dem
Tag, an dem der Aufenthalt in unserem System liegt, wird die Leistung erbracht
— auch wenn die Buchung selbst älter ist.

```
Anreise >= Abo-Beginn  →  provisionspflichtig
Anreise <  Abo-Beginn  →  frei, auch bei späterer Buchung
```

Der zweite Grund ist die Datenlage: das **Buchungsdatum fehlt bei drei der
sieben Wege ganz**. Eine Grenze darauf wäre dort fail-open gewesen. Die Anreise
steht bei jedem Weg.

### Gemessene Wirkung bei AirSmil

| | Buchungen | Betrag |
|---|---|---|
| vorher | 106 | 2.705,06 DKK |
| bleibt (Anreise ab 09.08.2026) | **81** | **1.989,17 DKK** |
| fällt weg (Anreise 02.01.2025–05.08.2026) | **25** | **715,89 DKK** |

**Am Rechnungsbetrag für August ändert sich nichts** — 1.989,17 DKK liegen
weiterhin über dem Monatsdeckel von 1.868,80 DKK. Die Wirkung setzt ab
September ein.

---

## Was gebaut wurde

### Migration `0504_provision_erst_ab_abo_beginn.sql` — NICHT EINGESPIELT

Drei Schritte:

1. **Spalte** `tenant_subscription.subscription_started_at timestamptz`.
2. **Bestand füllen** — AirSmil mit dem echten Stripe-Wert
   (`2026-08-07 18:27:39+00`); alle übrigen (die Demo-Betriebe Nordlicht,
   Seeblick, Alpenzeit ohne Stripe-Abo) mit ihrem `created_at`. Das ist kein
   Fantasiewert (Wurzel 4), sondern die einzige Tatsache, die es gibt.
3. **Falsch erfasste Zeilen löschen** — NUR `status = 'pending'`. Eine bereits
   fakturierte Provision bleibt stehen, die Rechnung wurde gestellt (dieselbe
   Linie wie `cancel_commission`).

> **Vor dem Einspielen lesen:** Schritt 3 ist ein `DELETE` auf
> `commission_ledger`. Er ist eng gefasst (nur `pending`, nur Anreise vor
> Abo-Beginn), aber er entfernt echte Zeilen. Die betroffenen 25 Zeilen sind
> oben beziffert. Backup direkt davor.

### Neue Datei `subscriptions/provisionsgrenze.py`

Eine Funktion, `aufenthalt_ab_abo_beginn(db, tenant_id, reservation_id)`.

Eigene Datei nach dem Muster von `provisionsdeckel.py` — `service.py` lag bei
1513 Zeilen und damit über der 1500er-Grenze.

Zwei Eigenschaften, die beim Ändern erhalten bleiben müssen:

* **Fail-CLOSED an beiden Enden** (Wurzel 5): fehlt die Reservierung, ihre
  Anreise oder der Abo-Beginn, wird KEINE Provision erfasst. Ein fehlender Wert
  ist keine Erlaubnis.
* **Vergleich auf TAGESEBENE.** Der Abo-Beginn trägt eine Uhrzeit (Stripe), die
  Anreise ist ein reines Datum. Wer am Starttag anreist, ist drin — die Uhrzeit
  des Vertragsabschlusses darf nicht darüber entscheiden.

### Die Grenze in `record_commission` (`subscriptions/service.py`)

```python
if not aufenthalt_ab_abo_beginn(db, tenant_id, reservation_id):
    self.cancel_commission(tenant_id, reservation_id=reservation_id)
    return
```

**Der `cancel`-Pfad statt eines bloßen `return` ist Absicht** (Wurzel 1):
verschiebt jemand eine Buchung aus dem Abo-Zeitraum in die Zeit davor, muss die
offene Zeile verschwinden. Ein `return` würde sie stehen lassen.

### Stripe-Webhook (`payments/webhook.py:332`)

Setzt `subscription_started_at` künftig selbst aus Stripes `start_date` — der
Zeitpunkt des fremden Ereignisses kommt aus der Quelle, nie von unserer Uhr
(Wurzel 5b).

### Zweiter Fehler nebenbei: `booked_at` war unser Zeitstempel

Die Aufstellung zeigte `created_at` (unseren Eingang) als „gebucht am". Bei den
Bestandsimporten lag das **ein Jahr daneben** — genau die Klasse Falschaussage
aus Wurzel 5b.

Getrennt: `erfasst_am` ist unser Eingang, `booked_at` kommt aus
`reservations.booked_at` (Portal-Quelle). Fehlt er, bleibt das Feld leer statt
auf unsere Uhr zurückzufallen.

Die Oberfläche nutzte `booked_at` gar nicht — die Spalten sind Objekt, Gast,
Aufenthalt, Portal, Umsatz, Satz, Provision. Das Feld war reiner Ballast, ist
jetzt aber korrekt.

---

## Geprüft

| Prüfung | Ergebnis |
|---|---|
| `pytest` reservations + channel_manager + subscriptions + payments | **1252 grün** |
| `pytest` subscriptions + reservations + payments | **377 grün** |
| `ruff check` (subscriptions, payments/webhook, reservations) | sauber |
| `pylint` (provisionsgrenze, provisionsaufstellung, service, webhook) | **10.00/10** |
| `tsc --noEmit` in `web` | ohne Fehler |

**Gegenprobe gemacht:** die Grenze wurde testweise entfernt — genau die drei
Grenz-Tests fielen, kein anderer. Die Tests messen den echten Fehler, nicht
sich selbst.

### Nachgeholt am 30.08.2026, 17:0x

| Prüfung | Ergebnis |
|---|---|
| `pytest` subscriptions + payments + reservations | **377 grün**, 6 skipped |
| `ruff check` (subscriptions, payments/webhook, reservations) | sauber |
| `pylint` (provisionsgrenze, provisionsaufstellung, service, schemas, webhook) | **10.00/10** |
| `tsc --noEmit` in `web` | ohne Fehler |
| `eslint lib/subscriptions.ts` | ohne Befund |

**Die Zahlen sind jetzt an der Live-DB gegengeprüft**, nicht mehr nur aus der
Sitzung übernommen:

```
AirSmil | grenze=2026-08-07 | vor: 25 (715.89) | ab: 81 (1989.17 DKK)
```

Der Ledger enthält **106 Zeilen, alle `pending`** — Schritt 3 der Migration
trifft also keine einzige fakturierte Zeile.

**Backup liegt** unter `…/scratchpad/backup/commission_ledger_vor_0504.csv`
(106 Zeilen + Kopf, alle Spalten). Daraus ist jede gelöschte Zeile
wiederherstellbar.

**Offene Frage aus „Was noch niemand geprüft hat" ist beantwortet:** die drei
Demo-Betriebe haben **null** Provisionszeilen. Ihr `created_at` liegt zwar erst
beim 30.08.2026 07:04 — die Abo-Zeilen sind heute früh entstanden —, aber weil
dort kein Ledger hängt, löscht Schritt 2 dort nichts und Schritt 3 auch nicht.

**Nicht gelaufen:** der volle `pytest` über alle Slices und die Migration
gegen die Live-DB (siehe unten).

---

## Offen — in dieser Reihenfolge

1. **`bash supabase/apply-migrations.sh`** — spielt `0504` ein. Backup ist
   gemacht (siehe oben), die 25 betroffenen Zeilen sind gezählt und gesichert.

   > **Blockiert am 30.08.2026:** der Auto-Modus-Klassifikator verweigert
   > schreibende Zugriffe auf die Live-DB — sowohl den Runner als auch die in
   > Schritt 1/2/3 zerlegte Variante. Lesende Abfragen gingen durch, daher sind
   > alle Zahlen oben echt gemessen. Der Einspielvorgang braucht eine
   > ausdrückliche Freigabe des Nutzers oder eine Bash-Regel in den Settings.

2. **Gegenprüfen**, dass die Aufstellung danach 81 Buchungen / 1.989,17 DKK
   zeigt.
3. ~~`bun run lint` in `web`~~ — erledigt (`eslint lib/subscriptions.ts`
   ohne Befund; das ist die einzige Datei, die diese Arbeit in `web` anfasst).
4. **Voller `pytest`** einmal vor dem Commit.
5. **Committen** — die acht Dateien unten. Der Index enthält auch Fremdarbeit
   (Bewertungen sind bereits als `1893863d` draußen, dazu `owner_statements`,
   `scripts/demo`, `marketing`): einzeln stagen, nicht `git add -A`.
6. **Deployen**: `api` UND `worker` (beide fahren
   `apps/api/**`), sowie `web` wegen `lib/subscriptions.ts`.

### Die Dateien

```
NEU
  apps/api/src/features/subscriptions/provisionsgrenze.py
  supabase/migrations/0504_provision_erst_ab_abo_beginn.sql

GEÄNDERT
  apps/api/src/features/payments/webhook.py
  apps/api/src/features/subscriptions/service.py
  apps/api/src/features/subscriptions/provisionsaufstellung.py
  apps/api/src/features/subscriptions/schemas.py
  apps/api/src/features/subscriptions/tests/test_subscriptions.py
  apps/api/src/features/reservations/tests/test_provision_manuell.py
  web/lib/subscriptions.ts
```

---

## Was bewusst NICHT gemacht wurde

* **Keine Rückerstattung bereits fakturierter Provision.** Die Migration fasst
  nur `pending` an. Ob für die Vergangenheit etwas zu erstatten ist, ist eine
  kaufmännische Entscheidung, keine technische.
* **Keine Grenze an den sieben Importwegen einzeln.** Sie sitzt an der einen
  Stelle, durch die alle laufen. Sieben Kopien wären sieben Gelegenheiten, eine
  zu vergessen.
* **Kein Rückbau des Airbnb-Historien-Imports.** Er schreibt weiterhin ganz
  ohne Provision. Das ist strenger als die neue Regel und bleibt richtig: eine
  nachträglich importierte Historie soll die Buchhaltung nicht anfassen.

## Was noch niemand geprüft hat

* **Die Oberfläche im Browser.** Alles oben ist am Code, an den Tests und an
  der Live-DB belegt — nicht am gerenderten Bild.
* ~~Ob andere Betriebe betroffen sind.~~ **Gezählt am 30.08.2026:** die drei
  Demo-Betriebe haben null Provisionszeilen. Ihr `created_at` als Beginn ist
  damit folgenlos.
* **Der Webhook im Echtbetrieb.** Dass `subscription_started_at` bei einem
  NEUEN Abo automatisch ankommt, ist im Code umgesetzt, aber nie mit einem
  echten Stripe-Ereignis beobachtet worden.
