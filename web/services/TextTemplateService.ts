'use client';

import { documentTranslations } from '@/hooks/pdf/document-translations';
import { resolveDocumentLanguage } from '@/hooks/pdf/useDocumentTranslation';
import { api } from '@/lib/api-client';

// Der Textvorlagen-Slice hängt unter /api/v1/buchhaltung/… (bereiche/versand).
// Bis zum 14.09.2026 rief dieser Dienst /api/v1/text-templates — 404, und die
// Vorlagen-Menüs in Kopf- und Fußtext blieben still leer.
import { currencySymbol, formatCurrency } from '@/lib/currency';
import type { TextTemplate } from '@/types/textTemplates';

interface TemplateRenderData {
  currency?: string;
  customerName?: string;
  customerNumber?: string;
  customerEmail?: string;
  customerAddress?: { street?: string; zipCode?: string; city?: string };
  total?: number;
  quoteNumber?: string;
  invoiceNumber?: string;
  paymentDue?: Date | string;
  paymentDate?: Date | string;
  subtotal?: number;
  taxAmount?: number;
  createdAt?: Date | string;
  validUntil?: Date | string;
}

interface CompanySettingsData {
  contactPerson?: string;
  name?: string;
  contactInfo?: { phone?: string; email?: string; website?: string };
  vatId?: string;
  commercialRegister?: string;
}

export class TextTemplateService {
  /**
   * Erstellt eine neue Textvorlage
   */
  static async createTextTemplate(
    templateData: Omit<TextTemplate, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<TextTemplate> {
    try {
      const { companyId } = templateData;
      if (!companyId) {
        throw new Error('companyId ist erforderlich');
      }

      return await api.post<TextTemplate>(`/api/v1/buchhaltung/text-templates/${companyId}`, templateData);
    } catch (error) {
      console.error('Fehler beim Erstellen der Textvorlage:', error);
      throw new Error('Fehler beim Erstellen der Textvorlage', { cause: error });
    }
  }

  /**
   * Aktualisiert eine bestehende Textvorlage
   */
  static async updateTextTemplate(
    companyId: string,
    templateId: string,
    templateData: Partial<Omit<TextTemplate, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<void> {
    try {
      await api.patch(`/api/v1/buchhaltung/text-templates/${companyId}/${templateId}`, templateData);
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Textvorlage:', error);
      throw new Error('Fehler beim Aktualisieren der Textvorlage', { cause: error });
    }
  }

  /**
   * Löscht eine Textvorlage
   */
  static async deleteTextTemplate(companyId: string, templateId: string): Promise<void> {
    try {
      await api.delete(`/api/v1/buchhaltung/text-templates/${companyId}/${templateId}`);
    } catch (error) {
      console.error('Fehler beim Löschen der Textvorlage:', error);
      throw new Error('Fehler beim Löschen der Textvorlage', { cause: error });
    }
  }

  /**
   * Lädt alle Textvorlagen für ein Unternehmen
   */
  static async getTextTemplates(companyId: string): Promise<TextTemplate[]> {
    try {
      return await api.get<TextTemplate[]>(`/api/v1/buchhaltung/text-templates/${companyId}`);
    } catch (error) {
      console.error('Fehler beim Laden der Textvorlagen:', error);
      throw new Error('Fehler beim Laden der Textvorlagen', { cause: error });
    }
  }

  /**
   * Lädt Textvorlagen nach Typ gefiltert
   */
  static async getTextTemplatesByType(
    companyId: string,
    objectType: TextTemplate['objectType'],
    textType?: TextTemplate['textType'],
  ): Promise<TextTemplate[]> {
    try {
      const params = new URLSearchParams({ objectType });
      if (textType) params.append('textType', textType);
      return await api.get<TextTemplate[]>(`/api/v1/buchhaltung/text-templates/${companyId}?${params}`);
    } catch (error) {
      console.error('Fehler beim Laden der gefilterten Textvorlagen:', error);
      throw new Error('Fehler beim Laden der gefilterten Textvorlagen', { cause: error });
    }
  }

  /**
   * Lädt E-Mail-Textvorlagen für ein bestimmtes Dokument
   */
  static async getEmailTemplatesByObjectType(
    companyId: string,
    objectType: TextTemplate['objectType'],
    textType?: TextTemplate['textType'],
  ): Promise<TextTemplate[]> {
    try {
      const params = new URLSearchParams({ category: 'EMAIL', objectType });
      if (textType) params.append('textType', textType);
      return await api.get<TextTemplate[]>(`/api/v1/buchhaltung/text-templates/${companyId}?${params}`);
    } catch (error) {
      console.error('Fehler beim Laden der E-Mail-Textvorlagen:', error);
      throw new Error('Fehler beim Laden der E-Mail-Textvorlagen', { cause: error });
    }
  }

  /**
   * Lädt die Standard-Textvorlage für einen bestimmten Typ
   */
  static async getDefaultTextTemplate(
    companyId: string,
    objectType: TextTemplate['objectType'],
    textType: TextTemplate['textType'],
  ): Promise<TextTemplate | null> {
    try {
      const params = new URLSearchParams({ objectType, textType });
      return await api.get<TextTemplate>(`/api/v1/buchhaltung/text-templates/${companyId}/default?${params}`);
    } catch (error) {
      console.error('Fehler beim Laden der Standard-Textvorlage:', error);
      return null;
    }
  }

  /**
   * Initialisiert Standard-Templates für eine neue Company
   */
  static async initializeTemplatesForNewCompany(companyId: string, userId: string): Promise<void> {
    try {
      console.log(`🚀 Initializing default templates for company: ${companyId}`);
      await api.post(`/api/v1/buchhaltung/text-templates/${companyId}/initialize`, { userId });
      console.log(`✅ Templates initialized for ${companyId}`);
    } catch (error) {
      console.error('Fehler beim Erstellen der Standard-Textvorlagen:', error);
      throw new Error('Fehler beim Erstellen der Standard-Textvorlagen', { cause: error });
    }
  }

  /**
   * ⚠️ DEPRECATED: Legacy-Methode für Kompatibilität
   * Verwende stattdessen: initializeTemplatesForNewCompany()
   */
  static async createDefaultTemplates(companyId: string, userId: string): Promise<void> {
    return TextTemplateService.initializeTemplatesForNewCompany(companyId, userId);
  }

  /**
   * Ersetzt Platzhalter in einem Text mit echten Werten
   */
  replacePlaceholders(
    text: string,
    data: TemplateRenderData,
    companySettings?: CompanySettingsData,
    language: string = 'de',
  ): string {
    let result = text;

    // Formatierungsfunktionen — Wurzel 4: Betrag über die zentrale
    // formatCurrency (rendert symbollos bei fehlender Währung statt EUR zu
    // erfinden), keine dritte Kopie mit eigenem EUR-Fallback.
    const fmtCurrency = (value?: number) =>
      typeof value === 'number' ? formatCurrency(value, data.currency) : '';

    // Datumsformat des DOKUMENTS: dieselbe Sprache wie der Textbaustein.
    const dateLocale = documentTranslations[resolveDocumentLanguage(language)].dateLocale;
    const formatDate = (date?: Date | string) => {
      if (!date) return '';
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString(dateLocale);
    };

    const getFullSalutation = () => {
      const salutations = {
        de: {
          formal: 'Sehr geehrte Damen und Herren',
          personal: (name: string) => `Sehr geehrte/r ${name}`,
        },
        en: {
          formal: 'Dear Sir or Madam',
          personal: (name: string) => `Dear ${name}`,
        },
        fr: {
          formal: 'Mesdames et Messieurs',
          personal: (name: string) => `Cher/Chère ${name}`,
        },
      };

      const langSalutations = salutations[language as keyof typeof salutations] || salutations.de;

      if (data.customerName) {
        if (
          data.customerName.includes('GmbH') ||
          data.customerName.includes('AG') ||
          data.customerName.includes('Ltd') ||
          data.customerName.includes('Inc')
        ) {
          return langSalutations.formal;
        }
        return langSalutations.personal(data.customerName);
      }
      return langSalutations.formal;
    };

    // Platzhalter-Mapping
    const placeholderMap: Record<string, string> = {
      // Kunde
      '[%KUNDENNAME%]': data.customerName || '',
      '[%VOLLEANREDE%]': getFullSalutation(),
      '[%KUNDENNUMMER%]': data.customerNumber || '',
      '[%EMAIL%]': data.customerEmail || '',
      '[%STRASSE%]': data.customerAddress?.street || '',
      '[%PLZ%]': data.customerAddress?.zipCode || '',
      '[%ORT%]': data.customerAddress?.city || '',

      // Finanzen
      '[%BETRAG%]': fmtCurrency(data.total),
      '[%WAEHRUNG%]': currencySymbol(data.currency),
      '[%ANGEBOTSNUMMER%]': data.quoteNumber || '',
      '[%RECHNUNGSNUMMER%]': data.invoiceNumber || '',
      '[%ZAHLUNGSZIEL%]': formatDate(data.paymentDue),
      '[%ZAHLDATUM%]': formatDate(data.paymentDate),
      '[%NETTOBETRAG%]': fmtCurrency(data.subtotal),
      '[%STEUERBETRAG%]': fmtCurrency(data.taxAmount),

      // Unternehmen
      '[%KONTAKTPERSON%]': companySettings?.contactPerson || '',
      '[%FIRMENNAME%]': companySettings?.name || '',
      '[%TELEFON%]': companySettings?.contactInfo?.phone || '',
      '[%FIRMEN_EMAIL%]': companySettings?.contactInfo?.email || '',
      '[%WEBSITE%]': companySettings?.contactInfo?.website || '',
      '[%USTIDNR%]': companySettings?.vatId || '',
      '[%HANDELSREGISTER%]': companySettings?.commercialRegister || '',

      // Datum
      '[%DATUM%]': formatDate(new Date()),
      '[%ANGEBOTSDATUM%]': formatDate(data.createdAt),
      '[%GUELTIG_BIS%]': formatDate(data.validUntil),
    };

    // Alle Platzhalter ersetzen
    Object.entries(placeholderMap).forEach(([placeholder, value]) => {
      result = result.replace(
        new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        value,
      );
    });

    return result;
  }

  /**
   * ✅ ANGEPASST: Prüft ob Templates existieren, erstellt sie falls nicht
   */
  static async createDefaultTemplatesIfNeeded(companyId: string, userId: string): Promise<boolean> {
    try {
      const templates = await TextTemplateService.getTextTemplates(companyId);

      if (templates.length === 0) {
        await TextTemplateService.initializeTemplatesForNewCompany(companyId, userId);
        return true; // Templates wurden erstellt
      }

      return false; // Templates existieren bereits
    } catch (error) {
      console.error('Fehler beim Prüfen/Erstellen der Standard-Templates:', error);
      return false;
    }
  }
}
