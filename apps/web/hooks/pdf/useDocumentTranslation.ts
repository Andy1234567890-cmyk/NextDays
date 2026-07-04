'use client';

import { useMemo } from 'react';

import {
  type DocumentTranslations,
  documentTranslations,
} from './document-translations';

export type { DocumentTranslations };
export { DOCUMENT_LANGUAGES } from './document-translations';

// Die Übersetzungstabellen (24 EU-Sprachen) leben in document-translations.ts;
// hier nur der t()-Hook + die Standard-Footer-Übersetzung.
const translations = documentTranslations;

/** Sprachcode normalisieren ('de-AT' → 'de'); unbekannt → 'de'. */
export function resolveDocumentLanguage(language?: string | null): string {
  const code = String(language || '')
    .trim()
    .toLowerCase()
    .replace('_', '-')
    .split('-')[0];
  return translations[code] ? code : 'de';
}

export const useDocumentTranslation = (language: string = 'de') => {
  const t = useMemo(() => {
    const lang = translations[resolveDocumentLanguage(language)] || translations.de;
    return (key: keyof DocumentTranslations): string => {
      return lang[key] || translations.de[key] || key;
    };
  }, [language]);

  return { t };
};

/**
 * Übersetzt den Footer-Text, wenn er dem deutschen Standard-Footer entspricht.
 * Exakte Standard-Treffer werden für ALLE Sprachen ersetzt; die Phrasen-
 * Heuristik für individuell angepasste Footer bleibt auf en/fr beschränkt.
 * @param footerText Der zu übersetzende Footer-Text
 * @param language Die Zielsprache (24 EU-Locales)
 * @returns Der übersetzte Footer-Text oder der Original-Text, wenn keine Übereinstimmung
 */
export function translateStandardFooterText(footerText: string, language: string = 'de'): string {
  const langCode = resolveDocumentLanguage(language);
  if (!footerText || langCode === 'de') return footerText;

  const lang = translations[langCode] || translations.de;
  const germanStandard = translations.de.standardFooterText;

  // Entferne HTML-Formatierung für Vergleich
  const normalizedFooter = footerText.replace(/<br>/g, '\n').trim();
  const normalizedStandard = germanStandard.replace(/<br>/g, '\n').trim();

  // Prüfe, ob der Footer-Text dem deutschen Standard ähnelt (mit Platzhaltern)
  // Ersetze Platzhalter temporär durch Marker für Vergleich
  const footerForComparison = normalizedFooter
    .replace(/\[%[^\]]+%\]/g, 'PLACEHOLDER')
    .replace(/\s+/g, ' ');
  const standardForComparison = normalizedStandard
    .replace(/\[%[^\]]+%\]/g, 'PLACEHOLDER')
    .replace(/\s+/g, ' ');

  // Wenn ähnlich genug, verwende übersetzten Standard-Text
  if (footerForComparison === standardForComparison) {
    return lang.standardFooterText;
  }

  // Sonst: Versuche häufige deutsche Phrasen zu ersetzen
  let translatedFooter = footerText;

  if (langCode === 'en') {
    translatedFooter = translatedFooter
      .replace(/Wir bitten Sie,/g, 'Please')
      .replace(/den Rechnungsbetrag von/g, 'transfer the invoice amount of')
      .replace(/unter Angabe der Rechnungsnummer/g, 'quoting the invoice number')
      .replace(/auf das unten angegebene Konto zu überweisen/g, 'to the account below')
      .replace(/Zahlungsziel:/g, 'Payment terms:')
      .replace(/Rechnungsdatum:/g, 'Invoice date:')
      .replace(
        /Vielen Dank für Ihr Vertrauen und die angenehme Zusammenarbeit!/g,
        'Thank you for your trust and the pleasant cooperation!',
      )
      .replace(/Mit freundlichen Grüßen/g, 'Best regards');
  } else if (langCode === 'fr') {
    translatedFooter = translatedFooter
      .replace(/Wir bitten Sie,/g, 'Nous vous prions')
      .replace(/den Rechnungsbetrag von/g, 'de virer le montant de la facture de')
      .replace(/unter Angabe der Rechnungsnummer/g, 'en indiquant le numéro de facture')
      .replace(/auf das unten angegebene Konto zu überweisen/g, 'sur le compte ci-dessous')
      .replace(/Zahlungsziel:/g, 'Délai de paiement :')
      .replace(/Rechnungsdatum:/g, 'Date de facturation :')
      .replace(
        /Vielen Dank für Ihr Vertrauen und die angenehme Zusammenarbeit!/g,
        'Merci pour votre confiance et notre agréable collaboration!',
      )
      .replace(/Mit freundlichen Grüßen/g, 'Meilleures salutations');
  }

  return translatedFooter;
}
