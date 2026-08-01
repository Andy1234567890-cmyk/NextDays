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

interface StandardTemplateProps {
  data: ProcessedPDFData;
  color: string;
  logoSize: number;
  pageMode?: 'single' | 'multi';
  documentType?: DocumentType;
  documentSettings?: DocumentSettings;
}

export const StandardTemplate: React.FC<StandardTemplateProps> = ({
  data,
  color,
  logoSize,
  pageMode: _pageMode = 'multi',
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

  // 📋 DYNAMISCHE DOKUMENTTYP-KONFIGURATION
  // PRIORITÄT: Explizit übergebener documentType hat höchste Priorität
  const detectedType = documentType || detectDocumentType(data) || 'invoice';
  const config = getTranslatedDocumentTypeConfig(detectedType, t, color);
  const companyLogo = typeof data.companyLogo === 'string' ? data.companyLogo : undefined;
  const customerNumber = typeof data.customerNumber === 'string' ? data.customerNumber : undefined;

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
      className="mx-auto w-full bg-white text-xs"
      style={{
        fontFamily: 'Arial, sans-serif',
        width: '794px',
        maxWidth: '794px',
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @page { size: A4; margin: 0; }
          @media print {
            .force-page-break {
              page-break-before: always !important;
              break-before: page !important;
              display: block !important;
              height: 1px !important;
              width: 100% !important;
            }
          }
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
        {/* HEADER SEITE 1 */}
        <div className="p-6 pb-4">
          <div className="relative mb-4">
            <div className="absolute top-0 left-0 h-2 w-full" style={{ backgroundColor: color }} />
            <div
              className="flex items-start justify-between pt-6"
              style={{ minHeight: companyLogo ? '160px' : '80px' }}
            >
              <div className="shrink-0 text-left">
                <div className="mb-2 font-bold text-2xl">{config.title}</div>
              </div>

              <div className="flex flex-1 items-start justify-end">
                {/* Logo */}
                <div
                  className={companyLogo ? 'mb-4' : ''}
                  style={{
                    height: companyLogo ? '100px' : '0px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {companyLogo && (
                    <img
                      src={companyLogo}
                      alt="Logo"
                      style={{
                        height: `${Math.max(logoSize * 1.2, 50)}px`,
                        maxHeight: '100px',
                        width: 'auto',
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mb-8 grid grid-cols-2 gap-8">
            <div>
              <div className="mb-2 font-semibold">{config.recipientLabel}:</div>
              <div className="font-medium">{data.customerName}</div>
              <div className="mt-1 text-gray-600">
                <div>{data.customerAddressParsed.street}</div>
                <div>
                  {data.customerAddressParsed.postalCode} {data.customerAddressParsed.city}
                </div>
                <div>{data.customerAddressParsed.country}</div>
              </div>
              {data.customerVatId && (
                <div className="mt-1 text-gray-600">USt-IdNr.: {data.customerVatId}</div>
              )}
              {/* Kundennummer basierend auf documentSettings */}
              {documentSettings?.showCustomerNumber && customerNumber && (
                <div className="mt-1 text-gray-600">
                  {t('customerNumber')}: {customerNumber}
                </div>
              )}
              {/* Kontaktperson basierend auf documentSettings */}
              {documentSettings?.showContactPerson && data.contactPersonName && (
                <div className="mt-1 text-gray-600">
                  {t('contact')}: {data.contactPersonName}
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <div className="mb-2 font-semibold">{t('documentDetails')}:</div>
                <div className="space-y-1">
                  <div>
                    {config.numberLabel}: {data.invoiceNumber}
                  </div>
                  <div>
                    {config.dateLabel}: {formatDate(data.invoiceDate, locale)}
                  </div>
                  {config.showDueDate && data.dueDate && (
                    <div>
                      {config.dueDateLabel}: {formatDate(data.dueDate, locale)}
                    </div>
                  )}
                  {data.customerOrderNumber && (
                    <div>
                      {t('reference')}: {data.customerOrderNumber}
                    </div>
                  )}
                </div>
              </div>

              {/* QR-Code neben Dokumentdetails - kompakt */}
              {documentSettings?.showQRCode && documentSettings?.qrCodeUrl && (
                <div className="shrink-0">
                  <img
                    src={documentSettings.qrCodeUrl}
                    alt={tUi("pdf.qrCode")}
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

          <div className="mb-4 border-t-2" style={{ borderColor: color }}></div>
        </div>

        {/* Items Table Seite 1 */}
        <div className="relative z-10 flex-1 px-6">
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
              <FooterText data={data} variant="standard" language={data.language || 'de'} />

              {/* EPC-QR-Code NACH dem FooterText */}
              {documentSettings?.showEPCQRCode && (
                <div className="mt-4 border-gray-200 border-t p-2">
                  <div>
                    {documentSettings?.epcQrCodeUrl ? (
                      <img
                        src={documentSettings.epcQrCodeUrl}
                        alt={tUi("pdf.epcQrCode")}
                        className="h-12 w-12 border border-gray-300"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center border border-gray-300 bg-gray-200 text-gray-500 text-xs">
                        EPC
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* FOOTER SEITE 1 */}
        <div className="mt-4 bg-white p-2">
          {documentSettings?.showFooter !== false && (
            <SimpleFooter
              data={data}
              color={color}
              showPageNumbers={documentSettings?.showPageNumbers}
              currentPage={1}
              totalPages={needsSecondPage ? 2 : 1}
            />
          )}
        </div>
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
            className="no-page-break flex flex-col"
            style={{
              minHeight: '1123px',
              height: '1123px',
              pageBreakAfter: 'avoid',
              breakAfter: 'avoid',
            }}
          >
            {/* HEADER SEITE 2 */}
            <div className="p-6 pb-4">
              <div className="relative mb-4">
                <div
                  className="absolute top-0 left-0 h-2 w-full"
                  style={{ backgroundColor: color }}
                />

                <div
                  className="flex items-start justify-between pt-6"
                  style={{ minHeight: companyLogo ? '160px' : '80px' }}
                >
                  <div className="shrink-0 text-left">
                    <div className="mb-2 font-bold text-2xl">{data.documentLabel}</div>
                  </div>

                  <div className="flex flex-1 justify-end">
                    <div
                      className={companyLogo ? 'mb-4' : ''}
                      style={{
                        height: companyLogo ? '100px' : '0px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {companyLogo && (
                        <img
                          src={companyLogo}
                          alt="Logo"
                          style={{
                            height: `${Math.max(logoSize * 1.2, 50)}px`,
                            maxHeight: '100px',
                            width: 'auto',
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Empfänger und Details auch auf Seite 2 */}
              <div className="mb-8 grid grid-cols-2 gap-8">
                <div>
                  <div className="mb-2 font-semibold">{config.recipientLabel}:</div>
                  <div className="font-medium">{data.customerName}</div>
                  <div className="mt-1 text-gray-600">
                    <div>{data.customerAddressParsed.street}</div>
                    <div>
                      {data.customerAddressParsed.postalCode} {data.customerAddressParsed.city}
                    </div>
                    <div>{data.customerAddressParsed.country}</div>
                  </div>
                  {data.customerVatId && (
                    <div className="mt-1 text-gray-600">USt-IdNr.: {data.customerVatId}</div>
                  )}
                </div>

                <div>
                  <div className="mb-2 font-semibold">{t('documentDetails')}:</div>
                  <div className="space-y-1">
                    <div>
                      {config.numberLabel}: {data.invoiceNumber}
                    </div>
                    <div>
                      {config.dateLabel}: {formatDate(data.invoiceDate, locale)}
                    </div>
                    {config.showDueDate && data.dueDate && (
                      <div>
                        {config.dueDateLabel}: {formatDate(data.dueDate, locale)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-4 border-t-2" style={{ borderColor: color }}></div>
            </div>

            {/* WEITERFÜHRENDE TABELLE + TOTALS + FOOTERTEXT */}
            <div className="flex-1 px-6">
              {/* Betreff - Nur bei Stornorechnungen (Seite 2) */}
              {detectedType === 'cancellation' && data.title && (
                <div className="mb-6">
                  <div className="mb-1 font-semibold text-gray-600 text-sm">Betreff:</div>
                  <div className="font-medium text-base text-gray-900">{data.title}</div>
                </div>
              )}

              {/* Fortsetzung Tabelle falls nötig - für Test sichtbarer Inhalt */}
              <div className="mb-8">
                <div className="mb-2 font-semibold text-sm">{tUi("pdf.continuationPage2")}</div>
                <div className="mb-4 text-gray-600 text-xs">
                  Weitere Details und Zusammenfassung
                </div>
              </div>

              {/* TOTALS */}
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

              <FooterText data={data} variant="standard" language={data.language || 'de'} />

              {/* EPC-QR-Code NACH dem FooterText (Seite 2) */}
              {documentSettings?.showEPCQRCode && (
                <div className="mt-4 border-gray-200 border-t p-2">
                  <div>
                    {documentSettings?.epcQrCodeUrl ? (
                      <img
                        src={documentSettings.epcQrCodeUrl}
                        alt={tUi("pdf.epcQrCode")}
                        className="h-12 w-12 border border-gray-300"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center border border-gray-300 bg-gray-200 text-gray-500 text-xs">
                        EPC
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* FOOTER SEITE 2 */}
            <div className="mt-3 bg-white p-2">
              <SimpleFooter
                data={data}
                color={color}
                showPageNumbers={documentSettings?.showPageNumbers}
                currentPage={2}
                totalPages={2}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};
