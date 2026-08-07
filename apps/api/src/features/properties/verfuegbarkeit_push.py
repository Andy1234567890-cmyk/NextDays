"""Verfügbarkeits-Formular → Push-Jobs an die Portale.

Was der Betrieb unter `/objekte/{id}/verfuegbarkeit` speichert, muss bei den
Portalen ankommen. Drei Wege, weil die Ziele verschieden sind:

  Mindestaufenthalt     → ARI-Restriktion (min_stay_arrival/-through)
  Maximalaufenthalt     → ARI-Restriktion (max_stay)
  Gesperrte Wochentage  → ARI-Restriktion (closed_to_arrival/-departure)

Die restlichen drei Formularwerte (Vorbereitungszeit, Buchungsfenster,
Vorlaufzeit) haben bei Channex KEIN Restriktionsfeld und laufen über Airbnbs
Listing-Settings — siehe `channel_manager.airbnb_verfuegbarkeit_push`.

Dazu `tenant_currency`: die Währungs-Vorbelegung beim Anlegen eines Objekts.
Sachlich benachbart, weil beide Funktionen dieselbe Frage beantworten — welche
Stammdaten ein Objekt braucht, damit die Portale es überhaupt annehmen.

Liegt hier und nicht in `service.py`, aus demselben Grund wie
`gebuehren.laengenpreise_geaendert`: das Modul läuft sonst über die
1500-Zeilen-Grenze.

Alle Pushes decken IMMER den vollen Horizont ab, deshalb ist `coalesce=True`
korrekt: beim mehrfachen Speichern gewinnt der letzte Stand, statt dass sich
Jobs stauen. Best-effort im Sinne von Wurzel 5 — ein nicht erreichbares
Channex darf das Speichern nie kippen; Restriktions-Outbox und nächtlicher
Full-Sync sind der Backstop.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from supabase import Client

from src.core.logging import get_logger
from src.features.channel_manager.verfuegbarkeit_regeln import (
    Wochentagsregel,
    availability_geaendert,
)
from src.jobs.queue import try_enqueue_airbnb_verfuegbarkeit, try_enqueue_ari

log = get_logger("nextdays.properties")


def verfuegbarkeit_spiegeln(
    db: Client,
    tenant_id: str,
    property_id: str,
    row: dict[str, Any],
    alte_attrs: object,
    changes: dict[str, Any],
    horizont_tage: int,
) -> None:
    """Alles, was ein geändertes `type_attributes` an die Portale auslöst.

    Der eine Einstiegspunkt aus dem Speichern-Pfad: ARI-Restriktionen immer
    (sie sind billig und decken den vollen Horizont), die Airbnb-eigenen Regeln
    nur bei echter Änderung am Verfügbarkeits-Block — jeder Lauf davon ist ein
    GET+PUT gegen das Live-Listing, und ein Speichern an ganz anderer Stelle
    (Fotos, Ausstattung, Texte) ist dafür kein Anlass.
    """
    push_max_stay(db, tenant_id, property_id, max_stay_of(row), horizont_tage)
    push_verfuegbarkeitsregeln(db, tenant_id, property_id, row, horizont_tage)
    if availability_geaendert(alte_attrs, changes):
        try_enqueue_airbnb_verfuegbarkeit(db, tenant_id, property_id)


def tenant_currency(db: Client, tenant_id: str) -> str | None:
    """Die Abrechnungswährung des Betriebs (`tenants.currency`).

    Beim Anlegen eines Objekts die Vorbelegung: ohne Währung lässt sich später
    KEIN Preisplan anlegen (`rate_plans.currency` NOT NULL), und der Assistent
    scheitert mit „currency: String should have at least 1 character" — ein
    Fehler, der nicht sagt, was zu tun ist (live am 07.08.2026).

    None = der Betrieb führt selbst keine. Dann bleibt auch das Objekt ohne
    Währung und die Preis-Seite fragt danach, statt hier zu raten (Wurzel 4).
    """
    try:
        zeile = (
            db.table("tenants")
            .select("currency")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
    except Exception:  # noqa: BLE001 — best-effort, kippt die Anlage nicht
        log.warning("tenant_currency_unlesbar", tenant_id=tenant_id)
        return None
    wert = zeile[0].get("currency") if zeile else None
    return str(wert).strip().upper() if wert else None


def max_stay_of(row: dict[str, Any]) -> int:
    """Maximalaufenthalt (Nächte) aus type_attributes.availability.maxStay.

    0/fehlend = keine Obergrenze. Der Betrieb setzt ihn im Verfügbarkeits-
    Formular; Channex nimmt ihn als max_stay-Restriction (an die Portale).
    """
    avail = (row.get("type_attributes") or {}).get("availability") or {}
    try:
        return max(0, int(avail.get("maxStay") or 0))
    except (TypeError, ValueError):
        return 0


def push_verfuegbarkeitsregeln(
    db: Client,
    tenant_id: str,
    property_id: str,
    row: dict[str, Any],
    horizont_tage: int,
) -> None:
    """Mindestaufenthalt und Wochentagssperren als ARI-Jobs einreihen.

    Der Maximalaufenthalt läuft über `push_max_stay` (eigener Kind, eigener
    Coalesce-Schlüssel), damit sich die drei nicht gegenseitig verdrängen.
    """
    regel = Wochentagsregel.aus_zeile(row)
    heute = date.today()
    bis = (heute + timedelta(days=horizont_tage - 1)).isoformat()

    if regel.min_stay is not None:
        try_enqueue_ari(
            db, tenant_id, property_id, "rate",
            {"date_from": heute.isoformat(), "date_to": bis,
             "min_stay": regel.min_stay},
            coalesce=True,
        )
    # Immer einreihen, auch ohne gesetzte Sperre: der Push setzt die freien
    # Wochentage explizit auf false und hebt so eine früher gesetzte Sperre bei
    # den Portalen wieder auf (Wurzel 1 — der Gegenzustand).
    try_enqueue_ari(
        db, tenant_id, property_id, "wochentagssperren",
        {"date_from": heute.isoformat(), "date_to": bis,
         "gesperrte_anreise": sorted(regel.anreise),
         "gesperrte_abreise": sorted(regel.abreise)},
        coalesce=True,
    )


def push_max_stay(
    db: Client,
    tenant_id: str,
    property_id: str,
    max_stay: int,
    horizont_tage: int,
) -> None:
    """Maximalaufenthalt als ARI-Push-Job einreihen.

    0 wird ebenfalls gepusht, damit das Entfernen der Obergrenze bei den
    Portalen ankommt — sonst bliebe dort eine Grenze stehen, die es bei uns
    nicht mehr gibt (Wurzel 1).
    """
    heute = date.today()
    try_enqueue_ari(
        db, tenant_id, property_id, "max_stay",
        {"date_from": heute.isoformat(),
         "date_to": (heute + timedelta(days=horizont_tage - 1)).isoformat(),
         "max_stay": max_stay},
        coalesce=True,
    )
