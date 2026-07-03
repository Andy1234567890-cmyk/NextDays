import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const meta = {
  title: "UI-Bausteine/Sheet",
  component: Sheet,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Seitliches Panel (Radix Dialog), das von rechts, links, oben oder unten " +
          "hereinfährt. Typischer Einsatz: Detail-Bearbeitung neben einer Liste " +
          "(z.B. Reservierung anpassen), Filter oder mobile Aktionen.",
      },
    },
  },
} satisfies Meta<typeof Sheet>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Von rechts (Standard): Reservierung bearbeiten mit kleinem Formular. */
export const VonRechts: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button>Reservierung bearbeiten</Button>
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Reservierung bearbeiten</SheetTitle>
          <SheetDescription>
            Ferienhaus „Strandblick“ — Änderungen werden erst mit „Speichern“
            übernommen.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4">
          <div className="grid gap-2">
            <Label htmlFor="gast-vorname">Vorname des Gastes</Label>
            <Input id="gast-vorname" defaultValue="Lena" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-2">
              <Label htmlFor="anreise">Anreise</Label>
              <Input id="anreise" type="date" defaultValue="2026-07-10" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="abreise">Abreise</Label>
              <Input id="abreise" type="date" defaultValue="2026-07-17" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="netto-nacht">Netto pro Nacht</Label>
            <Input id="netto-nacht" inputMode="numeric" defaultValue="120" />
          </div>
        </div>
        <SheetFooter>
          <Button onClick={() => console.log("Reservierung gespeichert")}>
            Speichern
          </Button>
          <SheetClose asChild>
            <Button variant="outline">Abbrechen</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};

/** Von links: z.B. Filter- oder Navigationspanel neben einer Objektliste. */
export const VonLinks: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Filter öffnen</Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Objekte filtern</SheetTitle>
          <SheetDescription>
            Grenzen Sie die Objektliste nach Ort und Objektart ein.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4">
          <div className="grid gap-2">
            <Label htmlFor="filter-ort">Ort</Label>
            <Input id="filter-ort" placeholder="z.B. Sankt Peter-Ording" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="filter-art">Objektart</Label>
            <Input id="filter-art" placeholder="ferienhaus, appartement, glamping …" />
          </div>
        </div>
        <SheetFooter>
          <SheetClose asChild>
            <Button onClick={() => console.log("Filter angewendet")}>
              Anwenden
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};

/** Von oben: flacher Hinweis-Bereich, z.B. für Systemmeldungen. */
export const VonOben: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Hinweis anzeigen</Button>
      </SheetTrigger>
      <SheetContent side="top">
        <SheetHeader>
          <SheetTitle>Kanal-Synchronisierung geplant</SheetTitle>
          <SheetDescription>
            Am 12.07.2026 zwischen 02:00 und 03:00 Uhr werden Verfügbarkeiten
            und Preise mit allen Buchungskanälen neu abgeglichen.
          </SheetDescription>
        </SheetHeader>
        <SheetFooter>
          <SheetClose asChild>
            <Button variant="outline">Verstanden</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};

/** Von unten: mobiles Aktionsblatt, z.B. Schnellaktionen zu einer Aufgabe. */
export const VonUnten: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Aktionen zur Aufgabe</Button>
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Endreinigung „Strandblick“</SheetTitle>
          <SheetDescription>
            Fällig am 17.07.2026 nach Abreise — Status: open.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-2 px-4 pb-2">
          <SheetClose asChild>
            <Button onClick={() => console.log("Aufgabe gestartet")}>
              Aufgabe starten
            </Button>
          </SheetClose>
          <SheetClose asChild>
            <Button
              variant="outline"
              onClick={() => console.log("Vertretung angefragt")}
            >
              Vertretung anfragen
            </Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  ),
};
