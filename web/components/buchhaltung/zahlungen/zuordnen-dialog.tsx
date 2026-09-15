"use client";

// Zuordnen-Dialog: ein Bankumsatz ↔ eine offene Rechnung. Lädt Vorschläge
// (Betrag, Nummer im Verwendungszweck, Kundenname), zeigt die Differenz und
// verlangt bei Differenz einen Grund, wenn die Rechnung als erledigt gelten
// soll. Beträge rechnet der Server — hier nur Anzeige und Auswahl.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@nextdays/ui/dialog";
import { InfoHinweis } from "@nextdays/ui/info-hinweis";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Skeleton } from "@nextdays/ui/skeleton";
import {
  createTransactionLink,
  getSuggestions,
  listBookingAccounts,
} from "@/lib/buchhaltung-zahlungen";
import {
  DIFFERENCE_REASONS,
  type BankTransaction,
  type BookingAccount,
  type Suggestion,
  type TransactionLink,
} from "@/lib/buchhaltung-zahlungen-typen";

import { formatBetrag, formatDatum } from "./format";

type Props = {
  transaction: BankTransaction | null;
  onClose: () => void;
  onLinked?: (link: TransactionLink) => void;
};

/** Was von der Zahlung auf die Rechnung geht und was offen bleibt. Als
 *  Funktion, damit der Dialog nur noch zeichnet. */
function rechnen(
  transaction: BankTransaction | null,
  selected: Suggestion | null,
  amount: string,
): { allocated: number; difference: number | null; brauchtGrund: boolean } {
  const remaining = transaction ? Math.abs(Number(transaction.remainingAmount)) : 0;
  const offen = selected ? Number(selected.amountOpen) : null;
  const vorgabe = offen !== null ? Math.min(offen, remaining) : remaining;
  const allocated = amount.trim() ? Number(amount) : vorgabe;
  const difference = offen !== null && Number.isFinite(allocated) ? offen - allocated : null;
  return { allocated, difference, brauchtGrund: difference !== null && difference < 0 };
}

export function ZuordnenDialog({ transaction, onClose, onLinked }: Props) {
  const t = useTranslations("finance");
  const locale = useLocale();
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [bookingAccounts, setBookingAccounts] = useState<BookingAccount[]>([]);
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const [manualInvoiceId, setManualInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [reasonKey, setReasonKey] = useState<string>("");
  const [reasonText, setReasonText] = useState("");
  const [bookingAccountId, setBookingAccountId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = transaction !== null;

  useEffect(() => {
    if (!transaction) return;
    setSuggestions(null);
    setSelected(null);
    setManualInvoiceId("");
    setAmount("");
    setReasonKey("");
    setReasonText("");
    setError(null);
    let aktiv = true;
    void (async () => {
      const [s, b] = await Promise.all([getSuggestions(transaction.id), listBookingAccounts()]);
      if (!aktiv) return;
      if (s.ok) {
        setSuggestions(s.data);
        if (s.data.length === 1) setSelected(s.data[0]);
      } else {
        setSuggestions([]);
        setError(s.error);
      }
      setBookingAccounts(b.ok ? b.data : []);
    })();
    return () => {
      aktiv = false;
    };
  }, [transaction]);

  const zahlen = useMemo(() => rechnen(transaction, selected, amount), [transaction, selected, amount]);
  const { allocated, difference, brauchtGrund } = zahlen;
  const currency = transaction?.currency ?? "";

  async function speichern() {
    if (!transaction) return;
    const documentId = selected?.invoiceId ?? manualInvoiceId.trim();
    if (!documentId) {
      setError(t("zahlungenZuordnen.errorNoInvoice"));
      return;
    }
    const grund =
      reasonKey === "other"
        ? reasonText.trim()
        : reasonKey
          ? t(`zahlungenZuordnen.reason.${reasonKey}`)
          : "";
    if (brauchtGrund && !grund) {
      setError(t("zahlungenZuordnen.errorReasonRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    const konto = bookingAccounts.find((b) => b.id === bookingAccountId);
    const res = await createTransactionLink({
      transactionId: transaction.id,
      documentType: "INVOICE",
      documentId,
      amountAllocated: amount.trim() ? amount.trim() : null,
      amountDifferenceReason: grund || null,
      bookingAccount: konto ? { id: konto.id, number: konto.number, name: konto.name, type: konto.type } : null,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.success(t("zahlungenZuordnen.linked", { number: res.data.documentNumber || documentId }));
    onLinked?.(res.data);
    onClose();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>{t("zahlungenZuordnen.title")}</DialogTitle>
        <DialogDescription>{t("zahlungenZuordnen.description")}</DialogDescription>

        <UmsatzKopf transaction={transaction} currency={currency} locale={locale} />

        <Vorschlaege
          suggestions={suggestions}
          selected={selected}
          setSelected={setSelected}
          manualInvoiceId={manualInvoiceId}
          setManualInvoiceId={setManualInvoiceId}
          locale={locale}
        />

        <BetragUndDifferenz
          amount={amount}
          setAmount={setAmount}
          allocated={allocated}
          difference={difference}
          currency={currency}
          locale={locale}
        />

        <DifferenzGrund
          difference={difference}
          reasonKey={reasonKey}
          setReasonKey={setReasonKey}
          reasonText={reasonText}
          setReasonText={setReasonText}
        />

        <BuchungskontoWahl
          konten={bookingAccounts}
          wert={bookingAccountId}
          setWert={setBookingAccountId}
        />

        {error && (
          <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
            <Icon icon="ph:warning-circle" className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {t("zahlungenZuordnen.cancel")}
          </Button>
          <Button variant="accent" onClick={speichern} disabled={busy || !transaction}>
            {busy && <Icon icon="ph:spinner" className="size-4 animate-spin" />}
            {t("zahlungenZuordnen.confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Die Vorschläge des Abgleichs plus die Eingabe von Hand. */
function Vorschlaege({
  suggestions,
  selected,
  setSelected,
  manualInvoiceId,
  setManualInvoiceId,
  locale,
}: {
  suggestions: Suggestion[] | null;
  selected: Suggestion | null;
  setSelected: (s: Suggestion | null) => void;
  manualInvoiceId: string;
  setManualInvoiceId: (v: string) => void;
  locale: string;
}) {
  const t = useTranslations("finance");
  return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Label>{t("zahlungenZuordnen.suggestions")}</Label>
          <InfoHinweis
            ariaLabel={t("zahlungenZuordnen.suggestionsHintAria")}
            text={t("zahlungenZuordnen.suggestionsHint")}
          />
        </div>
        {suggestions === null ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : suggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("zahlungenZuordnen.noSuggestions")}</p>
        ) : (
          <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
            {suggestions.map((s) => {
              const aktiv = selected?.invoiceId === s.invoiceId;
              return (
                <li key={s.invoiceId}>
                  <button
                    type="button"
                    onClick={() => setSelected(aktiv ? null : s)}
                    className={`flex w-full items-center justify-between gap-3 rounded-(--radius) border px-3 py-2 text-left text-sm transition-colors ${
                      aktiv ? "border-accent bg-accent/10" : "border-border hover:bg-secondary/50"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {s.invoiceNumber || t("zahlungenZuordnen.draftLabel")} · {s.customerName || "—"}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {t("zahlungenZuordnen.dueOn", { date: formatDatum(s.dueDate, locale) })} ·{" "}
                        {s.reasons.map((r) => t(`zahlungenZuordnen.match.${r}`)).join(", ")}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold">{formatBetrag(s.amountOpen, s.currency, locale)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {!selected && (
          <div className="flex flex-col gap-1">
            <Label htmlFor="manual-invoice">{t("zahlungenZuordnen.manualInvoiceId")}</Label>
            <Input
              id="manual-invoice"
              value={manualInvoiceId}
              onChange={(e) => setManualInvoiceId(e.target.value)}
              placeholder={t("zahlungenZuordnen.manualInvoicePlaceholder")}
            />
          </div>
        )}
      </div>

  );
}

/** Der Grund einer Differenz. Ohne Differenz gibt es hier nichts zu wählen;
 *  mit Differenz ist der Grund Pflicht (sonst bleibt später unklar, warum). */
function DifferenzGrund({
  difference,
  reasonKey,
  setReasonKey,
  reasonText,
  setReasonText,
}: {
  difference: number | null;
  reasonKey: string;
  setReasonKey: (v: string) => void;
  reasonText: string;
  setReasonText: (v: string) => void;
}) {
  const t = useTranslations("finance");
  if (difference === null || difference === 0) return null;
  return (
              <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Label htmlFor="reason">{t("zahlungenZuordnen.reasonLabel")}</Label>
              <InfoHinweis
                ariaLabel={t("zahlungenZuordnen.reasonHintAria")}
                text={t("zahlungenZuordnen.reasonHint")}
              />
            </div>
            <NativeSelect id="reason" value={reasonKey} onChange={(e) => setReasonKey(e.target.value)}>
              <option value="">{t("zahlungenZuordnen.reasonNone")}</option>
              {DIFFERENCE_REASONS.map((k) => (
                <option key={k} value={k}>
                  {t(`zahlungenZuordnen.reason.${k}`)}
                </option>
              ))}
            </NativeSelect>
          </div>
          {reasonKey === "other" && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="reason-text">{t("zahlungenZuordnen.reasonText")}</Label>
              <Input id="reason-text" value={reasonText} onChange={(e) => setReasonText(e.target.value)} />
            </div>
          )}
    </div>
  );
}

/** Zugeordneter Betrag und die daraus folgende Differenz. */
function BetragUndDifferenz({
  amount,
  setAmount,
  allocated,
  difference,
  currency,
  locale,
}: {
  amount: string;
  setAmount: (v: string) => void;
  allocated: number;
  difference: number | null;
  currency: string;
  locale: string;
}) {
  const t = useTranslations("finance");
  return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Label htmlFor="alloc">{t("zahlungenZuordnen.amountAllocated")}</Label>
            <InfoHinweis
              ariaLabel={t("zahlungenZuordnen.amountAllocatedHintAria")}
              text={t("zahlungenZuordnen.amountAllocatedHint")}
            />
          </div>
          <Input
            id="alloc"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={Number.isFinite(allocated) ? allocated.toFixed(2) : ""}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label>{t("zahlungenZuordnen.difference")}</Label>
          <p className={`flex h-10 items-center text-sm font-medium ${difference && difference !== 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
            {difference === null ? "—" : formatBetrag(difference, currency, locale)}
          </p>
        </div>
      </div>
  );
}

/** Optionales Buchungskonto für die Zuordnung. */
function BuchungskontoWahl({
  konten,
  wert,
  setWert,
}: {
  konten: BookingAccount[];
  wert: string;
  setWert: (v: string) => void;
}) {
  const t = useTranslations("finance");
  if (konten.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="booking-account">{t("zahlungenZuordnen.bookingAccount")}</Label>
      <NativeSelect id="booking-account" value={wert} onChange={(e) => setWert(e.target.value)}>
        <option value="">{t("zahlungenZuordnen.bookingAccountNone")}</option>
        {konten.map((b) => (
          <option key={b.id} value={b.id}>
            {b.number} · {b.name}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

/** Der Umsatz, um den es geht: Gegenseite, Betrag, Zweck, Datum. */
function UmsatzKopf({
  transaction,
  currency,
  locale,
}: {
  transaction: BankTransaction | null;
  currency: string;
  locale: string;
}) {
  const t = useTranslations("finance");
  if (!transaction) return null;
  return (
              <div className="rounded-(--radius) border border-border bg-muted/40 p-3 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium">{transaction.counterpartName || "—"}</span>
            <span className={`font-semibold ${Number(transaction.amount) < 0 ? "text-destructive" : "text-accent"}`}>
              {formatBetrag(transaction.amount, currency, locale)}
            </span>
          </div>
          <p className="mt-1 text-muted-foreground">{transaction.purpose || "—"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDatum(transaction.bookingDate, locale)}
            {transaction.linkCount > 0 && (
              <> · {t("zahlungenZuordnen.remaining", { amount: formatBetrag(transaction.remainingAmount, currency, locale) })}</>
            )}
          </p>
    </div>
  );
}
