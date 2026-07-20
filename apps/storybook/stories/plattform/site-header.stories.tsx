import type { Meta, StoryObj } from "@storybook/react";

import { SiteHeader } from "@/components/plattform/site-header";

/**
 * Kopfzeile der Plattform.
 *
 * Schlanke Sticky-Leiste mit Logo, Such-Pille (ausblendbar via `compact`) und
 * Konto-Aktion. Wird auf Unterseiten (Inserat, Checkout) verwendet; die Startseite
 * nutzt die reichere `PlattformNav`.
 */
const meta = {
  title: "Plattform/Kopfzeile",
  component: SiteHeader,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SiteHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MitSuche: Story = { args: { compact: false } };
export const Kompakt: Story = { args: { compact: true } };
