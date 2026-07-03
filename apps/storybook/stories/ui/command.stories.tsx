import type { Meta, StoryObj } from "@storybook/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";

const meta = {
  title: "UI-Bausteine/Command",
  component: Command,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Befehlspalette auf Basis von cmdk: schnelle Suche über Aktionen und Navigation " +
          "(z.B. „Neue Reservierung“, „Gast suchen“). Einträge sind in Gruppen organisiert, " +
          "optional mit Tastatur-Kürzeln. Als Inline-Liste oder als Dialog (⌘K) einsetzbar.",
      },
    },
  },
} satisfies Meta<typeof Command>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Standard: Inline-Befehlspalette mit Gruppen, Icons und Tastatur-Kürzeln. */
export const Standard: Story = {
  render: () => (
    <Command className="w-96 rounded-(--radius) border border-border shadow-sm">
      <CommandInput placeholder="Befehl eingeben oder suchen …" />
      <CommandList>
        <CommandEmpty>Keine Ergebnisse gefunden.</CommandEmpty>
        <CommandGroup heading="Schnellaktionen">
          <CommandItem onSelect={(wert) => console.log("Ausgewählt:", wert)}>
            <Icon icon="ph:calendar-plus" />
            <span>Neue Reservierung</span>
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={(wert) => console.log("Ausgewählt:", wert)}>
            <Icon icon="ph:user-circle" />
            <span>Gast suchen</span>
            <CommandShortcut>⌘G</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={(wert) => console.log("Ausgewählt:", wert)}>
            <Icon icon="ph:check-square" />
            <span>Aufgabe anlegen</span>
            <CommandShortcut>⌘T</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={(wert) => console.log("Ausgewählt:", wert)}>
            <Icon icon="ph:calendar-blank" />
            <span>Multi-Kalender öffnen</span>
          </CommandItem>
          <CommandItem onSelect={(wert) => console.log("Ausgewählt:", wert)}>
            <Icon icon="ph:house-line" />
            <span>Objekte verwalten</span>
          </CommandItem>
          <CommandItem onSelect={(wert) => console.log("Ausgewählt:", wert)}>
            <Icon icon="ph:credit-card" />
            <span>Zahlungen anzeigen</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
};

/** Als Dialog: Palette öffnet sich über einen Auslöser — typisches ⌘K-Muster. */
export const AlsDialog: Story = {
  render: () => {
    const [offen, setOffen] = useState(false);
    return (
      <>
        <Button variant="outline" onClick={() => setOffen(true)}>
          Befehlspalette öffnen
          <span className="text-xs text-muted-foreground">⌘K</span>
        </Button>
        <CommandDialog
          open={offen}
          onOpenChange={setOffen}
          title="Befehlspalette"
          description="Befehl suchen und ausführen"
        >
          <CommandInput placeholder="Wonach suchen Sie?" />
          <CommandList>
            <CommandEmpty>Keine Ergebnisse gefunden.</CommandEmpty>
            <CommandGroup heading="Schnellaktionen">
              <CommandItem onSelect={(wert) => console.log("Ausgewählt:", wert)}>
                <Icon icon="ph:calendar-plus" />
                <span>Neue Reservierung</span>
                <CommandShortcut>⌘N</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={(wert) => console.log("Ausgewählt:", wert)}>
                <Icon icon="ph:user-circle" />
                <span>Gast suchen</span>
                <CommandShortcut>⌘G</CommandShortcut>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Objekte">
              <CommandItem onSelect={(wert) => console.log("Ausgewählt:", wert)}>
                <Icon icon="ph:house-line" />
                <span>Ferienhaus „Strandblick“</span>
              </CommandItem>
              <CommandItem onSelect={(wert) => console.log("Ausgewählt:", wert)}>
                <Icon icon="ph:building-apartment" />
                <span>Appartement „Hafenkante“</span>
              </CommandItem>
              <CommandItem onSelect={(wert) => console.log("Ausgewählt:", wert)}>
                <Icon icon="ph:tent" />
                <span>Glamping „Dünenzelt“</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </CommandDialog>
      </>
    );
  },
};

/** Deaktivierte Einträge: Aktionen ohne Berechtigung bleiben sichtbar, sind aber gesperrt. */
export const DeaktivierteEintraege: Story = {
  render: () => (
    <Command className="w-96 rounded-(--radius) border border-border shadow-sm">
      <CommandInput placeholder="Befehl eingeben oder suchen …" />
      <CommandList>
        <CommandEmpty>Keine Ergebnisse gefunden.</CommandEmpty>
        <CommandGroup heading="Finanzen (nur Admin)">
          <CommandItem onSelect={(wert) => console.log("Ausgewählt:", wert)}>
            <Icon icon="ph:receipt" />
            <span>Provisionen anzeigen</span>
          </CommandItem>
          <CommandItem disabled>
            <Icon icon="ph:export" />
            <span>Auszahlungsbericht exportieren</span>
          </CommandItem>
          <CommandItem disabled>
            <Icon icon="ph:arrow-counter-clockwise" />
            <span>Zahlung erstatten</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
};
