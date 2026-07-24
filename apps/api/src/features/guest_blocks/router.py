"""Router für guest_blocks. Gemountet unter /api/v1/guest-blocks.

Blockierte Personen (Airbnb „Konto → Datenschutz → Nachrichten → Blockierte
Personen", Artikel 4046). Nur admin/co_admin (VIEW_GUEST_FULL) dürfen die Liste
sehen und blockieren/entblocken — owner/staff/cleaner haben keinen Namens-/
Vertriebseinblick (§4.2/§4.3, Wurzel 9). Der Scope steckt serverseitig in
ctx.tenant_id (kein Client-Parameter).
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from src.core.security import AuthContext
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from .dependencies import GuestBlockServiceDep
from .schemas import BlockedGuest, BlockGuestRequest
from .service import GuestBlockError

router = APIRouter(prefix="/guest-blocks", tags=["guest-blocks"])

# Nur Rollen mit vollem Gast-Einblick dürfen blockieren/verwalten.
_ManageCtx = Annotated[
    AuthContext, Depends(require_permission(Capability.VIEW_GUEST_FULL))
]


@router.get("", response_model=list[BlockedGuest])
def list_blocked(
    ctx: _ManageCtx, service: GuestBlockServiceDep
) -> list[BlockedGuest]:
    """Blockierte Gäste des Betriebs (mit Anzeigename/E-Mail)."""
    return service.list_blocked(ctx)


@router.post("", response_model=BlockedGuest, status_code=status.HTTP_201_CREATED)
def block_guest(
    req: BlockGuestRequest, ctx: _ManageCtx, service: GuestBlockServiceDep
) -> BlockedGuest:
    """Einen Plattform-Gast blockieren (idempotent)."""
    try:
        return service.block(ctx, req.portal_guest_id, req.reason)
    except GuestBlockError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.delete("/{portal_guest_id}", status_code=status.HTTP_204_NO_CONTENT)
def unblock_guest(
    portal_guest_id: str, ctx: _ManageCtx, service: GuestBlockServiceDep
) -> None:
    """Einen Gast entblocken (macht die Blockwirkung rückgängig)."""
    try:
        service.unblock(ctx, portal_guest_id)
    except GuestBlockError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
