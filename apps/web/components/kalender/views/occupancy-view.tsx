"use client";

// Belegungs-/Auslastungs-Heatmap (wie das Lodgify-„Performance"-Raster): Objekte
// als Zeilen, Tage als Spalten, Zelle eingefärbt nach belegt/frei; die Kopfzeile
// zeigt die Tages-Gesamtauslastung (Anteil belegter Objekte) als Farbstufe. So
// sieht man auf einen Blick volle und schwache Tage. Aggregat rein im Frontend
// aus listReservations() (kein neuer Endpunkt). Realtime auf reservations.
import { useCallback, useEffect, useMemo, useState } from "react";

import type { Prop } from "@/components/kalender/calendar-board";
import { Card } from "@/components/ui/card";
import {
  addDays,
  dateKey,
  occupancyClass,
  occupancyMatrix,
  parseKey,
} from "@/lib/calendar-views";
import { type Reservation, listReservations } from "@/lib/reservations";
import { useRealtime } from "@/lib/use-realtime";

const WINDOWS = [
  { value: 30, label: "30 Tage" },
  { value: 60, label: "60 Tage" },
  { value: 90, label: "90 Tage" },
] as const;

export function CalendarOccupancyView({ properties }: { properties: Prop[] }) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [days, setDays] = useState<number>(30);

  // Fenster startet heute (lokale Mitternacht), stabil pro Mount.
  const start = useMemo(() => parseKey(dateKey(new Date())), []);

  const load = useCallback(async () => {
    const res = await listReservations();
    if (res.ok) setReservations(res.data.items);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtime({ table: "reservations", onChange: load });

  const propertyIds = useMemo(() => properties.map((p) => p.id), [properties]);
  const matrix = useMemo(
    () => occupancyMatrix(reservations, propertyIds, start, days),
    [reservations, propertyIds, start, days],
  );

  // Durchschnittliche Auslastung über das Fenster (für die Kopfkennzahl).
  const avgRatio = useMemo(() => {
    const cells = matrix.dayKeys.map((k) => matrix.perDay[k].ratio);
    if (cells.length === 0) return 0;
    return cells.reduce((a, b) => a + b, 0) / cells.length;
  }, [matrix]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented value={days} onChange={setDays} options={WINDOWS} />
        <span className="ml-auto text-sm text-muted-foreground">
          Ø Auslastung{" "}
          <span className="font-semibold text-foreground">
            {Math.round(avgRatio * 100)}%
          </span>{" "}
          über {days} Tage
        </span>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-semibold">
                  Objekt
                </th>
                {matrix.dayKeys.map((k) => {
                  const d = parseKey(k);
                  const cell = matrix.perDay[k];
                  return (
                    <th
                      key={k}
                      title={`${d.toLocaleDateString("de-DE")} · ${cell.booked}/${
                        propertyIds.length
                      } belegt`}
                      className={`h-12 w-7 border-b border-l px-0 text-center align-bottom font-medium ${occupancyClass(
                        cell.ratio,
                      )}`}
                    >
                      <span className="block leading-tight text-[0.625rem] text-muted-foreground">
                        {d.getDate()}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {properties.map((p) => (
                <tr key={p.id}>
                  <td className="sticky left-0 z-10 max-w-[12rem] truncate bg-card px-3 py-1.5 font-medium">
                    {p.title}
                  </td>
                  {matrix.dayKeys.map((k) => {
                    const booked = matrix.perProperty[p.id]?.[k] === true;
                    return (
                      <td
                        key={k}
                        title={`${p.title} · ${parseKey(k).toLocaleDateString(
                          "de-DE",
                        )} · ${booked ? "belegt" : "frei"}`}
                        className={`h-6 w-7 border-b border-l ${
                          booked ? "bg-accent/80" : "bg-card"
                        }`}
                      />
                    );
                  })}
                </tr>
              ))}
              {properties.length === 0 && (
                <tr>
                  <td
                    colSpan={matrix.dayKeys.length + 1}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    Keine Objekte vorhanden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Legende */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-accent/80" /> belegt (Objekt)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm border bg-card" /> frei
        </span>
        <span className="ml-2">Kopfzeile = Tages-Gesamtauslastung:</span>
        {[0, 0.3, 0.6, 0.9, 1].map((r) => (
          <span
            key={r}
            className={`size-3 rounded-sm ${occupancyClass(r)}`}
            title={`${Math.round(r * 100)}%`}
          />
        ))}
      </div>
    </div>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: number;
  onChange: (v: number) => void;
  options: readonly { value: number; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-full border bg-secondary p-0.5 text-sm">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-full px-3 py-1.5 font-medium transition-colors ${
            value === o.value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
