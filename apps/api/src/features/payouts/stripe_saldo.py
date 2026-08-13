"""Guthaben und Auszahlung des verbundenen Stripe-Kontos eines Betriebs.

Das ist die ANDERE Hälfte der Abrechnung. Zwei Töpfe, die nie vermischt werden:

* **Guthaben bei Stripe** (dieses Modul) — was der Betrieb selbst kassiert hat:
  Zusatzleistungen (0386) und Direktbuchungen laufen als Direct Charge in SEINEM
  verbundenen Konto. Das Geld liegt auf seinem Stripe-Saldo, wir haben es nie
  besessen. Ausgezahlt wird es von dort auf sein Bankkonto — entweder nach
  Rhythmus (täglich/wöchentlich/monatlich) oder auf Antrag.
* **Plattform-Auszahlungen** (`service.py`) — Marktplatz-Buchungen, die über
  unseren Saldo laufen und per Transfer weitergereicht werden.

Der Rhythmus wird NICHT bei uns gespiegelt: Stripe ist die einzige Wahrheit
(Wurzel 4 — eine zweite Kopie wäre irgendwann falsch, ohne dass es auffällt).

Scope (Wurzel 3): Das Konto kommt ausschließlich aus dem Profil des Tenants im
Token, nie aus dem Request.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.payments import stripe_client as sc

from .schemas import (
    StripeAuszahlung,
    StripeGuthaben,
    StripeRhythmusUpdate,
    StripeSaldoPosten,
)

log = get_logger("nextdays.payouts.stripe")

# Rhythmen, die wir anbieten. `manual` = keine automatische Auszahlung, das
# Guthaben bleibt stehen, bis der Betrieb sie beantragt.
ERLAUBTE_INTERVALLE = ("manual", "daily", "weekly", "monthly")


class StripeSaldoFehler(Exception):
    """Fachlicher Fehler des Saldo-/Auszahlungspfads."""

    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _iso(epoch: Any) -> str | None:  # noqa: ANN401
    """Stripe-Zeitstempel (Sekunden) → ISO. None bleibt None (Wurzel 5b: keine
    Ersatz-Uhrzeit aus unserer eigenen Uhr)."""
    if epoch in (None, ""):
        return None
    return datetime.fromtimestamp(int(epoch), tz=UTC).isoformat()


class StripeSaldoService:
    """Saldo, Auszahlungen und Auszahlungs-Rhythmus des verbundenen Kontos."""

    def __init__(self, db: Client) -> None:
        self._db = db

    # --- Scope -------------------------------------------------------------

    def _tenant(self, ctx: AuthContext) -> str:
        if not ctx.tenant_id:
            raise StripeSaldoFehler("Kein Betrieb im Token.", status_code=403)
        return ctx.tenant_id

    def _konto(self, tenant_id: str) -> str | None:
        rows = (
            self._db.table("tenant_billing_profile")
            .select("stripe_account_id")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        return str(rows[0].get("stripe_account_id") or "") or None if rows else None

    def _konto_pflicht(self, ctx: AuthContext) -> str:
        acct = self._konto(self._tenant(ctx))
        if not acct:
            raise StripeSaldoFehler(
                "Für diesen Betrieb ist kein Stripe-Konto verbunden.",
                status_code=409,
            )
        return acct

    # --- Lesen -------------------------------------------------------------

    def guthaben(self, ctx: AuthContext) -> StripeGuthaben:
        """Saldo, Rhythmus und die letzten Auszahlungen — in einem Aufruf.

        Ohne verbundenes Konto ist das kein Fehler, sondern ein Zustand: Die
        Oberfläche zeigt dann den Einrichtungs-Hinweis statt einer Fehlermeldung.
        """
        acct = self._konto(self._tenant(ctx))
        if not acct:
            return StripeGuthaben(konto_verbunden=False)
        try:
            saldo = sc.retrieve_balance(acct=acct)
            plan = sc.retrieve_payout_schedule(acct=acct)
            letzte = sc.list_payouts(acct=acct, limit=10)
        except Exception as exc:
            # Kein leerer Saldo als Ersatzantwort (Wurzel 4/5): „0 €" wäre eine
            # Falschaussage über das Geld des Betriebs.
            log.warning("stripe_saldo_abruf_fehlgeschlagen", error=str(exc))
            raise StripeSaldoFehler(
                f"Stripe-Saldo konnte nicht geladen werden: {exc}", status_code=502
            ) from exc
        return StripeGuthaben(
            konto_verbunden=True,
            stripe_account_id=acct,
            payouts_enabled=bool(plan["payouts_enabled"]),
            interval=str(plan["interval"] or ""),
            weekly_anchor=plan.get("weekly_anchor"),
            monthly_anchor=plan.get("monthly_anchor"),
            verfuegbar=[StripeSaldoPosten(**p) for p in saldo["available"]],
            ausstehend=[StripeSaldoPosten(**p) for p in saldo["pending"]],
            letzte_auszahlungen=[
                StripeAuszahlung(
                    id=p["id"],
                    amount_cents=p["amount_cents"],
                    currency=p["currency"],
                    status=p["status"],
                    automatic=p["automatic"],
                    created=_iso(p["created"]),
                    arrival_date=_iso(p["arrival_date"]),
                    failure_message=p.get("failure_message"),
                )
                for p in letzte
            ],
        )

    # --- Auszahlung beantragen ---------------------------------------------

    def auszahlung_anfordern(
        self, ctx: AuthContext, *, currency: str, amount_cents: int | None
    ) -> StripeAuszahlung:
        """Auszahlung des verfügbaren Guthabens auf das Bankkonto des Betriebs.

        Ohne Betrag wird das gesamte verfügbare Guthaben der Währung ausgezahlt.

        Schranken, alle fail-closed:
        * Der Rhythmus muss auf „auf Antrag" (`manual`) stehen — bei
          automatischer Auszahlung plant Stripe den Saldo bereits selbst ein,
          ein zusätzlicher Antrag wäre eine zweite Bewegung derselben Mittel.
        * Auszahlungen müssen freigeschaltet sein (`payouts_enabled`), sonst
          scheitert Stripe erst nach dem Klick mit einer kryptischen Meldung.
        * Der Betrag muss durch das VERFÜGBARE Guthaben gedeckt sein; das
          ausstehende (`pending`) zählt nicht — es ist noch in der
          Abwicklungsfrist.

        Idempotenz (Wurzel 2): Der Idempotency-Key ist aus Konto, Währung,
        Betrag und Kalendertag gebildet. Ein Doppelklick liefert damit dieselbe
        Auszahlung zurück statt einer zweiten. Ein bewusst zweiter Antrag über
        exakt denselben Betrag am selben Tag ist dadurch blockiert — das ist die
        gewollte Seite des Kompromisses (lieber eine zu wenig als eine zu viel).
        """
        acct = self._konto_pflicht(ctx)
        try:
            plan = sc.retrieve_payout_schedule(acct=acct)
            saldo = sc.retrieve_balance(acct=acct)
        except Exception as exc:
            log.warning("stripe_auszahlung_vorpruefung_fehlgeschlagen", error=str(exc))
            raise StripeSaldoFehler(
                f"Stripe-Konto konnte nicht geprüft werden: {exc}", status_code=502
            ) from exc
        if not plan["payouts_enabled"]:
            raise StripeSaldoFehler(
                "Stripe hat Auszahlungen für dieses Konto noch nicht "
                "freigeschaltet (offene Angaben oder Bankverbindung fehlt).",
                status_code=409,
            )
        if str(plan["interval"]) != "manual":
            raise StripeSaldoFehler(
                "Der Auszahlungs-Rhythmus steht auf automatisch. Eine Auszahlung "
                "auf Antrag ist erst möglich, wenn der Rhythmus auf "
                "„nur auf Antrag“ steht.",
                status_code=409,
            )
        waehrung = currency.lower()
        verfuegbar = next(
            (
                p["amount_cents"]
                for p in saldo["available"]
                if p["currency"].lower() == waehrung
            ),
            0,
        )
        betrag = int(amount_cents) if amount_cents is not None else int(verfuegbar)
        if betrag <= 0:
            raise StripeSaldoFehler(
                "Es ist kein verfügbares Guthaben in dieser Währung vorhanden.",
                status_code=409,
            )
        if betrag > verfuegbar:
            raise StripeSaldoFehler(
                "Der Betrag übersteigt das verfügbare Guthaben.", status_code=422
            )
        tag = datetime.now(UTC).date().isoformat()
        try:
            payout = sc.create_payout(
                acct=acct,
                amount_cents=betrag,
                currency=waehrung,
                idempotency_key=f"payout:{acct}:{waehrung}:{betrag}:{tag}",
                metadata={"tenant_id": self._tenant(ctx), "quelle": "abrechnung"},
            )
        except Exception as exc:
            log.warning(
                "stripe_auszahlung_fehlgeschlagen",
                acct=acct,
                betrag=betrag,
                error=str(exc),
            )
            raise StripeSaldoFehler(
                f"Stripe konnte die Auszahlung nicht anstoßen: {exc}", status_code=502
            ) from exc
        log.info(
            "stripe_auszahlung_beantragt",
            tenant_id=self._tenant(ctx),
            betrag=betrag,
            currency=waehrung,
        )
        return StripeAuszahlung(
            id=payout["id"],
            amount_cents=payout["amount_cents"],
            currency=payout["currency"],
            status=payout["status"],
            automatic=False,
            created=datetime.now(UTC).isoformat(),
            arrival_date=_iso(payout.get("arrival_date")),
        )

    # --- Rhythmus ----------------------------------------------------------

    def rhythmus_setzen(
        self, ctx: AuthContext, req: StripeRhythmusUpdate
    ) -> StripeGuthaben:
        """Auszahlungs-Rhythmus des verbundenen Kontos setzen.

        Das ist die Einstellung, die der Betrieb selbst trifft: automatisch
        (täglich/wöchentlich/monatlich) oder nur auf Antrag.
        """
        acct = self._konto_pflicht(ctx)
        if req.interval not in ERLAUBTE_INTERVALLE:
            raise StripeSaldoFehler("Unbekannter Rhythmus.", status_code=422)
        try:
            sc.update_payout_schedule(
                acct=acct,
                interval=req.interval,
                weekly_anchor=req.weekly_anchor,
                monthly_anchor=req.monthly_anchor,
            )
        except Exception as exc:
            log.warning(
                "stripe_rhythmus_setzen_fehlgeschlagen", acct=acct, error=str(exc)
            )
            raise StripeSaldoFehler(
                f"Stripe hat den Rhythmus nicht übernommen: {exc}", status_code=502
            ) from exc
        log.info(
            "stripe_rhythmus_gesetzt",
            tenant_id=self._tenant(ctx),
            interval=req.interval,
        )
        return self.guthaben(ctx)
