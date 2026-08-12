"""Zahlungsplan, Storno-Staffel und Kaution einer Buchungskondition.

EINE Wahrheit für zwei Seiten, die dasselbe versprechen müssen:
* der Gast-Checkout (`booking_engine.public_quote`) ZEIGT den Plan,
* der Einzug (`payments.create_booking_payment_scheduled`) VOLLZIEHT ihn.

Vorher lagen die Rechenregeln nur im Payments-Service. Ein Checkout, der sie
nachbaut, wäre die zweite Wahrheit — und genau die Stelle, an der die Anzeige
„30 % jetzt" sagt und die Karte den vollen Betrag zieht. Deshalb liegen sie hier
und werden von beiden Seiten aufgerufen.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from supabase import Client


def kondition_fuer(
    db: Client, *, tenant_id: str, rate_plan_id: str | None = None
) -> dict[str, Any] | None:
    """Die geltende Kondition: erst über den Rate-Plan
    (`rate_plans.booking_condition_id`), sonst die Standard-Kondition des
    Betriebs (`is_default`).

    None = der Betrieb hat keine Kondition gepflegt. Dann gilt „alles sofort
    fällig" — das ist kein erfundener Wert, sondern der dokumentierte
    Ausgangszustand des Zahlungspfads.
    """
    condition_id: str | None = None
    if rate_plan_id:
        rp = (
            db.table("rate_plans")
            .select("booking_condition_id")
            .eq("id", rate_plan_id)
            .limit(1)
            .execute()
        ).data
        if rp:
            condition_id = rp[0].get("booking_condition_id")
    query = db.table("booking_conditions").select("*").eq("tenant_id", tenant_id)
    rows = (
        query.eq("id", condition_id).limit(1).execute().data
        if condition_id
        else query.eq("is_default", True).limit(1).execute().data
    )
    return rows[0] if rows else None


def erste_zahlung(condition: dict[str, Any], total: float) -> float:
    """Höhe der ersten Zahlung (Anzahlung). Ohne Split (`installments <= 1`)
    ODER ohne gesetzten Prozentsatz ist es der volle Betrag."""
    if int(condition.get("installments") or 1) <= 1:
        return total
    pct = condition.get("first_payment_percent")
    if pct is None:
        return total
    return round(total * float(pct) / 100.0, 2)


def restzahlung_faellig_am(
    condition: dict[str, Any], check_in: date
) -> date | None:
    """Fälligkeit der Restzahlung: X Tage vor Anreise. None, wenn die Kondition
    keine Restzahlung plant."""
    days = condition.get("balance_days_before_arrival")
    if days is None:
        return None
    return check_in - timedelta(days=int(days))


def storno_regeln(db: Client, condition_id: str) -> list[dict[str, Any]]:
    """Die gestaffelten Storno-Regeln einer Kondition, streng nach Vorlauf
    sortiert (weit vor Anreise zuerst) — so liest sie auch der Gast."""
    rows = (
        db.table("booking_condition_refund_rules")
        .select("days_before_arrival, refund_percent")
        .eq("condition_id", condition_id)
        .execute()
    ).data or []
    return sorted(
        (
            {
                "days_before_arrival": int(r["days_before_arrival"]),
                "refund_percent": float(r["refund_percent"]),
            }
            for r in rows
            if r.get("days_before_arrival") is not None
            and r.get("refund_percent") is not None
        ),
        key=lambda r: -r["days_before_arrival"],
    )


def kaution(condition: dict[str, Any], total: float) -> dict[str, Any] | None:
    """Kaution der Kondition, wenn eine verlangt wird.

    `deposit_amount_type='percent'` rechnet auf den Aufenthaltspreis um — ein
    Prozentsatz allein wäre für den Gast keine Zahl. Fehlt der Betrag, gibt es
    keine Kautionsangabe (kein geratener Wert, Wurzel 4).
    """
    if not condition.get("deposit_required"):
        return None
    betrag = condition.get("deposit_amount")
    if betrag is None:
        return None
    wert = float(betrag)
    if (condition.get("deposit_amount_type") or "fixed") == "percent":
        wert = round(total * wert / 100.0, 2)
    return {
        "amount": wert,
        "method": condition.get("deposit_method"),
        "currency": condition.get("deposit_currency"),
    }
