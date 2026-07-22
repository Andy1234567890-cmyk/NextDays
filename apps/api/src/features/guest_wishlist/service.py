"""Service-Schicht für guest_wishlist — Merkzettel des Kunden-Dashboards.

Ein Portal-Gast (CurrentGuest) führt mehrere Merkzettel und legt Objekte hinein.
Die Tabellen ``wishlists``/``wishlist_items`` sind per anon-/authenticated-GRANT
gesperrt (Migration 0181, Wurzel 6) → alle Zugriffe laufen über den
Service-Role-Client, der RLS umgeht. Deshalb MUSS jeder per-ID-Zugriff explizit
auf ``portal_guest_id == guest_id`` gescopet werden (Wurzel 3/9): eine fremde
Liste liefert 404 (kein Existenz-Leak), NICHT nur „nicht gefunden, weil leer".

Die Item-Anreicherung liest gast-sichere Objektfelder (Titel/Foto/Ort/Währung/
ab-Preis). Währung kommt aus dem Objekt (properties.currency, 0161); fehlt ein
Preis, bleibt er ``None`` — nie €-Hardcode/Fantasiepreis (Wurzel 4). Als
``bookable`` gilt ein Objekt nur, wenn es aktuell verkäuflich ist (status='active'
UND auf dem Marktplatz gelistet).
"""
from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger

from .schemas import (
    MessageResponse,
    SliceHealth,
    WishlistCreateRequest,
    WishlistDetailResponse,
    WishlistItem,
    WishlistItemAddRequest,
    WishlistListResponse,
    WishlistSummary,
)

log = get_logger("nextdays.guest_wishlist")

# Gast-sichere Objektfelder für die Item-Anreicherung (NIE tenant_id/Eigentümer/
# interne Preisdetails). currency ist die Objektwährung (0161).
_PUBLIC_PROPERTY_COLUMNS = (
    "id, title, photos, city, country, currency, status, listed_on_marketplace"
)

# Harte Obergrenze der zurückgegebenen Einträge/Listen (Wurzel 8): der Merkzettel
# ist praktisch klein, aber ein unbegrenzter Range darf die Antwort/DB nicht
# aufblähen. Über dem Wird getruncated + geloggt (keine stille Begrenzung).
_MAX_ITEMS = 500
_MAX_LISTS = 200


class WishlistError(Exception):
    """Fachlicher Merkzettel-Fehler; vom Router auf HTTP-Status gemappt."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _as_opt_float(value: object) -> float | None:
    """DB-Wert → float oder None (kein erfundener 0-Preis)."""
    if value is None:
        return None
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


class GuestWishlistService:
    slice_name = "guest_wishlist"

    def __init__(self, service_client: Client | None = None) -> None:
        # Service-Role: die Tabellen sind per anon-GRANT gesperrt (0181). Der
        # tenant-lose Scope (portal_guest_id) wird hier serverseitig erzwungen.
        self._client = service_client

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def _db(self) -> Client:
        if self._client is None:
            raise WishlistError("Merkzettel-DB nicht verfügbar.", status_code=500)
        return self._client

    # -- Scope-Helfer --------------------------------------------------------
    def _require_own_wishlist(self, wishlist_id: str, guest_id: str) -> dict:
        """EINE Wishlist per ID laden UND den Gast-Scope in EINEM Schritt erzwingen.

        Analog zu ``core.supabase.load_scoped`` (das auf tenant_id scopet) — hier
        auf ``portal_guest_id``, weil ein Portal-Gast keinen Tenant hat. Filtert
        direkt per (id, portal_guest_id): eine fremde/nicht existierende Liste
        liefert 404 mit derselben Meldung (kein Existenz-Leak, Wurzel 3/9).
        """
        rows = (
            self._db()
            .table("wishlists")
            .select("id, name, portal_guest_id")
            .eq("id", wishlist_id)
            .eq("portal_guest_id", guest_id)
            .limit(1)
            .execute()
        ).data or []
        if not rows:
            raise WishlistError("Merkzettel nicht gefunden.", status_code=404)
        return rows[0]

    # -- Listen --------------------------------------------------------------
    def list_wishlists(self, guest_id: str) -> WishlistListResponse:
        """Alle Merkzettel des Gasts (nur eigene) mit Item-Anzahl."""
        rows = (
            self._db()
            .table("wishlists")
            .select("id, name, created_at, updated_at")
            .eq("portal_guest_id", guest_id)
            .order("created_at")
            .limit(_MAX_LISTS)
            .execute()
        ).data or []
        counts = self._item_counts([str(r["id"]) for r in rows])
        items = [
            WishlistSummary(
                id=str(r["id"]),
                name=r.get("name") or "",
                item_count=counts.get(str(r["id"]), 0),
                created_at=r.get("created_at"),
                updated_at=r.get("updated_at"),
            )
            for r in rows
        ]
        return WishlistListResponse(items=items, total=len(items))

    def _item_counts(self, wishlist_ids: list[str]) -> dict[str, int]:
        """Item-Anzahl je Merkzettel in EINER Query (kein N+1)."""
        if not wishlist_ids:
            return {}
        rows = (
            self._db()
            .table("wishlist_items")
            .select("wishlist_id")
            .in_("wishlist_id", wishlist_ids)
            .execute()
        ).data or []
        counts: dict[str, int] = {}
        for r in rows:
            wid = str(r.get("wishlist_id"))
            counts[wid] = counts.get(wid, 0) + 1
        return counts

    def create_wishlist(
        self, guest_id: str, req: WishlistCreateRequest
    ) -> WishlistSummary:
        """Neuen Merkzettel anlegen. Der Name kommt aus dem Request (nicht
        hardcodiert) — die UI schlägt „Meine Favoriten" als ersten Namen vor,
        die Fachlogik bleibt aber eine schlichte Liste."""
        row = (
            self._db()
            .table("wishlists")
            .insert({"portal_guest_id": guest_id, "name": req.name})
            .execute()
        ).data
        if not row:
            raise WishlistError("Merkzettel konnte nicht angelegt werden.", status_code=500)
        created = row[0]
        log.info("wishlist_created", guest_id=guest_id, wishlist_id=created["id"])
        return WishlistSummary(
            id=str(created["id"]),
            name=created.get("name") or "",
            item_count=0,
            created_at=created.get("created_at"),
            updated_at=created.get("updated_at"),
        )

    def delete_wishlist(self, guest_id: str, wishlist_id: str) -> MessageResponse:
        """Merkzettel löschen (Scope-Check). Items entfernt die DB per Cascade."""
        self._require_own_wishlist(wishlist_id, guest_id)
        self._db().table("wishlists").delete().eq("id", wishlist_id).eq(
            "portal_guest_id", guest_id
        ).execute()
        log.info("wishlist_deleted", guest_id=guest_id, wishlist_id=wishlist_id)
        return MessageResponse(ok=True, detail="Merkzettel gelöscht.")

    # -- Items ---------------------------------------------------------------
    def get_items(self, guest_id: str, wishlist_id: str) -> WishlistDetailResponse:
        """Items einer eigenen Liste, angereichert mit gast-sicherer Objekt-Info."""
        wl = self._require_own_wishlist(wishlist_id, guest_id)
        item_rows = (
            self._db()
            .table("wishlist_items")
            .select("property_id, note, created_at")
            .eq("wishlist_id", wishlist_id)
            .order("created_at")
            .limit(_MAX_ITEMS)
            .execute()
        ).data or []
        prop_ids = [str(r["property_id"]) for r in item_rows]
        props = self._properties_by_id(prop_ids)
        # „ab"-Preis je Objekt gebündelt (kein N+1). Nur für buchbare Objekte
        # relevant; fehlt ein Rate-Plan, bleibt der Preis None (Wurzel 4).
        base_prices = self._base_prices(list(props.keys()))
        items = [
            self._to_item(
                r,
                props.get(str(r["property_id"])),
                base_prices.get(str(r["property_id"])),
            )
            for r in item_rows
        ]
        return WishlistDetailResponse(
            id=str(wl["id"]), name=wl.get("name") or "", items=items
        )

    def _properties_by_id(self, property_ids: list[str]) -> dict[str, dict]:
        """Gast-sichere Objektfelder für alle Item-Objekte in EINER Query."""
        unique_ids = list(dict.fromkeys(property_ids))
        if not unique_ids:
            return {}
        rows = (
            self._db()
            .table("properties")
            .select(_PUBLIC_PROPERTY_COLUMNS)
            .in_("id", unique_ids)
            .execute()
        ).data or []
        return {str(r["id"]): r for r in rows}

    def _base_prices(self, property_ids: list[str]) -> dict[str, float | None]:
        """„ab"-Basispreis je Objekt aus dem ältesten Rate-Plan — EINE Query.

        Pro Objekt gewinnt der zuerst erstellte Plan (order created_at). Fehlt ein
        Plan, taucht das Objekt hier nicht auf → der Preis bleibt None (Wurzel 4).
        Die Währung stammt aus dem Objekt (properties.currency, 0161), nicht hier.
        """
        if not property_ids:
            return {}
        rows = (
            self._db()
            .table("rate_plans")
            .select("property_id, base_price, created_at")
            .in_("property_id", property_ids)
            .order("created_at")
            .execute()
        ).data or []
        out: dict[str, float | None] = {}
        for r in rows:
            pid = str(r.get("property_id"))
            if pid in out:  # ältester Plan zuerst → behalten
                continue
            out[pid] = _as_opt_float(r.get("base_price"))
        return out

    @staticmethod
    def _to_item(
        item_row: dict, prop: dict | None, price_from: float | None
    ) -> WishlistItem:
        """Ein Item + (optionale) Objektdaten in die gast-sichere Sicht mappen.

        Ein zwischenzeitlich gelöschtes Objekt (prop=None) liefert nur IDs/Note;
        buchbar ist nur ein aktuell verkäufliches Objekt (status='active' UND
        Marktplatz-Listung). Preis bleibt None, wenn keiner vorliegt (Wurzel 4)."""
        if prop is None:
            return WishlistItem(
                property_id=str(item_row["property_id"]),
                note=item_row.get("note"),
                created_at=item_row.get("created_at"),
            )
        photos = prop.get("photos") or []
        first_photo = photos[0] if photos else None
        bookable = (
            prop.get("status") == "active"
            and bool(prop.get("listed_on_marketplace"))
        )
        return WishlistItem(
            property_id=str(item_row["property_id"]),
            note=item_row.get("note"),
            created_at=item_row.get("created_at"),
            title=prop.get("title"),
            photo=first_photo,
            city=prop.get("city"),
            country=prop.get("country"),
            currency=prop.get("currency") or "",
            price_from=price_from,
            bookable=bookable,
        )

    def add_item(
        self, guest_id: str, wishlist_id: str, req: WishlistItemAddRequest
    ) -> MessageResponse:
        """Objekt (+ optionale Notiz) hinzufügen.

        Idempotent (Wurzel 2): das ``unique(wishlist_id, property_id)`` aus 0181
        ist der Backstop — ein zweiter Add desselben Objekts ist kein Fehler,
        sondern ein No-op (200). Umgesetzt per ``on_conflict``-Upsert; die
        23505-Verletzung wird zusätzlich defensiv als Erfolg gewertet (falls ein
        Upsert-Pfad sie doch durchreicht). Das Objekt muss existieren (sonst 404)
        — Scope-Check auf die Wishlist vorab (Wurzel 3/9).
        """
        self._require_own_wishlist(wishlist_id, guest_id)
        if not self._property_exists(req.property_id):
            raise WishlistError("Objekt nicht gefunden.", status_code=404)
        try:
            self._db().table("wishlist_items").upsert(
                {
                    "wishlist_id": wishlist_id,
                    "property_id": req.property_id,
                    "note": req.note,
                },
                on_conflict="wishlist_id,property_id",
            ).execute()
        except APIError as exc:
            # Doppelte Anlage (Race/Retry) ist erwünschtes No-op, kein 500.
            if getattr(exc, "code", None) != "23505":
                raise
        log.info(
            "wishlist_item_added",
            guest_id=guest_id,
            wishlist_id=wishlist_id,
            property_id=req.property_id,
        )
        return MessageResponse(ok=True, detail="Objekt gemerkt.")

    def _property_exists(self, property_id: str) -> bool:
        rows = (
            self._db()
            .table("properties")
            .select("id")
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data or []
        return bool(rows)

    def remove_item(
        self, guest_id: str, wishlist_id: str, property_id: str
    ) -> MessageResponse:
        """Objekt aus einer eigenen Liste entfernen (Scope-Check auf die Liste)."""
        self._require_own_wishlist(wishlist_id, guest_id)
        self._db().table("wishlist_items").delete().eq(
            "wishlist_id", wishlist_id
        ).eq("property_id", property_id).execute()
        log.info(
            "wishlist_item_removed",
            guest_id=guest_id,
            wishlist_id=wishlist_id,
            property_id=property_id,
        )
        return MessageResponse(ok=True, detail="Objekt entfernt.")
