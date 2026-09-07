"""Webhook-Einstieg des Buchungsangebots: bezahlte Session → Buchung (0586).

WARUM EIN EIGENER EINSTIEG UND NICHT DER ABSICHTS-PFAD VON 0409:
Die öffentliche Buchungsstrecke zahlt über einen PaymentIntent, das Angebot über
einen PAYMENT LINK. Der Unterschied ist nicht kosmetisch: eine
Checkout-Session-URL verfällt nach 24 Stunden, ein Angebot hat aber Tage
Gültigkeit — ein Gast, der am dritten Tag klickt, stünde vor einer toten Seite.
Payment Links bleiben gültig, bis wir sie deaktivieren.

Damit kommt die Zahlung als `checkout.session.completed` und nicht als
`payment_intent.succeeded`. Der Angebotspfad hängt sich deshalb an denselben
Verteiler wie Zusatzleistungen (0386) und Nachberechnung (0469) und filtert auf
seine eigene Zweck-Metadata — jeder Zweck lässt fremde Sessions unberührt.

DIE BUCHUNG selbst entsteht weiterhin über `absicht_einloesen` (0409): dort
liegen die Nächte-Vergabe, der EXCLUDE-Constraint und die Erstattung bei einem
inzwischen vergebenen Zeitraum. Dieses Modul verbindet nur Zahlung, Absicht und
Angebot — es legt keine Reservierung selbst an (Wurzel 1: kein zweiter
Buchungsweg).
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from src.core.logging import get_logger

log = get_logger(__name__)

# Der Wert, mit dem der Angebots-Zahlungslink in den Stripe-Metadaten steht
# (`service._zahlungslink`). Als Konstante, damit Schreiber und Leser nicht
# auseinanderlaufen — genau dieser Fehler wäre stumm: die Session gehörte dann
# zu niemandem und würde als „fremd" geloggt.
ZWECK_ANGEBOT = "angebot"


def _feld(obj: Any, key: str) -> Any:  # noqa: ANN401 — Stripe-Objekt ODER dict
    """Feldzugriff auf ein StripeObject ODER ein Dict (Tests).

    StripeObject ist kein dict: `dict(obj)` wirft, `.get` fehlt teils. Deshalb
    beide Wege — dieselbe Lehre wie im Nachberechnungs-Pfad.
    """
    if isinstance(obj, dict):
        return obj.get(key)
    try:
        return obj[key]
    except (KeyError, AttributeError, TypeError):
        return None


def verbuche_angebots_session(  # pylint: disable=too-many-return-statements
    db: Client,
    session: Any,  # noqa: ANN401 — Stripe-Objekt ODER Dict (Tests)
    *,
    account: str | None,
) -> bool:
    """`checkout.session.completed` eines angenommenen Angebots verarbeiten.

    Gibt True zurück, wenn die Session zu diesem Zahlweg gehört (auch wenn sie
    unbezahlt ist — dann ist niemand anders zuständig), sonst False.

    DREI SCHRANKEN, bevor eine Buchung entsteht:
      1. Zweck-Metadata muss `angebot` sein.
      2. Die Session muss auf `paid` stehen — `complete` allein reicht nicht.
      3. Das absendende verbundene Konto muss zum Angebot passen (Wurzel 3):
         ohne diese Prüfung könnte eine Session aus einem fremden Konto eine
         Buchung in diesem Mandanten erzeugen.

    SIEBEN RÜCKGABEN statt der üblichen sechs: jede Schranke hat ihr eigenes
    Ergebnis, und genau darin liegt der Wert — „fremde Session" (False) und
    „unsere Session, aber unbezahlt" (True) dürfen sich nicht vermischen, sonst
    verbucht ein anderer Zweck sie. Zusammengefasst wäre die Kette kürzer und
    falsch.

    IDEMPOTENT (Wurzel 2): `absicht_einloesen` hat seinen Status-Guard und den
    partiellen UNIQUE-Index auf `reservation_id`; `als_bezahlt_vermerken`
    claimt über den Status. Eine Redelivery läuft damit ohne zweite Buchung
    durch.
    """
    meta = _feld(session, "metadata") or {}
    if str(_feld(meta, "nd_zweck") or "") != ZWECK_ANGEBOT:
        return False
    offer_id = str(_feld(meta, "booking_offer_id") or "")
    absicht_id = str(_feld(meta, "booking_intent_id") or "")
    if not offer_id or not absicht_id:
        # Zweck stimmt, aber die Zuordnung fehlt — das ist ein Fehler in
        # unseren Metadaten, keine fremde Session. Laut melden statt still
        # weiterreichen (Wurzel 5).
        log.error(
            "angebot_session_ohne_zuordnung",
            session=str(_feld(session, "id")),
            offer_id=offer_id,
            absicht_id=absicht_id,
        )
        return True

    zeilen = (
        db.table("booking_offers")
        .select("id, tenant_id, status, booking_intent_id")
        .eq("id", offer_id)
        .limit(1)
        .execute()
    ).data or []
    if not zeilen:
        log.warning("angebot_session_unbekanntes_angebot", offer_id=offer_id)
        return True
    angebot = zeilen[0]

    if account:
        konto = (
            db.table("tenant_billing_profile")
            .select("stripe_account_id")
            .eq("tenant_id", str(angebot["tenant_id"]))
            .limit(1)
            .execute()
        ).data or []
        erwartet = str(konto[0]["stripe_account_id"]) if konto else ""
        if erwartet and erwartet != str(account):
            log.warning(
                "angebot_session_fremdes_konto",
                offer_id=offer_id,
                erwartet=erwartet,
                erhalten=str(account),
            )
            return False

    if str(_feld(session, "payment_status") or "") != "paid":
        log.info("angebot_session_unbezahlt", offer_id=offer_id)
        return True

    from src.features.booking_engine.service import (  # noqa: PLC0415
        BookingEngineService,
    )

    from .service import BookingOffersService

    reservation_id = BookingEngineService(db).absicht_einloesen(absicht_id)
    if not reservation_id:
        # Der Zeitraum war inzwischen vergeben. `absicht_einloesen` hat die
        # Absicht als fehlgeschlagen markiert — aber das Geld liegt beim
        # Betrieb, ohne dass eine Buchung entstanden ist. Der Gegenzustand
        # gehört mitgepflegt (Wurzel 1): voll erstatten.
        #
        # ANDERS ALS BEI 0409: Das ist ein DIRECT CHARGE im Konto des Betriebs
        # (der Angebots-Zahlungslink läuft dort), nicht eine Destination Charge
        # der Plattform. Deshalb `direct_acct` statt `reverse_transfer` — ohne
        # das Konto findet Stripe den Intent nicht, und das Geld käme aus dem
        # falschen Saldo.
        _erstatten(
            offer_id=offer_id,
            absicht_id=absicht_id,
            payment_intent=_feld(session, "payment_intent"),
            account=account,
        )
        log.warning(
            "angebot_absicht_nicht_eingeloest",
            offer_id=offer_id,
            absicht_id=absicht_id,
        )
        return True

    BookingOffersService(db).als_bezahlt_vermerken(
        offer_id=offer_id, reservation_id=str(reservation_id)
    )
    log.info(
        "angebot_buchung_entstanden",
        offer_id=offer_id,
        reservation_id=str(reservation_id),
    )
    return True


def _erstatten(
    *,
    offer_id: str,
    absicht_id: str,
    payment_intent: Any,  # noqa: ANN401 — Stripe liefert str oder Objekt
    account: str | None,
) -> None:
    """Bezahltes Angebot ohne Buchung → voll erstatten.

    NICHT geschluckt und nicht als erledigt gemeldet, wenn es scheitert: hier
    liegt echtes Geld eines Gastes ohne Gegenleistung. Der Fehler gehört
    sichtbar, damit jemand von Hand erstattet (Wurzel 5).
    """
    from src.features.payments import stripe_client as sc  # noqa: PLC0415

    intent_id = str(payment_intent or "")
    if not intent_id:
        log.error(
            "angebot_erstattung_ohne_intent",
            offer_id=offer_id,
            absicht_id=absicht_id,
        )
        return
    try:
        sc.refund(
            intent_id,
            refund_application_fee=True,
            direct_acct=account,
            idempotency_key=f"angebot-refund-{absicht_id}",
        )
        log.warning(
            "angebot_erstattet", offer_id=offer_id, payment_intent=intent_id
        )
    except Exception as exc:  # noqa: BLE001 — Meldung statt stillem Geldbehalt
        log.error(
            "angebot_erstattung_fehlgeschlagen",
            offer_id=offer_id,
            payment_intent=intent_id,
            error=str(exc),
        )
