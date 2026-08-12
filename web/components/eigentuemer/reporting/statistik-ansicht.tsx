"use client";

// Bilanzstatistik — zwei Diagramme, weil zwei verschiedene Fragen:
//
//   „Im Laufe der Zeit gezahltes Geld"   → Fläche über der Zeit.
//        Eine Zeitreihe braucht eine durchgehende Achse; als Balken gelesen
//        wäre jeder Monat eine Insel und der Verlauf verschwände.
//   „Aufschlüsselung nach Kategorien"    → Ring.
//        Fünf Teile EINES Ganzen. Als Balken nebeneinander ginge die Aussage
//        „zusammen 100 %" verloren, und genau die ist hier der Punkt.
//
// Beide lesen NUR, was der Server geliefert hat. Der Prozentanteil im Ring
// wird nicht im Browser gerechnet: Recharts leitet ihn aus denselben Werten
// ab, die auch die Legende zeigt.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, XAxis } from "recharts";

import { Card } from "@nextdays/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@nextdays/ui/chart";
import { DatePicker } from "@nextdays/ui/date-picker";
import { Label } from "@nextdays/ui/label";
import { formatCurrency } from "@/lib/currency";
import type { Abschnitt, Statistik } from "@/lib/owner-reporting";

/** Feste Farbzuordnung je Abschnitt.
 *
 *  Bewusst fest und nicht nach Index vergeben: bei einem Zeitraum ohne
 *  Ausgaben rutschten sonst alle Folgefarben eine Position weiter, und
 *  „Gebühren" wäre im Juli grün und im August violett. */
const FARBE: Record<Abschnitt, string> = {
  unterkunftspreis: "var(--chart-1)",
  gebuehren: "var(--chart-2)",
  steuern: "var(--chart-3)",
  ausgaben: "var(--chart-4)",
  andere: "var(--chart-5)",
};

export function StatistikAnsicht({
  statistik,
  von,
  bis,
  loadError,
}: {
  statistik: Statistik | null;
  von: string;
  bis: string;
  loadError: string | null;
}) {
  const t = useTranslations("ownerReporting.statistics");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function zeitraum(nextVon: string, nextBis: string) {
    startTransition(() =>
      router.push(
        `/eigentuemer/reporting/statistiken?von=${nextVon}&bis=${nextBis}`,
      ),
    );
  }

  const w = statistik?.currency ?? "";
  const geld = (v: number) => formatCurrency(v, w, locale);

  const verlaufConfig: ChartConfig = {
    amount: { label: t("charts.paid"), color: "var(--chart-1)" },
  };
  const kategorieConfig: ChartConfig = Object.fromEntries(
    (statistik?.categories ?? []).map((c) => [
      c.abschnitt,
      { label: t(`sections.${c.abschnitt}`), color: FARBE[c.abschnitt] },
    ]),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-extrabold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card className="flex flex-wrap items-end gap-4 p-5">
        <div className="flex min-w-40 flex-col gap-1">
          <Label htmlFor="stat-von">{t("from")}</Label>
          <DatePicker
            value={von}
            onChange={(v) => zeitraum(v, bis)}
            disabled={pending}
          />
        </div>
        <div className="flex min-w-40 flex-col gap-1">
          <Label htmlFor="stat-bis">{t("to")}</Label>
          <DatePicker
            value={bis}
            onChange={(v) => zeitraum(von, v)}
            disabled={pending}
          />
        </div>
      </Card>

      {loadError ? (
        <Card className="p-5 text-sm text-destructive">{loadError}</Card>
      ) : !statistik || statistik.points.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-secondary">
            <Icon
              icon="ph:chart-donut"
              className="size-7 text-muted-foreground"
            />
          </span>
          <p className="font-display text-lg font-extrabold">{t("emptyTitle")}</p>
          <p className="max-w-md text-sm text-muted-foreground">
            {t("emptyHint")}
          </p>
        </Card>
      ) : (
        <>
          {statistik.other_currencies.length > 0 && (
            // Beträge verschiedener Währungen werden NICHT addiert (Wurzel 4).
            // Statt sie stillschweigend wegzulassen, wird benannt, was
            // außerhalb der Leitwährung liegt.
            <Card className="flex flex-col gap-1 p-4 text-sm">
              <span className="font-semibold">{t("otherCurrencies")}</span>
              <span className="text-muted-foreground">
                {statistik.other_currencies
                  .map((c) => formatCurrency(c.amount, c.currency, locale))
                  .join(" · ")}
              </span>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="flex flex-col gap-4 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <h2 className="font-display text-lg font-extrabold">
                    {t("charts.paid")}
                  </h2>
                  <span className="font-display text-2xl font-extrabold tabular-nums text-accent">
                    {geld(statistik.total)}
                  </span>
                </div>
                <Veraenderung pct={statistik.change_pct} />
              </div>
              <ChartContainer config={verlaufConfig} className="h-56 w-full">
                <AreaChart
                  data={statistik.points}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="stat-paid" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="var(--chart-1)"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--chart-1)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="period"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    fontSize={12}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => geld(Number(value))}
                      />
                    }
                  />
                  <Area
                    dataKey="amount"
                    type="monotone"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    fill="url(#stat-paid)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ChartContainer>
            </Card>

            <Card className="flex flex-col gap-4 p-6">
              <h2 className="font-display text-lg font-extrabold">
                {t("charts.categories")}
              </h2>
              {statistik.categories.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  {t("charts.noCategories")}
                </p>
              ) : (
                <div className="flex flex-col items-center gap-4 sm:flex-row">
                  <ChartContainer
                    config={kategorieConfig}
                    className="h-56 w-full sm:w-56"
                  >
                    <PieChart>
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value) => geld(Number(value))}
                          />
                        }
                      />
                      <Pie
                        data={statistik.categories}
                        dataKey="amount"
                        nameKey="abschnitt"
                        innerRadius="55%"
                        outerRadius="85%"
                        isAnimationActive={false}
                      >
                        {statistik.categories.map((c) => (
                          <Cell
                            key={c.abschnitt}
                            fill={FARBE[c.abschnitt]}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  <ul className="flex w-full flex-col gap-2 text-sm">
                    {statistik.categories.map((c) => (
                      <li
                        key={c.abschnitt}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className="size-2.5 rounded-full"
                            style={{ background: FARBE[c.abschnitt] }}
                          />
                          {t(`sections.${c.abschnitt}`)}
                        </span>
                        <span className="tabular-nums">{geld(c.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Veränderung zur gleich langen Vorperiode.
 *
 * `null` heißt: die Vorperiode war 0. Dann steht „—" und nicht „+100 %" — ein
 * Prozentwert gegenüber nichts ist keine Aussage (Wurzel 4).
 */
function Veraenderung({ pct }: { pct: number | null }) {
  const t = useTranslations("ownerReporting.statistics");
  if (pct === null) {
    return (
      <span className="text-xs text-muted-foreground">{t("noPrevious")}</span>
    );
  }
  const hoch = pct >= 0;
  return (
    <span
      className={`flex items-center gap-1 text-sm font-semibold tabular-nums ${
        hoch ? "text-accent" : "text-destructive"
      }`}
    >
      <Icon
        icon={hoch ? "ph:arrow-up" : "ph:arrow-down"}
        className="size-4"
      />
      {Math.abs(pct).toFixed(2)} %
    </span>
  );
}
