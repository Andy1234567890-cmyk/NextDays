"""Nicht-Umsatz-Auswertung des Eigentümer-Portals (pm_nonrevenue_charts).

Reine Rechenfunktionen über bereits geladene Reservierungs-Zeilen — der
Portal-Service besorgt sie owner-gescopt und ruft `berechne_statistik`.
Getrennt wie `reservations/property_stats.py`: der Service ist der Ort für
Scope und DB, dieses Modul der für die Zahlen. Es hat deshalb bewusst KEINEN
DB-Zugriff und kennt keinen `AuthContext`.

KEIN GELD (§4.2/§4.3): Weder Betrag noch Währung wird hier gelesen,
gerechnet oder ausgegeben. Der Eigentümer hat `pm_nonrevenue_charts`, nicht
`pm_revenue_charts` — eine Umsatzzahl in dieser Datei wäre die Umgehung genau
dieser Trennung. Die aufrufende Abfrage wählt darum auch nur die Spalten aus,
die hier vorkommen.
"""
from __future__ import annotations

from datetime import date

from .schemas import (
    PortalStatisticsChannel,
    PortalStatisticsMonth,
    PortalStatisticsResponse,
)


def _as_date(value: object) -> date:
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


def _naechte(row: dict) -> int:
    """Nächte des GESAMTEN Aufenthalts (check_out ist der Abreisetag)."""
    return max(0, (_as_date(row["check_out"]) - _as_date(row["check_in"])).days)


def _naechte_im_fenster(row: dict, von: date, bis: date) -> int:
    """Nächte dieser Buchung, die IM Zeitraum [von, bis] liegen.

    Eine Nacht gehört zum Tag, an dem sie beginnt: belegt sind die Tage
    `check_in` bis `check_out - 1`. Ein Gast, der am 28.12. anreist und am
    03.01. abreist, trägt damit vier Nächte zum Dezember und drei zum Januar
    bei — nicht sieben zu einem von beiden.
    """
    lo = max(_as_date(row["check_in"]), von)
    # `check_out` ist exklusiv: die letzte belegte Nacht ist der Tag davor.
    letzte_nacht = date.fromordinal(_as_date(row["check_out"]).toordinal() - 1)
    hi = min(letzte_nacht, bis)
    if hi < lo:
        return 0
    return (hi - lo).days + 1


def _vorlaufzeit_tage(row: dict) -> int | None:
    """Tage zwischen der Buchung beim Portal und der Anreise.

    Quelle ist AUSSCHLIESSLICH `booked_at` (0291/0292) — der Zeitpunkt, zu dem
    der Gast wirklich gebucht hat. `created_at` ist unsere Verarbeitung und
    wäre eine plausibel aussehende Falschaussage (Wurzel 5b): ein in einem
    Rutsch geholter Airbnb-Bestand trüge für alle Buchungen dieselbe Sekunde.
    Fehlt `booked_at`, ist die Antwort `None` — die Buchung zählt dann nicht
    mit, statt eine Zahl zu erfinden.
    """
    roh = row.get("booked_at")
    if not roh:
        return None
    return (_as_date(row["check_in"]) - _as_date(roh)).days


def _kanal_verteilung(anreisen: list[dict]) -> list[PortalStatisticsChannel]:
    """Anreisen und deren Nächte je Buchungskanal — ohne jeden Betrag."""
    gruppen: dict[tuple[str, str | None], dict] = {}
    for row in anreisen:
        schluessel = (str(row.get("channel") or "direct"), row.get("ota_name"))
        slot = gruppen.setdefault(schluessel, {"reservations": 0, "nights": 0})
        slot["reservations"] += 1
        slot["nights"] += _naechte(row)
    return [
        PortalStatisticsChannel(
            channel=channel,
            ota_name=ota_name,
            reservations=werte["reservations"],
            nights=werte["nights"],
        )
        for (channel, ota_name), werte in sorted(
            gruppen.items(), key=lambda kv: (kv[0][0], kv[0][1] or "")
        )
    ]


def _monats_fenster(von: date, bis: date) -> list[tuple[str, date, date]]:
    """Die Monate von `von` bis `bis` als lückenlose, ANGESCHNITTENE Fenster.

    Rückgabe je Monat: („YYYY-MM", erster Tag im Zeitraum, letzter Tag im
    Zeitraum). Die Fenster überschneiden sich nicht und decken den Zeitraum
    vollständig ab — nur so summieren sich die Monatswerte exakt zu den
    Gesamtwerten.

    Die Randmonate sind bewusst kürzer als der Kalendermonat: ein Zeitraum ab
    dem 20. Januar liefert für Januar das Fenster 20.–31.01. Der Nenner der
    Monatsquote zählt damit nur Tage, die wirklich abgefragt wurden.
    """
    fenster: list[tuple[str, date, date]] = []
    cur = von
    while cur <= bis:
        # Erster Tag des FOLGEmonats, ohne Kalender-Bibliothek.
        naechster = (
            date(cur.year + 1, 1, 1)
            if cur.month == 12
            else date(cur.year, cur.month + 1, 1)
        )
        ende = min(date.fromordinal(naechster.toordinal() - 1), bis)
        fenster.append((f"{cur.year:04d}-{cur.month:02d}", cur, ende))
        cur = naechster
    return fenster


def _monatsreihe(
    *,
    gast: list[dict],
    eigennutzung: list[dict],
    von: date,
    bis: date,
    units_total: int,
) -> list[PortalStatisticsMonth]:
    """Die Zeitreihe für die Diagramme — dieselben Regeln wie die Summe."""
    reihe: list[PortalStatisticsMonth] = []
    for etikett, m_von, m_bis in _monats_fenster(von, bis):
        tage = (m_bis - m_von).days + 1
        kapazitaet = units_total * tage
        naechte = sum(_naechte_im_fenster(r, m_von, m_bis) for r in gast)
        eigen = sum(_naechte_im_fenster(r, m_von, m_bis) for r in eigennutzung)
        quote = None
        if kapazitaet > 0:
            quote = round((naechte + eigen) / kapazitaet * 100, 2)
        anreisen = sum(
            1 for r in gast if m_von <= _as_date(r["check_in"]) <= m_bis
        )
        reihe.append(
            PortalStatisticsMonth(
                month=etikett,
                nights_booked=naechte,
                owner_stay_nights=eigen,
                capacity_unit_nights=kapazitaet,
                occupancy_rate=quote,
                reservations=anreisen,
            )
        )
    return reihe


def berechne_statistik(
    *,
    property_id: str | None,
    rows: list[dict],
    date_from: date,
    date_to: date,
    capacity_unit_nights: int,
    units_total: int,
) -> PortalStatisticsResponse:
    """Belegung, Auslastung, Aufenthaltsdauer, Vorlaufzeit und Kanalverteilung.

    `rows` sind die aktiven Reservierungen, die den Zeitraum ÜBERLAPPEN, mit
    den Feldern check_in, check_out, channel, ota_name, booked_at,
    is_owner_stay. `capacity_unit_nights` ist Einheiten × Tage über alle
    ausgewerteten Objekte (0265) — die Zahl der Nächte, die überhaupt verkauft
    werden konnten.
    """
    eigennutzung = [r for r in rows if r.get("is_owner_stay")]
    gast = [r for r in rows if not r.get("is_owner_stay")]

    nights_booked = sum(_naechte_im_fenster(r, date_from, date_to) for r in gast)
    owner_stay_nights = sum(
        _naechte_im_fenster(r, date_from, date_to) for r in eigennutzung
    )

    occupancy = None
    if capacity_unit_nights > 0:
        occupancy = round(
            (nights_booked + owner_stay_nights) / capacity_unit_nights * 100, 2
        )

    anreisen = [
        r for r in gast if date_from <= _as_date(r["check_in"]) <= date_to
    ]
    naechte_der_anreisen = sum(_naechte(r) for r in anreisen)
    avg_stay = (
        round(naechte_der_anreisen / len(anreisen), 2) if anreisen else None
    )

    vorlauf = [
        tage
        for tage in (_vorlaufzeit_tage(r) for r in anreisen)
        if tage is not None
    ]
    avg_lead = round(sum(vorlauf) / len(vorlauf), 1) if vorlauf else None

    return PortalStatisticsResponse(
        property_id=property_id,
        date_from=date_from,
        date_to=date_to,
        nights_booked=nights_booked,
        owner_stay_nights=owner_stay_nights,
        capacity_unit_nights=capacity_unit_nights,
        units_total=units_total,
        occupancy_rate=occupancy,
        reservations=len(anreisen),
        avg_stay_nights=avg_stay,
        avg_lead_time_days=avg_lead,
        avg_lead_time_basis=len(vorlauf),
        by_channel=_kanal_verteilung(anreisen),
        months=_monatsreihe(
            gast=gast,
            eigennutzung=eigennutzung,
            von=date_from,
            bis=date_to,
            units_total=units_total,
        ),
    )
