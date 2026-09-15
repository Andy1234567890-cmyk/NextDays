"""Der Multipart-Pfad des Material-Uploads — durch die echte HTTP-Schicht.

Die Service-Tests (`test_material_dateien.py`) prüfen, was mit dem INHALT
passiert. Hier geht es um die Schicht davor, die sie nicht sieht:

* Der Parser erzeugt `starlette.datastructures.UploadFile`, NICHT FastAPIs
  gleichnamige Unterklasse. Ein `isinstance(teil, fastapi.UploadFile)` ist für
  die immer False — die Datei fiele stumm aus dem Formular, und der Upload
  meldete „keine Datei", obwohl eine da war. Genau diese Verwechslung prüft
  `test_datei_wird_im_formular_gefunden` ab.
* `title` und `sort` kommen als TEXT. Ein `sort=viele` darf keinen 500 werfen
  (Wurzel 5), ein fehlender Titel kein stilles Material ohne Namen.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

from fastapi.testclient import TestClient

from src.core.security import PlatformContext, get_current_platform_admin
from src.features.affiliates.dependencies import get_affiliates_service
from src.features.affiliates.service import AffiliatesService
from src.main import create_app

from .fakedb import FakeDb
from .test_material_dateien import PNG, _Storage

PFAD = "/api/v1/platform/affiliates/assets/upload"


class _Audit:
    """Audit-Doppel: `audit.record` schreibt sonst in eine Tabelle, die dieser
    Fake nicht kennt — geprüft wird hier der Upload, nicht das Protokoll."""

    def record(self, *args: Any, **kwargs: Any) -> None:
        self.letzte = (args, kwargs)


# EINMAL pro Modul gebaut: `create_app()` montiert 79 Slices und braucht dafür
# gut drei Sekunden — siebenmal wäre eine halbe Minute für nichts. Die
# Overrides unten werden je Test neu gesetzt, der Bestand kommt aus einer
# frischen FakeDb.
_APP = create_app()
_APP.dependency_overrides[get_current_platform_admin] = lambda: PlatformContext(
    user_id="admin-1", platform_role="platform_admin"
)


def _client(monkeypatch: Any) -> tuple[TestClient, FakeDb]:
    db = FakeDb({})
    db.storage = _Storage()  # type: ignore[attr-defined]
    svc = AffiliatesService(db, db, mails=SimpleNamespace())
    monkeypatch.setattr(
        "src.features.affiliates.router_backoffice.audit", _Audit(), raising=True
    )
    _APP.dependency_overrides[get_affiliates_service] = lambda: svc
    return TestClient(_APP), db


def test_datei_wird_im_formular_gefunden(monkeypatch: Any) -> None:
    """Der Kern: ankommende Datei → 201 mit Art, Name und Größe."""
    client, db = _client(monkeypatch)
    res = client.post(
        PFAD,
        files={"file": ("banner.png", PNG, "image/png")},
        data={"title": "Banner Sommer", "sort": "3"},
    )
    assert res.status_code == 201, res.text
    daten = res.json()
    assert (daten["kind"], daten["filename"], daten["sort"]) == ("image", "banner.png", 3)
    assert daten["download_url"].endswith("?download=banner.png")
    assert len(db.zeilen("affiliate_assets")) == 1


def test_ohne_datei_gibt_es_400_und_keine_zeile(monkeypatch: Any) -> None:
    client, db = _client(monkeypatch)
    res = client.post(PFAD, data={"title": "Nur Text"})
    assert res.status_code == 400
    assert db.zeilen("affiliate_assets") == []


def test_ein_content_type_der_luegt_aendert_nichts(monkeypatch: Any) -> None:
    """Der Client behauptet „PDF", schickt ein PNG — es zählt der Inhalt."""
    client, _db = _client(monkeypatch)
    res = client.post(
        PFAD,
        files={"file": ("presse.pdf", PNG, "application/pdf")},
        data={"title": "Angeblich PDF"},
    )
    assert res.status_code == 201
    assert res.json()["kind"] == "image"


def test_unsinniges_sort_wirft_keinen_500(monkeypatch: Any) -> None:
    """Angreiferkontrollierter Text darf keinen Absturz auslösen (Wurzel 5) —
    was keine Zahl ist, wird 0."""
    client, _db = _client(monkeypatch)
    res = client.post(
        PFAD,
        files={"file": ("banner.png", PNG, "image/png")},
        data={"title": "Banner", "sort": "'; drop table --"},
    )
    assert res.status_code == 201
    assert res.json()["sort"] == 0


def test_ohne_titel_entsteht_kein_namenloses_material(monkeypatch: Any) -> None:
    client, db = _client(monkeypatch)
    res = client.post(PFAD, files={"file": ("banner.png", PNG, "image/png")}, data={})
    assert res.status_code == 422
    assert db.zeilen("affiliate_assets") == []


def test_leeres_sprachfeld_heisst_alle_sprachen(monkeypatch: Any) -> None:
    """Ein leeres Formularfeld ist NULL, nicht `""` — sonst wäre „für alle"
    nicht mehr von „Sprache vergessen" unterscheidbar."""
    client, _db = _client(monkeypatch)
    res = client.post(
        PFAD,
        files={"file": ("banner.png", PNG, "image/png")},
        data={"title": "Banner", "language": "", "description": "  "},
    )
    assert res.status_code == 201
    assert (res.json()["language"], res.json()["description"]) == (None, None)


def test_kind_und_url_lassen_sich_nicht_vorgeben(monkeypatch: Any) -> None:
    """Beide entstehen serverseitig. Ein mitgeschicktes `kind=video` zu einem
    PNG darf die Zeile nicht verbiegen (Wurzel 8)."""
    client, db = _client(monkeypatch)
    res = client.post(
        PFAD,
        files={"file": ("banner.png", PNG, "image/png")},
        data={"title": "Banner", "kind": "video", "url": "https://fremd.example/x"},
    )
    assert res.status_code == 201
    assert res.json()["kind"] == "image"
    assert db.zeilen("affiliate_assets")[0]["url"].startswith("http")
    assert "fremd.example" not in db.zeilen("affiliate_assets")[0]["url"]
