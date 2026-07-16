"""Reservations-Service: Schreibpfad (Anlegen, Verschieben, Storno, Check-in/out).

Mixin auf `ReservationsBase`; `service.py` komponiert es in `ReservationsService`.
Jede Belegung/Freigabe pflegt den Kalender-Gegenzustand (Wurzel 1) und pusht die
Verfügbarkeit an Channex/OTAs; das Anlegen läuft atomar über die RPC (Wurzel 2).
"""
from __future__ import annotations

from datetime import UTC, datetime

from postgrest.exceptions import APIError

from src.core.sales_channels import (
    RECEPTION,
    availability_block_hits_channel,
    stop_sell_blocks_channel,
)
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

        # 1c) Rate-Plan auflösen (0151). Übergeben → serverseitig scopen (muss zum
        #     Objekt gehören — Wurzel 3, kein Vertrauen in die Anfrage). Nicht
        #     übergeben → der älteste Plan des Objekts als deterministischer Default.
        rate_plan_id = self._resolve_rate_plan(
            tenant_id, req.property_id, req.rate_plan_id
        )

        # 2) Double-Booking-Vorcheck (früher UX-Guard): binäre availability
        #    (1 Objekt = 1 Einheit). Der RPC bleibt der TOCTOU-sichere Backstop.
        nights = _nights(req.check_in, req.check_out)
        avail = (
            self._db()
            .table("availability")
            .select("date,status,source")
            .eq("property_id", req.property_id)
            .gte("date", req.check_in.isoformat())
            .lt("date", req.check_out.isoformat())
            .execute()
        )
        # Kanal-Trennung: eine availability-Sperre mit source='portal' stammt
        # aus dem Channex-Import und betrifft NUR OTAs — die Rezeption darf
        # trotzdem buchen. Echte Belegung/manuelle Sperre (booked/manual/ical)
        # blockt weiter (Überbuchungsschutz).
        taken = [
            r["date"]
            for r in (avail.data or [])
            if r["status"] != "open"
            and availability_block_hits_channel(r.get("source"), RECEPTION)
        ]
        if taken:
            raise ReservationError(
                "Zeitraum enthält bereits belegte/gesperrte Tage.",
                status_code=409,
            )
        # Stop-Sell-Schutz: ein Stop-Sell sperrt die Rezeptions-Buchung nur, wenn er
        # den Rezeptions-Kanal betrifft (scope='all' oder 'reception' im channels-
        # Set) UND die gebuchte Ebene trifft: Objekt-Stopp (rate_plan_id null)
        # sperrt immer, ein plan-genauer Hotel-Stopp nur SEINEN Plan (Twin/BAR-
        # Sperre lässt Double/B&B durch). scope/channels MITLESEN — ohne sie
        # defaultet der Kanal-Filter auf 'all' und blockt auch reine OTA-Stops.
        stopped_rows = (
            self._db()
            .table("stop_sell")
            .select("date,scope,channels,rate_plan_id")
            .eq("property_id", req.property_id)
            .gte("date", req.check_in.isoformat())
            .lt("date", req.check_out.isoformat())
            .execute()
        ).data or []
        if any(
            stop_sell_blocks_channel(r, RECEPTION)
            and r.get("rate_plan_id") in (None, rate_plan_id)
            for r in stopped_rows
        ):
            raise ReservationError(
                "Zeitraum enthält Stop-Sell-Tage. Bitte zuerst den Stop-Sell "
                "aufheben.", status_code=409
            )

        # 3) Gast anlegen (oder bestehenden per E-Mail wiederverwenden). JEDE
        #    Reservierung MUSS einen Gast tragen — Branchenstandard (Cloudbeds,
        #    Mews, RoomRaccoon, Guesty verlangen alle mind. einen Namen; ein
        #    Zimmer OHNE Gast sperrt man über den Sperrzeitraum, nicht als
        #    Reservierung). Liefert der Resolver None (kein Name/E-Mail/Telefon),
        #    ist die Buchung unvollständig → 422 statt guest-loser Reservierung.
        guest_id = self._upsert_guest(tenant_id, req)
        if guest_id is None:
            raise ReservationError(
                "Bitte einen Gast angeben (mindestens Name, E-Mail oder Telefon). "
                "Zum Sperren ohne Gast einen Sperrzeitraum anlegen.",
                status_code=422,
            )

        # 4) Preis aus dem zentralen Resolver (eine Preis-Wahrheit). Wird KEIN
        #    Betrag übergeben (total_amount=0), berechnet der Quote die Summe +
        #    Aufschlüsselung automatisch aus Basispreis/Saison/Aufschlägen — ein
        #    manuell gesetzter Betrag (>0) gewinnt weiterhin (Überschreibung).
        total_guests = (
            req.guests.adults + req.guests.children + req.guests.infants
        )
        quote = self._quote(
            req.property_id, req.check_in, req.check_out, total_guests,
            req.channel.value, rate_plan_id=rate_plan_id,
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
            # Der bepreiste Rate-Plan (0151) — Preis-Wahrheit der Buchung, damit
            # Reprice/Anzeige denselben Plan rechnen wie die Erstbepreisung.
            **({"rate_plan_id": rate_plan_id} if rate_plan_id else {}),
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

        # Realtime: belegte Tage sofort an Channex/OTAs melden, damit keine
        # OTA-Doppelbuchung entsteht. Buchungskalender = Wahrheit.
        #  - Ferienwohnung: binärer 0-Push (eine Einheit ist weg → gesperrt).
        #  - Hotel: der freie Rest-Count je Nacht der Zimmerkategorie geht an
        #    ihren Channex-Room-Type — NICHT 0 (nur EIN Zimmer ist weg). Die RPC
        #    hat die Rest-Count-Outbox-Zeilen bereits atomar geschrieben (Cron-
        #    Backstop); dieser Push ist die schnelle Bahn (tag-genaues Superseding
        #    macht ihn idempotent zur RPC-Zeile).
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
        # Zeitleiste (0122): „Buchung erstellt". detail hält Kanal + Nächte für
        # die Anzeige; Beträge bleiben draußen (der Lesepfad maskiert separat).
        self._log_event(
            tenant_id,
            str(row["id"]),
            "created",
            by_user_id=ctx.user_id,
            detail={"channel": req.channel.value, "nights": len(nights)},
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

    def _resolve_rate_plan(
        self,
        tenant_id: str,
        property_id: str,
        rate_plan_id: str | None,
    ) -> str | None:
        """Rate-Plan der Buchung bestimmen (0151).

        Übergeben → MUSS zum Objekt gehören, sonst 422 (Wurzel 3: Scope
        serverseitig, kein stiller Fallback auf einen anderen Plan — das wäre
        der falsche Preis). Nicht übergeben → der älteste Plan des Objekts als
        deterministischer Default (None, wenn das Objekt keinen Plan hat).
        """
        db = self._db()
        if rate_plan_id:
            q = (
                db.table("rate_plans")
                .select("id, properties!inner(tenant_id)")
                .eq("id", rate_plan_id)
                .eq("property_id", property_id)
                .eq("properties.tenant_id", tenant_id)
                .limit(1)
                .execute()
            ).data or []
            if not q:
                raise ReservationError(
                    "Rate-Plan gehört nicht zu diesem Objekt.", status_code=422,
                )
            return rate_plan_id
        q = (
            db.table("rate_plans")
            .select("id")
            .eq("property_id", property_id)
            .order("created_at")
            .limit(1)
            .execute()
        ).data or []
        return q[0]["id"] if q else None

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
            .select("date,status,source")
            .eq("property_id", req.property_id)
            .gte("date", req.check_in.isoformat())
            .lt("date", req.check_out.isoformat())
            .execute()
        )
        same_property = req.property_id == old_property
        # Kanal-Trennung wie in create(): eine 'portal'-Sperre (Channex-Import)
        # betrifft nur OTAs, blockt den Rezeptions-Move nicht.
        taken = [
            r["date"]
            for r in (avail.data or [])
            if r["status"] != "open"
            and availability_block_hits_channel(r.get("source"), RECEPTION)
            and not (same_property and r["date"] in old_nights)
        ]
        if taken:
            raise ReservationError(
                "Ziel-Zeitraum enthält bereits belegte/gesperrte Tage.",
                status_code=409,
            )
        # Stop-Sell-Schutz für die Ziel-Nächte — wie create(), kanal- UND plan-
        # bewusst: nur Stops, die den Rezeptions-Kanal betreffen und die Ebene
        # der Reservierung treffen (Objekt-Stopp oder DEREN Rate-Plan), blocken.
        stopped_rows = (
            self._db()
            .table("stop_sell")
            .select("date,scope,channels,rate_plan_id")
            .eq("property_id", req.property_id)
            .gte("date", req.check_in.isoformat())
            .lt("date", req.check_out.isoformat())
            .execute()
        ).data or []
        if any(
            stop_sell_blocks_channel(r, RECEPTION)
            and r.get("rate_plan_id") in (None, current.get("rate_plan_id"))
            for r in stopped_rows
        ):
            raise ReservationError(
                "Ziel-Zeitraum enthält Stop-Sell-Tage. Bitte zuerst den "
                "Stop-Sell aufheben.", status_code=409,
            )

        # Preis (protel-Modell): NUR bei ausdrücklichem Upsell (reprice=True) den
        # Preis fürs Ziel-Objekt/den neuen Zeitraum NEU berechnen. Ohne Flag bleibt
        # total_amount/quote_items UNVERÄNDERT (kostenloses Upgrade / vereinbarter
        # Preis ist bindend). Der Resolver ist die eine Preis-Wahrheit; der
        # Beherbergungs-Steuersatz erbt später bei der Rechnung das Ziel-Objekt-Land
        # (EU-27) — hier wird kein Satz gesetzt, quote_items[].tax_rate=None bleibt.
        update_fields: dict[str, object] = {
            "property_id": req.property_id,
            "check_in": req.check_in.isoformat(),
            "check_out": req.check_out.isoformat(),
        }
        if req.reprice:
            guests_total = int(current.get("num_guests") or 1)
            quote = self._quote(
                req.property_id,
                req.check_in,
                req.check_out,
                guests_total,
                current.get("channel") or "direct",
                # Denselben Plan bepreisen wie die Erstbuchung — außer beim
                # Objektwechsel: dort gehört der alte Plan nicht zum Ziel-Objekt.
                rate_plan_id=(
                    current.get("rate_plan_id")
                    if req.property_id == current.get("property_id")
                    else None
                ),
            )
            update_fields["total_amount"] = quote.total
            update_fields["quote_items"] = [
                {
                    "label": line.label,
                    "amount": line.amount,
                    "kind": line.kind,
                    "tax_rate": line.tax_rate,
                }
                for line in quote.lines
            ]

        # Reservierungs-Zeile ZUERST umziehen: der EXCLUDE-Constraint
        # reservations_no_local_overlap (0104) validiert den Ziel-Zeitraum
        # atomar gegen alle anderen lokalen Buchungen. Kollidiert er, schlägt
        # das UPDATE fehl (23P01 → 409), BEVOR ein Kalendertag angefasst wurde
        # — kein halber Move (alte Tage frei, aber keine neue Belegung).
        try:
            upd = (
                self._db()
                .table("reservations")
                .update(update_fields)
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
        # Zeitleiste (0122): „verschoben" — Objektwechsel und/oder Zeitraum. detail
        # hält Alt/Neu (Objekt-IDs + Zeitraum) für die Anzeige. Bei ausdrücklichem
        # Upsell (reprice) zusätzlich ein eigenes „Preis neu berechnet"-Event, das
        # den neuen Betrag/Währung trägt (protel-Modell nachvollziehbar).
        self._log_event(
            tenant_id,
            reservation_id,
            "moved",
            by_user_id=ctx.user_id,
            detail={
                "from_property_id": old_property,
                "to_property_id": req.property_id,
                "same_property": same_property,
                "check_in": req.check_in.isoformat(),
                "check_out": req.check_out.isoformat(),
            },
        )
        if req.reprice:
            self._log_event(
                tenant_id,
                reservation_id,
                "repriced",
                by_user_id=ctx.user_id,
                detail={
                    "total_amount": update_fields.get("total_amount"),
                    "currency": current.get("currency"),
                },
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
            tenant_id, property_id, [d.isoformat() for d in nights], reservation_id,
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
        # Zeitleiste (0122): „storniert" — mit Begründung (in der Zeitleiste
        # ohnehin nur tenant-intern sichtbar, RLS).
        self._log_event(
            tenant_id,
            reservation_id,
            "cancelled",
            by_user_id=ctx.user_id,
            detail={"reason": clean_reason, "channel": current.get("channel")},
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
        # Zeitleiste (0122): „eingecheckt".
        self._log_event(
            tenant_id, reservation_id, "checked_in", by_user_id=ctx.user_id
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
        # Zeitleiste (0122): „ausgecheckt" + erzeugte Rechnungsnummer (Beleg-Bezug).
        self._log_event(
            tenant_id,
            reservation_id,
            "checked_out",
            by_user_id=ctx.user_id,
            detail={"invoice_number": invoice.get("invoice_number")},
        )
        mask = load_guest_mask(self._client, ctx.user_id)
        return CheckOutResponse(
            reservation=self._row(self._load_owned(tenant_id, reservation_id), mask),
            invoice_id=invoice["id"],
            invoice_number=invoice.get("invoice_number"),
            invoice_already_existed=bool(invoice["already_existed"]),
        )
