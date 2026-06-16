// Storybook-Stories für das Tooltip-Primitiv (UI-Bausteine).
// Provider wird pro Story als Decorator bereitgestellt; deutsche Texte.
import type { Meta, StoryObj } from "@storybook/react";
import { Icon } from "@iconify/react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const meta = {
  title: "UI-Bausteine/Tooltip",
  component: Tooltip,
  tags: ["autodocs"],
  // Provider mit kurzer Verzögerung umschließt alle Stories.
  decorators: [
    (Story) => (
      <TooltipProvider delayDuration={200}>
        <div className="flex min-h-32 items-center justify-center p-10">
          <Story />
        </div>
      </TooltipProvider>
    ),
  ],
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

// Standard: Text-Auslöser mit einfachem Hinweis.
export const Standard: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline">Mit der Maus hierher</Button>
      </TooltipTrigger>
      <TooltipContent>Buchung bestätigen</TooltipContent>
    </Tooltip>
  ),
};

// Icon-Schaltfläche als Auslöser (z. B. in einer Werkzeugleiste).
export const MitIcon: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Eigenschaften bearbeiten">
          <Icon icon="ph:pencil-simple" className="size-5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Eigenschaften bearbeiten</TooltipContent>
    </Tooltip>
  ),
};

// Ausrichtung an allen vier Seiten.
export const Seiten: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-6">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline">Oben</Button>
        </TooltipTrigger>
        <TooltipContent side="top">Hinweis oben</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline">Rechts</Button>
        </TooltipTrigger>
        <TooltipContent side="right">Hinweis rechts</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline">Unten</Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Hinweis unten</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline">Links</Button>
        </TooltipTrigger>
        <TooltipContent side="left">Hinweis links</TooltipContent>
      </Tooltip>
    </div>
  ),
};

// Längerer Hinweistext (umbricht innerhalb der Maximalbreite).
export const LangerText: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Was bedeutet das?">
          <Icon icon="ph:info" className="size-5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        Der Eigentümer sieht von Gästen nur den Vornamen sowie den Netto-Preis pro Nacht.
      </TooltipContent>
    </Tooltip>
  ),
};

// Dauerhaft geöffnet (zur Abnahme des Inhalts in der Doku).
export const StandardmaessigOffen: Story = {
  render: () => (
    <Tooltip defaultOpen>
      <TooltipTrigger asChild>
        <Button variant="outline">Immer sichtbar</Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Dieser Tooltip ist offen</TooltipContent>
    </Tooltip>
  ),
};
