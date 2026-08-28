"""Tests der Medienarten: Upload, Filter, Zähler, Massen-Löschen, Symbole,
Bild-Import per Adresse (0479).

Eigene Datei und nicht weitere 300 Zeilen in ``test_mediathek.py``: dort stehen
Ordner, Verwendung und Stock-Fotos. Hier steht die Frage, die 0479 aufgemacht
hat — die Mediathek trägt fünf Arten, und jede muss richtig erkannt, gedeckelt
und gezählt werden.

Die Fake-DB kommt aus ``test_site_config``: EINE Attrappe für den Slice. Sie
nimmt allerdings jede Spalte an und kennt keinen CHECK-Constraint — was die
Migration 0479 erzwingt (``kind`` passt zum ``mime``), prüft sie NICHT. Diese
Tests prüfen deshalb, dass der DIENST den richtigen Wert schreibt; dass die DB
einen falschen ablehnt, steht in der Migration.
"""
from __future__ import annotations

import pytest

from src.features.site_config import icons, medien, medien_holen
from src.features.site_config.fehler import SiteConfigError
from src.features.site_config.schemas_mediathek import (
    IconImportRequest,
    MediumImportRequest,
)

from .test_mediathek import _PNG, _mit
from .test_site_config import _ctx

# Signaturen, wie sie am Anfang einer echten Datei stehen. Der Rest der Datei
# spielt für die Erkennung keine Rolle — genau das ist der Punkt: erkannt wird
# am KOPF, nicht am Namen.
_MP4 = b"\x00\x00\x00 ftypisom" + b"\x00" * 64
_M4A = b"\x00\x00\x00 ftypM4A " + b"\x00" * 64
_MP3 = b"ID3\x03\x00\x00\x00\x00\x00\x00" + b"\x00" * 64
_WAV = b"RIFF\x24\x00\x00\x00WAVE" + b"\x00" * 64
_PDF = b"%PDF-1.7\n" + b"\x00" * 64
_DOCX = b"PK\x03\x04" + b"x" * 30 + b"word/document.xml" + b"\x00" * 16
_SVG = b'<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'


# === Signaturerkennung =====================================================

@pytest.mark.parametrize(
    ("inhalt", "erwartet"),
    [
        (_PNG, ("image/png", "image")),
        (_MP4, ("video/mp4", "video")),
        (_M4A, ("audio/mp4", "audio")),
        (_MP3, ("audio/mpeg", "audio")),
        (_WAV, ("audio/wav", "audio")),
        (_PDF, ("application/pdf", "file")),
        (
            _DOCX,
            (
                "application/vnd.openxmlformats-officedocument"
                ".wordprocessingml.document",
                "file",
            ),
        ),
    ],
)
def test_signatur_bestimmt_typ_und_art(
    inhalt: bytes, erwartet: tuple[str, str]
) -> None:
    """Die ART kommt aus derselben Prüfung wie der MIME-Typ. Käme sie vom
    Client, läge ein PNG als `kind='video'` im Bestand."""
    assert medien.datei_typ(inhalt) == erwartet


@pytest.mark.parametrize(
    "inhalt",
    [
        b"hallo welt, ich bin nur Text",   # keine Signatur → nicht annehmbar
        _SVG,                              # SVG: Stored-XSS im public Bucket
        b"GIF89a" + b"\x00" * 32,          # bewusst nicht erlaubt
        b"",                               # leer
    ],
)
def test_ohne_erlaubte_signatur_kein_typ(inhalt: bytes) -> None:
    """Fail-closed (Wurzel 5): was wir nicht am Byte erkennen, nehmen wir nicht
    an. Bei `.txt`/`.csv` ist das Absicht — sie HABEN keine Signatur."""
    assert medien.datei_typ(inhalt) is None


# === Upload ================================================================

def test_video_upload_setzt_die_art_und_laesst_masse_leer() -> None:
    """Maße gibt es nur bei Bildern. Für ein Video eine Auflösung zu erfinden
    wäre eine Falschaussage (Wurzel 4) — die Spalten bleiben leer."""
    svc, tabellen = _mit()
    m = svc.add_medium(_ctx(), _MP4, filename="rundgang.mp4")
    assert (m.kind.value, m.mime) == ("video", "video/mp4")
    assert (m.width, m.height) == (None, None)
    # Die Datei liegt bei uns, mit der Endung des ERKANNTEN Typs.
    assert list(svc._db.storage.dateien)[0].endswith(".mp4")  # noqa: SLF001
    assert tabellen["site_media"][0]["kind"] == "video"


def test_dokument_upload_ist_eine_datei() -> None:
    svc, _ = _mit()
    m = svc.add_medium(_ctx(), _PDF, filename="hausordnung.pdf")
    assert (m.kind.value, m.mime) == ("file", "application/pdf")


def test_svg_upload_bleibt_verboten() -> None:
    """Ein SVG im öffentlichen Bucket ist Stored-XSS (Wurzel 8) — auch wenn der
    Client `image/svg+xml` behauptet, was er hier gar nicht kann."""
    svc, tabellen = _mit()
    with pytest.raises(SiteConfigError) as exc:
        svc.add_medium(_ctx(), _SVG, filename="logo.svg")
    assert exc.value.status_code == 415
    assert tabellen["site_media"] == []
    assert svc._db.storage.dateien == {}  # noqa: SLF001


def test_deckel_gilt_JE_ART_und_nicht_pauschal() -> None:
    """20 MB sind für ein Foto großzügig und für ein Video nichts. Ein
    einziger Deckel wäre entweder zu klein oder die Erlaubnis, ein
    200-MB-„Bild" hochzuladen."""
    svc, _ = _mit()
    grosses_bild = _PNG + b"\x00" * (21 * 1024 * 1024)
    with pytest.raises(SiteConfigError) as exc:
        svc.add_medium(_ctx(), grosses_bild)
    assert exc.value.status_code == 413
    # Dieselbe Menge als Video geht durch — der Deckel dort ist 200 MB.
    video = _MP4 + b"\x00" * (21 * 1024 * 1024)
    assert svc.add_medium(_ctx(), video).kind.value == "video"


# === Filter und Zähler =====================================================

def _bestand() -> tuple[object, dict]:
    svc, tabellen = _mit()
    svc.add_medium(_ctx(), _PNG, filename="strand.png")
    svc.add_medium(_ctx(), _MP4, filename="rundgang.mp4")
    svc.add_medium(_ctx(), _PDF, filename="hausordnung.pdf")
    return svc, tabellen


def test_reiter_filtert_nach_art() -> None:
    svc, _ = _bestand()
    assert [m.filename for m in svc.list_media(_ctx(), art="video").items] == [
        "rundgang.mp4"
    ]
    # Ohne `art` kommen ALLE Arten — nicht „nur Bilder".
    assert svc.list_media(_ctx()).total == 3


def test_unbekannte_art_ist_ein_422_und_keine_leere_liste() -> None:
    """Ein stiller Leerbestand sähe wie ein leerer Reiter aus (Wurzel 5)."""
    svc, _ = _bestand()
    with pytest.raises(SiteConfigError) as exc:
        svc.list_media(_ctx(), art="pdf")
    assert exc.value.status_code == 422


def test_uebersicht_zaehlt_je_art_und_herkunft() -> None:
    """Die Zahlen der linken Spalte kommen vom Server. Im Browser gezählt wären
    es die SICHTBAREN (höchstens 200) — plausibel und falsch (Wurzel 4)."""
    svc, _ = _bestand()
    u = svc.media_uebersicht(_ctx())
    assert u.total == 3
    assert u.je_art["image"] == 1
    assert u.je_art["video"] == 1
    assert u.je_art["file"] == 1
    # Alle fünf Arten sind enthalten, auch die leeren: ein fehlender Schlüssel
    # wäre in der Oberfläche ein leerer Platz statt einer Null.
    assert u.je_art["icon"] == 0 and u.je_art["audio"] == 0
    # Herkunft JE ART: die Zahl steht in der Oberfläche unter dem offenen
    # Reiter. Artenübergreifend gezählt stünde „Hochgeladen 3" über einem
    # leeren Symbolbestand — plausibel und falsch (Wurzel 4).
    assert u.hochgeladen_je_art["image"] == 1
    assert u.hochgeladen_je_art["icon"] == 0
    # Kein bezahlter Anbieter scharf → 0, gezählt und nicht hartkodiert.
    assert all(n == 0 for n in u.gekauft_je_art.values())
    assert u.grenze == svc.MEDIA_MAX_COUNT


def test_uebersicht_zaehlt_nur_den_eigenen_betrieb() -> None:
    """Wurzel 3: der Zähler ist ein Datenausgang wie jeder andere."""
    svc, _ = _mit(
        {
            "site_media": [
                {"id": "fremd", "tenant_id": "t-ANDERS", "path": "p", "url": "u",
                 "mime": "image/png", "bytes": 1, "kind": "image"}
            ]
        }
    )
    assert svc.media_uebersicht(_ctx()).total == 0


# === Massen-Löschen ========================================================

def test_massen_loeschen_entfernt_zeilen_und_dateien() -> None:
    svc, tabellen = _bestand()
    ids = [m["id"] for m in tabellen["site_media"]]
    assert svc.remove_media_bulk(_ctx(), ids) == 3
    assert tabellen["site_media"] == []
    assert svc._db.storage.dateien == {}  # noqa: SLF001


def test_fremde_id_in_der_auswahl_loescht_NICHTS() -> None:
    """Der Scope wird für ALLE IDs geprüft, BEVOR die erste Zeile fällt
    (Wurzel 3). Löschen ist der eine Vorgang, den man nicht zurücknimmt."""
    svc, tabellen = _bestand()
    ids = [m["id"] for m in tabellen["site_media"]]
    with pytest.raises(SiteConfigError) as exc:
        svc.remove_media_bulk(_ctx(), [*ids, "fremd-1"])
    assert exc.value.status_code == 404
    assert len(tabellen["site_media"]) == 3
    assert len(svc._db.storage.dateien) == 3  # noqa: SLF001


# === Symbole ===============================================================

_SATZ = {
    "ph": {
        "name": "Phosphor",
        "license": {"title": "MIT", "url": "https://example.org/mit"},
    }
}


def _iconify(monkeypatch: pytest.MonkeyPatch, satz: dict | None = None) -> None:
    """Iconify nachbilden: das Symbol-SVG und die Satz-Angaben."""
    monkeypatch.setattr(
        medien_holen, "datei_holen", lambda *_a, **_k: b"<svg></svg>"
    )
    monkeypatch.setattr(icons, "datei_holen", lambda *_a, **_k: b"<svg></svg>")
    monkeypatch.setattr(
        icons, "_json_holen", lambda *_a, **_k: satz if satz is not None else _SATZ
    )


def test_symbol_wird_hotlink_mit_nachweis(monkeypatch: pytest.MonkeyPatch) -> None:
    """Kein Rehosting: das SVG bleibt bei der Bibliothek (ein SVG in unserem
    öffentlichen Bucket wäre Stored-XSS). Dafür Nachweis + Kennung."""
    _iconify(monkeypatch)
    svc, tabellen = _mit()
    m = svc.import_icon(_ctx(), IconImportRequest(icon="ph:house"))
    assert (m.kind.value, m.mime) == ("icon", "image/svg+xml")
    assert m.url == "https://api.iconify.design/ph/house.svg"
    assert m.credit_name == "Phosphor (MIT)"
    assert m.alt_text == "house"
    assert tabellen["site_media"][0].get("path") is None
    assert svc._db.storage.dateien == {}  # noqa: SLF001


def test_zweite_symbol_uebernahme_legt_nichts_doppelt_an(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Wurzel 2: Doppelklick und Retry kommen real vor."""
    _iconify(monkeypatch)
    svc, tabellen = _mit()
    anfrage = IconImportRequest(icon="ph:house")
    erste = svc.import_icon(_ctx(), anfrage)
    zweite = svc.import_icon(_ctx(), anfrage)
    assert erste.id == zweite.id
    assert len(tabellen["site_media"]) == 1


def test_symbolsatz_ohne_lizenznachweis_wird_nicht_uebernommen(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Fail-closed: ein Symbol, das die Lizenz bricht, sobald es auf einer Seite
    steht, ist kein halber Erfolg."""
    _iconify(monkeypatch, {"ph": {"name": "Phosphor"}})
    svc, tabellen = _mit()
    with pytest.raises(SiteConfigError) as exc:
        svc.import_icon(_ctx(), IconImportRequest(icon="ph:house"))
    assert exc.value.status_code == 502
    assert tabellen["site_media"] == []


@pytest.mark.parametrize("kennung", ["haus", "ph:house:extra", "ph:", ":house"])
def test_kaputte_symbol_kennung_ist_ein_422(kennung: str) -> None:
    """Zu raten (etwa am ersten Doppelpunkt zu trennen) würde eine Adresse
    bauen, hinter der nichts liegt."""
    with pytest.raises(SiteConfigError) as exc:
        icons.zerlegen(kennung)
    assert exc.value.status_code == 422


# === Bild-Import per Adresse ===============================================

def test_import_von_adresse_legt_das_bild_bei_uns_ab(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Anders als beim Stock-Foto wird HIER kopiert: die Datei liegt danach in
    unserem Bucket und zählt gegen die Bestandsgrenze."""
    monkeypatch.setattr(medien_holen, "datei_holen", lambda *_a, **_k: _PNG)
    svc, tabellen = _mit()
    m = svc.import_medium_von_url(
        _ctx(), MediumImportRequest(url="https://example.org/bilder/strand%20a.png")
    )
    assert m.kind.value == "image"
    assert m.source.value == "upload"
    # Anzeigename aus dem letzten Pfadstück, prozentdekodiert.
    assert m.filename == "strand a.png"
    assert tabellen["site_media"][0]["path"].endswith(".png")


def test_import_lehnt_ab_was_kein_bild_ist(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Ein PDF hinter „…/logo.png" wird abgelehnt statt als Datei einsortiert:
    der Vorgang heißt „Bild importieren", und ein stiller Artwechsel wäre die
    Sorte Überraschung, die niemand als Fehler meldet."""
    monkeypatch.setattr(medien_holen, "datei_holen", lambda *_a, **_k: _PDF)
    svc, tabellen = _mit()
    with pytest.raises(SiteConfigError) as exc:
        svc.import_medium_von_url(
            _ctx(), MediumImportRequest(url="https://example.org/logo.png")
        )
    assert exc.value.status_code == 422
    assert tabellen["site_media"] == []
    assert svc._db.storage.dateien == {}  # noqa: SLF001
