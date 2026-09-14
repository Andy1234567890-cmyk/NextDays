"""Tests des Bereichs »berichte«: Aggregation aus dem Belegbestand.

Abgesichert: Zeitraumgrenze (366 Tage, 422), Storno zählt negativ, Entwürfe
fehlen, Fremdwährung getrennt, leere Perioden bleiben in der Zeitreihe,
BWA-Gruppen aus SKR-Nummern, OP-Buckets, fehlende Nachbartabelle → Flag statt
Nullen, CSV-Kopf und -Deckel.
"""

from datetime import date
from decimal import Decimal
from types import SimpleNamespace

import pytest
from postgrest.exceptions import APIError

from src.core.security import AuthContext
from src.features.buchhaltung.bereiche.berichte import service as svc
from src.features.buchhaltung.bereiche.berichte.service import (
    BerichteError,
    BerichteService,
    bucket_fuer,
    bwa_gruppe,
    perioden_im_zeitraum,
    zeitraum_pruefen,
)

TENANT = "t1"
CTX = AuthContext(user_id="u", tenant_id=TENANT, role="admin")
HEUTE = date(2026, 9, 12)


class _Chain:
    def __init__(self, table: "_Table") -> None:
        self._t = table
        self._filter: list = []
        self._range: tuple[int, int] | None = None

    def select(self, *_a: object, **_k: object) -> "_Chain":
        return self

    def order(self, *_a: object, **_k: object) -> "_Chain":
        return self

    def limit(self, *_a: object, **_k: object) -> "_Chain":
        return self

    def eq(self, f: str, v: object) -> "_Chain":
        self._filter.append(lambda r: r.get(f) == v)
        return self

    def neq(self, f: str, v: object) -> "_Chain":
        self._filter.append(lambda r: r.get(f) != v)
        return self

    def gte(self, f: str, v: str) -> "_Chain":
        self._filter.append(lambda r: r.get(f) is not None and str(r.get(f)) >= v)
        return self

    def lte(self, f: str, v: str) -> "_Chain":
        self._filter.append(lambda r: r.get(f) is not None and str(r.get(f)) <= v)
        return self

    def in_(self, f: str, werte: list) -> "_Chain":
        self._filter.append(lambda r: r.get(f) in werte)
        return self

    def is_(self, f: str, v: str) -> "_Chain":
        assert v == "null"
        self._filter.append(lambda r: r.get(f) is None)
        return self

    def range(self, a: int, b: int) -> "_Chain":
        self._range = (a, b)
        return self

    def execute(self) -> SimpleNamespace:
        if self._t.fehlt:
            raise APIError({"code": "42P01", "message": f"relation {self._t.name} does not exist"})
        rows = [r for r in self._t.rows if all(f(r) for f in self._filter)]
        if self._range:
            a, b = self._range
            rows = rows[a : b + 1]
        return SimpleNamespace(data=rows)


class _Table:
    def __init__(self, name: str, rows: list[dict], fehlt: bool = False) -> None:
        self.name, self.rows, self.fehlt = name, rows, fehlt


class _DB:
    def __init__(self, fehlend: set[str] | None = None, **tables: list[dict]) -> None:
        self.tables = {n: _Table(n, r) for n, r in tables.items()}
        self._fehlend = fehlend or set()

    def table(self, name: str) -> _Chain:
        if name in self._fehlend:
            return _Chain(_Table(name, [], fehlt=True))
        return _Chain(self.tables.setdefault(name, _Table(name, [])))


def _re(nr: str, netto: str, tag: str, **extra: object) -> dict:
    n = Decimal(netto)
    row = {
        "id": f"re-{nr}",
        "tenant_id": TENANT,
        "invoice_number": nr,
        "customer_id": "k1",
        "invoice_type": "invoice",
        "status": "finalized",
        "issue_date": tag,
        "due_date": None,
        "currency": "DKK",
        "net_amount": str(n),
        "tax_amount": str(n * Decimal("0.25")),
        "gross_amount": str(n * Decimal("1.25")),
        "paid_amount": "0",
        "deleted_at": None,
        "reservation_id": None,
    }
    row.update(extra)
    return row


def _svc(monkeypatch: pytest.MonkeyPatch, **tables: list[dict]) -> BerichteService:
    fehlend = set(tables.pop("_fehlend", []))  # type: ignore[arg-type]
    tables.setdefault("tenants", [{"id": TENANT, "currency": "DKK"}])
    tables.setdefault("customers", [{"id": "k1", "tenant_id": TENANT, "name": "Kunde Eins"}])
    monkeypatch.setattr(BerichteService, "_heute", staticmethod(lambda: HEUTE))
    return BerichteService(_DB(fehlend=fehlend, **tables))  # type: ignore[arg-type]


# --- Zeitraum -----------------------------------------------------------------


def test_zeitraum_pflicht_und_grenze() -> None:
    with pytest.raises(BerichteError) as e1:
        zeitraum_pruefen(None, date(2026, 1, 1))
    assert e1.value.status_code == 422
    with pytest.raises(BerichteError):
        zeitraum_pruefen(date(2026, 2, 1), date(2026, 1, 1))
    with pytest.raises(BerichteError) as e3:
        zeitraum_pruefen(date(2024, 1, 1), date(2025, 1, 1))  # 367 Tage (Schaltjahr)
    assert "366" in e3.value.message
    assert zeitraum_pruefen(date(2024, 1, 1), date(2024, 12, 31)).tage == 366


def test_perioden_luecken_bleiben() -> None:
    assert perioden_im_zeitraum(date(2026, 1, 15), date(2026, 4, 2), "month") == [
        "2026-01",
        "2026-02",
        "2026-03",
        "2026-04",
    ]
    assert perioden_im_zeitraum(date(2025, 11, 1), date(2026, 5, 1), "quarter") == [
        "2025-Q4",
        "2026-Q1",
        "2026-Q2",
    ]
    assert perioden_im_zeitraum(date(2025, 12, 31), date(2026, 1, 1), "year") == ["2025", "2026"]


# --- Overview -----------------------------------------------------------------


def test_overview_storno_negativ_entwurf_fehlt(monkeypatch: pytest.MonkeyPatch) -> None:
    s = _svc(
        monkeypatch,
        invoices=[
            _re("RE-1", "100", "2026-03-05"),
            _re("RE-2", "-100", "2026-03-06", invoice_type="storno", original_invoice_id="re-RE-1"),
            _re("RE-3", "40", "2026-03-07", status="paid", paid_amount="50"),
            _re("", "999", "2026-03-08", status="draft"),
            _re("RE-9", "500", "2026-05-01"),  # außerhalb
            _re("RE-8", "77", "2026-03-09", deleted_at="2026-03-10T00:00:00Z"),
        ],
        _fehlend=["expenses"],
    )
    o = s.overview(CTX, date(2026, 3, 1), date(2026, 3, 31))
    assert o.umsatz_netto == Decimal("40.00")
    assert o.anzahl_belege == 3
    assert o.anzahl_storni == 1
    assert o.ausgaben_verfuegbar is False
    assert o.ausgaben_netto == Decimal("0.00")
    assert o.top_kunden[0].name == "Kunde Eins"
    assert o.currency == "DKK"


def test_overview_fremdwaehrung_getrennt(monkeypatch: pytest.MonkeyPatch) -> None:
    s = _svc(
        monkeypatch,
        invoices=[
            _re("RE-1", "100", "2026-03-05"),
            _re("RE-2", "30", "2026-03-06", currency="EUR"),
        ],
        expenses=[
            {
                "tenant_id": TENANT,
                "expense_date": "2026-03-02",
                "net_amount": "10",
                "gross_amount": "12.5",
                "currency": "DKK",
                "payment_status": "open",
                "booking_account": None,
            },
            {
                "tenant_id": TENANT,
                "expense_date": "2026-03-03",
                "net_amount": "99",
                "gross_amount": "99",
                "currency": "DKK",
                "payment_status": "cancelled",
                "booking_account": None,
            },
        ],
    )
    o = s.overview(CTX, date(2026, 3, 1), date(2026, 3, 31))
    assert o.umsatz_netto == Decimal("100.00")
    assert o.ausgaben_netto == Decimal("10.00")
    assert o.ergebnis == Decimal("90.00")
    assert [f.currency for f in o.fremdwaehrungen] == ["EUR"]
    assert o.fremdwaehrungen[0].netto == Decimal("30.00")


def test_overview_ohne_mandantenwaehrung_422(monkeypatch: pytest.MonkeyPatch) -> None:
    s = _svc(monkeypatch, tenants=[{"id": TENANT, "currency": None}])
    with pytest.raises(BerichteError) as e:
        s.overview(CTX, date(2026, 3, 1), date(2026, 3, 31))
    assert e.value.status_code == 422


def test_overview_offene_und_ueberfaellige(monkeypatch: pytest.MonkeyPatch) -> None:
    s = _svc(
        monkeypatch,
        invoices=[
            _re("RE-1", "100", "2026-08-01", due_date="2026-08-15"),  # überfällig 125 offen
            _re("RE-2", "100", "2026-09-01", due_date="2026-09-30", paid_amount="25"),  # 100 offen
            _re("RE-3", "100", "2026-09-01", status="paid", paid_amount="125"),
        ],
    )
    o = s.overview(CTX, date(2026, 9, 1), date(2026, 9, 30))
    assert o.offene_forderungen == Decimal("225.00")
    assert o.ueberfaellig == Decimal("125.00")
    assert o.ueberfaellig_anzahl == 1


# --- Revenue ------------------------------------------------------------------


def test_revenue_zeitreihe_mit_leeren_monaten(monkeypatch: pytest.MonkeyPatch) -> None:
    s = _svc(
        monkeypatch, invoices=[_re("RE-1", "100", "2026-01-10"), _re("RE-2", "50", "2026-03-10")]
    )
    r = s.revenue(CTX, date(2026, 1, 1), date(2026, 3, 31), "month", None)
    assert r.perioden == ["2026-01", "2026-02", "2026-03"]
    assert len(r.reihen) == 1
    punkte = {p.periode: p.netto for p in r.reihen[0].punkte}
    assert punkte == {
        "2026-01": Decimal("100.00"),
        "2026-02": Decimal("0.00"),
        "2026-03": Decimal("50.00"),
    }
    assert r.reihen[0].summe_netto == Decimal("150.00")


def test_revenue_nach_kanal_und_objekt(monkeypatch: pytest.MonkeyPatch) -> None:
    s = _svc(
        monkeypatch,
        invoices=[
            _re("RE-1", "100", "2026-01-10", reservation_id="res-1"),
            _re("RE-2", "50", "2026-01-11"),
        ],
        reservations=[
            {
                "id": "res-1",
                "tenant_id": TENANT,
                "property_id": "p1",
                "channel": "airbnb",
                "ota_name": "Airbnb",
            }
        ],
        properties=[{"id": "p1", "tenant_id": TENANT, "name": "Hus 1"}],
    )
    kanal = s.revenue(CTX, date(2026, 1, 1), date(2026, 1, 31), "month", "channel")
    assert {z.key: z.label for z in kanal.reihen} == {"airbnb": "Airbnb", "ohne": "Ohne Buchung"}
    objekt = s.revenue(CTX, date(2026, 1, 1), date(2026, 1, 31), "quarter", "property")
    assert {z.key: z.label for z in objekt.reihen} == {"p1": "Hus 1", "ohne": "Ohne Objekt"}
    assert objekt.perioden == ["2026-Q1"]


# --- BWA / GuV / SuSa -----------------------------------------------------------


def test_bwa_gruppe_aus_kontonummer_und_name() -> None:
    assert bwa_gruppe({"number": "3400", "kontenrahmen": "SKR03", "name": "x"}) == "material"
    assert bwa_gruppe({"number": "6020", "kontenrahmen": "SKR04", "name": "x"}) == "personal"
    assert bwa_gruppe({"number": "4210", "kontenrahmen": "SKR03", "name": "x"}) == "raum"
    assert (
        bwa_gruppe({"number": "4900", "kontenrahmen": "SKR03", "name": "Sonstiges"}) == "sonstige"
    )
    assert bwa_gruppe({"number": "1", "kontenrahmen": None, "name": "Miete Büro"}) == "raum"
    assert bwa_gruppe(None) == "sonstige"


def _ausgabe(tag: str, netto: str, konto: str | None) -> dict:
    return {
        "tenant_id": TENANT,
        "expense_date": tag,
        "net_amount": netto,
        "gross_amount": netto,
        "currency": "DKK",
        "payment_status": "paid",
        "booking_account": konto,
    }


def test_bwa_mit_vergleichsperiode(monkeypatch: pytest.MonkeyPatch) -> None:
    s = _svc(
        monkeypatch,
        invoices=[_re("RE-1", "1000", "2026-03-10"), _re("RE-0", "500", "2026-02-10")],
        expenses=[
            _ausgabe("2026-03-01", "200", "3400"),
            _ausgabe("2026-03-02", "100", "4210"),
            _ausgabe("2026-03-03", "50", None),
            _ausgabe("2026-02-03", "80", "3400"),
        ],
        booking_accounts=[
            {
                "id": "a1",
                "tenant_id": TENANT,
                "number": "3400",
                "name": "Wareneingang",
                "type": "EXPENSE",
                "kontenrahmen": "SKR03",
            },
            {
                "id": "a2",
                "tenant_id": TENANT,
                "number": "4210",
                "name": "Miete",
                "type": "EXPENSE",
                "kontenrahmen": "SKR03",
            },
        ],
    )
    b = s.bwa(CTX, date(2026, 3, 1), date(2026, 3, 31))
    assert b.vergleichszeitraum.von == date(2026, 1, 29)
    assert b.vergleichszeitraum.bis == date(2026, 2, 28)
    assert b.erloese.aktuell == Decimal("1000.00") and b.erloese.vergleich == Decimal("500.00")
    assert b.erloese.veraenderung_prozent == Decimal("100.0")
    je = {z.key: z for z in b.aufwand}
    assert je["material"].aktuell == Decimal("200.00") and je["material"].vergleich == Decimal(
        "80.00"
    )
    assert je["raum"].aktuell == Decimal("100.00")
    assert je["sonstige"].aktuell == Decimal("50.00")
    assert je["material"].prozent_vom_umsatz == Decimal("20.0")
    assert b.ergebnis.aktuell == Decimal("650.00")
    assert b.konten_verfuegbar and b.ausgaben_verfuegbar


def test_susa_je_konto(monkeypatch: pytest.MonkeyPatch) -> None:
    s = _svc(
        monkeypatch,
        invoices=[_re("RE-1", "1000", "2026-03-10")],
        expenses=[_ausgabe("2026-03-01", "200", "3400"), _ausgabe("2026-03-02", "5", "9999")],
        booking_accounts=[
            {
                "id": "a1",
                "tenant_id": TENANT,
                "number": "3400",
                "name": "Wareneingang",
                "type": "EXPENSE",
            }
        ],
    )
    su = s.susa(CTX, date(2026, 3, 1), date(2026, 3, 31))
    nach_nummer = {z.nummer: z for z in su.zeilen}
    assert nach_nummer["3400"].soll == Decimal("200.00") and nach_nummer["3400"].account_id == "a1"
    assert nach_nummer["9999"].name == "Konto nicht im Kontenplan"
    assert nach_nummer[None].haben == Decimal("1000.00")
    assert su.saldo == Decimal("795.00")


def test_guv_zwoelf_monate(monkeypatch: pytest.MonkeyPatch) -> None:
    s = _svc(
        monkeypatch,
        invoices=[_re("RE-1", "300", "2026-06-15")],
        expenses=[_ausgabe("2026-06-01", "100", None)],
    )
    g = s.guv(CTX, 2026)
    assert len(g.monate) == 12
    juni = next(m for m in g.monate if m.monat == "2026-06")
    assert juni.ergebnis == Decimal("200.00")
    assert g.ergebnis == Decimal("200.00")


# --- Offene Posten --------------------------------------------------------------


def test_buckets() -> None:
    assert bucket_fuer(None) == "ohne_faelligkeit"
    assert bucket_fuer(-3) == "nicht_faellig"
    assert bucket_fuer(0) == "0-30" and bucket_fuer(30) == "0-30"
    assert bucket_fuer(31) == "31-60" and bucket_fuer(60) == "31-60"
    assert bucket_fuer(61) == "61-90" and bucket_fuer(90) == "61-90"
    assert bucket_fuer(91) == ">90"


def test_open_items_liste(monkeypatch: pytest.MonkeyPatch) -> None:
    s = _svc(
        monkeypatch,
        invoices=[
            _re("RE-1", "80", "2026-05-01", due_date="2026-05-20"),  # 115 Tage
            _re("RE-2", "80", "2026-08-01", due_date="2026-08-30", paid_amount="20"),  # 13 Tage
            _re("RE-3", "80", "2026-09-01", due_date="2026-10-01"),  # nicht fällig
            _re("RE-4", "80", "2026-09-01", status="paid", paid_amount="100"),
            _re("RE-5", "80", "2026-09-01", due_date="2026-09-01", currency="EUR"),
        ],
    )
    op = s.open_items(CTX)
    assert [p.invoice_number for p in op.posten] == ["RE-1", "RE-2", "RE-3"]
    assert op.posten[0].bucket == ">90" and op.posten[0].alter_tage == 115
    assert op.posten[1].offen == Decimal("80.00")
    assert op.posten[2].bucket == "nicht_faellig"
    assert op.summe_offen == Decimal("280.00")
    je = {b.bucket: b for b in op.buckets}
    assert je[">90"].anzahl == 1 and je["0-30"].offen == Decimal("80.00")
    assert op.fremdwaehrungen[0].currency == "EUR"


# --- CSV ------------------------------------------------------------------------


def test_csv_kopf_und_deckel(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(svc, "CSV_MAX_ZEILEN", 3)
    s = _svc(
        monkeypatch,
        invoices=[
            _re(f"RE-{i}", "10", f"2026-01-{i:02d}", due_date="2026-01-01") for i in range(1, 8)
        ],
    )
    text = "".join(s.export_csv(CTX, "open-items", None, None, "month", None, None))
    assert text.startswith("﻿Rechnung;Kunde;")
    zeilen = text.strip().splitlines()
    assert len(zeilen) == 4  # Kopf + 2 Daten + Hinweis
    assert "gekürzt" in zeilen[-1]


def test_csv_zeitraumfehler_vor_erstem_byte(monkeypatch: pytest.MonkeyPatch) -> None:
    s = _svc(monkeypatch)
    with pytest.raises(BerichteError) as e:
        next(s.export_csv(CTX, "bwa", None, None, "month", None, None))
    assert e.value.status_code == 422
