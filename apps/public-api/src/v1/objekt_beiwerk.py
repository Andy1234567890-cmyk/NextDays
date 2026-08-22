"""Was zu einem Objekt gehört, aber nicht das Objekt ist.

Vier Leseendpunkte und einer, der schreibt:

* **Zusatzleistungen** — was ein Gast dazubuchen kann. Ohne diese Liste kann ein
  Client keinen Aufenthalt zusammenstellen, der dem entspricht, was der Betrieb
  anbietet.
* **Konditionen** — Zahlungsplan und Stornoregel. Sie hängen am RATE-PLAN, nicht
  am Objekt: beim Hotel haben BAR und „nicht erstattbar" verschiedene Zusagen.
* **Kanäle** — wie das Objekt angebunden ist. Kanal-Sichtbarkeit ist pro Kanal
  schaltbar, es gibt kein globales „veröffentlicht".
* **Zugangsdaten** — Türcode und WLAN, lesen und setzen. Sie stehen am OBJEKT;
  je Buchung eigene Codes gibt es bei uns nicht, und eine erfundene Zuordnung
  wäre schlimmer als eine fehlende.

Alle hängen unter `/properties/{property_id}/…` und prüfen dieselbe
Objekt-Beschränkung wie die Objekt-Liste (Wurzel 9).
"""
from __future__ import annotations

from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from supabase import Client

from ..core import errors
from ..core.auth import ApiKontext, scope_erforderlich
from ..core.db import service_db, zeile_im_mandanten
from .schemas import (
    KanalZuordnung,
    Konditionen,
    StornoStaffel,
    Zugangsdaten,
    ZugangsdatenSetzen,
    Zusatzleistung,
)

router = APIRouter(prefix="/properties", tags=["Objekte"])


def _objekt(db: Client, ctx: ApiKontext, property_id: str) -> dict:
    """Objekt laden, Mandant und Objekt-Beschränkung erzwingen."""
    ctx.objekt_pruefen(property_id)
    return zeile_im_mandanten(
        db, "properties", property_id, ctx.tenant_id,
        spalten=(
            "id, currency, listed_on_marketplace, listed_on_website, status"
        ),
        was="Das Objekt",
    )


@router.get(
    "/{property_id}/addons",
    response_model=list[Zusatzleistung],
    summary="Zusatzleistungen eines Objekts",
)
def zusatzleistungen(
    property_id: str,
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("properties:read"))],
    include_inactive: Annotated[
        bool,
        Query(
            description=(
                "Auch abgeschaltete Leistungen mitliefern. Standard `false` — "
                "eine abgeschaltete Leistung ist nicht buchbar, und ein Client, "
                "der sie anbietet, verkauft etwas, das es nicht gibt."
            )
        ),
    ] = False,
) -> list[Zusatzleistung]:
    """Alle buchbaren Zusatzleistungen samt Preis und Bezugsgröße.

    Die Währung kommt vom Objekt — sie steht nicht an der Leistung, und sie wird
    nicht erfunden. Fehlt sie am Objekt, schlägt der Aufruf fehl.
    """
    db = service_db()
    objekt = _objekt(db, ctx, property_id)
    waehrung = objekt.get("currency")
    if not waehrung:
        raise errors.ungueltige_anfrage(
            "Zu diesem Objekt ist keine Währung gespeichert."
        )

    q = (
        db.table("property_addons")
        .select(
            "id, name, description, price, basis, mandatory, tax_rate, active, "
            "sort_order"
        )
        .eq("property_id", property_id)
    )
    if not include_inactive:
        q = q.eq("active", True)
    zeilen = (q.order("sort_order").limit(200).execute()).data or []

    return [
        Zusatzleistung(
            id=str(z["id"]),
            name=_texte(z.get("name")),
            description=_texte(z.get("description")) or None,
            price=Decimal(str(z.get("price") or 0)),
            currency=waehrung,
            basis=str(z.get("basis") or "per_stay"),
            mandatory=bool(z.get("mandatory")),
            tax_rate=(
                Decimal(str(z["tax_rate"])) if z.get("tax_rate") is not None else None
            ),
        )
        for z in zeilen
    ]


def _texte(roh: object) -> dict[str, str]:
    """Mehrsprachiges Feld → `{sprache: text}`, leere Sprachen weggelassen.

    Eine Sprache mit leerem Text ist nicht übersetzt; sie mitzuliefern würde
    einen Client dazu verleiten, einen leeren Namen anzuzeigen.
    """
    if not isinstance(roh, dict):
        return {}
    return {
        str(sprache): str(text)
        for sprache, text in roh.items()
        if isinstance(text, str) and text.strip()
    }


@router.get(
    "/{property_id}/booking-conditions",
    response_model=Konditionen,
    summary="Zahlungsplan und Stornoregel",
)
def konditionen(
    property_id: str,
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("properties:read"))],
    rate_plan_id: Annotated[
        str | None,
        Query(
            description=(
                "Der Rate-Plan, dessen Kondition gilt. Ohne Angabe die "
                "Standard-Kondition des Betriebs."
            )
        ),
    ] = None,
) -> Konditionen:
    """Was der Gast wann zahlt und was bei einer Absage zurückkommt.

    Ohne gepflegte Kondition sind alle Felder `null`. Das heißt: vollständig bei
    Buchung, keine Stornozusage. Hier eine Standard-Staffel zu erfinden wäre
    eine Zusage, die niemand gegeben hat.
    """
    db = service_db()
    _objekt(db, ctx, property_id)

    kondition: dict | None = None
    if rate_plan_id:
        plan = zeile_im_mandanten(
            db, "rate_plans", rate_plan_id, ctx.tenant_id,
            spalten="id, property_id, booking_condition_id", was="Der Rate-Plan",
        )
        if str(plan.get("property_id")) != property_id:
            # Ein Rate-Plan eines anderen Objekts würde die Kondition eines
            # fremden Verkaufsweges ausliefern.
            raise errors.nicht_gefunden("Der Rate-Plan")
        if plan.get("booking_condition_id"):
            kondition = (
                (
                    db.table("booking_conditions")
                    .select("*")
                    .eq("id", plan["booking_condition_id"])
                    .eq("tenant_id", ctx.tenant_id)
                    .limit(1)
                    .execute()
                ).data
                or [None]
            )[0]

    if kondition is None:
        kondition = (
            (
                db.table("booking_conditions")
                .select("*")
                .eq("tenant_id", ctx.tenant_id)
                .eq("is_default", True)
                .limit(1)
                .execute()
            ).data
            or [None]
        )[0]

    if kondition is None:
        return Konditionen(rate_plan_id=rate_plan_id)

    regeln = (
        db.table("booking_condition_refund_rules")
        .select("days_before_arrival, refund_percent")
        .eq("condition_id", kondition["id"])
        .order("days_before_arrival", desc=True)
        .limit(50)
        .execute()
    ).data or []

    return Konditionen(
        rate_plan_id=rate_plan_id,
        name=kondition.get("internal_name"),
        installments=kondition.get("installments"),
        first_payment_percent=_dez(kondition.get("first_payment_percent")),
        first_payment_timing=kondition.get("first_payment_timing"),
        balance_days_before_arrival=kondition.get("balance_days_before_arrival"),
        deposit_required=bool(kondition.get("deposit_required")),
        deposit_method=kondition.get("deposit_method"),
        cancellation_mode=kondition.get("cancellation_mode"),
        refund_rules=[
            StornoStaffel(
                days_before=int(r["days_before_arrival"]),
                refund_percent=Decimal(str(r["refund_percent"])),
            )
            for r in regeln
        ],
    )


def _dez(wert: object) -> Decimal | None:
    return Decimal(str(wert)) if wert is not None else None


@router.get(
    "/{property_id}/channels",
    response_model=list[KanalZuordnung],
    summary="Kanal-Anbindung eines Objekts",
)
def kanaele(
    property_id: str,
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("properties:read"))],
) -> list[KanalZuordnung]:
    """Auf welchen Wegen dieses Objekt verkauft wird.

    Drei Kanäle, drei getrennte Schalter — es gibt kein globales
    „veröffentlicht". Die Anbindung an die Portale läuft über den Aggregator und
    hat einen eigenen Sync-Zustand; Marktplatz und eigene Website sind je ein
    Flag am Objekt.
    """
    db = service_db()
    objekt = _objekt(db, ctx, property_id)

    mapping = (
        (
            db.table("channex_property_map")
            .select(
                "channex_property_id, sync_enabled, last_sync_at, "
                "last_sync_status, last_sync_error"
            )
            .eq("tenant_id", ctx.tenant_id)
            .eq("property_id", property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data
        or [None]
    )[0]

    raus = [
        KanalZuordnung(
            channel="marktplatz",
            enabled=bool(objekt.get("listed_on_marketplace")),
        ),
        KanalZuordnung(
            channel="website",
            enabled=bool(objekt.get("listed_on_website")),
        ),
    ]
    if mapping is not None:
        raus.insert(
            0,
            KanalZuordnung(
                channel="portale",
                enabled=bool(mapping.get("sync_enabled")),
                external_id=mapping.get("channex_property_id"),
                last_sync_at=mapping.get("last_sync_at"),
                last_sync_status=mapping.get("last_sync_status"),
                last_sync_error=mapping.get("last_sync_error"),
            ),
        )
    return raus


@router.get(
    "/{property_id}/access",
    response_model=Zugangsdaten,
    summary="Türcode und WLAN lesen",
)
def zugang_lesen(
    property_id: str,
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("properties:read"))],
) -> Zugangsdaten:
    """Die Anreise-Angaben eines Objekts.

    Sie sind vertraulich: der Endpunkt hängt am Objekt-Lesescope, und ein auf
    Objekte beschränkter Zugang sieht nur seine. Gibt es keine Angaben, kommen
    leere Felder zurück — kein Platzhalter-Code.
    """
    db = service_db()
    _objekt(db, ctx, property_id)
    zeile = _portal_zeile(db, property_id)
    return Zugangsdaten(
        property_id=property_id,
        self_checkin=bool(zeile.get("self_checkin")),
        door_code=zeile.get("door_code"),
        wifi_ssid=zeile.get("wifi_ssid"),
        wifi_password=zeile.get("wifi_password"),
        show_code_only_if_paid=bool(zeile.get("show_code_only_if_paid")),
        hide_code_until_checkin=bool(zeile.get("hide_code_until_checkin")),
        code_visible_from=zeile.get("code_visible_from"),
    )


@router.put(
    "/{property_id}/access",
    response_model=Zugangsdaten,
    summary="Türcode und WLAN setzen",
)
def zugang_setzen(
    property_id: str,
    body: ZugangsdatenSetzen,
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("properties:write"))],
) -> Zugangsdaten:
    """Setzt Türcode, WLAN und die Sichtbarkeitsregeln.

    Nur mitgeschickte Felder werden geändert; ein `null` löscht den Wert. Gibt
    es für das Objekt noch keine Zeile, wird sie angelegt — der Aufruf ist damit
    idempotent, egal ob vorher etwas stand (Wurzel 2).
    """
    db = service_db()
    _objekt(db, ctx, property_id)

    aenderung = body.model_dump(exclude_unset=True)
    if not aenderung:
        raise errors.ungueltige_anfrage("Keine Änderung mitgeschickt.")

    vorhanden = (
        db.table("property_guest_portal")
        .select("id")
        .eq("property_id", property_id)
        .limit(1)
        .execute()
    ).data or []
    if vorhanden:
        (
            db.table("property_guest_portal")
            .update(aenderung)
            .eq("id", vorhanden[0]["id"])
            .execute()
        )
    else:
        db.table("property_guest_portal").insert(
            {"property_id": property_id, **aenderung}
        ).execute()

    return zugang_lesen(property_id, ctx)


def _portal_zeile(db: Client, property_id: str) -> dict:
    """Die Gast-Portal-Zeile eines Objekts, oder ein leeres Dict.

    Kein Fehler, wenn sie fehlt: ein Objekt ohne Selbst-Check-in hat schlicht
    keine — das ist kein Datenfehler, sondern der Normalfall.
    """
    zeilen = (
        db.table("property_guest_portal")
        .select(
            "self_checkin, door_code, wifi_ssid, wifi_password, "
            "show_code_only_if_paid, hide_code_until_checkin, code_visible_from"
        )
        .eq("property_id", property_id)
        .limit(1)
        .execute()
    ).data or []
    return zeilen[0] if zeilen else {}
