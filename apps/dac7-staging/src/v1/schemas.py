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


class ProtokollZeile(BaseModel):
    """Eine Zeile der Empfangsuebersicht."""

    quittungsnummer: str
    empfangen_am: datetime
    format: str
    dateiname: str
    angenommen: bool
    zeilen: int
    anzahl_fehler: int
