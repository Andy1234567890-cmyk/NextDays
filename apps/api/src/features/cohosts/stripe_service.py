"""Stripe-Konto eines Co-Gastgebers.

Ein Co-Gastgeber ist tenant-fremd und hat deshalb KEIN
tenant_billing_profile.stripe_account_id — er braucht ein eigenes verbundenes
Konto, um eine Beteiligung zu empfangen.

Warum Pflicht vor der Annahme (Entscheidung des Betreibers): Ohne
auszahlungsbereites Konto entstünden Beteiligungen, die niemand ausschütten
kann — die Zeilen blieben ewig 'pending' und der Co-Gastgeber wartet auf Geld,
das nicht fließen kann.

Custom Accounts wie beim Gastgeber (kein Stripe-Branding), aber nur mit der
``transfers``-Capability: Ein Co-Gastgeber empfängt Geld, er kassiert keine
Gäste — ``card_payments`` wäre unnötige KYC-Last.
"""
from __future__ import annotations

from datetime import UTC, datetime

from supabase import Client

from src.core.logging import get_logger
from src.features.payments.stripe_client import get_stripe

from .schemas import CohostStripeStatus

log = get_logger("nextdays.cohost_stripe")


class CohostStripeError(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class CohostStripeService:
    def __init__(self, db: Client) -> None:
        self._db = db

    def status(self, user_id: str) -> CohostStripeStatus:
        """Aktueller Stand — direkt bei Stripe nachgefragt.

        Der DB-Spiegel könnte veraltet sein (Webhook verpasst); bei einer
        Auszahlungs-Entscheidung wäre das folgenreich. Deshalb Stripe fragen
        und den Spiegel dabei auffrischen.
        """
        row = self._konto(user_id)
        if not row:
            return CohostStripeStatus(verbunden=False)

        try:
            account = get_stripe().v1.accounts.retrieve(row["stripe_account_id"])
        except Exception as exc:  # noqa: BLE001 — auf den Spiegel zurückfallen
            # Stripe nicht erreichbar: den letzten bekannten Stand zeigen statt
            # zu scheitern. Er ist als möglicherweise veraltet zu behandeln —
            # die Auszahlung prüft ohnehin erneut.
            log.warning("cohost_stripe_status_failed", error=str(exc)[:200])
            return CohostStripeStatus(
                verbunden=True,
                payouts_enabled=bool(row.get("payouts_enabled")),
                charges_enabled=bool(row.get("charges_enabled")),
                offene_anforderungen=list(row.get("requirements_due") or []),
            )

        offen = list(getattr(account.requirements, "currently_due", []) or [])
        self._spiegele(
            user_id,
            payouts_enabled=bool(account.payouts_enabled),
            charges_enabled=bool(account.charges_enabled),
            requirements_due=offen,
        )
        return CohostStripeStatus(
            verbunden=True,
            payouts_enabled=bool(account.payouts_enabled),
            charges_enabled=bool(account.charges_enabled),
            offene_anforderungen=offen,
        )

    def create_account(
        self, user_id: str, *, email: str, country: str, business_type: str
    ) -> CohostStripeStatus:
        """Verbundenes Konto anlegen.

        Idempotent (Wurzel 2): Existiert bereits eines, wird dessen Stand
        zurückgegeben statt ein zweites angelegt — sonst entstünde bei einem
        Doppelklick ein verwaistes Stripe-Konto.
        """
        if self._konto(user_id):
            return self.status(user_id)

        try:
            account = get_stripe().v1.accounts.create(
                params={
                    "type": "custom",
                    "country": country,
                    "email": email,
                    "business_type": business_type,
                    # 7011 = Lodging, wie beim Gastgeber.
                    "business_profile": {"mcc": "7011"},
                    # NUR transfers: Ein Co-Gastgeber empfängt, er kassiert
                    # keine Gäste. card_payments wäre unnötige KYC-Last.
                    "capabilities": {"transfers": {"requested": True}},
                    "tos_acceptance": {"service_agreement": "full"},
                    "metadata": {"cohost_user_id": user_id},
                }
            )
        except Exception as exc:  # noqa: BLE001 — als fachlicher Fehler melden
            raise CohostStripeError(
                f"Stripe-Konto konnte nicht angelegt werden: {str(exc)[:200]}",
                status_code=502,
            ) from exc

        self._db.table("cohost_stripe_accounts").upsert(
            {
                "user_id": user_id,
                "stripe_account_id": account.id,
                "payouts_enabled": bool(account.payouts_enabled),
                "charges_enabled": bool(account.charges_enabled),
            },
            on_conflict="user_id",
        ).execute()
        log.info("cohost_stripe_account_created", user_id=user_id)
        return self.status(user_id)

    def onboarding_link(self, user_id: str, *, return_url: str) -> str:
        """Stripe-Onboarding-Link für die fehlenden KYC-Angaben."""
        row = self._konto(user_id)
        if not row:
            raise CohostStripeError(
                "Es ist noch kein Konto angelegt.", status_code=404
            )
        try:
            link = get_stripe().v1.account_links.create(
                params={
                    "account": row["stripe_account_id"],
                    "refresh_url": return_url,
                    "return_url": return_url,
                    "type": "account_onboarding",
                }
            )
        except Exception as exc:  # noqa: BLE001
            raise CohostStripeError(
                f"Onboarding-Link fehlgeschlagen: {str(exc)[:200]}",
                status_code=502,
            ) from exc
        return link.url

    def ist_auszahlungsbereit(self, user_id: str) -> bool:
        """Kann dieser Co-Gastgeber Geld empfangen? Fail-closed.

        Wird bei der Annahme einer Einladung geprüft. Bewusst gegen den
        DB-Spiegel: Ein Stripe-Ausfall darf keine Annahme durchwinken, die
        später nicht ausgezahlt werden kann.
        """
        row = self._konto(user_id)
        return bool(row and row.get("payouts_enabled"))

    # -- intern -------------------------------------------------------------

    def _konto(self, user_id: str) -> dict | None:
        rows = (
            self._db.table("cohost_stripe_accounts")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        ).data or []
        return rows[0] if rows else None

    def _spiegele(
        self,
        user_id: str,
        *,
        payouts_enabled: bool,
        charges_enabled: bool,
        requirements_due: list[str],
    ) -> None:
        """DB-Spiegel auffrischen. Best-effort — der Status wurde bereits
        ermittelt und soll nicht an einem Schreibfehler scheitern."""
        try:
            self._db.table("cohost_stripe_accounts").update(
                {
                    "payouts_enabled": payouts_enabled,
                    "charges_enabled": charges_enabled,
                    "requirements_due": requirements_due,
                    "updated_at": datetime.now(UTC).isoformat(),
                }
            ).eq("user_id", user_id).execute()
        except Exception as exc:  # noqa: BLE001
            log.warning("cohost_stripe_mirror_failed", error=str(exc)[:200])
