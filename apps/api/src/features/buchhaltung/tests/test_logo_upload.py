"""Firmenlogo-Upload: erlaubte Typen, Signaturprüfung, PDF (Lastenheft §2.1).

Der Client-`content_type` ist frei wählbar — geprüft wird die Datei selbst
(Magic-Bytes). Ein PDF darf hinein (0580 zieht den Bucket nach), ein als PDF
deklarierter Fremdinhalt nicht.
"""
from unittest.mock import MagicMock

import pytest

from src.core.security import AuthContext
from src.features.buchhaltung.service import (
    BuchhaltungError,
    BuchhaltungService,
    _logo_bytes_passen,
)

_CTX = AuthContext(user_id="u", tenant_id="t1", role="admin")


def _svc() -> tuple[BuchhaltungService, MagicMock]:
    db = MagicMock()
    storage = MagicMock()
    db.storage.from_.return_value = storage
    db.table.return_value.upsert.return_value.execute.return_value.data = []
    kette = db.table.return_value.select.return_value.eq.return_value.limit.return_value
    kette.execute.return_value.data = []
    svc = BuchhaltungService(service_client=db)
    # Nebenpfade (Portal-Resync, Stripe) sind hier nicht Gegenstand.
    svc._sync_logo_zu_stripe = lambda _tenant: None  # type: ignore[method-assign]
    return svc, storage


def test_pdf_ist_erlaubter_logotyp() -> None:
    assert BuchhaltungService.LOGO_MIME["application/pdf"] == "pdf"


def test_pdf_logo_wird_abgelegt() -> None:
    svc, storage = _svc()
    svc.upload_logo(_CTX, b"%PDF-1.7\n%...", "application/pdf")
    pfad = storage.upload.call_args[0][0]
    assert pfad == "t1/logo.pdf"
    assert storage.upload.call_args[0][2]["content-type"] == "application/pdf"


def test_pdf_deklariert_aber_kein_pdf_ist_415() -> None:
    svc, storage = _svc()
    with pytest.raises(BuchhaltungError) as exc:
        svc.upload_logo(_CTX, b"\x89PNG\r\n\x1a\nabc", "application/pdf")
    assert exc.value.status_code == 415
    assert not storage.upload.called


def test_png_deklariert_aber_pdf_ist_415() -> None:
    svc, storage = _svc()
    with pytest.raises(BuchhaltungError) as exc:
        svc.upload_logo(_CTX, b"%PDF-1.4", "image/png")
    assert exc.value.status_code == 415
    assert not storage.upload.called


def test_unbekannter_typ_bleibt_415() -> None:
    svc, _ = _svc()
    with pytest.raises(BuchhaltungError) as exc:
        svc.upload_logo(_CTX, b"GIF89a", "image/gif")
    assert exc.value.status_code == 415


@pytest.mark.parametrize(
    ("inhalt", "ext", "erwartet"),
    [
        (b"%PDF-1.5", "pdf", True),
        (b"PDF ohne Prozent", "pdf", False),
        (b"\x89PNG\r\n\x1a\n", "png", True),
        (b"\xff\xd8\xff\xe0", "jpg", True),
        (b"RIFF\x00\x00\x00\x00WEBPVP8 ", "webp", True),
        (b"RIFF\x00\x00\x00\x00AVI ", "webp", False),
        (b"<svg xmlns='http://www.w3.org/2000/svg'/>", "svg", True),
    ],
)
def test_signaturpruefung(inhalt: bytes, ext: str, erwartet: bool) -> None:
    assert _logo_bytes_passen(inhalt, ext) is erwartet
