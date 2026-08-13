"""Dependencies des public_portal-Slice: Service-Factory."""
from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .dienstleistungen import DienstleistungsService
from .familie import OwnerFamilyService
from .service import PublicPortalService


def get_public_portal_service() -> PublicPortalService:
    return PublicPortalService(service_client=get_service_client())


PublicPortalServiceDep = Annotated[
    PublicPortalService, Depends(get_public_portal_service)
]


def get_owner_family_service() -> OwnerFamilyService:
    return OwnerFamilyService(service_client=get_service_client())


OwnerFamilyServiceDep = Annotated[
    OwnerFamilyService, Depends(get_owner_family_service)
]


def get_dienstleistungs_service() -> DienstleistungsService:
    return DienstleistungsService(service_client=get_service_client())


DienstleistungsServiceDep = Annotated[
    DienstleistungsService, Depends(get_dienstleistungs_service)
]
