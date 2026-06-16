import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";

const meta = {
  title: "UI-Bausteine/Dialog",
  component: Dialog,
  tags: ["autodocs"],
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

// Standard: Trigger öffnet einfachen Dialog mit Titel und Beschreibung.
export const Standard: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Dialog öffnen</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reservierung bestätigen</DialogTitle>
          <DialogDescription>
            Möchten Sie die Reservierung für das Ferienhaus „Strandblick“
            verbindlich bestätigen?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Abbrechen</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button>Bestätigen</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

// Formular: Dialog mit Eingabefeldern für eine schnelle Bearbeitung.
export const MitFormular: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="accent">Gast bearbeiten</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gastdaten bearbeiten</DialogTitle>
          <DialogDescription>
            Ändern Sie die Kontaktdaten des Gastes. Klicken Sie auf Speichern,
            wenn Sie fertig sind.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="name">Vorname</Label>
            <Input id="name" defaultValue="Lena" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">E-Mail</Label>
            <Input id="email" type="email" defaultValue="lena@example.com" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Abbrechen</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button>Speichern</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

// Destruktiv: Bestätigungsdialog für eine löschende Aktion.
export const DestruktiveAktion: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive">Reservierung stornieren</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reservierung stornieren?</DialogTitle>
          <DialogDescription>
            Diese Aktion kann nicht rückgängig gemacht werden. Die Reservierung
            wird dauerhaft auf „cancelled“ gesetzt.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Zurück</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="destructive">Endgültig stornieren</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

// Standardmäßig offen: zeigt den geöffneten Zustand direkt in der Doku.
export const StandardmaessigOffen: Story = {
  render: () => (
    <Dialog defaultOpen>
      <DialogTrigger asChild>
        <Button variant="outline">Erneut öffnen</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Willkommen bei NextDays</DialogTitle>
          <DialogDescription>
            Dieser Dialog ist beim Laden bereits geöffnet, um den offenen
            Zustand zu zeigen.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button>Verstanden</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
