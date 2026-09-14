"""Tests des Bereichs »mahnwesen« — Fake-DB, keine Netzwerkanbindung.

Abgesichert: Stufenlogik (n+1 nur nach n, höchstens 3), Gebühr/Zinsen aus den
Einstellungen (fehlend → 422), offener Betrag aus der Rechnung, Statusübergänge,
Tenant-Scope (fremd → 404), PDF-Prüfung beim Versand (Base64, Magic-Bytes,
Deckel), Claim-Guard beim Versand, Datumsdeckel und der Tages-Lauf.
"""
from __future__ import annotations

import base64
from datetime import date
from decimal import Decimal
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from src.core.mail import MailError
from src.core.security import AuthContext
from src.features.buchhaltung.bereiche.mahnwesen import service as modul
from src.features.buchhaltung.bereiche.mahnwesen.schemas import (
    ReminderCreate,
    ReminderSend,
    ReminderSettingsUpdate,
    ReminderUpdate,
)
from src.features.buchhaltung.bereiche.mahnwesen.service import (
    MahnwesenError,
    MahnwesenService,
    ueberfaellig_markieren,
)

TENANT = "t1"
FREMD = "t2"
CTX = AuthContext(user_id="u1", tenant_id=TENANT, role="admin")
HEUTE = date(2026, 9, 12)
STEMPEL = "2026-09-12T00:00:00Z"


# --- Fake-DB -----------------------------------------------------------------


class _Chain:
    def __init__(self, table: _Table) -> None:
        self._t = table
        self._filter: list[tuple[str, str, object]] = []
        self._op: str | None = None
        self._payload: dict = {}
        self._limit: int | None = None
        self._conflict: str | None = None

    def select(self, *_a: object, **_k: object) -> _Chain:
        return self

    def order(self, *_a: object, **_k: object) -> _Chain:
        return self

    def limit(self, n: int) -> _Chain:
        self._limit = n
        return self

    def eq(self, f: str, v: object) -> _Chain:
        self._filter.append(("eq", f, v))
        return self

    def in_(self, f: str, v: list) -> _Chain:
        self._filter.append(("in", f, list(v)))
        return self

    def lt(self, f: str, v: object) -> _Chain:
        self._filter.append(("lt", f, v))
        return self

    def is_(self, f: str, v: object) -> _Chain:
        self._filter.append(("is", f, v))
        return self

    def insert(self, payload: dict) -> _Chain:
        self._op, self._payload = "insert", payload
        return self

    def update(self, payload: dict) -> _Chain:
        self._op, self._payload = "update", payload
        return self

    def delete(self) -> _Chain:
        self._op = "delete"
        return self

    def upsert(self, payload: dict, on_conflict: str = "id") -> _Chain:
        self._op, self._payload, self._conflict = "upsert", payload, on_conflict
        return self

    def _passt(self, r: dict) -> bool:
        for art, f, v in self._filter:
            w = r.get(f)
            if art == "eq" and w != v:
                return False
            if art == "in" and w not in v:
                return False
            if art == "lt" and not (w is not None and str(w) < str(v)):
                return False
            if art == "is" and v == "null" and w is not None:
                return False
        return True

    def execute(self) -> SimpleNamespace:
        t = self._t
        if self._op == "insert":
            neu = {**self._payload, "id": f"{t.name}-{len(t.rows) + 1}",
                   "created_at": STEMPEL, "updated_at": STEMPEL}
            neu.setdefault("template_settings", {})
            t.rows.append(neu)
            t.inserts.append(self._payload)
            return SimpleNamespace(data=[neu])
        if self._op == "upsert":
            for r in t.rows:
                if r.get(self._conflict) == self._payload.get(self._conflict):
                    r.update(self._payload)
                    return SimpleNamespace(data=[r])
            t.rows.append({**self._payload, "updated_at": STEMPEL})
            return SimpleNamespace(data=[t.rows[-1]])
        treffer = [r for r in t.rows if self._passt(r)]
        if self._op == "update":
            for r in treffer:
                r.update(self._payload)
            t.updates.append((self._payload, len(treffer)))
            return SimpleNamespace(data=treffer)
        if self._op == "delete":
            t.rows[:] = [r for r in t.rows if r not in treffer]
            return SimpleNamespace(data=treffer)
        if self._limit is not None:
            treffer = treffer[: self._limit]
        return SimpleNamespace(data=treffer)


class _Table:
    def __init__(self, name: str, rows: list[dict]) -> None:
        self.name, self.rows = name, rows
        self.inserts: list[dict] = []
        self.updates: list[tuple[dict, int]] = []


class _DB:
    def __init__(self, **tables: list[dict]) -> None:
        self.tables = {n: _Table(n, r) for n, r in tables.items()}
        self.nummer = 0

    def table(self, name: str) -> _Chain:
        return _Chain(self.tables.setdefault(name, _Table(name, [])))

    def rpc(self, name: str, params: dict) -> SimpleNamespace:
        assert name == "next_document_number" and params["p_doc_type"] == "reminder"
        self.nummer += 1
        return SimpleNamespace(execute=lambda: SimpleNamespace(
            data=[{"formatted_number": f"{params['p_prefix']}{self.nummer:04d}"}]))


# --- Bausteine ---------------------------------------------------------------


def _settings(**extra: object) -> dict:
    z = {"tenant_id": TENANT, "interest_rate": "10", "auto_mark_overdue": True,
         "updated_at": STEMPEL}
    for lvl, (tage, geb) in enumerate(((7, "5"), (14, "10"), (21, "15")), start=1):
        z.update({f"level{lvl}_days": tage, f"level{lvl}_fee": geb,
                  f"level{lvl}_title": f"{lvl}. Mahnung", f"level{lvl}_text": f"Text {lvl}"})
    z.update(extra)
    return z


def _rechnung(**extra: object) -> dict:
    z = {"id": "inv-1", "tenant_id": TENANT, "invoice_number": "RE-0001", "customer_id": "c1",
         "status": "sent", "issue_date": "2026-07-01", "due_date": "2026-08-01",
         "gross_amount": "100.00", "paid_amount": "20.00", "currency": "DKK",
         "invoice_type": "invoice", "deleted_at": None}
    z.update(extra)
    return z


def _mahnung(**extra: object) -> dict:
    z = {"id": "rem-1", "tenant_id": TENANT, "reminder_number": "MA-0001", "invoice_id": "inv-1",
         "customer_id": "c1", "level": 1, "reminder_date": "2026-08-31", "due_date": "2026-09-07",
         "fee": "5.00", "interest": "0.66", "interest_rate": "10.00", "amount_open": "80.00",
         "amount_total": "85.66", "currency": "DKK", "status": "draft", "sent_at": None,
         "sent_message_id": None, "text_header": "Text 1", "template_settings": {},
         "created_at": STEMPEL, "updated_at": STEMPEL}
    z.update(extra)
    return z


@pytest.fixture(autouse=True)
def _heute_fest(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(MahnwesenService, "_heute", staticmethod(lambda: HEUTE))


def _svc(db: _DB, versand=None) -> MahnwesenService:  # noqa: ANN001
    return MahnwesenService(db, versand=versand)  # type: ignore[arg-type]


def _pdf_b64(inhalt: bytes = b"%PDF-1.4 test") -> str:
    return base64.b64encode(inhalt).decode()


def _send(**extra: object) -> ReminderSend:
    return ReminderSend(**{"to": ["k@x.dk"], "subject": "Mahnung", "text": "Bitte zahlen",
                           "pdfBase64": _pdf_b64(), **extra})


# --- Einstellungen -----------------------------------------------------------


def test_ohne_einstellungen_ist_anlegen_422() -> None:
    svc = _svc(_DB(invoices=[_rechnung()]))
    with pytest.raises(MahnwesenError) as exc:
        svc.create_reminder(CTX, ReminderCreate(invoice_id="inv-1"))
    assert exc.value.status_code == 422


def test_halbe_einstellungen_gelten_als_nicht_eingerichtet() -> None:
    svc = _svc(_DB(reminder_settings=[_settings(level2_fee=None)]))
    assert svc.get_settings(CTX).configured is False


def test_put_settings_speichert_und_ist_vollstaendig() -> None:
    db = _DB()
    stufe = {"days": 7, "fee": "5", "title": "1. Mahnung", "text": "t"}
    body = ReminderSettingsUpdate(level1=stufe, level2=stufe, level3=stufe,
                                  interest_rate="9.12", auto_mark_overdue=False)
    antwort = _svc(db).put_settings(CTX, body)
    assert antwort.configured is True
    assert antwort.interest_rate == Decimal("9.12")
    assert db.tables["reminder_settings"].rows[0]["tenant_id"] == TENANT


# --- Stufen, Beträge -----------------------------------------------------------


def test_erste_mahnung_rechnet_offen_gebuehr_zinsen_aus_rechnung_und_settings() -> None:
    db = _DB(reminder_settings=[_settings()], invoices=[_rechnung()],
             customers=[{"id": "c1", "tenant_id": TENANT, "name": "Kunde", "email": "k@x.dk",
                         "address": {"street": "Vej", "house_number": "1", "city": "Aarhus"}}])
    m = _svc(db).create_reminder(CTX, ReminderCreate(invoice_id="inv-1",
                                                     reminder_date=date(2026, 8, 31)))
    assert m.level == 1 and m.reminder_number == "MA-0001" and m.number == "MA-0001"
    assert m.amount_open == Decimal("80.00")  # 100 − 20, NIE vom Client
    assert m.fee == Decimal("5.00")
    assert m.days_overdue == 30
    assert m.interest == Decimal("0.66")  # 80 × 10 % × 30/365
    assert m.amount_total == Decimal("85.66")
    assert m.currency == "DKK"
    assert m.due_date == date(2026, 9, 7)  # Mahndatum + 7 Tage
    assert m.text_header == "Text 1"
    assert m.customer_address == "Vej 1\nAarhus"
    assert m.status == "draft"


def test_zweite_stufe_nur_nach_erster_und_hoechstens_drei() -> None:
    db = _DB(reminder_settings=[_settings()], invoices=[_rechnung()],
             reminders=[_mahnung(status="sent")])
    svc = _svc(db)
    with pytest.raises(MahnwesenError) as exc:
        svc.create_reminder(CTX, ReminderCreate(invoice_id="inv-1", level=3))
    assert exc.value.status_code == 409
    m = svc.create_reminder(CTX, ReminderCreate(invoice_id="inv-1"))
    assert m.level == 2 and m.fee == Decimal("10.00")
    db.tables["reminders"].rows.append(_mahnung(id="rem-3", level=3, reminder_number="MA-0003"))
    with pytest.raises(MahnwesenError) as exc:
        svc.create_reminder(CTX, ReminderCreate(invoice_id="inv-1"))
    assert exc.value.status_code == 409


def test_client_gebuehr_ueberschreibt_vorgabe_aber_nie_den_betrag() -> None:
    db = _DB(reminder_settings=[_settings()], invoices=[_rechnung()])
    m = _svc(db).create_reminder(CTX, ReminderCreate(invoice_id="inv-1", fee="2.50",
                                                     interest_rate="0"))
    assert m.fee == Decimal("2.50") and m.interest == Decimal("0.00")
    assert m.amount_open == Decimal("80.00")


@pytest.mark.parametrize(
    ("rechnung", "code"),
    [
        pytest.param(_rechnung(paid_amount="100.00"), 422, id="bezahlt"),
        pytest.param(_rechnung(status="draft"), 422, id="entwurf"),
        pytest.param(_rechnung(due_date="2026-12-01"), 422, id="nicht_faellig"),
        pytest.param(_rechnung(currency=None), 422, id="ohne_waehrung"),
        pytest.param(_rechnung(invoice_type="credit_note"), 422, id="gutschrift"),
        pytest.param(_rechnung(tenant_id=FREMD), 404, id="fremder_tenant"),
        pytest.param(_rechnung(deleted_at=STEMPEL), 404, id="geloescht"),
    ],
)
def test_rechnung_nicht_mahnbar(rechnung: dict, code: int) -> None:
    svc = _svc(_DB(reminder_settings=[_settings()], invoices=[rechnung]))
    with pytest.raises(MahnwesenError) as exc:
        svc.create_reminder(CTX, ReminderCreate(invoice_id="inv-1"))
    assert exc.value.status_code == code


def test_datumsdeckel() -> None:
    svc = _svc(_DB(reminder_settings=[_settings()], invoices=[_rechnung()]))
    for body in (
        ReminderCreate(invoice_id="inv-1", reminder_date=date(2026, 9, 13)),  # Zukunft
        ReminderCreate(invoice_id="inv-1", reminder_date=date(2024, 1, 1)),  # > 366 Tage
        ReminderCreate(invoice_id="inv-1", due_date=date(2028, 1, 1)),  # Frist > 365
        ReminderCreate(invoice_id="inv-1", due_date=date(2026, 9, 1)),  # Frist vor Mahndatum
    ):
        with pytest.raises(MahnwesenError) as exc:
            svc.create_reminder(CTX, body)
        assert exc.value.status_code == 422


# --- Überfällige Rechnungen ----------------------------------------------------


def test_overdue_liste_mit_letzter_stufe() -> None:
    db = _DB(invoices=[_rechnung(), _rechnung(id="inv-2", paid_amount="100.00"),
                       _rechnung(id="inv-3", tenant_id=FREMD)],
             reminders=[_mahnung(level=3, status="sent")])
    liste = _svc(db).list_overdue(CTX)
    assert [r.id for r in liste] == ["inv-1"]
    assert liste[0].days_overdue == 42
    assert liste[0].amount_open == Decimal("80.00")
    assert liste[0].last_level == 3 and liste[0].next_level is None


# --- Status, Scope, Ändern, Löschen -------------------------------------------


def test_statusuebergaenge() -> None:
    db = _DB(reminders=[_mahnung()], invoices=[_rechnung()])
    svc = _svc(db)
    with pytest.raises(MahnwesenError) as exc:
        svc.set_status(CTX, "rem-1", "paid")
    assert exc.value.status_code == 409
    m = svc.set_status(CTX, "rem-1", "sent")
    assert m.status == "sent" and m.sent_at is not None
    assert svc.set_status(CTX, "rem-1", "sent").status == "sent"  # idempotent
    assert svc.set_status(CTX, "rem-1", "paid").status == "paid"
    with pytest.raises(MahnwesenError):
        svc.set_status(CTX, "rem-1", "cancelled")


def test_fremde_mahnung_ist_404() -> None:
    svc = _svc(_DB(reminders=[_mahnung(tenant_id=FREMD)]))
    for aufruf in (
        lambda: svc.get_reminder(CTX, "rem-1"),
        lambda: svc.set_status(CTX, "rem-1", "sent"),
        lambda: svc.delete_reminder(CTX, "rem-1"),
        lambda: svc.update_reminder(CTX, "rem-1", ReminderUpdate(notes="x")),
        lambda: svc.send_reminder(CTX, "rem-1", _send()),
    ):
        with pytest.raises(MahnwesenError) as exc:
            aufruf()
        assert exc.value.status_code == 404


def test_liste_filtert_tenant_und_deckelt_limit() -> None:
    db = _DB(reminders=[_mahnung(), _mahnung(id="rem-2", tenant_id=FREMD)], invoices=[_rechnung()])
    svc = _svc(db)
    assert [m.id for m in svc.list_reminders(CTX)] == ["rem-1"]
    with pytest.raises(MahnwesenError) as exc:
        svc.list_reminders(CTX, limit=501)
    assert exc.value.status_code == 422
    with pytest.raises(MahnwesenError):
        svc.list_reminders(CTX, status="egal")


def test_versendete_mahnung_inhaltlich_unveraenderbar_darstellung_erlaubt() -> None:
    db = _DB(reminders=[_mahnung(status="sent")], invoices=[_rechnung()])
    svc = _svc(db)
    with pytest.raises(MahnwesenError) as exc:
        svc.update_reminder(CTX, "rem-1", ReminderUpdate(notes="neu"))
    assert exc.value.status_code == 409
    m = svc.update_reminder(CTX, "rem-1", ReminderUpdate(**{"templateId": "modern",
                                                             "color": "#123456"}))
    assert m.template_settings == {"template_id": "modern", "color": "#123456"}


def test_update_schema_deckel() -> None:
    with pytest.raises(ValidationError):
        ReminderUpdate(**{"logoUrl": "javascript:alert(1)"})
    with pytest.raises(ValidationError):
        ReminderUpdate(**{"documentSettings": {"x": "a" * 70_000}})
    assert ReminderUpdate(**{"logoUrl": "https://x/y.png"}).logo_url == "https://x/y.png"


def test_loeschen_nur_entwurf() -> None:
    db = _DB(reminders=[_mahnung(), _mahnung(id="rem-2", status="sent")])
    svc = _svc(db)
    with pytest.raises(MahnwesenError) as exc:
        svc.delete_reminder(CTX, "rem-2")
    assert exc.value.status_code == 409
    svc.delete_reminder(CTX, "rem-1")
    assert [r["id"] for r in db.tables["reminders"].rows] == ["rem-2"]


# --- Versand -------------------------------------------------------------------


def test_versand_prueft_pdf() -> None:
    svc = _svc(_DB(reminders=[_mahnung()]), versand=lambda *a, **k: "mid")
    with pytest.raises(MahnwesenError) as exc:
        svc.send_reminder(CTX, "rem-1", _send(pdfBase64=_pdf_b64(b"MZ kein pdf")))
    assert exc.value.status_code == 422
    with pytest.raises(MahnwesenError) as exc:
        svc.send_reminder(CTX, "rem-1", _send(pdfBase64="%%%nicht-base64"))
    assert exc.value.status_code == 422
    with pytest.raises(MahnwesenError) as exc:
        svc.send_reminder(CTX, "rem-1", _send(pdfBase64="A" * (modul._PDF_MAX_BASE64_ZEICHEN + 8)))
    assert exc.value.status_code == 413


def test_versand_erfolgreich_und_zweiter_aufruf_409() -> None:
    aufrufe: list[dict] = []

    def versand(_ctx, **k):  # noqa: ANN001, ANN202
        aufrufe.append(k)
        return "msg-1"

    db = _DB(reminders=[_mahnung()], invoices=[_rechnung()])
    svc = _svc(db, versand=versand)
    res = svc.send_reminder(CTX, "rem-1", _send())
    assert res.status == "sent" and res.sent_message_id == "msg-1"
    assert len(aufrufe) == 1
    assert aufrufe[0]["an"] == ["k@x.dk"]
    name, daten, mime = aufrufe[0]["anhaenge"][0]
    assert name == "MA-0001.pdf" and daten.startswith(b"%PDF-") and mime == "application/pdf"
    zeile = db.tables["reminders"].rows[0]
    assert zeile["status"] == "sent" and zeile["sent_message_id"] == "msg-1"
    with pytest.raises(MahnwesenError) as exc:
        svc.send_reminder(CTX, "rem-1", _send())
    assert exc.value.status_code == 409
    assert len(aufrufe) == 1


def test_versandfehler_gibt_claim_zurueck() -> None:
    def versand(_ctx, **_k):  # noqa: ANN001, ANN202
        raise MailError("SMTP tot", status_code=502)

    db = _DB(reminders=[_mahnung()])
    with pytest.raises(MahnwesenError) as exc:
        _svc(db, versand=versand).send_reminder(CTX, "rem-1", _send())
    assert exc.value.status_code == 502
    zeile = db.tables["reminders"].rows[0]
    assert zeile["status"] == "draft" and zeile["sent_at"] is None


def test_versand_empfaenger_muessen_mailadressen_sein() -> None:
    with pytest.raises(ValidationError):
        _send(to=["kein-mail"])


# --- Tages-Lauf ----------------------------------------------------------------


def test_ueberfaellig_markieren_nur_mit_schalter_und_nur_sent() -> None:
    db = _DB(
        reminder_settings=[_settings(), _settings(tenant_id=FREMD, auto_mark_overdue=False)],
        invoices=[
            _rechnung(),                                        # sent, fällig → overdue
            _rechnung(id="inv-2", status="finalized"),          # bleibt
            _rechnung(id="inv-3", paid_amount="100.00"),        # bezahlt → bleibt
            _rechnung(id="inv-4", due_date="2026-12-01"),       # nicht fällig
            _rechnung(id="inv-5", tenant_id=FREMD),             # Schalter aus
        ],
    )
    res = ueberfaellig_markieren(db, HEUTE)  # type: ignore[arg-type]
    assert res.tenants_geprueft == 1 and res.rechnungen_markiert == 1
    status = {r["id"]: r["status"] for r in db.tables["invoices"].rows}
    assert status == {"inv-1": "overdue", "inv-2": "finalized", "inv-3": "sent",
                      "inv-4": "sent", "inv-5": "sent"}
    # Idempotent: der zweite Lauf findet nichts mehr.
    assert ueberfaellig_markieren(db, HEUTE).rechnungen_markiert == 0  # type: ignore[arg-type]
