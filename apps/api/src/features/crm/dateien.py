"""Dateiregeln der Partner-Deals: QR-Upload (Magic Bytes, SVG-Säuberung) und
QR-Erzeugung aus dem Rabattcode.

Der vom Browser gemeldete `content_type` ist eine Behauptung und zählt nicht
(Wurzel 8). Erkannt wird ausschließlich am Inhalt; SVG wird vor dem Ablegen mit
derselben nh3-Allowlist gesäubert wie die Firmenlogos (buchhaltung), damit ein
QR-„Bild" keine Skripte in den Browser trägt, der es später anzeigt.
"""
from __future__ import annotations

import io

# Bewusst die Allowlist der Firmenlogos wiederverwenden statt eine zweite zu
# pflegen: zwei SVG-Allowlists würden auseinanderlaufen, und die schwächere
# wäre die Lücke.
from src.features.buchhaltung.service import _sanitize_svg

from .common import CrmError

# 5 MB — derselbe Wert wie `file_size_limit` des Buckets `partner-deals` (0598).
QR_MAX_BYTES = 5 * 1024 * 1024
QR_BUCKET = "partner-deals"
# Signierte Adressen kurz halten: das Bild wird beim Öffnen der Partner-Kartei
# geholt, nicht geteilt.
QR_SIGNED_URL_TTL = 600

_MAGIC: tuple[tuple[bytes, str, str], ...] = (
    (b"\x89PNG\r\n\x1a\n", "image/png", "png"),
    (b"\xff\xd8\xff", "image/jpeg", "jpg"),
    (b"%PDF-", "application/pdf", "pdf"),
)


def _ist_svg(inhalt: bytes) -> bool:
    """SVG hat keine Magic Bytes — erkannt am Wurzelelement, nach BOM/Whitespace
    und optionalem XML-Prolog, Kommentaren und DOCTYPE."""
    text = inhalt[:4096].lstrip(b"\xef\xbb\xbf").decode("utf-8", errors="replace").lower()
    rest = text.lstrip()
    while rest:
        if rest.startswith("<svg"):
            return True
        if rest.startswith("<?"):
            ende = rest.find("?>")
            schritt = 2
        elif rest.startswith("<!--"):
            ende = rest.find("-->")
            schritt = 3
        elif rest.startswith("<!"):
            ende = rest.find(">")
            schritt = 1
        else:
            return False
        if ende < 0:
            return False
        rest = rest[ende + schritt :].lstrip()
    return False


def qr_datei_pruefen(inhalt: bytes) -> tuple[bytes, str, str]:
    """Inhalt prüfen → (ggf. gesäuberter Inhalt, MIME, Endung).

    Wirft `CrmError` 415 bei unbekanntem Typ, 413 bei Übergröße. Eine leere
    Datei ist kein Bild → 415.
    """
    if len(inhalt) > QR_MAX_BYTES:
        raise CrmError("Datei ist zu groß (max. 5 MB).", status_code=413)
    if not inhalt:
        raise CrmError("Die Datei ist leer.", status_code=415)
    for magic, mime, endung in _MAGIC:
        if inhalt.startswith(magic):
            return inhalt, mime, endung
    if _ist_svg(inhalt):
        gesaeubert = _sanitize_svg(inhalt)
        if b"<svg" not in gesaeubert.lower():
            # Nach der Säuberung blieb kein Bild übrig — der Inhalt bestand aus
            # dem, was entfernt wurde. Fail-closed statt leeres Bild ablegen.
            raise CrmError("Das SVG enthält keine darstellbare Grafik.", status_code=415)
        return gesaeubert, "image/svg+xml", "svg"
    raise CrmError(
        "Nur PNG, JPEG, SVG oder PDF erlaubt (erkannt am Inhalt, nicht am Dateinamen).",
        status_code=415,
    )


def qr_png_aus_code(code: str) -> bytes:
    """QR-Code (PNG) aus dem Rabattcode — für Partner ohne eigenes Bild.

    Inhalt ist der Code selbst, kein Link: der Partner scannt ihn an der Kasse
    und liest den Code ab; eine URL würde auf eine Einlösestrecke zeigen, die
    es in dieser Etappe nicht gibt (Wurzel 4: nichts behaupten, was nicht da ist).
    """
    import qrcode  # noqa: PLC0415 — nur hier gebraucht, wie in affiliates

    bild = qrcode.make(code, box_size=10, border=2)
    puffer = io.BytesIO()
    bild.save(puffer, format="PNG")
    return puffer.getvalue()
