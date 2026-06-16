import type { Meta, StoryObj } from "@storybook/react";
import { Icon } from "@iconify/react";

import { Switch } from "@/components/ui/switch";

const meta = {
  title: "UI-Bausteine/Switch",
  component: Switch,
  tags: ["autodocs"],
  argTypes: {
    checked: { control: "boolean", description: "Gesteuerter Zustand (ein/aus)" },
    disabled: { control: "boolean", description: "Deaktiviert" },
  },
  args: {
    "aria-label": "Schalter umschalten",
  },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

// Standard: ungesteuert, aus
export const Standard: Story = {};

// Eingeschaltet (gesteuert)
export const Eingeschaltet: Story = {
  args: { checked: true },
};

// Deaktiviert, aus
export const Deaktiviert: Story = {
  args: { disabled: true },
};

// Deaktiviert, ein
export const DeaktiviertEin: Story = {
  name: "Deaktiviert (ein)",
  args: { disabled: true, checked: true },
};

// Mit Beschriftung und Icon — typischer Einsatz in den Einstellungen
export const MitBeschriftung: Story = {
  name: "Mit Beschriftung",
  render: (args) => (
    <label className="flex items-center gap-3 text-sm font-medium text-foreground">
      <Switch {...args} />
      <span className="flex items-center gap-2">
        <Icon icon="ph:bell" className="h-4 w-4 text-muted-foreground" />
        Benachrichtigungen aktivieren
      </span>
    </label>
  ),
};

// Mehrere Schalter — z.B. Eigenschafts-Optionen
export const Liste: Story = {
  render: () => (
    <div className="flex w-72 flex-col gap-4">
      <label className="flex items-center justify-between text-sm text-foreground">
        <span>Online-Buchung erlauben</span>
        <Switch defaultChecked aria-label="Online-Buchung erlauben" />
      </label>
      <label className="flex items-center justify-between text-sm text-foreground">
        <span>Haustiere erlaubt</span>
        <Switch aria-label="Haustiere erlaubt" />
      </label>
      <label className="flex items-center justify-between text-sm text-foreground">
        <span>Sofortbestätigung</span>
        <Switch defaultChecked aria-label="Sofortbestätigung" />
      </label>
      <label className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Wartungsmodus (gesperrt)</span>
        <Switch disabled aria-label="Wartungsmodus" />
      </label>
    </div>
  ),
};
