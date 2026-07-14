// Buchhaltung → Angebote: Liste aller Angebote des Tenants.
// Server Component — lädt über die Server-Action, rendert Tabelle + Anlegen.
import { Icon } from "@iconify/react";
import { notFound } from "next/navigation";

import { NewQuoteButton } from "@/components/buchhaltung/new-quote-button";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Card } from "@/components/ui/card";
import { listCustomers, listQuotes } from "@/lib/buchhaltung";
import type { Customer, QuoteStatus } from "@/lib/buchhaltung";
import { formatCurrency } from "@/lib/currency";

const STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Entwurf",
  sent: "Versendet",
  accepted: "Angenommen",
  rejected: "Abgelehnt",
  expired: "Abgelaufen",
  converted: "Umgewandelt",
};

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

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("de-DE").format(new Date(iso));
}

export default async function AngebotePage() {
  const [res, customersRes] = await Promise.all([listQuotes(), listCustomers()]);
  const customers: Customer[] = customersRes.ok ? customersRes.data.items : [];
  const customerName = new Map(customers.map((c) => [c.id, c.name]));

  return (
    <div className="flex flex-col gap-6">
      <RealtimeRefresh tables={["quotes", "customers"]} />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-extrabold">Angebote</h2>
          <p className="text-sm text-muted-foreground">
            Erstelle Angebote und wandle sie in Rechnungen um.
          </p>
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
          <Card className="p-5 text-sm text-destructive">
            Angebote konnten nicht geladen werden. Ist das Backend erreichbar?
          </Card>
        )
      ) : res.data.items.length === 0 ? (
        <EmptyState customers={customers} />
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-secondary/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Nummer</th>
                <th className="px-4 py-3 font-medium">Kunde</th>
                <th className="px-4 py-3 font-medium">Datum</th>
                <th className="px-4 py-3 font-medium">Gültig bis</th>
                <th className="px-4 py-3 text-right font-medium">Betrag</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {res.data.items.map((q) => (
                <tr key={q.id} className="transition-colors hover:bg-secondary/30">
                  <td className="px-4 py-3 font-medium">
                    {q.quote_number || (
                      <span className="text-muted-foreground">Entwurf</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {(q.customer_id && customerName.get(q.customer_id)) || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(q.issue_date)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(q.valid_until)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatMoney(q.gross_amount, q.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASSES[q.status]}`}
                    >
                      {STATUS_LABELS[q.status]}
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

function EmptyState({ customers }: { customers: Customer[] }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-secondary">
        <Icon icon="ph:file-text" className="size-7 text-muted-foreground" />
      </span>
      <div>
        <p className="font-display text-lg font-extrabold">Noch keine Angebote</p>
        <p className="text-sm text-muted-foreground">
          Erstelle dein erstes Angebot, um loszulegen.
        </p>
      </div>
      <NewQuoteButton customers={customers} />
    </Card>
  );
}
