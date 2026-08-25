"""Erstattung eines Direct Charge im verbundenen Konto — der EINE Weg dafür.

WOZU DIESES MODUL
=================
Zusatzleistungen (0386) und Nachberechnungen (0469) werden per Stripe-Zahlungs-
link als **Direct Charge im verbundenen Konto** kassiert. Für dieses Geld gab es
bis zum 25.08.2026 keinen Rückweg — mit drei Fallen, die jede einzeln zu einem
falschen Geldereignis geführt hätte:

1. **`refund_for_cancellation` sieht dieses Geld nicht.** Sie filtert
   `type in (full, down_payment, balance)`; `addon` und `surcharge` fallen
   heraus. Ein Storno erstattete die Miete und ließ die Zusatzleistung liegen.

2. **`gateway_ref` ist NICHT der PaymentIntent.** Der Beleg einer
   Zusatzleistung trägt bewusst die Checkout-Session (`cs_…`), damit
   `payment_intent.succeeded` die BUCHUNG nicht als bezahlt markiert und eine
   Plattform-Auszahlung plant (Begründung in `addons/zahlung._schreibe_beleg`).
   `stripe.Refund.create(payment_intent=…)` mit einer Session-ID antwortet
   „No such payment_intent". Der Intent steht am LINK (`payment_intent_id`) —
   von dort holt dieses Modul ihn.

3. **Der Charge liegt im fremden Konto.** Ohne `stripe_account`-Header sucht
   Stripe den Intent im Plattformkonto und findet ihn nicht. `_direct_acct` in
   `PaymentsService` hilft hier nicht: es entscheidet nach `_traegt_haftung`
   (Kanal), und eine Zusatzleistung ist IMMER ein Direct Charge — auch an einer
   Portal-Buchung, bei der `_direct_acct` `None` liefert. Das Konto kommt
   deshalb ebenfalls vom Link (`stripe_account_id`), nicht aus dem Kanal.

DIE BEIDEN GELDREGELN (Entscheidung des Nutzers, 25.08.2026)
============================================================
* **Der Gast bekommt immer 100 %.** Was er gezahlt hat, bekommt er zurück —
  nie gemindert um unsere Provision. Deshalb wird der Refund über den
  BRUTTObetrag der Position gestellt, nicht über den Betrag abzüglich Fee.
* **Die Provision bleibt bei uns.** `refund_application_fee` wird NICHT gesetzt.
  Das Flag würde die einbehaltene `application_fee` an das verbundene Konto
  zurückschieben — die Plattform zahlte dann bei jedem Storno zu. Der Betrieb
  trägt die Provision einer erstatteten Leistung.

`reverse_transfer` ist hier gegenstandslos: Bei einem Direct Charge gibt es
keinen `transfer_data[destination]`, der zurückgeholt werden könnte. Das Geld
liegt von Anfang an im Konto des Betriebs, und der Refund geht aus SEINEM Saldo.
Genau dafür existiert die Sicherheitseinlage (`payouts/sicherheitseinlage.py`):
ohne sie wäre der Saldo im Regelfall längst ausgezahlt und der Refund würde ihn
ins Minus treiben — und `controller.losses.payments = application` heißt, dass
dieses Minus UNSER Verlust ist.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from supabase import Client

from src.core.logging import get_logger

from . import stripe_client as sc

log = get_logger("nextdays.payments.erstattung_direkt")


class ErstattungFehler(Exception):
    """Fachlicher Fehler des Erstattungspfads."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _jetzt() -> str:
    return datetime.now(UTC).isoformat()


def bereits_erstattet_cents(db: Client, *, gateway_ref: str) -> int:
    """Wie viel wurde zu DIESER Stripe-Referenz schon zurückgezahlt (Cent).

    Gerechnet wird über unsere `payments`-Erstattungszeilen mit
    `parent_payment_id` auf den Ursprungsbeleg. Der Ursprungsbeleg wird über
    seine `gateway_ref` (die Checkout-Session) gefunden — sie ist eindeutig.

    Warum nicht Stripe fragen: Der Betragsvergleich entscheidet, ob überhaupt
    erstattet werden DARF; er muss auch dann eine Antwort haben, wenn Stripe
    gerade nicht erreichbar ist. Der Aufrufer prüft zusätzlich fail-closed am
    Datensatz (`refunded_cents`), sodass ein Doppelklick nicht am Netz hängt.
    """
    beleg = _beleg(db, gateway_ref)
    if beleg is None:
        return 0
    zeilen = (
        db.table("payments")
        .select("amount")
        .eq("parent_payment_id", str(beleg["id"]))
        .eq("type", "refund")
        .eq("status", "succeeded")
        .execute()
    ).data or []
    return sum(int(round(float(z.get("amount") or 0) * 100)) for z in zeilen)


def _beleg(db: Client, gateway_ref: str) -> dict | None:
    """Den Ursprungsbeleg zu einer Checkout-Session finden (oder None).

    None ist ein realer Zustand, kein Fehler: Hat der Connect-Webhook nie
    zugestellt und niemand die Buchung geöffnet, existiert kein Beleg, obwohl
    das Geld eingegangen ist — genau der Fall vom 25.08.2026. Der Aufrufer zieht
    den Beleg dann vor der Erstattung nach (`verbuche_zahlung`), statt hier
    einen zu erfinden.
    """
    rows = (
        db.table("payments")
        .select("id, reservation_id, amount, currency, type, status")
        .eq("gateway_ref", gateway_ref)
        .limit(1)
        .execute()
    ).data or []
    return rows[0] if rows else None


def erstatte(  # noqa: PLR0913 — jeder Parameter ist ein Pflichtfeld des Geldwegs
    db: Client,
    *,
    payment_intent_id: str,
    acct: str,
    betrag_cents: int,
    currency: str,
    reservation_id: str,
    quell_session_id: str,
    idempotenz_schluessel: str,
    kontext: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Einen Direct Charge (teil-)erstatten und den Beleg schreiben.

    Reihenfolge (fail-closed, Wurzel 5): erst Stripe, dann unsere Bücher. Ein
    Beleg über eine Erstattung, die nie stattgefunden hat, wäre die schlimmere
    Hälfte — er nimmt den Betrag aus der Abrechnung, während das Geld beim
    Betrieb liegt und der Gast nichts bekommt.

    Idempotenz (Wurzel 2): Der Aufrufer bildet `idempotenz_schluessel`
    deterministisch aus Vorgang und Betrag. Zwei nebenläufige Klicks passieren
    beide jeden Status-Guard, bevor einer schreibt — nur Stripes
    `idempotency_key` verhindert das zweite Geldereignis. Zusätzlich wird der
    Beleg nur angelegt, wenn zur Refund-ID noch keiner existiert; eine
    Wiederholung ergänzt also höchstens den fehlenden Beleg.

    Rückgabe: ``{"refund_id", "betrag_cents", "beleg_id"}``. ``beleg_id`` ist
    None, wenn zum Ursprungs-Geldeingang (noch) kein `payments`-Beleg existiert —
    dann steht die Erstattung ohne Bezug in den Büchern, und das wird LAUT
    geloggt statt stillschweigend hingenommen (Wurzel 5).
    """
    if betrag_cents <= 0:
        raise ErstattungFehler(
            "Der Erstattungsbetrag muss größer als 0 sein.", status_code=422
        )
    try:
        ergebnis = sc.refund(
            payment_intent_id,
            betrag_cents,
            idempotency_key=idempotenz_schluessel,
            # Die Provision bleibt bei uns — s. Modulkopf. Explizit gesetzt,
            # damit ein Leser nicht im Default nachsehen muss, wem das Geld
            # gehört.
            refund_application_fee=False,
            # Kein Destination Charge: es gibt keinen Transfer zurückzuholen.
            reverse_transfer=False,
            # DER entscheidende Header: der Intent lebt im verbundenen Konto.
            direct_acct=acct,
        )
    except Exception as exc:
        log.warning(
            "direct_charge_erstattung_stripe_fehler",
            reservation_id=reservation_id,
            payment_intent=payment_intent_id,
            acct=acct,
            betrag_cents=betrag_cents,
            error=str(exc)[:300],
        )
        raise ErstattungFehler(
            f"Stripe hat die Erstattung nicht ausgeführt: {exc}", status_code=502
        ) from exc

    refund_id = str(ergebnis["id"])
    beleg = _beleg(db, quell_session_id)
    beleg_id = str(beleg["id"]) if beleg else None
    if beleg_id is None:
        # Nicht erfinden und nicht verschweigen: Der Geldeingang ist bei uns nie
        # verbucht worden (fehlender Connect-Webhook). Die Erstattung steht dann
        # ohne Elternbeleg — sichtbar im Log und in der Diagnose, statt als
        # stille Unstimmigkeit in der Abrechnung.
        log.warning(
            "direct_charge_erstattung_ohne_ursprungsbeleg",
            reservation_id=reservation_id,
            session=quell_session_id,
            refund_id=refund_id,
        )

    vorhanden = (
        db.table("payments")
        .select("id")
        .eq("gateway_ref", refund_id)
        .limit(1)
        .execute()
    ).data or []
    if not vorhanden:
        db.table("payments").insert(
            {
                "reservation_id": reservation_id,
                "amount": round(betrag_cents / 100, 2),
                "currency": currency,
                "type": "refund",
                "gateway_ref": refund_id,
                "status": "succeeded",
                "gateway": "stripe",
                "parent_payment_id": beleg_id,
            }
        ).execute()

    log.info(
        "direct_charge_erstattet",
        reservation_id=reservation_id,
        refund_id=refund_id,
        betrag_cents=betrag_cents,
        currency=currency,
        acct=acct,
        **(kontext or {}),
    )
    return {
        "refund_id": refund_id,
        "betrag_cents": betrag_cents,
        "beleg_id": beleg_id,
        "erstattet_am": _jetzt(),
    }
