// Buchhaltung → Angebote: Liste aller Angebote des Tenants.
// Server Component — lädt über die Server-Action, rendert Tabelle + Anlegen.
import { Icon } from "@iconify/react";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { NewQuoteButton } from "@/components/buchhaltung/new-quote-button";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Card } from "@nextdays/ui/card";
import { listCustomers, listQuotes } from "@/lib/buchhaltung";
import type { Customer, QuoteStatus } from "@/lib/buchhaltung";
import { formatCurrency } from "@/lib/currency";

function getStatusLabels(t: Awaited<ReturnType<typeof getTranslations>>): Record<QuoteStatus, string> {
  return {
    draft: t("angebotePage.statusDraft"),
    sent: t("angebotePage.statusSent"),
    accepted: t("angebotePage.statusAccepted"),
    rejected: t("angebotePage.statusRejected"),
    expired: t("angebotePage.statusExpired"),
    converted: t("angebotePage.statusConverted"),
  };
}

const STATUS_CLASSES: Record<QuoteStatus, string> = {
  draft: "bg-secondary text-secondary-foreground",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  accepted: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  expired: "bg-muted text-muted-foreground",
  converted: "bg-accent/15 text-accent",
};

// Zentrale lib/currency.formatCurrency (Wurzel 4: kein eigener EUR-Fallback).
// Leere Angebotswährung → symbollos statt erfundenem EUR.
function formatMoney(amount: string, currency: string): string {
  const n = Number(amount);
  return formatCurrency(Number.isFinite(n) ? n : 0, currency);
}

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(locale).format(new Date(iso));
}

export default async function AngebotePage() {
  const t = await getTranslations("finance");
  const locale = await getLocale();
  const statusLabels = getStatusLabels(t);
  const [res, customersRes] = await Promise.all([listQuotes(), listCustomers()]);
  const customers: Customer[] = customersRes.ok ? customersRes.data.items : [];
  const customerName = new Map(customers.map((c) => [c.id, c.name]));

  return (
    <div className="flex flex-col gap-6">
      <RealtimeRefresh tables={["quotes", "customers"]} />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-extrabold">{t("angebotePage.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("angebotePage.subtitle")}</p>
        </div>
        <NewQuoteButton customers={customers} />
      </div>

      {!res.ok ? (
        // Fehlende Berechtigung (owner_reporting) → die Buchhaltung existiert für
        // diesen Nutzer nicht (Sidebar blendet sie aus, Wurzel 3); echter Backend-
        // Fehler bleibt sichtbar.
        res.status === 403 ? (
          notFound()
        ) : (
          <Card className="p-5 text-sm text-destructive">{t("angebotePage.loadError")}</Card>
        )
      ) : res.data.items.length === 0 ? (
        <EmptyState customers={customers} t={t} />
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-secondary/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t("angebotePage.columnNumber")}</th>
                <th className="px-4 py-3 font-medium">{t("angebotePage.columnCustomer")}</th>
                <th className="px-4 py-3 font-medium">{t("angebotePage.columnDate")}</th>
                <th className="px-4 py-3 font-medium">{t("angebotePage.columnValidUntil")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("angebotePage.columnAmount")}</th>
                <th className="px-4 py-3 font-medium">{t("angebotePage.columnStatus")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {res.data.items.map((q) => (
                <tr key={q.id} className="transition-colors hover:bg-secondary/30">
                  <td className="px-4 py-3 font-medium">
                    {q.quote_number || (
                      <span className="text-muted-foreground">{t("angebotePage.draftLabel")}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {(q.customer_id && customerName.get(q.customer_id)) || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(q.issue_date, locale)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(q.valid_until, locale)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatMoney(q.gross_amount, q.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASSES[q.status]}`}
                    >
                      {statusLabels[q.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function EmptyState({
  customers,
  t,
}: {
  customers: Customer[];
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-secondary">
        <Icon icon="ph:file-text" className="size-7 text-muted-foreground" />
      </span>
      <div>
        <p className="font-display text-lg font-extrabold">{t("angebotePage.emptyTitle")}</p>
        <p className="text-sm text-muted-foreground">{t("angebotePage.emptySubtitle")}</p>
      </div>
      <NewQuoteButton customers={customers} />
    </Card>
  );
}
