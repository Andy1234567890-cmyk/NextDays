"use client";

// Ausgabenliste mit Filterleiste und Aktionen. Die Filter stehen in der URL
// (?from&to&status&categoryId&recurring&search) — die Server-Seite lädt danach;
// die Liste selbst ist reines Rendern plus Aktionen (Bearbeiten, Bezahlt,
// Sperren, Löschen, Beleg öffnen). Nach jeder eigenen Aktion `router.refresh()`
// — kein Realtime auf `expenses` (Finanztabelle, Wurzel 6).
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { DatePicker } from "@nextdays/ui/date-picker";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import { AusgabeFormular } from "@/components/buchhaltung/ausgaben/ausgabe-formular";
import { KategorienDialog } from "@/components/buchhaltung/ausgaben/kategorien-dialog";
import {
  deleteExpense,
  getExpenseReceiptUrl,
  lockExpense,
  runRecurringExpenses,
  updateExpense,
} from "@/lib/buchhaltung-ausgaben";
import type {
  Expense,
  ExpenseCategory,
  ExpenseFilter,
  ExpenseList,
  PaymentStatus,
} from "@/lib/buchhaltung-ausgaben-typen";
import { PAYMENT_STATUSES } from "@/lib/buchhaltung-ausgaben-typen";
import { formatCurrency } from "@/lib/currency";

const STATUS_CLASSES: Record<PaymentStatus, string> = {
  open: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  paid: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  cancelled: "bg-muted text-muted-foreground",
};

function betrag(wert: string, currency: string, locale: string): string {
  const n = Number(wert);
  return formatCurrency(Number.isFinite(n) ? n : 0, currency, locale);
}

function datum(iso: string | null, locale: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(locale).format(new Date(iso));
}

export function AusgabenListe({
  liste,
  categories,
  filter,
  ladeFehler,
}: {
  liste: ExpenseList | null;
  categories: ExpenseCategory[];
  filter: ExpenseFilter;
  ladeFehler: string | null;
}) {
  const t = useTranslations("finance");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [formOffen, setFormOffen] = useState(false);
  const [bearbeitet, setBearbeitet] = useState<Expense | null>(null);
  const [kategorienOffen, setKategorienOffen] = useState(false);
  const [f, setF] = useState<ExpenseFilter>(filter);
  const [laeuft, setLaeuft] = useState<string | null>(null);

  const anwenden = () => {
    const p = new URLSearchParams();
    if (f.from) p.set("from", f.from);
    if (f.to) p.set("to", f.to);
    if (f.status) p.set("status", f.status);
    if (f.categoryId) p.set("categoryId", f.categoryId);
    if (f.recurring !== undefined) p.set("recurring", String(f.recurring));
    if (f.search?.trim()) p.set("search", f.search.trim());
    const s = p.toString();
    router.push(s ? `${pathname}?${s}` : pathname);
  };

  const neu = () => {
    setBearbeitet(null);
    setFormOffen(true);
  };

  const oeffnen = (e: Expense) => {
    setBearbeitet(e);
    setFormOffen(true);
  };

  const aktion = async (id: string, lauf: () => Promise<{ ok: boolean; error?: string }>, erfolg: string) => {
    setLaeuft(id);
    const res = await lauf();
    setLaeuft(null);
    if (!res.ok) {
      toast.error(res.error ?? t("ausgabenPage.actionFailed"));
      return;
    }
    toast.success(erfolg);
    router.refresh();
  };

  const belegOeffnen = async (e: Expense) => {
    const res = await getExpenseReceiptUrl(e.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    window.open(res.data.url, "_blank", "noopener,noreferrer");
  };

  const wiederholungen = async () => {
    setLaeuft("recurring");
    const res = await runRecurringExpenses();
    setLaeuft(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      t("ausgabenPage.recurringRunDone", {
        created: res.data.created,
        skipped: res.data.skippedExisting,
        templates: res.data.templatesChecked,
      }),
    );
    router.refresh();
  };

  const summen = liste ? Object.entries(liste.sumGrossByCurrency) : [];
  // Formular und Filter zeigen nur aktive Kategorien; die Verwaltung alle.
  const aktive = categories.filter((c) => c.isActive);

  return (
    <div className="flex flex-col gap-4">
      <AusgabenKopf
        laeuftWiederholung={laeuft === "recurring"}
        onKategorien={() => setKategorienOffen(true)}
        onWiederholungen={wiederholungen}
        onNeu={neu}
      />

      <AusgabenFilter
        f={f}
        setF={setF}
        kategorien={aktive}
        onAnwenden={anwenden}
        onZuruecksetzen={() => {
          setF({});
          router.push(pathname);
        }}
      />

      {ladeFehler ? (
        <Card className="p-5 text-sm text-destructive">{ladeFehler}</Card>
      ) : !liste || liste.items.length === 0 ? (
        <AusgabenLeer onNeu={neu} />
      ) : (
        <>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="text-muted-foreground">
              {t("ausgabenPage.countLabel", { count: liste.total })}
            </span>
            {summen.map(([cur, sum]) => (
              <span key={cur} className="font-medium">
                {t("ausgabenPage.sumLabel")} {betrag(sum, cur, locale)}
              </span>
            ))}
          </div>
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[56rem] text-sm">
              <thead className="border-b bg-secondary/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("ausgabenPage.columnDate")}</th>
                  <th className="px-4 py-3 font-medium">{t("ausgabenPage.columnTitle")}</th>
                  <th className="px-4 py-3 font-medium">{t("ausgabenPage.columnSupplier")}</th>
                  <th className="px-4 py-3 font-medium">{t("ausgabenPage.columnCategory")}</th>
                  <th className="px-4 py-3 text-right font-medium">{t("ausgabenPage.columnGross")}</th>
                  <th className="px-4 py-3 font-medium">{t("ausgabenPage.columnStatus")}</th>
                  <th className="px-4 py-3 text-right font-medium">{t("ausgabenPage.columnActions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {liste.items.map((e) => (
                  <AusgabeZeile
                    key={e.id}
                    e={e}
                    locale={locale}
                    laeuft={laeuft === e.id}
                    onOeffnen={oeffnen}
                    onBeleg={belegOeffnen}
                    onAktion={aktion}
                  />
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      <AusgabeFormular open={formOffen} onOpenChange={setFormOffen} categories={aktive} bestand={bearbeitet} />
      <KategorienDialog open={kategorienOffen} onOpenChange={setKategorienOffen} categories={categories} />
    </div>
  );
}

/** Die Filterleiste der Ausgabenliste. Sie hält nur den Entwurf der Filter;
 *  angewendet werden sie über die URL (teilbarer Link, Zurück-Knopf). */
function AusgabenFilter({
  f,
  setF,
  kategorien,
  onAnwenden,
  onZuruecksetzen,
}: {
  f: ExpenseFilter;
  setF: React.Dispatch<React.SetStateAction<ExpenseFilter>>;
  kategorien: ExpenseCategory[];
  onAnwenden: () => void;
  onZuruecksetzen: () => void;
}) {
  const t = useTranslations("finance");
  return (
    <Card className="flex flex-wrap items-end gap-3 p-3">
    <div className="flex min-w-[10rem] flex-1 flex-col gap-1">
      <span className="text-xs text-muted-foreground">{t("ausgabenPage.filterSearch")}</span>
      <Input value={f.search ?? ""} placeholder={t("ausgabenPage.filterSearchPlaceholder")} onChange={(e) => setF((p) => ({ ...p, search: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") onAnwenden(); }} />
    </div>
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{t("ausgabenPage.filterFrom")}</span>
      <DatePicker value={f.from ?? ""} onChange={(v) => setF((p) => ({ ...p, from: v || undefined }))} />
    </div>
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{t("ausgabenPage.filterTo")}</span>
      <DatePicker value={f.to ?? ""} onChange={(v) => setF((p) => ({ ...p, to: v || undefined }))} />
    </div>
    <div className="flex w-36 flex-col gap-1">
      <span className="text-xs text-muted-foreground">{t("ausgabenPage.filterStatus")}</span>
      <NativeSelect value={f.status ?? ""} onChange={(e) => setF((p) => ({ ...p, status: (e.target.value || undefined) as PaymentStatus | undefined }))}>
        <option value="">{t("ausgabenPage.filterAll")}</option>
        {PAYMENT_STATUSES.map((s) => (
          <option key={s} value={s}>{t(`ausgabenPage.status_${s}`)}</option>
        ))}
      </NativeSelect>
    </div>
    <div className="flex w-44 flex-col gap-1">
      <span className="text-xs text-muted-foreground">{t("ausgabenPage.filterCategory")}</span>
      <NativeSelect value={f.categoryId ?? ""} onChange={(e) => setF((p) => ({ ...p, categoryId: e.target.value || undefined }))}>
        <option value="">{t("ausgabenPage.filterAll")}</option>
        {kategorien.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </NativeSelect>
    </div>
    <div className="flex w-40 flex-col gap-1">
      <span className="text-xs text-muted-foreground">{t("ausgabenPage.filterRecurring")}</span>
      <NativeSelect value={f.recurring === undefined ? "" : String(f.recurring)} onChange={(e) => setF((p) => ({ ...p, recurring: e.target.value === "" ? undefined : e.target.value === "true" }))}>
        <option value="">{t("ausgabenPage.filterAll")}</option>
        <option value="true">{t("ausgabenPage.filterRecurringOnly")}</option>
        <option value="false">{t("ausgabenPage.filterRecurringNone")}</option>
      </NativeSelect>
    </div>
    <Button type="button" size="sm" onClick={onAnwenden}>
      <Icon icon="ph:funnel" className="size-4" />
      {t("ausgabenPage.filterApply")}
    </Button>
    <Button type="button" size="sm" variant="ghost" onClick={onZuruecksetzen}>
      {t("ausgabenPage.filterReset")}
    </Button>
  </Card>
  );
}

/** Eine Zeile der Ausgabenliste samt ihrer Aktionen. */
function AusgabeZeile({
  e,
  locale,
  laeuft,
  onOeffnen,
  onBeleg,
  onAktion,
}: {
  e: Expense;
  locale: string;
  laeuft: boolean;
  onOeffnen: (e: Expense) => void;
  onBeleg: (e: Expense) => void;
  onAktion: (
    id: string,
    lauf: () => Promise<{ ok: boolean; error?: string }>,
    erfolg: string,
  ) => void;
}) {
  const t = useTranslations("finance");
  return (
                <tr key={e.id} className="transition-colors hover:bg-secondary/30">
  <td className="px-4 py-3 text-muted-foreground">{datum(e.expenseDate, locale)}</td>
  <td className="px-4 py-3">
    <button type="button" className="text-left font-medium hover:underline" onClick={() => onOeffnen(e)}>
      {e.title}
    </button>
    <div className="flex gap-2 text-xs text-muted-foreground">
      {e.receiptNumber && <span>{e.receiptNumber}</span>}
      {e.isRecurring && (
        <span title={t("ausgabenPage.recurringTemplate")}>
          <Icon icon="ph:repeat" className="inline size-3.5" /> {e.recurringInterval ? t(`ausgabenPage.interval_${e.recurringInterval}`) : ""}
        </span>
      )}
      {e.templateId && <span>{t("ausgabenPage.fromTemplate")}</span>}
      {e.isLocked && <Icon icon="ph:lock" className="inline size-3.5" aria-label={t("ausgabenPage.locked")} />}
    </div>
  </td>
  <td className="px-4 py-3 text-muted-foreground">{e.supplierName ?? "—"}</td>
  <td className="px-4 py-3 text-muted-foreground">{e.categoryName ?? "—"}</td>
  <td className="px-4 py-3 text-right font-medium">{betrag(e.grossAmount, e.currency, locale)}</td>
  <td className="px-4 py-3">
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASSES[e.paymentStatus]}`}>
      {t(`ausgabenPage.status_${e.paymentStatus}`)}
    </span>
  </td>
  <td className="px-4 py-3">
    <div className="flex justify-end gap-1">
      {e.hasReceipt && (
        <Button type="button" variant="ghost" size="sm" aria-label={t("ausgabenPage.openReceipt")} onClick={() => onBeleg(e)}>
          <Icon icon="ph:paperclip" className="size-4" />
        </Button>
      )}
      {e.paymentStatus === "open" && (
        <Button type="button" variant="ghost" size="sm" aria-label={t("ausgabenPage.markPaid")} disabled={laeuft}
          onClick={() => onAktion(e.id, () => updateExpense(e.id, { paymentStatus: "paid" }), t("ausgabenPage.markedPaid"))}>
          <Icon icon="ph:check-circle" className="size-4" />
        </Button>
      )}
      {!e.isLocked && (
        <Button type="button" variant="ghost" size="sm" aria-label={t("ausgabenPage.lock")} disabled={laeuft}
          onClick={() => { if (window.confirm(t("ausgabenPage.lockConfirm"))) onAktion(e.id, () => lockExpense(e.id), t("ausgabenPage.lockedNow")); }}>
          <Icon icon="ph:lock-key" className="size-4" />
        </Button>
      )}
      <Button type="button" variant="ghost" size="sm" aria-label={t("ausgabenPage.edit")} onClick={() => onOeffnen(e)}>
        <Icon icon="ph:pencil-simple" className="size-4" />
      </Button>
      {!e.isLocked && (
        <Button type="button" variant="ghost" size="sm" aria-label={t("ausgabenPage.delete")} disabled={laeuft}
          onClick={() => { if (window.confirm(t("ausgabenPage.deleteConfirm", { title: e.title }))) onAktion(e.id, () => deleteExpense(e.id), t("ausgabenPage.deleted")); }}>
          <Icon icon="ph:trash" className="size-4 text-destructive" />
        </Button>
      )}
    </div>
  </td>
</tr>
  );
}

/** Leerer Zustand der Ausgabenliste. */
function AusgabenLeer({ onNeu }: { onNeu: () => void }) {
  const t = useTranslations("finance");
  return (
  <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
    <span className="flex size-14 items-center justify-center rounded-full bg-secondary">
      <Icon icon="ph:receipt" className="size-7 text-muted-foreground" />
    </span>
    <div>
      <p className="font-display text-lg font-extrabold">{t("ausgabenPage.emptyTitle")}</p>
      <p className="text-sm text-muted-foreground">{t("ausgabenPage.emptySubtitle")}</p>
    </div>
    <Button type="button" onClick={onNeu}>
      <Icon icon="ph:plus" className="size-4" />
      {t("ausgabenPage.newButton")}
    </Button>
  </Card>
  );
}

/** Überschrift und die drei Kopfknöpfe der Ausgabenliste. */
function AusgabenKopf({
  laeuftWiederholung,
  onKategorien,
  onWiederholungen,
  onNeu,
}: {
  laeuftWiederholung: boolean;
  onKategorien: () => void;
  onWiederholungen: () => void;
  onNeu: () => void;
}) {
  const t = useTranslations("finance");
  return (
  <div className="flex flex-wrap items-start justify-between gap-3">
    <div>
      <h2 className="font-display text-2xl font-extrabold">{t("ausgabenPage.title")}</h2>
      <p className="text-sm text-muted-foreground">{t("ausgabenPage.subtitle")}</p>
    </div>
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" onClick={onKategorien}>
        <Icon icon="ph:tag" className="size-4" />
        {t("ausgabenPage.categoriesButton")}
      </Button>
      <Button type="button" variant="outline" onClick={onWiederholungen} disabled={laeuftWiederholung}>
        <Icon icon={laeuftWiederholung ? "ph:circle-notch" : "ph:repeat"} className={`size-4 ${laeuftWiederholung ? "animate-spin" : ""}`} />
        {t("ausgabenPage.recurringRun")}
      </Button>
      <Button type="button" onClick={onNeu}>
        <Icon icon="ph:plus" className="size-4" />
        {t("ausgabenPage.newButton")}
      </Button>
    </div>
  </div>
  );
}
