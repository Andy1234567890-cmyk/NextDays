"""Was die Empfangsstelle zurueckgibt."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class BefundAusgabe(BaseModel):
    """Ein Regelverstoss mit Fundort."""

    zeile: int
    zeilentyp: str
    spalte: str
    regel: str
    grund: str
    wert: str = ""


class SchrittAusgabe(BaseModel):
    """Eine Station auf dem Weg der Meldung durch die Stelle.

    WOZU IN DER QUITTUNG: Die Behoerde will nicht nur wissen, DASS die
    Meldung angekommen ist, sondern WIE — wo entschluesselt wurde, woran
    eine Verfaelschung auffaellt, was die einzelnen Schritte kosten. Eine
    Quittung, die nur „angenommen" sagt, beantwortet das nicht.

    `belegt` traegt einen NACHWEIS (Pruefsumme, Schluesselkennung, Zahl),
    nie einen Feldwert der Meldung.
    """

    name: str
    geschafft: bool
    dauer_ms: float
    beschreibung: str
    belegt: str = ""


class QuittungAusgabe(BaseModel):
    """Die Kvittering — was die Behoerde nach einer Einreichung zurueckmeldet."""

    quittungsnummer: str
    empfangen_am: datetime
    format: str
    dateiname: str
    bytes_gesamt: int
    pruefsumme: str
    # Nur eine fehlerfreie Datei gilt als angenommen. Ein „teilweise
    # angenommen" gibt es nicht: die Behoerde nimmt die Meldung als Ganzes.
    angenommen: bool
    zeilen: int
    zeilentypen: dict[str, int] = Field(default_factory=dict)
    fehler: list[BefundAusgabe] = Field(default_factory=list)
    hinweise: list[BefundAusgabe] = Field(default_factory=list)
    # Die uebermittelten Saetze, je Satz die BELEGTEN Spalten. Eine
    # Quittung ohne sie beantwortet nicht, WAS uebermittelt wurde —
    # Pruefsumme und Zeilenzahl allein reichen dafuer nicht.
    saetze: list[dict[str, str]] = Field(default_factory=list)
    # Der Weg dieser Meldung durch die Stelle, Station fuer Station.
    schritte: list[SchrittAusgabe] = Field(default_factory=list)
    # Kam die Meldung als verschluesselter Umschlag?
    verschluesselt: bool = False
    # Der Kopf des Umschlags: Verfahren, Zeitpunkt, Schluesselkennung,
    # Pruefsumme des Klartexts. Keine Feldwerte — er ist auch im Umschlag
    # unverschluesselt, weil die Gegenstelle wissen muss, WOMIT sie
    # oeffnen soll.
    umschlag_kopf: dict = Field(default_factory=dict)


class ProtokollZeile(BaseModel):
    """Eine Zeile der Empfangsuebersicht."""

    quittungsnummer: str
    empfangen_am: datetime
    format: str
    dateiname: str
    angenommen: bool
    zeilen: int
    anzahl_fehler: int
