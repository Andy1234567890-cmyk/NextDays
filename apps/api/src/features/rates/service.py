"""Service-Schicht für rates — Preispläne (rate_plans) pro Objekt.

Tenant-gescoped (Property muss dem Tenant gehören). Das Anlegen/Ändern eines
Preisplans löst den Channex-Sync der Property aus (non-blocking), damit ein
bepreistes Objekt sofort übertragbar ist. rate_plans ist die Channex-Wahrheit
für den Basispreis.
"""
from __future__ import annotations

from datetime import date, timedelta

from supabase import Client

from src.core.dates import merge_day_ranges
from src.core.logging import get_logger
from src.core.security import AuthContext
from src.jobs.queue import (
    dedup_key,
    enqueue,
    try_enqueue_ari,
    try_enqueue_content_sync,
)

from .schemas import (
    RateGridDay,
    RateGridPlan,
    RateGridResponse,
    RatePlanCreate,
    RatePlanListResponse,
    RatePlanMinStayDay,
    RatePlanMinStayListResponse,
    RatePlanMinStaySet,
    RatePlanPriceDay,
    RatePlanPriceListResponse,
    RatePlanPriceSet,
    RatePlanResponse,
    RatePlanRestrictionDay,
    RatePlanRestrictionListResponse,
    RatePlanRestrictionSet,
    RatePlanUpdate,
    SliceHealth,
)

log = get_logger("nextdays.rates")


class RateError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _weekday_filtered(
    start: date, end: date, weekdays: list[int] | None
) -> list[date]:
    """Tage in [start, end) (end exklusiv), optional auf eine Wochentagsmaske
    (0=Mo … 6=So) gefiltert. Leer/None → alle Tage."""
    mask = set(weekdays) if weekdays else None
    out: list[date] = []
    for i in range((end - start).days):
        d = start + timedelta(days=i)
        if mask is None or d.weekday() in mask:
            out.append(d)
    return out


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
            .select("id, title, currency")
            .eq("id", property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not res:
            raise RateError("Objekt nicht gefunden.", status_code=404)
        return res[0]

    def _set_property_currency(self, property_id: str, currency: str) -> None:
        """Zentrale Objektwährung setzen (0161), wenn sie noch fehlt. Der Aufrufer
        hat das Objekt bereits tenant-gescopt geladen; hier nur die eine Spalte
        füllen. Best-effort im Sinne von Wurzel 5 — schlägt es fehl, bleibt die
        Rate-Plan-Währung dennoch korrekt und ein späteres Speichern greift."""
        try:
            self._db().table("properties").update({"currency": currency}).eq(
                "id", property_id
            ).execute()
        except Exception:  # noqa: BLE001 — best-effort, kippt den Preis-Pfad nicht
            log.warning("property_currency_set_failed", property_id=property_id)

    @staticmethod
    def _effective_currency(prop: dict, req_currency: str | None) -> str:
        """Wirksame Währung eines Rate-Plans = die Objektwährung, falls gesetzt
        (properties.currency, Migration 0161 — die zentrale Wahrheit). Ein
        abweichender Wert aus dem Request wird als Fehler abgewiesen (422), NIE
        still übernommen: Channex verlangt 1 Objekt = 1 Währung, und die zentrale
        Einstellung darf nicht per Preisplan-PATCH ausgehebelt werden (Wurzel 1).

        Hat das Objekt (noch) keine zentrale Währung, gilt die Request-Währung
        (Bestand/Erstanlage vor dem Setzen der Objektwährung); fehlt auch die,
        ist das ein Datenfehler → 422 (kein EUR-Fallback, Wurzel 4)."""
        obj_cur = (prop.get("currency") or "").upper()
        req_cur = (req_currency or "").upper()
        if obj_cur:
            if req_cur and req_cur != obj_cur:
                raise RateError(
                    "Die Währung wird zentral am Objekt eingestellt "
                    f"({obj_cur}) und gilt für alle Preispläne. Bitte die "
                    "Objektwährung ändern, nicht den einzelnen Preisplan.",
                    status_code=422,
                )
            return obj_cur
        if req_cur:
            return req_cur
        raise RateError(
            "Objektwährung fehlt — bitte zuerst die Währung des Objekts "
            "einstellen.",
            status_code=422,
        )

    @staticmethod
    def _row(
        r: dict, date_price_count: int = 0, sync_status: str | None = None,
        derived_from_name: str | None = None,
    ) -> RatePlanResponse:
        return RatePlanResponse(
            id=r["id"],
            property_id=r["property_id"],
            # name/currency sind NOT NULL — kein erfundener Ersatz (Wurzel 4):
            # fehlt die Währung je durch einen Datenfehler, rendert das Frontend
            # symbollos (lib/currency) statt fälschlich EUR anzuzeigen.
            name=r.get("name") or "",
            base_price=float(r.get("base_price") or 0),
            currency=r.get("currency") or "",
            min_stay=int(r.get("min_stay") or 1),
            date_price_count=date_price_count,
            sync_status=sync_status,
            rate_mode=r.get("rate_mode") or "manual",
            derived_from_rate_plan_id=r.get("derived_from_rate_plan_id"),
            derived_from_name=derived_from_name,
            offset_amount=(
                float(r["offset_amount"])
                if r.get("offset_amount") is not None else None
            ),
            offset_percent=(
                float(r["offset_percent"])
                if r.get("offset_percent") is not None else None
            ),
            send_to_portals=bool(r.get("send_to_portals")),
        )

    def _sync_states(self, rate_plan_ids: list[str]) -> dict[str, bool]:
        """in_sync-Flag je Rate-Plan aus rate_plan_sync_state (kein N+1). Leer, wenn
        die Tabelle fehlt (Umgebung vor 0149) — dann kein Status-Badge (kein Crash)."""
        if not rate_plan_ids:
            return {}
        try:
            rows = (
                self._db()
                .table("rate_plan_sync_state")
                .select("rate_plan_id, in_sync")
                .in_("rate_plan_id", rate_plan_ids)
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001 — fehlende Tabelle = kein Status
            log.warning("rate_plan_sync_state_unavailable", error=str(exc))
            return {}
        return {
            str(r["rate_plan_id"]): bool(r.get("in_sync"))
            for r in rows
            if r.get("rate_plan_id") is not None
        }

    @staticmethod
    def _status_for(
        rate_plan_id: str, count: int, states: dict[str, bool]
    ) -> str | None:
        """Sync-Status eines Plans für die UI. Ohne Datumspreis (count 0) gibt es
        nichts zu übertragen → None (kein Badge). Mit Preisen: 'synced', wenn der
        Reconciler in_sync gemeldet hat; sonst 'pending' (Abweichung ODER noch nie
        abgeglichen — beides heißt: noch nicht bestätigt bei den Portalen)."""
        if count <= 0:
            return None
        return "synced" if states.get(rate_plan_id) else "pending"

    def _date_price_counts(self, rate_plan_ids: list[str]) -> dict[str, int]:
        """Anzahl gesetzter Datumspreise je Rate-Plan in EINER Query (kein N+1).
        Leer, wenn die Tabelle noch nicht existiert (Umgebung vor 0146) —
        die Übersicht zeigt dann eben keine Datumspreis-Zähler (kein Crash)."""
        if not rate_plan_ids:
            return {}
        try:
            rows = (
                self._db()
                .table("rate_plan_price_overrides")
                .select("rate_plan_id")
                .in_("rate_plan_id", rate_plan_ids)
                .not_.is_("price", "null")
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001 — fehlende Tabelle = keine Zähler
            log.warning("rate_plan_price_counts_unavailable", error=str(exc))
            return {}
        counts: dict[str, int] = {}
        for r in rows:
            rid = r.get("rate_plan_id")
            if isinstance(rid, str):
                counts[rid] = counts.get(rid, 0) + 1
        return counts

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
        ids = [r["id"] for r in res if r.get("id")]
        counts = self._date_price_counts(ids)
        states = self._sync_states(ids)
        items = [
            self._row(
                r,
                counts.get(r["id"], 0),
                self._status_for(r["id"], counts.get(r["id"], 0), states),
            )
            for r in res
        ]
        return RatePlanListResponse(items=items, total=len(items))

    _GRID_MAX_DAYS = 400  # Belegungsplan-Horizont; schützt vor Riesen-Ranges.

    def rate_grid(
        self, ctx: AuthContext, property_id: str, date_from: date, date_to: date
    ) -> RateGridResponse:
        """Rate-Grid für den Belegungsplan: alle Rate-Pläne des OBJEKTS mit ihrer
        echten Tageskurve [date_from, date_to) aus dem zentralen Resolver —
        dieselbe Wahrheit wie Quote und Channex-Push (kein zweiter Preis-Pfad).
        Ein Objekt = eine Einheit; mehrere Pläne (BAR/B&B) je Objekt möglich,
        KEINE Zimmerkategorie-Ebene."""
        from src.features.pricing.resolver import (  # noqa: PLC0415
            PricingError,
            PricingResolver,
        )

        tenant_id = self._require_tenant(ctx)
        self._require_own_property(tenant_id, property_id)
        if date_to <= date_from:
            raise RateError("date_to muss nach date_from liegen.", status_code=422)
        if (date_to - date_from).days > self._GRID_MAX_DAYS:
            raise RateError("Zeitraum zu groß.", status_code=422)
        plans = (
            self._db()
            .table("rate_plans")
            .select("*")
            .eq("property_id", property_id)
            .order("created_at")
            .execute()
        ).data or []
        ids = [p["id"] for p in plans if p.get("id")]
        counts = self._date_price_counts(ids)
        states = self._sync_states(ids)
        names = {p["id"]: (p.get("name") or "") for p in plans if p.get("id")}
        resolver = PricingResolver(service_client=self._db())
        grid_plans: list[RateGridPlan] = []
        for p in plans:
            try:
                days = resolver.effective_prices(
                    property_id, date_from, date_to, rate_plan_id=p["id"]
                )
            except PricingError:
                continue  # gelöschter/inkonsistenter Plan → Zeile weglassen
            is_derived = p.get("rate_mode") == "derived"
            grid_plans.append(
                RateGridPlan(
                    id=p["id"],
                    name=p.get("name") or "",
                    currency=p.get("currency") or "",
                    base_price=float(p.get("base_price") or 0),
                    min_stay=int(p.get("min_stay") or 1),
                    sync_status=self._status_for(
                        p["id"], counts.get(p["id"], 0), states
                    ),
                    rate_mode=p.get("rate_mode") or "manual",
                    derived_from_rate_plan_id=p.get("derived_from_rate_plan_id"),
                    derived_from_name=names.get(p.get("derived_from_rate_plan_id")),
                    offset_amount=(
                        float(p["offset_amount"])
                        if p.get("offset_amount") is not None else None
                    ),
                    offset_percent=(
                        float(p["offset_percent"])
                        if p.get("offset_percent") is not None else None
                    ),
                    price_read_only=is_derived,
                    days=[
                        RateGridDay(date=d.date, price=d.price, source=d.source)
                        for d in days
                    ],
                )
            )
        return RateGridResponse(property_id=property_id, plans=grid_plans)

    def create(self, ctx: AuthContext, req: RatePlanCreate) -> RatePlanResponse:
        tenant_id = self._require_tenant(ctx)
        prop = self._require_own_property(tenant_id, req.property_id)
        # Rate-Pläne hängen am OBJEKT (mehrere je Objekt möglich, z. B. BAR/B&B).
        # Währung kommt zentral vom Objekt (0161); ein abweichender Request → 422.
        eff_currency = self._effective_currency(prop, req.currency)
        derived = self._resolve_derived_fields(req.property_id, req)
        payload: dict[str, object] = {
            "property_id": req.property_id,
            "name": req.name,
            "base_price": req.base_price,
            "currency": eff_currency,
            "min_stay": req.min_stay,
            "send_to_portals": req.send_to_portals,
            **derived,  # rate_mode + (bei derived) Parent-Währung/-Basis
        }
        ins = (
            self._db().table("rate_plans").insert(payload).execute()
        ).data
        if not ins:
            raise RateError("Preisplan konnte nicht angelegt werden.", status_code=500)
        sync_currency = str(payload["currency"])
        self._sync_property(tenant_id, req.property_id, prop.get("title"), sync_currency)
        log.info("rate_plan_created", tenant_id=tenant_id, property_id=req.property_id)
        return self._row(ins[0])

    def set_base_price(
        self, ctx: AuthContext, req: RatePlanCreate
    ) -> RatePlanResponse:
        """Basispreis eines FeWo-Objekts setzen: den EINEN Plan aktualisieren,
        sonst anlegen (Upsert-Semantik in EINEM Server-Round-Trip).

        Nur für Objekte mit höchstens EINEM property-weiten Plan (FeWo). Ein
        Hotel (mehrere Pläne / kategorie-gebundene Pläne) hat keinen einzelnen
        „Objekt-Grundpreis" — dort MUSS pro Rate-Plan gepflegt werden; blindes
        Upserten überschrieb früher Name/Preis/min_stay des zufällig ältesten
        Plans (z. B. „BAR" → „Standard") und pushte das an die OTAs → 409.
        Beim Update werden NUR base_price + currency angefasst: Name und
        min_stay des bestehenden Plans sind fremde Pflege-Zustände (Wurzel 1).
        """
        tenant_id = self._require_tenant(ctx)
        prop = self._require_own_property(tenant_id, req.property_id)
        # Zentrale Objektwährung erzwingen (0161). Hat das Objekt noch keine, gilt
        # die Request-Währung UND wird zentral am Objekt festgeschrieben — so wird
        # die eine Wahrheit befüllt, statt zwei Quellen auseinanderlaufen zu lassen.
        eff_currency = self._effective_currency(prop, req.currency)
        if not (prop.get("currency") or "").strip():
            self._set_property_currency(req.property_id, eff_currency)
        existing = (
            self._db()
            .table("rate_plans")
            .select("id")
            .eq("property_id", req.property_id)
            .order("created_at")
            .limit(2)
            .execute()
        ).data or []
        if len(existing) > 1:
            raise RateError(
                "Dieses Objekt hat mehrere Preispläne — die Preise werden in der "
                "Kalender-Ansicht „Preise“ je Rate-Plan gepflegt.", status_code=409,
            )
        if existing:
            patch: dict[str, object] = {
                "base_price": req.base_price,
                "currency": eff_currency,
            }
            row = (
                self._db()
                .table("rate_plans")
                .update(patch)
                .eq("id", existing[0]["id"])
                .execute()
            ).data
            result = row[0] if row else {**patch, "id": existing[0]["id"],
                                          "name": req.name, "min_stay": req.min_stay,
                                          "property_id": req.property_id}
        else:
            row = (
                self._db()
                .table("rate_plans")
                .insert({
                    "property_id": req.property_id,
                    "name": req.name,
                    "base_price": req.base_price,
                    "currency": eff_currency,
                    "min_stay": req.min_stay,
                })
                .execute()
            ).data
            if not row:
                raise RateError(
                    "Preisplan konnte nicht angelegt werden.", status_code=500
                )
            result = row[0]
        self._sync_property(tenant_id, req.property_id, prop.get("title"), eff_currency)
        # Neuer Basispreis → Tageskurve bei Channex veraltet: Reconcile einreihen
        # (coalesced; ohne Mapping zieht der 15-min-Tick nach dem Content-Sync nach).
        try:
            enqueue(
                self._db(),
                "reconcile_rate_plan_prices",
                tenant_id=tenant_id,
                payload={"tenant_id": tenant_id, "property_id": req.property_id},
                dedup_key=dedup_key(
                    tenant_id, req.property_id, "reconcile_rate_plan_prices"
                ),
            )
        except Exception as exc:  # noqa: BLE001 — Einreihen kippt den Request nie
            log.warning(
                "rate_base_price_reconcile_enqueue_failed",
                tenant_id=tenant_id, error=str(exc)[:200],
            )
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
        # Zentrale Objektwährung erzwingen (0161): eine per PATCH gesetzte
        # abweichende Währung wird abgewiesen, damit ein einzelner Plan die
        # Objektwährung nicht aushebelt (Channex: 1 Objekt = 1 Währung). Nur
        # prüfen, wenn das Objekt eine zentrale Währung hat und der Request eine
        # Währung mitschickt.
        if req.currency is not None:
            obj_currency = (
                (self._db()
                 .table("properties")
                 .select("currency")
                 .eq("id", existing[0]["property_id"])
                 .limit(1)
                 .execute()).data or [{}]
            )[0].get("currency")
            if obj_currency and req.currency.upper() != obj_currency.upper():
                raise RateError(
                    "Die Währung wird zentral am Objekt eingestellt "
                    f"({obj_currency.upper()}) und gilt für alle Preispläne.",
                    status_code=422,
                )
        # Ein abgeleiteter Plan hat KEINE eigene Währung/Basis — beides gehört dem
        # Parent (Wurzel 4: keine zweite Währungs-Wahrheit). Ohne diesen Guard
        # könnte ein PATCH {currency: "USD"} OHNE rate_mode an
        # _resolve_derived_fields vorbeilaufen und das Kind von seinem Parent
        # entkoppeln (Kind USD, Parent EUR).
        stays_derived = (
            req.rate_mode == "derived"
            or (req.rate_mode is None and existing[0].get("rate_mode") == "derived")
        )
        if stays_derived and (req.currency is not None or req.base_price is not None):
            raise RateError(
                "Ein abgeleiteter Plan übernimmt Währung und Grundpreis vom "
                "Basis-Plan — beides kann hier nicht gesetzt werden.",
                status_code=422,
            )
        # rate_mode berührt? Ableitungs-Felder validieren + normalisieren. Ohne
        # rate_mode im Request bleiben die derived-Spalten unverändert (Teil-Update).
        if req.rate_mode is not None:
            # exclude_none verwirft offset=None → für den Wechsel derived→manual
            # müssen die Spalten aber explizit genullt werden. _resolve_derived_fields
            # liefert die vollständigen Zielwerte (inkl. None).
            # Die Währung des BESTEHENDEN Plans ist Pflichtdatum; fehlt sie, ist
            # die Zeile kaputt → klar fehlschlagen statt einen Wert zu erfinden
            # (Wurzel 4). _resolve_derived_fields liest sie ohnehin nur formal.
            existing_currency = existing[0].get("currency")
            if not existing_currency:
                raise RateError(
                    "Dem Preisplan fehlt die Währung — bitte Support kontaktieren.",
                    status_code=422,
                )
            derived = self._resolve_derived_fields(
                existing[0]["property_id"],
                RatePlanCreate(
                    property_id=existing[0]["property_id"],
                    base_price=0, currency=existing_currency,
                    rate_mode=req.rate_mode,
                    derived_from_rate_plan_id=req.derived_from_rate_plan_id,
                    offset_amount=req.offset_amount,
                    offset_percent=req.offset_percent,
                ),
            )
            # base_price/currency aus derived nur bei rate_mode=derived übernehmen
            # (Kind erbt Parent); bei manual die vom Nutzer gesetzten behalten.
            if req.rate_mode == "manual":
                derived.pop("base_price", None)
                derived.pop("currency", None)
            patch.update(derived)
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
        # Tageskurve bei Channex veraltet → Desired-State-Reconcile einreihen
        # (coalesced je Objekt) statt auf den 15-min-Tick zu warten. Auslöser:
        # Basispreis ODER jede Änderung an der Ableitung (Modus/Basis-Plan/Offsets)
        # — ein geänderter Offset verschiebt die Kurve des Plans sofort, ohne dass
        # base_price im Patch steht (Wurzel 1: Gegenzustand mitpflegen).
        price_relevant = {
            "base_price", "rate_mode", "derived_from_rate_plan_id",
            "offset_amount", "offset_percent",
        }
        if price_relevant & set(patch):
            try:
                enqueue(
                    self._db(),
                    "reconcile_rate_plan_prices",
                    tenant_id=tenant_id,
                    payload={
                        "tenant_id": tenant_id,
                        "property_id": row["property_id"],
                    },
                    dedup_key=dedup_key(
                        tenant_id, row["property_id"], "reconcile_rate_plan_prices"
                    ),
                )
            except Exception as exc:  # noqa: BLE001 — Einreihen kippt den Request nie
                log.warning(
                    "rate_plan_reconcile_enqueue_failed",
                    tenant_id=tenant_id, error=str(exc)[:200],
                )
        else:
            # Sonst: hängen Kinder an diesem Plan, kann eine sonstige Änderung sie
            # trotzdem betreffen (der Reconcile oben deckt das Objekt bereits ab,
            # darum nur im else-Zweig — sonst zwei Jobs für denselben Effekt).
            self._propagate_to_children(tenant_id, row["property_id"], rate_plan_id)
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
        # Gegenzustand (Wurzel 1): ein Parent mit abgeleiteten Kindern darf nicht
        # gelöscht werden — sonst verlören die Kinder ihre Preisgrundlage. Klar
        # fehlschlagen (409), nicht kaskadierend löschen. DB-FK (on delete restrict)
        # ist der zusätzliche Backstop.
        children = self._derived_children(rate_plan_id)
        if children:
            raise RateError(
                "Dieser Plan ist Basis für abgeleitete Pläne — zuerst diese "
                "löschen oder auf einen anderen Basis-Plan umstellen.",
                status_code=409,
            )
        self._db().table("rate_plans").delete().eq("id", rate_plan_id).execute()
        # Löschkette (Channex-Doku „break the chain"): Content-Sync einreihen —
        # dessen Prune entfernt den verwaisten Channex-Rate-Plan (fail-closed,
        # wenn er noch an einen Kanal gemappt ist) und schließt das Mapping.
        try_enqueue_content_sync(
            self._db(), tenant_id, existing[0]["property_id"]
        )
        log.info("rate_plan_deleted", tenant_id=tenant_id, rate_plan_id=rate_plan_id)

    def _resolve_derived_fields(
        self, property_id: str, req: RatePlanCreate | RatePlanUpdate,
    ) -> dict[str, object]:
        """Ableitungs-Felder validieren + normalisieren (Wurzel 3/4).

        manual → alle derived-Felder auf None. derived → Parent MUSS existieren,
        demselben OBJEKT gehören und selbst manual sein (keine Kaskade); das Kind
        erbt Währung + Grundpreis (Referenz) des Parents. Gibt den DB-Patch der
        rate_mode/derived-Spalten zurück (currency/base_price für derived
        mit-gesetzt). Bei manual: nur rate_mode + Null-Felder."""
        if req.rate_mode != "derived":
            return {
                "rate_mode": "manual",
                "derived_from_rate_plan_id": None,
                "offset_amount": None,
                "offset_percent": None,
            }
        parent_id = req.derived_from_rate_plan_id
        if not parent_id:
            raise RateError(
                "Für einen abgeleiteten Plan ist ein Basis-Plan nötig.",
                status_code=422,
            )
        parent = (
            self._db()
            .table("rate_plans")
            .select("id, property_id, currency, base_price, rate_mode")
            .eq("id", parent_id)
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        ).data or []
        if not parent:
            raise RateError(
                "Der Basis-Plan gehört nicht zu diesem Objekt.", status_code=422
            )
        if parent[0].get("rate_mode") == "derived":
            raise RateError(
                "Ein abgeleiteter Plan kann nicht selbst als Basis dienen "
                "(keine Ketten-Ableitung).", status_code=422,
            )
        if req.offset_amount is None and req.offset_percent is None:
            # 1:1-Spiegel ist zulässig (SiteMinder „Keep rates the same"), aber
            # dann müssen beide Offsets explizit None bleiben — kein Ratewert.
            pass
        return {
            "rate_mode": "derived",
            "derived_from_rate_plan_id": parent_id,
            "offset_amount": req.offset_amount,
            "offset_percent": req.offset_percent,
            # Kind erbt Parent-Währung (Wurzel 4: keine zweite Währungs-Wahrheit).
            "currency": parent[0].get("currency"),
            "base_price": float(parent[0].get("base_price") or 0),
        }

    def _derived_children(self, rate_plan_id: str) -> list[str]:
        """IDs aller Pläne, die von rate_plan_id ableiten (Propagation/Lösch-Guard)."""
        rows = (
            self._db()
            .table("rate_plans")
            .select("id")
            .eq("derived_from_rate_plan_id", rate_plan_id)
            .execute()
        ).data or []
        return [r["id"] for r in rows if r.get("id")]

    def _propagate_to_children(
        self, tenant_id: str, property_id: str, rate_plan_id: str
    ) -> None:
        """Preisänderung eines Plans an seine abgeleiteten Kinder weitergeben
        (Wurzel 1: der Gegenzustand muss mitgepflegt werden).

        Hat der Plan Kinder, ändert sich deren Kurve fachlich SOFORT mit — ohne
        das hier behielten die OTAs den alten Kind-Preis bis zum nächsten
        Reconcile-Tick (bis zu 15 min falscher Verkaufspreis).

        Bewusst der objektweite `reconcile_rate_plan_prices` statt eines direkten
        Segment-Pushes: der Reconcile rechnet jede Kurve über den zentralen
        Resolver (ari_push.reconcile_rate_plan_prices) — die Ableitungsformel
        bleibt damit an EINER Stelle. Würde der Service den Kindpreis selbst
        rechnen, gäbe es eine zweite Preis-Wahrheit (Wurzel 4). Coalesced je
        Objekt: mehrere Kinder = EIN Job."""
        if not self._derived_children(rate_plan_id):
            return
        try:
            enqueue(
                self._db(),
                "reconcile_rate_plan_prices",
                tenant_id=tenant_id,
                payload={"tenant_id": tenant_id, "property_id": property_id},
                dedup_key=dedup_key(
                    tenant_id, property_id, "reconcile_rate_plan_prices"
                ),
            )
        except Exception as exc:  # noqa: BLE001 — Einreihen darf den Request nie kippen
            log.warning(
                "rate_plan_child_propagation_enqueue_failed",
                tenant_id=tenant_id, rate_plan_id=rate_plan_id,
                error=str(exc)[:200],
            )

    def _require_own_rate_plan(self, tenant_id: str, rate_plan_id: str) -> dict:
        """Einen Rate-Plan laden UND auf den Tenant scopen in EINEM Schritt (Wurzel 3:
        Load und Scope nicht trennen). Service-Role umgeht RLS → der Join auf
        properties.tenant_id ist der einzige Eigentums-Backstop."""
        res = (
            self._db()
            .table("rate_plans")
            .select("id, property_id, rate_mode, properties!inner(tenant_id)")
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
        # Abgeleitete Pläne haben keinen eigenen Preis — er folgt dem Basis-Plan
        # (erst Betrag, dann Prozent). Datumspreise darauf zu setzen, wäre eine
        # zweite Preis-Wahrheit (Wurzel 4) → klar fehlschlagen.
        if plan.get("rate_mode") == "derived":
            raise RateError(
                "Bei einem abgeleiteten Plan werden Preise nicht direkt gesetzt — "
                "sie folgen dem Basis-Plan.", status_code=422,
            )
        days = _weekday_filtered(req.start, req.end, req.weekdays)
        if req.price is None:
            # Zurücknehmen: betroffene Tage löschen → Basispreis gilt wieder.
            # Ohne Maske ein Bereichs-Delete; mit Maske tag-genau (nur die
            # ausgewählten Wochentage), damit die anderen Tage unangetastet bleiben.
            delete_q = (
                self._db()
                .table("rate_plan_price_overrides")
                .delete()
                .eq("rate_plan_id", rate_plan_id)
            )
            if req.weekdays:
                delete_q.in_("date", [d.isoformat() for d in days]).execute()
            else:
                (
                    delete_q.gte("date", req.start.isoformat())
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
        # Preis an Channex pushen — als Rate-Segmente mit rate_plan_id (nur DIESER
        # Plan). Aus den betroffenen Tagen zusammenhängende Bereiche bilden
        # (Wochentagsmaske → mehrere Segmente).
        rate_cents = None if req.price is None else int(round(req.price * 100))
        for seg_from, seg_to in merge_day_ranges(days, end_exclusive=False):
            self._enqueue_rate_plan_push(
                tenant_id, property_id, rate_plan_id,
                seg_from, seg_to + timedelta(days=1), rate_cents,
            )
        self._propagate_to_children(tenant_id, property_id, rate_plan_id)
        log.info(
            "rate_plan_prices_set",
            tenant_id=tenant_id,
            rate_plan_id=rate_plan_id,
            days=len(days),
            cleared=req.price is None,
        )
        return self.list_prices(ctx, rate_plan_id)

    def resync_prices(self, ctx: AuthContext, rate_plan_id: str) -> None:
        """'Jetzt übertragen': einen Desired-State-Reconcile-Job für das Objekt
        dieses Rate-Plans einreihen (DB-Preise ↔ Channex-Ist abgleichen, Differenz
        pushen). Tenant-gescoped. Coalesced je Objekt (mehrfaches Klicken = EIN
        Reconcile). Der 15-min-Tick macht dasselbe automatisch."""
        tenant_id = self._require_tenant(ctx)
        plan = self._require_own_rate_plan(tenant_id, rate_plan_id)
        property_id = plan["property_id"]
        try:
            enqueue(
                self._db(),
                "reconcile_rate_plan_prices",
                tenant_id=tenant_id,
                payload={"tenant_id": tenant_id, "property_id": property_id},
                dedup_key=dedup_key(
                    tenant_id, property_id, "reconcile_rate_plan_prices"
                ),
            )
        except Exception as exc:  # noqa: BLE001 — Einreihen darf den Request nie kippen
            log.warning(
                "resync_prices_enqueue_failed",
                tenant_id=tenant_id, rate_plan_id=rate_plan_id, error=str(exc)[:200],
            )
        log.info(
            "rate_plan_prices_resync_requested",
            tenant_id=tenant_id, rate_plan_id=rate_plan_id,
        )

    def clear_all_prices(
        self, ctx: AuthContext, rate_plan_id: str
    ) -> RatePlanPriceListResponse:
        """ALLE Datumspreise eines Rate-Plans zurücknehmen (Basispreis gilt wieder).
        Tenant-gescoped. Idempotent (nichts da → nichts passiert). Der Content-Sync
        setzt den Rate-Plan-Default an Channex zurück (kein „Preis weg"-Push)."""
        tenant_id = self._require_tenant(ctx)
        plan = self._require_own_rate_plan(tenant_id, rate_plan_id)
        (
            self._db()
            .table("rate_plan_price_overrides")
            .delete()
            .eq("rate_plan_id", rate_plan_id)
            .execute()
        )
        # Basispreis wieder an Channex spiegeln (Reconcile-Tick gleicht zusätzlich ab).
        self._sync_property(tenant_id, plan["property_id"], None, None)
        self._propagate_to_children(tenant_id, plan["property_id"], rate_plan_id)
        log.info(
            "rate_plan_prices_cleared_all",
            tenant_id=tenant_id,
            rate_plan_id=rate_plan_id,
        )
        return self.list_prices(ctx, rate_plan_id)

    # -- Datumsgenauer Mindestaufenthalt pro Rate-Plan (Hotel) ----------------
    def list_min_stays(
        self, ctx: AuthContext, rate_plan_id: str
    ) -> RatePlanMinStayListResponse:
        """Datumsgenaue Mindestaufenthalte eines Rate-Plans. Tenant-gescoped."""
        tenant_id = self._require_tenant(ctx)
        self._require_own_rate_plan(tenant_id, rate_plan_id)
        rows = (
            self._db()
            .table("rate_plan_min_stay_overrides")
            .select("date, min_stay")
            .eq("rate_plan_id", rate_plan_id)
            .not_.is_("min_stay", "null")
            .order("date")
            .execute()
        ).data or []
        items = [
            RatePlanMinStayDay(date=r["date"], min_stay=int(r["min_stay"]))
            for r in rows
            if r.get("date") is not None and r.get("min_stay") is not None
        ]
        return RatePlanMinStayListResponse(rate_plan_id=rate_plan_id, items=items)

    def set_min_stays(
        self, ctx: AuthContext, rate_plan_id: str, req: RatePlanMinStaySet
    ) -> RatePlanMinStayListResponse:
        """Datumsgenauen Mindestaufenthalt für [start, end) setzen oder (min_stay=
        None) zurücknehmen. Idempotent über unique(rate_plan_id, date) (Wurzel 2).
        Push an GENAU diesen Rate-Plan (min_stay_arrival/through), alle 3 Wege gleich."""
        tenant_id = self._require_tenant(ctx)
        plan = self._require_own_rate_plan(tenant_id, rate_plan_id)
        property_id = plan["property_id"]
        # Min-Stay bleibt auch für abgeleitete Pläne editierbar — nur PREISE folgen
        # dem Basis-Plan, Restriktionen sind pro Plan eigenständig.
        days = _weekday_filtered(req.start, req.end, req.weekdays)
        if req.min_stay is None:
            delete_q = (
                self._db()
                .table("rate_plan_min_stay_overrides")
                .delete()
                .eq("rate_plan_id", rate_plan_id)
            )
            if req.weekdays:
                delete_q.in_("date", [d.isoformat() for d in days]).execute()
            else:
                (
                    delete_q.gte("date", req.start.isoformat())
                    .lt("date", req.end.isoformat())
                    .execute()
                )
        else:
            self._db().table("rate_plan_min_stay_overrides").upsert(
                [
                    {
                        "rate_plan_id": rate_plan_id,
                        "date": d.isoformat(),
                        "min_stay": req.min_stay,
                    }
                    for d in days
                ],
                on_conflict="rate_plan_id,date",
            ).execute()
        for seg_from, seg_to in merge_day_ranges(days, end_exclusive=False):
            self._enqueue_rate_plan_min_stay_push(
                tenant_id, property_id, rate_plan_id,
                seg_from, seg_to + timedelta(days=1), req.min_stay,
            )
        log.info(
            "rate_plan_min_stays_set",
            tenant_id=tenant_id,
            rate_plan_id=rate_plan_id,
            days=len(days),
            cleared=req.min_stay is None,
        )
        return self.list_min_stays(ctx, rate_plan_id)

    def clear_all_min_stays(
        self, ctx: AuthContext, rate_plan_id: str
    ) -> RatePlanMinStayListResponse:
        """ALLE datumsgenauen Mindestaufenthalte eines Rate-Plans zurücknehmen
        (Rate-Plan-Default gilt wieder). Tenant-gescoped, idempotent."""
        tenant_id = self._require_tenant(ctx)
        plan = self._require_own_rate_plan(tenant_id, rate_plan_id)
        (
            self._db()
            .table("rate_plan_min_stay_overrides")
            .delete()
            .eq("rate_plan_id", rate_plan_id)
            .execute()
        )
        self._sync_property(tenant_id, plan["property_id"], None, None)
        log.info(
            "rate_plan_min_stays_cleared_all",
            tenant_id=tenant_id, rate_plan_id=rate_plan_id,
        )
        return self.list_min_stays(ctx, rate_plan_id)

    # -- Restriktionen (CTA/CTD/Max-Stay) pro Rate-Plan × Datum (0153) ---------
    def list_restrictions(
        self, ctx: AuthContext, rate_plan_id: str
    ) -> RatePlanRestrictionListResponse:
        """Datumsgenaue Restriktionen eines Rate-Plans (nur gesetzte Tage).
        Tenant-gescoped."""
        tenant_id = self._require_tenant(ctx)
        self._require_own_rate_plan(tenant_id, rate_plan_id)
        rows = (
            self._db()
            .table("rate_plan_restriction_overrides")
            .select("date, closed_to_arrival, closed_to_departure, max_stay")
            .eq("rate_plan_id", rate_plan_id)
            .order("date")
            .execute()
        ).data or []
        items = [
            RatePlanRestrictionDay(
                date=r["date"],
                closed_to_arrival=r.get("closed_to_arrival"),
                closed_to_departure=r.get("closed_to_departure"),
                max_stay=r.get("max_stay"),
            )
            for r in rows
            if r.get("date") is not None
        ]
        return RatePlanRestrictionListResponse(rate_plan_id=rate_plan_id, items=items)

    def set_restrictions(
        self, ctx: AuthContext, rate_plan_id: str, req: RatePlanRestrictionSet
    ) -> RatePlanRestrictionListResponse:
        """Restriktionen (CTA/CTD/Max-Stay) für [start, end) auf den GEWÜNSCHTEN
        Endzustand setzen. Alle drei None = Override zurücknehmen. Idempotent über
        unique(rate_plan_id, date) (Wurzel 2). Push an GENAU diesen Rate-Plan über
        den restriction_rows-Weg; Zurücknehmen pusht explizit offen/kein Limit
        (Wurzel 1: der Portal-Stand muss der Rücknahme folgen, nicht hängen
        bleiben)."""
        tenant_id = self._require_tenant(ctx)
        plan = self._require_own_rate_plan(tenant_id, rate_plan_id)
        property_id = plan["property_id"]
        clearing = (
            req.closed_to_arrival is None
            and req.closed_to_departure is None
            and req.max_stay is None
        )
        # Restriktionen bleiben auch für abgeleitete Pläne editierbar.
        days = _weekday_filtered(req.start, req.end, req.weekdays)
        if clearing:
            delete_q = (
                self._db()
                .table("rate_plan_restriction_overrides")
                .delete()
                .eq("rate_plan_id", rate_plan_id)
            )
            if req.weekdays:
                delete_q.in_("date", [d.isoformat() for d in days]).execute()
            else:
                (
                    delete_q.gte("date", req.start.isoformat())
                    .lt("date", req.end.isoformat())
                    .execute()
                )
        else:
            # Endzustand schreiben: ALLE drei Spalten (auch None) — die Zeile
            # spiegelt danach exakt den Editor-Stand, keine Altwert-Reste.
            self._db().table("rate_plan_restriction_overrides").upsert(
                [
                    {
                        "rate_plan_id": rate_plan_id,
                        "date": d.isoformat(),
                        "closed_to_arrival": req.closed_to_arrival,
                        "closed_to_departure": req.closed_to_departure,
                        "max_stay": req.max_stay,
                    }
                    for d in days
                ],
                on_conflict="rate_plan_id,date",
            ).execute()
        # Portal-Push: explizite Endwerte — beim Zurücknehmen offen/kein Limit
        # (false/false/0), sonst bliebe die OTA-Seite auf dem alten Stand. Bei
        # Wochentagsmaske je zusammenhängendem Bereich eine Zeile.
        for seg_from, seg_to in merge_day_ranges(days, end_exclusive=False):
            try_enqueue_ari(
                self._db(), tenant_id, property_id, "restriction_rows",
                {"rows": [{
                    "date_from": seg_from.isoformat(),
                    "date_to": seg_to.isoformat(),
                    "rate_plan_id": rate_plan_id,
                    "closed_to_arrival": bool(req.closed_to_arrival),
                    "closed_to_departure": bool(req.closed_to_departure),
                    "max_stay": req.max_stay if req.max_stay is not None else 0,
                }]},
            )
        log.info(
            "rate_plan_restrictions_set",
            tenant_id=tenant_id,
            rate_plan_id=rate_plan_id,
            days=len(days),
            cleared=clearing,
        )
        return self.list_restrictions(ctx, rate_plan_id)

    def _enqueue_rate_plan_min_stay_push(
        self,
        tenant_id: str,
        property_id: str,
        rate_plan_id: str,
        start: date,
        end: date,
        min_stay: int | None,
    ) -> None:
        """Einen rate-plan-genauen Min-Stay-Push einreihen (min_stay_arrival/through).
        Beim Zurücknehmen (min_stay None) kein Push — der Content-/Reconcile-Sync
        setzt den Rate-Plan-Default wieder; der Reconcile-Tick gleicht ab."""
        if min_stay is None:
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
                        "date_to": (end - timedelta(days=1)).isoformat(),
                        "min_stay": min_stay,
                        "rate_plan_id": rate_plan_id,
                    }
                ]
            },
        )

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
