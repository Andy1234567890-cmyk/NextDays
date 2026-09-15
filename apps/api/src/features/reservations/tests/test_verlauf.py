"""Tests der Zeitreihe einer Startseiten-Kennzahl.

Drei Fehler wären hier teuer und sähen alle nach einer normalen Kurve aus:

* **Eine Lücke statt einer Null.** Ein Tag ohne Buchung muss als 0 erscheinen.
  Fehlte der Punkt, zöge die Kurve eine gerade Linie über die stille Woche —
  und die wäre die einzige Auskunft, die der Betrieb gebraucht hätte.
* **Eine zweite Zählweise.** Die Punkte müssen denselben Regeln folgen wie die
  Zahl über der Kurve (Eigentümer-Aufenthalte sind Check-in, aber kein
  Umsatz). Sonst widerspricht die Kurve der Kachel, und niemand weiß, welche
  stimmt.
* **Beträge ohne Sichtbarkeit.** Ohne Betrags-Sicht oder bei gemischten
  Währungen darf KEINE Reihe aus Nullen kommen — das sähe aus wie ein Monat
  ohne Umsatz (§4.2, Wurzel 4).
"""

from __future__ import annotations

from datetime import date, timedelta

from src.features.reservations.schemas import DashboardKpiMetrik, Koernung
from src.features.reservations.verlauf import (
    koernung_fuer,
    punkte_bauen,
)


def _z(tag: date, *, betrag: float = 100.0, status: str = "confirmed",
       eigen: bool = False) -> dict:
    return {
        "check_in": tag.isoformat(),
        "status": status,
        "total_amount": betrag,
        "currency": "DKK",
        "is_owner_stay": eigen,
    }


# --- Körnung ----------------------------------------------------------------
def test_koernung_waechst_mit_dem_zeitraum() -> None:
    """365 Tagespunkte ergäben auf einem Telefon einen Strich."""
    assert koernung_fuer(7) is Koernung.tag
    assert koernung_fuer(30) is Koernung.tag
    assert koernung_fuer(90) is Koernung.woche
    assert koernung_fuer(365) is Koernung.monat


# --- Lückenlosigkeit --------------------------------------------------------
def test_stille_tage_sind_nullen_und_keine_luecken() -> None:
    heute = date(2026, 9, 15)
    start = heute - timedelta(days=6)
    punkte = punkte_bauen(
        [_z(heute)], start=start, ende=heute,
        metrik=DashboardKpiMetrik.checkins, koernung=Koernung.tag,
    )
    assert len(punkte) == 7, "jeder Tag des Fensters bekommt einen Punkt"
    assert [p.wert for p in punkte] == [0, 0, 0, 0, 0, 0, 1]
    assert punkte[0].am == start
    assert punkte[-1].am == heute


def test_leeres_fenster_liefert_lauter_nullen() -> None:
    """Keine Buchung ist nicht dasselbe wie keine Daten."""
    heute = date(2026, 9, 15)
    punkte = punkte_bauen(
        [], start=heute - timedelta(days=2), ende=heute,
        metrik=DashboardKpiMetrik.revenue, koernung=Koernung.tag,
    )
    assert [p.wert for p in punkte] == [0.0, 0.0, 0.0]


# --- Dieselbe Zählweise wie die Kachel --------------------------------------
def test_eigentuemer_aufenthalt_zaehlt_als_checkin_aber_nicht_als_umsatz() -> None:
    """Die Regel aus `dashboard._umsatz` — hier darf sie nicht abweichen."""
    heute = date(2026, 9, 15)
    zeilen = [_z(heute, betrag=0.0, eigen=True), _z(heute, betrag=500.0)]
    checkins = punkte_bauen(
        zeilen, start=heute, ende=heute,
        metrik=DashboardKpiMetrik.checkins, koernung=Koernung.tag,
    )
    umsatz = punkte_bauen(
        zeilen, start=heute, ende=heute,
        metrik=DashboardKpiMetrik.revenue, koernung=Koernung.tag,
    )
    assert checkins[0].wert == 2
    assert umsatz[0].wert == 500.0


def test_umsatz_je_buchung_teilt_nur_durch_zahlende() -> None:
    """Zählte der Eigenbeleg im Nenner mit, sänke der Schnitt mit jedem."""
    heute = date(2026, 9, 15)
    zeilen = [_z(heute, betrag=0.0, eigen=True), _z(heute, betrag=400.0)]
    punkte = punkte_bauen(
        zeilen, start=heute, ende=heute,
        metrik=DashboardKpiMetrik.revenue_per_booking, koernung=Koernung.tag,
    )
    assert punkte[0].wert == 400.0


def test_bestaetigt_zaehlt_nur_confirmed() -> None:
    heute = date(2026, 9, 15)
    zeilen = [_z(heute), _z(heute, status="pending")]
    punkte = punkte_bauen(
        zeilen, start=heute, ende=heute,
        metrik=DashboardKpiMetrik.confirmed, koernung=Koernung.tag,
    )
    assert punkte[0].wert == 1


# --- Bündelung --------------------------------------------------------------
def test_wochen_richten_sich_am_fensteranfang_aus() -> None:
    """Sonst wäre der erste Balken ein angebrochener und läge ohne Grund tief."""
    heute = date(2026, 9, 15)
    start = heute - timedelta(days=20)
    zeilen = [_z(start), _z(start + timedelta(days=6)), _z(start + timedelta(days=7))]
    punkte = punkte_bauen(
        zeilen, start=start, ende=heute,
        metrik=DashboardKpiMetrik.checkins, koernung=Koernung.woche,
    )
    assert punkte[0].am == start
    # Tag 0 und Tag 6 fallen in dieselbe Woche, Tag 7 in die nächste.
    assert punkte[0].wert == 2
    assert punkte[1].wert == 1


def test_monate_beginnen_am_ersten() -> None:
    zeilen = [_z(date(2026, 7, 14)), _z(date(2026, 8, 2)), _z(date(2026, 8, 30))]
    punkte = punkte_bauen(
        zeilen, start=date(2026, 7, 1), ende=date(2026, 9, 15),
        metrik=DashboardKpiMetrik.checkins, koernung=Koernung.monat,
    )
    assert [p.am for p in punkte] == [
        date(2026, 7, 1), date(2026, 8, 1), date(2026, 9, 1)
    ]
    assert [p.wert for p in punkte] == [1, 2, 0]


def test_zeilen_ausserhalb_des_fensters_fallen_weg() -> None:
    """Sie stünden sonst in einem Eimer, den die Achse nicht kennt."""
    heute = date(2026, 9, 15)
    punkte = punkte_bauen(
        [_z(heute - timedelta(days=99))], start=heute - timedelta(days=2),
        ende=heute, metrik=DashboardKpiMetrik.checkins, koernung=Koernung.tag,
    )
    assert [p.wert for p in punkte] == [0, 0, 0]
