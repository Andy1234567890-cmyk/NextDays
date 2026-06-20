'use client';

import { api } from '@/lib/api-client';
import { WhatsAppService, WhatsAppTemplates } from '@/services/whatsapp.service';

/**
 * Interface für Automatisierungs-Einstellungen
 */
interface AutomationSettings {
  orderConfirmation: {
    enabled: boolean;
    templateId: string;
    delay: number;
  };
  invoiceSent: {
    enabled: boolean;
    templateId: string;
  };
  invoicePaid: {
    enabled: boolean;
    templateId: string;
  };
  invoiceReminder: {
    enabled: boolean;
    templateId: string;
    daysAfterDue: number;
    maxReminders: number;
  };
  appointmentReminder: {
    enabled: boolean;
    templateId: string;
    hoursBefore: number;
  };
  quoteSent: {
    enabled: boolean;
    templateId: string;
  };
  quoteExpiring: {
    enabled: boolean;
    templateId: string;
    daysBefore: number;
  };
}

interface WhatsAppTemplate {
  originalBodyText?: string;
  body?: string;
}

/**
 * Automatische WhatsApp-Benachrichtigungen für Finance Events
 *
 * Integration mit InvoiceService, QuoteService, etc.
 * Berücksichtigt benutzerdefinierte Automatisierungs-Einstellungen
 */

export class WhatsAppNotificationService {
  /**
   * Lädt die Automatisierungs-Einstellungen via FastAPI
   */
  static async getAutomationSettings(companyId: string): Promise<AutomationSettings | null> {
    try {
      const response = await api.get<AutomationSettings>(
        `/api/v1/companies/${companyId}/integrations/whatsapp`,
      );
      return response ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Lädt Template-Text via FastAPI
   */
  static async getTemplateText(companyId: string, templateId: string): Promise<string | null> {
    try {
      const response = await api.get<WhatsAppTemplate>(
        `/api/v1/companies/${companyId}/integrations/whatsapp/templates/${templateId}`,
      );
      if (response) {
        return response.originalBodyText || response.body || null;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Sendet Benachrichtigung wenn Rechnung bezahlt wurde
   */
  static async notifyInvoicePaid(
    companyId: string,
    companyName: string,
    customerId: string,
    customerName: string,
    customerPhone: string,
    invoiceNumber: string,
    amount: number,
    invoiceId?: string,
  ): Promise<void> {
    try {
      if (!customerPhone) return;

      // Prüfe ob Automatisierung aktiviert ist
      const settings = await WhatsAppNotificationService.getAutomationSettings(companyId);

      if (!settings?.invoicePaid?.enabled) return;

      // Hole Template-Text via API
      const templateText = settings.invoicePaid.templateId
        ? await WhatsAppNotificationService.getTemplateText(
            companyId,
            settings.invoicePaid.templateId,
          )
        : null;

      if (!templateText) {
        // Fallback auf Standard-Template wenn kein Template gefunden
        const message = WhatsAppTemplates.INVOICE_PAID(
          customerName,
          invoiceNumber,
          amount,
          companyName,
        );

        await WhatsAppService.sendMessage(
          companyId,
          customerPhone,
          message,
          customerId,
          customerName,
        );
        return;
      }

      await api.post('/api/v1/notifications/whatsapp', {
        companyId,
        to: customerPhone,
        message: templateText,
        customerId,
        customerName,
        invoiceId,
        templateId: settings.invoicePaid.templateId,
      });
    } catch (error) {
      console.error('WhatsApp Invoice Paid Notification Error:', error);
    }
  }

  /**
   * Sendet Mahnung per WhatsApp
   */
  static async sendInvoiceReminder(
    companyId: string,
    companyName: string,
    customerId: string,
    customerName: string,
    customerPhone: string,
    invoiceNumber: string,
    amount: number,
    daysOverdue: number,
    invoiceId?: string,
  ): Promise<void> {
    try {
      if (!customerPhone) return;

      const settings = await WhatsAppNotificationService.getAutomationSettings(companyId);

      if (!settings?.invoiceReminder?.enabled) return;

      const templateText = settings.invoiceReminder.templateId
        ? await WhatsAppNotificationService.getTemplateText(
            companyId,
            settings.invoiceReminder.templateId,
          )
        : null;

      if (!templateText) {
        const message = WhatsAppTemplates.INVOICE_REMINDER(
          customerName,
          invoiceNumber,
          amount,
          daysOverdue,
          companyName,
        );

        await WhatsAppService.sendMessage(
          companyId,
          customerPhone,
          message,
          customerId,
          customerName,
        );
        return;
      }

      await api.post('/api/v1/notifications/whatsapp', {
        companyId,
        to: customerPhone,
        message: templateText,
        customerId,
        customerName,
        invoiceId,
        templateId: settings.invoiceReminder.templateId,
      });
    } catch (error) {
      console.error('WhatsApp Invoice Reminder Error:', error);
    }
  }

  /**
   * Benachrichtigt Kunden über neue Rechnung
   */
  static async notifyInvoiceSent(
    companyId: string,
    companyName: string,
    customerId: string,
    customerName: string,
    customerPhone: string,
    invoiceNumber: string,
    amount: number,
    dueDate: string,
    invoiceId?: string,
  ): Promise<void> {
    try {
      if (!customerPhone) return;

      const settings = await WhatsAppNotificationService.getAutomationSettings(companyId);

      if (!settings?.invoiceSent?.enabled) return;

      const templateText = settings.invoiceSent.templateId
        ? await WhatsAppNotificationService.getTemplateText(
            companyId,
            settings.invoiceSent.templateId,
          )
        : null;

      if (!templateText) {
        const message = WhatsAppTemplates.INVOICE_SENT(
          customerName,
          invoiceNumber,
          amount,
          dueDate,
          companyName,
        );

        await WhatsAppService.sendMessage(
          companyId,
          customerPhone,
          message,
          customerId,
          customerName,
        );
        return;
      }

      await api.post('/api/v1/notifications/whatsapp', {
        companyId,
        to: customerPhone,
        message: templateText,
        customerId,
        customerName,
        invoiceId,
        templateId: settings.invoiceSent.templateId,
      });
    } catch (error) {
      console.error('WhatsApp Invoice Sent Notification Error:', error);
    }
  }

  /**
   * Terminerinnerung per WhatsApp
   */
  static async sendAppointmentReminder(
    companyId: string,
    _companyName: string,
    customerId: string,
    customerName: string,
    customerPhone: string,
    appointmentId: string,
  ): Promise<void> {
    try {
      if (!customerPhone) return;

      const settings = await WhatsAppNotificationService.getAutomationSettings(companyId);

      if (!settings?.appointmentReminder?.enabled) return;

      const templateText = settings.appointmentReminder.templateId
        ? await WhatsAppNotificationService.getTemplateText(
            companyId,
            settings.appointmentReminder.templateId,
          )
        : null;

      if (!templateText) return;

      await api.post('/api/v1/notifications/whatsapp', {
        companyId,
        to: customerPhone,
        message: templateText,
        customerId,
        customerName,
        appointmentId,
        templateId: settings.appointmentReminder.templateId,
      });
    } catch (error) {
      console.error('WhatsApp Appointment Reminder Error:', error);
    }
  }

  /**
   * Benachrichtigt Kunden über neues Angebot
   */
  static async notifyQuoteSent(
    companyId: string,
    customerId: string,
    customerName: string,
    customerPhone: string,
    quoteId: string,
  ): Promise<void> {
    try {
      if (!customerPhone) return;

      const settings = await WhatsAppNotificationService.getAutomationSettings(companyId);

      if (!settings?.quoteSent?.enabled) return;

      const templateText = settings.quoteSent.templateId
        ? await WhatsAppNotificationService.getTemplateText(
            companyId,
            settings.quoteSent.templateId,
          )
        : null;

      if (!templateText) return;

      await api.post('/api/v1/notifications/whatsapp', {
        companyId,
        to: customerPhone,
        message: templateText,
        customerId,
        customerName,
        quoteId,
        templateId: settings.quoteSent.templateId,
      });
    } catch (error) {
      console.error('WhatsApp Quote Sent Notification Error:', error);
    }
  }

  /**
   * Erinnerung dass Angebot bald abläuft
   */
  static async sendQuoteExpiringReminder(
    companyId: string,
    customerId: string,
    customerName: string,
    customerPhone: string,
    quoteId: string,
  ): Promise<void> {
    try {
      if (!customerPhone) return;

      const settings = await WhatsAppNotificationService.getAutomationSettings(companyId);

      if (!settings?.quoteExpiring?.enabled) return;

      const templateText = settings.quoteExpiring.templateId
        ? await WhatsAppNotificationService.getTemplateText(
            companyId,
            settings.quoteExpiring.templateId,
          )
        : null;

      if (!templateText) return;

      await api.post('/api/v1/notifications/whatsapp', {
        companyId,
        to: customerPhone,
        message: templateText,
        customerId,
        customerName,
        quoteId,
        templateId: settings.quoteExpiring.templateId,
      });
    } catch (error) {
      console.error('WhatsApp Quote Expiring Reminder Error:', error);
    }
  }
}

export default WhatsAppNotificationService;
