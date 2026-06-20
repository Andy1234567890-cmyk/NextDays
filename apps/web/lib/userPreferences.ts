'use client';
import type { InvoiceTemplate } from '@/components/finance/InvoiceTemplates';
// User Preferences Service für Template-Integration
import { api } from '@/lib/api-client';

export interface UserPreferences {
  // Template-Einstellungen pro Dokumenttyp (basierend auf tatsächlich verfügbaren Templates)
  preferredInvoiceTemplate: string | null; // Invoice → NEW_TEMPLATES.invoice
  preferredQuoteTemplate: string | null; // Order (Angebot) → NEW_TEMPLATES.quote
  preferredReminderTemplate: string | null; // Invoicereminder (Mahnung) → NEW_TEMPLATES.reminder
  preferredOrderTemplate: string | null; // Contractnote (Auftragsbestätigung) → NEW_TEMPLATES.order
  preferredDeliveryTemplate: string | null; // Packinglist (Lieferschein) → NEW_TEMPLATES.delivery
  preferredLetterTemplate: string | null; // Letter (Brief) → NEW_TEMPLATES.letter
  preferredCreditTemplate: string | null; // Creditnote (Gutschrift) → NEW_TEMPLATES.credit

  // Allgemeine Einstellungen
  preferredLanguage?: string;
  preferredCurrency?: string;

  // Metadaten
  userId?: string;
  updatedAt?: string; // ISO timestamp string (backend handles timestamps)
}

/**
 * Holt das Default-Template aus der Company-Einstellungen
 * Gibt null zurück wenn kein Template gesetzt ist - dann soll User auswählen
 */
export async function getCompanyDefaultTemplate(
  companyId: string,
): Promise<InvoiceTemplate | null> {
  try {
    const companyData = await api.get<{ defaultInvoiceTemplate?: InvoiceTemplate }>(
      `/api/v1/companies/${companyId}`,
    );
    return companyData.defaultInvoiceTemplate || null;
  } catch (_error) {
    return null;
  }
}

export class UserPreferencesService {
  /**
   * Ruft User-Preferences ab mit Default-Handling
   */
  static async getUserPreferences(userId: string, _companyId?: string): Promise<UserPreferences> {
    try {
      const data = await api.get<UserPreferences>(`/api/v1/users/${userId}/preferences`);

      return {
        preferredInvoiceTemplate: data.preferredInvoiceTemplate || null,
        preferredQuoteTemplate: data.preferredQuoteTemplate || null,
        preferredReminderTemplate: data.preferredReminderTemplate || null,
        preferredOrderTemplate: data.preferredOrderTemplate || null,
        preferredDeliveryTemplate: data.preferredDeliveryTemplate || null,
        preferredLetterTemplate: data.preferredLetterTemplate || null,
        preferredCreditTemplate: data.preferredCreditTemplate || null,
        preferredLanguage: data.preferredLanguage || 'de',
        preferredCurrency: data.preferredCurrency || 'EUR',
      };
    } catch (_error) {
      // Fallback wenn Fehler auftritt - verwende die ersten verfügbaren Templates aus NEW_TEMPLATES
      return {
        preferredInvoiceTemplate: 'TEMPLATE_NEUTRAL', // Standard Template
        preferredQuoteTemplate: 'professional-business-quote', // Erste aus NEW_TEMPLATES.quote
        preferredReminderTemplate: 'professional-reminder', // Erste aus NEW_TEMPLATES.reminder
        preferredOrderTemplate: 'professional-business-order', // Erste aus NEW_TEMPLATES.order
        preferredDeliveryTemplate: 'professional-business-delivery', // Erste aus NEW_TEMPLATES.delivery
        preferredLetterTemplate: 'professional-business-letter', // Erste aus NEW_TEMPLATES.letter
        preferredCreditTemplate: 'professional-business-credit', // Erste aus NEW_TEMPLATES.credit
        preferredLanguage: 'de',
        preferredCurrency: 'EUR',
      };
    }
  }

  /**
   * Speichert User-Preferences für einen Benutzer
   */
  static async updateUserPreferences(
    userId: string,
    preferences: Partial<UserPreferences>,
  ): Promise<void> {
    try {
      // Nur definierte Felder schreiben
      const clean: Record<string, unknown> = {};
      Object.entries(preferences || {}).forEach(([k, v]) => {
        if (v !== undefined) clean[k] = v;
      });

      await api.patch(`/api/v1/users/${userId}/preferences`, clean);
    } catch (error) {
      console.error('updateUserPreferences error:', error);
      throw new Error('User-Preferences konnten nicht gespeichert werden');
    }
  }

  /**
   * Speichert Template-Preference für einen spezifischen Dokumenttyp
   */
  static async updateTemplatePreference(
    userId: string,
    documentType:
      | 'Invoice'
      | 'Invoicereminder'
      | 'Order'
      | 'Contractnote'
      | 'Packinglist'
      | 'Letter'
      | 'Creditnote',
    templateId: string,
  ): Promise<void> {
    const update: Partial<UserPreferences> = {};

    // Mappe Dokumenttyp zu Preference-Feld
    switch (documentType) {
      case 'Invoice':
        update.preferredInvoiceTemplate = templateId;
        break;
      case 'Invoicereminder':
        update.preferredReminderTemplate = templateId;
        break;
      case 'Order':
        update.preferredQuoteTemplate = templateId;
        break;
      case 'Contractnote':
        update.preferredOrderTemplate = templateId;
        break;
      case 'Packinglist':
        update.preferredDeliveryTemplate = templateId;
        break;
      case 'Letter':
        update.preferredLetterTemplate = templateId;
        break;
      case 'Creditnote':
        update.preferredCreditTemplate = templateId;
        break;
    }

    await UserPreferencesService.updateUserPreferences(userId, update);
  }

  /**
   * Holt Template-Preference für einen spezifischen Dokumenttyp
   */
  static async getTemplatePreference(
    userId: string,
    documentType:
      | 'Invoice'
      | 'Invoicereminder'
      | 'Order'
      | 'Contractnote'
      | 'Packinglist'
      | 'Letter'
      | 'Creditnote',
    companyId?: string,
  ): Promise<string | null> {
    const preferences = await UserPreferencesService.getUserPreferences(userId, companyId);

    // Mappe Dokumenttyp zu Preference-Feld
    switch (documentType) {
      case 'Invoice':
        return preferences.preferredInvoiceTemplate;
      case 'Invoicereminder':
        return preferences.preferredReminderTemplate;
      case 'Order':
        return preferences.preferredQuoteTemplate;
      case 'Contractnote':
        return preferences.preferredOrderTemplate;
      case 'Packinglist':
        return preferences.preferredDeliveryTemplate;
      case 'Letter':
        return preferences.preferredLetterTemplate;
      case 'Creditnote':
        return preferences.preferredCreditTemplate;
      default:
        return null;
    }
  }

  // DEPRECATED: Legacy Funktionen (für Rückwärtskompatibilität)
  /**
   * @deprecated Verwende getTemplatePreference(userId, 'Invoice') stattdessen
   */
  static async getPreferredTemplate(userId: string, companyId?: string): Promise<string | null> {
    return UserPreferencesService.getTemplatePreference(userId, 'Invoice', companyId);
  }

  /**
   * @deprecated Verwende getTemplatePreference(userId, 'Packinglist') stattdessen
   */
  static async getPreferredDeliveryNoteTemplate(
    userId: string,
    companyId?: string,
  ): Promise<string | null> {
    return UserPreferencesService.getTemplatePreference(userId, 'Packinglist', companyId);
  }
}
