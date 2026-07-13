"""DI für den property_dossier-Slice."""

from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import PropertyDossierService


def get_dossier_service() -> PropertyDossierService:
    return PropertyDossierService(client=get_service_client())


DossierServiceDep = Annotated[PropertyDossierService, Depends(get_dossier_service)]
