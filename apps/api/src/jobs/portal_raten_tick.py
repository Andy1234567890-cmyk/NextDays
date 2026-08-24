"""Taeglicher Einreih-Schritt fuer den Portal-Raten-Abgleich.

Haengt am Reconcile-Tick des Workers (`Worker._enqueue_reconcile_all`) und reiht
je Objekt mit einem verbundenen Raten-Portal einen `abgleich_portal_raten`-Job
ein. Die Arbeit selbst steht in
`features.channel_manager.portal_raten_abgleich`; hier steht nur, WANN und WIE
OFT sie laeuft — als eigenes Modul, weil `worker.py` mit der Begruendung dazu
ueber seine Zeilengrenze lief und die Rechnung nicht gekuerzt werden soll.

WARUM AM TAEGLICHEN TICK und nicht am stuendlichen `_content_heal_tick`:
Der Abgleich kostet je Objekt und Portal ZWEI lesende Channex-Calls
(`mapping_details` = was das Portal fuehrt, `GET /channels/{id}` = worauf jede
Rate zeigt). Live gezaehlt (23.08.2026): 18 Booking-Verbindungen mit 18
verschiedenen `ota_hotel_id`, also 36 Calls je Lauf. Airbnb (19 Verbindungen)
ist ausgenommen — dort gibt es genau eine Rate je Anzeige, es gaebe nie etwas
anzulegen (`portal_raten_abgleich.PORTALE_MIT_RATEN`).

Gegen das Budget: `channex_account_budget` = 200 Requests/60 s kontoweit,
`channex_property_budget` = 20/60 s je Property (`core/config.py`). 36 Calls
sind 18 % EINES Minutenfensters, verteilt auf 18 verschiedene Properties (je 2
von 20) — taeglich nicht messbar. Stuendlich waeren es dieselben 36 Calls
24-mal, fuer eine Aenderung, die ein Betrieb wenige Male im Jahr macht (eine
neue Ratenkategorie im Extranet).

Zeitkritisch ist es nicht: eine Rate, die beim Portal schon verkauft, verkauft
nicht schlechter, weil unser eigener Plan dafuer einen Tag spaeter erscheint.
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from src.core.logging import get_logger
from src.features.channel_manager.portal_raten_abgleich import PORTALE_MIT_RATEN
from src.jobs.channex_budget import ChannexBudget
from src.jobs.queue import enqueue

log = get_logger("nextdays.jobs.portal_raten_tick")

# Obergrenze der je Tick betrachteten Kanal-Verbindungen. Live sind es 37 (18
# Booking + 19 Airbnb); 500 laesst Wachstum zu und deckelt trotzdem einen
# Ausreisser, statt eine unbegrenzte Liste zu ziehen (Wurzel 8).
BATCH = 500


def einreihen(db: Client, bucket: int) -> int:
    """Je Objekt mit Raten-Portal einen Abgleich einreihen; gibt die Anzahl.

    `bucket` ist der Wall-Clock-Tagesbucket des Reconcile-Ticks: mehrere
    Worker-Instanzen reihen damit je Objekt und Tag genau EINEN Job ein
    (Coalescing ueber `dedup_key`).

    Idempotent auch OHNE den Bucket (Wurzel 2): der Job selbst laesst jede Rate
    aus, die ihren eigenen Plan schon hat, und reiht ohne neuen Plan keinen
    Content-Sync ein — kein Insert, kein Content-Schreibaufruf.

    EINEN Channex-SCHREIBaufruf macht der Job seit dem 24.08.2026 doch: er
    loescht Kanal-Eintraege, deren `rate_plan_code` das Portal nicht mehr fuehrt
    (`DELETE channels/{id}/mappings/{mapping_id}`). Auch der ist idempotent —
    der zweite Lauf findet den Eintrag nicht mehr, und ein 404 gilt als
    Zielzustand. Begruendung samt Booking-Fehlermeldung
    (`RATE_NOT_ACTIVE_FOR_ROOM`, „Feriehus Line", 24.08.2026 02:02) im Kopf von
    `portal_raten_abgleich`; ohne dieses Loeschen kippte der Preis-Push des
    ganzen Zimmers.
    """
    rows = (
        db.table("channex_channel_connection")
        .select("tenant_id, property_id, ota_portal_code")
        .not_.is_("channex_channel_id", "null")
        .limit(BATCH)
        .execute()
    ).data or []
    gesehen: set[tuple[str, str]] = set()
    for row in rows:
        if str(row.get("ota_portal_code") or "") not in PORTALE_MIT_RATEN:
            continue  # Airbnb & Co. haben keine eigene Raten-Ebene
        tid, pid = row.get("tenant_id"), row.get("property_id")
        if not tid or not pid or (str(tid), str(pid)) in gesehen:
            continue
        # Ein Objekt kann an mehreren Raten-Portalen haengen; der Job arbeitet
        # ohnehin ALLE seine Kanaele ab — also einer je Objekt.
        gesehen.add((str(tid), str(pid)))
        enqueue(
            db, "abgleich_portal_raten", tenant_id=str(tid),
            payload={"tenant_id": str(tid), "property_id": str(pid)},
            dedup_key=f"portal_raten_tick:{tid}:{pid}:{bucket}",
        )
    if gesehen:
        log.info("portal_raten_abgleich_eingereiht", objekte=len(gesehen))
    return len(gesehen)


def handle(
    db: Client, payload: dict[str, Any], budget: ChannexBudget | None = None
) -> dict[str, Any] | None:
    """Worker-Handler des Jobs `abgleich_portal_raten` (Registry in
    `src/worker.py`).

    Liegt hier statt im Worker, weil Einreihen und Abarbeiten dieses Jobs
    dieselbe Begruendung teilen — und weil `worker.py` an seiner Zeilengrenze
    steht; eine gekuerzte Begruendung waere der schlechtere Tausch.

    Ein Fehler kippt den Job auf Retry: dieser Lauf ist der einzige Weg, auf dem
    eine im Extranet angelegte Rate bei uns einen Plan bekommt — ihn still als
    „done" zu verbuchen waere Wurzel 5.
    """
    # Lokaler Import: der Dienst zieht die halbe channel_manager-Schicht nach
    # sich, und dieses Modul wird beim Worker-Start importiert (Tick).
    from src.features.channel_manager.channex_client import ChannexClient
    from src.features.channel_manager.service import ChannelManagerService

    svc = ChannelManagerService(
        service_client=db,
        channex=ChannexClient(
            before_call=budget.try_consume if budget is not None else None
        ),
    )
    if not svc.is_channex_configured:
        return None
    return svc.portal_raten_abgleichen(
        payload["tenant_id"], payload["property_id"]
    )
