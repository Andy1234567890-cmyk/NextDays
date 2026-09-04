"""KI im Dienstplan: Bedarfsprognose, Autoplanung, Assistent (0546, Vertrag §2.3).

Die Arbeitsteilung ist der Kern dieses Moduls und keine Feinheit:

* **Die Prognose rechnet der SERVER.** `stunden = basis_wert / wert` je Bereich
  und Tag, geklemmt an `min/max_stunden_tag`. Gemini bekommt Eingaben, Ausgabe
  und Historie und liefert nur die `erklaerung`. Ein Sprachmodell, das die ZAHL
  liefert, liefert bei zweimal derselben Woche zwei verschiedene Zahlen — und
  niemand könnte sagen, welche stimmt.
* **Die Zuteilung rechnet der SOLVER** (`autoplan_solver.py`, OR-Tools CP-SAT).
  Ruhezeit und Doppelbelegung sind harte Bedingungen; Gemini erklärt hinterher
  die Unterschiede der Varianten.
* **Der Assistent** formuliert eine Antwort aus den Plandaten. Sein Kontext
  enthält KEINEN Lohn und KEINE Kennungen (Wurzel 3/§4.3): eine Frage nach dem
  Samstagsdienst ist kein Grund, Gehälter an einen Fremddienst zu geben.

Ohne Vertex-Konfiguration (`is_configured is False`) bleibt die Prognose eine
Prognose mit `erklaerung=None` und die Autoplanung ein fertiger Plan ohne
Erklärung — beides KEIN Fehler. Nur der Assistent antwortet 503, weil er ohne
Sprachmodell nichts zu sagen hat.

Alle drei prüfen `ki_nutzung.deckel_pruefen` VOR dem Aufruf und buchen die
Nutzung danach; jede erzeugte Ausgabe trägt `content_origin='ki'`.
"""

from __future__ import annotations

import json
import math
from datetime import UTC, date, datetime, time, timedelta
from typing import Any

from supabase import Client

from src.core.ki import KiError, VertexClient
from src.core.security import AuthContext
from src.features.site_config import ki_nutzung

from . import autoplan_solver as solver
from . import regelwerk as rw
from ._base import (
    PLANBARE_ROLLEN,
    PersonalBase,
    PersonalError,
    als_date,
    als_dt,
    als_float,
    als_time,
    jetzt,
    log,
)
from .bedarf_schemas import KennzahlenResponse
from .kennzahlen import KennzahlenService
from .ki_schemas import (
    HISTORIE_WOCHEN,
    MAX_ERKLAERUNG_ZEICHEN,
    AssistentAntwort,
    AssistentRequest,
    AutoplanRequest,
    KiStatus,
    Planungslauf,
    Prognose,
    PrognoseAusgabe,
    PrognoseAusgabeTag,
    PrognoseBereich,
    PrognoseEingaben,
    PrognoseEingabeTag,
    Variante,
    VarianteKennzahlen,
    VarianteSchicht,
    VerworfenResponse,
)
from .schemas import BedarfResponse

# Die drei Funktionsnamen für `site_ai_usage` (0546). Sie stehen an ZWEI
# Stellen und immer gemeinsam: hier UND in `site_config.ki_nutzung.FUNKTIONEN`
# (dort ist auch der DB-Check gespiegelt). Fehlt einer, steigt `_schreiben`
# still aus und der Tagesdeckel wird zur Attrappe.
FUNKTION_PROGNOSE = "personal_prognose"
FUNKTION_AUTOPLAN = "personal_autoplan"
FUNKTION_ASSISTENT = "personal_assistent"

_AKTIVE_SCHICHT = ("entwurf", "veroeffentlicht", "bestaetigt")
# Eine Kraft deckt acht Stunden am Tag — die Umrechnung Stunden → Personen.
_STUNDEN_JE_KRAFT = 8

_SYSTEM_PROGNOSE = (
    "Du bist Planungsassistent eines Ferien- und Hotelbetriebs. Du bekommst die "
    "Buchungslage einer Woche, den daraus GERECHNETEN Personalbedarf und die "
    "Historie der letzten Wochen. Erkläre in höchstens sechs Sätzen, welche Tage "
    "auffallen und warum, und benenne Muster aus der Historie. Erfinde keine "
    "Zahlen und ändere die gerechneten Werte nicht — du erklärst sie nur. "
    "Antworte auf Deutsch, ohne Anrede und ohne Aufzählungszeichen."
)
_SYSTEM_AUTOPLAN = (
    "Du bist Planungsassistent eines Ferien- und Hotelbetriebs. Du bekommst "
    "mehrere Planvarianten mit ihren Kennzahlen (Stunden, Fairness, erfüllte "
    "Wunschzeiten, unbesetzte Dienste). Erkläre in höchstens fünf Sätzen, worin "
    "sich die Varianten unterscheiden und für welchen Zweck welche taugt. "
    "Erfinde keine Zahlen. Antworte auf Deutsch, ohne Anrede."
)
_SYSTEM_ASSISTENT = (
    "Du bist Assistent im Dienstplan eines Ferien- und Hotelbetriebs. Antworte "
    "NUR aus dem mitgegebenen Kontext. Fehlt eine Angabe, sage das ausdrücklich "
    "statt zu raten. Nenne keine Löhne und keine internen Kennungen. Antworte "
    "kurz und auf Deutsch."
)


class KiPlanungService(PersonalBase):
    """Prognose, Autoplanung und Assistent — je ein Vertex-Aufruf, je ein Zähler."""

    def __init__(self, service_client: Client, *, client: VertexClient | None = None) -> None:
        super().__init__(service_client)
        self._client = client or VertexClient()

    # ==================================================================
    # Status
    # ==================================================================

    def status(self, ctx: AuthContext) -> KiStatus:
        tenant_id = self._require_tenant(ctx)
        return KiStatus(
            konfiguriert=self._client.is_configured,
            verbrauch_heute=ki_nutzung.verbrauch_heute(self._db, tenant_id),
            tageslimit=ki_nutzung.tageslimit(),
            solver="ortools",
        )

    # ==================================================================
    # Prognose
    # ==================================================================

    def prognose_erzeugen(self, ctx: AuthContext, woche: date) -> Prognose:
        tenant_id = self._require_tenant(ctx)
        woche_start = _montag(woche)
        bis = woche_start + timedelta(days=6)
        annahmen = self._annahmen(tenant_id)
        if not annahmen:
            raise PersonalError(
                "Es sind keine Produktivitätsannahmen hinterlegt. Ohne sie lässt sich "
                "kein Bedarf rechnen (Personal → Einstellungen → Produktivität).",
                status_code=422,
                details={"code": "produktivitaet_fehlt"},
            )
        kennzahlen = KennzahlenService(self._db).kennzahlen(ctx, woche_start, bis)
        eingaben = PrognoseEingaben(
            tage=[
                PrognoseEingabeTag(
                    datum=t.datum,
                    anreisen=t.anreisen,
                    abreisen=t.abreisen,
                    gaeste_im_haus=t.gaeste_im_haus,
                    einheiten_belegt=t.einheiten_belegt,
                    einheiten_gesamt=t.einheiten_gesamt,
                    feiertag=t.feiertag,
                    umsatz_plan_minor=t.umsatz_plan_minor,
                )
                for t in kennzahlen.tage
            ],
            historie_wochen=HISTORIE_WOCHEN,
        )
        max_tagesstunden = als_float((self._regeln_row(tenant_id) or {}).get("max_tagesstunden"))
        ausgabe = _prognose_rechnen(eingaben, annahmen, kennzahlen, max_tagesstunden)
        erklaerung, meta = self._erklaerung_prognose(ctx, tenant_id, eingaben, ausgabe, woche_start)
        zeile = (
            self._db.table("personal_prognosen")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "woche_start": woche_start.isoformat(),
                    "status": "fertig",
                    "eingaben": json.loads(eingaben.model_dump_json()),
                    "ausgabe": json.loads(ausgabe.model_dump_json()),
                    "erklaerung": erklaerung,
                    "content_origin": "ki",
                    "modell": meta.get("modell"),
                    "region": meta.get("region"),
                    "tokens_ein": meta.get("tokens_ein"),
                    "tokens_aus": meta.get("tokens_aus"),
                    "dauer_ms": meta.get("dauer_ms"),
                    "erstellt_von": ctx.user_id,
                }
            )
            .execute()
        ).data[0]
        return _prognose(zeile)

    def prognosen(self, ctx: AuthContext, woche: date) -> list[Prognose]:
        tenant_id = self._require_tenant(ctx)
        rows = (
            self._db.table("personal_prognosen")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("woche_start", _montag(woche).isoformat())
            .order("created_at", desc=True)
            .execute()
        ).data or []
        return [_prognose(r) for r in rows]

    def prognose_uebernehmen(self, ctx: AuthContext, prognose_id: str) -> BedarfResponse:
        """Ausgabe als `personal_bedarf` (`quelle='prognose'`) schreiben.

        Gegenzustand (Wurzel 1): ÄLTERE Prognose-Zeilen der Woche fallen weg.
        Ohne das Aufräumen läge nach der zweiten Übernahme der doppelte Bedarf
        in der Woche und der Plan verlangte doppelt so viele Kräfte.

        Idempotent (Wurzel 2): dieselbe Prognose zweimal übernommen ergibt
        denselben Bestand — der zweite Lauf löscht die Zeilen des ersten und
        legt sie neu an, `vorhanden` zählt sie.
        """
        tenant_id = self._require_tenant(ctx)
        rows = (
            self._db.table("personal_prognosen")
            .select("*")
            .eq("id", prognose_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise PersonalError("Prognose nicht gefunden.", status_code=404)
        zeile = rows[0]
        woche_start = als_date(zeile["woche_start"]) or date.today()
        bis = woche_start + timedelta(days=6)
        ausgabe = PrognoseAusgabe.model_validate(zeile.get("ausgabe") or {})
        alt = (
            self._db.table("personal_bedarf")
            .select("id, prognose_id")
            .eq("tenant_id", tenant_id)
            .eq("quelle", "prognose")
            .gte("datum", woche_start.isoformat())
            .lte("datum", bis.isoformat())
            .execute()
        ).data or []
        vorhanden = sum(1 for r in alt if str(r.get("prognose_id") or "") == prognose_id)
        for r in alt:
            self._db.table("personal_bedarf").delete().eq("id", str(r["id"])).execute()
        payloads: list[dict[str, Any]] = []
        for tag in ausgabe.tage:
            for bereich in tag.bereiche:
                if bereich.anzahl <= 0:
                    continue
                payloads.append(
                    {
                        "tenant_id": tenant_id,
                        "arbeitsbereich_id": bereich.arbeitsbereich_id,
                        "property_id": None,
                        "wochentag": None,
                        "datum": tag.datum.isoformat(),
                        # Das Fenster kommt aus der Regelarbeitszeit, nicht aus
                        # der Prognose: sie sagt WIE VIEL, nicht WANN.
                        "zeit_von": "08:00",
                        "zeit_bis": _bis_zeit(bereich.stunden, bereich.anzahl),
                        "anzahl": bereich.anzahl,
                        "quelle": "prognose",
                        "prognose_id": prognose_id,
                        "erstellt_von": ctx.user_id,
                    }
                )
        if payloads:
            self._db.table("personal_bedarf").insert(payloads).execute()
        (
            self._db.table("personal_prognosen")
            .update({"uebernommen_am": jetzt().isoformat()})
            .eq("id", prognose_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        return BedarfResponse(
            woche_start=woche_start, angelegt=len(payloads), vorhanden=vorhanden
        )

    def _annahmen(self, tenant_id: str) -> dict[str, dict[str, Any]]:
        rows = (
            self._db.table("personal_produktivitaet")
            .select("arbeitsbereich_id, basis, wert, min_stunden_tag, max_stunden_tag")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        return {str(r["arbeitsbereich_id"]): r for r in rows}

    def _erklaerung_prognose(  # noqa: PLR0913 — ein Prompt aus allen Quellen
        self,
        ctx: AuthContext,
        tenant_id: str,
        eingaben: PrognoseEingaben,
        ausgabe: PrognoseAusgabe,
        woche_start: date,
    ) -> tuple[str | None, dict[str, Any]]:
        """Erklärung von Gemini — oder `(None, {})` ohne Vertex.

        Ohne Konfiguration ist das KEIN Fehler: die Prognose ist gerechnet und
        vollständig, es fehlt nur der erläuternde Text. Ein 503 hier würde eine
        fertige Zahl wegwerfen, weil ein Kommentar fehlt.
        """
        if not self._client.is_configured:
            return None, {}
        historie = self._historie(tenant_id, woche_start)
        prompt = (
            "Buchungslage und gerechneter Bedarf der Woche "
            f"ab {woche_start.isoformat()}:\n"
            f"{eingaben.model_dump_json()}\n\n"
            f"Gerechneter Bedarf:\n{ausgabe.model_dump_json()}\n\n"
            f"Historie (Plan-/Ist-Minuten je Tag, letzte {HISTORIE_WOCHEN} Wochen):\n"
            f"{json.dumps(historie, ensure_ascii=False)}"
        )
        return self._aufrufen(ctx, tenant_id, FUNKTION_PROGNOSE, _SYSTEM_PROGNOSE, prompt)

    def _historie(self, tenant_id: str, woche_start: date) -> list[dict[str, Any]]:
        """Plan-/Ist-Minuten je Tag der letzten Wochen — die Muster im Prompt."""
        von = woche_start - timedelta(weeks=HISTORIE_WOCHEN)
        bis = woche_start - timedelta(days=1)
        schichten = (
            self._db.table("personal_schichten")
            .select("datum, start_at, end_at, pause_min, status")
            .eq("tenant_id", tenant_id)
            .gte("datum", von.isoformat())
            .lte("datum", bis.isoformat())
            .execute()
        ).data or []
        plan: dict[str, int] = {}
        for s in schichten:
            if str(s.get("status") or "") not in _AKTIVE_SCHICHT:
                continue
            start, ende = als_dt(s.get("start_at")), als_dt(s.get("end_at"))
            tag = als_date(s.get("datum"))
            if start is None or ende is None or tag is None:
                continue
            key = tag.isoformat()
            plan[key] = plan.get(key, 0) + rw.netto_minuten(
                start, ende, int(s.get("pause_min") or 0)
            )
        return [{"datum": k, "plan_minuten": v} for k, v in sorted(plan.items())]

    # ==================================================================
    # Autoplanung
    # ==================================================================

    def autoplan(self, ctx: AuthContext, woche: date, req: AutoplanRequest) -> Planungslauf:
        tenant_id = self._require_tenant(ctx)
        woche_start = _montag(woche)
        bis = woche_start + timedelta(days=6)
        regeln = self._regeln(tenant_id)
        regeln_row = self._regeln_row(tenant_id) or {}
        huellen = self._huellen(tenant_id, woche_start, bis, nur_offene=req.nur_offene)
        if not huellen:
            raise PersonalError(
                "Für diese Woche ist kein Bedarf hinterlegt — es gibt nichts zu verteilen.",
                status_code=422,
                details={"code": "bedarf_fehlt"},
            )
        personen = self._solver_personen(ctx, tenant_id, woche_start, bis)
        if not personen:
            raise PersonalError(
                "Keine planbaren Personen im Zugriff.",
                status_code=422,
                details={"code": "personen_fehlen"},
            )
        bestehende = self._bestehende_bloecke(tenant_id, woche_start, bis)
        solver_regeln = _solver_regeln(regeln, regeln_row)
        varianten: list[Variante] = []
        dauer_ms = 0
        # Variante 1 mit den Vertragsgewichten, 2/3 mit ±1 auf Wunsch/Fairness
        # und eigenem Seed — sonst liefert derselbe Solver dreimal denselben
        # Plan und der „Variantenvergleich" wäre eine Attrappe.
        verschiebungen: list[dict[str, int]] = [
            {},
            {"wunsch": 1, "fairness": -1},
            {"wunsch": -1, "fairness": 1},
        ]
        for i in range(req.varianten):
            ergebnis = solver.planen(
                huellen=huellen,
                personen=personen,
                bestehende=bestehende,
                regeln=solver_regeln,
                planungstyp=req.planungstyp,
                zeitlimit_s=req.zeitlimit_s,
                seed=i + 1,
                gewicht_verschiebung=verschiebungen[i],
            )
            dauer_ms += ergebnis.dauer_ms
            varianten.append(_variante(chr(ord("A") + i), ergebnis, huellen))
        erklaerung, _ = self._erklaerung_autoplan(ctx, tenant_id, varianten, req.planungstyp)
        zeile = (
            self._db.table("personal_planungslaeufe")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "woche_start": woche_start.isoformat(),
                    "planungstyp": req.planungstyp,
                    "status": "fertig",
                    "solver": "ortools-cpsat",
                    "varianten": [json.loads(v.model_dump_json()) for v in varianten],
                    "erklaerung": erklaerung,
                    "content_origin": "ki",
                    "dauer_ms": dauer_ms,
                    "erstellt_von": ctx.user_id,
                }
            )
            .execute()
        ).data[0]
        return _lauf(zeile)

    def planungslaeufe(self, ctx: AuthContext, woche: date) -> list[Planungslauf]:
        tenant_id = self._require_tenant(ctx)
        rows = (
            self._db.table("personal_planungslaeufe")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("woche_start", _montag(woche).isoformat())
            .order("created_at", desc=True)
            .execute()
        ).data or []
        return [_lauf(r) for r in rows]

    def lauf_uebernehmen(
        self, ctx: AuthContext, lauf_id: str, variante: int
    ) -> BedarfResponse:
        """Eine Variante als ENTWURF-Schichten anlegen (`quelle='autoplan'`).

        Entwurf und nicht veröffentlicht: die Freigabe ist eine Entscheidung
        des Betriebs, nicht des Solvers. `planungslauf_id` bleibt an jeder
        Schicht — daran hängt der Rückweg (`verwerfen` löscht genau diese).
        """
        tenant_id = self._require_tenant(ctx)
        zeile = self._lauf_row(tenant_id, lauf_id)
        laeufe = _varianten(zeile)
        if variante >= len(laeufe):
            raise PersonalError(
                "Diese Variante gibt es nicht.",
                status_code=422,
                details={"code": "variante_unbekannt"},
            )
        woche_start = als_date(zeile["woche_start"]) or date.today()
        gewaehlt = laeufe[variante]
        vorhanden = len(self._lauf_schichten(tenant_id, lauf_id))
        payloads = [
            {
                "tenant_id": tenant_id,
                "user_id": s.user_id,
                "datum": s.start_at.astimezone(UTC).date().isoformat(),
                "start_at": s.start_at.isoformat(),
                "end_at": s.end_at.isoformat(),
                "pause_min": s.pause_min,
                "arbeitsbereich_id": s.arbeitsbereich_id,
                "property_id": s.property_id,
                "status": "entwurf",
                "quelle": "autoplan",
                "planungslauf_id": lauf_id,
                "erstellt_von": ctx.user_id,
            }
            for s in gewaehlt.schichten
        ]
        if payloads and not vorhanden:
            self._db.table("personal_schichten").insert(payloads).execute()
        (
            self._db.table("personal_planungslaeufe")
            .update(
                {
                    "status": "uebernommen",
                    "gewaehlte_variante": variante,
                    "uebernommen_am": jetzt().isoformat(),
                }
            )
            .eq("id", lauf_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        return BedarfResponse(
            woche_start=woche_start,
            angelegt=0 if vorhanden else len(payloads),
            vorhanden=vorhanden,
        )

    def lauf_verwerfen(self, ctx: AuthContext, lauf_id: str) -> VerworfenResponse:
        """Nur die ENTWURF-Schichten DIESES Laufs löschen.

        Nicht die veröffentlichten (jemand hat sie freigegeben) und nicht die
        eines anderen Laufs — sonst räumt ein Verwerfen fremde Arbeit weg
        (dieselbe Klasse wie ein ungescoptes `delete`).
        """
        tenant_id = self._require_tenant(ctx)
        self._lauf_row(tenant_id, lauf_id)
        eigene = [
            r for r in self._lauf_schichten(tenant_id, lauf_id) if r.get("status") == "entwurf"
        ]
        for r in eigene:
            (
                self._db.table("personal_schichten")
                .delete()
                .eq("id", str(r["id"]))
                .eq("tenant_id", tenant_id)
                .execute()
            )
        (
            self._db.table("personal_planungslaeufe")
            .update({"status": "fertig", "gewaehlte_variante": None, "uebernommen_am": None})
            .eq("id", lauf_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        return VerworfenResponse(geloescht=len(eigene))

    def _lauf_row(self, tenant_id: str, lauf_id: str) -> dict[str, Any]:
        rows = (
            self._db.table("personal_planungslaeufe")
            .select("*")
            .eq("id", lauf_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise PersonalError("Planungslauf nicht gefunden.", status_code=404)
        return rows[0]

    def _lauf_schichten(self, tenant_id: str, lauf_id: str) -> list[dict[str, Any]]:
        return (
            self._db.table("personal_schichten")
            .select("id, status")
            .eq("tenant_id", tenant_id)
            .eq("planungslauf_id", lauf_id)
            .execute()
        ).data or []

    def _erklaerung_autoplan(
        self, ctx: AuthContext, tenant_id: str, varianten: list[Variante], typ: str
    ) -> tuple[str | None, dict[str, Any]]:
        if not self._client.is_configured or len(varianten) < 2:
            # Eine einzige Variante hat keine Unterschiede zu erklären — ein
            # Vertex-Aufruf dafür kostet Geld für einen Text ohne Inhalt.
            return None, {}
        prompt = (
            f"Planungstyp: {typ}\nVarianten mit Kennzahlen:\n"
            + "\n".join(
                f"{v.name}: {v.kennzahlen.model_dump_json()}, "
                f"{len(v.schichten)} zugeteilte Dienste"
                for v in varianten
            )
        )
        return self._aufrufen(ctx, tenant_id, FUNKTION_AUTOPLAN, _SYSTEM_AUTOPLAN, prompt)

    # ==================================================================
    # Solver-Eingaben
    # ==================================================================

    def _huellen(
        self, tenant_id: str, von: date, bis: date, *, nur_offene: bool
    ) -> list[solver.Huelle]:
        """`personal_bedarf` zu konkreten Hüllen expandieren (Vorlage × Tag × Anzahl).

        Wie in den Kennzahlen ersetzt eine Zeile mit `datum` an ihrem Tag die
        Wochentag-Vorlagen desselben Bereichs (Wurzel 1) — dieselbe Regel, damit
        Plan und Kennzahlen nicht verschieden zählen.
        """
        rows = (
            self._db.table("personal_bedarf")
            .select(
                "id, arbeitsbereich_id, property_id, wochentag, datum, zeit_von, zeit_bis, anzahl"
            )
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        zone = str((self._regeln_row(tenant_id) or {}).get("zeitzone") or "UTC")
        tage = [von + timedelta(days=i) for i in range((bis - von).days + 1)]
        uebersteuert = {
            (str(r["arbeitsbereich_id"]), als_date(r.get("datum")))
            for r in rows
            if r.get("datum")
        }
        bestand = self._bestehende_bloecke(tenant_id, von, bis) if nur_offene else []
        huellen: list[solver.Huelle] = []
        for r in rows:
            bereich = str(r["arbeitsbereich_id"])
            datum = als_date(r.get("datum"))
            ziel_tage = (
                [datum]
                if datum is not None
                else [
                    t
                    for t in tage
                    if r.get("wochentag") is not None
                    and t.weekday() == int(r["wochentag"])
                    and (bereich, t) not in uebersteuert
                ]
            )
            for tag in ziel_tage:
                if tag is None or not von <= tag <= bis:
                    continue
                start, ende = _fenster(tag, r.get("zeit_von"), r.get("zeit_bis"), zone)
                if start is None or ende is None:
                    continue
                schon = (
                    sum(
                        1
                        for b in bestand
                        if b.start_at == start and b.end_at == ende
                    )
                    if nur_offene
                    else 0
                )
                for n in range(max(0, int(r.get("anzahl") or 0) - schon)):
                    huellen.append(
                        solver.Huelle(
                            id=f"{r['id']}:{tag.isoformat()}:{n}",
                            datum=tag,
                            start_at=start,
                            end_at=ende,
                            pause_min=0,
                            arbeitsbereich_id=bereich,
                            property_id=(
                                str(r["property_id"]) if r.get("property_id") else None
                            ),
                            bedarf_id=str(r["id"]),
                        )
                    )
        return huellen

    def _solver_personen(
        self, ctx: AuthContext, tenant_id: str, von: date, bis: date
    ) -> list[solver.Person]:
        ids = self._personen_im_scope(ctx, tenant_id)
        users = {
            str(u["id"]): u
            for u in self._users(tenant_id, ids)
            if str(u.get("role")) in PLANBARE_ROLLEN and not u.get("deactivated_at")
        }
        if not users:
            return []
        akten = self._solver_akten(tenant_id, set(users))
        quali = self._qualifikationen(tenant_id, set(users))
        abwesend = self._abwesenheits_tage(tenant_id, set(users), von, bis)
        zone = str((self._regeln_row(tenant_id) or {}).get("zeitzone") or "UTC")
        fenster = self._verfuegbarkeits_fenster(tenant_id, set(users), von, bis, zone)
        heute = date.today()
        personen: list[solver.Person] = []
        for uid in sorted(users):
            akte = akten.get(uid) or {}
            geburtstag = als_date(akte.get("geburtsdatum"))
            wochenstunden = als_float(akte.get("wochenstunden"))
            personen.append(
                solver.Person(
                    user_id=uid,
                    qualifikationen=quali.get(uid, {}).get("stufen", {}),
                    quali_objekte=quali.get(uid, {}).get("objekte", {}),
                    soll_minuten_woche=(
                        round(wochenstunden * 60) if wochenstunden else None
                    ),
                    stundenlohn_minor=(
                        int(akte["stundenlohn_minor"])
                        if akte.get("stundenlohn_minor") is not None
                        else None
                    ),
                    currency=akte.get("currency"),
                    verdienstgrenze_minor=(
                        int(akte["verdienstgrenze_minor"])
                        if akte.get("verdienstgrenze_minor") is not None
                        else None
                    ),
                    alter=_alter(geburtstag, heute),
                    abwesenheits_tage=frozenset(abwesend.get(uid, set())),
                    gesperrte_fenster=tuple(fenster.get((uid, "gesperrt"), [])),
                    wunsch_fenster=tuple(fenster.get((uid, "wunsch"), [])),
                )
            )
        return personen

    def _solver_akten(self, tenant_id: str, ids: set[str]) -> dict[str, dict[str, Any]]:
        if not ids:
            return {}
        rows = (
            self._db.table("personal_akten")
            .select(
                "user_id, beschaeftigungsart, firma_id, wochenstunden, stundenlohn_minor, "
                "gehalt_minor, currency, geburtsdatum, verdienstgrenze_minor, "
                "verdienstgrenze_zeitraum"
            )
            .eq("tenant_id", tenant_id)
            .in_("user_id", sorted(ids))
            .execute()
        ).data or []
        return {str(r["user_id"]): r for r in rows}

    def _qualifikationen(self, tenant_id: str, ids: set[str]) -> dict[str, dict[str, Any]]:
        if not ids:
            return {}
        rows = (
            self._db.table("personal_qualifikationen")
            .select("user_id, arbeitsbereich_id, property_id, stufe")
            .eq("tenant_id", tenant_id)
            .in_("user_id", sorted(ids))
            .execute()
        ).data or []
        aus: dict[str, dict[str, Any]] = {}
        for r in rows:
            uid = str(r["user_id"])
            bereich = str(r["arbeitsbereich_id"])
            eintrag = aus.setdefault(uid, {"stufen": {}, "objekte": {}})
            eintrag["stufen"][bereich] = str(r.get("stufe") or "selbststaendig")
            if r.get("property_id"):
                eintrag["objekte"].setdefault(bereich, set()).add(str(r["property_id"]))
        return aus

    def _abwesenheits_tage(
        self, tenant_id: str, ids: set[str], von: date, bis: date
    ) -> dict[str, set[date]]:
        if not ids:
            return {}
        rows = (
            self._db.table("personal_abwesenheiten")
            .select("user_id, von, bis, status")
            .eq("tenant_id", tenant_id)
            .in_("user_id", sorted(ids))
            .lte("von", bis.isoformat())
            .gte("bis", von.isoformat())
            .execute()
        ).data or []
        aus: dict[str, set[date]] = {}
        for r in rows:
            if str(r.get("status") or "") != "genehmigt":
                continue
            a, b = als_date(r.get("von")), als_date(r.get("bis"))
            if a is None or b is None:
                continue
            tag = max(a, von)
            while tag <= min(b, bis):
                aus.setdefault(str(r["user_id"]), set()).add(tag)
                tag += timedelta(days=1)
        return aus

    def _verfuegbarkeits_fenster(  # noqa: PLR0913 — eine Quelle, zwei Arten
        self, tenant_id: str, ids: set[str], von: date, bis: date, zone: str
    ) -> dict[tuple[str, str], list[tuple[datetime, datetime]]]:
        if not ids:
            return {}
        rows = (
            self._db.table("personal_verfuegbarkeiten")
            .select("*")
            .eq("tenant_id", tenant_id)
            .in_("user_id", sorted(ids))
            .eq("aktiv", True)
            .execute()
        ).data or []
        aus: dict[tuple[str, str], list[tuple[datetime, datetime]]] = {}
        for r in rows:
            fenster = rw.sperrfenster(
                wochentag=(
                    int(r["wiederkehrend_wochentag"])
                    if r.get("wiederkehrend_wochentag") is not None
                    else None
                ),
                datum_von=als_date(r.get("datum_von")),
                datum_bis=als_date(r.get("datum_bis")),
                zeit_von=als_time(r.get("zeit_von")),
                zeit_bis=als_time(r.get("zeit_bis")),
                ganztags=bool(r.get("ganztags")),
                von=von,
                bis=bis,
                zeitzone=zone,
            )
            key = (str(r["user_id"]), str(r["art"]))
            aus.setdefault(key, []).extend(fenster)
        return aus

    def _bestehende_bloecke(
        self, tenant_id: str, von: date, bis: date
    ) -> list[solver.Block]:
        rows = (
            self._db.table("personal_schichten")
            .select("user_id, start_at, end_at, pause_min, status")
            .eq("tenant_id", tenant_id)
            .gte("datum", von.isoformat())
            .lte("datum", bis.isoformat())
            .execute()
        ).data or []
        bloecke: list[solver.Block] = []
        for r in rows:
            if str(r.get("status") or "") not in _AKTIVE_SCHICHT or not r.get("user_id"):
                continue
            start, ende = als_dt(r.get("start_at")), als_dt(r.get("end_at"))
            if start is None or ende is None:
                continue
            bloecke.append(
                solver.Block(
                    user_id=str(r["user_id"]),
                    start_at=start,
                    end_at=ende,
                    pause_min=int(r.get("pause_min") or 0),
                )
            )
        return bloecke

    # ==================================================================
    # Assistent
    # ==================================================================

    def assistent(self, ctx: AuthContext, req: AssistentRequest) -> AssistentAntwort:
        tenant_id = self._require_tenant(ctx)
        if not self._client.is_configured:
            raise PersonalError(
                "Der KI-Assistent ist nicht eingerichtet.",
                status_code=503,
                details={"code": "ki_nicht_eingerichtet"},
            )
        woche_start = _montag(req.woche)
        bis = woche_start + timedelta(days=6)
        kontext, quellen = self._assistent_kontext(ctx, tenant_id, woche_start, bis)
        prompt = (
            f"Frage: {req.frage}\n\nKontext der Woche ab {woche_start.isoformat()}:\n"
            f"{json.dumps(kontext, ensure_ascii=False)}"
        )
        antwort, _ = self._aufrufen(
            ctx, tenant_id, FUNKTION_ASSISTENT, _SYSTEM_ASSISTENT, prompt, pflicht=True
        )
        return AssistentAntwort(antwort=antwort or "", content_origin="ki", quellen=quellen)

    def _assistent_kontext(
        self, ctx: AuthContext, tenant_id: str, von: date, bis: date
    ) -> tuple[dict[str, Any], list[str]]:
        """Plandaten OHNE Lohn und OHNE Kennungen.

        Namen statt user_ids, keine Löhne, keine Verdienstgrenzen: der Kontext
        geht an einen Fremddienst, und eine Frage nach dem Samstagsdienst ist
        kein Grund, Gehälter das Haus verlassen zu lassen (§4.3, Wurzel 3).
        """
        ids = self._personen_im_scope(ctx, tenant_id)
        users = {
            str(u["id"]): str(u.get("full_name") or "")
            for u in self._users(tenant_id, ids)
            if str(u.get("role")) in PLANBARE_ROLLEN
        }
        bereiche = {
            str(b["id"]): str(b.get("name") or "")
            for b in (
                self._db.table("personal_arbeitsbereiche")
                .select("id, name")
                .eq("tenant_id", tenant_id)
                .execute()
            ).data
            or []
        }
        schichten = (
            self._db.table("personal_schichten")
            .select("user_id, datum, start_at, end_at, arbeitsbereich_id, status")
            .eq("tenant_id", tenant_id)
            .gte("datum", von.isoformat())
            .lte("datum", bis.isoformat())
            .execute()
        ).data or []
        quali = self._qualifikationen(tenant_id, set(users))
        abwesend = self._abwesenheits_tage(tenant_id, set(users), von, bis)
        plan = [
            {
                "datum": str(s.get("datum")),
                "person": users.get(str(s.get("user_id") or ""), "offen"),
                "von": _uhr(als_dt(s.get("start_at"))),
                "bis": _uhr(als_dt(s.get("end_at"))),
                "bereich": bereiche.get(str(s.get("arbeitsbereich_id") or ""), ""),
                "status": s.get("status"),
            }
            for s in schichten
            if str(s.get("status") or "") in _AKTIVE_SCHICHT
        ]
        kontext = {
            "dienste": plan,
            "offene_dienste": sum(1 for s in plan if s["person"] == "offen"),
            "qualifikationen": {
                users[uid]: [bereiche.get(b, b) for b in sorted(e["stufen"])]
                for uid, e in quali.items()
                if uid in users
            },
            "abwesenheiten": {
                users[uid]: sorted(t.isoformat() for t in tage)
                for uid, tage in abwesend.items()
                if uid in users
            },
        }
        return kontext, ["Dienstplan", "Abwesenheiten", "Qualifikationen"]

    # ==================================================================
    # Der eine Weg zu Vertex
    # ==================================================================

    def _aufrufen(  # noqa: PLR0913 — Deckel, Aufruf, Buchung in einem Weg
        self,
        ctx: AuthContext,
        tenant_id: str,
        funktion: str,
        system: str,
        prompt: str,
        *,
        pflicht: bool = False,
    ) -> tuple[str | None, dict[str, Any]]:
        """Deckel prüfen, aufrufen, Nutzung buchen.

        `pflicht=False` (Prognose, Variantenerklärung): ein Fehler kostet die
        Erklärung, nicht das Ergebnis — es ist gerechnet und bleibt gültig. Der
        Fehler wird gebucht und geloggt, damit er nicht still verschwindet
        (Wurzel 5).
        `pflicht=True` (Assistent): ohne Antwort gibt es nichts zu zeigen, der
        Fehler geht als HTTP-Status durch.
        """
        try:
            ki_nutzung.deckel_pruefen(self._db, tenant_id)
        except KiError as exc:
            if pflicht:
                raise PersonalError(
                    exc.message, status_code=exc.status_code, details={"code": "ki_deckel"}
                ) from exc
            log.warning("personal_ki_deckel", funktion=funktion, tenant_id=tenant_id)
            return None, {}
        try:
            antwort = self._client.erzeuge(system=system, user=prompt, max_tokens=600)
        except KiError as exc:
            ki_nutzung.fehler_buchen(
                self._db,
                tenant_id,
                user_id=ctx.user_id,
                funktion=funktion,
                modell=self._client.modell,
                region=self._client.region,
                grund=exc.message,
            )
            if pflicht:
                raise PersonalError(
                    exc.message, status_code=exc.status_code, details={"code": "ki_fehler"}
                ) from exc
            log.warning("personal_ki_erklaerung_fehlt", funktion=funktion, grund=exc.message)
            return None, {}
        ki_nutzung.buchen(
            self._db, tenant_id, user_id=ctx.user_id, funktion=funktion, antwort=antwort
        )
        return antwort.text[:MAX_ERKLAERUNG_ZEICHEN], {
            "modell": antwort.modell,
            "region": antwort.region,
            "tokens_ein": antwort.tokens_ein,
            "tokens_aus": antwort.tokens_aus,
            "dauer_ms": antwort.dauer_ms,
        }


# --- Prognose-Rechnung (deterministisch) -------------------------------------


def _prognose_rechnen(
    eingaben: PrognoseEingaben,
    annahmen: dict[str, dict[str, Any]],
    kennzahlen: KennzahlenResponse,
    max_tagesstunden: float | None,
) -> PrognoseAusgabe:
    """`stunden = basis_wert / wert`, geklemmt an min/max; `anzahl = ceil(stunden / 8)`.

    Die Formel steht im Vertrag §2.3 und rechnet der Server — nicht das
    Sprachmodell (siehe Modul-Docstring).
    """
    limit = {t.datum: t.stundenlimit_minuten for t in kennzahlen.tage}
    tage: list[PrognoseAusgabeTag] = []
    for tag in eingaben.tage:
        bereiche: list[PrognoseBereich] = []
        hinweise: list[str] = []
        for bereich_id in sorted(annahmen):
            a = annahmen[bereich_id]
            basis = str(a["basis"])
            wert = float(a["wert"])
            basis_wert = _basis_wert(basis, tag)
            if basis == "fest":
                stunden = wert
            elif wert <= 0:
                continue
            else:
                stunden = basis_wert / wert
            mini, maxi = als_float(a.get("min_stunden_tag")), als_float(a.get("max_stunden_tag"))
            if mini is not None:
                stunden = max(stunden, mini)
            if maxi is not None:
                stunden = min(stunden, maxi)
            anzahl = max(1, math.ceil(stunden / _STUNDEN_JE_KRAFT)) if stunden > 0 else 0
            if (
                max_tagesstunden is not None
                and anzahl > 0
                and stunden / anzahl > max_tagesstunden
            ):
                hinweise.append(
                    f"Bereich {bereich_id}: {round(stunden / anzahl, 1)} h je Kraft "
                    f"überschreiten die Höchstarbeitszeit ({max_tagesstunden} h)."
                )
            bereiche.append(
                PrognoseBereich(
                    arbeitsbereich_id=bereich_id,
                    stunden=round(stunden, 2),
                    anzahl=anzahl,
                    basis=basis,
                    basis_wert=round(basis_wert, 2),
                )
            )
        tage.append(
            PrognoseAusgabeTag(
                datum=tag.datum,
                bereiche=bereiche,
                stundenlimit_minuten=limit.get(tag.datum),
                hinweise=hinweise,
            )
        )
    return PrognoseAusgabe(tage=tage)


def _basis_wert(basis: str, tag: PrognoseEingabeTag) -> float:
    if basis == "einheiten_belegt":
        return float(tag.einheiten_belegt)
    if basis == "abreisen":
        return float(tag.abreisen)
    if basis == "anreisen":
        return float(tag.anreisen)
    if basis == "gaeste":
        return float(tag.gaeste_im_haus)
    if basis == "umsatz":
        # Ohne Plan-Umsatz (fehlende Währung, kein Recht) ist die Basis 0 und
        # der Bereich fällt auf `min_stunden_tag` zurück — kein erfundener Wert.
        return float(tag.umsatz_plan_minor or 0)
    return 0.0


# --- Umformungen -------------------------------------------------------------


def _montag(tag: date) -> date:
    return tag - timedelta(days=tag.weekday())


def _alter(geburtstag: date | None, heute: date) -> int | None:
    if geburtstag is None:
        return None
    return (
        heute.year
        - geburtstag.year
        - ((heute.month, heute.day) < (geburtstag.month, geburtstag.day))
    )


def _uhr(wert: datetime | None) -> str | None:
    return wert.astimezone(UTC).strftime("%H:%M") if wert else None


def _bis_zeit(stunden: float, anzahl: int) -> str:
    """Endzeit einer Prognose-Hülle ab 08:00, gedeckelt auf 23:59.

    Die Prognose sagt WIE VIEL Arbeit anfällt, nicht WANN — das Fenster ist
    darum eine Ableitung und wird im Bedarfs-Editor überschrieben.
    """
    je_kraft = stunden / max(1, anzahl)
    ende = min(23 * 60 + 59, int(8 * 60 + je_kraft * 60))
    return f"{ende // 60:02d}:{ende % 60:02d}"


def _fenster(
    tag: date, von: object, bis: object, zone: str
) -> tuple[datetime | None, datetime | None]:
    a, b = als_time(von), als_time(bis)
    if a is None or b is None:
        return None, None
    tz = rw.zone(zone)
    start = datetime.combine(tag, a, tz)
    ende = datetime.combine(tag, b, tz)
    if ende <= start:
        ende += timedelta(days=1)
    return start.astimezone(UTC), ende.astimezone(UTC)


def _solver_regeln(regeln: rw.Regeln, row: dict[str, Any]) -> solver.SolverRegeln:
    """`Regeln` + Jugendschutz-Rohwerte → `SolverRegeln`.

    Die Jugendschutzfelder liest B1 in die Dataclass ein (Vertrag §1.1); bis
    dahin kommen sie aus dem Roh-Dict — darum beides und nicht `getattr` auf
    eine Dataclass, die die Felder noch nicht hat.
    """
    return solver.SolverRegeln(
        zeitzone=regeln.zeitzone,
        ruhezeit_stunden=regeln.ruhezeit_stunden,
        max_tagesstunden=regeln.max_tagesstunden,
        max_wochenstunden=regeln.max_wochenstunden,
        jugendschutz_bis_alter=(
            int(row["jugendschutz_bis_alter"])
            if row.get("jugendschutz_bis_alter") is not None
            else None
        ),
        jugendschutz_max_tagesstunden=als_float(row.get("jugendschutz_max_tagesstunden")),
        jugendschutz_nacht_von_min=_minuten(als_time(row.get("jugendschutz_nacht_von"))),
        jugendschutz_nacht_bis_min=_minuten(als_time(row.get("jugendschutz_nacht_bis"))),
    )


def _minuten(wert: time | None) -> int | None:
    return wert.hour * 60 + wert.minute if wert is not None else None


def _variante(name: str, ergebnis: solver.Ergebnis, huellen: list[solver.Huelle]) -> Variante:
    je_id = {h.id: h for h in huellen}
    return Variante(
        name=name,
        schichten=[
            VarianteSchicht(
                bedarf_id=je_id[z.huelle_id].bedarf_id,
                user_id=z.user_id,
                start_at=je_id[z.huelle_id].start_at,
                end_at=je_id[z.huelle_id].end_at,
                pause_min=je_id[z.huelle_id].pause_min,
                arbeitsbereich_id=je_id[z.huelle_id].arbeitsbereich_id,
                property_id=je_id[z.huelle_id].property_id,
            )
            for z in ergebnis.zuteilungen
        ],
        kennzahlen=VarianteKennzahlen(
            stunden=ergebnis.kennzahlen.stunden,
            kosten_minor=ergebnis.kennzahlen.kosten_minor,
            currency=ergebnis.kennzahlen.currency,
            fairness_pct=ergebnis.kennzahlen.fairness_pct,
            wunsch_erfuellt_pct=ergebnis.kennzahlen.wunsch_erfuellt_pct,
            unbesetzt=ergebnis.kennzahlen.unbesetzt,
            konflikte=ergebnis.kennzahlen.konflikte,
        ),
    )


def _prognose(row: dict[str, Any]) -> Prognose:
    return Prognose(
        id=str(row["id"]),
        woche_start=als_date(row["woche_start"]) or date.today(),
        status=row.get("status") or "fertig",
        eingaben=PrognoseEingaben.model_validate(row.get("eingaben") or {}),
        ausgabe=PrognoseAusgabe.model_validate(row.get("ausgabe") or {}),
        erklaerung=row.get("erklaerung"),
        content_origin=str(row.get("content_origin") or "ki"),
        modell=row.get("modell"),
        region=row.get("region"),
        dauer_ms=row.get("dauer_ms"),
        fehler=row.get("fehler"),
        uebernommen_am=als_dt(row.get("uebernommen_am")),
        created_at=als_dt(row.get("created_at")),
    )


def _varianten(row: dict[str, Any]) -> list[Variante]:
    return [Variante.model_validate(v) for v in (row.get("varianten") or [])]


def _lauf(row: dict[str, Any]) -> Planungslauf:
    return Planungslauf(
        id=str(row["id"]),
        woche_start=als_date(row["woche_start"]) or date.today(),
        planungstyp=row["planungstyp"],
        status=row.get("status") or "fertig",
        solver=row.get("solver"),
        varianten=_varianten(row),
        gewaehlte_variante=row.get("gewaehlte_variante"),
        erklaerung=row.get("erklaerung"),
        content_origin=str(row.get("content_origin") or "ki"),
        dauer_ms=row.get("dauer_ms"),
        fehler=row.get("fehler"),
        uebernommen_am=als_dt(row.get("uebernommen_am")),
        created_at=als_dt(row.get("created_at")),
    )


def get_ki_planung_service() -> KiPlanungService:
    """Service-Factory (Vertrag §0: `dependencies.py` gehört dem Integrator)."""
    from src.core.supabase import get_service_client  # noqa: PLC0415 — kein Import-Zirkel

    return KiPlanungService(service_client=get_service_client())
