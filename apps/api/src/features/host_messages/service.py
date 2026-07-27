"""Service des host_messages-Slice — Betrieb-Seite des PLATTFORM-Posteingangs.

Chat der EIGENEN Plattform (/plattform): guest_message_threads + guest_messages,
portal_guest ↔ Betrieb. NICHT der OTA/Channel-Manager-inbox. Der Gastgeber liest
seine Tenant-Threads und antwortet als 'host'. Scope IMMER auf ctx.tenant_id
(Wurzel 3) — der service_role-Client umgeht RLS.

Betrieb-Flags (gelesen/archiviert) liegen auf dem Thread (host_read_at,
host_archived). „Ungelesen" = Gast-Nachricht neuer als host_read_at.
"""
from __future__ import annotations

import re
from datetime import UTC, date, datetime

import nh3
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import fetch_all_rows
from src.features.auth.granular_permissions import effective_permissions
from src.features.auth.guest_masking import GuestMask, mask_for
from src.features.auth.schemas import UserRole
from src.features.guest_blocks.service import GuestBlockService

from .schemas import (
    HostMessageView,
    HostReservationDetail,
    HostThreadDetail,
    HostThreadListResponse,
    HostThreadSummary,
    QuickReply,
    QuickReplyList,
    QuickReplyUpsert,
)

log = get_logger("nextdays.host_messages")

_MAX_THREADS = 500
_MAX_MESSAGES = 1000
_MAX_BODY_LEN = 5000


class HostMessagesError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _sanitize(raw: str) -> str:
    """Host-Nachricht zu reinem Text säubern (Wurzel 8) + Länge cappen (→422)."""
    clean = nh3.clean(raw or "", tags=set()).strip()
    if not clean:
        raise HostMessagesError("Nachricht ist leer.", status_code=422)
    if len(clean) > _MAX_BODY_LEN:
        raise HostMessagesError("Nachricht ist zu lang.", status_code=422)
    return clean


class HostMessagesService:
    def __init__(self, db: Client) -> None:
        self._db = db
        self._blocks = GuestBlockService(db)

    def _mask(self, ctx: AuthContext) -> GuestMask:
        """Gast-Feldmaske des aufrufenden Nutzers (§4.3-Datensplit, Wurzel 6/9).
        Rolle + Berechtigungen aus der DB (Quelle der Wahrheit, NICHT ctx.role im
        JWT — eine entzogene Rolle würde sonst bis Token-Ablauf gelten, Wurzel 7).
        Ohne passende Berechtigung fail-closed maskiert (nur Vorname, kein Kontakt,
        keine Beträge). Admin hat über effective_permissions alle Rechte."""
        row = (
            self._db.table("users")
            .select("role, permissions")
            .eq("id", ctx.user_id)
            .limit(1)
            .execute()
        ).data
        r = row[0] if row else {}
        try:
            role = UserRole(r["role"]) if r.get("role") else None
        except ValueError:
            role = None
        return mask_for(role, effective_permissions(role, r.get("permissions")))

    # -- Threads ------------------------------------------------------------

    def list_threads(
        self,
        ctx: AuthContext,
        *,
        only_unread: bool = False,
        archived: bool = False,
        query: str | None = None,
    ) -> HostThreadListResponse:
        """Threads des Betriebs, neueste zuerst. archived=True → Archiv-Ansicht.
        only_unread → nur Threads mit ungelesenen Gast-Nachrichten. query →
        Suche in Gastname/E-Mail/Objekttitel."""
        if not ctx.tenant_id:
            return HostThreadListResponse(threads=[])
        rows = (
            self._db.table("guest_message_threads")
            .select(
                "id, portal_guest_id, property_id, reservation_id, "
                "last_message_at, host_read_at, host_archived, created_at"
            )
            .eq("tenant_id", ctx.tenant_id)
            .eq("host_archived", archived)
            .order("last_message_at", desc=True)
            .order("created_at", desc=True)
            .limit(_MAX_THREADS)
            .execute()
        ).data or []
        if not rows:
            return HostThreadListResponse(threads=[])

        thread_ids = [r["id"] for r in rows]
        guests = self._guests({r["portal_guest_id"] for r in rows})
        titles = self._property_titles({r["property_id"] for r in rows if r.get("property_id")})
        stays = self._stays({r["reservation_id"] for r in rows if r.get("reservation_id")})
        previews = self._last_messages(thread_ids)
        unread = self._unread_counts(rows)
        blocked = self._blocked_guest_ids(ctx.tenant_id)
        mask = self._mask(ctx)

        summaries: list[HostThreadSummary] = []
        for r in rows:
            g = guests.get(r["portal_guest_id"], {})
            n = unread.get(r["id"], 0)
            if only_unread and n == 0:
                continue
            if query and not self._matches(query, g, titles.get(r.get("property_id"))):
                continue
            stay = stays.get(r.get("reservation_id"), {})
            summaries.append(
                HostThreadSummary(
                    id=r["id"],
                    portal_guest_id=r["portal_guest_id"],
                    guest_name=mask.name(g.get("name")),
                    guest_email=mask.contact_value(g.get("email")),
                    property_id=r.get("property_id"),
                    property_title=titles.get(r.get("property_id")),
                    reservation_id=r.get("reservation_id"),
                    check_in=stay.get("check_in"),
                    check_out=stay.get("check_out"),
                    last_message=previews.get(r["id"]),
                    last_message_at=r.get("last_message_at"),
                    unread_count=n,
                    is_archived=bool(r.get("host_archived")),
                    is_blocked=r["portal_guest_id"] in blocked,
                    created_at=r.get("created_at"),
                )
            )
        return HostThreadListResponse(threads=summaries)

    def get_thread(self, ctx: AuthContext, thread_id: str) -> HostThreadDetail:
        """Nachrichten eines Threads (Betrieb-Scope). Markiert den Thread als vom
        Betrieb gelesen (host_read_at=now) — idempotent."""
        thread = self._own_thread(ctx, thread_id)
        msgs = (
            self._db.table("guest_messages")
            .select("id, sender, body, created_at")
            .eq("thread_id", thread_id)
            .order("created_at", desc=False)
            .limit(_MAX_MESSAGES)
            .execute()
        ).data or []
        # Gelesen-Marke setzen (Betrieb hat den Thread geöffnet).
        self._db.table("guest_message_threads").update(
            {"host_read_at": _now_iso()}
        ).eq("id", thread_id).eq("tenant_id", ctx.tenant_id).execute()

        g = self._guests({thread["portal_guest_id"]}).get(thread["portal_guest_id"], {})
        title = self._property_titles(
            {thread["property_id"]} if thread.get("property_id") else set()
        ).get(thread.get("property_id"))
        blocked = thread["portal_guest_id"] in self._blocked_guest_ids(ctx.tenant_id)
        mask = self._mask(ctx)
        return HostThreadDetail(
            id=thread["id"],
            portal_guest_id=thread["portal_guest_id"],
            guest_name=mask.name(g.get("name")),
            guest_email=mask.contact_value(g.get("email")),
            property_id=thread.get("property_id"),
            property_title=title,
            reservation_id=thread.get("reservation_id"),
            is_archived=bool(thread.get("host_archived")),
            is_blocked=blocked,
            messages=[HostMessageView(**m) for m in msgs],
        )

    def send_message(
        self, ctx: AuthContext, thread_id: str, body: str
    ) -> HostMessageView:
        """Betrieb sendet eine Nachricht (sender='host', serverseitig gesetzt)."""
        self._own_thread(ctx, thread_id)
        clean = _sanitize(body)
        now = _now_iso()
        inserted = (
            self._db.table("guest_messages")
            .insert(
                {"thread_id": thread_id, "sender": "host", "body": clean, "created_at": now}
            )
            .execute()
        ).data[0]
        # Thread-Aktualität + eigene Gelesen-Marke nachziehen (Wurzel 1).
        self._db.table("guest_message_threads").update(
            {"last_message_at": now, "host_read_at": now}
        ).eq("id", thread_id).eq("tenant_id", ctx.tenant_id).execute()
        return HostMessageView(**inserted)

    def set_flags(
        self, ctx: AuthContext, thread_id: str, *, is_archived: bool | None
    ) -> None:
        """Betrieb-Flags setzen (archivieren/reaktivieren)."""
        self._own_thread(ctx, thread_id)
        patch: dict = {}
        if is_archived is not None:
            patch["host_archived"] = is_archived
        if not patch:
            return
        self._db.table("guest_message_threads").update(patch).eq(
            "id", thread_id
        ).eq("tenant_id", ctx.tenant_id).execute()

    def reservation_detail(
        self, ctx: AuthContext, thread_id: str
    ) -> HostReservationDetail:
        """Rechte Spalte: Objekt + Reservierungs-/Zahldetails des Threads. Beträge
        und Gastname sind rollen-maskiert (§4.3: staff/cleaner ohne Finanzeinblick,
        Wurzel 6/9)."""
        thread = self._own_thread(ctx, thread_id)
        mask = self._mask(ctx)
        detail = HostReservationDetail(property_id=thread.get("property_id"))

        if thread.get("property_id"):
            prop = (
                self._db.table("properties")
                .select("title, city, country, photos")
                .eq("id", thread["property_id"])
                .eq("tenant_id", ctx.tenant_id)
                .limit(1)
                .execute()
            ).data
            if prop:
                p = prop[0]
                detail.property_title = p.get("title")
                detail.city = p.get("city")
                detail.country = p.get("country")
                detail.property_photos = p.get("photos") or []

        if thread.get("reservation_id"):
            res = (
                self._db.table("reservations")
                .select(
                    "check_in, check_out, num_guests, status, total_amount, "
                    "paid_amount, currency, payment_status, cancel_reason, cancelled_at"
                )
                .eq("id", thread["reservation_id"])
                .eq("tenant_id", ctx.tenant_id)
                .limit(1)
                .execute()
            ).data
            if res:
                r = res[0]
                detail.check_in = r.get("check_in")
                detail.check_out = r.get("check_out")
                detail.num_guests = r.get("num_guests")
                detail.status = r.get("status")
                detail.total_amount = mask.amount(r.get("total_amount"))
                detail.paid_amount = mask.amount(r.get("paid_amount"))
                detail.currency = r.get("currency")
                detail.payment_status = r.get("payment_status")
                detail.cancel_reason = r.get("cancel_reason")
                detail.cancelled_at = r.get("cancelled_at")
                detail.nights = _nights(r.get("check_in"), r.get("check_out"))

        g = self._guests({thread["portal_guest_id"]}).get(thread["portal_guest_id"], {})
        detail.guest_name = mask.name(g.get("name"))
        return detail

    # -- Quick Replies (Airbnb „Quick replies") ----------------------------

    def list_quick_replies(self, ctx: AuthContext) -> QuickReplyList:
        if not ctx.tenant_id:
            return QuickReplyList()
        rows = (
            self._db.table("message_template")
            .select("id, title, body, property_ids")
            .eq("tenant_id", ctx.tenant_id)
            .order("created_at", desc=True)
            .execute()
        ).data or []
        return QuickReplyList(items=[QuickReply(**r) for r in rows])

    def create_quick_reply(
        self, ctx: AuthContext, req: QuickReplyUpsert
    ) -> QuickReply:
        if not ctx.tenant_id:
            raise HostMessagesError("Kein Betrieb im Kontext.", status_code=403)
        row = (
            self._db.table("message_template")
            .insert(
                {
                    "tenant_id": ctx.tenant_id,
                    "title": req.title,
                    "body": req.body,
                    "property_ids": req.property_ids,
                }
            )
            .execute()
        ).data[0]
        return QuickReply(
            id=row["id"], title=row["title"], body=row["body"],
            property_ids=row.get("property_ids") or [],
        )

    def update_quick_reply(
        self, ctx: AuthContext, qr_id: str, req: QuickReplyUpsert
    ) -> QuickReply:
        if not ctx.tenant_id:
            raise HostMessagesError("Kein Betrieb im Kontext.", status_code=403)
        res = (
            self._db.table("message_template")
            .update(
                {
                    "title": req.title,
                    "body": req.body,
                    "property_ids": req.property_ids,
                    "updated_at": _now_iso(),
                }
            )
            .eq("id", qr_id)
            .eq("tenant_id", ctx.tenant_id)
            .execute()
        ).data
        if not res:
            raise HostMessagesError("Vorlage nicht gefunden.", status_code=404)
        r = res[0]
        return QuickReply(
            id=r["id"], title=r["title"], body=r["body"],
            property_ids=r.get("property_ids") or [],
        )

    def delete_quick_reply(self, ctx: AuthContext, qr_id: str) -> None:
        if not ctx.tenant_id:
            raise HostMessagesError("Kein Betrieb im Kontext.", status_code=403)
        self._db.table("message_template").delete().eq("id", qr_id).eq(
            "tenant_id", ctx.tenant_id
        ).execute()

    def render_quick_reply(
        self, ctx: AuthContext, qr_id: str, thread_id: str
    ) -> str:
        """Vorlagentext mit Platzhaltern für DIESEN Thread füllen. Unterstützte
        Platzhalter: {{guest_name}}, {{property}}, {{check_in}}, {{check_out}}.
        Fehlt ein Wert, wird der Platzhalter durch „" ersetzt (kein Fake)."""
        thread = self._own_thread(ctx, thread_id)
        row = (
            self._db.table("message_template")
            .select("body")
            .eq("id", qr_id)
            .eq("tenant_id", ctx.tenant_id)
            .limit(1)
            .execute()
        ).data
        if not row:
            raise HostMessagesError("Vorlage nicht gefunden.", status_code=404)
        g = self._guests({thread["portal_guest_id"]}).get(thread["portal_guest_id"], {})
        title = self._property_titles(
            {thread["property_id"]} if thread.get("property_id") else set()
        ).get(thread.get("property_id"))
        stay = self._stays(
            {thread["reservation_id"]} if thread.get("reservation_id") else set()
        ).get(thread.get("reservation_id"), {})
        values = {
            "guest_name": g.get("name") or "",
            "property": title or "",
            "check_in": stay.get("check_in") or "",
            "check_out": stay.get("check_out") or "",
        }
        return re.sub(
            r"\{\{\s*(\w+)\s*\}\}",
            lambda m: values.get(m.group(1), m.group(0)),
            row[0]["body"],
        )

    # -- interne Helfer -----------------------------------------------------

    def _own_thread(self, ctx: AuthContext, thread_id: str) -> dict:
        """Thread per ID laden UND tenant-scopen in einem Schritt (Wurzel 3/9)."""
        if not ctx.tenant_id:
            raise HostMessagesError("Kein Betrieb im Kontext.", status_code=403)
        rows = (
            self._db.table("guest_message_threads")
            .select(
                "id, portal_guest_id, property_id, reservation_id, host_archived"
            )
            .eq("id", thread_id)
            .eq("tenant_id", ctx.tenant_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            raise HostMessagesError("Konversation nicht gefunden.", status_code=404)
        return rows[0]

    def _guests(self, ids: set[str]) -> dict[str, dict]:
        ids = {i for i in ids if i}
        if not ids:
            return {}
        rows = (
            self._db.table("portal_guests")
            .select("id, name, email")
            .in_("id", list(ids))
            .execute()
        ).data or []
        return {r["id"]: {"name": r.get("name"), "email": r.get("email")} for r in rows}

    def _property_titles(self, ids: set[str]) -> dict[str, str]:
        ids = {i for i in ids if i}
        if not ids:
            return {}
        rows = (
            self._db.table("properties")
            .select("id, title")
            .in_("id", list(ids))
            .execute()
        ).data or []
        return {r["id"]: r.get("title") for r in rows}

    def _stays(self, ids: set[str]) -> dict[str, dict]:
        ids = {i for i in ids if i}
        if not ids:
            return {}
        rows = (
            self._db.table("reservations")
            .select("id, check_in, check_out")
            .in_("id", list(ids))
            .execute()
        ).data or []
        return {
            r["id"]: {"check_in": r.get("check_in"), "check_out": r.get("check_out")}
            for r in rows
        }

    def _last_messages(self, thread_ids: list[str]) -> dict[str, str]:
        """Vorschau der letzten Nachricht je Thread."""
        if not thread_ids:
            return {}
        # fetch_all_rows: bei bis zu 500 Threads überschreitet die Nachrichten-
        # menge den 1000-Zeilen-Cap von PostgREST leicht — abgeschnitten fehlte
        # die Vorschau ausgerechnet bei den ruhigeren Threads.
        rows = fetch_all_rows(
            self._db.table("guest_messages")
            .select("thread_id, body, created_at")
            .in_("thread_id", thread_ids)
            .order("created_at", desc=True)
            .order("id")
        )
        out: dict[str, str] = {}
        for r in rows:  # neueste zuerst → erste je Thread behalten
            out.setdefault(r["thread_id"], r["body"])
        return out

    def _unread_counts(self, threads: list[dict]) -> dict[str, int]:
        """Ungelesene GAST-Nachrichten je Thread (Betrieb-Sicht): Gast-Nachrichten
        neuer als host_read_at. Ohne host_read_at zählen alle Gast-Nachrichten."""
        thread_ids = [t["id"] for t in threads]
        if not thread_ids:
            return {}
        # fetch_all_rows: ein abgeschnittenes Ergebnis zählte zu wenige
        # ungelesene Nachrichten — Threads erschienen fälschlich als gelesen.
        rows = fetch_all_rows(
            self._db.table("guest_messages")
            .select("thread_id, created_at, sender")
            .in_("thread_id", thread_ids)
            .eq("sender", "guest")
            .order("id")
        )
        read_at = {t["id"]: t.get("host_read_at") for t in threads}
        counts: dict[str, int] = {}
        for r in rows:
            marker = read_at.get(r["thread_id"])
            if marker is None or (r.get("created_at") or "") > marker:
                counts[r["thread_id"]] = counts.get(r["thread_id"], 0) + 1
        return counts

    def _blocked_guest_ids(self, tenant_id: str) -> set[str]:
        rows = (
            self._db.table("blocked_guests")
            .select("portal_guest_id")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        return {r["portal_guest_id"] for r in rows}

    @staticmethod
    def _matches(query: str, guest: dict, title: str | None) -> bool:
        q = query.strip().lower()
        hay = " ".join(
            filter(None, [guest.get("name"), guest.get("email"), title])
        ).lower()
        return q in hay


def _nights(check_in: str | None, check_out: str | None) -> int | None:
    if not check_in or not check_out:
        return None
    try:
        return (date.fromisoformat(check_out) - date.fromisoformat(check_in)).days
    except ValueError:
        return None
