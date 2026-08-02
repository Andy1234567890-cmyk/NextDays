"""Sichtbarkeit der Zwei-Wege-Bewertung (Airbnb-Modell, double-blind).

Gast→Objekt (``reviews``) und Betrieb→Gast (``guest_reviews_by_host``) bleiben
verdeckt, bis BEIDE Seiten abgegeben haben oder die Frist abgelaufen ist. Beide
Slices lösen das aus — die Gast-Seite beim Abgeben, das Cockpit beim Bewerten
des Gasts — deshalb steht die Logik hier und nicht in einem der beiden Services.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

from supabase import Client

from src.core.logging import get_logger

from .common import DOUBLE_BLIND_DAYS

log = get_logger("nextdays.reviews.publication")


def resolve_publication(db: Client, reservation_id: str) -> None:
    """Sobald BEIDE Seiten für dieselbe Reservierung existieren, beide auf
    ``published_at=now()`` setzen (nur wo noch NULL). Monoton — kein Rücksetzen
    (Wurzel 1). Sonst bleibt beides verdeckt bis zur Frist."""
    has_guest = (
        db.table("reviews")
        .select("id")
        .eq("reservation_id", reservation_id)
        .limit(1)
        .execute()
    ).data
    has_host = (
        db.table("guest_reviews_by_host")
        .select("id")
        .eq("reservation_id", reservation_id)
        .limit(1)
        .execute()
    ).data
    if not (has_guest and has_host):
        return
    now = datetime.now(UTC).isoformat()
    db.table("reviews").update({"published_at": now}).eq(
        "reservation_id", reservation_id
    ).is_("published_at", "null").execute()
    db.table("guest_reviews_by_host").update({"published_at": now}).eq(
        "reservation_id", reservation_id
    ).is_("published_at", "null").execute()


def publish_overdue(db: Client) -> int:
    """Einseitige Bewertungen nach Ablauf der Frist veröffentlichen (auch ohne
    Gegenseite — Airbnb-Modell). service_role, mandantenübergreifend. Gibt die
    Anzahl frisch veröffentlichter Zeilen zurück."""
    cutoff = (datetime.now(UTC) - timedelta(days=DOUBLE_BLIND_DAYS)).isoformat()
    now = datetime.now(UTC).isoformat()
    published = 0
    for table in ("reviews", "guest_reviews_by_host"):
        rows = (
            db.table(table)
            .update({"published_at": now})
            .is_("published_at", "null")
            .lt("created_at", cutoff)
            .execute()
        ).data or []
        published += len(rows)
    if published:
        log.info("reviews_published_overdue", count=published)
    return published
