'use client';

import type React from 'react';
import { useTranslations } from 'next-intl';
import type { DocumentSettings, ProcessedPDFData } from '@/hooks/pdf/usePDFTemplateData';
import type { DocumentType } from '@/lib/document-utils';
import { detectDocumentType, getDocumentTypeConfig } from '@/lib/document-utils';
import { formatDate } from '@/lib/utils';
import { FooterText } from './common/FooterText';
import { ItemsTable } from './common/ItemsTable';
import { SimpleFooter } from './common/SimpleFooter';
import { TaxRulesInfo } from './common/TaxRulesInfo';
import { TotalsDisplay } from './common/TotalsDisplay';

interface TechnicalTemplateProps {
  data: ProcessedPDFData;
  color: string;
  logoSize: number;
  pageMode?: 'single' | 'multi';
  documentType?: DocumentType;
  documentSettings?: DocumentSettings;
}

export const TechnicalTemplate: React.FC<TechnicalTemplateProps> = ({
  data,
  color,
  logoSize,
  pageMode: _pageMode = 'single',
  documentType,
  documentSettings,
}) => {
  const t = useTranslations('finance');
  // Dokumenttyp-Konfiguration
  const detectedType = documentType || detectDocumentType(data) || 'invoice';
  const config = getDocumentTypeConfig(detectedType, color);
  const companyLogo = typeof data.companyLogo === 'string' ? data.companyLogo : undefined;

  // Berechne, ob eine zweite Seite benötigt wird
  // STANDARD: Immer einseitig, außer der Inhalt ist zu lang
  const itemCount = data.items?.length || 0;
  const hasLongDescription =
    data.items?.some((item: { description?: string }) => (item.description?.length || 0) > 150) ||
    false;
  const hasHeaderText = !!(data.processedHeaderText || data.processedHeadTextHtml);
  const needsSecondPage =
    itemCount > 6 || (itemCount > 4 && hasLongDescription) || (itemCount > 5 && hasHeaderText);

  return (
    <div
      className="mx-auto w-full bg-white font-mono text-xs"
      style={{ fontFamily: 'Courier New, monospace', width: '794px', maxWidth: '794px' }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @page { size: A4; margin: 0; }
          .pdf-page {
            width: 794px;
            min-height: 1123px;
            page-break-after: always;
            break-after: page;
          }
          .pdf-page:last-child {
            page-break-after: avoid;
            break-after: avoid;
          }
        `,
        }}
      />

      {/* ========= SEITE 1 ========= */}
      <div className="pdf-page relative flex flex-col">
        {/* Wasserzeichen */}
        {documentSettings?.showWatermark && (
          <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
            <div className="rotate-45 transform select-none font-bold text-6xl text-gray-100">
              {data.documentLabel}
            </div>
          </div>
        )}
        {/* TECHNICAL HEADER SEITE 1 */}
        <div
          className="mb-2 bg-gray-900 p-3 text-white"
          style={{ minHeight: companyLogo ? '70px' : '60px' }}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="font-bold text-lg">{data.companyName}</div>
              <div className="text-sm opacity-75">{t('TechnicalTemplate.professionalServices')}</div>
            </div>

            {companyLogo && (
              <img
                src={companyLogo}
                alt={data.companyName}
                className="h-12 w-auto object-contain"
                style={{
                  maxHeight: `${Math.min(logoSize, 48)}px`,
                  filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.8))',
                }}
              />
            )}
          </div>

          <div className="mt-2">
            <div className="font-bold text-base" style={{ color }}>
              {config.title}
            </div>
            <div className="text-xs">#{data.invoiceNumber}</div>
            <div className="text-xs">{formatDate(data.invoiceDate)}</div>
          </div>
        </div>

        {/* Customer Info Seite 1 */}
        <div className="p-3 pb-1">
          <div className="mb-2 grid grid-cols-2 gap-4 border" style={{ borderColor: color }}>
            <div className="p-2">
              <div className="mb-1 border-b pb-1 font-bold text-xs" style={{ borderColor: color }}>
                {t('TechnicalTemplate.clientInfo')}
              </div>
              <div className="space-y-1">
                <div>{t('TechnicalTemplate.name', { value: data.customerName })}</div>
                {data.customerAddressParsed.street && (
                  <div>{t('TechnicalTemplate.addr1', { value: data.customerAddressParsed.street })}</div>
                )}
                {(data.customerAddressParsed.postalCode || data.customerAddressParsed.city) && (
                  <div>
                    {t('TechnicalTemplate.addr2', {
                      postalCode: data.customerAddressParsed.postalCode || '',
                      city: data.customerAddressParsed.city || '',
                    })}
                  </div>
                )}
                {data.customerAddressParsed.country && (
                  <div>{t('TechnicalTemplate.country', { value: data.customerAddressParsed.country })}</div>
                )}
                {data.customerVatId && <div>{t('TechnicalTemplate.vatId', { value: data.customerVatId })}</div>}
              </div>
            </div>

            <div className="p-2">
              <div className="mb-1 border-b pb-1 font-bold text-xs" style={{ borderColor: color }}>
                {t('TechnicalTemplate.docMeta')}
              </div>
              <div className="space-y-1">
                <div>{t('TechnicalTemplate.docNum', { value: data.invoiceNumber })}</div>
                <div>{t('TechnicalTemplate.issued', { value: formatDate(data.invoiceDate) })}</div>
                <div>{t('TechnicalTemplate.dueDate', { value: formatDate(data.dueDate) })}</div>
                <div>{t('TechnicalTemplate.terms', { value: data.paymentTerms || '' })}</div>
                {data.customerOrderNumber && (
                  <div>{t('TechnicalTemplate.ref', { value: data.customerOrderNumber })}</div>
                )}
              </div>

              {/* QR-Code unter Dokumentdetails */}
              {documentSettings?.showQRCode && documentSettings?.qrCodeUrl && (
                <div className="mt-3">
                  <div className="mb-1 font-bold text-xs" style={{ color }}>
                    {t('TechnicalTemplate.qrCode')}
                  </div>
                  <img
                    src={documentSettings.qrCodeUrl}
                    alt={t('TechnicalTemplate.qrCodeAlt')}
                    className="h-12 w-12 border border-gray-300"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Betreff - Nur bei Stornorechnungen */}
        {detectedType === 'cancellation' && data.title && (
          <div className="mx-3 mb-1 border p-1" style={{ borderColor: color }}>
            <div className="mb-1 border-b pb-1 font-bold text-xs" style={{ borderColor: color }}>
              {t('TechnicalTemplate.subject')}
            </div>
            <div className="font-medium text-xs">{data.title}</div>
          </div>
        )}

        {/* Kopftext / Einleitung - Nur EIN Text anzeigen (processedHeadTextHtml hat Priorität) */}
        {(data.processedHeadTextHtml || data.processedHeaderText) && (
          <div className="mx-3 mb-1">
            <div
              className="text-xs leading-tight"
              dangerouslySetInnerHTML={{
                __html: data.processedHeadTextHtml || data.processedHeaderText,
              }}
            />
          </div>
        )}

        {/* Items Table Seite 1 */}
        <div className="flex-1 px-3">
          <div className="mb-2 border" style={{ borderColor: color }}>
            <div className="border-b bg-gray-100 p-1" style={{ borderColor: color }}>
              <div className="font-bold text-xs">{t('TechnicalTemplate.servicesList')}</div>
            </div>
            <div className="p-1">
              <ItemsTable
                data={data}
                color={color}
                variant="technical"
                showArticleNumber={documentSettings?.showArticleNumber}
                showVATPerPosition={documentSettings?.showVATPerPosition}
                language={documentSettings?.language || 'de'}
              />
            </div>
          </div>

          {/* Totals und Footer wenn keine zweite Seite benötigt wird */}
          {!needsSecondPage && (
            <>
              {/* Tax Rules und Totals */}
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="border p-1" style={{ borderColor: color }}>
                    <div
                      className="mb-1 border-b pb-1 font-bold text-xs"
                      style={{ borderColor: color }}
                    >
                      {t('TechnicalTemplate.taxInfo')}
                    </div>
                    <TaxRulesInfo
                      data={data}
                      color={color}
                      language={documentSettings?.language || 'de'}
                    />
                  </div>
                </div>
                <div className="border" style={{ borderColor: color }}>
                  <div className="border-b bg-gray-100 p-1" style={{ borderColor: color }}>
                    <div className="font-bold text-xs">{t('TechnicalTemplate.totals')}</div>
                  </div>
                  <div className="p-2">
                    <TotalsDisplay
                      data={data}
                      color={color}
                      variant="technical"
                      language={documentSettings?.language || 'de'}
                    />
                  </div>
                </div>
              </div>

              {/* FooterText */}
              <div className="mb-1 border p-1" style={{ borderColor: color }}>
                <div
                  className="mb-1 border-b pb-1 font-bold text-xs"
                  style={{ borderColor: color }}
                >
                  {t('TechnicalTemplate.footerInfo')}
                </div>
                <FooterText data={data} language={data.language || 'de'} variant="standard" />

                {/* EPC-QR-Code */}
                {documentSettings?.epcQrCodeUrl && (
                  <div className="mt-2">
                    <img
                      src={documentSettings.epcQrCodeUrl}
                      alt="EPC-QR-Code"
                      className="h-12 w-12"
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Seite 1 */}
        {documentSettings?.showFooter !== false && (
          <div className="mt-2 bg-white p-1">
            <SimpleFooter
              data={data}
              color={color}
              showPageNumbers={documentSettings?.showPageNumbers}
              currentPage={1}
              totalPages={needsSecondPage ? 2 : 1}
            />
          </div>
        )}
      </div>

      {/* ========= MEHRSEITIG MODUS - NUR WENN BENÖTIGT ========= */}
      {needsSecondPage && (
        <>
          {/* ========= SEITENUMBRUCH (nur bei > 2 Items) ========= */}
          <div
            className="page-break"
            style={{
              pageBreakBefore: 'always',
              breakBefore: 'page',
              pageBreakAfter: 'avoid',
              breakAfter: 'avoid',
              height: '1px',
              clear: 'both',
            }}
          ></div>

          {/* ========= SEITE 2 ========= */}
          <div className="pdf-page relative flex flex-col">
            {/* Header Seite 2 */}
            <div
              className="mb-8 bg-gray-900 p-4 text-white"
              style={{ minHeight: data.companyLogo ? '140px' : '100px' }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-lg">{data.companyName}</div>
                  <div className="text-sm opacity-75">{t('TechnicalTemplate.professionalServices')}</div>
                </div>

                {companyLogo && (
                  <img
                    src={companyLogo}
                    alt={data.companyName}
                    className="h-16 w-auto object-contain"
                    style={{
                      maxHeight: `${logoSize}px`,
                      filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.8))',
                    }}
                  />
                )}
              </div>

              <div className="mt-6 flex justify-between">
                <div>
                  <div className="font-bold text-xl" style={{ color }}>
                    {config.title}
                  </div>
                  <div className="text-sm">#{data.invoiceNumber}</div>
                </div>
              </div>
            </div>

            {/* Customer Info Seite 2 */}
            <div className="p-6 pb-4">
              <div className="mb-8 grid grid-cols-2 gap-8 border" style={{ borderColor: color }}>
                <div className="p-4">
                  <div className="mb-2 border-b pb-1 font-bold" style={{ borderColor: color }}>
                    {t('TechnicalTemplate.clientInfo')}
                  </div>
                  <div className="space-y-1">
                    <div>{t('TechnicalTemplate.name', { value: data.customerName })}</div>
                    {data.customerAddressParsed.street && (
                      <div>{t('TechnicalTemplate.addr1', { value: data.customerAddressParsed.street })}</div>
                    )}
                    {(data.customerAddressParsed.postalCode || data.customerAddressParsed.city) && (
                      <div>
                        {t('TechnicalTemplate.addr2', {
                          postalCode: data.customerAddressParsed.postalCode || '',
                          city: data.customerAddressParsed.city || '',
                        })}
                      </div>
                    )}
                    {data.customerAddressParsed.country && (
                      <div>{t('TechnicalTemplate.country', { value: data.customerAddressParsed.country })}</div>
                    )}
                    {data.customerVatId && (
                      <div>{t('TechnicalTemplate.vatId', { value: data.customerVatId })}</div>
                    )}
                  </div>
                </div>

                <div className="p-4">
                  <div className="mb-2 border-b pb-1 font-bold" style={{ borderColor: color }}>
                    {t('TechnicalTemplate.docMeta')}
                  </div>
                  <div className="space-y-1">
                    <div>{t('TechnicalTemplate.docNum', { value: data.invoiceNumber })}</div>
                    <div>{t('TechnicalTemplate.issued', { value: formatDate(data.invoiceDate) })}</div>
                    <div>{t('TechnicalTemplate.dueDate', { value: formatDate(data.dueDate) })}</div>
                    <div>{t('TechnicalTemplate.terms', { value: data.paymentTerms || '' })}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Fortsetzung + Totals Seite 2 */}
            <div className="flex-1 px-6">
              {/* Betreff - Nur bei Stornorechnungen (Seite 2) */}
              {detectedType === 'cancellation' && data.title && (
                <div className="mb-4 border p-2" style={{ borderColor: color }}>
                  <div className="mb-1 border-b pb-1 font-bold" style={{ borderColor: color }}>
                    {t('TechnicalTemplate.subject')}
                  </div>
                  <div className="font-medium text-sm">{data.title}</div>
                </div>
              )}

              <div className="mb-8 border" style={{ borderColor: color }}>
                <div className="border-b bg-gray-100 p-2" style={{ borderColor: color }}>
                  <div className="font-bold">{t('TechnicalTemplate.summaryData')}</div>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-8">
                    <div className="flex-1">
                      <div className="border p-4" style={{ borderColor: color }}>
                        <div className="mb-2 font-bold">{t('TechnicalTemplate.taxRules')}</div>
                        <TaxRulesInfo
                          data={data}
                          color={color}
                          language={documentSettings?.language || 'de'}
                        />
                      </div>
                    </div>
                    <TotalsDisplay
                      data={data}
                      color={color}
                      variant="technical"
                      language={documentSettings?.language || 'de'}
                    />
                  </div>
                </div>
              </div>

              <FooterText data={data} language={data.language || 'de'} variant="standard" />

              {/* EPC-QR-Code */}
              {documentSettings?.epcQrCodeUrl && (
                <div className="mt-2">
                  <img
                    src={documentSettings.epcQrCodeUrl}
                    alt="EPC-QR-Code"
                    className="h-12 w-12"
                  />
                </div>
              )}
            </div>

            {/* Footer Seite 2 */}
            {documentSettings?.showFooter !== false && (
              <div className="mt-3 bg-white p-2">
                <SimpleFooter
                  data={data}
                  color={color}
                  showPageNumbers={documentSettings?.showPageNumbers}
                  currentPage={2}
                  totalPages={2}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
