"""Eigennutzungen eines Eigentümers auflösen, bevor er gelöscht wird.

WARUM ES DIESEN WEG BRAUCHT: `reservations.owner_id` ist ON DELETE SET NULL.
Wird ein Eigentümer gelöscht, setzt Postgres die Spalte in seinen
Reservierungen auf NULL — bei einer Eigennutzung OHNE eigene Gast-Person
(`is_owner_stay` und `guest_id IS NULL`) bleibt damit eine Zeile ohne jeden
Personenbezug zurück und verletzt den Check `reservations_owner_stay_person`
(`NOT is_owner_stay OR owner_id IS NOT NULL OR guest_id IS NOT NULL`). Die DB
quittiert das mitten im Cascade mit einem Fehler; die Löschung schlug live als
500 fehl.

WARUM EIGENES MODUL: Das Auflösen ist ein abgeschlossenes Thema mit einer
Fremd-Slice-Abhängigkeit (reservations). Im Service läge es zwischen dem
CRUD-Code, dessen Modul ohnehin an der Zeilengrenze steht.
"""
from __future__ import annotations

from postgrest.base_request_builder import BaseFilterRequestBuilder
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

log = get_logger("nextdays.owners.eigennutzungen")

# Grund für den Storno — geht in die append-only Storno-Historie und ist die
# belegbare Tatsache, warum storniert wurde (kein erfundener Ersatztext,
# Wurzel 4).
_STORNO_GRUND = "Eigentümer wurde gelöscht"


def _filtern[Q: BaseFilterRequestBuilder](
    query: Q, tenant_id: str, owner_id: str
) -> Q:
    """Der EINE Filter für „Eigennutzung ohne eigene Gast-Person".

    Lesen und Löschen müssen exakt dieselbe Menge treffen: Was die Rückfrage
    zählt, muss anschließend auch verschwinden — sonst bleibt eine Zeile
    stehen, die den Check-Constraint weiter bricht. Zeilen MIT `guest_id`
    überstehen SET NULL unbeschadet und bleiben deshalb außen vor.

    Nimmt die bereits gewählte Operation entgegen (`select()`/`delete()`),
    weil postgrest die Filter erst danach anhängt. `select()` und `delete()`
    liefern verschiedene Builder-Klassen; gemeinsam ist ihnen die Basis
    `BaseFilterRequestBuilder` — daher der TypeVar statt eines konkreten Typs.
    """
    return (
        query.eq("tenant_id", tenant_id)
        .eq("owner_id", owner_id)
        .eq("is_owner_stay", True)
        .is_("guest_id", "null")
    )


def eigennutzungen_laden(
    db: Client, tenant_id: str, owner_id: str
) -> list[dict]:
    """Die Zeilen, die dem Löschen des Eigentümers im Weg stehen.

    Auch STORNIERTE zählen mit: der Storno lässt `is_owner_stay` und
    `owner_id` stehen, der Check bricht bei ihnen genauso.
    """
    return (
        _filtern(
            db.table("reservations").select(
                "id, status, check_in, check_out, property_id"
            ),
            tenant_id,
            owner_id,
        ).execute()
    ).data or []


def eigennutzungen_entfernen(
    db: Client,
    ctx: AuthContext,
    tenant_id: str,
    owner_id: str,
    stays: list[dict],
    *,
    fehler: type[Exception],
) -> None:
    """Eigennutzungen auflösen — erst stornieren, dann löschen.

    ZWEI SCHRITTE, beide nötig:
    1. Jede noch aktive Zeile über `ReservationsService.cancel` — nur dort
       werden die Kalendernächte freigegeben und an die Portale
       zurückgemeldet (Wurzel 1). Ein direktes DELETE ließe die Nächte belegt
       zurück und machte das Objekt für den Zeitraum unverkäuflich.
    2. Danach ALLE Zeilen löschen, auch die zuvor schon stornierten — bei
       ihnen stehen `is_owner_stay`/`owner_id` weiterhin, das nachfolgende
       ON DELETE SET NULL würde den Check erneut verletzen.

    `fehler` ist die Fehlerklasse des aufrufenden Slice (OwnerError) — so
    bleibt der Import einseitig (owners → reservations) und dieses Modul
    unabhängig vom Service, der es benutzt.
    """
    from src.features.reservations.service import (  # noqa: PLC0415
        ReservationError,
        ReservationsService,
    )

    reservations = ReservationsService(service_client=db)
    for stay in stays:
        if stay.get("status") == "cancelled":
            continue
        try:
            reservations.cancel(ctx, str(stay["id"]), _STORNO_GRUND)
        except ReservationError as exc:
            # Der Storno ist die Voraussetzung für die Nächte-Freigabe.
            # Scheitert er (z. B. Aufenthalt bereits ausgecheckt), darf der
            # Eigentümer NICHT gelöscht werden — sonst verlöre der Kalender
            # seine Belegung still (Wurzel 5: Kontroll-Signal nicht
            # verschlucken).
            raise fehler(
                "Eine Eigennutzung im Kalender lässt sich nicht stornieren: "
                f"{exc.message}",
                status_code=exc.status_code,
            ) from exc

    weg = (
        _filtern(
            db.table("reservations").delete(), tenant_id, owner_id
        ).execute()
    ).data or []
    log.info(
        "owner_stays_removed",
        tenant_id=tenant_id,
        owner_id=owner_id,
        count=len(weg),
    )
