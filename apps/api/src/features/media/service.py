"""Service für das Bilder-Modul (PM „Bilder").

Aggregiert Objektfotos (property_photos) und Buchungs-/Aufgabenfotos
(checklist_photos) zu einer tenant-scoped Liste. Objektfotos tragen die URL
fertig; Buchungsfotos liegen im privaten Bucket `task-photos` → signierte URL.
Wurzel 3: JEDE Query zusätzlich .eq("tenant_id", …) bzw. über die tenant-
gefilterte Task-Menge; Service-Role umgeht RLS.
"""
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.auth.owner_scope import is_owner, owner_property_ids
from src.features.auth.staff_scope import is_staff, staff_property_ids

from .schemas import MediaItem, MediaKind

log = get_logger("nextdays.media")

_SIGNED_URL_TTL = 3600  # Sekunden
_TASK_PHOTO_BUCKET = "task-photos"


def sign_task_photo(db: Client, path: str) -> str | None:
    """Signierte Download-URL für ein Foto im privaten Bucket `task-photos`.

    Modul-Funktion, weil außer dem Bilder-Modul auch die Inspektion die Fotos
    anzeigen muss — dort war bis dahin nur der Storage-PFAD zu sehen, also gar
    kein Bild. Fehler ergeben None (Bild fällt aus), nie eine tote URL.
    """
    try:
        signed = db.storage.from_(_TASK_PHOTO_BUCKET).create_signed_url(
            path, _SIGNED_URL_TTL
        )
    except Exception as exc:  # noqa: BLE001 — ein Storage-Fehler überspringt ein Bild
        log.warning("task_photo_sign_failed", path=path, error=str(exc))
        return None
    if isinstance(signed, dict):
        return signed.get("signedURL") or signed.get("signedUrl")
    return None


class MediaError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class MediaService:
    slice_name = "media"

    def __init__(self, client: Client | None = None) -> None:
        self._client = client

    def _db(self) -> Client:
        if self._client is None:
            raise MediaError("Bilder-DB nicht verfügbar.", status_code=500)
        return self._client

    def list_media(
        self,
        tenant_id: str,
        *,
        include_booking: bool = True,
        include_property: bool = True,
        property_id: str | None = None,
        ctx: AuthContext | None = None,
    ) -> list[MediaItem]:
        """Bilder-Karten des Tenants, eingeschränkt auf den Objekt-Scope der
        Rolle (§4.2 owner, §4.3 staff).

        `property_id` ist ein FILTER des Nutzers, KEIN Scope: ohne ihn bekäme
        ein Eigentümer sonst sämtliche Objekt- und Buchungsfotos des ganzen
        Betriebs. Der Scope wird deshalb serverseitig aus der Rolle abgeleitet
        und der Filter nur als Schnittmenge darauf angewandt (Wurzel 3) —
        dasselbe Muster wie `reservations.reads.list`.
        """
        scope = self._role_scope(ctx)
        if scope is not None and not scope:
            return []  # fail-closed: ohne Zuordnung keine Bilder
        pids = self._scoped_property_ids(scope, property_id)
        if pids is not None and not pids:
            return []
        items: list[MediaItem] = []
        if include_property:
            items.extend(self._property_photos(tenant_id, property_id, pids))
        if include_booking:
            items.extend(self._booking_photos(tenant_id, property_id, pids))
        # Neueste zuerst; None-Datum ans Ende.
        items.sort(
            key=lambda m: (m.uploaded_at is not None, m.uploaded_at),
            reverse=True,
        )
        return items

    # --- Rollen-Scope (§4.2 owner, §4.3 staff) ---

    def _role_scope(self, ctx: AuthContext | None) -> set[str] | None:
        """Objekt-IDs, auf die die Rolle eingeschränkt ist.

        `None` = keine Einschränkung (admin/co_admin sehen den ganzen Tenant).
        Menge (ggf. leer) = nur diese Objekte, fail-closed.
        """
        if ctx is None:
            return None
        if is_owner(ctx):
            return owner_property_ids(self._db(), ctx)
        if is_staff(ctx):
            return staff_property_ids(self._db(), ctx)
        return None

    @staticmethod
    def _scoped_property_ids(
        scope: set[str] | None, property_id: str | None
    ) -> set[str] | None:
        """Rollen-Scope und Nutzer-Filter zur Schnittmenge verbinden.

        Ein vom Client übergebenes `property_id` darf den Scope NIE ausweiten:
        liegt es außerhalb, bleibt die Menge leer (→ keine Bilder), statt den
        Filter einfach zu übernehmen.
        """
        if scope is None:
            return {property_id} if property_id else None
        if property_id:
            return {property_id} & scope
        return scope

    # --- Objektfotos (property_photos, URL fertig) ---

    def _property_photos(
        self, tenant_id: str, property_id: str | None, scope: set[str] | None
    ) -> list[MediaItem]:
        pids = self._owned_property_ids(tenant_id, property_id, scope)
        if not pids:
            return []
        titles = self._property_titles(tenant_id, pids)
        rows = (
            self._db()
            .table("property_photos")
            .select("id, property_id, url, author, created_at")
            .in_("property_id", list(pids))
            .order("created_at", desc=True)
            .execute()
        ).data or []
        return [
            MediaItem(
                id=r["id"],
                kind=MediaKind.property,
                url=r["url"],
                property_id=r.get("property_id"),
                property_title=titles.get(r.get("property_id") or ""),
                author=r.get("author"),
                uploaded_at=r.get("created_at"),
            )
            for r in rows
        ]

    # --- Buchungs-/Aufgabenfotos (checklist_photos, signierte URL) ---

    def _booking_photos(
        self, tenant_id: str, property_id: str | None, scope: set[str] | None
    ) -> list[MediaItem]:
        # 1) Tasks des Tenants (optional auf Objekt gefiltert) → item-Menge.
        task_q = (
            self._db()
            .table("tasks")
            .select("id, title, property_id, reservation_id")
            .eq("tenant_id", tenant_id)
        )
        if property_id:
            task_q = task_q.eq("property_id", property_id)
        elif scope is not None:
            task_q = task_q.in_("property_id", list(scope))
        tasks = {t["id"]: t for t in (task_q.execute().data or [])}
        if scope is not None:
            # Aufgaben OHNE Objektbezug (Pool: Lager/Büro) fallen für die
            # eingeschränkten Rollen heraus — ihre Fotos gehören keinem der
            # zugeordneten Objekte, sind also außerhalb des Scopes.
            tasks = {
                tid: t for tid, t in tasks.items() if t.get("property_id") in scope
            }
        if not tasks:
            return []
        items = (
            self._db()
            .table("checklist_items")
            .select("id, task_id")
            .in_("task_id", list(tasks))
            .execute()
        ).data or []
        item_task = {i["id"]: i["task_id"] for i in items}
        if not item_task:
            return []
        photos = (
            self._db()
            .table("checklist_photos")
            .select("id, item_id, storage_path, created_at")
            .in_("item_id", list(item_task))
            .order("created_at", desc=True)
            .execute()
        ).data or []
        titles = self._property_titles(
            tenant_id, {t.get("property_id") for t in tasks.values()}
        )
        reservations = self._reservation_dates(
            tenant_id, {t.get("reservation_id") for t in tasks.values()}
        )
        out: list[MediaItem] = []
        for p in photos:
            task = tasks.get(item_task.get(p["item_id"], ""))
            if task is None:
                continue
            url = self._sign(p["storage_path"])
            if not url:
                continue
            rid = task.get("reservation_id")
            resv = reservations.get(rid) if rid else None
            out.append(
                MediaItem(
                    id=p["id"],
                    kind=MediaKind.booking,
                    url=url,
                    property_id=task.get("property_id"),
                    property_title=titles.get(task.get("property_id") or ""),
                    reservation_id=rid,
                    task_title=task.get("title"),
                    uploaded_at=p.get("created_at"),
                    check_in=resv.get("check_in") if resv else None,
                    check_out=resv.get("check_out") if resv else None,
                )
            )
        return out

    def _sign(self, path: str) -> str | None:
        """Signierte Download-URL für den privaten task-photos-Bucket."""
        return sign_task_photo(self._db(), path)

    # --- Löschen ---

    def delete_media(
        self,
        tenant_id: str,
        kind: str,
        media_id: str,
        ctx: AuthContext | None = None,
    ) -> None:
        scope = self._role_scope(ctx)
        if kind == "property":
            self._delete_property_photo(tenant_id, media_id, scope)
        elif kind == "booking":
            self._delete_booking_photo(tenant_id, media_id, scope)
        else:
            raise MediaError("Unbekannte Bildart.", status_code=422)

    def _delete_property_photo(
        self, tenant_id: str, media_id: str, scope: set[str] | None = None
    ) -> None:
        # Nur eigene Objektfotos (über property→tenant + Rollen-Scope).
        row = (
            self._db()
            .table("property_photos")
            .select("id, property_id")
            .eq("id", media_id)
            .limit(1)
            .execute()
        ).data
        if not row:
            raise MediaError("Bild nicht gefunden.", status_code=404)
        owned = self._owned_property_ids(tenant_id, row[0]["property_id"], scope)
        if not owned:
            raise MediaError("Bild nicht gefunden.", status_code=404)
        self._db().table("property_photos").delete().eq("id", media_id).execute()

    def _delete_booking_photo(
        self, tenant_id: str, media_id: str, scope: set[str] | None = None
    ) -> None:
        # checklist_photos → item → task(tenant). IDOR-Guard über die Kette.
        photo = (
            self._db()
            .table("checklist_photos")
            .select("id, item_id, storage_path")
            .eq("id", media_id)
            .limit(1)
            .execute()
        ).data
        if not photo:
            raise MediaError("Bild nicht gefunden.", status_code=404)
        item = (
            self._db()
            .table("checklist_items")
            .select("task_id")
            .eq("id", photo[0]["item_id"])
            .limit(1)
            .execute()
        ).data
        if not item:
            raise MediaError("Bild nicht gefunden.", status_code=404)
        owns = (
            self._db()
            .table("tasks")
            .select("id, property_id")
            .eq("id", item[0]["task_id"])
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not owns:
            raise MediaError("Bild nicht gefunden.", status_code=404)
        # Rollen-Scope: das Foto hängt über die Aufgabe an einem Objekt, das im
        # Scope liegen MUSS (Wurzel 9 — gleicher Scope wie der List-Pfad).
        if scope is not None and owns[0].get("property_id") not in scope:
            raise MediaError("Bild nicht gefunden.", status_code=404)
        path = photo[0].get("storage_path")
        if path:
            try:
                self._db().storage.from_(_TASK_PHOTO_BUCKET).remove([path])
            except Exception as exc:  # noqa: BLE001 — Storage best-effort, DB führt
                log.warning("task_photo_remove_failed", path=path, error=str(exc))
        self._db().table("checklist_photos").delete().eq("id", media_id).execute()

    # --- Helfer ---

    def _owned_property_ids(
        self,
        tenant_id: str,
        property_id: str | None,
        scope: set[str] | None = None,
    ) -> set[str]:
        """Objekte des Tenants, zusätzlich auf den Rollen-Scope geschnitten.

        `scope=None` = keine Rollen-Einschränkung (admin/co_admin).
        """
        q = (
            self._db()
            .table("properties")
            .select("id")
            .eq("tenant_id", tenant_id)
        )
        if property_id:
            q = q.eq("id", property_id)
        pids = {r["id"] for r in (q.execute().data or [])}
        if scope is not None:
            pids &= scope
        return pids

    def _property_titles(
        self, tenant_id: str, ids: set[str | None]
    ) -> dict[str, str]:
        clean = {i for i in ids if i}
        if not clean:
            return {}
        rows = (
            self._db()
            .table("properties")
            .select("id, title")
            .eq("tenant_id", tenant_id)
            .in_("id", list(clean))
            .execute()
        ).data or []
        return {r["id"]: r.get("title") or "" for r in rows}

    def _reservation_dates(
        self, tenant_id: str, ids: set[str | None]
    ) -> dict[str, dict[str, str]]:
        clean = {i for i in ids if i}
        if not clean:
            return {}
        rows = (
            self._db()
            .table("reservations")
            .select("id, check_in, check_out")
            .eq("tenant_id", tenant_id)
            .in_("id", list(clean))
            .execute()
        ).data or []
        return {
            r["id"]: {"check_in": r["check_in"], "check_out": r["check_out"]}
            for r in rows
        }
