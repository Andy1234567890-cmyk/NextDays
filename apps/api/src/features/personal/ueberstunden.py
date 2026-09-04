"""Überstundenanträge und Guttage (0544, Vertrag §3.5).

Zwei Konten mit demselben Muster wie das Arbeitszeitkonto (0541): eine Zeile je
Buchung, der Saldo ist ihre Summe — keine geführte Saldospalte, die driften
kann.

Der Gegenzustand (Wurzel 1) ist hier die AZK-Buchung: ein GENEHMIGTER
Überstundenantrag hat eine Wirkung, nicht bloß einen Status. Er bucht die
Minuten mit `grund='korrektur'` und `bezug_id = antrag.id` ins Arbeitszeitkonto.
Über die `bezug_id` ist der Schritt idempotent (Wurzel 2): ein zweiter Klick auf
„Genehmigen" findet die Buchung und legt keine zweite an.

Guttage buchen NICHT automatisch aus Abwesenheiten — B1 ruft `guttage_buchen`
ausdrücklich nicht (Vertrag §1.5). Wer einen Guttag gewährt, bucht ihn; ein
automatischer Abzug bei jedem `frei`-Antrag mit dem Wort „Guttag" im Grund wäre
eine Regel, die auf Textmustern rät.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from supabase import Client

from src.core.security import AuthContext
from src.core.supabase import load_scoped

from ._base import LEITUNG, PersonalBase, PersonalError, als_date, als_dt, als_float, jetzt, log
from .benachrichtigungen_zeit import melde_ueberstunden_antrag, melde_ueberstunden_entscheidung
from .schemas import MAX_ZEITRAUM_TAGE
from .ueberstunden_schemas import (
    GuttageBuchung,
    GuttageBuchungCreate,
    Guttagekonto,
    Ueberstundenantrag,
    UeberstundenCreate,
    UeberstundenEntscheiden,
)

_SPALTEN = (
    "id, tenant_id, user_id, datum, minuten, grund, status, zeiterfassung_id, kommentar, "
    "entschieden_von, entschieden_am, created_at, updated_at"
)
_GUT_SPALTEN = (
    "id, tenant_id, user_id, datum, tage, grund, abwesenheit_id, notiz, erstellt_von, created_at"
)


class UeberstundenService(PersonalBase):
    """Anträge, Entscheidungen, Guttagekonto."""

    # ------------------------------------------------------------------
    # Überstundenanträge
    # ------------------------------------------------------------------

    def beantragen(self, ctx: AuthContext, req: UeberstundenCreate) -> Ueberstundenantrag:
        """Eigener Antrag (Guard TRACK_OWN_TIME) — immer für die eigene Person.

        Kein `user_id` im Request: wer für jemand anderen Überstunden anmeldet,
        korrigiert die Zeit (`/zeiterfassung/{id}`) oder bucht das AZK direkt.
        Ein Antrag ist eine Aussage über die EIGENE Arbeit.
        """
        tenant_id = self._require_tenant(ctx)
        self._require_planbar(tenant_id, ctx.user_id)
        if req.datum > jetzt().date():
            raise PersonalError(
                "Überstunden werden nach der Arbeit beantragt, nicht vorher.",
                status_code=422,
                details={"code": "datum_zukunft"},
            )
        if req.zeiterfassung_id:
            zeile = load_scoped(
                self._db,
                "personal_zeiterfassung",
                req.zeiterfassung_id,
                tenant_id,
                columns="id, user_id",
                not_found=PersonalError("Zeiterfassung nicht gefunden.", status_code=404),
            )
            if str(zeile.get("user_id") or "") != ctx.user_id:
                # Kein Existenz-Leak: dieselbe Meldung wie „gibt es nicht" (Wurzel 9).
                raise PersonalError("Zeiterfassung nicht gefunden.", status_code=404)
        row = (
            self._db.table("personal_ueberstunden_antraege")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "user_id": ctx.user_id,
                    "datum": req.datum.isoformat(),
                    "minuten": req.minuten,
                    "grund": req.grund.strip(),
                    "status": "beantragt",
                    "zeiterfassung_id": req.zeiterfassung_id,
                }
            )
            .execute()
            .data[0]
        )
        melde_ueberstunden_antrag(
            self._db,
            tenant_id=tenant_id,
            antrag=row,
            leitung_ids=self._leitung_ids(tenant_id),
        )
        log.info(
            "personal_ueberstunden_beantragt",
            tenant_id=tenant_id,
            user_id=ctx.user_id,
            minuten=req.minuten,
        )
        return self._antrag(row, self._namen(tenant_id, {ctx.user_id}))

    def liste(
        self,
        ctx: AuthContext,
        *,
        von: date | None = None,
        bis: date | None = None,
        status: str | None = None,
    ) -> list[Ueberstundenantrag]:
        """Anträge im Scope — die Person sieht ihre eigenen, die Leitung ihr Team.

        Derselbe Scope wie die Detail-/Entscheidungswege (Wurzel 9): gefiltert
        wird über `_personen_im_scope`, nicht über eine zweite Regel.
        """
        tenant_id = self._require_tenant(ctx)
        if von and bis:
            if bis < von:
                raise PersonalError("Der Zeitraum endet vor seinem Beginn.", status_code=422)
            if (bis - von).days > MAX_ZEITRAUM_TAGE:
                raise PersonalError(
                    "Zeitraum zu lang.", status_code=422, details={"code": "zeitraum_zu_lang"}
                )
        ids = self._personen_im_scope(ctx, tenant_id)
        if not ids:
            return []
        q = (
            self._db.table("personal_ueberstunden_antraege")
            .select(_SPALTEN)
            .eq("tenant_id", tenant_id)
            .in_("user_id", sorted(ids))
        )
        if von:
            q = q.gte("datum", von.isoformat())
        if bis:
            q = q.lte("datum", bis.isoformat())
        if status:
            q = q.eq("status", status)
        rows = q.execute().data or []
        namen = self._namen(tenant_id, {str(r["user_id"]) for r in rows})
        aus = [self._antrag(r, namen) for r in rows]
        aus.sort(key=lambda a: (a.datum, a.id), reverse=True)
        return aus

    def entscheiden(
        self, ctx: AuthContext, antrag_id: str, req: UeberstundenEntscheiden
    ) -> Ueberstundenantrag:
        tenant_id = self._require_tenant(ctx)
        antrag = self._own_antrag(ctx, tenant_id, antrag_id)
        if str(antrag["user_id"]) == ctx.user_id:
            raise PersonalError(
                "Den eigenen Antrag entscheidet jemand anderes.",
                status_code=403,
                details={"code": "eigener_antrag"},
            )
        if antrag.get("status") != "beantragt":
            raise PersonalError(
                "Über diesen Antrag ist schon entschieden.",
                status_code=409,
                details={"code": "schon_entschieden", "status": str(antrag.get("status"))},
            )
        neu = {
            "status": "genehmigt" if req.genehmigen else "abgelehnt",
            "kommentar": req.kommentar,
            "entschieden_von": ctx.user_id,
            "entschieden_am": jetzt().isoformat(),
        }
        (
            self._db.table("personal_ueberstunden_antraege")
            .update(neu)
            .eq("id", antrag_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        zusammen = {**antrag, **neu}
        if req.genehmigen:
            self._azk_buchen(tenant_id, zusammen, akteur_id=ctx.user_id)
        melde_ueberstunden_entscheidung(
            self._db, tenant_id=tenant_id, antrag=zusammen, entscheider_id=ctx.user_id
        )
        log.info(
            "personal_ueberstunden_entschieden",
            tenant_id=tenant_id,
            antrag_id=antrag_id,
            status=neu["status"],
            von=ctx.user_id,
        )
        return self._antrag(zusammen, self._namen(tenant_id, {str(antrag["user_id"])}))

    def _azk_buchen(
        self, tenant_id: str, antrag: dict[str, Any], *, akteur_id: str
    ) -> None:
        """Genehmigte Minuten ins Arbeitszeitkonto — idempotent über `bezug_id`.

        Externe Kräfte führen kein Konto (wie `azk_buchen`): ihr Antrag wird
        entschieden, aber nicht gebucht — sonst entstünde ein Saldo, den keine
        Abrechnung liest.
        """
        akte = self._akten(tenant_id, {str(antrag["user_id"])}).get(str(antrag["user_id"])) or {}
        if akte.get("beschaeftigungsart") == "extern":
            log.info(
                "personal_ueberstunden_extern_nicht_gebucht",
                tenant_id=tenant_id,
                antrag_id=str(antrag["id"]),
            )
            return
        vorhanden = (
            self._db.table("personal_arbeitszeitkonten")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("bezug_id", str(antrag["id"]))
            .limit(1)
            .execute()
        ).data or []
        if vorhanden:
            return
        datum = als_date(antrag.get("datum")) or jetzt().date()
        self._db.table("personal_arbeitszeitkonten").insert(
            {
                "tenant_id": tenant_id,
                "user_id": str(antrag["user_id"]),
                "datum": datum.isoformat(),
                "minuten": int(antrag["minuten"]),
                "grund": "korrektur",
                "notiz": f"Überstundenantrag {datum.isoformat()}",
                "bezug_id": str(antrag["id"]),
                "erstellt_von": akteur_id,
            }
        ).execute()

    def _own_antrag(
        self, ctx: AuthContext, tenant_id: str, antrag_id: str
    ) -> dict[str, Any]:
        row = load_scoped(
            self._db,
            "personal_ueberstunden_antraege",
            antrag_id,
            tenant_id,
            columns=_SPALTEN,
            not_found=PersonalError("Antrag nicht gefunden.", status_code=404),
        )
        # Wurzel 9: derselbe Personen-Scope wie in der Liste, nicht nur der Tenant.
        self._require_person_im_scope(ctx, tenant_id, str(row["user_id"]))
        return row

    def _antrag(
        self, row: dict[str, Any], namen: dict[str, str | None]
    ) -> Ueberstundenantrag:
        return Ueberstundenantrag(
            id=str(row["id"]),
            user_id=str(row["user_id"]),
            full_name=namen.get(str(row["user_id"])),
            datum=als_date(row["datum"]),  # type: ignore[arg-type]
            minuten=int(row["minuten"]),
            grund=str(row["grund"]),
            status=row["status"],
            kommentar=row.get("kommentar"),
            zeiterfassung_id=row.get("zeiterfassung_id"),
            entschieden_von=row.get("entschieden_von"),
            entschieden_am=als_dt(row.get("entschieden_am")),
            created_at=als_dt(row.get("created_at")),
        )

    def _namen(self, tenant_id: str, ids: set[str]) -> dict[str, str | None]:
        return {str(u["id"]): u.get("full_name") for u in self._users(tenant_id, ids)}

    def _leitung_ids(self, tenant_id: str) -> set[str]:
        rows = (
            self._db.table("users")
            .select("id, role, deactivated_at")
            .eq("tenant_id", tenant_id)
            .in_("role", sorted(LEITUNG))
            .execute()
        ).data or []
        return {str(r["id"]) for r in rows if r.get("deactivated_at") is None}

    # ------------------------------------------------------------------
    # Guttage
    # ------------------------------------------------------------------

    def guttagekonto(self, ctx: AuthContext, user_id: str) -> Guttagekonto:
        tenant_id = self._require_tenant(ctx)
        self._require_person_im_scope(ctx, tenant_id, user_id)
        rows = (
            self._db.table("personal_guttage")
            .select(_GUT_SPALTEN)
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .order("datum")
            .execute()
        ).data or []
        buchungen = [
            GuttageBuchung(
                id=str(r["id"]),
                user_id=user_id,
                datum=als_date(r["datum"]),  # type: ignore[arg-type]
                tage=als_float(r["tage"]) or 0.0,
                grund=r["grund"],
                notiz=r.get("notiz"),
                abwesenheit_id=r.get("abwesenheit_id"),
                created_at=als_dt(r.get("created_at")),
            )
            for r in rows
        ]
        # Auf zwei Stellen: die Spalte ist numeric(4,2), float summiert sonst
        # 0.5 + 0.25 zu 0.7500000000000001 und die UI zeigt Unsinn.
        return Guttagekonto(
            user_id=user_id,
            saldo_tage=round(sum(b.tage for b in buchungen), 2),
            buchungen=buchungen,
        )

    def guttage_buchen(self, ctx: AuthContext, req: GuttageBuchungCreate) -> Guttagekonto:
        tenant_id = self._require_tenant(ctx)
        self._require_person_im_scope(ctx, tenant_id, req.user_id)
        self._require_planbar(tenant_id, req.user_id)
        if req.tage == 0:
            raise PersonalError(
                "Eine Buchung über 0 Tage ist keine Buchung.",
                status_code=422,
                details={"code": "tage_null"},
            )
        if req.grund == "korrektur" and not (req.notiz or "").strip():
            # Derselbe CHECK steht in der DB (0544); hier mit Code, damit das
            # Frontend die Stelle beschriften kann statt eines rohen 23514.
            raise PersonalError(
                "Eine Korrektur braucht eine Notiz.",
                status_code=422,
                details={"code": "notiz_fehlt"},
            )
        if req.abwesenheit_id:
            zeile = load_scoped(
                self._db,
                "personal_abwesenheiten",
                req.abwesenheit_id,
                tenant_id,
                columns="id, user_id",
                not_found=PersonalError("Abwesenheit nicht gefunden.", status_code=404),
            )
            if str(zeile.get("user_id") or "") != req.user_id:
                raise PersonalError("Abwesenheit nicht gefunden.", status_code=404)
        self._db.table("personal_guttage").insert(
            {
                "tenant_id": tenant_id,
                "user_id": req.user_id,
                "datum": req.datum.isoformat(),
                "tage": req.tage,
                "grund": req.grund,
                "notiz": req.notiz,
                "abwesenheit_id": req.abwesenheit_id,
                "erstellt_von": ctx.user_id,
            }
        ).execute()
        log.info(
            "personal_guttage_gebucht",
            tenant_id=tenant_id,
            user_id=req.user_id,
            tage=req.tage,
            grund=req.grund,
            von=ctx.user_id,
        )
        return self.guttagekonto(ctx, req.user_id)


def get_ueberstunden_service(db: Client | None = None) -> UeberstundenService:
    """Factory für die Router-Dependency (die echte sitzt in `dependencies.py`)."""
    if db is not None:
        return UeberstundenService(db)
    from src.core.supabase import get_service_client  # noqa: PLC0415 — Import-Kosten

    return UeberstundenService(service_client=get_service_client())
