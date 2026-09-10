"""Einreichen bei der Steuerbehoerde."""
from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from ..core.auth import zugang_pruefen
from ..core.config import get_settings
from ..core.versender import senden
from .schemas import VersandAusgabe

router = APIRouter(tags=["Versand"], dependencies=[Depends(zugang_pruefen)])


@router.post(
    "/einreichen",
    response_model=VersandAusgabe,
    summary="Eine fertige DAC7-Meldung bei der Behoerde einreichen",
)
async def einreichen(
    datei: UploadFile = File(..., description="Die fertige Meldedatei"),
) -> VersandAusgabe:
    """Reicht die uebergebene Datei bei der Behoerde ein.

    Der Dienst prueft die Datei NICHT — das hat das PMS getan, bevor es
    sie hierher gab, und die Behoerde tut es gleich noch einmal. Eine
    dritte Pruefung dazwischen waere eine dritte Meinung darueber, was
    richtig ist.
    """
    e = get_settings()
    rohdaten = await datei.read(e.max_datei_bytes + 1)
    if len(rohdaten) > e.max_datei_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Die Datei ist groesser als {e.max_datei_bytes // (1024 * 1024)} MB.",
        )
    if not rohdaten:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Die Datei ist leer — es gibt nichts einzureichen.",
        )

    ergebnis = await senden(rohdaten, datei.filename or "meldung.csv")
    return VersandAusgabe(**asdict(ergebnis))
