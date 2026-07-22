// A4 page utilities for PDF generation and preview
export interface A4Dimensions {
  width: number;
  height: number;
  unit: 'px' | 'mm' | 'in';
}

// Standard A4 dimensions at different DPI settings
export const A4_DIMENSIONS = {
  // At 96 DPI (standard web)
  WEB: { width: 794, height: 1123, unit: 'px' as const },

  // At 72 DPI (PDF standard)
  PDF: { width: 595, height: 842, unit: 'px' as const },

  // At 300 DPI (print quality)
  PRINT: { width: 2480, height: 3508, unit: 'px' as const },

  // Physical dimensions
  MM: { width: 210, height: 297, unit: 'mm' as const },
  IN: { width: 8.27, height: 11.69, unit: 'in' as const },
};

/**
 * Convert dimensions between different units and DPI settings
 */
export const convertA4Dimensions = (
  from: A4Dimensions,
  toDPI: number = 96,
  toUnit: 'px' | 'mm' | 'in' = 'px',
): A4Dimensions => {
  let widthMM: number, heightMM: number;

  // Convert source to mm first
  switch (from.unit) {
    case 'mm':
      widthMM = from.width;
      heightMM = from.height;
      break;
    case 'in':
      widthMM = from.width * 25.4;
      heightMM = from.height * 25.4;
      break;
    case 'px':
      // Assume 96 DPI for pixel input
      widthMM = (from.width / 96) * 25.4;
      heightMM = (from.height / 96) * 25.4;
      break;
  }

  // Convert mm to target unit
  switch (toUnit) {
    case 'mm':
      return { width: widthMM, height: heightMM, unit: 'mm' };
    case 'in':
      return {
        width: widthMM / 25.4,
        height: heightMM / 25.4,
        unit: 'in',
      };
    case 'px':
      return {
        width: Math.round((widthMM / 25.4) * toDPI),
        height: Math.round((heightMM / 25.4) * toDPI),
        unit: 'px',
      };
  }
};

/**
 * Calculate how many pages are needed for given content height
 */
export const calculatePageCount = (
  contentHeight: number,
  pageHeight: number = A4_DIMENSIONS.WEB.height,
  marginTop: number = 0,
  marginBottom: number = 0,
): number => {
  const usableHeight = pageHeight - marginTop - marginBottom;
  return Math.max(1, Math.ceil(contentHeight / usableHeight));
};

/**
 * Calculate page breaks for content
 */
export const calculatePageBreaks = (
  contentHeight: number,
  pageHeight: number = A4_DIMENSIONS.WEB.height,
  marginTop: number = 0,
  marginBottom: number = 0,
): number[] => {
  const usableHeight = pageHeight - marginTop - marginBottom;
  const pageCount = calculatePageCount(contentHeight, pageHeight, marginTop, marginBottom);

  const breaks: number[] = [];
  for (let i = 1; i < pageCount; i++) {
    breaks.push(i * usableHeight + marginTop);
  }

  return breaks;
};

/**
 * Get optimal zoom level to fit A4 page in container
 */
export const calculateOptimalZoom = (
  containerWidth: number,
  containerHeight: number,
  a4Dimensions: A4Dimensions = A4_DIMENSIONS.WEB,
  maxZoom: number = 2,
  minZoom: number = 0.1,
): number => {
  const widthZoom = containerWidth / a4Dimensions.width;
  const heightZoom = containerHeight / a4Dimensions.height;

  // Use the smaller zoom to ensure content fits
  const optimalZoom = Math.min(widthZoom, heightZoom);

  // Clamp to min/max bounds
  return Math.max(minZoom, Math.min(maxZoom, optimalZoom));
};

/**
 * Check if content fits on single A4 page
 */
export const fitsOnSinglePage = (
  contentHeight: number,
  pageHeight: number = A4_DIMENSIONS.WEB.height,
  marginTop: number = 0,
  marginBottom: number = 0,
): boolean => {
  return contentHeight <= pageHeight - marginTop - marginBottom;
};

/**
 * Get page number for given scroll position
 */
export const getPageForPosition = (
  scrollTop: number,
  pageHeight: number = A4_DIMENSIONS.WEB.height,
  zoomLevel: number = 1,
): number => {
  const adjustedPageHeight = pageHeight * zoomLevel;
  return Math.max(1, Math.floor(scrollTop / adjustedPageHeight) + 1);
};

/**
 * Get scroll position for page number
 */
export const getPositionForPage = (
  pageNumber: number,
  pageHeight: number = A4_DIMENSIONS.WEB.height,
  zoomLevel: number = 1,
): number => {
  const adjustedPageHeight = pageHeight * zoomLevel;
  return Math.max(0, (pageNumber - 1) * adjustedPageHeight);
};

/**
 * CSS styles for A4 page simulation
 */
export const getA4PageStyles = (
  dimensions: A4Dimensions = A4_DIMENSIONS.WEB,
  zoomLevel: number = 1,
) => ({
  width: `${dimensions.width * zoomLevel}px`,
  minHeight: `${dimensions.height * zoomLevel}px`,
  maxWidth: `${dimensions.width * zoomLevel}px`,
  aspectRatio: `${dimensions.width} / ${dimensions.height}`,
  // Standard A4 page margins (approximate)
  padding: `${40 * zoomLevel}px ${30 * zoomLevel}px`,
  boxSizing: 'border-box' as const,
  backgroundColor: 'white',
  boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
  margin: '0 auto',
});

/**
 * Print-specific CSS for A4 pages
 */
export const A4_PRINT_STYLES = `
  @page {
    size: A4;
    margin: 20mm;
  }

  @media print {
    body {
      margin: 0;
      padding: 0;
    }

    .page-break {
      page-break-before: always;
    }

    .no-print {
      display: none !important;
    }
  }
`;

export default {
  A4_DIMENSIONS,
  convertA4Dimensions,
  calculatePageCount,
  calculatePageBreaks,
  calculateOptimalZoom,
  fitsOnSinglePage,
  getPageForPosition,
  getPositionForPage,
  getA4PageStyles,
  A4_PRINT_STYLES,
};
