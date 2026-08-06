"""Inbound: Booking-Feed, Staging, Reservierungs-Projektion, Importe.

Mixin des ChannelManagerService (verbatim aus service.py extrahiert;
siehe service.py-Fassade). State (_db/_channex) und Basis-Helper kommen
von der Fassade; Patch-Ziel für Modul-Helfer ist channel_manager.common.
"""
# pylint: disable=too-many-lines  # kohärente Inbound-Domäne (Feed/Staging/
# Reservierungs-Projektion/Bestandsimport) — bewusst EIN Mixin, kein Split.
from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Any
from uuid import uuid4

from postgrest.exceptions import APIError
from supabase import Client

from src.core.einheiten import AVAILABILITY_CONFLICT, freie_einheit, je_einheit
from src.core.security import AuthContext
from src.features.auth.guest_masking import GuestMask
from src.features.guests.identity import (
    contact_from_ota_customer,
    create_placeholder_guest,
    resolve_or_create_guest,
)
from src.jobs.queue import try_enqueue_recompute

from .ari_push import _group_iso_days_to_ranges
from .channex_client import ChannexError
from .common import (
    ChannelManagerError,
    log,
    ota_buchungszeitpunkt,
    ota_zeitstempel_utc,
)
from .einheiten import einheiten_zahl, freie_einheiten_spannen
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

    def import_existing_bookings(
        self, ctx: AuthContext, *, include_past: bool = False
    ) -> BookingSyncResponse:
        """EINMALIGER Bestandsimport der OTA-Buchungen aller verbundenen Objekte
        DIESES Tenants (Onboarding-Wechselkunde). Über GET /bookings (Channex-
        Doku: gültiger Weg für den initialen Pull), pro Objekt paginiert.

        ``include_past=False`` (Standard) → nur Buchungen mit Anreise ab HEUTE
        (filter[arrival_date][gte]=heute). ``include_past=True`` → auch
        vergangene: KEIN Anreise-Filter, es kommt alles, was Channex kennt.

        EHRLICHE GRENZE (belegt, Channex-Doku booking.com): Channex liefert nur
        Buchungen, die es selbst als Revision gesehen hat. Bei Booking.com holt
        die „Pull Future Reservations"-Aktion NUR ZUKÜNFTIGE aus dem Extranet;
        bereits ausgecheckte Alt-Buchungen von VOR dem Connect sind über Channex
        praktisch nicht rückholbar. include_past holt daher, was Channex hat —
        nicht garantiert die komplette Historie. Kein ack (nur der Feed ackt);
        KEINE Verfügbarkeits-/Preisauswirkung (Doku)."""
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        arrival_from = None if include_past else date.today().isoformat()

        maps = (
            db.table("channex_property_map")
            .select("channex_property_id")
            .eq("tenant_id", tenant_id)
            .is_("deleted_at", "null")
            .execute()
        ).data or []

        total = BookingSyncResponse()
        for m in maps:
            cx_id = m.get("channex_property_id")
            if not cx_id:
                continue
            try:
                res = self.import_bookings_for_property(
                    tenant_id, cx_id, arrival_from=arrival_from
                )
                total.fetched += res["fetched"]
                total.saved += res["saved"]
            except ChannexError as exc:
                total.errors.append(f"{cx_id}: {exc.message}")
                log.warning(
                    "import_existing_bookings_property_failed",
                    tenant_id=tenant_id, channex_property_id=cx_id,
                    error=exc.message,
                )
            except Exception as exc:  # noqa: BLE001 — ein Objekt kippt nicht alle
                total.errors.append(f"{cx_id}: {exc}")
                log.error(
                    "import_existing_bookings_property_error",
                    tenant_id=tenant_id, channex_property_id=cx_id,
                    error=str(exc),
                )
        log.info(
            "import_existing_bookings_done",
            tenant_id=tenant_id, include_past=include_past,
            fetched=total.fetched, saved=total.saved,
        )
        return total

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
        ota_contact = contact_from_ota_customer(
            attrs.get("customer") or {},
            external_ref=attrs.get("ota_reservation_code"),
        )
        guest_id = resolve_or_create_guest(db, tenant_id, ota_contact)
        # Regel: eine OTA-Buchung MUSS einen Gast tragen. Liefert der Resolver
        # None (Buchung ganz ohne Kontakt/Kanal-ID — bei Channex praktisch nie),
        # trotzdem einen Platzhaltergast mit needs_review anlegen, statt eine
        # guest-lose Reservierung entstehen zu lassen (Wurzel 1: kein halber Zustand).
        if guest_id is None:
            guest_id = create_placeholder_guest(
                db, tenant_id, channel="ota",
                external_ref=attrs.get("ota_reservation_code"),
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
            # Eingang bei Channex (Doku „Bookings Collection": inserted_at).
            # Die Spalte ist write-once (Trigger 0261): dieser Wert setzt sich
            # nur beim ERSTEN Mal durch, spätere Revisionen lassen ihn stehen —
            # sonst wanderte das Buchungs-Ereignis im Verlauf nach vorn.
            "ota_inserted_at": ota_zeitstempel_utc(attrs.get("inserted_at")),
            # Der ECHTE Buchungszeitpunkt (0292) — die Zeile darüber ist nur
            # der Eingang beim Aggregator. Der Posteingang liest aus DIESER
            # Tabelle, deshalb muss der Wert auch hier stehen, nicht nur in
            # `reservations`.
            "booked_at": ota_buchungszeitpunkt(attrs),
            # WELCHES OBJEKT die Buchung betrifft. Ohne diese Spalte hängt der
            # Thread an keinem Haus: der Posteingang zeigte kein Objekt, der
            # Objekt-Filter der Liste blieb leer, und jede Vorlage mit
            # `{{property_name}}` scheiterte mit „Feld ohne Wert" (live an allen
            # 22 Buchungen). Die Information lag die ganze Zeit vor — sie landete
            # nur in `raw` und nirgends sonst.
            "property_map_id": self._property_map_id(
                db, tenant_id, attrs.get("property_id")
            ),
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
    # Namen, die die Preisliste §2 einzeln nennt. Alles andere (Expedia, Agoda,
    # Namensvarianten wie "Booking.com B.V.") fällt auf 'ota_other' — ebenfalls
    # ein EXTERNER Kanal mit 1 % monatlich. Der echte Anbietername bleibt in
    # reservations.ota_name erhalten (Kalender-Anzeige + Posteingang).
    _OTA_CHANNEL_MAP = {
        "booking.com": "booking",
        "booking": "booking",
        "airbnb": "airbnb",
        "vrbo": "vrbo",
        "expedia": "ota_other",
    }

    @classmethod
    def _ota_name_to_channel(cls, ota_name: str | None) -> str:
        """OTA-Name → Kanal. NIEMALS 'portal'.

        'portal' trägt laut Preisliste §2 die 8 % all-in und macht uns zum
        Merchant of Record. Eine über den Channel-Manager eingegangene Buchung
        ist per Definition eine FREMDE Buchung — das Geld lief nie über uns.
        Fiele sie auf 'portal', entstünde doppelter Schaden: die geschuldete
        1 % würde nie fakturiert (record_commission verwirft Nicht-OTA), und
        wir trügen die Chargeback-Haftung für eine Buchung ohne Erlös.
        """
        if not ota_name:
            return "ota_other"
        return cls._OTA_CHANNEL_MAP.get(ota_name.strip().lower(), "ota_other")

    @staticmethod
    def _property_map_id(
        db: Client, tenant_id: str, channex_property_id: str | None
    ) -> str | None:
        """channex_property_id → ID der Objekt-Zuordnung (oder None).

        Anders als `_resolve_local_property` (liefert die lokale property_id für
        die Reservierung) gibt das hier die ID der MAP-Zeile zurück — genau das,
        was `channex_booking.property_map_id` erwartet.

        None, wenn die Property nicht gemappt ist: dann gehört die Buchung zu
        einem Inserat, das bei uns kein Objekt hat (live: 23 solche Airbnb-
        Inserate). Die Buchung trotzdem speichern und die Zuordnung leer lassen
        ist richtig — eine OTA-Buchung darf nie verloren gehen, nur weil das
        Objekt fehlt (sonst blieben die Nächte frei → Überbuchung). Kein Raten
        auf „irgendein Objekt" (Wurzel 4).

        Sortiert nach `created_at`: seit 0158 kann eine geteilte Channex-
        Property mehrere Map-Zeilen haben; ohne Sortierung wäre `limit(1)` nicht
        reproduzierbar.
        """
        if not channex_property_id:
            return None
        treffer = (
            db.table("channex_property_map")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("channex_property_id", str(channex_property_id))
            .is_("deleted_at", "null")
            .order("created_at")
            .limit(1)
            .execute()
        ).data
        return treffer[0]["id"] if treffer else None

    def _resolve_local_property(
        self, db: Client, tenant_id: str, channex_property_id: str,
        rooms: list[dict[str, Any]] | None = None,
    ) -> str | None:
        """channex_property_id (+ room_type der Buchung) → lokale property_id.

        Geteilte Channex-Property (Hotel, 0158): das ZIMMER ergibt sich aus dem
        room_type_id der Buchung (Room-Type-Map, local_unit_ref = property_id) —
        ein limit-1 über die Property-Map träfe sonst irgendein Geschwister-
        Zimmer (Double-Buchung landet im Twin). Fallback: 1:1-Property-Map
        (Ferienobjekt/Buchung ohne rooms-Payload)."""
        room_types = sorted({
            str(r.get("room_type_id"))
            for r in (rooms or [])
            if isinstance(r, dict) and r.get("room_type_id")
        })
        if len(room_types) > 1:
            # Mehr-Zimmer-Buchung: die Projektion kennt genau EINE Reservierung
            # je Buchung. Bewusst NICHT verwerfen (eine OTA-Buchung darf nie
            # verloren gehen — sonst blieben ALLE Zimmer offen → Überbuchung):
            # deterministisch das erste gemappte Zimmer belegen und laut warnen;
            # die übrigen Zimmer brauchen manuelle Nacharbeit (Modellgrenze,
            # Multi-Room-Split existiert noch nicht).
            log.warning(
                "booking_multiple_room_types",
                tenant_id=tenant_id, channex_property_id=channex_property_id,
                room_types=room_types,
            )
        if room_types:
            rt_rows = (
                db.table("channex_room_type_map")
                .select("channex_room_type_id, local_unit_ref")
                .eq("tenant_id", tenant_id)
                .in_("channex_room_type_id", room_types)
                .is_("deleted_at", "null")
                .execute()
            ).data or []
            by_channex_id = {
                r["channex_room_type_id"]: r.get("local_unit_ref") for r in rt_rows
            }
            # Auswahl in SORTIERTER room_type-Reihenfolge → reproduzierbar
            # (channex_room_type_id ist unique gemappt, je ID max. eine Zeile).
            for rt_id in room_types:
                if by_channex_id.get(rt_id):
                    return by_channex_id[rt_id]
        # Fallback 1:1 (Ferienobjekt / Buchung ohne rooms-Payload). Älteste aktive
        # Map = primär — seit 0158 kann eine geteilte Channex-Property MEHRERE
        # Zeilen haben; ohne Sortierung wäre limit(1) nicht deterministisch.
        pm = (
            db.table("channex_property_map")
            .select("property_id")
            .eq("tenant_id", tenant_id)
            .eq("channex_property_id", channex_property_id)
            .is_("deleted_at", "null")
            .order("created_at")
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
        unit_id: str | None = None,
    ) -> None:
        """Kalendertage setzen. `unit_id` gesetzt → nur DIESE Einheit (eine
        Buchung belegt eine Einheit, nicht den ganzen Typ); sonst gilt die
        Angabe für alle Einheiten (Sperre/Freigabe)."""
        for d in days:
            db.table("availability").upsert(
                je_einheit(db, property_id, [{
                    "property_id": property_id,
                    "date": d,
                    "status": status,
                    "source": source,
                }], unit_id=unit_id),
                on_conflict=AVAILABILITY_CONFLICT,
            ).execute()

    def _free_ota_nights(
        self,
        db: Client,
        tenant_id: str,
        property_id: str,
        channel: str,
        nights: list[str],
        unit_id: str | None = None,
    ) -> None:
        """Gibt die genannten Nächte quellengenau frei — lokal (availability
        'open') NUR wo sie WIRKLICH von DIESER OTA-Quelle belegt waren, und an
        Channex die neue Stückzahl der freien Einheiten.

        `unit_id` ist die Einheit der stornierten/geänderten Buchung und
        BEGRENZT die Freigabe auf sie. Ohne diese Grenze gibt ein Storno die
        Nacht auf ALLEN Einheiten frei — live gesehen: Buchung B wurde
        storniert und Buchung A verlor ihre Sperre, der Push meldete 2 statt 1
        freie Einheiten. Das ist eine Überbuchung mit Ansage.
        Gemeinsame Logik von Voll-Storno und Buchungs-Verkürzung/-Verschiebung:
        ein Tag, der lokal noch belegt ist (überlappende Direkt-/Fremdbelegung,
        manueller Block), darf NICHT als buchbar an Channex gemeldet werden
        (Überbuchung)."""
        for d in nights:
            query = (
                db.table("availability")
                .update({"status": "open", "source": "manual"})
                .eq("property_id", property_id)
                .eq("date", d)
                .eq("status", "booked")
                .eq("source", channel)
            )
            if unit_id:
                query = query.eq("unit_id", unit_id)
            query.execute()
        # Für den Channex-Push zählt der ECHTE Kalenderstand NACH der Freigabe —
        # nicht nur die Zeilen, die DIESE Funktion eben gedreht hat: der kanonische
        # Release-Pfad (ReservationsService._release_nights) kann Nächte desselben
        # Stornos bereits geöffnet haben; würden die hier übersprungen, blieben sie
        # bei den OTAs dauerhaft gesperrt (live passiert: Storno gab 3 Nächte
        # lokal frei, an Channex ging nur eine). Tage mit verbleibender Belegung
        # (Fremd-Quelle, manueller Block) bleiben draußen — kein Überbuchen.
        # KEIN Filter auf „noch belegte" Tage mehr: seit die Verfügbarkeit eine
        # Stückzahl ist, rechnet freie_einheiten_spannen die verbleibende
        # Belegung selbst heraus. Der alte Filter warf jeden Tag raus, an dem
        # IRGENDEINE Einheit noch belegt war — live gesehen: Storno der zweiten
        # Buchung, die erste lief weiter, und statt der frei gewordenen Einheit
        # ging weiterhin 0 an die Portale. Ein voll belegter Tag ergibt ohnehin
        # 0, ein teilweise belegter die richtige Restzahl.
        open_days = set(nights)
        # Zusammenhängende Tage als EIN Range-Push (statt N Einzeltag-Calls),
        # und je Spanne die ZAHL der freien Einheiten statt einer festen 1 —
        # ein Objekt kann mehrere identische Einheiten führen (0265). Bei genau
        # einer Einheit ist das Ergebnis dasselbe wie vorher.
        for span_start, span_end in _group_iso_days_to_ranges(open_days):
            for von, bis, frei in freie_einheiten_spannen(
                db, tenant_id, property_id,
                date.fromisoformat(span_start), date.fromisoformat(span_end),
            ):
                self.push_availability_for_property(
                    tenant_id, property_id, von, bis, frei,
                )

    def _property_currency(self, db: Client, property_id: str) -> str | None:
        """Objekt-Währung: zentrale properties.currency (0161, die Wahrheit),
        sonst der älteste Rate-Plan (Bestand ohne gesetzte Objektwährung). Beides
        sind ECHTE gespeicherte Werte — keine erfundene EUR (Wurzel 4). Dient als
        Rückfall, wenn die OTA-Payload keine currency trägt. Fehlen beide, bleibt
        es None und der Aufrufer entscheidet (kein Hardcode)."""
        prop = (
            db.table("properties")
            .select("currency")
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data or []
        obj_cur = (prop[0].get("currency") if prop else None) or None
        if obj_cur:
            return obj_cur
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

    def _insert_cancelled_reservation(
        self,
        db: Client,
        tenant_id: str,
        attrs: dict[str, Any],
        property_id: str,
    ) -> None:
        """Bestandsimport: eine bereits stornierte, uns unbekannte Buchung als
        status='cancelled' anlegen (Historie), OHNE Kalender-Block. Idempotent
        über source_channex_booking_id (Unique). Best-effort — ein Fehler kippt
        den Import nicht (Wurzel 5)."""
        booking_id = attrs.get("booking_id") or attrs.get("id")
        customer = attrs.get("customer") or {}
        guest_id = resolve_or_create_guest(
            db, tenant_id,
            contact_from_ota_customer(
                customer, external_ref=attrs.get("ota_reservation_code")
            ),
        ) or create_placeholder_guest(
            db, tenant_id, channel="ota",
            external_ref=attrs.get("ota_reservation_code"),
        )
        try:
            total = float(attrs["amount"]) if attrs.get("amount") is not None else 0
        except (TypeError, ValueError):
            total = 0
        row = {
            "tenant_id": tenant_id,
            "property_id": property_id,
            "guest_id": guest_id,
            "channel": self._ota_name_to_channel(attrs.get("ota_name")),
            "ota_name": attrs.get("ota_name"),
            "external_ref": attrs.get("ota_reservation_code"),
            "check_in": attrs.get("arrival_date"),
            "check_out": attrs.get("departure_date"),
            "status": "cancelled",
            "total_amount": total,
            "currency": attrs.get("currency")
            or self._property_currency(db, property_id),
            "source_channex_booking_id": booking_id,
            # WANN der Gast beim Portal gebucht hat (0291) — NICHT wann der
            # Feed die Buchung abgeholt hat. Bleibt leer, wenn das Portal es
            # nicht liefert; dann sagt der Posteingang „Eingang bei uns",
            # statt einen falschen Zeitpunkt zu behaupten.
            "booked_at": ota_buchungszeitpunkt(attrs),
            "guest_email": customer.get("mail") or customer.get("email"),
            "guest_phone": customer.get("phone"),
        }
        try:
            db.table("reservations").upsert(
                row, on_conflict="source_channex_booking_id"
            ).execute()
        except Exception as exc:  # noqa: BLE001 — Import darf nicht kippen
            log.warning(
                "import_cancelled_reservation_failed",
                tenant_id=tenant_id, booking_id=booking_id, error=str(exc)[:200],
            )

    def _project_booking_to_reservation(
        self,
        db: Client,
        tenant_id: str,
        attrs: dict[str, Any],
        guest_id: str | None = None,
        *,
        local_property_id: str | None = None,
    ) -> bool:
        """OTA-Buchung → zentrale reservations + Kalender-Block. Idempotent über
        source_channex_booking_id. Gibt True bei Erfolg, False bei skip zurück.

        `guest_id` stammt aus `_upsert_booking` (zentraler Resolver); ist er nicht
        gesetzt (Aufruf ohne vorheriges Staging), wird hier resolved.

        `local_property_id`: beim CSV-Bestandsimport mappt der Nutzer die Zeile
        direkt auf ein lokales Objekt — dann wird die Channex-Auflösung über
        property_id übersprungen (die CSV trägt keine channex_property_id)."""
        booking_id = attrs.get("booking_id") or attrs.get("id")
        channex_property_id = attrs.get("property_id")
        arrival = attrs.get("arrival_date")
        departure = attrs.get("departure_date")
        if not self._projection_precheck(tenant_id, booking_id, attrs):
            return False

        property_id = local_property_id or self._resolve_local_property(
            db, tenant_id, channex_property_id, rooms=attrs.get("rooms"),
        )
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
            .select(
                "id, checked_out_at, check_in, check_out, property_id,"
                " payment_collect, unit_id"
            )
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
        # Die Einheit VOR der Änderung. Muss hier gesichert werden, zusammen mit
        # den übrigen Alt-Werten: weiter unten wird die Reservierung auf die neue
        # Einheit umgeschrieben, und danach wüsste niemand mehr, welche Einheit
        # freizugeben ist (Wurzel 1 — der alte Zustand gehört mitgepflegt).
        alte_einheit = existing[0].get("unit_id") if existing else None

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
                cancel_update: dict[str, Any] = {"status": "cancelled"}
                # Von UNS abgeleitetes Portal-bezahlt zurücknehmen (Wurzel 1):
                # das Portal erstattet beim Storno im Regelfall — eine
                # stornierte Buchung darf nicht als „bezahlt" in Statistiken
                # und Gast-Ansichten weiterleben. Eigene Gateway-/Rezeptions-
                # zahlungen laufen nie über payment_collect='ota'.
                if existing[0].get("payment_collect") == "ota":
                    cancel_update["paid_amount"] = 0
                    cancel_update["payment_status"] = "unpaid"
                db.table("reservations").update(cancel_update).eq(
                    "id", existing[0]["id"]
                ).execute()
            elif local_property_id is not None:
                # Bestandsimport (CSV/Lodgify): eine bereits stornierte Buchung,
                # die wir noch nicht kennen, TROTZDEM als storniert anlegen —
                # sonst fehlte sie in Historie/Zeitleiste/Gastprofil. Ohne
                # Kalender-Block (Status cancelled) und ohne Nächte zu belegen.
                self._insert_cancelled_reservation(db, tenant_id, attrs, property_id)
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
                unit_id=alte_einheit,
            )
            # Offene externe Provision dieser Buchung entfernen (Gegenzustand,
            # Wurzel 1). Best-effort — Storno-Pfad darf nie kippen (Wurzel 5).
            if existing:
                self._cancel_commission_safe(tenant_id, existing[0]["id"])
                self._cancel_dynpricing_safe(tenant_id, existing[0]["id"])
            # Auslastung/Orphan-Lücken haben sich geändert → Dynamic Pricing
            # neu rechnen (coalesced; ohne Trigger altern die Empfehlungen
            # bis zum nächsten Tages-Cron). Best-effort wie beim Direktkanal.
            try_enqueue_recompute(db, tenant_id, free_property_id)
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
            # Regel: die projizierte Reservierung MUSS einen Gast tragen —
            # Platzhalter, falls der Resolver (kontaktlose Buchung) None gab.
            if guest_id is None:
                guest_id = create_placeholder_guest(
                    db, tenant_id, channel="ota",
                    external_ref=attrs.get("ota_reservation_code"),
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
        # Welche EINHEIT belegt diese Buchung? Bei einem Objekt mit genau einer
        # Einheit ist es die eine — Verhalten wie bisher. Führt der Typ mehrere,
        # bekommt die Buchung die erste freie; ist keine frei, hat das Portal
        # mehr verkauft als da ist. Dann wird unten der ganze Typ gesperrt statt
        # eine schon belegte Einheit ein zweites Mal zu vergeben.
        # MODIFIKATION: die eigenen, bereits gesperrten Nächte zählen nicht als
        # fremde Belegung, und die bisherige Einheit wird behalten — sonst sähe
        # die Buchung ihre eigene Sperre, verlöre die Zuweisung (unit_id=None)
        # und der ganze Typ würde fälschlich als überbucht gesperrt.
        alte_unit = None
        eigene_naechte: list[str] = []
        if (
            existing
            and old_property_id == property_id
            and existing[0].get("unit_id")
        ):
            alte_unit = str(existing[0]["unit_id"])
            if old_check_in and old_check_out:
                eigene_naechte = self._date_range_nights(
                    str(old_check_in), str(old_check_out)
                )
        einheit = freie_einheit(
            db, property_id, arrival, departure, tenant_id=tenant_id,
            eigene_unit=alte_unit, eigene_naechte=eigene_naechte,
        )
        if einheit is None:
            log.error(
                "ota_buchung_ohne_freie_einheit",
                tenant_id=tenant_id, property_id=property_id,
                arrival=arrival, departure=departure,
            )
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
            # WANN der Gast beim Portal gebucht hat (0291) — NICHT wann der
            # Feed die Buchung abgeholt hat. Bleibt leer, wenn das Portal es
            # nicht liefert; dann sagt der Posteingang „Eingang bei uns",
            # statt einen falschen Zeitpunkt zu behaupten.
            "booked_at": ota_buchungszeitpunkt(attrs),
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
            # Zahlungsweg + Portalprovision (0240). Ohne payment_collect weiß
            # niemand, ob noch Geld einzuziehen ist — die Rezeption fragt sonst
            # beim Gast nach, obwohl das Portal längst kassiert hat.
            "payment_collect": self._payment_collect(attrs),
            "payment_method_ota": self._payment_method(attrs),
            "ota_commission": self._to_float(attrs.get("ota_commission")),
            "ota_withheld_taxes": self._withheld_taxes(attrs),
            # Zugewiesene Einheit (0265) — einmal bestimmt, siehe oben.
            "unit_id": einheit,
        }
        # Portal-kassiert (payment_collect='ota' = „guest already pay at OTA")
        # als bezahlt führen — kein Portal liefert ein eigenes Bezahlt-Feld,
        # der Status MUSS abgeleitet werden (Branchenstandard). Sonst zeigt
        # der Slider „Noch offen" und die Schlussrechnung fakturiert eine
        # längst bezahlte Buchung als unbezahlt. Eine Modifikation zieht den
        # Betrag nach; wechselt der Einzug weg vom Portal (selten), wird nur
        # der von UNS abgeleitete Zustand zurückgenommen (Wurzel 1) — eigene
        # Gateway-/Rezeptionszahlungen laufen nie über payment_collect='ota'
        # und bleiben unberührt.
        # Provision/einbehaltene Steuern: „nicht geliefert" (None) ist KEINE
        # Löschung — magere Folge-Revisionen dürfen einmal gemeldete Beträge
        # nicht nullen (gleiche Regel wie payment_collect unten). Ein
        # gelieferter neuer Wert überschreibt weiterhin.
        if existing:
            for betragsfeld in ("ota_commission", "ota_withheld_taxes"):
                if row.get(betragsfeld) is None:
                    row.pop(betragsfeld, None)
        old_collect = existing[0].get("payment_collect") if existing else None
        if row["payment_collect"] == "ota":
            row["paid_amount"] = total_amount
            row["payment_status"] = "paid"
        elif old_collect == "ota":
            if row["payment_collect"] == "property":
                row["paid_amount"] = 0
                row["payment_status"] = "unpaid"
            else:
                # None = „nicht geliefert" ist KEIN Wechsel: das einmal
                # erkannte Portal-kassiert nicht auf Verdacht zurückdrehen
                # (Booking.com lässt das Feld in Folge-Revisionen oft leer).
                # Weiterhin portal-kassiert heißt auch: eine Preisänderung
                # in dieser Revision zieht den bezahlten Betrag nach.
                row.pop("payment_collect", None)
                row["paid_amount"] = total_amount
                row["payment_status"] = "paid"
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
                    "paid_amount",
                    "payment_status",
                    "ota_commission",
                    "ota_withheld_taxes",
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
        # Welche EINHEIT belegt diese Buchung? Bei einem Objekt mit genau einer
        # Einheit ist das die eine — Verhalten wie bisher. Führt der Typ mehrere,
        # bekommt die Buchung die erste freie; ist keine frei, hat das Portal
        # mehr verkauft als da ist. Dann wird der Zeitraum für den GANZEN Typ
        # gesperrt (unit_id=None) und der Fall geloggt: lieber alles zu als eine
        # stille Doppelbelegung auf einer schon belegten Einheit.
        # Kalender: belegte Nächte sperren (Buchung ist autoritativ für 'booked').
        self._set_availability(
            db,
            property_id,
            new_nights,
            status="booked",
            source=channel,
            unit_id=einheit,
        )
        # Realtime an Channex: die belegten Tage neu melden. Bei einem Objekt mit
        # EINER Einheit ist das die bisherige 0; führt der Typ mehrere identische
        # Einheiten (0265), bleiben die übrigen verkäuflich — sonst nähme eine
        # einzige Buchung dem ganzen Typ die Verfügbarkeit.
        for von, bis, frei in freie_einheiten_spannen(
            db, tenant_id, property_id,
            date.fromisoformat(arrival),
            date.fromisoformat(departure) - timedelta(days=1),
        ):
            self.push_availability_for_property(tenant_id, property_id, von, bis, frei)
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
                    db, tenant_id, old_property_id, channel, old_nights,
                    unit_id=alte_einheit,
                )
            else:
                # Gleiches Objekt: nur die aus dem alten Zeitraum herausfallenden
                # Tage (Verkürzung/Verschiebung) freigeben.
                freed_nights = [d for d in old_nights if d not in set(new_nights)]
                if freed_nights:
                    self._free_ota_nights(
                        db, tenant_id, property_id, channel, freed_nights,
                        unit_id=alte_einheit,
                    )
        # Externe Provision (1 %/0,5 %) für diese OTA-Buchung erfassen. Best-effort
        # — der Buchungs-Import darf nie an der Provision scheitern (Wurzel 5).
        # Idempotent über reservation_id (Wurzel 2), Satz aus der Objektzahl.
        if reservation_id:
            self._record_commission_safe(
                db, tenant_id, reservation_id, channel, total_amount, row["currency"]
            )
            # Dynamische Preise 0,5 %: gilt kanalunabhängig für JEDE Buchung des
            # Objekts (anders als die Provision, die nur externe Kanäle trifft) —
            # die Engine hat den Preis gesetzt, egal wo verkauft wurde.
            self._record_dynpricing_safe(
                db, tenant_id, reservation_id, total_amount, row["currency"]
            )
        # Neue/geänderte OTA-Buchung ändert Auslastung + Orphan-Lücken →
        # Dynamic Pricing neu rechnen (coalesced je Objekt, best-effort) —
        # derselbe Trigger, den Direktbuchungen längst haben (reservations/
        # _base). Beim Objektwechsel auch das ALTE Objekt (Wurzel 1).
        try_enqueue_recompute(db, tenant_id, property_id)
        if existing and old_property_id and old_property_id != property_id:
            try_enqueue_recompute(db, tenant_id, old_property_id)
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

    def _record_dynpricing_safe(
        self,
        db: Client,
        tenant_id: str,
        reservation_id: str,
        gross_amount: float,
        currency: str | None,
    ) -> None:
        """0,5 %-Nutzung melden, ohne den Import-Pfad zu gefährden (Wurzel 5).
        Ohne gebuchtes Modul passiert im Service nichts."""
        try:
            from src.features.subscriptions.service import SubscriptionsService

            SubscriptionsService(service_client=db).record_dynpricing_usage(
                tenant_id,
                reservation_id=reservation_id,
                gross_amount=gross_amount,
                currency=currency or "",
            )
        except Exception:  # noqa: BLE001 — best-effort, kein Kippen des Imports
            log.warning(
                "dynpricing_record_failed",
                tenant_id=tenant_id,
                reservation_id=reservation_id,
            )

    def _cancel_dynpricing_safe(self, tenant_id: str, reservation_id: str) -> None:
        """Gemeldete 0,5 %-Nutzung bei Storno zurücknehmen (Gegenzustand)."""
        try:
            from src.features.subscriptions.service import SubscriptionsService

            SubscriptionsService(service_client=self._db).cancel_dynpricing_usage(
                tenant_id, reservation_id=reservation_id
            )
        except Exception:  # noqa: BLE001 — best-effort, kein Kippen des Stornos
            log.warning(
                "dynpricing_cancel_failed",
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

    @classmethod
    def _payment_collect(cls, attrs: dict[str, Any]) -> str | None:
        """Wer zieht ein? Nur die dokumentierten Werte übernehmen.

        Ein unbekannter Wert wird zu None statt zu einem Constraint-Fehler:
        der Aggregator kann die Liste erweitern, und ein neuer Wert darf den
        Buchungsimport nicht kippen (Wurzel 5). None heißt „nicht geliefert" —
        ausdrücklich NICHT „wir kassieren".

        Booking.com lässt das Feld auch bei „Payments by Booking.com" oft
        leer; das verlässliche Signal ist dann die virtuelle Kreditkarte
        (guarantee.is_virtual) — eine VCC stellt das Portal nur aus, wenn es
        das Geld des Gastes bereits eingezogen hat.

        Airbnb kassiert IMMER selbst (es gibt strukturell keinen
        Vor-Ort-Zahlweg), meldet aber weder payment_collect noch eine VCC —
        die Zahlungsdaten stehen dort nur als Freitext in notes. Deshalb
        ist der Kanal selbst das Signal (Kanal-Regel, kein geratener
        Fallback; so führen es auch die etablierten PMS).
        """
        wert = (attrs.get("payment_collect") or "").strip().lower()
        if wert in ("property", "ota"):
            return wert
        guarantee = attrs.get("guarantee")
        if isinstance(guarantee, dict) and guarantee.get("is_virtual") is True:
            return "ota"
        if cls._ota_name_to_channel(attrs.get("ota_name")) == "airbnb":
            return "ota"
        return None

    @staticmethod
    def _payment_method(attrs: dict[str, Any]) -> str | None:
        """Zahlungsart laut Portal; unbekannte Werte → None (siehe oben)."""
        wert = (attrs.get("payment_type") or "").strip().lower()
        return wert if wert in ("credit_card", "bank_transfer") else None

    def _withheld_taxes(self, attrs: dict[str, Any]) -> float | None:
        """Vom Portal einbehaltene Steuern (collected_taxes, nur Booking.com).

        Booking behält z. B. City Tax direkt ein und meldet sie je Zimmer als
        `collected_taxes` — sie mindern die Auszahlung zusätzlich zur
        Provision. Summe über alle Zimmer; None = nicht geliefert (0270,
        ausdrücklich NICHT „0 einbehalten")."""
        summe = 0.0
        gefunden = False
        for room in attrs.get("rooms") or []:
            if not isinstance(room, dict):
                continue
            for tax in room.get("collected_taxes") or []:
                if not isinstance(tax, dict):
                    continue
                betrag = self._to_float(tax.get("total_price"))
                if betrag is None:
                    continue
                gefunden = True
                summe += betrag
        if not gefunden:
            return None
        if summe < 0:
            # OTA-kontrollierter Input darf den Import nicht kippen (DB-Check
            # verlangt >= 0) — eine negative Gesamtsumme ist ein Datenfehler
            # des Portals: melden und als „nicht geliefert" behandeln, nie
            # einen plausiblen Ersatzwert erfinden.
            log.warning("ota_withheld_taxes_negativ", summe=summe)
            return None
        return summe

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
        arrival_from: str | None = None,
    ) -> dict[str, int]:
        """EINMALIGER Initial-/Recovery-Import via GET /bookings (paginiert).
        Pro Buchung: Staging (_upsert_booking) + Projektion in reservations.
        KEIN ack (das macht nur der Feed). Pro Buchung isoliert (eine kaputte
        blockiert den Rest nicht). ``arrival_from`` grenzt auf Anreisedatum ab
        (Bestandsimport „alle künftigen Buchungen ab heute")."""
        result = {"fetched": 0, "saved": 0, "skipped": 0}
        if not self._channex.is_configured or self._db is None:
            return result
        db = self._db
        page = 1
        while page <= 200:  # Sicherung gegen Endlosschleife
            resp = self._channex.list_bookings_for_property(
                channex_property_id,
                page=page,
                limit=100,
                inserted_after=inserted_after,
                arrival_from=arrival_from,
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
        property_id: str | None = None,
        days_ahead: int = 365,
        today: date | None = None,
    ) -> dict[str, int]:
        """Preise + Verfügbarkeit aus Channex importieren. availability 0/stop_sell
        → blocked, >0 → open (NIE 'booked' überschreiben). rate → price_overrides;
        stop_sell → stop_sell-Tabelle. Gechunkt (90 Tage). Mapping über die
        channex_*_map-Tabellen; unbekannte UUIDs werden übersprungen.

        Geteilte Channex-Property (Hotel, 0158): jedes Zimmer wird GETRENNT
        importiert — Verfügbarkeit nur aus dem EIGENEN Room-Type, Stop-Sell nur
        aus den EIGENEN Rate-Plans. Ein Aggregat über alle Room-Types wäre bei
        Geschwister-Zimmern falsch (Twin-Wert überschriebe den Double-Kalender).

        `property_id` grenzt den Lauf auf GENAU EIN Zimmer ein. Der Job wird je
        Zimmer eingereiht, weil ein Lauf über ein ganzes Hotel mehr Anfragen
        braucht (gemessen: 3 Zimmer = 30 Calls), als das Property-Budget je
        Minute hergibt (20) — der Import brach dann jedes Mal beim selben Stand
        ab und begann von vorn: er wurde NIE fertig (live: Jobs vom 30.07. liefen
        am 01.08. noch im Kreis)."""
        result = {"prices": 0, "availability": 0, "stop_sell": 0}
        if not self._channex.is_configured or self._db is None:
            return result
        db = self._db
        abfrage = (
            db.table("channex_property_map")
            .select("id, property_id")
            .eq("tenant_id", tenant_id)
            .eq("channex_property_id", channex_property_id)
            .is_("deleted_at", "null")
        )
        if property_id:
            abfrage = abfrage.eq("property_id", property_id)
        pms = (abfrage.order("created_at").execute()).data or []
        for pm in pms:
            rt_rows = (
                db.table("channex_room_type_map")
                .select("id, channex_room_type_id")
                .eq("tenant_id", tenant_id)
                .eq("property_map_id", pm["id"])
                .is_("deleted_at", "null")
                .execute()
            ).data or []
            rt_filter = {
                r["channex_room_type_id"] for r in rt_rows
                if r.get("channex_room_type_id")
            }
            rp_filter: set[str] = set()
            if rt_rows:
                rp_filter = {
                    r["channex_rate_plan_id"]
                    for r in (
                        db.table("channex_rate_plan_map")
                        .select("channex_rate_plan_id")
                        .eq("tenant_id", tenant_id)
                        .in_("room_type_map_id", [r["id"] for r in rt_rows])
                        .is_("deleted_at", "null")
                        .execute()
                    ).data or []
                    if r.get("channex_rate_plan_id")
                }
            part = self._import_ari_single(
                db, tenant_id, channex_property_id, pm["property_id"],
                rt_filter, rp_filter, days_ahead=days_ahead, today=today,
            )
            for key in result:
                result[key] += part[key]
        log.info("import_ari_done", tenant_id=tenant_id, **result)
        return result

    def _import_ari_single(
        self,
        db: Client,
        tenant_id: str,
        channex_property_id: str,
        property_id: str,
        rt_filter: set[str],
        rp_filter: set[str],
        *,
        days_ahead: int,
        today: date | None,
    ) -> dict[str, int]:
        """ARI-Import für EIN lokales Zimmer/Objekt einer (ggf. geteilten)
        Channex-Property. rt_filter/rp_filter = die Channex-IDs DIESES Objekts;
        fremde Room-Types/Rate-Plans der Geschwister werden übersprungen."""
        result = {"prices": 0, "availability": 0, "stop_sell": 0}

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
            # MEHRERE EINHEITEN: Der Portal-Wert ist eine Stückzahl für den
            # ganzen Typ („3 von 5 frei") und lässt sich keiner EINZELNEN
            # Einheit zuordnen. Ihn trotzdem zu spiegeln, machte aus einer
            # 0 des Portals eine Sperre auf ALLEN Einheiten — live gesehen:
            # eine Buchung sperrte prompt auch die freie zweite Einheit, und
            # der nächste Push meldete 0 statt 1. Bei mehr als einer Einheit
            # führen wir die Belegung deshalb ausschließlich selbst (das deckt
            # sich mit der Vorgabe des Aggregators, ARI nicht zyklisch
            # zurückzulesen); die Preise/Restriktionen weiter unten bleiben
            # davon unberührt.
            if einheiten_zahl(db, tenant_id, property_id) > 1:
                log.info(
                    "ari_import_availability_uebersprungen_mehrere_einheiten",
                    tenant_id=tenant_id, property_id=property_id,
                )
                avail = {"data": {}}
            by_date: dict[str, int] = {}
            for room_type, days in (avail.get("data") or {}).items():
                # Nur der EIGENE Room-Type dieses Zimmers zählt — Geschwister-
                # Room-Types derselben Channex-Property gehören anderen Objekten.
                if rt_filter and room_type not in rt_filter:
                    continue
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
                    je_einheit(db, property_id, [{
                        "property_id": property_id,
                        "date": d,
                        "status": new_status,
                        "source": "portal",
                    }]),
                    on_conflict=AVAILABILITY_CONFLICT,
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
                for rate_plan, days in (restr.get("data") or {}).items()
                # Nur die EIGENEN Rate-Plans dieses Zimmers (geteilte Property).
                if not rp_filter or rate_plan in rp_filter
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
                # Nur die OBJEKT-Ebene zählt als „schon gestoppt" — ein plan-
                # genauer Hotel-Stopp (rate_plan_id gesetzt, 0152) darf den
                # objekt-weiten Portal-Import nicht unterdrücken.
                existing_stops = {
                    r["date"]
                    for r in (
                        db.table("stop_sell")
                        .select("date")
                        .eq("property_id", property_id)
                        .is_("rate_plan_id", "null")
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
                        on_conflict="property_id,date,rate_plan_id",
                    ).execute()
                    result["stop_sell"] += 1
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
        pms = (
            db.table("channex_property_map")
            .select("id, property_id, created_at")
            .eq("tenant_id", tenant_id)
            .eq("channex_property_id", channex_property_id)
            .is_("deleted_at", "null")
            .order("created_at")
            .execute()
        ).data or []
        if not pms:
            return result
        # Geteilte Channex-Property (0158): mehrere lokale Zimmer teilen sich die
        # channex_property_id. Ein unbekannter Room-Type lässt sich dann keinem
        # Zimmer zuordnen — nichts raten (Wurzel 4), bestehende Maps NIE umhängen
        # (Wurzel 1: genau dieser Upsert hat eine Double-Map aufs Twin-Zimmer
        # gedreht, wonach ARI-Pushes das Zimmer still übersprangen).
        shared = len(pms) > 1
        property_map_id = pms[0]["id"]
        property_id = pms[0]["property_id"]

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
            existing_rt = (
                db.table("channex_room_type_map")
                .select("id")
                .eq("tenant_id", tenant_id)
                .eq("channex_room_type_id", cx_rt_id)
                .is_("deleted_at", "null")
                .limit(1)
                .execute()
            ).data
            if existing_rt:
                result["room_types"] += 1
                continue
            if shared:
                log.warning(
                    "import_room_type_unmapped_shared",
                    channex_room_type_id=cx_rt_id, title=attrs.get("title"),
                )
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
                .select("id, local_unit_ref")
                .eq("tenant_id", tenant_id)
                .eq("channex_room_type_id", cx_rt_id)
                .is_("deleted_at", "null")
                .limit(1)
                .execute()
            ).data
            if not rt_map:
                log.warning("import_rate_plan_no_room_type", channex_rate_plan_id=cx_rp_id)
                continue
            # Bereits gemappt? Dann NICHTS anfassen — der Upsert würde die Map
            # sonst auf die aktuelle rt_map-Zeile umhängen (Gegenstück zum
            # Room-Type-Schutz oben).
            existing_map = (
                db.table("channex_rate_plan_map")
                .select("id, local_rate_plan_id")
                .eq("tenant_id", tenant_id)
                .eq("channex_rate_plan_id", cx_rp_id)
                .is_("deleted_at", "null")
                .limit(1)
                .execute()
            ).data
            if existing_map:
                result["rate_plans"] += 1
                continue
            # Neuer lokaler Rate-Plan gehört zum Zimmer des Room-Type-Mappings,
            # nicht zur ersten Map-Zeile der (ggf. geteilten) Channex-Property.
            plan_property_id = rt_map[0].get("local_unit_ref") or property_id
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
                        "property_id": plan_property_id,
                        "name": attrs.get("title") or "Rate",
                        "base_price": base_price,
                        # Währung aus dem Channex-Rate-Plan; fehlt sie, aus
                        # einem vorhandenen Objekt-Rate-Plan — nie EUR raten.
                        "currency": (
                            attrs.get("currency")
                            or self._property_currency(db, plan_property_id)
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
