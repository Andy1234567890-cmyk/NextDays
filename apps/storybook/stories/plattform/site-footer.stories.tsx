import type { Meta, StoryObj } from "@storybook/react";

import { SiteFooter } from "@/components/plattform/site-footer";

/**
 * Fußzeile der Plattform.
 *
 * Reise-Inspirationen oben, darunter Link-Spalten (Unterstützung / Gastgeben /
 * myNextDays) und unten die Rechts-/Sprachleiste. Rechtslinks ohne echtes Ziel
 * bleiben bewusst nicht verlinkt (keine toten „#"-Links vortäuschen).
 */
const meta = {
  title: "Plattform/Fußzeile",
  component: SiteFooter,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SiteFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Standard: Story = {};
