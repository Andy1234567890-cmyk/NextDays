"""AES-GCM für sensible Felder der Personalakte (0541).

Steuer-ID, Sozialversicherungsnummer und IBAN liegen in `personal_akten` nur
verschlüsselt (`*_enc`). Der Schlüssel kommt aus `PERSONAL_AKTE_KEY` (32 Byte,
base64). Fehlt er, werfen beide Richtungen 503 — fail-closed (Wurzel 5): kein
Klartext in der DB, kein stilles Leerfeld in der Anzeige.

Dasselbe Muster wie `affiliates/kanal_krypto.py`, bewusst nicht dorthin
importiert: ein eigener Schlüssel je Fachgebiet, damit ein kompromittierter
Partner-Schlüssel nicht die Personalakten öffnet.
"""

from __future__ import annotations

import base64
import os

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from src.core.config import Settings, get_settings
from src.core.logging import get_logger

log = get_logger("nextdays.personal.krypto")

_NONCE_LEN = 12
_SICHTBAR = 4


class AkteKryptoFehler(Exception):
    """Schlüssel fehlt/ungültig oder Wert unlesbar — vom Router auf 503/409 gemappt."""

    def __init__(self, message: str, *, status_code: int) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _schluessel(settings: Settings) -> bytes:
    roh = settings.personal_akte_key.get_secret_value().strip()
    if not roh:
        log.error(
            "personal_akte_key_fehlt",
            hinweis="PERSONAL_AKTE_KEY setzen (32 Byte base64) — ohne ihn keine Akte.",
        )
        raise AkteKryptoFehler("Personalakte nicht konfiguriert.", status_code=503)
    try:
        key = base64.b64decode(roh, validate=True)
    except (ValueError, TypeError) as exc:
        log.error("personal_akte_key_ungueltig", grund="kein base64")
        raise AkteKryptoFehler("Personalakte nicht konfiguriert.", status_code=503) from exc
    if len(key) != 32:
        log.error("personal_akte_key_ungueltig", grund=f"{len(key)} Byte statt 32")
        raise AkteKryptoFehler("Personalakte nicht konfiguriert.", status_code=503)
    return key


def verschluesseln(klartext: str, settings: Settings | None = None) -> str:
    """base64(nonce || ciphertext+tag)."""
    key = _schluessel(settings or get_settings())
    nonce = os.urandom(_NONCE_LEN)
    ct = AESGCM(key).encrypt(nonce, klartext.encode("utf-8"), None)
    return base64.b64encode(nonce + ct).decode("ascii")


def entschluesseln(wert: str, settings: Settings | None = None) -> str:
    key = _schluessel(settings or get_settings())
    try:
        roh = base64.b64decode(wert, validate=True)
        nonce, ct = roh[:_NONCE_LEN], roh[_NONCE_LEN:]
        return AESGCM(key).decrypt(nonce, ct, None).decode("utf-8")
    except (ValueError, TypeError, InvalidTag) as exc:
        log.error("personal_akte_feld_unlesbar")
        raise AkteKryptoFehler(
            "Gespeicherter Wert unlesbar — Feld bitte neu erfassen.", status_code=409
        ) from exc


def maskieren(klartext: str | None) -> str | None:
    """Für die Anzeige: alles außer den letzten vier Zeichen durch • ersetzen."""
    if not klartext:
        return None
    kompakt = klartext.replace(" ", "")
    if len(kompakt) <= _SICHTBAR:
        return "•" * len(kompakt)
    return "•" * (len(kompakt) - _SICHTBAR) + kompakt[-_SICHTBAR:]
