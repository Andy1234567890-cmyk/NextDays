"""Abruf des Empfangsprotokolls."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..core.auth import zugang_pruefen
from .einreichung import PROTOKOLL, _als_ausgabe
from .schemas import ProtokollZeile, QuittungAusgabe

router = APIRouter(tags=["Quittungen"], dependencies=[Depends(zugang_pruefen)])


@router.get(
    "/quittungen",
    response_model=list[ProtokollZeile],
    summary="Die letzten Einreichungen",
)
def liste(grenze: int = Query(default=50, ge=1, le=200)) -> list[ProtokollZeile]:
    """Was wann ankam — neueste zuerst."""
    return [
        ProtokollZeile(
            quittungsnummer=e.quittungsnummer,
            empfangen_am=e.empfangen_am,
            format=e.format,
            dateiname=e.dateiname,
            angenommen=e.angenommen,
            zeilen=e.zeilen,
            anzahl_fehler=len(e.fehler),
        )
        for e in PROTOKOLL.liste(grenze)
    ]


@router.get(
    "/quittungen/{nummer}",
    response_model=QuittungAusgabe,
    summary="Eine Quittung im Volltext",
)
def einzeln(nummer: str) -> QuittungAusgabe:
    eintrag = PROTOKOLL.holen(nummer)
    if eintrag is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Keine Quittung mit dieser Nummer. Die Teststufe bewahrt "
                "Einreichungen nur befristet auf."
            ),
        )
    return _als_ausgabe(eintrag)


@router.delete(
    "/quittungen",
    summary="Das Protokoll leeren",
    status_code=status.HTTP_200_OK,
)
def leeren() -> dict[str, int]:
    """Alles verwerfen.

    Gebraucht, wenn versehentlich eine ECHTE Meldung eingereicht wurde: Sie
    enthaelt CPR-Nummern und Bankverbindungen und soll dann sofort weg sein,
    nicht erst nach Ablauf der Aufbewahrung.
    """
    return {"geloescht": PROTOKOLL.leeren()}
