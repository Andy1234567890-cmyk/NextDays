'use client';

import { Icon } from '@iconify/react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
} from '@tasko/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { formatCurrency } from '@/lib/currency';
import type { InvoiceData } from '@/types/invoiceTypes';

interface EmailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: InvoiceData;
  companyId: string;
}

export function EmailDialog({ isOpen, onClose, invoice, companyId }: EmailDialogProps) {
  const t = useTranslations('finance');
  const locale = useLocale();
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (isOpen && invoice) {
      // Vorbefüllen mit Kundendaten
      const invoiceNumber = invoice.number || invoice.invoiceNumber || 'RE-XXXX';
      setEmailTo(invoice.customerEmail || '');
      setEmailSubject(t('EmailDialog.subjectPrefill', { invoiceNumber }));
      setEmailBody(
        t('EmailDialog.bodyPrefill', {
          invoiceNumber,
          amount: formatCurrency(invoice.total, invoice.currency),
          dueDate: new Date(invoice.dueDate).toLocaleDateString(locale),
          companyName: invoice.companyName || t('EmailDialog.yourCompanyFallback'),
        }),
      );
    }
  }, [isOpen, invoice, t]);

  const handleSendEmail = async () => {
    if (!emailTo || !emailSubject || !emailBody) {
      alert(t('EmailDialog.fillAllFields'));
      return;
    }

    setSending(true);
    try {
      const response = await fetch('/api/v1/send-invoice-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId: invoice.id,
          companyId: companyId,
          recipientEmail: emailTo,
          recipientName: invoice.customerName || t('EmailDialog.customerFallback'),
          subject: emailSubject,
          message: emailBody,
          senderName: invoice.companyName || t('EmailDialog.yourCompanyFallback'),
        }),
      });

      const result = await response.json();

      if (response.ok) {
        alert(
          t('EmailDialog.sendSuccess', {
            pdfStatus: result.pdfAttached
              ? t('EmailDialog.pdfIncluded')
              : t('EmailDialog.pdfUnavailable'),
            filename: result.attachmentFilename || t('EmailDialog.filenameNotAvailable'),
          }),
        );
        onClose();
      } else {
        throw new Error(result.error || t('EmailDialog.unknownError'));
      }
    } catch (error: any) {
      console.error('Fehler beim E-Mail-Versand:', error);
      alert(t('EmailDialog.sendError', { message: error.message }));
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon icon="lucide:mail" className="h-5 w-5" />
            {t('EmailDialog.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="emailTo">{t('EmailDialog.recipient')}</Label>
            <Input
              id="emailTo"
              type="email"
              value={emailTo}
              onChange={e => setEmailTo(e.target.value)}
              placeholder={t('EmailDialog.recipientPlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="emailSubject">{t('EmailDialog.subject')}</Label>
            <Input
              id="emailSubject"
              value={emailSubject}
              onChange={e => setEmailSubject(e.target.value)}
              placeholder={t('EmailDialog.subjectPlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="emailBody">{t('EmailDialog.message')}</Label>
            <Textarea
              id="emailBody"
              rows={8}
              value={emailBody}
              onChange={e => setEmailBody(e.target.value)}
              placeholder={t('EmailDialog.messagePlaceholder')}
            />
          </div>

          <div className="rounded border border-green-200 bg-green-50 p-3 text-gray-600 text-sm">
            <div className="flex items-center gap-2">
              <Icon icon="lucide:mail" className="h-4 w-4 text-green-600" />
              <strong className="text-green-800">{t('EmailDialog.pdfAttachmentLabel')}</strong>
              <span>{t('EmailDialog.pdfAttachmentHint')}</span>
            </div>
            <div className="mt-1 text-green-700 text-xs">
              {t('EmailDialog.filenamePreview', {
                invoiceNumber: invoice.number || invoice.invoiceNumber || 'RE-XXXX',
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSendEmail}
              disabled={sending}
              className="bg-accent text-white hover:bg-accent/90"
            >
              {sending ? (
                <>
                  <Icon icon="lucide:loader2" className="mr-2 h-4 w-4 animate-spin" />
                  {t('EmailDialog.sending')}
                </>
              ) : (
                <>
                  <Icon icon="lucide:mail" className="mr-2 h-4 w-4" />
                  {t('EmailDialog.send')}
                </>
              )}
            </Button>
            <Button variant="outline" onClick={onClose}>
              {t('EmailDialog.cancel')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
