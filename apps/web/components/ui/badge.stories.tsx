import type { Meta, StoryObj } from "@storybook/react";
import { Icon } from "@iconify/react";

import { Badge } from "./badge";

const meta = {
  title: "UI-Bausteine/Badge",
  component: Badge,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "secondary",
        "outline",
        "destructive",
        "success",
        "warning",
      ],
    },
  },
  args: { children: "Badge" },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

// Standard-Variante.
export const Standard: Story = {
  args: { children: "Standard" },
};

// Sekundär — dezente Hervorhebung.
export const Sekundaer: Story = {
  args: { variant: "secondary", children: "Sekundär" },
};

// Umriss ohne Füllung.
export const Umriss: Story = {
  args: { variant: "outline", children: "Umriss" },
};

// Destruktiv — Fehler/Abbruch.
export const Destruktiv: Story = {
  args: { variant: "destructive", children: "Storniert" },
};

// Erfolg — bestätigt/erledigt.
export const Erfolg: Story = {
  args: { variant: "success", children: "Bestätigt" },
};

// Warnung — ausstehend/Achtung.
export const Warnung: Story = {
  args: { variant: "warning", children: "Ausstehend" },
};

// Badge mit Icon (Iconify ph:*).
export const MitIcon: Story = {
  args: {
    variant: "success",
    children: (
      <>
        <Icon icon="ph:check-circle" className="size-3.5" />
        Erledigt
      </>
    ),
  },
};

// Alle Varianten nebeneinander.
export const AlleVarianten: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="default">Standard</Badge>
      <Badge variant="secondary">Sekundär</Badge>
      <Badge variant="outline">Umriss</Badge>
      <Badge variant="destructive">Destruktiv</Badge>
      <Badge variant="success">Erfolg</Badge>
      <Badge variant="warning">Warnung</Badge>
    </div>
  ),
};

// Realistische Reservierungs-Status (echte Enum-Werte).
export const Reservierungsstatus: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="warning">Ausstehend</Badge>
      <Badge variant="success">Bestätigt</Badge>
      <Badge variant="secondary">Storniert</Badge>
      <Badge variant="default">Abgeschlossen</Badge>
    </div>
  ),
};
