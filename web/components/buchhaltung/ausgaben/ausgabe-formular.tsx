"use client";

// Anlegen/Bearbeiten einer Ausgabe im Sheet — mit Beleg-Upload (Vorschau für
// PDF/JPEG/PNG; HEIC vom iPhone wird OHNE Vorschau als Datei angenommen,
// `heic2any` ist bewusst nicht installiert) und „Beleg auslesen" (Gemini,
// Vorschläge füllen leere Felder, der Mensch prüft). Beträge rechnet der
// Server: hier Brutto ODER Netto + Steuersatz eingeben, Steuersatz ist Pflicht
// und hat KEINEN Standardwert (27 Länder, Wurzel 4) — vorbelegt nur, wenn der
// Betrieb einen Standardsatz hinterlegt hat.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { DatePicker } from "@nextdays/ui/date-picker";
import { InfoHinweis } from "@nextdays/ui/info-hinweis";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { NativeSelect } from "@nextdays/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@nextdays/ui/sheet";
import { Switch } from "@nextdays/ui/switch";
import { Textarea } from "@nextdays/ui/textarea";
import { useNewAuth } from "@/contexts/NewAuthContext";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import {
  createExpense,
  extractReceipt,
  updateExpense,
  uploadExpenseReceipt,
} from "@/lib/buchhaltung-ausgaben";
import type {
  Expense,
  ExpenseCategory,
  ExpenseInput,
  ExpenseUpdateInput,
  PaymentStatus,
  ReceiptExtraction,
  RecurringInterval,
} from "@/lib/buchhaltung-ausgaben-typen";
import { PAYMENT_STATUSES, RECURRING_INTERVALS } from "@/lib/buchhaltung-ausgaben-typen";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.heic,.heif,application/pdf,image/jpeg,image/png,image/heic,image/heif";
const MAX_BYTES = 15 * 1024 * 1024;

type Form = {
  title: string;
  supplierName: string;
  supplierAddress: string;
  supplierVatId: string;
  supplierEmail: string;
  receiptNumber: string;
  expenseDate: string;
  dueDate: string;
  grossAmount: string;
  netAmount: string;
  taxRate: string;
  currency: string;
  categoryId: string;
  bookingAccount: string;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  paidAt: string;
  isRecurring: boolean;
  recurringInterval: RecurringInterval;
  nextDueDate: string;
  taxDeductible: boolean;
  description: string;
  notes: string;
};

function heute(): string {
  return new Date().toISOString().slice(0, 10);
}

function leer(vorgabeSatz: string): Form {
  return {
    title: "",
    supplierName: "",
    supplierAddress: "",
    supplierVatId: "",
    supplierEmail: "",
    receiptNumber: "",
    expenseDate: heute(),
    dueDate: "",
    grossAmount: "",
    netAmount: "",
    taxRate: vorgabeSatz,
    currency: "",
    categoryId: "",
    bookingAccount: "",
    paymentStatus: "open",
    paymentMethod: "",
    paidAt: "",
    isRecurring: false,
    recurringInterval: "monthly",
    nextDueDate: "",
    taxDeductible: true,
    description: "",
    notes: "",
  };
}

function ausBestand(e: Expense): Form {
  return {
    title: e.title,
    supplierName: e.supplierName ?? "",
    supplierAddress: e.supplierAddress ?? "",
    supplierVatId: e.supplierVatId ?? "",
    supplierEmail: e.supplierEmail ?? "",
    receiptNumber: e.receiptNumber ?? "",
    expenseDate: e.expenseDate,
    dueDate: e.dueDate ?? "",
    grossAmount: e.grossAmount,
    netAmount: e.netAmount,
    taxRate: e.taxRate,
    currency: e.currency,
    categoryId: e.categoryId ?? "",
    bookingAccount: e.bookingAccount ?? "",
    paymentStatus: e.paymentStatus,
    paymentMethod: e.paymentMethod ?? "",
    paidAt: e.paidAt ?? "",
    isRecurring: e.isRecurring,
    recurringInterval: e.recurringInterval ?? "monthly",
    nextDueDate: e.nextDueDate ?? "",
    taxDeductible: e.taxDeductible ?? true,
    description: e.description ?? "",
    notes: e.notes ?? "",
  };
}

function oderNull(s: string): string | null {
  const t = s.trim();
  return t ? t : null;
}

export function AusgabeFormular({
  open,
  onOpenChange,
  categories,
  bestand,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ExpenseCategory[];
  /** Vorhanden = Bearbeiten, sonst Anlegen. */
  bestand?: Expense | null;
}) {
  const t = useTranslations("finance");
  const router = useRouter();
  const { user } = useNewAuth();
  const { settings } = useCompanySettings(user?.uid);
  const vorgabeSatz = settings?.defaultTaxRate?.trim() ?? "";

  const [form, setForm] = useState<Form>(() => leer(vorgabeSatz));
  const [datei, setDatei] = useState<File | null>(null);
  const [ocr, setOcr] = useState<ReceiptExtraction | null>(null);
  const [liest, setLiest] = useState(false);
  const [speichert, setSpeichert] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const dateiRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setForm(bestand ? ausBestand(bestand) : leer(vorgabeSatz));
    setDatei(null);
    setOcr(null);
    setFehler(null);
  }, [open, bestand, vorgabeSatz]);

  const vorschauUrl = useMemo(() => (datei ? URL.createObjectURL(datei) : null), [datei]);
  useEffect(() => {
    return () => {
      if (vorschauUrl) URL.revokeObjectURL(vorschauUrl);
    };
  }, [vorschauUrl]);

  const gesperrt = Boolean(bestand?.isLocked);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((p) => ({ ...p, [k]: v }));

  const dateiWaehlen = (f: File | null) => {
    if (!f) return setDatei(null);
    if (f.size > MAX_BYTES) {
      toast.error(t("ausgabenPage.fileTooLarge"));
      return;
    }
    setDatei(f);
  };

  const istHeic = datei ? /\.(heic|heif)$/i.test(datei.name) || /heic|heif/.test(datei.type) : false;
  const istPdf = datei ? datei.type === "application/pdf" || /\.pdf$/i.test(datei.name) : false;

  const belegAuslesen = async () => {
    if (!datei) return;
    setLiest(true);
    const res = await extractReceipt(datei);
    setLiest(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const v = res.data;
    setOcr(v);
    // Nur LEERE Felder füllen — Eingaben des Menschen bleiben stehen.
    setForm((p) => ({
      ...p,
      title: p.title || (v.supplierName ? `${v.supplierName}${v.receiptNumber ? ` ${v.receiptNumber}` : ""}` : p.title),
      supplierName: p.supplierName || (v.supplierName ?? ""),
      supplierAddress: p.supplierAddress || (v.supplierAddress ?? ""),
      supplierVatId: p.supplierVatId || (v.supplierVatId ?? ""),
      supplierEmail: p.supplierEmail || (v.supplierEmail ?? ""),
      receiptNumber: p.receiptNumber || (v.receiptNumber ?? ""),
      expenseDate: v.expenseDate ?? p.expenseDate,
      dueDate: p.dueDate || (v.dueDate ?? ""),
      grossAmount: p.grossAmount || (v.grossAmount ?? ""),
      netAmount: p.netAmount || (v.netAmount ?? ""),
      taxRate: p.taxRate || (v.taxRate ?? ""),
      currency: p.currency || (v.currency ?? ""),
      description: p.description || (v.description ?? ""),
    }));
    toast.success(
      t("ausgabenPage.ocrDone", { confidence: v.confidence ? t(`ausgabenPage.confidence_${v.confidence}`) : "—" }),
    );
  };

  const speichern = async () => {
    setFehler(null);
    if (!form.title.trim()) return setFehler(t("ausgabenPage.errorTitleRequired"));
    if (!form.taxRate.trim()) return setFehler(t("ausgabenPage.errorTaxRateRequired"));
    if (!form.grossAmount.trim() && !form.netAmount.trim()) {
      return setFehler(t("ausgabenPage.errorAmountRequired"));
    }
    if (form.isRecurring && !form.nextDueDate) {
      return setFehler(t("ausgabenPage.errorNextDueRequired"));
    }
    setSpeichert(true);
    const input: ExpenseInput = {
      title: form.title.trim(),
      description: oderNull(form.description),
      supplierName: oderNull(form.supplierName),
      supplierAddress: oderNull(form.supplierAddress),
      supplierVatId: oderNull(form.supplierVatId),
      supplierEmail: oderNull(form.supplierEmail),
      receiptNumber: oderNull(form.receiptNumber),
      expenseDate: form.expenseDate,
      dueDate: oderNull(form.dueDate),
      grossAmount: oderNull(form.grossAmount.replace(",", ".")),
      netAmount: oderNull(form.netAmount.replace(",", ".")),
      taxRate: form.taxRate.replace(",", ".").trim(),
      currency: oderNull(form.currency.toUpperCase()),
      taxDeductible: form.taxDeductible,
      categoryId: oderNull(form.categoryId),
      bookingAccount: oderNull(form.bookingAccount),
      paymentStatus: form.paymentStatus,
      paymentMethod: oderNull(form.paymentMethod),
      paidAt: oderNull(form.paidAt),
      isRecurring: form.isRecurring,
      recurringInterval: form.isRecurring ? form.recurringInterval : null,
      nextDueDate: form.isRecurring ? oderNull(form.nextDueDate) : null,
      notes: oderNull(form.notes),
      ocrRaw: ocr?.raw ?? undefined,
      source: bestand ? undefined : ocr ? "ocr" : "manual",
    };
    let res;
    if (bestand) {
      const body: ExpenseUpdateInput = { ...input };
      if (gesperrt) {
        // Gesperrt: nur, was der Server noch annimmt (Zahlstatus, Kategorie, Notizen …).
        for (const k of [
          "grossAmount", "netAmount", "taxRate", "currency", "expenseDate", "receiptNumber",
          "supplierName", "title",
        ] as const) {
          delete body[k];
        }
      }
      res = await updateExpense(bestand.id, body);
    } else {
      res = await createExpense(input);
    }
    if (!res.ok) {
      setSpeichert(false);
      setFehler(res.error);
      return;
    }
    if (datei) {
      const up = await uploadExpenseReceipt(res.data.id, datei);
      if (!up.ok) {
        // Ausgabe steht, Beleg fehlt — laut sagen, nicht still weitergehen.
        toast.error(t("ausgabenPage.receiptUploadFailed", { error: up.error }));
      }
    }
    setSpeichert(false);
    toast.success(bestand ? t("ausgabenPage.saved") : t("ausgabenPage.created"));
    onOpenChange(false);
    router.refresh();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {bestand ? t("ausgabenPage.editTitle") : t("ausgabenPage.newTitle")}
          </SheetTitle>
          <SheetDescription>{t("ausgabenPage.formSubtitle")}</SheetDescription>
        </SheetHeader>

        {gesperrt && (
          <p className="mt-2 rounded-(--radius) bg-muted px-3 py-2 text-xs text-muted-foreground">
            <Icon icon="ph:lock" className="mr-1 inline size-3.5" />
            {t("ausgabenPage.lockedHint")}
          </p>
        )}

        <div className="mt-4 flex flex-col gap-5 pb-4">
          {/* Beleg */}
          <section className="rounded-(--radius) border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Label>{t("ausgabenPage.receiptLabel")}</Label>
                <InfoHinweis
                  ariaLabel={t("ausgabenPage.receiptHelpAria")}
                  text={[t("ausgabenPage.receiptHelp1"), t("ausgabenPage.receiptHelp2")]}
                />
              </div>
              {bestand?.hasReceipt && !datei && (
                <span className="text-xs text-muted-foreground">
                  <Icon icon="ph:paperclip" className="mr-1 inline size-3.5" />
                  {bestand.receiptFilename}
                </span>
              )}
            </div>
            <input
              ref={dateiRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => dateiWaehlen(e.target.files?.[0] ?? null)}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={gesperrt && Boolean(bestand?.hasReceipt)}
                onClick={() => dateiRef.current?.click()}
              >
                <Icon icon="ph:upload-simple" className="size-4" />
                {datei ? t("ausgabenPage.replaceFile") : t("ausgabenPage.chooseFile")}
              </Button>
              {datei && (
                <>
                  <span className="max-w-[14rem] truncate text-xs text-muted-foreground">
                    {datei.name} · {(datei.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                  <Button type="button" size="sm" onClick={belegAuslesen} disabled={liest}>
                    {liest ? (
                      <Icon icon="ph:circle-notch" className="size-4 animate-spin" />
                    ) : (
                      <Icon icon="ph:sparkle" className="size-4" />
                    )}
                    {t("ausgabenPage.extract")}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => dateiWaehlen(null)}>
                    <Icon icon="ph:x" className="size-4" />
                  </Button>
                </>
              )}
            </div>
            {datei && vorschauUrl && (
              <div className="mt-3 overflow-hidden rounded-(--radius) border border-border bg-muted">
                {istHeic ? (
                  <p className="p-3 text-xs text-muted-foreground">{t("ausgabenPage.heicNoPreview")}</p>
                ) : istPdf ? (
                  <iframe title={datei.name} src={vorschauUrl} className="h-72 w-full" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- lokale Objekt-URL, kein Optimizer
                  <img src={vorschauUrl} alt={datei.name} className="max-h-72 w-full object-contain" />
                )}
              </div>
            )}
          </section>

          {/* Kopf */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Feld label={t("ausgabenPage.fieldTitle")} required className="sm:col-span-2">
              <Input value={form.title} disabled={gesperrt} onChange={(e) => set("title", e.target.value)} />
            </Feld>
            <Feld label={t("ausgabenPage.fieldSupplier")}>
              <Input value={form.supplierName} disabled={gesperrt} onChange={(e) => set("supplierName", e.target.value)} />
            </Feld>
            <Feld label={t("ausgabenPage.fieldReceiptNumber")}>
              <Input value={form.receiptNumber} disabled={gesperrt} onChange={(e) => set("receiptNumber", e.target.value)} />
            </Feld>
            <Feld label={t("ausgabenPage.fieldExpenseDate")} required>
              <DatePicker value={form.expenseDate} disabled={gesperrt} onChange={(v) => set("expenseDate", v)} />
            </Feld>
            <Feld label={t("ausgabenPage.fieldDueDate")}>
              <DatePicker value={form.dueDate} onChange={(v) => set("dueDate", v)} />
            </Feld>
          </div>

          {/* Beträge */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <Feld label={t("ausgabenPage.fieldGross")} hint={t("ausgabenPage.amountHelp")}>
              <Input inputMode="decimal" value={form.grossAmount} disabled={gesperrt} onChange={(e) => set("grossAmount", e.target.value)} />
            </Feld>
            <Feld label={t("ausgabenPage.fieldNet")}>
              <Input inputMode="decimal" value={form.netAmount} disabled={gesperrt} onChange={(e) => set("netAmount", e.target.value)} />
            </Feld>
            <Feld label={t("ausgabenPage.fieldTaxRate")} required hint={t("ausgabenPage.taxRateHelp")}>
              <Input inputMode="decimal" value={form.taxRate} disabled={gesperrt} placeholder="—" onChange={(e) => set("taxRate", e.target.value)} />
            </Feld>
            <Feld label={t("ausgabenPage.fieldCurrency")} hint={t("ausgabenPage.currencyHelp")}>
              <Input maxLength={3} value={form.currency} disabled={gesperrt} placeholder={t("ausgabenPage.currencyPlaceholder")} onChange={(e) => set("currency", e.target.value.toUpperCase())} />
            </Feld>
          </div>

          {/* Zuordnung */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Feld label={t("ausgabenPage.fieldCategory")}>
              <NativeSelect value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                <option value="">{t("ausgabenPage.noCategory")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </NativeSelect>
            </Feld>
            <Feld label={t("ausgabenPage.fieldBookingAccount")}>
              <Input value={form.bookingAccount} onChange={(e) => set("bookingAccount", e.target.value)} />
            </Feld>
            <Feld label={t("ausgabenPage.fieldPaymentStatus")}>
              <NativeSelect value={form.paymentStatus} onChange={(e) => set("paymentStatus", e.target.value as PaymentStatus)}>
                {PAYMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>{t(`ausgabenPage.status_${s}`)}</option>
                ))}
              </NativeSelect>
            </Feld>
            {form.paymentStatus === "paid" && (
              <>
                <Feld label={t("ausgabenPage.fieldPaidAt")}>
                  <DatePicker value={form.paidAt} onChange={(v) => set("paidAt", v)} />
                </Feld>
                <Feld label={t("ausgabenPage.fieldPaymentMethod")}>
                  <Input value={form.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)} />
                </Feld>
              </>
            )}
          </div>

          {/* Wiederkehrend */}
          <section className="rounded-(--radius) border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="ausgabe-wiederkehrend">{t("ausgabenPage.recurringLabel")}</Label>
                <InfoHinweis ariaLabel={t("ausgabenPage.recurringHelpAria")} text={t("ausgabenPage.recurringHelp")} />
              </div>
              <Switch
                id="ausgabe-wiederkehrend"
                checked={form.isRecurring}
                disabled={Boolean(bestand?.templateId)}
                onCheckedChange={(v) => set("isRecurring", v)}
              />
            </div>
            {form.isRecurring && (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Feld label={t("ausgabenPage.fieldInterval")}>
                  <NativeSelect value={form.recurringInterval} onChange={(e) => set("recurringInterval", e.target.value as RecurringInterval)}>
                    {RECURRING_INTERVALS.map((i) => (
                      <option key={i} value={i}>{t(`ausgabenPage.interval_${i}`)}</option>
                    ))}
                  </NativeSelect>
                </Feld>
                <Feld label={t("ausgabenPage.fieldNextDue")} required>
                  <DatePicker value={form.nextDueDate} onChange={(v) => set("nextDueDate", v)} />
                </Feld>
              </div>
            )}
          </section>

          {/* Weiteres */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="ausgabe-abzug">{t("ausgabenPage.taxDeductible")}</Label>
              <InfoHinweis ariaLabel={t("ausgabenPage.taxDeductibleHelpAria")} text={t("ausgabenPage.taxDeductibleHelp")} />
            </div>
            <Switch id="ausgabe-abzug" checked={form.taxDeductible} onCheckedChange={(v) => set("taxDeductible", v)} />
          </div>
          <Feld label={t("ausgabenPage.fieldDescription")}>
            <Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Feld>
          <Feld label={t("ausgabenPage.fieldNotes")}>
            <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Feld>

          {fehler && <p className="text-sm text-destructive">{fehler}</p>}
        </div>

        <SheetFooter className="mt-auto flex-row justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("ausgabenPage.cancel")}
          </Button>
          <Button type="button" onClick={speichern} disabled={speichert}>
            {speichert && <Icon icon="ph:circle-notch" className="size-4 animate-spin" />}
            {bestand ? t("ausgabenPage.save") : t("ausgabenPage.create")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Feld({
  label,
  required,
  hint,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <div className="flex items-center gap-1.5">
        <Label>
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
        {hint && <InfoHinweis ariaLabel={label} text={hint} />}
      </div>
      {children}
    </div>
  );
}
