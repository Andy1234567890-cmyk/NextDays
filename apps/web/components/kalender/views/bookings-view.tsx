"use client";

// Kombinierte Buchungs-Ansicht: oben der Front-Desk-Tagesblick (An-/Abreisen +
// Im-Haus für einen gewählten Tag), darunter die vollständige Buchungsliste mit
// Filtern. Beide Teile teilen sich EINEN listReservations-Call, EIN Realtime-Abo
// und denselben Detail-Slider — kein doppeltes Laden. Ersetzt die zwei vorher
// getrennten Ansichten „Liste" und „An-/Abreisen".
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { Prop } from "@/components/kalender/calendar-board";
import { ReservationDetailSlider } from "@/components/kalender/reservation-detail-slider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { AvailabilitySource } from "@/lib/calendar";
import { CHANNEL_SOURCES, channelMeta } from "@/lib/calendar-channels";
import { type DisplayStatus, STATUS_META } from "@/lib/calendar-status";
import {
  addDays,
  channelSource,
  dateKey,
  displayStatusOf,
  fmtDayShort,
  nights,
  occupiesNight,
  parseKey,
} from "@/lib/calendar-views";
import { formatCurrency } from "@/lib/utils";
import { type Reservation, listReservations } from "@/lib/reservations";
import { useRealtime } from "@/lib/use-realtime";

function statusFilters(
  t: ReturnType<typeof useTranslations>,
): { value: DisplayStatus | "all"; label: string }[] {
  return [
    { value: "all", label: t("bookingsView.statusAll") },
    { value: "pending", label: t("bookingsView.statusPending") },
    { value: "confirmed", label: t("bookingsView.statusConfirmed") },
    { value: "in_house", label: t("bookingsView.statusInHouse") },
    { value: "completed", label: t("bookingsView.statusCompleted") },
    { value: "cancelled", label: t("bookingsView.statusCancelled") },
  ];
}

export function CalendarBookingsView({ properties }: { properties: Prop[] }) {
  const t = useTranslations("calendar");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<string | null>(null);

  // An-/Abreisen-Tag (oben). Liste-Filter (unten).
  const todayKey = useMemo(() => dateKey(new Date()), []);
  const [day, setDay] = useState<string>(todayKey);
  const [query, setQuery] = useState("");
  const [propFilter, setPropFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<DisplayStatus | "all">("all");
  const [channelFilter, setChannelFilter] = useState<AvailabilitySource | "all">("all");

  const titleOf = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of properties) map[p.id] = p.title;
    return map;
  }, [properties]);

  const load = useCallback(async () => {
    const res = await listReservations();
    if (res.ok) setReservations(res.data.items);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtime({ table: "reservations", onChange: load });

  // --- Oben: An-/Abreisen des gewählten Tages -------------------------------
  const active = useMemo(
    () => reservations.filter((r) => r.status !== "cancelled"),
    [reservations],
  );
  const arrivals = useMemo(() => active.filter((r) => r.check_in === day), [active, day]);
  const departures = useMemo(() => active.filter((r) => r.check_out === day), [active, day]);
  const inHouse = useMemo(
    () => active.filter((r) => occupiesNight(r, day) && r.check_in !== day),
    [active, day],
  );
  const dayLabel = parseKey(day).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // --- Unten: gefilterte Liste ----------------------------------------------
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reservations
      .filter((r) => {
        if (propFilter !== "all" && r.property_id !== propFilter) return false;
        if (channelFilter !== "all" && r.channel !== channelFilter) return false;
        if (statusFilter !== "all" && displayStatusOf(r, todayKey) !== statusFilter) {
          return false;
        }
        if (q) {
          const hay = `${r.guest_name} ${titleOf[r.property_id] ?? ""} ${
            r.ota_name ?? ""
          } ${r.external_ref ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.check_in < b.check_in ? 1 : a.check_in > b.check_in ? -1 : 0));
  }, [reservations, query, propFilter, statusFilter, channelFilter, todayKey, titleOf]);

  return (
    <div className="flex flex-col gap-6">
      {/* ===== Oben: An-/Abreisen ===== */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-lg font-bold">{t("bookingsView.arrivalsDepartures")}</h3>
          <div className="ml-2 flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setDay(dateKey(addDays(parseKey(day), -1)))}
              aria-label={t("bookingsView.previousDay")}
            >
              <Icon icon="ph:caret-left" className="size-4" />
            </Button>
            <Button variant="outline" onClick={() => setDay(todayKey)}>
              {t("bookingsView.today")}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setDay(dateKey(addDays(parseKey(day), 1)))}
              aria-label={t("bookingsView.nextDay")}
            >
              <Icon icon="ph:caret-right" className="size-4" />
            </Button>
            <Input
              type="date"
              value={day}
              onChange={(e) => e.target.value && setDay(e.target.value)}
              className="w-44"
            />
          </div>
          <span className="text-sm capitalize text-muted-foreground">{dayLabel}</span>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <DayColumn
            title={t("bookingsView.arrivals")}
            icon="ph:sign-in"
            accent="text-success"
            rows={arrivals}
            titleOf={titleOf}
            onOpen={setDetail}
            empty={t("bookingsView.noArrivals")}
            guestsLabel={(count) => t("bookingsView.guestsCount", { count })}
          />
          <DayColumn
            title={t("bookingsView.departures")}
            icon="ph:sign-out"
            accent="text-warning"
            rows={departures}
            titleOf={titleOf}
            onOpen={setDetail}
            empty={t("bookingsView.noDepartures")}
            guestsLabel={(count) => t("bookingsView.guestsCount", { count })}
          />
          <DayColumn
            title={t("bookingsView.inHouse")}
            icon="ph:door-open"
            accent="text-channel-vrbo"
            rows={inHouse}
            titleOf={titleOf}
            onOpen={setDetail}
            empty={t("bookingsView.noInHouse")}
            guestsLabel={(count) => t("bookingsView.guestsCount", { count })}
          />
        </div>
      </section>

      {/* ===== Unten: Buchungsliste ===== */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-lg font-bold">{t("bookingsView.allBookings")}</h3>
          <div className="relative ml-2">
            <Icon
              icon="ph:magnifying-glass"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("bookingsView.searchPlaceholder")}
              className="w-64 pl-9"
            />
          </div>
          <Select
            value={propFilter}
            onChange={setPropFilter}
            options={[
              { value: "all", label: t("bookingsView.allProperties") },
              ...properties.map((p) => ({ value: p.id, label: p.title })),
            ]}
          />
          <Select
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as DisplayStatus | "all")}
            options={statusFilters(t)}
          />
          <Select
            value={channelFilter}
            onChange={(v) => setChannelFilter(v as AvailabilitySource | "all")}
            options={[
              { value: "all", label: t("bookingsView.allChannels") },
              ...CHANNEL_SOURCES.map((s) => ({ value: s, label: channelMeta(s).label })),
            ]}
          />
          <span className="ml-auto text-sm text-muted-foreground">
            {t("bookingsView.bookingsCount", { count: rows.length })}
          </span>
        </div>

        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-sm">
              <thead>
                <tr className="border-b bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-semibold">{t("bookingsView.colProperty")}</th>
                  <th className="px-4 py-2.5 font-semibold">{t("bookingsView.colGuest")}</th>
                  <th className="px-4 py-2.5 font-semibold">{t("bookingsView.colPeriod")}</th>
                  <th className="px-4 py-2.5 text-right font-semibold">{t("bookingsView.colNights")}</th>
                  <th className="px-4 py-2.5 font-semibold">{t("bookingsView.colStatus")}</th>
                  <th className="px-4 py-2.5 font-semibold">{t("bookingsView.colChannel")}</th>
                  <th className="px-4 py-2.5 text-right font-semibold">{t("bookingsView.colAmount")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const ds = displayStatusOf(r, todayKey);
                  const sm = STATUS_META[ds];
                  const cm = channelMeta(channelSource(r));
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setDetail(r.id)}
                      className="cursor-pointer border-b transition-colors last:border-0 hover:bg-secondary/40"
                    >
                      <td className="px-4 py-3 font-medium">
                        {titleOf[r.property_id] ?? "—"}
                      </td>
                      <td className="px-4 py-3">{r.guest_name}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {fmtDayShort(r.check_in)} – {fmtDayShort(r.check_out)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {nights(r.check_in, r.check_out)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`size-2 rounded-full ${sm.dotBg}`} />
                          {sm.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          {cm.logo.kind === "icon" ? (
                            <Icon icon={cm.logo.icon} className="size-4" />
                          ) : null}
                          {r.ota_name ?? cm.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {/* Maskiert (null) für Rollen ohne Finanzzugriff — kein 0-Fallback. */}
                        {r.total_amount == null
                          ? "—"
                          : formatCurrency(r.total_amount, r.currency)}
                      </td>
                    </tr>
                  );
                })}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                      Keine Buchungen für diese Filter.
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                      Lädt…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {detail && (
        <ReservationDetailSlider
          reservationId={detail}
          todayKey={todayKey}
          onClose={() => setDetail(null)}
          onCancelled={load}
          onChanged={load}
        />
      )}
    </div>
  );
}

// Tages-Spalte (Anreisen/Abreisen/Im Haus) mit klickbaren Karten.
function DayColumn({
  title,
  icon,
  accent,
  rows,
  titleOf,
  onOpen,
  empty,
  guestsLabel,
}: {
  title: string;
  icon: string;
  accent: string;
  rows: Reservation[];
  titleOf: Record<string, string>;
  onOpen: (id: string) => void;
  empty: string;
  guestsLabel: (count: number) => string;
}) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <Icon icon={icon} className={`size-5 ${accent}`} />
        <h4 className="font-display text-base font-bold">{title}</h4>
        <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">
          {rows.length}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => {
            const cm = channelMeta(channelSource(r));
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onOpen(r.id)}
                  className="flex w-full items-center gap-3 rounded-2xl border bg-card px-3 py-2.5 text-left transition-colors hover:bg-secondary/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.guest_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {titleOf[r.property_id] ?? "—"} · {guestsLabel(r.num_guests)}
                    </p>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {cm.logo.kind === "icon" ? (
                      <Icon icon={cm.logo.icon} className="size-4" />
                    ) : null}
                    {r.total_amount == null
                      ? r.ota_name ?? cm.label
                      : formatCurrency(r.total_amount, r.currency)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// Kleines, token-basiertes Select (gleiche Optik wie die Filter im Board).
function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <NativeSelect
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </NativeSelect>
  );
}
