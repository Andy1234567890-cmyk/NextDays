import type React from 'react';
import { useDocumentTranslation } from '@/hooks/pdf/useDocumentTranslation';
import type { ProcessedPDFData } from '@/hooks/pdf/usePDFTemplateData';
import { formatCurrency } from '@/lib/utils';

interface TotalsDisplayProps {
  data: ProcessedPDFData;
  color?: string;
  className?: string;
  variant?: 'standard' | 'elegant' | 'technical' | 'compact';
  language?: string;
}

export const TotalsDisplay: React.FC<TotalsDisplayProps> = ({
  data,
  color = '#b82028',
  className = '',
  variant = 'standard',
  language = 'de',
}) => {
  const { t } = useDocumentTranslation(language);
  const getSkontoDate = (days?: number) => {
    const skontoDate = new Date();
    skontoDate.setDate(skontoDate.getDate() + (days ?? 0));
    return skontoDate.toLocaleDateString(t('dateLocale'));
  };

  // Prüfe alle speziellen Steuerbehandlungen
  const isReverseCharge =
    data.taxRule?.includes('REVERSE') || data.taxRuleType?.includes('REVERSE');
  const isTaxExempt =
    data.taxRule?.includes('EXEMPT') ||
    data.taxRuleType?.includes('EXEMPT') ||
    data.taxRule?.includes('DE_EXEMPT_4_USTG') ||
    data.taxRuleType?.includes('DE_EXEMPT_4_USTG') ||
    data.taxRule?.includes('NOTAXABLE') ||
    data.taxRuleType?.includes('NOTAXABLE') ||
    data.taxRule?.includes('EXPORT') ||
    data.taxRuleType?.includes('EXPORT') ||
    data.taxRule?.includes('INTRACOMMUNITY') ||
    data.taxRuleType?.includes('INTRACOMMUNITY');
  const isOSS =
    data.taxRule?.includes('OSS') ||
    data.taxRuleType?.includes('OSS') ||
    data.taxRule?.includes('EU_OSS') ||
    data.taxRuleType?.includes('EU_OSS') ||
    data.taxRule?.includes('18j') ||
    data.taxRuleType?.includes('18j');
  const isNotTaxableInGermany =
    data.taxRule?.includes('OUT_OF_SCOPE') ||
    data.taxRuleType?.includes('OUT_OF_SCOPE') ||
    data.taxRule?.includes('NON_EU') ||
    data.taxRuleType?.includes('NON_EU') ||
    data.taxRule?.includes('3a') ||
    data.taxRuleType?.includes('3a') ||
    data.taxRule?.includes('OUTSIDE_GERMANY') ||
    data.taxRuleType?.includes('OUTSIDE_GERMANY');
  const isSmallBusiness =
    data.isSmallBusiness ||
    data.taxRule?.includes('SMALL_BUSINESS') ||
    data.taxRuleType?.includes('SMALL_BUSINESS');

  // Zeige MwSt nur bei normaler steuerpflichtiger Lieferung (nicht bei speziellen Verfahren)
  const showVat =
    !isReverseCharge && !isTaxExempt && !isOSS && !isNotTaxableInGermany && !isSmallBusiness;
  const skontoDays = typeof data.skontoDays === 'number' ? data.skontoDays : 0;

  // SevDesk-style: Verwende taxGrouped wenn verfügbar, sonst fallback zu altem System
  type TaxLine = { rate: number; taxAmount: number };
  const taxLines: TaxLine[] =
    data.taxGrouped && (data.taxGrouped as TaxLine[]).length > 0
      ? (data.taxGrouped as TaxLine[]).filter((tax: TaxLine) => showVat && tax.taxAmount > 0)
      : showVat && data.taxAmount > 0
        ? [{ rate: data.vatRate, taxAmount: data.taxAmount }]
        : [];

  if (variant === 'elegant') {
    return (
      <div className={`w-80 ${className}`}>
        <div className="rounded border bg-gray-50 p-6" style={{ borderColor: color }}>
          <div className="space-y-3">
            <div className="flex justify-between py-1 text-sm">
              <span>{t('subtotal')}:</span>
              <span>{formatCurrency(data.subtotal, data.currency)}</span>
            </div>
            {taxLines.map(tax => (
              <div
                key={`${tax.rate}-${tax.taxAmount}`}
                className="flex justify-between py-1 text-sm"
              >
                <span>{t('vatAmount')} ({tax.rate}%):</span>
                <span>{formatCurrency(tax.taxAmount, data.currency)}</span>
              </div>
            ))}
            <div className="my-3 h-px bg-linear-to-r from-transparent via-gray-300 to-transparent" />
            <div className="flex justify-between py-2 font-bold text-lg" style={{ color }}>
              <span>{t('totalAmount')}:</span>
              <span>{formatCurrency(data.total, data.currency)}</span>
            </div>
            {data.skontoEnabled && data.skontoDays && data.skontoPercentage && (
              <div className="mt-4 border-t pt-3" style={{ borderColor: color }}>
                <div className="flex justify-between py-1 text-green-700 text-sm">
                  <span>{t('skonto')} ({data.skontoPercentage}%):</span>
                  <span>-{formatCurrency(data.total * (data.skontoPercentage / 100), data.currency)}</span>
                </div>
                <div className="flex justify-between py-1 font-bold text-green-800 text-sm">
                  <span>{t('ifPaidBy')} {getSkontoDate(skontoDays)}:</span>
                  <span>
                    {formatCurrency(data.total - data.total * (data.skontoPercentage / 100), data.currency)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`w-60 ${className}`}>
        <div className="rounded border border-gray-200 bg-linear-to-br from-gray-50 to-white p-3 shadow-sm">
          <div className="space-y-2">
            <div className="flex justify-between py-0.5 text-xs">
              <span>{t('subtotal')}:</span>
              <span>{formatCurrency(data.subtotal, data.currency)}</span>
            </div>
            {taxLines.map(tax => (
              <div
                key={`${tax.rate}-${tax.taxAmount}`}
                className="flex justify-between py-0.5 text-xs"
              >
                <span>{t('vatAmount')} ({tax.rate}%):</span>
                <span>{formatCurrency(tax.taxAmount, data.currency)}</span>
              </div>
            ))}
            <div className="my-2 h-px bg-linear-to-r from-transparent via-gray-300 to-transparent" />
            <div className="flex justify-between py-1 font-bold text-sm" style={{ color }}>
              <span>{t('totalAmount')}:</span>
              <span>{formatCurrency(data.total, data.currency)}</span>
            </div>
            {data.skontoEnabled && data.skontoDays && data.skontoPercentage && (
              <div className="mt-2 border-t pt-2" style={{ borderColor: color }}>
                <div className="flex justify-between py-0.5 text-green-700 text-xs">
                  <span>{t('skonto')} ({data.skontoPercentage}%):</span>
                  <span>-{formatCurrency(data.total * (data.skontoPercentage / 100), data.currency)}</span>
                </div>
                <div className="flex justify-between py-0.5 font-medium text-green-800 text-xs">
                  <span>{t('ifPaidBy')} {getSkontoDate(skontoDays)}:</span>
                  <span>
                    {formatCurrency(data.total - data.total * (data.skontoPercentage / 100), data.currency)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Standard variant
  return (
    <div className={`w-64 shrink-0 ${className}`}>
      <div className="flex justify-between py-2">
        <span>{t('subtotal')}:</span>
        <span>{formatCurrency(data.subtotal, data.currency)}</span>
      </div>
      {taxLines.map(tax => (
        <div key={`${tax.rate}-${tax.taxAmount}`} className="flex justify-between py-2">
          <span>{t('vatAmount')} ({tax.rate}%):</span>
          <span>{formatCurrency(tax.taxAmount, data.currency)}</span>
        </div>
      ))}
      <div className="flex justify-between border-t py-2 font-bold text-lg">
        <span>{t('totalAmount')}:</span>
        <span>{formatCurrency(data.total, data.currency)}</span>
      </div>
      {data.skontoEnabled && data.skontoDays && data.skontoPercentage && (
        <div className="mt-2 border-gray-300 border-t pt-2">
          <div className="flex justify-between py-1 text-green-700 text-sm">
            <span>{t('skonto')} ({data.skontoPercentage}%):</span>
            <span>-{formatCurrency(data.total * (data.skontoPercentage / 100), data.currency)}</span>
          </div>
          <div className="flex justify-between border-green-200 border-t py-1 font-bold text-green-800">
            <span>{t('ifPaidBy')} {getSkontoDate(skontoDays)}:</span>
            <span>{formatCurrency(data.total - data.total * (data.skontoPercentage / 100), data.currency)}</span>
          </div>
        </div>
      )}
    </div>
  );
};
