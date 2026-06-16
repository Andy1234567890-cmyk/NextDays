import type { Meta, StoryObj } from "@storybook/react";
import { Icon } from "@iconify/react";
import { useState } from "react";

import { Button } from "./button";
import { Avatar, AvatarFallback } from "./avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuShortcut,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "./dropdown-menu";

const meta = {
  title: "UI-Bausteine/DropdownMenu",
  component: DropdownMenu,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Aufklappbares Menü auf Basis von @radix-ui/react-dropdown-menu. Typischer Einsatz: Nutzer-Menü mit Logout, Aktions-Menüs in Tabellen und gesteuerte Optionen.",
      },
    },
  },
} satisfies Meta<typeof DropdownMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

// Hauptbeispiel: Nutzer-Menü mit Logout (Avatar als Auslöser).
export const NutzerMenue: Story = {
  name: "Nutzer-Menü mit Logout",
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Nutzer-Menü öffnen">
          <Avatar className="size-9">
            <AvatarFallback>AS</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">Andy Staudinger</span>
            <span className="text-xs font-normal text-muted-foreground">
              a.staudinger@nextdays.app
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <Icon icon="ph:user" />
            Profil
            <DropdownMenuShortcut>⌘P</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Icon icon="ph:gear" />
            Einstellungen
            <DropdownMenuShortcut>⌘,</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Icon icon="ph:buildings" />
            Objekte verwalten
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:bg-destructive focus:text-destructive-foreground">
          <Icon icon="ph:sign-out" />
          Abmelden
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

// Einfaches Aktions-Menü mit Button-Auslöser.
export const Standard: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          Aktionen
          <Icon icon="ph:caret-down" className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem>
          <Icon icon="ph:pencil-simple" />
          Bearbeiten
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Icon icon="ph:copy" />
          Duplizieren
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:bg-destructive focus:text-destructive-foreground">
          <Icon icon="ph:trash" />
          Löschen
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

// Mit deaktiviertem Eintrag und Trennlinien.
export const MitDeaktiviertemEintrag: Story = {
  name: "Mit deaktiviertem Eintrag",
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Icon icon="ph:dots-three-vertical" className="size-4" />
          Reservierung
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel>Reservierung #1042</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Icon icon="ph:check-circle" />
          Bestätigen
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <Icon icon="ph:money" />
          Rückerstattung (nicht möglich)
        </DropdownMenuItem>
        <DropdownMenuItem className="text-destructive focus:bg-destructive focus:text-destructive-foreground">
          <Icon icon="ph:x-circle" />
          Stornieren
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

// Gesteuerte Checkbox-Einträge (Spalten ein-/ausblenden).
export const MitCheckbox: Story = {
  name: "Mit Checkbox-Einträgen",
  render: () => {
    const [zeigeNetto, setZeigeNetto] = useState(true);
    const [zeigeKanal, setZeigeKanal] = useState(false);
    const [zeigeStatus, setZeigeStatus] = useState(true);
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <Icon icon="ph:columns" className="size-4" />
            Spalten
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuLabel>Sichtbare Spalten</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked={zeigeNetto} onCheckedChange={setZeigeNetto}>
            Netto/Nacht
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={zeigeKanal} onCheckedChange={setZeigeKanal}>
            Buchungskanal
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={zeigeStatus} onCheckedChange={setZeigeStatus}>
            Status
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
};

// Gesteuerte Radio-Auswahl (Buchungskanal filtern).
export const MitRadioAuswahl: Story = {
  name: "Mit Radio-Auswahl",
  render: () => {
    const [kanal, setKanal] = useState("direct");
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <Icon icon="ph:funnel" className="size-4" />
            Kanal filtern
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel>Buchungskanal</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={kanal} onValueChange={setKanal}>
            <DropdownMenuRadioItem value="direct">Direkt</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="booking">Booking</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="airbnb">Airbnb</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="vrbo">Vrbo</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
};

// Mit Untermenü (verschachtelte Aktionen).
export const MitUntermenue: Story = {
  name: "Mit Untermenü",
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          Mehr
          <Icon icon="ph:caret-down" className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuItem>
          <Icon icon="ph:export" />
          Exportieren
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Icon icon="ph:user-plus" />
            Zuweisen an
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-44">
            <DropdownMenuItem>Reinigungskraft</DropdownMenuItem>
            <DropdownMenuItem>Mitarbeiter</DropdownMenuItem>
            <DropdownMenuItem>Eigentümer</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Icon icon="ph:archive" />
          Archivieren
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
