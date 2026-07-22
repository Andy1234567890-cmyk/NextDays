/**
 * PDF Page Break CSS Styles
 * Füge diese Styles zu PDF-Templates hinzu für bessere Seitenumbrüche
 */

// Inline Styles für PDF-Template Elemente
export const PDF_PAGE_STYLES = {
  // Verhindert Seitenumbrüche innerhalb von Elementen
  keepTogether: {
    pageBreakInside: 'avoid',
    breakInside: 'avoid',
  },

  // Erzwingt Seitenumbruch vor Element
  breakBefore: {
    pageBreakBefore: 'always',
    breakBefore: 'page',
  },

  // Erzwingt Seitenumbruch nach Element
  breakAfter: {
    pageBreakAfter: 'always',
    breakAfter: 'page',
  },

  // Verhindert Seitenumbruch vor Element
  avoidBreakBefore: {
    pageBreakBefore: 'avoid',
    breakBefore: 'avoid',
  },

  // Verhindert Seitenumbruch nach Element
  avoidBreakAfter: {
    pageBreakAfter: 'avoid',
    breakAfter: 'avoid',
  },

  // Container für Items-Tabelle
  itemsTable: {
    pageBreakInside: 'auto',
    breakInside: 'auto',
  },

  // Tabellen-Header - soll mit ersten Zeilen zusammenbleiben
  tableHeader: {
    pageBreakInside: 'avoid',
    breakInside: 'avoid',
    pageBreakAfter: 'avoid',
    breakAfter: 'avoid',
  },

  // Einzelne Tabellenzeilen
  tableRow: {
    pageBreakInside: 'avoid',
    breakInside: 'avoid',
  },

  // Tabellen-Gruppe (Header + mindestens 2-3 Zeilen zusammen)
  tableGroup: {
    pageBreakInside: 'avoid',
    breakInside: 'avoid',
  },

  // Footer auf jeder Seite - einfacher Ansatz
  pageFooter: {
    pageBreakInside: 'avoid',
    breakInside: 'avoid',
  },

  // Seiteninhalt mit Platz für Footer
  pageContent: {
    paddingBottom: '100px', // Platz für Footer
  },

  // Header-Bereich (Logo, Adressen)
  headerSection: {
    pageBreakInside: 'avoid',
    breakInside: 'avoid',
    pageBreakAfter: 'avoid',
    breakAfter: 'avoid',
  },

  // Footer-Bereich
  footerSection: {
    pageBreakInside: 'avoid',
    breakInside: 'avoid',
    pageBreakBefore: 'avoid',
    breakBefore: 'avoid',
  },

  // Totals-Bereich
  totalsSection: {
    pageBreakInside: 'avoid',
    breakInside: 'avoid',
  },
} as const;

// CSS Klassen für Tailwind-kompatible Verwendung
export const PDF_PAGE_CLASSES = `
  .pdf-keep-together {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .pdf-break-before {
    page-break-before: always;
    break-before: page;
  }

  .pdf-break-after {
    page-break-after: always;
    break-after: page;
  }

  .pdf-avoid-break-before {
    page-break-before: avoid;
    break-before: avoid;
  }

  .pdf-avoid-break-after {
    page-break-after: avoid;
    break-after: avoid;
  }

  .pdf-header-section {
    page-break-inside: avoid;
    break-inside: avoid;
    page-break-after: avoid;
    break-after: avoid;
  }

  .pdf-footer-section {
    page-break-inside: avoid;
    break-inside: avoid;
    page-break-before: avoid;
    break-before: avoid;
  }

  .pdf-table-row {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .pdf-totals-section {
    page-break-inside: avoid;
    break-inside: avoid;
  }
`;

export default PDF_PAGE_STYLES;
