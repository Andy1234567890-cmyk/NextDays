"""Was die Versand-API zurueckgibt."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class VersandAusgabe(BaseModel):
    """Das Ergebnis eines Einreichversuchs."""

    # DREIWERTIG, und das ist wesentlich: `null` heisst „unbekannt" —
    # die Antwort der Behoerde kam nicht an. `false` waere die Behauptung,
    # sie habe abgelehnt, und das wissen wir in dem Fall nicht.
    angenommen: bool | None
    quittungsnummer: str | None = None
    # In ganzen Saetzen, direkt anzeigbar. Ein Statuscode allein hilft dem
    # Betrieb nicht, der wissen muss, ob seine Meldung eingereicht ist.
    meldung: str
    # Darf erneut gesendet werden? Bei unbekanntem Ausgang NEIN — erst
    # klaeren, ob die erste Datei ankam (sonst Doppelmeldung).
    wiederholbar: bool
    gesendet_am: datetime
    pruefsumme: str
    # Wohin es ging und ob das die Teststufe war. Steht in JEDER Antwort:
    # Eine Meldung, von der niemand weiss, ob sie an die echte Behoerde
    # ging, ist wertlos.
    ziel: str
    ist_teststufe: bool
    # Ob die Nutzdaten verschluesselt hinausgingen. Der Betrieb muss
    # belegen koennen, WIE uebermittelt wurde — nicht nur, dass es
    # geschah.
    verschluesselt: bool = False
    # Die unveraenderte Antwort der Gegenstelle — im Streitfall der Beleg.
    antwort: dict[str, Any] = Field(default_factory=dict)
