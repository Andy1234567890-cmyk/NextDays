"use client";

// Umsatzliste (Buchhaltung → Zahlungen): Filter (Konto, Status, Zeitraum,
// Suche) als URL-Parameter, Tabelle mit Zuordnen / Beiseitelegen / Lösen.
// Kein Realtime: bank_transactions/transaction_links sind Finanztabellen
// (Wurzel 6, revoke) — nach eigener Aktion router.refresh().
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { EmptyState } from "@nextdays/ui/empty-state";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import { deleteTransactionLink, updateBankTransaction } from "@/lib/buchhaltung-zahlungen";
import type {
  BankTransaction,
  BankTransactionList,
  PaymentAccount,
  TransactionStatus,
} from "@/lib/buchhaltung-zahlungen-typen";

import { formatBetrag, formatDatum } from "./format";
import { ZuordnenDialog } from "./zuordnen-dialog";

type Props = {
  liste: BankTransactionList;
  accounts: PaymentAccount[];
  filter: { accountId?: string; status?: TransactionStatus; from?: string; to?: string; search?: string };
};

const STATUS: readonly (TransactionStatus | "all")[] = ["unmatched", "matched", "ignored", "all"];

export function UmsatzListe({ liste, accounts, filter }: Props) {
  const t = useTranslations("finance");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(filter.search ?? "");
  const [zuordnen, setZuordnen] = useState<BankTransaction | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.replace(`${pathname}?${next.toString()}`));
  }

  async function ignorieren(tx: BankTransaction, ignored: boolean) {
    setBusyId(tx.id);
    const res = await updateBankTransaction(tx.id, { ignored });
    setBusyId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(ignored ? t("zahlungenPage.ignored") : t("zahlungenPage.restored"));
    router.refresh();
  }

  async function loesen(tx: BankTransaction) {
    const link = tx.linkedDocuments[0];
    if (!link) return;
    if (!window.confirm(t("zahlungenPage.confirmUnlink", { number: link.documentNumber || link.documentId }))) return;
    setBusyId(tx.id);
    const res = await deleteTransactionLink(link.linkId);
    setBusyId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("zahlungenPage.unlinked"));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div className="flex min-w-40 flex-col gap-1">
          <label className="text-xs text-muted-foreground" htmlFor="f-account">
            {t("zahlungenPage.filterAccount")}
          </label>
          <NativeSelect
            id="f-account"
            value={filter.accountId ?? ""}
            onChange={(e) => setParam("konto", e.target.value)}
          >
            <option value="">{t("zahlungenPage.allAccounts")}</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex min-w-36 flex-col gap-1">
          <label className="text-xs text-muted-foreground" htmlFor="f-status">
            {t("zahlungenPage.filterStatus")}
          </label>
          <NativeSelect
            id="f-status"
            value={filter.status ?? "all"}
            onChange={(e) => setParam("status", e.target.value === "all" ? "" : e.target.value)}
          >
            {STATUS.map((s) => (
              <option key={s} value={s}>
                {t(`zahlungenPage.status.${s}`)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground" htmlFor="f-from">
            {t("zahlungenPage.filterFrom")}
          </label>
          <Input id="f-from" type="date" value={filter.from ?? ""} onChange={(e) => setParam("von", e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground" htmlFor="f-to">
            {t("zahlungenPage.filterTo")}
          </label>
          <Input id="f-to" type="date" value={filter.to ?? ""} onChange={(e) => setParam("bis", e.target.value)} />
        </div>
        <form
          className="flex min-w-48 flex-1 flex-col gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            setParam("suche", search.trim());
          }}
        >
          <label className="text-xs text-muted-foreground" htmlFor="f-search">
            {t("zahlungenPage.filterSearch")}
          </label>
          <div className="flex gap-2">
            <Input
              id="f-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("zahlungenPage.searchPlaceholder")}
            />
            <Button type="submit" variant="outline" size="icon" aria-label={t("zahlungenPage.searchAria")}>
              <Icon icon={pending ? "ph:spinner" : "ph:magnifying-glass"} className={`size-4 ${pending ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </form>
      </Card>

      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span>{t("zahlungenPage.count", { count: liste.total })}</span>
        <span>
          {t("zahlungenPage.sumIn")}:{" "}
          <span className="font-medium text-accent">{formatBetrag(liste.sumIn, liste.items[0]?.currency ?? accounts[0]?.currency ?? "", locale)}</span>
        </span>
        <span>
          {t("zahlungenPage.sumOut")}:{" "}
          <span className="font-medium text-destructive">{formatBetrag(liste.sumOut, liste.items[0]?.currency ?? accounts[0]?.currency ?? "", locale)}</span>
        </span>
      </div>

      {liste.items.length === 0 ? (
        <EmptyState
          icon="ph:credit-card"
          titel={t("zahlungenPage.emptyTitle")}
          text={accounts.length === 0 ? t("zahlungenPage.emptyNoAccount") : t("zahlungenPage.emptyText")}
          aktion={
            <Button variant="accent" onClick={() => router.push("/buchhaltung/bank")}>
              <Icon icon="ph:bank" className="size-4" />
              {accounts.length === 0 ? t("zahlungenPage.createAccount") : t("zahlungenPage.importCsv")}
            </Button>
          }
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-secondary/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t("zahlungenPage.colDate")}</th>
                <th className="px-4 py-3 font-medium">{t("zahlungenPage.colCounterpart")}</th>
                <th className="px-4 py-3 font-medium">{t("zahlungenPage.colPurpose")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("zahlungenPage.colAmount")}</th>
                <th className="px-4 py-3 font-medium">{t("zahlungenPage.colStatus")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("zahlungenPage.colActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {liste.items.map((tx) => {
                const negativ = Number(tx.amount) < 0;
                const busy = busyId === tx.id;
                return (
                  <tr key={tx.id} className={`transition-colors hover:bg-secondary/30 ${tx.ignored ? "opacity-60" : ""}`}>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatDatum(tx.bookingDate, locale)}
                      {tx.paymentAccountName && (
                        <span className="block text-xs">{tx.paymentAccountName}</span>
                      )}
                    </td>
                    <td className="max-w-48 truncate px-4 py-3 font-medium">{tx.counterpartName || "—"}</td>
                    <td className="max-w-72 px-4 py-3 text-muted-foreground">
                      <span className="line-clamp-2">{tx.purpose || "—"}</span>
                      {tx.linkedDocuments.length > 0 && (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {tx.linkedDocuments.map((d) => (
                            <span key={d.linkId} className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">
                              <Icon icon="ph:link" className="size-3" />
                              {d.documentNumber || d.documentId}
                            </span>
                          ))}
                        </span>
                      )}
                      {tx.note && <span className="mt-1 block text-xs italic">{tx.note}</span>}
                    </td>
                    <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${negativ ? "text-destructive" : "text-accent"}`}>
                      {formatBetrag(tx.amount, tx.currency, locale)}
                      {tx.linkCount > 0 && Number(tx.remainingAmount) !== 0 && (
                        <span className="block text-xs font-normal text-muted-foreground">
                          {t("zahlungenPage.remaining", { amount: formatBetrag(tx.remainingAmount, tx.currency, locale) })}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={tx.status} label={t(`zahlungenPage.status.${tx.status}`)} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        {tx.status !== "ignored" && !negativ && (
                          <Button size="sm" variant="accent" disabled={busy} onClick={() => setZuordnen(tx)}>
                            <Icon icon="ph:link" className="size-4" />
                            {t("zahlungenPage.assign")}
                          </Button>
                        )}
                        {tx.status === "matched" && (
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => loesen(tx)}>
                            <Icon icon="ph:link-break" className="size-4" />
                            {t("zahlungenPage.unlink")}
                          </Button>
                        )}
                        {tx.status === "unmatched" && (
                          <Button size="sm" variant="ghost" disabled={busy} onClick={() => ignorieren(tx, true)} aria-label={t("zahlungenPage.ignore")}>
                            <Icon icon="ph:eye-slash" className="size-4" />
                          </Button>
                        )}
                        {tx.status === "ignored" && (
                          <Button size="sm" variant="ghost" disabled={busy} onClick={() => ignorieren(tx, false)}>
                            <Icon icon="ph:arrow-counter-clockwise" className="size-4" />
                            {t("zahlungenPage.restore")}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <ZuordnenDialog transaction={zuordnen} onClose={() => setZuordnen(null)} />
    </div>
  );
}

const STATUS_CLASSES: Record<TransactionStatus, string> = {
  unmatched: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  matched: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  ignored: "bg-muted text-muted-foreground",
};

function StatusBadge({ status, label }: { status: TransactionStatus; label: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASSES[status]}`}>
      {label}
    </span>
  );
}
