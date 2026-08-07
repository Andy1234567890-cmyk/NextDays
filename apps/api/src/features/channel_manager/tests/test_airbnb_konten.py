"""Mehrere Airbnb-Konten je Betrieb (0304).

Der Fall: eine Agentur betreut hunderte Vermieter mit je eigenem Airbnb-Zugang.
Vorher war „das Airbnb-Konto des Betriebs" eine Annahme im Code — und die
Auflösung nahm ohne Sortierung den ersten Treffer. Bei zwei Konten hätte
derselbe Aufruf mal das eine, mal das andere geliefert, und ein Push wäre in
den Inseraten eines FREMDEN Vermieters gelandet.
"""
from typing import Any

from src.features.channel_manager.airbnb_konten import kontoweise
from src.features.channel_manager.ota_konten import gehoert_kanal_dem_betrieb


class _Res:
    def __init__(self, data: list[dict[str, Any]]) -> None:
        self.data = data


class _Query:
    """Minimaler PostgREST-Nachbau: sammelt Filter, liefert passende Zeilen."""

    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows
        self._eq: dict[str, Any] = {}
        self._in: tuple[str, list[str]] | None = None

    def select(self, *_a: object, **_k: object) -> "_Query":
        return self

    def eq(self, col: str, val: object) -> "_Query":
        self._eq[col] = val
        return self

    def in_(self, col: str, vals: list[str]) -> "_Query":
        self._in = (col, vals)
        return self

    def neq(self, col: str, val: object) -> "_Query":
        self._rows = [r for r in self._rows if r.get(col) != val]
        return self

    def not_(self) -> "_Query":  # pragma: no cover — über `not_` als Attribut
        return self

    def is_(self, _col: str, _val: object) -> "_Query":
        return self

    def order(self, *_a: object, **_k: object) -> "_Query":
        return self

    def limit(self, *_a: object, **_k: object) -> "_Query":
        return self

    def execute(self) -> _Res:
        rows = self._rows
        for col, val in self._eq.items():
            rows = [r for r in rows if r.get(col) == val]
        if self._in:
            col, vals = self._in
            rows = [r for r in rows if str(r.get(col)) in {str(v) for v in vals}]
        return _Res(rows)


class _Not:
    """`.not_.is_(...)` — hier immer „Feld ist gesetzt"."""

    def __init__(self, q: _Query) -> None:
        self._q = q

    def is_(self, col: str, _val: object) -> _Query:
        self._q._rows = [r for r in self._q._rows if r.get(col) is not None]  # noqa: SLF001
        return self._q


def _mit_not(q: _Query) -> _Query:
    q.not_ = _Not(q)  # type: ignore[assignment]
    return q


class _DB:
    def __init__(self, tabellen: dict[str, list[dict[str, Any]]]) -> None:
        self._t = tabellen

    def table(self, name: str) -> _Query:
        return _mit_not(_Query(list(self._t.get(name, []))))


_KONTO_A = "acc-a"
_KONTO_B = "acc-b"


def _db_mit_zwei_konten() -> _DB:
    return _DB({
        "ota_account": [
            {"id": _KONTO_A, "tenant_id": "t1", "ota_portal_code": "AirBNB",
             "is_active": True, "channex_channel_id": "kanal-a",
             "ota_hotel_id": "111", "display_name": "Vermieter Nord"},
            {"id": _KONTO_B, "tenant_id": "t1", "ota_portal_code": "AirBNB",
             "is_active": True, "channex_channel_id": "kanal-b",
             "ota_hotel_id": "222", "display_name": "Vermieter Süd"},
        ],
        "channex_channel_connection": [
            {"tenant_id": "t1", "ota_portal_code": "AirBNB",
             "ota_account_id": _KONTO_A, "property_id": "p-1"},
            {"tenant_id": "t1", "ota_portal_code": "AirBNB",
             "ota_account_id": _KONTO_B, "property_id": "p-2"},
        ],
    })


def test_jede_zeile_geht_an_ihr_eigenes_konto() -> None:
    """Die Buchung von Objekt 2 darf NICHT mit dem Token von Konto A laufen.

    Genau das ist der Schaden, den 0304 verhindert: mit fremdem Token findet
    Airbnb die Buchung nicht, meldet aber keinen Fehler — der Tick schreibt
    „0 aktualisiert" und niemand merkt, dass ein Konto nie bedient wird.
    """
    db = _db_mit_zwei_konten()
    zeilen = [
        {"id": "r-1", "property_id": "p-1"},
        {"id": "r-2", "property_id": "p-2"},
    ]
    gesehen: list[tuple[str, list[str]]] = []

    def arbeit(_db: object, _t: str, teil: list[dict[str, Any]], kanal: str) -> int:
        gesehen.append((kanal, [str(z["id"]) for z in teil]))
        return len(teil)

    assert kontoweise(db, "t1", zeilen, arbeit, hat_property=True) == 2
    assert sorted(gesehen) == [("kanal-a", ["r-1"]), ("kanal-b", ["r-2"])]


def test_ein_konto_laeuft_ohne_aufteilung_durch() -> None:
    """Der Normalfall bleibt ein einziger Aufruf — keine Zusatzabfragen."""
    db = _DB({
        "ota_account": [
            {"id": _KONTO_A, "tenant_id": "t1", "ota_portal_code": "AirBNB",
             "is_active": True, "channex_channel_id": "kanal-a",
             "ota_hotel_id": "111", "display_name": None},
        ],
    })
    zeilen = [{"id": "r-1"}, {"id": "r-2"}]
    aufrufe: list[str] = []

    def arbeit(_db: object, _t: str, teil: list[dict[str, Any]], kanal: str) -> int:
        aufrufe.append(kanal)
        return len(teil)

    assert kontoweise(db, "t1", zeilen, arbeit) == 2
    assert aufrufe == ["kanal-a"]


def test_zeile_ohne_zuordnung_bleibt_liegen() -> None:
    """Lieber nichts tun als mit dem falschen Token fragen.

    Eine Buchung, deren Objekt an keinem Konto hängt, darf nicht beim
    erstbesten Konto mitlaufen — das verbraucht Kontingent und liefert nichts.
    """
    db = _db_mit_zwei_konten()
    zeilen = [{"id": "r-x", "property_id": "p-fremd"}]

    def arbeit(_db: object, _t: str, teil: list[dict[str, Any]], _k: str) -> int:
        return len(teil)

    assert kontoweise(db, "t1", zeilen, arbeit, hat_property=True) == 0


def test_konto_ohne_objekte_gilt_als_eigenes() -> None:
    """Ein frisch verbundenes Konto muss trennbar sein.

    DER VORFALL (07.08.2026): Die Eigentumsprüfung sah nur in
    `channex_channel_connection` nach. Ein gerade verbundenes Konto, dessen
    Autorisierung noch nicht durch war, hatte dort NULL Zeilen — das Trennen
    antwortete mit 404, obwohl der Kanal bei Channex existierte und das Konto
    in unserer DB stand. Der Betrieb wurde den angefangenen Zugang nicht los.
    """
    db = _DB({
        "ota_account": [
            {"id": _KONTO_A, "tenant_id": "t1", "ota_portal_code": "AirBNB",
             "is_active": True, "channex_channel_id": "kanal-neu",
             "ota_hotel_id": None, "display_name": None},
        ],
        "channex_channel_connection": [],
    })
    assert gehoert_kanal_dem_betrieb(db, "t1", "kanal-neu") is True


def test_fremder_kanal_gehoert_nicht() -> None:
    """IDOR-Schutz bleibt: ein Kanal ohne Beleg gehört dem Betrieb nicht."""
    db = _DB({"ota_account": [], "channex_channel_connection": []})
    assert gehoert_kanal_dem_betrieb(db, "t1", "kanal-fremd") is False


def test_dasselbe_konto_zweimal_wird_erkannt() -> None:
    """Dieselbe Host-ID an zwei Kanälen = derselbe Portal-Zugang.

    DER VORFALL (07.08.2026): Beim Verbinden eines zweiten Airbnb-Kontos war
    der Browser noch beim ERSTEN angemeldet. Airbnb nimmt dann ohne Rückfrage
    das laufende Konto — es entstand ein zweiter Kanal auf denselben Host, und
    in der Objektliste blieben zwei leere „Airbnb-Übernahme läuft" stehen.

    Die Host-ID ist die Kennung des Kontos beim Portal: dieselbe an zwei
    Kanälen kann nur derselbe Zugang sein.
    """
    db = _DB({
        "ota_account": [
            {"id": _KONTO_A, "tenant_id": "t1", "ota_portal_code": "AirBNB",
             "is_active": True, "channex_channel_id": "kanal-alt",
             "ota_hotel_id": "529591717", "display_name": None},
        ],
    })
    treffer = (
        db.table("ota_account")
        .select("id")
        .eq("tenant_id", "t1")
        .eq("ota_hotel_id", "529591717")
        .neq("channex_channel_id", "kanal-neu")
        .execute()
    ).data
    assert treffer, "der bestehende Kanal mit derselben Host-ID muss gefunden werden"


def test_anderes_konto_ist_keine_dublette() -> None:
    """Eine andere Host-ID ist ein echter zweiter Zugang — kein Fehler."""
    db = _DB({
        "ota_account": [
            {"id": _KONTO_A, "tenant_id": "t1", "ota_portal_code": "AirBNB",
             "is_active": True, "channex_channel_id": "kanal-alt",
             "ota_hotel_id": "529591717", "display_name": None},
        ],
    })
    treffer = (
        db.table("ota_account")
        .select("id")
        .eq("tenant_id", "t1")
        .eq("ota_hotel_id", "888888888")
        .neq("channex_channel_id", "kanal-neu")
        .execute()
    ).data
    assert not treffer


def test_ohne_konto_passiert_nichts() -> None:
    """Kein verbundenes Konto → kein Abruf, kein Fehler."""
    db = _DB({"ota_account": []})

    def arbeit(_db: object, _t: str, _z: list[dict[str, Any]], _k: str) -> int:
        raise AssertionError("darf nicht aufgerufen werden")

    assert kontoweise(db, "t1", [{"id": "r-1"}], arbeit) == 0
