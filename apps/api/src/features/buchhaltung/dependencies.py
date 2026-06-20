"""Dependencies des buchhaltung-Slice: Service-Factory."""
from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import BuchhaltungService


def get_buchhaltung_service() -> BuchhaltungService:
    return BuchhaltungService(service_client=get_service_client())


BuchhaltungServiceDep = Annotated[
    BuchhaltungService, Depends(get_buchhaltung_service)
]
