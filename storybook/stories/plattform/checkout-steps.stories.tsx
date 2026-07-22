import type { Meta, StoryObj } from "@storybook/react";

import { CheckoutSteps } from "@/components/plattform/checkout-steps";

/**
 * Checkout-Schritte (linke Spalte der Checkout-Seite).
 *
 * Schritt 1 „Wann zahlen" ist aktiv (Auswahl: jetzt / später), Schritt 2
 * „Zahlungsart" und Schritt 3 „Buchung prüfen" folgen ausgegraut. `gesamt` ist
 * der bereits formatierte Gesamtbetrag-String (Währung kommt aus dem Aufrufer).
 */
const meta = {
  title: "Plattform/Checkout-Schritte",
  component: CheckoutSteps,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-[32rem] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CheckoutSteps>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Standard: Story = {
  args: { gesamt: "384,00 €" },
};
