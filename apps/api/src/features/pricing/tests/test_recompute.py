"""Tests für den Dynamic-Pricing-Recompute-Service.

Verifiziert: DP schreibt NUR dynamic_prices (nie price_overrides); DP-AUS ist ein
No-op; ohne Basispreis kein erfundener Preis; Saison-Aufschlag fließt ein.
"""
from datetime import date, timedelta

from src.features.pricing.recompute import DynamicPricingRecompute


class _Q:
    def __init__(self, db: "_DB", table: str) -> None:
        self._db = db
        self._table = table
        self._op: str | None = None
        self._payload: object = None

    def select(self, *_a: object, **_k: object) -> "_Q":
        return self

    def eq(self, *_a: object, **_k: object) -> "_Q":
        return self

    def in_(self, *_a: object, **_k: object) -> "_Q":
        return self

    def gte(self, *_a: object, **_k: object) -> "_Q":
        return self

    def lt(self, *_a: object, **_k: object) -> "_Q":
        return self

    def order(self, *_a: object, **_k: object) -> "_Q":
        return self

    def limit(self, *_a: object, **_k: object) -> "_Q":
        return self

    def is_(self, *_a: object, **_k: object) -> "_Q":
        return self

    def range(self, *_a: object, **_k: object) -> "_Q":
        return self

    def upsert(self, payload: object, **_k: object) -> "_Q":
        self._op, self._payload = "upsert", payload
        return self

    def update(self, payload: object, **_k: object) -> "_Q":
        self._op, self._payload = "update", payload
        return self

    def execute(self) -> object:
        class _R:
            pass

        r = _R()
        if self._op == "upsert":
            self._db.writes.setdefault(self._table, [])
            rows = self._payload if isinstance(self._payload, list) else [self._payload]
            self._db.writes[self._table].extend(rows)  # type: ignore[arg-type]
            r.data = rows  # type: ignore[attr-defined]
        elif self._op == "update":
            self._db.updates.setdefault(self._table, []).append(self._payload)  # type: ignore[arg-type]
            r.data = []  # type: ignore[attr-defined]
        else:
            r.data = self._db.tables.get(self._table, [])  # type: ignore[attr-defined]
        return r


class _DB:
    def __init__(self, tables: dict[str, list[dict]]) -> None:
        self.tables = tables
        self.writes: dict[str, list[dict]] = {}
        self.updates: dict[str, list[dict]] = {}

    def table(self, name: str) -> _Q:
        return _Q(self, name)


def _db(*, enabled: bool, base: float | None) -> _DB:
    tables: dict[str, list[dict]] = {
        "dp_settings": [
            {
                "property_id": "p1",
                "enabled": enabled,
                "min_price": None,
                "max_price": None,
                "weekend_uplift_pct": 0,
                "last_minute": [],
                "orphan_gap_discount_pct": 0,
                "occupancy_sensitivity": 0,
                "min_stay_min": 1,
                "min_stay_max": 3,
            }
        ],
        "rate_plans": (
            [{"property_id": "p1", "base_price": base, "currency": "EUR"}]
            if base is not None
            else []
        ),
        "properties": [{"id": "p1", "tenant_id": "t1"}],
        # Modul „Dynamische Preise" gebucht — ohne Entitlement rechnet die
        # Engine bewusst nicht (kostenpflichtiges Modul, fail-closed).
        "tenant_module_entitlement": [
            {"tenant_id": "t1", "module_key": "dynamische_preise", "active": True}
        ],
        "availability": [],
        "events": [],
        "event_periods": [],
    }
    return _DB(tables)


def _svc_ohne_push(db):  # noqa: ANN001, ANN202
    """Recompute mit gestubbtem Channex-Push: enabled pusht jetzt IMMER —
    diese Tests prüfen nur die lokale Persistenz, nicht den Push-Pfad
    (der Fake kann kein lte/range)."""
    svc = DynamicPricingRecompute(service_client=db)
    svc._push_to_channex = lambda *a, **k: None
    return svc


def test_recompute_writes_only_dynamic_prices() -> None:
    db = _db(enabled=True, base=100.0)
    svc = _svc_ohne_push(db)
    n = svc.recompute_property(
        "p1", start=date(2026, 7, 1), end=date(2026, 7, 4)
    )
    assert n == 3
    # NUR dynamic_prices geschrieben — NIE price_overrides.
    assert "dynamic_prices" in db.writes
    assert "price_overrides" not in db.writes
    assert len(db.writes["dynamic_prices"]) == 3
    assert all(row["price"] == 100.0 for row in db.writes["dynamic_prices"])


def test_recompute_ohne_gebuchtes_modul_rechnet_nicht() -> None:
    """„Dynamische Preise" ist kostenpflichtig (0,5 % vom Buchungsumsatz).
    Ohne Entitlement wird NICHT gerechnet — sonst erhielte der Betrieb die
    Leistung, ohne dass je eine Nutzung gemeldet und abgerechnet würde."""
    db = _db(enabled=True, base=100.0)
    db.tables["tenant_module_entitlement"] = []
    svc = _svc_ohne_push(db)
    assert svc.recompute_property("p1", start=date(2026, 7, 1), end=date(2026, 7, 4)) == 0
    assert "dynamic_prices" not in db.writes


def test_recompute_modul_inaktiv_rechnet_nicht() -> None:
    """Gekündigtes Modul (active=False) zählt wie nicht gebucht (fail-closed)."""
    db = _db(enabled=True, base=100.0)
    db.tables["tenant_module_entitlement"] = [
        {"tenant_id": "t1", "module_key": "dynamische_preise", "active": False}
    ]
    svc = _svc_ohne_push(db)
    assert svc.recompute_property("p1", start=date(2026, 7, 1), end=date(2026, 7, 4)) == 0
    assert "dynamic_prices" not in db.writes


def test_recompute_writes_factors() -> None:
    # Faktor-Aufschlüsselung wird persistiert (für „Warum dieser Preis?").
    db = _db(enabled=True, base=100.0)
    svc = _svc_ohne_push(db)
    svc.recompute_property("p1", start=date(2026, 7, 1), end=date(2026, 7, 2))
    row = db.writes["dynamic_prices"][0]
    assert isinstance(row["factors"], dict)
    # Alle Phase-1+2-Faktoren vorhanden, inkl. market (neutral, da Markt aus).
    for key in ("season", "event", "weekend", "occupancy", "last_minute",
                "orphan", "market"):
        assert key in row["factors"]
    assert row["factors"]["market"] == 1.0


def test_recompute_disabled_is_noop() -> None:
    db = _db(enabled=False, base=100.0)
    svc = DynamicPricingRecompute(service_client=db)
    n = svc.recompute_property("p1", start=date(2026, 7, 1), end=date(2026, 7, 4))
    assert n == 0
    assert db.writes == {}


def test_recompute_no_base_no_price() -> None:
    db = _db(enabled=True, base=None)
    svc = DynamicPricingRecompute(service_client=db)
    n = svc.recompute_property("p1", start=date(2026, 7, 1), end=date(2026, 7, 4))
    assert n == 0  # kein Basispreis → kein erfundener Preis
    assert db.writes == {}


def test_recompute_all_only_enabled() -> None:
    db = _db(enabled=True, base=100.0)
    svc = _svc_ohne_push(db)
    res = svc.recompute_all(horizon_days=3)
    assert res["properties"] == 1
    assert res["days"] >= 1


def test_occupancy_signal_ignores_past() -> None:
    """Auslastung zählt NUR ab heute — vergangene Belegung darf einen künftigen
    Preis nicht beeinflussen (sonst sähe ein leeres künftiges Objekt wegen alter
    Buchungen fälschlich 'voll' aus)."""
    from datetime import date as _date

    svc = DynamicPricingRecompute(service_client=_db(enabled=True, base=100.0))
    today = _date(2026, 7, 1)
    day = _date(2026, 7, 1)
    # 5 belegte Tage NUR in der Vergangenheit (vor heute) → dürfen nicht zählen.
    past = {(_date(2026, 6, 20) + timedelta(days=i)).isoformat() for i in range(5)}
    occ_past = svc._occupancy_signal(day, past, today)
    assert occ_past == 0.0  # Vergangenheit ignoriert
    # 5 belegte Tage in der Zukunft (ab heute) → zählen.
    future = {(today + timedelta(days=i)).isoformat() for i in range(5)}
    occ_future = svc._occupancy_signal(day, future, today)
    assert occ_future > 0.0


# --- End-to-End: voller Recompute-Pfad mit den neuen Bausteinen --------------


def _db_full(**settings_overrides: object) -> _DB:
    """Fake-DB mit allen neuen Spalten/Tabellen (Pickup-Snapshots, Koordinaten),
    damit der komplette Recompute-Pfad inkl. Phase-4/RateBoard-Code durchläuft."""
    base_settings = {
        "property_id": "p1",
        "enabled": True,
        "autopilot_enabled": False,
        "min_price": None,
        "max_price": None,
        "weekend_uplift_pct": 0,
        "last_minute": [],
        "orphan_gap_discount_pct": 0,
        "occupancy_sensitivity": 30,
        "min_stay_min": 1,
        "min_stay_max": 3,
        "market_enabled": False,
        "weather_enabled": False,
        "weather_max_adjust_pct": 10,
        "rate_rules": [],
    }
    base_settings.update(settings_overrides)
    return _DB(
        {
            "dp_settings": [base_settings],
            "rate_plans": [{"property_id": "p1", "base_price": 100.0, "currency": "EUR"}],
            "properties": [{"id": "p1", "tenant_id": "t1", "lat": None, "lng": None}],
            "tenant_module_entitlement": [
                {"tenant_id": "t1", "module_key": "dynamische_preise", "active": True}
            ],
            "availability": [],
            "events": [],
            "event_periods": [],
            "dp_pickup_snapshots": [],
        }
    )


def test_e2e_full_pipeline_runs_and_writes_snapshots() -> None:
    """Voller Pfad: Snapshots werden geschrieben UND dynamic_prices entstehen,
    alle neuen Faktoren (pickup/weather/rate_rules) in der Aufschlüsselung."""
    db = _db_full()
    svc = _svc_ohne_push(db)
    n = svc.recompute_property("p1", start=date(2026, 7, 1), end=date(2026, 7, 4))
    assert n == 3
    # Pickup-Snapshots wurden persistiert (Lern-Fundament ab Tag 1).
    assert "dp_pickup_snapshots" in db.writes
    assert len(db.writes["dp_pickup_snapshots"]) == 3
    # Alle neuen Faktoren in der Aufschlüsselung.
    factors = db.writes["dynamic_prices"][0]["factors"]
    for key in ("pickup", "weather", "rate_rules"):
        assert key in factors


def test_e2e_rate_rule_applies_through_pipeline() -> None:
    """Eine Rate Rule (sonntags +20 %) wirkt durch den ganzen Recompute-Pfad."""
    # occupancy_sensitivity=0, damit die Rule isoliert wirkt (leerer Test-Kalender
    # würde sonst zusätzlich den Auslastungs-Rabatt auslösen).
    db = _db_full(
        occupancy_sensitivity=0,
        rate_rules=[{"match": {"weekday": 6}, "adjust_pct": 20}],
    )
    svc = _svc_ohne_push(db)
    # 2026-07-05 = Sonntag.
    svc.recompute_property("p1", start=date(2026, 7, 5), end=date(2026, 7, 6))
    row = db.writes["dynamic_prices"][0]
    assert row["factors"]["rate_rules"] == 1.2
    assert row["price"] == 120.0


def test_e2e_enabled_pusht_immer_an_channex() -> None:
    """EIN Schalter: enabled berechnet UND veröffentlicht — der frühere
    Autopilot-Zwischenmodus existiert nicht mehr (das Gate war eine Attrappe,
    Reconcile/Full-Sync pushten die Resolver-Kurve ohnehin). Die alte
    DB-Spalte darf das Verhalten nicht mehr beeinflussen."""
    for altwert in (False, True):
        pushed: list[str] = []
        db = _db_full(autopilot_enabled=altwert)
        svc = DynamicPricingRecompute(service_client=db)
        svc._push_to_channex = lambda *a, **k: pushed.append("push")  # type: ignore[method-assign]  # noqa: B023
        svc.recompute_property("p1", start=date(2026, 7, 1), end=date(2026, 7, 2))
        assert "dynamic_prices" in db.writes
        assert pushed == ["push"]


# --- gesendet_am: Stempel folgt dem Preis (0554, Nachbesserung 04.09.2026) ----


def test_geaenderter_preis_verliert_den_stempel_unveraenderter_behaelt_ihn() -> None:
    """Die Freigabe schuetzte nur beim ersten Mal: ein einmal gestempelter Tag
    blieb gestempelt, auch wenn der Preis sich aenderte. Jetzt verliert nur
    der GEAENDERTE Tag den Stempel, der unveraenderte behaelt ihn."""
    db = _db(enabled=True, base=100.0)
    # Bestand: Tag 1 stimmt (100), Tag 2 stand auf 80 → aendert sich.
    heute = date.today()
    db.tables["dynamic_prices"] = [
        {"date": heute.isoformat(), "price": 100.0},
        {"date": (heute + timedelta(days=1)).isoformat(), "price": 80.0},
    ]
    svc = DynamicPricingRecompute(db)  # type: ignore[arg-type]
    svc._modul_gebucht = lambda *_a, **_k: True  # type: ignore[method-assign]
    svc._push_to_channex = lambda *a, **k: False  # type: ignore[method-assign]
    svc.recompute_property("p1", start=heute, end=heute + timedelta(days=3))
    rows = {r["date"]: r for r in db.writes["dynamic_prices"]}
    assert "gesendet_am" not in rows[heute.isoformat()]
    assert rows[(heute + timedelta(days=1)).isoformat()]["gesendet_am"] is None
    # Tag 3 gab es noch nicht → neu → ungestempelt.
    assert rows[(heute + timedelta(days=2)).isoformat()]["gesendet_am"] is None


def test_erfolgreicher_push_stempelt_ohne_freigabepflicht() -> None:
    """Der normale Push stempelte nie — nach dem Einschalten der Freigabe galten
    540 laengst gesendete Tage als „nicht gesendet" (live 04.09.2026)."""
    db = _db(enabled=True, base=100.0)
    svc = DynamicPricingRecompute(db)  # type: ignore[arg-type]
    svc._modul_gebucht = lambda *_a, **_k: True  # type: ignore[method-assign]
    svc._push_to_channex = lambda *a, **k: True  # type: ignore[method-assign]
    heute = date.today()
    svc.recompute_property("p1", start=heute, end=heute + timedelta(days=3))
    assert db.updates.get("dynamic_prices"), "kein Stempel nach erfolgreichem Push"
    assert "gesendet_am" in db.updates["dynamic_prices"][0]


def test_fehlgeschlagener_push_stempelt_nicht() -> None:
    db = _db(enabled=True, base=100.0)
    svc = DynamicPricingRecompute(db)  # type: ignore[arg-type]
    svc._modul_gebucht = lambda *_a, **_k: True  # type: ignore[method-assign]
    svc._push_to_channex = lambda *a, **k: False  # type: ignore[method-assign]
    heute = date.today()
    svc.recompute_property("p1", start=heute, end=heute + timedelta(days=3))
    assert "dynamic_prices" not in db.updates
