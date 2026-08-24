"""Dependencies des site_config-Slice: Service-Factory.

Der Service bekommt den Supabase-Service-Role-Client (tenant-Scope wird explizit
im Service durchgesetzt) und einen Cloudflare-Client für die Custom-Hostnames.
"""
from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .cloudflare_client import CloudflareClient
from .service import SiteConfigService
from .weiterleitungen import WeiterleitungsService


def get_site_config_service() -> SiteConfigService:
    return SiteConfigService(
        service_client=get_service_client(),
        cloudflare=CloudflareClient(),
    )


SiteConfigServiceDep = Annotated[SiteConfigService, Depends(get_site_config_service)]


def get_weiterleitungs_service() -> WeiterleitungsService:
    """Weiterleitungen + Sitemap (0430).

    Eigene Factory und kein Feld am SiteConfigService: der ist bei 1460 Zeilen
    und `pylint` zieht hier bei 1500. Der Site-Service wandert als Abhängigkeit
    mit, weil die öffentlichen Routen den Host auflösen müssen — und zwar über
    `resolve_site_by_domain`, das den Hauptschalter „Website offline" mitprüft.
    """
    return WeiterleitungsService(
        db=get_service_client(),
        site=get_site_config_service(),
    )


WeiterleitungsServiceDep = Annotated[
    WeiterleitungsService, Depends(get_weiterleitungs_service)
]
