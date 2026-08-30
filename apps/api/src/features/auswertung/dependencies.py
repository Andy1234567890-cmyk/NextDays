"""Dependencies des auswertung-Slice: Service-Factory."""
from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import AuswertungService


def get_auswertung_service() -> AuswertungService:
    return AuswertungService(get_service_client())


AuswertungServiceDep = Annotated[AuswertungService, Depends(get_auswertung_service)]
