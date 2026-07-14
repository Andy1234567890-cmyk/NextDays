"""Service-Schicht für rates — Preispläne (rate_plans) pro Objekt.

Tenant-gescoped (Property muss dem Tenant gehören). Das Anlegen/Ändern eines
Preisplans löst den Channex-Sync der Property aus (non-blocking), damit ein
bepreistes Objekt sofort übertragbar ist. rate_plans ist die Channex-Wahrheit
für den Basispreis.
"""
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.jobs.queue import try_enqueue_ari, try_enqueue_content_sync

from .schemas import (
    RatePlanCreate,
    RatePlanListResponse,
    RatePlanResponse,
    RatePlanUpdate,
    SliceHealth,
)

log = get_logger("nextdays.rates")


class RateError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class RatesService:
    slice_name = "rates"

    def __init__(self, service_client: Client | None = None) -> None:
        self._client = service_client

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def _db(self) -> Client:
        if self._client is None:
            raise RateError("Rates-DB nicht verfügbar.", status_code=500)
        return self._client

    def _require_tenant(self, ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise RateError("Kein Tenant im Konto.", status_code=400)
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
            raise RateError("Objekt nicht gefunden.", status_code=404)
        return res[0]

    @staticmethod
    def _row(r: dict) -> RatePlanResponse:
        return RatePlanResponse(
            id=r["id"],
            property_id=r["property_id"],
            name=r.get("name") or "Standard",
            base_price=float(r.get("base_price") or 0),
            currency=r.get("currency") or "EUR",
            min_stay=int(r.get("min_stay") or 1),
        )

    def list(self, ctx: AuthContext, property_id: str) -> RatePlanListResponse:
        tenant_id = self._require_tenant(ctx)
        self._require_own_property(tenant_id, property_id)
        res = (
            self._db()
            .table("rate_plans")
            .select("*")
            .eq("property_id", property_id)
            .order("created_at")
            .execute()
        ).data or []
        items = [self._row(r) for r in res]
        return RatePlanListResponse(items=items, total=len(items))

    def create(self, ctx: AuthContext, req: RatePlanCreate) -> RatePlanResponse:
        tenant_id = self._require_tenant(ctx)
        prop = self._require_own_property(tenant_id, req.property_id)
        ins = (
            self._db()
            .table("rate_plans")
            .insert(
                {
                    "property_id": req.property_id,
                    "name": req.name,
                    "base_price": req.base_price,
                    "currency": req.currency,
                    "min_stay": req.min_stay,
                }
            )
            .execute()
        ).data
        if not ins:
            raise RateError("Preisplan konnte nicht angelegt werden.", status_code=500)
        self._sync_property(tenant_id, req.property_id, prop.get("title"), req.currency)
        log.info("rate_plan_created", tenant_id=tenant_id, property_id=req.property_id)
        return self._row(ins[0])

    def set_base_price(
        self, ctx: AuthContext, req: RatePlanCreate
    ) -> RatePlanResponse:
        """Basispreis eines Objekts setzen: ersten Rate-Plan aktualisieren, sonst
        anlegen (Upsert-Semantik in EINEM Server-Round-Trip). So landet der
        Basispreis immer — auch beim ersten Speichern — ohne Race-Dublette aus
        getrenntem List+POST/PATCH im Client."""
        tenant_id = self._require_tenant(ctx)
        prop = self._require_own_property(tenant_id, req.property_id)
        existing = (
            self._db()
            .table("rate_plans")
            .select("id")
            .eq("property_id", req.property_id)
            .order("created_at")
            .limit(1)
            .execute()
        ).data or []
        patch = {
            "name": req.name,
            "base_price": req.base_price,
            "currency": req.currency,
            "min_stay": req.min_stay,
        }
        if existing:
            row = (
                self._db()
                .table("rate_plans")
                .update(patch)
                .eq("id", existing[0]["id"])
                .execute()
            ).data
            result = row[0] if row else {**patch, "id": existing[0]["id"],
                                          "property_id": req.property_id}
        else:
            row = (
                self._db()
                .table("rate_plans")
                .insert({"property_id": req.property_id, **patch})
                .execute()
            ).data
            if not row:
                raise RateError(
                    "Preisplan konnte nicht angelegt werden.", status_code=500
                )
            result = row[0]
        self._sync_property(tenant_id, req.property_id, prop.get("title"), req.currency)
        log.info("rate_base_price_set", tenant_id=tenant_id, property_id=req.property_id)
        return self._row(result)

    def update(
        self, ctx: AuthContext, rate_plan_id: str, req: RatePlanUpdate
    ) -> RatePlanResponse:
        tenant_id = self._require_tenant(ctx)
        # Preisplan + Property-Eigentum prüfen.
        existing = (
            self._db()
            .table("rate_plans")
            .select("*, properties!inner(tenant_id, title)")
            .eq("id", rate_plan_id)
            .limit(1)
            .execute()
        ).data
        if not existing or existing[0]["properties"]["tenant_id"] != tenant_id:
            raise RateError("Preisplan nicht gefunden.", status_code=404)
        patch = req.model_dump(exclude_none=True)
        if patch:
            upd = (
                self._db()
                .table("rate_plans")
                .update(patch)
                .eq("id", rate_plan_id)
                .execute()
            ).data
            row = upd[0] if upd else existing[0]
        else:
            row = existing[0]
        prop = existing[0]["properties"]
        self._sync_property(
            tenant_id, row["property_id"], prop.get("title"), row.get("currency")
        )
        # Mindestaufenthalt zusätzlich als datums­bezogene RESTRICTION pushen.
        # sync_property setzt nur den Rate-Plan-DEFAULT (min_stay_arrival/through
        # am Rate-Plan-Objekt). Der Wert, den Channex im Kalender/UI anzeigt und
        # für Buchungen erzwingt, kommt aus den per-Datum-Restrictions — die
        # überschreiben den Default. Ohne diesen Push bleibt der Kalender auf 1,
        # obwohl der Rate-Plan-Default 3 zeigt (live verifiziert).
        if "min_stay" in patch and isinstance(patch["min_stay"], int):
            self._push_min_stay_restriction(
                tenant_id, row["property_id"], patch["min_stay"]
            )
        log.info("rate_plan_updated", tenant_id=tenant_id, rate_plan_id=rate_plan_id)
        return self._row(row)

    def delete(self, ctx: AuthContext, rate_plan_id: str) -> None:
        tenant_id = self._require_tenant(ctx)
        existing = (
            self._db()
            .table("rate_plans")
            .select("id, property_id, properties!inner(tenant_id)")
            .eq("id", rate_plan_id)
            .limit(1)
            .execute()
        ).data
        if not existing or existing[0]["properties"]["tenant_id"] != tenant_id:
            raise RateError("Preisplan nicht gefunden.", status_code=404)
        self._db().table("rate_plans").delete().eq("id", rate_plan_id).execute()
        # Löschkette (Channex-Doku „break the chain"): Content-Sync einreihen —
        # dessen Prune entfernt den verwaisten Channex-Rate-Plan (fail-closed,
        # wenn er noch an einen Kanal gemappt ist) und schließt das Mapping.
        try_enqueue_content_sync(
            self._db(), tenant_id, existing[0]["property_id"]
        )
        log.info("rate_plan_deleted", tenant_id=tenant_id, rate_plan_id=rate_plan_id)

    def _sync_property(
        self, tenant_id: str, property_id: str, title: str | None, currency: str | None
    ) -> None:
        """Channex-Content-Sync als Hintergrund-Job einreihen (Phase 2). Ein
        bepreistes Objekt fließt so an Channex, ohne dass das Speichern auf die
        mehreren sequentiellen Channex-Calls wartet. Coalesced je Objekt →
        mehrfaches Speichern des Basispreises erzeugt nur EINEN Sync."""
        try_enqueue_content_sync(
            self._db(), tenant_id, property_id, title=title, currency=currency
        )

    # Planungshorizont für den Restriction-Push (deckt den 365-Tage-Availability-
    # Init ab). Ab heute, damit vergangene Tage nicht angefasst werden.
    _RESTRICTION_HORIZON_DAYS = 365

    def _push_min_stay_restriction(
        self, tenant_id: str, property_id: str, min_stay: int
    ) -> None:
        """Mindestaufenthalt als per-Datum-Restriction über den vollen Horizont als
        ARI-Push-Job einreihen (Phase 2). Das ist der Wert, den das Channex-
        Kalender-UI zeigt und für Buchungen erzwingt. Deckt IMMER den ganzen
        Horizont ab → coalesce=True sicher; der Reconcile-Tick gleicht zusätzlich ab."""
        if min_stay < 1:
            return
        from datetime import date, timedelta

        today = date.today()
        try_enqueue_ari(
            self._db(), tenant_id, property_id, "rate",
            {"date_from": today.isoformat(),
             "date_to": (today + timedelta(days=self._RESTRICTION_HORIZON_DAYS)).isoformat(),
             "min_stay": min_stay},
            coalesce=True,
        )
