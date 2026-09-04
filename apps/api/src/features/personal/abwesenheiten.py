"""Abwesenheit & Verfügbarkeit (0541, Etappe 3): Anträge, Entscheidung mit
Gegenzustand, Urlaubskonten, Urlaubssperren, Wunsch-/Sperrzeiten, Krankenstand.

Gegenzustand (Wurzel 1): eine GENEHMIGTE Abwesenheit sagt die Schichten der
Person im Zeitraum ab — sie stehen sonst als Dienst im Plan, obwohl die Person
im Urlaub ist. Die Anzahl wird zurückgemeldet, nicht verschwiegen.
Urlaubskonto: genommen/geplant werden aus den Anträgen GERECHNET (eine
Wahrheit), gespeichert sind nur Anspruch, Übertrag und Korrektur.
"""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from src.core.security import AuthContext
from src.core.supabase import load_scoped

from . import regelwerk as rw
from ._base import (
    PLANBARE_ROLLEN,
    PersonalBase,
    PersonalError,
    als_date,
    als_dec,
    als_dt,
    als_time,
    jetzt,
    log,
)
from .benachrichtigungen import (
    melde_abwesenheit_antrag,
    melde_abwesenheit_entschieden,
    melde_dienstplan,
)
from .schemas import (
    Abwesenheit,
    AbwesenheitCreate,
    AbwesenheitEntscheiden,
    AbwesenheitListResponse,
    Krankenstand,
    PlanPerson,
    Urlaubskonto,
    UrlaubskontoSet,
    Urlaubssperre,
    UrlaubssperreCreate,
    Verfuegbarkeit,
    VerfuegbarkeitCreate,
)

_URLAUBSARTEN = ("urlaub",)
_KRANK = ("krank", "kind_krank")
_AKTIVE_SCHICHT = ("entwurf", "veroeffentlicht", "bestaetigt")


class AbwesenheitenService(PersonalBase):
    # ------------------------------------------------------------------
    # Anträge
    # ------------------------------------------------------------------

    def liste(
        self, ctx: AuthContext, von: date, bis: date, *, status: str | None = None
    ) -> AbwesenheitListResponse:
        tenant_id = self._require_tenant(ctx)
        if (bis - von).days > 400:
            raise PersonalError("Zeitraum zu lang (max. 400 Tage).", status_code=422)
        ids = self._personen_im_scope(ctx, tenant_id)
        if not ids:
            return AbwesenheitListResponse(items=[], personen=[])
        q = (
            self._db.table("personal_abwesenheiten")
            .select("*")
            .eq("tenant_id", tenant_id)
            .in_("user_id", sorted(ids))
            .lte("von", bis.isoformat())
            .gte("bis", von.isoformat())
        )
        if status:
            q = q.eq("status", status)
        rows = q.execute().data or []
        schichten = self._schichten_je_person(tenant_id, ids, von, bis)
        sperren = self._sperren_rows(tenant_id, von, bis)
        items = [self._abwesenheit(r, schichten, sperren) for r in rows]
        items.sort(key=lambda a: (a.status != "beantragt", a.von, a.user_id))
        return AbwesenheitListResponse(items=items, personen=self._personen(tenant_id, ids))

    def _personen(self, tenant_id: str, ids: set[str]) -> list[PlanPerson]:
        akten = self._akten(tenant_id, ids)
        return [
            PlanPerson(
                user_id=str(u["id"]),
                full_name=u.get("full_name"),
                role=str(u.get("role")),
                avatar_url=u.get("avatar_url"),
                beschaeftigungsart=(akten.get(str(u["id"])) or {}).get("beschaeftigungsart"),
            )
            for u in sorted(
                self._users(tenant_id, ids),
                key=lambda r: (str(r.get("full_name") or "").casefold(), str(r["id"])),
            )
            if str(u.get("role")) in PLANBARE_ROLLEN
        ]

    def _schichten_je_person(
        self, tenant_id: str, ids: set[str], von: date, bis: date
    ) -> dict[str, list[date]]:
        rows = (
            self._db.table("personal_schichten")
            .select("user_id, datum, status")
            .eq("tenant_id", tenant_id)
            .in_("user_id", sorted(ids))
            .gte("datum", von.isoformat())
            .lte("datum", bis.isoformat())
            .execute()
        ).data or []
        aus: dict[str, list[date]] = {}
        for r in rows:
            if r.get("status") in _AKTIVE_SCHICHT:
                d = als_date(r["datum"])
                if d:
                    aus.setdefault(str(r["user_id"]), []).append(d)
        return aus

    def _sperren_rows(self, tenant_id: str, von: date, bis: date) -> list[dict[str, Any]]:
        return (
            self._db.table("personal_urlaubssperren")
            .select("*")
            .eq("tenant_id", tenant_id)
            .lte("von", bis.isoformat())
            .gte("bis", von.isoformat())
            .execute()
        ).data or []

    @staticmethod
    def _abwesenheit(
        a: dict[str, Any],
        schichten: dict[str, list[date]] | None = None,
        sperren: list[dict[str, Any]] | None = None,
    ) -> Abwesenheit:
        von, bis = als_date(a["von"]), als_date(a["bis"])
        if von is None or bis is None:
            raise PersonalError("Abwesenheit ohne Datum.", status_code=500)
        im_zeitraum = sum(
            1 for d in (schichten or {}).get(str(a["user_id"]), []) if von <= d <= bis
        )
        sperre = (
            any(
                (als_date(s["von"]) or bis) <= bis and (als_date(s["bis"]) or von) >= von
                for s in (sperren or [])
            )
            if a.get("art") in _URLAUBSARTEN
            else False
        )
        return Abwesenheit(
            id=str(a["id"]),
            user_id=str(a["user_id"]),
            art=a["art"],
            von=von,
            bis=bis,
            halbtag_start=bool(a.get("halbtag_start")),
            halbtag_ende=bool(a.get("halbtag_ende")),
            tage_berechnet=float(a.get("tage_berechnet") or 0),
            status=a["status"],
            grund=a.get("grund"),
            kommentar_entscheidung=a.get("kommentar_entscheidung"),
            entschieden_von=a.get("entschieden_von"),
            entschieden_am=als_dt(a.get("entschieden_am")),
            attest_dokument_id=a.get("attest_dokument_id"),
            created_at=als_dt(a.get("created_at")),
            schichten_im_zeitraum=im_zeitraum,
            urlaubssperre=sperre,
        )

    def _tage(self, tenant_id: str, user_id: str, req: AbwesenheitCreate) -> Decimal:
        akte = self._akten(tenant_id, {user_id}).get(user_id)
        feiertage = set(self._feiertage(tenant_id, req.von, req.bis))
        return rw.abwesenheitstage(
            req.von,
            req.bis,
            halbtag_start=req.halbtag_start,
            halbtag_ende=req.halbtag_ende,
            arbeitstage=self._arbeitstage(akte),
            feiertage=feiertage,
        )

    def beantragen(self, ctx: AuthContext, req: AbwesenheitCreate) -> Abwesenheit:
        tenant_id = self._require_tenant(ctx)
        regeln = self._regeln(tenant_id)
        leitung = self._ist_leitung(ctx) or self._rolle_aus_db(ctx, tenant_id) == "shift_lead"
        user_id = req.user_id or ctx.user_id
        if user_id != ctx.user_id:
            if not leitung:
                raise PersonalError("Anträge stellst du nur für dich selbst.", status_code=403)
            self._require_person_im_scope(ctx, tenant_id, user_id)
        self._require_planbar(tenant_id, user_id)
        akte = self._akten(tenant_id, {user_id}).get(user_id) or {}
        if req.art in _URLAUBSARTEN and akte.get("beschaeftigungsart") == "extern":
            raise PersonalError("Externe Kräfte haben hier kein Urlaubskonto.", status_code=422)
        if req.art in _URLAUBSARTEN:
            sperre = [
                s
                for s in self._sperren_rows(tenant_id, req.von, req.bis)
                if not s.get("arbeitsbereich_id")
                or self._hat_bereich(tenant_id, user_id, str(s["arbeitsbereich_id"]))
            ]
            if sperre and not self._ist_leitung(ctx):
                raise PersonalError(
                    "In diesem Zeitraum gilt eine Urlaubssperre.",
                    status_code=422,
                    details={"code": "urlaubssperre", "grund": sperre[0].get("grund")},
                )
            vorlauf = (req.von - date.today()).days
            if (
                regeln.mindest_vorlauf_urlaub_tage > 0
                and not leitung
                and vorlauf < regeln.mindest_vorlauf_urlaub_tage
            ):
                raise PersonalError(
                    f"Urlaub braucht mindestens {regeln.mindest_vorlauf_urlaub_tage} Tage Vorlauf.",
                    status_code=422,
                    details={"code": "vorlauf"},
                )
        ueberlappung = self._ueberlappt(tenant_id, user_id, req.von, req.bis, ausser=None)
        if ueberlappung:
            raise PersonalError("Für diesen Zeitraum gibt es schon einen Antrag.", status_code=409)
        tage = self._tage(tenant_id, user_id, req)
        if req.art in _URLAUBSARTEN and tage > 0:
            konto = self.urlaubskonto(
                ctx, user_id, self._urlaubsjahr_von(req.von, regeln), intern=True
            )
            if Decimal(str(konto.rest)) < tage:
                raise PersonalError(
                    "Der Urlaubsanspruch reicht nicht.",
                    status_code=422,
                    details={"code": "anspruch", "rest": konto.rest, "beantragt": float(tage)},
                )
        # Die Leitung trägt für andere ein (Krankmeldung per Telefon) → sofort
        # genehmigt; der eigene Antrag geht in die Entscheidung.
        direkt = leitung and user_id != ctx.user_id
        payload = {
            "tenant_id": tenant_id,
            "user_id": user_id,
            "art": req.art,
            "von": req.von.isoformat(),
            "bis": req.bis.isoformat(),
            "halbtag_start": req.halbtag_start,
            "halbtag_ende": req.halbtag_ende,
            "tage_berechnet": str(tage),
            "status": "genehmigt" if direkt else "beantragt",
            "grund": req.grund,
            "attest_dokument_id": req.attest_dokument_id,
            "erstellt_von": ctx.user_id,
        }
        if direkt:
            payload.update({"entschieden_von": ctx.user_id, "entschieden_am": jetzt().isoformat()})
        row = self._db.table("personal_abwesenheiten").insert(payload).execute().data[0]
        log.info(
            "personal_abwesenheit_beantragt",
            tenant_id=tenant_id,
            user_id=user_id,
            art=req.art,
            tage=str(tage),
            direkt=direkt,
        )
        abgesagt = (
            self._schichten_absagen(ctx, tenant_id, user_id, req.von, req.bis, str(row["id"]))
            if direkt
            else 0
        )
        if not direkt:
            melde_abwesenheit_antrag(
                self._db,
                tenant_id=tenant_id,
                antrag=row,
                leitung_ids=self._entscheider(tenant_id, user_id),
            )
        aus = self._abwesenheit(row)
        aus.schichten_im_zeitraum = abgesagt
        return aus

    def _hat_bereich(self, tenant_id: str, user_id: str, bereich_id: str) -> bool:
        rows = (
            self._db.table("personal_qualifikationen")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .eq("arbeitsbereich_id", bereich_id)
            .limit(1)
            .execute()
        ).data or []
        return bool(rows)

    def _ueberlappt(
        self, tenant_id: str, user_id: str, von: date, bis: date, *, ausser: str | None
    ) -> bool:
        rows = (
            self._db.table("personal_abwesenheiten")
            .select("id, status")
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .lte("von", bis.isoformat())
            .gte("bis", von.isoformat())
            .execute()
        ).data or []
        return any(
            r.get("status") in ("beantragt", "genehmigt") and str(r["id"]) != (ausser or "")
            for r in rows
        )

    def _entscheider(self, tenant_id: str, user_id: str) -> set[str]:
        """admin/co_admin des Mandanten + Schichtleitungen, die die Person sehen."""
        ids = {
            str(u["id"])
            for u in self._users(tenant_id)
            if str(u.get("role")) in ("admin", "co_admin") and u.get("deactivated_at") is None
        }
        objekte = self._objekte_von(tenant_id, user_id)
        if objekte:
            rows = (
                self._db.table("staff_property_assignments")
                .select("user_id")
                .eq("tenant_id", tenant_id)
                .in_("property_id", sorted(objekte))
                .execute()
            ).data or []
            kandidaten = {str(r["user_id"]) for r in rows} - {user_id}
            if kandidaten:
                ids |= {
                    str(u["id"])
                    for u in self._users(tenant_id, kandidaten)
                    if str(u.get("role")) == "shift_lead"
                }
        return ids

    def _own_antrag(self, ctx: AuthContext, tenant_id: str, antrag_id: str) -> dict[str, Any]:
        row = load_scoped(
            self._db,
            "personal_abwesenheiten",
            antrag_id,
            tenant_id,
            not_found=PersonalError("Antrag nicht gefunden.", status_code=404),
        )
        self._require_person_im_scope(ctx, tenant_id, str(row["user_id"]))
        return row

    def entscheiden(
        self, ctx: AuthContext, antrag_id: str, req: AbwesenheitEntscheiden
    ) -> Abwesenheit:
        tenant_id = self._require_tenant(ctx)
        row = self._own_antrag(ctx, tenant_id, antrag_id)
        if str(row["user_id"]) == ctx.user_id:
            raise PersonalError("Den eigenen Antrag entscheidet jemand anderes.", status_code=403)
        if row.get("status") != "beantragt":
            raise PersonalError("Dieser Antrag ist bereits entschieden.", status_code=409)
        status = "genehmigt" if req.genehmigen else "abgelehnt"
        (
            self._db.table("personal_abwesenheiten")
            .update(
                {
                    "status": status,
                    "kommentar_entscheidung": req.kommentar,
                    "entschieden_von": ctx.user_id,
                    "entschieden_am": jetzt().isoformat(),
                }
            )
            .eq("id", antrag_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        abgesagt = 0
        if req.genehmigen:
            von, bis = als_date(row["von"]), als_date(row["bis"])
            if von and bis:
                abgesagt = self._schichten_absagen(
                    ctx, tenant_id, str(row["user_id"]), von, bis, antrag_id
                )
        log.info(
            "personal_abwesenheit_entschieden",
            tenant_id=tenant_id,
            antrag_id=antrag_id,
            status=status,
            schichten_abgesagt=abgesagt,
        )
        nach = load_scoped(
            self._db,
            "personal_abwesenheiten",
            antrag_id,
            tenant_id,
            not_found=PersonalError("Antrag nicht gefunden.", status_code=404),
        )
        melde_abwesenheit_entschieden(
            self._db, tenant_id=tenant_id, antrag=nach, entscheider_id=ctx.user_id
        )
        aus = self._abwesenheit(nach)
        aus.schichten_im_zeitraum = abgesagt
        return aus

    def _schichten_absagen(  # noqa: PLR0913 — Gegenzustand braucht alle Bezüge
        self, ctx: AuthContext, tenant_id: str, user_id: str, von: date, bis: date, antrag_id: str
    ) -> int:
        rows = (
            self._db.table("personal_schichten")
            .select("id, datum, status")
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .gte("datum", von.isoformat())
            .lte("datum", bis.isoformat())
            .execute()
        ).data or []
        n = 0
        wochen: set[date] = set()
        for r in rows:
            if r.get("status") not in _AKTIVE_SCHICHT:
                continue
            (
                self._db.table("personal_schichten")
                .update({"status": "abgesagt", "abwesenheit_id": antrag_id})
                .eq("id", str(r["id"]))
                .eq("tenant_id", tenant_id)
                .execute()
            )
            self._protokoll(
                tenant_id,
                str(r["id"]),
                ctx.user_id,
                "abgesagt",
                {"status": r.get("status")},
                {"status": "abgesagt", "abwesenheit_id": antrag_id},
            )
            n += 1
            d = als_date(r["datum"])
            if d and r.get("status") in ("veroeffentlicht", "bestaetigt"):
                wochen.add(d - timedelta(days=d.weekday()))
        for w in wochen:
            melde_dienstplan(
                self._db, tenant_id=tenant_id, user_id=user_id, woche_start=w, geaendert=True
            )
        return n

    def stornieren(self, ctx: AuthContext, antrag_id: str) -> Abwesenheit:
        tenant_id = self._require_tenant(ctx)
        row = self._own_antrag(ctx, tenant_id, antrag_id)
        eigener = str(row["user_id"]) == ctx.user_id
        if row.get("status") not in ("beantragt", "genehmigt"):
            raise PersonalError("Dieser Antrag lässt sich nicht mehr stornieren.", status_code=409)
        if eigener and row.get("status") == "genehmigt" and not self._ist_leitung(ctx):
            raise PersonalError("Genehmigten Urlaub nimmt die Leitung zurück.", status_code=403)
        (
            self._db.table("personal_abwesenheiten")
            .update(
                {
                    "status": "storniert",
                    "entschieden_von": ctx.user_id,
                    "entschieden_am": jetzt().isoformat(),
                }
            )
            .eq("id", antrag_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        # Abgesagte Schichten kommen NICHT automatisch zurück: ob der Dienst noch
        # gebraucht wird, entscheidet die Planung — die Zeilen bleiben mit
        # `abwesenheit_id` markiert und sind im Plan sichtbar.
        nach = load_scoped(
            self._db,
            "personal_abwesenheiten",
            antrag_id,
            tenant_id,
            not_found=PersonalError("Antrag nicht gefunden.", status_code=404),
        )
        return self._abwesenheit(nach)

    # ------------------------------------------------------------------
    # Urlaubskonto
    # ------------------------------------------------------------------

    @staticmethod
    def _urlaubsjahr_von(tag: date, regeln: rw.Regeln) -> int:
        """Kalenderjahr, in dem das Urlaubsjahr beginnt, das `tag` enthält."""
        return tag.year if tag.month >= regeln.urlaubsjahr_start_monat else tag.year - 1

    def urlaubskonto(
        self, ctx: AuthContext, user_id: str, jahr: int, *, intern: bool = False
    ) -> Urlaubskonto:
        tenant_id = self._require_tenant(ctx)
        if not intern:
            self._require_person_im_scope(ctx, tenant_id, user_id)
        regeln = self._regeln(tenant_id)
        von, bis = rw.urlaubsjahr(jahr, regeln.urlaubsjahr_start_monat)
        akte = self._akten(tenant_id, {user_id}).get(user_id) or {}
        konto = self._konto_row(tenant_id, user_id, jahr)
        anteilig = False
        if konto is not None:
            anspruch = als_dec(konto["anspruch"])
            uebertrag = als_dec(konto.get("uebertrag"))
            korrektur = als_dec(konto.get("korrektur"))
        else:
            voll = (
                als_dec(akte.get("urlaubsanspruch_tage"))
                if akte.get("urlaubsanspruch_tage") is not None
                else None
            )
            if voll is None:
                anspruch = Decimal(0)
            else:
                anspruch, anteilig = rw.anspruch_anteilig(
                    voll,
                    jahr_von=von,
                    jahr_bis=bis,
                    eintritt=als_date(akte.get("eintritt")),
                    austritt=als_date(akte.get("austritt")),
                )
            uebertrag = Decimal(0)
            korrektur = Decimal(0)
        genommen, geplant = self._urlaub_summen(tenant_id, user_id, von, bis)
        rest = anspruch + uebertrag + korrektur - genommen - geplant
        verfall = als_date(konto.get("verfall_am")) if konto else None
        return Urlaubskonto(
            user_id=user_id,
            jahr=jahr,
            anspruch=float(anspruch),
            uebertrag=float(uebertrag),
            korrektur=float(korrektur),
            korrektur_grund=(konto or {}).get("korrektur_grund"),
            verfall_am=verfall,
            genommen=float(genommen),
            geplant=float(geplant),
            rest=float(rest),
            anteilig=anteilig,
            konto_vorhanden=konto is not None,
        )

    def _konto_row(self, tenant_id: str, user_id: str, jahr: int) -> dict[str, Any] | None:
        rows = (
            self._db.table("personal_urlaubskonten")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .eq("jahr", jahr)
            .limit(1)
            .execute()
        ).data or []
        return rows[0] if rows else None

    def _urlaub_summen(
        self, tenant_id: str, user_id: str, von: date, bis: date
    ) -> tuple[Decimal, Decimal]:
        rows = (
            self._db.table("personal_abwesenheiten")
            .select("art, status, tage_berechnet, von")
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .gte("von", von.isoformat())
            .lte("von", bis.isoformat())
            .execute()
        ).data or []
        genommen = geplant = Decimal(0)
        for r in rows:
            if r.get("art") not in _URLAUBSARTEN:
                continue
            if r.get("status") == "genehmigt":
                genommen += als_dec(r.get("tage_berechnet"))
            elif r.get("status") == "beantragt":
                geplant += als_dec(r.get("tage_berechnet"))
        return genommen, geplant

    def urlaubskonto_setzen(
        self, ctx: AuthContext, user_id: str, jahr: int, req: UrlaubskontoSet
    ) -> Urlaubskonto:
        tenant_id = self._require_tenant(ctx)
        self._require_planbar(tenant_id, user_id)
        self._db.table("personal_urlaubskonten").upsert(
            {
                "tenant_id": tenant_id,
                "user_id": user_id,
                "jahr": jahr,
                "anspruch": req.anspruch,
                "uebertrag": req.uebertrag,
                "verfall_am": req.verfall_am.isoformat() if req.verfall_am else None,
                "korrektur": req.korrektur,
                "korrektur_grund": req.korrektur_grund,
            },
            on_conflict="tenant_id,user_id,jahr",
        ).execute()
        log.info("personal_urlaubskonto_gesetzt", tenant_id=tenant_id, user_id=user_id, jahr=jahr)
        return self.urlaubskonto(ctx, user_id, jahr)

    def urlaubskonten(self, ctx: AuthContext, jahr: int) -> list[Urlaubskonto]:
        tenant_id = self._require_tenant(ctx)
        ids = self._personen_im_scope(ctx, tenant_id)
        akten = self._akten(tenant_id, ids)
        return [
            self.urlaubskonto(ctx, uid, jahr, intern=True)
            for uid in sorted(ids)
            if (akten.get(uid) or {}).get("beschaeftigungsart") != "extern"
        ]

    # ------------------------------------------------------------------
    # Urlaubssperren
    # ------------------------------------------------------------------

    def sperren(self, ctx: AuthContext) -> list[Urlaubssperre]:
        tenant_id = self._require_tenant(ctx)
        rows = (
            self._db.table("personal_urlaubssperren")
            .select("*")
            .eq("tenant_id", tenant_id)
            .order("von")
            .execute()
        ).data or []
        return [
            Urlaubssperre(
                id=str(r["id"]),
                von=als_date(r["von"]),
                bis=als_date(r["bis"]),  # type: ignore[arg-type]
                grund=r["grund"],
                arbeitsbereich_id=r.get("arbeitsbereich_id"),
            )
            for r in rows
        ]

    def sperre_anlegen(self, ctx: AuthContext, req: UrlaubssperreCreate) -> Urlaubssperre:
        tenant_id = self._require_tenant(ctx)
        if req.arbeitsbereich_id:
            load_scoped(
                self._db,
                "personal_arbeitsbereiche",
                req.arbeitsbereich_id,
                tenant_id,
                columns="id",
                not_found=PersonalError("Arbeitsbereich nicht gefunden.", status_code=404),
            )
        row = (
            self._db.table("personal_urlaubssperren")
            .insert(
                {
                    **req.model_dump(),
                    "von": req.von.isoformat(),
                    "bis": req.bis.isoformat(),
                    "tenant_id": tenant_id,
                }
            )
            .execute()
            .data[0]
        )
        return Urlaubssperre(id=str(row["id"]), **req.model_dump())

    def sperre_loeschen(self, ctx: AuthContext, sperre_id: str) -> None:
        tenant_id = self._require_tenant(ctx)
        load_scoped(
            self._db,
            "personal_urlaubssperren",
            sperre_id,
            tenant_id,
            columns="id",
            not_found=PersonalError("Sperre nicht gefunden.", status_code=404),
        )
        self._db.table("personal_urlaubssperren").delete().eq("id", sperre_id).eq(
            "tenant_id", tenant_id
        ).execute()

    # ------------------------------------------------------------------
    # Wunsch-/Sperrzeiten
    # ------------------------------------------------------------------

    def verfuegbarkeiten(self, ctx: AuthContext, user_id: str) -> list[Verfuegbarkeit]:
        tenant_id = self._require_tenant(ctx)
        self._require_person_im_scope(ctx, tenant_id, user_id)
        rows = (
            self._db.table("personal_verfuegbarkeiten")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .eq("aktiv", True)
            .execute()
        ).data or []
        return [
            self._verf(r)
            for r in sorted(
                rows,
                key=lambda r: (
                    r.get("wiederkehrend_wochentag") is None,
                    str(r.get("wiederkehrend_wochentag") or ""),
                    str(r.get("datum_von") or ""),
                ),
            )
        ]

    @staticmethod
    def _verf(r: dict[str, Any]) -> Verfuegbarkeit:
        return Verfuegbarkeit(
            id=str(r["id"]),
            user_id=str(r["user_id"]),
            art=r["art"],
            wiederkehrend_wochentag=r.get("wiederkehrend_wochentag"),
            datum_von=als_date(r.get("datum_von")),
            datum_bis=als_date(r.get("datum_bis")),
            zeit_von=als_time(r.get("zeit_von")),
            zeit_bis=als_time(r.get("zeit_bis")),
            ganztags=bool(r.get("ganztags", True)),
            notiz=r.get("notiz"),
            aktiv=bool(r.get("aktiv", True)),
        )

    def verfuegbarkeit_anlegen(self, ctx: AuthContext, req: VerfuegbarkeitCreate) -> Verfuegbarkeit:
        tenant_id = self._require_tenant(ctx)
        user_id = req.user_id or ctx.user_id
        if user_id != ctx.user_id:
            if not (self._ist_leitung(ctx) or self._rolle_aus_db(ctx, tenant_id) == "shift_lead"):
                raise PersonalError(
                    "Verfügbarkeiten pflegst du nur für dich selbst.", status_code=403
                )
            self._require_person_im_scope(ctx, tenant_id, user_id)
        self._require_planbar(tenant_id, user_id)
        payload = {
            **req.model_dump(exclude={"user_id"}),
            "tenant_id": tenant_id,
            "user_id": user_id,
            "datum_von": req.datum_von.isoformat() if req.datum_von else None,
            "datum_bis": req.datum_bis.isoformat() if req.datum_bis else None,
            "zeit_von": req.zeit_von.isoformat() if req.zeit_von else None,
            "zeit_bis": req.zeit_bis.isoformat() if req.zeit_bis else None,
        }
        row = self._db.table("personal_verfuegbarkeiten").insert(payload).execute().data[0]
        return self._verf(row)

    def verfuegbarkeit_loeschen(self, ctx: AuthContext, verf_id: str) -> None:
        tenant_id = self._require_tenant(ctx)
        row = load_scoped(
            self._db,
            "personal_verfuegbarkeiten",
            verf_id,
            tenant_id,
            columns="id, user_id",
            not_found=PersonalError("Eintrag nicht gefunden.", status_code=404),
        )
        if str(row["user_id"]) != ctx.user_id:
            self._require_person_im_scope(ctx, tenant_id, str(row["user_id"]))
            if not (self._ist_leitung(ctx) or self._rolle_aus_db(ctx, tenant_id) == "shift_lead"):
                raise PersonalError("Eintrag nicht gefunden.", status_code=404)
        (
            self._db.table("personal_verfuegbarkeiten")
            .update({"aktiv": False})
            .eq("id", verf_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )

    # ------------------------------------------------------------------
    # Krankenstand
    # ------------------------------------------------------------------

    def krankenstand(self, ctx: AuthContext, von: date, bis: date) -> list[Krankenstand]:
        tenant_id = self._require_tenant(ctx)
        if (bis - von).days > 400:
            raise PersonalError("Zeitraum zu lang (max. 400 Tage).", status_code=422)
        ids = self._personen_im_scope(ctx, tenant_id)
        if not ids:
            return []
        rows = (
            self._db.table("personal_abwesenheiten")
            .select("user_id, art, status, tage_berechnet")
            .eq("tenant_id", tenant_id)
            .in_("user_id", sorted(ids))
            .lte("von", bis.isoformat())
            .gte("bis", von.isoformat())
            .execute()
        ).data or []
        summe: dict[str, tuple[Decimal, int]] = {}
        for r in rows:
            if r.get("art") not in _KRANK or r.get("status") != "genehmigt":
                continue
            t, n = summe.get(str(r["user_id"]), (Decimal(0), 0))
            summe[str(r["user_id"])] = (t + als_dec(r.get("tage_berechnet")), n + 1)
        namen = {str(u["id"]): u.get("full_name") for u in self._users(tenant_id, ids)}
        return sorted(
            [
                Krankenstand(user_id=uid, full_name=namen.get(uid), tage_krank=float(t), faelle=n)
                for uid, (t, n) in summe.items()
            ],
            key=lambda k: (-k.tage_krank, k.user_id),
        )
