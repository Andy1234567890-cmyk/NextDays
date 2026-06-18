"""Dependencies des properties-Slice: Service-Factory."""
from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import PropertiesService


def get_properties_service() -> PropertiesService:
    return PropertiesService(service_client=get_service_client())


PropertiesServiceDep = Annotated[PropertiesService, Depends(get_properties_service)]
