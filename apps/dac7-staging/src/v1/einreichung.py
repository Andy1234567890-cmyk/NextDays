"""Einreichung einer DAC7-Meldung bei der simulierten Empfangsstelle.

Der Weg entspricht dem bei TastSelv Erhverv: Datei hochladen, Pruefung
abwarten, Quittung erhalten. Angenommen wird nur eine fehlerfreie Datei.

ERZWUNGENE FEHLERFAELLE
=======================
Ueber den Kopf `X-Staging-Verhalten` laesst sich die Gegenstelle gezielt
zum Ablehnen bringen. Das ist der eigentliche Wert einer Teststufe: Der
GUTFALL laesst sich auch gegen die echte Behoerde einmal im Jahr pruefen —
der Fehlerpfad nicht, denn niemand reicht absichtlich eine kaputte
Steuermeldung ein.

Ohne diesen Schalter bliebe ungetestet, was passiert, wenn die Behoerde
nicht antwortet, eine Datei zurueckweist oder eine bereits eingereichte
Meldung erkennt — und genau das faellt dann am 31. Januar auf.
"""
from __future__ import annotations

import asyncio
from dataclasses import asdict

from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile, status

from ..core.auth import zugang_pruefen
from ..core.config import get_settings
from ..core.logging import get_logger
from ..core.protokoll import Eintrag, Protokoll, pruefsumme
from ..core.pruefung_csv import Befund, Quittung, csv_pruefen
from ..core.pruefung_xml import xml_pruefen
from .schemas import BefundAusgabe, QuittungAusgabe

log = get_logger("einreichung")
router = APIRouter(tags=["Einreichung"], dependencies=[Depends(zugang_pruefen)])

# Der Speicher lebt im Prozess (siehe core/protokoll.py). Eine Instanz je
# Dienst; bei mehreren Arbeitern sieht jeder seinen eigenen — fuer eine
# Teststufe gewollt, in der Doku benannt.
PROTOKOLL = Protokoll(get_settings().aufbewahrung_stunden)

# Was `X-Staging-Verhalten` ausloesen kann.
_VERHALTEN = {
    "normal": "regulaer pruefen",
    "ablehnen": "unabhaengig vom Inhalt zurueckweisen",
    "wartung": "Empfangsstelle nicht erreichbar (503)",
    "zeitueberschreitung": "Antwort verzoegern, bis der Aufrufer aufgibt",
    "doppelt": "Meldung als bereits eingereicht zurueckweisen",
}


@router.post(
    "/einreichung",
    response_model=QuittungAusgabe,
    summary="Eine DAC7-Meldung einreichen (CSV oder XML)",
)
async def einreichen(
    datei: UploadFile = File(..., description="Die Meldedatei (.csv oder .xml)"),
    x_staging_verhalten: str | None = Header(default=None),
) -> QuittungAusgabe:
    """Nimmt eine Meldedatei entgegen, prueft sie und quittiert."""
    verhalten = (x_staging_verhalten or "normal").lower()
    if verhalten not in _VERHALTEN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unbekanntes Verhalten. Moeglich: {', '.join(_VERHALTEN)}",
        )

    await _verhalten_anwenden(verhalten)

    rohdaten = await _rohdaten_lesen(datei)
    formatname = _format_bestimmen(datei.filename or "", rohdaten)
    inhalt = _text_lesen(rohdaten)

    quittung = _pruefen(formatname, inhalt, verhalten)

    summe = pruefsumme(rohdaten)
    _dublette_pruefen(summe, quittung)

    eintrag = PROTOKOLL.ablegen(
        format=formatname,
        dateiname=datei.filename or "(ohne Namen)",
        bytes_gesamt=len(rohdaten),
        pruefsumme=summe,
        angenommen=quittung.angenommen,
        zeilen=quittung.zeilen,
        zeilentypen=quittung.zeilentypen,
        fehler=quittung.fehler,
        hinweise=quittung.hinweise,
        saetze=quittung.saetze,
        rohtext=inhalt,
    )
    log.info(
        "einreichung",
        quittung=eintrag.quittungsnummer,
        format=formatname,
        angenommen=eintrag.angenommen,
        fehler=len(eintrag.fehler),
    )
    return _als_ausgabe(eintrag)


async def _verhalten_anwenden(verhalten: str) -> None:
    if verhalten == "wartung":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Die Empfangsstelle ist derzeit nicht erreichbar (Wartung).",
        )
    if verhalten == "zeitueberschreitung":
        # Laenger als jedes vernuenftige Client-Zeitlimit. Der Aufrufer soll
        # abbrechen — genau das ist der zu testende Fall.
        await asyncio.sleep(120)


async def _rohdaten_lesen(datei: UploadFile) -> bytes:
    grenze = get_settings().max_datei_bytes
    rohdaten = await datei.read(grenze + 1)
    if len(rohdaten) > grenze:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                f"Die Datei ist groesser als {grenze // (1024 * 1024)} MB. "
                "Eine DAC7-Meldung erreicht diese Groesse nicht."
            ),
        )
    if not rohdaten:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Die Datei ist leer.",
        )
    return rohdaten


def _format_bestimmen(dateiname: str, rohdaten: bytes) -> str:
    """Am INHALT erkennen, nicht am Dateinamen.

    Ein Dateiname ist eine Behauptung des Absenders. Die ersten Bytes
    sagen, was wirklich vorliegt.
    """
    anfang = rohdaten[:200].lstrip()
    if anfang.startswith(b"<?xml") or anfang.startswith(b"<"):
        return "xml"
    if dateiname.lower().endswith(".xml"):
        return "xml"
    return "csv"


def _text_lesen(rohdaten: bytes) -> str:
    """UTF-8 mit und ohne BOM. Excel schreibt die Datei mit BOM."""
    try:
        return rohdaten.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Die Datei ist nicht UTF-8-kodiert. Die Vorlage exportiert "
                "als UTF-8 (xlCSVUTF8)."
            ),
        ) from exc


def _pruefen(formatname: str, inhalt: str, verhalten: str) -> Quittung:
    quittung = xml_pruefen(inhalt) if formatname == "xml" else csv_pruefen(inhalt)
    if verhalten == "ablehnen":
        quittung.fehler.append(
            Befund(
                0, "", "", "Teststufe",
                "Diese Einreichung wurde auf Anforderung zurueckgewiesen "
                "(X-Staging-Verhalten: ablehnen).",
            )
        )
    if verhalten == "doppelt":
        quittung.fehler.append(
            Befund(
                0, "Message", "MSG_MESSAGE_REF_ID", "Einmaligkeit",
                "Fuer diesen Meldezeitraum liegt bereits eine Meldung mit "
                "dieser Kennung vor. Eine Korrektur braucht DPI402 und einen "
                "Verweis auf die urspruengliche Kennung.",
            )
        )
    return quittung


def _dublette_pruefen(summe: str, quittung: Quittung) -> None:
    """Dieselbe Datei ein zweites Mal — die Behoerde nimmt sie nicht an.

    Geprueft wird die Pruefsumme der Bytes, nicht die Meldungskennung: Zwei
    Einreichungen, die sich in keinem Byte unterscheiden, sind derselbe
    Vorgang. Eine Korrektur sieht anders aus — sie traegt DPI402 und
    CORR_DOC_REF_ID und hat damit eine andere Pruefsumme.

    Warum das hier steht und nicht nur hinter `X-Staging-Verhalten:
    doppelt`: Die Teststufe soll die Behoerde nachbilden. Nahm sie dieselbe
    Datei zweimal an, bestand das PMS einen Test, den die echte Stelle
    nicht durchgehen laesst — und die Einnahme waere doppelt gemeldet.
    """
    frueher = PROTOKOLL.bereits_angenommen(summe)
    if frueher is None:
        return
    quittung.fehler.append(
        Befund(
            0,
            "Message",
            "MSG_MESSAGE_REF_ID",
            "Einmaligkeit",
            "Diese Datei wurde bereits angenommen "
            f"(Quittung {frueher.quittungsnummer}, "
            f"{frueher.empfangen_am:%d-%m-%Y %H:%M} UTC). Eine Einnahme "
            "wird nur einmal gemeldet. Eine Korrektur traegt DPI402 und "
            "verweist ueber CORR_DOC_REF_ID auf die urspruengliche Kennung.",
        )
    )


def _als_ausgabe(eintrag: Eintrag) -> QuittungAusgabe:
    """Protokolleintrag in die Antwort umsetzen.

    `dataclasses.asdict` statt `vars()`: Die Befunde sind
    `slots=True`-Dataclasses und haben deshalb gar kein `__dict__` —
    `vars()` wirft darauf einen TypeError. Aufgefallen ist das erst im
    Test, weil der Gutfall keine Befunde enthaelt und die Schleife dort
    nie lief.
    """
    return QuittungAusgabe(
        quittungsnummer=eintrag.quittungsnummer,
        empfangen_am=eintrag.empfangen_am,
        format=eintrag.format,
        dateiname=eintrag.dateiname,
        bytes_gesamt=eintrag.bytes_gesamt,
        pruefsumme=eintrag.pruefsumme,
        angenommen=eintrag.angenommen,
        zeilen=eintrag.zeilen,
        zeilentypen=eintrag.zeilentypen,
        fehler=[BefundAusgabe(**asdict(b)) for b in eintrag.fehler],
        hinweise=[BefundAusgabe(**asdict(b)) for b in eintrag.hinweise],
        saetze=eintrag.saetze,
    )
