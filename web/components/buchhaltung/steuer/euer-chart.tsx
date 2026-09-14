"use client";

// Einnahmen-Ausgaben-Vorschau (in DE: EÜR): Balken je Monat für Einnahmen und
// Ausgaben, Linie für den kumulierten Gewinn. Steuerschätzung nur, wenn der
// Betrieb seine Sätze gesetzt hat (settingsComplete) — sonst steht das offen da.
//
// recharts-Primitiven aus "@nextdays/ui/chart" holen, nicht aus "recharts":
// im Monorepo gibt es sonst zwei Modulinstanzen und der Tooltip-Context bricht
// (portal-statistiken.tsx, Z. 29-33).
import { useLocale, useTranslations } from "next-intl";

import { Card, CardContent } from "@nextdays/ui/card";
import {
  Bar,
  CartesianGrid,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  type ChartConfig,
} from "@nextdays/ui/chart";
import { NativeSelect } from "@nextdays/ui/native-select";
import type { ProfitEstimate } from "@/lib/buchhaltung-steuer-typen";
import { formatCurrency } from "@/lib/currency";

import { geld } from "./ustva-tabelle";

export function EuerChart({
  data,
  year,
  onYearChange,
  loading,
}: {
  data: ProfitEstimate | null;
  year: number;
  onYearChange: (y: number) => void;
  loading: boolean;
}) {
  const t = useTranslations("finance");
  const locale = useLocale();
  const monat = new Intl.DateTimeFormat(locale, { month: "short" });
  const jetzt = new Date().getFullYear();
  const jahre = Array.from({ length: 6 }, (_, i) => jetzt + 1 - i);

  const config: ChartConfig = {
    incomeNet: { label: t("steuerPage.income"), color: "var(--chart-1)" },
    expensesNet: { label: t("steuerPage.expenses"), color: "var(--chart-4)" },
    cumulativeProfit: { label: t("steuerPage.cumulativeProfit"), color: "var(--chart-2)" },
  };

  const punkte = (data?.months ?? []).map((m) => ({
    label: monat.format(new Date(year, m.month - 1, 1)),
    incomeNet: Number(m.incomeNet),
    expensesNet: Number(m.expensesNet),
    cumulativeProfit: Number(m.cumulativeProfit),
  }));
  const c = data?.currency ?? "";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-28">
          <NativeSelect
            aria-label={t("steuerPage.periodYear")}
            value={year}
            onChange={(e) => onYearChange(Number(e.target.value))}
          >
            {jahre.map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </NativeSelect>
        </div>
        {loading && <span className="text-xs text-muted-foreground">{t("steuerPage.loading")}</span>}
      </div>

      {data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Zahl titel={t("steuerPage.income")} wert={geld(data.incomeNetTotal, c)} />
          <Zahl titel={t("steuerPage.expenses")} wert={geld(data.expensesNetTotal, c)} />
          <Zahl titel={t("steuerPage.profit")} wert={geld(data.profitTotal, c)} betont />
          <Zahl
            titel={t("steuerPage.estimatedTax")}
            wert={
              data.estimatedTaxTotal !== null
                ? geld(data.estimatedTaxTotal, c)
                : t("steuerPage.noEstimate")
            }
            sub={
              data.taxRateTotal !== null
                ? t("steuerPage.estimatedWith", { rate: Number(data.taxRateTotal).toLocaleString(locale) })
                : t("steuerPage.noEstimateHint")
            }
          />
        </div>
      )}

      {data && data.estimatedReserve !== null && (
        <p className="text-sm text-muted-foreground">
          {t("steuerPage.reserveHint", { amount: geld(data.estimatedReserve, c) })}
        </p>
      )}

      {data?.warnings.map((w) => (
        <p key={w} className="text-sm text-amber-700 dark:text-amber-300">
          {w}
        </p>
      ))}

      <Card>
        <CardContent className="py-5">
          <ChartContainer config={config} className="h-72 w-full">
            <ComposedChart data={punkte} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={72}
                fontSize={12}
                tickFormatter={(v) => formatCurrency(Number(v), c)}
              />
              <ChartTooltip
                content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value), c)} />}
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="incomeNet" fill="var(--chart-1)" radius={4} isAnimationActive={false} />
              <Bar dataKey="expensesNet" fill="var(--chart-4)" radius={4} isAnimationActive={false} />
              <Line
                type="monotone"
                dataKey="cumulativeProfit"
                stroke="var(--chart-2)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function Zahl({ titel, wert, sub, betont = false }: { titel: string; wert: string; sub?: string; betont?: boolean }) {
  return (
    <Card className={betont ? "border-accent/40" : ""}>
      <CardContent className="flex flex-col gap-1 py-4">
        <div className="text-xs text-muted-foreground">{titel}</div>
        <div className={`font-display text-xl font-extrabold ${betont ? "text-accent" : ""}`}>{wert}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}
