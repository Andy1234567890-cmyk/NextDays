"""Brücke Kalender-Angebot (booking_offers) → Buchhaltungs-Angebot (quotes), 0699.

„Reservierung mit Angebot" im Kalender legt ein ``booking_offer`` an: Preis-
Snapshot aus dem zentralen Resolver, Mail mit Annahmelink, Zahlungslink. Das
Buchhaltungsmodul führt Angebote in ``quotes`` (Nummernkreis AN-, Kunde,
Positionen, Umwandlung in eine Rechnung). Bis zum 13.09.2026 kannten sich beide
nicht: ein verschicktes Kalender-Angebot fehlte unter /buchhaltung/angebote.

Regeln:
* Gespiegelt wird nur, wenn der Betrieb das Buchhaltungsmodul gebucht hat
  (``modul3_buchhaltung``) — ohne Modul gibt es keine Buchhaltung, also auch
  keinen Spiegel.
* Positionen entstehen über ``reservation_invoice.build_positions`` — dieselbe
  Logik wie die Check-out-Rechnung (Brutto→Netto je Zeile, Abgaben 0 %,
  Übernachtungssatz aus Objekt oder Konto). Eine Quelle der Wahrheit.
* Der Debitor wird per E-Mail im Tenant gefunden oder angelegt (das Angebot
  geht an eine Adresse, die der Betrieb eintippt — es gibt noch keinen Gast).
* Der Spiegel ist BEST-EFFORT: schlägt er fehl (Steuersatz fehlt, Währung
  fehlt), bleibt das Kalender-Angebot gültig und der Fehler steht LAUT im Log —
  der Verkauf darf nicht an der Buchhaltung scheitern, aber die Buchhaltung
  darf auch nicht still leer bleiben.
* Statuswechsel des Kalender-Angebots ziehen den Spiegel nach
  (sent/viewed → sent, accepted/paid → accepted, declined → rejected,
  expired → expired, cancelled → cancelled). Umgewandelte Spiegel (Rechnung
  erzeugt) bleiben unberührt.
"""

from __future__ import annotations

import re
from datetime import UTC, date, datetime
from decimal import Decimal

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.subscriptions.entitlements import modul_aktiv

from . import doc_i18n
from .bereiche.versand.service import betrag_formatieren, datum_formatieren
from .guards import BUCHHALTUNG_MODULE_KEY
from .reservation_invoice import _property_vat_rate, build_positions
from .schemas import CustomerCreate, LineItemInput, QuoteCreate
from .service import BuchhaltungError, BuchhaltungService

log = get_logger("nextdays.buchhaltung.angebot_bruecke")

# Status des Kalender-Angebots → Status des Buchhaltungs-Angebots (+ Zeitfeld).
STATUS_SPIEGEL: dict[str, tuple[str, str | None]] = {
    "draft": ("draft", None),
    "sent": ("sent", "sent_at"),
    "viewed": ("sent", "sent_at"),
    "accepted": ("accepted", "accepted_at"),
    "paid": ("accepted", "accepted_at"),
    "declined": ("rejected", "rejected_at"),
    "expired": ("expired", None),
    "cancelled": ("cancelled", "cancelled_at"),
}


def _dec(wert: object) -> Decimal:
    return Decimal(str(wert or 0))


def _sprache(offer: dict) -> str:
    return doc_i18n.resolve_language(offer.get("language"))


# Texte des Spiegels, wenn der Betrieb keine eigene Standard-Textvorlage
# (Textvorlagen → Angebot → Kopf-/Fußtext) hinterlegt hat. Drei Sprachen der
# Kernmärkte ausformuliert; jede andere Dokumentsprache bekommt Englisch —
# ein englisches Anschreiben ist ehrlicher als ein deutsches an einen
# französischen Gast. Platzhalter wie in den Textvorlagen ([%NAME%]).
_TEXTE: dict[str, dict[str, str]] = {
    "de": {
        "betreff": "Angebot: Aufenthalt [%OBJEKT%], [%ANREISE%] – [%ABREISE%]",
        "kopf": (
            "Sehr geehrte/r [%KUNDENNAME%],<br/><br/>vielen Dank für Ihre Anfrage. "
            "Gerne bieten wir Ihnen den Aufenthalt in [%OBJEKT%] vom [%ANREISE%] bis "
            "[%ABREISE%] ([%NAECHTE%]) für [%PERSONEN%] an."
        ),
        "fuss": (
            "Dieses Angebot ist gültig bis [%GUELTIG_BIS%]. [%ZAHLUNG%] Die Buchung "
            "wird mit dem Zahlungseingang verbindlich. Zusagen und bezahlen können Sie "
            "über den Link in unserer E-Mail.<br/><br/>Mit freundlichen Grüßen"
        ),
        "anzahlung": (
            "Bei Annahme wird eine Anzahlung von [%ANZAHLUNG%] fällig, der Restbetrag "
            "von [%RESTBETRAG%] vor der Anreise."
        ),
        "gesamt": "Bei Annahme wird der Gesamtbetrag von [%BETRAG%] fällig.",
        "personen": "{n} Personen",
    },
    "en": {
        "betreff": "Offer: stay at [%OBJEKT%], [%ANREISE%] – [%ABREISE%]",
        "kopf": (
            "Dear [%KUNDENNAME%],<br/><br/>thank you for your enquiry. We are pleased to "
            "offer you a stay at [%OBJEKT%] from [%ANREISE%] to [%ABREISE%] "
            "([%NAECHTE%]) for [%PERSONEN%]."
        ),
        "fuss": (
            "This offer is valid until [%GUELTIG_BIS%]. [%ZAHLUNG%] The booking becomes "
            "binding once payment is received. You can accept and pay via the link in "
            "our e-mail.<br/><br/>Kind regards"
        ),
        "anzahlung": (
            "On acceptance a deposit of [%ANZAHLUNG%] is due; the balance of "
            "[%RESTBETRAG%] is due before arrival."
        ),
        "gesamt": "On acceptance the total of [%BETRAG%] is due.",
        "personen": "{n} guests",
    },
    "da": {
        "betreff": "Tilbud: ophold i [%OBJEKT%], [%ANREISE%] – [%ABREISE%]",
        "kopf": (
            "Kære [%KUNDENNAME%],<br/><br/>tak for din forespørgsel. Vi tilbyder dig gerne "
            "et ophold i [%OBJEKT%] fra [%ANREISE%] til [%ABREISE%] ([%NAECHTE%]) for "
            "[%PERSONEN%]."
        ),
        "fuss": (
            "Tilbuddet gælder til [%GUELTIG_BIS%]. [%ZAHLUNG%] Bookingen er bindende, "
            "når betalingen er modtaget. Du kan acceptere og betale via linket i vores "
            "e-mail.<br/><br/>Med venlig hilsen"
        ),
        "anzahlung": (
            "Ved accept forfalder en forudbetaling på [%ANZAHLUNG%]; restbeløbet på "
            "[%RESTBETRAG%] forfalder inden ankomst."
        ),
        "gesamt": "Ved accept forfalder det samlede beløb på [%BETRAG%].",
        "personen": "{n} personer",
    },
}
_PLATZHALTER_RE = re.compile(r"\[%([A-Z_]+)%\]")


def _texte(lang: str) -> dict[str, str]:
    return _TEXTE.get(lang, _TEXTE["en"])


def _platzhalter(offer: dict, property_title: str, lang: str) -> dict[str, str]:
    """Werte für die Platzhalter der Textvorlagen — Bestandsnamen (KUNDENNAME,
    BETRAG, GUELTIG_BIS, DATUM) plus die Aufenthaltsfelder des Angebots."""
    waehrung = str(offer.get("currency") or "") or None
    gesamt = _dec(offer.get("total_amount"))
    anzahlung = offer.get("deposit_amount")
    check_in, check_out = str(offer.get("check_in") or ""), str(offer.get("check_out") or "")
    try:
        naechte = (date.fromisoformat(check_out) - date.fromisoformat(check_in)).days
    except ValueError:
        naechte = 0
    personen = int(offer.get("adults") or 0) + int(offer.get("children") or 0)
    ablauf = offer.get("expires_at")
    gueltig = datetime.fromisoformat(str(ablauf).replace("Z", "+00:00")).date() if ablauf else None
    texte = _texte(lang)
    zahlung = (
        texte["anzahlung"] if anzahlung is not None else texte["gesamt"]
    )
    werte = {
        "KUNDENNAME": str(offer.get("guest_name") or ""),
        "VOLLEANREDE": str(offer.get("guest_name") or ""),
        "EMAIL": str(offer.get("guest_email") or ""),
        "OBJEKT": property_title,
        "ANREISE": doc_i18n.fmt_date(lang, check_in) if check_in else "",
        "ABREISE": doc_i18n.fmt_date(lang, check_out) if check_out else "",
        "NAECHTE": doc_i18n.nights_label(lang, naechte) if naechte > 0 else "",
        "PERSONEN": texte["personen"].format(n=personen) if personen > 0 else "",
        "BETRAG": betrag_formatieren(gesamt, waehrung, lang),
        "ANZAHLUNG": (
            betrag_formatieren(_dec(anzahlung), waehrung, lang) if anzahlung is not None else ""
        ),
        "RESTBETRAG": (
            betrag_formatieren(gesamt - _dec(anzahlung), waehrung, lang)
            if anzahlung is not None else ""
        ),
        "WAEHRUNG": waehrung or "",
        "GUELTIG_BIS": datum_formatieren(gueltig, lang),
        "DATUM": datum_formatieren(datetime.now(UTC).date(), lang),
        "ANGEBOTSDATUM": datum_formatieren(datetime.now(UTC).date(), lang),
    }
    werte["ZAHLUNG"] = _fuellen(zahlung, werte)
    return werte


def _fuellen(text: str, werte: dict[str, str]) -> str:
    return _PLATZHALTER_RE.sub(lambda m: werte.get(m.group(1), ""), text)


def _vorlage(db: Client, tenant_id: str, text_type: str, lang: str) -> str | None:
    """Standard-Textvorlage des Betriebs (Textvorlagen → Angebot → Kopf/Fuß):
    sprachspezifisch vor sprachneutral; None, wenn keine gepflegt ist."""
    rows = (
        db.table("text_templates")
        .select("text, language")
        .eq("tenant_id", tenant_id)
        .eq("category", "DOCUMENT")
        .eq("object_type", "QUOTE")
        .eq("text_type", text_type)
        .eq("is_default", True)
        .eq("is_private", False)
        .limit(10)
        .execute()
    ).data or []
    passend = [r for r in rows if r.get("language") == lang] or [
        r for r in rows if r.get("language") is None
    ]
    return str(passend[0]["text"]) if passend else None


def _dokumenttexte(db: Client, offer: dict, property_title: str) -> dict[str, str]:
    """Betreff, Anschreiben und Schlusstext des Spiegels — aus den Textvorlagen
    des Betriebs, sonst aus den eingebauten Texten; Platzhalter gefüllt."""
    lang = _sprache(offer)
    tenant_id = str(offer["tenant_id"])
    werte = _platzhalter(offer, property_title, lang)
    texte = _texte(lang)
    kopf = _vorlage(db, tenant_id, "HEAD", lang) or texte["kopf"]
    fuss = _vorlage(db, tenant_id, "FOOT", lang) or texte["fuss"]
    return {
        "title": _fuellen(texte["betreff"], werte)[:200],
        "head_text": _fuellen(kopf, werte),
        "footer_text": _fuellen(fuss, werte),
    }


def _debitor(db: Client, svc: BuchhaltungService, ctx: AuthContext, offer: dict) -> str | None:
    """Kunde zur Angebotsadresse: per E-Mail im Tenant finden, sonst anlegen."""
    tenant_id = str(offer["tenant_id"])
    email = str(offer.get("guest_email") or "").strip().lower()
    name = str(offer.get("guest_name") or "").strip()
    if email:
        rows = (
            db.table("customers")
            .select("id")
            .eq("tenant_id", tenant_id)
            .ilike("email", email)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data or []
        if rows:
            return str(rows[0]["id"])
    if not name:
        return None
    # Stammdaten aus dem Angebot (0703): Organisation → Debitor ist die Firma,
    # sonst die Person. Vorher entstand jeder Debitor als „private" OHNE
    # Anschrift, und der Editor zeigte ihn als Organisation (sein Vorgabewert).
    organisation = str(offer.get("guest_type") or "private") == "business"
    firma = str(offer.get("guest_company") or "").strip()
    anschrift = {
        k: str(offer.get(f"guest_{k}") or "").strip()
        for k in ("street", "postal_code", "city", "country")
    }
    neu = svc.create_customer(
        ctx,
        CustomerCreate(
            name=firma if organisation and firma else name,
            email=email or None,
            phone=offer.get("guest_phone") or None,
            customer_type="business" if organisation else "private",
            vat_id=(str(offer.get("guest_vat_id") or "").strip() or None),
            address={k: v for k, v in anschrift.items() if v},
            notes=(f"Ansprechperson: {name}" if organisation and firma else None),
        ),
    )
    log.info("angebot_bruecke_debitor_angelegt", tenant_id=tenant_id, customer_id=neu.id)
    return neu.id


def _positionen(db: Client, offer: dict, property_title: str) -> list[LineItemInput]:
    """Snapshot-Zeilen → Positionen mit Netto-Preis, Steuersatz und Basis."""
    tenant_id = str(offer["tenant_id"])
    profil = (
        db.table("tenant_billing_profile")
        .select("is_kleinunternehmer, lodging_tax_rate")
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    is_klein = bool(profil and profil[0].get("is_kleinunternehmer"))
    konto_satz = profil[0].get("lodging_tax_rate") if profil else None
    cfg = (
        db.table("property_pricing_config")
        .select("taxes")
        .eq("property_id", str(offer["property_id"]))
        .limit(1)
        .execute()
    ).data or []
    taxes = list((cfg[0].get("taxes") if cfg else None) or [])
    lodging_rate = _property_vat_rate(taxes)
    if lodging_rate is None and konto_satz is not None:
        lodging_rate = _dec(konto_satz)

    snapshot = offer.get("quote_snapshot") or {}
    lines = snapshot.get("lines") if isinstance(snapshot, dict) else None
    pseudo_reservation = {
        "quote_items": [
            {"label": ln.get("label"), "amount": ln.get("amount"), "kind": ln.get("kind"),
             "tax_rate": ln.get("tax_rate")}
            for ln in (lines or [])
            if isinstance(ln, dict)
        ],
        "total_amount": offer.get("total_amount"),
        "check_in": str(offer.get("check_in") or ""),
        "check_out": str(offer.get("check_out") or ""),
    }
    positionen = build_positions(
        pseudo_reservation,
        [],
        taxes,
        lodging_rate,
        is_klein,
        property_title,
        str(offer.get("language") or "de")[:2],
    )
    # Angebot ohne USt (0704): Snapshot ist netto mit 0 % je Zeile; der Beleg
    # trägt dieselbe Regel im Kopf und 0 % auf jeder Position (Σ Positionen ==
    # Kopf, wie beim Kleinunternehmer in `_compute_line`).
    ohne_ust = bool(offer.get("tax_rule"))
    return [
        LineItemInput(
            description=p["description"],
            quantity=p["quantity"],
            unit=p["unit"],
            unit_price=p["unit_price"],
            tax_rate=Decimal("0") if ohne_ust else p["tax_rate"],
            basis=p.get("basis"),
        )
        for p in positionen
    ]


def spiegel_anlegen(
    db: Client, ctx: AuthContext, offer: dict, property_title: str
) -> str | None:
    """Buchhaltungs-Angebot zum Kalender-Angebot anlegen; gibt die quote-ID zurück.

    ``None`` = kein Spiegel (Modul nicht gebucht) oder Spiegel fehlgeschlagen
    (dann steht der Grund im Log als ERROR). Idempotent: existiert schon ein
    Spiegel zu dieser Angebots-ID, wird er zurückgegeben (Unique 0699).
    """
    tenant_id = str(offer["tenant_id"])
    if not modul_aktiv(db, tenant_id, BUCHHALTUNG_MODULE_KEY):
        return None
    offer_id = str(offer["id"])
    vorhanden = (
        db.table("quotes")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("booking_offer_id", offer_id)
        .limit(1)
        .execute()
    ).data or []
    if vorhanden:
        return str(vorhanden[0]["id"])

    svc = BuchhaltungService(service_client=db)
    try:
        kunde_id = _debitor(db, svc, ctx, offer)
        items = _positionen(db, offer, property_title)
        ablauf = offer.get("expires_at")
        gueltig_bis = (
            datetime.fromisoformat(str(ablauf).replace("Z", "+00:00")).date()
            if ablauf else None
        )
        texte = _dokumenttexte(db, offer, property_title)
        angebot = svc.create_quote(
            ctx,
            QuoteCreate(
                customer_id=kunde_id,
                status="draft",
                issue_date=datetime.now(UTC).date(),
                valid_until=gueltig_bis,
                currency=str(offer.get("currency") or "") or None,
                tax_rule=offer.get("tax_rule") or None,
                head_text=texte["head_text"],
                footer_text=texte["footer_text"],
                notes=offer.get("internal_note") or None,
                language=_sprache(offer),
                items=items,
            ),
        )
        gaeste = int(offer.get("adults") or 0) + int(offer.get("children") or 0)
        db.table("quotes").update({
            "booking_offer_id": offer_id,
            "stay_from": str(offer.get("check_in") or "") or None,
            "stay_to": str(offer.get("check_out") or "") or None,
            "guest_count": gaeste or None,
            "title": texte["title"],
            "property_id": str(offer.get("property_id") or "") or None,
            "deposit_amount": (
                str(_dec(offer["deposit_amount"]))
                if offer.get("deposit_amount") is not None else None
            ),
        }).eq("id", angebot.id).eq("tenant_id", tenant_id).execute()
        log.info(
            "angebot_bruecke_gespiegelt",
            tenant_id=tenant_id,
            offer_id=offer_id,
            quote_id=angebot.id,
            quote_number=angebot.quote_number,
            positionen=len(items),
        )
        return angebot.id
    # Best-effort-Spiegel, laut geloggt — der Verkauf darf nicht daran scheitern.
    except (BuchhaltungError, APIError, ValueError) as exc:
        log.error(
            "angebot_bruecke_fehlgeschlagen",
            tenant_id=tenant_id,
            offer_id=offer_id,
            error=str(getattr(exc, "message", exc))[:300],
        )
        return None


def spiegel_status(db: Client, offer: dict) -> None:
    """Status des Kalender-Angebots auf den Spiegel übertragen (falls vorhanden)."""
    offer_id = str(offer.get("id") or "")
    tenant_id = str(offer.get("tenant_id") or "")
    ziel = STATUS_SPIEGEL.get(str(offer.get("status") or ""))
    if not offer_id or not tenant_id or ziel is None:
        return
    status, zeitfeld = ziel
    patch: dict[str, object] = {"status": status}
    if zeitfeld:
        patch[zeitfeld] = datetime.now(UTC).isoformat()
    try:
        rows = (
            db.table("quotes")
            .update(patch)
            .eq("tenant_id", tenant_id)
            .eq("booking_offer_id", offer_id)
            .is_("converted_invoice_id", "null")
            .neq("status", status)
            .execute()
        ).data or []
    except APIError as exc:  # noqa: BLE001 — Best-effort-Spiegel, laut geloggt
        log.error("angebot_bruecke_status_fehlgeschlagen", offer_id=offer_id, error=str(exc)[:300])
        return
    if rows:
        log.info("angebot_bruecke_status", offer_id=offer_id, status=status, anzahl=len(rows))


def spiegel_aktualisieren(db: Client, ctx: AuthContext, offer: dict, property_title: str) -> None:
    """Geändertes Kalender-Angebot → Spiegel inhaltlich nachziehen.

    Ohne Spiegel (Modul nicht gebucht / Anlage war fehlgeschlagen) wird einer
    angelegt. Ein umgewandelter oder angenommener Spiegel ist eingefroren —
    das meldet ``AngeboteBestand.aendern`` mit 409, hier als INFO geloggt:
    der Kalender darf sich ändern, die Buchhaltung bleibt beweiskräftig.
    """
    from .angebote_bestand import AngeboteBestand  # noqa: PLC0415 — zirkulär über service

    quote_id = offer.get("quote_id")
    if not quote_id:
        spiegel_anlegen(db, ctx, offer, property_title)
        return
    tenant_id = str(offer["tenant_id"])
    if not modul_aktiv(db, tenant_id, BUCHHALTUNG_MODULE_KEY):
        return
    try:
        items = _positionen(db, offer, property_title)
        ablauf = offer.get("expires_at")
        gaeste = int(offer.get("adults") or 0) + int(offer.get("children") or 0)
        payload: dict[str, object] = {
            "items": [
                {
                    "description": it.description,
                    "quantity": str(it.quantity),
                    "unit": it.unit,
                    "unitPrice": str(it.unit_price),
                    "taxRate": str(it.tax_rate),
                    "basis": it.basis,
                }
                for it in items
            ],
            "stayFrom": str(offer.get("check_in") or "") or None,
            "stayTo": str(offer.get("check_out") or "") or None,
            "guestCount": gaeste or None,
            "notes": offer.get("internal_note") or "",
            "language": _sprache(offer),
            "propertyId": str(offer.get("property_id") or "") or None,
            "depositAmount": (
                str(_dec(offer["deposit_amount"]))
                if offer.get("deposit_amount") is not None else ""
            ),
        }
        # Betreff/Anschreiben/Schlusstext folgen der Quelle (Zeitraum, Betrag,
        # Anzahlung stehen darin) — der Spiegel ist Abbild, kein zweites Original.
        texte = _dokumenttexte(db, offer, property_title)
        payload["title"] = texte["title"]
        payload["headTextHtml"] = texte["head_text"]
        payload["footerText"] = texte["footer_text"]
        if ablauf:
            payload["validUntil"] = str(ablauf)[:10]
        AngeboteBestand(BuchhaltungService(service_client=db)).aendern(ctx, str(quote_id), payload)
        log.info(
            "angebot_bruecke_nachgezogen",
            tenant_id=tenant_id,
            offer_id=str(offer.get("id") or ""),
            quote_id=str(quote_id),
            positionen=len(items),
        )
    except BuchhaltungError as exc:
        # 409 = eingefroren (angenommen/umgewandelt): kein Fehler, ein Zustand.
        stufe = log.info if exc.status_code == 409 else log.error
        stufe(
            "angebot_bruecke_nachziehen_abgelehnt",
            offer_id=str(offer.get("id") or ""),
            quote_id=str(quote_id),
            error=exc.message[:300],
        )
    except (APIError, ValueError) as exc:
        log.error(
            "angebot_bruecke_nachziehen_fehlgeschlagen",
            offer_id=str(offer.get("id") or ""),
            error=str(exc)[:300],
        )


# Positionen des Spiegels → Snapshot-Zeilen des Kalender-Angebots. Übernachtung
# erkennt die Brücke an der Basis je Nacht (0698), Abgaben an 0 % USt; alles
# andere ist eine Gebühr — dieselben Arten, die der Kalender selbst schreibt.
def _snapshot_kind(zeile: dict) -> str:
    if zeile.get("basis") == "per_night":
        return "lodging"
    if _dec(zeile.get("tax_rate")) == 0 and _dec(zeile.get("gross_amount")) > 0:
        return "tax"
    return "fee"


def quelle_nachziehen(db: Client, tenant_id: str, quote: dict) -> None:
    """Geänderter Spiegel → Kalender-Angebot (Quelle) nachziehen.

    Der Buchhaltungs-Editor ist die Bearbeitungsoberfläche des Angebots; der
    Annahmelink des Gastes liest aber ``booking_offers``. Ohne diesen Rückweg
    zeigte das PDF 3 Nächte und der Link 2. Nur offene Angebote (Entwurf,
    verschickt, geöffnet) folgen — angenommene/bezahlte sind Vertragsstand.
    Best-effort mit lautem Log; der Editor-Save scheitert nicht daran.
    """
    offer_id = str(quote.get("booking_offer_id") or "")
    if not offer_id:
        return
    try:
        offers = (
            db.table("booking_offers")
            .select("id, status, adults, children, quote_snapshot")
            .eq("id", offer_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not offers or str(offers[0].get("status")) not in {"draft", "sent", "viewed"}:
            return
        offer = offers[0]
        zeilen = (
            db.table("quote_line_items")
            .select("description, gross_amount, tax_rate, basis, position")
            .eq("quote_id", str(quote["id"]))
            .order("position")
            .execute()
        ).data or []
        kunde = (
            db.table("customers")
            .select("name, email")
            .eq("id", str(quote.get("customer_id") or ""))
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or [] if quote.get("customer_id") else []
        gesamt = _dec(quote.get("gross_amount"))
        alt = offer.get("quote_snapshot") if isinstance(offer.get("quote_snapshot"), dict) else {}
        snapshot = {
            **alt,
            "lines": [
                {
                    "label": str(z.get("description") or ""),
                    "amount": float(_dec(z.get("gross_amount"))),
                    "kind": _snapshot_kind(z),
                    "tax_rate": float(_dec(z.get("tax_rate"))),
                }
                for z in zeilen
            ],
            "total": float(gesamt),
            "check_in": quote.get("stay_from") or alt.get("check_in"),
            "check_out": quote.get("stay_to") or alt.get("check_out"),
            "currency": quote.get("currency") or alt.get("currency"),
            "quelle": "buchhaltung_editor",
        }
        patch: dict[str, object] = {
            "quote_snapshot": snapshot,
            "total_amount": float(gesamt),
            "currency": quote.get("currency"),
        }
        if quote.get("stay_from") and quote.get("stay_to"):
            patch["check_in"] = quote["stay_from"]
            patch["check_out"] = quote["stay_to"]
        gaeste = quote.get("guest_count")
        if gaeste:
            kinder = int(offer.get("children") or 0)
            patch["adults"] = max(int(gaeste) - kinder, 1)
        if quote.get("valid_until"):
            patch["expires_at"] = f"{quote['valid_until']}T23:59:59+00:00"
        # Anzahlung: der Editor ist die Bearbeitungsoberfläche — None heißt
        # „Gesamtbetrag sofort", das darf hier NICHT zu „unverändert" werden.
        anzahlung = quote.get("deposit_amount")
        patch["deposit_amount"] = float(_dec(anzahlung)) if anzahlung is not None else None
        if kunde:
            patch["guest_name"] = kunde[0].get("name") or None
            if kunde[0].get("email"):
                patch["guest_email"] = kunde[0]["email"]
        patch = {k: v for k, v in patch.items() if v is not None or k == "deposit_amount"}
        db.table("booking_offers").update(patch).eq("id", offer_id).eq(
            "tenant_id", tenant_id
        ).execute()
        log.info(
            "angebot_bruecke_quelle_nachgezogen",
            tenant_id=tenant_id,
            offer_id=offer_id,
            quote_id=str(quote.get("id") or ""),
            felder=sorted(patch),
        )
    except (APIError, ValueError) as exc:
        log.error(
            "angebot_bruecke_quelle_fehlgeschlagen",
            offer_id=offer_id,
            error=str(exc)[:300],
        )
