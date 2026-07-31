// Reservierungs-Dashboard (Startseite). Struktur nach bewährtem PMS-Vorbild,
// vollständig im myNextDays-Branding (semantische Tokens, rem, pill-Buttons).
// Alle Werte stammen aus echten Reservierungen (Backend /reservations/dashboard);
// fehlt etwas, zeigt die Karte ehrlich „nichts" statt erfundener Zahlen.
import { Icon } from "@iconify/react";

import { Card, CardContent } from "@nextdays/ui/card";
import { formatCurrency } from "@/lib/currency";
import type {
  Dashboard,
  DashboardEntry,
  DashboardKpi,
  ReservationChannel,
} from "@/lib/reservations";

const CHANNEL_LABEL: Record<ReservationChannel, string> = {
  direct: "Direkt",
  portal: "myBestDays",
  booking: "Booking.com",
  airbnb: "Airbnb",
  vrbo: "Vrbo",
};

const CHANNEL_ICON: Record<ReservationChannel, string> = {
  direct: "ph:link-simple",
  portal: "ph:globe",
  booking: "simple-icons:bookingdotcom",
  airbnb: "simple-icons:airbnb",
  vrbo: "ph:house-line",
};

function fmtDate(iso: string): string {
  // 2026-07-01 → 01.07.26
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y.slice(2)}`;
}

function ChangeBadge({ change }: { change: number | null }) {
  if (change === null) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  const up = change >= 0;
  return (
    <span
      className={`text-sm font-semibold ${up ? "text-emerald-600" : "text-red-600"}`}
    >
      {up ? "+" : ""}
      {change} %
    </span>
  );
}

function EntryRow({ entry }: { entry: DashboardEntry }) {
  const channel = entry.ota_name ?? CHANNEL_LABEL[entry.channel];
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <Icon icon={CHANNEL_ICON[entry.channel]} className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {entry.guest_name || "Gast unbekannt"}
          {entry.property_title ? (
            <span className="text-muted-foreground">, {entry.property_title}</span>
          ) : null}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {channel} · {fmtDate(entry.check_in)} – {fmtDate(entry.check_out)}
        </p>
      </div>
    </li>
  );
}

function ListCard({
  icon,
  title,
  count,
  countLabel,
  entries,
  empty,
}: {
  icon: string;
  title: string;
  count: number;
  countLabel: string;
  entries?: DashboardEntry[];
  empty: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon icon={icon} className="size-5" />
          <h3 className="font-semibold text-foreground">{title}</h3>
        </div>
        <div>
          <p className="font-display text-4xl font-extrabold leading-none">
            {count}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{countLabel}</p>
        </div>
        {entries ? (
          entries.length ? (
            <ul className="divide-y divide-border border-t border-border">
              {entries.slice(0, 5).map((e) => (
                <EntryRow key={e.reservation_id} entry={e} />
              ))}
            </ul>
          ) : (
            <p className="border-t border-border pt-3 text-sm text-muted-foreground">
              {empty}
            </p>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}

function KpiCard({
  icon,
  title,
  kpi,
  display,
  unitLabel,
}: {
  icon: string;
  title: string;
  kpi: DashboardKpi;
  display: string;
  unitLabel: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Icon icon={icon} className="size-5" />
            <h3 className="font-semibold text-foreground">{title}</h3>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
            Letzte 30 Tage
          </span>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="font-display text-4xl font-extrabold leading-none">
              {display}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{unitLabel}</p>
          </div>
          <ChangeBadge change={kpi.change_pct} />
        </div>
      </CardContent>
    </Card>
  );
}

export function ReservationsDashboard({ data }: { data: Dashboard }) {
  return (
    <div className="flex flex-col gap-6">
      {/* Obere Reihe: Check-outs (mit Liste) · Check-ins · Anstehend */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ListCard
          icon="ph:calendar-x"
          title="Heutige Check-outs"
          count={data.checkouts_today.length}
          countLabel="Check-outs heute"
          entries={data.checkouts_today}
          empty="Heute keine Abreisen."
        />
        <div className="flex flex-col gap-6">
          <ListCard
            icon="ph:calendar-check"
            title="Heutige Check-ins"
            count={data.checkins_today.length}
            countLabel="Check-ins heute"
            entries={data.checkins_today}
            empty="Heute keine Anreisen."
          />
          <ListCard
            icon="ph:calendar-dots"
            title="Anstehende Reservierungen"
            count={data.upcoming.length}
            countLabel="Anstehende Reservierungen"
            entries={data.upcoming}
            empty="Keine anstehenden Reservierungen."
          />
        </div>
      </div>

      {/* Untere Reihe: KPI-Kacheln */}
      <div className="grid gap-6 md:grid-cols-3">
        <KpiCard
          icon="ph:sign-in"
          title="Check-in"
          kpi={data.checkins_30d}
          display={String(data.checkins_30d.value)}
          unitLabel="Gäste-Check-ins"
        />
        {/* Umsatz-Kachel nur, wenn der Nutzer Beträge sehen darf. Für einen Owner
            ohne PM_BOOKING_TOTAL liefert das Backend revenue_30d=null (§4.2). */}
        {data.revenue_30d && (
          <KpiCard
            icon="ph:currency-circle-dollar"
            title="Umsatz"
            kpi={data.revenue_30d}
            display={formatCurrency(data.revenue_30d.value, data.currency)}
            unitLabel="Gesamtumsatz"
          />
        )}
        <KpiCard
          icon="ph:check-circle"
          title="Bestätigt"
          kpi={data.confirmed_30d}
          display={String(data.confirmed_30d.value)}
          unitLabel="Bestätigte Reservierungen"
        />
      </div>
    </div>
  );
}
