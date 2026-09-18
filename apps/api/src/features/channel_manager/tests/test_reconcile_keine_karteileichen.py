"""Der Tenant-Reconcile legt je Channex-Property GENAU EIN Objekt an — auch
wenn er zehnmal läuft, und auch wenn er mittendrin scheitert.

DER LIVE-FEHLER, DEN DIESE DATEI FESTHÄLT (17.09.2026)
------------------------------------------------------
Ein Betrieb sah in seiner Inserate-Liste zehnmal dasselbe Ferienhaus
(„Mosekroen"), alle als Entwurf, ohne Bild, ohne Währung. Niemand hatte sie
angelegt.

Die Kette: `reconcile_properties_for_tenant` legte das Objekt an, schrieb die
Einheit — und stolperte dann über
`upsert(..., on_conflict="channex_property_id")`. Diese Spalte hat seit
Migration 0158 KEINEN eindeutigen Index mehr (ein Hotel ist bei Channex EINE
Property mit n Room-Types, also zeigen n Map-Zeilen auf dieselbe ID). Postgres
quittiert das mit 42P10, der Job starb — nach dem Anlegen des Objekts, vor dem
Schreiben der Verknüpfung.

Damit war das Objekt da, die Verknüpfung nicht. Der nächste Versuch sah „kein
Mapping" und legte wieder eines an. Die Wiederholungsstaffel des Jobs
(`_BACKOFF_MINUTES` = 1, 5, 15, 30, 60 min, `max_attempts` = 10) machte daraus
zehn Karteileichen in sechs Stunden. Zwei Mandanten gleichzeitig.

WARUM ES KEIN TEST GEFANGEN HAT
-------------------------------
Es gab für diese Funktion überhaupt keinen — sie läuft täglich gegen jeden
Mandanten und schreibt in `properties`, und kein einziger Test rief sie auf.
Die Attrappen der Nachbardateien hätten es auch nicht gefunden: sie nehmen
jedes `on_conflict` entgegen, egal ob es den Index gibt. Genau diese Nachsicht
ist der Grund, warum eine Zeile, die IMMER wirft, durch alle Gates kam.

Der Store hier ist deshalb streng: er kennt die Unique-Indizes der echten
Tabelle und wirft 42P10 für ein `on_conflict`, das keiner davon deckt — und
23505, wenn zwei aktive Map-Zeilen für dasselbe Objekt entstehen sollen.

DIE MANDANTENGRENZE (18.09.2026)
--------------------------------
Beim Aufräumen des Obigen kam heraus, dass drei Häuser eines NEUEN Kunden
zusätzlich in der Channex-Gruppe eines ANDEREN Betriebs hingen. Wir fahren ein
einziges Channex-Konto für die ganze Plattform; die Gruppe ist die einzige
Grenze — und Channex erlaubt eine Property in mehreren Gruppen. Der Abgleich
hätte die fremden Häuser gespiegelt, sobald er wieder durchlief.

Die letzten drei Tests halten den Riegel fest, der das verhindert. Er ist
fail-closed: kein Objekt ist besser als das Objekt des falschen Kunden.
"""
from typing import Any

from postgrest.exceptions import APIError

from src.features.channel_manager.channex_client import ChannexError
from src.features.channel_manager.property_mapping import PropertyMappingMixin

TENANT = "t-1"
FREMDER_BETRIEB = "t-2"
GRUPPE = "g-1"
FREMDE_GRUPPE = "g-2"
CHANNEX_PROPERTY = "cx-1"

# Was die echte Tabelle wirklich erzwingt (an der Live-DB nachgesehen,
# 17.09.2026): der Primärschlüssel und EIN partieller Unique-Index je Objekt.
# `channex_property_id` steht bewusst NICHT dabei — 0158 hat ihn entfernt.
_UNIQUE = {
    "channex_property_map": [("id",), ("property_id",)],
    "properties": [("id",)],
    "property_units": [("id",)],
}


class _Ergebnis:
    def __init__(self, data: list[dict[str, Any]]) -> None:
        self.data = data


class _Nicht:
    """Träger für `.not_.is_(...)`."""

    def __init__(self, query: "_Query") -> None:
        self._q = query

    def is_(self, spalte: str, wert: Any) -> "_Query":
        self._q.filter.append((spalte, "notnull" if str(wert) == "null" else "isnot", wert))
        return self._q


class _Query:
    """Minimal-PostgREST mit echter Filterwirkung und echten Indizes."""

    def __init__(self, store: "_Store", tabelle: str) -> None:
        self.store = store
        self.tabelle = tabelle
        self.filter: list[tuple[str, str, Any]] = []
        self.modus = "select"
        self.payload: dict[str, Any] | None = None

    # -- Verben ------------------------------------------------------------
    def select(self, *_a: object, **_k: object) -> "_Query":
        self.modus = "select"
        return self

    def insert(self, payload: dict[str, Any], **_k: object) -> "_Query":
        self.modus = "insert"
        self.payload = payload
        return self

    def update(self, payload: dict[str, Any], **_k: object) -> "_Query":
        self.modus = "update"
        self.payload = payload
        return self

    def delete(self, **_k: object) -> "_Query":
        self.modus = "delete"
        return self

    def upsert(self, payload: dict[str, Any], **kw: object) -> "_Query":
        ziel = str(kw.get("on_conflict") or "id")
        spalten = tuple(s.strip() for s in ziel.split(","))
        if spalten not in _UNIQUE.get(self.tabelle, []):
            raise APIError(
                {
                    "message": "there is no unique or exclusion constraint "
                    "matching the ON CONFLICT specification",
                    "code": "42P10",
                    "hint": None,
                    "details": None,
                }
            )
        self.modus = "insert"
        self.payload = payload
        return self

    # -- Filter ------------------------------------------------------------
    def eq(self, spalte: str, wert: Any) -> "_Query":
        self.filter.append((spalte, "eq", wert))
        return self

    def neq(self, spalte: str, wert: Any) -> "_Query":
        self.filter.append((spalte, "neq", wert))
        return self

    def in_(self, spalte: str, werte: list[Any]) -> "_Query":
        self.filter.append((spalte, "in", list(werte)))
        return self

    def is_(self, spalte: str, wert: Any) -> "_Query":
        self.filter.append((spalte, "isnull" if str(wert) == "null" else "is", wert))
        return self

    def limit(self, _n: int) -> "_Query":
        return self

    @property
    def not_(self) -> _Nicht:
        return _Nicht(self)

    # -- Ausführung --------------------------------------------------------
    def _passt(self, zeile: dict[str, Any]) -> bool:
        for spalte, art, wert in self.filter:
            ist = zeile.get(spalte)
            if art == "eq" and ist != wert:
                return False
            if art == "neq" and ist == wert:
                return False
            if art == "in" and ist not in wert:
                return False
            if art == "isnull" and ist is not None:
                return False
            if art == "notnull" and ist is None:
                return False
        return True

    def execute(self) -> _Ergebnis:
        zeilen = self.store.tabellen.setdefault(self.tabelle, [])
        if self.modus == "select":
            return _Ergebnis([dict(z) for z in zeilen if self._passt(z)])
        if self.modus == "insert":
            neu = dict(self.payload or {})
            neu.setdefault("id", f"{self.tabelle}-{len(zeilen) + 1}")
            self.store.pruefe_eindeutig(self.tabelle, neu)
            self.store.fehler_werfen(self.tabelle, "insert")
            zeilen.append(neu)
            return _Ergebnis([dict(neu)])
        if self.modus == "update":
            getroffen = [z for z in zeilen if self._passt(z)]
            for z in getroffen:
                z.update(self.payload or {})
            return _Ergebnis([dict(z) for z in getroffen])
        if self.modus == "delete":
            bleibt = [z for z in zeilen if not self._passt(z)]
            weg = [z for z in zeilen if self._passt(z)]
            self.store.tabellen[self.tabelle] = bleibt
            for z in weg:
                self.store.kaskade(self.tabelle, z)
            return _Ergebnis([dict(z) for z in weg])
        raise AssertionError(f"unbekannter Modus {self.modus}")


class _Store:
    def __init__(self) -> None:
        self.tabellen: dict[str, list[dict[str, Any]]] = {}
        self.fehler: dict[tuple[str, str], Exception] = {}

    def table(self, name: str) -> _Query:
        return _Query(self, name)

    def fehler_bei(self, tabelle: str, verb: str, exc: Exception) -> None:
        """Einen Schreibfehler an genau einer Stelle scharf schalten."""
        self.fehler[(tabelle, verb)] = exc

    def fehler_werfen(self, tabelle: str, verb: str) -> None:
        exc = self.fehler.get((tabelle, verb))
        if exc is not None:
            raise exc

    def pruefe_eindeutig(self, tabelle: str, neu: dict[str, Any]) -> None:
        """Der partielle Unique-Index: je Objekt höchstens EINE offene Map-Zeile."""
        if tabelle != "channex_property_map" or neu.get("deleted_at") is not None:
            return
        for z in self.tabellen.get(tabelle, []):
            if z.get("property_id") == neu.get("property_id") and z.get("deleted_at") is None:
                raise APIError(
                    {
                        "message": 'duplicate key value violates unique constraint '
                        '"channex_property_map_property_uidx"',
                        "code": "23505",
                        "hint": None,
                        "details": None,
                    }
                )

    def kaskade(self, tabelle: str, zeile: dict[str, Any]) -> None:
        """ON DELETE CASCADE: property_units und Map-Zeilen hängen an properties."""
        if tabelle != "properties":
            return
        for kind in ("property_units", "channex_property_map"):
            self.tabellen[kind] = [
                z for z in self.tabellen.get(kind, [])
                if z.get("property_id") != zeile["id"]
            ]


class _Channex:
    """Channex-Auskunft, soweit der Abgleich sie braucht.

    `gruppen` bildet nach, was live der Ausloeser war: eine Property kann bei
    Channex in MEHREREN Gruppen haengen.
    """

    is_configured = True

    def __init__(self, gruppen: dict[str, list[str]] | None = None) -> None:
        self.gruppen = gruppen or {CHANNEX_PROPERTY: [GRUPPE]}

    def get_property(self, channex_id: str) -> dict[str, Any]:
        return {
            "data": {
                "relationships": {
                    "groups": {
                        "data": [
                            {"id": g} for g in self.gruppen.get(channex_id, [])
                        ]
                    }
                }
            }
        }


class _Reconcile(PropertyMappingMixin):
    """Nur das Mapping-Mixin; die Nachbarn sind für diesen Pfad Kulisse."""

    def __init__(
        self,
        db: _Store,
        live: list[dict[str, Any]],
        gruppen: dict[str, list[str]] | None = None,
    ) -> None:
        self._db = db
        self._channex = _Channex(gruppen)
        self._live = live

    def _tenant_group_id(self, _db: object, _tenant_id: str) -> str:
        return GRUPPE

    def _live_channex_properties_for_group(
        self, _group_id: str
    ) -> list[dict[str, Any]]:
        return self._live

    def _reconcile_channel_connections(self, _db: object, _tenant_id: str) -> None:
        return None

    def _billing_property_attrs(self, _db: object, _tenant_id: str) -> dict[str, Any]:
        return {}

    def _channex_verwaiste_abraeumen(self, *_a: object, **_k: object) -> int:
        return 0

    def reconcile_rate_plan_prices(self, *_a: object, **_k: object) -> None:
        return None

    def _chat_nachziehen(self, *_a: object, **_k: object) -> None:
        return None


def _dienst(
    db: _Store, gruppen: dict[str, list[str]] | None = None
) -> _Reconcile:
    # Wer welche Channex-Gruppe besitzt — die Grenze zwischen den Betrieben.
    db.tabellen["channex_group_map"] = [
        {"id": "m-1", "tenant_id": TENANT, "channex_group_id": GRUPPE},
        {"id": "m-2", "tenant_id": FREMDER_BETRIEB, "channex_group_id": FREMDE_GRUPPE},
    ]
    return _Reconcile(
        db,
        [
            {
                "id": CHANNEX_PROPERTY,
                "attributes": {
                    "title": "Mosekroen",
                    "city": "Rødding",
                    "country": "DK",
                },
            }
        ],
        gruppen,
    )


def _objekte(db: _Store) -> list[dict[str, Any]]:
    return db.tabellen.get("properties", [])


# -- Der Normalfall ---------------------------------------------------------


def test_ein_lauf_legt_genau_ein_objekt_mit_verknuepfung_an() -> None:
    """Das ist der Lauf, der live 42P10 warf: er muss durchgehen."""
    db = _Store()
    ergebnis = _dienst(db).reconcile_properties_for_tenant(TENANT)

    assert ergebnis["created"] == 1
    assert len(_objekte(db)) == 1
    assert _objekte(db)[0]["title"] == "Mosekroen"
    # Die Verknüpfung ist das Entscheidende — ohne sie entsteht die Karteileiche.
    maps = db.tabellen["channex_property_map"]
    assert len(maps) == 1
    assert maps[0]["channex_property_id"] == CHANNEX_PROPERTY
    assert maps[0]["property_id"] == _objekte(db)[0]["id"]
    # Ohne Einheit wäre das Objekt unverkäuflich (0265).
    assert len(db.tabellen["property_units"]) == 1


def test_zehn_laeufe_legen_kein_zweites_objekt_an() -> None:
    """Der eigentliche Schaden war die Wiederholung: zehn Versuche, zehn Objekte.

    Zehn Läufe sind hier kein Selbstzweck — es ist exakt `max_attempts`.
    """
    db = _Store()
    dienst = _dienst(db)
    for _ in range(10):
        dienst.reconcile_properties_for_tenant(TENANT)

    assert len(_objekte(db)) == 1
    assert len(db.tabellen["channex_property_map"]) == 1


# -- Der Fehlerfall ---------------------------------------------------------


def test_scheitert_die_verknuepfung_bleibt_keine_karteileiche() -> None:
    """Der Gegenzustand (Wurzel 1): kein halbes Objekt darf stehen bleiben.

    Hier scheitert das Schreiben der Verknüpfung — genau die Stelle, an der es
    live scheiterte. Das eben angelegte Objekt muss wieder verschwinden, sonst
    findet der nächste Lauf es nicht wieder und legt das nächste an.
    """
    db = _Store()
    db.fehler_bei(
        "channex_property_map",
        "insert",
        APIError({"message": "boom", "code": "XX000", "hint": None, "details": None}),
    )

    try:
        _dienst(db).reconcile_properties_for_tenant(TENANT)
    except APIError:
        pass
    else:
        raise AssertionError("der Fehler muss durchgereicht werden")

    assert _objekte(db) == []
    assert db.tabellen.get("property_units") == []


def test_nach_dem_fehlschlag_legt_der_naechste_lauf_genau_eines_an() -> None:
    """Die Probe aufs Ganze: erst scheitern, dann gelingen — EIN Objekt."""
    db = _Store()
    dienst = _dienst(db)
    db.fehler_bei(
        "channex_property_map",
        "insert",
        APIError({"message": "boom", "code": "XX000", "hint": None, "details": None}),
    )
    try:
        dienst.reconcile_properties_for_tenant(TENANT)
    except APIError:
        pass

    db.fehler.clear()
    dienst.reconcile_properties_for_tenant(TENANT)

    assert len(_objekte(db)) == 1
    assert len(db.tabellen["channex_property_map"]) == 1


# -- Die Attrappe selbst ----------------------------------------------------


def test_der_store_faengt_ein_on_conflict_ohne_index() -> None:
    """Ohne diese Strenge wäre der ganze Rest dieser Datei wertlos.

    Die Attrappen der Nachbardateien winken jedes `on_conflict` durch — deshalb
    war der Fehler in allen Gates unsichtbar und fiel erst dem Kunden auf.
    """
    db = _Store()
    try:
        db.table("channex_property_map").upsert(
            {"property_id": "p-1"}, on_conflict="channex_property_id"
        )
    except APIError as exc:
        assert "42P10" in str(exc)
    else:
        raise AssertionError("ein on_conflict ohne Unique-Index muss 42P10 werfen")


# -- Die Mandantengrenze ----------------------------------------------------


def test_bereits_fremd_verknuepfte_property_wird_nicht_gespiegelt() -> None:
    """Gehoert die Property schon einem anderen Betrieb, entsteht hier nichts."""
    db = _Store()
    dienst = _dienst(db)
    db.tabellen["channex_property_map"] = [
        {
            "id": "fremd-1",
            "tenant_id": FREMDER_BETRIEB,
            "property_id": "fremdes-objekt",
            "channex_property_id": CHANNEX_PROPERTY,
            "deleted_at": None,
        }
    ]

    ergebnis = dienst.reconcile_properties_for_tenant(TENANT)

    assert ergebnis["created"] == 0
    assert ergebnis["skipped"] == 1
    assert _objekte(db) == []
    # Die fremde Zeile bleibt unangetastet.
    assert len(db.tabellen["channex_property_map"]) == 1


def test_property_in_zwei_betriebsgruppen_wird_nicht_gespiegelt() -> None:
    """Der reale Fall: dasselbe Haus haengt in zwei Betriebs-Gruppen.

    Das ist nicht entscheidbar — also wird NICHT geraten, sondern
    uebersprungen. Mit dem alten Verhalten waere das Haus im Konto des
    falschen Kunden gelandet.
    """
    db = _Store()
    dienst = _dienst(db, gruppen={CHANNEX_PROPERTY: [GRUPPE, FREMDE_GRUPPE]})

    ergebnis = dienst.reconcile_properties_for_tenant(TENANT)

    assert ergebnis["created"] == 0
    assert ergebnis["skipped"] == 1
    assert _objekte(db) == []


def test_ohne_auskunft_von_channex_entsteht_kein_objekt() -> None:
    """Kein Urteil ohne Auskunft (Wurzel 5): faellt Channex aus, wird nichts
    angelegt, statt die Herkunft zu unterstellen."""
    db = _Store()
    dienst = _dienst(db)

    def _wirft(_channex_id: str) -> dict[str, Any]:
        raise ChannexError("Channex nicht erreichbar", status_code=502)

    dienst._channex.get_property = _wirft  # noqa: SLF001 — Attrappe

    ergebnis = dienst.reconcile_properties_for_tenant(TENANT)

    assert ergebnis["created"] == 0
    assert _objekte(db) == []
