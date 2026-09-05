"""Mindest-/Hoechstpreis je Zeitraum (0562, SiteMinder „Floor and ceiling
overrides").

Ein globales Min/Max in dp_settings reicht nicht: Hochsaison-Mindestpreis 900
und Nebensaison-Mindestpreis 450 waren nicht abbildbar. Hier verwaltet der
Betrieb Ausnahmen je Zeitraum, optional je Wochentag, optional jaehrlich. Die
Engine liest sie ueber `zusatzsignale.preisgrenzen_je_tag` (die spezifischste
gewinnt); dieser Dienst schreibt sie und prueft Scope, Grenzen und Sinn.
"""
from __future__ import annotations

from datetime import UTC, date, datetime

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.auth.owner_scope import is_owner
from src.jobs.queue import try_enqueue_recompute

from .ki_schemas import Preisgrenze, PreisgrenzeAnlegen
from .resolver import PricingError
from .zusatzsignale import verlauf_schreiben

log = get_logger("nextdays.pricing.preisgrenzen")

# Mehr Ausnahmen je Objekt sind kein Bedienkonzept mehr (Wurzel 8: harte
# Obergrenze fuer jede Liste).
_MAX_GRENZEN = 50
# Ein Zeitraum laenger als zwei Jahre ist ein Tippfehler im Enddatum.
_MAX_TAGE = 731


class PreisgrenzenService:
    def __init__(self, service_client: Client | None = None) -> None:
        self._client = service_client

    def _db(self) -> Client:
        if self._client is None:
            raise PricingError("Preis-DB nicht verfuegbar.", status_code=500)
        return self._client

    def _require_own_property(self, ctx: AuthContext, property_id: str) -> None:
        """Wurzel 3: Service-Role umgeht RLS — Eigentum explizit pruefen."""
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
        if is_owner(ctx):
            raise PricingError(
                "Eigentuemer koennen Preise nicht aendern.", status_code=403
            )

    def liste(self, ctx: AuthContext, property_id: str) -> list[Preisgrenze]:
        self._require_own_property(ctx, property_id)
        rows = (
            self._db()
            .table("dp_preisgrenzen")
            .select("*")
            .eq("property_id", property_id)
            .order("von")
            .limit(_MAX_GRENZEN)
            .execute()
        ).data or []
        return [self._zeile(r) for r in rows]

    def anlegen(
        self, ctx: AuthContext, property_id: str, req: PreisgrenzeAnlegen
    ) -> Preisgrenze:
        self._require_own_property(ctx, property_id)
        self._pruefen(req)
        anzahl = (
            self._db()
            .table("dp_preisgrenzen")
            .select("id", count="exact")
            .eq("property_id", property_id)
            .execute()
        ).count or 0
        if anzahl >= _MAX_GRENZEN:
            raise PricingError(
                f"Hoechstens {_MAX_GRENZEN} Preisgrenzen je Objekt.", status_code=422
            )
        row = {
            "property_id": property_id,
            "bezeichnung": req.bezeichnung.strip(),
            "von": req.von.isoformat(),
            "bis": req.bis.isoformat(),
            "wochentage": sorted(set(req.wochentage)) if req.wochentage else None,
            "jaehrlich": bool(req.jaehrlich),
            "min_price": req.min_price,
            "max_price": req.max_price,
            "created_by": ctx.user_id,
            "created_at": datetime.now(UTC).isoformat(),
        }
        res = self._db().table("dp_preisgrenzen").insert(row).execute().data or []
        if not res:
            raise PricingError("Preisgrenze konnte nicht gespeichert werden.", status_code=500)
        verlauf_schreiben(
            self._db(), property_id, von=req.von, bis=req.bis,
            ereignis="preisgrenze",
            details={
                "aktion": "angelegt", "bezeichnung": row["bezeichnung"],
                "min": req.min_price, "max": req.max_price,
            },
            user_id=ctx.user_id,
        )
        self._neu_rechnen(ctx, property_id)
        return self._zeile(res[0])

    def loeschen(self, ctx: AuthContext, property_id: str, grenze_id: str) -> None:
        """Idempotent: eine nicht (mehr) vorhandene Grenze ist kein Fehler."""
        self._require_own_property(ctx, property_id)
        vorher = (
            self._db()
            .table("dp_preisgrenzen")
            .select("bezeichnung, von, bis")
            .eq("id", grenze_id)
            .eq("property_id", property_id)  # Wurzel 9: gleicher Scope wie die Liste
            .limit(1)
            .execute()
        ).data or []
        if not vorher:
            return
        self._db().table("dp_preisgrenzen").delete().eq("id", grenze_id).eq(
            "property_id", property_id
        ).execute()
        verlauf_schreiben(
            self._db(), property_id,
            von=date.fromisoformat(str(vorher[0]["von"])[:10]),
            bis=date.fromisoformat(str(vorher[0]["bis"])[:10]),
            ereignis="preisgrenze",
            details={"aktion": "geloescht", "bezeichnung": vorher[0].get("bezeichnung")},
            user_id=ctx.user_id,
        )
        self._neu_rechnen(ctx, property_id)

    # -- intern ------------------------------------------------------------------
    @staticmethod
    def _pruefen(req: PreisgrenzeAnlegen) -> None:
        """Deckungsgleich mit den DB-CHECKs aus 0562 — hier als 422 statt 500."""
        if req.bis < req.von:
            raise PricingError("Das Ende liegt vor dem Anfang.", status_code=422)
        if (req.bis - req.von).days + 1 > _MAX_TAGE:
            raise PricingError(
                f"Ein Zeitraum ist hoechstens {_MAX_TAGE} Tage lang.", status_code=422
            )
        if req.min_price is None and req.max_price is None:
            raise PricingError(
                "Mindestens eine Grenze (Mindest- oder Hoechstpreis) fehlt.",
                status_code=422,
            )
        if (
            req.min_price is not None
            and req.max_price is not None
            and req.max_price < req.min_price
        ):
            raise PricingError(
                "Der Hoechstpreis liegt unter dem Mindestpreis.", status_code=422
            )
        if req.wochentage is not None:
            if not req.wochentage or any(w < 0 or w > 6 for w in req.wochentage):
                raise PricingError(
                    "Wochentage sind 0 (Montag) bis 6 (Sonntag).", status_code=422
                )

    def _neu_rechnen(self, ctx: AuthContext, property_id: str) -> None:
        # Der Preis hat sich geaendert — neu rechnen und senden, als Job.
        if ctx.tenant_id:
            try_enqueue_recompute(self._db(), ctx.tenant_id, property_id)

    @staticmethod
    def _zeile(r: dict) -> Preisgrenze:
        return Preisgrenze(
            id=str(r["id"]),
            property_id=str(r["property_id"]),
            bezeichnung=str(r.get("bezeichnung") or ""),
            von=date.fromisoformat(str(r["von"])[:10]),
            bis=date.fromisoformat(str(r["bis"])[:10]),
            wochentage=[int(w) for w in r["wochentage"]] if r.get("wochentage") else None,
            jaehrlich=bool(r.get("jaehrlich")),
            min_price=float(r["min_price"]) if r.get("min_price") is not None else None,
            max_price=float(r["max_price"]) if r.get("max_price") is not None else None,
        )


__all__ = ["PreisgrenzenService"]
