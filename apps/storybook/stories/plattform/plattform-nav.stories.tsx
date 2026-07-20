import type { Meta, StoryObj } from "@storybook/react";

import { PlattformNav } from "@/components/plattform/plattform-nav";

/**
 * Haupt-Navigation der Plattform-Startseite.
 *
 * Kopfzeile (Logo + Konto) + Tab-Zeile (Unterkünfte / Erlebnisse / Services) +
 * große Such-Leiste + Kategorie-Leiste als ein Block. In der App kollabiert die
 * große Leiste beim Scrollen animiert zu einer kompakten Such-Pille; in der
 * Werkstatt sind die Zustände ohne Animation gerendert (motion nicht verfügbar).
 */
const meta = {
  title: "Plattform/Navigation",
  component: PlattformNav,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      // Zusätzliche Höhe, damit das Scroll-Kollabieren im Canvas nachvollziehbar ist.
      <div className="min-h-[150vh]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PlattformNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Standard: Story = {};
