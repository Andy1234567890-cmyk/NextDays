"""Ein Vertragsende darf nie als Stop-Sell zurückkommen (0378).

DER LIVE-FEHLER, DEN DIESE DATEI FESTHÄLT (12.08.2026, Feriehus Kornblomst):
Das Vertragsende sperrt die Nächte und meldet Channex `availability = 0`.
Channex macht daraus für die OTAs einen Stop-Sell. Der nächste ARI-Import las
diesen Stop-Sell als FREMDE Information zurück und schrieb 307 Zeilen mit
`source='channex'` — vier Sekunden nach dem eigenen Push.

Der Schaden war die AUSSAGE, nicht die Zeile: der Kalender zeigte
„Stop-Sell · alle Kanäle" statt „Vertragsende". Damit stand dort ein Grund, den
die Agentur selbst gesetzt haben könnte und mit einem Klick wieder aufhebt —
dahinter steht aber ein beendeter Vertrag, der gar nicht aufhebbar sein darf,
solange kein Vertrag existiert. Ein Vertragsende ist die komplette Abschaltung
ab dem Zeitpunkt, keine Verkaufseinstellung.

Der Store filtert echt (eq/in_/gte/lt): eine Attrappe, die jede Kette
durchwinkt, bestätigt auch den kaputten Filter — und genau der Filter IST hier
die Prüfung.
"""
from datetime import date
from typing import Any

from src.features.channel_manager.ari_push import AriPushMixin
from src.features.channel_manager.bookings_sync import BookingsSyncMixin


class _Sync(BookingsSyncMixin, AriPushMixin):
    """Nur die zwei Mixins, die der Import wirklich braucht.

    Der echte `ChannelManagerService` zieht ein Dutzend weitere Mixins samt
    Supabase-Client mit; für diesen Pfad zählen die Import-Logik und die
    `_is_channex_managed`-Prüfung aus dem Push-Mixin.
    """

    def __init__(self, channex: object) -> None:
        self._channex = channex

HEUTE = date(2026, 8, 12)
ENDE = date(2026, 10, 9)
TENANT = "t-1"
PROPERTY = "p-1"
CHANNEX_PROPERTY = "cx-1"


class _Result:
    def __init__(self, data: list[dict[str, Any]]) -> None:
        self.data = data


class _Query:
    """Minimal-PostgREST mit echter Filterwirkung."""

    def __init__(self, store: "_Store", table: str) -> None:
        self._store = store
        self._table = table
        self._filter: list[tuple[str, str, Any]] = []
        self._modus = "select"
        self._payload: dict[str, Any] | list[dict[str, Any]] | None = None

    def select(self, *_a: object, **_k: object) -> "_Query":
        self._modus = "select"
        return self

    def upsert(self, payload: dict[str, Any], **_k: object) -> "_Query":
        self._modus = "upsert"
        self._payload = payload
        return self

    def insert(self, payload: dict[str, Any], **_k: object) -> "_Query":
        self._modus = "insert"
        self._payload = payload
        return self

    def update(self, payload: dict[str, Any]) -> "_Query":
        self._modus = "update"
        self._payload = payload
        return self

    def delete(self) -> "_Query":
        self._modus = "delete"
        return self

    def eq(self, col: str, val: Any) -> "_Query":
        self._filter.append((col, "eq", val))
        return self

    def neq(self, col: str, val: Any) -> "_Query":
        self._filter.append((col, "neq", val))
        return self

    def in_(self, col: str, werte: list[Any]) -> "_Query":
        self._filter.append((col, "in", [str(w) for w in werte]))
        return self

    def gte(self, col: str, val: Any) -> "_Query":
        self._filter.append((col, "gte", val))
        return self

    def lte(self, col: str, val: Any) -> "_Query":
        self._filter.append((col, "lte", val))
        return self

    def lt(self, col: str, val: Any) -> "_Query":
        self._filter.append((col, "lt", val))
        return self

    def is_(self, col: str, val: Any) -> "_Query":
        self._filter.append(
            (col, "isnull" if str(val) == "null" else "is", val)
        )
        return self

    def or_(self, ausdruck: str) -> "_Query":
        """PostgREST-`or_` als ODER-Gruppe — echt auswertend.

        Der Ping-Pong-Schutz sucht damit frische/offene Push-Absichten
        (`created_at.gte.<cutoff>,status.eq.pending,status.eq.failed`). Würde die
        Attrappe das durchwinken, gälte JEDER Tag als „gerade selbst gepusht",
        der Import überspränge alles, und der Test wäre grün, ohne den
        Vertragsende-Filter je zu berühren.
        """
        gruppe: list[tuple[str, str, str]] = []
        for teil in ausdruck.split(","):
            spalte, op, wert = teil.split(".", 2)
            gruppe.append((spalte, op, wert))
        self._filter.append(("__or__", "or", gruppe))
        return self

    def order(self, *_a: object, **_k: object) -> "_Query":
        return self

    def limit(self, *_a: object, **_k: object) -> "_Query":
        return self

    def _passt(self, row: dict[str, Any]) -> bool:
        for col, op, val in self._filter:
            if op == "or":
                if not any(
                    self._einzel(row, s, o, w) for s, o, w in val
                ):
                    return False
                continue
            ist = row.get(col)
            if op == "eq" and str(ist) != str(val):
                return False
            if op == "neq" and str(ist) == str(val):
                return False
            if op == "in" and str(ist) not in val:
                return False
            if op == "gte" and not (ist is not None and str(ist) >= str(val)):
                return False
            if op == "lte" and not (ist is not None and str(ist) <= str(val)):
                return False
            if op == "lt" and not (ist is not None and str(ist) < str(val)):
                return False
            if op == "isnull" and ist is not None:
                return False
        return True

    @staticmethod
    def _einzel(row: dict[str, Any], spalte: str, op: str, wert: str) -> bool:
        """Ein Glied einer `or_`-Gruppe."""
        ist = row.get(spalte)
        if op == "eq":
            return str(ist) == wert
        if op == "gte":
            return ist is not None and str(ist) >= wert
        if op == "lt":
            return ist is not None and str(ist) < wert
        raise AssertionError(f"unbekannter or_-Operator: {op}")

    def execute(self) -> _Result:
        rows = self._store.tabellen.setdefault(self._table, [])
        if self._modus in {"upsert", "insert"}:
            # Der Import schreibt availability als LISTE (Tages-Batch) und
            # stop_sell einzeln — beide Formen müssen ankommen.
            neu = (
                self._payload
                if isinstance(self._payload, list)
                else [self._payload or {}]
            )
            for zeile in neu:
                rows.append(dict(zeile))
                self._store.geschrieben.append((self._table, dict(zeile)))
            return _Result([dict(z) for z in neu])
        getroffen = [r for r in rows if self._passt(r)]
        if self._modus == "update":
            assert isinstance(self._payload, dict)
            for r in getroffen:
                r.update(self._payload)
            return _Result([dict(r) for r in getroffen])
        if self._modus == "delete":
            self._store.tabellen[self._table] = [
                r for r in rows if not self._passt(r)
            ]
            return _Result([dict(r) for r in getroffen])
        return _Result([dict(r) for r in getroffen])


class _Store:
    def __init__(self, tabellen: dict[str, list[dict[str, Any]]]) -> None:
        self.tabellen = tabellen
        self.geschrieben: list[tuple[str, dict[str, Any]]] = []

    def table(self, name: str) -> _Query:
        return _Query(self, name)


class _Channex:
    """Channex, das für die Vertragsende-Tage genau das liefert, was es live
    liefert: `availability = 0` UND `stop_sell = true` — sein eigenes Echo
    unseres Pushes."""

    def __init__(self, tage: list[date]) -> None:
        self._tage = tage

    def get_availability(self, *_a: object, **_k: object) -> dict[str, Any]:
        return {
            "data": {
                "rt-1": {t.isoformat(): 0 for t in self._tage},
            }
        }

    def get_restrictions(self, *_a: object, **_k: object) -> dict[str, Any]:
        return {
            "data": {
                "rp-1": {
                    t.isoformat(): {"stop_sell": True} for t in self._tage
                },
            }
        }


def _tage(von: date, anzahl: int) -> list[date]:
    return [date.fromordinal(von.toordinal() + i) for i in range(anzahl)]


def _store(vertragsende_tage: list[date], stop_tage: list[date]) -> _Store:
    """Ein Objekt, das bei Channex gemanaged ist, Push-Historie hat und dessen
    Vertragsende-Nächte im Kalender stehen.

    Beides ist nötig, damit der Import überhaupt bis zur Stop-Sell-Schleife
    kommt: ohne `channex_property_map` bricht er als „nicht gemanaged" ab, ohne
    `ari_outbox`-`done` greift der Warm-up-Guard.
    """
    return _Store(
        {
            "channex_property_map": [
                {
                    "tenant_id": TENANT,
                    "property_id": PROPERTY,
                    "channex_property_id": CHANNEX_PROPERTY,
                    "sync_enabled": True,
                }
            ],
            "ari_outbox": [
                {
                    "id": "ob-1",
                    "property_id": PROPERTY,
                    "status": "done",
                    "created_at": "2025-01-01T00:00:00+00:00",
                    "payload": {},
                }
            ],
            "availability": [
                {
                    "property_id": PROPERTY,
                    "unit_id": "u-1",
                    "date": t.isoformat(),
                    "status": "blocked",
                    "source": "contract_end",
                }
                for t in vertragsende_tage
            ],
            "stop_sell": [],
            "property_units": [
                {"id": "u-1", "property_id": PROPERTY, "tenant_id": TENANT}
            ],
            "rate_plans": [],
            "properties": [
                {
                    "id": PROPERTY,
                    "tenant_id": TENANT,
                    "contract_end_date": ENDE.isoformat(),
                }
            ],
        }
    )


def _geschriebene_stops(store: _Store) -> list[str]:
    return sorted(
        str(z["date"]) for tab, z in store.geschrieben if tab == "stop_sell"
    )


def _importieren(store: _Store, stop_tage: list[date]) -> dict[str, int]:
    svc = _Sync(_Channex(stop_tage))
    return svc._import_ari_single(  # noqa: SLF001
        store,
        TENANT,
        CHANNEX_PROPERTY,
        PROPERTY,
        {"rt-1"},
        {"rp-1"},
        days_ahead=30,
        today=ENDE,
    )


def test_vertragsende_tage_werden_nicht_als_stop_sell_geschrieben() -> None:
    """DER Fehler vom 12.08.2026: 307 `channex`-Zeilen auf Vertragsende-Nächten.

    Channex liefert für diese Tage `stop_sell = true` — aber das ist das Echo
    unseres eigenen `availability = 0`, nicht der Wille eines Portals. Ohne
    diesen Filter zeigte der Kalender „Stop-Sell" statt „Vertragsende".
    """
    tage = _tage(ENDE, 10)
    store = _store(vertragsende_tage=tage, stop_tage=tage)

    _importieren(store, tage)

    assert _geschriebene_stops(store) == [], (
        "Auf einer Vertragsende-Nacht darf KEIN Stop-Sell entstehen — der "
        "Kalender nennt sonst den falschen Grund und lädt zum Aufheben ein."
    )
    assert store.tabellen["stop_sell"] == []


def test_echter_portal_stop_ohne_vertragsende_kommt_weiter_an() -> None:
    """Die Umkehrprobe: der Filter darf nur Vertragsende-Tage ausnehmen.

    Ohne diesen Test wäre ein Filter, der ALLE Stop-Sells verwirft, genauso
    grün — und der echte OTA-Stop käme nie mehr bei uns an.
    """
    stop_tage = _tage(ENDE, 5)
    store = _store(vertragsende_tage=[], stop_tage=stop_tage)

    ergebnis = _importieren(store, stop_tage)

    assert _geschriebene_stops(store) == [t.isoformat() for t in stop_tage]
    assert ergebnis["stop_sell"] == len(stop_tage)


def test_nur_die_vertragsende_tage_fallen_aus() -> None:
    """Gemischter Zeitraum: der Filter arbeitet TAGGENAU, nicht pauschal.

    Live ist genau das der Normalfall — das Vertragsende beginnt mitten im
    gemeldeten Fenster, davor liegen offene Tage, die ein Portal wirklich
    gestoppt haben kann.
    """
    frei = _tage(date(2026, 10, 4), 5)  # 04.–08.10., vor dem Vertragsende
    gesperrt = _tage(ENDE, 5)  # 09.–13.10., Vertragsende
    store = _store(vertragsende_tage=gesperrt, stop_tage=frei + gesperrt)
    # Der Import startet am 04.10., damit beide Hälften im Fenster liegen.
    svc = _Sync(_Channex(frei + gesperrt))
    svc._import_ari_single(  # noqa: SLF001
        store,
        TENANT,
        CHANNEX_PROPERTY,
        PROPERTY,
        {"rt-1"},
        {"rp-1"},
        days_ahead=30,
        today=date(2026, 10, 4),
    )

    assert _geschriebene_stops(store) == [t.isoformat() for t in frei]
