"use client";

// Mini-Verlaufsgraph in jeder KPI-Kachel (..): die Tagesreihe der Metrik
// als kleiner Area-Chart ohne Achsen/Grid — nur die Kurve. recharts +
// Chart-Token (var(--chart-1)), gleiche Infrastruktur wie die großen Charts.
import { Area, AreaChart } from "recharts";

import { ChartContainer, type ChartConfig } from "@nextdays/ui/chart";
import type { StatPoint } from "@/lib/reservations";

const CONFIG: ChartConfig = { value: { label: "Wert", color: "var(--chart-1)" } };

export function KpiSparkline({ points }: { points: StatPoint[] }) {
  // Ohne Bewegung (alle 0) keine Kurve zeichnen — sonst nur eine flache Linie.
  if (points.length === 0 || points.every((p) => p.value === 0)) {
    return <div className="h-12" aria-hidden />;
  }
  const id = `spark-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <ChartContainer config={CONFIG} className="h-12 w-full">
      <AreaChart data={points} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          dataKey="value"
          type="monotone"
          stroke="var(--chart-1)"
          strokeWidth={2}
          fill={`url(#${id})`}
          isAnimationActive={false}
          dot={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}
