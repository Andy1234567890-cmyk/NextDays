"""Berichte und Listen (0547, Vertrag §4.1/§4.2) — fünfzehn Auswertungen, EINE Form.

Warum eine Registry und nicht fünfzehn Endpunkte: die fünfzehn Berichte
unterscheiden sich in genau drei Dingen — welche Spalten sie haben, wer sie
sehen darf, und welche Zeilen sie bauen. Alles andere (Zeitraum-Deckel,
Personen-Scope, Filter, Summenzeile, CSV) ist bei allen gleich. Fünfzehn
Endpunkte hätten diesen Rest fünfzehnmal — und jede Änderung an einer Stelle
wäre vierzehnmal vergessen worden.

Scope (Wurzel 3/9): Team-Berichte zeigen ausschließlich Personen aus
`_personen_im_scope`; Export-Berichte verlangen darüber hinaus die Rolle
admin/co_admin FRISCH AUS DER DB (Wurzel 7) — eine entzogene Rolle wirkt
sonst bis zum Token-Ablauf weiter.

Geld (Wurzel 4): fehlt Stundenlohn oder Währung, steht `None` in der Zelle und
der Grund in `hinweise`. Mischen sich Währungen im Betrieb, ist `currency`
`None` und der Bericht sagt das — nie „EUR" als Notlösung, nie 0 als Betrag.
"""

# pylint: disable=too-many-lines  # fünfzehn Berichte + ihr Verzeichnis in EINER
# Datei. Die Registry (`BERICHTE`) verweist auf die Bau-Methoden von
# `BerichteService`; eine eigene Datei dafür bräuchte einen Rückimport auf die
# Klasse und damit einen Import-Zirkel. Die Alternative — Registry in der Klasse
# — geht nicht, weil dort ihre eigenen Methoden noch nicht referenzierbar sind.
# Derselbe Weg wie in `worker.py` (Registry + Ticks) und `service.py`.
from __future__ import annotations

import csv
import io
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from typing import Any

from src.core.security import AuthContext

from . import regelwerk as rw
from ._base import (
    LEITUNG,
    PLANBARE_ROLLEN,
    PersonalBase,
    PersonalError,
    als_date,
    als_dec,
    als_dt,
    als_float,
    log,
)
from .auswertung import arbeitgeber_satz, kosten_satz
from .berichte_schemas import (
    MAX_BERICHT_TAGE,
    BerichtCapability,
    BerichtFilter,
    BerichtGruppe,
    BerichtKatalogItem,
    BerichtResponse,
    Spalte,
)

_AKTIVE_SCHICHT = ("entwurf", "veroeffentlicht", "bestaetigt")
_ZEIT_GUELTIG = ("abgeschlossen", "bestaetigt")
_URLAUBSARTEN = ("urlaub", "sonderurlaub")
_WOCHENTAGE = ("Mo", "Di", "Mi", "Do", "Fr", "Sa", "So")
# Verdienstgrenze: ab 85 % gilt sie als „knapp" — der Betrieb soll gegensteuern
# können, bevor sie reißt. Die Zahl ist eine Anzeigeschwelle, kein Rechtswert.
_KNAPP_AB_PCT = 85.0
# Fristen: „bald" ist der Vorlauf, den eine Nachschulung/ein Attest braucht.
_FRIST_BALD_TAGE = 60
# Soll/Ist gilt als „ok", solange Plan und Ist um höchstens eine Viertelstunde
# auseinanderliegen — darunter ist es Stempelrauschen, keine Abweichung.
_ABWEICHUNG_OK_MIN = 15


@dataclass(frozen=True, slots=True)
class BerichtDef:
    """Ein Bericht: Gruppe, Rechte, Filter, Spalten, Zeilenbauer."""

    name: str
    gruppe: BerichtGruppe
    capability: BerichtCapability
    filter: tuple[BerichtFilter, ...]
    spalten: tuple[Spalte, ...]
    bauen: Callable[[BerichteService, _Kontext], list[dict[str, Any]]]
    # fristen/mitarbeiter/verdienstgrenzen sind Zustandslisten (jetzt gültig),
    # kein Zeitraum — von/bis sind dort optional und wirken nur als Ausschnitt.
    zeitraum_pflicht: bool = True


@dataclass
class _Kontext:
    """Alles, was ein Zeilenbauer braucht — einmal geladen, nicht je Bericht neu."""

    ctx: AuthContext
    tenant_id: str
    von: date
    bis: date
    zeitraum_gesetzt: bool
    user_ids: set[str]
    users: dict[str, dict[str, Any]]
    akten: dict[str, dict[str, Any]]
    firmen: dict[str, dict[str, Any]]
    bereiche: dict[str, dict[str, Any]]
    titel: dict[str, str]
    regeln: rw.Regeln | None
    regeln_row: dict[str, Any]
    feiertage: dict[date, str]
    arbeitsbereich_id: str | None
    property_id: str | None
    hinweise: list[str] = field(default_factory=list)
    currencies: set[str] = field(default_factory=set)
    _ohne_lohn: set[str] = field(default_factory=set)

    def name_von(self, user_id: str) -> str:
        return str((self.users.get(user_id) or {}).get("full_name") or user_id)

    def personen_sortiert(self) -> list[str]:
        return sorted(self.users, key=lambda u: (self.name_von(u).casefold(), u))

    def bereich_name(self, bereich_id: str | None) -> str:
        if not bereich_id:
            return ""
        return str((self.bereiche.get(bereich_id) or {}).get("name") or "")

    def satz(self, user_id: str, *, mit_aufschlag: bool = False) -> tuple[int | None, str | None]:
        """Stundensatz der Person; merkt sich fehlende Sätze und Währungen."""
        akte = self.akten.get(user_id) or {}
        firma = self.firmen.get(str(akte.get("firma_id") or ""))
        rechner = arbeitgeber_satz if mit_aufschlag else kosten_satz
        minor, waehrung = rechner(akte, firma)
        if minor is None or not waehrung:
            self._ohne_lohn.add(user_id)
            return None, None
        self.currencies.add(waehrung)
        return minor, waehrung

    def waehrung(self) -> str | None:
        """Die EINE Währung des Berichts — bei Mischung None plus Hinweis."""
        if len(self.currencies) == 1:
            return next(iter(self.currencies))
        if len(self.currencies) > 1:
            self.hinweise.append(
                "Gemischte Währungen ("
                + ", ".join(sorted(self.currencies))
                + "): Geldspalten sind nicht vergleichbar und bleiben leer."
            )
        return None

    def abschluss(self) -> None:
        """Hinweise, die erst nach allen Zeilen feststehen."""
        if self._ohne_lohn:
            namen = sorted(self.name_von(u) for u in self._ohne_lohn)
            self.hinweise.append(
                f"Ohne Stundenlohn oder Währung (keine Beträge gerechnet): {', '.join(namen)}."
            )


def _sp(key: str, typ: str, *, summe: bool = False) -> Spalte:
    return Spalte(key=key, typ=typ, summe=summe)  # type: ignore[arg-type]


class BerichteService(PersonalBase):
    """Katalog, Bericht, CSV. Der Rechenweg je Bericht steht in `_b_*`."""

    # ------------------------------------------------------------------
    # Katalog
    # ------------------------------------------------------------------

    def katalog(self, ctx: AuthContext) -> list[BerichtKatalogItem]:
        """Nur die Berichte, die der Aufrufer sehen darf (§4.1)."""
        tenant_id = self._require_tenant(ctx)
        darf_export = self._darf_export(ctx, tenant_id)
        return [
            BerichtKatalogItem(
                name=d.name,
                gruppe=d.gruppe,
                filter=list(d.filter),
                capability=d.capability,
                formate=["json", "csv"],
            )
            for d in BERICHTE.values()
            if darf_export or d.capability != "export_lohn"
        ]

    def _darf_export(self, ctx: AuthContext, tenant_id: str) -> bool:
        """EXPORT_LOHN im Token UND Leitungsrolle frisch aus der DB (Wurzel 7)."""
        return self._rolle_aus_db(ctx, tenant_id) in LEITUNG

    # ------------------------------------------------------------------
    # Bericht
    # ------------------------------------------------------------------

    def bericht(  # noqa: PLR0913 — ein Bericht hat fünf Filter, das ist der Vertrag
        self,
        ctx: AuthContext,
        name: str,
        *,
        von: date | None = None,
        bis: date | None = None,
        arbeitsbereich_id: str | None = None,
        property_id: str | None = None,
        user_id: str | None = None,
        beschaeftigungsart: str | None = None,
    ) -> BerichtResponse:
        tenant_id = self._require_tenant(ctx)
        definition = BERICHTE.get(name)
        if definition is None:
            raise PersonalError(
                "Diesen Bericht gibt es nicht.",
                status_code=404,
                details={"code": "bericht_unbekannt"},
            )
        if definition.capability == "export_lohn" and not self._darf_export(ctx, tenant_id):
            # Dieselbe Meldung wie „gibt es nicht": kein Existenz-Leak (Wurzel 9).
            raise PersonalError(
                "Diesen Bericht gibt es nicht.",
                status_code=404,
                details={"code": "bericht_unbekannt"},
            )
        kontext = self._kontext(
            ctx,
            tenant_id,
            definition,
            von=von,
            bis=bis,
            arbeitsbereich_id=arbeitsbereich_id,
            property_id=property_id,
            user_id=user_id,
            beschaeftigungsart=beschaeftigungsart,
        )
        zeilen = definition.bauen(self, kontext)
        kontext.abschluss()
        currency = kontext.waehrung()
        if currency is None:
            zeilen = [self._geld_leeren(definition, z) for z in zeilen]
        summen = self._summen(definition, zeilen)
        return BerichtResponse(
            name=name,
            von=kontext.von if kontext.zeitraum_gesetzt else None,
            bis=kontext.bis if kontext.zeitraum_gesetzt else None,
            currency=currency,
            hinweise=kontext.hinweise,
            erzeugt_am=datetime.now(UTC),
            spalten=list(definition.spalten),
            zeilen=zeilen,
            summen=summen,
            anzahl=len(zeilen),
        )

    @staticmethod
    def _geld_leeren(definition: BerichtDef, zeile: dict[str, Any]) -> dict[str, Any]:
        """Ohne EINE Währung ist kein Betrag vergleichbar → Zelle leer, nicht 0."""
        for s in definition.spalten:
            if s.typ == "geld" and s.key in zeile:
                zeile[s.key] = None
        return zeile

    @staticmethod
    def _summen(definition: BerichtDef, zeilen: list[dict[str, Any]]) -> dict[str, Any] | None:
        keys = [s.key for s in definition.spalten if s.summe]
        if not keys:
            return None
        aus: dict[str, Any] = {}
        for key in keys:
            werte = [z.get(key) for z in zeilen if isinstance(z.get(key), (int, float))]
            if not werte:
                aus[key] = None
                continue
            summe = sum(werte)
            aus[key] = round(summe, 2) if any(isinstance(w, float) for w in werte) else summe
        return aus

    # ------------------------------------------------------------------
    # Kontext laden
    # ------------------------------------------------------------------

    def _kontext(  # noqa: PLR0913 — die Filter des Vertrags, einmal aufgelöst
        self,
        ctx: AuthContext,
        tenant_id: str,
        definition: BerichtDef,
        *,
        von: date | None,
        bis: date | None,
        arbeitsbereich_id: str | None,
        property_id: str | None,
        user_id: str | None,
        beschaeftigungsart: str | None,
    ) -> _Kontext:
        zeitraum_gesetzt = von is not None and bis is not None
        if definition.zeitraum_pflicht and not zeitraum_gesetzt:
            raise PersonalError(
                "Dieser Bericht braucht einen Zeitraum (von, bis).",
                status_code=422,
                details={"code": "zeitraum_fehlt"},
            )
        if von is not None and bis is not None:
            if bis < von:
                raise PersonalError(
                    "Ende liegt vor dem Beginn.",
                    status_code=422,
                    details={"code": "zeitraum_ungueltig"},
                )
            if (bis - von).days > MAX_BERICHT_TAGE:
                raise PersonalError(
                    f"Zeitraum zu lang (höchstens {MAX_BERICHT_TAGE} Tage).",
                    status_code=422,
                    details={"code": "zeitraum_zu_lang", "max_tage": MAX_BERICHT_TAGE},
                )
        heute = datetime.now(UTC).date()
        von_eff = von or date(heute.year, 1, 1)
        bis_eff = bis or date(heute.year, 12, 31)
        ids = self._personen_im_scope(ctx, tenant_id)
        if user_id is not None:
            # Item-Level wie die Liste (Wurzel 9): eine fremde ID gibt nichts.
            self._require_person_im_scope(ctx, tenant_id, user_id)
            ids &= {user_id}
        users = {
            str(u["id"]): u
            for u in self._users(tenant_id, ids)
            if str(u.get("role")) in PLANBARE_ROLLEN
        }
        akten = self._akten(tenant_id, set(users))
        if beschaeftigungsart is not None:
            users = {
                uid: u
                for uid, u in users.items()
                if (akten.get(uid) or {}).get("beschaeftigungsart") == beschaeftigungsart
            }
            akten = {uid: a for uid, a in akten.items() if uid in users}
        if property_id is not None:
            self._property_im_tenant(tenant_id, property_id)
            zugeteilt = self._personen_am_objekt(tenant_id, property_id)
            users = {uid: u for uid, u in users.items() if uid in zugeteilt}
            akten = {uid: a for uid, a in akten.items() if uid in users}
        regeln_row = self._regeln_row(tenant_id) or {}
        hinweise: list[str] = []
        regeln: rw.Regeln | None
        try:
            regeln = self._regeln(tenant_id)
        except PersonalError as exc:
            regeln = None
            hinweise.append(exc.message)
        feiertage: dict[date, str] = {}
        if regeln is not None:
            try:
                feiertage = self._feiertage(tenant_id, von_eff, bis_eff)
            except PersonalError as exc:
                hinweise.append(exc.message)
        return _Kontext(
            ctx=ctx,
            tenant_id=tenant_id,
            von=von_eff,
            bis=bis_eff,
            zeitraum_gesetzt=zeitraum_gesetzt,
            user_ids=set(users),
            users=users,
            akten=akten,
            firmen=self._firmen(tenant_id),
            bereiche=self._bereiche(tenant_id),
            titel=self._alle_titel(tenant_id),
            regeln=regeln,
            regeln_row=regeln_row,
            feiertage=feiertage,
            arbeitsbereich_id=arbeitsbereich_id,
            property_id=property_id,
            hinweise=hinweise,
        )

    def _personen_am_objekt(self, tenant_id: str, property_id: str) -> set[str]:
        rows = (
            self._db.table("staff_property_assignments")
            .select("user_id")
            .eq("tenant_id", tenant_id)
            .eq("property_id", property_id)
            .execute()
        ).data or []
        return {str(r["user_id"]) for r in rows}

    def _firmen(self, tenant_id: str) -> dict[str, dict[str, Any]]:
        rows = (
            self._db.table("personal_fremdfirmen")
            .select("*")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        return {str(r["id"]): r for r in rows}

    def _bereiche(self, tenant_id: str) -> dict[str, dict[str, Any]]:
        rows = (
            self._db.table("personal_arbeitsbereiche")
            .select("id, name, kurz, sort")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        return {str(r["id"]): r for r in rows}

    def _alle_titel(self, tenant_id: str) -> dict[str, str]:
        rows = (
            self._db.table("properties")
            .select("id, title")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        return {str(r["id"]): str(r.get("title") or "") for r in rows}

    # ------------------------------------------------------------------
    # Rohdaten (je Bericht nur, was er braucht)
    # ------------------------------------------------------------------

    def _zeiten(self, k: _Kontext) -> list[dict[str, Any]]:
        if not k.user_ids:
            return []
        rows = (
            self._db.table("personal_zeiterfassung")
            .select(
                "id, user_id, start_at, end_at, pausen, property_id, schicht_id, status, "
                "verspaetung_min"
            )
            .eq("tenant_id", k.tenant_id)
            .in_("user_id", sorted(k.user_ids))
            .gte("start_at", _tag_start(k.von))
            .lt("start_at", _tag_start(k.bis + timedelta(days=1)))
            .execute()
        ).data or []
        rows = [r for r in rows if r.get("status") in _ZEIT_GUELTIG]
        if k.property_id is not None:
            rows = [r for r in rows if str(r.get("property_id") or "") == k.property_id]
        return rows

    def _schichten(self, k: _Kontext, *, mit_offenen: bool = False) -> list[dict[str, Any]]:
        """Aktive Schichten im Fenster. `mit_offenen` nimmt Hüllen ohne Person mit."""
        q = (
            self._db.table("personal_schichten")
            .select(
                "id, user_id, datum, start_at, end_at, pause_min, arbeitsbereich_id, "
                "property_id, status, notiz"
            )
            .eq("tenant_id", k.tenant_id)
            .gte("datum", k.von.isoformat())
            .lte("datum", k.bis.isoformat())
        )
        rows = q.execute().data or []
        aus = []
        for r in rows:
            if r.get("status") not in _AKTIVE_SCHICHT:
                continue
            uid = str(r.get("user_id") or "")
            if uid:
                if uid not in k.user_ids:
                    continue
            elif not mit_offenen:
                continue
            if k.arbeitsbereich_id and str(r.get("arbeitsbereich_id") or "") != k.arbeitsbereich_id:
                continue
            if k.property_id and str(r.get("property_id") or "") != k.property_id:
                continue
            aus.append(r)
        return aus

    def _abwesenheiten(self, k: _Kontext) -> list[dict[str, Any]]:
        if not k.user_ids:
            return []
        return (
            self._db.table("personal_abwesenheiten")
            .select(
                "id, user_id, art, von, bis, halbtag_start, halbtag_ende, tage_berechnet, "
                "status, entschieden_von, entschieden_am, created_at"
            )
            .eq("tenant_id", k.tenant_id)
            .in_("user_id", sorted(k.user_ids))
            .lte("von", k.bis.isoformat())
            .gte("bis", k.von.isoformat())
            .execute()
        ).data or []

    def _azk_saldo(self, k: _Kontext) -> dict[str, int]:
        if not k.user_ids:
            return {}
        rows = (
            self._db.table("personal_arbeitszeitkonten")
            .select("user_id, minuten")
            .eq("tenant_id", k.tenant_id)
            .in_("user_id", sorted(k.user_ids))
            .execute()
        ).data or []
        aus: dict[str, int] = {}
        for r in rows:
            uid = str(r["user_id"])
            aus[uid] = aus.get(uid, 0) + int(r.get("minuten") or 0)
        return aus

    def _guttage(self, k: _Kontext) -> dict[str, float]:
        if not k.user_ids:
            return {}
        rows = (
            self._db.table("personal_guttage")
            .select("user_id, tage")
            .eq("tenant_id", k.tenant_id)
            .in_("user_id", sorted(k.user_ids))
            .execute()
        ).data or []
        aus: dict[str, float] = {}
        for r in rows:
            uid = str(r["user_id"])
            aus[uid] = aus.get(uid, 0.0) + float(als_dec(r.get("tage")))
        return aus

    def _umsatz_je_tag(self, k: _Kontext) -> tuple[dict[date, int], str | None]:
        """Umsatz je Tag nach §2.1: Nachtanteil der Buchungen, Umsatzbuch übersteuert.

        Verschiedene Objektwährungen im Fenster → `(leer, None)` + Hinweis; ein
        gemischter Umsatz ist keine Zahl (Wurzel 4).
        """
        rows = (
            self._db.table("reservations")
            .select("check_in, check_out, total_amount, currency, status, is_owner_stay")
            .eq("tenant_id", k.tenant_id)
            .lte("check_in", k.bis.isoformat())
            .gt("check_out", k.von.isoformat())
            .execute()
        ).data or []
        je_tag: dict[date, Decimal] = {}
        waehrungen: set[str] = set()
        for r in rows:
            if r.get("status") not in ("confirmed", "completed") or r.get("is_owner_stay"):
                continue
            ein, aus = als_date(r.get("check_in")), als_date(r.get("check_out"))
            if ein is None or aus is None or aus <= ein:
                continue
            naechte = (aus - ein).days
            betrag = als_dec(r.get("total_amount")) / naechte
            cur = str(r.get("currency") or "")
            if not cur:
                k.hinweise.append("Buchung ohne Währung: Umsatz nicht gerechnet.")
                continue
            waehrungen.add(cur)
            tag = ein
            while tag < aus:
                if k.von <= tag <= k.bis:
                    je_tag[tag] = je_tag.get(tag, Decimal(0)) + betrag
                tag += timedelta(days=1)
        buch = (
            self._db.table("personal_umsatzbuch")
            .select("datum, arbeitsbereich_id, plan_minor, ist_minor, currency, quelle")
            .eq("tenant_id", k.tenant_id)
            .gte("datum", k.von.isoformat())
            .lte("datum", k.bis.isoformat())
            .execute()
        ).data or []
        umsatzbuch: dict[date, int] = {}
        for r in buch:
            if r.get("arbeitsbereich_id") or r.get("quelle") == "buchungen":
                continue
            tag = als_date(r.get("datum"))
            wert = r.get("ist_minor")
            if wert is None:
                wert = r.get("plan_minor")
            if tag is None or wert is None:
                continue
            waehrungen.add(str(r.get("currency") or ""))
            umsatzbuch[tag] = int(wert)
        if len(waehrungen - {""}) > 1:
            k.hinweise.append(
                "Gemischte Umsatzwährungen ("
                + ", ".join(sorted(w for w in waehrungen if w))
                + "): Umsatz bleibt leer."
            )
            return {}, None
        waehrung = next(iter(waehrungen - {""}), None)
        aus_tage = {t: int(round(b * 100)) for t, b in je_tag.items()}
        aus_tage.update(umsatzbuch)
        return aus_tage, waehrung

    # ------------------------------------------------------------------
    # Hilfen für die Zeilenbauer
    # ------------------------------------------------------------------

    def _netto_und_zuschlaege(self, k: _Kontext, zeit: dict[str, Any]) -> tuple[int, int, int, int]:
        """(netto, nacht, sonntag, feiertag) einer Stempelung."""
        start, ende = als_dt(zeit.get("start_at")), als_dt(zeit.get("end_at"))
        if start is None or ende is None:
            return 0, 0, 0, 0
        pause = rw.pausen_minuten(list(zeit.get("pausen") or []))
        if k.regeln is None:
            return rw.netto_minuten(start, ende, pause), 0, 0, 0
        z = rw.zuschlaege_berechnen(
            start, ende, pause, regeln=k.regeln, feiertage=set(k.feiertage)
        )
        return z.netto_min, z.nacht_min, z.sonntag_min, z.feiertag_min

    @staticmethod
    def _plan_netto(schicht: dict[str, Any]) -> int:
        start, ende = als_dt(schicht.get("start_at")), als_dt(schicht.get("end_at"))
        if start is None or ende is None:
            return 0
        return rw.netto_minuten(start, ende, int(schicht.get("pause_min") or 0))

    def _soll_minuten(self, k: _Kontext, user_id: str, von: date, bis: date) -> int | None:
        """Sollminuten aus Wochenstunden × Arbeitstagen (ohne Feiertage).

        Ohne `wochenstunden` in der Akte gibt es kein Soll — `None` und ein
        Hinweis, nie 0 (eine 0 sähe wie „hat nichts zu arbeiten" aus).
        """
        akte = k.akten.get(user_id) or {}
        wochenstunden = akte.get("wochenstunden")
        if wochenstunden is None:
            return None
        arbeitstage = self._arbeitstage(akte)
        tage = rw.arbeitstage_zaehlen(
            von, bis, arbeitstage=arbeitstage, feiertage=set(k.feiertage)
        )
        je_tag = float(wochenstunden) * 60 / max(1, len(arbeitstage))
        return round(tage * je_tag)

    def _urlaubskonten(self, k: _Kontext) -> dict[str, Any]:
        """Urlaubskonto je Person über den bestehenden Dienst (EINE Rechnung)."""
        from .abwesenheiten import AbwesenheitenService  # noqa: PLC0415 — Zyklus vermeiden

        if k.regeln is None:
            return {}
        svc = AbwesenheitenService(self._db)
        jahr = k.von.year if k.von.month >= k.regeln.urlaubsjahr_start_monat else k.von.year - 1
        aus: dict[str, Any] = {}
        for uid in k.user_ids:
            try:
                aus[uid] = svc.urlaubskonto(k.ctx, uid, jahr, intern=True)
            except PersonalError as exc:  # eine Person ohne Konto kippt nicht den Bericht
                log.warning("personal_bericht_urlaubskonto", user_id=uid, error=exc.message)
        return aus

    # ------------------------------------------------------------------
    # Die fünfzehn Zeilenbauer
    # ------------------------------------------------------------------

    def _b_stundenkonten(self, k: _Kontext) -> list[dict[str, Any]]:
        zeiten = self._zeiten(k)
        azk = self._azk_saldo(k)
        guttage = self._guttage(k)
        konten = self._urlaubskonten(k)
        ist_je_person: dict[str, int] = {}
        for z in zeiten:
            netto, _, _, _ = self._netto_und_zuschlaege(k, z)
            uid = str(z["user_id"])
            ist_je_person[uid] = ist_je_person.get(uid, 0) + netto
        ohne_soll: list[str] = []
        zeilen = []
        for uid in k.personen_sortiert():
            akte = k.akten.get(uid) or {}
            soll = self._soll_minuten(k, uid, k.von, k.bis)
            ist = ist_je_person.get(uid, 0)
            if soll is None:
                ohne_soll.append(k.name_von(uid))
            konto = konten.get(uid)
            zeilen.append(
                {
                    "person": k.name_von(uid),
                    "personalnummer": akte.get("employee_number"),
                    "beschaeftigungsart": akte.get("beschaeftigungsart"),
                    "soll_minuten": soll,
                    "ist_minuten": ist,
                    "saldo_monat_minuten": None if soll is None else ist - soll,
                    "azk_saldo_minuten": azk.get(uid, 0),
                    "guttage": round(guttage.get(uid, 0.0), 2),
                    "urlaub_rest": round(konto.rest, 2) if konto is not None else None,
                }
            )
        if ohne_soll:
            k.hinweise.append(
                "Ohne Wochenstunden in der Akte (kein Soll gerechnet): "
                + ", ".join(sorted(ohne_soll))
                + "."
            )
        return zeilen

    def _b_soll_ist(self, k: _Kontext) -> list[dict[str, Any]]:
        zone = k.regeln.zeitzone if k.regeln else "UTC"
        plan: dict[tuple[str, date], int] = {}
        for s in self._schichten(k):
            uid = str(s.get("user_id") or "")
            tag = als_date(s.get("datum"))
            if not uid or tag is None:
                continue
            plan[(uid, tag)] = plan.get((uid, tag), 0) + self._plan_netto(s)
        ist: dict[tuple[str, date], int] = {}
        for z in self._zeiten(k):
            start = als_dt(z.get("start_at"))
            if start is None:
                continue
            netto, _, _, _ = self._netto_und_zuschlaege(k, z)
            schluessel = (str(z["user_id"]), rw.ortstag(start, zone))
            ist[schluessel] = ist.get(schluessel, 0) + netto
        zeilen = []
        for uid, tag in sorted(
            set(plan) | set(ist), key=lambda p: (p[1], k.name_von(p[0]).casefold())
        ):
            p, i = plan.get((uid, tag), 0), ist.get((uid, tag), 0)
            if p and i:
                status = "ok" if abs(i - p) <= _ABWEICHUNG_OK_MIN else "abweichung"
            elif p:
                status = "fehlt"
            else:
                status = "ohne_plan"
            zeilen.append(
                {
                    "datum": tag,
                    "person": k.name_von(uid),
                    "plan_minuten": p,
                    "ist_minuten": i,
                    "differenz_minuten": i - p,
                    "status": status,
                }
            )
        return zeilen

    def _b_zuschlaege(self, k: _Kontext) -> list[dict[str, Any]]:
        if k.regeln is None:
            k.hinweise.append("Ohne bestätigte Betriebsregeln gibt es keine Zuschläge.")
        zeiten = self._zeiten(k)
        zeilen = []
        for uid in k.personen_sortiert():
            nacht = sonntag = feiertag = ist = 0
            for z in zeiten:
                if str(z["user_id"]) != uid:
                    continue
                netto, n, s, f = self._netto_und_zuschlaege(k, z)
                ist += netto
                nacht += n
                sonntag += s
                feiertag += f
            soll = self._soll_minuten(k, uid, k.von, k.bis)
            extern = (k.akten.get(uid) or {}).get("beschaeftigungsart") == "extern"
            ueber = max(0, ist - soll) if soll and not extern else 0
            satz, _ = k.satz(uid)
            if satz is None or k.regeln is None:
                betraege: dict[str, int | None] = dict.fromkeys(
                    ("nacht_minor", "sonntag_minor", "feiertag_minor", "ueberstunden_minor"), None
                )
                summe: int | None = None
            else:
                betraege = {
                    "nacht_minor": rw.zuschlag_betrag_minor(
                        satz, nacht, k.regeln.zuschlag_nacht_pct
                    ),
                    "sonntag_minor": rw.zuschlag_betrag_minor(
                        satz, sonntag, k.regeln.zuschlag_sonntag_pct
                    ),
                    "feiertag_minor": rw.zuschlag_betrag_minor(
                        satz, feiertag, k.regeln.zuschlag_feiertag_pct
                    ),
                    "ueberstunden_minor": rw.zuschlag_betrag_minor(
                        satz, ueber, k.regeln.zuschlag_ueberstunden_pct
                    ),
                }
                summe = sum(int(v) for v in betraege.values())
            zeilen.append(
                {
                    "person": k.name_von(uid),
                    "nacht_minuten": nacht,
                    "sonntag_minuten": sonntag,
                    "feiertag_minuten": feiertag,
                    "ueberstunden_minuten": ueber,
                    **betraege,
                    "summe_minor": summe,
                }
            )
        return zeilen

    def _b_personalkosten(self, k: _Kontext) -> list[dict[str, Any]]:
        """Tag × Bereich: Plan- und Ist-Minuten mit Kosten, Fremdanteil getrennt.

        Den Bereich einer Stempelung liefert die Schicht, mit der sie verknüpft
        ist (`schicht_id`) — die Zeiterfassung selbst kennt keinen Bereich.
        Ohne Schicht steht die Zeit unter „ohne Bereich", nicht unter einem
        geratenen (Wurzel 4).
        """
        zone = k.regeln.zeitzone if k.regeln else "UTC"
        schichten = self._schichten(k)
        bereich_je_schicht = {
            str(s["id"]): (
                str(s.get("arbeitsbereich_id") or ""),
                str(s.get("property_id") or ""),
            )
            for s in schichten
        }
        eintraege: dict[tuple[date, str, str], dict[str, Any]] = {}

        def eintrag(tag: date, bereich: str, objekt: str) -> dict[str, Any]:
            return eintraege.setdefault(
                (tag, bereich, objekt),
                {
                    "plan_minuten": 0,
                    "ist_minuten": 0,
                    "kosten_plan_minor": 0,
                    "kosten_ist_minor": 0,
                    "davon_fremd_minor": 0,
                    "geld": True,
                },
            )

        for s in schichten:
            uid = str(s.get("user_id") or "")
            tag = als_date(s.get("datum"))
            if tag is None:
                continue
            e = eintrag(tag, str(s.get("arbeitsbereich_id") or ""), str(s.get("property_id") or ""))
            netto = self._plan_netto(s)
            e["plan_minuten"] += netto
            satz, _ = k.satz(uid, mit_aufschlag=True) if uid else (None, None)
            if satz is None:
                e["geld"] = False
            else:
                e["kosten_plan_minor"] += round(satz * netto / 60)
        for z in self._zeiten(k):
            start = als_dt(z.get("start_at"))
            if start is None:
                continue
            uid = str(z["user_id"])
            bereich, objekt = bereich_je_schicht.get(str(z.get("schicht_id") or ""), ("", ""))
            objekt = str(z.get("property_id") or "") or objekt
            if k.arbeitsbereich_id and bereich != k.arbeitsbereich_id:
                continue
            netto, _, _, _ = self._netto_und_zuschlaege(k, z)
            e = eintrag(rw.ortstag(start, zone), bereich, objekt)
            e["ist_minuten"] += netto
            satz, _ = k.satz(uid, mit_aufschlag=True)
            if satz is None:
                e["geld"] = False
                continue
            betrag = round(satz * netto / 60)
            e["kosten_ist_minor"] += betrag
            if (k.akten.get(uid) or {}).get("beschaeftigungsart") == "extern":
                e["davon_fremd_minor"] += betrag
        zeilen = []
        for (tag, bereich, objekt), e in sorted(
            eintraege.items(), key=lambda kv: (kv[0][0], k.bereich_name(kv[0][1]), kv[0][2])
        ):
            geld = e.pop("geld")
            zeilen.append(
                {
                    "datum": tag,
                    "arbeitsbereich": k.bereich_name(bereich),
                    "objekt": k.titel.get(objekt, "") if objekt else "",
                    "plan_minuten": e["plan_minuten"],
                    "ist_minuten": e["ist_minuten"],
                    "kosten_plan_minor": e["kosten_plan_minor"] if geld else None,
                    "kosten_ist_minor": e["kosten_ist_minor"] if geld else None,
                    "davon_fremd_minor": e["davon_fremd_minor"] if geld else None,
                }
            )
        return zeilen

    def _b_pkq_verlauf(self, k: _Kontext) -> list[dict[str, Any]]:
        """Tag: Umsatz, Kosten, Personalkostenquote, Produktivität (§2.1-Definitionen).

        Vergangenheit rechnet Ist/Ist, Zukunft Plan/Plan — sonst stünde eine
        Quote von 300 % im Plan, nur weil die Zeiten noch nicht gestempelt sind.
        """
        heute = datetime.now(UTC).date()
        umsatz, umsatz_currency = self._umsatz_je_tag(k)
        if umsatz_currency:
            k.currencies.add(umsatz_currency)
        zone = k.regeln.zeitzone if k.regeln else "UTC"
        plan_min: dict[date, int] = {}
        plan_kosten: dict[date, int] = {}
        plan_geld: dict[date, bool] = {}
        for s in self._schichten(k):
            tag = als_date(s.get("datum"))
            if tag is None:
                continue
            netto = self._plan_netto(s)
            plan_min[tag] = plan_min.get(tag, 0) + netto
            uid = str(s.get("user_id") or "")
            satz, _ = k.satz(uid, mit_aufschlag=True) if uid else (None, None)
            if satz is None:
                plan_geld[tag] = False
            else:
                plan_kosten[tag] = plan_kosten.get(tag, 0) + round(satz * netto / 60)
        ist_min: dict[date, int] = {}
        ist_kosten: dict[date, int] = {}
        ist_geld: dict[date, bool] = {}
        for z in self._zeiten(k):
            start = als_dt(z.get("start_at"))
            if start is None:
                continue
            tag = rw.ortstag(start, zone)
            netto, _, _, _ = self._netto_und_zuschlaege(k, z)
            ist_min[tag] = ist_min.get(tag, 0) + netto
            satz, _ = k.satz(str(z["user_id"]), mit_aufschlag=True)
            if satz is None:
                ist_geld[tag] = False
            else:
                ist_kosten[tag] = ist_kosten.get(tag, 0) + round(satz * netto / 60)
        ziel_quote = als_float(k.regeln_row.get("ziel_personalkostenquote_pct"))
        ziel_prod = k.regeln_row.get("ziel_umsatzproduktivitaet_minor")
        ziel_prod = int(ziel_prod) if ziel_prod is not None else None
        zeilen = []
        tag = k.von
        while tag <= k.bis:
            vergangen = tag < heute
            minuten = ist_min.get(tag, 0) if vergangen else plan_min.get(tag, 0)
            if vergangen:
                kosten = ist_kosten.get(tag) if ist_geld.get(tag, True) else None
            else:
                kosten = plan_kosten.get(tag) if plan_geld.get(tag, True) else None
            u = umsatz.get(tag)
            quote = None
            if u and kosten is not None:
                quote = round(kosten / u * 100, 2)
            prod = None
            if u is not None and minuten > 0:
                prod = round(u / (minuten / 60))
            limit = None
            if u is not None and ziel_prod:
                limit = round(u / ziel_prod * 60)
            zeilen.append(
                {
                    "datum": tag,
                    "umsatz_minor": u,
                    "kosten_minor": kosten,
                    "quote_pct": quote,
                    "ziel_quote_pct": ziel_quote,
                    "produktivitaet_minor": prod,
                    "ziel_produktivitaet_minor": ziel_prod,
                    "stundenlimit_minuten": limit,
                    "plan_minuten": plan_min.get(tag, 0),
                }
            )
            tag += timedelta(days=1)
        return zeilen

    def _b_produktivitaet(self, k: _Kontext) -> list[dict[str, Any]]:
        """Bereich: geleistete Minuten, Umsatzanteil nach Minuten geschlüsselt.

        Der Umsatz hängt am Betrieb, nicht am Bereich — der Anteil wird nach
        Minuten geschlüsselt und im Hinweis als Schlüsselung benannt, damit
        niemand ihn für einen gemessenen Bereichsumsatz hält.
        """
        umsatz, umsatz_currency = self._umsatz_je_tag(k)
        if umsatz_currency:
            k.currencies.add(umsatz_currency)
        gesamt_umsatz = sum(umsatz.values()) if umsatz else None
        schichten = self._schichten(k)
        bereich_je_schicht = {
            str(s["id"]): str(s.get("arbeitsbereich_id") or "") for s in schichten
        }
        eintraege: dict[str, dict[str, Any]] = {}
        for z in self._zeiten(k):
            bereich = bereich_je_schicht.get(str(z.get("schicht_id") or ""), "")
            if k.arbeitsbereich_id and bereich != k.arbeitsbereich_id:
                continue
            netto, _, _, _ = self._netto_und_zuschlaege(k, z)
            e = eintraege.setdefault(
                bereich, {"minuten": 0, "einsaetze": 0, "personen": set()}
            )
            e["minuten"] += netto
            e["einsaetze"] += 1
            e["personen"].add(str(z["user_id"]))
        gesamt_minuten = sum(int(e["minuten"]) for e in eintraege.values())
        if gesamt_umsatz is not None and eintraege:
            k.hinweise.append(
                "Der Umsatzanteil je Bereich ist nach geleisteten Minuten geschlüsselt "
                "(der Umsatz wird am Betrieb gemessen, nicht am Bereich)."
            )
        zeilen = []
        for bereich, e in sorted(eintraege.items(), key=lambda kv: -int(kv[1]["minuten"])):
            minuten = int(e["minuten"])
            anteil = None
            if gesamt_umsatz is not None and gesamt_minuten > 0:
                anteil = round(gesamt_umsatz * minuten / gesamt_minuten)
            prod = None
            if anteil is not None and minuten > 0:
                prod = round(anteil / (minuten / 60))
            zeilen.append(
                {
                    "arbeitsbereich": k.bereich_name(bereich),
                    "minuten": minuten,
                    "umsatz_anteil_minor": anteil,
                    "produktivitaet_minor": prod,
                    "einsaetze": int(e["einsaetze"]),
                    "personen": len(e["personen"]),
                }
            )
        return zeilen

    def _b_urlaub(self, k: _Kontext) -> list[dict[str, Any]]:
        konten = self._urlaubskonten(k)
        if not konten and k.user_ids:
            k.hinweise.append(
                "Ohne bestätigte Betriebsregeln (Urlaubsjahr) gibt es keine Urlaubskonten."
            )
        zeilen = []
        for uid in k.personen_sortiert():
            konto = konten.get(uid)
            if konto is None:
                zeilen.append(
                    {
                        "person": k.name_von(uid),
                        "anspruch": None,
                        "uebertrag": None,
                        "genommen": None,
                        "beantragt": None,
                        "rest": None,
                        "verfall_am": None,
                    }
                )
                continue
            zeilen.append(
                {
                    "person": k.name_von(uid),
                    "anspruch": round(konto.anspruch, 2),
                    "uebertrag": round(konto.uebertrag, 2),
                    "genommen": round(konto.genommen, 2),
                    "beantragt": round(konto.geplant, 2),
                    "rest": round(konto.rest, 2),
                    "verfall_am": konto.verfall_am,
                }
            )
        return zeilen

    def _b_krank(self, k: _Kontext) -> list[dict[str, Any]]:
        antraege = [a for a in self._abwesenheiten(k) if a.get("status") == "genehmigt"]
        zeilen = []
        for uid in k.personen_sortiert():
            krank = kind = 0.0
            faelle = 0
            letzter: date | None = None
            for a in antraege:
                if str(a["user_id"]) != uid or a.get("art") not in ("krank", "kind_krank"):
                    continue
                tage = float(als_dec(a.get("tage_berechnet")))
                if a.get("art") == "krank":
                    krank += tage
                else:
                    kind += tage
                faelle += 1
                beginn = als_date(a.get("von"))
                if beginn is not None and (letzter is None or beginn > letzter):
                    letzter = beginn
            zeilen.append(
                {
                    "person": k.name_von(uid),
                    "krank_tage": round(krank, 2),
                    "kind_krank_tage": round(kind, 2),
                    "faelle": faelle,
                    "letzter_fall": letzter,
                }
            )
        return zeilen

    def _b_abwesenheiten(self, k: _Kontext) -> list[dict[str, Any]]:
        namen = self._entscheider_namen(k)
        zeilen = []
        for a in sorted(
            self._abwesenheiten(k),
            key=lambda r: (str(r.get("von") or ""), k.name_von(str(r["user_id"])).casefold()),
        ):
            entschieden = str(a.get("entschieden_von") or "")
            zeilen.append(
                {
                    "person": k.name_von(str(a["user_id"])),
                    "art": str(a.get("art") or ""),
                    "von": als_date(a.get("von")),
                    "bis": als_date(a.get("bis")),
                    "tage": round(float(als_dec(a.get("tage_berechnet"))), 2),
                    "status": str(a.get("status") or ""),
                    "entschieden_von": namen.get(entschieden, "") if entschieden else "",
                    "entschieden_am": als_date(a.get("entschieden_am")),
                }
            )
        return zeilen

    def _entscheider_namen(self, k: _Kontext) -> dict[str, str]:
        """Namen der Entscheider — auch Leitung, die selbst keine Person im Scope ist."""
        rows = self._users(k.tenant_id)
        return {str(u["id"]): str(u.get("full_name") or "") for u in rows}

    def _b_verdienstgrenzen(self, k: _Kontext) -> list[dict[str, Any]]:
        """Personen MIT Grenze: verbraucht (bestätigte Zeiten) + geplant (Schichten).

        Der Zeitraum der Grenze (Monat/Jahr) kommt aus der Akte, nicht aus dem
        Filter — sonst wäre eine Monatsgrenze über eine Jahresabfrage gerissen,
        obwohl sie in jedem Monat gehalten wurde.
        """
        heute = datetime.now(UTC).date()
        anker = k.von if k.zeitraum_gesetzt else heute
        zeilen = []
        for uid in k.personen_sortiert():
            akte = k.akten.get(uid) or {}
            grenze = akte.get("verdienstgrenze_minor")
            zeitraum = akte.get("verdienstgrenze_zeitraum")
            if grenze is None or not zeitraum:
                continue
            if zeitraum == "monat":
                von = date(anker.year, anker.month, 1)
                bis = date(
                    anker.year + (anker.month == 12), (anker.month % 12) + 1, 1
                ) - timedelta(days=1)
            else:
                von, bis = date(anker.year, 1, 1), date(anker.year, 12, 31)
            fenster = _Kontext(
                ctx=k.ctx,
                tenant_id=k.tenant_id,
                von=von,
                bis=bis,
                zeitraum_gesetzt=True,
                user_ids={uid},
                users={uid: k.users[uid]},
                akten={uid: akte},
                firmen=k.firmen,
                bereiche=k.bereiche,
                titel=k.titel,
                regeln=k.regeln,
                regeln_row=k.regeln_row,
                feiertage=k.feiertage,
                arbeitsbereich_id=None,
                property_id=None,
            )
            satz, waehrung = k.satz(uid)
            verbraucht = geplant = None
            if satz is not None:
                ist = sum(
                    self._netto_und_zuschlaege(k, z)[0] for z in self._zeiten(fenster)
                )
                plan = sum(self._plan_netto(s) for s in self._schichten(fenster))
                verbraucht = round(satz * ist / 60)
                geplant = round(satz * plan / 60)
            rest = None if verbraucht is None else int(grenze) - verbraucht - (geplant or 0)
            if rest is None:
                status = "ok"
            elif rest < 0:
                status = "ueberschritten"
            elif int(grenze) and (int(grenze) - rest) / int(grenze) * 100 >= _KNAPP_AB_PCT:
                status = "knapp"
            else:
                status = "ok"
            if waehrung:
                k.currencies.add(waehrung)
            zeilen.append(
                {
                    "person": k.name_von(uid),
                    "zeitraum": str(zeitraum),
                    "grenze_minor": int(grenze),
                    "verbraucht_minor": verbraucht,
                    "geplant_minor": geplant,
                    "rest_minor": rest,
                    "status": status,
                }
            )
        return zeilen

    def _b_fristen(self, k: _Kontext) -> list[dict[str, Any]]:
        """Ablaufende Dokumente, Nachweise und Schulungen — eine Zeile je Frist."""
        heute = datetime.now(UTC).date()
        if not k.user_ids:
            return []
        ids = sorted(k.user_ids)
        quellen: list[tuple[str, str, str, str]] = [
            ("personal_dokumente", "dokument", "titel", "ablauf_am"),
            ("personal_nachweise", "nachweis", "titel", "ablauf_am"),
            ("personal_schulungen", "schulung", "titel", "gueltig_bis"),
        ]
        zeilen = []
        for tabelle, art, titel_spalte, ablauf_spalte in quellen:
            rows = (
                self._db.table(tabelle)
                .select(f"user_id, {titel_spalte}, {ablauf_spalte}")
                .eq("tenant_id", k.tenant_id)
                .in_("user_id", ids)
                .not_.is_(ablauf_spalte, "null")
                .execute()
            ).data or []
            for r in rows:
                ablauf = als_date(r.get(ablauf_spalte))
                if ablauf is None:
                    continue
                if k.zeitraum_gesetzt and not k.von <= ablauf <= k.bis:
                    continue
                tage = (ablauf - heute).days
                if tage < 0:
                    status = "abgelaufen"
                elif tage <= _FRIST_BALD_TAGE:
                    status = "bald"
                else:
                    status = "gueltig"
                zeilen.append(
                    {
                        "person": k.name_von(str(r["user_id"])),
                        "art": art,
                        "titel": str(r.get(titel_spalte) or ""),
                        "ablauf_am": ablauf,
                        "tage_bis_ablauf": tage,
                        "status": status,
                    }
                )
        return sorted(zeilen, key=lambda z: (z["ablauf_am"], str(z["person"]).casefold()))

    def _b_monatsabschluesse(self, k: _Kontext) -> list[dict[str, Any]]:
        """Person × Monat im Fenster; `fehlt=True`, wo kein Abschluss steht."""
        monate = _monate_im_fenster(k.von, k.bis)
        rows = (
            self._db.table("personal_monatsabschluesse")
            .select(
                "user_id, jahr, monat, soll_minuten, ist_minuten, saldo_minuten, "
                "freigegeben_am"
            )
            .eq("tenant_id", k.tenant_id)
            .in_("user_id", sorted(k.user_ids) or ["-"])
            .execute()
        ).data or []
        vorhanden = {
            (str(r["user_id"]), int(r["jahr"]), int(r["monat"])): r
            for r in rows
            if (int(r["jahr"]), int(r["monat"])) in monate
        }
        zeilen = []
        for uid in k.personen_sortiert():
            if (k.akten.get(uid) or {}).get("beschaeftigungsart") == "extern":
                continue
            for jahr, monat in monate:
                row = vorhanden.get((uid, jahr, monat))
                zeilen.append(
                    {
                        "person": k.name_von(uid),
                        "monat": f"{jahr:04d}-{monat:02d}",
                        "soll_minuten": int(row["soll_minuten"]) if row else None,
                        "ist_minuten": int(row["ist_minuten"]) if row else None,
                        "saldo_minuten": int(row["saldo_minuten"]) if row else None,
                        "freigegeben_am": als_date(row.get("freigegeben_am")) if row else None,
                        "fehlt": row is None,
                    }
                )
        return zeilen

    def _b_lohnvorschau(self, k: _Kontext) -> list[dict[str, Any]]:
        """Was in den Lohnlauf ginge: Grundstunden, Zuschläge, Tage, Bruttoschätzung."""
        if k.regeln is None:
            k.hinweise.append("Ohne bestätigte Betriebsregeln keine Zuschläge in der Vorschau.")
        zeiten = self._zeiten(k)
        antraege = [a for a in self._abwesenheiten(k) if a.get("status") == "genehmigt"]
        zeilen = []
        for uid in k.personen_sortiert():
            akte = k.akten.get(uid) or {}
            hinweise: list[str] = []
            ist = nacht = sonntag = feiertag = 0
            for z in zeiten:
                if str(z["user_id"]) != uid:
                    continue
                netto, n, s, f = self._netto_und_zuschlaege(k, z)
                ist += netto
                nacht += n
                sonntag += s
                feiertag += f
            soll = self._soll_minuten(k, uid, k.von, k.bis)
            extern = akte.get("beschaeftigungsart") == "extern"
            ueber = max(0, ist - soll) if soll and not extern else 0
            tage: dict[str, float] = {}
            for a in antraege:
                if str(a["user_id"]) != uid:
                    continue
                art = str(a.get("art") or "")
                tage[art] = tage.get(art, 0.0) + float(als_dec(a.get("tage_berechnet")))
            satz, waehrung = k.satz(uid)
            brutto = None
            if satz is None:
                hinweise.append("kein Stundenlohn")
            elif k.regeln is None:
                hinweise.append("Regeln fehlen")
            else:
                brutto = round(satz * ist / 60)
                brutto += rw.zuschlag_betrag_minor(satz, nacht, k.regeln.zuschlag_nacht_pct)
                brutto += rw.zuschlag_betrag_minor(satz, sonntag, k.regeln.zuschlag_sonntag_pct)
                brutto += rw.zuschlag_betrag_minor(satz, feiertag, k.regeln.zuschlag_feiertag_pct)
                brutto += rw.zuschlag_betrag_minor(
                    satz, ueber, k.regeln.zuschlag_ueberstunden_pct
                )
            if not akte.get("employee_number") and not extern:
                hinweise.append("keine Personalnummer")
            if waehrung:
                k.currencies.add(waehrung)
            zeilen.append(
                {
                    "person": k.name_von(uid),
                    "personalnummer": akte.get("employee_number"),
                    "grund_minuten": max(0, ist - ueber),
                    "nacht_minuten": nacht,
                    "sonntag_minuten": sonntag,
                    "feiertag_minuten": feiertag,
                    "ueberstunden_minuten": ueber,
                    "urlaub_tage": round(
                        sum(tage.get(a, 0.0) for a in _URLAUBSARTEN), 2
                    ),
                    "krank_tage": round(
                        tage.get("krank", 0.0) + tage.get("kind_krank", 0.0), 2
                    ),
                    "unbezahlt_tage": round(tage.get("unbezahlt", 0.0), 2),
                    "brutto_minor": brutto,
                    "hinweise": ", ".join(hinweise),
                }
            )
        return zeilen

    def _b_dienstplan(self, k: _Kontext) -> list[dict[str, Any]]:
        zeilen = []
        for s in sorted(
            self._schichten(k, mit_offenen=True),
            key=lambda r: (str(r.get("datum") or ""), str(r.get("start_at") or "")),
        ):
            tag = als_date(s.get("datum"))
            start, ende = als_dt(s.get("start_at")), als_dt(s.get("end_at"))
            zone = k.regeln.zeitzone if k.regeln else "UTC"
            uid = str(s.get("user_id") or "")
            zeilen.append(
                {
                    "datum": tag,
                    "wochentag": _WOCHENTAGE[tag.weekday()] if tag else "",
                    "person": k.name_von(uid) if uid else "",
                    "arbeitsbereich": k.bereich_name(str(s.get("arbeitsbereich_id") or "")),
                    "objekt": k.titel.get(str(s.get("property_id") or ""), ""),
                    "von": _hhmm(start, zone),
                    "bis": _hhmm(ende, zone),
                    "pause_min": int(s.get("pause_min") or 0),
                    "netto_minuten": self._plan_netto(s),
                    "status": str(s.get("status") or ""),
                    "notiz": s.get("notiz") or "",
                }
            )
        return zeilen

    def _b_mitarbeiter(self, k: _Kontext) -> list[dict[str, Any]]:
        quali = self._qualifikationen(k)
        zeilen = []
        for uid in k.personen_sortiert():
            akte = k.akten.get(uid) or {}
            user = k.users[uid]
            firma = k.firmen.get(str(akte.get("firma_id") or ""))
            zeilen.append(
                {
                    "person": k.name_von(uid),
                    "personalnummer": akte.get("employee_number"),
                    "rolle": str(user.get("role") or ""),
                    "position": akte.get("position"),
                    "beschaeftigungsart": akte.get("beschaeftigungsart"),
                    "firma": (firma or {}).get("name"),
                    "eintritt": als_date(akte.get("eintritt")),
                    "austritt": als_date(akte.get("austritt")),
                    "wochenstunden": als_float(akte.get("wochenstunden")),
                    "arbeitsbereiche": ", ".join(
                        sorted(k.bereich_name(b) for b in quali.get(uid, set()))
                    ),
                    "status": "inaktiv" if user.get("deactivated_at") else "aktiv",
                }
            )
        return zeilen

    def _qualifikationen(self, k: _Kontext) -> dict[str, set[str]]:
        if not k.user_ids:
            return {}
        rows = (
            self._db.table("personal_qualifikationen")
            .select("user_id, arbeitsbereich_id")
            .eq("tenant_id", k.tenant_id)
            .in_("user_id", sorted(k.user_ids))
            .execute()
        ).data or []
        aus: dict[str, set[str]] = {}
        for r in rows:
            aus.setdefault(str(r["user_id"]), set()).add(str(r["arbeitsbereich_id"]))
        return aus

    # ------------------------------------------------------------------
    # CSV
    # ------------------------------------------------------------------

    @staticmethod
    def csv_datei(antwort: BerichtResponse) -> tuple[str, bytes, str]:
        """(Dateiname, Inhalt, MIME) — Semikolon, BOM, CRLF, Punkt als Dezimaltrenner.

        Punkt, nicht Komma: Excel liest das Dezimalzeichen aus dem Locale des
        RECHNERS, nicht aus der Datei. Ein Komma wäre in 27 EU-Ländern
        verschieden richtig — der Punkt ist über `Text in Spalten`/Locale
        überall auflösbar und in keiner Sprache falsch geparst.
        """
        puffer = io.StringIO(newline="")
        w = csv.writer(puffer, delimiter=";", lineterminator="\r\n")
        keys = [s.key for s in antwort.spalten]
        w.writerow(keys)
        for zeile in antwort.zeilen:
            w.writerow([_csv_wert(zeile.get(key)) for key in keys])
        if antwort.summen:
            w.writerow([_csv_wert(antwort.summen.get(key)) for key in keys])
        von = antwort.von.isoformat() if antwort.von else "gesamt"
        bis = antwort.bis.isoformat() if antwort.bis else "gesamt"
        name = f"{antwort.name}_{von}_{bis}.csv"
        return name, puffer.getvalue().encode("utf-8-sig"), "text/csv; charset=utf-8"


# ---------------------------------------------------------------------------
# Freie Helfer
# ---------------------------------------------------------------------------


def _tag_start(tag: date) -> str:
    return datetime.combine(tag, time.min, UTC).isoformat()


def _hhmm(zeitpunkt: datetime | None, zeitzone: str) -> str:
    if zeitpunkt is None:
        return ""
    return zeitpunkt.astimezone(rw.zone(zeitzone)).strftime("%H:%M")


def _monate_im_fenster(von: date, bis: date) -> list[tuple[int, int]]:
    aus: list[tuple[int, int]] = []
    jahr, monat = von.year, von.month
    while (jahr, monat) <= (bis.year, bis.month):
        aus.append((jahr, monat))
        jahr, monat = (jahr + (monat == 12), (monat % 12) + 1)
    return aus


def _csv_wert(wert: object) -> str:
    """Punkt als Dezimaltrenner, ISO-Datum, leere Zelle bei None (nie „0", nie „None")."""
    if wert is None:
        return ""
    if isinstance(wert, bool):
        return "ja" if wert else "nein"
    if isinstance(wert, float):
        return f"{wert:.2f}"
    if isinstance(wert, (date, datetime)):
        return wert.isoformat()
    return str(wert)


# ---------------------------------------------------------------------------
# Die Registry (Vertrag §4.2) — EINE Wahrheit für Spalten, Rechte und Filter
# ---------------------------------------------------------------------------

_F_ALLE: tuple[BerichtFilter, ...] = (
    "zeitraum",
    "arbeitsbereich",
    "objekt",
    "person",
    "beschaeftigungsart",
)
_F_PERSON: tuple[BerichtFilter, ...] = ("zeitraum", "person", "beschaeftigungsart")
_F_PERSON_OBJEKT: tuple[BerichtFilter, ...] = (
    "zeitraum",
    "objekt",
    "person",
    "beschaeftigungsart",
)


def _def(  # noqa: PLR0913 — die Registry-Zeile trägt genau die Vertragsfelder
    name: str,
    gruppe: BerichtGruppe,
    capability: BerichtCapability,
    filter_: tuple[BerichtFilter, ...],
    spalten: tuple[Spalte, ...],
    bauen: Callable[[BerichteService, _Kontext], list[dict[str, Any]]],
    *,
    zeitraum_pflicht: bool = True,
) -> BerichtDef:
    return BerichtDef(
        name=name,
        gruppe=gruppe,
        capability=capability,
        filter=filter_,
        spalten=spalten,
        bauen=bauen,
        zeitraum_pflicht=zeitraum_pflicht,
    )


# Die fünfzehn Berichte als EIN Verzeichnis: Name → Definition mit Gruppe,
# nötiger Fähigkeit, Filtern, Spalten und Bau-Funktion. Ein Endpunkt liest hier
# nach, statt fünfzehnmal dasselbe Gerüst zu tragen.
#
# `BerichteService._b_*` sieht wie ein Zugriff von außen aus (pylint meldet
# `protected-access`), ist aber keiner: das Verzeichnis gehört fachlich zur
# Klasse und wird nur aus ihr benutzt. Es steht auf Modulebene, weil es die
# Klasse selbst beschreibt und beim Import einmal gebaut werden soll — in der
# Klasse ginge das nicht, dort sind ihre eigenen Methoden noch nicht
# referenzierbar. Die Unterdrückung gilt darum für den ganzen Ausdruck.
# pylint: disable=protected-access
BERICHTE: dict[str, BerichtDef] = {
    d.name: d
    for d in (
        _def(
            "stundenkonten",
            "zeit",
            "view_team_schedule",
            _F_PERSON,
            (
                _sp("person", "text"),
                _sp("personalnummer", "text"),
                _sp("beschaeftigungsart", "text"),
                _sp("soll_minuten", "minuten", summe=True),
                _sp("ist_minuten", "minuten", summe=True),
                _sp("saldo_monat_minuten", "minuten", summe=True),
                _sp("azk_saldo_minuten", "minuten", summe=True),
                _sp("guttage", "tage", summe=True),
                _sp("urlaub_rest", "tage", summe=True),
            ),
            BerichteService._b_stundenkonten,
        ),
        _def(
            "soll_ist",
            "zeit",
            "view_team_schedule",
            _F_ALLE,
            (
                _sp("datum", "datum"),
                _sp("person", "text"),
                _sp("plan_minuten", "minuten", summe=True),
                _sp("ist_minuten", "minuten", summe=True),
                _sp("differenz_minuten", "minuten", summe=True),
                _sp("status", "status"),
            ),
            BerichteService._b_soll_ist,
        ),
        _def(
            "zuschlaege",
            "finanzen",
            "export_lohn",
            _F_PERSON,
            (
                _sp("person", "text"),
                _sp("nacht_minuten", "minuten", summe=True),
                _sp("sonntag_minuten", "minuten", summe=True),
                _sp("feiertag_minuten", "minuten", summe=True),
                _sp("ueberstunden_minuten", "minuten", summe=True),
                _sp("nacht_minor", "geld", summe=True),
                _sp("sonntag_minor", "geld", summe=True),
                _sp("feiertag_minor", "geld", summe=True),
                _sp("ueberstunden_minor", "geld", summe=True),
                _sp("summe_minor", "geld", summe=True),
            ),
            BerichteService._b_zuschlaege,
        ),
        _def(
            "personalkosten",
            "finanzen",
            "export_lohn",
            _F_ALLE,
            (
                _sp("datum", "datum"),
                _sp("arbeitsbereich", "text"),
                _sp("objekt", "text"),
                _sp("plan_minuten", "minuten", summe=True),
                _sp("ist_minuten", "minuten", summe=True),
                _sp("kosten_plan_minor", "geld", summe=True),
                _sp("kosten_ist_minor", "geld", summe=True),
                _sp("davon_fremd_minor", "geld", summe=True),
            ),
            BerichteService._b_personalkosten,
        ),
        _def(
            "pkq_verlauf",
            "finanzen",
            "export_lohn",
            _F_ALLE,
            (
                _sp("datum", "datum"),
                _sp("umsatz_minor", "geld", summe=True),
                _sp("kosten_minor", "geld", summe=True),
                _sp("quote_pct", "prozent"),
                _sp("ziel_quote_pct", "prozent"),
                _sp("produktivitaet_minor", "geld"),
                _sp("ziel_produktivitaet_minor", "geld"),
                _sp("stundenlimit_minuten", "minuten", summe=True),
                _sp("plan_minuten", "minuten", summe=True),
            ),
            BerichteService._b_pkq_verlauf,
        ),
        _def(
            "produktivitaet",
            "finanzen",
            "export_lohn",
            _F_ALLE,
            (
                _sp("arbeitsbereich", "text"),
                _sp("minuten", "minuten", summe=True),
                _sp("umsatz_anteil_minor", "geld", summe=True),
                _sp("produktivitaet_minor", "geld"),
                _sp("einsaetze", "zahl", summe=True),
                _sp("personen", "zahl"),
            ),
            BerichteService._b_produktivitaet,
        ),
        _def(
            "urlaub",
            "abwesenheit",
            "view_team_schedule",
            _F_PERSON,
            (
                _sp("person", "text"),
                _sp("anspruch", "tage", summe=True),
                _sp("uebertrag", "tage", summe=True),
                _sp("genommen", "tage", summe=True),
                _sp("beantragt", "tage", summe=True),
                _sp("rest", "tage", summe=True),
                _sp("verfall_am", "datum"),
            ),
            BerichteService._b_urlaub,
        ),
        _def(
            "krank",
            "abwesenheit",
            "view_team_schedule",
            _F_PERSON,
            (
                _sp("person", "text"),
                _sp("krank_tage", "tage", summe=True),
                _sp("kind_krank_tage", "tage", summe=True),
                _sp("faelle", "zahl", summe=True),
                _sp("letzter_fall", "datum"),
            ),
            BerichteService._b_krank,
        ),
        _def(
            "abwesenheiten",
            "abwesenheit",
            "view_team_schedule",
            _F_PERSON,
            (
                _sp("person", "text"),
                _sp("art", "text"),
                _sp("von", "datum"),
                _sp("bis", "datum"),
                _sp("tage", "tage", summe=True),
                _sp("status", "status"),
                _sp("entschieden_von", "text"),
                _sp("entschieden_am", "datum"),
            ),
            BerichteService._b_abwesenheiten,
        ),
        _def(
            "verdienstgrenzen",
            "finanzen",
            "export_lohn",
            _F_PERSON,
            (
                _sp("person", "text"),
                _sp("zeitraum", "text"),
                _sp("grenze_minor", "geld"),
                _sp("verbraucht_minor", "geld", summe=True),
                _sp("geplant_minor", "geld", summe=True),
                _sp("rest_minor", "geld"),
                _sp("status", "status"),
            ),
            BerichteService._b_verdienstgrenzen,
            zeitraum_pflicht=False,
        ),
        _def(
            "fristen",
            "personal",
            "view_team_schedule",
            _F_PERSON,
            (
                _sp("person", "text"),
                _sp("art", "text"),
                _sp("titel", "text"),
                _sp("ablauf_am", "datum"),
                _sp("tage_bis_ablauf", "zahl"),
                _sp("status", "status"),
            ),
            BerichteService._b_fristen,
            zeitraum_pflicht=False,
        ),
        _def(
            "monatsabschluesse",
            "zeit",
            "view_team_schedule",
            _F_PERSON,
            (
                _sp("person", "text"),
                _sp("monat", "text"),
                _sp("soll_minuten", "minuten", summe=True),
                _sp("ist_minuten", "minuten", summe=True),
                _sp("saldo_minuten", "minuten", summe=True),
                _sp("freigegeben_am", "datum"),
                _sp("fehlt", "status"),
            ),
            BerichteService._b_monatsabschluesse,
        ),
        _def(
            "lohnvorschau",
            "finanzen",
            "export_lohn",
            _F_PERSON,
            (
                _sp("person", "text"),
                _sp("personalnummer", "text"),
                _sp("grund_minuten", "minuten", summe=True),
                _sp("nacht_minuten", "minuten", summe=True),
                _sp("sonntag_minuten", "minuten", summe=True),
                _sp("feiertag_minuten", "minuten", summe=True),
                _sp("ueberstunden_minuten", "minuten", summe=True),
                _sp("urlaub_tage", "tage", summe=True),
                _sp("krank_tage", "tage", summe=True),
                _sp("unbezahlt_tage", "tage", summe=True),
                _sp("brutto_minor", "geld", summe=True),
                _sp("hinweise", "text"),
            ),
            BerichteService._b_lohnvorschau,
        ),
        _def(
            "dienstplan",
            "plan",
            "view_team_schedule",
            _F_ALLE,
            (
                _sp("datum", "datum"),
                _sp("wochentag", "text"),
                _sp("person", "text"),
                _sp("arbeitsbereich", "text"),
                _sp("objekt", "text"),
                _sp("von", "text"),
                _sp("bis", "text"),
                _sp("pause_min", "minuten", summe=True),
                _sp("netto_minuten", "minuten", summe=True),
                _sp("status", "status"),
                _sp("notiz", "text"),
            ),
            BerichteService._b_dienstplan,
        ),
        _def(
            "mitarbeiter",
            "personal",
            "view_team_schedule",
            _F_PERSON_OBJEKT,
            (
                _sp("person", "text"),
                _sp("personalnummer", "text"),
                _sp("rolle", "text"),
                _sp("position", "text"),
                _sp("beschaeftigungsart", "text"),
                _sp("firma", "text"),
                _sp("eintritt", "datum"),
                _sp("austritt", "datum"),
                _sp("wochenstunden", "zahl", summe=True),
                _sp("arbeitsbereiche", "text"),
                _sp("status", "status"),
            ),
            BerichteService._b_mitarbeiter,
            zeitraum_pflicht=False,
        ),
    )
}


def get_berichte_service() -> BerichteService:
    from src.core.supabase import get_service_client  # noqa: PLC0415 — Zyklus vermeiden

    return BerichteService(service_client=get_service_client())


__all__ = ["BERICHTE", "BerichtDef", "BerichteService", "get_berichte_service"]
