"""Zeitreihe einer Startseiten-Kennzahl — die Datengrundlage für eine Kurve.

WOZU: Die Startseite kannte je Kennzahl genau ZWEI Zahlen — den Wert und die
Veränderung gegenüber der Vorperiode. Damit lässt sich ein Pfeil zeichnen, aber
keine Kurve. „Umsatz 209.868 kr, −43 %" beantwortet nicht, ob der Rückgang
gleichmäßig war oder an drei stillen Tagen hängt; genau das ist aber die Frage,
die ein Betrieb an eine Übersicht stellt.

WAS HIER NICHT PASSIERT:

* **Keine zweite Zählweise.** Die Punkte entstehen aus DENSELBEN Zeilen und
  DENSELBEN Regeln wie die Kachel darüber (`dashboard._kennzahlen`):
  Eigentümer-Aufenthalte zählen als Check-in, aber nicht als Umsatz; Stornos
  sind vorher heraus. Zwei Implementierungen desselben Werts wären zwei
  Wahrheiten, und die Kurve widerspräche der Zahl über ihr.
* **Keine Lücken-Interpolation.** Ein Tag ohne Buchung ist eine 0, kein
  fehlender Punkt und kein Mittelwert der Nachbarn (Wurzel 4). Eine Kurve, die
  Lücken glättet, erfindet Umsatz.
* **Keine Beträge ohne Sichtbarkeit.** Fehlt die Betrags-Sicht (§4.2) oder
  liegen gemischte Währungen im Fenster, kommt `punkte=None` zurück — NICHT
  eine Reihe aus Nullen. Der Unterschied ist derselbe wie bei
  `revenue_30d=None`: „darfst du nicht sehen" ist nicht „war null".

KÖRNUNG: 365 Tagespunkte ergeben auf einem Telefon einen Strich, kein
Diagramm. Die Punkte werden deshalb je nach Zeitraum zu Tagen, Wochen oder
Monaten gebündelt — die Antwort sagt mit `koernung`, welche es war, damit die
Oberfläche die Achse richtig beschriften kann und nicht raten muss.
"""
from __future__ import annotations

from collections import OrderedDict
from datetime import date, timedelta

from src.core.security import AuthContext
from src.core.supabase import fetch_all_rows
from src.core.zeitraum import UnbekannterZeitraum
from src.core.zeitraum import tage_fuer as _tage_fuer

from ._base import (
    GuestMask,
    ReservationError,
    ReservationsBase,
    _as_date,
    load_guest_mask,
)
from .schemas import (
    DashboardKpiMetrik,
    DashboardVerlaufResponse,
    Koernung,
    VerlaufPunkt,
)

# Ab wie vielen Tagen gröber gebündelt wird. Die Grenzen sind an der Lesbarkeit
# gewählt, nicht an der Kalenderlogik: Rund 7 bis 31 Punkte tragen eine Kurve
# auf Telefonbreite, darüber verschmieren sie.
_WOCHE_AB = 60
_MONAT_AB = 180


def koernung_fuer(tage: int) -> Koernung:
    """Wie fein die Punkte liegen dürfen, damit die Kurve lesbar bleibt."""
    if tage >= _MONAT_AB:
        return Koernung.monat
    if tage >= _WOCHE_AB:
        return Koernung.woche
    return Koernung.tag


def _eimer_start(tag: date, koernung: Koernung, anker: date) -> date:
    """Der Beginn des Bündels, in das dieser Tag fällt.

    Wochen werden AM ANKER ausgerichtet (dem ersten Tag des Fensters), nicht am
    Montag: Sonst wäre der erste Balken ein angebrochener und läge optisch zu
    tief, ohne dass es etwas bedeutet.
    """
    if koernung is Koernung.monat:
        return tag.replace(day=1)
    if koernung is Koernung.woche:
        return anker + timedelta(days=((tag - anker).days // 7) * 7)
    return tag


def _eimer_bilden(start: date, ende: date, koernung: Koernung) -> list[date]:
    """Alle Bündel des Fensters, lückenlos und aufsteigend.

    Lückenlos ist der Punkt: Ein Zeitraum ohne Buchung MUSS als 0 erscheinen.
    Fehlte er, zöge die Kurve eine gerade Linie über die stille Woche hinweg —
    und die wäre die einzige Auskunft, die der Betrieb wirklich gebraucht
    hätte.
    """
    eimer: list[date] = []
    lauf = _eimer_start(start, koernung, start)
    while lauf <= ende:
        eimer.append(lauf)
        if koernung is Koernung.monat:
            lauf = (lauf.replace(day=28) + timedelta(days=4)).replace(day=1)
        elif koernung is Koernung.woche:
            lauf = lauf + timedelta(days=7)
        else:
            lauf = lauf + timedelta(days=1)
    return eimer


def _wert(metrik: DashboardKpiMetrik, zeilen: list[dict]) -> float:
    """Der Wert EINES Bündels — dieselben Regeln wie in `dashboard._kennzahlen`.

    `revenue_per_booking` ohne zahlende Buchung ist 0 und nicht `None`: In
    einer Reihe wäre eine Lücke nicht darstellbar, und „in dieser Woche kam
    kein Geld herein" ist die zutreffende Aussage. Die Kachel darüber
    unterscheidet weiterhin (`None` = kein Schnitt bildbar).
    """
    zahlende = [r for r in zeilen if not r.get("is_owner_stay")]
    if metrik is DashboardKpiMetrik.checkins:
        return float(len(zeilen))
    if metrik is DashboardKpiMetrik.confirmed:
        return float(sum(1 for r in zeilen if r.get("status") == "confirmed"))
    umsatz = sum(float(r.get("total_amount") or 0) for r in zahlende)
    if metrik is DashboardKpiMetrik.revenue:
        return round(umsatz, 2)
    return round(umsatz / len(zahlende), 2) if zahlende else 0.0


def punkte_bauen(
    active: list[dict],
    *,
    start: date,
    ende: date,
    metrik: DashboardKpiMetrik,
    koernung: Koernung,
) -> list[VerlaufPunkt]:
    """Die Zeilen des Fensters zu einer lückenlosen Reihe verdichten."""
    eimer: OrderedDict[date, list[dict]] = OrderedDict(
        (tag, []) for tag in _eimer_bilden(start, ende, koernung)
    )
    for zeile in active:
        tag = _as_date(zeile["check_in"])
        if not start <= tag <= ende:
            continue
        schluessel = _eimer_start(tag, koernung, start)
        # Ein Tag, dessen Bündel nicht existiert, wäre ein Rechenfehler oben —
        # er wird übersprungen statt einen neuen Eimer anzulegen, sonst
        # entstünde ein Punkt ausserhalb der Achse.
        if schluessel in eimer:
            eimer[schluessel].append(zeile)
    return [
        VerlaufPunkt(am=tag, wert=_wert(metrik, zeilen))
        for tag, zeilen in eimer.items()
    ]


class VerlaufMixin(ReservationsBase):
    """Zeitreihe einer Startseiten-Kennzahl. Teil von `ReservationsService`."""

    def dashboard_verlauf(
        self, ctx: AuthContext, metrik: DashboardKpiMetrik, zeitraum: str
    ) -> DashboardVerlaufResponse:
        """Die Punkte EINER Kennzahl über den gewählten Zeitraum.

        Gleicher Zugang wie `/dashboard` und `/dashboard/kpi`: Es ist derselbe
        Wert, nur feiner aufgelöst — also gilt derselbe Scope (Wurzel 9).

        Geladen wird NUR das gewählte Fenster, nicht das doppelte wie bei der
        Kachel: Eine Kurve vergleicht nicht mit der Vorperiode, sie zeigt den
        Verlauf. Die doppelte Historie zu holen wäre die doppelte Datenmenge
        ohne einen einzigen zusätzlichen Punkt.
        """
        try:
            tage = _tage_fuer(zeitraum)
        except UnbekannterZeitraum as exc:
            raise ReservationError(str(exc), status_code=422) from exc

        tenant_id = self._require_tenant(ctx)
        # Owner-Scope (§4.2) fail-closed wie im Dashboard: ein Eigentümer ohne
        # zugeordnete Objekte bekommt eine leere Reihe, nicht die tenant-weite.
        owner_pids = self._owner_scope_pids(ctx)
        koernung = koernung_fuer(tage)
        heute = date.today()
        start = heute - timedelta(days=tage - 1)
        if owner_pids is not None and not owner_pids:
            return DashboardVerlaufResponse(
                metrik=metrik, zeitraum=zeitraum, tage=tage,
                koernung=koernung, currency="", punkte=[],
            )

        mask = load_guest_mask(self._client, ctx.user_id)
        query = (
            self._db()
            .table("reservations")
            .select("check_in, status, total_amount, currency, is_owner_stay")
            .eq("tenant_id", tenant_id)
            .gte("check_in", start.isoformat())
            .lte("check_in", heute.isoformat())
        )
        if owner_pids is not None:
            query = query.in_("property_id", owner_pids)
        rows = fetch_all_rows(query.order("check_in"))
        active = [r for r in rows if r.get("status") != "cancelled"]

        return self._verlauf_antwort(
            metrik, zeitraum, tage, koernung, active, start, heute, mask
        )

    @staticmethod
    def _verlauf_antwort(
        metrik: DashboardKpiMetrik,
        zeitraum: str,
        tage: int,
        koernung: Koernung,
        active: list[dict],
        start: date,
        heute: date,
        mask: GuestMask,
    ) -> DashboardVerlaufResponse:
        """Die geladenen Zeilen zur Reihe verdichten — Währungsregeln wie im KPI."""
        waehrungen = {r["currency"] for r in active if r.get("currency")}
        currency = next(iter(waehrungen)) if len(waehrungen) == 1 else ""
        betraege = mask.amounts and len(waehrungen) <= 1
        geld = metrik in (
            DashboardKpiMetrik.revenue,
            DashboardKpiMetrik.revenue_per_booking,
        )
        # `None` und nicht `[]`: „darfst du nicht sehen" bzw. „wäre eine
        # Mischwährung" ist etwas anderes als „war null" — dieselbe
        # Unterscheidung wie bei `revenue_30d`.
        punkte = (
            None
            if geld and not betraege
            else punkte_bauen(
                active, start=start, ende=heute, metrik=metrik, koernung=koernung
            )
        )
        return DashboardVerlaufResponse(
            metrik=metrik,
            zeitraum=zeitraum,
            tage=tage,
            koernung=koernung,
            currency=currency if mask.amounts else "",
            punkte=punkte,
        )
