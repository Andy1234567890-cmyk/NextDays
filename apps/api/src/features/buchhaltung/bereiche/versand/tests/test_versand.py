"""Tests des Bereichs »versand«: Idempotenz-Fenster, PDF-Prüfung, Sanitizing,
Platzhalter-Render, Statuswechsel, Fehlerpfad (failed + 502), Drossel.

Fake-DB im Stil von ../../tests/test_kunden_anlegen.py — Zeilen je Tabelle,
Filter über `eq`/`gte`/`is_`, `insert` kann 23505 simulieren.
"""
from __future__ import annotations

import base64
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from postgrest.exceptions import APIError

from src.core.mail import MailError
from src.core.security import AuthContext
from src.features.buchhaltung.bereiche.versand import dienst
from src.features.buchhaltung.bereiche.versand.schemas import (
    SendDocumentRequest,
    SendInvoiceEmailRequest,
    TextTemplateCreate,
    TextTemplateRenderRequest,
    TextTemplateUpdate,
)
from src.features.buchhaltung.bereiche.versand.service import (
    SENDS_JE_MINUTE,
    VersandService,
    VersandServiceError,
    betrag_formatieren,
    text_bereinigen,
)

TENANT = "t1"
CTX = AuthContext(user_id="u1", tenant_id=TENANT, role="admin")
PDF_B64 = base64.b64encode(b"%PDF-1.4\n%fake\n").decode()
NICHT_PDF_B64 = base64.b64encode(b"MZ ist kein PDF").decode()


class _Chain:
    def __init__(self, table: _Table) -> None:
        self._t = table
        self._filter: list[tuple[str, str, object]] = []
        self._op: str | None = None
        self._payload: object = None

    def select(self, *_a: object, **_k: object) -> _Chain:
        return self

    def order(self, *_a: object, **_k: object) -> _Chain:
        return self

    def limit(self, *_a: object, **_k: object) -> _Chain:
        return self

    def eq(self, f: str, w: object) -> _Chain:
        self._filter.append(("eq", f, w))
        return self

    def neq(self, f: str, w: object) -> _Chain:
        self._filter.append(("neq", f, w))
        return self

    def gte(self, f: str, w: object) -> _Chain:
        self._filter.append(("gte", f, w))
        return self

    def is_(self, f: str, _w: object) -> _Chain:
        self._filter.append(("is_null", f, None))
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

    def _passt(self, r: dict) -> bool:
        for op, f, w in self._filter:
            v = r.get(f)
            if op == "eq" and str(v) != str(w):
                return False
            if op == "neq" and str(v) == str(w):
                return False
            if op == "gte" and str(v) < str(w):
                return False
            if op == "is_null" and v is not None:
                return False
        return True

    def execute(self) -> SimpleNamespace:
        t = self._t
        if self._op == "insert":
            assert isinstance(self._payload, dict)
            if t.naechster_insert_fehler:
                fehler, t.naechster_insert_fehler = t.naechster_insert_fehler, None
                raise fehler
            neu = {**self._payload, "id": f"{t.name}-{len(t.rows) + 1}"}
            jetzt = datetime.now(UTC).isoformat()
            neu.setdefault("created_at", jetzt)
            neu.setdefault("updated_at", jetzt)
            t.rows.append(neu)
            t.inserts.append(neu)
            return SimpleNamespace(data=[neu])
        treffer = [r for r in t.rows if self._passt(r)]
        if self._op == "update":
            assert isinstance(self._payload, dict)
            for r in treffer:
                r.update(self._payload)
            t.updates.append((self._filter, self._payload))
            return SimpleNamespace(data=treffer)
        if self._op == "delete":
            t.rows[:] = [r for r in t.rows if r not in treffer]
            return SimpleNamespace(data=treffer)
        return SimpleNamespace(data=treffer)


class _Table:
    def __init__(self, name: str, rows: list[dict]) -> None:
        self.name = name
        self.rows = rows
        self.inserts: list[dict] = []
        self.updates: list = []
        self.naechster_insert_fehler: Exception | None = None


class _DB:
    def __init__(self, **tables: list[dict]) -> None:
        self.tables = {n: _Table(n, r) for n, r in tables.items()}

    def table(self, name: str) -> _Chain:
        return _Chain(self.tables.setdefault(name, _Table(name, [])))


class _Versand:
    """Ersatz für `dienst.dokument_senden`: zählt Aufrufe, kann scheitern."""

    def __init__(self, fehler: Exception | None = None) -> None:
        self.aufrufe: list[dict] = []
        self.fehler = fehler

    def __call__(self, ctx: AuthContext, **kw: object) -> str:
        self.aufrufe.append(kw)
        if self.fehler:
            raise self.fehler
        return f"<msg-{len(self.aufrufe)}@x>"


def _rechnung(**extra: object) -> dict:
    return {
        "id": "inv-1", "tenant_id": TENANT, "invoice_number": "RE-0007", "status": "finalized",
        "customer_id": "k1", "currency": "DKK", "gross_amount": "1234.50", "net_amount": "987.60",
        "tax_amount": "246.90", "due_date": "2026-10-01", "issue_date": "2026-09-12",
        "deleted_at": None, "sent_at": None, **extra,
    }


def _svc(
    *, versand: _Versand | None = None, **tables: list[dict]
) -> tuple[VersandService, _DB, _Versand]:
    db = _DB(**tables)
    v = versand or _Versand()
    return VersandService(db, versand=v), db, v  # type: ignore[arg-type]


def _body(**extra: object) -> SendDocumentRequest:
    return SendDocumentRequest(**{
        "to": ["kunde@example.com"], "subject": "Rechnung RE-0007",
        "message": "Anbei die Rechnung.",
        "documentType": "invoice", "documentId": "inv-1",
        "attachments": [{"filename": "RE-0007.pdf", "contentBase64": PDF_B64}],
        **extra,
    })


# --- Versand -----------------------------------------------------------------


def test_versand_protokolliert_und_setzt_rechnung_auf_sent() -> None:
    svc, db, v = _svc(invoices=[_rechnung()])
    res = svc.send_document(CTX, _body())
    assert res.success and res.pdf_attached and res.attachment_filename == "RE-0007.pdf"
    assert res.send.status == "sent" and res.send.message_id == "<msg-1@x>"
    assert res.beleg_status_gesetzt is True
    assert db.tables["invoices"].rows[0]["status"] == "sent"
    assert db.tables["invoices"].rows[0]["sent_at"]
    assert len(v.aufrufe) == 1
    name, daten, mime = v.aufrufe[0]["anhaenge"][0]
    assert (name, mime) == ("RE-0007.pdf", "application/pdf") and daten.startswith(b"%PDF-")
    assert db.tables["document_sends"].rows[0]["document_number"] == "RE-0007"


def test_idempotenz_gleicher_inhalt_binnen_60s_kein_zweiter_versand() -> None:
    svc, db, v = _svc(invoices=[_rechnung()])
    erste = svc.send_document(CTX, _body())
    zweite = svc.send_document(CTX, _body())
    assert len(v.aufrufe) == 1, "zweiter Aufruf darf keine zweite Mail auslösen"
    assert zweite.wiederverwendet is True and zweite.send.id == erste.send.id
    assert len(db.tables["document_sends"].rows) == 1


def test_idempotenz_fenster_abgelaufen_sendet_erneut() -> None:
    svc, db, v = _svc(invoices=[_rechnung()])
    svc.send_document(CTX, _body())
    alt = (datetime.now(UTC) - timedelta(seconds=61)).isoformat()
    db.tables["document_sends"].rows[0]["created_at"] = alt
    res = svc.send_document(CTX, _body())
    assert len(v.aufrufe) == 2 and res.wiederverwendet is False


def test_anderer_empfaenger_ist_neuer_versand() -> None:
    svc, _db, v = _svc(invoices=[_rechnung()])
    svc.send_document(CTX, _body())
    svc.send_document(CTX, _body(to=["andere@example.com"]))
    assert len(v.aufrufe) == 2


def test_doppelklick_23505_gibt_bestehenden_eintrag(monkeypatch: pytest.MonkeyPatch) -> None:
    """Race: die Fenster-Prüfung sieht noch nichts, der Insert läuft in den
    Unique-Index (23505) → der Eintrag des anderen Aufrufs kommt zurück, keine Mail."""
    svc, db, v = _svc(invoices=[_rechnung()])
    fremd = {
        "id": "s-anderer", "tenant_id": TENANT, "document_type": "invoice", "document_id": "inv-1",
        "kanal": "email", "empfaenger": ["kunde@example.com"], "betreff": "S", "status": "pending",
        "inhalt_hash": "h", "created_at": datetime.now(UTC).isoformat(),
        "updated_at": datetime.now(UTC).isoformat(),
    }
    antworten = iter([None, fremd])
    monkeypatch.setattr(svc, "_juengster_gleicher", lambda *_a, **_k: next(antworten))
    db.table("document_sends")
    db.tables["document_sends"].naechster_insert_fehler = APIError(
        {"code": "23505", "message": "duplicate", "hint": None, "details": None}
    )
    res = svc.send_document(CTX, _body())
    assert res.wiederverwendet is True and res.send.id == "s-anderer"
    assert not v.aufrufe


def test_23505_ohne_treffer_wird_nicht_verschluckt(monkeypatch: pytest.MonkeyPatch) -> None:
    svc, db, v = _svc(invoices=[_rechnung()])
    monkeypatch.setattr(svc, "_juengster_gleicher", lambda *_a, **_k: None)
    db.table("document_sends")
    db.tables["document_sends"].naechster_insert_fehler = APIError(
        {"code": "23505", "message": "duplicate", "hint": None, "details": None}
    )
    with pytest.raises(APIError):
        svc.send_document(CTX, _body())
    assert not v.aufrufe


def test_mailfehler_wird_als_failed_protokolliert_und_502() -> None:
    svc, db, _v = _svc(
        versand=_Versand(fehler=MailError("SMTP 451 zu viele Verbindungen")),
        invoices=[_rechnung()],
    )
    with pytest.raises(VersandServiceError) as exc:
        svc.send_document(CTX, _body())
    assert exc.value.status_code == 502
    eintrag = db.tables["document_sends"].rows[0]
    assert eintrag["status"] == "failed" and "451" in eintrag["fehler"]
    assert db.tables["invoices"].rows[0]["status"] == "finalized", "Beleg bleibt unverändert"


def test_mail_nicht_konfiguriert_bleibt_503() -> None:
    svc, _db, _v = _svc(
        versand=_Versand(fehler=MailError("nicht konfiguriert", status_code=503)),
        invoices=[_rechnung()],
    )
    with pytest.raises(VersandServiceError) as exc:
        svc.send_document(CTX, _body())
    assert exc.value.status_code == 503


def test_failed_darf_wiederholt_werden() -> None:
    kaputt = _Versand(fehler=MailError("weg"))
    svc, db, _v = _svc(versand=kaputt, invoices=[_rechnung()])
    with pytest.raises(VersandServiceError):
        svc.send_document(CTX, _body())
    heil = _Versand()
    svc2 = VersandService(db, versand=heil)  # type: ignore[arg-type]
    res = svc2.send_document(CTX, _body())
    assert res.success and len(heil.aufrufe) == 1 and res.wiederverwendet is False


def test_pdf_ohne_magic_bytes_422() -> None:
    svc, _db, v = _svc(invoices=[_rechnung()])
    body = _body(attachments=[{"filename": "x.pdf", "contentBase64": NICHT_PDF_B64}])
    with pytest.raises(VersandServiceError) as exc:
        svc.send_document(CTX, body)
    assert exc.value.status_code == 422 and not v.aufrufe


def test_pdf_ungueltiges_base64_422() -> None:
    svc, _db, _v = _svc(invoices=[_rechnung()])
    body = _body(attachments=[{"filename": "x.pdf", "contentBase64": "%%%nicht-base64%%%"}])
    with pytest.raises(VersandServiceError) as exc:
        svc.send_document(CTX, body)
    assert exc.value.status_code == 422


def test_pdf_zu_gross_413(monkeypatch: pytest.MonkeyPatch) -> None:
    from src.features.buchhaltung.bereiche.versand import service as modul

    monkeypatch.setattr(modul, "_PDF_MAX_BYTES", 10)
    svc, _db, _v = _svc(invoices=[_rechnung()])
    with pytest.raises(VersandServiceError) as exc:
        svc.send_document(CTX, _body())
    assert exc.value.status_code == 413


def test_fremder_beleg_404_kein_versand() -> None:
    svc, _db, v = _svc(invoices=[_rechnung(tenant_id="t-fremd")])
    with pytest.raises(VersandServiceError) as exc:
        svc.send_document(CTX, _body())
    assert exc.value.status_code == 404 and not v.aufrufe


def test_entwurf_ohne_nummer_bleibt_entwurf() -> None:
    svc, db, _v = _svc(invoices=[_rechnung(invoice_number=None, status="draft")])
    res = svc.send_document(CTX, _body())
    assert res.success and res.beleg_status_gesetzt is False
    assert db.tables["invoices"].rows[0]["status"] == "draft"


def test_angebot_wird_sent() -> None:
    svc, db, _v = _svc(quotes=[{
        "id": "q1", "tenant_id": TENANT, "quote_number": "AN-0001", "status": "draft",
        "deleted_at": None, "sent_at": None,
    }])
    res = svc.send_document(CTX, _body(documentType="quote", documentId="q1"))
    assert res.beleg_status_gesetzt is True
    assert db.tables["quotes"].rows[0]["status"] == "sent"


def test_belegart_alias_des_dialogs() -> None:
    svc, db, _v = _svc()
    res = svc.send_document(
        CTX, _body(documentType="credit-note", documentId="gs-1", attachments=[])
    )
    assert res.send.document_type == "credit_note"
    assert res.pdf_attached is False and res.beleg_status_gesetzt is None
    assert db.tables["document_sends"].rows[0]["document_type"] == "credit_note"


def test_send_invoice_email_alias_ohne_pdf() -> None:
    svc, _db, v = _svc(invoices=[_rechnung()])
    alt = SendInvoiceEmailRequest(**{
        "invoiceId": "inv-1", "companyId": "c", "recipientEmail": "k@example.com",
        "recipientName": "K", "subject": "S", "message": "M", "senderName": "Firma",
    })
    res = svc.send_document(CTX, alt.als_send_document())
    assert res.success and res.pdf_attached is False and res.attachment_filename is None
    assert v.aufrufe[0]["anhaenge"] == []


def test_drossel_je_betrieb_429() -> None:
    jetzt = datetime.now(UTC).isoformat()
    viele = [
        {"id": f"s{i}", "tenant_id": TENANT, "inhalt_hash": f"h{i}", "created_at": jetzt,
         "status": "sent"}
        for i in range(SENDS_JE_MINUTE)
    ]
    svc, _db, v = _svc(invoices=[_rechnung()], document_sends=viele)
    with pytest.raises(VersandServiceError) as exc:
        svc.send_document(CTX, _body())
    assert exc.value.status_code == 429 and not v.aufrufe


def test_verlauf_je_beleg_nur_eigener_tenant() -> None:
    svc, _db, _v = _svc(document_sends=[
        {"id": "a", "tenant_id": TENANT, "document_type": "invoice", "document_id": "inv-1",
         "kanal": "email", "empfaenger": ["x@y.de"], "betreff": "S", "status": "sent",
         "created_at": "2026-09-12T10:00:00Z", "updated_at": "2026-09-12T10:00:00Z"},
        {"id": "b", "tenant_id": "fremd", "document_type": "invoice", "document_id": "inv-1",
         "kanal": "email", "empfaenger": ["x@y.de"], "betreff": "S", "status": "sent",
         "created_at": "2026-09-12T10:00:00Z", "updated_at": "2026-09-12T10:00:00Z"},
    ])
    items = svc.list_sends(CTX, document_id="inv-1")
    assert [i.id for i in items] == ["a"]
    with pytest.raises(VersandServiceError) as exc:
        svc.list_sends(CTX, limit=501)
    assert exc.value.status_code == 422


# --- Textvorlagen ------------------------------------------------------------


def test_sanitizing_entfernt_skript_behaelt_platzhalter() -> None:
    roh = '<p onclick="x()">Hallo [%KUNDENNAME%]</p><script>alert(1)</script>' \
          '<a href="javascript:evil()">l</a><a href="https://ok.de">ok</a> {betrag}'
    sauber = text_bereinigen(roh)
    assert "<script" not in sauber and "onclick" not in sauber and "javascript:" not in sauber
    assert "[%KUNDENNAME%]" in sauber and "{betrag}" in sauber and 'href="https://ok.de"' in sauber


def test_sanitizing_nur_skript_422() -> None:
    with pytest.raises(VersandServiceError) as exc:
        text_bereinigen("<script>alert(1)</script>")
    assert exc.value.status_code == 422


def test_vorlage_anlegen_nimmt_altem_standard_den_stern() -> None:
    svc, db, _v = _svc(text_templates=[{
        "id": "tt-alt", "tenant_id": TENANT, "name": "alt", "category": "EMAIL",
        "object_type": "INVOICE", "text_type": "BODY", "text": "x", "language": None,
        "is_default": True, "is_private": False, "created_by": "u1",
        "created_at": "2026-09-12T10:00:00Z", "updated_at": "2026-09-12T10:00:00Z",
    }])
    neu = svc.create_text_template(CTX, TextTemplateCreate(**{
        "name": "neu", "category": "EMAIL", "objectType": "INVOICE", "textType": "BODY",
        "text": "Hallo <b>[%KUNDENNAME%]</b>", "isDefault": True, "companyId": "ignoriert",
    }))
    assert neu.is_default and neu.company_id == TENANT and "<b>" in neu.text
    assert db.tables["text_templates"].rows[0]["is_default"] is False


def test_private_vorlage_fremder_nutzer_unsichtbar() -> None:
    svc, _db, _v = _svc(text_templates=[{
        "id": "tt-p", "tenant_id": TENANT, "name": "p", "category": "EMAIL",
        "object_type": "INVOICE", "text_type": "BODY", "text": "x", "language": None,
        "is_default": False, "is_private": True, "created_by": "anderer",
        "created_at": "2026-09-12T10:00:00Z", "updated_at": "2026-09-12T10:00:00Z",
    }])
    assert svc.list_text_templates(CTX) == []
    with pytest.raises(VersandServiceError) as exc:
        svc.update_text_template(CTX, "tt-p", TextTemplateUpdate(name="x"))
    assert exc.value.status_code == 404


def test_vorlage_aendern_und_loeschen() -> None:
    svc, db, _v = _svc(text_templates=[{
        "id": "tt-1", "tenant_id": TENANT, "name": "a", "category": "DOCUMENT",
        "object_type": "QUOTE", "text_type": "HEAD", "text": "x", "language": None,
        "is_default": False, "is_private": False, "created_by": "u1",
        "created_at": "2026-09-12T10:00:00Z", "updated_at": "2026-09-12T10:00:00Z",
    }])
    res = svc.update_text_template(
        CTX, "tt-1", TextTemplateUpdate(**{"text": "<img src=x onerror=1>Neu", "language": "DA"})
    )
    assert res.text == "Neu" and res.language == "da"
    svc.delete_text_template(CTX, "tt-1")
    assert db.tables["text_templates"].rows == []


def test_render_fuellt_platzhalter_aus_beleg() -> None:
    svc, _db, _v = _svc(
        invoices=[_rechnung()],
        customers=[{"id": "k1", "tenant_id": TENANT, "name": "Nordlys ApS",
                    "customer_number": "KD-0001", "email": "n@x.dk",
                    "address": {"street": "Havnegade", "house_number": "1",
                                "postal_code": "8000", "city": "Aarhus"}}],
        tenant_billing_profile=[{"tenant_id": TENANT, "legal_name": "Ferie A/S",
                                 "email": "info@ferie.dk", "vat_id": "DK123"}],
        tenants=[{"id": TENANT, "default_language": "da"}],
    )
    res = svc.render_text_template(CTX, TextTemplateRenderRequest(**{
        "text": "Hej [%KUNDENNAME%] ({kunde}), {belegnummer} über [%BETRAG%], fällig {faelligkeit}"
                " — [%ORT%] [%FIRMENNAME%] [%ANGEBOTSNUMMER%]",
        "documentType": "invoice", "documentId": "inv-1",
    }))
    assert res.language == "da"
    assert res.text == (
        "Hej Nordlys ApS (Nordlys ApS), RE-0007 über 1.234,50 DKK, fällig 01.10.2026"
        " — Aarhus Ferie A/S "
    )
    assert res.offene_platzhalter == ["[%ANGEBOTSNUMMER%]"]


def test_betrag_ohne_waehrung_kein_symbol() -> None:
    from decimal import Decimal

    assert betrag_formatieren(Decimal("10.5"), None, "de") == "10,50"
    assert betrag_formatieren(Decimal("1234.5"), "EUR", "en") == "1,234.50 EUR"


# --- Mailweg (dienst) --------------------------------------------------------


def test_belegmailservice_haengt_pdf_an_und_bcc_nur_im_umschlag(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    s = SimpleNamespace(smtp_from_name="Firma", smtp_from_address="noreply@x.de")
    m = dienst.BelegMailService(settings=s)  # type: ignore[arg-type]
    msg = dienst.BelegMail(
        to=["k@x.de"], subject="S", text="t", html="<p>t</p>",
        anhaenge=(("RE-1.pdf", b"%PDF-1.4 x", "application/pdf"),), bcc=("kopie@x.de",),
    )
    email = m._build(msg)
    assert [p.get_filename() for p in email.iter_attachments()] == ["RE-1.pdf"]
    assert email["To"] == "k@x.de" and "kopie@x.de" not in str(email)
    assert msg.recipients == ["k@x.de"] and msg.umschlag == ["k@x.de", "kopie@x.de"]
    # Der Umschlag bekommt BCC, der Kopf nicht — über den echten send-Pfad.
    zugestellt: list[list[str]] = []
    m._settings = SimpleNamespace(  # type: ignore[assignment]
        smtp_from_name="Firma", smtp_from_address="noreply@x.de", mail_configured=True,
        mail_sandbox=False,
    )
    monkeypatch.setattr(
        dienst.MailService, "_deliver",
        lambda _self, _email, recipients: zugestellt.append(recipients),
    )
    m.send(msg)
    assert zugestellt == [["k@x.de", "kopie@x.de"]]


def test_dokument_senden_nutzt_layout_und_reply_to() -> None:
    gesendet: list = []

    class _Mail:
        def send(self, msg: object) -> str:
            gesendet.append(msg)
            return "<id@x>"

    db = _DB(
        tenant_billing_profile=[
            {"tenant_id": TENANT, "legal_name": "Ferie A/S", "email": "info@ferie.dk"}
        ],
        tenants=[{"id": TENANT, "default_language": "da"}],
    )
    settings = SimpleNamespace(
        app_base_url="", company_legal_name="", company_legal_form="", company_street="",
        company_city="", company_country="", company_registration_number="",
        company_contact_email="", company_vat_id="", company_contact_phone="",
        marketing_base_url="https://mynextdays.com", impressum_url="", datenschutz_url="",
    )
    mid = dienst.dokument_senden(
        CTX, an=["k@x.dk"], betreff="Faktura", text="Hej\n\nVedhæftet.", signatur="Mvh Ferie",
        anhaenge=[("F.pdf", b"%PDF-1.4", "application/pdf")], kopie_an_absender=True,
        db=db, mail=_Mail(), settings=settings,  # type: ignore[arg-type]
    )
    assert mid == "<id@x>"
    msg = gesendet[0]
    assert isinstance(msg, dienst.BelegMail)
    assert msg.reply_to == "info@ferie.dk" and "info@ferie.dk" in msg.bcc
    assert "Vedhæftet." in msg.text and "Mvh Ferie" in msg.text and "Ferie A/S" in msg.text
    assert "COMPANY_LEGAL_NAME fehlt" in msg.text, "Mangel steht sichtbar, nicht stumm"
    assert dienst.fehlende_umgebung(settings) == [
        "APP_BASE_URL", "COMPANY_LEGAL_NAME", "COMPANY_LEGAL_FORM", "COMPANY_STREET",
        "COMPANY_CITY", "COMPANY_COUNTRY", "COMPANY_REGISTRATION_NUMBER", "COMPANY_CONTACT_EMAIL",
    ]


def test_dokument_senden_mailfehler_wird_versandfehler() -> None:
    class _Mail:
        def send(self, _msg: object) -> str:
            raise MailError("SMTP down")

    db = _DB()
    settings = SimpleNamespace(
        app_base_url="x", company_legal_name="x", company_legal_form="x", company_street="x",
        company_city="x", company_country="x", company_registration_number="x",
        company_contact_email="x", company_vat_id="", company_contact_phone="",
        marketing_base_url="", impressum_url="", datenschutz_url="",
    )
    with pytest.raises(dienst.VersandError) as exc:
        dienst.dokument_senden(CTX, an=["k@x.dk"], betreff="S", text="T",
                               db=db, mail=_Mail(), settings=settings)  # type: ignore[arg-type]
    assert exc.value.status_code == 500 and "SMTP down" in exc.value.message


def test_standardvorlagen_werden_einmal_in_betriebssprache_angelegt() -> None:
    from src.core.security import AuthContext
    from src.features.buchhaltung.bereiche.versand.service import VersandService
    from src.features.buchhaltung.bereiche.versand.standardvorlagen import standardvorlagen_anlegen

    db = _DB(tenants=[{"id": "t1", "default_language": "da"}], text_templates=[])
    svc = VersandService(db)  # type: ignore[arg-type]
    ctx = AuthContext(user_id="u", tenant_id="t1", role="admin")
    assert standardvorlagen_anlegen(svc, ctx) == 4
    rows = db.tables["text_templates"].rows
    arten = sorted((r["object_type"], r["text_type"]) for r in rows)
    assert arten == [("INVOICE", "FOOT"), ("INVOICE", "HEAD"), ("QUOTE", "FOOT"), ("QUOTE", "HEAD")]
    assert all(r["language"] == "da" and r["is_default"] for r in rows)
    fuss = next(r["text"] for r in rows if r["object_type"] == "QUOTE" and r["text_type"] == "FOOT")
    assert "[%GUELTIG_BIS%]" in fuss
    # zweiter Aufruf legt nichts nach
    assert standardvorlagen_anlegen(svc, ctx) == 0
    assert len(db.tables["text_templates"].rows) == 4
