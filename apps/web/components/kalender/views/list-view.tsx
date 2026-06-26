"use client";

// Listenansicht des Kalenders (wie die Reservierungsliste in Hostaway/Lodgify):
// alle Buchungen tabellarisch — Objekt, Gast, Zeitraum, Nächte, Status, Kanal,
// Betrag. Filter über Suche/Objekt/Status/Kanal; Klick auf eine Zeile öffnet
// den bestehenden Detail-Slider. Realtime auf reservations (kein Polling).
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { Prop } from "@/components/kalender/calendar-board";
import { ReservationDetailSlider } from "@/components/kalender/reservation-detail-slider";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AvailabilitySource } from "@/lib/calendar";
import { CHANNEL_SOURCES, channelMeta } from "@/lib/calendar-channels";
import { type DisplayStatus, STATUS_META } from "@/lib/calendar-status";
import {
  channelSource,
  dateKey,
  displayStatusOf,
  fmtDayShort,
  nights,
} from "@/lib/calendar-views";
import { formatCurrency } from "@/lib/utils";
import { type Reservation, listReservations } from "@/lib/reservations";
import { useRealtime } from "@/lib/use-realtime";

const STATUS_FILTERS: { value: DisplayStatus | "all"; label: string }[] = [
  { value: "all", label: "Alle Status" },
  { value: "pending", label: "Option" },
  { value: "confirmed", label: "Bestätigt" },
  { value: "in_house", label: "Eingecheckt" },
  { value: "completed", label: "Ausgecheckt" },
  { value: "cancelled", label: "Storniert" },
];

export function CalendarListView({ properties }: { properties: Prop[] }) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [propFilter, setPropFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<DisplayStatus | "all">("all");
  const [channelFilter, setChannelFilter] = useState<AvailabilitySource | "all">("all");

  const todayKey = useMemo(() => dateKey(new Date()), []);
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

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reservations
      .filter((r) => {
        if (propFilter !== "all" && r.property_id !== propFilter) return false;
        if (channelFilter !== "all" && r.channel !== channelFilter) return false;
        if (
          statusFilter !== "all" &&
          displayStatusOf(r, todayKey) !== statusFilter
        ) {
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
      // Kommende/jüngste Anreisen zuerst (Check-in absteigend).
      .sort((a, b) => (a.check_in < b.check_in ? 1 : a.check_in > b.check_in ? -1 : 0));
  }, [reservations, query, propFilter, statusFilter, channelFilter, todayKey, titleOf]);

  return (
    <div className="flex flex-col gap-4">
      {/* Filterleiste */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Icon
            icon="ph:magnifying-glass"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Gast, Objekt, OTA-Code…"
            className="w-64 pl-9"
          />
        </div>
        <Select
          value={propFilter}
          onChange={setPropFilter}
          options={[
            { value: "all", label: "Alle Objekte" },
            ...properties.map((p) => ({ value: p.id, label: p.title })),
          ]}
        />
        <Select
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as DisplayStatus | "all")}
          options={STATUS_FILTERS}
        />
        <Select
          value={channelFilter}
          onChange={(v) => setChannelFilter(v as AvailabilitySource | "all")}
          options={[
            { value: "all", label: "Alle Kanäle" },
            ...CHANNEL_SOURCES.map((s) => ({ value: s, label: channelMeta(s).label })),
          ]}
        />
        <span className="ml-auto text-sm text-muted-foreground">
          {rows.length} {rows.length === 1 ? "Buchung" : "Buchungen"}
        </span>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr className="border-b bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-semibold">Objekt</th>
                <th className="px-4 py-2.5 font-semibold">Gast</th>
                <th className="px-4 py-2.5 font-semibold">Zeitraum</th>
                <th className="px-4 py-2.5 text-right font-semibold">Nächte</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Kanal</th>
                <th className="px-4 py-2.5 text-right font-semibold">Betrag</th>
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

      {detail && (
        <ReservationDetailSlider
          reservationId={detail}
          todayKey={todayKey}
          onClose={() => setDetail(null)}
          onCancelled={load}
        />
      )}
    </div>
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
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-full border bg-card px-3 text-sm text-foreground"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
