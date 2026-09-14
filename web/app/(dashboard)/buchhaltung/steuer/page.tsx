// Buchhaltung → Steuer: Umsatzsteuer-Auswertung je Periode (länderneutral, bei
// DE mit Kennzahlen), eingefrorene Meldungen, Einnahmen-Ausgaben-Vorschau,
// Steuer-Parameter. Server Component: lädt den Startzustand über die
// "use server"-Actions; Interaktion in components/buchhaltung/steuer/.
//
// Kein Realtime: invoices/expenses/tax_returns sind für authenticated gesperrt
// (Wurzel 6) — Abos wären stumme Attrappen. Nach eigener Aktion lädt die Seite
// per router.refresh()/revalidatePath neu.
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { SteuerSeite } from "@/components/buchhaltung/steuer/steuer-seite";
import { Card } from "@nextdays/ui/card";
import {
  getProfitEstimate,
  getTaxSettings,
  getVatReturn,
  listTaxReturns,
} from "@/lib/buchhaltung-steuer";
import type { PeriodKind } from "@/lib/buchhaltung-steuer-typen";

function laufendePeriode(kind: PeriodKind | null, heute: Date): string {
  const y = heute.getFullYear();
  if (kind === "month") return `${y}-${String(heute.getMonth() + 1).padStart(2, "0")}`;
  if (kind === "year") return String(y);
  return `${y}-Q${Math.floor(heute.getMonth() / 3) + 1}`;
}

export default async function SteuerPage() {
  const t = await getTranslations("finance");
  const settingsRes = await getTaxSettings();
  if (!settingsRes.ok && settingsRes.status === 403) notFound();

  const settings = settingsRes.ok ? settingsRes.data : null;
  const heute = new Date();
  const period = laufendePeriode(settings?.vatPeriod ?? null, heute);

  const [vatRes, returnsRes, profitRes] = await Promise.all([
    getVatReturn(period),
    listTaxReturns(),
    getProfitEstimate(heute.getFullYear()),
  ]);

  if (!settingsRes.ok) {
    return (
      <Card className="p-5 text-sm text-destructive">
        {t("steuerPage.loadError")}
        <span className="block text-xs text-muted-foreground">{settingsRes.error}</span>
      </Card>
    );
  }

  return (
    <SteuerSeite
      initialPeriod={period}
      initialVat={vatRes.ok ? vatRes.data : null}
      initialVatError={vatRes.ok ? null : vatRes.error}
      initialProfit={profitRes.ok ? profitRes.data : null}
      returns={returnsRes.ok ? returnsRes.data.items : []}
      settings={settings}
    />
  );
}
