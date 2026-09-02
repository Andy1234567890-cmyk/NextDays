# Plan: Gliederung der Eigentümer-Abrechnung und -Rechnung

Stand der Analyse: 02.09.2026. Auftraggeber-Wortlaut:

> „Wir müssen bei der Abrechnung und Rechnung die Gliederung: An- + Abreise,
> Nächte, Kanal, Gebühren Reinigung etc. (Auflistung), Eigentümer-Anteil (aus
> Vertrag), Abzüge z. B. 250 DKK, Gebühren Resort wenn eine Angabe ist."

Dieses Dokument ist der Bauplan für die Umsetzung. Es beschreibt den Ist-Stand
mit Datei und Zeile, die Soll-Gliederung, die nötigen Änderungen je Schicht,
die Tests und die Gates. Wer es umsetzt, liest zuerst `CLAUDE.md` (die neun
Wurzeln) und `apps/api/src/features/owner_statements/README.md`.

---

## 0. Begriffe

| Wort im Auftrag                   | Was es im System ist                                                                                                                                                                                                                |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Abrechnung**                    | `owner_statements`-Zeile im Status `draft`, Vorschau (`POST /preview`) und Editor (`web/components/owner-statements/statement-editor.tsx`)                                                                                          |
| **Rechnung**                      | dieselbe Zeile nach `finalize`: `kind='invoice'`, fortlaufende Nummer `RE-…`, Steuer eingefroren, für den Eigentümer sichtbar; Storno = `kind='cancellation'` (`ST-…`)                                                              |
| **Beleg / PDF**                   | `web/lib/statement-pdf.ts` → `buildStatementHtml` → Playwright-Render-Dienst `/api/v1/generate-pdf-single`. EIN HTML für Betrieb UND Eigentümer; der Unterschied entsteht allein durch die serverseitige Maske (`null` = weglassen) |
| **Eigentümer-Anteil aus Vertrag** | `owner_billing_terms` (0343): `provisions_pct`, Mindestprovision, Pauschale (je Buchung/je Nacht, vor/nach Provision), Zeitachse, Stichtag = Check-out                                                                              |
| **Gebühren**                      | `common.Gebuehr(art, betrag, gehoert_zu, provisionspflichtig)` aus `gebuehren_quelle.gebuehren_der_buchung` (OTA-Payload vor Objekt-Stammdaten), Zuordnung aus `fee_classification` (0343)                                          |
| **Abzüge**                        | DREI Quellen, siehe §2.6                                                                                                                                                                                                            |
| **Resort**                        | Gebührenart `resort` (Booking `PASS_THROUGH_RESORT_FEE`, Airbnb `RESORTFEE`, Stammdaten-Katalog `properties/gebuehren.py`), live 151 Posten im Kundenbestand                                                                        |

Nicht Gegenstand dieses Plans: die Gast-Rechnung (`buchhaltung/reservation_invoice.py`)
und die Zahlungen aus `owner_reporting` (5 Abschnitte). Letztere rechnen über
dieselbe Kette und müssen nach dem Umbau dieselben Zahlen liefern (Gate §6).

---

## 1. Ist-Stand

### 1.1 Die Rechenkette ist vollständig — die Zeile zeigt sie nicht

`owner_statements/common.py::auszahlung_berechnen` (Z. 519–607) liefert je
Buchung ein `Auszahlung`-Objekt mit elf Werten in dieser Reihenfolge:

```
brutto                    Gastpreis = Übernachtung + Gebühren + Zusatzleistungen
− portal_provision        gemeldet (reservations.ota_commission) sonst Satz (portal_abzugssaetze 0364)
− portal_zahlungsgebuehr  nur wenn das Portal einzieht (portal_zieht_ein)
= auszahlungsbasis
− gebuehren_aus_bemessung alle PROVISIONSFREIEN Gebühren + Extras
− Pauschale (vor_provision)
= bemessungsgrundlage
− verwaltungsprovision    × provisions_pct, mindestens min_provision_betrag
− Pauschale (nach_provision)          → Feld `pauschale`
+ gebuehren_an_eigentuemer            provisionsfreie Gebühren, die IHM gehören (+ Extras)
= netto
```

`service.py::_rental_rows` (Z. 922–1148) übernimmt in `RentalRow` nur:
`total_price` (= brutto), `total_payout`, `owner_payout` (= netto),
`portal_provision`, `bemessungsgrundlage`, `verwaltungsprovision`, `pauschale`,
`gebuehren_an_eigentuemer`. **Verworfen werden**: `portal_zahlungsgebuehr`,
`auszahlungsbasis`, `gebuehren_aus_bemessung` und — entscheidend — **die
Gebührenliste selbst** (`befund.gebuehren`). Das Objekt `Auszahlung` trägt die
Liste heute gar nicht; sie existiert nur lokal in
`_auszahlung_einer_buchung` (Z. 514–570) und geht dort verloren.

Folge im Beleg (Screenshot 02.09.2026, Feriehus „Perlen"):
`Portal −849,38 · Verwaltung −703,84 · Pauschale −50,00 · Gebühren +725,00`
als 9-px-Grauzeile unter dem Betrag. „Gebühren +725,00" ist eine Summe ohne
Aufstellung — ob darin Resort 225 und Nebenkosten 500 stecken oder etwas
anderes, kann niemand ablesen. Die Reinigung (gehört dem Betrieb) erscheint
**gar nicht**, obwohl sie den Gastpreis mindert.

### 1.2 Was der Zeile fehlt

| Soll (Auftrag)                | Ist in `RentalRow` (`schemas.py` Z. 122–214)                                                                                                                               |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An-/Abreise                   | **fehlt**. `_reservations` (Z. 823–866) lädt `check_in, check_out` bereits, `_rental_rows` gibt nur `nights` weiter                                                        |
| Nächte                        | `nights` ✔                                                                                                                                                                 |
| Kanal                         | `channel` (roh: `booking`, `airbnb`, `direct`, `portal`); `ota_name` (echter Portalname, 0031) wird nicht geladen                                                          |
| Gebühren einzeln              | **fehlt** (nur Summe `gebuehren_an_eigentuemer`; Betriebsgebühren unsichtbar)                                                                                              |
| Eigentümer-Anteil aus Vertrag | `verwaltungsprovision` ✔, aber der **Satz je Zeile fehlt** — `commission_pct` steht nur abrechnungsweit am Kopf und ist bei gemischten Objektverträgen der gewichtete Wert |
| Abzüge                        | `pauschale` ✔; Verrechnungsposten stehen in eigener Tabelle ✔; **wiederkehrende Posten fehlen komplett** (§1.4)                                                            |
| Resort                        | steckt namenlos in `gebuehren_an_eigentuemer` oder — je nach Zuordnung — in der unsichtbaren Betriebsgebühr                                                                |

### 1.3 Der Beleg heute (`web/lib/statement-pdf.ts`)

Eine Tabelle „Vermietungs-Aktivität" mit 6–7 Spalten (Gast, Nächte, Objekt,
Kanal, [Gesamtpreis], Auszahlung, Eigentümer-Auszahlung), darunter
„Verrechnungsposten", dann ein Summenblock (Mieteinnahmen, Gesamt-Auszahlung,
Verrechnung zugunsten/zulasten, Umsatzsteuer, Eigentümer-Auszahlung,
Verwaltungs-Auszahlung). Alle Beschriftungen deutsch, gebündelt in `txt`
(Z. 52–60) — eine Übersetzung ist vorbereitet, aber nicht gebaut.

Die Editor-Tabelle (`statement-editor.tsx::RentalActivity`, Z. 820–950) hat
dieselben Spalten; die Kette hängt als `AuszahlungsKette` (Z. 1650–1682) unter
dem Auszahlungsbetrag. Labels aus `web/messages/*.json` →
`ownerStatements.rental.*` (24 Sprachen).

### 1.4 Wiederkehrende Posten werden in der Abrechnung ignoriert

`owner_recurring_items` (0365: `label`, `abschnitt`, `modus`
je_buchung/je_nacht/je_zeitraum, `betrag`, `currency`, `property_id`) liest
**nur** `owner_reporting/service.py::_recurring_betraege` (Z. 781–836).
`owner_statements` kennt die Tabelle nicht (`grep recurring` → 0 Treffer).

Genau dort gehören laut `tests/test_abrechnungszeile.py` (Docstring
`test_die_ganze_zeile_des_betriebs_geht_auf`) die beiden Posten der echten
Betriebsabrechnung hin, die heute von Hand ergänzt werden müssen:
„Kaffee&Co Gebühr von Eigentümer −50" und „NK-Pauschale an Eigentümer +200".
Das ist der Auftrag „Abzüge z. B. 250 DKK": ein Betrag, der nicht aus der
Buchung kommt, sondern aus einer Dauervereinbarung — und der in der
Abrechnung heute nicht auftaucht.

### 1.5 Snapshot-Grenze (Risiko, nicht Auftrag)

`finalize` friert nur die **Summen** ein (`_snapshot_summary`, Z. 1707–1785).
Die **Zeilen** werden bei jedem `get` live neu gerechnet (`_build_activity`,
Z. 1619–1650 → `_reservations` → `_rental_rows`). Eine nachträglich geänderte
Gebühr am Objekt oder ein neuer Vertrag verändert die Zeilen einer bereits
nummerierten Rechnung, während die Summe stehen bleibt. Jede hier geplante
Verfeinerung der Zeile macht diese Lücke sichtbarer. Sie wird in diesem Plan
**benannt und als Folgeauftrag** ausgewiesen (§8), nicht nebenbei gelöst.

### 1.6 Maske (§4.2 Lastenheft, `auth/guest_masking.py::GuestMask`)

Der Eigentümer sieht: Vorname, Nächte, Kanal, seine Auszahlung, seine Kette ab
Verwaltungsprovision. Er sieht **nicht** (`mask.amount` → `null`): Gastpreis,
Portal-Provision, Bemessungsgrundlage, Verwaltungs-Auszahlung. Das PDF lässt
`null` weg — nicht „—", nicht 0. Diese Regel gilt unverändert für jede neue
Spalte.

---

## 2. Soll-Gliederung

### 2.0 Grundsatz (Auftraggeber, 02.09.2026): jede Gebühr ist ein eigener Posten

> „Jede Gebühr muss als einzelner Posten aufgeschlüsselt werden auf der
> Abrechnung."

Das heißt verbindlich:

- **Keine Sammelzeile.** „Gebühren +725,00" darf es nicht mehr geben — weder
  im PDF noch im Editor noch als einzige Zahl in der API. Jede Gebühr
  (Reinigung, Resort, Nebenkosten, Haustier, Wäsche …) steht mit Art, Betrag,
  Zugehörigkeit und Provisionspflicht als eigene Zeile.
- **Jede Zusatzleistung ist ein eigener Posten.** `reservation_addons`
  (0075: `name` jsonb mehrsprachig, `qty`, `price`, `basis`, `total`,
  `status`) wird heute in `_addon_sums` (service.py Z. 889–920) zu EINER
  Zahl je Buchung summiert. Künftig liefert die Zeile jede Zusatzleistung
  einzeln (Name, Menge × Einzelpreis, Gesamt); die Summe bleibt nur als
  Rechengröße für die Kette.
- **Jeder Vertragsposten ist ein eigener Posten**: Verwaltungsprovision (mit
  Satz), Mindestprovision (wenn sie greift, als eigene Zeile „Mindestprovision
  statt x %"), Pauschale (je Buchung/je Nacht mit Anzahl).
- **Jeder Portal-Abzug ist ein eigener Posten**: Provision und Zahlungsgebühr
  getrennt (Booking erhebt beides, Airbnb nur eines).
- **Jeder einmalige oder wiederkehrende Posten** (Verrechnungsposten,
  `owner_recurring_items`) ist eine eigene Zeile mit Herkunft.
- Aggregierte Felder (`gebuehren_an_eigentuemer`, `gebuehren_betrieb`,
  `addon_total`) bleiben in der API als **Kontrollsummen**; ein Test erzwingt
  Σ Einzelposten = Kontrollsumme (§5). Die Anzeige rechnet nie selbst.
- Der Posten-Block je Buchung wird **immer** gedruckt — kein Schwellwert, kein
  Anhang. Bei vielen Buchungen wird der Beleg länger; das ist gewollt. Eine
  Kompakttabelle steht als Übersicht davor (§2.2), ersetzt die Posten aber
  nicht.

### 2.1 Je Buchung ein Block, nicht eine Zeile

Die Auftrags-Gliederung ist die Abrechnung, die der Betrieb heute von Hand
schreibt (Vorlage: `test_abrechnungszeile.py`, Kopfkommentar, 021 Stjerneskud).
Sie ist eine **Kette von Posten je Buchung**, keine Spaltenreihe. Deshalb:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Feriehus „Perlen" Tversted · Christian P. · Booking.com                       │
│ Anreise 02.09.2026 · Abreise 07.09.2026 · 5 Nächte                           │
├──────────────────────────────────────────────────────────────────┬───────────┤
│ Gastpreis (inkl. Gebühren)                              [Betrieb] │  6.262,50 │
│ − Portal-Provision Booking.com (gemeldet)               [Betrieb] │   −849,38 │
│ − Portal-Zahlungsgebühr 1,5 %                           [Betrieb] │    −xx,xx │
│ = Auszahlung des Portals                                [Betrieb] │  5.413,12 │
│ Gebühren im Gastpreis — aus der Bemessung genommen                │           │
│ − Reinigung · verbleibt beim Betrieb · provisionsfrei   [Betrieb] │ −1.075,00 │
│ − Resortgebühr · Eigentümer · provisionsfrei                      │   −225,00 │
│ − Nebenkosten · Eigentümer · provisionsfrei                       │   −500,00 │
│ − Zusatzleistung Bettwäsche-Set 2 × 95,00 ·         [Betrieb]     │   −190,00 │
│ = Bemessungsgrundlage                                   [Betrieb] │  3.329,20 │
│ − Verwaltungsprovision 20 % (Vertrag ab 01.01.2024)               │   −665,84 │
│ − Pauschale je Buchung (Vertrag)                                  │    −50,00 │
│ Gebühren des Eigentümers — ungekürzt zurück                       │           │
│ + Resortgebühr                                                    │   +225,00 │
│ + Nebenkosten                                                     │   +500,00 ││
│ = Eigentümer-Anteil                                               │  3.528,36 │
└──────────────────────────────────────────────────────────────────┴───────────┘
```

`[Betrieb]` = Zeile läuft durch `mask.amount` und fehlt im Eigentümer-PDF.
Jede Gebühr erscheint genau so, wie die Kette sie verarbeitet: einmal beim
Herausnehmen aus der Bemessung, einmal beim ungekürzten Zurückgeben (nur
Eigentümer-Gebühren). Beide Male als **eigener Posten mit Namen**, nie als
Sammelsumme. Wer die Kette nachrechnet, findet jede Zahl der Aufstellung im
Code wieder (`gebuehren_aufteilen`, `auszahlung_berechnen`). Die
Beispielzahlen dienen der Form; Zwischenwerte sind nicht verifiziert (§6).

Die Zahlen oben sind der Screenshot vom 02.09.2026; die Zwischenwerte sind
**nicht** verifiziert und dienen nur der Form. Der Umsetzer prüft den Block
gegen die Live-Zeile (§6).

### 2.2 Kompaktansicht (Tabelle) bleibt

Editor und PDF behalten eine Tabelle für den Überblick, mit **neuen Spalten**:

| Spalte            | Quelle                                                     | Maske                                                                                                                                 |
| ----------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Objekt            | `listing`                                                  | sichtbar                                                                                                                              |
| Gast              | `guest`                                                    | Vorname (`mask.name`)                                                                                                                 |
| Anreise / Abreise | **neu** `check_in`, `check_out`                            | sichtbar                                                                                                                              |
| Nächte            | `nights`                                                   | sichtbar                                                                                                                              |
| Kanal             | `channel` + **neu** `ota_name`                             | sichtbar (`mask.source` prüfen — heute ungeprüft durchgereicht; beibehalten, Lastenheft §4.2 erlaubt die Buchungsquelle ausdrücklich) |
| Gastpreis         | `total_price`                                              | Betrieb                                                                                                                               |
| Portal-Abzug      | `portal_provision` + **neu** `portal_zahlungsgebuehr`      | Betrieb                                                                                                                               |
| Gebühren          | **neu** Liste, aufklappbar / im PDF als Unterzeilen        | Eigentümer-Gebühren sichtbar, Betriebsgebühren Betrieb (§7 Entscheidung A)                                                            |
| Provision         | `verwaltungsprovision` + **neu** `provisions_pct` je Zeile | sichtbar                                                                                                                              |
| Pauschale         | `pauschale`                                                | sichtbar                                                                                                                              |
| Eigentümer-Anteil | `owner_payout` (+ `owner_payout_converted`, Kurs)          | sichtbar                                                                                                                              |

Die Kompakttabelle ist die Übersicht. Darunter folgt für **jede** Buchung der
Posten-Block aus §2.1 (§2.0: immer, ohne Schwellwert). Im Editor ist der
Block je Zeile aufklappbar, mit „alle aufklappen"; im PDF steht er unter der
Tabelle je Buchung (Seitenumbruch per CSS `break-inside: avoid` je Block).

### 2.3 An- und Abreise

`RentalRow.check_in`, `RentalRow.check_out` (ISO-Datum) aus der schon
geladenen Reservierung. Anzeige über `formatDate` aus `web/lib/utils.ts` (Z. 17; `web/lib/format.ts`
gibt es NICHT — das ist eine Datei der Partner-App), im PDF
`Intl.DateTimeFormat(locale)`. Kein
Zeitzonen-Anteil — es sind Kalendertage (Wurzel 5b: es ist der Termin des
Gastes, nicht unsere Uhr; die Spalten sind `date`, nicht `timestamptz`).

### 2.4 Kanal

`channel` bleibt der Schlüssel; **zusätzlich** `ota_name` laden und als
Anzeigetext bevorzugen (`Booking.com` statt `booking`). Fehlt `ota_name`,
gilt das Label aus `calendar.channel.*` (de.json Z. 7068 ff., Zugriff über
`web/lib/use-calendar-labels.ts`; `kanal-felder.ts` ist ein
Feld-Übertragbarkeits-Katalog, KEINE Label-Quelle) — kein neues Mapping
(Kanal/Enum-Gate `scripts/i18n/kanal-enums-pruefen.mjs`). Das PDF hat keinen
Hook-Zugriff; dort `ota_name` bevorzugen und sonst den rohen Kanalschlüssel
über die vom Aufrufer übergebenen Labels auflösen (Parameter an
`buildStatementHtml`, kein Duplikat der Liste).

### 2.5 Gebühren (Aufstellung)

`common.Auszahlung` bekommt ein Feld `gebuehren: tuple[Gebuehr, ...]` (die
Liste, mit der gerechnet wurde). `RentalRow` bekommt

```python
class GebuehrZeile(BaseModel):
    art: str                    # cleaning_fee | resort | pet_fee | …
    label: str                  # FEE_TYPE_LABEL (properties/gebuehren.py Z. 147) oder Portal-Originaltext (befund.bezeichnungen)
    betrag: float | None        # Quellwährung; None = maskiert
    gehoert_zu: str             # betrieb | eigentuemer | durchlauf
    provisionspflichtig: bool
    quelle: str                 # ota | stammdaten  (aus befund.quelle)

class RentalRow(BaseModel):
    ...
    gebuehren: list[GebuehrZeile] = Field(default_factory=list)
    gebuehren_betrieb: float | None      # Σ gehoert_zu='betrieb' (maskiert wie total_price)
    gebuehren_durchlauf: float | None    # Σ 'durchlauf' (Kurtaxe, Kaution) — informativ
```

`gebuehren_an_eigentuemer` bleibt als **Kontrollsumme** (Eigentümer-Gebühren

- Zusatzleistungen); Test: Σ `gebuehren[].betrag` mit
  `gehoert_zu='eigentuemer' and not provisionspflichtig` + Σ Zusatzleistungen
  == `gebuehren_an_eigentuemer` (§5).

**Zusatzleistungen einzeln** (§2.0): `_addon_sums` wird zu `_addon_zeilen`,
liest `reservation_addons` (`id, reservation_id, name, qty, price, basis,
total, status`) mit denselben Regeln wie heute (pending UND paid zählen,
cancelled nicht; vollständig paginiert) und liefert je Zusatzleistung eine
`GebuehrZeile` mit

```python
    art="addon"
    label=<name in der Belegsprache>   # jsonb: erst Sprache des Belegs (heute de),
                                       # sonst ERSTER vorhandener Wert — nie ein
                                       # erfundener Text, leer bleibt leer und wird
                                       # als Datenmangel geloggt
    menge=qty, einzelpreis=price, basis=basis   # neue optionale Felder an GebuehrZeile
    betrag=total
    gehoert_zu="eigentuemer", provisionspflichtig=False, quelle="addon"
```

Die Kette selbst rechnet weiter mit `addon_total` = Σ `total` dieser Zeilen
(unveränderte Formel); ein Test erzwingt die Gleichheit. `GebuehrZeile`
bekommt dafür `menge: int | None`, `einzelpreis: float | None`,
`basis: str | None` — bei Portal-/Stammdaten-Gebühren `None`.

Booking-Gebühren tragen den Originaltext des Portals (`befund.bezeichnungen`,
z. B. „Resortgebühr (Per night)") als `label`, damit der Betrieb den Posten
im Extranet wiederfindet; `art` bleibt der interne Schlüssel.

**Resort**: keine Sonderbehandlung im Code. Sie ist eine Gebührenart wie jede
andere und erscheint in der Aufstellung, sobald `befund.gebuehren` sie trägt.
„Wenn eine Angabe ist" ist damit automatisch erfüllt: keine Gebühr → keine
Zeile. Was NICHT passieren darf: die Resortgebühr aus den Stammdaten für eine
Portalbuchung ansetzen (`gebuehren_quelle.py` Z. 280–296, live 20.950 DKK
Fehlbetrag am 11.08.2026).

### 2.6 Eigentümer-Anteil aus Vertrag

Je Zeile zusätzlich:

```python
    provisions_pct: float | None        # Satz, mit dem DIESE Zeile gerechnet wurde
    provision_quelle: str | None        # "vertrag" | "override" | "altspalten"
    vertrag_gueltig_ab: date | None     # aus der aufgelösten Vertragszeile
    min_provision_angewandt: bool       # Mindestprovision hat gegriffen
```

`_vertraege_je_buchung` (Z. 571–640) liefert heute nur `Vertragsregeln`;
`gueltig_ab` muss aus der Zeile mitgenommen werden (Erweiterung von
`Vertragsregeln` um ein optionales Feld `gueltig_ab` oder ein paralleles
Dict — Vorschlag: Feld an `Vertragsregeln`, `common.py` bleibt DB-frei).
`min_provision_angewandt` kommt aus `auszahlung_berechnen` (dort ist der
Vergleich; ein neues Bool-Feld an `Auszahlung`).

### 2.7 Abzüge und Gutschriften — drei Quellen, ein Abschnitt

| Quelle                | Tabelle                           | Wirkung                                            | Heute in der Abrechnung          |
| --------------------- | --------------------------------- | -------------------------------------------------- | -------------------------------- |
| Vertrags-Pauschale    | `owner_billing_terms.pauschale_*` | je Buchung/Nacht, in der Zeile                     | ✔ (`pauschale`)                  |
| Verrechnungsposten    | `owner_expenses` (0064/0344)      | einmalig, `direction`                              | ✔ (Tabelle „Verrechnungsposten") |
| Wiederkehrende Posten | `owner_recurring_items` (0365)    | `je_buchung`/`je_nacht`/`je_zeitraum`, `abschnitt` | **✘ fehlt**                      |

Neu: `owner_statements` liest `owner_recurring_items` des Eigentümers (aktiv,
`property_id` passend oder NULL) und bildet je Posten eine Zeile:

```python
class WiederkehrenderPosten(BaseModel):
    item_id: str
    label: str
    abschnitt: str          # unterkunftspreis | gebuehren | ausgaben | andere
    modus: str              # je_buchung | je_nacht | je_zeitraum
    einzelbetrag: float
    anzahl: int             # Buchungen bzw. Nächte, 1 bei je_zeitraum
    betrag: float           # signiert: negativ bei abschnitt='ausgaben'
    currency: str
    property_id: str | None
```

Die Rechenregel wird **nicht** in `owner_statements` neu geschrieben, sondern
aus `owner_reporting._recurring_betraege` in ein geteiltes Modul gehoben
(`owner_statements/wiederkehrend.py`, DB-frei wie `common.py`; beide Slices
rufen es). Eine zweite Formel hieße zwei Zahlen für denselben Posten (dieselbe
Begründung wie bei `common.py`).

Währung: NICHT umrechnen, bei Abweichung 422 mit Postenname (identisch zu
`_recurring_betraege` und `_pruefe_posten_waehrung`).

Der Beleg bekommt einen Abschnitt **„Abzüge und Gutschriften"**, der beide
einmaligen Quellen zusammenführt, getrennt nach Richtung:

```
Abzüge (zulasten des Eigentümers)
  Kaffee & Co · wiederkehrend · 1 × 50,00                    −50,00 DKK
  Glühbirnen 12.08.2026 · Verrechnungsposten · Beleg ✔       −38,00 DKK
Gutschriften (zugunsten des Eigentümers)
  NK-Pauschale · wiederkehrend · 1 × 200,00                 +200,00 DKK
```

Die Vertrags-Pauschale bleibt in der Buchungszeile (sie ist je Buchung) und
wird im Summenblock als eigene Zeile „Pauschalen aus Vertrag (n Buchungen)"
ausgewiesen, damit die Summe aller Abzüge auf einen Blick steht.

### 2.8 Summenblock (Beleg-Ende)

```
Summe Eigentümer-Anteile aus Buchungen (n)                    x.xxx,xx
− Pauschalen aus Vertrag (n Buchungen)                          −xxx,xx   (bereits in den Anteilen enthalten → nur Ausweis, nicht erneut abziehen)
− Abzüge                                                        −xxx,xx
+ Gutschriften                                                  +xxx,xx
= Eigentümer-Auszahlung                                       x.xxx,xx   (fett, Owner-Währung)
────────────────────────────────────────────────── nur Betrieb:
Gastumsatz (inkl. Gebühren)                                   x.xxx,xx
Portal-Abzüge gesamt                                            −xxx,xx
Verwaltungs-Auszahlung (Bemessungsgrundlage der Rechnung)     x.xxx,xx
Umsatzsteuer …                                                  xxx,xx
```

Die Zeile „Pauschalen aus Vertrag" ist **Ausweis**, keine zweite Buchung: sie
ist in den Eigentümer-Anteilen schon enthalten. Das muss im PDF neben der Zahl
stehen („bereits in den Anteilen berücksichtigt"), sonst legt die nächste
Betreiberin sie wieder als Ausgabe an (Vorfall 20.08.2026, zwei Posten
„Indflytning-gebyr" doppelt).

---

## 3. Änderungen je Schicht

### 3.1 Backend — `apps/api/src/features/owner_statements`

**`common.py`** (DB-frei bleibt Pflicht)

- `Auszahlung`: neue Felder `gebuehren: tuple[Gebuehr, ...]`,
  `min_provision_angewandt: bool`, `extras: Decimal`.
- `Vertragsregeln`: optionales `gueltig_ab: date | None` (keine Rechenwirkung,
  reine Herkunft).
- `auszahlung_berechnen`: Liste und Bool durchreichen. Rechnung UNVERÄNDERT —
  `test_abrechnungszeile.py` muss ohne Zahlenänderung grün bleiben.

**Neu `wiederkehrend.py`** (DB-frei)

- `posten_betraege(items, buchungen_je_objekt: dict[pid, (n_buchungen, n_naechte)], currency) -> list[(item, anzahl, betrag)]`
  — die Logik aus `owner_reporting._recurring_betraege` Z. 806–836 eins zu
  eins, nur ohne DB. `owner_reporting` ruft künftig dieses Modul (Wurzel 1:
  alter Code nicht kopieren, sondern ersetzen). Aufrufer von
  `_recurring_betraege`: genau einer, `_posten_bauen` (owner_reporting
  Z. 749) — geprüft 02.09.2026.

**Neu `zeilen.py`** (Mixin `ZeilenMixin`, DB-Zugriff erlaubt)

- `service.py` hat 2.810 Zeilen bei `max-module-lines = 1500`
  (`apps/api/pyproject.toml` Z. 94) und trägt dafür bereits
  `# pylint: disable=too-many-lines` (Z. 25). **Neuer Code kommt in kein
  Modul, das die Grenze schon reißt** — die Ausnahme wird nicht weiter
  ausgereizt. `_rental_rows`, `_auszahlung_einer_buchung`,
  `_gebuehren_kontext`, `_portal_saetze_je_buchung`, `_vertraege_je_buchung`,
  `_gebuehren_herkunft` wandern als `ZeilenMixin` nach `zeilen.py`;
  `OwnerStatementsService(ZeilenMixin)` — Muster wie `affiliates/connect_service.py`.
- `_rental_rows` füllt die neuen `RentalRow`-Felder (§2.3–2.6).
  `ota_name` in `_reservations` mitselektieren.
- `_addon_sums` → `_addon_zeilen` (§2.5): je Zusatzleistung eine Zeile,
  Summe daraus für die Kette. Der bestehende `except Exception` mit
  `# noqa: BLE001` („fehlende Tabelle = kein Extra-Umsatz") ist ein
  verschluckter Fehler auf einem geldbewegenden Pfad (Wurzel 5): auf
  `APIError` eingrenzen und re-raisen als `StatementError(502)` — eine
  Abrechnung ohne die Zusatzleistungen ist zu niedrig und sieht vollständig
  aus.
- Neu `_wiederkehrende_posten(tenant_id, owner_id, rental_rows, owner_currency) -> list[WiederkehrenderPosten]`
  (lädt `owner_recurring_items`, ruft `wiederkehrend.posten_betraege`).

**`schemas.py`**

- `GebuehrZeile`, `WiederkehrenderPosten` (neu), `RentalRow` erweitert
  (§2.5, §2.6), `StatementSummary` erweitert:
  `recurring_to_owner: float`, `recurring_from_owner: float`,
  `pauschalen_gesamt: float | None` — **Pflichtfelder ohne Default** (Regel
  aus dem Kommentar zu `expenses_to_owner`, Z. 291–300: ein Default macht aus
  „Pfad hat es nicht gesetzt" ein plausibles 0,00).
- `StatementResponse.recurring: list[WiederkehrenderPosten]`.

**`service.py`**

- `_compute_summary` (Z. 1281–1434): `owner_payout` += Σ signierte
  wiederkehrende Posten; `pm_payout` bleibt `total_payout − owner_payout`
  (same_unit-Logik unverändert).
- `_snapshot_summary` (Z. 1707): die zwei neuen Spalten aus der Zeile lesen
  (Migration §3.2). JEDES Feld setzen — der Docstring dort erklärt warum.
- `_refresh_summary`, `finalize` (`_pruefe_bestaetigung` vergleicht den
  Betrag — er enthält jetzt die Posten; der Editor muss denselben Betrag
  anzeigen, sonst 409 bei jedem Finalisieren), `cancel` (Negation der neuen
  Spalten wie `expenses_to_owner`/`_from_owner`, 0348).
- `_to_response` liefert `recurring`.
- Storno (`kind='cancellation'`): `recurring` mit negierten Beträgen
  ausgeben, dieselbe Regel wie für `expenses`.

**`router.py`**: keine neuen Endpunkte. Bestehende Scopes bleiben
(`_fuer_owner_sichtbar`, Wurzel 9).

**`README.md`** des Slices: Abschnitte „Auszahlungsformel" und „Daten" um
Aufstellung, wiederkehrende Posten und die neuen Snapshot-Spalten ergänzen;
Verweis auf dieses Dokument.

### 3.2 Migration `0524_owner_statements_wiederkehrende_posten.sql`

```sql
alter table public.owner_statements
    add column if not exists recurring_to_owner   numeric not null default 0,
    add column if not exists recurring_from_owner numeric not null default 0;
comment on column … is 'Summe wiederkehrender Posten … (Snapshot, positiv). Im Storno negiert. 0524';
```

Muster 0348. Backfill: **keiner** — bestehende finalisierte Belege haben ohne
diese Posten gerechnet; ein Backfill schriebe eine andere Summe in eine
nummerierte Rechnung. Neue Nummer, weil 0348 angewendet ist
(Memory „Migration ändern wirkt nicht"). RLS/Grants der Tabelle bleiben;
`owner_statements` ist Finanztabelle — `revoke` gilt bereits über 0187/0337
(`0337_direktpfad_sensible_tabellen_schliessen.sql`); Gegenprobe mit
`scripts/security/direktpfad-pruefen.sh`. Einspielen NUR per
`supabase/apply-migrations.sh` nach Freigabe.

### 3.3 Frontend `web`

**`lib/owner-statements.ts`**: Typen spiegeln (`GebuehrZeile`,
`WiederkehrenderPosten`, `RentalRow`, `StatementSummary`, `Statement.recurring`).

**`lib/statement-pdf.ts`** — neu gliedern:

1. Kopf unverändert (Titel, Nr., Zeitraum, Parteien, Logo).
2. Tabelle „Buchungen" mit den Spalten aus §2.2; Spalten mit `null` in
   ALLEN Zeilen werden weggelassen (Muster `zeigtGastpreis`).
3. Je Buchung der Block aus §2.1 (bis 12 Buchungen inline, sonst Anhang).
4. Abschnitt „Abzüge und Gutschriften" (§2.7) — nur wenn Posten vorhanden.
5. Summenblock (§2.8), Betriebszeilen nur bei `pm_payout !== null`.
6. Fußnoten: Kurszeile bei Mehrwährung (bestehend), Hinweis zu
   `gebuehren_quelle='ota_ohne_aufstellung'` je betroffener Zeile (Text aus
   `rental.feeSource.*`), Vertragsstichtag-Erklärung.

Beschriftungen: das PDF ist heute deutsch, gebündelt in `txt`. **Umsetzung:**
alle neuen Texte in dieses eine Objekt; Übersetzung des PDFs ist ein eigener
Auftrag (§8) — hier nicht mischen. Keine Währungs-Hardcodes, `fmt`/
`fmtOderStrich` weiterverwenden.

**`components/owner-statements/statement-editor.tsx`**

- `RentalActivity`: neue Spalten; Zeile aufklappbar (`<details>` oder State)
  mit dem Block aus §2.1; „Pro Objekt"-Ansicht bekommt Σ Gebühren, Σ Provision.
- Neue `Section` „Abzüge & Gutschriften" mit den drei Quellen, Verlinkung auf
  die Pflegemasken (`/eigentuemer/[id]` Vertrag, `/eigentuemer/reporting/empfaenger/[id]`
  wiederkehrende Posten, Verrechnungsposten-Formular bestehend).
- Summenblock analog PDF. Der im Finalize-Dialog abgetippte Betrag muss der
  neue `owner_payout` sein (sonst 409, §3.1).
- Realtime: `owner_recurring_items` speist jetzt die Abrechnungsansicht. Die
  Tabelle ist per 0365 **bewusst** nicht in `supabase_realtime` und für
  `anon`/`authenticated` komplett entzogen (`revoke all`, Kommentarblock
  „Realtime-Folge, ausdrücklich festgehalten"). **Kein Grant öffnen, kein
  Abo darauf** — die Abrechnungsansicht hört heute ausschließlich auf
  `reservations` (`components/eigentuemer/owner-realtime.tsx` Z. 27; der
  Kommentar dort erklärt, warum `owner_statements` trotz Publikation 0071
  als gesperrte Finanztabelle kein tragfähiges Abo ist). Das bleibt so; der
  Grund steht als Kommentar am Abo. Eine Änderung an einem wiederkehrenden Posten wird beim
  nächsten `router.refresh()`/Vorschau-Laden sichtbar, nicht live — das im
  Code benennen. `bash scripts/realtime/abos-pruefen.sh` muss weiter Exit 0
  liefern.

**`components/eigentuemer/my-statements.tsx`, `components/portal/portal-berichte.tsx`**:
unverändert (nutzen `downloadStatementPdf`); Sichtprüfung als Eigentümer
Pflicht (§6).

**i18n**: neue Schlüssel unter `ownerStatements.rental.*`,
`ownerStatements.deductions.*`, `ownerStatements.summary.*` in `de.json`,
dann `python scripts/i18n/uebersetzen.py` für die 23 Sprachen;
`node scripts/i18n/pruefe-locales-vollstaendig.mjs web` und
`node scripts/i18n/deutsche-restwerte-pruefen.mjs`. Gebühren-Labels:
Feinarten kommen serverseitig als `GebuehrZeile.label` (aus `FEE_TYPE_LABEL`
bzw. `befund.bezeichnungen`) — genau wie `web/lib/pricing-meta.ts` die
Gebührenarten heute live über `GET /properties/fee-types` bezieht; kein
zweiter Katalog im Frontend. Kategorien-Labels bei Bedarf aus
`objects.taxableBaseCategory.*` (de.json Z. 6132–6139).

### 3.4 `owner_reporting`

- `_recurring_betraege` ruft `owner_statements.wiederkehrend.posten_betraege`.
- Keine Layout-Änderung an der Zahlung (5 Abschnitte). Gate §6 stellt sicher,
  dass Zahlung und Abrechnung für denselben Eigentümer/Zeitraum/Währung
  denselben Betrag ergeben.

### 3.5 `public_portal`

Rechnet dieselbe Kette (`_auszahlung_einer_buchung`, Z. 1020). Durch die
Erweiterung von `Auszahlung` um Felder **ohne Rechenwirkung** ändert sich dort
nichts; `pytest src/features/public_portal -q` muss grün bleiben.

### 3.6 Doku

- `docs/EIGENTUEMER-PREIS-KETTE.md`: Abschnitt „Was der Beleg zeigt" mit dem
  Block aus §2.1 und den drei Abzugsquellen.
- `docs/ARCHITECTURE.md` Z. 870 ff. (Eigentümer-Abrechnung): Spalten 0524,
  `owner_recurring_items` als Quelle der Abrechnung, `zeilen.py`/`wiederkehrend.py`.
- `apps/api/src/features/owner_statements/README.md` (siehe 3.1).

---

## 4. Reihenfolge der Umsetzung

1. **Backend-Kette** (`common.py`, `wiederkehrend.py`) + Tests → grün, ohne
   Zahlenänderung in `test_abrechnungszeile.py`.
2. **Mixin-Auszug** `zeilen.py` (reiner Umzug, Tests grün, pylint 10/10).
3. **Neue Felder** `RentalRow`/`Summary`/`Response` + `_rental_rows`,
   `_wiederkehrende_posten`, `_compute_summary`, Snapshot, Storno.
4. **Migration 0524** schreiben; Live-Einspielen erst nach Freigabe.
5. **TS-Typen + Editor** (Tabelle, Block, Abzüge-Sektion, Summen).
6. **PDF** neu gliedern; Vorschau im Editor UND als Eigentümer prüfen.
7. **i18n** (Gemini), Gates, Doku.
8. Live-Beweis (§6), dann Bericht an den Auftraggeber — **kein Commit**.

---

## 5. Tests

**Backend (`uv run pytest src/features/owner_statements -q`, heute 130 Tests)**

- `test_abrechnungszeile.py`: alle bestehenden Zahlen unverändert; neu:
  `a.gebuehren` enthält genau die übergebene Reinigung;
  `min_provision_angewandt` True/False je Fall.
- **Kontrollsummen (§2.0)**, je RentalRow: Σ `gebuehren[].betrag` nach
  Zugehörigkeit == `gebuehren_betrieb` / `gebuehren_an_eigentuemer` /
  `gebuehren_durchlauf`; Σ Zusatzleistungs-Zeilen == das `addon_total`, mit
  dem die Kette gerechnet hat. Eine Buchung mit drei Booking-Gebühren
  (Reinigung, Resort, Nebenkosten) + zwei Zusatzleistungen (qty 2 × 95, qty
  1 × 40) ergibt fünf Posten mit Namen, Menge und Einzelpreis — keine
  Sammelzeile in der Antwort.
- Zusatzleistung mit `status='cancelled'` erscheint NICHT; `name` ohne
  Belegsprache nimmt den ersten vorhandenen Wert; leeres `name` → Label leer
  - Log `abrechnung_addon_ohne_namen`, kein erfundener Text.
- `tests/test_wiederkehrend.py` (neu, DB-frei): je_buchung × 3 Buchungen,
  je_nacht × 17 Nächte, je_zeitraum = 1, `property_id`-Filter, fremde
  Währung → Fehler mit Postenname, Betrag 0 → keine Zeile.
- `test_owner_statements.py` (Fake-DB `_DB`): Tabelle `owner_recurring_items`
  in den Fake aufnehmen; Preview mit 1 Abzug (50) + 1 Gutschrift (200) →
  `summary.owner_payout` = Σ Anteile + 150; `recurring_from_owner == 50`,
  `recurring_to_owner == 200`; Finalize mit altem Betrag → 409; Storno negiert
  beide Spalten; Eigentümer-Maske: `gebuehren[].betrag` für `gehoert_zu='betrieb'`
  ist `None`, für `'eigentuemer'` gesetzt; `check_in`/`check_out`/`ota_name`
  vorhanden; **Zeitzonen**: `TZ=UTC` und `TZ=Europe/Copenhagen` (Memory
  „Tests nie zeitzonenabhängig").
- Die Betriebszeile aus dem Test-Kopfkommentar (Stjerneskud, 3.135,10 DKK)
  **ohne Handkorrektur**: `owner_recurring_items` mit „Kaffee&Co" (ausgaben,
  je_buchung, 50) und „NK-Pauschale" (andere, je_buchung, 200) → Summary trifft
  3.135,10. Damit wird der Docstring „bis dahin von Hand ergänzt" eingelöst.
- `owner_reporting`: bestehende Tests grün nach Umstellung auf `wiederkehrend`.
- `public_portal`: grün.

**Frontend**

- `tsc --noEmit` in `web`; `bun run lint` in `web` (0 Errors, keine neue
  Warnung).
- Kein Unit-Test-Rahmen für `statement-pdf.ts` vorhanden → Sichtprüfung §6.

**Voller `pytest` EINMAL vor der Abnahme**, nie wiederholt, nie im Hintergrund
(CLAUDE.md Qualitätsgate).

---

## 6. Live-Beweis (Pflicht vor „fertig")

Server-DB per SSH (`root@65.21.144.136`), nur lesend:

1. Die Screenshot-Abrechnung (Eigentümerin Ana L. K., Feriehus „Perlen",
   31.08.–29.09.2026, Buchung Christian P., 5 Nächte, Booking) als
   `POST /preview` abrufen: Block aus §2.1 muss jeden Zwischenwert tragen und
   `netto` = 3.490,35 DKK bleiben (die Zahl ist durch die Umstellung NICHT zu
   ändern, nur zu erklären).
2. Dieselbe Abrechnung als **Eigentümer** laden (`/meine-abrechnungen`, PDF):
   keine Gastpreis-, Portal-, Bemessungs-, Betriebsgebühren-, Verwaltungszeile —
   auch nicht als „—".
3. `owner_reporting`: Zahlung für denselben Eigentümer/Zeitraum/Währung
   erzeugen (Vorschau, nicht speichern) → `betrag` == `summary.owner_payout`.
4. Beleg im Browser prüfen — über den Chrome-Debug-Port
   (`node scripts/diagnose/chrome-lesen.mjs`, eigenes Profil, eigener Tab),
   **nie Playwright, nie AppleScript** (CLAUDE.md). PDF-Vorschau öffnen,
   Seitenumbruch bei > 12 Buchungen an einer Abrechnung mit vielen Buchungen
   prüfen (Demo-Tenant Nordlicht/Seeblick, nie löschen).
5. `bash scripts/realtime/abos-pruefen.sh` → Exit 0.
6. Wurzel-6-Gegenprobe: `owner_recurring_items` per anon-Key `curl` gegen
   `/rest/v1/owner_recurring_items` → 401/leer (lesen UND schreiben).

---

## 7. Entscheidungen — Standard gilt, wenn keine Antwort kommt

| #   | Frage                                                                                           | Standard                                                                                                                                                                                                                                                                                   |
| --- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A   | Sieht der **Eigentümer** die Gebühren des **Betriebs** (Reinigung) mit Betrag?                  | **Nein.** Sie sind Betriebsertrag und Teil des Gastpreises (§4.2). Er sieht die Zeile mit Label und Zuordnung („Reinigung · verbleibt beim Betrieb"), ohne Betrag. Grund: der Eigentümer soll wissen, DASS eine Reinigung berechnet wurde, aber der Betrag ist Verkaufspreis des Betriebs. |
| B   | Block je Buchung im PDF immer?                                                                  | **Entschieden vom Auftraggeber (02.09.2026): immer**, jede Gebühr als eigener Posten, kein Schwellwert, keine Sammelzeile (§2.0).                                                                                                                                                          |
| C   | Wiederkehrende Posten mit `abschnitt='unterkunftspreis'`/`'gebuehren'` — als Gutschrift zeigen? | Ja, Vorzeichen positiv wie in `owner_reporting` (nur `ausgaben` ist negativ, DB-CHECK 0365). Label-Gruppe „Gutschriften".                                                                                                                                                                  |
| D   | Soll die Migration 0524 alte finalisierte Belege berühren?                                      | **Nein**, kein Backfill (§3.2).                                                                                                                                                                                                                                                            |
| E   | PDF-Übersetzung mitmachen?                                                                      | **Nein**, eigener Auftrag (§8); Texte aber schon in `txt` bündeln.                                                                                                                                                                                                                         |

---

## 8. Nicht in diesem Auftrag — aber sichtbar geworden

1. **Zeilen-Snapshot beim Finalisieren** (§1.5): eine `RE-`-Rechnung darf
   ihre Zeilen nicht live neu rechnen. Lösung: `owner_statement_lines`-Tabelle
   oder JSONB-Snapshot der `rental_rows`/`recurring`/`expenses` bei `finalize`;
   `get` liest bei `finalized`/`cancelled` den Snapshot. GoBD-relevant.
2. **PDF in der Sprache des Eigentümers** (`owners.language` prüfen; heute
   ausschließlich deutsch).
3. **Versand** der Abrechnung (Mail/PDF) — existiert nicht; README-Grenze
   „Was der Eigentümer sieht" gilt nur ohne Versand.
4. Portal-Provision im Screenshot (849,38 auf 6.262,50 = 13,56 %) passt zu
   keinem Satz aus `portal_abzugssaetze` (Booking 15 % + 1,5 %). Vermutlich
   gemeldeter Betrag (`ota_commission`) — beim Live-Beweis (§6.1) klären,
   nicht in diesem Plan bewerten.

---

## 9. Regeln für die Umsetzung (Kurzfassung aus CLAUDE.md und Memory)

- Kein Commit, kein Push, kein Deploy ohne wörtliche Ansage. Kein `next build`
  lokal. Kein Playwright. Tests nur auf dem berührten Slice; voller Lauf einmal.
- Wurzel 4: kein `|| 0`, kein `"EUR"`, kein Default an neuen Summary-Feldern.
  Fehlende Zuordnung/Vertrag/Satz → `PayoutUnbekannt` mit Grund, Zeile bleibt
  mit dem, was feststeht.
- Wurzel 1: Rechenlogik `_recurring_betraege` **verschieben**, nicht kopieren;
  alle Aufrufer über den Graphen (`get_neighbors`) finden.
- Wurzel 3/6/9: keine neuen Endpunkte; Maske serverseitig; kein Grant auf
  Finanztabellen für Realtime.
- Wurzel 5b: An-/Abreise sind Gastdaten (`date`), nie `created_at`.
- Debugging einbauen: neue Log-Ereignisse `abrechnung_wiederkehrend_posten`
  (Anzahl, Summe, Währung) und `abrechnung_zeile_gebuehren` (Anzahl Zeilen je
  Buchung, Quelle) mit `tenant_id`/`statement_id`.
- Pylint 10/10 auf jedem geänderten Modul, ruff sauber, `tsc` + ESLint in
  `web`, i18n-Gates, Realtime-Gate.
- Doku aktualisieren (§3.6), keine Tool-/KI-Attribution.
