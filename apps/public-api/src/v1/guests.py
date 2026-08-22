"""Gästestammdaten (nur lesend).

Bewusst nur lesend, und bewusst ohne Schreib-Scope: Gastdaten entstehen dort, wo
der Gast sie eingibt oder das Portal sie liefert. Ein Schreibpfad über die API
würde eine dritte Quelle daneben stellen — und die Frage „welche Adresse ist die
richtige" ist bei Portal-Buchungen ohnehin schon knifflig (die anonymisierte
Adresse des Portals ist die, über die kommuniziert werden muss).

Was hier NICHT ausgeliefert wird, obwohl es in der Tabelle steht: Ausweisdaten,
Geburtsdatum, Geburtsort, Zahlungsinformationen und die Umsatzhistorie. Ein
Zugang, der einen Kalender abgleichen soll, braucht sie nicht, und eine API
liefert nur, was ihr Zweck verlangt — jedes Feld mehr ist ein Feld, das bei
einem abgeflossenen Token mitabfließt.
"""
from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query

from ..core.auth import ApiKontext, scope_erforderlich
from ..core.db import Abfrage, service_db, zeile_im_mandanten
from ..core.pagination import blaettern_pruefen, keyset_anwenden, seite_bauen
from ..core.supabase import escape_like
from .schemas import GastProfil, Seite

router = APIRouter(prefix="/guests", tags=["Gäste"])

# Bewusst kleine Auswahl — siehe Modul-Docstring.
_SPALTEN = (
    "id, name, first_name, last_name, email, phone, language, nationality, "
    "company, segment, stays_count, last_stay_at, created_at, updated_at"
)


def _gast(zeile: dict) -> dict[str, Any]:
    return {
        "id": str(zeile["id"]),
        "name": zeile.get("name"),
        "first_name": zeile.get("first_name"),
        "last_name": zeile.get("last_name"),
        "email": zeile.get("email"),
        "phone": zeile.get("phone"),
        "language": zeile.get("language"),
        "country": zeile.get("nationality"),
        "company": zeile.get("company"),
        "segment": zeile.get("segment"),
        "stays_count": zeile.get("stays_count"),
        "last_stay_at": zeile.get("last_stay_at"),
        "created_at": zeile.get("created_at"),
        "updated_at": zeile.get("updated_at"),
    }


@router.get(
    "",
    response_model=Seite[GastProfil],
    response_model_exclude_unset=True,
    summary="Gäste auflisten",
)
def liste(
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("guests:read"))],
    email: Annotated[str | None, Query(description="Exakte E-Mail-Adresse.")] = None,
    search: Annotated[
        str | None,
        Query(min_length=2, description="Namensteil (mindestens zwei Zeichen)."),
    ] = None,
    updated_since: Annotated[str | None, Query(description="Geändert seit (ISO 8601).")] = None,
    limit: Annotated[int | None, Query(ge=1, le=200)] = None,
    offset: Annotated[int | None, Query(ge=0)] = None,
    starting_after: Annotated[
        str | None,
        Query(
            description=(
                "ID des letzten Elements der Vorseite — der empfohlene Weg zum "
                "Blättern. Stabil, auch wenn sich die Liste zwischen zwei "
                "Seiten ändert. Schließt `offset` aus. Den Wert liefert "
                "`pagination.next_starting_after` der Vorseite.\n\n"
                "**Die übrigen Filter musst du beim Weiterblättern unverändert "
                "mitschicken.** Änderst du sie, beschreibt der Cursor eine "
                "Stelle in einer anderen Liste, und das Ergebnis ist nicht "
                "vorhersagbar. `limit` darf sich ändern.\n\n"
                "Der Cursor läuft nicht ab. Er wird ungültig, wenn der "
                "Datensatz gelöscht wird — dann kommt ein 422, und du beginnst "
                "den Durchgang ohne `starting_after` neu."
            )
        ),
    ] = None,
    include_total: Annotated[bool, Query()] = False,
) -> dict[str, Any]:
    """Gäste des Betriebs.

    Anonymisierte Gäste (Löschverlangen nach DSGVO ausgeführt) erscheinen nicht.
    Sie aus der Liste zu nehmen ist Teil der Löschung — ein Client, der sie noch
    einmal abholt, würde sie bei sich wieder aufbauen.
    """
    db = service_db()
    blatt = blaettern_pruefen(limit, offset, include_total, starting_after)

    def basis() -> Abfrage:
        q = db.table("guests").select(_SPALTEN).eq("tenant_id", ctx.tenant_id)
        if email:
            q = q.eq("email", email)
        if search:
            # `escape_like` ist hier Pflicht: ohne sie wird aus einem Suchwort
            # mit `%` ein Wildcard-Muster, das fremde Zeilen trifft (Wurzel 8).
            muster = f"%{escape_like(search)}%"
            q = q.or_(
                f"name.ilike.{muster},first_name.ilike.{muster},"
                f"last_name.ilike.{muster}"
            )
        if updated_since:
            q = q.gte("updated_at", updated_since)
        return q.is_("anonymized_at", "null")

    zeilen = (
        keyset_anwenden(
            basis().order("name").order("id"),
            db,
            "guests",
            blatt,
            tenant_id=ctx.tenant_id,
            sortier_spalte="name",
            aufsteigend=True,
        )
        .range(blatt.range_von, blatt.range_bis)
        .execute()
    ).data or []
    total = None
    if include_total:
        total = (basis().select("id", count="exact").limit(1).execute()).count
    return seite_bauen([_gast(z) for z in zeilen], blatt, total=total)


@router.get(
    "/{guest_id}", response_model=GastProfil, summary="Einen Gast lesen"
)
def detail(
    guest_id: str,
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("guests:read"))],
) -> dict[str, Any]:
    """Ein Gast-Stammsatz."""
    db = service_db()
    zeile = zeile_im_mandanten(
        db, "guests", guest_id, ctx.tenant_id, spalten=_SPALTEN, was="Der Gast"
    )
    return _gast(zeile)
