'use client';

import { api } from '@/lib/api-client';

/**
 * Ein Nummernkreis, wie ihn `GET /number-sequences/{companyId}` liefert.
 * `format` trägt `{number:N}` mit der Stellenzahl des Servers.
 */
export interface NumberSequence {
  id: string | null;
  companyId: string;
  type: string;
  format: string;
  nextNumber: number;
  nextFormatted: string;
  prefix: string;
  canEdit: boolean;
  canDelete: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * Nummernkreise — NUR LESEN.
 *
 * Bis zum 11.09.2026 rief dieser Dienst `POST …/next`, `POST …/sync`,
 * `POST …/create-defaults` und `PATCH …/{id}` — vier Routen, die es im
 * Backend nicht gibt (den `POST …/next` hat es BEWUSST entfernt: jeder Aufruf
 * zur bloßen Anzeige hätte eine fortlaufende Nummer verbrannt und eine
 * GoBD-Lücke erzeugt). Jeder Aufruf lief ins 404, und die `catch`-Zweige
 * bauten Ersatznummern aus der Uhrzeit (`KD-091119`). Die echte Nummer
 * vergibt AUSSCHLIESSLICH der Server beim Speichern des Kunden bzw. Belegs;
 * hier gibt es nur die Vorschau — und keinen Ersatzwert, wenn sie fehlt.
 */
export class NumberSequenceService {
  /**
   * Vorschau der nächsten Nummer eines Typs (Kunde, Lieferant, Rechnung …),
   * ohne den Zähler zu erhöhen. Wirft, wenn der Server nicht antwortet —
   * ein Feld bleibt dann leer, statt eine erfundene Nummer zu tragen.
   */
  static async getNextNumberForType(
    companyId: string,
    type: string,
  ): Promise<{ number: number; formattedNumber: string; format: string }> {
    const sequences = await NumberSequenceService.getNumberSequences(companyId);
    const sequence = sequences.find(seq => seq.type === type);
    if (!sequence) {
      throw new Error(`Der Server kennt keinen Nummernkreis vom Typ „${type}".`);
    }
    return {
      number: sequence.nextNumber,
      formattedNumber: sequence.nextFormatted,
      format: sequence.format,
    };
  }

  /** Eine Nummer nach dem Format des Kreises darstellen (`{number:4}` → 0007). */
  static formatNumber(number: number, format: string): string {
    if (!format) {
      return number.toString();
    }
    const paddingMatch = format.match(/\{number:(\d+)\}/);
    if (paddingMatch) {
      const padding = parseInt(paddingMatch[1], 10);
      return format.replace(/\{number:\d+\}/, number.toString().padStart(padding, '0'));
    }
    if (format.includes('{number}')) {
      return format.replace('{number}', number.toString());
    }
    return `${format}${number}`;
  }

  /** Alle Nummernkreise des Betriebs — für jeden Typ genau einer. */
  static async getNumberSequences(companyId: string): Promise<NumberSequence[]> {
    return api.get<NumberSequence[]>(`/api/v1/number-sequences/${companyId}`);
  }
}
