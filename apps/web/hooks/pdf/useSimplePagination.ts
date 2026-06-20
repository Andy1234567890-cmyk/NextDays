import { useEffect, useState } from 'react';

export interface SimplePageInfo {
  pageNumber: number;
  startY: number;
  endY: number;
}

export const useSimplePagination = (
  contentRef: React.RefObject<HTMLElement | null>,
  pageHeight: number = 1123,
) => {
  const [totalPages, setTotalPages] = useState(1);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (!contentRef.current) return;

    const element = contentRef.current;

    // Einfach: Messe die Höhe und teile durch Seitenhöhe
    const observer = new ResizeObserver(() => {
      const height = element.scrollHeight;
      setContentHeight(height);
      setTotalPages(Math.max(1, Math.ceil(height / pageHeight)));
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, [contentRef, pageHeight]);

  return { totalPages, contentHeight };
};
