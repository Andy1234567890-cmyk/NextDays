// Statistik-Metadaten (KEIN "use server" — trägt Laufzeit-Konstanten + Typen).
// Die Server-Action-Datei lib/reservations.ts darf nur async-Funktionen
// exportieren; die Metrik-Liste + Detail-Typen leben deshalb hier.

/** Metriken mit eigener KPI-Detailseite (müssen der Backend-Kennung entsprechen). */
export const STAT_METRICS = [
  "revenue",
  "payments_received",
  "hosted_guests",
  "booked_nights",
  "created_reservations",
  "cancelled_reservations",
  "cancelled_nights",
] as const;
export type StatMetric = (typeof STAT_METRICS)[number];

export type StatPoint = { date: string; value: number };

/** Tages-Zeitreihe EINER KPI (Sparkline in der Kachel). */
export type StatSeries = {
  metric: string;
  visible: boolean;
  points: StatPoint[];
};

export type StatComparePeriod = {
  label: string;
  date_from: string;
  date_to: string;
  value: number | null;
  change_pct: number | null;
};

export type StatMetricDetail = {
  metric: string;
  is_money: boolean;
  visible: boolean;
  currency: string;
  date_from: string;
  date_to: string;
  series: StatPoint[];
  periods: StatComparePeriod[];
  breakout: number[][];
};

export type StatMetricDetailResponse = {
  property_id: string;
  property_title: string;
  detail: StatMetricDetail;
};
