"""Wie eine Aktion (Rabatt) über den TAGESPREIS an die Portale kommt.

Es gibt zwei Wege zu den Portalen, und dieses Modul ist der erste:

1. **Tagespreis** (hier): der gesendete Preis der betroffenen Tage ist niedriger.
   Trägt jedes Portal, aber nur Bedingungen, die sich AM TAG entscheiden lassen.
2. **Airbnbs eigene Rabattregeln** (`airbnb_aktionen.py`): Mindestaufenthalt,
   Frühbucher und Last Minute als echtes Objekt bei Airbnb
   (`default_pricing_rules` in den Listing-Preis-Einstellungen).

Was der Tagespreis kann und was nicht:

+------------------------+------------------------------------------------------+
| Aufenthaltsdaten       | ja — der Tag liegt drin oder nicht                   |
| keine Bedingung        | ja — gilt an jedem Tag                               |
+------------------------+------------------------------------------------------+
| Mindestaufenthalt      | nein — hängt an der Aufenthaltslänge der BUCHUNG,    |
|                        | nicht am Tag. Ein pauschal gesenkter Tagespreis gäbe |
|                        | den Rabatt auch bei einer Nacht.                     |
|                        | → geht bei Airbnb über Weg 2.                        |
| Frühbucher/Last Minute | nein — hängt am BUCHUNGSDATUM. Das kennt der Preis   |
|                        | eines Tages nicht; wir wüssten beim Push nicht, wann |
|                        | der Gast bucht. → geht bei Airbnb über Weg 2.        |
| Daten der Buchung      | nein — derselbe Grund, und Weg 2 hat kein            |
|                        | Gültigkeitsfenster.                                  |
| Angebotscode           | nein — kein Portal übergibt einen Gast-Code.         |
+------------------------+------------------------------------------------------+

Nicht übertragbar heißt NICHT „stillschweigend trotzdem senden": ein dauerhaft
gesenkter Tagespreis würde den Rabatt JEDEM Portal-Gast geben, auch dem, der die
Bedingung nicht erfüllt. Das ist echter Geldverlust. Was weder Weg 1 noch Weg 2
tragen kann, wird in der Oberfläche als „Manuelle Synchronisierung" am Posten
angezeigt (abgaben_status.py) — der Betrieb pflegt es dann im Extranet des
Portals, wo Booking.com und Airbnb ihre eigenen Aktionsprogramme haben.

Zur Trennung der beiden Wege: sie schließen sich gegenseitig aus, nicht
zufällig, sondern nach Konstruktion. Weg 1 verlangt, dass KEINE buchungsbezogene
Bedingung gesetzt ist; Weg 2 verlangt, dass GENAU EINE gesetzt ist. Eine Aktion
kann damit nie über beide laufen und ein Gast nie zwei Rabatte bekommen.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from supabase import Client

from .common import log

# Bedingungen, die sich NICHT am einzelnen Tag entscheiden lassen. Steht eine
# davon an der Aktion, kann kein Tagespreis sie ausdrücken.
NICHT_AM_TAG_ENTSCHEIDBAR = (
    ("min_nights", "mindestaufenthalt"),
    ("lead_min_days", "fruehbucher"),
    ("lead_max_days", "last_minute"),
    ("booked_from", "buchungszeitraum"),
    ("booked_to", "buchungszeitraum"),
    ("promo_codes", "angebotscode"),
)


def per_tagespreis_uebertragbar(regel: dict[str, Any]) -> tuple[bool, str | None]:
    """Kann diese Aktion über den Tagespreis an ein Portal? Plus der Grund, wenn nicht.

    Der Grund ist ein Schlüssel (kein Satz), damit die Oberfläche ihn übersetzen
    kann und das Protokoll ihn auswerten lässt.
    """
    for feld, grund in NICHT_AM_TAG_ENTSCHEIDBAR:
        wert = regel.get(feld)
        if wert not in (None, [], ""):
            return False, grund
    return True, None


def _stay_ranges(regel: dict[str, Any]) -> list[tuple[date, date]]:
    """Aufenthaltszeiträume als Datumspaare. Unlesbare Angaben fliegen raus.

    Fail-closed: ein kaputtes Datum darf den Zeitraum nicht zu „gilt immer"
    aufweiten (Wurzel 5) — dann greift die Aktion für diesen Eintrag gar nicht.
    """
    out: list[tuple[date, date]] = []
    for eintrag in regel.get("stay_ranges") or []:
        if not isinstance(eintrag, dict):
            continue
        try:
            von = date.fromisoformat(str(eintrag["from"]))
            bis = date.fromisoformat(str(eintrag["to"]))
        except (KeyError, ValueError, TypeError):
            continue
        if von <= bis:
            out.append((von, bis))
    return out


def _gilt_am_tag(regel: dict[str, Any], tag: date) -> bool:
    """Gilt die (übertragbare) Aktion an diesem Tag?

    Ohne Aufenthaltsdaten gilt sie an jedem Tag — das ist eine bewusste Eingabe
    des Betriebs („20 % auf alles"), kein fehlender Wert.
    """
    ranges = _stay_ranges(regel)
    if not ranges:
        return not (regel.get("stay_ranges") or [])
    return any(von <= tag <= bis for von, bis in ranges)


def aktionsfaktor_je_tag(
    db: Client,
    property_id: str,
    *,
    von: date,
    bis: date,
    portal: str | None = None,
) -> dict[str, float]:
    """{ISO-Tag: Faktor} für die Preise, die an die Portale gehen.

    Faktor 0.8 heißt „an diesem Tag gehen 80 % des Preises raus". Nur Tage mit
    einer greifenden Aktion stehen drin; alle anderen bleiben unverändert (kein
    Eintrag = Faktor 1).

    BESTER EINZELRABATT, kein Stacking — dieselbe Regel wie im Preis-Resolver
    (`_best_discount`). Zwei Aktionen am selben Tag addieren sich NICHT, sonst
    ginge an das Portal ein Preis, den unsere eigene Buchungsstrecke nie
    ausgeben würde.

    Prozent ist exakt abbildbar. Eine PAUSCHALE ist es nicht: „50 € pro Buchung"
    lässt sich nur auf Nächte verteilen, wenn man die Aufenthaltsdauer kennt —
    beim Push kennt sie niemand. Sie wird deshalb NICHT verteilt (kein geratener
    Anteil, Wurzel 4) und gilt als nicht übertragbar.

    Ein Fehler beim Laden ergibt ein LEERES Ergebnis: dann geht der ungerabattete
    Preis raus. Zu viel verlangt ist ärgerlich und fällt auf; zu wenig verlangt
    ist Geldverlust, den niemand sieht (fail-closed in Richtung Preis).
    """
    try:
        rows = (
            db.table("property_discounts")
            .select(
                "discount_type, discount_kind, discount_bps, discount_amount, "
                "min_nights, lead_min_days, lead_max_days, stay_ranges, "
                "booked_from, booked_to, promo_codes, portal_scope"
            )
            .eq("property_id", property_id)
            .eq("active", True)
            .execute()
        ).data or []
    except Exception as exc:  # noqa: BLE001 — siehe Docstring: ohne Rabatt pushen
        log.warning(
            "ota_aktionen_nicht_ladbar", property_id=property_id, error=str(exc)[:200]
        )
        return {}

    tauglich: list[dict[str, Any]] = []
    for regel in rows:
        ok, grund = per_tagespreis_uebertragbar(regel)
        if not ok:
            log.info(
                "ota_aktion_nicht_uebertragbar",
                property_id=property_id, grund=grund,
            )
            continue
        if str(regel.get("discount_kind") or "percent") != "percent":
            log.info(
                "ota_aktion_pauschale_nicht_verteilbar", property_id=property_id
            )
            continue
        scope = regel.get("portal_scope") or []
        # Kanal-Einschränkung: `portal=None` ist der Preis, den ALLE Kanäle ohne
        # eigenen Plan bekommen — eine eingeschränkte Aktion darf dort nicht
        # hinein, sonst liefe die Einschränkung ins Leere.
        if scope and (portal is None or portal not in {str(x) for x in scope}):
            continue
        tauglich.append(regel)
    if not tauglich:
        return {}

    faktoren: dict[str, float] = {}
    tag = von
    while tag <= bis:
        best_bps = 0
        for regel in tauglich:
            if not _gilt_am_tag(regel, tag):
                continue
            bps = int(regel.get("discount_bps") or 0)
            best_bps = max(best_bps, bps)
        if best_bps > 0:
            # bps: 100 = 1,00 %. 2000 bps = 20 % → Faktor 0.8.
            faktoren[tag.isoformat()] = max(0.0, 1.0 - best_bps / 10000.0)
        tag += timedelta(days=1)
    return faktoren
