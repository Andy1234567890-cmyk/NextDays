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
import { MultiSelect } from "@/components/ui/multi-select";
import { NativeSelect } from "@/components/ui/native-select";
import { Segmented } from "@/components/ui/segmented";
import { type RestrictionRow, bulkEdit, bulkRestrictions } from "@/lib/calendar";

type BlockMode = "none" | "block" | "unblock";
type StopMode = "none" | "stop" | "clear";
type RestrictMode = "none" | "on" | "off";
type DialogMode = "simple" | "rows";

export function BulkEditDialog({
  open,
  rangeLabel,
  start,
  end,
  primaryProperty,
  allProperties,
  ratePlans,
  onClose,
  onApplied,
}: {
  open: boolean;
  rangeLabel: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD (exklusiv)
  primaryProperty: { id: string; title: string };
  allProperties: { id: string; title: string }[];
  // Hotel: Preispläne des primären Objekts — erlaubt im Zeilen-Modus, jede Zeile
  // einem Plan zuzuordnen (Twin/BAR ≠ Double/B&B). Leer/undefined = Objekt-Ebene
  // (Ferienwohnung), dann gilt jede Zeile für alle Pläne.
  ratePlans?: { id: string; label: string }[];
  onClose: () => void;
  onApplied: () => void;
}) {
  // Modus: „simple" = ein Wert über die Objektauswahl (bestehend); „rows" =
  // mehrere heterogene Zeilen (versch. Zeiträume/Preise/Restriktionen) für DIESES
  // Objekt in EINEM Channex-Call (Zertifizierung Test 3-8).
  const [mode, setMode] = useState<DialogMode>("simple");
  const [rows, setRows] = useState<RestrictionRow[]>([
    { start, end, price: undefined },
  ]);
  // Objektauswahl: primäres Objekt ist vorausgewählt; der Nutzer kann gezielt
  // weitere Objekte dazunehmen oder abwählen (Mehrfachauswahl statt „alle/eins").
  const [selectedIds, setSelectedIds] = useState<string[]>([primaryProperty.id]);
  const [setPrice, setSetPrice] = useState(false);
  const [priceMode, setPriceMode] = useState<"fixed" | "pct">("fixed");
  const [price, setPrice2] = useState("");
  const [pricePct, setPricePct] = useState("");
  const [setMinStay, setSetMinStay] = useState(false);
  const [minStay, setMinStay2] = useState("");
  const [setMaxStay, setSetMaxStay] = useState(false);
  const [maxStay, setMaxStay2] = useState("");
  const [blockMode, setBlockMode] = useState<BlockMode>("none");
  const [stopMode, setStopMode] = useState<StopMode>("none");
  const [ctaMode, setCtaMode] = useState<RestrictMode>("none");
  const [ctdMode, setCtdMode] = useState<RestrictMode>("none");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const targetIds = selectedIds;

  const priceFilled =
    setPrice && (priceMode === "fixed" ? price !== "" : pricePct !== "");
  const hasChange =
    priceFilled ||
    (setMinStay && minStay !== "") ||
    (setMaxStay && maxStay !== "") ||
    blockMode !== "none" ||
    stopMode !== "none" ||
    ctaMode !== "none" ||
    ctdMode !== "none";

  // Zeilen-Modus: mehrere Zeiträume mit eigenen Werten in EINEM Portale-Call.
  async function applyRows() {
    const clean = rows.filter(
      (r) =>
        r.price != null ||
        r.min_stay != null ||
        r.max_stay != null ||
        r.closed_to_arrival != null ||
        r.closed_to_departure != null ||
        r.stop_sell != null,
    );
    if (clean.length === 0) {
      toast.error("Mindestens eine Zeile mit einem Wert.");
      return;
    }
    setSaving(true);
    const res = await bulkRestrictions(primaryProperty.id, clean);
    setSaving(false);
    if (res.ok) {
      toast.success(`${res.data.rows} Zeile(n) an die Portale gesendet.`);
      onApplied();
      onClose();
    } else {
      toast.error(res.error || "Senden fehlgeschlagen.");
    }
  }

  async function apply() {
    if (targetIds.length === 0) {
      toast.error("Mindestens ein Objekt wählen.");
      return;
    }
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
      ...(setMaxStay && maxStay !== "" ? { max_stay: Number(maxStay) } : {}),
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

        {/* Modus: ein Wert über mehrere Objekte, ODER mehrere Zeitraum-Zeilen mit
            eigenen Werten für DIESES Objekt (alles in EINEM Portale-Call). */}
        <div className="border-b px-5 py-3">
          <Segmented
            value={mode}
            options={[
              { value: "simple", label: "Ein Wert" },
              { value: "rows", label: "Mehrere Zeiträume" },
            ]}
            onChange={(v) => setMode(v as DialogMode)}
          />
        </div>

        {mode === "rows" ? (
          <RowsEditor
            propertyTitle={primaryProperty.title}
            ratePlans={ratePlans}
            rows={rows}
            setRows={setRows}
          />
        ) : (
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-5">
            {/* Geltungsbereich: welche Objekte bearbeitet werden (Mehrfachauswahl,
                primäres Objekt vorausgewählt). Leere Auswahl ist NICHT „alle" —
                der Aufrufer verlangt mindestens ein Objekt (Scope-Sicherheit). */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Objekte</Label>
                <button
                  type="button"
                  className="text-xs text-accent hover:underline"
                  onClick={() => setSelectedIds(allProperties.map((p) => p.id))}
                >
                  Alle auswählen
                </button>
              </div>
              <MultiSelect
                options={allProperties.map((p) => ({ value: p.id, label: p.title }))}
                selected={selectedIds}
                onChange={setSelectedIds}
                placeholder="Objekte wählen …"
                searchPlaceholder="Objekt suchen …"
                allLabel="Leeren"
              />
              <p className="text-xs text-muted-foreground">
                {selectedIds.length} Objekt(e) ausgewählt
              </p>
            </div>

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
                  <Segmented
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

            {/* Max-Stay */}
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2.5 text-sm font-medium">
                <Checkbox
                  checked={setMaxStay}
                  onCheckedChange={(v) => setSetMaxStay(v === true)}
                />
                Maximalaufenthalt setzen
              </label>
              {setMaxStay && (
                <div className="ml-7">
                  <Label htmlFor="bulk-maxstay" className="sr-only">Max-Stay</Label>
                  <Input
                    id="bulk-maxstay"
                    type="number"
                    min={0}
                    placeholder="Nächte, z. B. 14 (0 = keine Obergrenze)"
                    value={maxStay}
                    onChange={(e) => setMaxStay2(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Sperre */}
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">Verfügbarkeit</legend>
              <Segmented
                value={blockMode}
                options={[
                  { value: "none", label: "Unverändert" },
                  { value: "block", label: "Sperren" },
                  { value: "unblock", label: "Entsperren" },
                ]}
                onChange={(v) => setBlockMode(v as BlockMode)}
              />
            </fieldset>

            {/* Stop-Sell */}
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">Stop-Sell (OTA)</legend>
              <Segmented
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
              <Segmented
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
              <Segmented
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
        )}

        <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Abbrechen
          </Button>
          {mode === "rows" ? (
            <Button onClick={applyRows} disabled={saving}>
              {saving ? "Senden…" : "An Portale senden"}
            </Button>
          ) : (
            <Button onClick={apply} disabled={saving || !hasChange}>
              {saving ? "Anwenden…" : "Anwenden"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Mehrere Zeitraum-Zeilen mit eigenen Werten (Preis/min/max/CTA/CTD/Stop-Sell) —
// alles in EINEM Portale-Call. Für Häuser mit vielen Zimmern/Saisons (Hotel-Fall).
function RowsEditor({
  propertyTitle,
  ratePlans,
  rows,
  setRows,
}: {
  propertyTitle: string;
  ratePlans?: { id: string; label: string }[];
  rows: RestrictionRow[];
  setRows: (r: RestrictionRow[]) => void;
}) {
  const hasPlans = (ratePlans?.length ?? 0) > 0;
  function patch(i: number, next: Partial<RestrictionRow>) {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...next } : r)));
  }
  function addRow() {
    const last = rows[rows.length - 1];
    // Den Plan der letzten Zeile übernehmen — beim Aufbau mehrerer Zeilen für
    // dieselbe Kategorie spart das die erneute Auswahl.
    setRows([...rows, { start: last.start, end: last.end,
      ...(last.rate_plan_id ? { rate_plan_id: last.rate_plan_id } : {}) }]);
  }
  function removeRow(i: number) {
    setRows(rows.filter((_, idx) => idx !== i));
  }
  // Optional-Boolean als 3-Wege (unverändert/an/aus) auf ein Segmented mappen.
  const triState = (v: boolean | undefined): "none" | "on" | "off" =>
    v == null ? "none" : v ? "on" : "off";
  const fromTri = (s: string): boolean | undefined =>
    s === "none" ? undefined : s === "on";

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
      <p className="text-xs text-muted-foreground">
        Objekt: {propertyTitle}. Mehrere Zeiträume mit eigenen Werten — alles
        zusammen in einem Zug an alle Buchungsportale.
      </p>
      {rows.map((r, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-(--radius) border border-border p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Zeitraum {i + 1}
            </span>
            {rows.length > 1 && (
              <button
                type="button"
                aria-label="Zeile entfernen"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => removeRow(i)}
              >
                <Icon icon="ph:trash" className="size-4" />
              </button>
            )}
          </div>
          {hasPlans && (
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Zimmerkategorie / Preisplan</Label>
              <NativeSelect
                value={r.rate_plan_id ?? ""}
                onChange={(e) =>
                  patch(i, { rate_plan_id: e.target.value || undefined })
                }
              >
                <option value="">Alle Preispläne</option>
                {ratePlans?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Von</Label>
              <Input
                type="date"
                value={r.start}
                onChange={(e) => patch(i, { start: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Bis (exkl.)</Label>
              <Input
                type="date"
                value={r.end}
                onChange={(e) => patch(i, { end: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Preis</Label>
              <Input
                type="number"
                min={0}
                placeholder="—"
                value={r.price ?? ""}
                onChange={(e) =>
                  patch(i, {
                    price: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Min-Stay</Label>
              <Input
                type="number"
                min={1}
                placeholder="—"
                value={r.min_stay ?? ""}
                onChange={(e) =>
                  patch(i, {
                    min_stay:
                      e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Max-Stay</Label>
              <Input
                type="number"
                min={0}
                placeholder="—"
                value={r.max_stay ?? ""}
                onChange={(e) =>
                  patch(i, {
                    max_stay:
                      e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Anreise gesperrt</Label>
              <Segmented
                value={triState(r.closed_to_arrival)}
                options={[
                  { value: "none", label: "—" },
                  { value: "on", label: "An" },
                  { value: "off", label: "Aus" },
                ]}
                onChange={(v) => patch(i, { closed_to_arrival: fromTri(v) })}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Abreise gesperrt</Label>
              <Segmented
                value={triState(r.closed_to_departure)}
                options={[
                  { value: "none", label: "—" },
                  { value: "on", label: "An" },
                  { value: "off", label: "Aus" },
                ]}
                onChange={(v) => patch(i, { closed_to_departure: fromTri(v) })}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Verkaufsstopp</Label>
              <Segmented
                value={triState(r.stop_sell)}
                options={[
                  { value: "none", label: "—" },
                  { value: "on", label: "An" },
                  { value: "off", label: "Aus" },
                ]}
                onChange={(v) => patch(i, { stop_sell: fromTri(v) })}
              />
            </div>
          </div>
        </div>
      ))}
      <Button variant="outline" onClick={addRow} className="gap-2">
        <Icon icon="ph:plus" className="size-4" />
        Zeitraum hinzufügen
      </Button>
    </div>
  );
}
