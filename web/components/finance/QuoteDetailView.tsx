'use client';

// 1:1 aus dem Taskilo-Finanzwerkzeug (components/finance/QuoteDetailView.tsx,
// 992 Zeilen): SevDesk-artige Detailansicht eines Angebots — Kopfzeile mit
// PDF-Download / „Als angenommen markieren" / Mehr-Menü, links die Infokarte
// (Gültigkeit, Tags, Datum, Versendet am, Status, Betrag, Kunde), rechts die
// Live-Vorschau des Belegs in der gewählten Vorlage.
// Anpassungen bei der Übernahme:
//  * Routen unter /buchhaltung/angebote; quoteId aus dem [id]-Segment, Tenant
//    aus der Session (kein [uid]).
//  * Versand über den bereits übernommenen SendDocumentModal (documentType
//    'quote') statt EmailSendModalNormal (nicht übernommen, 1 177 Zeilen).
//  * Kundenlink führt zur Kundenakte /buchhaltung/kunden/[id] statt in das
//    nicht übernommene CustomerDetailModal.
//  * „Zu Rechnung umwandeln" läuft serverseitig (convert-to-invoice) — der
//    Rechnungs-Editor kennt keine ?quoteId=-Vorbelegung.
//  * Texte über useTranslations, Beträge über formatCurrency (Wurzel 4),
//    Datum nach Nutzer-Locale, Taskilo-Türkis → Accent-Token.
import { Icon } from '@iconify/react';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@tasko/ui';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { InlinePreview } from '@/components/finance/InlinePreview';
import { LivePreviewModal } from '@/components/finance/LivePreviewModal';
import { SendDocumentModal } from '@/components/finance/SendDocumentModal';
import { useNewAuth } from '@/contexts/NewAuthContext';
import { formatCurrency } from '@/lib/currency';
import { type Quote, QuoteService } from '@/services/quoteService';

type LooseRecord = Record<string, unknown>;

export default function QuoteDetailView() {
  const t = useTranslations('finance');
  const locale = useLocale();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useNewAuth();
  const uid = user?.uid || '';
  const quoteId = typeof params?.id === 'string' ? params.id : '';

  // Template-Überschreibung aus URL-Parametern (für PDF-Generierung)
  const templateOverride = searchParams?.get('template');
  const colorOverride = searchParams?.get('color');
  const logoSizeOverride = searchParams?.get('logoSize');
  const pageModeOverride = searchParams?.get('pageMode');
  const isPdfMode = searchParams?.get('pdf') === 'true';
  const hideUI = searchParams?.get('hideUI') === 'true';
  // ?senden=1 (aus der Liste „E-Mail senden") öffnet den Versand direkt.
  const openSendOnLoad = searchParams?.get('senden') === '1';

  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);

  const loadQuote = useCallback(async () => {
    try {
      setLoading(true);
      const quoteData = await QuoteService.getQuote(quoteId);
      if (!quoteData) {
        setError(t('QuoteDetailView.notFound'));
        return;
      }
      setQuote(quoteData);
      setError(null);
    } catch (err) {
      console.error('Error loading quote:', err);
      setError(
        t('QuoteDetailView.loadError', {
          message: err instanceof Error ? err.message : t('QuoteDetailView.unknownError'),
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [quoteId, t]);

  useEffect(() => {
    if (user && quoteId) {
      loadQuote();
    }
  }, [user, quoteId, loadQuote]);

  useEffect(() => {
    if (openSendOnLoad && quote) setSendDialogOpen(true);
  }, [openSendOnLoad, quote]);

  const handleBackToQuotes = () => {
    router.push('/buchhaltung/angebote');
  };

  const handleDownloadPdf = async () => {
    if (!quote) {
      return;
    }

    setDownloadingPdf(true);

    try {
      // Find the preview element with data-pdf-template attribute (same as InvoiceDetailPage)
      const templateElement = document.querySelector('[data-pdf-template]') as HTMLElement | null;

      if (!templateElement || !templateElement.innerHTML.trim()) {
        throw new Error(t('QuoteDetailView.previewNotReady'));
      }

      // Clone the template element
      const clonedElement = templateElement.cloneNode(true) as HTMLElement;

      // Remove preview-only transform styles
      const removePreviewStyles = (element: HTMLElement) => {
        if (element.style) {
          element.style.removeProperty('transform');
          element.style.removeProperty('transform-origin');
        }
        element.querySelectorAll('*').forEach(child => {
          if ((child as HTMLElement).style) {
            (child as HTMLElement).style.removeProperty('transform');
            (child as HTMLElement).style.removeProperty('transform-origin');
          }
        });
      };
      removePreviewStyles(clonedElement);

      // Extract ALL styles from document
      const allStyles: string[] = [];

      // Get all <style> tags
      document.querySelectorAll('style').forEach(styleElement => {
        if (styleElement.textContent) {
          allStyles.push(styleElement.textContent);
        }
      });

      // Get all linked stylesheets
      document.querySelectorAll('link[rel="stylesheet"]').forEach(linkElement => {
        try {
          const link = linkElement as HTMLLinkElement;
          if (link.sheet?.cssRules) {
            let css = '';
            for (let i = 0; i < link.sheet.cssRules.length; i++) {
              css += `${link.sheet.cssRules[i].cssText}\n`;
            }
            allStyles.push(css);
          }
        } catch {
          // Ignore CORS errors for external stylesheets
        }
      });

      // Create complete HTML with ALL styles (exactly like InvoiceDetailPage)
      const completeHtml = `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <style>
    /* ALL APP STYLES */
    ${allStyles.join('\n\n')}

    /* PDF SPECIFIC */
    @page { size: A4; margin: 0; }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: 210mm;
      background: white;
      font-family: system-ui, -apple-system, sans-serif;
    }
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  </style>
</head>
<body>
  ${clonedElement.outerHTML}
</body>
</html>`;

      const response = await fetch('/api/v1/generate-pdf-single', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          htmlContent: completeHtml,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('PDF API failed:', response.status, errorData);
        throw new Error(errorData.error || t('QuoteDetailView.pdfFailed'));
      }

      const result = await response.json();

      if (!result.success || !result.pdfBase64 || result.pdfBase64.trim().length === 0) {
        throw new Error(t('QuoteDetailView.pdfEmpty'));
      }

      // Convert base64 to blob
      const byteCharacters = atob(result.pdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const pdfBlob = new Blob([byteArray], { type: 'application/pdf' });

      // Create download link
      const pdfUrl = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `Angebot_${quote.number || quote.id.substring(0, 8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up URL
      setTimeout(() => {
        window.URL.revokeObjectURL(pdfUrl);
      }, 5000);

      toast.success(t('QuoteDetailView.pdfDownloaded'));
    } catch (err) {
      console.error('Error downloading PDF:', err);
      toast.error(t('QuoteDetailView.pdfError', { message: (err as Error).message }));
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleMarkAsAccepted = async () => {
    if (!quote) return;

    setUpdating(true);
    try {
      await QuoteService.updateQuote(quote.id, { status: 'accepted' });
      setQuote(prev => (prev ? { ...prev, status: 'accepted', acceptedAt: new Date() } : null));
      toast.success(t('QuoteDetailView.markedAccepted'));
    } catch (err) {
      console.error('Error marking quote as accepted:', err);
      toast.error(t('QuoteDetailView.markAcceptedError'));
    } finally {
      setUpdating(false);
    }
  };

  const handleConvertToInvoice = async () => {
    if (!quote) return;
    setUpdating(true);
    try {
      const invoiceId = await QuoteService.convertToInvoice(uid, quote.id);
      toast.success(t('QuoteDetailView.converted'));
      router.push(`/buchhaltung?invoice=${invoiceId}`);
    } catch (err) {
      console.error('Error converting quote:', err);
      toast.error(err instanceof Error ? err.message : t('QuoteDetailView.convertError'));
    } finally {
      setUpdating(false);
    }
  };

  const addTag = async (tagName: string) => {
    if (!quote || isAddingTag || !tagName.trim()) return;

    setIsAddingTag(true);
    try {
      const updatedTags = [...(quote.tags || []), tagName];
      await QuoteService.updateQuote(quote.id, { tags: updatedTags });
      setQuote(prev => (prev ? { ...prev, tags: updatedTags } : null));
      setNewTag('');
      toast.success(t('QuoteDetailView.tagAdded'));
    } catch (err) {
      console.error('Error adding tag:', err);
      toast.error(t('QuoteDetailView.tagAddError'));
    } finally {
      setIsAddingTag(false);
    }
  };

  const removeTag = async (tagToRemove: string) => {
    if (!quote) return;

    try {
      const updatedTags = (quote.tags || []).filter(tag => tag !== tagToRemove);
      await QuoteService.updateQuote(quote.id, { tags: updatedTags });
      setQuote(prev => (prev ? { ...prev, tags: updatedTags } : null));
      toast.success(t('QuoteDetailView.tagRemoved'));
    } catch (err) {
      console.error('Error removing tag:', err);
      toast.error(t('QuoteDetailView.tagRemoveError'));
    }
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newTag.trim()) {
      e.preventDefault();
      addTag(newTag.trim());
    }
  };

  const isExpired = (q: Quote) => {
    const validUntil = new Date(q.validUntil || q.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    validUntil.setHours(0, 0, 0, 0);
    return validUntil < today && !['accepted', 'converted'].includes(q.status);
  };

  const getStatusColor = (status: string, q: Quote) => {
    if (isExpired(q) && status !== 'accepted') {
      return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300';
    }

    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200';
      case 'sent':
        return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300';
      case 'accepted':
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300';
      case 'converted':
        return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-300';
      case 'rejected':
      case 'expired':
        return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const getStatusText = (status: string, q: Quote) => {
    if (isExpired(q) && status !== 'accepted') {
      return t('QuoteDetailView.status.expired');
    }
    const known = ['draft', 'sent', 'accepted', 'rejected', 'cancelled', 'expired', 'converted'];
    return known.includes(status) ? t(`QuoteDetailView.status.${status}`) : status;
  };

  const formatDate = (d: Date | string | undefined) => {
    if (!d) return '-';
    const date = typeof d === 'string' ? new Date(d) : d;
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString(locale);
  };

  // Autorisierung: die Session liefert den Tenant — ohne Nutzer keine Ansicht.
  if (!user) {
    return (
      <div className="flex min-h-100 items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 font-semibold text-xl">{t('QuoteDetailView.accessDenied')}</h2>
          <p className="text-muted-foreground">{t('QuoteDetailView.accessDeniedHint')}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex min-h-100 items-center justify-center">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-accent border-b-2"></div>
            <p className="mt-2 text-muted-foreground">{t('QuoteDetailView.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          onClick={handleBackToQuotes}
          className="mb-4 text-muted-foreground hover:text-foreground"
        >
          <Icon icon="lucide:arrow-left" className="mr-2 h-4 w-4" />
          {t('QuoteDetailView.backToQuotes')}
        </Button>

        <div className="flex min-h-100 items-center justify-center">
          <div className="text-center">
            <h2 className="mb-2 font-semibold text-destructive text-xl">
              {t('QuoteDetailView.errorTitle')}
            </h2>
            <p className="mb-4 text-muted-foreground">{error || t('QuoteDetailView.notFound')}</p>
            <Button onClick={handleBackToQuotes} className="bg-accent text-white hover:bg-accent/90">
              {t('QuoteDetailView.backToQuotes')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const q = quote as Quote & LooseRecord;
  const previewDocument = {
    ...quote,
    // Template-Überschreibung aus URL-Parametern
    // Angebot mit Objektbezug: Vorlage Aufenthalt (Hotel/FeWo), sonst Bestand.
    template:
      templateOverride || (q.template as string) || (quote.stay ? 'TEMPLATE_STAY' : 'TEMPLATE_NEUTRAL'),
    color: colorOverride || (q.color as string) || 'var(--accent)',
    logoSize: logoSizeOverride ? parseInt(logoSizeOverride, 10) : (q.logoSize as number) || 50,
    pageMode: pageModeOverride || (q.pageMode as string) || 'single',
  };
  const quoteNumber = quote.number || `#${q.sequentialNumber || 'TEMP'}`;
  const gueltigkeitsText = (() => {
    if (!quote.validUntil) return '-';
    if (quote.status === 'accepted') return t('QuoteDetailView.status.accepted');
    if (quote.status === 'converted') return t('QuoteDetailView.status.converted');
    const validUntil = new Date(quote.validUntil);
    const diffDays = Math.ceil((validUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diffDays > 0) return t('QuoteDetailView.daysLeft', { days: diffDays });
    if (diffDays === 0) return t('QuoteDetailView.expiresToday');
    return t('QuoteDetailView.daysExpired', { days: Math.abs(diffDays) });
  })();

  // Für PDF-Generierung: Nur Template ohne UI rendern
  if (hideUI) {
    return (
      <div className="min-h-screen bg-white">
        <InlinePreview
          document={previewDocument}
          documentType="quote"
          companyId={uid}
          className="w-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-7xl">
        {/* SevDesk-style Header */}
        <header className="border-border border-b bg-background">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button
                  variant="ghost"
                  onClick={handleBackToQuotes}
                  className="p-2"
                  aria-label={t('QuoteDetailView.backToQuotes')}
                >
                  <Icon icon="lucide:arrow-left" className="h-5 w-5" />
                </Button>
                <div className="flex items-center space-x-4">
                  <h2 className="font-semibold text-base">
                    {t('QuoteDetailView.quoteNo', { number: quoteNumber })}
                  </h2>
                  {quote.bookingOfferId && (
                    <Badge variant="outline" className="gap-1">
                      <Icon icon="lucide:calendar" className="h-3 w-3" />
                      {t('QuoteDetailView.fromCalendarOffer')}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Button
                  variant="outline"
                  onClick={handleDownloadPdf}
                  disabled={downloadingPdf}
                >
                  <Icon icon="lucide:download" className="mr-2 h-4 w-4" />
                  {downloadingPdf ? t('QuoteDetailView.downloading') : t('QuoteDetailView.pdfDownload')}
                </Button>

                {quote.status === 'sent' && !quote.bookingOfferId && (
                  <Button
                    onClick={handleMarkAsAccepted}
                    disabled={updating}
                    className="bg-accent text-white hover:bg-accent/90"
                  >
                    {updating ? t('QuoteDetailView.marking') : t('QuoteDetailView.markAccepted')}
                  </Button>
                )}

                {/* Weitere Funktionen Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <Icon icon="lucide:more-horizontal" className="mr-2 h-4 w-4" />
                      {t('QuoteDetailView.more')}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    {(quote.status === 'draft' || quote.status === 'sent') && (
                      <DropdownMenuItem
                        onClick={() => router.push(`/buchhaltung/angebote/${quote.id}/bearbeiten`)}
                        className="cursor-pointer"
                      >
                        <Icon icon="lucide:pencil" className="mr-3 h-4 w-4" />
                        {t('QuoteDetailView.editQuote')}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => router.push(`/buchhaltung/angebote/neu?vorlage=${quote.id}`)}
                      className="cursor-pointer"
                    >
                      <Icon icon="lucide:copy" className="mr-3 h-4 w-4" />
                      {t('QuoteDetailView.useAsTemplate')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setSendDialogOpen(true)}
                      className="cursor-pointer"
                    >
                      <Icon icon="lucide:mail" className="mr-3 h-4 w-4" />
                      {t('QuoteDetailView.sendQuote')}
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => setShowLivePreview(true)}
                      className="cursor-pointer"
                    >
                      <Icon icon="lucide:eye" className="mr-3 h-4 w-4" />
                      {t('QuoteDetailView.fullscreenPreview')}
                    </DropdownMenuItem>

                    {quote.status === 'accepted' && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={handleConvertToInvoice}
                          disabled={updating}
                          className="cursor-pointer"
                        >
                          <Icon icon="lucide:file-text" className="mr-3 h-4 w-4" />
                          {t('QuoteDetailView.convertToInvoice')}
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content - SevDesk Style */}
        <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-3">
          {/* Quote Details Section */}
          <div className="lg:col-span-1">
            <div className="infocard rounded-lg border border-border bg-background">
              {/* Header */}
              <div className="top border-border border-b p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">{t('QuoteDetailView.details')}</h3>
                  <div className="group">
                    <Icon icon="lucide:file-text" className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="details p-4">
                <div className="space-y-4">
                  {/* Gültigkeit */}
                  {quote.validUntil && (
                    <div className="detail flex items-start justify-between py-2">
                      <div className="left">
                        <p className="label text-muted-foreground text-sm">
                          {t('QuoteDetailView.validity')}
                        </p>
                      </div>
                      <div className="right text-right">
                        <p className="font-medium text-sm">{gueltigkeitsText}</p>
                      </div>
                    </div>
                  )}

                  {/* Gültig bis */}
                  {quote.validUntil && (
                    <div className="detail flex items-start justify-between py-2">
                      <div className="left">
                        <p className="label text-muted-foreground text-sm">
                          {t('QuoteDetailView.validUntil')}
                        </p>
                      </div>
                      <div className="right text-right">
                        <p className="font-medium text-sm">
                          <b>{formatDate(quote.validUntil)}</b>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  <div className="detail flex items-center justify-between py-2">
                    <div className="left">
                      <p className="label text-muted-foreground text-sm">{t('QuoteDetailView.tags')}</p>
                    </div>
                    <div className="right max-w-45 flex-1">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {/* Existing Tags */}
                        {(quote.tags || []).map(tag => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-muted-foreground text-xs transition-colors hover:bg-muted/70"
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => removeTag(tag)}
                              className="font-bold text-muted-foreground text-xs transition-colors hover:text-destructive"
                              title={t('QuoteDetailView.removeTag')}
                            >
                              ×
                            </button>
                          </span>
                        ))}

                        {/* Add Tag Input */}
                        <div className="inline-flex">
                          <input
                            type="text"
                            value={newTag}
                            onChange={e => setNewTag(e.target.value)}
                            onKeyDown={handleTagKeyDown}
                            disabled={isAddingTag}
                            className="min-w-25 max-w-30 border-0 bg-transparent px-2 py-1 text-right text-sm placeholder-muted-foreground outline-0 hover:bg-muted/50 focus:rounded focus:border focus:border-accent focus:bg-background"
                            placeholder={
                              quote.tags && quote.tags.length > 0 ? '+' : t('QuoteDetailView.addTags')
                            }
                            onBlur={() => {
                              if (newTag.trim()) addTag(newTag.trim());
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Angebotsdatum */}
                  <div className="detail flex items-start justify-between py-2">
                    <div className="left">
                      <p className="label text-muted-foreground text-sm">
                        {t('QuoteDetailView.quoteDate')}
                      </p>
                    </div>
                    <div className="right">
                      <p className="font-medium text-sm">{formatDate(quote.date)}</p>
                    </div>
                  </div>

                  {/* Versendet am */}
                  <div className="detail flex items-start justify-between py-2">
                    <div className="left">
                      <p className="label text-muted-foreground text-sm">{t('QuoteDetailView.sentAt')}</p>
                    </div>
                    <div className="right">
                      {quote.sentAt ? (
                        <p className="font-medium text-sm">
                          {t('QuoteDetailView.sentAtValue', {
                            date: new Date(quote.sentAt).toLocaleDateString(locale),
                            time: new Date(quote.sentAt).toLocaleTimeString(locale, {
                              hour: '2-digit',
                              minute: '2-digit',
                            }),
                          })}
                        </p>
                      ) : (
                        <p className="text-muted-foreground text-sm">{t('QuoteDetailView.notSent')}</p>
                      )}
                    </div>
                  </div>

                  {/* Status als Badge */}
                  <div className="detail flex items-start justify-between py-2">
                    <div className="left">
                      <p className="label text-muted-foreground text-sm">{t('QuoteDetailView.statusLabel')}</p>
                    </div>
                    <div className="right">
                      <Badge
                        variant={quote.status === 'accepted' ? 'default' : 'secondary'}
                        className={getStatusColor(quote.status || 'draft', quote)}
                      >
                        {getStatusText(quote.status || 'draft', quote)}
                      </Badge>
                    </div>
                  </div>

                  {/* Gesamtbetrag */}
                  <div className="detail flex items-start justify-between border-border border-t py-2 pt-4">
                    <div className="left">
                      <p className="label text-muted-foreground text-sm">{t('QuoteDetailView.total')}</p>
                    </div>
                    <div className="right">
                      <p className="font-bold text-sm">
                        {formatCurrency(quote.total || 0, quote.currency)}
                      </p>
                    </div>
                  </div>

                  {/* Customer */}
                  {quote.customerName && (
                    <div className="detail flex items-start justify-between py-2">
                      <div className="left">
                        <p className="label text-muted-foreground text-sm">{t('QuoteDetailView.customer')}</p>
                      </div>
                      <div className="right">
                        {quote.customerId ? (
                          <Link
                            href={`/buchhaltung/kunden/${quote.customerId}`}
                            className="font-medium text-accent text-sm transition-colors hover:underline"
                          >
                            {quote.customerName}
                          </Link>
                        ) : (
                          <p className="font-medium text-sm">{quote.customerName}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Live Preview Section */}
          <div className="pdf col-span-2">
            <div className="rounded-lg border border-border bg-background">
              {/* Live Preview Header */}
              <div className="border-border border-b p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">{t('QuoteDetailView.livePreview')}</h3>
                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={() => setShowLivePreview(true)}
                      className="bg-accent text-white hover:bg-accent/90"
                    >
                      <Icon icon="lucide:eye" className="mr-2 h-4 w-4" />
                      {t('QuoteDetailView.fullscreenPreview')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadPdf}
                      disabled={downloadingPdf}
                    >
                      <Icon icon="lucide:download" className="mr-2 h-4 w-4" />
                      {t('QuoteDetailView.pdfDownload')}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Live Preview Content */}
              <div className="p-4">
                <div className="flex justify-center">
                  <div className="h-200 w-full overflow-hidden rounded-lg border border-border bg-white shadow-lg">
                    <div className="flex h-full w-full justify-center overflow-auto py-4">
                      <InlinePreview
                        document={previewDocument}
                        documentType="quote"
                        companyId={uid}
                        className={`inline-preview-content shadow-lg ${isPdfMode ? 'min-h-[297mm] w-[210mm]' : ''}`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Versand (E-Mail / Download / Druck) — derselbe Dialog wie bei Rechnungen */}
        <SendDocumentModal
          isOpen={sendDialogOpen}
          onClose={() => {
            setSendDialogOpen(false);
            // Der Dialog hat ggf. Status/sentAt gesetzt — neu laden.
            void loadQuote();
          }}
          document={{
            ...(quote as unknown as LooseRecord),
            number: quote.number,
            documentNumber: quote.number,
            validUntil: quote.validUntil ? new Date(quote.validUntil).toISOString() : undefined,
          } as unknown as React.ComponentProps<typeof SendDocumentModal>['document']}
          documentType="quote"
          companyId={uid}
          onSend={async method => {
            if (method === 'email') {
              try {
                await QuoteService.updateQuote(quoteId, { sentAt: new Date(), status: 'sent' });
                setQuote(prev => (prev ? { ...prev, sentAt: new Date(), status: 'sent' } : null));
                toast.success(t('QuoteDetailView.emailSentSaved'));
              } catch (err) {
                console.error('Fehler beim Aktualisieren des Sendedatums:', err);
                toast.error(t('QuoteDetailView.emailSentNotSaved'));
              }
            }
          }}
        />

        {/* Vollbild Live Preview Modal */}
        <LivePreviewModal
          isOpen={showLivePreview}
          onClose={() => setShowLivePreview(false)}
          document={{
            ...previewDocument,
            logoUrl: (q.logoUrl as string) || null,
            documentSettings: (q.documentSettings as LooseRecord) || {
              language: quote.language || 'de',
              showQRCode: false,
              showEPCQRCode: false,
              showCustomerNumber: false,
              showContactPerson: false,
              showVATPerPosition: false,
              showArticleNumber: false,
              showFoldLines: true,
              showPageNumbers: true,
              showFooter: true,
              showWatermark: false,
            },
          }}
          documentType="quote"
          companyId={uid}
          mode="view"
        />
      </div>
    </div>
  );
}
