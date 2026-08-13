"""Dependencies des addons-Slice: Service-Factory."""
from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import AddonsService
from .zahlung import AddonZahlungService


def get_addons_service() -> AddonsService:
    return AddonsService(service_client=get_service_client())


AddonsServiceDep = Annotated[AddonsService, Depends(get_addons_service)]


def get_addon_zahlung_service() -> AddonZahlungService:
    # service_role: addon_payment_links ist für Clients gesperrt (0386, Wurzel 6).
    # Der Scope kommt ausschließlich aus ctx.tenant_id.
    return AddonZahlungService(service_client=get_service_client())


AddonZahlungServiceDep = Annotated[
    AddonZahlungService, Depends(get_addon_zahlung_service)
]
