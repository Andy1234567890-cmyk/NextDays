"""Buchungsabsicht: keine Buchung ohne bezahlte Zahlung (0409).

DER ANLASS (18.08.2026):
Über die eigene Plattform entstand eine Reservierung mit `status='confirmed'`
und `paid_amount=0.00`. Sie belegte drei Nächte, sperrte sie bei den OTAs, legte
einen Posteingang-Thread an und stiess die Automails an — bezahlt hat sie nie
jemand. Der Grund: `create_public_booking` schrieb die Reservierung SOFORT als
bestätigt; die Zahlung lief erst danach über einen eigenen Endpunkt. Bricht der
Gast dort ab, bleibt die Buchung stehen, und niemand räumt sie auf.

DIE UMKEHRUNG:
    bisher   Buchung anlegen  →  PaymentIntent  →  (Gast zahlt … oder nicht)
    jetzt    Prüfen + Preis   →  PaymentIntent  →  Zahlung bestätigt →  Buchung

Die geprüften Daten liegen zwischen beiden Schritten in `booking_intent`
(Migration 0409), nicht in den Stripe-Metadaten: dort stünden sonst Name,
E-Mail und Telefon des Gastes beim Zahlungsdienstleister, und die
Preisaufschlüsselung passt nicht in die 500-Zeichen-Grenze eines
Metadatenwerts. Stripe bekommt nur die ID der Absicht.

WAS DIESE LÖSUNG BEWUSST NICHT KANN — und warum das so entschieden wurde:
Der Zeitraum ist während des Bezahlens NICHT reserviert. Zahlen zwei Gäste
gleichzeitig dieselben Nächte, gewinnt der erste; der zweite bekommt sein Geld
automatisch zurück (`einloesen` erstattet bei 409). Die Alternative wäre eine
Reservierung auf Zeit gewesen, die den Kalender hält und nach 20 Minuten
verfällt — der Betrieb hat sich ausdrücklich dagegen entschieden: lieber eine
seltene Rückerstattung als eine Buchung, die ohne Gegenwert Nächte blockiert.

WURZEL 2 (real kommt alles doppelt): Stripe stellt Webhooks mehrfach zu. Die
Absicht wird deshalb GENAU EINMAL eingelöst — Status-Guard vor dem
Seiteneffekt, partieller UNIQUE-Index auf `reservation_id` als DB-Backstop.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger

from .errors import BookingEngineError
from .schemas import PublicBookingRequest, PublicBookingResponse

log = get_logger(__name__)


def _as_date(wert: str) -> date:
    """ISO-Datum aus der Buchungsabsicht zurück in ein `date`.

    Die Absicht speichert die Daten als ISO-Text; die Nachlauf-Schritte rechnen
    mit `date`. Ein Parsefehler wäre ein Datenfehler und soll auffallen —
    deshalb kein `try` und kein Ersatzdatum (Wurzel 4).
    """
    return date.fromisoformat(wert)


def _naechte(check_in: date, check_out: date) -> list[date]:
    """Die belegten Nächte — die Abreise zählt nicht mit."""
    spanne = (check_out - check_in).days
    return [check_in + timedelta(days=i) for i in range(max(spanne, 0))]

# Zustände einer Absicht. Als Konstanten, damit ein Tippfehler nicht erst am
# CHECK-Constraint der Datenbank auffällt.
OFFEN = "offen"
EINGELOEST = "eingeloest"
FEHLGESCHLAGEN = "fehlgeschlagen"
ABGELAUFEN = "abgelaufen"

# Nach dieser Zeit gilt eine unbezahlte Absicht als aufgegeben. Sie belegt
# nichts, ist also nicht dringend — die Frist dient dem Aufräumen, nicht dem
# Schutz des Kalenders. Grosszügig gewählt: ein Gast, der zwischendurch seine
# Bank-App öffnet (3-D Secure), soll seine Zahlung noch abschliessen können.
ABLAUF_STUNDEN = 24


class AbsichtFehler(RuntimeError):
    """Die Absicht kann nicht eingelöst werden."""


@dataclass(frozen=True)
class VorabNachricht:
    """Die „Nachricht vor der Buchung" und die Antwort des Gastes (0719).

    Beides in EINEM Wert und nicht als zwei Argumente: sie gehören zusammen —
    eine Antwort ohne ihre Frage ist nicht interpretierbar, und genau deshalb
    wird die Frage überhaupt mitgeschrieben. Getrennt gereicht ließe sich die
    eine Hälfte irgendwo vergessen.
    """

    frage: str | None = None
    antwort: str | None = None


# Ein unveraenderliches Modul-Singleton als Vorgabewert: die Datenklasse ist
# frozen, es gibt also nichts, was ein Aufruf am gemeinsamen Objekt aendern
# koennte (B008).
OHNE_VORAB = VorabNachricht()


def anlegen(
    db: Client,
    *,
    tenant_id: str,
    property_id: str,
    daten: dict[str, Any],
    check_in: date,
    check_out: date,
    total_amount: float,
    currency: str,
) -> str:
    """Die geprüften Buchungsdaten hinterlegen; gibt die Absicht-ID zurück.

    Der Aufrufer hat zu diesem Zeitpunkt ALLES geprüft (Verfügbarkeit,
    Stop-Sell, Kapazität, Sperre, Preis) — hier wird nichts mehr entschieden,
    nur verwahrt. Die Prüfungen laufen beim Einlösen ERNEUT: zwischen Zahlung
    und Bestätigung liegen Minuten, in denen sich die Lage geändert haben kann.
    """
    if total_amount <= 0:
        # Ohne Betrag gibt es keine Zahlung — und ohne Zahlung darf keine
        # Buchung entstehen. Das ist kein Randfall, sondern genau der Zustand,
        # den 0409 beendet (Wurzel 4: nie ein plausibler Ersatzwert).
        raise AbsichtFehler("Buchung ohne Betrag ist nicht möglich.")
    if not currency:
        raise AbsichtFehler("Dem Objekt fehlt die Währung.")

    zeile = (
        db.table("booking_intent")
        .insert(
            {
                "tenant_id": tenant_id,
                "property_id": property_id,
                "daten": daten,
                "check_in": check_in.isoformat(),
                "check_out": check_out.isoformat(),
                "total_amount": total_amount,
                "currency": currency,
                "status": OFFEN,
            }
        )
        .execute()
    ).data
    if not zeile:
        raise AbsichtFehler("Buchungsabsicht konnte nicht angelegt werden.")
    return str(zeile[0]["id"])


def zahlung_vermerken(db: Client, absicht_id: str, payment_ref: str) -> None:
    """Den PaymentIntent an der Absicht festhalten — der Weg des Webhooks.

    Der Webhook kennt nur den PaymentIntent; über diese Spalte findet er die
    zugehörige Absicht. Ohne sie käme eine bezahlte Zahlung an, ohne dass
    jemand wüsste, wofür.
    """
    db.table("booking_intent").update({"payment_ref": payment_ref}).eq(
        "id", absicht_id
    ).execute()


def laden(db: Client, absicht_id: str) -> dict[str, Any] | None:
    zeilen = (
        db.table("booking_intent")
        .select("*")
        .eq("id", absicht_id)
        .limit(1)
        .execute()
    ).data or []
    return zeilen[0] if zeilen else None


def per_zahlung(db: Client, payment_ref: str) -> dict[str, Any] | None:
    """Die Absicht zu einem PaymentIntent — der Einstieg des Webhooks."""
    zeilen = (
        db.table("booking_intent")
        .select("*")
        .eq("payment_ref", payment_ref)
        .limit(1)
        .execute()
    ).data or []
    return zeilen[0] if zeilen else None


def als_eingeloest(db: Client, absicht_id: str, reservation_id: str) -> bool:
    """Die Absicht auf `eingeloest` setzen — nur, wenn sie noch offen war.

    DER CLAIM (Wurzel 2): Der `.eq("status", OFFEN)`-Filter ist die
    Idempotenz-Schranke. Stellt Stripe dasselbe Ereignis zweimal zu, gewinnt
    genau eine Zustellung; die zweite bekommt hier `False` und legt keine
    zweite Reservierung an. Der partielle UNIQUE-Index auf `reservation_id`
    ist der DB-Backstop, falls beide Zustellungen exakt gleichzeitig laufen.
    """
    aktualisiert = (
        db.table("booking_intent")
        .update({"status": EINGELOEST, "reservation_id": reservation_id})
        .eq("id", absicht_id)
        .eq("status", OFFEN)
        .execute()
    ).data or []
    return bool(aktualisiert)


def als_fehlgeschlagen(db: Client, absicht_id: str, grund: str) -> None:
    """Bezahlt, aber die Buchung kam nicht zustande — der Erstattungsfall."""
    db.table("booking_intent").update(
        {"status": FEHLGESCHLAGEN, "fehler": grund[:500]}
    ).eq("id", absicht_id).eq("status", OFFEN).execute()


def offene_aufraeumen(db: Client, *, aelter_als_iso: str) -> int:
    """Nie bezahlte Absichten schliessen. Gibt die Zahl der Zeilen zurück.

    Reines Aufräumen: eine offene Absicht belegt nichts und schadet niemandem,
    sie soll nur nicht ewig als „offen" stehen. Deshalb kein Cron-Zwang — der
    Aufrufer entscheidet, wann er das tut.
    """
    zeilen = (
        db.table("booking_intent")
        .update({"status": ABGELAUFEN})
        .eq("status", OFFEN)
        .lt("created_at", aelter_als_iso)
        .execute()
    ).data or []
    if zeilen:
        log.info("buchungsabsichten_abgelaufen", anzahl=len(zeilen))
    return len(zeilen)


class AbsichtMixin:
    """Die Absichts-Schritte des Buchungs-Service (0409).

    Als Mixin und nicht in `service.py`: Der Buchungsweg zerfällt seit 0409 in
    zwei Hälften, die zeitlich Minuten auseinanderliegen — Zahlung starten und
    Zahlung einlösen. Beide gehören zusammen und stehen deshalb hier, neben den
    Zustandsfunktionen der Absicht. `service.py` hatte zudem die
    1500-Zeilen-Grenze erreicht.

    Die Methoden nutzen `self._db()` aus dem Basis-Service; die reinen
    Zustandsfunktionen oben im Modul sind ohne Service testbar.
    """

    def absicht_einloesen(self, absicht_id: str) -> str | None:
        """Aus einer BEZAHLTEN Absicht die Reservierung erzeugen (0409).

        Aufgerufen aus dem Stripe-Webhook (`payment_intent.succeeded`) — dem
        einzigen Ort, an dem feststeht, dass wirklich Geld geflossen ist.
        Gibt die `reservation_id` zurück, oder `None`, wenn nichts zu tun war
        (bereits eingelöst) bzw. die Buchung nicht mehr möglich ist.

        WURZEL 2 — real kommt alles doppelt: Stripe stellt Webhooks mehrfach
        zu. Der Claim (`als_eingeloest`) sitzt deshalb NACH dem
        erfolgreichen Schreiben, aber der Status-Guard davor: eine bereits
        eingelöste Absicht führt hier sofort zurück, ohne zweite Buchung.

        WURZEL 1 — der Gegenzustand: Schlägt die Anlage fehl, weil der Zeitraum
        inzwischen vergeben ist, bleibt Geld beim Gast auf der Karte belastet.
        Diese Absicht wird deshalb als `fehlgeschlagen` markiert; der Aufrufer
        (Webhook) erstattet daraufhin.
        """
        zeile = laden(self._db(), absicht_id)
        if zeile is None:
            log.warning("absicht_nicht_gefunden", absicht_id=absicht_id)
            return None
        if zeile.get("status") != OFFEN:
            # Redelivery oder Doppelzustellung — die Buchung steht bereits.
            return (
                str(zeile["reservation_id"]) if zeile.get("reservation_id") else None
            )

        daten = zeile.get("daten") or {}
        tenant_id = str(zeile["tenant_id"])
        property_id = str(zeile["property_id"])
        check_in = str(zeile["check_in"])
        check_out = str(zeile["check_out"])
        kontakt = daten.get("contact") or {}

        # DIE PRÜFUNGEN LAUFEN ERNEUT. Zwischen dem Start der Zahlung und
        # diesem Moment liegen Minuten — in denen ein anderer Gast dieselben
        # Nächte gekauft, der Betrieb einen Stop-Sell gesetzt oder das Objekt
        # deaktiviert haben kann. Die Absicht hat NICHTS reserviert (0409), der
        # Zeitraum war die ganze Zeit frei verkäuflich.
        #
        # Die atomare RPC ist dabei die letzte Instanz: ihr Advisory-Lock und
        # der EXCLUDE-Constraint entscheiden, wer die Nacht bekommt. Eine
        # Vorprüfung hier wäre TOCTOU und damit wertlos — deshalb wird direkt
        # geschrieben und der Konflikt (RS409/23P01) abgefangen.
        guest_id = daten.get("guest_id")
        if not guest_id:
            # Der Gast wurde beim Start angelegt; fehlt er, ist das kein Grund,
            # die bezahlte Buchung scheitern zu lassen — sie entsteht ohne
            # Gästekartei-Verknüpfung, die Kontaktdaten stehen an der
            # Reservierung selbst.
            log.warning("absicht_ohne_guest_id", absicht_id=absicht_id)

        try:
            ins = (
                self._db()
                .rpc(
                    "create_reservation_atomic",
                    {
                        "p_reservation": {
                            "tenant_id": tenant_id,
                            "property_id": property_id,
                            "guest_id": guest_id,
                            "guest_email": kontakt.get("email") or None,
                            "guest_phone": kontakt.get("phone") or None,
                            "channel": "portal",
                            "ota_name": "myBestDays",
                            "check_in": check_in,
                            "check_out": check_out,
                            "num_guests": max(int(daten.get("guests") or 1), 1),
                            "pets": max(int(daten.get("pets") or 0), 0),
                            # Bezahlt — deshalb sofort bestätigt. Genau dieser
                            # Status war vorher das Problem: er stand hier, bevor
                            # jemand gezahlt hatte.
                            "status": "confirmed",
                            "total_amount": float(zeile["total_amount"]),
                            "quote_items": daten.get("quote_items") or [],
                            "currency": zeile.get("currency"),
                            "pre_booking_question": daten.get("vorab_frage"),
                            "pre_booking_answer": daten.get("vorab_antwort"),
                        },
                        "p_source": "direct",
                        "p_with_outbox": True,
                    },
                )
                .execute()
            ).data
        except APIError as exc:
            if exc.code in ("RS409", "23P01"):
                # Der Zeitraum ist weg — das ist die bewusst in Kauf genommene
                # Kehrseite von „keine Buchung ohne Zahlung" (0409). Der Gast
                # hat gezahlt und bekommt sein Geld zurück; die Alternative
                # (Buchung trotzdem anlegen) wäre eine Doppelbelegung.
                als_fehlgeschlagen(
                    self._db(), absicht_id, "Zeitraum inzwischen vergeben."
                )
                log.warning(
                    "absicht_zeitraum_vergeben",
                    absicht_id=absicht_id, property_id=property_id,
                )
                return None
            raise

        row = (ins or {}).get("reservation")
        if not row:
            als_fehlgeschlagen(
                self._db(), absicht_id, "Reservierung konnte nicht angelegt werden."
            )
            return None
        reservation_id = str(row["id"])

        # Den Claim JETZT setzen — die Buchung steht, eine zweite Zustellung
        # darf keine weitere erzeugen. Greift er nicht, war ein paralleler
        # Webhook schneller: dann ist die eben angelegte Zeile die überzählige
        # und wird zurückgenommen (Wurzel 1: kein verwaister Gegenzustand).
        if not als_eingeloest(self._db(), absicht_id, reservation_id):
            log.warning(
                "absicht_doppelt_eingeloest",
                absicht_id=absicht_id, reservation_id=reservation_id,
            )
            try:
                from src.core.security import AuthContext  # noqa: PLC0415
                from src.features.reservations.schemas import (  # noqa: PLC0415
                    CancelParty,
                    CancelReasonCode,
                )
                from src.features.reservations.service import (  # noqa: PLC0415
                    ReservationsService,
                )

                ReservationsService(self._db()).cancel(
                    # `user_id="system"` (Muster taxpayer/owner_reporting): der
                    # Rollback hat keinen Menschen als Auslöser, und
                    # `AuthContext.user_id` ist Pflicht — mit None warf das
                    # Modell eine ValidationError, die der breite
                    # `except Exception` unten auffing: die überzählige Buchung
                    # blieb bestehen, sichtbar nur als Log-Zeile
                    # `absicht_doppelbuchung_nicht_zurueckgenommen`.
                    AuthContext(
                        user_id="system", tenant_id=tenant_id, role="admin"
                    ),
                    reservation_id,
                    "Doppelt zugestellte Zahlungsbestätigung (0409).",
                    # Unsere eigene Automatik nimmt ihre eigene Anlage zurück —
                    # kein Mensch, kein Verschulden einer Seite.
                    partei=CancelParty.system,
                    reason_code=CancelReasonCode.system_rollback,
                    # "system" ist keine users-Zeile; `cancelled_by` ist FK auf
                    # public.users → der Auslöser bleibt leer, die PARTEI sagt
                    # ohnehin genauer, wer es war.
                    by_user_id=None,
                )
            except Exception as exc:  # noqa: BLE001 — Meldung statt stillem Rest
                log.error(
                    "absicht_doppelbuchung_nicht_zurueckgenommen",
                    reservation_id=reservation_id, error=str(exc),
                )
            return None

        outbox_id = (ins or {}).get("outbox_id")
        self._nachlauf(
            tenant_id=tenant_id,
            property_id=property_id,
            reservation=row,
            daten=daten,
            check_in=check_in,
            check_out=check_out,
            outbox_id=outbox_id,
        )
        log.info(
            "absicht_eingeloest",
            absicht_id=absicht_id, reservation_id=reservation_id,
        )
        return reservation_id

    def _nachlauf(
        self,
        *,
        tenant_id: str,
        property_id: str,
        reservation: dict,
        daten: dict,
        check_in: str,
        check_out: str,
        outbox_id: str | None,
    ) -> None:
        """Alles, was NACH einer entstandenen Buchung passiert (0409).

        Dieselben Schritte wie im Sofort-Pfad — Zusatzleistungen, OTA-Sperre,
        Dynamic Pricing, Loyalty, Posteingang-Thread. Sie stehen hier
        zusammen, weil sie jetzt an ZWEI Stellen gebraucht werden (Anfrage-Pfad
        und eingelöste Zahlung) und weil jeder von ihnen erst zulässig ist,
        wenn die Buchung wirklich existiert: Bis 0409 liefen sie los, sobald
        jemand auf „Buchen" klickte — inklusive OTA-Sperre und Automail an
        einen Gast, der nie bezahlt hat.

        Best effort (Wurzel 5): Die Reservierung ist committet und das Geld
        eingezogen. Kein Nachlauf-Schritt darf das mehr kippen — jeder Fehler
        wird geloggt, nicht geworfen.
        """
        reservation_id = str(reservation["id"])
        gaeste = max(int(daten.get("guests") or 1), 1)
        addons = [
            (str(a["addon_id"]), int(a.get("qty") or 1))
            for a in (daten.get("addons") or [])
            if a.get("addon_id")
        ]
        naechte = _naechte(_as_date(check_in), _as_date(check_out))

        if addons:
            from src.features.addons.service import purchase_addons  # noqa: PLC0415

            try:
                purchase_addons(
                    self._db(),
                    tenant_id=tenant_id,
                    reservation_id=reservation_id,
                    property_id=property_id,
                    surface="booking_engine",
                    selections=addons,
                    nights=len(naechte),
                    guests=gaeste,
                    check_in_iso=check_in,
                    is_before_checkin=True,
                )
            except Exception as exc:  # noqa: BLE001 — Buchung ist bezahlt
                log.error(
                    "absicht_addons_failed",
                    reservation_id=reservation_id, error=str(exc),
                )

        # OTA-Sperre: JETZT ist sie richtig — die Nacht ist verkauft.
        try:
            self._push_channex(
                tenant_id, property_id, _as_date(check_in), _as_date(check_out), 0,
                outbox_id=outbox_id,
            )
        except Exception as exc:  # noqa: BLE001
            log.error("absicht_channex_push_failed", error=str(exc))

        try:
            from src.jobs.queue import try_enqueue_recompute  # noqa: PLC0415

            try_enqueue_recompute(self._db(), tenant_id, property_id)
        except Exception as exc:  # noqa: BLE001
            log.warning("absicht_recompute_enqueue_failed", error=str(exc))

        guest_id = daten.get("guest_id")
        if guest_id:
            try:
                from src.features.guests.service import (  # noqa: PLC0415
                    recompute_guest_aggregates,
                )

                recompute_guest_aggregates(self._db(), tenant_id, str(guest_id))
            except Exception as exc:  # noqa: BLE001
                log.warning("absicht_loyalty_failed", error=str(exc))

        # Planmäßige Aufgaben aus den Regeln erzeugen. Fehlte auf diesem Pfad
        # ganz: eine bezahlte Marktplatz-Buchung bekam „Zusatzleistung
        # vorbereiten" (oben, bedingungslos), aber nie eine Anreise- oder
        # Reinigungsaufgabe.
        try:
            from src.features.tasks.engine import sync_nach_id  # noqa: PLC0415

            sync_nach_id(self._db(), tenant_id, reservation_id)
        except Exception as exc:  # noqa: BLE001 — Aufgaben sind der Nebenpfad
            log.warning(
                "absicht_tasks_failed",
                reservation_id=reservation_id,
                error=str(exc),
            )

        self._posteingang_thread_anlegen(
            tenant_id=tenant_id, reservation_id=reservation_id
        )

    def _absicht_starten(
        self,
        *,
        req: PublicBookingRequest,
        tenant_id: str,
        total_amount: float,
        currency: str | None,
        quote_items: list[dict],
        bookable_addons: list[tuple[str, int]],
        guest_id: str | None,
        vorab: VorabNachricht = OHNE_VORAB,
    ) -> PublicBookingResponse:
        """Zahlung starten, statt die Buchung anzulegen (0409).

        Alles Geprüfte wandert in eine Buchungsabsicht, der Gast bekommt einen
        PaymentIntent. Erst dessen Bestätigung erzeugt die Reservierung —
        deshalb steht hier bewusst KEIN Schreibzugriff auf `reservations`,
        `availability` oder `ari_outbox`.
        """
        from src.features.payments.service import (  # noqa: PLC0415
            PaymentsError,
            PaymentsService,
        )

        if not currency:
            # Ohne Währung lässt sich nicht kassieren. Klar fehlschlagen statt
            # einen Ersatzwert zu erfinden (Wurzel 4) — eine Buchung in der
            # falschen Währung wäre ein Geldschaden.
            raise BookingEngineError(
                "Für dieses Objekt ist keine Währung hinterlegt.",
                status_code=422,
            )

        try:
            absicht_id = anlegen(
                self._db(),
                tenant_id=tenant_id,
                property_id=req.property_id,
                # Alles, was die spätere Anlage braucht. Der Kontakt gehört
                # dazu: der Gast tippt ihn EINMAL, und beim Einlösen läuft kein
                # Request mehr, in dem er stünde.
                daten={
                    "contact": req.contact.model_dump(),
                    "guests": max(req.guests, 1),
                    "pets": max(req.pets, 0),
                    "addons": [
                        {"addon_id": aid, "qty": qty} for aid, qty in bookable_addons
                    ],
                    "quote_items": quote_items,
                    "guest_id": guest_id,
                    "promo_code": req.promo_code,
                    # „Nachricht vor der Buchung" (0719). Muss mit in die
                    # Absicht: beim Einlösen läuft kein Request mehr, in dem
                    # die Antwort des Gastes stünde — sie wäre sonst zwischen
                    # Zahlung und Buchung verloren.
                    "vorab_frage": vorab.frage,
                    "vorab_antwort": vorab.antwort,
                },
                check_in=req.check_in,
                check_out=req.check_out,
                total_amount=total_amount,
                currency=currency,
            )
        except AbsichtFehler as exc:
            raise BookingEngineError(str(exc), status_code=422) from exc

        try:
            # `tenant_id` mitgeben: der Marktplatz kann in der Stripe-Sandbox
            # laufen, das PMS nicht (16.09.2026). Der Service waehlt daran den
            # Client — ohne die Angabe zahlte ein Sandbox-Mandant gegen die
            # Live-Welt und scheiterte an einem Konto, das es dort nicht gibt.
            zahlung = PaymentsService(
                self._db(), tenant_id=tenant_id
            ).create_intent_for_absicht(
                absicht_id=absicht_id,
                tenant_id=tenant_id,
                betrag=total_amount,
                waehrung=currency,
            )
        except PaymentsError as exc:
            # Die Absicht bleibt offen stehen und wird später aufgeräumt; ohne
            # Zahlung entsteht ohnehin keine Buchung. Den Grund durchreichen,
            # nicht auf 500 verflachen — der Gast muss wissen, warum er nicht
            # zahlen kann (Wurzel 5).
            raise BookingEngineError(exc.message, status_code=exc.status_code) from exc

        zahlung_vermerken(self._db(), absicht_id, zahlung["payment_ref"])

        log.info(
            "public_booking_absicht",
            tenant_id=tenant_id,
            property_id=req.property_id,
            absicht_id=absicht_id,
        )
        return PublicBookingResponse(
            id=absicht_id,
            property_id=req.property_id,
            check_in=req.check_in,
            check_out=req.check_out,
            # Noch KEINE Buchung: der Status sagt das ausdrücklich, damit die
            # Oberfläche nicht „gebucht" anzeigt, bevor gezahlt wurde.
            status="zahlung_offen",
            is_request=False,
            request_expires_at=None,
            zahlung_erforderlich=True,
            client_secret=zahlung["client_secret"],
            publishable_key=zahlung.get("publishable_key"),
            stripe_account=zahlung.get("stripe_account"),
            total_amount=total_amount,
            currency=currency,
        )
