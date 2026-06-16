import type { Meta, StoryObj } from "@storybook/react";

import { Input } from "./input";

const meta = {
  title: "UI-Bausteine/Input",
  component: Input,
  tags: ["autodocs"],
  argTypes: {
    type: {
      control: "select",
      options: ["text", "email", "number", "password"],
      description: "Eingabe-Typ",
    },
    error: { control: "boolean", description: "Fehler-Zustand" },
    disabled: { control: "boolean", description: "Deaktiviert" },
    placeholder: { control: "text" },
  },
  args: {
    type: "text",
    placeholder: "Gästename eingeben …",
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

// Standard-Texteingabe.
export const Standard: Story = {};

// E-Mail-Eingabe.
export const EMail: Story = {
  args: {
    type: "email",
    placeholder: "gast@beispiel.de",
  },
};

// Zahleneingabe (z. B. Anzahl Nächte).
export const Zahl: Story = {
  args: {
    type: "number",
    placeholder: "Anzahl Nächte",
  },
};

// Passwort-Eingabe.
export const Passwort: Story = {
  args: {
    type: "password",
    placeholder: "Passwort",
  },
};

// Fehler-Zustand mit rotem Rahmen.
export const Fehler: Story = {
  args: {
    type: "email",
    error: true,
    defaultValue: "keine-gueltige-mail",
    placeholder: "gast@beispiel.de",
  },
};

// Deaktivierter Zustand.
export const Deaktiviert: Story = {
  args: {
    disabled: true,
    defaultValue: "Nicht bearbeitbar",
  },
};

// Übersicht aller Zustände.
export const AlleZustaende: Story = {
  render: () => (
    <div className="flex w-80 flex-col gap-3">
      <Input placeholder="Standard" />
      <Input type="email" placeholder="gast@beispiel.de" />
      <Input type="number" placeholder="Anzahl Nächte" />
      <Input type="password" placeholder="Passwort" />
      <Input error defaultValue="Fehlerhafte Eingabe" />
      <Input disabled defaultValue="Deaktiviert" />
    </div>
  ),
};
