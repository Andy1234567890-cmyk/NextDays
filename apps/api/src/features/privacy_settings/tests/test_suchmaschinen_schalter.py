"""„Objekte in Suchmaschinen aufnehmen" — die Entscheidung des Betriebs.

Der Schalter wurde bis zum 17.09.2026 aus dem Objektbestand ABGELEITET: „an",
wenn alle Objekte indexierbar sind. Das hatte kein Gedaechtnis. Weil
`properties.search_engine_indexing` per Default auf `false` steht und kein
Anlage-Pfad ihn setzte, kam JEDES neue Objekt auf noindex herein — und damit
sprang der Schalter eines Betriebs, der ihn eingeschaltet hatte, beim naechsten
angelegten Objekt von selbst auf „aus", waehrend die alten Objekte weiter in
Google standen. Anzeige und Wirklichkeit liefen auseinander.

Geprueft wird genau das, was diesen Fall unmoeglich macht: die Anzeige haengt
an der gespeicherten Entscheidung, nicht am Bestand, und das Speichern pflegt
BEIDE Seiten.
"""

import pytest

from src.core.security import AuthContext
from src.features.privacy_settings.schemas import PrivacySettingsUpdate
from src.features.privacy_settings.service import (
    PrivacySettingsError,
    PrivacySettingsService,
)

TENANT = "11111111-1111-1111-1111-111111111111"
USER = "22222222-2222-2222-2222-222222222222"


class _Abfrage:
    def __init__(self, db: "_DB", tabelle: str) -> None:
        self._db = db
        self._tabelle = tabelle
        self._update: dict | None = None
        self._filter: list[tuple[str, object]] = []

    def select(self, *_spalten: str, **_kw: object) -> "_Abfrage":
        return self

    def update(self, werte: dict) -> "_Abfrage":
        self._update = werte
        return self

    def upsert(self, werte: dict, **_kw: object) -> "_Abfrage":
        self._db.upserts.append((self._tabelle, werte))
        return self

    def eq(self, feld: str, wert: object) -> "_Abfrage":
        self._filter.append((feld, wert))
        return self

    def limit(self, _n: int) -> "_Abfrage":
        return self

    def execute(self) -> "_Ergebnis":
        if self._update is not None:
            self._db.updates.append((self._tabelle, self._filter, self._update))
            return _Ergebnis([])
        return _Ergebnis(self._db.zeilen.get(self._tabelle, []))


class _Ergebnis:
    def __init__(self, data: list[dict]) -> None:
        self.data = data


class _DB:
    def __init__(self, zeilen: dict[str, list[dict]] | None = None) -> None:
        self.zeilen = zeilen or {}
        self.updates: list[tuple[str, list, dict]] = []
        self.upserts: list[tuple[str, dict]] = []

    def table(self, name: str) -> _Abfrage:
        return _Abfrage(self, name)


def _ctx(rolle: str = "admin", tenant: str | None = TENANT) -> AuthContext:
    return AuthContext(user_id=USER, tenant_id=tenant, role=rolle)


def _db(entscheidung: bool) -> _DB:
    return _DB({"tenants": [{"search_engine_indexing": entscheidung}]})


@pytest.mark.parametrize("entscheidung", [True, False])
def test_anzeige_kommt_aus_der_entscheidung(entscheidung: bool) -> None:
    dienst = PrivacySettingsService(_db(entscheidung))  # type: ignore[arg-type]
    assert dienst.get(_ctx()).listings_search_engine_indexing is entscheidung


def test_anzeige_haengt_NICHT_am_objektbestand() -> None:
    """Der Kern des Umbaus.

    Ein Betrieb hat den Schalter an und legt ein neues Objekt an, das noch auf
    `false` steht. Frueher sprang der Schalter dadurch auf „aus". Jetzt zeigt er
    weiter das, was der Betrieb entschieden hat.
    """
    db = _db(True)
    db.zeilen["properties"] = [
        {"id": "p1", "search_engine_indexing": True},
        {"id": "p2", "search_engine_indexing": False},
    ]
    dienst = PrivacySettingsService(db)  # type: ignore[arg-type]
    assert dienst.get(_ctx()).listings_search_engine_indexing is True


def test_ohne_betrieb_keine_entscheidung() -> None:
    dienst = PrivacySettingsService(_DB())  # type: ignore[arg-type]
    assert (
        dienst.get(_ctx(tenant=None)).listings_search_engine_indexing is False
    )


@pytest.mark.parametrize("wert", [True, False])
def test_speichern_pflegt_BEIDE_seiten(wert: bool) -> None:
    """Entscheidung und Projektion — eines allein liesse Anzeige und
    Wirklichkeit auseinanderlaufen (Wurzel 1)."""
    db = _db(not wert)
    dienst = PrivacySettingsService(db)  # type: ignore[arg-type]
    dienst.update(
        _ctx(), PrivacySettingsUpdate(listings_search_engine_indexing=wert)
    )
    geschrieben = {tab: (flt, werte) for tab, flt, werte in db.updates}
    assert geschrieben["tenants"][1] == {"search_engine_indexing": wert}
    assert geschrieben["properties"][1] == {"search_engine_indexing": wert}
    # Scope auf den eigenen Betrieb (Wurzel 3), nie ungefiltert.
    assert ("id", TENANT) in geschrieben["tenants"][0]
    assert ("tenant_id", TENANT) in geschrieben["properties"][0]


def test_schalter_landet_nie_in_privacy_settings() -> None:
    """Zwei Speicherorte fuer denselben Wert waeren zwei Wahrheiten (Wurzel 4)."""
    db = _db(False)
    dienst = PrivacySettingsService(db)  # type: ignore[arg-type]
    dienst.update(
        _ctx(), PrivacySettingsUpdate(listings_search_engine_indexing=True)
    )
    assert db.upserts == []


def test_ohne_berechtigung_wird_nichts_geschrieben() -> None:
    """Wurzel 9: das Feld haengt am eingeloggten Nutzer, schreibt aber auf ALLE
    Objekte des Betriebs. Ein cleaner darf den Bestand nicht aus Google nehmen —
    und es darf auch kein halber Schreibvorgang uebrig bleiben."""
    db = _db(True)
    dienst = PrivacySettingsService(db)  # type: ignore[arg-type]
    with pytest.raises(PrivacySettingsError) as fehler:
        dienst.update(
            _ctx(rolle="cleaner"),
            PrivacySettingsUpdate(listings_search_engine_indexing=False),
        )
    assert fehler.value.status_code == 403
    assert db.updates == []
    assert db.upserts == []


def test_reine_kontopraeferenz_laeuft_weiter_in_privacy_settings() -> None:
    """Die Gegenprobe: der Umbau darf die uebrigen Schalter nicht mitnehmen."""
    db = _db(True)
    dienst = PrivacySettingsService(db)  # type: ignore[arg-type]
    dienst.update(_ctx(), PrivacySettingsUpdate(message_read_receipts=False))
    assert db.upserts and db.upserts[0][0] == "privacy_settings"
    assert db.upserts[0][1]["message_read_receipts"] is False
    assert db.updates == []
