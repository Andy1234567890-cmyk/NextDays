# Slice: owner_reporting — Reporting für Eigentümer

Die Ebene ÜBER der einzelnen Abrechnung: eine Auswertung über einen Zeitraum ×
eine Objektauswahl, aus der je Empfänger eine Auszahlung entsteht. Vorbild ist
der Branchenstand (Lodgify „Reporting für Eigentümer", Hostaway „Owner
Statements", Guesty „Owner Revenue Reports"): erst der Bericht über den
Bestand, dann die Zahlungen daraus.

Enthält: `router.py`, `service.py`, `auswertung.py`, `empfaenger.py`,
`statistik.py`, `perioden.py`, `fehler.py`, `schemas.py`, `dependencies.py`,
`tests/`.

## Drei Ebenen

```
Bericht  (owner_reports)              Zeitraum × Objekte × Währung × Basis
   │
   ├── Aufschlüsselungen              LIVE gerechnet, nie gespeichert
   │     Mieten je Objekt · Gebühren je Art · Provisionen je Kanal ·
   │     Zahlungsarten · Nettoeinkommen je Kanal · je Buchung
   │
   └── Zahlung  (owner_report_payments)          je EMPFÄNGER, SNAPSHOT
         ├── Posten (owner_report_payment_items) 5 Abschnitte
         └── Teilzahlung (…_payment_parts)       ergibt „bezahlter Prozentsatz"
```

**Warum der Bericht live rechnet und die Zahlung nicht:** Eine nachgetragene
Buchung im Zeitraum MUSS sich im Bericht zeigen, sonst wäre er stumm veraltet.
Die Zahlung dagegen ist eine Forderung — sie darf sich nicht ändern, nur weil
jemand später eine Gebühr am Objekt korrigiert. Dieselbe Trennung wie zwischen
Vorschau und finalisierter Rechnung in `owner_statements` (0064).

## Die fünf Abschnitte einer Zahlung

`unterkunftspreis` · `gebuehren` · `steuern` · `ausgaben` · `andere`

`ausgaben` ist der EINZIGE Abschnitt mit negativen Beträgen (DB-CHECK
`summe_ausgaben <= 0`) — er mindert die Auszahlung. Ohne diese Regel wäre aus
einem Vorzeichenfehler eine Zahlung statt eines Abzugs geworden.

## Rechenkette — hier steht KEINE eigene Formel

Jede Zahl über Geld entsteht in `owner_statements/common.py`:

```
Gastpreis  = Übernachtung + Gebühren + Zusatzleistungen
           − Portal-Abzug (Provision + ggf. Zahlungsgebühr)   → Auszahlungsbasis
           − provisionsfreie Gebühren                          → Bemessungsgrundlage
           − Pauschale (vor_provision)
           − Verwaltungsprovision (mind. Mindestprovision)
           − Pauschale (nach_provision)
           + provisionsfreie Gebühren des Eigentümers          → Netto
```

Eine zweite Formel in diesem Slice hieße, dass Abrechnung und Bericht über
denselben Zeitraum verschiedene Beträge zeigen — der Fehler, den niemand als
Bug erkennt, weil beide Zahlen plausibel aussehen.

Bezugsquellen (alle bestehend, nichts neu erfunden):

| Frage | Quelle |
|---|---|
| Was behält das Portal ein? | `reservations.ota_commission`, sonst `portal_abzugssaetze` (0364) |
| Wem gehört eine Gebühr? | `fee_classification` (0343), zwei Achsen |
| Welche Gebühren fielen wirklich an? | OTA-Payload vor Objekt-Stammdaten (`gebuehren_quelle`) |
| Welcher Provisionssatz gilt? | `owner_billing_terms` (0343), Stichtag = Check-out |
| Kurs bei Fremdwährung | `owner_statements/fx.py` (ECB, `fx_rates`-Cache) |

## Mehrwährung

Ein Bericht hat GENAU EINE Währung. Buchungen in anderer Währung werden mit dem
ECB-Tageskurs am Check-out umgerechnet — derselbe Stichtag wie in der
Abrechnung, sonst stünde auf Bericht und Beleg eine andere Zahl. Lässt sich ein
Kurs nicht beschaffen, fällt die Buchung mit BENANNTER Warnung heraus; es wird
nie mit Kurs 1,0 weitergerechnet (Wurzel 4).

Wiederkehrende Posten und Vertrags-Pauschalen werden NICHT umgerechnet: 50 DKK
sind 50 DKK. Passt die Währung nicht, schlägt das Erzeugen der Zahlung mit 422
fehl.

## Warnungen statt stiller Lücken

Fehlender Provisionssatz, nicht zugeordnete Gebührenart, fehlender Kurs: die
Buchung wird nicht kommentarlos übersprungen, sondern erscheint in
`ReportDetail.warnungen`. Beim ERZEUGEN einer Zahlung sind Warnungen ein harter
422 — eine Zahlung, in der zwei von zwölf Aufenthalten fehlen, sieht vollständig
aus (Wurzel 5).

## Geplante Berichte

`owner_report_schedules` + n:m-Objekte/Empfänger. Rhythmus
(`woche|monat|quartal|jahr`), Lauftag (`erste|letzte`), ausgewerteter Zeitraum
(`vergangener|laufender`). Die Datumsmathematik liegt DB-frei in `perioden.py`
und ist damit als Einheit prüfbar — inklusive Quartals- und Jahreswechsel, wo
jede naive Monatsrechnung schiefgeht.

Idempotenz (Wurzel 2): `zuletzt_erzeugt_fuer` plus UNIQUE-Index auf
`(schedule_id, period_from, period_to)`. Eine doppelte Cron-Zustellung erzeugt
denselben Bericht nicht zweimal.

## Statistik

`statistik.py` rechnet über die TEILZAHLUNGEN, nicht über die Zahlungsbeträge:
die Kurve heißt „im Laufe der Zeit gezahltes Geld" und meint tatsächlich
geflossenes Geld. Über Zahlungsbeträge gerechnet zeigte sie Forderungen.
Mischwährung wird nicht addiert — eine Leitwährung wird benannt, die übrigen
stehen daneben.

## Endpunkte (`/api/v1/owner-reporting`, `OWNER_REPORTING`, tenant-gescoped)

- `GET|POST /reports` · `GET|PATCH|DELETE /reports/{id}`
- `GET /reports/{id}/bookings` — Aufschlüsselung nach Buchung
- `POST /reports/{id}/payments` — Zahlung je Empfänger erzeugen (idempotent)
- `GET /payments` (`?nur_offene=&owner_id=`) · `GET|PATCH|DELETE /payments/{id}`
- `POST /payments/{id}/mark-paid` · `POST /payments/{id}/parts` · `DELETE /parts/{id}`
- `GET /recipients` — Empfänger-Übersicht (Zahlungen, Volumen je Währung, Vertragsstand)
- `GET|POST /recipients/{owner_id}/recurring` · `PATCH|DELETE /recurring/{id}`
- `GET|POST /schedules` · `GET|PATCH|DELETE /schedules/{id}`
- `GET /statistics?von=&bis=[&currency=][&owner_id=]`
- `POST /schedules/run` — interner Cron (Secret-Header, nicht im Schema)

## Daten (Migration 0365)

`owner_reports` (+ `owner_report_properties`), `owner_report_payments`
(+ `_items`, `_parts`), `owner_report_schedules` (+ `_properties`,
`_recipients`), `owner_recurring_items`.

**Wurzel 6:** Alle Tabellen sind Finanzdaten → `enable rls` + tenant-Policy
**plus** `revoke all … from anon, authenticated`. Die n:m-Tabellen ohne eigene
`tenant_id` prüfen über ihren Elternsatz (eine eigene Spalte wäre eine zweite
Wahrheit, die per UPDATE abweichen könnte).

**Realtime:** bewusst KEINE Publikation. Ohne SELECT-Grant passt keine Policy,
ein Abo wäre eine stumme Attrappe — dieselbe Lage wie bei `owner_statements`
(0337). Die Masken laden über die API und aktualisieren nach der eigenen Aktion.

## Abgrenzung zu bestehenden Slices

| Begriff bei Lodgify | Hier |
|---|---|
| Empfänger | `owners` (`/eigentuemer`) — nicht dupliziert, nur ausgewertet |
| Strategie (Zimmer-Tarif / Gebühren / Steuern) | `owner_billing_terms` + `fee_classification` (0343) |
| Erweiterte Einstellungen → Kanalprovision | `portal_abzugssaetze` (0364) |
| Zahlung → Rechnung erstellen | `owner_statements` (0064), Verweis in `statement_id` |
