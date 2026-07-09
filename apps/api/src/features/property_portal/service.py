"""Service für property_portal (Gastmodul je Objekt).

GET/PUT der Portal-Schalter (property_guest_portal, Migration 0121). Der Service
läuft mit Service-Role (RLS umgangen) → JEDER Zugriff scopet EXPLIZIT über die
property→tenant-Beziehung (Wurzel 3): das Objekt muss dem Tenant gehören, sonst
404. Der Türcode ist sensibel und wird ohne MANAGE_PROPERTIES maskiert.
"""
from __future__ import annotations

from uuid import UUID

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

from .schemas import GuestPortalSettings, SliceHealth

log = get_logger("nextdays.property_portal")

_FIELDS = (
    "enabled",
    "contact_name",
    "contact_phone",
    "self_checkin",
    "door_code",
    "show_code_only_if_paid",
    "hide_code_until_checkin",
    "code_visible_from",
    "maintenance_phone",
    "header_image_path",
)


class PropertyPortalError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class PropertyPortalService:
    slice_name = "property_portal"

    def __init__(self, client: Client | None = None) -> None:
        self._client = client

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def _db(self) -> Client:
        if self._client is None:
            raise PropertyPortalError("Portal-DB nicht verfügbar.", status_code=500)
        return self._client

    @staticmethod
    def _require_tenant(ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise PropertyPortalError("Kein Tenant im Konto.", status_code=400)
        return ctx.tenant_id

    def _require_own_property(self, tenant_id: str, property_id: str) -> None:
        """Objekt MUSS dem Tenant gehören (sonst 404). Service-Role umgeht RLS,
        also ist dieser Check der einzige Cross-Tenant-Schutz (Wurzel 3)."""
        try:
            UUID(str(property_id))
        except (ValueError, AttributeError, TypeError) as exc:
            raise PropertyPortalError("Objekt nicht gefunden.", status_code=404) from exc
        owned = (
            self._db()
            .table("properties")
            .select("id")
            .eq("id", property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not owned:
            raise PropertyPortalError("Objekt nicht gefunden.", status_code=404)

    def get(
        self, ctx: AuthContext, property_id: str, *, can_see_code: bool
    ) -> GuestPortalSettings:
        """Portal-Einstellungen des Objekts. Fehlt der Datensatz, liefern wir die
        Default-Einstellungen (alles aus) — das Objekt hat schlicht noch kein
        Gastmodul konfiguriert. Türcode ohne MANAGE_PROPERTIES maskiert (None)."""
        tenant_id = self._require_tenant(ctx)
        self._require_own_property(tenant_id, property_id)
        rows = (
            self._db()
            .table("property_guest_portal")
            .select("*")
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            return GuestPortalSettings()
        row = rows[0]
        # None-Werte weglassen → die Schema-Defaults greifen (die bool-Spalten
        # sind in der DB not-null, aber ältere/teilbefüllte Zeilen sollen nicht
        # an der Validierung scheitern).
        data = {k: row[k] for k in _FIELDS if row.get(k) is not None}
        if not can_see_code:
            data.pop("door_code", None)
        return GuestPortalSettings(**data)

    def put(
        self, ctx: AuthContext, property_id: str, req: GuestPortalSettings
    ) -> GuestPortalSettings:
        """Portal-Einstellungen upserten (genau ein Datensatz je Objekt)."""
        tenant_id = self._require_tenant(ctx)
        self._require_own_property(tenant_id, property_id)
        payload = {"property_id": property_id, **req.model_dump()}
        self._db().table("property_guest_portal").upsert(
            payload, on_conflict="property_id"
        ).execute()
        log.info("guest_portal_saved", property_id=property_id)
        # Zurückgeben, was gespeichert wurde (der Aufrufer darf den Code sehen —
        # er hat gerade MANAGE_PROPERTIES bewiesen).
        return req
