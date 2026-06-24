"use client";

// Dynamic-Pricing-Bereich der Objekt-Preise-Seite: Opt-in-Toggle + Regeln
// (Min/Max-Preis, Wochenend-/Orphan-/Auslastungs-/Last-Minute). Speichert nach
// dp_settings. Die Regel-Engine berechnet täglich dynamic_prices; ein manueller
// Tagespreis im Kalender gewinnt immer (Vorrang im Resolver).
import { Icon } from "@iconify/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  type DpSettings,
  type LastMinuteRule,
  saveDpSettings,
} from "@/lib/dynamic-pricing";

export function DynamicPricingSection({
  propertyId,
  initial,
}: {
  propertyId: string;
  initial: DpSettings;
}) {
  const [s, setS] = useState<DpSettings>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function set<K extends keyof DpSettings>(key: K, value: DpSettings[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await saveDpSettings(propertyId, {
      enabled: s.enabled,
      min_price: s.min_price,
      max_price: s.max_price,
      weekend_uplift_pct: s.weekend_uplift_pct,
      last_minute: s.last_minute,
      orphan_gap_discount_pct: s.orphan_gap_discount_pct,
      occupancy_sensitivity: s.occupancy_sensitivity,
      min_stay_min: s.min_stay_min,
      min_stay_max: s.min_stay_max,
    });
    setBusy(false);
    if (res.ok) {
      setS(res.data);
      setMsg("Gespeichert.");
    } else {
      setMsg(res.error);
    }
  }

  function updateRule(i: number, patch: Partial<LastMinuteRule>) {
    set(
      "last_minute",
      s.last_minute.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-2 font-display text-xl font-extrabold">
          Dynamische Preise
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
            auto
          </span>
        </h2>
        <p className="text-sm text-muted-foreground">
          Lass NextDays den Nachtpreis automatisch nach Saison, Wochenende,
          Auslastung und Vorlaufzeit anpassen. Ein manuell gesetzter Tagespreis im
          Kalender hat immer Vorrang.
        </p>
      </div>

      <Card className="flex items-center justify-between gap-4 p-5">
        <div className="leading-tight">
          <p className="font-semibold">Dynamic Pricing aktiv</p>
          <p className="text-sm text-muted-foreground">
            Standardmäßig aus — du entscheidest pro Objekt.
          </p>
        </div>
        <Switch
          checked={s.enabled}
          onCheckedChange={(c) => set("enabled", c)}
        />
      </Card>

      {s.enabled && (
        <Card className="flex flex-col gap-5 p-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Mindestpreis (€)">
              <NumInput
                value={s.min_price}
                onChange={(n) => set("min_price", n)}
                placeholder="kein Limit"
              />
            </Field>
            <Field label="Höchstpreis (€)">
              <NumInput
                value={s.max_price}
                onChange={(n) => set("max_price", n)}
                placeholder="kein Limit"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Wochenend-Aufschlag (%)">
              <NumInput
                value={s.weekend_uplift_pct}
                onChange={(n) => set("weekend_uplift_pct", n ?? 0)}
              />
            </Field>
            <Field label="Auslastungs-Empfindlichkeit (%)">
              <NumInput
                value={s.occupancy_sensitivity}
                onChange={(n) => set("occupancy_sensitivity", n ?? 0)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Lücken-Rabatt 1–2 Nächte (%)">
              <NumInput
                value={s.orphan_gap_discount_pct}
                onChange={(n) => set("orphan_gap_discount_pct", n ?? 0)}
              />
            </Field>
            <Field label="Min-Stay-Spanne (Tage)">
              <div className="flex items-center gap-2">
                <NumInput
                  value={s.min_stay_min}
                  onChange={(n) => set("min_stay_min", Math.max(1, n ?? 1))}
                />
                <span className="text-muted-foreground">–</span>
                <NumInput
                  value={s.min_stay_max}
                  onChange={(n) => set("min_stay_max", Math.max(1, n ?? 1))}
                />
              </div>
            </Field>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Last-Minute-Rabatte</Label>
            {s.last_minute.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Noch keine Last-Minute-Regeln.
              </p>
            )}
            {s.last_minute.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">ab</span>
                <NumInput
                  value={r.days_before}
                  onChange={(n) => updateRule(i, { days_before: n ?? 1 })}
                  className="w-20"
                />
                <span className="text-muted-foreground">Tagen vorher</span>
                <NumInput
                  value={r.discount_pct}
                  onChange={(n) => updateRule(i, { discount_pct: n ?? 0 })}
                  className="w-20"
                />
                <span className="text-muted-foreground">% Rabatt</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Entfernen"
                  onClick={() =>
                    set(
                      "last_minute",
                      s.last_minute.filter((_, idx) => idx !== i),
                    )
                  }
                >
                  <Icon icon="ph:trash" className="size-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-fit gap-1.5"
              onClick={() =>
                set("last_minute", [
                  ...s.last_minute,
                  { days_before: 5, discount_pct: 10 },
                ])
              }
            >
              <Icon icon="ph:plus" className="size-4" /> Regel hinzufügen
            </Button>
          </div>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy}>
          {busy ? "Speichern…" : "Speichern"}
        </Button>
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      </div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function NumInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Input
      type="number"
      min={0}
      value={value ?? ""}
      placeholder={placeholder}
      className={className}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "" ? null : Number(v));
      }}
    />
  );
}
