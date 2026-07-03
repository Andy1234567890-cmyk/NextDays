'use client';

import { Icon } from '@iconify/react';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
} from '@tasko/ui';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { api } from '@/lib/api-client';
import { InvoiceService } from '@/services/firestoreInvoiceService';
import { XRechnungParserService } from '@/services/xrechnungParserService';

interface ImportXRechnungDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  onSuccess?: () => void;
  defaultType?: 'income' | 'expense'; // 🎯 Optional: Default-Type basierend auf Kontext
}

export function ImportXRechnungDialog({
  open,
  onOpenChange,
  companyId,
  onSuccess,
  defaultType,
}: ImportXRechnungDialogProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [importType, setImportType] = useState<'income' | 'expense' | null>(null); // 🎯 Einnahme oder Ausgabe?
  const [companyData, setCompanyData] = useState<any>(null); // Für Auto-Detection

  // 🏢 Company-Daten laden für Auto-Detection
  useEffect(() => {
    const loadCompanyData = async () => {
      try {
        const companyData = await api.get(`/api/v1/companies/${companyId}`);
        setCompanyData(companyData);
      } catch (err) {
        console.error('Fehler beim Laden der Firmendaten:', err);
      }
    };
    loadCompanyData();
  }, [companyId]);

  // 🎯 Auto-Detection: Sobald Preview-Daten vorhanden, Type setzen
  useEffect(() => {
    if (previewData?.isOwnInvoice !== undefined) {
      setImportType(previewData.isOwnInvoice ? 'income' : 'expense');
    } else if (defaultType && !previewData) {
      // Fallback: Wenn kein Preview aber defaultType gesetzt, verwende defaultType
      setImportType(defaultType);
    }
  }, [previewData, defaultType]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    if (!selectedFile.name.endsWith('.xml')) {
      setError('Bitte wählen Sie eine XML-Datei aus');
      return;
    }

    setFile(selectedFile);
    setError(null);

    // Parse XML for preview (mit Company-Name für Auto-Detection)
    try {
      const xmlText = await selectedFile.text();
      const parsedData = await XRechnungParserService.parseXML(
        xmlText,
        companyData?.companyName || companyData?.name, // 🎯 Firmenname für Auto-Detection
      );
      setPreviewData(parsedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Lesen der Datei');
      setPreviewData(null);
    }
  };

  const handleImport = async () => {
    if (!file || !previewData || !importType) {
      toast.error('Bitte wählen Sie den Dokumenttyp (Einnahme oder Ausgabe)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (importType === 'income') {
        // � EINNAHME: Eigene Rechnung (eigenes Unternehmen ist Verkäufer)
        // �🔍 STEP 1: Customer Matching
        const { CustomerMatchingService } = await import('@/services/customerMatchingService');

        const matchedCustomer = await CustomerMatchingService.findMatchingCustomer(
          companyId,
          previewData.buyerName,
          previewData.buyerEmail,
          previewData.buyerReference,
        );

        if (matchedCustomer) {
          toast.success(
            `Kunde "${matchedCustomer.name}" gefunden (${matchedCustomer.matchReason})`,
          );
        } else {
          toast.info('Kein passender Kunde gefunden. Bitte Kunde nach Import anlegen.');
        }

        // 🔧 STEP 2: Convert to InvoiceData
        const invoiceData = XRechnungParserService.convertToInvoiceData(previewData, companyId);

        // 💾 STEP 3: Save invoice
        const invoiceId = await InvoiceService.saveInvoice(invoiceData as any);

        toast.success('📈 Einnahme erfolgreich importiert!');

        // Reset & Redirect
        setFile(null);
        setPreviewData(null);
        setImportType(null);
        onOpenChange(false);

        // Alt-Route existiert in NextDays nicht — Rechnungsliste mit Fokus
        // auf der importierten Rechnung (?invoice=) öffnen.
        router.push(`/buchhaltung?invoice=${encodeURIComponent(invoiceId)}`);
      } else {
        // 📉 AUSGABE: Lieferantenrechnung (eigenes Unternehmen ist Käufer)
        const expenseData = XRechnungParserService.convertToExpenseData(previewData, companyId);

        // 💾 Save expense via API
        const response = await fetch('/api/v1/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(expenseData),
        });

        if (!response.ok) {
          throw new Error('Fehler beim Speichern der Ausgabe');
        }

        const _result = await response.json();

        toast.success('📉 Ausgabe erfolgreich importiert!');

        // Reset & Redirect
        setFile(null);
        setPreviewData(null);
        setImportType(null);
        onOpenChange(false);

        // Alt-Route existiert in NextDays nicht — Ausgaben leben unter
        // /buchhaltung/ausgaben.
        router.push('/buchhaltung/ausgaben');
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Import Error:', err);
      setError(err instanceof Error ? err.message : 'Fehler beim Importieren');
      toast.error('Fehler beim Importieren der E-Rechnung');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreviewData(null);
    setError(null);
    setImportType(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon icon="lucide:file-text" className="h-5 w-5 text-accent" />
            E-Rechnung importieren
          </DialogTitle>
          <DialogDescription>
            {defaultType === 'expense'
              ? 'Laden Sie eine E-Rechnung hoch, um sie als Ausgabe (Lieferantenrechnung) zu importieren.'
              : 'Laden Sie eine XRechnung oder ZUGFeRD XML-Datei hoch, um sie als Rechnung zu importieren.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="xml-file">XML-Datei auswählen</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => document.getElementById('xml-file')?.click()}
              >
                <Icon icon="lucide:upload" className="mr-2 h-4 w-4" />
                {file ? file.name : 'XML-Datei hochladen'}
              </Button>
              {file && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setFile(null);
                    setPreviewData(null);
                    setError(null);
                    setImportType(null);
                  }}
                >
                  <Icon icon="lucide:x" className="h-4 w-4" />
                </Button>
              )}
            </div>
            <input
              id="xml-file"
              type="file"
              accept=".xml"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <Icon icon="lucide:alert-circle" className="mt-0.5 h-5 w-5 text-red-600" />
              <div className="flex-1">
                <p className="font-medium text-red-800 text-sm">Fehler</p>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Preview Data */}
          {previewData && !error && (
            <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center gap-2 text-green-600">
                <Icon icon="lucide:check-circle" className="h-5 w-5" />
                <span className="font-medium">E-Rechnung erfolgreich erkannt</span>
              </div>

              {/* 🎯 Type Selection: Einnahme oder Ausgabe */}
              {importType && (
                <Alert
                  className={`${importType === 'income' ? 'border-green-500 bg-green-50' : 'border-amber-500 bg-amber-50'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {importType === 'income' ? (
                        <Icon icon="lucide:trending-up" className="h-5 w-5 text-green-600" />
                      ) : (
                        <Icon icon="lucide:trending-down" className="h-5 w-5 text-amber-600" />
                      )}
                      <div>
                        <div className="mb-1 flex items-center gap-2">
                          <Badge
                            className={importType === 'income' ? 'bg-green-600' : 'bg-amber-600'}
                          >
                            {importType === 'income' ? '📈 Einnahme' : '📉 Ausgabe'}
                          </Badge>
                          <span className="text-gray-500 text-xs">Automatisch erkannt</span>
                        </div>
                        <AlertDescription className="text-sm">
                          {importType === 'income'
                            ? 'Eigene Rechnung erkannt (Sie sind der Verkäufer)'
                            : 'Lieferantenrechnung erkannt (Sie sind der Käufer)'}
                        </AlertDescription>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setImportType(prev => (prev === 'income' ? 'expense' : 'income'))
                      }
                      className="flex items-center gap-2"
                    >
                      <Icon icon="lucide:refresh-cw" className="h-4 w-4" />
                      Korrigieren
                    </Button>
                  </div>
                </Alert>
              )}

              <div className="space-y-4">
                {/* Basic Info */}
                {/* Basic Info */}
                <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-gray-500">Rechnungsnummer</p>
                    <p className="break-all font-medium">{previewData.invoiceNumber}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-gray-500">Datum</p>
                    <p className="font-medium">{previewData.issueDate}</p>
                  </div>
                </div>

                {/* Seller Info */}
                <div className="rounded border border-gray-200 bg-white p-3">
                  <p className="mb-2 font-medium text-gray-700 text-sm">Lieferant</p>
                  <p className="font-medium">{previewData.sellerName}</p>
                  <p className="text-gray-600 text-sm">
                    {previewData.sellerAddress.street}
                    <br />
                    {previewData.sellerAddress.postalCode} {previewData.sellerAddress.city}
                    <br />
                    {previewData.sellerAddress.country}
                  </p>
                  {previewData.sellerEmail && (
                    <p className="mt-1 text-gray-600 text-sm">📧 {previewData.sellerEmail}</p>
                  )}
                  {previewData.sellerTaxId && (
                    <p className="text-gray-600 text-sm">USt-IdNr.: {previewData.sellerTaxId}</p>
                  )}
                </div>

                {/* Buyer Info */}
                <div className="rounded border border-gray-200 bg-white p-3">
                  <p className="mb-2 font-medium text-gray-700 text-sm">Kunde</p>
                  <p className="font-medium">{previewData.buyerName}</p>
                  <p className="text-gray-600 text-sm">
                    {previewData.buyerAddress.street}
                    <br />
                    {previewData.buyerAddress.postalCode} {previewData.buyerAddress.city}
                    <br />
                    {previewData.buyerAddress.country}
                  </p>
                  {previewData.buyerEmail && (
                    <p className="mt-1 text-gray-600 text-sm">📧 {previewData.buyerEmail}</p>
                  )}
                </div>

                {/* Payment Info */}
                {previewData.iban && (
                  <div className="rounded border border-gray-200 bg-white p-3">
                    <p className="mb-2 font-medium text-gray-700 text-sm">Zahlungsinformationen</p>
                    <p className="text-gray-600 text-sm">
                      <span className="font-medium">IBAN:</span> {previewData.iban}
                    </p>
                    {previewData.bic && (
                      <p className="text-gray-600 text-sm">
                        <span className="font-medium">BIC:</span> {previewData.bic}
                      </p>
                    )}
                    {previewData.accountHolder && (
                      <p className="text-gray-600 text-sm">
                        <span className="font-medium">Kontoinhaber:</span>{' '}
                        {previewData.accountHolder}
                      </p>
                    )}
                    {previewData.paymentTerms && (
                      <p className="mt-1 text-gray-600 text-sm">{previewData.paymentTerms}</p>
                    )}
                  </div>
                )}

                {/* Amounts */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Netto</p>
                    <p className="font-medium">
                      {previewData.subtotal.toFixed(2)} {previewData.currency}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">MwSt.</p>
                    <p className="font-medium">
                      {previewData.taxAmount.toFixed(2)} {previewData.currency} (
                      {previewData.taxRate}%)
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-500">Gesamt</p>
                    <p className="font-bold text-accent text-lg">
                      {previewData.total.toFixed(2)} {previewData.currency}
                    </p>
                  </div>
                </div>
              </div>

              {/* Line Items Preview */}
              {previewData.lineItems && previewData.lineItems.length > 0 && (
                <div>
                  <p className="mb-2 font-medium text-gray-700 text-sm">
                    Positionen ({previewData.lineItems.length})
                  </p>
                  <div className="space-y-2">
                    {previewData.lineItems.map((item: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded border border-gray-200 bg-white p-2"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.description}</p>
                          <p className="text-gray-500 text-xs">
                            {item.quantity} × {item.unitPrice.toFixed(2)} {previewData.currency}
                          </p>
                        </div>
                        <p className="font-medium text-sm">
                          {item.totalAmount.toFixed(2)} {previewData.currency}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
            Abbrechen
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={!previewData || !!error || loading || !importType}
            className={`${
              importType === 'income'
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-amber-600 hover:bg-amber-700'
            } text-white`}
          >
            {loading
              ? 'Wird importiert...'
              : `Als ${importType === 'income' ? 'Einnahme' : 'Ausgabe'} importieren`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
