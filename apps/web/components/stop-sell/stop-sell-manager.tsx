"use client";

// Stop-Sell-Verwaltung: pro Objekt + Zeitraum Verkaufsstopps anzeigen/setzen.
// Channex-Stops (source=channex) sind read-only (spiegeln den OTA-Stand).
import { Icon } from "@iconify/react";
import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  clearStopSell,
  listStopSell,
  setStopSell,
  type StopSellDay,
} from "@/lib/calendar";
import { useRealtime } from "@/lib/use-realtime";

type Property = { id: string; title: string };

function plusDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function StopSellManager({ properties }: { properties: Property[] }) {
  const t = useTranslations("stopSell");
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const today = new Date().toISOString().slice(0, 10);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(plusDays(today, 1));
  const [days, setDays] = useState<StopSellDay[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reload() {
    if (!propertyId) return;
    startTransition(async () => {
      // Lade ein großzügiges Fenster (heute .. +180 Tage) für die Übersicht.
      const res = await listStopSell(propertyId, today, plusDays(today, 180));
      if (res.ok) setDays(res.data.items);
    });
  }

  useEffect(reload, [propertyId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live: Verkaufsstopps + Belegung des gewählten Objekts ohne Reload spiegeln
  // (z. B. Channex-Stops, die per Import kommen).
  useRealtime({
    table: "stop_sell",
    filter: propertyId ? `property_id=eq.${propertyId}` : undefined,
    onChange: reload,
    enabled: !!propertyId,
  });

  function onSet() {
    setMsg(null);
    startTransition(async () => {
      const res = await setStopSell(propertyId, start, end);
      if (res.ok) {
        setMsg(t("setOk", { days: res.data.stopped_days }));
        reload();
      } else {
        setMsg(res.error);
      }
    });
  }

  function onClear(rangeStart: string, rangeEnd: string) {
    startTransition(async () => {
      const res = await clearStopSell(propertyId, rangeStart, rangeEnd);
      if (res.ok) reload();
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t("setTitle")}</CardTitle>
          <CardDescription>{t("setHint")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
            <label className="flex flex-col gap-1 sm:col-span-12">
              <span className="text-sm font-medium">{t("property")}</span>
              <NativeSelect
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="flex flex-col gap-1 sm:col-span-5">
              <span className="text-sm font-medium">{t("from")}</span>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 sm:col-span-5">
              <span className="text-sm font-medium">{t("to")}</span>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
            <div className="flex items-end sm:col-span-2">
              <Button type="button" onClick={onSet} disabled={pending || !propertyId} className="w-full">
                {t("set")}
              </Button>
            </div>
          </div>
          {msg && <p className="text-sm text-foreground">{msg}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("activeTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {days.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("none")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-(--radius) border border-border">
              {days.map((d) => (
                <li key={d.id} className="flex items-center gap-3 p-3">
                  <Icon icon="ph:hand-palm" className="size-5 text-muted-foreground" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-medium">{d.date}</span>
                    <span className="text-xs text-muted-foreground">
                      {d.source === "channex" ? t("sourceChannex") : t("sourceManual")}
                      {d.reason ? ` · ${d.reason}` : ""}
                    </span>
                  </div>
                  {d.source === "manual" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onClear(d.date, plusDays(d.date, 1))}
                      disabled={pending}
                    >
                      {t("clear")}
                    </Button>
                  ) : (
                    <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {t("readonly")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
