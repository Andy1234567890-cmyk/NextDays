'use client';

import { Icon } from '@iconify/react';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Dialog,
  DialogContent,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from '@tasko/ui';
import { useTranslations } from 'next-intl';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useGoBDActionWarning } from '@/components/finance/gobd';

import { useNewAuth } from '@/contexts/NewAuthContext';
import { api } from '@/lib/api-client';
import { GoBDService } from '@/services/gobdService';
import { WhatsAppNotificationService } from '@/services/whatsapp-notifications.service';

interface EmailRecipient {
  email: string;
  name?: string;
}

/**
 * Flexibler Dokument-Typ für alle unterstützten Dokumentarten
 */
interface DocumentData {
  id: string;
  invoiceNumber?: string;
  number?: string;
  documentNumber?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  companyName?: string;
  total?: number;
  dueDate?: string;
  gobdStatus?: {
    isLocked?: boolean;
    auditTrail?: unknown[];
  };
  items?: { id: string; description: string; quantity: number; unitPrice: number; total: number }[];
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: {
      street?: string;
      zipCode?: string;
      city?: string;
      country?: string;
    };
    taxNumber?: string;
    vatId?: string;
  };
}

interface EmailSendModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentData;
  documentType:
    | 'invoice'
    | 'quote'
    | 'delivery'
    | 'order'
    | 'reminder'
    | 'credit-note'
    | 'cancellation'
    | 'contract'
    | 'receipt';
  companyId: string;
  selectedTemplate: string; // Template from SendDocumentModal
  // Ungenutzt: es gibt nur den generate-pdf-single-Endpunkt (Playwright paginiert
  // selbst). Prop bleibt für Aufrufer-Kompatibilität, wird aber nicht mehr gelesen.
  pageMode?: 'single' | 'multi';
  getRenderedHtml: () => Promise<string | null>; // Get rendered HTML from SendDocumentModal
  isTemplateReady: boolean; // Check if template is rendered and ready
  _onSend?: (emailData: EmailSendData) => Promise<void>;
  companyData?: {
    name: string;
    email: string;
    signature?: string;
  };
  defaultRecipients?: string[];
  // GoBD-Funktionalität
  enableGoBDLocking?: boolean; // Automatische Festschreibung aktivieren
  onDocumentLocked?: (documentId: string) => void; // Callback nach Festschreibung
}

interface EmailAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  base64: string;
}

interface EmailSendData {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  message: string;
  signature?: string;
  sendCopy: boolean;
  attachments: EmailAttachment[];
  priority?: 'normal' | 'high' | 'low';
  scheduledSend?: Date;
  trackOpening?: boolean;
}

export function EmailSendModal({
  isOpen,
  onClose,
  document,
  documentType,
  companyId,
  selectedTemplate,
  getRenderedHtml,
  isTemplateReady,
  _onSend,
  companyData,
  defaultRecipients = [],
  enableGoBDLocking = true,
  onDocumentLocked,
}: EmailSendModalProps) {
  const t = useTranslations('finance');
  const [sending, setSending] = useState(false);
  const initializedRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useNewAuth();
  const { showWarning, WarningComponent } = useGoBDActionWarning();

  // Email form fields
  const [recipients, setRecipients] = useState<EmailRecipient[]>([]);
  const [ccRecipients, setCcRecipients] = useState<EmailRecipient[]>([]);
  const [bccRecipients, setBccRecipients] = useState<EmailRecipient[]>([]);
  const [currentRecipient, setCurrentRecipient] = useState('');
  const [currentCC, setCurrentCC] = useState('');
  const [currentBCC, setCurrentBCC] = useState('');

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [signature, setSignature] = useState('');
  const [sendCopy, setSendCopy] = useState(false);

  // Attachments
  const [additionalAttachments, setAdditionalAttachments] = useState<EmailAttachment[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);

  // UI states
  const [showCC, setShowCC] = useState(false);
  const [showBCC, setShowBCC] = useState(false);

  // Memoized document values to prevent infinite loops
  const documentLabels = useMemo(
    () => ({
      invoice: t('EmailSendModal.documentLabels.invoice'),
      quote: t('EmailSendModal.documentLabels.quote'),
      reminder: t('EmailSendModal.documentLabels.reminder'),
      delivery: t('EmailSendModal.documentLabels.delivery'),
      order: t('EmailSendModal.documentLabels.order'),
      'credit-note': t('EmailSendModal.documentLabels.creditNote'),
      cancellation: t('EmailSendModal.documentLabels.cancellation'),
      contract: t('EmailSendModal.documentLabels.contract'),
      receipt: t('EmailSendModal.documentLabels.receipt'),
    }),
    [t],
  );

  const documentLabel = useMemo(
    () => documentLabels[documentType as keyof typeof documentLabels] || t('EmailSendModal.documentLabels.generic'),
    [documentLabels, documentType, t],
  );

  const documentNumber = useMemo(
    () => document?.invoiceNumber || document?.number || document?.id || t('EmailSendModal.unknown'),
    [document?.invoiceNumber, document?.number, document?.id, t],
  );

  // Initialize default values - Optimized to prevent infinite loops
  useEffect(() => {
    if (isOpen && document) {
      // Calculate values inside useEffect to avoid dependency issues
      const currentDocumentNumber =
        document.invoiceNumber || document.number || document.id || t('EmailSendModal.unknown');
      const currentDocumentLabel =
        documentLabels[documentType as keyof typeof documentLabels] ||
        t('EmailSendModal.documentLabels.generic');

      // Prevent multiple initializations for the same document
      const documentKey = `${document.id}-${documentType}`;
      if (initializedRef.current === documentKey) {
        return;
      }
      initializedRef.current = documentKey;

      // Reset all fields first
      setRecipients([]);
      setCcRecipients([]);
      setBccRecipients([]);
      setCurrentRecipient('');
      setCurrentCC('');
      setCurrentBCC('');
      setShowCC(false);
      setShowBCC(false);
      setAdditionalAttachments([]);
      setUploadingFile(false);

      // Set default recipients from multiple sources
      const recipientsList: EmailRecipient[] = [];

      // Add customer email if available
      if (document.customerEmail) {
        recipientsList.push({
          email: document.customerEmail,
          name: document.customerName || document.customer?.name,
        });
      }

      // Add default recipients if provided
      defaultRecipients.forEach(email => {
        if (email && !recipientsList.find(r => r.email === email)) {
          recipientsList.push({ email });
        }
      });

      setRecipients(recipientsList);

      // Set dynamic subject based on document type. Kein Brand-Fallback: fehlt
      // der Firmenname, entfällt der „von …"-Zusatz (statt einen Fremdbrand wie
      // „NextDays" zu erfinden — Projektregel: keine Fallback-Ersatzwerte).
      const fromCompany = companyData?.name
        ? t('EmailSendModal.subjectTemplates.fromCompanySuffix', { company: companyData.name })
        : '';
      const subjectTemplates = {
        invoice: t('EmailSendModal.subjectTemplates.invoice', {
          number: currentDocumentNumber,
          fromCompany,
        }),
        quote: t('EmailSendModal.subjectTemplates.quote', {
          number: currentDocumentNumber,
          fromCompany,
        }),
        reminder: t('EmailSendModal.subjectTemplates.reminder', { number: currentDocumentNumber }),
        delivery: t('EmailSendModal.subjectTemplates.delivery', { number: currentDocumentNumber }),
        order: t('EmailSendModal.subjectTemplates.order', { number: currentDocumentNumber }),
        'credit-note': t('EmailSendModal.subjectTemplates.creditNote', {
          number: currentDocumentNumber,
        }),
        cancellation: t('EmailSendModal.subjectTemplates.cancellation', {
          number: currentDocumentNumber,
        }),
        contract: t('EmailSendModal.subjectTemplates.contract', { number: currentDocumentNumber }),
        receipt: t('EmailSendModal.subjectTemplates.receipt', { number: currentDocumentNumber }),
      };

      setSubject(
        subjectTemplates[documentType as keyof typeof subjectTemplates] ||
          `${currentDocumentLabel} ${currentDocumentNumber}`,
      );

      // Set dynamic message based on document type
      const messageTemplates = {
        invoice: t('EmailSendModal.messageTemplates.invoice', { number: currentDocumentNumber }),
        quote: t('EmailSendModal.messageTemplates.quote', { number: currentDocumentNumber }),
        reminder: t('EmailSendModal.messageTemplates.reminder', { number: currentDocumentNumber }),
        delivery: t('EmailSendModal.messageTemplates.delivery', { number: currentDocumentNumber }),
      };

      const defaultMessage =
        messageTemplates[documentType as keyof typeof messageTemplates] ||
        t('EmailSendModal.messageTemplates.generic');

      setMessage(defaultMessage);

      // Set company signature if available
      if (companyData?.signature) {
        setSignature(companyData.signature);
      }
    } else if (!isOpen) {
      // Reset initialization tracking when modal closes
      initializedRef.current = null;
    }
  }, [
    isOpen,
    document?.id,
    documentType,
    companyData?.name,
    companyData?.signature,
    defaultRecipients,
    documentLabels,
    document.customer?.name,
    document.customerEmail,
    document.customerName,
    document.invoiceNumber,
    document,
    t,
  ]);

  // Email validation
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Add recipient handlers
  const addRecipient = (email: string, type: 'to' | 'cc' | 'bcc' = 'to') => {
    if (!email.trim() || !isValidEmail(email.trim())) return;

    const newRecipient = { email: email.trim() };

    switch (type) {
      case 'to':
        if (!recipients.find(r => r.email === email.trim())) {
          setRecipients([...recipients, newRecipient]);
        }
        setCurrentRecipient('');
        break;
      case 'cc':
        if (!ccRecipients.find(r => r.email === email.trim())) {
          setCcRecipients([...ccRecipients, newRecipient]);
        }
        setCurrentCC('');
        break;
      case 'bcc':
        if (!bccRecipients.find(r => r.email === email.trim())) {
          setBccRecipients([...bccRecipients, newRecipient]);
        }
        setCurrentBCC('');
        break;
    }
  };

  // Remove recipient handlers
  const removeRecipient = (index: number, type: 'to' | 'cc' | 'bcc') => {
    switch (type) {
      case 'to':
        setRecipients(recipients.filter((_, i) => i !== index));
        break;
      case 'cc':
        setCcRecipients(ccRecipients.filter((_, i) => i !== index));
        break;
      case 'bcc':
        setBccRecipients(bccRecipients.filter((_, i) => i !== index));
        break;
    }
  };

  // Handle key press for recipient input
  const handleRecipientKeyPress = (e: React.KeyboardEvent, type: 'to' | 'cc' | 'bcc') => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const value = type === 'to' ? currentRecipient : type === 'cc' ? currentCC : currentBCC;
      addRecipient(value, type);
    }
  };

  // Handle blur for recipient input
  const handleRecipientBlur = (type: 'to' | 'cc' | 'bcc') => {
    const value = type === 'to' ? currentRecipient : type === 'cc' ? currentCC : currentBCC;
    if (value.trim()) {
      addRecipient(value, type);
    }
  };

  // File upload handlers
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadingFile(true);

    try {
      const newAttachments: EmailAttachment[] = [];

      for (const file of Array.from(files)) {
        // Check file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(t('EmailSendModal.toasts.fileTooLarge', { fileName: file.name }));
          continue;
        }

        // Check file type
        const allowedTypes = [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'image/gif',
          'text/plain',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ];

        if (!allowedTypes.includes(file.type)) {
          toast.error(t('EmailSendModal.toasts.fileTypeUnsupported', { fileType: file.type }));
          continue;
        }

        // Convert to base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const base64Data = result.split(',')[1]; // Remove data:mime;base64, prefix
            resolve(base64Data);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const attachment: EmailAttachment = {
          id: `attachment-${Date.now()}-${Math.random()}`,
          name: file.name,
          size: file.size,
          type: file.type,
          base64,
        };

        newAttachments.push(attachment);
      }

      setAdditionalAttachments(prev => [...prev, ...newAttachments]);

      if (newAttachments.length > 0) {
        toast.success(
          t('EmailSendModal.toasts.filesAdded', { count: newAttachments.length }),
        );
      }
    } catch (error) {
      console.error('File upload error:', error);
      toast.error(t('EmailSendModal.toasts.fileUploadError'));
    } finally {
      setUploadingFile(false);
      // Reset input
      event.target.value = '';
    }
  };

  // Remove attachment
  const removeAttachment = (attachmentId: string) => {
    setAdditionalAttachments(prev => prev.filter(att => att.id !== attachmentId));
    toast.success(t('EmailSendModal.toasts.attachmentRemoved'));
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
  };

  // Get file icon by type
  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return '🖼️';
    if (type === 'application/pdf') return '📄';
    if (type.includes('word')) return '📝';
    if (type.includes('excel') || type.includes('sheet')) return '📊';
    return '📎';
  };

  // ✅ Generate PDF using the rendered HTML from SendDocumentModal
  const generatePdfBase64 = async (): Promise<string | null> => {
    try {
      // ✅ Prüfung ob Template bereit ist
      if (!isTemplateReady) {
        console.error('Template not ready - cannot generate PDF');
        throw new Error(t('EmailSendModal.errors.templateNotReady'));
      }

      // ✅ Get HTML Content direkt
      const htmlContent = await getRenderedHtml();

      if (!htmlContent || htmlContent.trim().length === 0) {
        console.error('No HTML content received from template');
        throw new Error(t('EmailSendModal.errors.templateNotRendered'));
      }

      // Es gibt genau EINEN PDF-Render-Endpunkt: /api/v1/generate-pdf-single
      // (Playwright, paginiert HTML automatisch über @page A4 — auch mehrseitige
      // Belege). Der frühere '…-multi'-Pfad existierte nicht (weder Next-Route noch
      // FastAPI) → 404 „PDF generation failed" und der Versand brach ab. Daher
      // immer den Single-Endpunkt nutzen, unabhängig von pageMode/Positionszahl.
      const response = await fetch('/api/v1/generate-pdf-single', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          htmlContent: htmlContent,
          template: selectedTemplate,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('PDF API failed:', response.status, errorText);
        let errorData: any;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          throw new Error(
            t('EmailSendModal.errors.pdfGenerationFailedWithStatus', {
              status: response.status,
              errorText,
            }),
          );
        }
        throw new Error(errorData.error || t('EmailSendModal.errors.pdfGenerationFailed'));
      }

      const result = await response.json();

      if (!result.pdfBase64 || result.pdfBase64.trim().length === 0) {
        console.error('PDF API returned empty base64');
        throw new Error(t('EmailSendModal.errors.pdfGenerationEmpty'));
      }

      return result.pdfBase64;
    } catch (error) {
      console.error('PDF generation failed:', error);
      throw error; // Re-throw instead of returning null for better error handling
    }
  };

  /**
   * Lädt die Handynummer des Kunden via FastAPI
   * Falls customerPhone nicht in der Rechnung vorhanden ist
   */
  const loadCustomerPhone = async (): Promise<string | null> => {
    // 1. Prüfe ob Phone bereits in Rechnung vorhanden
    const existingPhone = document?.customerPhone || document?.customer?.phone;
    if (existingPhone) {
      return existingPhone;
    }

    // 2. Suche Kunde via FastAPI anhand von E-Mail oder Name
    try {
      if (document?.customerEmail) {
        const result = await api.get<any>(
          `/api/v1/finance/customers?search=${encodeURIComponent(document.customerEmail)}`,
          { headers: { 'x-company-id': companyId || '' } },
        );
        const customers = Array.isArray(result) ? result : result?.customers || [];
        const match = customers.find((c: any) => c.email === document.customerEmail);
        if (match) return match.phone || null;
      }

      if (document?.customerName) {
        const result = await api.get<any>(
          `/api/v1/finance/customers?search=${encodeURIComponent(document.customerName)}`,
          { headers: { 'x-company-id': companyId || '' } },
        );
        const customers = Array.isArray(result) ? result : result?.customers || [];
        const match = customers.find(
          (c: any) =>
            c.name === document.customerName ||
            c.displayName === document.customerName ||
            c.display_name === document.customerName,
        );
        if (match) return match.phone || null;
      }
    } catch {
      // Fehler beim Laden - nicht kritisch
    }

    return null;
  };

  // Handle send with GoBD confirmation
  const handleSend = async () => {
    if (recipients.length === 0) {
      toast.error(t('EmailSendModal.toasts.recipientRequired'));
      return;
    }

    if (!subject.trim()) {
      toast.error(t('EmailSendModal.toasts.subjectRequired'));
      return;
    }

    // GoBD-Bestätigung nur für Rechnungen (nicht für Angebote, Lieferscheine etc.)
    if (enableGoBDLocking && documentType === 'invoice') {
      showWarning({
        actionType: 'email',
        documentType: t('EmailSendModal.invoiceDocumentType'),
        documentNumber: document.documentNumber,
        companyId: companyId || 'unknown',
        documentId: document.id,
        isAlreadyLocked: document.gobdStatus?.isLocked || false,
        onConfirm: performSend,
      });
      return;
    }

    // Direkter Versand wenn keine GoBD-Bestätigung nötig
    await performSend();
  };

  // Eigentliche Send-Funktion (aus der ursprünglichen handleSend extrahiert)
  const performSend = async () => {
    setSending(true);

    try {
      toast.message(t('EmailSendModal.toasts.creatingPdf'));

      // Generate PDF - will throw error if it fails
      const pdfBase64 = await generatePdfBase64();

      toast.message(t('EmailSendModal.toasts.sendingEmail'));

      // Absender-Slug aus dem echten Firmennamen \u2014 KEIN 'nextdays'-Fallback
      // (erfundener Fremdbrand als Absenderidentit\u00e4t; Projektregel: keine
      // Fallback-Ersatzwerte). Ohne Firmennamen den Versand sauber abbrechen.
      const companySlug = (document.companyName || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');
      if (!companySlug) {
        toast.error(t('EmailSendModal.toasts.companyNameRequired'));
        return;
      }

      // Send email via API
      const response = await fetch('/api/v1/email/send-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: recipients.map(r => r.email),
          cc: ccRecipients.length > 0 ? ccRecipients.map(r => r.email) : undefined,
          bcc: bccRecipients.length > 0 ? bccRecipients.map(r => r.email) : undefined,
          subject: subject.trim(),
          message: message.trim(),
          signature: signature.trim() || undefined,
          sendCopy,
          attachments: [
            {
              filename: `${documentNumber}.pdf`,
              contentBase64: pdfBase64,
            },
            // Add additional attachments
            ...additionalAttachments.map(att => ({
              filename: att.name,
              contentBase64: att.base64,
            })),
          ],

          companySlug,
          documentType,
          meta: {
            companyId,
            documentId: document.id,
            source: 'email-send-modal',
          },
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success(t('EmailSendModal.toasts.emailSent'));

        // 🔒 GoBD-Festschreibung nach erfolgreichem Versand (nur für Rechnungen)
        if (enableGoBDLocking && user && documentType === 'invoice') {
          try {
            const lockSuccess = await GoBDService.autoLockOnSend(
              companyId || 'unknown',
              document.id,
              user.uid,
              `${user.first_name} ${user.last_name}` || 'Unknown User',
            );

            if (lockSuccess) {
              onDocumentLocked?.(document.id);
            }
          } catch {
            // Nicht kritisch - E-Mail wurde bereits versendet
            toast.warning(t('EmailSendModal.toasts.lockFailed'));
          }
        }

        // WhatsApp-Benachrichtigung senden (nur für Rechnungen)
        if (documentType === 'invoice') {
          try {
            const customerPhone = await loadCustomerPhone();

            if (customerPhone) {
              // Kunden-ID ermitteln (falls vorhanden)
              let customerId = '';
              if (document?.customerEmail) {
                try {
                  const custResult = await api.get<any>(
                    `/api/v1/finance/customers?search=${encodeURIComponent(document.customerEmail)}`,
                    { headers: { 'x-company-id': companyId || '' } },
                  );
                  const customers = Array.isArray(custResult)
                    ? custResult
                    : custResult?.customers || [];
                  const match = customers.find((c: any) => c.email === document.customerEmail);
                  if (match) customerId = match.id;
                } catch {
                  /* nicht kritisch */
                }
              }

              await WhatsAppNotificationService.notifyInvoiceSent(
                companyId,
                // Kein Brand-Fallback: echter Firmenname oder leer (kein erfundenes
                // „NextDays"). Projektregel: keine Fallback-Ersatzwerte.
                companyData?.name || document?.companyName || '',
                customerId,
                document?.customerName || '',
                customerPhone,
                document?.invoiceNumber || documentNumber,
                document?.total || 0,
                document?.dueDate || '',
                document?.id,
              );
            }
          } catch {
            // WhatsApp-Fehler nicht kritisch - E-Mail wurde bereits versendet
          }
        }

        // WhatsApp-Benachrichtigung senden (für Angebote)
        if (documentType === 'quote') {
          try {
            const customerPhone = await loadCustomerPhone();

            if (customerPhone) {
              // Kunden-ID ermitteln (falls vorhanden)
              let customerId = '';
              if (document?.customerEmail) {
                try {
                  const custResult = await api.get<any>(
                    `/api/v1/finance/customers?search=${encodeURIComponent(document.customerEmail)}`,
                    { headers: { 'x-company-id': companyId || '' } },
                  );
                  const customers = Array.isArray(custResult)
                    ? custResult
                    : custResult?.customers || [];
                  const match = customers.find((c: any) => c.email === document.customerEmail);
                  if (match) customerId = match.id;
                } catch {
                  /* nicht kritisch */
                }
              }

              await WhatsAppNotificationService.notifyQuoteSent(
                companyId,
                customerId,
                document?.customerName || '',
                customerPhone,
                document?.id,
              );
            }
          } catch {
            // WhatsApp-Fehler nicht kritisch - E-Mail wurde bereits versendet
          }
        }

        onClose();
      } else {
        throw new Error(result.error || t('EmailSendModal.errors.sendFailed'));
      }
    } catch (error) {
      console.error('Email send error:', error);
      toast.error(error instanceof Error ? error.message : t('EmailSendModal.errors.sendFailedGeneric'));
    } finally {
      setSending(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[95vh] w-[95vw] max-w-5xl flex-col gap-0 p-0 [&>button]:hidden">
        {/* Header mit NextDays Branding - Fixed */}
        <div className="shrink-0 bg-linear-to-r from-accent to-accent/90 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-white/20 p-2">
                <Icon icon="lucide:mail" className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="font-semibold text-white text-xl">
                  {t('EmailSendModal.header.title')}
                </DialogTitle>
                <p className="mt-1 text-sm text-white/80">
                  {t('EmailSendModal.header.subtitle', { documentLabel, documentNumber })}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-9 w-9 p-0 text-white hover:bg-white/20 hover:text-white"
            >
              <Icon icon="lucide:x" className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="min-h-0 flex-1 overflow-y-auto" style={{ maxHeight: 'calc(95vh - 200px)' }}>
          <div className="min-h-full space-y-6 p-6">
            {/* Status Alert bei nicht bereitem Template */}
            {!isTemplateReady && (
              <Alert className="border-orange-200 bg-orange-50">
                <Icon icon="lucide:alert-triangle" className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  {t('EmailSendModal.templateLoading')}
                </AlertDescription>
              </Alert>
            )}

            {/* Recipients Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon icon="lucide:user" className="h-4 w-4 text-accent" />
                    <CardTitle className="text-base">{t('EmailSendModal.recipients.title')}</CardTitle>
                  </div>
                  <div className="flex gap-2">
                    {!showCC && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowCC(true)}
                        className="h-7 px-2 text-accent hover:text-accent/90"
                      >
                        {t('EmailSendModal.recipients.addCc')}
                      </Button>
                    )}
                    {!showBCC && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowBCC(true)}
                        className="h-7 px-2 text-accent hover:text-accent/90"
                      >
                        {t('EmailSendModal.recipients.addBcc')}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* To Field */}
                <div className="space-y-2">
                  <Label className="font-medium text-sm">
                    {t('EmailSendModal.recipients.toLabel')} <span className="text-red-500">*</span>
                  </Label>

                  <div className="flex min-h-12.5 flex-wrap items-center gap-2 rounded-lg border bg-gray-50/50 p-3 focus-within:ring-2 focus-within:ring-accent">
                    {recipients.map((recipient, index) => (
                      <Badge
                        key={index}
                        className="flex items-center gap-1 border-accent/20 bg-accent/10 px-3 py-1 text-accent hover:bg-accent/20"
                      >
                        <Icon icon="lucide:mail" className="h-3 w-3" />
                        <span className="font-medium">{recipient.name || recipient.email}</span>
                        {recipient.name && (
                          <span className="text-xs opacity-70">({recipient.email})</span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeRecipient(index, 'to')}
                          className="ml-1 transition-colors hover:text-red-600"
                        >
                          <Icon icon="lucide:x" className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    <Input
                      value={currentRecipient}
                      onChange={e => setCurrentRecipient(e.target.value)}
                      onKeyDown={e => handleRecipientKeyPress(e, 'to')}
                      onBlur={() => handleRecipientBlur('to')}
                      placeholder={t('EmailSendModal.recipients.toPlaceholder')}
                      className="min-w-50 flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                    />
                  </div>
                </div>

                {/* CC Field */}
                {showCC && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="font-medium text-sm">{t('EmailSendModal.recipients.ccLabel')}</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowCC(false);
                          setCcRecipients([]);
                          setCurrentCC('');
                        }}
                        className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                      >
                        <Icon icon="lucide:x" className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex min-h-13 flex-wrap items-center gap-2 rounded-lg border bg-gray-50/50 p-3 focus-within:ring-2 focus-within:ring-accent">
                      {ccRecipients.map((recipient, index) => (
                        <Badge
                          key={index}
                          className="flex items-center gap-1 border-blue-200 bg-blue-100 px-3 py-1 text-blue-700"
                        >
                          <Icon icon="lucide:mail" className="h-3 w-3" />
                          <span className="font-medium">{recipient.name || recipient.email}</span>
                          {recipient.name && (
                            <span className="text-xs opacity-70">({recipient.email})</span>
                          )}
                          <button
                            type="button"
                            onClick={() => removeRecipient(index, 'cc')}
                            className="ml-1 transition-colors hover:text-red-600"
                          >
                            <Icon icon="lucide:x" className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                      <Input
                        value={currentCC}
                        onChange={e => setCurrentCC(e.target.value)}
                        onKeyDown={e => handleRecipientKeyPress(e, 'cc')}
                        onBlur={() => handleRecipientBlur('cc')}
                        placeholder={t('EmailSendModal.recipients.ccPlaceholder')}
                        className="min-w-50 flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                      />
                    </div>
                  </div>
                )}

                {/* BCC Field */}
                {showBCC && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="font-medium text-sm">{t('EmailSendModal.recipients.bccLabel')}</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowBCC(false);
                          setBccRecipients([]);
                          setCurrentBCC('');
                        }}
                        className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                      >
                        <Icon icon="lucide:x" className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex min-h-13 flex-wrap items-center gap-2 rounded-lg border bg-gray-50/50 p-3 focus-within:ring-2 focus-within:ring-accent">
                      {bccRecipients.map((recipient, index) => (
                        <Badge
                          key={index}
                          className="flex items-center gap-1 border-purple-200 bg-purple-100 px-3 py-1 text-purple-700"
                        >
                          <Icon icon="lucide:mail" className="h-3 w-3" />
                          <span className="font-medium">{recipient.name || recipient.email}</span>
                          {recipient.name && (
                            <span className="text-xs opacity-70">({recipient.email})</span>
                          )}
                          <button
                            type="button"
                            onClick={() => removeRecipient(index, 'bcc')}
                            className="ml-1 transition-colors hover:text-red-600"
                          >
                            <Icon icon="lucide:x" className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                      <Input
                        value={currentBCC}
                        onChange={e => setCurrentBCC(e.target.value)}
                        onKeyDown={e => handleRecipientKeyPress(e, 'bcc')}
                        onBlur={() => handleRecipientBlur('bcc')}
                        placeholder={t('EmailSendModal.recipients.bccPlaceholder')}
                        className="min-w-50 flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Subject Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Icon icon="lucide:message-square" className="h-4 w-4 text-accent" />
                  <CardTitle className="text-base">{t('EmailSendModal.subject.title')}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <Input
                  id="subject"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder={t('EmailSendModal.subject.placeholder')}
                  required
                  className="focus:border-accent focus:ring-accent"
                />
                {!subject.trim() && (
                  <p className="mt-1 text-red-500 text-xs">{t('EmailSendModal.subject.required')}</p>
                )}
              </CardContent>
            </Card>

            {/* Message Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Icon icon="lucide:file-text" className="h-4 w-4 text-accent" />
                  <CardTitle className="text-base">{t('EmailSendModal.message.title')}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  id="message"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder={t('EmailSendModal.message.placeholder')}
                  rows={8}
                  className="min-h-50 resize-none focus:border-accent focus:ring-accent"
                />
                <div className="mt-2 flex items-center justify-between text-gray-500 text-xs">
                  <span>{t('EmailSendModal.message.charCount', { count: message.length })}</span>
                  <span>{t('EmailSendModal.message.tip')}</span>
                </div>
              </CardContent>
            </Card>

            {/* Signature Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Icon icon="lucide:user" className="h-4 w-4 text-accent" />
                  <CardTitle className="text-base">{t('EmailSendModal.signature.title')}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  id="signature"
                  value={signature}
                  onChange={e => setSignature(e.target.value)}
                  placeholder={t('EmailSendModal.signature.placeholder')}
                  rows={4}
                  className="resize-none focus:border-accent focus:ring-accent"
                />
              </CardContent>
            </Card>

            {/* Attachments Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon icon="lucide:paperclip" className="h-4 w-4 text-accent" />
                    <CardTitle className="text-base">{t('EmailSendModal.attachments.title')}</CardTitle>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {t('EmailSendModal.attachments.fileCount', {
                      count: 1 + additionalAttachments.length,
                    })}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Main document attachment */}
                  <div className="flex items-center justify-between rounded-lg border border-accent/20 bg-accent/5 p-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded bg-accent/10 p-2">
                        <Icon icon="lucide:file-text" className="h-4 w-4 text-accent" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{documentNumber}.pdf</p>
                        <p className="text-gray-500 text-xs">{documentLabel}</p>
                      </div>
                    </div>
                    <Badge className="border-green-200 bg-green-100 text-green-700">
                      {t('EmailSendModal.attachments.mainDocument')}
                    </Badge>
                  </div>

                  {/* Additional attachments */}
                  {additionalAttachments.map(attachment => (
                    <div
                      key={attachment.id}
                      className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="rounded bg-gray-100 p-2 text-lg">
                          {getFileIcon(attachment.type)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-sm" title={attachment.name}>
                            {attachment.name}
                          </p>
                          <p className="text-gray-500 text-xs">{formatFileSize(attachment.size)}</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAttachment(attachment.id)}
                        className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 hover:text-red-700"
                        title={t('EmailSendModal.attachments.removeTitle')}
                      >
                        <Icon icon="lucide:trash2" className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  {/* File upload */}
                  <div className="space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.gif,.txt,.doc,.docx,.xls,.xlsx"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={uploadingFile}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-accent border-dashed text-accent hover:bg-accent/5"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingFile}
                    >
                      {uploadingFile ? (
                        <>
                          <Icon icon="lucide:loader2" className="mr-2 h-4 w-4 animate-spin" />
                          {t('EmailSendModal.attachments.uploading')}
                        </>
                      ) : (
                        <>
                          <Icon icon="lucide:upload" className="mr-2 h-4 w-4" />
                          {t('EmailSendModal.attachments.addMore')}
                        </>
                      )}
                    </Button>
                    <p className="text-center text-gray-500 text-xs">
                      {t('EmailSendModal.attachments.hint')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer mit verbessertem Design - Fixed */}
        <div className="shrink-0 border-t bg-linear-to-r from-gray-50 to-gray-100">
          <div className="p-6">
            {/* Options */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="send-copy"
                    checked={sendCopy}
                    onCheckedChange={checked => setSendCopy(checked === true)}
                    className="data-[state=checked]:border-accent data-[state=checked]:bg-accent"
                  />
                  <Label htmlFor="send-copy" className="font-medium text-sm">
                    {t('EmailSendModal.footer.sendCopy')}
                  </Label>
                </div>
              </div>

              {/* Email stats */}
              <div className="flex items-center gap-4 text-gray-500 text-xs">
                <span className="flex items-center gap-1">
                  <Icon icon="lucide:user" className="h-3 w-3" />
                  {t('EmailSendModal.footer.recipientCount', {
                    count: recipients.length + ccRecipients.length + bccRecipients.length,
                  })}
                </span>
                <span className="flex items-center gap-1">
                  <Icon icon="lucide:paperclip" className="h-3 w-3" />
                  {t('EmailSendModal.footer.attachmentCount', {
                    count: 1 + additionalAttachments.length,
                  })}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleCancel} disabled={sending} className="px-6">
                {t('EmailSendModal.footer.cancel')}
              </Button>
              <Button
                onClick={handleSend}
                disabled={sending || recipients.length === 0 || !subject.trim() || !isTemplateReady}
                className="bg-accent px-8 text-white shadow-lg hover:bg-accent/90"
              >
                {sending ? (
                  <>
                    <Icon icon="lucide:loader2" className="mr-2 h-4 w-4 animate-spin" />
                    {t('EmailSendModal.footer.sending')}
                  </>
                ) : (
                  <>
                    <Icon icon="lucide:send" className="mr-2 h-4 w-4" />
                    {t('EmailSendModal.footer.send')}
                  </>
                )}
              </Button>
            </div>

            {/* Help text */}
            {(!isTemplateReady || recipients.length === 0 || !subject.trim()) && (
              <div className="mt-3 text-gray-500 text-xs">
                {!isTemplateReady && t('EmailSendModal.footer.helpTemplateLoading')}
                {recipients.length === 0 && t('EmailSendModal.footer.helpRecipientRequired')}
                {!subject.trim() && t('EmailSendModal.footer.helpSubjectRequired')}
              </div>
            )}
          </div>
        </div>
      </DialogContent>

      {/* GoBD Confirmation Modal */}
      {WarningComponent}
    </Dialog>
  );
}

export default EmailSendModal;
