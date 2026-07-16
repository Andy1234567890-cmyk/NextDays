"use client";

// Objekt-Statistiken (.. „Kontrollzentrum" je Objekt): KPI-Kacheln mit
// Vergleich zur Vorperiode + Sparkline je Kachel + Kanal-Donuts (geteilte
// Bausteine aus stats-cards.tsx — dieselben wie das globale Kontrollzentrum).
// Oben der Datumsbereich-Wähler; Klick auf eine Kachel öffnet die KPI-Detailseite
// dieses Objekts. Daten aus getPropertyStats; live über useRealtime.
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { DateRangePopover, type IsoRange } from "@/components/reservierungen/date-range-popover";
import { ControlCenterLearn } from "@/components/reservierungen/learn-dialog";
import { ChannelDonuts, StatsKpiGrid } from "@/components/reservierungen/stats-cards";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currency";
import {
  type PropertyStats,
  type StatMetric,
  type StatPoint,
  getPropertyStats,
} from "@/lib/reservations";
import { useRealtime } from "@/lib/use-realtime";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  return d.toISOString().slice(0, 10);
}

function defaultRange(): IsoRange {
  return { from: isoDaysAgo(30), to: new Date().toISOString().slice(0, 10) };
}

export function PropertyStatsView({ propertyId }: { propertyId: string }) {
  const t = useTranslations("reservations");
  const router = useRouter();
  const [stats, setStats] = useState<PropertyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<IsoRange>(defaultRange);

  const load = useCallback(async () => {
    const res = await getPropertyStats(propertyId, range.from, range.to);
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

  const seriesFor = useCallback(
    (metric: string): StatPoint[] => {
      const s = stats?.series.find((x) => x.metric === metric);
      return s && s.visible ? s.points : [];
    },
    [stats],
  );

  const openDetail = useCallback(
    (metric: StatMetric) => {
      const qs = `?from=${range.from}&to=${range.to}`;
      router.push(
        `/reservierungen/unterkuenfte/${propertyId}/statistiken/${metric}${qs}`,
      );
    },
    [router, propertyId, range],
  );

  if (loading) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        {t("propertyStats.loading")}
      </Card>
    );
  }
  if (error || !stats) {
    return (
      <Card className="p-5 text-sm text-destructive">
        {error ?? t("propertyStats.noData")}
      </Card>
    );
  }

  const money = (v: number) => formatCurrency(v, stats.currency);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-extrabold">
            {t("propertyStats.title", { propertyTitle: stats.property_title })}
          </h1>
          <ControlCenterLearn />
        </div>
        <DateRangePopover value={range} onChange={setRange} />
      </div>

      <StatsKpiGrid stats={stats} money={money} seriesFor={seriesFor} onOpen={openDetail} />
      <ChannelDonuts stats={stats} money={money} />
    </div>
  );
}
