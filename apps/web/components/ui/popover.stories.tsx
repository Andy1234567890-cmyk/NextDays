import { Icon } from "@iconify/react";
import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const meta: Meta<typeof Popover> = {
  title: "UI-Bausteine/Popover",
  component: Popover,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof Popover>;

// Standard: einfacher Auslöser mit kurzem Inhalt.
export const Standard: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Details anzeigen</Button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="space-y-1">
          <p className="text-sm font-medium">Reservierung</p>
          <p className="text-sm text-muted-foreground">
            Bestätigt für 3 Nächte ab dem 14. Juni 2026.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  ),
};

// Mit Formularfeldern: typischer Einstellungs-Popover.
export const MitFormular: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <Icon icon="ph:sliders-horizontal" />
          Preis anpassen
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">Netto pro Nacht</p>
            <p className="text-sm text-muted-foreground">
              Glatte Beträge, ohne Cent.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              defaultValue="1.250"
              className="h-9 w-full rounded-(--radius) border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span className="text-sm text-muted-foreground">€</span>
          </div>
          <div className="flex justify-end gap-2">
            <PopoverClose asChild>
              <Button variant="ghost" size="sm">
                Abbrechen
              </Button>
            </PopoverClose>
            <PopoverClose asChild>
              <Button size="sm">Speichern</Button>
            </PopoverClose>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  ),
};

// Mit Schließen-Icon: Inhalt mit eigenem Schließen-Knopf.
export const MitSchliessenIcon: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Hinweise">
          <Icon icon="ph:info" />
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="text-sm font-medium">Hinweis</p>
            <p className="text-sm text-muted-foreground">
              Eigentümer sehen nur den Vornamen des Gastes.
            </p>
          </div>
          <PopoverClose asChild>
            <Button variant="ghost" size="icon" aria-label="Schließen">
              <Icon icon="ph:x" />
            </Button>
          </PopoverClose>
        </div>
      </PopoverContent>
    </Popover>
  ),
};

// Ausrichtung: Inhalt oben und linksbündig ausgerichtet.
export const AusrichtungOben: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="accent">Optionen</Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start">
        <div className="space-y-1">
          <p className="text-sm font-medium">Kanal</p>
          <p className="text-sm text-muted-foreground">
            Direkt, Booking oder Airbnb auswählen.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  ),
};

// Standardmäßig geöffnet: zeigt den geöffneten Zustand in der Doku.
export const StandardmaessigGeoeffnet: Story = {
  render: () => (
    <Popover defaultOpen>
      <PopoverTrigger asChild>
        <Button variant="outline">Geöffnet</Button>
      </PopoverTrigger>
      <PopoverContent align="start">
        <p className="text-sm text-muted-foreground">
          Dieser Popover ist beim Laden bereits sichtbar.
        </p>
      </PopoverContent>
    </Popover>
  ),
};
