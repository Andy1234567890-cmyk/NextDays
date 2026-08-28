"""Routen der EIGENEN Beitragsfelder (0485) — Framers Reiter „Fields".

Eigenes Router-Modul und kein weiterer Abschnitt in ``router.py``: dieselbe
Begründung wie bei ``router_mediathek.py``. Die Datei stand bei 1467 von 1500
Zeilen, die vier Routen hier bringen weitere 94 mit, und ``pylint`` zieht bei
1500 (C0302). Der Schnitt ist auch fachlich richtig — es ist der einzige Teil
des Slice, der das SCHEMA eines Inhaltstyps ändert und nicht seine Inhalte.

Der Router trägt KEINEN eigenen Präfix. Er wird in ``router.py`` in
``manage_router`` eingehängt und erbt dessen ``/site-config`` — sonst stünde
die Adresse an zwei Stellen, und eine Umbenennung würde die Hälfte der
Endpunkte verschieben.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from supabase import Client

from src.core.security import AuthContext
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from . import beitrag_eigene_felder as eigene_felder_modul
from .dependencies import get_service_client

eigene_felder_router = APIRouter(tags=["site_config"])

_MANAGE = require_permission(Capability.MANAGE_SITE_CONFIG)
_DbDep = Annotated[Client, Depends(get_service_client)]


def _tenant(ctx: AuthContext) -> str:
    """Der Mandant aus dem gepruften Token — die einzige Quelle des Scopes.

    Nie aus dem Pfad, nie aus dem Rumpf: die Service-Rolle umgeht RLS, also ist
    dieser Wert die ganze Zugangskontrolle (Wurzel 3). Bewusst eine eigene
    kleine Funktion und kein Import aus ``router.py`` — ein Import von dort
    hierher waere ein Kreis, weil ``router.py`` diesen Router einhaengt.
    """
    if not ctx.tenant_id:
        raise HTTPException(status_code=403, detail="Kein Mandant im Token.")
    return ctx.tenant_id


@eigene_felder_router.get(
    "/blog/eigene-felder", response_model=eigene_felder_modul.EigeneFeldListe
)
def list_custom_post_fields(
    db: _DbDep, ctx: Annotated[AuthContext, Depends(_MANAGE)]
) -> eigene_felder_modul.EigeneFeldListe:
    """Die eigenen Beitragsfelder dieses Betriebs, in ihrer Reihenfolge."""
    return eigene_felder_modul.felder_laden(db, _tenant(ctx))


@eigene_felder_router.post(
    "/blog/eigene-felder",
    response_model=eigene_felder_modul.EigenesFeld,
    status_code=status.HTTP_201_CREATED,
)
def create_custom_post_field(
    db: _DbDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    body: eigene_felder_modul.EigenesFeldNeu,
) -> eigene_felder_modul.EigenesFeld:
    """Ein eigenes Feld anlegen — Schluessel, Name, Art."""
    try:
        return eigene_felder_modul.feld_anlegen(db, _tenant(ctx), body)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@eigene_felder_router.put(
    "/blog/eigene-felder/{feld_id}",
    response_model=eigene_felder_modul.EigenesFeld,
)
def update_custom_post_field(
    db: _DbDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    feld_id: str,
    body: eigene_felder_modul.EigenesFeldPatch,
) -> eigene_felder_modul.EigenesFeld:
    """Ein eigenes Feld aendern — Name, Reihenfolge, Verhalten.

    Derselbe Scope wie die Liste (Wurzel 9): geladen wird ueber
    (id, tenant_id), nicht ueber die id allein."""
    try:
        return eigene_felder_modul.feld_aendern(
            db, _tenant(ctx), feld_id, body
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


class EigenesFeldGeloescht(BaseModel):
    """Wie viele Beitraege beim Loeschen angefasst wurden.

    Die Zahl geht ausdruecklich zurueck an die Oberflaeche: „Feld geloescht"
    allein verschweigt, dass dabei Werte aus Beitraegen genommen wurden."""

    beitraege: int = 0


@eigene_felder_router.delete(
    "/blog/eigene-felder/{feld_id}", response_model=EigenesFeldGeloescht
)
def delete_custom_post_field(
    db: _DbDep,
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    feld_id: str,
) -> EigenesFeldGeloescht:
    """Ein eigenes Feld loeschen — samt seiner Werte in allen Beitraegen."""
    try:
        return EigenesFeldGeloescht(
            beitraege=eigene_felder_modul.feld_loeschen(
                db, _tenant(ctx), feld_id
            )
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
