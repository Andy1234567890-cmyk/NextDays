"""Der Tenant-Abgleich legt je Channex-Property GENAU EIN Objekt an — auch
wenn er zehnmal läuft, auch wenn er mittendrin stirbt, und nur, wenn die
Property diesem Betrieb gehört.

DER LIVE-FEHLER, DEN DIESE DATEI FESTHÄLT (17.09.2026)
------------------------------------------------------
Ein Betrieb sah in seiner Inserate-Liste zehnmal dasselbe Ferienhaus
(„Mosekroen"), alle als Entwurf, ohne Bild, ohne Währung. Niemand hatte sie
angelegt.

Die Kette: `reconcile_properties_for_tenant` legte das Objekt an, schrieb die
Einheit — und stolperte dann über
`upsert(..., on_conflict="channex_property_id")`. Diese Spalte hat seit
Migration 0158 KEINEN eindeutigen Index mehr (ein Hotel ist bei Channex EINE
Property mit n Room-Types). Postgres quittiert das mit 42P10, der Job starb —
nach dem Anlegen des Objekts, vor dem Schreiben der Verknüpfung. Der nächste
Versuch sah „kein Mapping" und legte wieder eines an; die Wiederholungsstaffel
(`_BACKOFF_MINUTES`, `max_attempts` = 10) machte daraus zehn Karteileichen.

WARUM ES JETZT EINE DATENBANKFUNKTION IST (0721)
------------------------------------------------
Der erste Fix nahm ein halbes Objekt in Python zurück. Zwei unabhängige
Reviewer haben belegt, dass das nicht reicht: ein Fehler in der Einheit
zwischen den Schritten, ein httpx-Timeout statt APIError, ein harter
Prozesstod (OOM, Deploy), zwei gleichzeitige Läufe (Onboarding-Klick und
Worker-Tick) — jeder Weg hinterließ wieder eine Waise oder eine Dublette.
Zwei PostgREST-Aufrufe sind zwei Transaktionen; dazwischen kann alles
passieren. Seit 0721 entscheidet `channex_objekt_spiegeln` in EINER
Transaktion mit Sperre je (Betrieb, Property). Der Store hier bildet ihre
Fälle nach; ihre Atomarität selbst ist Postgres' Sache und wurde gegen die
Live-Datenbank in einer zurückgerollten Transaktion geprüft.

DIE MANDANTENGRENZE (18.09.2026)
--------------------------------
Drei Häuser eines NEUEN Kunden hingen zusätzlich in der Channex-Gruppe eines
ANDEREN Betriebs. Wir fahren ein Channex-Konto je Plattform, eine Gruppe je
Betrieb — und Channex erlaubt eine Property in mehreren Gruppen. Der Abgleich
hätte die fremden Häuser gespiegelt. Der Riegel `_gehoert_dem_betrieb` steht
seither vor JEDEM Schreibpfad: Anlegen, Reaktivieren, und über
`_fremd_verknuepft` auch vor dem Spiegeln und Pushen bestehender
Verknüpfungen. Fail-closed: kein Objekt ist besser als das Objekt des
falschen Kunden.

WARUM DER STORE STRENG IST
--------------------------
Die Attrappen der Nachbardateien nehmen jedes `on_conflict` entgegen und
prüfen keinen Index. Genau diese Nachsicht ließ eine Zeile, die IMMER wirft,
durch alle Gates. Dieser Store kennt die Unique-Indizes der echten Tabelle
(auch beim UPDATE, nicht nur beim INSERT), wirft 42P10 für ein `on_conflict`
ohne Index, 23505 für die zweite aktive Map-Zeile eines Objekts, wählt bei
`limit(1)` wirklich EINE Zeile und legt — wie der Trigger 0571 live — zu
jedem neuen Objekt die Einheit an.
"""
from typing import Any

from postgrest.exceptions import APIError

from src.features.channel_manager.channex_client import ChannexError
from src.features.channel_manager.property_mapping import PropertyMappingMixin

TENANT = "t-1"
FREMDER_BETRIEB = "t-2"
GRUPPE = "g-1"
FREMDE_GRUPPE = "g-2"
UNBEKANNTE_GRUPPE = "g-handgemacht"
CHANNEX_PROPERTY = "cx-1"

# Was die echte Tabelle wirklich erzwingt (Live-DB, 17.09.2026): der
# Primärschlüssel und EIN partieller Unique-Index je Objekt (deleted_at is
# null). `channex_property_id` steht bewusst NICHT dabei — 0158 hat ihn entfernt.
_UNIQUE = {
    "channex_property_map": [("id",), ("property_id",)],
    "properties": [("id",)],
    "property_units": [("id",)],
}


def _fehler(code: str, text: str) -> APIError:
    return APIError({"message": text, "code": code, "hint": None, "details": None})


class _Ergebnis:
    def __init__(self, data: list[dict[str, Any]]) -> None:
        self.data = data


class _Nicht:
    def __init__(self, query: "_Query") -> None:
        self._q = query

    def is_(self, spalte: str, wert: Any) -> "_Query":
        self._q.filter.append((spalte, "notnull" if str(wert) == "null" else "isnot", wert))
        return self._q


class _Query:
    """Minimal-PostgREST mit echter Filterwirkung, echten Indizes, echtem limit."""

    def __init__(self, store: "_Store", tabelle: str) -> None:
        self.store = store
        self.tabelle = tabelle
        self.filter: list[tuple[str, str, Any]] = []
        self.modus = "select"
        self.payload: dict[str, Any] | None = None
        self.grenze: int | None = None
        self.sortierung: tuple[str, bool] | None = None
        self.bereich: tuple[int, int] | None = None

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
            raise _fehler(
                "42P10",
                "there is no unique or exclusion constraint matching the "
                "ON CONFLICT specification",
            )
        self.modus = "insert"
        self.payload = payload
        return self

    # -- Filter / Form -------------------------------------------------------
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

    def order(self, spalte: str, *, desc: bool = False) -> "_Query":
        self.sortierung = (spalte, desc)
        return self

    def limit(self, n: int) -> "_Query":
        self.grenze = n
        return self

    def range(self, von: int, bis: int) -> "_Query":
        self.bereich = (von, bis)
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

    def _treffer(self, zeilen: list[dict[str, Any]]) -> list[dict[str, Any]]:
        t = [z for z in zeilen if self._passt(z)]
        if self.sortierung:
            spalte, desc = self.sortierung
            t.sort(key=lambda z: str(z.get(spalte) or ""), reverse=desc)
        if self.bereich:
            von, bis = self.bereich
            t = t[von : bis + 1]
        if self.grenze is not None:
            t = t[: self.grenze]
        return t

    def execute(self) -> _Ergebnis:
        zeilen = self.store.tabellen.setdefault(self.tabelle, [])
        if self.modus == "select":
            return _Ergebnis([dict(z) for z in self._treffer(zeilen)])
        if self.modus == "insert":
            neu = dict(self.payload or {})
            neu.setdefault("id", f"{self.tabelle}-{len(zeilen) + 1}")
            self.store.pruefe_eindeutig(self.tabelle, neu, ausser_id=None)
            self.store.fehler_werfen(self.tabelle, "insert")
            zeilen.append(neu)
            self.store.trigger_nach_insert(self.tabelle, neu)
            return _Ergebnis([dict(neu)])
        if self.modus == "update":
            getroffen = self._treffer(zeilen)
            for z in getroffen:
                kandidat = {**z, **(self.payload or {})}
                # Postgres prüft den Unique-Index auch beim UPDATE — der
                # Reviewer fand genau hier den Fall „im Fake grün, live rot".
                self.store.pruefe_eindeutig(self.tabelle, kandidat, ausser_id=z["id"])
            self.store.fehler_werfen(self.tabelle, "update")
            for z in getroffen:
                z.update(self.payload or {})
            return _Ergebnis([dict(z) for z in getroffen])
        if self.modus == "delete":
            weg = self._treffer(zeilen)
            self.store.tabellen[self.tabelle] = [z for z in zeilen if z not in weg]
            for z in weg:
                self.store.kaskade(self.tabelle, z)
            return _Ergebnis([dict(z) for z in weg])
        raise AssertionError(f"unbekannter Modus {self.modus}")


class _Rpc:
    def __init__(self, store: "_Store", name: str, args: dict[str, Any]) -> None:
        self.store, self.name, self.args = store, name, args

    def execute(self) -> _Ergebnis:
        if self.name != "channex_objekt_spiegeln":
            raise AssertionError(f"unbekannte RPC {self.name}")
        self.store.fehler_werfen("rpc", "channex_objekt_spiegeln")
        return _Ergebnis([self.store.objekt_spiegeln(**self.args)])


class _Store:
    def __init__(self) -> None:
        self.tabellen: dict[str, list[dict[str, Any]]] = {}
        self.fehler: dict[tuple[str, str], Exception] = {}
        self.rpc_aufrufe: list[dict[str, Any]] = []

    def table(self, name: str) -> _Query:
        return _Query(self, name)

    def rpc(self, name: str, args: dict[str, Any]) -> _Rpc:
        self.rpc_aufrufe.append({"name": name, **args})
        return _Rpc(self, name, args)

    def fehler_bei(self, tabelle: str, verb: str, exc: Exception) -> None:
        self.fehler[(tabelle, verb)] = exc

    def fehler_werfen(self, tabelle: str, verb: str) -> None:
        exc = self.fehler.get((tabelle, verb))
        if exc is not None:
            raise exc

    def pruefe_eindeutig(
        self, tabelle: str, zeile: dict[str, Any], *, ausser_id: str | None
    ) -> None:
        """Der partielle Unique-Index: je Objekt höchstens EINE offene Map-Zeile."""
        if tabelle != "channex_property_map" or zeile.get("deleted_at") is not None:
            return
        for z in self.tabellen.get(tabelle, []):
            if z.get("id") == ausser_id:
                continue
            if z.get("property_id") == zeile.get("property_id") and z.get("deleted_at") is None:
                raise _fehler(
                    "23505",
                    'duplicate key value violates unique constraint '
                    '"channex_property_map_property_uidx"',
                )

    def trigger_nach_insert(self, tabelle: str, zeile: dict[str, Any]) -> None:
        """0571 `properties_ersteinheit_anlegen`: jedes neue Objekt bekommt seine Einheit."""
        if tabelle == "properties":
            self.tabellen.setdefault("property_units", []).append(
                {
                    "id": f"unit-{len(self.tabellen['property_units']) + 1}",
                    "tenant_id": zeile.get("tenant_id"),
                    "property_id": zeile["id"],
                    "position": 0,
                }
            )

    def kaskade(self, tabelle: str, zeile: dict[str, Any]) -> None:
        if tabelle != "properties":
            return
        for kind in ("property_units", "channex_property_map"):
            self.tabellen[kind] = [
                z for z in self.tabellen.get(kind, []) if z.get("property_id") != zeile["id"]
            ]

    # -- Die Datenbankfunktion aus 0721, Fall für Fall nachgebildet ----------
    def objekt_spiegeln(
        self, p_tenant_id: str, p_channex_property_id: str, p_zeile: dict[str, Any]
    ) -> dict[str, Any]:
        if not p_zeile.get("title"):
            raise _fehler("22023", "title ist Pflicht")
        maps = self.tabellen.setdefault("channex_property_map", [])
        props = self.tabellen.setdefault("properties", [])

        eigene_aktiv = [
            m for m in maps
            if m["tenant_id"] == p_tenant_id
            and m["channex_property_id"] == p_channex_property_id
            and m.get("deleted_at") is None
        ]
        if eigene_aktiv:
            return {"property_id": eigene_aktiv[0]["property_id"], "ergebnis": "vorhanden"}
        if any(
            m["channex_property_id"] == p_channex_property_id
            and m.get("deleted_at") is None
            and m["tenant_id"] != p_tenant_id
            for m in maps
        ):
            return {"property_id": None, "ergebnis": "fremd"}

        soft = sorted(
            (
                m for m in maps
                if m["tenant_id"] == p_tenant_id
                and m["channex_property_id"] == p_channex_property_id
                and m.get("deleted_at") is not None
            ),
            key=lambda m: (str(m.get("deleted_at")), str(m.get("created_at") or "")),
            reverse=True,
        )
        for m in soft:
            prop = next(
                (p for p in props if p["id"] == m["property_id"] and p["tenant_id"] == p_tenant_id),
                None,
            )
            if prop is None:
                continue
            if prop.get("archived_at") is not None:
                return {"property_id": prop["id"], "ergebnis": "archiviert"}
            if any(
                x["property_id"] == prop["id"] and x.get("deleted_at") is None for x in maps
            ):
                return {"property_id": prop["id"], "ergebnis": "anders_verknuepft"}
            m.update(deleted_at=None, sync_enabled=True, last_sync_status="ok")
            for k in ("address", "city", "postal_code", "country", "lat", "lng"):
                if p_zeile.get(k) is not None:
                    prop[k] = p_zeile[k]
            return {"property_id": prop["id"], "ergebnis": "reaktiviert"}

        neu = {
            "id": f"properties-{len(props) + 1}",
            "tenant_id": p_tenant_id,
            "status": "draft",
            **{k: p_zeile.get(k) for k in
               ("title", "description", "address", "city", "postal_code", "country", "lat", "lng")},
        }
        props.append(neu)
        self.trigger_nach_insert("properties", neu)
        maps.append(
            {
                "id": f"map-{len(maps) + 1}",
                "tenant_id": p_tenant_id,
                "property_id": neu["id"],
                "channex_property_id": p_channex_property_id,
                "sync_enabled": True,
                "last_sync_status": "ok",
                "deleted_at": None,
            }
        )
        return {"property_id": neu["id"], "ergebnis": "neu"}


class _Channex:
    is_configured = True

    def __init__(self, gruppen: dict[str, list[str]] | None = None) -> None:
        self.gruppen = gruppen or {CHANNEX_PROPERTY: [GRUPPE]}

    def get_property(self, channex_id: str) -> dict[str, Any]:
        return {
            "data": {
                "relationships": {
                    "groups": {"data": [{"id": g} for g in self.gruppen.get(channex_id, [])]}
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
        self.preis_pushes: list[str] = []
        self.chat_ids: list[str] = []

    def _tenant_group_id(self, _db: object, _tenant_id: str) -> str:
        return GRUPPE

    def _live_channex_properties_for_group(self, _group_id: str) -> list[dict[str, Any]]:
        return self._live

    def _reconcile_channel_connections(self, _db: object, _tenant_id: str) -> None:
        return None

    def _billing_property_attrs(self, _db: object, _tenant_id: str) -> dict[str, Any]:
        return {}

    def _channex_verwaiste_abraeumen(self, *_a: object, **_k: object) -> int:
        return 0

    def reconcile_rate_plan_prices(self, _tenant_id: str, property_id: str) -> None:
        self.preis_pushes.append(property_id)

    def _chat_nachziehen(self, ids: list[str]) -> None:
        self.chat_ids.extend(ids)


def _dienst(db: _Store, gruppen: dict[str, list[str]] | None = None) -> _Reconcile:
    db.tabellen["channex_group_map"] = [
        {"id": "m-1", "tenant_id": TENANT, "channex_group_id": GRUPPE},
        {"id": "m-2", "tenant_id": FREMDER_BETRIEB, "channex_group_id": FREMDE_GRUPPE},
    ]
    return _Reconcile(
        db,
        [
            {
                "id": CHANNEX_PROPERTY,
                "attributes": {"title": "Mosekroen", "city": "Rødding", "country": "DK"},
            }
        ],
        gruppen,
    )


def _objekte(db: _Store, tenant: str = TENANT) -> list[dict[str, Any]]:
    return [p for p in db.tabellen.get("properties", []) if p["tenant_id"] == tenant]


def _maps(db: _Store, tenant: str = TENANT) -> list[dict[str, Any]]:
    return [
        m for m in db.tabellen.get("channex_property_map", [])
        if m["tenant_id"] == tenant and m.get("deleted_at") is None
    ]


# -- Der Normalfall ---------------------------------------------------------


def test_ein_lauf_legt_genau_ein_objekt_mit_verknuepfung_und_einheit_an() -> None:
    db = _Store()
    ergebnis = _dienst(db).reconcile_properties_for_tenant(TENANT)

    assert ergebnis["created"] == 1
    assert [p["title"] for p in _objekte(db)] == ["Mosekroen"]
    assert [m["channex_property_id"] for m in _maps(db)] == [CHANNEX_PROPERTY]
    assert _maps(db)[0]["property_id"] == _objekte(db)[0]["id"]
    assert len(db.tabellen["property_units"]) == 1
    # Objekt UND Verknüpfung kamen aus EINEM Aufruf — nicht aus drei.
    assert [a["name"] for a in db.rpc_aufrufe] == ["channex_objekt_spiegeln"]


def test_zehn_laeufe_legen_kein_zweites_objekt_an() -> None:
    """`max_attempts` ist 10 — und zehn Läufe müssen bei EINEM Objekt bleiben."""
    db = _Store()
    dienst = _dienst(db)
    for _ in range(10):
        dienst.reconcile_properties_for_tenant(TENANT)
    assert len(_objekte(db)) == 1
    assert len(_maps(db)) == 1


def test_wirft_die_datenbankfunktion_entsteht_nichts() -> None:
    """Fail-closed: kein halbes Objekt, keine Waise, der Fehler wird gemeldet."""
    db = _Store()
    db.fehler_bei("rpc", "channex_objekt_spiegeln", _fehler("XX000", "boom"))
    try:
        _dienst(db).reconcile_properties_for_tenant(TENANT)
    except APIError:
        pass
    else:
        raise AssertionError("der Fehler muss durchgereicht werden")
    assert _objekte(db) == []
    assert db.tabellen.get("property_units", []) == []

    db.fehler.clear()
    _dienst(db).reconcile_properties_for_tenant(TENANT)
    assert len(_objekte(db)) == 1


# -- Reaktivierung ------------------------------------------------------------


def _mit_soft_verknuepfung(db: _Store, *, archiviert: bool = False) -> str:
    db.tabellen["properties"] = [
        {"id": "p-alt", "tenant_id": TENANT, "title": "Lokaler Name", "status": "draft",
         "archived_at": "2026-09-01" if archiviert else None}
    ]
    db.tabellen["channex_property_map"] = [
        {"id": "map-alt", "tenant_id": TENANT, "property_id": "p-alt",
         "channex_property_id": CHANNEX_PROPERTY, "deleted_at": "2026-09-10", "sync_enabled": False}
    ]
    return "p-alt"


def test_reaktivierung_behaelt_den_lokalen_titel() -> None:
    """title/description führt der NUTZER (der „Unbenannt"-Bug) — auch hier."""
    db = _Store()
    _mit_soft_verknuepfung(db)
    _dienst(db).reconcile_properties_for_tenant(TENANT)

    assert len(_objekte(db)) == 1
    assert _objekte(db)[0]["title"] == "Lokaler Name"
    assert _objekte(db)[0]["city"] == "Rødding"
    assert len(_maps(db)) == 1 and _maps(db)[0]["id"] == "map-alt"


def test_archiviertes_objekt_wird_nicht_reaktiviert() -> None:
    db = _Store()
    _mit_soft_verknuepfung(db, archiviert=True)
    ergebnis = _dienst(db).reconcile_properties_for_tenant(TENANT)
    assert ergebnis["created"] == 0
    assert _maps(db) == []


def test_altobjekt_mit_anderer_aktiver_verknuepfung_kippt_den_lauf_nicht() -> None:
    """Vorher: UPDATE auf der Soft-Zeile → 23505 → der gesamte Abgleich starb,
    bei jedem Retry erneut. Jetzt entscheidet die Funktion vorher."""
    db = _Store()
    _mit_soft_verknuepfung(db)
    db.tabellen["channex_property_map"].append(
        {"id": "map-anders", "tenant_id": TENANT, "property_id": "p-alt",
         "channex_property_id": "cx-anders", "deleted_at": None, "sync_enabled": True}
    )
    dienst = _dienst(db)
    # cx-anders lebt bei Channex weiter — sonst schlösse der Abgleich diese
    # Verknüpfung zu Recht als verwaist.
    dienst._live.append({"id": "cx-anders", "attributes": {"title": "Anders"}})  # noqa: SLF001
    ergebnis = dienst.reconcile_properties_for_tenant(TENANT)
    assert ergebnis["skipped"] == 1 and ergebnis["updated"] == 1
    assert len(_objekte(db)) == 1
    assert [m["channex_property_id"] for m in _maps(db)] == ["cx-anders"]


def test_reaktivierung_prueft_die_mandantengrenze() -> None:
    """Der Reviewer-Fund B2: der Reuse-Pfad umging beide Bedingungen des Riegels.
    Property wurde an einen anderen Betrieb übergeben, hängt aber (auch) noch
    in unserer Gruppe. Eine soft-geschlossene Verknüpfung beweist nur, dass sie
    FRÜHER hierher gehörte."""
    db = _Store()
    _mit_soft_verknuepfung(db)
    db.tabellen["channex_property_map"].append(
        {"id": "map-fremd", "tenant_id": FREMDER_BETRIEB, "property_id": "p-fremd",
         "channex_property_id": CHANNEX_PROPERTY, "deleted_at": None, "sync_enabled": True}
    )
    dienst = _dienst(db, gruppen={CHANNEX_PROPERTY: [GRUPPE, FREMDE_GRUPPE]})
    ergebnis = dienst.reconcile_properties_for_tenant(TENANT)

    assert ergebnis["created"] == 0
    assert _maps(db) == []  # nicht reaktiviert
    assert _objekte(db)[0]["title"] == "Lokaler Name"  # nicht überschrieben
    assert db.rpc_aufrufe == []  # der Riegel griff VOR der Funktion


# -- Die Mandantengrenze beim Anlegen ------------------------------------------


def test_bereits_fremd_verknuepfte_property_wird_nicht_gespiegelt() -> None:
    db = _Store()
    dienst = _dienst(db)
    db.tabellen["channex_property_map"] = [
        {"id": "fremd-1", "tenant_id": FREMDER_BETRIEB, "property_id": "fremdes-objekt",
         "channex_property_id": CHANNEX_PROPERTY, "deleted_at": None}
    ]
    ergebnis = dienst.reconcile_properties_for_tenant(TENANT)
    assert ergebnis["created"] == 0 and ergebnis["skipped"] == 1
    assert _objekte(db) == []
    assert len(db.tabellen["channex_property_map"]) == 1


def test_property_in_zwei_betriebsgruppen_wird_nicht_gespiegelt() -> None:
    """Der reale Fall vom 18.09.: dasselbe Haus in zwei Betriebs-Gruppen."""
    db = _Store()
    dienst = _dienst(db, gruppen={CHANNEX_PROPERTY: [GRUPPE, FREMDE_GRUPPE]})
    ergebnis = dienst.reconcile_properties_for_tenant(TENANT)
    assert ergebnis["created"] == 0 and ergebnis["skipped"] == 1
    assert _objekte(db) == []


def test_property_in_unbekannter_gruppe_wird_nicht_gespiegelt() -> None:
    """Reviewer-Fund B4: eine Gruppe, die unsere Karte nicht kennt (bei Channex
    von Hand angelegt), wurde HERAUSGEFILTERT statt als fremd gewertet — der
    Riegel war an dieser Stelle fail-open."""
    db = _Store()
    dienst = _dienst(db, gruppen={CHANNEX_PROPERTY: [GRUPPE, UNBEKANNTE_GRUPPE]})
    ergebnis = dienst.reconcile_properties_for_tenant(TENANT)
    assert ergebnis["created"] == 0 and ergebnis["skipped"] == 1
    assert _objekte(db) == []


def test_ohne_auskunft_von_channex_entsteht_kein_objekt() -> None:
    db = _Store()
    dienst = _dienst(db)

    def _wirft(_channex_id: str) -> dict[str, Any]:
        raise ChannexError("Channex nicht erreichbar", status_code=502)

    dienst._channex.get_property = _wirft  # noqa: SLF001 — Attrappe
    ergebnis = dienst.reconcile_properties_for_tenant(TENANT)
    assert ergebnis["created"] == 0
    assert _objekte(db) == []


# -- Die Mandantengrenze im BESTAND (Update-Pfad) ------------------------------


def test_bestehende_verknuepfung_mit_besitzkonflikt_wird_weder_gespiegelt_noch_gepusht() -> None:
    """Reviewer-Fund B1: der Update-Pfad vertraute jeder eigenen Map-Zeile.
    Hält ein zweiter Betrieb dieselbe Property aktiv, spiegelte er weiter
    Inhalte hinein und pushte Preise auf die Portale des Fremden."""
    db = _Store()
    dienst = _dienst(db)
    db.tabellen["properties"] = [
        {"id": "p-1", "tenant_id": TENANT, "title": "Mein Haus",
         "city": "Skagen", "status": "active"},
    ]
    db.tabellen["channex_property_map"] = [
        {"id": "map-1", "tenant_id": TENANT, "property_id": "p-1",
         "channex_property_id": CHANNEX_PROPERTY, "deleted_at": None, "last_sync_status": "ok"},
        {"id": "map-fremd", "tenant_id": FREMDER_BETRIEB, "property_id": "p-fremd",
         "channex_property_id": CHANNEX_PROPERTY, "deleted_at": None},
    ]

    ergebnis = dienst.reconcile_properties_for_tenant(TENANT)

    assert ergebnis["updated"] == 0 and ergebnis["skipped"] == 1
    assert _objekte(db)[0]["city"] == "Skagen"  # nichts hineingespiegelt
    assert dienst.preis_pushes == []  # keine ARI-Pushes auf fremde Portale
    assert dienst.chat_ids == []
    # Der Konflikt steht sichtbar an der Zeile — aufgelöst wird er nicht.
    eigene = next(m for m in db.tabellen["channex_property_map"] if m["id"] == "map-1")
    assert eigene["last_sync_status"] == "error"
    assert "Besitzkonflikt" in eigene["last_sync_error"]
    assert eigene["deleted_at"] is None


def test_bestehende_verknuepfung_ohne_konflikt_wird_normal_gepflegt() -> None:
    """Die Gegenprobe: ohne zweiten Besitzer läuft der Bestand wie immer."""
    db = _Store()
    dienst = _dienst(db)
    db.tabellen["properties"] = [
        {"id": "p-1", "tenant_id": TENANT, "title": "Mein Haus",
         "city": "Skagen", "status": "active"},
    ]
    db.tabellen["channex_property_map"] = [
        {"id": "map-1", "tenant_id": TENANT, "property_id": "p-1",
         "channex_property_id": CHANNEX_PROPERTY, "deleted_at": None, "last_sync_status": "ok"},
    ]
    ergebnis = dienst.reconcile_properties_for_tenant(TENANT)
    assert ergebnis["updated"] == 1
    assert _objekte(db)[0]["city"] == "Rødding"
    assert _objekte(db)[0]["title"] == "Mein Haus"
    assert dienst.preis_pushes == ["p-1"]


# -- Die Attrappe selbst ----------------------------------------------------


def test_der_store_faengt_ein_on_conflict_ohne_index() -> None:
    db = _Store()
    try:
        db.table("channex_property_map").upsert(
            {"property_id": "p-1"}, on_conflict="channex_property_id"
        )
    except APIError as exc:
        assert "42P10" in str(exc)
    else:
        raise AssertionError("ein on_conflict ohne Unique-Index muss 42P10 werfen")


def test_der_store_prueft_den_unique_index_auch_beim_update() -> None:
    """Genau die Lücke, an der der Reviewer die alte Attrappe erwischte."""
    db = _Store()
    db.tabellen["channex_property_map"] = [
        {"id": "a", "tenant_id": TENANT, "property_id": "p-1",
         "channex_property_id": "cx-a", "deleted_at": None},
        {"id": "b", "tenant_id": TENANT, "property_id": "p-1",
         "channex_property_id": "cx-b", "deleted_at": "2026-09-01"},
    ]
    try:
        db.table("channex_property_map").update({"deleted_at": None}).eq("id", "b").execute()
    except APIError as exc:
        assert "23505" in str(exc)
    else:
        raise AssertionError("zwei aktive Map-Zeilen je Objekt muss der Store verbieten")
