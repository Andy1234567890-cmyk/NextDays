"""FastAPI-Dependencies des booking_offers-Slices."""
from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .service import BookingOffersService


def get_booking_offers_service() -> BookingOffersService:
    return BookingOffersService(service_client=get_service_client())


BookingOffersServiceDep = Annotated[
    BookingOffersService, Depends(get_booking_offers_service)
]
