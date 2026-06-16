import { Icon } from "@iconify/react";
import type { Meta, StoryObj } from "@storybook/react";

import { Label, LabelRequired } from "./label";

const meta: Meta<typeof Label> = {
  title: "UI-Bausteine/Label",
  component: Label,
  tags: ["autodocs"],
  args: {
    children: "E-Mail-Adresse",
    htmlFor: "email",
  },
};

export default meta;
type Story = StoryObj<typeof Label>;

// Standard-Label, mit Eingabefeld verknüpft.
export const Standard: Story = {
  render: (args) => (
    <div className="flex flex-col gap-2">
      <Label {...args} />
      <input
        id="email"
        type="email"
        placeholder="gast@beispiel.de"
        className="h-10 rounded-(--radius) border border-border bg-background px-3 text-sm"
      />
    </div>
  ),
};

// Pflichtfeld mit Sternchen-Markierung.
export const Pflichtfeld: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <Label htmlFor="name">
        Nachname <LabelRequired />
      </Label>
      <input
        id="name"
        type="text"
        placeholder="Mustermann"
        className="h-10 rounded-(--radius) border border-border bg-background px-3 text-sm"
      />
    </div>
  ),
};

// Label mit Icon zur Verdeutlichung.
export const MitIcon: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <Label htmlFor="ankunft">
        <Icon icon="ph:calendar-blank" className="size-4 text-muted-foreground" />
        Anreisedatum
      </Label>
      <input
        id="ankunft"
        type="date"
        className="h-10 rounded-(--radius) border border-border bg-background px-3 text-sm"
      />
    </div>
  ),
};

// Checkbox-Variante: Label neben dem Bedienelement.
export const NebenCheckbox: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <input
        id="agb"
        type="checkbox"
        className="size-4 rounded-(--radius) border border-border"
      />
      <Label htmlFor="agb">AGB akzeptieren</Label>
    </div>
  ),
};

// Deaktivierter Zustand: ausgegrautes Label via peer-Selektor.
export const Deaktiviert: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <input
        id="gesperrt"
        type="text"
        disabled
        placeholder="Nicht verfügbar"
        className="peer h-10 rounded-(--radius) border border-border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
      />
      <Label htmlFor="gesperrt" className="order-first">
        Gesperrtes Feld
      </Label>
    </div>
  ),
};
