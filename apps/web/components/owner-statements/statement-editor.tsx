"use client";

// Statement-Editor — Layout 1:1 nach Hostaway „Owner Statements → Create & Edit":
// Aktionsleiste (New/Save/Download/Select/More) · Filters-Button + Chip-Reihe ·
// flache, einklappbare Sektionen (Data / Summary / Rental activity / Expenses &
// extras / Attachments / Grand total). Daten echt aus dem Backend.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { StatementPreviewModal } from "@/components/owner-statements/statement-preview-modal";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/currency";
import { downloadStatementPdf } from "@/lib/statement-pdf";
import {
  addExpense,
  cancelStatement,
  deleteExpense,
  deleteStatement,
  finalizeStatement,
  generateStatement,
  getStatement,
  updateExpense,
  updateStatement,
  type Expense,
  type Statement,
  type StatementHeader,
  type StatementListItem,
} from "@/lib/owner-statements";

export type PropOption = { id: string; title: string };

const STATUS_OPTIONS = ["pending", "confirmed", "cancelled", "completed"];
const EXPENSE_CATEGORIES = ["Cleaning", "Utilities", "Maintenance", "TV", "Goods", "Other"];
const CHANNEL_DOT: Record<string, string> = {
  direct: "bg-emerald-500",
  portal: "bg-sky-500",
  booking: "bg-blue-600",
  airbnb: "bg-rose-500",
  vrbo: "bg-indigo-500",
};

export function StatementEditor({
  statement,
  properties,
  onChange,
  onListChange,
  onReprice,
}: {
  statement: Statement;
  properties: PropOption[];
  onChange: (s: Statement) => void;
  onListChange: (fn: (prev: StatementListItem[]) => StatementListItem[]) => void;
  // Vorschau-Modus (noch nicht gespeichert): bei Zeitraum-/Filter-Änderung wird
  // die Live-Auswertung neu berechnet statt ans Backend gepatcht.
  onReprice?: (opts: {
    period_from?: string;
    period_to?: string;
    basis?: Statement["basis"];
    reservation_statuses?: string[];
    commission_pct?: number;
  }) => void;
}) {
  const t = useTranslations("ownerStatements");
  const [st, setSt] = useState<Statement>(statement);
  const [busy, setBusy] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  // Hat der Nutzer die Provision manuell überschrieben? Nur dann wird sie als
  // statement-weiter Override gesendet; sonst rechnet das Backend je Objekt aus
  // den Stammdaten (commission_pct = null).
  const [commissionTouched, setCommissionTouched] = useState(false);

  // Wenn der Parent ein neues Statement liefert (z. B. neu geladene Vorschau),
  // den lokalen Zustand übernehmen (und den manuellen Override-Marker lösen).
  useEffect(() => {
    setSt(statement);
    setCommissionTouched(false);
  }, [statement]);
  const finalized = st.status === "finalized" || st.status === "cancelled";
  const isCancellation = st.kind === "cancellation";
  const isCancelled = st.status === "cancelled";
  const cur = st.summary.currency;
  // Owner-Auszahlung steht in der Owner-Zielwährung (aus dem Herkunftsland).
  const ownerCur = st.summary.owner_currency || cur;

  function patchHeader<K extends keyof StatementHeader>(key: K, value: StatementHeader[K]) {
    setSt((s) => ({ ...s, header: { ...s.header, [key]: value } }));
  }

  // Noch nicht gespeicherter Entwurf (kein DB-Datensatz): erkennbar an leerer id.
  const isNew = !st.id;

  async function persist(patch: Parameters<typeof updateStatement>[1]) {
    // Vorschau-Modus (noch nicht gespeichert): nicht patchen, sondern die Live-
    // Auswertung mit den neuen Zeitraum-/Filter-Werten neu berechnen.
    if (isNew) {
      onReprice?.({
        period_from: patch.period_from,
        period_to: patch.period_to,
        basis: patch.basis,
        reservation_statuses: patch.reservation_statuses,
        // Override nur durchreichen, wenn der Nutzer ihn manuell gesetzt hat.
        commission_pct:
          patch.commission_pct ??
          (commissionTouched ? st.commission_pct : undefined),
      });
      return;
    }
    const res = await updateStatement(st.id, patch);
    if (res.ok) {
      setSt(res.data);
      onChange(res.data);
    } else toast.error(res.error);
  }

  async function refresh() {
    if (isNew) return;
    const res = await getStatement(st.id);
    if (res.ok) {
      setSt(res.data);
      onChange(res.data);
    }
  }

  async function save() {
    setBusy(true);
    // Neuer Entwurf → Abrechnung erst jetzt im Backend erzeugen.
    const res = isNew
      ? await generateStatement({
          owner_id: st.owner_id,
          period_from: st.period_from,
          period_to: st.period_to,
          basis: st.basis,
          reservation_statuses: st.reservation_statuses,
          // Kein manueller Override → null, Backend rechnet je Objekt.
          commission_pct: commissionTouched ? st.commission_pct : null,
        })
      : await updateStatement(st.id, {
          header: st.header,
          commission_pct: st.commission_pct,
          basis: st.basis,
          reservation_statuses: st.reservation_statuses,
          period_from: st.period_from,
          period_to: st.period_to,
        });
    setBusy(false);
    if (res.ok) {
      setSt(res.data);
      onChange(res.data);
      // Neu angelegte Abrechnung in die Liste aufnehmen.
      if (isNew) {
        const d = res.data;
        onListChange((prev) => [
          {
            id: d.id,
            owner_id: d.owner_id,
            owner_name: d.header.owner_name,
            period_from: d.period_from,
            period_to: d.period_to,
            status: d.status,
            owner_payout: d.summary.owner_payout,
            pm_payout: d.summary.pm_payout,
            currency: d.summary.currency,
            invoice_number: d.header.invoice_number,
            created_at: d.created_at,
          },
          ...prev,
        ]);
      }
      toast.success(t("saved"));
    } else toast.error(res.error);
  }

  async function finalize() {
    const res = await finalizeStatement(st.id);
    if (res.ok) {
      setSt(res.data);
      onChange(res.data);
      toast.success(t("finalized"));
    } else toast.error(res.error);
  }

  async function remove() {
    if (!window.confirm(t("deleteConfirm"))) return;
    const res = await deleteStatement(st.id);
    if (res.ok) {
      onListChange((prev) => prev.filter((i) => i.id !== st.id));
      toast.success(t("deleted"));
      window.location.reload();
    } else toast.error(res.error);
  }

  async function cancel() {
    if (!window.confirm(t("cancelConfirm"))) return;
    setBusy(true);
    const res = await cancelStatement(st.id);
    setBusy(false);
    if (res.ok) {
      // Antwort ist die NEUE Stornorechnung; sie wird angezeigt.
      setSt(res.data);
      onChange(res.data);
      toast.success(t("cancelled"));
    } else toast.error(res.error);
  }

  const expensesTotal = st.summary.expenses_total;
  const grandTotal = st.summary.total_price + expensesTotal;

  return (
    <div className="flex flex-col gap-5">
      {/* Aktionsleiste: Titel links, Hostaway-Buttons rechts */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold">{t("title")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {!finalized && (
            <Button onClick={() => void save()} disabled={busy}>
              {busy ? t("saving") : t("save")}
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowPreview(true)}>
            <Icon icon="ph:eye" className="size-4" />
            {t("preview")}
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void downloadStatementPdf(st)
                .catch(() => toast.error(t("downloadFailed")))
                .finally(() => setBusy(false));
            }}
          >
            <Icon icon="ph:download-simple" className="size-4" />
            {t("download")}
          </Button>
          {!finalized && !isNew && (
            <Button variant="outline" onClick={() => void finalize()}>
              {t("finalize")}
            </Button>
          )}
          {/* Storno: nur bei finalisierter, normaler, noch nicht stornierter
              Rechnung. Eine Stornorechnung selbst lässt sich nicht stornieren. */}
          {st.status === "finalized" && !isCancellation && !isCancelled && (
            <Button variant="outline" onClick={() => void cancel()} disabled={busy}>
              <Icon icon="ph:arrow-u-up-left" className="size-4" />
              {t("storno")}
            </Button>
          )}
          {!finalized && (
            <Button variant="ghost" size="icon" onClick={() => void remove()} aria-label={t("delete")}>
              <Icon icon="ph:dots-three-vertical" className="size-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Status-/Storno-Banner */}
      {isCancellation && (
        <div className="rounded-(--radius) border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          {st.header.notes ?? t("stornoBanner")}
        </div>
      )}
      {isCancelled && (
        <div className="rounded-(--radius) border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {t("cancelledBanner")}
        </div>
      )}

      {/* Filters-Button + Chip-Reihe */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className="flex w-fit items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm font-medium"
        >
          <Icon icon="ph:funnel" className="size-4" />
          {t("filters.title")}
          <span className="flex size-5 items-center justify-center rounded-full bg-accent text-xs text-accent-foreground">
            {2 + (st.reservation_statuses.length > 0 ? 1 : 0) + 1}
          </span>
        </button>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Chip>{t("filters.from")}: {st.period_from}</Chip>
          <Chip>{t("filters.to")}: {st.period_to}</Chip>
          <Chip>{st.basis === "check_in" ? t("filters.checkIn") : t("filters.checkOut")}</Chip>
          <Chip>{t("filters.statusCount", { count: st.reservation_statuses.length })}</Chip>
          {finalized && (
            <span className="rounded-full bg-foreground px-2.5 py-1 font-medium text-background">
              {t("status.finalized")}
            </span>
          )}
        </div>
      </div>

      {showFilters && !finalized && (
        <div className="grid grid-cols-1 gap-4 rounded-(--radius) border border-border p-4 sm:grid-cols-4">
          <Labeled label={t("filters.from")}>
            <DatePicker
              value={st.period_from}
              onChange={(v) => setSt((s) => ({ ...s, period_from: v }))}
              onCommit={(v) => void persist({ period_from: v })}
            />
          </Labeled>
          <Labeled label={t("filters.to")}>
            <DatePicker
              value={st.period_to}
              onChange={(v) => setSt((s) => ({ ...s, period_to: v }))}
              onCommit={(v) => void persist({ period_to: v })}
            />
          </Labeled>
          <Labeled label={t("filters.basis")}>
            <NativeSelect
              value={st.basis}
              onChange={(e) => {
                const basis = e.target.value as Statement["basis"];
                setSt((s) => ({ ...s, basis }));
                void persist({ basis });
              }}
            >
              <option value="check_in">{t("filters.checkIn")}</option>
              <option value="check_out">{t("filters.checkOut")}</option>
            </NativeSelect>
          </Labeled>
          <Labeled label={t("filters.statuses")}>
            <div className="flex flex-wrap gap-1">
              {STATUS_OPTIONS.map((s) => {
                const on = st.reservation_statuses.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      const next = on
                        ? st.reservation_statuses.filter((x) => x !== s)
                        : [...st.reservation_statuses, s];
                      setSt((prev) => ({ ...prev, reservation_statuses: next }));
                      void persist({ reservation_statuses: next });
                    }}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                      on ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {t(`reservationStatus.${s}`)}
                  </button>
                );
              })}
            </div>
          </Labeled>
        </div>
      )}

      {/* Data */}
      <Section title={t("sections.data")} defaultOpen>
        <div className="grid grid-cols-1 gap-x-10 gap-y-3 lg:grid-cols-2">
          <HeaderField label={t("pm.name")} value={st.header.pm_name} onChange={(v) => patchHeader("pm_name", v)} disabled />
          <HeaderField label={t("owner.name")} value={st.header.owner_name} onChange={(v) => patchHeader("owner_name", v)} disabled />
          <HeaderField label={t("pm.email")} value={st.header.pm_email} onChange={(v) => patchHeader("pm_email", v)} disabled />
          <HeaderField label={t("owner.email")} value={st.header.owner_email} onChange={(v) => patchHeader("owner_email", v)} disabled />
          <HeaderField label={t("pm.phone")} value={st.header.pm_phone} onChange={(v) => patchHeader("pm_phone", v)} disabled />
          <HeaderField label={t("owner.phone")} value={st.header.owner_phone} onChange={(v) => patchHeader("owner_phone", v)} disabled />
          <HeaderField label={t("pm.address")} value={st.header.pm_address} onChange={(v) => patchHeader("pm_address", v)} disabled />
          <HeaderField label={t("owner.address")} value={st.header.owner_address} onChange={(v) => patchHeader("owner_address", v)} disabled />
          <HeaderField label={t("pm.taxId")} value={st.header.pm_tax_id} onChange={(v) => patchHeader("pm_tax_id", v)} disabled />
          <HeaderField label={t("owner.taxId")} value={st.header.owner_tax_id} onChange={(v) => patchHeader("owner_tax_id", v)} disabled />
          <HeaderField label={t("invoiceNumber")} value={st.header.invoice_number} onChange={(v) => patchHeader("invoice_number", v)} disabled={finalized} />
        </div>
        <Labeled label={t("notes")} className="mt-3">
          <Textarea value={st.header.notes ?? ""} disabled={finalized} onChange={(e) => patchHeader("notes", e.target.value || null)} />
        </Labeled>
      </Section>

      {/* Summary */}
      <Section
        title={t("sections.summary")}
        defaultOpen
        right={
          !finalized ? (
            <button type="button" onClick={() => setShowFilters(true)} className="flex items-center gap-1 text-sm text-accent">
              <Icon icon="ph:pencil-simple" className="size-4" />
              {t("edit")}
            </button>
          ) : undefined
        }
      >
        <p className="mb-3 text-sm text-muted-foreground">
          {t("summaryPeriod", { from: st.period_from, to: st.period_to, count: st.summary.booking_count })}
        </p>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCell icon="ph:money" label={t("summary.totalPrice")} value={formatCurrency(st.summary.total_price, cur)} />
          <SummaryCell icon="ph:diamond" label={t("summary.totalPayout")} value={formatCurrency(st.summary.total_payout, cur)} />
          <SummaryCell icon="ph:coins" label={t("summary.ownerPayout")} value={formatCurrency(st.summary.owner_payout, ownerCur)} />
          <SummaryCell icon="ph:buildings" label={t("summary.pmPayout")} value={formatCurrency(st.summary.pm_payout, cur)} />
        </div>
      </Section>

      {/* Rental activity */}
      <RentalActivity statement={st} t={t} currency={cur} />

      {/* Expenses & extras */}
      {/* Expenses brauchen eine gespeicherte Abrechnung (statement_id). */}
      <ExpensesSection
        statement={st}
        properties={properties}
        finalized={finalized || isNew}
        currency={cur}
        onRefresh={refresh}
        t={t}
      />

      {/* Attachments */}
      <Section title={t("sections.attachments")} defaultOpen>
        <div className="flex items-center justify-center rounded-(--radius) border-2 border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t("attachments.drop")}
        </div>
      </Section>

      {/* Grand total */}
      <Section title={t("sections.grandTotal")} defaultOpen>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4">
            <NativeSelect className="w-auto min-w-44" disabled>
              <option>{t("grand.rentalRevenue")}</option>
            </NativeSelect>
            <span className="text-sm">{formatCurrency(st.summary.total_price, cur)}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="min-w-44 text-sm text-muted-foreground">{t("grand.expenses")}</span>
            <span className={`text-sm ${expensesTotal < 0 ? "text-destructive" : ""}`}>
              {formatCurrency(expensesTotal, cur)}
            </span>
          </div>
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between">
            <span className="font-bold">{t("grand.total")}</span>
            <span className="font-display text-xl font-extrabold">{formatCurrency(grandTotal, cur)}</span>
          </div>

          {/* Steueraufschlüsselung (EN 16931) — erst nach Finalisierung gesetzt. */}
          {finalized && (
            <div className="mt-2 flex flex-col gap-2 rounded-(--radius) border border-border p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("tax.net")}</span>
                <span>{formatCurrency(st.tax.net, cur)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("tax.vat")} ({st.tax.rate}% · {t(`tax.category.${st.tax.category}`)})
                </span>
                <span>{formatCurrency(st.tax.tax, cur)}</span>
              </div>
              <div className="flex items-center justify-between font-bold">
                <span>{t("tax.gross")}</span>
                <span>{formatCurrency(st.tax.gross, cur)}</span>
              </div>
              {st.tax.exemption_reason && (
                <p className="text-xs text-muted-foreground">{st.tax.exemption_reason}</p>
              )}
            </div>
          )}
          {!finalized && (
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <Labeled label={t("grand.deductPercentage")} className="w-40">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={st.commission_pct}
                  onChange={(e) => {
                    setCommissionTouched(true);
                    setSt((s) => ({ ...s, commission_pct: Number(e.target.value) }));
                  }}
                  onBlur={() => void persist({ commission_pct: st.commission_pct })}
                />
              </Labeled>
              <Stat label={t("summary.ownerPayout")} value={formatCurrency(st.summary.owner_payout, ownerCur)} />
              <Stat label={t("summary.pmPayout")} value={formatCurrency(st.summary.pm_payout, cur)} />
            </div>
          )}
        </div>
      </Section>

      <StatementPreviewModal
        statement={st}
        open={showPreview}
        onOpenChange={setShowPreview}
      />
    </div>
  );
}

// --- Rental activity ---------------------------------------------------------

function RentalActivity({
  statement,
  t,
  currency,
}: {
  statement: Statement;
  t: ReturnType<typeof useTranslations>;
  currency: string;
}) {
  const [view, setView] = useState<"reservation" | "listing">("reservation");
  const totalNights =
    view === "reservation"
      ? statement.rental_rows.reduce((a, r) => a + r.nights, 0)
      : statement.listing_rows.reduce((a, r) => a + r.nights, 0);

  return (
    <Section
      title={t("sections.rentalActivity")}
      defaultOpen
      right={
        <div className="flex rounded-md bg-secondary p-0.5 text-sm">
          <button
            type="button"
            onClick={() => setView("reservation")}
            className={`rounded px-3 py-1 font-medium transition-colors ${view === "reservation" ? "bg-foreground text-background" : "text-muted-foreground"}`}
          >
            {t("rental.perReservation")}
          </button>
          <button
            type="button"
            onClick={() => setView("listing")}
            className={`rounded px-3 py-1 font-medium transition-colors ${view === "listing" ? "bg-foreground text-background" : "text-muted-foreground"}`}
          >
            {t("rental.perListing")}
          </button>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              {view === "reservation" ? (
                <>
                  <th className="py-2 pr-4 font-medium">{t("rental.guest")}</th>
                  <th className="py-2 pr-4 font-medium">{t("rental.nights")}</th>
                  <th className="py-2 pr-4 font-medium">{t("rental.listing")}</th>
                  <th className="py-2 pr-4 font-medium">{t("rental.channel")}</th>
                  <th className="py-2 pr-4 text-right font-medium">{t("rental.totalPrice")}</th>
                  <th className="py-2 text-right font-medium">{t("rental.totalPayout")}</th>
                </>
              ) : (
                <>
                  <th className="py-2 pr-4 font-medium">{t("rental.listing")}</th>
                  <th className="py-2 pr-4 font-medium">{t("rental.reservations")}</th>
                  <th className="py-2 pr-4 font-medium">{t("rental.nights")}</th>
                  <th className="py-2 pr-4 text-right font-medium">{t("rental.totalPrice")}</th>
                  <th className="py-2 text-right font-medium">{t("rental.totalPayout")}</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {view === "reservation"
              ? statement.rental_rows.map((r) => (
                  <tr key={r.reservation_id} className="border-b border-border">
                    <td className="py-2 pr-4 text-accent">{r.guest ?? "—"}</td>
                    <td className="py-2 pr-4">{r.nights}</td>
                    <td className="py-2 pr-4 text-accent">{r.listing ?? "—"}</td>
                    <td className="py-2 pr-4">
                      <span className="flex items-center gap-1.5 capitalize">
                        <span className={`size-2 rounded-full ${CHANNEL_DOT[r.channel] ?? "bg-muted-foreground"}`} />
                        {r.channel}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right">{formatCurrency(r.total_price, currency)}</td>
                    <td className="py-2 text-right">{formatCurrency(r.total_payout, currency)}</td>
                  </tr>
                ))
              : statement.listing_rows.map((r) => (
                  <tr key={r.listing_id} className="border-b border-border">
                    <td className="py-2 pr-4 text-accent">{r.listing ?? "—"}</td>
                    <td className="py-2 pr-4">{r.reservations}</td>
                    <td className="py-2 pr-4">{r.nights}</td>
                    <td className="py-2 pr-4 text-right">{formatCurrency(r.total_price, currency)}</td>
                    <td className="py-2 text-right">{formatCurrency(r.total_payout, currency)}</td>
                  </tr>
                ))}
            <tr className="font-bold">
              <td className="py-2 pr-4">{t("rental.totals")}</td>
              <td className="py-2 pr-4">{totalNights}</td>
              <td className="py-2 pr-4" />
              {view === "reservation" && <td className="py-2 pr-4" />}
              <td className="py-2 pr-4 text-right">{formatCurrency(statement.summary.total_price, currency)}</td>
              <td className="py-2 text-right">{formatCurrency(statement.summary.total_payout, currency)}</td>
            </tr>
          </tbody>
        </table>
        {statement.rental_rows.length === 0 && (
          <p className="py-4 text-sm text-muted-foreground">{t("rental.empty")}</p>
        )}
      </div>
    </Section>
  );
}

// --- Expenses & extras -------------------------------------------------------

function ExpensesSection({
  statement,
  properties,
  finalized,
  currency,
  onRefresh,
  t,
}: {
  statement: Statement;
  properties: PropOption[];
  finalized: boolean;
  currency: string;
  onRefresh: () => Promise<void>;
  t: ReturnType<typeof useTranslations>;
}) {
  const titleById = new Map(properties.map((p) => [p.id, p.title]));
  const guestByRes = new Map(statement.rental_rows.map((r) => [r.reservation_id, r.guest]));
  const [adding, setAdding] = useState(false);

  async function add(form: {
    concept: string;
    date: string;
    category: string;
    listing_id: string;
    reservation_id: string;
    assign_owner: boolean;
    amount: number;
  }) {
    const res = await addExpense({
      statement_id: statement.id,
      concept: form.concept,
      date: form.date,
      category: form.category || null,
      listing_id: form.listing_id || null,
      reservation_id: form.reservation_id || null,
      owner_id: form.assign_owner ? statement.owner_id : null,
      amount: form.amount,
    });
    if (res.ok) {
      setAdding(false);
      await onRefresh();
      toast.success(t("expenses.added"));
    } else toast.error(res.error);
  }

  async function toggleHidden(e: Expense) {
    const res = await updateExpense(e.id, { hidden_from_owner: !e.hidden_from_owner });
    if (res.ok) await onRefresh();
    else toast.error(res.error);
  }

  async function remove(e: Expense) {
    const res = await deleteExpense(e.id);
    if (res.ok) await onRefresh();
    else toast.error(res.error);
  }

  async function hideAll() {
    await Promise.all(
      statement.expenses
        .filter((e) => !e.hidden_from_owner)
        .map((e) => updateExpense(e.id, { hidden_from_owner: true })),
    );
    await onRefresh();
  }

  return (
    <Section title={t("sections.expenses")} defaultOpen>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <th className="py-2 pr-4 font-medium">{t("expenses.concept")}</th>
              <th className="py-2 pr-4 font-medium">{t("expenses.date")}</th>
              <th className="py-2 pr-4 font-medium">{t("expenses.category")}</th>
              <th className="py-2 pr-4 font-medium">{t("expenses.listing")}</th>
              <th className="py-2 pr-4 font-medium">{t("expenses.reservation")}</th>
              <th className="py-2 pr-4 font-medium">{t("expenses.owner")}</th>
              <th className="py-2 pr-4 text-right font-medium">{t("expenses.amount")}</th>
              <th className="py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {statement.expenses.map((e) => (
              <tr key={e.id} className="border-b border-border">
                <td className="py-2 pr-4">{e.concept}</td>
                <td className="py-2 pr-4">{e.date}</td>
                <td className="py-2 pr-4">{e.category ?? "—"}</td>
                <td className="py-2 pr-4 text-accent">{e.listing_id ? titleById.get(e.listing_id) ?? "—" : "—"}</td>
                <td className="py-2 pr-4 text-accent">
                  {e.reservation_id ? guestByRes.get(e.reservation_id) ?? "—" : "—"}
                </td>
                <td className="py-2 pr-4">{e.owner_id ? statement.header.owner_name ?? "—" : "—"}</td>
                <td className={`py-2 pr-4 text-right font-medium ${e.amount < 0 ? "text-destructive" : ""}`}>
                  {formatCurrency(e.amount, currency)}
                </td>
                <td className="py-2">
                  {!finalized && (
                    <div className="flex items-center justify-end gap-2 text-muted-foreground">
                      <Icon icon="ph:paperclip" className="size-4" />
                      <button type="button" onClick={() => void toggleHidden(e)} aria-label={t("expenses.toggleHidden")} title={e.hidden_from_owner ? t("expenses.hidden") : t("expenses.visible")} className="hover:text-foreground">
                        <Icon icon={e.hidden_from_owner ? "ph:eye-slash" : "ph:eye"} className="size-4" />
                      </button>
                      <button type="button" onClick={() => void remove(e)} aria-label={t("delete")} className="hover:text-destructive">
                        <Icon icon="ph:trash" className="size-4" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {statement.expenses.length > 0 && (
              <tr className="font-bold">
                <td className="py-2 pr-4" colSpan={6}>{t("expenses.total")}</td>
                <td className="py-2 pr-4 text-right text-destructive">{formatCurrency(statement.summary.expenses_total, currency)}</td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
        {statement.expenses.length === 0 && (
          <p className="py-4 text-sm text-muted-foreground">{t("expenses.empty")}</p>
        )}
      </div>

      {!finalized && (
        <div className="mt-3 flex items-center justify-end gap-4 text-sm">
          {statement.expenses.some((e) => !e.hidden_from_owner) && (
            <button type="button" onClick={() => void hideAll()} className="text-accent">
              {t("expenses.hideAll")}
            </button>
          )}
          <Button variant="outline" size="sm" onClick={() => setAdding((v) => !v)}>
            <Icon icon="ph:plus" className="size-4" />
            {t("expenses.add")}
          </Button>
        </div>
      )}

      {adding && (
        <AddExpenseForm
          properties={properties}
          reservations={statement.rental_rows.map((r) => ({ id: r.reservation_id, label: r.guest ?? r.reservation_id }))}
          onAdd={add}
          onCancel={() => setAdding(false)}
          t={t}
        />
      )}
    </Section>
  );
}

function AddExpenseForm({
  properties,
  reservations,
  onAdd,
  onCancel,
  t,
}: {
  properties: PropOption[];
  reservations: { id: string; label: string }[];
  onAdd: (f: {
    concept: string;
    date: string;
    category: string;
    listing_id: string;
    reservation_id: string;
    assign_owner: boolean;
    amount: number;
  }) => void;
  onCancel: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [concept, setConcept] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState("Cleaning");
  const [listingId, setListingId] = useState("");
  const [reservationId, setReservationId] = useState("");
  const [assignOwner, setAssignOwner] = useState(false);
  const [amount, setAmount] = useState("-0");

  return (
    <div className="mt-3 grid grid-cols-1 gap-3 rounded-(--radius) border border-border p-4 sm:grid-cols-6">
      <Labeled label={t("expenses.concept")} className="sm:col-span-2">
        <Input value={concept} onChange={(e) => setConcept(e.target.value)} />
      </Labeled>
      <Labeled label={t("expenses.date")}>
        <DatePicker value={date} onChange={setDate} />
      </Labeled>
      <Labeled label={t("expenses.category")}>
        <NativeSelect value={category} onChange={(e) => setCategory(e.target.value)}>
          {EXPENSE_CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
        </NativeSelect>
      </Labeled>
      <Labeled label={t("expenses.listing")}>
        <NativeSelect value={listingId} onChange={(e) => setListingId(e.target.value)}>
          <option value="">—</option>
          {properties.map((p) => (<option key={p.id} value={p.id}>{p.title}</option>))}
        </NativeSelect>
      </Labeled>
      <Labeled label={t("expenses.amount")}>
        <Input type="number" step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Labeled>
      <Labeled label={t("expenses.reservation")}>
        <NativeSelect value={reservationId} onChange={(e) => setReservationId(e.target.value)}>
          <option value="">—</option>
          {reservations.map((r) => (<option key={r.id} value={r.id}>{r.label}</option>))}
        </NativeSelect>
      </Labeled>
      <label className="flex items-end gap-2 pb-2 text-sm">
        <input type="checkbox" checked={assignOwner} onChange={(e) => setAssignOwner(e.target.checked)} />
        {t("expenses.assignOwner")}
      </label>
      <div className="flex items-end gap-2 sm:col-span-6">
        <Button
          size="sm"
          onClick={() => onAdd({ concept, date, category, listing_id: listingId, reservation_id: reservationId, assign_owner: assignOwner, amount: Number(amount) })}
          disabled={!concept.trim()}
        >
          {t("expenses.add")}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>{t("cancel")}</Button>
      </div>
    </div>
  );
}

// --- Bausteine ---------------------------------------------------------------

function Section({
  title,
  children,
  right,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-border pb-5">
      <div className="flex items-center justify-between gap-4 py-3">
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center gap-2">
          <h2 className="font-display text-lg font-extrabold">{title}</h2>
          <Icon icon={open ? "ph:caret-up" : "ph:caret-down"} className="size-4 text-muted-foreground" />
        </button>
        {right}
      </div>
      {open && children}
    </section>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-secondary px-2.5 py-1 text-muted-foreground">{children}</span>;
}

function Labeled({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`flex flex-col gap-1 ${className ?? ""}`}>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function HeaderField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-40 shrink-0 text-sm text-muted-foreground">{label}</span>
      <Input value={value ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value || null)} />
    </div>
  );
}

function SummaryCell({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Icon icon={icon} className="size-4 text-accent" />
        {label}
      </span>
      <span className="font-display text-2xl font-extrabold">{value}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-lg font-bold">{value}</span>
    </div>
  );
}
