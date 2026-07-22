import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import type React from 'react';
import { useRef, useState } from 'react';
import { NativeSelect } from '@/components/ui/native-select';
import { useSimplePagination } from '@/hooks/pdf/useSimplePagination';

interface SimplePDFViewerProps {
  children: React.ReactNode;
  zoomLevel: number;
  a4Width: number;
  a4Height: number;
  onZoomChange: (zoomLevel: number) => void;
  onPageModeChange?: (mode: 'single' | 'multi') => void;
  pageMode?: 'single' | 'multi';
}

export const SimplePDFViewer: React.FC<SimplePDFViewerProps> = ({
  children,
  zoomLevel,
  a4Width,
  a4Height,
  onZoomChange,
  onPageModeChange,
  pageMode = 'multi',
}) => {
  const t = useTranslations('finance');
  const contentRef = useRef<HTMLDivElement>(null);
  const { totalPages, contentHeight: _contentHeight } = useSimplePagination(contentRef, a4Height);
  const [currentPage, setCurrentPage] = useState(1);

  const handlePageModeChange = (mode: 'single' | 'multi') => {
    if (onPageModeChange) {
      onPageModeChange(mode);
    }
  };

  const zoomOptions = [
    { value: 2, label: '200%' },
    { value: 1.75, label: '175%' },
    { value: 1.5, label: '150%' },
    { value: 1.25, label: '125%' },
    { value: 1, label: '100%' },
    { value: 0.75, label: '75%' },
    { value: 0.5, label: '50%' },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* PDF Toolbar - genau wie im Bild */}
      <div className="flex items-center justify-between border-b bg-white px-4 py-2">
        {/* Page Mode Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => handlePageModeChange('single')}
            className={`rounded p-2 ${pageMode === 'single' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
            title={t('SimplePDFViewer.singlePageTitle')}
          >
            <Icon icon="lucide:file-text" width={20} height={20} />
          </button>
          <button
            onClick={() => handlePageModeChange('multi')}
            className={`rounded p-2 ${pageMode === 'multi' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
            title={t('SimplePDFViewer.multiPageTitle')}
          >
            <Icon icon="lucide:scroll-text" width={20} height={20} />
          </button>
        </div>

        {/* Page Navigation */}
        <div className="flex items-center gap-2 text-sm">
          <span>{t('SimplePDFViewer.page')}</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={currentPage}
            onChange={e =>
              setCurrentPage(Math.max(1, Math.min(totalPages, parseInt(e.target.value, 10) || 1)))
            }
            className="w-12 rounded border border-gray-300 px-2 py-1 text-center focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <span>{t('SimplePDFViewer.of')}</span>
          <span>{totalPages}</span>

          <div className="ml-2 flex">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="rounded-l border border-gray-300 p-1 hover:bg-gray-50 disabled:opacity-50"
              title={t('SimplePDFViewer.previousPage')}
            >
              <Icon icon="lucide:chevron-up" width={16} height={16} />
            </button>
            <div className="w-px bg-gray-300"></div>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="rounded-r border border-gray-300 p-1 hover:bg-gray-50 disabled:opacity-50"
              title={t('SimplePDFViewer.nextPage')}
            >
              <Icon icon="lucide:chevron-down" width={16} height={16} />
            </button>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              const currentIndex = zoomOptions.findIndex(option => option.value === zoomLevel);
              const nextIndex = Math.max(0, currentIndex - 1);
              onZoomChange(zoomOptions[nextIndex].value);
            }}
            disabled={zoomLevel >= Math.max(...zoomOptions.map(o => o.value))}
            className="rounded p-2 hover:bg-gray-100 disabled:opacity-50"
            title={t('SimplePDFViewer.zoomIn')}
          >
            <Icon icon="lucide:zoom-in" width={16} height={16} />
          </button>
          <div className="h-6 w-px bg-gray-300"></div>
          <button
            onClick={() => {
              const currentIndex = zoomOptions.findIndex(option => option.value === zoomLevel);
              const nextIndex = Math.min(zoomOptions.length - 1, currentIndex + 1);
              onZoomChange(zoomOptions[nextIndex].value);
            }}
            disabled={zoomLevel <= Math.min(...zoomOptions.map(o => o.value))}
            className="rounded p-2 hover:bg-gray-100 disabled:opacity-50"
            title={t('SimplePDFViewer.zoomOut')}
          >
            <Icon icon="lucide:zoom-out" width={16} height={16} />
          </button>
          <NativeSelect
            value={zoomLevel}
            onChange={e => {
              onZoomChange(parseFloat(e.target.value));
            }}
            className="h-auto py-1"
          >
            {zoomOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {/* Scrollbarer Inhalt */}
      <div className="flex-1 overflow-auto bg-gray-100 p-4">
        {/* Versteckter Messbereich */}
        <div
          ref={contentRef}
          style={{
            position: 'absolute',
            left: '-9999px',
            top: '-9999px',
            width: `${a4Width}px`,
            visibility: 'hidden',
          }}
        >
          {children}
        </div>

        {/* Sichtbare A4-Seiten */}
        {Array.from({ length: totalPages }).map((_, pageIndex) => (
          <div
            key={pageIndex}
            className="relative mx-auto mb-4 border bg-white shadow-lg"
            style={{
              width: `${a4Width * zoomLevel}px`,
              height: `${a4Height * zoomLevel}px`,
              overflow: 'hidden',
            }}
          >
            {/* Seitennummer */}
            <div className="absolute top-2 right-2 rounded bg-black/75 px-2 py-1 text-white text-xs">
              {t('SimplePDFViewer.pageNumber', { number: pageIndex + 1 })}
            </div>

            {/* Inhalt für diese Seite */}
            <div
              style={{
                transform: `scale(${zoomLevel}) translateY(${-pageIndex * a4Height}px)`,
                transformOrigin: 'top left',
                width: `${a4Width}px`,
              }}
            >
              {children}
            </div>
          </div>
        ))}

        {/* Seitenzusammenfassung */}
        {totalPages > 1 && (
          <div className="mt-4 rounded bg-blue-50 p-2 text-center text-gray-600 text-sm">
            📄 {t('SimplePDFViewer.pageSummary', { count: totalPages })}
            {pageMode === 'single'
              ? ` - ${t('SimplePDFViewer.singlePageModeSuffix')}`
              : ` - ${t('SimplePDFViewer.multiPageModeSuffix')}`}
          </div>
        )}
      </div>
    </div>
  );
};
