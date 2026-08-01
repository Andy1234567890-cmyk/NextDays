"use client";

// Bulk-Edit (wie Hostaway): einen aufgezogenen Zeitraum über ein ODER mehrere
// Objekte in einem Rutsch bearbeiten — Preis/Tag, Min-Stay, Sperre, Stop-Sell.
// Rechter Slider im gleichen Muster wie der Reservierungs-Assistent. Nur gesetzte
// Felder werden gesendet (leer = unverändert).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Checkbox } from "@nextdays/ui/checkbox";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { MultiSelect } from "@nextdays/ui/multi-select";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Segmented } from "@nextdays/ui/segmented";
import { isoPlus } from "@/lib/dates";
import {
  type RestrictionRow,
  bulkEdit,
  bulkRestrictions,
  bulkRestrictionsMulti,
} from "@/lib/calendar";

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
  // Hotel: Preispläne — erlaubt im Zeilen-Modus, jede Zeile einem Plan zuzuordnen
  // (Twin/BAR ≠ Double/B&B). Trägt ein Plan eine propertyId, gehört er zu einem
  // (ggf. anderen) Zimmer: die Zeilen gehen dann zimmerübergreifend als EIN
  // Portale-Call raus (Zert-Tests 3-8). Leer/undefined = Objekt-Ebene
  // (Ferienwohnung), dann gilt jede Zeile für alle Pläne.
  ratePlans?: { id: string; label: string; propertyId?: string }[];
  onClose: () => void;
  onApplied: () => void;
}) {
  // Modus: „simple" = ein Wert über die Objektauswahl (bestehend); „rows" =
  // mehrere heterogene Zeilen (versch. Zeiträume/Preise/Restriktionen) für DIESES
  // Objekt in EINEM Channex-Call (Zertifizierung Test 3-8).
  const t = useTranslations("calendar");
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
    const hasValue = (r: RestrictionRow) =>
      r.price != null ||
      r.min_stay != null ||
      r.max_stay != null ||
      r.closed_to_arrival != null ||
      r.closed_to_departure != null ||
      r.stop_sell != null;
    // Wertlose Zeilen NICHT still verschlucken (früher: Zeile fiel raus, der
    // Nutzer glaubte sie sei gesendet). Konkret die erste melden.
    const emptyIdx = rows.findIndex((r) => !hasValue(r));
    if (emptyIdx >= 0 && rows.length > 1) {
      toast.error(
        t("bulk.errRowEmpty", { row: emptyIdx + 1 }),
      );
      return;
    }
    const clean = rows.filter(hasValue);
    if (clean.length === 0) {
      toast.error(t("bulk.errNoRow"));
      return;
    }
    // Hotel: eine Zeile ohne Preisplan gilt objekt-weit und erscheint NICHT
    // plan-genau im Rate-Grid — im Hotel-Fall bewusst blockieren, damit keine
    // Restriktion „unsichtbar" wird (der wiederkehrende „4 gesetzt, 3 sichtbar").
    if ((ratePlans?.length ?? 0) > 0) {
      const noPlan = clean.findIndex((r) => !r.rate_plan_id);
      if (noPlan >= 0) {
        toast.error(
          t("bulk.errNoPlan", { row: noPlan + 1 }),
        );
        return;
      }
    }
    // r.end ist INTERN exklusiv; das UI-Feld ist inklusiv (letzter Tag). Ungültig
    // ist eine Zeile nur, wenn „Bis (einschl.)" VOR „Von" liegt (dann r.end<=start).
    // Vor dem Senden klar melden statt serverseitigem 422.
    const badRange = clean.findIndex((r) => !r.start || !r.end || r.end <= r.start);
    if (badRange >= 0) {
      toast.error(
        t("bulk.errBadRange", { row: badRange + 1 }),
      );
      return;
    }
    setSaving(true);
    // Zimmer-übergreifend (Hotel): Pläne tragen ihre propertyId → jede Zeile dem
    // Zimmer ihres Plans zuordnen und alles als EINEN gebündelten Portale-Call
    // senden. Ohne propertyId (FeWo/Objekt-Ebene) bleibt der Objekt-Pfad.
    const planProperty = new Map(
      (ratePlans ?? [])
        .filter((p) => p.propertyId)
        .map((p) => [p.id, p.propertyId as string]),
    );
    const res = planProperty.size > 0
      ? await bulkRestrictionsMulti(
          clean.map((r) => ({
            ...r,
            property_id:
              (r.rate_plan_id && planProperty.get(r.rate_plan_id)) ||
              primaryProperty.id,
          })),
        )
      : await bulkRestrictions(primaryProperty.id, clean);
    setSaving(false);
    if (res.ok) {
      toast.success(t("bulk.rowsSent", { rows: res.data.rows }));
      onApplied();
      onClose();
    } else {
      toast.error(res.error || t("bulk.errSendFailed"));
    }
  }

  async function apply() {
    if (targetIds.length === 0) {
      toast.error(t("bulk.errNoProperty"));
      return;
    }
    if (!hasChange) {
      toast.error(t("bulk.errNoChange"));
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
        t("bulk.applied", { properties: res.data.properties, days: res.data.days }),
      );
      onApplied();
      onClose();
    } else {
      toast.error(res.error || t("bulk.errBulkFailed"));
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
            <h2 className="font-display text-xl font-extrabold">{t("bulk.title")}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{rangeLabel}</p>
          </div>
          <Button variant="outline" size="icon" onClick={onClose} aria-label={t("bulk.close")}>
            <Icon icon="ph:x" className="size-4" />
          </Button>
        </div>

        {/* Modus: ein Wert über mehrere Objekte, ODER mehrere Zeitraum-Zeilen mit
            eigenen Werten für DIESES Objekt (alles in EINEM Portale-Call). */}
        <div className="border-b px-5 py-3">
          <Segmented
            value={mode}
            options={[
              { value: "simple", label: t("bulk.modeSimple") },
              { value: "rows", label: t("bulk.modeRows") },
            ]}
            onChange={(v) => setMode(v as DialogMode)}
          />
        </div>

        {mode === "rows" ? (
          <RowsEditor
            propertyTitle={primaryProperty.title}
            t={t}
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
                <Label className="text-sm font-medium">{t("bulk.properties")}</Label>
                <button
                  type="button"
                  className="text-xs text-accent hover:underline"
                  onClick={() => setSelectedIds(allProperties.map((p) => p.id))}
                >
                  {t("bulk.selectAll")}
                </button>
              </div>
              <MultiSelect
                options={allProperties.map((p) => ({ value: p.id, label: p.title }))}
                selected={selectedIds}
                onChange={setSelectedIds}
                placeholder={t("bulk.selectPlaceholder")}
                searchPlaceholder={t("bulk.searchPlaceholder")}
                allLabel={t("bulk.clear")}
              />
              <p className="text-xs text-muted-foreground">
                {t("bulk.selectedCount", { count: selectedIds.length })}
              </p>
            </div>

            {/* Preis/Tag */}
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2.5 text-sm font-medium">
                <Checkbox
                  checked={setPrice}
                  onCheckedChange={(v) => setSetPrice(v === true)}
                />
                {t("bulk.setPrice")}
              </label>
              {setPrice && (
                <div className="ml-7 flex flex-col gap-2">
                  <Segmented
                    value={priceMode}
                    options={[
                      { value: "fixed", label: t("bulk.priceFixed") },
                      { value: "pct", label: t("bulk.pricePercent") },
                    ]}
                    onChange={(v) => setPriceMode(v as "fixed" | "pct")}
                  />
                  {priceMode === "fixed" ? (
                    <div>
                      <Label htmlFor="bulk-price" className="sr-only">{t("bulk.price")}</Label>
                      <Input
                        id="bulk-price"
                        type="number"
                        min={0}
                        inputMode="decimal"
                        placeholder={t("bulk.pricePlaceholder")}
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
                        placeholder={t("bulk.pricePctPlaceholder")}
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
                {t("bulk.setMinStay")}
              </label>
              {setMinStay && (
                <div className="ml-7">
                  <Label htmlFor="bulk-minstay" className="sr-only">{t("bulk.minStay")}</Label>
                  <Input
                    id="bulk-minstay"
                    type="number"
                    min={1}
                    placeholder={t("bulk.minStayPlaceholder")}
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
                {t("bulk.setMaxStay")}
              </label>
              {setMaxStay && (
                <div className="ml-7">
                  <Label htmlFor="bulk-maxstay" className="sr-only">{t("bulk.maxStay")}</Label>
                  <Input
                    id="bulk-maxstay"
                    type="number"
                    min={0}
                    placeholder={t("bulk.maxStayPlaceholder")}
                    value={maxStay}
                    onChange={(e) => setMaxStay2(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Sperre */}
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">{t("bulk.availability")}</legend>
              <Segmented
                value={blockMode}
                options={[
                  { value: "none", label: t("bulk.unchanged") },
                  { value: "block", label: t("bulk.block") },
                  { value: "unblock", label: t("bulk.unblock") },
                ]}
                onChange={(v) => setBlockMode(v as BlockMode)}
              />
            </fieldset>

            {/* Stop-Sell */}
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">{t("bulk.stopSell")}</legend>
              <Segmented
                value={stopMode}
                options={[
                  { value: "none", label: t("bulk.unchanged") },
                  { value: "stop", label: t("bulk.stop") },
                  { value: "clear", label: t("bulk.clearStop") },
                ]}
                onChange={(v) => setStopMode(v as StopMode)}
              />
            </fieldset>

            {/* Anreise gesperrt (CTA) */}
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">{t("bulk.cta")}</legend>
              <Segmented
                value={ctaMode}
                options={[
                  { value: "none", label: t("bulk.unchanged") },
                  { value: "on", label: t("bulk.on") },
                  { value: "off", label: t("bulk.off") },
                ]}
                onChange={(v) => setCtaMode(v as RestrictMode)}
              />
            </fieldset>

            {/* Abreise gesperrt (CTD) */}
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">{t("bulk.ctd")}</legend>
              <Segmented
                value={ctdMode}
                options={[
                  { value: "none", label: t("bulk.unchanged") },
                  { value: "on", label: t("bulk.on") },
                  { value: "off", label: t("bulk.off") },
                ]}
                onChange={(v) => setCtdMode(v as RestrictMode)}
              />
            </fieldset>
          </div>
        </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t("bulk.cancel")}
          </Button>
          {mode === "rows" ? (
            <Button onClick={applyRows} disabled={saving}>
              {saving ? t("bulk.sending") : t("bulk.sendToPortals")}
            </Button>
          ) : (
            <Button onClick={apply} disabled={saving || !hasChange}>
              {saving ? t("bulk.applying") : t("bulk.apply")}
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
  t,
  propertyTitle,
  ratePlans,
  rows,
  setRows,
}: {
  t: ReturnType<typeof useTranslations>;
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
    // KEIN Plan-Übernehmen: jeder Plan darf nur einer Zeile gehören (siehe
    // usedElsewhere), ein kopierter Plan wäre sofort „belegt".
    setRows([...rows, { start: last.start, end: last.end }]);
  }
  // Ein Plan, der schon in einer ANDEREN Zeile gewählt ist, wird in dieser Zeile
  // ausgegraut — verhindert, dass zwei Zeilen denselben Plan treffen (die
  // wiederkehrende Verwechslungsquelle bei den Zert-Tests). „Alle Preispläne"
  // (Objekt-Ebene) bleibt immer wählbar.
  const usedElsewhere = (rowIndex: number, planId: string): boolean =>
    rows.some((r, idx) => idx !== rowIndex && r.rate_plan_id === planId);
  function removeRow(i: number) {
    setRows(rows.filter((_, idx) => idx !== i));
  }
  // Optional-Boolean als 3-Wege (unverändert/an/aus) auf ein Segmented mappen.
  const triState = (v: boolean | undefined): "none" | "on" | "off" =>
    v == null ? "none" : v ? "on" : "off";
  const fromTri = (s: string): boolean | undefined =>
    s === "none" ? undefined : s === "on";
  // Zeitraum in WORTEN (mit Monatsnamen) + Nächte — macht einen falschen Monat
  // sofort sichtbar (die Datumsfelder allein verstecken den Monat beim Tippen).
  const fmt = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const spellRange = (start: string, end: string): string | null => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      return null;
    }
    const s = new Date(`${start}T00:00:00Z`);
    const e = new Date(`${end}T00:00:00Z`);
    const nights = Math.round((e.getTime() - s.getTime()) / 86_400_000);
    if (nights < 1) return null;
    const lastNight = new Date(e.getTime() - 86_400_000); // Bis exklusiv
    return t("bulk.nightsRange", {
      from: fmt.format(s),
      to: fmt.format(lastNight),
      nights,
    });
  };

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
      <p className="text-xs text-muted-foreground">
        {t("bulk.rowsIntro", { title: propertyTitle })}
      </p>
      {rows.map((r, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-(--radius) border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-col">
              <span className="text-xs font-medium text-muted-foreground">
                {t("bulk.rangeIndex", { index: i + 1 })}
              </span>
              {/* Monat in Worten — der Anker gegen den „November-wird-Oktober"-Fehler. */}
              {spellRange(r.start, r.end) ? (
                <span className="truncate text-xs font-medium text-foreground">
                  {spellRange(r.start, r.end)}
                </span>
              ) : (
                <span className="text-xs text-destructive">
                  {t("bulk.rangeIncomplete")}
                </span>
              )}
            </div>
            {rows.length > 1 && (
              <button
                type="button"
                aria-label={t("bulk.removeRow")}
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeRow(i)}
              >
                <Icon icon="ph:trash" className="size-4" />
              </button>
            )}
          </div>
          {hasPlans && (
            <div className="flex flex-col gap-1">
              <Label className="text-xs">{t("bulk.ratePlan")}</Label>
              <NativeSelect
                value={r.rate_plan_id ?? ""}
                onChange={(e) =>
                  patch(i, { rate_plan_id: e.target.value || undefined })
                }
              >
                <option value="">{t("bulk.allRatePlans")}</option>
                {(ratePlans ?? []).map((p) => {
                  const taken = usedElsewhere(i, p.id);
                  return (
                    <option key={p.id} value={p.id} disabled={taken}>
                      {p.label}
                      {taken ? " (bereits gewählt)" : ""}
                    </option>
                  );
                })}
              </NativeSelect>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">{t("bulk.from")}</Label>
              <Input
                type="date"
                value={r.start}
                onChange={(e) => patch(i, { start: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              {/* INKLUSIVES Enddatum: der Nutzer sieht/tippt den LETZTEN Tag
                  (so wie man „bis einschließlich" denkt), intern wird +1 Tag als
                  exklusives `end` gespeichert. Das schließt den Off-by-one-Fehler
                  („bis 01.05." vergisst den 01.05.) an der Wurzel aus. */}
              <Label className="text-xs">{t("bulk.to")}</Label>
              <Input
                type="date"
                value={r.end ? isoPlus(r.end, -1) : ""}
                onChange={(e) =>
                  patch(i, {
                    end: e.target.value ? isoPlus(e.target.value, 1) : "",
                  })
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">{t("bulk.price")}</Label>
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
              <Label className="text-xs">{t("bulk.minStay")}</Label>
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
              <Label className="text-xs">{t("bulk.maxStay")}</Label>
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
              <Label className="text-xs">{t("bulk.ctaShort")}</Label>
              <Segmented
                value={triState(r.closed_to_arrival)}
                options={[
                  { value: "none", label: "—" },
                  { value: "on", label: t("bulk.on") },
                  { value: "off", label: t("bulk.off") },
                ]}
                onChange={(v) => patch(i, { closed_to_arrival: fromTri(v) })}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">{t("bulk.ctdShort")}</Label>
              <Segmented
                value={triState(r.closed_to_departure)}
                options={[
                  { value: "none", label: "—" },
                  { value: "on", label: t("bulk.on") },
                  { value: "off", label: t("bulk.off") },
                ]}
                onChange={(v) => patch(i, { closed_to_departure: fromTri(v) })}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">{t("bulk.stopShort")}</Label>
              <Segmented
                value={triState(r.stop_sell)}
                options={[
                  { value: "none", label: "—" },
                  { value: "on", label: t("bulk.on") },
                  { value: "off", label: t("bulk.off") },
                ]}
                onChange={(v) => patch(i, { stop_sell: fromTri(v) })}
              />
            </div>
          </div>
        </div>
      ))}
      <Button variant="outline" onClick={addRow} className="gap-2">
        <Icon icon="ph:plus" className="size-4" />
        {t("bulk.addRange")}
      </Button>
    </div>
  );
}
