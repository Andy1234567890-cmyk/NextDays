"use client";

// „Neues Angebot"-Button + Anlage-Sheet (Buchhaltung → Angebote). Positionen
// dynamisch, Live-Summe, optionaler Kunde + Gültig-bis. NextDays-Design.
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  createQuote,
  type Customer,
  type LineItemInput,
} from "@/lib/buchhaltung";

const NO_CUSTOMER = "__none__";

type Row = { description: string; quantity: string; unit_price: string; tax_rate: string };
const EMPTY_ROW: Row = { description: "", quantity: "1", unit_price: "0", tax_rate: "19" };

const lineNet = (r: Row) => (Number(r.quantity) || 0) * (Number(r.unit_price) || 0);
const formatEur = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

export function NewQuoteButton({ customers = [] }: { customers?: Customer[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([{ ...EMPTY_ROW }]);
  const [customerId, setCustomerId] = useState(NO_CUSTOMER);
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const netTotal = rows.reduce((s, r) => s + lineNet(r), 0);
  const taxTotal = rows.reduce(
    (s, r) => s + lineNet(r) * ((Number(r.tax_rate) || 0) / 100),
    0,
  );

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((p) => p.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((p) => [...p, { ...EMPTY_ROW }]);
  const removeRow = (i: number) =>
    setRows((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p));

  const reset = () => {
    setRows([{ ...EMPTY_ROW }]);
    setCustomerId(NO_CUSTOMER);
    setValidUntil("");
    setNotes("");
    setError(null);
  };

  async function save() {
    const items: LineItemInput[] = rows
      .filter((r) => r.description.trim())
      .map((r) => ({
        description: r.description.trim(),
        quantity: r.quantity || "0",
        unit_price: r.unit_price || "0",
        tax_rate: r.tax_rate || "0",
      }));
    if (items.length === 0) {
      setError("Mindestens eine Position mit Beschreibung ist erforderlich.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await createQuote({
      items,
      notes: notes || null,
      valid_until: validUntil || null,
      customer_id: customerId === NO_CUSTOMER ? null : customerId,
    });
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      reset();
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2">
        <Icon icon="ph:plus" className="size-4" />
        Neues Angebot
      </Button>

      <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
          <SheetHeader className="border-b">
            <SheetTitle className="font-display text-lg font-extrabold">
              Neues Angebot
            </SheetTitle>
            <SheetDescription>
              Erfasse die Positionen. Steuer und Summen berechnet das Backend.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="q-customer">Kunde</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger id="q-customer">
                    <SelectValue placeholder="Kein Kunde" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CUSTOMER}>Kein Kunde</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="q-valid">Gültig bis</Label>
                <Input
                  id="q-valid"
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {rows.map((r, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-(--radius) border border-input p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Position {i + 1}</Label>
                    {rows.length > 1 && (
                      <button type="button" onClick={() => removeRow(i)} className="text-muted-foreground hover:text-destructive" aria-label="Position entfernen">
                        <Icon icon="ph:trash" className="size-4" />
                      </button>
                    )}
                  </div>
                  <Input placeholder="Beschreibung" value={r.description} onChange={(e) => setRow(i, { description: e.target.value })} />
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs text-muted-foreground">Menge</Label>
                      <Input type="number" inputMode="decimal" value={r.quantity} onChange={(e) => setRow(i, { quantity: e.target.value })} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs text-muted-foreground">Einzelpreis €</Label>
                      <Input type="number" inputMode="decimal" value={r.unit_price} onChange={(e) => setRow(i, { unit_price: e.target.value })} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs text-muted-foreground">MwSt. %</Label>
                      <Input type="number" inputMode="decimal" value={r.tax_rate} onChange={(e) => setRow(i, { tax_rate: e.target.value })} />
                    </div>
                  </div>
                  <p className="text-right text-xs text-muted-foreground">Netto: {formatEur(lineNet(r))}</p>
                </div>
              ))}
              <Button type="button" variant="outline" className="gap-2" onClick={addRow}>
                <Icon icon="ph:plus" className="size-4" />
                Position hinzufügen
              </Button>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="q-notes">Anmerkungen</Label>
              <Input id="q-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
            </div>

            <div className="flex flex-col gap-1 rounded-(--radius) bg-secondary/40 p-3 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Netto</span><span>{formatEur(netTotal)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>MwSt.</span><span>{formatEur(taxTotal)}</span></div>
              <div className="flex justify-between font-semibold"><span>Gesamt</span><span>{formatEur(netTotal + taxTotal)}</span></div>
            </div>

            {error && (
              <p className="rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
            )}
          </div>

          <SheetFooter className="flex-row gap-2 border-t">
            <Button type="button" variant="outline" className="flex-1" disabled={busy} onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button type="button" className="flex-1" disabled={busy} onClick={save}>
              {busy ? "Wird erstellt…" : "Angebot erstellen"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
