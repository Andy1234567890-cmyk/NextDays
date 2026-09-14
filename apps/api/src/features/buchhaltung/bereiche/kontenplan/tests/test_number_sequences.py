"""Nummernkreise: Format/Präfix ändern, Startwert nur ohne Ziehung, Vorgaben idempotent."""

import pytest

from src.features.buchhaltung.bereiche.kontenplan.schemas import NumberSequenceUpdate
from src.features.buchhaltung.bereiche.kontenplan.service import (
    KontenplanError,
    KontenplanService,
)
from src.features.buchhaltung.service import BuchhaltungService

from .conftest import CTX, TENANT, FakeDB


def _svc(db: FakeDB) -> KontenplanService:
    return KontenplanService(db)  # type: ignore[arg-type]


def _kreis(db: FakeDB, doc_type: str = "invoice", **felder: object) -> dict:
    row = {
        "id": f"seq-{doc_type}",
        "tenant_id": TENANT,
        "doc_type": doc_type,
        "prefix": "RE-",
        "suffix": "",
        "padding": 4,
        "next_value": 1,
        "start_value": 1,
        "year": None,
        "created_at": None,
        "updated_at": None,
        **felder,
    }
    db.tables["number_sequences"].rows.append(row)
    return row


def test_format_zerlegen_und_vorschau(db: FakeDB) -> None:
    _kreis(db)
    res = _svc(db).update_number_sequence(
        CTX, "Rechnung", NumberSequenceUpdate(format="R-{number:5}/26")
    )
    assert res["prefix"] == "R-"
    assert res["format"] == "R-{number:5}/26"
    assert res["nextFormatted"] == "R-00001/26"
    assert res["canEdit"] is True
    assert res["gezogen"] is False


def test_doc_type_als_kennung(db: FakeDB) -> None:
    _kreis(db, doc_type="customer", prefix="KD-")
    res = _svc(db).update_number_sequence(CTX, "customer", NumberSequenceUpdate(prefix="K-"))
    assert res["type"] == "Kunde"
    assert res["nextFormatted"] == "K-0001"


def test_unbekannter_kreis_404(db: FakeDB) -> None:
    with pytest.raises(KontenplanError) as exc:
        _svc(db).update_number_sequence(CTX, "Lottoschein", NumberSequenceUpdate(prefix="L-"))
    assert exc.value.status_code == 404


def test_format_ohne_platzhalter_422(db: FakeDB) -> None:
    _kreis(db)
    with pytest.raises(KontenplanError) as exc:
        _svc(db).update_number_sequence(CTX, "Rechnung", NumberSequenceUpdate(format="RE-2026"))
    assert exc.value.status_code == 422


def test_praefix_mit_leerzeichen_422() -> None:
    with pytest.raises(ValueError):
        NumberSequenceUpdate(prefix="RE ")


def test_startwert_ohne_ziehung_erlaubt(db: FakeDB) -> None:
    _kreis(db)
    res = _svc(db).update_number_sequence(CTX, "Rechnung", NumberSequenceUpdate(nextNumber=1000))
    assert res["nextNumber"] == 1000
    assert res["startValue"] == 1000
    assert res["nextFormatted"] == "RE-1000"
    # Und noch einmal verstellen — weiterhin keine Ziehung.
    res2 = _svc(db).update_number_sequence(CTX, "Rechnung", NumberSequenceUpdate(nextNumber=50))
    assert res2["nextNumber"] == 50


def test_startwert_nach_ziehung_409(db: FakeDB) -> None:
    """GoBD: aus dem Kreis wurden Nummern vergeben → Zähler nicht verstellbar,
    Präfix aber schon."""
    _kreis(db, next_value=8, start_value=1)
    svc = _svc(db)
    with pytest.raises(KontenplanError) as exc:
        svc.update_number_sequence(CTX, "Rechnung", NumberSequenceUpdate(nextNumber=1))
    assert exc.value.status_code == 409
    res = svc.update_number_sequence(CTX, "Rechnung", NumberSequenceUpdate(prefix="RG-"))
    assert res["nextFormatted"] == "RG-0008"
    assert res["gezogen"] is True


def test_fehlender_kreis_wird_angelegt(db: FakeDB) -> None:
    res = _svc(db).update_number_sequence(
        CTX, "Angebot", NumberSequenceUpdate(padding=3, nextNumber=100)
    )
    row = db.tables["number_sequences"].rows[0]
    assert row["doc_type"] == "quote"
    assert row["prefix"] == "AN-"
    assert row["tenant_id"] == TENANT
    assert row["start_value"] == 100
    assert res["nextFormatted"] == "AN-100"


def test_create_defaults_idempotent(db: FakeDB) -> None:
    _kreis(db)  # Rechnung existiert schon
    svc = _svc(db)
    erst = svc.create_default_sequences(CTX)
    erwartet = set(BuchhaltungService._DOC_TYPE_MAP) - {"Rechnung"}  # noqa: SLF001
    assert set(erst.angelegt) == erwartet
    assert len(erst.sequences) == len(BuchhaltungService._DOC_TYPE_MAP)  # noqa: SLF001
    zweit = svc.create_default_sequences(CTX)
    assert zweit.angelegt == []
    assert len(db.tables["number_sequences"].rows) == len(BuchhaltungService._DOC_TYPE_MAP)  # noqa: SLF001
    assert all(r["tenant_id"] == TENANT for r in db.tables["number_sequences"].rows)
