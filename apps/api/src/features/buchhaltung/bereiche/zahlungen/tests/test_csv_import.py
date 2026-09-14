"""CSV-Parser: Beträge, Daten, Trennzeichen, Binär-Abweisung, Hash-Stabilität."""

from datetime import date
from decimal import Decimal

import pytest

from .. import csv_import
from ..schemas import CsvMapping


@pytest.mark.parametrize(
    ("roh", "erwartet"),
    [
        ("1.234,56", Decimal("1234.56")),
        ("1,234.56", Decimal("1234.56")),
        ("-12,00", Decimal("-12.00")),
        ("12,00-", Decimal("-12.00")),
        ("12,00 S", Decimal("-12.00")),
        ("12,00 H", Decimal("12.00")),
        ("€ 99,90", Decimal("99.90")),
        ("(5.00)", Decimal("-5.00")),
        ("1234", Decimal("1234.00")),
    ],
)
def test_betrag_lesen(roh: str, erwartet: Decimal) -> None:
    assert csv_import.betrag_lesen(roh, "auto") == erwartet


def test_betrag_unlesbar() -> None:
    with pytest.raises(csv_import.CsvFehler):
        csv_import.betrag_lesen("abc", "auto")


@pytest.mark.parametrize(
    ("roh", "erwartet"),
    [
        ("12.09.2026", date(2026, 9, 12)),
        ("2026-09-12", date(2026, 9, 12)),
        ("12/09/2026", date(2026, 9, 12)),
        ("12.09.26", date(2026, 9, 12)),
    ],
)
def test_datum_lesen(roh: str, erwartet: date) -> None:
    assert csv_import.datum_lesen(roh, None) == erwartet


def test_datum_explizites_format() -> None:
    assert csv_import.datum_lesen("09-12-2026", "%m-%d-%Y") == date(2026, 9, 12)


def test_binaer_wird_abgewiesen() -> None:
    with pytest.raises(csv_import.CsvFehler) as exc:
        csv_import.bytes_pruefen(b"%PDF-1.7 ...")
    assert exc.value.status_code == 422
    with pytest.raises(csv_import.CsvFehler):
        csv_import.bytes_pruefen(b"a;b\x00c")


def test_groesse_cap() -> None:
    with pytest.raises(csv_import.CsvFehler) as exc:
        csv_import.bytes_pruefen(b"x" * (csv_import.MAX_CSV_BYTES + 1))
    assert exc.value.status_code == 413


def test_datei_lesen_semikolon_cp1252() -> None:
    inhalt = "Buchungstag;Betrag;Verwendungszweck;Begünstigter\n12.09.2026;-12,50;Gebühr;Bank\n"
    datei = csv_import.datei_lesen(
        inhalt.encode("cp1252"), delimiter=None, has_header=True, encoding="auto"
    )
    assert datei.delimiter == ";"
    assert datei.encoding == "cp1252"
    assert datei.header[0] == "Buchungstag"
    assert datei.rows == [["12.09.2026", "-12,50", "Gebühr", "Bank"]]
    mapping = csv_import.mapping_raten(datei.header)
    assert mapping is not None
    assert (mapping.date, mapping.amount, mapping.purpose, mapping.name) == (0, 1, 2, 3)


def test_soll_haben_getrennt() -> None:
    mapping = CsvMapping(date=0, debit=1, credit=2)
    z = csv_import.zeile_lesen(
        ["01.09.2026", "", "250,00"], mapping, date_format=None, decimal_separator="auto"
    )
    assert z.amount == Decimal("250.00")
    z = csv_import.zeile_lesen(
        ["01.09.2026", "40,00", ""], mapping, date_format=None, decimal_separator="auto"
    )
    assert z.amount == Decimal("-40.00")


def test_hash_stabil_und_normalisiert() -> None:
    a = csv_import.import_hash(
        "k1", date(2026, 9, 1), Decimal("10.5"), "dkk", "  Otto ", "Miete", None
    )
    b = csv_import.import_hash(
        "k1", date(2026, 9, 1), Decimal("10.50"), "DKK", "otto", " miete ", ""
    )
    assert a == b
    c = csv_import.import_hash("k1", date(2026, 9, 1), Decimal("10.51"), "DKK", "otto", "miete", "")
    assert a != c
