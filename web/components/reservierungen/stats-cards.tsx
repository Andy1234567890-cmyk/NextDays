"use client";

// Geteilte Statistik-Bausteine für BEIDE Kontrollzentrum-Flächen:
//   • Objekt-Statistiken (property-stats.tsx) — ein Objekt
//   • Auswertung, Reiter „Kennzahlen" (components/auswertung/
//     reiter-kennzahlen.tsx) — alle Objekte zusammengefasst; lag bis zum
//     30.08.2026 als eigene Seite unter /reservierungen/kontrollzentrum
// Beide rendern dieselben KPI-Kacheln (mit Sparkline + %-Vergleich + Klick-Detail)
// und Kanal-Donuts — eine Quelle, keine Doppelpflege. Beträge maskiert (null →
// „No Data Found"), Währung/Position über formatCurrency (kein hartes €).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { KpiSparkline } from "@/components/reservierungen/kpi-sparkline";
import { Card } from "@nextdays/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  Pie,
  PieChart,
  type ChartConfig,
} from "@nextdays/ui/chart";
import type { AvailabilitySource } from "@/lib/calendar";
import { useCalendarLabels } from "@/lib/use-calendar-labels";
import { channelLabelLoose } from "@/lib/channel-logos";
import { channelChartColor, channelMeta } from "@/lib/calendar-channels";
import type { PropertyStats, StatKpi, StatMetric, StatPoint } from "@/lib/reservations";

// Kanal-Segmentfarben aus dem Chart-Token-System (var(--chart-1..5)).
export const CHART_VARS = [
  "var(--chart-1)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-2)",
];

export function intFmt(v: number): string {
  return `${Math.round(v)}`;
}

export function Kpi({
  title,
  kpi,
  fmt,
  points,
  onClick,
}: {
  title: string;
  kpi: StatKpi | null;
  fmt: (v: number) => string;
  points?: StatPoint[];
  onClick?: () => void;
}) {
  const t = useTranslations("reservations");
  const clickable = onClick != null;
  return (
    <Card
      className={
        "flex flex-col gap-2 p-5 " +
        (clickable ? "cursor-pointer transition-colors hover:border-accent/50" : "")
      }
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onClick?.();
            }
          }
          : undefined
      }
    >
      <p className="text-sm font-semibold text-muted-foreground">{title}</p>
      {kpi == null ? (
        <p className="py-2 text-center text-sm font-medium text-muted-foreground">
          {t("statsCards.noData")}
        </p>
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-2">
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
          </div>
          {points != null && <KpiSparkline points={points} />}
        </>
      )}
    </Card>
  );
}

// Das komplette 12-KPI-Raster (identisch für Objekt + Kontrollzentrum). `money`
// formatiert Beträge (Währung aus den Daten); `seriesFor` liefert die Sparkline-
// Punkte je Metrik; `onOpen` öffnet die KPI-Detailseite (nur für zeitreihen-
// fähige Metriken gesetzt — die anderen Kacheln sind nicht klickbar).
export function StatsKpiGrid({
  stats,
  money,
  seriesFor,
  onOpen,
}: {
  stats: PropertyStats;
  money: (v: number) => string;
  seriesFor: (metric: string) => StatPoint[];
  onOpen: (metric: StatMetric) => void;
}) {
  const t = useTranslations("reservations");
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Kpi title={t("statsCards.revenue")} kpi={stats.revenue} fmt={money}
        points={seriesFor("revenue")} onClick={() => onOpen("revenue")} />
      <Kpi title={t("statsCards.paymentsReceived")} kpi={stats.payments_received} fmt={money}
        points={seriesFor("payments_received")}
        onClick={() => onOpen("payments_received")} />
      <Kpi title={t("statsCards.hostedGuests")} kpi={stats.hosted_guests} fmt={intFmt}
        points={seriesFor("hosted_guests")}
        onClick={() => onOpen("hosted_guests")} />
      <Kpi title={t("statsCards.bookedNights")} kpi={stats.booked_nights} fmt={intFmt}
        points={seriesFor("booked_nights")}
        onClick={() => onOpen("booked_nights")} />
      <Kpi title={t("statsCards.occupancyRate")} kpi={stats.occupancy_rate}
        fmt={(v) => `${Math.round(v)}%`} />
      <Kpi title={t("statsCards.daysBookedAhead")} kpi={stats.days_booked_ahead} fmt={intFmt} />
      <Kpi title={t("statsCards.avgBookingValue")} kpi={stats.avg_booking_value} fmt={money} />
      <Kpi title={t("statsCards.avgStayLength")} kpi={stats.avg_stay_length} fmt={intFmt} />
      <Kpi title={t("statsCards.avgPricePerNight")} kpi={stats.avg_price_per_night} fmt={money} />
      <Kpi title={t("statsCards.createdReservations")} kpi={stats.created_reservations} fmt={intFmt}
        points={seriesFor("created_reservations")}
        onClick={() => onOpen("created_reservations")} />
      <Kpi title={t("statsCards.cancelledReservations")} kpi={stats.cancelled_reservations} fmt={intFmt}
        points={seriesFor("cancelled_reservations")}
        onClick={() => onOpen("cancelled_reservations")} />
      <Kpi title={t("statsCards.cancelledNights")} kpi={stats.cancelled_nights} fmt={intFmt}
        points={seriesFor("cancelled_nights")}
        onClick={() => onOpen("cancelled_nights")} />
    </div>
  );
}

// Beide Kanal-Donuts (Einnahmen + Nächte) als ein Block.
export function ChannelDonuts({
  stats,
  money,
}: {
  stats: PropertyStats;
  money: (v: number) => string;
}) {
  const t = useTranslations("reservations");
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChannelDonut title={t("statsCards.revenuePerChannel")} stats={stats} metric="amount"
        fmt={money} available={stats.revenue != null} />
      <ChannelDonut title={t("statsCards.nightsPerChannel")} stats={stats} metric="nights"
        fmt={intFmt} available />
    </div>
  );
}

// Kanal-Donut über recharts PieChart + shadcn ChartContainer. Ein Segment je
// Kanal, Farbe aus dem Chart-Token-System; Legende + Tooltip vom Chart-Framework.
// Links steht der Wert je Kanal als Text (.. „Bookingcom: 7.030 kr").
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
  const t = useTranslations("reservations");
  const { channelLabel } = useCalendarLabels();
  // Farbe UND Bildmarke kommen aus dem Kanal, nicht aus der Position in der
  // Liste (03.09.2026). Vorher lief die Füllung über `CHART_VARS[i]` — eine
  // Palette in fester Reihenfolge: Booking.com bekam Orange, Airbnb Rot,
  // je nachdem, wer zuerst in den Daten stand. Damit war die Farbe nicht nur
  // fremd, sondern auch unbeständig: derselbe Kanal wechselte sie, sobald ein
  // anderer dazukam oder wegfiel. Booking.com ist #003580, Airbnb #ff5a5f —
  // die Tokens dafür stehen längst in `globals.css`.
  const data = useMemo(() => {
    return stats.by_channel
      .map((c) => {
        const quelle = c.channel as AvailabilitySource;
        return {
          key: c.channel,
          label: c.ota_name
            ? channelLabelLoose(c.ota_name)
            : channelLabel(quelle),
          value: (metric === "amount" ? c.amount : c.nights) ?? 0,
          fill: channelChartColor(quelle),
          // Die BILDMARKE aus `CHANNEL_META`, NICHT die Wortmarke aus
          // `channelLogoLoose` (gemessen 03.09.2026, nachdem ich es andersherum
          // versucht hatte).
          //
          // `public/channels/*` führt 43 echte Original-Logos — aber es sind
          // WORTmarken: „Booking.com" hat ein Seitenverhältnis von 5,9 : 1,
          // Vrbo 3,1 : 1, myBestDays 3,6 : 1. In das 1-rem-Quadrat dieser
          // Liste gezwungen wird jede davon zu einem unleserlichen Fleck —
          // im Bildschirmfoto nachgeprüft. Quadratische Bildmarken gibt es
          // im Ordner nur für Airbnb und WhatsApp.
          //
          // Die simple-icons-Glyphen SIND die offiziellen Bildmarken derselben
          // Marken (Booking.coms „B.", Airbnbs Bélo) und tragen hier die
          // Markenfarbe. Wo es keine gibt — Vrbo hat kein Iconify-Zeichen,
          // `simple-icons:vrbo` existiert nicht — steht ein neutrales Symbol
          // statt einer geratenen Marke (Regel „Portal-Logos nur echt").
          icon: channelMeta(quelle).logo,
        };
      })
      .filter((d) => d.value > 0);
  }, [stats.by_channel, metric, channelLabel]);

  // Der Config-Schlüssel ist das LABEL, nicht der Kanalcode.
  //
  // `ChartLegendContent` schlägt über `nameKey="label"` nach und nimmt dabei
  // den WERT des Feldes als Schlüssel (`getPayloadConfigFromPayload`). Stand
  // dort der Kanalcode („direct"), fand die Legende nichts und rendert einen
  // Eintrag OHNE Text — auf dem Screenshot vom 03.09.2026 der leere grüne
  // Kasten neben den drei „Booking.com".
  const config = useMemo<ChartConfig>(() => {
    const c: ChartConfig = {};
    data.forEach((d) => {
      c[d.label] = { label: d.label, color: d.fill };
    });
    return c;
  }, [data]);

  return (
    <Card className="flex flex-col gap-3 p-5">
      <p className="font-display text-lg font-bold">{title}</p>
      {!available ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t("statsCards.noAmountAccess")}
        </p>
      ) : data.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t("statsCards.noData")}</p>
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          {/* Wert je Kanal als Text (..) — links neben dem Donut. */}
          <ul className="flex min-w-32 flex-col gap-1.5 text-sm">
            {data.map((d) => (
              <li key={d.key} className="flex items-center gap-2">
                {/* Die echte Bildmarke in der Kanalfarbe statt eines bunten
                    Punktes. `CHANNEL_META` führt sie ohnehin — dieselbe
                    Zuordnung wie im Kalender und im Posteingang, damit ein
                    Kanal überall gleich aussieht (Regel „Portal-Logos nur
                    echt": kein geratenes Ersatz-Icon für Marken, die wir
                    nicht haben — dort steht ein neutrales Symbol).

                    Nur der `icon`-Zweig: KEIN Kanal im Katalog trägt derzeit
                    `kind: "img"` (geprüft 03.09.2026), ein `<img>`-Zweig wäre
                    also toter Code — samt der `no-img-element`-Warnung, die
                    er mitbrächte. Kommt ein Kanal mit Bilddatei dazu, gehört
                    er hier ergänzt; bis dahin bliebe seine Zeile ohne Marke,
                    nicht ohne Zahl. */}
                {d.icon.kind === "icon" && (
                  <Icon
                    icon={d.icon.icon}
                    className="size-4 shrink-0"
                    style={{ color: d.fill }}
                    aria-hidden
                  />
                )}
                <span className="font-medium">{d.label}:</span>
                <span className="text-accent">{fmt(d.value)}</span>
              </li>
            ))}
          </ul>
          <ChartContainer config={config} className="mx-auto aspect-square max-h-56 flex-1">
            <PieChart>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value, name) => `${name}: ${fmt(Number(value))}`}
                  />
                }
              />
              {/* Segmentfarbe kommt aus data[].fill (recharts 3: kein <Cell> mehr). */}
              <Pie data={data} dataKey="value" nameKey="label" innerRadius={55} strokeWidth={2} />
              <ChartLegend content={<ChartLegendContent nameKey="label" />} />
            </PieChart>
          </ChartContainer>
        </div>
      )}
    </Card>
  );
}
