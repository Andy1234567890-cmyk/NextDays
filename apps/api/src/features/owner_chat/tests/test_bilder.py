"""Anhänge des Eigentümer-Chats — Typprüfung und Pfadform.

Bis zum 09.09.2026 lud die App den Anhang als CHIFFRETEXT hoch, und der Server
prüfte den Inhalt bewusst nicht (er konnte ihn nicht lesen). Mit der
serverseitigen Verschlüsselung kommt wieder ein echtes Bild an — damit wird
die Prüfung nachholbar UND nötig (Wurzel 8).

Geprüft wird mit ECHTEN Magic Bytes, nicht mit einem Mock: ein Test, der die
Tabelle gegen sich selbst prüft, hätte den Fehler nicht gefunden.
"""
from __future__ import annotations

import pytest

from src.features.owner_chat import bilder
from src.features.owner_chat.fehler import OwnerChatError

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 32
GIF = b"GIF89a" + b"\x00" * 32
WEBP = b"RIFF" + b"\x00\x00\x00\x00" + b"WEBP" + b"\x00" * 32

TENANT = "11111111-1111-1111-1111-111111111111"
USER = "22222222-2222-2222-2222-222222222222"


def _typ(inhalt: bytes) -> tuple[str, str]:
    return bilder._bildtyp(inhalt)  # pylint: disable=protected-access


@pytest.mark.parametrize(
    ("inhalt", "mime", "endung"),
    [
        (PNG, "image/png", "png"),
        (JPEG, "image/jpeg", "jpg"),
        (GIF, "image/gif", "gif"),
        (WEBP, "image/webp", "webp"),
    ],
)
def test_erlaubte_bildtypen(inhalt: bytes, mime: str, endung: str) -> None:
    assert _typ(inhalt) == (mime, endung)


def test_svg_wird_abgewiesen() -> None:
    """SVG ist aktives Markup — im Chat nicht erlaubt, auch nicht 'nur als Bild'."""
    with pytest.raises(OwnerChatError) as exc:
        _typ(b'<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>')
    assert exc.value.status_code == 415


def test_pdf_wird_abgewiesen() -> None:
    with pytest.raises(OwnerChatError) as exc:
        _typ(b"%PDF-1.7\n%\xe2\xe3\xcf\xd3")
    assert exc.value.status_code == 415


def test_html_mit_bildnamen_wird_abgewiesen() -> None:
    """Der Dateiname zählt nicht, nur der Inhalt (Wurzel 8)."""
    with pytest.raises(OwnerChatError) as exc:
        _typ(b"<html><script>alert(1)</script></html>")
    assert exc.value.status_code == 415


def test_leerer_inhalt_wird_abgewiesen() -> None:
    with pytest.raises(OwnerChatError):
        _typ(b"")


def test_riff_ohne_webp_ist_kein_bild() -> None:
    """RIFF trägt auch WAV/AVI — nur mit `WEBP` ab Byte 8 ist es ein Bild."""
    with pytest.raises(OwnerChatError):
        _typ(b"RIFF" + b"\x00\x00\x00\x00" + b"WAVE" + b"\x00" * 32)


def test_webp_ohne_riff_ist_kein_bild() -> None:
    """Die Gegenrichtung — und sie war eine echte Luecke.

    Die erste Fassung prüfte NUR `WEBP` ab Byte 8. Jeder Inhalt mit diesen
    vier Zeichen an der Stelle wurde als `image/webp` angenommen und in den
    privaten Bucket geschrieben (nachgestellt 09.09.2026). Ein WebP-Container
    beginnt mit `RIFF`; beide Marken müssen passen.
    """
    with pytest.raises(OwnerChatError):
        _typ(b"XXXX" + b"\x00\x00\x00\x00" + b"WEBP" + b"beliebiger inhalt")


# --- Pfadform (Wurzel 3/8) ---------------------------------------------------


@pytest.mark.parametrize("endung", ["png", "jpg", "gif", "webp", "bin"])
def test_pfad_jeder_erlaubten_endung(endung: str) -> None:
    """`.bin` bleibt gültig: so liegt der Bestand aus der E2E-Zeit im Bucket."""
    bilder.pfad_pruefen(f"{TENANT}/{USER}/abcDEF123_-.{endung}", TENANT)


def test_pfad_fremder_mandant_abgewiesen() -> None:
    fremd = "33333333-3333-3333-3333-333333333333"
    with pytest.raises(OwnerChatError):
        bilder.pfad_pruefen(f"{fremd}/{USER}/abc.jpg", TENANT)


def test_pfad_mit_kodiertem_aufstieg_abgewiesen() -> None:
    """`%2e%2e` normalisiert die Storage-Bibliothek weg — die FORM fängt es."""
    with pytest.raises(OwnerChatError):
        bilder.pfad_pruefen(f"{TENANT}/%2e%2e/{USER}/abc.jpg", TENANT)


def test_pfad_mit_fremder_endung_abgewiesen() -> None:
    with pytest.raises(OwnerChatError):
        bilder.pfad_pruefen(f"{TENANT}/{USER}/abc.svg", TENANT)
