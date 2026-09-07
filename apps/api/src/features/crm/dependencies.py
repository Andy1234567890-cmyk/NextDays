"""FastAPI-Dependencies des crm-Slices."""
from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import CrmService


def get_crm_service() -> CrmService:
    return CrmService(service_client=get_service_client())


CrmServiceDep = Annotated[CrmService, Depends(get_crm_service)]
