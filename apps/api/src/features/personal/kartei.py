"""Kartei-Reiter der Personalakte (0543): Verträge + Nachträge, Maßnahmen,
Vorfälle, Gespräche, Nachweise, Schulungen — und die Übersicht für den Kopf.

Vorlage ist die Taskilo-Kartei (Reiter Verträge, Disziplin, Feedback,
Qualifikationen, Compliance, App-Zugang), gegen unser Modell gesiebt:
  * Alles hier ist Akteninhalt → MANAGE_PERSONAL, Rolle frisch aus der DB
    (Wurzel 7). Nachweise und Schulungen liest zusätzlich die Schichtleitung
    für ihre Leute (wer darf was), schreibt sie aber nicht.
  * Alle sieben Tabellen haben denselben Zuschnitt (tenant_id, user_id,
    Zeilen mit Datum). Deshalb EIN generischer Pfad `_liste/_anlegen/_aendern/
    _loeschen` mit Tabellen-Registry statt sieben Kopien — ein Scope-Fehler
    wäre sonst siebenmal zu suchen (Wurzel 3/9).
  * `geleert` wie in der Akte: Weglassen heißt „nicht anfassen", Löschen ist
    ausdrücklich.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any

from pydantic import BaseModel

from src.core.security import AuthContext
from src.core.supabase import load_scoped

from ._base import (
    LEITUNG,
    PersonalBase,
    PersonalError,
    als_date,
    als_dt,
    als_float,
    jetzt,
    log,
)
from .schemas import (
    Aenderung,
    Gespraech,
    GespraechCreate,
    GespraechUpdate,
    KommendeSchicht,
    Massnahme,
    MassnahmeCreate,
    MassnahmeUpdate,
    Nachtrag,
    NachtragCreate,
    Nachweis,
    NachweisCreate,
    NachweisUpdate,
    Paar,
    PersonUebersicht,
    Schulung,
    SchulungCreate,
    SchulungUpdate,
    Vertrag,
    VertragCreate,
    VertragUpdate,
    Vorfall,
    VorfallCreate,
    VorfallUpdate,
)
from .service import monatskosten

_ABLAUF_WARNUNG_TAGE = 30
_KOMMENDE_TAGE = 14
_JSON_LISTEN = {
    "unterzeichner",
    "bedingungen",
    "aenderungen",
    "zeugen",
    "ziele",
    "erfolge",
    "entwicklung",
}


@dataclass(frozen=True)
class _Tabelle:
    name: str
    # Spalte, die beim Anlegen den Handelnden trägt (Wurzel 5b: unsere Handlung).
    akteur_spalte: str | None
    # Reihenfolge der Liste
    sortierung: str


TABELLEN: dict[str, _Tabelle] = {
    "vertraege": _Tabelle("personal_vertraege", "erstellt_von", "gueltig_ab"),
    "massnahmen": _Tabelle("personal_massnahmen", "ausgestellt_von", "datum"),
    "vorfaelle": _Tabelle("personal_vorfaelle", "gemeldet_von", "datum"),
    "gespraeche": _Tabelle("personal_gespraeche", "gefuehrt_von", "datum"),
    "nachweise": _Tabelle("personal_nachweise", None, "von"),
    "schulungen": _Tabelle("personal_schulungen", None, "abgeschlossen_am"),
}


def _zustand(ablauf: date | None, heute: date) -> str:
    if ablauf is None:
        return "ohne_ablauf"
    if ablauf < heute:
        return "abgelaufen"
    if ablauf <= heute + timedelta(days=_ABLAUF_WARNUNG_TAGE):
        return "laeuft_ab"
    return "gueltig"


def _strs(wert: object) -> list[str]:
    return [str(x) for x in wert] if isinstance(wert, list) else []


def _paare(wert: object) -> list[Paar]:
    if not isinstance(wert, list):
        return []
    return [
        Paar(schluessel=str(x.get("schluessel") or ""), wert=str(x.get("wert") or ""))
        for x in wert
        if isinstance(x, dict) and x.get("schluessel")
    ]


def _aenderungen(wert: object) -> list[Aenderung]:
    if not isinstance(wert, list):
        return []
    return [
        Aenderung(
            feld=str(x.get("feld") or ""), alt=str(x.get("alt") or ""), neu=str(x.get("neu") or "")
        )
        for x in wert
        if isinstance(x, dict) and x.get("feld")
    ]


class KarteiService(PersonalBase):
    """Verträge, Disziplin, Gespräche, Nachweise, Schulungen, Übersicht."""

    # --- Scope -------------------------------------------------------------

    def _require_leitung(self, ctx: AuthContext, tenant_id: str) -> None:
        if self._rolle_aus_db(ctx, tenant_id) not in LEITUNG:
            raise PersonalError("Keine Berechtigung für die Personalakte.", status_code=403)

    def _namen(self, tenant_id: str, ids: set[str]) -> dict[str, str | None]:
        return {
            str(u["id"]): u.get("full_name") for u in self._users(tenant_id, {i for i in ids if i})
        }

    def _dokument_titel(self, tenant_id: str, ids: set[str]) -> dict[str, str]:
        ids = {i for i in ids if i}
        if not ids:
            return {}
        rows = (
            self._db.table("personal_dokumente")
            .select("id, titel")
            .eq("tenant_id", tenant_id)
            .in_("id", sorted(ids))
            .execute()
        ).data or []
        return {str(r["id"]): str(r["titel"]) for r in rows}

    def _dokument_pruefen(self, tenant_id: str, user_id: str, dokument_id: str | None) -> None:
        """Ein verknüpftes Dokument muss zur SELBEN Person gehören (Wurzel 3)."""
        if not dokument_id:
            return
        row = load_scoped(
            self._db,
            "personal_dokumente",
            dokument_id,
            tenant_id,
            columns="id, user_id",
            not_found=PersonalError("Dokument nicht gefunden.", status_code=404),
        )
        if str(row.get("user_id")) != user_id:
            raise PersonalError("Dokument gehört zu einer anderen Person.", status_code=422)

    # --- Generischer Pfad ---------------------------------------------------

    def _rows(self, tab: _Tabelle, tenant_id: str, user_id: str) -> list[dict[str, Any]]:
        return (
            self._db.table(tab.name)
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .order(tab.sortierung, desc=True)
            .execute()
        ).data or []

    def _payload(self, req: BaseModel, *, geleert: list[str] | None = None) -> dict[str, Any]:
        felder = req.model_dump(exclude_unset=True, exclude={"geleert"})
        aus: dict[str, Any] = {}
        for name, wert in felder.items():
            if wert is None:
                continue
            if isinstance(wert, date):
                aus[name] = wert.isoformat()
            elif name in _JSON_LISTEN:
                aus[name] = [x.model_dump() if isinstance(x, BaseModel) else x for x in wert]
            else:
                aus[name] = wert
        for name in geleert or []:
            if name in _JSON_LISTEN:
                aus[name] = []
            else:
                aus[name] = None
        return aus

    def _anlegen(self, ctx: AuthContext, art: str, user_id: str, req: BaseModel) -> dict[str, Any]:
        tenant_id = self._require_tenant(ctx)
        self._require_leitung(ctx, tenant_id)
        self._require_planbar(tenant_id, user_id)
        tab = TABELLEN[art]
        payload = self._payload(req)
        self._dokument_pruefen(tenant_id, user_id, payload.get("dokument_id"))
        payload.update({"tenant_id": tenant_id, "user_id": user_id})
        if art == "massnahmen":
            payload.setdefault("geloest", False)
        if tab.akteur_spalte:
            payload[tab.akteur_spalte] = ctx.user_id
        rows = self._db.table(tab.name).insert(payload).execute().data or []
        log.info("personal_kartei_angelegt", art=art, user_id=user_id, akteur=ctx.user_id)
        return rows[0] if rows else {**payload, "id": ""}

    def _eigene_zeile(
        self, ctx: AuthContext, art: str, zeile_id: str
    ) -> tuple[str, dict[str, Any]]:
        tenant_id = self._require_tenant(ctx)
        self._require_leitung(ctx, tenant_id)
        row = load_scoped(
            self._db,
            TABELLEN[art].name,
            zeile_id,
            tenant_id,
            not_found=PersonalError("Eintrag nicht gefunden.", status_code=404),
        )
        return tenant_id, row

    def _aendern(self, ctx: AuthContext, art: str, zeile_id: str, req: BaseModel) -> dict[str, Any]:
        tenant_id, alt = self._eigene_zeile(ctx, art, zeile_id)
        geleert = list(getattr(req, "geleert", []) or [])
        payload = self._payload(req, geleert=geleert)
        if "dokument_id" in payload:
            self._dokument_pruefen(tenant_id, str(alt["user_id"]), payload["dokument_id"])
        if not payload:
            return alt
        rows = (
            self._db.table(TABELLEN[art].name)
            .update(payload)
            .eq("tenant_id", tenant_id)
            .eq("id", zeile_id)
            .execute()
        ).data or []
        log.info("personal_kartei_geaendert", art=art, id=zeile_id, akteur=ctx.user_id)
        return rows[0] if rows else {**alt, **payload}

    def loeschen(self, ctx: AuthContext, art: str, zeile_id: str) -> None:
        if art not in TABELLEN:
            raise PersonalError("Unbekannter Bereich.", status_code=404)
        tenant_id, _alt = self._eigene_zeile(ctx, art, zeile_id)
        (
            self._db.table(TABELLEN[art].name)
            .delete()
            .eq("tenant_id", tenant_id)
            .eq("id", zeile_id)
            .execute()
        )
        log.info("personal_kartei_geloescht", art=art, id=zeile_id, akteur=ctx.user_id)

    # --- Verträge -----------------------------------------------------------

    def vertraege(self, ctx: AuthContext, user_id: str) -> list[Vertrag]:
        tenant_id = self._require_tenant(ctx)
        self._require_leitung(ctx, tenant_id)
        self._require_person_im_scope(ctx, tenant_id, user_id)
        rows = self._rows(TABELLEN["vertraege"], tenant_id, user_id)
        ids = [str(r["id"]) for r in rows]
        nachtraege = (
            (
                self._db.table("personal_vertrag_nachtraege")
                .select("*")
                .eq("tenant_id", tenant_id)
                .in_("vertrag_id", ids)
                .order("datum")
                .execute()
            ).data
            or []
            if ids
            else []
        )
        namen = self._namen(tenant_id, {str(n.get("autorisiert_von") or "") for n in nachtraege})
        titel = self._dokument_titel(tenant_id, {str(r.get("dokument_id") or "") for r in rows})
        je_vertrag: dict[str, list[Nachtrag]] = {}
        for n in nachtraege:
            je_vertrag.setdefault(str(n["vertrag_id"]), []).append(self._nachtrag(n, namen))
        return [self._vertrag(r, je_vertrag.get(str(r["id"]), []), titel) for r in rows]

    @staticmethod
    def _nachtrag(n: dict[str, Any], namen: dict[str, str | None]) -> Nachtrag:
        return Nachtrag(
            id=str(n["id"]),
            vertrag_id=str(n["vertrag_id"]),
            datum=als_date(n["datum"]),  # type: ignore[arg-type]
            beschreibung=str(n.get("beschreibung") or ""),
            grund=n.get("grund"),
            aenderungen=_aenderungen(n.get("aenderungen")),
            autorisiert_von=n.get("autorisiert_von"),
            autorisiert_von_name=namen.get(str(n.get("autorisiert_von") or "")),
            created_at=als_dt(n.get("created_at")),
        )

    @staticmethod
    def _vertrag(r: dict[str, Any], nachtraege: list[Nachtrag], titel: dict[str, str]) -> Vertrag:
        return Vertrag(
            id=str(r["id"]),
            user_id=str(r["user_id"]),
            art=r["art"],
            titel=str(r["titel"]),
            beschreibung=r.get("beschreibung"),
            status=r.get("status") or "aktiv",
            version=r.get("version"),
            unterzeichnet_am=als_date(r.get("unterzeichnet_am")),
            gueltig_ab=als_date(r.get("gueltig_ab")),
            gueltig_bis=als_date(r.get("gueltig_bis")),
            unterzeichner=_strs(r.get("unterzeichner")),
            bedingungen=_paare(r.get("bedingungen")),
            verlaengerung=r.get("verlaengerung"),
            kuendigung=r.get("kuendigung"),
            dokument_id=r.get("dokument_id"),
            dokument_titel=titel.get(str(r.get("dokument_id") or "")),
            nachtraege=nachtraege,
            created_at=als_dt(r.get("created_at")),
            updated_at=als_dt(r.get("updated_at")),
        )

    def vertrag_anlegen(self, ctx: AuthContext, user_id: str, req: VertragCreate) -> Vertrag:
        r = self._anlegen(ctx, "vertraege", user_id, req)
        titel = self._dokument_titel(ctx.tenant_id or "", {str(r.get("dokument_id") or "")})
        return self._vertrag(r, [], titel)

    def vertrag_aendern(self, ctx: AuthContext, vertrag_id: str, req: VertragUpdate) -> Vertrag:
        row = self._aendern(ctx, "vertraege", vertrag_id, req)
        return next(v for v in self.vertraege(ctx, str(row["user_id"])) if v.id == vertrag_id)

    def nachtrag_anlegen(self, ctx: AuthContext, vertrag_id: str, req: NachtragCreate) -> Vertrag:
        tenant_id, vertrag = self._eigene_zeile(ctx, "vertraege", vertrag_id)
        payload = self._payload(req)
        payload.update(
            {"tenant_id": tenant_id, "vertrag_id": vertrag_id, "autorisiert_von": ctx.user_id}
        )
        self._db.table("personal_vertrag_nachtraege").insert(payload).execute()
        log.info("personal_nachtrag_angelegt", vertrag_id=vertrag_id, akteur=ctx.user_id)
        return next(v for v in self.vertraege(ctx, str(vertrag["user_id"])) if v.id == vertrag_id)

    def nachtrag_loeschen(self, ctx: AuthContext, nachtrag_id: str) -> None:
        tenant_id = self._require_tenant(ctx)
        self._require_leitung(ctx, tenant_id)
        load_scoped(
            self._db,
            "personal_vertrag_nachtraege",
            nachtrag_id,
            tenant_id,
            columns="id",
            not_found=PersonalError("Nachtrag nicht gefunden.", status_code=404),
        )
        (
            self._db.table("personal_vertrag_nachtraege")
            .delete()
            .eq("tenant_id", tenant_id)
            .eq("id", nachtrag_id)
            .execute()
        )

    # --- Maßnahmen ----------------------------------------------------------

    def massnahmen(self, ctx: AuthContext, user_id: str) -> list[Massnahme]:
        tenant_id = self._require_tenant(ctx)
        self._require_leitung(ctx, tenant_id)
        self._require_person_im_scope(ctx, tenant_id, user_id)
        rows = self._rows(TABELLEN["massnahmen"], tenant_id, user_id)
        namen = self._namen(tenant_id, {str(r.get("ausgestellt_von") or "") for r in rows})
        titel = self._dokument_titel(tenant_id, {str(r.get("dokument_id") or "") for r in rows})
        return [self._massnahme(r, namen, titel) for r in rows]

    @staticmethod
    def _massnahme(
        r: dict[str, Any], namen: dict[str, str | None], titel: dict[str, str]
    ) -> Massnahme:
        return Massnahme(
            id=str(r["id"]),
            user_id=str(r["user_id"]),
            art=r["art"],
            datum=als_date(r["datum"]),  # type: ignore[arg-type]
            grund=str(r.get("grund") or ""),
            beschreibung=r.get("beschreibung"),
            ausgestellt_von=r.get("ausgestellt_von"),
            ausgestellt_von_name=namen.get(str(r.get("ausgestellt_von") or "")),
            zeuge=r.get("zeuge"),
            stellungnahme=r.get("stellungnahme"),
            folgetermin=als_date(r.get("folgetermin")),
            geloest=bool(r.get("geloest")),
            geloest_am=als_date(r.get("geloest_am")),
            loesung=r.get("loesung"),
            dokument_id=r.get("dokument_id"),
            dokument_titel=titel.get(str(r.get("dokument_id") or "")),
            created_at=als_dt(r.get("created_at")),
        )

    def massnahme_anlegen(self, ctx: AuthContext, user_id: str, req: MassnahmeCreate) -> Massnahme:
        r = self._anlegen(ctx, "massnahmen", user_id, req)
        return self._nachladen_massnahme(ctx, r)

    def massnahme_aendern(self, ctx: AuthContext, zeile_id: str, req: MassnahmeUpdate) -> Massnahme:
        if req.geloest is True and req.geloest_am is None:
            req.geloest_am = jetzt().date()
        if req.geloest is False:
            req.geleert = [*req.geleert, "geloest_am", "loesung"]
        r = self._aendern(ctx, "massnahmen", zeile_id, req)
        return self._nachladen_massnahme(ctx, r)

    def _nachladen_massnahme(self, ctx: AuthContext, r: dict[str, Any]) -> Massnahme:
        tenant_id = ctx.tenant_id or ""
        namen = self._namen(tenant_id, {str(r.get("ausgestellt_von") or "")})
        titel = self._dokument_titel(tenant_id, {str(r.get("dokument_id") or "")})
        return self._massnahme(r, namen, titel)

    # --- Vorfälle -----------------------------------------------------------

    def vorfaelle(self, ctx: AuthContext, user_id: str) -> list[Vorfall]:
        tenant_id = self._require_tenant(ctx)
        self._require_leitung(ctx, tenant_id)
        self._require_person_im_scope(ctx, tenant_id, user_id)
        rows = self._rows(TABELLEN["vorfaelle"], tenant_id, user_id)
        namen = self._namen(tenant_id, {str(r.get("gemeldet_von") or "") for r in rows})
        return [self._vorfall(r, namen) for r in rows]

    @staticmethod
    def _vorfall(r: dict[str, Any], namen: dict[str, str | None]) -> Vorfall:
        return Vorfall(
            id=str(r["id"]),
            user_id=str(r["user_id"]),
            datum=als_date(r["datum"]),  # type: ignore[arg-type]
            art=r["art"],
            schwere=r.get("schwere") or "gering",
            ort=r.get("ort"),
            beschreibung=str(r.get("beschreibung") or ""),
            zeugen=_strs(r.get("zeugen")),
            massnahmen=r.get("massnahmen"),
            praevention=r.get("praevention"),
            gemeldet_von=r.get("gemeldet_von"),
            gemeldet_von_name=namen.get(str(r.get("gemeldet_von") or "")),
            folge_noetig=bool(r.get("folge_noetig")),
            created_at=als_dt(r.get("created_at")),
        )

    def vorfall_anlegen(self, ctx: AuthContext, user_id: str, req: VorfallCreate) -> Vorfall:
        r = self._anlegen(ctx, "vorfaelle", user_id, req)
        return self._vorfall(
            r, self._namen(ctx.tenant_id or "", {str(r.get("gemeldet_von") or "")})
        )

    def vorfall_aendern(self, ctx: AuthContext, zeile_id: str, req: VorfallUpdate) -> Vorfall:
        r = self._aendern(ctx, "vorfaelle", zeile_id, req)
        return self._vorfall(
            r, self._namen(ctx.tenant_id or "", {str(r.get("gemeldet_von") or "")})
        )

    # --- Gespräche ----------------------------------------------------------

    def gespraeche(self, ctx: AuthContext, user_id: str) -> list[Gespraech]:
        tenant_id = self._require_tenant(ctx)
        self._require_leitung(ctx, tenant_id)
        self._require_person_im_scope(ctx, tenant_id, user_id)
        rows = self._rows(TABELLEN["gespraeche"], tenant_id, user_id)
        namen = self._namen(tenant_id, {str(r.get("gefuehrt_von") or "") for r in rows})
        return [self._gespraech(r, namen) for r in rows]

    @staticmethod
    def _gespraech(r: dict[str, Any], namen: dict[str, str | None]) -> Gespraech:
        return Gespraech(
            id=str(r["id"]),
            user_id=str(r["user_id"]),
            datum=als_date(r["datum"]),  # type: ignore[arg-type]
            art=r.get("art") or "feedback",
            bewertung=r.get("bewertung"),
            notizen=r.get("notizen"),
            ziele=_strs(r.get("ziele")),
            erfolge=_strs(r.get("erfolge")),
            entwicklung=_strs(r.get("entwicklung")),
            gefuehrt_von=r.get("gefuehrt_von"),
            gefuehrt_von_name=namen.get(str(r.get("gefuehrt_von") or "")),
            naechstes_am=als_date(r.get("naechstes_am")),
            created_at=als_dt(r.get("created_at")),
        )

    def gespraech_anlegen(self, ctx: AuthContext, user_id: str, req: GespraechCreate) -> Gespraech:
        r = self._anlegen(ctx, "gespraeche", user_id, req)
        return self._gespraech(
            r, self._namen(ctx.tenant_id or "", {str(r.get("gefuehrt_von") or "")})
        )

    def gespraech_aendern(self, ctx: AuthContext, zeile_id: str, req: GespraechUpdate) -> Gespraech:
        r = self._aendern(ctx, "gespraeche", zeile_id, req)
        return self._gespraech(
            r, self._namen(ctx.tenant_id or "", {str(r.get("gefuehrt_von") or "")})
        )

    # --- Nachweise (lesbar für die Schichtleitung im Scope) -------------------

    def nachweise(self, ctx: AuthContext, user_id: str) -> list[Nachweis]:
        tenant_id = self._require_tenant(ctx)
        self._require_person_im_scope(ctx, tenant_id, user_id)
        rows = self._rows(TABELLEN["nachweise"], tenant_id, user_id)
        titel = self._dokument_titel(tenant_id, {str(r.get("dokument_id") or "") for r in rows})
        heute = jetzt().date()
        return [self._nachweis(r, titel, heute) for r in rows]

    @staticmethod
    def _nachweis(r: dict[str, Any], titel: dict[str, str], heute: date) -> Nachweis:
        ablauf = als_date(r.get("ablauf_am"))
        return Nachweis(
            id=str(r["id"]),
            user_id=str(r["user_id"]),
            art=r["art"],
            titel=str(r["titel"]),
            stelle=r.get("stelle"),
            stufe=r.get("stufe"),
            von=als_date(r.get("von")),
            bis=als_date(r.get("bis")),
            ablauf_am=ablauf,
            kennung=r.get("kennung"),
            notiz=r.get("notiz"),
            dokument_id=r.get("dokument_id"),
            dokument_titel=titel.get(str(r.get("dokument_id") or "")),
            zustand=_zustand(ablauf, heute),
            created_at=als_dt(r.get("created_at")),
        )

    def nachweis_anlegen(self, ctx: AuthContext, user_id: str, req: NachweisCreate) -> Nachweis:
        r = self._anlegen(ctx, "nachweise", user_id, req)
        titel = self._dokument_titel(ctx.tenant_id or "", {str(r.get("dokument_id") or "")})
        return self._nachweis(r, titel, jetzt().date())

    def nachweis_aendern(self, ctx: AuthContext, zeile_id: str, req: NachweisUpdate) -> Nachweis:
        r = self._aendern(ctx, "nachweise", zeile_id, req)
        titel = self._dokument_titel(ctx.tenant_id or "", {str(r.get("dokument_id") or "")})
        return self._nachweis(r, titel, jetzt().date())

    # --- Schulungen ---------------------------------------------------------

    def schulungen(self, ctx: AuthContext, user_id: str) -> list[Schulung]:
        tenant_id = self._require_tenant(ctx)
        self._require_person_im_scope(ctx, tenant_id, user_id)
        rows = self._rows(TABELLEN["schulungen"], tenant_id, user_id)
        titel = self._dokument_titel(tenant_id, {str(r.get("dokument_id") or "") for r in rows})
        heute = jetzt().date()
        return [self._schulung(r, titel, heute) for r in rows]

    @staticmethod
    def _schulung(r: dict[str, Any], titel: dict[str, str], heute: date) -> Schulung:
        bis = als_date(r.get("gueltig_bis"))
        return Schulung(
            id=str(r["id"]),
            user_id=str(r["user_id"]),
            titel=str(r["titel"]),
            trainer=r.get("trainer"),
            abgeschlossen_am=als_date(r["abgeschlossen_am"]),  # type: ignore[arg-type]
            gueltig_bis=bis,
            notiz=r.get("notiz"),
            dokument_id=r.get("dokument_id"),
            dokument_titel=titel.get(str(r.get("dokument_id") or "")),
            zustand=_zustand(bis, heute),
            created_at=als_dt(r.get("created_at")),
        )

    def schulung_anlegen(self, ctx: AuthContext, user_id: str, req: SchulungCreate) -> Schulung:
        r = self._anlegen(ctx, "schulungen", user_id, req)
        titel = self._dokument_titel(ctx.tenant_id or "", {str(r.get("dokument_id") or "")})
        return self._schulung(r, titel, jetzt().date())

    def schulung_aendern(self, ctx: AuthContext, zeile_id: str, req: SchulungUpdate) -> Schulung:
        r = self._aendern(ctx, "schulungen", zeile_id, req)
        titel = self._dokument_titel(ctx.tenant_id or "", {str(r.get("dokument_id") or "")})
        return self._schulung(r, titel, jetzt().date())

    # --- Übersicht (Kopf der Akte) --------------------------------------------

    def uebersicht(self, ctx: AuthContext, user_id: str) -> PersonUebersicht:  # noqa: PLR0915
        tenant_id = self._require_tenant(ctx)
        self._require_person_im_scope(ctx, tenant_id, user_id)
        user = self._require_planbar(tenant_id, user_id)
        leitung = self._rolle_aus_db(ctx, tenant_id) in LEITUNG
        heute = jetzt().date()
        akte = self._akten(tenant_id, {user_id}).get(user_id) or {}

        aus = PersonUebersicht(
            user_id=user_id,
            full_name=user.get("full_name"),
            role=str(user.get("role")),
            is_active=user.get("deactivated_at") is None,
            avatar_url=user.get("avatar_url"),
            konto_seit=als_dt(user.get("created_at")),
        )
        if leitung:
            aus.email = user.get("email")
            aus.phone = user.get("phone")
            aus.letzter_login = self._letzter_login(user_id)
            stand, wann, von = self._einladung(tenant_id, user_id)
            aus.einladung, aus.einladung_am = stand, wann
            aus.eingeladen_von_name = self._namen(tenant_id, {von}).get(von) if von else None
            aus.vertraege = self._anzahl("personal_vertraege", tenant_id, user_id)
            aus.massnahmen_offen = self._anzahl(
                "personal_massnahmen", tenant_id, user_id, geloest=False
            )
            aus.vorfaelle = self._anzahl("personal_vorfaelle", tenant_id, user_id)
            aus.gespraeche = self._anzahl("personal_gespraeche", tenant_id, user_id)
            kosten = monatskosten(akte) if akte else None
            if kosten:
                aus.kosten_currency, aus.kosten_monat_minor = kosten
            elif akte and akte.get("beschaeftigungsart") != "extern":
                aus.kosten_hinweis = "lohn_oder_aufschlag_fehlt"
        aus.nachweise = self._anzahl("personal_nachweise", tenant_id, user_id)
        aus.schulungen = self._anzahl("personal_schulungen", tenant_id, user_id)
        aus.faellig = self._faellig(tenant_id, user_id, heute)

        # Laufender Monat
        monat_von = heute.replace(day=1)
        monat_bis = (monat_von + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        schichten = (
            self._db.table("personal_schichten")
            .select(
                "id, datum, start_at, end_at, pause_min, property_id, arbeitsbereich_id, status"
            )
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .neq("status", "abgesagt")
            .gte("datum", monat_von.isoformat())
            .lte("datum", (heute + timedelta(days=_KOMMENDE_TAGE)).isoformat())
            .order("start_at")
            .execute()
        ).data or []
        aus.monat_plan_minuten = sum(
            self._netto(s)
            for s in schichten
            if monat_von <= (als_date(s["datum"]) or heute) <= monat_bis
        )
        titel = self._property_titel(
            tenant_id, {str(s["property_id"]) for s in schichten if s.get("property_id")}
        )
        aus.kommende_schichten = [
            KommendeSchicht(
                id=str(s["id"]),
                datum=als_date(s["datum"]),  # type: ignore[arg-type]
                start_at=als_dt(s["start_at"]),  # type: ignore[arg-type]
                end_at=als_dt(s["end_at"]),  # type: ignore[arg-type]
                property_title=titel.get(str(s.get("property_id") or "")),
                arbeitsbereich_id=s.get("arbeitsbereich_id"),
                status=s.get("status") or "entwurf",
            )
            for s in schichten
            if (als_date(s["datum"]) or heute) >= heute
        ][:20]
        zeiten = (
            self._db.table("personal_zeiterfassung")
            .select("start_at, end_at, pausen")
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .gte("start_at", datetime.combine(monat_von, datetime.min.time()).isoformat())
            .not_.is_("end_at", "null")
            .execute()
        ).data or []
        aus.monat_ist_minuten = sum(self._netto_zeit(z) for z in zeiten)
        std = als_float(akte.get("wochenstunden")) if akte else None
        if std is not None:
            aus.monat_soll_minuten = round(std * 60 * 52 / 12)
        aus.offene_antraege = self._anzahl(
            "personal_abwesenheiten", tenant_id, user_id, status="beantragt"
        )
        if akte and akte.get("beschaeftigungsart") != "extern":
            azk = (
                self._db.table("personal_arbeitszeitkonten")
                .select("minuten")
                .eq("tenant_id", tenant_id)
                .eq("user_id", user_id)
                .execute()
            ).data or []
            aus.azk_saldo_minuten = sum(int(r.get("minuten") or 0) for r in azk)
            aus.urlaub_anspruch = als_float(akte.get("urlaubsanspruch_tage"))
        return aus

    def _anzahl(self, table: str, tenant_id: str, user_id: str, **filter_: object) -> int:
        q = self._db.table(table).select("id").eq("tenant_id", tenant_id).eq("user_id", user_id)
        for k, v in filter_.items():
            q = q.eq(k, v)
        return len(q.execute().data or [])

    def _faellig(self, tenant_id: str, user_id: str, heute: date) -> int:
        grenze = (heute + timedelta(days=_ABLAUF_WARNUNG_TAGE)).isoformat()
        n = 0
        for table, spalte, offen_spalte in (
            ("personal_dokumente", "ablauf_am", "storage_pfad"),
            ("personal_nachweise", "ablauf_am", None),
            ("personal_schulungen", "gueltig_bis", None),
        ):
            rows = (
                self._db.table(table)
                .select(f"{spalte}{', ' + offen_spalte if offen_spalte else ''}")
                .eq("tenant_id", tenant_id)
                .eq("user_id", user_id)
                .execute()
            ).data or []
            for r in rows:
                ablauf = r.get(spalte)
                offen = offen_spalte is not None and r.get(offen_spalte) is None
                if offen or (ablauf and str(ablauf) <= grenze):
                    n += 1
        return n

    def _letzter_login(self, user_id: str) -> datetime | None:
        rows = (
            self._db.table("login_devices")
            .select("last_seen_at")
            .eq("user_id", user_id)
            .order("last_seen_at", desc=True)
            .limit(1)
            .execute()
        ).data or []
        return als_dt(rows[0].get("last_seen_at")) if rows else None

    def _einladung(self, tenant_id: str, user_id: str) -> tuple[str, datetime | None, str | None]:
        rows = (
            self._db.table("user_auth_tokens")
            .select("created_at, expires_at, used_at, created_by")
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .eq("zweck", "invite")
            .order("created_at", desc=True)
            .execute()
        ).data or []
        if not rows:
            return "keine", None, None
        neueste = rows[0]
        wann = als_dt(neueste.get("created_at"))
        von = str(neueste.get("created_by")) if neueste.get("created_by") else None
        if any(r.get("used_at") for r in rows):
            return "angenommen", wann, von
        ablauf = als_dt(neueste.get("expires_at"))
        if ablauf and ablauf < jetzt():
            return "abgelaufen", wann, von
        return "offen", wann, von

    @staticmethod
    def _netto(s: dict[str, Any]) -> int:
        start, end = als_dt(s.get("start_at")), als_dt(s.get("end_at"))
        if not start or not end:
            return 0
        return max(0, int((end - start).total_seconds() // 60) - int(s.get("pause_min") or 0))

    @staticmethod
    def _netto_zeit(z: dict[str, Any]) -> int:
        start, end = als_dt(z.get("start_at")), als_dt(z.get("end_at"))
        if not start or not end:
            return 0
        pause = 0
        for p in z.get("pausen") or []:
            ps, pe = als_dt(p.get("start")), als_dt(p.get("end"))
            if ps and pe:
                pause += int((pe - ps).total_seconds() // 60)
        return max(0, int((end - start).total_seconds() // 60) - pause)
