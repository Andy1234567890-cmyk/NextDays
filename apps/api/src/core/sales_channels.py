"""Vertriebskanäle — die EINE Wahrheit, welcher Kanal von einer Sperre betroffen ist.

NextDays verkauft über DREI gleichwertige Wege. Eine Sperre (Stop-Sell oder
availability-Block) darf nur den/die Kanäle treffen, für die sie gilt — nicht
blind alle. Diese Entscheidung liegt an EINEM Ort (nicht je Buchungspfad neu
erfunden — sonst driften die drei Enforcements auseinander, CLAUDE.md-Wurzel 3).

Kanal-Tokens:
  PLATFORM   = "platform"    eigene Plattform (booking_engine, /plattform)
  RECEPTION  = "reception"   Rezeption / Direktbuchung (reservations)
  OTA-Präfix = "ota:<code>"  ein einzelnes OTA (code = channex ota_portal_code)
  OTA-Wild   = "ota:*"       alle OTAs gesammelt

Zwei Sperr-Ebenen, beide hier entschieden:
  A) stop_sell.scope/channels (Migration 0145): explizite Kanal-Liste je Zeile.
  B) availability.status='blocked' mit source: eine 'portal'-Sperre (Channex-
     Import) betrifft NUR OTAs; 'manual'/'ical'/eine Buchung betrifft alle Wege
     (echte Belegung — Überbuchungsschutz).
"""
from __future__ import annotations

from typing import Any

PLATFORM = "platform"
RECEPTION = "reception"
OTA_WILDCARD = "ota:*"
OTA_PREFIX = "ota:"


def is_ota_token(channel: str) -> bool:
    """True für einen OTA-Kanal-Token (ota:<code> oder ota:*)."""
    return channel.startswith(OTA_PREFIX)


def stop_sell_blocks_channel(row: dict[str, Any], channel: str) -> bool:
    """Blockiert diese stop_sell-Zeile den gegebenen Kanal?

    scope='all' (Default, auch Altdaten) → alle Kanäle. scope='channels' → nur die
    in channels[] genannten; ein OTA-Kanal wird zusätzlich von 'ota:*' getroffen.
    Fail-closed (Wurzel 5): fehlendes/unbekanntes scope wie 'all' behandeln — ein
    Verkaufsstopp sperrt im Zweifel zu viel, nie zu wenig (Doppelbuchung wäre der
    teurere Fehler)."""
    scope = row.get("scope") or "all"
    if scope != "channels":
        return True
    channels = row.get("channels") or []
    if channel in channels:
        return True
    return is_ota_token(channel) and OTA_WILDCARD in channels


def availability_block_hits_channel(source: str | None, channel: str) -> bool:
    """Blockiert eine availability-Sperre (status != 'open') den gegebenen Kanal?

    source='portal' (aus dem Channex-Import gespiegelt) betrifft NUR OTAs — die
    eigene Plattform und die Rezeption bleiben buchbar. Jede andere Herkunft
    ('manual', 'ical', 'booking'/echte Buchung, None) ist echte Belegung/Sperre
    über alle Wege (Überbuchungsschutz, fail-closed)."""
    if source == "portal":
        return is_ota_token(channel)
    return True
