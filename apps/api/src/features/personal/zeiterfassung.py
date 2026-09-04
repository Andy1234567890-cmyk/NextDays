"""Zeiterfassung (0541, Etappe 4): Stempeluhr, Korrekturen mit Pflichtgrund,
Arbeitszeitkonto, Monatsabschluss.

Zustände einer Stempelung: `offen` (läuft, evtl. in Pause) → `abgeschlossen`
→ `bestaetigt` (Leitung). Höchstens EINE offene je Person (Unique-Index).
Idempotenz (Wurzel 2): `idempotenz_key` aus der (späteren) App — dieselbe
Stempelung zweimal gesendet ist EINE Zeile; ein zweiter Start ohne Ende gibt
die laufende zurück statt 500. Der Zeitpunkt darf vom Gerät kommen
(Offline-Warteschlange) — er wird gegen „nicht in der Zukunft" und „nicht vor
dem Start" geprüft, nie stumm durch unsere Uhr ersetzt (Wurzel 5b).

Betriebsregeln, die hier wirken (0544, Vertrag §3.3):
  * `stempel_ab_schichtbeginn` — wer vor dem geplanten Beginn stempelt, sammelt
    keine Zeit: `start_at = max(jetzt, schicht.start_at)`. Die Schicht wird
    verknüpft und die Verspätung in Minuten festgehalten (`verspaetung_min`).
  * `gps_pflicht` — Start/Ende aus `web`/`app` OHNE Standort ist 422
    `gps_pflicht`. Ist das Objekt weiter als `gps_radius_m` entfernt, wird die
    Stempelung NICHT abgelehnt (die Person steht vielleicht 300 m weiter am
    Nachbarhaus), sondern die Entfernung in die Notiz geschrieben und die
    Leitung informiert — eine Ablehnung würde Arbeitszeit verschlucken.
  * `verspaetung_melden_min` — siehe `verspaetung.py` (Worker-Modul).
Das Terminal (`quelle='terminal'`) ist von der GPS-Pflicht ausgenommen: das
Gerät steht per Definition am Objekt, ein Tablet hat oft kein GPS.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Any

from postgrest.exceptions import APIError

from src.core.security import AuthContext
from src.core.supabase import load_scoped

from . import regelwerk as rw
from ._base import (
    _UNIQUE_VERLETZUNG,
    LEITUNG,
    PLANBARE_ROLLEN,
    PersonalBase,
    PersonalError,
    als_date,
    als_dt,
    als_float,
    jetzt,
    log,
)
from .benachrichtigungen import melde_zeit_hinweis
from .schemas import (
    MAX_ZEITRAUM_TAGE,
    Arbeitszeitkonto,
    AzkBuchung,
    AzkBuchungCreate,
    Monatsabschluss,
    MonatsabschlussRequest,
    PausenEintrag,
    PlanPerson,
    Standort,
    StempelEnde,
    StempelStart,
    Zeiterfassung,
    ZeitKorrektur,
    ZeitListResponse,
    ZeitManuell,
)
from .ueberstunden_schemas import ZeitOffenPunkte, ZeitZusammenfassung

_SPALTEN = (
    "id, tenant_id, user_id, start_at, end_at, pausen, quelle, schicht_id, task_id, property_id, "
    "standort_start, standort_ende, status, bestaetigt_von, bestaetigt_am, notiz, idempotenz_key, "
    "terminal_id, verspaetung_min, created_at, updated_at"
)
# Eine Stempelung, die länger läuft, ist vergessen worden — Hinweis an die Leitung.
OFFEN_WARNUNG_STUNDEN = 16
# Zukunfts-Toleranz für Geräte-Uhren.
_ZUKUNFT_TOLERANZ = timedelta(minutes=5)
# Fenster, in dem eine Schicht als „die von jetzt" gilt (Einstempel-Regel).
_SCHICHT_FENSTER = timedelta(hours=3)
_AKTIVE_SCHICHT = ("veroeffentlicht", "bestaetigt")
# Quellen, für die die GPS-Pflicht gilt: ein Mensch mit Gerät in der Hand.
_GPS_QUELLEN = ("web", "app")
# Erddurchmesser-Konstante der Haversine-Formel (Meter).
_ERDRADIUS_M = 6_371_000.0
# „Verpasst" schaut 14 Tage zurück (Vertrag §3.4).
_VERPASST_TAGE = 14


def _distanz_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Luftlinie in Metern (Haversine).

    Reine Funktion, damit sie ohne DB prüfbar ist. Haversine statt der exakten
    Vincenty-Formel: auf den hier relevanten Entfernungen (Meter bis wenige
    Kilometer) liegt der Fehler unter 0,5 % — kleiner als die Genauigkeit jedes
    Handy-GPS, gegen die verglichen wird.
    """
    from math import asin, cos, radians, sin, sqrt  # noqa: PLC0415 — nur hier

    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = (
        sin(dlat / 2) ** 2
        + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    )
    return 2 * _ERDRADIUS_M * asin(min(1.0, sqrt(a)))


class ZeiterfassungService(PersonalBase):
    # ------------------------------------------------------------------
    # Lesen
    # ------------------------------------------------------------------

    def offene(self, ctx: AuthContext) -> Zeiterfassung | None:
        tenant_id = self._require_tenant(ctx)
        row = self.offene_row(tenant_id, ctx.user_id)
        return self.eintrag(row, {}) if row else None

    def offene_row(self, tenant_id: str, user_id: str) -> dict[str, Any] | None:
        """Die laufende Stempelung einer Person — auch für den Terminal-Pfad
        (dort gibt es keinen AuthContext, die Person kommt aus Stempel-ID+PIN)."""
        rows = (
            self._db.table("personal_zeiterfassung")
            .select(_SPALTEN)
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .is_("end_at", "null")
            .limit(1)
            .execute()
        ).data or []
        return rows[0] if rows else None

    def liste(
        self, ctx: AuthContext, von: date, bis: date, *, user_id: str | None = None
    ) -> ZeitListResponse:
        tenant_id = self._require_tenant(ctx)
        if (bis - von).days > MAX_ZEITRAUM_TAGE:
            raise PersonalError("Zeitraum zu lang.", status_code=422)
        ids = self._personen_im_scope(ctx, tenant_id)
        if user_id:
            if user_id not in ids:
                raise PersonalError("Person nicht gefunden.", status_code=404)
            ids = {user_id}
        if not ids:
            return ZeitListResponse(items=[], personen=[])
        rows = (
            self._db.table("personal_zeiterfassung")
            .select(_SPALTEN)
            .eq("tenant_id", tenant_id)
            .in_("user_id", sorted(ids))
            .gte("start_at", datetime.combine(von, datetime.min.time(), UTC).isoformat())
            .lt(
                "start_at",
                datetime.combine(bis + timedelta(days=1), datetime.min.time(), UTC).isoformat(),
            )
            .execute()
        ).data or []
        titel = self._property_titel(
            tenant_id, {str(r["property_id"]) for r in rows if r.get("property_id")}
        )
        schichten = self._schichten(
            tenant_id, {str(r["schicht_id"]) for r in rows if r.get("schicht_id")}
        )
        korrekturen = self._korrektur_zaehler([str(r["id"]) for r in rows])
        items = [
            self.eintrag(
                r,
                titel,
                schichten.get(str(r.get("schicht_id") or "")),
                korrekturen.get(str(r["id"]), 0),
            )
            for r in rows
        ]
        items.sort(key=lambda z: (z.start_at, z.user_id), reverse=True)
        akten = self._akten(tenant_id, ids)
        personen = [
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
        return ZeitListResponse(items=items, personen=personen)

    def _schichten(self, tenant_id: str, ids: set[str]) -> dict[str, dict[str, Any]]:
        if not ids:
            return {}
        rows = (
            self._db.table("personal_schichten")
            .select("id, start_at, end_at, pause_min")
            .eq("tenant_id", tenant_id)
            .in_("id", sorted(ids))
            .execute()
        ).data or []
        return {str(r["id"]): r for r in rows}

    def _korrektur_zaehler(self, ids: list[str]) -> dict[str, int]:
        if not ids:
            return {}
        rows = (
            self._db.table("personal_zeit_korrekturen")
            .select("zeiterfassung_id")
            .in_("zeiterfassung_id", ids)
            .execute()
        ).data or []
        aus: dict[str, int] = {}
        for r in rows:
            aus[str(r["zeiterfassung_id"])] = aus.get(str(r["zeiterfassung_id"]), 0) + 1
        return aus

    def eintrag(
        self,
        r: dict[str, Any],
        titel: dict[str, str],
        schicht: dict[str, Any] | None = None,
        korrekturen: int = 0,
    ) -> Zeiterfassung:
        start = als_dt(r["start_at"])
        ende = als_dt(r.get("end_at"))
        if start is None:
            raise PersonalError("Stempelung ohne Start.", status_code=500)
        pausen_roh = list(r.get("pausen") or [])
        pausen = [
            PausenEintrag(start=als_dt(p.get("start")), end=als_dt(p.get("end")))
            for p in pausen_roh
            if als_dt(p.get("start"))
        ]  # type: ignore[arg-type]
        jetzt_ = jetzt()
        pause_min = rw.pausen_minuten(pausen_roh, jetzt=jetzt_)
        bis = ende or jetzt_
        netto = max(0, int((bis - start).total_seconds() // 60) - pause_min)
        in_pause = any(p.end is None for p in pausen)
        zustand = "beendet" if ende else ("in_pause" if in_pause else "laeuft")
        abweichung = None
        if schicht and ende:
            s0, s1 = als_dt(schicht.get("start_at")), als_dt(schicht.get("end_at"))
            if s0 and s1:
                plan = rw.netto_minuten(s0, s1, int(schicht.get("pause_min") or 0))
                abweichung = netto - plan
        return Zeiterfassung(
            id=str(r["id"]),
            user_id=str(r["user_id"]),
            start_at=start,
            end_at=ende,
            pausen=pausen,
            quelle=r["quelle"],
            schicht_id=r.get("schicht_id"),
            task_id=r.get("task_id"),
            property_id=r.get("property_id"),
            property_title=titel.get(str(r.get("property_id") or "")),
            standort_start=r.get("standort_start"),
            standort_ende=r.get("standort_ende"),
            status=r["status"],
            bestaetigt_von=r.get("bestaetigt_von"),
            bestaetigt_am=als_dt(r.get("bestaetigt_am")),
            notiz=r.get("notiz"),
            netto_minuten=netto,
            pause_minuten=pause_min,
            plan_abweichung_min=abweichung,
            terminal_id=r.get("terminal_id"),
            verspaetung_min=r.get("verspaetung_min"),
            korrekturen=korrekturen,
            zustand=zustand,
        )

    # ------------------------------------------------------------------
    # Stempeln (eigene Person)
    # ------------------------------------------------------------------

    def _zeitpunkt(
        self, gemeldet: datetime | None, *, nicht_vor: datetime | None = None
    ) -> datetime:
        z = (gemeldet or jetzt()).astimezone(UTC)
        if z > jetzt() + _ZUKUNFT_TOLERANZ:
            raise PersonalError("Zeitpunkt liegt in der Zukunft.", status_code=422)
        if nicht_vor and z <= nicht_vor:
            raise PersonalError("Zeitpunkt liegt vor dem Start.", status_code=422)
        return z

    def _standort(
        self, tenant_id: str, standort: Standort | None, property_id: str | None
    ) -> dict[str, float] | None:
        if standort is None:
            return None
        aus: dict[str, float] = {"lat": standort.lat, "lng": standort.lng}
        if standort.genauigkeit_m is not None:
            aus["genauigkeit_m"] = standort.genauigkeit_m
        if property_id:
            objekt = self._property_koordinate(tenant_id, property_id)
            if objekt is not None:
                aus["distanz_m"] = round(
                    _distanz_m(standort.lat, standort.lng, objekt[0], objekt[1])
                )
        return aus

    def _property_koordinate(
        self, tenant_id: str, property_id: str
    ) -> tuple[float, float] | None:
        """(lat, lng) des Objekts — oder None, wenn es keine Koordinate hat.

        Ohne Koordinate gibt es KEINE Distanz und deshalb auch keine
        Radius-Warnung: eine Entfernung zu einem unbekannten Punkt wäre eine
        erfundene Zahl (Wurzel 4). Der Standort wird trotzdem festgehalten.
        """
        self._property_im_tenant(tenant_id, property_id)
        rows = (
            self._db.table("properties")
            .select("lat, lng")
            .eq("tenant_id", tenant_id)
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows or rows[0].get("lat") is None or rows[0].get("lng") is None:
            return None
        return float(rows[0]["lat"]), float(rows[0]["lng"])

    # --- Betriebsregeln der Stempelung ---------------------------------

    def _zeitregeln(self, tenant_id: str) -> dict[str, Any]:
        """Die Zeiterfassungs-Felder aus 0544 direkt aus der Regel-Zeile.

        Bewusst über `_regeln_row()` und nicht über die Dataclass `Regeln`: die
        gehört B1 und trägt diese Felder erst, wenn B1 sie einträgt (Vertrag §0).
        Fehlt die Zeile ganz, gelten die DB-Defaults — dieselben Werte, die die
        Migration setzt, keine erfundenen.
        """
        row = self._regeln_row(tenant_id) or {}
        return {
            "gps_pflicht": bool(row.get("gps_pflicht", False)),
            "gps_radius_m": int(row.get("gps_radius_m") or 250),
            "stempel_ab_schichtbeginn": bool(row.get("stempel_ab_schichtbeginn", False)),
        }

    def _gps_pruefen(
        self,
        tenant_id: str,
        *,
        quelle: str,
        standort: Standort | None,
        property_id: str | None,
    ) -> None:
        """422 `gps_pflicht`, wenn die Regel greift und kein Standort kam.

        Nur für `web`/`app`: `terminal` steht am Objekt (Gerät ohne GPS),
        `korrektur`/`import` sind Nachträge der Leitung ohne Ortsbezug.
        """
        if quelle not in _GPS_QUELLEN:
            return
        if not self._zeitregeln(tenant_id)["gps_pflicht"]:
            return
        if standort is not None:
            return
        raise PersonalError(
            "Für das Stempeln ist der Standort Pflicht. Bitte die Ortungsfreigabe erteilen.",
            status_code=422,
            details={"code": "gps_pflicht", "property_id": property_id},
        )

    def _radius_warnung(
        self, tenant_id: str, gespeichert: dict[str, float] | None, *, user_id: str
    ) -> str | None:
        """Notiz-Text bei zu großer Entfernung + Hinweis an die Leitung.

        KEINE Ablehnung: die Person steht vielleicht am Nachbarhaus derselben
        Anlage. Eine abgelehnte Stempelung wäre verschluckte Arbeitszeit; der
        Hinweis macht die Abweichung sichtbar, ohne sie zu entscheiden.
        """
        if not gespeichert or gespeichert.get("distanz_m") is None:
            return None
        radius = self._zeitregeln(tenant_id)["gps_radius_m"]
        distanz = int(gespeichert["distanz_m"])
        if distanz <= radius:
            return None
        melde_zeit_hinweis(
            self._db,
            tenant_id=tenant_id,
            leitung_ids=self._leitung_ids(tenant_id),
            betroffen_id=user_id,
            art="standort",
            werte={"distanz": str(distanz), "radius": str(radius)},
            dedup=f"{user_id}:{jetzt().strftime('%Y%m%d%H%M')}",
        )
        return f"Standort {distanz} m entfernt"

    def _leitung_ids(self, tenant_id: str) -> set[str]:
        rows = (
            self._db.table("users")
            .select("id, role, deactivated_at")
            .eq("tenant_id", tenant_id)
            .in_("role", sorted(LEITUNG))
            .execute()
        ).data or []
        return {str(r["id"]) for r in rows if r.get("deactivated_at") is None}

    def _einstempel_regel(
        self, tenant_id: str, user_id: str, start: datetime, schicht_id: str | None
    ) -> tuple[datetime, str | None, int | None]:
        """(start_at, schicht_id, verspaetung_min) nach `stempel_ab_schichtbeginn`.

        Ohne Regel bleibt alles wie gestempelt — die Schicht wird dann NICHT
        nachträglich verknüpft, weil eine Verknüpfung die Plan-Abweichung
        verändert und damit eine Aussage trifft, die niemand angefordert hat.
        """
        if not self._zeitregeln(tenant_id)["stempel_ab_schichtbeginn"]:
            return start, schicht_id, None
        schicht = self._schicht_um(tenant_id, user_id, start, schicht_id)
        if schicht is None:
            return start, schicht_id, None
        plan = als_dt(schicht.get("start_at"))
        if plan is None:
            return start, schicht_id, None
        verspaetung = max(0, int((start - plan).total_seconds() // 60))
        return max(start, plan), str(schicht["id"]), verspaetung

    def _schicht_um(
        self, tenant_id: str, user_id: str, start: datetime, schicht_id: str | None
    ) -> dict[str, Any] | None:
        """Die Schicht, zu der eine Stempelung um `start` gehört.

        Entweder die ausdrücklich mitgeschickte, oder die aktive Schicht der
        Person, deren Beginn höchstens `_SCHICHT_FENSTER` entfernt liegt. Bei
        mehreren gewinnt die zeitlich nächste — nicht die erste in der Liste.
        """
        if schicht_id:
            treffer = self._schichten(tenant_id, {schicht_id})
            return {**treffer[schicht_id], "id": schicht_id} if schicht_id in treffer else None
        rows = (
            self._db.table("personal_schichten")
            .select("id, start_at, end_at, pause_min, status")
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .in_("status", list(_AKTIVE_SCHICHT))
            .gte("start_at", (start - _SCHICHT_FENSTER).isoformat())
            .lte("start_at", (start + _SCHICHT_FENSTER).isoformat())
            .execute()
        ).data or []
        kandidaten = [(als_dt(r.get("start_at")), r) for r in rows]
        gueltig = [(d, r) for d, r in kandidaten if d is not None]
        if not gueltig:
            return None
        return min(gueltig, key=lambda x: abs((x[0] - start).total_seconds()))[1]

    def start(self, ctx: AuthContext, req: StempelStart) -> Zeiterfassung:
        tenant_id = self._require_tenant(ctx)
        self._require_planbar(tenant_id, ctx.user_id)
        offen = self.offene_row(tenant_id, ctx.user_id)
        if offen:
            if req.idempotenz_key and offen.get("idempotenz_key") == req.idempotenz_key:
                return self.eintrag(offen, {})
            raise PersonalError(
                "Es läuft bereits eine Zeiterfassung.",
                status_code=409,
                details={"code": "bereits_offen", "id": str(offen["id"])},
            )
        if req.idempotenz_key:
            alt = (
                self._db.table("personal_zeiterfassung")
                .select(_SPALTEN)
                .eq("tenant_id", tenant_id)
                .eq("idempotenz_key", req.idempotenz_key)
                .limit(1)
                .execute()
            ).data or []
            if alt:
                return self.eintrag(alt[0], {})
        if req.schicht_id:
            s = load_scoped(
                self._db,
                "personal_schichten",
                req.schicht_id,
                tenant_id,
                columns="id, user_id, property_id",
                not_found=PersonalError("Schicht nicht gefunden.", status_code=404),
            )
            if str(s.get("user_id") or "") != ctx.user_id:
                raise PersonalError("Schicht nicht gefunden.", status_code=404)
            if not req.property_id and s.get("property_id"):
                req = req.model_copy(update={"property_id": str(s["property_id"])})
        if req.property_id:
            self._property_im_tenant(tenant_id, req.property_id)
        quelle = "app" if req.idempotenz_key else "web"
        self._gps_pruefen(
            tenant_id, quelle=quelle, standort=req.standort, property_id=req.property_id
        )
        gestempelt = self._zeitpunkt(req.zeitpunkt)
        start, schicht_id, verspaetung = self._einstempel_regel(
            tenant_id, ctx.user_id, gestempelt, req.schicht_id
        )
        standort = self._standort(tenant_id, req.standort, req.property_id)
        warnung = self._radius_warnung(tenant_id, standort, user_id=ctx.user_id)
        notiz = "\n".join(x for x in (req.notiz, warnung) if x) or None
        payload = {
            "tenant_id": tenant_id,
            "user_id": ctx.user_id,
            "start_at": start.isoformat(),
            "pausen": [],
            "quelle": quelle,
            "schicht_id": schicht_id,
            "task_id": req.task_id,
            "property_id": req.property_id,
            "standort_start": standort,
            "status": "offen",
            "notiz": notiz,
            "verspaetung_min": verspaetung,
            "idempotenz_key": req.idempotenz_key,
        }
        try:
            row = self._db.table("personal_zeiterfassung").insert(payload).execute().data[0]
        except APIError as exc:
            if getattr(exc, "code", None) == _UNIQUE_VERLETZUNG:
                # Rennen zweier Starts: die andere hat gewonnen, sie ist die Wahrheit.
                offen = self.offene_row(tenant_id, ctx.user_id)
                if offen:
                    return self.eintrag(offen, {})
            raise
        log.info(
            "personal_stempel_start",
            tenant_id=tenant_id,
            user_id=ctx.user_id,
            quelle=payload["quelle"],
        )
        return self.eintrag(row, {})

    def pause(self, ctx: AuthContext, *, beenden: bool) -> Zeiterfassung:
        tenant_id = self._require_tenant(ctx)
        offen = self.offene_row(tenant_id, ctx.user_id)
        if offen is None:
            raise PersonalError("Keine laufende Zeiterfassung.", status_code=409)
        pausen = list(offen.get("pausen") or [])
        laufend = next((p for p in pausen if not p.get("end")), None)
        now = jetzt().isoformat()
        if beenden:
            if laufend is None:
                raise PersonalError("Keine laufende Pause.", status_code=409)
            laufend["end"] = now
        else:
            if laufend is not None:
                # Idempotent: zweiter Klick auf „Pause" ändert nichts.
                return self.eintrag(offen, {})
            pausen.append({"start": now, "end": None})
        (
            self._db.table("personal_zeiterfassung")
            .update({"pausen": pausen})
            .eq("id", str(offen["id"]))
            .eq("tenant_id", tenant_id)
            .execute()
        )
        return self.eintrag({**offen, "pausen": pausen}, {})

    def ende(self, ctx: AuthContext, req: StempelEnde) -> Zeiterfassung:
        tenant_id = self._require_tenant(ctx)
        offen = self.offene_row(tenant_id, ctx.user_id)
        if offen is None:
            raise PersonalError("Keine laufende Zeiterfassung.", status_code=409)
        start = als_dt(offen["start_at"]) or jetzt()
        self._gps_pruefen(
            tenant_id,
            quelle=str(offen.get("quelle") or "web"),
            standort=req.standort,
            property_id=offen.get("property_id"),
        )
        ende = self._zeitpunkt(req.zeitpunkt, nicht_vor=start)
        pausen = list(offen.get("pausen") or [])
        for p in pausen:
            if not p.get("end"):
                p["end"] = ende.isoformat()
        standort = self._standort(
            tenant_id, req.standort, offen.get("property_id")
        )
        payload: dict[str, Any] = {
            "end_at": ende.isoformat(),
            "pausen": pausen,
            "status": "abgeschlossen",
            "standort_ende": standort,
        }
        warnung = self._radius_warnung(tenant_id, standort, user_id=ctx.user_id)
        zusatz = "\n".join(x for x in (req.notiz, warnung) if x)
        if zusatz:
            payload["notiz"] = ((offen.get("notiz") or "") + "\n" + zusatz).strip()
        (
            self._db.table("personal_zeiterfassung")
            .update(payload)
            .eq("id", str(offen["id"]))
            .eq("tenant_id", tenant_id)
            .execute()
        )
        log.info(
            "personal_stempel_ende",
            tenant_id=tenant_id,
            user_id=ctx.user_id,
            minuten=int((ende - start).total_seconds() // 60),
        )
        return self.eintrag({**offen, **payload}, {})

    # ------------------------------------------------------------------
    # Terminal (quelle='terminal', KEIN AuthContext — Person aus Stempel-ID+PIN)
    # ------------------------------------------------------------------

    def terminal_aktion(  # noqa: PLR0913 — der Terminal-Bezug gehört vollständig dazu
        self,
        *,
        tenant_id: str,
        user_id: str,
        aktion: str,
        terminal_id: str,
        property_id: str | None,
        jetzt_: datetime | None = None,
    ) -> Zeiterfassung:
        """Start / Pause / Pause-Ende / Ende am Rezeptions-Terminal.

        Dieselbe Zustandsmaschine wie Web und App (höchstens EINE offene
        Stempelung, Pause idempotent) — nur ohne `AuthContext`: die Person ist
        über Stempel-ID + PIN belegt, der Guard sitzt am Geräte-Token
        (`terminal.TerminalService.geraet_pruefen`). Die Einstempel-Regel gilt
        hier genauso; die GPS-Pflicht nicht (das Gerät steht am Objekt).
        """
        now = (jetzt_ or jetzt()).astimezone(UTC)
        self._require_planbar(tenant_id, user_id)
        offen = self.offene_row(tenant_id, user_id)
        if aktion == "start":
            if offen is not None:
                # Idempotent (Wurzel 2): zweimal auf „Kommen" gibt die laufende
                # Stempelung zurück statt 409 — am Tablet tippt jeder zweimal.
                return self.eintrag(offen, {})
            return self._terminal_start(
                tenant_id=tenant_id,
                user_id=user_id,
                terminal_id=terminal_id,
                property_id=property_id,
                now=now,
            )
        if offen is None:
            raise PersonalError(
                "Keine laufende Zeiterfassung.",
                status_code=409,
                details={"code": "nicht_offen"},
            )
        if aktion in ("pause", "pause_ende"):
            return self._terminal_pause(
                tenant_id, offen, beenden=aktion == "pause_ende", now=now
            )
        return self._terminal_ende(tenant_id, offen, now=now)

    def _terminal_start(
        self,
        *,
        tenant_id: str,
        user_id: str,
        terminal_id: str,
        property_id: str | None,
        now: datetime,
    ) -> Zeiterfassung:
        start, schicht_id, verspaetung = self._einstempel_regel(
            tenant_id, user_id, now, None
        )
        payload: dict[str, Any] = {
            "tenant_id": tenant_id,
            "user_id": user_id,
            "start_at": start.isoformat(),
            "pausen": [],
            "quelle": "terminal",
            "schicht_id": schicht_id,
            "property_id": property_id,
            "status": "offen",
            "terminal_id": terminal_id,
            "verspaetung_min": verspaetung,
        }
        try:
            row = self._db.table("personal_zeiterfassung").insert(payload).execute().data[0]
        except APIError as exc:
            if getattr(exc, "code", None) == _UNIQUE_VERLETZUNG:
                offen = self.offene_row(tenant_id, user_id)
                if offen:
                    return self.eintrag(offen, {})
            raise
        log.info(
            "personal_terminal_stempel_start",
            tenant_id=tenant_id,
            user_id=user_id,
            terminal_id=terminal_id,
            verspaetung_min=verspaetung,
        )
        return self.eintrag(row, {})

    def _terminal_pause(
        self, tenant_id: str, offen: dict[str, Any], *, beenden: bool, now: datetime
    ) -> Zeiterfassung:
        pausen = list(offen.get("pausen") or [])
        laufend = next((p for p in pausen if not p.get("end")), None)
        if beenden:
            if laufend is None:
                # Idempotent: „Pause beenden" ohne laufende Pause ändert nichts.
                return self.eintrag(offen, {})
            laufend["end"] = now.isoformat()
        else:
            if laufend is not None:
                return self.eintrag(offen, {})
            pausen.append({"start": now.isoformat(), "end": None})
        (
            self._db.table("personal_zeiterfassung")
            .update({"pausen": pausen})
            .eq("id", str(offen["id"]))
            .eq("tenant_id", tenant_id)
            .execute()
        )
        return self.eintrag({**offen, "pausen": pausen}, {})

    def _terminal_ende(
        self, tenant_id: str, offen: dict[str, Any], *, now: datetime
    ) -> Zeiterfassung:
        start = als_dt(offen["start_at"]) or now
        if now <= start:
            raise PersonalError(
                "Das Ende liegt vor dem Start.",
                status_code=422,
                details={"code": "ende_vor_start"},
            )
        pausen = list(offen.get("pausen") or [])
        for p in pausen:
            if not p.get("end"):
                p["end"] = now.isoformat()
        payload: dict[str, Any] = {
            "end_at": now.isoformat(),
            "pausen": pausen,
            "status": "abgeschlossen",
        }
        (
            self._db.table("personal_zeiterfassung")
            .update(payload)
            .eq("id", str(offen["id"]))
            .eq("tenant_id", tenant_id)
            .execute()
        )
        log.info(
            "personal_terminal_stempel_ende",
            tenant_id=tenant_id,
            user_id=str(offen["user_id"]),
            minuten=int((now - start).total_seconds() // 60),
        )
        return self.eintrag({**offen, **payload}, {})

    # ------------------------------------------------------------------
    # Listen (Vertrag §3.4)
    # ------------------------------------------------------------------

    def zusammenfassung(
        self, ctx: AuthContext, von: date, bis: date
    ) -> list[ZeitZusammenfassung]:
        """Je Person eine Zeile für das Fenster: Ist, Soll, Überstunden, Fehltage.

        Soll ist `None`, wenn die Akte keine Wochenstunden trägt — keine
        erfundene 40-Stunden-Woche (Wurzel 4). Überstunden sind dann ebenfalls
        0, weil ohne Soll keine Differenz existiert.
        """
        tenant_id = self._require_tenant(ctx)
        if bis < von:
            raise PersonalError("Der Zeitraum endet vor seinem Beginn.", status_code=422)
        if (bis - von).days > MAX_ZEITRAUM_TAGE:
            raise PersonalError(
                "Zeitraum zu lang.", status_code=422, details={"code": "zeitraum_zu_lang"}
            )
        ids = self._personen_im_scope(ctx, tenant_id)
        if not ids:
            return []
        zeiten = self._zeiten_im_fenster(tenant_id, ids, von, bis)
        abwesend = self._abwesenheitstage(tenant_id, ids, von, bis)
        akten = self._akten(tenant_id, ids)
        users = {str(u["id"]): u for u in self._users(tenant_id, ids)}
        aus: list[ZeitZusammenfassung] = []
        for uid in sorted(ids):
            u = users.get(uid)
            if u is None or str(u.get("role")) not in PLANBARE_ROLLEN:
                continue
            aus.append(
                self._zusammenfassung_zeile(
                    uid,
                    full_name=u.get("full_name"),
                    rows=[r for r in zeiten if str(r["user_id"]) == uid],
                    akte=akten.get(uid),
                    abwesend=abwesend.get(uid, {}),
                    von=von,
                    bis=bis,
                )
            )
        aus.sort(key=lambda z: (str(z.full_name or "").casefold(), z.user_id))
        return aus

    def _zusammenfassung_zeile(  # noqa: PLR0913 — eine Zeile braucht ihre Quellen
        self,
        user_id: str,
        *,
        full_name: str | None,
        rows: list[dict[str, Any]],
        akte: dict[str, Any] | None,
        abwesend: dict[str, float],
        von: date,
        bis: date,
    ) -> ZeitZusammenfassung:
        tage: set[date] = set()
        netto = 0
        unbestaetigt = 0
        verspaetungen = 0
        for r in rows:
            start, ende = als_dt(r["start_at"]), als_dt(r.get("end_at"))
            if start is None:
                continue
            tage.add(start.date())
            if ende is not None:
                netto += max(
                    0,
                    int((ende - start).total_seconds() // 60)
                    - rw.pausen_minuten(list(r.get("pausen") or []), jetzt=ende),
                )
            if r.get("status") != "bestaetigt":
                unbestaetigt += 1
            if (r.get("verspaetung_min") or 0) > 0:
                verspaetungen += 1
        soll = self._soll_minuten(akte, von, bis)
        return ZeitZusammenfassung(
            user_id=user_id,
            full_name=full_name,
            arbeitstage=len(tage),
            netto_minuten=netto,
            soll_minuten=soll,
            ueberstunden_minuten=0 if soll is None else max(0, netto - soll),
            krank_tage=abwesend.get("krank", 0.0) + abwesend.get("kind_krank", 0.0),
            urlaub_tage=abwesend.get("urlaub", 0.0),
            unbestaetigt=unbestaetigt,
            verspaetungen=verspaetungen,
        )

    def _soll_minuten(
        self, akte: dict[str, Any] | None, von: date, bis: date
    ) -> int | None:
        """Sollminuten im Fenster aus Wochenstunden und Arbeitstagen der Akte.

        Ohne Wochenstunden gibt es kein Soll (None) — und damit keine
        Überstundenaussage. Externe Kräfte führen kein Konto.
        """
        if akte is None or akte.get("beschaeftigungsart") == "extern":
            return None
        wochenstunden = als_float(akte.get("wochenstunden"))
        if wochenstunden is None:
            return None
        arbeitstage = self._arbeitstage(akte)
        if not arbeitstage:
            return None
        je_tag = wochenstunden * 60 / len(arbeitstage)
        n = sum(
            1
            for i in range((bis - von).days + 1)
            if (von + timedelta(days=i)).weekday() in arbeitstage
        )
        return int(round(je_tag * n))

    def _zeiten_im_fenster(
        self, tenant_id: str, ids: set[str], von: date, bis: date
    ) -> list[dict[str, Any]]:
        return (
            self._db.table("personal_zeiterfassung")
            .select(_SPALTEN)
            .eq("tenant_id", tenant_id)
            .in_("user_id", sorted(ids))
            .gte("start_at", datetime.combine(von, datetime.min.time(), UTC).isoformat())
            .lt(
                "start_at",
                datetime.combine(bis + timedelta(days=1), datetime.min.time(), UTC).isoformat(),
            )
            .execute()
        ).data or []

    def _abwesenheitstage(
        self, tenant_id: str, ids: set[str], von: date, bis: date
    ) -> dict[str, dict[str, float]]:
        rows = (
            self._db.table("personal_abwesenheiten")
            .select("user_id, art, von, bis, tage_berechnet, status")
            .eq("tenant_id", tenant_id)
            .in_("user_id", sorted(ids))
            .eq("status", "genehmigt")
            .lte("von", bis.isoformat())
            .gte("bis", von.isoformat())
            .execute()
        ).data or []
        aus: dict[str, dict[str, float]] = {}
        for r in rows:
            uid, art = str(r["user_id"]), str(r["art"])
            tage = als_float(r.get("tage_berechnet")) or 0.0
            aus.setdefault(uid, {})
            aus[uid][art] = aus[uid].get(art, 0.0) + tage
        return aus

    def unbestaetigt(self, ctx: AuthContext, *, heute: date | None = None) -> list[ZeitOffenPunkte]:
        """Je Person: offene Bestätigungen und verpasste Schichten der letzten 14 Tage.

        „Verpasst" ist eine veröffentlichte oder bestätigte Schicht, die KEINE
        überlappende Stempelung hat. Abgesagte Schichten zählen nicht — sie
        sollen ja nicht gearbeitet werden.
        """
        tenant_id = self._require_tenant(ctx)
        tag = heute or jetzt().date()
        ids = self._personen_im_scope(ctx, tenant_id)
        if not ids:
            return []
        von = tag - timedelta(days=_VERPASST_TAGE)
        zeiten = self._zeiten_im_fenster(tenant_id, ids, von, tag)
        offene = self._offene_bestaetigungen(tenant_id, ids)
        schichten = (
            self._db.table("personal_schichten")
            .select("id, user_id, datum, start_at, end_at, status")
            .eq("tenant_id", tenant_id)
            .in_("user_id", sorted(ids))
            .in_("status", list(_AKTIVE_SCHICHT))
            .gte("datum", von.isoformat())
            .lt("datum", tag.isoformat())
            .execute()
        ).data or []
        users = {str(u["id"]): u for u in self._users(tenant_id, ids)}
        aus: list[ZeitOffenPunkte] = []
        for uid in sorted(ids):
            u = users.get(uid)
            if u is None or str(u.get("role")) not in PLANBARE_ROLLEN:
                continue
            meine_zeiten = [r for r in zeiten if str(r["user_id"]) == uid]
            verpasst = [
                sch
                for sch in schichten
                if str(sch["user_id"]) == uid
                and not self._ueberlappt(sch, meine_zeiten)
            ]
            meine_offen = [r for r in offene if str(r["user_id"]) == uid]
            if not meine_offen and not verpasst:
                continue
            kandidaten = [als_date(r.get("start_at")) for r in meine_offen] + [
                als_date(sch.get("datum")) for sch in verpasst
            ]
            gueltig = [d for d in kandidaten if d is not None]
            aus.append(
                ZeitOffenPunkte(
                    user_id=uid,
                    full_name=u.get("full_name"),
                    unbestaetigt=len(meine_offen),
                    verpasst=len(verpasst),
                    aelteste=min(gueltig) if gueltig else None,
                )
            )
        aus.sort(key=lambda z: (str(z.full_name or "").casefold(), z.user_id))
        return aus

    def _offene_bestaetigungen(
        self, tenant_id: str, ids: set[str]
    ) -> list[dict[str, Any]]:
        """Alle abgeschlossenen, noch nicht bestätigten Stempelungen.

        OHNE Zeitfenster: eine Zeile aus dem Vormonat, die niemand bestätigt hat,
        blockiert den Lohnlauf und muss deshalb in dieser Liste stehen. Die
        14-Tage-Grenze gilt nur für „verpasst".
        """
        return (
            self._db.table("personal_zeiterfassung")
            .select("id, user_id, start_at, status")
            .eq("tenant_id", tenant_id)
            .in_("user_id", sorted(ids))
            .eq("status", "abgeschlossen")
            .execute()
        ).data or []

    @staticmethod
    def _ueberlappt(schicht: dict[str, Any], zeiten: list[dict[str, Any]]) -> bool:
        s0, s1 = als_dt(schicht.get("start_at")), als_dt(schicht.get("end_at"))
        if s0 is None or s1 is None:
            return False
        for r in zeiten:
            z0 = als_dt(r["start_at"])
            z1 = als_dt(r.get("end_at")) or jetzt()
            if z0 is not None and z0 < s1 and s0 < z1:
                return True
        return False

    # ------------------------------------------------------------------
    # Leitung: Korrektur, Nachtrag, Bestätigung
    # ------------------------------------------------------------------

    def _own_zeit(self, ctx: AuthContext, tenant_id: str, zeit_id: str) -> dict[str, Any]:
        row = load_scoped(
            self._db,
            "personal_zeiterfassung",
            zeit_id,
            tenant_id,
            columns=_SPALTEN,
            not_found=PersonalError("Zeiterfassung nicht gefunden.", status_code=404),
        )
        self._require_person_im_scope(ctx, tenant_id, str(row["user_id"]))
        return row

    def korrigieren(self, ctx: AuthContext, zeit_id: str, req: ZeitKorrektur) -> Zeiterfassung:
        tenant_id = self._require_tenant(ctx)
        vorher = self._own_zeit(ctx, tenant_id, zeit_id)
        if vorher.get("status") == "bestaetigt" and not self._ist_leitung(ctx):
            raise PersonalError("Bestätigte Zeiten ändert nur die Leitung.", status_code=403)
        start = (req.start_at or als_dt(vorher["start_at"]) or jetzt()).astimezone(UTC)
        ende_alt = als_dt(vorher.get("end_at"))
        ende = req.end_at or ende_alt
        if ende is None:
            raise PersonalError(
                "Eine laufende Zeiterfassung wird erst beendet, dann korrigiert.", status_code=409
            )
        ende = ende.astimezone(UTC)
        if ende <= start:
            raise PersonalError("Ende muss nach dem Start liegen.", status_code=422)
        if ende > jetzt() + _ZUKUNFT_TOLERANZ:
            raise PersonalError("Ende liegt in der Zukunft.", status_code=422)
        pausen = (
            [
                {
                    "start": p.start.astimezone(UTC).isoformat(),
                    "end": (p.end or ende).astimezone(UTC).isoformat(),
                }
                for p in req.pausen
            ]
            if req.pausen is not None
            else list(vorher.get("pausen") or [])
        )
        for p in pausen:
            ps, pe = als_dt(p["start"]), als_dt(p["end"])
            if ps is None or pe is None or ps < start or pe > ende or pe <= ps:
                raise PersonalError("Eine Pause liegt außerhalb der Arbeitszeit.", status_code=422)
        if req.property_id:
            self._property_im_tenant(tenant_id, req.property_id)
        neu = {
            "start_at": start.isoformat(),
            "end_at": ende.isoformat(),
            "pausen": pausen,
            "property_id": req.property_id
            if req.property_id is not None
            else vorher.get("property_id"),
            "status": "abgeschlossen",
            "bestaetigt_von": None,
            "bestaetigt_am": None,
        }
        alt = {k: vorher.get(k) for k in ("start_at", "end_at", "pausen", "property_id", "status")}
        (
            self._db.table("personal_zeiterfassung")
            .update(neu)
            .eq("id", zeit_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        self._db.table("personal_zeit_korrekturen").insert(
            {
                "tenant_id": tenant_id,
                "zeiterfassung_id": zeit_id,
                "korrigiert_von": ctx.user_id,
                "grund": req.grund,
                "alt": alt,
                "neu": {k: v for k, v in neu.items() if k in alt},
            }
        ).execute()
        log.info("personal_zeit_korrigiert", tenant_id=tenant_id, zeit_id=zeit_id, von=ctx.user_id)
        return self.eintrag(
            {**vorher, **neu}, {}, None, self._korrektur_zaehler([zeit_id]).get(zeit_id, 0)
        )

    def nachtragen(self, ctx: AuthContext, req: ZeitManuell) -> Zeiterfassung:
        """Vergessene Stempelung durch die Leitung — als Korrektur protokolliert."""
        tenant_id = self._require_tenant(ctx)
        self._require_person_im_scope(ctx, tenant_id, req.user_id)
        self._require_planbar(tenant_id, req.user_id)
        if req.end_at > jetzt() + _ZUKUNFT_TOLERANZ:
            raise PersonalError("Ende liegt in der Zukunft.", status_code=422)
        if req.property_id:
            self._property_im_tenant(tenant_id, req.property_id)
        pausen = [
            {
                "start": p.start.astimezone(UTC).isoformat(),
                "end": (p.end or req.end_at).astimezone(UTC).isoformat(),
            }
            for p in req.pausen
        ]
        row = (
            self._db.table("personal_zeiterfassung")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "user_id": req.user_id,
                    "start_at": req.start_at.astimezone(UTC).isoformat(),
                    "end_at": req.end_at.astimezone(UTC).isoformat(),
                    "pausen": pausen,
                    "quelle": "korrektur",
                    "schicht_id": req.schicht_id,
                    "property_id": req.property_id,
                    "status": "abgeschlossen",
                    "notiz": req.grund,
                }
            )
            .execute()
            .data[0]
        )
        self._db.table("personal_zeit_korrekturen").insert(
            {
                "tenant_id": tenant_id,
                "zeiterfassung_id": str(row["id"]),
                "korrigiert_von": ctx.user_id,
                "grund": req.grund,
                "alt": {},
                "neu": {"start_at": row["start_at"], "end_at": row["end_at"], "pausen": pausen},
            }
        ).execute()
        return self.eintrag(row, {}, None, 1)

    def bestaetigen(self, ctx: AuthContext, zeit_id: str) -> Zeiterfassung:
        tenant_id = self._require_tenant(ctx)
        row = self._own_zeit(ctx, tenant_id, zeit_id)
        if str(row["user_id"]) == ctx.user_id:
            raise PersonalError("Die eigene Zeit bestätigt jemand anderes.", status_code=403)
        if row.get("status") != "abgeschlossen":
            raise PersonalError(
                "Nur abgeschlossene Zeiten lassen sich bestätigen.", status_code=409
            )
        payload = {
            "status": "bestaetigt",
            "bestaetigt_von": ctx.user_id,
            "bestaetigt_am": jetzt().isoformat(),
        }
        (
            self._db.table("personal_zeiterfassung")
            .update(payload)
            .eq("id", zeit_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        return self.eintrag({**row, **payload}, {})

    def loeschen(self, ctx: AuthContext, zeit_id: str, *, grund: str) -> None:
        tenant_id = self._require_tenant(ctx)
        row = self._own_zeit(ctx, tenant_id, zeit_id)
        if len(grund.strip()) < 3:
            raise PersonalError("Löschen braucht einen Grund.", status_code=422)
        log.info(
            "personal_zeit_geloescht",
            tenant_id=tenant_id,
            zeit_id=zeit_id,
            user_id=row["user_id"],
            von=ctx.user_id,
            grund=grund[:200],
        )
        self._db.table("personal_zeiterfassung").delete().eq("id", zeit_id).eq(
            "tenant_id", tenant_id
        ).execute()

    # ------------------------------------------------------------------
    # Arbeitszeitkonto
    # ------------------------------------------------------------------

    def arbeitszeitkonto(self, ctx: AuthContext, user_id: str) -> Arbeitszeitkonto:
        tenant_id = self._require_tenant(ctx)
        self._require_person_im_scope(ctx, tenant_id, user_id)
        rows = (
            self._db.table("personal_arbeitszeitkonten")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .order("datum")
            .execute()
        ).data or []
        buchungen = [
            AzkBuchung(
                id=str(r["id"]),
                user_id=user_id,
                datum=als_date(r["datum"]),  # type: ignore[arg-type]
                minuten=int(r["minuten"]),
                grund=r["grund"],
                notiz=r.get("notiz"),
                created_at=als_dt(r.get("created_at")),
            )
            for r in rows
        ]
        return Arbeitszeitkonto(
            user_id=user_id, saldo_minuten=sum(b.minuten for b in buchungen), buchungen=buchungen
        )

    def azk_buchen(self, ctx: AuthContext, req: AzkBuchungCreate) -> Arbeitszeitkonto:
        tenant_id = self._require_tenant(ctx)
        self._require_person_im_scope(ctx, tenant_id, req.user_id)
        self._require_planbar(tenant_id, req.user_id)
        akte = self._akten(tenant_id, {req.user_id}).get(req.user_id) or {}
        if akte.get("beschaeftigungsart") == "extern":
            raise PersonalError("Externe Kräfte führen kein Arbeitszeitkonto.", status_code=422)
        minuten = req.minuten
        if req.grund in ("abbau", "auszahlung") and minuten > 0:
            minuten = -minuten
        self._db.table("personal_arbeitszeitkonten").insert(
            {
                "tenant_id": tenant_id,
                "user_id": req.user_id,
                "datum": req.datum.isoformat(),
                "minuten": minuten,
                "grund": req.grund,
                "notiz": req.notiz,
                "erstellt_von": ctx.user_id,
            }
        ).execute()
        return self.arbeitszeitkonto(ctx, req.user_id)

    # ------------------------------------------------------------------
    # Monatsabschluss
    # ------------------------------------------------------------------

    def monatsabschluesse(self, ctx: AuthContext, jahr: int, monat: int) -> list[Monatsabschluss]:
        tenant_id = self._require_tenant(ctx)
        ids = self._personen_im_scope(ctx, tenant_id)
        if not ids:
            return []
        rows = (
            self._db.table("personal_monatsabschluesse")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("jahr", jahr)
            .eq("monat", monat)
            .in_("user_id", sorted(ids))
            .execute()
        ).data or []
        return [
            Monatsabschluss(
                user_id=str(r["user_id"]),
                jahr=jahr,
                monat=monat,
                soll_minuten=int(r["soll_minuten"]),
                ist_minuten=int(r["ist_minuten"]),
                saldo_minuten=int(r["saldo_minuten"]),
                zuschlaege=dict(r.get("zuschlaege") or {}),
                freigegeben_am=als_dt(r.get("freigegeben_am")),
                freigegeben=True,
            )
            for r in rows
        ]

    def monat_abschliessen(
        self, ctx: AuthContext, req: MonatsabschlussRequest
    ) -> list[Monatsabschluss]:
        """Soll/Ist/Zuschläge je Person festschreiben und den Saldo ins AZK buchen.

        Idempotent je (Person, Monat): ein zweiter Lauf ändert nichts (UNIQUE),
        die AZK-Buchung trägt den Abschluss als `bezug_id`.
        """
        from .auswertung import AuswertungService  # noqa: PLC0415 — Zyklus vermeiden

        tenant_id = self._require_tenant(ctx)
        regeln = self._regeln(tenant_id)
        von = date(req.jahr, req.monat, 1)
        bis = date(req.jahr + (req.monat == 12), (req.monat % 12) + 1, 1) - timedelta(days=1)
        if bis >= date.today():
            raise PersonalError(
                "Ein Monat wird erst nach seinem Ende abgeschlossen.", status_code=422
            )
        scope = self._personen_im_scope(ctx, tenant_id)
        fremde = set(req.user_ids) - scope
        if fremde:
            raise PersonalError("Person nicht gefunden.", status_code=404)
        auswertung = AuswertungService(self._db).auswerten(
            ctx, von, bis, user_ids=set(req.user_ids)
        )
        aus: list[Monatsabschluss] = []
        for p in auswertung.personen:
            if p.beschaeftigungsart == "extern":
                continue
            saldo = p.ist_minuten - p.soll_minuten
            zuschlaege = {
                "nacht_min": p.nacht_minuten,
                "sonntag_min": p.sonntag_minuten,
                "feiertag_min": p.feiertag_minuten,
                "ueberstunden_min": p.ueberstunden_minuten,
                "abwesenheiten": p.abwesenheit_tage,
                "zeitzone": regeln.zeitzone,
            }
            try:
                row = (
                    self._db.table("personal_monatsabschluesse")
                    .insert(
                        {
                            "tenant_id": tenant_id,
                            "user_id": p.user_id,
                            "jahr": req.jahr,
                            "monat": req.monat,
                            "soll_minuten": p.soll_minuten,
                            "ist_minuten": p.ist_minuten,
                            "saldo_minuten": saldo,
                            "zuschlaege": zuschlaege,
                            "freigegeben_von": ctx.user_id,
                        }
                    )
                    .execute()
                    .data[0]
                )
            except APIError as exc:
                if getattr(exc, "code", None) == _UNIQUE_VERLETZUNG:
                    aus.extend(
                        m
                        for m in self.monatsabschluesse(ctx, req.jahr, req.monat)
                        if m.user_id == p.user_id
                    )
                    continue
                raise
            if saldo != 0:
                self._db.table("personal_arbeitszeitkonten").insert(
                    {
                        "tenant_id": tenant_id,
                        "user_id": p.user_id,
                        "datum": bis.isoformat(),
                        "minuten": saldo,
                        "grund": "monatsabschluss",
                        "bezug_id": str(row["id"]),
                        "erstellt_von": ctx.user_id,
                    }
                ).execute()
            aus.append(
                Monatsabschluss(
                    user_id=p.user_id,
                    jahr=req.jahr,
                    monat=req.monat,
                    soll_minuten=p.soll_minuten,
                    ist_minuten=p.ist_minuten,
                    saldo_minuten=saldo,
                    zuschlaege=zuschlaege,
                    freigegeben_am=als_dt(row.get("freigegeben_am")),
                    freigegeben=True,
                )
            )
        log.info(
            "personal_monat_abgeschlossen",
            tenant_id=tenant_id,
            jahr=req.jahr,
            monat=req.monat,
            personen=len(aus),
        )
        return aus
