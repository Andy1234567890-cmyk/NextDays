"use client";

// Rechnungen-Ansicht (Client) — bettet den echten Buchhaltungs-Bestand
// (InvoiceListView, ImportXRechnungDialog) ein. Logik 1:1 aus der ursprünglichen
// Bestands-Invoices-Seite übernommen; einzige Anpassung: companyId kommt als Prop
// aus der NextDays-Session (tenant_id) statt aus einem URL-Parameter.
import { Icon } from "@iconify/react";
import { Button } from "@tasko/ui";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ImportXRechnungDialog } from "@/components/finance/ImportXRechnungDialog";
import { InvoiceListView } from "@/components/finance/InvoiceListView";
import { api } from "@/lib/api-client";
import { useRealtime } from "@/lib/use-realtime";
import type { InvoiceData } from "@/types/invoiceTypes";

export function InvoicesClient({ companyId }: { companyId: string }) {
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
      setError("Fehler beim Laden der Rechnungen");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (companyId) loadInvoices();
  }, [companyId, loadInvoices]);
  // Realtime-Pflicht: Rechnungen anderer Sessions (inkl. Positionen) live.
  useRealtime({ table: "invoices", onChange: () => void loadInvoices(), enabled: !!companyId });
  useRealtime({ table: "invoice_line_items", onChange: () => void loadInvoices(), enabled: !!companyId });

  const header = (
    <header className="flex items-center justify-between">
      <h1 className="font-bold text-2xl">Rechnungen</h1>
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex items-center gap-2"
          onClick={() => setShowImportDialog(true)}
        >
          <Icon icon="lucide:file-text" className="h-4 w-4" />
          E-Rechnung lesen
        </Button>
        <Link href="/buchhaltung/rechnungen/neu">
          <Button className="flex items-center gap-2">
            <Icon icon="lucide:plus" className="h-4 w-4" />
            Rechnung schreiben
          </Button>
        </Link>
      </div>
    </header>
  );

  return (
    <div className="space-y-6">
      {header}

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
            <p className="mt-2 text-muted-foreground">Rechnungen werden geladen…</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex min-h-100 items-center justify-center">
          <div className="text-center">
            <h2 className="mb-2 font-semibold text-destructive text-xl">Fehler</h2>
            <p className="mb-4 text-muted-foreground">{error}</p>
            <Button onClick={loadInvoices}>Erneut versuchen</Button>
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
