"use client";

// Ankünfte & Abreisen (Front-Desk-Tagesblick, wie OPERA/Cloudbeds): für einen
// gewählten Tag (Default heute) drei Spalten — Anreisen (check_in == Tag),
// Abreisen (check_out == Tag) und „im Haus" (läuft über den Tag). Storno fällt
// raus. Klick auf eine Karte öffnet den Detail-Slider. Realtime auf reservations.
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { Prop } from "@/components/kalender/calendar-board";
import { ReservationDetailSlider } from "@/components/kalender/reservation-detail-slider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { channelMeta } from "@/lib/calendar-channels";
import {
  addDays,
  channelSource,
  dateKey,
  occupiesNight,
  parseKey,
} from "@/lib/calendar-views";
import { formatCurrency } from "@/lib/utils";
import { type Reservation, listReservations } from "@/lib/reservations";
import { useRealtime } from "@/lib/use-realtime";

export function CalendarArrivalsView({ properties }: { properties: Prop[] }) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [detail, setDetail] = useState<string | null>(null);
  const todayKey = useMemo(() => dateKey(new Date()), []);
  const [day, setDay] = useState<string>(todayKey);

  const titleOf = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of properties) map[p.id] = p.title;
    return map;
  }, [properties]);

  const load = useCallback(async () => {
    const res = await listReservations();
    if (res.ok) setReservations(res.data.items);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtime({ table: "reservations", onChange: load });

  const active = useMemo(
    () => reservations.filter((r) => r.status !== "cancelled"),
    [reservations],
  );
  const arrivals = useMemo(
    () => active.filter((r) => r.check_in === day),
    [active, day],
  );
  const departures = useMemo(
    () => active.filter((r) => r.check_out === day),
    [active, day],
  );
  const inHouse = useMemo(
    () =>
      active.filter(
        (r) => occupiesNight(r, day) && r.check_in !== day,
      ),
    [active, day],
  );

  const dayLabel = parseKey(day).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Datums-Navigation */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setDay(dateKey(addDays(parseKey(day), -1)))}
          aria-label="Vorheriger Tag"
        >
          <Icon icon="ph:caret-left" className="size-4" />
        </Button>
        <Button variant="outline" onClick={() => setDay(todayKey)}>
          Heute
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setDay(dateKey(addDays(parseKey(day), 1)))}
          aria-label="Nächster Tag"
        >
          <Icon icon="ph:caret-right" className="size-4" />
        </Button>
        <Input
          type="date"
          value={day}
          onChange={(e) => e.target.value && setDay(e.target.value)}
          className="w-44"
        />
        <span className="ml-1 text-sm font-medium capitalize text-muted-foreground">
          {dayLabel}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Column
          title="Anreisen"
          icon="ph:sign-in"
          accent="text-success"
          rows={arrivals}
          titleOf={titleOf}
          onOpen={setDetail}
          empty="Keine Anreisen an diesem Tag."
        />
        <Column
          title="Abreisen"
          icon="ph:sign-out"
          accent="text-warning"
          rows={departures}
          titleOf={titleOf}
          onOpen={setDetail}
          empty="Keine Abreisen an diesem Tag."
        />
        <Column
          title="Im Haus"
          icon="ph:door-open"
          accent="text-channel-vrbo"
          rows={inHouse}
          titleOf={titleOf}
          onOpen={setDetail}
          empty="Niemand verbleibt über diesen Tag."
        />
      </div>

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

function Column({
  title,
  icon,
  accent,
  rows,
  titleOf,
  onOpen,
  empty,
}: {
  title: string;
  icon: string;
  accent: string;
  rows: Reservation[];
  titleOf: Record<string, string>;
  onOpen: (id: string) => void;
  empty: string;
}) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <Icon icon={icon} className={`size-5 ${accent}`} />
        <h3 className="font-display text-lg font-bold">{title}</h3>
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
                      {titleOf[r.property_id] ?? "—"} · {r.num_guests} Gäste
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
