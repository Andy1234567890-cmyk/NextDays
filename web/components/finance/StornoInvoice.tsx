'use client';

import { Icon } from '@iconify/react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Label,
  Textarea,
} from '@tasko/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { useNewAuth } from '@/contexts/NewAuthContext';
import { formatCurrency } from '@/lib/currency';
import { InvoiceService } from '@/services/firestoreInvoiceService';
import type { InvoiceData } from '@/types/invoiceTypes';
import { InvoiceTemplateRenderer } from './InvoiceTemplates';

interface StornoInvoiceProps {
  invoice: InvoiceData;
  onStornoCreated?: (stornoInvoice: InvoiceData) => void;
}

export default function StornoInvoice({ invoice, onStornoCreated }: StornoInvoiceProps) {
  const t = useTranslations('finance');
  const locale = useLocale();
  const [isCreatingStorno, setIsCreatingStorno] = useState(false);
  const [stornoReason, setStornoReason] = useState('');
  const [stornoInvoice, setStornoInvoice] = useState<InvoiceData | null>(null);
  const [showStornoPreview, setShowStornoPreview] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  // Referenz auf den gerenderten Storno-Beleg (InvoiceTemplateRenderer) — dessen
  // HTML wird für den PDF-Download an /api/v1/generate-pdf-single geschickt.
  const stornoPreviewRef = useRef<HTMLDivElement>(null);

  const { user } = useNewAuth();

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString(locale);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: t('StornoInvoice.statusDraft'), variant: 'secondary' as const, icon: 'lucide:file-text' },
      finalized: {
        label: t('StornoInvoice.statusFinalized'),
        variant: 'default' as const,
        icon: 'lucide:check-circle',
      },
      sent: { label: t('StornoInvoice.statusSent'), variant: 'default' as const, icon: 'lucide:check-circle' },
      paid: { label: t('StornoInvoice.statusPaid'), variant: 'default' as const, icon: 'lucide:check-circle' },
      overdue: {
        label: t('StornoInvoice.statusOverdue'),
        variant: 'destructive' as const,
        icon: 'lucide:alert-triangle',
      },
      cancelled: { label: t('StornoInvoice.statusCancelled'), variant: 'secondary' as const, icon: 'lucide:x' },
      storno: { label: t('StornoInvoice.statusStorno'), variant: 'destructive' as const, icon: 'lucide:x' },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon icon={config.icon} className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const handleCreateStorno = async () => {
    if (!stornoReason.trim()) {
      toast.error(t('StornoInvoice.reasonRequired'));
      return;
    }

    if (!user) {
      toast.error(t('StornoInvoice.mustBeLoggedIn'));
      return;
    }

    setIsCreatingStorno(true);

    try {
      const createdStornoInvoice = await InvoiceService.createAndSaveStornoInvoice(
        invoice,
        invoice.companyId || '',
        stornoReason.trim(),
      );

      setStornoInvoice(createdStornoInvoice);
      toast.success(t('StornoInvoice.createSuccess'));

      if (onStornoCreated) {
        onStornoCreated(createdStornoInvoice);
      }

      setShowConfirmDialog(false);
      setStornoReason('');
    } catch (error) {
      console.error('Storno creation error:', error);
      toast.error(t('StornoInvoice.createError'));
    } finally {
      setIsCreatingStorno(false);
    }
  };

  const handleDownloadStornoPdf = async () => {
    if (!stornoInvoice) {
      toast.error(t('StornoInvoice.noStornoAvailable'));
      return;
    }
    const el = stornoPreviewRef.current;
    if (!el) {
      toast.error(t('StornoInvoice.previewNotReady'));
      return;
    }

    try {
      toast.info(t('StornoInvoice.pdfCreating'));

      // Styles der Seite einsammeln, damit das gerenderte Template im
      // headless-Renderer identisch aussieht (gleicher Weg wie SendDocumentModal).
      const styleSheets = Array.from(
        document.querySelectorAll('style, link[rel="stylesheet"]'),
      );
      const allStyles: string[] = [];
      styleSheets.forEach((node) => {
        if (node.tagName === 'STYLE') {
          allStyles.push(node.textContent || '');
          return;
        }
        try {
          const link = node as HTMLLinkElement;
          if (link.sheet?.cssRules) {
            let css = '';
            for (let i = 0; i < link.sheet.cssRules.length; i++) {
              css += `${link.sheet.cssRules[i].cssText}\n`;
            }
            allStyles.push(css);
          }
        } catch {
          /* CORS-geschützte externe Stylesheets ignorieren */
        }
      });

      const completeHtml = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <style>
    ${allStyles.join('\n\n')}
    @page { size: A4; margin: 0; }
    html, body { margin: 0 !important; padding: 0 !important; width: 210mm; background: white; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  </style>
</head>
<body>${el.outerHTML}</body>
</html>`;

      // Korrekter, existierender Endpunkt (Playwright) — NICHT das frühere
      // /generate-invoice-pdf (existiert im Backend nicht → 404).
      const response = await fetch('/api/v1/generate-pdf-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ htmlContent: completeHtml }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || t('StornoInvoice.pdfGenerationFailed'));
      }
      const result = await response.json();
      if (!result.success || !result.pdfBase64) {
        throw new Error(t('StornoInvoice.pdfNoDocument'));
      }

      // base64 → Blob → Download.
      const bytes = Uint8Array.from(atob(result.pdfBase64), (c) => c.charCodeAt(0));
      const pdfUrl = window.URL.createObjectURL(
        new Blob([bytes], { type: 'application/pdf' }),
      );
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `Storno-Rechnung_${stornoInvoice.invoiceNumber || stornoInvoice.number || 'storno'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(pdfUrl);

      toast.success(t('StornoInvoice.pdfDownloadSuccess'));
    } catch (error) {
      console.error('PDF download error:', error);
      toast.error(
        t('StornoInvoice.pdfDownloadError', {
          message: error instanceof Error ? error.message : t('StornoInvoice.unknownError'),
        }),
      );
    }
  };

  const canBeStorniert = () => {
    // 'finalized' = finale Rechnung mit GoBD-Nummer (Formular-Speichern UND
    // automatische Check-out-Rechnung) — muss stornierbar sein wie sent/paid.
    return (
      (invoice.status === 'finalized' ||
        invoice.status === 'sent' ||
        invoice.status === 'paid') &&
      !invoice.isStorno
    );
  };

  if (!canBeStorniert()) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-amber-600">
            <Icon icon="lucide:alert-triangle" className="h-5 w-5" />
            <span className="font-medium">{t('StornoInvoice.cannotBeStornedTitle')}</span>
          </div>
          <p className="mt-2 text-amber-600 text-sm">
            {t('StornoInvoice.cannotBeStornedDescription')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Original Invoice Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon icon="lucide:file-text" className="h-5 w-5" />
            {t('StornoInvoice.originalInvoiceTitle')}
          </CardTitle>
          <CardDescription>{t('StornoInvoice.originalInvoiceDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Icon icon="lucide:hash" className="h-4 w-4 text-gray-500" />
                <span className="font-medium">{t('StornoInvoice.invoiceNumberLabel')}</span>
                <span>{invoice.sequentialNumber}</span>
              </div>
              <div className="flex items-center gap-2">
                <Icon icon="lucide:calendar" className="h-4 w-4 text-gray-500" />
                <span className="font-medium">{t('StornoInvoice.dateLabel')}</span>
                <span>{formatDate(invoice.issueDate)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Icon icon="lucide:user" className="h-4 w-4 text-gray-500" />
                <span className="font-medium">{t('StornoInvoice.customerLabel')}</span>
                <span>{invoice.customerName}</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Icon icon="lucide:banknote" className="h-4 w-4 text-gray-500" />
                <span className="font-medium">{t('StornoInvoice.amountLabel')}</span>
                <span className="font-bold text-lg">
                  {formatCurrency(invoice.total, invoice.currency)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{t('StornoInvoice.statusLabel')}</span>
                {getStatusBadge(invoice.status)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Storno Creation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <Icon icon="lucide:x" className="h-5 w-5" />
            {t('StornoInvoice.createCardTitle')}
          </CardTitle>
          <CardDescription>
            {t('StornoInvoice.createCardDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="stornoReason">{t('StornoInvoice.reasonFieldLabel')}</Label>
            <Textarea
              id="stornoReason"
              placeholder={t('StornoInvoice.reasonPlaceholder')}
              value={stornoReason}
              onChange={e => setStornoReason(e.target.value)}
              className="min-h-25"
            />
            <p className="text-gray-500 text-sm">
              {t('StornoInvoice.reasonHint')}
            </p>
          </div>

          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex gap-3">
              <Icon icon="lucide:alert-triangle" className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div>
                <h4 className="mb-1 font-medium text-red-800">
                  {t('StornoInvoice.importantNoticeTitle')}
                </h4>
                <ul className="space-y-1 text-red-700 text-sm">
                  <li>• {t('StornoInvoice.noticeNewNumber')}</li>
                  <li>• {t('StornoInvoice.noticeNegativeAmounts')}</li>
                  <li>• {t('StornoInvoice.noticeOriginalMarked')}</li>
                  <li>• {t('StornoInvoice.noticeIrreversible')}</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  disabled={!stornoReason.trim() || isCreatingStorno}
                  className="flex-1"
                >
                  <Icon icon="lucide:x" className="mr-2 h-4 w-4" />
                  {isCreatingStorno ? t('StornoInvoice.creatingStorno') : t('StornoInvoice.createButton')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                    <Icon icon="lucide:alert-triangle" className="h-5 w-5" />
                    {t('StornoInvoice.confirmDialogTitle')}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('StornoInvoice.confirmDialogQuestionPrefix')}{' '}
                    <strong>{invoice.sequentialNumber}</strong>{' '}
                    {t('StornoInvoice.confirmDialogQuestionSuffix')}
                    <br />
                    <br />
                    <strong>{t('StornoInvoice.confirmDialogReasonLabel')}</strong> {stornoReason}
                    <br />
                    <br />
                    {t('StornoInvoice.confirmDialogIrreversible')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('StornoInvoice.cancelButton')}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCreateStorno}
                    className="bg-red-600 hover:bg-red-700"
                    disabled={isCreatingStorno}
                  >
                    {isCreatingStorno ? t('StornoInvoice.creating') : t('StornoInvoice.confirmCreateButton')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* Storno Invoice Result */}
      {stornoInvoice && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <Icon icon="lucide:check-circle" className="h-5 w-5" />
              {t('StornoInvoice.resultCardTitle')}
            </CardTitle>
            <CardDescription>{t('StornoInvoice.resultCardDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Icon icon="lucide:hash" className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">{t('StornoInvoice.stornoNumberLabel')}</span>
                  <span className="font-bold">{stornoInvoice.sequentialNumber}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Icon icon="lucide:calendar" className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">{t('StornoInvoice.createdAtLabel')}</span>
                  <span>{formatDate(stornoInvoice.issueDate)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Icon icon="lucide:banknote" className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">{t('StornoInvoice.stornoAmountLabel')}</span>
                  <span className="font-bold text-red-600">
                    {formatCurrency(stornoInvoice.total, stornoInvoice.currency)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t('StornoInvoice.statusLabel')}</span>
                  {getStatusBadge(stornoInvoice.status)}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Dialog open={showStornoPreview} onOpenChange={setShowStornoPreview}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex-1">
                    <Icon icon="lucide:eye" className="mr-2 h-4 w-4" />
                    {t('StornoInvoice.showStornoButton')}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {t('StornoInvoice.previewDialogTitle', { number: stornoInvoice.sequentialNumber || '' })}
                    </DialogTitle>
                    <DialogDescription>{t('StornoInvoice.previewDialogDescription')}</DialogDescription>
                  </DialogHeader>
                  <div className="mt-4" ref={stornoPreviewRef}>
                    {/* documentType explizit als 'cancellation' setzen: das Storno-
                        Objekt trägt weder documentType noch einen 'sto'-Nummern-
                        präfix, sonst würde detectDocumentType es als 'Rechnung'
                        rendern (falsch beschrifteter Beleg mit negativen Beträgen). */}
                    <InvoiceTemplateRenderer
                      data={{ ...stornoInvoice, documentType: 'cancellation' }}
                      template="TEMPLATE_NEUTRAL"
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowStornoPreview(false)}>
                      {t('StornoInvoice.closeButton')}
                    </Button>
                    <Button
                      className="bg-accent hover:bg-accent/90"
                      onClick={handleDownloadStornoPdf}
                    >
                      <Icon icon="lucide:download" className="mr-2 h-4 w-4" />
                      {t('StornoInvoice.downloadPdfButton')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
