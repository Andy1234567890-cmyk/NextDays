"""Service-Schicht für inbox.

Threads werden aus den importierten OTA-Buchungen (channex_booking) abgeleitet:
pro Buchung ein Thread mit Portal, Gast, Reservierungsbezug. Nachrichten werden
über die Channex-Messaging-API gelesen und gesendet (Booking.com/Airbnb/Expedia).
Ein optionaler KI-Antwortvorschlag (Groq) hilft beim Beantworten.

Tenant-scoped (tenant_id aus dem JWT). Kein stilles Exception-Swallowing.
"""
import json
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Final

from supabase import Client

from src.core.countries import telefon_anzeigen
from src.core.languages import sprach_name
from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.channel_manager.channex_client import ChannexClient, ChannexError
from src.features.channel_manager.common import ota_zeitstempel_utc
from src.features.guests.identity import (
    contact_from_ota_customer,
    resolve_or_create_guest,
)

from .anhaenge import AnhangWissenMixin
from .ausloeser import ALLE_TRIGGER
from .automation_mapping import (
    AUTOMATION_COLS,
    automation_payload,
    automation_row,
)
from .errors import InboxError
from .feld_kontext import FeldKontextMixin
from .felder import FeldFehlt, rendern, unbekannte_felder
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

# Der Nachrichten-Spiegel (`portal_messages`): lesen, nachtragen, Signal setzen.
from .spiegel import SpiegelMixin, sichere_anhaenge
from .vorlagen import VorlagenMixin

if TYPE_CHECKING:
    from .authz import InboxAccess

log = get_logger("nextdays.inbox")


# Vor dem Beginn jeder echten Zeitangabe — Sortier-Ersatz für Unlesbares.
_URZEIT: Final = datetime.min.replace(tzinfo=UTC)

def _als_zeitpunkt(wert: str | None) -> datetime:
    """ISO-Zeichenkette → Zeitpunkt zum VERGLEICHEN (nie zum Anzeigen).

    Nötig, weil dieselbe Sekunde hier in zwei Schreibweisen ankommt: PostgREST
    liefert `…+00:00`, `ota_zeitstempel_utc` hängt ein `Z` an. Im
    Zeichenvergleich ist „Z" > „+", also sortierte ein String-Vergleich die
    beiden Formate gegeneinander falsch herum.

    Unlesbar oder leer → `_URZEIT`, damit solche Einträge ans Ende einer
    absteigenden Sortierung fallen, statt sie anzuführen.
    """
    if not wert:
        return _URZEIT
    try:
        gelesen = datetime.fromisoformat(wert.replace("Z", "+00:00"))
    except ValueError:
        return _URZEIT
    # Ohne Zone gilt UTC — sonst wirft der Vergleich „offset-naive vs aware".
    return gelesen if gelesen.tzinfo else gelesen.replace(tzinfo=UTC)


def _chronologisch(m: InboxMessage) -> tuple[int, datetime]:
    """Sortierschlüssel des Verlaufs: nach Zeit, Einträge OHNE Zeit ans Ende.

    Ein schlichtes `m.sent_at or ""` täte das Gegenteil — der leere String
    sortiert vor jedem Zeitstempel und schöbe zeitlose Einträge an den Anfang.
    Das fiel lange nicht auf, weil ohne interne Notizen gar nicht sortiert
    wurde; seit Nachrichten, Notizen und Ereignisse in EINEM Strang laufen,
    stünde die letzte Kanal-Nachricht ohne Zeitstempel plötzlich ganz oben.
    Da Pythons Sortierung stabil ist, behalten sie untereinander ihre
    Eingangsreihenfolge."""
    return (0, _als_zeitpunkt(m.sent_at)) if m.sent_at else (1, _URZEIT)


class InboxService(
    PlanungMixin, VorlagenMixin, AnhangWissenMixin, FeldKontextMixin, SpiegelMixin
):
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
                "is_read, read_at, is_starred, is_archived, assigned_user_id, "
                "inbox_status, property_map_id, booked_at, ota_inserted_at"
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
        # VORauswahl nach dem Buchungszeitpunkt, nicht nach `updated_at`
        # (0291/0292): letzteres ist unsere Schreibzeit — als der Feed 22
        # Buchungen in einem Rutsch holte, trugen alle dieselbe Sekunde und die
        # Reihenfolge war zufällig. `nullsfirst=False`: Threads ohne
        # Portal-Zeitpunkt ans Ende, statt die Liste anzuführen.
        # Die ENDGÜLTIGE Reihenfolge entsteht erst unten nach
        # `letzte_aktivitaet` — die steckt in `portal_messages` und ist für
        # die Datenbank hier nicht sortierbar.
        res = (
            query.order("booked_at", desc=True, nullsfirst=False)
            .order("updated_at", desc=True)
            .limit(200)
            .execute()
        )
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
        # Wann kam zuletzt eine GAST-Nachricht? Daraus wird der Lesestand
        # abgeleitet (s. `_ist_gelesen`).
        letzte_gast = self._letzte_gastnachricht(
            db, tenant_id, [r["id"] for r in rows]
        )
        # Profilbilder in EINEM Query für die ganze Liste (0295) — nicht je
        # Zeile, sonst wären es 200 Abfragen für 200 Threads.
        bilder = self._gast_bilder(
            db, tenant_id, [r["guest_id"] for r in rows if r.get("guest_id")]
        )

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
                    guest_avatar_url=bilder.get(str(r.get("guest_id") or "")),
                    property_id=prop[0] if prop else None,
                    property_title=prop[1] if prop else None,
                    ota_name=mask.source_value(r.get("ota_name")),
                    ota_reservation_code=r.get("ota_reservation_code"),
                    guest_name=mask.name(self._guest_name(customer)),
                    guest_email=mask.contact_value(customer.get("mail") or customer.get("email")),
                    guest_phone=mask.contact_value(telefon_anzeigen(customer.get("phone"))),
                    status=r.get("status"),
                    arrival_date=r.get("arrival_date"),
                    departure_date=r.get("departure_date"),
                    last_message=(letzte.get(r["id"]) or ("", "", ""))[0] or None,
                    # Wer zuletzt geschrieben hat: „guest" = der Gast wartet auf
                    # Antwort, „property" = wir haben zuletzt geschrieben.
                    last_sender=(letzte.get(r["id"]) or ("", "", ""))[1] or None,
                    booked_at=r.get("booked_at"),
                    letzte_aktivitaet=self._letzte_aktivitaet(
                        r.get("booked_at"), (letzte.get(r["id"]) or ("", "", ""))[2]
                    ),
                    updated_at=r.get("updated_at"),
                    is_read=self._ist_gelesen(r, letzte_gast.get(r["id"])),
                    is_starred=bool(r.get("is_starred")),
                    is_archived=bool(r.get("is_archived")),
                    inbox_status=r.get("inbox_status") or "active",
                    assigned_user_id=uid,
                    assigned_user_name=names.get(uid) if uid else None,
                )
            )
        # „Letzte Aktivität" heißt: was zuletzt passiert ist — eine Nachricht
        # von gestern schlägt eine Buchung von letztem Monat. Threads ganz ohne
        # Zeitpunkt fallen ans Ende (`_URZEIT`), statt die Liste anzuführen.
        items.sort(key=lambda t: _als_zeitpunkt(t.letzte_aktivitaet), reverse=True)
        return InboxListResponse(items=items, total=len(items))

    @staticmethod
    def _letzte_aktivitaet(booked_at: str | None, letzte_nachricht: str) -> str | None:
        """Wann ist in diesem Thread zuletzt etwas PASSIERT?

        Der Buchungszeitpunkt allein ist es nicht: schreibt der Gast Wochen
        nach der Buchung, bleibt der Thread sonst da stehen, wo die Buchung
        ihn hinterlassen hat. Live war genau das der Fall — Dietmar Sperle
        schrieb am 06.08., stand aber mit seinem Buchungsdatum (10.07.) auf
        Platz 5, unter drei Threads ohne jede Nachricht.

        Beide Werte sind Fremdereignisse (Wurzel 5b): die Buchung beim Portal,
        die Nachricht beim Portal. Der jüngere von beiden gewinnt. Fehlen
        beide, bleibt es `None` — die Liste zeigt dann „Eingang bei uns", statt
        auf unsere Uhr zurückzufallen.

        Verglichen wird der ZEITPUNKT, nicht die Zeichenkette: die beiden
        Quellen schreiben dieselbe Sekunde unterschiedlich (`…+00:00` aus
        PostgREST, `…Z` aus `ota_zeitstempel_utc`), und „Z" > „+" im
        Zeichenvergleich — ein String-`max` kehrte die Reihenfolge genau dann
        um, wenn die Formate gemischt sind.
        """
        kandidaten = [w for w in (booked_at, letzte_nachricht) if w]
        if not kandidaten:
            return None
        return max(kandidaten, key=_als_zeitpunkt)

    @staticmethod
    def _ist_gelesen(row: dict, letzte_gastnachricht: str | None) -> bool:
        """Ist dieser Thread gelesen?

        `is_read` allein reicht NICHT: es ist ein Handflag, das beim Öffnen
        eines Threads auf `true` gesetzt wird und dort für immer stehen bleibt.
        Schreibt der Gast danach erneut, bliebe der Thread „gelesen" — und der
        Betrieb sieht die neue Nachricht nur, wenn er zufällig hineinschaut.
        Live war das der Zustand: alle 22 Threads `is_read = true`, während in
        der Liste bei jedem „Neu" stand (das war der BUCHUNGS-Status, s.
        `StatusBadge`) — beides zusammen ergab eine Anzeige, die nichts
        unterschied.

        Regel: gelesen = Flag gesetzt UND seither keine neue Gastnachricht.
        Unsere eigenen Antworten zählen nicht (`sender = 'property'`), sonst
        machte jede gesendete Nachricht den Thread wieder ungelesen.

        Fehlt der Vergleichszeitpunkt (`read_at` nie gesetzt, etwa bei
        Altbestand), gilt das Flag unverändert — kein erfundener Zustand
        (Wurzel 4).
        """
        flag = bool(row.get("is_read", True))
        if not flag or not letzte_gastnachricht:
            return flag
        seit = row.get("read_at")
        if not seit:
            return flag
        return str(letzte_gastnachricht) <= str(seit)

    @staticmethod
    def _gast_bilder(
        db: Client, tenant_id: str, guest_ids: list[str]
    ) -> dict[str, str]:
        """gast_id → Profilbild-URL beim Portal (0295), leer wenn keins da ist."""
        if not guest_ids:
            return {}
        res = (
            db.table("guests")
            .select("id, avatar_url")
            .eq("tenant_id", tenant_id)
            .in_("id", list(set(guest_ids)))
            .not_.is_("avatar_url", "null")
            .execute()
        )
        return {str(g["id"]): g["avatar_url"] for g in (res.data or [])}

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
            .select(
                "id, title, address, city, country, photos, timezone, "
                # Für die Platzhalter aus den übernommenen Lodgify-Vorlagen:
                # Postleitzahl, Koordinaten (Kartenlink) und Kaution.
                "postal_code, lat, lng, deposit_amount, "
                # Die mehrsprachigen Gasttexte (`messaging`) liegen hier —
                # gepflegt unter /objekte/{id}/nachrichten.
                "type_attributes"
            )
            .eq("tenant_id", tenant_id)
            .eq("id", str(property_id))
            .limit(1)
            .execute()
        ).data or []
        return props[0] if props else None

    # Feldname in `type_attributes.messaging` → unser Kontext-Feld. Gepflegt
    # wird unter `/objekte/{id}/nachrichten` (`web/lib/messaging-meta.ts`).
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

    def get_messages(self, ctx: AuthContext, thread_id: str) -> InboxMessagesResponse:
        db, tenant_id, row, _access = self._load_thread_scoped(ctx, thread_id)
        # Lesestand des Gastes (0297) — an JEDER Rueckgabe, auch an den
        # Fehlerpfaden: dass der Portal-Chat gerade klemmt, macht ein frueher
        # gemeldetes Gelesen nicht ungueltig.
        gelesen = row.get("guest_read_at")

        # Der lokale Spiegel ist die BASIS, nicht nur die Vorschauquelle (0305).
        # Er wird bei jedem Eingang geschrieben (Webhook + Journal-Tick), ist
        # also vollständig — und er trägt die Anzeige auch dann, wenn der
        # Aggregator gerade nicht antwortet. Vorher hing der gesamte Verlauf am
        # Live-Abruf: ein Portal-Ausfall zeigte einen leeren Chat, obwohl die
        # Nachrichten lokal vorlagen.
        gespiegelt = self._spiegel_lesen(db, tenant_id, thread_id)

        cbid = row.get("channex_booking_id")
        if not cbid:
            items = self._merge_stream(db, tenant_id, thread_id, row, gespiegelt)
            return InboxMessagesResponse(
                items=items, total=len(items), guest_read_at=gelesen
            )
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
                items = self._merge_stream(
                    db, tenant_id, thread_id, row, gespiegelt
                )
                return InboxMessagesResponse(
                    items=items, total=len(items), guest_read_at=gelesen
                )
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
            # Der Spiegel trägt die Anzeige weiter, auch wenn das Portal
            # gerade nichts hergibt. `unavailable` bleibt gesetzt: der Betrieb
            # soll wissen, dass er auf lokalem Stand schaut und eine Antwort
            # jetzt nicht rausgeht.
            items = self._merge_stream(db, tenant_id, thread_id, row, gespiegelt)
            return InboxMessagesResponse(
                items=items, total=len(items), unavailable=grund,
                guest_read_at=gelesen,
            )
        vom_portal = [self.zu_nachricht(m) for m in (res.get("data") or [])]
        self._spiegel_schreiben(db, tenant_id, thread_id, cbid, vom_portal)
        # Beide Quellen zusammenführen: der Live-Abruf ist der frischere Stand,
        # der Spiegel hält fest, was das Portal aus seinem Verlauf entfernt hat
        # (Airbnb zeigt Support-/Systemnachrichten nicht am Buchungspfad).
        # Schlüssel ist die Nachrichten-ID — dieselbe Identität wie im UNIQUE
        # des Spiegels, sonst stünde jede Nachricht doppelt im Verlauf.
        items = self._merge_stream(
            db, tenant_id, thread_id, row, self._vereinen(vom_portal, gespiegelt)
        )
        return InboxMessagesResponse(
            items=items, total=len(items), guest_read_at=gelesen
        )

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
    def _ota_zeiten(
        raw: dict, reservierung: dict | None = None
    ) -> tuple[str | None, str | None]:
        """Erwartete An-/Abreisezeit.

        EINE Stelle für beide Leser (Detailspalte rechts und die Platzhalter
        `{{checkin_time}}`/`{{checkout_time}}` der Automationen). Vorher stand
        die Auflösung zweimal im Code, und nur eine der beiden kannte
        `arrival_hour` — den Namen, unter dem Channex die Ankunftszeit
        tatsächlich liefert („HH:MM", 24 h). Ergebnis: rechts stand „16:00",
        während dieselbe Buchung eine Anreise-Automation mit dem Vermerk
        „Feld ohne Wert: checkin_time" liegen ließ.

        Zwei Quellen, in dieser Reihenfolge:

        1. Die eigene Reservierung (`reservations.checkin_time`). Dort steht,
           was beim Import vom Portal geholt wurde — bei Airbnb aus
           `check_in_datetime`, das Channex NICHT durchreicht (live: `raw`
           enthält weder `checkin_time` noch `arrival_hour`, während Airbnb
           selbst „16:00" liefert).
        2. Die Channex-Payload, für alles, was über den Feed kommt.

        Kein Ersatzwert, wenn beides fehlt: „Feld ohne Wert" ist ehrlicher als
        eine erfundene Uhrzeit, nach der sich ein Gast richtet (Wurzel 4).
        """
        res = reservierung or {}
        occ = raw.get("occupancy") or {}
        return (
            res.get("checkin_time")
            or raw.get("checkin_time")
            or occ.get("checkin_time")
            or raw.get("arrival_hour"),
            res.get("checkout_time")
            or raw.get("checkout_time")
            or occ.get("checkout_time")
            or raw.get("departure_hour"),
        )

    @staticmethod
    def _zeiten_vom_objekt(
        prop: dict | None, checkin: str | None, checkout: str | None
    ) -> tuple[str | None, str | None]:
        """Fehlende An-/Abreisezeit aus der HAUSREGEL des Objekts ergänzen.

        Dritte und letzte Quelle nach `_ota_zeiten`. Sie steht in
        `properties.type_attributes.policies` (`checkInTime`/`checkOutTime`) und
        stammt bei Airbnb aus den Booking Settings des Inserats
        (`check_in_time_start`, `check_out_time` — belegt in
        `docs/OTA/Airbnb/Booking Settings Airbnb.pdf`).

        Nötig, weil Airbnb die Uhrzeit NICHT je Reservierung mitschickt: sie ist
        eine Eigenschaft des Hauses, nicht der Buchung. Die beiden ersten
        Quellen sind aber beide buchungsbezogen — für eine Airbnb-Buchung liefen
        sie deshalb regelmäßig leer, obwohl die Zeit am Objekt hinterlegt war.

        Ein bereits gefundener Wert gewinnt: eine abweichende Absprache für DIESE
        Reservierung darf die allgemeine Hausregel nicht wieder überschreiben.
        Fehlt auch hier etwas, bleibt es None — kein erfundener Ersatz (Wurzel 4).
        """
        policies = ((prop or {}).get("type_attributes") or {}).get("policies") or {}
        return (
            checkin or policies.get("checkInTime") or None,
            checkout or policies.get("checkOutTime") or None,
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

        * Zeitpunkt = `reservations.booked_at`, wann der Gast beim PORTAL
          gebucht hat (0291) — erst danach Channex' Eingangszeit
          (`ota_inserted_at`, write-once 0261), zuletzt unser `created_at`.
          Die Reihenfolge ist bitter erkauft: Channex' `inserted_at` stand bei
          22 Airbnb-Buchungen auf DERSELBEN Sekunde (der Feed holte sie in
          einem Rutsch), obwohl sie vom 23.03., 01.06. und 26.07. stammten —
          die älteste war viereinhalb Monate alt und stand im Posteingang als
          „heute 10:48". Channex' eigenes `ota_booked_at` ist leer (live
          geprüft); das echte Datum gibt nur das Portal her.
        * Kanal = `ota_name` aus der Buchungsmeldung („BookingCom", „Airbnb").
        * Aufgeklappt: Reservierungsnummer, An-/Abreise und — wenn das Portal
          sie mitschickt — der Buchungszeitpunkt aus der OTA-Originalmeldung.

        Fehlt die OTA-Zeit (Altbestand ohne Rohdaten), fällt der Zeitpunkt
        sichtbar auf den Import zurück; dann steht das auch als Angabe dabei,
        statt unsere Uhr als OTA-Zeit auszugeben.
        """
        events: list[InboxMessage] = []
        raw = row.get("raw") if isinstance(row.get("raw"), dict) else {}
        # Das echte Buchungsdatum schlägt jede Eingangszeit: nur es beantwortet
        # „wann hat der Gast gebucht", während die anderen sagen, wann WIR oder
        # der Aggregator davon erfahren haben.
        gebucht = row.get("booked_at")
        ota_eingang = row.get("ota_inserted_at") or ota_zeitstempel_utc(
            raw.get("inserted_at")
        )
        eingang = gebucht or ota_eingang or row.get("created_at")
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
            # MIT Zone. Channex liefert „2026-08-06T07:19:55.000000" ohne jede
            # Zonenangabe, meint aber UTC. Roh durchgereicht deutet der Browser
            # das als ORTSZEIT (`Date.parse` → 05:19 UTC bei CEST) und schiebt
            # die Nachricht zwei Stunden nach vorn. Für die Anzeige fiel das
            # kaum auf; beim Lesestand-Vergleich (0297) hätte es ein Häkchen an
            # Nachrichten gesetzt, die der Gast nie gesehen hat.
            sent_at=ota_zeitstempel_utc(
                a.get("inserted_at") or a.get("sent_at") or a.get("time")
            ),
            attachments=sichere_anhaenge(a.get("attachments")),
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
        mask = access.mask
        total = (amount / 100) if isinstance(amount, (int, float)) else None
        # Die eigene Reservierung: Bezahlt-Stand UND die An-/Abreisezeiten.
        # Portal-kassierte Buchungen (payment_collect='ota', 0268) führen dort
        # paid_amount; ein hartes 0 widerspräche dem Buchungs-Slider daneben.
        paid = 0.0
        reservierung: dict = {}
        cbid = row.get("channex_booking_id")
        if cbid:
            res_rows = (
                db.table("reservations")
                .select("paid_amount, checkin_time, checkout_time")
                .eq("tenant_id", tenant_id)
                .eq("source_channex_booking_id", cbid)
                .limit(1)
                .execute()
            ).data
            if res_rows:
                reservierung = res_rows[0]
                paid = float(reservierung.get("paid_amount") or 0)
        checkin_time, checkout_time = self._ota_zeiten(raw, reservierung)
        return ReservationDetail(
            listing_name=listing_name,
            listing_photo=listing_photo,
            address=address,
            rental_id=str(rental_id) if rental_id else None,
            guest_name=mask.name(self._guest_name(customer)),
            guest_email=mask.contact_value(customer.get("mail") or customer.get("email")),
            guest_phone=mask.contact_value(telefon_anzeigen(customer.get("phone"))),
            guest_language=sprach_name(customer.get("language") or customer.get("lang"))
            or customer.get("language")
            or customer.get("lang"),
            guest_location=self._guest_location(customer),
            adults=occ.get("adults"),
            children=occ.get("children"),
            nights=nights,
            total_amount=mask.amount(total),
            paid_amount=mask.amount(paid),
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
            # Zeitpunkt mitschreiben (0302): erst er macht das Flag belastbar —
            # „gelesen" gilt nur bis zur nächsten Gastnachricht. Beim
            # Zurücksetzen auf ungelesen wird er geleert, sonst bliebe ein
            # alter Zeitpunkt stehen und der Thread spränge beim nächsten Laden
            # wieder auf gelesen (Wurzel 1: der Gegenzustand gehört gepflegt).
            patch["read_at"] = datetime.now(UTC).isoformat() if is_read else None
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
    # Spaltenliste und Abbildung liegen in `automation_mapping` (Datei-Länge).
    _AUTOMATION_COLS = AUTOMATION_COLS
    _automation_row = staticmethod(automation_row)
    _automation_payload = staticmethod(automation_payload)

    _TRIGGER = ALLE_TRIGGER

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
        # Sofort für die BESTEHENDEN Buchungen einplanen. Ohne diesen Schritt
        # wirkte eine neue Regel erst bei der nächsten Buchung — live standen
        # deshalb zwei frisch angelegte Regeln mit null geplanten Nachrichten da,
        # obwohl 30 künftige Aufenthalte in der Liste lagen.
        self.replan_tenant(tenant_id)
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
        # Wurzel 1: die bereits eingeplanten Nachrichten sind der Gegenzustand
        # dieser Änderung. Ohne Neuplanung blieben sie auf dem alten Zeitpunkt
        # stehen — live stand „Anreisetag, 06:00" als −3 Tage/09:00 eingeplant,
        # weil die Regel nach dem Import geändert wurde.
        self.replan_tenant(tenant_id)
        return self._automation_row(upd[0])

    def delete_automation(self, ctx: AuthContext, automation_id: str) -> None:
        db, tenant_id = self._require(ctx)
        db.table("message_automation").delete().eq("tenant_id", tenant_id).eq(
            "id", automation_id
        ).execute()
