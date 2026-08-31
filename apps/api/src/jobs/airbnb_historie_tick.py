"""Worker-Einstieg fuer den serverseitigen Airbnb-Historien-Import.

Als eigenes Modul aus demselben Grund wie `portal_raten_tick` und
`bestandsimport_tick`: `worker.py` steht hart an seiner Zeilengrenze
(C0302, 1500), und die Begruendung eines Handlers soll nicht gekuerzt werden,
nur damit sie dort noch hineinpasst.

Die Arbeit selbst steht in
`features.channel_manager.airbnb_historie_dienst.historie_lauf_ausfuehren`.
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from src.jobs.channex_budget import ChannexBudget


def handle(
    db: Client, payload: dict[str, Any], budget: ChannexBudget | None = None
) -> None:
    """Die Buchungshistorie aller verbundenen Objekte bei Airbnb einlesen.

    Laeuft im Worker statt im Browser, weil ein Lauf ueber 18 Objekte Minuten
    dauert — so lange bleibt kein Betrieb auf der Seite, und vorher brach der
    Import beim Schliessen des Tabs mittendrin ab. Der Fortschritt steht in
    `airbnb_historie_lauf`, das Ergebnis am Ende in der Glocke.

    KEIN Channex-Budget: dieser Weg ruft Airbnb direkt, nicht den Aggregator.
    """
    from src.worker import _svc  # noqa: PLC0415 — Zirkelbezug beim Modulimport

    svc = _svc(db, budget)
    svc.historie_lauf_ausfuehren(payload["lauf_id"])
