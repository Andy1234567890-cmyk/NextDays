"""Dependencies des property_custom_fields-Slice: Service-Factory."""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import PropertyCustomFieldService


def get_property_custom_field_service() -> PropertyCustomFieldService:
    # service_role: beide Tabellen sind per RLS + GRANT-Entzug für Nicht-
    # service_role gesperrt (Migration 0242); den Scope erzwingt der Service
    # über ctx.tenant_id (Wurzel 3).
    return PropertyCustomFieldService(db=get_service_client())


PropertyCustomFieldServiceDep = Annotated[
    PropertyCustomFieldService, Depends(get_property_custom_field_service)
]
