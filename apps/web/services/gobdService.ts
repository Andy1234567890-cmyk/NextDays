// GoBD Service - Festschreibungs-Backend
// Migriert zu: Frontend → FastAPI → Supabase

import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import type {
  GoBDComplianceReport,
  GoBDPeriodLock,
  GoBDSettings,
  StornoRequest,
} from '@/types/gobdTypes';

export class GoBDService {
  /**
   * Automatische Festschreibung bei Rechnungsversand
   */
  static async autoLockOnSend(
    companyId: string,
    documentId: string,
    userId: string,
    userName: string,
  ): Promise<boolean> {
    try {
      // Validierung: Beide IDs muessen vorhanden sein
      if (!companyId || !documentId) {
        console.warn('GoBD Auto-Lock: companyId oder documentId fehlt - uebersprungen', {
          companyId,
          documentId,
        });
        return false;
      }

      // Backend API Call
      const response = await api.post<{ success: boolean; message?: string }>(
        '/api/v1/gobd/lock/auto',
        {
          companyId,
          documentId,
          userId,
          userName,
        },
      );

      if (response.success) {
        toast.success('Dokument wurde automatisch festgeschrieben (GoBD-konform)');
        return true;
      } else {
        toast.warning(response.message || 'Festschreibung übersprungen');
        return false;
      }
    } catch (error) {
      console.error('Auto-lock failed:', error);

      // Detaillierteres Error-Handling
      if (error instanceof Error) {
        if (error.message.includes('permission')) {
          toast.error('Berechtigung fehlt - Festschreibung übersprungen');
        } else if (error.message.includes('not-found')) {
          toast.error('Dokument nicht gefunden - Festschreibung übersprungen');
        } else {
          toast.error(`Festschreibung fehlgeschlagen: ${error.message}`);
        }
      } else {
        toast.error('Automatische Festschreibung fehlgeschlagen');
      }

      return false;
    }
  }

  /**
   * Manuelle Festschreibung einzelner Dokumente
   */
  static async lockDocument(
    companyId: string,
    documentId: string,
    userId: string,
    userName: string,
    reason?: string,
  ): Promise<boolean> {
    try {
      // Backend API Call
      const response = await api.post<{ success: boolean; message?: string }>(
        '/api/v1/gobd/lock/manual',
        {
          companyId,
          documentId,
          userId,
          userName,
          reason,
        },
      );

      if (response.success) {
        toast.success('Dokument wurde festgeschrieben');
        return true;
      } else {
        toast.warning(response.message || 'Dokument konnte nicht festgeschrieben werden');
        return false;
      }
    } catch (error) {
      console.error('Manual lock failed:', error);
      toast.error(`Festschreibung fehlgeschlagen: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Festschreibung für Zeitraum (Monatsabschluss)
   */
  static async lockPeriod(
    companyId: string,
    period: string, // "2025-10"
    userId: string,
    userName: string,
  ): Promise<GoBDPeriodLock | null> {
    try {
      // Backend API Call
      const periodLock = await api.post<GoBDPeriodLock>('/api/v1/gobd/lock/period', {
        companyId,
        period,
        userId,
        userName,
      });

      toast.success(
        `Monatsabschluss ${period} abgeschlossen: ${periodLock.documentCount} Dokumente festgeschrieben`,
      );
      return periodLock;
    } catch (error) {
      console.error('Period lock failed:', error);
      toast.error(`Monatsabschluss fehlgeschlagen: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Stornorechnung erstellen
   */
  static async createStorno(
    companyId: string,
    request: StornoRequest,
    userId: string,
    userName: string,
  ): Promise<string | null> {
    try {
      // Backend API Call
      const response = await api.post<{ stornoId: string }>('/api/v1/gobd/storno', {
        companyId,
        originalDocumentId: request.originalDocumentId,
        reason: request.reason,
        stornoDate: request.stornoDate,
        userId,
        userName,
        partialAmount: request.partialAmount,
        items: request.items,
      });

      toast.success(`Stornorechnung erstellt`);
      return response.stornoId;
    } catch (error) {
      console.error('Storno creation failed:', error);
      toast.error(`Storno-Erstellung fehlgeschlagen: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * GoBD-Einstellungen laden
   */
  static async getSettings(companyId: string): Promise<GoBDSettings> {
    try {
      const settings = await api.get<GoBDSettings>(`/api/v1/gobd/settings/${companyId}`);
      return settings;
    } catch (error) {
      console.error('Failed to load GoBD settings:', error);
      throw error;
    }
  }

  /**
   * GoBD-Einstellungen speichern
   */
  static async updateSettings(settings: GoBDSettings): Promise<void> {
    try {
      await api.put('/api/v1/gobd/settings', settings);
      toast.success('GoBD-Einstellungen gespeichert');
    } catch (error) {
      console.error('Failed to update GoBD settings:', error);
      toast.error('Einstellungen konnten nicht gespeichert werden');
      throw error;
    }
  }

  /**
   * Compliance-Report generieren
   */
  static async generateComplianceReport(
    companyId: string,
    period: string,
  ): Promise<GoBDComplianceReport> {
    try {
      const report = await api.get<GoBDComplianceReport>(
        `/api/v1/gobd/compliance-report?company_id=${companyId}&period=${period}`,
      );
      return report;
    } catch (error) {
      console.error('Compliance report generation failed:', error);
      throw error;
    }
  }
}
