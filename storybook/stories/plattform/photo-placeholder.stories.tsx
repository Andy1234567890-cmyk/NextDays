import type { Meta, StoryObj } from "@storybook/react";

import { PhotoPlaceholder } from "@/components/plattform/photo-placeholder";

/**
 * Bild-Platzhalter der Plattform.
 *
 * Erzeugt aus dem Listing-Farbton (hue, deterministisch aus der Objekt-ID) einen
 * ruhigen Farbverlauf mit dezentem Foto-Symbol — überall dort, wo ein Objekt
 * (noch) keine echten Fotos hat. Optionales Label unten links.
 */
const meta = {
  title: "Plattform/Foto-Platzhalter",
  component: PhotoPlaceholder,
  tags: ["autodocs"],
  argTypes: {
    hue: { control: { type: "range", min: 0, max: 360, step: 1 } },
  },
  decorators: [
    (Story) => (
      <div className="size-64 overflow-hidden rounded-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PhotoPlaceholder>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Blau: Story = { args: { hue: 210, className: "size-full" } };
export const Warm: Story = { args: { hue: 40, className: "size-full" } };
export const MitLabel: Story = {
  args: { hue: 280, className: "size-full", label: "Kein Foto" },
};
