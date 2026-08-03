"""Serverseitige Prüfung und Säuberung der Objekt-Gebühren.

Gegenstück zu `steuern.py`. Die Gebühren eines Objekts liegen als Liste im
Preis-Blob (`type_attributes.pricing.fees`) und werden von dort in
`property_pricing_config.fees` gespiegelt, vom Preis-Resolver gerechnet, auf die
Rechnung geschrieben und — seit dem Gebühren-Export — als `type: "fee"` an die
Portale gesendet. Bis dahin liefen sie ungeprüft durch: der Blob wurde
unverändert übernommen. Das ging, solange die Gebühr nur intern gerechnet wurde;
sobald sie das Haus verlässt, ist jedes Feld angreiferkontrollierter Input
(Wurzel 3).

* Gebührenart nur aus der erlaubten Liste — sie geht als Kategorie an die
  Portale (Wurzel 4: kein erfundener Ersatzwert, ungültige Eingabe schlägt fehl).
* Basis nur aus den vier bekannten Werten; sie bestimmt die Channex-`logic`.
* Kanal-Einschränkung nur mit bekannten Portal-Codes, sonst liefe die Gebühr
  ins Leere und niemand merkte es.
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from src.core.logging import get_logger

from .errors import PropertyError

log = get_logger("nextdays.properties.gebuehren")

# Gebührenarten. Gegenstück: FEE_TYPE_LABELS in web/lib/pricing-meta.ts.
# Bewusst eine geschlossene Liste: die Art geht als Kategorie an die Portale,
# ein Freitext käme dort als „unbekannt" an.
FEE_TYPES = frozenset(
    {
        "cleaning",
        "pet",
        "resort",
        "management",
        "community",
        "linen",
        "other",
    }
)

# Berechnungsbasis; bestimmt die Channex-`logic` (siehe channel_manager.tax_sync
# `_FEE_LOGIC`). Gegenstück: FeeBasis in web/lib/pricing-meta.ts.
FEE_BASES = frozenset(
    {"per_stay", "per_night", "per_guest_stay", "per_guest_night"}
)

_NAME_MAX = 255
_AMOUNT_MAX = 1_000_000.0


def _clean_amount(raw: object) -> float:
    try:
        value = float(raw if raw is not None else 0)
    except (TypeError, ValueError) as exc:
        raise PropertyError("Gebührenbetrag ist keine Zahl.", status_code=422) from exc
    if value < 0:
        raise PropertyError(
            "Gebührenbetrag darf nicht negativ sein.", status_code=422
        )
    if value > _AMOUNT_MAX:
        raise PropertyError("Gebührenbetrag ist unplausibel hoch.", status_code=422)
    return value


def _clean_tax_rate(raw: object) -> float | None:
    """Eigener USt-Satz der Gebühr. None = Übernachtungssatz des Objekts."""
    if raw is None or raw == "":
        return None
    try:
        value = float(raw)
    except (TypeError, ValueError) as exc:
        raise PropertyError("Steuersatz ist keine Zahl.", status_code=422) from exc
    if not 0 <= value <= 100:
        raise PropertyError(
            "Steuersatz muss zwischen 0 und 100 liegen.", status_code=422
        )
    return value


def sync_pricing_config(
    db: Client, tenant_id: str, property_id: str, pricing: dict
) -> None:
    """Pricing-Blob → property_pricing_config (vom Preis-Resolver gelesen).

    Schreibt die strukturierten Felder per Upsert. Fehlende Felder bleiben auf
    den Spalten-Defaults (kein erfundener Wert). Best-effort — ein Fehler hier
    darf das Speichern des Objekts nicht kippen (Realtime/Resolver greifen beim
    nächsten Speichern erneut).

    Liegt bei den Gebühren, weil `fees`/`taxes` den fachlichen Kern dieser
    Spiegelung bilden — und weil properties/service.py sonst über die
    1500-Zeilen-Grenze läuft.
    """
    try:
        row = {
            "property_id": property_id,
            "tenant_id": tenant_id,
            "custom_by_weekday": bool(pricing.get("customByWeekday")),
            "weekday_prices": pricing.get("weekdayPrices") or {},
            "extra_guest_charge": pricing.get("extraGuestCharge") or 0,
            "extra_guest_from": pricing.get("extraGuestFrom") or 1,
            "short_stay_max_nights": pricing.get("shortStayMaxNights") or 0,
            "short_stay_surcharge": pricing.get("shortStaySurcharge") or 0,
            "length_prices": pricing.get("lengthPrices") or [],
            "fees": pricing.get("fees") or [],
            "taxes": pricing.get("taxes") or [],
            "promotions": pricing.get("promotions") or [],
            "add_ons": pricing.get("addOns") or [],
        }
        # Währung nur setzen, wenn explizit übergeben — kein EUR erfinden
        # (Wurzel 4). Fehlt sie, greift bei Insert der Spalten-Default bzw. der
        # bestehende Wert bleibt bei Update erhalten.
        if pricing.get("currency"):
            row["currency"] = pricing["currency"]
        db.table("property_pricing_config").upsert(
            row, on_conflict="property_id"
        ).execute()
    except Exception as exc:  # noqa: BLE001 — Spiegelung darf Speichern nicht kippen
        log.warning(
            "pricing_config_sync_failed", property_id=property_id, error=str(exc)
        )


def erlaubte_portale(
    db: Client, tenant_id: str, property_id: str
) -> frozenset[str] | None:
    """Portal-Codes, auf die eine Steuer/Gebühr dieses Objekts eingeschränkt
    werden darf: die für das Objekt WIRKLICH verbundenen Kanäle.

    Absichtlich nicht der volle Channex-Katalog: eine Einschränkung auf ein
    Portal, das gar nicht verbunden ist, wäre wirkungslos und würde in der
    Oberfläche Sicherheit vortäuschen (Wurzel 4 — keine erfundene Auswahl).

    `None` heißt „Liste nicht ladbar" und ist NICHT dasselbe wie „keine
    verbundenen Portale": bei einem DB-Aussetzer würde ein leeres Set jede
    bestehende Einschränkung als unbekanntes Portal abweisen — der Betrieb
    könnte dann am Objekt nichts mehr speichern, auch keine Beschreibung, weil
    das Formular den ganzen Preis-Blob zurücksendet. Bei `None` bleiben
    vorhandene Codes deshalb unverändert stehen (siehe `clean_portal_scope`);
    geprüft wird erst wieder, wenn die Liste wirklich vorliegt.
    """
    try:
        rows = (
            db.table("channex_channel_connection")
            .select("ota_portal_code")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .execute()
        ).data or []
    except Exception as exc:  # noqa: BLE001 — siehe Docstring
        log.warning(
            "erlaubte_portale_nicht_ladbar",
            property_id=property_id,
            error=str(exc),
        )
        return None
    return frozenset(
        str(r["ota_portal_code"]) for r in rows if r.get("ota_portal_code")
    )


def clean_portal_scope(
    raw: object, *, erlaubt: frozenset[str] | None
) -> list[str]:
    """Kanal-Einschränkung säubern; leere Liste = alle Kanäle.

    Ein unbekannter Portal-Code ist ein Fehler, kein stilles Verwerfen: sonst
    stünde in der Oberfläche „nur an Booking", und gesendet würde an alle
    (Wurzel 5 — fail-closed statt still danebenliegen).

    `erlaubt=None` (Portalliste nicht ladbar) übernimmt die Codes ungeprüft:
    ein DB-Aussetzer darf nicht dazu führen, dass das Objekt unspeicherbar wird.
    Der Sync ignoriert eine Einschränkung auf ein nicht verbundenes Portal
    ohnehin — der Schaden ist also begrenzt, das Blockieren wäre größer.
    """
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise PropertyError("Kanal-Einschränkung ist keine Liste.", status_code=422)
    codes: list[str] = []
    for eintrag in raw:
        code = str(eintrag).strip()
        if not code:
            continue
        if erlaubt is not None and code not in erlaubt:
            raise PropertyError(f"Unbekanntes Portal: {code}", status_code=422)
        if code not in codes:  # Reihenfolge behalten, Dubletten weg
            codes.append(code)
    return codes


def normalize_fees(
    raw_fees: list[Any], *, portale: frozenset[str] | None
) -> list[dict[str, Any]]:
    """Gebührenliste prüfen und säubern; wirft PropertyError(422) bei Unsinn."""
    fees: list[dict[str, Any]] = []
    gesehene_ids: set[str] = set()
    for eintrag in raw_fees:
        if not isinstance(eintrag, dict):
            continue
        fee_id = str(eintrag.get("id") or "").strip()
        if not fee_id:
            raise PropertyError("Gebühr ohne Kennung.", status_code=422)
        # Doppelte Kennungen brächen die Steuerbemessungsgrundlage: dort werden
        # Gebühren über ihre ID referenziert, zwei gleiche wären mehrdeutig.
        if fee_id in gesehene_ids:
            raise PropertyError(
                f"Gebühr {fee_id} ist doppelt vorhanden.", status_code=422
            )
        gesehene_ids.add(fee_id)

        basis = str(eintrag.get("basis") or "per_stay")
        if basis not in FEE_BASES:
            raise PropertyError(f"Unbekannte Gebühren-Basis: {basis}", status_code=422)

        name = str(eintrag.get("name") or "").strip()[:_NAME_MAX]
        if not name:
            raise PropertyError("Gebühr braucht einen Namen.", status_code=422)

        sauber: dict[str, Any] = {
            "id": fee_id,
            "name": name,
            "amount": _clean_amount(eintrag.get("amount")),
            "basis": basis,
            "optional": bool(eintrag.get("optional")),
        }

        satz = _clean_tax_rate(eintrag.get("taxRate"))
        if satz is not None:
            sauber["taxRate"] = satz

        # Gebührenart: Altbestand hat sie nicht. Fehlt sie, bleibt sie weg —
        # der Export liest dann "other". Ein gesetzter Wert muss aber stimmen.
        art = eintrag.get("feeType")
        if art is not None and str(art).strip():
            if str(art) not in FEE_TYPES:
                raise PropertyError(f"Unbekannte Gebührenart: {art}", status_code=422)
            sauber["feeType"] = str(art)

        scope = clean_portal_scope(eintrag.get("portalScope"), erlaubt=portale)
        if scope:
            sauber["portalScope"] = scope

        fees.append(sauber)
    return fees
