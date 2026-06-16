import type { Meta, StoryObj } from "@storybook/react";

import { Alert, AlertDescription, AlertTitle } from "./alert";

const meta: Meta<typeof Alert> = {
  title: "UI-Bausteine/Alert",
  component: Alert,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive", "warning"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Alert>;

// Standard-Hinweis (neutral).
export const Standard: Story = {
  render: (args) => (
    <Alert {...args}>
      <AlertTitle>Reservierung bestätigt</AlertTitle>
      <AlertDescription>
        Die Buchung wurde erfolgreich gespeichert und der Zeitraum ist nun blockiert.
      </AlertDescription>
    </Alert>
  ),
};

// Fehler-/Gefahr-Variante.
export const Destruktiv: Story = {
  args: { variant: "destructive" },
  render: (args) => (
    <Alert {...args}>
      <AlertTitle>Zahlung fehlgeschlagen</AlertTitle>
      <AlertDescription>
        Die Anzahlung konnte nicht eingezogen werden. Bitte prüfe die Zahlungsdaten.
      </AlertDescription>
    </Alert>
  ),
};

// Warnhinweis (amber).
export const Warnung: Story = {
  args: { variant: "warning" },
  render: (args) => (
    <Alert {...args}>
      <AlertTitle>Überschneidung erkannt</AlertTitle>
      <AlertDescription>
        Für dieses Objekt existiert bereits eine Sperrung im gewählten Zeitraum.
      </AlertDescription>
    </Alert>
  ),
};

// Nur Titel, ohne Beschreibung.
export const NurTitel: Story = {
  render: (args) => (
    <Alert {...args}>
      <AlertTitle>Synchronisation läuft …</AlertTitle>
    </Alert>
  ),
};

// Eigenes Icon überschreiben.
export const EigenesIcon: Story = {
  args: { icon: "ph:bell" },
  render: (args) => (
    <Alert {...args}>
      <AlertTitle>Neue Vertretungsanfrage</AlertTitle>
      <AlertDescription>
        Eine Reinigungskraft hat eine Vertretung für den 18.06. angefragt.
      </AlertDescription>
    </Alert>
  ),
};

// Ohne Icon (icon={null}).
export const OhneIcon: Story = {
  args: { icon: null },
  render: (args) => (
    <Alert {...args}>
      <AlertTitle>Entwurf gespeichert</AlertTitle>
      <AlertDescription>Dein Objekt-Entwurf wurde automatisch gesichert.</AlertDescription>
    </Alert>
  ),
};

// Alle Varianten im Überblick.
export const AlleVarianten: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Alert variant="default">
        <AlertTitle>Information</AlertTitle>
        <AlertDescription>Allgemeiner Hinweis zum Vorgang.</AlertDescription>
      </Alert>
      <Alert variant="warning">
        <AlertTitle>Warnung</AlertTitle>
        <AlertDescription>Etwas erfordert deine Aufmerksamkeit.</AlertDescription>
      </Alert>
      <Alert variant="destructive">
        <AlertTitle>Fehler</AlertTitle>
        <AlertDescription>Eine Aktion ist fehlgeschlagen.</AlertDescription>
      </Alert>
    </div>
  ),
};
