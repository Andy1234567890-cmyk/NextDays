'use client';

// 1:1 aus dem Taskilo-Finanzwerkzeug (components/finance/DocumentListView.tsx,
// 1078 Zeilen) übernommen — die generische Belegliste mit Tabs, Filtern,
// Sortierung und Aktionsmenü für Angebote, Auftragsbestätigungen, Lieferscheine,
// wiederkehrende Rechnungen, Mahnungen und Stornos (Rechnungen selbst laufen
// weiter über die spezialisierte InvoiceListView).
// Anpassungen wie bei jeder Übernahme: Texte über useTranslations('finance'),
// Währung aus dem Beleg statt EUR-Hardcode (Wurzel 4), Datum nach Nutzer-Locale,
// Taskilo-Türkis → Accent-Token. Zeilen-Logik unverändert.
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
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useEffect, useState } from 'react';
import { formatCurrency as formatCurrencyIntl } from '@/lib/currency';

// Document Types
export type DocumentType =
  | 'invoice'
  | 'quote'
  | 'order-confirmation'
  | 'delivery-note'
  | 'recurring-invoice'
  | 'reminder'
  | 'credit';

// Generic Document Interface
export interface DocumentItem {
  id: string;
  number?: string;
  invoiceNumber?: string;
  quoteNumber?: string;
  deliveryNoteNumber?: string;
  confirmationNumber?: string;
  reminderNumber?: string;
  customerName?: string;
  customerEmail?: string;
  date?: string | Date;
  issueDate?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  dueDate?: string;
  validUntil?: string | Date;
  deliveryDate?: string;
  /** Aufenthaltsbelege (Angebot): Objekt und Zeitraum. */
  propertyTitle?: string;
  stayFrom?: string;
  stayTo?: string;
  status: string;
  amount?: number;
  total?: number;
  subtotal?: number;
  tax?: number;
  currency?: string;
  items?: unknown[];
  isStorno?: boolean;
  // Recurring specific
  recurringStatus?: string;
  recurringInterval?: string;
  recurringNextExecutionDate?: string;
  title?: string;
  // Reminder specific
  reminderLevel?: number;
  outstandingAmount?: number;
  daysPastDue?: number;
  // Quote specific
  customerOrderNumber?: string;
}

type Translate = ReturnType<typeof useTranslations<'finance'>>;

// Tab Configuration
interface TabConfig {
  id: string;
  label: string;
  filterFn: (doc: DocumentItem) => boolean;
  locked?: boolean;
}

// Action Configuration
interface ActionConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: (doc: DocumentItem) => void;
  showCondition?: (doc: DocumentItem) => boolean;
  className?: string;
}

interface DocumentListViewProps {
  documents: DocumentItem[];
  documentType: DocumentType;
  companyId: string;
  basePath: string;
  onRefresh?: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  customActions?: ActionConfig[];
  onMarkAsPaid?: (doc: DocumentItem) => void;
  onCreateStorno?: (doc: DocumentItem) => void;
  onSendEmail?: (doc: DocumentItem) => void;
  onConvertToInvoice?: (doc: DocumentItem) => void;
  onMarkAsDelivered?: (doc: DocumentItem) => void;
  onMarkAsSent?: (doc: DocumentItem) => void;
  onPauseResume?: (doc: DocumentItem) => void;
  onDelete?: (doc: DocumentItem) => void;
  onDuplicate?: (doc: DocumentItem) => void;
  /** Bearbeiten-Ziel; ohne Angabe `${basePath}/${id}/edit` wie im Bestand. */
  editPath?: (doc: DocumentItem) => string;
}

type StatusConfig = Record<string, { label: string; className: string }>;

interface DocumentConfig {
  title: string;
  tabs: TabConfig[];
  numberField: string;
  statusConfig: StatusConfig;
}

// Farbklassen wie im Bestand (Status-Badges), dunkle Fläche ergänzt.
const GRAY = 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
const BLUE = 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300';
const GREEN = 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300';
const RED = 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300';
const YELLOW = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300';
const ORANGE = 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300';
const PURPLE = 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300';

// Document Type Configurations — Labels aus dem Sprachkatalog, Filter-Logik 1:1.
function buildDocumentConfigs(t: Translate): Record<DocumentType, DocumentConfig> {
  const s = (key: string) => t(`DocumentListView.status.${key}`);
  const tab = (key: string) => t(`DocumentListView.tabs.${key}`);
  return {
    invoice: {
      title: t('DocumentListView.title.invoice'),
      numberField: 'invoiceNumber',
      tabs: [
        { id: 'all', label: tab('all'), filterFn: () => true },
        { id: 'draft', label: tab('draft'), filterFn: d => d.status === 'draft' },
        {
          id: 'open',
          label: tab('open'),
          filterFn: d => ['sent', 'finalized'].includes(d.status) && !isOverdue(d),
        },
        {
          id: 'overdue',
          label: tab('overdue'),
          filterFn: d => ['sent', 'finalized'].includes(d.status) && isOverdue(d),
        },
        { id: 'finalized', label: tab('finalized'), filterFn: d => d.status === 'finalized' },
        { id: 'paid', label: tab('paid'), filterFn: d => d.status === 'paid', locked: true },
        { id: 'partial', label: tab('partial'), filterFn: () => false, locked: true },
        {
          id: 'cancelled',
          label: tab('storno'),
          filterFn: d => ['cancelled', 'storno'].includes(d.status),
          locked: true,
        },
        { id: 'recurring', label: tab('recurring'), filterFn: () => false, locked: true },
      ],
      statusConfig: {
        draft: { label: s('draft'), className: GRAY },
        finalized: { label: s('open'), className: BLUE },
        sent: { label: s('open'), className: BLUE },
        paid: { label: s('paid'), className: GREEN },
        overdue: { label: s('overdue'), className: RED },
        cancelled: { label: s('storno'), className: GRAY },
        storno: { label: s('storno'), className: RED },
      },
    },
    quote: {
      title: t('DocumentListView.title.quote'),
      numberField: 'number',
      tabs: [
        { id: 'all', label: tab('all'), filterFn: () => true },
        { id: 'draft', label: tab('draft'), filterFn: d => d.status === 'draft' },
        { id: 'sent', label: tab('sent'), filterFn: d => d.status === 'sent' },
        { id: 'accepted', label: tab('accepted'), filterFn: d => d.status === 'accepted' },
        { id: 'expired', label: tab('expired'), filterFn: d => isExpired(d) },
        { id: 'cancelled', label: tab('cancelled'), filterFn: d => d.status === 'cancelled' },
      ],
      statusConfig: {
        draft: { label: s('draft'), className: GRAY },
        sent: { label: s('sent'), className: BLUE },
        accepted: { label: s('accepted'), className: GREEN },
        rejected: { label: s('rejected'), className: RED },
        cancelled: { label: s('cancelled'), className: GRAY },
        expired: { label: s('expired'), className: RED },
        converted: { label: s('converted'), className: PURPLE },
      },
    },
    'order-confirmation': {
      title: t('DocumentListView.title.orderConfirmation'),
      numberField: 'confirmationNumber',
      tabs: [
        { id: 'all', label: tab('all'), filterFn: () => true },
        { id: 'draft', label: tab('draft'), filterFn: d => d.status === 'draft' },
        { id: 'sent', label: tab('sentShort'), filterFn: d => d.status === 'sent' },
        { id: 'confirmed', label: tab('confirmed'), filterFn: d => d.status === 'confirmed' },
        { id: 'cancelled', label: tab('cancelled'), filterFn: d => d.status === 'cancelled' },
      ],
      statusConfig: {
        draft: { label: s('draft'), className: GRAY },
        sent: { label: s('sentShort'), className: BLUE },
        confirmed: { label: s('confirmed'), className: GREEN },
        cancelled: { label: s('cancelled'), className: RED },
      },
    },
    'delivery-note': {
      title: t('DocumentListView.title.deliveryNote'),
      numberField: 'deliveryNoteNumber',
      tabs: [
        { id: 'all', label: tab('all'), filterFn: () => true },
        { id: 'draft', label: tab('draft'), filterFn: d => d.status === 'draft' },
        { id: 'sent', label: tab('sent'), filterFn: d => d.status === 'sent' },
        { id: 'delivered', label: tab('delivered'), filterFn: d => d.status === 'delivered' },
        { id: 'invoiced', label: tab('invoiced'), filterFn: d => d.status === 'invoiced' },
        { id: 'cancelled', label: tab('cancelled'), filterFn: d => d.status === 'cancelled' },
      ],
      statusConfig: {
        draft: { label: s('draft'), className: GRAY },
        sent: { label: s('sent'), className: BLUE },
        delivered: { label: s('delivered'), className: GREEN },
        invoiced: { label: s('invoiced'), className: PURPLE },
        cancelled: { label: s('cancelled'), className: GRAY },
      },
    },
    'recurring-invoice': {
      title: t('DocumentListView.title.recurringInvoice'),
      numberField: 'number',
      tabs: [
        { id: 'all', label: tab('all'), filterFn: () => true },
        { id: 'active', label: tab('active'), filterFn: d => d.recurringStatus === 'active' },
        { id: 'paused', label: tab('paused'), filterFn: d => d.recurringStatus === 'paused' },
        {
          id: 'completed',
          label: tab('completed'),
          filterFn: d => d.recurringStatus === 'completed',
        },
      ],
      statusConfig: {
        active: { label: s('active'), className: GREEN },
        paused: { label: s('paused'), className: YELLOW },
        completed: { label: s('completed'), className: GRAY },
      },
    },
    reminder: {
      title: t('DocumentListView.title.reminder'),
      numberField: 'number',
      tabs: [
        { id: 'all', label: tab('all'), filterFn: () => true },
        { id: 'draft', label: tab('draft'), filterFn: d => d.status === 'draft' },
        { id: 'sent', label: tab('sent'), filterFn: d => d.status === 'sent' },
        { id: 'paid', label: tab('paid'), filterFn: d => d.status === 'paid' },
        { id: 'escalated', label: tab('escalated'), filterFn: d => d.status === 'escalated' },
      ],
      statusConfig: {
        draft: { label: s('draft'), className: GRAY },
        sent: { label: s('sent'), className: BLUE },
        paid: { label: s('paid'), className: GREEN },
        escalated: { label: s('escalated'), className: RED },
      },
    },
    credit: {
      title: t('DocumentListView.title.credit'),
      numberField: 'invoiceNumber',
      tabs: [
        { id: 'all', label: tab('all'), filterFn: () => true },
        { id: 'draft', label: tab('draft'), filterFn: d => d.status === 'draft' },
        { id: 'sent', label: tab('sent'), filterFn: d => d.status === 'sent' },
        {
          id: 'finalized',
          label: tab('completed'),
          filterFn: d => d.status === 'finalized' || d.status === 'paid',
        },
      ],
      statusConfig: {
        draft: { label: s('draft'), className: GRAY },
        sent: { label: s('sent'), className: BLUE },
        finalized: { label: s('completed'), className: GREEN },
        processed: { label: s('processed'), className: GREEN },
        cancelled: { label: s('cancelled'), className: RED },
      },
    },
  };
}

// Helper functions
function isOverdue(doc: DocumentItem): boolean {
  if (doc.status === 'paid') return false;
  const dueDate = new Date(doc.dueDate || doc.validUntil || 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  return dueDate < today;
}

function isExpired(doc: DocumentItem): boolean {
  const validUntil = new Date(doc.validUntil || doc.dueDate || 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  validUntil.setHours(0, 0, 0, 0);
  return validUntil < today && !['accepted', 'converted'].includes(doc.status);
}

// Kein EUR-Fallback (Wurzel 4): ohne Währung symbollos, wie lib/currency es macht.
function formatMoney(amount: number, currency: string | undefined): string {
  return formatCurrencyIntl(amount, currency || '');
}

/** „03.10. – 07.10.2026 · 4 Nächte"; „–", wenn der Beleg keinen Aufenthalt trägt. */
function formatStay(
  von: string | undefined,
  bis: string | undefined,
  locale: string,
  naechteText: (n: number) => string,
): string {
  if (!von || !bis) return '–';
  const a = new Date(`${von}T00:00:00`);
  const b = new Date(`${bis}T00:00:00`);
  const naechte = Math.round((b.getTime() - a.getTime()) / 86_400_000);
  const tagMonat: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit' };
  const voll: Intl.DateTimeFormatOptions = { ...tagMonat, year: 'numeric' };
  return `${a.toLocaleDateString(locale, tagMonat)} – ${b.toLocaleDateString(locale, voll)} · ${naechteText(naechte)}`;
}

function formatDate(date: string | Date | undefined, locale: string): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString(locale);
}

function getDocumentNumber(doc: DocumentItem, type: DocumentType, t: Translate): string {
  switch (type) {
    case 'invoice':
    case 'credit':
      return (
        doc.invoiceNumber ||
        doc.number ||
        (doc.status === 'draft' ? t('DocumentListView.status.draft') : `DOK-${doc.id.substring(0, 8)}`)
      );
    case 'quote':
      return doc.number || doc.quoteNumber || t('DocumentListView.noNumber');
    case 'order-confirmation':
      return doc.confirmationNumber || doc.number || t('DocumentListView.noNumber');
    case 'delivery-note':
      return (
        doc.deliveryNoteNumber ||
        doc.number ||
        (doc.status === 'draft' ? t('DocumentListView.status.draft') : `LS-${doc.id.substring(0, 8)}`)
      );
    case 'recurring-invoice':
      return doc.title || doc.number || t('DocumentListView.subscriptionInvoice');
    case 'reminder':
      return (
        doc.number || doc.reminderNumber || `M${doc.reminderLevel || 1}-${doc.id.substring(0, 6)}`
      );
    default:
      return doc.number || doc.id;
  }
}

function getDueDateText(dueDate: string | undefined, status: string, t: Translate): string {
  if (status === 'paid') return t('DocumentListView.status.paid');
  if (!dueDate) return '-';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return t('DocumentListView.status.overdue');
  if (diffDays === 0) return t('DocumentListView.dueToday');
  if (diffDays === 1) return t('DocumentListView.dueTomorrow');
  return t('DocumentListView.dueInDays', { days: diffDays });
}

export function DocumentListView({
  documents: initialDocuments,
  documentType,
  companyId: _companyId,
  basePath,
  onRefresh: _onRefresh,
  activeTab,
  setActiveTab,
  showFilters,
  setShowFilters,
  onMarkAsPaid,
  onCreateStorno,
  onSendEmail,
  onConvertToInvoice,
  onMarkAsDelivered,
  onMarkAsSent,
  onPauseResume,
  onDelete,
  onDuplicate,
  editPath,
}: DocumentListViewProps) {
  const t = useTranslations('finance');
  const locale = useLocale();
  const [documents, setDocuments] = useState<DocumentItem[]>(initialDocuments);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContact, setSelectedContact] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortField, setSortField] = useState<string>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const router = useRouter();

  const config = buildDocumentConfigs(t)[documentType];

  useEffect(() => {
    setDocuments(initialDocuments);
  }, [initialDocuments]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortMark = (field: string) =>
    sortField === field ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : '';

  const getStatusBadge = (doc: DocumentItem) => {
    let status = doc.status;

    // Special handling for recurring invoices
    if (documentType === 'recurring-invoice') {
      status = doc.recurringStatus || 'active';
    }

    // Check for overdue
    if (
      ['invoice', 'quote'].includes(documentType) &&
      isOverdue(doc) &&
      !['paid', 'accepted', 'converted', 'cancelled', 'rejected'].includes(status)
    ) {
      status = documentType === 'quote' ? 'expired' : 'overdue';
    }

    const statusCfg = config.statusConfig[status] || {
      label: status,
      className: GRAY,
    };
    return <Badge className={statusCfg.className}>{statusCfg.label}</Badge>;
  };

  const handleView = (doc: DocumentItem) => {
    router.push(`${basePath}/${doc.id}`);
  };

  const handleEdit = (doc: DocumentItem) => {
    router.push(editPath ? editPath(doc) : `${basePath}/${doc.id}/edit`);
  };

  // Filter and sort documents
  const filteredDocuments = documents
    .filter(doc => {
      // Tab filter
      const tabConfig = config.tabs.find(tb => tb.id === activeTab);
      if (tabConfig && !tabConfig.filterFn(doc)) return false;

      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const docNumber = getDocumentNumber(doc, documentType, t).toLowerCase();
        const customerName = (doc.customerName || '').toLowerCase();
        if (!docNumber.includes(searchLower) && !customerName.includes(searchLower)) {
          return false;
        }
      }

      // Amount filter
      const amount = doc.total || doc.amount || 0;
      if (minAmount && amount < parseFloat(minAmount)) return false;
      if (maxAmount && amount > parseFloat(maxAmount)) return false;

      // Date filter
      const docDate = new Date(doc.date || doc.createdAt || 0);
      if (startDate && docDate < new Date(startDate)) return false;
      if (endDate && docDate > new Date(endDate)) return false;

      return true;
    })
    .sort((a, b) => {
      let comparison: number;
      const aDate = new Date(a.date || a.createdAt || 0).getTime();
      const bDate = new Date(b.date || b.createdAt || 0).getTime();
      const aDue = new Date(a.dueDate || a.validUntil || 0).getTime();
      const bDue = new Date(b.dueDate || b.validUntil || 0).getTime();

      switch (sortField) {
        case 'dueDate':
        case 'validUntil':
          comparison = aDue - bDue;
          break;
        case 'number':
          comparison = getDocumentNumber(a, documentType, t).localeCompare(
            getDocumentNumber(b, documentType, t),
          );
          break;
        case 'date':
          comparison = aDate - bDate;
          break;
        case 'amount':
          comparison = (a.total || a.amount || 0) - (b.total || b.amount || 0);
          break;
        default:
          comparison = aDate - bDate;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

  // Calculate tab counts
  const tabsWithCounts = config.tabs.map(tb => ({
    ...tb,
    count: documents.filter(tb.filterFn).length,
  }));

  const sortableHead = (field: string, label: string, extra = '') => (
    <TableHead
      className={`cursor-pointer hover:bg-muted ${extra}`}
      onClick={() => handleSort(field)}
    >
      {label}
      {sortMark(field)}
    </TableHead>
  );

  // Render table based on document type
  const renderTableHeaders = () => {
    switch (documentType) {
      case 'invoice':
      case 'credit':
        return (
          <TableRow>
            <TableHead>{t('DocumentListView.col.status')}</TableHead>
            {sortableHead('dueDate', t('DocumentListView.col.dueDate'))}
            {sortableHead(
              'number',
              documentType === 'credit'
                ? t('DocumentListView.col.stornoNumber')
                : t('DocumentListView.col.invoiceNumber'),
            )}
            <TableHead>{t('DocumentListView.col.customer')}</TableHead>
            {sortableHead('date', t('DocumentListView.col.date'))}
            {sortableHead('amount', t('DocumentListView.col.amountNet'), 'text-right')}
            <TableHead className="text-right">{t('DocumentListView.col.openGross')}</TableHead>
            <TableHead></TableHead>
          </TableRow>
        );
      case 'quote':
        return (
          <TableRow>
            <TableHead>{t('DocumentListView.col.status')}</TableHead>
            {sortableHead('number', t('DocumentListView.col.quoteNumber'))}
            <TableHead>{t('DocumentListView.col.customer')}</TableHead>
            <TableHead>{t('DocumentListView.col.property')}</TableHead>
            <TableHead>{t('DocumentListView.col.stay')}</TableHead>
            {sortableHead('date', t('DocumentListView.col.date'))}
            {sortableHead('validUntil', t('DocumentListView.col.validUntil'))}
            {sortableHead('amount', t('DocumentListView.col.amount'), 'text-right')}
            <TableHead></TableHead>
          </TableRow>
        );
      case 'order-confirmation':
        return (
          <TableRow>
            <TableHead>{t('DocumentListView.col.status')}</TableHead>
            {sortableHead('number', t('DocumentListView.col.confirmationNumber'))}
            <TableHead>{t('DocumentListView.col.customer')}</TableHead>
            {sortableHead('date', t('DocumentListView.col.date'))}
            {sortableHead('amount', t('DocumentListView.col.amount'), 'text-right')}
            <TableHead></TableHead>
          </TableRow>
        );
      case 'delivery-note':
        return (
          <TableRow>
            <TableHead>{t('DocumentListView.col.status')}</TableHead>
            {sortableHead('number', t('DocumentListView.col.deliveryNoteNumber'))}
            <TableHead>{t('DocumentListView.col.customer')}</TableHead>
            {sortableHead('date', t('DocumentListView.col.date'))}
            <TableHead>{t('DocumentListView.col.deliveryDate')}</TableHead>
            <TableHead>{t('DocumentListView.col.items')}</TableHead>
            <TableHead></TableHead>
          </TableRow>
        );
      case 'recurring-invoice':
        return (
          <TableRow>
            <TableHead>{t('DocumentListView.col.status')}</TableHead>
            {sortableHead('number', t('DocumentListView.col.title'))}
            <TableHead>{t('DocumentListView.col.customer')}</TableHead>
            <TableHead>{t('DocumentListView.col.interval')}</TableHead>
            <TableHead>{t('DocumentListView.col.nextRun')}</TableHead>
            <TableHead className="text-right">{t('DocumentListView.col.amount')}</TableHead>
            <TableHead></TableHead>
          </TableRow>
        );
      case 'reminder':
        return (
          <TableRow>
            <TableHead>{t('DocumentListView.col.status')}</TableHead>
            <TableHead>{t('DocumentListView.col.reminderLevel')}</TableHead>
            {sortableHead('number', t('DocumentListView.col.reminderNumber'))}
            <TableHead>{t('DocumentListView.col.customer')}</TableHead>
            <TableHead>{t('DocumentListView.col.daysOverdue')}</TableHead>
            <TableHead className="text-right">{t('DocumentListView.col.claim')}</TableHead>
            <TableHead></TableHead>
          </TableRow>
        );
      default:
        return null;
    }
  };

  const renderTableRow = (doc: DocumentItem) => {
    switch (documentType) {
      case 'invoice':
      case 'credit':
        return (
          <TableRow key={doc.id}>
            <TableCell>{getStatusBadge(doc)}</TableCell>
            <TableCell>
              <span className={isOverdue(doc) ? 'text-destructive' : ''}>
                {getDueDateText(doc.dueDate, doc.status, t)}
              </span>
            </TableCell>
            <TableCell>{getDocumentNumber(doc, documentType, t)}</TableCell>
            <TableCell>{doc.customerName}</TableCell>
            <TableCell>{formatDate(doc.date || doc.issueDate || doc.createdAt, locale)}</TableCell>
            <TableCell className="text-right">
              {formatMoney(doc.amount || 0, doc.currency)}
            </TableCell>
            <TableCell className="text-right">
              {doc.status === 'paid'
                ? formatMoney(0, doc.currency)
                : formatMoney(doc.total || 0, doc.currency)}
            </TableCell>
            <TableCell>{renderActions(doc)}</TableCell>
          </TableRow>
        );
      case 'quote':
        return (
          <TableRow key={doc.id}>
            <TableCell>{getStatusBadge(doc)}</TableCell>
            <TableCell>{getDocumentNumber(doc, documentType, t)}</TableCell>
            <TableCell>{doc.customerName}</TableCell>
            <TableCell>{doc.propertyTitle || '–'}</TableCell>
            <TableCell className="whitespace-nowrap">{formatStay(doc.stayFrom, doc.stayTo, locale, n => t('DocumentListView.nights', { n }))}</TableCell>
            <TableCell>{formatDate(doc.date || doc.createdAt, locale)}</TableCell>
            <TableCell>
              <span className={isExpired(doc) ? 'font-medium text-destructive' : ''}>
                {formatDate(doc.validUntil || doc.dueDate, locale)}
              </span>
            </TableCell>
            <TableCell className="text-right">
              {formatMoney(doc.total || 0, doc.currency)}
            </TableCell>
            <TableCell>{renderActions(doc)}</TableCell>
          </TableRow>
        );
      case 'order-confirmation':
        return (
          <TableRow key={doc.id}>
            <TableCell>{getStatusBadge(doc)}</TableCell>
            <TableCell>{getDocumentNumber(doc, documentType, t)}</TableCell>
            <TableCell>{doc.customerName}</TableCell>
            <TableCell>{formatDate(doc.date || doc.createdAt, locale)}</TableCell>
            <TableCell className="text-right">
              {formatMoney(doc.total || 0, doc.currency)}
            </TableCell>
            <TableCell>{renderActions(doc)}</TableCell>
          </TableRow>
        );
      case 'delivery-note':
        return (
          <TableRow key={doc.id}>
            <TableCell>{getStatusBadge(doc)}</TableCell>
            <TableCell>{getDocumentNumber(doc, documentType, t)}</TableCell>
            <TableCell>{doc.customerName}</TableCell>
            <TableCell>{formatDate(doc.date || doc.createdAt, locale)}</TableCell>
            <TableCell>{formatDate(doc.deliveryDate, locale)}</TableCell>
            <TableCell>
              {t('DocumentListView.itemsCount', { count: doc.items?.length || 0 })}
            </TableCell>
            <TableCell>{renderActions(doc)}</TableCell>
          </TableRow>
        );
      case 'recurring-invoice': {
        const intervalLabels: Record<string, string> = {
          weekly: t('DocumentListView.interval.weekly'),
          monthly: t('DocumentListView.interval.monthly'),
          quarterly: t('DocumentListView.interval.quarterly'),
          yearly: t('DocumentListView.interval.yearly'),
        };
        return (
          <TableRow key={doc.id}>
            <TableCell>{getStatusBadge(doc)}</TableCell>
            <TableCell>{doc.title || getDocumentNumber(doc, documentType, t)}</TableCell>
            <TableCell>{doc.customerName}</TableCell>
            <TableCell>
              {intervalLabels[doc.recurringInterval || ''] || doc.recurringInterval}
            </TableCell>
            <TableCell>{formatDate(doc.recurringNextExecutionDate, locale)}</TableCell>
            <TableCell className="text-right">
              {formatMoney(doc.total || 0, doc.currency)}
            </TableCell>
            <TableCell>{renderActions(doc)}</TableCell>
          </TableRow>
        );
      }
      case 'reminder': {
        return (
          <TableRow key={doc.id}>
            <TableCell>{getStatusBadge(doc)}</TableCell>
            <TableCell>
              <Badge
                className={
                  doc.reminderLevel === 3 ? RED : doc.reminderLevel === 2 ? ORANGE : YELLOW
                }
              >
                {t('DocumentListView.reminderLevelLabel', { level: doc.reminderLevel || 1 })}
              </Badge>
            </TableCell>
            <TableCell>{getDocumentNumber(doc, documentType, t)}</TableCell>
            <TableCell>{doc.customerName}</TableCell>
            <TableCell className="text-destructive">
              {t('DocumentListView.daysCount', { days: doc.daysPastDue || 0 })}
            </TableCell>
            <TableCell className="text-right text-destructive">
              {formatMoney(doc.outstandingAmount || doc.total || 0, doc.currency)}
            </TableCell>
            <TableCell>{renderActions(doc)}</TableCell>
          </TableRow>
        );
      }
      default:
        return null;
    }
  };

  const renderActions = (doc: DocumentItem) => {
    return (
      <div className="flex items-center gap-1">
        {/* Quick action buttons */}
        {documentType === 'invoice' &&
          ['sent', 'finalized'].includes(doc.status) &&
          onMarkAsPaid && (
            <Button
              variant="ghost"
              size="sm"
              title={t('DocumentListView.action.markAsPaid')}
              onClick={() => onMarkAsPaid(doc)}
            >
              <Icon icon="lucide:dollar-sign" className="h-4 w-4" />
            </Button>
          )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" aria-label={t('DocumentListView.action.more')}>
              <Icon icon="lucide:more-horizontal" className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleView(doc)}>
              <Icon icon="lucide:eye" className="mr-2 h-4 w-4" />
              {t('DocumentListView.action.view')}
            </DropdownMenuItem>

            {doc.status === 'draft' && (
              <DropdownMenuItem onClick={() => handleEdit(doc)}>
                <Icon icon="lucide:edit" className="mr-2 h-4 w-4" />
                {t('DocumentListView.action.edit')}
              </DropdownMenuItem>
            )}

            {/* Quote specific actions */}
            {documentType === 'quote' && onDuplicate && (
              <DropdownMenuItem onClick={() => onDuplicate(doc)}>
                <Icon icon="lucide:copy" className="mr-2 h-4 w-4" />
                {t('DocumentListView.action.duplicate')}
              </DropdownMenuItem>
            )}

            {documentType === 'quote' && doc.status === 'accepted' && onConvertToInvoice && (
              <DropdownMenuItem onClick={() => onConvertToInvoice(doc)}>
                <Icon icon="lucide:file-text" className="mr-2 h-4 w-4" />
                {t('DocumentListView.action.convertToInvoice')}
              </DropdownMenuItem>
            )}

            {/* Delivery note specific actions */}
            {documentType === 'delivery-note' && doc.status === 'draft' && onMarkAsSent && (
              <DropdownMenuItem onClick={() => onMarkAsSent(doc)}>
                <Icon icon="lucide:truck" className="mr-2 h-4 w-4" />
                {t('DocumentListView.action.markAsSent')}
              </DropdownMenuItem>
            )}

            {documentType === 'delivery-note' && doc.status === 'sent' && onMarkAsDelivered && (
              <DropdownMenuItem onClick={() => onMarkAsDelivered(doc)}>
                <Icon icon="lucide:check-circle" className="mr-2 h-4 w-4" />
                {t('DocumentListView.action.markAsDelivered')}
              </DropdownMenuItem>
            )}

            {documentType === 'delivery-note' &&
              ['sent', 'delivered'].includes(doc.status) &&
              onConvertToInvoice && (
                <DropdownMenuItem onClick={() => onConvertToInvoice(doc)}>
                  <Icon icon="lucide:file-text" className="mr-2 h-4 w-4" />
                  {t('DocumentListView.action.convertToInvoiceShort')}
                </DropdownMenuItem>
              )}

            {/* Recurring invoice specific actions */}
            {documentType === 'recurring-invoice' &&
              doc.recurringStatus !== 'completed' &&
              onPauseResume && (
                <DropdownMenuItem onClick={() => onPauseResume(doc)}>
                  {doc.recurringStatus === 'active' ? (
                    <>
                      <Icon icon="lucide:pause" className="mr-2 h-4 w-4" />
                      {t('DocumentListView.action.pause')}
                    </>
                  ) : (
                    <>
                      <Icon icon="lucide:play" className="mr-2 h-4 w-4" />
                      {t('DocumentListView.action.resume')}
                    </>
                  )}
                </DropdownMenuItem>
              )}

            {/* Reminder specific actions */}
            {documentType === 'reminder' && doc.status === 'draft' && onSendEmail && (
              <DropdownMenuItem onClick={() => onSendEmail(doc)}>
                <Icon icon="lucide:send" className="mr-2 h-4 w-4" />
                {t('DocumentListView.action.send')}
              </DropdownMenuItem>
            )}

            {/* Invoice storno action */}
            {documentType === 'invoice' &&
              ['sent', 'paid'].includes(doc.status) &&
              !doc.isStorno &&
              onCreateStorno && (
                <DropdownMenuItem onClick={() => onCreateStorno(doc)}>
                  <Icon icon="lucide:x" className="mr-2 h-4 w-4" />
                  {t('DocumentListView.action.storno')}
                </DropdownMenuItem>
              )}

            {/* Email action */}
            {['sent', 'paid', 'finalized', 'delivered', 'draft', 'accepted'].includes(doc.status) &&
              onSendEmail &&
              documentType !== 'reminder' && (
                <DropdownMenuItem onClick={() => onSendEmail(doc)}>
                  <Icon icon="lucide:mail" className="mr-2 h-4 w-4" />
                  {t('DocumentListView.action.sendEmail')}
                </DropdownMenuItem>
              )}

            {/* Delete action */}
            {doc.status === 'draft' && onDelete && (
              <DropdownMenuItem className="text-destructive" onClick={() => onDelete(doc)}>
                <Icon icon="lucide:trash2" className="mr-2 h-4 w-4" />
                {t('DocumentListView.action.delete')}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex h-auto w-full p-1">
          {tabsWithCounts.map(tb => (
            <TabsTrigger
              key={tb.id}
              value={tb.id}
              className={`relative flex-1 ${tb.locked ? 'opacity-50' : ''}`}
              disabled={tb.locked}
            >
              {tb.label}
              {tb.count > 0 && (
                <span className="ml-1 rounded bg-muted px-1 text-muted-foreground text-xs">
                  {tb.count}
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
                {t('DocumentListView.filter')}
              </Button>
              <Button variant="outline" className="flex items-center gap-2">
                <Icon icon="lucide:download" className="h-4 w-4" />
                {t('DocumentListView.export')}
              </Button>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="space-y-4 rounded-lg bg-muted/50 p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <label className="font-medium text-sm">{t('DocumentListView.search')}</label>
                  <div className="relative">
                    <Icon
                      icon="lucide:search"
                      className="absolute top-3 left-3 h-4 w-4 text-muted-foreground"
                    />
                    <Input
                      placeholder={t('DocumentListView.searchPlaceholder')}
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="font-medium text-sm">{t('DocumentListView.contact')}</label>
                  <Select value={selectedContact} onValueChange={setSelectedContact}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('DocumentListView.allContacts')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('DocumentListView.allContacts')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="font-medium text-sm">{t('DocumentListView.amount')}</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder={t('DocumentListView.min')}
                      type="number"
                      value={minAmount}
                      onChange={e => setMinAmount(e.target.value)}
                    />
                    <Input
                      placeholder={t('DocumentListView.max')}
                      type="number"
                      value={maxAmount}
                      onChange={e => setMaxAmount(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="font-medium text-sm">{t('DocumentListView.startDate')}</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="font-medium text-sm">{t('DocumentListView.endDate')}</label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
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
                  }}
                >
                  {t('DocumentListView.reset')}
                </Button>
                <Button
                  className="bg-accent text-white hover:bg-accent/90"
                  onClick={() => setShowFilters(false)}
                >
                  {t('DocumentListView.apply')}
                </Button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="rounded-lg border">
            <Table>
              <TableHeader>{renderTableHeaders()}</TableHeader>
              <TableBody>
                {filteredDocuments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                      {t('DocumentListView.noneFound', { title: config.title })}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDocuments.map(doc => renderTableRow(doc))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
