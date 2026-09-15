"""Ordner des Werbematerials (0709): Reiter, Verschieben, Aufräumen.

Die Zusage, um die es hier geht: **ein gelöschter Ordner löscht kein Material.**
Ein Reiter ist Organisation, kein Besitz. Wer „Banner" wegklickt, darf nicht
die Banner verlieren — durchgesetzt wird das vom Fremdschlüssel
(`on delete set null`, 0709), geprüft wird es hier an der Schnittstelle, die
das Backoffice benutzt.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from src.core.security import AffiliateContext, PlatformContext
from src.features.affiliates.fehler import AffiliateError
from src.features.affiliates.schemas import (
    BackofficeMaterialVerschieben,
    BackofficeOrdnerAendern,
    BackofficeOrdnerAnlegen,
)
from src.features.affiliates.service import AffiliatesService

from .fakedb import FakeDb
from .test_material_dateien import AFF, PNG, _beschreibung, _Storage

ADMIN = PlatformContext(user_id="admin-1", platform_role="platform_admin")


def _db() -> FakeDb:
    db = FakeDb({"affiliates": [{"id": AFF, "status": "approved", "language": "de"}]})
    db.storage = _Storage()  # type: ignore[attr-defined]
    return db


def _svc(db: FakeDb) -> AffiliatesService:
    return AffiliatesService(db, db, mails=SimpleNamespace())


def _ordner(db: FakeDb, name: str, sort: int = 0) -> str:
    return _svc(db).bo_ordner_anlegen(BackofficeOrdnerAnlegen(name=name, sort=sort), ADMIN).id


# --- Reiter ------------------------------------------------------------------


def test_ordner_liste_zaehlt_die_belegung() -> None:
    db = _db()
    logos = _ordner(db, "Logos")
    _ordner(db, "Banner")
    _svc(db).bo_material_hochladen(PNG, "a.png", _beschreibung(folder_id=logos), ADMIN)
    _svc(db).bo_material_hochladen(PNG, "b.png", _beschreibung(folder_id=logos), ADMIN)
    _svc(db).bo_material_hochladen(PNG, "c.png", _beschreibung(), ADMIN)

    liste = _svc(db).bo_ordner_liste()
    assert [(o.name, o.anzahl) for o in liste] == [("Banner", 0), ("Logos", 2)]


def test_ordner_werden_nach_sortierung_dann_name_gereiht() -> None:
    db = _db()
    _ordner(db, "Zuletzt", sort=9)
    _ordner(db, "Bravo", sort=1)
    _ordner(db, "Alpha", sort=1)
    assert [o.name for o in _svc(db).bo_ordner_liste()] == ["Alpha", "Bravo", "Zuletzt"]


def test_zweiter_ordner_gleichen_namens_wird_abgelehnt() -> None:
    """Zwei Reiter mit demselben Namen wären für das Backoffice derselbe."""
    db = _db()
    _ordner(db, "Logos")
    with pytest.raises(AffiliateError) as exc:
        _ordner(db, "Logos")
    assert exc.value.status_code == 409


def test_ordner_umbenennen() -> None:
    db = _db()
    fid = _ordner(db, "Logos")
    neu = _svc(db).bo_ordner_aendern(fid, BackofficeOrdnerAendern(name="Marken"), ADMIN)
    assert neu.name == "Marken"


def test_unbekannter_ordner_ist_404_und_kein_leeres_ergebnis() -> None:
    """Fail-closed: eine erfundene ID darf nicht wie ein leerer Ordner aussehen."""
    with pytest.raises(AffiliateError) as exc:
        _svc(_db()).bo_ordner_aendern("gibt-es-nicht", BackofficeOrdnerAendern(name="X"), ADMIN)
    assert exc.value.status_code == 404


# --- Verschieben -------------------------------------------------------------


def test_material_in_einen_ordner_ziehen() -> None:
    db = _db()
    fid = _ordner(db, "Banner")
    m = _svc(db).bo_material_hochladen(PNG, "a.png", _beschreibung(), ADMIN)
    assert m.folder_id is None

    res = _svc(db).bo_material_verschieben(
        BackofficeMaterialVerschieben(asset_ids=[m.id], folder_id=fid), ADMIN
    )
    assert [r.folder_id for r in res] == [fid]


def test_material_wieder_herausziehen() -> None:
    db = _db()
    fid = _ordner(db, "Banner")
    m = _svc(db).bo_material_hochladen(PNG, "a.png", _beschreibung(folder_id=fid), ADMIN)
    res = _svc(db).bo_material_verschieben(
        BackofficeMaterialVerschieben(asset_ids=[m.id], folder_id=None), ADMIN
    )
    assert [r.folder_id for r in res] == [None]


def test_mehrere_auf_einmal_verschieben() -> None:
    db = _db()
    fid = _ordner(db, "Presse")
    ids = [
        _svc(db).bo_material_hochladen(PNG, f"{i}.png", _beschreibung(), ADMIN).id
        for i in range(3)
    ]
    res = _svc(db).bo_material_verschieben(
        BackofficeMaterialVerschieben(asset_ids=ids, folder_id=fid), ADMIN
    )
    assert {r.folder_id for r in res} == {fid}


def test_verschieben_in_einen_erfundenen_ordner_scheitert() -> None:
    """Sonst läge das Material an einem Reiter, den es nicht gibt — sichtbar
    wäre es dann nirgends (Wurzel 9)."""
    db = _db()
    m = _svc(db).bo_material_hochladen(PNG, "a.png", _beschreibung(), ADMIN)
    with pytest.raises(AffiliateError) as exc:
        _svc(db).bo_material_verschieben(
            BackofficeMaterialVerschieben(asset_ids=[m.id], folder_id="erfunden"), ADMIN
        )
    assert exc.value.status_code == 404
    assert db.zeilen("affiliate_assets")[0].get("folder_id") is None


def test_hochladen_in_einen_erfundenen_ordner_legt_keine_waise_ab() -> None:
    """Der Ordner wird VOR dem Upload geprüft — sonst bliebe die Datei im
    Bucket liegen, ohne dass je eine Zeile auf sie zeigt (Wurzel 1)."""
    db = _db()
    with pytest.raises(AffiliateError) as exc:
        _svc(db).bo_material_hochladen(
            PNG, "a.png", _beschreibung(folder_id="erfunden"), ADMIN
        )
    assert exc.value.status_code == 404
    assert db.storage.dateien == {}  # type: ignore[attr-defined]
    assert db.zeilen("affiliate_assets") == []


@pytest.mark.parametrize("anzahl", [0, 201])
def test_die_liste_der_ids_ist_gedeckelt(anzahl: int) -> None:
    """Kein unbegrenzter Bereich (Wurzel 8) — und kein leerer Aufruf, der
    stillschweigend nichts tut."""
    with pytest.raises(ValueError, match="asset_ids"):
        BackofficeMaterialVerschieben(asset_ids=["x"] * anzahl, folder_id=None)


# --- Was der Partner sieht ---------------------------------------------------


def test_der_ordner_aendert_nichts_am_partner_dashboard() -> None:
    """Ordner sind Organisation im Backoffice. Der Partner bekommt weiterhin
    eine flache Liste — ein Reiter mit deutschem Namen hätte in 23 anderen
    Sprachen keine Entsprechung."""
    db = _db()
    fid = _ordner(db, "Logos")
    _svc(db).bo_material_hochladen(PNG, "a.png", _beschreibung(folder_id=fid), ADMIN)
    liste = _svc(db).material(
        AffiliateContext(affiliate_id=AFF, email="p@x.example", status="approved")
    )
    assert len(liste) == 1
    assert not hasattr(liste[0], "folder_id")


def test_ordner_loeschen_ruehrt_das_material_nicht_an() -> None:
    """Was der SERVICE dabei tun muss: nichts.

    Dass die `folder_id` der Einträge danach NULL ist, setzt der Fremdschlüssel
    durch (`on delete set null`, 0709) — dieser Fake kennt keine
    Fremdschlüssel, ein Test darauf wäre grün und wertlos. Was er sehr wohl
    zeigen kann, ist das Gegenteil: dass hier niemand eine gut gemeinte
    Aufräumschleife über `affiliate_assets` einbaut, die nach der Hälfte
    abbrechen könnte.
    """
    db = _db()
    fid = _ordner(db, "Banner")
    m = _svc(db).bo_material_hochladen(PNG, "a.png", _beschreibung(folder_id=fid), ADMIN)
    pfad = db.zeilen("affiliate_assets")[0]["storage_path"]

    _svc(db).bo_ordner_loeschen(fid, ADMIN)

    assert db.zeilen("affiliate_asset_folders") == []
    assert [z["id"] for z in db.zeilen("affiliate_assets")] == [m.id]
    assert pfad in db.storage.dateien  # type: ignore[attr-defined]
    assert db.storage.geloescht == []  # type: ignore[attr-defined]
