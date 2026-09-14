'use client';

import { Icon } from '@iconify/react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@tasko/ui';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { currencySymbol, formatCurrency } from '@/lib/currency';
import { WAEHRUNGS_CODES } from '@/lib/steuer-waehrung';
import { type NumberSequence, NumberSequenceService } from '@/services/numberSequenceService';
import { validateVATNumber } from '@/utils/vatValidation';
import NewCategoryModal from './NewCategoryModal';

export interface ContactPerson {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  position?: string;
  department?: string;
  isPrimary: boolean;
}

interface Address {
  id: string;
  type: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
}

// Erweiterte Form-Daten Struktur basierend auf der Create-Page
interface ExtendedFormData {
  // Allgemeine Felder
  name: string;
  email: string;
  phone: string;
  // Person-spezifische Felder
  firstName: string;
  lastName: string;
  title: string; // Herr, Frau, Dr., etc.
  academicTitle: string; // MBA, M.Sc., etc.
  nameSuffix: string; // jun., sen., etc.
  position: string;
  // Organisation-spezifische Felder
  companyName: string;
  organizationType: string; // Kunde, Lieferant, Partner, Interessent
  customerNumber: string; // Automatisch generiert
  debitorNumber: string;
  creditorNumber: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
  taxNumber: string;
  vatId: string;
  vatValidated: boolean;
  website: string;
  notes: string;
  paymentTerms: string;
  discount: number;
  currency: string;
  language: string;
  companySize: string;
  industry: string;
  creditLimit: number;
  isSupplier: boolean;
  // Zahlungsinformationen
  bankName: string;
  iban: string;
  bic: string;
  accountHolder: string;
  preferredPaymentMethod: string;
  earlyPaymentDiscount: number;
  earlyPaymentDays: number;
  defaultInvoiceDueDate: number;
  reminderFee: number;
  lateFee: number;
  automaticReminders: boolean;
  // E-Rechnung
  eInvoiceEnabled: boolean;
  customerReference: string;
  leitwegId: string;
  // Tags
  tags: string[];
  // Adressen
  addresses: Address[];
}

type CustomerType = 'person' | 'organisation';
type SubTabType = 'overview' | 'contacts' | 'payment' | 'skonto';

// Tab Definitionen
interface TabDefinition {
  id: SubTabType;
  label: string;
  icon: any;
  count?: number | null;
}

export interface NewCustomerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: Partial<{
    name: string;
    firstName?: string;
    lastName?: string;
  }>;
  contactType?: 'organisation' | 'person';
  saving?: boolean;
  onSave?: (values: Record<string, unknown>) => Promise<void>;
  persistDirectly?: boolean;
  companyId: string; // Required für NumberSequenceService
  onSaved?: (customerId: string) => void;
}

const createDefaultAddress = (): Address => ({
  id: Math.random().toString(36).substr(2, 9),
  type: 'Arbeit',
  street: '',
  postalCode: '',
  city: '',
  country: 'Deutschland',
});

const DEFAULT_FORM_DATA: ExtendedFormData = {
  // Allgemeine Felder
  name: '',
  email: '',
  phone: '',
  // Person-spezifische Felder
  firstName: '',
  lastName: '',
  title: '', // Herr, Frau, Dr., etc.
  academicTitle: '', // MBA, M.Sc., etc.
  nameSuffix: '', // jun., sen., etc.
  position: '',
  // Organisation-spezifische Felder
  companyName: '',
  organizationType: 'Kunde', // Kunde, Lieferant, Partner, Interessent
  customerNumber: 'KD-001', // Automatisch generiert
  debitorNumber: '',
  creditorNumber: '',
  street: '',
  city: '',
  postalCode: '',
  country: 'Deutschland',
  taxNumber: '',
  vatId: '',
  vatValidated: false,
  website: '',
  notes: '',
  paymentTerms: '30 Tage netto',
  discount: 0,
  // Wurzel 4: keine erfundene EUR-Vorgabe. Leer starten — die Anzeige rendert
  // symbollos (currencySymbol/formatCurrency), und die Belegwährung/Auswahl
  // füllt das Feld, sobald sie bekannt ist.
  currency: '',
  language: 'de',
  companySize: '',
  industry: '',
  creditLimit: 0,
  isSupplier: false,
  // Zahlungsinformationen
  bankName: '',
  iban: '',
  bic: '',
  accountHolder: '',
  preferredPaymentMethod: 'Überweisung',
  earlyPaymentDiscount: 0,
  earlyPaymentDays: 14,
  defaultInvoiceDueDate: 30,
  reminderFee: 5.0,
  lateFee: 0,
  automaticReminders: true,
  // E-Rechnung
  eInvoiceEnabled: true,
  customerReference: '00',
  leitwegId: '',
  // Tags
  tags: [],
  // Adressen
  addresses: [createDefaultAddress()],
};

const COUNTRY_OPTIONS = [
  'Deutschland',
  'Österreich',
  'Schweiz',
  'Niederlande',
  'Belgien',
  'Frankreich',
  'Italien',
  'Spanien',
  'Polen',
  'Tschechien',
  'Ungarn',
  'Slowenien',
  'Kroatien',
  'USA',
  'Andere',
];

// Tooltip-Komponente in NextDays-Design mit intelligenter Positionierung
const TooltipIcon = ({ text, icon: iconName = 'lucide:info' }: { text: string; icon?: string }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [position, setPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('top');
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleMouseEnter = () => {
    setShowTooltip(true);

    // Intelligente Positionierung basierend auf Viewport
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const _viewportHeight = window.innerHeight;

      // Bestimme beste Position
      if (rect.right + 256 > viewportWidth) {
        setPosition('left');
      } else if (rect.left - 256 < 0) {
        setPosition('right');
      } else if (rect.top - 100 < 0) {
        setPosition('bottom');
      } else {
        setPosition('top');
      }
    }
  };

  const getTooltipClasses = () => {
    const baseClasses =
      'absolute z-50 w-64 p-3 text-sm bg-gray-900 text-white rounded-lg shadow-xl border border-gray-700';

    switch (position) {
      case 'top':
        return `${baseClasses} bottom-full left-1/2 transform -translate-x-1/2 mb-2`;
      case 'bottom':
        return `${baseClasses} top-full left-1/2 transform -translate-x-1/2 mt-2`;
      case 'left':
        return `${baseClasses} right-full top-1/2 transform -translate-y-1/2 mr-2`;
      case 'right':
        return `${baseClasses} left-full top-1/2 transform -translate-y-1/2 ml-2`;
      default:
        return `${baseClasses} bottom-full left-1/2 transform -translate-x-1/2 mb-2`;
    }
  };

  const getArrowClasses = () => {
    const baseArrow = 'absolute w-2 h-2 bg-gray-900 transform rotate-45';

    switch (position) {
      case 'top':
        return `${baseArrow} top-full left-1/2 -translate-x-1/2 -mt-1`;
      case 'bottom':
        return `${baseArrow} bottom-full left-1/2 -translate-x-1/2 -mb-1`;
      case 'left':
        return `${baseArrow} left-full top-1/2 -translate-y-1/2 -ml-1`;
      case 'right':
        return `${baseArrow} right-full top-1/2 -translate-y-1/2 -mr-1`;
      default:
        return `${baseArrow} top-full left-1/2 -translate-x-1/2 -mt-1`;
    }
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        className="rounded-full p-1 text-accent transition-colors hover:bg-accent/10 hover:text-accent/90"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <Icon icon={iconName} className="h-4 w-4" />
      </button>
      {showTooltip && (
        <div className={getTooltipClasses()}>
          <div className="relative">
            {text}
            <div className={getArrowClasses()}></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function NewCustomerModal({
  open,
  onOpenChange,
  defaultValues,
  contactType = 'organisation',
  saving,
  onSave,
  persistDirectly,
  companyId,
  onSaved,
}: NewCustomerModalProps) {
  const t = useTranslations('finance');
  // State Management
  const [loading, setLoading] = useState(false);
  const [customerType, setCustomerType] = useState<CustomerType>(
    contactType === 'person' ? 'person' : 'organisation',
  );
  const [activeSubTab, setActiveSubTab] = useState<SubTabType>('overview');
  const [formData, setFormData] = useState<ExtendedFormData>(DEFAULT_FORM_DATA);
  const [contacts, setContacts] = useState<ContactPerson[]>([]);
  // Leer, bis der Server die Vorschau liefert — keine erfundene 'KD-001' (Wurzel 4).
  const [_nextCustomerNumber, setNextCustomerNumber] = useState('');
  const [_currentNumberSequence, _setCurrentNumberSequence] = useState<NumberSequence | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  // Eigene Kundenkategorien: es gibt im Backend noch keinen Endpunkt dafür (der
  // frühere Aufruf auf /api/v1/categories lief immer in einen 404). Bis dahin
  // bleibt die Liste leer; die fest definierten Kategorien darunter greifen.
  const [customCategories] = useState<
    Array<{ id: string; name: string; categoryType: string }>
  >([]);
  const [referenceFieldType, setReferenceFieldType] = useState<'customerReference' | 'leitwegId'>(
    'customerReference',
  );

  const [newTag, setNewTag] = useState('');
  const [_showTypeDropdown, setShowTypeDropdown] = useState(false);

  // Refs for outside click detection
  const typeDropdownRef = useRef<HTMLDivElement>(null);

  // Tab Definitionen - nur relevante Tabs für neue Kunden
  const tabs: TabDefinition[] = [
    { id: 'overview', label: t('NewCustomerModal.tabOverview'), icon: 'lucide:file-text', count: null },
    { id: 'contacts', label: t('NewCustomerModal.tabContacts'), icon: 'lucide:users', count: contacts.length },
    {
      id: 'payment',
      label: t('NewCustomerModal.tabPayment'),
      icon: 'lucide:credit-card',
      count: null,
    },
    {
      id: 'skonto',
      label: t('NewCustomerModal.tabSkonto'),
      icon: 'lucide:calculator',
      count: null,
    },
  ];

  // Generate next customer number using NumberSequenceService
  // Stabil und VOR generateNextCustomerNumber definiert: nur so kann die
  // Nummern-Generierung sie als Dependency führen (const wird nicht gehoistet).
  const handleInputChange = useCallback(
    (field: string, value: string | number | boolean | string[]) => {
      setFormData(prev => ({
        ...prev,
        [field]: value,
      }));
    },
    [],
  );

  // Vorschau der nächsten Kundennummer. Die endgültige Nummer vergibt der
  // Server beim Speichern — schickt das Modal genau diese Vorschau mit, zieht
  // er atomar die nächste; ändert der Nutzer sie von Hand, bleibt seine.
  //
  // Bis zum 11.09.2026 standen hier ZWEI Ersatzwert-Zweige, die aus der Uhrzeit
  // eine Kundennummer bauten (`KD-091119`), sobald der Server nicht antwortete
  // oder den Typ nicht kannte — und er kannte ihn nie, weil die Antwort eine
  // andere Form hatte. Kein Ersatzwert mehr (Wurzel 4): Fehlt die Vorschau,
  // bleibt das Feld leer und der Server vergibt beim Speichern.
  const generateNextCustomerNumber = useCallback(async () => {
    if (!companyId) return;
    try {
      const result = await NumberSequenceService.getNextNumberForType(companyId, 'Kunde');
      setNextCustomerNumber(result.formattedNumber);
      handleInputChange('customerNumber', result.formattedNumber);
    } catch (error) {
      console.error('Vorschau der Kundennummer nicht verfügbar:', error);
      setNextCustomerNumber('');
      handleInputChange('customerNumber', '');
      toast.error(t('NewCustomerModal.numberGenerationError', { type: 'Kunde' }));
    }
  }, [companyId, handleInputChange, t]);

  useEffect(() => {
    if (open) {
      void generateNextCustomerNumber();
    }
  }, [open, generateNextCustomerNumber]);

  // Separater Effect für Form-Daten basierend auf defaultValues - NUR beim ersten Öffnen
  const [defaultValuesApplied, setDefaultValuesApplied] = useState(false);

  useEffect(() => {
    if (open && defaultValues && !defaultValuesApplied) {
      setFormData(prev => {
        const updates: Partial<ExtendedFormData> = {};

        if (defaultValues.name) {
          if (customerType === 'person') {
            if (defaultValues.firstName) {
              updates.firstName = defaultValues.firstName;
            }
            if (defaultValues.lastName) {
              updates.lastName = defaultValues.lastName;
            }
            if (!defaultValues.firstName && !defaultValues.lastName) {
              const nameParts = defaultValues.name.split(' ');
              updates.firstName = nameParts[0] || '';
              updates.lastName = nameParts.slice(1).join(' ') || '';
            }
          } else {
            updates.companyName = defaultValues.name;
          }
        }

        // Behalte bestehende Werte bei, überschreibe nur Name-Felder
        return {
          ...prev,
          ...updates,
        };
      });
      setDefaultValuesApplied(true);
    }

    // Reset flag wenn Modal geschlossen wird
    if (!open && defaultValuesApplied) {
      setDefaultValuesApplied(false);
    }
  }, [
    open,
    defaultValues?.name,
    defaultValues?.firstName,
    defaultValues?.lastName,
    customerType,
    defaultValuesApplied,
    defaultValues,
  ]);

  // Input Handler
  // Update isSupplier and customer number when organizationType changes
  useEffect(() => {
    const isSupplier = formData.organizationType === 'Lieferant';

    setFormData(prev => ({
      ...prev,
      isSupplier: isSupplier,
    }));

    // Generate appropriate number sequence based on organizationType
    const currentPrefix = formData.customerNumber.split('-')[0];
    const expectedPrefix = {
      Kunde: 'KD',
      Lieferant: 'LF',
      Partner: 'PA',
      Interessenten: 'IN',
    }[formData.organizationType];

    if (expectedPrefix && currentPrefix !== expectedPrefix) {
      generateNumberForType(formData.organizationType);
    }
    // Nur auf organizationType reagieren. Die frühere Dependency
    // `formData.customerNumber.split` (Methodenreferenz) + die nicht-memoized
    // Funktion lösten unter React 19 eine Render-Endlosschleife aus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.organizationType]);

  // Generate number for any organization type
  async function generateNumberForType(type: string) {
    try {
      if (!companyId) {
        console.error('❌ Keine gültige Company-ID verfügbar');
        return;
      }

      // Vorschau für den gewählten Typ; der Server kennt alle vier Kreise.
      const result = await NumberSequenceService.getNextNumberForType(companyId, type);
      setFormData(prev => ({
        ...prev,
        customerNumber: result.formattedNumber,
      }));
    } catch (error) {
      console.error(`❌ Fehler beim Generieren der ${type}-Nummer:`, error);
      toast.error(t('NewCustomerModal.numberGenerationError', { type }));
    }
  }


  // VAT Validation
  const validateVAT = async () => {
    if (!formData.vatId.trim()) return;

    try {
      const result = await validateVATNumber(formData.vatId);
      // Extract boolean from result if it's an object, otherwise use as boolean
      const isValid = typeof result === 'boolean' ? result : result?.isValid || false;

      setFormData(prev => ({
        ...prev,
        vatValidated: isValid,
      }));

      if (isValid) {
        toast.success(t('NewCustomerModal.vatValidatedSuccess'));
      } else {
        toast.error(t('NewCustomerModal.vatValidatedFailure'));
      }
    } catch (error) {
      console.error('VAT validation error:', error);
      toast.error(t('NewCustomerModal.vatValidationError'));
      // Set to false on error
      setFormData(prev => ({
        ...prev,
        vatValidated: false,
      }));
    }
  };

  // Tag Management
  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()],
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove),
    }));
  };

  // Contact Management
  const addContact = () => {
    const newContact: ContactPerson = {
      id: Math.random().toString(36).substr(2, 9),
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      position: '',
      department: '',
      isPrimary: contacts.length === 0,
    };
    setContacts(prev => [...prev, newContact]);
  };

  const updateContact = (
    contactId: string,
    field: keyof ContactPerson,
    value: string | boolean,
  ) => {
    setContacts(prev =>
      prev.map(contact => (contact.id === contactId ? { ...contact, [field]: value } : contact)),
    );
  };

  const removeContact = (contactId: string) => {
    setContacts(prev => {
      const updated = prev.filter(contact => contact.id !== contactId);
      // If we removed the primary contact, make the first remaining contact primary
      if (updated.length > 0 && !updated.some(c => c.isPrimary)) {
        updated[0].isPrimary = true;
      }
      return updated;
    });
  };

  const _addAddress = () => {
    const newAddress = createDefaultAddress();
    setFormData(prev => ({
      ...prev,
      addresses: [...prev.addresses, newAddress],
    }));
  };

  const _updateAddress = (addressId: string, field: keyof Address, value: string) => {
    setFormData(prev => ({
      ...prev,
      addresses: prev.addresses.map(addr =>
        addr.id === addressId ? { ...addr, [field]: value } : addr,
      ),
    }));
  };

  const _removeAddress = (addressId: string) => {
    setFormData(prev => ({
      ...prev,
      addresses: prev.addresses.filter(addr => addr.id !== addressId),
    }));
  };

  // Validation
  const isValid = () => {
    if (customerType === 'person') {
      return (
        formData.firstName.trim() && formData.lastName.trim() && formData.customerNumber.trim()
      );
    } else {
      return formData.companyName.trim() && formData.customerNumber.trim();
    }
  };

  // Outside click handler for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target as Node)) {
        setShowTypeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] w-full max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-semibold text-gray-900 text-xl">
            {customerType === 'person'
              ? t('NewCustomerModal.titlePerson')
              : t('NewCustomerModal.titleOrganisation')}
          </DialogTitle>
          <DialogDescription>
            {customerType === 'person'
              ? t('NewCustomerModal.descriptionPerson')
              : t('NewCustomerModal.descriptionOrganisation')}
          </DialogDescription>
        </DialogHeader>

        {/* Customer Type Toggle */}
        <div className="flex items-center gap-4 rounded-lg bg-gray-50 p-4">
          <Label className="font-medium text-gray-700 text-sm">
            {t('NewCustomerModal.typeLabel')}
          </Label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCustomerType('person')}
              className={`flex items-center gap-2 rounded-md px-4 py-2 font-medium text-sm transition-all ${
                customerType === 'person'
                  ? 'bg-accent text-white shadow-sm'
                  : 'border border-gray-200 bg-white text-gray-600 hover:text-gray-800'
              }`}
            >
              <Icon icon="lucide:user" className="h-4 w-4" />
              {t('NewCustomerModal.typePerson')}
            </button>
            <button
              type="button"
              onClick={() => setCustomerType('organisation')}
              className={`flex items-center gap-2 rounded-md px-4 py-2 font-medium text-sm transition-all ${
                customerType === 'organisation'
                  ? 'bg-accent text-white shadow-sm'
                  : 'border border-gray-200 bg-white text-gray-600 hover:text-gray-800'
              }`}
            >
              <Icon icon="lucide:building-2" className="h-4 w-4" />
              {t('NewCustomerModal.typeOrganisation')}
            </button>
          </div>
        </div>

        {/* Sub-Tab Navigation */}
        <div className="flex border-gray-200 border-b">
          {tabs.map(tab => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex items-center gap-2 border-b-2 px-6 py-3 font-medium text-sm transition-colors ${
                  activeSubTab === tab.id
                    ? 'border-accent text-accent'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <IconComponent className="h-4 w-4" />
                {tab.label}
                {typeof tab.count === 'number' && tab.count > 0 && (
                  <span className="ml-1 rounded-full bg-gray-100 px-2 py-1 text-gray-600 text-xs">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-6 space-y-6">
          {/* Overview Tab - Grunddaten */}
          {activeSubTab === 'overview' && (
            <div className="space-y-6">
              {customerType === 'person' ? (
                /* Person Form */
                <div className="space-y-6">
                  {/* Persönliche Informationen */}
                  <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                    {/* Left Column */}
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>{t('NewCustomerModal.salutationLabel')}</Label>
                          <Select
                            value={formData.title}
                            onValueChange={val => handleInputChange('title', val)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t('NewCustomerModal.salutationPlaceholder')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Herr">{t('NewCustomerModal.salutationMr')}</SelectItem>
                              <SelectItem value="Frau">{t('NewCustomerModal.salutationMs')}</SelectItem>
                              <SelectItem value="Divers">{t('NewCustomerModal.salutationDiverse')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>{t('NewCustomerModal.academicTitleLabel')}</Label>
                          <Input
                            value={formData.academicTitle}
                            onChange={e => handleInputChange('academicTitle', e.target.value)}
                            placeholder={t('NewCustomerModal.academicTitlePlaceholder')}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>{t('NewCustomerModal.firstNameLabel')}</Label>
                          <Input
                            value={formData.firstName}
                            onChange={e => handleInputChange('firstName', e.target.value)}
                            placeholder={t('NewCustomerModal.firstNamePlaceholder')}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('NewCustomerModal.lastNameLabel')}</Label>
                          <Input
                            value={formData.lastName}
                            onChange={e => handleInputChange('lastName', e.target.value)}
                            placeholder={t('NewCustomerModal.lastNamePlaceholder')}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>{t('NewCustomerModal.nameSuffixLabel')}</Label>
                        <Input
                          value={formData.nameSuffix}
                          onChange={e => handleInputChange('nameSuffix', e.target.value)}
                          placeholder={t('NewCustomerModal.nameSuffixPlaceholder')}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>{t('NewCustomerModal.positionLabel')}</Label>
                        <Input
                          value={formData.position}
                          onChange={e => handleInputChange('position', e.target.value)}
                          placeholder={t('NewCustomerModal.positionPlaceholder')}
                        />
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label>{t('NewCustomerModal.emailLabel')}</Label>
                            <TooltipIcon
                              text={t('NewCustomerModal.emailTooltip')}
                              icon={'lucide:mail'}
                            />
                          </div>
                          <Input
                            type="email"
                            value={formData.email}
                            onChange={e => handleInputChange('email', e.target.value)}
                            placeholder={t('NewCustomerModal.emailPersonPlaceholder')}
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label>{t('NewCustomerModal.phoneLabel')}</Label>
                            <TooltipIcon
                              text={t('NewCustomerModal.phoneTooltip')}
                              icon={'lucide:phone'}
                            />
                          </div>
                          <Input
                            value={formData.phone}
                            onChange={e => handleInputChange('phone', e.target.value)}
                            placeholder={t('NewCustomerModal.phonePlaceholder')}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label>{t('NewCustomerModal.websiteLabel')}</Label>
                          <TooltipIcon
                            text={t('NewCustomerModal.websiteTooltip')}
                            icon={'lucide:globe'}
                          />
                        </div>
                        <Input
                          type="url"
                          value={formData.website}
                          onChange={e => handleInputChange('website', e.target.value)}
                          placeholder={t('NewCustomerModal.websitePersonPlaceholder')}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Notizen - außerhalb des Grids für volle Breite */}
                  <div className="space-y-2">
                    <Label>{t('NewCustomerModal.notesLabel')}</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={e => handleInputChange('notes', e.target.value)}
                      placeholder={t('NewCustomerModal.notesPersonPlaceholder')}
                      rows={3}
                    />
                  </div>
                </div>
              ) : (
                /* Organisation Form */
                <div className="space-y-6">
                  {/* Firmeninformationen */}
                  <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                    {/* Left Column */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>{t('NewCustomerModal.companyNameLabel')}</Label>
                        <Input
                          value={formData.companyName}
                          onChange={e => handleInputChange('companyName', e.target.value)}
                          placeholder={t('NewCustomerModal.companyNamePlaceholder')}
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>{t('NewCustomerModal.companySizeLabel')}</Label>
                          <Select
                            value={formData.companySize}
                            onValueChange={val => handleInputChange('companySize', val)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t('NewCustomerModal.companySizePlaceholder')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Klein (1-10)">
                                {t('NewCustomerModal.companySizeSmall')}
                              </SelectItem>
                              <SelectItem value="Mittel (11-50)">
                                {t('NewCustomerModal.companySizeMedium')}
                              </SelectItem>
                              <SelectItem value="Groß (51-250)">
                                {t('NewCustomerModal.companySizeLarge')}
                              </SelectItem>
                              <SelectItem value="Konzern (250+)">
                                {t('NewCustomerModal.companySizeEnterprise')}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>{t('NewCustomerModal.industryLabel')}</Label>
                          <Input
                            value={formData.industry}
                            onChange={e => handleInputChange('industry', e.target.value)}
                            placeholder={t('NewCustomerModal.industryPlaceholder')}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>{t('NewCustomerModal.websiteLabel')}</Label>
                        <Input
                          type="url"
                          value={formData.website}
                          onChange={e => handleInputChange('website', e.target.value)}
                          placeholder={t('NewCustomerModal.websiteOrgPlaceholder')}
                        />
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>{t('NewCustomerModal.emailLabel')}</Label>
                          <Input
                            type="email"
                            value={formData.email}
                            onChange={e => handleInputChange('email', e.target.value)}
                            placeholder={t('NewCustomerModal.emailOrgPlaceholder')}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('NewCustomerModal.phoneLabel')}</Label>
                          <Input
                            value={formData.phone}
                            onChange={e => handleInputChange('phone', e.target.value)}
                            placeholder={t('NewCustomerModal.phonePlaceholder')}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>
                          {t('NewCustomerModal.creditLimitLabel', {
                            symbol: currencySymbol(formData.currency),
                          })}
                        </Label>
                        <Input
                          type="number"
                          value={formData.creditLimit}
                          onChange={e => handleInputChange('creditLimit', Number(e.target.value))}
                          placeholder="10000"
                          min="0"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>{t('NewCustomerModal.languageLabel')}</Label>
                        <Select
                          value={formData.language}
                          onValueChange={val => handleInputChange('language', val)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t('NewCustomerModal.languagePlaceholder')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="de">{t('NewCustomerModal.languageDe')}</SelectItem>
                            <SelectItem value="en">{t('NewCustomerModal.languageEn')}</SelectItem>
                            <SelectItem value="fr">{t('NewCustomerModal.languageFr')}</SelectItem>
                            <SelectItem value="es">{t('NewCustomerModal.languageEs')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Notizen - außerhalb des Grids für volle Breite */}
                  <div className="space-y-2">
                    <Label>{t('NewCustomerModal.notesLabel')}</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={e => handleInputChange('notes', e.target.value)}
                      placeholder={t('NewCustomerModal.notesOrgPlaceholder')}
                      rows={3}
                    />
                  </div>
                </div>
              )}

              {/* Gemeinsame Felder */}
              <div className="space-y-6 border-t pt-6">
                {/* Nummern und Typ */}
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{t('NewCustomerModal.customerNumberLabel')}</Label>
                        <Input
                          value={formData.customerNumber}
                          onChange={e => handleInputChange('customerNumber', e.target.value)}
                          placeholder="KD-001"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('NewCustomerModal.contactTypeLabel')}</Label>
                        <div className="relative" ref={typeDropdownRef}>
                          <Select
                            value={formData.organizationType}
                            onValueChange={(val: string) => {
                              if (val === 'create-category') {
                                setShowCategoryModal(true);
                              } else {
                                handleInputChange('organizationType', val);
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t('NewCustomerModal.contactTypePlaceholder')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Kunde">{t('NewCustomerModal.contactTypeCustomer')}</SelectItem>
                              <SelectItem value="Lieferant">{t('NewCustomerModal.contactTypeSupplier')}</SelectItem>
                              <SelectItem value="Partner">{t('NewCustomerModal.contactTypePartner')}</SelectItem>
                              <SelectItem value="Interessenten">{t('NewCustomerModal.contactTypeProspect')}</SelectItem>
                              {customCategories.map(category => (
                                <SelectItem key={category.id} value={category.categoryType}>
                                  {category.name} ({category.categoryType})
                                </SelectItem>
                              ))}
                              <SelectItem
                                value="create-category"
                                className="border-t font-medium text-accent"
                              >
                                {t('NewCustomerModal.createCategoryOption')}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Buchhaltungsnummern */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label>{t('NewCustomerModal.debitorNumberLabel')}</Label>
                          <TooltipIcon
                            text={t('NewCustomerModal.debitorNumberTooltip')}
                            icon={'lucide:calculator'}
                          />
                        </div>
                        <Input
                          value={formData.debitorNumber}
                          onChange={e => handleInputChange('debitorNumber', e.target.value)}
                          placeholder="DEB001"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label>{t('NewCustomerModal.creditorNumberLabel')}</Label>
                          <TooltipIcon
                            text={t('NewCustomerModal.creditorNumberTooltip')}
                            icon={'lucide:building2'}
                          />
                        </div>
                        <Input
                          value={formData.creditorNumber}
                          onChange={e => handleInputChange('creditorNumber', e.target.value)}
                          placeholder="KRE001"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Adresse */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-gray-900 text-lg">
                      {t('NewCustomerModal.addressHeading')}
                    </h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label>{t('NewCustomerModal.streetLabel')}</Label>
                          <TooltipIcon
                            text={t('NewCustomerModal.streetTooltip')}
                            icon={'lucide:map-pin'}
                          />
                        </div>
                        <Input
                          value={formData.street}
                          onChange={e => handleInputChange('street', e.target.value)}
                          placeholder={t("NewCustomerModal.streetPlaceholder")}
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label>{t('NewCustomerModal.postalCodeLabel')}</Label>
                          <Input
                            value={formData.postalCode}
                            onChange={e => handleInputChange('postalCode', e.target.value)}
                            placeholder="12345"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('NewCustomerModal.cityLabel')}</Label>
                          <Input
                            value={formData.city}
                            onChange={e => handleInputChange('city', e.target.value)}
                            placeholder="Musterstadt"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('NewCustomerModal.countryLabel')}</Label>
                          <Select
                            value={formData.country}
                            onValueChange={val => handleInputChange('country', val)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-72">
                              {COUNTRY_OPTIONS.map(country => (
                                <SelectItem key={country} value={country}>
                                  {country}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Steuerliche Informationen */}
                <div className="space-y-4 border-t pt-6">
                  <h3 className="font-medium text-gray-900 text-lg">
                    {t('NewCustomerModal.taxInfoHeading')}
                  </h3>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex min-h-8 items-center gap-2">
                        <Label>{t('NewCustomerModal.taxNumberLabel')}</Label>
                        <TooltipIcon
                          text={t('NewCustomerModal.taxNumberTooltip')}
                          icon={'lucide:receipt'}
                        />
                      </div>
                      <Input
                        value={formData.taxNumber}
                        onChange={e => handleInputChange('taxNumber', e.target.value)}
                        placeholder="12345/67890"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex min-h-8 items-center gap-2">
                        <Label>{t('NewCustomerModal.vatIdLabel')}</Label>
                        <TooltipIcon
                          text={t('NewCustomerModal.vatIdTooltip')}
                          icon={'lucide:calculator'}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={validateVAT}
                          className="h-6 px-2 text-xs"
                        >
                          {t('NewCustomerModal.vatCheckButton')}
                        </Button>
                        {formData.vatValidated && (
                          <Icon icon="lucide:check" className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                      <Input
                        value={formData.vatId}
                        onChange={e => handleInputChange('vatId', e.target.value)}
                        placeholder="DE123456789"
                      />
                    </div>
                  </div>
                </div>

                {/* E-Rechnung */}
                <div className="space-y-4 border-t pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Label>{t('NewCustomerModal.eInvoiceLabel')}</Label>
                      <TooltipIcon text={t('NewCustomerModal.eInvoiceTooltip')} />
                      <button
                        type="button"
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 ${
                          formData.eInvoiceEnabled ? 'bg-accent' : 'bg-gray-200'
                        }`}
                        onClick={() =>
                          handleInputChange('eInvoiceEnabled', !formData.eInvoiceEnabled)
                        }
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            formData.eInvoiceEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {formData.eInvoiceEnabled && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-3">
                          <Label className="flex items-center gap-2">
                            {referenceFieldType === 'customerReference'
                              ? t('NewCustomerModal.customerReferenceLabel')
                              : t('NewCustomerModal.leitwegIdLabel')}
                            <TooltipIcon
                              text={
                                referenceFieldType === 'customerReference'
                                  ? t('NewCustomerModal.customerReferenceTooltip')
                                  : t('NewCustomerModal.leitwegIdTooltip')
                              }
                            />
                          </Label>
                          <button
                            type="button"
                            className="font-medium text-accent text-sm hover:text-accent/90"
                            onClick={() =>
                              setReferenceFieldType(
                                referenceFieldType === 'customerReference'
                                  ? 'leitwegId'
                                  : 'customerReference',
                              )
                            }
                          >
                            {referenceFieldType === 'customerReference'
                              ? t('NewCustomerModal.switchToLeitwegId')
                              : t('NewCustomerModal.switchToCustomerReference')}
                          </button>
                        </div>
                        <Input
                          value={
                            referenceFieldType === 'customerReference'
                              ? formData.customerReference
                              : formData.leitwegId
                          }
                          onChange={e =>
                            handleInputChange(
                              referenceFieldType === 'customerReference'
                                ? 'customerReference'
                                : 'leitwegId',
                              e.target.value,
                            )
                          }
                          placeholder={
                            referenceFieldType === 'customerReference' ? '00' : '991-12345-12'
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div className="space-y-4 border-t pt-6">
                  <Label>{t('NewCustomerModal.tagsLabel')}</Label>
                  <div className="space-y-2">
                    {formData.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {formData.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-sm text-white"
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => removeTag(tag)}
                              className="rounded-full p-0.5 hover:bg-white/20"
                            >
                              <Icon icon="lucide:x" className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Input
                        value={newTag}
                        onChange={e => setNewTag(e.target.value)}
                        placeholder={t('NewCustomerModal.newTagPlaceholder')}
                        onKeyPress={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addTag();
                          }
                        }}
                      />

                      <Button
                        type="button"
                        variant="outline"
                        onClick={addTag}
                        disabled={!newTag.trim()}
                      >
                        <Icon icon="lucide:plus" className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Contacts Tab */}
          {activeSubTab === 'contacts' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900 text-lg">
                  {t('NewCustomerModal.contactPersonsHeading')}
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addContact}
                  className="flex items-center gap-2"
                >
                  <Icon icon="lucide:plus" className="h-4 w-4" />
                  {t('NewCustomerModal.addContactButton')}
                </Button>
              </div>

              {contacts.length === 0 ? (
                <div className="rounded-lg bg-gray-50 py-12 text-center">
                  <Icon icon="lucide:users" className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                  <p className="text-gray-500">{t('NewCustomerModal.noContactsYet')}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addContact}
                    className="mt-4"
                  >
                    {t('NewCustomerModal.addFirstContactButton')}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {contacts.map((contact, index) => (
                    <div key={contact.id} className="space-y-4 rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <h4 className="flex items-center gap-2 font-medium">
                          {t('NewCustomerModal.contactIndex', { index: index + 1 })}
                          {contact.isPrimary && (
                            <span className="rounded-full bg-accent px-2 py-1 text-white text-xs">
                              {t('NewCustomerModal.primaryContactBadge')}
                            </span>
                          )}
                        </h4>
                        <div className="flex items-center gap-2">
                          {!contact.isPrimary && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setContacts(prev =>
                                  prev.map(c => ({ ...c, isPrimary: c.id === contact.id })),
                                );
                              }}
                            >
                              {t('NewCustomerModal.setAsPrimaryButton')}
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeContact(contact.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Icon icon="lucide:x" className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>{t('NewCustomerModal.firstNameLabel')}</Label>
                          <Input
                            value={contact.firstName}
                            onChange={e => updateContact(contact.id, 'firstName', e.target.value)}
                            placeholder={t('NewCustomerModal.firstNamePlaceholder')}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('NewCustomerModal.lastNameLabel')}</Label>
                          <Input
                            value={contact.lastName}
                            onChange={e => updateContact(contact.id, 'lastName', e.target.value)}
                            placeholder={t('NewCustomerModal.lastNamePlaceholder')}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('NewCustomerModal.emailLabel')}</Label>
                          <Input
                            type="email"
                            value={contact.email}
                            onChange={e => updateContact(contact.id, 'email', e.target.value)}
                            placeholder={t('NewCustomerModal.emailPersonPlaceholder')}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('NewCustomerModal.phoneLabel')}</Label>
                          <Input
                            value={contact.phone || ''}
                            onChange={e => updateContact(contact.id, 'phone', e.target.value)}
                            placeholder={t('NewCustomerModal.phonePlaceholder')}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('NewCustomerModal.positionLabel')}</Label>
                          <Input
                            value={contact.position || ''}
                            onChange={e => updateContact(contact.id, 'position', e.target.value)}
                            placeholder={t('NewCustomerModal.positionPlaceholder')}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('NewCustomerModal.departmentLabel')}</Label>
                          <Input
                            value={contact.department || ''}
                            onChange={e => updateContact(contact.id, 'department', e.target.value)}
                            placeholder={t('NewCustomerModal.departmentPlaceholder')}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Payment Tab */}
          {activeSubTab === 'payment' && (
            <div className="space-y-6">
              <h3 className="font-medium text-gray-900 text-lg">
                {t('NewCustomerModal.paymentInfoHeading')}
              </h3>

              {/* Zahlungsbedingungen */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>{t('NewCustomerModal.paymentTermsLabel')}</Label>
                      <TooltipIcon
                        text={t('NewCustomerModal.paymentTermsTooltip')}
                        icon={'lucide:clock'}
                      />
                    </div>
                    <Select
                      value={formData.paymentTerms}
                      onValueChange={val => handleInputChange('paymentTerms', val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('NewCustomerModal.paymentTermsPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sofort">{t('NewCustomerModal.paymentTermsImmediate')}</SelectItem>
                        <SelectItem value="7 Tage netto">
                          {t('NewCustomerModal.paymentTerms7Days')}
                        </SelectItem>
                        <SelectItem value="14 Tage netto">
                          {t('NewCustomerModal.paymentTerms14Days')}
                        </SelectItem>
                        <SelectItem value="30 Tage netto">
                          {t('NewCustomerModal.paymentTerms30Days')}
                        </SelectItem>
                        <SelectItem value="60 Tage netto">
                          {t('NewCustomerModal.paymentTerms60Days')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>{t('NewCustomerModal.preferredPaymentMethodLabel')}</Label>
                      <TooltipIcon
                        text={t('NewCustomerModal.preferredPaymentMethodTooltip')}
                        icon={'lucide:banknote'}
                      />
                    </div>
                    <Select
                      value={formData.preferredPaymentMethod}
                      onValueChange={val => handleInputChange('preferredPaymentMethod', val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('NewCustomerModal.paymentMethodPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Überweisung">
                          {t('NewCustomerModal.paymentMethodTransfer')}
                        </SelectItem>
                        <SelectItem value="Lastschrift">
                          {t('NewCustomerModal.paymentMethodDirectDebit')}
                        </SelectItem>
                        <SelectItem value="Vorkasse">
                          {t('NewCustomerModal.paymentMethodPrepayment')}
                        </SelectItem>
                        <SelectItem value="Kreditkarte">
                          {t('NewCustomerModal.paymentMethodCreditCard')}
                        </SelectItem>
                        <SelectItem value="PayPal">PayPal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('NewCustomerModal.invoiceDueDateLabel')}</Label>
                    <Input
                      type="number"
                      value={formData.defaultInvoiceDueDate}
                      onChange={e =>
                        handleInputChange('defaultInvoiceDueDate', Number(e.target.value))
                      }
                      placeholder="30"
                      min="1"
                      max="365"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('NewCustomerModal.defaultDiscountLabel')}</Label>
                    <Input
                      type="number"
                      value={formData.discount}
                      onChange={e => handleInputChange('discount', Number(e.target.value))}
                      placeholder="0"
                      min="0"
                      max="100"
                      step="0.1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('NewCustomerModal.currencyLabel')}</Label>
                    <Select
                      value={formData.currency}
                      onValueChange={val => handleInputChange('currency', val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('NewCustomerModal.currencyPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Waehrungsauswahl aus der EINEN Quelle
                            (lib/steuer-waehrung: aus LAENDER abgeleitet plus
                            Zusatzcodes). Vorher standen hier vier fest
                            eingetippte Codes — ein daenischer oder polnischer
                            Kunde liess sich damit gar nicht anlegen (Wurzel 4).
                            Das Symbol kommt aus currencySymbol und bleibt leer,
                            wenn Intl keines kennt (z. B. CHF). */}
                        {WAEHRUNGS_CODES.map(code => {
                          const symbol = currencySymbol(code);
                          return (
                            <SelectItem key={code} value={code}>
                              {symbol && symbol !== code ? `${code} (${symbol})` : code}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Bankdaten */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-800 text-md">
                  {t('NewCustomerModal.bankDetailsHeading')}
                </h4>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t('NewCustomerModal.bankLabel')}</Label>
                    <Input
                      value={formData.bankName}
                      onChange={e => handleInputChange('bankName', e.target.value)}
                      placeholder={t("NewCustomerModal.bankPlaceholder")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('NewCustomerModal.accountHolderLabel')}</Label>
                    <Input
                      value={formData.accountHolder}
                      onChange={e => handleInputChange('accountHolder', e.target.value)}
                      placeholder={t("NewCustomerModal.holderPlaceholder")}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>IBAN</Label>
                      <TooltipIcon
                        text={t('NewCustomerModal.ibanTooltip')}
                        icon={'lucide:credit-card'}
                      />
                    </div>
                    <Input
                      value={formData.iban}
                      onChange={e => handleInputChange('iban', e.target.value)}
                      placeholder={t("NewCustomerModal.ibanPlaceholder")}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>BIC</Label>
                      <TooltipIcon
                        text={t('NewCustomerModal.bicTooltip')}
                        icon={'lucide:building2'}
                      />
                    </div>
                    <Input
                      value={formData.bic}
                      onChange={e => handleInputChange('bic', e.target.value)}
                      placeholder="DEUTDEFF"
                    />
                  </div>
                </div>
              </div>

              {/* Mahnwesen */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-800 text-md">
                  {t('NewCustomerModal.dunningHeading')}
                </h4>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <Label>
                      {t('NewCustomerModal.reminderFeeLabel', {
                        symbol: currencySymbol(formData.currency),
                      })}
                    </Label>
                    <Input
                      type="number"
                      value={formData.reminderFee}
                      onChange={e => handleInputChange('reminderFee', Number(e.target.value))}
                      placeholder="5.00"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('NewCustomerModal.lateFeeLabel')}</Label>
                    <Input
                      type="number"
                      value={formData.lateFee}
                      onChange={e => handleInputChange('lateFee', Number(e.target.value))}
                      placeholder="8.0"
                      min="0"
                      step="0.1"
                    />
                  </div>
                  <div className="col-span-1 flex items-center gap-3 space-y-2 lg:col-span-2">
                    <Label>{t('NewCustomerModal.automaticRemindersLabel')}</Label>
                    <button
                      type="button"
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 ${
                        formData.automaticReminders ? 'bg-accent' : 'bg-gray-200'
                      }`}
                      onClick={() =>
                        handleInputChange('automaticReminders', !formData.automaticReminders)
                      }
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formData.automaticReminders ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Skonto Tab */}
          {activeSubTab === 'skonto' && (
            <div className="space-y-6">
              <h3 className="font-medium text-gray-900 text-lg">
                {t('NewCustomerModal.skontoHeading')}
              </h3>

              {/* Einführungstext */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-start gap-3">
                  <Icon icon="lucide:calculator" className="mt-0.5 h-5 w-5 text-accent" />
                  <div>
                    <h4 className="mb-1 font-medium text-gray-900">
                      {t('NewCustomerModal.skontoIntroHeading')}
                    </h4>
                    <p className="text-gray-700 text-sm">{t('NewCustomerModal.skontoIntroText')}</p>
                  </div>
                </div>
              </div>

              {/* Skonto-Grundeinstellungen */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-800 text-md">
                  {t('NewCustomerModal.skontoBasicSettingsHeading')}
                </h4>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>{t('NewCustomerModal.skontoPercentLabel')}</Label>
                      <TooltipIcon
                        text={t('NewCustomerModal.skontoPercentTooltip', {
                          fullAmount: formatCurrency(1000, formData.currency),
                          discountedAmount: formatCurrency(980, formData.currency),
                        })}
                      />

                    </div>
                    <Input
                      type="number"
                      value={formData.earlyPaymentDiscount}
                      onChange={e =>
                        handleInputChange('earlyPaymentDiscount', Number(e.target.value))
                      }
                      placeholder="2"
                      min="0"
                      max="100"
                      step="0.1"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>{t('NewCustomerModal.skontoDaysLabel')}</Label>
                      <TooltipIcon text={t('NewCustomerModal.skontoDaysTooltip')} />
                    </div>
                    <Input
                      type="number"
                      value={formData.earlyPaymentDays}
                      onChange={e => handleInputChange('earlyPaymentDays', Number(e.target.value))}
                      placeholder="14"
                      min="0"
                    />
                  </div>
                </div>
              </div>

              {/* Erweiterte Skonto-Optionen */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-800 text-md">
                  {t('NewCustomerModal.extendedConditionsHeading')}
                </h4>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>{t('NewCustomerModal.defaultDiscountLabel')}</Label>
                      <TooltipIcon text={t('NewCustomerModal.defaultDiscountTooltip')} />
                    </div>
                    <Input
                      type="number"
                      value={formData.discount}
                      onChange={e => handleInputChange('discount', Number(e.target.value))}
                      placeholder="0"
                      min="0"
                      max="100"
                      step="0.1"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>
                        {t('NewCustomerModal.creditLimitLabel', {
                          symbol: currencySymbol(formData.currency),
                        })}
                      </Label>
                      <TooltipIcon text={t('NewCustomerModal.creditLimitTooltip')} />
                    </div>
                    <Input
                      type="number"
                      value={formData.creditLimit}
                      onChange={e => handleInputChange('creditLimit', Number(e.target.value))}
                      placeholder="10000"
                      min="0"
                    />
                  </div>
                </div>
              </div>

              {/* Berechnungsbeispiel */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-start gap-3">
                  <Icon icon="lucide:euro" className="mt-0.5 h-5 w-5 text-accent" />
                  <div className="flex-1">
                    <h4 className="mb-2 font-medium text-gray-900">
                      {t('NewCustomerModal.calculationExampleHeading')}
                    </h4>
                    <div className="space-y-1 text-gray-700 text-sm">
                      <div className="flex justify-between">
                        <span>{t('NewCustomerModal.invoiceAmountLabel')}</span>
                        <span>{formatCurrency(1000, formData.currency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>
                          {t('NewCustomerModal.skontoAmountLabel', {
                            percent: formData.earlyPaymentDiscount || 2,
                          })}
                        </span>
                        <span>
                          -
                          {formatCurrency(
                            (1000 * (formData.earlyPaymentDiscount || 2)) / 100,
                            formData.currency,
                          )}
                        </span>
                      </div>
                      <hr className="border-gray-300" />
                      <div className="flex justify-between font-medium">
                        <span>{t('NewCustomerModal.payableWithSkontoLabel')}</span>
                        <span>
                          {formatCurrency(
                            1000 - (1000 * (formData.earlyPaymentDiscount || 2)) / 100,
                            formData.currency,
                          )}
                        </span>
                      </div>
                      <div className="mt-2 text-gray-600 text-xs">
                        {t('NewCustomerModal.validWithinDays', {
                          days: formData.earlyPaymentDays || 14,
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Wirtschaftliche Bedeutung */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-start gap-3">
                  <Icon icon="lucide:alert-circle" className="mt-0.5 h-5 w-5 text-accent" />
                  <div>
                    <h4 className="mb-1 font-medium text-gray-900">
                      {t('NewCustomerModal.economicSignificanceHeading')}
                    </h4>
                    <p className="text-gray-700 text-sm">
                      {t('NewCustomerModal.economicSignificanceText', {
                        percent: formData.earlyPaymentDiscount || 2,
                        days: formData.earlyPaymentDays || 14,
                        effectiveRate: (
                          ((formData.earlyPaymentDiscount || 2) * 360) /
                          (30 - (formData.earlyPaymentDays || 14))
                        ).toFixed(1),
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 border-t pt-6">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('NewCustomerModal.cancelButton')}
            </Button>
            <Button
              className="bg-accent text-white hover:bg-accent/90"
              disabled={Boolean(saving) || !isValid() || loading}
              onClick={async () => {
                try {
                  setLoading(true);

                  // Ensure we have the correct customer number for the organization type
                  let finalCustomerNumber = formData.customerNumber;

                  // Validate customer number matches organization type
                  const expectedPrefix = {
                    Kunde: 'KD',
                    Lieferant: 'LF',
                    Partner: 'PA',
                    Interessenten: 'IN',
                  }[formData.organizationType];

                  if (expectedPrefix && !formData.customerNumber.startsWith(expectedPrefix)) {
                    const result = await NumberSequenceService.getNextNumberForType(
                      companyId,
                      formData.organizationType,
                    );
                    finalCustomerNumber = result.formattedNumber;
                  }

                  // Generate display name based on customer type
                  const displayName =
                    customerType === 'person'
                      ? `${formData.title ? `${formData.title} ` : ''}${formData.firstName} ${formData.lastName}`.trim()
                      : formData.companyName;

                  // Create legacy address string for compatibility
                  const legacyAddress = `${formData.street}\n${formData.postalCode} ${formData.city}\n${formData.country}`;

                  // Create comprehensive customer data object
                  const customerData = {
                    // Grunddaten
                    customerNumber: finalCustomerNumber,
                    name: displayName,
                    email: formData.email,
                    phone: formData.phone,

                    // Adressdaten
                    address: legacyAddress, // Legacy-Feld für Kompatibilität
                    street: formData.street,
                    city: formData.city,
                    postalCode: formData.postalCode,
                    country: formData.country,

                    // Steuerliche Daten
                    taxNumber: formData.taxNumber,
                    vatId: formData.vatId,
                    vatValidated: formData.vatValidated,

                    // Organisation/Person-spezifische Felder
                    isSupplier: formData.organizationType === 'Lieferant',
                    organizationType: formData.organizationType,

                    // Person-spezifische Felder
                    firstName: customerType === 'person' ? formData.firstName : '',
                    lastName: customerType === 'person' ? formData.lastName : '',
                    title: customerType === 'person' ? formData.title : '',
                    position: formData.position,

                    // Organisation-spezifische Felder
                    companyName: customerType === 'organisation' ? formData.companyName : '',
                    website: formData.website,
                    companySize: formData.companySize,
                    industry: formData.industry,

                    // Buchhaltungskonten
                    debitorNumber: formData.debitorNumber,
                    creditorNumber: formData.creditorNumber,

                    // Geschäftsbedingungen & Zahlungsinformationen
                    paymentTerms: formData.paymentTerms,
                    discount: formData.discount,
                    creditLimit: formData.creditLimit,
                    currency: formData.currency,
                    language: formData.language,

                    // Bankdaten
                    bankName: formData.bankName,
                    iban: formData.iban,
                    bic: formData.bic,
                    accountHolder: formData.accountHolder,

                    // Zahlungsbedingungen
                    preferredPaymentMethod: formData.preferredPaymentMethod,
                    defaultInvoiceDueDate: formData.defaultInvoiceDueDate,
                    earlyPaymentDiscount: formData.earlyPaymentDiscount,
                    earlyPaymentDays: formData.earlyPaymentDays,

                    // Mahnwesen
                    reminderFee: formData.reminderFee,
                    lateFee: formData.lateFee,
                    automaticReminders: formData.automaticReminders,

                    // E-Rechnung
                    eInvoiceEnabled: formData.eInvoiceEnabled,
                    customerReference: formData.customerReference,
                    leitwegId: formData.leitwegId,

                    // Metadaten
                    notes: formData.notes,
                    tags: formData.tags,

                    // Kontaktpersonen
                    contacts: contacts,

                    // Zusätzliche Adressen (falls erweitert)
                    addresses: formData.addresses,

                    // Statistische Initialdaten
                    totalInvoices: 0,
                    totalAmount: 0,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  };

                  if (persistDirectly && companyId) {
                    try {
                      const { createCustomer } = await import('@/utils/api/companyApi');
                      // Das Backend liefert die angelegte Kundenzeile ({id, …}),
                      // kein {success, customerId} — das alte Format stammte von
                      // einer Route, die es nicht mehr gibt.
                      const created = await createCustomer(customerData);

                      if (created?.id) {
                        toast.success(
                          t('NewCustomerModal.customerCreatedSuccess', { name: displayName }),
                        );

                        if (onSaved) onSaved(created.id);
                        onOpenChange(false);
                        return;
                      } else {
                        throw new Error('Kunde konnte nicht erstellt werden');
                      }
                    } catch (error) {
                      console.error('Fehler beim Speichern des Kunden:', error);
                      toast.error(t('NewCustomerModal.customerSaveError'));
                      return;
                    }
                  }

                  if (onSave) {
                    await onSave(customerData);
                    onOpenChange(false);
                  }
                } catch (error) {
                  console.error('Fehler beim Erstellen des Kunden:', error);
                  toast.error(t('NewCustomerModal.customerCreateError'));
                } finally {
                  setLoading(false);
                }
              }}
            >
              {saving || loading ? (
                <Icon icon="lucide:loader-circle" className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {loading ? t('NewCustomerModal.savingButton') : t('NewCustomerModal.saveButton')}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Category Modal */}
      {companyId && (
        <NewCategoryModal
          open={showCategoryModal}
          onOpenChange={setShowCategoryModal}
          companyId={companyId}
          onSaved={(categoryData) => {
            handleInputChange('organizationType', categoryData.categoryType);
          }}
        />
      )}
    </Dialog>
  );
}
