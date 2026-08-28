"""``content``-Schemas der BUSINESS-Abschnitte (0452).

Öffnungszeiten, Anruf-Knopf, E-Mail-Knopf und mehrere Standorte.

Was diese vier verbindet und von den anderen Gruppen unterscheidet: sie zeigen
**Betriebsdaten**, keine Gestaltung. Genau deshalb ist bei dreien das Feld
LEER der Normalfall — dann gilt, was im Firmenprofil steht (`/konto`).
Derselbe Grundsatz wie beim Kontakt- und beim Karten-Abschnitt: wer seine
Telefonnummer im Konto pflegt, soll sie nicht auf jeder Seite abtippen, und
wer sie dort ändert, soll sie nicht an vier Stellen nachziehen müssen.

Was hier BEWUSST nicht steht:

* **Kein „nächstgelegener Standort"-Knopf.** Hostaway hat ihn, und er braucht
  zweierlei: die Koordinaten jedes Standorts (dort über den Kartendienst HERE
  ermittelt) und die Position des Gastes. Wir führen zu einem Standort eine
  ANSCHRIFT, keine Koordinaten — die Entfernung ließe sich also nur nach einem
  Geocoding-Aufruf je Standort und Seitenansicht berechnen. Ein Knopf, der
  stattdessen irgendeine Reihenfolge behauptet, wäre eine Falschaussage
  (Wurzel 4). Der Weg zum Standort führt weiterhin über den Karten-Link.
* **Keine Wochentags- und Uhrzeit-Namen in den Daten.** Der Renderer bildet
  beides mit `Intl.DateTimeFormat` aus der Sprache der Seite. Eine eigene
  Liste „Montag … Sonntag" in 24 Sprachen wäre eine Übersetzungsbaustelle für
  etwas, das jeder Browser besser kann — samt der Frage, ob die Woche am
  Montag oder am Sonntag beginnt.
"""

from __future__ import annotations

import re

from pydantic import BaseModel, Field, field_validator, model_validator

from .basis import _validate_href

#: Standorte eines Betriebs. Hostaway nennt keine Zahl; ohne Deckel wäre die
#: Liste ein unbegrenzter Bereich (Wurzel 8).
MAX_STANDORTE = 20

#: Ausnahmetage (Feiertage, Betriebsferien). Ein Jahr Feiertage plus Reserve.
MAX_SONDERTAGE = 30

#: Wie viele Tage im Voraus ein Ausnahmetag angezeigt wird. Hostaways Regel:
#: „Special days and holidays will not show up on the widget until the
#: scheduled day is within 13 days."
#:
#: Übernommen und nicht durch eine eigene Zahl ersetzt, weil die Begründung
#: dahinter stimmt: ein Hinweis „am 24.12. geschlossen", der im März auf der
#: Seite steht, ist kein Hinweis, sondern Rauschen. Die Zahl steht HIER und
#: nicht im Renderer, damit sie auffindbar bleibt.
SONDERTAG_VORLAUF_TAGE = 13

#: `HH:MM` im 24-Stunden-Format. Gespeichert wird IMMER so — wie es angezeigt
#: wird (12 oder 24 Stunden), entscheidet `clock_24h` beim Rendern. Zwei
#: Formate in den Daten wären zwei Wahrheiten über dieselbe Uhrzeit.
_ZEIT_RE = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")

#: Datum eines Ausnahmetags: `JJJJ-MM-TT`. Kein `date`-Typ, weil der Wert durch
#: jsonb geht und dort ohnehin als Zeichenkette liegt — ein Typ, der beim
#: Speichern und beim Lesen verschieden aussieht, ist eine Fehlerquelle.
_DATUM_RE = re.compile(r"^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$")

#: Telefonnummer: Ziffern, Leerzeichen, `+`, `/`, `-`, `(`, `)`.
#:
#: Eng, weil der Wert in einem `tel:`-Link landet. Ohne diese Prüfung stünde
#: dort beliebiger Text — im besten Fall ein Link, der nichts tut, im
#: schlechteren einer, der etwas anderes wählt, als danebensteht.
_TEL_RE = re.compile(r"^[+0-9][0-9 /()\-.]{2,30}$")


def _telefon(value: str | None) -> str | None:
    """Telefonnummer prüfen. Leer = „aus dem Firmenprofil"."""
    if value is None:
        return None
    v = value.strip()
    if not v:
        return None
    if not _TEL_RE.match(v):
        raise ValueError(
            "Bitte eine Telefonnummer angeben — Ziffern, Leerzeichen und "
            "+ ( ) - sind erlaubt. Für das Ausland mit + und Landesvorwahl."
        )
    return v


def _email(value: str | None) -> str | None:
    """E-Mail prüfen. Eine Adresse, keine Liste — dieselbe Regel wie beim
    Formular-Empfänger."""
    if value is None:
        return None
    v = value.strip()
    if not v:
        return None
    if "@" not in v or " " in v or "," in v:
        raise ValueError("Bitte eine einzelne E-Mail-Adresse angeben.")
    return v


# =========================================================================
# Öffnungszeiten
# =========================================================================


class OeffnungsZeit(BaseModel):
    """Ein Zeitfenster: von — bis.

    Mehrere je Tag sind ausdrücklich vorgesehen: Mittagspause ist der
    Normalfall in der Gastronomie, und „11:30–14:00, 17:30–22:00" in ein Feld
    zu tippen wäre eine Zeichenkette, die niemand mehr auswerten kann."""

    von: str
    bis: str

    @field_validator("von", "bis")
    @classmethod
    def _zeit(cls, v: str) -> str:
        if not _ZEIT_RE.match((v or "").strip()):
            raise ValueError("Uhrzeit bitte als HH:MM angeben (z. B. 09:00).")
        return v.strip()

    @model_validator(mode="after")
    def _reihenfolge(self) -> OeffnungsZeit:
        """`bis` darf VOR `von` liegen — das ist die Nachtbar, die um 22:00
        öffnet und um 03:00 schließt. Was nicht geht, ist ein Fenster von null
        Länge: es sagt weder „offen" noch „zu"."""
        if self.von == self.bis:
            raise ValueError("Öffnung und Schließung sind dieselbe Uhrzeit.")
        return self


class OeffnungsTag(BaseModel):
    """Ein Wochentag. ``day``: 0 = Montag … 6 = Sonntag (ISO-Reihenfolge).

    ``mode`` statt „offen ja/nein": Hostaway führt genau diese vier Zustände,
    und sie sind wirklich verschieden. „Geschlossen" und „nur nach
    Vereinbarung" sehen für den Gast völlig anders aus, und beide als leere
    Zeitliste zu speichern hieße, ihm die Unterscheidung zu nehmen."""

    day: int = Field(ge=0, le=6)
    # "hours" | "closed" | "open24" | "appointment"
    mode: str = "hours"
    times: list[OeffnungsZeit] = Field(default_factory=list, max_length=4)

    @field_validator("mode")
    @classmethod
    def _modus(cls, v: str) -> str:
        if v not in ("hours", "closed", "open24", "appointment"):
            raise ValueError(
                "Zustand: 'hours', 'closed', 'open24' oder 'appointment'."
            )
        return v

    @model_validator(mode="after")
    def _zeiten_passen_zum_modus(self) -> OeffnungsTag:
        """Ein Tag mit `mode='hours'` und ohne Zeitfenster wäre eine leere
        Zeile auf der Website — der Gast liest „Montag" und dahinter nichts.
        Das ist keine Angabe, sondern ein halb ausgefülltes Formular, und der
        Betrieb erfährt es sonst nie (Wurzel 5)."""
        if self.mode == "hours" and not self.times:
            raise ValueError(
                "Für diesen Tag fehlt die Uhrzeit. Ohne Zeiten bitte "
                "'geschlossen', 'durchgehend' oder 'nach Vereinbarung' wählen."
            )
        if self.mode != "hours":
            # Zeiten neben „geschlossen" wären eine zweite, widersprüchliche
            # Aussage. Sie werden verworfen und nicht zusätzlich gezeigt.
            self.times = []
        return self


class SonderTag(BaseModel):
    """Ein Ausnahmetag: Feiertag, Betriebsferien, verkürzter Tag."""

    date: str
    mode: str = "closed"
    times: list[OeffnungsZeit] = Field(default_factory=list, max_length=4)
    label: dict[str, str] = Field(default_factory=dict)

    @field_validator("date")
    @classmethod
    def _datum(cls, v: str) -> str:
        if not _DATUM_RE.match((v or "").strip()):
            raise ValueError("Datum bitte als JJJJ-MM-TT angeben.")
        return v.strip()

    @field_validator("mode")
    @classmethod
    def _modus(cls, v: str) -> str:
        if v not in ("hours", "closed", "open24", "appointment"):
            raise ValueError(
                "Zustand: 'hours', 'closed', 'open24' oder 'appointment'."
            )
        return v


class BusinessHoursContent(BaseModel):
    """Öffnungszeiten (0452).

    Auf einer Unterkunfts-Website sind das meist die Zeiten der REZEPTION oder
    des Büros — deshalb eine Überschrift, die der Betrieb selbst setzt, und
    kein festes „Öffnungszeiten".

    ``combine_identical`` fasst aufeinanderfolgende Tage mit gleichen Zeiten
    zusammen („Mo–Fr 09:00–17:00"). An, weil sieben Zeilen mit demselben Inhalt
    schwerer zu lesen sind als eine — Hostaway bietet dasselbe an.
    """

    headline: dict[str, str] = Field(default_factory=dict)
    days: list[OeffnungsTag] = Field(default_factory=list, max_length=7)
    special_days: list[SonderTag] = Field(
        default_factory=list, max_length=MAX_SONDERTAGE
    )
    # Erster Tag der Woche: 0 = Montag, 6 = Sonntag. In den meisten EU-Ländern
    # der Montag; in Portugal und Irland beginnt die Woche üblicherweise am
    # Sonntag. Deshalb ein Feld und keine Ableitung aus der Sprache: es ist eine
    # Entscheidung des Betriebs, nicht des Lesers.
    week_start: int = Field(default=0, ge=0, le=6)
    clock_24h: bool = True
    combine_identical: bool = True

    @model_validator(mode="after")
    def _jeder_tag_hoechstens_einmal(self) -> BusinessHoursContent:
        """Zwei Einträge für denselben Wochentag wären zwei widersprüchliche
        Aussagen; der Renderer zeigte eine davon, und welche, wäre Zufall."""
        tage = [d.day for d in self.days]
        if len(tage) != len(set(tage)):
            raise ValueError("Ein Wochentag steht doppelt in der Liste.")
        datumswerte = [s.date for s in self.special_days]
        if len(datumswerte) != len(set(datumswerte)):
            raise ValueError("Ein Ausnahmetag steht doppelt in der Liste.")
        return self


# =========================================================================
# Anruf-Knopf / E-Mail-Knopf
# =========================================================================


class ClickToCallContent(BaseModel):
    """Anruf-Knopf (0452).

    ``phone`` leer = die Nummer aus dem Firmenprofil.

    Hostaway empfiehlt, diesen Knopf NUR in der mobilen Fassung zu zeigen —
    „most desktop computers and tablets" können mit `tel:` nichts anfangen.
    Wir zeigen ihn überall, und zwar aus einem Grund, den es dort nicht gibt:
    seit 0448/0449 kann JEDER Abschnitt je Gerät ausgeblendet werden. Wer ihn
    nur mobil will, schaltet ihn dort ab — das ist dieselbe Bedienung wie bei
    allen anderen Abschnitten, statt einer Sonderregel an diesem einen.
    """

    phone: str | None = None
    label: dict[str, str] = Field(default_factory=dict)
    # Die Nummer zusätzlich als Text zeigen. An, weil ein Gast am Rechner sie
    # sonst nicht abschreiben kann — genau der Fall, für den Hostaway rät,
    # „display the email address" (dort für den E-Mail-Knopf).
    show_number: bool = True

    _v_phone = field_validator("phone")(_telefon)


class ClickToEmailContent(BaseModel):
    """E-Mail-Knopf (0452).

    ``email`` leer = die Adresse aus dem Firmenprofil.

    Hostaway schreibt an dieser Stelle die Warnung dazu, die auch hier gilt:
    „This email address added to the button is not hidden and can be collected
    by anyone visiting the page." Eine Verschleierung wäre keine Lösung —
    sie hält keinen Sammler auf und bricht die Bedienung für alle, die kein
    JavaScript ausführen. Wer keine Adresse zeigen will, nimmt den
    Formular-Abschnitt.
    """

    email: str | None = None
    label: dict[str, str] = Field(default_factory=dict)
    # Vorbelegter Betreff. Fehlt er, entfällt der Parameter — kein erfundenes
    # „Anfrage über die Website" (Wurzel 4).
    subject: dict[str, str] = Field(default_factory=dict)
    show_address: bool = True

    _v_email = field_validator("email")(_email)


# =========================================================================
# Mehrere Standorte
# =========================================================================


class Standort(BaseModel):
    """Ein Standort: Name, Anschrift, Zusatz, Telefon, Link.

    Die Anschrift ist EINSPRACHIG. Eine Straße wird nicht übersetzt — und wo
    ein Ort zwei amtliche Namen hat, entscheidet der Betrieb, welcher auf
    seiner Website steht.
    """

    name: dict[str, str] = Field(default_factory=dict)
    address: str | None = Field(default=None, max_length=300)
    info: dict[str, str] = Field(default_factory=dict)
    phone: str | None = None
    href: str | None = None
    show_call: bool = True

    _v_phone = field_validator("phone")(_telefon)
    _v_href = field_validator("href")(_validate_href)


class MultiLocationContent(BaseModel):
    """Mehrere Standorte (0452).

    Für den Fall, den eine Ferienhausverwaltung wirklich hat: zwei oder drei
    Büros an der Küste, jedes mit eigener Anschrift und eigener Nummer. Der
    Karten-Abschnitt (`map`) zeigt EINEN Ort auf einer Karte; hier steht eine
    LISTE, und jeder Eintrag verlinkt in die Karten-App des Gastes.

    Kein „nächstgelegener Standort"-Knopf — die Begründung steht im Kopf dieser
    Datei.
    """

    headline: dict[str, str] = Field(default_factory=dict)
    items: list[Standort] = Field(default_factory=list, max_length=MAX_STANDORTE)
    # Spalten auf dem Desktop. Wie bei den Merkmalen: bei fünf sind die
    # Anschriften unlesbar schmal.
    columns: int = Field(default=3, ge=1, le=4)
