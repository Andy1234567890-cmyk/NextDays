"""Reservations-Service: Schreibpfad (Anlegen, Verschieben, Storno, Check-in/out).

Mixin auf `ReservationsBase`; `service.py` komponiert es in `ReservationsService`.
Jede Belegung/Freigabe pflegt den Kalender-Gegenzustand (Wurzel 1) und pusht die
Verfügbarkeit an Channex/OTAs; das Anlegen läuft atomar über die RPC (Wurzel 2).
"""
# pylint: disable=too-many-lines  # kohärente Schreib-Domäne (Anlegen/Move/
# Storno/Check-in-out). Die vier Vorgänge teilen sich Alt-/Neu-Diff,
# Einheitenwahl und Push-Reihenfolge; ein Split trennte genau die Stellen, die
# beim Ändern zusammen gelesen werden müssen (gleiches Muster wie
# calendar/service.py und channel_manager/bookings_sync.py). Die Scope-Helfer
# liegen bereits geteilt in `_base.py`.
from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from postgrest.exceptions import APIError
from supabase import Client

from src.core.einheiten import (
    AVAILABILITY_CONFLICT,
    einheiten_ids,
    freie_einheit,
    je_einheit,
)
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
    CancelParty,
    CancelReasonCode,
    CheckOutRequest,
    CheckOutResponse,
    ReservationCreate,
    ReservationGuestUpdate,
    ReservationMove,
    ReservationNote,
    ReservationNoteCreate,
    ReservationResponse,
)

# Sentinel: „kein by_user_id übergeben → nimm ctx.user_id". Getrennt von None,
# denn None ist ein GÜLTIGER Auslöser-Wert (Gast-Storno: kein users-Eintrag).
_ACTOR_FROM_CTX = object()


def _posteingang_spiegeln(
    db: Client, tenant_id: str, reservation_id: str, *, quelle: str | None = None
) -> None:
    """Die Buchung als Konversation in den Posteingang — und die Automails planen.

    WARUM HIER: Die Nachrichten-Automatisierungen planen ausschließlich über
    Threads (`inbox.planung`), und Threads lagen bis 09/2026 nur für
    Portal-Buchungen vor. Eine Direktbuchung — im Kalender erfasst, über einen
    genehmigten Sperrantrag entstanden oder aus einer Übernahme — bekam deshalb
    NIE eine Automail. Die Regel stand in der Oberfläche und lief ins Leere.

    Der Aufruf gehört an JEDEN Schreibvorgang, nicht nur ans Anlegen: eine
    Umbuchung verschiebt den Anker (`replan` rechnet die Zeitpunkte neu) und
    eine Stornierung ist der Gegenzustand — sie setzt den Thread auf
    'cancelled', und erst dadurch räumt `_offene_stornieren` die eingeplanten
    Nachrichten ab (Wurzel 1). Ohne den Storno-Aufruf begrüßte die
    Anreise-Automail einen Gast, der abgesagt hat.

    `quelle` benennt den Pfad, aus dem die Zeile stammt (sie landet in
    `raw.source`); ohne Angabe gilt der Kalender-Schreibweg.

    Best effort mit lauter Fehlermeldung — die Buchung ist an dieser Stelle
    bereits geschrieben und darf am Posteingang nicht mehr scheitern
    (`spiegeln_best_effort`).
    """
    from src.features.inbox import thread_spiegel  # noqa: PLC0415 — Slice-Grenze

    thread_spiegel.spiegeln_best_effort(
        db,
        tenant_id,
        reservation_id,
        quelle=quelle or thread_spiegel.QUELLE_DIREKT,
    )


class WritesMixin(ReservationsBase):
    """Schreib-Endpunkte des reservations-Slice."""

    def _record_commission(
        self,
        tenant_id: str,
        reservation_id: str,
        channel: str | None,
        gross_amount: float | None,
        currency: str | None,
    ) -> None:
        """Externe OTA-Provision (0,5 %) für eine im PMS angelegte/geänderte
        Buchung erfassen — der Schwesterpfad zu
        `channel_manager.bookings_sync._record_commission_safe`, damit eine
        manuell erfasste Booking-/Airbnb-/Vrbo-Buchung dieselbe Ledger-Zeile
        bekommt wie eine importierte.

        Der Service entscheidet selbst, ob eine Zeile fällig ist (nur externe
        Kanäle, nur veröffentlichte Objekte) und ist über UNIQUE(reservation_id)
        idempotent (Wurzel 2) — hier KEINE eigene Idempotenz nachbauen. Fehlt die
        Währung, wirft er 422; das wird bewusst nicht durch einen Ersatzwert
        überdeckt (Wurzel 4), sondern hier best-effort geloggt.

        Best-effort: eine fehlgeschlagene Erfassung darf die bereits vollzogene
        Buchung NICHT zurückdrehen (Wurzel 5) — mit dem echten Fehlergrund im Log,
        sonst ist der Ausfall unsichtbar.
        """
        if self._client is None or not channel:
            return
        try:
            from src.features.subscriptions.service import (  # noqa: PLC0415
                SubscriptionsService,
            )

            SubscriptionsService(service_client=self._client).record_commission(
                tenant_id,
                reservation_id=reservation_id,
                channel=channel,
                gross_amount=float(gross_amount or 0),
                currency=currency or "",
            )
        except Exception as exc:  # noqa: BLE001 — best-effort, Buchung bleibt bestehen
            log.warning(
                "commission_record_failed",
                tenant_id=tenant_id,
                reservation_id=reservation_id,
                error=str(exc)[:200],
            )

    def _fremdbelegung_im_zeitraum(
        self,
        property_id: str,
        reservation_id: str,
        check_in: date,
        check_out: date,
    ) -> bool:
        """Liegt im Zeitraum eine PORTAL-Buchung eines anderen Vorgangs?

        Überbuchungsschutz beim Annehmen einer Anfrage: kam zwischen Anfrage und
        accept eine OTA-Nacht herein, darf die Verfügbarkeit nicht blind auf 0
        gepusht werden. OTA-Buchungen sind vom EXCLUDE-Constraint befreit
        (`source_channex_booking_id`), tauchen also nicht als lokale Kollision auf.
        """
        return bool(
            (
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
        )

    def _cancel_commission(self, tenant_id: str, reservation_id: str) -> None:
        """Storno → offene Provisionszeile entfernen (Gegenzustand, Wurzel 1) —
        sonst bliebe die Provision einer stornierten Buchung in der Monatssumme.
        Bereits fakturierte Zeilen bleiben. Best-effort wie die Erfassung."""
        if self._client is None:
            return
        try:
            from src.features.subscriptions.service import (  # noqa: PLC0415
                SubscriptionsService,
            )

            SubscriptionsService(service_client=self._client).cancel_commission(
                tenant_id, reservation_id=reservation_id
            )
        except Exception as exc:  # noqa: BLE001 — best-effort, Storno bleibt bestehen
            log.warning(
                "commission_cancel_failed",
                tenant_id=tenant_id,
                reservation_id=reservation_id,
                error=str(exc)[:200],
            )

    def _schlosscode_zurueckziehen(
        self, tenant_id: str, reservation_id: str
    ) -> None:
        """Storno/Ablehnung → Türcode zurückziehen (Gegenzustand, Wurzel 1).

        Fünftes Glied der Kette neben `_release_nights`, `_sync_task_rules`,
        `_cancel_dynpricing_usage` und `_cancel_commission`: wer eine Buchung
        beendet, muss auch den Zugang beenden, sonst kommt ein Gast ins Haus,
        der nicht mehr gebucht hat.

        BEST-EFFORT wie die Geschwister: ein Storno darf nicht scheitern, weil
        ein Schloss offline ist. Der Zustand bleibt dann `fehlgeschlagen` an
        der Zugangszeile stehen und ist dort sichtbar — das ist der
        Unterschied zu „verschluckt".

        WICHTIG: Bei Offline-Codes (igloohome algoPIN) ist ein Widerruf
        physikalisch unmöglich; der Service verbucht das als
        `nicht_widerrufbar` samt Ablaufdatum. Das ist kein Fehler dieser
        Methode, sondern die ehrliche Antwort — die Oberfläche zeigt sie an,
        statt „zurückgezogen" zu behaupten (Wurzel 5b).
        """
        if self._client is None:
            return
        try:
            from src.features.schloesser.service import (  # noqa: PLC0415
                SchloesserService,
            )

            SchloesserService(self._client).zugang_widerrufen(
                tenant_id, reservation_id
            )
        except Exception as exc:  # noqa: BLE001 — best-effort, Storno bleibt
            log.warning(
                "schlosscode_widerruf_failed",
                tenant_id=tenant_id,
                reservation_id=reservation_id,
                error=str(exc)[:200],
            )

    def _schlosscode_mitziehen(
        self, tenant_id: str, reservation_id: str
    ) -> None:
        """Verschiebung/Objektwechsel → Zugang nachziehen (Wurzel 1).

        NICHT widerrufen: die Buchung besteht weiter, nur ihr Zeitraum (oder
        ihr Objekt) hat sich geändert. `zugang_planen` ist idempotent und
        zieht den Zeitraum des bestehenden Zugangs nach.

        Bei einem OBJEKTWECHSEL sind es andere Schlösser — dann entsteht ein
        neuer Code. Guesty macht es genauso und weist ausdrücklich darauf hin,
        dass der alte Code dann nicht mehr geht; bei Offline-Schlössern läuft
        er allerdings weiter, was der Service als `nicht_widerrufbar`
        festhält. Beides ist für den Betrieb sichtbar, statt still zu bleiben.
        """
        if self._client is None:
            return
        try:
            from src.features.schloesser.service import (  # noqa: PLC0415
                SchloesserService,
            )

            SchloesserService(self._client).zugang_planen(
                tenant_id, reservation_id
            )
        except Exception as exc:  # noqa: BLE001 — best-effort, Move bleibt
            log.warning(
                "schlosscode_mitziehen_failed",
                tenant_id=tenant_id,
                reservation_id=reservation_id,
                error=str(exc)[:200],
            )

    def _nachberechnung_link_schliessen(
        self, tenant_id: str, reservation_id: str
    ) -> None:
        """Offenen Nachberechnungs-Link der Buchung schließen (0469).

        Gegenzustand (Wurzel 1) zu jeder Änderung, die den geforderten Betrag
        hinfällig macht: Move/Reprice und Storno. Der Link lautet auf einen
        Betrag, der aus dem Stand der Buchung abgeleitet wurde; danach nimmt die
        Stripe-URL Geld an, das niemand mehr schuldet.

        Ausdrücklich NICHT best-effort (anders als die Provisions-Nachpflege
        darüber): Ein fehlgeschlagenes Schließen bei Stripe lässt eine zahlbare
        URL stehen. Deshalb wird der Fehler in einen ReservationError übersetzt
        und der aufrufende Vorgang bricht ab (fail-closed, Wurzel 5) — er ist
        wiederholbar, eine falsch eingezogene Zahlung nicht.
        """
        if self._client is None:
            return
        from src.features.payments.nachberechnung import (  # noqa: PLC0415
            ziehe_link_zurueck_bei_betragsaenderung,
        )
        from src.features.payments.service import PaymentsError  # noqa: PLC0415

        try:
            ziehe_link_zurueck_bei_betragsaenderung(
                self._client, tenant_id=tenant_id, reservation_id=reservation_id
            )
        except PaymentsError as exc:
            raise ReservationError(exc.message, status_code=exc.status_code) from exc

    def _addon_zahlungslinks_abschliessen(
        self, tenant_id: str, reservation_id: str
    ) -> None:
        """Zusatzleistungs-Zahlungslinks beim Storno der Buchung abschließen (0473).

        Die Lücke, die den Fall vom 25.08.2026 verursacht hat: Für die
        NACHBERECHNUNG gab es diesen Gegenzustand seit 0469
        (`_nachberechnung_link_schliessen`), für die ZUSATZLEISTUNGEN nicht.
        Buchung 6179a5d0 wurde storniert und trug danach eine bezahlbare
        Stripe-URL über 150,00 DKK weiter — bezahlt hatte der Gast sie sogar
        schon, und das Geld lag unsichtbar im Verbundkonto.

        Nicht bezahlt → Link zu. Bezahlt → Geldeingang nachverbuchen und als
        erstattungsfällig in die Zeitleiste (nicht automatisch erstatten: eine
        Erstattung braucht einen Grund und ist eine kaufmännische Entscheidung).
        Details in `addons.zahlung.bei_buchungsstorno`.

        Wie beim Nachberechnungs-Link ausdrücklich NICHT best-effort: Scheitert
        der Abgleich, bricht das Storno ab (fail-closed, Wurzel 5). Ein Storno
        ist wiederholbar, eine zu Unrecht eingezogene Zahlung nicht.
        """
        if self._client is None:
            return
        from src.features.addons.zahlung import (  # noqa: PLC0415
            ZahlungslinkFehler,
            bei_buchungsstorno,
        )

        try:
            bei_buchungsstorno(
                self._client, tenant_id=tenant_id, reservation_id=reservation_id
            )
        except ZahlungslinkFehler as exc:
            raise ReservationError(exc.message, status_code=exc.status_code) from exc

    def _geplante_restzahlung_anpassen(
        self, reservation_id: str, *, total_amount: float, paid_amount: float
    ) -> None:
        """Geplante Restzahlung an einen neu gerechneten Buchungsbetrag angleichen.

        Best-effort: Die Buchung ist zu diesem Zeitpunkt schon verschoben und
        neu bepreist. Scheitert die Angleichung, bleibt die alte geplante Zahlung
        stehen — das ist ein sichtbarer Betrag in der Zahlungsansicht, kein
        stiller Verlust, und der Betrieb kann die Differenz per
        Nachberechnungs-Link kassieren. Den bereits vollzogenen Move dafür
        zurückzudrehen wäre der größere Schaden (Kalendertage sind schon
        umgezogen).
        """
        if self._client is None:
            return
        try:
            from src.features.payments.service import (  # noqa: PLC0415
                passe_restzahlung_an,
            )

            passe_restzahlung_an(
                self._client,
                reservation_id=reservation_id,
                total_amount=total_amount,
                paid_amount=paid_amount,
            )
        except Exception as exc:  # noqa: BLE001 — s. Docstring
            log.warning(
                "geplante_restzahlung_anpassen_fehlgeschlagen",
                reservation_id=reservation_id,
                error=str(exc)[:200],
            )

    def create(
        self,
        ctx: AuthContext,
        req: ReservationCreate,
        *,
        block_request_id: str | None = None,
    ) -> ReservationResponse:
        """Reservierung anlegen — auch der Eigentümer-Aufenthalt (0241/0353).

        `block_request_id` verknüpft die Reservierung mit dem GENEHMIGTEN
        Sperrantrag, aus dem sie entstanden ist, damit sein Widerruf genau
        diese Zeile storniert und nur ihre Nächte freigibt (Wurzel 1). Der
        Parameter steht BEWUSST nicht im HTTP-`ReservationCreate` — er darf
        nicht vom Client kommen, sonst hängte jemand seine Buchung an einen
        fremden Antrag und dessen Widerruf stornierte sie (Wurzel 3). Gleiche
        Begründung wie beim gleichnamigen Parameter in `CalendarService.block`.
        """
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
        # 1d) Vorgegebene Einheit serverseitig scopen (Wurzel 3). Die RPC prüft
        #     die Zugehörigkeit zum Objekt ebenfalls, aber ohne den Mandanten —
        #     und sie wirft dafür 22023, was der Router als 500 sähe. Hier fällt
        #     es als sauberer 422 auf, mit demselben Scope wie der Rate-Plan.
        unit_id = self._require_own_unit(tenant_id, req.property_id, req.unit_id)

        # 2) Double-Booking-Vorcheck (früher UX-Guard) je EINHEIT.
        #    Der RPC bleibt der TOCTOU-sichere Backstop.
        nights = _nights(req.check_in, req.check_out)
        avail = (
            self._db()
            .table("availability")
            .select("date,status,source,unit_id")
            .eq("property_id", req.property_id)
            .gte("date", req.check_in.isoformat())
            .lt("date", req.check_out.isoformat())
            .execute()
        )
        # Kanal-Trennung: eine availability-Sperre mit source='portal' stammt
        # aus dem Channex-Import und betrifft NUR OTAs — die Rezeption darf
        # trotzdem buchen. Echte Belegung/manuelle Sperre (booked/manual/ical)
        # blockt weiter (Überbuchungsschutz).
        #
        # Die Frage lautet seit 0265 „gibt es EINE Einheit, die im ganzen
        # Zeitraum frei ist?" — nicht „ist irgendein Tag irgendeiner Einheit
        # belegt?". `availability` trägt seit 0266 eine Zeile je (Objekt,
        # Einheit, Tag); ein Objekt mit zwei Einheiten war sonst ab der ersten
        # Buchung an der Rezeption komplett dicht, weil der Vorcheck abwies,
        # bevor die RPC (0275) die zweite, freie Einheit finden konnte.
        belegte_einheiten = {
            r.get("unit_id")
            for r in (avail.data or [])
            if r["status"] != "open"
            and availability_block_hits_channel(r.get("source"), RECEPTION)
        }
        if belegte_einheiten:
            # Ist die Einheit VORGEGEBEN, lautet die Frage nicht mehr „gibt es
            # irgendeine freie?", sondern „ist GENAU DIESE frei?". Ohne die
            # Unterscheidung ließe der Vorcheck eine Buchung auf eine belegte
            # Einheit durch, solange eine Schwestereinheit frei ist — die RPC
            # wiese sie danach ab, aber mit einem Umweg über den Advisory-Lock.
            if unit_id:
                frei = unit_id not in belegte_einheiten
            else:
                alle_einheiten = {
                    u["id"]
                    for u in (
                        self._db()
                        .table("property_units")
                        .select("id")
                        .eq("property_id", req.property_id)
                        .execute()
                    ).data
                    or []
                }
                # Ohne bekannte Einheiten (Altbestand) bleibt es beim strengen
                # Verhalten von vorher — lieber ablehnen als überbuchen
                # (Wurzel 5).
                frei = bool(alle_einheiten and alle_einheiten - belegte_einheiten)
            if not frei:
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

        # 3) WER belegt? Jede Reservierung MUSS einen Personenbezug tragen —
        #    Branchenstandard (Cloudbeds, Mews, RoomRaccoon, Guesty verlangen
        #    alle mindestens einen Namen). Es gibt genau zwei Formen davon:
        #
        #    a) Der GAST (Normalfall): angelegt oder per E-Mail/Telefon
        #       wiederverwendet. Liefert der Resolver None (kein Name, keine
        #       E-Mail, kein Telefon), ist die Buchung unvollständig → 422.
        #    b) Der EIGENTÜMER (0241 + 0353): bei einem Eigentümer-Aufenthalt
        #       ist der „Gast" der Eigentümer, und er hängt über `owner_id` an
        #       `owners` — NICHT als Gast-Freitext in `guests`. Ein Eigentümer
        #       ist kein Gast: eine Gast-Zeile für ihn verfälschte die
        #       Loyalty-Aggregate (Aufenthalte/Umsatz je Gast, siehe
        #       `recompute_guest_aggregates` weiter unten), die Gästekartei und
        #       jedes Marketing-Segment, das darauf aufsetzt. `guest_id` bleibt
        #       darum leer.
        #
        #    Was es NICHT geben darf, ist eine Reservierung ohne beides — der
        #    CHECK `reservations_owner_stay_person` (0353) ist der DB-seitige
        #    Riegel dazu (fail-closed, Wurzel 5).
        owner_id = self._require_own_owner(
            tenant_id, req.property_id, req.owner_id
        )
        # Mit Eigentümer-Bezug wird der Gast-Resolver gar nicht erst gefragt:
        # sonst legte ein mitgeschickter Kontakt (die Oberfläche füllt das
        # Formular vor) NEBEN dem Eigentümer noch eine Gast-Zeile an, und die
        # Belegung hätte zwei Personenbezüge.
        guest_id = None if owner_id else self._upsert_guest(tenant_id, req)
        if guest_id is None and owner_id is None:
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
            pets=req.guests.pets,
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
            # nirgends als Umsatz. `owner_id` (0353) trägt dazu den
            # Personenbezug — ohne ihn wüsste niemand, WER da war.
            "is_owner_stay": req.is_owner_stay,
            **({"owner_id": owner_id} if owner_id else {}),
            # WER wirklich da wohnt und WARUM (0354). Der Eigentümer ist der
            # vertragliche Bezug, die anwesende Person kann eine andere sein —
            # seine Kinder, Freunde, ein Handwerker. Ohne diese Felder zeigte
            # jeder Eigennutzungs-Balken dasselbe „Eigentümer-Aufenthalt".
            **({"stay_name": req.stay_name} if req.stay_name else {}),
            **({"stay_note": req.stay_note} if req.stay_note else {}),
            # Der Sperrantrag, aus dem diese Belegung entstanden ist (0353) —
            # der Anker, an dem der Widerruf genau sie wiederfindet (Wurzel 1).
            **(
                {"block_request_id": block_request_id}
                if block_request_id
                else {}
            ),
            # Die vorgegebene Einheit. Ohne sie wählt die RPC die erste freie
            # (0275); mit ihr prüft sie die Zugehörigkeit zum Objekt selbst und
            # belegt genau diese.
            **({"unit_id": unit_id} if unit_id else {}),
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
            # Buchungszeitpunkt. Hier ist unsere Uhr zulässigerweise der echte
            # Zeitpunkt (anders als bei einer OTA-Buchung, wo `created_at` nur
            # unsere Verarbeitung beschreibt, Wurzel 5b): dieser Pfad legt eine
            # Buchung bei UNS an — am Telefon aufgenommen, im Backoffice
            # eingetragen —, der Vorgang selbst passiert in diesem Moment. Ohne
            # die Zeile trugen 36 Direktbuchungen live gar keinen Zeitpunkt und
            # fehlten in jeder Sortierung „nach Eingang".
            "booked_at": datetime.now(UTC).isoformat(),
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
        # OTA-Doppelbuchung entsteht. Buchungskalender = Wahrheit. Gemeldet wird
        # die ZAHL der noch freien Einheiten, nicht pauschal 0: ein Objekt ist
        # seit 0265 ein Einheiten-TYP mit n ≥ 1 Einheiten, und die RPC hat die
        # Belegung dieser einen Einheit bereits geschrieben — bei n = 1 ist das
        # weiterhin genau die 0 von vorher, bei n > 1 bleiben die übrigen
        # Einheiten verkäuflich. Die RPC hat die Outbox-Zeile atomar
        # mitgeschrieben (Cron-Backstop); dieser Push ist die schnelle Bahn
        # (tag-genaues Superseding macht ihn idempotent zur RPC-Zeile).
        self._push_einheiten_stand(
            tenant_id, req.property_id, req.check_in,
            req.check_out - timedelta(days=1),
            outbox_id=result.get("outbox_id"),
        )
        # Dynamic Pricing der betroffenen Tage neu rechnen (Auslastung/Orphan).
        self._recompute_dynamic_pricing(tenant_id, req.property_id)

        # Modul „Dynamische Preise": 0,5 % des Buchungsumsatzes im Ledger
        # erfassen (Währung der Buchung). Ohne gebuchtes Modul passiert nichts
        # (Entitlement-Gate im Service). Best-effort — die Erfassung darf die
        # bereits angelegte Buchung nicht kippen (Wurzel 5).
        self._record_dynpricing_usage(
            tenant_id, str(row["id"]), total_amount, row.get("currency"),
        )

        # Externe Provision (0,5 %): eine im PMS erfasste OTA-Buchung
        # (booking/airbnb/vrbo/ota_other) ist provisionspflichtig wie eine
        # importierte — ohne diesen Aufruf blieb sie unberechnet. Derselbe
        # Betrag/dieselbe Währung wie bei Dynpricing, damit beide Ledger
        # denselben Umsatz sehen. Eigene Kanäle (direct/portal) filtert der
        # Service selbst weg.
        self._record_commission(
            tenant_id, str(row["id"]), row.get("channel"), total_amount,
            row.get("currency"),
        )

        # Planmäßige Aufgaben aus den Regeln erzeugen (0272).
        self._sync_task_rules(tenant_id, str(row["id"]))
        # Türcode vormerken — aber NUR für einen echten Verkauf. Eine offene
        # Anfrage (`requested`) bekommt keinen Zugang: sie ist noch nicht
        # entschieden, und bei igloohome sind pro Tag nur DREI PINs möglich,
        # die eine später abgelehnte Anfrage sonst mitverbraucht.
        if str(req.status.value) != "requested":
            self._schlosscode_mitziehen(tenant_id, str(row["id"]))

        # Loyalty-Aggregate des Gastes (Aufenthalte/Umsatz) neu berechnen.
        if guest_id:
            from src.features.guests.service import (  # noqa: PLC0415
                recompute_guest_aggregates,
            )

            recompute_guest_aggregates(self._db(), tenant_id, guest_id)

        # Konversation im Posteingang + Automails. Der Sperrantrag ist als
        # eigene Quelle vermerkt: der Weg dorthin ist ein anderer (ein
        # Eigentümer hat ihn ausgelöst), und wer später wissen will, warum
        # dieser Thread ohne Gast dasteht, findet die Antwort an der Zeile.
        from src.features.inbox import thread_spiegel  # noqa: PLC0415

        _posteingang_spiegeln(
            self._db(),
            tenant_id,
            str(row["id"]),
            quelle=(
                thread_spiegel.QUELLE_SPERRANTRAG
                if block_request_id
                else thread_spiegel.QUELLE_DIREKT
            ),
        )

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
        # Bei einer Eigennutzung ist der Kontakt leer (kein Gast) — dort trägt
        # `stay_name` die anwesende Person. Ohne diese Unterscheidung kam die
        # Antwort nach dem Anlegen mit leerem Namen zurück, und der Balken
        # zeigte bis zum nächsten Laden „Eigentümer-Aufenthalt".
        guest_name = (
            (req.stay_name or "").strip()
            if req.is_owner_stay
            else f"{req.contact.first_name} {req.contact.last_name}".strip()
        )
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
            # Wie in `_base._row`: ohne dieses Feld meldet die Antwort direkt
            # nach dem Anlegen einen Eigentümer-Aufenthalt als normale Buchung
            # zurück, und die Oberfläche zeichnet ihn bis zum nächsten
            # Vollreload als „Direkt".
            is_owner_stay=bool(row.get("is_owner_stay")),
            stay_note=row.get("stay_note"),
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

    def _sperrantrag_zeitraum_mitziehen(
        self,
        tenant_id: str,
        current: dict,
        check_in: date,
        check_out: date,
    ) -> None:
        """Den genehmigten Sperrantrag auf den neuen Zeitraum nachziehen.

        Ein Eigentümer-Aufenthalt entsteht seit 0353 als Reservierung mit
        `block_request_id`. Wird er im Kalender verlängert oder verschoben
        („der Eigentümer bleibt eine Woche länger"), beschreibt der Antrag
        sonst weiter den ALTEN Zeitraum: der Widerruf gäbe die falschen Nächte
        frei, die Kollisionsprüfung eines zweiten Antrags sähe den freien
        Zeitraum als belegt und den belegten als frei, und der
        EXCLUDE-Constraint schützte die neuen Tage nicht (Wurzel 1 — die
        Aktion hat einen Gegenzustand, der mitgepflegt werden muss).

        Ohne Antragsbezug (gewöhnliche Buchung, Eigennutzung ohne Antrag)
        passiert nichts — das ist der Normalfall, kein fehlender Wert.

        `block_requests` führt den Zeitraum INKLUSIV (`end_date` ist die letzte
        Nacht, `daterange(start, end, '[]')` im EXCLUDE aus 0377), der Kalender
        exklusiv. Deshalb `check_out - 1 Tag`.

        Kollidiert der neue Zeitraum mit einem anderen genehmigten Antrag,
        wirft der EXCLUDE-Constraint 23P01. Das ist ein echter fachlicher
        Konflikt und wird als 409 gemeldet — NICHT verschluckt (Wurzel 5): die
        Reservierung liegt dann bereits auf den neuen Tagen, während der Antrag
        noch die alten trägt, und genau dieser Widerspruch muss sichtbar sein
        statt still zu bleiben.
        """
        antrag_id = current.get("block_request_id")
        if not antrag_id:
            return
        try:
            self._db().table("block_requests").update(
                {
                    "start_date": check_in.isoformat(),
                    "end_date": (check_out - timedelta(days=1)).isoformat(),
                }
            ).eq("id", str(antrag_id)).eq("tenant_id", tenant_id).eq(
                # Nur ein GENEHMIGTER Antrag wird nachgezogen. Ein abgelehnter
                # oder widerrufener hat mit dieser Belegung nichts mehr zu tun.
                "status", "approved"
            ).execute()
        except APIError as exc:
            if exc.code == "23P01":
                raise ReservationError(
                    "Der neue Zeitraum überschneidet sich mit einer anderen "
                    "genehmigten Eigentümer-Sperre.",
                    status_code=409,
                ) from exc
            raise
        log.info(
            "sperrantrag_zeitraum_mitgezogen",
            block_request_id=str(antrag_id),
            check_in=check_in.isoformat(),
            check_out=check_out.isoformat(),
        )

    def _entwerte_sperrantrag(self, tenant_id: str, current: dict) -> None:
        """Den genehmigten Sperrantrag dieser Buchung auf `rejected` setzen.

        Zielzustand ist `rejected` und nicht `pending`: Das Enum aus 0014 kennt
        nur drei Zustaende, und ein Zurueck auf `pending` liesse den Antrag
        erneut in der Warteschlange auftauchen, obwohl er laengst behandelt
        wurde — dieselbe Begruendung wie in `sperrantraege.zuruecknehmen`.

        Der Filter auf `status='approved'` macht die Methode idempotent
        (Wurzel 2) UND verhindert die Rekursion: Kommt der Storno aus dem
        Widerruf selbst (`zuruecknehmen` → `_eigennutzung_stornieren` →
        `cancel`), hat der Claim den Antrag bereits auf `rejected` gesetzt, und
        dieses Update trifft nichts. Ein zweiter Storno auf dieselbe Buchung
        ebenso.

        Best-effort (Wurzel 5): die Buchung IST an dieser Stelle bereits
        storniert und die Naechte sind frei. Kippt das Update, darf das den
        Vorgang nicht zurueckdrehen — der Fehlschlag wird laut protokolliert,
        damit ein haengengebliebener Antrag auffindbar bleibt.
        """
        antrag_id = current.get("block_request_id")
        if not antrag_id:
            return
        try:
            self._db().table("block_requests").update(
                {"status": "rejected"}
            ).eq("id", str(antrag_id)).eq("tenant_id", tenant_id).eq(
                "status", "approved"
            ).execute()
        except Exception as exc:  # noqa: BLE001 — Storno steht, darf nicht kippen
            log.warning(
                "sperrantrag_entwertung_fehlgeschlagen",
                tenant_id=tenant_id,
                block_request_id=str(antrag_id),
                error=str(exc)[:200],
            )
            return
        log.info(
            "sperrantrag_mit_storno_entwertet",
            tenant_id=tenant_id,
            block_request_id=str(antrag_id),
        )

    def _alte_einheit_bestimmen(  # noqa: PLR0913 — Bestand, Ziel und Kalender
        self,
        tenant_id: str,
        current: dict,
        *,
        reservation_id: str,
        old_property: str,
        old_nights: set[str],
        new_keys: set[str],
        same_property: bool,
        avail_rows: list[dict],
    ) -> str | None:
        """Welche Einheit die Buchung BISHER haelt — oder ein sauberer 409.

        Herausgezogen am 10.09.2026 aus `move`. Die Frage entscheidet, ob der
        Alt-Tag-Filter die EIGENEN Naechte wiederfindet; faellt sie falsch aus,
        zaehlt die Buchung sich selbst als Fremdbelegung und jede Verlaengerung
        endet in „Ziel-Zeitraum enthaelt bereits belegte Tage" — eine Meldung,
        die den Betrieb im Gast-Kalender suchen laesst statt bei der fehlenden
        Einheit.
        """
        alte_unit = str(current["unit_id"]) if current.get("unit_id") else None
        if alte_unit is None:
            # Ohne Einheit findet der Alt-Tag-Filter unten die EIGENEN Nächte
            # nicht wieder (`r["unit_id"] == None` trifft nie) — die Buchung
            # zählte sich selbst als Fremdbelegung und jede Verlängerung endete
            # in „Ziel-Zeitraum enthält bereits belegte/gesperrte Tage".
            # Live am 24.08.2026 an allen 10 Website-Buchungen: `unit_id` leer,
            # die Kalenderzeilen dagegen einheiten-genau. Deshalb aus dem
            # Kalender ableiten (Wurzel 4: kein geratener Ersatzwert — bleibt
            # es mehrdeutig, kommt None und der Move scheitert präzise).
            alte_unit = self._gehaltene_einheit(
                tenant_id, old_property, sorted(old_nights), reservation_id
            )
        if (
            alte_unit is None
            and same_property
            and old_nights & new_keys
            # NUR wenn die eigenen Alt-Tage im Kalender überhaupt eine Einheit
            # nennen. Im Altbestand vor 0266 tragen die Zeilen selbst keine
            # (`unit_id is null`) — dort trifft `None == None` und der Filter
            # unten erkennt die eigenen Tage wie eh und je. Ohne diese
            # Bedingung hätte der Guard genau diesen intakten Fall gesperrt.
            and any(
                r["date"] in old_nights and r.get("unit_id")
                for r in avail_rows
            )
        ):
            # Eigene Tage im Ziel-Zeitraum, aber die eigene Einheit ist nicht
            # bestimmbar: jede Antwort wäre geraten. Fail-closed mit der
            # WAHREN Ursache statt der irreführenden Belegt-Meldung, sonst
            # sucht der Betrieb den Fehler beim Gast-Kalender (Wurzel 5).
            raise ReservationError(
                "Diese Buchung ist keiner Einheit zugeordnet — der Zeitraum "
                "lässt sich deshalb nicht ändern. Bitte die Einheit der "
                "Buchung setzen und erneut versuchen.",
                status_code=409,
            )
        return alte_unit

    def _neu_bepreisen(
        self, req: ReservationMove, current: dict
    ) -> dict:
        """Betrag, Waehrung und Positionen fuer den neuen Zeitraum/Ort.

        Herausgezogen am 10.09.2026 aus `move`: die Neuberechnung ist ein
        eigenes Thema mit eigenen Fallstricken und schreibt nur in
        `update_fields` — sie musste nicht in einer 519-Zeilen-Funktion
        stehen.
        """
        quote = self._quote(
            req.property_id,
            req.check_in,
            req.check_out,
            int(current.get("num_guests") or 1),
            current.get("channel") or "direct",
            # Denselben Plan bepreisen wie die Erstbuchung — außer beim
            # Objektwechsel: dort gehört der alte Plan nicht zum Ziel-Objekt.
            rate_plan_id=(
                current.get("rate_plan_id")
                if req.property_id == current.get("property_id")
                else None
            ),
            # Die Tierzahl gehört zur Buchung, nicht zum Zeitraum — beim
            # Neurechnen darf die Haustiergebühr nicht verschwinden.
            pets=int(current.get("pets") or 0),
        )
        return {
            "total_amount": quote.total,
            # Währung MIT umziehen: beim Objektwechsel über eine Währungsgrenze
            # (EU-27) gehört der neu gerechnete Betrag zur Währung des ZIELS.
            # Ohne diese Zeile behielte die Zeile die alte Währung und der
            # Provisions-Ledger bekäme Betrag und Währung aus zwei Welten
            # (Wurzel 4). `quote.currency` kommt aus Konfig/Rate-Plan des Ziels.
            "currency": quote.currency,
            "quote_items": [
                {
                    "label": line.label,
                    "amount": line.amount,
                    "kind": line.kind,
                    "tax_rate": line.tax_rate,
                }
                for line in quote.lines
            ],
        }

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

        # Double-Booking-Schutz für die Ziel-Nächte. Eigene Alt-Tage auf der
        # EIGENEN Einheit zählen nicht als Konflikt (Resize/Verkürzen am Platz).
        avail = (
            self._db()
            .table("availability")
            .select("date,status,source,unit_id")
            .eq("property_id", req.property_id)
            .gte("date", req.check_in.isoformat())
            .lt("date", req.check_out.isoformat())
            .execute()
        )
        same_property = req.property_id == old_property
        alte_unit = self._alte_einheit_bestimmen(
            tenant_id,
            current,
            reservation_id=reservation_id,
            old_property=old_property,
            old_nights=old_nights,
            new_keys=new_keys,
            same_property=same_property,
            avail_rows=avail.data or [],
        )
        # Wie in create() je EINHEIT (0265/0266): die Frage lautet „bleibt eine
        # Einheit im ganzen Zeitraum frei?", nicht „ist irgendein Tag irgendeiner
        # Einheit belegt?". Objektweit gefragt war ein Typ mit zwei Einheiten ab
        # der ersten Buchung nicht mehr umbuchbar.
        # Kanal-Trennung wie in create(): eine 'portal'-Sperre (Channex-Import)
        # betrifft nur OTAs, blockt den Rezeptions-Move nicht.
        # Der Alt-Tag-Filter ist unit-genau: eine Fremdbelegung auf einer
        # SCHWESTEREINHEIT am selben Tag darf nicht als „eigener Alt-Tag"
        # durchrutschen (objektweit gefragt tat sie das).
        belegte_einheiten = {
            r.get("unit_id")
            for r in (avail.data or [])
            if r["status"] != "open"
            and availability_block_hits_channel(r.get("source"), RECEPTION)
            and not (
                same_property
                and r["date"] in old_nights
                and r.get("unit_id") == alte_unit
            )
        }
        if belegte_einheiten:
            alle_einheiten = set(
                einheiten_ids(self._db(), req.property_id, tenant_id)
            )
            # Ohne bekannte Einheiten (Altbestand) bleibt es beim strengen
            # objektweiten Verhalten von vorher (Wurzel 5).
            if not alle_einheiten or not alle_einheiten - belegte_einheiten:
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
        # Einheit für den ZIEL-Zeitraum neu bestimmen (0265). Ohne das behielte
        # die Buchung ihre alte `unit_id` — beim Objektwechsel zeigte sie danach
        # auf eine Einheit eines FREMDEN Objekts, und der EXCLUDE-Constraint
        # (0315, `coalesce(unit_id, property_id)`) prüfte gegen die falsche.
        # `eigene_unit`/`eigene_naechte` nehmen die eigene Belegung aus der
        # Rechnung (sonst blockiert die Buchung sich selbst) und behalten die
        # bisherige Einheit, wo möglich — kein stilles Umziehen.
        ziel_unit = freie_einheit(
            self._db(), req.property_id,
            req.check_in.isoformat(), req.check_out.isoformat(),
            tenant_id=tenant_id,
            eigene_unit=alte_unit if same_property else None,
            eigene_naechte=sorted(old_nights) if same_property else None,
        )
        # Keine freie Einheit → der Move findet NICHT statt. Anders als beim
        # OTA-Import (`bookings_sync`), wo eine reale Fremdbuchung vorliegt und
        # deshalb der ganze Typ gesperrt wird, ist hier nichts von außen
        # erzwungen: das Ziel ist voll, also 409. Die alte Einheit als Ersatz zu
        # nehmen wäre eine Doppelbelegung — sie ist gerade als belegt erkannt
        # worden (Wurzel 5: fail-closed, kein Ersatzwert).
        if ziel_unit is None and einheiten_ids(
            self._db(), req.property_id, tenant_id
        ):
            raise ReservationError(
                "Ziel-Zeitraum enthält bereits belegte/gesperrte Tage.",
                status_code=409,
            )
        if ziel_unit:
            update_fields["unit_id"] = ziel_unit
        if req.reprice:
            update_fields.update(self._neu_bepreisen(req, current))

        # Ein offener Nachberechnungs-Link (0469) lautet auf einen Betrag, der
        # aus DIESEM Stand der Buchung abgeleitet wurde (Zeitraum + Preis).
        # Nach dem Move stimmt die Ableitung nicht mehr, die Stripe-URL nimmt
        # aber weiter Geld an — deshalb VOR der Änderung schließen (Wurzel 1).
        # Fail-closed: Scheitert das bei Stripe, wirft es einen 502 und der Move
        # findet nicht statt. Ein nicht verschobener Zeitraum ist reparabel,
        # eine offene URL auf einen veralteten Betrag ist echtes Geld.
        self._nachberechnung_link_schliessen(tenant_id, reservation_id)

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

        # Alte Belegung über die zentrale Freigabe zurückgeben (gefiltert gegen
        # Fremdbelegung); der Recompute läuft unten gebündelt für BEIDE Objekte.
        #
        # `push=False` am GLEICHEN Objekt ist der Kern der Reihenfolge: die
        # Freigabe pusht nicht tag-genau, sondern über die Spanne
        # min(release)..max(release) — und die umfasst Tage, die gerade neu
        # belegt werden, aber noch nicht geschrieben sind (alt 1.–10., neu
        # 4.–7. → release = 1,2,3,8,9,10 deckt auch 4.–7. ab). Für sie meldete
        # der Push eine zu hohe freie Stückzahl, beim Einheitenwechsel sogar
        # ohne jede Zielbelegung im Kalender: ein Überbuchungsfenster. Deshalb
        # lokal freigeben und EINMAL nach beiden Schreibvorgängen über
        # min(alt,neu)..max(alt,neu) melden (unten). Beim OBJEKTWECHSEL gibt es
        # diese Überlappung nicht (zwei Objekte, zwei getrennte Pushes) — dort
        # pusht die Freigabe wie bisher selbst.
        #
        # Der Gegenzustand hängt an der EINHEIT, nicht nur am Zeitraum
        # (Wurzel 1): `old_nights - new_keys` gilt nur, solange die Buchung ihre
        # Einheit BEHÄLT. Weicht sie auf eine Schwestereinheit aus, ist auf der
        # alten Einheit kein Alt-Tag mehr belegt — dann müssen ALLE zurück,
        # sonst bleibt sie dauerhaft `booked` (unverkäuflich) bzw. dieselbe
        # Reservierung belegt zwei Einheiten. `alte_unit` ist deshalb auch die
        # Einheit der Freigabe (Stand VOR dem UPDATE oben), nicht die neue.
        einheit_bleibt = ziel_unit is None or str(ziel_unit) == str(alte_unit)
        release = sorted(
            old_nights - new_keys
            if same_property and einheit_bleibt
            else old_nights
        )
        self._release_nights(
            tenant_id, old_property, release, reservation_id, recompute=False,
            unit_id=alte_unit, push=not same_property,
        )

        # Neue Nächte belegen — aber NICHT eine parallel importierte OTA-Belegung
        # überschreiben. Der EXCLUDE-Constraint befreit OTA-Buchungen
        # (source_channex_booking_id gesetzt, Migration 0104), sodass das UPDATE
        # oben nicht fehlschlägt, wenn zwischen Vorprüfung und Write eine OTA-Nacht
        # importiert wurde. Deshalb den Ist-Zustand der Zieltage frisch lesen und
        # nur die Tage belegen, die NICHT bereits von einer fremden Quelle als
        # 'booked' geführt werden (sonst würde source auf den lokalen Kanal
        # geklobbert und die OTA-Herkunft ginge verloren).
        # Nur die Zeilen UNSERER Einheit: ohne den Filter kollabierte das Dict
        # die n Einheiten-Zeilen desselben Tages auf einen Eintrag, und welche
        # Quelle gewinnt, hing von der Zeilenreihenfolge ab. Eine Fremdbelegung
        # auf einer Schwestereinheit hätte unsere Nacht blockiert (oder umgekehrt).
        occupied_q = (
            self._db()
            .table("availability")
            .select("date,status,source,unit_id")
            .eq("property_id", req.property_id)
            .gte("date", req.check_in.isoformat())
            .lt("date", req.check_out.isoformat())
            .eq("status", "booked")
        )
        if ziel_unit:
            occupied_q = occupied_q.eq("unit_id", ziel_unit)
        occupied_now = {
            r["date"]: r.get("source") for r in (occupied_q.execute()).data or []
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
            # Eine Buchung belegt GENAU IHRE Einheit. Ohne `unit_id` fächert
            # `je_einheit` auf alle Einheiten des Typs auf (die Semantik für
            # Sperren/Freigaben) — ein Move hätte damit sämtliche Einheiten
            # des Ziel-Objekts belegt und den Typ totalgesperrt.
            self._db().table("availability").upsert(
                je_einheit(
                    self._db(), req.property_id, occupy_rows,
                    tenant_id=tenant_id, unit_id=ziel_unit,
                ),
                on_conflict=AVAILABILITY_CONFLICT,
            ).execute()
        # Jetzt steht der Kalender-ENDZUSTAND fest (Freigabe + Belegung
        # geschrieben) — erst jetzt melden. Am gleichen Objekt deckt EIN Push
        # den gesamten berührten Bereich min(alt,neu)..max(alt,neu) ab: er
        # trägt sowohl die freigewordenen als auch die neu belegten Tage mit
        # der jeweils echten Stückzahl, und keine der beiden Seiten kann die
        # andere mit einem Zwischenstand überschreiben. Beim Objektwechsel hat
        # die Freigabe das ALTE Objekt schon selbst gemeldet; hier bleibt nur
        # der Zielzeitraum am NEUEN Objekt.
        push_von, push_bis = req.check_in, req.check_out - timedelta(days=1)
        if same_property and old_nights:
            alt = sorted(old_nights)
            push_von = min(push_von, date.fromisoformat(alt[0]))
            push_bis = max(push_bis, date.fromisoformat(alt[-1]))
        self._push_einheiten_stand(
            tenant_id, req.property_id, push_von, push_bis
        )
        # Dynamic Pricing für BEIDE betroffenen Objekte neu rechnen — ein Move
        # ändert Auslastung + Orphan-Lücken am freigegebenen Alt-Objekt UND am neu
        # belegten Ziel-Objekt genau wie eine Buchung/Storno. Ohne den Recompute
        # (den create()/cancel() bereits machen) drifteten die Tagespreise beider
        # Zeiträume bis zum nächsten 15-min-reconcile-Tick.
        self._recompute_dynamic_pricing(tenant_id, req.property_id)
        if not same_property:
            self._recompute_dynamic_pricing(tenant_id, old_property)
        # Aufgaben der Regeln mitziehen statt neue anzulegen (Wurzel 1, 0272).
        self._sync_task_rules(tenant_id, reservation_id)
        # Eigentümer-Aufenthalt aus einem genehmigten Antrag: der Antrag trägt
        # den Zeitraum mit (Wurzel 1 — der Gegenzustand zur Verschiebung).
        self._sperrantrag_zeitraum_mitziehen(
            tenant_id, current, req.check_in, req.check_out
        )
        # Türcode mitziehen (Wurzel 1): neuer Zeitraum = neue Gültigkeit, neues
        # Objekt = andere Schlösser. Ohne das öffnet der Code am alten Termin
        # und am neuen nicht.
        self._schlosscode_mitziehen(tenant_id, reservation_id)
        # Provision nachziehen: ein Upsell (reprice) ändert den Umsatz, ein
        # Objektwechsel kann das Objekt in einen anderen Veröffentlichungs-
        # Status bringen — beides muss in der offenen Ledger-Zeile ankommen.
        # Der Service zieht nur 'pending'-Zeilen nach (fakturierte bleiben fix).
        self._record_commission(
            tenant_id,
            reservation_id,
            current.get("channel"),
            float(
                update_fields.get("total_amount", current.get("total_amount")) or 0
            ),
            # Betrag UND Währung aus demselben Stand: bei reprice der neue Quote,
            # sonst der unveränderte Bestand. Gemischt wäre es ein falscher
            # Betrag-Währung-Paarung (Wurzel 4).
            update_fields.get("currency", current.get("currency")),
        )
        # Geplante Restzahlung (Split Payment, 0166) an den neuen Betrag
        # anpassen — sonst zieht der stündliche Worker-Tick später die ALTE,
        # zu niedrige Summe ein und die Differenz fällt niemandem auf: Buchung
        # „bezahlt", Kasse zu wenig (Wurzel 1). Nur bei reprice, denn ohne
        # Neuberechnung ist der Betrag unverändert.
        if req.reprice:
            self._geplante_restzahlung_anpassen(
                reservation_id,
                total_amount=float(
                    update_fields.get("total_amount", current.get("total_amount")) or 0
                ),
                paid_amount=float(current.get("paid_amount") or 0),
            )
        # UND die 0,5-%-Nutzungsmeldung mit demselben Stand (Wurzel 1). Sie
        # stand hier nicht, waehrend `cancel()` BEIDE Ledger abraeumt — ein
        # Upsell von 200 auf 450 zog also die Provision nach, die Modulgebuehr
        # blieb bei 200, und die Monatsrechnung war zu niedrig. Der Service
        # aktualisiert nur 'pending'-Zeilen; eine bereits fakturierte bleibt
        # unangetastet.
        self._record_dynpricing_usage(
            tenant_id,
            reservation_id,
            float(
                update_fields.get("total_amount", current.get("total_amount")) or 0
            ),
            update_fields.get("currency", current.get("currency")),
        )
        # Umbuchung = neuer Anker: „3 Tage vor Anreise" meint jetzt einen
        # anderen Tag. Der Spiegel zieht An-/Abreise am Thread nach und plant
        # neu; ohne ihn stünde am Gast weiter der ALTE Termin — und die Zeile
        # trägt Text und Zeitpunkt, nicht die Regel (Wurzel 1).
        _posteingang_spiegeln(self._db(), tenant_id, reservation_id)

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
                    # Der VORHERIGE Betrag gehört dazu, nicht nur der neue: aus
                    # ihm ergibt sich die Differenz, die dem Gast nachberechnet
                    # wird (`payments/nachberechnung.py` belegt damit die
                    # Vorbelegung des Betrags). Ohne ihn ließ sich aus der
                    # Zeitleiste nicht ablesen, was die Verlängerung gekostet
                    # hat — der Betrieb musste rechnen, und wir hätten die Zahl
                    # nur erfinden können (Wurzel 4).
                    "previous_total": (
                        float(current.get("total_amount"))
                        if current.get("total_amount") is not None
                        else None
                    ),
                    "total_amount": update_fields.get("total_amount"),
                    "currency": current.get("currency"),
                },
            )
        # guests(name) für die maskierte Antwort nachladen.
        full = (
            self._db()
            .table("reservations")
            .select("*, guests(name), owners(name)")
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
        partei: CancelParty,
        reason_code: CancelReasonCode | None = None,
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

        `partei` ist PFLICHT und hat bewusst keinen Default (0410). Sie sagt,
        WESSEN Sphäre storniert hat, und entscheidet ab Etappe 3 über die
        8 %-Marktplatz-Provision. Ein Default hier hieße: der nächste neue
        Aufrufer schreibt stillschweigend die bequemste Partei in eine
        Geldentscheidung. Genau das war die Lücke, die `cancelled_by` hatte —
        dort steht beim Gast-Storno NULL, ununterscheidbar von „unbekannt".
        Deshalb: keine Partei → TypeError beim Aufruf, nicht „unbekannt" in der
        DB (Wurzel 4/5).

        `reason_code` kategorisiert den Grund ZUSÄTZLICH zum Pflicht-Freitext
        `reason`; er ist optional, weil nicht jeder Storno-Weg eine Kategorie
        kennt — dann bleibt die Spalte null und nichts wird erfunden.
        """
        actor_user_id = (
            ctx.user_id if by_user_id is _ACTOR_FROM_CTX else by_user_id
        )
        # Ein Aufrufer ohne Type-Checking (MCP-Werkzeug, Job) könnte hier einen
        # rohen String übergeben. Ein Wert, den das DB-Enum nicht kennt, würde
        # den INSERT erst nach dem bereits vollzogenen Status-Update kippen —
        # also VOR dem ersten Seiteneffekt prüfen (Wurzel 5, fail-closed).
        try:
            partei_wert = CancelParty(partei)
        except ValueError as exc:
            raise ReservationError(
                f"Unbekannte Storno-Partei {partei!r} — zulässig sind: "
                f"{', '.join(p.value for p in CancelParty)}.",
                status_code=500,
            ) from exc
        code_wert = (
            CancelReasonCode(reason_code) if reason_code is not None else None
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
        # Owner-Scope (§4.2, Wurzel 9): derselbe Scope wie im Lese-Detailpfad
        # (reads.py) — ein Eigentümer darf auch schreibend nur seine eigenen
        # Objekte treffen. Aktuell greift schon die Rollen-Capability
        # (owner hat kein MANAGE_CALENDAR), aber die destruktivste Operation
        # der Slice darf nicht an einer einzigen Rollenzeile hängen: wird
        # MANAGE_CALENDAR je an _OWNER vergeben oder ein Eigentümer zusätzlich
        # als Co-Gastgeber mit `full` verknüpft, wäre sonst jede fremde Buchung
        # des Tenants stornierbar.
        owner_pids = self._owner_scope_pids(ctx)
        if owner_pids is not None and current.get("property_id") not in owner_pids:
            raise ReservationError("Reservierung nicht gefunden.", status_code=404)
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

        # Eine stornierte Buchung fordert nichts mehr — ein offener
        # Nachberechnungs-Link (0469) würde danach Geld für einen Aufenthalt
        # annehmen, den es nicht gibt (Wurzel 1). Vor dem Status-Wechsel und
        # fail-closed: lieber ein abgebrochener Storno als eine zahlbare URL.
        self._nachberechnung_link_schliessen(tenant_id, reservation_id)
        # Dasselbe für die Zusatzleistungen (0473) — diese Zeile fehlte und war
        # der Kern des Falls vom 25.08.2026.
        self._addon_zahlungslinks_abschliessen(tenant_id, reservation_id)

        now = datetime.now(UTC).isoformat()
        upd = (
            self._db()
            .table("reservations")
            .update(
                {
                    "status": "cancelled",
                    "cancel_reason": clean_reason,
                    "cancelled_by": actor_user_id,
                    "cancelled_by_party": partei_wert.value,
                    "cancel_reason_code": code_wert.value if code_wert else None,
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
        #
        # NUR künftige Nächte: eine bereits verbrachte Nacht ist verbraucht,
        # nicht wieder verkäuflich. Ohne diese Grenze meldete ein Storno am 4.
        # Aufenthaltstag die Nächte 1–3 UND die laufende als frei an die
        # Portale — das Portal verkauft die Nacht weiter, während der Gast im
        # Zimmer liegt (Überbuchung). `move()` blockt den eingecheckten Gast
        # deshalb ganz (Zeile 608); `cancel()` darf das nicht, ein Hotel muss
        # einen Abbruch mitten im Aufenthalt buchen können — also wird hier
        # statt des Verbots der Zeitraum beschnitten.
        # Die heutige Nacht (Anreise heute) bleibt belegt: der Gast hat das
        # Zimmer physisch, erst ab morgen ist es wieder verkäuflich.
        property_id = current["property_id"]
        heute = datetime.now(UTC).date()
        check_in, check_out = (
            _as_date(current["check_in"]), _as_date(current["check_out"])
        )
        ab = max(check_in, heute + timedelta(days=1)) if current.get(
            "checked_in_at"
        ) else check_in
        nights = [d for d in _nights(check_in, check_out) if d >= ab]
        self._release_nights(
            tenant_id, property_id, [d.isoformat() for d in nights], reservation_id,
            unit_id=current.get("unit_id"),
        )

        # Aufgaben-Gegenzustand: Regeln mit remove_on_cancellation räumen ihre
        # Aufgabe weg, die übrigen bleiben als 'cancelled' sichtbar (0272).
        self._sync_task_rules(tenant_id, reservation_id)

        # 0,5 %-Nutzungsmeldung dieser Buchung zurücknehmen (Wurzel 1) — sonst
        # bliebe der Umsatz einer stornierten Buchung in der Monatssumme.
        self._cancel_dynpricing_usage(tenant_id, reservation_id)

        # Offene Provisionszeile dieser Buchung entfernen (Gegenzustand,
        # Wurzel 1) — eine stornierte OTA-Buchung darf nicht mit abgerechnet
        # werden.
        self._cancel_commission(tenant_id, reservation_id)

        # Türcode zurückziehen (Wurzel 1) — ein Gast ohne Buchung darf nicht
        # mehr ins Haus. Bei Offline-Schlössern (algoPIN) ist der Code nicht
        # entziehbar; das wird als `nicht_widerrufbar` samt Ablaufdatum
        # festgehalten, statt einen Widerruf zu behaupten, den es nicht gab.
        self._schlosscode_zurueckziehen(tenant_id, reservation_id)

        # Genehmigten Sperrantrag mit entwerten (Wurzel 1). Der umgekehrte Weg
        # ist gebaut — `sperrantraege.zuruecknehmen` storniert die Eigennutzung
        # —, dieser hier fehlte: wird die Buchung DIREKT storniert (Rezeption,
        # Gast-Storno, Vertragsende), gab sie ihre Naechte frei, waehrend der
        # Antrag auf `approved` stehen blieb.
        #
        # Der Schaden ist unsichtbar und tritt erst spaeter auf: der
        # EXCLUDE-Constraint `block_requests_kein_ueberlapp` (0377) weist jeden
        # NEUEN Antrag fuer dieselben Tage mit 23P01 ab — der Eigentuemer bekommt
        # „ueberschneidet sich mit einer genehmigten Sperre" fuer einen Zeitraum,
        # der im Kalender frei ist, und niemand findet den Grund.
        self._entwerte_sperrantrag(tenant_id, current)

        # Audit: append-only Storno-Historie (Best-Effort — Log-Fehler darf die
        # Stornierung nicht kippen).
        try:
            self._db().table("reservation_cancellation_log").insert(
                {
                    "tenant_id": tenant_id,
                    "reservation_id": reservation_id,
                    "by_user_id": actor_user_id,
                    "cancelled_by_party": partei_wert.value,
                    "cancel_reason_code": code_wert.value if code_wert else None,
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

            # Der Policy-Refund staffelt nach Tagen VOR Anreise. Nach dem
            # Check-in gibt es diesen Abstand nicht mehr — der Aufenthalt läuft,
            # Nächte sind verbraucht. Vorher fing `max(0, …)` den negativen
            # Abstand ab und lieferte 0, also exakt die Staffel „am Anreisetag
            # storniert": ein Abbruch am 4. Tag wurde erstattet wie ein Storno
            # vor der Anreise, bei `refundable` sogar zu 100 % trotz drei
            # verbrauchter Nächte. Ein automatischer Refund ist hier die falsche
            # Antwort (Wurzel 4: kein plausibler Ersatzwert) — die anteilige
            # Abrechnung eines Abbruchs ist ein kaufmännischer Vorgang und läuft
            # über die Zahlungsansicht/Buchhaltung.
            if current.get("checked_in_at"):
                log.info(
                    "cancellation_refund_uebersprungen_aufenthalt_laeuft",
                    reservation_id=reservation_id,
                )
            else:
                days_before = (
                    _as_date(current["check_in"]) - datetime.now(UTC).date()
                ).days
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

        # Gegenzustand im Posteingang (Wurzel 1): der Thread geht auf
        # 'cancelled', und erst dadurch nimmt `schedule_automations_for_thread`
        # die eingeplanten Automails zurück. Ohne diesen Aufruf ginge „Ihre
        # Anreise ist morgen" an einen Gast, der abgesagt hat.
        _posteingang_spiegeln(self._db(), tenant_id, reservation_id)

        log.info(
            "reservation_cancelled",
            reservation_id=reservation_id,
            by_user_id=actor_user_id,
            partei=partei_wert.value,
            reason_code=code_wert.value if code_wert else None,
            channel=current.get("channel"),
        )
        # Zeitleiste (0122): „storniert" — mit Begründung (in der Zeitleiste
        # ohnehin nur tenant-intern sichtbar, RLS).
        self._log_event(
            tenant_id,
            reservation_id,
            "cancelled",
            by_user_id=actor_user_id,
            detail={
                "reason": clean_reason,
                "partei": partei_wert.value,
                "reason_code": code_wert.value if code_wert else None,
                "channel": current.get("channel"),
            },
        )
        full = (
            self._db()
            .table("reservations")
            .select("*, guests(name), owners(name)")
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

    def add_note(
        self, ctx: AuthContext, reservation_id: str, req: ReservationNoteCreate
    ) -> ReservationNote:
        """Eine Notiz an den VERLAUF der Buchung anhängen (0384).

        Überschreibt nichts: anders als `update_note` (ein Feld an der Buchung)
        entsteht hier je Eintrag eine eigene Zeile mit Autor und Zeitpunkt.
        Der Scope ist derselbe wie im Lesepfad (Wurzel 9) — sonst hinge eine
        Notiz an einer Buchung, die der Schreibende gar nicht sehen darf.
        """
        tenant_id = self._require_tenant(ctx)
        self._scoped_reservation(ctx, reservation_id)
        ins = (
            self._db()
            .table("reservation_notes")
            .insert({
                "tenant_id": tenant_id,
                "reservation_id": reservation_id,
                "author_id": ctx.user_id,
                "body": req.body.strip(),
                "category": req.category,
            })
            .execute()
        )
        if not ins.data:
            raise ReservationError(
                "Notiz konnte nicht gespeichert werden.", status_code=500
            )
        r = ins.data[0]
        # Zeitleiste: NUR die Tatsache, nie der Inhalt — das Ereignis-Detail
        # landet unmaskiert im Audit (wie bei update_note).
        self._log_event(
            tenant_id,
            reservation_id,
            "note_added",
            by_user_id=ctx.user_id,
            detail={"category": req.category or ""},
        )
        namen = self._user_names([ctx.user_id] if ctx.user_id else [])
        return ReservationNote(
            id=str(r["id"]),
            reservation_id=reservation_id,
            author_id=r.get("author_id"),
            author_name=namen.get(ctx.user_id or "") or None,
            category=r.get("category"),
            body=r.get("body") or "",
            # Der Zeitstempel kommt aus dem DB-Default. Fehlt er in der Antwort,
            # bleibt das Feld LEER statt auf `now()` zu raten: unsere Uhr ist
            # nicht der Zeitpunkt des Ereignisses (Wurzel 5b), und ein erfundener
            # Wert wäre in der Liste von einem echten nicht zu unterscheiden.
            created_at=str(r.get("created_at") or ""),
        )

    def delete_note(self, ctx: AuthContext, reservation_id: str, note_id: str) -> None:
        """Eine Verlaufs-Notiz löschen (gleicher Scope wie das Anlegen)."""
        tenant_id = self._require_tenant(ctx)
        self._scoped_reservation(ctx, reservation_id)
        _require_uuid(note_id)
        weg = (
            self._db()
            .table("reservation_notes")
            .delete()
            .eq("id", note_id)
            .eq("tenant_id", tenant_id)
            .eq("reservation_id", reservation_id)
            .execute()
        )
        if not weg.data:
            raise ReservationError("Notiz nicht gefunden.", status_code=404)
        self._log_event(
            tenant_id, reservation_id, "note_deleted", by_user_id=ctx.user_id
        )

    def update_note(
        self, ctx: AuthContext, reservation_id: str, note: str
    ) -> ReservationResponse:
        """Interne Notiz der Buchung setzen oder entfernen (leerer Text).

        Bewusst ein eigener kleiner Pfad statt eines allgemeinen PATCH: eine
        Notiz berührt weder Belegung noch Geld, braucht also keinen der
        Kalender-Gegenzustände (Wurzel 1) — ein Sammel-PATCH auf `reservations`
        wäre dagegen die Stelle, an der irgendwann `check_in` mitgeschrieben
        wird, ohne die Nächte umzubuchen.
        """
        tenant_id = self._require_tenant(ctx)
        current = self._load_owned(tenant_id, reservation_id)
        sauber = (note or "").strip()
        upd = (
            self._db()
            .table("reservations")
            .update({"note": sauber or None})
            .eq("id", reservation_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not upd.data:
            raise ReservationError(
                "Notiz konnte nicht gespeichert werden.", status_code=500
            )
        log.info(
            "reservation_note_updated",
            reservation_id=reservation_id,
            by_user_id=ctx.user_id,
            leer=not sauber,
        )
        # Zeitleiste: WAS in der Notiz steht, gehört nicht ins Ereignis-Detail
        # (es landet dort unmaskiert im Audit) — nur die Tatsache der Änderung.
        self._log_event(
            tenant_id,
            reservation_id,
            "note_changed",
            by_user_id=ctx.user_id,
            detail={"cleared": not sauber, "had_note": bool(current.get("note"))},
        )
        mask = load_guest_mask(self._client, ctx.user_id)
        return self._row(self._load_owned(tenant_id, reservation_id), mask)

    def set_archived(
        self, ctx: AuthContext, reservation_id: str, archived: bool
    ) -> ReservationResponse:
        """Buchung in die Ablage legen oder zurückholen (0383).

        BEWUSST ohne jede Nebenwirkung: kein Statuswechsel, keine Freigabe von
        Nächten, keine Meldung an die Portale. Archivieren ist eine Entscheidung
        über die ARBEITSLISTE, nicht über den Vorgang — eine archivierte Buchung
        belegt den Kalender weiter. Wer Nächte freigeben will, storniert; das ist
        der Pfad mit Pflicht-Begründung, Audit und Channex-Rückgabe (Wurzel 1:
        der Gegenzustand gehört zum Storno, nicht zur Ablage).

        Idempotent: zweimal archivieren ändert nichts und wirft nicht (Wurzel 2 —
        ein Doppelklick auf „Archivieren" ist der Normalfall, kein Fehler).
        """
        tenant_id = self._require_tenant(ctx)
        current = self._load_owned(tenant_id, reservation_id)
        schon_archiviert = current.get("archived_at") is not None
        if schon_archiviert == archived:
            mask = load_guest_mask(self._client, ctx.user_id)
            return self._row(current, mask)

        wert = datetime.now(UTC).isoformat() if archived else None
        upd = (
            self._db()
            .table("reservations")
            .update({"archived_at": wert})
            .eq("id", reservation_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not upd.data:
            raise ReservationError(
                "Ablage konnte nicht gespeichert werden.", status_code=500
            )
        log.info(
            "reservation_archived" if archived else "reservation_unarchived",
            reservation_id=reservation_id,
            by_user_id=ctx.user_id,
        )
        self._log_event(
            tenant_id,
            reservation_id,
            "archived" if archived else "unarchived",
            by_user_id=ctx.user_id,
        )
        mask = load_guest_mask(self._client, ctx.user_id)
        return self._row(self._load_owned(tenant_id, reservation_id), mask)

    def update_guest(
        self, ctx: AuthContext, reservation_id: str, req: ReservationGuestUpdate
    ) -> ReservationResponse:
        """Gastdaten und erwartete Zeiten DIESER Buchung korrigieren.

        Wirkt ausschließlich auf die Buchungszeile. Die Gästekartei (`guests`)
        bleibt unberührt: derselbe Gast hängt an mehreren Buchungen, und eine
        Korrektur an einer Buchung darf nicht rückwirkend die Historie der
        anderen umschreiben.

        Zeiten sind Erwartungswerte („voraussichtlich ab 16:00"), keine
        Check-in-Tatsachen — `checked_in_at` bleibt davon unberührt (0091).
        """
        tenant_id = self._require_tenant(ctx)
        current = self._load_owned(tenant_id, reservation_id)
        if current.get("is_owner_stay"):
            # Eine Eigennutzung hat keinen Gast, sondern einen Eigentümer +
            # anwesende Person (0353/0354). Gastfelder dort zu setzen erzeugte
            # zwei Wahrheiten über dieselbe Belegung.
            raise ReservationError(
                "Eigennutzung hat keinen Gast — Angaben laufen über den "
                "Eigentümer-Aufenthalt.",
                status_code=409,
            )
        werte = {
            "guest_name": req.guest_name.strip(),
            "guest_email": (req.guest_email or "").strip() or None,
            "guest_phone": (req.guest_phone or "").strip() or None,
            "guest_language": (req.guest_language or "").strip() or None,
            "guest_country": (req.guest_country or "").strip() or None,
            "checkin_time": req.checkin_time,
            "checkout_time": req.checkout_time,
        }
        upd = (
            self._db()
            .table("reservations")
            .update(werte)
            .eq("id", reservation_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if not upd.data:
            raise ReservationError(
                "Gastdaten konnten nicht gespeichert werden.", status_code=500
            )
        log.info(
            "reservation_guest_updated",
            reservation_id=reservation_id,
            by_user_id=ctx.user_id,
        )
        # Nur WELCHE Felder sich geändert haben — keine Kontaktdaten ins Audit
        # (Wurzel 3: der Datensplit gilt auch für die Zeitleiste).
        geaendert = sorted(
            feld for feld, wert in werte.items() if current.get(feld) != wert
        )
        self._log_event(
            tenant_id,
            reservation_id,
            "guest_changed",
            by_user_id=ctx.user_id,
            detail={"fields": geaendert},
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
        if self._fremdbelegung_im_zeitraum(
            property_id, reservation_id, check_in, check_out
        ):
            raise ReservationError(
                "Zeitraum wurde zwischenzeitlich über ein Portal gebucht — "
                "die Anfrage kann nicht mehr angenommen werden.",
                status_code=409,
            )

        # Jetzt verbindlich: den Kalenderstand an die OTAs melden + Dynamic
        # Pricing. Gemeldet wird die ZAHL noch freier Einheiten (0265), nicht
        # pauschal 0 — die Nächte dieser Anfrage sind seit dem Anlegen belegt,
        # eine Schwestereinheit desselben Typs bleibt aber verkäuflich.
        self._push_einheiten_stand(
            tenant_id, property_id, check_in, check_out - timedelta(days=1),
        )
        self._recompute_dynamic_pricing(tenant_id, property_id)

        # Zahlung: bei einer Anfrage wird VOR accept NICHT kassiert (Airbnb/Booking-
        # Modell — kein PaymentIntent für eine evtl. abgelehnte Anfrage). Erst mit
        # accept wird die Buchung zahlungspflichtig; der Gast erhält die Zahlungs-
        # aufforderung über den bestehenden Gast-Zahlpfad (create_booking_payment
        # erzeugt den Intent beim Öffnen des Checkouts). So entsteht KEIN Refund-
        # Gegenzustand bei decline/expire (Wurzel 1) — es floss nie Geld.
        # Mit dem Annehmen wird die Anfrage zur verbindlichen Buchung — erst
        # jetzt ist sie provisionspflichtig (Gegenstück zu decline/expire, die
        # die Zeile entwerten). Nötig für die im PMS erfasste externe Anfrage:
        # bei einer über den Portal-Import entstandenen liegt die Zeile schon,
        # der Aufruf ist dank UNIQUE(reservation_id) idempotent (Wurzel 2).
        self._record_commission(
            tenant_id,
            reservation_id,
            current.get("channel"),
            float(current.get("total_amount") or 0),
            current.get("currency"),
        )
        # Aus der Anfrage ist ein Verkauf geworden — JETZT entstehen die
        # planmäßigen Aufgaben. Die Engine legt für `requested` bewusst nichts
        # an (eine offene Anfrage plant keine Reinigung); ohne diesen Aufruf
        # bekam eine angenommene Anfrage nie eine Anreise-/Reinigungsaufgabe.
        self._sync_task_rules(tenant_id, reservation_id)
        # Aus derselben Logik der Türcode: erst mit der Annahme gibt es einen
        # Gast, der ins Haus soll.
        self._schlosscode_mitziehen(tenant_id, reservation_id)
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
            unit_id=current.get("unit_id"),
        )

        # Ledger-Gegenzustand wie im Storno (Wurzel 1): eine abgelehnte Anfrage
        # ist nie zu einer Buchung geworden und darf weder Provision noch die
        # 0,5-%-Nutzung tragen. Anfragen aus dem OTA-Import (Request to Book)
        # bringen beide Zeilen bereits mit — ohne diese Aufrufe wanderten sie in
        # die Monatssumme, obwohl der Verkauf nie zustande kam.
        self._cancel_dynpricing_usage(tenant_id, reservation_id)
        self._cancel_commission(tenant_id, reservation_id)
        # Auch eine abgelehnte Anfrage kann schon einen Zugang haben: Anfragen
        # aus dem OTA-Import bringen bestätigte Zeiträume mit, und ein
        # Last-Minute-Fall legt den Code sofort an.
        self._schlosscode_zurueckziehen(tenant_id, reservation_id)

        # Aufgaben-Gegenzustand (Wurzel 1): eine abgelehnte Anfrage darf keine
        # Reinigung stehen lassen. Regulär ist hier nichts zu räumen — die
        # Engine legt für `requested` nichts an —, ausser bei Anfragen aus dem
        # Portal-Import, die vor dieser Regel Aufgaben bekamen. Der Aufruf
        # räumt sie weg statt sie für immer in der Liste stehen zu lassen.
        self._sync_task_rules(tenant_id, reservation_id)
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
            .select("id, tenant_id, property_id, unit_id, check_in, check_out")
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
                    unit_id=r.get("unit_id"),
                )
                # Gegenzustand wie bei decline (Wurzel 1): eine verfallene
                # Anfrage wurde nie verkauft und darf keine offene Provisions-/
                # Nutzungszeile hinterlassen. Beide Helfer sind selbst
                # best-effort und loggen je Reservierung — kein zweiter try.
                self._cancel_dynpricing_usage(r["tenant_id"], r["id"])
                self._cancel_commission(r["tenant_id"], r["id"])
                # Aufgaben-Gegenzustand wie bei decline (Wurzel 1).
                self._sync_task_rules(str(r["tenant_id"]), str(r["id"]))
                # Türcode-Gegenzustand wie bei decline (Wurzel 1): eine
                # verfallene Anfrage darf keinen gültigen Zugang hinterlassen.
                self._schlosscode_zurueckziehen(
                    str(r["tenant_id"]), str(r["id"])
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
