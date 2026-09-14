"""Tests des Bereichs »gobd«: Hash-Kette, Lock-Idempotenz, Entwurf → 422, Scope,
Einstellungen ohne Ersatzwert, Auto-Lauf, Export-Form, Guards."""
from __future__ import annotations

import io
import json
import zipfile
from datetime import UTC, date, datetime, timedelta

import pytest
from fastapi import FastAPI

from src.core.security import AuthContext
from src.features.buchhaltung import router as buchhaltung_router
from src.features.buchhaltung.bereiche.gobd import router as gobd_router
from src.features.buchhaltung.bereiche.gobd.schemas import (
    GobdSettingsUpdate,
    LockRequest,
    UnlockRequest,
)
from src.features.buchhaltung.bereiche.gobd.service import (
    GENESIS_HASH,
    GobdError,
    GobdService,
    audit_hash,
)

from .fake_db import FakeDb

T1, T2 = "t1", "t2"
CTX = AuthContext(user_id="u1", tenant_id=T1, role="admin")
HEUTE = datetime.now(UTC).date()


def _rechnung(**felder: object) -> dict:
    basis = {
        "id": "r1", "tenant_id": T1, "invoice_number": "RE-0001", "invoice_type": "invoice",
        "status": "finalized", "issue_date": HEUTE.isoformat(), "due_date": HEUTE.isoformat(),
        "gross_amount": "119.00", "net_amount": "100.00", "tax_amount": "19.00",
        "paid_amount": "0", "currency": "DKK", "customer_id": "k1", "is_locked": False,
        "locked_at": None, "deleted_at": None, "created_at": "2026-09-01T00:00:00+00:00",
    }
    basis.update(felder)
    return basis


def _svc(**tables: list[dict]) -> tuple[GobdService, FakeDb]:
    db = FakeDb(**tables)
    return GobdService(db), db  # type: ignore[arg-type]


# --- Hash-Kette -------------------------------------------------------------------


def test_kette_haengt_am_vorgaenger_und_verify_ist_gruen() -> None:
    svc, db = _svc()
    e1 = svc.protokollieren(T1, object_type="invoice", object_id="r1", action="lock",
                            user_id="u1", diff={"invoiceNumber": "RE-0001"})
    e2 = svc.protokollieren(T1, object_type="invoice", object_id="r2", action="lock",
                            user_id="u1", diff={"invoiceNumber": "RE-0002"})
    assert e1 and e2
    assert e1["prev_hash"] == GENESIS_HASH
    assert e2["prev_hash"] == e1["hash"]
    ergebnis = svc.verify(CTX)
    assert ergebnis.ok and ergebnis.checked == 2 and ergebnis.last_hash == e2["hash"]
    # Kette eines anderen Mandanten ist getrennt (Wurzel 3).
    assert svc.verify(AuthContext(user_id="u", tenant_id=T2, role="admin")).checked == 0
    assert len(db.rows("gobd_audit_log")) == 2


def test_verify_findet_den_ersten_bruch() -> None:
    svc, db = _svc()
    for i in range(4):
        svc.protokollieren(T1, object_type="invoice", object_id=f"r{i}", action="lock",
                           user_id="u1", diff={"n": i})
    # Manipulation am dritten Eintrag (was der DB-Trigger live verhindert).
    db.rows("gobd_audit_log")[2]["diff"] = {"n": 99}
    ergebnis = svc.verify(CTX)
    assert not ergebnis.ok
    assert ergebnis.first_break is not None
    assert ergebnis.first_break.seq == db.rows("gobd_audit_log")[2]["seq"]
    assert ergebnis.first_break.reason == "hash_mismatch"


def test_verify_findet_geloeschten_eintrag() -> None:
    svc, db = _svc()
    for i in range(3):
        svc.protokollieren(T1, object_type="invoice", object_id=f"r{i}", action="lock",
                           user_id="u1", diff={})
    del db.rows("gobd_audit_log")[1]
    ergebnis = svc.verify(CTX)
    assert not ergebnis.ok
    assert ergebnis.first_break is not None
    assert ergebnis.first_break.reason == "prev_hash_mismatch"
    assert ergebnis.checked == 2


def test_hash_ist_stabil_gegen_jsonb_roundtrip_und_sekundenkuerzung() -> None:
    zeit = datetime(2026, 9, 12, 10, 0, 0, 123000, tzinfo=UTC)
    a = audit_hash(prev_hash=GENESIS_HASH, tenant_id=T1, object_type="invoice", object_id="r1",
                   action="lock", user_id="u1", created_at=zeit, diff={"b": "1", "a": True})
    # Postgres liefert die Zeit mit gekürzten Nachkommastellen und das jsonb in anderer Ordnung.
    b = audit_hash(prev_hash=GENESIS_HASH, tenant_id=T1, object_type="invoice", object_id="r1",
                   action="lock", user_id="u1",
                   created_at=datetime.fromisoformat("2026-09-12T10:00:00.123+00:00"),
                   diff=json.loads('{"a": true, "b": "1"}'))
    assert a == b


def test_kollision_am_kopf_wird_erneut_angehaengt() -> None:
    svc, db = _svc()
    db.unique_kollisionen = 1
    e = svc.protokollieren(T1, object_type="invoice", object_id="r1", action="lock",
                           user_id="u1", diff={})
    assert e is not None and len(db.rows("gobd_audit_log")) == 1


def test_kollision_dauerhaft_gibt_409_statt_stiller_luecke() -> None:
    svc, db = _svc()
    db.unique_kollisionen = 10
    with pytest.raises(GobdError) as exc:
        svc.protokollieren(T1, object_type="invoice", object_id="r1", action="lock",
                           user_id="u1", diff={})
    assert exc.value.status_code == 409


def test_optionale_eintraege_folgen_dem_schalter_pflicht_nicht() -> None:
    svc, db = _svc(gobd_settings=[{"tenant_id": T1, "audit_log_enabled": False,
                                   "auto_lock_mode": "manual"}])
    assert svc.protokollieren(T1, object_type="export", object_id="x", action="export",
                              user_id="u1", diff={}, pflicht=False) is None
    assert svc.protokollieren(T1, object_type="invoice", object_id="r1", action="lock",
                              user_id="u1", diff={}) is not None
    assert len(db.rows("gobd_audit_log")) == 1


# --- Festschreiben -----------------------------------------------------------------


def test_lock_ist_idempotent_und_protokolliert_einmal() -> None:
    svc, db = _svc(invoices=[_rechnung()])
    erst = svc.lock_invoices(CTX, LockRequest(invoiceIds=["r1"]))
    assert erst.locked == ["r1"] and erst.already_locked == []
    row = db.rows("invoices")[0]
    assert row["is_locked"] is True and row["gobd_status"] == "locked"
    assert row["locked_by"] == "u1" and row["locked_at"]
    zweit = svc.lock_invoices(CTX, LockRequest(invoiceIds=["r1"]))
    assert zweit.locked == [] and zweit.already_locked == ["r1"]
    protokoll = db.rows("gobd_audit_log")
    assert len(protokoll) == 1
    assert protokoll[0]["action"] == "lock"
    assert protokoll[0]["diff"]["invoiceNumber"] == "RE-0001"
    assert protokoll[0]["diff"]["currency"] == "DKK"


def test_lock_entwurf_422_und_nichts_gesperrt() -> None:
    svc, db = _svc(invoices=[_rechnung(), _rechnung(id="r2", status="draft", invoice_number=None)])
    with pytest.raises(GobdError) as exc:
        svc.lock_invoices(CTX, LockRequest(invoiceIds=["r1", "r2"]))
    assert exc.value.status_code == 422
    assert all(not r["is_locked"] for r in db.rows("invoices"))
    assert db.rows("gobd_audit_log") == []


def test_lock_ohne_nummer_gilt_als_entwurf() -> None:
    svc, _ = _svc(invoices=[_rechnung(status="finalized", invoice_number=None)])
    with pytest.raises(GobdError) as exc:
        svc.lock_invoices(CTX, LockRequest(invoiceIds=["r1"]))
    assert exc.value.status_code == 422


def test_lock_fremder_tenant_404_ohne_existenz_leak() -> None:
    svc, db = _svc(invoices=[_rechnung(tenant_id=T2)])
    with pytest.raises(GobdError) as exc:
        svc.lock_invoices(CTX, LockRequest(invoiceIds=["r1"]))
    assert exc.value.status_code == 404
    assert db.rows("invoices")[0]["is_locked"] is False


def test_lock_bestandsform_document_id() -> None:
    svc, _ = _svc(invoices=[_rechnung()])
    body = LockRequest.model_validate({"companyId": "egal", "documentId": "r1", "userId": "x"})
    assert svc.lock_invoices(CTX, body).locked == ["r1"]


def test_lock_ohne_ids_422() -> None:
    with pytest.raises(ValueError):
        LockRequest(invoiceIds=[])


def test_unlock_wird_verweigert_und_protokolliert() -> None:
    svc, db = _svc(invoices=[_rechnung(is_locked=True)])
    with pytest.raises(GobdError) as exc:
        svc.deny_unlock(CTX, UnlockRequest(invoiceIds=["r1"], reason="Tippfehler"))
    assert exc.value.status_code == 403
    assert db.rows("invoices")[0]["is_locked"] is True
    assert [e["action"] for e in db.rows("gobd_audit_log")] == ["unlock_denied"]


# --- Einstellungen ------------------------------------------------------------------


def test_settings_ohne_zeile_kein_ersatzwert_fuer_die_frist() -> None:
    svc, _ = _svc()
    s = svc.get_settings(CTX)
    assert s.retention_years is None and s.configured is False
    assert s.auto_lock_mode == "manual" and s.audit_log_enabled is True


def test_settings_bestandsform_wird_umgesetzt_und_geloggt() -> None:
    svc, db = _svc()
    body = GobdSettingsUpdate.model_validate(
        {"companyId": "x", "autoLockOnSend": True, "autoLockOnExport": False,
         "lockDeadlineDays": 30, "allowStornoAfterLock": True,
         "requireApprovalForUnlock": True,
         "notificationSettings": {"lockConfirmation": True}}
    )
    s = svc.put_settings(CTX, body)
    assert s.auto_lock_mode == "on_send" and s.auto_lock_on_send is True
    assert s.lock_after_days == 30 and s.lock_deadline_days == 30
    assert s.configured is False  # Frist weiterhin nicht gesetzt
    s2 = svc.put_settings(CTX, GobdSettingsUpdate(retentionYears=5))
    assert s2.configured is True and s2.auto_lock_mode == "on_send"  # Teil-PUT löscht nichts
    aenderungen = [e for e in db.rows("gobd_audit_log") if e["action"] == "change"]
    assert len(aenderungen) == 2
    assert aenderungen[1]["diff"]["retention_years"] == {"vorher": None, "nachher": 5}


def test_settings_after_days_ohne_tage_422() -> None:
    svc, _ = _svc()
    with pytest.raises(GobdError) as exc:
        svc.put_settings(CTX, GobdSettingsUpdate(autoLockMode="after_days"))
    assert exc.value.status_code == 422


# --- Auto-Lauf ------------------------------------------------------------------------


def test_auto_lock_on_send_nimmt_nur_versendete() -> None:
    svc, db = _svc(
        gobd_settings=[{"tenant_id": T1, "auto_lock_mode": "on_send", "audit_log_enabled": True}],
        invoices=[
            _rechnung(id="a", status="sent"),
            _rechnung(id="b", status="paid"),
            _rechnung(id="c", status="finalized"),
            _rechnung(id="d", status="sent", tenant_id=T2),
            _rechnung(id="e", status="draft", invoice_number=None),
        ],
    )
    lauf = svc.run_auto_lock(CTX)
    assert lauf.mode == "on_send" and sorted(lauf.locked) == ["a", "b"]
    assert {r["id"] for r in db.rows("invoices") if r["is_locked"]} == {"a", "b"}


def test_auto_lock_after_days_respektiert_die_grenze() -> None:
    alt = (HEUTE - timedelta(days=15)).isoformat()
    svc, _ = _svc(
        gobd_settings=[{"tenant_id": T1, "auto_lock_mode": "after_days", "lock_after_days": 10}],
        invoices=[_rechnung(id="alt", issue_date=alt), _rechnung(id="neu")],
    )
    assert svc.run_auto_lock(CTX).locked == ["alt"]


def test_auto_lock_manual_tut_nichts() -> None:
    svc, _ = _svc(invoices=[_rechnung(status="sent")])
    lauf = svc.run_auto_lock(CTX)
    assert lauf.candidates == 0 and lauf.locked == []


def test_lock_nach_versand_nur_im_modus_on_send() -> None:
    svc, db = _svc(invoices=[_rechnung(status="sent")])
    assert svc.lock_nach_versand(T1, user_id="u1", invoice_id="r1") is False
    db.rows("gobd_settings").append({"tenant_id": T1, "auto_lock_mode": "on_send"})
    assert svc.lock_nach_versand(T1, user_id="u1", invoice_id="r1") is True
    assert db.rows("gobd_audit_log")[0]["diff"]["mode"] == "on_send"


def test_alle_tenants_lauf_stoppt_nicht_beim_ersten_fehler() -> None:
    svc, _ = _svc(
        gobd_settings=[
            {"tenant_id": T1, "auto_lock_mode": "after_days", "lock_after_days": None},
            {"tenant_id": T2, "auto_lock_mode": "on_send"},
        ],
        invoices=[_rechnung(id="x", tenant_id=T2, status="sent")],
    )
    ergebnis = svc.auto_lock_alle_tenants()
    assert ergebnis == {T1: -1, T2: 1}


# --- Status / Export -----------------------------------------------------------------


def test_status_zaehlt_je_kategorie() -> None:
    svc, _ = _svc(invoices=[
        _rechnung(id="a"), _rechnung(id="b", is_locked=True, locked_at="2026-09-10T08:00:00+00:00"),
        _rechnung(id="c", status="draft", invoice_number=None),
        _rechnung(id="d", invoice_type="storno", is_locked=True,
                  locked_at="2026-09-11T08:00:00+00:00"),
        _rechnung(id="e", tenant_id=T2),
    ])
    s = svc.status(CTX)
    assert (s.drafts, s.open, s.locked, s.storno) == (1, 1, 2, 1)
    assert s.last_locked_at == datetime(2026, 9, 11, 8, tzinfo=UTC)
    assert s.configured is False


def test_export_zip_form_und_protokoll() -> None:
    svc, db = _svc(
        invoices=[_rechnung(), _rechnung(id="r2", status="draft", invoice_number=None),
                  _rechnung(id="r3", tenant_id=T2)],
        invoice_line_items=[{"id": "p1", "invoice_id": "r1", "position": 1, "description": "Nacht",
                             "quantity": "2", "unit_price": "50.00", "tax_rate": "19",
                             "discount_percent": "0", "net_amount": "100.00",
                             "tax_amount": "19.00", "gross_amount": "119.00"}],
        customers=[{"id": "k1", "tenant_id": T1, "name": "Gast A/S", "customer_number": "K-1",
                    "vat_id": "DK123"}],
        tenant_billing_profile=[{"tenant_id": T1, "legal_name": "Nordlicht ApS",
                                 "company_city": "Aarhus", "company_country": "DK"}],
    )
    daten, name = svc.export_zip(CTX, HEUTE - timedelta(days=1), HEUTE)
    assert name.startswith("gobd-export_") and name.endswith(".zip")
    with zipfile.ZipFile(io.BytesIO(daten)) as zf:
        assert set(zf.namelist()) == {"invoices.csv", "invoice_line_items.csv",
                                      "gobd_audit_log.csv", "index.xml"}
        rechnungen = zf.read("invoices.csv").decode("utf-8").splitlines()
        # Kopf + EINE ausgestellte Rechnung (kein Entwurf, kein fremder Mandant)
        assert len(rechnungen) == 2
        assert "RE-0001" in rechnungen[1] and "Gast A/S" in rechnungen[1]
        assert "119.00" in rechnungen[1]
        positionen = zf.read("invoice_line_items.csv").decode("utf-8").splitlines()
        assert len(positionen) == 2 and "2.000" in positionen[1]
        index = zf.read("index.xml").decode("utf-8")
        assert "gdpdu-01-09-2004.dtd" in index and "Nordlicht ApS" in index
        assert index.count("<Table>") == 3 and "<Accuracy>2</Accuracy>" in index
    eintrag = db.rows("gobd_audit_log")[-1]
    assert eintrag["action"] == "export" and eintrag["diff"]["invoices"] == 1
    assert len(eintrag["diff"]["sha256"]) == 64


@pytest.mark.parametrize(
    ("von", "bis", "code"),
    [
        (date(2026, 1, 1), date(2027, 1, 3), 422),  # > 366 Tage
        (date(2026, 2, 1), date(2026, 1, 1), 422),  # bis vor von
    ],
)
def test_export_zeitraum_grenzen(von: date, bis: date, code: int) -> None:
    svc, _ = _svc()
    with pytest.raises(GobdError) as exc:
        svc.export_zip(CTX, von, bis)
    assert exc.value.status_code == code


def test_audit_liste_filter_und_zeitraum_cap() -> None:
    svc, _ = _svc()
    svc.protokollieren(T1, object_type="invoice", object_id="r1", action="lock",
                       user_id="u1", diff={})
    svc.protokollieren(T1, object_type="export", object_id="x", action="export",
                       user_id="u1", diff={})
    assert [e.action for e in svc.list_audit(CTX, action="lock")] == ["lock"]
    assert len(svc.list_audit(CTX, object_type="invoice", object_id="r1")) == 1
    with pytest.raises(GobdError) as exc:
        svc.list_audit(CTX, von=date(2025, 1, 1), bis=date(2026, 12, 31))
    assert exc.value.status_code == 422
    with pytest.raises(GobdError):
        svc.list_audit(CTX, action="loeschen")


def test_ohne_tenant_403() -> None:
    svc, _ = _svc()
    with pytest.raises(GobdError) as exc:
        svc.status(AuthContext(user_id="u", tenant_id=None, role="admin"))
    assert exc.value.status_code == 403


# --- Guards ---------------------------------------------------------------------------


def _guard_namen(route) -> set[str]:  # noqa: ANN001
    namen: set[str] = set()

    def _lauf(dep) -> None:  # noqa: ANN001
        for sub in dep.dependencies:
            namen.add(getattr(sub.call, "__name__", str(sub.call)))
            _lauf(sub)

    _lauf(route.dependant)
    return namen


def test_jede_gobd_route_traegt_rollen_und_modul_guard() -> None:
    routen = [r for r in gobd_router.router.routes if hasattr(r, "dependant")]
    assert len(routen) >= 12
    for r in routen:
        kette = _guard_namen(r)
        assert "_require_agency_finance_with_modul" in kette, r.path
        assert "_require_agency_finance" in kette, r.path


def test_gobd_ist_im_buchhaltungs_router_eingehaengt() -> None:
    """FastAPI ≥ 0.137 hängt eingebundene Router als `_IncludedRouter` ein und
    löst die Pfade erst in der App auf — deshalb über die OpenAPI der App prüfen."""
    eingehaengt = [
        getattr(r, "original_router", None) for r in buchhaltung_router.router.routes
    ]
    assert gobd_router.router in eingehaengt
    app = FastAPI()
    app.include_router(buchhaltung_router.router)
    pfade = set(app.openapi()["paths"])
    assert "/buchhaltung/gobd/lock" in pfade
    assert "/buchhaltung/gobd/settings/{company_id}" in pfade
    assert "/buchhaltung/gobd/export" in pfade
    assert "/buchhaltung/gobd/audit-log/verify" in pfade
