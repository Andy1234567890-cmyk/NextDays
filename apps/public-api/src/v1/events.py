"""Ereignisse abrufen — der Nachhol-Weg, wenn Zustellungen ausgefallen sind.

Ein Push allein ist keine Zustellgarantie. Fällt der Server eines Partners zwei
Stunden aus, laufen die Wiederholversuche irgendwann aus, und ihm fehlen still
die Buchungen dieser zwei Stunden — er weiß nicht einmal, WELCHE. Das ist der
schlimmste Zustand einer Integration: sie sieht funktionierend aus.

Booking.com löst das seit Jahren so, dass die Ereignisse als Warteschlange je
Provider LIEGEN und abgeholt werden (mit Quittung, und ohne Quittung geht nach
30 Minuten eine Fallback-Mail ans Haus). Hier steht dieselbe Idee in kleinerer
Form: die Ereignisse sind Zeilen in `public_api_events`, und dieser Endpunkt
gibt sie heraus. Ein Partner, der wieder online ist, holt mit `since` alles
nach, was er verpasst hat.

Warum das KEIN zweites Zustellsystem ist: es gibt genau eine Quelle
(`public_api_events`, gefüllt von DB-Triggern). Der Zusteller pusht daraus, und
dieser Endpunkt liest daraus. Zwei Wege zum selben Datensatz sind kein
Widerspruch — zwei Datensätze wären einer.

Abgrenzung zum Kalender- und Buchungs-Abruf: `updated_since` auf
`/v1/reservations` sagt, WAS jetzt anders ist. Dieser Endpunkt sagt, WAS
passiert ist — auch, wenn es zweimal geändert wurde oder inzwischen storniert
ist. Für einen Abgleich reicht `updated_since`; für ein Protokoll oder eine
Reaktion auf jede Einzeländerung braucht es die Ereignisse.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query

from ..core import errors
from ..core.auth import ApiKontext, scope_erforderlich
from ..core.db import service_db
from ..core.pagination import blaettern_pruefen, keyset_anwenden, seite_bauen
from .schemas import EREIGNISSE, Ereignis, Seite

router = APIRouter(prefix="/events", tags=["Webhooks"])

# Wie weit zurück abgefragt werden darf. Die Tabelle ist eine Warteschlange,
# kein Archiv — ein Partner, der 90 Tage nachholen will, hat kein
# Zustellproblem, sondern eine kaputte Integration, und sollte über
# `updated_since` neu abgleichen statt jedes Einzelereignis nachzuspielen.
_MAX_RUECKBLICK_TAGE = 30


@router.get(
    "",
    response_model=Seite[Ereignis],
    response_model_exclude_unset=True,
    summary="Ereignisse abrufen",
)
def liste(
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("webhooks:read"))],
    since: Annotated[
        datetime | None,
        Query(
            description=(
                "Nur Ereignisse ab diesem Zeitpunkt (ISO 8601, UTC). Ohne "
                "Angabe: die letzten 24 Stunden. Höchstens 30 Tage zurück."
            )
        ),
    ] = None,
    event: Annotated[
        str | None,
        Query(
            description=(
                "Auf einen Ereignistyp einschränken, z. B. `reservation.created`. "
                "Mehrere durch Komma."
            )
        ),
    ] = None,
    property_id: Annotated[
        str | None, Query(description="Nur Ereignisse dieses Objekts.")
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
) -> dict[str, Any]:
    """Die Ereignisse deines Betriebs, älteste zuerst.

    **Älteste zuerst ist Absicht.** Wer nachholt, will die Ereignisse in der
    Reihenfolge verarbeiten, in der sie entstanden sind — sonst überschreibt
    eine ältere Änderung eine neuere. Für die Push-Zustellung gilt die
    Reihenfolge NICHT als garantiert; hier schon, weil du selbst blätterst.

    Jedes Ereignis trägt dieselbe `id` wie die zugestellte Fassung. Damit
    erkennst du, was du schon verarbeitet hast, und kannst Push und Abruf
    mischen, ohne etwas doppelt zu tun.
    """
    db = service_db()
    blatt = blaettern_pruefen(limit, offset, False, starting_after)

    jetzt = datetime.now(UTC)
    ab = since or (jetzt - timedelta(hours=24))
    if ab.tzinfo is None:
        # Ein Zeitstempel ohne Zone ist nicht eindeutig. Statt UTC zu
        # unterstellen (ein stiller Ersatzwert, der Ereignisse verschluckt oder
        # doppelt liefert) wird er abgelehnt.
        raise errors.ungueltige_anfrage(
            "`since` braucht eine Zeitzone, z. B. 2026-08-21T09:00:00Z."
        )
    if ab < jetzt - timedelta(days=_MAX_RUECKBLICK_TAGE):
        raise errors.ungueltige_anfrage(
            f"`since` liegt weiter als {_MAX_RUECKBLICK_TAGE} Tage zurück. "
            "Für einen so großen Rückstand ist ein Abgleich über "
            "`updated_since` der richtige Weg, nicht das Nachspielen jedes "
            "Einzelereignisses.",
            extra={"max_rueckblick_tage": _MAX_RUECKBLICK_TAGE},
        )

    if property_id:
        ctx.objekt_pruefen(property_id)

    q = (
        db.table("public_api_events")
        .select("id, event, property_id, payload, created_at")
        .eq("tenant_id", ctx.tenant_id)
        .gte("created_at", ab.isoformat())
    )
    if event:
        typen = [e.strip() for e in event.split(",") if e.strip()]
        unbekannt = sorted({e for e in typen if e not in EREIGNISSE})
        if unbekannt:
            raise errors.ungueltige_anfrage(
                "Unbekannte Ereignistypen: " + ", ".join(unbekannt)
                + ". Der Katalog steht unter GET /v1/webhooks/events.",
                extra={"unbekannt": unbekannt},
            )
        q = q.in_("event", typen)
    if property_id:
        q = q.eq("property_id", property_id)
    elif ctx.property_ids:
        # Ein auf Objekte beschränkter Zugang sieht nur deren Ereignisse. Die
        # Beschränkung MUSS hier greifen wie überall — ein Ereignis trägt
        # Buchungsdaten (Wurzel 9).
        #
        # Ereignisse OHNE Objektbezug fallen damit weg. Das ist dieselbe Regel,
        # die der Fanout in der Datenbank anwendet: ein beschränkter Empfänger
        # kann bei einem Ereignis ohne Objekt nicht entscheiden, ob es ihn
        # betrifft.
        q = q.in_("property_id", ctx.property_ids)

    # Älteste zuerst, deshalb aufsteigend — und der Cursor rechnet mit derselben
    # Richtung. `created_at` ist NOT NULL, der NULL-Zweig kann hier nicht greifen.
    zeilen = (
        keyset_anwenden(
            q.order("created_at").order("id"),
            db,
            "public_api_events",
            blatt,
            tenant_id=ctx.tenant_id,
            sortier_spalte="created_at",
            aufsteigend=True,
        )
        .range(blatt.range_von, blatt.range_bis)
        .execute()
    ).data or []

    daten = [
        {
            "id": str(z["id"]),
            "event": z["event"],
            "created_at": z["created_at"],
            "property_id": str(z["property_id"]) if z.get("property_id") else None,
            "data": z.get("payload") or {},
        }
        for z in zeilen
    ]
    return seite_bauen(daten, blatt)
