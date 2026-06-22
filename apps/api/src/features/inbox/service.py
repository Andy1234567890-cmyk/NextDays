"""Service-Schicht für inbox.

Threads werden aus den importierten OTA-Buchungen (channex_booking) abgeleitet:
pro Buchung ein Thread mit Portal, Gast und Reservierungsbezug. Tenant-scoped
(tenant_id aus dem JWT). Nachrichten-Versand an die OTA folgt separat.
"""
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

from .schemas import InboxListResponse, InboxThread, SliceHealth

log = get_logger("nextdays.inbox")


class InboxError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class InboxService:
    slice_name = "inbox"

    def __init__(self, service_client: Client | None = None) -> None:
        self._db = service_client

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def list_threads(self, ctx: AuthContext) -> InboxListResponse:
        if not ctx.tenant_id:
            raise InboxError("Kein Tenant im Token.", status_code=403)
        if self._db is None:
            raise InboxError("Posteingang-DB nicht verfügbar.", status_code=500)
        res = (
            self._db.table("channex_booking")
            .select(
                "id, ota_name, ota_reservation_code, status, arrival_date, "
                "departure_date, customer, updated_at"
            )
            .eq("tenant_id", ctx.tenant_id)
            .order("updated_at", desc=True)
            .limit(200)
            .execute()
        )
        items: list[InboxThread] = []
        for r in res.data or []:
            customer = r.get("customer") or {}
            name = " ".join(
                x for x in [customer.get("name"), customer.get("surname")] if x
            ).strip() or None
            items.append(
                InboxThread(
                    id=r["id"],
                    ota_name=r.get("ota_name"),
                    ota_reservation_code=r.get("ota_reservation_code"),
                    guest_name=name,
                    guest_email=customer.get("mail") or customer.get("email"),
                    status=r.get("status"),
                    arrival_date=r.get("arrival_date"),
                    departure_date=r.get("departure_date"),
                    updated_at=r.get("updated_at"),
                )
            )
        return InboxListResponse(items=items, total=len(items))
