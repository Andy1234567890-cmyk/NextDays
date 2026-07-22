import type { Meta, StoryObj } from "@storybook/react";

import type { LayerNode } from "@/components/builder/layer-tree";
import { type PageEntry, PagesPanel } from "@/components/builder/pages-panel";

/**
 * Linkes Panel des Page-Builders (Framer-Stil).
 *
 * Drei Tabs: **Pages** (Abschnitte „Design" + Seitenliste mit Home-Symbol
 * und Entwurf-Kennzeichnung), **Layers** (Ebenen-Baum der aktiven Seite)
 * und **Assets** (Baustein-Katalog als Kacheln). Im Produkt navigiert der
 * Seitenklick zum Editor der jeweiligen Seite; „+" legt eine neue Seite an.
 */
const meta = {
  title: "Page-Builder/Seiten-Panel",
  component: PagesPanel,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta<typeof PagesPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

const PAGES: PageEntry[] = [
  { id: "home", title: "Home", isHome: true, published: true },
  { id: "haeuser", title: "Ferienhäuser", published: true },
  { id: "region", title: "Region & Ausflüge", published: true },
  { id: "ueber-uns", title: "Über uns", published: false },
  { id: "kontakt", title: "Kontakt", published: false },
];

const LAYERS: LayerNode[] = [
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
      { id: "kontakt", name: "Kontakt" },
    ],
  },
];

export const Seitenliste: Story = {
  args: {
    pages: PAGES,
    activeId: "home",
    layers: LAYERS,
    onOpenPage: (id: string) => console.log("Seite öffnen:", id),
    onAddPage: () => console.log("Neue Seite"),
    onInsert: (label: string) => console.log("Baustein:", label),
  },
};

export const EineSeite: Story = {
  args: {
    pages: [{ id: "home", title: "Home", isHome: true, published: false }],
    activeId: "home",
    layers: LAYERS,
  },
};
