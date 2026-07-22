import type React from 'react';
import type { ProcessedPDFData } from '@/hooks/pdf/usePDFTemplateData';

interface PDFSectionProps {
  data: ProcessedPDFData;
  children: React.ReactNode;
  sectionType: 'header' | 'content' | 'items' | 'totals';
  hasFooter?: boolean;
}

export const PDFSection: React.FC<PDFSectionProps> = ({
  data,
  children,
  sectionType,
  hasFooter: _hasFooter = true,
}) => {
  const _footerData = {
    companyName: (data as any).companyName || '',
    phoneNumber: (data as any).phoneNumber || '',
    email: (data as any).contactEmail || '',
    website: (data as any).companyWebsiteForBackend || (data as any).website || '',
    vatId: (data as any).vatId || '',
    taxNumber: (data as any).taxNumber || '',
    companyRegister: (data as any).registrationNumber || '',
    iban: (data as any).step4?.iban || '',
    bic: (data as any).step4?.bic || '',
    companySuffix: (data as any).step2?.companySuffix || '',
    legalForm: (data as any).legalForm || (data as any).step2?.legalForm || '',
    districtCourt: (data as any).districtCourt || (data as any).step3?.districtCourt || '',
    managingDirectors: (data as any).step1?.managingDirectors || [],
    firstName: (data as any).firstName || (data as any).step1?.personalData?.firstName || '',
    lastName: (data as any).lastName || (data as any).step1?.personalData?.lastName || '',
    companyStreet: (data as any).companyStreet || '',
    companyHouseNumber: (data as any).companyHouseNumber || '',
    companyPostalCode: (data as any).companyPostalCode || '',
    companyCity: (data as any).companyCity || '',
    step1: (data as any).step1,
    step2: (data as any).step2,
    step4: (data as any).step4,
  };

  return (
    <div className={`section-${sectionType} mb-6`}>
      {/* Nur der Sektion Inhalt - KEIN Footer hier */}
      {children}
    </div>
  );
};
