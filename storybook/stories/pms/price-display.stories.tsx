import type { Meta, StoryObj } from "@storybook/react";

import { PriceDisplay } from "@/components/pms/price-display";

/**
 * Preis-Anzeige (Lastenheft §2.3).
 *
 * Zeigt GLATTE Beträge ohne Cent mit Tausenderpunkt. Währung € (EUR) oder Kr (DKK).
 * Optionales Suffix "/ Nacht". Varianten groß (lg) und klein (sm).
 *
 * Fachliche Regel (§2.3): Beträge sind immer glatt (keine Cent), Tausenderpunkt,
 * z.B. `1.250 €` oder `8.500 Kr`.
 *
 * Zugehörige Tabelle: `reservations` (Felder amount/total) bzw. `payments.amount`
 * und `availability`-Preise. Währung folgt dem `reservation_channel`/Property-Kontext.
 */
const meta = {
  title: "PMS-Komponenten/Preis-Anzeige",
  component: PriceDisplay,
  tags: ["autodocs"],
  argTypes: {
    currency: {
      control: "inline-radio",
      options: ["EUR", "DKK"],
      description: "Währung: EUR (€) oder DKK (Kr).",
    },
    size: {
      control: "inline-radio",
      options: ["lg", "sm"],
      description: "Variante groß (lg) oder klein (sm).",
    },
    amount: { control: "number", description: "Glatter Betrag ohne Cent." },
    suffix: { control: "text", description: "Optionales Suffix, z.B. / Nacht." },
  },
} satisfies Meta<typeof PriceDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Standard: großer Euro-Betrag. */
export const Standard: Story = {
  args: {
    amount: 1250,
    currency: "EUR",
    size: "lg",
  },
};

/** Großer Betrag mit Suffix "/ Nacht". */
export const GrossMitSuffix: Story = {
  args: {
    amount: 1250,
    currency: "EUR",
    size: "lg",
    suffix: "/ Nacht",
  },
};

/** Kleine Variante (z.B. für Tabellen/Listen). */
export const Klein: Story = {
  args: {
    amount: 1250,
    currency: "EUR",
    size: "sm",
    suffix: "/ Nacht",
  },
};

/** Dänische Krone (Kr) mit Tausenderpunkt. */
export const DaenischeKrone: Story = {
  args: {
    amount: 8500,
    currency: "DKK",
    size: "lg",
    suffix: "/ Nacht",
  },
};

/** Hoher Betrag — prüft den Tausenderpunkt. */
export const HoherBetrag: Story = {
  args: {
    amount: 124900,
    currency: "EUR",
    size: "lg",
  },
};

/** Übersicht: alle relevanten Zustände nebeneinander. */
export const Uebersicht: Story = {
  args: { amount: 1250, currency: "EUR" },
  render: () => (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline gap-8">
        <PriceDisplay amount={1250} currency="EUR" size="lg" suffix="/ Nacht" />
        <PriceDisplay amount={8500} currency="DKK" size="lg" suffix="/ Nacht" />
      </div>
      <div className="flex items-baseline gap-8">
        <PriceDisplay amount={1250} currency="EUR" size="sm" />
        <PriceDisplay amount={8500} currency="DKK" size="sm" />
        <PriceDisplay amount={124900} currency="EUR" size="sm" suffix="/ Nacht" />
      </div>
    </div>
  ),
};
