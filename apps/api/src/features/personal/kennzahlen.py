"""Kennzahlen über dem Dienstplan (0545, Vertrag §2.1).

Was Gastromatic über ein fremdes PMS holt, haben WIR selbst: die Buchungslage
(Anreisen, Abreisen, Gäste im Haus, belegte Einheiten) steht in `reservations`.
Darum steht sie hier als eigene Zeile über dem Plan und nicht als Import.

Definitionen — deckungsgleich mit `reservations/dashboard.py`, damit derselbe
Tag im Dashboard und im Dienstplan nicht zwei Zahlen hat:
  * anreisen  = `check_in = d`
  * abreisen  = `check_out = d`
  * im Haus   = `check_in <= d < check_out` (der Abreisetag zählt NICHT mehr)
  * Umsatz je Nacht = `total_amount / nächte` in der Währung der Reservierung

Währung (Wurzel 4): der Umsatz einer Woche ist nur dann eine Zahl, wenn ALLE
beitragenden Zeilen dieselbe Währung tragen. Mischen sich zwei, steht `None`
und ein Hinweis — eine Summe über DKK und EUR ist keine Zahl, sondern eine
Falschaussage. Dasselbe gilt für Personalkosten (Satz aus Akte/Fremdfirma).

Rollen (§4.3, Wurzel 3/9): Finanzfelder liefert dieser Dienst nur an Rollen mit
`EXPORT_LOHN`, und die Rolle kommt frisch aus der DB (Wurzel 7) — ein
entzogenes Recht darf nicht bis zum Token-Ablauf weitergelten. Die Hotel-Zeile
und die Besetzung sieht jede Schichtleitung; das ist Planungsgrundlage.
"""

from __future__ import annotations

import math
from collections import defaultdict
from collections.abc import Iterable
from datetime import UTC, date, datetime, timedelta
from typing import Any

from src.core.security import AuthContext

from . import regelwerk as rw
from ._base import (
    LEITUNG,
    PLANBARE_ROLLEN,
    PersonalBase,
    PersonalError,
    als_date,
    als_dt,
    als_float,
    als_time,
)

# EINE Wahrheit fuer den Stundensatz (Vertrag §0). Hier stand bis zum
# 10.09.2026 eine zweite Kopie (`kosten_satz_lokal`), die ihr eigener
# Docstring bereits als Provisorium auswies: „die Formel darf nicht
# zweimal leben, sonst laufen Auswertung und Kennzahlen auseinander".
from .auswertung import kosten_satz
from .bedarf_schemas import (
    MAX_KENNZAHLEN_TAGE,
    BereichTag,
    BereichZeile,
    KennzahlenResponse,
    KennzahlSumme,
    KennzahlTag,
)

# Buchungen, die Belegung und Umsatz bedeuten. `pending` zählt nicht: eine
# unbestätigte Anfrage ist kein Gast im Haus und kein Umsatz.
_BUCHUNG_GUELTIG = ("confirmed", "completed")
_AKTIVE_SCHICHT = ("entwurf", "veroeffentlicht", "bestaetigt")
# Nur bestätigte Zeiten sind „Ist" — eine offene Stempelung hat kein Ende.
_ZEIT_GUELTIG = ("abgeschlossen", "bestaetigt")


class _Waehrung:
    """Sammelt eine Währung über viele Zeilen und merkt sich, ob sie mischt."""

    def __init__(self) -> None:
        self.code: str | None = None
        self.gemischt = False

    def melde(self, code: str | None) -> bool:
        """True, wenn der Wert mitgezählt werden darf."""
        if not code:
            return False
        if self.code is None:
            self.code = code
            return True
        if self.code != code:
            self.gemischt = True
            return False
        return True


class _TagWerte:
    """Rohsummen eines Tages, bevor daraus Kennzahlen werden."""

    def __init__(self) -> None:
        self.anreisen = 0
        self.abreisen = 0
        self.gaeste = 0
        self.belegt = 0
        self.umsatz_minor = 0
        self.umsatz_zaehlbar = True
        self.plan_minuten = 0
        self.ist_minuten = 0
        self.einsaetze = 0
        self.personen: set[str] = set()
        self.kosten_plan = 0
        self.kosten_ist = 0
        self.kosten_zaehlbar = True


class KennzahlenService(PersonalBase):
    """`GET /dienstplan/kennzahlen` — Hotel-Zeile, Kosten, Quote, Budget."""

    # ------------------------------------------------------------------
    # Öffentlicher Einstieg
    # ------------------------------------------------------------------

    def kennzahlen(self, ctx: AuthContext, von: date, bis: date) -> KennzahlenResponse:
        tenant_id = self._require_tenant(ctx)
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
        hinweise: list[str] = []
        finanzen = self._darf_finanzen(ctx, tenant_id)
        tage_liste = _tage(von, bis)
        werte = {t: _TagWerte() for t in tage_liste}
        waehrung = _Waehrung()

        einheiten_gesamt = self._einheiten_gesamt(tenant_id)
        self._buchungen_zaehlen(tenant_id, von, bis, werte, waehrung, hinweise)
        bereiche = self._besetzung(ctx, tenant_id, von, bis, werte, waehrung, hinweise, finanzen)
        umsatzbuch = self._umsatzbuch_rows(tenant_id, von, bis) if finanzen else {}
        budget = self._budget_rows(tenant_id, tage_liste) if finanzen else {}
        regeln_row = self._regeln_row(tenant_id) or {}
        ziel_prod = regeln_row.get("ziel_umsatzproduktivitaet_minor")
        ziel_prod_minor = int(ziel_prod) if ziel_prod is not None and finanzen else None
        if finanzen and regeln_row.get("kennzahlen_currency"):
            waehrung.melde(str(regeln_row["kennzahlen_currency"]))
        feiertage = self._feiertage_still(tenant_id, von, bis)

        tage = [
            self._tag_bauen(
                tag=tag,
                w=werte[tag],
                feiertag=feiertage.get(tag),
                einheiten_gesamt=einheiten_gesamt,
                umsatzbuch=umsatzbuch.get(tag),
                budget=budget.get(tag),
                ziel_prod_minor=ziel_prod_minor,
                finanzen=finanzen,
                heute=datetime.now(UTC).date(),
            )
            for tag in tage_liste
        ]
        self._stundenlimit_verteilen(tage, bereiche)
        if waehrung.gemischt:
            hinweise.append(
                "Mehrere Währungen im Zeitraum — Umsatz und Kosten werden nicht summiert."
            )
        currency = None if waehrung.gemischt else waehrung.code
        return KennzahlenResponse(
            von=von,
            bis=bis,
            currency=currency if finanzen else None,
            hinweise=hinweise,
            tage=tage,
            bereiche=bereiche,
            summe=_summe(tage, finanzen),
        )

    # ------------------------------------------------------------------
    # Rolle
    # ------------------------------------------------------------------

    def _darf_finanzen(self, ctx: AuthContext, tenant_id: str) -> bool:
        """Nur admin/co_admin sehen Geld — Rolle FRISCH aus der DB (Wurzel 7).

        `EXPORT_LOHN` hängt an genau diesen beiden Rollen (siehe
        `auth/permissions.py`); die Prüfung hier wiederholt sie an der Quelle,
        damit ein entzogenes Recht sofort wirkt und nicht erst mit dem Token.
        """
        return self._rolle_aus_db(ctx, tenant_id) in LEITUNG

    # ------------------------------------------------------------------
    # Hotel-Zeile aus den Buchungen
    # ------------------------------------------------------------------

    def _einheiten_gesamt(self, tenant_id: str) -> int:
        """Einheiten aller nicht archivierten Objekte (0265: 1 Objekt = 1 Typ mit n Einheiten).

        „Nicht archiviert" ist `archived_at is null` und NICHT `status <>
        'archived'`: das Enum `property_status` (0003) kennt nur draft/active/
        inactive, archiviert wird über den Zeitstempel (0416). Der Vertrag
        nennt den Status — die DB kennt ihn nicht, und ein Filter auf einen
        Wert, den es nicht gibt, filtert nichts.
        """
        objekte = (
            self._db.table("properties")
            .select("id, status, archived_at")
            .eq("tenant_id", tenant_id)
            .is_("archived_at", "null")
            .execute()
        ).data or []
        aktive = {str(p["id"]) for p in objekte}
        if not aktive:
            return 0
        einheiten = (
            self._db.table("property_units")
            .select("id, property_id")
            .eq("tenant_id", tenant_id)
            .in_("property_id", sorted(aktive))
            .execute()
        ).data or []
        return len(einheiten)

    def _buchungen_zaehlen(  # noqa: PLR0913 — eine Quelle, mehrere Sammelgefäße
        self,
        tenant_id: str,
        von: date,
        bis: date,
        werte: dict[date, _TagWerte],
        waehrung: _Waehrung,
        hinweise: list[str],
    ) -> None:
        rows = (
            self._db.table("reservations")
            .select(
                "id, property_id, check_in, check_out, status, num_guests, total_amount, "
                "currency, channel, is_owner_stay"
            )
            .eq("tenant_id", tenant_id)
            .lt("check_in", (bis + timedelta(days=1)).isoformat())
            .gt("check_out", von.isoformat())
            .execute()
        ).data or []
        ohne_waehrung = 0
        for r in rows:
            if str(r.get("status") or "") not in _BUCHUNG_GUELTIG:
                continue
            ein, aus = als_date(r.get("check_in")), als_date(r.get("check_out"))
            if ein is None or aus is None or aus <= ein:
                continue
            naechte = (aus - ein).days
            gaeste = int(r.get("num_guests") or 0)
            # Eigennutzung des Eigentümers zählt für die Belegung (das Haus ist
            # voll, es muss geputzt werden), aber NICHT für den Umsatz — sie ist
            # per Constraint kostenlos (0241).
            eigennutzung = bool(r.get("is_owner_stay"))
            je_nacht: int | None = None
            if not eigennutzung:
                betrag = als_float(r.get("total_amount"))
                code = str(r.get("currency") or "") or None
                if betrag is None or not code:
                    ohne_waehrung += 1
                elif waehrung.melde(code):
                    je_nacht = round(betrag * 100 / naechte)
                else:
                    je_nacht = None
                    for tag in _tage(max(von, ein), min(bis, aus - timedelta(days=1))):
                        werte[tag].umsatz_zaehlbar = False
            if von <= ein <= bis:
                werte[ein].anreisen += 1
            if von <= aus <= bis:
                werte[aus].abreisen += 1
            for tag in _tage(max(von, ein), min(bis, aus - timedelta(days=1))):
                w = werte[tag]
                w.belegt += 1
                w.gaeste += gaeste
                if je_nacht is not None:
                    w.umsatz_minor += je_nacht
        if ohne_waehrung:
            hinweise.append(
                f"{ohne_waehrung} Buchungen ohne Betrag oder Währung — im Umsatz nicht enthalten."
            )

    # ------------------------------------------------------------------
    # Besetzung, Minuten, Kosten
    # ------------------------------------------------------------------

    def _besetzung(  # noqa: PLR0913, PLR0912, PLR0915 — ein Durchlauf über Plan, Ist, Bedarf
        self,
        ctx: AuthContext,
        tenant_id: str,
        von: date,
        bis: date,
        werte: dict[date, _TagWerte],
        waehrung: _Waehrung,
        hinweise: list[str],
        finanzen: bool,
    ) -> list[BereichZeile]:
        ids = self._personen_im_scope(ctx, tenant_id)
        users = {
            str(u["id"]): u
            for u in self._users(tenant_id, ids)
            if str(u.get("role")) in PLANBARE_ROLLEN
        }
        akten = self._akten(tenant_id, set(users))
        firmen = self._firmen(tenant_id)
        zone = str((self._regeln_row(tenant_id) or {}).get("zeitzone") or "UTC")
        schichten = self._schichten(tenant_id, von, bis)
        zeiten = self._zeiten(tenant_id, set(users), von, bis)
        schicht_bereich = {
            str(s["id"]): (str(s["arbeitsbereich_id"]) if s.get("arbeitsbereich_id") else None)
            for s in schichten
        }
        ohne_lohn: set[str] = set()

        # Plan: Schichten je Tag. Offene Schichten (user_id=None) zählen als
        # Einsatz, kosten aber nichts — es ist niemand eingeteilt.
        ist_bereich: dict[tuple[str, date], dict[str, Any]] = defaultdict(
            lambda: {"personen": set(), "minuten": 0, "einsaetze": 0}
        )
        plan_bereich: dict[tuple[str, date], dict[str, Any]] = defaultdict(
            lambda: {"personen": set(), "minuten": 0, "einsaetze": 0}
        )
        for s in schichten:
            if str(s.get("status") or "") not in _AKTIVE_SCHICHT:
                continue
            tag = als_date(s.get("datum"))
            start, ende = als_dt(s.get("start_at")), als_dt(s.get("end_at"))
            if tag is None or tag not in werte or start is None or ende is None:
                continue
            uid = str(s["user_id"]) if s.get("user_id") else None
            if uid is not None and uid not in users:
                continue
            netto = rw.netto_minuten(start, ende, int(s.get("pause_min") or 0))
            w = werte[tag]
            w.plan_minuten += netto
            w.einsaetze += 1
            if uid:
                w.personen.add(uid)
            bereich = schicht_bereich.get(str(s["id"]))
            if bereich:
                eintrag = plan_bereich[(bereich, tag)]
                eintrag["minuten"] += netto
                eintrag["einsaetze"] += 1
                if uid:
                    eintrag["personen"].add(uid)
            if finanzen and uid:
                firma = self._firma(akten, firmen, uid)
                satz, code = kosten_satz(akten.get(uid) or {}, firma)
                if satz is None:
                    ohne_lohn.add(str(users[uid].get("full_name") or uid))
                elif waehrung.melde(code):
                    w.kosten_plan += round(satz * netto / 60)
                else:
                    w.kosten_zaehlbar = False

        # Ist: bestätigte Zeiten. Der Bereich kommt über die Schicht — die
        # Stempelung selbst kennt keinen (0541).
        for z in zeiten:
            start, ende = als_dt(z.get("start_at")), als_dt(z.get("end_at"))
            if start is None or ende is None:
                continue
            tag = rw.ortstag(start, zone)
            if tag not in werte:
                continue
            netto = rw.netto_minuten(start, ende, rw.pausen_minuten(list(z.get("pausen") or [])))
            uid = str(z["user_id"])
            w = werte[tag]
            w.ist_minuten += netto
            bereich = schicht_bereich.get(str(z.get("schicht_id") or ""))
            if bereich:
                eintrag = ist_bereich[(bereich, tag)]
                eintrag["minuten"] += netto
                eintrag["einsaetze"] += 1
                eintrag["personen"].add(uid)
            if finanzen:
                firma = self._firma(akten, firmen, uid)
                satz, code = kosten_satz(akten.get(uid) or {}, firma)
                if satz is None:
                    ohne_lohn.add(str(users.get(uid, {}).get("full_name") or uid))
                elif waehrung.melde(code):
                    w.kosten_ist += round(satz * netto / 60)
                else:
                    w.kosten_zaehlbar = False
        if ohne_lohn and finanzen:
            hinweise.append(
                f"{len(ohne_lohn)} Personen ohne Lohn (keine Kosten gerechnet): "
                f"{', '.join(sorted(ohne_lohn))}."
            )
        soll = self._soll_besetzung(tenant_id, von, bis)
        return _bereiche_bauen(soll, plan_bereich, ist_bereich, _tage(von, bis))

    @staticmethod
    def _firma(
        akten: dict[str, dict[str, Any]], firmen: dict[str, dict[str, Any]], uid: str
    ) -> dict[str, Any] | None:
        return firmen.get(str((akten.get(uid) or {}).get("firma_id") or ""))

    def _firmen(self, tenant_id: str) -> dict[str, dict[str, Any]]:
        rows = (
            self._db.table("personal_fremdfirmen")
            .select("id, name, abrechnung, satz_minor, currency")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        return {str(r["id"]): r for r in rows}

    def _schichten(self, tenant_id: str, von: date, bis: date) -> list[dict[str, Any]]:
        return (
            self._db.table("personal_schichten")
            .select(
                "id, user_id, datum, start_at, end_at, pause_min, arbeitsbereich_id, "
                "property_id, status"
            )
            .eq("tenant_id", tenant_id)
            .gte("datum", von.isoformat())
            .lte("datum", bis.isoformat())
            .execute()
        ).data or []

    def _zeiten(self, tenant_id: str, ids: set[str], von: date, bis: date) -> list[dict[str, Any]]:
        if not ids:
            return []
        rows = (
            self._db.table("personal_zeiterfassung")
            .select("id, user_id, start_at, end_at, pausen, schicht_id, status")
            .eq("tenant_id", tenant_id)
            .in_("user_id", sorted(ids))
            .gte("start_at", datetime.combine(von, datetime.min.time(), UTC).isoformat())
            .lt(
                "start_at",
                datetime.combine(bis + timedelta(days=2), datetime.min.time(), UTC).isoformat(),
            )
            .execute()
        ).data or []
        return [r for r in rows if str(r.get("status") or "") in _ZEIT_GUELTIG]

    def _soll_besetzung(
        self, tenant_id: str, von: date, bis: date
    ) -> dict[tuple[str, date], dict[str, Any]]:
        """Soll je Bereich/Tag aus `personal_bedarf`.

        Wurzel 1 (Gegenzustand): eine Zeile mit `datum` ERSETZT an diesem Tag
        die Wochentag-Vorlagen DESSELBEN Bereichs — sie kommt nicht dazu. Sonst
        würde eine Tagesübersteuerung („heute nur eine Kraft") die Vorlage
        („dienstags zwei") verdoppeln statt zu korrigieren.
        """
        rows = (
            self._db.table("personal_bedarf")
            .select("id, arbeitsbereich_id, wochentag, datum, zeit_von, zeit_bis, anzahl")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        tage = _tage(von, bis)
        tages_bereiche: set[tuple[str, date]] = {
            (str(r["arbeitsbereich_id"]), als_date(r.get("datum")))  # type: ignore[misc]
            for r in rows
            if r.get("datum") and als_date(r.get("datum")) in tage
        }
        aus: dict[tuple[str, date], dict[str, Any]] = defaultdict(
            lambda: {"anzahl": 0, "minuten": 0}
        )
        for r in rows:
            bereich = str(r["arbeitsbereich_id"])
            anzahl = int(r.get("anzahl") or 0)
            fenster = _fenster_minuten(r.get("zeit_von"), r.get("zeit_bis"))
            datum = als_date(r.get("datum"))
            if datum is not None:
                if datum in tage:
                    aus[(bereich, datum)]["anzahl"] += anzahl
                    aus[(bereich, datum)]["minuten"] += anzahl * fenster
                continue
            wochentag = r.get("wochentag")
            if wochentag is None:
                continue
            for tag in tage:
                if tag.weekday() != int(wochentag) or (bereich, tag) in tages_bereiche:
                    continue
                aus[(bereich, tag)]["anzahl"] += anzahl
                aus[(bereich, tag)]["minuten"] += anzahl * fenster
        return dict(aus)

    # ------------------------------------------------------------------
    # Umsatzbuch, Budget
    # ------------------------------------------------------------------

    def _umsatzbuch_rows(
        self, tenant_id: str, von: date, bis: date
    ) -> dict[date, dict[str, Any]]:
        """Betriebsweite Zeilen (arbeitsbereich_id is null) — sie übersteuern die Buchungen."""
        rows = (
            self._db.table("personal_umsatzbuch")
            .select("datum, arbeitsbereich_id, plan_minor, ist_minor, currency, quelle")
            .eq("tenant_id", tenant_id)
            .gte("datum", von.isoformat())
            .lte("datum", bis.isoformat())
            .is_("arbeitsbereich_id", "null")
            .execute()
        ).data or []
        aus: dict[date, dict[str, Any]] = {}
        for r in rows:
            tag = als_date(r.get("datum"))
            if tag is not None:
                aus[tag] = r
        return aus

    def _budget_rows(self, tenant_id: str, tage: list[date]) -> dict[date, dict[str, Any]]:
        """Budget je Tag: Tageszeile schlägt Wochentag-Vorlage (Wurzel 1, wie Bedarf)."""
        rows = (
            self._db.table("personal_budget")
            .select("wochentag, datum, stunden, betrag_minor, currency")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        vorlagen: dict[int, dict[str, Any]] = {}
        tages: dict[date, dict[str, Any]] = {}
        for r in rows:
            datum = als_date(r.get("datum"))
            if datum is not None:
                tages[datum] = r
            elif r.get("wochentag") is not None:
                vorlagen[int(r["wochentag"])] = r
        aus: dict[date, dict[str, Any]] = {}
        for tag in tage:
            treffer = tages.get(tag) or vorlagen.get(tag.weekday())
            if treffer is not None:
                aus[tag] = treffer
        return aus

    def _feiertage_still(self, tenant_id: str, von: date, bis: date) -> dict[date, str]:
        """Feiertage; fehlen sie, bleibt die Spalte leer statt 500 (wie im Wochenplan)."""
        try:
            return self._feiertage(tenant_id, von, bis)
        except PersonalError:
            return {}

    # ------------------------------------------------------------------
    # Tageszeile
    # ------------------------------------------------------------------

    def _tag_bauen(  # noqa: PLR0913 — eine Zeile aus allen Quellen
        self,
        *,
        tag: date,
        w: _TagWerte,
        feiertag: str | None,
        einheiten_gesamt: int,
        umsatzbuch: dict[str, Any] | None,
        budget: dict[str, Any] | None,
        ziel_prod_minor: int | None,
        finanzen: bool,
        heute: date,
    ) -> KennzahlTag:
        zeile = KennzahlTag(
            datum=tag,
            feiertag=feiertag,
            anreisen=w.anreisen,
            abreisen=w.abreisen,
            gaeste_im_haus=w.gaeste,
            einheiten_belegt=w.belegt,
            einheiten_gesamt=einheiten_gesamt,
            belegung_pct=(
                round(w.belegt * 100 / einheiten_gesamt, 1) if einheiten_gesamt else None
            ),
            plan_minuten=w.plan_minuten,
            ist_minuten=w.ist_minuten,
            einsaetze=w.einsaetze,
            personen=len(w.personen),
        )
        if not finanzen:
            return zeile
        umsatz_ist, umsatz_plan, quelle = _umsatz(w, umsatzbuch)
        zeile.umsatz_ist_minor = umsatz_ist
        zeile.umsatz_plan_minor = umsatz_plan
        zeile.umsatz_quelle = quelle
        zeile.personalkosten_plan_minor = w.kosten_plan if w.kosten_zaehlbar else None
        zeile.personalkosten_ist_minor = w.kosten_ist if w.kosten_zaehlbar else None
        vergangen = tag < heute
        # Gastromatic-Regel: Vergangenheit rechnet Ist gegen Ist, Zukunft Plan
        # gegen Plan. Ein Tag, an dem noch niemand gestempelt hat, hätte sonst
        # eine Quote von 0 % und sähe hervorragend aus.
        kosten = zeile.personalkosten_ist_minor if vergangen else zeile.personalkosten_plan_minor
        umsatz = (
            umsatz_ist
            if vergangen
            else (umsatz_plan if umsatz_plan is not None else umsatz_ist)
        )
        minuten = w.ist_minuten if vergangen else w.plan_minuten
        if kosten is not None and umsatz:
            zeile.personalkostenquote_pct = round(kosten * 100 / umsatz, 2)
        if umsatz is not None and minuten:
            zeile.produktivitaet_minor_je_stunde = round(umsatz * 60 / minuten)
        zeile.ziel_produktivitaet_minor = ziel_prod_minor
        if ziel_prod_minor and umsatz_plan:
            zeile.stundenlimit_minuten = round(umsatz_plan / ziel_prod_minor * 60)
        if budget is not None:
            zeile.budget_stunden = als_float(budget.get("stunden"))
            betrag = budget.get("betrag_minor")
            zeile.budget_minor = int(betrag) if betrag is not None else None
            if zeile.budget_stunden:
                soll_minuten = zeile.budget_stunden * 60
                zeile.abweichung_budget_pct = round(
                    (minuten - soll_minuten) * 100 / soll_minuten, 1
                )
        return zeile

    @staticmethod
    def _stundenlimit_verteilen(tage: list[KennzahlTag], bereiche: list[BereichZeile]) -> None:
        """Das Stundenlimit des Tages auf die Bereiche nach Soll-Minuten aufteilen.

        Ohne Aufteilung stünde in jedem Bereich dieselbe Betriebszahl und die
        KPI-Zeile „x/y" wäre für den einzelnen Block sinnlos.
        """
        limit = {t.datum: t.stundenlimit_minuten for t in tage}
        soll_je_tag: dict[date, int] = defaultdict(int)
        for b in bereiche:
            for t in b.tage:
                soll_je_tag[t.datum] += t.soll_minuten
        for b in bereiche:
            for t in b.tage:
                gesamt = limit.get(t.datum)
                summe = soll_je_tag.get(t.datum, 0)
                if gesamt is None or summe <= 0:
                    continue
                t.stundenlimit_minuten = round(gesamt * t.soll_minuten / summe)


# --- Hilfsfunktionen ---------------------------------------------------------


def _tage(von: date, bis: date) -> list[date]:
    if bis < von:
        return []
    return [von + timedelta(days=i) for i in range((bis - von).days + 1)]


def _fenster_minuten(von: object, bis: object) -> int:
    """Dauer eines 'HH:MM(:SS)'-Fensters; über Mitternacht zählt der Rest des Tages."""
    a, b = als_time(von), als_time(bis)
    if a is None or b is None:
        return 0
    minuten = (b.hour * 60 + b.minute) - (a.hour * 60 + a.minute)
    return minuten if minuten > 0 else minuten + 24 * 60


def _umsatz(
    w: _TagWerte, buch: dict[str, Any] | None
) -> tuple[int | None, int | None, str | None]:
    """Ist/Plan-Umsatz und Quelle. Eine Umsatzbuch-Zeile übersteuert die Buchungen."""
    aus_buchungen = w.umsatz_minor if w.umsatz_zaehlbar else None
    if buch is None:
        return aus_buchungen, aus_buchungen, "buchungen" if aus_buchungen is not None else None
    ist = buch.get("ist_minor")
    plan = buch.get("plan_minor")
    quelle = str(buch.get("quelle") or "manuell")
    return (
        int(ist) if ist is not None else aus_buchungen,
        int(plan) if plan is not None else aus_buchungen,
        quelle,
    )


def _bereiche_bauen(
    soll: dict[tuple[str, date], dict[str, Any]],
    plan: dict[tuple[str, date], dict[str, Any]],
    ist: dict[tuple[str, date], dict[str, Any]],
    tage: list[date],
) -> list[BereichZeile]:
    bereiche = sorted({b for b, _ in soll} | {b for b, _ in plan} | {b for b, _ in ist})
    zeilen: list[BereichZeile] = []
    for bereich in bereiche:
        eintraege: list[BereichTag] = []
        for tag in tage:
            s = soll.get((bereich, tag)) or {}
            p = plan.get((bereich, tag)) or {}
            i = ist.get((bereich, tag)) or {}
            eintraege.append(
                BereichTag(
                    datum=tag,
                    soll_anzahl=int(s.get("anzahl") or 0),
                    # Ist-Besetzung = wer im Bereich eingeteilt ist. Der Plan
                    # ist die Besetzung; die Stempelung sagt nur, wie lange.
                    ist_anzahl=len(p.get("personen") or set()),
                    soll_minuten=int(s.get("minuten") or 0),
                    ist_minuten=int(i.get("minuten") or 0) or int(p.get("minuten") or 0),
                    einsaetze=int(p.get("einsaetze") or 0),
                )
            )
        zeilen.append(BereichZeile(arbeitsbereich_id=bereich, tage=eintraege))
    return zeilen


def _summe(tage: list[KennzahlTag], finanzen: bool) -> KennzahlSumme:
    summe = KennzahlSumme(
        anreisen=sum(t.anreisen for t in tage),
        abreisen=sum(t.abreisen for t in tage),
        gaeste_im_haus=sum(t.gaeste_im_haus for t in tage),
        plan_minuten=sum(t.plan_minuten for t in tage),
        ist_minuten=sum(t.ist_minuten for t in tage),
        einsaetze=sum(t.einsaetze for t in tage),
    )
    if not finanzen:
        return summe
    summe.umsatz_ist_minor = _summe_oder_none(t.umsatz_ist_minor for t in tage)
    summe.umsatz_plan_minor = _summe_oder_none(t.umsatz_plan_minor for t in tage)
    summe.personalkosten_plan_minor = _summe_oder_none(
        t.personalkosten_plan_minor for t in tage
    )
    summe.personalkosten_ist_minor = _summe_oder_none(t.personalkosten_ist_minor for t in tage)
    summe.budget_stunden = _summe_oder_none(t.budget_stunden for t in tage)
    summe.budget_minor = _summe_oder_none(t.budget_minor for t in tage)
    summe.stundenlimit_minuten = _summe_oder_none(t.stundenlimit_minuten for t in tage)
    kosten = summe.personalkosten_ist_minor or summe.personalkosten_plan_minor
    umsatz = summe.umsatz_ist_minor or summe.umsatz_plan_minor
    if kosten is not None and umsatz:
        summe.personalkostenquote_pct = round(kosten * 100 / umsatz, 2)
    minuten = summe.ist_minuten or summe.plan_minuten
    if umsatz is not None and minuten:
        summe.produktivitaet_minor_je_stunde = round(umsatz * 60 / minuten)
    return summe


def _summe_oder_none(werte: Iterable[float | int | None]) -> float | int | None:
    """Summe über Werte, bei denen mindestens einer gesetzt ist — sonst None.

    `None` heißt hier „nicht ermittelbar" (fehlende Währung, fehlender Lohn).
    Eine Summe, die diese Tage als 0 mitzählt, wäre eine stille Falschaussage
    (Wurzel 4) — darum zählt sie nur, was da ist, und liefert `None`, wenn
    nichts da ist.
    """
    liste = [w for w in werte if w is not None]
    if not liste:
        return None
    gesamt = sum(liste)
    return round(gesamt, 2) if isinstance(gesamt, float) else gesamt


def stunden_aufrunden(stunden: float) -> int:
    """Personen aus Stunden: eine Kraft deckt acht Stunden (Prognose, §2.3)."""
    return max(1, math.ceil(stunden / 8)) if stunden > 0 else 0
