"""Service-Schicht für inbox.

Threads werden aus den importierten OTA-Buchungen (channex_booking) abgeleitet:
pro Buchung ein Thread mit Portal, Gast, Reservierungsbezug. Nachrichten werden
über die Channex-Messaging-API gelesen und gesendet (Booking.com/Airbnb/Expedia).
Ein optionaler KI-Antwortvorschlag (Groq) hilft beim Beantworten.

Tenant-scoped (tenant_id aus dem JWT). Kein stilles Exception-Swallowing.
"""
import json
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.channel_manager.channex_client import ChannexClient, ChannexError
from src.features.channel_manager.common import ota_zeitstempel_utc
from src.features.guests.identity import (
    contact_from_ota_customer,
    resolve_or_create_guest,
)

from .anhaenge import AnhangWissenMixin
from .errors import InboxError
from .felder import FeldFehlt, Kontext, rendern, unbekannte_felder
from .planung import PlanungMixin
from .schemas import (
    Automation,
    AutomationList,
    AutomationUpsert,
    InboxEventFact,
    InboxListResponse,
    InboxMessage,
    InboxMessagesResponse,
    InboxThread,
    ReservationDetail,
    SliceHealth,
    TeamMember,
    TeamMemberList,
)
from .vorlagen import VorlagenMixin

if TYPE_CHECKING:
    from .authz import InboxAccess

log = get_logger("nextdays.inbox")


def _chronologisch(m: InboxMessage) -> tuple[int, str]:
    """Sortierschlüssel des Verlaufs: nach Zeit, Einträge OHNE Zeit ans Ende.

    Ein schlichtes `m.sent_at or ""` täte das Gegenteil — der leere String
    sortiert vor jedem Zeitstempel und schöbe zeitlose Einträge an den Anfang.
    Das fiel lange nicht auf, weil ohne interne Notizen gar nicht sortiert
    wurde; seit Nachrichten, Notizen und Ereignisse in EINEM Strang laufen,
    stünde die letzte Kanal-Nachricht ohne Zeitstempel plötzlich ganz oben.
    Da Pythons Sortierung stabil ist, behalten sie untereinander ihre
    Eingangsreihenfolge."""
    return (0, m.sent_at) if m.sent_at else (1, "")


class InboxService(PlanungMixin, VorlagenMixin, AnhangWissenMixin):
    slice_name = "inbox"

    def __init__(
        self,
        service_client: Client | None = None,
        channex: ChannexClient | None = None,
    ) -> None:
        self._db = service_client
        self._channex = channex or ChannexClient()

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def _require(self, ctx: AuthContext) -> tuple[Client, str]:
        if not ctx.tenant_id:
            raise InboxError("Kein Tenant im Token.", status_code=403)
        if self._db is None:
            raise InboxError("Posteingang-DB nicht verfügbar.", status_code=500)
        return self._db, ctx.tenant_id

    def access(self, ctx: AuthContext) -> "InboxAccess":
        """Effektive Posteingang-Berechtigungen des Nutzers (Quelle: DB)."""
        from .authz import load_inbox_access

        return load_inbox_access(self._db, ctx)

    @staticmethod
    def _customer_of(row: dict) -> dict:
        """Gastdaten einer Buchung — Spalte `customer` UND `raw.customer`.

        Der Import legt in der Spalte nur Name/Nachname ab; Mail, Telefon,
        Sprache und Ort stehen ausschließlich in der rohen OTA-Payload. Wer nur
        die Spalte liest, zeigt im Posteingang eine leere Gästekarte (genau das
        war der Fall). Die Spalte gewinnt, wo sie etwas hat.
        """
        roh = (row.get("raw") or {}).get("customer") or {}
        spalte = row.get("customer") or {}
        return {**roh, **{k: v for k, v in spalte.items() if v not in (None, "")}}

    @staticmethod
    def _guest_location(customer: dict) -> str | None:
        """Ort/Land des Gastes für die Gästekarte (nur echte Werte)."""
        teile = [customer.get("city"), customer.get("country")]
        return ", ".join(x for x in teile if x) or None

    @staticmethod
    def _guest_name(customer: dict) -> str | None:
        return (
            " ".join(
                x for x in [customer.get("name"), customer.get("surname")] if x
            ).strip()
            or None
        )

    # Gültige Posteingang-Status (Lebenszyklus).
    _STATUSES = ("active", "archived", "trashed")

    def list_threads(
        self, ctx: AuthContext, *, unassigned: bool = False, status: str = "active",
        access: "InboxAccess | None" = None,
    ) -> InboxListResponse:
        db, tenant_id = self._require(ctx)
        access = access or self.access(ctx)
        if status not in self._STATUSES:
            status = "active"
        query = (
            db.table("channex_booking")
            .select(
                "id, channex_booking_id, ota_name, ota_reservation_code, status, "
                "arrival_date, departure_date, customer, raw, updated_at, guest_id, "
                "is_read, is_starred, is_archived, assigned_user_id, inbox_status, "
                "property_map_id"
            )
            .eq("tenant_id", tenant_id)
            # Genau die gewählte Ansicht (active|archived|trashed); deleted nie.
            .eq("inbox_status", status)
        )
        # Scope: assigned-only-Nutzer sehen nur die ihnen zugewiesenen Threads.
        if access.scope == "assigned":
            query = query.eq("assigned_user_id", ctx.user_id)
        elif unassigned:
            query = query.is_("assigned_user_id", "null")
        res = query.order("updated_at", desc=True).limit(200).execute()
        rows = res.data or []
        # Reservierungs-IDs in einem Rutsch nachschlagen (Thread ↔ Reservierung).
        booking_ids = [r["channex_booking_id"] for r in rows if r.get("channex_booking_id")]
        res_by_booking = self._reservation_ids_for(db, tenant_id, booking_ids)
        # Namen der zugewiesenen Benutzer auflösen.
        user_ids = [r["assigned_user_id"] for r in rows if r.get("assigned_user_id")]
        names = self._user_names(db, tenant_id, user_ids)
        # Objekt (Haus) je Thread auflösen: property_map_id → property_id + Titel.
        map_ids = [r["property_map_id"] for r in rows if r.get("property_map_id")]
        prop_by_map = self._properties_for_maps(db, tenant_id, map_ids)
        mask = access.mask
        # Vorschau der letzten Nachricht je Thread — beide Vorbilder zeigen sie
        # in der Liste; ohne sie muss man jeden Thread öffnen, um zu sehen,
        # worum es geht.
        letzte = self._last_messages(db, tenant_id, [r["id"] for r in rows])

        items: list[InboxThread] = []
        for r in rows:
            customer = self._customer_of(r)
            cbid = r.get("channex_booking_id")
            uid = r.get("assigned_user_id")
            prop = prop_by_map.get(r.get("property_map_id")) if r.get("property_map_id") else None
            items.append(
                InboxThread(
                    id=r["id"],
                    channex_booking_id=cbid,
                    reservation_id=res_by_booking.get(cbid),
                    guest_id=r.get("guest_id"),
                    property_id=prop[0] if prop else None,
                    property_title=prop[1] if prop else None,
                    ota_name=mask.source_value(r.get("ota_name")),
                    ota_reservation_code=r.get("ota_reservation_code"),
                    guest_name=mask.name(self._guest_name(customer)),
                    guest_email=mask.contact_value(customer.get("mail") or customer.get("email")),
                    guest_phone=mask.contact_value(customer.get("phone")),
                    status=r.get("status"),
                    arrival_date=r.get("arrival_date"),
                    departure_date=r.get("departure_date"),
                    last_message=letzte.get(r["id"]),
                    updated_at=r.get("updated_at"),
                    is_read=bool(r.get("is_read", True)),
                    is_starred=bool(r.get("is_starred")),
                    is_archived=bool(r.get("is_archived")),
                    inbox_status=r.get("inbox_status") or "active",
                    assigned_user_id=uid,
                    assigned_user_name=names.get(uid) if uid else None,
                )
            )
        return InboxListResponse(items=items, total=len(items))

    def _last_messages(
        self, db: Client, tenant_id: str, thread_ids: list[str]
    ) -> dict[str, str]:
        """Letzte Nachricht je Thread (Vorschautext in der Liste).

        Nur im Sandbox-Modus: dort liegen die Nachrichten lokal. Gegen die echte
        Channex-Messaging-API wäre das ein Request PRO Thread — das verbietet
        sich für eine Liste mit 200 Einträgen, deshalb bleibt die Vorschau dort
        leer, statt die Liste langsam zu machen.
        """
        if not thread_ids or not self._sandbox_enabled():
            return {}
        res = (
            db.table("sandbox_message")
            .select("thread_id, message, created_at")
            .eq("tenant_id", tenant_id)
            .in_("thread_id", thread_ids)
            .order("created_at", desc=True)
            .limit(1000)
            .execute()
        )
        out: dict[str, str] = {}
        for m in res.data or []:
            # Absteigend sortiert → der erste Treffer je Thread ist der jüngste.
            out.setdefault(m["thread_id"], (m.get("message") or "").strip())
        return out

    def _user_names(
        self, db: Client, tenant_id: str, user_ids: list[str]
    ) -> dict[str, str]:
        """Map user_id → Anzeigename (Team-Mitglieder des Tenants)."""
        if not user_ids:
            return {}
        res = (
            db.table("users")
            .select("id, full_name, email")
            .eq("tenant_id", tenant_id)
            .in_("id", list(set(user_ids)))
            .execute()
        )
        return {
            u["id"]: (u.get("full_name") or u.get("email") or "")
            for u in (res.data or [])
        }

    def _properties_for_maps(
        self, db: Client, tenant_id: str, map_ids: list[str]
    ) -> dict[str, tuple[str, str]]:
        """Map property_map_id → (property_id, property_title). Zwei Batch-Abfragen
        (channex_property_map → properties), damit der Posteingang nach Objekt
        filtern/anzeigen kann."""
        if not map_ids:
            return {}
        maps = (
            db.table("channex_property_map")
            .select("id, property_id")
            .eq("tenant_id", tenant_id)
            .in_("id", list(set(map_ids)))
            .execute()
        ).data or []
        prop_ids = [m["property_id"] for m in maps if m.get("property_id")]
        titles: dict[str, str] = {}
        if prop_ids:
            props = (
                db.table("properties")
                .select("id, title")
                .eq("tenant_id", tenant_id)
                .in_("id", list(set(prop_ids)))
                .execute()
            ).data or []
            titles = {str(p["id"]): p.get("title") or "" for p in props}
        out: dict[str, tuple[str, str]] = {}
        for m in maps:
            pid = m.get("property_id")
            if pid:
                out[str(m["id"])] = (str(pid), titles.get(str(pid), ""))
        return out

    def _property_for_thread(
        self, db: Client, tenant_id: str, row: dict
    ) -> dict | None:
        """Objekt-Zeile zu einem Thread über `property_map_id`.

        Der Weg führt über `channex_property_map`; `channex_booking` selbst trägt
        KEINE channex_property_id (siehe Tabellendefinition). Ein früherer Zugriff
        auf `row["channex_property_id"]` lief deshalb immer ins Leere und ließ das
        Reservierungs-Panel dauerhaft ohne Objektnamen.
        """
        map_id = row.get("property_map_id")
        if not map_id:
            return None
        pm = (
            db.table("channex_property_map")
            .select("property_id")
            .eq("tenant_id", tenant_id)
            .eq("id", str(map_id))
            .limit(1)
            .execute()
        ).data or []
        property_id = pm[0].get("property_id") if pm else None
        if not property_id:
            return None
        props = (
            db.table("properties")
            .select("id, title, address, city, country, photos, timezone")
            .eq("tenant_id", tenant_id)
            .eq("id", str(property_id))
            .limit(1)
            .execute()
        ).data or []
        return props[0] if props else None

    def _feld_kontext(self, db: Client, tenant_id: str, row: dict) -> Kontext:
        """Datengrundlage der Platzhalter für einen Thread.

        Bewusst UNGEMASKT: der Empfänger ist der Gast selbst, dem seine eigenen
        Daten nicht vorenthalten werden müssen. Die Rollen-Maske (§4.3) schützt
        die ANSICHT für Mitarbeiter — sie darf nicht dazu führen, dass ein Gast
        eine Nachricht mit „Hallo M****" bekommt.
        """
        customer = self._customer_of(row)
        raw = row.get("raw") or {}
        occ = raw.get("occupancy") or {}
        checkin_time, checkout_time = self._ota_zeiten(raw)
        prop = self._property_for_thread(db, tenant_id, row)
        cents = row.get("amount_cents")
        betrag = (cents / 100) if isinstance(cents, (int, float)) else None

        tuercode = None
        if prop and prop.get("id"):
            portal = (
                db.table("property_guest_portal")
                .select("door_code")
                .eq("property_id", str(prop["id"]))
                .limit(1)
                .execute()
            ).data or []
            tuercode = portal[0].get("door_code") if portal else None

        firma = (
            db.table("tenants")
            .select("name")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        ).data or []

        return Kontext(
            guest_name=self._guest_name(customer),
            guest_email=customer.get("mail") or customer.get("email"),
            guest_phone=customer.get("phone"),
            guest_language=customer.get("language") or customer.get("lang"),
            check_in=row.get("arrival_date"),
            check_out=row.get("departure_date"),
            checkin_time=checkin_time,
            checkout_time=checkout_time,
            adults=occ.get("adults"),
            children=occ.get("children"),
            reservation_code=row.get("ota_reservation_code"),
            channel=row.get("ota_name"),
            total_amount=betrag,
            currency=row.get("currency"),
            property_name=prop.get("title") if prop else None,
            property_address=prop.get("address") if prop else None,
            property_city=prop.get("city") if prop else None,
            door_code=tuercode,
            company_name=firma[0].get("name") if firma else None,
        )

    def render_for_thread(
        self, ctx: AuthContext, thread_id: str, text: str
    ) -> str:
        """Vorschau/Auflösung eines Textes für einen konkreten Thread.

        Damit sieht der Mitarbeiter beim Einfügen einer Vorlage sofort den
        fertigen Text und kann ihn korrigieren, statt `{{guest_name}}` an einen
        Gast zu schicken."""
        db, tenant_id, row, _access = self._load_thread_scoped(ctx, thread_id)
        unbekannt = unbekannte_felder(text)
        if unbekannt:
            raise InboxError(
                "Unbekannte Felder: " + ", ".join(unbekannt), status_code=422
            )
        try:
            return rendern(text, self._feld_kontext(db, tenant_id, row))
        except FeldFehlt as exc:
            raise InboxError(str(exc), status_code=422) from exc

    def _reservation_ids_for(
        self, db: Client, tenant_id: str, booking_ids: list[str]
    ) -> dict[str, str]:
        """Map Channex-Booking-UUID → lokale reservation_id (für die Verknüpfung)."""
        if not booking_ids:
            return {}
        res = (
            db.table("reservations")
            .select("id, source_channex_booking_id")
            .eq("tenant_id", tenant_id)
            .in_("source_channex_booking_id", booking_ids)
            .execute()
        )
        return {
            r["source_channex_booking_id"]: r["id"]
            for r in (res.data or [])
            if r.get("source_channex_booking_id")
        }

    def _load_thread(
        self, db: Client, tenant_id: str, thread_id: str,
        *, access: "InboxAccess | None" = None, scope_user_id: str | None = None,
    ) -> dict:
        """channex_booking-Zeile dieses Tenants laden (404, wenn fremd/fehlt).

        Bei assigned-only-Scope (access.scope == "assigned") gilt ein fremder,
        nicht zugewiesener Thread bewusst als 404 (nicht 403) — die Existenz wird
        nicht preisgegeben. `scope_user_id` ist die user_id des Anfragenden.
        """
        res = (
            db.table("channex_booking")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("id", thread_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise InboxError("Konversation nicht gefunden.", status_code=404)
        row = res.data[0]
        if access and access.scope == "assigned":
            # Nur eigene Zuweisung sichtbar; sonst 404 (keine Existenz verraten).
            if row.get("assigned_user_id") != scope_user_id:
                raise InboxError("Konversation nicht gefunden.", status_code=404)
        return row

    def _load_thread_scoped(
        self, ctx: AuthContext, thread_id: str,
        *, access: "InboxAccess | None" = None,
    ) -> tuple[Client, str, dict, "InboxAccess"]:
        """Thread tenant- UND scope-gesichert laden (assigned-only → 404 bei fremd).

        Liefert (db, tenant_id, row, access) für die Weiterverarbeitung.
        """
        db, tenant_id = self._require(ctx)
        access = access or self.access(ctx)
        row = self._load_thread(
            db, tenant_id, thread_id, access=access, scope_user_id=ctx.user_id
        )
        return db, tenant_id, row, access

    @staticmethod
    def _sandbox_enabled() -> bool:
        """Sandbox-Messaging aktiv? Dann lokaler Mock-Speicher statt Channex
        (die echte Messaging-API ist ein separat freizuschaltendes Add-on)."""
        from src.core.config import get_settings

        return get_settings().channex_sandbox_portals

    def get_messages(self, ctx: AuthContext, thread_id: str) -> InboxMessagesResponse:
        db, tenant_id, row, _access = self._load_thread_scoped(ctx, thread_id)

        # Sandbox: Nachrichten aus dem lokalen Mock-Speicher.
        if self._sandbox_enabled():
            res = (
                db.table("sandbox_message")
                .select("id, sender, message, created_at")
                .eq("tenant_id", tenant_id)
                .eq("thread_id", thread_id)
                .order("created_at")
                .execute()
            )
            items = [
                InboxMessage(
                    id=m.get("id"),
                    message=m.get("message") or "",
                    sender="property" if m.get("sender") == "property" else "guest",
                    sent_at=m.get("created_at"),
                )
                for m in (res.data or [])
            ]
            items = self._merge_stream(db, tenant_id, thread_id, row, items)
            return InboxMessagesResponse(items=items, total=len(items))

        cbid = row.get("channex_booking_id")
        if not cbid:
            items = self._merge_stream(db, tenant_id, thread_id, row, [])
            return InboxMessagesResponse(items=items, total=len(items))
        try:
            res = self._portal_nachrichten(cbid, row, tenant_id, thread_id)
        except ChannexError as exc:
            # Channex liefert bei einzelnen Sandbox-/Legacy-Buchungen 422
            # (details.booking_id: "is invalid"). In dem Fall degradieren wir
            # kontrolliert auf lokale Notizen statt die Inbox-Ansicht zu brechen.
            if self._is_invalid_booking_id_error(exc):
                log.warning(
                    "inbox_channex_invalid_booking_id",
                    tenant_id=tenant_id,
                    thread_id=thread_id,
                    channex_booking_id=cbid,
                    channex_status=exc.channex_status,
                )
                items = self._merge_stream(db, tenant_id, thread_id, row, [])
                return InboxMessagesResponse(items=items, total=len(items))
            grund = (
                "channel_no_chat"
                if self._is_channel_without_chat(exc)
                else "chat_unavailable"
            )
            if grund == "chat_unavailable":
                log.error(
                    "inbox_portal_chat_unerreichbar",
                    tenant_id=tenant_id,
                    thread_id=thread_id,
                    channex_booking_id=cbid,
                    channex_status=exc.channex_status,
                    error=exc.message,
                )
            items = self._merge_stream(db, tenant_id, thread_id, row, [])
            return InboxMessagesResponse(
                items=items, total=len(items), unavailable=grund
            )
        items = [self.zu_nachricht(m) for m in (res.get("data") or [])]
        items = self._merge_stream(db, tenant_id, thread_id, row, items)
        return InboxMessagesResponse(items=items, total=len(items))

    def _portal_nachrichten(
        self, cbid: str, row: dict, tenant_id: str, thread_id: str
    ) -> dict:
        """Verlauf beim Portal holen — mit Selbstheilung und zweitem Weg.

        Ist ein Objekt verbunden, MUSS der Chat gehen; niemand soll dafür etwas
        anklicken. Zwei Dinge stehen dem im Weg, beide werden hier erledigt:

        1. **Fehlende Chat-Anwendung** (403). Sie gehört zur Property und wird
           beim Verbinden gesetzt. Fehlt sie hier trotzdem (Objekt von vor der
           Automatik, Installation damals fehlgeschlagen), wird sie SOFORT
           nachgezogen und der Abruf genau einmal wiederholt.
        2. **Kein Verlauf am Buchungspfad.** Die Buchung verweist über
           `relationships.message_thread` auf ihren Thread (Doku „Channel
           IFrame"). Über den Thread kommt man auch dort an den Verlauf, wo der
           Buchungs-Endpunkt nichts hergibt — etwa bei Airbnb-Anfragen.
        """
        try:
            return self._channex.get_messages_for_booking(cbid)
        except ChannexError as exc:
            if exc.channex_status == 403 and self._chat_app_nachziehen(row):
                log.info(
                    "inbox_chat_app_nachgezogen",
                    tenant_id=tenant_id, thread_id=thread_id,
                )
                return self._channex.get_messages_for_booking(cbid)
            thread = self._portal_thread_id(cbid)
            if thread:
                return self._channex.get_thread_messages(thread)
            raise

    def _portal_senden(self, cbid: str, row: dict, text: str) -> dict:
        """Antwort ans Portal — gleiche Selbstheilung wie beim Lesen.

        Ohne sie wäre der Chat lesbar (der Abruf heilt sich), aber nicht
        beantwortbar — ein Zustand, den niemand versteht.
        """
        try:
            return self._channex.send_message_for_booking(cbid, text)
        except ChannexError as exc:
            if exc.channex_status == 403 and self._chat_app_nachziehen(row):
                return self._channex.send_message_for_booking(cbid, text)
            thread = self._portal_thread_id(cbid)
            if thread:
                return self._channex.send_thread_message(thread, text)
            raise

    def _chat_app_nachziehen(self, row: dict) -> bool:
        """Chat-Anwendung an der Property dieser Buchung installieren.

        True, wenn ein erneuter Abruf sinnvoll ist. Die Channex-Property-ID steht
        in der rohen Buchungs-Payload (`raw.property_id`); ohne sie lässt sich
        nichts installieren, dann bleibt es beim ursprünglichen Fehler.
        """
        raw = row.get("raw") if isinstance(row.get("raw"), dict) else {}
        channex_property_id = raw.get("property_id")
        if not channex_property_id:
            return False
        try:
            self._channex.install_application(
                channex_property_id=str(channex_property_id),
                application_code=ChannexClient.CHAT_APP_CODE,
            )
        except ChannexError as exc:
            log.error(
                "inbox_chat_app_install_fehlgeschlagen",
                channex_property_id=str(channex_property_id),
                error=exc.message,
            )
            return False
        return True

    def _portal_thread_id(self, cbid: str) -> str | None:
        """`relationships.message_thread.data.id` der Buchung (oder None)."""
        try:
            res = self._channex.get_booking(cbid)
        except ChannexError:
            return None
        rel = ((res.get("data") or {}).get("relationships") or {})
        thread = (rel.get("message_thread") or {}).get("data") or {}
        tid = thread.get("id")
        return str(tid) if tid else None

    @staticmethod
    def _is_channel_without_chat(exc: ChannexError) -> bool:
        """422 mit code „not_supported" — der Kanal dieser Buchung hat keinen Chat."""
        if exc.channex_status != 422:
            return False
        payload = exc.payload if isinstance(exc.payload, dict) else {}
        errors = payload.get("errors") if isinstance(payload.get("errors"), dict) else {}
        return str(errors.get("code") or payload.get("code") or "") == "not_supported"

    @staticmethod
    def _is_invalid_booking_id_error(exc: ChannexError) -> bool:
        if exc.channex_status not in (400, 422):
            return False
        payload = exc.payload if isinstance(exc.payload, dict) else {}
        details = payload.get("details") if isinstance(payload.get("details"), dict) else payload
        booking_error = details.get("booking_id") if isinstance(details, dict) else None
        if isinstance(booking_error, list):
            return any("invalid" in str(item).lower() for item in booking_error)
        if isinstance(booking_error, str):
            return "invalid" in booking_error.lower()
        return False

    def _merge_stream(
        self,
        db: Client,
        tenant_id: str,
        thread_id: str,
        row: dict,
        msgs: list[InboxMessage],
    ) -> list[InboxMessage]:
        """Ein Strang: Nachrichten + interne Notizen + Buchungs-Ereignisse."""
        merged = self._merge_notes(db, tenant_id, thread_id, msgs)
        merged = merged + self._booking_events(row)
        merged.sort(key=_chronologisch)
        return merged

    @staticmethod
    def _ota_zeiten(raw: dict) -> tuple[str | None, str | None]:
        """Erwartete An-/Abreisezeit aus der OTA-Payload.

        EINE Stelle für beide Leser (Detailspalte rechts und die Platzhalter
        `{{checkin_time}}`/`{{checkout_time}}` der Automationen). Vorher stand
        die Auflösung zweimal im Code, und nur eine der beiden kannte
        `arrival_hour` — den Namen, unter dem Channex die Ankunftszeit
        tatsächlich liefert („HH:MM", 24 h). Ergebnis: rechts stand „16:00",
        während dieselbe Buchung eine Anreise-Automation mit dem Vermerk
        „Feld ohne Wert: checkin_time" liegen ließ.
        """
        occ = raw.get("occupancy") or {}
        return (
            raw.get("checkin_time") or occ.get("checkin_time") or raw.get("arrival_hour"),
            raw.get("checkout_time")
            or occ.get("checkout_time")
            or raw.get("departure_hour"),
        )

    @staticmethod
    def _ota_buchungszeit(raw: dict) -> str | None:
        """Wann der Gast beim Portal gebucht hat — aus der OTA-Originalmeldung.

        Channex reicht die geparste Meldung der Gegenseite als `raw_message`
        durch (JSON-Text). Booking.com trägt darin `date` + `time` des
        Buchungsvorgangs. Der Wert wird UNVERÄNDERT als Text weitergegeben und
        NICHT in eine Zeitzone gerechnet: Booking.com meint dort Ortszeit der
        Unterkunft, andere Portale liefern das Feld gar nicht — eine Umrechnung
        wäre geraten. Angezeigt wird er als Angabe, nicht als Uhrzeit im Kopf
        des Ereignisses (dafür steht `inserted_at`, das nachweislich UTC ist).
        """
        roh = raw.get("raw_message")
        if isinstance(roh, str):
            try:
                roh = json.loads(roh)
            except ValueError:
                return None
        if not isinstance(roh, dict):
            return None
        datum = str(roh.get("date") or "").strip()
        zeit = str(roh.get("time") or "").strip()
        if not datum:
            return None
        return f"{datum} {zeit}".strip()

    def _booking_events(self, row: dict) -> list[InboxMessage]:
        """Lebenslauf der Reservierung als Ereignisse im Verlauf.

        Vorbild Lodgify: „Gast macht Buchung · 22:18 · Booking.com" und
        „Reservierungsstatus geändert", beide aufklappbar. Ohne das steht die
        Konversation ohne Anlass da.

        JEDE Angabe stammt von der Gegenseite, nicht von uns:

        * Zeitpunkt = `channex_booking.ota_inserted_at` — Eingang der ersten
          Booking Revision bei Channex (write-once, 0261). Vorher stand hier
          unser `created_at`; bei einem Feed-Nachlauf trugen damit zwanzig
          Buchungen aus drei Wochen dieselbe Sekunde.
        * Kanal = `ota_name` aus der Buchungsmeldung („BookingCom", „Airbnb").
        * Aufgeklappt: Reservierungsnummer, An-/Abreise und — wenn das Portal
          sie mitschickt — der Buchungszeitpunkt aus der OTA-Originalmeldung.

        Fehlt die OTA-Zeit (Altbestand ohne Rohdaten), fällt der Zeitpunkt
        sichtbar auf den Import zurück; dann steht das auch als Angabe dabei,
        statt unsere Uhr als OTA-Zeit auszugeben.
        """
        events: list[InboxMessage] = []
        raw = row.get("raw") if isinstance(row.get("raw"), dict) else {}
        ota_eingang = row.get("ota_inserted_at") or ota_zeitstempel_utc(
            raw.get("inserted_at")
        )
        eingang = ota_eingang or row.get("created_at")
        if eingang:
            fakten = [
                InboxEventFact(label=label, value=str(wert))
                for label, wert in (
                    ("reservationCode", row.get("ota_reservation_code")),
                    ("arrival", row.get("arrival_date")),
                    ("departure", row.get("departure_date")),
                    ("bookedAtOta", self._ota_buchungszeit(raw)),
                )
                if wert
            ]
            if not ota_eingang:
                fakten.append(
                    InboxEventFact(label="importedAt", value=str(eingang))
                )
            events.append(
                InboxMessage(
                    id=f"event:booked:{row.get('id')}",
                    message="",
                    sender="event",
                    sent_at=eingang,
                    event_title="bookingReceived",
                    event_facts=fakten,
                    event_channel=row.get("ota_name"),
                )
            )
        status = (row.get("status") or "").strip().lower()
        if status in ("modified", "cancelled"):
            # Zeitpunkt der ÄNDERUNG: `raw` trägt immer die zuletzt empfangene
            # Revision, deren `inserted_at` genau der Eingang dieser Änderung
            # bei Channex ist. Erst wenn die fehlt, unsere `updated_at`.
            geaendert = ota_zeitstempel_utc(raw.get("inserted_at")) or row.get(
                "updated_at"
            )
            if geaendert:
                events.append(
                    InboxMessage(
                        id=f"event:status:{row.get('id')}",
                        message="",
                        sender="event",
                        sent_at=geaendert,
                        event_title="statusChanged",
                        # Roher Enum-Wert; die Oberfläche übersetzt ihn.
                        event_detail=status,
                        event_channel=row.get("ota_name"),
                    )
                )
        return events

    def _merge_notes(
        self, db: Client, tenant_id: str, thread_id: str, msgs: list[InboxMessage]
    ) -> list[InboxMessage]:
        """Interne Notizen (sender='note', gelb) chronologisch einfügen."""
        res = (
            db.table("inbox_thread_note")
            .select("id, body, author_id, created_at")
            .eq("tenant_id", tenant_id)
            .eq("thread_id", thread_id)
            .order("created_at")
            .execute()
        )
        notes = res.data or []
        if not notes:
            return msgs
        names = self._user_names(
            db, tenant_id, [n["author_id"] for n in notes if n.get("author_id")]
        )
        note_msgs = [
            InboxMessage(
                id=n["id"],
                message=n.get("body") or "",
                sender="note",
                sent_at=n.get("created_at"),
                author_name=names.get(n.get("author_id")),
            )
            for n in notes
        ]
        merged = msgs + note_msgs
        merged.sort(key=_chronologisch)
        return merged

    @staticmethod
    def zu_nachricht(m: dict) -> InboxMessage:
        a = m.get("attributes") or m
        # Channex: sender kann "guest"/"property" o.ä. heißen.
        sender = (a.get("sender") or a.get("author") or "guest").lower()
        if sender not in ("guest", "property"):
            sender = "property" if "host" in sender or "prop" in sender else "guest"
        return InboxMessage(
            id=m.get("id") or a.get("id"),
            message=a.get("message") or a.get("text") or "",
            sender=sender,
            sent_at=a.get("inserted_at") or a.get("sent_at") or a.get("time"),
        )

    def send_message(
        self, ctx: AuthContext, thread_id: str, message: str,
        *, enforce_reply: bool = True,
    ) -> InboxMessage:
        """Antwort an den Gast senden.

        `enforce_reply=False` umgeht die INBOX_REPLY-Prüfung — nur für den
        internen Cron/Scheduler-Pfad (die Berechtigung wurde beim Planen geprüft).
        """
        text = (message or "").strip()
        if not text:
            raise InboxError("Nachricht darf nicht leer sein.", status_code=422)
        if enforce_reply:
            db, tenant_id, row, _access = self._load_thread_scoped(ctx, thread_id)
            if not _access.can_reply:
                raise InboxError(
                    "Keine Berechtigung zum Senden.", status_code=403
                )
        else:
            db, tenant_id = self._require(ctx)
            row = self._load_thread(db, tenant_id, thread_id)

        # Platzhalter erst HIER auflösen, nicht beim Planen: eine Anreise-Automail
        # wird Tage vorher eingeplant, der Türcode entsteht oft erst kurz davor.
        # FeldFehlt wird bewusst durchgereicht — der Aufrufer (Scheduler) hält den
        # Grund an der geplanten Nachricht fest, statt „Hallo ," zu verschicken.
        text = rendern(text, self._feld_kontext(db, tenant_id, row))

        # Sandbox: Antwort lokal als 'property'-Nachricht ablegen.
        if self._sandbox_enabled():
            ins = (
                db.table("sandbox_message")
                .insert(
                    {
                        "tenant_id": tenant_id,
                        "thread_id": thread_id,
                        "sender": "property",
                        "message": text,
                    }
                )
                .execute()
            ).data
            created = ins[0] if ins else {}
            return InboxMessage(
                id=created.get("id"),
                message=text,
                sender="property",
                sent_at=created.get("created_at"),
            )

        cbid = row.get("channex_booking_id")
        if not cbid:
            raise InboxError(
                "Für diese Konversation ist kein Versand möglich.", status_code=422
            )
        try:
            res = self._portal_senden(cbid, row, text)
        except ChannexError as exc:
            if self._is_channel_without_chat(exc):
                raise InboxError(
                    "Dieser Buchungskanal überträgt keine Gastnachrichten.",
                    status_code=409,
                ) from exc
            raise InboxError(exc.message, status_code=exc.status_code) from exc
        data = res.get("data") or {}
        if data:
            return self.zu_nachricht(data)
        # Channex bestätigt teils ohne Echo — dann die gesendete Nachricht zurück.
        return InboxMessage(message=text, sender="property")

    def get_reservation_detail(
        self, ctx: AuthContext, thread_id: str,
        access: "InboxAccess | None" = None,
    ) -> ReservationDetail:
        """Reservierungs-Kontext rechts neben dem Chat (Listing, Gast, Preis …)."""
        db, tenant_id = self._require(ctx)
        access = access or self.access(ctx)
        row = self._load_thread(
            db, tenant_id, thread_id, access=access, scope_user_id=ctx.user_id
        )
        customer = self._customer_of(row)

        listing_name = None
        listing_photo = None
        address = None
        rental_id = None
        prop = self._property_for_thread(db, tenant_id, row)
        if prop:
            rental_id = prop.get("id")
            listing_name = prop.get("title")
            address = " ".join(
                x for x in [prop.get("address"), prop.get("city")] if x
            ).strip() or None
            photos = prop.get("photos") or []
            listing_photo = photos[0] if photos else None

        nights = self._nights(row.get("arrival_date"), row.get("departure_date"))
        amount = row.get("amount_cents")
        # Gäste-Aufschlüsselung + Zeiten aus der rohen OTA-Payload (falls vorhanden).
        raw = row.get("raw") or {}
        occ = raw.get("occupancy") or {}
        checkin_time, checkout_time = self._ota_zeiten(raw)
        mask = access.mask
        total = (amount / 100) if isinstance(amount, (int, float)) else None
        return ReservationDetail(
            listing_name=listing_name,
            listing_photo=listing_photo,
            address=address,
            rental_id=str(rental_id) if rental_id else None,
            guest_name=mask.name(self._guest_name(customer)),
            guest_email=mask.contact_value(customer.get("mail") or customer.get("email")),
            guest_phone=mask.contact_value(customer.get("phone")),
            guest_language=customer.get("language") or customer.get("lang"),
            guest_location=self._guest_location(customer),
            adults=occ.get("adults"),
            children=occ.get("children"),
            nights=nights,
            total_amount=mask.amount(total),
            paid_amount=mask.amount(0.0),
            currency=row.get("currency") if mask.amounts else None,
            status=row.get("status"),
            ota_name=mask.source_value(row.get("ota_name")),
            ota_reservation_code=row.get("ota_reservation_code"),
            check_in=row.get("arrival_date"),
            check_out=row.get("departure_date"),
            checkin_time=checkin_time,
            checkout_time=checkout_time,
            note=row.get("note"),
            is_starred=bool(row.get("is_starred")),
        )

    def update_thread_flags(
        self, ctx: AuthContext, thread_id: str, *,
        is_starred: bool | None = None, note: str | None = None,
        is_read: bool | None = None, is_archived: bool | None = None,
        remind_at: str | None = None,
    ) -> None:
        """Konversations-Flags setzen: Favorit, Notiz, Lese-/Archiv-Status,
        Erinnerung. Nur gesetzte Felder werden geschrieben."""
        db, tenant_id, _row, _access = self._load_thread_scoped(ctx, thread_id)
        patch: dict = {}
        if is_starred is not None:
            patch["is_starred"] = bool(is_starred)
        if note is not None:
            patch["note"] = note
        if is_read is not None:
            patch["is_read"] = bool(is_read)
        if is_archived is not None:
            patch["is_archived"] = bool(is_archived)
        if remind_at is not None:
            patch["remind_at"] = remind_at or None
        if not patch:
            return
        db.table("channex_booking").update(patch).eq("tenant_id", tenant_id).eq(
            "id", thread_id
        ).execute()

    # --- Lebenszyklus: Archiv / Papierkorb / Löschen ------------------------
    _SET_STATUSES = ("active", "archived", "trashed", "deleted")

    def set_inbox_status(
        self, ctx: AuthContext, thread_id: str, status: str
    ) -> None:
        """Posteingang-Status setzen (Soft-Delete durchgängig).

        active   – zurück in den Posteingang (Wiederherstellen)
        archived – ins Archiv
        trashed  – in den Papierkorb
        deleted  – endgültig löschen (nur Posteingang-Sicht; Buchung bleibt)
        """
        if status not in self._SET_STATUSES:
            raise InboxError("Unbekannter Status.", status_code=422)
        db, tenant_id, _row, _access = self._load_thread_scoped(ctx, thread_id)
        patch = {"inbox_status": status}
        # is_archived synchron halten (Kompat. mit bestehender Spalte/Logik).
        patch["is_archived"] = status == "archived"
        db.table("channex_booking").update(patch).eq("tenant_id", tenant_id).eq(
            "id", thread_id
        ).execute()

    # --- Zuweisung ----------------------------------------------------------
    @staticmethod
    def _has_inbox_access(role: object, permissions: object) -> bool:
        """Hat der Nutzer Posteingang-Zugriff (PM_CHAT, Admin immer)?"""
        from src.features.auth.granular_permissions import Permission, has_permission
        from src.features.auth.schemas import UserRole

        try:
            role_enum = UserRole(role) if role else None
        except ValueError:
            role_enum = None
        return has_permission(role_enum, permissions, Permission.PM_CHAT)

    def list_team(self, ctx: AuthContext) -> "TeamMemberList":
        """Mögliche Bearbeiter: nur Tenant-Nutzer mit Posteingang-Zugriff (PM_CHAT).

        Man soll nicht an jemanden zuweisen können, der den Thread nie öffnen kann.
        """
        db, tenant_id = self._require(ctx)
        res = (
            db.table("users")
            .select("id, full_name, email, role, permissions")
            .eq("tenant_id", tenant_id)
            .order("full_name")
            .execute()
        )
        items = [
            TeamMember(
                id=u["id"], name=u.get("full_name") or u.get("email") or "—",
                email=u.get("email"),
            )
            for u in (res.data or [])
            if self._has_inbox_access(u.get("role"), u.get("permissions"))
        ]
        return TeamMemberList(items=items, total=len(items))

    def assign_thread(
        self, ctx: AuthContext, thread_id: str, user_id: str | None
    ) -> None:
        """Konversation einem Tenant-Benutzer zuweisen (None hebt auf).

        Erfordert INBOX_ASSIGN. Ziel-Nutzer muss Posteingang-Zugriff (PM_CHAT)
        haben, sonst 422. Audit: assigned_by/assigned_at werden gesetzt.
        """
        db, tenant_id, row, access = self._load_thread_scoped(ctx, thread_id)
        if not access.can_assign:
            raise InboxError("Keine Berechtigung zum Zuweisen.", status_code=403)
        if user_id:
            target = (
                db.table("users")
                .select("id, role, permissions")
                .eq("tenant_id", tenant_id)
                .eq("id", user_id)
                .limit(1)
                .execute()
            ).data
            if not target:
                raise InboxError("Benutzer nicht gefunden.", status_code=404)
            t = target[0]
            if not self._has_inbox_access(t.get("role"), t.get("permissions")):
                raise InboxError(
                    "Nutzer hat keinen Posteingang-Zugriff.", status_code=422
                )

        previous = row.get("assigned_user_id")
        now = datetime.now(UTC).isoformat()
        db.table("channex_booking").update(
            {
                "assigned_user_id": user_id,
                "assigned_by": ctx.user_id,
                "assigned_at": now,
            }
        ).eq("tenant_id", tenant_id).eq("id", thread_id).execute()
        # Audit-Historie (Best-Effort: ein Log-Fehler darf die Zuweisung nicht kippen).
        try:
            db.table("inbox_assignment_log").insert(
                {
                    "tenant_id": tenant_id,
                    "thread_id": thread_id,
                    "from_user_id": previous,
                    "to_user_id": user_id,
                    "by_user_id": ctx.user_id,
                }
            ).execute()
        except Exception as exc:  # noqa: BLE001
            log.warning("inbox_assignment_log_failed", error=str(exc))

    def link_thread_guest(
        self, ctx: AuthContext, thread_id: str, guest_id: str | None
    ) -> str | None:
        """Korrektur: Thread manuell einem Gast zuordnen.

        guest_id gesetzt → bestehenden (tenant-eigenen) Gast verknüpfen.
        guest_id None  → „Gast aus Thread anlegen": Resolver über das customer-
        JSON laufen lassen (findet bestehenden oder legt neu an).

        Erfordert INBOX_MANAGE_CONFIG (Admin-Korrektur). Gibt die verknüpfte
        guest_id zurück.
        """
        db, tenant_id, row, access = self._load_thread_scoped(ctx, thread_id)
        if not access.can_manage_config:
            raise InboxError("Keine Berechtigung zur Gast-Zuordnung.", status_code=403)

        if guest_id:
            owned = (
                db.table("guests")
                .select("id")
                .eq("tenant_id", tenant_id)
                .eq("id", guest_id)
                .limit(1)
                .execute()
            ).data
            if not owned:
                raise InboxError("Gast nicht gefunden.", status_code=404)
            resolved = owned[0]["id"]
        else:
            resolved = resolve_or_create_guest(
                db,
                tenant_id,
                contact_from_ota_customer(
                    row.get("customer") or {},
                    external_ref=row.get("ota_reservation_code"),
                ),
            )
            if not resolved:
                raise InboxError(
                    "Aus diesem Thread lässt sich kein Gast ableiten "
                    "(kein Name/keine Kontaktdaten).",
                    status_code=422,
                )

        db.table("channex_booking").update({"guest_id": resolved}).eq(
            "tenant_id", tenant_id
        ).eq("id", thread_id).execute()
        log.info(
            "inbox_thread_guest_linked",
            tenant_id=tenant_id,
            thread_id=thread_id,
            guest_id=resolved,
            by_user_id=ctx.user_id,
        )
        return resolved

    # --- Interne Notiz (gelb) ----------------------------------------------
    def add_note(self, ctx: AuthContext, thread_id: str, body: str) -> InboxMessage:
        """Interne Notiz in den Verlauf legen (gelb, nicht an die OTA)."""
        text = (body or "").strip()
        if not text:
            raise InboxError("Notiz darf nicht leer sein.", status_code=422)
        db, tenant_id, _row, _access = self._load_thread_scoped(ctx, thread_id)
        ins = (
            db.table("inbox_thread_note")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "thread_id": thread_id,
                    "author_id": ctx.user_id,
                    "body": text,
                }
            )
            .execute()
        ).data
        created = ins[0] if ins else {}
        names = self._user_names(db, tenant_id, [ctx.user_id] if ctx.user_id else [])
        return InboxMessage(
            id=created.get("id"),
            message=text,
            sender="note",
            sent_at=created.get("created_at"),
            author_name=names.get(ctx.user_id),
        )

    @staticmethod
    def _nights(arrival: str | None, departure: str | None) -> int | None:
        if not (arrival and departure):
            return None
        from datetime import date

        try:
            d = (date.fromisoformat(departure) - date.fromisoformat(arrival)).days
            return d if d > 0 else None
        except ValueError:
            return None

    # -- Automatisierungen -----------------------------------------------------
    _AUTOMATION_COLS = (
        "id, name, trigger, anchor, offset_days, send_time, property_ids, "
        "channels, template_id, message, is_active, use_property_timezone, "
        "only_first_message, window_days, window_from, window_to"
    )

    @staticmethod
    def _automation_row(r: dict) -> Automation:
        """DB-Zeile → Automation: NULL-Arrays zu [], send_time auf HH:MM kürzen."""
        st = r.get("send_time")
        return Automation(
            id=str(r["id"]),
            name=r.get("name") or "",
            trigger=r.get("trigger") or "booking_new",
            anchor=r.get("anchor") or "arrival",
            offset_days=r.get("offset_days") or 0,
            send_time=str(st)[:5] if st else None,
            property_ids=[str(p) for p in (r.get("property_ids") or [])],
            channels=list(r.get("channels") or []),
            template_id=str(r["template_id"]) if r.get("template_id") else None,
            message=r.get("message"),
            is_active=bool(r.get("is_active", True)),
            use_property_timezone=bool(r.get("use_property_timezone")),
            only_first_message=bool(r.get("only_first_message")),
            window_days=[int(t) for t in (r.get("window_days") or [])],
            window_from=str(r["window_from"])[:5] if r.get("window_from") else None,
            window_to=str(r["window_to"])[:5] if r.get("window_to") else None,
        )

    @staticmethod
    def _automation_payload(req: AutomationUpsert) -> dict:
        """Upsert-Payload: leere Arrays als NULL (= „alle"), send_time HH:MM."""
        return {
            "name": req.name,
            "trigger": req.trigger,
            "anchor": req.anchor,
            "offset_days": req.offset_days,
            "send_time": req.send_time if req.send_time else None,
            "property_ids": req.property_ids or None,
            "channels": req.channels or None,
            "template_id": req.template_id,
            "message": req.message,
            "is_active": req.is_active,
            "use_property_timezone": req.use_property_timezone,
            "only_first_message": req.only_first_message,
            # Leeres Array als NULL = „alle Tage" (analog property_ids/channels).
            "window_days": req.window_days or None,
            "window_from": req.window_from or None,
            "window_to": req.window_to or None,
        }

    _TRIGGER = ("booking_new", "before_checkin", "after_checkout", "message_received")

    def _automation_pruefen(self, req: AutomationUpsert) -> None:
        """Eingabe abweisen, bevor die DB-Constraints als 500 durchschlagen."""
        if req.trigger not in self._TRIGGER:
            raise InboxError(
                f"Unbekannter Auslöser: {req.trigger}", status_code=422
            )
        if bool(req.window_from) != bool(req.window_to):
            raise InboxError(
                "Das Zeitfenster braucht Anfang UND Ende.", status_code=422
            )
        if any(t < 0 or t > 6 for t in req.window_days):
            raise InboxError(
                "Wochentage müssen zwischen 0 (Mo) und 6 (So) liegen.",
                status_code=422,
            )
        if not (req.message or "").strip() and not req.template_id:
            raise InboxError(
                "Die Automatisierung braucht einen Text oder eine Vorlage.",
                status_code=422,
            )
        self._felder_pruefen(req.message)

    def list_automations(self, ctx: AuthContext) -> AutomationList:
        db, tenant_id = self._require(ctx)
        res = (
            db.table("message_automation")
            .select(self._AUTOMATION_COLS)
            .eq("tenant_id", tenant_id)
            .order("created_at")
            .execute()
        )
        items = [self._automation_row(r) for r in (res.data or [])]
        return AutomationList(items=items, total=len(items))

    def create_automation(
        self, ctx: AuthContext, req: AutomationUpsert
    ) -> Automation:
        db, tenant_id = self._require(ctx)
        if not req.name.strip():
            raise InboxError("Name ist nötig.", status_code=422)
        self._automation_pruefen(req)
        ins = (
            db.table("message_automation")
            .insert({"tenant_id": tenant_id, **self._automation_payload(req)})
            .execute()
        ).data
        return self._automation_row(ins[0])

    def update_automation(
        self, ctx: AuthContext, automation_id: str, req: AutomationUpsert
    ) -> Automation:
        db, tenant_id = self._require(ctx)
        self._automation_pruefen(req)
        upd = (
            db.table("message_automation")
            .update(self._automation_payload(req))
            .eq("tenant_id", tenant_id)
            .eq("id", automation_id)
            .execute()
        ).data
        if not upd:
            raise InboxError("Automatisierung nicht gefunden.", status_code=404)
        return self._automation_row(upd[0])

    def delete_automation(self, ctx: AuthContext, automation_id: str) -> None:
        db, tenant_id = self._require(ctx)
        db.table("message_automation").delete().eq("tenant_id", tenant_id).eq(
            "id", automation_id
        ).execute()
