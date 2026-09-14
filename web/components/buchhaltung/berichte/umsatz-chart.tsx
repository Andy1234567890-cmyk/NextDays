"use client";

// Umsatz-Zeitreihe: EINE Reihe → Linie; mehrere Reihen (Kunde/Objekt/Kanal)
// → gestapelte Balken. Höchstens fünf Reihen tragen eine eigene Farbe
// (--chart-1..5, feste Reihenfolge nach Umsatz), der Rest wird zu „Weitere"
// zusammengefasst — nie eine sechste erfundene Farbe. Alle Primitiven aus
// @nextdays/ui/chart (eine recharts-Instanz im Monorepo, siehe reiter-analytics).
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";

import type { ChartConfig } from "@nextdays/ui/chart";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "@nextdays/ui/chart";
import type { RevenueResponse, Zeitreihe } from "@/lib/buchhaltung-berichte-typen";

import { geld, periodeLabel, zahl } from "./format";

const MAX_REIHEN = 5;
const FARBEN = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

type Punkt = Record<string, number | string>;
// Nur das oberste Segment eines Stapels bekommt die runden Enden.
const OBEN_RUND: [number, number, number, number] = [4, 4, 0, 0];

function reihenFalten(reihen: Zeitreihe[], perioden: string[], weitere: string): Zeitreihe[] {
  if (reihen.length <= MAX_REIHEN) return reihen;
  const kopf = reihen.slice(0, MAX_REIHEN - 1);
  const rest = reihen.slice(MAX_REIHEN - 1);
  const summe = (f: (z: Zeitreihe) => string) => rest.reduce((a, z) => a + zahl(f(z)), 0);
  return [
    ...kopf,
    {
      key: "__weitere",
      label: weitere,
      summeNetto: String(summe((z) => z.summeNetto)),
      summeBrutto: String(summe((z) => z.summeBrutto)),
      punkte: perioden.map((p) => ({
        periode: p,
        netto: String(rest.reduce((a, z) => a + zahl(z.punkte.find((x) => x.periode === p)?.netto ?? 0), 0)),
        brutto: "0",
        anzahl: rest.reduce((a, z) => a + (z.punkte.find((x) => x.periode === p)?.anzahl ?? 0), 0),
      })),
    },
  ];
}

export function UmsatzChart({ daten }: { daten: RevenueResponse }) {
  const t = useTranslations("finance");
  const locale = useLocale();
  const reihen = useMemo(
    () => reihenFalten(daten.reihen, daten.perioden, t("umsatzPage.weitere")),
    [daten.reihen, daten.perioden, t],
  );
  const punkte: Punkt[] = useMemo(
    () =>
      daten.perioden.map((p) => {
        const zeile: Punkt = { periode: p, label: periodeLabel(p, locale) };
        for (const r of reihen) zeile[r.key] = zahl(r.punkte.find((x) => x.periode === p)?.netto ?? 0);
        return zeile;
      }),
    [daten.perioden, reihen, locale],
  );
  const config: ChartConfig = Object.fromEntries(
    reihen.map((r, i) => [r.key, { label: r.label, color: FARBEN[i % FARBEN.length] }]),
  );
  const format = (v: unknown) => geld(typeof v === "number" ? v : Number(v), daten.currency);

  if (daten.reihen.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">{t("berichteGemeinsam.keineDaten")}</p>
    );
  }

  const achsen = (
    <>
      <CartesianGrid vertical={false} strokeDasharray="3 3" />
      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
      <YAxis tickLine={false} axisLine={false} width={72} tickFormatter={(v) => format(v)} />
      <ChartTooltip content={<ChartTooltipContent formatter={(v) => format(v)} />} />
    </>
  );

  return (
    <ChartContainer config={config} className="h-72 w-full aspect-auto">
      {reihen.length === 1 ? (
        <LineChart data={punkte} margin={{ left: 4, right: 12, top: 8 }}>
          {achsen}
          <Line
            type="monotone"
            dataKey={reihen[0].key}
            stroke={`var(--color-${reihen[0].key})`}
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      ) : (
        <BarChart data={punkte} margin={{ left: 4, right: 12, top: 8 }}>
          {achsen}
          <ChartLegend content={<ChartLegendContent />} />
          {reihen.map((r, i) => (
            <Bar
              key={r.key}
              dataKey={r.key}
              stackId="umsatz"
              fill={`var(--color-${r.key})`}
              stroke="var(--card)"
              strokeWidth={1}
              radius={i === reihen.length - 1 ? OBEN_RUND : 0}
            />
          ))}
        </BarChart>
      )}
    </ChartContainer>
  );
}
