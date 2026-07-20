import type { Meta, StoryObj } from "@storybook/react";

import { ReiseInspirationen } from "@/components/plattform/reise-inspirationen";

/**
 * „Inspirationen für zukünftige Reisen" (Teil des Footers).
 *
 * Tab-Filter (Beliebt / An der Küste / Historisch / …) + Raster aus Reiseziel-
 * Vorschlägen (Ort + Unterkunftstyp). Die Ziele sind Platzhalter bis zur
 * Backend-Anbindung.
 */
const meta = {
  title: "Plattform (Marktplatz)/Reise-Inspirationen",
  component: ReiseInspirationen,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ReiseInspirationen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Standard: Story = {};
