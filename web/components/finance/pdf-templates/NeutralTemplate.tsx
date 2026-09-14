import type React from 'react';
import { useTranslations } from "next-intl";
import { useDocumentTranslation } from '@/hooks/pdf/useDocumentTranslation';
import type { DocumentSettings, ProcessedPDFData } from '@/hooks/pdf/usePDFTemplateData';
import type { DocumentType } from '@/lib/document-utils';
import { detectDocumentType, getTranslatedDocumentTypeConfig } from '@/lib/document-utils';
import { formatDate } from '@/lib/utils';
import { FooterText } from './common/FooterText';
import { ItemsTable } from './common/ItemsTable';
import { SimpleFooter } from './common/SimpleFooter';
import { TaxRulesInfo } from './common/TaxRulesInfo';
import { TotalsDisplay } from './common/TotalsDisplay';

interface NeutralTemplateProps {
  data: ProcessedPDFData;
  color: string;
  logoSize: number;
  pageMode?: 'single' | 'multi';
  documentType?: DocumentType;
  documentSettings?: DocumentSettings;
}

export const NeutralTemplate: React.FC<NeutralTemplateProps> = ({
  data,
  color,
  logoSize,
  pageMode = 'multi',
  documentType,
  documentSettings,
}) => {
  // 🌍 ÜBERSETZUNGSSYSTEM
  const { t, dateLocale: locale } = useDocumentTranslation(documentSettings?.language || 'de');
  const tUi = useTranslations("finance");

  // Berechne, ob eine zweite Seite benötigt wird
  // STANDARD: Immer einseitig, außer der Inhalt ist zu lang
  const itemCount = data.items?.length || 0;
  const hasLongDescription =
    data.items?.some((item: { description?: string }) => (item.description?.length || 0) > 150) ||
    false;
  const hasHeaderText = !!(data.processedHeaderText || data.processedHeadTextHtml);
  const needsSecondPage =
    itemCount > 6 || (itemCount > 4 && hasLongDescription) || (itemCount > 5 && hasHeaderText);

  // 📋 KUNDENNUMMER - Bereits aus LivePreviewModal angereichert
  const _companyId = (data as any).companyId || '';
  const displayCustomerNumber =
    typeof data.customerNumber === 'string' ? data.customerNumber : undefined;

  // 📋 DYNAMISCHE DOKUMENTTYP-KONFIGURATION mit centraler document-utils
  // PRIORITÄT: Explizit übergebener documentType hat höchste Priorität
  const detectedType = documentType || detectDocumentType(data) || 'invoice';
  const config = getTranslatedDocumentTypeConfig(detectedType, t, color);
  const companyLogo = typeof data.companyLogo === 'string' ? data.companyLogo : undefined;
  const qrCodeUrl =
    typeof data.qrCodeUrl === 'string'
      ? data.qrCodeUrl
      : typeof documentSettings?.qrCodeUrl === 'string'
        ? documentSettings.qrCodeUrl
        : undefined;
  const epcQrCodeUrl =
    typeof data.epcQrCodeUrl === 'string'
      ? data.epcQrCodeUrl
      : typeof documentSettings?.epcQrCodeUrl === 'string'
        ? documentSettings.epcQrCodeUrl
        : undefined;

  // Footer-Daten - ECHTE Daten verwenden, KEINE Fallbacks!
  const _footerData = {
    companyName: (data as any).companyName,
    phoneNumber: (data as any).phoneNumber,
    email: (data as any).contactEmail,
    website: (data as any).companyWebsiteForBackend || (data as any).website,
    vatId: (data as any).vatId,
    taxNumber: (data as any).taxNumber,
    companyRegister: (data as any).registrationNumber,
    iban: (data as any).step4?.iban,
    bic: (data as any).step4?.bic,
    companySuffix: (data as any).step2?.companySuffix,
    legalForm: (data as any).legalForm || (data as any).step2?.legalForm,
    districtCourt: (data as any).districtCourt || (data as any).step3?.districtCourt,
    managingDirectors: (data as any).step1?.managingDirectors || [],
    firstName: (data as any).step1?.personalData?.firstName,
    lastName: (data as any).step1?.personalData?.lastName,
    companyStreet: (data as any).companyStreet,
    companyHouseNumber: (data as any).companyHouseNumber,
    companyPostalCode: (data as any).companyPostalCode,
    companyCity: (data as any).companyCity,
    step1: (data as any).step1,
    step2: (data as any).step2,
    step4: (data as any).step4,
  };

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
            .page-break { page-break-before: always; }
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
        {/* Simple Header - Seite 1 */}
        <div className="p-6 pb-4">
          <div
            className="mb-8 border-b-2 pb-6"
            style={{ minHeight: companyLogo ? '120px' : '80px', borderColor: config.color }}
          >
            <div className="flex items-start justify-between">
              {/* Firmenlogo links */}
              <div className="shrink-0">
                {companyLogo && (
                  <img
                    src={companyLogo}
                    alt={data.companyName}
                    className="h-16 w-auto object-contain"
                    style={{ maxHeight: `${logoSize}px` }}
                  />
                )}
                <h1 className="mt-4 mb-2 font-medium text-2xl">{config.title}</h1>
                <p className="text-gray-700">
                  {config.numberLabel}: {data.invoiceNumber}
                </p>
              </div>

              {/* Rechter Bereich mit QR-Code und Firmendaten */}
              <div className="flex flex-col items-end space-y-2">
                {/* QR-Code klein oben rechts */}
                {documentSettings?.showQRCode && qrCodeUrl && (
                  <div className="shrink-0">
                    <img
                      src={qrCodeUrl}
                      alt={tUi("pdf.qrCode")}
                      className="h-12 w-12 border border-gray-300"
                    />
                  </div>
                )}

                {/* Firmendaten */}
                <div className="text-right text-gray-700 text-xs leading-relaxed">
                  <div className="font-bold text-gray-900 text-lg">{data.companyName}</div>
                  {data.companyAddressParsed.street && (
                    <div>{data.companyAddressParsed.street}</div>
                  )}
                  {(data.companyAddressParsed.postalCode || data.companyAddressParsed.city) && (
                    <div>
                      {data.companyAddressParsed.postalCode} {data.companyAddressParsed.city}
                    </div>
                  )}
                  {data.companyAddressParsed.country && (
                    <div>{data.companyAddressParsed.country}</div>
                  )}
                  {data.companyPhone && <div>Tel.: {data.companyPhone}</div>}
                  {data.companyEmail && <div>E-Mail: {data.companyEmail}</div>}
                  {data.companyWebsite && <div>Web: {data.companyWebsite}</div>}
                </div>
              </div>
            </div>
          </div>

          {/* Customer and Document Info */}
          <div className="mb-6 grid grid-cols-2 gap-8">
            {data.customerName && (
              <div>
                <div className="mb-2 font-semibold">{config.recipientLabel}:</div>
                <div className="space-y-1">
                  <div className="font-medium">{data.customerName}</div>
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
                  {data.customerVatId && <div>USt-IdNr.: {data.customerVatId}</div>}

                  {/* Kundennummer basierend auf documentSettings */}
                  {documentSettings?.showCustomerNumber && displayCustomerNumber && (
                    <div>Kundennr.: {displayCustomerNumber}</div>
                  )}
                  {/* Kontaktperson basierend auf documentSettings */}
                  {documentSettings?.showContactPerson && data.contactPersonName && (
                    <div>Kontakt: {data.contactPersonName}</div>
                  )}
                </div>
              </div>
            )}

            <div>
              <div className="mb-2 font-semibold">Dokumentdetails:</div>
              <div className="space-y-1">
                <div>
                  {config.numberLabel}:{' '}
                  {detectedType === 'quote'
                    ? data.quoteNumber ||
                      data.documentNumber ||
                      data.title ||
                      data.invoiceNumber ||
                      'AN-000'
                    : data.invoiceNumber || data.documentNumber || data.title || 'DOKUMENT'}
                </div>
                <div>
                  {config.dateLabel}:{' '}
                  {formatDate(
                    detectedType === 'quote'
                      ? data.quoteDate ||
                          data.date ||
                          data.invoiceDate ||
                          new Date().toISOString().split('T')[0]
                      : data.invoiceDate || data.date || new Date().toISOString().split('T')[0], locale)}
                </div>
                {config.showDueDate && (
                  <div>
                    {config.dueDateLabel}: {(() => {
                      const fallbackDate = formatDate(
                        new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], locale);
                      const targetDate: string =
                        detectedType === 'quote'
                          ? data.validUntil || data.dueDate || fallbackDate
                          : data.dueDate || data.validUntil || fallbackDate;
                      // Wenn es wie YYYY-MM-DD aussieht, nochmals formatieren, ansonsten direkt verwenden
                      return targetDate.match(/^\d{4}-\d{2}-\d{2}$/)
                        ? formatDate(targetDate, locale)
                        : targetDate;
                    })()}
                  </div>
                )}
                {config.showPaymentTerms && <div>{t('paymentTerms')}: {data.paymentTerms}</div>}
                {data.customerOrderNumber && <div>Referenz: {data.customerOrderNumber}</div>}
              </div>
            </div>
          </div>

          {/* Betreff: Stornorechnungen und Angebote (dort steht Objekt und Zeitraum) */}
          {(detectedType === 'cancellation' || detectedType === 'quote') && data.title && (
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

          <div className="mb-4 border-t-2" style={{ borderColor: color }}></div>
        </div>

        {/* Items Table Seite 1 */}
        <div className="flex-1 px-6">
          <ItemsTable
            data={data}
            color={config.color}
            variant="neutral"
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
              <FooterText
                data={data}
                language={data.language || 'de'}
                variant="standard"
                documentType={detectedType}
              />

              {/* EPC-QR-Code */}
              {epcQrCodeUrl && (
                <div className="mt-2">
                  <img src={epcQrCodeUrl} alt="EPC-QR-Code" className="h-12 w-12" />
                </div>
              )}
            </>
          )}
        </div>

        {/* FOOTER auf Seite 1 - IMMER bei Single, AUCH bei Multi */}
        {documentSettings?.showFooter !== false && (
          <div className="mt-1 bg-white p-2">
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

      {/* ========= AUTOMATISCHE EIN-/MEHRSEITIG LOGIK ========= */}
      {/* Zweite Seite NUR WENN BENÖTIGT */}
      {needsSecondPage && (
        <>
          {/* ========= SEITENUMBRUCH ========= */}
          <div style={{ pageBreakBefore: 'always', height: '0' }}></div>

          {/* ========= SEITE 2 (nur bei > 3 Items) ========= */}
          <div
            className="pdf-page flex flex-col bg-white"
            style={{
              minHeight: '1123px',
              height: '1123px',
              pageBreakAfter: 'avoid',
              breakAfter: 'avoid',
            }}
          >
            {/* Seitenzahl Seite 2 */}
            {documentSettings?.showPageNumbers && (
              <div className="absolute right-6 bottom-4 z-10 text-gray-500 text-xs">{tUi("pdf.page2")}</div>
            )}
            {/* Header Seite 2 */}
            <div className="p-6 pb-4">
              <div
                className="mb-8 border-b-2 pb-6"
                style={{ minHeight: companyLogo ? '120px' : '80px', borderColor: color }}
              >
                <div className="flex items-start justify-between">
                  <div className="shrink-0">
                    {companyLogo && (
                      <img
                        src={companyLogo}
                        alt={data.companyName}
                        className="h-16 w-auto object-contain"
                        style={{ maxHeight: `${logoSize}px` }}
                      />
                    )}
                    <h1 className="mt-4 mb-2 font-medium text-2xl">{data.documentLabel}</h1>
                    <p className="text-gray-700">Nr. {data.invoiceNumber}</p>
                  </div>

                  <div className="text-right text-gray-700 text-xs leading-relaxed">
                    <div className="font-bold text-gray-900 text-lg">{data.companyName}</div>
                    {data.companyAddressParsed.street && (
                      <div>{data.companyAddressParsed.street}</div>
                    )}
                    {(data.companyAddressParsed.postalCode || data.companyAddressParsed.city) && (
                      <div>
                        {data.companyAddressParsed.postalCode} {data.companyAddressParsed.city}
                      </div>
                    )}
                    {data.companyAddressParsed.country && (
                      <div>{data.companyAddressParsed.country}</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-8 grid grid-cols-2 gap-8">
                {data.customerName && (
                  <div>
                    <div className="mb-2 font-semibold">{config.recipientLabel}:</div>
                    <div className="space-y-1">
                      <div className="font-medium">{data.customerName}</div>
                      {data.customerAddressParsed.street && (
                        <div>{data.customerAddressParsed.street}</div>
                      )}
                      {(data.customerAddressParsed.postalCode ||
                        data.customerAddressParsed.city) && (
                        <div>
                          {data.customerAddressParsed.postalCode} {data.customerAddressParsed.city}
                        </div>
                      )}
                      {data.customerAddressParsed.country && (
                        <div>{data.customerAddressParsed.country}</div>
                      )}
                      {data.customerVatId && <div>USt-IdNr.: {data.customerVatId}</div>}
                    </div>
                  </div>
                )}

                <div>
                  <div className="mb-2 font-semibold">{config.title}details:</div>
                  <div className="space-y-1">
                    <div>
                      Nr.{' '}
                      {detectedType === 'quote'
                        ? data.quoteNumber ||
                          data.documentNumber ||
                          data.title ||
                          data.invoiceNumber ||
                          'AN-000'
                        : data.invoiceNumber || data.documentNumber || data.title || 'DOKUMENT'}
                    </div>
                    <div>
                      {config.dateLabel}:{' '}
                      {formatDate(
                        detectedType === 'quote'
                          ? data.quoteDate ||
                              data.date ||
                              data.invoiceDate ||
                              new Date().toISOString().split('T')[0]
                          : data.invoiceDate || data.date || new Date().toISOString().split('T')[0], locale)}
                    </div>
                    {config.showDueDate && (
                      <div>
                        {config.dueDateLabel}: {(() => {
                          const fallbackDate = formatDate(
                            new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
                              .toISOString()
                              .split('T')[0], locale);
                          const targetDate: string =
                            detectedType === 'quote'
                              ? data.validUntil || data.dueDate || fallbackDate
                              : data.dueDate || data.validUntil || fallbackDate;
                          // Wenn es wie YYYY-MM-DD aussieht, nochmals formatieren, ansonsten direkt verwenden
                          return targetDate.match(/^\d{4}-\d{2}-\d{2}$/)
                            ? formatDate(targetDate, locale)
                            : targetDate;
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Betreff - Nur bei Stornorechnungen (Seite 2) */}
              {detectedType === 'cancellation' && data.title && (
                <div className="mb-6">
                  <div className="mb-1 font-semibold text-gray-600 text-sm">Betreff:</div>
                  <div className="font-medium text-base text-gray-900">{data.title}</div>
                </div>
              )}

              <div className="mb-4 border-t-2" style={{ borderColor: color }}></div>
            </div>

            {/* Fortsetzung + Totals Seite 2 */}
            <div className="flex-1 px-6">
              <div className="mb-8">
                <div className="mb-2 font-semibold text-sm">{tUi("pdf.continuationPage2")}</div>
                <div className="mb-4 text-gray-600 text-xs">
                  Weitere Details und Zusammenfassung
                </div>
              </div>

              {/* Totals */}
              <div className="mb-8 flex items-start justify-between gap-8">
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

              <FooterText
                data={data}
                language={data.language || 'de'}
                variant="standard"
                documentType={detectedType}
              />

              {/* EPC-QR-Code */}
              {epcQrCodeUrl && (
                <div className="mt-2">
                  <img src={epcQrCodeUrl} alt="EPC-QR-Code" className="h-12 w-12" />
                </div>
              )}
            </div>

            {/* SPACER um Seite zu füllen */}
            <div className="flex-1 bg-white"></div>

            {/* === FOOTER AM ENDE DER LETZTEN SEITE === */}
            {documentSettings?.showFooter !== false && (
              <div className="bg-white p-2">
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
