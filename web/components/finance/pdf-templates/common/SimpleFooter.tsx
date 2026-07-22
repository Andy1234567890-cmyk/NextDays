'use client';

import type React from 'react';
import { useTranslations } from 'next-intl';
import type { ProcessedPDFData } from '@/hooks/pdf/usePDFTemplateData';
import { InvoiceFooter } from './InvoiceFooter';

interface PageFooterProps {
  data: ProcessedPDFData;
  color?: string;
  showPageNumbers?: boolean;
  currentPage?: number;
  totalPages?: number;
}

export const SimpleFooter: React.FC<PageFooterProps> = ({
  data,
  color = '#b82028',
  showPageNumbers = false,
  currentPage = 1,
  totalPages = 1,
}) => {
  const t = useTranslations('finance');
  const d = data as any;
  const footerData = {
    companyName: d.companyName || ' ',
    phoneNumber: d.phoneNumber || '',
    email: d.contactEmail || d.email || '',
    website: d.companyWebsiteForBackend || d.website || '',
    vatId: d.vatId || '',
    taxNumber: d.taxNumber || '',
    companyRegister: d.registrationNumber || d.companyRegister || '',
    iban: d.step4?.iban || d.iban || '',
    bic: d.step4?.bic || d.bic || '',
    companySuffix: d.step2?.companySuffix || '',
    legalForm: d.legalForm || d.step2?.legalForm || '',
    districtCourt: d.districtCourt || d.step3?.districtCourt || '',
    managingDirectors: d.step1?.managingDirectors || [],
    firstName: d.firstName || d.step1?.personalData?.firstName || '',
    lastName: d.lastName || d.step1?.personalData?.lastName || '',
    companyStreet: d.companyStreet || '',
    companyHouseNumber: d.companyHouseNumber || '',
    companyPostalCode: d.companyPostalCode || '',
    companyCity: d.companyCity || '',
    step1: d.step1,
    step2: d.step2,
    step4: d.step4,
  };

  return (
    <div className="mt-1 bg-white p-2">
      <InvoiceFooter data={footerData} color={color} />
      {showPageNumbers && (
        <div className="mt-1 text-center text-gray-500 text-xs">
          {totalPages > 1
            ? t('SimpleFooter.pageOf', { currentPage, totalPages })
            : t('SimpleFooter.page', { currentPage })}
        </div>
      )}
    </div>
  );
};
