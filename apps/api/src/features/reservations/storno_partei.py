"""Welche PARTEI hat einen Storno ausgelöst — abgeleitet aus der Rolle (0410).

WARUM SERVERSEITIG UND NICHT AUS DEM REQUEST: Ab Etappe 3 entscheidet die
Partei, ob die 8 %-Marktplatz-Provision bei uns bleibt (Gast-Storno) oder
zurückgebucht wird (Storno des Betriebs). Dürfte der Client sie mitschicken,
könnte ein Betrieb seinen eigenen Storno als Gast-Storno ausgeben und so die
Provision beim Gast belassen — echtes Geld, aus einem Feld im Request-Body
(Wurzel 3: der Anfrage nicht vertrauen).

WARUM EIGENES MODUL: Router und MCP-Werkzeug brauchen dieselbe Ableitung. Läge
sie in einem der beiden, wäre die zweite Stelle eine Kopie, die beim nächsten
neuen Rollenwert vergessen wird.
"""
from __future__ import annotations

from src.features.auth.schemas import UserRole

from ._base import ReservationError
from .schemas import CancelParty

# Die Rolle des angemeldeten Nutzers → seine Sphäre.
#
# `staff`/`cleaner` stehen hier, obwohl sie MANAGE_CALENDAR heute nicht haben
# und den Storno-Endpunkt nicht erreichen: handeln sie je doch, handeln sie für
# den BETRIEB, nicht für sich. Eine Lücke im Mapping wäre sonst ein 500 an
# einer Stelle, an der die Autorisierung längst entschieden hat.
_PARTEI_JE_ROLLE: dict[UserRole, CancelParty] = {
    UserRole.admin: CancelParty.betrieb,
    UserRole.co_admin: CancelParty.betrieb,
    UserRole.staff: CancelParty.betrieb,
    UserRole.cleaner: CancelParty.betrieb,
    UserRole.owner: CancelParty.eigentuemer,
}


def partei_aus_rolle(role: str | None) -> CancelParty:
    """Partei eines Stornos, den ein angemeldeter Betriebs-Nutzer auslöst.

    Fail-closed (Wurzel 5): eine fehlende oder unbekannte Rolle ergibt KEINEN
    Ersatzwert. Es gibt hier keine harmlose Annahme — „betrieb" verschenkt
    unsere Provision, „gast" nimmt sie dem Gast weg. Wer nicht zuordenbar ist,
    storniert nicht.

    Ein API-Client-Token (`role=None`, Client-Credentials) landet ebenfalls
    hier. Es erreicht den Storno-Endpunkt heute nicht (`require_permission`
    verlangt eine Rolle); bekommt es je Zugang, muss die Partei bewusst
    entschieden werden — nicht stillschweigend „betrieb" heißen.
    """
    try:
        rolle = UserRole(role)
    except ValueError as exc:
        raise ReservationError(
            f"Storno ohne zuordenbare Rolle ({role!r}) — die Storno-Partei "
            "lässt sich nicht bestimmen.",
            status_code=403,
        ) from exc
    partei = _PARTEI_JE_ROLLE.get(rolle)
    if partei is None:
        raise ReservationError(
            f"Für die Rolle '{rolle.value}' ist keine Storno-Partei "
            "festgelegt.",
            status_code=403,
        )
    return partei
