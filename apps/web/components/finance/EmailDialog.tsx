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
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (isOpen && invoice) {
      // Vorbefüllen mit Kundendaten
      setEmailTo(invoice.customerEmail || '');
      setEmailSubject(`Rechnung ${invoice.number || invoice.invoiceNumber || 'RE-XXXX'}`);
      setEmailBody(
        `Sehr geehrte Damen und Herren,\n\n` +
          `anbei erhalten Sie unsere Rechnung ${invoice.number || invoice.invoiceNumber || 'RE-XXXX'}.\n\n` +
          `Rechnungsbetrag: ${formatCurrency(invoice.total, invoice.currency)}\n` +
          `Fällig bis: ${new Date(invoice.dueDate).toLocaleDateString('de-DE')}\n\n` +
          `Bei Fragen stehen wir Ihnen gerne zur Verfügung.\n\n` +
          `Mit freundlichen Grüßen\n` +
          `${invoice.companyName || 'Ihr Unternehmen'}`,
      );
    }
  }, [isOpen, invoice]);

  const handleSendEmail = async () => {
    if (!emailTo || !emailSubject || !emailBody) {
      alert('Bitte füllen Sie alle Felder aus.');
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
          recipientName: invoice.customerName || 'Kunde',
          subject: emailSubject,
          message: emailBody,
          senderName: invoice.companyName || 'Ihr Unternehmen',
        }),
      });

      const result = await response.json();

      if (response.ok) {
        alert(
          `✅ E-Mail erfolgreich versendet!\n\nPDF-Anhang: ${result.pdfAttached ? '✅ Inklusive' : '❌ Nicht verfügbar'}\nDateiname: ${result.attachmentFilename || 'N/A'}`,
        );
        onClose();
      } else {
        throw new Error(result.error || 'Unbekannter Fehler');
      }
    } catch (error: any) {
      console.error('Fehler beim E-Mail-Versand:', error);
      alert(`❌ Fehler beim Versand der E-Mail:\n${error.message}`);
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
            Rechnung per E-Mail versenden
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="emailTo">Empfänger</Label>
            <Input
              id="emailTo"
              type="email"
              value={emailTo}
              onChange={e => setEmailTo(e.target.value)}
              placeholder="kunde@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="emailSubject">Betreff</Label>
            <Input
              id="emailSubject"
              value={emailSubject}
              onChange={e => setEmailSubject(e.target.value)}
              placeholder="Rechnung RE-XXXX"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="emailBody">Nachricht</Label>
            <Textarea
              id="emailBody"
              rows={8}
              value={emailBody}
              onChange={e => setEmailBody(e.target.value)}
              placeholder="Ihre Nachricht..."
            />
          </div>

          <div className="rounded border border-green-200 bg-green-50 p-3 text-gray-600 text-sm">
            <div className="flex items-center gap-2">
              <Icon icon="lucide:mail" className="h-4 w-4 text-green-600" />
              <strong className="text-green-800">PDF-Anhang:</strong>
              <span>Rechnung wird automatisch als PDF angehängt</span>
            </div>
            <div className="mt-1 text-green-700 text-xs">
              Dateiname: Rechnung_{invoice.number || invoice.invoiceNumber || 'RE-XXXX'}.pdf
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
                  Wird gesendet...
                </>
              ) : (
                <>
                  <Icon icon="lucide:mail" className="mr-2 h-4 w-4" />
                  E-Mail senden
                </>
              )}
            </Button>
            <Button variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
