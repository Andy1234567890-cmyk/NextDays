"""Inbound: Booking-Feed, Staging, Reservierungs-Projektion, Importe.

Mixin des ChannelManagerService (verbatim aus service.py extrahiert;
siehe service.py-Fassade). State (_db/_channex) und Basis-Helper kommen
von der Fassade; Patch-Ziel für Modul-Helfer ist channel_manager.common.
"""
from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Any

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


    # -- Bookings: Feed-Pull + Ack --------------------------------------------
    def sync_bookings(self, ctx: AuthContext) -> BookingSyncResponse:
        tenant_id = self._require_tenant(ctx)
        db = self._require_db()
        result = BookingSyncResponse()

        # KRITISCH (Mandantentrennung): Der Revisions-Feed ist KONTOWEIT — er
        # enthält die Buchungen ALLER Tenants. Wir dürfen ausschließlich
        # Revisionen verarbeiten, deren property_id zu DIESEM Tenant gehört.
        # Fremde Revisionen werden übersprungen und NICHT ge-ackt (damit der
        # zuständige Tenant sie noch aus dem Feed bekommt).
        own_property_ids = self._tenant_channex_property_ids(db, tenant_id)

        try:
            feed = self._channex.get_booking_revisions_feed()
        except ChannexError as exc:
            raise self._wrap_channex(exc) from exc

        revisions = feed.get("data") or []
        result.fetched = len(revisions)

        # Fehler lokal sammeln und am Ende einmalig zuweisen — Pylint erkennt
        # das Pydantic-Field sonst statisch als FieldInfo (ohne .append).
        errors: list[str] = []
        for rev in revisions:
            attrs = rev.get("attributes") or rev
            revision_id = rev.get("id") or attrs.get("revision_id")
            rev_property_id = attrs.get("property_id")

            # Gehört diese Revision diesem Tenant? Sonst überspringen (kein ack!).
            if rev_property_id not in own_property_ids:
                result.skipped += 1
                continue

            try:
                guest_id = self._upsert_booking(db, tenant_id, attrs, revision_id)
                # In die zentrale reservations-Tabelle + Kalender projizieren.
                self._project_booking_to_reservation(db, tenant_id, attrs, guest_id)
                result.saved += 1
                if revision_id:
                    self._channex.ack_booking_revision(revision_id)
                    result.acknowledged += 1
            except (ChannexError, ChannelManagerError) as exc:
                msg = getattr(exc, "message", str(exc))
                errors.append(f"Revision {revision_id}: {msg}")
                log.error("channex_booking_sync_failed", revision=revision_id, error=msg)

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
        if not (booking_id and channex_property_id and arrival and departure):
            log.warning(
                "reservation_skip_incomplete",
                tenant_id=tenant_id,
                booking_id=booking_id,
            )
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
            .select("id, checked_out_at")
            .eq("tenant_id", tenant_id)
            .eq("source_channex_booking_id", booking_id)
            .limit(1)
            .execute()
        ).data
        # Nach echtem Check-out (0091) ist der Aufenthalt abgeschlossen — ein
        # OTA-Resync darf status='completed' nicht mehr überschreiben (weder
        # auf confirmed zurückdrehen noch nachträglich stornieren + freigeben).
        already_checked_out = bool(existing and existing[0].get("checked_out_at"))

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
            freed: list[str] = []
            for d in self._date_range_nights(arrival, departure):
                # nur freigeben, wenn der Tag von DIESER OTA-Quelle belegt war
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
            # Freigabe an Channex NUR für die Tage, die lokal WIRKLICH frei wurden
            # (availability=1). Der gesamte Zeitraum arrival..departure darf NICHT
            # pauschal auf 1 gesetzt werden: bleibt eine Nacht lokal belegt (z. B.
            # manueller Block oder eine überlappende Direkt-/Fremdkanal-Belegung,
            # die der quellengefilterte Update nicht freigab), würde Channex sie
            # sonst als wieder buchbar melden → Überbuchung.
            for d in freed:
                day = date.fromisoformat(d)
                self.push_availability_for_property(
                    tenant_id, property_id, day, day, 1
                )
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
        else:
            db.table("reservations").insert(row).execute()

        if already_checked_out:
            # Auch Kalender/Channex nicht mehr anfassen: die OTA-Revision kann
            # einen ANDEREN Zeitraum liefern als der eingefrorene Aufenthalt —
            # ihre Nächte zu sperren erzeugte verwaiste Blockierungen.
            return True

        # Kalender: belegte Nächte sperren (Buchung ist autoritativ für 'booked').
        self._set_availability(
            db,
            property_id,
            self._date_range_nights(arrival, departure),
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
        return True

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

        start = today or datetime.now(UTC).date()
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
                cur = existing_days.get(d)
                # 'booked'-Tage (echte Buchung) NICHT überschreiben.
                if cur and cur["status"] == "booked":
                    continue
                new_status = "open" if qty > 0 else "blocked"
                # Idempotent: identischer Status + Quelle → nichts schreiben.
                if cur and cur["status"] == new_status and cur.get("source") == "portal":
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
