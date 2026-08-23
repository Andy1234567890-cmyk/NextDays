"use client";

// KPI-Detailseite (..: Klick auf eine Statistik-Kachel). Zeigt EINE Metrik
// als großen Area-Chart über den Zeitraum, darüber Vergleichsperioden-Schalter,
// darunter die Perioden-Kacheln (Wert + %-Vergleich) und die Breakout-Tabelle
// (Tageswerte je Periode) plus „Exportieren". Daten aus getMetricDetail; live
// über useRealtime. Geldmetrik ohne Sicht → maskiert (kein erfundener Wert).
import { Icon } from "@iconify/react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { Switch } from "@nextdays/ui/switch";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  XAxis,
  YAxis,
  type ChartConfig,
} from "@nextdays/ui/chart";
import { formatCurrency } from "@/lib/currency";
import {
  type StatMetric,
  type StatMetricDetail,
  getMetricDetail,
  getTenantMetricDetail,
} from "@/lib/reservations";
import { useRealtime } from "@/lib/use-realtime";

function useMetricLabel(): Record<StatMetric, string> {
  const t = useTranslations("reservations");
  return {
    revenue: t("kpiDetail.metric.revenue"),
    payments_received: t("kpiDetail.metric.paymentsReceived"),
    hosted_guests: t("kpiDetail.metric.hostedGuests"),
    booked_nights: t("kpiDetail.metric.bookedNights"),
    created_reservations: t("kpiDetail.metric.createdReservations"),
    cancelled_reservations: t("kpiDetail.metric.cancelledReservations"),
    cancelled_nights: t("kpiDetail.metric.cancelledNights"),
  };
}

function dayLabel(iso: string, locale: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(locale, { day: "numeric", month: "short" });
}

// Ergebnis der Detail-Ladefunktion: das Aggregat + eine Unterzeile (Objektname
// bzw. „Alle Unterkünfte"). Objekt- und Tenant-Detail liefern beide diese Form.
export type MetricDetailResult = { detail: StatMetricDetail; subtitle: string };

export function KpiDetailView({
  metric,
  loader,
  realtimeFilter,
}: {
  metric: StatMetric;
  // Lädt das Detail-Aggregat (Objekt- ODER tenant-weit) — vom Aufrufer gestellt.
  loader: () => Promise<
    { ok: true; data: MetricDetailResult } | { ok: false; error: string }
  >;
  // Optionaler Realtime-Filter (Objekt: property_id=eq.…; Tenant: kein Filter).
  realtimeFilter?: string;
}) {
  const t = useTranslations("reservations");
  const locale = useLocale();
  const METRIC_LABEL = useMetricLabel();
  const router = useRouter();
  const [detail, setDetail] = useState<StatMetricDetail | null>(null);
  const [subtitle, setSubtitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Sichtbarkeit der Vergleichsperioden (Toggles oben, wie ..).
  const [shown, setShown] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    const res = await loader();
    if (res.ok) {
      setDetail(res.data.detail);
      setSubtitle(res.data.subtitle);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }, [loader]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtime({
    table: "reservations",
    filter: realtimeFilter,
    onChange: load,
  });

  const isMoney = detail?.is_money ?? false;
  const cur = detail?.currency ?? "";
  const fmt = useCallback(
    (v: number) => (isMoney ? formatCurrency(v, cur) : `${Math.round(v)}`),
    [isMoney, cur],
  );

  // Chart-Daten: aktuelle Reihe + eingeblendete Vergleichsperioden per Tag-Offset
  // überlagern (Breakout liefert Index 0 = aktuelle Periode, 1..4 = Vergleich).
  const chartData = useMemo(() => {
    if (!detail) return [];
    return detail.series.map((p, i) => {
      const row: Record<string, number | string> = {
        label: dayLabel(p.date, locale),
        current: p.value,
      };
      shown.forEach((idx) => {
        const vals = detail.breakout[idx];
        if (vals) row[`p${idx}`] = vals[i] ?? 0;
      });
      return row;
    });
  }, [detail, shown, locale]);

  const config = useMemo<ChartConfig>(() => {
    const c: ChartConfig = {
      current: { label: t("kpiDetail.chartCurrent"), color: "var(--chart-1)" },
    };
    detail?.periods.forEach((p, i) => {
      c[`p${i}`] = { label: p.label, color: CHART_VARS[i % CHART_VARS.length] };
    });
    return c;
  }, [detail, t]);

  const toggle = (idx: number) =>
    setShown((s) => {
      const next = new Set(s);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });

  const exportCsv = useCallback(() => {
    if (!detail) return;
    const rows: string[] = [];
    const header = [t("kpiDetail.csvPeriodColumn"), ...detail.series.map((p) => p.date)];
    rows.push(header.join(","));
    const label = (i: number) =>
      i === 0
        ? `${detail.date_from} – ${detail.date_to}`
        : (detail.periods[i - 1]?.label ?? t("kpiDetail.periodFallback", { number: i }));
    detail.breakout.forEach((vals, i) => {
      rows.push([label(i), ...vals.map((v) => String(v))].join(","));
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${metric}_${detail.date_from}_${detail.date_to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [detail, metric, t]);

  if (loading) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        {t("kpiDetail.loading")}
      </Card>
    );
  }
  if (error || !detail) {
    return (
      <Card className="p-5 text-sm text-destructive">
        {error ?? t("kpiDetail.noData")}
      </Card>
    );
  }

  const total = detail.series.reduce((s, p) => s + p.value, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("kpiDetail.back")}
            onClick={() => router.back()}
          >
            <Icon icon="ph:arrow-left" className="size-4" />
          </Button>
          <div>
            <h1 className="font-display text-2xl font-extrabold">
              {METRIC_LABEL[metric]}
            </h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={exportCsv} className="gap-1.5">
          <Icon icon="ph:download-simple" className="size-4" />
          {t("kpiDetail.export")}
        </Button>
      </div>

      {!detail.visible ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {t("kpiDetail.noAmountAccess")}
        </Card>
      ) : (
        <>
          <Card className="flex flex-col gap-4 p-5">
            {/* Vergleichsperioden-Schalter (.. „VERGLEICHEN"). */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                {t("kpiDetail.compare")}
              </span>
              {detail.periods.map((p, i) => (
                <label
                  key={p.label}
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm"
                >
                  {p.label}
                  <Switch checked={shown.has(i)} onCheckedChange={() => toggle(i)} />
                </label>
              ))}
            </div>

            <p className="font-display text-3xl font-extrabold text-accent">
              {fmt(total)}
            </p>

            <ChartContainer config={config} className="h-72 w-full">
              <AreaChart data={chartData} margin={{ left: 4, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="fillCurrent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={24}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tickFormatter={(v: number) =>
                    // formatCurrency setzt Symbol + Position je Währung korrekt
                    // (0 Nachkommastellen für die Achse), kein hartes € / feste
                    // Position — gilt für alle Währungen (Wurzel 4).
                    isMoney ? formatCurrency(v, cur, locale, 0) : `${Math.round(v)}`
                  }
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => `${name}: ${fmt(Number(value))}`}
                    />
                  }
                />
                <Area
                  dataKey="current"
                  type="monotone"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#fillCurrent)"
                  isAnimationActive={false}
                  dot={false}
                />
                {[...shown].map((idx) => (
                  <Area
                    key={idx}
                    dataKey={`p${idx}`}
                    type="monotone"
                    stroke={CHART_VARS[idx % CHART_VARS.length]}
                    strokeWidth={2}
                    fill="none"
                    isAnimationActive={false}
                    dot={false}
                  />
                ))}
              </AreaChart>
            </ChartContainer>
          </Card>

          {/* Perioden-Kacheln: aktuelle Periode + vier Vergleichsperioden. */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <PeriodCard
              label={`${dayLabel(detail.date_from, locale)} – ${dayLabel(detail.date_to, locale)}`}
              value={total}
              changePct={null}
              fmt={fmt}
              highlight
            />
            {detail.periods.map((p) => (
              <PeriodCard
                key={p.label}
                label={p.label}
                value={p.value ?? 0}
                changePct={p.change_pct}
                fmt={fmt}
              />
            ))}
          </div>

          <BreakoutTable detail={detail} fmt={fmt} />
        </>
      )}
    </div>
  );
}

const CHART_VARS = [
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-2)",
];

function PeriodCard({
  label,
  value,
  changePct,
  fmt,
  highlight,
}: {
  label: string;
  value: number;
  changePct: number | null;
  fmt: (v: number) => string;
  highlight?: boolean;
}) {
  return (
    <Card className={"flex flex-col gap-1 p-4 " + (highlight ? "border-accent/50" : "")}>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="font-display text-xl font-extrabold text-accent">{fmt(value)}</p>
      {changePct != null && (
        <p
          className={
            "inline-flex items-center gap-1 text-xs font-semibold " +
            (changePct >= 0 ? "text-success" : "text-destructive")
          }
        >
          <Icon
            icon={changePct >= 0 ? "ph:arrow-up" : "ph:arrow-down"}
            className="size-3"
          />
          {Math.abs(changePct).toFixed(2)}%
        </p>
      )}
    </Card>
  );
}

// Breakout: je Periode (aktuell + Vergleich) die Tageswerte in einer Matrix.
// Spalten = Tag-Offset (Index in der jeweiligen Reihe). Horizontal scrollbar.
function BreakoutTable({
  detail,
  fmt,
}: {
  detail: StatMetricDetail;
  fmt: (v: number) => string;
}) {
  const t = useTranslations("reservations");
  const locale = useLocale();
  const cols = detail.series.length;
  const rowLabel = (i: number) =>
    i === 0
      ? `${dayLabel(detail.date_from, locale)} – ${dayLabel(detail.date_to, locale)}`
      : (detail.periods[i - 1]?.label ?? t("kpiDetail.periodFallback", { number: i }));

  return (
    <Card className="p-0">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="sticky left-0 bg-card px-4 py-2 text-left font-semibold">
                {t("kpiDetail.breakout")}
              </th>
              {detail.series.map((p) => (
                <th key={p.date} className="whitespace-nowrap px-3 py-2 text-right font-medium">
                  {dayLabel(p.date, locale)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {detail.breakout.map((vals, i) => (
              <tr key={rowLabel(i)} className="border-b last:border-0">
                <td className="sticky left-0 bg-card px-4 py-2 text-left font-medium">
                  {rowLabel(i)}
                </td>
                {Array.from({ length: cols }, (_, c) => (
                  <td
                    key={c}
                    className={
                      "whitespace-nowrap px-3 py-2 text-right tabular-nums " +
                      ((vals[c] ?? 0) === 0 ? "text-muted-foreground" : "")
                    }
                  >
                    {fmt(vals[c] ?? 0)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// Objekt-KPI-Detail: lädt das objektbezogene Aggregat (mit Objekt-Titel als
// Unterzeile) und abonniert nur die Buchungen dieses Objekts.
export function PropertyKpiDetail({
  propertyId,
  metric,
  from,
  to,
}: {
  propertyId: string;
  metric: StatMetric;
  from?: string;
  to?: string;
}) {
  const loader = useCallback(
    async () => {
      const res = await getMetricDetail(propertyId, metric, from, to);
      return res.ok
        ? {
          ok: true as const,
          data: { detail: res.data.detail, subtitle: res.data.property_title },
        }
        : { ok: false as const, error: res.error };
    },
    [propertyId, metric, from, to],
  );
  return (
    <KpiDetailView
      metric={metric}
      loader={loader}
      realtimeFilter={`property_id=eq.${propertyId}`}
    />
  );
}

// Tenant-KPI-Detail (Kontrollzentrum „ANSEHEN"): lädt das zusammengefasste
// Aggregat über alle (gefilterten) Objekte; Unterzeile nennt den Umfang.
export function TenantKpiDetail({
  metric,
  from,
  to,
  propertyIds,
}: {
  metric: StatMetric;
  from?: string;
  to?: string;
  propertyIds?: string[];
}) {
  const t = useTranslations("reservations");
  const subtitle =
    propertyIds && propertyIds.length
      ? t("kpiDetail.selectedProperties", { count: propertyIds.length })
      : t("kpiDetail.allProperties");
  const loader = useCallback(
    async () => {
      const res = await getTenantMetricDetail(metric, from, to, propertyIds);
      return res.ok
        ? { ok: true as const, data: { detail: res.data, subtitle } }
        : { ok: false as const, error: res.error };
    },
    [metric, from, to, propertyIds, subtitle],
  );
  return <KpiDetailView metric={metric} loader={loader} />;
}
