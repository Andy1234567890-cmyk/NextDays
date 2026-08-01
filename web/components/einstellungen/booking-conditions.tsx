"use client";

// Konditionen (Buchungsbedingungen) — Liste + Erstellen/Bearbeiten-Sheet.
// 1:1 nach dem Lodgify-Modell: eine Kondition bündelt Zahlungsplan, Storno und
// Kaution als wiederverwendbare Vorlage. Sensible Finanzdaten: die neuen Tabellen
// sind gegen den anon-Direktpfad gesperrt (revoke), daher KEIN Realtime-Abo hier —
// die Liste wird nach eigenen Mutationen inkrementell im State aktualisiert.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@nextdays/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@nextdays/ui/sheet";
import { currencySymbol } from "@/lib/currency";
import {
  type BookingCondition,
  type BookingConditionInput,
  type RefundRule,
  createBookingCondition,
  deleteBookingCondition,
  setDefaultBookingCondition,
  updateBookingCondition,
} from "@/lib/booking-conditions";

// Häufige Kautions-Währungen für die Vorlage (die echte Währung beim Anwenden
// kommt aus dem Objekt — properties.currency). Reihenfolge wie im Lodgify-Editor.
const DEPOSIT_CURRENCIES = [
  "EUR", "USD", "GBP", "DKK", "SEK", "NOK", "CHF", "CZK", "PLN", "HUF",
  "RON", "BGN", "AUD", "CAD", "JPY",
];

// Leere Vorlage für eine neue Kondition (Defaults wie im Backend-Schema).
function emptyInput(): BookingConditionInput {
  return {
    internal_name: "",
    is_default: false,
    installments: 1,
    first_payment_amount_type: "percent",
    first_payment_percent: 100,
    first_payment_timing: "on_booking",
    first_payment_days: null,
    balance_timing: "days_before_arrival",
    balance_days_before_arrival: null,
    third_payment_percent: null,
    third_payment_days_before: null,
    cancellation_mode: "non_refundable",
    refund_rules: [],
    deposit_required: false,
    deposit_method: "preauth",
    deposit_amount_type: "absolute",
    deposit_amount: null,
    deposit_currency: null,
    preauth_days_before_arrival: null,
    release_days_after_departure: null,
    quote_validity_hours: 24,
  };
}

function toInput(c: BookingCondition): BookingConditionInput {
  const { id: _id, tenant_id: _t, ...rest } = c;
  return rest;
}

// Kurzbeschreibungen für die Listenspalten (verdichtete Zusammenfassung).
type T = ReturnType<typeof useTranslations>;

function paymentSummary(c: BookingCondition, t: T): string {
  if (c.installments === 1) return t("bookingConditions.summaryOnePayment");
  const first = c.first_payment_percent ?? 0;
  const when =
    c.first_payment_timing === "on_booking"
      ? t("bookingConditions.onBooking")
      : t("bookingConditions.summaryDaysBefore", { days: c.first_payment_days ?? 0 });
  const balance =
    c.balance_days_before_arrival != null
      ? t("bookingConditions.summaryBalance", { days: c.balance_days_before_arrival })
      : "";
  return `${first}% ${when}${balance}`;
}

function cancellationSummary(c: BookingCondition, t: T): string {
  if (c.cancellation_mode === "non_refundable") return t("bookingConditions.nonRefundable");
  if (c.cancellation_mode === "refundable") return t("bookingConditions.refundable");
  const tiers = c.refund_rules
    .map((r) => `${r.refund_percent}% ≥ ${r.days_before_arrival} T`)
    .join(", ");
  return `${t("bookingConditions.summaryPartial")}${tiers ? ` (${tiers})` : ""}`;
}

function depositSummary(c: BookingCondition, t: T): string {
  if (!c.deposit_required) return t("bookingConditions.summaryNoDeposit");
  let amount = "";
  if (c.deposit_amount != null) {
    amount =
      c.deposit_amount_type === "percent"
        ? `${c.deposit_amount}%`
        : `${c.deposit_currency ? currencySymbol(c.deposit_currency) : ""}${c.deposit_amount}`;
  }
  const method =
    c.deposit_method === "manual"
      ? t("bookingConditions.summaryManual")
      : t("bookingConditions.summaryPreauth");
  return `${method} ${amount}`.trim();
}

export function BookingConditionsManager({
  initial,
}: {
  initial: BookingCondition[];
}) {
  const t = useTranslations("settings");
  const [conditions, setConditions] = useState<BookingCondition[]>(initial);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<BookingCondition | null>(null);
  const [pending, startTransition] = useTransition();

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(c: BookingCondition) {
    setEditing(c);
    setSheetOpen(true);
  }

  function handleSaved(saved: BookingCondition) {
    setConditions((prev) => {
      // Standard ist tenant-weit eindeutig → beim Setzen die anderen entmarkieren.
      const cleared = saved.is_default
        ? prev.map((c) => ({ ...c, is_default: false }))
        : prev;
      const exists = cleared.some((c) => c.id === saved.id);
      return exists
        ? cleared.map((c) => (c.id === saved.id ? saved : c))
        : [...cleared, saved];
    });
    setSheetOpen(false);
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await deleteBookingCondition(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setConditions((prev) => prev.filter((c) => c.id !== id));
      toast.success(t("bookingConditions.deleted"));
    });
  }

  function handleSetDefault(id: string) {
    startTransition(async () => {
      const res = await setDefaultBookingCondition(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setConditions((prev) =>
        prev.map((c) => ({ ...c, is_default: c.id === id })),
      );
      toast.success(t("bookingConditions.markedDefault"));
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("bookingConditions.title")}</h2>
        <Button onClick={openCreate} className="rounded-full">
          <Icon icon="ph:plus" className="size-4" />
          {t("bookingConditions.create")}
        </Button>
      </div>

      {conditions.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          {t("bookingConditions.empty")}
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4 font-medium">{t("bookingConditions.colName")}</th>
                <th className="py-2 pr-4 font-medium">{t("bookingConditions.colPaymentPlan")}</th>
                <th className="py-2 pr-4 font-medium">{t("bookingConditions.colCancellation")}</th>
                <th className="py-2 pr-4 font-medium">{t("bookingConditions.colDeposit")}</th>
                <th className="py-2 pr-4 font-medium">{t("bookingConditions.colValidity")}</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {conditions.map((c) => (
                <tr key={c.id} className="border-b border-border align-top">
                  <td className="py-3 pr-4 font-medium">
                    <span className="flex items-center gap-1.5">
                      {c.is_default && (
                        <Icon
                          icon="ph:star-fill"
                          className="size-3.5 text-amber-500"
                          aria-label={t("bookingConditions.defaultBadge")}
                        />
                      )}
                      {c.internal_name}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {paymentSummary(c, t)}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {cancellationSummary(c, t)}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {depositSummary(c, t)}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {c.quote_validity_hours != null
                      ? `${c.quote_validity_hours} h`
                      : "—"}
                  </td>
                  <td className="py-3 text-right">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="rounded-(--radius) p-1.5 text-muted-foreground hover:bg-secondary"
                          aria-label={t("bookingConditions.actions")}
                        >
                          <Icon icon="ph:dots-three" className="size-5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-56 p-1">
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          className="flex w-full items-center gap-2 rounded-(--radius) px-2 py-2 text-left text-sm hover:bg-secondary"
                        >
                          <Icon icon="ph:pencil-simple" className="size-4" />
                          {t("bookingConditions.edit")}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetDefault(c.id)}
                          disabled={pending || c.is_default}
                          className="flex w-full items-center gap-2 rounded-(--radius) px-2 py-2 text-left text-sm hover:bg-secondary disabled:opacity-50"
                        >
                          <Icon icon="ph:star" className="size-4" />
                          {t("bookingConditions.markDefault")}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c.id)}
                          disabled={pending}
                          className="flex w-full items-center gap-2 rounded-(--radius) px-2 py-2 text-left text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
                        >
                          <Icon icon="ph:trash" className="size-4" />
                          {t("bookingConditions.delete")}
                        </button>
                      </PopoverContent>
                    </Popover>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {editing ? t("bookingConditions.update") : t("bookingConditions.create")}
            </SheetTitle>
          </SheetHeader>
          <ConditionForm
            initial={editing ? toInput(editing) : emptyInput()}
            editingId={editing?.id ?? null}
            onSaved={handleSaved}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

// -- Formular (Zahlungsplan / Storno-Regeln / Kaution / Gültigkeit) -----------
function ConditionForm({
  initial,
  editingId,
  onSaved,
}: {
  initial: BookingConditionInput;
  editingId: string | null;
  onSaved: (c: BookingCondition) => void;
}) {
  const t = useTranslations("settings");
  const [form, setForm] = useState<BookingConditionInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof BookingConditionInput>(
    key: K,
    value: BookingConditionInput[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addRefundRule() {
    set("refund_rules", [
      ...form.refund_rules,
      { refund_percent: 50, days_before_arrival: 0 },
    ]);
  }

  function updateRefundRule(i: number, rule: RefundRule) {
    set(
      "refund_rules",
      form.refund_rules.map((r, j) => (j === i ? rule : r)),
    );
  }

  function removeRefundRule(i: number) {
    set(
      "refund_rules",
      form.refund_rules.filter((_, j) => j !== i),
    );
  }

  function save() {
    if (!form.internal_name.trim()) {
      setError(t("bookingConditions.nameRequired"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = editingId
        ? await updateBookingCondition(editingId, form)
        : await createBookingCondition(form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onSaved(res.data);
    });
  }

  return (
    <div className="flex flex-col gap-6 px-4 pb-8">
      {/* Interner Name */}
      <Field label={t("bookingConditions.internalName")} required>
        <Input
          value={form.internal_name}
          onChange={(e) => set("internal_name", e.target.value)}
          placeholder={t("bookingConditions.internalNamePlaceholder")}
        />
      </Field>

      {/* Zahlungsplan */}
      <Section title={t("bookingConditions.paymentPlan")}>
        <NativeSelect
          value={String(form.installments)}
          onChange={(e) =>
            set("installments", Number(e.target.value) as 1 | 2 | 3)
          }
        >
          <option value="1">{t("bookingConditions.installments1")}</option>
          <option value="2">{t("bookingConditions.installments2")}</option>
          <option value="3">{t("bookingConditions.installments3")}</option>
        </NativeSelect>

        {form.installments === 1 && (
          <Hint>{t("bookingConditions.fullOnBooking")}</Hint>
        )}

        {form.installments >= 2 && (
          <>
            <SubLabel>{t("bookingConditions.firstPayment")}</SubLabel>
            <div className="grid grid-cols-2 gap-2">
              <PercentInput
                value={form.first_payment_percent}
                onChange={(v) => set("first_payment_percent", v)}
              />
              <NativeSelect
                value={form.first_payment_amount_type}
                onChange={(e) =>
                  set(
                    "first_payment_amount_type",
                    e.target.value as "percent" | "absolute",
                  )
                }
              >
                <option value="percent">{t("bookingConditions.percentOfTotal")}</option>
                <option value="absolute">{t("bookingConditions.absoluteAmount")}</option>
              </NativeSelect>
            </div>
            <NativeSelect
              value={form.first_payment_timing}
              onChange={(e) =>
                set(
                  "first_payment_timing",
                  e.target.value as "on_booking" | "days_before_arrival",
                )
              }
            >
              <option value="on_booking">{t("bookingConditions.onBooking")}</option>
              <option value="days_before_arrival">{t("bookingConditions.daysBeforeArrival")}</option>
            </NativeSelect>
            {form.first_payment_timing === "days_before_arrival" && (
              <NumberInput
                label={t("bookingConditions.daysBeforeArrival")}
                value={form.first_payment_days}
                onChange={(v) => set("first_payment_days", v)}
              />
            )}
            <Hint>{t("bookingConditions.firstPaymentHint")}</Hint>

            <SubLabel>{t("bookingConditions.secondPayment")}</SubLabel>
            <div className="grid grid-cols-2 gap-2">
              <NumberInput
                label={t("bookingConditions.dayCount")}
                value={form.balance_days_before_arrival}
                onChange={(v) => set("balance_days_before_arrival", v)}
              />
              <NativeSelect
                value={form.balance_timing}
                onChange={(e) =>
                  set(
                    "balance_timing",
                    e.target.value as
                      | "days_before_arrival"
                      | "days_after_arrival"
                      | "days_before_departure"
                      | "not_scheduled",
                  )
                }
              >
                <option value="days_before_arrival">{t("bookingConditions.daysBeforeCheckIn")}</option>
                <option value="days_after_arrival">{t("bookingConditions.daysAfterArrival")}</option>
                <option value="days_before_departure">{t("bookingConditions.daysBeforeDeparture")}</option>
                <option value="not_scheduled">{t("bookingConditions.notScheduled")}</option>
              </NativeSelect>
            </div>
            <Hint>{t("bookingConditions.balanceHint")}</Hint>
          </>
        )}

        {form.installments === 3 && (
          <>
            <SubLabel>{t("bookingConditions.thirdPayment")}</SubLabel>
            <div className="grid grid-cols-2 gap-2">
              <PercentInput
                value={form.third_payment_percent}
                onChange={(v) => set("third_payment_percent", v)}
              />
              <NumberInput
                label={t("bookingConditions.daysBeforeArrival")}
                value={form.third_payment_days_before}
                onChange={(v) => set("third_payment_days_before", v)}
              />
            </div>
          </>
        )}
      </Section>

      {/* Gast-Stornierung */}
      <Section title={t("bookingConditions.guestCancellation")}>
        <NativeSelect
          value={form.cancellation_mode}
          onChange={(e) =>
            set(
              "cancellation_mode",
              e.target.value as "non_refundable" | "refundable" | "partial",
            )
          }
        >
          <option value="non_refundable">{t("bookingConditions.nonRefundable")}</option>
          <option value="refundable">{t("bookingConditions.refundable")}</option>
          <option value="partial">{t("bookingConditions.partialRefundable")}</option>
        </NativeSelect>

        {form.cancellation_mode === "partial" && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              {t("bookingConditions.refundRulesHint")}
            </p>
            {form.refund_rules.map((rule, i) => (
              <div
                key={i}
                className="flex items-end gap-2 rounded-(--radius) border border-border p-2"
              >
                <div className="flex-1">
                  <SubLabel>{t("bookingConditions.refund")}</SubLabel>
                  <PercentInput
                    value={rule.refund_percent}
                    onChange={(v) =>
                      updateRefundRule(i, { ...rule, refund_percent: v ?? 0 })
                    }
                  />
                </div>
                <div className="flex-1">
                  <SubLabel>{t("bookingConditions.daysBeforeArrival")}</SubLabel>
                  <NumberInput
                    label={t("bookingConditions.daysBeforeArrival")}
                    value={rule.days_before_arrival}
                    onChange={(v) =>
                      updateRefundRule(i, {
                        ...rule,
                        days_before_arrival: v ?? 0,
                      })
                    }
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeRefundRule(i)}
                  className="pb-2 text-muted-foreground hover:text-destructive"
                  aria-label={t("bookingConditions.removeRule")}
                >
                  <Icon icon="ph:trash" className="size-4" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={addRefundRule}
              className="rounded-full self-start"
            >
              <Icon icon="ph:plus" className="size-4" />
              {t("bookingConditions.addRule")}
            </Button>
          </div>
        )}
      </Section>

      {/* Kaution (optional) */}
      <Section title={t("bookingConditions.deposit")}>
        <NativeSelect
          value={form.deposit_required ? "yes" : "no"}
          onChange={(e) => set("deposit_required", e.target.value === "yes")}
        >
          <option value="no">{t("bookingConditions.depositNotRequired")}</option>
          <option value="yes">{t("bookingConditions.depositRequired")}</option>
        </NativeSelect>

        {form.deposit_required && (
          <>
            {/* 1. Methode */}
            <SubLabel>{t("bookingConditions.depositStep1")}</SubLabel>
            <NativeSelect
              value={form.deposit_method}
              onChange={(e) =>
                set("deposit_method", e.target.value as "preauth" | "manual")
              }
            >
              <option value="preauth">{t("bookingConditions.depositPreauth")}</option>
              <option value="manual">{t("bookingConditions.depositManual")}</option>
            </NativeSelect>
            <Hint>
              {form.deposit_method === "preauth"
                ? t("bookingConditions.depositPreauthHint")
                : t("bookingConditions.depositManualHint")}
            </Hint>

            {/* 2. Betrag */}
            <SubLabel>{t("bookingConditions.depositStep2")}</SubLabel>
            {/* Währung: Vorgabe der Vorlage; beim Anwenden gilt die Objekt-
                währung (properties.currency), kein €-Default (Wurzel 4). */}
            <div className="grid grid-cols-3 gap-2">
              <NativeSelect
                value={form.deposit_currency ?? ""}
                onChange={(e) =>
                  set("deposit_currency", e.target.value || null)
                }
              >
                <option value="">{t("bookingConditions.currency")}</option>
                {DEPOSIT_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </NativeSelect>
              <NumberInput
                label={t("bookingConditions.amount")}
                value={form.deposit_amount}
                onChange={(v) => set("deposit_amount", v)}
              />
              <NativeSelect
                value={form.deposit_amount_type}
                onChange={(e) =>
                  set(
                    "deposit_amount_type",
                    e.target.value as "absolute" | "percent",
                  )
                }
              >
                <option value="absolute">{t("bookingConditions.absoluteAmount")}</option>
                <option value="percent">{t("bookingConditions.percentOfTotal")}</option>
              </NativeSelect>
            </div>

            {/* 3. Zeiten (nur bei Vorautorisierung relevant) */}
            {form.deposit_method === "preauth" && (
              <>
                <SubLabel>{t("bookingConditions.depositStep3")}</SubLabel>
                <Hint>{t("bookingConditions.preauthFromHint")}</Hint>
                <div className="grid grid-cols-2 gap-2">
                  <NumberInput
                    label={t("bookingConditions.days")}
                    value={form.preauth_days_before_arrival}
                    onChange={(v) => set("preauth_days_before_arrival", v)}
                  />
                  <NativeSelect value="before_arrival" disabled>
                    <option value="before_arrival">{t("bookingConditions.daysBeforeCheckIn")}</option>
                  </NativeSelect>
                </div>
                <Hint>{t("bookingConditions.preauthUntilHint")}</Hint>
                <NumberInput
                  label={t("bookingConditions.releaseDays")}
                  value={form.release_days_after_departure}
                  onChange={(v) => set("release_days_after_departure", v)}
                />
                <p className="rounded-(--radius) bg-muted/50 p-2 text-xs text-muted-foreground">
                  <strong>{t("bookingConditions.preauthWarnStrong")}</strong>{" "}
                  {t("bookingConditions.preauthWarnRest")}
                </p>
              </>
            )}
          </>
        )}
      </Section>

      {/* Gültigkeit des Angebots */}
      <Section title={t("bookingConditions.quoteValidity")}>
        <div className="relative">
          <NumberInput
            label={t("bookingConditions.hours")}
            value={form.quote_validity_hours}
            onChange={(v) => set("quote_validity_hours", v)}
          />
        </div>
        <Hint>{t("bookingConditions.quoteValidityHint")}</Hint>
      </Section>

      {/* Standard */}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.is_default}
          onChange={(e) => set("is_default", e.target.checked)}
        />
        {t("bookingConditions.useAsDefault")}
      </label>

      {error && (
        <p className="rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button onClick={save} disabled={pending} className="rounded-full">
        {pending
          ? t("bookingConditions.saving")
          : editingId
            ? t("bookingConditions.save")
            : t("bookingConditions.add")}
      </Button>
    </div>
  );
}

// -- kleine Formular-Bausteine ------------------------------------------------
function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>
      {children}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mt-1 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

// Erklärender Subtext unter einem Feld (wie in Lodgify unter jeder Option).
function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

function PercentInput({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <Input
        type="number"
        min={0}
        max={100}
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
        placeholder={placeholder ?? "%"}
        disabled={disabled}
        className="pr-8"
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        %
      </span>
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <Input
      type="number"
      min={0}
      value={value ?? ""}
      onChange={(e) =>
        onChange(e.target.value === "" ? null : Number(e.target.value))
      }
      placeholder={label}
      aria-label={label}
    />
  );
}
