'use client';

import { Icon } from '@iconify/react';
import { Button } from '@tasko/ui';
import type React from 'react';
import type { InvoiceData } from '@/types/invoiceTypes';
import type { InvoiceApiResponse } from '@/types/types';

interface CancelInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  invoice: InvoiceData | InvoiceApiResponse | null;
  isLoading?: boolean;
}

export const CancelInvoiceModal: React.FC<CancelInvoiceModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  invoice: _invoice,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white shadow-xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-gray-200 border-b p-4">
          <div className="flex-1">
            <h2 className="font-semibold text-gray-900 text-lg">Rechnung stornieren</h2>
          </div>
          <button
            onClick={onClose}
            className="ml-4 text-gray-400 transition-colors hover:text-gray-600"
            disabled={isLoading}
          >
            <Icon icon="lucide:x" className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          <p className="text-gray-700 text-sm">
            Durch diesen Vorgang wird direkt eine Stornorechnung erstellt. Die Bearbeitung der
            stornierten Ausgangsrechnung ist dann nicht mehr möglich.
          </p>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end space-x-3 border-gray-200 border-t p-4">
          <Button variant="outline" onClick={onClose} disabled={isLoading} className="px-4 py-2">
            Abbrechen
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-accent px-4 py-2 text-white hover:bg-accent/90"
          >
            {isLoading ? 'Storniere...' : 'Rechnung stornieren'}
          </Button>
        </div>
      </div>
    </div>
  );
};
