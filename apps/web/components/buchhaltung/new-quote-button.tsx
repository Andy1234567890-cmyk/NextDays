"use client";

// „Neues Angebot"-Button + Anlage-Sheet (Buchhaltung → Angebote). Positionen
// dynamisch, Live-Summe, optionaler Kunde + Gültig-bis. NextDays-Design.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
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
  formatEur,
  LineItemsEditor,
  useLineItemRows,
} from "@/components/buchhaltung/line-items-editor";
import { createQuote, type Customer } from "@/lib/buchhaltung";

const NO_CUSTOMER = "__none__";

export function NewQuoteButton({ customers = [] }: { customers?: Customer[] }) {
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
  const [customerId, setCustomerId] = useState(NO_CUSTOMER);
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    resetRows();
    setCustomerId(NO_CUSTOMER);
    setValidUntil("");
    setNotes("");
    setError(null);
  };

  async function save() {
    const items = toLineItemInputs();
    if (items.length === 0) {
      setError(t("newQuoteButton.errorMinItems"));
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
        {t("newQuoteButton.trigger")}
      </Button>

      <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
          <SheetHeader className="border-b">
            <SheetTitle className="font-display text-lg font-extrabold">
              {t("newQuoteButton.title")}
            </SheetTitle>
            <SheetDescription>
              {t("newQuoteButton.description")}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="q-customer">{t("newQuoteButton.customerLabel")}</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger id="q-customer">
                    <SelectValue placeholder={t("newQuoteButton.noCustomer")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CUSTOMER}>{t("newQuoteButton.noCustomer")}</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="q-valid">{t("newQuoteButton.validUntilLabel")}</Label>
                <Input
                  id="q-valid"
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>
            </div>

            <LineItemsEditor
              rows={rows}
              onRowChange={setRow}
              onAdd={addRow}
              onRemove={removeRow}
            />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="q-notes">{t("newQuoteButton.notesLabel")}</Label>
              <Input id="q-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("newQuoteButton.notesPlaceholder")} />
            </div>

            <div className="flex flex-col gap-1 rounded-(--radius) bg-secondary/40 p-3 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>{t("newQuoteButton.net")}</span><span>{formatEur(netTotal)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>{t("newQuoteButton.tax")}</span><span>{formatEur(taxTotal)}</span></div>
              <div className="flex justify-between font-semibold"><span>{t("newQuoteButton.total")}</span><span>{formatEur(netTotal + taxTotal)}</span></div>
            </div>

            {error && (
              <p className="rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
            )}
          </div>

          <SheetFooter className="flex-row gap-2 border-t">
            <Button type="button" variant="outline" className="flex-1" disabled={busy} onClick={() => setOpen(false)}>
              {t("newQuoteButton.cancel")}
            </Button>
            <Button type="button" className="flex-1" disabled={busy} onClick={save}>
              {busy ? t("newQuoteButton.submitting") : t("newQuoteButton.submit")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
