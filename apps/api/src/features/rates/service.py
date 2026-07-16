"""Service-Schicht für rates — Preispläne (rate_plans) pro Objekt.

Tenant-gescoped (Property muss dem Tenant gehören). Das Anlegen/Ändern eines
Preisplans löst den Channex-Sync der Property aus (non-blocking), damit ein
bepreistes Objekt sofort übertragbar ist. rate_plans ist die Channex-Wahrheit
für den Basispreis.
"""
from datetime import date, timedelta

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.jobs.queue import try_enqueue_ari, try_enqueue_content_sync

from .schemas import (
    RatePlanCreate,
    RatePlanListResponse,
    RatePlanPriceDay,
    RatePlanPriceListResponse,
    RatePlanPriceSet,
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
            room_type_id=r.get("room_type_id"),
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
        # room_type_id serverseitig scopen (Wurzel 3): die Kategorie MUSS zu DIESER
        # Property gehören — sonst könnte ein Client einen Preisplan an eine fremde
        # Zimmerkategorie hängen (Service-Role umgeht RLS).
        if req.room_type_id is not None:
            rt = (
                self._db()
                .table("room_types")
                .select("id")
                .eq("id", req.room_type_id)
                .eq("property_id", req.property_id)
                .eq("tenant_id", tenant_id)
                .limit(1)
                .execute()
            ).data
            if not rt:
                raise RateError("Zimmerkategorie nicht gefunden.", status_code=404)
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
                    **({"room_type_id": req.room_type_id} if req.room_type_id else {}),
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

    def _require_own_rate_plan(self, tenant_id: str, rate_plan_id: str) -> dict:
        """Einen Rate-Plan laden UND auf den Tenant scopen in EINEM Schritt (Wurzel 3:
        Load und Scope nicht trennen). Service-Role umgeht RLS → der Join auf
        properties.tenant_id ist der einzige Eigentums-Backstop."""
        res = (
            self._db()
            .table("rate_plans")
            .select("id, property_id, properties!inner(tenant_id)")
            .eq("id", rate_plan_id)
            .limit(1)
            .execute()
        ).data
        if not res or res[0]["properties"]["tenant_id"] != tenant_id:
            raise RateError("Preisplan nicht gefunden.", status_code=404)
        return res[0]

    def list_prices(
        self, ctx: AuthContext, rate_plan_id: str
    ) -> RatePlanPriceListResponse:
        """Datumsgenaue Preise eines Rate-Plans (Hotel). Tenant-gescoped."""
        tenant_id = self._require_tenant(ctx)
        self._require_own_rate_plan(tenant_id, rate_plan_id)
        rows = (
            self._db()
            .table("rate_plan_price_overrides")
            .select("date, price")
            .eq("rate_plan_id", rate_plan_id)
            .not_.is_("price", "null")
            .order("date")
            .execute()
        ).data or []
        items = [
            RatePlanPriceDay(date=r["date"], price=float(r["price"]))
            for r in rows
            if r.get("date") is not None and r.get("price") is not None
        ]
        return RatePlanPriceListResponse(rate_plan_id=rate_plan_id, items=items)

    def set_prices(
        self, ctx: AuthContext, rate_plan_id: str, req: RatePlanPriceSet
    ) -> RatePlanPriceListResponse:
        """Datumsgenauen Preis eines Rate-Plans für [start, end) setzen oder (price=
        None) zurücknehmen. Idempotent über unique(rate_plan_id, date) (Wurzel 2:
        Doppelklick/Retry erzeugt keine Dubletten). Push an GENAU diesen Rate-Plan
        (nicht an alle spiegeln) — gilt auf allen 3 Vertriebswegen gleich."""
        tenant_id = self._require_tenant(ctx)
        plan = self._require_own_rate_plan(tenant_id, rate_plan_id)
        property_id = plan["property_id"]
        days = [
            req.start + timedelta(days=i)
            for i in range((req.end - req.start).days)
        ]
        if req.price is None:
            # Zurücknehmen: Zeilen im Zeitraum löschen → Basispreis gilt wieder.
            (
                self._db()
                .table("rate_plan_price_overrides")
                .delete()
                .eq("rate_plan_id", rate_plan_id)
                .gte("date", req.start.isoformat())
                .lt("date", req.end.isoformat())
                .execute()
            )
        else:
            # Upsert pro Tag (unique-Backstop dedupliziert Retry/Doppelklick).
            self._db().table("rate_plan_price_overrides").upsert(
                [
                    {
                        "rate_plan_id": rate_plan_id,
                        "date": d.isoformat(),
                        "price": req.price,
                    }
                    for d in days
                ],
                on_conflict="rate_plan_id,date",
            ).execute()
        # Preis an Channex pushen — als Rate-Segment mit rate_plan_id (nur DIESER
        # Plan). end ist exklusiv → date_to inklusiv = end − 1 Tag.
        rate_cents = None if req.price is None else int(round(req.price * 100))
        self._enqueue_rate_plan_push(
            tenant_id, property_id, rate_plan_id, req.start, req.end, rate_cents
        )
        log.info(
            "rate_plan_prices_set",
            tenant_id=tenant_id,
            rate_plan_id=rate_plan_id,
            days=len(days),
            cleared=req.price is None,
        )
        return self.list_prices(ctx, rate_plan_id)

    def _enqueue_rate_plan_push(
        self,
        tenant_id: str,
        property_id: str,
        rate_plan_id: str,
        start: date,
        end: date,
        rate_cents: int | None,
    ) -> None:
        """Einen rate-plan-genauen Preis-Push einreihen. Beim Zurücknehmen (rate_cents
        None) kann kein negativer Wert gepusht werden — Channex kennt kein „Preis
        weg". Der nachfolgende Content-/Reconcile-Sync setzt dann den Basispreis
        wieder; hier nur das Enqueue bei gesetztem Preis (fail-nicht-leise: der
        Reconcile-Tick gleicht Zurücknahmen ab)."""
        if rate_cents is None:
            self._sync_property(tenant_id, property_id, None, None)
            return
        try_enqueue_ari(
            self._db(),
            tenant_id,
            property_id,
            "rate",
            {
                "segments": [
                    {
                        "date_from": start.isoformat(),
                        # date_to inklusiv (end ist exklusiv).
                        "date_to": (end - timedelta(days=1)).isoformat(),
                        "rate_cents": rate_cents,
                        "rate_plan_id": rate_plan_id,
                    }
                ]
            },
        )

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
        today = date.today()
        try_enqueue_ari(
            self._db(), tenant_id, property_id, "rate",
            {"date_from": today.isoformat(),
             "date_to": (today + timedelta(days=self._RESTRICTION_HORIZON_DAYS)).isoformat(),
             "min_stay": min_stay},
            coalesce=True,
        )
