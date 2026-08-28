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


def bild_masse(content: bytes) -> tuple[int, int] | None:
    """Breite und Höhe in Pixeln aus den KOPFBYTES, oder ``None``.

    Warum selbst lesen und nicht Pillow: die Maße stehen in den ersten Bytes
    jedes der drei erlaubten Formate. Eine Bibliothek, die dafür das ganze Bild
    dekodiert, wäre zusätzliche Angriffsfläche (Decoder-CVEs) für eine
    Information, die 40 Zeilen Byte-Arithmetik liefern.

    Warum überhaupt serverseitig: die Oberfläche zeigt „1920 × 1080" an. Käme
    die Zahl vom Client, wäre sie eine Behauptung wie der ``content_type`` —
    und ein Bild, das sich als 4000 px breit ausgibt, würde in der Bildauswahl
    falsch einsortiert.

    ``None`` heißt: die Maße stehen nicht dort, wo sie stehen müssten (ein
    abgeschnittener Kopf, ein exotisches JPEG ohne SOF im gelesenen Bereich).
    Dann bleibt die Spalte leer — es wird KEIN plausibler Wert geraten
    (Wurzel 4).
    """
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return _png_masse(content)
    if content.startswith(b"\xff\xd8\xff"):
        return _jpeg_masse(content)
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return _webp_masse(content)
    return None


def _png_masse(content: bytes) -> tuple[int, int] | None:
    """PNG: der IHDR-Chunk steht zwingend als erster, Breite und Höhe als
    32-Bit-Zahlen an Byte 16 bzw. 20 (Big Endian, PNG-Spezifikation 11.2.2)."""
    if len(content) < 24 or content[12:16] != b"IHDR":
        return None
    breite = int.from_bytes(content[16:20], "big")
    hoehe = int.from_bytes(content[20:24], "big")
    return (breite, hoehe) if breite and hoehe else None


#: Deckel für die JPEG-Segmentkette. Ein echtes Foto hat weniger als 30
#: Segmente vor dem SOF; 200 ist großzügig und beendet jede Endlosschleife.
_MAX_SEGMENTE = 200


#: Die SOF-Marker, die eine Bildgröße tragen. `SOF4` (0xC4) fehlt bewusst: das
#: ist die Huffman-Tabelle, nicht der Bildkopf — dasselbe gilt für 0xC8 (JPG)
#: und 0xCC (DAC). Wer sie mitnimmt, liest die Größe aus einer Tabelle.
_JPEG_SOF = frozenset(
    {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}
)


def _jpeg_sof_masse(content: bytes, i: int) -> tuple[int, int] | None:
    """Höhe und Breite aus einem SOF-Segment, dessen Länge bei ``i`` beginnt.

    Eigene Funktion, damit die Segmentschleife unten die Kette entlangläuft und
    NICHTS über den Aufbau eines einzelnen Segments wissen muss. Aufbau:
    2 Byte Länge, 1 Byte Präzision, 2 Byte Höhe, 2 Byte Breite — Höhe zuerst,
    was beim Lesen die häufigste Verwechslung ist."""
    if i + 7 > len(content):
        return None
    hoehe = int.from_bytes(content[i + 3 : i + 5], "big")
    breite = int.from_bytes(content[i + 5 : i + 7], "big")
    return (breite, hoehe) if breite and hoehe else None


def _jpeg_masse(content: bytes) -> tuple[int, int] | None:
    """JPEG: die Größe steht im SOF-Segment, und das liegt NICHT an fester
    Stelle — davor können EXIF, ICC-Profil und Thumbnails beliebig viel Platz
    belegen. Also die Segmentkette entlanghangeln.

    Die Schleife ist gedeckelt (``_MAX_SEGMENTE``): eine manipulierte Datei mit
    einer Segmentlänge von 0 würde sonst ewig an derselben Stelle stehen
    bleiben (Wurzel 8 — kein unbegrenzter Bereich)."""
    i = 2
    n = len(content)
    for _ in range(_MAX_SEGMENTE):
        # Vor jedem Marker dürfen Füllbytes 0xFF stehen (JPEG-Spezifikation B.1.1.2).
        while i < n and content[i] == 0xFF:
            i += 1
        if i >= n:
            return None
        marker = content[i]
        i += 1
        # Marker ohne Nutzlast: RSTn (0xD0–0xD7), SOI, EOI, TEM.
        if 0xD0 <= marker <= 0xD9 or marker == 0x01:
            continue
        if i + 2 > n:
            return None
        laenge = int.from_bytes(content[i : i + 2], "big")
        if laenge < 2:
            return None
        if marker in _JPEG_SOF:
            return _jpeg_sof_masse(content, i)
        i += laenge
        # 0xFF muss der nächste Marker-Beginn sein; steht dort etwas anderes,
        # ist die Kette gerissen und Weiterlaufen wäre Raten.
        if i >= n or content[i] != 0xFF:
            return None
    return None


def _webp_vp8(content: bytes) -> tuple[int, int] | None:
    """``VP8 `` (verlustbehaftet): 14-Bit-Maße hinter der Sync-Folge 9D 01 2A."""
    if len(content) < 30 or content[23:26] != b"\x9d\x01\x2a":
        return None
    breite = int.from_bytes(content[26:28], "little") & 0x3FFF
    hoehe = int.from_bytes(content[28:30], "little") & 0x3FFF
    return (breite, hoehe) if breite and hoehe else None


def _webp_vp8l(content: bytes) -> tuple[int, int] | None:
    """``VP8L`` (verlustfrei): je 14 Bit Breite und Höhe, jeweils MINUS 1,
    bitweise gepackt hinter dem Signaturbyte 0x2F."""
    if len(content) < 25 or content[20] != 0x2F:
        return None
    bits = int.from_bytes(content[21:25], "little")
    return ((bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1)


def _webp_vp8x(content: bytes) -> tuple[int, int] | None:
    """``VP8X`` (erweitert, z. B. mit Alpha): 24-Bit-Maße MINUS 1, Little Endian."""
    if len(content) < 30:
        return None
    breite = int.from_bytes(content[24:27], "little") + 1
    hoehe = int.from_bytes(content[27:30], "little") + 1
    return (breite, hoehe)


#: WebP kennt DREI Kopfarten, und sie stehen an verschiedenen Stellen. Nur eine
#: davon zu lesen wäre der stille Fehler: die Datei ist ein gültiges WebP, die
#: Oberfläche zeigt nur bei manchen eine Größe an, und niemand versteht, wonach
#: sich das richtet. Als Tabelle, damit ein vierter Kopf ein Eintrag ist.
_WEBP_KOEPFE = {
    b"VP8 ": _webp_vp8,
    b"VP8L": _webp_vp8l,
    b"VP8X": _webp_vp8x,
}


def _webp_masse(content: bytes) -> tuple[int, int] | None:
    leser = _WEBP_KOEPFE.get(content[12:16])
    return leser(content) if leser else None


# === Alle Medienarten (0479) ================================================
#
# Die Mediathek trägt fünf Arten: Bilder, Symbole, Videos, Audio, Dateien. Vier
# davon werden hochgeladen (Symbole sind Hotlinks), und für jede gilt dieselbe
# Regel wie bisher für Bilder: der ``content_type`` des Clients ist eine
# Behauptung, die Signatur entscheidet (Wurzel 8).
#
# Warum eine Tabelle und keine `if`-Kette: eine neue Art ist damit ein Eintrag,
# keine Änderung an einer Verzweigung, die man an drei Stellen nachziehen muss.
# Die Reihenfolge ist bedeutsam — `RIFF` trägt sowohl WebP als auch WAV, und
# `ftyp` sowohl MP4 als auch M4A, deshalb prüfen diese Leser den Untertyp
# selbst.


def _ist_mp4(content: bytes) -> str | None:
    """MP4-Familie: ``ftyp`` an Byte 4, die MARKE dahinter entscheidet.

    ``M4A``/``M4B`` sind dieselbe Hülle mit Audio darin — sie werden als
    ``audio/mp4`` gemeldet, sonst baut die Oberfläche einen Videorahmen um eine
    Tonspur. Unbekannte Marken werden abgelehnt und nicht als MP4 durchgelassen:
    die ftyp-Familie umfasst auch JPEG2000 und HEIF, die kein Browser als Video
    abspielt (fail-closed, Wurzel 5).
    """
    if content[4:8] != b"ftyp":
        return None
    marke = content[8:12]
    if marke[:3] in (b"M4A", b"M4B"):
        return "audio/mp4"
    if marke in (
        b"isom", b"iso2", b"iso4", b"iso5", b"iso6",
        b"mp41", b"mp42", b"avc1", b"mp4v", b"M4V ", b"dash",
    ):
        return "video/mp4"
    return None


def _ist_riff(content: bytes) -> str | None:
    """RIFF-Hülle: der Untertyp an Byte 8 sagt, was drin ist (WebP oder WAVE)."""
    if content[:4] != b"RIFF":
        return None
    if content[8:12] == b"WEBP":
        return "image/webp"
    if content[8:12] == b"WAVE":
        return "audio/wav"
    return None


def _ist_mp3(content: bytes) -> str | None:
    """MP3: entweder ein ID3-Tag am Anfang oder direkt ein Frame-Sync.

    Ohne den Frame-Sync-Zweig würde eine MP3 ohne Tag abgelehnt — Dateien aus
    Schnittprogrammen haben oft keinen. Der Sync ist 11 gesetzte Bits: ``FF``
    gefolgt von einem Byte, dessen obere drei Bits gesetzt sind.
    """
    if content[:3] == b"ID3":
        return "audio/mpeg"
    if len(content) >= 2 and content[0] == 0xFF and (content[1] & 0xE0) == 0xE0:
        return "audio/mpeg"
    return None


#: OOXML: welche Datei im ZIP steht, entscheidet über den Typ. Gesucht wird im
#: gesamten gelesenen Puffer, weil die Namen in den lokalen Datei-Köpfen über
#: das ganze Archiv verteilt stehen — nicht nur im Zentralverzeichnis am Ende.
_OOXML = (
    (b"word/document.xml",
     "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    (b"xl/workbook.xml",
     "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    (b"ppt/presentation.xml",
     "application/vnd.openxmlformats-officedocument.presentationml.presentation"),
)


def _ist_zip(content: bytes) -> str | None:
    """ZIP — und damit auch DOCX/XLSX/PPTX, die ZIPs mit festem Inhalt sind.

    ``PK\\x03\\x04`` ist der lokale Datei-Kopf. ``PK\\x05\\x06`` (leeres Archiv)
    fehlt bewusst: ein leeres Archiv hochzuladen ist kein Vorgang, den jemand
    beabsichtigt, und es wäre eine Datei ohne Inhalt in der Mediathek.
    """
    if content[:4] != b"PK\x03\x04":
        return None
    for kennung, mime in _OOXML:
        if kennung in content:
            return mime
    return "application/zip"


#: Prüfer in Reihenfolge. Jeder gibt seinen MIME-Typ zurück oder ``None``.
_PRUEFER = (
    _ist_riff,
    _ist_mp4,
    _ist_zip,
    lambda c: "image/jpeg" if c.startswith(b"\xff\xd8\xff") else None,
    lambda c: "image/png" if c.startswith(b"\x89PNG\r\n\x1a\n") else None,
    lambda c: "video/webm" if c.startswith(b"\x1a\x45\xdf\xa3") else None,
    lambda c: "audio/ogg" if c.startswith(b"OggS") else None,
    lambda c: "application/pdf" if c.startswith(b"%PDF-") else None,
    # MP3 ZULETZT: sein Frame-Sync ist nur zwei Bytes (`FF Ex`) und damit das
    # unspezifischste Muster von allen. Vor JPEG geprüft würde er `FF D8 FF`
    # nicht schlucken (D8 hat die Bits nicht), aber die Reihenfolge soll nicht
    # von dieser Feinheit abhängen.
    _ist_mp3,
)

#: MIME → Medienart. Die Art steht in `site_media.kind`; der Check
#: `site_media_art_passt_zum_mime` (0479) hält beides in der DB zusammen.
DATEI_ARTEN: dict[str, str] = {
    "image/jpeg": "image",
    "image/png": "image",
    "image/webp": "image",
    "video/mp4": "video",
    "video/webm": "video",
    "audio/mpeg": "audio",
    "audio/mp4": "audio",
    "audio/wav": "audio",
    "audio/ogg": "audio",
    "application/pdf": "file",
    "application/zip": "file",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "file",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "file",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "file",
}

#: MIME → Dateiendung für den Bucket-Pfad.
DATEI_ENDUNGEN: dict[str, str] = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
    "application/pdf": "pdf",
    "application/zip": "zip",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
}


def datei_typ(content: bytes) -> tuple[str, str] | None:
    """Der WIRKLICHE Typ einer hochgeladenen Datei: ``(mime, art)``.

    ``None`` heißt: keine der erlaubten Signaturen. Der Aufrufer lehnt dann ab —
    nicht „vielleicht doch". Was wir nicht am Byte erkennen, nehmen wir nicht an
    (fail-closed, Wurzel 5); genau daran scheitern absichtlich ``.txt`` und
    ``.csv``, die keine Signatur haben.
    """
    for pruefer in _PRUEFER:
        mime = pruefer(content)
        if mime is None:
            continue
        art = DATEI_ARTEN.get(mime)
        return (mime, art) if art else None
    return None
