import type { Meta, StoryObj } from "@storybook/react";
import { Icon } from "@iconify/react";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const meta = {
  title: "UI-Bausteine/Tabs",
  component: Tabs,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Tabs-Primitiv auf Basis von Radix. Gliedert Inhalte in Reiter, nur semantische Token-Klassen.",
      },
    },
  },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

// Standard: zwei einfache Reiter.
export const Standard: Story = {
  render: () => (
    <Tabs defaultValue="uebersicht" className="w-[420px]">
      <TabsList>
        <TabsTrigger value="uebersicht">Übersicht</TabsTrigger>
        <TabsTrigger value="details">Details</TabsTrigger>
      </TabsList>
      <TabsContent value="uebersicht">
        Allgemeine Informationen zur Unterkunft auf einen Blick.
      </TabsContent>
      <TabsContent value="details">
        Ausführliche Beschreibung, Ausstattung und Hausregeln.
      </TabsContent>
    </Tabs>
  ),
};

// Mit Icons: Reiter mit Iconify-Symbolen (ph:*).
export const MitIcons: Story = {
  render: () => (
    <Tabs defaultValue="kalender" className="w-[480px]">
      <TabsList>
        <TabsTrigger value="kalender">
          <Icon icon="ph:calendar-blank" />
          Kalender
        </TabsTrigger>
        <TabsTrigger value="gaeste">
          <Icon icon="ph:users" />
          Gäste
        </TabsTrigger>
        <TabsTrigger value="zahlungen">
          <Icon icon="ph:credit-card" />
          Zahlungen
        </TabsTrigger>
      </TabsList>
      <TabsContent value="kalender">
        Belegung und Verfügbarkeit über alle Objekte.
      </TabsContent>
      <TabsContent value="gaeste">
        Gästeliste mit Vornamen und Aufenthaltszeitraum.
      </TabsContent>
      <TabsContent value="zahlungen">
        Anzahlungen und Restbeträge, z. B. 1.250 € pro Buchung.
      </TabsContent>
    </Tabs>
  ),
};

// Drei Reiter: längere Beschriftungen für eine Reservierungsansicht.
export const DreiReiter: Story = {
  render: () => (
    <Tabs defaultValue="anfrage" className="w-[560px]">
      <TabsList>
        <TabsTrigger value="anfrage">Anfrage</TabsTrigger>
        <TabsTrigger value="bestaetigt">Bestätigt</TabsTrigger>
        <TabsTrigger value="abgeschlossen">Abgeschlossen</TabsTrigger>
      </TabsList>
      <TabsContent value="anfrage">
        Offene Anfragen, die noch auf eine Bestätigung warten.
      </TabsContent>
      <TabsContent value="bestaetigt">
        Bestätigte Reservierungen mit fixem Zeitraum.
      </TabsContent>
      <TabsContent value="abgeschlossen">
        Abgeschlossene Aufenthalte inklusive Abrechnung.
      </TabsContent>
    </Tabs>
  ),
};

// Mit deaktiviertem Reiter.
export const MitDeaktiviert: Story = {
  render: () => (
    <Tabs defaultValue="aktiv" className="w-[420px]">
      <TabsList>
        <TabsTrigger value="aktiv">Aktiv</TabsTrigger>
        <TabsTrigger value="entwurf">Entwurf</TabsTrigger>
        <TabsTrigger value="archiv" disabled>
          Archiv
        </TabsTrigger>
      </TabsList>
      <TabsContent value="aktiv">
        Aktive Objekte, die für Buchungen freigeschaltet sind.
      </TabsContent>
      <TabsContent value="entwurf">
        Entwürfe, die noch nicht veröffentlicht wurden.
      </TabsContent>
      <TabsContent value="archiv">
        Archivierte Objekte (derzeit nicht verfügbar).
      </TabsContent>
    </Tabs>
  ),
};
