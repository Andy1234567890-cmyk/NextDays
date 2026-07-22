import type { Meta, StoryObj } from "@storybook/react";

import { InsertMenu } from "@/components/builder/insert-menu";

/**
 * Einfügen-Menü des Page-Builders (Framer-„Layout"-Dropdown).
 *
 * Öffnet sich über das Auswahl-Werkzeug in der Toolbar: Frame · Stack ·
 * Grid · Masonry als Layout-Primitive, darunter Image · Video als
 * Medien-Blöcke — mit Original-Icons und Tastatur-Shortcuts. „Frame" wird
 * im Produkt per Fadenkreuz auf der Canvas aufgezogen.
 */
const meta = {
  title: "Page-Builder/Einfügen-Menü",
  component: InsertMenu,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta<typeof InsertMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Standard: Story = {
  args: {
    onPick: (label: string) => console.log("Einfügen:", label),
  },
};
