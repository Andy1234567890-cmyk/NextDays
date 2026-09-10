"""Router des produktwissen-Slice — der Chatbot der Marketing-Seite.

ÖFFENTLICH OHNE LOGIN, wie der Support-Chat daneben: ein Interessent hat kein
Konto und soll für eine Frage keines anlegen müssen.

Der Schutz (Wurzel 8) besteht aus vier Teilen:
  1. Pfad unter ``/support/`` → der strenge, fail-closed Rate-Limit-Bucket
     ``public_support`` greift bereits (core/ratelimit_middleware, 20/60/IP).
     Das ist wichtiger als beim Ticket-Endpunkt daneben: hier kostet JEDE
     Anfrage zwei Fremdaufrufe (Embedding + Generierung) und damit echtes
     Geld. Ohne eigenen Bucket wäre der Endpunkt ein Kostenhebel für jeden
     mit einer Schleife.
  2. Längendeckel auf die Frage (Schema, 1000 Zeichen).
  3. Feste Sprachmenge statt Freitext.
  4. Antwortschema ohne Artikelvolltext und ohne Ähnlichkeitswerte — die
     Wissensbasis lässt sich damit nicht abschöpfen.

Der Endpunkt liegt bewusst im Support-Präfix und nicht unter einem eigenen:
Für den Besucher ist es EIN Gespräch, das mit einer Frage beginnt und
gegebenenfalls beim Menschen endet. Ein zweiter Pfad hätte auch einen zweiten
Rate-Limit-Eintrag gebraucht, den niemand pflegt.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from src.core.ki import KiError
from src.core.logging import get_logger

from .dependencies import ProduktwissenServiceDep
from .schemas import SPRACHEN, AntwortAusgabe, FrageEingabe, QuelleAusgabe

log = get_logger("nextdays.produktwissen.router")

router = APIRouter(prefix="/support", tags=["support"])


@router.post("/public/frage", response_model=AntwortAusgabe)
def produktfrage(
    eingabe: FrageEingabe, service: ProduktwissenServiceDep
) -> AntwortAusgabe:
    """Eine Produktfrage aus dem belegten Wissen beantworten.

    Antwortet mit ``uebergeben=true``, wenn nichts Passendes gefunden wurde,
    die Sprache kein Wissen hat oder der KI-Dienst ausfällt. Das ist KEIN
    Fehler, sondern das erwartete Ergebnis für eine Frage, die der Bot nicht
    belegen kann — die Oberfläche bietet dann den Support an.
    """
    if eingabe.sprache not in SPRACHEN:
        # 422 statt stiller Übergabe: eine unbekannte Sprache ist ein Fehler
        # des Aufrufers, kein Wissenslücken-Fall. Still zu übergeben würde den
        # Fehler verstecken, bis jemand fragt, warum der Bot nie antwortet.
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Für diese Sprache liegt kein Produktwissen vor.",
        )

    if not service.is_configured:
        # 503 und nicht 500: „nicht eingerichtet" ist ein Betriebszustand.
        # Die Oberfläche blendet den Bot dann aus, statt einen Knopf zu
        # zeigen, der fehlschlägt.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Der Produktberater ist derzeit nicht verfügbar.",
        )

    try:
        ergebnis = service.antworten(eingabe.frage, sprache=eingabe.sprache)
    except KiError as exc:
        # Spezifisch gefangen (Wurzel 5): der Fremdfehler behält seinen
        # Status — 429 bleibt 429, damit die Oberfläche zum Wiederholen raten
        # darf statt „kaputt" zu melden.
        log.warning("produktfrage_ki_fehler", status=exc.status_code)
        raise HTTPException(
            status_code=exc.status_code, detail=str(exc)
        ) from exc

    return AntwortAusgabe(
        antwort=ergebnis.text,
        quellen=[
            QuelleAusgabe(titel=q.titel, pfad=q.pfad) for q in ergebnis.quellen
        ],
        uebergeben=ergebnis.uebergeben,
    )
