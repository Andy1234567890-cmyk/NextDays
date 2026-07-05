"""Stornorechnung (GoBD-Korrekturweg): negierter ST-Beleg zur Original-Rechnung.

Eigenes Modul (Slice-Konvention: service.py bleibt dünner Facade-Layer) —
BuchhaltungService delegiert hierher. Idempotent: existiert der Storno-Beleg
bereits (Retry nach Teilfehler), wird er zurückgegeben und das Original sicher
auf 'cancelled' gesetzt (gibt den partiellen Unique-Index
invoices_reservation_active_uq aus 0092 für eine korrigierte Rechnung frei).
"""
from datetime import UTC, datetime
from decimal import Decimal

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger

from .service import BuchhaltungError, _num, _q, _row_to_invoicedata

log = get_logger("nextdays.buchhaltung.storno")


def create_storno_invoice(
    db: Client, tenant_id: str, invoice_id: str, reason: str
) -> dict:
    """Stornorechnung erzeugen: negierter Beleg (invoice_type='storno',
    ST-Nummernkreis, original_invoice_id-Verweis), Original → 'cancelled'.
    Kein Löschen: beide Belege bleiben lückenlos erhalten."""
    clean_reason = (reason or "").strip()
    if not clean_reason:
        raise BuchhaltungError(
            "Eine Begründung ist für die Stornorechnung erforderlich.",
            status_code=422,
        )
    rows = (
        db.table("invoices")
        .select("*")
        .eq("id", invoice_id)
        .eq("tenant_id", tenant_id)
        .is_("deleted_at", "null")
        .limit(1)
        .execute()
    ).data
    if not rows:
        raise BuchhaltungError("Rechnung nicht gefunden.", status_code=404)
    original = rows[0]
    if original.get("invoice_type") != "invoice":
        raise BuchhaltungError(
            "Nur Rechnungen können storniert werden (keine Storno-/"
            "Gutschriftbelege).",
            status_code=409,
        )
    if original.get("status") == "cancelled":
        raise BuchhaltungError("Rechnung ist bereits storniert.", status_code=409)
    # Nur AUSGESTELLTE (finalisierte, nummerierte) Rechnungen sind stornierbar. Ein
    # Entwurf (status='draft', invoice_number=NULL) ist noch kein Beleg — ein Storno
    # darauf würde eine Gutschrift auf einen nicht existenten Beleg erzeugen (GoBD-
    # Verstoß), eine echte ST-Nummer verbrennen (dauerhafte Lücke im Nummernkreis)
    # und den Entwurf unrettbar auf 'cancelled' setzen (nicht mehr editier-/löschbar).
    # Entwürfe werden stattdessen gelöscht/bearbeitet, nicht storniert.
    if original.get("status") == "draft" or not original.get("invoice_number"):
        raise BuchhaltungError(
            "Nur ausgestellte Rechnungen sind stornierbar. Ein Entwurf lässt sich "
            "direkt bearbeiten oder löschen.",
            status_code=409,
        )
    existing_storno = (
        db.table("invoices")
        .select("*")
        .eq("tenant_id", tenant_id)
        .eq("original_invoice_id", invoice_id)
        .eq("invoice_type", "storno")
        .is_("deleted_at", "null")
        .limit(1)
        .execute()
    ).data
    if existing_storno:
        # Idempotent + Selbstreparatur (siehe Modul-Docstring).
        db.table("invoices").update(
            {"status": "cancelled", "storno_reason": clean_reason}
        ).eq("id", invoice_id).eq("tenant_id", tenant_id).execute()
        return _storno_response(db, tenant_id, existing_storno[0])

    num = (
        db.rpc(
            "next_document_number",
            {"p_tenant_id": tenant_id, "p_doc_type": "storno", "p_prefix": "ST-"},
        ).execute()
    ).data or [{}]
    storno_number = num[0].get("formatted_number")
    if not storno_number:
        raise BuchhaltungError(
            "Storno-Nummer konnte nicht gezogen werden.", status_code=500
        )

    def neg(value: object) -> str:
        return str(_q(-Decimal(str(value or 0))))

    today = datetime.now(UTC).date().isoformat()
    storno_row = {
        "tenant_id": tenant_id,
        "customer_id": original.get("customer_id"),
        "reservation_id": original.get("reservation_id"),
        "invoice_number": storno_number,
        "invoice_sequence": num[0].get("sequential_number"),
        "invoice_year": int(today[:4]),
        "invoice_type": "storno",
        "status": "finalized",
        "issue_date": today,
        "due_date": today,
        "currency": original.get("currency"),
        "net_amount": neg(original.get("net_amount")),
        "tax_amount": neg(original.get("tax_amount")),
        "gross_amount": neg(original.get("gross_amount")),
        "tax_rate": original.get("tax_rate"),
        "tax_rule": original.get("tax_rule"),
        "is_kleinunternehmer": original.get("is_kleinunternehmer"),
        # Dokumentsprache der Originalrechnung erben (0099): die Positions-
        # texte werden 1:1 übernommen, also muss der Storno-Beleg dieselbe
        # Sprache tragen — sonst italienische Positionen unter deutschem PDF.
        "language": original.get("language"),
        "original_invoice_id": invoice_id,
        "storno_reason": clean_reason,
        "head_text": (
            f"Stornorechnung zu Rechnung "
            f"{original.get('invoice_number')} — {clean_reason}"
        ),
    }
    storno_row = {k: v for k, v in storno_row.items() if v is not None}
    try:
        ins = db.table("invoices").insert(storno_row).execute()
    except APIError as exc:
        # Doppel-Storno-Race (0110 Unique-Index): ein paralleler Request hat den
        # Storno schon angelegt. Idempotent den existierenden zurückgeben statt
        # eine zweite Gutschrift zu erzeugen.
        if "invoices_storno_per_original_uidx" not in str(exc):
            raise
        dupe = (
            db.table("invoices")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("original_invoice_id", invoice_id)
            .eq("invoice_type", "storno")
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data
        if dupe:
            db.table("invoices").update(
                {"status": "cancelled", "storno_reason": clean_reason}
            ).eq("id", invoice_id).eq("tenant_id", tenant_id).execute()
            return _storno_response(db, tenant_id, dupe[0])
        raise BuchhaltungError(
            "Stornorechnung konnte nicht gespeichert werden.", status_code=500
        ) from exc
    if not ins.data:
        raise BuchhaltungError(
            "Stornorechnung konnte nicht gespeichert werden.", status_code=500
        )
    storno = ins.data[0]

    lines = (
        db.table("invoice_line_items")
        .select("*")
        .eq("invoice_id", invoice_id)
        .order("position")
        .execute()
    ).data or []
    if lines:
        try:
            db.table("invoice_line_items").insert(
                [
                    {
                        "invoice_id": storno["id"],
                        "position": li.get("position"),
                        "description": li.get("description"),
                        "quantity": li.get("quantity"),
                        "unit": li.get("unit"),
                        "unit_price": neg(li.get("unit_price")),
                        "tax_rate": li.get("tax_rate"),
                        "discount_percent": li.get("discount_percent"),
                        "net_amount": neg(li.get("net_amount")),
                        "tax_amount": neg(li.get("tax_amount")),
                        "gross_amount": neg(li.get("gross_amount")),
                    }
                    for li in lines
                ]
            ).execute()
        except APIError as exc:
            # Storno-Kopf ist schon geschrieben, das Original aber noch NICHT
            # storniert. Schlägt der Positions-Insert fehl, bliebe ein leerer
            # Storno-Kopf zurück, den ein Retry (über existing_storno) fälschlich
            # als fertigen, positionslosen Beleg ausgäbe. Kopf zurückrollen, damit
            # der Retry sauber von vorn beginnt.
            db.table("invoices").delete().eq("id", storno["id"]).eq(
                "tenant_id", tenant_id
            ).execute()
            raise BuchhaltungError(
                "Storno-Positionen konnten nicht gespeichert werden.",
                status_code=500,
            ) from exc

    # Original als storniert markieren — gibt den Unique-Index frei.
    db.table("invoices").update(
        {"status": "cancelled", "storno_reason": clean_reason}
    ).eq("id", invoice_id).eq("tenant_id", tenant_id).execute()

    log.info(
        "invoice_storno_created",
        invoice_id=invoice_id,
        storno_id=storno["id"],
        storno_number=storno_number,
    )
    return _storno_response(db, tenant_id, storno)


def _storno_response(db: Client, tenant_id: str, storno: dict) -> dict:
    """Storno-Beleg als InvoiceData inkl. Positionen + Kundendaten —
    StornoInvoice.tsx rendert die Antwort direkt als Dokument/PDF, ohne
    Positionen wäre das Storno-Dokument leer."""
    customer_name = None
    customer_email = ""
    if storno.get("customer_id"):
        cust = (
            db.table("customers")
            .select("name, email")
            .eq("id", storno["customer_id"])
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if cust:
            customer_name = cust[0].get("name")
            customer_email = cust[0].get("email") or ""
    lines = (
        db.table("invoice_line_items")
        .select("*")
        .eq("invoice_id", storno["id"])
        .order("position")
        .execute()
    ).data or []
    result = _row_to_invoicedata(storno, customer_name)
    result["customerEmail"] = customer_email
    result["items"] = [
        {
            "id": li.get("id") or f"pos-{li.get('position')}",
            "description": li.get("description") or "",
            "quantity": _num(li.get("quantity")),
            "unitPrice": _num(li.get("unit_price")),
            "taxRate": _num(li.get("tax_rate")),
            "unit": li.get("unit") or "",
            "discountPercent": _num(li.get("discount_percent")),
            "total": _num(li.get("net_amount")),
        }
        for li in lines
    ]
    return result
