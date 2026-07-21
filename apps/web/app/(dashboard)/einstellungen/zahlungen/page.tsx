// Einstellungen → Zahlungen: Zahlungsmethoden (Stripe/PayPal/manuell) und die
// Verhaltens-Toggles der Kartenzahlung. Serverseitig laden, Client steuert das
// Speichern. Der Stripe-Connect-Onboarding-Flow selbst liegt unter /konto.
import { PaymentsManager } from "@/components/einstellungen/payments-manager";
import { getPaymentSettings } from "@/lib/payment-settings";

export const dynamic = "force-dynamic";

export default async function ZahlungenPage() {
  const res = await getPaymentSettings();

  return (
    <div className="flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Zahlungen</h1>
        <p className="text-sm text-muted-foreground">
          Zahlungsabwicklung: aktive Zahlungsmethoden und wie sich die
          Kartenzahlung automatisch verhält.
        </p>
      </header>

      {res.ok ? (
        <PaymentsManager initial={res.data} />
      ) : (
        <p className="rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Zahlungs-Einstellungen konnten nicht geladen werden: {res.error}
        </p>
      )}
    </div>
  );
}
