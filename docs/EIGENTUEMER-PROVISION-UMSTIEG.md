# Eigentümer-Auszahlung: warum sie leer bleibt und was der Umstieg kostet

Stand 11.08.2026. Anlass: im Eigentümer-Kalender (`/portal/kalender`, FeWo
*Stjerneskud*) stand bei jeder Booking.com-Buchung ein „—" statt der
Netto-Auszahlung. Alle Zahlen unten sind live aus der Server-DB gelesen, nicht
geschätzt.

## 1. Der Befund

Die Daten der Buchungen sind vollständig — `total_amount` gesetzt (4.475,63 /
2.165,64 / 3.522,76 / 4.625,81 DKK), `channel_fee` 0,00, Währung DKK, Status
`confirmed`, 0 von 223 Reservierungen ohne Währung. Der Grund für das „—" ist
ein **fehlender Provisionssatz**, nicht ein Kanal-Problem: dieselbe Lücke
träfe eine Airbnb- oder Direktbuchung genauso.

Die Kette: `effektive_provision_pct` (`owner_statements/common.py`) wirft
`PayoutUnbekannt("provision")`, wenn `owner_properties.commission_override_pct`
UND `owners.default_commission_pct` leer sind. `public_portal`
(`_provision_map`) lässt das Objekt daraufhin aus der Karte fallen, jede Nacht
bekommt `betrag=None` + `grund`. Das ist bewusst so gebaut (Wurzel 4) — eine
unterstellte 0 % zahlte dem Eigentümer den vollen Betrag aus und dem Betrieb
nichts. Live belegt am 09.08.2026: 32.120,45 DKK Auszahlung, 0,00 DKK für die
Verwaltung.

**Der Satz IST gepflegt** — nur in einer anderen Tabelle. `owner_billing_terms`
(Migration 0343, der „Abrechnungsvertrag") trägt für Owner
`96312cd1` 20,00 % ab 01.01.2024, unbefristet. Kalender und Abrechnung lesen
diese Tabelle nicht.

Es sind also **zwei Quellen für dieselbe Provision**, und die neue ist noch an
keinen Verbraucher angeschlossen: `owner_billing_terms` wird ausschließlich vom
Slice `owner_billing` selbst gelesen und geschrieben. Der README dort
beschreibt das als geplanten Zwischenstand — „Beide bleiben in dieser Etappe
führend und werden nicht angefasst" — mit einem Umstieg in drei Schritten, von
dem **Schritt 1 („`owner_billing_terms` wird führend") noch nicht gebaut ist**.

Nicht nur der Kalender ist betroffen: die vorhandene Abrechnung für denselben
Eigentümer (Zeitraum 31.07.–30.08.2026, `draft`) hat `commission_pct = NULL`
**und** `owner_payout = NULL`. Gleiche Ursache, gleicher Ort im Code.

## 2. Alle Felder, die in die Auszahlung eingreifen

Der Vertrag ist mehr als ein Prozentsatz. Vollständige Liste der 17 Spalten von
`owner_billing_terms`, mit ihrer Wirkung und dem Live-Stand:

| Feld | Wirkung auf die Auszahlung | Live (3 Verträge) |
|---|---|---|
| `provisions_pct` | der Satz, `not null` ohne Default | 20,00 bei allen drei |
| `gueltig_ab` / `gueltig_bis` | halb offen `[ab, bis)`; entscheidet, WELCHER Satz gilt | 01.01.2024 offen · 18.02.2025 offen · 29.03.2025–02.01.2027 |
| `property_id` | gesetzt = Objekt-Vertrag, NULL = gilt owner-weit; **Objekt schlägt Eigentümer** | 1× owner-weit, 2× objektbezogen |
| `min_provision_betrag` + `min_provision_currency` | Mindestprovision je Buchung; unterschreitet die berechnete Provision den Betrag, gilt der Mindestbetrag | überall NULL |
| `pauschale_betrag` + `pauschale_currency` | Pauschale je Buchung | überall NULL |
| `pauschale_basis` | `je_buchung` \| `je_nacht` | überall NULL |
| `pauschale_zeitpunkt` | `vor_provision` \| `nach_provision` — `vor_provision` verkleinert die Bemessungsgrundlage und damit auch die Provision | überall NULL |
| `notiz`, `erstellt_von`, `created_at`, `updated_at`, `id`, `tenant_id`, `owner_id` | keine Rechenwirkung | — |

Die Währungen stehen **explizit am Vertrag** und werden nicht vom Objekt
abgeleitet: 50 DKK sind 50 DKK, auch wenn ein Objekt in EUR verkauft. Ein
Vertrag in EUR gegen eine Buchung in DKK ist deshalb ein Fehlerfall (422), kein
Umrechnen.

### Weitere Provisions-Quellen im Schema (geprüft, hier nicht relevant)

Die Spaltensuche über alle Tabellen fand 11 Treffer. Relevant sind die drei
oben genannten; die übrigen sind live leer oder gehören einer anderen Richtung:

* `reservations.ota_commission` — bei allen sechs Booking-Buchungen NULL.
* `travel_agencies` / `travel_agency_contracts.commission_pct` — 0 Zeilen im Mandanten.
* `commission_ledger.commission_amount` — Provision des BETRIEBS an uns, andere Richtung.
* `fee_classification.provisionspflichtig` — 0 Zeilen (Etappe A, eigener Umstieg);
  dieses Objekt hat 0 Extras, greift hier also nicht. Fehlt die Zuordnung,
  wirft `klassifikation_aufloesen` `KlassifikationFehlt` — ebenfalls ohne
  Rückfall.
* `owner_statements.commission_pct` — Ergebnis-Spalte, keine Quelle.

## 3. Was Mehr-Objekt-Eigentümer daran ändern

Eigentümer haben 2 bis 10 Objekte. Das ist für den Umstieg der kritische Fall,
weil `property_id` am Vertrag und `commission_override_pct` am Objekt
**dieselbe Frage auf zwei Ebenen** beantworten.

Live (alle Mandanten):

| Eigentümer | Objekte | Overrides | Default | Vertrag |
|---|---|---|---|---|
| `b5816089` | 3 | 0 | — | **keiner** (9 Buchungen) |
| `3ecdc4be` | 2 | 1 (12,50 %) | 15,00 % | keiner |
| `96312cd1` (Stjerneskud) | 1 | 0 | — | 20 %, owner-weit |

Daraus folgen drei Dinge, die ein Umstieg berücksichtigen muss:

1. **Ein owner-weiter Vertrag überschreibt stillschweigend Objekt-Overrides.**
   Bei `3ecdc4be` gilt heute 12,50 % für ein Objekt und 15,00 % für das andere.
   Ein einziger owner-weiter Vertrag über 15 % würde das abweichende Objekt auf
   15 % ziehen — eine echte Änderung an der Auszahlung, die niemand als
   Änderung sieht. Wer für einen Mehr-Objekt-Eigentümer einen Vertrag anlegt,
   muss die bestehenden Overrides vorher sehen.
2. **Vorrang muss über beide Ebenen gedacht werden**, nicht je Ebene getrennt:
   Objekt-Vertrag → Owner-Vertrag → Objekt-Override → Owner-Default. Eine
   Auflösung, die zuerst „Vertrag oder alte Spalten" fragt und erst danach
   „Objekt oder Owner", vertauscht bei `3ecdc4be` die Reihenfolge.
3. **Ein Satz je Objekt UND Zeitraum**, nicht je Eigentümer. Bei 10 Objekten
   mit unterschiedlichen Verträgen und Laufzeiten ist die Provision eine
   Funktion von (Objekt, Stichtag) — die heutige `dict[property_id] → Decimal`
   trägt den Stichtag nicht und kann eine Vertragsablösung mitten im
   Abrechnungszeitraum nicht abbilden.

## 4. Der Stichtag ist keine Formalie

`vertrag_aufloesen` verlangt den Stichtag vom Aufrufer und **nie** `date.today()`.
Grund: sonst rechnete ein im September erzeugtes Juli-Statement mit dem
September-Vertrag, und dieselbe Abrechnung ergäbe je nach Erzeugungstag eine
andere Zahl.

Für den Kalender heißt das: der Stichtag je Buchung ist deren **Check-out**,
nicht der angezeigte Monat und nicht heute. Sichtbar wird das an den echten
Daten — bevor der Vertrag auf 01.01.2024 zurückdatiert wurde, galt er ab
11.08.2026 und deckte nur 5 von 37 Buchungen; im August-Kalender hätten drei
Booking-Buchungen einen Betrag getragen und die vom 03.–09.08. nicht. Nach der
Rückdatierung deckt er **37 von 37**.

Eine Vertragsablösung ist ein NEUER Vertrag, kein Überschreiben; der EXCLUDE-
Constraint in 0343 verhindert Überlappungen. Historie bleibt damit lesbar — und
genau deshalb darf die Rechenkette den Satz nicht cachen, ohne den Stichtag
mitzuführen.

## 5. Umsetzungswege

Gemeinsam für alle Wege: der Eingriff gehört in `owner_statements/common.py`,
den geteilten Helfer. Kalender (`public_portal`) und Abrechnung
(`owner_statements`) rufen beide `effektive_provision_pct` — ein Eingriff dort
wirkt auf beide gleichzeitig. Läge die Vertragsauflösung nur im Kalender, zeigte
er eine andere Zahl als das Statement über denselben Zeitraum; genau das soll
`common.py` laut seinem Modul-Docstring verhindern.

Die vorhandene Auflösung `OwnerBillingService.vertrag_aufloesen(tenant_id,
owner_id, property_id, stichtag)` ist dafür gebaut („die zweite Auflösung, die
die Rechenkette beim späteren Umstieg aufruft") und wird nicht neu geschrieben.
Sie liefert die ganze Vertragszeile, also auch Mindestprovision und Pauschale.

### Weg A — nur `provisions_pct`, alte Spalten als Rückfall

Vorrang: Objekt-Vertrag → Owner-Vertrag → `commission_override_pct` →
`default_commission_pct`. Fehlt alles, bleibt es bei `PayoutUnbekannt`.

* Stjerneskud zeigt sofort 20 % — Kalender und Abrechnung.
* Die zwei Objekte mit 20-%-Override behalten ihren Satz; niemand verliert etwas.
* `min_provision`/`pauschale` bleiben unbeachtet. Das ist heute wirkungslos
  (überall NULL), aber eine **stille Lücke**: legt jemand morgen eine
  Mindestprovision an, rechnet die Kette ohne sie weiter und niemand merkt es.
  Muss darum im Code sichtbar markiert werden, nicht nur hier.
* Zwei Quellen bleiben vorübergehend aktiv — der Zustand, den der README als
  Etappe beschreibt.

### Weg B — Vertrag vollständig (zusätzlich Mindestprovision + Pauschale)

Wie A, zusätzlich: Mindestprovision hebt die Provision an; Pauschale mit
`pauschale_basis` (je Buchung / je Nacht) und `pauschale_zeitpunkt`
(`vor_provision` verkleinert die Bemessungsgrundlage, `nach_provision` erst
danach). Dazu die Währungsprüfung Vertrag gegen Buchung (Mismatch → 422, kein
Umrechnen).

* Die Kette ist vollständig und hält, was die Vertragsmaske anbietet — heute
  kann die Agentur eine Pauschale eintragen, die nirgends wirkt.
* Deutlich mehr Rechenlogik an der Stelle, an der echtes Geld verteilt wird;
  jede Regel braucht Tests inkl. der negativen Bemessungsgrundlage, die der
  README aus den Echtdaten belegt (Reinigungsgebühr > Übernachtungsertrag bei
  Kurzaufenthalt).
* Wirkt bei den heutigen 3 Verträgen an keiner einzigen Zahl.

### UMGESETZT: Weg B (11.08.2026)

Gebaut wurde Weg B — der Vertrag vollständig, damit die Vertragsmaske nichts
anbietet, was nirgends wirkt.

In `owner_statements/common.py` (dem geteilten Helfer, also für Kalender UND
Abrechnung gleichzeitig):

* `Vertragsregeln` — DB-freier Typ für die Regeln eines Vertrags, gebaut aus der
  Zeile über `vertragsregeln_aus_zeile`.
* `owner_payout_vertrag` — die volle Kette in der Reihenfolge der Vereinbarung:
  Pauschale `vor_provision` verkleinert die Bemessungsgrundlage → Provision →
  Mindestprovision hebt sie ggf. an → Eigentümer-Anteil → Pauschale
  `nach_provision`. Ein negatives Ergebnis wird NICHT auf 0 geklemmt.
* `pauschale_betrag_je_buchung` — `je_buchung` bzw. `je_nacht × Nächte des
  Aufenthalts` (nicht der im Fenster sichtbaren).
* `_pruefe_waehrung` — Vertragswährung ≠ Buchungswährung ist der neue Grund
  `waehrung_vertrag`, kein stillschweigender Kurs von 1,0.
* `naechte_payout_map` nimmt jetzt `regeln` ODER `provision_pct`; keines von
  beiden ist ein Fehler, keine 0 %.

Angeschlossen an **drei** Verbraucher, damit keine vierte Zahl entsteht:
`public_portal` Kalender (`_vertrag_je_buchung`), `public_portal` Einnahmen-
Übersicht und `owner_statements._rental_rows` (`_vertraege_je_buchung`).
Vorrang dort: Editor-Override → Vertrag → Altspalten. Der Stichtag ist überall
der **Check-out der Buchung** — in der Abrechnung derselbe Stichtag, den sie
schon für den Währungskurs benutzt.

Unterschiedlich behandelt wird ein UNGÜLTIGER Vertragssatz: der Kalender
loggt und lässt die Zelle leer (eine Stammdatenlücke darf die Belegungsansicht
nicht abreißen), die Abrechnung wirft 422 (ein Dokument über Geld darf nicht
mit einem ignorierten Vertrag entstehen).

**Verifiziert gegen die Live-DB**, nicht nur per Test: die vier
August-Buchungen von *Stjerneskud* ergeben 3.580,50 + 1.732,51 + 2.818,21 +
3.700,65 = **11.831,87 DKK**; Kalenderweg (Summe der verteilten Nächte) und
Abrechnungsweg liefern bei jeder Buchung dieselbe Zahl. Gate: 2520 pytest grün,
ruff sauber, pylint 10.00/10 auf allen drei geänderten Modulen, `tsc` sauber,
0 ESLint-Errors, 24 Locales vollständig.

Offen bleibt bewusst: die Altspalten sind noch Rückfall (README-Schritt 3
braucht erst für jeden Eigentümer einen Vertrag), und `fee_classification`
(Etappe A) ist weiter leer — betrifft nur Objekte MIT Extras, *Stjerneskud* hat
keine.

### Weg C — strikt nur Vertrag (README-Schritt 3)

Alte Spalten abgeschaltet. **Heute nicht machbar**: die zwei Objekte mit
`commission_override_pct = 20 %` und Owner `3ecdc4be` (15 % Default) verlieren
ihren Satz, weil sie keinen Vertrag haben — es gäbe MEHR leere Zellen als
vorher. Setzt voraus, dass jeder Eigentümer eines Betriebs einen Vertrag hat
(README-Schritt 2), und das ist eine fachliche Entscheidung je Eigentümer, die
die Agentur in der Oberfläche bestätigen muss.

## 6. Was der Umstieg NICHT löst

Owner `b5816089` hat 3 Objekte und 9 Buchungen, aber weder Vertrag noch Satz.
Nach jedem der drei Wege bleibt sein Kalender leer — richtigerweise, denn
niemand hat je einen Satz vereinbart. Was sich ändert, ist nur, dass die
Oberfläche jetzt sagt, WARUM (siehe unten). Dieselbe Lücke gilt für 16 von 17
Eigentümern ohne Satz; sie ist durch Datenpflege zu schließen, nicht durch Code.

## 7. Bereits behoben (unabhängig vom Umstieg)

Der Grund für das leere Feld wurde berechnet, geloggt und dann verworfen: das
Backend liefert `owner_payout_unknown_reason` seit Etappe B mit, die
Kalender-UI hat das Feld nie gelesen und überall nur `betrag ?? "—"` gerendert.
Ein Eigentümer konnte damit nicht unterscheiden zwischen „diese Nacht bringt
nichts" und „bei uns fehlt eine Stammdatenangabe".

Behoben in `web/components/portal/portal-kalender.tsx`: der Grund wird durch
`Aufenthalt.grund` geführt und an allen vier Anzeigestellen ausgewertet —
Chip-Betrag, Chip-Tooltip, Sammel-Chip („+n") und Tageszelle. Statt „—" steht
die Kurzform „k. A.", der Tooltip nennt den Klartext („Für dieses Objekt ist
kein Provisionssatz hinterlegt — die Verwaltung muss ihn ergänzen"). Labels in
allen 24 Sprachen unter `portal.calendar.payoutUnknown`. Zwei Stellen, die
vorher stumm einen vorhandenen Betrag verwarfen, setzen jetzt ebenfalls einen
Grund: der Währungs-Mismatch innerhalb eines Aufenthalts und die
Überlauf-Summierung im „+n"-Chip. Ein unbekannter Grund fällt auf das
allgemeine Label zurück, nie auf den rohen Slug.

Gate: `tsc --noEmit` und `bun run lint` in `web` fehlerfrei (0 Errors, keine
neue Warnung in der Datei), `pruefe-locales-vollstaendig.mjs web` grün (24
Locales), `pytest` für `public_portal` und `owner_statements` je 61 grün.
