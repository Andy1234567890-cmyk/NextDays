"""Eine BESTEHENDE Buchung verwalten: Preisaufstellung, Änderung, An- und
Abreise, Ablage, Nachrichten, Zahlungen, Storno.

Getrennt von `reservations.py`, das die Buchung ANLEGT und liest. Die Trennung
ist nicht kosmetisch: das Anlegen hängt an der Datenbankfunktion
`create_reservation_atomic` und trägt die Idempotenz-Kette; hier stehen
Vorgänge an einer Buchung, die es schon gibt. Beide Router hängen unter
demselben Präfix `/reservations`, die Reihenfolge der Registrierung steht in
`__init__.py`.

WAS HIER NICHT STEHT UND WARUM:
  · **Verschieben** (andere Daten, anderes Objekt, andere Einheit). Jede dieser
    Änderungen hat einen Gegenzustand — alte Nächte frei, neue belegt, beides
    an die Portale. Ein halber Weg lässt Nächte belegt, die frei sein müssten
    (Wurzel 1).
  · **Den Storno selbst ausführen.** Der Endpunkt hier stellt einen AUFTRAG an
    die eine Storno-Kette in `apps/api` (Job `public_api_cancel_reservation`).
    Diese Kette hat sechs Aufrufer; sie hier nachzubauen hiesse, sie zweimal
    richtig halten zu müssen.
  · **Ein Gespräch eröffnen** oder **eine Zahlung auslösen.** Beides führt eine
    Kette, die anderswo lebt (Kanalwahl und Zustellung; Zahlungsweg und
    Abgleich). Gelesen und angehängt wird hier, begonnen nicht.
"""
from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Header
from supabase import Client

from ..core import errors
from ..core.auth import ApiKontext, scope_erforderlich
from ..core.db import service_db, zeile_im_mandanten
from ..core.einheiten_verfuegbar import freie_einheiten_spannen
from ..core.pagination import zeitraum_pruefen
from .reservations import _SPALTEN, _buchung_aus_zeile, _gaeste_zu
from .schemas import Buchung, PortalRohdaten
from .schemas_verwalten import (
    AblageAntwort,
    AnkunftAntwort,
    BuchungAenderung,
    Nachricht,
    NachrichtSenden,
    Quote,
    QuotePosten,
    StornoAnfrage,
    StornoAntwort,
    UngelesenAntwort,
    VerschiebeAnfrage,
    VerschiebeAntwort,
    Zahlung,
)

router = APIRouter(prefix="/reservations", tags=["Buchungen"])

# ---------------------------------------------------------------------------
# Preisaufstellung, Änderung, An- und Abreise
# ---------------------------------------------------------------------------
# Diese drei Endpunkte kommen ohne einen zweiten Rechen- oder Storno-Weg aus:
# die Aufstellung wird GELESEN, die Änderung berührt nur Felder ohne
# Gegenzustand, und An-/Abreise setzt je einen Zeitstempel. Alles, was Nächte,
# Portale oder Geld bewegt (verschieben, stornieren), bleibt bewusst draußen —
# siehe Modul-Docstring.
@router.get(
    "/unread",
    response_model=UngelesenAntwort,
    summary="Ungelesene Gast-Nachrichten zählen",
)
def ungelesen(
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("reservations:read"))],
) -> UngelesenAntwort:
    """Wie viele Gespräche auf eine Antwort warten — der Zähler für ein Abzeichen.

    Steht bewusst VOR dem Pfad `/{reservation_id}`: FastAPI vergleicht in der
    Reihenfolge der Registrierung, und ein Parameter-Pfad davor würde `unread`
    als Buchungs-ID lesen.
    """
    return _ungelesen_zaehlen(service_db(), ctx)


_QUOTE_SPALTEN = (
    "id, property_id, currency, total_amount, paid_amount, quote_items"
)


@router.get(
    "/{reservation_id}/quote",
    response_model=Quote,
    summary="Preisaufstellung einer Buchung",
)
def quote_lesen(
    reservation_id: str,
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("reservations:read"))],
) -> Quote:
    """Die gespeicherte Aufstellung — Unterkunft, Gebühren, Abgaben, Rabatte.

    Sie wird nicht neu gerechnet. Was hier steht, ist die Aufstellung, die zur
    Buchung gehört; eine zweite Rechnung an dieser Stelle würde irgendwann eine
    andere Summe liefern als die Rechnung des Gastes.
    """
    db = service_db()
    zeile = zeile_im_mandanten(
        db, "reservations", reservation_id, ctx.tenant_id,
        spalten=_QUOTE_SPALTEN, was="Die Buchung",
    )
    ctx.objekt_pruefen(str(zeile["property_id"]))

    waehrung = zeile.get("currency")
    if not waehrung:
        # Ein Betrag ohne Währung ist keine Auskunft, sondern eine Falle: 1200
        # kann DKK oder EUR sein. Datenfehler → klar fehlschlagen (Wurzel 4).
        raise errors.ungueltige_anfrage(
            "Zu dieser Buchung ist keine Währung gespeichert."
        )

    gesamt = Decimal(str(zeile.get("total_amount") or 0))
    bezahlt = Decimal(str(zeile.get("paid_amount") or 0))
    posten = zeile.get("quote_items") or []
    return Quote(
        reservation_id=str(zeile["id"]),
        currency=waehrung,
        total_amount=gesamt,
        paid_amount=bezahlt,
        due_amount=gesamt - bezahlt,
        items=[
            QuotePosten(
                kind=str(p.get("kind") or "other"),
                label=str(p.get("label") or ""),
                amount=Decimal(str(p.get("amount") or 0)),
            )
            for p in posten
            if isinstance(p, dict)
        ],
    )


@router.patch(
    "/{reservation_id}",
    response_model=Buchung,
    summary="Buchung ändern",
    responses={
        422: {
            "description": (
                "Ein Wert ist unmöglich, oder es wurde versucht, Zeitraum, "
                "Objekt oder Status zu ändern — das geht über diesen Endpunkt "
                "nicht."
            )
        },
    },
)
def aendern(
    reservation_id: str,
    body: BuchungAenderung,
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("reservations:write"))],
) -> Buchung:
    """Gästezahl, Notiz, Zeiten und Gastkontakt ändern.

    NICHT möglich: verschieben, das Objekt wechseln, den Status setzen oder
    Beträge überschreiben. Diese Änderungen haben Gegenzustände — belegte
    Nächte, Portal-Meldung, Rechnung — und laufen deshalb dort, wo diese Kette
    vollständig gepflegt wird.
    """
    db = service_db()
    zeile = zeile_im_mandanten(
        db, "reservations", reservation_id, ctx.tenant_id,
        spalten=_SPALTEN, was="Die Buchung",
    )
    ctx.objekt_pruefen(str(zeile["property_id"]))

    # `exclude_unset` ist hier der Unterschied zwischen „Feld weglassen" und
    # „Feld auf null setzen": ohne das würde jede Änderung alle nicht
    # mitgeschickten Felder leeren.
    aenderung = body.model_dump(exclude_unset=True)
    if not aenderung:
        raise errors.ungueltige_anfrage("Keine Änderung mitgeschickt.")

    aktualisiert = (
        db.table("reservations")
        .update(aenderung)
        .eq("id", reservation_id)
        .eq("tenant_id", ctx.tenant_id)
        .execute()
    ).data or []
    if not aktualisiert:
        raise errors.nicht_gefunden("Die Buchung")

    frisch = zeile_im_mandanten(
        db, "reservations", reservation_id, ctx.tenant_id,
        spalten=_SPALTEN, was="Die Buchung",
    )
    gaeste = _gaeste_zu(db, ctx.tenant_id, [frisch])
    return _buchung_aus_zeile(frisch, gaeste.get(str(frisch.get("guest_id"))))


@router.post(
    "/{reservation_id}/check-in",
    response_model=AnkunftAntwort,
    summary="Anreise melden",
)
def check_in(
    reservation_id: str,
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("reservations:write"))],
) -> AnkunftAntwort:
    """Setzt den Anreise-Zeitpunkt auf jetzt — falls er noch nicht steht.

    Idempotent ohne Schlüssel: ein zweiter Aufruf gibt denselben Zeitpunkt
    zurück, statt ihn zu überschreiben. Real kommt so ein Aufruf doppelt (Tablet
    am Empfang, doppelt getippt), und der Zeitpunkt der ERSTEN Anreise ist der
    richtige (Wurzel 2).
    """
    return _ankunft_setzen(reservation_id, ctx, feld="checked_in_at")


@router.post(
    "/{reservation_id}/check-out",
    response_model=AnkunftAntwort,
    summary="Abreise melden",
)
def check_out(
    reservation_id: str,
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("reservations:write"))],
) -> AnkunftAntwort:
    """Setzt den Abreise-Zeitpunkt auf jetzt — falls er noch nicht steht."""
    return _ankunft_setzen(reservation_id, ctx, feld="checked_out_at")


def _ankunft_setzen(
    reservation_id: str, ctx: ApiKontext, *, feld: str
) -> AnkunftAntwort:
    db = service_db()
    zeile = zeile_im_mandanten(
        db, "reservations", reservation_id, ctx.tenant_id,
        spalten="id, property_id, checked_in_at, checked_out_at",
        was="Die Buchung",
    )
    ctx.objekt_pruefen(str(zeile["property_id"]))

    if zeile.get(feld) is None:
        jetzt = datetime.now(tz=UTC).isoformat()
        (
            db.table("reservations")
            .update({feld: jetzt})
            .eq("id", reservation_id)
            .eq("tenant_id", ctx.tenant_id)
            # Nur setzen, wenn das Feld leer ist: zwei gleichzeitige Aufrufe
            # ergeben damit denselben Zeitpunkt und nicht den späteren.
            .is_(feld, "null")
            .execute()
        )
        zeile = zeile_im_mandanten(
            db, "reservations", reservation_id, ctx.tenant_id,
            spalten="id, property_id, checked_in_at, checked_out_at",
            was="Die Buchung",
        )

    return AnkunftAntwort(
        reservation_id=str(zeile["id"]),
        checked_in_at=zeile.get("checked_in_at"),
        checked_out_at=zeile.get("checked_out_at"),
    )


# ---------------------------------------------------------------------------
# Ablage
# ---------------------------------------------------------------------------
@router.delete(
    "/{reservation_id}",
    response_model=AblageAntwort,
    summary="Buchung in die Ablage legen",
)
def ablegen(
    reservation_id: str,
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("reservations:write"))],
) -> AblageAntwort:
    """Legt die Buchung aus der Arbeitsliste in die Ablage.

    Das ist KEIN Storno und kein Löschen. Status, Belegung und Kalenderwirkung
    bleiben unverändert — eine abgelegte Buchung belegt weiter die Nächte, die
    sie belegt hat. Buchungen sind aufbewahrungspflichtige Geschäftsvorfälle;
    „Papierkorb" heißt hier Ablage, nicht Entfernung.

    Wer Nächte freigeben will, storniert. Das geht in v1 nicht — die
    Storno-Kette (Nächte freigeben, Portale melden, Partei und Grund
    festhalten, Gebühren und Auszahlungs-Karenz rechnen) hat EINE Stelle, und
    ein zweiter Weg dorthin wäre ein zweiter Weg zu freigegebenen Nächten ohne
    Portal-Meldung.
    """
    return _ablage_setzen(reservation_id, ctx, ablegen=True)


@router.post(
    "/{reservation_id}/restore",
    response_model=AblageAntwort,
    summary="Buchung aus der Ablage holen",
)
def zurueckholen(
    reservation_id: str,
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("reservations:write"))],
) -> AblageAntwort:
    """Holt die Buchung zurück in die Arbeitsliste."""
    return _ablage_setzen(reservation_id, ctx, ablegen=False)


def _ablage_setzen(
    reservation_id: str, ctx: ApiKontext, *, ablegen: bool
) -> AblageAntwort:
    db = service_db()
    zeile = zeile_im_mandanten(
        db, "reservations", reservation_id, ctx.tenant_id,
        spalten="id, property_id, archived_at", was="Die Buchung",
    )
    ctx.objekt_pruefen(str(zeile["property_id"]))

    # Idempotent: liegt sie schon dort, wo sie hin soll, bleibt der ZEITPUNKT
    # der ersten Ablage stehen. Ein zweiter Aufruf soll nicht „seit wann liegt
    # das hier" verfälschen (Wurzel 2).
    schon_so = (zeile.get("archived_at") is not None) == ablegen
    if not schon_so:
        wert = datetime.now(tz=UTC).isoformat() if ablegen else None
        (
            db.table("reservations")
            .update({"archived_at": wert})
            .eq("id", reservation_id)
            .eq("tenant_id", ctx.tenant_id)
            .execute()
        )
        zeile = zeile_im_mandanten(
            db, "reservations", reservation_id, ctx.tenant_id,
            spalten="id, property_id, archived_at", was="Die Buchung",
        )

    return AblageAntwort(
        reservation_id=str(zeile["id"]), archived_at=zeile.get("archived_at")
    )


# ---------------------------------------------------------------------------
# Nachrichten
# ---------------------------------------------------------------------------
def _thread_zu(db: Client, ctx: ApiKontext, reservation_id: str) -> dict | None:
    """Das Gespräch zu einer Buchung, auf den Mandanten gescopt."""
    return (
        (
            db.table("guest_message_threads")
            .select("id, reservation_id, property_id, host_read_at, last_message_at")
            .eq("tenant_id", ctx.tenant_id)
            .eq("reservation_id", reservation_id)
            .limit(1)
            .execute()
        ).data
        or [None]
    )[0]


@router.get(
    "/{reservation_id}/messages",
    response_model=list[Nachricht],
    summary="Nachrichten zu einer Buchung",
)
def nachrichten(
    reservation_id: str,
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("reservations:read"))],
) -> list[Nachricht]:
    """Das Gespräch mit dem Gast, älteste zuerst.

    Leere Liste, wenn zu dieser Buchung noch nichts geschrieben wurde — das ist
    kein Fehler, sondern der Normalfall bei einer frischen Buchung.
    """
    db = service_db()
    zeile = zeile_im_mandanten(
        db, "reservations", reservation_id, ctx.tenant_id,
        spalten="id, property_id", was="Die Buchung",
    )
    ctx.objekt_pruefen(str(zeile["property_id"]))

    thread = _thread_zu(db, ctx, reservation_id)
    if thread is None:
        return []
    zeilen = (
        db.table("guest_messages")
        .select("id, sender, body, read_at, created_at")
        .eq("thread_id", thread["id"])
        .order("created_at")
        .limit(500)
        .execute()
    ).data or []
    return [
        Nachricht(
            id=str(z["id"]),
            sender=str(z.get("sender") or "guest"),
            body=str(z.get("body") or ""),
            read_at=z.get("read_at"),
            created_at=z["created_at"],
        )
        for z in zeilen
    ]


@router.post(
    "/{reservation_id}/messages",
    response_model=Nachricht,
    status_code=201,
    summary="Nachricht an den Gast senden",
    responses={
        404: {
            "description": (
                "Die Buchung gibt es nicht, oder zu ihr besteht noch kein "
                "Gespräch — ein Gespräch entsteht mit der ersten Nachricht des "
                "Gastes oder über das Dashboard."
            )
        },
    },
)
def nachricht_senden(
    reservation_id: str,
    body: NachrichtSenden,
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("reservations:write"))],
) -> Nachricht:
    """Schreibt eine Nachricht in das bestehende Gespräch.

    Diese API ERÖFFNET kein Gespräch. Ein neues Gespräch zieht mehr nach sich
    als eine Zeile — Kanal wählen, Gast-Zustellung, Vorlagen, Automatisierung —
    und diese Kette lebt an einer Stelle. Hier wird an ein vorhandenes Gespräch
    angehängt; existiert keines, antwortet der Aufruf mit 404.
    """
    db = service_db()
    zeile = zeile_im_mandanten(
        db, "reservations", reservation_id, ctx.tenant_id,
        spalten="id, property_id", was="Die Buchung",
    )
    ctx.objekt_pruefen(str(zeile["property_id"]))

    thread = _thread_zu(db, ctx, reservation_id)
    if thread is None:
        raise errors.nicht_gefunden("Das Gespräch zu dieser Buchung")

    jetzt = datetime.now(tz=UTC).isoformat()
    angelegt = (
        db.table("guest_messages")
        .insert(
            {
                "thread_id": thread["id"],
                "sender": "host",
                "body": body.body,
                "created_at": jetzt,
            }
        )
        .execute()
    ).data or []
    if not angelegt:
        raise errors.ungueltige_anfrage("Die Nachricht konnte nicht gespeichert werden.")

    # Gegenzustand der neuen Nachricht: das Gespräch steht damit oben in der
    # Liste. Ohne diese Pflege sortiert der Posteingang nach einem Zeitpunkt,
    # der die letzte Aktivität nicht mehr beschreibt (Wurzel 1).
    (
        db.table("guest_message_threads")
        .update({"last_message_at": jetzt})
        .eq("id", thread["id"])
        .eq("tenant_id", ctx.tenant_id)
        .execute()
    )

    neu = angelegt[0]
    return Nachricht(
        id=str(neu["id"]),
        sender="host",
        body=str(neu.get("body") or ""),
        read_at=neu.get("read_at"),
        created_at=neu.get("created_at") or jetzt,
    )


@router.post(
    "/{reservation_id}/messages/read",
    response_model=UngelesenAntwort,
    summary="Nachrichten als gelesen markieren",
)
def gelesen_melden(
    reservation_id: str,
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("reservations:write"))],
) -> UngelesenAntwort:
    """Markiert die Gast-Nachrichten dieser Buchung als gelesen.

    Antwortet mit den Zählern NACH der Änderung, damit ein Client sein Abzeichen
    ohne zweiten Aufruf aktualisieren kann.
    """
    db = service_db()
    zeile = zeile_im_mandanten(
        db, "reservations", reservation_id, ctx.tenant_id,
        spalten="id, property_id", was="Die Buchung",
    )
    ctx.objekt_pruefen(str(zeile["property_id"]))

    thread = _thread_zu(db, ctx, reservation_id)
    if thread is not None:
        jetzt = datetime.now(tz=UTC).isoformat()
        (
            db.table("guest_messages")
            .update({"read_at": jetzt})
            .eq("thread_id", thread["id"])
            .eq("sender", "guest")
            .is_("read_at", "null")
            .execute()
        )
        (
            db.table("guest_message_threads")
            .update({"host_read_at": jetzt})
            .eq("id", thread["id"])
            .eq("tenant_id", ctx.tenant_id)
            .execute()
        )
    return _ungelesen_zaehlen(db, ctx)


# ---------------------------------------------------------------------------
# Zahlungen
# ---------------------------------------------------------------------------
@router.get(
    "/{reservation_id}/payments",
    response_model=list[Zahlung],
    summary="Zahlungen einer Buchung",
)
def zahlungen(
    reservation_id: str,
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("reservations:read"))],
) -> list[Zahlung]:
    """Zahlungen und terminierte Zahlungsaufforderungen, älteste zuerst.

    Nur LESEN. Eine Zahlung hier auszulösen oder einen Zahlungslink zu erzeugen
    hieße, den Zahlungsweg zweimal zu führen — mit zwei Wahrheiten darüber, was
    ein Gast bezahlt hat.
    """
    db = service_db()
    zeile = zeile_im_mandanten(
        db, "reservations", reservation_id, ctx.tenant_id,
        spalten="id, property_id", was="Die Buchung",
    )
    ctx.objekt_pruefen(str(zeile["property_id"]))

    zeilen = (
        db.table("payments")
        .select("id, amount, currency, type, status, gateway, due_at, created_at")
        .eq("reservation_id", reservation_id)
        .order("created_at")
        .limit(200)
        .execute()
    ).data or []
    ergebnis: list[Zahlung] = []
    for z in zeilen:
        waehrung = z.get("currency")
        if not waehrung:
            # Ein Betrag ohne Währung wird nicht geraten — die Zeile ist ein
            # Datenfehler und wird gemeldet, nicht stillschweigend als Euro
            # ausgeliefert (Wurzel 4).
            raise errors.ungueltige_anfrage(
                f"Zur Zahlung {z['id']} ist keine Währung gespeichert."
            )
        ergebnis.append(
            Zahlung(
                id=str(z["id"]),
                amount=Decimal(str(z.get("amount") or 0)),
                currency=waehrung,
                type=str(z.get("type") or "other"),
                status=str(z.get("status") or "unknown"),
                gateway=z.get("gateway"),
                due_at=z.get("due_at"),
                created_at=z["created_at"],
            )
        )
    return ergebnis


def _ungelesen_zaehlen(db: Client, ctx: ApiKontext) -> UngelesenAntwort:
    """Ungelesene Gast-Nachrichten über alle Gespräche des Betriebs."""
    q = (
        db.table("guest_message_threads")
        .select("id")
        .eq("tenant_id", ctx.tenant_id)
        .eq("host_archived", False)
    )
    if ctx.property_ids:
        # Dieselbe Beschränkung wie überall: ein Zugang für Objekt A zählt keine
        # Gespräche von Objekt B mit (Wurzel 9).
        q = q.in_("property_id", ctx.property_ids)
    threads = [t["id"] for t in (q.limit(2000).execute().data or [])]
    if not threads:
        return UngelesenAntwort(unread_threads=0, unread_messages=0)

    offen = (
        db.table("guest_messages")
        .select("thread_id")
        .in_("thread_id", threads)
        .eq("sender", "guest")
        .is_("read_at", "null")
        .limit(5000)
        .execute()
    ).data or []
    return UngelesenAntwort(
        unread_threads=len({z["thread_id"] for z in offen}),
        unread_messages=len(offen),
    )


# ---------------------------------------------------------------------------
# Storno
# ---------------------------------------------------------------------------
@router.post(
    "/{reservation_id}/cancel",
    response_model=StornoAntwort,
    status_code=202,
    summary="Buchung stornieren",
    responses={
        202: {
            "description": (
                "Der Storno ist beauftragt. Er ist in diesem Moment noch nicht "
                "vollzogen — das Ereignis `reservation.cancelled` meldet den "
                "Abschluss."
            )
        },
        422: {"description": "Grund oder Partei fehlen, oder die Partei ist unbekannt."},
    },
)
def stornieren(
    reservation_id: str,
    body: StornoAnfrage,
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("reservations:write"))],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> StornoAntwort:
    """Beauftragt den Storno und antwortet mit 202.

    **Warum nicht sofort erledigt:** ein Storno ist keine Statusänderung,
    sondern eine Kette — belegte Nächte freigeben, die Portale informieren,
    stornierende Partei und Grund festhalten, Stornogebühren und die
    Auszahlungs-Karenz rechnen, Protokollzeile schreiben. Diese Kette hat im
    Betriebssystem EINE Stelle mit sechs Aufrufern. Sie hier ein zweites Mal zu
    schreiben hiesse, sie zweimal richtig halten zu müssen — und der erste
    vergessene Schritt ist eine freigegebene Nacht, die kein Portal erfährt
    (Wurzel 1). Deshalb stellt dieser Endpunkt einen Auftrag, den diese eine
    Stelle abarbeitet.

    **Doppelte Aufrufe:** der Auftrag wird über einen festen Schlüssel je
    Buchung eingereiht. Zwei Aufrufe für dieselbe Buchung ergeben EINEN
    Storno-Vorgang, nicht zwei (Wurzel 2). Ein `Idempotency-Key` ist erlaubt,
    aber nicht nötig; er wird für die Wiedererkennung nicht gebraucht, weil die
    Buchungs-ID den Vorgang schon eindeutig macht.

    **War sie schon storniert**, antwortet der Aufruf mit `already_cancelled`
    und ändert nichts.
    """
    del idempotency_key
    db = service_db()
    zeile = zeile_im_mandanten(
        db, "reservations", reservation_id, ctx.tenant_id,
        spalten="id, property_id, status, cancelled_at", was="Die Buchung",
    )
    ctx.objekt_pruefen(str(zeile["property_id"]))

    if zeile.get("status") == "cancelled":
        return StornoAntwort(
            reservation_id=str(zeile["id"]),
            status="already_cancelled",
            cancelled_at=zeile.get("cancelled_at"),
        )

    # Der Grund trägt den Zugang mit: im Protokoll steht sonst ein Freitext ohne
    # Urheber, und „wer hat das storniert?" ist die erste Frage danach.
    grund = f"{body.reason} (öffentliche API, Zugang {ctx.client_id})"

    # `dedup_key` je Buchung: zwei Aufrufe coalescen zu einem offenen Auftrag.
    db.rpc(
        "enqueue_job",
        {
            "p_job_type": "public_api_cancel_reservation",
            "p_payload": {
                "tenant_id": ctx.tenant_id,
                "reservation_id": reservation_id,
                "reason": grund,
                "partei": body.party,
                "reason_code": body.reason_code,
            },
            "p_tenant_id": ctx.tenant_id,
            "p_dedup_key": f"public_api_cancel:{reservation_id}",
            "p_run_after": datetime.now(tz=UTC).isoformat(),
            "p_max_attempts": 10,
        },
    ).execute()

    return StornoAntwort(reservation_id=str(zeile["id"]), status="accepted")


# ---------------------------------------------------------------------------
# Verschieben
# ---------------------------------------------------------------------------
@router.post(
    "/{reservation_id}/move",
    response_model=VerschiebeAntwort,
    status_code=202,
    summary="Buchung verschieben",
    responses={
        202: {
            "description": (
                "Das Verschieben ist beauftragt. Es ist in diesem Moment noch "
                "nicht vollzogen — das Ereignis `reservation.updated` meldet "
                "den Abschluss."
            )
        },
        409: {
            "description": (
                "Der Ziel-Zeitraum ist belegt, gesperrt oder vom Verkauf "
                "ausgenommen. Es wurde NICHTS verändert."
            )
        },
        422: {"description": "Der Zeitraum ist unmöglich oder zu lang."},
    },
)
def verschieben(
    reservation_id: str,
    body: VerschiebeAnfrage,
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("reservations:write"))],
) -> VerschiebeAntwort:
    """Legt die Buchung in einen anderen Zeitraum und/oder ein anderes Objekt.

    **Warum 202 und nicht 200:** die Kette dahinter gibt die alten Nächte frei,
    belegt die neuen und meldet beide Zustände an die Portale. Sie hat im
    Betriebssystem EINE Stelle; ein zweiter Weg dorthin wäre ein zweiter Weg zu
    freigegebenen Nächten ohne Portal-Meldung (Wurzel 1).

    **Was dieser Aufruf trotzdem SOFORT beantwortet:** ob die Zieltage frei
    sind. Ein belegter Zeitraum ist der häufigste Fehlerfall, und ihn erst
    Sekunden später über ein Ereignis zu melden wäre unbrauchbar. Geprüft wird
    mit derselben Funktion, die auch die Verfügbarkeit ausliefert; die
    verbindliche Prüfung macht die ausführende Stelle noch einmal.

    **Nicht möglich:** eine OTA-Buchung verschieben (die Änderung muss im Portal
    passieren, sonst verkauft es die freigegebenen Nächte weiter), eine
    stornierte Buchung, und eine, bei der der Gast schon eingecheckt ist.
    """
    db = service_db()
    zeile = zeile_im_mandanten(
        db, "reservations", reservation_id, ctx.tenant_id,
        spalten=(
            "id, property_id, check_in, check_out, status, "
            "checked_in_at, checked_out_at, source_channex_booking_id"
        ),
        was="Die Buchung",
    )
    ctx.objekt_pruefen(str(zeile["property_id"]))
    # Auch das ZIEL-Objekt muss im Zugang liegen — sonst könnte ein auf ein
    # Objekt beschränkter Zugang eine Buchung in ein fremdes Objekt legen
    # (Wurzel 9).
    ctx.objekt_pruefen(body.property_id)
    zeitraum_pruefen(body.check_in, body.check_out)

    if zeile.get("status") == "cancelled":
        raise errors.konflikt(
            "buchung_storniert", "Eine stornierte Buchung lässt sich nicht verschieben."
        )
    if zeile.get("checked_out_at"):
        raise errors.konflikt(
            "aufenthalt_beendet",
            "Der Aufenthalt ist abgeschlossen und lässt sich nicht mehr verschieben.",
        )
    if zeile.get("checked_in_at"):
        # Ein anwesender Gast: würde man die Alt-Nächte freigeben, ginge
        # `availability=1` an die Portale, während er noch im Zimmer ist.
        raise errors.konflikt(
            "gast_eingecheckt",
            "Der Gast ist eingecheckt. Erst auschecken, dann verschieben.",
        )
    if zeile.get("source_channex_booking_id"):
        raise errors.konflikt(
            "portalbuchung",
            "Buchungen aus einem Portal lassen sich hier nicht verschieben — die "
            "Änderung muss im Portal passieren, sonst verkauft es die "
            "freigegebenen Nächte weiter.",
        )

    _zieltage_pruefen(db, ctx, zeile, body)

    db.rpc(
        "enqueue_job",
        {
            "p_job_type": "public_api_move_reservation",
            "p_payload": {
                "tenant_id": ctx.tenant_id,
                "reservation_id": reservation_id,
                "property_id": body.property_id,
                "check_in": body.check_in.isoformat(),
                "check_out": body.check_out.isoformat(),
                "reprice": body.reprice,
            },
            "p_tenant_id": ctx.tenant_id,
            # Ein Schlüssel je Buchung: zwei Aufrufe kurz hintereinander ergeben
            # EIN Verschieben, und zwar mit dem letzten Ziel (Wurzel 2).
            "p_dedup_key": f"public_api_move:{reservation_id}",
            "p_run_after": datetime.now(tz=UTC).isoformat(),
            "p_max_attempts": 5,
        },
    ).execute()

    return VerschiebeAntwort(
        reservation_id=str(zeile["id"]),
        property_id=body.property_id,
        check_in=body.check_in,
        check_out=body.check_out,
    )


def _zieltage_pruefen(
    db: Client,
    ctx: ApiKontext,
    zeile: dict,
    body: VerschiebeAnfrage,
) -> None:
    """409, wenn im Ziel-Zeitraum eine Nacht nicht frei ist.

    Die EIGENEN Nächte zählen nicht als Belegung: eine Verlängerung um einen Tag
    würde sich sonst selbst blockieren. Sie entlasten um genau EINE Einheit —
    mehr belegt eine Buchung nicht — und nur, wenn sie im ZIEL-Objekt liegen.

    Gerechnet wird mit `freie_einheiten_spannen`, derselben Funktion, die
    `GET /v1/availability` ausliefert und die als Schwesterdatei in beiden
    Diensten gleich ist.

    Diese Prüfung ist eine VORPRÜFUNG, damit der häufigste Fehlerfall sofort
    beantwortet wird. Sie ist bewusst nicht die letzte Instanz: ein objektweiter
    Verkaufsstopp liefert 0 freie Einheiten unabhängig von der Belegung, und die
    Entlastung um die eigene Nacht liest sich dann zu optimistisch. Die
    verbindliche Prüfung macht die ausführende Stelle mit Objekt-Sperre; kippt
    sie, bleibt die Buchung unverändert.
    """
    spannen = freie_einheiten_spannen(
        db, ctx.tenant_id, body.property_id, body.check_in, body.check_out
    )
    # Der Abreisetag ist wieder frei und wird deshalb nicht geprüft.
    letzte_nacht = body.check_out - timedelta(days=1)

    eigene: set[str] = set()
    if str(zeile["property_id"]) == body.property_id:
        # Die Nächte, die diese Buchung im Ziel-Objekt heute schon hält —
        # aus der Buchung selbst, nicht aus dem Kalender: die
        # `availability`-Zeilen tragen keine Buchungs-Kennung.
        tag = date.fromisoformat(str(zeile["check_in"]))
        bis = date.fromisoformat(str(zeile["check_out"]))
        while tag < bis:
            eigene.add(tag.isoformat())
            tag += timedelta(days=1)

    for von, bis, frei in spannen:
        tag = max(von, body.check_in)
        ende = min(bis, letzte_nacht)
        while tag <= ende:
            entlastung = 1 if tag.isoformat() in eigene else 0
            if frei + entlastung <= 0:
                raise errors.konflikt(
                    "zeitraum_nicht_verfuegbar",
                    "Im Ziel-Zeitraum ist mindestens eine Nacht nicht frei.",
                    extra={"erste_belegte_nacht": tag.isoformat()},
                )
            tag += timedelta(days=1)


# ---------------------------------------------------------------------------
# Portal-Rohdaten
# ---------------------------------------------------------------------------
@router.get(
    "/{reservation_id}/external",
    response_model=PortalRohdaten,
    summary="Portal-Daten einer Buchung",
    responses={
        404: {
            "description": (
                "Die Buchung gibt es nicht — oder sie kam nicht über ein "
                "Portal. Für eine Direktbuchung gibt es hier nichts zu holen."
            )
        },
    },
)
def portal_rohdaten(
    reservation_id: str,
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("reservations:read"))],
) -> PortalRohdaten:
    """Was das Portal geliefert hat — unverändert, samt Provision und Abgaben.

    Für den Fall, dass ein Feld gebraucht wird, das diese API nicht abbildet.

    **Warnung, die zum Endpunkt gehört:** `details` ist NICHT stabil. Es ist,
    was das Portal schickt, und es ändert sich, wenn das Portal sich ändert.
    Alles, was hier als eigenes Feld steht (`booked_at`, `commission`,
    `payment_collect`), ist dagegen unsere Zusage — darauf lässt sich bauen.

    `booked_at` und `received_at` stehen beide dabei und bedeuten Verschiedenes:
    der eine ist der Zeitpunkt beim Gast, der andere unser Eingang. Bei einem
    Sammel-Abruf tragen Dutzende Buchungen dieselbe `received_at`-Sekunde.
    """
    db = service_db()
    zeile = zeile_im_mandanten(
        db, "reservations", reservation_id, ctx.tenant_id,
        spalten=(
            "id, property_id, channel, ota_name, external_ref, booked_at, "
            "created_at, payment_collect, ota_commission, ota_withheld_taxes, "
            "ota_notes, ota_details, source_channex_booking_id"
        ),
        was="Die Buchung",
    )
    ctx.objekt_pruefen(str(zeile["property_id"]))

    kanal = str(zeile.get("channel") or "direct")
    if kanal in {"direct", "website"} and not zeile.get("source_channex_booking_id"):
        raise errors.nicht_gefunden("Portal-Daten zu dieser Buchung")

    return PortalRohdaten(
        reservation_id=str(zeile["id"]),
        channel=kanal,
        ota_name=zeile.get("ota_name"),
        external_ref=zeile.get("external_ref"),
        booked_at=zeile.get("booked_at"),
        # Unser Eingang — bewusst NICHT als Buchungszeitpunkt ausgegeben.
        received_at=zeile.get("created_at"),
        payment_collect=zeile.get("payment_collect"),
        commission=(
            Decimal(str(zeile["ota_commission"]))
            if zeile.get("ota_commission") is not None
            else None
        ),
        withheld_taxes=(
            Decimal(str(zeile["ota_withheld_taxes"]))
            if zeile.get("ota_withheld_taxes") is not None
            else None
        ),
        notes=zeile.get("ota_notes"),
        details=zeile.get("ota_details"),
    )
