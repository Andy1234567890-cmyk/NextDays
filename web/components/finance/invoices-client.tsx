"use client";

// Rechnungen-Ansicht (Client) — bettet den echten Buchhaltungs-Bestand
// (InvoiceListView, ImportXRechnungDialog) ein. Logik 1:1 aus der ursprünglichen
// Bestands-Invoices-Seite übernommen; einzige Anpassung: companyId kommt als Prop
// aus der NextDays-Session (tenant_id) statt aus einem URL-Parameter.
import { Icon } from "@iconify/react";
import { Button } from "@tasko/ui";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ImportXRechnungDialog } from "@/components/finance/ImportXRechnungDialog";
import { InvoiceListView } from "@/components/finance/InvoiceListView";
import { api } from "@/lib/api-client";
import { useRealtime } from "@/lib/use-realtime";
import type { InvoiceData } from "@/types/invoiceTypes";

export function InvoicesClient({ companyId }: { companyId: string }) {
  const t = useTranslations("finance");
  const locale = useLocale();
  // Fokus-Rechnung (?invoice=<id>): Ziel des Redirects nach dem Check-out im
  // Kalender („Rechnung ansehen & versenden") — wird oben hervorgehoben.
  const searchParams = useSearchParams();
  const focusInvoiceId = searchParams?.get("invoice") ?? null;
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const companyInvoices = await api.get<InvoiceData[]>(
        `/api/v1/invoices/company/${companyId}`,
      );
      setInvoices(companyInvoices);
    } catch (err) {
      console.error("Error loading invoices:", err);
      setError(t("invoicesClient.loadError"));
    } finally {
      setLoading(false);
    }
  }, [companyId, t]);

  useEffect(() => {
    if (companyId) loadInvoices();
  }, [companyId, loadInvoices]);
  // Realtime-Pflicht: Rechnungen anderer Sessions (inkl. Positionen) live.
  useRealtime({ table: "invoices", onChange: () => void loadInvoices(), enabled: !!companyId });
  useRealtime({ table: "invoice_line_items", onChange: () => void loadInvoices(), enabled: !!companyId });

  const header = (
    <header className="flex items-center justify-between">
      <h1 className="font-bold text-2xl">{t("invoicesClient.title")}</h1>
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex items-center gap-2"
          onClick={() => setShowImportDialog(true)}
        >
          <Icon icon="lucide:file-text" className="h-4 w-4" />
          {t("invoicesClient.readEInvoice")}
        </Button>
        <Link href="/buchhaltung/rechnungen/neu">
          <Button className="flex items-center gap-2">
            <Icon icon="lucide:plus" className="h-4 w-4" />
            {t("invoicesClient.createInvoice")}
          </Button>
        </Link>
      </div>
    </header>
  );

  const focused = focusInvoiceId
    ? invoices.find(inv => inv.id === focusInvoiceId)
    : undefined;

  return (
    <div className="space-y-6">
      {header}

      {/* Fokus-Banner nach Check-out-Redirect: die frisch erzeugte Rechnung
          klar hervorheben (Versand/Details laufen über die Liste darunter). */}
      {focused && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-success/40 bg-success/10 px-4 py-3">
          <div className="flex items-center gap-3">
            <Icon icon="ph:check-circle" className="size-5 text-success" />
            <div>
              <p className="text-sm font-semibold">
                {t("invoicesClient.invoiceForBooking", {
                  number: focused.invoiceNumber || focused.number,
                })}
              </p>
              <p className="text-xs text-muted-foreground">
                {focused.customerName}
                {focused.total != null && focused.currency
                  ? ` · ${focused.total.toLocaleString(locale, { style: "currency", currency: focused.currency })}`
                  : ""}
                {` · ${t("invoicesClient.statusLabel", { status: focused.status })}`}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("invoicesClient.focusHint")}
          </p>
        </div>
      )}

      <ImportXRechnungDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        companyId={companyId}
        onSuccess={loadInvoices}
        defaultType="income"
      />

      {loading ? (
        <div className="flex min-h-100 items-center justify-center">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-primary border-b-2" />
            <p className="mt-2 text-muted-foreground">{t("invoicesClient.loading")}</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex min-h-100 items-center justify-center">
          <div className="text-center">
            <h2 className="mb-2 font-semibold text-destructive text-xl">{t("invoicesClient.errorTitle")}</h2>
            <p className="mb-4 text-muted-foreground">{error}</p>
            <Button onClick={loadInvoices}>{t("invoicesClient.retry")}</Button>
          </div>
        </div>
      ) : (
        <InvoiceListView
          invoices={invoices}
          onRefresh={loadInvoices}
          companyId={companyId}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          showFilters={showFilters}
          setShowFilters={setShowFilters}
        />
      )}
    </div>
  );
}
