import type { Meta, StoryObj } from "@storybook/react";

import { StripeCheckout } from "@/components/plattform/stripe-checkout";

/**
 * Bezahlschritt des Marktplatzes (Stripe Payment Element im myNextDays-Branding).
 *
 * In der App lädt die Komponente für eine angelegte Reservierung den PaymentIntent
 * (Destination Charge) und rendert das echte Stripe Payment Element (Karten +
 * lokale Methoden, 3DS automatisch). Diese Werkstatt-Attrappe zeigt nur das Layout
 * um das Zahlungsfeld — kein echter Stripe-Load, „Jetzt bezahlen" simuliert den
 * Erfolgszustand.
 */
const meta = {
  title: "Plattform (Marktplatz)/Bezahlschritt",
  component: StripeCheckout,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-[22rem]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StripeCheckout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Standard: Story = {};

// Mit Anzahlungs-Hinweis (depositHint).
export const MitAnzahlungsHinweis: Story = {
  args: { depositHint: "Es werden jetzt 30 % als Anzahlung fällig." },
};
