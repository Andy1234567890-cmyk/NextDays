'use client';

import { Icon } from '@iconify/react';
import { Badge, Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input } from '@tasko/ui';
import { useEffect, useState } from 'react';

import { useNewAuth } from '@/contexts/NewAuthContext';
import { getFinAPICredentialType } from '@/lib/finapi-config';
import type { BookingAccount } from '@/services/bookingAccountService';
import { type TransactionLink, TransactionLinkService } from '@/services/transaction-link.service';
import type { ModalTransaction } from '@/types/banking';
import BookingAccountSelectionModal from './BookingAccountSelectionModal';

// EXACT same interface as Banking Accounts Page - ERWEITERT
interface FinAPITransaction {
  id: string;
  accountId: number;
  parentId?: number;
  amount: number;
  currency: string;
  purpose: string;
  counterpartName?: string;
  counterpartIban?: string;
  counterpartBic?: string;
  counterpartBlz?: string;
  counterpartBankName?: string;
  counterpartAccountNumber?: string;
  bookingDate: string;
  valueDate: string;
  type: string;
  typeId: number;
  typeCodeZka?: string;
  typeCodeSwift?: string;
  sepaPurposeCode?: string;
  primanota?: string;
  category?: any;
  isPotentialDuplicate: boolean;
  isNew: boolean;
  isAdjustingEntry?: boolean;
  labels?: any[];
  mcCode?: string;
  importDate?: string;
}

// UI Transaction interface - EXACT same as Banking Accounts Page - ERWEITERT
// Transaction ist ein Alias für ModalTransaction (keine leere Interface-Declaration)
type Transaction = ModalTransaction;

interface SelectBankingTransactionModalProps {
  isOpen: boolean;
  companyId: string;
  invoiceAmount: number;
  // Währung der Rechnung — verhindert Cross-Currency-Matches (CHF-Transaktion darf
  // keine EUR-Rechnung als „exakter Treffer" verknüpfen). Optional für Aufrufer,
  // die (noch) keine Währung liefern; dann greift nur der numerische Vergleich.
  invoiceCurrency?: string;
  documentType: 'INVOICE' | 'EXPENSE';
  documentNumber?: string;
  transactionType?: 'CREDIT' | 'DEBIT' | 'ALL';
  onClose: () => void;
  onSelect: (transaction: Transaction, bookingAccount?: BookingAccount) => void;
}

export default function SelectBankingTransactionModal({
  isOpen,
  companyId,
  invoiceAmount,
  invoiceCurrency,
  documentType,
  documentNumber,
  transactionType = 'CREDIT',
  onClose,
  onSelect,
}: SelectBankingTransactionModalProps) {
  const { user } = useNewAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [transactionLinks, setTransactionLinks] = useState<TransactionLink[]>([]);

  // Booking Account Selection Modal State
  const [bookingAccountModal, setBookingAccountModal] = useState<{
    isOpen: boolean;
    transaction: ModalTransaction | null;
  }>({
    isOpen: false,
    transaction: null,
  });

  // Warning Modal State
  const [warningModal, setWarningModal] = useState<{
    isOpen: boolean;
    transaction: Transaction | null;
    difference: number;
    tolerance: number;
  }>({
    isOpen: false,
    transaction: null,
    difference: 0,
    tolerance: 0,
  });

  // Get environment-specific credential type
  const credentialType = getFinAPICredentialType();

  // Convert FinAPI transaction to UI transaction format - EXACT COPY from Banking Accounts Page
  const convertFinAPITransaction = (
    finapiTx: FinAPITransaction,
    accountName: string,
  ): Transaction => {
    // Konvertiere FinAPI-Datum zu korrektem Format
    const convertFinAPIDate = (dateString: string): string => {
      if (!dateString) return new Date().toISOString().split('T')[0];

      try {
        // FinAPI liefert Daten meist im Format YYYY-MM-DD oder als ISO String
        let date: Date;

        if (dateString.includes('T')) {
          // ISO String Format
          date = new Date(dateString);
        } else if (dateString.includes('-')) {
          // YYYY-MM-DD Format
          date = new Date(dateString);
        } else {
          // Fallback: Versuche direkten Parse
          date = new Date(dateString);
        }

        // Validiere das Datum
        if (Number.isNaN(date.getTime())) {
          console.warn(`Invalid date from FinAPI: ${dateString}, using current date`);
          return new Date().toISOString().split('T')[0];
        }

        // Konvertiere zu YYYY-MM-DD Format für HTML date inputs
        return date.toISOString().split('T')[0];
      } catch (error) {
        console.error(`Error parsing FinAPI date: ${dateString}`, error);
        return new Date().toISOString().split('T')[0];
      }
    };

    // Intelligente Status-Bestimmung
    const getTransactionStatus = (tx: FinAPITransaction): Transaction['status'] => {
      if (tx.isPotentialDuplicate) return 'duplicate';
      if (tx.isAdjustingEntry) return 'adjustment';
      if (tx.isNew) return 'pending';
      return 'processed';
    };

    // Transaktionsart aus Codes bestimmen
    const getTransactionType = (tx: FinAPITransaction): string => {
      if (tx.typeCodeZka) return `ZKA: ${tx.typeCodeZka}`;
      if (tx.typeCodeSwift) return `SWIFT: ${tx.typeCodeSwift}`;
      if (tx.sepaPurposeCode) return `SEPA: ${tx.sepaPurposeCode}`;
      return 'Standard';
    };

    return {
      id: finapiTx.id ? String(finapiTx.id) : `tx-${Date.now()}-${Math.random()}`,
      status: getTransactionStatus(finapiTx),
      name: finapiTx.counterpartName || 'Unbekannt',
      verwendungszweck: finapiTx.purpose || 'Keine Beschreibung',
      buchungstag: convertFinAPIDate(finapiTx.bookingDate),
      betrag: finapiTx.amount,
      // Währung aus der Bank-Transaktion mitführen (nie €-Hardcode); ohne Angabe
      // leer → formatCurrency zeigt die reine Zahl (kein falsches Symbol).
      currency: finapiTx.currency || '',
      offen: true, // Wird später basierend auf TransactionLinks aktualisiert
      verknuepfungen: [], // Would be populated from your internal system
      accountId: finapiTx.accountId.toString(),
      accountName: accountName,
      category: finapiTx.category?.name,

      // ERWEITERTE DATEN
      empfaengerBank: finapiTx.counterpartBankName,
      empfaengerBic: finapiTx.counterpartBic,
      empfaengerIban: finapiTx.counterpartIban,
      transaktionsart: getTransactionType(finapiTx),
      sepaPurpose: finapiTx.sepaPurposeCode,
      merchantCategory: finapiTx.mcCode,
      primanota: finapiTx.primanota,
      labels: finapiTx.labels?.map(label => label.name) || [],
      isDuplicate: finapiTx.isPotentialDuplicate,
      isAdjustment: finapiTx.isAdjustingEntry,
      importDate: finapiTx.importDate,
    };
  };

  const loadTransactions = async () => {
    if (!user?.uid) return;

    setLoading(true);
    setError(null);

    try {

      // STEP 1: Load accounts first - EXAKT wie Banking Seite
      const accountsResponse = await fetch(
        `/api/finapi/accounts-enhanced?userId=${user.uid}&credentialType=${credentialType}&forceRefresh=false`,
      );

      let accounts: any[] = [];
      if (accountsResponse.ok) {
        const accountsData = await accountsResponse.json();
        if (accountsData.success && accountsData.accounts) {
          accounts = accountsData.accounts;
        }
      }

      // STEP 2: Load transactions - EXAKTE Parameter wie Banking Seite
      const params = new URLSearchParams({
        userId: user.uid,
        credentialType,
        page: '1',
        perPage: '500',
      });

      const transactionUrl = `/api/finapi/transactions?${params}`;

      const response = await fetch(transactionUrl);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Modal: Transaction API error:', errorData);
        throw new Error(`FinAPI Transactions Error: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();

      if (data.success && data.data?.transactions) {
        const rawTransactions = data.data.transactions;

        // EXAKTE Konvertierungslogik wie Banking Seite
        const convertedTransactions: Transaction[] = rawTransactions.map(
          (finapiTx: FinAPITransaction) => {
            // Account matching - EXAKT wie Banking Seite
            let account = accounts.find(acc => acc.id === finapiTx.accountId.toString());

            if (!account) {
              account = accounts.find(
                acc =>
                  acc.accountNumber === finapiTx.accountId.toString() ||
                  (acc.id &&
                    typeof acc.id === 'string' &&
                    acc.id.includes(finapiTx.accountId.toString())) ||
                  (acc.id &&
                    typeof acc.id === 'string' &&
                    finapiTx.accountId.toString().includes(acc.id)),
              );
            }

            const accountName = account?.accountName || account?.bankName || 'Unbekanntes Konto';
            const accountId = account?.id || finapiTx.accountId.toString();

            const convertedTx = convertFinAPITransaction(finapiTx, accountName);
            return {
              ...convertedTx,
              accountId: accountId,
            };
          },
        );


        // Sort by booking date (newest first) - SAME as Banking Accounts Page
        const sortedTransactions = convertedTransactions.sort((a, b) => {
          const dateA = new Date(a.buchungstag).getTime();
          const dateB = new Date(b.buchungstag).getTime();
          return dateB - dateA; // Newest first
        });

        // STRIKTE FILTERUNG basierend auf Document Type - KEINE GEMISCHTEN VERKNÜPFUNGEN
        let filteredTransactions = sortedTransactions;

        if (documentType === 'INVOICE') {
          // NUR positive Transaktionen (Eingänge) für Einnahmen-Rechnungen
          filteredTransactions = sortedTransactions.filter((t: Transaction) => t.betrag > 0);
        } else if (documentType === 'EXPENSE') {
          // NUR negative Transaktionen (Ausgänge) für Ausgaben-Belege
          filteredTransactions = sortedTransactions.filter((t: Transaction) => t.betrag < 0);
        } else {
          // Fallback: verwende transactionType wenn documentType unbekannt
          if (transactionType !== 'ALL') {
            filteredTransactions = sortedTransactions.filter((t: Transaction) => {
              if (transactionType === 'CREDIT') {
                return t.betrag > 0;
              } else if (transactionType === 'DEBIT') {
                return t.betrag < 0;
              }
              return true;
            });
          }
        }

        setTransactions(filteredTransactions);

        // Update transaction status nach dem Laden der Links
        setTimeout(() => {
          updateTransactionStatus(filteredTransactions);
        }, 100);
      } else {
        setTransactions([]);
        if (data.message && !data.message.includes('please connect a bank first')) {
          setError(data.message);
        }
      }
    } catch (err: any) {
      console.error('Modal: Error loading transactions:', err);
      setError(err.message || 'Fehler beim Laden der Transaktionen');
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  // Load transaction links - EXACT same as Banking Accounts Page
  const loadTransactionLinks = async () => {
    if (!user?.uid) return;

    try {
      const result = await TransactionLinkService.getLinks(companyId);
      if (result.success && result.links) {
        setTransactionLinks(result.links);

        // Update transaction status after loading links
        updateTransactionStatus(transactions);
      } else {
        setTransactionLinks([]);
      }
    } catch (error) {
      console.error('Modal: Error loading transaction links:', error);
      setTransactionLinks([]);
    }
  };

  // Update transaction status based on links
  const updateTransactionStatus = (transactionList: Transaction[]) => {
    if (!transactionLinks.length) return;

    const updatedTransactions = transactionList.map(transaction => {
      const isLinked = transactionLinks.some(link => link.transactionId === transaction.id);
      return {
        ...transaction,
        offen: !isLinked, // offen = true wenn NICHT verknüpft
        status: isLinked ? ('linked' as const) : ('processed' as const),
      };
    });

    setTransactions(updatedTransactions);
  };

  useEffect(() => {
    if (isOpen) {
      loadTransactions();
      // Load transaction links nach dem Laden der Transaktionen
      setTimeout(() => {
        loadTransactionLinks();
      }, 500);
    }
  }, [isOpen]); // load-Funktionen nicht memoized → aus Deps genommen (Loop-Schutz)

  const formatCurrency = (amount: number, currency?: string) => {
    // Kein €-Hardcode: ungültiger/fehlender ISO-Code → reine Zahl (kein falsches
    // Symbol, kein Intl-Crash), analog lib/currency.ts.
    const code = typeof currency === 'string' ? currency.trim().toUpperCase() : '';
    const valid = /^[A-Z]{3}$/.test(code);
    return new Intl.NumberFormat('de-DE', {
      ...(valid ? { style: 'currency' as const, currency: code } : {}),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString || dateString === 'null' || dateString === 'undefined') {
      return 'Kein Datum';
    }

    let date: Date;

    // Handle different date formats from finAPI
    if (dateString.includes('-')) {
      date = new Date(dateString);
    } else if (dateString.includes('/')) {
      date = new Date(dateString);
    } else if (dateString.length === 8) {
      // Handle YYYYMMDD format
      const year = dateString.substring(0, 4);
      const month = dateString.substring(4, 6);
      const day = dateString.substring(6, 8);
      date = new Date(`${year}-${month}-${day}`);
    } else {
      date = new Date(dateString);
    }

    if (Number.isNaN(date.getTime())) {
      return 'Ungültiges Datum';
    }

    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Filter nur verfügbare (unverknüpfte) Transaktionen - verwende das 'offen' Feld
  const availableTransactions = transactions.filter(transaction => {
    // Zeige nur offene (unverknüpfte) Transaktionen
    return transaction.offen === true;
  });

  // Debug Log

  const filteredTransactions = availableTransactions.filter(transaction => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    return (
      transaction.verwendungszweck?.toLowerCase().includes(searchLower) ||
      transaction.name?.toLowerCase().includes(searchLower) ||
      transaction.betrag.toString().includes(searchLower)
    );
  });

  const handleSelectTransaction = (transaction: Transaction) => {
    // Strikte Document-Type Validierung - BLOCKIERE falsche Zuordnungen
    const isPositiveTransaction = transaction.betrag > 0;

    if (documentType === 'INVOICE' && !isPositiveTransaction) {
      setWarningModal({
        isOpen: true,
        transaction,
        difference: 0,
        tolerance: 0,
      });
      return; // STOPPE die Verknüpfung
    }

    if (documentType === 'EXPENSE' && isPositiveTransaction) {
      setWarningModal({
        isOpen: true,
        transaction,
        difference: 0,
        tolerance: 0,
      });
      return; // STOPPE die Verknüpfung
    }

    // Währungs-Guard: eine Fremdwährungs-Transaktion darf NICHT als Zahlung einer
    // Rechnung anderer Währung verknüpft werden (sonst gilt CHF 100 als exakter
    // Treffer für EUR 100). Nur prüfen, wenn beide Währungen bekannt sind.
    const invCur = invoiceCurrency?.trim().toUpperCase();
    const txCur = transaction.currency?.trim().toUpperCase();
    if (invCur && txCur && invCur !== txCur) {
      setWarningModal({
        isOpen: true,
        transaction,
        difference: 0,
        tolerance: 0,
      });
      return; // STOPPE die Verknüpfung
    }

    // Validiere Betragsübereinstimmung - BLOCKIERE bei großer Differenz
    const transactionAmount = Math.abs(transaction.betrag);
    const rechnungsBetrag = Math.abs(invoiceAmount);
    const difference = Math.abs(transactionAmount - rechnungsBetrag);
    const tolerance = Math.max(rechnungsBetrag * 0.05, 1); // 5% Toleranz oder mindestens 1€

    if (difference > tolerance) {
      // Zeige Warning Modal
      setWarningModal({
        isOpen: true,
        transaction,
        difference,
        tolerance,
      });
      return; // STOPPE die Verknüpfung
    }

    // NEUE LOGIK: Öffne Buchungskonten-Modal anstatt direkte Verknüpfung
    setBookingAccountModal({
      isOpen: true,
      transaction,
    });
  };

  // Handle booking account selection
  const handleBookingAccountSelection = (
    transaction: ModalTransaction,
    bookingAccount: BookingAccount,
  ) => {
    setBookingAccountModal({ isOpen: false, transaction: null });

    // Erweiterte Callback mit bookingAccount - Konvertiere ModalTransaction zu Transaction
    const fullTransaction = transaction as Transaction;
    onSelect(fullTransaction, bookingAccount);
  };

  const handleCloseWarningModal = () => {
    setWarningModal({
      isOpen: false,
      transaction: null,
      difference: 0,
      tolerance: 0,
    });
  };

  const isAmountMatch = (transactionAmount: number, invoiceAmount: number) => {
    // Check if amounts match within a small tolerance (for rounding differences)
    const tolerance = 0.01;
    return Math.abs(Math.abs(transactionAmount) - invoiceAmount) <= tolerance;
  };

  const hasLargeDifference = (transactionAmount: number, invoiceAmount: number) => {
    const difference = Math.abs(Math.abs(transactionAmount) - invoiceAmount);
    const tolerance = Math.max(invoiceAmount * 0.05, 1); // 5% Toleranz oder mindestens 1€
    return difference > tolerance;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] max-w-6xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {documentType === 'INVOICE'
              ? 'Eingang für Rechnung auswählen'
              : documentType === 'EXPENSE'
                ? 'Ausgang für Beleg auswählen'
                : 'Banking-Transaktion auswählen'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col space-y-4 overflow-hidden">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Icon icon="lucide:search" className="absolute top-3 left-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Nach Verwendungszweck, Name oder Betrag suchen..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Badge variant="outline">
              {documentType === 'INVOICE' ? 'Rechnungsbetrag' : 'Belegbetrag'}:{' '}
              {formatCurrency(invoiceAmount, invoiceCurrency)}
            </Badge>
            <Badge variant="default" className="bg-blue-100 text-blue-800">
              {availableTransactions.length} verfügbare{' '}
              {documentType === 'INVOICE' ? 'Eingänge' : 'Ausgänge'}
            </Badge>
            {documentNumber && <Badge variant="secondary">{documentNumber}</Badge>}
            <Badge
              variant={documentType === 'INVOICE' ? 'default' : 'destructive'}
              className={
                documentType === 'INVOICE'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }
            >
              {documentType === 'INVOICE' ? '💰 Einnahmen-Rechnung' : '💸 Ausgaben-Beleg'}
            </Badge>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
              {error}
            </div>
          )}

          <div className="rounded-lg border bg-white" style={{ height: '500px' }}>
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <Icon icon="lucide:loader2" className="h-8 w-8 animate-spin" />
                <span className="ml-2">Lade Transaktionen...</span>
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="flex h-full items-center justify-center text-gray-500">
                {error ? 'Fehler beim Laden der Transaktionen' : 'Keine Transaktionen gefunden'}
              </div>
            ) : (
              <div style={{ height: '500px', overflow: 'auto' }}>
                <table className="w-full">
                  <thead className="sticky top-0 z-10 bg-gray-50">
                    <tr className="border-b">
                      <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase">
                        Typ
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase">
                        Datum
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase">
                        Verwendungszweck
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500 text-xs uppercase">
                        Betrag
                      </th>
                      <th className="px-4 py-3 text-center font-medium text-gray-500 text-xs uppercase">
                        Aktion
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map(transaction => (
                      <tr
                        key={transaction.id}
                        className={`cursor-pointer border-b hover:bg-gray-50 ${
                          isAmountMatch(transaction.betrag, invoiceAmount)
                            ? 'border-l-4 border-l-green-500 bg-green-50'
                            : hasLargeDifference(transaction.betrag, invoiceAmount)
                              ? 'border-l-4 border-l-yellow-500 bg-yellow-50'
                              : ''
                        }`}
                        onClick={() => handleSelectTransaction(transaction)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            {transaction.betrag > 0 ? (
                              <Icon
                                icon="lucide:arrow-down-right"
                                className="h-4 w-4 text-green-600"
                              />
                            ) : (
                              <Icon icon="lucide:arrow-up-right" className="h-4 w-4 text-red-600" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">{formatDate(transaction.buchungstag)}</td>
                        <td className="px-4 py-3">
                          <div>
                            <div className="font-medium text-sm">
                              {transaction.name || 'Unbekannt'}
                            </div>
                            <div className="text-gray-500 text-xs">{transaction.accountName}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div
                            className="max-w-xs truncate text-sm"
                            title={transaction.verwendungszweck}
                          >
                            {transaction.verwendungszweck || '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div
                            className={`font-medium text-sm ${
                              transaction.betrag > 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {formatCurrency(transaction.betrag, transaction.currency)}
                          </div>
                          {isAmountMatch(transaction.betrag, invoiceAmount) && (
                            <div className="mt-1">
                              <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 font-medium text-green-800 text-xs">
                                Betrag stimmt überein
                              </span>
                            </div>
                          )}
                          {hasLargeDifference(transaction.betrag, invoiceAmount) && (
                            <div className="mt-1">
                              <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-1 font-medium text-xs text-yellow-800">
                                ⚠️ Große Differenz:{' '}
                                {formatCurrency(
                                  Math.abs(Math.abs(transaction.betrag) - invoiceAmount),
                                  invoiceCurrency,
                                )}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button
                            size="sm"
                            className="bg-accent text-white hover:bg-accent/90"
                            onClick={e => {
                              e.stopPropagation();
                              handleSelectTransaction(transaction);
                            }}
                          >
                            Auswählen
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Warning Modal für Betragsdifferenzen */}
      <Dialog open={warningModal.isOpen} onOpenChange={handleCloseWarningModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-red-100 p-2">
                <Icon icon="lucide:alert-triangle" className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <DialogTitle className="text-red-900">
                  {warningModal.difference === 0
                    ? 'Falsche Transaktionsrichtung!'
                    : 'Verknüpfung nicht möglich'}
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            {warningModal.difference === 0 ? (
              // Document Type Mismatch Warning
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <h4 className="mb-2 font-medium text-red-900">
                  {documentType === 'INVOICE'
                    ? 'Einnahmen-Rechnungen können nur mit Eingängen verknüpft werden!'
                    : 'Ausgaben-Belege können nur mit Ausgängen verknüpft werden!'}
                </h4>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Dokument-Typ:</span>
                    <span className="font-medium">
                      {documentType === 'INVOICE' ? '💰 Einnahmen-Rechnung' : '💸 Ausgaben-Beleg'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Transaktionsrichtung:</span>
                    <span className="font-medium">
                      {warningModal.transaction?.betrag && warningModal.transaction.betrag > 0
                        ? '💰 Eingang'
                        : '💸 Ausgang'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Transaktionsbetrag:</span>
                    <span className="font-medium">
                      {warningModal.transaction
                        ? formatCurrency(
                            warningModal.transaction.betrag,
                            warningModal.transaction.currency,
                          )
                        : ''}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              // Amount Difference Warning (existing)
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <h4 className="mb-2 font-medium text-red-900">
                  Die Beträge weichen zu stark voneinander ab:
                </h4>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">
                      {documentType === 'INVOICE' ? 'Rechnungsbetrag' : 'Belegbetrag'}:
                    </span>
                    <span className="font-medium">
                      {formatCurrency(invoiceAmount, invoiceCurrency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Transaktionsbetrag:</span>
                    <span className="font-medium">
                      {warningModal.transaction
                        ? formatCurrency(
                            warningModal.transaction.betrag,
                            warningModal.transaction.currency,
                          )
                        : ''}
                    </span>
                  </div>
                  <div className="mt-2 border-t pt-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Differenz:</span>
                      <span className="font-medium text-red-600">
                        {formatCurrency(warningModal.difference, invoiceCurrency)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Maximal erlaubt:</span>
                      <span className="font-medium text-gray-500">
                        {formatCurrency(warningModal.tolerance, invoiceCurrency)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-blue-800 text-sm">
                {warningModal.difference === 0 ? (
                  <>
                    <strong>Wählen Sie eine Transaktion in der richtigen Richtung:</strong>
                    <br />
                    {documentType === 'INVOICE'
                      ? '• Einnahmen-Rechnungen (RE-) → nur Eingänge (positive Beträge)'
                      : '• Ausgaben-Belege (BE-) → nur Ausgänge (negative Beträge)'}
                  </>
                ) : (
                  <>
                    <strong>Bitte wählen Sie eine Transaktion mit passendem Betrag.</strong>
                    <br />
                    Nur Transaktionen mit einer Differenz von maximal 5% oder 1€ können verknüpft
                    werden.
                  </>
                )}
              </p>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                onClick={handleCloseWarningModal}
                className="bg-accent text-white hover:bg-accent/90"
              >
                Verstanden
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Booking Account Selection Modal */}
      <BookingAccountSelectionModal
        isOpen={bookingAccountModal.isOpen}
        companyId={companyId}
        transaction={bookingAccountModal.transaction}
        documentType={documentType}
        documentNumber={documentNumber}
        onClose={() => setBookingAccountModal({ isOpen: false, transaction: null })}
        onSelect={handleBookingAccountSelection}
      />
    </Dialog>
  );
}
