"""Inbound: Booking-Feed, Staging, Reservierungs-Projektion, Importe.

Mixin des ChannelManagerService (verbatim aus service.py extrahiert;
siehe service.py-Fassade). State (_db/_channex) und Basis-Helper kommen
von der Fassade; Patch-Ziel für Modul-Helfer ist channel_manager.common.
"""
from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Any
from uuid import uuid4

from postgrest.exceptions import APIError
from supabase import Client

from src.core.security import AuthContext
from src.features.auth.guest_masking import GuestMask
from src.features.guests.identity import (
    contact_from_ota_customer,
    resolve_or_create_guest,
)

from .channex_client import ChannexError
from .common import ChannelManagerError, log
from .schemas import (
    BookingListResponse,
    BookingResponse,
    BookingSyncResponse,
)


class BookingsSyncMixin:
    """Inbound: Booking-Feed, Staging, Reservierungs-Projektion, Importe."""

    # Feed-Pagination: Channex liefert ohne Argumente nur 10 Revisionen. Wir
    # holen 100 je Seite (Maximum), älteste zuerst, und blättern bis der Feed
    # leer ist — gedeckelt gegen Endlosschleifen (Deckel wird geloggt, kein
    # stilles Abschneiden).
    _FEED_PAGE_LIMIT = 100
    _FEED_MAX_PAGES = 20

    # -- Bookings: Feed-Pull + Ack --------------------------------------------
    def sync_bookings(self, ctx: AuthContext) -> BookingSyncResponse:
        """Feed-Pull für DEN Tenant des Requests (manueller Sync im UI)."""
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        # KRITISCH (Mandantentrennung): Der Revisions-Feed ist KONTOWEIT — er
        # enthält die Buchungen ALLER Tenants. Wir dürfen ausschließlich
        # Revisionen verarbeiten, deren property_id zu DIESEM Tenant gehört.
        # Fremde Revisionen werden übersprungen und NICHT ge-ackt (damit der
        # zuständige Tenant sie noch aus dem Feed bekommt).
        tenant_by_property = dict.fromkeys(
            self._tenant_channex_property_ids(db, tenant_id), tenant_id
        )
        return self._sync_feed(db, tenant_by_property)

    # Single-Flight über eine LEASE (sync_lease-Tabelle, RPC 0135): der Job-
    # Dedup-Key koalesziert nur QUEUED-Jobs (0108) — er verhindert NICHT, dass
    # ein Webhook-Job neben einem bereits LAUFENDEN Feed-Job geclaimt wird.
    # Zwei parallele _sync_feed-Läufe auf demselben kontoweiten Feed würden sich
    # gegenseitig die Seiten wegacken und in den reservations-Unique-Index
    # laufen. BEWUSST KEIN pg_advisory_lock: über PostgREST gehört die Session
    # dem Connection-Pool — der Lock leakte auf einem fremden Backend (Review-
    # Befund). Die Lease ist reiner Datenzugriff (poolsicher) und heilt sich
    # bei Crash über die Ablaufzeit selbst.
    _FEED_LEASE_NAME = "channex_bookings_feed"
    _FEED_LEASE_SECONDS = 600  # großzügig über der realen Feed-Laufzeit

    def sync_bookings_all(self) -> BookingSyncResponse:
        """Feed-Pull über ALLE Tenants (Worker-Job: Webhook-Trigger + Backstop-
        Tick). Ordnet jede Revision über channex_property_map ihrem Tenant zu;
        Revisionen ohne aktives Mapping werden übersprungen und NICHT ge-ackt
        (Channex liefert sie erneut, bis das Mapping existiert).

        Single-Flight: hält ein anderer Lauf die Lease, kehrt dieser sofort ohne
        Arbeit zurück (der laufende erledigt alles offene; der nächste Tick holt
        etwaigen Rest)."""
        db = self._require_db()
        owner = f"feed-{uuid4()}"
        # Drei Ausgänge des Acquire: (a) Lease bekommen → laufen + am Ende
        # releasen. (b) Lease belegt (RPC intakt, data=false) → busy, NICHT
        # doppelt laufen. (c) RPC kaputt (Exception) → fail-open laufen, aber
        # OHNE Release-Anspruch (nichts freigeben, was uns nicht gehört —
        # die Ablaufzeit heilt jede verwaiste Lease).
        lease_owned = False
        run_anyway = False
        try:
            lease_owned = bool(
                db.rpc(
                    "try_acquire_sync_lease",
                    {
                        "p_name": self._FEED_LEASE_NAME,
                        "p_seconds": self._FEED_LEASE_SECONDS,
                        "p_owner": owner,
                    },
                ).execute().data
            )
        except Exception as exc:  # noqa: BLE001 — Lease-RPC-Fehler nie fatal
            log.warning("channex_feed_lease_rpc_failed", error=str(exc)[:200])
            run_anyway = True  # lieber laufen als Buchungen liegen lassen
        if not lease_owned and not run_anyway:
            log.info("channex_feed_lease_busy")
            return BookingSyncResponse()
        try:
            return self._sync_all_locked(db)
        finally:
            if lease_owned:
                try:
                    db.rpc(
                        "release_sync_lease",
                        {"p_name": self._FEED_LEASE_NAME, "p_owner": owner},
                    ).execute()
                except Exception as exc:  # noqa: BLE001 — Ablaufzeit heilt
                    log.warning(
                        "channex_feed_lease_release_failed", error=str(exc)[:200]
                    )

    def _sync_all_locked(self, db: Client) -> BookingSyncResponse:
        rows = (
            db.table("channex_property_map")
            .select("tenant_id, channex_property_id")
            .is_("deleted_at", "null")
            .execute()
        ).data or []
        tenant_by_property = {
            r["channex_property_id"]: r["tenant_id"]
            for r in rows
            if r.get("channex_property_id") and r.get("tenant_id")
        }
        return self._sync_feed(db, tenant_by_property)

    def _sync_feed(
        self, db: Client, tenant_by_property: dict[str, str]
    ) -> BookingSyncResponse:
        """Gemeinsamer Feed-Kern: verarbeitet alle offenen Revisionen (älteste
        zuerst) und ackt erst NACH erfolgreichem Speichern (Channex Best
        Practice).

        WICHTIG zur Pagination: der Feed enthält NUR un-geackte Revisionen —
        jedes Ack lässt die dahinterliegenden Einträge nachrücken. Ein naives
        page+=1 würde deshalb genau die nachgerückten Revisionen überspringen
        und ältere Revisionen NACH neueren verarbeiten (Buchungs-Regression,
        z. B. Storno von einer späteren Modifikation „wiederbelebt"). Darum:
        dieselbe Seite erneut holen, solange auf ihr ge-ackt wurde; nur wenn
        eine Seite komplett aus Skips/Fehlern bestand, eine Seite weiter (sonst
        käme man an Revisionen hinter einem Skip-Block nie vorbei). Gedeckelt
        über _FEED_MAX_PAGES Abrufe (Deckel wird geloggt, kein stilles
        Abschneiden)."""
        result = BookingSyncResponse()
        # Fehler lokal sammeln und am Ende einmalig zuweisen — Pylint erkennt
        # das Pydantic-Field sonst statisch als FieldInfo (ohne .append).
        errors: list[str] = []

        page = 1
        for fetch_no in range(1, self._FEED_MAX_PAGES + 1):
            try:
                feed = self._channex.get_booking_revisions_feed(
                    page=page, limit=self._FEED_PAGE_LIMIT
                )
            except ChannexError as exc:
                if fetch_no == 1:
                    raise self._wrap_channex(exc) from exc
                # Folgeabruf fehlgeschlagen: bereits Verarbeitetes ist ge-ackt
                # und bleibt gültig — Rest holt der nächste Lauf.
                errors.append(f"Feed-Abruf {fetch_no}: {exc.message}")
                break

            revisions = feed.get("data") or []
            if not revisions:
                break
            result.fetched += len(revisions)

            acked_this_page = 0
            for rev in revisions:
                attrs = rev.get("attributes") or rev
                revision_id = rev.get("id") or attrs.get("revision_id")
                rev_property_id = attrs.get("property_id")

                # Tenant der Revision bestimmen — unbekannt → skip, KEIN ack!
                rev_tenant = tenant_by_property.get(rev_property_id or "")
                if rev_tenant is None:
                    result.skipped += 1
                    continue

                try:
                    guest_id = self._upsert_booking(db, rev_tenant, attrs, revision_id)
                    # In die zentrale reservations-Tabelle + Kalender projizieren.
                    self._project_booking_to_reservation(
                        db, rev_tenant, attrs, guest_id
                    )
                    result.saved += 1
                    if revision_id:
                        self._channex.ack_booking_revision(revision_id)
                        result.acknowledged += 1
                        acked_this_page += 1
                except (ChannexError, ChannelManagerError, APIError) as exc:
                    msg = getattr(exc, "message", str(exc))
                    errors.append(f"Revision {revision_id}: {msg}")
                    log.error(
                        "channex_booking_sync_failed", revision=revision_id, error=msg
                    )
                    # Deterministische Validierungsfehler (422: z. B. Buchung
                    # ohne ID) scheitern bei JEDEM Lauf identisch. Ohne Ack
                    # stauen sie sich als Gift-Revisionen am Feed-Anfang (asc)
                    # und fressen den Abruf-Deckel. Nach dem Protokollieren
                    # acken — der Fehler ist dokumentiert, eine Wiederholung
                    # brächte nie ein anderes Ergebnis.
                    is_validation = (
                        isinstance(exc, ChannelManagerError)
                        and exc.status_code == 422
                    )
                    if is_validation and revision_id:
                        try:
                            self._channex.ack_booking_revision(revision_id)
                            result.acknowledged += 1
                            acked_this_page += 1
                        except ChannexError as ack_exc:
                            log.warning(
                                "channex_poison_ack_failed",
                                revision=revision_id, error=ack_exc.message,
                            )

            if len(revisions) < self._FEED_PAGE_LIMIT and acked_this_page == 0:
                break  # letzte (Teil-)Seite und nichts nachgerückt → fertig
            if acked_this_page == 0:
                # Seite bestand nur aus Skips/Fehlern → weiterblättern, sonst
                # blockiert ein Skip-Block alles dahinter.
                page += 1
            # sonst: dieselbe Seite erneut (Feed ist um die Acks geschrumpft).
        else:
            # Deckel erreicht: sichtbar machen statt still abschneiden — der
            # nächste Lauf (Webhook/Tick) zieht den Rest.
            log.warning(
                "channex_feed_fetch_cap_reached", fetches=self._FEED_MAX_PAGES
            )
            errors.append(
                f"Feed-Abruf-Deckel ({self._FEED_MAX_PAGES}) erreicht — "
                "Rest folgt im nächsten Lauf."
            )

        result.errors = errors
        return result

    def list_bookings(self, ctx: AuthContext) -> BookingListResponse:
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        # Gast-PII im OTA-customer-Blob über die zentrale Maske (Daten-Split §4):
        # ohne VIEW_GUEST_NAME/CONTACT keine vollen Namen/Kontaktdaten.
        from src.features.auth.guest_masking import load_guest_mask

        mask = load_guest_mask(db, ctx.user_id)
        res = (
            db.table("channex_booking")
            .select("*")
            .eq("tenant_id", tenant_id)
            .order("arrival_date", desc=True)
            .limit(200)
            .execute()
        )
        items = [self._to_booking(r, mask) for r in (res.data or [])]
        return BookingListResponse(items=items, total=len(items))

    def _upsert_booking(
        self, db: Client, tenant_id: str, attrs: dict[str, Any], revision_id: str | None
    ) -> str | None:
        """Staging-Zeile schreiben + Gast über den zentralen Resolver verknüpfen.

        Gibt die guest_id zurück, damit die Reservierungs-Projektion denselben
        Gast nutzt (ein Resolve pro Buchung, kein Doppel-Matching)."""
        channex_booking_id = attrs.get("booking_id") or attrs.get("id")
        if not channex_booking_id:
            raise ChannelManagerError("Buchung ohne ID übersprungen.", status_code=422)

        # Zentraler Resolver: ein Pfad für alle Kanäle (E-Mail→Telefon→OTA-ID).
        guest_id = resolve_or_create_guest(
            db,
            tenant_id,
            contact_from_ota_customer(
                attrs.get("customer") or {},
                external_ref=attrs.get("ota_reservation_code"),
            ),
        )

        amount = attrs.get("amount")
        amount_cents = self._to_cents(amount)
        row = {
            "tenant_id": tenant_id,
            "channex_booking_id": channex_booking_id,
            "revision_id": revision_id,
            "system_id": attrs.get("system_id"),
            "ota_name": attrs.get("ota_name"),
            "ota_reservation_code": attrs.get("ota_reservation_code"),
            "status": attrs.get("status") or "new",
            "arrival_date": attrs.get("arrival_date"),
            "departure_date": attrs.get("departure_date"),
            "amount_cents": amount_cents,
            "currency": attrs.get("currency"),
            "customer": attrs.get("customer") or {},
            "guest_id": guest_id,  # direkter Thread→Gast-Link (Inbox/Gästekarte)
            "raw": attrs,
        }
        upserted = (
            db.table("channex_booking")
            .upsert(row, on_conflict="channex_booking_id")
            .execute()
        ).data or []
        # Automails für diesen Thread planen (Buchungsbestätigung, Anreise-/
        # Check-out-Info …): idempotent über den Unique-Index je (Automation,
        # Thread). Versand erfolgt später per Cron (dispatch_due_automations).
        # Best effort — ein Planungsfehler darf den Buchungs-Import nicht abbrechen.
        if upserted:
            try:
                from src.features.inbox.service import InboxService

                InboxService(service_client=db).schedule_automations_for_thread(
                    tenant_id, str(upserted[0]["id"])
                )
            except Exception as exc:  # noqa: BLE001 — Planung nie fatal
                log.warning(
                    "automail_schedule_failed",
                    tenant_id=tenant_id,
                    error=str(exc),
                )
        return guest_id

    # -- Import Channex → zentrale reservations / availability / Preise --------
    # OTA-Buchungen landen nicht nur als Staging (channex_booking), sondern werden
    # in die zentrale reservations-Tabelle projiziert + im Kalender als belegt
    # gesperrt. Channex = Quelle der Wahrheit. KEINE Fallback-Werte: fehlt eine
    # Pflichtangabe, wird die Buchung übersprungen und geloggt.

    # OTA-Name → reservation_channel-Enum. Der Enum kennt nur diese Werte; andere
    # OTAs (Expedia, Agoda, …) laufen auf 'portal', ihr echter Name bleibt in
    # reservations.ota_name erhalten (für Kalender-Anzeige + Posteingang).
    _OTA_CHANNEL_MAP = {
        "booking.com": "booking",
        "airbnb": "airbnb",
        "vrbo": "vrbo",
    }

    @classmethod
    def _ota_name_to_channel(cls, ota_name: str | None) -> str:
        if not ota_name:
            return "portal"
        return cls._OTA_CHANNEL_MAP.get(ota_name.strip().lower(), "portal")

    def _resolve_local_property(
        self, db: Client, tenant_id: str, channex_property_id: str
    ) -> str | None:
        """channex_property_id → lokale property_id (aktives Mapping, tenant-scoped)."""
        pm = (
            db.table("channex_property_map")
            .select("property_id")
            .eq("tenant_id", tenant_id)
            .eq("channex_property_id", channex_property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        )
        return pm.data[0]["property_id"] if pm.data else None

    @staticmethod
    def _date_range_nights(check_in: str, check_out: str) -> list[str]:
        """Belegte Nächte [check_in, check_out) als ISO-Datumsliste (Abreisetag
        exklusiv)."""
        start = date.fromisoformat(check_in)
        end = date.fromisoformat(check_out)
        out: list[str] = []
        cur = start
        while cur < end:
            out.append(cur.isoformat())
            cur += timedelta(days=1)
        return out

    def _set_availability(
        self,
        db: Client,
        property_id: str,
        days: list[str],
        *,
        status: str,
        source: str,
    ) -> None:
        for d in days:
            db.table("availability").upsert(
                {
                    "property_id": property_id,
                    "date": d,
                    "status": status,
                    "source": source,
                },
                on_conflict="property_id,date",
            ).execute()

    def _free_ota_nights(
        self,
        db: Client,
        tenant_id: str,
        property_id: str,
        channel: str,
        nights: list[str],
    ) -> None:
        """Gibt die genannten Nächte quellengenau frei — lokal (availability
        'open') NUR wo sie WIRKLICH von DIESER OTA-Quelle belegt waren, und an
        Channex (availability=1) NUR für die tatsächlich frei gewordenen Tage.
        Gemeinsame Logik von Voll-Storno und Buchungs-Verkürzung/-Verschiebung:
        ein Tag, der lokal noch belegt ist (überlappende Direkt-/Fremdbelegung,
        manueller Block), darf NICHT als buchbar an Channex gemeldet werden
        (Überbuchung)."""
        freed: list[str] = []
        for d in nights:
            upd = (
                db.table("availability")
                .update({"status": "open", "source": "manual"})
                .eq("property_id", property_id)
                .eq("date", d)
                .eq("status", "booked")
                .eq("source", channel)
                .execute()
            ).data or []
            if upd:
                freed.append(d)
        for d in freed:
            day = date.fromisoformat(d)
            self.push_availability_for_property(tenant_id, property_id, day, day, 1)

    def _property_currency(self, db: Client, property_id: str) -> str | None:
        """Objekt-Währung aus dem (ältesten) Rate-Plan — die lokale Wahrheit für
        die Währung dieses Objekts. Dient als Rückfall, wenn die OTA-Payload
        keine currency trägt. KEIN EUR-Hardcode (27 EU-Länder): fehlt auch der
        Rate-Plan, bleibt es None und der Aufrufer entscheidet."""
        rows = (
            db.table("rate_plans")
            .select("currency, created_at")
            .eq("property_id", property_id)
            .order("created_at")
            .limit(1)
            .execute()
        ).data or []
        return rows[0].get("currency") if rows else None

    @staticmethod
    def _projection_precheck(
        tenant_id: str, booking_id: str | None, attrs: dict[str, Any]
    ) -> bool:
        """Vorbedingungen für die Reservierungs-Projektion (Pflichtfelder +
        Status-Whitelist). False → skip mit Log; hält die Projektionsmethode
        flach."""
        if not (
            booking_id
            and attrs.get("property_id")
            and attrs.get("arrival_date")
            and attrs.get("departure_date")
        ):
            log.warning(
                "reservation_skip_incomplete",
                tenant_id=tenant_id, booking_id=booking_id,
            )
            return False
        # Status-Whitelist: nur echte Buchungs-Zustände projizieren. Ein
        # unbekannter Status (sollte Channex je eine noch nicht akzeptierte
        # Airbnb-Anfrage als Revision liefern) darf NICHT hart zu 'confirmed'
        # werden und Nächte sperren/avail=0 pushen (Phantom-Belegung).
        status = (attrs.get("status") or "new").strip().lower()
        if status not in ("new", "modified", "cancelled"):
            log.warning(
                "reservation_skip_unknown_status",
                tenant_id=tenant_id, booking_id=booking_id, status=status,
            )
            return False
        return True

    def _project_booking_to_reservation(
        self,
        db: Client,
        tenant_id: str,
        attrs: dict[str, Any],
        guest_id: str | None = None,
    ) -> bool:
        """OTA-Buchung → zentrale reservations + Kalender-Block. Idempotent über
        source_channex_booking_id. Gibt True bei Erfolg, False bei skip zurück.

        `guest_id` stammt aus `_upsert_booking` (zentraler Resolver); ist er nicht
        gesetzt (Aufruf ohne vorheriges Staging), wird hier resolved."""
        booking_id = attrs.get("booking_id") or attrs.get("id")
        channex_property_id = attrs.get("property_id")
        arrival = attrs.get("arrival_date")
        departure = attrs.get("departure_date")
        if not self._projection_precheck(tenant_id, booking_id, attrs):
            return False

        property_id = self._resolve_local_property(db, tenant_id, channex_property_id)
        if not property_id:
            log.warning(
                "reservation_skip_no_property",
                tenant_id=tenant_id,
                channex_property_id=channex_property_id,
            )
            return False

        ota_name = attrs.get("ota_name")
        channel = self._ota_name_to_channel(ota_name)
        status_in = (attrs.get("status") or "new").lower()
        existing = (
            db.table("reservations")
            .select("id, checked_out_at, check_in, check_out, property_id")
            .eq("tenant_id", tenant_id)
            .eq("source_channex_booking_id", booking_id)
            .limit(1)
            .execute()
        ).data
        # Nach echtem Check-out (0091) ist der Aufenthalt abgeschlossen — ein
        # OTA-Resync darf status='completed' nicht mehr überschreiben (weder
        # auf confirmed zurückdrehen noch nachträglich stornieren + freigeben).
        already_checked_out = bool(existing and existing[0].get("checked_out_at"))
        # Alten Zeitraum UND altes Objekt JETZT sichern (vor dem update(row) unten)
        # — für den Alt-/Neu-Diff bei Verkürzung/Verschiebung UND für den
        # Objektwechsel. Nach dem Update ist existing[0] überschrieben, dann wäre
        # der Diff leer und Alt-Nächte blieben als Phantom-Belegung gesperrt.
        old_check_in = existing[0].get("check_in") if existing else None
        old_check_out = existing[0].get("check_out") if existing else None
        old_property_id = existing[0].get("property_id") if existing else None

        # Storno: reservation stornieren + Nächte dieser OTA-Quelle wieder frei.
        if status_in == "cancelled":
            if already_checked_out:
                log.warning(
                    "booking_cancel_after_checkout_ignored",
                    tenant_id=tenant_id,
                    booking_id=booking_id,
                )
                return True
            if existing:
                db.table("reservations").update({"status": "cancelled"}).eq(
                    "id", existing[0]["id"]
                ).execute()
            # Alle Nächte dieser Buchung quellengenau freigeben (lokal + Channex).
            # Wurzel 1: den LOKAL gebuchten Alt-Zeitraum auf dem LOKAL gebuchten
            # Alt-Objekt freigeben — NICHT den Zeitraum/das Objekt aus dem Storno-
            # Payload. Weicht die Storno-Revision ab (anderer Zeitraum / anderes
            # property_id), blieben sonst die echten gesperrten Alt-Nächte hängen.
            free_property_id = old_property_id or property_id
            if existing and old_check_in and old_check_out:
                cancel_nights = self._date_range_nights(
                    str(old_check_in), str(old_check_out)
                )
            else:
                cancel_nights = self._date_range_nights(arrival, departure)
            self._free_ota_nights(
                db,
                tenant_id,
                free_property_id,
                channel,
                cancel_nights,
            )
            # Offene externe Provision dieser Buchung entfernen (Gegenzustand,
            # Wurzel 1). Best-effort — Storno-Pfad darf nie kippen (Wurzel 5).
            if existing:
                self._cancel_commission_safe(tenant_id, existing[0]["id"])
            return True

        if guest_id is None:
            guest_id = resolve_or_create_guest(
                db,
                tenant_id,
                contact_from_ota_customer(
                    attrs.get("customer") or {},
                    external_ref=attrs.get("ota_reservation_code"),
                ),
            )
        total = attrs.get("amount")
        try:
            total_amount = float(total) if total is not None else 0
        except (TypeError, ValueError):
            total_amount = 0
        # Gästezahl + Kontakt aus dem Channex-Booking übernehmen (für Balken +
        # Detailansicht). occupancy ist je nach OTA dict {adults,children,infants}
        # oder eine Zahl; defensiv beides unterstützen, sonst 1.
        adults, children, infants = self._booking_occupancy(attrs)
        customer = attrs.get("customer") or {}
        row = {
            "tenant_id": tenant_id,
            "property_id": property_id,
            "guest_id": guest_id,
            "channel": channel,
            "ota_name": ota_name,
            "external_ref": attrs.get("ota_reservation_code"),
            "check_in": arrival,
            "check_out": departure,
            "status": "confirmed",
            "total_amount": total_amount,
            # Währung aus der OTA-Payload; fehlt sie, aus dem Objekt-Rate-Plan —
            # nie hart auf EUR (verfälscht PLN/CZK/CHF-Buchungen + Rechnung).
            "currency": attrs.get("currency") or self._property_currency(db, property_id),
            "source_channex_booking_id": booking_id,
            "num_guests": max(1, adults + children + infants),
            "adults": adults,
            "children": children,
            "infants": infants,
            "guest_email": customer.get("mail") or customer.get("email"),
            "guest_phone": customer.get("phone"),
            "guest_language": customer.get("language"),
            "guest_country": customer.get("country"),
            # Policy-Zeiten + Preisaufschlüsselung aus der OTA-Payload (sofern
            # vorhanden; kein Erfinden — fehlt ein Feld, bleibt es leer).
            "checkin_time": attrs.get("checkin_time"),
            "checkout_time": attrs.get("checkout_time"),
            "quote_items": self._booking_quote_items(attrs),
            "external_url": attrs.get("ota_url") or attrs.get("external_url"),
        }
        if existing:
            if already_checked_out:
                # Abgeschlossener (fakturierter) Aufenthalt: Status, Zeitraum
                # und Beträge sind eingefroren — die finale Rechnung ist
                # bereits erstellt und darf nicht von einem OTA-Resync
                # abweichen. Nur unkritische Felder (Kontakt) übernehmen.
                for frozen in (
                    "status",
                    "check_in",
                    "check_out",
                    "total_amount",
                    "quote_items",
                    "currency",
                ):
                    row.pop(frozen, None)
            db.table("reservations").update(row).eq("id", existing[0]["id"]).execute()
            reservation_id = existing[0]["id"]
        else:
            inserted = db.table("reservations").insert(row).execute().data
            reservation_id = inserted[0]["id"] if inserted else None
            # Zeitleiste (0122): „Buchung erstellt" für die eingehende OTA-Buchung
            # (Booking/Airbnb & Co.). Nur bei NEUanlage — eine Modifikation ist
            # keine Erst-Erstellung. Best-effort: ein Log-Fehler darf den Import
            # nicht kippen (Wurzel 5, breites except bewusst markiert).
            if reservation_id:
                try:
                    db.table("reservation_events").insert({
                        "tenant_id": tenant_id,
                        "reservation_id": reservation_id,
                        "kind": "created",
                        "detail": {"channel": channel, "ota_name": ota_name},
                    }).execute()
                except Exception as exc:  # noqa: BLE001 — Zeitleiste ist best-effort
                    log.warning(
                        "reservation_event_log_failed",
                        reservation_id=reservation_id,
                        kind="created",
                        error=str(exc)[:200],
                    )

        if already_checked_out:
            # Auch Kalender/Channex nicht mehr anfassen: die OTA-Revision kann
            # einen ANDEREN Zeitraum liefern als der eingefrorene Aufenthalt —
            # ihre Nächte zu sperren erzeugte verwaiste Blockierungen.
            return True

        new_nights = self._date_range_nights(arrival, departure)
        # Kalender: belegte Nächte sperren (Buchung ist autoritativ für 'booked').
        self._set_availability(
            db,
            property_id,
            new_nights,
            status="booked",
            source=channel,
        )
        # Realtime an Channex: Tage sperren (availability=0) → kein OTA-Doppel.
        self.push_availability_for_property(
            tenant_id,
            property_id,
            date.fromisoformat(arrival),
            date.fromisoformat(departure) - timedelta(days=1),
            0,
        )
        # Buchungs-MODIFIKATION (Verkürzung/Verschiebung/OBJEKTWECHSEL einer
        # bestehenden OTA-Buchung): die neuen Nächte sind jetzt gesperrt, aber die
        # durch die Änderung GERÄUMTEN Alt-Nächte bleiben sonst dauerhaft
        # 'booked'/avail=0 → Phantom-Belegung, auf allen Kanälen unverkäuflich.
        if existing and old_check_in and old_check_out:
            old_nights = self._date_range_nights(str(old_check_in), str(old_check_out))
            if old_property_id and old_property_id != property_id:
                # Objektwechsel (Gast bucht auf der OTA von Objekt A auf B um): die
                # Reservierung wurde oben auf Objekt B umgehängt. Der KOMPLETTE
                # alte Zeitraum auf dem ALTEN Objekt A muss frei werden — sonst
                # bleibt A dauerhaft phantombelegt. Der Datums-Diff (der auf B
                # rechnet) träfe A nie.
                self._free_ota_nights(
                    db, tenant_id, old_property_id, channel, old_nights
                )
            else:
                # Gleiches Objekt: nur die aus dem alten Zeitraum herausfallenden
                # Tage (Verkürzung/Verschiebung) freigeben.
                freed_nights = [d for d in old_nights if d not in set(new_nights)]
                if freed_nights:
                    self._free_ota_nights(
                        db, tenant_id, property_id, channel, freed_nights
                    )
        # Externe Provision (1 %/0,5 %) für diese OTA-Buchung erfassen. Best-effort
        # — der Buchungs-Import darf nie an der Provision scheitern (Wurzel 5).
        # Idempotent über reservation_id (Wurzel 2), Satz aus der Objektzahl.
        if reservation_id:
            self._record_commission_safe(
                db, tenant_id, reservation_id, channel, total_amount, row["currency"]
            )
        return True

    def _record_commission_safe(
        self,
        db: Client,
        tenant_id: str,
        reservation_id: str,
        channel: str,
        gross_amount: float,
        currency: str | None,
    ) -> None:
        """OTA-Provision erfassen, ohne den Import-Pfad zu gefährden (Wurzel 5).
        Nur externe Kanäle mit Umsatz erzeugen eine Ledger-Zeile."""
        try:
            from src.features.subscriptions.service import SubscriptionsService

            SubscriptionsService(service_client=db).record_commission(
                tenant_id,
                reservation_id=reservation_id,
                channel=channel,
                gross_amount=gross_amount,
                currency=currency or "",
            )
        except Exception:  # noqa: BLE001 — best-effort, kein Kippen des Imports
            log.warning(
                "commission_record_failed",
                tenant_id=tenant_id,
                reservation_id=reservation_id,
            )

    def _cancel_commission_safe(
        self, tenant_id: str, reservation_id: str
    ) -> None:
        """Offene Provision bei Storno entfernen (Gegenzustand, best-effort)."""
        try:
            from src.features.subscriptions.service import SubscriptionsService

            SubscriptionsService(service_client=self._db).cancel_commission(
                tenant_id, reservation_id=reservation_id
            )
        except Exception:  # noqa: BLE001 — best-effort, kein Kippen des Stornos
            log.warning(
                "commission_cancel_failed",
                tenant_id=tenant_id,
                reservation_id=reservation_id,
            )

    def _booking_occupancy(self, attrs: dict[str, Any]) -> tuple[int, int, int]:
        """Gästezahl (adults, children, infants) aus einem Channex-Booking.

        occupancy ist je nach OTA ein dict {adults,children,infants} oder eine
        Zahl; alternativ liegt number_of_guests/occupancy direkt vor. Fehlt
        alles, gilt 1 Erwachsener (keine erfundene größere Belegung)."""
        occ = attrs.get("occupancy")
        if isinstance(occ, dict):
            return (
                self._as_int(occ.get("adults")) or 1,
                self._as_int(occ.get("children")) or 0,
                self._as_int(occ.get("infants")) or 0,
            )
        total = self._as_int(occ) or self._as_int(attrs.get("number_of_guests"))
        return (total or 1, 0, 0)

    def _booking_quote_items(self, attrs: dict[str, Any]) -> list[dict[str, Any]]:
        """Preisaufschlüsselung [{label, amount, kind}] aus einem Channex-Booking.

        Channex liefert Positionen je nach OTA unter `rooms` (Zimmerpreis) und
        `services` (Reinigung/Steuern/Gebühren). Wir übernehmen nur, was wirklich
        da ist (Label + Betrag) — fehlt die Struktur, bleibt die Liste leer
        (keine erfundenen Posten). `kind` klassifiziert für die Rechnungs-
        erstellung (rooms→lodging, services→fee); USt-Feinheiten je OTA-Gebühr
        kennt Channex nicht — dokumentierte Modellgrenze."""
        items: list[dict[str, Any]] = []
        for room in attrs.get("rooms") or []:
            if not isinstance(room, dict):
                continue
            amount = self._to_float(room.get("amount") or room.get("total_price"))
            if amount is None:
                continue
            label = room.get("title") or room.get("room_type_name") or "Zimmerpreis"
            items.append({"label": str(label), "amount": amount, "kind": "lodging"})
        for svc in attrs.get("services") or []:
            if not isinstance(svc, dict):
                continue
            amount = self._to_float(svc.get("total_price") or svc.get("amount"))
            if amount is None:
                continue
            label = svc.get("name") or svc.get("title") or "Gebühr"
            items.append({"label": str(label), "amount": amount, "kind": "fee"})
        return items

    @staticmethod
    def _to_float(value: object) -> float | None:
        if value is None:
            return None
        try:
            return float(value)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return None

    def import_bookings_for_property(
        self,
        tenant_id: str,
        channex_property_id: str,
        *,
        inserted_after: str | None = None,
    ) -> dict[str, int]:
        """EINMALIGER Initial-/Recovery-Import via GET /bookings (paginiert).
        Pro Buchung: Staging (_upsert_booking) + Projektion in reservations.
        KEIN ack (das macht nur der Feed). Pro Buchung isoliert (eine kaputte
        blockiert den Rest nicht)."""
        result = {"fetched": 0, "saved": 0, "skipped": 0}
        if not self._channex.is_configured or self._db is None:
            return result
        db = self._db
        page = 1
        while page <= 200:  # Sicherung gegen Endlosschleife
            resp = self._channex.list_bookings_for_property(
                channex_property_id, page=page, limit=100, inserted_after=inserted_after
            )
            data = resp.get("data") or []
            result["fetched"] += len(data)
            for item in data:
                attrs = item.get("attributes") or item
                try:
                    guest_id = self._upsert_booking(
                        db, tenant_id, attrs, attrs.get("revision_id")
                    )
                    if self._project_booking_to_reservation(
                        db, tenant_id, attrs, guest_id
                    ):
                        result["saved"] += 1
                    else:
                        result["skipped"] += 1
                except Exception as exc:  # noqa: BLE001
                    result["skipped"] += 1
                    log.error(
                        "import_booking_failed",
                        tenant_id=tenant_id,
                        error=str(exc),
                    )
            meta = resp.get("meta") or {}
            total = meta.get("total") or 0
            limit = meta.get("limit") or 100
            if not data or page * limit >= total:
                break
            page += 1
        log.info("import_bookings_done", tenant_id=tenant_id, **result)
        return result

    def import_ari_for_property(
        self,
        tenant_id: str,
        channex_property_id: str,
        *,
        days_ahead: int = 365,
        today: date | None = None,
    ) -> dict[str, int]:
        """Preise + Verfügbarkeit aus Channex importieren. availability 0/stop_sell
        → blocked, >0 → open (NIE 'booked' überschreiben). rate → price_overrides;
        stop_sell → stop_sell-Tabelle. Gechunkt (90 Tage). Mapping über die
        channex_*_map-Tabellen; unbekannte UUIDs werden übersprungen."""
        result = {"prices": 0, "availability": 0, "stop_sell": 0}
        if not self._channex.is_configured or self._db is None:
            return result
        db = self._db
        property_id = self._resolve_local_property(db, tenant_id, channex_property_id)
        if not property_id:
            return result

        # Nicht bei Channex gemanaged (kein aktives property_map) → Channex ist
        # NICHT die Verfügbarkeits-Wahrheit für dieses Objekt. Für ein gemanagtes
        # Objekt pushen wir Kontingent/Rate (unabhängig von OTAs), sodass Channex
        # echte Werte (qty>0) liefert und der Import korrekt 'open' schreibt. Für
        # ein NICHT gemanagtes Objekt meldet Channex per Default availability=0 /
        # stop_sell für ALLE Tage; würde der Import das zurückschreiben, überschriebe
        # er die lokale Verfügbarkeit flächig mit „gesperrt" und legte massenhaft
        # anonyme stop_sell-Zeilen an. Symmetrisch zum Push-Gate (_is_channex_managed).
        if not self._is_channex_managed(db, tenant_id, property_id):
            log.info(
                "import_ari_skipped_not_managed",
                tenant_id=tenant_id, property_id=property_id,
            )
            return result

        # Warm-up-Guard (Wurzel 4/5): Ein gemapptes, aber NIE gepushtes Objekt
        # (kein aktiver Kanal / vor dem ersten Go-Live-Push) meldet bei Channex
        # per Default availability=0 für ALLE Tage. Das ist KEIN echter OTA-Zustand,
        # sondern der Channex-Default eines leeren Objekts — ihn als 'blocked' zu
        # übernehmen sperrt die Property flächig auf ALLEN Plattformen. Solange keine
        # Push-Historie existiert (keine ari_outbox-Zeile mit status='done'), darf
        # qty=0 daher NICHT zu 'blocked' werden. qty>0 → 'open' bleibt immer erlaubt
        # (echte Freigabe darf sofort einlaufen). Der einzige verlässliche „schon
        # mal echt gepusht"-Nachweis ohne Schema-Feld.
        has_pushed = bool(
            db.table("ari_outbox")
            .select("id")
            .eq("property_id", property_id)
            .eq("status", "done")
            .limit(1)
            .execute()
            .data
        )
        if not has_pushed:
            log.info(
                "import_ari_no_push_history_block_suppressed",
                tenant_id=tenant_id, property_id=property_id,
            )

        start = today or datetime.now(UTC).date()
        # Ping-Pong-Schutz (Wurzel 1): Tage, für die wir GERADE erst einen
        # availability-Delta an Channex gepusht haben (ari_outbox der letzten
        # 30 Min, pending ODER done), NICHT aus Channex zurückspiegeln. Channex
        # verarbeitet ARI asynchron — ein Import kurz nach unserem Push läse noch
        # den alten Wert und überschriebe die frische lokale Wahrheit (Host gibt
        # Tag frei → Import macht ihn wieder 'blocked' → Full-Sync zementiert 0).
        # DB ist Availability-Master; der Import gleicht nur EXTERN verursachte
        # Änderungen ab.
        recent_cutoff = (datetime.now(UTC) - timedelta(minutes=30)).isoformat()
        recent_push_days: set[str] = set()
        # Skip-Kriterium: frisch gepushte Tage (created_at >= cutoff) ODER noch
        # offene Push-Absichten (status=pending, egal wie alt) — bleibt ein Push
        # >30 min pending (Channex-Ausfall), darf der Import den ALTEN Channex-
        # Wert nicht über die frischere lokale Wahrheit spiegeln; der Outbox-
        # Retry repariert nur Channex, nicht den lokalen Kalender.
        for r in (
            db.table("ari_outbox")
            .select("date_from, date_to")
            .eq("property_id", property_id)
            .or_(f"created_at.gte.{recent_cutoff},status.eq.pending")
            .execute()
        ).data or []:
            if r.get("date_from") and r.get("date_to"):
                cur = date.fromisoformat(r["date_from"])
                last = date.fromisoformat(r["date_to"])
                while cur <= last:
                    recent_push_days.add(cur.isoformat())
                    cur += timedelta(days=1)
        chunk = 90
        offset = 0
        while offset < days_ahead:
            d_from = (start + timedelta(days=offset)).isoformat()
            d_to = (
                start + timedelta(days=min(offset + chunk, days_ahead) - 1)
            ).isoformat()
            offset += chunk

            # Verfügbarkeit (synthetisch: 1 Room-Type/Property → über alle aggregieren)
            try:
                avail = self._channex.get_availability(
                    channex_property_id, date_from=d_from, date_to=d_to
                )
            except ChannexError as exc:
                log.warning("import_ari_availability_failed", error=exc.message)
                avail = {"data": {}}
            by_date: dict[str, int] = {}
            for _room_type, days in (avail.get("data") or {}).items():
                for d, qty in (days or {}).items():
                    by_date[d] = max(by_date.get(d, 0), int(qty or 0))
            # Bestehende Tage EINMAL laden (statt pro Tag einzeln) — und nur
            # schreiben, wenn sich der Status WIRKLICH ändert. Sonst würde jeder
            # Sync-Lauf alle 365 Tage neu upserten (updated_at-Bump) und — mit
            # aktiver Realtime-Publication — eine Event-/Reload-Flut auslösen.
            existing_days = {
                r["date"]: r
                for r in (
                    db.table("availability")
                    .select("date, status, source")
                    .eq("property_id", property_id)
                    .in_("date", list(by_date.keys()))
                    .execute()
                ).data
                or []
            }
            for d, qty in by_date.items():
                # Frisch selbst gepushter Tag → Channex-Wert ignorieren (Ping-Pong).
                if d in recent_push_days:
                    continue
                cur = existing_days.get(d)
                # 'booked'-Tage (echte Buchung) NICHT überschreiben.
                if cur and cur["status"] == "booked":
                    continue
                # Warm-up-Guard: ohne Push-Historie ist qty=0 der Channex-Default
                # eines leeren Objekts, kein echter OTA-Zustand → NICHT als 'blocked'
                # übernehmen (sonst flächige Sperre über alle Plattformen). qty>0
                # (echte Freigabe) läuft immer ein.
                if qty <= 0 and not has_pushed:
                    continue
                new_status = "open" if qty > 0 else "blocked"
                # Idempotent: identischer Status → nichts schreiben (Quelle egal).
                # Eine manuelle Sperre (source='manual') mit gleichem Status NICHT
                # zu 'portal' umschreiben — die Herkunft steuert _free_ota_nights.
                if cur and cur["status"] == new_status:
                    continue
                db.table("availability").upsert(
                    {
                        "property_id": property_id,
                        "date": d,
                        "status": new_status,
                        "source": "portal",
                    },
                    on_conflict="property_id,date",
                ).execute()
                result["availability"] += 1

            # Preise + stop_sell (Restrictions)
            try:
                restr = self._channex.get_restrictions(
                    channex_property_id,
                    date_from=d_from,
                    date_to=d_to,
                    restrictions="rate,min_stay_arrival,stop_sell",
                )
            except ChannexError as exc:
                log.warning("import_ari_restrictions_failed", error=exc.message)
                restr = {"data": {}}
            # WICHTIG: zurückgelesene OTA-Raten NICHT als price_override
            # schreiben. price_override ist per Architektur die MANUELLE
            # Host-Überschreibung und gewinnt im Resolver über dynamic_prices.
            # Beim Import würde das einen Echo-Loop erzeugen: unsere eigenen
            # gepushten Dynamic-Preise kämen als „manueller Override" zurück,
            # verdeckten die Engine-Preise samt Faktor-Aufschlüsselung und
            # frören sie als Festpreis ein. Die Preis-Wahrheit ist und bleibt
            # der pricing-Resolver (override > dynamic > weekday > base);
            # eingehende OTA-Raten sind kein manueller Override.
            #
            # stop_sell: derselbe Echo-Loop droht auch hier. Ein manuell
            # gesetzter Stop-Sell (source=manual, agency_id/reason) wird an
            # Channex gepusht und kommt beim nächsten Import als stop_sell=1
            # zurück — ununterscheidbar von einem echten OTA-Stop. Ein blinder
            # Upsert würde die manuelle Zeile zu source=channex degradieren und
            # agency_id/reason (z. B. TUI) auf NULL setzen. Daher: nur Tage
            # schreiben, die NOCH KEINEN Eintrag haben (echter neuer OTA-Stop).
            # Bestehende Tage — manual (eigenes Echo) wie channex (schon da) —
            # werden übersprungen; das schützt die Herkunft UND ist idempotent
            # (kein updated_at-Bump → keine Realtime-Event-Flut), analog zum
            # Availability-Block oben.
            stopped = {
                d
                for _rate_plan, days in (restr.get("data") or {}).items()
                for d, vals in (days or {}).items()
                if (vals or {}).get("stop_sell")
            }
            # Warm-up-Guard (Wurzel 4/5): ohne Push-Historie ist ein flächiger
            # stop_sell der Channex-Default eines leeren Objekts, kein echter OTA-
            # Stop → nicht importieren (sonst 365 anonyme channex-stop_sells, die
            # alle Plattformen sperren). qty>0/echte Freigaben laufen darüber nicht.
            if stopped and not has_pushed:
                log.info(
                    "import_ari_stop_sell_suppressed_no_push_history",
                    tenant_id=tenant_id, property_id=property_id,
                    days=len(stopped),
                )
                stopped = set()
            if stopped:
                existing_stops = {
                    r["date"]
                    for r in (
                        db.table("stop_sell")
                        .select("date")
                        .eq("property_id", property_id)
                        .in_("date", list(stopped))
                        .execute()
                    ).data
                    or []
                }
                # Gebuchte Tage NIE als Stop-Sell schreiben: ein gebuchter Tag ist
                # verkauft, ein Stop-Sell darüber verfälscht die Verfügbarkeits-
                # Wahrheit. Auf 'stopped' gescopte Query (nicht existing_days aus
                # dem Availability-Feed, das divergieren kann).
                booked_days = {
                    r["date"]
                    for r in (
                        db.table("availability")
                        .select("date")
                        .eq("property_id", property_id)
                        .eq("status", "booked")
                        .in_("date", list(stopped))
                        .execute()
                    ).data
                    or []
                }
                for d in stopped:
                    if d in existing_stops or d in booked_days:
                        continue
                    db.table("stop_sell").upsert(
                        {
                            "tenant_id": tenant_id,
                            "property_id": property_id,
                            "date": d,
                            "source": "channex",
                        },
                        on_conflict="property_id,date",
                    ).execute()
                    result["stop_sell"] += 1
        log.info("import_ari_done", tenant_id=tenant_id, **result)
        return result

    def import_rooms_rates_for_property(
        self, tenant_id: str, channex_property_id: str
    ) -> dict[str, int]:
        """Room-Types/Rate-Plans aus Channex spiegeln: Maps sicherstellen und
        lokale rate_plans anlegen, wo noch keiner gemappt ist (Basispreis aus der
        Primär-Occupancy; per_person-Staffeln werden geloggt, nicht erfunden)."""
        result = {"room_types": 0, "rate_plans": 0}
        if not self._channex.is_configured or self._db is None:
            return result
        db = self._db
        pm = (
            db.table("channex_property_map")
            .select("id, property_id")
            .eq("tenant_id", tenant_id)
            .eq("channex_property_id", channex_property_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data
        if not pm:
            return result
        property_map_id = pm[0]["id"]
        property_id = pm[0]["property_id"]

        try:
            rts = self._channex.get_room_types(channex_property_id).get("data") or []
        except ChannexError as exc:
            log.warning("import_room_types_failed", error=exc.message)
            rts = []
        for rt in rts:
            cx_rt_id = rt.get("id")
            attrs = rt.get("attributes") or {}
            if not cx_rt_id:
                continue
            db.table("channex_room_type_map").upsert(
                {
                    "tenant_id": tenant_id,
                    "property_map_id": property_map_id,
                    "local_unit_ref": property_id,
                    "title": attrs.get("title"),
                    "channex_room_type_id": cx_rt_id,
                    "deleted_at": None,
                },
                on_conflict="channex_room_type_id",
            ).execute()
            result["room_types"] += 1

        try:
            rps = self._channex.get_rate_plans(channex_property_id).get("data") or []
        except ChannexError as exc:
            log.warning("import_rate_plans_failed", error=exc.message)
            rps = []
        for rp in rps:
            cx_rp_id = rp.get("id")
            attrs = rp.get("attributes") or {}
            if not cx_rp_id:
                continue
            cx_rt_id = attrs.get("room_type_id")
            rt_map = (
                db.table("channex_room_type_map")
                .select("id")
                .eq("tenant_id", tenant_id)
                .eq("channex_room_type_id", cx_rt_id)
                .is_("deleted_at", "null")
                .limit(1)
                .execute()
            ).data
            if not rt_map:
                log.warning("import_rate_plan_no_room_type", channex_rate_plan_id=cx_rp_id)
                continue
            # Bereits gemappt?
            existing_map = (
                db.table("channex_rate_plan_map")
                .select("id, local_rate_plan_id")
                .eq("tenant_id", tenant_id)
                .eq("channex_rate_plan_id", cx_rp_id)
                .is_("deleted_at", "null")
                .limit(1)
                .execute()
            ).data
            local_rate_plan_id = (
                existing_map[0]["local_rate_plan_id"] if existing_map else None
            )
            if not local_rate_plan_id:
                # Basispreis aus Primär-Option (per_person: nur Primär, Rest loggen).
                options = attrs.get("options") or []
                primary = next(
                    (o for o in options if o.get("is_primary")), options[0] if options else {}
                )
                try:
                    base_price = float(primary.get("rate")) if primary.get("rate") else 0
                except (TypeError, ValueError):
                    base_price = 0
                if attrs.get("sell_mode") == "per_person" and len(options) > 1:
                    log.info(
                        "import_rate_plan_per_person_truncated",
                        channex_rate_plan_id=cx_rp_id,
                        options=len(options),
                    )
                ins = (
                    db.table("rate_plans")
                    .insert(
                        {
                            "property_id": property_id,
                            "name": attrs.get("title") or "Rate",
                            "base_price": base_price,
                            # Währung aus dem Channex-Rate-Plan; fehlt sie, aus
                            # einem vorhandenen Objekt-Rate-Plan — nie EUR raten.
                            "currency": (
                                attrs.get("currency")
                                or self._property_currency(db, property_id)
                            ),
                            "min_stay": 1,
                        }
                    )
                    .execute()
                )
                local_rate_plan_id = ins.data[0]["id"] if ins.data else None
            db.table("channex_rate_plan_map").upsert(
                {
                    "tenant_id": tenant_id,
                    "room_type_map_id": rt_map[0]["id"],
                    "local_rate_plan_id": local_rate_plan_id,
                    "title": attrs.get("title"),
                    "channex_rate_plan_id": cx_rp_id,
                    "deleted_at": None,
                },
                on_conflict="channex_rate_plan_id",
            ).execute()
            result["rate_plans"] += 1
        log.info("import_rooms_rates_done", tenant_id=tenant_id, **result)
        return result

    @staticmethod
    def _mask_customer(customer: dict[str, Any], mask: GuestMask) -> dict[str, Any]:
        """OTA-customer-Blob gemäß Gast-Maske bereinigen (Daten-Split §4).

        Namensfelder werden auf den Vornamen reduziert, wenn VIEW_GUEST_NAME fehlt;
        Kontaktfelder (Mail/Telefon) entfallen ganz ohne VIEW_GUEST_CONTACT. Andere
        Felder (Land etc.) bleiben unverändert."""
        if not customer:
            return {}
        name_keys = {"name", "first_name", "firstname", "surname", "last_name", "lastname"}
        contact_keys = {"mail", "email", "phone", "tel", "telephone"}
        out: dict[str, Any] = {}
        for key, value in customer.items():
            low = key.lower()
            if low in name_keys and isinstance(value, str):
                out[key] = mask.name(value)
            elif low in contact_keys:
                out[key] = mask.contact_value(value if isinstance(value, str) else None)
            else:
                out[key] = value
        return out

    @staticmethod
    def _to_booking(row: dict[str, Any], mask: GuestMask) -> BookingResponse:
        # Betrag + Buchungsquelle maskierungskonform: ohne PM_BOOKING_TOTAL
        # (amounts) keine Beträge/Währung, ohne VIEW_BOOKING_SOURCE keine
        # OTA-Namen/-Codes. staff/cleaner (§4.3) sehen weder Umsatz noch Quelle.
        amount = mask.amount(
            float(row["amount_cents"]) if row.get("amount_cents") is not None else None
        )
        return BookingResponse(
            id=row["id"],
            external_id=row["channex_booking_id"],
            ota_name=mask.source_value(row.get("ota_name")),
            ota_reservation_code=mask.source_value(row.get("ota_reservation_code")),
            status=row.get("status", "new"),
            arrival_date=row.get("arrival_date"),
            departure_date=row.get("departure_date"),
            amount_cents=int(amount) if amount is not None else None,
            currency=(row.get("currency") if mask.amounts else None),
            customer=BookingsSyncMixin._mask_customer(row.get("customer") or {}, mask),
            acknowledged_at=row.get("acknowledged_at"),
        )

    @staticmethod
    def _to_cents(amount: object) -> int | None:
        if amount is None:
            return None
        try:
            return round(float(amount) * 100)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return None
