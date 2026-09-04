"""Bedarfsplanung, Produktivitätsannahmen, Budget und Umsatzbuch (0545, §2.2).

Der Bedarf ist die SOLL-Besetzung als Hülle: „dienstags 08–12 Uhr zwei Kräfte
im Housekeeping". Die Ist-Besetzung wird aus den Schichten GERECHNET und nie
gespeichert (Wurzel 1) — zwei Wahrheiten über dieselbe Zahl laufen auseinander.

Zwei Formen, die sich nicht addieren: eine Zeile mit `wochentag` ist die
Vorlage, eine mit `datum` die Übersteuerung. Am übersteuerten Tag ERSETZT sie
die Vorlage desselben Bereichs (die Rechnung dafür steht in `kennzahlen.py`).

PUT ersetzt (Wurzel 1: was aus der Liste verschwindet, muss auch aus der DB
verschwinden) — aber nur die MANUELLEN Zeilen. Eine übernommene Prognose
(`quelle='prognose'`) bleibt stehen; sie wird von einer neuen Übernahme
ersetzt, nicht von einer Handeingabe im Editor.

Kein `upsert` mit `on_conflict` auf die Umsatzbuch-Indizes: die sind PARTIELL
(`where arbeitsbereich_id is null`), und PostgREST kann darauf nicht auflösen
(42P10, dieselbe Falle wie 0275). Darum select-then-insert/update.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from src.core.security import AuthContext

from ._base import PersonalBase, PersonalError, als_date, als_float
from .bedarf_schemas import (
    MAX_KENNZAHLEN_TAGE,
    BedarfListe,
    BedarfZeile,
    BudgetListe,
    BudgetZeile,
    ProduktivitaetZeile,
    UmsatzbuchSchreiben,
    UmsatzbuchZeile,
)
from .kennzahlen import KennzahlenService

_BEDARF_SPALTEN = (
    "id, arbeitsbereich_id, property_id, wochentag, datum, zeit_von, zeit_bis, "
    "anzahl, quelle, notiz"
)
_BUDGET_SPALTEN = "id, wochentag, datum, stunden, betrag_minor, currency, notiz"
_UMSATZ_SPALTEN = (
    "id, datum, arbeitsbereich_id, plan_minor, ist_minor, currency, quelle, notiz"
)
# Zeilen, die eine Handeingabe ersetzen darf. 'prognose' ist ABSICHTLICH nicht
# dabei (siehe Modul-Docstring).
_MANUELL = ("manuell", "vorlage")


class BedarfService(PersonalBase):
    """Hüllen, Annahmen, Leitplanken — lesen und ersetzen."""

    # ------------------------------------------------------------------
    # Bedarf
    # ------------------------------------------------------------------

    def bedarf(self, ctx: AuthContext, von: date, bis: date) -> BedarfListe:
        tenant_id = self._require_tenant(ctx)
        _fenster_pruefen(von, bis)
        rows = (
            self._db.table("personal_bedarf")
            .select(_BEDARF_SPALTEN)
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        vorlagen = [_bedarf_zeile(r) for r in rows if r.get("wochentag") is not None]
        tage = [
            _bedarf_zeile(r)
            for r in rows
            if r.get("datum") is not None and von <= (als_date(r["datum"]) or von) <= bis
        ]
        return BedarfListe(
            vorlagen=sorted(vorlagen, key=lambda z: (z.wochentag or 0, z.zeit_von)),
            tage=sorted(tage, key=lambda z: (z.datum or von, z.zeit_von)),
        )

    def bedarf_vorlagen_setzen(
        self, ctx: AuthContext, zeilen: list[BedarfZeile]
    ) -> BedarfListe:
        tenant_id = self._require_tenant(ctx)
        for z in zeilen:
            if z.wochentag is None:
                raise PersonalError(
                    "Vorlagen brauchen einen Wochentag.",
                    status_code=422,
                    details={"code": "wochentag_fehlt"},
                )
        self._bereiche_pruefen(tenant_id, {z.arbeitsbereich_id for z in zeilen})
        self._objekte_pruefen(tenant_id, {z.property_id for z in zeilen if z.property_id})
        # Gegenzustand: alle Vorlagen weg, dann die neue Liste. Ein Ersetzen,
        # das nur einfügt, verdoppelt die Soll-Besetzung.
        (
            self._db.table("personal_bedarf")
            .delete()
            .eq("tenant_id", tenant_id)
            .is_("datum", "null")
            .execute()
        )
        if zeilen:
            self._db.table("personal_bedarf").insert(
                [_bedarf_payload(tenant_id, ctx.user_id, z, quelle="vorlage") for z in zeilen]
            ).execute()
        return self.bedarf(ctx, date.today(), date.today())

    def bedarf_tage_setzen(
        self, ctx: AuthContext, von: date, bis: date, zeilen: list[BedarfZeile]
    ) -> BedarfListe:
        tenant_id = self._require_tenant(ctx)
        _fenster_pruefen(von, bis)
        for z in zeilen:
            if z.datum is None or not von <= z.datum <= bis:
                raise PersonalError(
                    "Jede Zeile braucht ein Datum im Fenster.",
                    status_code=422,
                    details={"code": "datum_ausserhalb"},
                )
        self._bereiche_pruefen(tenant_id, {z.arbeitsbereich_id for z in zeilen})
        self._objekte_pruefen(tenant_id, {z.property_id for z in zeilen if z.property_id})
        bestand = (
            self._db.table("personal_bedarf")
            .select("id, quelle, datum")
            .eq("tenant_id", tenant_id)
            .gte("datum", von.isoformat())
            .lte("datum", bis.isoformat())
            .execute()
        ).data or []
        # Nur die manuellen Zeilen räumen: eine übernommene Prognose bleibt.
        for r in bestand:
            if str(r.get("quelle") or "") in _MANUELL:
                self._db.table("personal_bedarf").delete().eq("id", str(r["id"])).execute()
        if zeilen:
            self._db.table("personal_bedarf").insert(
                [_bedarf_payload(tenant_id, ctx.user_id, z, quelle="manuell") for z in zeilen]
            ).execute()
        return self.bedarf(ctx, von, bis)

    def bedarf_loeschen(self, ctx: AuthContext, bedarf_id: str) -> None:
        tenant_id = self._require_tenant(ctx)
        # Per-ID-Zugriff immer gescopt (Wurzel 3): kein ungescopter Load mit
        # nachträglichem Vergleich.
        rows = (
            self._db.table("personal_bedarf")
            .select("id")
            .eq("id", bedarf_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise PersonalError("Bedarfszeile nicht gefunden.", status_code=404)
        (
            self._db.table("personal_bedarf")
            .delete()
            .eq("id", bedarf_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )

    # ------------------------------------------------------------------
    # Produktivität
    # ------------------------------------------------------------------

    def produktivitaet(self, ctx: AuthContext) -> list[ProduktivitaetZeile]:
        tenant_id = self._require_tenant(ctx)
        rows = (
            self._db.table("personal_produktivitaet")
            .select("arbeitsbereich_id, basis, wert, min_stunden_tag, max_stunden_tag, notiz")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        return [
            ProduktivitaetZeile(
                arbeitsbereich_id=str(r["arbeitsbereich_id"]),
                basis=r["basis"],
                wert=float(r["wert"]),
                min_stunden_tag=als_float(r.get("min_stunden_tag")),
                max_stunden_tag=als_float(r.get("max_stunden_tag")),
                notiz=r.get("notiz"),
            )
            for r in sorted(rows, key=lambda r: str(r["arbeitsbereich_id"]))
        ]

    def produktivitaet_setzen(
        self, ctx: AuthContext, zeilen: list[ProduktivitaetZeile]
    ) -> list[ProduktivitaetZeile]:
        tenant_id = self._require_tenant(ctx)
        self._bereiche_pruefen(tenant_id, {z.arbeitsbereich_id for z in zeilen})
        gesehen: set[str] = set()
        for z in zeilen:
            if z.arbeitsbereich_id in gesehen:
                raise PersonalError(
                    "Je Arbeitsbereich genau eine Annahme.",
                    status_code=422,
                    details={"code": "bereich_doppelt"},
                )
            gesehen.add(z.arbeitsbereich_id)
        (
            self._db.table("personal_produktivitaet")
            .delete()
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if zeilen:
            self._db.table("personal_produktivitaet").insert(
                [
                    {
                        "tenant_id": tenant_id,
                        "arbeitsbereich_id": z.arbeitsbereich_id,
                        "basis": z.basis,
                        "wert": z.wert,
                        "min_stunden_tag": z.min_stunden_tag,
                        "max_stunden_tag": z.max_stunden_tag,
                        "notiz": z.notiz,
                    }
                    for z in zeilen
                ]
            ).execute()
        return self.produktivitaet(ctx)

    # ------------------------------------------------------------------
    # Budget
    # ------------------------------------------------------------------

    def budget(self, ctx: AuthContext, von: date, bis: date) -> BudgetListe:
        tenant_id = self._require_tenant(ctx)
        _fenster_pruefen(von, bis)
        rows = (
            self._db.table("personal_budget")
            .select(_BUDGET_SPALTEN)
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        return BudgetListe(
            vorlagen=[_budget_zeile(r) for r in rows if r.get("wochentag") is not None],
            tage=[
                _budget_zeile(r)
                for r in rows
                if r.get("datum") is not None and von <= (als_date(r["datum"]) or von) <= bis
            ],
        )

    def budget_vorlagen_setzen(self, ctx: AuthContext, zeilen: list[BudgetZeile]) -> BudgetListe:
        tenant_id = self._require_tenant(ctx)
        for z in zeilen:
            if z.wochentag is None:
                raise PersonalError(
                    "Vorlagen brauchen einen Wochentag.",
                    status_code=422,
                    details={"code": "wochentag_fehlt"},
                )
        (
            self._db.table("personal_budget")
            .delete()
            .eq("tenant_id", tenant_id)
            .is_("datum", "null")
            .execute()
        )
        if zeilen:
            self._db.table("personal_budget").insert(
                [_budget_payload(tenant_id, ctx.user_id, z) for z in zeilen]
            ).execute()
        return self.budget(ctx, date.today(), date.today())

    def budget_tage_setzen(
        self, ctx: AuthContext, von: date, bis: date, zeilen: list[BudgetZeile]
    ) -> BudgetListe:
        tenant_id = self._require_tenant(ctx)
        _fenster_pruefen(von, bis)
        for z in zeilen:
            if z.datum is None or not von <= z.datum <= bis:
                raise PersonalError(
                    "Jede Zeile braucht ein Datum im Fenster.",
                    status_code=422,
                    details={"code": "datum_ausserhalb"},
                )
        (
            self._db.table("personal_budget")
            .delete()
            .eq("tenant_id", tenant_id)
            .gte("datum", von.isoformat())
            .lte("datum", bis.isoformat())
            .execute()
        )
        if zeilen:
            self._db.table("personal_budget").insert(
                [_budget_payload(tenant_id, ctx.user_id, z) for z in zeilen]
            ).execute()
        return self.budget(ctx, von, bis)

    # ------------------------------------------------------------------
    # Umsatzbuch
    # ------------------------------------------------------------------

    def umsatzbuch(self, ctx: AuthContext, von: date, bis: date) -> list[UmsatzbuchZeile]:
        """Je Tag im Fenster eine Zeile — auch ohne DB-Zeile (dann `quelle=None`).

        Der Wert aus den Buchungen steht als `buchungen_ist_minor` DANEBEN und
        nicht anstelle des Ist-Werts: die Oberfläche soll zeigen, was der
        Betrieb eingetragen hat UND was die Buchungen hergeben. Wer beides in
        ein Feld legt, kann eine Übersteuerung nicht mehr erklären.
        """
        tenant_id = self._require_tenant(ctx)
        _fenster_pruefen(von, bis)
        rows = (
            self._db.table("personal_umsatzbuch")
            .select(_UMSATZ_SPALTEN)
            .eq("tenant_id", tenant_id)
            .gte("datum", von.isoformat())
            .lte("datum", bis.isoformat())
            .execute()
        ).data or []
        kennzahlen = KennzahlenService(self._db).kennzahlen(ctx, von, bis)
        aus_buchungen = {t.datum: t.umsatz_ist_minor for t in kennzahlen.tage}
        vorhanden = {(als_date(r["datum"]), r.get("arbeitsbereich_id")): r for r in rows}
        zeilen: list[UmsatzbuchZeile] = []
        tag = von
        while tag <= bis:
            for (datum, bereich), r in sorted(
                vorhanden.items(), key=lambda kv: str(kv[0][1] or "")
            ):
                if datum != tag:
                    continue
                zeilen.append(
                    UmsatzbuchZeile(
                        datum=tag,
                        arbeitsbereich_id=str(bereich) if bereich else None,
                        plan_minor=_int_oder_none(r.get("plan_minor")),
                        ist_minor=_int_oder_none(r.get("ist_minor")),
                        currency=r.get("currency"),
                        quelle=r.get("quelle"),
                        buchungen_ist_minor=aus_buchungen.get(tag) if bereich is None else None,
                        notiz=r.get("notiz"),
                    )
                )
            if not any(z.datum == tag and z.arbeitsbereich_id is None for z in zeilen):
                zeilen.append(
                    UmsatzbuchZeile(
                        datum=tag,
                        arbeitsbereich_id=None,
                        quelle=None,
                        buchungen_ist_minor=aus_buchungen.get(tag),
                    )
                )
            tag = date.fromordinal(tag.toordinal() + 1)
        return sorted(zeilen, key=lambda z: (z.datum, z.arbeitsbereich_id or ""))

    def umsatzbuch_setzen(
        self, ctx: AuthContext, zeilen: list[UmsatzbuchSchreiben]
    ) -> list[UmsatzbuchZeile]:
        """Upsert je (Tag, Bereich); beide Beträge `None` löscht die Zeile.

        Ohne `on_conflict`: die UNIQUE-Indizes der Tabelle sind partiell
        (`where arbeitsbereich_id is null` bzw. `is not null`), und PostgREST
        beantwortet ein `on_conflict` darauf mit 42P10. Select-then-write ist
        hier der Weg, nicht der Notnagel.
        """
        tenant_id = self._require_tenant(ctx)
        if not zeilen:
            return []
        self._bereiche_pruefen(
            tenant_id, {z.arbeitsbereich_id for z in zeilen if z.arbeitsbereich_id}
        )
        tage = sorted({z.datum for z in zeilen})
        for z in zeilen:
            treffer = self._umsatz_zeile(tenant_id, z.datum, z.arbeitsbereich_id)
            leer = z.plan_minor is None and z.ist_minor is None
            if leer:
                if treffer:
                    (
                        self._db.table("personal_umsatzbuch")
                        .delete()
                        .eq("id", str(treffer["id"]))
                        .eq("tenant_id", tenant_id)
                        .execute()
                    )
                continue
            payload: dict[str, Any] = {
                "plan_minor": z.plan_minor,
                "ist_minor": z.ist_minor,
                "currency": z.currency,
                "quelle": "manuell",
                "prognose_id": None,
                "notiz": z.notiz,
            }
            if treffer:
                (
                    self._db.table("personal_umsatzbuch")
                    .update(payload)
                    .eq("id", str(treffer["id"]))
                    .eq("tenant_id", tenant_id)
                    .execute()
                )
            else:
                self._db.table("personal_umsatzbuch").insert(
                    {
                        "tenant_id": tenant_id,
                        "datum": z.datum.isoformat(),
                        "arbeitsbereich_id": z.arbeitsbereich_id,
                        "erstellt_von": ctx.user_id,
                        **payload,
                    }
                ).execute()
        return self.umsatzbuch(ctx, tage[0], tage[-1])

    def _umsatz_zeile(
        self, tenant_id: str, tag: date, bereich: str | None
    ) -> dict[str, Any] | None:
        q = (
            self._db.table("personal_umsatzbuch")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("datum", tag.isoformat())
        )
        q = q.is_("arbeitsbereich_id", "null") if bereich is None else q.eq(
            "arbeitsbereich_id", bereich
        )
        rows = (q.limit(1).execute()).data or []
        return rows[0] if rows else None

    # ------------------------------------------------------------------
    # Gemeinsame Prüfungen
    # ------------------------------------------------------------------

    def _bereiche_pruefen(self, tenant_id: str, ids: set[str]) -> None:
        """Jeder Arbeitsbereich muss dem Betrieb gehören (Wurzel 3)."""
        if not ids:
            return
        rows = (
            self._db.table("personal_arbeitsbereiche")
            .select("id")
            .eq("tenant_id", tenant_id)
            .in_("id", sorted(ids))
            .execute()
        ).data or []
        fehlend = ids - {str(r["id"]) for r in rows}
        if fehlend:
            raise PersonalError(
                "Arbeitsbereich nicht gefunden.",
                status_code=404,
                details={"code": "arbeitsbereich_unbekannt"},
            )

    def _objekte_pruefen(self, tenant_id: str, ids: set[str]) -> None:
        for pid in sorted(ids):
            self._property_im_tenant(tenant_id, pid)


# --- Umformungen -------------------------------------------------------------


def _fenster_pruefen(von: date, bis: date) -> None:
    if bis < von:
        raise PersonalError(
            "Ungültiger Zeitraum.", status_code=422, details={"code": "zeitraum_ungueltig"}
        )
    if (bis - von).days + 1 > MAX_KENNZAHLEN_TAGE:
        raise PersonalError(
            f"Höchstens {MAX_KENNZAHLEN_TAGE} Tage je Abruf.",
            status_code=422,
            details={"code": "zeitraum_zu_lang", "max": MAX_KENNZAHLEN_TAGE},
        )


def _hhmm(wert: object) -> str:
    text = str(wert or "")
    return text[:5] if len(text) >= 5 else text


def _int_oder_none(wert: object) -> int | None:
    return int(wert) if wert is not None else None  # type: ignore[arg-type]


def _bedarf_zeile(r: dict[str, Any]) -> BedarfZeile:
    return BedarfZeile(
        id=str(r["id"]),
        arbeitsbereich_id=str(r["arbeitsbereich_id"]),
        property_id=str(r["property_id"]) if r.get("property_id") else None,
        wochentag=int(r["wochentag"]) if r.get("wochentag") is not None else None,
        datum=als_date(r.get("datum")),
        zeit_von=_hhmm(r.get("zeit_von")),
        zeit_bis=_hhmm(r.get("zeit_bis")),
        anzahl=int(r.get("anzahl") or 0),
        quelle=r.get("quelle") or "manuell",
        notiz=r.get("notiz"),
    )


def _bedarf_payload(
    tenant_id: str, user_id: str | None, z: BedarfZeile, *, quelle: str
) -> dict[str, Any]:
    return {
        "tenant_id": tenant_id,
        "arbeitsbereich_id": z.arbeitsbereich_id,
        "property_id": z.property_id,
        "wochentag": z.wochentag,
        "datum": z.datum.isoformat() if z.datum else None,
        "zeit_von": z.zeit_von,
        "zeit_bis": z.zeit_bis,
        "anzahl": z.anzahl,
        "quelle": quelle,
        "notiz": z.notiz,
        "erstellt_von": user_id,
    }


def _budget_zeile(r: dict[str, Any]) -> BudgetZeile:
    return BudgetZeile(
        id=str(r["id"]),
        wochentag=int(r["wochentag"]) if r.get("wochentag") is not None else None,
        datum=als_date(r.get("datum")),
        stunden=als_float(r.get("stunden")),
        betrag_minor=_int_oder_none(r.get("betrag_minor")),
        currency=r.get("currency"),
        notiz=r.get("notiz"),
    )


def _budget_payload(tenant_id: str, user_id: str | None, z: BudgetZeile) -> dict[str, Any]:
    return {
        "tenant_id": tenant_id,
        "wochentag": z.wochentag,
        "datum": z.datum.isoformat() if z.datum else None,
        "stunden": z.stunden,
        "betrag_minor": z.betrag_minor,
        "currency": z.currency,
        "notiz": z.notiz,
        "erstellt_von": user_id,
    }


def get_bedarf_service() -> BedarfService:
    """Service-Factory (Vertrag §0: `dependencies.py` gehört dem Integrator)."""
    from src.core.supabase import get_service_client  # noqa: PLC0415 — kein Import-Zirkel

    return BedarfService(service_client=get_service_client())


def get_kennzahlen_service() -> KennzahlenService:
    from src.core.supabase import get_service_client  # noqa: PLC0415

    return KennzahlenService(service_client=get_service_client())
