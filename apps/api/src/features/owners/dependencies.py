"""Dependencies des owners-Slice: Service-Factory."""
from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import OwnersService


def get_owners_service() -> OwnersService:
    return OwnersService(service_client=get_service_client())


OwnersServiceDep = Annotated[OwnersService, Depends(get_owners_service)]
