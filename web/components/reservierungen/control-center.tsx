"use client";

// Globales Kontrollzentrum (..-Startseite): dieselben KPI-Kacheln +
// Kanal-Donuts wie die Objekt-Statistiken (geteilte stats-cards.tsx), aber
// zusammengefasst über ALLE (owner-sichtbaren) Objekte des Tenants. Oben rechts
// Datumsbereich-Wähler + Objekt-Filter („Alle/Ausgewählte Unterkünfte" + „Alles
// zurücksetzen"). Klick auf eine Kachel öffnet die tenant-weite KPI-Detailseite.
// Daten aus getTenantStats; live über useRealtime (reservations + properties).
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { DateRangePopover, type IsoRange } from "@/components/reservierungen/date-range-popover";
import { ControlCenterLearn } from "@/components/reservierungen/learn-dialog";
import { PropertyFilter } from "@/components/reservierungen/property-filter";
import { ChannelDonuts, StatsKpiGrid } from "@/components/reservierungen/stats-cards";
import { Card } from "@nextdays/ui/card";
import { formatCurrency } from "@/lib/currency";
import { type Property, listProperties } from "@/lib/properties";
import {
  type PropertyStats,
  type StatMetric,
  type StatPoint,
  getTenantStats,
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

export function ControlCenterView() {
  const t = useTranslations("reservations");
  const router = useRouter();
  const [stats, setStats] = useState<PropertyStats | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selected, setSelected] = useState<string[]>([]); // leer = alle
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<IsoRange>(defaultRange);

  const loadProperties = useCallback(async () => {
    const res = await listProperties();
    if (res.ok) setProperties(res.data.items);
  }, []);

  const load = useCallback(async () => {
    const res = await getTenantStats(
      range.from,
      range.to,
      selected.length ? selected : undefined,
    );
    if (res.ok) setStats(res.data);
    else setError(res.error);
    setLoading(false);
  }, [range, selected]);

  useEffect(() => {
    void loadProperties();
  }, [loadProperties]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime: Buchungen ändern die Kennzahlen, Objekt-Änderungen die Filterliste.
  useRealtime({ table: "reservations", onChange: load });
  useRealtime({ table: "properties", onChange: loadProperties });

  const seriesFor = useCallback(
    (metric: string): StatPoint[] => {
      const s = stats?.series.find((x) => x.metric === metric);
      return s && s.visible ? s.points : [];
    },
    [stats],
  );

  const openDetail = useCallback(
    (metric: StatMetric) => {
      const params = new URLSearchParams();
      params.set("from", range.from);
      params.set("to", range.to);
      for (const id of selected) params.append("property_id", id);
      router.push(`/reservierungen/kontrollzentrum/${metric}?${params.toString()}`);
    },
    [router, range, selected],
  );

  if (loading) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        {t("controlCenter.loading")}
      </Card>
    );
  }
  if (error || !stats) {
    return (
      <Card className="p-5 text-sm text-destructive">
        {error ?? t("controlCenter.noData")}
      </Card>
    );
  }

  const money = (v: number) => formatCurrency(v, stats.currency);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-extrabold">
            {t("controlCenter.title")}
          </h1>
          <ControlCenterLearn />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePopover value={range} onChange={setRange} />
          <PropertyFilter
            properties={properties}
            selected={selected}
            onChange={setSelected}
          />
        </div>
      </div>

      <StatsKpiGrid stats={stats} money={money} seriesFor={seriesFor} onOpen={openDetail} />
      <ChannelDonuts stats={stats} money={money} />
    </div>
  );
}
