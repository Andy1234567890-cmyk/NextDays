"""Gemeinsame Bausteine des crm-Slices: Fehlerklasse, Wertelisten, Zustandsgraph.

Die Wertelisten hier MÜSSEN mit den CHECK-Constraints aus Migration 0597
deckungsgleich sein (`leads_status_check`, `leads_lead_source_check`). Nimmt
die API einen Wert an, den die DB ablehnt, endet das in einem rohen 500 statt
einer verständlichen 422 — dieselbe Lehre wie beim `stripe`-Literal im
Payments-Schema (siehe MEMORY „DB-CHECK und Pydantic-Literal deckungsgleich").
"""
from __future__ import annotations

from typing import Literal

LeadStatus = Literal[
    "new", "contacted", "visit_scheduled", "offer_sent", "contract_sent", "won", "lost"
]
LEAD_STATUSES: tuple[str, ...] = (
    "new", "contacted", "visit_scheduled", "offer_sent", "contract_sent", "won", "lost"
)

LeadSource = Literal["website", "referral", "portal", "event", "cold_call", "social", "other"]
LEAD_SOURCES: tuple[str, ...] = (
    "website", "referral", "portal", "event", "cold_call", "social", "other"
)

DiscountKind = Literal["percent", "fixed"]

# Zustandsgraph des Lead-Workflows (Lastenheft §2.6, Plan Etappe 7).
#
# Vorwärts entlang der Akquise, ein Schritt zurück ist erlaubt (ein Besichtigungs-
# termin platzt, das Angebot wird nachverhandelt). `lost` ist von überall
# erreichbar und lässt sich wieder öffnen (`contacted`) — ein Interessent, der
# ein Jahr später doch anruft, ist derselbe Lead, kein neuer.
#
# `won` steht NICHT als Ziel eines PATCH: gewonnen heißt, dass ein Eigentümer
# entstanden ist, und das leistet ausschließlich `POST /crm/leads/{id}/convert`.
# Ein PATCH auf `won` würde den Zustand behaupten, ohne die Tatsache zu
# schaffen (Wurzel 4). `won` ist terminal.
LEAD_TRANSITIONS: dict[str, frozenset[str]] = {
    "new": frozenset({"contacted", "lost"}),
    "contacted": frozenset({"visit_scheduled", "offer_sent", "lost"}),
    "visit_scheduled": frozenset({"contacted", "offer_sent", "lost"}),
    "offer_sent": frozenset({"visit_scheduled", "contract_sent", "lost"}),
    "contract_sent": frozenset({"offer_sent", "lost"}),
    "lost": frozenset({"contacted"}),
    "won": frozenset(),
}

# Paginierung der Lead-Liste: harte Obergrenze (Wurzel 8 — kein unbegrenzter
# Bereich), Default bewusst darunter.
LEADS_LIMIT_DEFAULT = 50
LEADS_LIMIT_MAX = 200


class CrmError(Exception):
    """Fachlicher Fehler; vom Router auf HTTP-Status gemappt.

    `details` trägt strukturierte Zusatzangaben, die der Client BRAUCHT — etwa
    die Liste der fehlenden Pflichtfelder bei der Konvertierung. Sie stehen
    neben der Meldung, nicht darin: der Text ist übersetzbar, eine Liste daraus
    zurückzuparsen wäre eine zweite, brüchige Wahrheit (Wurzel 4).
    """

    def __init__(
        self,
        message: str,
        *,
        status_code: int = 400,
        details: dict | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details
