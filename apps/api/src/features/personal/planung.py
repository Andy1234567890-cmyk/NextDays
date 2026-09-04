"""Dienstplan-Ausbau (0544): freies Zeitfenster, Woche leeren, Mehrfachaktion,
Wochenvorlagen, Schichttausch, Abwesenheits-Vorschau.

Gegenzustände (Wurzel 1):
  * Woche leeren: Entwürfe werden GELÖSCHT, veröffentlichte/bestätigte Dienste
    ABGESAGT — mit Meldung an die Person, die sie schon gesehen hat.
  * Tausch freigeben: beide Schichten werden in EINEM Schritt geschrieben
    (`_tausch_schreiben`), sonst hat die eine Person zwei Dienste und die andere
    keinen. Zwischen den beiden Updates gibt es keinen Rückfragepunkt.
  * Mehrfachaktion: jede geänderte Schicht wird protokolliert wie eine einzelne.

Idempotenz (Wurzel 2):
  * Wochenvorlage anwenden: eine gleiche Schicht (Person, Zeit, Bereich) am
    Zieltag zählt als `vorhanden`, sie wird nicht verdoppelt. Zweiter Lauf =
    `angelegt: 0`.
  * Tausch anfragen: der UNIQUE-Index auf offene Anfragen je Schicht ist der
    Backstop, `409 tausch_offen` die Antwort darauf.

Scope (Wurzel 3/9): jede Schicht kommt über `_own_schicht` (Person ODER Objekt
im Scope), jeder Tausch über `_own_tausch`. Die Item-Endpunkte prüfen denselben
Scope wie die Liste.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any
from zoneinfo import ZoneInfo

from postgrest.exceptions import APIError

from src.core.security import AuthContext
from src.core.supabase import get_service_client, load_scoped

from . import regelwerk as rw
from ._base import (
    _UNIQUE_VERLETZUNG,
    LEITUNG,
    PersonalError,
    als_date,
    als_dt,
    als_time,
    jetzt,
    log,
)
from .abwesenheiten import AbwesenheitenService
from .benachrichtigungen import melde_dienstplan
from .benachrichtigungen_planung import melde_tausch
from .plan_zusatz import tausch_aus_row
from .planung_schemas import (
    MAX_VORLAGE_SCHICHTEN,
    AbwesenheitVorschau,
    AbwesenheitVorschauRequest,
    KollegeAbwesend,
    LeerenResponse,
    MehrfachKonflikt,
    MehrfachRequest,
    MehrfachResponse,
    SperreHinweis,
    TauschCreate,
    TauschEntscheiden,
    Wochenvorlage,
    WochenvorlageAnwenden,
    WochenvorlageCreate,
    WochenvorlageDetail,
    WochenvorlageSchicht,
    WochenvorlageUpdate,
)
from .schemas import BedarfResponse, Tausch
from .schichten import SchichtenService

_TAUSCH_SPALTEN = (
    "id, tenant_id, schicht_id, von_user_id, an_user_id, gegen_schicht_id, status, "
    "grund, kommentar, angenommen_am, entschieden_von, entschieden_am, erstellt_von, created_at"
)
_TAUSCH_OFFEN = ("angefragt", "angenommen")
_VEROEFFENTLICHT = ("veroeffentlicht", "bestaetigt")
_AKTIV = ("entwurf", "veroeffentlicht", "bestaetigt")


def _montag(tag: date) -> date:
    return tag - timedelta(days=tag.weekday())


class PlanungService(SchichtenService):
    """Erbt vom Dienstplan: derselbe Scope, dieselbe Konfliktprüfung.

    Erben statt kopieren, weil jede Aktion hier eine Schicht schreibt und
    dafür genau die Prüfungen braucht, die `SchichtenService` schon hat
    (`_own_schicht`, `_konflikte_live`, `_konflikte_durchsetzen`, `_protokoll`).
    Eine zweite Kopie dieser Kette wäre die Wurzel, aus der die Konflikte
    auseinanderlaufen.
    """

    # ------------------------------------------------------------------
    # Woche leeren
    # ------------------------------------------------------------------

    def leeren(
        self, ctx: AuthContext, woche: date, *, arbeitsbereich_id: str | None = None
    ) -> LeerenResponse:
        """Entwürfe löschen, Veröffentlichtes absagen (Gegenzustand, Wurzel 1)."""
        tenant_id = self._require_tenant(ctx)
        self._regeln(tenant_id)
        woche_start = _montag(woche)
        woche_ende = woche_start + timedelta(days=6)
        personen = self._personen_im_scope(ctx, tenant_id)
        rows = [
            r
            for r in self._schichten_im_zeitraum(tenant_id, woche_start, woche_ende)
            if r.get("status") in _AKTIV
            and (not r.get("user_id") or str(r["user_id"]) in personen)
            and (
                arbeitsbereich_id is None
                or str(r.get("arbeitsbereich_id") or "") == arbeitsbereich_id
            )
        ]
        geloescht = abgesagt = 0
        wochen: set[tuple[str, date]] = set()
        for r in rows:
            sid = str(r["id"])
            if r.get("status") in _VEROEFFENTLICHT:
                (
                    self._db.table("personal_schichten")
                    .update({"status": "abgesagt"})
                    .eq("id", sid)
                    .eq("tenant_id", tenant_id)
                    .execute()
                )
                self._protokoll(
                    tenant_id, sid, ctx.user_id, "abgesagt", {"status": r.get("status")}, None
                )
                abgesagt += 1
                if r.get("user_id"):
                    wochen.add((str(r["user_id"]), woche_start))
            else:
                self._protokoll(tenant_id, sid, ctx.user_id, "geloescht", _kern(r), None)
                (
                    self._db.table("personal_schichten")
                    .delete()
                    .eq("id", sid)
                    .eq("tenant_id", tenant_id)
                    .execute()
                )
                geloescht += 1
        for uid, w in sorted(wochen):
            melde_dienstplan(
                self._db, tenant_id=tenant_id, user_id=uid, woche_start=w, geaendert=True
            )
        log.info(
            "personal_woche_geleert",
            tenant_id=tenant_id,
            woche=woche_start.isoformat(),
            geloescht=geloescht,
            abgesagt=abgesagt,
            arbeitsbereich_id=arbeitsbereich_id,
        )
        return LeerenResponse(geloescht=geloescht, abgesagt=abgesagt)

    # ------------------------------------------------------------------
    # Mehrfachaktion
    # ------------------------------------------------------------------

    def mehrfach(self, ctx: AuthContext, req: MehrfachRequest) -> MehrfachResponse:
        """Eine Aktion auf mehrere Schichten — Konfliktsemantik wie einzeln.

        Erst wird ALLES geprüft, dann geschrieben: eine Auswahl, von der die
        Hälfte durchgeht und die andere an einem 409 hängt, wäre für die
        Planung nicht nachvollziehbar. Warnungen sammeln sich in `konflikte`
        und führen zu 409, Fehler zu 422 — beides mit derselben Liste.
        """
        tenant_id = self._require_tenant(ctx)
        regeln = self._regeln(tenant_id)
        if req.aktion == "zuweisen" and req.user_id:
            self._require_person_im_scope(ctx, tenant_id, req.user_id)
            self._require_planbar(tenant_id, req.user_id)
        rows = [self._own_schicht(ctx, tenant_id, sid) for sid in req.ids]
        for r in rows:
            if r.get("status") == "abgesagt":
                raise PersonalError(
                    "Eine abgesagte Schicht wird nicht mehr geändert.",
                    status_code=409,
                    details={"code": "abgesagt", "schicht_id": str(r["id"])},
                )
        if req.aktion == "loeschen":
            return self._mehrfach_loeschen(ctx, tenant_id, rows)
        if req.aktion == "freigeben":
            return self._mehrfach_freigeben(ctx, tenant_id, rows)
        return self._mehrfach_umplanen(ctx, tenant_id, rows, req, regeln)

    def _mehrfach_loeschen(
        self, ctx: AuthContext, tenant_id: str, rows: list[dict[str, Any]]
    ) -> MehrfachResponse:
        wochen: set[tuple[str, date]] = set()
        for r in rows:
            sid = str(r["id"])
            tag = als_date(r["datum"]) or date.today()
            if r.get("status") in _VEROEFFENTLICHT:
                (
                    self._db.table("personal_schichten")
                    .update({"status": "abgesagt"})
                    .eq("id", sid)
                    .eq("tenant_id", tenant_id)
                    .execute()
                )
                self._protokoll(
                    tenant_id, sid, ctx.user_id, "abgesagt", {"status": r.get("status")}, None
                )
                if r.get("user_id"):
                    wochen.add((str(r["user_id"]), _montag(tag)))
            else:
                self._protokoll(tenant_id, sid, ctx.user_id, "geloescht", _kern(r), None)
                (
                    self._db.table("personal_schichten")
                    .delete()
                    .eq("id", sid)
                    .eq("tenant_id", tenant_id)
                    .execute()
                )
        self._melde_wochen(tenant_id, wochen)
        return MehrfachResponse(geaendert=len(rows))

    def _mehrfach_freigeben(
        self, ctx: AuthContext, tenant_id: str, rows: list[dict[str, Any]]
    ) -> MehrfachResponse:
        """Entwürfe veröffentlichen; Schichten ohne Person bleiben Entwurf."""
        wochen: set[tuple[str, date]] = set()
        n = 0
        for r in rows:
            if r.get("status") != "entwurf" or not r.get("user_id"):
                continue
            sid = str(r["id"])
            (
                self._db.table("personal_schichten")
                .update({"status": "veroeffentlicht"})
                .eq("id", sid)
                .eq("tenant_id", tenant_id)
                .execute()
            )
            self._protokoll(
                tenant_id,
                sid,
                ctx.user_id,
                "veroeffentlicht",
                {"status": "entwurf"},
                {"status": "veroeffentlicht"},
            )
            tag = als_date(r["datum"]) or date.today()
            wochen.add((str(r["user_id"]), _montag(tag)))
            n += 1
        for uid, w in sorted(wochen):
            melde_dienstplan(
                self._db, tenant_id=tenant_id, user_id=uid, woche_start=w, geaendert=False
            )
        return MehrfachResponse(geaendert=n)

    def _mehrfach_umplanen(  # noqa: PLR0913 — Bestand, Auftrag und Regeln
        self,
        ctx: AuthContext,
        tenant_id: str,
        rows: list[dict[str, Any]],
        req: MehrfachRequest,
        regeln: rw.Regeln,
    ) -> MehrfachResponse:
        """Verschieben oder zuweisen — beides ändert Zeit bzw. Person."""
        geplant: list[tuple[dict[str, Any], dict[str, Any], list[rw.Konflikt]]] = []
        gesammelt: list[MehrfachKonflikt] = []
        fehler = False
        for r in rows:
            payload, block = self._umplanung(tenant_id, r, req, regeln)
            konflikte = (
                self._konflikte_live(tenant_id, block, regeln, ausser=str(r["id"]))
                if block.user_id
                else []
            )
            if konflikte:
                gesammelt.append(
                    MehrfachKonflikt(
                        schicht_id=str(r["id"]),
                        konflikte=[
                            {"art": k.art, "schwere": k.schwere, "werte": k.werte}
                            for k in konflikte
                        ],
                    )
                )
                fehler = fehler or rw.hat_fehler(konflikte)
            geplant.append((r, payload, konflikte))
        if fehler:
            raise PersonalError(
                "Mindestens eine Schicht verletzt eine Regel.",
                status_code=422,
                details={"konflikte": [k.model_dump() for k in gesammelt]},
            )
        if gesammelt and not req.warnungen_akzeptieren:
            raise PersonalError(
                "Es gibt Hinweise — bitte bestätigen.",
                status_code=409,
                details={"konflikte": [k.model_dump() for k in gesammelt]},
            )
        wochen: set[tuple[str, date]] = set()
        for r, payload, _k in geplant:
            sid = str(r["id"])
            (
                self._db.table("personal_schichten")
                .update(payload)
                .eq("id", sid)
                .eq("tenant_id", tenant_id)
                .execute()
            )
            art = "zugewiesen" if req.aktion == "zuweisen" else "geaendert"
            self._protokoll(
                tenant_id, sid, ctx.user_id, art, _kern(r), {**_kern(r), **payload}
            )
            if r.get("status") in _VEROEFFENTLICHT:
                tag = als_date(payload.get("datum")) or als_date(r["datum"]) or date.today()
                for uid in {str(r.get("user_id") or ""), str(payload.get("user_id") or "")} - {""}:
                    wochen.add((uid, _montag(tag)))
        self._melde_wochen(tenant_id, wochen)
        log.info(
            "personal_schichten_mehrfach",
            tenant_id=tenant_id,
            aktion=req.aktion,
            anzahl=len(geplant),
            warnungen=len(gesammelt),
        )
        return MehrfachResponse(geaendert=len(geplant), konflikte=gesammelt)

    def _umplanung(
        self,
        tenant_id: str,
        r: dict[str, Any],
        req: MehrfachRequest,
        regeln: rw.Regeln,
    ) -> tuple[dict[str, Any], rw.Zeitblock]:
        start, ende = als_dt(r["start_at"]), als_dt(r["end_at"])
        if start is None or ende is None:
            raise PersonalError("Schicht ohne Zeiten.", status_code=500)
        zone = ZoneInfo(self._zone_fuer(tenant_id, r.get("property_id"), regeln))
        user_id = req.user_id if req.aktion == "zuweisen" else r.get("user_id")
        if req.aktion == "verschieben" and req.tage:
            versatz = timedelta(days=req.tage)
            # In ORTSZEIT verschieben, damit ein DST-Wechsel die Uhrzeit hält.
            start = (start.astimezone(zone) + versatz).astimezone(UTC)
            ende = (ende.astimezone(zone) + versatz).astimezone(UTC)
        payload: dict[str, Any] = {
            "user_id": user_id,
            "datum": rw.ortstag(start, str(zone)).isoformat(),
            "start_at": start.isoformat(),
            "end_at": ende.isoformat(),
        }
        # Ein bestätigter Dienst, dessen Zeit oder Person sich ändert, geht auf
        # „veröffentlicht" zurück — die Person muss die Änderung neu sehen.
        if r.get("status") == "bestaetigt":
            payload["status"] = "veroeffentlicht"
            payload["bestaetigt_am"] = None
        block = rw.Zeitblock(
            id=str(r["id"]),
            user_id=str(user_id) if user_id else None,
            start_at=start,
            end_at=ende,
            pause_min=int(r.get("pause_min") or 0),
            property_id=r.get("property_id"),
            arbeitsbereich_id=r.get("arbeitsbereich_id"),
        )
        return payload, block

    def _melde_wochen(self, tenant_id: str, wochen: set[tuple[str, date]]) -> None:
        for uid, w in sorted(wochen):
            melde_dienstplan(
                self._db, tenant_id=tenant_id, user_id=uid, woche_start=w, geaendert=True
            )

    # ------------------------------------------------------------------
    # Wochenvorlagen
    # ------------------------------------------------------------------

    def vorlagen(self, ctx: AuthContext) -> list[Wochenvorlage]:
        tenant_id = self._require_tenant(ctx)
        rows = (
            self._db.table("personal_wochenvorlagen")
            .select("id, name, notiz, created_at")
            .eq("tenant_id", tenant_id)
            .order("name")
            .execute()
        ).data or []
        anzahl = self._vorlage_anzahl(tenant_id, [str(r["id"]) for r in rows])
        return [
            Wochenvorlage(
                id=str(r["id"]),
                name=str(r["name"]),
                notiz=r.get("notiz"),
                anzahl_schichten=anzahl.get(str(r["id"]), 0),
                created_at=str(r.get("created_at") or "") or None,
            )
            for r in rows
        ]

    def _vorlage_anzahl(self, tenant_id: str, ids: list[str]) -> dict[str, int]:
        if not ids:
            return {}
        rows = (
            self._db.table("personal_wochenvorlage_schichten")
            .select("vorlage_id")
            .eq("tenant_id", tenant_id)
            .in_("vorlage_id", ids)
            .execute()
        ).data or []
        aus: dict[str, int] = {}
        for r in rows:
            key = str(r["vorlage_id"])
            aus[key] = aus.get(key, 0) + 1
        return aus

    def vorlage(self, ctx: AuthContext, vorlage_id: str) -> WochenvorlageDetail:
        tenant_id = self._require_tenant(ctx)
        kopf = self._own_vorlage(tenant_id, vorlage_id)
        rows = (
            self._db.table("personal_wochenvorlage_schichten")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("vorlage_id", vorlage_id)
            .execute()
        ).data or []
        schichten = sorted(
            (self._vorlage_schicht(r) for r in rows),
            key=lambda s: (s.wochentag, s.start_zeit, s.user_id or ""),
        )
        return WochenvorlageDetail(
            id=str(kopf["id"]),
            name=str(kopf["name"]),
            notiz=kopf.get("notiz"),
            anzahl_schichten=len(schichten),
            created_at=str(kopf.get("created_at") or "") or None,
            schichten=schichten,
        )

    @staticmethod
    def _vorlage_schicht(r: dict[str, Any]) -> WochenvorlageSchicht:
        start, ende = als_time(r["start_zeit"]), als_time(r["end_zeit"])
        if start is None or ende is None:
            raise PersonalError("Vorlagen-Schicht ohne Zeiten.", status_code=500)
        return WochenvorlageSchicht(
            id=str(r["id"]),
            wochentag=int(r["wochentag"]),
            start_zeit=start,
            end_zeit=ende,
            pause_min=int(r.get("pause_min") or 0),
            arbeitsbereich_id=r.get("arbeitsbereich_id"),
            property_id=r.get("property_id"),
            user_id=r.get("user_id"),
            schichtvorlage_id=r.get("schichtvorlage_id"),
            notiz=r.get("notiz"),
        )

    def _own_vorlage(self, tenant_id: str, vorlage_id: str) -> dict[str, Any]:
        return load_scoped(
            self._db,
            "personal_wochenvorlagen",
            vorlage_id,
            tenant_id,
            columns="id, name, notiz, created_at",
            not_found=PersonalError("Wochenvorlage nicht gefunden.", status_code=404),
        )

    def vorlage_anlegen(self, ctx: AuthContext, req: WochenvorlageCreate) -> WochenvorlageDetail:
        """Das Gerüst einer Woche festhalten — ohne abgesagte Dienste."""
        tenant_id = self._require_tenant(ctx)
        regeln = self._regeln(tenant_id)
        woche_start = _montag(req.aus_woche)
        personen = self._personen_im_scope(ctx, tenant_id)
        quelle = [
            r
            for r in self._schichten_im_zeitraum(
                tenant_id, woche_start, woche_start + timedelta(days=6)
            )
            if r.get("status") in _AKTIV
            and (not r.get("user_id") or str(r["user_id"]) in personen)
        ]
        if len(quelle) > MAX_VORLAGE_SCHICHTEN:
            raise PersonalError(
                f"Diese Woche hat mehr als {MAX_VORLAGE_SCHICHTEN} Schichten.",
                status_code=422,
                details={"code": "zu_viele_schichten", "anzahl": len(quelle)},
            )
        try:
            kopf = (
                self._db.table("personal_wochenvorlagen")
                .insert(
                    {
                        "tenant_id": tenant_id,
                        "name": req.name,
                        "notiz": req.notiz,
                        "erstellt_von": ctx.user_id,
                    }
                )
                .execute()
                .data[0]
            )
        except APIError as exc:
            if getattr(exc, "code", None) == _UNIQUE_VERLETZUNG:
                raise PersonalError(
                    "Eine Wochenvorlage mit diesem Namen gibt es schon.",
                    status_code=409,
                    details={"code": "name_vergeben"},
                ) from exc
            raise
        zeilen = [
            self._vorlage_zeile(tenant_id, str(kopf["id"]), r, regeln, req.mit_personen)
            for r in quelle
        ]
        zeilen = [z for z in zeilen if z is not None]
        if zeilen:
            self._db.table("personal_wochenvorlage_schichten").insert(zeilen).execute()
        log.info(
            "personal_wochenvorlage_angelegt",
            tenant_id=tenant_id,
            vorlage_id=kopf["id"],
            schichten=len(zeilen),
        )
        return self.vorlage(ctx, str(kopf["id"]))

    def _vorlage_zeile(  # noqa: PLR0913 — eine Zeile mit allen Bezügen
        self,
        tenant_id: str,
        vorlage_id: str,
        r: dict[str, Any],
        regeln: rw.Regeln,
        mit_personen: bool,
    ) -> dict[str, Any] | None:
        start, ende = als_dt(r["start_at"]), als_dt(r["end_at"])
        if start is None or ende is None:
            return None
        zone = ZoneInfo(self._zone_fuer(tenant_id, r.get("property_id"), regeln))
        lokal_start, lokal_ende = start.astimezone(zone), ende.astimezone(zone)
        return {
            "tenant_id": tenant_id,
            "vorlage_id": vorlage_id,
            "wochentag": lokal_start.weekday(),
            "start_zeit": lokal_start.time().isoformat(),
            "end_zeit": lokal_ende.time().isoformat(),
            "pause_min": int(r.get("pause_min") or 0),
            "arbeitsbereich_id": r.get("arbeitsbereich_id"),
            "property_id": r.get("property_id"),
            "user_id": r.get("user_id") if mit_personen else None,
            "schichtvorlage_id": r.get("vorlage_id"),
            "notiz": r.get("notiz"),
        }

    def vorlage_aendern(
        self, ctx: AuthContext, vorlage_id: str, req: WochenvorlageUpdate
    ) -> WochenvorlageDetail:
        tenant_id = self._require_tenant(ctx)
        self._own_vorlage(tenant_id, vorlage_id)
        payload = req.model_dump(exclude_unset=True)
        if payload:
            (
                self._db.table("personal_wochenvorlagen")
                .update(payload)
                .eq("id", vorlage_id)
                .eq("tenant_id", tenant_id)
                .execute()
            )
        return self.vorlage(ctx, vorlage_id)

    def vorlage_loeschen(self, ctx: AuthContext, vorlage_id: str) -> None:
        tenant_id = self._require_tenant(ctx)
        self._own_vorlage(tenant_id, vorlage_id)
        # Die Zeilen hängen per FK-Cascade an der Vorlage (0544).
        (
            self._db.table("personal_wochenvorlagen")
            .delete()
            .eq("id", vorlage_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )

    def vorlage_anwenden(
        self, ctx: AuthContext, vorlage_id: str, woche: date, req: WochenvorlageAnwenden
    ) -> BedarfResponse:
        """Das Gerüst auf eine Woche legen — idempotent (Wurzel 2).

        Eine Schicht derselben Person zur selben Zeit im selben Bereich zählt
        als `vorhanden`; der zweite Lauf legt deshalb nichts mehr an.
        """
        tenant_id = self._require_tenant(ctx)
        regeln = self._regeln(tenant_id)
        self._own_vorlage(tenant_id, vorlage_id)
        woche_start = _montag(woche)
        zeilen = (
            self._db.table("personal_wochenvorlage_schichten")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("vorlage_id", vorlage_id)
            .execute()
        ).data or []
        personen = self._personen_im_scope(ctx, tenant_id)
        bestand = self._schichten_im_zeitraum(
            tenant_id, woche_start, woche_start + timedelta(days=6)
        )
        vorhanden_keys = {
            (
                str(r.get("user_id") or ""),
                str(als_dt(r["start_at"]) or ""),
                str(als_dt(r["end_at"]) or ""),
                str(r.get("arbeitsbereich_id") or ""),
            )
            for r in bestand
            if r.get("status") in _AKTIV
        }
        angelegt = vorhanden = 0
        for z in sorted(zeilen, key=lambda r: (int(r["wochentag"]), str(r["start_zeit"]))):
            payload = self._aus_vorlage(
                tenant_id, z, woche_start, regeln, ctx, mit_personen=req.mit_personen
            )
            if payload is None:
                continue
            uid = payload.get("user_id")
            if uid and str(uid) not in personen:
                # Eine Person außerhalb des Scope wird als OFFENE Schicht
                # angelegt, nicht heimlich eingeplant (Wurzel 3).
                payload["user_id"] = None
                uid = None
            key = (
                str(uid or ""),
                str(als_dt(payload["start_at"]) or ""),
                str(als_dt(payload["end_at"]) or ""),
                str(payload.get("arbeitsbereich_id") or ""),
            )
            if key in vorhanden_keys:
                vorhanden += 1
                continue
            row = self._db.table("personal_schichten").insert(payload).execute().data[0]
            self._protokoll(tenant_id, str(row["id"]), ctx.user_id, "angelegt", None, _kern(row))
            vorhanden_keys.add(key)
            angelegt += 1
        log.info(
            "personal_wochenvorlage_angewendet",
            tenant_id=tenant_id,
            vorlage_id=vorlage_id,
            woche=woche_start.isoformat(),
            angelegt=angelegt,
            vorhanden=vorhanden,
        )
        return BedarfResponse(woche_start=woche_start, angelegt=angelegt, vorhanden=vorhanden)

    def _aus_vorlage(  # noqa: PLR0913 — Zeile, Ziel und Kontext
        self,
        tenant_id: str,
        z: dict[str, Any],
        woche_start: date,
        regeln: rw.Regeln,
        ctx: AuthContext,
        *,
        mit_personen: bool,
    ) -> dict[str, Any] | None:
        start_zeit, end_zeit = als_time(z["start_zeit"]), als_time(z["end_zeit"])
        if start_zeit is None or end_zeit is None:
            return None
        zone = ZoneInfo(self._zone_fuer(tenant_id, z.get("property_id"), regeln))
        tag = woche_start + timedelta(days=int(z["wochentag"]))
        start = datetime.combine(tag, start_zeit, zone)
        ende = datetime.combine(tag, end_zeit, zone)
        if ende <= start:
            # Nachtschicht: das Ende liegt am Folgetag.
            ende += timedelta(days=1)
        return {
            "tenant_id": tenant_id,
            "user_id": z.get("user_id") if mit_personen else None,
            "datum": tag.isoformat(),
            "start_at": start.astimezone(UTC).isoformat(),
            "end_at": ende.astimezone(UTC).isoformat(),
            "pause_min": int(z.get("pause_min") or 0),
            "arbeitsbereich_id": z.get("arbeitsbereich_id"),
            "property_id": z.get("property_id"),
            "vorlage_id": z.get("schichtvorlage_id"),
            "status": "entwurf",
            "quelle": "wochenvorlage",
            "notiz": z.get("notiz"),
            "erstellt_von": ctx.user_id,
        }

    # ------------------------------------------------------------------
    # Schichttausch
    # ------------------------------------------------------------------

    def tausch_liste(
        self, ctx: AuthContext, *, woche: date | None = None, status: str | None = None
    ) -> list[Tausch]:
        """Offene Tausche im Scope; `Own` sieht die eigenen als Geber ODER Nehmer."""
        tenant_id = self._require_tenant(ctx)
        personen = self._personen_im_scope(ctx, tenant_id)
        q = self._db.table("personal_schicht_tausch").select(_TAUSCH_SPALTEN).eq(
            "tenant_id", tenant_id
        )
        if status:
            q = q.eq("status", status)
        rows = q.execute().data or []
        im_scope = [
            r
            for r in rows
            if str(r["von_user_id"]) in personen or str(r["an_user_id"]) in personen
        ]
        if not status:
            im_scope = [r for r in im_scope if r.get("status") in _TAUSCH_OFFEN]
        schichten = self._tausch_schichten(tenant_id, im_scope)
        if woche is not None:
            woche_start = _montag(woche)
            woche_ende = woche_start + timedelta(days=6)
            im_scope = [
                r
                for r in im_scope
                if (tag := als_date((schichten.get(str(r["schicht_id"])) or {}).get("datum")))
                is not None
                and woche_start <= tag <= woche_ende
            ]
        namen = self._namen(tenant_id, im_scope)
        titel = self._property_titel(
            tenant_id,
            {
                str(s["property_id"])
                for s in schichten.values()
                if s.get("property_id")
            },
        )
        return sorted(
            (tausch_aus_row(r, schichten, namen, titel) for r in im_scope),
            key=lambda t: (t.created_at or datetime.min.replace(tzinfo=UTC), t.id),
            reverse=True,
        )

    def _tausch_schichten(
        self, tenant_id: str, rows: list[dict[str, Any]]
    ) -> dict[str, dict[str, Any]]:
        ids = {str(r["schicht_id"]) for r in rows} | {
            str(r["gegen_schicht_id"]) for r in rows if r.get("gegen_schicht_id")
        }
        if not ids:
            return {}
        gefunden = (
            self._db.table("personal_schichten")
            .select(
                "id, user_id, datum, start_at, end_at, pause_min, arbeitsbereich_id, "
                "property_id, status"
            )
            .eq("tenant_id", tenant_id)
            .in_("id", sorted(ids))
            .execute()
        ).data or []
        return {str(r["id"]): r for r in gefunden}

    def _namen(self, tenant_id: str, rows: list[dict[str, Any]]) -> dict[str, str | None]:
        ids = {str(r["von_user_id"]) for r in rows} | {str(r["an_user_id"]) for r in rows}
        return {str(u["id"]): u.get("full_name") for u in self._users(tenant_id, ids)}

    # `_tausch` gibt es hier nicht mehr als eigene Umwandlung: sie stand
    # doppelt (hier und in `plan_zusatz.tausch_aus_row`) und lief beim ersten
    # neuen Feld auseinander — `gegen_schicht` fehlte in dieser Kopie, obwohl
    # die Gegenschicht längst geladen wurde. Beide Wege nutzen jetzt
    # `tausch_aus_row`.

    def tausch_anfragen(self, ctx: AuthContext, schicht_id: str, req: TauschCreate) -> Tausch:
        """Die eigene Schicht anbieten (Own) oder eine fremde vermitteln (Plan)."""
        tenant_id = self._require_tenant(ctx)
        row = self._own_schicht(ctx, tenant_id, schicht_id)
        von_user = str(row.get("user_id") or "")
        if not von_user:
            raise PersonalError(
                "Eine offene Schicht wird nicht getauscht, sondern besetzt.",
                status_code=422,
                details={"code": "schicht_offen"},
            )
        if row.get("status") not in _VEROEFFENTLICHT:
            raise PersonalError(
                "Nur veröffentlichte Schichten lassen sich tauschen.",
                status_code=409,
                details={"code": "nicht_veroeffentlicht"},
            )
        if von_user != ctx.user_id and not self._darf_planen(ctx, tenant_id):
            # Own darf NUR die eigene Schicht anbieten (Wurzel 9).
            raise PersonalError("Schicht nicht gefunden.", status_code=404)
        if req.an_user_id == von_user:
            raise PersonalError(
                "Ein Tausch braucht zwei Personen.",
                status_code=422,
                details={"code": "gleiche_person"},
            )
        self._require_person_im_scope(ctx, tenant_id, req.an_user_id)
        self._require_planbar(tenant_id, req.an_user_id)
        self._require_qualifiziert(tenant_id, req.an_user_id, row)
        gegen = self._gegen_schicht(ctx, tenant_id, req.gegen_schicht_id, req.an_user_id)
        try:
            neu = (
                self._db.table("personal_schicht_tausch")
                .insert(
                    {
                        "tenant_id": tenant_id,
                        "schicht_id": schicht_id,
                        "von_user_id": von_user,
                        "an_user_id": req.an_user_id,
                        "gegen_schicht_id": gegen,
                        "status": "angefragt",
                        "grund": req.grund,
                        "erstellt_von": ctx.user_id,
                    }
                )
                .execute()
                .data[0]
            )
        except APIError as exc:
            if getattr(exc, "code", None) == _UNIQUE_VERLETZUNG:
                raise PersonalError(
                    "Für diese Schicht läuft schon eine Tauschanfrage.",
                    status_code=409,
                    details={"code": "tausch_offen"},
                ) from exc
            raise
        self._protokoll(
            tenant_id,
            schicht_id,
            ctx.user_id,
            "tausch_angefragt",
            None,
            {"an_user_id": req.an_user_id, "tausch_id": str(neu["id"])},
        )
        melde_tausch(
            self._db,
            tenant_id=tenant_id,
            tausch=neu,
            schicht=row,
            ereignis="anfrage",
            empfaenger={req.an_user_id},
            woche_start=self._woche_von(row),
        )
        log.info(
            "personal_tausch_angefragt",
            tenant_id=tenant_id,
            tausch_id=neu["id"],
            schicht_id=schicht_id,
        )
        return self._tausch_nachladen(ctx, tenant_id, str(neu["id"]))

    def _darf_planen(self, ctx: AuthContext, tenant_id: str) -> bool:
        """Rolle FRISCH aus der DB (Wurzel 7) — nicht aus dem JWT."""
        return (self._rolle_aus_db(ctx, tenant_id) or "") in LEITUNG

    def _require_qualifiziert(
        self, tenant_id: str, user_id: str, schicht: dict[str, Any]
    ) -> None:
        """Ziel muss den Bereich der Schicht können — sonst 422 `qualifikation`."""
        bereich = schicht.get("arbeitsbereich_id")
        if not bereich:
            return
        block = rw.Zeitblock(
            id=str(schicht["id"]),
            user_id=user_id,
            start_at=als_dt(schicht["start_at"]) or jetzt(),
            end_at=als_dt(schicht["end_at"]) or jetzt(),
            property_id=schicht.get("property_id"),
            arbeitsbereich_id=str(bereich),
        )
        if not self._qualifiziert(tenant_id, block):
            raise PersonalError(
                "Diese Person ist für den Arbeitsbereich der Schicht nicht qualifiziert.",
                status_code=422,
                details={"code": "qualifikation"},
            )

    def _gegen_schicht(
        self, ctx: AuthContext, tenant_id: str, gegen_id: str | None, an_user_id: str
    ) -> str | None:
        """Die Gegen-Schicht muss der annehmenden Person gehören."""
        if not gegen_id:
            return None
        gegen = self._own_schicht(ctx, tenant_id, gegen_id)
        if str(gegen.get("user_id") or "") != an_user_id:
            raise PersonalError(
                "Die Gegen-Schicht gehört nicht der angefragten Person.",
                status_code=422,
                details={"code": "gegen_schicht_fremd"},
            )
        if gegen.get("status") not in _VEROEFFENTLICHT:
            raise PersonalError(
                "Die Gegen-Schicht ist nicht veröffentlicht.",
                status_code=409,
                details={"code": "nicht_veroeffentlicht"},
            )
        return gegen_id

    def _own_tausch(self, ctx: AuthContext, tenant_id: str, tausch_id: str) -> dict[str, Any]:
        """Tausch laden UND Scope prüfen (Wurzel 9: wie die Liste filtert)."""
        row = load_scoped(
            self._db,
            "personal_schicht_tausch",
            tausch_id,
            tenant_id,
            columns=_TAUSCH_SPALTEN,
            not_found=PersonalError("Tausch nicht gefunden.", status_code=404),
        )
        personen = self._personen_im_scope(ctx, tenant_id)
        if str(row["von_user_id"]) not in personen and str(row["an_user_id"]) not in personen:
            raise PersonalError("Tausch nicht gefunden.", status_code=404)
        return row

    def _tausch_nachladen(self, ctx: AuthContext, tenant_id: str, tausch_id: str) -> Tausch:
        row = self._own_tausch(ctx, tenant_id, tausch_id)
        schichten = self._tausch_schichten(tenant_id, [row])
        titel = self._property_titel(
            tenant_id,
            {str(s["property_id"]) for s in schichten.values() if s.get("property_id")},
        )
        return tausch_aus_row(row, schichten, self._namen(tenant_id, [row]), titel)

    def tausch_annehmen(self, ctx: AuthContext, tausch_id: str) -> Tausch:
        return self._tausch_antwort(ctx, tausch_id, annehmen=True)

    def tausch_ablehnen(self, ctx: AuthContext, tausch_id: str) -> Tausch:
        return self._tausch_antwort(ctx, tausch_id, annehmen=False)

    def _tausch_antwort(self, ctx: AuthContext, tausch_id: str, *, annehmen: bool) -> Tausch:
        """Nur die ANGEFRAGTE Person antwortet — auch die Leitung nicht für sie."""
        tenant_id = self._require_tenant(ctx)
        row = self._own_tausch(ctx, tenant_id, tausch_id)
        if str(row["an_user_id"]) != ctx.user_id:
            raise PersonalError(
                "Diese Anfrage entscheidet die angefragte Person.",
                status_code=403,
                details={"code": "nicht_angefragt"},
            )
        if row.get("status") != "angefragt":
            raise PersonalError(
                "Diese Anfrage ist nicht mehr offen.",
                status_code=409,
                details={"code": "nicht_offen"},
            )
        payload: dict[str, Any] = {"status": "angenommen" if annehmen else "abgelehnt"}
        if annehmen:
            payload["angenommen_am"] = jetzt().isoformat()
        (
            self._db.table("personal_schicht_tausch")
            .update(payload)
            .eq("id", tausch_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        schicht = self._tausch_schichten(tenant_id, [row]).get(str(row["schicht_id"])) or {}
        self._protokoll(
            tenant_id,
            str(row["schicht_id"]),
            ctx.user_id,
            "tausch_angenommen" if annehmen else "tausch_abgelehnt",
            {"status": "angefragt"},
            payload,
        )
        if annehmen:
            # Die Leitung muss freigeben — sie erfährt es jetzt.
            melde_tausch(
                self._db,
                tenant_id=tenant_id,
                tausch={**row, **payload},
                schicht=schicht,
                ereignis="angenommen",
                empfaenger=self._planende(tenant_id),
                woche_start=self._woche_von(schicht),
            )
        else:
            melde_tausch(
                self._db,
                tenant_id=tenant_id,
                tausch={**row, **payload},
                schicht=schicht,
                ereignis="verworfen",
                empfaenger={str(row["von_user_id"]), str(row["an_user_id"])},
                woche_start=self._woche_von(schicht),
            )
        return self._tausch_nachladen(ctx, tenant_id, tausch_id)

    def tausch_zurueckziehen(self, ctx: AuthContext, tausch_id: str) -> Tausch:
        """Die GEBENDE Person nimmt ihr Angebot zurück, solange nicht freigegeben."""
        tenant_id = self._require_tenant(ctx)
        row = self._own_tausch(ctx, tenant_id, tausch_id)
        if str(row["von_user_id"]) != ctx.user_id:
            raise PersonalError(
                "Zurückziehen kann nur, wer die Schicht angeboten hat.",
                status_code=403,
                details={"code": "nicht_geber"},
            )
        if row.get("status") not in _TAUSCH_OFFEN:
            raise PersonalError(
                "Diese Anfrage ist nicht mehr offen.",
                status_code=409,
                details={"code": "nicht_offen"},
            )
        (
            self._db.table("personal_schicht_tausch")
            .update({"status": "verworfen"})
            .eq("id", tausch_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        schicht = self._tausch_schichten(tenant_id, [row]).get(str(row["schicht_id"])) or {}
        self._protokoll(
            tenant_id,
            str(row["schicht_id"]),
            ctx.user_id,
            "tausch_zurueckgezogen",
            {"status": row.get("status")},
            {"status": "verworfen"},
        )
        melde_tausch(
            self._db,
            tenant_id=tenant_id,
            tausch=row,
            schicht=schicht,
            ereignis="verworfen",
            empfaenger={str(row["an_user_id"])},
            woche_start=self._woche_von(schicht),
        )
        return self._tausch_nachladen(ctx, tenant_id, tausch_id)

    def tausch_entscheiden(
        self, ctx: AuthContext, tausch_id: str, req: TauschEntscheiden
    ) -> Tausch:
        """Freigabe der Planung: erst prüfen, dann BEIDE Schichten schreiben."""
        tenant_id = self._require_tenant(ctx)
        regeln = self._regeln(tenant_id)
        row = self._own_tausch(ctx, tenant_id, tausch_id)
        if row.get("status") != "angenommen":
            raise PersonalError(
                "Freigegeben wird ein angenommener Tausch.",
                status_code=409,
                details={"code": "nicht_angenommen"},
            )
        schichten = self._tausch_schichten(tenant_id, [row])
        schicht = schichten.get(str(row["schicht_id"]))
        if schicht is None:
            raise PersonalError("Die Schicht des Tauschs fehlt.", status_code=404)
        payload: dict[str, Any] = {
            "status": "freigegeben" if req.freigeben else "abgelehnt",
            "kommentar": req.kommentar,
            "entschieden_von": ctx.user_id,
            "entschieden_am": jetzt().isoformat(),
        }
        if not req.freigeben:
            (
                self._db.table("personal_schicht_tausch")
                .update(payload)
                .eq("id", tausch_id)
                .eq("tenant_id", tenant_id)
                .execute()
            )
            melde_tausch(
                self._db,
                tenant_id=tenant_id,
                tausch={**row, **payload},
                schicht=schicht,
                ereignis="verworfen",
                empfaenger={str(row["von_user_id"]), str(row["an_user_id"])},
                woche_start=self._woche_von(schicht),
            )
            return self._tausch_nachladen(ctx, tenant_id, tausch_id)
        gegen = (
            schichten.get(str(row["gegen_schicht_id"])) if row.get("gegen_schicht_id") else None
        )
        self._tausch_pruefen(tenant_id, row, schicht, gegen, regeln, req.warnungen_akzeptieren)
        self._tausch_schreiben(ctx, tenant_id, row, schicht, gegen)
        (
            self._db.table("personal_schicht_tausch")
            .update(payload)
            .eq("id", tausch_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        melde_tausch(
            self._db,
            tenant_id=tenant_id,
            tausch={**row, **payload},
            schicht=schicht,
            ereignis="freigegeben",
            empfaenger={str(row["von_user_id"]), str(row["an_user_id"])},
            woche_start=self._woche_von(schicht),
        )
        log.info(
            "personal_tausch_freigegeben",
            tenant_id=tenant_id,
            tausch_id=tausch_id,
            schicht_id=row["schicht_id"],
            gegen_schicht_id=row.get("gegen_schicht_id"),
        )
        return self._tausch_nachladen(ctx, tenant_id, tausch_id)

    def _tausch_pruefen(  # noqa: PLR0913 — beide Schichten und die Regeln
        self,
        tenant_id: str,
        row: dict[str, Any],
        schicht: dict[str, Any],
        gegen: dict[str, Any] | None,
        regeln: rw.Regeln,
        warnungen_ok: bool,
    ) -> None:
        """Beide Zielbelegungen gegen die Regeln — 409/422 wie bei einer Schicht.

        Geprüft wird die Lage NACH dem Tausch: die Schicht bei der annehmenden
        Person, die Gegen-Schicht bei der gebenden. Beide zusammen, weil ein
        Tausch, dessen zweite Hälfte eine Ruhezeit reißt, nicht halb gelten darf.
        """
        konflikte: list[rw.Konflikt] = []
        paare = [(schicht, str(row["an_user_id"]))]
        if gegen is not None:
            paare.append((gegen, str(row["von_user_id"])))
        for s, neuer_user in paare:
            start, ende = als_dt(s["start_at"]), als_dt(s["end_at"])
            if start is None or ende is None:
                raise PersonalError("Schicht ohne Zeiten.", status_code=500)
            block = rw.Zeitblock(
                id=str(s["id"]),
                user_id=neuer_user,
                start_at=start,
                end_at=ende,
                pause_min=int(s.get("pause_min") or 0),
                property_id=s.get("property_id"),
                arbeitsbereich_id=s.get("arbeitsbereich_id"),
            )
            # `ausser` schließt BEIDE getauschten Schichten aus, sonst meldet
            # die Prüfung die Schicht, die gerade weggeht, als Doppelbelegung.
            konflikte.extend(
                k
                for k in self._konflikte_live(tenant_id, block, regeln, ausser=str(s["id"]))
                if not (
                    k.art == "doppelbelegung"
                    and str(k.werte.get("schicht_id") or "")
                    in {str(schicht["id"]), str((gegen or {}).get("id") or "")}
                )
            )
        self._konflikte_durchsetzen(konflikte, warnungen_ok)

    def _tausch_schreiben(  # noqa: PLR0913 — der Gegenzustand braucht beide Seiten
        self,
        ctx: AuthContext,
        tenant_id: str,
        row: dict[str, Any],
        schicht: dict[str, Any],
        gegen: dict[str, Any] | None,
    ) -> None:
        """BEIDE Schichten in EINEM Schritt (Wurzel 1).

        Kein Rückfragepunkt, kein Timeout, keine Bedingung zwischen den zwei
        Updates: sonst hat die annehmende Person die Schicht und die gebende
        ihre Gegen-Schicht auch noch.
        """
        an_user, von_user = str(row["an_user_id"]), str(row["von_user_id"])
        umzug = [(schicht, an_user)]
        if gegen is not None:
            umzug.append((gegen, von_user))
        wochen: set[tuple[str, date]] = set()
        for s, neuer_user in umzug:
            sid = str(s["id"])
            neu = {
                "user_id": neuer_user,
                "quelle": "tausch",
                # Der Dienst ist neu für diese Person → sie bestätigt ihn neu.
                "status": "veroeffentlicht",
                "bestaetigt_am": None,
            }
            (
                self._db.table("personal_schichten")
                .update(neu)
                .eq("id", sid)
                .eq("tenant_id", tenant_id)
                .execute()
            )
            self._protokoll(tenant_id, sid, ctx.user_id, "getauscht", _kern(s), {**_kern(s), **neu})
            tag = als_date(s["datum"]) or date.today()
            wochen.add((neuer_user, _montag(tag)))
            wochen.add((str(s.get("user_id") or neuer_user), _montag(tag)))
        self._melde_wochen(tenant_id, wochen)

    def _planende(self, tenant_id: str) -> set[str]:
        """admin/co_admin des Betriebs — sie geben Tausche frei."""
        return {
            str(u["id"])
            for u in self._users(tenant_id)
            if str(u.get("role")) in LEITUNG and u.get("deactivated_at") is None
        }

    @staticmethod
    def _woche_von(schicht: dict[str, Any]) -> str | None:
        tag = als_date(schicht.get("datum"))
        return _montag(tag).isoformat() if tag else None

    # ------------------------------------------------------------------
    # Abwesenheits-Vorschau
    # ------------------------------------------------------------------

    def abwesenheit_vorschau(
        self, ctx: AuthContext, req: AbwesenheitVorschauRequest
    ) -> AbwesenheitVorschau:
        """Der Live-Zähler des Antrags: Tage, Rest, Sperre, Schichten, Kollegen.

        Dieselben Prüfungen wie `beantragen`, aber ohne Seiteneffekt — die Codes
        in `fehler` sind genau die, die der Antrag werfen würde.
        """
        tenant_id = self._require_tenant(ctx)
        regeln = self._regeln(tenant_id)
        abw = AbwesenheitenService(self._db)
        leitung = self._ist_leitung(ctx) or self._rolle_aus_db(ctx, tenant_id) == "shift_lead"
        user_id = req.user_id or ctx.user_id
        if user_id != ctx.user_id:
            if not leitung:
                raise PersonalError("Anträge stellst du nur für dich selbst.", status_code=403)
            self._require_person_im_scope(ctx, tenant_id, user_id)
        akte = self._akten(tenant_id, {user_id}).get(user_id) or {}
        feiertage = set(self._feiertage(tenant_id, req.von, req.bis))
        tage = rw.abwesenheitstage(
            req.von,
            req.bis,
            halbtag_start=req.halbtag_start,
            halbtag_ende=req.halbtag_ende,
            arbeitstage=self._arbeitstage(akte),
            feiertage=feiertage,
        )
        fehler: list[str] = []
        rest_vorher = rest_nachher = None
        if req.art == "urlaub":
            rest_vorher, rest_nachher, urlaub_fehler = self._urlaub_vorschau(
                ctx, abw, user_id, req, regeln, tage, akte, leitung=leitung
            )
            fehler.extend(urlaub_fehler)
        sperre = self._sperre_hinweis(tenant_id, user_id, req)
        if sperre is not None and req.art == "urlaub" and not self._ist_leitung(ctx):
            fehler.append("urlaubssperre")
        if self._ueberlappt_vorschau(tenant_id, user_id, req):
            fehler.append("ueberlappung")
        return AbwesenheitVorschau(
            tage=float(tage),
            rest_vorher=rest_vorher,
            rest_nachher=rest_nachher,
            sperre=sperre,
            schichten_betroffen=self._schichten_betroffen(tenant_id, user_id, req),
            kollegen_abwesend=self._kollegen_abwesend(ctx, tenant_id, user_id, req),
            fehler=fehler,
        )

    def _urlaub_vorschau(  # noqa: PLR0913 — Konto, Antrag und Regeln
        self,
        ctx: AuthContext,
        abw: AbwesenheitenService,
        user_id: str,
        req: AbwesenheitVorschauRequest,
        regeln: rw.Regeln,
        tage: Decimal,
        akte: dict[str, Any],
        *,
        leitung: bool,
    ) -> tuple[float | None, float | None, list[str]]:
        fehler: list[str] = []
        if akte.get("beschaeftigungsart") == "extern":
            return None, None, ["extern_kein_urlaub"]
        jahr = req.von.year if req.von.month >= regeln.urlaubsjahr_start_monat else req.von.year - 1
        konto = abw.urlaubskonto(ctx, user_id, jahr, intern=True)
        vorher = konto.rest
        nachher = float(Decimal(str(vorher)) - tage)
        if Decimal(str(vorher)) < tage:
            fehler.append("anspruch")
        vorlauf = (req.von - date.today()).days
        if regeln.mindest_vorlauf_urlaub_tage > 0 and not leitung and (
            vorlauf < regeln.mindest_vorlauf_urlaub_tage
        ):
            fehler.append("vorlauf")
        grenze = regeln.max_urlaub_zusammenhaengend_tage
        if grenze is not None and (req.bis - req.von).days + 1 > grenze:
            fehler.append("max_zusammenhaengend")
        return vorher, nachher, fehler

    def _sperre_hinweis(
        self, tenant_id: str, user_id: str, req: AbwesenheitVorschauRequest
    ) -> SperreHinweis | None:
        rows = (
            self._db.table("personal_urlaubssperren")
            .select("von, bis, grund, arbeitsbereich_id")
            .eq("tenant_id", tenant_id)
            .lte("von", req.bis.isoformat())
            .gte("bis", req.von.isoformat())
            .execute()
        ).data or []
        bereiche = set(self._quali_bereiche(tenant_id, {user_id}).get(user_id, []))
        for r in rows:
            bereich = r.get("arbeitsbereich_id")
            if bereich and str(bereich) not in bereiche:
                continue
            von, bis = als_date(r["von"]), als_date(r["bis"])
            if von and bis:
                return SperreHinweis(grund=str(r.get("grund") or ""), von=von, bis=bis)
        return None

    def _ueberlappt_vorschau(
        self, tenant_id: str, user_id: str, req: AbwesenheitVorschauRequest
    ) -> bool:
        rows = (
            self._db.table("personal_abwesenheiten")
            .select("id, status")
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .lte("von", req.bis.isoformat())
            .gte("bis", req.von.isoformat())
            .execute()
        ).data or []
        return any(
            r.get("status") in ("beantragt", "vorgenehmigt", "genehmigt") for r in rows
        )

    def _schichten_betroffen(
        self, tenant_id: str, user_id: str, req: AbwesenheitVorschauRequest
    ) -> int:
        rows = (
            self._db.table("personal_schichten")
            .select("id, status")
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .gte("datum", req.von.isoformat())
            .lte("datum", req.bis.isoformat())
            .execute()
        ).data or []
        return sum(1 for r in rows if r.get("status") in _AKTIV)

    def _kollegen_abwesend(
        self, ctx: AuthContext, tenant_id: str, user_id: str, req: AbwesenheitVorschauRequest
    ) -> list[KollegeAbwesend]:
        """Wer im Team ist im selben Zeitraum schon weg — der Grund für ein Nein."""
        ids = self._personen_im_scope(ctx, tenant_id) - {user_id}
        if not ids:
            return []
        rows = (
            self._db.table("personal_abwesenheiten")
            .select("user_id, art, status")
            .eq("tenant_id", tenant_id)
            .in_("user_id", sorted(ids))
            .lte("von", req.bis.isoformat())
            .gte("bis", req.von.isoformat())
            .execute()
        ).data or []
        namen = {str(u["id"]): u.get("full_name") for u in self._users(tenant_id, ids)}
        gesehen: set[str] = set()
        aus: list[KollegeAbwesend] = []
        for r in rows:
            uid = str(r["user_id"])
            if r.get("status") not in ("vorgenehmigt", "genehmigt") or uid in gesehen:
                continue
            gesehen.add(uid)
            aus.append(KollegeAbwesend(user_id=uid, full_name=namen.get(uid), art=r["art"]))
        return sorted(aus, key=lambda k: (str(k.full_name or ""), k.user_id))

    # ------------------------------------------------------------------
    # CSV-Export
    # ------------------------------------------------------------------

    def export_csv(self, ctx: AuthContext, woche: date) -> tuple[str, bytes]:
        """Wochenplan als CSV (Semikolon, BOM, CRLF) — Excel-tauglich.

        Ohne Finanzzahlen: der Export trägt die Fähigkeit `VIEW_TEAM_SCHEDULE`,
        und die sieht keine Löhne (§4.3).
        """
        plan = self.wochenplan(ctx, woche)
        tenant_id = self._require_tenant(ctx)
        akten = self._akten(tenant_id, {p.user_id for p in plan.personen})
        namen = {p.user_id: p.full_name or "" for p in plan.personen}
        bereiche = self._bereich_kurz(tenant_id)
        zeile = [
            "Datum;Wochentag;Person;Personalnummer;Bereich;Objekt;Von;Bis;Pause;Netto;"
            "Status;Notiz"
        ]
        zone = ZoneInfo(plan.zeitzone)
        for s in plan.schichten:
            if s.status == "abgesagt":
                continue
            uid = s.user_id or ""
            zeile.append(
                ";".join(
                    _csv(w)
                    for w in (
                        s.datum.isoformat(),
                        _WOCHENTAG[s.datum.weekday()],
                        namen.get(uid, ""),
                        (akten.get(uid) or {}).get("employee_number") or "",
                        bereiche.get(str(s.arbeitsbereich_id or ""), ""),
                        s.property_title or "",
                        s.start_at.astimezone(zone).strftime("%H:%M"),
                        s.end_at.astimezone(zone).strftime("%H:%M"),
                        str(s.pause_min),
                        f"{s.netto_minuten // 60}:{s.netto_minuten % 60:02d}",
                        s.status,
                        s.notiz or "",
                    )
                )
            )
        name = f"dienstplan-{plan.woche_start.isoformat()}.csv"
        return name, ("\r\n".join(zeile) + "\r\n").encode("utf-8-sig")

    def _bereich_kurz(self, tenant_id: str) -> dict[str, str]:
        rows = (
            self._db.table("personal_arbeitsbereiche")
            .select("id, name, kurz")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        return {str(r["id"]): str(r.get("name") or r.get("kurz") or "") for r in rows}


_WOCHENTAG = ("Mo", "Di", "Mi", "Do", "Fr", "Sa", "So")


def _csv(wert: str) -> str:
    """Semikolon, Anführungszeichen und Umbrüche entschärfen.

    Zusätzlich ein führendes `=`/`+`/`-`/`@` neutralisieren (CSV-Injection):
    Excel würde `=HYPERLINK(...)` in einer Notiz als Formel ausführen (Wurzel 8).
    """
    s = str(wert or "").replace("\r", " ").replace("\n", " ")
    if s[:1] in ("=", "+", "-", "@"):
        s = "'" + s
    if ";" in s or '"' in s:
        s = '"' + s.replace('"', '""') + '"'
    return s


def _kern(r: dict[str, Any]) -> dict[str, Any]:
    """Die Felder, die ins Protokoll gehören (wie `schichten._kern`)."""
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


def get_planung_service() -> PlanungService:
    """Service-Factory (der Integrator hängt sie in `dependencies.py` ein)."""
    return PlanungService(service_client=get_service_client())
