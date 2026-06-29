"""Service-Schicht für payments. Business-Logik folgt; aktuell nur Health."""
from .schemas import (
    ConnectAccountCreate,
    ConnectAccountResponse,
    ConnectAccountStatus,
    SliceHealth,
)
from .stripe_client import get_stripe


class PaymentsService:
    slice_name = "payments"

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    # --- Stripe Connect -------------------------------------------------------

    def create_connect_account(
        self,
        req: ConnectAccountCreate,
        return_url: str,
        refresh_url: str,
    ) -> ConnectAccountResponse:
        """Erstellt einen Stripe Custom Account für den Gastgeber und gibt einen
        einmaligen Onboarding-Link zurück. Der Gastgeber sieht nur myNextDays-
        Branding (White-Label via Stripe Connect Custom)."""
        client = get_stripe()

        # Custom Account anlegen — type="custom" gibt myNextDays vollständige
        # Kontrolle über Onboarding und Darstellung (kein Stripe-Branding).
        account = client.v1.accounts.create(
            params={
                "type": "custom",
                "country": req.country,
                "email": req.email,
                "capabilities": {
                    # card_payments + transfers = Standardpaket für Marketplace.
                    "card_payments": {"requested": True},
                    "transfers": {"requested": True},
                },
                "metadata": {"tenant_id": req.tenant_id},
            }
        )

        # Einmaliger Onboarding-Link (Account Links). Nach Ablauf muss ein
        # neuer Link generiert werden (refresh_url fängt das ab).
        link = client.v1.account_links.create(
            params={
                "account": account.id,
                "refresh_url": refresh_url,
                "return_url": return_url,
                "type": "account_onboarding",
            }
        )

        return ConnectAccountResponse(
            stripe_account_id=account.id,
            onboarding_url=link.url,
            expires_at=link.expires_at,
        )

    def get_connect_account_status(
        self, stripe_account_id: str
    ) -> ConnectAccountStatus:
        """Liest den aktuellen KYC-/Aktivierungsstatus eines verbundenen Accounts."""
        client = get_stripe()
        account = client.v1.accounts.retrieve(stripe_account_id)

        # Offene Pflichtfelder (currently_due = sofort nötig).
        requirements: list[str] = list(
            account.requirements.currently_due or []
        )

        return ConnectAccountStatus(
            stripe_account_id=account.id,
            charges_enabled=bool(account.charges_enabled),
            payouts_enabled=bool(account.payouts_enabled),
            details_submitted=bool(account.details_submitted),
            requirements=requirements,
        )

    def create_onboarding_link(
        self,
        stripe_account_id: str,
        return_url: str,
        refresh_url: str,
    ) -> str:
        """Generiert einen neuen Onboarding-Link (z. B. nach Ablauf des alten)."""
        client = get_stripe()
        link = client.v1.account_links.create(
            params={
                "account": stripe_account_id,
                "refresh_url": refresh_url,
                "return_url": return_url,
                "type": "account_onboarding",
            }
        )
        return link.url
