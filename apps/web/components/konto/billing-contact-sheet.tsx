"use client";

// Rechnungskontakt bearbeiten — Panel von rechts (wie Lodgify „Rechnungsdetails
// hinzufügen"). Reine UI/State; Speichern wird später ans Backend verdrahtet.
import { useState } from "react";

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
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function BillingContactSheet({
  trigger,
}: {
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [showAddress2, setShowAddress2] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b">
          <SheetTitle className="font-display text-lg">
            Rechnungsdetails hinzufügen
          </SheetTitle>
        </SheetHeader>

        {/* Scrollbarer Formularbereich */}
        <form
          id="billing-form"
          onSubmit={(e) => {
            e.preventDefault();
            setOpen(false);
          }}
          className="flex-1 overflow-y-auto p-4"
        >
          <div className="flex flex-col gap-5">
            <Field id="bc-firstName" label="Vorname" required defaultValue="Andy" />
            <Field
              id="bc-lastName"
              label="Nachname"
              required
              defaultValue="Staudinger"
            />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bc-address">
                Adresse <span className="text-destructive">*</span>
              </Label>
              <Input
                id="bc-address"
                placeholder="z. B. Lombardstraße 123"
                required
              />
              {showAddress2 ? (
                <Input
                  id="bc-address2"
                  placeholder="Adresszeile 2"
                  className="mt-2"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddress2(true)}
                  className="w-fit text-sm font-medium text-accent hover:underline"
                >
                  Füge Adresszeile 2 hinzu
                </button>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bc-country">
                Land <span className="text-destructive">*</span>
              </Label>
              <Select defaultValue="de">
                <SelectTrigger id="bc-country">
                  <SelectValue placeholder="Land wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="de">Deutschland</SelectItem>
                  <SelectItem value="dk">Dänemark</SelectItem>
                  <SelectItem value="at">Österreich</SelectItem>
                  <SelectItem value="ch">Schweiz</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Field id="bc-state" label="Zustand" placeholder="z. B. Kalifornien" />
            <Field
              id="bc-city"
              label="Stadt"
              required
              placeholder="z. B. San Francisco"
            />
            <Field id="bc-zip" label="PLZ" required placeholder="z. B. 94123" />
            <Field
              id="bc-email"
              label="E-Mail"
              required
              type="email"
              defaultValue="a.staudinger32@gmail.com"
            />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bc-type">
                Kontotyp <span className="text-destructive">*</span>
              </Label>
              <Select>
                <SelectTrigger id="bc-type">
                  <SelectValue placeholder="Wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Privatperson</SelectItem>
                  <SelectItem value="business">Unternehmen</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </form>

        <SheetFooter className="flex-row gap-2 border-t">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => setOpen(false)}
          >
            Stornieren
          </Button>
          <Button type="submit" form="billing-form" className="flex-1">
            Speichern
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// Kleines Hilfs-Feld (Label + Input) für die wiederkehrenden Textfelder.
function Field({
  id,
  label,
  required,
  type = "text",
  placeholder,
  defaultValue,
}: {
  id: string;
  label: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Input
        id={id}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
      />
    </div>
  );
}
