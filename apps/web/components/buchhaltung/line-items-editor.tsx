"use client";

// Gemeinsamer Positions-Editor für Rechnung & Angebot: Zeilen-State inkl.
// Summen-Vorschau (final rechnet das Backend) + Positionszeilen-JSX.
// Eine Quelle statt Kopien pro Anlage-Button.
import { Icon } from "@iconify/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LineItemInput } from "@/lib/buchhaltung";
import { formatCurrency } from "@/lib/currency";

export type LineItemRow = {
  description: string;
  quantity: string;
  unit_price: string;
  tax_rate: string;
};

const EMPTY_ROW: LineItemRow = {
  description: "",
  quantity: "1",
  unit_price: "0",
  tax_rate: "19",
};

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
export function useLineItemRows() {
  const [rows, setRows] = useState<LineItemRow[]>([{ ...EMPTY_ROW }]);

  const setRow = (i: number, patch: Partial<LineItemRow>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((prev) => [...prev, { ...EMPTY_ROW }]);
  const removeRow = (i: number) =>
    setRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  const reset = () => setRows([{ ...EMPTY_ROW }]);

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
}: {
  rows: LineItemRow[];
  onRowChange: (i: number, patch: Partial<LineItemRow>) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r, i) => (
        <div
          key={i}
          className="flex flex-col gap-2 rounded-(--radius) border border-input p-3"
        >
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">
              Position {i + 1}
            </Label>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Position entfernen"
              >
                <Icon icon="ph:trash" className="size-4" />
              </button>
            )}
          </div>
          <Input
            placeholder="Beschreibung"
            value={r.description}
            onChange={(e) => onRowChange(i, { description: e.target.value })}
          />
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Menge</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={r.quantity}
                onChange={(e) => onRowChange(i, { quantity: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Einzelpreis €</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={r.unit_price}
                onChange={(e) => onRowChange(i, { unit_price: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">MwSt. %</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={r.tax_rate}
                onChange={(e) => onRowChange(i, { tax_rate: e.target.value })}
              />
            </div>
          </div>
          <p className="text-right text-xs text-muted-foreground">
            Netto: {formatEur(lineNet(r))}
          </p>
        </div>
      ))}
      <Button type="button" variant="outline" className="gap-2" onClick={onAdd}>
        <Icon icon="ph:plus" className="size-4" />
        Position hinzufügen
      </Button>
    </div>
  );
}
