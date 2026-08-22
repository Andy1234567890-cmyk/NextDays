"""Service-Schicht für guest_messages — Gast↔Host-Chat der Plattform (/plattform).

Eigenes Thread-Modell (guest_message_threads + guest_messages, Migration 0181).
Schreiben ist per anon/authenticated in der DB gesperrt (Wurzel 6) → läuft hier
über service_role. Jeder Zugriff wird auf den eingeloggten Gast gescoped
(portal_guest_id == ctx.guest_id, Wurzel 3/9); die tenant_id/property_id eines
Threads leitet der Server aus der Reservierung ab, nie aus dem Client (Wurzel 3).
sender wird server-seitig auf 'guest' gesetzt, nie aus dem Request (Wurzel 3/6).
"""
from datetime import UTC, datetime

import nh3
from supabase import Client

from src.core.logging import get_logger
from src.core.supabase import fetch_all_rows
from src.features.guest_blocks.service import GuestBlockService

from .schemas import (
    CreateThreadRequest,
    GuestMessageView,
    GuestThreadDetail,
    GuestThreadListResponse,
    GuestThreadSummary,
    SendMessageRequest,
    SliceHealth,
)

log = get_logger("nextdays.guest_messages")

# Max. Threads/Nachrichten je Antwort (Wurzel 8): ohne Obergrenze bläht ein Gast
# mit vielen Buchungen/Nachrichten die Antwort unkontrolliert auf. Beide Werte
# decken jeden realen Gast-Verlauf ab; PostgREST-Cap greift zusätzlich.
_MAX_THREADS = 500
_MAX_MESSAGES = 1000

# Harte Obergrenze der Nachrichten-Länge (Wurzel 8): Überlänge → 422, kein rohes
# Persistieren. Großzügig genug für lange Gast-Anfragen, klein genug gegen Abuse.
_MAX_BODY_LEN = 5000


class GuestMessagesError(Exception):
    """Fachlicher Fehler des Slices mit HTTP-Status (der Router mappt ihn)."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _now_iso() -> str:
    """Aktueller Zeitpunkt in ISO-8601 (UTC) für DB-Timestamps."""
    return datetime.now(UTC).isoformat()


def _sanitize_body(raw: str) -> str:
    """Gast-Nachricht zu reinem Text säubern (Wurzel 8) und Länge cappen (→422).

    Chat-Nachrichten sind Plaintext — jegliches Markup wird entfernt (nh3 mit
    leerer tag-Allowlist strippt alle Tags und dekodiert Entities nicht zu neuem
    Markup). Erst nach dem Säubern/Trimmen prüfen wir die Länge, damit ein durch
    Markup künstlich aufgeblähter Body nicht durchrutscht. Leerer Body nach dem
    Säubern → 422 (keine leeren Nachrichten).
    """
    cleaned = nh3.clean(raw, tags=set(), attributes={}, url_schemes=set()).strip()
    if not cleaned:
        raise GuestMessagesError(
            "Die Nachricht darf nicht leer sein.", status_code=422
        )
    if len(cleaned) > _MAX_BODY_LEN:
        raise GuestMessagesError(
            f"Die Nachricht ist zu lang (max. {_MAX_BODY_LEN} Zeichen).",
            status_code=422,
        )
    return cleaned


class GuestMessagesService:
    """Kapselt alle DB-Zugriffe des Gast-Chats. Immer gast-gescoped."""

    def __init__(self, service_client: Client | None = None) -> None:
        # service_role: umgeht RLS → JEDER Zugriff MUSS hier explizit auf
        # portal_guest_id == guest_id scopen (Wurzel 3/6). Der Client darf für
        # den reinen health()-Aufruf None sein (kein DB-Zugriff nötig).
        self._client = service_client

    def _db(self) -> Client:
        if self._client is None:
            raise GuestMessagesError(
                "Kein Datenbank-Client verfügbar.", status_code=500
            )
        return self._client

    def health(self) -> SliceHealth:
        return SliceHealth()

    # ---- interne Scope-Helfer ------------------------------------------------

    def _own_thread(self, thread_id: str, guest_id: str) -> dict:
        """Lädt EINEN Thread per ID UND erzwingt Gast-Scope in EINEM Schritt.

        Wurzel 3/9: Load und Scope sind untrennbar — filtert direkt per
        (id, portal_guest_id) und wirft 404, wenn der Thread nicht existiert ODER
        einem fremden Gast gehört (dieselbe Meldung, kein Existenz-Leak).
        """
        rows = (
            self._db()
            .table("guest_message_threads")
            .select("*")
            .eq("id", thread_id)
            .eq("portal_guest_id", guest_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            raise GuestMessagesError("Thread nicht gefunden.", status_code=404)
        return rows[0]

    def _own_reservation(self, reservation_id: str, email: str) -> dict:
        """Lädt eine Reservierung per ID UND erzwingt den E-Mail-Match (Wurzel 3).

        Ein Thread darf nur für eine Reservierung angelegt werden, deren
        guest_email (case-insensitiv) der E-Mail des eingeloggten Gasts entspricht.
        Kein Treffer → 404 (kein Existenz-Leak fremder Reservierungen).
        """
        rows = (
            self._db()
            .table("reservations")
            .select("id, tenant_id, property_id, guest_email")
            .eq("id", reservation_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            raise GuestMessagesError(
                "Reservierung nicht gefunden.", status_code=404
            )
        row = rows[0]
        row_email = (row.get("guest_email") or "").strip().lower()
        if not row_email or row_email != email:
            # Fremde Reservierung: gleiche Meldung wie „nicht gefunden".
            raise GuestMessagesError(
                "Reservierung nicht gefunden.", status_code=404
            )
        return row

    # ---- Endpunkt-Logik ------------------------------------------------------

    def list_threads(self, guest_id: str) -> GuestThreadListResponse:
        """Alle Threads des Gasts mit Objekt-/Reservierungsanzeige + Unread-Zahl."""
        query = (
            self._db()
            .table("guest_message_threads")
            .select(
                "id, reservation_id, property_id, last_message_at, created_at"
            )
            .eq("portal_guest_id", guest_id)
            .order("last_message_at", desc=True)
            .order("created_at", desc=True)
        )
        threads = fetch_all_rows(query)[:_MAX_THREADS]
        if not threads:
            return GuestThreadListResponse(threads=[])

        thread_ids = [t["id"] for t in threads]
        property_ids = [t["property_id"] for t in threads]
        reservation_ids = [t["reservation_id"] for t in threads]

        titles = self._property_titles(property_ids)
        stays = self._reservation_stays(reservation_ids)
        unread = self._unread_counts(thread_ids)

        summaries = [
            GuestThreadSummary(
                id=t["id"],
                reservation_id=t["reservation_id"],
                property_id=t["property_id"],
                property_title=titles.get(t["property_id"]),
                check_in=(stays.get(t["reservation_id"]) or {}).get("check_in"),
                check_out=(stays.get(t["reservation_id"]) or {}).get("check_out"),
                last_message_at=t.get("last_message_at"),
                unread_count=unread.get(t["id"], 0),
                created_at=t["created_at"],
            )
            for t in threads
        ]
        return GuestThreadListResponse(threads=summaries)

    def get_thread(self, thread_id: str, guest_id: str) -> GuestThreadDetail:
        """Nachrichten eines Threads (nur eigener Thread → sonst 404).

        Beim Lesen werden ungelesene Host-Nachrichten als gelesen markiert
        (read_at=now). Idempotent: nur Zeilen mit read_at IS NULL werden gesetzt,
        ein erneuter Aufruf ändert nichts.
        """
        self._own_thread(thread_id, guest_id)

        # Host-Nachrichten als gelesen markieren (idempotent über read_at IS NULL).
        self._db().table("guest_messages").update(
            {"read_at": _now_iso()}
        ).eq("thread_id", thread_id).eq("sender", "host").is_(
            "read_at", "null"
        ).execute()

        query = (
            self._db()
            .table("guest_messages")
            .select("id, thread_id, sender, body, read_at, created_at")
            .eq("thread_id", thread_id)
            .order("created_at", desc=False)
        )
        rows = fetch_all_rows(query)[:_MAX_MESSAGES]
        thread = self._own_thread(thread_id, guest_id)
        return GuestThreadDetail(
            id=thread["id"],
            reservation_id=thread["reservation_id"],
            property_id=thread["property_id"],
            last_message_at=thread.get("last_message_at"),
            messages=[GuestMessageView(**r) for r in rows],
        )

    def create_thread(
        self, req: CreateThreadRequest, guest_id: str, email: str
    ) -> GuestThreadDetail:
        """Legt einen Thread für eine Reservierung an ODER gibt den bestehenden zurück.

        Wurzel 2 (idempotent): existiert bereits ein Thread für
        (reservation_id, guest), wird dieser wiederverwendet. Wurzel 3: die
        Reservierung muss dem Gast gehören (E-Mail-Match); tenant_id/property_id
        werden aus der Reservierung abgeleitet, nie aus dem Client.
        """
        # E-Mail-Match zuerst: nur eigene Reservierungen dürfen einen Thread haben.
        reservation = self._own_reservation(req.reservation_id, email)

        # Airbnb-Block: ein blockierter Gast startet keine neue Konversation —
        # außer es läuft ein 2-Wochen-Trip-Fenster für diese Reservierung.
        if GuestBlockService(self._db()).is_blocked_for_messaging(
            reservation["tenant_id"], guest_id
        ):
            raise GuestMessagesError(
                "Du kannst diesem Gastgeber derzeit keine Nachrichten senden.",
                status_code=403,
            )

        # Bestehenden Thread idempotent wiederverwenden (unique reservation+guest).
        existing = (
            self._db()
            .table("guest_message_threads")
            .select("*")
            .eq("reservation_id", req.reservation_id)
            .eq("portal_guest_id", guest_id)
            .limit(1)
            .execute()
        ).data
        if existing:
            return self.get_thread(existing[0]["id"], guest_id)

        payload = {
            "tenant_id": reservation["tenant_id"],
            "reservation_id": req.reservation_id,
            "portal_guest_id": guest_id,
            "property_id": reservation["property_id"],
        }
        try:
            inserted = (
                self._db()
                .table("guest_message_threads")
                .insert(payload)
                .execute()
            ).data
        except Exception as exc:  # noqa: BLE001
            # UNIQUE-Backstop (Wurzel 2): ein paralleler Request (Doppelklick)
            # kann zwischen Select und Insert denselben Thread angelegt haben.
            # Statt den 23505-Konflikt durchzureichen, den nun vorhandenen Thread
            # gast-gescoped nachladen (idempotent) — sonst re-raise.
            again = (
                self._db()
                .table("guest_message_threads")
                .select("id")
                .eq("reservation_id", req.reservation_id)
                .eq("portal_guest_id", guest_id)
                .limit(1)
                .execute()
            ).data
            if again:
                return self.get_thread(again[0]["id"], guest_id)
            raise GuestMessagesError(
                "Thread konnte nicht angelegt werden.", status_code=500
            ) from exc
        return self.get_thread(inserted[0]["id"], guest_id)

    def send_message(
        self, thread_id: str, req: SendMessageRequest, guest_id: str
    ) -> GuestMessageView:
        """Gast sendet eine Nachricht in seinen Thread.

        Wurzel 3/6: sender wird IMMER server-seitig 'guest' gesetzt (nie aus dem
        Request). Wurzel 9: der Thread muss dem Gast gehören (gleicher Scope wie
        die Liste). Wurzel 8: body sanitisiert + gecappt. last_message_at des
        Threads wird auf den Nachrichten-Zeitpunkt gesetzt.
        """
        thread = self._own_thread(thread_id, guest_id)
        # Airbnb-Block: hat der Betrieb diesen Gast blockiert, darf er nicht mehr
        # schreiben — außer es läuft ein 2-Wochen-Trip-Fenster (im Block-Service).
        if GuestBlockService(self._db()).is_blocked_for_messaging(
            thread["tenant_id"], guest_id
        ):
            raise GuestMessagesError(
                "Du kannst diesem Gastgeber derzeit keine Nachrichten senden.",
                status_code=403,
            )
        body = _sanitize_body(req.body)
        now = _now_iso()

        inserted = (
            self._db()
            .table("guest_messages")
            .insert(
                {
                    "thread_id": thread_id,
                    "sender": "guest",  # server-seitig, NIE aus dem Request
                    "body": body,
                    "created_at": now,
                }
            )
            .execute()
        ).data

        # Thread-Aktualität nachziehen (Wurzel 1: Gegenzustand pflegen).
        self._db().table("guest_message_threads").update(
            {"last_message_at": now}
        ).eq("id", thread_id).eq("portal_guest_id", guest_id).execute()

        self._melde_dem_betrieb(thread, thread_id, body)
        return GuestMessageView(**inserted[0])

    def _melde_dem_betrieb(
        self, thread: dict, thread_id: str, body: str
    ) -> None:
        """Glocke/Mail an den Betrieb: „Ein Gast hat geschrieben."

        WARUM DAS HIER STEHEN MUSS: Die Kategorie `messages` steht im Katalog
        und ist im Konto einschaltbar — ausgelöst wurde sie bislang NUR vom
        Portal-Eingang (`channel_manager.nachrichten_eingang`). Eine Nachricht
        aus dem eigenen Marktplatz landete damit still in der Datenbank: kein
        Abzeichen, keine Mail, kein Push. Wer nicht zufällig in den Posteingang
        sah, erfuhr von der Anfrage nichts — bei einem Gast, der VOR der
        Anreise etwas fragt, ist das der teuerste Fall.

        `mb:`-Präfix wie im Posteingang (`inbox.marktplatz.PREFIX`): der
        Sprungziel-Pfad muss dieselbe ID tragen, unter der die Oberfläche den
        Thread führt — sonst öffnet die Meldung eine Ansicht, die es nicht gibt.

        Best-effort (Wurzel 5): die Nachricht IST an dieser Stelle gespeichert.
        Kippt die Meldung, darf das den Versand nicht zurückdrehen — sonst
        verlöre der Gast seinen Text, weil eine Glocke nicht klingeln konnte.
        Der Fang steht HIER und nicht nur in `melde_gastnachricht`: er soll
        nicht davon abhängen, dass ein anderes Modul seine Disziplin behält
        (auch der Import selbst kann fehlschlagen).
        """
        try:
            from src.features.inbox.marktplatz import PREFIX  # noqa: PLC0415
            from src.features.notification_settings.ereignisse import (  # noqa: PLC0415
                melde_gastnachricht,
            )

            melde_gastnachricht(
                self._db(),
                tenant_id=str(thread["tenant_id"]),
                thread_id=f"{PREFIX}{thread_id}",
                absender=self._gastname(thread.get("portal_guest_id")),
                vorschau=body,
            )
        except Exception as exc:  # noqa: BLE001 — Nebenpfad kippt den Versand nie
            log.warning(
                "gastnachricht_meldung_fehlgeschlagen",
                thread_id=thread_id,
                error=str(exc)[:200],
            )

    def _gastname(self, portal_guest_id: object) -> str | None:
        """Anzeigename des Gasts für die Meldung — oder None.

        `None` statt eines Ersatztextes: `melde_gastnachricht` schreibt dann
        „Neue Gastnachricht" statt „Neue Nachricht von <erfundener Name>"
        (Wurzel 4). Eigene, enge Abfrage statt eines Joins oben — der
        Nachrichtenversand soll nicht an einer Anzeigefrage hängen.
        """
        if not portal_guest_id:
            return None
        try:
            zeilen = (
                self._db()
                .table("portal_guests")
                .select("name")
                .eq("id", str(portal_guest_id))
                .limit(1)
                .execute()
            ).data or []
        except Exception:  # noqa: BLE001 — Anzeigename, kein Kontroll-Signal
            return None
        return (zeilen[0].get("name") or None) if zeilen else None

    # ---- Anreicherungs-Helfer ------------------------------------------------

    def _property_titles(self, property_ids: list[str]) -> dict[str, str]:
        """Objekt-Titel je property_id (Anzeigefeld, keine sensiblen Daten)."""
        ids = list({pid for pid in property_ids if pid})
        if not ids:
            return {}
        rows = (
            self._db()
            .table("properties")
            .select("id, title")
            .in_("id", ids)
            .execute()
        ).data or []
        return {r["id"]: r.get("title") for r in rows}

    def _reservation_stays(
        self, reservation_ids: list[str]
    ) -> dict[str, dict]:
        """check_in/check_out je Reservierung (Anzeige im Thread-Kopf)."""
        ids = list({rid for rid in reservation_ids if rid})
        if not ids:
            return {}
        rows = (
            self._db()
            .table("reservations")
            .select("id, check_in, check_out")
            .in_("id", ids)
            .execute()
        ).data or []
        return {
            r["id"]: {"check_in": r.get("check_in"), "check_out": r.get("check_out")}
            for r in rows
        }

    def _unread_counts(self, thread_ids: list[str]) -> dict[str, int]:
        """Ungelesene Host-Nachrichten je Thread (Gast-Sicht: sender='host')."""
        if not thread_ids:
            return {}
        query = (
            self._db()
            .table("guest_messages")
            .select("thread_id")
            .in_("thread_id", thread_ids)
            .eq("sender", "host")
            .is_("read_at", "null")
            .order("thread_id", desc=False)
        )
        rows = fetch_all_rows(query)
        counts: dict[str, int] = {}
        for row in rows:
            tid = row["thread_id"]
            counts[tid] = counts.get(tid, 0) + 1
        return counts
