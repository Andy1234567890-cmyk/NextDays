"""Professionelle Tools — der Schalter und die Massenbearbeitung.

RECHERCHE (17.09.2026, beide Quellen im Original gelesen).

Airbnb, Hilfe-Artikel 2499 „Tools für professionelles Gastgeben": in den
Kontoeinstellungen steht ein einziger Schalter, „Professionelle Tools nutzen".
Er gibt Multi-Kalender, Belegungssteuer, Einblicke, Reihen von Regeln,
zusätzliche Gebühren und Aufgaben frei.

Booking.com, Lösungsseite „Gruppen-Extranet": kein Schalter, dafür ein
Kriterium — „Sie müssen mehr als eine Unterkunft auf Booking.com verwalten" —
und als Herzstück die Massenbearbeitung: „Ganz gleich, ob Sie die
Check-in-Zeiten anpassen, Richtlinien aktualisieren oder Angebote für
verschiedene Einträge ändern müssen."

DER ENTSCHEIDENDE ENTWURFSGEDANKE: die Massenbearbeitung legt KEINEN eigenen
Schreibweg an. Sie ruft dieselben Dienste auf wie die Einzelbearbeitung
(`PropertiesService.update`, `RatesService.update`) und bekommt dadurch deren
Nachpflege geschenkt — Content-Sync zu den Portalen, Verfügbarkeits-Spiegelung,
Währungsprüfung, Eigentums-Prüfung der Buchungsbedingung. Ein zweiter, direkter
Weg in die Tabellen wäre der klassische Wurzel-1-Fehler: er schreibt den Wert
und vergisst alles, was daran hängt — und niemand merkt es, weil die Zeile ja
richtig aussieht.

FAIL-CLOSED (Wurzel 5): ist der Schalter aus, wird die Massenbearbeitung
serverseitig abgelehnt. Der Riegel sitzt nicht in der Oberfläche — die ist nur
die Bequemlichkeit, nicht der Schutz.
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.properties.errors import PropertyError
from src.features.properties.schemas import PropertyUpdate
from src.features.properties.service import PropertiesService
from src.features.rates.schemas import RatePlanUpdate
from src.features.rates.service import RateError, RatesService

from .schemas import (
    MINDEST_OBJEKTE,
    Fehlschlag,
    Massenaenderung,
    MassenErgebnis,
    Massenfeld,
    ProfiTools,
)

log = get_logger("nextdays.pro_tools")

# Welcher Schlüssel im `type_attributes.availability`-Blob zu welchem Feld
# gehört. Die Namen sind vorgegeben — der Channex-Content-Sync liest genau
# diese (`channel_manager/common.py _availability_settings`), ein eigener Name
# hier wäre ein Wert, der nirgends ankommt.
_AVAILABILITY_SCHLUESSEL = {
    Massenfeld.hoechstaufenthalt: "maxStay",
    Massenfeld.vorlaufzeit: "cutOffDays",
    Massenfeld.buchungsfenster: "maxDayAdvance",
}

# Obergrenze der Objektzählung. Sie dient nur der Anzeige („du hast N Objekte")
# — ein Betrieb mit 5000 Objekten soll dafür nicht 5000 Zeilen in den Speicher
# holen (Wurzel 8).
MAX_ZAEHLUNG = 2000

# Felder, die am Preisplan hängen statt am Objekt.
_AM_PREISPLAN = {Massenfeld.mindestaufenthalt, Massenfeld.stornobedingung}


class ProToolsError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class ProToolsService:
    def __init__(
        self,
        db: Client,
        *,
        properties: PropertiesService,
        rates: RatesService,
    ) -> None:
        self._db = db
        self._properties = properties
        self._rates = rates

    # -- Der Schalter --------------------------------------------------------

    def stand(self, ctx: AuthContext) -> ProfiTools:
        tenant_id = self._tenant(ctx)
        rows = (
            self._db.table("tenants")
            .select("professional_tools")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            raise ProToolsError("Betrieb nicht gefunden.", status_code=404)
        return ProfiTools(
            aktiv=bool(rows[0].get("professional_tools")),
            objekte=self._objektzahl(tenant_id),
        )

    def setzen(self, ctx: AuthContext, aktiv: bool) -> ProfiTools:
        """Schalter umlegen.

        Einschalten geht erst ab zwei Objekten (Bookings Kriterium) —
        andernfalls gäbe es nichts, worauf eine Massenänderung wirken könnte,
        und ein Schalter ohne Gegenstand ist eine Attrappe. AUSschalten ist
        immer erlaubt: ein Weg zurück, den eine Bedingung versperrt, ist eine
        Falle (Wurzel 1 — der Gegenzustand muss erreichbar bleiben).
        """
        tenant_id = self._tenant(ctx)
        objekte = self._objektzahl(tenant_id)
        if aktiv and objekte < MINDEST_OBJEKTE:
            raise ProToolsError(
                "Die professionellen Tools arbeiten über mehrere Objekte "
                f"hinweg — dafür braucht es mindestens {MINDEST_OBJEKTE}.",
                status_code=422,
            )
        self._db.table("tenants").update({"professional_tools": aktiv}).eq(
            "id", tenant_id
        ).execute()
        log.info("profi_tools_gesetzt", tenant_id=tenant_id, aktiv=aktiv)
        return ProfiTools(aktiv=aktiv, objekte=objekte)

    # -- Massenbearbeitung ---------------------------------------------------

    def massenbearbeiten(
        self, ctx: AuthContext, req: Massenaenderung
    ) -> MassenErgebnis:
        tenant_id = self._tenant(ctx)
        if not self.stand(ctx).aktiv:
            raise ProToolsError(
                "Die professionellen Tools sind nicht eingeschaltet.",
                status_code=403,
            )
        # Der Anfrage nicht vertrauen (Wurzel 3): welche der gesendeten
        # Kennungen wirklich zu DIESEM Betrieb gehören, entscheidet die DB,
        # nicht der Client. Alles andere wird als Fehlschlag gemeldet, nicht
        # still verworfen — sonst meldet die Oberfläche „20 geändert", während
        # acht Objekte nie angefasst wurden.
        eigene = self._eigene_objekte(tenant_id, req.property_ids)
        ergebnis = MassenErgebnis(
            geaendert=[],
            unveraendert=[],
            fehlgeschlagen=[
                Fehlschlag(property_id=pid, grund="Objekt nicht gefunden.")
                for pid in req.property_ids
                if pid not in eigene
            ],
        )
        for pid in req.property_ids:
            if pid not in eigene:
                continue
            self._ein_objekt(ctx, pid, req, ergebnis)
        log.info(
            "massenbearbeitung",
            tenant_id=tenant_id,
            feld=req.feld.value,
            geaendert=len(ergebnis.geaendert),
            unveraendert=len(ergebnis.unveraendert),
            fehlgeschlagen=len(ergebnis.fehlgeschlagen),
        )
        return ergebnis

    def _ein_objekt(
        self,
        ctx: AuthContext,
        pid: str,
        req: Massenaenderung,
        ergebnis: MassenErgebnis,
    ) -> None:
        """Ein Objekt ändern und das Ergebnis eintragen.

        Ein Fehlschlag an EINEM Objekt darf die übrigen nicht mitreißen: wer
        zwanzig Objekte umstellt und am dritten scheitert, bekommt sonst
        siebzehn unbearbeitete zurück und keine Auskunft darüber, welche.
        Gefangen wird deshalb genau das, was diese beiden Dienste als fachliche
        Absage werfen — nicht `Exception` (Wurzel 5).
        """
        try:
            geaendert = (
                self._preisplan_setzen(ctx, pid, req)
                if req.feld in _AM_PREISPLAN
                else self._objekt_setzen(ctx, pid, req)
            )
        except (PropertyError, RateError) as exc:
            ergebnis.fehlgeschlagen.append(
                Fehlschlag(property_id=pid, grund=exc.message)
            )
            return
        (ergebnis.geaendert if geaendert else ergebnis.unveraendert).append(pid)

    def _objekt_setzen(
        self, ctx: AuthContext, pid: str, req: Massenaenderung
    ) -> bool:
        """Höchstaufenthalt / Vorlaufzeit / Buchungsfenster am Objekt.

        Der `availability`-Blob wird GELESEN, ergänzt und zurückgeschrieben.
        Ihn neu aufzubauen würde die übrigen Werte darin löschen — Wurzel 1 in
        Reinform: Mindestaufenthalts-Typ und gesperrte Check-in-Tage wären weg,
        ohne dass jemand sie angefasst hätte.
        """
        schluessel = _AVAILABILITY_SCHLUESSEL[req.feld]
        attrs = self._attribute(pid)
        verfuegbarkeit = dict(attrs.get("availability") or {})
        if verfuegbarkeit.get(schluessel) == req.zahl:
            return False
        verfuegbarkeit[schluessel] = req.zahl
        self._properties.update(
            ctx,
            pid,
            PropertyUpdate(type_attributes={**attrs, "availability": verfuegbarkeit}),
        )
        return True

    def _preisplan_setzen(
        self, ctx: AuthContext, pid: str, req: Massenaenderung
    ) -> bool:
        """Mindestaufenthalt / Stornierungsbedingung am Basis-Preisplan.

        „Basis-Plan" ist der Plan ohne Ableitung — dieselbe Wahl, die der
        Objekt-Editor trifft (`lib/preise.ts`). Ein abgeleiteter Plan übernimmt
        seine Werte ohnehin vom Eltern-Plan; ihn zu beschreiben wäre eine
        Änderung, die wieder überschrieben wird.
        """
        plan = self._basisplan(pid)
        if plan is None:
            raise RateError("Objekt hat keinen Preisplan.", status_code=404)
        if req.feld is Massenfeld.mindestaufenthalt:
            if plan.get("min_stay") == req.zahl:
                return False
            patch = RatePlanUpdate(min_stay=req.zahl)
        else:
            if plan.get("booking_condition_id") == req.auswahl:
                return False
            patch = RatePlanUpdate(booking_condition_id=req.auswahl)
        self._rates.update(ctx, plan["id"], patch)
        return True

    # -- intern --------------------------------------------------------------

    @staticmethod
    def _tenant(ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise ProToolsError("Kein Betrieb im Kontext.", status_code=403)
        return ctx.tenant_id

    def _objektzahl(self, tenant_id: str) -> int:
        rows = (
            self._db.table("properties")
            .select("id")
            .eq("tenant_id", tenant_id)
            .limit(MAX_ZAEHLUNG)
            .execute()
        ).data or []
        return len(rows)

    def _eigene_objekte(self, tenant_id: str, ids: list[str]) -> set[str]:
        rows = (
            self._db.table("properties")
            .select("id")
            .eq("tenant_id", tenant_id)
            .in_("id", ids)
            .execute()
        ).data or []
        return {str(r["id"]) for r in rows}

    def _attribute(self, pid: str) -> dict[str, Any]:
        rows = (
            self._db.table("properties")
            .select("type_attributes")
            .eq("id", pid)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise PropertyError("Objekt nicht gefunden.", status_code=404)
        return dict(rows[0].get("type_attributes") or {})

    def _basisplan(self, pid: str) -> dict | None:
        rows = (
            self._db.table("rate_plans")
            .select("id, min_stay, booking_condition_id, derived_from_rate_plan_id")
            .eq("property_id", pid)
            .execute()
        ).data or []
        if not rows:
            return None
        eigen = [r for r in rows if not r.get("derived_from_rate_plan_id")]
        return eigen[0] if eigen else rows[0]
