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


# ── Wer nimmt bei einer Buchung eine Provision? (`reservations.channel`) ──────
#
# Diese Frage stellen vier Slices, und sie stand bisher dreimal getrennt im
# Code: `subscriptions.EXTERNAL_CHANNELS`, `payments._OTA_CHANNELS` (beide
# wortgleich) und `payments._PORTAL_CHANNELS`. Drei Kopien derselben Fachregel
# driften bei der ersten Änderung auseinander — und dann rechnet die
# Eigentümer-Abrechnung mit einer anderen Kanalmenge als die Fakturierung
# (CLAUDE.md Wurzel 1/4).
#
# Die Werte sind genau die von `ReservationChannel` (reservations/schemas.py),
# durchgesetzt vom DB-Enum `reservation_channel`. Schreibvarianten wie
# „BookingCom" stehen in `reservations.ota_name` (Anzeigename des Portals),
# NICHT im Kanal — live geprüft am 07.09.2026: 1000 Buchungen, ausschließlich
# booking/airbnb/vrbo/portal/direct/website. Hier deshalb keine Varianten
# aufnehmen: eine Menge, die Werte behauptet, die die Spalte nicht annehmen
# kann, verschleiert nur, wo normalisiert werden müsste.

# Fremde Portale: der Gast zahlt dort, das Portal behält seinen Abzug ein und
# zahlt den Betrieb aus. Für sie MUSS ein Abzug bekannt sein — gemeldet oder
# als Satz hinterlegt.
FREMDE_PORTALE = frozenset({"booking", "airbnb", "vrbo", "ota_other"})

# Unser eigener Marktplatz myBestDays: gleichrangiger Buchungskanal MIT
# Provision (Preisliste §2: 8 % all-in) — gehört deshalb NICHT zu den
# abzugsfreien Kanälen, auch wenn er uns gehört.
EIGENER_MARKTPLATZ = frozenset({"portal"})

# Eigene Wege des Betriebs: seine Website, Telefon, E-Mail, vor Ort, manuell
# erfasst. Hier steht KEIN Portal zwischen Gast und Betrieb, es gibt also
# nichts einzubehalten — der Portal-Abzug ist bekannt 0, kein fehlender Wert.
# Die Provision des BETRIEBS gegenüber dem Eigentümer fällt trotzdem an; die
# hängt am Verwaltungsvertrag, nicht am Kanal.
EIGENE_KANAELE = frozenset({"direct", "website"})


def normalisiere_kanal(kanal: object) -> str:
    """Kanalwert einer Buchung auf die Vergleichsform bringen (klein, getrimmt)."""
    return str(kanal or "").strip().lower()


def ohne_portal_abzug(kanal: object) -> bool:
    """Bucht dieser Kanal OHNE fremden Portal-Abzug?

    True nur für die eigenen Wege des Betriebs (`EIGENE_KANAELE`). Fail-closed
    (Wurzel 5): ein unbekannter oder fehlender Kanal gilt als portalbehaftet,
    damit ein Tippfehler im Kanal nicht stillschweigend den Portal-Anteil als
    Ertrag an den Eigentümer auszahlt.
    """
    return normalisiere_kanal(kanal) in EIGENE_KANAELE
