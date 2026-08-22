"""Aufgaben — Reinigung, Wartung, Kontrollen.

Der Zweck dieses Bereichs in einer öffentlichen API: Betriebe koppeln ihre
Reinigungsplanung an ein eigenes System (Dienstplan, Handwerker-App) und wollen
Aufgaben dort sehen und abschließen.

Was hier NICHT erzeugt werden kann: Aufgaben aus Regeln (`source = auto` oder
`recurring`). Sie entstehen aus den Aufgaben-Regeln des Betriebs — eine über die
API angelegte Aufgabe ist immer `manual`. Andernfalls stünde eine Aufgabe in der
Auswertung „automatisch erzeugt", die niemand über eine Regel wiederfinden kann.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from supabase import Client

from ..core import errors
from ..core.auth import ApiKontext, scope_erforderlich
from ..core.db import Abfrage, service_db, zeile_im_mandanten
from ..core.pagination import blaettern_pruefen, keyset_anwenden, seite_bauen
from .schemas import Aufgabe, AufgabeAendern, AufgabeAnlegen, Seite

router = APIRouter(prefix="/tasks", tags=["Aufgaben"])

_SPALTEN = (
    "id, property_id, reservation_id, assignee_id, title, description, status, "
    "priority, due_at, start_at, end_at, completed_at, created_at"
)


def _aufgabe(zeile: dict) -> Aufgabe:
    return Aufgabe(
        id=str(zeile["id"]),
        property_id=str(zeile["property_id"]) if zeile.get("property_id") else None,
        reservation_id=(
            str(zeile["reservation_id"]) if zeile.get("reservation_id") else None
        ),
        title=zeile.get("title") or "",
        description=zeile.get("description"),
        status=zeile.get("status") or "open",
        priority=zeile.get("priority"),
        assignee_id=str(zeile["assignee_id"]) if zeile.get("assignee_id") else None,
        due_at=zeile.get("due_at"),
        start_at=zeile.get("start_at"),
        end_at=zeile.get("end_at"),
        completed_at=zeile.get("completed_at"),
        created_at=zeile["created_at"],
    )


def _objekt_erlaubt(db: Client, ctx: ApiKontext, property_id: str | None) -> None:
    """Aufgabe an einem Objekt: dasselbe Objekt-Recht wie überall.

    Eine Aufgabe ohne Objekt (allgemeine Büroaufgabe) ist erlaubt — dann greift
    nur die Mandanten-Prüfung.
    """
    if not property_id:
        return
    ctx.objekt_pruefen(property_id)
    zeile_im_mandanten(
        db, "properties", property_id, ctx.tenant_id, spalten="id", was="Das Objekt"
    )


@router.get(
    "",
    response_model=Seite[Aufgabe],
    response_model_exclude_unset=True,
    summary="Aufgaben auflisten",
)
def liste(
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("tasks:read"))],
    property_id: Annotated[str | None, Query()] = None,
    status: Annotated[
        str | None,
        Query(
            description=(
                "open | accepted | in_progress | done | cancelled. Mehrere durch "
                "Komma."
            )
        ),
    ] = None,
    assignee_id: Annotated[str | None, Query(description="Nur Aufgaben dieser Person.")] = None,
    due_before: Annotated[
        datetime | None, Query(description="Fällig vor diesem Zeitpunkt (ISO 8601).")
    ] = None,
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
    """Aufgaben des Betriebs.

    Sortiert nach Fälligkeit; Aufgaben ohne Fälligkeitszeitpunkt stehen am Ende.
    """
    db = service_db()
    blatt = blaettern_pruefen(limit, offset, include_total, starting_after)
    if property_id:
        _objekt_erlaubt(db, ctx, property_id)

    def basis() -> Abfrage:
        q = db.table("tasks").select(_SPALTEN).eq("tenant_id", ctx.tenant_id)
        if property_id:
            q = q.eq("property_id", property_id)
        elif ctx.property_ids:
            # Ein auf Objekte beschränkter Zugang sieht nur deren Aufgaben. Ohne
            # diesen Filter zeigte die Liste Aufgaben, die der Detailpfad
            # verweigert (Wurzel 9).
            q = q.in_("property_id", ctx.property_ids)
        if status:
            q = q.in_("status", [s.strip() for s in status.split(",") if s.strip()])
        if assignee_id:
            q = q.eq("assignee_id", assignee_id)
        if due_before:
            q = q.lte("due_at", due_before.isoformat())
        return q

    # `due_at` darf NULL sein (eine Aufgabe ohne Fälligkeit). `nullsfirst=False`
    # stellt diese Zeilen ans Ende — und genau damit rechnet der Cursor-Filter:
    # solange er auf einem Wert steht, schließt er den NULL-Block mit ein, und
    # sobald er darin ist, blättert er nur noch über die ID weiter. Ohne diese
    # Behandlung bliebe das Blättern vor den Aufgaben ohne Fälligkeit stehen.
    zeilen = (
        keyset_anwenden(
            basis().order("due_at", desc=False, nullsfirst=False).order("id"),
            db,
            "tasks",
            blatt,
            tenant_id=ctx.tenant_id,
            sortier_spalte="due_at",
            aufsteigend=True,
            # `due_at` darf NULL sein — deshalb die ODER-Form statt der
            # schnelleren Range-Form: eine Grenze `due_at >= wert` würde alle
            # Aufgaben ohne Fälligkeit ausschließen und den NULL-Block
            # unerreichbar machen.
            nullable=True,
        )
        .range(blatt.range_von, blatt.range_bis)
        .execute()
    ).data or []
    total = None
    if include_total:
        total = (basis().select("id", count="exact").limit(1).execute()).count
    return seite_bauen(
        [_aufgabe(z).model_dump(mode="json") for z in zeilen], blatt, total=total
    )


@router.get("/{task_id}", response_model=Aufgabe, summary="Eine Aufgabe lesen")
def detail(
    task_id: str,
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("tasks:read"))],
) -> Aufgabe:
    db = service_db()
    zeile = zeile_im_mandanten(
        db, "tasks", task_id, ctx.tenant_id, spalten=_SPALTEN, was="Die Aufgabe"
    )
    _objekt_erlaubt(db, ctx, zeile.get("property_id") and str(zeile["property_id"]))
    return _aufgabe(zeile)


@router.post("", response_model=Aufgabe, status_code=201, summary="Aufgabe anlegen")
def anlegen(
    body: AufgabeAnlegen,
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("tasks:write"))],
) -> Aufgabe:
    """Eine Aufgabe anlegen (`source = manual`).

    `assignee_id` muss eine Person des Betriebs sein. Eine ungeprüfte ID würde
    eine Aufgabe an jemanden aus einem fremden Betrieb hängen — und der sähe sie
    in seiner Liste.
    """
    db = service_db()
    _objekt_erlaubt(db, ctx, body.property_id)
    if body.reservation_id:
        zeile_im_mandanten(
            db, "reservations", body.reservation_id, ctx.tenant_id,
            spalten="id", was="Die Buchung",
        )
    if body.assignee_id:
        _person_pruefen(db, ctx.tenant_id, body.assignee_id)

    zeilen = (
        db.table("tasks")
        .insert(
            {
                "tenant_id": ctx.tenant_id,
                "property_id": body.property_id,
                "reservation_id": body.reservation_id,
                "assignee_id": body.assignee_id,
                "title": body.title.strip(),
                "description": body.description,
                "priority": body.priority,
                "due_at": body.due_at.isoformat() if body.due_at else None,
                "status": "open",
                # Immer `manual`: eine über die API angelegte Aufgabe stammt nicht
                # aus einer Regel des Betriebs (siehe Modul-Docstring).
                "source": "manual",
            }
        )
        .execute()
    ).data
    if not zeilen:
        raise errors.ApiFehler(
            status=500,
            code="aufgabe_nicht_angelegt",
            detail="Die Aufgabe konnte nicht angelegt werden.",
            titel="Aufgabe nicht angelegt",
        )
    return _aufgabe(zeilen[0])


@router.patch("/{task_id}", response_model=Aufgabe, summary="Aufgabe ändern")
def aendern(
    task_id: str,
    body: AufgabeAendern,
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("tasks:write"))],
) -> Aufgabe:
    """Status, Zuständige, Fälligkeit oder Beschreibung ändern.

    `status: "done"` setzt zusätzlich den Abschlusszeitpunkt. Der Gegenzustand
    gehört dazu: ein Statuswechsel ohne `completed_at` ergäbe eine erledigte
    Aufgabe, die in jeder Auswertung nach Abschlusszeitpunkt fehlt (Wurzel 1).
    Wird sie wieder geöffnet, wird der Zeitpunkt entfernt.
    """
    db = service_db()
    vorher = zeile_im_mandanten(
        db, "tasks", task_id, ctx.tenant_id,
        spalten="id, property_id, status", was="Die Aufgabe",
    )
    _objekt_erlaubt(db, ctx, vorher.get("property_id") and str(vorher["property_id"]))

    felder = body.model_dump(exclude_unset=True)
    if not felder:
        raise errors.ungueltige_anfrage("Die Anfrage enthält kein änderbares Feld.")
    if body.assignee_id:
        _person_pruefen(db, ctx.tenant_id, body.assignee_id)
    if body.due_at is not None:
        felder["due_at"] = body.due_at.isoformat()

    if "status" in felder:
        if felder["status"] == "done":
            felder["completed_at"] = datetime.now(UTC).isoformat()
        elif vorher.get("status") == "done":
            felder["completed_at"] = None

    (
        db.table("tasks")
        .update(felder)
        .eq("id", task_id)
        .eq("tenant_id", ctx.tenant_id)
        .execute()
    )
    zeile = zeile_im_mandanten(
        db, "tasks", task_id, ctx.tenant_id, spalten=_SPALTEN, was="Die Aufgabe"
    )
    return _aufgabe(zeile)


def _person_pruefen(db: Client, tenant_id: str, user_id: str) -> None:
    """Die Person gehört zu DIESEM Betrieb."""
    zeilen = (
        db.table("users")
        .select("id")
        .eq("id", user_id)
        .eq("tenant_id", tenant_id)
        # Deaktivierte Konten sind ausgeschlossen: eine Aufgabe an jemanden, der
        # das System nicht mehr betritt, ist eine Aufgabe, die niemand sieht.
        .is_("deactivated_at", "null")
        .limit(1)
        .execute()
    ).data
    if not zeilen:
        raise errors.ungueltige_anfrage(
            "Die angegebene Person gehört nicht zu diesem Betrieb "
            "oder ist deaktiviert."
        )
