"""Alt-Text aus einem Bild erzeugen — mit dem Bild, nicht mit dem Dateinamen.

Das ist die einzige KI-Funktion des Baukastens, die etwas HERUNTERLÄDT, und
damit die einzige mit einem eigenen Angriffsvektor. Sie steht deshalb in einem
eigenen Modul, nicht zwischen den Textfunktionen.

**Warum ein Download nötig ist.** Vertex AI nimmt Bilder als ``gs://``-Adresse
oder als eingebettete Bytes. Eine öffentliche ``https``-Adresse akzeptiert die
API nicht — sie würde sie nicht selbst abrufen. Wir müssen das Bild also selbst
holen und mitschicken.

**Was daran gefährlich ist.** Die Adresse steht in ``site_media.url``. Im
Normalfall zeigt sie auf unseren eigenen Speicher. Seit den Stockfotos (0461)
kann sie auf einen fremden Anbieter zeigen, und in beiden Fällen ist sie eine
Zeile in der Datenbank — also potenziell etwas, das jemand dorthin geschrieben
hat. Ein Server, der eine beliebige Adresse abruft, ist ein SSRF-Vektor:
``http://169.254.169.254/latest/meta-data/`` und unser Server holt die
Cloud-Zugangsdaten.

Deshalb dreifach abgesichert. Die ersten zwei Riegel stehen in
``medien_holen.datei_holen`` (gemeinsam mit dem Bild-Import per Adresse, 0479),
das darunter ``core.ausgehende_url`` benutzt (Wurzel 8):

1. **IP-Prüfung + Pinnen.** Jede aufgelöste Adresse muss öffentlich sein, und
   verbunden wird mit genau der geprüften IP — nicht erneut über den Namen
   (DNS-Rebinding).
2. **Byte-Deckel beim Streamen.** Abgebrochen wird WÄHREND des Lesens, nicht
   danach: ein ``Content-Length``-Header ist eine Behauptung der Gegenseite.
3. **Magic-Byte-Prüfung.** Was ankommt, muss wirklich ein Bild sein — der
   ``Content-Type`` der Gegenseite ist wieder nur eine Behauptung. Dieselbe
   Prüfung wie beim Upload (``medien.bild_typ``).
"""

from __future__ import annotations

import base64

from pydantic import BaseModel, Field
from supabase import Client

from src.core.ki import KiAntwort, KiError, VertexClient
from src.core.languages import sprach_name
from src.core.logging import get_logger

from .fehler import SiteConfigError
from .medien import bild_typ
from .medien_holen import datei_holen

log = get_logger("nextdays.site_config.ki_bild")

# Wie viele Bytes ein Bild höchstens haben darf, das an das Modell geht.
# 6 MB sind großzügig für ein Webfoto; Vertex nimmt eingebettete Nutzlasten bis
# etwa 20 MB je Anfrage, und base64 bläht um ein Drittel auf.
MAX_BILD_BYTES = 6 * 1024 * 1024

# Timeout für den Download. Kürzer als der Modellaufruf: ein Bild, das nach
# 15 Sekunden nicht da ist, kommt nicht mehr.
_DOWNLOAD_TIMEOUT = 15.0

# Wie lang ein Alt-Text sein soll. Screenreader lesen ihn am Stück vor;
# Empfehlung der WAI ist „kurz“. 125 Zeichen ist die Zahl, ab der die
# gängigen Prüfwerkzeuge (WAVE, axe) meckern.
ALT_TEXT_MAX = 125


class AltTextRequest(BaseModel):
    medium_id: str = Field(min_length=1, max_length=64)
    sprache: str = Field(min_length=2, max_length=8)


class AltTextAntwort(BaseModel):
    alt_text: str
    modell: str
    region: str
    warnungen: list[str] = Field(default_factory=list)
    verbrauch_heute: int = 0
    tageslimit: int = 0


def _bild_holen(url: str) -> tuple[bytes, str]:
    """Bild sicher herunterladen. Rückgabe: (Bytes, echter MIME-Typ).

    Der Download selbst steht in ``medien_holen`` — dieselbe Prüfung benutzt der
    Bild-Import per Adresse (0479). Eine zweite Fassung hier wäre die Kopie
    einer Sicherheitsprüfung, und die wird bekanntlich nur in einer der beiden
    geflickt (siehe ``core.ausgehende_url``).

    Was HIER bleibt, ist die Frage, was angekommen sein muss: an das Modell geht
    nur, was die Signatur als Bild ausweist — der ``Content-Type`` der
    Gegenseite ist eine Behauptung (Wurzel 8).
    """
    inhalt = datei_holen(url, max_bytes=MAX_BILD_BYTES, zweck="Das Bild")
    typ = bild_typ(inhalt)
    if not typ:
        raise SiteConfigError(
            "Diese Datei ist kein Bild (JPEG, PNG oder WebP).", status_code=422
        )
    return inhalt, typ


def _medium_lesen(db: Client, tenant_id: str, medium_id: str) -> dict:
    """Ein Medium tenant-gescoped laden (Wurzel 3).

    Load und Scope in EINER Abfrage — ein ungescopter Load mit anschließendem
    Vergleich ist der Weg, auf dem der Vergleich vergessen wird.
    """
    zeilen = (
        db.table("site_media")
        .select("id, url, filename, mime")
        .eq("id", medium_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    if not zeilen:
        raise SiteConfigError("Bild gehört nicht zu diesem Konto.", status_code=404)
    return zeilen[0]


def alt_text_erzeugen(
    client: VertexClient, db: Client, tenant_id: str, req: AltTextRequest
) -> tuple[str, KiAntwort, list[str]]:
    """Alt-Text für ein Bild der Mediathek.

    Der Text geht in ``site_media.alt_text`` — das Feld gehört der Mediathek
    (0460) und wird von dort geschrieben. Hier entsteht nur der Inhalt; die
    Herkunft landet in ``site_media.alt_text_origin`` (0463).

    Anders als bei den Textfunktionen steht hier KEIN Betriebskontext im
    Prompt. Das ist Absicht: ein Alt-Text beschreibt, was auf dem Bild zu
    sehen ist. Gäbe man dem Modell die Objektdaten dazu, schriebe es
    „Doppelzimmer mit Meerblick, 24 m²“ unter ein Foto vom Frühstückstisch —
    und niemand, der auf den Alt-Text angewiesen ist, könnte das prüfen.
    """
    sprache = sprach_name(req.sprache)
    if not sprache:
        raise SiteConfigError(f"Unbekannte Sprache: {req.sprache}", status_code=422)
    medium = _medium_lesen(db, tenant_id, req.medium_id)
    url = medium.get("url")
    if not url:
        raise SiteConfigError(
            "Zu diesem Eintrag ist keine Bildadresse hinterlegt.", status_code=422
        )
    inhalt, typ = _bild_holen(str(url))

    system = "\n".join(
        [
            f"Schreibe ausschließlich auf {sprache}.",
            "",
            "Du schreibst einen Alternativtext für ein Bild auf einer Website. "
            "Er wird Menschen vorgelesen, die das Bild nicht sehen können.",
            f"Höchstens {ALT_TEXT_MAX} Zeichen, ein Satz, kein Punkt am Ende "
            "nötig.",
            "Beschreibe NUR, was tatsächlich zu sehen ist. Keine Vermutungen "
            "über Ort, Namen, Preise, Größe oder Jahreszeit. Keine Wertungen "
            "(„gemütlich“, „traumhaft“).",
            "Beginne NICHT mit „Bild von“, „Foto von“ oder „Darstellung von“ — "
            "dass es ein Bild ist, weiß der Screenreader bereits.",
            "Gib nur den Text zurück, ohne Anführungszeichen.",
        ]
    )
    payload_teile = [
        {"inlineData": {"mimeType": typ, "data": base64.b64encode(inhalt).decode()}},
        {"text": "Beschreibe dieses Bild als Alternativtext."},
    ]
    antwort = client.erzeuge_multimodal(
        system=system, teile=payload_teile, temperature=0.2, max_tokens=200
    )
    text = antwort.text.strip().strip('"„“').strip()
    if not text:
        raise KiError("Die KI hat keinen Alternativtext geliefert.")
    warnungen: list[str] = []
    if len(text) > ALT_TEXT_MAX:
        # Melden, nicht kappen: ein bei 125 Zeichen abgeschnittener Satz endet
        # mitten im Wort und wird genau so vorgelesen.
        warnungen.append(
            f"Der Alternativtext ist {len(text)} Zeichen lang; empfohlen sind "
            f"höchstens {ALT_TEXT_MAX}."
        )
    log.info(
        "ki_alt_text",
        tenant_id=tenant_id,
        medium_id=req.medium_id,
        bytes=len(inhalt),
        typ=typ,
        zeichen=len(text),
    )
    return text, antwort, warnungen
