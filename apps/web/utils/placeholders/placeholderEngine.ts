// Zentrale Platzhalter-Engine - Haupt-Implementation

import { createAliasRegistry, normalizePlaceholderName, validatePlaceholderName } from './aliases';
import companyPlaceholders from './categories/company';
import customerPlaceholders from './categories/customer';
import dateTimePlaceholders from './categories/dateTime';
import invoicePlaceholders from './categories/invoice';
import quotePlaceholders from './categories/quote';
import type { DocumentType, PlaceholderContext, PlaceholderRegistry } from './types';

// Zentrale Registry aller Platzhalter mit Alias-Unterstützung
const BASE_PLACEHOLDERS: PlaceholderRegistry = {
  ...dateTimePlaceholders,
  ...companyPlaceholders,
  ...customerPlaceholders,
  ...invoicePlaceholders,
  ...quotePlaceholders,
};

// Erweiterte Registry mit allen Aliasen für maximale Kompatibilität
const ALL_PLACEHOLDERS: PlaceholderRegistry = createAliasRegistry(BASE_PLACEHOLDERS);

/**
 * Ersetzt alle Platzhalter in einem Text basierend auf dem bereitgestellten Kontext
 *
 * @param text - Der Text mit Platzhaltern im Format [%PLATZHALTER%]
 * @param context - Der Kontext mit allen verfügbaren Daten
 * @returns Der Text mit ersetzten Platzhaltern
 */
export function replacePlaceholders(text: string, context: PlaceholderContext): string {
  if (!text) return '';

  // Regex um Platzhalter im Format [%PLATZHALTER%] zu finden
  const placeholderRegex = /\[%([^%\]]+)%\]/g;

  return text.replace(placeholderRegex, (match, placeholderName) => {
    const trimmedName = placeholderName.trim().toUpperCase();
    const normalizedName = normalizePlaceholderName(trimmedName);

    // Validiere Platzhalter-Namen und gib Warnung bei veralteten Namen
    const validation = validatePlaceholderName(trimmedName);
    if (validation.isDeprecated && validation.suggestion) {
      console.warn(
        `Veralteter Platzhalter verwendet: [%${trimmedName}%] - ${validation.suggestion}`,
      );
    }

    // Prüfe ob der Platzhalter existiert (normalisiert)
    if (ALL_PLACEHOLDERS[normalizedName]) {
      try {
        const result = ALL_PLACEHOLDERS[normalizedName](context);
        return result || '';
      } catch (error) {
        console.warn(`Fehler beim Verarbeiten des Platzhalters [%${trimmedName}%]:`, error);
        return match; // Originaltext bei Fehlern zurückgeben
      }
    }

    // Fallback: Wenn Platzhalter nicht gefunden, Original zurückgeben
    console.warn(`Unbekannter Platzhalter: [%${trimmedName}%]`);
    return match;
  });
}

/**
 * Gibt alle verfügbaren Platzhalter für einen bestimmten Dokumenttyp zurück
 *
 * @param documentType - Der Typ des Dokuments
 * @returns Array mit allen verfügbaren Platzhalter-Namen
 */
export function getAvailablePlaceholders(documentType: DocumentType = 'common'): string[] {
  const allKeys = Object.keys(ALL_PLACEHOLDERS);

  // Filter basierend auf Dokumenttyp (falls spezifische Logik benötigt wird)
  switch (documentType) {
    case 'invoice':
      return allKeys.filter(
        key =>
          !key.startsWith('ANGEBOT') && !key.startsWith('MAHNUNG') && !key.startsWith('GUTSCHRIFT'),
      );
    case 'quote':
      return allKeys.filter(
        key =>
          !key.startsWith('RECHNUNG') &&
          !key.startsWith('MAHNUNG') &&
          !key.startsWith('GUTSCHRIFT'),
      );
    default:
      return allKeys;
  }
}

/**
 * Gruppiert Platzhalter nach Kategorien für UI-Anzeige
 *
 * @returns Objekt mit Kategorien und ihren Platzhaltern
 */
export function getPlaceholdersByCategory() {
  return {
    'Datum & Zeit': {
      description: 'Aktuelle Datums- und Zeitangaben mit erweiterten Funktionen',
      placeholders: Object.keys(dateTimePlaceholders),
    },
    Firmeninformationen: {
      description: 'Daten des eigenen Unternehmens',
      placeholders: Object.keys(companyPlaceholders),
    },
    Kundeninformationen: {
      description: 'Daten des Kunden oder Ansprechpartners',
      placeholders: Object.keys(customerPlaceholders),
    },
    Angebotsdaten: {
      description: 'Spezifische Daten für Angebote',
      placeholders: Object.keys(quotePlaceholders),
    },
  };
}

/**
 * Validiert einen Platzhalter-Namen mit Alias-Unterstützung
 *
 * @param placeholderName - Der zu validierende Platzhalter-Name
 * @returns Validierungs-Informationen inkl. Standard-Name und Alias-Status
 */
export function validatePlaceholder(placeholderName: string) {
  const trimmedName = placeholderName.trim().toUpperCase();
  const normalizedName = normalizePlaceholderName(trimmedName);
  const exists = normalizedName in ALL_PLACEHOLDERS;
  const validation = validatePlaceholderName(trimmedName);

  return {
    exists,
    normalizedName,
    isDeprecated: validation.isDeprecated,
    suggestion: validation.suggestion,
  };
}

/**
 * Validiert einen Platzhalter-Namen (Legacy-Unterstützung)
 *
 * @param placeholderName - Der zu validierende Platzhalter-Name
 * @returns true wenn der Platzhalter existiert
 */
export function isValidPlaceholder(placeholderName: string): boolean {
  const trimmedName = placeholderName.trim().toUpperCase();
  const normalizedName = normalizePlaceholderName(trimmedName);
  return normalizedName in ALL_PLACEHOLDERS;
}

/**
 * Findet alle Platzhalter in einem Text
 *
 * @param text - Der zu analysierende Text
 * @returns Array mit allen gefundenen Platzhaltern
 */
export function findPlaceholdersInText(text: string): string[] {
  if (!text) return [];

  const placeholderRegex = /\[%([^%\]]+)%\]/g;
  const matches: string[] = [];

  let match: RegExpExecArray | null = placeholderRegex.exec(text);
  while (match !== null) {
    const placeholderName = match[1].trim().toUpperCase();
    const normalizedName = normalizePlaceholderName(placeholderName);
    if (!matches.includes(normalizedName)) {
      matches.push(normalizedName);
    }
    match = placeholderRegex.exec(text);
  }

  return matches;
}

/**
 * Vorschau-Funktion für Platzhalter-Ersetzung ohne tatsächliche Ersetzung
 *
 * @param text - Der Text mit Platzhaltern
 * @param context - Der Kontext für die Ersetzung
 * @returns Objekt mit Vorschau-Informationen
 */
export function previewPlaceholderReplacement(text: string, context: PlaceholderContext) {
  const foundPlaceholders = findPlaceholdersInText(text);
  const validPlaceholders: string[] = [];
  const invalidPlaceholders: string[] = [];
  const replacements: { [key: string]: string } = {};

  foundPlaceholders.forEach(placeholder => {
    const normalizedName = normalizePlaceholderName(placeholder);
    if (isValidPlaceholder(placeholder)) {
      validPlaceholders.push(placeholder);
      try {
        replacements[placeholder] = ALL_PLACEHOLDERS[normalizedName](context) || '';
      } catch (error) {
        replacements[placeholder] = `[Fehler: ${error}]`;
      }
    } else {
      invalidPlaceholders.push(placeholder);
    }
  });

  return {
    foundPlaceholders,
    validPlaceholders,
    invalidPlaceholders,
    replacements,
    previewText: replacePlaceholders(text, context),
  };
}

// Legacy-Support: Exportiere auch die alte buildPreviewData Funktion für Rückwärtskompatibilität
export function buildPreviewData(context: PlaceholderContext) {
  // Diese Funktion kann später entfernt werden, wenn alle Stellen migriert sind
  return {
    replacePlaceholders: (text: string) => replacePlaceholders(text, context),
  };
}

// Haupt-Export
export default {
  replacePlaceholders,
  getAvailablePlaceholders,
  getPlaceholdersByCategory,
  isValidPlaceholder,
  validatePlaceholder,
  findPlaceholdersInText,
  previewPlaceholderReplacement,
  buildPreviewData,
};
