"""Dependencies des host_messages-Slice: Service + Zugriffs-Guards.

Autorisierung über das bestehende Posteingang-Permission-System (inbox/authz):
PM_CHAT = darf Posteingang nutzen, INBOX_REPLY = darf antworten,
INBOX_MANAGE_CONFIG = darf Vorlagen verwalten. Kein zweites System (Wurzel: keine
Krücken). Quelle der Wahrheit ist die DB (nicht das JWT).
"""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, status

from src.core.security import AuthContext, get_current_user
from src.core.supabase import get_service_client
from src.features.inbox.authz import InboxAccess, load_inbox_access

from .service import HostMessagesService


def get_host_messages_service() -> HostMessagesService:
    # service_role: guest_message_threads/guest_messages sind per RLS geschützt;
    # der Scope wird im Service über ctx.tenant_id erzwungen (Wurzel 3).
    return HostMessagesService(db=get_service_client())


HostMessagesServiceDep = Annotated[
    HostMessagesService, Depends(get_host_messages_service)
]


def require_inbox_access(
    ctx: Annotated[AuthContext, Depends(get_current_user)],
) -> AuthContext:
    """Darf den Plattform-Posteingang nutzen (PM_CHAT)."""
    access = load_inbox_access(get_service_client(), ctx)
    if not access.can_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Kein Posteingang-Zugriff."
        )
    return ctx


def require_reply(
    ctx: Annotated[AuthContext, Depends(get_current_user)],
) -> AuthContext:
    """Darf antworten (INBOX_REPLY)."""
    access = load_inbox_access(get_service_client(), ctx)
    if not access.can_reply:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Keine Antwort-Berechtigung."
        )
    return ctx


def require_config(
    ctx: Annotated[AuthContext, Depends(get_current_user)],
) -> AuthContext:
    """Darf Vorlagen verwalten (INBOX_MANAGE_CONFIG)."""
    access: InboxAccess = load_inbox_access(get_service_client(), ctx)
    if not access.can_manage_config:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Keine Berechtigung zur Vorlagen-Verwaltung.",
        )
    return ctx


AccessCtx = Annotated[AuthContext, Depends(require_inbox_access)]
ReplyCtx = Annotated[AuthContext, Depends(require_reply)]
ConfigCtx = Annotated[AuthContext, Depends(require_config)]
