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

# Sentinel: „kein by_user_id übergeben → nimm ctx.user_id". Getrennt von None,
# denn None ist ein GÜLTIGER Auslöser-Wert (Gast-Storno: kein users-Eintrag).
_ACTOR_FROM_CTX = object()


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
        # Eigentümer-Aufenthalt (0241): kostenlos, PUNKT. Ein mitgeschickter
        # Betrag wird verworfen, nicht übernommen — sonst stünde am Ende doch
        # ein Preis an einem Aufenthalt, der keiner sein darf. Der CHECK in der
        # Datenbank ist der zweite Riegel (fail-closed, Wurzel 5).
        total_amount = (
            0.0
            if req.is_owner_stay
            else (req.total_amount if req.total_amount > 0 else quote.total)
        )
        currency = quote.currency
        quote_items = [] if req.is_owner_stay else [
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
            # Eigentümer-Aufenthalt (0241): sperrt den Kalender wie jede Buchung
            # (derselbe atomare RPC-Pfad, derselbe Channex-Push), zählt aber
            # nirgends als Umsatz.
            "is_owner_stay": req.is_owner_stay,
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
        # OTA-Doppelbuchung entsteht. Buchungskalender = Wahrheit. 1 Objekt =
        # 1 buchbare Einheit → binärer 0-Push (die Einheit ist weg → gesperrt).
        # Die RPC hat die Outbox-Zeile bereits atomar geschrieben (Cron-Backstop);
        # dieser Push ist die schnelle Bahn (tag-genaues Superseding macht ihn
        # idempotent zur RPC-Zeile).
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
        self,
        ctx: AuthContext,
        reservation_id: str,
        reason: str,
        *,
        by_user_id: str | None | object = _ACTOR_FROM_CTX,
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

        `by_user_id` überschreibt, WER als Auslöser in cancelled_by/Audit/Event
        vermerkt wird (Default: der Tenant-Nutzer aus ctx). Der Gast-Storno
        (guest_bookings) übergibt hier None: ein Portal-Gast ist KEINE users-Zeile
        (cancelled_by/by_user_id sind FK auf public.users) → der Auslöser bleibt
        leer statt eine FK-Verletzung (500) auszulösen. So bleibt _release_nights
        die EINE Freigabestelle (Wurzel 1), ohne den Ablauf zu duplizieren.
        """
        actor_user_id = (
            ctx.user_id if by_user_id is _ACTOR_FROM_CTX else by_user_id
        )
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
                    "cancelled_by": actor_user_id,
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
                    "by_user_id": actor_user_id,
                    "reason": clean_reason,
                    "channel": current.get("channel"),
                    "ota_name": current.get("ota_name"),
                }
            ).execute()
        except Exception as exc:  # noqa: BLE001 — Audit ist best-effort
            log.warning("reservation_cancellation_log_failed", error=str(exc))

        # Policy-Refund (Buchungs-Kondition): den erstattbaren Anteil der bereits
        # gezahlten Beträge nach der Storno-Frist erstatten. Best-effort — ein
        # Refund-Fehler darf den bereits vollzogenen Storno NICHT zurückdrehen
        # (der Storno ist persistiert; das Refund-Problem wird geloggt und ist
        # über die Zahlungsansicht sichtbar/nachholbar). Nur für eigene Kanäle
        # (bei OTA wird hier ohnehin nicht storniert, s. Guard oben).
        try:
            from src.features.payments.service import (  # noqa: PLC0415
                PaymentsError,
                PaymentsService,
            )

            days_before = max(
                0, (_as_date(current["check_in"]) - datetime.now(UTC).date()).days
            )
            PaymentsService(service_client=self._db()).refund_for_cancellation(
                ctx,
                reservation_id=reservation_id,
                days_before_arrival=days_before,
            )
        except PaymentsError as exc:
            log.warning(
                "cancellation_refund_failed",
                reservation_id=reservation_id,
                error=exc.message,
            )
        except Exception as exc:  # noqa: BLE001 — Refund darf Storno nie kippen
            log.warning(
                "cancellation_refund_error",
                reservation_id=reservation_id,
                error=str(exc)[:200],
            )

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
            by_user_id=actor_user_id,
            channel=current.get("channel"),
        )
        # Zeitleiste (0122): „storniert" — mit Begründung (in der Zeitleiste
        # ohnehin nur tenant-intern sichtbar, RLS).
        self._log_event(
            tenant_id,
            reservation_id,
            "cancelled",
            by_user_id=actor_user_id,
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

    # --- Anfrage-Modell (Airbnb Request to Book): accept / decline -----------

    def accept_request(
        self, ctx: AuthContext, reservation_id: str
    ) -> ReservationResponse:
        """Eine Gast-Anfrage (status='requested') annehmen → 'confirmed'.

        Ablauf:
          1) Tenant-scoped laden (Wurzel 3/9 — gleicher Scope wie die Liste).
          2) Idempotenz-Guard (Wurzel 2): schon 'confirmed' → No-op-Response ohne
             zweiten Push; 'declined'/'expired'/'cancelled' → 409.
          3) Bedingtes UPDATE WHERE status='requested' (claim-Guard gegen den
             Expire-Job-Race): gewinnt genau einer, der Verlierer bekommt leeres
             upd.data → 409.
          4) VOR dem OTA-0-Push frisch prüfen, ob zwischen Anfrage und accept eine
             OTA-Nacht importiert wurde (Überbuchungsschutz) → 409 statt blind.
          5) availability=0 an Channex/OTAs (die Nacht ist jetzt verbindlich) +
             Dynamic-Pricing-Recompute + Zahlungs-Capture.
        """
        tenant_id = self._require_tenant(ctx)
        current = self._load_owned(tenant_id, reservation_id)
        status = current.get("status")
        if status == "confirmed":
            # Doppelklick/Retry: schon bestätigt → gleiche Antwort, KEIN Re-Push.
            mask = load_guest_mask(self._client, ctx.user_id)
            return self._row(current, mask)
        if status != "requested":
            raise ReservationError(
                "Nur offene Anfragen können angenommen werden.", status_code=409
            )

        now = datetime.now(UTC).isoformat()
        upd = (
            self._db()
            .table("reservations")
            .update(
                {
                    "status": "confirmed",
                    "request_decided_by": ctx.user_id,
                    "request_decided_at": now,
                }
            )
            .eq("id", reservation_id)
            .eq("tenant_id", tenant_id)
            .eq("status", "requested")  # claim-Guard gegen Expire-Job-Race
            .execute()
        )
        if not upd.data:
            # Verloren gegen Expire-Job/zweiten accept → aktuellen Stand melden.
            raise ReservationError(
                "Anfrage ist nicht mehr offen (bereits entschieden oder "
                "abgelaufen).",
                status_code=409,
            )

        property_id = current["property_id"]
        check_in = _as_date(current["check_in"])
        check_out = _as_date(current["check_out"])
        # Überbuchungsschutz: kam zwischen Anfrage und accept eine OTA-Nacht rein
        # (source_channex_booking_id-Buchung ist vom EXCLUDE-Constraint befreit),
        # nicht blind auf 0 pushen. Prüfe echte Fremdbelegung im Zeitraum.
        clash = (
            self._db()
            .table("reservations")
            .select("id")
            .eq("property_id", property_id)
            .neq("id", reservation_id)
            .not_.is_("source_channex_booking_id", "null")
            .in_("status", ["confirmed", "pending"])
            .lt("check_in", check_out.isoformat())
            .gt("check_out", check_in.isoformat())
            .limit(1)
            .execute()
        ).data
        if clash:
            raise ReservationError(
                "Zeitraum wurde zwischenzeitlich über ein Portal gebucht — "
                "die Anfrage kann nicht mehr angenommen werden.",
                status_code=409,
            )

        # Jetzt verbindlich: OTAs sperren (availability=0) + Dynamic Pricing.
        self._push_channex_availability(
            tenant_id, property_id, check_in, check_out, 0,
        )
        self._recompute_dynamic_pricing(tenant_id, property_id)

        # Zahlung: bei einer Anfrage wird VOR accept NICHT kassiert (Airbnb/Booking-
        # Modell — kein PaymentIntent für eine evtl. abgelehnte Anfrage). Erst mit
        # accept wird die Buchung zahlungspflichtig; der Gast erhält die Zahlungs-
        # aufforderung über den bestehenden Gast-Zahlpfad (create_booking_payment
        # erzeugt den Intent beim Öffnen des Checkouts). So entsteht KEIN Refund-
        # Gegenzustand bei decline/expire (Wurzel 1) — es floss nie Geld.
        self._log_event(
            tenant_id, reservation_id, "request_accepted", by_user_id=ctx.user_id,
        )
        mask = load_guest_mask(self._client, ctx.user_id)
        return self._row(self._load_owned(tenant_id, reservation_id), mask)

    def decline_request(
        self, ctx: AuthContext, reservation_id: str, reason: str | None = None
    ) -> ReservationResponse:
        """Eine Gast-Anfrage (status='requested') ablehnen → 'declined'.

        Gibt die lokal belegten Nächte frei (der EXCLUDE-Constraint befreit
        'declined' vom Overlap → der Slot ist sofort wieder buchbar). Idempotent:
        schon 'declined' → No-op; anderer Endstatus → 409.
        """
        tenant_id = self._require_tenant(ctx)
        current = self._load_owned(tenant_id, reservation_id)
        status = current.get("status")
        if status == "declined":
            mask = load_guest_mask(self._client, ctx.user_id)
            return self._row(current, mask)
        if status != "requested":
            raise ReservationError(
                "Nur offene Anfragen können abgelehnt werden.", status_code=409
            )

        clean_reason = (reason or "").strip() or None
        now = datetime.now(UTC).isoformat()
        upd = (
            self._db()
            .table("reservations")
            .update(
                {
                    "status": "declined",
                    "request_decline_reason": clean_reason,
                    "request_decided_by": ctx.user_id,
                    "request_decided_at": now,
                }
            )
            .eq("id", reservation_id)
            .eq("tenant_id", tenant_id)
            .eq("status", "requested")  # claim-Guard gegen Expire-Job-Race
            .execute()
        )
        if not upd.data:
            raise ReservationError(
                "Anfrage ist nicht mehr offen (bereits entschieden oder "
                "abgelaufen).",
                status_code=409,
            )

        # Lokale Belegung freigeben (Gegenzustand, Wurzel 1) — die EINE Freigabe-
        # stelle. Kein Channex-Push nötig: bei einer Anfrage wurde NIE ein 0-Push
        # gesendet (die OTAs sahen die Nacht durchgehend als frei).
        property_id = current["property_id"]
        nights = _nights(
            _as_date(current["check_in"]), _as_date(current["check_out"])
        )
        self._release_nights(
            tenant_id, property_id, [d.isoformat() for d in nights], reservation_id,
        )

        self._log_event(
            tenant_id, reservation_id, "request_declined", by_user_id=ctx.user_id,
            detail={"reason": clean_reason} if clean_reason else None,
        )
        mask = load_guest_mask(self._client, ctx.user_id)
        return self._row(self._load_owned(tenant_id, reservation_id), mask)

    def expire_stale_requests(self) -> int:
        """Abgelaufene Anfragen (status='requested' AND request_expires_at < now)
        über ALLE Tenants auf 'expired' setzen und die Nächte freigeben. Cron-Pfad
        (service_role, kein ctx). Gibt die Anzahl abgelaufener Anfragen zurück.

        Jede Zeile wird per bedingtem UPDATE (WHERE status='requested') geclaimt —
        gewinnt der Job den Race gegen ein gleichzeitiges accept/decline NICHT,
        überspringt er sie (leeres upd.data). Freigabe über _release_nights (die
        EINE Freigabestelle, Wurzel 1). Kein Channex-Push nötig: eine Anfrage hat
        nie availability=0 gepusht.
        """
        if self._client is None:
            return 0
        now = datetime.now(UTC).isoformat()
        due = (
            self._db()
            .table("reservations")
            .select("id, tenant_id, property_id, check_in, check_out")
            .eq("status", "requested")
            .lt("request_expires_at", now)
            .limit(500)  # harte Obergrenze je Lauf (Wurzel 8), Rest im nächsten Tick
            .execute()
        ).data or []
        expired = 0
        for r in due:
            claimed = (
                self._db()
                .table("reservations")
                .update({"status": "expired", "request_decided_at": now})
                .eq("id", r["id"])
                .eq("status", "requested")  # claim-Guard gegen accept/decline
                .execute()
            ).data
            if not claimed:
                continue  # jemand hat sie zwischenzeitlich entschieden
            nights = _nights(_as_date(r["check_in"]), _as_date(r["check_out"]))
            try:
                self._release_nights(
                    r["tenant_id"], r["property_id"],
                    [d.isoformat() for d in nights], r["id"],
                )
                self._log_event(
                    r["tenant_id"], r["id"], "request_expired", by_user_id=None,
                )
            except Exception as exc:  # noqa: BLE001 — ein Fehler stoppt den Lauf nicht
                log.warning(
                    "request_expire_release_failed",
                    reservation_id=r["id"], error=str(exc)[:200],
                )
            expired += 1
        if expired:
            log.info("requests_expired", count=expired)
        return expired
