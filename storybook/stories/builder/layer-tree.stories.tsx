import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { LayerTree, type LayerNode } from "@/components/builder/layer-tree";

/**
 * Ebenen-Baum des Page-Builders (Framer-Stil).
 *
 * Zeigt den Node-Baum der aktiven Seite: Wurzel „Seite", darunter Blöcke
 * (Hero, Text, Objekt-Grid, …) und Layout-Container (Frame, Stack, Grid,
 * Masonry) mit ihren Kindern. Klick selektiert, Caret klappt auf/zu.
 * Im Produkt liefert @craftjs/layers die Daten; hier kommen sie als Props.
 */
const meta = {
  title: "Page-Builder/Ebenen-Baum",
  component: LayerTree,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-64 rounded-xl border border-border bg-card py-2">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LayerTree>;

export default meta;
type Story = StoryObj<typeof meta>;

// Typische Ferienhaus-Startseite: Hero, Suche, Objekt-Grid, Kontakt.
const SEITE: LayerNode[] = [
  {
    id: "root",
    name: "Seite",
    children: [
      { id: "hero", name: "Hero" },
      { id: "suche", name: "Suche" },
      {
        id: "frame-1",
        name: "Frame",
        children: [
          { id: "text-1", name: "Text" },
          { id: "grid-1", name: "Objekt-Grid" },
        ],
      },
      {
        id: "stack-1",
        name: "Stack",
        children: [
          { id: "bild-1", name: "Bild" },
          { id: "bild-2", name: "Bild" },
          { id: "button-1", name: "Button" },
        ],
      },
      { id: "kontakt", name: "Kontakt" },
    ],
  },
];

export const Standard: Story = {
  args: { nodes: SEITE },
};

export const MitSelektion: Story = {
  args: { nodes: SEITE, selectedId: "grid-1" },
};

export const FlacheSeite: Story = {
  args: {
    nodes: [
      {
        id: "root",
        name: "Seite",
        children: [
          { id: "hero", name: "Hero" },
          { id: "text", name: "Text" },
          { id: "galerie", name: "Galerie" },
          { id: "abstand", name: "Abstand" },
          { id: "kontakt", name: "Kontakt" },
        ],
      },
    ],
  },
};

export const Interaktiv: Story = {
  args: { nodes: SEITE },
  render: () => {
    const [selected, setSelected] = useState<string | null>("hero");
    return <LayerTree nodes={SEITE} selectedId={selected} onSelect={setSelected} />;
  },
};
