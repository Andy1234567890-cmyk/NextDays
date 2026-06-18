"use client";

// Konto → Profil (wie Lodgify „My account / Profile").
// Logo-Upload, Rechnungskontakt, Stammdaten, Telefon, Sprachen, Website,
// Beschreibung. Reine UI/State — Speichern wird später ans Backend verdrahtet.
import { Icon } from "@iconify/react";
import { useState } from "react";

import { BillingContactSheet } from "@/components/konto/billing-contact-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Separator } from "@/components/ui/separator";

export default function ProfilPage() {
  const [firstName, setFirstName] = useState("Andy");
  const [lastName, setLastName] = useState("Staudinger");
  const [language, setLanguage] = useState("de");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");

  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={(e) => e.preventDefault()}
    >
      {/* Logo-Upload */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-extrabold">Profil</h2>
        <p className="text-sm text-muted-foreground">
          Diese Angaben erscheinen auf Dokumenten und im Gäste-Portal.
        </p>
        <label className="flex size-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-(--radius) border border-dashed border-border text-muted-foreground transition-colors hover:bg-secondary/50">
          <Icon icon="ph:upload-simple" className="size-6" />
          <span className="text-xs">Logo hochladen</span>
          <input type="file" accept="image/*" className="hidden" />
        </label>
      </section>

      <Separator />

      {/* Rechnungskontakt */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-1.5">
          <h3 className="font-display text-lg font-extrabold">
            Rechnungskontakt
          </h3>
          <Icon
            icon="ph:info"
            className="size-4 text-muted-foreground"
            aria-hidden
          />
        </div>
        <BillingContactSheet
          trigger={
            <Button type="button" variant="outline" size="sm" className="w-fit">
              Bearbeiten
            </Button>
          }
        />
      </section>

      <Separator />

      {/* Stammdaten */}
      <section className="flex flex-col gap-5">
        <h3 className="font-display text-lg font-extrabold">Stammdaten</h3>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="firstName">
              Vorname <span className="text-destructive">*</span>
            </Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lastName">
              Nachname <span className="text-destructive">*</span>
            </Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5 sm:max-w-sm">
          <Label htmlFor="language">Bevorzugte Sprache</Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger id="language">
              <SelectValue placeholder="Sprache wählen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="de">Deutsch</SelectItem>
              <SelectItem value="da">Dänisch</SelectItem>
              <SelectItem value="en">Englisch</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone1">
              Primäre Telefonnummer <span className="text-destructive">*</span>
            </Label>
            <Input
              id="phone1"
              type="tel"
              placeholder="+49 1525 1239026"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone2">Zusätzliche Telefonnummer</Label>
            <Input id="phone2" type="tel" placeholder="+1 2015550123" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="spoken">Gesprochene Sprachen</Label>
          <Select>
            <SelectTrigger id="spoken">
              <SelectValue placeholder="Hinzufügen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="de">Deutsch</SelectItem>
              <SelectItem value="da">Dänisch</SelectItem>
              <SelectItem value="en">Englisch</SelectItem>
              <SelectItem value="fr">Französisch</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            type="url"
            placeholder="https://…"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Beschreibung</Label>
          <RichTextEditor
            value={description}
            onChange={setDescription}
            placeholder="Kurze Beschreibung deines Unternehmens…"
          />
        </div>
      </section>

      {/* Aktionen */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline">
          Abbrechen
        </Button>
        <Button type="submit">Speichern</Button>
      </div>
    </form>
  );
}
