"""Service-Schicht für channel_manager — Fassade über den Domänen-Mixins.

Die öffentliche API ist unverändert: `ChannelManagerService` und
`ChannelManagerError` bleiben aus DIESEM Modul importierbar (Router,
calendar/rates/reservations/…, jobs, Tests). Die Implementierung liegt in
den Mixin-Modulen (content_sync, property_mapping, ari_push, channels,
oauth_channels, bookings_sync); geteilte Modul-Helfer in common.py —
dort ist auch das Patch-Ziel für Modul-Helfer, nicht hier.

Tenant-Scope kommt aus dem JWT (AuthContext); alle externen Calls laufen
über den ChannexClient.
"""
from __future__ import annotations

from supabase import Client

from src.core.security import AuthContext

from .ari_push import AriPushMixin
from .bookings_sync import BookingsSyncMixin
from .channels import ChannelsMixin
from .channex_client import ChannexClient, ChannexError
from .common import (
    ChannelManagerError,
    _availability_settings,
    _channex_facility_ids,
    _channex_property_type,
    _timezone_for_country,
)
from .content_sync import ContentSyncMixin
from .oauth_channels import OAuthChannelsMixin
from .property_mapping import PropertyMappingMixin
from .schemas import SliceHealth

__all__ = [
    "ChannelManagerError",
    "ChannelManagerService",
    "_availability_settings",
    "_channex_facility_ids",
    "_channex_property_type",
    "_timezone_for_country",
]


class ChannelManagerService(
    ContentSyncMixin,
    PropertyMappingMixin,
    AriPushMixin,
    ChannelsMixin,
    OAuthChannelsMixin,
    BookingsSyncMixin,
):
    slice_name = "channel_manager"

    def __init__(
        self,
        *,
        service_client: Client | None = None,
        channex: ChannexClient | None = None,
    ) -> None:
        self._db = service_client
        self._channex = channex or ChannexClient()

    # -- Helpers ---------------------------------------------------------------
    def health(self) -> SliceHealth:
        return SliceHealth(
            slice=self.slice_name,
            channel_manager_ready=self._channex.is_configured,
        )

    def _require_db(self) -> Client:
        if self._db is None:
            raise ChannelManagerError("Datenbank nicht verfügbar.", status_code=500)
        return self._db

    def _require_tenant(self, ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise ChannelManagerError("Kein Tenant im Konto.", status_code=400)
        return ctx.tenant_id

    @staticmethod
    def _wrap_channex(exc: ChannexError) -> ChannelManagerError:
        return ChannelManagerError(exc.message, status_code=exc.status_code)

    # -- Channel-Hilfen --------------------------------------------------------
    def _tenant_channex_property_ids(self, db: Client, tenant_id: str) -> set[str]:
        maps = (
            db.table("channex_property_map")
            .select("channex_property_id")
            .eq("tenant_id", tenant_id)
            .is_("deleted_at", "null")
            .execute()
        )
        return {m["channex_property_id"] for m in (maps.data or [])}
