/**
 * Template Page Detection System
 * Erkennt automatisch ob Templates einseitig oder mehrseitig sind
 */

export type TemplatePageType = 'single-page' | 'multi-page';

export interface TemplatePageInfo {
  templateId: string;
  pageType: TemplatePageType;
  hasPageBreaks: boolean;
  estimatedPages: number;
  supportsMultiPage: boolean;
}

// Template-Definitionen mit automatischer Ein-/Mehrseitig-Logik
export const TEMPLATE_PAGE_DEFINITIONS: Record<string, TemplatePageInfo> = {
  TEMPLATE_STANDARD: {
    templateId: 'TEMPLATE_STANDARD',
    pageType: 'multi-page',
    hasPageBreaks: true,
    estimatedPages: 2,
    supportsMultiPage: true,
  },
  TEMPLATE_NEUTRAL: {
    templateId: 'TEMPLATE_NEUTRAL',
    pageType: 'multi-page',
    hasPageBreaks: true,
    estimatedPages: 2,
    supportsMultiPage: true,
  },
  TEMPLATE_ELEGANT: {
    templateId: 'TEMPLATE_ELEGANT',
    pageType: 'multi-page',
    hasPageBreaks: true,
    estimatedPages: 2,
    supportsMultiPage: true,
  },
  TEMPLATE_TECHNICAL: {
    templateId: 'TEMPLATE_TECHNICAL',
    pageType: 'multi-page',
    hasPageBreaks: true,
    estimatedPages: 2,
    supportsMultiPage: true,
  },
  TEMPLATE_GEOMETRIC: {
    templateId: 'TEMPLATE_GEOMETRIC',
    pageType: 'multi-page',
    hasPageBreaks: true,
    estimatedPages: 2,
    supportsMultiPage: true,
  },
  TEMPLATE_DYNAMIC: {
    templateId: 'TEMPLATE_DYNAMIC',
    pageType: 'multi-page',
    hasPageBreaks: true,
    estimatedPages: 2,
    supportsMultiPage: true,
  },
};

/**
 * Erkennt den Seitentyp eines Templates
 */
export function getTemplatePageType(templateId: string): TemplatePageType {
  const definition = TEMPLATE_PAGE_DEFINITIONS[templateId];
  return definition?.pageType || 'single-page';
}

/**
 * Prüft ob ein Template mehrseitig ist
 */
export function isMultiPageTemplate(templateId: string): boolean {
  return getTemplatePageType(templateId) === 'multi-page';
}

/**
 * Prüft ob ein Template einseitig ist
 */
export function isSinglePageTemplate(templateId: string): boolean {
  return getTemplatePageType(templateId) === 'single-page';
}

/**
 * Holt Template-Informationen
 */
export function getTemplatePageInfo(templateId: string): TemplatePageInfo | null {
  return TEMPLATE_PAGE_DEFINITIONS[templateId] || null;
}

/**
 * Schätzt die Anzahl Seiten basierend auf Inhalt (mit 3-Item-Regel)
 */
export function estimateDocumentPages(templateId: string, itemsCount: number = 0): number {
  const info = getTemplatePageInfo(templateId);
  if (!info) return 1;

  // AUTOMATIK-REGEL: ≤ 3 Items = einseitig, > 3 Items = mehrseitig
  if (itemsCount <= 3) {
    return 1; // Einseitig
  }

  // Bei > 3 Items: Mehrseitig
  let pages = 2;

  // Zusätzliche Seiten für sehr viele Items
  if (itemsCount > 20) {
    const additionalPages = Math.ceil((itemsCount - 20) / 25);
    pages += additionalPages;
  }

  return pages;
}

/**
 * Dynamische Erkennung durch Template-Analyse (Fallback)
 * Analysiert das gerenderte Template zur Laufzeit
 */
export function analyzeTemplateStructure(templateElement: HTMLElement | null): TemplatePageInfo {
  if (!templateElement) {
    return {
      templateId: 'unknown',
      pageType: 'single-page',
      hasPageBreaks: false,
      estimatedPages: 1,
      supportsMultiPage: false,
    };
  }

  // Suche nach Seiten-Indikatoren
  const hasPageBreakElements =
    templateElement.querySelectorAll('.page-break, .force-page-break').length > 0;
  const hasPdfPageClass = templateElement.querySelectorAll('.pdf-page').length > 1;
  const hasSeite2Comments =
    templateElement.innerHTML.includes('SEITE 2') || templateElement.innerHTML.includes('Seite 2');
  const hasPageBreakStyles = templateElement.innerHTML.includes('page-break-after');

  const isMultiPage =
    hasPageBreakElements || hasPdfPageClass || hasSeite2Comments || hasPageBreakStyles;
  const pageCount = Math.max(1, templateElement.querySelectorAll('.pdf-page').length || 1);

  return {
    templateId: 'analyzed',
    pageType: isMultiPage ? 'multi-page' : 'single-page',
    hasPageBreaks: hasPageBreakElements || hasPageBreakStyles,
    estimatedPages: pageCount,
    supportsMultiPage: isMultiPage,
  };
}

/**
 * Holt alle verfügbaren Template-IDs
 */
export function getAllTemplateIds(): string[] {
  return Object.keys(TEMPLATE_PAGE_DEFINITIONS);
}

/**
 * Holt alle mehrseitigen Templates
 */
export function getMultiPageTemplates(): TemplatePageInfo[] {
  return Object.values(TEMPLATE_PAGE_DEFINITIONS).filter(t => t.pageType === 'multi-page');
}

/**
 * Holt alle einseitigen Templates
 */
export function getSinglePageTemplates(): TemplatePageInfo[] {
  return Object.values(TEMPLATE_PAGE_DEFINITIONS).filter(t => t.pageType === 'single-page');
}

/**
 * Validation Helper - Prüft Template-Kompatibilität
 */
export function validateTemplateForDocument(
  templateId: string,
  documentData: { items?: Array<Record<string, unknown>> },
): {
  isValid: boolean;
  warnings: string[];
  recommendations: string[];
} {
  const info = getTemplatePageInfo(templateId);
  const warnings: string[] = [];
  const recommendations: string[] = [];

  if (!info) {
    warnings.push(`Unbekanntes Template: ${templateId}`);
    return { isValid: false, warnings, recommendations };
  }

  const itemsCount = documentData.items?.length || 0;

  // Warnung bei vielen Items in einseitigem Template
  if (info.pageType === 'single-page' && itemsCount > 10) {
    warnings.push(
      'Viele Positionen in einseitigem Template - möglicherweise unvollständige Darstellung',
    );
    recommendations.push('Verwende ein mehrseitiges Template für bessere Darstellung');
  }

  // Empfehlung für wenige Items in mehrseitigem Template
  if (info.pageType === 'multi-page' && itemsCount <= 5) {
    recommendations.push('Bei wenigen Positionen könnte ein einseitiges Template ausreichen');
  }

  return {
    isValid: true,
    warnings,
    recommendations,
  };
}
