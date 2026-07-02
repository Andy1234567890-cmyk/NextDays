"use client";

// Saisonpreise: Tagespreise je Zeitraum (Hoch-/Nebensaison). Schreibt
// price_overrides im Backend und pusht den Preis realtime an Channex (alle Kanäle).
import { useEffect, useState, useTransition } from "react";

import { useRealtime } from "@/lib/use-realtime";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type SeasonPriceDay,
  listSeasonPrices,
  setSeasonPrice,
} from "@/lib/calendar";
import type { Property } from "@/lib/properties";

function plusDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function SeasonPriceForm({ initial }: { initial: Property }) {
  const today = new Date().toISOString().slice(0, 10);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(plusDays(today, 7));
  const [price, setPrice] = useState("");
  const [days, setDays] = useState<SeasonPriceDay[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reload() {
    startTransition(async () => {
      const res = await listSeasonPrices(initial.id, today, plusDays(today, 365));
      if (res.ok) setDays(res.data.items);
    });
  }

  useEffect(reload, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Realtime-Pflicht: Saisonpreise anderer Sessions/aus dem Kalender live
  // spiegeln (price_overrides ist die Preis-Wahrheit hinter dieser Liste).
  useRealtime({
    table: "price_overrides",
    filter: `property_id=eq.${initial.id}`,
    onChange: reload,
  });

  function onSave() {
    const p = Number(price);
    if (!p || p <= 0) {
      setMsg("Bitte einen gültigen Preis eingeben.");
      return;
    }
    setMsg(null);
    startTransition(async () => {
      const res = await setSeasonPrice(initial.id, start, end, p);
      if (res.ok) {
        setMsg(`${res.data.days} Tag(e) auf ${p} € gesetzt.`);
        reload();
      } else {
        setMsg(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-extrabold">Saisonpreise</h1>

      <Card>
        <CardHeader>
          <CardTitle>Zeitraum-Preis setzen</CardTitle>
          <CardDescription>
            Gilt pro Nacht im Zeitraum und wird automatisch an alle Buchungsportale
            übertragen.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
            <div className="flex flex-col gap-1.5 sm:col-span-4">
              <Label htmlFor="sp-from">Von</Label>
              <Input
                id="sp-from"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-4">
              <Label htmlFor="sp-to">Bis (exklusiv)</Label>
              <Input
                id="sp-to"
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="sp-price">Preis / Nacht</Label>
              <Input
                id="sp-price"
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div className="flex items-end sm:col-span-2">
              <Button onClick={onSave} disabled={pending} className="w-full">
                Setzen
              </Button>
            </div>
          </div>
          {msg && <p className="text-sm text-foreground">{msg}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gesetzte Tagespreise</CardTitle>
        </CardHeader>
        <CardContent>
          {days.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Saisonpreise gesetzt — es gilt der Basispreis.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-(--radius) border border-border">
              {days.map((d) => (
                <li key={d.date} className="flex items-center justify-between p-3 text-sm">
                  <span>{d.date}</span>
                  <span className="font-medium">{d.price} €</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
