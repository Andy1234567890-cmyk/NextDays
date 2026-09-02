"""Videofreigabe (0523) — kein Link ohne geprüftes Video.

Der Kern ist eine einzige Zusage: solange nicht freigegeben ist, ENTSTEHT kein
Link. Sie wird hier an der Stelle geprüft, an der der Link gebaut wird — nicht
an der Oberfläche, denn die hält niemanden auf, der die API direkt anspricht.
"""

from __future__ import annotations

from typing import Any

import pytest

from src.core.config import Settings
from src.features.affiliates import beitraege, video_freigabe
from src.features.affiliates.fehler import AffiliateError

from .fakedb import FakeDb
from .test_provision import AFF

POST = "70000000-0000-4000-8000-000000000001"
# Ein winziges, aber gültiges MP4: ISO-BMFF trägt ab Byte 4 den Marker `ftyp`.
MP4 = b"\x00\x00\x00\x18ftypisom" + b"\x00" * 64
WEBM = b"\x1a\x45\xdf\xa3" + b"\x00" * 64
MOV = b"\x00\x00\x00\x14ftypqt  " + b"\x00" * 64


class _Storage:
    """Speicher-Doppel: hält Pfade, damit Upload und Aufräumen prüfbar sind."""

    def __init__(self) -> None:
        self.dateien: dict[str, bytes] = {}
        self.geloescht: list[str] = []

    def from_(self, bucket: str) -> _Storage:
        self._bucket = bucket
        return self

    def upload(self, pfad: str, inhalt: bytes, opts: dict[str, Any]) -> None:
        _ = opts
        self.dateien[pfad] = inhalt

    def remove(self, pfade: list[str]) -> None:
        for p in pfade:
            self.geloescht.append(p)
            self.dateien.pop(p, None)

    def create_signed_url(self, pfad: str, sekunden: int) -> dict[str, str]:
        _ = sekunden
        if pfad not in self.dateien:
            raise RuntimeError("Datei fehlt")
        return {"signedURL": f"https://signiert.example/{pfad}"}


def _db(**post: Any) -> FakeDb:
    zeile = {
        "id": POST,
        "affiliate_id": AFF,
        "code_id": "c-1",
        "platform": "youtube",
        "url": None,
        "title": "Mein Video",
        "utm_content": "mein-video",
        "review_status": "draft",
        "review_note": None,
        "review_runde": 0,
        "video_path": None,
        "created_at": "2026-09-01T10:00:00+00:00",
    }
    zeile.update(post)
    db = FakeDb(
        {
            "affiliate_posts": [zeile],
            "affiliate_post_reviews": [],
            "affiliates": [
                {
                    "id": AFF,
                    "full_name": "Pia",
                    "company": None,
                    "email": "p@x",
                    "status": "approved",
                }
            ],
        }
    )
    db.storage = _Storage()  # type: ignore[attr-defined]
    return db


def _einstellungen() -> Settings:
    return Settings(marketing_base_url="https://mynextdays.com")


# --- Die Kernzusage: kein Link ohne Freigabe ----------------------------------


@pytest.mark.parametrize("stand", ["draft", "submitted", "rejected"])
def test_ohne_freigabe_entsteht_kein_link(stand: str) -> None:
    """Der Link wird nicht zurückgehalten — er wird gar nicht erst gebaut.

    Wäre er nur in der Oberfläche versteckt, bekäme ihn jeder, der
    `GET /affiliates/posts` aufruft (Wurzel 3).
    """
    link = beitraege.link_bauen(
        _einstellungen(),
        code="DEMO",
        platform="youtube",
        utm_content="mein-video",
        freigegeben=video_freigabe.link_erlaubt({"review_status": stand}),
    )
    assert link is None


def test_nach_freigabe_entsteht_der_link() -> None:
    link = beitraege.link_bauen(
        _einstellungen(),
        code="DEMO",
        platform="youtube",
        utm_content="mein-video",
        freigegeben=video_freigabe.link_erlaubt({"review_status": "approved"}),
    )
    assert link is not None
    assert "utm_content=mein-video" in link and "/p/DEMO" in link


def test_widerruf_macht_den_link_sofort_tot() -> None:
    """Wurzel 1: Der Gegenzustand zur Freigabe ist der tote Link."""
    frei = {"review_status": "approved"}
    assert video_freigabe.link_erlaubt(frei)
    widerrufen = {"review_status": "rejected"}
    assert not video_freigabe.link_erlaubt(widerrufen)


# --- Upload -------------------------------------------------------------------


def test_upload_setzt_auf_wartend_und_zaehlt_die_runde() -> None:
    db = _db()
    video_freigabe.video_hochladen(
        db, post_id=POST, affiliate_id=AFF, inhalt=MP4, dateiname="clip.mp4"
    )
    zeile = db.zeilen("affiliate_posts")[0]
    assert zeile["review_status"] == "submitted"
    assert zeile["review_runde"] == 1
    assert zeile["video_mime"] == "video/mp4"
    assert zeile["video_size"] == len(MP4)
    # Der Dateiname des Nutzers landet NIE im Pfad (Wurzel 8).
    assert "clip" not in zeile["video_path"]
    assert zeile["video_path"].startswith(f"{AFF}/{POST}/")
    # Protokoll ist haftungsrelevant und muss stehen.
    assert [r["aktion"] for r in db.zeilen("affiliate_post_reviews")] == ["submitted"]


def test_fremder_beitrag_ist_unsichtbar() -> None:
    """Wurzel 3/9: Scope in DERSELBEN Abfrage, nicht laden und danach prüfen."""
    db = _db()
    with pytest.raises(AffiliateError) as exc:
        video_freigabe.video_hochladen(
            db,
            post_id=POST,
            affiliate_id="99999999-9999-4999-8999-999999999999",
            inhalt=MP4,
            dateiname="x.mp4",
        )
    assert exc.value.status_code == 404


def test_freigegebenes_video_kann_nicht_getauscht_werden() -> None:
    """Sonst ließe sich nach der Freigabe ein beliebiges anderes Video
    unterschieben, während der Link weiterläuft."""
    db = _db(review_status="approved", video_path=f"{AFF}/{POST}/alt.mp4")
    with pytest.raises(AffiliateError) as exc:
        video_freigabe.video_hochladen(
            db, post_id=POST, affiliate_id=AFF, inhalt=MP4, dateiname="neu.mp4"
        )
    assert exc.value.status_code == 409


def test_doppeltes_einreichen_wird_abgewiesen() -> None:
    db = _db(review_status="submitted", video_path=f"{AFF}/{POST}/a.mp4")
    with pytest.raises(AffiliateError) as exc:
        video_freigabe.video_hochladen(
            db, post_id=POST, affiliate_id=AFF, inhalt=MP4, dateiname="a.mp4"
        )
    assert exc.value.status_code == 409


def test_nach_ablehnung_darf_nachgebessert_werden() -> None:
    db = _db(review_status="rejected", review_note="Logo falsch")
    db.storage.dateien[f"{AFF}/{POST}/alt.mp4"] = b"alt"  # type: ignore[attr-defined]
    db.zeilen("affiliate_posts")[0]["video_path"] = f"{AFF}/{POST}/alt.mp4"
    video_freigabe.video_hochladen(
        db, post_id=POST, affiliate_id=AFF, inhalt=WEBM, dateiname="neu.webm"
    )
    zeile = db.zeilen("affiliate_posts")[0]
    assert zeile["review_status"] == "submitted"
    assert zeile["review_note"] is None  # alter Grund verschwindet
    assert zeile["review_runde"] == 1
    # Gegenzustand: die verworfene Fassung wird entfernt, sonst sammelt sich
    # der Bucket mit Videos voll, die niemand mehr zuordnen kann.
    assert f"{AFF}/{POST}/alt.mp4" in db.storage.geloescht  # type: ignore[attr-defined]


# --- Wurzel 8: Upload als Angriffsfläche --------------------------------------


def test_magic_bytes_entscheiden_nicht_der_content_type() -> None:
    """Eine als Video deklarierte HTML-Datei würde im Bucket liegen und beim
    Ansehen im Browser ausgeführt."""
    assert video_freigabe.dateityp(MP4) == ("video/mp4", "mp4")
    assert video_freigabe.dateityp(WEBM) == ("video/webm", "webm")
    assert video_freigabe.dateityp(MOV) == ("video/quicktime", "mov")
    assert video_freigabe.dateityp(b"<html><script>alert(1)</script></html>") is None
    assert video_freigabe.dateityp(b"PK\x03\x04 zip archive here") is None
    assert video_freigabe.dateityp(b"<svg xmlns='http://www.w3.org/2000/svg'>") is None
    assert video_freigabe.dateityp(b"kurz") is None


def test_falscher_dateityp_wird_abgewiesen() -> None:
    db = _db()
    with pytest.raises(AffiliateError) as exc:
        video_freigabe.video_hochladen(
            db,
            post_id=POST,
            affiliate_id=AFF,
            inhalt=b"<html>nicht wirklich ein video</html>",
            dateiname="video.mp4",
        )
    assert exc.value.status_code == 422
    assert db.zeilen("affiliate_posts")[0]["review_status"] == "draft"


def test_zu_grosses_video_wird_abgewiesen() -> None:
    db = _db()
    with pytest.raises(AffiliateError) as exc:
        video_freigabe.video_hochladen(
            db,
            post_id=POST,
            affiliate_id=AFF,
            inhalt=MP4 + b"\x00" * video_freigabe.MAX_BYTES,
            dateiname="gross.mp4",
        )
    assert exc.value.status_code == 413


def test_leere_datei_wird_abgewiesen() -> None:
    db = _db()
    with pytest.raises(AffiliateError) as exc:
        video_freigabe.video_hochladen(
            db, post_id=POST, affiliate_id=AFF, inhalt=b"", dateiname="leer.mp4"
        )
    assert exc.value.status_code == 422


# --- Backoffice ---------------------------------------------------------------


def test_freigabe_setzt_stand_und_protokolliert() -> None:
    db = _db(review_status="submitted", video_path=f"{AFF}/{POST}/a.mp4")
    video_freigabe.freigeben(db, POST, admin_id="admin-1", note="Passt.")
    zeile = db.zeilen("affiliate_posts")[0]
    assert zeile["review_status"] == "approved"
    assert zeile["reviewed_by"] == "admin-1"
    assert zeile["reviewed_at"]
    assert video_freigabe.link_erlaubt(zeile)
    assert [r["aktion"] for r in db.zeilen("affiliate_post_reviews")] == ["approved"]


def test_freigabe_ist_idempotent() -> None:
    """Wurzel 2: Ein Doppelklick im Backoffice darf keine zweite Zeile und
    keinen neuen Zeitstempel erzeugen."""
    db = _db(review_status="submitted", video_path=f"{AFF}/{POST}/a.mp4")
    video_freigabe.freigeben(db, POST, admin_id="admin-1")
    video_freigabe.freigeben(db, POST, admin_id="admin-2")
    assert len(db.zeilen("affiliate_post_reviews")) == 1
    assert db.zeilen("affiliate_posts")[0]["reviewed_by"] == "admin-1"


def test_freigabe_ohne_video_geht_nicht() -> None:
    """Eine Freigabe ohne eingereichtes Video wäre eine Freigabe ins Blaue."""
    db = _db(review_status="draft")
    with pytest.raises(AffiliateError) as exc:
        video_freigabe.freigeben(db, POST, admin_id="admin-1")
    assert exc.value.status_code == 409


def test_ablehnung_verlangt_einen_grund() -> None:
    """Ohne Grund lädt der Partner dasselbe Video noch einmal hoch."""
    db = _db(review_status="submitted", video_path=f"{AFF}/{POST}/a.mp4")
    with pytest.raises(AffiliateError) as exc:
        video_freigabe.ablehnen(db, POST, admin_id="admin-1", note="  ")
    assert exc.value.status_code == 422
    assert db.zeilen("affiliate_posts")[0]["review_status"] == "submitted"


def test_ablehnung_verlangt_eine_kategorie() -> None:
    """Prüfliste (0526): ohne Kategorie ist nicht auswertbar, woran Beiträge scheitern."""
    db = _db(stand="submitted")
    with pytest.raises(AffiliateError) as exc:
        video_freigabe.ablehnen(db, POST, admin_id="admin-1", note="Eigene Aufnahmen")
    assert exc.value.status_code == 422
    video_freigabe.ablehnen(
        db, POST, admin_id="admin-1", note="Eigene Aufnahmen", reason_code="material"
    )
    beitrag = next(r for r in db.zeilen("affiliate_posts") if r["id"] == POST)
    assert beitrag["review_reason_code"] == "material"
    assert db.zeilen("affiliate_post_reviews")[-1]["reason_code"] == "material"


def test_bild_und_pdf_gelten_als_beitragsdatei() -> None:
    """Master-Strategie: JEDER Beitrag wird vorgelegt, nicht nur Videos."""
    assert video_freigabe.dateityp(b"\xff\xd8\xff\xe0" + b"0" * 20) == ("image/jpeg", "jpg")
    assert video_freigabe.dateityp(b"\x89PNG\r\n\x1a\n" + b"0" * 20) == ("image/png", "png")
    assert video_freigabe.dateityp(b"%PDF-1.7" + b"0" * 20) == ("application/pdf", "pdf")
    assert video_freigabe.dateityp(b"<svg xmlns=" + b"0" * 20) is None


def test_widerruf_nach_freigabe_wird_als_widerruf_protokolliert() -> None:
    """Ablehnung vor der Freigabe und Widerruf danach sind verschiedene
    Vorgänge — im Streitfall muss man sie auseinanderhalten können."""
    db = _db(review_status="approved", video_path=f"{AFF}/{POST}/a.mp4")
    video_freigabe.ablehnen(
        db, POST, admin_id="admin-1", note="Marke verletzt", reason_code="brand"
    )
    zeile = db.zeilen("affiliate_posts")[0]
    assert zeile["review_status"] == "rejected"
    assert not video_freigabe.link_erlaubt(zeile)
    assert [r["aktion"] for r in db.zeilen("affiliate_post_reviews")] == ["revoked"]


def test_offene_liste_traegt_signierte_adresse_und_partnernamen() -> None:
    db = _db(review_status="submitted", video_path=f"{AFF}/{POST}/a.mp4")
    db.storage.dateien[f"{AFF}/{POST}/a.mp4"] = MP4  # type: ignore[attr-defined]
    offen = video_freigabe.bo_offene(db)
    assert len(offen) == 1
    assert offen[0]["video_url"].startswith("https://signiert.example/")
    assert offen[0]["partner_name"] == "Pia"


def test_fehlende_datei_kippt_die_liste_nicht() -> None:
    """Wurzel 5: Eine kaputte Signatur darf nicht die ganze Prüfliste
    unbenutzbar machen — die Zeile kommt ohne Adresse."""
    db = _db(review_status="submitted", video_path=f"{AFF}/{POST}/weg.mp4")
    offen = video_freigabe.bo_offene(db)
    assert len(offen) == 1 and offen[0]["video_url"] is None
