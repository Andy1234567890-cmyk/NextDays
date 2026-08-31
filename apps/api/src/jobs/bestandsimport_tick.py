"""Worker-Einstieg fuer den Datei-Bestandsimport (Portal-Export).

Als eigenes Modul, weil `worker.py` mit diesem Handler ueber seine Zeilengrenze
lief (1520/1500) — dasselbe Muster wie `portal_raten_tick`. Die Begruendung
gehoert zum Code, nicht gekuerzt, damit niemand spaeter raet, warum der Import
nicht mehr synchron laeuft.

WARUM UEBERHAUPT IM WORKER: Der Import lief bis zum 31.08.2026 in EINER
HTTP-Anfrage. Live gemessen an einem Booking.com-Export mit 252 Zeilen: 3,6 s je
Zeile, also rund 15 Minuten. Der Browser bricht lange vorher ab und zeigt
„Backend nicht erreichbar.", waehrend der Server unbeirrt weiterschreibt — der
Betrieb sah einen Fehler UND hatte einen halb angelegten Bestand. Gemeldet wurde
es als „Upload Booking Buchungsliste funktioniert nicht".

Die Arbeit selbst steht in `features.channel_manager.bestandsimport_dienst`;
hier steht nur der Einstieg.
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from src.jobs.channex_budget import ChannexBudget


def handle(
    db: Client, payload: dict[str, Any], budget: ChannexBudget | None = None
) -> dict[str, Any]:
    """Einen eingereihten Bestandsimport abarbeiten.

    Der Fortschritt geht nach `bestandsimport_lauf` und wird von der Oberflaeche
    per Realtime gelesen; die Seite darf geschlossen werden.

    KEIN Channex-Budget noetig: der Import schreibt ausschliesslich bei uns, er
    ruft kein Portal. Der Parameter steht nur in der Signatur, weil der
    Worker-Verteiler ihn jedem Handler gleich uebergibt.
    """
    # Denselben Bauweg nehmen wie jeder andere Handler (`worker._svc`), statt
    # den Service hier ein zweites Mal zusammenzusetzen — sonst faellt eine
    # Aenderung an der Konstruktion an genau dieser Stelle nicht auf.
    from src.worker import _svc  # noqa: PLC0415 — Zirkelbezug beim Modulimport

    svc = _svc(db, budget)
    return svc.bestandsimport_ausfuehren(
        payload["lauf_id"], payload_content=payload.get("content")
    )
