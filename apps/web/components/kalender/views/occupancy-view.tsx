"use client";

// Belegungs-/Auslastungs-Heatmap (Performance-Raster): Objekte
// als Zeilen, Tage als Spalten, Zelle eingefärbt nach belegt/frei; die Kopfzeile
// zeigt die Tages-Gesamtauslastung (Anteil belegter Objekte) als Farbstufe. So
// sieht man auf einen Blick volle und schwache Tage. Aggregat rein im Frontend
// aus listReservations() (kein neuer Endpunkt). Realtime auf reservations.
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { Prop } from "@/components/kalender/calendar-board";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { getBoard } from "@/lib/calendar";
import {
  addDays,
  dateKey,
  occupancyClass,
  occupancyMatrix,
  parseKey,
} from "@/lib/calendar-views";
import { type Reservation, listReservations } from "@/lib/reservations";
import { useRealtime } from "@/lib/use-realtime";

export function CalendarOccupancyView({ properties }: { properties: Prop[] }) {
  const t = useTranslations("calendar");
  const WINDOWS = useMemo(
    () =>
      [
        { value: 30, label: t("occupancyView.window", { count: 30 }) },
        { value: 60, label: t("occupancyView.window", { count: 60 }) },
        { value: 90, label: t("occupancyView.window", { count: 90 }) },
      ] as const,
    [t],
  );
  const [reservations, setReservations] = useState<Reservation[]>([]);
  // Belegte/gesperrte Tage je Objekt aus dem Board (availability=0: Block,
  // Stop-Sell, OTA-Import) — sie erscheinen NICHT in reservations.
  const [blockedByProp, setBlockedByProp] = useState<Record<string, Set<string>>>(
    {},
  );
  const [days, setDays] = useState<number>(30);

  // Fenster startet heute (lokale Mitternacht), stabil pro Mount.
  const start = useMemo(() => parseKey(dateKey(new Date())), []);

  const propertyIds = useMemo(() => properties.map((p) => p.id), [properties]);

  const load = useCallback(async () => {
    const res = await listReservations();
    if (res.ok) setReservations(res.data.items);
    // Board für den sichtbaren Zeitraum laden → gesperrte/gebuchte Tage (status
    // != 'open') und Stop-Sell-Tage als belegt markieren.
    const end = dateKey(addDays(start, days));
    const board = await getBoard(propertyIds, dateKey(start), end);
    if (board.ok) {
      const map: Record<string, Set<string>> = {};
      for (const item of board.data.items) {
        const set = new Set<string>();
        for (const d of item.days) {
          if (d.status !== "open") set.add(d.date);
        }
        for (const s of item.stop_sell) set.add(s.date);
        map[item.property_id] = set;
      }
      setBlockedByProp(map);
    }
  }, [propertyIds, start, days]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime-Pflicht: NICHT nur reservations — auch availability + stop_sell,
  // damit ein Block/Stop-Sell/OTA-Import die Auslastung sofort aktualisiert
  // (konsistent zum Timeline-Board).
  useRealtime({ table: "reservations", onChange: load });
  useRealtime({ table: "availability", onChange: load });
  useRealtime({ table: "stop_sell", onChange: load });

  const matrix = useMemo(
    () => occupancyMatrix(reservations, propertyIds, start, days, blockedByProp),
    [reservations, propertyIds, start, days, blockedByProp],
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
          {t("occupancyView.avgOccupancyPrefix")}{" "}
          <span className="font-semibold text-foreground">
            {Math.round(avgRatio * 100)}%
          </span>{" "}
          {t("occupancyView.overDays", { count: days })}
        </span>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-semibold">
                  {t("occupancyView.propertyColumn")}
                </th>
                {matrix.dayKeys.map((k) => {
                  const d = parseKey(k);
                  const cell = matrix.perDay[k];
                  return (
                    <th
                      key={k}
                      title={t("occupancyView.dayHeaderTooltip", {
                        date: d.toLocaleDateString("de-DE"),
                        booked: cell.booked,
                        total: propertyIds.length,
                      })}
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
                        title={t("occupancyView.cellTooltip", {
                          property: p.title,
                          date: parseKey(k).toLocaleDateString("de-DE"),
                          status: booked
                            ? t("occupancyView.statusBooked")
                            : t("occupancyView.statusFree"),
                        })}
                        className={`h-6 w-7 border-b border-l ${booked ? "bg-accent/80" : "bg-card"
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
                    {t("occupancyView.noProperties")}
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
          <span className="size-3 rounded-sm bg-accent/80" />{" "}
          {t("occupancyView.legendBookedProperty")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm border bg-card" />{" "}
          {t("occupancyView.statusFree")}
        </span>
        <span className="ml-2">{t("occupancyView.legendDayTotal")}</span>
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
