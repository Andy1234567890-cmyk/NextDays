"""Auskuenfte des Dynamic Pricing, die nichts veraendern (0562):

  * VORSCHAU  — die Kurve, wie sie MIT eingeschalteter Automatik waere
                (Hostaway „Subscribe & Review": erst sehen, dann einschalten).
  * FORECAST  — erwartete Belegung der naechsten 90 Tage aus der gelernten
                Pickup-Kurve, daneben die Angebotsdichte der Umgebung
                (SiteMinder „Forecasting"/„Pace").
  * VERLAUF   — wer hat wann was gesetzt, wann ging was raus
                (SiteMinder „History").

Alles lesend. Die Vorschau rechnet ueber `recompute.preis_kurve` — DIESELBE
Funktion wie der echte Lauf, sonst zeigt sie etwas anderes als spaeter gilt.
"""
from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import fetch_all_rows
from src.features.auth.owner_scope import is_owner, owner_property_ids

from .forecast import PickupCurveModel, PickupObservation, _lead_bucket, _season_bucket
from .ki_schemas import Forecast, ForecastTag, VerlaufEintrag, VorschauTag
from .recompute import DynamicPricingRecompute
from .resolver import PricingError

log = get_logger("nextdays.pricing.auskunft")

# Vorschau: hoechstens ein Jahr je Aufruf (Wurzel 8).
_VORSCHAU_MAX_TAGE = 366
# Forecast-Horizont wie SiteMinder (90 Tage).
FORECAST_TAGE = 90
# Ab welchem Abstand zwischen belegt und erwartet „vor"/„hinter" gilt.
_PACE_SCHWELLE = 0.05
# Verlauf: hoechstens so viele Eintraege je Aufruf.
_VERLAUF_MAX = 200
# Ein Markt-Stichtag gilt fuer Tage im Umkreis von +-3 Tagen.
_MARKT_NAEHE_TAGE = 3


class AuskunftService:
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

    # -- Vorschau ---------------------------------------------------------------
    def vorschau(
        self, ctx: AuthContext, property_id: str, von: date, bis: date
    ) -> list[VorschauTag]:
        """Kurve [von, bis] mit den GESPEICHERTEN Einstellungen, aber ohne den
        Schalter: so wuerde es aussehen. Nichts wird geschrieben oder gesendet.
        Leer, wenn kein Basispreis existiert (kein erfundener Preis)."""
        self._require_own_property(ctx, property_id)
        if bis < von:
            raise PricingError("Das Ende liegt vor dem Anfang.", status_code=422)
        if (bis - von).days + 1 > _VORSCHAU_MAX_TAGE:
            raise PricingError(
                f"Zeitraum zu lang (hoechstens {_VORSCHAU_MAX_TAGE} Tage).",
                status_code=422,
            )
        rc = DynamicPricingRecompute(service_client=self._db())
        basis = rc.load_base_price(property_id)
        if basis is None:
            return []
        settings = rc.load_settings(property_id)
        heute = datetime.now(UTC).date()
        try:
            kurve = rc.preis_kurve(
                property_id, basis, settings, heute, von, bis + timedelta(days=1)
            )
        except Exception as exc:  # noqa: BLE001 — Vorschau darf nicht kippen
            log.warning("dp_vorschau_fehlgeschlagen", property_id=property_id, error=str(exc)[:200])
            raise PricingError("Vorschau konnte nicht berechnet werden.", status_code=502) from exc
        return [
            VorschauTag(
                date=tag,
                price=res.price,
                factors={k: round(float(v), 4) for k, v in res.factors.items()},
            )
            for tag, res in kurve
        ]

    # -- Forecast -----------------------------------------------------------------
    def forecast(self, ctx: AuthContext, property_id: str) -> Forecast:
        """Belegt vs. erwartet je Tag der naechsten FORECAST_TAGE Tage.

        Erwartung = gelernte Belegungs-Wahrscheinlichkeit (Saison-Bucket,
        Vorlauf-Bucket) aus `dp_pickup_snapshots` — dasselbe Modell, das die
        Engine fuer den Pickup-Faktor nutzt. Ohne gelernte Zelle: None, kein
        erfundener Wert. Marktangebote = `markt_beobachtung.anzahl` des
        naechsten Stichtags (freie Angebote im Umkreis; weniger = voller).
        """
        self._require_own_property(ctx, property_id)
        heute = datetime.now(UTC).date()
        ende = heute + timedelta(days=FORECAST_TAGE)
        rc = DynamicPricingRecompute(service_client=self._db())
        belegt = rc.booked_dates(property_id, heute, ende)
        modell = self._modell(property_id, heute)
        markt = self._markt_angebote(property_id, heute, ende)
        tage: list[ForecastTag] = []
        erwartungen: list[float] = []
        cur = heute
        while cur < ende:
            iso = cur.isoformat()
            erwartet = (
                modell.erwartung(cur, (cur - heute).days) if modell is not None else None
            )
            if erwartet is not None:
                erwartungen.append(erwartet)
            tage.append(
                ForecastTag(
                    date=cur,
                    belegt=iso in belegt,
                    erwartet=erwartet,
                    markt_angebote=markt.get(iso),
                )
            )
            cur += timedelta(days=1)
        belegt_pct = round(100.0 * sum(1 for t in tage if t.belegt) / max(1, len(tage)), 1)
        erwartet_pct: float | None = None
        pace: str | None = None
        hinweis: str | None = None
        # Pace nur, wenn das Modell den GANZEN Horizont traegt — ein Vergleich
        # aus 12 gelernten von 90 Tagen waere eine Zahl ohne Aussage.
        if erwartungen and len(erwartungen) >= len(tage) * 0.8:
            erwartet_pct = round(100.0 * sum(erwartungen) / len(erwartungen), 1)
            diff = (belegt_pct - erwartet_pct) / 100.0
            if diff > _PACE_SCHWELLE:
                pace = "vor"
            elif diff < -_PACE_SCHWELLE:
                pace = "hinter"
            else:
                pace = "im_plan"
        elif modell is None:
            hinweis = (
                "Noch keine gelernte Buchungskurve — sie entsteht aus den taeglichen "
                "Belegungs-Snapshots und traegt nach einigen Wochen."
            )
        else:
            hinweis = "Die gelernte Kurve deckt diesen Zeitraum erst zum Teil ab."
        return Forecast(
            property_id=property_id,
            horizont_tage=FORECAST_TAGE,
            tage=tage,
            belegt_pct=belegt_pct,
            erwartet_pct=erwartet_pct,
            pace=pace,  # type: ignore[arg-type]
            hinweis=hinweis,
        )

    def _modell(self, property_id: str, heute: date) -> _Erwartung | None:
        train_from = heute - timedelta(days=365)
        try:
            rows = fetch_all_rows(
                self._db()
                .table("dp_pickup_snapshots")
                .select("stay_date, days_before, booked")
                .eq("property_id", property_id)
                .gte("snapshot_date", train_from.isoformat())
                .order("id")
            )
        except Exception as exc:  # noqa: BLE001
            log.warning("dp_forecast_snapshots_unlesbar", error=str(exc)[:200])
            return None
        obs = [
            PickupObservation(
                stay_date=date.fromisoformat(str(r["stay_date"])[:10]),
                days_before=int(r.get("days_before") or 0),
                booked=bool(r.get("booked")),
            )
            for r in rows
            if r.get("stay_date")
        ]
        if not obs:
            return None
        modell = PickupCurveModel().train(obs)
        return _Erwartung(modell) if modell.is_trained else None

    def _markt_angebote(self, property_id: str, von: date, bis: date) -> dict[str, int]:
        """Angebotsdichte der eigenen Rasterzelle je Tag: `anzahl` des naechsten
        Stichtags innerhalb von +-3 Tagen. Leer ohne Marktbeobachtung."""
        from .market.beobachtung import Zelle  # noqa: PLC0415

        prop = (
            self._db()
            .table("properties")
            .select("lat, lng")
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data or []
        if not prop or prop[0].get("lat") is None or prop[0].get("lng") is None:
            return {}
        zelle = Zelle.fuer(float(prop[0]["lat"]), float(prop[0]["lng"]))
        try:
            rows = (
                self._db()
                .table("markt_beobachtung")
                .select("tag, anzahl")
                .eq("zelle_lat", zelle.lat)
                .eq("zelle_lng", zelle.lng)
                .gte("tag", (von - timedelta(days=_MARKT_NAEHE_TAGE)).isoformat())
                .lte("tag", (bis + timedelta(days=_MARKT_NAEHE_TAGE)).isoformat())
                .order("abgerufen_am", desc=True)
                .limit(200)
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001
            log.warning("dp_forecast_markt_unlesbar", error=str(exc)[:200])
            return {}
        stichtage: dict[date, int] = {}
        for r in rows:  # juengster Abruf je Stichtag gewinnt (Reihenfolge desc)
            t = date.fromisoformat(str(r["tag"])[:10])
            stichtage.setdefault(t, int(r.get("anzahl") or 0))
        if not stichtage:
            return {}
        out: dict[str, int] = {}
        cur = von
        while cur < bis:
            naechster = min(stichtage, key=lambda t: abs((t - cur).days))
            if abs((naechster - cur).days) <= _MARKT_NAEHE_TAGE:
                out[cur.isoformat()] = stichtage[naechster]
            cur += timedelta(days=1)
        return out

    # -- Verlauf ---------------------------------------------------------------------
    def verlauf(
        self, ctx: AuthContext, property_id: str, tag: date | None = None
    ) -> list[VerlaufEintrag]:
        """Eintraege des Objekts, neueste zuerst; mit `tag` nur die, deren
        Zeitraum den Tag enthaelt. Nutzernamen aus `users` (nur Anzeigename —
        keine E-Mail, Wurzel 9)."""
        self._require_own_property(ctx, property_id)
        q = (
            self._db()
            .table("dp_verlauf")
            .select("id, von, bis, ereignis, details, user_id, created_at")
            .eq("property_id", property_id)
        )
        if tag is not None:
            q = q.lte("von", tag.isoformat()).gte("bis", tag.isoformat())
        rows = q.order("created_at", desc=True).limit(_VERLAUF_MAX).execute().data or []
        namen = self._namen({str(r["user_id"]) for r in rows if r.get("user_id")})
        return [
            VerlaufEintrag(
                id=str(r["id"]),
                von=date.fromisoformat(str(r["von"])[:10]),
                bis=date.fromisoformat(str(r["bis"])[:10]),
                ereignis=str(r["ereignis"]),
                details=r.get("details") or {},
                user_id=str(r["user_id"]) if r.get("user_id") else None,
                user_name=namen.get(str(r.get("user_id"))),
                created_at=str(r.get("created_at") or ""),
            )
            for r in rows
        ]

    def _namen(self, ids: set[str]) -> dict[str, str]:
        if not ids:
            return {}
        try:
            rows = (
                self._db()
                .table("users")
                .select("id, full_name")
                .in_("id", sorted(ids))
                .execute()
            ).data or []
        except Exception as exc:  # noqa: BLE001 — Name ist Beiwerk
            log.warning("dp_verlauf_namen_unlesbar", error=str(exc)[:200])
            return {}
        return {str(r["id"]): str(r.get("full_name") or "") for r in rows if r.get("full_name")}


class _Erwartung:
    """Duenne Huelle um PickupCurveModel: die gelernte Wahrscheinlichkeit selbst,
    nicht die Velocity (die braucht den Ist-Stand)."""

    def __init__(self, modell: PickupCurveModel) -> None:
        self._m = modell

    def erwartung(self, stay: date, days_before: int) -> float | None:
        # Gewollt dieselbe Zelle wie die Engine liest.
        return self._m._expected.get(  # pylint: disable=protected-access
            (_season_bucket(stay), _lead_bucket(days_before))
        )


__all__ = ["AuskunftService", "FORECAST_TAGE"]
