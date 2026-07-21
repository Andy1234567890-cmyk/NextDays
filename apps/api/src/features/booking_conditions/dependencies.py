"""Dependency-Factory für den booking_conditions-Slice."""
from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import BookingConditionService


def get_booking_condition_service() -> BookingConditionService:
    return BookingConditionService(service_client=get_service_client())


BookingConditionServiceDep = Annotated[
    BookingConditionService, Depends(get_booking_condition_service)
]
