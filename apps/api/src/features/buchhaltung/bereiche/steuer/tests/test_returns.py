"""Eingefrorene Meldungen: Freeze-Idempotenz, Versionierung, Status, Export;
EÜR-Vorschau und Einstellungen ohne Ersatzwerte."""

from decimal import Decimal

import pytest

from src.core.security import AuthContext
from src.features.buchhaltung.bereiche.steuer.schemas import (
    FreezeRequest,
    TaxReturnUpdate,
    TaxSettingsUpdate,
)
from src.features.buchhaltung.bereiche.steuer.service import SteuerError, SteuerService

from .fake_db import FakeDB
from .test_vat_return import CTX, TENANT, TENANTS_DE, _inv

FREMD = AuthContext(user_id="u9", tenant_id="t9", role="admin")


def _svc(**tables: list[dict]) -> tuple[SteuerService, FakeDB]:
    tables.setdefault("tenants", TENANTS_DE)
    tables.setdefault("invoices", [_inv("i1", "2026-08-03", "100.00", "19.00", tax_rate="19")])
    db = FakeDB(**tables)
    return SteuerService(service_client=db), db  # type: ignore[arg-type]


# --- Freeze ---------------------------------------------------------------------------


def test_freeze_ist_idempotent() -> None:
    svc, db = _svc()
    a = svc.freeze(CTX, FreezeRequest(period="2026-08"))
    b = svc.freeze(CTX, FreezeRequest(period="2026-08"))
    assert a.id == b.id and a.version == b.version == 1
    assert len(db.tables["tax_returns"].inserts) == 1
    assert a.status == "draft" and a.payable == Decimal("19.00")
    assert a.values["salesNetTotal"] == "100.00"
    assert a.mapping["scheme"] == "DE_USTVA"


def test_freeze_aktualisiert_entwurf_bei_neuen_werten() -> None:
    svc, db = _svc()
    a = svc.freeze(CTX, FreezeRequest(period="2026-08"))
    db.tables["invoices"].rows.append(_inv("i2", "2026-08-09", "50.00", "9.50", tax_rate="19"))
    b = svc.freeze(CTX, FreezeRequest(period="2026-08"))
    assert b.id == a.id and b.version == 1
    assert b.payable == Decimal("28.50")
    assert len(db.tables["tax_returns"].inserts) == 1


def test_freeze_nach_einreichung_neue_version_und_alte_korrigiert() -> None:
    svc, db = _svc()
    v1 = svc.freeze(CTX, FreezeRequest(period="2026-08"))
    svc.update_return(CTX, v1.id, TaxReturnUpdate(status="submitted"))
    db.tables["invoices"].rows.append(
        _inv(
            "s1",
            "2026-08-20",
            "-100.00",
            "-19.00",
            invoice_type="storno",
            status="finalized",
            tax_rate="19",
            original_invoice_id="i1",
        )
    )
    v2 = svc.freeze(CTX, FreezeRequest(period="2026-08", note="Storno nachgezogen"))
    assert v2.version == 2 and v2.status == "draft" and v2.payable == Decimal("0.00")
    alt = next(r for r in db.tables["tax_returns"].rows if r["id"] == v1.id)
    assert alt["status"] == "corrected"
    # Die Live-Auswertung kennt die eingefrorene Version.
    assert svc.vat_return(CTX, "2026-08").frozen_version == 2


def test_freeze_race_gibt_vorhandene_zeile() -> None:
    """Zweiter paralleler Insert mit derselben Version → 23505 → vorhandene Zeile,
    keine zweite Version, kein 500."""
    svc, db = _svc()
    db.table("tax_returns")
    db.tables["tax_returns"].race_einmal = True
    a = svc.freeze(CTX, FreezeRequest(period="2026-08"))
    assert a.id == "tax_returns-race" and a.version == 1
    assert len(db.tables["tax_returns"].rows) == 1


# --- Status / Scope -----------------------------------------------------------------------


def test_statuswechsel_regeln() -> None:
    svc, _ = _svc()
    m = svc.freeze(CTX, FreezeRequest(period="2026-08"))
    s = svc.update_return(CTX, m.id, TaxReturnUpdate(status="submitted"))
    assert s.status == "submitted" and s.submitted_at is not None
    with pytest.raises(SteuerError) as exc:
        svc.update_return(CTX, m.id, TaxReturnUpdate(status="draft"))
    assert exc.value.status_code == 409
    with pytest.raises(SteuerError) as exc:
        svc.update_return(CTX, m.id, TaxReturnUpdate(status="corrected"))
    assert exc.value.status_code == 409


def test_fremder_tenant_sieht_nichts() -> None:
    svc, _ = _svc()
    m = svc.freeze(CTX, FreezeRequest(period="2026-08"))
    for aufruf in (
        lambda: svc.get_return(FREMD, m.id),
        lambda: svc.update_return(FREMD, m.id, TaxReturnUpdate(note="x")),
        lambda: svc.export_csv(FREMD, m.id),
    ):
        with pytest.raises(SteuerError) as exc:
            aufruf()
        assert exc.value.status_code == 404


def test_liste_sortiert_neueste_periode_zuerst() -> None:
    svc, db = _svc()
    db.tables["invoices"].rows.append(_inv("j", "2026-07-03", "10.00", "1.90", tax_rate="19"))
    svc.freeze(CTX, FreezeRequest(period="2026-07"))
    svc.freeze(CTX, FreezeRequest(period="2026-08"))
    liste = svc.list_returns(CTX)
    assert [m.period for m in liste.items] == ["2026-08", "2026-07"]
    assert liste.total == 2


# --- Export ---------------------------------------------------------------------------------


def test_csv_export_traegt_kennzahlen_und_bom() -> None:
    svc, _ = _svc()
    m = svc.freeze(CTX, FreezeRequest(period="2026-Q3"))
    name, text = svc.export_csv(CTX, m.id)
    assert name == "umsatzsteuer-2026-Q3-v1.csv"
    assert text.startswith("﻿section;code;label")
    assert "mapping;81;" in text and "mapping;83;" in text
    assert ";EUR" in text
    js = svc.export_json(CTX, m.id)
    assert js["period"] == "2026-Q3" and js["values"]["payable"] == "19.00"


# --- EÜR-Vorschau ------------------------------------------------------------------------------


def test_profit_estimate_ohne_parameter_keine_schaetzung() -> None:
    svc, db = _svc()
    db.tabelle_fehlt("expenses")
    p = svc.profit_estimate(CTX, 2026)
    assert p.settings_complete is False and p.estimated_tax_total is None
    assert p.months[7].income_net == Decimal("100.00")  # August
    assert p.months[11].cumulative_profit == Decimal("100.00")
    assert any("Ertragsteuersatz" in w for w in p.warnings)
    assert any("0655" in w for w in p.warnings)


def test_profit_estimate_mit_parametern() -> None:
    svc, _ = _svc(
        expenses=[
            {
                "id": "e1",
                "tenant_id": TENANT,
                "expense_date": "2026-09-01",
                "net_amount": "40",
                "tax_amount": "7.60",
                "tax_rate": "19",
                "currency": "EUR",
                "status": "booked",
            }
        ],
        tax_settings=[
            {
                "tenant_id": TENANT,
                "income_tax_rate": "30",
                "trade_tax_rate": "10",
                "reserve_rate": "50",
                "vat_period": "quarter",
            }
        ],
    )
    p = svc.profit_estimate(CTX, 2026)
    assert p.profit_total == Decimal("60.00")
    assert p.tax_rate_total == Decimal("40")
    assert p.estimated_tax_total == Decimal("24.00")
    assert p.estimated_reserve == Decimal("12.00")
    assert p.months[8].expenses_net == Decimal("40.00")
    assert p.months[8].estimated_tax == Decimal("24.00")


def test_profit_estimate_mit_storno_negativ() -> None:
    svc, db = _svc()
    db.tables["invoices"].rows[0]["status"] = "cancelled"
    db.tables["invoices"].rows.append(
        _inv(
            "s1",
            "2026-09-01",
            "-100.00",
            "-19.00",
            invoice_type="storno",
            status="finalized",
            tax_rate="19",
            original_invoice_id="i1",
        )
    )
    p = svc.profit_estimate(CTX, 2026)
    assert p.months[7].income_net == Decimal("100.00")
    assert p.months[8].income_net == Decimal("-100.00")
    assert p.profit_total == Decimal("0.00")


# --- Einstellungen -------------------------------------------------------------------------------


def test_settings_leer_ohne_defaults_und_upsert() -> None:
    svc, _ = _svc()
    leer = svc.get_settings(CTX)
    assert leer.configured is False and leer.income_tax_rate is None and leer.vat_period is None
    assert leer.country == "DE" and leer.currency == "EUR"
    voll = svc.put_settings(
        CTX, TaxSettingsUpdate(income_tax_rate=Decimal("25"), vat_period="month")
    )
    assert voll.configured is True and voll.income_tax_rate == Decimal("25")
    assert voll.trade_tax_rate is None  # kein 0-Zwang
    wieder = svc.put_settings(CTX, TaxSettingsUpdate(income_tax_rate=None))
    assert wieder.configured is False
