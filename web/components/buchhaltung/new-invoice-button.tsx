"use client";

// „Neue Rechnung"-Button + Anlage-Sheet. Positionen dynamisch (hinzufügen/
// entfernen), Live-Summe, optionaler Kunde. Beträge final berechnet das Backend;
// die Vorschau hier dient nur der Orientierung. NextDays-Design (rounded-full,
// rem, Tokens).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nextdays/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@nextdays/ui/sheet";
import {
  formatEur,
  LineItemsEditor,
  useLineItemRows,
} from "@/components/buchhaltung/line-items-editor";
import { createInvoice, type Customer } from "@/lib/buchhaltung";

const NO_CUSTOMER = "__none__";

export function NewInvoiceButton({
  customers = [],
}: {
  customers?: Customer[];
}) {
  const t = useTranslations("finance");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const {
    rows,
    setRow,
    addRow,
    removeRow,
    reset: resetRows,
    netTotal,
    taxTotal,
    toLineItemInputs,
  } = useLineItemRows();
  const [customerId, setCustomerId] = useState<string>(NO_CUSTOMER);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grossTotal = netTotal + taxTotal;

  const reset = () => {
    resetRows();
    setCustomerId(NO_CUSTOMER);
    setNotes("");
    setError(null);
  };

  async function save() {
    const items = toLineItemInputs();
    if (items.length === 0) {
      setError(t("newInvoiceButton.itemRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    const res = await createInvoice({
      items,
      notes: notes || null,
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
        {t("newInvoiceButton.trigger")}
      </Button>

      <Sheet
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
          <SheetHeader className="border-b">
            <SheetTitle className="font-display text-lg font-extrabold">
              {t("newInvoiceButton.sheetTitle")}
            </SheetTitle>
            <SheetDescription>
              {t("newInvoiceButton.sheetDescription")}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            {/* Kunde */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv-customer">{t("newInvoiceButton.customerLabel")}</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger id="inv-customer">
                  <SelectValue placeholder={t("newInvoiceButton.customerNone")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CUSTOMER}>{t("newInvoiceButton.customerNone")}</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Positionen */}
            <LineItemsEditor
              rows={rows}
              onRowChange={setRow}
              onAdd={addRow}
              onRemove={removeRow}
            />

            {/* Notizen */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv-notes">{t("newInvoiceButton.notesLabel")}</Label>
              <Input
                id="inv-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("newInvoiceButton.notesPlaceholder")}
              />
            </div>

            {/* Summen-Vorschau */}
            <div className="flex flex-col gap-1 rounded-(--radius) bg-secondary/40 p-3 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>{t("newInvoiceButton.netTotal")}</span>
                <span>{formatEur(netTotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>{t("newInvoiceButton.taxTotal")}</span>
                <span>{formatEur(taxTotal)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>{t("newInvoiceButton.grossTotal")}</span>
                <span>{formatEur(grossTotal)}</span>
              </div>
            </div>

            {error && (
              <p className="rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
          </div>

          <SheetFooter className="flex-row gap-2 border-t">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              {t("newInvoiceButton.cancel")}
            </Button>
            <Button type="button" className="flex-1" disabled={busy} onClick={save}>
              {busy ? t("newInvoiceButton.submitting") : t("newInvoiceButton.submit")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
