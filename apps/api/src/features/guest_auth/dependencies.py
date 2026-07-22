"""Dependencies des guest_auth-Slice: Service-Factory (Muster wie auth)."""
from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_anon_client, get_service_client

from .service import GuestAuthService


def get_guest_auth_service() -> GuestAuthService:
    return GuestAuthService(
        anon_client=get_anon_client(),
        service_client=get_service_client(),
    )


GuestAuthServiceDep = Annotated[GuestAuthService, Depends(get_guest_auth_service)]
