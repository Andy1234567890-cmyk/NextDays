"""Service-Schicht für room_types — Zimmerkategorien eines Hotels.

Tenant-gescoped (Property muss dem Tenant gehören). Das Anlegen der ersten
Kategorie schaltet die Property in den Hotel-Modus (Verfügbarkeit als Zahl,
0140); das Löschen der letzten Kategorie fällt auf das Ferienwohnungs-Modell
zurück. Anlegen/Ändern löst den Channex-Content-Sync der Property aus
(non-blocking), damit die Kategorie als Channex-Room-Type übertragbar ist.

Scope (Wurzel 3): Der Service-Role-Key umgeht RLS → jeder per-ID-Zugriff wird
explizit über die Property auf den Tenant gescopet (_require_own_room_type),
nie ein roher Load per room_type_id ohne Tenant-Prüfung.
"""
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.jobs.queue import try_enqueue_content_sync

from .schemas import (
    RoomTypeCreate,
    RoomTypeListResponse,
    RoomTypeResponse,
    RoomTypeUpdate,
    SliceHealth,
)

log = get_logger("nextdays.room_types")


class RoomTypeError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class RoomTypesService:
    slice_name = "room_types"

    def __init__(self, service_client: Client | None = None) -> None:
        self._client = service_client

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def _db(self) -> Client:
        if self._client is None:
            raise RoomTypeError("Room-Types-DB nicht verfügbar.", status_code=500)
        return self._client

    def _require_tenant(self, ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise RoomTypeError("Kein Tenant im Konto.", status_code=400)
        return ctx.tenant_id

    def _require_own_property(self, tenant_id: str, property_id: str) -> dict:
        res = (
            self._db()
            .table("properties")
            .select("id, title")
            .eq("id", property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not res:
            raise RoomTypeError("Objekt nicht gefunden.", status_code=404)
        return res[0]

    def _require_own_room_type(self, tenant_id: str, room_type_id: str) -> dict:
        """Room-Type per ID laden UND auf den Tenant scopen (Load+Scope zusammen,
        Wurzel 3). Join über die Property, da room_types kein tenant_id-Filter
        allein genügt (Service-Role umgeht RLS)."""
        res = (
            self._db()
            .table("room_types")
            .select("*, properties!inner(tenant_id, title)")
            .eq("id", room_type_id)
            .eq("properties.tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not res:
            raise RoomTypeError("Zimmerkategorie nicht gefunden.", status_code=404)
        return res[0]

    @staticmethod
    def _row(r: dict) -> RoomTypeResponse:
        return RoomTypeResponse(
            id=r["id"],
            property_id=r["property_id"],
            title=r["title"],
            count_of_rooms=int(r["count_of_rooms"]),
            occ_adults=int(r["occ_adults"]),
            occ_children=int(r.get("occ_children") or 0),
            occ_infants=int(r.get("occ_infants") or 0),
            default_occupancy=int(r["default_occupancy"]),
            position=int(r.get("position") or 0),
        )

    def _sync_property(self, tenant_id: str, property_id: str, title: str | None) -> None:
        """Content-Sync der Property anstoßen (non-blocking). currency=None →
        der Sync lädt die echte Objektwährung aus dem Rate-Plan (kein EUR-Default,
        Wurzel 4)."""
        try_enqueue_content_sync(
            self._db(), tenant_id, property_id, title=title, currency=None
        )

    def list(self, ctx: AuthContext, property_id: str) -> RoomTypeListResponse:
        tenant_id = self._require_tenant(ctx)
        self._require_own_property(tenant_id, property_id)
        res = (
            self._db()
            .table("room_types")
            .select("*")
            .eq("property_id", property_id)
            .order("position")
            .order("created_at")
            .execute()
        ).data or []
        items = [self._row(r) for r in res]
        return RoomTypeListResponse(items=items, total=len(items))

    def create(self, ctx: AuthContext, req: RoomTypeCreate) -> RoomTypeResponse:
        tenant_id = self._require_tenant(ctx)
        prop = self._require_own_property(tenant_id, req.property_id)
        # Neue Kategorie ans Ende sortieren (max position + 1).
        existing = (
            self._db()
            .table("room_types")
            .select("position")
            .eq("property_id", req.property_id)
            .order("position", desc=True)
            .limit(1)
            .execute()
        ).data or []
        next_pos = (existing[0]["position"] + 1) if existing else 0
        ins = (
            self._db()
            .table("room_types")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "property_id": req.property_id,
                    "title": req.title,
                    "count_of_rooms": req.count_of_rooms,
                    "occ_adults": req.occ_adults,
                    "occ_children": req.occ_children,
                    "occ_infants": req.occ_infants,
                    "default_occupancy": req.default_occupancy,
                    "position": next_pos,
                }
            )
            .execute()
        ).data
        if not ins:
            raise RoomTypeError(
                "Zimmerkategorie konnte nicht angelegt werden.", status_code=500
            )
        self._sync_property(tenant_id, req.property_id, prop.get("title"))
        log.info(
            "room_type_created", tenant_id=tenant_id, property_id=req.property_id
        )
        return self._row(ins[0])

    def update(
        self, ctx: AuthContext, room_type_id: str, req: RoomTypeUpdate
    ) -> RoomTypeResponse:
        tenant_id = self._require_tenant(ctx)
        current = self._require_own_room_type(tenant_id, room_type_id)
        patch = {k: v for k, v in req.model_dump().items() if v is not None}
        if not patch:
            return self._row(current)
        # Channex-Regel auch beim Teil-Update wahren: default_occupancy ≤ occ_adults
        # (der DB-Check greift ohnehin, aber wir melden es sauber als 400).
        new_default = patch.get("default_occupancy", current["default_occupancy"])
        new_adults = patch.get("occ_adults", current["occ_adults"])
        if new_default > new_adults:
            raise RoomTypeError(
                "default_occupancy darf occ_adults nicht übersteigen.",
                status_code=400,
            )
        row = (
            self._db()
            .table("room_types")
            .update(patch)
            .eq("id", room_type_id)
            .execute()
        ).data
        if not row:
            raise RoomTypeError("Update fehlgeschlagen.", status_code=500)
        title = (current.get("properties") or {}).get("title")
        self._sync_property(tenant_id, current["property_id"], title)
        log.info("room_type_updated", tenant_id=tenant_id, room_type_id=room_type_id)
        return self._row(row[0])

    def delete(self, ctx: AuthContext, room_type_id: str) -> None:
        tenant_id = self._require_tenant(ctx)
        current = self._require_own_room_type(tenant_id, room_type_id)
        self._db().table("room_types").delete().eq("id", room_type_id).execute()
        title = (current.get("properties") or {}).get("title")
        self._sync_property(tenant_id, current["property_id"], title)
        log.info("room_type_deleted", tenant_id=tenant_id, room_type_id=room_type_id)
