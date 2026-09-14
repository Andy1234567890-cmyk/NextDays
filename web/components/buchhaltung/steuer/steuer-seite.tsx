"use client";

// Buchhaltung → Steuer: Reiter Umsatzsteuer · Einnahmen/Ausgaben · Meldungen ·
// Einstellungen. Der Server liefert den Startzustand (Seite), Periodenwechsel
// laden über die Server-Actions nach. Kein Realtime: `invoices`, `expenses`,
// `tax_returns` sind für authenticated gesperrt (Wurzel 6) — nach eigener
// Aktion `router.refresh()`.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { Segmented } from "@nextdays/ui/segmented";
import { freezeVatReturn, getProfitEstimate, getVatReturn } from "@/lib/buchhaltung-steuer";
import type {
  ProfitEstimate,
  TaxReturn,
  TaxSettings,
  VatReturn,
} from "@/lib/buchhaltung-steuer-typen";

import { EuerChart } from "./euer-chart";
import { MeldungenHistorie } from "./meldungen-historie";
import { PeriodenWahl, periodeZerlegen, periodenSchluessel, type PeriodenTeile } from "./perioden-wahl";
import { SteuerEinstellungen } from "./steuer-einstellungen";
import { UstvaTabelle } from "./ustva-tabelle";

type Reiter = "vat" | "profit" | "returns" | "settings";

export function SteuerSeite({
  initialPeriod,
  initialVat,
  initialVatError,
  initialProfit,
  returns,
  settings,
}: {
  initialPeriod: string;
  initialVat: VatReturn | null;
  initialVatError: string | null;
  initialProfit: ProfitEstimate | null;
  returns: TaxReturn[];
  settings: TaxSettings | null;
}) {
  const t = useTranslations("finance");
  const locale = useLocale();
  const router = useRouter();
  const [reiter, setReiter] = useState<Reiter>("vat");
  const [periode, setPeriode] = useState<PeriodenTeile>(() => periodeZerlegen(initialPeriod));
  const [vat, setVat] = useState<VatReturn | null>(initialVat);
  const [vatError, setVatError] = useState<string | null>(initialVatError);
  const [vatLoading, setVatLoading] = useState(false);
  const [year, setYear] = useState<number>(initialProfit?.year ?? new Date().getFullYear());
  const [profit, setProfit] = useState<ProfitEstimate | null>(initialProfit);
  const [profitLoading, setProfitLoading] = useState(false);
  const [freezing, setFreezing] = useState(false);

  const key = periodenSchluessel(periode);

  // Server-Neuladen (router.refresh nach Freeze/Einstellungen) bringt neue
  // Startwerte — übernehmen, sonst zeigt die Tabelle den alten frozenVersion.
  useEffect(() => {
    if (key === initialPeriod) {
      setVat(initialVat);
      setVatError(initialVatError);
    }
  }, [initialVat, initialVatError, initialPeriod, key]);

  useEffect(() => {
    if (key === initialPeriod) return;
    let aktiv = true;
    setVatLoading(true);
    getVatReturn(key).then((res) => {
      if (!aktiv) return;
      setVatLoading(false);
      if (res.ok) {
        setVat(res.data);
        setVatError(null);
      } else {
        setVat(null);
        setVatError(res.error);
      }
    });
    return () => {
      aktiv = false;
    };
  }, [key, initialPeriod]);

  useEffect(() => {
    if (initialProfit && year === initialProfit.year) {
      setProfit(initialProfit);
      return;
    }
    let aktiv = true;
    setProfitLoading(true);
    getProfitEstimate(year).then((res) => {
      if (!aktiv) return;
      setProfitLoading(false);
      if (res.ok) setProfit(res.data);
      else {
        setProfit(null);
        toast.error(res.error);
      }
    });
    return () => {
      aktiv = false;
    };
  }, [year, initialProfit]);

  async function einfrieren() {
    setFreezing(true);
    const res = await freezeVatReturn(key);
    setFreezing(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("steuerPage.frozen", { period: res.data.period, version: res.data.version }));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-extrabold">{t("steuerPage.taxTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("steuerPage.subtitle")}</p>
        </div>
        <Segmented<Reiter>
          value={reiter}
          onChange={setReiter}
          variant="solid"
          options={[
            { value: "vat", label: t("steuerPage.tabVat") },
            { value: "profit", label: t("steuerPage.tabProfit") },
            { value: "returns", label: t("steuerPage.tabReturns") },
            { value: "settings", label: t("steuerPage.tabSettings") },
          ]}
        />
      </div>

      {reiter === "vat" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <PeriodenWahl value={periode} onChange={setPeriode} locale={locale} />
            <div className="flex items-center gap-3">
              {vat?.frozenVersion != null && (
                <span className="text-xs text-muted-foreground">
                  {t("steuerPage.frozenVersion", { version: vat.frozenVersion })}
                </span>
              )}
              <Button
                variant="accent"
                className="rounded-full"
                disabled={!vat || freezing || vatLoading}
                onClick={einfrieren}
              >
                {freezing ? (
                  <Icon icon="ph:spinner" className="size-4 animate-spin" />
                ) : (
                  <Icon icon="ph:snowflake" className="size-4" />
                )}
                {t("steuerPage.freeze")}
              </Button>
            </div>
          </div>
          {vatLoading ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">{t("steuerPage.loading")}</Card>
          ) : vatError ? (
            <Card className="p-5 text-sm text-destructive">{vatError}</Card>
          ) : vat ? (
            <UstvaTabelle data={vat} />
          ) : null}
          <p className="text-xs text-muted-foreground">{t("steuerPage.noElsterNote")}</p>
        </div>
      )}

      {reiter === "profit" && (
        <EuerChart data={profit} year={year} onYearChange={setYear} loading={profitLoading} />
      )}

      {reiter === "returns" && <MeldungenHistorie items={returns} />}

      {reiter === "settings" && <SteuerEinstellungen settings={settings} />}
    </div>
  );
}
