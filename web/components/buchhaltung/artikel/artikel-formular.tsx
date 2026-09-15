"use client";

// Anlegen/Bearbeiten eines Artikels (Buchhaltung → Artikel) als Sheet.
// Steuersatz wird mit dem Betriebssatz VORBELEGT, sofern hinterlegt — nie mit
// einer festen 19 (Wurzel 4). Währung leer = Mandanten-Währung (der Server
// entscheidet; fehlt sie dort, kommt sein 422 sichtbar zurück). Beträge gehen
// als String ans Backend, gerechnet wird dort (Decimal).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { InfoHinweis } from "@nextdays/ui/info-hinweis";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@nextdays/ui/sheet";
import { Switch } from "@nextdays/ui/switch";
import { Textarea } from "@nextdays/ui/textarea";
import { useNewAuth } from "@/contexts/NewAuthContext";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { createItem, updateItem } from "@/lib/buchhaltung-artikel";
import type { BillingItem, BillingItemCategory } from "@/lib/buchhaltung-artikel-typen";
import { steuersatz } from "@/lib/steuer-waehrung";

type Entwurf = {
  name: string;
  description: string;
  unit: string;
  unitPrice: string;
  taxRate: string;
  currency: string;
  category: string;
  isActive: boolean;
  isFavorite: boolean;
  itemNumber: string;
};

const LEER: Entwurf = {
  name: "",
  description: "",
  unit: "",
  unitPrice: "",
  taxRate: "",
  currency: "",
  category: "",
  isActive: true,
  isFavorite: false,
  itemNumber: "",
};

function ausArtikel(a: BillingItem): Entwurf {
  return {
    name: a.name,
    description: a.description ?? "",
    unit: a.unit,
    unitPrice: a.unitPrice,
    taxRate: a.taxRate,
    currency: a.currency,
    category: a.category ?? "",
    isActive: a.isActive,
    isFavorite: a.isFavorite,
    itemNumber: a.itemNumber,
  };
}

export function ArtikelFormular({
  open,
  onOpenChange,
  artikel,
  kategorien = [],
  onGespeichert,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Vorhanden → Bearbeiten; fehlt → Anlegen. */
  artikel?: BillingItem | null;
  kategorien?: BillingItemCategory[];
  onGespeichert?: (artikel: BillingItem) => void;
}) {
  const t = useTranslations("finance");
  const router = useRouter();
  const { user } = useNewAuth();
  const { settings } = useCompanySettings(user?.uid);
  const betriebsSatz = steuersatz(settings?.defaultTaxRate);
  const [entwurf, setEntwurf] = useState<Entwurf>(LEER);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bearbeiten = Boolean(artikel);

  // Beim Öffnen vorbelegen: Bestand aus dem Artikel, Neuanlage leer + Betriebssatz.
  useEffect(() => {
    if (!open) return;
    setError(null);
    if (artikel) {
      setEntwurf(ausArtikel(artikel));
    } else {
      setEntwurf({ ...LEER, taxRate: betriebsSatz !== null ? String(betriebsSatz) : "" });
    }
  }, [open, artikel, betriebsSatz]);

  const setzen = <K extends keyof Entwurf>(feld: K, wert: Entwurf[K]) =>
    setEntwurf((e) => ({ ...e, [feld]: wert }));

  function pruefen(): string | null {
    if (!entwurf.name.trim()) return t("artikelFormular.errorName");
    if (!entwurf.unit.trim()) return t("artikelFormular.errorUnit");
    const preis = Number(entwurf.unitPrice.replace(",", "."));
    if (!Number.isFinite(preis) || preis < 0) return t("artikelFormular.errorPrice");
    if (steuersatz(entwurf.taxRate.replace(",", ".")) === null) {
      return t("artikelFormular.errorTaxRate");
    }
    if (entwurf.currency.trim() && !/^[A-Za-z]{3}$/.test(entwurf.currency.trim())) {
      return t("artikelFormular.errorCurrency");
    }
    return null;
  }

  async function speichern() {
    const fehler = pruefen();
    if (fehler) {
      setError(fehler);
      return;
    }
    setBusy(true);
    setError(null);
    const gemeinsam = {
      name: entwurf.name.trim(),
      description: entwurf.description.trim() || null,
      unit: entwurf.unit.trim(),
      unitPrice: entwurf.unitPrice.replace(",", "."),
      taxRate: entwurf.taxRate.replace(",", "."),
      currency: entwurf.currency.trim().toUpperCase() || null,
      category: entwurf.category.trim() || null,
      isActive: entwurf.isActive,
      isFavorite: entwurf.isFavorite,
    };
    const res = artikel
      ? await updateItem(artikel.id, gemeinsam)
      : await createItem({ ...gemeinsam, itemNumber: entwurf.itemNumber.trim() || null });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.success(
      bearbeiten ? t("artikelFormular.savedUpdate") : t("artikelFormular.savedCreate"),
    );
    onGespeichert?.(res.data);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle className="font-display text-lg font-extrabold">
            {bearbeiten ? t("artikelFormular.titleEdit") : t("artikelFormular.titleCreate")}
          </SheetTitle>
          <SheetDescription>{t("artikelFormular.description")}</SheetDescription>
        </SheetHeader>

        <ArtikelFelder
          entwurf={entwurf}
          setzen={setzen}
          bearbeiten={bearbeiten}
          kategorien={kategorien}
          error={error}
        />

        <SheetFooter className="flex-row gap-2 border-t">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {t("artikelFormular.cancel")}
          </Button>
          <Button type="button" className="flex-1" disabled={busy} onClick={speichern}>
            {busy ? t("artikelFormular.submitting") : t("artikelFormular.submit")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** Die Felder des Artikels. Eigene Komponente, damit das Sheet selbst nur noch
 *  Laden, Speichern und Fehler führt. */
function ArtikelFelder({
  entwurf,
  setzen,
  bearbeiten,
  kategorien,
  error,
}: {
  entwurf: Entwurf;
  setzen: <K extends keyof Entwurf>(k: K, v: Entwurf[K]) => void;
  bearbeiten: boolean;
  kategorien: BillingItemCategory[];
  error: string | null;
}) {
  const t = useTranslations("finance");
  return (
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="art-name">{t("artikelFormular.nameLabel")}</Label>
            <Input
              id="art-name"
              value={entwurf.name}
              maxLength={200}
              onChange={(e) => setzen("name", e.target.value)}
              placeholder={t("artikelFormular.namePlaceholder")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1">
              <Label htmlFor="art-nummer">{t("artikelFormular.numberLabel")}</Label>
              <InfoHinweis
                ariaLabel={t("artikelFormular.numberHintAria")}
                text={t("artikelFormular.numberHint")}
              />
            </div>
            <Input
              id="art-nummer"
              value={entwurf.itemNumber}
              maxLength={40}
              disabled={bearbeiten}
              onChange={(e) => setzen("itemNumber", e.target.value)}
              placeholder={t("artikelFormular.numberPlaceholder")}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="art-beschreibung">{t("artikelFormular.descriptionLabel")}</Label>
          <Textarea
            id="art-beschreibung"
            rows={3}
            maxLength={2000}
            value={entwurf.description}
            onChange={(e) => setzen("description", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="art-einheit">{t("artikelFormular.unitLabel")}</Label>
            <Input
              id="art-einheit"
              value={entwurf.unit}
              maxLength={40}
              onChange={(e) => setzen("unit", e.target.value)}
              placeholder={t("artikelFormular.unitPlaceholder")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="art-preis">{t("artikelFormular.priceLabel")}</Label>
            <Input
              id="art-preis"
              inputMode="decimal"
              value={entwurf.unitPrice}
              onChange={(e) => setzen("unitPrice", e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1">
              <Label htmlFor="art-steuer">{t("artikelFormular.taxRateLabel")}</Label>
              <InfoHinweis
                ariaLabel={t("artikelFormular.taxRateHintAria")}
                text={t("artikelFormular.taxRateHint")}
              />
            </div>
            <Input
              id="art-steuer"
              inputMode="decimal"
              value={entwurf.taxRate}
              onChange={(e) => setzen("taxRate", e.target.value)}
              placeholder="%"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1">
              <Label htmlFor="art-waehrung">{t("artikelFormular.currencyLabel")}</Label>
              <InfoHinweis
                ariaLabel={t("artikelFormular.currencyHintAria")}
                text={t("artikelFormular.currencyHint")}
              />
            </div>
            <Input
              id="art-waehrung"
              value={entwurf.currency}
              maxLength={3}
              className="uppercase"
              onChange={(e) => setzen("currency", e.target.value)}
              placeholder={t("artikelFormular.currencyPlaceholder")}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="art-kategorie">{t("artikelFormular.categoryLabel")}</Label>
          <Input
            id="art-kategorie"
            list="art-kategorien"
            value={entwurf.category}
            maxLength={80}
            onChange={(e) => setzen("category", e.target.value)}
            placeholder={t("artikelFormular.categoryPlaceholder")}
          />
          <datalist id="art-kategorien">
            {kategorien.map((k) => (
              <option key={k.name} value={k.name} />
            ))}
          </datalist>
        </div>

        <ArtikelSchalter entwurf={entwurf} setzen={setzen} />

        {error && (
          <p className="rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
  );
}

function ArtikelSchalter({
  entwurf,
  setzen,
}: {
  entwurf: Entwurf;
  setzen: <K extends keyof Entwurf>(k: K, v: Entwurf[K]) => void;
}) {
  const t = useTranslations("finance");
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="flex items-center justify-between gap-3 rounded-(--radius) border border-border px-3 py-2 text-sm">
        <span>{t("artikelFormular.activeLabel")}</span>
        <Switch
          checked={entwurf.isActive}
          onCheckedChange={(v) => setzen("isActive", v)}
          aria-label={t("artikelFormular.activeLabel")}
        />
      </label>
      <label className="flex items-center justify-between gap-3 rounded-(--radius) border border-border px-3 py-2 text-sm">
        <span className="flex items-center gap-1.5">
          <Icon icon="ph:star" className="size-4 text-accent" />
          {t("artikelFormular.favoriteLabel")}
        </span>
        <Switch
          checked={entwurf.isFavorite}
          onCheckedChange={(v) => setzen("isFavorite", v)}
          aria-label={t("artikelFormular.favoriteLabel")}
        />
      </label>
    </div>
  );
}
