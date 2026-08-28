"""``content``-Schemas der MEDIEN-Abschnitte (0451).

Medien-Slider, Video, Audio, Vorher/Nachher und die Form. Die Galerie liegt
weiter in ``block_inhalte.py`` — sie ist Bestand seit 0087 und wird dort
ERWEITERT statt hier neu gebaut: ihre Daten stehen auf Kundenseiten, und ein
zweiter Galerie-Typ hätte den Kunden vor die Wahl zwischen zwei fast gleichen
Abschnitten gestellt.

Der Unterschied zu den Basis-Abschnitten (0450) ist einer, der jede Entscheidung
hier bestimmt: **zwei dieser Typen holen etwas von einem FREMDEN Host.** Video
bettet YouTube/Vimeo/Dailymotion ein, Audio bettet SoundCloud/Mixcloud ein.
Daraus folgt:

* Die eingegebene Adresse wird gegen eine **Host-Allowlist** geprüft, und zwar
  BEIM SPEICHERN. Nicht der Renderer entscheidet, was er einbettet — sonst
  stünde eine beliebige Fremdadresse in der Datenbank und wartete auf die erste
  Anzeigestelle, die sie ohne Prüfung ausgibt (Wurzel 8).
* Aus der Adresse wird die **Kennung** herausgelöst und gespeichert. Der
  Renderer setzt daraus seine Einbettungs-Adresse selbst zusammen; er reicht
  NIE die Kundeneingabe in ein `src` durch. Eine Kennung aus `[A-Za-z0-9_-]`
  kann nicht aus dem Attribut ausbrechen, eine freie Adresse schon.
* Die Content-Security-Policy des Renderers muss die Hosts kennen
  (`builder/next.config.ts`, `frameSrc`). Ohne diesen Eintrag bleibt der Rahmen
  LEER — ohne Fehlermeldung, nur mit einer Zeile in der Browser-Konsole. Genau
  daran ist hier schon eine Karte gescheitert.
"""

from __future__ import annotations

import re
from urllib.parse import parse_qs, urlparse

from pydantic import BaseModel, Field, field_validator, model_validator

from .basis import _sanitize_rich_html, _validate_href

# =========================================================================
# Grenzen
# =========================================================================

#: Folien eines Medien-Sliders. Hostaways Zahl („A maximum of 25 slides").
MAX_SLIDER_FOLIEN = 25

#: Bilder einer Galerie. Hostaway nennt die Zahl für den Instagram-Zulauf
#: („displays up to 100 images from your feed"); für die Galerie selbst nennt es
#: keine. Ohne Deckel wäre sie ein unbegrenzter Bereich (Wurzel 8) — und 100
#: Bilder sind bereits mehr, als eine Seite sinnvoll lädt.
MAX_GALERIE_BILDER = 100


# =========================================================================
# Video
# =========================================================================

#: Anbieter → wie die Kennung aussehen darf.
#:
#: Eng gefasst, weil genau dieser Wert im ``src`` eines iframes landet. Ein
#: Zeichen außerhalb dieser Klassen könnte aus dem Attribut ausbrechen; mit
#: dieser Prüfung kann es das nicht (Wurzel 8).
_VIDEO_ID_RE = {
    "youtube": re.compile(r"^[A-Za-z0-9_-]{5,20}$"),
    "vimeo": re.compile(r"^\d{5,15}$"),
    "dailymotion": re.compile(r"^[A-Za-z0-9]{5,20}$"),
}

#: Host (ohne `www.`) → Anbieter.
_VIDEO_HOSTS = {
    "youtube.com": "youtube",
    "m.youtube.com": "youtube",
    "youtube-nocookie.com": "youtube",
    "youtu.be": "youtube",
    "vimeo.com": "vimeo",
    "player.vimeo.com": "vimeo",
    "dailymotion.com": "dailymotion",
    "dai.ly": "dailymotion",
}


def _host_ohne_www(url: str) -> tuple[str, list[str]]:
    """(Host ohne `www.`, Pfadsegmente) einer Adresse."""
    teile = urlparse(url)
    host = (teile.hostname or "").lower().removeprefix("www.")
    return host, [s for s in teile.path.split("/") if s]


def video_kennung(url: str) -> tuple[str, str]:
    """(Anbieter, Kennung) aus einer Video-Adresse — oder ``ValueError``.

    Erkannt werden die Formen, die ein Kunde wirklich in der Hand hat: die
    Adresszeile, der „Teilen"-Link und der Einbettungscode. Was nicht erkannt
    wird, wird ABGELEHNT und nicht geraten — eine falsch geratene Kennung ergäbe
    einen leeren schwarzen Kasten auf der Kundenseite, und niemand käme darauf,
    dass die Adresse schuld ist (Wurzel 4).
    """
    if not url.lower().startswith(("http://", "https://")):
        raise ValueError(
            "Bitte die vollständige Adresse des Videos angeben (https://…)."
        )
    host, pfad = _host_ohne_www(url)
    anbieter = _VIDEO_HOSTS.get(host)
    if not anbieter:
        raise ValueError(
            "Unterstützt werden YouTube, Vimeo und Dailymotion."
        )
    kennung = ""
    if anbieter == "youtube":
        if host == "youtu.be":
            kennung = pfad[0] if pfad else ""
        elif pfad and pfad[0] in ("embed", "shorts", "live", "v"):
            kennung = pfad[1] if len(pfad) > 1 else ""
        else:
            kennung = (parse_qs(urlparse(url).query).get("v") or [""])[0]
    elif anbieter == "vimeo":
        # https://vimeo.com/123456789 und https://player.vimeo.com/video/123456789
        ziffern = [s for s in pfad if s.isdigit()]
        kennung = ziffern[0] if ziffern else ""
    else:
        # https://dailymotion.com/video/x7abc12 und https://dai.ly/x7abc12
        kennung = pfad[-1] if pfad else ""
        # Dailymotion hängt gelegentlich einen Titel an („x7abc12_mein-video").
        kennung = kennung.split("_", 1)[0]
    if not _VIDEO_ID_RE[anbieter].match(kennung):
        raise ValueError(
            "Aus dieser Adresse lässt sich keine Video-Kennung lesen. "
            "Bitte die Adresse aus der Adresszeile des Videos einfügen."
        )
    return anbieter, kennung


class VideoContent(BaseModel):
    """Ein eingebettetes Video (0451).

    ``url`` ist, was der Kunde eintippt. ``provider`` und ``video_id`` entstehen
    daraus BEIM SPEICHERN und sind das, was der Renderer benutzt — er baut die
    Einbettungs-Adresse selbst. Beides zu speichern statt nur die Kennung ist
    Absicht: der Kunde soll im Baukasten wiederfinden, was er eingegeben hat.

    Was Hostaway zusätzlich hat und wir nicht: **hochgeladene Videodateien**
    (dort 100 Dateien à 200 MB je Website). Dafür bräuchte es einen eigenen
    Speicher- und Auslieferungsweg mit Transcodierung; ein 200-MB-`<video>` aus
    dem Bild-Bucket wäre keine Funktion, sondern eine langsame Seite. Der Weg
    dorthin bleibt der: Video zu YouTube/Vimeo, Adresse hier einfügen.

    ``schema_name``/``schema_description``/``schema_upload_date`` erzeugen ein
    `VideoObject`-JSON-LD. Alle drei oder keines — Google verlangt für das Rich
    Result Name, Beschreibung UND Datum, und ein halbes Schema ist ein Verstoß
    gegen seine Richtlinien, nicht ein kleineres Ergebnis.
    """

    url: str | None = None
    # Aus `url` abgeleitet. Vom Client mitgeschickte Werte werden überschrieben.
    provider: str | None = None
    video_id: str | None = None
    headline: dict[str, str] = Field(default_factory=dict)
    # Standbild vor dem Start. Nur bei Direkt-Dateien wirksam; die Anbieter
    # bringen ihr eigenes mit (Hostaway: „the thumbnail is pulled from the
    # YouTube, Vimeo, or DailyMotion settings").
    poster_url: str | None = None
    # Video-Schema (siehe Klassen-Text).
    schema_name: dict[str, str] = Field(default_factory=dict)
    schema_description: dict[str, str] = Field(default_factory=dict)
    schema_upload_date: str | None = Field(default=None, max_length=40)

    _v_poster = field_validator("poster_url")(_validate_href)

    @model_validator(mode="after")
    def _kennung_ableiten(self) -> VideoContent:
        if not (self.url or "").strip():
            # „Noch keine Adresse" ist ein gültiger Zwischenstand. Der Renderer
            # zeigt im Entwurf den Grund an, live nichts.
            self.provider = None
            self.video_id = None
            self.url = None
            return self
        anbieter, kennung = video_kennung(self.url.strip())
        self.provider = anbieter
        self.video_id = kennung
        return self


# =========================================================================
# Audio
# =========================================================================

#: Host (ohne `www.`) → Anbieter. Hostaways beide.
_AUDIO_HOSTS = {
    "soundcloud.com": "soundcloud",
    "m.soundcloud.com": "soundcloud",
    "mixcloud.com": "mixcloud",
}


class AudioContent(BaseModel):
    """Eine eingebettete Audio-Datei oder Wiedergabeliste (0451).

    Anders als beim Video wird hier die ganze ADRESSE gespeichert und nicht eine
    Kennung — beide Anbieter erwarten in ihrem Widget genau das (`?url=…` bzw.
    `?feed=…`). Sie ist deshalb auf Host UND Form geprüft, und der Renderer
    kodiert sie beim Einsetzen (`encodeURIComponent`).

    Kein Upload eigener Dateien, und Hostaway hat dort ebenfalls nur den Umweg:
    „Upload your audio file to one of these services … copy the link".
    """

    url: str | None = None
    provider: str | None = None
    headline: dict[str, str] = Field(default_factory=dict)
    # Mixcloud kann hell oder dunkel; SoundCloud nicht. Der Renderer reicht es
    # nur dort durch, wo es wirkt — ein Schalter ohne Wirkung wäre eine Attrappe.
    dark: bool = False

    @model_validator(mode="after")
    def _anbieter_ableiten(self) -> AudioContent:
        roh = (self.url or "").strip()
        if not roh:
            self.url = None
            self.provider = None
            return self
        if not roh.lower().startswith(("http://", "https://")):
            raise ValueError("Bitte die vollständige Adresse angeben (https://…).")
        host, pfad = _host_ohne_www(roh)
        anbieter = _AUDIO_HOSTS.get(host)
        if not anbieter:
            raise ValueError("Unterstützt werden SoundCloud und Mixcloud.")
        if not pfad:
            raise ValueError(
                "Diese Adresse zeigt auf die Startseite des Dienstes, nicht auf "
                "eine Aufnahme."
            )
        self.provider = anbieter
        self.url = roh
        return self


# =========================================================================
# Medien-Slider
# =========================================================================


class SliderFolie(BaseModel):
    """Eine Folie: Medium, Text, Knopf.

    ``video_url`` ist eine DIREKTE Videodatei (mp4/webm) und keine
    YouTube-Adresse: die Folie zeigt das Medium als Hintergrund, stumm und in
    Schleife. Ein YouTube-iframe kann das nicht — es bringt seine eigene
    Oberfläche mit und lässt sich nicht als Hintergrund verwenden. Wer ein
    YouTube-Video zeigen will, nimmt den Video-Abschnitt.
    """

    image_url: str | None = None
    video_url: str | None = None
    alt: dict[str, str] = Field(default_factory=dict)
    title: dict[str, str] = Field(default_factory=dict)
    text: dict[str, str] = Field(default_factory=dict)
    cta_label: dict[str, str] = Field(default_factory=dict)
    cta_href: str | None = None

    _v_image = field_validator("image_url")(_validate_href)
    _v_video = field_validator("video_url")(_validate_href)
    _v_cta = field_validator("cta_href")(_validate_href)


class MediaSliderContent(BaseModel):
    """Bild-/Video-Slider (0451). Höchstens 25 Folien — Hostaways Zahl.

    ``autoplay_seconds`` liegt zwischen 1 und 20, ebenfalls Hostaways Bereich
    („Move the slider to select a speed between 1 and 20 seconds"). ``0`` heißt
    AUS und ist der Default: ein Slider, der von selbst weiterläuft, während
    jemand liest, ist die häufigste Beschwerde über Slider überhaupt — und wer
    ihn will, schaltet ihn ein.
    """

    slides: list[SliderFolie] = Field(
        default_factory=list, max_length=MAX_SLIDER_FOLIEN
    )
    headline: dict[str, str] = Field(default_factory=dict)
    autoplay_seconds: int = Field(default=0, ge=0, le=20)
    # "fade" | "slide" — Hostaways beide.
    transition: str = "slide"
    # Bei Autoplay: anhalten, solange der Zeiger auf dem Slider steht.
    pause_on_hover: bool = True
    # Dunkle Auflage über dem Medium, damit heller Text lesbar bleibt. Derselbe
    # Regler wie beim Abschnitts-Hintergrund (0432) und aus demselben Grund.
    overlay: float = Field(default=0.35, ge=0, le=0.9)

    @field_validator("transition")
    @classmethod
    def _uebergang(cls, v: str) -> str:
        if v not in ("slide", "fade"):
            raise ValueError("Übergang: 'slide' oder 'fade'.")
        return v


# =========================================================================
# Vorher / Nachher
# =========================================================================


class BeforeAfterContent(BaseModel):
    """Zwei Bilder mit Schieberegler dazwischen (0451).

    Für den einen Fall, den eine Unterkunfts-Website wirklich hat: die
    Renovierung. „So sah das Haus 2019 aus, so sieht es heute aus" ist eine
    Aussage, die zwei nebeneinander gestellte Bilder nicht so gut treffen.

    Beide Bilder sind Pflicht in der WIRKUNG — fehlt eines, zeigt der Renderer
    den Abschnitt nicht. Kein Ein-Bild-Rückfall: ein Vergleich mit einem Bild
    ist kein Vergleich.
    """

    before_url: str | None = None
    after_url: str | None = None
    before_label: dict[str, str] = Field(default_factory=dict)
    after_label: dict[str, str] = Field(default_factory=dict)
    before_alt: dict[str, str] = Field(default_factory=dict)
    after_alt: dict[str, str] = Field(default_factory=dict)
    headline: dict[str, str] = Field(default_factory=dict)

    _v_before = field_validator("before_url")(_validate_href)
    _v_after = field_validator("after_url")(_validate_href)


# =========================================================================
# Form
# =========================================================================

#: Die Formen, die der Renderer kennt. Feste Liste und kein freies Feld: ein
#: Name, den das CSS nicht kennt, ergäbe eine unsichtbare Fläche, und niemand
#: käme darauf, dass er sich vertippt hat (dieselbe Begründung wie beim
#: Symbol-Feld der Merkmale).
SHAPE_FORMEN: tuple[str, ...] = (
    "circle", "square", "rounded", "diamond", "hexagon", "blob", "flag",
)


class ShapeContent(BaseModel):
    """Eine hervorgehobene Fläche mit Text (0451).

    Hostaway verkauft das Shape-Widget als frei platzierbares Gestaltungselement
    mit negativen Rändern, Schwebe-Position und Überlappung. **Das bauen wir
    nicht**, und die Begründung steht im Kopf des Abschnitts-Katalogs: eine
    Seite ist hier eine geordnete Liste von Abschnitten, kein freies Canvas.
    Negative Ränder und „floating" gäben dem Kunden ein Werkzeug, mit dem er
    seine eigene Seite zerlegen kann — auf dem Telefon zuerst.

    Was bleibt, ist der Zweck, den Hostaway zuerst nennt: „highlight important
    messages … call out awards, and highlight sale prices". Dafür braucht es
    eine Fläche, eine Form, einen Text und optional einen Link.
    """

    shape: str = "circle"
    title: dict[str, str] = Field(default_factory=dict)
    text: dict[str, str] = Field(default_factory=dict)
    href: str | None = None
    image_url: str | None = None
    # Ausrichtung des Abschnitts: links, mittig, rechts.
    align: str = "center"

    _v_href = field_validator("href")(_validate_href)
    _v_image = field_validator("image_url")(_validate_href)
    _v_text = field_validator("text")(_sanitize_rich_html)

    @field_validator("shape")
    @classmethod
    def _form(cls, v: str) -> str:
        if v not in SHAPE_FORMEN:
            raise ValueError(f"Unbekannte Form: {v}")
        return v

    @field_validator("align")
    @classmethod
    def _ausrichtung(cls, v: str) -> str:
        if v not in ("left", "center", "right"):
            raise ValueError("Ausrichtung: 'left', 'center' oder 'right'.")
        return v
