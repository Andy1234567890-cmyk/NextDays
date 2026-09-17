"""Dependencies des booking_access-Slice: Service-Factory."""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import BookingAccessService


def get_booking_access_service() -> BookingAccessService:
    # service_role: die Prüfung liest über Betriebsgrenzen hinweg (eine
    # Vorgeschichte entsteht nicht bei einem einzelnen Gastgeber). Der Scope
    # des SCHREIBENDEN Pfads kommt aus ctx.tenant_id (Wurzel 3); der lesende
    # Pfad gibt nichts heraus als „sofort oder Anfrage".
    return BookingAccessService(db=get_service_client())


BookingAccessServiceDep = Annotated[
    BookingAccessService, Depends(get_booking_access_service)
]
