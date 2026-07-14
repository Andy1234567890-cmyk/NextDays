// Kontrollzentrum → KPI-Detail (ANSEHEN): große Zeitreihe EINER
// Kennzahl über ALLE (gefilterten) Objekte + Vergleichsperioden + Breakout +
// Export. Der property_id-Filter (wiederholbar) wird durchgereicht. Unbekannte
// Metrik → 404 (kein 500 aus fehlgeleiteten Pfaden).
import { notFound } from "next/navigation";

import { TenantKpiDetail } from "@/components/reservierungen/kpi-detail";
import { STAT_METRICS, type StatMetric } from "@/lib/stats-meta";

export default async function TenantKpiDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ metric: string }>;
  searchParams: Promise<{ from?: string; to?: string; property_id?: string | string[] }>;
}) {
  const { metric } = await params;
  const { from, to, property_id } = await searchParams;
  if (!STAT_METRICS.includes(metric as StatMetric)) {
    notFound();
  }
  const propertyIds =
    property_id == null ? [] : Array.isArray(property_id) ? property_id : [property_id];
  return (
    <TenantKpiDetail
      metric={metric as StatMetric}
      from={from}
      to={to}
      propertyIds={propertyIds}
    />
  );
}
