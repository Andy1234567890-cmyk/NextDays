"""Dependencies des affiliates-Slice: Service-Factory (Muster guest_auth)."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_anon_client, get_service_client

from .service import AffiliatesService


def get_affiliates_service() -> AffiliatesService:
    # anon: GoTrue-Login/Refresh/Reset. service: alle Partner-Tabellen sind für
    # anon/authenticated gesperrt (0517, Wurzel 6); der Scope kommt im Service
    # ausschließlich aus dem Token (affiliate_id) bzw. dem Backoffice-Guard.
    return AffiliatesService(
        anon_client=get_anon_client(),
        service_client=get_service_client(),
    )


AffiliatesServiceDep = Annotated[AffiliatesService, Depends(get_affiliates_service)]
