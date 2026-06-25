"use client";

// Rechnungskontakt / Agentur-Firmendaten bearbeiten — Panel von rechts. Liest und
// speichert das Firmenprofil (tenant_billing_profile) über den vorhandenen
// Buchhaltungs-Endpoint (lib/firmenprofil). Diese Daten erscheinen als Aussteller
// (PM) auf den Eigentümer-Abrechnungen und sind die Basis für die Steuerlogik
// (Land + Kleinunternehmer/USt-ID → Reverse-Charge/§19).
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
import {
  COUNTRIES,
  hasSmallBusinessScheme,
  smallBusinessLabel,
  vatIdLabel,
} from "@/lib/countries";
import {
  getFirmenProfil,
  saveFirmenProfil,
  type FirmenProfil,
} from "@/lib/firmenprofil";

const EMPTY: FirmenProfil = {
  companyName: "",
  companyStreet: "",
  companyHouseNumber: "",
  companyPostalCode: "",
  companyCity: "",
  companyCountry: "DE",
  email: "",
  phoneNumber: "",
  vatId: "",
  taxNumber: "",
  isSmallBusiness: false,
};

export function BillingContactSheet({
  trigger,
}: {
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FirmenProfil>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Beim Öffnen die echten Firmendaten laden.
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void getFirmenProfil().then((res) => {
      setLoading(false);
      if (res.ok) {
        const d = res.data as Record<string, unknown>;
        setForm({
          companyName: (d.companyName as string) || (d.name as string) || "",
          companyStreet: (d.companyStreet as string) || "",
          companyHouseNumber: (d.companyHouseNumber as string) || "",
          companyPostalCode: (d.companyPostalCode as string) || "",
          companyCity: (d.companyCity as string) || "",
          companyCountry: (d.companyCountry as string) || "DE",
          email: (d.email as string) || "",
          phoneNumber: (d.phoneNumber as string) || "",
          vatId: (d.vatId as string) || "",
          taxNumber: (d.taxNumber as string) || "",
          isSmallBusiness: Boolean(d.isSmallBusiness),
        });
      } else toast.error(res.error);
    });
  }, [open]);

  function set<K extends keyof FirmenProfil>(key: K, value: FirmenProfil[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.SyntheticEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await saveFirmenProfil(form);
    setSaving(false);
    if (res.ok) {
      toast.success("Rechnungsdaten gespeichert.");
      setOpen(false);
    } else toast.error(res.error);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b">
          <SheetTitle className="font-display text-lg">
            Rechnungsdetails der Agentur
          </SheetTitle>
        </SheetHeader>

        <form
          id="billing-form"
          onSubmit={submit}
          className="flex-1 overflow-y-auto p-4"
        >
          <fieldset disabled={loading} className="flex flex-col gap-5">
            <Field
              id="bc-company"
              label="Firmenname"
              required
              value={form.companyName ?? ""}
              onChange={(v) => set("companyName", v)}
            />

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Field
                  id="bc-street"
                  label="Straße"
                  required
                  value={form.companyStreet ?? ""}
                  onChange={(v) => set("companyStreet", v)}
                />
              </div>
              <Field
                id="bc-house"
                label="Nr."
                value={form.companyHouseNumber ?? ""}
                onChange={(v) => set("companyHouseNumber", v)}
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Field
                id="bc-zip"
                label="PLZ"
                required
                value={form.companyPostalCode ?? ""}
                onChange={(v) => set("companyPostalCode", v)}
              />
              <div className="col-span-2">
                <Field
                  id="bc-city"
                  label="Stadt"
                  required
                  value={form.companyCity ?? ""}
                  onChange={(v) => set("companyCity", v)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bc-country">
                Land <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.companyCountry ?? "DE"}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    companyCountry: v,
                    // Land ohne Befreiungsregelung → Haken zurücksetzen.
                    isSmallBusiness: hasSmallBusinessScheme(v)
                      ? f.isSmallBusiness
                      : false,
                  }))
                }
              >
                <SelectTrigger id="bc-country">
                  <SelectValue placeholder="Land wählen" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Field
              id="bc-email"
              label="E-Mail"
              type="email"
              value={form.email ?? ""}
              onChange={(v) => set("email", v)}
            />
            <Field
              id="bc-phone"
              label="Telefon"
              value={form.phoneNumber ?? ""}
              onChange={(v) => set("phoneNumber", v)}
            />

            <div className="h-px bg-border" />

            <Field
              id="bc-vat"
              label={vatIdLabel(form.companyCountry)}
              value={form.vatId ?? ""}
              onChange={(v) => set("vatId", v)}
            />
            <Field
              id="bc-tax"
              label="Steuernummer"
              value={form.taxNumber ?? ""}
              onChange={(v) => set("taxNumber", v)}
            />
            {hasSmallBusinessScheme(form.companyCountry) ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(form.isSmallBusiness)}
                  onChange={(e) => set("isSmallBusiness", e.target.checked)}
                />
                {smallBusinessLabel(form.companyCountry)}
              </label>
            ) : (
              <p className="text-sm text-muted-foreground">
                {smallBusinessLabel(form.companyCountry)}
              </p>
            )}
          </fieldset>
        </form>

        <SheetFooter className="flex-row gap-2 border-t">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => setOpen(false)}
          >
            Abbrechen
          </Button>
          <Button type="submit" form="billing-form" className="flex-1" disabled={saving}>
            {saving ? "Speichert …" : "Speichern"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// Kontrolliertes Hilfs-Feld (Label + Input).
function Field({
  id,
  label,
  required,
  type = "text",
  value,
  onChange,
}: {
  id: string;
  label: string;
  required?: boolean;
  type?: string;
  value: string;
  onChange: (v: string) => void;
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
