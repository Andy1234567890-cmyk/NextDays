"""Zugang zur Teststufe.

Die echte Behoerde verlangt eine Anmeldung bei TastSelv Erhverv mit
MitID. Hier genuegt ein gemeinsames Geheimnis — aber es ist PFLICHT:
Eine offene Empfangsstelle im Netz waere eine Einladung, echte
Steuerdaten irgendwohin hochzuladen.

Der Vergleich laeuft byteweise ueber `secrets.compare_digest`. Ein
`==` auf Zeichenketten bricht beim ersten falschen Zeichen ab und
verraet ueber die Antwortzeit, wie viele Zeichen stimmten.
"""
from __future__ import annotations

import secrets

from fastapi import Header, HTTPException, status

from .config import get_settings


def zugang_pruefen(
    x_staging_token: str | None = Header(default=None),
) -> None:
    """Fail-closed: ohne gueltiges Token keine Einreichung."""
    erwartet = get_settings().staging_token
    if not x_staging_token or not secrets.compare_digest(
        x_staging_token, erwartet
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                "Kein gueltiger Zugang zur Teststufe. Der Kopf "
                "X-Staging-Token fehlt oder stimmt nicht."
            ),
        )
