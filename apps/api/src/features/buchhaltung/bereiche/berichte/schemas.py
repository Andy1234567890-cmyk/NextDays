"""Schemas des Bereichs »berichte« (Auswertungen aus dem Bestand).

Berichte SCHREIBEN nichts — sie rechnen aus `invoices`, `expenses`,
`booking_accounts`, `reservations`/`properties` und `customers`. camelCase nach
außen (`alias_generator=to_camel`), Decimal innen: jede Summe entsteht
serverseitig aus den Belegzeilen, nie aus einem Client-Wert.

Währung: EINE Berichtswährung (die des Mandanten). Belege in anderer Währung
werden je Währung getrennt gezählt (`Fremdwaehrung`) und NIE in die Summen
gemischt (Wurzel 4) — eine PLN-Rechnung in einer DKK-Summe ist eine Falschzahl,
die niemand sieht.
"""

from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

# Harte Obergrenze eines Zeitraums (Wurzel 8): ein Jahr plus Schalttag.
MAX_TAGE = 366

Gruppierung = Literal["month", "quarter", "year"]
Aufschluesselung = Literal["customer", "property", "channel"]
Berichtsart = Literal["overview", "revenue", "bwa", "susa", "guv", "open-items"]
BwaGruppe = Literal["material", "personal", "raum", "sonstige"]
BWA_GRUPPEN: tuple[BwaGruppe, ...] = ("material", "personal", "raum", "sonstige")
Bucket = Literal["nicht_faellig", "0-30", "31-60", "61-90", ">90", "ohne_faelligkeit"]
BUCKETS: tuple[Bucket, ...] = ("nicht_faellig", "0-30", "31-60", "61-90", ">90", "ohne_faelligkeit")


class _Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Zeitraum(_Camel):
    """Der geprüfte Zeitraum eines Berichts — beide Grenzen einschließlich."""

    von: date
    bis: date
    tage: int


class Fremdwaehrung(_Camel):
    """Belege, die NICHT in der Berichtswährung lauten: getrennt ausgewiesen."""

    currency: str
    anzahl: int
    netto: Decimal
    brutto: Decimal


class TopKunde(_Camel):
    customer_id: str | None
    name: str
    anzahl: int
    netto: Decimal
    brutto: Decimal


class OverviewResponse(_Camel):
    zeitraum: Zeitraum
    currency: str
    umsatz_netto: Decimal
    umsatz_brutto: Decimal
    offene_forderungen: Decimal
    ueberfaellig: Decimal
    ueberfaellig_anzahl: int
    ausgaben_netto: Decimal
    ausgaben_brutto: Decimal
    ergebnis: Decimal
    anzahl_belege: int
    anzahl_storni: int
    anzahl_ausgaben: int
    top_kunden: list[TopKunde]
    fremdwaehrungen: list[Fremdwaehrung]
    # Ausgaben sind ein Nachbarbereich (Migration 0655). Fehlt die Tabelle noch,
    # steht hier `false` und die Oberfläche sagt es — statt „0 Ausgaben" zu
    # behaupten (Wurzel 4).
    ausgaben_verfuegbar: bool


class ZeitpunktWert(_Camel):
    periode: str
    netto: Decimal
    brutto: Decimal
    anzahl: int


class Zeitreihe(_Camel):
    key: str
    label: str
    punkte: list[ZeitpunktWert]
    summe_netto: Decimal
    summe_brutto: Decimal


class RevenueResponse(_Camel):
    zeitraum: Zeitraum
    currency: str
    gruppierung: Gruppierung
    aufschluesselung: Aufschluesselung | None
    perioden: list[str]
    reihen: list[Zeitreihe]
    fremdwaehrungen: list[Fremdwaehrung]


class BwaZeile(_Camel):
    key: str
    label: str
    aktuell: Decimal
    vergleich: Decimal
    veraenderung_prozent: Decimal | None
    prozent_vom_umsatz: Decimal | None


class BwaResponse(_Camel):
    zeitraum: Zeitraum
    vergleichszeitraum: Zeitraum
    currency: str
    erloese: BwaZeile
    aufwand: list[BwaZeile]
    aufwand_gesamt: BwaZeile
    ergebnis: BwaZeile
    fremdwaehrungen: list[Fremdwaehrung]
    ausgaben_verfuegbar: bool
    konten_verfuegbar: bool


class SusaZeile(_Camel):
    account_id: str | None
    nummer: str | None
    name: str
    typ: str | None
    soll: Decimal
    haben: Decimal
    saldo: Decimal
    anzahl: int


class SusaResponse(_Camel):
    zeitraum: Zeitraum
    currency: str
    zeilen: list[SusaZeile]
    summe_soll: Decimal
    summe_haben: Decimal
    saldo: Decimal
    fremdwaehrungen: list[Fremdwaehrung]
    ausgaben_verfuegbar: bool
    konten_verfuegbar: bool


class GuvMonat(_Camel):
    monat: str
    erloese: Decimal
    aufwand: Decimal
    ergebnis: Decimal


class GuvResponse(_Camel):
    jahr: int
    zeitraum: Zeitraum
    currency: str
    erloese_netto: Decimal
    aufwand: list[BwaZeile]
    aufwand_gesamt: Decimal
    ergebnis: Decimal
    monate: list[GuvMonat]
    fremdwaehrungen: list[Fremdwaehrung]
    ausgaben_verfuegbar: bool


class OffenerPosten(_Camel):
    invoice_id: str
    invoice_number: str | None
    customer_id: str | None
    customer_name: str | None
    issue_date: date | None
    due_date: date | None
    alter_tage: int | None
    bucket: Bucket
    gross_amount: Decimal
    paid_amount: Decimal
    offen: Decimal
    currency: str
    status: str


class BucketSumme(_Camel):
    bucket: Bucket
    anzahl: int
    offen: Decimal


class OpenItemsResponse(_Camel):
    stichtag: date
    currency: str
    posten: list[OffenerPosten]
    buckets: list[BucketSumme]
    summe_offen: Decimal
    anzahl: int
    fremdwaehrungen: list[Fremdwaehrung]
