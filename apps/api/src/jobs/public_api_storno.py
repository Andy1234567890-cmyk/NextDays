"""Job-Handler für Aufträge der ÖFFENTLICHEN API: Storno und Verschieben.

Beides sind Ketten mit Gegenzuständen (Nächte freigeben und belegen, Portale
melden, Partei/Grund protokollieren, Gebühren und Karenz rechnen). Sie leben in
`apps/api`; die öffentliche API importiert daraus nichts und stellt deshalb
einen Auftrag. Hier wird er ausgeführt — von derselben Stelle, die auch das
Dashboard benutzt.

Eigenes Modul und nicht im Worker, weil diese Aufträge fachlich nichts mit den
Channex-Sync-Handlern dort zu tun haben — und weil `worker.py` an seiner
Modulgrenze angekommen ist.
"""
from __future__ import annotations

from typing import Any

from supabase import Client


def handle(
    db: Client, payload: dict[str, Any], budget: object | None = None
) -> dict[str, Any] | None:
    """Storno, den die ÖFFENTLICHE API beauftragt hat, hier ausführen.

    Warum über einen Job und nicht in der öffentlichen API selbst: die
    Storno-Kette hängt an `ReservationsService.cancel` — Nächte freigeben,
    Channex-Rückmeldung, Aufgabenregeln, Provision, Dynpricing-Verbrauch,
    Refund, Audit-Zeile. Diese Kette ein zweites Mal zu schreiben hiesse, sie
    zweimal richtig halten zu müssen; der erste vergessene Schritt wäre eine
    freigegebene Nacht ohne Portal-Meldung (Wurzel 1). Die öffentliche API
    importiert nichts aus dieser App — also stellt sie einen Auftrag, und die
    EINE Storno-Stelle arbeitet ihn ab.

    Der Auslöser bleibt bewusst ohne `users`-Zeile (`by_user_id=None`): ein
    API-Zugang ist kein Nutzer, und ein erfundener Auslöser wäre eine
    Falschaussage im Audit (Wurzel 4). Welcher Zugang es war, steht im
    Pflicht-Freitext, den die öffentliche API mitgibt.

    Ein Fehler kippt den Job auf Retry, statt ihn still als erledigt zu
    vermerken (Wurzel 5).
    """
    del budget
    from src.core.security import AuthContext
    from src.features.reservations.schemas import CancelParty, CancelReasonCode
    from src.features.reservations.service import ReservationsService

    tenant_id = str(payload["tenant_id"])
    reservation_id = str(payload["reservation_id"])
    partei = CancelParty(str(payload["partei"]))
    roh_code = payload.get("reason_code")
    reason_code = CancelReasonCode(str(roh_code)) if roh_code else None

    svc = ReservationsService(service_client=db)
    svc.cancel(
        AuthContext(user_id="system", tenant_id=tenant_id, role="admin"),
        reservation_id,
        str(payload["reason"]),
        partei=partei,
        reason_code=reason_code,
        by_user_id=None,
    )
    return {"reservation_id": reservation_id, "partei": str(partei)}


def handle_move(
    db: Client, payload: dict[str, Any], budget: object | None = None
) -> dict[str, Any] | None:
    """Verschieben, das die ÖFFENTLICHE API beauftragt hat, hier ausführen.

    Dieselbe Begründung wie beim Storno: `ReservationsService.move` gibt die
    ALTEN Nächte frei, belegt die neuen, meldet beide Zustände an Channex und
    prüft dabei erneut auf Fremdbelegung. Wer diesen Ablauf in der öffentlichen
    API nachbaut, hat zwei Wege zu freigegebenen Nächten — und der zweite
    vergisst irgendwann den Push (Wurzel 1).

    Die öffentliche API hat die Zieltage VOR dem Auftrag geprüft und einen
    belegten Zeitraum sofort mit 409 abgelehnt. Diese Prüfung hier ist die
    autoritative: zwischen Vorprüfung und Ausführung kann eine Buchung
    entstehen, und dann kippt der Job — richtig so, statt zwei Gäste in einem
    Zimmer.

    `reprice` entscheidet über den Preis: ohne Angabe bleibt er unverändert
    (der vereinbarte Preis ist bindend), mit `true` rechnet der Resolver neu.
    """
    del budget
    from src.core.security import AuthContext
    from src.features.reservations.schemas import ReservationMove
    from src.features.reservations.service import ReservationsService

    tenant_id = str(payload["tenant_id"])
    reservation_id = str(payload["reservation_id"])

    svc = ReservationsService(service_client=db)
    svc.move(
        AuthContext(user_id="system", tenant_id=tenant_id, role="admin"),
        reservation_id,
        ReservationMove(
            property_id=str(payload["property_id"]),
            check_in=payload["check_in"],
            check_out=payload["check_out"],
            reprice=payload.get("reprice"),
        ),
    )
    return {"reservation_id": reservation_id, "property_id": payload["property_id"]}
