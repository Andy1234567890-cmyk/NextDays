"""Tests des Bereichs »erechnung«: XML-Prüfung, Entities, Summen, Scope,
Idempotenz, Protokoll, Einstellungen, Compliance und Guard-Kette."""
# ruff: noqa: E501 — XML-Fixturen und Aufrufe mit vollem Payload bleiben in einer Zeile lesbar
from __future__ import annotations

import base64
from datetime import date

import pytest
from fastapi import APIRouter

from src.core.security import AuthContext
from src.features.buchhaltung.bereiche.erechnung import pruefung
from src.features.buchhaltung.bereiche.erechnung.router import router as erechnung_router
from src.features.buchhaltung.bereiche.erechnung.schemas import (
    EInvoiceCreate,
    EInvoiceSettingsUpdate,
    TransmissionCreate,
)
from src.features.buchhaltung.bereiche.erechnung.service import (
    ERechnungError,
    ERechnungService,
)

from .fake_db import FakeDB

TENANT = "t1"
FREMD = "t2"
CTX = AuthContext(user_id="u1", tenant_id=TENANT, role="admin")
CTX_FREMD = AuthContext(user_id="u9", tenant_id=FREMD, role="admin")

RECHNUNG = {
    "id": "inv-1",
    "tenant_id": TENANT,
    "invoice_number": "RE-2026-0001",
    "customer_id": "k1",
    "status": "sent",
    "invoice_type": "invoice",
    "issue_date": "2026-09-01",
    "gross_amount": "119.00",
    "currency": "EUR",
    "leitweg_id": None,
    "deleted_at": None,
}
KUNDE = {"id": "k1", "tenant_id": TENANT, "name": "Amt Nord", "email": None}


def ubl(**ersetzen: str) -> str:
    felder = {
        "id": "RE-2026-0001",
        "issue": "2026-09-01",
        "due": "2026-09-15",
        "cur": "EUR",
        "ref": "04011000-12345-67",
        "vat": "DE123456789",
        "net": "100.00",
        "tax": "19.00",
        "gross": "119.00",
        "pay": "119.00",
    }
    felder.update(ersetzen)
    ref = f"<cbc:BuyerReference>{felder['ref']}</cbc:BuyerReference>" if felder["ref"] else ""
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>{felder['id']}</cbc:ID>
  <cbc:IssueDate>{felder['issue']}</cbc:IssueDate>
  <cbc:DueDate>{felder['due']}</cbc:DueDate>
  <cbc:DocumentCurrencyCode>{felder['cur']}</cbc:DocumentCurrencyCode>
  {ref}
  <cac:AccountingSupplierParty><cac:Party>
    <cac:PartyName><cbc:Name>Ferien Nord GmbH</cbc:Name></cac:PartyName>
    <cac:PartyTaxScheme><cbc:CompanyID>{felder['vat']}</cbc:CompanyID></cac:PartyTaxScheme>
  </cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party>
    <cac:PartyName><cbc:Name>Amt Nord</cbc:Name></cac:PartyName>
  </cac:Party></cac:AccountingCustomerParty>
  <cac:TaxTotal><cbc:TaxAmount currencyID="EUR">{felder['tax']}</cbc:TaxAmount>
    <cac:TaxSubtotal><cbc:TaxAmount currencyID="EUR">{felder['tax']}</cbc:TaxAmount></cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">{felder['net']}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">{felder['net']}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">{felder['gross']}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">{felder['pay']}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine><cbc:LineExtensionAmount currencyID="EUR">{felder['net']}</cbc:LineExtensionAmount></cac:InvoiceLine>
</Invoice>"""


CII = """<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocument><ram:ID>RE-2026-0001</ram:ID>
    <ram:IssueDateTime><udt:DateTimeString format="102">20260901</udt:DateTimeString></ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty><ram:Name>Ferien Nord GmbH</ram:Name>
        <ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">DE123456789</ram:ID></ram:SpecifiedTaxRegistration>
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty><ram:Name>Amt Nord</ram:Name></ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <ram:ApplicableTradeTax><ram:CalculatedAmount>19.00</ram:CalculatedAmount></ram:ApplicableTradeTax>
      <ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime><udt:DateTimeString format="102">20260915</udt:DateTimeString></ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>100.00</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>100.00</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">19.00</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>119.00</ram:GrandTotalAmount>
        <ram:TotalPrepaidAmount>0.00</ram:TotalPrepaidAmount>
        <ram:DuePayableAmount>119.00</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>"""


def _svc(**tables: list[dict]) -> tuple[ERechnungService, FakeDB]:
    tables.setdefault("invoices", [dict(RECHNUNG)])
    tables.setdefault("customers", [dict(KUNDE)])
    tables.setdefault("tenants", [{"id": TENANT, "country": "DK"}])
    db = FakeDB(**tables)
    return ERechnungService(db), db  # type: ignore[arg-type]


def _b64(xml: str) -> str:
    return base64.b64encode(xml.encode()).decode()


# --- XML-Prüfung ---------------------------------------------------------------


@pytest.mark.parametrize(
    "xml",
    [
        '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><Invoice>&xxe;</Invoice>',
        '<?xml version="1.0"?><!DOCTYPE lol [<!ENTITY a "aaaa"><!ENTITY b "&a;&a;">]><x>&b;</x>',
        "<?xml version='1.0'?><! doctype x><x/>",
    ],
)
def test_entities_und_doctype_abgelehnt(xml: str) -> None:
    with pytest.raises(pruefung.XmlUngueltig):
        pruefung.xml_parsen(xml.encode())


def test_nicht_wohlgeformt_abgelehnt() -> None:
    with pytest.raises(pruefung.XmlUngueltig):
        pruefung.xml_parsen(b"<Invoice><cbc:ID>1</Invoice>")
    with pytest.raises(pruefung.XmlUngueltig):
        pruefung.xml_parsen(b"   ")


def test_ubl_vollstaendig_ohne_befunde() -> None:
    wurzel = pruefung.xml_parsen(ubl().encode())
    assert pruefung.syntax_erkennen(wurzel) == "ubl"
    befunde = pruefung.pruefen(pruefung.kerndaten(wurzel, "ubl"), "xrechnung_ubl", RECHNUNG)
    assert befunde == []


def test_cii_vollstaendig_ohne_befunde() -> None:
    wurzel = pruefung.xml_parsen(CII.encode())
    assert pruefung.syntax_erkennen(wurzel) == "cii"
    k = pruefung.kerndaten(wurzel, "cii")
    assert k.issue_date == "2026-09-01" and k.due_date == "2026-09-15"
    befunde = pruefung.pruefen(k, "zugferd_en16931", RECHNUNG)
    # ZUGFeRD ohne BuyerReference: nur Warnung, kein Fehler.
    assert [b.code for b in befunde] == ["leitweg_fehlt"]
    assert befunde[0].severity == "warning"
    assert pruefung.status_aus(befunde) == "valid"


def test_leitweg_fehlt_ist_fehler_bei_xrechnung() -> None:
    wurzel = pruefung.xml_parsen(ubl(ref="").encode())
    befunde = pruefung.pruefen(pruefung.kerndaten(wurzel, "ubl"), "xrechnung_ubl", RECHNUNG)
    assert [(b.code, b.severity, b.bt) for b in befunde] == [("leitweg_fehlt", "error", "BT-10")]
    assert pruefung.status_aus(befunde) == "invalid"


def test_summen_inkonsistent() -> None:
    wurzel = pruefung.xml_parsen(ubl(gross="120.00", pay="120.00").encode())
    codes = {b.code for b in pruefung.pruefen(pruefung.kerndaten(wurzel, "ubl"), "xrechnung_ubl", RECHNUNG)}
    # 100 + 19 ≠ 120 (BR-CO-15) und 120 ≠ Rechnung 119.
    assert codes == {"brutto_inkonsistent", "betrag_abweichend"}


def test_zahlbetrag_und_positionen_inkonsistent() -> None:
    wurzel = pruefung.xml_parsen(ubl(pay="100.00").encode())
    codes = {b.code for b in pruefung.pruefen(pruefung.kerndaten(wurzel, "ubl"), "xrechnung_ubl", RECHNUNG)}
    assert codes == {"zahlbetrag_inkonsistent"}


def test_waehrung_und_ust_id_gegen_rechnung() -> None:
    wurzel = pruefung.xml_parsen(ubl(cur="DKK", vat="").encode())
    codes = {b.code for b in pruefung.pruefen(pruefung.kerndaten(wurzel, "ubl"), "xrechnung_ubl", RECHNUNG)}
    assert codes == {"waehrung_abweichend", "verkaeufer_ust_id_fehlt"}


# --- Anlegen / Idempotenz / Scope ----------------------------------------------


def test_anlegen_speichert_datei_und_zeile() -> None:
    svc, db = _svc()
    res = svc.create_einvoice(CTX, EInvoiceCreate(invoiceId="inv-1", format="xrechnung", xmlBase64=_b64(ubl())))
    assert res.format == "xrechnung_ubl"  # Bestandsname → genaue Syntax
    assert res.validation_status == "valid"
    assert res.version == 1
    assert res.invoice_number == "RE-2026-0001" and res.customer_name == "Amt Nord"
    assert res.download_path == f"/api/v1/buchhaltung/einvoices/{res.id}/xml"
    assert db.storage.uploads == [f"{TENANT}/inv-1/{res.xml_sha256}.xml"]
    zeile = db.tables["e_invoices"].rows[0]
    assert zeile["tenant_id"] == TENANT and zeile["created_by"] == "u1"


def test_anlegen_idempotent_gleicher_inhalt() -> None:
    svc, db = _svc()
    body = EInvoiceCreate(invoiceId="inv-1", format="xrechnung_ubl", xmlContent=ubl())
    a = svc.create_einvoice(CTX, body)
    b = svc.create_einvoice(CTX, body)
    assert a.id == b.id
    assert len(db.tables["e_invoices"].rows) == 1
    assert len(db.storage.uploads) == 1


def test_anlegen_neuer_inhalt_zaehlt_version() -> None:
    svc, _ = _svc()
    a = svc.create_einvoice(CTX, EInvoiceCreate(invoiceId="inv-1", format="xrechnung_ubl", xmlContent=ubl()))
    b = svc.create_einvoice(
        CTX, EInvoiceCreate(invoiceId="inv-1", format="xrechnung_ubl", xmlContent=ubl(ref=""))
    )
    assert (a.version, b.version) == (1, 2)
    assert b.validation_status == "invalid"
    assert b.findings[0].code == "leitweg_fehlt"


def test_unique_backstop_liefert_vorhandene_zeile() -> None:
    """Zwei Anlagen zwischen Prüfung und Insert: der 23505 des Index führt zur
    vorhandenen Zeile, nicht zu 500."""
    svc, db = _svc()
    body = EInvoiceCreate(invoiceId="inv-1", format="xrechnung_ubl", xmlContent=ubl())
    erste = svc.create_einvoice(CTX, body)
    # Die Vorab-Suche „übersieht" die Zeile — simuliert den Wettlauf.
    svc._vorhandene = lambda *_a, **_k: None  # type: ignore[method-assign]
    with pytest.raises(ERechnungError) as exc:
        svc.create_einvoice(CTX, body)
    assert exc.value.status_code == 409
    assert len(db.tables["e_invoices"].rows) == 1 and erste.version == 1


def test_format_passt_nicht_zur_syntax_422() -> None:
    svc, db = _svc()
    with pytest.raises(ERechnungError) as exc:
        svc.create_einvoice(CTX, EInvoiceCreate(invoiceId="inv-1", format="zugferd", xmlContent=ubl()))
    assert exc.value.status_code == 422
    assert db.storage.uploads == []


def test_doctype_im_upload_422() -> None:
    svc, _ = _svc()
    xml = '<!DOCTYPE x [<!ENTITY e "x">]>' + ubl()
    with pytest.raises(ERechnungError) as exc:
        svc.create_einvoice(CTX, EInvoiceCreate(invoiceId="inv-1", format="xrechnung_ubl", xmlContent=xml))
    assert exc.value.status_code == 422


def test_zu_gross_413() -> None:
    svc, _ = _svc()
    with pytest.raises(ERechnungError) as exc:
        svc.create_einvoice(
            CTX, EInvoiceCreate(invoiceId="inv-1", format="xrechnung_ubl", xmlContent="x" * (10 * 1024 * 1024 + 1))
        )
    assert exc.value.status_code == 413


def test_beide_oder_keine_quelle_422() -> None:
    svc, _ = _svc()
    with pytest.raises(ERechnungError) as exc:
        svc.create_einvoice(CTX, EInvoiceCreate(invoiceId="inv-1", format="xrechnung_ubl"))
    assert exc.value.status_code == 422


def test_unbekanntes_format_schema_fehler() -> None:
    with pytest.raises(ValueError):
        EInvoiceCreate(invoiceId="inv-1", format="pdf", xmlContent="<x/>")


def test_fremde_rechnung_404() -> None:
    svc, _ = _svc()
    with pytest.raises(ERechnungError) as exc:
        svc.create_einvoice(CTX_FREMD, EInvoiceCreate(invoiceId="inv-1", format="xrechnung_ubl", xmlContent=ubl()))
    assert exc.value.status_code == 404


def test_fremde_einvoice_404_ueberall() -> None:
    svc, _ = _svc()
    neu = svc.create_einvoice(CTX, EInvoiceCreate(invoiceId="inv-1", format="xrechnung_ubl", xmlContent=ubl()))
    for aufruf in (
        lambda: svc.get_einvoice(CTX_FREMD, neu.id),
        lambda: svc.validate_einvoice(CTX_FREMD, neu.id),
        lambda: svc.download_xml(CTX_FREMD, neu.id),
        lambda: svc.add_transmission(CTX_FREMD, neu.id, TransmissionCreate(channel="email")),
    ):
        with pytest.raises(ERechnungError) as exc:
            aufruf()
        assert exc.value.status_code == 404
    assert svc.list_einvoices(CTX_FREMD) == []


def test_ohne_tenant_403() -> None:
    svc, _ = _svc()
    with pytest.raises(ERechnungError) as exc:
        svc.list_einvoices(AuthContext(user_id="u", tenant_id=None, role="admin"))
    assert exc.value.status_code == 403


# --- Download / Validieren / Protokoll ------------------------------------------


def test_download_liefert_xml_und_protokolliert() -> None:
    svc, db = _svc()
    neu = svc.create_einvoice(CTX, EInvoiceCreate(invoiceId="inv-1", format="xrechnung_ubl", xmlContent=ubl()))
    daten, name = svc.download_xml(CTX, neu.id)
    assert daten == ubl().encode()
    assert name == "RE-2026-0001-xrechnung_ubl.xml"
    protokoll = db.tables["e_invoice_transmissions"].rows
    assert len(protokoll) == 1 and protokoll[0]["channel"] == "download"
    assert protokoll[0]["status"] == "downloaded" and protokoll[0]["tenant_id"] == TENANT
    detail = svc.get_einvoice(CTX, neu.id)
    assert [t.channel for t in detail.transmissions] == ["download"]


def test_download_erkennt_manipulierte_datei() -> None:
    svc, db = _svc()
    neu = svc.create_einvoice(CTX, EInvoiceCreate(invoiceId="inv-1", format="xrechnung_ubl", xmlContent=ubl()))
    pfad = db.storage.uploads[0]
    db.storage.dateien[pfad] = b"<x/>"
    with pytest.raises(ERechnungError) as exc:
        svc.download_xml(CTX, neu.id)
    assert exc.value.status_code == 500


def test_validate_prueft_gegen_aktuelle_rechnung() -> None:
    svc, db = _svc()
    neu = svc.create_einvoice(CTX, EInvoiceCreate(invoiceId="inv-1", format="xrechnung_ubl", xmlContent=ubl()))
    assert neu.validation_status == "valid"
    # Die Rechnung wurde nachträglich geändert → XML passt nicht mehr.
    db.tables["invoices"].rows[0]["gross_amount"] = "150.00"
    erneut = svc.validate_einvoice(CTX, neu.id)
    assert erneut.validation_status == "invalid"
    assert {b.code for b in erneut.findings} == {"betrag_abweichend"}


def test_transmission_failed_braucht_fehlertext() -> None:
    svc, _ = _svc()
    neu = svc.create_einvoice(CTX, EInvoiceCreate(invoiceId="inv-1", format="xrechnung_ubl", xmlContent=ubl()))
    with pytest.raises(ERechnungError) as exc:
        svc.add_transmission(CTX, neu.id, TransmissionCreate(channel="email", status="failed"))
    assert exc.value.status_code == 422
    ok = svc.add_transmission(
        CTX, neu.id,
        TransmissionCreate(channel="email", recipient="amt@example.org", status="sent", messageId="m1"),
    )
    assert ok.recipient == "amt@example.org" and ok.created_by == "u1"


# --- Einstellungen / Compliance ------------------------------------------------


def test_einstellungen_roundtrip_land_aus_tenant() -> None:
    svc, _ = _svc()
    leer = svc.get_settings(CTX)
    assert leer.configured is False and leer.country == "DK" and leer.mandatory_from is None
    voll = svc.put_settings(
        CTX,
        EInvoiceSettingsUpdate(defaultFormat="xrechnung_ubl", leitwegId=" 991-1234-56 ", mandatoryFrom=date(2027, 1, 1)),
    )
    assert voll.configured and voll.leitweg_id == "991-1234-56" and voll.country == "DK"
    assert voll.mandatory_from == date(2027, 1, 1)


def test_compliance_zeitraum_grenzen() -> None:
    svc, _ = _svc()
    with pytest.raises(ERechnungError) as exc:
        svc.compliance(CTX, von=date(2025, 1, 1), bis=date(2026, 9, 1))
    assert exc.value.status_code == 422
    with pytest.raises(ERechnungError) as exc:
        svc.compliance(CTX, von=date(2026, 9, 2), bis=date(2026, 9, 1))
    assert exc.value.status_code == 422


def test_compliance_zaehlt_und_findet_luecken() -> None:
    zweite = {**RECHNUNG, "id": "inv-2", "invoice_number": "RE-2026-0002", "customer_id": "k2"}
    dritte = {**RECHNUNG, "id": "inv-3", "status": "draft"}  # Entwurf zählt nicht
    svc, _ = _svc(
        invoices=[dict(RECHNUNG), zweite, dritte],
        customers=[dict(KUNDE), {"id": "k2", "tenant_id": TENANT, "name": "Firma B", "email": "b@x.dk"}],
    )
    svc.create_einvoice(CTX, EInvoiceCreate(invoiceId="inv-1", format="xrechnung_ubl", xmlContent=ubl()))
    c = svc.compliance(CTX, von=date(2026, 8, 1), bis=date(2026, 9, 30))
    assert (c.invoices_total, c.with_valid_einvoice, c.without_einvoice) == (2, 1, 1)
    assert c.valid_share_percent == 50.0
    luecken = {g.customer_id: g for g in c.customer_gaps}
    assert luecken["k1"].missing_email is True and luecken["k1"].missing_leitweg_id is True
    assert luecken["k2"].missing_email is False and luecken["k2"].missing_leitweg_id is True


def test_compliance_ohne_rechnungen_kein_prozent() -> None:
    svc, _ = _svc(invoices=[])
    c = svc.compliance(CTX)
    assert c.invoices_total == 0 and c.valid_share_percent is None


# --- Guard-Kette ---------------------------------------------------------------


def _guard_namen(route) -> set[str]:  # noqa: ANN001
    namen: set[str] = set()

    def _lauf(dep) -> None:  # noqa: ANN001
        for sub in dep.dependencies:
            namen.add(getattr(sub.call, "__name__", str(sub.call)))
            _lauf(sub)

    _lauf(route.dependant)
    return namen


def test_alle_routen_gegated() -> None:
    """Jede Route trägt Rollen-Guard UND Modul-Entitlement (guards.py)."""
    assert isinstance(erechnung_router, APIRouter)
    routen = [r for r in erechnung_router.routes if hasattr(r, "dependant")]
    assert len(routen) == 10
    for route in routen:
        namen = _guard_namen(route)
        assert "_require_agency_finance_with_modul" in namen, route.path
        assert "_require_agency_finance" in namen, route.path
