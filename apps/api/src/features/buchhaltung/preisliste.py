"""Preisliste des Betriebs für den Beleg-Editor („Aus Preisliste").

Aufgebaut wie Hostaways „Listing → Prices & Fees" (Hilfe gelesen am
13.09.2026): je Objekt die **Gebühren** (Pflicht, aus Objekt → Preise →
Gebühren), die **Zusatzleistungen** (optional, Upsells) und die
**Steuern/Abgaben** (Kurtaxe, Beherbergungssteuer aus Objekt → Preise →
Steuern) — dazu betriebsweit der **Artikelstamm** der Buchhaltung.

Vier Quellen, EINE Liste:

* ``property_pricing_config.fees``  — Gebühren des Objekts (gebuehren.py:
  ``normalize_fees``): Basis per_stay/per_night/per_guest_stay/per_guest_night/
  per_pet_stay, Betrag fix oder Prozent, eigener Steuersatz, Gültigkeit.
* ``property_addons``              — Zusatzleistungen (addons-Slice): Basis,
  Preis, Steuersatz, mehrsprachiger Name.
* ``property_pricing_config.taxes`` — lokale Steuern (``kind='local'``, nicht
  im Preis enthalten): Prozent vom Übernachtungspreis oder Betrag je Gast/Nacht;
  im Beleg als Abgabe mit 0 % USt (durchlaufender Posten).
* ``billing_items`` (0668)          — frei gepflegte Preisliste der Buchhaltung.

Prozent-Einträge tragen ``percent`` statt ``unitPrice``: der Betrag ergibt
sich erst aus den Übernachtungszeilen des Belegs, das rechnet der Editor.

Wurzel 3: alles Objektbezogene läuft über die Objekte des Tenants (Join im
Code); Wurzel 4: Steuersatz und Währung kommen aus der Quelle, fehlt der
Steuersatz, bleibt er ``None`` und der Editor verlangt ihn.
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

from supabase import Client

from src.core.logging import get_logger
from src.features.properties.gebuehren import FEE_TYPE_LABEL, gebuehr_gilt_am

log = get_logger("nextdays.buchhaltung.preisliste")

# Obergrenzen (Wurzel 8): eine Preisliste ist kein Datenexport.
_MAX_ARTIKEL = 500
_MAX_ZUSATZLEISTUNGEN = 500
_MAX_OBJEKTE = 200

# Gebühren-Basis des Objekts → Abrechnungsbasis der Position (0698).
_FEE_BASIS: dict[str, str] = {
    "per_stay": "per_stay",
    "per_night": "per_night",
    "per_guest_stay": "per_guest",
    "per_guest_night": "per_guest_night",
    "per_pet_stay": "per_unit",
}


def _text(mehrsprachig: object, sprache: str) -> str:
    """Mehrsprachiges jsonb → Text in Dokumentsprache, sonst en, sonst de, sonst erster Wert."""
    if isinstance(mehrsprachig, str):
        return mehrsprachig
    if not isinstance(mehrsprachig, dict) or not mehrsprachig:
        return ""
    return str(
        mehrsprachig.get(sprache)
        or mehrsprachig.get("en")
        or mehrsprachig.get("de")
        or next(iter(mehrsprachig.values()), "")
    )


def _betrag(wert: object) -> str:
    try:
        return str(Decimal(str(wert)).quantize(Decimal("0.01")))
    except (ValueError, ArithmeticError):
        return "0.00"


def _satz(wert: object) -> str | None:
    return _betrag(wert) if wert is not None else None


def _eintrag(**felder: object) -> dict:
    """Ein Preislisten-Eintrag mit vollständigem Feldsatz (feste Form für den Editor)."""
    basis = {
        "id": "",
        "quelle": "artikel",
        "name": "",
        "description": "",
        "unit": "",
        "basis": "per_unit",
        "unitPrice": None,
        "percent": None,
        "taxRate": None,
        "currency": None,
        "category": None,
        "propertyId": None,
        "propertyTitle": None,
        "isFavorite": False,
        "optional": True,
    }
    basis.update(felder)
    return basis


def _steuer_basis(tax: dict) -> str:
    """Betrags-Steuer: chargeBasis × period → Abrechnungsbasis; Altdatensatz = je Nacht."""
    pro_person = str(tax.get("chargeBasis") or "SingleCharge") == "PerPerson"
    pro_nacht = str(tax.get("period") or "PerNight") == "PerNight"
    if pro_person and pro_nacht:
        return "per_guest_night"
    if pro_person:
        return "per_guest"
    return "per_night" if pro_nacht else "per_stay"


def _artikel(db: Client, tenant_id: str) -> list[dict]:
    rows = (
        db.table("billing_items")
        .select("id, name, description, unit, basis, unit_price, tax_rate, currency, "
                "category, is_favorite, usage_count")
        .eq("tenant_id", tenant_id)
        .eq("is_active", True)
        .order("is_favorite", desc=True)
        .order("usage_count", desc=True)
        .order("name")
        .limit(_MAX_ARTIKEL)
        .execute()
    ).data or []
    return [
        _eintrag(
            id=str(a["id"]),
            quelle="artikel",
            name=a.get("name") or "",
            description=a.get("description") or "",
            unit=a.get("unit") or "",
            basis=a.get("basis") or "per_unit",
            unitPrice=_betrag(a.get("unit_price")),
            taxRate=_satz(a.get("tax_rate")),
            currency=a.get("currency"),
            category=a.get("category"),
            isFavorite=bool(a.get("is_favorite")),
        )
        for a in rows
    ]


def _zusatzleistungen(db: Client, objekte: dict[str, dict], sprache: str) -> list[dict]:
    if not objekte:
        return []
    rows = (
        db.table("property_addons")
        .select("id, property_id, name, description, price, basis, tax_rate, active, sort_order")
        .in_("property_id", sorted(objekte))
        .eq("active", True)
        .order("sort_order")
        .limit(_MAX_ZUSATZLEISTUNGEN)
        .execute()
    ).data or []
    out = []
    for z in rows:
        pid = str(z.get("property_id"))
        obj = objekte.get(pid, {})
        out.append(_eintrag(
            id=str(z["id"]),
            quelle="zusatzleistung",
            name=_text(z.get("name"), sprache),
            description=_text(z.get("description"), sprache),
            basis=z.get("basis") or "per_stay",
            unitPrice=_betrag(z.get("price")),
            taxRate=_satz(z.get("tax_rate")),
            currency=obj.get("currency"),
            propertyId=pid,
            propertyTitle=obj.get("title") or "",
        ))
    return out


def _gebuehren_und_abgaben(
    db: Client, objekte: dict[str, dict], sprache: str
) -> tuple[list[dict], list[dict]]:
    """Gebühren (Objekt → Preise → Gebühren) und lokale Steuern aus der
    Preis-Konfiguration je Objekt. Abgelaufene Gebühren (validUntil) fallen weg;
    die Gültigkeit wird an HEUTE gemessen — ein Beleg ohne Buchung hat keine Anreise."""
    if not objekte:
        return [], []
    rows = (
        db.table("property_pricing_config")
        .select("property_id, currency, fees, taxes")
        .in_("property_id", sorted(objekte))
        .execute()
    ).data or []
    heute = datetime.now(UTC).date()
    gebuehren: list[dict] = []
    abgaben: list[dict] = []
    for cfg in rows:
        pid = str(cfg.get("property_id"))
        obj = objekte.get(pid, {})
        waehrung = cfg.get("currency") or obj.get("currency")
        for fee in cfg.get("fees") or []:
            if not isinstance(fee, dict) or not gebuehr_gilt_am(fee, heute):
                continue
            prozent = str(fee.get("mode") or "amount") == "percent"
            name = (
                _text(fee.get("names"), sprache)
                or str(fee.get("name") or "").strip()
                or FEE_TYPE_LABEL.get(str(fee.get("feeType") or ""), "")
            )
            gebuehren.append(_eintrag(
                id=str(fee.get("id") or f"{pid}:{name}"),
                quelle="gebuehr",
                name=name,
                description=str(fee.get("feeType") or ""),
                basis=_FEE_BASIS.get(str(fee.get("basis") or "per_stay"), "per_stay"),
                unitPrice=None if prozent else _betrag(fee.get("amount")),
                percent=_betrag(fee.get("amount")) if prozent else None,
                taxRate=_satz(fee.get("taxRate")),
                currency=waehrung,
                category=FEE_TYPE_LABEL.get(str(fee.get("feeType") or "")) or None,
                propertyId=pid,
                propertyTitle=obj.get("title") or "",
                optional=bool(fee.get("optional")),
            ))
        for tax in cfg.get("taxes") or []:
            if not isinstance(tax, dict):
                continue
            if str(tax.get("kind") or "local") != "local" or bool(tax.get("includedInPrice")):
                continue
            prozent = str(tax.get("mode") or "percent") == "percent"
            abgaben.append(_eintrag(
                id=str(tax.get("id") or f"{pid}:tax"),
                quelle="abgabe",
                name=_text(tax.get("names"), sprache) or str(tax.get("name") or "").strip(),
                description=str(tax.get("taxType") or ""),
                basis="per_stay" if prozent else _steuer_basis(tax),
                unitPrice=None if prozent else _betrag(tax.get("value")),
                percent=_betrag(tax.get("value")) if prozent else None,
                # Abgaben sind durchlaufende Posten: 0 % USt (reservation_invoice).
                taxRate="0.00",
                currency=waehrung,
                propertyId=pid,
                propertyTitle=obj.get("title") or "",
                optional=False,
            ))
    return gebuehren, abgaben


def preisliste(
    db: Client,
    tenant_id: str,
    *,
    property_id: str | None = None,
    sprache: str = "de",
) -> dict:
    """``{"objekte": [...], "eintraege": [...]}`` für „Aus Preisliste".

    ``objekte`` = alle Objekte des Betriebs (für die Auswahl im Dialog);
    ``eintraege`` = Gebühren, Zusatzleistungen, Abgaben des gewählten Objekts
    (oder aller Objekte) plus der betriebsweite Artikelstamm. Jeder Eintrag
    trägt ``quelle`` (gebuehr | zusatzleistung | abgabe | artikel), ``basis``,
    ``unitPrice`` ODER ``percent``, ``taxRate`` (String oder None), ``currency``,
    ``propertyId``/``propertyTitle``, ``optional``.
    """
    alle_objekte = (
        db.table("properties")
        .select("id, title, currency")
        .eq("tenant_id", tenant_id)
        # Objekte werden archiviert (archived_at), nicht gelöscht — Archivierte
        # verkaufen nichts mehr und gehören nicht in die Auswahl.
        .is_("archived_at", "null")
        .order("title")
        .limit(_MAX_OBJEKTE)
        .execute()
    ).data or []
    objekte = {str(o["id"]): {"title": o.get("title") or "", "currency": o.get("currency")}
               for o in alle_objekte}
    gewaehlt = {property_id: objekte[property_id]} if property_id in objekte else objekte

    gebuehren, abgaben = _gebuehren_und_abgaben(db, gewaehlt, sprache)
    zusatz = _zusatzleistungen(db, gewaehlt, sprache)
    artikel = _artikel(db, tenant_id)
    eintraege = gebuehren + zusatz + abgaben + artikel

    log.debug(
        "preisliste_geladen",
        tenant_id=tenant_id,
        property_id=property_id,
        gebuehren=len(gebuehren),
        zusatzleistungen=len(zusatz),
        abgaben=len(abgaben),
        artikel=len(artikel),
    )
    return {
        "objekte": [{"id": pid, "title": o["title"], "currency": o["currency"]}
                    for pid, o in objekte.items()],
        "eintraege": eintraege,
    }
