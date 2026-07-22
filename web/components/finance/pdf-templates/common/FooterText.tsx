import type React from 'react';
import type { ProcessedPDFData } from '@/hooks/pdf/usePDFTemplateData';
import type { DocumentType } from '@/lib/document-utils';

interface FooterTextProps {
  data: ProcessedPDFData;
  variant?: 'standard' | 'elegant' | 'compact';
  documentType?: DocumentType;
  language?: string;
}

export const FooterText: React.FC<FooterTextProps> = ({
  data,
  variant = 'standard',
  documentType: _documentType,
  language: _language = 'de',
}) => {
  // 🔥 CRITICAL FIX: Verwende processedFooterText (bereits verarbeitet in usePDFTemplateData)
  // NICHT data.footerText (enthält noch Platzhalter)!
  const processedFooterText = data.processedFooterText || data.footerText || '';

  if (!processedFooterText) return null;

  if (variant === 'elegant') {
    return (
      <div className="mt-4 rounded bg-linear-to-r from-gray-50 to-white p-3">
        <div
          className="text-gray-700 text-sm leading-relaxed"
          dangerouslySetInnerHTML={{
            __html: processedFooterText,
          }}
        />
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="mt-4 rounded border bg-gray-50 p-3">
        <div
          className="text-gray-700 text-xs leading-normal"
          dangerouslySetInnerHTML={{
            __html: processedFooterText,
          }}
        />
      </div>
    );
  }

  // Standard variant
  return (
    <div className="mb-2 rounded bg-gray-50 p-2">
      <div
        className="text-gray-700 text-xs leading-normal"
        dangerouslySetInnerHTML={{
          __html: processedFooterText,
        }}
      />
    </div>
  );
};
