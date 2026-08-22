"""Global: Länder und Währungen.

Die Normdaten, gegen die ein Client seine Eingabefelder baut. Sie hängen an
keinem Betrieb — dieselbe Antwort für jeden Zugang.

Ein Token ist trotzdem nötig. Nicht wegen der Daten (ISO-Listen sind kein
Geheimnis), sondern weil ein Endpunkt ohne Token keinem Zugang zurechenbar ist
und damit auch keiner Ratenbegrenzung: ein offener Pfad an einer öffentlichen
Adresse ist ein Ziel und kein Dienst (Wurzel 8). Gehängt an
`properties:read` — jeder Zugang, der irgendetwas Sinnvolles tut, hat ihn.

Reihenfolge in dieser Datei: Liste vor Einzelabruf, damit `/countries` nicht vom
Pfadparameter `/{code}` geschluckt wird.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from ..core import errors
from ..core.auth import ApiKontext, scope_erforderlich
from ..core.normdaten import LAENDER, WAEHRUNGEN, land, waehrung
from .schemas import LandAntwort, WaehrungAntwort

router = APIRouter(tags=["Global"])

_SCOPE = "properties:read"


@router.get(
    "/countries",
    response_model=list[LandAntwort],
    summary="Ländercodes",
)
def laender_liste(
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich(_SCOPE))],
) -> list[LandAntwort]:
    """Alle Länder, die wir annehmen — ISO-3166-1 alpha-2 mit Landeswährung.

    Die Währung steht dabei, weil sie die häufigste Folgefrage ist: wer ein
    Objekt in Dänemark anlegt, rechnet in DKK, nicht in Euro.
    """
    del ctx
    return [LandAntwort(**eintrag._asdict()) for eintrag in LAENDER]


@router.get(
    "/countries/{code}",
    response_model=LandAntwort,
    summary="Land nach Code",
)
def land_lesen(
    code: str,
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich(_SCOPE))],
) -> LandAntwort:
    """Ein Land nach ISO-2-Code. Unbekannter Code → 404, kein Ersatzland."""
    del ctx
    treffer = land(code)
    if treffer is None:
        raise errors.nicht_gefunden("Land")
    return LandAntwort(**treffer._asdict())


@router.get(
    "/currencies",
    response_model=list[WaehrungAntwort],
    summary="Währungscodes",
)
def waehrungen_liste(
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich(_SCOPE))],
) -> list[WaehrungAntwort]:
    """Alle Währungen, die in Beträgen dieser API vorkommen können."""
    del ctx
    return [WaehrungAntwort(**eintrag._asdict()) for eintrag in WAEHRUNGEN]


@router.get(
    "/currencies/{code}",
    response_model=WaehrungAntwort,
    summary="Währung nach Code",
)
def waehrung_lesen(
    code: str,
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich(_SCOPE))],
) -> WaehrungAntwort:
    """Eine Währung nach ISO-4217-Code. Unbekannter Code → 404."""
    del ctx
    treffer = waehrung(code)
    if treffer is None:
        raise errors.nicht_gefunden("Währung")
    return WaehrungAntwort(**treffer._asdict())
