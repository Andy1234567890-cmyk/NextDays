"""DI für den property_dossier-Slice."""

from typing import Annotated

from fastapi import Depends

from src.core.security import CurrentUser
from src.core.supabase import get_service_client

from .service import PropertyDossierService


def get_dossier_service(ctx: CurrentUser) -> PropertyDossierService:
    """Service je Request, MIT Auth-Kontext.

    Der Kontext hängt am Service (nicht an jedem der ~24 Aufrufe), damit
    `_require_own_property` den Rollen-Scope zentral erzwingen kann und keine
    einzelne Methode ihn vergessen kann (Wurzel 3: Load und Scope nicht trennen).
    """
    return PropertyDossierService(client=get_service_client(), ctx=ctx)


DossierServiceDep = Annotated[PropertyDossierService, Depends(get_dossier_service)]
