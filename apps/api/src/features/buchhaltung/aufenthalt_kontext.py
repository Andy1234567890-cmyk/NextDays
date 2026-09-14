"""Aufenthaltskontext eines Angebots: Objekt, Zeiten, Zahlungsplan, Storno, Hausregeln.

Ein Hotel-/FeWo-Angebot ist eine Buchungsvorschau, kein Handelsbeleg: der
Gast will das Haus sehen, wissen, wann er einchecken kann, was er jetzt zahlt
und wie er stornieren kann (Guesty/Hostaway-Quote, Recherche 14.09.2026).
Dieses Modul sammelt genau diese Daten aus den Stammdaten — EINE Quelle für
das PDF der Buchhaltung, die Annahmeseite des Gastes und die Angebotsmail.

Quellen (alle vorhanden, bis dahin von keinem Angebot gelesen):
* ``properties`` — Titel, Ort, Adresse, ``type_attributes.policies``
  (``checkInTime``/``checkOutTime``, gleiche Lesart wie der Posteingang).
* ``property_photos`` — Cover (``is_cover``), sonst erstes nach ``sort_order``.
* ``booking_conditions`` über ``booking_conditions.plan`` — Zahlungsplan und
  Storno-Staffel, dieselbe Rechnung wie Buchungsstrecke und Zahlungspfad.
* ``content_blocks`` (``kind='house_rules'``) über ``content_assignments`` —
  Hausregeln in der Dokumentsprache, sonst en, sonst de.

Fehlt etwas, fehlt es (None/leer) — nie ein erfundener Ersatz (Wurzel 4).
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.features.booking_conditions.plan import (
    erste_zahlung,
    kondition_fuer,
    restzahlung_faellig_am,
    storno_regeln,
)

log = get_logger("nextdays.buchhaltung.aufenthalt_kontext")


def _text(mehrsprachig: object, lang: str) -> str | None:
    if isinstance(mehrsprachig, str):
        return mehrsprachig.strip() or None
    if not isinstance(mehrsprachig, dict) or not mehrsprachig:
        return None
    wert = mehrsprachig.get(lang) or mehrsprachig.get("en") or mehrsprachig.get("de")
    if not wert:
        wert = next(iter(mehrsprachig.values()), None)
    return str(wert).strip() or None if wert else None


def _objekt(db: Client, tenant_id: str, property_id: str) -> dict[str, Any] | None:
    rows = (
        db.table("properties")
        .select("id, title, city, street, house_number, postal_code, country, type_attributes")
        .eq("id", property_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    return rows[0] if rows else None


def _cover(db: Client, property_id: str) -> str | None:
    rows = (
        db.table("property_photos")
        .select("url, is_cover, sort_order")
        .eq("property_id", property_id)
        .limit(50)
        .execute()
    ).data or []
    mit_url = [r for r in rows if r.get("url")]
    if not mit_url:
        return None
    # Cover zuerst, sonst das erste nach Reihenfolge — hier sortiert, damit die
    # Regel unabhängig von der DB-Sortierung gilt (und testbar bleibt).
    mit_url.sort(key=lambda r: (not bool(r.get("is_cover")), int(r.get("sort_order") or 0)))
    return str(mit_url[0]["url"])


def _hausregeln(db: Client, tenant_id: str, property_id: str, lang: str) -> str | None:
    zuordnung = (
        db.table("content_assignments")
        .select("block_id")
        .eq("property_id", property_id)
        .execute()
    ).data or []
    ids = [str(z["block_id"]) for z in zuordnung if z.get("block_id")]
    if not ids:
        return None
    rows = (
        db.table("content_blocks")
        .select("body_i18n")
        .eq("tenant_id", tenant_id)
        .eq("kind", "house_rules")
        .in_("id", ids)
        .limit(1)
        .execute()
    ).data or []
    return _text(rows[0].get("body_i18n"), lang) if rows else None


def aufenthalt_kontext(
    db: Client,
    tenant_id: str,
    property_id: str | None,
    *,
    lang: str,
    total: Decimal | float | None,
    check_in: date | None,
    deposit: Decimal | float | None = None,
    rate_plan_id: str | None = None,
) -> dict[str, Any] | None:
    """Alles, was PDF, Annahmeseite und Mail über den Aufenthalt zeigen.

    ``deposit`` (vom Betrieb am Angebot gesetzt) gewinnt gegen den Plan der
    Kondition — die Anzahlung im Angebot ist die Zusage an den Gast.
    """
    if not property_id:
        return None
    try:
        prop = _objekt(db, tenant_id, property_id)
        if prop is None:
            return None
        policies = (prop.get("type_attributes") or {}).get("policies") or {}
        kontext: dict[str, Any] = {
            "property_id": str(prop["id"]),
            "title": str(prop.get("title") or ""),
            "city": prop.get("city"),
            "address": " ".join(
                str(prop.get(k) or "") for k in ("street", "house_number")
            ).strip() or None,
            "postal_code": prop.get("postal_code"),
            "country": prop.get("country"),
            "cover_url": _cover(db, property_id),
            "check_in_time": policies.get("checkInTime") or None,
            "check_out_time": policies.get("checkOutTime") or None,
            "house_rules": _hausregeln(db, tenant_id, property_id, lang),
            "payment_plan": None,
            "cancellation": None,
        }
        condition = kondition_fuer(db, tenant_id=tenant_id, rate_plan_id=rate_plan_id)
        gesamt = float(total or 0)
        if condition is not None:
            jetzt = float(deposit) if deposit is not None else erste_zahlung(condition, gesamt)
            rest = round(gesamt - jetzt, 2)
            faellig = restzahlung_faellig_am(condition, check_in) if check_in and rest > 0 else None
            kontext["payment_plan"] = {
                "due_now": jetzt,
                "due_later": max(rest, 0.0),
                "balance_due_date": faellig.isoformat() if faellig else None,
            }
            kontext["cancellation"] = {
                "mode": condition.get("cancellation_mode"),
                "rules": storno_regeln(db, str(condition["id"])),
            }
        elif deposit is not None and gesamt > 0:
            # Ohne Kondition, aber mit Anzahlung am Angebot: Plan aus der Zusage.
            kontext["payment_plan"] = {
                "due_now": float(deposit),
                "due_later": max(round(gesamt - float(deposit), 2), 0.0),
                "balance_due_date": None,
            }
        return kontext
    except APIError as exc:
        # Kontext ist Zusatz, nicht Pflicht: das Angebot bleibt lesbar — laut geloggt.
        log.error(
            "aufenthalt_kontext_fehlgeschlagen",
            tenant_id=tenant_id,
            property_id=property_id,
            error=str(exc)[:300],
        )
        return None
