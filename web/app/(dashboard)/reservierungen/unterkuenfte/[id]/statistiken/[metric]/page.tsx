// Objekt → Statistiken → KPI-Detail (..: Klick auf eine Statistik-Kachel).
// Große Zeitreihe EINER Kennzahl + Vergleichsperioden + Breakout-Tabelle + Export.
// Unbekannte Metrik → 404 (kein 500 aus fehlgeleiteten Pfaden).
import { notFound } from "next/navigation";

import { PropertyKpiDetail } from "@/components/reservierungen/kpi-detail";
import { STAT_METRICS, type StatMetric } from "@/lib/stats-meta";

export default async function KpiDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; metric: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id, metric } = await params;
  const { from, to } = await searchParams;
  if (!STAT_METRICS.includes(metric as StatMetric)) {
    notFound();
  }
  return (
    <PropertyKpiDetail
      propertyId={id}
      metric={metric as StatMetric}
      from={from}
      to={to}
    />
  );
}
