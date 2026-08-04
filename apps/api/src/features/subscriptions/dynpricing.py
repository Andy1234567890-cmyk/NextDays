"""Modul „Dynamische Preise" — 0,5 % vom Buchungsumsatz.

Eigene Datei, weil die Abrechnung dieses Moduls eine geschlossene Einheit ist
(Erfassen → Storno → Monatslauf) und `service.py` sonst über die
1500-Zeilen-Grenze wächst.

WARUM LEDGER UND KEIN STRIPE-BILLING-METER:
Ein Meter ist eine währungslose Zahl — er würde eine 400-EUR- und eine
3.000-DKK-Buchung zu einer sinnlosen Summe addieren (implizit Kurs 1:1).
myNextDays verkauft in 24 Ländern, Buchungen fallen real in EUR/DKK/GBP/USD an.
Die Währung gehört deshalb an jede Ledger-Zeile (Wurzel 4: nie ein erfundener
Kurs), und der Monatslauf stellt JE WÄHRUNG ein eigenes Invoice-Item — eine
Stripe-Rechnung trägt genau eine Währung.

Gleiches Muster wie die OTA-Provision (`commission_ledger`): EIN Weg für alle
variablen Posten statt zwei nebeneinander.
"""
from __future__ import annotations

from typing import Any

from stripe import StripeError as _StripeError
from supabase import Client

from src.core.logging import get_logger
from src.core.supabase import fetch_all_rows

from .entitlements import modul_aktiv
from .errors import SubscriptionsError
from .errors import field as _f
from .schemas import DYNPRICING_MODULE_KEY, DYNPRICING_RATE

log = get_logger("nextdays.subscriptions.dynpricing")


class DynPricingBillingMixin:
    """Erfassung und Abrechnung der 0,5 %-Nutzungsgebühr.

    Erwartet vom Host (`SubscriptionsService`): `self._db`, `self._stripe`,
    `self._load_row`, `self._stripe_err`.
    """

    def _modul_aktiv(self, db: Client, tenant_id: str, module_key: str) -> bool:
        """Hat dieser Tenant das Modul gebucht? Fail-CLOSED (Wurzel 5): bei
        fehlender/unklarer Zeile wird NICHT abgerechnet — lieber eine Gebühr
        verlieren als eine unberechtigte stellen. Eine Quelle: `entitlements`."""
        return modul_aktiv(db, tenant_id, module_key)

    def record_dynpricing_usage(
        self,
        tenant_id: str,
        *,
        reservation_id: str,
        gross_amount: float,
        currency: str,
    ) -> None:
        """0,5 % Dynamische Preise: Gebühr dieser Buchung im Ledger erfassen.

        Die WÄHRUNG DER BUCHUNG steht in der Zeile — nicht die des Abos.
        myNextDays verkauft in 24 Ländern; ein Stripe-Billing-Meter wäre hier
        falsch, weil er währungslos summiert und EUR/DKK/GBP zu einer Zahl
        verschmelzen würde (implizit Kurs 1:1). Umgerechnet wird nirgends
        (Wurzel 4) — der Monatslauf stellt je Währung ein eigenes Item.

        Idempotent (Wurzel 2): UNIQUE(reservation_id) in 0277 plus der
        pending-Guard hier. OTA-Resync, Retry und Doppelklick erzeugen keine
        zweite Zeile; eine bereits fakturierte Zeile wird nicht mehr geändert.

        Ohne gebuchtes Modul (Entitlement) entsteht KEINE Zeile.
        """
        if self._db is None:
            raise SubscriptionsError("Subscriptions-DB nicht verfügbar.", status_code=500)
        db = self._db
        if gross_amount <= 0:
            return
        if not currency:
            raise SubscriptionsError(
                "Währung der Buchung fehlt — keine Nutzungsmeldung ohne Währung.",
                status_code=422,
            )
        if not self._modul_aktiv(db, tenant_id, DYNPRICING_MODULE_KEY):
            return
        fee = round(gross_amount * DYNPRICING_RATE, 2)
        existing = (
            db.table("dynpricing_ledger")
            .select("id, status")
            .eq("reservation_id", reservation_id)
            .limit(1)
            .execute()
        ).data
        payload = {
            "tenant_id": tenant_id,
            "reservation_id": reservation_id,
            "currency": currency,
            "gross_amount": gross_amount,
            "rate": DYNPRICING_RATE,
            "fee_amount": fee,
        }
        if existing:
            # Schon fakturiert → nicht mehr anfassen: eine nachträgliche
            # Preisänderung darf eine gestellte Rechnung nicht verfälschen
            # (gleiche Regel wie bei der OTA-Provision).
            if existing[0]["status"] != "pending":
                return
            db.table("dynpricing_ledger").update(payload).eq(
                "id", existing[0]["id"]
            ).execute()
        else:
            db.table("dynpricing_ledger").insert(payload).execute()
        log.info(
            "dynpricing_erfasst",
            tenant_id=tenant_id,
            reservation_id=reservation_id,
            fee=fee,
            currency=currency,
        )

    def cancel_dynpricing_usage(self, tenant_id: str, *, reservation_id: str) -> None:
        """Storno → offene 0,5 %-Zeile entfernen (Gegenzustand, Wurzel 1).

        Nur ``pending``: eine bereits fakturierte Gebühr bleibt stehen (die
        Rechnung wurde gestellt) und wird ggf. separat gutgeschrieben — exakt
        wie bei ``cancel_commission``. Der Ledger-Weg kennt dabei KEINE
        24-Stunden-Frist, anders als eine Meter-Event-Stornierung.
        """
        if self._db is None:
            raise SubscriptionsError("Subscriptions-DB nicht verfügbar.", status_code=500)
        self._db.table("dynpricing_ledger").delete().eq(
            "tenant_id", tenant_id
        ).eq("reservation_id", reservation_id).eq("status", "pending").execute()

    def bill_all_dynpricing(self, *, period: str) -> dict[str, int]:
        """Monatslauf über alle Tenants mit offenen 0,5 %-Zeilen.

        Je Tenant isoliert: ein kaputter Datensatz (kein Abo, Stripe-Ausfall)
        darf die übrigen nicht stoppen (Wurzel 5) — der Zähler `fehler` macht
        das im Log sichtbar, statt es still zu verschlucken.
        """
        if self._db is None:
            raise SubscriptionsError(
                "Subscriptions-DB nicht verfügbar.", status_code=500
            )
        offene = fetch_all_rows(
            self._db.table("dynpricing_ledger")
            .select("tenant_id")
            .eq("status", "pending")
        )
        tenant_ids = sorted({r["tenant_id"] for r in offene if r.get("tenant_id")})
        bilanz = {"tenants": len(tenant_ids), "abgerechnet": 0, "zeilen": 0, "fehler": 0}
        for tid in tenant_ids:
            try:
                anzahl = self.bill_pending_dynpricing(tid, period=period)
            except SubscriptionsError as exc:
                bilanz["fehler"] += 1
                log.warning(
                    "dynpricing_billing_failed",
                    tenant_id=tid, period=period, error=exc.message,
                )
                continue
            if anzahl:
                bilanz["abgerechnet"] += 1
                bilanz["zeilen"] += anzahl
        if tenant_ids:
            log.info("dynpricing_billing_run", period=period, **bilanz)
        return bilanz

    def bill_pending_dynpricing(self, tenant_id: str, *, period: str) -> int:
        """Monats-Worker: offene 0,5 %-Zeilen eines Tenants fakturieren.

        JE WÄHRUNG ein eigenes Invoice-Item — eine Stripe-Rechnung trägt genau
        eine Währung, und ein Betrieb in 24 Ländern kann Buchungen in EUR, DKK
        und GBP nebeneinander haben. Umgerechnet wird NICHT (Wurzel 4: kein
        selbst geschätzter Kurs); jede Währung wird getrennt gestellt.

        Idempotent (Wurzel 2): der Stripe-idempotency_key enthält Tenant,
        Periode UND Währung, ein zweiter Lauf erzeugt also kein zweites Item.
        Gibt die Zahl der abgerechneten Zeilen zurück.
        """
        if self._db is None:
            raise SubscriptionsError("Subscriptions-DB nicht verfügbar.", status_code=500)
        db = self._db
        pending = (
            db.table("dynpricing_ledger")
            .select("id, fee_amount, currency")
            .eq("tenant_id", tenant_id)
            .eq("status", "pending")
            .execute()
        ).data
        if not pending:
            return 0
        sub_row = self._load_row(db, tenant_id)
        if not sub_row or not sub_row.get("stripe_customer_id"):
            raise SubscriptionsError(
                "Kein Stripe-Kunde/Abo — Nutzungsgebühr nicht abrechenbar.",
                status_code=409,
            )
        customer_id = sub_row["stripe_customer_id"]
        je_waehrung: dict[str, list[dict[str, Any]]] = {}
        for row in pending:
            je_waehrung.setdefault(row["currency"], []).append(row)
        abgerechnet = 0
        for currency, zeilen in sorted(je_waehrung.items()):
            total = round(sum(float(z["fee_amount"]) for z in zeilen), 2)
            if total <= 0:
                continue
            try:
                item = self._stripe.v1.invoice_items.create(
                    params={
                        "customer": customer_id,
                        "amount": int(round(total * 100)),
                        "currency": currency.lower(),
                        "description": f"Dynamische Preise {period}",
                        "metadata": {
                            "tenant_id": tenant_id,
                            "period": period,
                            "currency": currency,
                        },
                    },
                    options={
                        "idempotency_key": f"dyn:{tenant_id}:{period}:{currency}"
                    },
                )
            except _StripeError as exc:
                raise self._stripe_err(exc) from exc
            item_id = _f(item, "id")
            for z in zeilen:
                db.table("dynpricing_ledger").update(
                    {"status": "invoiced", "period": period,
                     "stripe_invoice_item_id": item_id}
                ).eq("id", z["id"]).execute()
            abgerechnet += len(zeilen)
            log.info(
                "dynpricing_billed",
                tenant_id=tenant_id, period=period,
                currency=currency, betrag=total, zeilen=len(zeilen),
            )
        return abgerechnet
