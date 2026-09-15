"""Werbematerial als DATEI (0707): Upload, Säuberung, Download, Aufräumen.

Die beiden Zusagen, um die es hier geht:

1. **Was im Bucket landet, ist das, was es zu sein behauptet.** Entschieden wird
   an den Anfangsbytes, nicht am `content_type` des Clients (Wurzel 8); ein SVG
   verliert vorher jedes Skript.
2. **Eine gelöschte Zeile lässt keine Datei zurück.** Der Pfad steht nur in der
   Zeile — verschwindet sie, ohne dass die Datei mitgeht, findet die Datei nie
   wieder jemand (Wurzel 1). Genau das prüfen die Lösch- und Ersetzen-Tests.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest

from src.core.security import AffiliateContext, PlatformContext
from src.features.affiliates import material_dateien
from src.features.affiliates.fehler import AffiliateError
from src.features.affiliates.schemas import (
    BackofficeMaterialAendern,
    BackofficeMaterialDatei,
)
from src.features.affiliates.service import AffiliatesService

from .fakedb import FakeDb

ADMIN = PlatformContext(user_id="admin-1", platform_role="platform_admin")
AFF = "10000000-0000-4000-8000-000000000001"

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
PDF = b"%PDF-1.7\n" + b"\x00" * 64
MP4 = b"\x00\x00\x00\x18ftypisom" + b"\x00" * 64
DOCX = b"PK\x03\x04" + b"\x00" * 30 + b"word/document.xml" + b"\x00" * 64
ZIP = b"PK\x03\x04" + b"\x00" * 200
SVG_MIT_SKRIPT = (
    b'<?xml version="1.0"?>'
    b'<svg xmlns="http://www.w3.org/2000/svg" onload="stehlen()">'
    b"<script>fetch('https://boese.example')</script>"
    b'<rect width="10" height="10"/></svg>'
)


class _Storage:
    """Speicher-Doppel: hält Pfade, damit Upload und Aufräumen prüfbar sind."""

    def __init__(self) -> None:
        self.dateien: dict[str, bytes] = {}
        self.geloescht: list[str] = []
        self.upload_scheitert = False

    def from_(self, bucket: str) -> _Storage:
        self.bucket = bucket
        return self

    def upload(self, pfad: str, inhalt: bytes, opts: dict[str, Any]) -> None:
        if self.upload_scheitert:
            raise RuntimeError("Bucket weg")
        self.dateien[pfad] = inhalt
        self.opts = opts

    def remove(self, pfade: list[str]) -> None:
        for p in pfade:
            self.geloescht.append(p)
            self.dateien.pop(p, None)


def _db() -> FakeDb:
    db = FakeDb({"affiliates": [{"id": AFF, "status": "approved", "language": "de"}]})
    db.storage = _Storage()  # type: ignore[attr-defined]
    return db


def _svc(db: FakeDb) -> AffiliatesService:
    return AffiliatesService(db, db, mails=SimpleNamespace())


def _beschreibung(**felder: Any) -> BackofficeMaterialDatei:
    return BackofficeMaterialDatei(**{"title": "Banner Sommer", **felder})


# --- 1. Der Typ kommt aus den Bytes -----------------------------------------


@pytest.mark.parametrize(
    ("inhalt", "art", "mime"),
    [
        (PNG, "image", "image/png"),
        (PDF, "file", "application/pdf"),
        (MP4, "video", "video/mp4"),
        (
            DOCX,
            "file",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ),
        (ZIP, "file", "application/zip"),
    ],
)
def test_art_und_mime_kommen_aus_den_anfangsbytes(
    inhalt: bytes, art: str, mime: str
) -> None:
    db = _db()
    res = _svc(db).bo_material_hochladen(inhalt, "egal.txt", _beschreibung(), ADMIN)
    assert (res.kind, res.mime) == (art, mime)


def test_ein_php_skript_mit_bildnamen_wird_abgelehnt() -> None:
    """Der Dateiname ist keine Angabe, auf die sich irgendetwas stützt."""
    db = _db()
    with pytest.raises(AffiliateError) as exc:
        _svc(db).bo_material_hochladen(
            b"<?php system($_GET[0]); ?>", "logo.png", _beschreibung(), ADMIN
        )
    assert exc.value.status_code == 415
    assert db.storage.dateien == {}  # type: ignore[attr-defined]


def test_leere_datei_ist_kein_material() -> None:
    with pytest.raises(AffiliateError) as exc:
        _svc(_db()).bo_material_hochladen(b"", "leer.png", _beschreibung(), ADMIN)
    assert exc.value.status_code == 415


def test_zu_grosses_bild_nennt_die_grenze_seiner_art() -> None:
    """413 mit der Grenze für BILDER (10 MB) — nicht der für Videos (25 MB)."""
    gross = PNG + b"\x00" * material_dateien.MAX_BYTES_JE_ART["image"]
    with pytest.raises(AffiliateError) as exc:
        _svc(_db()).bo_material_hochladen(gross, "riesig.png", _beschreibung(), ADMIN)
    assert exc.value.status_code == 413
    assert "10 MB" in exc.value.message


# --- 2. SVG wird gesäubert, bevor es liegt ----------------------------------


def test_svg_verliert_skript_und_event_handler_vor_dem_ablegen() -> None:
    db = _db()
    res = _svc(db).bo_material_hochladen(SVG_MIT_SKRIPT, "logo.svg", _beschreibung(), ADMIN)
    abgelegt = db.storage.dateien[db.zeilen("affiliate_assets")[0]["storage_path"]]  # type: ignore[attr-defined]
    assert b"<script" not in abgelegt.lower()
    assert b"onload" not in abgelegt.lower()
    assert b"boese.example" not in abgelegt
    assert b"<rect" in abgelegt.lower()
    # Die abgelegte Größe ist die des GESÄUBERTEN Inhalts, nicht des Uploads —
    # sonst zeigte das Dashboard eine Zahl, die zur Datei nicht passt.
    assert res.bytes == len(abgelegt)


def test_svg_das_nur_aus_skript_besteht_wird_abgelehnt() -> None:
    """Nach der Säuberung bliebe eine leere Grafik — fail-closed statt Attrappe."""
    with pytest.raises(AffiliateError) as exc:
        _svc(_db()).bo_material_hochladen(
            b"<script>alert(1)</script>", "boese.svg", _beschreibung(), ADMIN
        )
    assert exc.value.status_code == 415


# --- 3. Pfad und Anzeigename -------------------------------------------------


def test_der_bucket_pfad_ist_nicht_der_dateiname() -> None:
    """Der Bucket ist öffentlich — ein ratbarer Pfad wäre der einzige fehlende
    Schritt, um fremdes Material zu finden."""
    db = _db()
    _svc(db).bo_material_hochladen(PNG, "banner-sommer-2027.png", _beschreibung(), ADMIN)
    pfad = db.zeilen("affiliate_assets")[0]["storage_path"]
    assert "banner" not in pfad
    assert pfad.endswith(".png")
    assert len(pfad) == 32 + len(".png")


@pytest.mark.parametrize(
    ("roh", "erwartet"),
    [
        ("../../etc/passwd", "passwd"),
        ("unterordner/logo.png", "logo.png"),
        ("C:\\Users\\a\\logo.png", "logo.png"),
        ('an"fuehrung.png', "anfuehrung.png"),
        ("", "material.png"),
        (None, "material.png"),
    ],
)
def test_anzeigename_traegt_nie_einen_pfad(roh: str | None, erwartet: str) -> None:
    """Der Name landet in einem `Content-Disposition`-Header — ein Pfadtrenner
    oder ein Anführungszeichen darin wäre der Hebel, den Header zu zerlegen."""
    assert material_dateien.anzeigename(roh, "png") == erwartet


# --- 4. Gegenzustand: die Datei geht mit (Wurzel 1) --------------------------


def test_loeschen_nimmt_die_datei_aus_dem_bucket() -> None:
    db = _db()
    res = _svc(db).bo_material_hochladen(PNG, "banner.png", _beschreibung(), ADMIN)
    pfad = db.zeilen("affiliate_assets")[0]["storage_path"]
    assert pfad in db.storage.dateien  # type: ignore[attr-defined]

    _svc(db).bo_material_loeschen(res.id, ADMIN)
    assert db.zeilen("affiliate_assets") == []
    assert db.storage.geloescht == [pfad]  # type: ignore[attr-defined]


def test_ersetzen_legt_die_neue_datei_ab_und_raeumt_die_alte_weg() -> None:
    db = _db()
    res = _svc(db).bo_material_hochladen(PNG, "alt.png", _beschreibung(), ADMIN)
    alt_pfad = db.zeilen("affiliate_assets")[0]["storage_path"]

    neu = _svc(db).bo_material_datei_ersetzen(res.id, PDF, "presse.pdf", ADMIN)
    neu_pfad = db.zeilen("affiliate_assets")[0]["storage_path"]

    assert neu_pfad != alt_pfad
    assert db.storage.geloescht == [alt_pfad]  # type: ignore[attr-defined]
    assert neu_pfad in db.storage.dateien  # type: ignore[attr-defined]
    assert (neu.kind, neu.filename) == ("file", "presse.pdf")


def test_scheitert_das_ablegen_entsteht_keine_halbe_zeile() -> None:
    db = _db()
    db.storage.upload_scheitert = True  # type: ignore[attr-defined]
    with pytest.raises(AffiliateError) as exc:
        _svc(db).bo_material_hochladen(PNG, "banner.png", _beschreibung(), ADMIN)
    assert exc.value.status_code == 502
    assert db.zeilen("affiliate_assets") == []


def test_ein_textbaustein_hat_keine_datei_zum_ersetzen() -> None:
    db = _db()
    db.zeilen("affiliate_assets").append(
        {
            "id": "a-1",
            "kind": "text",
            "title": "Kurztext",
            "body": "Hallo",
            "sort": 0,
            "active": True,
        }
    )
    with pytest.raises(AffiliateError) as exc:
        _svc(db).bo_material_datei_ersetzen("a-1", PNG, "banner.png", ADMIN)
    assert exc.value.status_code == 422


def test_die_adresse_einer_datei_laesst_sich_nicht_umbiegen() -> None:
    """Sonst zeigte die Zeile woandershin, während `storage_path` auf der alten
    Datei stehen bleibt — die wäre dann weder erreichbar noch je löschbar."""
    db = _db()
    res = _svc(db).bo_material_hochladen(PNG, "banner.png", _beschreibung(), ADMIN)
    with pytest.raises(AffiliateError) as exc:
        _svc(db).bo_material_aendern(
            res.id, BackofficeMaterialAendern(url="https://fremd.example/x.png"), ADMIN
        )
    assert exc.value.status_code == 422


def test_titel_aendern_bleibt_bei_einer_datei_erlaubt() -> None:
    db = _db()
    res = _svc(db).bo_material_hochladen(PNG, "banner.png", _beschreibung(), ADMIN)
    geaendert = _svc(db).bo_material_aendern(
        res.id, BackofficeMaterialAendern(title="Banner Winter"), ADMIN
    )
    assert geaendert.title == "Banner Winter"
    assert geaendert.download_url == res.download_url


# --- 5. Was der Partner sieht ------------------------------------------------


def test_partner_bekommt_download_adresse_mit_dateinamen() -> None:
    db = _db()
    _svc(db).bo_material_hochladen(PNG, "banner sommer.png", _beschreibung(), ADMIN)
    liste = _svc(db).material(
        AffiliateContext(affiliate_id=AFF, email="p@x.example", status="approved")
    )
    assert len(liste) == 1
    m = liste[0]
    assert m.download_url is not None
    # Der Name steht kodiert im Parameter — der Browser speichert ihn so.
    assert m.download_url.endswith("?download=banner%20sommer.png")
    assert (m.filename, m.mime, m.bytes) == ("banner sommer.png", "image/png", len(PNG))


def test_ein_reiner_link_hat_nichts_zum_herunterladen() -> None:
    """Kein erfundener Ersatzwert: bei einer fremden Adresse bleibt das Feld
    leer, und die Oberfläche zeigt nur „Öffnen" (Wurzel 4)."""
    db = _db()
    db.zeilen("affiliate_assets").append(
        {
            "id": "a-1",
            "kind": "link",
            "title": "Presseseite",
            "url": "https://mynextdays.com/presse",
            "language": None,
            "sort": 0,
            "active": True,
        }
    )
    liste = _svc(db).material(
        AffiliateContext(affiliate_id=AFF, email="p@x.example", status="approved")
    )
    m = liste[0]
    assert (m.download_url, m.filename, m.bytes) == (None, None, None)
    assert m.url == "https://mynextdays.com/presse"
