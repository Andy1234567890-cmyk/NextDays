"use client";

// „Neues Objekt"-Button + Anlage-Sheet. Erfragt die Kernfelder (Name, Typ,
// Gäste); alle weiteren Sektionen werden danach auf der Detailseite gepflegt.
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
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
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TYPE_OPTIONS } from "@/lib/property-meta";
import { createProperty, type PropertyType } from "@/lib/properties";

export function NewPropertyButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<PropertyType>("ferienhaus");
  const [guests, setGuests] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await createProperty({
      title,
      property_type: type,
      max_guests: guests,
    });
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      setTitle("");
      router.push(`/objekte/${res.data.id}`);
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2">
        <Icon icon="ph:plus" className="size-4" />
        Neues Objekt
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-display text-xl font-extrabold">
              Neues Objekt
            </SheetTitle>
            <SheetDescription>
              Lege die Basisdaten an — Details folgen danach.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">Name</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="z. B. Villa Sonnenschein"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Typ</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as PropertyType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="guests">Max. Gäste</Label>
              <Input
                id="guests"
                type="number"
                min={1}
                max={99}
                value={guests}
                onChange={(e) => setGuests(Number(e.target.value) || 1)}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button onClick={save} disabled={busy || !title.trim()}>
              {busy ? "Anlegen…" : "Objekt anlegen"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
