import type { Meta, StoryObj } from "@storybook/react";
import { Icon } from "@iconify/react";

import { Checkbox } from "./checkbox";
import { Label } from "./label";

const meta = {
  title: "UI-Bausteine/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  argTypes: {
    checked: {
      control: "select",
      options: [false, true, "indeterminate"],
      description: "Gesteuerter Zustand (aus / an / unbestimmt)",
    },
    disabled: { control: "boolean", description: "Deaktiviert" },
  },
  args: {
    "aria-label": "Auswahl umschalten",
  },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

// Standard: ungesteuert, leer
export const Standard: Story = {};

// Angehakt (gesteuert)
export const Angehakt: Story = {
  args: { checked: true },
};

// Unbestimmt (indeterminate) — z.B. "alle auswählen" bei Teilauswahl
export const Unbestimmt: Story = {
  args: { checked: "indeterminate" },
};

// Deaktiviert, leer
export const Deaktiviert: Story = {
  args: { disabled: true },
};

// Deaktiviert, angehakt
export const DeaktiviertAngehakt: Story = {
  name: "Deaktiviert (angehakt)",
  args: { disabled: true, checked: true },
};

// Mit Beschriftung — typischer Einsatz im Formular
export const MitBeschriftung: Story = {
  name: "Mit Beschriftung",
  render: (args) => (
    <div className="flex items-center gap-2">
      <Checkbox id="agb" {...args} />
      <Label htmlFor="agb">Ich akzeptiere die AGB</Label>
    </div>
  ),
};

// Mehrere Optionen — z.B. Ausstattungs-Filter einer Unterkunft
export const Optionsliste: Story = {
  name: "Optionsliste",
  render: () => (
    <div className="flex w-72 flex-col gap-3">
      <div className="flex items-center gap-2">
        <Checkbox id="opt-wlan" defaultChecked />
        <Label htmlFor="opt-wlan" className="font-normal">
          <Icon icon="ph:wifi-high" className="h-4 w-4 text-muted-foreground" />
          WLAN inklusive
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="opt-pet" />
        <Label htmlFor="opt-pet" className="font-normal">
          <Icon icon="ph:paw-print" className="h-4 w-4 text-muted-foreground" />
          Haustiere erlaubt
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="opt-pool" defaultChecked />
        <Label htmlFor="opt-pool" className="font-normal">
          <Icon icon="ph:swimming-pool" className="h-4 w-4 text-muted-foreground" />
          Pool vorhanden
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="opt-sauna" disabled />
        <Label htmlFor="opt-sauna" className="font-normal">
          <Icon icon="ph:thermometer-hot" className="h-4 w-4 text-muted-foreground" />
          Sauna (nicht buchbar)
        </Label>
      </div>
    </div>
  ),
};

// Alle Zustände nebeneinander zur Übersicht
export const AlleZustaende: Story = {
  name: "Alle Zustände",
  render: () => (
    <div className="flex items-center gap-6">
      <div className="flex flex-col items-center gap-2">
        <Checkbox aria-label="Leer" />
        <span className="text-xs text-muted-foreground">Leer</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Checkbox checked aria-label="Angehakt" />
        <span className="text-xs text-muted-foreground">Angehakt</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Checkbox checked="indeterminate" aria-label="Unbestimmt" />
        <span className="text-xs text-muted-foreground">Unbestimmt</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Checkbox disabled aria-label="Deaktiviert" />
        <span className="text-xs text-muted-foreground">Deaktiviert</span>
      </div>
    </div>
  ),
};
