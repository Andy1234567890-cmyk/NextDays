import type React from 'react';
import type { ProcessedPDFData } from '@/hooks/pdf/usePDFTemplateData';
import { PDF_PAGE_STYLES } from '@/utils/pdf-page-styles';
import { InvoiceFooter } from './InvoiceFooter';

interface PageFooterProps {
  data: ProcessedPDFData;
  color?: string;
  variant?: 'standard' | 'elegant' | 'technical' | 'geometric' | 'dynamic' | 'neutral';
}

export const PageFooter: React.FC<PageFooterProps> = ({
  data,
  color = '#b82028',
  variant: _variant = 'standard',
}) => {
  return (
    <div
      className="border-gray-200 border-t bg-gray-50 px-6 py-2"
      style={PDF_PAGE_STYLES.pageFooter}
    >
      <InvoiceFooter
        data={{
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
          districtCourt:
            (data as any).districtCourt || (data as any).step3?.districtCourt || '',
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
        }}
        color={color}
      />
    </div>
  );
};
