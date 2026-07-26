"""Audit-Protokoll des Plattform-Backoffice.

JEDE Backoffice-Aktion wird protokolliert — auch lesende. Grund: das Einsehen
fremder Mandantendaten IST der Vorgang, der nachvollziehbar sein muss ("wer hat
in die Daten von Betrieb X geschaut?"). Das Log ist append-only; es gibt hier
bewusst keine Update-/Delete-Funktion.

Das Schreiben ist best-effort (Wurzel 5): ein fehlgeschlagener Log-Eintrag darf
den Hauptpfad nicht kippen — sonst wäre ein voller Log ein Totalausfall des
Backoffice. Fehler werden geloggt, nicht geworfen.
"""
from __future__ import annotations

from typing import Any

from fastapi import Request
from supabase import Client

from src.core.logging import get_logger
from src.core.security import PlatformContext

log = get_logger("nextdays.platform_admin.audit")


def _client_ip(request: Request | None) -> str | None:
    """Client-IP aus dem Request. Hinter Traefik steht die echte IP in
    X-Forwarded-For (erster Eintrag); ohne Proxy die direkte Peer-Adresse."""
    if request is None:
        return None
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def record(
    db: Client,
    ctx: PlatformContext,
    action: str,
    *,
    target_type: str | None = None,
    target_id: str | None = None,
    tenant_id: str | None = None,
    detail: dict[str, Any] | None = None,
    request: Request | None = None,
) -> None:
    """Eine Backoffice-Aktion protokollieren.

    `action` ist ein stabiler Punkt-Schlüssel ('tenant.view', 'property.approve',
    'photo.reject'), damit sich später gezielt filtern lässt.
    """
    try:
        db.table("platform_audit_log").insert(
            {
                "actor_user_id": ctx.user_id,
                "actor_email": ctx.email,
                "action": action,
                "target_type": target_type,
                "target_id": target_id,
                "tenant_id": tenant_id,
                "detail": detail or {},
                "ip": _client_ip(request),
                "user_agent": (
                    request.headers.get("user-agent") if request else None
                ),
            }
        ).execute()
    except Exception as exc:  # noqa: BLE001 — best effort, darf nie den Pfad kippen
        log.warning(
            "platform_audit_write_failed",
            action=action,
            actor=ctx.user_id,
            error=str(exc),
        )
