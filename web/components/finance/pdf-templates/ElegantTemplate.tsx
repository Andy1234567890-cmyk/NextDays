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

interface ElegantTemplateProps {
  data: ProcessedPDFData;
  color: string;
  logoSize: number;
  pageMode?: 'single' | 'multi';
  documentType?: DocumentType;
  documentSettings?: DocumentSettings;
}

export const ElegantTemplate: React.FC<ElegantTemplateProps> = ({
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
        fontFamily: 'Georgia, serif',
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
        `,
        }}
      />

      {/* ========= SEITE 1 ========= */}
      <div className="pdf-page relative flex flex-col" style={{ minHeight: '1123px' }}>
        {/* Wasserzeichen */}
        {documentSettings?.showWatermark && (
          <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
            <div className="rotate-45 transform select-none font-bold text-6xl text-gray-100">
              {data.documentLabel}
            </div>
          </div>
        )}
        {/* Elegant Header - Redesigned */}
        <div className="p-4 pb-2">
          <div className="relative mb-3" style={{ minHeight: companyLogo ? '90px' : '75px' }}>
            {/* Elegant top gradient line */}
            <div
              className="absolute top-0 left-0 h-0.5 w-full"
              style={{
                background: `linear-gradient(90deg, ${color} 0%, ${color}80 50%, transparent 100%)`,
              }}
            />

            <div className="flex items-start justify-between pt-4">
              {/* Logo Section */}
              <div className="shrink-0">
                {companyLogo && (
                  <div className="relative">
                    <img
                      src={companyLogo}
                      alt={data.companyName}
                      className="h-16 w-auto object-contain"
                      style={{ maxHeight: `${logoSize}px` }}
                    />
                  </div>
                )}
              </div>

              {/* Company Info Section */}
              <div className="max-w-xs text-right">
                <div className="mb-3">
                  <div className="mb-1 font-normal font-serif text-2xl text-gray-800 tracking-wide">
                    {data.companyName}
                  </div>
                  <div
                    className="ml-auto h-px w-16"
                    style={{ backgroundColor: color, opacity: 0.6 }}
                  />
                </div>

                <div className="space-y-0.5 text-gray-600 text-xs leading-relaxed">
                  {data.companyAddress && (
                    <div
                      className="font-light"
                      dangerouslySetInnerHTML={{
                        __html: data.companyAddress.replace(/\n/g, '<br/>'),
                      }}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Document Label - Positioned elegantly */}
            <div className="absolute bottom-0 left-0 flex items-end">
              <div>
                <div
                  className="font-light font-serif text-2xl tracking-wider"
                  style={{ color: config.color }}
                >
                  {config.title}
                </div>
                <div className="mt-1 flex items-center">
                  <div className="h-px w-12" style={{ backgroundColor: color }} />
                  <div
                    className="ml-2 h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mb-8 grid grid-cols-2 gap-12">
            <div>
              <div className="mb-4 font-light text-lg" style={{ color }}>
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
              <div className="mb-4 font-light text-lg" style={{ color }}>
                {t('documentDetails')}
              </div>
              <div className="space-y-1">
                <div>Nr. {data.invoiceNumber}</div>
                <div>
                  {t('date')}: {formatDate(data.invoiceDate)}
                </div>
                <div>
                  {t('dueDate')}: {formatDate(data.dueDate)}
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

          <div className="mb-4 flex items-center">
            <div className="h-px flex-1" style={{ backgroundColor: color, opacity: 0.3 }} />
            <div className="mx-4">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
            </div>
            <div className="h-px flex-1" style={{ backgroundColor: color, opacity: 0.3 }} />
          </div>
        </div>

        {/* Items Table Seite 1 */}
        <div className="flex-1 px-4">
          <ItemsTable
            data={data}
            color={color}
            variant="elegant"
            showArticleNumber={documentSettings?.showArticleNumber}
            showVATPerPosition={documentSettings?.showVATPerPosition}
            language={documentSettings?.language || 'de'}
          />

          {/* Totals und Footer wenn keine zweite Seite benötigt wird */}
          {!needsSecondPage && (
            <>
              {/* Totals */}
              <div className="mt-4 mb-4 flex items-start justify-between gap-6">
                <div className="flex-1">
                  <div className="rounded border-l-4 bg-gray-50 p-3" style={{ borderColor: color }}>
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
                  variant="elegant"
                  language={documentSettings?.language || 'de'}
                />
              </div>

              {/* FooterText */}
              <FooterText data={data} language={data.language || 'de'} variant="elegant" />

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
            className="pdf-page relative flex flex-col"
            style={{
              minHeight: '1123px',
              height: '1123px',
              pageBreakAfter: 'avoid',
              breakAfter: 'avoid',
            }}
          >
            {/* Header Seite 2 */}
            <div className="p-6 pb-4">
              <div className="relative mb-8" style={{ minHeight: companyLogo ? '160px' : '120px' }}>
                <div
                  className="absolute top-0 left-0 h-1 w-full"
                  style={{ background: `linear-gradient(90deg, ${color} 0%, transparent 100%)` }}
                />

                <div className="flex items-start justify-between pt-6">
                  <div className="shrink-0">
                    {companyLogo && (
                      <div className="relative">
                        <img
                          src={companyLogo}
                          alt={data.companyName}
                          className="h-20 w-auto object-contain"
                          style={{ maxHeight: `${logoSize}px` }}
                        />

                        <div
                          className="absolute -bottom-2 left-0 h-0.5 w-16"
                          style={{ backgroundColor: color }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="mb-2 font-light text-2xl text-gray-900">{data.companyName}</div>
                    <div className="space-y-1 text-gray-600 text-xs leading-relaxed">
                      {data.companyAddress && (
                        <div
                          dangerouslySetInnerHTML={{
                            __html: data.companyAddress.replace(/\n/g, '<br/>'),
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div className="absolute bottom-0 left-0">
                  <div className="font-light text-3xl" style={{ color }}>
                    {data.documentLabel}
                  </div>
                  <div className="mt-1 h-0.5 w-20" style={{ backgroundColor: color }} />
                </div>
              </div>

              <div className="mb-8 grid grid-cols-2 gap-12">
                <div>
                  <div className="mb-4 font-light text-lg" style={{ color }}>
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
                  <div className="mb-4 font-light text-lg" style={{ color }}>
                    {t('documentDetails')}
                  </div>
                  <div className="space-y-1">
                    <div>Nr. {data.invoiceNumber}</div>
                    <div>{t('date')}: {formatDate(data.invoiceDate)}</div>
                    <div>{t('dueDate')}: {formatDate(data.dueDate)}</div>
                  </div>
                </div>
              </div>

              <div className="mb-8 flex items-center">
                <div className="h-px flex-1" style={{ backgroundColor: color, opacity: 0.3 }} />
                <div className="mx-4">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                </div>
                <div className="h-px flex-1" style={{ backgroundColor: color, opacity: 0.3 }} />
              </div>
            </div>

            {/* Fortsetzung + Totals Seite 2 */}
            <div className="flex flex-1 flex-col px-6">
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
                  <div className="rounded border-l-4 bg-gray-50 p-4" style={{ borderColor: color }}>
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
                  variant="elegant"
                  language={documentSettings?.language || 'de'}
                />
              </div>

              <FooterText data={data} language={data.language || 'de'} variant="elegant" />

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

              {/* Spacer um Footer nach unten zu drücken */}
              <div className="flex-1"></div>
            </div>

            {/* Footer Seite 2 - UNTEN */}
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
