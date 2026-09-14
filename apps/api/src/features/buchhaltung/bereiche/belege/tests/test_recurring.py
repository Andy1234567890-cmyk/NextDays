"""Wiederkehrende Rechnungen: Vorlage, Lauf, Idempotenz, Pause, Ende."""

from datetime import date

import pytest

from src.features.buchhaltung.bereiche.belege.schemas import RecurringCreate, RecurringUpdate
from src.features.buchhaltung.bereiche.belege.service import BelegeError, naechster_termin

from .conftest import CTX, positionen, rechnung
from .fake_db import FakeDB


def _vorlage(db: FakeDB, svc, *, start: date, ende: date | None = None, intervall: str = "monthly"):
    db.tables["invoices"] = [rechnung("re1")]
    db.tables["invoice_line_items"] = positionen("re1")
    v = svc.create_recurring(
        CTX, "re1", RecurringCreate(interval=intervall, startAt=start, endAt=ende)
    )
    return v


def test_vorlage_aus_rechnung(svc, db: FakeDB) -> None:
    v = _vorlage(db, svc, start=date(2026, 9, 1))
    assert v.type == "recurring" and v.is_recurring_template
    assert v.recurring_status == "active" and v.recurring_next_at == date(2026, 9, 1)
    assert v.number is None and v.source_document_id == "re1"
    assert len(v.items) == 2
    # Zweimal → dieselbe Vorlage (Unique je Quelle + Art).
    again = svc.create_recurring(
        CTX, "re1", RecurringCreate(interval="monthly", startAt=date(2026, 9, 1))
    )
    assert again.id == v.id


def test_lauf_erzeugt_entwurf_und_ist_idempotent(svc, db: FakeDB) -> None:
    v = _vorlage(db, svc, start=date(2026, 9, 12))
    erster = svc.run_recurring(CTX)
    assert (erster.created, erster.skipped, erster.completed) == (1, 0, 0)
    neu = next(r for r in db.rows("invoices") if r["id"] == erster.created_ids[0])
    assert neu["invoice_type"] == "invoice" and neu["status"] == "draft"
    assert neu.get("invoice_number") is None
    assert neu["recurring_template_id"] == v.id
    assert neu["recurring_period_start"] == "2026-09-12"
    assert neu["gross_amount"] == "125.00"
    vorlage = next(r for r in db.rows("invoices") if r["id"] == v.id)
    assert vorlage["recurring_next_at"] == "2026-10-12"

    # Zweiter Lauf am selben Tag: Termin liegt in der Zukunft → nichts fällig.
    zweiter = svc.run_recurring(CTX)
    assert (zweiter.created, zweiter.skipped) == (0, 0)

    # Termin künstlich zurückgedreht (Retry nach Teilfehler): Unique fängt es.
    vorlage["recurring_next_at"] = "2026-09-12"
    dritter = svc.run_recurring(CTX)
    assert (dritter.created, dritter.skipped) == (0, 1)
    assert len([r for r in db.rows("invoices") if r.get("recurring_template_id")]) == 1


def test_lauf_holt_perioden_nach(svc, db: FakeDB) -> None:
    """Heute ist der 12.09.: fällig sind 15.06., 15.07., 15.08. — drei Entwürfe,
    der nächste Termin steht danach auf dem 15.09."""
    v = _vorlage(db, svc, start=date(2026, 6, 15))
    res = svc.run_recurring(CTX)
    assert res.created == 3
    perioden = sorted(
        r["recurring_period_start"] for r in db.rows("invoices") if r.get("recurring_template_id")
    )
    assert perioden == ["2026-06-15", "2026-07-15", "2026-08-15"]
    vorlage = next(r for r in db.rows("invoices") if r["id"] == v.id)
    assert vorlage["recurring_next_at"] == "2026-09-15"


def test_ende_schliesst_vorlage_ab(svc, db: FakeDB) -> None:
    v = _vorlage(db, svc, start=date(2026, 7, 1), ende=date(2026, 8, 15))
    res = svc.run_recurring(CTX)
    assert (res.created, res.completed) == (2, 1)  # 01.07., 01.08.; 01.09. > Ende
    vorlage = next(r for r in db.rows("invoices") if r["id"] == v.id)
    assert vorlage["recurring_status"] == "completed"


def test_pausierte_vorlage_laeuft_nicht(svc, db: FakeDB) -> None:
    v = _vorlage(db, svc, start=date(2026, 9, 1))
    svc.update_recurring(CTX, v.id, RecurringUpdate(status="paused"))
    assert svc.run_recurring(CTX).created == 0
    svc.update_recurring(CTX, v.id, RecurringUpdate(status="active"))
    assert svc.run_recurring(CTX).created == 1


def test_patch_nur_auf_vorlagen_und_mit_pruefung(svc, db: FakeDB) -> None:
    db.tables["invoices"] = [rechnung("re1")]
    with pytest.raises(BelegeError) as exc:
        svc.update_recurring(CTX, "re1", RecurringUpdate(status="paused"))
    assert exc.value.status_code == 409
    v = _vorlage(db, svc, start=date(2026, 9, 1))
    with pytest.raises(BelegeError) as exc:
        svc.update_recurring(CTX, v.id, RecurringUpdate())
    assert exc.value.status_code == 422
    with pytest.raises(BelegeError) as exc:
        svc.update_recurring(
            CTX, v.id, RecurringUpdate(nextAt=date(2026, 10, 1), endAt=date(2026, 9, 15))
        )
    assert exc.value.status_code == 422
    geaendert = svc.update_recurring(
        CTX, v.id, RecurringUpdate(interval="quarterly", nextAt=date(2026, 12, 1))
    )
    assert geaendert.recurring_interval == "quarterly" and geaendert.recurring_next_at == date(
        2026, 12, 1
    )


def test_vorlage_nur_aus_rechnung_und_ende_nach_beginn(svc, db: FakeDB) -> None:
    db.tables["invoices"] = [rechnung("ls1", typ="delivery_note"), rechnung("re1")]
    with pytest.raises(BelegeError) as exc:
        svc.create_recurring(
            CTX, "ls1", RecurringCreate(interval="monthly", startAt=date(2026, 9, 1))
        )
    assert exc.value.status_code == 422
    with pytest.raises(BelegeError) as exc:
        svc.create_recurring(
            CTX,
            "re1",
            RecurringCreate(interval="monthly", startAt=date(2026, 9, 1), endAt=date(2026, 8, 1)),
        )
    assert exc.value.status_code == 422


@pytest.mark.parametrize(
    ("start", "intervall", "erwartet"),
    [
        (date(2026, 1, 31), "monthly", date(2026, 2, 28)),
        (date(2026, 11, 30), "quarterly", date(2027, 2, 28)),
        (date(2024, 2, 29), "yearly", date(2025, 2, 28)),
        (date(2026, 9, 12), "weekly", date(2026, 9, 19)),
    ],
)
def test_naechster_termin_klemmt_monatsende(start: date, intervall: str, erwartet: date) -> None:
    assert naechster_termin(start, intervall) == erwartet
