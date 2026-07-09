"use client";

// Objekt-Statistiken (Lodgify „Kontrollzentrum"): KPI-Kacheln mit Vergleich zur
// Vorperiode + Kanal-Verteilung als Donut (recharts + shadcn ChartContainer,
// gleiche Infrastruktur wie dashboard/revenue-chart). Zeitraum-Wähler oben.
// Daten aus getPropertyStats; live über useRealtime. Beträge kommen maskiert
// (null → „No Data Found" / keine Kachel — kein erfundener Wert).
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart } from "recharts";

import { Card } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { NativeSelect } from "@/components/ui/native-select";
import { channelMeta } from "@/lib/calendar-channels";
import { formatCurrency } from "@/lib/currency";
import {
  type PropertyStats,
  type StatKpi,
  getPropertyStats,
} from "@/lib/reservations";
import { useRealtime } from "@/lib/use-realtime";

const RANGES = [
  { key: "30", label: "Letzte 30 Tage", days: 30 },
  { key: "90", label: "Letzte 90 Tage", days: 90 },
  { key: "365", label: "Letzte 12 Monate", days: 365 },
] as const;

// Kanal-Segmentfarben aus dem Chart-Token-System (var(--chart-1..5)).
const CHART_VARS = [
  "var(--chart-1)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-2)",
];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  return d.toISOString().slice(0, 10);
}

export function PropertyStatsView({ propertyId }: { propertyId: string }) {
  const [stats, setStats] = useState<PropertyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("30");

  const load = useCallback(async () => {
    const days = RANGES.find((r) => r.key === range)?.days ?? 30;
    const res = await getPropertyStats(propertyId, isoDaysAgo(days));
    if (res.ok) setStats(res.data);
    else setError(res.error);
    setLoading(false);
  }, [propertyId, range]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtime({
    table: "reservations",
    filter: `property_id=eq.${propertyId}`,
    onChange: load,
  });

  if (loading) {
    return <Card className="p-8 text-center text-sm text-muted-foreground">Lädt…</Card>;
  }
  if (error || !stats) {
    return <Card className="p-5 text-sm text-destructive">{error ?? "Keine Daten."}</Card>;
  }

  const cur = stats.currency;
  const money = (v: number) => formatCurrency(v, cur);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold">Statistiken</h1>
        <NativeSelect
          value={range}
          onChange={(e) => setRange(e.target.value as typeof range)}
          className="h-9 w-auto"
        >
          {RANGES.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi title="Einnahmen" kpi={stats.revenue} fmt={money} />
        <Kpi title="Erhaltene Zahlungen" kpi={stats.payments_received} fmt={money} />
        <Kpi title="Gehostete Gäste" kpi={stats.hosted_guests} fmt={intFmt} />
        <Kpi title="Ausgebuchte Nächte" kpi={stats.booked_nights} fmt={intFmt} />
        <Kpi
          title="Belegungsrate"
          kpi={stats.occupancy_rate}
          fmt={(v) => `${Math.round(v)}%`}
        />
        <Kpi title="Tage im Voraus gebucht" kpi={stats.days_booked_ahead} fmt={intFmt} />
        <Kpi title="Durchschnittliche Buchungssumme" kpi={stats.avg_booking_value} fmt={money} />
        <Kpi title="Durchschnittliche Aufenthaltsdauer" kpi={stats.avg_stay_length} fmt={intFmt} />
        <Kpi title="Durchschnittspreis pro Nacht" kpi={stats.avg_price_per_night} fmt={money} />
        <Kpi title="Erstellte Reservierungen" kpi={stats.created_reservations} fmt={intFmt} />
        <Kpi title="Stornierte Reservierungen" kpi={stats.cancelled_reservations} fmt={intFmt} />
        <Kpi title="Stornierte Nächte" kpi={stats.cancelled_nights} fmt={intFmt} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChannelDonut
          title="Einnahmen pro Kanal"
          stats={stats}
          metric="amount"
          fmt={money}
          available={stats.revenue != null}
        />
        <ChannelDonut
          title="Nächte pro Kanal"
          stats={stats}
          metric="nights"
          fmt={intFmt}
          available
        />
      </div>
    </div>
  );
}

function intFmt(v: number): string {
  return `${Math.round(v)}`;
}

function Kpi({
  title,
  kpi,
  fmt,
}: {
  title: string;
  kpi: StatKpi | null;
  fmt: (v: number) => string;
}) {
  return (
    <Card className="flex flex-col gap-2 p-5">
      <p className="text-sm font-semibold text-muted-foreground">{title}</p>
      {kpi == null ? (
        <p className="py-2 text-center text-sm font-medium text-muted-foreground">
          No Data Found
        </p>
      ) : (
        <>
          <p className="font-display text-2xl font-extrabold text-accent">
            {fmt(kpi.value)}
          </p>
          {kpi.change_pct != null && (
            <p
              className={
                "inline-flex items-center gap-1 text-xs font-semibold " +
                (kpi.change_pct >= 0 ? "text-success" : "text-destructive")
              }
            >
              <Icon
                icon={kpi.change_pct >= 0 ? "ph:arrow-up" : "ph:arrow-down"}
                className="size-3"
              />
              {Math.abs(kpi.change_pct).toFixed(2)}%
            </p>
          )}
        </>
      )}
    </Card>
  );
}

// Kanal-Donut über recharts PieChart + shadcn ChartContainer (gleiche
// Infrastruktur wie die anderen Charts). Ein Segment je Kanal, Farbe aus dem
// Chart-Token-System; Legende + Tooltip vom Chart-Framework.
function ChannelDonut({
  title,
  stats,
  metric,
  fmt,
  available,
}: {
  title: string;
  stats: PropertyStats;
  metric: "amount" | "nights";
  fmt: (v: number) => string;
  available: boolean;
}) {
  const data = useMemo(() => {
    return stats.by_channel
      .map((c, i) => ({
        key: c.ota_name ?? c.channel,
        label: c.ota_name ?? channelMeta(c.channel as never).label,
        value: (metric === "amount" ? c.amount : c.nights) ?? 0,
        fill: CHART_VARS[i % CHART_VARS.length],
      }))
      .filter((d) => d.value > 0);
  }, [stats.by_channel, metric]);

  const config = useMemo<ChartConfig>(() => {
    const c: ChartConfig = {};
    data.forEach((d, i) => {
      c[d.key] = { label: d.label, color: CHART_VARS[i % CHART_VARS.length] };
    });
    return c;
  }, [data]);

  return (
    <Card className="flex flex-col gap-3 p-5">
      <p className="font-display text-lg font-bold">{title}</p>
      {!available ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Keine Betragsfreigabe für dieses Konto.
        </p>
      ) : data.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No Data Found</p>
      ) : (
        <ChartContainer config={config} className="mx-auto aspect-square max-h-64 w-full">
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value, name) => `${name}: ${fmt(Number(value))}`}
                />
              }
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius={60}
              strokeWidth={2}
            >
              {data.map((d) => (
                <Cell key={d.key} fill={d.fill} />
              ))}
            </Pie>
            <ChartLegend content={<ChartLegendContent nameKey="label" />} />
          </PieChart>
        </ChartContainer>
      )}
    </Card>
  );
}
