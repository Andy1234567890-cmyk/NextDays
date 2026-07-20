import type { Meta, StoryObj } from "@storybook/react";

import { ListingReihe } from "@/components/plattform/listing-reihe";
import { DEMO_REIHE } from "@/components/plattform/_fixtures";

/**
 * Themen-Reihe der Startseite (Marktplatz).
 *
 * Überschrift + horizontal scrollbares Band aus Inserat-Karten, Pfeil-Buttons
 * (erscheinen beim Hover) und eine „Alle anzeigen"-Abschlusskarte mit Foto-Stack
 * der ersten drei Inserate. Mehrere solcher Reihen bilden die Startseite.
 */
const meta = {
  title: "Plattform (Marktplatz)/Themen-Reihe",
  component: ListingReihe,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="px-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ListingReihe>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Standard: Story = {
  args: { reihe: DEMO_REIHE },
};
