"""Objekte und ihre Einheiten.

Ein Objekt (`property`) ist genau EIN Einheiten-Typ: ein Zimmertyp im Hotel oder
ein Ferienobjekt. Darunter hängen seine Einheiten (`units`) — im Normalfall
genau eine, bei mehreren identischen Einheiten entsprechend viele. Verkauft wird
die Einheit, geführt und bepreist wird der Typ.

Das ist die Form, die die Portale erzwingen (Booking.com führt die Stückzahl am
Zimmer-/Apartment-Typ, SiteMinder sendet sie als `BookingLimit` je Zimmertyp),
und der Grund, warum `units_available` in dieser API eine ZAHL ist und kein
Ja/Nein.

Was hier ausdrücklich NICHT abgebildet ist: ein Objekt als „Hotelgebäude mit
Zimmerkategorien darunter". Ein Hotel mit 8 Twin- und 4 Double-Zimmern hat in
dieser API ZWEI Objekte mit 8 bzw. 4 Einheiten. Welche Objekte bei den Portalen
unter EINER Kennung stehen, entscheidet das Gebäude (`building_id`).
"""
from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from supabase import Client

from ..core import errors
from ..core.auth import ApiKontext, scope_erforderlich
from ..core.db import Abfrage, service_db, zeile_im_mandanten
from ..core.pagination import blaettern_pruefen, keyset_anwenden, seite_bauen
from .schemas import Einheit, Objekt, ObjektAenderung, Seite

router = APIRouter(prefix="/properties", tags=["Objekte"])

_SPALTEN = (
    "id, title, status, currency, timezone, max_guests, property_type, "
    "category_slug, subtype_slug, listing_type, street, house_number, "
    "postal_code, city, country, lat, lng, amenities, photos, building_id, "
    "listed_on_marketplace, listed_on_website, created_at, updated_at"
)


def _einheiten_zahl(db: Client, tenant_id: str, property_ids: list[str]) -> dict[str, int]:
    """Einheiten je Objekt in EINER Abfrage.

    Bewusst nicht je Objekt einzeln: eine Liste mit 50 Objekten hätte sonst 51
    Abfragen (N+1) — bei einem Betrieb mit vielen Zimmertypen der Unterschied
    zwischen 80 ms und drei Sekunden.
    """
    if not property_ids:
        return {}
    zeilen = (
        db.table("property_units")
        .select("property_id")
        .eq("tenant_id", tenant_id)
        .in_("property_id", property_ids)
        .execute()
    ).data or []
    zahl: dict[str, int] = {}
    for z in zeilen:
        pid = str(z["property_id"])
        zahl[pid] = zahl.get(pid, 0) + 1
    return zahl


def _objekt_aus_zeile(zeile: dict, einheiten: int) -> Objekt:
    """DB-Zeile → öffentliches Schema.

    Die einzige Stelle, an der Spaltennamen auf Feldnamen der API treffen. Eine
    umbenannte Spalte bricht damit hier (und im Test), nicht beim Kunden.

    Die Währung wird NICHT ersetzt, wenn sie fehlt: ein Objekt ohne Währung ist
    ein Datenfehler, und ein erfundenes „EUR" würde in einem dänischen oder
    polnischen Betrieb falsche Beträge ausliefern (Wurzel 4). Der Aufruf schlägt
    darum fehl.
    """
    waehrung = (zeile.get("currency") or "").strip()
    if not waehrung:
        raise errors.ApiFehler(
            status=422,
            code="waehrung_fehlt",
            detail=(
                f"Dem Objekt {zeile['id']} ist keine Währung zugeordnet. "
                "Bitte im Dashboard unter Objekt → Einstellungen nachtragen; "
                "ohne Währung sind seine Beträge nicht auslieferbar."
            ),
            titel="Währung fehlt",
            extra={"property_id": str(zeile["id"])},
        )
    return Objekt(
        id=str(zeile["id"]),
        title=zeile.get("title") or "",
        status=zeile.get("status") or "draft",
        currency=waehrung,
        timezone=zeile.get("timezone"),
        max_guests=int(zeile.get("max_guests") or 1),
        # Mindestens 1: das Modell kennt kein Objekt ohne Einheit (n >= 1). Das
        # ist keine Erfindung, sondern die Untergrenze des Modells — dieselbe,
        # die `core/einheiten_verfuegbar.einheiten_zahl` ansetzt.
        units_total=max(einheiten, 1),
        property_type=zeile.get("property_type"),
        category_slug=zeile.get("category_slug"),
        subtype_slug=zeile.get("subtype_slug"),
        listing_type=zeile.get("listing_type"),
        address={
            "street": zeile.get("street"),
            "house_number": zeile.get("house_number"),
            "postal_code": zeile.get("postal_code"),
            "city": zeile.get("city"),
            "country": zeile.get("country"),
        },
        lat=zeile.get("lat"),
        lng=zeile.get("lng"),
        amenities=list(zeile.get("amenities") or []),
        photos=list(zeile.get("photos") or []),
        building_id=str(zeile["building_id"]) if zeile.get("building_id") else None,
        # Kanal-Sichtbarkeit ist PRO KANAL schaltbar — es gibt kein globales
        # „veröffentlicht". Wer auf einem Kanal sichtbar sein will, braucht
        # zusätzlich `status = active` und freie Nächte.
        channels={
            "marketplace": bool(zeile.get("listed_on_marketplace")),
            "website": bool(zeile.get("listed_on_website")),
        },
        created_at=zeile["created_at"],
        updated_at=zeile["updated_at"],
    )


def _sichtbare_ids(ctx: ApiKontext, db: Client) -> list[str] | None:
    """Objekt-IDs, die dieser Zugang sehen darf — oder None für „alle des Betriebs".

    Wichtig für die LISTE: der Zugang kann auf eine Teilmenge beschränkt sein,
    und dann muss die Liste dieselbe Beschränkung anwenden wie der Detailpfad
    (Wurzel 9 — sonst zeigt die Liste, was das Detail verweigert).
    """
    del db
    return ctx.property_ids or None


@router.get(
    "",
    response_model=Seite[Objekt],
    response_model_exclude_unset=True,
    summary="Objekte auflisten",
)
def liste(
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("properties:read"))],
    status: Annotated[
        str | None,
        Query(description="Nach Status filtern: draft | active | inactive."),
    ] = None,
    building_id: Annotated[str | None, Query(description="Nur Objekte dieses Gebäudes.")] = None,
    archived: Annotated[
        bool | None,
        Query(
            description=(
                "Ohne Angabe: nur AKTIVE Objekte (archivierte bleiben weg). "
                "`true` liefert ausschließlich archivierte — der Weg, sie im "
                "eigenen System ebenfalls stillzulegen. `false` ist dasselbe "
                "wie keine Angabe, nur ausdrücklich."
            )
        ),
    ] = None,
    updated_since: Annotated[
        str | None,
        Query(
            description=(
                "Nur Objekte, die seit diesem Zeitpunkt geändert wurden "
                "(ISO 8601). Der sparsame Weg für einen regelmäßigen Abgleich."
            )
        ),
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
    include_total: Annotated[
        bool,
        Query(
            description=(
                "Gesamtzahl mitzählen. Kostet eine zusätzliche Zählung — nur "
                "anfordern, wenn du sie anzeigst."
            )
        ),
    ] = False,
) -> dict[str, Any]:
    """Alle Objekte des Betriebs, auf die dieser Zugang Zugriff hat.

    Sortiert nach Titel, damit die Reihenfolge über Seiten hinweg stabil ist —
    ohne stabile Sortierung kann Blättern Zeilen doppelt oder gar nicht liefern.
    """
    db = service_db()
    blatt = blaettern_pruefen(limit, offset, include_total, starting_after)

    def basis() -> Abfrage:
        q = db.table("properties").select(_SPALTEN).eq("tenant_id", ctx.tenant_id)
        erlaubt = _sichtbare_ids(ctx, db)
        if erlaubt is not None:
            q = q.in_("id", erlaubt)
        if status:
            q = q.eq("status", status)
        if building_id:
            q = q.eq("building_id", building_id)
        if updated_since:
            q = q.gte("updated_at", updated_since)
        # Archivierte Objekte sind standardmäßig NICHT dabei: sie sind aus dem
        # Betrieb genommen, und ein Client, der sie mitsynchronisiert, legt sie
        # bei sich als aktive Objekte an. Wer sie braucht — um sie im eigenen
        # System ebenfalls stillzulegen — fragt sie ausdrücklich an.
        if archived is True:
            return q.not_.is_("archived_at", "null")
        if archived is False:
            return q.is_("archived_at", "null")
        return q

    # Sortiert nach `(title, id)`: der Titel ist nicht eindeutig, und ohne den
    # zweiten Schlüssel könnte ein Cursor nicht sagen, welches von zwei
    # gleichnamigen Objekten gemeint war.
    zeilen = (
        keyset_anwenden(
            basis().order("title").order("id"),
            db,
            "properties",
            blatt,
            tenant_id=ctx.tenant_id,
            sortier_spalte="title",
            aufsteigend=True,
        )
        .range(blatt.range_von, blatt.range_bis)
        .execute()
    ).data or []

    total = None
    if include_total:
        total = (
            basis().select("id", count="exact").limit(1).execute()
        ).count

    einheiten = _einheiten_zahl(
        db, ctx.tenant_id, [str(z["id"]) for z in zeilen]
    )
    objekte = [_objekt_aus_zeile(z, einheiten.get(str(z["id"]), 0)) for z in zeilen]
    return seite_bauen(
        [o.model_dump(mode="json") for o in objekte], blatt, total=total
    )


@router.get("/{property_id}", response_model=Objekt, summary="Ein Objekt lesen")
def detail(
    property_id: str,
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("properties:read"))],
) -> Objekt:
    """Ein Objekt samt Adresse, Ausstattung und Kanal-Sichtbarkeit.

    Prüft dieselbe Objekt-Beschränkung wie die Liste — ein Detailpfad, der nur
    den Mandanten prüft, wäre ein Weg an der Beschränkung vorbei (Wurzel 9).
    """
    ctx.objekt_pruefen(property_id)
    db = service_db()
    zeile = zeile_im_mandanten(
        db, "properties", property_id, ctx.tenant_id,
        spalten=_SPALTEN, was="Das Objekt",
    )
    einheiten = _einheiten_zahl(db, ctx.tenant_id, [property_id])
    return _objekt_aus_zeile(zeile, einheiten.get(property_id, 0))


@router.get(
    "/{property_id}/units",
    response_model=list[Einheit],
    summary="Einheiten eines Objekts",
)
def einheiten(
    property_id: str,
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("properties:read"))],
) -> list[Einheit]:
    """Die Einheiten dieses Typs, stabil sortiert.

    Die IDs brauchst du, wenn du eine BESTIMMTE Einheit buchen oder sperren
    willst. Ohne Angabe wählt das System beim Buchen die erste freie.
    """
    ctx.objekt_pruefen(property_id)
    db = service_db()
    # Existenz + Mandant in einem Schritt prüfen, damit ein fremdes Objekt einen
    # 404 und keine leere Liste ergibt (eine leere Liste läse sich wie „dieses
    # Objekt hat keine Einheiten").
    zeile_im_mandanten(
        db, "properties", property_id, ctx.tenant_id, spalten="id", was="Das Objekt"
    )
    zeilen = (
        db.table("property_units")
        .select("id, name, position")
        .eq("tenant_id", ctx.tenant_id)
        .eq("property_id", property_id)
        .order("position")
        .order("id")
        .execute()
    ).data or []
    return [
        Einheit(id=str(z["id"]), name=z.get("name") or "", position=int(z.get("position") or 0))
        for z in zeilen
    ]


@router.patch("/{property_id}", response_model=Objekt, summary="Objekt ändern")
def aendern(
    property_id: str,
    body: ObjektAenderung,
    ctx: Annotated[ApiKontext, Depends(scope_erforderlich("properties:write"))],
) -> Objekt:
    """Beschreibende Felder eines Objekts ändern.

    Absichtlich auf Titel, Beschreibung, Belegungsgrenze und Ausstattung
    begrenzt. Was den Verkauf steuert — Status, Kanal-Sichtbarkeit, Preise,
    Verfügbarkeit — hat eigene Endpunkte mit eigenen Scopes. Ein Sammel-PATCH,
    der alles kann, macht jede Rechtevergabe stumpf: wer eine Beschreibung
    pflegen soll, könnte damit ein Objekt aus dem Verkauf nehmen.
    """
    ctx.objekt_pruefen(property_id)
    db = service_db()
    zeile_im_mandanten(
        db, "properties", property_id, ctx.tenant_id, spalten="id", was="Das Objekt"
    )
    felder = body.model_dump(exclude_unset=True, exclude_none=True)
    if not felder:
        raise errors.ungueltige_anfrage("Die Anfrage enthält kein änderbares Feld.")
    (
        db.table("properties")
        .update(felder)
        .eq("id", property_id)
        .eq("tenant_id", ctx.tenant_id)
        .execute()
    )
    zeile = zeile_im_mandanten(
        db, "properties", property_id, ctx.tenant_id,
        spalten=_SPALTEN, was="Das Objekt",
    )
    einheiten_zahl = _einheiten_zahl(db, ctx.tenant_id, [property_id])
    return _objekt_aus_zeile(zeile, einheiten_zahl.get(property_id, 0))
