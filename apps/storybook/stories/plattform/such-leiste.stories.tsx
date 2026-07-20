import type { Meta, StoryObj } from "@storybook/react";

import { SuchLeiste } from "@/components/plattform/such-leiste";

/**
 * Such-Leiste des Marktplatzes.
 *
 * Drei Felder (Wohin / Wann / Wer) in einer Pille + runder Such-Button. Klick
 * auf „Wohin" öffnet ein Dropdown mit vorgeschlagenen Reisezielen; „In der Nähe"
 * fragt in der App den Standort ab. In der Werkstatt ist die Suche ein No-op
 * (kein App-Router).
 */
const meta = {
  title: "Plattform (Marktplatz)/Such-Leiste",
  component: SuchLeiste,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="min-h-[28rem] px-6 pt-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SuchLeiste>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Standard: Story = {};
