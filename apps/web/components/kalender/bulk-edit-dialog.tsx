"use client";

// Bulk-Edit (wie Hostaway): einen aufgezogenen Zeitraum über ein ODER mehrere
// Objekte in einem Rutsch bearbeiten — Preis/Tag, Min-Stay, Sperre, Stop-Sell.
// Rechter Slider im gleichen Muster wie der Reservierungs-Assistent. Nur gesetzte
// Felder werden gesendet (leer = unverändert).
import { Icon } from "@iconify/react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bulkEdit } from "@/lib/calendar";

type BlockMode = "none" | "block" | "unblock";
type StopMode = "none" | "stop" | "clear";
type RestrictMode = "none" | "on" | "off";

export function BulkEditDialog({
  open,
  rangeLabel,
  start,
  end,
  primaryProperty,
  allProperties,
  onClose,
  onApplied,
}: {
  open: boolean;
  rangeLabel: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD (exklusiv)
  primaryProperty: { id: string; title: string };
  allProperties: { id: string; title: string }[];
  onClose: () => void;
  onApplied: () => void;
}) {
  const [applyAll, setApplyAll] = useState(false);
  const [setPrice, setSetPrice] = useState(false);
  const [priceMode, setPriceMode] = useState<"fixed" | "pct">("fixed");
  const [price, setPrice2] = useState("");
  const [pricePct, setPricePct] = useState("");
  const [setMinStay, setSetMinStay] = useState(false);
  const [minStay, setMinStay2] = useState("");
  const [blockMode, setBlockMode] = useState<BlockMode>("none");
  const [stopMode, setStopMode] = useState<StopMode>("none");
  const [ctaMode, setCtaMode] = useState<RestrictMode>("none");
  const [ctdMode, setCtdMode] = useState<RestrictMode>("none");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const targetIds = applyAll
    ? allProperties.map((p) => p.id)
    : [primaryProperty.id];

  const priceFilled =
    setPrice && (priceMode === "fixed" ? price !== "" : pricePct !== "");
  const hasChange =
    priceFilled ||
    (setMinStay && minStay !== "") ||
    blockMode !== "none" ||
    stopMode !== "none" ||
    ctaMode !== "none" ||
    ctdMode !== "none";

  async function apply() {
    if (!hasChange) {
      toast.error("Mindestens eine Änderung wählen.");
      return;
    }
    setSaving(true);
    const res = await bulkEdit({
      property_ids: targetIds,
      start,
      end,
      ...(setPrice && priceMode === "fixed" && price !== ""
        ? { price: Number(price) }
        : {}),
      ...(setPrice && priceMode === "pct" && pricePct !== ""
        ? { price_adjust_pct: Number(pricePct) }
        : {}),
      ...(setMinStay && minStay !== "" ? { min_stay: Number(minStay) } : {}),
      ...(blockMode !== "none" ? { block: blockMode === "block" } : {}),
      ...(stopMode !== "none" ? { stop_sell: stopMode === "stop" } : {}),
      ...(ctaMode !== "none" ? { closed_to_arrival: ctaMode === "on" } : {}),
      ...(ctdMode !== "none" ? { closed_to_departure: ctdMode === "on" } : {}),
    });
    setSaving(false);
    if (res.ok) {
      toast.success(
        `Auf ${res.data.properties} Objekt(e) × ${res.data.days} Tag(e) angewendet.`,
      );
      onApplied();
      onClose();
    } else {
      toast.error(res.error || "Bulk-Bearbeitung fehlgeschlagen.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/40"
        role="presentation"
        onClick={onClose}
      />
      <div className="relative z-10 flex h-full w-full max-w-[26rem] flex-col bg-card shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h2 className="font-display text-xl font-extrabold">Mehrfach bearbeiten</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{rangeLabel}</p>
          </div>
          <Button variant="outline" size="icon" onClick={onClose} aria-label="Schließen">
            <Icon icon="ph:x" className="size-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-5">
            {/* Geltungsbereich */}
            <label className="flex items-center gap-2.5 text-sm">
              <Checkbox
                checked={applyAll}
                onCheckedChange={(v) => setApplyAll(v === true)}
              />
              <span>
                Auf alle Objekte anwenden{" "}
                <span className="text-muted-foreground">
                  ({applyAll ? allProperties.length : 1} ausgewählt)
                </span>
              </span>
            </label>
            {!applyAll && (
              <p className="-mt-3 text-xs text-muted-foreground">
                Objekt: {primaryProperty.title}
              </p>
            )}

            {/* Preis/Tag */}
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2.5 text-sm font-medium">
                <Checkbox
                  checked={setPrice}
                  onCheckedChange={(v) => setSetPrice(v === true)}
                />
                Preis pro Nacht setzen
              </label>
              {setPrice && (
                <div className="ml-7 flex flex-col gap-2">
                  <SegmentedThree
                    value={priceMode}
                    options={[
                      { value: "fixed", label: "Fester Preis" },
                      { value: "pct", label: "Prozentual" },
                    ]}
                    onChange={(v) => setPriceMode(v as "fixed" | "pct")}
                  />
                  {priceMode === "fixed" ? (
                    <div>
                      <Label htmlFor="bulk-price" className="sr-only">Preis</Label>
                      <Input
                        id="bulk-price"
                        type="number"
                        min={0}
                        inputMode="decimal"
                        placeholder="z. B. 120"
                        value={price}
                        onChange={(e) => setPrice2(e.target.value)}
                      />
                    </div>
                  ) : (
                    <div>
                      <Label htmlFor="bulk-price-pct" className="sr-only">
                        Prozentuale Anpassung
                      </Label>
                      <Input
                        id="bulk-price-pct"
                        type="number"
                        inputMode="decimal"
                        placeholder="z. B. +10 oder -15"
                        value={pricePct}
                        onChange={(e) => setPricePct(e.target.value)}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Passt den effektiven Tagespreis um diesen Prozentsatz an.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Min-Stay */}
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2.5 text-sm font-medium">
                <Checkbox
                  checked={setMinStay}
                  onCheckedChange={(v) => setSetMinStay(v === true)}
                />
                Mindestaufenthalt setzen
              </label>
              {setMinStay && (
                <div className="ml-7">
                  <Label htmlFor="bulk-minstay" className="sr-only">Min-Stay</Label>
                  <Input
                    id="bulk-minstay"
                    type="number"
                    min={1}
                    placeholder="Nächte, z. B. 2"
                    value={minStay}
                    onChange={(e) => setMinStay2(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Sperre */}
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">Verfügbarkeit</legend>
              <SegmentedThree
                value={blockMode}
                options={[
                  { value: "none", label: "Unverändert" },
                  { value: "block", label: "Sperren" },
                  { value: "unblock", label: "Entsperren" },
                ]}
                onChange={(v) => setBlockMode(v as BlockMode)}
              />
            </fieldset>

            {/* Verkaufsstopp */}
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">Verkaufsstopp (OTA)</legend>
              <SegmentedThree
                value={stopMode}
                options={[
                  { value: "none", label: "Unverändert" },
                  { value: "stop", label: "Stop" },
                  { value: "clear", label: "Aufheben" },
                ]}
                onChange={(v) => setStopMode(v as StopMode)}
              />
            </fieldset>

            {/* Anreise gesperrt (CTA) */}
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">Anreise gesperrt (CTA)</legend>
              <SegmentedThree
                value={ctaMode}
                options={[
                  { value: "none", label: "Unverändert" },
                  { value: "on", label: "An" },
                  { value: "off", label: "Aus" },
                ]}
                onChange={(v) => setCtaMode(v as RestrictMode)}
              />
            </fieldset>

            {/* Abreise gesperrt (CTD) */}
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">Abreise gesperrt (CTD)</legend>
              <SegmentedThree
                value={ctdMode}
                options={[
                  { value: "none", label: "Unverändert" },
                  { value: "on", label: "An" },
                  { value: "off", label: "Aus" },
                ]}
                onChange={(v) => setCtdMode(v as RestrictMode)}
              />
            </fieldset>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={apply} disabled={saving || !hasChange}>
            {saving ? "Anwenden…" : "Anwenden"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SegmentedThree({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
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
