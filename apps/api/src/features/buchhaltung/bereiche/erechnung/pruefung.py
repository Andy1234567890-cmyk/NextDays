"""XML-Prüfung des Bereichs »erechnung«: Wohlgeformtheit + EN-16931-Kern.

Zwei Stufen, bewusst getrennt:

1. `xml_parsen` — ist das überhaupt XML, und ist es ungefährlich? Ein Client-
   XML ist ein Angriff, bis das Gegenteil feststeht (Wurzel 8): DOCTYPE- und
   ENTITY-Deklarationen werden VOR dem Parsen abgelehnt (XXE, Billion Laughs);
   ohne DOCTYPE kann expat keine Entität expandieren. Es gibt kein
   `defusedxml` im Projekt — der Vor-Scan auf den Roh-Bytes ist die
   Allowlist: eine E-Rechnung nach EN 16931 enthält nie eine DTD.
2. `pruefen` — Pflichtfelder und Summen des EN-16931-Kerns, als Befunde
   (nicht als Exception): eine unvollständige E-Rechnung wird GESPEICHERT und
   als `invalid` gekennzeichnet, damit der Betrieb sieht, WAS fehlt. Nur die
   Grenze „Format passt nicht zum Inhalt" ist ein 422 (Service).

Was der Browser-Erzeuger baut (web/services/eInvoiceService.ts), wird hier
gelesen: XRechnung als UBL (`Invoice`), ZUGFeRD/XRechnung-CII als
`rsm:CrossIndustryInvoice`. Die Business Terms (BT-n) stehen an jedem Befund,
damit die Oberfläche auf die Norm verweisen kann statt auf XPath.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, InvalidOperation
from xml.etree import ElementTree as ET  # noqa: S405 — DOCTYPE/ENTITY werden vorab abgelehnt

from .schemas import Finding

NS = {
    "ubl": "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
    "cac": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
    "cbc": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
    "rsm": "urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100",
    "ram": "urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100",
    "udt": "urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100",
}
_WURZEL_UBL = f"{{{NS['ubl']}}}Invoice"
_WURZEL_CII = f"{{{NS['rsm']}}}CrossIndustryInvoice"
# Welche Syntax ein Format verlangt.
SYNTAX_JE_FORMAT: dict[str, str] = {
    "xrechnung_ubl": "ubl",
    "xrechnung_cii": "cii",
    "zugferd_en16931": "cii",
}
_VERBOTEN = re.compile(rb"<!\s*(doctype|entity)", re.IGNORECASE)
_ZWEI = Decimal("0.01")


class XmlUngueltig(Exception):
    """Kein verwertbares XML — Wohlgeformtheit oder Sicherheitsgrenze verletzt."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


def xml_parsen(daten: bytes) -> ET.Element:
    """Roh-Bytes → Wurzelelement. Wirft `XmlUngueltig` bei DOCTYPE/ENTITY,
    leerem Inhalt oder Parserfehler."""
    if not daten.strip():
        raise XmlUngueltig("XML ist leer.")
    if _VERBOTEN.search(daten):
        raise XmlUngueltig(
            "XML enthält eine DOCTYPE- oder ENTITY-Deklaration — in einer "
            "E-Rechnung nicht zulässig."
        )
    try:
        return ET.fromstring(daten)  # noqa: S314 — kein DOCTYPE mehr möglich (Vor-Scan)
    except ET.ParseError as exc:
        raise XmlUngueltig(f"XML ist nicht wohlgeformt: {exc}") from exc


def syntax_erkennen(wurzel: ET.Element) -> str | None:
    """'ubl' | 'cii' | None (fremde Wurzel)."""
    if wurzel.tag == _WURZEL_UBL:
        return "ubl"
    if wurzel.tag == _WURZEL_CII:
        return "cii"
    return None


# --- Kerndaten -----------------------------------------------------------------


@dataclass
class Kerndaten:
    """Die BT-Felder, die die Kernprüfung braucht — syntaxneutral."""

    number: str | None = None
    issue_date: str | None = None
    due_date: str | None = None
    currency: str | None = None
    buyer_reference: str | None = None
    seller_name: str | None = None
    seller_vat: str | None = None
    seller_tax_id: str | None = None
    buyer_name: str | None = None
    payment_terms: str | None = None
    line_total: Decimal | None = None
    tax_exclusive: Decimal | None = None
    tax_total: Decimal | None = None
    tax_inclusive: Decimal | None = None
    prepaid: Decimal | None = None
    payable: Decimal | None = None
    line_amounts: list[Decimal] = field(default_factory=list)
    tax_subtotals: list[Decimal] = field(default_factory=list)
    line_count: int = 0


def _text(el: ET.Element, pfad: str) -> str | None:
    wert = el.findtext(pfad, namespaces=NS)
    if wert is None:
        return None
    wert = wert.strip()
    return wert or None


def _dec(wert: str | None) -> Decimal | None:
    if wert is None:
        return None
    try:
        return Decimal(wert).quantize(_ZWEI)
    except InvalidOperation:
        return None


def _decs(el: ET.Element, pfad: str) -> list[Decimal]:
    return [d for e in el.findall(pfad, namespaces=NS) if (d := _dec((e.text or "").strip()))]


def _datum_102(wert: str | None) -> str | None:
    """CII `format="102"` (JJJJMMTT) → ISO; andere Werte unverändert."""
    if wert and re.fullmatch(r"\d{8}", wert):
        return f"{wert[:4]}-{wert[4:6]}-{wert[6:]}"
    return wert


def kerndaten_ubl(w: ET.Element) -> Kerndaten:
    verk = "cac:AccountingSupplierParty/cac:Party/"
    kauf = "cac:AccountingCustomerParty/cac:Party/"
    summe = "cac:LegalMonetaryTotal/"
    return Kerndaten(
        number=_text(w, "cbc:ID"),
        issue_date=_text(w, "cbc:IssueDate"),
        due_date=_text(w, "cbc:DueDate"),
        currency=_text(w, "cbc:DocumentCurrencyCode"),
        buyer_reference=_text(w, "cbc:BuyerReference"),
        seller_name=_text(w, verk + "cac:PartyName/cbc:Name")
        or _text(w, verk + "cac:PartyLegalEntity/cbc:RegistrationName"),
        seller_vat=_text(w, verk + "cac:PartyTaxScheme/cbc:CompanyID"),
        seller_tax_id=_text(w, verk + "cac:PartyLegalEntity/cbc:CompanyID"),
        buyer_name=_text(w, kauf + "cac:PartyName/cbc:Name")
        or _text(w, kauf + "cac:PartyLegalEntity/cbc:RegistrationName"),
        payment_terms=_text(w, "cac:PaymentTerms/cbc:Note"),
        line_total=_dec(_text(w, summe + "cbc:LineExtensionAmount")),
        tax_exclusive=_dec(_text(w, summe + "cbc:TaxExclusiveAmount")),
        tax_total=_dec(_text(w, "cac:TaxTotal/cbc:TaxAmount")),
        tax_inclusive=_dec(_text(w, summe + "cbc:TaxInclusiveAmount")),
        prepaid=_dec(_text(w, summe + "cbc:PrepaidAmount")),
        payable=_dec(_text(w, summe + "cbc:PayableAmount")),
        line_amounts=_decs(w, "cac:InvoiceLine/cbc:LineExtensionAmount"),
        tax_subtotals=_decs(w, "cac:TaxTotal/cac:TaxSubtotal/cbc:TaxAmount"),
        line_count=len(w.findall("cac:InvoiceLine", namespaces=NS)),
    )


def _cii_steuer_id(w: ET.Element, schema: str) -> str | None:
    pfad = (
        "rsm:SupplyChainTradeTransaction/ram:ApplicableHeaderTradeAgreement/"
        "ram:SellerTradeParty/ram:SpecifiedTaxRegistration/ram:ID"
    )
    for el in w.findall(pfad, namespaces=NS):
        if el.get("schemeID") == schema and (el.text or "").strip():
            return el.text.strip()  # type: ignore[union-attr]
    return None


def kerndaten_cii(w: ET.Element) -> Kerndaten:
    trans = "rsm:SupplyChainTradeTransaction/"
    vertrag = trans + "ram:ApplicableHeaderTradeAgreement/"
    abrech = trans + "ram:ApplicableHeaderTradeSettlement/"
    summe = abrech + "ram:SpecifiedTradeSettlementHeaderMonetarySummation/"
    zeilen = trans + "ram:IncludedSupplyChainTradeLineItem"
    return Kerndaten(
        number=_text(w, "rsm:ExchangedDocument/ram:ID"),
        issue_date=_datum_102(
            _text(w, "rsm:ExchangedDocument/ram:IssueDateTime/udt:DateTimeString")
        ),
        due_date=_datum_102(
            _text(
                w,
                abrech + "ram:SpecifiedTradePaymentTerms/ram:DueDateDateTime/udt:DateTimeString",
            )
        ),
        currency=_text(w, abrech + "ram:InvoiceCurrencyCode"),
        buyer_reference=_text(w, vertrag + "ram:BuyerReference"),
        seller_name=_text(w, vertrag + "ram:SellerTradeParty/ram:Name"),
        seller_vat=_cii_steuer_id(w, "VA"),
        seller_tax_id=_cii_steuer_id(w, "FC"),
        buyer_name=_text(w, vertrag + "ram:BuyerTradeParty/ram:Name"),
        payment_terms=_text(w, abrech + "ram:SpecifiedTradePaymentTerms/ram:Description"),
        line_total=_dec(_text(w, summe + "ram:LineTotalAmount")),
        tax_exclusive=_dec(_text(w, summe + "ram:TaxBasisTotalAmount")),
        tax_total=_dec(_text(w, summe + "ram:TaxTotalAmount")),
        tax_inclusive=_dec(_text(w, summe + "ram:GrandTotalAmount")),
        prepaid=_dec(_text(w, summe + "ram:TotalPrepaidAmount")),
        payable=_dec(_text(w, summe + "ram:DuePayableAmount")),
        line_amounts=_decs(
            w,
            zeilen + "/ram:SpecifiedLineTradeSettlement/"
            "ram:SpecifiedTradeSettlementLineMonetarySummation/ram:LineTotalAmount",
        ),
        tax_subtotals=_decs(w, abrech + "ram:ApplicableTradeTax/ram:CalculatedAmount"),
        line_count=len(w.findall(zeilen, namespaces=NS)),
    )


def kerndaten(wurzel: ET.Element, syntax: str) -> Kerndaten:
    return kerndaten_ubl(wurzel) if syntax == "ubl" else kerndaten_cii(wurzel)


# --- Kernprüfung ---------------------------------------------------------------


def _fehlt(code: str, bt: str, was: str) -> Finding:
    return Finding(code=code, severity="error", bt=bt, message=f"Pflichtfeld fehlt: {was} ({bt}).")


def _iso_datum(wert: str | None) -> bool:
    if not wert:
        return False
    try:
        date.fromisoformat(wert)
    except ValueError:
        return False
    return True


def _pflichtfelder(k: Kerndaten, fmt: str) -> list[Finding]:
    b: list[Finding] = []
    if not k.number:
        b.append(_fehlt("nummer_fehlt", "BT-1", "Rechnungsnummer"))
    if not _iso_datum(k.issue_date):
        b.append(_fehlt("rechnungsdatum_fehlt", "BT-2", "Rechnungsdatum (ISO-Datum)"))
    if not k.currency:
        b.append(_fehlt("waehrung_fehlt", "BT-5", "Rechnungswährung"))
    if not k.buyer_reference:
        # XRechnung: BT-10 ist Pflicht (Leitweg-ID). ZUGFeRD EN 16931: nur
        # empfohlen — deshalb Warnung, kein Fehler.
        schwere = "error" if fmt.startswith("xrechnung") else "warning"
        b.append(
            Finding(
                code="leitweg_fehlt",
                severity=schwere,
                bt="BT-10",
                message="Käuferreferenz/Leitweg-ID fehlt (BT-10).",
            )
        )
    if not k.seller_name:
        b.append(_fehlt("verkaeufer_fehlt", "BT-27", "Name des Verkäufers"))
    if not k.seller_vat and not k.seller_tax_id:
        b.append(
            _fehlt("verkaeufer_ust_id_fehlt", "BT-31", "USt-IdNr. oder Steuernummer des Verkäufers")
        )
    if not k.buyer_name:
        b.append(_fehlt("kaeufer_fehlt", "BT-44", "Name des Käufers"))
    if not k.due_date and not k.payment_terms:
        b.append(
            Finding(
                code="zahlungsbedingungen_fehlen",
                severity="error",
                bt="BT-9",
                message="Weder Fälligkeitsdatum (BT-9) noch Zahlungsbedingungen (BT-20) vorhanden.",
            )
        )
    return b


def _ungleich(code: str, regel: str, text: str) -> Finding:
    return Finding(code=code, severity="error", bt=regel, message=text)


def _summen(k: Kerndaten) -> list[Finding]:
    b: list[Finding] = []
    if k.tax_exclusive is None or k.tax_inclusive is None or k.payable is None:
        b.append(_fehlt("summen_fehlen", "BT-109", "Nettosumme, Bruttosumme oder Zahlbetrag"))
        return b
    steuer = k.tax_total if k.tax_total is not None else Decimal("0.00")
    if k.tax_exclusive + steuer != k.tax_inclusive:
        b.append(
            _ungleich(
                "brutto_inkonsistent",
                "BR-CO-15",
                f"Netto {k.tax_exclusive} + Steuer {steuer} ≠ Brutto {k.tax_inclusive}.",
            )
        )
    vorab = k.prepaid if k.prepaid is not None else Decimal("0.00")
    if k.tax_inclusive - vorab != k.payable:
        b.append(
            _ungleich(
                "zahlbetrag_inkonsistent",
                "BR-CO-16",
                f"Brutto {k.tax_inclusive} − Vorauszahlung {vorab} ≠ Zahlbetrag {k.payable}.",
            )
        )
    zeilen = sum(k.line_amounts, Decimal(0))
    if k.line_count and k.line_total is not None and zeilen != k.line_total:
        b.append(
            _ungleich(
                "positionen_inkonsistent",
                "BR-CO-10",
                f"Summe der Positionen {zeilen} ≠ Positionssumme {k.line_total}.",
            )
        )
    teil = sum(k.tax_subtotals, Decimal(0))
    if k.tax_subtotals and k.tax_total is not None and teil != k.tax_total:
        b.append(
            _ungleich(
                "steuer_inkonsistent",
                "BR-CO-14",
                f"Summe der Steuerteilbeträge {teil} ≠ Steuersumme {k.tax_total}.",
            )
        )
    return b


def _gegen_rechnung(k: Kerndaten, rechnung: dict) -> list[Finding]:
    """Das XML muss die GESPEICHERTE Rechnung wiedergeben — Betrag, Währung,
    Nummer. Eine E-Rechnung mit anderem Betrag als der Beleg ist kein
    Formfehler, sondern eine falsche Aussage gegenüber dem Empfänger."""
    b: list[Finding] = []
    waehrung = str(rechnung.get("currency") or "").strip()
    if waehrung and k.currency and k.currency != waehrung:
        b.append(
            _ungleich(
                "waehrung_abweichend",
                "BT-5",
                f"Währung im XML ({k.currency}) ≠ Währung der Rechnung ({waehrung}).",
            )
        )
    brutto = rechnung.get("gross_amount")
    if brutto not in (None, "") and k.tax_inclusive is not None:
        soll = Decimal(str(brutto)).quantize(_ZWEI)
        if soll != k.tax_inclusive:
            b.append(
                _ungleich(
                    "betrag_abweichend",
                    "BT-112",
                    f"Bruttobetrag im XML ({k.tax_inclusive}) ≠ Rechnung ({soll}).",
                )
            )
    nummer = str(rechnung.get("invoice_number") or "").strip()
    if nummer and k.number and k.number != nummer:
        b.append(
            _ungleich(
                "nummer_abweichend",
                "BT-1",
                f"Rechnungsnummer im XML ({k.number}) ≠ Rechnung ({nummer}).",
            )
        )
    return b


def pruefen(k: Kerndaten, fmt: str, rechnung: dict) -> list[Finding]:
    """Alle Befunde der Kernprüfung. Leer = gültig."""
    return _pflichtfelder(k, fmt) + _summen(k) + _gegen_rechnung(k, rechnung)


def status_aus(befunde: list[Finding]) -> str:
    return "invalid" if any(b.severity == "error" for b in befunde) else "valid"
