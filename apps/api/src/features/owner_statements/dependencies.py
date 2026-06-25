"""Dependencies des owner_statements-Slice: Service-Factory."""
from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import OwnerStatementsService


def get_owner_statements_service() -> OwnerStatementsService:
    return OwnerStatementsService(service_client=get_service_client())


OwnerStatementsServiceDep = Annotated[
    OwnerStatementsService, Depends(get_owner_statements_service)
]
