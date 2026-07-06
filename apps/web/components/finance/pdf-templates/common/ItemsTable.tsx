import type React from 'react';
import { useDocumentTranslation } from '@/hooks/pdf/useDocumentTranslation';
import type { ProcessedPDFData } from '@/hooks/pdf/usePDFTemplateData';
import { formatCurrency } from '@/lib/utils';
import { PDF_PAGE_STYLES } from '@/utils/pdf-page-styles';

interface ItemsTableProps {
  data: ProcessedPDFData;
  color?: string;
  variant?: 'standard' | 'elegant' | 'technical' | 'neutral' | 'dynamic';
  showArticleNumber?: boolean;
  showVATPerPosition?: boolean;
  language?: string;
}

export const ItemsTable: React.FC<ItemsTableProps> = ({
  data,
  color = '#b82028',
  variant = 'standard',
  showArticleNumber = false,
  showVATPerPosition = false,
  language = 'de',
}) => {
  const { t } = useDocumentTranslation(language);
  if (!data.realItems || data.realItems.length === 0) {
    return <div className="py-8 text-center text-gray-500">{t('noItems')}</div>;
  }

  const hasAnyDiscount = data.realItems.some(item => (item as any).discountPercent > 0);

  // Weist der Beleg überhaupt USt aus? Dieselbe Regel wie TotalsDisplay: bei
  // Reverse-Charge/steuerfrei/OSS/Auslands-/Kleinunternehmer-Belegen wird KEINE
  // MwSt-Zeile gezeigt — dann darf auch die per-Position-USt-Spalte keinen Satz
  // ausweisen (sonst widerspricht die Positionsspalte dem steuerfreien Kopf).
  const rule = `${(data as any).taxRule ?? ''} ${(data as any).taxRuleType ?? ''}`;
  const belegAusweistUst =
    !/REVERSE|13B|18B/.test(rule) &&
    !/EXEMPT|INTRACOMMUNITY|EXPORT|OUT_OF_SCOPE|NON_EU|3a|OUTSIDE_GERMANY/.test(rule) &&
    !/OSS|18j/.test(rule) &&
    !/SMALL_BUSINESS/.test(rule) &&
    !(data as any).isSmallBusiness;
  const showVAT = showVATPerPosition && belegAusweistUst;

  if (variant === 'elegant') {
    return (
      <div className="mb-8">
        <div className="relative">
          <div className="absolute -inset-1 border" style={{ borderColor: color, opacity: 0.2 }} />
          <table className="relative w-full bg-white">
            <thead style={PDF_PAGE_STYLES.tableHeader}>
              <tr style={{ backgroundColor: color }}>
                <th className="px-3 py-4 text-left font-light text-white">{t('position')}</th>
                {showArticleNumber && (
                  <th className="px-3 py-4 text-left font-light text-white">
                    {t('articleNumber')}
                  </th>
                )}
                <th className="px-3 py-4 text-left font-light text-white">{t('description')}</th>
                <th className="px-3 py-4 text-right font-light text-white">{t('quantity')}</th>
                <th className="px-3 py-4 text-right font-light text-white">{t('unitPrice')}</th>
                {hasAnyDiscount && (
                  <th className="px-3 py-4 text-right font-light text-white">{t('discount')}</th>
                )}
                {showVAT && (
                  <th className="px-3 py-4 text-right font-light text-white">{t('vatRate')}</th>
                )}
                <th className="px-3 py-4 text-right font-light text-white">{t('amount')}</th>
              </tr>
            </thead>
            <tbody>
              {data.realItems.map((item, index) => {
                const discountPercent = (item as any).discountPercent || 0;
                // item.total ist bereits der RABATTIERTE Netto-Zeilenbetrag (Hook).
                // Rabatt daher NUR aus unitPrice*quantity ableiten (wie die Standard-
                // Variante) — sonst würde er ein zweites Mal auf item.total angewandt
                // und der Zeilenbetrag wiche von Zwischensumme/Totals ab.
                const discountedTotal =
                  discountPercent > 0
                    ? item.unitPrice * item.quantity * (1 - discountPercent / 100)
                    : item.total || item.unitPrice * item.quantity;
                const isEven = index % 2 === 0;

                return (
                  <tr
                    key={index}
                    className={`${isEven ? 'bg-gray-50' : 'bg-white'} border-gray-200 border-b`}
                    style={PDF_PAGE_STYLES.tableRow}
                  >
                    <td className="px-3 py-4 text-sm">{index + 1}</td>
                    {showArticleNumber && (
                      <td className="px-3 py-4 text-gray-600 text-sm">
                        {(item as any).articleNumber || `ART${index + 1}`}
                      </td>
                    )}
                    <td className="px-3 py-4 text-sm">
                      <div className="font-medium">{item.description}</div>
                      {(item as any).unit && (
                        <div className="text-gray-500 text-xs">
                          {t('unitLabel')}: {(item as any).unit}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-4 text-right text-sm">{item.quantity}</td>
                    <td className="px-3 py-4 text-right text-sm">
                      {formatCurrency(item.unitPrice, data.currency)}
                    </td>
                    {hasAnyDiscount && (
                      <td className="px-3 py-4 text-right text-red-600 text-sm">
                        {discountPercent > 0 ? `-${discountPercent}%` : ''}
                      </td>
                    )}
                    {showVAT && (
                      <td className="px-3 py-4 text-right text-sm">
                        {(() => { const r = (item as any).vatRate ?? (item as any).taxRate ?? (data as any).vatRate; return r == null ? '' : `${r}%`; })()}
                      </td>
                    )}
                    <td className="px-3 py-4 text-right font-medium text-sm">
                      {formatCurrency(discountedTotal, data.currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (variant === 'technical') {
    return (
      <div className="mb-8 border" style={{ borderColor: color }}>
        <table className="w-full">
          <thead style={PDF_PAGE_STYLES.tableHeader}>
            <tr className="bg-gray-900 text-white">
              <th className="px-2 py-3 text-left font-mono text-xs">ID</th>
              {showArticleNumber && (
                <th className="px-2 py-3 text-left font-mono text-xs">
                  {t('articleNumber').toUpperCase()}
                </th>
              )}
              <th className="px-2 py-3 text-left font-mono text-xs">
                {t('description').toUpperCase()}
              </th>
              <th className="px-2 py-3 text-right font-mono text-xs">
                {t('quantity').toUpperCase()}
              </th>
              <th className="px-2 py-3 text-right font-mono text-xs">
                {t('unitPrice').toUpperCase()}
              </th>
              {hasAnyDiscount && (
                <th className="px-2 py-3 text-right font-mono text-xs">
                  {t('discount').toUpperCase()}
                </th>
              )}
              {showVAT && (
                <th className="px-2 py-3 text-right font-mono text-xs">
                  {t('vatRate').toUpperCase()}
                </th>
              )}
              <th className="px-2 py-3 text-right font-mono text-xs">
                {t('amount').toUpperCase()}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.realItems.map((item, index) => {
              const discountPercent = (item as any).discountPercent || 0;
              // item.total ist bereits rabattiert — Rabatt nur aus unitPrice*quantity
              // ableiten (wie Standard-Variante), sonst doppelte Rabattierung.
              const discountedTotal =
                discountPercent > 0
                  ? item.unitPrice * item.quantity * (1 - discountPercent / 100)
                  : item.total || item.unitPrice * item.quantity;

              return (
                <tr
                  key={index}
                  className="border-gray-300 border-b"
                  style={PDF_PAGE_STYLES.tableRow}
                >
                  <td className="px-2 py-2 font-mono text-xs">{index + 1}</td>
                  {showArticleNumber && (
                    <td className="px-2 py-2 font-mono text-gray-600 text-xs">
                      {(item as any).articleNumber || `ART${index + 1}`}
                    </td>
                  )}
                  <td className="px-2 py-2 font-mono text-xs">
                    <div>{item.description}</div>
                    {(item as any).unit && (
                      <div className="text-gray-500 uppercase">
                        {t('unitLabel')}: {(item as any).unit}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-xs">{item.quantity}</td>
                  <td className="px-2 py-2 text-right font-mono text-xs">
                    {formatCurrency(item.unitPrice, data.currency)}
                  </td>
                  {hasAnyDiscount && (
                    <td className="px-2 py-2 text-right font-mono text-red-600 text-xs">
                      {discountPercent > 0 ? `-${discountPercent}%` : 'N/A'}
                    </td>
                  )}
                  {showVAT && (
                    <td className="px-2 py-2 text-right font-mono text-xs">
                      {(() => { const r = (item as any).vatRate ?? (item as any).taxRate ?? (data as any).vatRate; return r == null ? '' : `${r}%`; })()}
                    </td>
                  )}
                  <td className="px-2 py-2 text-right font-bold font-mono text-xs">
                    {formatCurrency(discountedTotal, data.currency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // Standard variant
  return (
    <div className="mb-8">
      <table className="w-full border-collapse">
        <thead style={PDF_PAGE_STYLES.tableHeader}>
          <tr style={{ backgroundColor: color ? `${color}15` : '#F4F2E5' }}>
            {showArticleNumber && <th className="border p-3 text-left">{t('articleNumber')}</th>}
            <th className="border p-3 text-left">{t('description')}</th>
            <th className="border p-3 text-center">{t('quantity')}</th>
            <th className="border p-3 text-right">{t('unitPrice')}</th>
            {hasAnyDiscount && <th className="border p-3 text-right">{t('discount')} %</th>}
            {showVAT && <th className="border p-3 text-right">{t('vatRate')}</th>}
            <th className="border p-3 text-right">{t('total')}</th>
          </tr>
        </thead>
        <tbody>
          {data.realItems.map((item, index) => {
            const discountPercent = (item as any).discountPercent || 0;
            const hasDiscount = discountPercent > 0;
            const originalPrice = item.unitPrice;
            const discountedPrice = hasDiscount
              ? originalPrice * (1 - discountPercent / 100)
              : originalPrice;
            const totalWithDiscount = hasDiscount ? discountedPrice * item.quantity : item.total;

            return (
              <tr key={index} style={PDF_PAGE_STYLES.tableRow}>
                {showArticleNumber && (
                  <td className="border p-3 text-gray-600 text-sm">
                    {(item as any).articleNumber || `ART-${String(index + 1).padStart(3, '0')}`}
                  </td>
                )}
                <td className="border p-3">{item.description}</td>
                <td className="border p-3 text-center">
                  {item.quantity} {(item as any).unit || t('piece')}
                </td>
                <td className="border p-3 text-right">{formatCurrency(item.unitPrice, data.currency)}</td>
                {hasAnyDiscount && (
                  <td className="border p-3 text-right">
                    {hasDiscount ? (
                      <span className="font-semibold text-red-600">{discountPercent}%</span>
                    ) : (
                      '-'
                    )}
                  </td>
                )}
                {showVAT && (
                  <td className="border p-3 text-right text-sm">
                    {(() => { const r = (item as any).vatRate ?? (item as any).taxRate ?? (data as any).vatRate; return r == null ? '' : `${r}%`; })()}
                  </td>
                )}
                <td className="border p-3 text-right">
                  {hasDiscount ? (
                    <span className="font-semibold text-red-600">
                      {formatCurrency(totalWithDiscount, data.currency)}
                    </span>
                  ) : (
                    <span
                      className={item.category === 'discount' ? 'font-semibold text-red-600' : ''}
                    >
                      {formatCurrency(item.total, data.currency)}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
