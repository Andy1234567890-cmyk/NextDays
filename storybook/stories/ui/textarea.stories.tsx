import type { Meta, StoryObj } from "@storybook/react";

import { Textarea } from "@/components/ui/textarea";

const meta = {
  title: "UI-Bausteine/Textarea",
  component: Textarea,
  tags: ["autodocs"],
  args: {
    placeholder: "Notiz eingeben …",
  },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

// Standard: leeres Feld mit Platzhalter.
export const Standard: Story = {};

// Mit vorausgefülltem Inhalt.
export const MitInhalt: Story = {
  args: {
    defaultValue:
      "Gast wünscht frühen Check-in ab 12 Uhr. Bitte Reinigung entsprechend einplanen.",
  },
};

// Fehler-Zustand mit destruktiver Hervorhebung.
export const Fehler: Story = {
  args: {
    error: true,
    defaultValue: "Zu kurz.",
  },
};

// Deaktiviert (nicht editierbar).
export const Deaktiviert: Story = {
  args: {
    disabled: true,
    defaultValue: "Dieses Feld ist gesperrt.",
  },
};

// Größeres Feld für ausführliche Beschreibungen.
export const Gross: Story = {
  args: {
    rows: 8,
    placeholder: "Beschreibung der Unterkunft …",
  },
};

// Mit Label und Hilfetext (typischer Formular-Einsatz).
export const MitLabelUndFehler: Story = {
  render: (args) => (
    <div className="flex w-80 flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground" htmlFor="notiz">
        Interne Notiz
      </label>
      <Textarea id="notiz" {...args} />
      <p className="text-xs text-destructive">
        Bitte mindestens 10 Zeichen eingeben.
      </p>
    </div>
  ),
  args: {
    error: true,
    defaultValue: "Kurz",
  },
};
