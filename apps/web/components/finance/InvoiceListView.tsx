'use client';

import { Icon } from '@iconify/react';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@tasko/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { api } from '@/lib/api-client';
import type { BookingAccount } from '@/services/bookingAccountService';
import { InvoiceStatusService } from '@/services/invoice-status.service';
import { TransactionLinkService } from '@/services/transaction-link.service';
import { WhatsAppNotificationService } from '@/services/whatsapp-notifications.service';
import type { InvoiceData } from '@/types/invoiceTypes';
import { EmailDialog } from './EmailDialog';
import SelectBankingTransactionModal from './SelectBankingTransactionModal';
import StornoInvoice from './StornoInvoice';

interface InvoiceListViewProps {
  invoices: InvoiceData[];
  onRefresh?: () => void;
  companyId: string;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
}

export function InvoiceListView({
  invoices: initialInvoices,
  onRefresh,
  companyId,
  activeTab,
  setActiveTab,
  showFilters,
  setShowFilters,
}: InvoiceListViewProps) {
  const [invoices, _setInvoices] = useState<InvoiceData[]>(initialInvoices);
  const [showStornoDialog, setShowStornoDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceData | null>(null);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [selectedInvoiceForEmail, setSelectedInvoiceForEmail] = useState<InvoiceData | null>(null);
  const [linkedInvoices, setLinkedInvoices] = useState<Set<string>>(new Set());
  const [showLinkTransactionModal, setShowLinkTransactionModal] = useState(false);
  const [selectedInvoiceForLink, setSelectedInvoiceForLink] = useState<InvoiceData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContact, setSelectedContact] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [sortField, setSortField] = useState<'dueDate' | 'number' | 'date' | 'amount'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const router = useRouter();

  // Lade verknüpfte Rechnungen beim Initialisieren
  useEffect(() => {
    const loadLinkedInvoices = async () => {
      if (!companyId) return;

      try {
        const result = await TransactionLinkService.getLinks(companyId);
        if (result.success && result.links) {
          const linkedIds = new Set(result.links.map(link => link.documentId));
          setLinkedInvoices(linkedIds);
        }
      } catch (error) {
        console.error('Fehler beim Laden der verknüpften Rechnungen:', error);
      }
    };

    loadLinkedInvoices();
  }, [companyId]);

  const handleSort = (field: 'dueDate' | 'number' | 'date' | 'amount') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const isOverdue = (invoice: InvoiceData) => {
    if (invoice.status === 'paid') return false;
    const dueDate = new Date(invoice.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate < today;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const getStatusBadge = (invoice: InvoiceData) => {
    const status = invoice.status;

    // Check if invoice is overdue
    const isOverdueStatus = isOverdue(invoice);

    const statusConfig = {
      draft: {
        label: 'Entwurf',
        variant: 'secondary' as const,
        className: 'bg-gray-100 text-gray-800',
      },
      finalized: {
        label: isOverdueStatus ? 'Fällig' : 'Offen',
        variant: isOverdueStatus ? ('destructive' as const) : ('default' as const),
        className: isOverdueStatus ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800',
      },
      sent: {
        label: isOverdueStatus ? 'Fällig' : 'Offen',
        variant: isOverdueStatus ? ('destructive' as const) : ('default' as const),
        className: isOverdueStatus ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800',
      },
      paid: {
        label: 'Bezahlt',
        variant: 'default' as const,
        className: 'bg-green-100 text-green-800',
      },
      overdue: {
        label: 'Fällig',
        variant: 'destructive' as const,
        className: 'bg-red-100 text-red-800',
      },
      cancelled: {
        label: 'Storno',
        variant: 'secondary' as const,
        className: 'bg-gray-100 text-gray-800',
      },
      storno: {
        label: 'Storno',
        variant: 'destructive' as const,
        className: 'bg-red-100 text-red-800',
      },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const getDueDateText = (dueDate: string, status: string) => {
    if (status === 'paid') return 'Bezahlt';

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0); // Set to start of day

    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Fällig';
    if (diffDays === 0) return 'Heute';
    if (diffDays === 1) return 'Morgen';
    return `In ${diffDays} Tagen`;
  };

  const handleViewInvoice = (invoiceId: string) => {
    router.push(`./invoices/${invoiceId}`);
  };

  const handleEditInvoice = (invoiceId: string) => {
    router.push(`./invoices/${invoiceId}/edit`);
  };

  const handleCreateStorno = (invoiceId: string) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (invoice) {
      setSelectedInvoice(invoice);
      setShowStornoDialog(true);
    }
  };

  const handleSendEmail = (invoiceId: string) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (invoice) {
      setSelectedInvoiceForEmail(invoice);
      setShowEmailDialog(true);
    }
  };

  const handleMarkAsPaid = async (invoiceId: string) => {
    // Finde die Rechnung
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) {
      toast.error('Rechnung nicht gefunden');
      return;
    }

    // Öffne Banking Transaction Auswahl Modal
    setSelectedInvoiceForLink(invoice);
    setShowLinkTransactionModal(true);
  };

  const handleBankingTransactionSelected = async (
    bankingTransaction: any,
    bookingAccount?: BookingAccount,
  ) => {
    try {
      if (!selectedInvoiceForLink) {
        toast.error('Rechnung nicht gefunden');
        return;
      }

      // ECHTE Banking Transaction Daten verwenden!
      const transactionData = {
        id: bankingTransaction.id,
        name: bankingTransaction.counterpartName || bankingTransaction.name || '',
        verwendungszweck: bankingTransaction.purpose || bankingTransaction.verwendungszweck || '',
        buchungstag: bankingTransaction.bookingDate || bankingTransaction.buchungstag || '',
        betrag: bankingTransaction.amount || bankingTransaction.betrag || 0,
        accountId: bankingTransaction.accountId || '',
      };

      const documentData = {
        id: selectedInvoiceForLink.id,
        documentNumber: selectedInvoiceForLink.invoiceNumber || selectedInvoiceForLink.number || '',
        invoiceNumber: selectedInvoiceForLink.invoiceNumber,
        customerName: selectedInvoiceForLink.customerName || '',
        total: selectedInvoiceForLink.total || 0,
        date:
          selectedInvoiceForLink.issueDate || selectedInvoiceForLink.createdAt?.toString() || '',
        issueDate: selectedInvoiceForLink.issueDate,
        isStorno: selectedInvoiceForLink.isStorno || false,
      };

      // Erweiterte Verknüpfung mit Buchungskonto erstellen
      const linkData = {
        transactionData,
        documentData,
        documentType: 'INVOICE' as const,
        bookingAccount: bookingAccount
          ? {
              id: bookingAccount.id,
              number: bookingAccount.number,
              name: bookingAccount.name,
              type: bookingAccount.type,
            }
          : undefined,
      };

      // Erweiterte Verknüpfung mit Buchungskonto erstellen
      const result = await TransactionLinkService.createLink(
        companyId,
        bankingTransaction.id,
        selectedInvoiceForLink.id,
        transactionData,
        documentData,
        companyId,
        linkData,
      );

      if (!result.success) {
        throw new Error(result.error || 'Fehler beim Erstellen der Verknüpfung');
      }

      // Rechnung als bezahlt markieren mit realem transactionId
      await InvoiceStatusService.markAsPaid(
        companyId,
        selectedInvoiceForLink.id,
        selectedInvoiceForLink.total || 0,
        bankingTransaction.id,
        'Banküberweisung',
      );

      // WhatsApp-Benachrichtigung für Zahlung eingegangen
      try {
        // Kundentelefon laden
        let customerPhone = selectedInvoiceForLink.customerPhone || '';
        let customerId = '';

        if (!customerPhone && selectedInvoiceForLink.customerEmail) {
          try {
            const customersResult = await api.get<{ items: Array<{ id: string; phone?: string }> }>(
              `/api/v1/customers?company_id=${companyId}&email=${encodeURIComponent(selectedInvoiceForLink.customerEmail)}&limit=1`,
            );
            const firstCustomer = customersResult?.items?.[0];
            if (firstCustomer) {
              customerPhone = firstCustomer.phone || '';
              customerId = firstCustomer.id;
            }
          } catch {
            /* phone lookup failure is non-critical */
          }
        }

        if (customerPhone) {
          // Firmennamen laden
          let companyName = 'NextDays';
          try {
            const companyResult = await api.get<{ name?: string }>(
              `/api/v1/companies/${companyId}`,
            );
            companyName = companyResult?.name || 'NextDays';
          } catch {
            /* company name fallback is non-critical */
          }

          await WhatsAppNotificationService.notifyInvoicePaid(
            companyId,
            companyName,
            customerId,
            selectedInvoiceForLink.customerName || '',
            customerPhone,
            selectedInvoiceForLink.invoiceNumber || selectedInvoiceForLink.number || '',
            selectedInvoiceForLink.total || 0,
            selectedInvoiceForLink.id,
          );
        }
      } catch {
        // WhatsApp-Fehler nicht kritisch
      }

      toast.success('Rechnung wurde als bezahlt markiert und verknüpft');

      // Modal schließen und Liste aktualisieren
      setShowLinkTransactionModal(false);
      setSelectedInvoiceForLink(null);

      if (onRefresh) {
        onRefresh();
      }
    } catch (error: any) {
      console.error('Fehler beim Verknüpfen:', error);
      toast.error(`Fehler beim Verknüpfen: ${error.message}`);
    }
  };

  const handleStornoCreated = () => {
    setShowStornoDialog(false);
    setSelectedInvoice(null);
    if (onRefresh) {
      onRefresh();
    }
  };

  const filteredInvoices = invoices
    .filter(invoice => {
      // Tab filter
      if (activeTab !== 'all') {
        switch (activeTab) {
          case 'draft':
            if (invoice.status !== 'draft') return false;
            break;
          case 'open':
            if (
              !['sent', 'finalized'].includes(invoice.status) ||
              invoice.status === 'paid' ||
              isOverdue(invoice)
            )
              return false;
            break;
          case 'overdue':
            if (!['sent', 'finalized'].includes(invoice.status) || !isOverdue(invoice))
              return false;
            break;
          case 'finalized':
            if (invoice.status !== 'finalized') return false;
            break;
          case 'paid':
            if (invoice.status !== 'paid') return false;
            break;
          case 'partial':
            // For partial payments - would need additional logic
            return false;
          case 'cancelled':
            if (!['cancelled', 'storno'].includes(invoice.status)) return false;
            break;
          case 'recurring':
            // For recurring invoices - would need additional logic
            return false;
        }
      }

      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        if (
          !invoice.customerName?.toLowerCase().includes(searchLower) &&
          !invoice.number?.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }

      // Amount filter
      if (minAmount && invoice.total < parseFloat(minAmount)) return false;
      if (maxAmount && invoice.total > parseFloat(maxAmount)) return false;

      // Date filter
      if (startDate && new Date(invoice.createdAt) < new Date(startDate)) return false;
      if (endDate && new Date(invoice.createdAt) > new Date(endDate)) return false;

      return true;
    })
    .sort((a, b) => {
      // Sort filtered invoices
      let comparison = 0;

      switch (sortField) {
        case 'dueDate':
          comparison = new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime();
          break;
        case 'number':
          comparison = (a.invoiceNumber || a.number || '').localeCompare(
            b.invoiceNumber || b.number || '',
          );
          break;
        case 'date': {
          const dateA = a.date || a.issueDate || a.createdAt;
          const dateB = b.date || b.issueDate || b.createdAt;
          comparison = new Date(dateA || 0).getTime() - new Date(dateB || 0).getTime();
          break;
        }
        case 'amount':
          comparison = (a.amount || 0) - (b.amount || 0);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

  const tabs = [
    { id: 'all', label: 'Alle', count: invoices.length },
    { id: 'draft', label: 'Entwurf', count: invoices.filter(i => i.status === 'draft').length },
    {
      id: 'open',
      label: 'Offen',
      count: invoices.filter(
        i => ['sent', 'finalized'].includes(i.status) && !isOverdue(i) && i.status !== 'paid',
      ).length,
    },
    {
      id: 'overdue',
      label: 'Fällig',
      count: invoices.filter(i => ['sent', 'finalized'].includes(i.status) && isOverdue(i)).length,
    },
    {
      id: 'finalized',
      label: 'Festgeschrieben',
      count: invoices.filter(i => i.status === 'finalized').length,
    },
    {
      id: 'paid',
      label: 'Bezahlt',
      count: invoices.filter(i => i.status === 'paid').length,
      locked: true,
    },
    { id: 'partial', label: 'Teilbezahlt', count: 0, locked: true },
    {
      id: 'cancelled',
      label: 'Storno',
      count: invoices.filter(i => ['cancelled', 'storno'].includes(i.status)).length,
      locked: true,
    },
    { id: 'recurring', label: 'Wiederkehrend', count: 0, locked: true },
  ];

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex h-auto w-full p-1">
          {tabs.map(tab => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className={`relative flex-1 ${tab.locked ? 'opacity-50' : ''}`}
              disabled={tab.locked}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-1 rounded bg-gray-200 px-1 text-gray-700 text-xs">
                  {tab.count}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2"
              >
                <Icon icon="lucide:filter" className="h-4 w-4" />
                Filter
              </Button>
              <Button variant="outline" className="flex items-center gap-2">
                <Icon icon="lucide:download" className="h-4 w-4" />
                Exportieren
              </Button>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="space-y-4 rounded-lg bg-gray-50 p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <label className="font-medium text-sm">Suche</label>
                  <div className="relative">
                    <Icon
                      icon="lucide:search"
                      className="absolute top-3 left-3 h-4 w-4 text-gray-400"
                    />
                    <Input
                      placeholder="Rechnungsnr. oder Kontakt"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="font-medium text-sm">Kontakt</label>
                  <Select value={selectedContact} onValueChange={setSelectedContact}>
                    <SelectTrigger>
                      <SelectValue placeholder="Alle Kontakte" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Kontakte</SelectItem>
                      {/* Would need to populate with actual contacts */}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="font-medium text-sm">Betrag (Netto)</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Min"
                      type="number"
                      value={minAmount}
                      onChange={e => setMinAmount(e.target.value)}
                    />
                    <Input
                      placeholder="Max"
                      type="number"
                      value={maxAmount}
                      onChange={e => setMaxAmount(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="font-medium text-sm">Startdatum</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="font-medium text-sm">Enddatum</label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <label className="font-medium text-sm">Zahlungsmethode</label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Alle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle</SelectItem>
                      <SelectItem value="sepa">SEPA Überweisung</SelectItem>
                      <SelectItem value="cash">Bargeld</SelectItem>
                      <SelectItem value="card">Kreditkarte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedContact('');
                    setMinAmount('');
                    setMaxAmount('');
                    setStartDate('');
                    setEndDate('');
                    setPaymentMethod('');
                  }}
                >
                  Zurücksetzen
                </Button>
                <Button
                  className="bg-accent text-white hover:bg-accent/90"
                  onClick={() => setShowFilters(false)}
                >
                  Übernehmen
                </Button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('dueDate')}
                  >
                    Fälligkeit {sortField === 'dueDate' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('number')}
                  >
                    Rechnungsnr. {sortField === 'number' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead>Kunde</TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('date')}
                  >
                    Datum {sortField === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer text-right hover:bg-gray-100"
                    onClick={() => handleSort('amount')}
                  >
                    Betrag (netto) {sortField === 'amount' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead className="text-right">Offen (brutto)</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      Keine Rechnungen gefunden
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvoices.map(invoice => (
                    <TableRow key={invoice.id}>
                      <TableCell>{getStatusBadge(invoice)}</TableCell>
                      <TableCell>
                        <span className={invoice.status === 'overdue' ? 'text-red-600' : ''}>
                          {getDueDateText(invoice.dueDate, invoice.status)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {invoice.number ||
                          invoice.invoiceNumber ||
                          (invoice.status === 'draft'
                            ? 'Entwurf'
                            : `DOK-${invoice.id.substring(0, 8)}`)}{' '}
                        {/* NumberSequenceService manages numbering */}
                      </TableCell>
                      <TableCell>{invoice.customerName}</TableCell>
                      <TableCell>
                        {invoice.date
                          ? new Date(invoice.date).toLocaleDateString('de-DE')
                          : invoice.issueDate
                            ? new Date(invoice.issueDate).toLocaleDateString('de-DE')
                            : invoice.createdAt
                              ? new Date(invoice.createdAt).toLocaleDateString('de-DE')
                              : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(invoice.amount || 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {invoice.status === 'paid' ? '0,00 €' : formatCurrency(invoice.total)}
                      </TableCell>
                      <TableCell>
                        {!linkedInvoices.has(invoice.id) ? (
                          <div className="flex items-center gap-1">
                            {['sent', 'finalized'].includes(invoice.status) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Als bezahlt markieren"
                                onClick={() => handleMarkAsPaid(invoice.id)}
                              >
                                <Icon icon="lucide:dollar-sign" className="h-4 w-4" />
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <Icon icon="lucide:more-horizontal" className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewInvoice(invoice.id)}>
                                  <Icon icon="lucide:eye" className="mr-2 h-4 w-4" />
                                  Anzeigen
                                </DropdownMenuItem>
                                {invoice.status === 'draft' && (
                                  <DropdownMenuItem onClick={() => handleEditInvoice(invoice.id)}>
                                    <Icon icon="lucide:edit" className="mr-2 h-4 w-4" />
                                    Bearbeiten
                                  </DropdownMenuItem>
                                )}
                                {['sent', 'paid'].includes(invoice.status) && !invoice.isStorno && (
                                  <DropdownMenuItem onClick={() => handleCreateStorno(invoice.id)}>
                                    <Icon icon="lucide:x" className="mr-2 h-4 w-4" />
                                    Stornieren
                                  </DropdownMenuItem>
                                )}
                                {['sent', 'paid', 'finalized'].includes(invoice.status) && (
                                  <DropdownMenuItem onClick={() => handleSendEmail(invoice.id)}>
                                    <Icon icon="lucide:mail" className="mr-2 h-4 w-4" />
                                    E-Mail senden
                                  </DropdownMenuItem>
                                )}
                                {invoice.status === 'draft' && (
                                  <DropdownMenuItem className="text-red-600">
                                    <Icon icon="lucide:trash2" className="mr-2 h-4 w-4" />
                                    Löschen
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center">
                            <span className="rounded bg-gray-100 px-2 py-1 text-gray-500 text-xs">
                              Verknüpft
                            </span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {showStornoDialog && selectedInvoice && (
        <StornoInvoice invoice={selectedInvoice} onStornoCreated={handleStornoCreated} />
      )}

      {showEmailDialog && selectedInvoiceForEmail && (
        <EmailDialog
          isOpen={showEmailDialog}
          onClose={() => {
            setShowEmailDialog(false);
            setSelectedInvoiceForEmail(null);
          }}
          invoice={selectedInvoiceForEmail}
          companyId={companyId}
        />
      )}

      {showLinkTransactionModal && selectedInvoiceForLink && (
        <SelectBankingTransactionModal
          isOpen={showLinkTransactionModal}
          companyId={companyId}
          invoiceAmount={selectedInvoiceForLink.total || 0}
          documentType="INVOICE"
          documentNumber={selectedInvoiceForLink.invoiceNumber || selectedInvoiceForLink.number}
          transactionType="CREDIT"
          onClose={() => {
            setShowLinkTransactionModal(false);
            setSelectedInvoiceForLink(null);
          }}
          onSelect={handleBankingTransactionSelected}
        />
      )}
    </div>
  );
}
