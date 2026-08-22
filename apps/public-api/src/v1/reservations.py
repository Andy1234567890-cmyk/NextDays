"""Buchungen lesen und anlegen.

**Anlegen läuft über die Datenbankfunktion `create_reservation_atomic`.** Das ist
kein Umweg, sondern der Grund, warum diese API überhaupt buchen darf: die
Funktion setzt in EINER Transaktion die Buchung, belegt die Nächte je Einheit,
prüft Stop-Sell und reiht den Verfügbarkeits-Push ein. Sie nimmt dafür eine
Objekt-Sperre (`pg_advisory_xact_lock`). Zwei gleichzeitige Anfragen für die
letzte freie Einheit ergeben damit eine Buchung und einen 409 — nicht zwei
Buchungen.

Diese API baut das NICHT nach. Ein zweiter Buchungspfad wäre eine zweite
Wahrheit über Überbuchung, und der Fehler zeigt sich erst, wenn zwei Gäste vor
derselben Tür stehen.

**Was v1 nicht kann: ändern und stornieren.** Beides ist bewusst nicht dabei.
Eine Stornierung zieht mehr nach sich als ein Statusfeld: die Nächte müssen
freigegeben, die Portale informiert, die stornierende Partei und ihr Grund
festgehalten, Stornogebühren und die Auszahlungs-Karenz gerechnet werden. Diese
Kette hat in der Haupt-API sechs Aufrufer und lebt dort. Sie hier zweitens zu
implementieren, hieße, sie zweimal richtig halten zu müssen — der klassische
Weg zu freigegebenen Nächten ohne Portal-Meldung. Die Dokumentation nennt das
unter „Grenzen von v1" offen, statt einen halben Weg anzubieten.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, Query, Response
from supabase import Client

from ..core import errors, idempotency
from ..core.auth import ApiKontext, scope_erforderlich
from ..core.db import Abfrage, service_db, zeile_im_mandanten
from ..core.pagination import blaettern_pruefen, keyset_anwenden, seite_bauen
from .schemas import (
    Betrag,
    Buchung,
    BuchungAnlegen,
    Gast,
    Seite,
)

router = APIRouter(prefix="/reservations", tags=["Buchungen"])

_SPALTEN = (
    "id, property_id, unit_id, rate_plan_id, guest_id, status, channel, ota_name, "
    "check_in, check_out, total_amount, paid_amount, currency, payment_status, "
    "adults, children, infants, pets, booked_at, created_at, updated_at, "
    "cancelled_at, cancelled_by_party, external_ref, note, guest_email, "
    "guest_phone, guest_language, guest_country"
)

# PostgREST-Fehlercodes, die die Buchungsfunktion als KONTROLL-SIGNAL wirft.
# Sie werden gezielt in einen sprechenden 409/422 übersetzt und nicht von einem
# breiten except zu einem 500 verschluckt (Wurzel 5).
_RS_KONFLIKT = "RS409"       # Zeitraum belegt, gesperrt oder Stop-Sell
_UNGUELTIG = "22023"          # fachlich unmöglich (fehlende Einheit, verdrehte Daten)


def _buchung_aus_zeile(zeile: dict, gast: dict | None) -> Buchung:
    """DB-Zeile → öffentliches Schema.

    Die beiden Zeitangaben sind bewusst getrennt und werden NIE vermischt:

      `booked_at`   — wann der Gast gebucht hat. Kommt aus der Quelle des
                      Portals und ist `null`, wenn das Portal ihn nicht liefert.
      `received_at` — wann die Buchung bei uns eingegangen ist. Unsere Uhr.

    Warum das wichtig ist: am 06.08.2026 zeigte unser Posteingang 22
    Airbnb-Buchungen als „heute 10:48" — gebucht waren sie am 23.03., 01.06. und
    26.07. Alle 22 trugen dieselbe Sekunde, weil der Feed sie in einem Rutsch
    geholt hatte. Eine Sortierung „neueste zuerst" über `created_at` war damit
    wertlos, und die Anzeige war eine Falschaussage, die niemand als Fehler
    erkannt hätte. Deshalb gibt es hier keinen Rückfall von `booked_at` auf
    `received_at` (Wurzel 5b).
    """
    waehrung = (zeile.get("currency") or "").strip()
    if not waehrung:
        raise errors.ApiFehler(
            status=422,
            code="waehrung_fehlt",
            detail=(
                f"Der Buchung {zeile['id']} ist keine Währung zugeordnet. "
                "Ohne Währung sind ihre Beträge nicht auslieferbar."
            ),
            titel="Währung fehlt",
            extra={"reservation_id": str(zeile["id"])},
        )
    check_in = date.fromisoformat(str(zeile["check_in"])[:10])
    check_out = date.fromisoformat(str(zeile["check_out"])[:10])
    g = gast or {}
    return Buchung(
        id=str(zeile["id"]),
        property_id=str(zeile["property_id"]),
        unit_id=str(zeile["unit_id"]) if zeile.get("unit_id") else None,
        rate_plan_id=str(zeile["rate_plan_id"]) if zeile.get("rate_plan_id") else None,
        status=zeile.get("status") or "pending",
        channel=zeile.get("channel") or "direct",
        ota_name=zeile.get("ota_name"),
        check_in=check_in,
        check_out=check_out,
        nights=(check_out - check_in).days,
        guests={
            "adults": int(zeile.get("adults") or 0),
            "children": int(zeile.get("children") or 0),
            "infants": int(zeile.get("infants") or 0),
            "pets": int(zeile.get("pets") or 0),
        },
        total=Betrag(amount=Decimal(str(zeile.get("total_amount") or 0)), currency=waehrung),
        paid=Betrag(amount=Decimal(str(zeile.get("paid_amount") or 0)), currency=waehrung),
        payment_status=zeile.get("payment_status"),
        booked_at=zeile.get("booked_at"),
        received_at=zeile["created_at"],
        updated_at=zeile["updated_at"],
        cancelled_at=zeile.get("cancelled_at"),
        cancelled_by_party=zeile.get("cancelled_by_party"),
        guest=Gast(
            id=str(zeile["guest_id"]) if zeile.get("guest_id") else None,
            first_name=g.get("first_name"),
            last_name=g.get("last_name"),
            name=g.get("name"),
            # Die Kontaktdaten der Buchung gewinnen: bei einer Portal-Buchung
            # steht dort die anonymisierte Adresse des Portals, und die ist die
            # Adresse, über die kommuniziert werden MUSS. Der Stammsatz kann eine
            # ältere, private Adresse tragen.
            email=zeile.get("guest_email") or g.get("email"),
            phone=zeile.get("guest_phone") or g.get("phone"),
            language=zeile.get("guest_language") or g.get("language"),
            country=zeile.get("guest_country") or g.get("nationality"),
        ),
        external_ref=zeile.get("external_ref"),
        note=zeile.get("note"),
    )


def _gaeste_zu(db: Client, tenant_id: str, zeilen: list[dict]) -> dict[str, dict]:
    """Gast-Stammsätze zu einer Buchungsliste — in EINER Abfrage (kein N+1)."""
    ids = [str(z["guest_id"]) for z in zeilen if z.get("guest_id")]
    if not ids:
        return {}
    gaeste = (
        db.table("guests")
        .select("id, name, first_name, last_name, email, phone, language, nationality")
        .eq("tenant_id", tenant_id)
        .in_("id", list(set(ids)))
        .execute()
    ).data or []
    return {str(g["id"]): g for g in gaeste}


@router.get(
    "",
    response_model=Seite[Buchung],
    response_model_exclude_unset=True,
    summary="Buchungen auflisten",
)
def liste(
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("reservations:read"))],
    property_id: Annotated[str | None, Query(description="Nur Buchungen dieses Objekts.")] = None,
    status: Annotated[
        str | None,
        Query(
            description=(
                "Status-Filter: pending | confirmed | cancelled | completed | "
                "requested | declined | expired. Mehrere durch Komma getrennt."
            )
        ),
    ] = None,
    channel: Annotated[str | None, Query(description="Kanal-Filter.")] = None,
    check_in_from: Annotated[date | None, Query(description="Anreise ab (einschließlich).")] = None,
    check_in_to: Annotated[date | None, Query(description="Anreise bis (einschließlich).")] = None,
    updated_since: Annotated[
        str | None,
        Query(
            description=(
                "Nur Buchungen, die seit diesem Zeitpunkt geändert wurden "
                "(ISO 8601). Der sparsame Weg für einen laufenden Abgleich."
            )
        ),
    ] = None,
    limit: Annotated[int | None, Query(ge=1, le=200)] = None,
    offset: Annotated[int | None, Query(ge=0)] = None,
    starting_after: Annotated[
        str | None,
        Query(
            description=(
                "ID des letzten Elements der Vorseite — der empfohlene Weg zum "
                "Blättern. Stabil, auch wenn sich die Liste zwischen zwei "
                "Seiten ändert. Schließt `offset` aus. Den Wert liefert "
                "`pagination.next_starting_after` der Vorseite.\n\n"
                "**Die übrigen Filter musst du beim Weiterblättern unverändert "
                "mitschicken.** Änderst du sie, beschreibt der Cursor eine "
                "Stelle in einer anderen Liste, und das Ergebnis ist nicht "
                "vorhersagbar. `limit` darf sich ändern.\n\n"
                "Der Cursor läuft nicht ab. Er wird ungültig, wenn der "
                "Datensatz gelöscht wird — dann kommt ein 422, und du beginnst "
                "den Durchgang ohne `starting_after` neu."
            )
        ),
    ] = None,
    include_total: Annotated[bool, Query()] = False,
) -> dict[str, Any]:
    """Buchungen des Betriebs, gefiltert.

    Sortiert nach Anreise, dann ID — eine stabile Ordnung, damit Blättern keine
    Zeilen doppelt oder gar nicht liefert.

    Zum Sortieren „neueste zuerst" nimm `booked_at` auf deiner Seite und
    behandle `null` als unbekannt. NICHT `received_at` dafür verwenden: das ist
    unser Eingang, und bei einem Sammel-Import tragen Dutzende Buchungen
    dieselbe Sekunde.
    """
    db = service_db()
    blatt = blaettern_pruefen(limit, offset, include_total, starting_after)

    if property_id:
        ctx.objekt_pruefen(property_id)

    def basis() -> Abfrage:
        q = db.table("reservations").select(_SPALTEN).eq("tenant_id", ctx.tenant_id)
        if property_id:
            q = q.eq("property_id", property_id)
        elif ctx.property_ids:
            # Die Liste MUSS dieselbe Beschränkung anwenden wie der Detailpfad
            # — sonst zeigt sie Buchungen von Objekten, die das Detail
            # verweigert (Wurzel 9).
            q = q.in_("property_id", ctx.property_ids)
        if status:
            werte = [s.strip() for s in status.split(",") if s.strip()]
            q = q.in_("status", werte)
        if channel:
            q = q.eq("channel", channel)
        if check_in_from:
            q = q.gte("check_in", check_in_from.isoformat())
        if check_in_to:
            q = q.lte("check_in", check_in_to.isoformat())
        if updated_since:
            q = q.gte("updated_at", updated_since)
        return q.is_("archived_at", "null")

    # Absteigend nach Anreise, dann nach ID — beides zusammen ist eindeutig.
    # Der Cursor rechnet mit derselben Richtung (`aufsteigend=False`); eine
    # Abweichung zwischen `order` und Filter läge nicht als Fehler, sondern als
    # fehlende Zeile in der Antwort des Kunden.
    zeilen = (
        keyset_anwenden(
            basis().order("check_in", desc=True).order("id", desc=True),
            db,
            "reservations",
            blatt,
            tenant_id=ctx.tenant_id,
            sortier_spalte="check_in",
            aufsteigend=False,
        )
        .range(blatt.range_von, blatt.range_bis)
        .execute()
    ).data or []

    total = None
    if include_total:
        total = (basis().select("id", count="exact").limit(1).execute()).count

    gaeste = _gaeste_zu(db, ctx.tenant_id, zeilen)
    buchungen = [
        _buchung_aus_zeile(z, gaeste.get(str(z.get("guest_id")))) for z in zeilen
    ]
    return seite_bauen(
        [b.model_dump(mode="json") for b in buchungen], blatt, total=total
    )


@router.get("/{reservation_id}", response_model=Buchung, summary="Eine Buchung lesen")
def detail(
    reservation_id: str,
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("reservations:read"))],
) -> Buchung:
    """Eine Buchung samt Gastdaten und Beträgen."""
    db = service_db()
    zeile = zeile_im_mandanten(
        db, "reservations", reservation_id, ctx.tenant_id,
        spalten=_SPALTEN, was="Die Buchung",
    )
    # Objekt-Beschränkung auch hier: ein Zugang für Objekt A darf keine Buchung
    # von Objekt B lesen, nur weil er ihre ID kennt (Wurzel 9).
    ctx.objekt_pruefen(str(zeile["property_id"]))
    gaeste = _gaeste_zu(db, ctx.tenant_id, [zeile])
    return _buchung_aus_zeile(zeile, gaeste.get(str(zeile.get("guest_id"))))


@router.post(
    "",
    response_model=Buchung,
    status_code=201,
    summary="Buchung anlegen",
    responses={
        409: {
            "description": (
                "Der Zeitraum ist inzwischen belegt, gesperrt oder vom Verkauf "
                "ausgenommen. Es ist KEINE halbe Buchung entstanden."
            )
        },
        422: {"description": "Währung passt nicht zum Objekt, oder Daten sind unmöglich."},
    },
)
def anlegen(
    body: BuchungAnlegen,
    response: Response,
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("reservations:write"))],
    idempotency_key: Annotated[
        str | None,
        Header(
            alias="Idempotency-Key",
            description=(
                "Pflicht. Ein eindeutiger Wert je Vorgang (z. B. eine UUID). "
                "Wiederhole ihn bei einem erneuten Versuch — die erste Antwort "
                "wird dann wortgleich zurückgegeben, statt eine zweite Buchung "
                "zu erzeugen."
            ),
        ),
    ] = None,
) -> dict[str, Any]:
    """Eine Buchung anlegen und die Nächte im selben Schritt belegen.

    Der Ablauf ist atomar: entweder es entstehen Buchung UND Kalenderbelegung,
    oder nichts. Ist die letzte Einheit inzwischen weg, kommt ein 409.

    Ohne `unit_id` wählt das System die erste freie Einheit. Bei einem Objekt mit
    einer Einheit ist das immer diese eine.

    `total_amount` ist der Gesamtpreis des Aufenthalts, wie DU ihn berechnet
    hast. Diese API rechnet ihn nicht nach — sie kennt die
    Aufenthaltspreis-Berechnung in v1 nicht (siehe „Grenzen von v1"). Die
    Währung muss zur Währung des Objekts passen, sonst 422.

    Schlägt der Aufruf fehl, ohne dass eine Buchung entstanden ist (409, 422),
    ist dein `Idempotency-Key` danach wieder frei: du kannst denselben Vorgang
    mit demselben Schlüssel erneut versuchen, sobald der Zeitraum wieder frei
    ist. Nur bei einem Serverfehler bleibt er belegt — dann ist unklar, ob die
    Buchung doch entstanden ist, und du siehst zuerst über
    `GET /v1/reservations` nach.
    """
    schluessel = idempotency.schluessel_pruefen(idempotency_key, pflicht=True)
    db = service_db()

    ctx.objekt_pruefen(body.property_id)
    objekt = zeile_im_mandanten(
        db, "properties", body.property_id, ctx.tenant_id,
        spalten="id, currency, max_guests, status", was="Das Objekt",
    )
    _pruefen(body, objekt)

    nutzlast = body.model_dump(mode="json", exclude_none=True)
    vorhanden = idempotency.beanspruchen(
        db,
        tenant_id=ctx.tenant_id,
        client_pk=ctx.client_pk,
        key=schluessel or "",
        pfad="/v1/reservations",
        koerper=nutzlast,
    )
    if vorhanden is not None:
        # Wiederholung: wortgleiche Antwort. Der Header sagt dem Client, dass er
        # eine Kopie sieht — ohne ihn hielte er die Buchung für neu und zählte
        # sie doppelt in seiner eigenen Statistik.
        response.status_code = vorhanden["status"]
        response.headers["Idempotency-Replayed"] = "true"
        return vorhanden["body"]

    try:
        zeile = _buchen(db, ctx, body)
    except errors.ApiFehler as exc:
        # Der Anspruch wird freigegeben, WEIL nichts entstanden ist — sonst
        # bekäme der Client mit demselben Schlüssel für immer 409 „läuft noch",
        # obwohl er es genau so wiederholen soll (Zeitraum belegt ist der
        # häufigste Fall, und Nächte werden wieder frei).
        #
        # Ausgenommen sind Fehler mit unklarem Ausgang (>= 500): dort KANN die
        # Buchung doch entstanden sein, und eine Wiederholung wäre eine zweite.
        # Der Schlüssel bleibt dann belegt (fail-closed).
        if exc.status < 500:
            idempotency.freigeben(
                db, tenant_id=ctx.tenant_id, client_pk=ctx.client_pk,
                key=schluessel or "",
            )
        raise
    gaeste = _gaeste_zu(db, ctx.tenant_id, [zeile])
    buchung = _buchung_aus_zeile(zeile, gaeste.get(str(zeile.get("guest_id"))))
    koerper = buchung.model_dump(mode="json")
    idempotency.antwort_festhalten(
        db,
        tenant_id=ctx.tenant_id,
        client_pk=ctx.client_pk,
        key=schluessel or "",
        status=201,
        body=koerper,
    )
    return koerper


def _pruefen(body: BuchungAnlegen, objekt: dict) -> None:
    """Fachliche Vorprüfungen mit sprechenden Fehlern.

    Diese Prüfungen ersetzen NICHT die der Datenbankfunktion — die hat das
    letzte Wort und kennt keine Rennen. Sie liefern nur die bessere
    Fehlermeldung, wenn schon vorher klar ist, dass es nicht geht.
    """
    if body.check_out <= body.check_in:
        raise errors.ungueltige_anfrage("check_out muss nach check_in liegen.")

    objekt_waehrung = (objekt.get("currency") or "").strip().upper()
    if not objekt_waehrung:
        raise errors.ApiFehler(
            status=422,
            code="waehrung_fehlt",
            detail=(
                "Dem Objekt ist keine Währung zugeordnet. Bitte im Dashboard "
                "nachtragen — eine Buchung ohne Währung wäre nicht abrechenbar."
            ),
            titel="Währung fehlt",
        )
    if body.currency.upper() != objekt_waehrung:
        # Kein stilles Umrechnen und kein stilles Übernehmen: eine Buchung in
        # der falschen Währung ist ein Betrag, der um den Faktor 7 falsch sein
        # kann (DKK/EUR).
        raise errors.ungueltige_anfrage(
            f"Die Währung {body.currency.upper()} passt nicht zur Währung des "
            f"Objekts ({objekt_waehrung}).",
            extra={"property_currency": objekt_waehrung, "sent": body.currency.upper()},
        )

    if objekt.get("status") != "active":
        raise errors.ungueltige_anfrage(
            "Das Objekt ist nicht verkäuflich (Status ist nicht 'active').",
            extra={"status": objekt.get("status")},
        )

    personen = body.adults + body.children
    max_gaeste = int(objekt.get("max_guests") or 1)
    if personen > max_gaeste:
        # Säuglinge zählen bewusst nicht mit: so führen es Airbnb und
        # Booking.com, und eine abweichende Zählung würde Buchungen ablehnen,
        # die über die Portale hereinkommen.
        raise errors.ungueltige_anfrage(
            f"{personen} Gäste übersteigen die Belegungsgrenze des Objekts "
            f"({max_gaeste}). Säuglinge zählen nicht mit.",
            extra={"max_guests": max_gaeste},
        )


def _gast_finden_oder_anlegen(
    db: Client, tenant_id: str, gast: Gast | None
) -> str | None:
    """Gast-Stammsatz beschaffen.

    Wiedererkennung über die E-Mail-Adresse innerhalb des Betriebs: sonst
    entstünde bei jedem Aufruf ein neuer Stammsatz und die Gästehistorie („dritter
    Aufenthalt") wäre wertlos. Ohne E-Mail wird angelegt, ohne Namen gar nichts.
    """
    if gast is None:
        return None
    if gast.id:
        # Vorgegebene ID muss dem Betrieb gehören — eine geratene UUID würde
        # sonst eine fremde Gastakte an diese Buchung hängen (Wurzel 3).
        zeile_im_mandanten(
            db, "guests", gast.id, tenant_id, spalten="id", was="Der Gast"
        )
        return gast.id

    name = gast.name or " ".join(
        t for t in [gast.first_name, gast.last_name] if t
    ).strip()
    if not name and not gast.email:
        return None

    if gast.email:
        treffer = (
            db.table("guests")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("email", gast.email)
            .limit(1)
            .execute()
        ).data
        if treffer:
            return str(treffer[0]["id"])

    neu = (
        db.table("guests")
        .insert(
            {
                "tenant_id": tenant_id,
                "name": name or gast.email,
                "first_name": gast.first_name,
                "last_name": gast.last_name,
                "email": gast.email,
                "phone": gast.phone,
                "language": gast.language,
                "nationality": gast.country,
                "source": "api",
            }
        )
        .execute()
    ).data
    return str(neu[0]["id"]) if neu else None


def _buchen(db: Client, ctx: ApiKontext, body: BuchungAnlegen) -> dict:
    """Buchung über `create_reservation_atomic` anlegen.

    Die Funktion belegt die Nächte je Einheit, prüft Stop-Sell, hält eine
    Objekt-Sperre und reiht den Verfügbarkeits-Push ein — alles in einer
    Transaktion. Ihre Fehlercodes werden hier gezielt übersetzt; ein breites
    `except`, das daraus einen 500 macht, würde dem Client den Grund nehmen
    (Wurzel 5).
    """
    gast_id = _gast_finden_oder_anlegen(db, ctx.tenant_id, body.guest)

    reservierung: dict[str, Any] = {
        "tenant_id": ctx.tenant_id,
        "property_id": body.property_id,
        "check_in": body.check_in.isoformat(),
        "check_out": body.check_out.isoformat(),
        "status": body.status,
        "channel": body.channel,
        "total_amount": str(body.total_amount),
        "currency": body.currency.upper(),
        "adults": body.adults,
        "children": body.children,
        "infants": body.infants,
        "pets": body.pets,
        "num_guests": body.adults + body.children,
    }
    if gast_id:
        reservierung["guest_id"] = gast_id
    if body.unit_id:
        reservierung["unit_id"] = body.unit_id
    if body.rate_plan_id:
        reservierung["rate_plan_id"] = body.rate_plan_id
    if body.note:
        reservierung["note"] = body.note
    if body.external_ref:
        reservierung["external_ref"] = body.external_ref
    # NUR wenn mitgeschickt. Ohne Angabe bleibt das Feld leer — es wird nicht
    # mit der aktuellen Zeit gefüllt: unsere Uhr ist nicht der Zeitpunkt einer
    # fremden Handlung (Wurzel 5b).
    if body.booked_at:
        reservierung["booked_at"] = body.booked_at.isoformat()
    if body.guest:
        for feld, wert in (
            ("guest_email", body.guest.email),
            ("guest_phone", body.guest.phone),
            ("guest_language", body.guest.language),
            ("guest_country", body.guest.country),
        ):
            if wert:
                reservierung[feld] = wert

    try:
        ergebnis = db.rpc(
            "create_reservation_atomic",
            {
                "p_reservation": reservierung,
                # Herkunft der Kalenderbelegung. `direct` bei einer Buchung, die
                # der Betrieb selbst einträgt; beim Import aus einem Fremdsystem
                # `ota_other`, damit im Kalender erkennbar bleibt, dass die Nacht
                # nicht aus einer Direktbuchung stammt.
                "p_source": "ota_other" if body.channel == "ota_other" else "direct",
                "p_with_outbox": True,
            },
        ).execute()
    except Exception as exc:  # noqa: BLE001 — Fehlercodes gezielt übersetzt, s. u.
        text = str(exc)
        if _RS_KONFLIKT in text:
            raise errors.konflikt(
                "zeitraum_nicht_verfuegbar",
                "Der Zeitraum ist belegt, gesperrt oder vom Verkauf ausgenommen. "
                "Es wurde keine Buchung angelegt.",
                extra={
                    "check_in": body.check_in.isoformat(),
                    "check_out": body.check_out.isoformat(),
                },
            ) from exc
        if _UNGUELTIG in text:
            raise errors.ungueltige_anfrage(
                "Die Buchung ist so nicht möglich. Häufigste Ursache: das Objekt "
                "hat keine Einheit, oder die angegebene Einheit gehört nicht dazu."
            ) from exc
        raise

    daten = ergebnis.data or {}
    zeile = (daten or {}).get("reservation")
    if not zeile:
        # Kein stiller Erfolg: ohne Zeile wissen wir nicht, was passiert ist,
        # und dürfen dem Client keine Buchung bestätigen (fail-closed).
        raise errors.ApiFehler(
            status=500,
            code="buchung_unklar",
            detail=(
                "Die Buchung konnte nicht bestätigt werden. Prüfe über "
                "GET /v1/reservations, ob sie entstanden ist, bevor du es "
                "erneut versuchst."
            ),
            titel="Buchung unklar",
        )
    return zeile
