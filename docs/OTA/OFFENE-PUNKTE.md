# Offene Punkte — Eigentümer-Abrechnung & OTA-Daten

Stand 11.08.2026. Nach Priorität, nicht nach Entstehung.

## 1. Portal-Abzugssätze korrigieren (blockiert: Schreibzugriff)

Zwei Werte in `portal_abzugssaetze` sind vertauscht und die Zahlungsgebühr fehlt:

| Kanal | gespeichert | richtig |
|---|---|---|
| booking | 15,5 % / — | **15,0 % + 1,5 %** |
| airbnb | 15,0 % / — | **15,5 % / keine** |

Belege (dreifach):
1. `docs/OTA/Buchungen_2024-01-01_2026-08-11.xls` — 199 Ok-Buchungen,
   `Kommission / Gesamtbetrag` = 16,50 % über alle 18 Objekte
   (157 exakt, 35 innerhalb 5 DKK Rundung auf Nachtebene).
2. Booking-Notes zu BDC-5012668004: `OTA Commission: 195.00` = 15,0 % von
   1.300,00 **plus** `Payment charge is DKK 19.5` = 1,5 %. Summe 214,50 = 16,50 %.
   Die 16,5 % des Exports sind also die SUMME, nicht die Provision allein.
3. Storno 6302214917: Provision entfiel, 1,5 % blieben stehen — die
   Zahlungsgebühr ist ein eigenständiger Posten.

Fertige Korrektur: `docs/OTA/korrektur-abzugssaetze.sql` (zwei `update`-Zeilen,
mit `where` auf tenant + kanal, mit Gegenprobe-select).

**Danach:** Backfill fahren, damit 0366 gefüllt ist —
`python -m scripts.portal_finanzen_backfill --tenant a25577cf-c941-45c4-8d23-008887e631aa`

## 2. Rechenkette — verifiziert, kein Handlungsbedarf

Janines Zeile (021 Stjerneskud, Booking, 21.–29.08.2026) durch den echten Code
gerechnet: alle sechs Zwischenwerte stimmen auf den Cent.

```
Gast zahlt                        5.420,81   = 4.625,81 Nächte + 795,00 Reinigung
− Booking 15,0 %                   −813,12
− Zahlungsgebühr 1,5 %              −81,31
                                 = 4.526,38   „Ausbezahlt AirSmil"
− Reinigung (provisionsFREI)       −795,00
                                 = 3.731,38   ← Bemessung der Verwaltungsprovision
− AirSmil 20 %                     −746,28   (genau 20,00 % von 3.731,38)
                                 = 2.985,10
+ NK-Pauschale 200 − Kaffee&Co 50 = 3.135,10  ✓
```

Der Punkt, an dem ich mich vorher verrechnet hatte: die 20 % gehen auf den
Betrag **nach** Abzug der Reinigung, nicht auf die 4.526,38. Die Kette macht
das über `gebuehren_aufteilen` → `aus_bemessung` schon richtig.

Noch nicht abgebildet: NK-Pauschale (+200) und Kaffee&Co (−50). Beides sind
`owner_expenses`/`owner_recurring_items`-Posten, keine Vertragsregeln. Die
Tabellen existieren, die Anbindung an die Abrechnungszeile fehlt.

## 3. Booking-Historie importieren

Bei uns 55 Booking-Buchungen (alle ab 01.08.2026 — der Kanal wurde erst am
10.08.2026 verbunden). Im Extranet-Export 252 Buchungen ab 01.01.2024.

Über Channex ist das nicht rückholbar: alle 20 Kanäle bieten ausschließlich
`load_future_reservations`, es gibt keine Vergangenheits-Aktion. Der Weg muss
wie bei Airbnb an Channex vorbeiführen.

Backend existiert: `channel_manager/csv_import.py` mit
`GET /bookings/csv-template` + `POST /bookings/csv-import` (BOM-Strip,
Delimiter-Autoerkennung, idempotent über `external_id`, max. 1000 Zeilen).
**Es fehlt die Oberfläche** und die Zuordnung der Export-Spalten:

```
Unterkunftsname · Lage · Name des Buchers · Genius-Bucher · Anreise ·
Abreise · Gebucht am · Status · Gesamtbetrag · Kommission · Währung · Buchungsnummer
```

Einschränkung, die vorher geklärt sein muss: der Export hat **keinen Nachtpreis
und keine Gebührenaufstellung**, nur `Gesamtbetrag`. Die Zerlegung
(Übernachtung / Reinigung / Resort) müsste aus den Objekt-Stammdaten kommen und
wäre eine Schätzung — in 0366 als `quelle='stammdaten'` zu markieren.

## 4. Migration 0367 einspielen

`supabase/migrations/0367_rateplan_name_ohne_fremdportal.sql` — entfernt
„ (von Airbnb)" aus `rate_plans.name`. Live gesehen an einer **Booking**-Buchung:
„Grundpreis (von Airbnb) DKK 600,00". Der Code schreibt schon „Grundpreis",
die Altnamen stehen noch in der DB.

## 5. `property_pricing_config.fees` ist ein JSON-Array

Die Gebühren eines Objekts liegen als JSON in einer Spalte, nicht als Tabelle.
Folgen: nicht abfragbar, keine Constraints, keine Zeitachse — obwohl die
gebraucht wird (Airbnb rechnete bei HM94QD5Y3X 1.075 Reinigung ab, am Objekt
sind 795 gepflegt). Eine echte `property_fees`-Tabelle wäre der richtige Ort.

Eigener Umbau mit Migration + Anpassung an drei Stellen. Nicht dringend, aber
die strukturelle Wurzel dafür, dass Beträge schwer zu finden sind.

## 6. `sprachen.py` ist untracked

`apps/api/src/features/inbox/sprachen.py` wird von `planung.py:24` hart
importiert, ist aber nicht in git. Muss in den nächsten Commit, sonst ist der
Baum für andere kaputt.
