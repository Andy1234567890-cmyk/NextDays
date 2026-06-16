// Fachliche PMS-Komponente: Preis-Anzeige (Lastenheft §2.3).
// Zeigt GLATTE Beträge ohne Cent mit Tausenderpunkt, Währung € (EUR) oder Kr (DKK).
// Icons via Iconify — niemals lucide-react. Nur semantische Token-Klassen.
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// Unterstützte Währungen (fachlich: EUR und DKK).
export type PriceCurrency = "EUR" | "DKK";

const priceVariants = cva("inline-flex items-baseline font-semibold text-foreground", {
  variants: {
    size: {
      // Klein: kompakte Anzeige (z.B. in Tabellen/Listen).
      sm: "text-base gap-1",
      // Groß: prominente Anzeige (z.B. Detail-/Buchungsseite).
      lg: "text-3xl gap-1.5",
    },
  },
  defaultVariants: { size: "lg" },
});

// Währungssymbole gemäß Lastenheft (€ bzw. Kr).
const CURRENCY_SYMBOL: Record<PriceCurrency, string> = {
  EUR: "€",
  DKK: "Kr",
};

// Glatten Betrag (ohne Cent) mit Tausenderpunkt formatieren.
function formatAmount(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

type PriceDisplayProps = Omit<ComponentProps<"span">, "children"> &
  VariantProps<typeof priceVariants> & {
    /** Glatter Betrag ohne Cent. */
    amount: number;
    /** Währung: EUR (€) oder DKK (Kr). */
    currency: PriceCurrency;
    /** Optionales Suffix, z.B. "/ Nacht". */
    suffix?: string;
  };

export function PriceDisplay({
  className,
  size,
  amount,
  currency,
  suffix,
  ...props
}: PriceDisplayProps) {
  const symbol = CURRENCY_SYMBOL[currency];
  const value = formatAmount(amount);

  return (
    <span className={cn(priceVariants({ size }), className)} {...props}>
      <span className="tabular-nums">{value}</span>
      <span className="font-medium">{symbol}</span>
      {suffix ? (
        <span className="text-sm font-normal text-muted-foreground">{suffix}</span>
      ) : null}
    </span>
  );
}
