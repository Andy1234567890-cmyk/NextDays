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
import { useState } from 'react';
import { toast } from 'sonner';

import { useNewAuth } from '@/contexts/NewAuthContext';
import { InvoiceService } from '@/services/firestoreInvoiceService';
import type { InvoiceData } from '@/types/invoiceTypes';
import { InvoiceTemplateRenderer } from './InvoiceTemplates';

interface StornoInvoiceProps {
  invoice: InvoiceData;
  onStornoCreated?: (stornoInvoice: InvoiceData) => void;
}

export default function StornoInvoice({ invoice, onStornoCreated }: StornoInvoiceProps) {
  const [isCreatingStorno, setIsCreatingStorno] = useState(false);
  const [stornoReason, setStornoReason] = useState('');
  const [stornoInvoice, setStornoInvoice] = useState<InvoiceData | null>(null);
  const [showStornoPreview, setShowStornoPreview] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const { user } = useNewAuth();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('de-DE');
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: 'Entwurf', variant: 'secondary' as const, icon: 'lucide:file-text' },
      sent: { label: 'Gesendet', variant: 'default' as const, icon: 'lucide:check-circle' },
      paid: { label: 'Bezahlt', variant: 'default' as const, icon: 'lucide:check-circle' },
      overdue: {
        label: 'Überfällig',
        variant: 'destructive' as const,
        icon: 'lucide:alert-triangle',
      },
      cancelled: { label: 'Storniert', variant: 'secondary' as const, icon: 'lucide:x' },
      storno: { label: 'Storno', variant: 'destructive' as const, icon: 'lucide:x' },
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
      toast.error('Bitte geben Sie einen Grund für die Stornorechnung an');
      return;
    }

    if (!user) {
      toast.error('Sie müssen angemeldet sein');
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
      toast.success('Storno-Rechnung erfolgreich erstellt');

      if (onStornoCreated) {
        onStornoCreated(createdStornoInvoice);
      }

      setShowConfirmDialog(false);
      setStornoReason('');
    } catch (error) {
      console.error('Storno creation error:', error);
      toast.error('Fehler beim Erstellen der Storno-Rechnung');
    } finally {
      setIsCreatingStorno(false);
    }
  };

  const handleDownloadStornoPdf = async () => {
    if (!stornoInvoice) {
      toast.error('Keine Storno-Rechnung verfügbar');
      return;
    }

    try {
      toast.info('PDF wird erstellt...');

      // Nutze die bestehende PDF-Generation API
      const response = await fetch('/api/v1/generate-invoice-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceData: stornoInvoice,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'PDF-Generierung fehlgeschlagen');
      }

      const contentType = response.headers.get('content-type');

      // Prüfe ob wir direkt ein PDF erhalten haben (Development mit Puppeteer)
      if (contentType?.includes('application/pdf')) {
        const pdfBlob = await response.blob();
        const pdfUrl = window.URL.createObjectURL(pdfBlob);

        // Download auslösen
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = `Storno-Rechnung_${stornoInvoice.invoiceNumber || stornoInvoice.number || 'storno'}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(pdfUrl);

        toast.success('Storno-PDF erfolgreich heruntergeladen');
      } else {
        // Fallback: JSON Response mit Print-URL
        const data = await response.json();
        if (data.printUrl) {
          // Öffne Print-Seite in neuem Tab für Browser-basierte PDF-Generierung
          window.open(data.printUrl, '_blank');
          toast.success('Storno-PDF wird in neuem Tab geöffnet');
        } else {
          throw new Error('Keine PDF-URL erhalten');
        }
      }
    } catch (error) {
      console.error('PDF download error:', error);
      toast.error(
        `PDF-Download fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
      );
    }
  };

  const canBeStorniert = () => {
    return (invoice.status === 'sent' || invoice.status === 'paid') && !invoice.isStorno;
  };

  if (!canBeStorniert()) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-amber-600">
            <Icon icon="lucide:alert-triangle" className="h-5 w-5" />
            <span className="font-medium">Diese Rechnung kann nicht storniert werden</span>
          </div>
          <p className="mt-2 text-amber-600 text-sm">
            Nur gesendete oder bezahlte Rechnungen können storniert werden.
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
            Original-Rechnung
          </CardTitle>
          <CardDescription>Informationen zur zu stornierenden Rechnung</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Icon icon="lucide:hash" className="h-4 w-4 text-gray-500" />
                <span className="font-medium">Rechnungsnummer:</span>
                <span>{invoice.sequentialNumber}</span>
              </div>
              <div className="flex items-center gap-2">
                <Icon icon="lucide:calendar" className="h-4 w-4 text-gray-500" />
                <span className="font-medium">Datum:</span>
                <span>{formatDate(invoice.issueDate)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Icon icon="lucide:user" className="h-4 w-4 text-gray-500" />
                <span className="font-medium">Kunde:</span>
                <span>{invoice.customerName}</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Icon icon="lucide:euro" className="h-4 w-4 text-gray-500" />
                <span className="font-medium">Betrag:</span>
                <span className="font-bold text-lg">{formatCurrency(invoice.total)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Status:</span>
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
            Storno-Rechnung erstellen
          </CardTitle>
          <CardDescription>
            Erstellen Sie eine Storno-Rechnung für die oben genannte Original-Rechnung
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="stornoReason">Grund für die Stornorechnung *</Label>
            <Textarea
              id="stornoReason"
              placeholder="Geben Sie hier den Grund für die Stornorechnung ein..."
              value={stornoReason}
              onChange={e => setStornoReason(e.target.value)}
              className="min-h-25"
            />
            <p className="text-gray-500 text-sm">
              Der Stornogrund wird auf der Stornorechnung vermerkt und ist für die Buchhaltung
              erforderlich.
            </p>
          </div>

          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex gap-3">
              <Icon icon="lucide:alert-triangle" className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div>
                <h4 className="mb-1 font-medium text-red-800">
                  Wichtige Hinweise zur Stornorechnung
                </h4>
                <ul className="space-y-1 text-red-700 text-sm">
                  <li>• Die Storno-Rechnung erhält eine neue, fortlaufende Rechnungsnummer</li>
                  <li>• Alle Beträge werden negativ ausgewiesen (Gutschrift)</li>
                  <li>• Die Original-Rechnung wird als &quot;Storniert&quot; markiert</li>
                  <li>• Der Vorgang kann nicht rückgängig gemacht werden</li>
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
                  {isCreatingStorno ? 'Erstelle Storno...' : 'Storno-Rechnung erstellen'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                    <Icon icon="lucide:alert-triangle" className="h-5 w-5" />
                    Stornorechnung erstellen
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Sind Sie sicher, dass Sie die Rechnung{' '}
                    <strong>{invoice.sequentialNumber}</strong> stornieren möchten?
                    <br />
                    <br />
                    <strong>Grund:</strong> {stornoReason}
                    <br />
                    <br />
                    Diese Aktion kann nicht rückgängig gemacht werden.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCreateStorno}
                    className="bg-red-600 hover:bg-red-700"
                    disabled={isCreatingStorno}
                  >
                    {isCreatingStorno ? 'Erstelle...' : 'Stornorechnung erstellen'}
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
              Storno-Rechnung erfolgreich erstellt
            </CardTitle>
            <CardDescription>Die Storno-Rechnung wurde erstellt und gespeichert</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Icon icon="lucide:hash" className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">Storno-Nummer:</span>
                  <span className="font-bold">{stornoInvoice.sequentialNumber}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Icon icon="lucide:calendar" className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">Erstellt am:</span>
                  <span>{formatDate(stornoInvoice.issueDate)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Icon icon="lucide:euro" className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">Storno-Betrag:</span>
                  <span className="font-bold text-red-600">
                    {formatCurrency(stornoInvoice.total)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Status:</span>
                  {getStatusBadge(stornoInvoice.status)}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Dialog open={showStornoPreview} onOpenChange={setShowStornoPreview}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex-1">
                    <Icon icon="lucide:eye" className="mr-2 h-4 w-4" />
                    Storno-Rechnung anzeigen
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Storno-Rechnung {stornoInvoice.sequentialNumber}</DialogTitle>
                    <DialogDescription>Vorschau der erstellten Storno-Rechnung</DialogDescription>
                  </DialogHeader>
                  <div className="mt-4">
                    <InvoiceTemplateRenderer data={stornoInvoice} template="TEMPLATE_NEUTRAL" />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowStornoPreview(false)}>
                      Schließen
                    </Button>
                    <Button
                      className="bg-accent hover:bg-accent/90"
                      onClick={handleDownloadStornoPdf}
                    >
                      <Icon icon="lucide:download" className="mr-2 h-4 w-4" />
                      PDF herunterladen
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
