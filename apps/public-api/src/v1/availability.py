"""Verfügbarkeit lesen, Nächte sperren und freigeben.

Verfügbarkeit ist eine ZAHL: die freien Einheiten eines Objekt-Typs an einem
Tag. Gerechnet wird auf dem KALENDER (`availability`), nicht auf den
Reservierungen — der Kalender ist die Wahrheit für Belegung (Buchung,
Handsperre, Wartung, Vertragsende, iCal-Fremdbelegung), und er ist im Moment
einer eingehenden Buchung eher geschrieben als die Reservierungszeile.

Zwei Dinge, die dieser Endpunkt niemals tut:

* **Eine Buchung überschreiben.** Gebuchte Nächte werden übersprungen und in
  `nights_skipped` gezählt. Wer eine Buchung aus dem Weg räumen will, storniert
  sie — nicht über den Kalender.
* **Den Gegenzustand vergessen.** Nach jeder Änderung geht der neue Stand an die
  Portale (`core/ari.py`). Eine Sperre, die nur bei uns steht, wird bei
  Booking.com weiterverkauft.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from supabase import Client

from ..core import ari, errors
from ..core.auth import ApiKontext, scope_erforderlich
from ..core.db import service_db, zeile_im_mandanten
from ..core.einheiten import AVAILABILITY_CONFLICT, je_einheit
from ..core.einheiten_verfuegbar import einheiten_zahl, freie_einheiten_spannen
from ..core.pagination import zeitraum_pruefen
from .schemas import (
    SperrAnfrage,
    SperrErgebnis,
    VerfuegbarkeitsSpanne,
    VerfuegbarkeitsTag,
)

router = APIRouter(prefix="/availability", tags=["Verfügbarkeit"])

# Kalender-Status, die eine Nacht belegen. Deckungsgleich mit `_GESPERRT` in
# `core/einheiten_verfuegbar.py` — dort steht die vollständige Regelliste.
_BELEGT = ("booked", "blocked")


def _objekt_pruefen(db: Client, ctx: ApiKontext, property_id: str) -> None:
    """Objekt gehört zum Betrieb UND liegt in der Beschränkung des Zugangs."""
    ctx.objekt_pruefen(property_id)
    zeile_im_mandanten(
        db, "properties", property_id, ctx.tenant_id, spalten="id", was="Das Objekt"
    )


def _einheit_pruefen(db: Client, property_id: str, unit_id: str) -> None:
    """Die benannte Einheit gehört zu DIESEM Objekt.

    Ohne diese Prüfung wanderte eine geratene UUID direkt in eine
    Kalenderzeile — und damit ließe sich eine fremde Einheit sperren
    (Wurzel 3: der Anfrage nicht vertrauen, service_role umgeht RLS).
    """
    zeilen = (
        db.table("property_units")
        .select("id")
        .eq("id", unit_id)
        .eq("property_id", property_id)
        .limit(1)
        .execute()
    ).data
    if not zeilen:
        raise errors.ungueltige_anfrage(
            "Die angegebene Einheit gehört nicht zu diesem Objekt."
        )


@router.get("", summary="Verfügbarkeit lesen")
def lesen(
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("availability:read"))],
    property_id: Annotated[str, Query(description="Objekt, dessen Kalender gelesen wird.")],
    from_: Annotated[date, Query(alias="from", description="Erste Nacht.")],
    to: Annotated[date, Query(description="Letzte Nacht (einschließlich).")],
    granularity: Annotated[
        str,
        Query(
            description=(
                "`spans` (Standard): zusammenhängende Zeiträume gleicher "
                "Stückzahl — ein Jahr sind so meist ein Dutzend Zeilen statt "
                "365. `days`: eine Zeile je Tag, zusätzlich mit "
                "Aufenthaltsregeln und Verkaufsstopp."
            )
        ),
    ] = "spans",
) -> dict[str, Any]:
    """Freie Einheiten je Tag oder Zeitraum.

    `units_available: 0` heißt „an diesem Tag ist nichts verkäuflich" — der
    Grund kann eine Buchung, eine Handsperre oder ein Verkaufsstopp sein. Mit
    `granularity=days` steht der Grund dabei.
    """
    if granularity not in {"spans", "days"}:
        raise errors.ungueltige_anfrage("granularity muss 'spans' oder 'days' sein.")
    db = service_db()
    _objekt_pruefen(db, ctx, property_id)
    zeitraum_pruefen(from_, to)

    if granularity == "spans":
        spannen = freie_einheiten_spannen(db, ctx.tenant_id, property_id, from_, to)
        return {
            "property_id": property_id,
            "granularity": "spans",
            "data": [
                VerfuegbarkeitsSpanne(
                    **{"from": von, "to": bis, "units_available": frei}
                ).model_dump(mode="json", by_alias=True)
                for von, bis, frei in spannen
            ],
        }

    return {
        "property_id": property_id,
        "granularity": "days",
        "data": [
            t.model_dump(mode="json")
            for t in _tage(db, ctx.tenant_id, property_id, from_, to)
        ],
    }


def _tage(
    db: Client, tenant_id: str, property_id: str, von: date, bis: date
) -> list[VerfuegbarkeitsTag]:
    """Tagesweise Sicht: freie Stückzahl plus die Regeln, die den Tag betreffen.

    Vier Abfragen für den ganzen Zeitraum statt vier je Tag. Bei einem Jahr
    Kalender ist das der Unterschied zwischen vier und 1460 Abfragen.
    """
    gesamt = einheiten_zahl(db, tenant_id, property_id)

    kalender = (
        db.table("availability")
        .select("date, status, unit_id, closed_to_arrival, closed_to_departure")
        .eq("property_id", property_id)
        .gte("date", von.isoformat())
        .lte("date", bis.isoformat())
        .execute()
    ).data or []

    stop_sell = {
        str(z["date"])[:10]
        for z in (
            db.table("stop_sell")
            .select("date")
            .eq("property_id", property_id)
            .is_("rate_plan_id", "null")
            .gte("date", von.isoformat())
            .lte("date", bis.isoformat())
            .execute()
        ).data
        or []
    }

    # Mindestaufenthalt liegt am Rate-Plan. Für die Tagesansicht wird der
    # STRENGSTE Wert über alle Pläne des Objekts genommen: er ist die
    # Untergrenze, unter der an diesem Tag keine Buchung möglich ist. Ein
    # einzelner Plan-Wert wäre irreführend, weil der Client nicht weiß, welcher
    # Plan gemeint ist.
    plan_ids = [
        str(z["id"])
        for z in (
            db.table("rate_plans").select("id").eq("property_id", property_id).execute()
        ).data
        or []
    ]
    min_stay_je_tag: dict[str, int] = {}
    if plan_ids:
        for z in (
            db.table("rate_plan_min_stay_overrides")
            .select("date, min_stay")
            .in_("rate_plan_id", plan_ids)
            .gte("date", von.isoformat())
            .lte("date", bis.isoformat())
            .execute()
        ).data or []:
            tag = str(z["date"])[:10]
            wert = int(z["min_stay"])
            min_stay_je_tag[tag] = max(min_stay_je_tag.get(tag, 0), wert)

    belegt: dict[str, set[str]] = {}
    cta: set[str] = set()
    ctd: set[str] = set()
    for z in kalender:
        tag = str(z["date"])[:10]
        if str(z.get("status") or "") in _BELEGT:
            belegt.setdefault(tag, set()).add(str(z.get("unit_id") or "*"))
        if z.get("closed_to_arrival"):
            cta.add(tag)
        if z.get("closed_to_departure"):
            ctd.add(tag)

    ergebnis: list[VerfuegbarkeitsTag] = []
    tag_datum = von
    while tag_datum <= bis:
        iso = tag_datum.isoformat()
        besetzt = belegt.get(iso, set())
        gestoppt = iso in stop_sell
        frei = 0 if (gestoppt or "*" in besetzt) else max(0, gesamt - len(besetzt))
        ergebnis.append(
            VerfuegbarkeitsTag(
                date=tag_datum,
                units_available=frei,
                units_total=gesamt,
                stop_sell=gestoppt,
                closed_to_arrival=iso in cta,
                closed_to_departure=iso in ctd,
                min_stay=min_stay_je_tag.get(iso),
            )
        )
        tag_datum += timedelta(days=1)
    return ergebnis


@router.put("", response_model=SperrErgebnis, summary="Nächte sperren oder freigeben")
def setzen(
    body: SperrAnfrage,
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("availability:write"))],
) -> SperrErgebnis:
    """Nächte sperren, freigeben oder den Verkauf ganz stoppen.

    `to` ist die letzte betroffene NACHT, nicht der Abreisetag — anders als bei
    einer Buchung, wo `check_out` der Abreisetag ist. Das ist bewusst so: hier
    beschreibst du Nächte, dort einen Aufenthalt.

    Gebuchte Nächte werden nie überschrieben. Sie erscheinen in
    `nights_skipped`; der Rest wird gesetzt. Ein Aufruf, der ausschließlich auf
    gebuchte Nächte trifft, ist deshalb kein Fehler, sondern ein Ergebnis mit
    `nights_changed: 0` — der Client sieht am Zähler, was passiert ist, statt
    einen 409 deuten zu müssen.
    """
    db = service_db()
    _objekt_pruefen(db, ctx, body.property_id)
    zeitraum_pruefen(body.from_, body.to)

    if body.unit_id:
        if body.action in {"stop_sell", "resume_sell"}:
            raise errors.ungueltige_anfrage(
                "Ein Verkaufsstopp gilt immer für das ganze Objekt; "
                "`unit_id` ist dabei nicht erlaubt."
            )
        _einheit_pruefen(db, body.property_id, body.unit_id)

    if body.action in {"stop_sell", "resume_sell"}:
        geaendert = _stop_sell(db, ctx, body)
        # Zwei Signale, beide nötig: die Restriktion UND die auf 0 gerechnete
        # Stückzahl. Booking.com verkauft, solange der Bestand > 0 ist —
        # deshalb reicht die Restriktion allein nicht.
        ari.stop_sell_melden(db, ctx.tenant_id, body.property_id, body.from_, body.to)
        ari.verfuegbarkeit_melden(
            db, ctx.tenant_id, body.property_id, body.from_, body.to
        )
        return SperrErgebnis(
            **{
                "property_id": body.property_id,
                "from": body.from_,
                "to": body.to,
                "action": body.action,
                "nights_changed": geaendert,
                "nights_skipped": 0,
            }
        )

    geaendert, uebersprungen = _kalender_setzen(db, ctx, body)
    # ERST nach dem Schreiben melden: der Helfer liest den Ist-Stand. Vorher
    # gerufen, meldete er den Zustand von vorher — beim Sperren zu viele freie
    # Einheiten (Überbuchung), beim Freigeben zu wenige (verschenkter Verkauf).
    ari.verfuegbarkeit_melden(db, ctx.tenant_id, body.property_id, body.from_, body.to)
    return SperrErgebnis(
        **{
            "property_id": body.property_id,
            "from": body.from_,
            "to": body.to,
            "action": body.action,
            "nights_changed": geaendert,
            "nights_skipped": uebersprungen,
        }
    )


def _naechte(von: date, bis: date) -> list[date]:
    """Alle Tage von `von` bis `bis` (einschließlich)."""
    return [von + timedelta(days=i) for i in range((bis - von).days + 1)]


def _kalender_setzen(
    db: Client, ctx: ApiKontext, body: SperrAnfrage
) -> tuple[int, int]:
    """`block` / `open` ausführen. Gibt (geändert, übersprungen) zurück."""
    tage = [t.isoformat() for t in _naechte(body.from_, body.to)]

    # Gebuchte Nächte zuerst ermitteln — sie sind tabu. Bei `unit_id` nur die
    # dieser Einheit; sonst zählt eine Buchung in EINER Einheit nicht als
    # Hindernis für die übrigen.
    q = (
        db.table("availability")
        .select("date, unit_id, status")
        .eq("property_id", body.property_id)
        .gte("date", tage[0])
        .lte("date", tage[-1])
        .eq("status", "booked")
    )
    if body.unit_id:
        q = q.eq("unit_id", body.unit_id)
    gebucht = {
        (str(z["date"])[:10], str(z.get("unit_id") or "*"))
        for z in (q.execute()).data or []
    }

    if body.action == "block":
        return _sperren(db, ctx, body, tage, gebucht)
    return _freigeben(db, body, tage, gebucht)


def _sperren(
    db: Client,
    ctx: ApiKontext,
    body: SperrAnfrage,
    tage: list[str],
    gebucht: set[tuple[str, str]],
) -> tuple[int, int]:
    """Nächte auf `blocked` setzen — je Einheit eine Zeile."""
    zeilen = je_einheit(
        db,
        body.property_id,
        [
            {
                "property_id": body.property_id,
                "date": tag,
                "status": "blocked",
                # `manual` und nicht ein eigener API-Wert: für den Kalender des
                # Betriebs ist es eine von Hand gesetzte Sperre, und der
                # `availability_source`-Katalog beschreibt die HERKUNFT der
                # Belegung (Portal, iCal, Vertragsende), nicht den Weg, über den
                # sie eingetragen wurde. Ein neuer Wert nur für diese API
                # müsste in jeder Auswertung und in jedem Frontend nachgezogen
                # werden — für eine Unterscheidung, die niemand braucht.
                "source": "manual",
                "note": body.note,
            }
            for tag in tage
        ],
        tenant_id=ctx.tenant_id,
        unit_id=body.unit_id,
    )
    zu_schreiben = [
        z for z in zeilen if (str(z["date"]), str(z.get("unit_id") or "*")) not in gebucht
    ]
    uebersprungen = len(zeilen) - len(zu_schreiben)
    if zu_schreiben:
        db.table("availability").upsert(
            zu_schreiben, on_conflict=AVAILABILITY_CONFLICT
        ).execute()
    return len(zu_schreiben), uebersprungen


def _freigeben(
    db: Client, body: SperrAnfrage, tage: list[str], gebucht: set[tuple[str, str]]
) -> tuple[int, int]:
    """Handsperren aufheben: `blocked` → `open`.

    Nur `status = 'blocked'` wird angefasst. Eine gebuchte Nacht bleibt gebucht —
    eine Buchung wird nicht über den Kalender aufgelöst, sondern storniert.

    Ebenfalls unberührt bleiben Sperren mit einem `block_request_id`: sie
    gehören zu einem genehmigten Antrag eines Eigentümers, und der wird über
    seinen Widerruf aufgehoben, nicht über einen fremden Kalenderaufruf
    (Wurzel 1 — sonst bliebe der Antrag als genehmigt stehen, während seine
    Nächte wieder verkäuflich sind).
    """
    q = (
        db.table("availability")
        .update({"status": "open", "note": None})
        .eq("property_id", body.property_id)
        .gte("date", tage[0])
        .lte("date", tage[-1])
        .eq("status", "blocked")
        .is_("block_request_id", "null")
    )
    if body.unit_id:
        q = q.eq("unit_id", body.unit_id)
    geaendert = len((q.execute()).data or [])
    return geaendert, len(gebucht)


def _stop_sell(db: Client, ctx: ApiKontext, body: SperrAnfrage) -> int:
    """Objektweiten Verkaufsstopp setzen oder aufheben.

    Objektweit heißt: `rate_plan_id is null`. Ein plan-genauer Stopp schließt
    nur EINEN Rate-Plan und ist über diese API bewusst nicht setzbar — er ist
    ein Feinwerkzeug der Oberfläche, und über eine API vergeben würde er stille
    Löcher in den Verkauf reißen, die im Kalender nicht sichtbar sind.
    """
    tage = _naechte(body.from_, body.to)
    if body.action == "resume_sell":
        geaendert = (
            db.table("stop_sell")
            .delete()
            .eq("property_id", body.property_id)
            .eq("tenant_id", ctx.tenant_id)
            .is_("rate_plan_id", "null")
            .gte("date", tage[0].isoformat())
            .lte("date", tage[-1].isoformat())
            .execute()
        ).data
        return len(geaendert or [])

    zeilen = [
        {
            "tenant_id": ctx.tenant_id,
            "property_id": body.property_id,
            "date": tag.isoformat(),
            "reason": body.note,
            "source": "manual",
        }
        for tag in tage
    ]
    db.table("stop_sell").upsert(zeilen, on_conflict="property_id,date").execute()
    return len(zeilen)
