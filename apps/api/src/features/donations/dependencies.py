"""Dependencies des donations-Slice: Service-Factory."""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import DonationsService


def get_donations_service() -> DonationsService:
    # service_role: donations und tenant_donation_settings sind für Clients
    # schreibgesperrt (0216) — wer dort schreiben könnte, würde den eigenen
    # Spendensatz an der Prüfung vorbei setzen. Der Scope kommt im Service
    # ausschließlich aus ctx.tenant_id (Wurzel 3).
    return DonationsService(db=get_service_client())


DonationsServiceDep = Annotated[DonationsService, Depends(get_donations_service)]
