"""Preise und Aufenthaltsregeln.

Preise hängen am RATE-PLAN, nicht am Objekt. Das ist keine Eigenheit, sondern
das Modell, das die Portale erzwingen: ein Zimmertyp trägt mehrere Pläne
(„Frühstück inklusive", „nicht erstattbar"), und SiteMinder wie Channex senden
Preise je Plan. Ein Ferienobjekt hat im Normalfall genau einen Plan — dann ist
„der Preis des Objekts" der Preis dieses Plans.

Was diese API liefert, sind die GESETZTEN Werte: der Grundpreis des Plans und
die Tagespreise, die davon abweichen. Was sie NICHT liefert, ist ein
ausgerechneter Aufenthaltspreis („was kosten diese vier Nächte für zwei
Erwachsene und einen Hund") — dazu siehe den Abschnitt „Grenzen von v1" in der
Dokumentation. Ein zweiter, hier nachgebauter Rechner wäre eine zweite Wahrheit
über Preise, und die fällt niemandem auf, bis ein Gast eine andere Summe sieht
als der Betrieb.
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from supabase import Client

from ..core import ari, errors
from ..core.auth import ApiKontext, scope_erforderlich
from ..core.db import service_db, zeile_im_mandanten
from ..core.pagination import zeitraum_pruefen
from .schemas import PreisErgebnis, PreisSetzen, RatePlan, TagesPreis

router = APIRouter(tags=["Preise"])


def _plan_im_betrieb(db: Client, ctx: ApiKontext, rate_plan_id: str) -> dict:
    """Rate-Plan laden und BEIDES erzwingen: Betrieb und Objekt-Beschränkung.

    Der Plan hängt nicht direkt am Mandanten, sondern über sein Objekt. Ein
    Zugriff, der nur die Plan-ID prüft, wäre deshalb ein Weg in fremde Betriebe
    (Wurzel 3) — geladen wird darum immer über das Objekt.
    """
    zeilen = (
        db.table("rate_plans")
        .select(
            "id, property_id, name, base_price, currency, min_stay, rate_mode, "
            "derived_from_rate_plan_id, offset_amount, offset_percent, send_to_portals"
        )
        .eq("id", rate_plan_id)
        .limit(1)
        .execute()
    ).data
    if not zeilen:
        raise errors.nicht_gefunden("Der Rate-Plan")
    plan = zeilen[0]
    property_id = str(plan["property_id"])
    ctx.objekt_pruefen(property_id)
    # Der Mandant kommt über das Objekt — ein fremder Plan ergibt denselben 404
    # wie ein nicht existierender.
    zeile_im_mandanten(
        db, "properties", property_id, ctx.tenant_id, spalten="id", was="Der Rate-Plan"
    )
    return plan


def _plan_aus_zeile(zeile: dict) -> RatePlan:
    waehrung = (zeile.get("currency") or "").strip()
    if not waehrung:
        # Ein Rate-Plan ohne Währung ist ein Datenfehler. Ein erfundenes „EUR"
        # würde in einem dänischen Betrieb Kronen als Euro ausgeben (Wurzel 4).
        raise errors.ApiFehler(
            status=422,
            code="waehrung_fehlt",
            detail=(
                f"Dem Rate-Plan {zeile['id']} ist keine Währung zugeordnet. "
                "Ohne Währung sind seine Preise nicht auslieferbar."
            ),
            titel="Währung fehlt",
            extra={"rate_plan_id": str(zeile["id"])},
        )
    return RatePlan(
        id=str(zeile["id"]),
        property_id=str(zeile["property_id"]),
        name=zeile.get("name") or "",
        base_price=Decimal(str(zeile.get("base_price") or 0)),
        currency=waehrung,
        min_stay=int(zeile.get("min_stay") or 1),
        rate_mode=zeile.get("rate_mode"),
        derived_from_rate_plan_id=(
            str(zeile["derived_from_rate_plan_id"])
            if zeile.get("derived_from_rate_plan_id")
            else None
        ),
        offset_amount=(
            Decimal(str(zeile["offset_amount"]))
            if zeile.get("offset_amount") is not None
            else None
        ),
        offset_percent=(
            Decimal(str(zeile["offset_percent"]))
            if zeile.get("offset_percent") is not None
            else None
        ),
        send_to_portals=bool(zeile.get("send_to_portals")),
    )


@router.get(
    "/rate-plans",
    response_model=list[RatePlan],
    summary="Rate-Pläne eines Objekts",
)
def plaene(
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("rates:read"))],
    property_id: Annotated[str, Query(description="Objekt, dessen Pläne gelistet werden.")],
) -> list[RatePlan]:
    """Alle Rate-Pläne eines Objekts.

    Die `id` eines Plans brauchst du für jeden Preisaufruf — Preise werden nie
    „am Objekt" gesetzt.
    """
    ctx.objekt_pruefen(property_id)
    db = service_db()
    zeile_im_mandanten(
        db, "properties", property_id, ctx.tenant_id, spalten="id", was="Das Objekt"
    )
    zeilen = (
        db.table("rate_plans")
        .select(
            "id, property_id, name, base_price, currency, min_stay, rate_mode, "
            "derived_from_rate_plan_id, offset_amount, offset_percent, send_to_portals"
        )
        .eq("property_id", property_id)
        .order("name")
        .execute()
    ).data or []
    return [_plan_aus_zeile(z) for z in zeilen]


@router.get("/rates", summary="Tagespreise und Aufenthaltsregeln lesen")
def lesen(
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("rates:read"))],
    rate_plan_id: Annotated[str, Query(description="Rate-Plan, dessen Preise gelesen werden.")],
    from_: Annotated[date, Query(alias="from")],
    to: Annotated[date, Query(description="Letzter Tag (einschließlich).")],
) -> dict[str, Any]:
    """Tagespreise, Mindest-/Höchstaufenthalt und An-/Abreisesperren.

    `price: null` an einem Tag heißt: für diesen Tag ist kein eigener Preis
    gesetzt, es gilt der `base_price` des Plans. Das ist ausdrücklich NICHT
    „kostet nichts" — deshalb steht dort `null` und keine 0.
    """
    db = service_db()
    plan = _plan_im_betrieb(db, ctx, rate_plan_id)
    zeitraum_pruefen(from_, to)
    waehrung = (plan.get("currency") or "").strip()
    if not waehrung:
        raise errors.ApiFehler(
            status=422,
            code="waehrung_fehlt",
            detail=f"Dem Rate-Plan {rate_plan_id} ist keine Währung zugeordnet.",
            titel="Währung fehlt",
        )

    preise = {
        str(z["date"])[:10]: z.get("price")
        for z in (
            db.table("rate_plan_price_overrides")
            .select("date, price")
            .eq("rate_plan_id", rate_plan_id)
            .gte("date", from_.isoformat())
            .lte("date", to.isoformat())
            .execute()
        ).data
        or []
    }
    min_stay = {
        str(z["date"])[:10]: z.get("min_stay")
        for z in (
            db.table("rate_plan_min_stay_overrides")
            .select("date, min_stay")
            .eq("rate_plan_id", rate_plan_id)
            .gte("date", from_.isoformat())
            .lte("date", to.isoformat())
            .execute()
        ).data
        or []
    }
    restr = {
        str(z["date"])[:10]: z
        for z in (
            db.table("rate_plan_restriction_overrides")
            .select("date, closed_to_arrival, closed_to_departure, max_stay")
            .eq("rate_plan_id", rate_plan_id)
            .gte("date", from_.isoformat())
            .lte("date", to.isoformat())
            .execute()
        ).data
        or []
    }

    tage: list[TagesPreis] = []
    tag = from_
    while tag <= to:
        iso = tag.isoformat()
        r = restr.get(iso, {})
        rohpreis = preise.get(iso)
        tage.append(
            TagesPreis(
                date=tag,
                price=Decimal(str(rohpreis)) if rohpreis is not None else None,
                currency=waehrung,
                min_stay=min_stay.get(iso),
                closed_to_arrival=bool(r.get("closed_to_arrival")),
                closed_to_departure=bool(r.get("closed_to_departure")),
                max_stay=r.get("max_stay"),
            )
        )
        tag += timedelta(days=1)

    return {
        "rate_plan_id": rate_plan_id,
        "property_id": str(plan["property_id"]),
        "currency": waehrung,
        "base_price": str(plan.get("base_price") or 0),
        "data": [t.model_dump(mode="json") for t in tage],
    }


@router.put(
    "/rates",
    response_model=PreisErgebnis,
    summary="Tagespreise und Aufenthaltsregeln setzen",
)
def setzen(
    body: PreisSetzen,
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("rates:write"))],
) -> PreisErgebnis:
    """Preise und Regeln für einen Zeitraum setzen.

    Nur was du mitschickst, wird geändert. Ein weggelassenes Feld bleibt, wie es
    war — es wird nicht zurückgesetzt. Zum Löschen eines Tagespreises schickst
    du `price: null`; danach gilt für diesen Tag wieder der Grundpreis des Plans.

    Mit `weekdays` änderst du nur bestimmte Wochentage im Zeitraum — der übliche
    Fall „Freitag und Samstag teurer" braucht damit einen Aufruf statt eines je
    Wochenende.

    Nach dem Schreiben gehen die geänderten Tage an die Portale. Ohne diesen
    Schritt stünde der neue Preis nur bei uns, und verkauft würde weiter zum
    alten.
    """
    db = service_db()
    plan = _plan_im_betrieb(db, ctx, body.rate_plan_id)
    zeitraum_pruefen(body.from_, body.to)

    felder_gesetzt = body.model_dump(exclude_unset=True)
    preis_gesetzt = "price" in felder_gesetzt
    min_stay_gesetzt = body.min_stay is not None
    restr_gesetzt = (
        body.max_stay is not None
        or body.closed_to_arrival is not None
        or body.closed_to_departure is not None
    )
    if not (preis_gesetzt or min_stay_gesetzt or restr_gesetzt):
        raise errors.ungueltige_anfrage(
            "Die Anfrage enthält keinen zu setzenden Wert "
            "(price, min_stay, max_stay, closed_to_arrival, closed_to_departure)."
        )
    if body.max_stay is not None and body.min_stay is not None and body.max_stay < body.min_stay:
        raise errors.ungueltige_anfrage(
            "max_stay ist kleiner als min_stay.",
            extra={"min_stay": body.min_stay, "max_stay": body.max_stay},
        )

    tage = [
        t
        for t in (
            body.from_ + timedelta(days=i)
            for i in range((body.to - body.from_).days + 1)
        )
        # `isoweekday()` zählt 1 = Montag … 7 = Sonntag — dieselbe Zählung wie
        # im Feld `weekdays`, damit der Client nicht umrechnen muss.
        if body.weekdays is None or t.isoweekday() in body.weekdays
    ]
    if not tage:
        raise errors.ungueltige_anfrage(
            "Im Zeitraum liegt keiner der angegebenen Wochentage."
        )

    if preis_gesetzt:
        _preise_schreiben(db, body.rate_plan_id, tage, body.price)
    if min_stay_gesetzt:
        db.table("rate_plan_min_stay_overrides").upsert(
            [
                {"rate_plan_id": body.rate_plan_id, "date": t.isoformat(),
                 "min_stay": body.min_stay}
                for t in tage
            ],
            on_conflict="rate_plan_id,date",
        ).execute()
    if restr_gesetzt:
        _restriktionen_schreiben(db, body, tage)

    property_id = str(plan["property_id"])
    if preis_gesetzt:
        ari.preis_melden(
            db, ctx.tenant_id, property_id, body.rate_plan_id, body.from_, body.to
        )
    if min_stay_gesetzt or restr_gesetzt:
        ari.restriktionen_melden(
            db, ctx.tenant_id, property_id, body.rate_plan_id, body.from_, body.to
        )

    return PreisErgebnis(
        **{
            "rate_plan_id": body.rate_plan_id,
            "from": body.from_,
            "to": body.to,
            "days_changed": len(tage),
        }
    )


def _preise_schreiben(
    db: Client, rate_plan_id: str, tage: list[date], preis: Decimal | None
) -> None:
    """Tagespreise setzen oder löschen.

    `price: null` LÖSCHT die Zeile statt sie mit NULL zu füllen. Beides würde
    „kein Tagespreis" bedeuten, aber eine Zeile mit NULL bliebe für immer in der
    Tabelle stehen und in jeder Auswertung als gesetzter Tag mitzählen
    (Wurzel 1: der freigewordene Zustand wird mitgepflegt).
    """
    iso_tage = [t.isoformat() for t in tage]
    if preis is None:
        db.table("rate_plan_price_overrides").delete().eq(
            "rate_plan_id", rate_plan_id
        ).in_("date", iso_tage).execute()
        return
    db.table("rate_plan_price_overrides").upsert(
        [
            {"rate_plan_id": rate_plan_id, "date": tag, "price": str(preis)}
            for tag in iso_tage
        ],
        on_conflict="rate_plan_id,date",
    ).execute()


def _restriktionen_schreiben(db: Client, body: PreisSetzen, tage: list[date]) -> None:
    """An-/Abreisesperren und Höchstaufenthalt setzen.

    Nur mitgeschickte Felder landen in der Zeile. Ein Upsert mit allen drei
    Feldern würde die beiden nicht gemeinten auf ihren Standardwert
    zurücksetzen — aus „setze max_stay" würde stillschweigend „hebe die
    Anreisesperre auf" (Wurzel 1).
    """
    basis: dict[str, Any] = {}
    if body.closed_to_arrival is not None:
        basis["closed_to_arrival"] = body.closed_to_arrival
    if body.closed_to_departure is not None:
        basis["closed_to_departure"] = body.closed_to_departure
    if body.max_stay is not None:
        basis["max_stay"] = body.max_stay

    vorhanden = {
        str(z["date"])[:10]
        for z in (
            db.table("rate_plan_restriction_overrides")
            .select("date")
            .eq("rate_plan_id", body.rate_plan_id)
            .in_("date", [t.isoformat() for t in tage])
            .execute()
        ).data
        or []
    }
    neu = [
        {"rate_plan_id": body.rate_plan_id, "date": t.isoformat(), **basis}
        for t in tage
        if t.isoformat() not in vorhanden
    ]
    if neu:
        db.table("rate_plan_restriction_overrides").insert(neu).execute()
    zu_aendern = [t.isoformat() for t in tage if t.isoformat() in vorhanden]
    if zu_aendern:
        db.table("rate_plan_restriction_overrides").update(basis).eq(
            "rate_plan_id", body.rate_plan_id
        ).in_("date", zu_aendern).execute()
