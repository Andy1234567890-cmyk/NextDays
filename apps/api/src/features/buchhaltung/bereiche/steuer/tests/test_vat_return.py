"""Umsatzsteuer-Auswertung: Summen je Satz, Storno negativ, Perioden-Grenzen,
Währungen, DE-Kennzahlen vs. neutral, fehlende Ausgaben-Tabelle."""

from decimal import Decimal

import pytest

from src.core.security import AuthContext
from src.features.buchhaltung.bereiche.steuer.service import SteuerError, SteuerService

from .fake_db import FakeDB

TENANT = "t1"
CTX = AuthContext(user_id="u1", tenant_id=TENANT, role="admin")

TENANTS_DE = [{"id": TENANT, "country": "DE", "currency": "EUR"}]
TENANTS_DK = [{"id": TENANT, "country": "DK", "currency": "DKK"}]


def _inv(iid: str, datum: str, net: str, tax: str, **extra: object) -> dict:
    row = {
        "id": iid,
        "tenant_id": TENANT,
        "invoice_type": "invoice",
        "status": "sent",
        "issue_date": datum,
        "net_amount": net,
        "tax_amount": tax,
        "gross_amount": str(Decimal(net) + Decimal(tax)),
        "tax_rate": None,
        "tax_rule": "DE_TAXABLE",
        "currency": "EUR",
        "deleted_at": None,
        "original_invoice_id": None,
    }
    row.update(extra)
    return row


def _li(iid: str, rate: str, net: str, tax: str) -> dict:
    return {"invoice_id": iid, "tax_rate": rate, "net_amount": net, "tax_amount": tax}


def _svc(**tables: list[dict]) -> tuple[SteuerService, FakeDB]:
    tables.setdefault("tenants", TENANTS_DE)
    db = FakeDB(**tables)
    return SteuerService(service_client=db), db  # type: ignore[arg-type]


def _zeile(antwort, kategorie: str, satz: str | None):  # noqa: ANN001, ANN202
    for z in antwort.sales:
        if z.category == kategorie and (z.tax_rate == (Decimal(satz) if satz else None)):
            return z
    raise AssertionError(f"Zeile {kategorie}/{satz} fehlt: {antwort.sales}")


def _kz(antwort, code: str) -> Decimal:  # noqa: ANN001
    return next(m.amount for m in antwort.mapping if m.code == code)


# --- Summen je Satz ---------------------------------------------------------------


def test_summen_je_satz_aus_positionen_und_kennzahlen_de() -> None:
    svc, _ = _svc(
        invoices=[
            _inv("i1", "2026-08-03", "193.46", "25.54"),
            _inv("i2", "2026-08-20", "50.00", "9.50"),
        ],
        invoice_line_items=[
            _li("i1", "19", "100.00", "19.00"),
            _li("i1", "7", "93.46", "6.54"),
            _li("i2", "19", "50.00", "9.50"),
        ],
        expenses=[
            {
                "id": "e1",
                "tenant_id": TENANT,
                "expense_date": "2026-08-10",
                "net_amount": "200.00",
                "tax_amount": "38.00",
                "gross_amount": "238.00",
                "tax_rate": "19",
                "currency": "EUR",
                "status": "booked",
            },
        ],
    )
    a = svc.vat_return(CTX, "2026-08")
    assert _zeile(a, "taxable", "19").net == Decimal("150.00")
    assert _zeile(a, "taxable", "19").tax == Decimal("28.50")
    assert _zeile(a, "taxable", "19").invoice_count == 2
    assert _zeile(a, "taxable", "7").net == Decimal("93.46")
    assert a.sales_tax_total == Decimal("35.04")
    assert a.input_tax_total == Decimal("38.00")
    assert a.payable == Decimal("-2.96")  # Erstattung
    assert a.mapping_scheme == "DE_USTVA"
    assert _kz(a, "81") == Decimal("150.00")
    assert _kz(a, "86") == Decimal("93.46")
    assert _kz(a, "66") == Decimal("38.00")
    assert _kz(a, "83") == Decimal("-2.96")
    assert a.country == "DE" and a.currency == "EUR"


def test_ohne_positionen_gilt_der_rechnungssatz() -> None:
    svc, _ = _svc(invoices=[_inv("i1", "2026-08-03", "100.00", "25.00", tax_rate="25")])
    a = svc.vat_return(CTX, "2026-08")
    assert _zeile(a, "taxable", "25").net == Decimal("100.00")
    # 25 % ist kein 19/7 → Kz 35/36
    assert _kz(a, "35") == Decimal("100.00")
    assert _kz(a, "36") == Decimal("25.00")


def test_steuer_ohne_satz_wird_nicht_geraten() -> None:
    svc, _ = _svc(invoices=[_inv("i1", "2026-08-03", "100.00", "19.00")])
    a = svc.vat_return(CTX, "2026-08")
    assert _zeile(a, "undetermined", None).net == Decimal("100.00")
    assert any("ohne Steuersatz" in w for w in a.warnings)
    assert not any(m.code == "81" for m in a.mapping)


# --- Storno / Gutschrift negativ ---------------------------------------------------


def test_storno_hebt_original_auf() -> None:
    """Original (cancelled) + negative Storno-Rechnung → Summe 0, nicht −100."""
    svc, _ = _svc(
        invoices=[
            _inv("i1", "2026-08-03", "100.00", "19.00", status="cancelled", tax_rate="19"),
            _inv(
                "s1",
                "2026-08-10",
                "-100.00",
                "-19.00",
                invoice_type="storno",
                status="finalized",
                tax_rate="19",
                original_invoice_id="i1",
            ),
        ],
    )
    a = svc.vat_return(CTX, "2026-08")
    z = _zeile(a, "taxable", "19")
    assert (z.net, z.tax, z.invoice_count) == (Decimal("0.00"), Decimal("0.00"), 2)


def test_storno_in_folgeperiode_zaehlt_negativ() -> None:
    svc, _ = _svc(
        invoices=[
            _inv("i1", "2026-07-03", "100.00", "19.00", status="cancelled", tax_rate="19"),
            _inv(
                "s1",
                "2026-08-10",
                "-100.00",
                "-19.00",
                invoice_type="storno",
                status="finalized",
                tax_rate="19",
                original_invoice_id="i1",
            ),
        ],
    )
    juli = svc.vat_return(CTX, "2026-07")
    august = svc.vat_return(CTX, "2026-08")
    assert _zeile(juli, "taxable", "19").net == Decimal("100.00")
    assert _zeile(august, "taxable", "19").net == Decimal("-100.00")
    assert august.payable == Decimal("-19.00")


def test_gutschrift_positiv_gespeichert_zaehlt_trotzdem_negativ() -> None:
    svc, _ = _svc(
        invoices=[
            _inv("g1", "2026-08-03", "40.00", "7.60", invoice_type="credit_note", tax_rate="19")
        ],
    )
    a = svc.vat_return(CTX, "2026-08")
    assert _zeile(a, "taxable", "19").net == Decimal("-40.00")


def test_cancelled_ohne_storno_und_draft_zaehlen_nicht() -> None:
    svc, _ = _svc(
        invoices=[
            _inv("i1", "2026-08-03", "100.00", "19.00", status="cancelled", tax_rate="19"),
            _inv("i2", "2026-08-04", "100.00", "19.00", status="draft", tax_rate="19"),
            _inv("i3", "2026-08-05", "10.00", "1.90", tax_rate="19"),
        ],
    )
    a = svc.vat_return(CTX, "2026-08")
    assert _zeile(a, "taxable", "19").net == Decimal("10.00")


# --- Perioden-Grenzen ----------------------------------------------------------------


def test_perioden_grenzen_inklusiv() -> None:
    svc, _ = _svc(
        invoices=[
            _inv("a", "2026-06-30", "1.00", "0.19", tax_rate="19"),
            _inv("b", "2026-07-01", "2.00", "0.38", tax_rate="19"),
            _inv("c", "2026-09-30", "4.00", "0.76", tax_rate="19"),
            _inv("d", "2026-10-01", "8.00", "1.52", tax_rate="19"),
        ],
    )
    q3 = svc.vat_return(CTX, "2026-Q3")
    assert _zeile(q3, "taxable", "19").net == Decimal("6.00")
    assert (str(q3.period_start), str(q3.period_end)) == ("2026-07-01", "2026-09-30")
    jahr = svc.vat_return(CTX, "2026")
    assert _zeile(jahr, "taxable", "19").net == Decimal("15.00")


def test_ungueltige_periode_422() -> None:
    svc, _ = _svc()
    with pytest.raises(SteuerError) as exc:
        svc.vat_return(CTX, "2026-Q7")
    assert exc.value.status_code == 422


# --- Währung / Land ------------------------------------------------------------------


def test_gemischte_waehrungen_422_mit_nennung() -> None:
    svc, _ = _svc(
        invoices=[_inv("a", "2026-08-01", "1.00", "0.19", tax_rate="19", currency="DKK")],
    )
    with pytest.raises(SteuerError) as exc:
        svc.vat_return(CTX, "2026-08")
    assert exc.value.status_code == 422
    assert "DKK" in exc.value.message and "EUR" in exc.value.message


def test_ohne_land_oder_waehrung_422() -> None:
    svc, _ = _svc(tenants=[{"id": TENANT, "country": "DE", "currency": None}])
    with pytest.raises(SteuerError) as exc:
        svc.vat_return(CTX, "2026-08")
    assert exc.value.status_code == 422


def test_nicht_de_bekommt_neutrale_zeilen_ohne_mapping() -> None:
    svc, _ = _svc(
        tenants=TENANTS_DK,
        invoices=[_inv("a", "2026-08-01", "100.00", "25.00", tax_rate="25", currency="DKK")],
    )
    a = svc.vat_return(CTX, "2026-08")
    assert a.mapping_scheme is None and a.mapping == []
    assert _zeile(a, "taxable", "25").tax == Decimal("25.00")
    assert a.currency == "DKK"


def test_kleinunternehmer_de_ohne_kennzahlen() -> None:
    svc, _ = _svc(
        tenant_billing_profile=[{"tenant_id": TENANT, "is_kleinunternehmer": True}],
        invoices=[_inv("a", "2026-08-01", "100.00", "0", tax_rate="0")],
    )
    a = svc.vat_return(CTX, "2026-08")
    assert a.small_business is True
    assert a.mapping == []
    assert any("Kleinunternehmer" in w for w in a.warnings)


def test_steuerregeln_landen_in_ihrer_kategorie() -> None:
    svc, _ = _svc(
        invoices=[
            _inv("a", "2026-08-01", "100.00", "0", tax_rule="EU_REVERSE_18B"),
            _inv("b", "2026-08-01", "50.00", "0", tax_rule="NON_EU_EXPORT"),
            _inv("c", "2026-08-01", "5.00", "0", tax_rule="FANTASIE"),
        ],
    )
    a = svc.vat_return(CTX, "2026-08")
    assert _zeile(a, "reverse_charge_eu", None).net == Decimal("100.00")
    assert _zeile(a, "export", None).net == Decimal("50.00")
    assert _zeile(a, "undetermined", None).net == Decimal("5.00")
    assert _kz(a, "21") == Decimal("100.00")
    assert _kz(a, "43") == Decimal("50.00")


# --- Ausgaben-Tabelle fehlt noch ----------------------------------------------------------


def test_fehlende_ausgaben_tabelle_warnt_statt_500() -> None:
    svc, db = _svc(invoices=[_inv("a", "2026-08-01", "100.00", "19.00", tax_rate="19")])
    db.tabelle_fehlt("expenses")
    a = svc.vat_return(CTX, "2026-08")
    assert a.input_tax_total == Decimal("0.00")
    assert any("0655" in w for w in a.warnings)
    assert a.payable == Decimal("19.00")


def test_ausgaben_entwuerfe_zaehlen_nicht() -> None:
    svc, _ = _svc(
        expenses=[
            {
                "id": "e1",
                "tenant_id": TENANT,
                "expense_date": "2026-08-10",
                "net_amount": "100",
                "tax_amount": "19",
                "tax_rate": "19",
                "currency": "EUR",
                "status": "draft",
            },
            {
                "id": "e2",
                "tenant_id": TENANT,
                "expense_date": "2026-08-10",
                "net_amount": "10",
                "tax_amount": "1.90",
                "tax_rate": "19",
                "currency": "EUR",
                "status": "booked",
            },
        ],
    )
    a = svc.vat_return(CTX, "2026-08")
    assert a.input_tax_total == Decimal("1.90")
    assert a.input_tax[0].expense_count == 1
