"""Kostenstellen und Zahlungsarten: CRUD, Tenant-Scope, genau ein Standard."""

import pytest

from src.features.buchhaltung.bereiche.kontenplan.schemas import (
    CostCenterCreate,
    CostCenterUpdate,
    PaymentMethodCreate,
    PaymentMethodUpdate,
)
from src.features.buchhaltung.bereiche.kontenplan.service import (
    KontenplanError,
    KontenplanService,
)

from .conftest import CTX, FREMD, FakeDB


def _svc(db: FakeDB) -> KontenplanService:
    return KontenplanService(db)  # type: ignore[arg-type]


def test_kostenstelle_crud(db: FakeDB) -> None:
    svc = _svc(db)
    ks = svc.create_cost_center(CTX, CostCenterCreate(number=" 100 ", name="Haus Nord"))
    assert ks.number == "100"
    with pytest.raises(KontenplanError) as exc:
        svc.create_cost_center(CTX, CostCenterCreate(number="100", name="doppelt"))
    assert exc.value.status_code == 409
    assert svc.update_cost_center(CTX, ks.id, CostCenterUpdate(active=False)).active is False
    with pytest.raises(KontenplanError) as fremd:
        svc.delete_cost_center(FREMD, ks.id)
    assert fremd.value.status_code == 404
    svc.delete_cost_center(CTX, ks.id)
    assert svc.list_cost_centers(CTX) == []


def test_kostenstelle_leerer_name_422() -> None:
    with pytest.raises(ValueError):
        CostCenterCreate(number="1", name="   ")


def test_zahlungsart_ohne_zahlungsziel_bleibt_leer(db: FakeDB) -> None:
    """Wurzel 4: kein erfundenes „14 Tage"."""
    za = _svc(db).create_payment_method(CTX, PaymentMethodCreate(name="Bar", type="cash"))
    assert za.payment_term_days is None
    assert za.is_default is False


def test_zahlungsart_genau_ein_standard(db: FakeDB) -> None:
    svc = _svc(db)
    a = svc.create_payment_method(
        CTX,
        PaymentMethodCreate(
            name="Überweisung", type="bank_transfer", paymentTermDays=14, isDefault=True
        ),
    )
    b = svc.create_payment_method(
        CTX, PaymentMethodCreate(name="PayPal", type="paypal", isDefault=True)
    )
    rows = {r["id"]: r for r in db.tables["payment_methods"].rows}
    assert rows[a.id]["is_default"] is False
    assert rows[b.id]["is_default"] is True
    # Umschalten per Update setzt den bisherigen Standard zurück.
    svc.update_payment_method(CTX, a.id, PaymentMethodUpdate(isDefault=True))
    rows = {r["id"]: r for r in db.tables["payment_methods"].rows}
    assert rows[a.id]["is_default"] is True
    assert rows[b.id]["is_default"] is False


def test_zahlungsart_name_doppelt_409(db: FakeDB) -> None:
    svc = _svc(db)
    svc.create_payment_method(CTX, PaymentMethodCreate(name="Karte", type="card"))
    with pytest.raises(KontenplanError) as exc:
        svc.create_payment_method(CTX, PaymentMethodCreate(name="Karte", type="card"))
    assert exc.value.status_code == 409


def test_zahlungsart_fremder_tenant_404(db: FakeDB) -> None:
    svc = _svc(db)
    za = svc.create_payment_method(CTX, PaymentMethodCreate(name="Karte", type="card"))
    with pytest.raises(KontenplanError) as exc:
        svc.update_payment_method(FREMD, za.id, PaymentMethodUpdate(name="x"))
    assert exc.value.status_code == 404
    assert svc.list_payment_methods(FREMD) == []


def test_zahlungsziel_grenze() -> None:
    with pytest.raises(ValueError):
        PaymentMethodCreate(name="x", type="cash", paymentTermDays=366)
