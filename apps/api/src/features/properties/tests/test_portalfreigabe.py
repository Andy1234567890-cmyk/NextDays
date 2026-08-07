"""Ein Entwurf geht nicht an die Buchungsportale.

Der Anlass (live, 07.08.2026): „FeWo Stjerneskud" wurde bei uns um 03:56 als
Entwurf angelegt — um 04:09 stand die Channex-Property samt Zimmertyp und Rate,
um 04:10 hing sie am Airbnb-Kanal. Channex zählte 20 Objekte, der Betrieb kannte
18 verbundene. Zusätzlich lief der Content-Sync für dieses Objekt dauerhaft auf
Fehler, weil ein Entwurf keinen Preisplan hat, und der Heil-Tick reihte ihn
stündlich neu ein.
"""

from __future__ import annotations

from typing import Any

from src.features.properties.portalfreigabe import darf_zu_den_portalen


class _Antwort:
    def __init__(self, data: Any) -> None:
        self.data = data


class _Abfrage:
    """Minimaler PostgREST-Nachbau: merkt sich den Scope, liefert `zeilen`."""

    def __init__(self, zeilen: Any, protokoll: dict) -> None:
        self._zeilen = zeilen
        self._protokoll = protokoll

    def select(self, spalten: str) -> _Abfrage:
        self._protokoll.setdefault("select", []).append(spalten)
        return self

    def eq(self, feld: str, wert: Any) -> _Abfrage:
        self._protokoll.setdefault("eq", []).append((feld, wert))
        return self

    def is_(self, feld: str, wert: Any) -> _Abfrage:
        self._protokoll.setdefault("is", []).append((feld, wert))
        return self

    def limit(self, n: int) -> _Abfrage:
        self._protokoll["limit"] = n
        return self

    def execute(self) -> _Antwort:
        return _Antwort(self._zeilen)


class _DB:
    """Liefert je Tabelle eigene Zeilen — die Prüfung fragt zwei ab."""

    def __init__(self, je_tabelle: dict[str, Any]) -> None:
        self._je_tabelle = je_tabelle
        self.protokoll: dict = {}

    def table(self, name: str) -> _Abfrage:
        self.protokoll.setdefault("tables", []).append(name)
        return _Abfrage(self._je_tabelle.get(name, []), self.protokoll)


def test_entwurf_geht_nicht_raus():
    db = _DB({"properties": [{"status": "draft"}], "channex_property_map": []})
    assert darf_zu_den_portalen(db, "t1", "p1") is False


def test_aktives_objekt_geht_raus():
    db = _DB({"properties": [{"status": "active"}]})
    assert darf_zu_den_portalen(db, "t1", "p1") is True
    # Ein aktives Objekt braucht die zweite Abfrage nicht.
    assert db.protokoll["tables"] == ["properties"]


def test_inaktives_objekt_geht_weiter_raus():
    """`inactive` heißt „vorübergehend aus dem Verkauf", nicht „nie dagewesen":
    das Objekt steht bei den Portalen und muss gepflegte Inhalte bekommen."""
    db = _DB({"properties": [{"status": "inactive"}]})
    assert darf_zu_den_portalen(db, "t1", "p1") is True


def test_registrierter_entwurf_geht_raus():
    """Ein aus Airbnb übernommenes Objekt bleibt formal `draft`, ist aber bei
    Channex registriert — sein Content muss weiter fließen."""
    db = _DB(
        {
            "properties": [{"status": "draft"}],
            "channex_property_map": [{"channex_property_id": "cx-1"}],
        }
    )
    assert darf_zu_den_portalen(db, "t1", "p1") is True


def test_unbekanntes_objekt_faellt_zu():
    """Fail-closed (Wurzel 5): lieber nichts übertragen als das Falsche."""
    assert darf_zu_den_portalen(_DB({"properties": []}), "t1", "p1") is False


def test_scope_wird_erzwungen():
    """Beide Abfragen sind auf den Betrieb gescoped (Wurzel 3) — der
    Service-Key umgeht RLS, der Scope muss im Code stehen."""
    db = _DB({"properties": [{"status": "draft"}], "channex_property_map": []})
    darf_zu_den_portalen(db, "t1", "p1")
    assert db.protokoll["eq"].count(("tenant_id", "t1")) == 2
    assert db.protokoll["eq"].count(("id", "p1")) == 1
    assert ("property_id", "p1") in db.protokoll["eq"]
    # Eine gelöschte Registrierung zählt nicht als Registrierung.
    assert ("deleted_at", "null") in db.protokoll["is"]


# --- Der Riegel an den echten Wegen ---------------------------------------
#
# Die Tests oben prüfen die Bedingung, diese den Einbau: dass die beiden
# Wrapper sie tatsächlich vorschalten. Ohne sie bliebe der Riegel bestehen und
# wäre trotzdem umgangen, sobald jemand `try_enqueue_content_sync` direkt ruft.


class _Kette:
    """Gibt sich auf jede Builder-Methode selbst zurück."""

    def __init__(self, zeilen: Any) -> None:
        self._zeilen = zeilen

    def __getattr__(self, _name: str) -> Any:
        return lambda *_a, **_k: self

    def execute(self) -> _Antwort:
        return _Antwort(self._zeilen)


class _TabellenDB:
    def __init__(self, je_tabelle: dict[str, Any]) -> None:
        self._je_tabelle = je_tabelle

    def table(self, name: str) -> _Kette:
        return _Kette(self._je_tabelle.get(name, []))


def _eingereiht(monkeypatch, modul) -> list:
    """Fängt ab, was der Slice an den Worker geben würde."""
    gesammelt: list = []
    monkeypatch.setattr(
        modul, "try_enqueue_content_sync",
        lambda *a, **k: gesammelt.append((a, k)),
    )
    return gesammelt


def test_objekt_wrapper_haelt_entwurf_zurueck(monkeypatch):
    from src.features.properties import service as svc_mod

    gesammelt = _eingereiht(monkeypatch, svc_mod)
    db = _TabellenDB({"properties": [{"status": "draft"}]})
    svc = svc_mod.PropertiesService(service_client=db)
    svc._sync_to_channel_manager(  # noqa: SLF001 — genau dieser Wrapper ist der Riegel
        "t1", property_id="p1", title="Villa", currency=None
    )
    assert gesammelt == []


def test_objekt_wrapper_laesst_veroeffentlichtes_durch(monkeypatch):
    from src.features.properties import service as svc_mod

    gesammelt = _eingereiht(monkeypatch, svc_mod)
    db = _TabellenDB({"properties": [{"status": "active"}]})
    svc = svc_mod.PropertiesService(service_client=db)
    svc._sync_to_channel_manager(  # noqa: SLF001
        "t1", property_id="p1", title="Villa", currency=None
    )
    assert len(gesammelt) == 1


def test_preis_wrapper_haelt_entwurf_zurueck(monkeypatch):
    """Preise zu pflegen ist Vorbereitung, keine Freigabe — sonst genügte ein
    Preisplan, um einen Entwurf bei den Portalen anzumelden."""
    from src.features.rates import service as rates_mod

    gesammelt = _eingereiht(monkeypatch, rates_mod)
    db = _TabellenDB({"properties": [{"status": "draft"}]})
    svc = rates_mod.RatesService(service_client=db)
    svc._sync_property("t1", "p1", "Villa", "DKK")  # noqa: SLF001
    assert gesammelt == []


def test_preis_wrapper_laesst_veroeffentlichtes_durch(monkeypatch):
    from src.features.rates import service as rates_mod

    gesammelt = _eingereiht(monkeypatch, rates_mod)
    db = _TabellenDB({"properties": [{"status": "active"}]})
    svc = rates_mod.RatesService(service_client=db)
    svc._sync_property("t1", "p1", "Villa", "DKK")  # noqa: SLF001
    assert len(gesammelt) == 1
