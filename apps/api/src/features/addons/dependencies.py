"""Dependencies des addons-Slice: Service-Factory."""
from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import AddonsService


def get_addons_service() -> AddonsService:
    return AddonsService(service_client=get_service_client())


AddonsServiceDep = Annotated[AddonsService, Depends(get_addons_service)]
