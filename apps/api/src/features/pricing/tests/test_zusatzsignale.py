"""Tests der Zusatzsignale (0562): Preisgrenzen, Vorjahresanker, Feiertage."""
from datetime import date, timedelta

from src.features.pricing.zusatzsignale import (
    anker_je_tag,
    feiertage_je_tag,
    preisgrenzen_je_tag,
)


class _Q:
    def __init__(self, db: "_DB", table: str) -> None:
        self._db, self._table = db, table

    def __getattr__(self, _name: str):  # noqa: ANN204 — jede Filter-Methode kettet
        return lambda *_a, **_k: self

    def execute(self) -> object:
        class _R:
            data = self._db.tables.get(self._table, [])

        return _R()


class _DB:
    def __init__(self, tables: dict[str, list[dict]]) -> None:
        self.tables = tables

    def table(self, name: str) -> _Q:
        return _Q(self, name)


def test_preisgrenze_spezifischste_gewinnt() -> None:
    """Wochentage schlagen „alle Tage", kuerzerer Zeitraum schlaegt laengeren."""
    start = date(2026, 7, 1)
    end = date(2026, 7, 8)
    db = _DB({"dp_preisgrenzen": [
        # Ganzer Monat: min 400.
        {"von": "2026-07-01", "bis": "2026-07-31", "wochentage": None,
         "jaehrlich": False, "min_price": 400, "max_price": None},
        # Eine Woche darin: min 500 (kuerzer → spezifischer).
        {"von": "2026-07-01", "bis": "2026-07-07", "wochentage": None,
         "jaehrlich": False, "min_price": 500, "max_price": None},
        # Nur Fr/Sa im Monat: min 700 (Wochentage → noch spezifischer).
        {"von": "2026-07-01", "bis": "2026-07-31", "wochentage": [4, 5],
         "jaehrlich": False, "min_price": 700, "max_price": 900},
    ]})
    g = preisgrenzen_je_tag(db, "p1", start, end)  # type: ignore[arg-type]
    assert g["2026-07-01"] == (500.0, None)   # Mittwoch: Wochen-Regel
    assert g["2026-07-03"] == (700.0, 900.0)  # Freitag: Wochentags-Regel
    assert g["2026-07-04"] == (700.0, 900.0)  # Samstag
    assert g["2026-07-06"] == (500.0, None)   # Montag


def test_preisgrenze_jaehrlich_wiederholt_sich() -> None:
    db = _DB({"dp_preisgrenzen": [
        {"von": "2025-12-24", "bis": "2026-01-02", "wochentage": None,
         "jaehrlich": True, "min_price": 800, "max_price": None},
    ]})
    g = preisgrenzen_je_tag(db, "p1", date(2026, 12, 20), date(2027, 1, 10))  # type: ignore[arg-type]
    assert "2026-12-24" in g and "2027-01-02" in g
    assert "2026-12-23" not in g and "2027-01-03" not in g
    assert g["2026-12-31"] == (800.0, None)


def test_preisgrenze_ohne_zeile_leer() -> None:
    assert preisgrenzen_je_tag(_DB({}), "p1", date(2026, 7, 1), date(2026, 7, 8)) == {}  # type: ignore[arg-type]


def test_anker_ist_der_beste_nachtpreis_derselben_woche_im_vorjahr() -> None:
    ziel = date(2026, 7, 15)
    vj = ziel - timedelta(days=365)
    db = _DB({"reservations": [
        # 4 Naechte um den Vorjahrestag, 2000 gesamt → 500/Nacht.
        {"check_in": (vj - timedelta(days=1)).isoformat(),
         "check_out": (vj + timedelta(days=3)).isoformat(),
         "total_amount": 2000, "status": "confirmed"},
        # Teurere Buchung 2 Tage spaeter (im ±3-Fenster): 700/Nacht.
        {"check_in": (vj + timedelta(days=2)).isoformat(),
         "check_out": (vj + timedelta(days=4)).isoformat(),
         "total_amount": 1400, "status": "confirmed"},
        # Storniert zaehlt nicht (wird vom Filter ausgeschlossen; hier
        # simuliert die Fake-DB keinen Filter, deshalb Status pruefen).
    ]})
    a = anker_je_tag(db, "p1", ziel, ziel + timedelta(days=1))  # type: ignore[arg-type]
    assert a[ziel.isoformat()] == 700.0


def test_anker_fehlt_ohne_vorjahresbuchung() -> None:
    a = anker_je_tag(_DB({"reservations": []}), "p1", date(2026, 7, 1), date(2026, 7, 3))  # type: ignore[arg-type]
    assert a == {}


def test_feiertage_je_tag_beide_arten() -> None:
    db = _DB({"dp_feiertage": [
        {"art": "feiertag", "von": "2026-12-25", "bis": "2026-12-26"},
        {"art": "schulferien", "von": "2026-12-20", "bis": "2027-01-04"},
    ]})
    f = feiertage_je_tag(db, ["DK", "de"], date(2026, 12, 24), date(2026, 12, 28))  # type: ignore[arg-type]
    assert f["2026-12-25"] == {"feiertag": True, "ferien": True}
    assert f["2026-12-24"] == {"feiertag": False, "ferien": True}
    assert "2026-12-28" not in f


def test_feiertage_ohne_land_leer() -> None:
    assert feiertage_je_tag(_DB({}), [], date(2026, 1, 1), date(2026, 1, 3)) == {}  # type: ignore[arg-type]


def test_saison_untergrenze_je_tag_folgt_dem_kalender() -> None:
    """0565: fixed = Betrag, percent = Grundpreis ± %, spaetere Zuweisung
    gewinnt bei Ueberlappung (wie beim Uebermalen im Saisonkalender)."""
    from src.features.pricing.zusatzsignale import saison_untergrenze_je_tag

    db = _DB(
        {
            "property_seasons": [
                {"id": "a", "mode": "percent", "amount": 30},
                {"id": "f", "mode": "fixed", "amount": 999},
            ],
            "property_season_assignments": [
                {"season_id": "a", "start_date": "2027-07-01", "end_date": "2027-07-10",
                 "created_at": "2026-01-01T00:00:00Z"},
                {"season_id": "f", "start_date": "2027-07-05", "end_date": "2027-07-06",
                 "created_at": "2026-02-01T00:00:00Z"},
            ],
        }
    )
    out = saison_untergrenze_je_tag(db, "p1", 550.0, date(2027, 7, 3), date(2027, 7, 8))
    assert out["2027-07-03"] == 715.0
    assert out["2027-07-05"] == 999.0  # spaetere Zuweisung ueberschreibt
    assert out["2027-07-07"] == 715.0
    assert "2027-07-02" not in out and "2027-07-08" not in out  # [start, end)
    # Prozent ohne Grundpreis: kein Preis, nichts erfunden.
    ohne_basis = saison_untergrenze_je_tag(db, "p1", None, date(2027, 7, 3), date(2027, 7, 6))
    assert ohne_basis == {"2027-07-05": 999.0}


def test_saison_vorhanden_braucht_eine_zuweisung() -> None:
    from src.features.pricing.zusatzsignale import saison_vorhanden

    assert saison_vorhanden(_DB({"property_season_assignments": [{"id": "z"}]}), "p1")
    assert not saison_vorhanden(_DB({"property_season_assignments": []}), "p1")


def test_saison_untergrenzen_bulk_je_objekt() -> None:
    from src.features.pricing.zusatzsignale import saison_untergrenzen_bulk

    db = _DB(
        {
            "property_seasons": [
                {"id": "a", "property_id": "p1", "mode": "percent", "amount": 30},
                {"id": "b", "property_id": "p2", "mode": "fixed", "amount": 900},
            ],
            "property_season_assignments": [
                {"property_id": "p1", "season_id": "a", "start_date": "2027-07-01",
                 "end_date": "2027-07-03", "created_at": "2026-01-01T00:00:00Z"},
                {"property_id": "p2", "season_id": "b", "start_date": "2027-07-01",
                 "end_date": "2027-07-01", "created_at": "2026-01-01T00:00:00Z"},
            ],
        }
    )
    out = saison_untergrenzen_bulk(
        db, {"p1": 500.0, "p2": None, "p3": 100.0}, date(2027, 7, 1), date(2027, 7, 10)
    )
    assert out["p1"] == (650.0, 650.0, 3)
    assert out["p2"] == (900.0, 900.0, 1)  # fixed braucht keinen Grundpreis
    assert "p3" not in out
