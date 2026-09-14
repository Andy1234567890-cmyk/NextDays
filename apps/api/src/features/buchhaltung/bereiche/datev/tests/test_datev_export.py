"""Tests des Bereichs »datev«: EXTF-Format byteweise, Regeln des Exports.

Fake-DB im Stil von `../../../tests/test_kunden_anlegen.py`: filtert auf
`eq`/`in_`/`gte`/`lte`, zählt Inserts/Uploads — damit Idempotenz beweisbar ist
(zweiter Aufruf: kein zweiter Insert, kein zweiter Upload).
"""

from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal
from types import SimpleNamespace

import pytest
from postgrest.exceptions import APIError

from src.core.security import AuthContext
from src.features.buchhaltung.bereiche.datev import extf
from src.features.buchhaltung.bereiche.datev.schemas import DatevSettingsUpdate, ExportAnfrage
from src.features.buchhaltung.bereiche.datev.service import DatevError, DatevService

TENANT = "t1"
CTX = AuthContext(user_id="u1", tenant_id=TENANT, role="admin")
JETZT = datetime(2026, 9, 12, 10, 30, 45, 123000, tzinfo=UTC)


# --- Fake-DB -----------------------------------------------------------------


class _Chain:
    def __init__(self, table: _Table) -> None:
        self._t = table
        self._filter: list[tuple[str, str, object]] = []
        self._op: str | None = None
        self._payload: object = None

    def select(self, *_a: object, **_k: object) -> _Chain:
        return self

    def limit(self, *_a: object, **_k: object) -> _Chain:
        return self

    def order(self, *_a: object, **_k: object) -> _Chain:
        return self

    def eq(self, feld: str, wert: object) -> _Chain:
        self._filter.append(("eq", feld, wert))
        return self

    def in_(self, feld: str, werte: list) -> _Chain:
        self._filter.append(("in", feld, werte))
        return self

    def gte(self, feld: str, wert: object) -> _Chain:
        self._filter.append(("gte", feld, wert))
        return self

    def lte(self, feld: str, wert: object) -> _Chain:
        self._filter.append(("lte", feld, wert))
        return self

    def insert(self, payload: dict) -> _Chain:
        self._op, self._payload = "insert", payload
        return self

    def upsert(self, payload: dict, **_k: object) -> _Chain:
        self._op, self._payload = "upsert", payload
        return self

    def _passt(self, row: dict) -> bool:
        for op, feld, wert in self._filter:
            ist = row.get(feld)
            if op == "eq" and str(ist) != str(wert):
                return False
            if op == "in" and str(ist) not in {str(w) for w in wert}:
                return False
            if op == "gte" and str(ist) < str(wert):
                return False
            if op == "lte" and str(ist) > str(wert):
                return False
        return True

    def execute(self) -> SimpleNamespace:
        if self._t.fehlt:
            raise APIError({"code": "42P01", "message": "relation does not exist"})
        if self._op == "insert":
            assert isinstance(self._payload, dict)
            schluessel = tuple(self._payload.get(k) for k in self._t.unique)
            if self._t.unique and schluessel in self._t.unique_gesehen:
                raise APIError({"code": "23505", "message": "duplicate key"})
            self._t.unique_gesehen.add(schluessel)
            neu = {**self._payload, "id": f"{self._t.name}-{len(self._t.rows) + 1}"}
            neu.setdefault("created_at", JETZT.isoformat())
            neu.setdefault("updated_at", JETZT.isoformat())
            self._t.rows.append(neu)
            self._t.inserts.append(neu)
            return SimpleNamespace(data=[neu])
        if self._op == "upsert":
            assert isinstance(self._payload, dict)
            self._t.rows = [
                r for r in self._t.rows if r.get("tenant_id") != self._payload["tenant_id"]
            ]
            self._t.rows.append({**self._payload, "updated_at": JETZT.isoformat()})
            return SimpleNamespace(data=[self._payload])
        return SimpleNamespace(data=[r for r in self._t.rows if self._passt(r)])


class _Table:
    def __init__(self, name: str, rows: list[dict], *, unique: tuple[str, ...] = ()) -> None:
        self.name = name
        self.rows = rows
        self.inserts: list[dict] = []
        self.unique = unique
        self.unique_gesehen: set[tuple] = set()
        self.fehlt = False


class _Storage:
    def __init__(self) -> None:
        self.uploads: list[tuple[str, bytes]] = []

    def from_(self, bucket: str) -> _Storage:
        assert bucket == "datev-exports"
        return self

    def upload(self, pfad: str, inhalt: bytes, _opts: dict) -> None:
        self.uploads.append((pfad, inhalt))

    def download(self, pfad: str) -> bytes:
        for p, inhalt in self.uploads:
            if p == pfad:
                return inhalt
        return b""


class _DB:
    def __init__(self, **tables: list[dict]) -> None:
        self.tables = {n: _Table(n, r) for n, r in tables.items()}
        self.tables["datev_exports"] = _Table(
            "datev_exports",
            [],
            unique=("tenant_id", "export_type", "date_from", "date_to", "content_hash"),
        )
        self.storage = _Storage()

    def table(self, name: str) -> _Chain:
        return _Chain(self.tables.setdefault(name, _Table(name, [])))


SETTINGS = {
    "tenant_id": TENANT,
    "berater_nummer": 12345,
    "mandanten_nummer": 678,
    "kontenrahmen": "SKR03",
    "sachkontenlaenge": 4,
    "wirtschaftsjahr_beginn_monat": 1,
    "standard_erloeskonto": "8400",
    "standard_aufwandskonto": "4900",
    "standard_finanzkonto": "1200",
    "debitor_konto_start": 10000,
    "kreditor_konto_start": 70000,
    "bu_schluessel_erloes": {"19.00": "", "7.00": "2", "0.00": ""},
    "bu_schluessel_aufwand": {"19.00": "9"},
    "finanzkonten": {"pa-1": "1800"},
    "festschreibung": True,
    "updated_at": JETZT.isoformat(),
}

KUNDEN = [
    {
        "id": "k1",
        "tenant_id": TENANT,
        "name": "Müller GmbH",
        "customer_number": "0007",
        "customer_type": "business",
        "is_supplier": False,
        "vat_id": "DE123456789",
        "email": "m@x.de",
        "phone": "",
        "address": {
            "street": "Weg",
            "house_number": "1",
            "postal_code": "12345",
            "city": "Ort",
            "country": "DE",
        },
    },
    {
        "id": "l1",
        "tenant_id": TENANT,
        "name": "Strom AG",
        "customer_number": "0042",
        "customer_type": "business",
        "is_supplier": True,
        "vat_id": None,
        "email": None,
        "phone": None,
        "address": {},
    },
]

RECHNUNG = {
    "id": "re-1",
    "tenant_id": TENANT,
    "invoice_number": "RE-2026-0001",
    "customer_id": "k1",
    "invoice_type": "invoice",
    "status": "sent",
    "issue_date": "2026-03-05",
    "due_date": "2026-03-19",
    "gross_amount": "1190.00",
    "tax_amount": "190.00",
    "tax_rate": "19",
    "currency": "EUR",
    "is_locked": True,
    "deleted_at": None,
}


def _svc(**tables: list[dict]) -> tuple[DatevService, _DB]:
    tables.setdefault("tenants", [{"id": TENANT, "currency": "EUR"}])
    tables.setdefault("datev_settings", [dict(SETTINGS)])
    tables.setdefault("customers", [dict(k) for k in KUNDEN])
    db = _DB(**tables)
    return DatevService(db, jetzt=lambda: JETZT), db  # type: ignore[arg-type]


def _anfrage(**kw: object) -> ExportAnfrage:
    basis: dict = {
        "date_from": date(2026, 1, 1),
        "date_to": date(2026, 12, 31),
        "belegarten": ["ausgangsrechnungen"],
    }
    basis.update(kw)
    return ExportAnfrage(**basis)


def _zeilen(inhalt: bytes) -> list[str]:
    text = inhalt.decode("cp1252")
    assert text.endswith("\r\n")
    return text.split("\r\n")[:-1]


# --- Format (extf) ------------------------------------------------------------


def _kopf() -> extf.Kopf:
    return extf.Kopf(
        berater_nummer=12345,
        mandanten_nummer=678,
        wirtschaftsjahr_beginn=date(2026, 1, 1),
        sachkontenlaenge=4,
        datum_von=date(2026, 1, 1),
        datum_bis=date(2026, 12, 31),
        bezeichnung="Stapel 01.01.2026-31.12.2026",
        waehrung="EUR",
        kontenrahmen="SKR03",
        festschreibung=True,
        erzeugt_am=JETZT,
        exportiert_von="myNextDays",
    )


def test_header_zeile_exakt() -> None:
    zeile = extf.header(_kopf(), kategorie=21, formatname="Buchungsstapel", formatversion=13)
    assert zeile == (
        '"EXTF";700;21;"Buchungsstapel";13;20260912103045123;;"MN";"myNextDays";"";'
        '12345;678;20260101;4;20260101;20261231;"Stapel 01.01.2026-31.12.2026";"";'
        '1;0;1;"EUR";;"";;;03;;;"";""\r\n'
    )
    assert zeile.count(";") == 30  # 31 Felder


def test_feldzeile_buchungsstapel_exakt() -> None:
    ergebnis = extf.buchungsstapel(_kopf(), [])
    zeilen = _zeilen(ergebnis.inhalt)
    assert len(zeilen) == 2
    assert zeilen[1].startswith(
        '"Umsatz (ohne Soll/Haben-Kz)";"Soll/Haben-Kennzeichen";"WKZ Umsatz";"Kurs";'
        '"Basis-Umsatz";"WKZ Basis-Umsatz";"Konto";"Gegenkonto (ohne BU-Schlüssel)";'
        '"BU-Schlüssel";"Belegdatum";"Belegfeld 1";"Belegfeld 2";"Skonto";"Buchungstext";'
    )
    assert zeilen[1].endswith('"EU-Steuersatz (Ursprung)";"Abw. Skontokonto"')
    assert zeilen[1].count(";") == 124  # 125 Felder


def test_datensatz_dezimalkomma_soll_haben_ttmm() -> None:
    b = extf.Buchung(
        umsatz=Decimal("1190.50"),
        soll_haben="S",
        waehrung="EUR",
        konto="10007",
        gegenkonto="8400",
        bu_schluessel="",
        belegdatum=date(2026, 3, 5),
        belegfeld1="RE-1",
        buchungstext="RE RE-1 Müller",
        faelligkeit=date(2026, 3, 19),
        festschreibung=True,
        guid="re-1",
    )
    zeile = _zeilen(extf.buchungsstapel(_kopf(), [b]).inhalt)[2]
    felder = zeile.split(";")
    assert len(felder) == 125
    assert felder[0] == "1190,50"
    assert felder[1] == '"S"'
    assert felder[2] == '"EUR"'
    assert felder[6] == "10007"
    assert felder[7] == "8400"
    assert felder[8] == '""'
    assert felder[9] == "0503"  # TTMM
    assert felder[10] == '"RE-1"'
    assert felder[13] == '"RE RE-1 Müller"'
    assert felder[113] == "1"  # Festschreibung
    assert felder[116] == "19032026"  # Fälligkeit TTMMJJJJ


def test_kodierung_windows_1252_und_ersatz_mit_warnung() -> None:
    b = extf.Buchung(
        umsatz=Decimal("1"),
        soll_haben="H",
        waehrung="EUR",
        konto="10007",
        gegenkonto="8400",
        bu_schluessel="",
        belegdatum=date(2026, 1, 1),
        belegfeld1="X",
        buchungstext="Müller Łódź " + "a" * 60,
    )
    ergebnis = extf.buchungsstapel(_kopf(), [b])
    assert b"M\xfcller" in ergebnis.inhalt  # ü als 0xFC, nicht UTF-8
    assert b"\xc5" not in ergebnis.inhalt  # kein UTF-8-Rest
    assert b"?\xf3d?" in ergebnis.inhalt  # Ł und ź ersetzt, ó bleibt
    assert any("nicht darstellbar" in w for w in ergebnis.warnungen)
    assert any("gekürzt" in w for w in ergebnis.warnungen)


def test_anfuehrungszeichen_im_text_verdoppelt() -> None:
    b = extf.Buchung(
        umsatz=Decimal("1"),
        soll_haben="S",
        waehrung="EUR",
        konto="1",
        gegenkonto="2",
        bu_schluessel="",
        belegdatum=date(2026, 1, 1),
        belegfeld1="X",
        buchungstext='Haus "Sonne"',
    )
    zeile = _zeilen(extf.buchungsstapel(_kopf(), [b]).inhalt)[2]
    assert '"Haus ""Sonne"""' in zeile


def test_hash_unabhaengig_vom_erzeugungszeitpunkt() -> None:
    b = extf.Buchung(
        umsatz=Decimal("1"),
        soll_haben="S",
        waehrung="EUR",
        konto="1",
        gegenkonto="2",
        bu_schluessel="",
        belegdatum=date(2026, 1, 1),
        belegfeld1="X",
        buchungstext="T",
    )
    k1 = _kopf()
    k2 = extf.Kopf(**{**k1.__dict__, "erzeugt_am": datetime(2030, 1, 1, tzinfo=UTC)})
    e1, e2 = extf.buchungsstapel(k1, [b]), extf.buchungsstapel(k2, [b])
    assert e1.content_hash == e2.content_hash
    assert e1.inhalt != e2.inhalt


def test_umsatz_null_verweigert() -> None:
    b = extf.Buchung(
        umsatz=Decimal("0"),
        soll_haben="S",
        waehrung="EUR",
        konto="1",
        gegenkonto="2",
        bu_schluessel="",
        belegdatum=date(2026, 1, 1),
        belegfeld1="X",
        buchungstext="T",
    )
    with pytest.raises(ValueError, match="Umsatz 0"):
        extf.buchungsstapel(_kopf(), [b])


def test_stammdaten_header_und_felder() -> None:
    p = extf.Personenkonto(
        konto="10007",
        name="Müller GmbH",
        ist_unternehmen=True,
        eu_land="DE",
        eu_ustid="123456789",
        strasse="Weg 1",
        plz="12345",
        ort="Ort",
        land="DE",
        email="m@x.de",
    )
    zeilen = _zeilen(extf.stammdaten(_kopf(), [p]).inhalt)
    assert zeilen[0].startswith('"EXTF";700;16;"Debitoren/Kreditoren";5;20260912103045123;;"MN"')
    # Stammdaten: Datum von/bis, Buchungstyp, Festschreibung, WKZ leer.
    assert ';12345;678;20260101;4;;;"Stapel 01.01.2026-31.12.2026";"";;;;"";' in zeilen[0]
    assert zeilen[1].startswith('"Konto";"Name (Adressattyp Unternehmen)"')
    assert zeilen[1].count(";") == 50
    felder = zeilen[2].split(";")
    assert felder[0] == "10007"
    assert felder[1] == '"Müller GmbH"'
    assert felder[6] == "2"
    assert felder[8] == '"DE"' and felder[9] == '"123456789"'
    assert felder[15] == '"Weg 1"' and felder[17] == '"12345"' and felder[18] == '"Ort"'


# --- Einstellungen ------------------------------------------------------------


def test_settings_fehlen_liefert_configured_false_mit_feldliste() -> None:
    svc, _ = _svc(datev_settings=[])
    antwort = svc.get_settings(CTX)
    assert antwort.configured is False
    assert "berater_nummer" in antwort.fehlende_felder
    assert len(antwort.fehlende_felder) == 13


def test_settings_put_normalisiert_steuersaetze() -> None:
    svc, db = _svc(datev_settings=[])
    body = DatevSettingsUpdate(
        beraterNummer=12345,
        mandantenNummer=1,
        kontenrahmen="SKR04",
        sachkontenlaenge=4,
        wirtschaftsjahrBeginnMonat=1,
        standardErloeskonto="4400",
        standardAufwandskonto="6300",
        standardFinanzkonto="1800",
        debitorKontoStart=10000,
        kreditorKontoStart=70000,
        buSchluesselErloes={"19": "3", "7,0": "2"},
        buSchluesselAufwand={"19.0": "9"},
        festschreibung=False,
    )
    antwort = svc.put_settings(CTX, body)
    assert antwort.configured is True
    assert antwort.bu_schluessel_erloes == {"19.00": "3", "7.00": "2"}
    assert db.tables["datev_settings"].rows[0]["tenant_id"] == TENANT


def test_settings_ungueltiger_bu_schluessel_422() -> None:
    with pytest.raises(ValueError, match="BU-Schlüssel"):
        DatevSettingsUpdate(
            beraterNummer=12345,
            mandantenNummer=1,
            kontenrahmen="SKR03",
            sachkontenlaenge=4,
            wirtschaftsjahrBeginnMonat=1,
            standardErloeskonto="8400",
            standardAufwandskonto="4900",
            standardFinanzkonto="1200",
            debitorKontoStart=10000,
            kreditorKontoStart=70000,
            buSchluesselErloes={"19": "ab"},
            buSchluesselAufwand={"19": "9"},
            festschreibung=True,
        )


# --- Export --------------------------------------------------------------------


def test_export_ohne_settings_422_mit_feldliste() -> None:
    svc, db = _svc(datev_settings=[], invoices=[dict(RECHNUNG)])
    with pytest.raises(DatevError) as exc:
        svc.export(CTX, _anfrage())
    assert exc.value.status_code == 422
    assert "kontenrahmen" in exc.value.details["fehlende_felder"]
    assert db.storage.uploads == []


def test_export_zeitraum_zu_lang_422() -> None:
    svc, _ = _svc()
    with pytest.raises(DatevError) as exc:
        svc.export(CTX, _anfrage(date_from=date(2025, 1, 1), date_to=date(2026, 1, 2)))
    assert exc.value.status_code == 422
    assert "366" in exc.value.message


def test_export_ohne_belegart_422() -> None:
    svc, _ = _svc()
    with pytest.raises(DatevError) as exc:
        svc.export(CTX, _anfrage(belegarten=[]))
    assert exc.value.status_code == 422


def test_export_rechnung_debitor_soll_erloes_bu_aus_mapping() -> None:
    svc, db = _svc(
        invoices=[dict(RECHNUNG)],
        invoice_line_items=[
            {"invoice_id": "re-1", "tax_rate": "19", "gross_amount": "1000.00"},
            {"invoice_id": "re-1", "tax_rate": "7", "gross_amount": "190.00"},
        ],
    )
    antwort = svc.export(CTX, _anfrage())
    assert antwort.anzahl == 2  # zwei Steuersatz-Gruppen
    assert antwort.wiederverwendet is False
    assert antwort.dateiname.startswith("EXTF_Buchungsstapel_20260101_20261231_")
    pfad, inhalt = db.storage.uploads[0]
    assert pfad == f"{TENANT}/buchungsstapel/{antwort.content_hash}.csv"
    zeilen = _zeilen(inhalt)
    daten = [z.split(";") for z in zeilen[2:]]
    # 19 %: Automatikkonto → BU leer; 7 %: BU 2 aus der Map.
    assert {(d[0], d[1], d[6], d[7], d[8]) for d in daten} == {
        ("1000,00", '"S"', "10007", "8400", '""'),
        ("190,00", '"S"', "10007", "8400", '"2"'),
    }
    assert all(d[9] == "0503" and d[10] == '"RE-2026-0001"' for d in daten)
    assert all(d[113] == "1" for d in daten)  # is_locked → Festschreibung
    assert db.tables["datev_exports"].inserts[0]["kontenrahmen"] == "SKR03"


def test_export_fehlender_bu_schluessel_422_mit_problemliste() -> None:
    rechnung = {**RECHNUNG, "tax_rate": "25"}
    svc, db = _svc(invoices=[rechnung])
    with pytest.raises(DatevError) as exc:
        svc.export(CTX, _anfrage())
    assert exc.value.status_code == 422
    assert any("25.00 %" in p for p in exc.value.details["probleme"])
    assert db.storage.uploads == []


def test_export_fremdwaehrung_ohne_kurs_422() -> None:
    svc, _ = _svc(invoices=[{**RECHNUNG, "currency": "DKK"}])
    with pytest.raises(DatevError) as exc:
        svc.export(CTX, _anfrage())
    assert "DKK" in exc.value.details["probleme"][0]


def test_export_kunde_ohne_nummer_422() -> None:
    kunden = [{**KUNDEN[0], "customer_number": "K-A"}]
    svc, _ = _svc(invoices=[dict(RECHNUNG)], customers=kunden)
    with pytest.raises(DatevError) as exc:
        svc.export(CTX, _anfrage())
    assert "numerische Kundennummer" in exc.value.details["probleme"][0]


def test_export_entwurf_und_geloescht_bleiben_draussen() -> None:
    svc, _ = _svc(
        invoices=[
            {**RECHNUNG, "id": "d", "status": "draft"},
            {**RECHNUNG, "id": "g", "deleted_at": "2026-05-01T00:00:00Z"},
        ]
    )
    with pytest.raises(DatevError, match="nichts zu exportieren"):
        svc.export(CTX, _anfrage())


def test_export_gutschrift_haben_und_zahlung_auf_finanzkonto() -> None:
    gs = {
        **RECHNUNG,
        "id": "gs-1",
        "invoice_number": "GS-1",
        "invoice_type": "credit_note",
        "gross_amount": "119.00",
        "is_locked": False,
    }
    svc, db = _svc(
        invoices=[dict(RECHNUNG), gs],
        invoice_payments=[
            {
                "id": "z1",
                "tenant_id": TENANT,
                "invoice_id": "re-1",
                "date": "2026-03-20",
                "amount": "1190.00",
                "currency": "EUR",
                "payment_account_id": "pa-1",
            },
            {
                "id": "z2",
                "tenant_id": TENANT,
                "invoice_id": "re-1",
                "date": "2026-04-01",
                "amount": "-50.00",
                "currency": "EUR",
                "payment_account_id": None,
            },
        ],
    )
    antwort = svc.export(CTX, _anfrage(belegarten=["gutschriften", "zahlungen"]))
    assert antwort.anzahl == 3
    daten = [z.split(";") for z in _zeilen(db.storage.uploads[0][1])[2:]]
    assert ("119,00", '"H"', "10007", "8400", '"GS-1"') in {
        (d[0], d[1], d[6], d[7], d[10]) for d in daten
    }
    # Zahlung: Debitor im Haben, Gegenkonto aus finanzkonten-Map (pa-1 → 1800).
    assert ("1190,00", '"H"', "10007", "1800") in {(d[0], d[1], d[6], d[7]) for d in daten}
    # Rückzahlung: negativ → Soll, Standard-Finanzkonto.
    assert ("50,00", '"S"', "10007", "1200") in {(d[0], d[1], d[6], d[7]) for d in daten}
    assert daten[0][113] == "0"  # Gutschrift nicht festgeschrieben


def test_export_ausgabe_kreditor_haben_aufwand_bu() -> None:
    svc, db = _svc(
        expenses=[
            {
                "id": "a1",
                "tenant_id": TENANT,
                "supplier_id": "l1",
                "supplier_name": None,
                "receipt_number": "ER-77",
                "title": "Strom",
                "expense_date": "2026-02-10",
                "due_date": None,
                "gross_amount": "238.00",
                "tax_rate": "19",
                "currency": "EUR",
                "booking_account": "4240",
                "payment_status": "open",
                "is_locked": False,
            }
        ],
        booking_accounts=[
            {"tenant_id": TENANT, "number": "4240", "active": True},
            {"tenant_id": TENANT, "number": "8400", "active": True},
            {"tenant_id": TENANT, "number": "4900", "active": True},
            {"tenant_id": TENANT, "number": "1200", "active": True},
        ],
    )
    antwort = svc.export(CTX, _anfrage(belegarten=["ausgaben"]))
    assert antwort.anzahl == 1
    d = _zeilen(db.storage.uploads[0][1])[2].split(";")
    assert (d[0], d[1], d[6], d[7], d[8], d[9], d[10]) == (
        "238,00",
        '"H"',
        "70042",
        "4240",
        '"9"',
        "1002",
        '"ER-77"',
    )


def test_export_aufwandskonto_nicht_im_kontenplan_422() -> None:
    svc, _ = _svc(
        expenses=[
            {
                "id": "a1",
                "tenant_id": TENANT,
                "supplier_id": "l1",
                "receipt_number": "ER-1",
                "title": "x",
                "expense_date": "2026-02-10",
                "gross_amount": "10.00",
                "tax_rate": "19",
                "currency": "EUR",
                "booking_account": "9999",
                "payment_status": "open",
            }
        ],
        booking_accounts=[
            {"tenant_id": TENANT, "number": "8400", "active": True},
            {"tenant_id": TENANT, "number": "4900", "active": True},
            {"tenant_id": TENANT, "number": "1200", "active": True},
        ],
    )
    with pytest.raises(DatevError) as exc:
        svc.export(CTX, _anfrage(belegarten=["ausgaben"]))
    assert "9999" in exc.value.details["probleme"][0]


def test_export_tabelle_fehlt_422_statt_500() -> None:
    svc, db = _svc(invoices=[dict(RECHNUNG)])
    db.tables.setdefault("expenses", _Table("expenses", [])).fehlt = True
    with pytest.raises(DatevError) as exc:
        svc.export(CTX, _anfrage(belegarten=["ausgaben"]))
    assert exc.value.status_code == 422
    assert "expenses" in exc.value.message


def test_export_idempotent_gleicher_inhalt_gleicher_lauf() -> None:
    svc, db = _svc(invoices=[dict(RECHNUNG)])
    erster = svc.export(CTX, _anfrage())
    zweiter = svc.export(CTX, _anfrage())
    assert zweiter.id == erster.id
    assert zweiter.wiederverwendet is True
    assert len(db.tables["datev_exports"].inserts) == 1
    assert len(db.storage.uploads) == 1


def test_export_rennen_23505_liefert_bestehenden_lauf() -> None:
    svc, db = _svc(invoices=[dict(RECHNUNG)])
    erster = svc.export(CTX, _anfrage())
    # Der Lauf ist "nicht sichtbar" für die Vorprüfung, der Unique-Index fängt ihn.
    verborgen = db.tables["datev_exports"].rows
    db.tables["datev_exports"].rows = []
    original = _Chain.execute

    def _execute(self: _Chain) -> SimpleNamespace:
        if self._op == "insert":
            db.tables["datev_exports"].rows = verborgen
        return original(self)

    _Chain.execute = _execute  # type: ignore[method-assign]
    try:
        zweiter = svc.export(CTX, _anfrage())
    finally:
        _Chain.execute = original  # type: ignore[method-assign]
    assert zweiter.id == erster.id and zweiter.wiederverwendet is True


def test_export_neuer_inhalt_neuer_lauf() -> None:
    svc, db = _svc(invoices=[dict(RECHNUNG)])
    erster = svc.export(CTX, _anfrage())
    db.tables["invoices"].rows.append({**RECHNUNG, "id": "re-2", "invoice_number": "RE-2026-0002"})
    zweiter = svc.export(CTX, _anfrage())
    assert zweiter.id != erster.id and zweiter.anzahl == 2
    assert len(db.storage.uploads) == 2


def test_export_wirtschaftsjahr_beginn_vor_zeitraum() -> None:
    svc, db = _svc(
        invoices=[dict(RECHNUNG)], datev_settings=[{**SETTINGS, "wirtschaftsjahr_beginn_monat": 7}]
    )
    svc.export(CTX, _anfrage(date_from=date(2026, 3, 1), date_to=date(2026, 3, 31)))
    kopf = _zeilen(db.storage.uploads[0][1])[0].split(";")
    assert kopf[12] == "20250701"  # März 2026 liegt im WJ ab Juli 2025


def test_stammdaten_export() -> None:
    svc, db = _svc()
    antwort = svc.export(CTX, _anfrage(export_type="stammdaten", belegarten=[]))
    assert antwort.anzahl == 2
    assert antwort.dateiname.startswith("EXTF_Debitoren_Kreditoren_")
    zeilen = _zeilen(db.storage.uploads[0][1])
    konten = [z.split(";")[0] for z in zeilen[2:]]
    assert konten == ["10007", "70042"]


# --- Vorschau -----------------------------------------------------------------


def test_vorschau_zaehlt_und_listet_probleme_ohne_zu_schreiben() -> None:
    svc, db = _svc(
        invoices=[
            dict(RECHNUNG),
            {**RECHNUNG, "id": "re-9", "invoice_number": "RE-9", "currency": "DKK"},
        ]
    )
    v = svc.vorschau(CTX, _anfrage(belegarten=["ausgangsrechnungen", "zahlungen"]))
    assert v.anzahl_je_belegart == {"ausgangsrechnungen": 1, "zahlungen": 0}
    assert any("DKK" in p for p in v.probleme)
    assert db.storage.uploads == [] and db.tables["datev_exports"].inserts == []


def test_vorschau_ohne_settings_nennt_felder() -> None:
    svc, _ = _svc(datev_settings=[])
    v = svc.vorschau(CTX, _anfrage())
    assert v.anzahl_gesamt == 0
    assert "kontenrahmen" in v.probleme[0]


# --- Historie / Download --------------------------------------------------------


def test_download_nur_eigener_tenant() -> None:
    svc, db = _svc(invoices=[dict(RECHNUNG)])
    lauf = svc.export(CTX, _anfrage())
    inhalt, name = svc.download(CTX, lauf.id)
    assert inhalt.startswith(b'"EXTF";700;21') and name == lauf.dateiname
    fremd = AuthContext(user_id="x", tenant_id="t2", role="admin")
    with pytest.raises(DatevError) as exc:
        svc.download(fremd, lauf.id)
    assert exc.value.status_code == 404
    assert svc.list_exports(fremd) == []
    assert [e.id for e in svc.list_exports(CTX)] == [lauf.id]
    assert db.tables["datev_exports"].rows[0]["created_by"] == "u1"
