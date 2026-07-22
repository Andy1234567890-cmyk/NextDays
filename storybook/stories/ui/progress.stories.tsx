// Stories für das UI-Primitiv "Progress" (Storybook 8, react-vite).
import type { Meta, StoryObj } from "@storybook/react";
import { Icon } from "@iconify/react";

import { Progress } from "@/components/ui/progress";

const meta = {
  title: "UI-Bausteine/Progress",
  component: Progress,
  tags: ["autodocs"],
  argTypes: {
    value: { control: { type: "range", min: 0, max: 100, step: 1 } },
    max: { control: { type: "number" } },
    size: {
      control: "inline-radio",
      options: ["sm", "default", "lg"],
    },
    variant: {
      control: "inline-radio",
      options: ["default", "accent", "success", "warning", "destructive"],
    },
  },
  args: { value: 60 },
  decorators: [
    (Story) => (
      <div className="w-80 max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

// Standard-Zustand: einfacher Balken bei 60 %
export const Standard: Story = {
  args: { value: 60 },
};

// Alle Größen im Vergleich
export const Größen: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Progress size="sm" value={40} />
      <Progress size="default" value={60} />
      <Progress size="lg" value={80} />
    </div>
  ),
};

// Alle Farb-Varianten (über Token-Farben)
export const Varianten: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Progress variant="default" value={70} />
      <Progress variant="accent" value={55} />
      <Progress variant="success" value={100} />
      <Progress variant="warning" value={30} />
      <Progress variant="destructive" value={85} />
    </div>
  ),
};

// Grenzwerte: leer und voll
export const Grenzwerte: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Progress value={0} />
      <Progress value={100} variant="success" />
    </div>
  ),
};

// Werte oberhalb/unterhalb des Bereichs werden geklemmt
export const Geklemmt: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Progress value={-20} />
      <Progress value={150} />
    </div>
  ),
};

// Eigener Maximalwert (z. B. 5 von 8 Schritten)
export const EigenesMaximum: Story = {
  args: { value: 5, max: 8 },
};

// Realistisches Beispiel: Reinigungs-Aufgaben des Tages
export const MitBeschriftung: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 text-foreground">
          <Icon icon="ph:broom" className="h-4 w-4" />
          Reinigungen heute
        </span>
        <span className="text-muted-foreground">9 von 12</span>
      </div>
      <Progress value={9} max={12} variant="success" />
    </div>
  ),
};
