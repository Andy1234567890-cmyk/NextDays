"""Upload-Sicherheit der Mediathek: der WIRKLICHE Bildtyp (0432).

Eigenes Modul, weil `service.py` an der Zeilengrenze steht, die `pylint` hier
setzt (1500) — und weil diese Prüfung nichts mit Site-Konfiguration zu tun hat.
Sie beantwortet eine einzige Frage: ist das, was hochgeladen wurde, wirklich ein
Bild?
"""

from __future__ import annotations


def bild_typ(content: bytes) -> str | None:
    """Der WIRKLICHE Bildtyp aus den Anfangsbytes, oder ``None``.

    Wurzel 8: der ``content_type`` des Clients ist eine Behauptung — er wird von
    der Gegenseite gesetzt und kostet nichts. Deshalb entscheidet die Signatur:
    JPEG ``FF D8 FF``, PNG ``89 50 4E 47 0D 0A 1A 0A``, WebP ``RIFF....WEBP``.

    ``None`` heißt: kein erkanntes Bildformat. Der Aufrufer lehnt dann ab —
    nicht „vielleicht doch", denn ein Byte-Muster ist eindeutig (fail-closed,
    Wurzel 5).

    Gleiche Prüfung wie in ``tasks/service.py`` — bewusst als Kopie und nicht als
    Import: ein Slice soll für seine Upload-Sicherheit nicht an einem fremden
    Slice hängen, und die Signaturen ändern sich nie.
    """
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    return None
