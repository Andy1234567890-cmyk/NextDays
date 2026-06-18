"use client";

// Umsatzentwicklung (Lastenheft §2.1) — Area-Chart über die letzten Monate.
// Beispieldaten; später aus dem FastAPI-Backend (payments/reservations).
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const data = [
  { monat: "Jan", umsatz: 12400 },
  { monat: "Feb", umsatz: 14100 },
  { monat: "Mär", umsatz: 18900 },
  { monat: "Apr", umsatz: 22300 },
  { monat: "Mai", umsatz: 31200 },
  { monat: "Jun", umsatz: 38600 },
];

const config = {
  umsatz: { label: "Umsatz", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function RevenueChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Umsatzentwicklung</CardTitle>
        <CardDescription>Letzte 6 Monate (Beispieldaten)</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-64 w-full">
          <AreaChart data={data} margin={{ left: 4, right: 4, top: 4 }}>
            <defs>
              <linearGradient id="fillUmsatz" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="monat"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={48}
              tickFormatter={(v) => `${(v / 1000).toLocaleString("de-DE")}k €`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) =>
                    `${Number(value).toLocaleString("de-DE")} €`
                  }
                />
              }
            />
            <Area
              dataKey="umsatz"
              type="natural"
              fill="url(#fillUmsatz)"
              stroke="var(--chart-1)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
