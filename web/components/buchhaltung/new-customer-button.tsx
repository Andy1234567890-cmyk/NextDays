"use client";

// „Neuer Kunde"-Button + Anlage-Sheet (Buchhaltung → Kunden). NextDays-Design.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nextdays/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@nextdays/ui/sheet";
import { createCustomer } from "@/lib/buchhaltung";

export function NewCustomerButton() {
  const t = useTranslations("finance");
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
      setError(t("newCustomerButton.nameRequired"));
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
        {t("newCustomerButton.trigger")}
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
              {t("newCustomerButton.sheetTitle")}
            </SheetTitle>
            <SheetDescription>
              {t("newCustomerButton.sheetDescription")}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-name">
                {t("newCustomerButton.nameLabel")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="c-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("newCustomerButton.namePlaceholder")}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-type">{t("newCustomerButton.typeLabel")}</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="c-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="business">{t("newCustomerButton.typeBusiness")}</SelectItem>
                  <SelectItem value="private">{t("newCustomerButton.typePrivate")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-email">{t("newCustomerButton.emailLabel")}</Label>
              <Input
                id="c-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-phone">{t("newCustomerButton.phoneLabel")}</Label>
              <Input
                id="c-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="c-vat">{t("newCustomerButton.vatLabel")}</Label>
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
              {t("newCustomerButton.supplierCheckbox")}
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
              {t("newCustomerButton.cancel")}
            </Button>
            <Button type="button" className="flex-1" disabled={busy} onClick={save}>
              {busy ? t("newCustomerButton.saving") : t("newCustomerButton.submit")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
