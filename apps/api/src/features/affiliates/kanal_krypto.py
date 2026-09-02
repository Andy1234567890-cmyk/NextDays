"""Verschlüsselung der Partner-Token und Signatur des OAuth-`state` (0521).

EIN Schlüssel (`AFFILIATE_TOKEN_KEY`, 32 Byte base64) für beides:
  * AES-GCM für access/refresh_token in `affiliate_channel_connections` —
    anders als whatsapp_account (0255, Klartext hinter dem Grant-Entzug), weil
    hier Zugänge zu FREMDEN Konten von Privatpersonen liegen; ein Tabellen-
    Dump darf nicht reichen.
  * HMAC-SHA256 über den `state` des OAuth-Starts, damit der Callback
    beweisen kann, dass GENAU DIESER Partner den Vorgang begonnen hat (CSRF/
    Login-Fixierung). Zustandslos: kein Nonce-Speicher, dafür 15 Minuten
    Gültigkeit.

Fehlt der Schlüssel: fail-closed (503) und ein ERROR im Log — nie ein
Klartext-Fallback (Wurzel 4/5).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from typing import Any

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from src.core.config import Settings
from src.core.logging import get_logger

from .fehler import AffiliateError

log = get_logger("nextdays.affiliates")

STATE_GUELTIG_SEKUNDEN = 15 * 60
_NONCE_LEN = 12


def schluessel(settings: Settings) -> bytes:
    roh = settings.affiliate_token_key.get_secret_value().strip()
    if not roh:
        log.error(
            "affiliate_token_key_fehlt",
            hinweis="AFFILIATE_TOKEN_KEY setzen (32 Byte base64) — ohne ihn keine Kanalanbindung.",
        )
        raise AffiliateError("Kanalanbindung nicht konfiguriert.", status_code=503)
    try:
        key = base64.b64decode(roh, validate=True)
    except (ValueError, TypeError) as exc:
        log.error("affiliate_token_key_ungueltig", grund="kein base64")
        raise AffiliateError("Kanalanbindung nicht konfiguriert.", status_code=503) from exc
    if len(key) != 32:
        log.error("affiliate_token_key_ungueltig", grund=f"{len(key)} Byte statt 32")
        raise AffiliateError("Kanalanbindung nicht konfiguriert.", status_code=503)
    return key


def verschluesseln(settings: Settings, klartext: str) -> str:
    """base64(nonce || ciphertext+tag)."""
    key = schluessel(settings)
    nonce = os.urandom(_NONCE_LEN)
    ct = AESGCM(key).encrypt(nonce, klartext.encode("utf-8"), None)
    return base64.b64encode(nonce + ct).decode("ascii")


def entschluesseln(settings: Settings, wert: str) -> str:
    key = schluessel(settings)
    try:
        roh = base64.b64decode(wert, validate=True)
        nonce, ct = roh[:_NONCE_LEN], roh[_NONCE_LEN:]
        return AESGCM(key).decrypt(nonce, ct, None).decode("utf-8")
    except (ValueError, TypeError, InvalidTag) as exc:
        # Falscher Schlüssel oder manipulierte Zeile — das Token ist unbrauchbar,
        # die Verbindung muss neu aufgebaut werden. Laut, nicht still.
        log.error("affiliate_token_unlesbar")
        raise AffiliateError(
            "Gespeichertes Token unlesbar — Konto bitte neu verbinden.", status_code=409
        ) from exc


# --- OAuth-state ---------------------------------------------------------------------


def _b64u(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode("ascii")


def _unb64u(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def _sig(key: bytes, payload: bytes) -> bytes:
    return hmac.new(hashlib.sha256(key + b"|state").digest(), payload, hashlib.sha256).digest()


def state_erzeugen(settings: Settings, *, affiliate_id: str, provider: str) -> str:
    key = schluessel(settings)
    payload = json.dumps(
        {
            "a": affiliate_id,
            "p": provider,
            "exp": int(time.time()) + STATE_GUELTIG_SEKUNDEN,
            "n": _b64u(os.urandom(8)),
        },
        separators=(",", ":"),
    ).encode("utf-8")
    return f"{_b64u(payload)}.{_b64u(_sig(key, payload))}"


def state_pruefen(
    settings: Settings, state: str, *, affiliate_id: str, provider: str
) -> dict[str, Any]:
    """Signatur, Ablauf, Partner und Anbieter müssen passen — sonst 400.

    Byteweiser Vergleich (`hmac.compare_digest`), damit angreiferkontrollierter
    Input keinen Timing-Kanal öffnet und nie einen 500 wirft (Wurzel 5).
    """
    key = schluessel(settings)
    try:
        payload_b64, sig_b64 = state.split(".", 1)
        payload = _unb64u(payload_b64)
        if not hmac.compare_digest(_sig(key, payload), _unb64u(sig_b64)):
            raise ValueError("Signatur")
        daten = json.loads(payload)
    except (ValueError, TypeError, json.JSONDecodeError) as exc:
        raise AffiliateError(
            "OAuth-Zustand ungültig — bitte erneut verbinden.", status_code=400
        ) from exc
    if int(daten.get("exp", 0)) < time.time():
        raise AffiliateError("OAuth-Zustand abgelaufen — bitte erneut verbinden.", status_code=400)
    if daten.get("a") != affiliate_id or daten.get("p") != provider:
        raise AffiliateError("OAuth-Zustand gehört zu einem anderen Vorgang.", status_code=400)
    return daten
