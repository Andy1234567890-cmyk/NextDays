"use client";

// Reiter „Adressen": weitere Anschriften (Rechnung/Lieferung/Sonstige) je
// Kunde mit Standard je Art. Die Stammanschrift bleibt `customers.address`
// und wird oben nur angezeigt. Kein Realtime (customer_addresses gesperrt,
// Wurzel 6) — nach jeder Aktion `router.refresh()`.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { Checkbox } from "@nextdays/ui/checkbox";
import { COUNTRIES } from "@nextdays/ui/countries";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { NativeSelect } from "@nextdays/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@nextdays/ui/sheet";
import { createAnschrift, deleteAnschrift, updateAnschrift } from "@/lib/buchhaltung-kontakte";
import {
  ADRESS_ARTEN,
  type AdressArt,
  type Anschrift,
  type AnschriftEingabe,
  type KundeDetail,
} from "@/lib/buchhaltung-kontakte-typen";

type Formular = {
  type: AdressArt;
  label: string;
  recipient: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;
  isDefault: boolean;
};

const LEER: Formular = {
  type: "billing",
  label: "",
  recipient: "",
  street: "",
  houseNumber: "",
  postalCode: "",
  city: "",
  country: "",
  isDefault: false,
};

function ausZeile(a: Anschrift): Formular {
  return {
    type: a.type,
    label: a.label ?? "",
    recipient: a.recipient ?? "",
    street: a.street ?? "",
    houseNumber: a.houseNumber ?? "",
    postalCode: a.postalCode ?? "",
    city: a.city ?? "",
    country: a.country,
    isDefault: a.isDefault,
  };
}

function alsEingabe(f: Formular): AnschriftEingabe {
  return {
    type: f.type,
    label: f.label.trim() || null,
    recipient: f.recipient.trim() || null,
    street: f.street.trim() || null,
    houseNumber: f.houseNumber.trim() || null,
    postalCode: f.postalCode.trim() || null,
    city: f.city.trim() || null,
    country: f.country.trim().toUpperCase(),
    isDefault: f.isDefault,
  };
}

function landName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function anschriftZeilen(a: Anschrift, locale: string): string[] {
  return [
    a.recipient ?? "",
    [a.street, a.houseNumber].filter(Boolean).join(" "),
    [a.postalCode, a.city].filter(Boolean).join(" "),
    landName(a.country, locale),
  ].filter(Boolean);
}

export function AdressenTab({
  customerId,
  kunde,
  anschriften,
}: {
  customerId: string;
  kunde: KundeDetail;
  anschriften: Anschrift[];
}) {
  const t = useTranslations("finance");
  const locale = useLocale();
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const [bearbeitet, setBearbeitet] = useState<Anschrift | null>(null);
  const [form, setForm] = useState<Formular>(LEER);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [listenFehler, setListenFehler] = useState<string | null>(null);

  const artText = (art: AdressArt) => t(`kontaktePage.adressen.art.${art}`);

  const oeffnen = (a: Anschrift | null) => {
    setBearbeitet(a);
    setForm(a ? ausZeile(a) : { ...LEER, country: kunde.address?.country?.toUpperCase() ?? "" });
    setFehler(null);
    setOffen(true);
  };

  async function speichern() {
    if (!/^[A-Za-z]{2}$/.test(form.country.trim())) {
      setFehler(t("kontaktePage.adressen.countryRequired"));
      return;
    }
    setBusy(true);
    setFehler(null);
    const eingabe = alsEingabe(form);
    const res = bearbeitet
      ? await updateAnschrift(customerId, bearbeitet.id, eingabe)
      : await createAnschrift(customerId, eingabe);
    setBusy(false);
    if (res.ok) {
      setOffen(false);
      router.refresh();
    } else {
      setFehler(res.error);
    }
  }

  async function loeschen(a: Anschrift) {
    if (!window.confirm(t("kontaktePage.adressen.deleteConfirm"))) return;
    setListenFehler(null);
    const res = await deleteAnschrift(customerId, a.id);
    if (res.ok) router.refresh();
    else setListenFehler(res.error);
  }

  async function standardSetzen(a: Anschrift) {
    setListenFehler(null);
    const res = await updateAnschrift(customerId, a.id, { isDefault: true });
    if (res.ok) router.refresh();
    else setListenFehler(res.error);
  }

  const stamm = kunde.address;
  const stammZeilen = stamm
    ? [
        stamm.text ?? "",
        [stamm.street, stamm.house_number].filter(Boolean).join(" "),
        [stamm.postal_code, stamm.city].filter(Boolean).join(" "),
        stamm.country ? landName(stamm.country.toUpperCase(), locale) : "",
      ].filter(Boolean)
    : [];

  return (
    <div className="flex flex-col gap-3">
      <Card className="flex flex-col gap-1 p-4">
        <span className="text-xs font-medium text-muted-foreground">
          {t("kontaktePage.adressen.primaryAddress")}
        </span>
        {stammZeilen.length === 0 ? (
          <span className="text-sm text-muted-foreground">{t("kontaktePage.adressen.noPrimary")}</span>
        ) : (
          <span className="whitespace-pre-line text-sm">{stammZeilen.join("\n")}</span>
        )}
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => oeffnen(null)} className="gap-2">
          <Icon icon="ph:plus" className="size-4" />
          {t("kontaktePage.adressen.add")}
        </Button>
      </div>

      {listenFehler && (
        <p className="rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {listenFehler}
        </p>
      )}

      {anschriften.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-10 text-center">
          <Icon icon="ph:map-pin" className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("kontaktePage.adressen.empty")}</p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {anschriften.map((a) => (
            <Card key={a.id} className="flex flex-col gap-2 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  {artText(a.type)}
                  {a.label ? ` · ${a.label}` : ""}
                  {a.isDefault && (
                    <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                      {t("kontaktePage.adressen.default")}
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-1">
                  {!a.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => standardSetzen(a)}
                      title={t("kontaktePage.adressen.makeDefault")}
                    >
                      <Icon icon="ph:star" className="size-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => oeffnen(a)}>
                    <Icon icon="ph:pencil-simple" className="size-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => loeschen(a)}>
                    <Icon icon="ph:trash" className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <span className="whitespace-pre-line text-sm">
                {anschriftZeilen(a, locale).join("\n")}
              </span>
            </Card>
          ))}
        </div>
      )}

      <AnschriftSheet
        offen={offen}
        setOffen={setOffen}
        bearbeitet={bearbeitet}
        form={form}
        setForm={setForm}
        busy={busy}
        fehler={fehler}
        onSpeichern={speichern}
      />
    </div>
  );
}

/** Das Sheet zum Anlegen und Bearbeiten einer Anschrift. */
function AnschriftSheet({
  offen,
  setOffen,
  bearbeitet,
  form,
  setForm,
  busy,
  fehler,
  onSpeichern,
}: {
  offen: boolean;
  setOffen: (v: boolean) => void;
  bearbeitet: Anschrift | null;
  form: Formular;
  setForm: React.Dispatch<React.SetStateAction<Formular>>;
  busy: boolean;
  fehler: string | null;
  onSpeichern: () => void;
}) {
  const t = useTranslations("finance");
  const locale = useLocale();
  const artText = (art: AdressArt) => t(`kontaktePage.adressen.art.${art}`);
  return (
    <Sheet open={offen} onOpenChange={setOffen}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle className="font-display text-lg font-extrabold">
            {bearbeitet ? t("kontaktePage.adressen.editTitle") : t("kontaktePage.adressen.addTitle")}
          </SheetTitle>
          <SheetDescription>{t("kontaktePage.adressen.sheetDescription")}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ad-type">{t("kontaktePage.adressen.type")}</Label>
            <NativeSelect
              id="ad-type"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as AdressArt })}
            >
              {ADRESS_ARTEN.map((art) => (
                <option key={art} value={art}>
                  {artText(art)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ad-label">{t("kontaktePage.adressen.label")}</Label>
            <Input id="ad-label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ad-recipient">{t("kontaktePage.adressen.recipient")}</Label>
            <Input id="ad-recipient" value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="ad-street">{t("kontaktePage.adressen.street")}</Label>
              <Input id="ad-street" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ad-no">{t("kontaktePage.adressen.houseNumber")}</Label>
              <Input id="ad-no" value={form.houseNumber} onChange={(e) => setForm({ ...form, houseNumber: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ad-plz">{t("kontaktePage.adressen.postalCode")}</Label>
              <Input id="ad-plz" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="ad-city">{t("kontaktePage.adressen.city")}</Label>
              <Input id="ad-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ad-country">
              {t("kontaktePage.adressen.country")} <span className="text-destructive">*</span>
            </Label>
            <NativeSelect
              id="ad-country"
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
            >
              <option value="">—</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {landName(c.code, locale)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.isDefault}
              onCheckedChange={(v) => setForm({ ...form, isDefault: v === true })}
            />
            {t("kontaktePage.adressen.defaultCheckbox")}
          </label>
          {fehler && (
            <p className="rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {fehler}
            </p>
          )}
        </div>
        <SheetFooter className="flex-row gap-2 border-t">
          <Button type="button" variant="outline" className="flex-1" disabled={busy} onClick={() => setOffen(false)}>
            {t("kontaktePage.cancel")}
          </Button>
          <Button type="button" className="flex-1" disabled={busy} onClick={onSpeichern}>
            {busy ? t("kontaktePage.saving") : t("kontaktePage.save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
