"use client";

// Rechnungsadresse bearbeiten — Seitenpanel (Sheet) wie im Lodgify-Vorbild.
// Die Daten liegen am Stripe-Customer (Quelle der Wahrheit für die Rechnungs-
// stellung), nicht doppelt in unserer DB.
//
// Konto-Typ steuert die Pflichtfelder: 'Unternehmen' verlangt Firmenname, und
// die USt-IdNr. wird nur dann angeboten. Der Ländercode ist ISO-3166-1 alpha-2
// (LAENDER), die Anzeigenamen kommen aus i18n ("countries") — keine zweite
// Länderliste.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Checkbox } from "@nextdays/ui/checkbox";
import { Input } from "@nextdays/ui/input";
import { Label, LabelRequired } from "@nextdays/ui/label";
import { NativeSelect } from "@nextdays/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@nextdays/ui/sheet";
import { LAENDER } from "@/lib/laender";
import { legalFormsForCountry } from "@/lib/legal-forms";
import { updateBillingAddress, type BillingAddress } from "@/lib/subscriptions";

const LEER: BillingAddress = {
  first_name: null,
  last_name: null,
  line1: null,
  line2: null,
  city: null,
  state: null,
  postal_code: null,
  country: null,
  email: null,
  account_type: "individual",
  company_name: null,
  vat_id: null,
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address: BillingAddress | null;
  onSaved: (addr: BillingAddress) => void;
};

export function RechnungsadresseDialog({
  open,
  onOpenChange,
  address,
  onSaved,
}: Props) {
  const t = useTranslations("account");
  const tCountry = useTranslations("countries");
  const [form, setForm] = useState<BillingAddress>(address ?? LEER);
  const [zeile2, setZeile2] = useState(false);
  const [bestaetigt, setBestaetigt] = useState(false);
  const [busy, setBusy] = useState(false);

  // Beim Öffnen den Server-Stand übernehmen — ein abgebrochener Vorgang darf
  // keine halbfertigen Eingaben in die nächste Sitzung tragen.
  useEffect(() => {
    if (!open) return;
    setForm(address ?? LEER);
    setZeile2(!!address?.line2);
    setBestaetigt(false);
  }, [open, address]);

  const istFirma = form.account_type === "company";

  // Beispiel-Rechtsformen für das gewählte Land. Der Rechnungs-Kontotyp kennt
  // nur individual/company (Stripe) — non_profit-Formen (Verein, Forening,
  // ASBL) sind juristische Personen und gehören deshalb zu 'company'.
  function beispiele(typ: BillingAddress["account_type"]): string {
    if (!form.country) return "";
    return legalFormsForCountry(form.country)
      .filter((f) => (typ === "individual" ? f.type === "individual" : f.type !== "individual"))
      .slice(0, 4)
      .map((f) => f.key)
      .join(", ");
  }

  function setzen<K extends keyof BillingAddress>(
    key: K,
    wert: BillingAddress[K],
  ) {
    setForm((f) => ({ ...f, [key]: wert }));
  }

  // Pflichtfelder gespiegelt zur Server-Validierung (dort ist die Wahrheit).
  const fehlend =
    !form.first_name?.trim() ||
    !form.last_name?.trim() ||
    !form.line1?.trim() ||
    !form.country ||
    !form.city?.trim() ||
    !form.postal_code?.trim() ||
    !form.email?.trim() ||
    (istFirma && !form.company_name?.trim());

  async function speichern() {
    setBusy(true);
    try {
      const res = await updateBillingAddress(form);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onSaved(res.data);
      onOpenChange(false);
      toast.success(t("billing.updated"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[30rem]">
        <SheetHeader className="border-b border-border px-6 py-5">
          <SheetTitle className="font-display text-xl font-extrabold">
            Rechnungsadresse auswählen
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Feld label="Vorname" pflicht>
              <Input
                value={form.first_name ?? ""}
                onChange={(e) => setzen("first_name", e.target.value)}
              />
            </Feld>
            <Feld label="Nachname" pflicht>
              <Input
                value={form.last_name ?? ""}
                onChange={(e) => setzen("last_name", e.target.value)}
              />
            </Feld>
          </div>

          <Feld label="Adresse" pflicht>
            <Input
              value={form.line1 ?? ""}
              onChange={(e) => setzen("line1", e.target.value)}
            />
          </Feld>

          {zeile2 || form.line2 ? (
            <Feld label={t("billing.addressLine2")}>
              <Input
                value={form.line2 ?? ""}
                onChange={(e) => setzen("line2", e.target.value)}
              />
            </Feld>
          ) : (
            <button
              type="button"
              onClick={() => setZeile2(true)}
              className="self-start text-sm font-medium text-primary hover:underline"
            >
              Adresszeile 2 hinzufügen
            </button>
          )}

          <Feld label="Land" pflicht>
            <NativeSelect
              value={form.country ?? ""}
              onChange={(e) => setzen("country", e.target.value || null)}
            >
              <option value="">{t("billing.pleaseChoose")}</option>
              {LAENDER.map((l) => (
                <option key={l.code} value={l.code}>
                  {tCountry(l.code)}
                </option>
              ))}
            </NativeSelect>
          </Feld>

          <Feld label="Bundesland">
            <Input
              value={form.state ?? ""}
              placeholder={t("billing.statePlaceholder")}
              onChange={(e) => setzen("state", e.target.value)}
            />
          </Feld>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Feld label="Stadt" pflicht>
              <Input
                value={form.city ?? ""}
                onChange={(e) => setzen("city", e.target.value)}
              />
            </Feld>
            <Feld label="Postleitzahl" pflicht>
              <Input
                value={form.postal_code ?? ""}
                onChange={(e) => setzen("postal_code", e.target.value)}
              />
            </Feld>
          </div>

          <Feld label="E-Mail" pflicht>
            <Input
              type="email"
              value={form.email ?? ""}
              onChange={(e) => setzen("email", e.target.value)}
            />
          </Feld>

          <Feld label="Konto-Typ" pflicht>
            {/* Stripe kennt nur individual/company. Ein Einzelunternehmen IST
                steuerlich eine natürliche Person (keine juristische Person,
                Inhaberhaftung) — also individual. Die Beispiel-Rechtsformen
                kommen aus LEGAL_FORMS für das GEWÄHLTE Land, nicht aus einer
                deutschen Hardcode-Liste: ein dänischer Betrieb sieht ApS/A/S,
                ein französischer SARL/SAS. */}
            <NativeSelect
              value={form.account_type}
              onChange={(e) =>
                setzen(
                  "account_type",
                  e.target.value as BillingAddress["account_type"],
                )
              }
            >
              <option value="individual">
                {beispiele("individual")
                  ? `Privatperson oder Einzelunternehmen (${beispiele("individual")})`
                  : "Privatperson oder Einzelunternehmen"}
              </option>
              <option value="company">
                {beispiele("company")
                  ? `Unternehmen (${beispiele("company")})`
                  : "Unternehmen"}
              </option>
            </NativeSelect>
            <p className="text-sm text-muted-foreground">
              Einzelunternehmen zählen hier als Privatperson — sie sind keine
              eigene juristische Person. Die Rechtsform pflegen Sie unter
              Kontaktdaten im Konto.
            </p>
          </Feld>

          {istFirma && (
            <>
              <Feld label={t("billing.companyName")} pflicht>
                <Input
                  value={form.company_name ?? ""}
                  onChange={(e) => setzen("company_name", e.target.value)}
                />
              </Feld>
              <Feld label="Umsatzsteuer-Identifikationsnummer">
                <Input
                  value={form.vat_id ?? ""}
                  placeholder={form.country ? `${form.country}12345678` : ""}
                  onChange={(e) => setzen("vat_id", e.target.value.toUpperCase())}
                />
              </Feld>
            </>
          )}

          <label className="flex items-start gap-3 text-sm text-muted-foreground">
            <Checkbox
              checked={bestaetigt}
              onCheckedChange={(v) => setBestaetigt(v === true)}
              className="mt-0.5"
            />
            <span>
              Mir ist bekannt, dass Änderungen der Rechnungsangaben nur für
              zukünftige Rechnungen gelten, jedoch nicht rückwirkend.
            </span>
          </label>
        </div>

        <div className="mt-auto flex gap-3 border-t border-border px-6 py-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Abbrechen
          </Button>
          <Button
            className="flex-1 gap-2"
            onClick={speichern}
            disabled={busy || !bestaetigt || fehlend}
          >
            {busy && <Icon icon="svg-spinners:180-ring" className="size-4" />}
            Update
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Feld({
  label,
  pflicht = false,
  children,
}: {
  label: string;
  pflicht?: boolean;
  children: React.ReactNode;
}) {
  // LabelRequired ist NUR das rote Sternchen (es rendert seine Kinder nicht) —
  // der Feldname muss deshalb im Label daneben stehen, sonst zeigt das Formular
  // bloß Sterne über leeren Feldern.
  return (
    <div className="flex flex-col gap-1.5">
      <Label>
        {label}
        {pflicht && <LabelRequired />}
      </Label>
      {children}
    </div>
  );
}
