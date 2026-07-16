"use client";

// „Neues Objekt"-Button + Anlage-Sheet. Erfragt die Kernfelder (Name, Typ,
// Gäste); alle weiteren Sektionen werden danach auf der Detailseite gepflegt.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
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
import { typeOptionsFor } from "@/lib/property-meta";
import { createProperty, type PropertyType } from "@/lib/properties";

export function NewPropertyButton({
  accommodationType,
}: {
  // Betriebsart (0090): Hotel legt ZIMMER an (Zimmertypen), Ferienvermietung
  // Ferienobjekte — Liste und Wortlaut passen sich an.
  accommodationType?: "vacation_rental" | "hotel" | null;
}) {
  const t = useTranslations("objects");
  const router = useRouter();
  const isHotel = accommodationType === "hotel";
  const typeOptions = typeOptionsFor(accommodationType);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<PropertyType>(
    isHotel ? "doppelzimmer" : "ferienhaus",
  );
  const [guests, setGuests] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 409 = Stripe-Konto noch nicht freigeschaltet → Hinweis + Weg zur Einrichtung.
  const [needsPayments, setNeedsPayments] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    setNeedsPayments(false);
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
      if (res.status === 409) setNeedsPayments(true);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2">
        <Icon icon="ph:plus" className="size-4" />
        {isHotel ? t("newPropertyButton.newRoom") : t("newPropertyButton.newProperty")}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-display text-xl font-extrabold">
              {isHotel ? t("newPropertyButton.newRoom") : t("newPropertyButton.newProperty")}
            </SheetTitle>
            <SheetDescription>
              {t("newPropertyButton.sheetDescription")}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">{t("newPropertyButton.nameLabel")}</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  isHotel
                    ? t("newPropertyButton.namePlaceholderHotel")
                    : t("newPropertyButton.namePlaceholderVacationRental")
                }
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{t("newPropertyButton.typeLabel")}</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as PropertyType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="guests">{t("newPropertyButton.maxGuestsLabel")}</Label>
              <Input
                id="guests"
                type="number"
                min={1}
                max={99}
                value={guests}
                onChange={(e) => setGuests(Number(e.target.value) || 1)}
              />
            </div>

            {error && !needsPayments && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            {needsPayments ? (
              <div className="flex flex-col gap-3 rounded-(--radius) border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <span className="flex items-start gap-2">
                  <Icon icon="ph:warning-circle" className="mt-0.5 size-4 shrink-0" />
                  {error}
                </span>
                <Button
                  variant="outline"
                  className="self-start gap-2"
                  onClick={() => {
                    setOpen(false);
                    router.push("/konto");
                  }}
                >
                  <Icon icon="ph:credit-card" className="size-4" />
                  {t("newPropertyButton.setUpPayments")}
                </Button>
              </div>
            ) : (
              <Button onClick={save} disabled={busy || !title.trim()}>
                {busy
                  ? t("newPropertyButton.creating")
                  : isHotel
                    ? t("newPropertyButton.createRoom")
                    : t("newPropertyButton.createProperty")}
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
