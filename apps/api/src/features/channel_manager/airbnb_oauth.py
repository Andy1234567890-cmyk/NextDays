"""Reine Airbnb-OAuth-Helfer (white-label, ohne iFrame) — DB-/Client-frei.

Hält die Payload-Konstruktion und das Antwort-Parsing für den Airbnb-OAuth-Flow
aus dem God-Service heraus (analog content_builder.py). Die tenant-gescopten
DB-/Channex-Aufrufe bleiben im Service; hier liegen nur die reinen Transformationen.

Verifiziert live gegen Channex-Staging + SPA-Bundle (docs/CHANNEX-FELDER.md §4a):
- connection_link-Body ist snake_case, gewrappt in {"connection_link": {...}}.
- Verbindungsstatus/Host-ID stehen in channel.attributes.settings:
  settings.tokens.user_id (= Host-ID), settings.token_invalid (= Re-Auth nötig).
"""
from __future__ import annotations

from typing import Any

# Die zwei von Airbnb erlaubten Betragsarten („Airbnb Connection API",
# `booking_amount_settings`). Allowlist statt Durchreichen: ein Tippfehler hier
# entscheidet über JEDEN Buchungsbetrag dieses Kanals.
BETRAG_GESAMT_BEZAHLT = "Total Paid Amount"
BETRAG_AUSZAHLUNG = "Payout Amount"
BETRAGSARTEN: frozenset[str] = frozenset({BETRAG_GESAMT_BEZAHLT, BETRAG_AUSZAHLUNG})

# Airbnbs zwei erlaubten Mindestaufenthalts-Arten. Airbnb kennt nur EINE Art je
# Kanal — „beides" gibt es dort nicht.
MIN_STAY_ANREISE = "Arrival"
MIN_STAY_DURCHGEHEND = "Through"
MIN_STAY_ARTEN: frozenset[str] = frozenset({MIN_STAY_ANREISE, MIN_STAY_DURCHGEHEND})


def connection_settings(settings: dict[str, Any] | None) -> dict[str, Any]:
    """Channex-Defaults für die Airbnb-`connection_link`-settings (snake_case).

    Nur Felder, die der connection_link-Endpunkt kennt — keine erfundenen Werte;
    `email` nur wenn vom Aufrufer gesetzt.

    WARUM `Total Paid Amount` (und nicht `Payout Amount`):
    Airbnb lässt beides zu und beschreibt es als „type of total amount what will
    be saved at Bookings". Der Unterschied ist keine Formsache, sondern eine
    andere ZAHL: `Payout Amount` ist der Betrag NACH Abzug der Airbnb-Host-Fee,
    `Total Paid Amount` das, was der Gast bezahlt hat.

    Unser gesamter Geldpfad behandelt `attrs["amount"]` als Bruttobetrag: er wird
    bei portal-kassierten Buchungen als `paid_amount` verbucht („der Gast hat das
    bezahlt"), unsere Provision rechnet darauf (`gross_amount`), und in der
    Eigentümer-Abrechnung sowie der Buchungsansicht werden Portalgebühren davon
    noch ABGEZOGEN. Mit `Payout Amount` wäre der Wert bereits netto — die
    Host-Fee würde doppelt abgezogen und unsere eigene Provision zu niedrig
    fakturiert. Deshalb bestellen wir den Bruttobetrag; die Airbnb-Gebühr kommt
    getrennt über `ota_commission` (siehe `bookings_sync`).

    Nebenwirkung, die dazugehört: `Total Paid Amount` zählt in `tax_regime` zu
    den Werten, bei denen die Steuern IM Betrag enthalten sind. Das ist genau die
    Lesart, die zum Bruttobetrag passt.
    """
    src = settings or {}
    betrag = src.get("booking_amount_settings") or BETRAG_GESAMT_BEZAHLT
    if betrag not in BETRAGSARTEN:
        erlaubt = ", ".join(sorted(BETRAGSARTEN))
        raise ValueError(
            f"booking_amount_settings {betrag!r} kennt Airbnb nicht. "
            f"Erlaubt: {erlaubt}"
        )
    min_stay = src.get("min_stay_type") or MIN_STAY_ANREISE
    if min_stay not in MIN_STAY_ARTEN:
        erlaubt = ", ".join(sorted(MIN_STAY_ARTEN))
        raise ValueError(
            f"min_stay_type {min_stay!r} kennt Airbnb nicht. Erlaubt: {erlaubt}"
        )
    out: dict[str, Any] = {
        "booking_amount_settings": betrag,
        "cohost_payout_calculations": bool(
            src.get("cohost_payout_calculations", False)
        ),
        "min_stay_type": min_stay,
        "send_email_notifications": bool(src.get("send_email_notifications", False)),
    }
    # Airbnbs Dokument: `email` ist Pflicht, sobald Benachrichtigungen an sind.
    # Fail-closed statt einer Verbindung, die Channex still ablehnt (Wurzel 5).
    if out["send_email_notifications"] and not src.get("email"):
        raise ValueError(
            "send_email_notifications=true verlangt eine E-Mail-Adresse."
        )
    if src.get("email"):
        out["email"] = src["email"]
    return out


def connection_link_body(
    *,
    group_id: str,
    channex_property_id: str,
    channel_id: str,
    request_id: str,
    title: str,
    settings: dict[str, Any] | None,
) -> dict[str, Any]:
    """Body für POST /meta/airbnb/connection_link.

    `request_id` und `channel_id` sind ZWEI VERSCHIEDENE Dinge — das war ein
    echter Fehler: wir haben beide auf die Kanal-ID gesetzt, und die
    Autorisierung kam bei Channex nie am Kanal an (alle Kanäle blieben mit
    `settings: []` und ohne Tokens zurück, obwohl Airbnb "Channex" als
    verbundenen Dienst führte).

    So macht es Channex' eigene Maske (Bundle index-BefbhQp2.js, 04.08.2026):
        useEffect(() => { setRequestId(uuid()) }, [])     // frische UUID
        body = { groupId, properties, ...(channelId ? {channelId} : {}),
                 title, requestId, settings }
    Danach hört sie auf dem WebSocket `group:<group_id>` auf die Events
    `channel_created` / `channel_not_created` und vergleicht deren
    `request_id` mit der eigenen — daran ordnet Channex die Rückmeldung zu.
    Die `request_id` ist also ein Korrelations-Token für DIESEN Versuch, keine
    Objekt-/Kanal-Referenz.

    `channel_id` gehört nur dazu, wenn der Kanal bereits existiert (bei uns
    immer, weil wir ihn vorher anlegen).
    """
    return {
        "group_id": group_id,
        "channel_id": channel_id,
        "title": title,
        "request_id": request_id,
        "properties": [channex_property_id],
        "settings": connection_settings(settings),
    }


def parse_connection_status(channel: dict[str, Any]) -> dict[str, Any]:
    """Verbindungsstatus aus einem get_channel-Ergebnis lesen.

    Liefert {connected, host_id, last_error}:
    - host_id = settings.tokens.user_id (None, solange nicht autorisiert);
    - connected = host_id vorhanden UND Token nicht als ungültig markiert;
    - last_error = der GRUND, wenn es nicht verbunden ist.

    `settings is None` und `settings == {}` sind ZWEI VERSCHIEDENE Zustände und
    werden getrennt gemeldet (Wurzel 5) — vorher liefen beide in
    `last_error=None`, und die UI zeigte in beiden Fällen nur „warte auf
    Bestätigung", ohne je einen Grund zu nennen:
      * `settings is None`  → Channex hat den Kanal seit der Anlage nicht
        angefasst; die Autorisierung ist dort NIE angekommen. Live belegt an
        einem Kanal, dessen `updated_at` gleich `inserted_at` blieb, während
        Airbnb „Channex" als verbundenen Dienst führte. Häufigste Ursache laut
        Channex-Support: am Airbnb-Konto hängt noch eine andere Software —
        Airbnb erlaubt nur EINE (Channex-Fehlercode `has_already_channel`,
        „This Airbnb user is already connected").
      * `settings == {}`    → angekommen, aber ohne Tokens: die Autorisierung
        wurde abgebrochen oder abgelehnt.
    """
    attrs = (channel.get("data") or {}).get("attributes") or {}
    settings_roh = attrs.get("settings")
    settings = settings_roh or {}
    tokens = settings.get("tokens")
    host_id = tokens.get("user_id") if isinstance(tokens, dict) else None
    token_invalid = bool(settings.get("token_invalid"))
    connected = bool(host_id) and not token_invalid

    if token_invalid:
        last_error = "Airbnb-Token ungültig — bitte neu verbinden."
    elif connected:
        last_error = None
    elif settings_roh is None:
        last_error = (
            "Airbnb hat die Verbindung nicht an den Kanal übergeben. Das "
            "passiert, wenn in deinem Airbnb-Konto bereits eine andere Software "
            "verbunden ist — Airbnb erlaubt nur EINE. Entferne sie dort unter "
            "Konto → Datenschutz und Freigabe → Verbundene Dienste und verbinde "
            "danach hier erneut."
        )
    else:
        last_error = (
            "Die Autorisierung bei Airbnb wurde nicht abgeschlossen. Öffne den "
            "Link erneut und bestätige den Zugriff."
        )
    return {"connected": connected, "host_id": host_id, "last_error": last_error}
