"""Die Läufe des Partnerprogramms (0517) — Fachlauf ohne Zeitsteuerung.

Wie `geld_laeufe`: der Worker entscheidet, WANN (Tick), hier steht, WAS.
  * `provisionen_reifen`   — `pending` → `approved`, sobald das Erstattungs-
                             fenster (`matures_at`) vorbei ist. Stündlich.
  * `raenge_bewerten`      — Rang nach zahlenden Kunden. Monatserster.
  * `klicks_aufraeumen`    — Klickzeilen älter als 90 Tage löschen (Datensparsamkeit).
  * `auszahlungen_vorbereiten` — je Partner und Währung fällige Provisionen
                             bündeln (Stufe 1: Backoffice bestätigt). Monatserster.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING

from src.core.logging import get_logger
from src.core.supabase import fetch_all_rows

if TYPE_CHECKING:
    from supabase import Client

log = get_logger("nextdays.worker")

KLICK_AUFBEWAHRUNG_TAGE = 90


def provisionen_reifen(db: Client, *, jetzt: datetime | None = None) -> int:
    """Erstattungsfenster vorbei → auszahlbar. Gibt die Zahl der Zeilen zurück."""
    jetzt = jetzt or datetime.now(UTC)
    res = (
        db.table("affiliate_commissions")
        .update({"status": "approved"})
        .eq("status", "pending")
        .in_("kind", ["earn", "override", "lifetime", "booking_share", "bonus"])
        .lte("matures_at", jetzt.isoformat())
        .execute()
    )
    anzahl = len(res.data or [])
    if anzahl:
        log.info("partner_provisionen_gereift", anzahl=anzahl)
    return anzahl


def raenge_bewerten(db: Client, *, jetzt: datetime | None = None) -> dict[str, int]:
    from src.features.affiliates import stufen  # noqa: PLC0415
    from src.features.affiliates.mails import PartnerMails  # noqa: PLC0415

    return stufen.raenge_bewerten(db, jetzt=jetzt, mails=PartnerMails())


def klicks_aufraeumen(db: Client, *, jetzt: datetime | None = None) -> int:
    jetzt = jetzt or datetime.now(UTC)
    grenze = (jetzt - timedelta(days=KLICK_AUFBEWAHRUNG_TAGE)).isoformat()
    # Bewusst gescopet (nur alte Zeilen) — kein `delete` ohne `where`.
    res = db.table("affiliate_clicks").delete().lt("created_at", grenze).execute()
    anzahl = len(res.data or [])
    if anzahl:
        log.info("partner_klicks_aufgeraeumt", anzahl=anzahl)
    return anzahl


def auszahlungen_vorbereiten(db: Client, *, jetzt: datetime | None = None) -> dict[str, int]:
    from src.features.affiliates import auszahlung  # noqa: PLC0415

    return auszahlung.lauf_vorbereiten(db, jetzt=jetzt)


def referrals_ohne_objekt_halten(db: Client, *, jetzt: datetime | None = None) -> int:
    """Betrugsprüfung: eine bestätigte Zuordnung, deren Betrieb 30 Tage nach der
    Registrierung noch kein Objekt hat, wird angehalten (`no_property_30d`) —
    das Backoffice prüft. Eine Registrierung ohne Objekt verdient nichts,
    sie sieht nur so aus."""
    jetzt = jetzt or datetime.now(UTC)
    grenze = (jetzt - timedelta(days=30)).isoformat()
    refs = fetch_all_rows(
        db.table("affiliate_referrals")
        .select("id, tenant_id, flags")
        .eq("status", "approved")
        .lte("created_at", grenze)
    )
    kandidaten = [r for r in refs if "no_property_30d" not in (r.get("flags") or [])]
    if not kandidaten:
        return 0
    tenant_ids = sorted({r["tenant_id"] for r in kandidaten})
    mit_objekt: set[str] = set()
    for i in range(0, len(tenant_ids), 200):
        for p in fetch_all_rows(
            db.table("properties").select("tenant_id").in_("tenant_id", tenant_ids[i : i + 200])
        ):
            mit_objekt.add(p["tenant_id"])
    n = 0
    for r in kandidaten:
        if r["tenant_id"] in mit_objekt:
            continue
        db.table("affiliate_referrals").update(
            {"status": "held", "flags": [*(r.get("flags") or []), "no_property_30d"]}
        ).eq("id", r["id"]).execute()
        n += 1
    if n:
        log.info("partner_referrals_ohne_objekt_gehalten", anzahl=n)
    return n


def tick(db: Client, *, monatserster: bool) -> None:
    """Ein Worker-Tick: stündlich reifen, am Monatsersten bewerten/bündeln/aufräumen.

    Jeder Lauf isoliert — ein Fehler im einen kippt die anderen nicht, und
    keiner den Worker. Die Zeitsteuerung (Tick-Abstand, Tag) bleibt im Worker.
    """
    from src.jobs.partner_reichweite_laeufe import kanal_snapshots_ziehen  # noqa: PLC0415

    laeufe = [
        ("partner_reifen", provisionen_reifen),
        ("partner_referrals_ohne_objekt", referrals_ohne_objekt_halten),
        # Reichweite (0521): ein Snapshot je Kanal und Tag, Mindestabstand im Lauf.
        ("partner_kanal_snapshots", kanal_snapshots_ziehen),
    ]
    if monatserster:
        laeufe += [
            ("partner_raenge", raenge_bewerten),
            ("partner_auszahlungen", auszahlungen_vorbereiten),
            ("partner_klicks", klicks_aufraeumen),
        ]
    for name, lauf in laeufe:
        try:
            lauf(db)
        except Exception as exc:  # noqa: BLE001 — Tick darf den Worker nie killen
            log.warning(f"{name}_tick_failed", error=str(exc)[:200])
