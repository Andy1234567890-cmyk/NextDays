"""Gemeinsame Helfer der öffentlichen Buchungsstrecke.

Hier liegt, was SOWOHL das Schaufenster (Suche, Inserat, Verfügbarkeit) ALS AUCH
das Buchen braucht. Getrennt aus `service.py`, als die Datei die Pylint-Grenze
von 1500 Zeilen erreichte — nicht nach Zeilenzahl geschnitten, sondern entlang
der Zuständigkeit: drei Prüfungen/Umwandlungen, die zu keiner der beiden Seiten
allein gehören.

Sie stehen bewusst NICHT in `schaufenster.py` und nicht im Service: ein Import
in die eine Richtung wäre eine Abhängigkeit zwischen zwei gleichrangigen
Bausteinen, und beim nächsten Schnitt wüsste niemand mehr, welcher der Besitzer
ist.
"""
from datetime import date

from .errors import BookingEngineError

# Max. Datums-Span für öffentliche, JWT-lose Endpunkte. Ohne Obergrenze baut der
# Tag-für-Tag-Loop (_nights) + die datierte Preisauflösung bei z. B. end=9999
# Millionen Objekte pro Request → ein einziger unauth Request kippt den Worker
# (DoS). 730 Tage (2 Jahre) deckt jeden realen Buchungshorizont ab. Fail-closed
# (Wurzel 5): darüber 422 statt stiller Deckelung.
_MAX_SPAN_DAYS = 730


def _assert_span(start: date | None, end: date | None) -> None:
    """[start, end) muss valide und ≤ _MAX_SPAN_DAYS sein. None/None ist erlaubt
    (Endpunkte ohne Datumsfilter). Ein einzelnes gesetztes Datum ohne das andere
    ist unvollständig → 422."""
    if start is None and end is None:
        return
    if start is None or end is None:
        raise BookingEngineError(
            "start und end müssen gemeinsam angegeben werden.", status_code=422
        )
    if end <= start:
        raise BookingEngineError("end muss nach start liegen.", status_code=422)
    if (end - start).days > _MAX_SPAN_DAYS:
        raise BookingEngineError(
            f"Zeitraum zu groß (max. {_MAX_SPAN_DAYS} Tage).", status_code=422
        )


# Haustier-Regel eines Objekts. Zwei Quellen, in dieser Reihenfolge:
# 1. die strukturierte Hotel-Policy (`policies.hotelPolicy.petsPolicy`), die auch
#    an die Portale geht — sie ist die ausdrückliche Angabe des Betriebs;
# 2. die Ausstattungsmerkmale, wenn keine Policy gepflegt ist.
# Ohne beides gilt NEIN (fail-closed, Wurzel 5): lieber bietet die Oberfläche die
# Tierauswahl nicht an, als dass ein Gast mit Hund anreist, wo keiner erlaubt ist.
_PETS_JA = frozenset({"pets_allowed", "pet_friendly", "nd_pets_on_request"})
_PETS_NEIN = frozenset({"nd_pets_not_allowed"})


def _pets_allowed(prop: dict) -> bool:
    """Sind Haustiere in diesem Objekt erlaubt?"""
    policies = (prop.get("type_attributes") or {}).get("policies") or {}
    policy = ((policies.get("hotelPolicy") or {}).get("petsPolicy") or "").strip()
    if policy:
        return policy != "not_allowed"
    amenities = {str(a) for a in (prop.get("amenities") or [])}
    if amenities & _PETS_NEIN:
        return False
    return bool(amenities & _PETS_JA)


def _as_opt_int(value: object) -> int | None:
    """jsonb-Wert → int oder None (keine erfundenen 0-Werte)."""
    if value is None:
        return None
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
