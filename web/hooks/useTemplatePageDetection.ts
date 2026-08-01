/**
 * Template Page Detection Hook
 * React Hook für die Verwendung des Template Page Detection Systems
 */

import { useEffect, useMemo, useState } from 'react';
import {
  analyzeTemplateStructure,
  estimateDocumentPages,
  getTemplatePageInfo,
  getTemplatePageType,
  isMultiPageTemplate,
  isSinglePageTemplate,
  TEMPLATE_PAGE_DEFINITIONS,
  type TemplatePageInfo,
  type TemplatePageType,
  validateTemplateForDocument,
} from '@/utils/template-page-detector';

export interface UseTemplatePageDetectionOptions {
  templateId?: string;
  documentData?: {
    items?: Array<any>;
  };
  templateElement?: HTMLElement | null;
  enableDynamicAnalysis?: boolean;
}

export interface UseTemplatePageDetectionResult {
  // Basis-Informationen
  pageType: TemplatePageType;
  isMultiPage: boolean;
  isSinglePage: boolean;

  // Detaillierte Informationen
  pageInfo: TemplatePageInfo | null;
  estimatedPages: number;
  hasPageBreaks: boolean;
  supportsMultiPage: boolean;

  // Validation
  validation: {
    isValid: boolean;
    warnings: string[];
    recommendations: string[];
  };

  // Utility functions
  analyzeElement: (element: HTMLElement | null) => TemplatePageInfo;
  refreshAnalysis: () => void;

  // Alle verfügbaren Templates
  allTemplates: Record<string, TemplatePageInfo>;
  multiPageTemplates: string[];
  singlePageTemplates: string[];
}

/**
 * Hook für Template-Seiten-Erkennung
 */
export function useTemplatePageDetection({
  templateId,
  documentData,
  templateElement,
  enableDynamicAnalysis = false,
}: UseTemplatePageDetectionOptions = {}): UseTemplatePageDetectionResult {
  const [dynamicAnalysis, setDynamicAnalysis] = useState<TemplatePageInfo | null>(null);

  // Basis-Informationen aus Template-ID
  const staticInfo = useMemo(() => {
    if (!templateId) return null;
    return getTemplatePageInfo(templateId);
  }, [templateId]);

  // Kombiniere statische und dynamische Analyse
  const pageInfo = useMemo(() => {
    if (dynamicAnalysis && enableDynamicAnalysis) {
      return {
        ...dynamicAnalysis,
        templateId: templateId || 'analyzed',
      };
    }
    return staticInfo;
  }, [staticInfo, dynamicAnalysis, enableDynamicAnalysis, templateId]);

  // Seiten-Schätzung
  const estimatedPages = useMemo(() => {
    if (!templateId) return 1;
    const itemsCount = documentData?.items?.length || 0;
    return estimateDocumentPages(templateId, itemsCount);
  }, [templateId, documentData?.items?.length]);

  // Validation
  const validation = useMemo(() => {
    if (!templateId || !documentData) {
      return { isValid: true, warnings: [], recommendations: [] };
    }
    return validateTemplateForDocument(templateId, documentData);
  }, [templateId, documentData]);

  // Template-Listen
  const templateLists = useMemo(() => {
    const multiPage: string[] = [];
    const singlePage: string[] = [];

    Object.entries(TEMPLATE_PAGE_DEFINITIONS).forEach(([id, _info]) => {
      if (_info.pageType === 'multi-page') {
        multiPage.push(id);
      } else {
        singlePage.push(id);
      }
    });

    return { multiPage, singlePage };
  }, []);

  // Dynamische Analyse des Template-Elements
  const analyzeElement = useMemo(() => {
    return (element: HTMLElement | null) => {
      const analysis = analyzeTemplateStructure(element);
      if (enableDynamicAnalysis) {
        setDynamicAnalysis(analysis);
      }
      return analysis;
    };
  }, [enableDynamicAnalysis]);

  // Auto-Analyse bei Template-Element-Änderungen
  useEffect(() => {
    if (enableDynamicAnalysis && templateElement) {
      analyzeElement(templateElement);
    }
  }, [templateElement, enableDynamicAnalysis, analyzeElement]);

  // Refresh-Funktion
  const refreshAnalysis = useMemo(() => {
    return () => {
      if (templateElement) {
        analyzeElement(templateElement);
      }
    };
  }, [templateElement, analyzeElement]);

  return {
    // Basis-Informationen
    pageType: pageInfo?.pageType || 'single-page',
    isMultiPage: pageInfo?.pageType === 'multi-page' || false,
    isSinglePage: pageInfo?.pageType === 'single-page' || true,

    // Detaillierte Informationen
    pageInfo,
    estimatedPages,
    hasPageBreaks: pageInfo?.hasPageBreaks || false,
    supportsMultiPage: pageInfo?.supportsMultiPage || false,

    // Validation
    validation,

    // Utility functions
    analyzeElement,
    refreshAnalysis,

    // Alle verfügbaren Templates
    allTemplates: TEMPLATE_PAGE_DEFINITIONS,
    multiPageTemplates: templateLists.multiPage,
    singlePageTemplates: templateLists.singlePage,
  };
}

/**
 * Einfacher Hook nur für Template-Typ-Prüfung
 */
export function useTemplatePageType(templateId?: string): {
  isMultiPage: boolean;
  isSinglePage: boolean;
  pageType: TemplatePageType;
} {
  return useMemo(() => {
    if (!templateId) {
      return {
        isMultiPage: false,
        isSinglePage: true,
        pageType: 'single-page' as TemplatePageType,
      };
    }

    return {
      isMultiPage: isMultiPageTemplate(templateId),
      isSinglePage: isSinglePageTemplate(templateId),
      pageType: getTemplatePageType(templateId),
    };
  }, [templateId]);
}

/**
 * Hook für Template-Empfehlungen
 */
export function useTemplateRecommendations(documentData?: { items?: Array<any> }) {
  return useMemo(() => {
    const itemsCount = documentData?.items?.length || 0;

    const recommendations = {
      suggested: [] as string[],
      warnings: {} as Record<string, string[]>,
    };

    // Empfehlungen basierend auf Anzahl Items
    if (itemsCount <= 5) {
      recommendations.suggested.push('TEMPLATE_ELEGANT'); // Einseitig für wenige Items
    } else if (itemsCount <= 15) {
      recommendations.suggested.push('TEMPLATE_NEUTRAL', 'TEMPLATE_STANDARD'); // Mehrseitig
    } else {
      recommendations.suggested.push('TEMPLATE_TECHNICAL', 'TEMPLATE_GEOMETRIC'); // Mehrseitig für viele Items
    }

    // Warnungen für problematische Kombinationen
    Object.entries(TEMPLATE_PAGE_DEFINITIONS).forEach(([templateId, _info]) => {
      const validation = validateTemplateForDocument(templateId, documentData || {});
      if (validation.warnings.length > 0) {
        recommendations.warnings[templateId] = validation.warnings;
      }
    });

    return recommendations;
  }, [documentData]);
}
