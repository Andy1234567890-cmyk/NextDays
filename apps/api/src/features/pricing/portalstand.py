"""Soll/Ist je Tag: was wir berechnet haben — und was bei den Portalen steht.

WARUM
=====
Am 04.09.2026 zeigte der Kalender 541,45 DKK, Channex fuehrte 433,16 DKK, und
keine Oberflaeche sagte es. 435 von 540 Tagen standen falsch, sichtbar erst im
Extranet. Weder Hostaway noch SiteMinder zeigen diese Differenz direkt; wir
haben sie im Haus: `channex_ari_shadow` ist der lokale Spiegel des zuletzt
erfolgreich gepushten Stands (Channex verbietet das Zuruecklesen der ARI).

Der Vergleich ist bewusst gegen den SCHATTEN, nicht gegen die Outbox: eine
Outbox-Zeile 'done' kann reine min_stay-Segmente enthalten (so entstand der
Fehler in Migration 0560). Nur der Schatten sagt, welcher PREIS drauf ist.
"""
from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import fetch_all_rows
from src.features.auth.owner_scope import is_owner, owner_property_ids
from src.features.channel_manager.ota_aktionen import aktionsfaktor_je_tag
from src.jobs.queue import dedup_key, enqueue

from .freigabe import FREIGABE_HORIZONT_TAGE, gesperrte_tage
from .ki_schemas import Portalstand, PortalstandTag
from .resolver import PricingError, PricingResolver

log = get_logger("nextdays.pricing.portalstand")

# Ab wann eine Abweichung zaehlt: Rundung Cent ↔ Betrag ergibt Bruchteile eines
# Prozents, das ist keine Drift.
_TOLERANZ_PCT = 0.5
# Wurzel 8: harte Obergrenze je Aufruf (ein Jahr, wie der Push-Horizont).
_MAX_TAGE = FREIGABE_HORIZONT_TAGE + 1


class PortalstandService:
    def __init__(self, service_client: Client | None = None) -> None:
        self._client = service_client

    def _db(self) -> Client:
        if self._client is None:
            raise PricingError("Preis-DB nicht verfuegbar.", status_code=500)
        return self._client

    def _require_own_property(self, ctx: AuthContext, property_id: str) -> None:
        if not ctx.tenant_id:
            raise PricingError("Kein Tenant im Konto.", status_code=400)
        res = (
            self._db()
            .table("properties")
            .select("id")
            .eq("id", property_id)
            .eq("tenant_id", ctx.tenant_id)
            .limit(1)
            .execute()
        ).data
        if not res:
            raise PricingError("Objekt nicht gefunden.", status_code=404)
        if is_owner(ctx) and property_id not in owner_property_ids(self._db(), ctx):
            raise PricingError("Objekt nicht gefunden.", status_code=404)

    def stand(
        self, ctx: AuthContext, property_id: str, von: date, bis: date
    ) -> Portalstand:
        """Soll (Resolver, dieselbe Wahrheit wie Kalender und Push) gegen Ist
        (Schatten des DP-Ratenplans bzw. des Grundpreis-Plans) je Tag."""
        self._require_own_property(ctx, property_id)
        if bis < von:
            raise PricingError("Das Ende liegt vor dem Anfang.", status_code=422)
        if (bis - von).days + 1 > _MAX_TAGE:
            raise PricingError(
                f"Zeitraum zu lang (hoechstens {_MAX_TAGE} Tage).", status_code=422
            )
        plan = self._ratenplan(property_id)
        if plan is None:
            return Portalstand(
                property_id=property_id, tage=[], abweichend=0,
                hinweis="Kein Ratenplan — ohne Ratenplan gibt es keinen Portalpreis.",
            )
        rate_plan_id, waehrung = plan
        # Das Soll ist DIESELBE Rechnung wie der Push (ari_push.
        # _load_desired_rate_plan_prices): Resolver-Preis, gesenkt um den
        # Aktionsfaktor, ohne die Tage, die auf Freigabe warten. Live am
        # 05.09.2026: „Winterrabatt −20 %" auf 111 Tage — der Push schickte
        # korrekt 80 %, dieser Vergleich hielt den Listenpreis dagegen und
        # meldete 111 Abweichungen, die kein Abgleich je beseitigen konnte.
        # Der Knopf stand auf „Abgleich läuft", bis in alle Ewigkeit.
        soll = {
            d.date.isoformat(): d.price
            for d in PricingResolver(service_client=self._db()).effective_prices(
                property_id, von, bis + timedelta(days=1), rate_plan_id=rate_plan_id
            )
        }
        aktionen = aktionsfaktor_je_tag(self._db(), property_id, von=von, bis=bis)
        gesperrt = gesperrte_tage(self._db(), property_id, von, bis + timedelta(days=1))
        ist, stand = self._schatten(ctx.tenant_id or "", rate_plan_id, von, bis)
        tage: list[PortalstandTag] = []
        abweichend = 0
        cur = von
        while cur <= bis:
            iso = cur.isoformat()
            b = soll.get(iso)
            faktor = aktionen.get(iso)
            aktion_pct: float | None = None
            if b is not None and faktor is not None:
                b = round(b * faktor, 2)
                aktion_pct = round((faktor - 1) * 100.0, 2)
            if iso in gesperrt:
                # Wartet auf Freigabe: der Push lässt den Tag aus, also ist
                # der alte Portalpreis dort kein Fehler.
                b = None
            p = ist.get(iso)
            pct: float | None = None
            if b is not None and p is not None and p > 0:
                pct = round((b - p) / p * 100.0, 2)
                if abs(pct) > _TOLERANZ_PCT:
                    abweichend += 1
            tage.append(
                PortalstandTag(
                    date=cur, berechnet=b, portal=p, abweichung_pct=pct, aktion_pct=aktion_pct
                )
            )
            cur += timedelta(days=1)
        log.info(
            "dp_portalstand_gerechnet",
            property_id=property_id,
            tage=len(tage),
            abweichend=abweichend,
            mit_aktion=sum(1 for t in tage if t.aktion_pct is not None),
            gesperrt=len(gesperrt),
        )
        hinweis = None
        if not ist:
            hinweis = (
                "Fuer diesen Zeitraum liegt kein gesendeter Stand vor — die "
                "Portale haben von uns noch keinen Preis bekommen."
            )
        return Portalstand(
            property_id=property_id,
            waehrung=waehrung,
            rate_plan_id=rate_plan_id,
            tage=tage,
            abweichend=abweichend,
            schatten_stand=stand,
            hinweis=hinweis,
        )

    def angleichen(self, ctx: AuthContext, property_id: str) -> None:
        """Die Differenz JETZT nachsenden — als Job (Channex-Budget), nicht
        synchron. Der Handler ist derselbe wie der taegliche Abgleich; er sendet
        nur, was vom Schatten abweicht (Wurzel 2: nichts doppelt)."""
        self._require_own_property(ctx, property_id)
        if is_owner(ctx):
            raise PricingError("Eigentuemer koennen nicht senden.", status_code=403)
        if not ctx.tenant_id:
            raise PricingError("Kein Tenant im Konto.", status_code=400)
        enqueue(
            self._db(),
            "reconcile_rate_plan_prices",
            tenant_id=ctx.tenant_id,
            payload={"tenant_id": ctx.tenant_id, "property_id": property_id},
            dedup_key=dedup_key(ctx.tenant_id, property_id, "reconcile_rate_plan_prices"),
        )
        log.info("dp_portalstand_angleichen_eingereiht", property_id=property_id)

    # -- intern -----------------------------------------------------------------------
    def _ratenplan(self, property_id: str) -> tuple[str, str | None] | None:
        """DP-Ratenplan (dp_settings.rate_plan_id) oder der aelteste Plan des
        Objekts — derselbe, dessen Basispreis die Engine als Anker nimmt."""
        s = (
            self._db()
            .table("dp_settings")
            .select("rate_plan_id")
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        ).data or []
        rp = s[0].get("rate_plan_id") if s else None
        q = self._db().table("rate_plans").select("id, currency").eq("property_id", property_id)
        q = q.eq("id", rp) if rp else q.order("created_at")
        res = q.limit(1).execute().data or []
        if not res:
            return None
        return str(res[0]["id"]), res[0].get("currency")

    def _schatten(
        self, tenant_id: str, rate_plan_id: str, von: date, bis: date
    ) -> tuple[dict[str, float], str | None]:
        try:
            rows = fetch_all_rows(
                self._db()
                .table("channex_ari_shadow")
                .select("date, rate_cents, updated_at")
                .eq("tenant_id", tenant_id)
                .eq("rate_plan_id", rate_plan_id)
                .gte("date", von.isoformat())
                .lte("date", bis.isoformat())
                .order("date")
            )
        except Exception as exc:  # noqa: BLE001 — fehlende Tabelle = kein Ist
            log.warning("dp_portalstand_schatten_unlesbar", error=str(exc)[:200])
            return {}, None
        out: dict[str, float] = {}
        stand: str | None = None
        for r in rows:
            cents = r.get("rate_cents")
            if cents is None:
                continue
            out[str(r["date"])[:10]] = round(int(cents) / 100.0, 2)
            u = r.get("updated_at")
            if u and (stand is None or str(u) > stand):
                stand = str(u)
        return out, stand


def heute_utc() -> date:
    return datetime.now(UTC).date()


__all__ = ["PortalstandService", "heute_utc"]
