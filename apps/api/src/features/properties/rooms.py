"""Zimmer eines Objekts (property_rooms, 0246).

Eigenes Modul, weil Zimmer eine eigene Entitaet sind: Typ, privat/gemeinschaftlich,
Schlafmoeglichkeiten, eigene Ausstattung, en-suite-Kopplung. Der Service bindet
sie ueber ``RoomsMixin`` ein.

ABGRENZUNG ZUM AGGREGATOR: Channex nimmt Zimmerstruktur nicht an — beds,
bed_configuration, bedrooms und bathrooms am Room-Type werden verworfen
(live gemessen, docs/CHANNEX-FELDER.md). Diese Daten sind lokal (eigene Strecke
+ myBestDays). Nur die Zimmer-Ausstattung geht hinaus, und zwar als
Vereinigungsmenge ueber alle Zimmer in properties.room_amenities — der
Aggregator kennt je Objekt genau EINEN Room-Type.
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Protocol

from src.core.logging import get_logger
from src.core.security import AuthContext

from .errors import PropertyError
from .schemas import (
    BETT_RAUMTYPEN,
    ENSUITE_RAUMTYPEN,
    PropertyRoom,
    PropertyRoomCreate,
    PropertyRoomListResponse,
    PropertyRoomUpdate,
)

if TYPE_CHECKING:  # pragma: no cover — nur fuer die Typpruefung
    from supabase import Client

    from .schemas import PropertyResponse

log = get_logger("nextdays.properties.rooms")


def room_row(r: dict) -> dict:
    """property_rooms-Zeile in das PropertyRoom-Schema ueberfuehren."""
    kopplung = r.get("en_suite_schlafzimmer_id")
    return {
        "id": str(r["id"]),
        "property_id": str(r["property_id"]),
        "raum_typ": r["raum_typ"],
        "privat": bool(r.get("privat", True)),
        "name": r.get("name") or None,
        "position": int(r.get("position") or 0),
        "betten": r.get("betten") or {},
        "ausstattung": r.get("ausstattung") or [],
        "en_suite": bool(r.get("en_suite")),
        "en_suite_schlafzimmer_id": str(kopplung) if kopplung else None,
        "created_at": str(r["created_at"]) if r.get("created_at") else None,
        "updated_at": str(r["updated_at"]) if r.get("updated_at") else None,
    }


class _ServiceTeile(Protocol):
    """Was der Mixin vom Service braucht — macht die Kopplung sichtbar."""

    _db: Client

    def _require_tenant(self, ctx: AuthContext) -> str: ...

    def get(self, ctx: AuthContext, property_id: str) -> PropertyResponse: ...

    def _sync_to_channel_manager(
        self, tenant_id: str, *, property_id: str, title: str, currency: str | None
    ) -> None: ...


class RoomsMixin:
    """Zimmer-CRUD. Wird von PropertiesService eingebunden."""

    # Scope: siehe Modul-Docstring.
    # Jeder dieser Endpunkte prüft über self.get() denselben Scope wie die Liste
    # (Wurzel 9): Owner/Staff sehen nur ihre Objekte, ein fremdes Objekt wirkt
    # wie „nicht gefunden". Das Zimmer wird IMMER zusätzlich auf property_id
    # gefiltert — eine Zimmer-ID allein darf nie genügen.

    def list_rooms(
        self, ctx: AuthContext, property_id: str
    ) -> PropertyRoomListResponse:
        """Zimmer eines Objekts in Anzeigereihenfolge."""
        self.get(ctx, property_id)
        rows = (
            self._db.table("property_rooms")
            .select("*")
            .eq("property_id", property_id)
            .order("position")
            .execute()
        ).data or []
        items = [PropertyRoom(**room_row(r)) for r in rows]
        return PropertyRoomListResponse(items=items, total=len(items))

    def _validate_room(
        self,
        property_id: str,
        *,
        raum_typ: str,
        betten: dict[str, int],
        en_suite: bool,
        kopplung: str | None,
        eigene_id: str | None = None,
    ) -> None:
        """Fachliche Regeln, die die DB nicht erzwingt — jeweils mit klarer 422
        statt eines stillen Ersatzwerts (Wurzel 4/5)."""
        if betten and raum_typ not in BETT_RAUMTYPEN:
            raise PropertyError(
                "Schlafmöglichkeiten gibt es nur in Schlafzimmer, Wohnzimmer "
                "und Schlafbereich.",
                status_code=422,
            )
        if en_suite and raum_typ not in ENSUITE_RAUMTYPEN:
            raise PropertyError(
                "„En suite“ gilt nur für Badezimmer und WC.", status_code=422
            )
        if kopplung and not en_suite:
            raise PropertyError(
                "Eine Zuordnung zum Schlafzimmer setzt „en suite“ voraus.",
                status_code=422,
            )
        if not kopplung:
            return
        if kopplung == eigene_id:
            raise PropertyError(
                "Ein Zimmer kann nicht an sich selbst grenzen.", status_code=422
            )
        # Das gekoppelte Schlafzimmer muss zum SELBEN Objekt gehören — sonst
        # zeigte ein Bad auf ein Schlafzimmer eines fremden Objekts.
        ziel = (
            self._db.table("property_rooms")
            .select("id, raum_typ")
            .eq("id", kopplung)
            .eq("property_id", property_id)
            .execute()
        ).data
        if not ziel:
            raise PropertyError("Schlafzimmer nicht gefunden.", status_code=404)
        if ziel[0]["raum_typ"] != "schlafzimmer":
            raise PropertyError(
                "„En suite“ verweist auf ein Schlafzimmer.", status_code=422
            )

    def add_room(
        self, ctx: AuthContext, property_id: str, req: PropertyRoomCreate
    ) -> PropertyRoom:
        """Zimmer anlegen, ans Ende der Reihenfolge."""
        tenant_id = self._require_tenant(ctx)
        self.get(ctx, property_id)
        self._validate_room(
            property_id,
            raum_typ=req.raum_typ,
            betten=req.betten,
            en_suite=req.en_suite,
            kopplung=req.en_suite_schlafzimmer_id,
        )
        vorhanden = (
            self._db.table("property_rooms")
            .select("position")
            .eq("property_id", property_id)
            .order("position", desc=True)
            .limit(1)
            .execute()
        ).data or []
        naechste = (int(vorhanden[0]["position"]) + 1) if vorhanden else 0
        res = (
            self._db.table("property_rooms")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "property_id": property_id,
                    "raum_typ": req.raum_typ,
                    "privat": req.privat,
                    "name": req.name,
                    "position": naechste,
                    "betten": req.betten,
                    "ausstattung": req.ausstattung,
                    "en_suite": req.en_suite,
                    "en_suite_schlafzimmer_id": req.en_suite_schlafzimmer_id,
                }
            )
            .execute()
        )
        if not res.data:
            raise PropertyError("Zimmer konnte nicht angelegt werden.", status_code=500)
        self._content_sync_anstossen(tenant_id, property_id)
        log.info("property_room_added", tenant_id=tenant_id, property_id=property_id)
        return PropertyRoom(**room_row(res.data[0]))

    def update_room(
        self,
        ctx: AuthContext,
        property_id: str,
        room_id: str,
        req: PropertyRoomUpdate,
    ) -> PropertyRoom:
        """Zimmer ändern. Nicht gesetzte Felder bleiben, wie sie sind."""
        tenant_id = self._require_tenant(ctx)
        self.get(ctx, property_id)
        vorhanden = (
            self._db.table("property_rooms")
            .select("*")
            .eq("id", room_id)
            .eq("property_id", property_id)
            .execute()
        ).data
        if not vorhanden:
            raise PropertyError("Zimmer nicht gefunden.", status_code=404)
        alt = vorhanden[0]

        daten = req.model_dump(exclude_unset=True)
        raum_typ = daten.get("raum_typ", alt["raum_typ"])
        betten = daten.get("betten", alt.get("betten") or {})
        en_suite = daten.get("en_suite", bool(alt.get("en_suite")))
        kopplung = daten.get(
            "en_suite_schlafzimmer_id", alt.get("en_suite_schlafzimmer_id")
        )
        kopplung = str(kopplung) if kopplung else None
        self._validate_room(
            property_id,
            raum_typ=raum_typ,
            betten=betten,
            en_suite=en_suite,
            kopplung=kopplung,
            eigene_id=room_id,
        )
        # Gegenzustand (Wurzel 1): wird „en suite" abgewählt, muss die Kopplung
        # mitgehen — sonst bliebe ein Verweis stehen, den niemand mehr sieht.
        if not en_suite:
            daten["en_suite_schlafzimmer_id"] = None

        res = (
            self._db.table("property_rooms")
            .update(daten)
            .eq("id", room_id)
            .eq("property_id", property_id)
            .execute()
        )
        if not res.data:
            raise PropertyError("Zimmer nicht gefunden.", status_code=404)
        self._content_sync_anstossen(tenant_id, property_id)
        return PropertyRoom(**room_row(res.data[0]))

    def delete_room(self, ctx: AuthContext, property_id: str, room_id: str) -> None:
        """Zimmer löschen. Verweist ein Bad per „en suite" darauf, wird die
        Kopplung mitgelöst (Wurzel 1) — die DB setzt sie über ON DELETE SET NULL
        auf NULL, das würde aber ein `en_suite = true` ohne Ziel zurücklassen."""
        tenant_id = self._require_tenant(ctx)
        self.get(ctx, property_id)
        vorhanden = (
            self._db.table("property_rooms")
            .select("id")
            .eq("id", room_id)
            .eq("property_id", property_id)
            .execute()
        ).data
        if not vorhanden:
            raise PropertyError("Zimmer nicht gefunden.", status_code=404)
        self._db.table("property_rooms").update(
            {"en_suite_schlafzimmer_id": None}
        ).eq("property_id", property_id).eq(
            "en_suite_schlafzimmer_id", room_id
        ).execute()
        self._db.table("property_rooms").delete().eq("id", room_id).eq(
            "property_id", property_id
        ).execute()
        self._content_sync_anstossen(tenant_id, property_id)
        log.info("property_room_deleted", tenant_id=tenant_id, property_id=property_id)

    def reorder_rooms(
        self, ctx: AuthContext, property_id: str, room_ids: list[str]
    ) -> PropertyRoomListResponse:
        """Reihenfolge setzen. Die Liste muss GENAU die Zimmer des Objekts
        enthalten — eine Teilliste würde die übrigen still auf Position 0
        zusammenschieben."""
        self.get(ctx, property_id)
        rows = (
            self._db.table("property_rooms")
            .select("id")
            .eq("property_id", property_id)
            .execute()
        ).data or []
        if {str(r["id"]) for r in rows} != set(room_ids) or len(room_ids) != len(rows):
            raise PropertyError(
                "Die Reihenfolge muss genau die Zimmer dieses Objekts enthalten.",
                status_code=422,
            )
        for position, room_id in enumerate(room_ids):
            self._db.table("property_rooms").update({"position": position}).eq(
                "id", room_id
            ).eq("property_id", property_id).execute()
        return self.list_rooms(ctx, property_id)

    # Kein Spiegel nach properties.room_amenities: die Spalte gehoert dem
    # objektweiten Ausstattungs-Editor. Zwei Schreibpfade auf ein Feld heisst,
    # dass einer den anderen still ueberschreibt. Die Vereinigung aus
    # objektweiter und je-Zimmer-Ausstattung bildet der Channel-Manager erst
    # beim Senden (content_sync._zimmer_ausstattung) — Channex kennt je Objekt
    # nur EINEN Room-Type.

    def _content_sync_anstossen(self, tenant_id: str, property_id: str) -> None:
        """Zimmer-Aenderung an die Portale nachziehen (nur die Ausstattung geht
        dort hinaus). Best-effort: ein Fehler darf das Speichern nicht kippen."""
        try:
            row = (
                self._db.table("properties")
                .select("title, currency")
                .eq("tenant_id", tenant_id)
                .eq("id", property_id)
                .execute()
            ).data
            if not row:
                return
            self._sync_to_channel_manager(
                tenant_id,
                property_id=property_id,
                title=row[0].get("title") or "",
                currency=row[0].get("currency"),
            )
        except Exception as exc:  # noqa: BLE001 — Nachzug, kein Hauptpfad
            log.warning(
                "property_room_content_sync_failed",
                property_id=property_id,
                error=str(exc),
            )
