'use client';

import type React from 'react';
import {
  DynamicTemplate,
  ElegantTemplate,
  GeometricTemplate,
  NeutralTemplate,
  type PDFTemplateProps,
  StandardTemplate,
  TechnicalTemplate,
  usePDFTemplateData,
  StayTemplate,
} from './pdf-templates';

const PDFTemplate: React.FC<PDFTemplateProps> = props => {
  const data = usePDFTemplateData(props);

  // 🔥 Default DocumentSettings wenn keine übergeben werden
  const defaultDocumentSettings = {
    language: 'de',
    showQRCode: false,
    showEPCQRCode: false,
    showCustomerNumber: true,
    showContactPerson: true,
    showVATPerPosition: false,
    showArticleNumber: false,
    showFoldLines: true, // ← Falzmarken standardmäßig aktiviert
    showPageNumbers: true,
    showFooter: true,
    showWatermark: false,
  };

  const documentSettings = props.documentSettings || defaultDocumentSettings;

  // Template renderer based on selected template
  const renderTemplate = () => {
    const pageMode = props.pageMode || 'multi'; // Default: mehrseitig

    switch (props.template) {
      case 'TEMPLATE_STANDARD':
        return (
          <StandardTemplate
            data={data}
            color={props.color}
            logoSize={props.logoSize || 50}
            pageMode={pageMode}
            documentType={props.documentType}
            documentSettings={documentSettings}
          />
        );
      case 'TEMPLATE_NEUTRAL':
        return (
          <NeutralTemplate
            data={data}
            color={props.color}
            logoSize={props.logoSize || 50}
            pageMode={pageMode}
            documentType={props.documentType}
            documentSettings={documentSettings}
          />
        );
      case 'TEMPLATE_ELEGANT':
        return (
          <ElegantTemplate
            data={data}
            color={props.color}
            logoSize={props.logoSize || 50}
            pageMode={pageMode}
            documentType={props.documentType}
            documentSettings={documentSettings}
          />
        );
      case 'TEMPLATE_TECHNICAL':
        return (
          <TechnicalTemplate
            data={data}
            color={props.color}
            logoSize={props.logoSize || 50}
            pageMode={pageMode}
            documentType={props.documentType}
            documentSettings={documentSettings}
          />
        );
      case 'TEMPLATE_GEOMETRIC':
        return (
          <GeometricTemplate
            data={data}
            color={props.color}
            logoSize={props.logoSize || 50}
            pageMode={pageMode}
            documentType={props.documentType}
            documentSettings={documentSettings}
          />
        );
      case 'TEMPLATE_DYNAMIC':
        return (
          <DynamicTemplate
            data={data}
            color={props.color}
            logoSize={props.logoSize || 50}
            pageMode={pageMode}
            documentType={props.documentType}
            documentSettings={documentSettings}
          />
        );
      case 'TEMPLATE_STAY':
        return (
          <StayTemplate
            data={data}
            color={props.color}
            logoSize={props.logoSize || 50}
            pageMode={pageMode}
            documentType={props.documentType}
            documentSettings={documentSettings}
          />
        );
      default:
        return (
          <NeutralTemplate
            data={data}
            color={props.color}
            logoSize={props.logoSize || 50}
            pageMode={pageMode}
            documentType={props.documentType}
            documentSettings={documentSettings}
          />
        );
    }
  };

  return (
    <div className="h-full w-full bg-white shadow-lg" data-pdf-template={props.template}>
      {renderTemplate()}
    </div>
  );
};

export default PDFTemplate;
