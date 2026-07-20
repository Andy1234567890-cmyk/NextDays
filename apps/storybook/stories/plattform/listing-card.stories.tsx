import type { Meta, StoryObj } from "@storybook/react";

import { ListingCard } from "@/components/plattform/listing-card";
import { DEMO_LISTINGS } from "@/components/plattform/_fixtures";

/**
 * Inserat-Karte des Marktplatzes (Vertriebskanal „Plattform").
 *
 * Eine Karte im Suche-Grid: Foto (oder Farb-Platzhalter, wenn ein Objekt noch
 * keine Fotos hat), Titel, Ort (gast-sicher „Stadt, Land"), „ab"-Preis in der
 * Objekt-Währung — oder „Preis auf Anfrage", wenn kein Preis hinterlegt ist.
 * Bewertungen werden NIE erfunden, sie erscheinen nur mit echten Daten.
 * Die Währung kommt immer aus dem Listing (kein €-Hardcode).
 */
const meta = {
  title: "Plattform (Marktplatz)/Inserat-Karte",
  component: ListingCard,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-60">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ListingCard>;

export default meta;
type Story = StoryObj<typeof meta>;

// Mit Preis, Bewertung und Gäste-Favorit-Badge.
export const Standard: Story = {
  args: { listing: DEMO_LISTINGS[0] },
};

// Fremdwährung (CHF) und ohne Bewertung.
export const Fremdwaehrung: Story = {
  args: { listing: DEMO_LISTINGS[2] },
};

// Kein hinterlegter Preis → „Preis auf Anfrage" (kein erfundener Wert).
export const PreisAufAnfrage: Story = {
  args: { listing: DEMO_LISTINGS[3] },
};
