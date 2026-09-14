"""Tests des Bereichs »ausgaben« (12.09.2026).

Abgesichert ist, was im alten Werkzeug falsch oder gar nicht da war:
  * der XRechnung-Body (`vendor`, `amount`, `vatRate`, `date`) kommt an;
  * Beträge rechnet der Server, Widersprüche → 422, Steuersatz Pflicht;
  * Währung aus Body → Tenant → 422 (kein EUR);
  * Zeitraum > 366 Tage → 422; fremde IDs → 404 (load_scoped);
  * GoBD-Sperre: Fachdaten 409, Löschen 409, Zahlstatus bleibt änderbar;
  * Beleg: Magic-Bytes (HEIC ja, HTML nein), 15-MB-Deckel, privater Bucket;
  * Wiederholungslauf: Kopien je Termin, 23505 = übersprungen, Vorlage rückt vor;
  * Belegausleser: ohne registrierten Funktionsnamen 503, mit Stub geparst.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from typing import Any

import pytest
from postgrest.exceptions import APIError

from src.core.ki import KiAntwort
from src.core.security import AuthContext
from src.features.buchhaltung.bereiche.ausgaben import service as svc_mod
from src.features.buchhaltung.bereiche.ausgaben.schemas import (
    ExpenseCategoryCreate,
    ExpenseCreate,
    ExpenseUpdate,
)
from src.features.buchhaltung.bereiche.ausgaben.service import (
    AusgabenError,
    AusgabenService,
    _dateiart,
    _naechster_termin,
    betraege_rechnen,
)

TENANT = "t1"
CTX = AuthContext(user_id="u1", tenant_id=TENANT, role="admin")
HEUTE = date(2026, 9, 12)


# --- Fake-DB -------------------------------------------------------------------


class _Chain:
    def __init__(self, db: _DB, name: str) -> None:
        self._db, self._name = db, name
        self._filter: list[tuple[str, str, object]] = []
        self._op: str | None = None
        self._payload: Any = None
        self._limit: int | None = None

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

    def gte(self, f: str, v: object) -> _Chain:
        self._filter.append(("gte", f, v))
        return self

    def lte(self, f: str, v: object) -> _Chain:
        self._filter.append(("lte", f, v))
        return self

    def insert(self, p: dict) -> _Chain:
        self._op, self._payload = "insert", p
        return self

    def update(self, p: dict) -> _Chain:
        self._op, self._payload = "update", p
        return self

    def delete(self) -> _Chain:
        self._op = "delete"
        return self

    def _passt(self, row: dict) -> bool:
        for op, f, v in self._filter:
            w = row.get(f)
            if op == "eq" and w != v:
                return False
            if op == "gte" and (w is None or str(w) < str(v)):
                return False
            if op == "lte" and (w is None or str(w) > str(v)):
                return False
        return True

    def execute(self) -> SimpleNamespace:
        rows = self._db.tables.setdefault(self._name, [])
        if self._op == "insert":
            neu = {**self._payload}
            if self._name == "expenses" and neu.get("template_id"):
                schluessel = (neu["tenant_id"], neu["template_id"], neu["expense_date"])
                if any(
                    (r["tenant_id"], r.get("template_id"), r["expense_date"]) == schluessel
                    for r in rows
                ):
                    raise APIError({"code": "23505", "message": "dup", "hint": "", "details": ""})
            if self._name == "expense_categories" and any(
                r["tenant_id"] == neu["tenant_id"] and r["name"].lower() == neu["name"].lower()
                for r in rows
            ):
                raise APIError({"code": "23505", "message": "dup", "hint": "", "details": ""})
            self._db.zaehler += 1
            neu.setdefault("id", f"{self._name}-{self._db.zaehler}")
            neu.setdefault("created_at", "2026-09-12T00:00:00Z")
            neu.setdefault("updated_at", "2026-09-12T00:00:00Z")
            rows.append(neu)
            self._db.protokoll.append(("insert", self._name, neu))
            return SimpleNamespace(data=[neu])
        if self._op == "update":
            treffer = [r for r in rows if self._passt(r)]
            for r in treffer:
                r.update(self._payload)
            self._db.protokoll.append(("update", self._name, self._payload))
            return SimpleNamespace(data=treffer)
        if self._op == "delete":
            rest = [r for r in rows if not self._passt(r)]
            self._db.tables[self._name] = rest
            self._db.protokoll.append(("delete", self._name, None))
            return SimpleNamespace(data=[])
        treffer = [r for r in rows if self._passt(r)]
        if self._limit is not None:
            treffer = treffer[: self._limit]
        return SimpleNamespace(data=treffer)


class _Speicher:
    def __init__(self, protokoll: list) -> None:
        self._p = protokoll

    def upload(self, pfad: str, inhalt: bytes, kopf: dict) -> None:
        self._p.append(("upload", pfad, kopf["content-type"], len(inhalt)))

    def remove(self, pfade: list[str]) -> None:
        self._p.append(("remove", pfade))

    def create_signed_url(self, pfad: str, ttl: int) -> dict:
        self._p.append(("signed", pfad, ttl))
        return {"signedURL": f"https://example.test/{pfad}?sig=x"}


class _DB:
    def __init__(self, **tables: list[dict]) -> None:
        self.tables: dict[str, list[dict]] = dict(tables)
        self.protokoll: list[tuple] = []
        self.zaehler = 0
        self.storage = SimpleNamespace(from_=lambda _b: _Speicher(self.protokoll))

    def table(self, name: str) -> _Chain:
        return _Chain(self, name)


def _svc(**tables: list[dict]) -> tuple[AusgabenService, _DB]:
    db = _DB(**tables)
    return AusgabenService(db), db  # type: ignore[arg-type]


def _tenant_rows(currency: str | None = "DKK") -> list[dict]:
    return [{"id": TENANT, "currency": currency}]


def _ausgabe(**extra: object) -> dict:
    zeile = {
        "id": "e1", "tenant_id": TENANT, "title": "Strom", "expense_date": "2026-09-01",
        "net_amount": "100.00", "tax_amount": "25.00", "gross_amount": "125.00",
        "tax_rate": "25.00", "currency": "DKK", "payment_status": "open",
        "is_recurring": False, "is_locked": False, "source": "manual",
        "created_at": "2026-09-01T00:00:00Z", "updated_at": "2026-09-01T00:00:00Z",
    }
    zeile.update(extra)
    return zeile


# --- Schema: XRechnung-Body ------------------------------------------------------

XRECHNUNG_BODY = {
    "companyId": "firma-alt",
    "title": "Rechnung R-77",
    "amount": 119.0,
    "category": "Sonstiges",
    "date": "2026-08-30",
    "dueDate": "2026-09-13",
    "paymentTerms": "Zahlbar sofort",
    "description": "E-Rechnung Import von Lieferant GmbH",
    "vendor": "Lieferant GmbH",
    "invoiceNumber": "R-77",
    "vatAmount": 19.0,
    "netAmount": 100.0,
    "vatRate": 19,
    "taxDeductible": True,
    "companyName": "Lieferant GmbH",
    "companyAddress": "Str 1\n12345 Ort",
    "companyVatNumber": "DE123",
    "contactEmail": "info@lieferant.de",
    "contactPhone": "",
    "notes": "Importiert",
}


def test_xrechnung_body_kommt_an() -> None:
    m = ExpenseCreate(**XRECHNUNG_BODY)
    assert m.supplier_name == "Lieferant GmbH"
    assert m.receipt_number == "R-77"
    assert m.expense_date == date(2026, 8, 30)
    assert m.gross_amount == Decimal("119.0") and m.net_amount == Decimal("100.0")
    assert m.tax_rate == Decimal("19")
    assert m.supplier_vat_id == "DE123" and m.supplier_email == "info@lieferant.de"
    assert m.category == "Sonstiges"


def test_steuersatz_ist_pflicht() -> None:
    body = {k: v for k, v in XRECHNUNG_BODY.items() if k != "vatRate"}
    with pytest.raises(ValueError):
        ExpenseCreate(**body)


# --- Betragsrechnung -----------------------------------------------------------


def test_betraege_aus_brutto() -> None:
    assert betraege_rechnen(gross=Decimal("125"), net=None, tax=None, tax_rate=Decimal("25")) == (
        Decimal("100.00"), Decimal("25.00"), Decimal("125.00"))


def test_betraege_aus_netto() -> None:
    assert betraege_rechnen(gross=None, net=Decimal("100"), tax=None, tax_rate=Decimal("19")) == (
        Decimal("100.00"), Decimal("19.00"), Decimal("119.00"))


def test_widerspruch_422() -> None:
    with pytest.raises(AusgabenError) as exc:
        betraege_rechnen(gross=Decimal("130"), net=Decimal("100"), tax=None, tax_rate=Decimal("25"))
    assert exc.value.status_code == 422


def test_ohne_betrag_422() -> None:
    with pytest.raises(AusgabenError) as exc:
        betraege_rechnen(gross=None, net=None, tax=None, tax_rate=Decimal("25"))
    assert exc.value.status_code == 422


# --- Anlegen -------------------------------------------------------------------


def test_anlegen_xrechnung_nimmt_tenant_waehrung() -> None:
    service, db = _svc(tenants=_tenant_rows("DKK"))
    res = service.create_expense(CTX, ExpenseCreate(**XRECHNUNG_BODY))
    zeile = db.tables["expenses"][0]
    assert zeile["currency"] == "DKK"
    assert zeile["tenant_id"] == TENANT
    assert zeile["net_amount"] == "100.00" and zeile["gross_amount"] == "119.00"
    assert zeile["category_id"] is None and zeile["category_name"] == "Sonstiges"
    assert res.supplier_name == "Lieferant GmbH" and res.has_receipt is False


def test_anlegen_ohne_waehrung_422() -> None:
    service, _db = _svc(tenants=_tenant_rows(None))
    with pytest.raises(AusgabenError) as exc:
        service.create_expense(CTX, ExpenseCreate(**XRECHNUNG_BODY))
    assert exc.value.status_code == 422
    assert "EUR" not in exc.value.message


def test_anlegen_kategorie_per_name_aufgeloest() -> None:
    kat = {"id": "k1", "tenant_id": TENANT, "name": "Sonstiges", "kind": "sonstiges",
           "is_active": True, "created_at": "x", "updated_at": "x"}
    service, db = _svc(tenants=_tenant_rows(), expense_categories=[kat])
    service.create_expense(CTX, ExpenseCreate(**XRECHNUNG_BODY))
    assert db.tables["expenses"][0]["category_id"] == "k1"


def test_anlegen_fremde_kategorie_404() -> None:
    kat = {"id": "k9", "tenant_id": "fremd", "name": "X", "kind": "sonstiges",
           "is_active": True, "created_at": "x", "updated_at": "x"}
    service, _db = _svc(tenants=_tenant_rows(), expense_categories=[kat])
    with pytest.raises(AusgabenError) as exc:
        service.create_expense(CTX, ExpenseCreate(**{**XRECHNUNG_BODY, "categoryId": "k9"}))
    assert exc.value.status_code == 404


def test_wiederkehrend_ohne_intervall_422() -> None:
    service, _db = _svc(tenants=_tenant_rows())
    with pytest.raises(AusgabenError) as exc:
        service.create_expense(CTX, ExpenseCreate(**{**XRECHNUNG_BODY, "isRecurring": True}))
    assert exc.value.status_code == 422


# --- Liste ---------------------------------------------------------------------


def test_liste_zeitraum_zu_lang_422() -> None:
    service, _db = _svc()
    with pytest.raises(AusgabenError) as exc:
        service.list_expenses(CTX, date_from=date(2025, 1, 1), date_to=date(2026, 3, 1))
    assert exc.value.status_code == 422


def test_liste_summen_je_waehrung_und_nur_eigener_tenant() -> None:
    service, _db = _svc(expenses=[
        _ausgabe(id="a", gross_amount="125.00", currency="DKK"),
        _ausgabe(id="b", gross_amount="10.00", currency="EUR"),
        _ausgabe(id="c", gross_amount="5.00", currency="EUR", payment_status="cancelled"),
        _ausgabe(id="fremd", tenant_id="t2", gross_amount="999.00"),
    ])
    res = service.list_expenses(CTX)
    assert res.total == 3
    assert res.sum_gross_by_currency == {"DKK": Decimal("125.00"), "EUR": Decimal("10.00")}


def test_get_fremde_ausgabe_404() -> None:
    service, _db = _svc(expenses=[_ausgabe(id="x", tenant_id="t2")])
    with pytest.raises(AusgabenError) as exc:
        service.get_expense(CTX, "x")
    assert exc.value.status_code == 404


# --- Ändern / Sperre -----------------------------------------------------------


def test_update_rechnet_betraege_neu() -> None:
    service, db = _svc(expenses=[_ausgabe()])
    service.update_expense(CTX, "e1", ExpenseUpdate(**{"grossAmount": "250"}))
    z = db.tables["expenses"][0]
    assert z["net_amount"] == "200.00" and z["tax_amount"] == "50.00"


def test_gesperrt_fachdaten_409_zahlstatus_erlaubt() -> None:
    service, db = _svc(expenses=[_ausgabe(is_locked=True)])
    with pytest.raises(AusgabenError) as exc:
        service.update_expense(CTX, "e1", ExpenseUpdate(**{"grossAmount": "1"}))
    assert exc.value.status_code == 409
    res = service.update_expense(CTX, "e1", ExpenseUpdate(**{"paymentStatus": "paid"}))
    assert res.payment_status == "paid" and db.tables["expenses"][0]["paid_at"]


def test_gesperrt_loeschen_409() -> None:
    service, _db = _svc(expenses=[_ausgabe(is_locked=True)])
    with pytest.raises(AusgabenError) as exc:
        service.delete_expense(CTX, "e1")
    assert exc.value.status_code == 409


def test_lock_idempotent() -> None:
    service, db = _svc(expenses=[_ausgabe()])
    service.lock_expense(CTX, "e1")
    service.lock_expense(CTX, "e1")
    updates = [p for p in db.protokoll if p[0] == "update"]
    assert len(updates) == 1 and db.tables["expenses"][0]["is_locked"] is True


def test_loeschen_entfernt_belegdatei() -> None:
    service, db = _svc(expenses=[_ausgabe(receipt_path="t1/e1/a.pdf")])
    service.delete_expense(CTX, "e1")
    assert ("remove", ["t1/e1/a.pdf"]) in db.protokoll
    assert db.tables["expenses"] == []


# --- Beleg-Datei ---------------------------------------------------------------

HEIC = b"\x00\x00\x00\x18ftypheic" + b"\x00" * 20


@pytest.mark.parametrize(
    ("inhalt", "erwartet"),
    [
        (b"%PDF-1.4 x", ("application/pdf", "pdf")),
        (b"\xff\xd8\xff\xe0abc", ("image/jpeg", "jpg")),
        (b"\x89PNG\r\n\x1a\nabc", ("image/png", "png")),
        (HEIC, ("image/heic", "heic")),
        (b"<html>", None),
    ],
)
def test_dateiart(inhalt: bytes, erwartet: tuple | None) -> None:
    assert _dateiart(inhalt) == erwartet


def test_upload_html_als_pdf_415() -> None:
    service, _db = _svc(expenses=[_ausgabe()])
    with pytest.raises(AusgabenError) as exc:
        service.upload_receipt(CTX, "e1", inhalt=b"<html>x</html>", dateiname="beleg.pdf")
    assert exc.value.status_code == 415


def test_upload_zu_gross_413(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(svc_mod, "BELEG_MAX_BYTES", 10)
    service, _db = _svc(expenses=[_ausgabe()])
    with pytest.raises(AusgabenError) as exc:
        service.upload_receipt(CTX, "e1", inhalt=b"%PDF-1.4 " + b"x" * 20, dateiname="b.pdf")
    assert exc.value.status_code == 413


def test_upload_heic_landet_im_bucket_und_ersetzt_alten() -> None:
    service, db = _svc(expenses=[_ausgabe(receipt_path="t1/e1/alt.pdf")])
    res = service.upload_receipt(CTX, "e1", inhalt=HEIC, dateiname="IMG_0001.HEIC")
    upload = next(p for p in db.protokoll if p[0] == "upload")
    assert upload[1].startswith("t1/e1/") and upload[1].endswith(".heic")
    assert upload[2] == "image/heic"
    assert ("remove", ["t1/e1/alt.pdf"]) in db.protokoll
    assert res.has_receipt and res.receipt_mime == "image/heic"
    assert res.receipt_filename == "IMG_0001.HEIC"


def test_receipt_url_signiert() -> None:
    service, db = _svc(
        expenses=[_ausgabe(receipt_path="t1/e1/a.pdf", receipt_mime="application/pdf")]
    )
    res = service.receipt_url(CTX, "e1")
    assert res.url.startswith("https://example.test/t1/e1/a.pdf")
    assert ("signed", "t1/e1/a.pdf", 600) in db.protokoll


def test_receipt_url_ohne_beleg_404() -> None:
    service, _db = _svc(expenses=[_ausgabe()])
    with pytest.raises(AusgabenError) as exc:
        service.receipt_url(CTX, "e1")
    assert exc.value.status_code == 404


# --- Wiederkehrend -------------------------------------------------------------


def test_naechster_termin_monatsende() -> None:
    assert _naechster_termin(date(2026, 1, 31), "monthly") == date(2026, 2, 28)
    assert _naechster_termin(date(2026, 11, 30), "quarterly") == date(2027, 2, 28)
    assert _naechster_termin(date(2026, 2, 28), "yearly") == date(2027, 2, 28)
    assert _naechster_termin(date(2026, 9, 12), "weekly") == date(2026, 9, 19)


def test_lauf_legt_kopien_an_und_rueckt_vor() -> None:
    vorlage = _ausgabe(id="v", is_recurring=True, recurring_interval="monthly",
                       next_due_date="2026-07-15", expense_date="2026-06-15", due_date="2026-06-29")
    service, db = _svc(expenses=[vorlage])
    res = service.run_recurring(CTX, stichtag=HEUTE)
    # 15.09. liegt NACH dem Stichtag 12.09. → zwei Kopien, Zeiger steht auf 15.09.
    assert res.templates_checked == 1 and res.created == 2 and res.skipped_existing == 0
    kopien = [r for r in db.tables["expenses"] if r.get("template_id") == "v"]
    assert [k["expense_date"] for k in kopien] == ["2026-07-15", "2026-08-15"]
    assert all(k["is_recurring"] is False and k["source"] == "recurring" for k in kopien)
    assert kopien[0]["due_date"] == "2026-07-29"
    assert db.tables["expenses"][0]["next_due_date"] == "2026-09-15"


def test_lauf_ist_idempotent() -> None:
    vorlage = _ausgabe(id="v", is_recurring=True, recurring_interval="monthly",
                       next_due_date="2026-09-01")
    service, db = _svc(expenses=[vorlage])
    service.run_recurring(CTX, stichtag=HEUTE)
    # Retry mit zurückgesetztem Zeiger (z. B. zweiter Worker las den alten Stand).
    db.tables["expenses"][0]["next_due_date"] = "2026-09-01"
    res = service.run_recurring(CTX, stichtag=HEUTE)
    assert res.created == 0 and res.skipped_existing == 1
    assert len([r for r in db.tables["expenses"] if r.get("template_id") == "v"]) == 1


# --- Kategorien ----------------------------------------------------------------


def test_kategorie_doppelt_409() -> None:
    service, _db = _svc()
    service.create_category(CTX, ExpenseCategoryCreate(name="Strom", kind="betrieb"))
    with pytest.raises(AusgabenError) as exc:
        service.create_category(CTX, ExpenseCategoryCreate(name="strom", kind="betrieb"))
    assert exc.value.status_code == 409


# --- Belegausleser -------------------------------------------------------------


class _KiStub:
    def __init__(self, text: str) -> None:
        self.text = text
        self.aufrufe: list[dict] = []

    def erzeuge_multimodal(self, **kw: Any) -> KiAntwort:
        self.aufrufe.append(kw)
        return KiAntwort(text=self.text, modell="test", region="test", dauer_ms=1,
                         tokens_ein=1, tokens_aus=1, abschlussgrund="STOP")


def test_ocr_ohne_registrierte_funktion_503(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(svc_mod.ki_nutzung, "FUNKTIONEN", frozenset())
    service = AusgabenService(_DB(), ausleser=_KiStub("{}"))  # type: ignore[arg-type]
    with pytest.raises(AusgabenError) as exc:
        service.extract_receipt(CTX, inhalt=b"%PDF-1.4", dateiname="b.pdf")
    assert exc.value.status_code == 503


def test_ocr_parst_antwort(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(svc_mod.ki_nutzung, "FUNKTIONEN", frozenset({"beleg_ocr"}))
    monkeypatch.setattr(svc_mod.ki_nutzung, "deckel_pruefen", lambda _db, _t: 0)
    gebucht: list[str] = []
    monkeypatch.setattr(svc_mod.ki_nutzung, "buchen",
                        lambda _db, _t, **kw: gebucht.append(kw["funktion"]))
    stub = _KiStub(
        '```json\n{"supplierName": "Netto A/S", "grossAmount": "125,00", "netAmount": 100,'
        ' "taxRate": 25, "currency": "dkk", "expenseDate": "2026-09-10", "confidence": "hoch",'
        ' "receiptNumber": "B-1"}\n```'
    )
    service = AusgabenService(_DB(), ausleser=stub)  # type: ignore[arg-type]
    res = service.extract_receipt(CTX, inhalt=HEIC, dateiname="IMG.HEIC")
    assert res.supplier_name == "Netto A/S" and res.gross_amount == Decimal("125.00")
    assert res.currency == "DKK" and res.tax_rate == Decimal("25.00")
    assert res.expense_date == date(2026, 9, 10) and res.confidence == "hoch"
    assert res.raw["receiptNumber"] == "B-1"
    assert gebucht == ["beleg_ocr"]
    assert stub.aufrufe[0]["teile"][0]["inlineData"]["mimeType"] == "image/heic"


def test_ocr_kein_json_502(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(svc_mod.ki_nutzung, "FUNKTIONEN", frozenset({"beleg_ocr"}))
    monkeypatch.setattr(svc_mod.ki_nutzung, "deckel_pruefen", lambda _db, _t: 0)
    service = AusgabenService(_DB(), ausleser=_KiStub("Ich kann das nicht lesen."))  # type: ignore[arg-type]
    with pytest.raises(AusgabenError) as exc:
        service.extract_receipt(CTX, inhalt=b"%PDF-1.4", dateiname="b.pdf")
    assert exc.value.status_code == 502
