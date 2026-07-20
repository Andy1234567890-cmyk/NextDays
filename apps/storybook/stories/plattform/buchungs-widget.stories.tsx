import type { Meta, StoryObj } from "@storybook/react";

import { BuchungsWidget } from "@/components/plattform/buchungs-widget";
import { DEMO_LISTINGS } from "@/components/plattform/_fixtures";

/**
 * Buchungs-Widget der Inserat-Seite (Marktplatz).
 *
 * Datumswahl + Kontaktdaten + Preisaufstellung in der Objekt-Währung. „Reservieren
 * & bezahlen" führt zum Bezahlschritt (Stripe Payment Element). In der App prüft
 * das Widget zuvor die Verfügbarkeit gegen den Buchungskalender (409 bei Belegung)
 * und legt die Reservierung an; in der Werkstatt ist Backend/Stripe attrappiert.
 */
const meta = {
  title: "Plattform (Marktplatz)/Buchungs-Widget",
  component: BuchungsWidget,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-[22rem]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BuchungsWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

// Mit Nachtpreis → zeigt Preisaufstellung, sobald ein Zeitraum gewählt ist.
export const MitPreis: Story = {
  args: { listing: DEMO_LISTINGS[0] },
};

// Ohne hinterlegten Preis → „Preis auf Anfrage", keine Aufstellung.
export const PreisAufAnfrage: Story = {
  args: { listing: DEMO_LISTINGS[3] },
};
