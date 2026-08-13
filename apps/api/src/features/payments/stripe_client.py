"""Stripe-Client — initialisiert den StripeClient einmalig mit dem Secret Key
aus der Config. Alle payments-Features (Connect, PaymentIntents, Refunds) nutzen
diese Instanz.

Dünne Wrapper kapseln die PaymentIntent-/Refund-Aufrufe, damit der Service
gateway-agnostisch gegen ein schmales Interface arbeitet und Tests den Client
leicht faken können (StripeClient wird injiziert/gepatcht).
"""
from __future__ import annotations

import io
from collections.abc import Mapping
from functools import lru_cache
from typing import Any

try:
    from stripe import StripeClient
except ImportError as exc:
    raise ImportError(
        "stripe-Paket fehlt. Bitte: pip install stripe"
    ) from exc

from src.core.config import get_settings


class StripeNotConfiguredError(RuntimeError):
    """Stripe-Secret-Key ist nicht gesetzt (in Coolify/Env zu konfigurieren).

    Wird beim ersten Stripe-Zugriff geworfen, statt mit leerem Key einen
    kryptischen Stripe-Auth-Fehler zu erzeugen — so ist die Ursache (fehlende
    Konfiguration) im Frontend klar sichtbar. Keine Fallbacks (Projektregel)."""


@lru_cache(maxsize=1)
def get_stripe() -> StripeClient:
    """Gibt einen konfigurierten StripeClient zurück (einmaliges Init via lru_cache).

    Fehlt der Secret Key, wird klar fehlgeschlagen — nicht mit leerem Key ein
    StripeClient gebaut, der später unverständlich scheitert."""
    secret = get_settings().stripe_secret_key.get_secret_value()
    if not secret:
        raise StripeNotConfiguredError(
            "Stripe ist nicht konfiguriert (STRIPE_SECRET_KEY fehlt). "
            "Bitte in der Umgebung (Coolify) setzen."
        )
    return StripeClient(
        secret,
        max_network_retries=2,  # automatische Retries bei Netzwerkfehlern
    )


def get_or_create_customer(
    *,
    email: str | None,
    metadata: dict[str, str] | None = None,
    client: StripeClient | None = None,
) -> str:
    """Stripe-Customer für einen Gast anlegen (für gespeicherte Karten / spätere
    off-session-Restzahlung). Ohne Customer speichert Stripe die PaymentMethod
    nicht dauerhaft. Wir legen pro Buchung/Gast einen Customer an (kein globales
    Gast-Konto) — simpel und ausreichend für Split-Payment."""
    stripe = client or get_stripe()
    params: dict[str, Any] = {}
    if email:
        params["email"] = email
    if metadata:
        params["metadata"] = metadata
    cust = stripe.v1.customers.create(params=params)
    return cust.id


def create_payment_intent(
    *,
    amount_cents: int,
    currency: str,
    destination_acct: str,
    application_fee_cents: int,
    capture_method: str = "automatic",
    metadata: dict[str, str] | None = None,
    customer: str | None = None,
    save_payment_method: bool = False,
    payment_method: str | None = None,
    off_session: bool = False,
    statement_descriptor: str | None = None,
    transfer_group: str | None = None,
    direct: bool = False,
    idempotency_key: str | None = None,
    client: StripeClient | None = None,
) -> dict[str, Any]:
    """PaymentIntent für eine Gast-Zahlung. ``destination_acct`` ist der Betrieb.

    DREI MECHANIKEN — welche gilt, entscheidet das Geschäftsmodell:

    * **Direct Charge** (``direct=True``, PMS): Der Charge entsteht IM KONTO des
      Betriebs (``Stripe-Account``-Header). Er ist Merchant of Record, das Geld
      liegt nie bei uns, und er trägt Chargebacks selbst. Das ist die einzige
      Variante, die die Haftung wirklich verlagert — ``on_behalf_of`` tut das
      NICHT (Stripe: *„with or without on_behalf_of, Stripe debits disputed
      amounts from your platform account"*).

      Nötig, weil das Lastenheft (§7.1) **0 % Buchungsgebühr** auf
      Vermieter-Buchungen zusagt: Ohne Erlös darf die Plattform auch kein
      Chargeback-Risiko tragen. Die 0,5 %-OTA-Provision bleibt davon unberührt —
      sie wird monatlich fakturiert (``subscriptions``), nicht am Charge
      einbehalten.

    * **Separate Charge** (``direct=False``, Flag an, Marktplatz): Der Charge
      landet auf dem PLATTFORM-Saldo und wird erst nach dem Checkout per
      Transfer freigegeben (gleiche ``transfer_group``). Storno vor Anreise
      braucht kein Zurückholen — das Geld war nie beim Betrieb.

    * **Destination Charge** (``direct=False``, Flag aus, Altpfad):
      ``transfer_data.destination`` reicht sofort weiter.

    Bei den letzten beiden setzt ``on_behalf_of`` den Betrieb als
    Settlement-Händler — das erhält seine Währung (ohne den Parameter rechnet
    Stripe in die Plattform-Währung um, live belegt) und seinen Namen auf der
    Kartenabrechnung. Bei Direct Charges ist das automatisch so.

    application_fee_cents = Plattform-Provision (0 = keine, PMS).

    capture_method='manual' für Kautionen (Vorautorisierung, späteres capture).

    Split-Payment:
      * save_payment_method=True + customer → Karte wird für die spätere
        off-session-Restzahlung gespeichert (setup_future_usage='off_session').
      * off_session=True + payment_method + customer → sofortiger, vom Server
        ausgelöster Charge der gespeicherten Karte (Restzahlung). Verlangt
        confirm=True; Stripe kann 'authentication_required' werfen (3DS) → der
        Aufrufer holt den Gast dann on-session zurück (fail-closed, Wurzel 5).
    """
    stripe = client or get_stripe()
    params: dict[str, Any] = {
        "amount": amount_cents,
        "currency": currency.lower(),
        "capture_method": capture_method,
    }
    if not direct:
        # Settlement-Händler bleibt der Betrieb: seine Währung, sein Land, sein
        # Name auf der Kartenabrechnung. Bei Direct Charges wäre der Parameter
        # sinnlos (der Charge gehört ihm ohnehin) und würde abgelehnt.
        params["on_behalf_of"] = destination_acct
    if transfer_group:
        params["transfer_group"] = transfer_group
    if not direct and not get_settings().stripe_separate_transfers:
        # Altpfad: Stripe reicht das Geld sofort an den Betrieb weiter. Solange
        # das gesetzt ist, DARF der Auszahlungslauf nicht transferieren — sonst
        # fließt dieselbe Buchung zweimal (Sperre in payouts/service.py).
        params["transfer_data"] = {"destination": destination_acct}
    if off_session:
        # Server-initiierter Charge der gespeicherten Karte (kein Payment Element).
        params["off_session"] = True
        params["confirm"] = True
        if payment_method:
            params["payment_method"] = payment_method
    else:
        # Gast zahlt interaktiv über das Payment Element (Karten + 3DS automatisch).
        params["automatic_payment_methods"] = {"enabled": True}
        if save_payment_method:
            params["setup_future_usage"] = "off_session"
    if customer:
        params["customer"] = customer
    if application_fee_cents > 0 and "transfer_data" in params:
        # NUR bei Destination Charges. Stripe lehnt den Charge sonst ab:
        # "Can only apply an application_fee_amount when the PaymentIntent is
        # attached to a connected account" (live verifiziert).
        #
        # Bei Separate Charges braucht es die Fee auch nicht: Der volle Betrag
        # landet auf dem Plattform-Saldo, und der Auszahlungslauf transferiert
        # nur den Nettoanteil weiter — die Provision bleibt dadurch bei uns,
        # ohne dass Stripe sie separat verbuchen muss. Der Ledger
        # (platform_fees) hält den Soll-Wert unabhängig davon fest.
        params["application_fee_amount"] = application_fee_cents
    if statement_descriptor:
        # Name des Händlers auf der Kartenabrechnung des Gastes. Stripe erlaubt
        # max. 22 Zeichen und einige verbotene Zeichen (< > \ ' " *) — kappen und
        # säubern, sonst wirft der Charge (angreifer-/nutzergelieferter Text,
        # Wurzel 8). Leerer Rest → weglassen.
        clean = "".join(
            c for c in statement_descriptor if c not in "<>\\'\"*"
        ).strip()[:22]
        if clean:
            params["statement_descriptor"] = clean
    if metadata:
        params["metadata"] = metadata
    options: dict[str, Any] = {}
    if idempotency_key:
        options["idempotency_key"] = idempotency_key
    if direct:
        # DER Unterschied: Der Aufruf läuft im Konto des Betriebs. Damit gehört
        # ihm der Charge — Merchant of Record, Gebührenträger und
        # Chargeback-Haftung liegen bei ihm, nicht bei uns.
        options["stripe_account"] = destination_acct
    pi = stripe.v1.payment_intents.create(params=params, options=options or None)
    return {
        "id": pi.id,
        "client_secret": pi.client_secret,
        "status": pi.status,
        # payment_method-ID nach Bestätigung (für die spätere Restzahlung merken).
        "payment_method": getattr(pi, "payment_method", None),
    }


def retrieve_payment_intent(
    intent_id: str,
    *,
    direct_acct: str | None = None,
    client: StripeClient | None = None,
) -> dict[str, Any]:
    """Bestehenden PaymentIntent laden (für Idempotenz: einen offenen Intent
    einer Buchung wiederverwenden statt einen zweiten zu erzeugen).

    ``direct_acct``: siehe capture_payment_intent."""
    stripe = client or get_stripe()
    opts = {"stripe_account": direct_acct} if direct_acct else None
    pi = stripe.v1.payment_intents.retrieve(intent_id, options=opts)
    return {"id": pi.id, "client_secret": pi.client_secret, "status": pi.status}


def capture_payment_intent(
    intent_id: str,
    amount_cents: int | None = None,
    *,
    direct_acct: str | None = None,
    client: StripeClient | None = None,
) -> dict[str, Any]:
    """Vorautorisierte Zahlung (Kaution) einziehen — voll oder Teilbetrag.

    ``direct_acct``: Bei Direct Charges gehört der Intent dem Betrieb — ohne
    den Header findet Stripe ihn nicht.
    """
    stripe = client or get_stripe()
    params: dict[str, Any] = {}
    if amount_cents is not None:
        params["amount_to_capture"] = amount_cents
    opts = {"stripe_account": direct_acct} if direct_acct else None
    pi = stripe.v1.payment_intents.capture(intent_id, params=params, options=opts)
    return {"id": pi.id, "status": pi.status}


def cancel_payment_intent(
    intent_id: str,
    *,
    direct_acct: str | None = None,
    client: StripeClient | None = None,
) -> dict[str, Any]:
    """Vorautorisierung freigeben (Kaution zurückgeben) — kein Geldfluss.

    ``direct_acct``: siehe capture_payment_intent.
    """
    stripe = client or get_stripe()
    opts = {"stripe_account": direct_acct} if direct_acct else None
    pi = stripe.v1.payment_intents.cancel(intent_id, options=opts)
    return {"id": pi.id, "status": pi.status}


def retrieve_charge(
    charge_id: str, *, client: StripeClient | None = None
) -> dict[str, Any]:
    """Charge samt Gutschrift auf dem Plattform-Saldo laden.

    Wichtig für Auszahlungen über Währungsgrenzen: Stripe rechnet eingehende
    Zahlungen in die Saldo-Währung der Plattform um. ``balance_amount`` und
    ``balance_currency`` sagen, was TATSÄCHLICH gutgeschrieben wurde — daraus
    berechnet sich der Transferbetrag, statt einen Kurs zu raten (Wurzel 4).

    Die Balance-Transaktion wird mit-expandiert, um einen zweiten API-Aufruf zu
    sparen. Fehlt sie (sehr frischer Charge), bleiben die Felder None.
    """
    stripe = client or get_stripe()
    charge = stripe.v1.charges.retrieve(
        charge_id, params={"expand": ["balance_transaction"]}
    )
    txn = getattr(charge, "balance_transaction", None)

    def _feld(obj: Any, key: str) -> Any:  # noqa: ANN401
        """Zugriff robust für BEIDE Formen: expandiert liefert Stripe ein
        StripeObject (Attribut-Zugriff), aus einem Dict-Fake in Tests kommt ein
        Mapping. Nicht expandiert ist es nur eine ID-Zeichenkette → None."""
        if isinstance(obj, str) or obj is None:
            return None
        if isinstance(obj, Mapping):
            return obj.get(key)
        return getattr(obj, key, None)

    return {
        "id": charge.id,
        "amount": charge.amount,
        "currency": charge.currency,
        # Was nach Umrechnung auf dem Plattform-Saldo ankam.
        "balance_amount": _feld(txn, "amount"),
        "balance_currency": _feld(txn, "currency"),
    }


def create_transfer(
    *,
    amount_cents: int,
    currency: str,
    destination_acct: str,
    transfer_group: str,
    source_transaction: str | None = None,
    metadata: dict[str, str] | None = None,
    idempotency_key: str | None = None,
    client: StripeClient | None = None,
) -> dict[str, Any]:
    """Transfer vom Plattform-Saldo an ein verbundenes Konto.

    Für Buchungen mit MEHREREN Empfängern (Gastgeber + Co-Gastgeber). Eine
    Destination Charge kann laut Stripe nur EIN verbundenes Konto bedienen
    ("Each transaction relates to a single connected account") — mehrere
    Empfänger verlangen separate Charges plus Transfers.

    ``transfer_group`` klammert alle Transfers einer Buchung zusammen (wir
    nutzen die Reservierungs-ID). Damit lässt sich im Stripe-Dashboard und per
    API nachvollziehen, wohin das Geld einer Zahlung geflossen ist.

    ``source_transaction``: Bindet den Transfer an einen konkreten Charge.
    Stripe wartet dann, bis dieser Charge verfügbar ist, statt am
    Plattform-Saldo zu scheitern — wichtig, weil eingehende Zahlungen nicht
    sofort im verfügbaren Saldo landen.

    ``idempotency_key`` ist bei Geldbewegungen PFLICHT-Praxis (Wurzel 2): Ein
    Retry mit gleichem Key liefert denselben Transfer zurück, statt ein zweites
    Mal auszuzahlen.
    """
    stripe = client or get_stripe()
    params: dict[str, Any] = {
        "amount": amount_cents,
        "currency": currency.lower(),
        "destination": destination_acct,
        "transfer_group": transfer_group,
    }
    if source_transaction:
        params["source_transaction"] = source_transaction
    if metadata:
        params["metadata"] = metadata
    options = {"idempotency_key": idempotency_key} if idempotency_key else None
    tr = stripe.v1.transfers.create(params=params, options=options)
    return {"id": tr.id, "amount": tr.amount, "destination": tr.destination}


def reverse_transfer(
    transfer_id: str,
    amount_cents: int | None = None,
    *,
    idempotency_key: str | None = None,
    client: StripeClient | None = None,
) -> dict[str, Any]:
    """Einen Transfer zurückholen (Storno/Erstattung einer Buchung).

    Gegenzustand zu create_transfer (Wurzel 1): Wird eine Buchung storniert,
    muss die bereits ausgezahlte Beteiligung zurück — sonst bleibt Geld beim
    Co-Gastgeber, das der Gastgeber erstatten musste.
    """
    stripe = client or get_stripe()
    params: dict[str, Any] = {}
    if amount_cents is not None:
        params["amount"] = amount_cents
    options = {"idempotency_key": idempotency_key} if idempotency_key else None
    rev = stripe.v1.transfers.create_reversal(
        transfer_id, params=params, options=options
    )
    return {"id": rev.id, "amount": rev.amount}


def refund(
    payment_intent_id: str,
    amount_cents: int | None = None,
    *,
    client: StripeClient | None = None,
    idempotency_key: str | None = None,
    refund_application_fee: bool = False,
    reverse_transfer: bool = False,
    direct_acct: str | None = None,
) -> dict[str, Any]:
    """Rückerstattung zu einem PaymentIntent — voll oder Teilbetrag.

    ``direct_acct`` — bei Direct Charges (PMS) gehört der Intent dem Betrieb;
    der Refund MUSS in seinem Konto laufen, sonst findet Stripe ihn nicht. Das
    Geld kommt dann auch aus SEINEM Saldo, nicht aus dem der Plattform — genau
    das ist bei 0 % Provision gewollt.

    Mit ``idempotency_key`` fängt Stripe selbst eine Doppel-Erstattung durch
    Doppelklick/Retry ab (Wurzel 2): identischer Key → identische Response, kein
    zweites Geldereignis. Der Aufrufer bildet den Key deterministisch aus
    payment_id + Betrag.

    ``reverse_transfer`` — BEI DESTINATION CHARGES PFLICHT. Stripe-Doku:
    "Beim Erstatten einer Zahlung mit transfer_data[destination] behält das
    Zielkonto die Mittel standardmäßig; das Plattformkonto trägt den negativen
    Saldo." Ohne dieses Flag erstattet also die PLATTFORM den Gast aus eigener
    Tasche, während der Gastgeber sein Geld behält. Gesetzt holt Stripe den
    Transfer zurück — bei Vollerstattung ganz, bei Teilerstattung anteilig.

    ``refund_application_fee`` — Achtung, das ist NICHT das Gegenstück: Es gibt
    die Plattform-Provision an den VERBUNDENEN ACCOUNT zurück (Stripe: "to push
    the application fee funds back to the connected account"). Nur setzen, wenn
    die Provision bei Storno wirklich verschenkt werden soll. Standard ist
    False: Wie bei Booking.com bleibt die Provision bei der Plattform.
    """
    stripe = client or get_stripe()
    params: dict[str, Any] = {"payment_intent": payment_intent_id}
    if amount_cents is not None:
        params["amount"] = amount_cents
    if refund_application_fee:
        params["refund_application_fee"] = True
    if reverse_transfer:
        params["reverse_transfer"] = True
    options: dict[str, Any] = {}
    if idempotency_key:
        options["idempotency_key"] = idempotency_key
    if direct_acct:
        options["stripe_account"] = direct_acct
    ref = stripe.v1.refunds.create(params=params, options=options or None)
    return {"id": ref.id, "status": ref.status}


# --- Zusatzleistungen: Zahlungslink im verbundenen Konto ----------------------

def create_addon_payment_link(
    *,
    acct: str,
    currency: str,
    amount_cents: int,
    product_name: str,
    application_fee_cents: int,
    metadata: dict[str, str],
    idempotency_key: str,
    client: StripeClient | None = None,
) -> dict[str, Any]:
    """Zahlungslink für offene Zusatzleistungen — DIRECT CHARGE im Konto des Betriebs.

    Alle drei Aufrufe (Preis, Link) laufen mit ``stripe_account``-Header, der
    Charge entsteht also im verbundenen Konto: Das Geld wird dort gutgeschrieben
    und von dort ausgezahlt. ``application_fee_amount`` ist der Anteil, den
    Stripe daraus auf den Plattform-Saldo verbucht.

    Warum ein Payment Link und keine Checkout-Session: Die Session-URL verfällt
    nach 24 h — ein Link, den der Betrieb dem Gast per Nachricht schickt, wäre
    dann tot. Payment Links bleiben gültig, bis wir sie deaktivieren.

    Payment Links verlangen eine ECHTE Price-ID (``price_data`` gibt es dort
    nicht, anders als bei Checkout-Sessions), deshalb der vorgeschaltete
    ``prices.create`` mit ``product_data`` — Preis und Produkt entstehen im Konto
    des Betriebs, nicht bei uns.

    ``restrictions.completed_sessions.limit = 1`` macht den Link einmal
    bezahlbar (Wurzel 2): Ein zweiter Gast-Klick nach erfolgreicher Zahlung
    führt auf eine „nicht mehr verfügbar"-Seite statt zu einer zweiten
    Belastung.
    """
    stripe = client or get_stripe()
    opts_price: dict[str, Any] = {
        "stripe_account": acct,
        "idempotency_key": f"{idempotency_key}:price",
    }
    price = stripe.v1.prices.create(
        params={
            "currency": currency.lower(),
            "unit_amount": amount_cents,
            "product_data": {"name": product_name[:250]},
        },
        options=opts_price,
    )
    params: dict[str, Any] = {
        "line_items": [{"price": price.id, "quantity": 1}],
        "metadata": metadata,
        # Metadata am Link wird auf jede Checkout-Session kopiert; für den
        # PaymentIntent muss sie separat gesetzt werden, damit auch ein
        # Refund-/Dispute-Fall die Herkunft kennt.
        "payment_intent_data": {"metadata": metadata},
        "restrictions": {"completed_sessions": {"limit": 1}},
    }
    if application_fee_cents > 0:
        params["application_fee_amount"] = application_fee_cents
    link = stripe.v1.payment_links.create(
        params=params,
        options={"stripe_account": acct, "idempotency_key": f"{idempotency_key}:link"},
    )
    return {
        "id": link.id,
        "url": link.url,
        "price_id": price.id,
        "product_id": str(price.product),
        "active": bool(link.active),
    }


def deactivate_payment_link(
    link_id: str, *, acct: str, client: StripeClient | None = None
) -> None:
    """Zahlungslink schließen (Gegenzustand zu create, Wurzel 1).

    Nötig, sobald sich die offenen Positionen ändern oder der Betrieb den Link
    zurückzieht — sonst bliebe eine bezahlbare URL im Umlauf, die auf einen
    veralteten Betrag lautet.
    """
    stripe = client or get_stripe()
    stripe.v1.payment_links.update(
        link_id, params={"active": False}, options={"stripe_account": acct}
    )


def find_paid_session(
    link_id: str, *, acct: str, client: StripeClient | None = None
) -> dict[str, Any] | None:
    """Bezahlte Checkout-Session zu einem Zahlungslink suchen (oder None).

    Der Zahlungseingang kommt normalerweise per Webhook. Dieser Abgleich ist das
    Netz darunter: Ist der Connect-Webhook nicht eingerichtet oder ein Event
    verloren gegangen, bliebe die Zusatzleistung sonst dauerhaft „offen",
    obwohl der Gast bezahlt hat. Wird beim Lesen eines offenen Links aufgerufen
    — ein API-Call, kein Polling-Loop.
    """
    stripe = client or get_stripe()
    sessions = stripe.v1.checkout.sessions.list(
        params={"payment_link": link_id, "limit": 5},
        options={"stripe_account": acct},
    )
    for session in sessions.data or []:
        if getattr(session, "payment_status", None) == "paid":
            return {
                "id": session.id,
                "payment_intent": getattr(session, "payment_intent", None),
                "amount_total": getattr(session, "amount_total", None),
                "currency": getattr(session, "currency", None),
            }
    return None


# --- Saldo und Auszahlung des verbundenen Kontos ------------------------------

def retrieve_balance(
    *, acct: str, client: StripeClient | None = None
) -> dict[str, list[dict[str, Any]]]:
    """Saldo eines verbundenen Kontos: verfügbar / ausstehend je Währung.

    ``available`` ist auszahlbar, ``pending`` liegt noch in der Abwicklungsfrist
    (delay_days). Beides je Währung getrennt — ein Betrieb kann in mehreren
    Währungen kassieren (27 EU-Länder, Wurzel 4).
    """
    stripe = client or get_stripe()
    bal = stripe.v1.balance.retrieve(options={"stripe_account": acct})

    def _liste(werte: Any) -> list[dict[str, Any]]:  # noqa: ANN401
        return [
            {"currency": str(w.currency), "amount_cents": int(w.amount)}
            for w in (werte or [])
        ]

    return {
        "available": _liste(getattr(bal, "available", None)),
        "pending": _liste(getattr(bal, "pending", None)),
    }


def create_payout(
    *,
    acct: str,
    amount_cents: int,
    currency: str,
    idempotency_key: str,
    metadata: dict[str, str] | None = None,
    client: StripeClient | None = None,
) -> dict[str, Any]:
    """Auszahlung des verbundenen Kontos auf dessen Bankkonto anstoßen.

    Läuft mit ``stripe_account``-Header, ist also die Auszahlung DES BETRIEBS
    aus SEINEM Saldo — kein Transfer von unserem Geld. Ohne ``destination``
    nimmt Stripe das hinterlegte Standard-Bankkonto der Währung.

    ``idempotency_key`` ist bei Geldbewegungen Pflicht (Wurzel 2): Doppelklick
    oder Retry liefern dieselbe Auszahlung zurück statt einer zweiten.
    """
    stripe = client or get_stripe()
    params: dict[str, Any] = {"amount": amount_cents, "currency": currency.lower()}
    if metadata:
        params["metadata"] = metadata
    payout = stripe.v1.payouts.create(
        params=params,
        options={"stripe_account": acct, "idempotency_key": idempotency_key},
    )
    return {
        "id": payout.id,
        "amount_cents": int(payout.amount),
        "currency": str(payout.currency),
        "status": str(payout.status),
        "arrival_date": getattr(payout, "arrival_date", None),
    }


def list_payouts(
    *, acct: str, limit: int = 10, client: StripeClient | None = None
) -> list[dict[str, Any]]:
    """Letzte Auszahlungen des verbundenen Kontos (Historie für die Abrechnung)."""
    stripe = client or get_stripe()
    res = stripe.v1.payouts.list(
        params={"limit": max(1, min(limit, 100))}, options={"stripe_account": acct}
    )
    return [
        {
            "id": p.id,
            "amount_cents": int(p.amount),
            "currency": str(p.currency),
            "status": str(p.status),
            "automatic": bool(getattr(p, "automatic", False)),
            "created": int(p.created),
            "arrival_date": getattr(p, "arrival_date", None),
            "failure_message": getattr(p, "failure_message", None),
        }
        for p in (res.data or [])
    ]


def retrieve_payout_schedule(
    *, acct: str, client: StripeClient | None = None
) -> dict[str, Any]:
    """Auszahlungs-Rhythmus + Auszahlbarkeit eines verbundenen Kontos.

    ``interval`` ist Stripes Wahrheit, nicht unsere Kopie: manual (nur auf
    Antrag) | daily | weekly | monthly.
    """
    stripe = client or get_stripe()
    account = stripe.v1.accounts.retrieve(acct)
    settings = getattr(account, "settings", None)
    payouts = getattr(settings, "payouts", None) if settings else None
    schedule = getattr(payouts, "schedule", None) if payouts else None
    return {
        "payouts_enabled": bool(getattr(account, "payouts_enabled", False)),
        "interval": str(getattr(schedule, "interval", "") or ""),
        "weekly_anchor": getattr(schedule, "weekly_anchor", None),
        "monthly_anchor": getattr(schedule, "monthly_anchor", None),
        "delay_days": getattr(schedule, "delay_days", None),
    }


def update_payout_schedule(
    *,
    acct: str,
    interval: str,
    weekly_anchor: str | None = None,
    monthly_anchor: int | None = None,
    client: StripeClient | None = None,
) -> dict[str, Any]:
    """Auszahlungs-Rhythmus des verbundenen Kontos setzen.

    ``manual`` schaltet automatische Auszahlungen ab — das Guthaben bleibt
    stehen, bis der Betrieb eine Auszahlung beantragt. Bei Custom Accounts
    (Haftung liegt bei uns) darf die Plattform diesen Wert setzen; Stripe lehnt
    ihn sonst mit einem klaren Fehler ab, den der Aufrufer weiterreicht statt
    ihn zu verschlucken (Wurzel 5).
    """
    stripe = client or get_stripe()
    schedule: dict[str, Any] = {"interval": interval}
    if interval == "weekly" and weekly_anchor:
        schedule["weekly_anchor"] = weekly_anchor
    if interval == "monthly" and monthly_anchor:
        schedule["monthly_anchor"] = monthly_anchor
    stripe.v1.accounts.update(
        acct, params={"settings": {"payouts": {"schedule": schedule}}}
    )
    return retrieve_payout_schedule(acct=acct, client=stripe)


# --- Branding des verbundenen Kontos (Logo auf der Zahlseite) -----------------

# Stripe akzeptiert als Branding-Datei ausschließlich JPEG und PNG. SVG/WebP —
# bei uns erlaubte Logo-Formate — werden abgelehnt; der Aufrufer überspringt sie
# mit einer klaren Meldung, statt einen Fehlschlag zu verschlucken (Wurzel 5).
BRANDING_MIME = {"image/png", "image/jpeg"}
# Obergrenze laut Stripe-Doku für Branding-Dateien (Wurzel 8: harte Grenze,
# statt eine 5-MB-Datei ins offene Messer laufen zu lassen).
BRANDING_MAX_BYTES = 512 * 1024


def upload_branding_file(
    *,
    content: bytes,
    filename: str,
    purpose: str,
    client: StripeClient | None = None,
) -> str:
    """Bilddatei auf dem PLATTFORM-Konto hochladen → Stripe-File-ID (``file_…``).

    Bewusst OHNE ``stripe_account``-Header: Das anschließende
    ``accounts.update`` läuft auf Plattform-Ebene und kennt nur Dateien, die
    dort liegen. Eine im verbundenen Konto hochgeladene Datei wird beim Setzen
    des Brandings mit „No such file upload" abgelehnt (live verifiziert).

    ``purpose`` MUSS zum Zielfeld passen: ``business_icon`` für
    ``branding.icon``, ``business_logo`` für ``branding.logo``. Stripe prüft das
    und lehnt eine Datei mit dem falschen Zweck ab (ebenfalls live verifiziert)
    — deshalb wird dasselbe Bild für beide Felder zweimal hochgeladen.
    """
    stripe = client or get_stripe()
    # Das SDK baut den multipart/form-data-Request nur für ein DATEI-ÄHNLICHES
    # Objekt; rohe Bytes (oder ein (Name, Bytes)-Tupel) lehnt Stripe mit
    # „must be uploaded in a multipart/form-data request" ab. Der Name wird
    # mitgegeben, weil Stripe daraus den Dateityp ableitet.
    puffer = io.BytesIO(content)
    puffer.name = filename
    datei = stripe.v1.files.create(params={"file": puffer, "purpose": purpose})
    return str(datei.id)


def set_branding(
    *,
    acct: str,
    icon_file_id: str | None = None,
    logo_file_id: str | None = None,
    client: StripeClient | None = None,
) -> None:
    """Branding des verbundenen Kontos setzen.

    ``icon`` ist das kleine Rund-Symbol oben auf der Stripe-Zahlseite (dort, wo
    ohne Branding ein grauer Platzhalter steht), ``logo`` die größere Marke in
    Checkout/Rechnungen. Beide zeigen dasselbe Firmenlogo, solange der Betrieb
    nur eines pflegt — ein zweites zu erfinden wäre ein Fantasiewert (Wurzel 4).
    Nur gesetzte Felder werden übertragen; ein fehlendes bleibt unangetastet.
    """
    branding: dict[str, Any] = {}
    if icon_file_id:
        branding["icon"] = icon_file_id
    if logo_file_id:
        branding["logo"] = logo_file_id
    if not branding:
        return
    stripe = client or get_stripe()
    stripe.v1.accounts.update(acct, params={"settings": {"branding": branding}})
