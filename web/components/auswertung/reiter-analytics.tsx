"use client";

// Reiter „Analytics" — Verlauf und Verteilung.
//
// Drei Diagramme statt eines Widget-Baukastens (Hostaways Weg): der Baukasten
// verlangt, dass jeder Betrieb sich seine Sicht erst zusammenklickt. Die drei
// Fragen, die jeder stellt — wie läuft es über die Zeit, woher kommt der
// Umsatz, welches Objekt trägt — beantwortet die Seite ungefragt.
import { useTranslations } from "next-intl";
import { Card } from "@nextdays/ui/card";
// ALLES aus EINER Quelle — auch die recharts-Primitiven. Sie direkt aus
// "recharts" zu holen, holt im Monorepo eine ZWEITE Modulinstanz (packages/ui
// und web haben je eine eigene Kopie). recharts reicht die berechnete
// Diagrammgröße über einen React-Context weiter, der an die Instanz gebunden
// ist: der Provider des `ChartContainer` füllt dann einen Context, den
// `LineChart` nie liest. Ergebnis ist ein korrekt bemessener, aber komplett
// leerer Kasten — kein SVG, keine Fehlermeldung. Live passiert am 30.08.2026,
// derselbe Fehler wie zuvor in portal-statistiken.tsx.
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "@nextdays/ui/chart";
import { formatCurrency } from "@/lib/currency";
import type { Auswertung } from "@/lib/auswertung-typen";

// Feste Farbfolge aus den Design-Tokens — keine arbitrary Hex-Werte.
const FARBEN = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function ReiterAnalytics({ a }: { a: Auswertung }) {
  const t = useTranslations("analysis");

  if (!a.verlauf.length) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        {t("empty")}
      </Card>
    );
  }

  const geld = (v: number) => (a.currency ? formatCurrency(v, a.currency) : String(v));

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3 p-5">
        <h3 className="font-display text-base font-extrabold">
          {t("chart.revenueOverTime")}
        </h3>
        <ChartContainer
          config={{ umsatz: { label: t("kpi.revenue"), color: FARBEN[0] } }}
          className="h-64 w-full"
        >
          <LineChart data={a.verlauf}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="period" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis tickLine={false} axisLine={false} fontSize={11} width={70} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              type="monotone"
              dataKey="umsatz"
              stroke="var(--color-umsatz)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3 p-5">
          <h3 className="font-display text-base font-extrabold">
            {t("chart.shareByChannel")}
          </h3>
          {a.kanaele.length ? (
            <ChartContainer config={{}} className="h-64 w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={a.kanaele.map((k) => ({
                    name: k.ota_name || k.channel,
                    value: k.umsatz,
                  }))}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={95}
                >
                  {a.kanaele.map((k, i) => (
                    <Cell key={k.channel + i} fill={FARBEN[i % FARBEN.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          ) : (
            <p className="py-16 text-center text-sm text-muted-foreground">
              {t("empty")}
            </p>
          )}
        </Card>

        <Card className="flex flex-col gap-3 p-5">
          <h3 className="font-display text-base font-extrabold">
            {t("chart.revenueByProperty")}
          </h3>
          {a.objekte.some((o) => o.umsatz > 0) ? (
            <ChartContainer
              config={{ umsatz: { label: t("kpi.revenue"), color: FARBEN[1] } }}
              className="h-64 w-full"
            >
              <BarChart
                data={a.objekte.filter((o) => o.umsatz > 0).slice(0, 10)}
                layout="vertical"
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis
                  type="category"
                  dataKey="title"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  width={130}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="umsatz" fill="var(--color-umsatz)" radius={4} />
              </BarChart>
            </ChartContainer>
          ) : (
            <p className="py-16 text-center text-sm text-muted-foreground">
              {t("empty")}
            </p>
          )}
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("chart.footnote", { total: geld(a.kennzahlen.umsatz) })}
      </p>
    </div>
  );
}
