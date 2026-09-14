'use client';

// Angebote-Ansicht (Client) — 1:1 aus der Taskilo-Seite
// app/dashboard/company/[uid]/finance/quotes/page.tsx übernommen: Kopf mit
// „Angebot erstellen", darunter die generische DocumentListView (Tabs Alle /
// Entwurf / Versendet / Angenommen / Abgelaufen / Storniert, Filter, Aktionen).
// Anpassungen wie bei invoices-client.tsx: companyId aus der NextDays-Session
// statt [uid]-Routenparameter, Ziele unter /buchhaltung/angebote, Texte über
// useTranslations. Bis zum 13.09.2026 stand hier ein 152-Zeilen-Schieber, der
// mit dem übernommenen Werkzeug nichts gemein hatte.
import { Icon } from '@iconify/react';
import { Button } from '@tasko/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { type DocumentItem, DocumentListView } from '@/components/finance/DocumentListView';
import { QuoteService } from '@/services/quoteService';

export function QuotesClient({ companyId }: { companyId: string }) {
  const t = useTranslations('finance');
  const router = useRouter();

  const [quotes, setQuotes] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const loadQuotes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const companyQuotes = await QuoteService.getQuotes(companyId);
      // Convert to DocumentItem format
      const docs: DocumentItem[] = companyQuotes.map(q => ({
        id: q.id,
        number: q.number,
        customerName: q.customerName,
        customerEmail: q.customerEmail,
        date: q.date,
        validUntil: q.validUntil,
        propertyTitle: q.propertyTitle,
        stayFrom: q.stayFrom,
        stayTo: q.stayTo,
        status: q.status || 'draft',
        total: q.total,
        amount: q.subtotal,
        currency: q.currency,
        items: q.items,
      }));
      setQuotes(docs);
    } catch (err) {
      console.error('Error loading quotes:', err);
      setError(t('quotesClient.loadError'));
    } finally {
      setLoading(false);
    }
  }, [companyId, t]);

  useEffect(() => {
    if (companyId) loadQuotes();
  }, [companyId, loadQuotes]);
  // Kein Realtime: `quotes` ist für authenticated bewusst gesperrt (Wurzel 6,
  // Migration 0337) — ein Abo darauf wäre eine stumme Attrappe. Nach eigener
  // Aktion lädt die Liste neu (loadQuotes), fremde Änderungen erscheinen beim
  // nächsten Laden der Seite.

  // Umwandeln läuft SERVERSEITIG (POST /quotes/{id}/convert-to-invoice, Positionen
  // und Nummer zieht das Backend) — im Bestand sprang der Klick in den Rechnungs-
  // Editor mit ?quoteId=, den es in NextDays nicht als Vorbelegung gibt.
  const handleConvertToInvoice = async (doc: DocumentItem) => {
    try {
      const invoiceId = await QuoteService.convertToInvoice(companyId, doc.id);
      toast.success(t('quotesClient.converted'));
      router.push(`/buchhaltung?invoice=${invoiceId}`);
    } catch (err) {
      console.error('Error converting quote:', err);
      toast.error(err instanceof Error ? err.message : t('quotesClient.convertError'));
    }
  };

  const handleDelete = async (doc: DocumentItem) => {
    if (!window.confirm(t('quotesClient.confirmDelete', { number: doc.number || doc.id }))) return;
    try {
      await QuoteService.deleteQuote(companyId, doc.id);
      toast.success(t('quotesClient.deleted'));
      await loadQuotes();
    } catch (err) {
      console.error('Error deleting quote:', err);
      toast.error(t('quotesClient.deleteError'));
    }
  };

  const header = (
    <header className="flex items-center justify-between">
      <h1 className="font-bold text-2xl">{t('quotesClient.title')}</h1>
      <Link href="/buchhaltung/angebote/neu">
        <Button className="flex items-center gap-2 bg-accent text-white hover:bg-accent/90">
          <Icon icon="lucide:plus" className="h-4 w-4" />
          {t('quotesClient.createQuote')}
        </Button>
      </Link>
    </header>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {header}
        <div className="flex min-h-100 items-center justify-center">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-accent border-b-2"></div>
            <p className="mt-2 text-muted-foreground">{t('quotesClient.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        {header}
        <div className="flex min-h-100 items-center justify-center">
          <div className="text-center">
            <h2 className="mb-2 font-semibold text-destructive text-xl">
              {t('quotesClient.errorTitle')}
            </h2>
            <p className="mb-4 text-muted-foreground">{error}</p>
            <Button onClick={loadQuotes} className="bg-accent text-white hover:bg-accent/90">
              {t('quotesClient.retry')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      <DocumentListView
        documents={quotes}
        documentType="quote"
        companyId={companyId}
        basePath="/buchhaltung/angebote"
        onRefresh={loadQuotes}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        onConvertToInvoice={handleConvertToInvoice}
        onDelete={handleDelete}
        onSendEmail={doc => router.push(`/buchhaltung/angebote/${doc.id}?senden=1`)}
        // Bearbeiten öffnet die Detailansicht — einen Editor für bestehende
        // Angebote gibt es (noch) nicht; der Bestand hatte dafür eine
        // 4 785-Zeilen-Kopie des Erstell-Editors.
        editPath={doc => `/buchhaltung/angebote/${doc.id}`}
      />
    </div>
  );
}
