"""Reservations-Service: Schreibpfad (Anlegen, Verschieben, Storno, Check-in/out).

Mixin auf `ReservationsBase`; `service.py` komponiert es in `ReservationsService`.
Jede Belegung/Freigabe pflegt den Kalender-Gegenzustand (Wurzel 1) und pusht die
Verfügbarkeit an Channex/OTAs; das Anlegen läuft atomar über die RPC (Wurzel 2).
"""
from __future__ import annotations

from datetime import UTC, datetime

from postgrest.exceptions import APIError

from src.core.security import AuthContext

from ._base import (
    ReservationError,
    ReservationsBase,
    _as_date,
    _map_booking_conflict,
    _nights,
    _require_uuid,
    load_guest_mask,
    log,
)
from .schemas import (
    CheckOutRequest,
    CheckOutResponse,
    ReservationCreate,
    ReservationMove,
    ReservationResponse,
)


class WritesMixin(ReservationsBase):
    """Schreib-Endpunkte des reservations-Slice."""

    def create(self, ctx: AuthContext, req: ReservationCreate) -> ReservationResponse:
        tenant_id = self._require_tenant(ctx)

        # 1) Property gehört dem Tenant? (sonst fremde Belegung möglich)
        prop = (
            self._db()
            .table("properties")
            .select("id")
            .eq("id", req.property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if not prop.data:
            raise ReservationError("Objekt nicht gefunden.", status_code=404)

        # 2) Double-Booking-Schutz: kein Tag darf booked/blocked sein.
        nights = _nights(req.check_in, req.check_out)
        avail = (
            self._db()
            .table("availability")
            .select("date,status")
            .eq("property_id", req.property_id)
            .gte("date", req.check_in.isoformat())
            .lt("date", req.check_out.isoformat())
            .execute()
        )
        taken = [r["date"] for r in (avail.data or []) if r["status"] != "open"]
        if taken:
            raise ReservationError(
                "Zeitraum enthält bereits belegte/gesperrte Tage.", status_code=409
            )
        # Stop-Sell-Schutz: ein von Mitarbeitern gesetzter Stop-Sell sperrt den
        # Tag auf ALLEN Kanälen — auch die interne Rezeptions-Buchung. Der Stopp
        # muss erst aufgehoben werden, bevor hier gebucht werden kann.
        stopped = (
            self._db()
            .table("stop_sell")
            .select("date")
            .eq("property_id", req.property_id)
            .gte("date", req.check_in.isoformat())
            .lt("date", req.check_out.isoformat())
            .execute()
        ).data or []
        if stopped:
            raise ReservationError(
                "Zeitraum enthält Stop-Sell-Tage. Bitte zuerst den Stop-Sell "
                "aufheben.", status_code=409
            )

        # 3) Gast anlegen (oder bestehenden per E-Mail wiederverwenden).
        guest_id = self._upsert_guest(tenant_id, req)

        # 4) Preis aus dem zentralen Resolver (eine Preis-Wahrheit). Wird KEIN
        #    Betrag übergeben (total_amount=0), berechnet der Quote die Summe +
        #    Aufschlüsselung automatisch aus Basispreis/Saison/Aufschlägen — ein
        #    manuell gesetzter Betrag (>0) gewinnt weiterhin (Überschreibung).
        total_guests = (
            req.guests.adults + req.guests.children + req.guests.infants
        )
        quote = self._quote(
            req.property_id, req.check_in, req.check_out, total_guests, req.channel.value
        )
        total_amount = req.total_amount if req.total_amount > 0 else quote.total
        currency = quote.currency
        quote_items = [
            # kind klassifiziert die Zeile für die spätere Rechnungserstellung
            # (Booking→Invoice: 'tax' = Abgabe 0 % USt, sonst Übernachtungssatz).
            # tax_rate = zeilen-eigener Satz-Snapshot (Gebühr mit eigener USt).
            {
                "label": line.label,
                "amount": line.amount,
                "kind": line.kind,
                "tax_rate": line.tax_rate,
            }
            for line in quote.lines
        ]
        # 5) Reservierung + Kalender-Belegung + ari_outbox ATOMAR über die RPC
        #    (Migration 0104): Advisory-Lock je Objekt + guarded Upsert schließen
        #    das TOCTOU-Fenster zwischen Check und Write; der EXCLUDE-Constraint
        #    reservations_no_local_overlap ist der DB-seitige Backstop. Die
        #    ari_outbox-Zeile (availability=0) entsteht in derselben Transaktion —
        #    der Channex-Push kann nicht mehr ersatzlos verloren gehen.
        reservation_row = {
            "tenant_id": tenant_id,
            "property_id": req.property_id,
            "guest_id": guest_id,
            "channel": req.channel.value,
            "check_in": req.check_in.isoformat(),
            "check_out": req.check_out.isoformat(),
            "status": req.status.value,
            "total_amount": total_amount,
            "quote_items": quote_items,
            "currency": currency,
            # Belegung (Gästezahl) für Balken + Detailansicht.
            "num_guests": (
                req.guests.adults
                + req.guests.children
                + req.guests.infants
            ),
            "adults": req.guests.adults,
            "children": req.guests.children,
            "infants": req.guests.infants,
            "pets": req.guests.pets,
            # Denormalisierte Kontaktdaten (für OTA-Buchungen ohne guests).
            "guest_email": req.contact.email or None,
            "guest_phone": req.contact.phone or None,
            "guest_language": req.contact.language or None,
            "guest_country": req.contact.country or None,
        }
        try:
            ins = (
                self._db()
                .rpc(
                    "create_reservation_atomic",
                    {
                        "p_reservation": reservation_row,
                        "p_source": req.channel.value,
                        "p_with_outbox": True,
                    },
                )
                .execute()
            )
        except APIError as exc:
            raise _map_booking_conflict(exc) from exc
        result = ins.data or {}
        row = result.get("reservation")
        if not row:
            raise ReservationError("Reservierung konnte nicht angelegt werden.", status_code=500)

        # Realtime: belegte Tage sofort an Channex/OTAs sperren (availability=0),
        # damit keine OTA-Doppelbuchung entsteht. Buchungskalender = Wahrheit.
        self._push_channex_availability(
            tenant_id, req.property_id, req.check_in, req.check_out, 0,
            outbox_id=result.get("outbox_id"),
        )
        # Dynamic Pricing der betroffenen Tage neu rechnen (Auslastung/Orphan).
        self._recompute_dynamic_pricing(tenant_id, req.property_id)

        # Loyalty-Aggregate des Gastes (Aufenthalte/Umsatz) neu berechnen.
        if guest_id:
            from src.features.guests.service import (  # noqa: PLC0415
                recompute_guest_aggregates,
            )

            recompute_guest_aggregates(self._db(), tenant_id, guest_id)

        log.info(
            "reservation_created",
            property_id=req.property_id,
            nights=len(nights),
            reservation_id=row["id"],
        )

        mask = load_guest_mask(self._client, ctx.user_id)
        guest_name = f"{req.contact.first_name} {req.contact.last_name}".strip()
        return ReservationResponse(
            id=row["id"],
            property_id=row["property_id"],
            guest_id=row.get("guest_id"),
            guest_name=mask.name(guest_name) or "",
            channel=row["channel"],
            check_in=row["check_in"],
            check_out=row["check_out"],
            status=row["status"],
            total_amount=mask.amount(float(row.get("total_amount") or 0)),
            currency=(row.get("currency") or "") if mask.amounts else "",
            ota_name=mask.source_value(row.get("ota_name")),
            external_ref=row.get("external_ref"),
        )

    def move(
        self, ctx: AuthContext, reservation_id: str, req: ReservationMove
    ) -> ReservationResponse:
        """Reservierung verschieben (Objekt/Zeitraum) oder resizen (Check-in/out).

        Doppelbuchungs-Schutz greift erneut: die NEUEN Nächte dürfen — außer den
        eigenen, bereits dieser Reservierung gehörenden Tagen — keinen booked/
        blocked-Tag treffen. Ablauf (kein Teil-Commit nach außen):
          1) Reservierung + Ziel-Objekt tenant-scoped prüfen.
          2) Ziel-Nächte gegen Fremdbelegung prüfen (eigene Alt-Tage ausgenommen).
          3) Alte Belegung freigeben (availability=open, Channex availability=1).
          4) Neue Nächte belegen (booked, Channex availability=0).
          5) reservations-Zeile aktualisieren.
        """
        tenant_id = self._require_tenant(ctx)
        _require_uuid(reservation_id)
        res = (
            self._db()
            .table("reservations")
            .select("*")
            .eq("id", reservation_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise ReservationError("Reservierung nicht gefunden.", status_code=404)
        current = res.data[0]
        if current.get("status") == "cancelled":
            raise ReservationError(
                "Stornierte Reservierungen lassen sich nicht verschieben.",
                status_code=409,
            )
        if current.get("checked_out_at"):
            raise ReservationError(
                "Aufenthalt ist abgeschlossen (ausgecheckt + fakturiert) — "
                "Zeitraum/Objekt lassen sich nicht mehr ändern.",
                status_code=409,
            )
        # Ein eingecheckter (physisch anwesender) Gast darf NICHT verschoben werden:
        # bei einem Objektwechsel würden die Alt-Nächte freigegeben und als
        # availability=1 an die OTAs gepusht, obwohl der Gast noch im Zimmer ist
        # (Doppelbelegungs-/Überbuchungsrisiko). Symmetrisch zu check_out(), das
        # checked_in_at ebenfalls als echten „im Haus"-Zustand behandelt.
        if current.get("checked_in_at"):
            raise ReservationError(
                "Gast ist bereits eingecheckt — der Aufenthalt lässt sich nicht "
                "mehr verschieben. Bitte zuerst auschecken.",
                status_code=409,
            )
        # Eine OTA-importierte Buchung (source_channex_booking_id gesetzt) darf
        # lokal NICHT verschoben werden: der Move hebt die Buchung beim Portal
        # (Booking/Airbnb) NICHT auf, gibt aber die Alt-Nächte lokal frei und pusht
        # availability=1 an Channex → das Portal verkauft die vom Gast dort weiter
        # gehaltenen Nächte erneut (Überbuchung). OTA-Rows sind zudem vom EXCLUDE-
        # Constraint (0104) ausgenommen, sodass der Ziel-Guard sie nicht abfängt.
        # Änderungen an OTA-Buchungen laufen ausschließlich über das Portal → Import.
        if current.get("source_channex_booking_id"):
            raise ReservationError(
                "OTA-Buchungen (Booking, Airbnb & Co.) lassen sich nicht lokal "
                "verschieben — bitte die Änderung im Portal vornehmen.",
                status_code=409,
            )

        old_property = current["property_id"]
        old_nights = {
            d.isoformat()
            for d in _nights(_as_date(current["check_in"]), _as_date(current["check_out"]))
        }
        new_nights = _nights(req.check_in, req.check_out)
        new_keys = {d.isoformat() for d in new_nights}

        # Ziel-Objekt gehört dem Tenant?
        prop = (
            self._db()
            .table("properties")
            .select("id")
            .eq("id", req.property_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if not prop.data:
            raise ReservationError("Objekt nicht gefunden.", status_code=404)

        # Double-Booking-Schutz für die Ziel-Nächte. Eigene Alt-Tage am SELBEN
        # Objekt zählen nicht als Konflikt (Resize/Verkürzen am Platz).
        avail = (
            self._db()
            .table("availability")
            .select("date,status")
            .eq("property_id", req.property_id)
            .gte("date", req.check_in.isoformat())
            .lt("date", req.check_out.isoformat())
            .execute()
        )
        same_property = req.property_id == old_property
        taken = [
            r["date"]
            for r in (avail.data or [])
            if r["status"] != "open"
            and not (same_property and r["date"] in old_nights)
        ]
        if taken:
            raise ReservationError(
                "Ziel-Zeitraum enthält bereits belegte/gesperrte Tage.",
                status_code=409,
            )
        # Stop-Sell-Schutz für die Ziel-Nächte — wie create()/create_public_booking.
        # Ein Stop-Sell-Tag kann in availability noch als 'open' geführt sein
        # (Sync-Verzug), deshalb explizit die stop_sell-Tabelle prüfen; sonst
        # landet ein Move auf gesperrten Tagen, die auf OTAs weiter verkauft werden.
        stopped = (
            self._db()
            .table("stop_sell")
            .select("date")
            .eq("property_id", req.property_id)
            .gte("date", req.check_in.isoformat())
            .lt("date", req.check_out.isoformat())
            .execute()
        ).data or []
        if stopped:
            raise ReservationError(
                "Ziel-Zeitraum enthält Stop-Sell-Tage. Bitte zuerst den "
                "Stop-Sell aufheben.", status_code=409,
            )

        # Reservierungs-Zeile ZUERST umziehen: der EXCLUDE-Constraint
        # reservations_no_local_overlap (0104) validiert den Ziel-Zeitraum
        # atomar gegen alle anderen lokalen Buchungen. Kollidiert er, schlägt
        # das UPDATE fehl (23P01 → 409), BEVOR ein Kalendertag angefasst wurde
        # — kein halber Move (alte Tage frei, aber keine neue Belegung).
        try:
            upd = (
                self._db()
                .table("reservations")
                .update(
                    {
                        "property_id": req.property_id,
                        "check_in": req.check_in.isoformat(),
                        "check_out": req.check_out.isoformat(),
                    }
                )
                .eq("id", reservation_id)
                .eq("tenant_id", tenant_id)
                .execute()
            )
        except APIError as exc:
            if exc.code == "23P01":
                raise ReservationError(
                    "Ziel-Zeitraum enthält bereits belegte/gesperrte Tage.",
                    status_code=409,
                ) from exc
            raise
        if not upd.data:
            raise ReservationError(
                "Reservierung konnte nicht verschoben werden.", status_code=500
            )

        # Alte Belegung freigeben: nur Tage, die NICHT erneut belegt werden
        # (beim Resize am Platz bleiben überlappende Tage booked). Zentrale
        # Freigabe (gefiltert gegen Fremdbelegung, lokal + Channex); der Recompute
        # läuft weiter unten gebündelt für BEIDE betroffenen Objekte.
        release = sorted(old_nights - new_keys) if same_property else sorted(old_nights)
        self._release_nights(
            tenant_id, old_property, release, reservation_id, recompute=False
        )

        # Neue Nächte belegen — aber NICHT eine parallel importierte OTA-Belegung
        # überschreiben. Der EXCLUDE-Constraint befreit OTA-Buchungen
        # (source_channex_booking_id gesetzt, Migration 0104), sodass das UPDATE
        # oben nicht fehlschlägt, wenn zwischen Vorprüfung und Write eine OTA-Nacht
        # importiert wurde. Deshalb den Ist-Zustand der Zieltage frisch lesen und
        # nur die Tage belegen, die NICHT bereits von einer fremden Quelle als
        # 'booked' geführt werden (sonst würde source auf den lokalen Kanal
        # geklobbert und die OTA-Herkunft ginge verloren).
        occupied_now = {
            r["date"]: r.get("source")
            for r in (
                self._db()
                .table("availability")
                .select("date,status,source")
                .eq("property_id", req.property_id)
                .gte("date", req.check_in.isoformat())
                .lt("date", req.check_out.isoformat())
                .eq("status", "booked")
                .execute()
            ).data or []
        }
        own_source = current.get("channel") or "direct"
        occupy_rows = [
            {
                "property_id": req.property_id,
                "date": day.isoformat(),
                "status": "booked",
                "source": own_source,
            }
            for day in new_nights
            # Tag von fremder Quelle belegt (nicht unser eigener Kanal, nicht ein
            # eigener Alt-Tag am selben Objekt) → nicht überschreiben.
            if not (
                day.isoformat() in occupied_now
                and occupied_now[day.isoformat()] not in (own_source, None)
                and not (same_property and day.isoformat() in old_nights)
            )
        ]
        if occupy_rows:
            self._db().table("availability").upsert(
                occupy_rows, on_conflict="property_id,date"
            ).execute()
        self._push_channex_availability(
            tenant_id, req.property_id, req.check_in, req.check_out, 0
        )
        # Dynamic Pricing für BEIDE betroffenen Objekte neu rechnen — ein Move
        # ändert Auslastung + Orphan-Lücken am freigegebenen Alt-Objekt UND am neu
        # belegten Ziel-Objekt genau wie eine Buchung/Storno. Ohne den Recompute
        # (den create()/cancel() bereits machen) drifteten die Tagespreise beider
        # Zeiträume bis zum nächsten 15-min-reconcile-Tick.
        self._recompute_dynamic_pricing(tenant_id, req.property_id)
        if not same_property:
            self._recompute_dynamic_pricing(tenant_id, old_property)
        log.info(
            "reservation_moved",
            reservation_id=reservation_id,
            property_id=req.property_id,
            nights=len(new_nights),
        )
        # guests(name) für die maskierte Antwort nachladen.
        full = (
            self._db()
            .table("reservations")
            .select("*, guests(name)")
            .eq("id", reservation_id)
            .limit(1)
            .execute()
        )
        mask = load_guest_mask(self._client, ctx.user_id)
        return self._row((full.data or [upd.data[0]])[0], mask)

    def cancel(
        self, ctx: AuthContext, reservation_id: str, reason: str
    ) -> ReservationResponse:
        """Reservierung stornieren — kanal-agnostisch (Direkt, eigene Plattform,
        alle Channex-OTAs). Begründung ist PFLICHT und wird dokumentiert.

        Ablauf:
          1) Reservierung tenant-scoped laden; nicht doppelt stornieren.
          2) Status=cancelled + Storno-Felder (wer/wann/warum) setzen.
          3) Belegte Nächte freigeben (availability=open) + an Channex zurück
             (availability=1), damit die Tage wieder an die OTAs gehen.
          4) Append-only Audit-Zeile (reservation_cancellation_log).

        Hinweis: Eine lokale Storno hebt eine OTA-Buchung NICHT beim Portal auf
        (das UI weist darauf hin) — wir geben nur die lokale Belegung frei.
        """
        tenant_id = self._require_tenant(ctx)
        _require_uuid(reservation_id)
        clean_reason = (reason or "").strip()
        if not clean_reason:
            raise ReservationError(
                "Eine Begründung ist für die Stornierung erforderlich.",
                status_code=422,
            )
        res = (
            self._db()
            .table("reservations")
            .select("*")
            .eq("id", reservation_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise ReservationError("Reservierung nicht gefunden.", status_code=404)
        current = res.data[0]
        if current.get("status") == "cancelled":
            raise ReservationError(
                "Reservierung ist bereits storniert.", status_code=409
            )
        if current.get("checked_out_at"):
            raise ReservationError(
                "Aufenthalt ist abgeschlossen (ausgecheckt + fakturiert) — "
                "Korrekturen laufen über die Stornorechnung in der Buchhaltung.",
                status_code=409,
            )
        # Eine OTA-importierte Buchung (source_channex_booking_id gesetzt) darf lokal
        # NICHT storniert werden: der lokale Storno gibt die Nächte frei und pusht
        # availability=1 an Channex, während der Gast beim Portal (Booking/Airbnb)
        # weiter gebucht ist → das Portal verkauft die Nächte erneut (Überbuchung).
        # OTA-Stornos laufen ausschließlich über das Portal → Import (bookings_sync
        # gibt dann quellen-/tag-genau nur die wirklich frei gewordenen Tage frei).
        if current.get("source_channex_booking_id"):
            raise ReservationError(
                "OTA-Buchungen (Booking, Airbnb & Co.) lassen sich nicht lokal "
                "stornieren — bitte die Stornierung im Portal auslösen.",
                status_code=409,
            )

        now = datetime.now(UTC).isoformat()
        upd = (
            self._db()
            .table("reservations")
            .update(
                {
                    "status": "cancelled",
                    "cancel_reason": clean_reason,
                    "cancelled_by": ctx.user_id,
                    "cancelled_at": now,
                }
            )
            .eq("id", reservation_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not upd.data:
            raise ReservationError(
                "Reservierung konnte nicht storniert werden.", status_code=500
            )

        # Belegte Nächte freigeben (nur die dieser Reservierung) — zentrale
        # Freigabe: gefiltert gegen Fremdbelegung, lokal + Channex + Recompute.
        property_id = current["property_id"]
        nights = _nights(_as_date(current["check_in"]), _as_date(current["check_out"]))
        self._release_nights(
            tenant_id, property_id, [d.isoformat() for d in nights], reservation_id
        )

        # Audit: append-only Storno-Historie (Best-Effort — Log-Fehler darf die
        # Stornierung nicht kippen).
        try:
            self._db().table("reservation_cancellation_log").insert(
                {
                    "tenant_id": tenant_id,
                    "reservation_id": reservation_id,
                    "by_user_id": ctx.user_id,
                    "reason": clean_reason,
                    "channel": current.get("channel"),
                    "ota_name": current.get("ota_name"),
                }
            ).execute()
        except Exception as exc:  # noqa: BLE001 — Audit ist best-effort
            log.warning("reservation_cancellation_log_failed", error=str(exc))

        # Loyalty-Aggregate des Gastes neu berechnen (Storno reduziert Umsatz).
        if current.get("guest_id"):
            from src.features.guests.service import (  # noqa: PLC0415
                recompute_guest_aggregates,
            )

            recompute_guest_aggregates(
                self._db(), tenant_id, str(current["guest_id"])
            )

        log.info(
            "reservation_cancelled",
            reservation_id=reservation_id,
            by_user_id=ctx.user_id,
            channel=current.get("channel"),
        )
        full = (
            self._db()
            .table("reservations")
            .select("*, guests(name)")
            .eq("id", reservation_id)
            .limit(1)
            .execute()
        )
        mask = load_guest_mask(self._client, ctx.user_id)
        return self._row((full.data or upd.data)[0], mask)

    def check_in(self, ctx: AuthContext, reservation_id: str) -> ReservationResponse:
        """Gast einchecken: checked_in_at setzen (0091).

        Nur bestätigte Buchungen; kein Doppel-Check-in. Early-Check-in (vor dem
        Anreisetag) ist erlaubt — das Frontend zeigt dafür einen Hinweis, der
        Server blockiert bewusst nicht (Rezeption entscheidet).
        """
        tenant_id = self._require_tenant(ctx)
        current = self._load_owned(tenant_id, reservation_id)
        status = current.get("status")
        if status == "cancelled":
            raise ReservationError(
                "Stornierte Buchung kann nicht eingecheckt werden.", status_code=409
            )
        if status == "pending":
            raise ReservationError(
                "Buchung ist noch nicht bestätigt — bitte zuerst bestätigen.",
                status_code=409,
            )
        if current.get("checked_in_at"):
            raise ReservationError(
                "Gast ist bereits eingecheckt.", status_code=409
            )
        if current.get("checked_out_at") or status == "completed":
            raise ReservationError(
                "Buchung ist bereits abgereist.", status_code=409
            )

        upd = (
            self._db()
            .table("reservations")
            .update({"checked_in_at": datetime.now(UTC).isoformat()})
            .eq("id", reservation_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not upd.data:
            raise ReservationError(
                "Check-in konnte nicht gespeichert werden.", status_code=500
            )
        log.info(
            "reservation_checked_in",
            reservation_id=reservation_id,
            by_user_id=ctx.user_id,
        )
        mask = load_guest_mask(self._client, ctx.user_id)
        return self._row(self._load_owned(tenant_id, reservation_id), mask)

    def check_out(
        self,
        ctx: AuthContext,
        reservation_id: str,
        req: CheckOutRequest | None = None,
    ) -> CheckOutResponse:
        """Gast auschecken — erzeugt verpflichtend die finale Rechnung.

        Reihenfolge (kein halber Zustand, Supabase kennt keine Multi-Statement-
        Transaktion): (1) Guards ohne Write, (2) Rechnung über den Booking→
        Invoice-Builder (idempotent — bestehende aktive Rechnung wird
        wiederverwendet; jeder Builder-Fehler bricht den Check-out ab),
        (3) erst DANACH checked_out_at + status='completed' setzen. Ein Retry
        nach Fehler in (3) ist sicher, weil (2) die Rechnung wiederfindet.

        Die Rechnung entsteht serverseitig als System-Nebeneffekt des Check-outs
        (Front-Desk-Aktion) — bewusst OHNE OWNER_REPORTING-Anforderung.
        """
        tenant_id = self._require_tenant(ctx)
        current = self._load_owned(tenant_id, reservation_id)
        if current.get("status") == "cancelled":
            raise ReservationError(
                "Stornierte Buchung kann nicht ausgecheckt werden.", status_code=409
            )
        if not current.get("checked_in_at"):
            raise ReservationError(
                "Gast ist noch nicht eingecheckt.", status_code=409
            )
        if current.get("checked_out_at"):
            raise ReservationError(
                "Gast ist bereits ausgecheckt.", status_code=409
            )
        # Check-out erst AM Abreisetag (oder später — z. B. vergessener
        # Check-out), nie vorher: die finale Rechnung bepreist den vollen
        # Aufenthalt. Reist der Gast früher ab, wird zuerst der Zeitraum
        # verkürzt (Buchung anpassen), dann ausgecheckt. Tagesvergleich in UTC
        # (pragmatisch; Objekt-Zeitzonen sind nicht modelliert).
        departure = _as_date(current["check_out"])
        if datetime.now(UTC).date() < departure:
            raise ReservationError(
                f"Check-out ist erst am Abreisetag "
                f"({departure.strftime('%d.%m.%Y')}) möglich. Reist der Gast "
                "früher ab, bitte zuerst den Aufenthalt verkürzen.",
                status_code=409,
            )

        # Lazy-Import über die Slice-Grenze (Muster guests/tasks-Imports).
        from src.features.buchhaltung.reservation_invoice import (  # noqa: PLC0415
            create_from_reservation,
        )
        from src.features.buchhaltung.service import (  # noqa: PLC0415
            BuchhaltungError,
        )

        payment = req or CheckOutRequest()
        try:
            invoice = create_from_reservation(
                self._db(),
                tenant_id,
                reservation_id,
                payment_method=payment.payment_method,
                card_brand=payment.card_brand,
            )
        except BuchhaltungError as exc:
            # Fehlertext 1:1 durchreichen (z. B. „Übernachtungs-Steuersatz
            # fehlt") — Check-out abgebrochen, nichts geschrieben.
            raise ReservationError(exc.message, status_code=exc.status_code) from exc

        update_fields: dict = {
            "checked_out_at": datetime.now(UTC).isoformat(),
            "status": "completed",
        }
        if payment.payment_method in ("cash", "card"):
            # Am Empfang beglichen → Buchung ist vollständig bezahlt (sonst
            # zeigte der Slider weiter „Noch offen").
            update_fields["paid_amount"] = current.get("total_amount")
        upd = (
            self._db()
            .table("reservations")
            .update(update_fields)
            .eq("id", reservation_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not upd.data:
            raise ReservationError(
                "Rechnung wurde erstellt, aber der Check-out konnte nicht "
                "gespeichert werden — bitte erneut auschecken (die Rechnung "
                "wird dabei wiederverwendet).",
                status_code=500,
            )
        log.info(
            "reservation_checked_out",
            reservation_id=reservation_id,
            by_user_id=ctx.user_id,
            invoice_id=invoice["id"],
            invoice_already_existed=invoice["already_existed"],
        )
        mask = load_guest_mask(self._client, ctx.user_id)
        return CheckOutResponse(
            reservation=self._row(self._load_owned(tenant_id, reservation_id), mask),
            invoice_id=invoice["id"],
            invoice_number=invoice.get("invoice_number"),
            invoice_already_existed=bool(invoice["already_existed"]),
        )
