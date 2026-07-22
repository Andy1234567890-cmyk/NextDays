// Fachliche PMS-Komponente: Zahlungs-Zeile/-Karte (Lastenheft §3 Zahlungen / §5 Daten-Split).
// Zeigt payment_type, Betrag via PriceDisplay, payment_status via PaymentStatusBadge,
// Gateway (Revolut/Stripe) als Badge und die gekürzte Zahlungs-Referenz.
// Icons via Iconify (ph:*) — niemals lucide-react. Nur semantische Token-Klassen.
import { Icon } from "@iconify/react";
import type { ComponentProps } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PaymentStatusBadge, type PaymentStatus } from "@/components/pms/status-badge";
import { PriceDisplay, type PriceCurrency } from "@/components/pms/price-display";

// ---- Echte Enum-Werte (verbindlich aus supabase/migrations) ----
// payment_type: deposit | full | refund
export type PaymentType = "deposit" | "full" | "refund";
// payment_gateway: revolut | stripe
export type PaymentGateway = "revolut" | "stripe";

// Zahlungs-Art: deutsches Label + ph-Icon.
type PaymentTypeMeta = { label: string; icon: string };

export const paymentTypeMeta: Record<PaymentType, PaymentTypeMeta> = {
  deposit: { label: "Anzahlung", icon: "ph:hand-coins" },
  full: { label: "Vollzahlung", icon: "ph:money" },
  refund: { label: "Erstattung", icon: "ph:arrow-u-up-left" },
};

// Gateway: deutsches Label + ph-Icon (Revolut primär, Stripe sekundär — Lastenheft §3).
type PaymentGatewayMeta = { label: string; icon: string };

export const paymentGatewayMeta: Record<PaymentGateway, PaymentGatewayMeta> = {
  revolut: { label: "Revolut", icon: "ph:credit-card" },
  stripe: { label: "Stripe", icon: "ph:credit-card" },
};

// Referenz mittig kürzen (z.B. "ch_3Ph…aBcd"), damit Anfang und Ende sichtbar bleiben.
function shortenReference(reference: string, head = 6, tail = 4): string {
  if (reference.length <= head + tail + 1) return reference;
  return `${reference.slice(0, head)}…${reference.slice(-tail)}`;
}

type PaymentRowProps = Omit<ComponentProps<typeof Card>, "children"> & {
  /** Zahlungs-Art (payments.payment_type). */
  type: PaymentType;
  /** Glatter Betrag ohne Cent (Lastenheft §2.3 / §3). */
  amount: number;
  /** Währung: EUR (€) oder DKK (Kr). */
  currency: PriceCurrency;
  /** Zahlungs-Status (payments.status). */
  status: PaymentStatus;
  /** Zahlungs-Gateway (payments.gateway). */
  gateway: PaymentGateway;
  /** Externe Zahlungs-Referenz (payments.reference) — wird gekürzt angezeigt. */
  reference: string;
};

export function PaymentRow({
  className,
  type,
  amount,
  currency,
  status,
  gateway,
  reference,
  ...props
}: PaymentRowProps) {
  const typeMeta = paymentTypeMeta[type];
  const gatewayMeta = paymentGatewayMeta[gateway];
  // Erstattungen werden mit negativem Vorzeichen dargestellt.
  const signedAmount = type === "refund" ? -Math.abs(amount) : amount;

  return (
    <Card
      className={cn(
        "flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
      {...props}
    >
      {/* Links: Zahlungs-Art mit Icon + gekürzte Referenz. */}
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-(--radius) bg-secondary text-foreground">
          <Icon icon={typeMeta.icon} aria-hidden className="size-5" />
        </span>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">{typeMeta.label}</span>
          <span
            className="font-mono text-xs text-muted-foreground"
            title={reference}
          >
            {shortenReference(reference)}
          </span>
        </div>
      </div>

      {/* Rechts: Betrag, Status-Badge und Gateway-Badge. */}
      <div className="flex flex-wrap items-center gap-3 sm:justify-end">
        <PriceDisplay amount={signedAmount} currency={currency} size="sm" />
        <PaymentStatusBadge status={status} />
        <Badge variant="outline">
          <Icon icon={gatewayMeta.icon} aria-hidden className="size-3.5" />
          {gatewayMeta.label}
        </Badge>
      </div>
    </Card>
  );
}
