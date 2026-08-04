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


def connection_settings(settings: dict[str, Any] | None) -> dict[str, Any]:
    """Channex-Defaults für die Airbnb-`connection_link`-settings (snake_case).

    Nur Felder, die der connection_link-Endpunkt kennt — keine erfundenen Werte;
    `email` nur wenn vom Aufrufer gesetzt."""
    src = settings or {}
    out: dict[str, Any] = {
        "booking_amount_settings": src.get("booking_amount_settings")
        or "Payout Amount",
        "cohost_payout_calculations": bool(
            src.get("cohost_payout_calculations", False)
        ),
        "min_stay_type": src.get("min_stay_type") or "Arrival",
        "send_email_notifications": bool(src.get("send_email_notifications", False)),
    }
    if src.get("email"):
        out["email"] = src["email"]
    return out


def connection_link_body(
    *,
    group_id: str,
    channex_property_id: str | None,
    channel_id: str,
    title: str,
    settings: dict[str, Any] | None,
) -> dict[str, Any]:
    """Body für POST /meta/airbnb/connection_link. `request_id` = channel_id
    (Korrelation; wir pollen den Status ohnehin über den Channel).

    `channex_property_id` ist optional: beim Airbnb-Connect eines
    Wechselkunden gibt es noch kein Objekt — seine Listings sollen ja erst
    übernommen werden. `properties` bleibt dann ganz weg statt `[null]` zu
    enthalten (das wäre für Channex ein Bad Request)."""
    body: dict[str, Any] = {
        "group_id": group_id,
        "channel_id": channel_id,
        "title": title,
        "request_id": channel_id,
        "settings": connection_settings(settings),
    }
    if channex_property_id:
        body["properties"] = [channex_property_id]
    return body


def parse_connection_status(channel: dict[str, Any]) -> dict[str, Any]:
    """Verbindungsstatus aus einem get_channel-Ergebnis lesen.

    Liefert {connected, host_id, last_error}:
    - host_id = settings.tokens.user_id (None, solange nicht autorisiert);
    - connected = host_id vorhanden UND Token nicht als ungültig markiert;
    - last_error = Hinweis, falls token_invalid (Re-Auth nötig)."""
    settings = (
        (channel.get("data") or {}).get("attributes") or {}
    ).get("settings") or {}
    tokens = settings.get("tokens")
    host_id = tokens.get("user_id") if isinstance(tokens, dict) else None
    token_invalid = bool(settings.get("token_invalid"))
    connected = bool(host_id) and not token_invalid
    last_error = (
        "Airbnb-Token ungültig — bitte neu verbinden." if token_invalid else None
    )
    return {"connected": connected, "host_id": host_id, "last_error": last_error}
