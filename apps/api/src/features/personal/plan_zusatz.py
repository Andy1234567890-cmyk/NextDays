"""Nebeninformationen des Wochenplans (0544, Vertrag §1.3).

Ausgelagert aus `schichten.py`, weil der Plan seit dem Ausbau nicht mehr nur
Schichten trägt: Arbeitszeit- und Guttage-Konten, Geburtstage im Fenster,
Zuschlagssummen, Verdienstgrenzen samt Verbrauch, offene Tauschanfragen, die
aufgelösten Wunsch- und Sperrzeiten und das Wetter je Tag. Alles davon ist eine
eigene Abfrage mit eigener Regel — zusammen mit dem Schreibpfad in einer Datei
war das Modul über jede lesbare Länge hinaus.

Ein Mixin und kein zweiter Dienst: die Methoden brauchen denselben
`self._db`-Zugang und dieselben gescopten Helfer aus `PersonalBase`, und sie
werden ausschließlich aus dem Wochenplan gerufen.

Sichtbarkeit (Wurzel 9): Zuschlagssummen und Verdienstgrenzen setzt der
Wochenplan NUR für die Leitung; hier wird gerechnet, nicht entschieden.
"""

from __future__ import annotations

from calendar import monthrange
from datetime import date, time, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from . import regelwerk as rw
from . import wetter as wetter_mod
from ._base import PersonalBase, als_date, als_dec, als_dt, als_float
from .schemas import (
    Schicht,
    Tausch,
    TauschSchicht,
    Verdienstgrenze,
    VerfuegbarkeitTag,
    WetterTag,
)

_AKTIV = ("entwurf", "veroeffentlicht", "bestaetigt")
# Tauschanfragen, die im Plan als Marker erscheinen: angefragt = die Kollegin
# muss noch antworten, angenommen = die Planung muss freigeben.
_TAUSCH_OFFEN = ("angefragt", "angenommen")


class PlanZusatzMixin(PersonalBase):
    """Die Zusatzspalten und -zeilen des Wochenplans."""

    def _azk_salden(self, tenant_id: str, ids: set[str]) -> dict[str, int]:
        """Saldo des Arbeitszeitkontos = Summe ALLER Buchungen (eine Wahrheit)."""
        rows = (
            self._db.table("personal_arbeitszeitkonten")
            .select("user_id, minuten")
            .eq("tenant_id", tenant_id)
            .in_("user_id", sorted(ids))
            .execute()
        ).data or []
        aus: dict[str, int] = {}
        for r in rows:
            uid = str(r["user_id"])
            aus[uid] = aus.get(uid, 0) + int(r.get("minuten") or 0)
        return aus

    def _guttage_salden(self, tenant_id: str, ids: set[str]) -> dict[str, float]:
        rows = (
            self._db.table("personal_guttage")
            .select("user_id, tage")
            .eq("tenant_id", tenant_id)
            .in_("user_id", sorted(ids))
            .execute()
        ).data or []
        summe: dict[str, Decimal] = {}
        for r in rows:
            uid = str(r["user_id"])
            summe[uid] = summe.get(uid, Decimal(0)) + als_dec(r.get("tage"))
        return {uid: float(t) for uid, t in summe.items()}

    def _geburtstage(
        self, tenant_id: str, ids: set[str], von: date, bis: date
    ) -> dict[str, date]:
        """Geburtstag IM Fenster — Tag/Monat auf das Jahr des Fensters gelegt.

        Ein Fenster über den Jahreswechsel prüft beide Jahre; ein 29. Februar
        fällt in einem Nicht-Schaltjahr aus (kein Ersatzdatum, Wurzel 4).
        """
        rows = (
            self._db.table("personal_akten")
            .select("user_id, geburtsdatum")
            .eq("tenant_id", tenant_id)
            .in_("user_id", sorted(ids))
            .execute()
        ).data or []
        aus: dict[str, date] = {}
        for r in rows:
            gebo = als_date(r.get("geburtsdatum"))
            if gebo is None:
                continue
            for jahr in sorted({von.year, bis.year}):
                try:
                    tag = date(jahr, gebo.month, gebo.day)
                except ValueError:
                    continue
                if von <= tag <= bis:
                    aus[str(r["user_id"])] = tag
                    break
        return aus

    def _zuschlaege_je_person(
        self,
        schichten: list[Schicht],
        regeln: rw.Regeln | None,
        feiertage: dict[date, str],
        akten: dict[str, dict[str, Any]],
    ) -> dict[str, int]:
        """Zuschlagssumme des Fensters je Person (Minor).

        Ohne Stundenlohn gibt es keinen Betrag — `None` durch Weglassen, nie 0
        (Wurzel 4): eine 0 sähe aus wie „keine Zuschläge", nicht wie „kein Lohn
        erfasst".
        """
        if regeln is None:
            return {}
        tage = set(feiertage)
        aus: dict[str, int] = {}
        for s in schichten:
            if not s.user_id or s.status not in _AKTIV:
                continue
            lohn = (akten.get(s.user_id) or {}).get("stundenlohn_minor")
            if lohn is None:
                continue
            z = rw.zuschlaege_berechnen(
                s.start_at, s.end_at, s.pause_min, regeln=regeln, feiertage=tage
            )
            betrag = (
                rw.zuschlag_betrag_minor(int(lohn), z.nacht_min, regeln.zuschlag_nacht_pct)
                + rw.zuschlag_betrag_minor(
                    int(lohn), z.sonntag_min, regeln.zuschlag_sonntag_pct
                )
                + rw.zuschlag_betrag_minor(
                    int(lohn), z.feiertag_min, regeln.zuschlag_feiertag_pct
                )
            )
            aus[s.user_id] = aus.get(s.user_id, 0) + betrag
        return aus

    def _verdienstgrenzen(
        self, tenant_id: str, ids: set[str], im_fenster: date, akten: dict[str, dict[str, Any]]
    ) -> dict[str, Verdienstgrenze]:
        """Grenze, Verbrauch (bestätigte Zeiten) und Plan (Schichten) im Zeitraum.

        Zeitraum ist der Monat bzw. das Jahr, in dem `im_fenster` liegt — so
        steht es in der Akte (`verdienstgrenze_zeitraum`).
        """
        rows = (
            self._db.table("personal_akten")
            .select("user_id, verdienstgrenze_minor, verdienstgrenze_zeitraum, currency")
            .eq("tenant_id", tenant_id)
            .in_("user_id", sorted(ids))
            .execute()
        ).data or []
        aus: dict[str, Verdienstgrenze] = {}
        for r in rows:
            grenze = r.get("verdienstgrenze_minor")
            zeitraum = r.get("verdienstgrenze_zeitraum")
            currency = r.get("currency")
            uid = str(r["user_id"])
            lohn = (akten.get(uid) or {}).get("stundenlohn_minor")
            if grenze is None or zeitraum not in ("monat", "jahr") or not currency or lohn is None:
                continue
            von, bis = _zeitraum_grenzen(im_fenster, str(zeitraum))
            verbraucht, geplant = self._verdienst_summen(tenant_id, uid, von, bis, int(lohn))
            aus[uid] = Verdienstgrenze(
                minor=int(grenze),
                zeitraum=str(zeitraum),  # type: ignore[arg-type]
                currency=str(currency),
                verbraucht_minor=verbraucht,
                geplant_minor=geplant,
            )
        return aus

    def _verdienst_summen(  # noqa: PLR0913 — Person, Zeitraum und Satz
        self, tenant_id: str, user_id: str, von: date, bis: date, stundenlohn_minor: int
    ) -> tuple[int, int]:
        """(verbraucht, geplant) in Minor — bestätigte Zeiten bzw. Schichten.

        `verbraucht` sind BESTÄTIGTE Stempelungen (die Wahrheit für die
        Abrechnung), `geplant` die noch offenen Schichten obendrauf.
        """
        zeiten = (
            self._db.table("personal_zeiterfassung")
            .select("netto_minuten, status, datum")
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .gte("datum", von.isoformat())
            .lte("datum", bis.isoformat())
            .execute()
        ).data or []
        verbraucht_min = sum(
            int(z.get("netto_minuten") or 0) for z in zeiten if z.get("status") == "bestaetigt"
        )
        schichten = (
            self._db.table("personal_schichten")
            .select("start_at, end_at, pause_min, status")
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .gte("datum", von.isoformat())
            .lte("datum", bis.isoformat())
            .execute()
        ).data or []
        geplant_min = 0
        for s in schichten:
            if s.get("status") not in _AKTIV:
                continue
            start, ende = als_dt(s["start_at"]), als_dt(s["end_at"])
            if start and ende:
                geplant_min += rw.netto_minuten(start, ende, int(s.get("pause_min") or 0))
        return (
            _minor(stundenlohn_minor, verbraucht_min),
            _minor(stundenlohn_minor, geplant_min),
        )

    def _tausch_im_fenster(  # noqa: PLR0913 — Fenster, Scope und Titel
        self,
        tenant_id: str,
        personen_ids: set[str],
        von: date,
        bis: date,
        titel: dict[str, str],
    ) -> tuple[dict[str, str], list[Tausch]]:
        """Offene Tausche im Fenster + Status je Schicht (Scope wie die Personen)."""
        if not personen_ids:
            return {}, []
        rows = (
            self._db.table("personal_schicht_tausch")
            .select("*")
            .eq("tenant_id", tenant_id)
            .in_("status", list(_TAUSCH_OFFEN))
            .execute()
        ).data or []
        im_scope = [
            r
            for r in rows
            if str(r["von_user_id"]) in personen_ids or str(r["an_user_id"]) in personen_ids
        ]
        if not im_scope:
            return {}, []
        schicht_ids = {str(r["schicht_id"]) for r in im_scope}
        schichten = {
            str(s["id"]): s
            for s in (
                self._db.table("personal_schichten")
                .select("id, datum, start_at, end_at, arbeitsbereich_id, property_id")
                .eq("tenant_id", tenant_id)
                .in_("id", sorted(schicht_ids))
                .execute()
            ).data
            or []
        }
        im_fenster = [
            r
            for r in im_scope
            if (tag := als_date((schichten.get(str(r["schicht_id"])) or {}).get("datum")))
            is not None
            and von <= tag <= bis
        ]
        namen = {
            str(u["id"]): u.get("full_name")
            for u in self._users(
                tenant_id,
                {str(r["von_user_id"]) for r in im_fenster}
                | {str(r["an_user_id"]) for r in im_fenster},
            )
        }
        weitere = self._property_titel(
            tenant_id,
            {
                str(s["property_id"])
                for s in schichten.values()
                if s.get("property_id") and str(s["property_id"]) not in titel
            },
        )
        alle_titel = {**titel, **weitere}
        status_je_schicht = {str(r["schicht_id"]): str(r["status"]) for r in im_fenster}
        return status_je_schicht, [
            tausch_aus_row(r, schichten, namen, alle_titel) for r in im_fenster
        ]

    def _verfuegbarkeiten_aufgeloest(  # noqa: PLR0913 — Fenster, Scope und Zone
        self, tenant_id: str, ids: set[str], von: date, bis: date, zeitzone: str
    ) -> list[VerfuegbarkeitTag]:
        """Wunsch-/Sperrzeiten je TAG im Fenster — wiederkehrende expandiert.

        Der Plan zeigt je Zelle einen Punkt; die Zelle ist ein Tag, also löst
        der Server die Regel hier auf statt jedes Frontend erneut (die
        Wochentags-Expansion ist genau die Stelle, an der drei Oberflächen
        dreimal anders rechnen würden).
        """
        if not ids:
            return []
        rows = (
            self._db.table("personal_verfuegbarkeiten")
            .select("*")
            .eq("tenant_id", tenant_id)
            .in_("user_id", sorted(ids))
            .eq("aktiv", True)
            .execute()
        ).data or []
        aus: list[VerfuegbarkeitTag] = []
        for r in rows:
            wochentag = r.get("wiederkehrend_wochentag")
            datum_von, datum_bis = als_date(r.get("datum_von")), als_date(r.get("datum_bis"))
            ganztags = bool(r.get("ganztags", True))
            zeit_von, zeit_bis = _t(r.get("zeit_von")), _t(r.get("zeit_bis"))
            tag = von
            while tag <= bis:
                passt = (wochentag is not None and tag.weekday() == int(wochentag)) or (
                    datum_von is not None
                    and datum_bis is not None
                    and datum_von <= tag <= datum_bis
                )
                if passt:
                    aus.append(
                        VerfuegbarkeitTag(
                            user_id=str(r["user_id"]),
                            art=r["art"],
                            datum=tag,
                            zeit_von=(
                                None if ganztags or zeit_von is None else zeit_von.strftime("%H:%M")
                            ),
                            zeit_bis=(
                                None if ganztags or zeit_bis is None else zeit_bis.strftime("%H:%M")
                            ),
                            ganztags=ganztags,
                        )
                    )
                tag += timedelta(days=1)
        # Zone bleibt Teil der Signatur: die Zeiten sind Ortszeit der Regel und
        # werden hier NICHT umgerechnet — der Plan zeigt sie in derselben Zone.
        del zeitzone
        return sorted(aus, key=lambda v: (v.datum, v.user_id, v.art))

    def _wetter(  # noqa: PLR0913 — Fenster, Bestand und Regeln
        self,
        tenant_id: str,
        von: date,
        bis: date,
        schichten: list[dict[str, Any]],
        regeln_row: dict[str, Any] | None,
    ) -> dict[str, WetterTag]:
        """Vorhersage für den Spaltenkopf — nur bei `wetter_anzeigen`.

        Koordinate: das Objekt der Woche, wenn ALLE Schichten dasselbe Objekt
        haben; sonst das erste aktive Objekt des Betriebs (nach `title`).
        """
        if regeln_row is None or not regeln_row.get("wetter_anzeigen", True):
            return {}
        objekte = {str(r["property_id"]) for r in schichten if r.get("property_id")}
        gewaehlt = next(iter(objekte)) if len(objekte) == 1 else None
        koordinate = self._koordinate(tenant_id, gewaehlt)
        if koordinate is None:
            return {}
        lat, lng = koordinate
        return wetter_mod.vorhersage(
            self._db,
            lat=lat,
            lng=lng,
            von=von,
            bis=bis,
            zeitzone=str(regeln_row.get("zeitzone") or "UTC"),
        )

    def _koordinate(
        self, tenant_id: str, property_id: str | None
    ) -> tuple[float, float] | None:
        if property_id:
            rows = (
                self._db.table("properties")
                .select("lat, lng")
                .eq("tenant_id", tenant_id)
                .eq("id", property_id)
                .limit(1)
                .execute()
            ).data or []
        else:
            rows = (
                self._db.table("properties")
                .select("lat, lng, title, archived_at")
                .eq("tenant_id", tenant_id)
                .order("title")
                .execute()
            ).data or []
            rows = [r for r in rows if r.get("archived_at") is None]
        for r in rows:
            lat, lng = als_float(r.get("lat")), als_float(r.get("lng"))
            if lat is not None and lng is not None:
                return lat, lng
        return None


def _t(wert: object) -> time | None:
    if isinstance(wert, time):
        return wert
    if isinstance(wert, str) and wert:
        try:
            return time.fromisoformat(wert)
        except ValueError:
            return None
    return None


def _minor(stundenlohn_minor: int, minuten: int) -> int:
    """Lohnbetrag für Minuten in Minor-Einheiten, kaufmännisch gerundet.

    Über `Decimal`, nicht über float: bei einer Verdienstgrenze entscheidet der
    letzte Cent darüber, ob gewarnt wird, und `0.1 + 0.2` ist in float nicht
    `0.3`.
    """
    betrag = Decimal(stundenlohn_minor) * Decimal(minuten) / Decimal(60)
    return int(betrag.quantize(Decimal(1), rounding=ROUND_HALF_UP))


def _zeitraum_grenzen(tag: date, zeitraum: str) -> tuple[date, date]:
    """Monats- oder Jahresgrenzen um `tag` — der Bezugsraum der Verdienstgrenze."""
    if zeitraum == "jahr":
        return date(tag.year, 1, 1), date(tag.year, 12, 31)
    letzter = monthrange(tag.year, tag.month)[1]
    return date(tag.year, tag.month, 1), date(tag.year, tag.month, letzter)


def _tausch_schicht(
    s: dict[str, Any] | None, titel: dict[str, str]
) -> TauschSchicht | None:
    """Schichtzeile → Anzeigebezug. `None`, wenn Datum oder Zeiten fehlen —
    eine halbe Zeitangabe wäre eine erfundene (Wurzel 4)."""
    if s is None:
        return None
    start, ende = als_dt(s["start_at"]), als_dt(s["end_at"])
    tag = als_date(s["datum"])
    if start is None or ende is None or tag is None:
        return None
    return TauschSchicht(
        datum=tag,
        start_at=start,
        end_at=ende,
        arbeitsbereich_id=s.get("arbeitsbereich_id"),
        property_title=titel.get(str(s.get("property_id") or "")),
    )


def tausch_aus_row(
    r: dict[str, Any],
    schichten: dict[str, dict[str, Any]],
    namen: dict[str, str | None],
    titel: dict[str, str],
) -> Tausch:
    """Zeile → `Tausch` samt Schichtbezug.

    Modulfunktion und keine Methode: der Wochenplan (hier) und die
    Tausch-Endpunkte (`planung.py`) bauen dieselbe Antwort. Zwei Umwandlungen
    für dieselbe Form liefen am ersten neuen Feld auseinander.
    """
    bezug = _tausch_schicht(schichten.get(str(r["schicht_id"])), titel)
    gegen_id = r.get("gegen_schicht_id")
    gegen = _tausch_schicht(schichten.get(str(gegen_id)) if gegen_id else None, titel)
    return Tausch(
        id=str(r["id"]),
        schicht_id=str(r["schicht_id"]),
        von_user_id=str(r["von_user_id"]),
        von_name=namen.get(str(r["von_user_id"])),
        an_user_id=str(r["an_user_id"]),
        an_name=namen.get(str(r["an_user_id"])),
        gegen_schicht_id=r.get("gegen_schicht_id"),
        status=r["status"],
        grund=r.get("grund"),
        kommentar=r.get("kommentar"),
        angenommen_am=als_dt(r.get("angenommen_am")),
        entschieden_von=r.get("entschieden_von"),
        entschieden_am=als_dt(r.get("entschieden_am")),
        created_at=als_dt(r.get("created_at")),
        schicht=bezug,
        gegen_schicht=gegen,
    )


__all__ = ["PlanZusatzMixin", "tausch_aus_row"]
