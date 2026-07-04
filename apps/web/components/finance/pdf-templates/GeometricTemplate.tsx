import type React from 'react';
import { useDocumentTranslation } from '@/hooks/pdf/useDocumentTranslation';
import type { DocumentSettings, ProcessedPDFData } from '@/hooks/pdf/usePDFTemplateData';
import type { DocumentType } from '@/lib/document-utils';
import { detectDocumentType, getDocumentTypeConfig } from '@/lib/document-utils';
import { formatDate } from '@/lib/utils';
import { FooterText } from './common/FooterText';
import { ItemsTable } from './common/ItemsTable';
import { SimpleFooter } from './common/SimpleFooter';
import { TaxRulesInfo } from './common/TaxRulesInfo';
import { TotalsDisplay } from './common/TotalsDisplay';

interface GeometricTemplateProps {
  data: ProcessedPDFData;
  color: string;
  logoSize: number;
  pageMode?: 'single' | 'multi';
  documentType?: DocumentType;
  documentSettings?: DocumentSettings;
}

export const GeometricTemplate: React.FC<GeometricTemplateProps> = ({
  data,
  color,
  logoSize,
  pageMode = 'multi',
  documentType,
  documentSettings,
}) => {
  // 📋 DYNAMISCHE DOKUMENTTYP-KONFIGURATION
  // PRIORITÄT: Explizit übergebener documentType hat höchste Priorität
  const detectedType = documentType || detectDocumentType(data) || 'invoice';
  const config = getDocumentTypeConfig(detectedType, color);
  const companyLogo = typeof data.companyLogo === 'string' ? data.companyLogo : undefined;

  // Übersetzungsfunktion
  const { t } = useDocumentTranslation(documentSettings?.language || 'de');

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
      className={`mx-auto w-full bg-white ${pageMode === 'single' ? 'text-[10px] leading-tight' : 'text-xs'}`}
      style={{
        fontFamily: 'Arial, sans-serif',
        width: '794px',
        maxWidth: '794px',
        ...(pageMode === 'single' && { maxHeight: '1123px', overflow: 'hidden' }),
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @media print {
            .pdf-page { page-break-before: always; }
            body { margin: 0; padding: 0; }
          }
          ${
            documentSettings?.showFoldLines
              ? `
          .pdf-page::before {
            content: '';
            position: absolute;
            left: 0;
            top: 105mm;
            width: 5mm;
            height: 1px;
            background-color: #ccc;
            z-index: 100;
          }
          .pdf-page::after {
            content: '';
            position: absolute;
            left: 0;
            top: 210mm;
            width: 5mm;
            height: 1px;
            background-color: #ccc;
            z-index: 100;
          }
          .pdf-page .fold-mark-hole {
            position: absolute;
            top: 148.5mm;
            left: 0;
            width: 3mm;
            height: 3mm;
            border: 1px solid #ccc;
            border-radius: 50%;
            z-index: 100;
          }
          `
              : ''
          }
        `,
        }}
      />

      {/* ========= SEITE 1 ========= */}
      <div className="pdf-page relative flex flex-col" style={{ minHeight: '1123px' }}>
        {/* Header Seite 1 */}
        <div className="p-6 pb-4">
          <div className="relative mb-8" style={{ minHeight: companyLogo ? '160px' : '120px' }}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h1 className="font-bold text-2xl">{data.companyName}</h1>
                <div className="mt-2">
                  <div className="font-semibold text-lg" style={{ color }}>
                    {data.documentLabel}
                  </div>
                  <div className="text-gray-600 text-sm">Nr. {data.invoiceNumber}</div>
                  <div className="text-gray-600 text-sm">{t('date')}: {formatDate(data.invoiceDate)}</div>
                </div>
              </div>

              <div className="shrink-0">
                {companyLogo && (
                  <img
                    src={companyLogo}
                    alt={data.companyName}
                    className="h-20 w-auto object-contain"
                    style={{ maxHeight: `${logoSize}px` }}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="mb-8 grid grid-cols-2 gap-8">
            <div>
              <div className="mb-3 font-semibold" style={{ color }}>
                {t('recipient')}
              </div>
              <div className="space-y-2">
                <div className="font-medium text-lg">{data.customerName}</div>
                {data.customerAddressParsed.street && (
                  <div>{data.customerAddressParsed.street}</div>
                )}
                {(data.customerAddressParsed.postalCode || data.customerAddressParsed.city) && (
                  <div>
                    {data.customerAddressParsed.postalCode} {data.customerAddressParsed.city}
                  </div>
                )}
                {data.customerAddressParsed.country && (
                  <div>{data.customerAddressParsed.country}</div>
                )}
                {data.customerVatId && (
                  <div className="mt-2 text-sm">
                    {t('vatId')}: {data.customerVatId}
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="mb-3 font-semibold" style={{ color }}>
                {t('documentDetails')}
              </div>
              <div className="space-y-2">
                <div>
                  {config.numberLabel}: {data.invoiceNumber}
                </div>
                <div>
                  {t('date')}: {formatDate(data.invoiceDate)}
                </div>
                <div>
                  {t('dueDate')}: {formatDate(data.dueDate)}
                </div>
                <div>
                  {t('paymentTerms')}: {data.paymentTerms}
                </div>
                {data.customerOrderNumber && (
                  <div>
                    {t('reference')}: {data.customerOrderNumber}
                  </div>
                )}
              </div>

              {/* QR-Code unter Dokumentdetails */}
              {documentSettings?.showQRCode && documentSettings?.qrCodeUrl && (
                <div className="mt-3">
                  <img
                    src={documentSettings.qrCodeUrl}
                    alt="QR Code"
                    className="h-12 w-12 border border-gray-300"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Betreff - Nur bei Stornorechnungen */}
          {detectedType === 'cancellation' && data.title && (
            <div className="mb-6">
              <div className="mb-1 font-semibold text-gray-600 text-sm">Betreff:</div>
              <div className="font-medium text-base text-gray-900">{data.title}</div>
            </div>
          )}

          {/* Kopftext / Einleitung - Nur EIN Text anzeigen (processedHeadTextHtml hat Priorität) */}
          {(data.processedHeadTextHtml || data.processedHeaderText) && (
            <div className="mb-4">
              <div
                className="text-gray-700 text-sm leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: data.processedHeadTextHtml || data.processedHeaderText,
                }}
              />
            </div>
          )}
        </div>

        {/* Items Section Seite 1 */}
        <div className="flex-1 px-6">
          <ItemsTable
            data={data}
            color={color}
            variant="standard"
            showArticleNumber={documentSettings?.showArticleNumber}
            showVATPerPosition={documentSettings?.showVATPerPosition}
            language={documentSettings?.language || 'de'}
          />

          {/* Totals und Footer wenn keine zweite Seite benötigt wird */}
          {!needsSecondPage && (
            <>
              {/* Tax Rules und Totals */}
              <div className="mt-6 mb-6 flex items-start justify-between gap-8">
                <div className="flex-1">
                  <div
                    className="rounded-r border-l-4 bg-linear-to-r from-blue-50 to-white p-4"
                    style={{ borderColor: color }}
                  >
                    <div className="mb-2 font-medium text-sm" style={{ color }}>
                      Steuerliche Behandlung
                    </div>
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
                  variant="standard"
                  language={documentSettings?.language || 'de'}
                />
              </div>

              {/* FooterText */}
              <div className="mb-4">
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
          <div className="mt-4 bg-white p-2">
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
          <div
            className="relative flex flex-col"
            style={{
              minHeight: '1123px',
              height: '1123px',
              pageBreakAfter: 'avoid',
              breakAfter: 'avoid',
            }}
          >
            {/* Header Seite 2 */}
            <div className="p-6 pb-4">
              <div
                className="relative mb-8"
                style={{ minHeight: data.companyLogo ? '160px' : '120px' }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h1 className="font-bold text-2xl">{data.companyName}</h1>
                    <div className="mt-2">
                      <div className="font-semibold text-lg" style={{ color }}>
                        {data.documentLabel}
                      </div>
                      <div className="text-gray-600 text-sm">Nr. {data.invoiceNumber}</div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {data.companyLogo && (
                      <img
                        src={data.companyLogo}
                        alt={data.companyName}
                        className="h-20 w-auto object-contain"
                        style={{ maxHeight: `${logoSize}px` }}
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-8 grid grid-cols-2 gap-8">
                <div>
                  <div className="mb-3 font-semibold" style={{ color }}>
                    Rechnungsempfänger
                  </div>
                  <div className="space-y-2">
                    <div className="font-medium text-lg">{data.customerName}</div>
                    {data.customerAddressParsed.street && (
                      <div>{data.customerAddressParsed.street}</div>
                    )}
                    {(data.customerAddressParsed.postalCode || data.customerAddressParsed.city) && (
                      <div>
                        {data.customerAddressParsed.postalCode} {data.customerAddressParsed.city}
                      </div>
                    )}
                    {data.customerAddressParsed.country && (
                      <div>{data.customerAddressParsed.country}</div>
                    )}
                    {data.customerVatId && (
                      <div className="mt-2 text-sm">USt-IdNr.: {data.customerVatId}</div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-3 font-semibold" style={{ color }}>
                    {t('documentDetails')}
                  </div>
                  <div className="space-y-2">
                    <div>{t('invoiceNumber')}: {data.invoiceNumber}</div>
                    <div>{t('date')}: {formatDate(data.invoiceDate)}</div>
                    <div>{t('dueDate')}: {formatDate(data.dueDate)}</div>
                    <div>{t('paymentTerms')}: {data.paymentTerms}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Fortsetzung + Totals Seite 2 */}
            <div className="flex-1 px-6">
              {/* Betreff - Nur bei Stornorechnungen (Seite 2) */}
              {detectedType === 'cancellation' && data.title && (
                <div className="mb-6">
                  <div className="mb-1 font-semibold text-gray-600 text-sm">Betreff:</div>
                  <div className="font-medium text-base text-gray-900">{data.title}</div>
                </div>
              )}

              <div className="mb-8">
                <div className="mb-2 font-semibold text-sm">Fortsetzung - Seite 2</div>
                <div className="mb-4 text-gray-600 text-xs">
                  Weitere Details und Zusammenfassung
                </div>
              </div>

              <div className="mb-8 flex items-start justify-between gap-8">
                <div className="flex-1">
                  <div
                    className="border-l-4 bg-linear-to-r from-blue-50 to-white p-4"
                    style={{ borderColor: color }}
                  >
                    <div className="mb-2 font-medium text-sm" style={{ color }}>
                      Steuerliche Behandlung
                    </div>
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
                  variant="standard"
                  language={documentSettings?.language || 'de'}
                />
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
