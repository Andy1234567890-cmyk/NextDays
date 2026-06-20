"use client";

// „Neuer Kunde"-Button + Anlage-Sheet (Buchhaltung → Kunden). NextDays-Design.
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { createCustomer } from "@/lib/buchhaltung";

export function NewCustomerButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [vatId, setVatId] = useState("");
  const [type, setType] = useState("business");
  const [isSupplier, setIsSupplier] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName(""); setEmail(""); setPhone(""); setVatId("");
    setType("business"); setIsSupplier(false); setError(null);
  };

  async function save() {
    if (!name.trim()) {
      setError("Name ist erforderlich.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await createCustomer({
      name: name.trim(),
      email: email || null,
      phone: phone || null,
      vat_id: vatId || null,
      customer_type: type,
      is_supplier: isSupplier,
    });
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      reset();
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2">
        <Icon icon="ph:plus" className="size-4" />
        Neuer Kunde
      </Button>

      <Sheet
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b">
            <SheetTitle className="font-display text-lg font-extrabold">
              Neuer Kunde
            </SheetTitle>
            <SheetDescription>
              Lege einen Kunden oder Lieferanten an.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="c-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Firma oder Person"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-type">Typ</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="c-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="business">Geschäftlich</SelectItem>
                  <SelectItem value="private">Privat</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-email">E-Mail</Label>
              <Input
                id="c-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-phone">Telefon</Label>
              <Input
                id="c-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-vat">USt-IdNr.</Label>
              <Input
                id="c-vat"
                value={vatId}
                onChange={(e) => setVatId(e.target.value)}
                placeholder="DE123456789"
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isSupplier}
                onChange={(e) => setIsSupplier(e.target.checked)}
                className="size-4 rounded border-input"
              />
              Ist Lieferant (Kreditor)
            </label>

            {error && (
              <p className="rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
          </div>

          <SheetFooter className="flex-row gap-2 border-t">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Abbrechen
            </Button>
            <Button type="button" className="flex-1" disabled={busy} onClick={save}>
              {busy ? "Wird angelegt…" : "Kunde anlegen"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
