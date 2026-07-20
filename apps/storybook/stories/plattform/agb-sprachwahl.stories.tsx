import type { Meta, StoryObj } from "@storybook/react";

import { AgbSprachwahl } from "@/components/plattform/agb-sprachwahl";

/**
 * Sprachauswahl der AGB-Seite (Marktplatz).
 *
 * Dropdown über alle 24 EU-Amtssprachen (Anzeigename in der jeweiligen Sprache
 * selbst). In der App navigiert die Auswahl per `?sprache=…` und die Seite
 * rendert die gewählte Sprachfassung serverseitig; in der Werkstatt wird die
 * Auswahl nur lokal gehalten.
 */
const meta = {
  title: "Plattform (Marktplatz)/AGB-Sprachwahl",
  component: AgbSprachwahl,
  tags: ["autodocs"],
} satisfies Meta<typeof AgbSprachwahl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Deutsch: Story = { args: { aktuell: "de" } };
export const English: Story = { args: { aktuell: "en" } };
