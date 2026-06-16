import type { Meta, StoryObj } from "@storybook/react";
import { Icon } from "@iconify/react";

import { Separator } from "./separator";

const meta = {
  title: "UI-Bausteine/Separator",
  component: Separator,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Trennlinie auf Basis von Radix Separator. Unterstützt horizontale und vertikale Ausrichtung sowie semantische (nicht-dekorative) Nutzung.",
      },
    },
  },
  argTypes: {
    orientation: {
      control: "radio",
      options: ["horizontal", "vertical"],
      description: "Ausrichtung der Trennlinie.",
    },
    decorative: {
      control: "boolean",
      description:
        "Wenn true, rein dekorativ (kein semantischer Hinweis für Screenreader).",
    },
  },
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

// Standard: horizontale Trennlinie zwischen zwei Textblöcken.
export const Standard: Story = {
  args: { orientation: "horizontal", decorative: true },
  render: (args) => (
    <div className="w-80 text-foreground">
      <div className="space-y-1">
        <h4 className="text-sm font-medium">Buchungsdetails</h4>
        <p className="text-sm text-muted-foreground">
          Übersicht zur aktuellen Reservierung.
        </p>
      </div>
      <Separator {...args} className="my-4" />
      <p className="text-sm text-muted-foreground">Gast: Maria Sørensen</p>
    </div>
  ),
};

// Horizontale Trennlinie in einer Liste von Abschnitten.
export const Horizontal: Story = {
  args: { orientation: "horizontal" },
  render: (args) => (
    <div className="w-80 rounded-(--radius) border border-border bg-background p-4 text-foreground">
      <p className="text-sm">Anreise</p>
      <Separator {...args} className="my-3" />
      <p className="text-sm">Abreise</p>
      <Separator {...args} className="my-3" />
      <p className="text-sm">Reinigung</p>
    </div>
  ),
};

// Vertikale Trennlinie in einer horizontalen Aktionsleiste.
export const Vertikal: Story = {
  args: { orientation: "vertical" },
  render: (args) => (
    <div className="flex h-6 items-center gap-3 text-sm text-foreground">
      <span>Kalender</span>
      <Separator {...args} />
      <span>Reservierungen</span>
      <Separator {...args} />
      <span>Aufgaben</span>
    </div>
  ),
};

// Vertikale Trennlinie zwischen Icon-Buttons.
export const VertikalMitIcons: Story = {
  args: { orientation: "vertical" },
  render: (args) => (
    <div className="flex h-8 items-center gap-3 text-foreground">
      <Icon icon="ph:calendar-blank" className="h-5 w-5" />
      <Separator {...args} />
      <Icon icon="ph:bed" className="h-5 w-5" />
      <Separator {...args} />
      <Icon icon="ph:broom" className="h-5 w-5" />
    </div>
  ),
};

// Semantischer Separator (decorative=false) als echte Bereichstrennung.
export const Semantisch: Story = {
  args: { orientation: "horizontal", decorative: false },
  render: (args) => (
    <div className="w-80 text-foreground">
      <p className="text-sm text-muted-foreground">Eigentümer-Daten</p>
      <Separator {...args} className="my-4" />
      <p className="text-sm text-muted-foreground">Finanz-Daten</p>
    </div>
  ),
};
