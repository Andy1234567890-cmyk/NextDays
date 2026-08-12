# Wie aus dem Gastpreis die Eigentümer-Auszahlung wird

Die Kette an EINER echten Buchung, Stand 11.08.2026. Alle Zahlen sind live aus
der Datenbank gelesen, nicht gerechnete Beispiele.

> **Vorher unbedingt lesen: „Gesamtbetrag" heißt bei jedem Portal etwas anderes.**
> Der Abschnitt [Was der Gesamtbetrag je Portal
> bedeutet](#was-der-gesamtbetrag-je-portal-bedeutet) ganz unten erklärt es. Ohne
> das liest man die Zahlen in dieser Kette falsch — bei Airbnb steht im Feld
> `total_amount` nicht der Gastpreis, sondern die Auszahlung nach Portal-Provision.

## Die Buchung

| Feld | Wert |
|---|---|
| Objekt | FeWo *Stjerneskud* |
| Zeitraum | 09.08.2026 → 12.08.2026 (3 Nächte) |
| Kanal | Booking.com |
| Gastpreis (`total_amount`) | **2.165,64 DKK** |
| Portal-Abzug (`channel_fee`) | 0,00 DKK |
| Zusatzleistungen | keine (0 Positionen) |
| Währung | DKK |

## Die Rechnung

```
  Gastpreis (was der Gast zahlt)                    2.165,64 DKK
+ Zusatzleistungen (Extras, provisionsfrei verkauft)     0,00 DKK
− Portal-Abzug (Booking.com-Gebühr)                      0,00 DKK
─────────────────────────────────────────────────────────────────
= Auszahlungsbasis der Buchung                     2.165,64 DKK

− Pauschale, falls "vor Provision" vereinbart            0,00 DKK
─────────────────────────────────────────────────────────────────
= Bemessungsgrundlage der Provision                2.165,64 DKK

− Verwaltungsprovision 20 % (Abrechnungsvertrag)      433,13 DKK
    (mindestens die vereinbarte Mindestprovision — keine vereinbart)
─────────────────────────────────────────────────────────────────
= Netto-Auszahlung an den Eigentümer               1.732,51 DKK

− Pauschale, falls "nach Provision" vereinbart           0,00 DKK
─────────────────────────────────────────────────────────────────
= Auszahlungsbetrag                                1.732,51 DKK

  verteilt auf 3 Nächte:      577,50 · 577,50 · 577,51 DKK
```

Die letzte Nacht trägt den Ausgleichs-Cent, damit die Summe der im Kalender
gezeigten Nächte **exakt** dem Auszahlungsbetrag entspricht. Ohne diesen
Ausgleich ergäbe 3 × 577,50 = 1.732,50 DKK und dem Eigentümer fehlte gegenüber
seiner Abrechnung ein Cent.

## Was die Reihenfolge bedeutet

Die Pauschale wirkt an zwei möglichen Stellen, und **dieselbe Pauschale ergibt
je nach Stelle zwei verschiedene Zahlen**. Beispiel mit 1.000 DKK Basis, 20 %
Provision und 100 DKK Pauschale:

| Vereinbarung | Rechnung | Auszahlung |
|---|---|---|
| Pauschale **vor** Provision | (1.000 − 100) × 80 % | **720,00 DKK** |
| Pauschale **nach** Provision | 1.000 × 80 % − 100 | **700,00 DKK** |

Deshalb ist der Zeitpunkt Teil des Vertrags und keine Annahme im Programm. Die
Pauschale kann je Buchung oder je Nacht gelten (50 DKK je Nacht × 3 Nächte =
150 DKK).

Die **Mindestprovision** greift, wenn die errechnete Provision darunter liegt.
Anlass ist ein realer Fall: bei einem Kurzaufenthalt kann eine pauschale
Reinigungsgebühr größer sein als der Übernachtungsertrag — ohne Mindestprovision
ergäbe die Formel dort eine *negative* Provision, also eine Zahlung des Betriebs
an den Eigentümer.

## Woher der Provisionssatz kommt

In dieser Reihenfolge, die erste vorhandene Quelle gewinnt:

1. **Manuelle Korrektur** in der Abrechnungsmaske — eine bewusste Einzelfall-Entscheidung der Verwaltung.
2. **Abrechnungsvertrag** je Eigentümer, optional je Objekt. Ein Objekt-Vertrag schlägt den Eigentümer-Vertrag.
3. **Altbestand-Stammdaten** (Provisions-Override am Objekt, sonst Standardsatz des Eigentümers) — Rückfall, bis jeder Eigentümer einen Vertrag hat.

Der Vertrag hat eine **Zeitachse**. Maßgeblich ist der Satz, der am **Abreisetag
der Buchung** vereinbart war — nicht der heute gültige. Eine Vertragsänderung
wirkt damit nie rückwirkend: eine im September erzeugte Juli-Abrechnung rechnet
mit dem Juli-Satz. Für *Stjerneskud* gilt 20 % ab 01.01.2024, unbefristet;
damit sind alle 37 Buchungen des Objekts abgedeckt.

## Wenn ein Betrag fehlt

Es wird **nie** ein plausibler Ersatzwert eingesetzt. Fehlt eine Grundlage,
bleibt das Feld leer und nennt den Grund:

| Grund | Bedeutung |
|---|---|
| kein Provisionssatz | Für das Objekt ist weder ein Vertrag noch ein Satz hinterlegt. |
| Satz ungültig | Der hinterlegte Satz liegt außerhalb 0–100 %. |
| Betrag fehlt | Die Buchung hat keinen Gesamtbetrag. |
| Zeitraum fehlerhaft | Abreise liegt nicht nach Anreise. |
| Währung passt nicht | Pauschale/Mindestprovision lauten auf eine andere Währung als die Buchung. |

Der letzte Punkt ist bewusst ein Fehler und keine Umrechnung: 50 DKK sind 50
DKK, auch wenn ein Objekt in EUR verkauft. Ein stillschweigender Kurs von 1,0
wäre plausibel aussehender Unsinn.

Ein unterstellter Satz von 0 % wäre der teuerste Fehler dieser Art — er zahlte
dem Eigentümer den vollen Betrag aus und der Verwaltung nichts. Genau das ist am
09.08.2026 live passiert (32.120,45 DKK Auszahlung, 0,00 DKK Provision), bevor
die Ersatzwerte entfernt wurden.

## Was der Eigentümer sieht — und was nicht

Der Eigentümer sieht in seinem Portal **ausschließlich seine Netto-Auszahlung
pro Nacht**, nicht den Gast-Verkaufspreis und nicht den vollen Gastnamen (nur
den Vornamen). Die Buchungsquelle (Booking.com, Airbnb …) sieht er bewusst: sie
gehört zum Auszahlungsnachweis, weil sie erklärt, welcher Portal-Abzug
entstanden ist.

## Umgesetzt am 11.08.2026

Die Kette läuft im Code, an einer Stelle für alle drei Ansichten
(Eigentümer-Kalender, Einnahmen-Übersicht, Abrechnung) —
`owner_statements/common.py` plus `gebuehren_quelle.py`.

Nachgewiesen gegen die Live-Datenbank: die Buchung 09.–12.08. ergibt
1.356,81 DKK / 452,27 je Nacht, und die Summe der im Kalender gezeigten Nächte
ist auf den Cent identisch mit dem Abrechnungsbetrag.

Drei Regeln stecken jetzt im Code, die vorher nur auf Papier standen:

* **Portal-Abzug zweiteilig** (Migration 0364, `portal_abzugssaetze`): Provision
  plus Zahlungsgebühr, je Kanal, mit Zeitachse. Wo das Portal seine Provision
  gemeldet hat, gilt der **gemeldete Betrag** statt unseres Satzes — er ist die
  Tatsache. Die Zahlungsgebühr fällt nur an, wenn das Portal das Geld einzieht.
* **Gebühren aus dem Portal-Feed**, wo es ihn gibt: Airbnb meldet die wirklich
  abgerechneten Beträge (bei einem Objekt Reinigung mal 795, mal 1.075, mal
  1.275 DKK bei identischen Stammdaten von 795). Booking meldet keine — dort
  bleiben die Stammdaten die Quelle.
* **Zwei Achsen je Gebührenart** (`gehoert_zu` + `provisionspflichtig`): erst
  raus aus der Provisionsbemessung, dann ungekürzt zurück an den, dem sie
  gehört. Die Gebühren des Betriebs kommen nicht zurück.

Was der August dadurch anders aussieht: **9.737,25 DKK** statt vorher
11.831,87 DKK. Die Differenz von 2.094,62 DKK ist der Portal-Abzug, der vorher
gar nicht gerechnet wurde — dem Eigentümer wurde Geld ausgewiesen, das
Booking.com behalten hat.

Noch offen (Datenpflege, nicht Code) — beides steht jetzt an EINER Stelle,
*Buchhaltung → Abrechnungsregeln*:

1. **Portal-Sätze** eintragen: Booking.com 15 % + 1,5 % Zahlungsgebühr,
   Airbnb 15,5 % ohne Zahlungsgebühr.
2. **Gebührenarten zuordnen** (Reinigung, Resort/Nebenkosten, Haustier): wem
   gehört sie, und fällt Provision darauf an.

Solange das fehlt, zeigt das Portal den Grund an, statt eine Zahl zu erfinden.
Die Zuordnung stand vorher unter *Objekte → Preise* — sie gilt aber für den
gesamten Betrieb (dieselbe Reinigungsgebühr an 18 Objekten von 16 Eigentümern),
und dort verleitete sie dazu, dieselbe Entscheidung 18-mal zu treffen. Die
Gebühren-**Beträge** bleiben am Objekt, sie unterscheiden sich je Haus.

## Der August 2026 im Ganzen

| Zeitraum | Kanal | Gastpreis | Netto-Auszahlung | je Nacht |
|---|---|---|---|---|
| 03.–09.08. | Booking.com | 4.475,63 | 3.580,50 | 596,75 |
| 09.–12.08. | Booking.com | 2.165,64 | 1.732,51 | 577,50 |
| 13.–18.08. | Booking.com | 3.522,76 | 2.818,21 | 563,64 |
| 21.–29.08. | Booking.com | 4.625,81 | 3.700,65 | 462,58 |
| **Summe** | | **14.789,84** | **11.831,87 DKK** | |

Alle Beträge in DKK. Der Aufenthalt vom 29.08.–12.09. ist eine Eigennutzung des
Eigentümers und bringt keine Auszahlung — solche Zeiträume sind aus der
Abrechnung ausgenommen, statt mit 0,00 als Buchung zu erscheinen.

---

## Was der Gesamtbetrag je Portal bedeutet

Der wichtigste Punkt der ganzen Kette, und der am leichtesten zu verwechselnde:
**das Feld `total_amount` einer Buchung enthält je Portal einen anderen Betrag.**
Beide sehen plausibel aus, und beide sind für ihr Portal richtig — nur eben nicht
dasselbe.

| Portal | `total_amount` ist … | Gebühren stecken darin? |
|---|---|---|
| **Airbnb** | die **Auszahlung nach Abzug** der 15,5 % Provision (`payout_amount`) | ja, aber die Provision ist schon weg |
| **Booking.com** (Feed) | der **Gastpreis brutto** — Nächte + Gebühren | ja, Provision noch nicht abgezogen |
| **Booking.com** (Altimport) | nur die **Nächtesumme** | nein, Gebühren fehlen ganz |

Nachgerechnet an allen 77 Buchungen mit Payload, ohne eine einzige Ausnahme.

### Der Beleg: eine echte Airbnb-Abrechnung

Buchung `HMTH2N8PPM`, 7 Nächte, *Feriehus Grævlinge*:

```
  Übernachtung (base_price)                          7.010,00 DKK
+ Resortgebühr                                         175,00 DKK
+ Haustiergebühr                                       150,00 DKK
+ Reinigungsgebühr                                   1.075,00 DKK
─────────────────────────────────────────────────────────────────
= Gastpreis                                          8.410,00 DKK   ← hierauf rechnet Airbnb

− Airbnb-Servicegebühr 15,5 %                        1.303,55 DKK
─────────────────────────────────────────────────────────────────
= Auszahlung von Airbnb                              7.106,45 DKK   ← das steht in `total_amount`
```

Genau so steht es auf der Abrechnung von Airbnb. Wer die 7.106,45 als Gastpreis
liest, zieht die Provision ein **zweites** Mal ab.

### Woran man den Fehler erkennt

Der Provisionssatz ist vereinbart und konstant — er muss also bei jeder Buchung
gleich herauskommen. Tut er das nicht, ist die Bezugsgröße falsch:

| Bezugsgröße | gemessener Satz über 22 Airbnb-Buchungen |
|---|---|
| Gastpreis (richtig) | **15,50 %** bei allen 22 |
| Auszahlungsbetrag (falsch) | 12,34 % bis 17,02 %, je Buchung anders |

Dieselbe Probe bei Booking.com: **15,00 %** bei allen 4 Buchungen mit gemeldeter
Provision. Ein Satz, der je Buchung schwankt, ist immer ein Rechenfehler und
nie eine Eigenheit des Portals.

### Warum die Zerlegung jetzt gespeichert wird

Weil diese Unterscheidung sonst bei jedem Seitenaufruf neu getroffen werden
müsste — dreimal, an drei verschiedenen Stellen (Eigentümer-Kalender,
Einnahmen-Übersicht, Abrechnung). Genau daraus entstanden die zwei Fehler.

Seit Migration 0366 hält `reservation_portal_finanzen` je Buchung fest, was das
Portal gemeldet hat: Übernachtung, Gebühren einzeln, Provision, Zahlungsgebühr.
Das sind **Tatsachen** und ändern sich nie mehr.

Die **Verwaltungsprovision** steht dort ausdrücklich *nicht*: sie hängt am
Abrechnungsvertrag, und ein Vertrag wird korrigiert. Sie wird deshalb bei jedem
Aufruf frisch aus dem geltenden Vertrag gerechnet — eine Vertragskorrektur wirkt
damit sofort überall, ohne dass alte Buchungen nachgerechnet werden müssen.

Merksatz: **Tatsache = gespeichert, Vereinbarung = gerechnet.**

### Wenn eine Zahl fehlt, steht kein Ersatzwert da

Fehlt eine Grundlage — keine Gebühren-Zuordnung, kein Portal-Satz, keine
Währung —, zeigt die Oberfläche **keinen** Betrag und nennt den Grund. Ein
plausibel aussehender Ersatzwert wäre schlimmer als eine leere Zelle: niemand
würde ihn hinterfragen.

---

## Wo im Payload die Gebühren stehen (11.08.2026)

Channex legt dieselbe Information an mehrere Stellen, und sie sind **nicht
gleichwertig**. Live über alle 77 Buchungen gezählt:

| Stelle im `raw` | Airbnb (22) | Booking direkt (4) | Booking-Import (51) |
|---|---|---|---|
| `raw_message` → `reservation.standard_fees_details` | **22/22** | — | — |
| `rooms[].taxes` | vorhanden, **leer** | **3/4** | leer |
| `rooms[].meta.price_details` | — | 3/4 | — |
| `rooms[].meta.charge_periods` | — | 3/4 | — |
| `raw_message` → `RoomStays…PriceDetails` | — | 3/4 (**Kopie**) | — |

Die vierte Booking-Buchung ist eine Storno mit Betrag 0 — dort steht nichts, und
das ist richtig.

### Warum `rooms[].taxes` gelesen wird und nicht `meta.price_details`

Beide tragen dieselben Gebühren. Nur trägt die eine sie fertig:

```
meta.price_details.guest_view.taxes        rooms[].taxes
  amount: "22500"                            total_price:    "225.00"
  decimal_places: 2                          price_per_unit: "25.00"
  charge_frequency: 19                       price_mode:     "Per night"
  tax_description: "Resortgebühr"            name:           "Resortgebühr"
  type: "Inclusive"                          is_inclusive:   false
```

Drei Rateschritte fallen damit weg: die Division durch `decimal_places` (ein
vergessener Divisor macht aus 225,00 DKK **22.500,00**), das Entschlüsseln von
`charge_frequency` (19 = je Nacht, 12 = je Aufenthalt), und die Frage, ob der
Posten im Gesamtbetrag steckt. `type: "Inclusive"` legt dabei sogar das Gegenteil
nahe — beide Posten sind laut `charge_periods` `excluded`, und die Summe geht nur
auf, wenn man sie **addiert**: 10.795 + 225 + 1.075 = 12.095.

### Die Falle: `rooms[].taxes` ist bei Airbnb leer

Vorhanden, aber leer — bei allen 22 Buchungen. Wer die Stelle als Erstleser
nimmt, liest dort „keine Gebühren angefallen" und bringt jede Airbnb-Buchung um
ihre Reinigung (1.075 DKK je Buchung). Zwei Vorkehrungen dagegen:

1. Airbnb wird **zuerst** gefragt (erkannt an `reservation.standard_fees_details`,
   nicht an der Existenz von `raw_message` — das liegt bei allen 77 Buchungen).
2. Eine leere `rooms[].taxes` gilt nur dann als Aussage, wenn
   `meta.price_details` daneben liegt. Das trägt ausschließlich Booking.

### `charge_periods` sagt, ab wann eine Gebühr gilt

```json
"charge_periods": {
  "CLEANINGFEE": [{"excluded": true, "from": "2026-08-04", "to": null}],
  "RESORTFEE":   [{"excluded": true, "from": "2026-08-04", "to": null}]
}
```

Das ist die Antwort auf die Frage, warum eine Buchung vom Juni keine
Resortgebühr trägt, obwohl sie am Objekt gepflegt ist: sie galt beim Portal noch
nicht. Ohne diese Angabe sieht die fehlende Gebühr wie ein Rechenfehler aus.

## Nicht gemeldet heißt nicht gezahlt

Bis zum 11.08.2026 sprangen bei einer Portal-Buchung ohne Aufstellung die
**Objekt-Stammdaten** ein. Über den Bestand entstanden so:

| Art | Posten | Betrag |
|---|---|---|
| Reinigung | 191 | 186.120 DKK |
| Resort | 151 | 20.950 DKK |
| Haustier | 73 | 10.950 DKK |

Kein einziger davon war belegt, und alle flossen als Ertrag in die
Eigentümer-Auszahlung. Der Gesamt-Gastpreis des Betriebs stand mit 1.209.030,44
DKK in der Datenbank; nach der Korrektur sind es **1.142.455,44** — eine
Differenz von **66.575,00 DKK**, die kein Gast gezahlt hat.

Dass die Stammdaten hier nicht die Wahrheit sind, ist belegbar: *FeWo Lille
Lægehus* führt Resort 25/Nacht, aber Booking hat sie bei Buchung `5012668004`
nicht erhoben — 1.150 Nächte + 150 Haustier = 1.300 = Gesamtbetrag, exakt auf.

Seitdem gilt:

| Fall | Herkunft (`quelle`) | Gebühren |
|---|---|---|
| Portal hat gemeldet | `ota` | wie gemeldet — Tatsache |
| Portal-Buchung ohne Aufstellung | `ota_ohne_aufstellung` | **keine**, mit Grund an der Zeile |
| keine Portal-Buchung (Website, Telefon) | `stammdaten` | die gepflegten Objekt-Gebühren |

Der dritte Fall ist kein Widerspruch: ohne Portal gibt es keinen Payload, und
dort hat der Betrieb selbst nach seinen Stammdaten abgerechnet.

Die Abrechnungszeile nennt die Herkunft selbst (`gebuehren_quelle`,
`gebuehren_grund`) und zeigt bei `ota_ohne_aufstellung` einen Hinweis am
Gastpreis. Ohne ihn lautet die Rückfrage „warum steht bei dieser Buchung keine
Reinigung?" — am 11.08.2026 kostete sie einen halben Tag Suche beim
Channex-Mapping, beim Tax Set und im eigenen Rechencode, während die Antwort im
Eingangsweg der Buchung lag.

### Was die Diagnose zeigt

```
cd apps/api && python -m scripts.ota_zuordnung_pruefen --tenant <uuid>
```

Meldet Buchungen ohne Objekt, „Unmapped Rate" (nur wo das Portal einen Rate-Code
schickt — Airbnb schickt keinen, das ist dort der Normalfall) und
Portal-Buchungen ohne Aufstellung, getrennt nach Grund. `--exit-code` macht es
für einen Cron-Lauf brauchbar.
