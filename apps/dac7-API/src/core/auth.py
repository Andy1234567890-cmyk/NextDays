"""Wer bei diesem Dienst einreichen darf.

Nur das PMS. Es ruft serverseitig auf und weist sich mit einem
gemeinsamen Geheimnis aus.

Fail-closed und byteweiser Vergleich: Ein offener Versanddienst wuerde
jedem erlauben, in unserem Namen etwas an die Steuerbehoerde zu senden —
das ist der Grund, warum dieser Dienst ueberhaupt getrennt laeuft.
"""
from __future__ import annotations

import secrets

from fastapi import Header, HTTPException, status

from .config import get_settings


def zugang_pruefen(x_versand_token: str | None = Header(default=None)) -> None:
    erwartet = get_settings().versand_token
    if not x_versand_token or not secrets.compare_digest(x_versand_token, erwartet):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Kein gueltiger Zugang. Der Kopf X-Versand-Token fehlt oder stimmt nicht.",
        )
