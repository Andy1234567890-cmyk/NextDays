"""Dienstplan (0541, Konzept E1): Wochenplan, Schichten, Konflikte, Bedarf aus
Aufgaben, Veröffentlichung mit Lesebestätigung, Bewerbungen auf offene Schichten.

Gegenzustände (Wurzel 1): eine genehmigte Abwesenheit sagt die Schichten im
Zeitraum ab (abwesenheiten.py); eine gelöschte Aufgabe entfernt ihre
Bedarfsschicht per FK-Cascade; eine Umplanung protokolliert Alt/Neu.
Idempotenz (Wurzel 2): der Bedarfslauf schreibt je Aufgabe höchstens eine
Schicht (UNIQUE tenant_id, task_id), Woche kopieren überspringt vorhandene
Zeitfenster derselben Person.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from postgrest.exceptions import APIError

from src.core.security import AuthContext
from src.core.supabase import load_scoped

from . import regelwerk as rw
from ._base import (
    _UNIQUE_VERLETZUNG,
    LEITUNG,
    PersonalError,
    als_date,
    als_dt,
    als_float,
    jetzt,
    log,
)
from .benachrichtigungen import melde_dienstplan, melde_schicht_offen
from .plan_zusatz import PlanZusatzMixin
from .planung_schemas import MAX_ZEITRAUM_PLAN_TAGE
from .schemas import (
    Abwesenheit,
    BedarfResponse,
    BewerbungEntscheiden,
    Konflikt,
    PlanPerson,
    Schicht,
    SchichtCreate,
    SchichtUpdate,
    VeroeffentlichenResponse,
    WocheKopieren,
    WochenplanResponse,
)

_SCHICHT_SPALTEN = (
    "id, tenant_id, user_id, datum, start_at, end_at, pause_min, arbeitsbereich_id, "
    "property_id, building_id, vorlage_id, status, quelle, task_id, abwesenheit_id, "
    "bestaetigt_am, notiz, erstellt_von, created_at, updated_at"
)
_AKTIV = ("entwurf", "veroeffentlicht", "bestaetigt")
# Tauschanfragen, die im Plan als Marker erscheinen (0544): angefragt = die
# Kollegin muss noch antworten, angenommen = die Planung muss freigeben.
_TAUSCH_OFFEN = ("angefragt", "angenommen")
# Aufgaben-Status, die Arbeit bedeuten (offen, angenommen, in Arbeit).
_TASK_OFFEN = ("open", "accepted", "in_progress")
# Ein Wochenplan hat 7 Tage; die Randtage davor/danach braucht die Ruhezeit.
_RAND_TAGE = 1


def _montag(tag: date) -> date:
    return tag - timedelta(days=tag.weekday())


class SchichtenService(PlanZusatzMixin):
    # ------------------------------------------------------------------
    # Lesen
    # ------------------------------------------------------------------

    def wochenplan(
        self, ctx: AuthContext, woche_start: date, *, nur_eigene: bool = False
    ) -> WochenplanResponse:
        """Die Kalenderwoche, in die `woche_start` fällt (Montag bis Sonntag)."""
        montag = _montag(woche_start)
        return self.zeitraum(
            ctx, montag, montag + timedelta(days=6), nur_eigene=nur_eigene
        )

    def zeitraum(  # noqa: PLR0914 — der Plan trägt viele Nebeninformationen
        self, ctx: AuthContext, von: date, bis: date, *, nur_eigene: bool = False
    ) -> WochenplanResponse:
        """Ein freies Fenster (0544) — Tages-, Wochen- und Monatsansicht laufen darüber.

        Die Woche ist der Sonderfall `von = Montag, bis = Sonntag`; deshalb gibt
        es hier nur EINE Rechnung und nicht zwei, die auseinanderlaufen.
        """
        tenant_id = self._require_tenant(ctx)
        if bis < von:
            raise PersonalError("Das Ende liegt vor dem Beginn.", status_code=422)
        if (bis - von).days + 1 > MAX_ZEITRAUM_PLAN_TAGE:
            raise PersonalError(
                f"Zeitraum zu lang (max. {MAX_ZEITRAUM_PLAN_TAGE} Tage).",
                status_code=422,
                details={"code": "zeitraum_zu_lang", "max": MAX_ZEITRAUM_PLAN_TAGE},
            )
        woche_start, woche_ende = von, bis
        regeln_row = self._regeln_row(tenant_id)
        bestaetigt = bool(regeln_row and regeln_row.get("bestaetigt_am"))
        zeitzone = str(regeln_row["zeitzone"]) if regeln_row else "UTC"
        personen_ids = {ctx.user_id} if nur_eigene else self._personen_im_scope(ctx, tenant_id)
        personen = self._plan_personen(tenant_id, personen_ids)
        schichten_rows = self._schichten_im_zeitraum(
            tenant_id,
            woche_start - timedelta(days=_RAND_TAGE),
            woche_ende + timedelta(days=_RAND_TAGE),
        )
        # Offene Schichten (Bedarf) sieht die Leitung immer; Mitarbeitende nur an
        # ihren freigegebenen Objekten (Bewerbung).
        sichtbar_offen = self._offene_sichtbar(ctx, tenant_id)
        im_scope = [
            r
            for r in schichten_rows
            if (r.get("user_id") and str(r["user_id"]) in personen_ids)
            or (not r.get("user_id") and not nur_eigene and sichtbar_offen(r))
        ]
        abwesenheiten = self._abwesenheiten_im_zeitraum(
            tenant_id, personen_ids, woche_start, woche_ende
        )
        feiertage = self._feiertage_still(tenant_id, woche_start, woche_ende)
        bewerbungen = self._bewerbungen_fuer(
            [str(r["id"]) for r in im_scope if not r.get("user_id")]
        )
        titel = self._property_titel(
            tenant_id, {str(r["property_id"]) for r in im_scope if r.get("property_id")}
        )
        regeln = self._regeln(tenant_id) if bestaetigt else None
        tausch_je_schicht, tausche = self._tausch_im_fenster(
            tenant_id, personen_ids, woche_start, woche_ende, titel
        )
        schichten: list[Schicht] = []
        minuten: dict[str, int] = {}
        for r in im_scope:
            tag = als_date(r["datum"])
            if tag is None or not woche_start <= tag <= woche_ende:
                continue
            konflikte = (
                self._konflikte_fuer_row(r, schichten_rows, abwesenheiten, regeln, tenant_id)
                if regeln and r.get("user_id") and r.get("status") in _AKTIV
                else []
            )
            s = self._schicht(r, titel, konflikte, bewerbungen.get(str(r["id"]), []), ctx.user_id)
            s.tausch_status = tausch_je_schicht.get(s.id)
            schichten.append(s)
            if s.user_id and s.status in _AKTIV:
                minuten[s.user_id] = minuten.get(s.user_id, 0) + s.netto_minuten
        # Die Summenspalte (AZK, Guttage, Zuschläge, Verdienstgrenze) und die
        # Geburtstage hängen am FENSTER, nicht an der Person allein.
        self._plan_extras(
            ctx, tenant_id, personen, woche_start, woche_ende, schichten, regeln, feiertage
        )
        veroeff = self._veroeffentlichung(tenant_id, woche_start)
        return WochenplanResponse(
            woche_start=woche_start,
            bis=woche_ende,
            zeitzone=zeitzone,
            personen=personen,
            schichten=sorted(schichten, key=lambda s: (s.start_at, s.user_id or "")),
            abwesenheiten=[self._abwesenheit(a) for a in abwesenheiten],
            feiertage={d.isoformat(): n for d, n in feiertage.items()},
            veroeffentlicht_am=als_dt(veroeff.get("veroeffentlicht_am")) if veroeff else None,
            lesebestaetigungen=self._lesebestaetigungen(veroeff) if veroeff else {},
            minuten_je_person=minuten,
            regeln_bestaetigt=bestaetigt,
            verfuegbarkeiten=self._verfuegbarkeiten_aufgeloest(
                tenant_id, personen_ids, woche_start, woche_ende, zeitzone
            ),
            wetter=self._wetter(tenant_id, woche_start, woche_ende, im_scope, regeln_row),
            tausch=tausche,
        )

    def _offene_sichtbar(self, ctx: AuthContext, tenant_id: str) -> Any:  # noqa: ANN401 — Prädikat
        if self._ist_leitung(ctx):
            return lambda _r: True
        meine = self._objekte_von(tenant_id, ctx.user_id)
        return lambda r: bool(r.get("property_id")) and str(r["property_id"]) in meine

    def _plan_personen(self, tenant_id: str, ids: set[str]) -> list[PlanPerson]:
        users = self._users(tenant_id, ids)
        akten = self._akten(tenant_id, ids)
        quali = self._quali_bereiche(tenant_id, ids)
        aus = []
        for u in sorted(
            users, key=lambda r: (str(r.get("full_name") or "").casefold(), str(r["id"]))
        ):
            if u.get("deactivated_at") is not None:
                continue
            uid = str(u["id"])
            a = akten.get(uid) or {}
            aus.append(
                PlanPerson(
                    user_id=uid,
                    full_name=u.get("full_name"),
                    role=str(u.get("role")),
                    avatar_url=u.get("avatar_url"),
                    beschaeftigungsart=a.get("beschaeftigungsart"),
                    wochenstunden_soll=als_float(a.get("wochenstunden")),
                    arbeitsbereiche=quali.get(uid, []),
                )
            )
        return aus

    # ------------------------------------------------------------------
    # Kopf und Summenspalte des Plans (0544)
    # ------------------------------------------------------------------

    def _plan_extras(  # noqa: PLR0913 — Fenster, Personen, Bestand und Regeln
        self,
        ctx: AuthContext,
        tenant_id: str,
        personen: list[PlanPerson],
        von: date,
        bis: date,
        schichten: list[Schicht],
        regeln: rw.Regeln | None,
        feiertage: dict[date, str],
    ) -> None:
        """Geburtstag, Schichtleitung, AZK, Guttage, Zuschläge, Verdienstgrenze.

        Geld je Person (Zuschläge, Verdienstgrenze) sieht NUR die Leitung
        (admin/co_admin, Rolle frisch aus der DB — Wurzel 7); für die
        Schichtleitung bleiben die Felder `None` (§4.3).
        """
        ids = {p.user_id for p in personen}
        if not ids:
            return
        rolle = self._rolle_aus_db(ctx, tenant_id)
        leitung = rolle in LEITUNG
        azk = self._azk_salden(tenant_id, ids)
        guttage = self._guttage_salden(tenant_id, ids)
        akten = self._akten(tenant_id, ids)
        geburtstage = self._geburtstage(tenant_id, ids, von, bis)
        zuschlaege = (
            self._zuschlaege_je_person(schichten, regeln, feiertage, akten) if leitung else {}
        )
        grenzen = self._verdienstgrenzen(tenant_id, ids, von, akten) if leitung else {}
        for p in personen:
            p.geburtstag_am = geburtstage.get(p.user_id)
            p.ist_schichtleitung = p.role == "shift_lead"
            p.azk_minuten = azk.get(p.user_id)
            p.guttage = guttage.get(p.user_id)
            if leitung:
                p.zuschlaege_minor = zuschlaege.get(p.user_id)
                p.verdienstgrenze = grenzen.get(p.user_id)

    def _quali_bereiche(self, tenant_id: str, ids: set[str]) -> dict[str, list[str]]:
        if not ids:
            return {}
        rows = (
            self._db.table("personal_qualifikationen")
            .select("user_id, arbeitsbereich_id")
            .eq("tenant_id", tenant_id)
            .in_("user_id", sorted(ids))
            .execute()
        ).data or []
        aus: dict[str, list[str]] = {}
        for r in rows:
            liste = aus.setdefault(str(r["user_id"]), [])
            if str(r["arbeitsbereich_id"]) not in liste:
                liste.append(str(r["arbeitsbereich_id"]))
        return aus

    def _schichten_im_zeitraum(self, tenant_id: str, von: date, bis: date) -> list[dict[str, Any]]:
        return (
            self._db.table("personal_schichten")
            .select(_SCHICHT_SPALTEN)
            .eq("tenant_id", tenant_id)
            .gte("datum", von.isoformat())
            .lte("datum", bis.isoformat())
            .execute()
        ).data or []

    def _abwesenheiten_im_zeitraum(
        self, tenant_id: str, ids: set[str], von: date, bis: date
    ) -> list[dict[str, Any]]:
        if not ids:
            return []
        rows = (
            self._db.table("personal_abwesenheiten")
            .select("*")
            .eq("tenant_id", tenant_id)
            .in_("user_id", sorted(ids))
            .lte("von", bis.isoformat())
            .gte("bis", von.isoformat())
            .execute()
        ).data or []
        return [r for r in rows if r.get("status") in ("beantragt", "genehmigt")]

    def _feiertage_still(self, tenant_id: str, von: date, bis: date) -> dict[date, str]:
        """Feiertage für die Anzeige — fehlen sie, bleibt die Karte leer, der
        Fehler steht in `regeln_bestaetigt`/Konflikten, nicht als 500."""
        try:
            return self._feiertage(tenant_id, von, bis)
        except PersonalError:
            return {}

    def _bewerbungen_fuer(self, schicht_ids: list[str]) -> dict[str, list[dict[str, Any]]]:
        if not schicht_ids:
            return {}
        rows = (
            self._db.table("personal_schicht_bewerbungen")
            .select("schicht_id, user_id, status")
            .in_("schicht_id", schicht_ids)
            .execute()
        ).data or []
        aus: dict[str, list[dict[str, Any]]] = {}
        for r in rows:
            aus.setdefault(str(r["schicht_id"]), []).append(r)
        return aus

    def _veroeffentlichung(self, tenant_id: str, woche_start: date) -> dict[str, Any] | None:
        rows = (
            self._db.table("personal_veroeffentlichungen")
            .select("id, veroeffentlicht_am, anzahl_schichten")
            .eq("tenant_id", tenant_id)
            .eq("woche_start", woche_start.isoformat())
            .limit(1)
            .execute()
        ).data or []
        return rows[0] if rows else None

    def _lesebestaetigungen(self, veroeff: dict[str, Any]) -> dict[str, datetime]:
        rows = (
            self._db.table("personal_lesebestaetigungen")
            .select("user_id, bestaetigt_am")
            .eq("veroeffentlichung_id", str(veroeff["id"]))
            .execute()
        ).data or []
        return {
            str(r["user_id"]): als_dt(r["bestaetigt_am"])
            for r in rows
            if als_dt(r["bestaetigt_am"])
        }  # type: ignore[misc]

    @staticmethod
    def _abwesenheit(a: dict[str, Any]) -> Abwesenheit:
        return Abwesenheit(
            id=str(a["id"]),
            user_id=str(a["user_id"]),
            art=a["art"],
            von=als_date(a["von"]),
            bis=als_date(a["bis"]),  # type: ignore[arg-type]
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
        )

    def _schicht(  # noqa: PLR0913 — eine Zeile mit ihren Nebeninformationen
        self,
        r: dict[str, Any],
        titel: dict[str, str],
        konflikte: list[rw.Konflikt],
        bewerbungen: list[dict[str, Any]],
        eigener_user: str,
    ) -> Schicht:
        start, ende = als_dt(r["start_at"]), als_dt(r["end_at"])
        if start is None or ende is None:
            raise PersonalError("Schicht ohne Zeiten.", status_code=500)
        eigene = next((b["status"] for b in bewerbungen if str(b["user_id"]) == eigener_user), None)
        return Schicht(
            id=str(r["id"]),
            user_id=r.get("user_id"),
            datum=als_date(r["datum"]),  # type: ignore[arg-type]
            start_at=start,
            end_at=ende,
            pause_min=int(r.get("pause_min") or 0),
            arbeitsbereich_id=r.get("arbeitsbereich_id"),
            property_id=r.get("property_id"),
            property_title=titel.get(str(r.get("property_id") or "")),
            vorlage_id=r.get("vorlage_id"),
            status=r["status"],
            quelle=r["quelle"],
            task_id=r.get("task_id"),
            abwesenheit_id=r.get("abwesenheit_id"),
            bestaetigt_am=als_dt(r.get("bestaetigt_am")),
            notiz=r.get("notiz"),
            netto_minuten=rw.netto_minuten(start, ende, int(r.get("pause_min") or 0)),
            konflikte=[Konflikt(art=k.art, schwere=k.schwere, werte=k.werte) for k in konflikte],
            bewerbungen=sum(1 for b in bewerbungen if b.get("status") == "offen"),
            eigene_bewerbung=eigene,
        )

    # ------------------------------------------------------------------
    # Konflikte
    # ------------------------------------------------------------------

    def _block(self, r: dict[str, Any]) -> rw.Zeitblock:
        return rw.Zeitblock(
            id=str(r["id"]),
            user_id=r.get("user_id"),
            start_at=als_dt(r["start_at"]) or jetzt(),
            end_at=als_dt(r["end_at"]) or jetzt(),
            pause_min=int(r.get("pause_min") or 0),
            property_id=r.get("property_id"),
            arbeitsbereich_id=r.get("arbeitsbereich_id"),
        )

    def _konflikte_fuer_row(  # noqa: PLR0913 — Bestand + Regeln je Aufruf
        self,
        r: dict[str, Any],
        alle: list[dict[str, Any]],
        abwesenheiten: list[dict[str, Any]],
        regeln: rw.Regeln,
        tenant_id: str,
    ) -> list[rw.Konflikt]:
        uid = str(r["user_id"])
        andere = [
            self._block(x)
            for x in alle
            if x.get("user_id")
            and str(x["user_id"]) == uid
            and str(x["id"]) != str(r["id"])
            and x.get("status") in _AKTIV
        ]
        block = self._block(r)
        return self._konflikte(tenant_id, block, andere, abwesenheiten, regeln)

    def _konflikte(  # noqa: PLR0913
        self,
        tenant_id: str,
        block: rw.Zeitblock,
        andere: list[rw.Zeitblock],
        abwesenheiten: list[dict[str, Any]],
        regeln: rw.Regeln,
    ) -> list[rw.Konflikt]:
        if not block.user_id:
            return []
        von = rw.ortstag(block.start_at, regeln.zeitzone) - timedelta(days=1)
        bis = rw.ortstag(block.end_at, regeln.zeitzone) + timedelta(days=1)
        abw_tage: set[date] = set()
        for a in abwesenheiten:
            if str(a["user_id"]) != block.user_id or a.get("status") != "genehmigt":
                continue
            d0, d1 = als_date(a["von"]), als_date(a["bis"])
            if d0 and d1:
                t = d0
                while t <= d1:
                    abw_tage.add(t)
                    t += timedelta(days=1)
        fenster = self._sperrfenster(tenant_id, block.user_id, von, bis, regeln.zeitzone)
        sperren = self._urlaubssperren_tage(tenant_id, von, bis, block.arbeitsbereich_id)
        qualifiziert = self._qualifiziert(tenant_id, block) if block.arbeitsbereich_id else None
        return rw.konflikte_pruefen(
            block,
            regeln=regeln,
            andere=andere,
            abwesenheits_tage=abw_tage,
            gesperrte_fenster=fenster,
            urlaubssperren_tage=sperren,
            qualifiziert=qualifiziert,
        )

    def _sperrfenster(  # noqa: PLR0913
        self, tenant_id: str, user_id: str, von: date, bis: date, zeitzone: str
    ) -> list[tuple[datetime, datetime]]:
        rows = (
            self._db.table("personal_verfuegbarkeiten")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .eq("art", "gesperrt")
            .eq("aktiv", True)
            .execute()
        ).data or []
        fenster: list[tuple[datetime, datetime]] = []
        for r in rows:
            fenster.extend(
                rw.sperrfenster(
                    wochentag=r.get("wiederkehrend_wochentag"),
                    datum_von=als_date(r.get("datum_von")),
                    datum_bis=als_date(r.get("datum_bis")),
                    zeit_von=_t(r.get("zeit_von")),
                    zeit_bis=_t(r.get("zeit_bis")),
                    ganztags=bool(r.get("ganztags", True)),
                    von=von,
                    bis=bis,
                    zeitzone=zeitzone,
                )
            )
        return fenster

    def _urlaubssperren_tage(
        self, tenant_id: str, von: date, bis: date, arbeitsbereich_id: str | None
    ) -> set[date]:
        rows = (
            self._db.table("personal_urlaubssperren")
            .select("von, bis, arbeitsbereich_id")
            .eq("tenant_id", tenant_id)
            .lte("von", bis.isoformat())
            .gte("bis", von.isoformat())
            .execute()
        ).data or []
        tage: set[date] = set()
        for r in rows:
            if r.get("arbeitsbereich_id") and r["arbeitsbereich_id"] != arbeitsbereich_id:
                continue
            d0, d1 = als_date(r["von"]), als_date(r["bis"])
            if d0 and d1:
                t = d0
                while t <= d1:
                    tage.add(t)
                    t += timedelta(days=1)
        return tage

    def _qualifiziert(self, tenant_id: str, block: rw.Zeitblock) -> bool:
        rows = (
            self._db.table("personal_qualifikationen")
            .select("property_id")
            .eq("tenant_id", tenant_id)
            .eq("user_id", str(block.user_id))
            .eq("arbeitsbereich_id", str(block.arbeitsbereich_id))
            .execute()
        ).data or []
        if not rows:
            return False
        return any(r.get("property_id") in (None, block.property_id) for r in rows)

    def konflikte_vorschau(self, ctx: AuthContext, req: SchichtCreate) -> list[Konflikt]:
        tenant_id = self._require_tenant(ctx)
        regeln = self._regeln(tenant_id)
        if not req.user_id:
            return []
        self._require_person_im_scope(ctx, tenant_id, req.user_id)
        block = rw.Zeitblock(
            id="neu",
            user_id=req.user_id,
            start_at=req.start_at,
            end_at=req.end_at,
            pause_min=req.pause_min,
            property_id=req.property_id,
            arbeitsbereich_id=req.arbeitsbereich_id,
        )
        return [
            Konflikt(art=k.art, schwere=k.schwere, werte=k.werte)
            for k in self._konflikte_live(tenant_id, block, regeln)
        ]

    def _konflikte_live(
        self, tenant_id: str, block: rw.Zeitblock, regeln: rw.Regeln, *, ausser: str | None = None
    ) -> list[rw.Konflikt]:
        von = rw.ortstag(block.start_at, regeln.zeitzone) - timedelta(days=_RAND_TAGE)
        bis = rw.ortstag(block.end_at, regeln.zeitzone) + timedelta(days=_RAND_TAGE)
        rows = self._schichten_im_zeitraum(tenant_id, von, bis)
        andere = [
            self._block(x)
            for x in rows
            if x.get("user_id")
            and str(x["user_id"]) == block.user_id
            and str(x["id"]) != (ausser or "")
            and x.get("status") in _AKTIV
        ]
        abw = self._abwesenheiten_im_zeitraum(tenant_id, {str(block.user_id)}, von, bis)
        return self._konflikte(tenant_id, block, andere, abw, regeln)

    # ------------------------------------------------------------------
    # Schreiben
    # ------------------------------------------------------------------

    def _zone_fuer(self, tenant_id: str, property_id: str | None, regeln: rw.Regeln) -> str:
        if property_id:
            p = self._property_im_tenant(tenant_id, property_id)
            if p.get("archived_at"):
                raise PersonalError("Objekt ist archiviert.", status_code=422)
            if p.get("timezone"):
                return str(p["timezone"])
        return regeln.zeitzone

    def _require_objekt_im_scope(
        self, ctx: AuthContext, tenant_id: str, property_id: str | None
    ) -> None:
        if property_id and not self._ist_leitung(ctx):
            if property_id not in self._objekte_von(tenant_id, ctx.user_id):
                raise PersonalError("Objekt nicht gefunden.", status_code=404)

    def anlegen(self, ctx: AuthContext, req: SchichtCreate) -> Schicht:
        tenant_id = self._require_tenant(ctx)
        regeln = self._regeln(tenant_id)
        self._require_objekt_im_scope(ctx, tenant_id, req.property_id)
        if req.user_id:
            self._require_person_im_scope(ctx, tenant_id, req.user_id)
            self._require_planbar(tenant_id, req.user_id)
        if req.vorlage_id:
            load_scoped(
                self._db,
                "personal_schichtvorlagen",
                req.vorlage_id,
                tenant_id,
                columns="id",
                not_found=PersonalError("Vorlage nicht gefunden.", status_code=404),
            )
        zone = self._zone_fuer(tenant_id, req.property_id, regeln)
        block = rw.Zeitblock(
            id="neu",
            user_id=req.user_id,
            start_at=req.start_at,
            end_at=req.end_at,
            pause_min=req.pause_min,
            property_id=req.property_id,
            arbeitsbereich_id=req.arbeitsbereich_id,
        )
        konflikte = self._konflikte_live(tenant_id, block, regeln) if req.user_id else []
        self._konflikte_durchsetzen(konflikte, req.warnungen_akzeptieren)
        gebaeude = (
            self._property_im_tenant(tenant_id, req.property_id).get("building_id")
            if req.property_id
            else None
        )
        payload = {
            "tenant_id": tenant_id,
            "user_id": req.user_id,
            "datum": rw.ortstag(req.start_at, zone).isoformat(),
            "start_at": req.start_at.astimezone(UTC).isoformat(),
            "end_at": req.end_at.astimezone(UTC).isoformat(),
            "pause_min": req.pause_min,
            "arbeitsbereich_id": req.arbeitsbereich_id,
            "property_id": req.property_id,
            "building_id": gebaeude,
            "vorlage_id": req.vorlage_id,
            "status": "entwurf",
            "quelle": "vorlage" if req.vorlage_id else "manuell",
            "notiz": req.notiz,
            "erstellt_von": ctx.user_id,
        }
        row = self._db.table("personal_schichten").insert(payload).execute().data[0]
        self._protokoll(tenant_id, str(row["id"]), ctx.user_id, "angelegt", None, _kern(row))
        log.info(
            "personal_schicht_angelegt",
            tenant_id=tenant_id,
            schicht_id=row["id"],
            user_id=req.user_id,
            konflikte=len(konflikte),
        )
        if not req.user_id:
            melde_schicht_offen(self._db, tenant_id=tenant_id, schicht=row)
        return self._nachladen(ctx, tenant_id, str(row["id"]), konflikte)

    @staticmethod
    def _konflikte_durchsetzen(konflikte: list[rw.Konflikt], warnungen_ok: bool) -> None:
        if rw.hat_fehler(konflikte):
            raise PersonalError(
                "Die Schicht verletzt eine Regel.",
                status_code=422,
                details={
                    "konflikte": [
                        {"art": k.art, "schwere": k.schwere, "werte": k.werte} for k in konflikte
                    ]
                },
            )
        if konflikte and not warnungen_ok:
            raise PersonalError(
                "Die Schicht hat Hinweise — bitte bestätigen.",
                status_code=409,
                details={
                    "konflikte": [
                        {"art": k.art, "schwere": k.schwere, "werte": k.werte} for k in konflikte
                    ]
                },
            )

    def _nachladen(
        self, ctx: AuthContext, tenant_id: str, schicht_id: str, konflikte: list[rw.Konflikt]
    ) -> Schicht:
        row = load_scoped(
            self._db,
            "personal_schichten",
            schicht_id,
            tenant_id,
            columns=_SCHICHT_SPALTEN,
            not_found=PersonalError("Schicht nicht gefunden.", status_code=404),
        )
        titel = self._property_titel(
            tenant_id, {str(row["property_id"])} if row.get("property_id") else set()
        )
        bew = self._bewerbungen_fuer([schicht_id]).get(schicht_id, [])
        return self._schicht(row, titel, konflikte, bew, ctx.user_id)

    def _own_schicht(self, ctx: AuthContext, tenant_id: str, schicht_id: str) -> dict[str, Any]:
        """Schicht laden UND Scope prüfen (Person oder Objekt der Schicht)."""
        row = load_scoped(
            self._db,
            "personal_schichten",
            schicht_id,
            tenant_id,
            columns=_SCHICHT_SPALTEN,
            not_found=PersonalError("Schicht nicht gefunden.", status_code=404),
        )
        if row.get("user_id"):
            self._require_person_im_scope(ctx, tenant_id, str(row["user_id"]))
        else:
            self._require_objekt_im_scope(ctx, tenant_id, row.get("property_id"))
        return row

    def aendern(self, ctx: AuthContext, schicht_id: str, req: SchichtUpdate) -> Schicht:
        tenant_id = self._require_tenant(ctx)
        regeln = self._regeln(tenant_id)
        vorher = self._own_schicht(ctx, tenant_id, schicht_id)
        if vorher.get("status") == "abgesagt":
            raise PersonalError("Eine abgesagte Schicht wird nicht mehr geändert.", status_code=409)
        neu_user = (
            None
            if req.user_id_leeren
            else (req.user_id if req.user_id is not None else vorher.get("user_id"))
        )
        if neu_user:
            self._require_person_im_scope(ctx, tenant_id, str(neu_user))
            self._require_planbar(tenant_id, str(neu_user))
        property_id = req.property_id if req.property_id is not None else vorher.get("property_id")
        self._require_objekt_im_scope(ctx, tenant_id, property_id)
        start = req.start_at or als_dt(vorher["start_at"])
        ende = req.end_at or als_dt(vorher["end_at"])
        if start is None or ende is None or ende <= start:
            raise PersonalError("Ende muss nach dem Start liegen.", status_code=422)
        if (ende - start) > timedelta(hours=24):
            raise PersonalError("Eine Schicht ist höchstens 24 Stunden lang.", status_code=422)
        pause = req.pause_min if req.pause_min is not None else int(vorher.get("pause_min") or 0)
        bereich = (
            req.arbeitsbereich_id
            if req.arbeitsbereich_id is not None
            else vorher.get("arbeitsbereich_id")
        )
        zone = self._zone_fuer(tenant_id, property_id, regeln)
        block = rw.Zeitblock(
            id=schicht_id,
            user_id=neu_user,
            start_at=start,
            end_at=ende,
            pause_min=pause,
            property_id=property_id,
            arbeitsbereich_id=bereich,
        )
        konflikte = (
            self._konflikte_live(tenant_id, block, regeln, ausser=schicht_id) if neu_user else []
        )
        self._konflikte_durchsetzen(konflikte, req.warnungen_akzeptieren)
        gebaeude = (
            self._property_im_tenant(tenant_id, property_id).get("building_id")
            if property_id
            else None
        )
        payload: dict[str, Any] = {
            "user_id": neu_user,
            "datum": rw.ortstag(start, zone).isoformat(),
            "start_at": start.astimezone(UTC).isoformat(),
            "end_at": ende.astimezone(UTC).isoformat(),
            "pause_min": pause,
            "arbeitsbereich_id": bereich,
            "property_id": property_id,
            "building_id": gebaeude,
        }
        if req.notiz is not None:
            payload["notiz"] = req.notiz
        # Ein veröffentlichter/bestätigter Dienst, der sich ändert, geht zurück
        # auf „veröffentlicht" — die Person muss die Änderung neu sehen.
        if vorher.get("status") == "bestaetigt" and _zeit_geaendert(vorher, payload):
            payload["status"] = "veroeffentlicht"
            payload["bestaetigt_am"] = None
        if str(vorher.get("user_id") or "") != str(neu_user or ""):
            payload["quelle"] = vorher.get("quelle") or "manuell"
        (
            self._db.table("personal_schichten")
            .update(payload)
            .eq("id", schicht_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        art = (
            "zugewiesen" if str(vorher.get("user_id") or "") != str(neu_user or "") else "geaendert"
        )
        self._protokoll(
            tenant_id, schicht_id, ctx.user_id, art, _kern(vorher), {**_kern(vorher), **payload}
        )
        nachher = self._nachladen(ctx, tenant_id, schicht_id, konflikte)
        # Gegenzustand: veröffentlichte Änderung an einer Person → Meldung an alte
        # UND neue Person (die alte verliert den Dienst, die neue bekommt ihn).
        if vorher.get("status") in ("veroeffentlicht", "bestaetigt"):
            betroffen = {str(vorher.get("user_id") or ""), str(neu_user or "")} - {""}
            for uid in betroffen:
                melde_dienstplan(
                    self._db,
                    tenant_id=tenant_id,
                    user_id=uid,
                    woche_start=nachher.datum - timedelta(days=nachher.datum.weekday()),
                    geaendert=True,
                )
        return nachher

    def loeschen(self, ctx: AuthContext, schicht_id: str) -> None:
        tenant_id = self._require_tenant(ctx)
        vorher = self._own_schicht(ctx, tenant_id, schicht_id)
        if vorher.get("status") in ("veroeffentlicht", "bestaetigt"):
            # Veröffentlichte Dienste werden ABGESAGT, nicht gelöscht: die Person
            # hat sie gesehen und braucht die Gegenmeldung (Wurzel 1).
            (
                self._db.table("personal_schichten")
                .update({"status": "abgesagt"})
                .eq("id", schicht_id)
                .eq("tenant_id", tenant_id)
                .execute()
            )
            self._protokoll(tenant_id, schicht_id, ctx.user_id, "abgesagt", _kern(vorher), None)
            if vorher.get("user_id"):
                tag = als_date(vorher["datum"]) or date.today()
                melde_dienstplan(
                    self._db,
                    tenant_id=tenant_id,
                    user_id=str(vorher["user_id"]),
                    woche_start=_montag(tag),
                    geaendert=True,
                )
            return
        self._protokoll(tenant_id, schicht_id, ctx.user_id, "geloescht", _kern(vorher), None)
        (
            self._db.table("personal_schichten")
            .delete()
            .eq("id", schicht_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )

    def woche_kopieren(self, ctx: AuthContext, req: WocheKopieren) -> BedarfResponse:
        tenant_id = self._require_tenant(ctx)
        regeln = self._regeln(tenant_id)
        quelle = _montag(req.quelle_woche_start)
        ziel = _montag(req.ziel_woche_start)
        if quelle == ziel:
            raise PersonalError("Quelle und Ziel sind dieselbe Woche.", status_code=422)
        versatz = ziel - quelle
        personen = self._personen_im_scope(ctx, tenant_id)
        quelle_rows = [
            r
            for r in self._schichten_im_zeitraum(tenant_id, quelle, quelle + timedelta(days=6))
            if r.get("status") in _AKTIV
            and r.get("quelle") != "bedarf_aufgabe"
            and (not r.get("user_id") or str(r["user_id"]) in personen)
        ]
        vorhanden_rows = self._schichten_im_zeitraum(tenant_id, ziel, ziel + timedelta(days=6))
        vorhanden_keys = {
            (str(r.get("user_id") or ""), str(r["start_at"]), str(r["end_at"]))
            for r in vorhanden_rows
        }
        angelegt = uebersprungen = 0
        for r in quelle_rows:
            start, ende = als_dt(r["start_at"]), als_dt(r["end_at"])
            if start is None or ende is None:
                continue
            zone = ZoneInfo(self._zone_fuer(tenant_id, r.get("property_id"), regeln))
            # In ORTSZEIT verschieben, damit ein DST-Wechsel die Uhrzeit nicht kippt.
            n_start = (start.astimezone(zone) + versatz).astimezone(UTC)
            n_ende = (ende.astimezone(zone) + versatz).astimezone(UTC)
            uid = r.get("user_id") if req.mit_personen else None
            key = (str(uid or ""), n_start.isoformat(), n_ende.isoformat())
            if key in vorhanden_keys:
                uebersprungen += 1
                continue
            payload = {
                "tenant_id": tenant_id,
                "user_id": uid,
                "datum": rw.ortstag(n_start, str(zone)).isoformat(),
                "start_at": n_start.isoformat(),
                "end_at": n_ende.isoformat(),
                "pause_min": r.get("pause_min") or 0,
                "arbeitsbereich_id": r.get("arbeitsbereich_id"),
                "property_id": r.get("property_id"),
                "building_id": r.get("building_id"),
                "vorlage_id": r.get("vorlage_id"),
                "status": "entwurf",
                "quelle": "kopie",
                "notiz": r.get("notiz"),
                "erstellt_von": ctx.user_id,
            }
            row = self._db.table("personal_schichten").insert(payload).execute().data[0]
            self._protokoll(tenant_id, str(row["id"]), ctx.user_id, "angelegt", None, _kern(row))
            vorhanden_keys.add(key)
            angelegt += 1
        log.info(
            "personal_woche_kopiert",
            tenant_id=tenant_id,
            quelle=quelle.isoformat(),
            ziel=ziel.isoformat(),
            angelegt=angelegt,
            uebersprungen=uebersprungen,
        )
        return BedarfResponse(woche_start=ziel, angelegt=angelegt, vorhanden=uebersprungen)

    def veroeffentlichen(self, ctx: AuthContext, woche_start: date) -> VeroeffentlichenResponse:
        tenant_id = self._require_tenant(ctx)
        self._regeln(tenant_id)
        woche_start = _montag(woche_start)
        personen = self._personen_im_scope(ctx, tenant_id)
        rows = [
            r
            for r in self._schichten_im_zeitraum(
                tenant_id, woche_start, woche_start + timedelta(days=6)
            )
            if r.get("status") == "entwurf" and r.get("user_id") and str(r["user_id"]) in personen
        ]
        for r in rows:
            (
                self._db.table("personal_schichten")
                .update({"status": "veroeffentlicht"})
                .eq("id", str(r["id"]))
                .eq("tenant_id", tenant_id)
                .execute()
            )
            self._protokoll(
                tenant_id,
                str(r["id"]),
                ctx.user_id,
                "veroeffentlicht",
                {"status": "entwurf"},
                {"status": "veroeffentlicht"},
            )
        anzahl = len(rows)
        self._db.table("personal_veroeffentlichungen").upsert(
            {
                "tenant_id": tenant_id,
                "woche_start": woche_start.isoformat(),
                "veroeffentlicht_von": ctx.user_id,
                "veroeffentlicht_am": jetzt().isoformat(),
                "anzahl_schichten": anzahl,
            },
            on_conflict="tenant_id,woche_start",
        ).execute()
        empfaenger = {str(r["user_id"]) for r in rows}
        for uid in empfaenger:
            melde_dienstplan(
                self._db, tenant_id=tenant_id, user_id=uid, woche_start=woche_start, geaendert=False
            )
        log.info(
            "personal_woche_veroeffentlicht",
            tenant_id=tenant_id,
            woche=woche_start.isoformat(),
            schichten=anzahl,
            personen=len(empfaenger),
        )
        return VeroeffentlichenResponse(
            woche_start=woche_start, anzahl=anzahl, benachrichtigt=len(empfaenger)
        )

    def lesebestaetigung(self, ctx: AuthContext, woche_start: date) -> None:
        tenant_id = self._require_tenant(ctx)
        veroeff = self._veroeffentlichung(tenant_id, _montag(woche_start))
        if veroeff is None:
            raise PersonalError("Diese Woche ist nicht veröffentlicht.", status_code=404)
        try:
            self._db.table("personal_lesebestaetigungen").insert(
                {
                    "tenant_id": tenant_id,
                    "veroeffentlichung_id": str(veroeff["id"]),
                    "user_id": ctx.user_id,
                }
            ).execute()
        except APIError as exc:
            if getattr(exc, "code", None) != _UNIQUE_VERLETZUNG:
                raise

    def bestaetigen(self, ctx: AuthContext, schicht_id: str) -> Schicht:
        """Die EIGENE Schicht bestätigen (Mitarbeitende)."""
        tenant_id = self._require_tenant(ctx)
        row = load_scoped(
            self._db,
            "personal_schichten",
            schicht_id,
            tenant_id,
            columns=_SCHICHT_SPALTEN,
            not_found=PersonalError("Schicht nicht gefunden.", status_code=404),
        )
        if str(row.get("user_id") or "") != ctx.user_id:
            raise PersonalError("Schicht nicht gefunden.", status_code=404)
        if row.get("status") != "veroeffentlicht":
            raise PersonalError(
                "Nur veröffentlichte Schichten lassen sich bestätigen.", status_code=409
            )
        (
            self._db.table("personal_schichten")
            .update({"status": "bestaetigt", "bestaetigt_am": jetzt().isoformat()})
            .eq("id", schicht_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        self._protokoll(
            tenant_id,
            schicht_id,
            ctx.user_id,
            "bestaetigt",
            {"status": "veroeffentlicht"},
            {"status": "bestaetigt"},
        )
        return self._nachladen(ctx, tenant_id, schicht_id, [])

    # ------------------------------------------------------------------
    # Bewerbungen auf offene Schichten
    # ------------------------------------------------------------------

    def bewerben(self, ctx: AuthContext, schicht_id: str, *, zurueck: bool = False) -> Schicht:
        tenant_id = self._require_tenant(ctx)
        row = load_scoped(
            self._db,
            "personal_schichten",
            schicht_id,
            tenant_id,
            columns=_SCHICHT_SPALTEN,
            not_found=PersonalError("Schicht nicht gefunden.", status_code=404),
        )
        if row.get("user_id") or row.get("status") == "abgesagt":
            raise PersonalError("Diese Schicht ist nicht offen.", status_code=409)
        if row.get("property_id") and str(row["property_id"]) not in self._objekte_von(
            tenant_id, ctx.user_id
        ):
            raise PersonalError("Schicht nicht gefunden.", status_code=404)
        if zurueck:
            (
                self._db.table("personal_schicht_bewerbungen")
                .delete()
                .eq("schicht_id", schicht_id)
                .eq("user_id", ctx.user_id)
                .eq("status", "offen")
                .execute()
            )
        else:
            try:
                self._db.table("personal_schicht_bewerbungen").insert(
                    {
                        "tenant_id": tenant_id,
                        "schicht_id": schicht_id,
                        "user_id": ctx.user_id,
                        "status": "offen",
                    }
                ).execute()
            except APIError as exc:
                if getattr(exc, "code", None) != _UNIQUE_VERLETZUNG:
                    raise
            self._protokoll(
                tenant_id, schicht_id, ctx.user_id, "bewerbung", None, {"user_id": ctx.user_id}
            )
        return self._nachladen(ctx, tenant_id, schicht_id, [])

    def bewerbungen(self, ctx: AuthContext, schicht_id: str) -> list[PlanPerson]:
        tenant_id = self._require_tenant(ctx)
        self._own_schicht(ctx, tenant_id, schicht_id)
        rows = self._bewerbungen_fuer([schicht_id]).get(schicht_id, [])
        ids = {str(r["user_id"]) for r in rows if r.get("status") == "offen"}
        return self._plan_personen(tenant_id, ids & self._personen_im_scope(ctx, tenant_id))

    def bewerbung_entscheiden(
        self, ctx: AuthContext, schicht_id: str, req: BewerbungEntscheiden
    ) -> Schicht:
        tenant_id = self._require_tenant(ctx)
        regeln = self._regeln(tenant_id)
        row = self._own_schicht(ctx, tenant_id, schicht_id)
        if row.get("user_id"):
            raise PersonalError("Die Schicht ist schon besetzt.", status_code=409)
        self._require_person_im_scope(ctx, tenant_id, req.user_id)
        (
            self._db.table("personal_schicht_bewerbungen")
            .update(
                {
                    "status": "angenommen" if req.annehmen else "abgelehnt",
                    "entschieden_am": jetzt().isoformat(),
                    "entschieden_von": ctx.user_id,
                }
            )
            .eq("schicht_id", schicht_id)
            .eq("user_id", req.user_id)
            .execute()
        )
        self._protokoll(
            tenant_id,
            schicht_id,
            ctx.user_id,
            "bewerbung_entschieden",
            None,
            {"user_id": req.user_id, "annehmen": req.annehmen},
        )
        if not req.annehmen:
            return self._nachladen(ctx, tenant_id, schicht_id, [])
        block = self._block({**row, "user_id": req.user_id})
        konflikte = self._konflikte_live(tenant_id, block, regeln, ausser=schicht_id)
        self._konflikte_durchsetzen(konflikte, True)
        (
            self._db.table("personal_schichten")
            .update({"user_id": req.user_id, "status": "veroeffentlicht"})
            .eq("id", schicht_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        # Die übrigen offenen Bewerbungen sind damit erledigt (Gegenzustand).
        (
            self._db.table("personal_schicht_bewerbungen")
            .update(
                {
                    "status": "abgelehnt",
                    "entschieden_am": jetzt().isoformat(),
                    "entschieden_von": ctx.user_id,
                }
            )
            .eq("schicht_id", schicht_id)
            .eq("status", "offen")
            .execute()
        )
        tag = als_date(row["datum"]) or date.today()
        melde_dienstplan(
            self._db,
            tenant_id=tenant_id,
            user_id=req.user_id,
            woche_start=_montag(tag),
            geaendert=True,
        )
        return self._nachladen(ctx, tenant_id, schicht_id, konflikte)

    # ------------------------------------------------------------------
    # Bedarf aus Aufgaben (Konzept E1: „Schichthülle")
    # ------------------------------------------------------------------

    def bedarf_aus_aufgaben(self, ctx: AuthContext, woche_start: date) -> BedarfResponse:
        tenant_id = self._require_tenant(ctx)
        regeln = self._regeln(tenant_id)
        woche_start = _montag(woche_start)
        woche_ende = woche_start + timedelta(days=6)
        von_utc = datetime.combine(woche_start, time(0, 0), ZoneInfo(regeln.zeitzone)).astimezone(
            UTC
        )
        bis_utc = datetime.combine(
            woche_ende + timedelta(days=1), time(0, 0), ZoneInfo(regeln.zeitzone)
        ).astimezone(UTC)
        tasks = (
            self._db.table("tasks")
            .select("id, property_id, assignee_id, title, status, start_at, end_at, due_at")
            .eq("tenant_id", tenant_id)
            .in_("status", list(_TASK_OFFEN))
            .gte("start_at", von_utc.isoformat())
            .lt("start_at", bis_utc.isoformat())
            .execute()
        ).data or []
        objekte = None if self._ist_leitung(ctx) else self._objekte_von(tenant_id, ctx.user_id)
        vorhanden_rows = self._schichten_im_zeitraum(tenant_id, woche_start, woche_ende)
        mit_task = {str(r["task_id"]) for r in vorhanden_rows if r.get("task_id")}
        angelegt = vorhanden = 0
        for t in tasks:
            tid = str(t["id"])
            if tid in mit_task:
                vorhanden += 1
                continue
            start, ende = als_dt(t.get("start_at")), als_dt(t.get("end_at"))
            if start is None or ende is None or ende <= start:
                # Ohne Zeitfenster gibt es keinen Bedarf, den man planen könnte —
                # kein erfundenes Fenster (Wurzel 4).
                continue
            if not t.get("property_id"):
                continue
            if objekte is not None and str(t["property_id"]) not in objekte:
                continue
            if self._gedeckt(vorhanden_rows, t, start, ende):
                vorhanden += 1
                continue
            zone = self._zone_fuer(tenant_id, str(t["property_id"]), regeln)
            gebaeude = self._property_im_tenant(tenant_id, str(t["property_id"])).get("building_id")
            assignee = t.get("assignee_id")
            if assignee and str(assignee) not in self._personen_im_scope(ctx, tenant_id):
                assignee = None
            payload = {
                "tenant_id": tenant_id,
                "user_id": assignee,
                "datum": rw.ortstag(start, zone).isoformat(),
                "start_at": start.astimezone(UTC).isoformat(),
                "end_at": ende.astimezone(UTC).isoformat(),
                "pause_min": 0,
                "property_id": t["property_id"],
                "building_id": gebaeude,
                "status": "entwurf",
                "quelle": "bedarf_aufgabe",
                "task_id": tid,
                "notiz": t.get("title"),
                "erstellt_von": ctx.user_id,
            }
            try:
                row = self._db.table("personal_schichten").insert(payload).execute().data[0]
            except APIError as exc:
                if getattr(exc, "code", None) == _UNIQUE_VERLETZUNG:
                    vorhanden += 1
                    continue
                raise
            self._protokoll(tenant_id, str(row["id"]), ctx.user_id, "angelegt", None, _kern(row))
            angelegt += 1
            if not assignee:
                melde_schicht_offen(self._db, tenant_id=tenant_id, schicht=row)
        log.info(
            "personal_bedarf_aus_aufgaben",
            tenant_id=tenant_id,
            woche=woche_start.isoformat(),
            angelegt=angelegt,
            vorhanden=vorhanden,
            aufgaben=len(tasks),
        )
        return BedarfResponse(woche_start=woche_start, angelegt=angelegt, vorhanden=vorhanden)

    @staticmethod
    def _gedeckt(
        rows: list[dict[str, Any]], task: dict[str, Any], start: datetime, ende: datetime
    ) -> bool:
        """Deckt eine besetzte Schicht am Objekt das Zeitfenster der Aufgabe ab?"""
        for r in rows:
            if r.get("status") not in _AKTIV or not r.get("user_id"):
                continue
            if str(r.get("property_id") or "") != str(task.get("property_id")):
                continue
            s, e = als_dt(r["start_at"]), als_dt(r["end_at"])
            if s and e and s <= start and e >= ende:
                return True
        return False


def _kern(r: dict[str, Any]) -> dict[str, Any]:
    return {
        k: (v.isoformat() if hasattr(v, "isoformat") else v)
        for k, v in r.items()
        if k
        in (
            "user_id",
            "datum",
            "start_at",
            "end_at",
            "pause_min",
            "arbeitsbereich_id",
            "property_id",
            "status",
            "quelle",
            "notiz",
        )
    }


def _zeit_geaendert(vorher: dict[str, Any], payload: dict[str, Any]) -> bool:
    for k in ("start_at", "end_at", "user_id", "property_id"):
        a, b = vorher.get(k), payload.get(k)
        if k in ("start_at", "end_at"):
            a, b = als_dt(a), als_dt(b)
        if str(a or "") != str(b or ""):
            return True
    return False


def _t(wert: object) -> time | None:
    if isinstance(wert, time):
        return wert
    if isinstance(wert, str) and wert:
        try:
            return time.fromisoformat(wert)
        except ValueError:
            return None
    return None
