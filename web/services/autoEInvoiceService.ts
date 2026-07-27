/**
 * Automatische E-Invoice Generierung Service
 * 100% deutsche E-Rechnung-Compliance Integration
 */

import { toast } from 'sonner';
import { type EInvoiceData, EInvoiceService, type TSEData } from './eInvoiceService';

export interface AutoEInvoiceConfig {
  companyId: string;
  enabled: boolean;
  defaultFormat: 'zugferd' | 'xrechnung';
  autoTransmit: boolean;
  tseEnabled: boolean;
}

export class AutoEInvoiceService {
  /**
   * Generiert automatisch E-Rechnung nach Invoice-Erstellung
   */
  static async generateEInvoiceForInvoice(
    invoiceData: any,
    config: AutoEInvoiceConfig,
  ): Promise<EInvoiceData | null> {
    if (!config.enabled) {
      return null;
    }

    try {
      // 1. TSE-Daten generieren falls aktiviert (überspringen wenn bereits vorhanden)
      let tseData: TSEData | undefined;
      if (config.tseEnabled && !invoiceData.tseData) {
        tseData = await AutoEInvoiceService.generateTSEData(config.companyId);
      } else if (invoiceData.tseData) {
        tseData = invoiceData.tseData;
      }

      // 2. XML generieren
      let xmlContent: string;
      try {
        if (config.defaultFormat === 'zugferd') {
          xmlContent = await EInvoiceService.generateZUGFeRDWithTSE(
            invoiceData,
            {
              conformanceLevel: 'EN16931' as any,
              guideline: 'urn:cen.eu:en16931:2017#compliant#urn:zugferd.de:2p1:extended',
              specificationId: 'urn:cen.eu:en16931:2017',
            },
            {
              companyName: invoiceData.companyName,
              companyAddress: invoiceData.companyAddress,
              companyVatId: invoiceData.companyVatId,
              email: invoiceData.companyEmail,
              phoneNumber: invoiceData.companyPhone,
            },
            tseData,
          );
        } else {
          xmlContent = await EInvoiceService.generateXRechnungXML(
            invoiceData,
            {
              buyerReference: invoiceData.reference || invoiceData.customerOrderNumber || '',
              leitwegId: '', // Aus Company-Einstellungen laden
              specificationId: 'urn:cen.eu:en16931:2017',
              businessProcessType: 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0',
            },
            {
              companyName: invoiceData.companyName,
              companyAddress: invoiceData.companyAddress,
              companyVatId: invoiceData.companyVatId,
              email: invoiceData.companyEmail,
              phoneNumber: invoiceData.companyPhone,
            },
          );
        }
      } catch (xmlError) {
        console.error('❌ XML-Generierung fehlgeschlagen:', xmlError);
        throw new Error(
          `XML-Generierung fehlgeschlagen: ${xmlError instanceof Error ? xmlError.message : 'Unbekannter Fehler'}`,
        );
      }

      // 3. XML validieren
      const validationResult = await EInvoiceService.validateEInvoice(
        xmlContent,
        config.defaultFormat,
      );

      if (!validationResult.isValid) {
        console.error('❌ E-Invoice Validierung fehlgeschlagen:', validationResult.errors);
        toast.error(`E-Rechnung Validierung fehlgeschlagen: ${validationResult.errors.join(', ')}`);
        return null;
      }

      // 4. E-Invoice speichern
      const eInvoiceData: any = {
        invoiceId: invoiceData.id,
        companyId: config.companyId,
        format: config.defaultFormat,
        standard: 'EN16931',
        xmlContent,
        amount: invoiceData.total || 0,
        validationStatus: 'valid',
        validationErrors: [],
        transmissionStatus: config.autoTransmit ? 'pending' : 'draft',
        recipientType: 'business',
      };

      // Nur transmissionMethod hinzufügen, wenn es gesetzt ist
      if (config.autoTransmit) {
        eInvoiceData.transmissionMethod = 'email';
      }

      const eInvoiceId = await EInvoiceService.createEInvoice(eInvoiceData);

      // 5. Automatische Übertragung falls aktiviert
      if (config.autoTransmit) {
        await AutoEInvoiceService.transmitEInvoice(eInvoiceId, xmlContent);
      }

      toast.success(
        `E-Rechnung (${config.defaultFormat.toUpperCase()}) erfolgreich generiert${
          config.autoTransmit ? ' und übertragen' : ''
        }`,
      );

      // Rückgabe der E-Invoice-Daten mit ID für weitere Verarbeitung
      return {
        id: eInvoiceId,
        invoiceId: invoiceData.id,
        companyId: config.companyId,
        format: config.defaultFormat,
        standard: 'EN16931',
        xmlContent,
        amount: invoiceData.total || 0,
        validationStatus: 'valid',
        validationErrors: [],
        transmissionStatus: config.autoTransmit ? 'sent' : 'draft',
        recipientType: 'business',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...(config.autoTransmit && { transmissionMethod: 'email' }),
      };
    } catch (error) {
      console.error('❌ Automatische E-Invoice-Generierung fehlgeschlagen:', error);
      toast.error(`E-Rechnung-Generierung fehlgeschlagen: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * TSE-Daten (§ 146a AO) — NICHT implementiert.
   *
   * Eine TSE-Signatur darf ausschließlich von zertifizierter TSE-Hardware bzw.
   * einem zertifizierten Cloud-TSE-Dienst erzeugt werden. Hier standen zuvor
   * erfundene Signaturen und ein Platzhalter-Public-Key: das erzeugt Belege,
   * die eine Kassensicherungs-Konformität VORTÄUSCHEN, die es nicht gibt.
   * Lieber sichtbar fehlschlagen als falsche Steuerbelege ausstellen.
   */
  private static async generateTSEData(_companyId: string): Promise<TSEData> {
    throw new Error(
      'TSE-Signatur ist nicht angebunden. Die Funktion erfordert eine ' +
        'zertifizierte TSE; bitte im Support melden, statt die Rechnung ' +
        'ohne gültige Signatur auszustellen.',
    );
  }

  /**
   * Automatische Übertragung (PEPPOL / E-Mail / Portal) — NICHT implementiert.
   *
   * Zuvor simulierte ein setTimeout den Versand und meldete anschließend
   * „gesendet". Eine nie übertragene Rechnung als übertragen zu markieren, ist
   * fachlich schlimmer als ein sichtbarer Fehler.
   */
  private static async transmitEInvoice(
    _eInvoiceId: string,
    _xmlContent: string,
  ): Promise<void> {
    throw new Error(
      'Automatischer E-Rechnungs-Versand ist nicht angebunden. Die ' +
        'Rechnung wurde erzeugt, aber NICHT übertragen.',
    );
  }

  /**
   * Prüft E-Invoice-Bereitschaft für eine Rechnung
   */
  static validateEInvoiceReadiness(invoiceData: any): {
    ready: boolean;
    missing: string[];
    warnings: string[];
  } {
    const missing: string[] = [];
    const warnings: string[] = [];

    // Kritische Felder prüfen
    if (!invoiceData.companyName?.trim()) missing.push('Firmenname');
    if (!invoiceData.companyVatId?.trim()) missing.push('Umsatzsteuer-ID');
    if (!invoiceData.companyAddress?.trim()) missing.push('Firmenadresse');
    if (!invoiceData.customerName?.trim()) missing.push('Kundenname');
    if (!invoiceData.customerAddress?.trim()) missing.push('Kundenadresse');
    if (!invoiceData.documentNumber?.trim()) missing.push('Rechnungsnummer');
    if (!invoiceData.date) missing.push('Rechnungsdatum');
    if (!invoiceData.items?.length) missing.push('Rechnungsposten');

    // Empfohlene Felder prüfen
    if (!invoiceData.companyEmail?.trim()) warnings.push('Firmen-E-Mail');
    if (!invoiceData.companyPhone?.trim()) warnings.push('Firmen-Telefon');
    if (!invoiceData.customerEmail?.trim()) warnings.push('Kunden-E-Mail');
    if (!invoiceData.bankDetails?.iban?.trim()) warnings.push('Bankverbindung');

    return {
      ready: missing.length === 0,
      missing,
      warnings,
    };
  }

  /**
   * Erstellt detaillierten E-Invoice-Status-Report
   */
  static async generateComplianceReport(companyId: string): Promise<{
    overallCompliance: number;
    zugferdReady: boolean;
    xrechnungReady: boolean;
    tseConfigured: boolean;
    peppolEnabled: boolean;
    recommendations: string[];
  }> {
    try {
      const settings = await EInvoiceService.getEInvoiceSettings(companyId);

      let score = 0;
      const recommendations: string[] = [];

      // Basis-Konfiguration (40%)
      if (settings.defaultFormat && settings.defaultStandard) {
        score += 40;
      } else {
        recommendations.push('E-Invoice Format und Standard konfigurieren');
      }

      // TSE-Integration (25%)
      if (settings.tse?.enabled) {
        score += 25;
      } else {
        recommendations.push('TSE (Technische Sicherheitseinrichtung) aktivieren');
      }

      // PEPPOL-Integration (20%)
      if (settings.peppol?.enabled) {
        score += 20;
      } else {
        recommendations.push('PEPPOL-Netzwerk für automatische Übertragung konfigurieren');
      }

      // Automatisierung (15%)
      if (settings.enableAutoGeneration) {
        score += 15;
      } else {
        recommendations.push('Automatische E-Invoice-Generierung aktivieren');
      }

      return {
        overallCompliance: score,
        zugferdReady: settings.defaultFormat === 'zugferd',
        xrechnungReady: settings.defaultFormat === 'xrechnung',
        tseConfigured: Boolean(settings.tse?.enabled),
        peppolEnabled: Boolean(settings.peppol?.enabled),
        recommendations,
      };
    } catch (error) {
      console.error('Fehler beim Erstellen des Compliance-Reports:', error);
      return {
        overallCompliance: 0,
        zugferdReady: false,
        xrechnungReady: false,
        tseConfigured: false,
        peppolEnabled: false,
        recommendations: ['E-Invoice-Einstellungen konfigurieren'],
      };
    }
  }
}
