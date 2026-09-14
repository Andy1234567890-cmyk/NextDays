"""Buchungskonten: CRUD, Systemkonto-Schutz, Standard-Import idempotent."""

from decimal import Decimal

import pytest

from src.features.buchhaltung.bereiche.kontenplan.schemas import (
    BookingAccountCreate,
    BookingAccountUpdate,
)
from src.features.buchhaltung.bereiche.kontenplan.service import (
    KontenplanError,
    KontenplanService,
)
from src.features.buchhaltung.bereiche.kontenplan.skr import STANDARDKONTEN

from .conftest import CTX, FREMD, TENANT, FakeDB


def _svc(db: FakeDB) -> KontenplanService:
    return KontenplanService(db)  # type: ignore[arg-type]


def test_anlegen_und_listen(db: FakeDB) -> None:
    svc = _svc(db)
    konto = svc.create_booking_account(
        CTX, BookingAccountCreate(number=" 8400 ", name="Erlöse 19 %", type="INCOME", taxRate="19")
    )
    assert konto.number == "8400"
    assert konto.tax_rate == Decimal("19")
    assert konto.is_system is False
    assert db.tables["booking_accounts"].inserts[0]["tenant_id"] == TENANT
    liste = svc.list_booking_accounts(CTX)
    assert [k.number for k in liste] == ["8400"]
    # Fremder Tenant sieht nichts (Wurzel 3).
    assert svc.list_booking_accounts(FREMD) == []


def test_ohne_steuersatz_bleibt_leer(db: FakeDB) -> None:
    """Wurzel 4: kein erfundener Satz."""
    konto = _svc(db).create_booking_account(
        CTX, BookingAccountCreate(number="1200", name="Bank", type="ASSET")
    )
    assert konto.tax_rate is None
    assert db.tables["booking_accounts"].inserts[0]["tax_rate"] is None


def test_kontonummer_muss_ziffern_sein() -> None:
    with pytest.raises(ValueError):
        BookingAccountCreate(number="84A0", name="x", type="INCOME")


def test_doppelte_nummer_409(db: FakeDB) -> None:
    svc = _svc(db)
    svc.create_booking_account(CTX, BookingAccountCreate(number="8400", name="a", type="INCOME"))
    with pytest.raises(KontenplanError) as exc:
        svc.create_booking_account(
            CTX, BookingAccountCreate(number="8400", name="b", type="INCOME")
        )
    assert exc.value.status_code == 409


def test_suche_und_filter(db: FakeDB) -> None:
    svc = _svc(db)
    svc.create_booking_account(
        CTX, BookingAccountCreate(number="8400", name="Erlöse", type="INCOME")
    )
    svc.create_booking_account(
        CTX, BookingAccountCreate(number="4930", name="Bürobedarf", type="EXPENSE")
    )
    assert [k.number for k in svc.list_booking_accounts(CTX, type_="EXPENSE")] == ["4930"]
    assert [k.number for k in svc.list_booking_accounts(CTX, search="büro")] == ["4930"]
    assert [k.number for k in svc.list_booking_accounts(CTX, search="84")] == ["8400"]


def test_limit_grenze_422(db: FakeDB) -> None:
    with pytest.raises(KontenplanError) as exc:
        _svc(db).list_booking_accounts(CTX, limit=501)
    assert exc.value.status_code == 422


def test_aendern_nur_eigener_tenant(db: FakeDB) -> None:
    svc = _svc(db)
    konto = svc.create_booking_account(
        CTX, BookingAccountCreate(number="8400", name="a", type="INCOME")
    )
    with pytest.raises(KontenplanError) as exc:
        svc.update_booking_account(FREMD, konto.id, BookingAccountUpdate(name="fremd"))
    assert exc.value.status_code == 404
    geaendert = svc.update_booking_account(
        CTX, konto.id, BookingAccountUpdate(name="Erlöse", active=False)
    )
    assert geaendert.name == "Erlöse"
    assert geaendert.active is False
    assert geaendert.number == "8400"


def test_systemkonto_nicht_loeschbar_nur_deaktivieren(db: FakeDB) -> None:
    db.tables["booking_accounts"].rows.append(
        {
            "id": "sys",
            "tenant_id": TENANT,
            "number": "1000",
            "name": "Kasse",
            "type": "ASSET",
            "is_system": True,
            "active": True,
            "automatic_booking": False,
            "created_at": "2026-09-12T00:00:00Z",
            "updated_at": "2026-09-12T00:00:00Z",
        }
    )
    svc = _svc(db)
    with pytest.raises(KontenplanError) as exc:
        svc.delete_booking_account(CTX, "sys")
    assert exc.value.status_code == 409
    with pytest.raises(KontenplanError) as exc2:
        svc.update_booking_account(CTX, "sys", BookingAccountUpdate(number="1001"))
    assert exc2.value.status_code == 409
    assert (
        svc.update_booking_account(CTX, "sys", BookingAccountUpdate(active=False)).active is False
    )
    assert len(db.tables["booking_accounts"].rows) == 1


def test_eigenes_konto_loeschbar(db: FakeDB) -> None:
    svc = _svc(db)
    konto = svc.create_booking_account(
        CTX, BookingAccountCreate(number="8401", name="a", type="INCOME")
    )
    svc.delete_booking_account(CTX, konto.id)
    assert db.tables["booking_accounts"].rows == []
    with pytest.raises(KontenplanError) as exc:
        svc.delete_booking_account(CTX, konto.id)
    assert exc.value.status_code == 404


def test_import_standard_idempotent(db: FakeDB) -> None:
    svc = _svc(db)
    # Ein Konto existiert schon umbenannt — der Import lässt es in Ruhe.
    svc.create_booking_account(
        CTX, BookingAccountCreate(number="8400", name="Übernachtungen 19 %", type="INCOME")
    )
    erst = svc.import_standard(CTX, "SKR03")
    assert erst.angelegt == len(STANDARDKONTEN) - 1
    assert erst.uebersprungen == 1
    zweit = svc.import_standard(CTX, "SKR03")
    assert zweit.angelegt == 0
    assert zweit.uebersprungen == len(STANDARDKONTEN)
    konten = {k.number: k for k in svc.list_booking_accounts(CTX)}
    assert konten["8400"].name == "Übernachtungen 19 %"
    assert konten["8400"].is_system is False
    assert konten["1000"].is_system is True
    assert konten["1000"].kontenrahmen == "SKR03"
    assert konten["1000"].skr_reference == "1600"
    assert konten["8300"].tax_rate == Decimal("7")
    assert konten["1200"].tax_rate is None


def test_import_skr04_nummern(db: FakeDB) -> None:
    svc = _svc(db)
    res = svc.import_standard(CTX, "SKR04")
    nummern = {k.number for k in res.accounts}
    assert {"1600", "1800", "4400", "6815"} <= nummern
    assert "8400" not in nummern


def test_import_unbekannter_rahmen_422(db: FakeDB) -> None:
    with pytest.raises(KontenplanError) as exc:
        _svc(db).import_standard(CTX, "SKR99")
    assert exc.value.status_code == 422
