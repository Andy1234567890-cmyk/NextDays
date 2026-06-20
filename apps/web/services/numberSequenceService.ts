'use client';

import { api } from '@/lib/api-client';

export interface NumberSequence {
  id?: string;
  companyId: string;
  type: string;
  format: string;
  nextNumber: number;
  nextFormatted?: string;
  prefix?: string;
  canEdit: boolean;
  canDelete: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class NumberSequenceService {
  /**
   * Holt die nächste Nummer für einen bestimmten Typ (z.B. 'Rechnung', 'Kunde', 'Storno')
   * und inkrementiert sie automatisch
   */
  static async getNextNumberForType(
    companyId: string,
    type: string,
  ): Promise<{
    number: number;
    formattedNumber: string;
    format: string;
  }> {
    try {
      return await api.post<{ number: number; formattedNumber: string; format: string }>(
        `/api/v1/number-sequences/${companyId}/next`,
        { type },
      );
    } catch (error) {
      console.error('❌ Fehler beim Abrufen der nächsten Nummer:', error);

      // Graceful Fallback bei Backend-Fehler
      const fallbackFormat = NumberSequenceService.getDefaultFormatForType(type);
      const fallbackNumber = Date.now() % 10000;

      return {
        number: fallbackNumber,
        formattedNumber: NumberSequenceService.formatNumber(fallbackNumber, fallbackFormat),
        format: fallbackFormat,
      };
    }
  }

  /**
   * Formatiert eine Nummer basierend auf dem gegebenen Format
   */
  static formatNumber(number: number, format: string): string {
    if (!format) {
      return number.toString();
    }

    if (format.includes('%NUMBER')) {
      if (
        format === 'KD-%NUMBER' ||
        format === 'LF-%NUMBER' ||
        format === 'PA-%NUMBER' ||
        format === 'IN-%NUMBER'
      ) {
        return format.replace('%NUMBER', number.toString().padStart(3, '0'));
      }
      return format.replace('%NUMBER', number.toString());
    }

    if (format.includes('{number}')) {
      return format.replace('{number}', number.toString());
    }

    const paddingMatch = format.match(/\{number:(\d+)\}/);
    if (paddingMatch) {
      const padding = parseInt(paddingMatch[1], 10);
      const paddedNumber = number.toString().padStart(padding, '0');
      return format.replace(/\{number:\d+\}/, paddedNumber);
    }

    return `${format}${number}`;
  }

  /**
   * Holt alle Nummerkreise für eine Company
   */
  static async getNumberSequences(companyId: string): Promise<NumberSequence[]> {
    try {
      return await api.get<NumberSequence[]>(`/api/v1/number-sequences/${companyId}`);
    } catch (error) {
      console.error('❌ Fehler beim Abrufen der Nummerkreise:', error);
      throw error;
    }
  }

  /**
   * Aktualisiert einen spezifischen Nummerkreis
   */
  static async updateNumberSequence(
    companyId: string,
    sequenceId: string,
    updates: Partial<NumberSequence>,
  ): Promise<void> {
    await api.patch(`/api/v1/number-sequences/${companyId}/${sequenceId}`, updates);
  }

  /**
   * Synchronisiert Nummernkreis mit echten Daten
   */
  static async syncSequenceWithRealData(companyId: string, type: string): Promise<void> {
    try {
      await api.post(`/api/v1/number-sequences/${companyId}/sync`, { type });
    } catch (error) {
      console.error(`❌ Fehler beim Synchronisieren des ${type}-Nummernkreises:`, error);
      // Nicht weiterwerfen - Synchronisation ist optional
    }
  }

  /**
   * Debug: Zeigt Status aller Nummernkreise für eine Company
   */
  static async debugNumberSequences(companyId: string): Promise<void> {
    try {
      const sequences = await NumberSequenceService.getNumberSequences(companyId);
      if (sequences.length === 0) {
        return;
      }
      sequences.forEach(seq => {
        console.log(`[NumberSequence] ${seq.type}: next=${seq.nextNumber}, format=${seq.format}`);
      });
    } catch (error) {
      console.error('❌ Fehler beim Debug der Nummernkreise:', error);
    }
  }

  /**
   * Reparatur: Korrigiert Kunden-Nummernkreis basierend auf existierenden Daten
   */
  static async repairCustomerNumberSequence(companyId: string): Promise<void> {
    try {
      const { CustomerService } = await import('@/services/customerService');
      await CustomerService.syncCustomerNumberSequence(companyId);
    } catch (error) {
      console.error('❌ Fehler bei der Reparatur:', error);
      throw error;
    }
  }

  /**
   * Erstellt Standard-Nummerkreise für eine neue Company
   */
  static async createDefaultSequences(companyId: string): Promise<NumberSequence[]> {
    try {
      return await api.post<NumberSequence[]>(
        `/api/v1/number-sequences/${companyId}/create-defaults`,
        {},
      );
    } catch (error) {
      console.error('❌ Fehler beim Erstellen der Standard-Nummerkreise:', error);
      throw error;
    }
  }

  /**
   * Gibt das Standard-Format für einen Typ zurück (Fallback)
   */
  private static getDefaultFormatForType(type: string): string {
    const formats: Record<string, string> = {
      Rechnung: 'RE-{number}',
      Angebot: 'AN-{number}',
      Storno: 'ST-{number}',
      Mahnung: 'MA-{number}',
      Gutschrift: 'GU-{number}',
      Kunde: 'KD-%NUMBER',
      Lieferant: 'LF-%NUMBER',
      Partner: 'PA-%NUMBER',
      Interessenten: 'IN-%NUMBER',
    };
    return formats[type] ?? `${type.toUpperCase()}-{number}`;
  }
}
