"use client";

// Basispreis-Slider (Hostaway-„Set your base rate"): pro Objekt die Basispreis-
// Strategie wählen — Datengetrieben (Konservativ/Empfohlen/Aggressiv) oder
// Manuell (eigener Basispreis) — plus Mindest-/Höchstpreis und (eingeklappt) die
// erweiterten Regeln (Wochenende/Auslastung/Last-Minute/Orphan/Markt). Lädt die
// vollständigen Einstellungen beim Öffnen und speichert per PUT.
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  type BaseRateMode,
  type DpOverviewItem,
  type DpSettings,
  getDpSettings,
  type LastMinuteRule,
  saveDpSettings,
} from "@/lib/dynamic-pricing";

const RATE_MODES: { value: BaseRateMode; title: string; hint: string }[] = [
  {
    value: "conservative",
    title: "Konservativ",
    hint: "Passt sich an Markt und Buchungslage an, bleibt aber zurückhaltender als „Empfohlen“.",
  },
  {
    value: "recommended",
    title: "Empfohlen",
    hint: "Passt sich an Markt und Buchungslage an.",
  },
  {
    value: "aggressive",
    title: "Aggressiv",
    hint: "Passt sich an Markt und Buchungslage an, aber offensiver als „Empfohlen“.",
  },
];

export function DpEditSheet({
  item,
  onClose,
  onSaved,
}: {
  item: DpOverviewItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [s, setS] = useState<DpSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);

  useEffect(() => {
    let active = true;
    getDpSettings(item.property_id).then((res) => {
      if (!active) return;
      if (res.ok) setS(res.data);
      else setLoadError(res.error);
    });
    return () => {
      active = false;
    };
  }, [item.property_id]);

  function set<K extends keyof DpSettings>(key: K, value: DpSettings[K]) {
    setS((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function save() {
    if (!s) return;
    setBusy(true);
    setMsg(null);
    const res = await saveDpSettings(item.property_id, {
      enabled: s.enabled,
      base_mode: s.base_mode,
      base_rate_mode: s.base_rate_mode,
      manual_base_price: s.manual_base_price,
      min_price: s.min_price,
      max_price: s.max_price,
      weekend_uplift_pct: s.weekend_uplift_pct,
      occupancy_sensitivity: s.occupancy_sensitivity,
      orphan_gap_discount_pct: s.orphan_gap_discount_pct,
      last_minute: s.last_minute,
      min_stay_min: s.min_stay_min,
      min_stay_max: s.min_stay_max,
      market_enabled: s.market_enabled,
      market_sensitivity: s.market_sensitivity,
      market_max_adjust_pct: s.market_max_adjust_pct,
      market_key: s.market_key,
      comp_refs: s.comp_refs,
    });
    setBusy(false);
    if (res.ok) {
      onSaved();
    } else {
      setMsg(res.error);
    }
  }

  const cur = item.currency || "EUR";

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Basispreis festlegen</SheetTitle>
          <SheetDescription>{item.title}</SheetDescription>
        </SheetHeader>

        {loadError && (
          <p className="px-4 text-sm text-destructive">{loadError}</p>
        )}

        {!s && !loadError && (
          <p className="px-4 text-sm text-muted-foreground">Lädt…</p>
        )}

        {s && (
          <div className="flex flex-col gap-6 p-4">
            {/* Aktiv-Schalter */}
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span className="leading-tight">
                <span className="font-semibold">Dynamic Pricing aktiv</span>
                <span className="block text-sm text-muted-foreground">
                  Standardmäßig aus — du entscheidest pro Objekt.
                </span>
              </span>
              <Switch
                checked={s.enabled}
                onCheckedChange={(c) => set("enabled", c)}
              />
            </label>

            {/* Basispreis-Modus */}
            <div className="flex flex-col gap-3">
              <Label>Basispreis</Label>
              <RadioRow
                checked={s.base_mode === "data_driven"}
                title="Datengetrieben"
                hint="Informiert durch unsere Engine, laufend aktualisiert."
                onSelect={() => set("base_mode", "data_driven")}
              />
              {s.base_mode === "data_driven" && (
                <div className="ml-6 flex flex-col gap-2">
                  {RATE_MODES.map((m) => (
                    <RadioRow
                      key={m.value}
                      small
                      checked={s.base_rate_mode === m.value}
                      title={m.title}
                      hint={m.hint}
                      right={
                        item.base_rate !== null && m.value === "recommended"
                          ? fmt(item.base_rate, cur)
                          : undefined
                      }
                      onSelect={() => set("base_rate_mode", m.value)}
                    />
                  ))}
                </div>
              )}
              <RadioRow
                checked={s.base_mode === "manual"}
                title="Manuell"
                hint="Du behältst die volle Kontrolle."
                onSelect={() => set("base_mode", "manual")}
              />
              {s.base_mode === "manual" && (
                <div className="ml-6">
                  <Field label={`Basispreis (${cur})`}>
                    <NumInput
                      value={s.manual_base_price}
                      onChange={(n) => set("manual_base_price", n)}
                      placeholder="z. B. 150"
                    />
                  </Field>
                </div>
              )}
            </div>

            {/* Min/Max-Leitplanken */}
            <div className="grid grid-cols-2 gap-4">
              <Field label={`Mindestpreis (${cur})`}>
                <NumInput
                  value={s.min_price}
                  onChange={(n) => set("min_price", n)}
                  placeholder="kein Limit"
                />
              </Field>
              <Field label={`Höchstpreis (${cur})`}>
                <NumInput
                  value={s.max_price}
                  onChange={(n) => set("max_price", n)}
                  placeholder="kein Limit"
                />
              </Field>
            </div>

            {/* Erweiterte Regeln (eingeklappt) */}
            <div className="flex flex-col gap-3 border-t pt-4">
              <button
                type="button"
                onClick={() => setAdvanced((v) => !v)}
                className="flex items-center justify-between text-sm font-medium"
              >
                Erweiterte Regeln
                <Icon
                  icon="ph:caret-down"
                  className={`size-4 transition-transform ${advanced ? "rotate-180" : ""}`}
                />
              </button>
              {advanced && (
                <div className="flex flex-col gap-5">
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

                  <LastMinuteEditor
                    rules={s.last_minute}
                    onChange={(r) => set("last_minute", r)}
                  />

                  {/* Marktdaten */}
                  <label className="flex cursor-pointer items-center justify-between gap-3">
                    <span className="leading-tight">
                      <span className="font-semibold">Marktdaten nutzen</span>
                      <span className="block text-sm text-muted-foreground">
                        Preis zusätzlich am Wettbewerb/der Marktnachfrage
                        ausrichten (benötigt eine Marktdaten-Quelle).
                      </span>
                    </span>
                    <Switch
                      checked={s.market_enabled}
                      onCheckedChange={(c) => set("market_enabled", c)}
                    />
                  </label>
                  {s.market_enabled && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Markt-Empfindlichkeit (%)">
                          <NumInput
                            value={s.market_sensitivity}
                            onChange={(n) => set("market_sensitivity", n ?? 0)}
                          />
                        </Field>
                        <Field label="Max. Markt-Korrektur (±%)">
                          <NumInput
                            value={s.market_max_adjust_pct}
                            onChange={(n) => set("market_max_adjust_pct", n ?? 0)}
                          />
                        </Field>
                      </div>
                      <Field label="Markt-Schlüssel (Region/Markt)">
                        <Input
                          value={s.market_key ?? ""}
                          placeholder="z. B. de-muenchen"
                          onChange={(e) =>
                            set("market_key", e.target.value || null)
                          }
                        />
                      </Field>
                      <Field label="Vergleichsobjekte (Comp-Set, kommagetrennt)">
                        <Input
                          value={s.comp_refs.join(", ")}
                          placeholder="ref-1, ref-2, …"
                          onChange={(e) =>
                            set(
                              "comp_refs",
                              e.target.value
                                .split(",")
                                .map((x) => x.trim())
                                .filter(Boolean),
                            )
                          }
                        />
                      </Field>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={save} disabled={busy}>
                {busy ? "Speichern…" : "Speichern"}
              </Button>
              {msg && <p className="text-sm text-destructive">{msg}</p>}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function RadioRow({
  checked,
  title,
  hint,
  right,
  small,
  onSelect,
}: {
  checked: boolean;
  title: string;
  hint: string;
  right?: string;
  small?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-start gap-3 rounded-(--radius) border p-3 text-left ${
        checked ? "border-accent bg-accent/5" : "border-border hover:bg-muted/50"
      }`}
    >
      <span
        className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 ${
          checked ? "border-accent" : "border-muted-foreground/40"
        }`}
      >
        {checked && <span className="size-2 rounded-full bg-accent" />}
      </span>
      <span className="flex-1 leading-tight">
        <span className={`flex items-center justify-between gap-2 ${small ? "text-sm" : ""} font-medium`}>
          {title}
          {right && <span className="font-semibold">{right}</span>}
        </span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}

function LastMinuteEditor({
  rules,
  onChange,
}: {
  rules: LastMinuteRule[];
  onChange: (rules: LastMinuteRule[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>Last-Minute-Rabatte</Label>
      {rules.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Noch keine Last-Minute-Regeln.
        </p>
      )}
      {rules.map((r, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">ab</span>
          <NumInput
            value={r.days_before}
            onChange={(n) =>
              onChange(
                rules.map((x, idx) =>
                  idx === i ? { ...x, days_before: n ?? 1 } : x,
                ),
              )
            }
            className="w-20"
          />
          <span className="text-muted-foreground">Tagen</span>
          <NumInput
            value={r.discount_pct}
            onChange={(n) =>
              onChange(
                rules.map((x, idx) =>
                  idx === i ? { ...x, discount_pct: n ?? 0 } : x,
                ),
              )
            }
            className="w-20"
          />
          <span className="text-muted-foreground">% Rabatt</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Entfernen"
            onClick={() => onChange(rules.filter((_, idx) => idx !== i))}
          >
            <Icon icon="ph:trash" className="size-4 text-muted-foreground" />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="w-fit gap-1.5"
        onClick={() => onChange([...rules, { days_before: 5, discount_pct: 10 }])}
      >
        <Icon icon="ph:plus" className="size-4" /> Regel hinzufügen
      </Button>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  // mt-auto am Input: bei einzeiligen vs. zweizeiligen Labels in einem
  // 2-Spalten-Grid bleiben die Eingabefelder auf gleicher Höhe (Label oben,
  // Feld unten bündig). h-full lässt die Zelle die Grid-Zeilenhöhe füllen.
  return (
    <div className="flex h-full flex-col gap-1.5">
      <Label className="leading-tight">{label}</Label>
      <div className="mt-auto">{children}</div>
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

function fmt(value: number, currency: string): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}
