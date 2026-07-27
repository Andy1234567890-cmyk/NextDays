"""Dependencies des taxpayer-Slice: Service-Factory."""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .objektangaben import ObjektangabenService
from .regime import RegimeService
from .service import TaxpayerService


def get_taxpayer_service() -> TaxpayerService:
    # service_role: taxpayer_info ist per RLS + revoke für Nicht-service_role
    # gesperrt; der Tenant-Scope wird im Service erzwungen (Wurzel 3).
    return TaxpayerService(db=get_service_client())


def get_objektangaben_service() -> ObjektangabenService:
    # Liest properties und reservations mandantenweit — der Scope kommt aus
    # ctx.tenant_id im Service, nicht aus der DB-Rolle (Wurzel 3).
    return ObjektangabenService(db=get_service_client())


TaxpayerServiceDep = Annotated[TaxpayerService, Depends(get_taxpayer_service)]

ObjektangabenServiceDep = Annotated[
    ObjektangabenService, Depends(get_objektangaben_service)
]


def get_regime_service() -> RegimeService:
    # tax_country_rules ist fuer anon/authenticated hart gesperrt: wer die
    # Quellensteuersaetze aendern koennte, koennte Geld umleiten (Wurzel 6).
    return RegimeService(db=get_service_client())


RegimeServiceDep = Annotated[RegimeService, Depends(get_regime_service)]
