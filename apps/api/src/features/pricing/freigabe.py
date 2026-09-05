"""Freigabe-Sperre für den Portal-Push — EINE Stelle für alle Push-Wege.

WARUM DAS GATE HIER SITZT UND NICHT IM RESOLVER
===============================================
Erster Versuch (04.09.2026, sofort zurückgebaut): die Sperre steckte im
`PricingResolver`, damit sie keiner der Push-Wege umgehen kann. Das war
falsch — der Resolver ist die EINE Preis-Wahrheit für alles: Kalender,
Angebot, eigene Buchungsstrecke, Portal-Push.

Die Folge war live sichtbar: der Kalender zeigte 550/605/632 DKK
(Saisonpreise), während 540 berechnete Tage zwischen 440 und 801 DKK
danebenlagen und auf Freigabe warteten. Zwei Wahrheiten nebeneinander, ohne
Hinweis welche gilt. Schlimmer noch: ein Gast auf der eigenen Plattform hätte
den Saisonpreis BEZAHLT — die Sperre hätte nicht nur die Anzeige, sondern den
echten Verkaufspreis verändert. Gemeldet wurde es nicht vom System, sondern
vom Auge: *"alle einstellung und preise im kalender sind nicht syncrone"*.

Die Freigabe betrifft genau eine Frage: geht der Preis schon an FREMDE
Portale? Sie gehört deshalb an die Aussengrenze, nicht an die Preis-Wahrheit.

WARUM EIN GETEILTER HELFER UND NICHT DREI PRÜFUNGEN
====================================================
Es gibt drei Wege nach draussen — `recompute._push_to_channex`,
`ari_push.push_ari` und `full_sync`. Eine Sperre in nur einem davon ist eine
Attrappe: genau daran scheiterte der frühere "Autopilot"-Modus, dessen Gate im
Recompute sass, während Reconcile und Full-Sync munter weiterschickten. Alle
drei fragen hier, und ein vierter Weg fällt beim Lesen dieser Datei auf.
"""
from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from supabase import Client

from src.core.logging import get_logger

log = get_logger("nextdays.pricing.freigabe")

# Wie weit die Freigabe reicht. MUSS derselbe Horizont sein, den der Push
# tatsächlich bedient (`settings_service._UMSCHALT_HORIZONT_TAGE`) und den der
# Kalender zeigt — sonst zählt die Leiste Tage, die niemand ansehen kann.
#
# Genau das war live zu sehen (04.09.2026): der Recompute schreibt 540 Tage
# voraus (`recompute.DEFAULT_HORIZON_DAYS`), der Push meldet 365. Die Zählung
# nahm alles ab heute und kam auf 540 — 174 davon jenseits des Push-Horizonts,
# also Tage, die nie gesendet werden und deshalb NIE einen Stempel bekommen
# können. Sie warteten auf eine Freigabe, die ihnen nichts nützt, und die
# Leiste behauptete einen Rückstand, den kein Klick je abbauen konnte.
FREIGABE_HORIZONT_TAGE = 365


def freigabe_fenster(
    heute: date | None = None, ab_tagen: int | None = None
) -> tuple[str, str]:
    """Der Zeitraum, für den die Freigabe gilt: [heute, heute+Horizont].

    `ab_tagen` (0562, SiteMinder „Enabled for dates within X days"): ist es
    gesetzt, warten nur Tage mit Vorlauf <= X auf die Freigabe — das Fenster
    endet dann dort. Fernere Tage gehen automatisch.

    Beide Grenzen INKLUSIV als ISO-Text, weil jede Aufrufstelle sie so an
    PostgREST weiterreicht (`gte`/`lte`).
    """
    von = heute or datetime.now(UTC).date()
    horizont = FREIGABE_HORIZONT_TAGE
    if ab_tagen is not None:
        horizont = max(0, min(horizont, int(ab_tagen)))
    return von.isoformat(), (von + timedelta(days=horizont)).isoformat()


def freigabe_regel(db: Client, property_id: str) -> tuple[bool, int | None]:
    """(freigabe_noetig, freigabe_ab_tagen) eines Objekts — EINE Abfrage.

    Fail-OFFEN wie `freigabe_noetig`: Lesefehler = (False, None) = alles geht
    raus. Ein stehengebliebener Preis fällt niemandem auf, bis ein Gast bucht.
    """
    try:
        res = (
            db.table("dp_settings")
            .select("freigabe_noetig, freigabe_ab_tagen")
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        ).data or []
    except Exception as exc:  # noqa: BLE001 — kein Flag = senden wie bisher
        log.warning("dp_freigabe_flag_unlesbar", error=str(exc)[:200])
        return False, None
    if not res:
        return False, None
    ab = res[0].get("freigabe_ab_tagen")
    try:
        ab_tagen = int(ab) if ab is not None else None
    except (TypeError, ValueError):
        ab_tagen = None
    return bool(res[0].get("freigabe_noetig")), ab_tagen


def freigabe_noetig(db: Client, property_id: str) -> bool:
    """Wartet dieses Objekt mit dem Senden auf eine Freigabe?

    Fail-OFFEN (Standard: nein). Anders als bei Rechte-Prüfungen ist das hier
    richtig: ein Lesefehler darf nicht dazu führen, dass Preise stillschweigend
    NICHT mehr an die Portale gehen. Ein stehengebliebener Preis fällt
    niemandem auf, bis ein Gast zu ihm bucht.
    """
    return freigabe_regel(db, property_id)[0]


# PostgREST-`in_` wandert in die URL; über ~100 Werte wird sie zu lang.
_IN_BLOCK = 100


def gesendet_stempeln(db: Client, property_id: str, tage: list[str]) -> None:
    """Genau die übergebenen Tage als „an die Portale gesendet" stempeln.

    DER EINE STEMPEL-WEG. Bis 05.09.2026 stempelte nur der Recompute-Push;
    der Push beim Umlegen des Freigabe-Schalters (`_preise_neu_verteilen`)
    schickte dieselben Preise hinaus, setzte aber keinen Stempel. Live:
    Freigabe um 21:33 auf „Sofort" gestellt, alle 1000 Schatten-Zeilen
    stimmten auf den Cent mit den berechneten Preisen überein — und die Seite
    zeigte „366 Tage nicht gesendet" samt Sende-Knopf. Der Zähler log, weil
    zwei Sende-Wege einen Stempel kannten und nur einer ihn setzte.

    Eine Liste statt eines Bereichs, weil bei Freigabepflicht nur ein TEIL
    des Bereichs rausgeht — ein Bereichs-Update stempelte auch die wartenden
    Tage und hebelte die Freigabe aus. Best-effort, aber laut.
    """
    if not tage:
        return
    try:
        for i in range(0, len(tage), _IN_BLOCK):
            db.table("dynamic_prices").update(
                {"gesendet_am": datetime.now(UTC).isoformat()}
            ).eq("property_id", property_id).is_(
                "gesendet_am", "null"
            ).in_("date", tage[i : i + _IN_BLOCK]).execute()
    except Exception as exc:  # noqa: BLE001 — Stempel darf den Push nicht kippen
        log.warning(
            "dynamic_prices_stempel_fehlgeschlagen",
            property_id=property_id,
            error=str(exc)[:200],
        )


def gesperrte_tage(db: Client, property_id: str, von: date, bis: date) -> set[str]:
    """ISO-Tage, die (noch) NICHT an die Portale gehen dürfen.

    Leere Menge heisst "alles darf raus" — entweder verlangt das Objekt keine
    Freigabe, oder alles Berechnete ist bereits gesendet.

    `bis` ist exklusiv, wie überall im Slice.
    """
    noetig, ab_tagen = freigabe_regel(db, property_id)
    if not noetig:
        return set()
    # Freigabe nur fuer nahe Tage (0562): jenseits von heute+ab_tagen wird
    # nichts gesperrt — diese Tage gehen automatisch.
    if ab_tagen is not None:
        grenze = datetime.now(UTC).date() + timedelta(days=ab_tagen)
        if grenze < von:
            return set()
        bis = min(bis, grenze + timedelta(days=1))
    try:
        res = (
            db.table("dynamic_prices")
            .select("date")
            .eq("property_id", property_id)
            .is_("gesendet_am", "null")
            .gte("date", von.isoformat())
            .lt("date", bis.isoformat())
            .execute()
        ).data or []
    except Exception as exc:  # noqa: BLE001
        log.warning("dp_gesperrte_tage_unlesbar", error=str(exc)[:200])
        return set()
    gesperrt = {r["date"] for r in res if isinstance(r.get("date"), str)}
    if gesperrt:
        log.info(
            "dp_push_wartet_auf_freigabe",
            property_id=property_id,
            tage=len(gesperrt),
        )
    return gesperrt
