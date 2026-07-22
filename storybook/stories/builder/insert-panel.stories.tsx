import type { Meta, StoryObj } from "@storybook/react";

import { InsertPanel } from "@/components/builder/insert-panel";

/**
 * Insert-Modus des Page-Builders.
 *
 * Beim Klick auf „+" in der Toolbar wechselt die linke Sidebar in diesen
 * Modus (kein Popup, wie in Framer): links die Kategorien (Elements/CMS),
 * rechts das Kachel-Grid der Bausteine. Die Buchungs-Bausteine (Suche,
 * Objekt-Grid) sind grün markiert — die Buchungs-Engine ist ein einbettbarer
 * Block, kein separates System. Suche filtert über alle Kategorien.
 */
const meta = {
  title: "Page-Builder/Insert-Panel",
  component: InsertPanel,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta<typeof InsertPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Standard: Story = {
  args: {
    onInsert: (label: string) => console.log("Baustein einfügen:", label),
  },
};
