"""Reichweiten-Lauf des Partnerprogramms (0521) — Fachlauf ohne Zeitsteuerung.

Wird aus `partner_laeufe.tick` (stündlich) aufgerufen; der Mindestabstand
sorgt dafür, dass je verbundenem Konto EIN Snapshot je Tag entsteht und
fehlgeschlagene Abrufe stündlich erneut versucht werden. Erneuert Token vor
Ablauf, setzt `revoked_at` bei entzogenem Zugriff und informiert den Partner
per Mail (kanal_verbindungen.synchronisieren).
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import TYPE_CHECKING

from src.core.config import get_settings

if TYPE_CHECKING:
    from supabase import Client

# Ein Snapshot je Tag: alles unter 20 h seit dem letzten Erfolg wird übersprungen.
SNAPSHOT_MINDESTABSTAND = timedelta(hours=20)


def kanal_snapshots_ziehen(db: Client, *, jetzt: datetime | None = None) -> dict[str, int]:
    from src.features.affiliates import kanal_verbindungen  # noqa: PLC0415

    return kanal_verbindungen.synchronisieren(
        db, get_settings(), jetzt=jetzt, mindestabstand=SNAPSHOT_MINDESTABSTAND
    )
