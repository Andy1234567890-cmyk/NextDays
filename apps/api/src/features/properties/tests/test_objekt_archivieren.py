"""Objekt archivieren statt löschen (0416).

DER FALL: Ein Beta-Betrieb hat ein Ferienhaus gekündigt und wollte es
loswerden. `delete()` scheitert an `reservations_property_id_fkey` (RESTRICT) —
das Objekt trägt 10 abgeschlossene Aufenthalte. Bisher lief der Nutzer in den
rohen PostgREST-Fehler, ohne zu erfahren, dass es einen Weg gibt.

WARUM DAS EIGENE TESTS BRAUCHT: Beim Archivieren müssen ZWEI Dinge passieren,
und die zweite ist die, die man vergisst. Ein reines `archived_at` blendet das
Objekt nur in unserer Liste aus — Booking und Airbnb verkaufen weiter, weil ein
Tag ohne `availability`-Zeile überall als offen gilt (siehe vertragsende.py).
Erst das mitgesetzte Vertragsende schreibt echte Sperrnächte und meldet sie an
die Portale. Ein Test, der nur `archived_at` prüft, hätte diese Hälfte nicht
gesehen.
"""
from __future__ import annotations

from datetime import date
from typing import Any

import pytest

from src.core.security import AuthContext
from src.features.properties.errors import PropertyError
from src.features.properties.service import PropertiesService

_TENANT = "t-1"
_PROPERTY = "p-1"


def _ctx() -> AuthContext:
    return AuthContext(user_id="u-1", tenant_id=_TENANT, role="admin")


def _zeile(**over: Any) -> dict[str, Any]:
    basis: dict[str, Any] = {
        "id": _PROPERTY,
        "tenant_id": _TENANT,
        "title": "Fewo-Mosbjerg-Sindal",
        "description": None,
        "property_type": "ferienhaus",
        "status": "draft",
        "max_guests": 4,
        "amenities": [],
        "photos": [],
        "type_attributes": {},
        "archived_at": None,
        "contract_end_date": None,
        "created_at": "2026-06-17T00:00:00Z",
        "updated_at": "2026-06-17T00:00:00Z",
    }
    basis.update(over)
    return basis


class _Kette:
    """PostgREST-Stub: merkt Updates je Tabelle, liefert feste Zeilen."""

    def __init__(self, tabelle: str, store: dict[str, Any]) -> None:
        self._tabelle = tabelle
        self._store = store
        # Nur `neq` filtert wirklich: `channex_abraeumen` fragt seit dem
        # 18.09.2026 „haengt noch eine ANDERE Verknuepfung an dieser
        # Channex-Property?" — mit einem Stub, der die eigene Zeile
        # zurueckgibt, saehe jede Property geteilt aus.
        self._ausschluss: list[tuple[str, Any]] = []

    def select(self, *_a: Any, **_k: Any) -> _Kette:
        return self

    def update(self, payload: dict[str, Any]) -> _Kette:
        self._store["updates"].append((self._tabelle, payload))
        return self

    def delete(self) -> _Kette:
        self._store["deletes"].append(self._tabelle)
        return self

    def eq(self, *_a: Any, **_k: Any) -> _Kette:
        return self

    def neq(self, spalte: str, wert: Any) -> _Kette:
        self._ausschluss.append((spalte, wert))
        return self

    def is_(self, *_a: Any, **_k: Any) -> _Kette:
        return self

    @property
    def not_(self) -> _Kette:
        return self

    def in_(self, *_a: Any, **_k: Any) -> _Kette:
        return self

    def limit(self, *_a: Any, **_k: Any) -> _Kette:
        return self

    def order(self, *_a: Any, **_k: Any) -> _Kette:
        return self

    def execute(self) -> Any:
        zeilen = [
            z for z in self._store["rows"].get(self._tabelle, [])
            if all(z.get(s) != w for s, w in self._ausschluss)
        ]
        return type("R", (), {"data": zeilen, "count": len(zeilen)})()


class _Db:
    def __init__(self, rows: dict[str, list[dict[str, Any]]]) -> None:
        self.store: dict[str, Any] = {
            "rows": rows,
            "updates": [],
            "deletes": [],
        }

    def table(self, name: str) -> _Kette:
        return _Kette(name, self.store)


def _service(db: _Db, monkeypatch: pytest.MonkeyPatch) -> PropertiesService:
    svc = PropertiesService(service_client=db)
    # Abo-Menge und Kanal-Chips haben eigene Tests; hier interessiert der
    # Archiv-Pfad.
    monkeypatch.setattr(
        PropertiesService, "_sync_subscription_quantity",
        lambda *_a, **_k: None, raising=False,
    )
    monkeypatch.setattr(
        PropertiesService, "_portals_state_by_property",
        lambda *_a, **_k: {}, raising=False,
    )
    return svc


def _property_update(store: dict[str, Any]) -> dict[str, Any]:
    return next(p for t, p in store["updates"] if t == "properties")


def test_archivieren_setzt_marke_und_vertragsende(monkeypatch) -> None:
    """Beide Hälften: die Marke UND der Verkaufsstopp.

    Das Vertragsende ist der Teil, der leicht fehlt — und ohne den ein
    archiviertes Objekt bei Booking/Airbnb weiter verkauft würde.
    """
    db = _Db({"properties": [_zeile()]})
    durchgesetzt: list[Any] = []
    monkeypatch.setattr(
        "src.features.properties.archiv.vertragsende_durchsetzen",
        lambda _db, tenant, pid, ende, **kw: durchgesetzt.append((tenant, pid, ende))
        or 730,
    )
    svc = _service(db, monkeypatch)

    svc.archivieren(_ctx(), _PROPERTY, archivieren=True)

    payload = _property_update(db.store)
    assert payload["archived_at"] is not None
    # Vertragsende auf HEUTE — ab heute wird nichts mehr verkauft.
    assert payload["contract_end_date"] == date.today().isoformat()
    # Und es wurde auch DURCHGESETZT, nicht nur in die Spalte geschrieben.
    assert durchgesetzt == [(_TENANT, _PROPERTY, date.today())]


def test_aufheben_gibt_die_naechte_wieder_frei(monkeypatch) -> None:
    """Der Gegenzustand (Wurzel 1): zurück in den Bestand heisst verkäuflich.

    Ohne das Zurücknehmen des Vertragsendes bliebe ein reaktiviertes Objekt
    unverkäuflich — 730 gesperrte Nächte, und niemand sähe den Grund.
    """
    db = _Db({"properties": [_zeile(archived_at="2026-08-21T10:00:00Z",
                                    contract_end_date="2026-08-21")]})
    durchgesetzt: list[Any] = []
    monkeypatch.setattr(
        "src.features.properties.archiv.vertragsende_durchsetzen",
        lambda _db, tenant, pid, ende, **kw: durchgesetzt.append(ende) or 0,
    )
    svc = _service(db, monkeypatch)

    svc.archivieren(_ctx(), _PROPERTY, archivieren=False)

    payload = _property_update(db.store)
    assert payload["archived_at"] is None
    assert payload["contract_end_date"] is None
    # `None` heisst für `vertragsende_durchsetzen`: alle Vertragssperren lösen.
    assert durchgesetzt == [None]


def test_aufheben_behaelt_ein_kuenftiges_vertragsende(monkeypatch) -> None:
    """Ein von Hand gepflegtes Enddatum in der Zukunft ist KEINE Archiv-Sperre.

    Es würde sonst beim Reaktivieren stillschweigend verschwinden — und das
    Objekt wäre über sein vertragliches Ende hinaus verkäuflich (Wurzel 1: den
    fremden Zustand nicht mit dem eigenen Gegenzustand überschreiben).
    """
    kuenftig = date(date.today().year + 1, 6, 1).isoformat()
    db = _Db({"properties": [_zeile(archived_at="2026-08-21T10:00:00Z",
                                    contract_end_date=kuenftig)]})
    durchgesetzt: list[Any] = []
    monkeypatch.setattr(
        "src.features.properties.archiv.vertragsende_durchsetzen",
        lambda _db, tenant, pid, ende, **kw: durchgesetzt.append(ende) or 5,
    )
    svc = _service(db, monkeypatch)

    svc.archivieren(_ctx(), _PROPERTY, archivieren=False)

    payload = _property_update(db.store)
    assert payload["archived_at"] is None
    assert payload["contract_end_date"] == kuenftig
    assert durchgesetzt == [date.fromisoformat(kuenftig)]


def test_portal_fehler_kippt_die_archivierung_nicht(monkeypatch) -> None:
    """Best-effort (Wurzel 5): die Marke ist geschrieben, das Portal kann warten.

    Sonst stünde das Objekt nach einem Channex-Ausfall weiter in der Liste,
    obwohl der Betrieb es abgehakt hat — und ein zweiter Versuch wäre nötig,
    ohne dass jemand weiss warum.
    """
    db = _Db({"properties": [_zeile()]})

    def _kippt(*_a: Any, **_k: Any) -> int:
        raise RuntimeError("Channex nicht erreichbar")

    monkeypatch.setattr(
        "src.features.properties.archiv.vertragsende_durchsetzen", _kippt
    )
    svc = _service(db, monkeypatch)

    svc.archivieren(_ctx(), _PROPERTY, archivieren=True)

    assert _property_update(db.store)["archived_at"] is not None


def test_loeschen_mit_buchungen_nennt_das_archiv(monkeypatch) -> None:
    """Statt eines rohen Datenbankfehlers: 409 mit dem Weg.

    `reservations.property_id` steht auf RESTRICT. Ohne diese Prüfung antwortet
    die Route mit „violates foreign key constraint
    reservations_property_id_fkey" — ein technischer Text ohne Ausweg. Genau
    das hat ein Beta-Betrieb am 21.08.2026 gesehen.
    """
    db = _Db({
        "properties": [_zeile()],
        # Zehn Buchungen wie im echten Fall.
        "reservations": [{"id": f"r-{i}"} for i in range(10)],
    })
    svc = _service(db, monkeypatch)

    with pytest.raises(PropertyError) as exc:
        svc.delete(_ctx(), _PROPERTY)

    assert exc.value.status_code == 409
    # Die Zahl UND der Ausweg müssen drinstehen — ohne beides ist die Meldung
    # so unbrauchbar wie der Datenbankfehler.
    assert "10 Buchungen" in exc.value.message
    assert "rchivier" in exc.value.message
    # Und es wurde NICHTS gelöscht.
    assert db.store["deletes"] == []


def test_loeschen_ohne_buchungen_geht_weiter(monkeypatch) -> None:
    """Die Gegenprobe: ein Objekt ohne Buchungen bleibt löschbar.

    Die neue Prüfung darf den bestehenden Weg nicht zumauern — ein
    versehentlich angelegter Entwurf soll ohne Archiv-Umweg verschwinden.
    """
    db = _Db({"properties": [_zeile()], "reservations": []})
    svc = _service(db, monkeypatch)

    svc.delete(_ctx(), _PROPERTY)

    assert "properties" in db.store["deletes"]


# --- Channex MUSS mit abgeräumt werden -------------------------------------
#
# Der Punkt, an dem die erste Fassung versagte: „archiviert" hiess nur „bei uns
# ausgeblendet". Die Property blieb bei Channex stehen und wurde WEITER
# ABGERECHNET — ein gekuendigtes Objekt kostete monatlich Geld. Zusaetzlich
# verkaufte ein noch aktiver Kanal weiter, waehrend von uns keine Pushes mehr
# kamen (Blindverkauf).

class _ChannexStub:
    """Zaehlt die Aufrufe, damit die REIHENFOLGE pruefbar ist.

    Bildet den ECHTEN Airbnb-Fall nach (live gemessen 21.08.2026): EIN Kanal
    traegt alle Objekte des Kontos — hier zwei Zuordnungen, von denen nur EINE
    zur archivierten Property gehoert.
    """

    is_configured = True

    def __init__(
        self,
        kanaele: list[str] | None = None,
        *,
        eigene_rate_plans: list[str] | None = None,
        kanal_mappings: list[dict[str, Any]] | None = None,
    ) -> None:
        self.ablauf: list[str] = []
        self._kanaele = kanaele if kanaele is not None else ["ch-1"]
        self._eigene = (
            eigene_rate_plans if eigene_rate_plans is not None else ["rp-eigen"]
        )
        self._mappings = (
            kanal_mappings
            if kanal_mappings is not None
            else [
                {"id": "map-eigen", "rate_plan_id": "rp-eigen"},
                # Die Zuordnung eines FREMDEN Objekts am selben Kanal.
                {"id": "map-fremd", "rate_plan_id": "rp-fremd"},
            ]
        )

    def get(self, pfad: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        if pfad == "rate_plans":
            self.ablauf.append("rate_plans_der_property")
            return {"data": [{"id": r} for r in self._eigene]}
        raise AssertionError(f"unerwarteter GET: {pfad}")

    def list_channels(self, property_id: str) -> dict[str, Any]:
        self.ablauf.append(f"list_channels:{property_id}")
        return {"data": [{"id": k} for k in self._kanaele]}

    def get_channel(self, channel_id: str) -> dict[str, Any]:
        self.ablauf.append(f"get_channel:{channel_id}")
        return {"data": {"attributes": {"rate_plans": self._mappings}}}

    def delete_channel_mapping(self, channel_id: str, mapping_id: str) -> None:
        self.ablauf.append(f"mapping_delete:{mapping_id}")

    def deactivate_channel(self, channel_id: str) -> None:
        # Darf NIE gerufen werden: der Kanal gehoert allen Objekten des Kontos.
        self.ablauf.append(f"DEACTIVATE_KANAL:{channel_id}")

    def delete_hotel_policy(self, policy_id: str) -> None:
        self.ablauf.append(f"policy_delete:{policy_id}")

    def delete_property(self, channex_id: str, *, force: bool = False) -> None:
        self.ablauf.append(f"delete_property:{channex_id}:force={force}")


def _mit_channex(
    monkeypatch: pytest.MonkeyPatch, stub: object
) -> None:
    monkeypatch.setattr(
        "src.features.channel_manager.channex_client.ChannexClient",
        lambda *_a, **_k: stub,
    )


def _db_mit_mapping() -> _Db:
    return _Db({
        "properties": [_zeile()],
        "channex_property_map": [{
            "id": "map-1",
            "channex_property_id": "chx-99",
            "channex_hotel_policy_id": "pol-7",
        }],
        "reservations": [],
    })


def test_archivieren_raeumt_channex_ab(monkeypatch) -> None:
    """Kanäle ab, Policy weg, Property GELÖSCHT, Mapping geschlossen.

    Die Reihenfolge ist zwingend und wird hier mitgeprueft: Channex lehnt
    `DELETE properties/{id}` mit 422 ab, solange ein Kanal haengt. Ein Test, der
    nur „delete_property wurde gerufen" prueft, wuerde einen Lauf durchlassen,
    der in Produktion am 422 scheitert.
    """
    db = _db_mit_mapping()
    stub = _ChannexStub()
    _mit_channex(monkeypatch, stub)
    monkeypatch.setattr(
        "src.features.properties.archiv.vertragsende_durchsetzen",
        lambda *_a, **_k: 730,
    )
    svc = _service(db, monkeypatch)

    svc.archivieren(_ctx(), _PROPERTY, archivieren=True)

    assert stub.ablauf == [
        "rate_plans_der_property",
        "list_channels:chx-99",
        "get_channel:ch-1",
        # NUR die eigene Zuordnung — „map-fremd" bleibt stehen.
        "mapping_delete:map-eigen",
        "policy_delete:pol-7",
        "delete_property:chx-99:force=True",
    ]
    # Der KANAL selbst wird nie abgeschaltet: er traegt alle Objekte des Kontos.
    assert not any("DEACTIVATE_KANAL" in a for a in stub.ablauf)
    # Mapping lokal geschlossen — sonst fasst der naechste Sync es wieder an.
    schluss = next(p for t, p in db.store["updates"] if t == "channex_property_map")
    assert schluss["deleted_at"] is not None
    assert schluss["sync_enabled"] is False
    # Die Policy-ID MUSS mit weg: bliebe sie stehen, riefe ein spaeterer
    # Reconnect `update_hotel_policy` auf eine tote ID → 404, roter Sync.
    assert schluss["channex_hotel_policy_id"] is None


def test_loeschen_raeumt_channex_ab(monkeypatch) -> None:
    """Dasselbe beim Löschen — dort fehlte es genauso.

    Vorher stand im `delete()` nur der lokale Soft-Delete des Mappings; die
    Property blieb bei Channex und wurde weiter abgerechnet.
    """
    db = _db_mit_mapping()
    stub = _ChannexStub()
    _mit_channex(monkeypatch, stub)
    svc = _service(db, monkeypatch)

    svc.delete(_ctx(), _PROPERTY)

    assert "delete_property:chx-99:force=True" in stub.ablauf
    assert "properties" in db.store["deletes"]


def test_kanal_abbau_scheitert_property_bleibt_stehen(monkeypatch) -> None:
    """Scheitert der Kanal-Abbau, wird die Property NICHT gelöscht.

    Sonst waere sie bei Channex verwaist, WÄHREND der Kanal weiter verkauft —
    genau der Blindverkauf, den der Abbau verhindern soll (fail-closed,
    Wurzel 5). Die Archivierung selbst bleibt trotzdem geschrieben: sie ist
    lokal gueltig, und der Fehler steht im Log.
    """
    from src.features.channel_manager.channex_client import ChannexError

    class _Kippt(_ChannexStub):
        def delete_channel_mapping(
            self, channel_id: str, mapping_id: str
        ) -> None:
            raise ChannexError("Channex nicht erreichbar", status_code=502)

    db = _db_mit_mapping()
    stub = _Kippt()
    _mit_channex(monkeypatch, stub)
    monkeypatch.setattr(
        "src.features.properties.archiv.vertragsende_durchsetzen",
        lambda *_a, **_k: 730,
    )
    svc = _service(db, monkeypatch)

    svc.archivieren(_ctx(), _PROPERTY, archivieren=True)

    assert not any("delete_property" in a for a in stub.ablauf)
    # Und die Archivierung steht.
    assert _property_update(db.store)["archived_at"] is not None


def test_zurueckholen_verbindet_nicht_automatisch(monkeypatch) -> None:
    """Beim Zurückholen wird NICHT automatisch bei Channex neu angelegt.

    Das Anlegen braucht Mapping-Entscheidungen (Zimmertyp, Rate-Plan, Kanal),
    die niemand raten darf (Wurzel 4). Der Betrieb verbindet bewusst neu.
    """
    db = _Db({"properties": [_zeile(archived_at="2026-08-21T10:00:00Z")]})
    stub = _ChannexStub()
    _mit_channex(monkeypatch, stub)
    monkeypatch.setattr(
        "src.features.properties.archiv.vertragsende_durchsetzen",
        lambda *_a, **_k: 0,
    )
    svc = _service(db, monkeypatch)

    svc.archivieren(_ctx(), _PROPERTY, archivieren=False)

    assert stub.ablauf == []


def test_fremde_zuordnungen_bleiben_unberuehrt(monkeypatch) -> None:
    """Der Kanal gehört ALLEN Objekten des Kontos — nur die eigene Zuordnung weg.

    DER FEHLER, DEN DIESER TEST VERHINDERT: Die erste Fassung rief
    `deactivate_channel`. Bei Airbnb traegt EIN Kanal alle Objekte eines Kontos
    (live gemessen 21.08.2026: ein Kanal, 18 Properties, 17 Zuordnungen). Ein
    einzelnes Objekt zu archivieren haette damit die 17 anderen von Airbnb
    genommen — ein Totalausfall des Vertriebs aus einem Aufraeum-Klick.

    Channex hat es abgelehnt (422 „remove mappings before"); der Fehler war der
    Schutz. Dieser Test ist der Ersatz dafuer im eigenen Code.
    """
    db = _db_mit_mapping()
    stub = _ChannexStub(
        eigene_rate_plans=["rp-eigen"],
        kanal_mappings=[
            {"id": "map-eigen", "rate_plan_id": "rp-eigen"},
            {"id": "map-fremd-1", "rate_plan_id": "rp-fremd-1"},
            {"id": "map-fremd-2", "rate_plan_id": "rp-fremd-2"},
        ],
    )
    _mit_channex(monkeypatch, stub)
    monkeypatch.setattr(
        "src.features.properties.archiv.vertragsende_durchsetzen",
        lambda *_a, **_k: 730,
    )
    svc = _service(db, monkeypatch)

    svc.archivieren(_ctx(), _PROPERTY, archivieren=True)

    geloest = [a for a in stub.ablauf if a.startswith("mapping_delete:")]
    assert geloest == ["mapping_delete:map-eigen"]
    # Kein Kanal abgeschaltet, keine fremde Zuordnung angefasst.
    assert not any("DEACTIVATE_KANAL" in a for a in stub.ablauf)
    assert "mapping_delete:map-fremd-1" not in stub.ablauf
    assert "mapping_delete:map-fremd-2" not in stub.ablauf


def test_objekt_ohne_zuordnung_wird_trotzdem_geloescht(monkeypatch) -> None:
    """Genau der Live-Fall: Property am Kanal, aber OHNE eigene Zuordnung.

    So stand `Fewo-Mosbjerg-Sindal` am 21.08.2026 da — deshalb zeigte die
    Oberfläche „Nicht verbunden": es verkaufte nirgends. Es kostete nur, weil
    die Property bei Channex existierte. Dann ist nichts zu lösen, und das
    Löschen muss trotzdem laufen.
    """
    db = _db_mit_mapping()
    stub = _ChannexStub(
        eigene_rate_plans=["rp-eigen"],
        # 17 fremde Zuordnungen, keine eigene.
        kanal_mappings=[
            {"id": f"map-fremd-{i}", "rate_plan_id": f"rp-fremd-{i}"}
            for i in range(17)
        ],
    )
    _mit_channex(monkeypatch, stub)
    monkeypatch.setattr(
        "src.features.properties.archiv.vertragsende_durchsetzen",
        lambda *_a, **_k: 730,
    )
    svc = _service(db, monkeypatch)

    svc.archivieren(_ctx(), _PROPERTY, archivieren=True)

    assert not any(a.startswith("mapping_delete:") for a in stub.ablauf)
    assert "delete_property:chx-99:force=True" in stub.ablauf


def test_geteilte_channex_property_wird_nicht_geloescht(monkeypatch) -> None:
    """Haengt noch eine ANDERE Verknuepfung an der Channex-Property, bleibt
    sie bestehen — nur die eigene Verknuepfung wird geschlossen.

    Bis zum 18.09.2026 loeschte Schritt 4 blind mit `force`. Zwei Faelle, in
    denen das das FALSCHE Objekt bei Channex ausradiert haette: ein
    archivierter Zimmertyp eines Hotels (0158: n Zimmertypen teilen EINE
    Channex-Property) und eine archivierte Dublette, deren Original weiter
    verkauft. Ein Reviewer hat den Weg am Code belegt, bevor er live passierte.
    """
    db = _db_mit_mapping()
    db.store["rows"]["channex_property_map"].append({
        "id": "map-anderes-objekt",
        "channex_property_id": "chx-99",
        "channex_hotel_policy_id": None,
        "deleted_at": None,
    })
    stub = _ChannexStub()
    _mit_channex(monkeypatch, stub)
    monkeypatch.setattr(
        "src.features.properties.archiv.vertragsende_durchsetzen",
        lambda *_a, **_k: 730,
    )
    svc = _service(db, monkeypatch)

    svc.archivieren(_ctx(), _PROPERTY, archivieren=True)

    # Die eigene Kanal-Zuordnung geht weg, die Property NICHT.
    assert "mapping_delete:map-eigen" in stub.ablauf
    assert not any(a.startswith("delete_property:") for a in stub.ablauf)
    # Die eigene Verknuepfung ist trotzdem geschlossen (Wurzel 1).
    schluss = next(p for t, p in db.store["updates"] if t == "channex_property_map")
    assert schluss["deleted_at"] is not None
    assert schluss["sync_enabled"] is False
