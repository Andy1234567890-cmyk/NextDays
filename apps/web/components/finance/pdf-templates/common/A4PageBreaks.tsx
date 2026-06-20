import type React from 'react';

export interface A4PageBreakProps {
  className?: string;
}

/**
 * A4PageBreak - Erzeugt einen echten Seitenumbruch für PDF-Templates
 * Verwende diese Komponente zwischen Abschnitten, die auf eine neue Seite sollen
 */
export const A4PageBreak: React.FC<A4PageBreakProps> = ({ className = '' }) => (
  <div
    className={`w-full ${className}`}
    style={{
      pageBreakBefore: 'always',
      breakBefore: 'page',
      height: '1px',
      backgroundColor: 'transparent',
    }}
  />
);

export interface A4SectionProps {
  children: React.ReactNode;
  className?: string;
  keepTogether?: boolean; // Verhindert Seitenumbrüche innerhalb dieses Abschnitts
  breakBefore?: boolean; // Erzwingt Seitenumbruch vor diesem Abschnitt
  breakAfter?: boolean; // Erzwingt Seitenumbruch nach diesem Abschnitt
}

/**
 * A4Section - Wrapper für Abschnitte mit Seitenumbruch-Kontrolle
 */
export const A4Section: React.FC<A4SectionProps> = ({
  children,
  className = '',
  keepTogether = false,
  breakBefore = false,
  breakAfter = false,
}) => (
  <div
    className={className}
    style={{
      pageBreakBefore: breakBefore ? 'always' : 'auto',
      pageBreakAfter: breakAfter ? 'always' : 'auto',
      pageBreakInside: keepTogether ? 'avoid' : 'auto',
      breakBefore: breakBefore ? 'page' : 'auto',
      breakAfter: breakAfter ? 'page' : 'auto',
      breakInside: keepTogether ? 'avoid' : 'auto',
    }}
  >
    {children}
  </div>
);

export interface A4PageWrapperProps {
  children: React.ReactNode;
  className?: string;
  maxHeight?: string;
}

/**
 * A4PageWrapper - Begrenzt Inhalt auf A4-Seitenhöhe
 */
export const A4PageWrapper: React.FC<A4PageWrapperProps> = ({
  children,
  className = '',
  maxHeight = '297mm', // A4 Höhe
}) => (
  <div
    className={`mx-auto w-full max-w-[210mm] bg-white ${className}`}
    style={{
      minHeight: maxHeight,
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      lineHeight: '1.4',
    }}
  >
    {children}
  </div>
);
