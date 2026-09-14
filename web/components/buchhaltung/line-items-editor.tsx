"use client";

// Gemeinsamer Positions-Editor für Rechnung & Angebot: Zeilen-State inkl.
// Summen-Vorschau (final rechnet das Backend) + Positionszeilen-JSX.
// Eine Quelle statt Kopien pro Anlage-Button.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import type { LineItemInput } from "@/lib/buchhaltung";
import { currencySymbol, formatCurrency } from "@/lib/currency";
import { steuersatz } from "@/lib/steuer-waehrung";

export type LineItemRow = {
  description: string;
  quantity: string;
  unit_price: string;
  tax_rate: string;
};

// Leere Zeile OHNE Steuersatz: hier stand eine feste "19". Das ist eine
// steuerliche Behauptung ueber einen Betrieb, den diese Komponente gar nicht
// kennt — ein daenischer Angebotsposten waere still mit 19 statt 25 % in den
// Beleg gelaufen (Wurzel 4). Der Satz kommt jetzt vom Aufrufer aus den
// Stammdaten; fehlt er dort, bleibt das Feld leer und der Nutzer traegt ihn
// selbst ein, statt einen fremden Satz zu erben.
const EMPTY_ROW: LineItemRow = {
  description: "",
  quantity: "1",
  unit_price: "0",
  tax_rate: "",
};

// Leere Zeile mit dem Standardsatz des Betriebs, sofern bekannt. `steuersatz`
// liefert null, wenn nichts Gueltiges hinterlegt ist — dann bleibt es bei der
// leeren Vorbelegung. Die 0 eines steuerbefreiten Betriebs ist ein gueltiger
// Satz und wird als "0" uebernommen (deshalb `!== null`, nicht `||`).
function leereZeile(betriebsSatz: number | null): LineItemRow {
  return betriebsSatz !== null
    ? { ...EMPTY_ROW, tax_rate: String(betriebsSatz) }
    : { ...EMPTY_ROW };
}

// Netto einer Zeile (nur Vorschau).
export function lineNet(r: LineItemRow): number {
  return (Number(r.quantity) || 0) * (Number(r.unit_price) || 0);
}

// Betragsformat über die zentrale lib/currency.formatCurrency (Wurzel 4: kein
// eigener EUR-Formatter). Ohne Währung rendert sie symbollos statt ein falsches €
// zu erfinden; die Belegwährung wird durchgereicht, sobald der Flow sie kennt.
// Name bleibt formatEur (Aufrufer in new-invoice-/new-quote-button), Verhalten
// ist jetzt aber währungsneutral.
export function formatEur(n: number, currency?: string): string {
  return formatCurrency(n, currency);
}

// Zeilen-State: Mutatoren, Summen und Mapping auf LineItemInput fürs Backend.
// `standardSatz` ist der Steuersatz aus den Stammdaten des Betriebs (beliebige
// Quelle — Zahl, String aus der API, null). Er wird ueber `steuersatz` geprueft
// statt uebernommen, damit weder ein Unsinnswert noch ein erfundener Ersatz in
// die Positionen laeuft.
export function useLineItemRows(standardSatz?: unknown) {
  const betriebsSatz = steuersatz(standardSatz);
  const [rows, setRows] = useState<LineItemRow[]>(() => [leereZeile(betriebsSatz)]);

  // Die Stammdaten kommen asynchron: beim ersten Rendern ist `betriebsSatz`
  // noch null, die Startzeile also ohne Satz. Sobald er eintrifft, wird er in
  // noch unberuehrte Zeilen nachgetragen — nur in leere, damit eine bewusst
  // gesetzte 0 (Steuerbefreiung) oder ein abweichender Satz nicht ueberschrieben
  // wird.
  useEffect(() => {
    if (betriebsSatz === null) return;
    setRows((prev) =>
      prev.some((r) => r.tax_rate === "")
        ? prev.map((r) => (r.tax_rate === "" ? { ...r, tax_rate: String(betriebsSatz) } : r))
        : prev,
    );
  }, [betriebsSatz]);

  const setRow = (i: number, patch: Partial<LineItemRow>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((prev) => [...prev, leereZeile(betriebsSatz)]);
  const removeRow = (i: number) =>
    setRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  const reset = () => setRows([leereZeile(betriebsSatz)]);

  const netTotal = rows.reduce((sum, r) => sum + lineNet(r), 0);
  const taxTotal = rows.reduce(
    (sum, r) => sum + lineNet(r) * ((Number(r.tax_rate) || 0) / 100),
    0,
  );

  // Nur Zeilen mit Beschreibung; leere Zahlfelder als "0".
  const toLineItemInputs = (): LineItemInput[] =>
    rows
      .filter((r) => r.description.trim())
      .map((r) => ({
        description: r.description.trim(),
        quantity: r.quantity || "0",
        unit_price: r.unit_price || "0",
        tax_rate: r.tax_rate || "0",
      }));

  return { rows, setRow, addRow, removeRow, reset, netTotal, taxTotal, toLineItemInputs };
}

// Positionszeilen (Beschreibung, Menge, Einzelpreis, MwSt.) + „Hinzufügen".
export function LineItemsEditor({
  rows,
  onRowChange,
  onAdd,
  onRemove,
  currency,
}: {
  rows: LineItemRow[];
  onRowChange: (i: number, patch: Partial<LineItemRow>) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
  // Belegwährung fürs Feld-Label (Wurzel 4: kein hartes €). Fehlt sie, rendert
  // currencySymbol leer → Label bleibt „Einzelpreis" ohne erfundenes Symbol.
  currency?: string;
}) {
  const t = useTranslations("finance");
  const priceLabel = t("lineItemsEditor.unitPriceLabel", {
    symbol: currencySymbol(currency),
  }).trim();
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r, i) => (
        <div
          key={i}
          className="flex flex-col gap-2 rounded-(--radius) border border-input p-3"
        >
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">
              {t("lineItemsEditor.positionLabel", { number: i + 1 })}
            </Label>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="text-muted-foreground hover:text-destructive"
                aria-label={t("lineItemsEditor.removePosition")}
              >
                <Icon icon="ph:trash" className="size-4" />
              </button>
            )}
          </div>
          <Input
            placeholder={t("lineItemsEditor.descriptionPlaceholder")}
            value={r.description}
            onChange={(e) => onRowChange(i, { description: e.target.value })}
          />
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">
                {t("lineItemsEditor.quantityLabel")}
              </Label>
              <Input
                type="number"
                inputMode="decimal"
                value={r.quantity}
                onChange={(e) => onRowChange(i, { quantity: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">{priceLabel}</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={r.unit_price}
                onChange={(e) => onRowChange(i, { unit_price: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">
                {t("lineItemsEditor.taxRateLabel")}
              </Label>
              <Input
                type="number"
                inputMode="decimal"
                value={r.tax_rate}
                onChange={(e) => onRowChange(i, { tax_rate: e.target.value })}
              />
            </div>
          </div>
          <p className="text-right text-xs text-muted-foreground">
            {t("lineItemsEditor.netAmount", { amount: formatEur(lineNet(r)) })}
          </p>
        </div>
      ))}
      <Button type="button" variant="outline" className="gap-2" onClick={onAdd}>
        <Icon icon="ph:plus" className="size-4" />
        {t("lineItemsEditor.addPosition")}
      </Button>
    </div>
  );
}
