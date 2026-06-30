"""Dependencies des site_config-Slice: Service-Factory.

Der Service bekommt den Supabase-Service-Role-Client (tenant-Scope wird explizit
im Service durchgesetzt) und einen Cloudflare-Client für die Custom-Hostnames.
"""
from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .cloudflare_client import CloudflareClient
from .service import SiteConfigService


def get_site_config_service() -> SiteConfigService:
    return SiteConfigService(
        service_client=get_service_client(),
        cloudflare=CloudflareClient(),
    )


SiteConfigServiceDep = Annotated[SiteConfigService, Depends(get_site_config_service)]
