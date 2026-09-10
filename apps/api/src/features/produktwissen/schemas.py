"""Schemata des produktwissen-Slice.

Der Endpunkt ist ÖFFENTLICH (kein Login) — die Schemata sind deshalb der Ort,
an dem Fremdeingabe zuerst begrenzt wird, nicht erst der Service.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from .service import MAX_FRAGE_ZEICHEN

#: Die Sprachen, in denen Wissen abgelegt ist — dieselbe Liste wie die
#: Sprachordner unter `marketing/content/help/`. Als feste Menge statt
#: Freitext, weil ein Tippfehler sonst still eine leere Trefferliste ergibt
#: und der Bot ohne erkennbaren Grund an den Support übergibt (Wurzel 4).
SPRACHEN = (
    "bg", "cs", "da", "de", "el", "en", "es", "et", "fi", "fr", "ga", "hr",
    "hu", "it", "lt", "lv", "mt", "nl", "pl", "pt", "ro", "sk", "sl", "sv",
)


class FrageEingabe(BaseModel):
    """Was ein Besucher fragt."""

    frage: str = Field(min_length=2, max_length=MAX_FRAGE_ZEICHEN)
    # Kein Default auf 'de': welche Sprache der Besucher sieht, weiß nur das
    # Frontend. Ein stiller Ersatzwert würde einem dänischen Besucher deutsche
    # Quellen unterschieben.
    sprache: str = Field(min_length=2, max_length=5)


class QuelleAusgabe(BaseModel):
    """Ein Wissensstück, auf das sich die Antwort stützt.

    Bewusst OHNE `inhalt`: der volle Artikeltext ist die Prompt-Grundlage,
    nicht die Antwort. Der Besucher bekommt Titel und Pfad zum Nachlesen.
    Die Ähnlichkeit ist ebenfalls nicht dabei — sie ist eine interne Kennzahl,
    für den Besucher bedeutungslos und für einen Angreifer ein Messwerkzeug,
    mit dem sich die Wissensbasis kartieren lässt.
    """

    titel: str
    pfad: str | None


class AntwortAusgabe(BaseModel):
    """Die Antwort des Bots.

    ``uebergeben=True`` heißt: der Bot konnte es nicht belegt beantworten,
    die Oberfläche soll den Weg zum Support anbieten. ``antwort`` ist dann
    leer — es gibt bewusst keinen Ersatztext aus dem Backend, weil die
    Formulierung („Ich frage den Support für Sie") in die Sprachdateien des
    Frontends gehört und nicht in die API.
    """

    antwort: str
    quellen: list[QuelleAusgabe]
    uebergeben: bool
