"""Dependency-Factory für den channel_manager-Slice."""
from typing import Annotated

from fastapi import Depends

from src.core.supabase import get_service_client

from .channex_client import ChannexClient
from .service import ChannelManagerService


def get_channel_manager_service() -> ChannelManagerService:
    return ChannelManagerService(
        service_client=get_service_client(),
        channex=ChannexClient(),
    )


ChannelManagerServiceDep = Annotated[
    ChannelManagerService, Depends(get_channel_manager_service)
]
