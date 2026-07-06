'use client';

import { Icon } from '@iconify/react';
import { Badge, Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input } from '@tasko/ui';
import { useEffect, useState } from 'react';

import { formatCurrency } from '@/lib/currency';
import { type BookingAccount, BookingAccountService } from '@/services/bookingAccountService';
import type { ModalTransaction } from '@/types/banking';

interface BookingAccountSelectionModalProps {
  isOpen: boolean;
  companyId: string;
  transaction: ModalTransaction | null;
  documentType: 'INVOICE' | 'EXPENSE';
  documentNumber?: string;
  onClose: () => void;
  onSelect: (transaction: ModalTransaction, bookingAccount: BookingAccount) => void;
}

export default function BookingAccountSelectionModal({
  isOpen,
  companyId,
  transaction,
  documentType,
  documentNumber,
  onClose,
  onSelect,
}: BookingAccountSelectionModalProps) {
  const [bookingAccounts, setBookingAccounts] = useState<BookingAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<BookingAccount | null>(null);

  // Load booking accounts
  useEffect(() => {
    if (isOpen && companyId) {
      loadBookingAccounts();
    }
  }, [isOpen, companyId]); // load-Funktion nicht memoized → aus Deps genommen (Loop-Schutz)

  async function loadBookingAccounts() {
    try {
      setLoading(true);
      const accounts = await BookingAccountService.getBookingAccounts(companyId);
      setBookingAccounts(accounts);
    } catch (error) {
      console.error('Fehler beim Laden der Buchungskonten:', error);
    } finally {
      setLoading(false);
    }
  }

  // Filter accounts based on document type
  const getSuggestedAccounts = () => {
    if (documentType === 'INVOICE') {
      // SKR03 Erlös-Konten: 4000-4999 (INCOME) - KORRIGIERT!
      return bookingAccounts.filter(acc => acc.type === 'INCOME' && acc.number.startsWith('4'));
    } else {
      // SKR03 Aufwand-Konten: 5000-7999 (EXPENSE) - KORRIGIERT!
      return bookingAccounts.filter(
        acc => acc.type === 'EXPENSE' && ['5', '6', '7'].includes(acc.number[0]),
      );
    }
  };

  const filteredAccounts = getSuggestedAccounts().filter(account => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    return (
      account.number.toLowerCase().includes(searchLower) ||
      account.name.toLowerCase().includes(searchLower)
    );
  });

  const handleSelectAccount = () => {
    if (selectedAccount && transaction) {
      onSelect(transaction, selectedAccount);
    }
  };

  if (!transaction) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon icon="lucide:book-open" className="h-5 w-5 text-accent" />
            Buchungskonto auswählen
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col space-y-4 overflow-hidden">
          {/* Transaction Summary */}
          <div className="rounded-lg border bg-gray-50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-medium text-gray-900">Transaktion</h3>
              {documentType === 'INVOICE' ? (
                <Icon icon="lucide:trending-up" className="h-5 w-5 text-green-600" />
              ) : (
                <Icon icon="lucide:trending-down" className="h-5 w-5 text-red-600" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Name:</span>
                <span className="ml-2 font-medium">{transaction.name}</span>
              </div>
              <div>
                <span className="text-gray-600">Betrag:</span>
                <span
                  className={`ml-2 font-medium ${transaction.betrag > 0 ? 'text-green-600' : 'text-red-600'}`}
                >
                  {formatCurrency(transaction.betrag, transaction.currency)}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-600">Verwendungszweck:</span>
                <span className="ml-2">{transaction.verwendungszweck}</span>
              </div>
              {documentNumber && (
                <div className="col-span-2">
                  <span className="text-gray-600">Dokument:</span>
                  <Badge variant="outline" className="ml-2">
                    {documentNumber}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Icon icon="lucide:search" className="absolute top-3 left-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buchungskonto suchen (Nummer oder Name)..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Account Type Info */}
          <div className="flex items-center gap-2">
            <Badge
              variant={documentType === 'INVOICE' ? 'default' : 'destructive'}
              className={
                documentType === 'INVOICE'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }
            >
              {documentType === 'INVOICE'
                ? '💰 Erlös-Konten (4000-4999)'
                : '💸 Aufwand-Konten (5000-7999)'}
            </Badge>
            <Badge variant="outline">{filteredAccounts.length} verfügbare Konten</Badge>
          </div>

          {/* Accounts List */}
          <div className="flex-1 overflow-auto rounded-lg border">
            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-accent border-b-2"></div>
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-gray-500">
                Keine passenden Buchungskonten gefunden
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredAccounts.map(account => (
                  <div
                    key={account.id}
                    className={`cursor-pointer p-4 hover:bg-gray-50 ${
                      selectedAccount?.id === account.id
                        ? 'border-l-4 border-l-accent bg-accent/10'
                        : ''
                    }`}
                    onClick={() => setSelectedAccount(account)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Icon icon="lucide:calculator" className="h-4 w-4 text-gray-400" />
                            <span className="font-bold font-mono text-gray-900 text-lg">
                              {account.number}
                            </span>
                          </div>
                          <Badge
                            variant={account.type === 'INCOME' ? 'default' : 'secondary'}
                            className={
                              account.type === 'INCOME'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }
                          >
                            {account.type === 'INCOME' ? 'Erlös' : 'Aufwand'}
                          </Badge>
                        </div>
                        <div className="mt-1">
                          <span className="font-medium text-gray-900 text-sm">{account.name}</span>
                        </div>
                        {account.automaticBooking && (
                          <Badge variant="outline" className="mt-2 text-xs">
                            Automatische Buchung
                          </Badge>
                        )}
                      </div>
                      {selectedAccount?.id === account.id && (
                        <div className="ml-4">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent">
                            <div className="h-2 w-2 rounded-full bg-white"></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between border-t pt-4">
            <div className="text-gray-500 text-sm">
              {selectedAccount ? (
                <>
                  Gewählt:{' '}
                  <span className="font-medium">
                    {selectedAccount.number} - {selectedAccount.name}
                  </span>
                </>
              ) : (
                'Wählen Sie ein Buchungskonto aus'
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Abbrechen
              </Button>
              <Button
                onClick={handleSelectAccount}
                disabled={!selectedAccount}
                className="bg-accent text-white hover:bg-accent/90"
              >
                Verknüpfen
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
