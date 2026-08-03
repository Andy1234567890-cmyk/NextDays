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

from .abgaben_status import AbgabenStatusMixin
from .ari_push import AriPushMixin
from .bookings_sync import BookingsSyncMixin
from .channels import ChannelsMixin
from .channex_client import ChannexCallTrace, ChannexClient, ChannexError
from .common import (
    ChannelManagerError,
    _availability_settings,
    _channex_facility_ids,
    _channex_property_type,
    _timezone_for_country,
    log,
)
from .content_sync import ContentSyncMixin
from .csv_import import CsvImportMixin
from .full_sync import FullSyncMixin
from .lodgify_import import LodgifyImportMixin
from .oauth_channels import OAuthChannelsMixin
from .objekt_kanal import ObjektKanalMixin
from .ota_extras import OtaExtrasMixin
from .property_mapping import PropertyMappingMixin
from .reviews_sync import ReviewsSyncMixin
from .schemas import ChannexDebugEntry, ChannexDebugResponse, SliceHealth
from .tax_sync import TaxSyncMixin

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
    TaxSyncMixin,
    AbgabenStatusMixin,
    PropertyMappingMixin,
    AriPushMixin,
    ChannelsMixin,
    OAuthChannelsMixin,
    ObjektKanalMixin,
    BookingsSyncMixin,
    OtaExtrasMixin,
    ReviewsSyncMixin,
    FullSyncMixin,
    CsvImportMixin,
    LodgifyImportMixin,
):  # pylint: disable=too-many-ancestors  # bewusste Fassade über Domänen-Mixins
    slice_name = "channel_manager"

    def __init__(
        self,
        *,
        service_client: Client | None = None,
        channex: ChannexClient | None = None,
    ) -> None:
        self._db = service_client
        # Trace-Kontext (tenant/property/step) des gerade laufenden Push-Schritts.
        # Die Mixins setzen ihn über `_trace_step(...)`, der Client-Sink liest ihn
        # und persistiert jeden Channex-Call in channex_debug_log (Flow-Debugging).
        self._trace_ctx: dict[str, str | None] = {
            "tenant_id": None, "property_id": None, "step": None,
        }
        if channex is not None:
            self._channex = channex
            # Übergebener Client (Worker-Pfad mit Budget-Callback): Trace-Sink
            # nachsetzen, damit AUCH ARI-/Availability-Pushes ihre Task-ID in
            # channex_debug_log schreiben (nicht nur der Content-Sync). Sonst
            # fehlten dem Frontend-Verlauf und der Zertifizierung die Task-IDs.
            # hasattr: Test-Fakes/andere Clients ohne Trace-Fähigkeit werden
            # unverändert gelassen (Duck-Typing, kein harter Typ-Zwang).
            if service_client is not None and hasattr(self._channex, "set_trace_sink"):
                self._channex.set_trace_sink(self._persist_trace)
        else:
            # Eigener Client mit Trace-Sink — nur wenn eine DB da ist (sonst
            # nichts zu persistieren, z. B. reine Health-Checks/Tests).
            self._channex = ChannexClient(
                trace_sink=self._persist_trace if service_client is not None else None
            )

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

    def ensure_channex_account(self, ctx: AuthContext) -> str:
        """Stellt den Channex-Account (Group) des Tenants VERIFIZIERT sicher und
        gibt die channex_group_id zurück. Fail-CLOSED: Kommt keine Group zustande
        (Channex nicht erreichbar/nicht konfiguriert), wirft diese Methode — das
        Onboarding darf DANN NICHT als „completed" gelten (Regel „vollständig oder
        nichts"). Anders als das best-effort ensure_group bei der Registrierung
        wird hier NICHTS verschluckt: ohne Channex-Account kein fertiges Onboarding.
        Idempotent (existiert die Group, wird sie nur gelesen)."""
        tenant_id = self._require_tenant(ctx)
        self._require_db()
        if not self._channex.is_configured:
            raise ChannelManagerError(
                "Die Portal-Anbindung ist derzeit nicht verfügbar. Bitte später "
                "erneut versuchen — dein Konto ist noch nicht vollständig "
                "eingerichtet.",
                status_code=503,
            )
        # Group-Name = Betriebsname (tenants.name); ensure_group lädt ihn selbst.
        group_id = self.ensure_group(tenant_id)
        if not group_id:
            # ensure_group schluckt Channex-/DB-Fehler zu None — hier wird daraus
            # ein harter Fehler, damit das Onboarding nicht fälschlich abschließt.
            raise ChannelManagerError(
                "Der Portal-Account konnte nicht angelegt werden. Dein Konto ist "
                "noch nicht vollständig eingerichtet — bitte erneut versuchen.",
                status_code=502,
            )
        return group_id

    @staticmethod
    def _wrap_channex(exc: ChannexError) -> ChannelManagerError:
        return ChannelManagerError(exc.message, status_code=exc.status_code)

    # -- Sichtbares Flow-Debugging (channex_debug_log) -------------------------
    def _trace_step(
        self,
        *,
        tenant_id: str | None,
        property_id: str | None = None,
        step: str,
    ) -> None:
        """Trace-Kontext des gerade anstehenden Channex-Schritts setzen. Der
        Client-Sink liest ihn beim nächsten HTTP-Call und schreibt die DB-Zeile.
        Vor jedem semantischen Schritt (property_create, rate_plan_create …)
        aufrufen — der Kontext gilt, bis er neu gesetzt wird."""
        self._trace_ctx = {
            "tenant_id": tenant_id, "property_id": property_id, "step": step,
        }

    def _persist_trace(self, trace: ChannexCallTrace) -> None:
        """Client-Sink: einen Channex-Call in channex_debug_log persistieren.
        Best effort — ein Trace-Fehler darf den Push nie kippen (Wurzel 5). Ohne
        gesetzten Tenant (kein Kontext) wird nichts geschrieben (RLS/NOT NULL)."""
        tenant_id = self._trace_ctx.get("tenant_id")
        if not tenant_id or self._db is None:
            return
        try:
            self._db.table("channex_debug_log").insert(
                {
                    "tenant_id": tenant_id,
                    "property_id": self._trace_ctx.get("property_id"),
                    "step": self._trace_ctx.get("step") or "call",
                    "channex_method": trace.method,
                    "channex_path": trace.path,
                    "request_body": trace.request_body,
                    "response_body": trace.response_body,
                    "channex_id": trace.channex_id,
                    "http_status": trace.http_status,
                    "duration_ms": trace.duration_ms,
                    "ok": trace.ok,
                    "error": trace.error,
                }
            ).execute()
        except Exception as exc:  # noqa: BLE001 - Trace nie den Hauptpfad kippen
            log.warning("channex_debug_log_insert_failed", error=str(exc))

    def list_debug_trace(
        self,
        ctx: AuthContext,
        *,
        property_id: str | None = None,
        limit: int = 100,
    ) -> ChannexDebugResponse:
        """Letzte Channex-Call-Traces des Tenants (Flow-Debugging), neueste zuerst.
        Optional auf ein Objekt gefiltert. Tenant-Scope via RLS + expliziter eq."""
        db = self._require_db()
        tenant_id = self._require_tenant(ctx)
        query = (
            db.table("channex_debug_log")
            .select("*")
            .eq("tenant_id", tenant_id)
        )
        if property_id:
            query = query.eq("property_id", property_id)
        res = (
            query.order("created_at", desc=True)
            .limit(max(1, min(limit, 500)))
            .execute()
        )
        items = [
            ChannexDebugEntry(
                id=str(r["id"]),
                property_id=r.get("property_id"),
                step=r["step"],
                channex_method=r["channex_method"],
                channex_path=r["channex_path"],
                request_body=r.get("request_body"),
                response_body=r.get("response_body"),
                channex_id=r.get("channex_id"),
                http_status=r.get("http_status"),
                duration_ms=r.get("duration_ms"),
                ok=bool(r.get("ok")),
                error=r.get("error"),
                created_at=str(r["created_at"]) if r.get("created_at") else None,
            )
            for r in (res.data or [])
        ]
        return ChannexDebugResponse(items=items, total=len(items))

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
