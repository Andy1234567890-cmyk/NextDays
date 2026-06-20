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

interface DynamicTemplateProps {
  data: ProcessedPDFData;
  color: string;
  logoSize: number;
  pageMode?: 'single' | 'multi';
  documentType?: DocumentType;
  documentSettings?: DocumentSettings;
}

export const DynamicTemplate: React.FC<DynamicTemplateProps> = ({
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
  const _config = getDocumentTypeConfig(detectedType, color);
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
      className={`mx-auto w-full bg-white ${pageMode === 'single' ? 'text-[10px] leading-tight' : 'text-xs'} relative overflow-hidden`}
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
            left: 0;
            top: 148.5mm;
            width: 3mm;
            height: 3mm;
            border: 1px solid #ccc;
            border-radius: 50%;
            z-index: 100;
          }
          `
              : ''
          }
          /* Dynamic Template Styles */
          .dynamic-bg {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          }
          .dynamic-shape {
            position: absolute;
            border-radius: 50%;
            background: ${color};
            opacity: 0.05;
            z-index: 0;
          }
          .dynamic-accent {
            background-color: ${color};
          }
        `,
        }}
      />

      {/* ========= SEITE 1 ========= */}
      <div className="pdf-page dynamic-bg flex flex-col" style={{ minHeight: '1123px' }}>
        {/* Dynamic shapes background */}
        <div
          className="dynamic-shape"
          style={{ width: '200px', height: '200px', top: '-50px', right: '-50px', opacity: 0.1 }}
        />

        <div
          className="dynamic-shape"
          style={{ width: '100px', height: '100px', top: '100px', left: '-30px', opacity: 0.08 }}
        />

        <div
          className="dynamic-shape"
          style={{ width: '150px', height: '150px', bottom: '50px', right: '20px', opacity: 0.06 }}
        />

        {/* Dynamic Header Seite 1 */}
        <div className="relative z-10 p-6 pb-4">
          <div className="relative mb-8" style={{ minHeight: companyLogo ? '160px' : '120px' }}>
            <div className="mb-6 flex items-start justify-between">
              <div className="flex-1">
                <div className="dynamic-accent inline-block rounded-r-full p-4 pr-8 text-white">
                  <h1 className="font-bold text-2xl">{data.companyName}</h1>
                </div>
                <div className="mt-2 ml-4">
                  <div className="font-semibold text-lg" style={{ color }}>
                    {data.documentLabel}
                  </div>
                  <div className="text-gray-600 text-sm">Nr. {data.invoiceNumber}</div>
                </div>
              </div>

              <div className="shrink-0">
                {companyLogo && (
                  <div className="relative">
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{ backgroundColor: color, opacity: 0.1 }}
                    />

                    <img
                      src={companyLogo}
                      alt={data.companyName}
                      className="relative h-20 w-auto object-contain p-2"
                      style={{ maxHeight: `${logoSize}px` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mb-8 grid grid-cols-2 gap-8">
            <div
              className="rounded-lg border-l-4 bg-white/70 p-4 backdrop-blur-sm"
              style={{ borderColor: color }}
            >
              <div className="mb-3 font-semibold text-lg" style={{ color }}>
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

            <div
              className="rounded-lg border-l-4 bg-white/70 p-4 backdrop-blur-sm"
              style={{ borderColor: color }}
            >
              <div className="mb-3 font-semibold text-lg" style={{ color }}>
                {t('documentDetails')}
              </div>
              <div className="space-y-2">
                <div>
                  <span className="font-medium">{t('date')}:</span> {formatDate(data.invoiceDate)}
                </div>
                <div>
                  <span className="font-medium">{t('dueDate')}:</span> {formatDate(data.dueDate)}
                </div>
                <div>
                  <span className="font-medium">{t('paymentTerms')}:</span> {data.paymentTerms}
                </div>
                {data.customerOrderNumber && (
                  <div>
                    <span className="font-medium">{t('reference')}:</span>{' '}
                    {data.customerOrderNumber}
                  </div>
                )}
              </div>

              {/* QR-Code unter Dokumentdetails */}
              {documentSettings?.showQRCode && documentSettings?.qrCodeUrl && (
                <div className="mt-3">
                  <img
                    src={documentSettings.qrCodeUrl}
                    alt="QR Code"
                    className="h-12 w-12 rounded-lg border border-gray-300"
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

          <div className="mb-6 flex items-center justify-center">
            <div className="h-px flex-1 bg-linear-to-r from-transparent via-gray-300 to-transparent" />
            <div className="mx-4">
              <div className="dynamic-accent h-3 w-3 rounded-full" />
            </div>
            <div className="h-px flex-1 bg-linear-to-r from-transparent via-gray-300 to-transparent" />
          </div>
        </div>

        {/* Items Table Seite 1 */}
        <div className="flex-1 px-6">
          <ItemsTable
            data={data}
            color={color}
            variant="dynamic"
            showArticleNumber={documentSettings?.showArticleNumber}
            showVATPerPosition={documentSettings?.showVATPerPosition}
            language={documentSettings?.language || 'de'}
          />

          {/* Totals und Footer wenn keine zweite Seite benötigt wird */}
          {!needsSecondPage && (
            <>
              {/* Totals */}
              <div className="mt-8 mb-8 flex items-start justify-between gap-8">
                <div className="flex-1 space-y-4">
                  <TaxRulesInfo
                    data={data}
                    color={color}
                    language={documentSettings?.language || 'de'}
                  />
                </div>
                <TotalsDisplay
                  data={data}
                  color={color}
                  variant="standard"
                  language={documentSettings?.language || 'de'}
                />
              </div>

              {/* FooterText */}
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
            </>
          )}
        </div>

        {/* FOOTER SEITE 1 */}
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
            className="dynamic-bg relative flex flex-col"
            style={{
              minHeight: '1123px',
              height: '1123px',
              pageBreakAfter: 'avoid',
              breakAfter: 'avoid',
            }}
          >
            {/* Dynamic shapes background Seite 2 */}
            <div
              className="dynamic-shape"
              style={{
                width: '180px',
                height: '180px',
                top: '-40px',
                left: '-40px',
                opacity: 0.08,
              }}
            />

            <div
              className="dynamic-shape"
              style={{
                width: '120px',
                height: '120px',
                top: '80px',
                right: '-20px',
                opacity: 0.06,
              }}
            />

            <div
              className="dynamic-shape"
              style={{
                width: '90px',
                height: '90px',
                bottom: '100px',
                left: '30px',
                opacity: 0.04,
              }}
            />

            {/* Header Seite 2 */}
            <div className="relative z-10 p-6 pb-4">
              <div className="relative mb-8" style={{ minHeight: companyLogo ? '160px' : '120px' }}>
                <div className="mb-6 flex items-start justify-between">
                  <div className="flex-1">
                    <div className="dynamic-accent inline-block rounded-r-full p-4 pr-8 text-white">
                      <h1 className="font-bold text-2xl">{data.companyName}</h1>
                    </div>
                    <div className="mt-2 ml-4">
                      <div className="font-semibold text-lg" style={{ color }}>
                        {data.documentLabel}
                      </div>
                      <div className="text-gray-600 text-sm">Nr. {data.invoiceNumber}</div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {companyLogo && (
                      <div className="relative">
                        <div
                          className="absolute inset-0 rounded-full"
                          style={{ backgroundColor: color, opacity: 0.1 }}
                        />

                        <img
                          src={companyLogo}
                          alt={data.companyName}
                          className="relative h-20 w-auto object-contain p-2"
                          style={{ maxHeight: `${logoSize}px` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-8 grid grid-cols-2 gap-8">
                <div
                  className="rounded-lg border-l-4 bg-white/70 p-4 backdrop-blur-sm"
                  style={{ borderColor: color }}
                >
                  <div className="mb-3 font-semibold text-lg" style={{ color }}>
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

                <div
                  className="rounded-lg border-l-4 bg-white/70 p-4 backdrop-blur-sm"
                  style={{ borderColor: color }}
                >
                  <div className="mb-3 font-semibold text-lg" style={{ color }}>
                    Rechnungsdetails
                  </div>
                  <div className="space-y-2">
                    <div>
                      <span className="font-medium">Datum:</span> {formatDate(data.invoiceDate)}
                    </div>
                    <div>
                      <span className="font-medium">Fälligkeitsdatum:</span>{' '}
                      {formatDate(data.dueDate)}
                    </div>
                    <div>
                      <span className="font-medium">Zahlungsziel:</span> {data.paymentTerms}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-6 flex items-center justify-center">
                <div className="h-px flex-1 bg-linear-to-r from-transparent via-gray-300 to-transparent" />
                <div className="mx-4">
                  <div className="dynamic-accent h-3 w-3 rounded-full" />
                </div>
                <div className="h-px flex-1 bg-linear-to-r from-transparent via-gray-300 to-transparent" />
              </div>
            </div>

            {/* Fortsetzung + Totals Seite 2 */}
            <div className="relative z-10 flex-1 px-6">
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
                    className="rounded-lg border-l-4 bg-white/80 p-4 backdrop-blur-sm"
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

              {data.notes && (
                <div
                  className="mt-4 rounded-lg border-l-4 bg-white/80 p-4 backdrop-blur-sm"
                  style={{ borderColor: color }}
                >
                  <div className="mb-2 font-semibold text-sm" style={{ color }}>
                    Hinweise
                  </div>
                  <div className="whitespace-pre-line text-gray-700 text-sm">{data.notes}</div>
                </div>
              )}
            </div>

            {/* Footer Seite 2 */}
            {documentSettings?.showFooter !== false && (
              <div className="relative z-10 mt-3 bg-white p-2">
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
