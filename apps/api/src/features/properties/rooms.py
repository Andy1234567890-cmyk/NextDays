"""Zimmer eines Objekts (property_rooms, 0246 · Zuschnitt 0251).

Eigenes Modul, weil Zimmer eine eigene Entitaet sind — aber eine schmale: Typ
und Gruppe (privat/gemeinschaftlich), sonst nichts. Eine Zeile = ein Zimmer,
die Oberflaeche zaehlt sie nur (wie Lodgify, live abgeglichen 01.08.2026).
Der Service bindet das Modul ueber ``RoomsMixin`` ein.

ABGRENZUNG: Betten und Ausstattung haengen am OBJEKT
(properties.type_attributes.beds bzw. properties.room_amenities), nicht am
Zimmer — 0251 hat 0247/0248 dahin zurueckgebaut. An Channex geht von der
Zimmerstruktur ohnehin nichts: beds, bed_configuration, bedrooms und bathrooms
am Room-Type werden verworfen (live gemessen, docs/CHANNEX-FELDER.md).
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Protocol

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.jobs.queue import enqueue

from .errors import PropertyError
from .schemas import (
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
    return {
        "id": str(r["id"]),
        "property_id": str(r["property_id"]),
        "raum_typ": r["raum_typ"],
        "privat": bool(r.get("privat", True)),
        "position": int(r.get("position") or 0),
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

    def add_room(
        self, ctx: AuthContext, property_id: str, req: PropertyRoomCreate
    ) -> PropertyRoom:
        """Zimmer anlegen, ans Ende der Reihenfolge."""
        tenant_id = self._require_tenant(ctx)
        self.get(ctx, property_id)
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
                    "position": naechste,
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
        daten = req.model_dump(exclude_unset=True)
        if not daten:
            raise PropertyError("Keine Änderung angegeben.", status_code=422)
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
        """Zimmer löschen — IDEMPOTENT (Wurzel 2).

        Ist die Zeile schon weg, ist das der ZIELZUSTAND und kein Fehler. Vorher
        antwortete der Endpunkt 404, und das war live zu sehen: der Zähler im
        Zimmer-Editor arbeitet auf einer Momentaufnahme der Liste. Wer zweimal
        auf „−" klickt (oder klickt, bevor das Realtime-Ereignis durch ist),
        schickt dieselbe Zimmer-ID zweimal — der zweite Aufruf lief in einen
        404, und die Oberfläche zeigte „nicht gefunden", obwohl genau das
        Gewünschte passiert war.

        Der Scope bleibt streng: `property_id` MUSS passen (Wurzel 9, gleicher
        Scope wie die Liste). Nur die Unterscheidung „war schon weg" ist kein
        Fehlerfall mehr — eine fremde ID trifft ohnehin keine Zeile.

        `delete()` liefert die gelöschten Zeilen zurück; daran hängt, ob der
        Portal-Nachzug nötig ist. Ohne Löschung ist nichts zu senden.
        """
        tenant_id = self._require_tenant(ctx)
        self.get(ctx, property_id)
        geloescht = (
            self._db.table("property_rooms")
            .delete()
            .eq("id", room_id)
            .eq("property_id", property_id)
            .execute()
        ).data
        if not geloescht:
            log.info(
                "property_room_delete_bereits_weg",
                tenant_id=tenant_id, property_id=property_id, room_id=room_id,
            )
            return
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

    def _content_sync_anstossen(self, tenant_id: str, property_id: str) -> None:
        """Zimmer-Aenderung an die Portale nachziehen.

        ZWEI Wege, weil Channex und Airbnb Verschiedenes annehmen:
          * Channex' Room-Type nimmt von der Zimmerstruktur NICHTS an (beds,
            bed_configuration, bedrooms, bathrooms werden verworfen — live
            gemessen, docs/CHANNEX-FELDER.md). Der Content-Sync haelt hier nur
            den uebrigen Objekt-Content aktuell.
          * AIRBNB fuehrt die Raeume dagegen als eigene Ressource und nimmt sie
            ueber Channex' api_proxy an. Genau der Weg fehlte: eine Aenderung in
            unserer Maske erreichte die Anzeige nie — live gemessen an „Holiday
            house Cornflower", wo der geloeschte Balkon bei Airbnb online blieb
            und der wieder hinzugefuegte dort nie ankam. Das ist Wurzel 1: eine
            Aktion ohne Gegenzustand nach aussen, und sie fiel nicht auf, weil
            nie etwas versucht wurde (kein Fehler im Log).

        Best-effort: ein Fehler darf das Speichern nicht kippen."""
        self._airbnb_zimmer_anstossen(tenant_id, property_id)
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

    def _airbnb_zimmer_anstossen(self, tenant_id: str, property_id: str) -> None:
        """Die Zimmer an die Airbnb-Anzeige nachziehen (Job, nicht inline).

        Als Job und nicht direkt im Request, weil der Abgleich mehrere Aufrufe an
        Airbnb macht (einmal lesen, dann je Raum anlegen/loeschen) — das gehoert
        nicht in die Antwortzeit eines Klicks, und der Job wiederholt sich bei
        einem Ausfall von selbst.

        `dedup_key` je Objekt: wer in der Maske fuenf Zimmer hintereinander
        anhakt, loest EINEN Abgleich aus, nicht fuenf. Der Job liest ohnehin den
        Endstand (Wurzel 2 — Coalescing statt Doppelarbeit).

        Best effort beim EINREIHEN: ein Job, der sich nicht einreihen laesst,
        darf das Speichern nicht kippen. Der Job selbst faellt dagegen laut aus,
        wenn Airbnb den Schreibaufruf ablehnt — sonst hiesse „gespeichert", die
        Anzeige waere aktuell (Wurzel 5).
        """
        try:
            enqueue(
                self._db, "sync_airbnb_zimmer", tenant_id=tenant_id,
                payload={"tenant_id": tenant_id, "property_id": property_id},
                dedup_key=f"airbnb_zimmer:{property_id}",
            )
        except Exception as exc:  # noqa: BLE001 — Einreihen, kein Hauptpfad
            log.warning(
                "property_room_airbnb_enqueue_failed",
                property_id=property_id, error=str(exc)[:200],
            )
