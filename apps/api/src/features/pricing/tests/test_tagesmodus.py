"""Tagesmodus: der feste Preis muss SOFORT gelten, nicht erst nach dem Job.

Live am 05.09.2026: „Fester Preis 850" für vier Tage gesetzt, Kalender und
Portale zeigten weiter 654,23. price_overrides trug 850, aber die alte
dynamic_prices-Zeile blieb stehen — und im Resolver gewinnt `dynamic` vor
`override`. Das Ausbuchen lag allein im Recompute-Job; dessen Code in
Produktion war älter und übersprang den Tag nur.
"""
from datetime import date

from src.core.security import AuthContext
from src.features.pricing import tagesmodus_service as tm


class _Q:
    def __init__(self, db: "_DB", table: str) -> None:
        self._db = db
        self._table = table
        self._op = "select"
        self._in: list = []
        self._eq: dict = {}
        self._payload: object = None

    def select(self, *_a: object, **_k: object) -> "_Q":
        return self

    def eq(self, col: str, wert: object) -> "_Q":
        self._eq[col] = wert
        return self

    def gte(self, *_a: object) -> "_Q":
        return self

    def lte(self, *_a: object) -> "_Q":
        return self

    def limit(self, *_a: object) -> "_Q":
        return self

    def in_(self, _col: str, werte: list) -> "_Q":
        self._in = list(werte)
        return self

    def delete(self) -> "_Q":
        self._op = "delete"
        return self

    def upsert(self, payload: object, **_k: object) -> "_Q":
        self._op = "upsert"
        self._payload = payload
        return self

    def insert(self, payload: object, **_k: object) -> "_Q":
        self._op = "insert"
        self._payload = payload
        return self

    def execute(self) -> object:
        class _R:
            data: list = []

        rows = self._db.tables.setdefault(self._table, [])
        r = _R()
        if self._op == "delete":
            weg = [x for x in rows if not self._in or x.get("date") in self._in]
            self._db.tables[self._table] = [x for x in rows if x not in weg]
            self._db.geloescht.setdefault(self._table, []).extend(weg)
            r.data = weg
        elif self._op in ("upsert", "insert"):
            neu = self._payload if isinstance(self._payload, list) else [self._payload]
            rows.extend(neu)
            r.data = neu
        else:
            r.data = [
                x
                for x in rows
                if all(x.get(k) == v for k, v in self._eq.items() if k != "tenant_id")
            ]
        return r


class _DB:
    def __init__(self, tables: dict[str, list[dict]]) -> None:
        self.tables = tables
        self.geloescht: dict[str, list] = {}

    def table(self, name: str) -> _Q:
        return _Q(self, name)


def _ctx() -> AuthContext:
    return AuthContext(
        user_id="u1", tenant_id="t1", role="admin", email=None, permissions=[]
    )


def _svc(db: _DB, monkeypatch) -> tm.TagesmodusService:  # noqa: ANN001
    monkeypatch.setattr(tm, "verlauf_schreiben", lambda *_a, **_k: None)
    monkeypatch.setattr(tm, "is_owner", lambda _ctx: False)
    return tm.TagesmodusService(service_client=db)  # type: ignore[arg-type]


def test_fester_preis_bucht_die_automatik_sofort_aus(monkeypatch) -> None:  # noqa: ANN001
    db = _DB(
        {
            "properties": [{"id": "p1", "tenant_id": "t1"}],
            "dp_day_modes": [],
            "price_overrides": [],
            "dynamic_prices": [
                {"property_id": "p1", "date": "2027-07-28", "price": 654.23},
                {"property_id": "p1", "date": "2027-07-29", "price": 654.23},
                {"property_id": "p1", "date": "2027-08-01", "price": 700.0},
            ],
        }
    )
    svc = _svc(db, monkeypatch)
    tage = svc.setzen(
        _ctx(), "p1", von=date(2027, 7, 28), bis=date(2027, 7, 29),
        modus="manuell", preis=850.0,
    )
    assert tage == 2
    assert sorted(o["date"] for o in db.tables["price_overrides"]) == [
        "2027-07-28", "2027-07-29",
    ]
    assert all(o["price"] == 850.0 for o in db.tables["price_overrides"])
    # Die berechneten Zeilen der beiden Tage sind weg, der Nachbar bleibt.
    assert [d["date"] for d in db.tables["dynamic_prices"]] == ["2027-08-01"]


def test_dynamisch_loescht_nur_den_modus(monkeypatch) -> None:  # noqa: ANN001
    db = _DB(
        {
            "properties": [{"id": "p1", "tenant_id": "t1"}],
            "dp_day_modes": [],
            "price_overrides": [],
            "dynamic_prices": [
                {"property_id": "p1", "date": "2027-07-28", "price": 654.23},
            ],
        }
    )
    svc = _svc(db, monkeypatch)
    svc.setzen(
        _ctx(), "p1", von=date(2027, 7, 28), bis=date(2027, 7, 28), modus="dynamisch",
    )
    # Zurück auf Automatik: die berechnete Zeile bleibt, der Job rechnet neu.
    assert db.tables["dynamic_prices"]
    assert "dynamic_prices" not in db.geloescht
