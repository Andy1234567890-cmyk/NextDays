'use client';

import { Icon } from '@iconify/react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
} from '@tasko/ui';
import { useTranslations } from 'next-intl';
import React, { useState } from 'react';
import { toast } from 'sonner';

import { NativeSelect } from '@nextdays/ui/native-select';
import { getVATFormat, validateVATNumber } from '@/utils/vatValidation';

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

export interface SkontoProduct {
  id: string;
  productName: string;
  sku?: string;
  discount: number;
  days: number;
  inventoryId?: string;
  customerId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Customer {
  id: string;
  customerNumber: string;
  kundenNummer?: string; // Legacy Alias für customerNumber
  name: string;
  email: string;
  phone?: string;
  // Legacy address für Kompatibilität
  address: string;
  // Strukturierte Adresse
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  taxNumber?: string;
  vatId?: string;
  vatValidated?: boolean;
  isSupplier?: boolean; // Unterscheidung zwischen Kunde und Lieferant
  organizationType?: 'Kunde' | 'Lieferant' | 'Partner' | 'Interessenten'; // Kontakttyp
  totalInvoices: number;
  totalAmount: number;
  createdAt: string | Date | { toDate: () => Date; seconds: number; nanoseconds: number };
  contactPersons: ContactPerson[];
  companyId: string;
  // Erweiterte Felder
  website?: string;
  notes?: string;
  paymentTerms?: number;
  discount?: number;
  currency?: string;
  language?: string;
  companySize?: string;
  industry?: string;
  legalForm?: string;
  creditLimit?: number;
  debitorNumber?: string;
  creditorNumber?: string;
  bankName?: string;
  iban?: string;
  bic?: string;
  accountHolder?: string;
  preferredPaymentMethod?: string;
  earlyPaymentDiscount?: number;
  earlyPaymentDays?: number;
  defaultInvoiceDueDate?: number;
  reminderFee?: number;
  lateFee?: number;
  automaticReminders?: boolean;
  noReminders?: boolean;
  reminderLevel?: number;
  defaultTaxRate?: number;
  reverseCharge?: boolean;
  skontoProducts?: SkontoProduct[];
  tags?: string[];
}

interface AddCustomerModalProps {
  onAddCustomer: (
    customer: Omit<Customer, 'id' | 'totalInvoices' | 'totalAmount' | 'createdAt' | 'companyId'>,
  ) => Promise<void>;
  nextCustomerNumber: string;
  nextSupplierNumber?: string; // Neue Prop für Lieferantennummer
}

function AddCustomerModal({
  onAddCustomer,
  nextCustomerNumber,
  nextSupplierNumber = 'LF-001',
}: AddCustomerModalProps) {
  const t = useTranslations('finance');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [contactType, setContactType] = useState<'customer' | 'supplier'>('customer');
  const [formData, setFormData] = useState({
    customerNumber: nextCustomerNumber,
    name: '',
    email: '',
    phone: '',
    // Legacy address für Kompatibilität
    address: '',
    // Strukturierte Adresse
    street: '',
    city: '',
    postalCode: '',
    country: 'Deutschland',
    // Unternehmenstyp für Deutschland
    businessType: 'kleinunternehmer', // 'kleinunternehmer' oder 'regelbesteuert'
    taxNumber: '',
    vatId: '',
    vatValidated: false,
  });

  const [contactPersons, setContactPersons] = useState<Omit<ContactPerson, 'id'>[]>([
    {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      position: '',
      department: '',
      isPrimary: true,
    },
  ]);

  const [activeTab, setActiveTab] = useState('overview');

  // Tab definitions
  const tabs = [
    { id: 'overview', label: t('AddCustomerModal.tabOverview'), count: null, icon: 'lucide:file-text' },
    { id: 'history', label: t('AddCustomerModal.tabHistory'), count: null, icon: 'lucide:history' },
    { id: 'persons', label: t('AddCustomerModal.tabPersons'), count: contactPersons.length, icon: 'lucide:users' },
    { id: 'orders', label: t('AddCustomerModal.tabOrders'), count: 0, icon: 'lucide:folder' },
    { id: 'invoices', label: t('AddCustomerModal.tabInvoices'), count: 0, icon: 'lucide:receipt' },
    { id: 'credits', label: t('AddCustomerModal.tabCredits'), count: 0, icon: 'lucide:credit-card' },
    { id: 'documents', label: t('AddCustomerModal.tabDocuments'), count: 0, icon: 'lucide:file-text' },
    { id: 'files', label: t('AddCustomerModal.tabFiles'), count: 0, icon: 'lucide:upload' },
  ];

  // Action menu items
  const actionItems = [
    { id: 'task', label: t('AddCustomerModal.actionCreateTask'), icon: 'lucide:check', action: () => {} },
    { id: 'print', label: t('AddCustomerModal.actionPrint'), icon: 'lucide:printer', action: () => {} },
    { id: 'export', label: t('AddCustomerModal.actionExport'), icon: 'lucide:download', action: () => {} },
    { id: 'invoice', label: t('AddCustomerModal.actionCreateInvoice'), icon: 'lucide:file', action: () => {} },
    {
      id: 'recurring',
      label: t('AddCustomerModal.actionRecurringInvoice'),
      icon: 'lucide:file',
      action: () => {},
    },
    { id: 'quote', label: t('AddCustomerModal.actionCreateQuote'), icon: 'lucide:folder', action: () => {} },
    { id: 'order', label: t('AddCustomerModal.actionCreateOrder'), icon: 'lucide:folder', action: () => {} },
    {
      id: 'delivery',
      label: t('AddCustomerModal.actionCreateDeliveryNote'),
      icon: 'lucide:folder',
      action: () => {},
    },
    { id: 'credit', label: t('AddCustomerModal.actionCreateCredit'), icon: 'lucide:book', action: () => {} },
    { id: 'letter', label: t('AddCustomerModal.actionWriteLetter'), icon: 'lucide:mail', action: () => {} },
    { id: 'upload', label: t('AddCustomerModal.actionUploadFile'), icon: 'lucide:upload', action: () => {} },
    {
      id: 'pricing',
      label: t('AddCustomerModal.actionAddCustomerPrice'),
      icon: 'lucide:dollar-sign',
      action: () => {},
    },
    { id: 'delete', label: t('AddCustomerModal.actionDelete'), icon: 'lucide:trash2', action: () => {} },
  ];

  // Update customer number when prop changes
  React.useEffect(() => {
    setFormData(prev => ({ ...prev, customerNumber: nextCustomerNumber }));
  }, [nextCustomerNumber]);

  // Update number based on contact type
  React.useEffect(() => {
    const newNumber = contactType === 'customer' ? nextCustomerNumber : nextSupplierNumber;
    setFormData(prev => ({ ...prev, customerNumber: newNumber }));
  }, [contactType, nextCustomerNumber, nextSupplierNumber]);

  // VAT Validation
  const handleVATChange = (value: string) => {
    const upperValue = value.toUpperCase();
    setFormData(prev => ({
      ...prev,
      vatId: upperValue,
      // Leere Steuernummer wenn VAT befüllt wird
      taxNumber: upperValue ? '' : prev.taxNumber,
    }));

    if (upperValue.length > 2) {
      const validation = validateVATNumber(upperValue);
      setFormData(prev => ({ ...prev, vatValidated: validation.isValid }));
    } else {
      setFormData(prev => ({ ...prev, vatValidated: false }));
    }
  };

  // Tax Number Change Handler
  const handleTaxNumberChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      taxNumber: value,
      // Leere VAT wenn Steuernummer befüllt wird
      vatId: value ? '' : prev.vatId,
      vatValidated: false,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.name.trim() ||
      !formData.email.trim() ||
      !formData.street.trim() ||
      !formData.city.trim() ||
      !formData.postalCode.trim()
    ) {
      toast.error(t('AddCustomerModal.errorRequiredFields'));
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error(t('AddCustomerModal.errorInvalidEmail'));
      return;
    }

    // Validate contact persons
    const validContactPersons = contactPersons.filter(
      cp => cp.firstName.trim() && cp.lastName.trim() && cp.email.trim(),
    );

    if (validContactPersons.length === 0) {
      toast.error(t('AddCustomerModal.errorAtLeastOneContact'));
      return;
    }

    // Validate contact person emails
    for (const cp of validContactPersons) {
      if (!emailRegex.test(cp.email)) {
        toast.error(
          t('AddCustomerModal.errorInvalidContactEmail', {
            firstName: cp.firstName,
            lastName: cp.lastName,
          }),
        );
        return;
      }
    }

    try {
      setLoading(true);

      const customerDataToSave = {
        customerNumber: formData.customerNumber,
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || undefined,
        // Legacy address für Kompatibilität - kombiniert aus strukturierten Feldern
        address: `${formData.street}, ${formData.postalCode} ${formData.city}, ${formData.country}`,
        // Strukturierte Adresse
        street: formData.street.trim(),
        city: formData.city.trim(),
        postalCode: formData.postalCode.trim(),
        country: formData.country,
        taxNumber: formData.taxNumber.trim() || undefined,
        vatId: formData.vatId.trim() || undefined,
        vatValidated: formData.vatValidated,
        isSupplier: contactType === 'supplier', // Setze das isSupplier Flag basierend auf dem Kontakttyp
        contactPersons: validContactPersons.map((cp, index) => ({
          ...cp,
          id: `cp_${Date.now()}_${index}`,
          firstName: cp.firstName.trim(),
          lastName: cp.lastName.trim(),
          email: cp.email.trim(),
          phone: cp.phone?.trim() || undefined,
          position: cp.position?.trim() || undefined,
          department: cp.department?.trim() || undefined,
        })),
      };

      await onAddCustomer(customerDataToSave);

      // Reset form
      setContactType('customer');
      setFormData({
        customerNumber: '',
        name: '',
        email: '',
        phone: '',
        address: '',
        street: '',
        city: '',
        postalCode: '',
        country: 'Deutschland',
        businessType: 'kleinunternehmer',
        taxNumber: '',
        vatId: '',
        vatValidated: false,
      });

      setContactPersons([
        {
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          position: '',
          department: '',
          isPrimary: true,
        },
      ]);

      setOpen(false);
      toast.success(t('AddCustomerModal.successCustomerAdded'));
    } catch (error) {
      toast.error(
        t('AddCustomerModal.errorAddingCustomer', {
          message: error instanceof Error ? error.message : t('AddCustomerModal.errorUnknown'),
        }),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleContactPersonChange = (
    index: number,
    field: keyof Omit<ContactPerson, 'id'>,
    value: string | boolean,
  ) => {
    setContactPersons(prev => prev.map((cp, i) => (i === index ? { ...cp, [field]: value } : cp)));
  };

  const addContactPerson = () => {
    setContactPersons(prev => [
      ...prev,
      {
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        position: '',
        department: '',
        isPrimary: false,
      },
    ]);
  };

  const removeContactPerson = (index: number) => {
    if (contactPersons.length > 1) {
      setContactPersons(prev => prev.filter((_, i) => i !== index));
    }
  };

  const setPrimaryContact = (index: number) => {
    setContactPersons(prev =>
      prev.map((cp, i) => ({
        ...cp,
        isPrimary: i === index,
      })),
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-accent hover:bg-[#0f9d84]">
          <Icon icon="lucide:plus" className="mr-2 h-4 w-4" />
          {t('AddCustomerModal.newCustomer')}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] w-[95vw] overflow-y-auto p-0 sm:max-w-300">
        {/* Header mit Titel */}
        <div className="p-6 pb-4">
          <DialogHeader>
            <DialogTitle>{t('AddCustomerModal.dialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('AddCustomerModal.dialogDescription', {
                contactType:
                  contactType === 'customer'
                    ? t('AddCustomerModal.contactTypeAccusativeCustomer')
                    : t('AddCustomerModal.contactTypeAccusativeSupplier'),
              })}
            </DialogDescription>
          </DialogHeader>

          {/* Kontakttyp-Auswahl */}
          <div className="mt-4">
            <Label className="font-medium text-gray-900 text-sm">
              {t('AddCustomerModal.contactTypeLabel')}
            </Label>
            <div className="mt-2 flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="contactType"
                  value="customer"
                  checked={contactType === 'customer'}
                  onChange={() => setContactType('customer')}
                  className="h-4 w-4 border-gray-300 text-accent focus:ring-accent"
                />
                <span className="ml-2 text-gray-700 text-sm">
                  {t('AddCustomerModal.contactTypeCustomer')}
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="contactType"
                  value="supplier"
                  checked={contactType === 'supplier'}
                  onChange={() => setContactType('supplier')}
                  className="h-4 w-4 border-gray-300 text-accent focus:ring-accent"
                />
                <span className="ml-2 text-gray-700 text-sm">
                  {t('AddCustomerModal.contactTypeSupplier')}
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-gray-200 border-b bg-white">
          <div className="flex items-center justify-between px-6 py-0">
            {/* Tab Navigation */}
            <nav className="flex items-center space-x-0 overflow-x-auto">
              {tabs.map(tab => {
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'border-accent text-accent'
                        : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                    }`}
                  >
                    <Icon icon={tab.icon} className="h-4 w-4" />
                    <span>{tab.label}</span>
                    {tab.count !== null && (
                      <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-gray-600 text-xs">
                        ({tab.count})
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 py-3">
              {/* Person hinzufügen Dropdown */}
              <div className="group relative">
                <button className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm transition-colors hover:bg-gray-50">
                  <Icon icon="lucide:user" className="h-4 w-4" />
                  {t('AddCustomerModal.addPerson')}
                </button>
                {/* Dropdown Menu für Person hinzufügen */}
                <div className="invisible absolute right-0 z-50 mt-1 w-64 rounded-md border border-gray-200 bg-white opacity-0 shadow-lg transition-all duration-200 group-hover:visible group-hover:opacity-100">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        /* Bestehende Person auswählen */
                      }}
                      className="flex w-full items-center px-4 py-2 text-gray-700 text-sm hover:bg-gray-50"
                    >
                      {t('AddCustomerModal.selectExistingPerson')}
                    </button>
                    <button
                      onClick={() => {
                        /* Neue Person anlegen */
                      }}
                      className="flex w-full items-center px-4 py-2 text-gray-700 text-sm hover:bg-gray-50"
                    >
                      {t('AddCustomerModal.createNewPerson')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Bearbeiten Button */}
              <button
                onClick={() => {
                  /* Bearbeiten Funktion */
                }}
                className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm transition-colors hover:bg-gray-50"
              >
                <Icon icon="lucide:edit" className="h-4 w-4" />
                {t('AddCustomerModal.edit')}
              </button>

              {/* Optionen Dropdown */}
              <div className="group relative">
                <button className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm transition-colors hover:bg-gray-50">
                  {t('AddCustomerModal.options')}
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
                {/* Dropdown Menu für Optionen */}
                <div className="invisible absolute right-0 z-50 mt-1 w-64 rounded-md border border-gray-200 bg-white opacity-0 shadow-lg transition-all duration-200 group-hover:visible group-hover:opacity-100">
                  <div className="py-1">
                    {actionItems.map(item => {
                      return (
                        <button
                          key={item.id}
                          onClick={item.action}
                          className="flex w-full items-center px-4 py-2 text-gray-700 text-sm hover:bg-gray-50"
                        >
                          <Icon icon={item.icon} className="mr-3 h-4 w-4" />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
              {/* Autofill-Honeypot - versteckte Felder für Browser-Autofill */}
              <div style={{ display: 'none' }}>
                <input type="text" name="username" tabIndex={-1} autoComplete="username" />
                <input
                  type="password"
                  name="password"
                  tabIndex={-1}
                  autoComplete="current-password"
                />
                <input type="email" name="fakeEmail" tabIndex={-1} autoComplete="email" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customerNumber">
                    {contactType === 'customer'
                      ? t('AddCustomerModal.customerNumberLabel')
                      : t('AddCustomerModal.supplierNumberLabel')}
                  </Label>
                  <Input
                    id="customerNumber"
                    name="customerNumber"
                    value={formData.customerNumber}
                    onChange={e => handleChange('customerNumber', e.target.value)}
                    placeholder={t('AddCustomerModal.customerNumberPlaceholder')}
                    disabled
                    className="bg-gray-50"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <Label htmlFor="name">{t('AddCustomerModal.companyNameLabel')}</Label>
                  <Input
                    id="name"
                    name="company-name"
                    value={formData.name}
                    onChange={e => handleChange('name', e.target.value)}
                    placeholder={t('AddCustomerModal.companyNamePlaceholder')}
                    required
                    autoComplete="organization"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">{t('AddCustomerModal.emailLabel')}</Label>
                  <Input
                    id="email"
                    name="company-email"
                    type="email"
                    value={formData.email}
                    onChange={e => handleChange('email', e.target.value)}
                    placeholder={t('AddCustomerModal.companyEmailPlaceholder')}
                    required
                    autoComplete="email"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">{t('AddCustomerModal.phoneLabel')}</Label>
                  <Input
                    id="phone"
                    name="company-phone"
                    type="tel"
                    value={formData.phone}
                    onChange={e => handleChange('phone', e.target.value)}
                    placeholder={t('AddCustomerModal.phonePlaceholder')}
                    autoComplete="tel"
                  />
                </div>
              </div>

              {/* Strukturierte Adresse */}
              <div className="space-y-4">
                <Label className="font-semibold text-base">
                  {t('AddCustomerModal.addressSectionLabel')}
                </Label>

                <div>
                  <Label htmlFor="street">{t('AddCustomerModal.streetLabel')}</Label>
                  <Input
                    id="street"
                    name="street"
                    value={formData.street}
                    onChange={e => handleChange('street', e.target.value)}
                    placeholder={t('AddCustomerModal.streetPlaceholder')}
                    required
                    autoComplete="street-address"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="postalCode">{t('AddCustomerModal.postalCodeLabel')}</Label>
                    <Input
                      id="postalCode"
                      name="postal-code"
                      value={formData.postalCode}
                      onChange={e => handleChange('postalCode', e.target.value)}
                      placeholder={t('AddCustomerModal.postalCodePlaceholder')}
                      required
                      autoComplete="postal-code"
                    />
                  </div>
                  <div>
                    <Label htmlFor="city">{t('AddCustomerModal.cityLabel')}</Label>
                    <Input
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={e => handleChange('city', e.target.value)}
                      placeholder={t('AddCustomerModal.cityPlaceholder')}
                      required
                      autoComplete="address-level2"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="country">{t('AddCustomerModal.countryLabel')}</Label>
                  <NativeSelect
                    id="country"
                    name="country"
                    value={formData.country}
                    onChange={e => handleChange('country', e.target.value)}
                    className="w-full"
                    required
                  >
                    <option value="Deutschland">Deutschland</option>
                    <option value="Österreich">Österreich</option>
                    <option value="Schweiz">Schweiz</option>
                    <option value="Niederlande">Niederlande</option>
                    <option value="Belgien">Belgien</option>
                    <option value="Frankreich">Frankreich</option>
                    <option value="Italien">Italien</option>
                    <option value="Spanien">Spanien</option>
                    <option value="Polen">Polen</option>
                    <option value="Tschechien">Tschechien</option>
                    <option value="Andere">Andere</option>
                  </NativeSelect>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Deutschland: Nur ENTWEDER Steuernummer ODER VAT */}
                {formData.country === 'Deutschland' ? (
                  <>
                    <div>
                      <Label htmlFor="taxNumber">{t('AddCustomerModal.taxNumberLabel')}</Label>
                      <Input
                        id="taxNumber"
                        name="tax-number"
                        value={formData.taxNumber}
                        onChange={e => handleTaxNumberChange(e.target.value)}
                        placeholder="12345/67890"
                        autoComplete="off"
                        disabled={!!formData.vatId}
                      />

                      <div className="mt-1 text-gray-500 text-xs">
                        {formData.vatId
                          ? t('AddCustomerModal.taxNumberDisabledVatSet')
                          : t('AddCustomerModal.taxNumberHintSmallBusiness')}
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="vatId">{t('AddCustomerModal.vatIdLabel')}</Label>
                      <div className="space-y-2">
                        <div className="relative">
                          <Input
                            id="vatId"
                            name="vat-id"
                            value={formData.vatId}
                            onChange={e => handleVATChange(e.target.value)}
                            placeholder="DE123456789"
                            autoComplete="off"
                            disabled={!!formData.taxNumber}
                            className={
                              formData.vatId && formData.vatValidated
                                ? 'border-green-500 pr-10'
                                : formData.vatId && !formData.vatValidated
                                  ? 'border-red-500 pr-10'
                                  : ''
                            }
                          />

                          {formData.vatId && (
                            <div className="absolute top-1/2 right-3 -translate-y-1/2 transform">
                              {formData.vatValidated ? (
                                <Icon
                                  icon="lucide:check-circle"
                                  className="h-4 w-4 text-green-500"
                                />
                              ) : (
                                <Icon icon="lucide:x-circle" className="h-4 w-4 text-red-500" />
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-gray-500 text-xs">
                          {formData.taxNumber
                            ? t('AddCustomerModal.vatIdDisabledTaxNumberSet')
                            : t('AddCustomerModal.vatIdHintStandardTaxed')}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Andere Länder: Hauptsächlich VAT, optional lokale Steuernummer */
                  <>
                    <div>
                      <Label htmlFor="vatId">{t('AddCustomerModal.vatIdLabelInternational')}</Label>
                      <div className="space-y-2">
                        <div className="relative">
                          <Input
                            id="vatId"
                            name="vat-id"
                            value={formData.vatId}
                            onChange={e => handleVATChange(e.target.value)}
                            placeholder={
                              formData.country === 'Österreich'
                                ? 'ATU12345678'
                                : formData.country === 'Schweiz'
                                  ? 'CHE123456789'
                                  : formData.country === 'Niederlande'
                                    ? 'NL123456789B01'
                                    : formData.country === 'USA'
                                      ? '12-3456789'
                                      : formData.country === 'Brasilien'
                                        ? '12.345.678/0001-90'
                                        : t('AddCustomerModal.vatIdPlaceholderGeneric')
                            }
                            autoComplete="off"
                            className={
                              formData.vatId && formData.vatValidated
                                ? 'border-green-500 pr-10'
                                : formData.vatId && !formData.vatValidated
                                  ? 'border-red-500 pr-10'
                                  : ''
                            }
                          />

                          {formData.vatId && (
                            <div className="absolute top-1/2 right-3 -translate-y-1/2 transform">
                              {formData.vatValidated ? (
                                <Icon
                                  icon="lucide:check-circle"
                                  className="h-4 w-4 text-green-500"
                                />
                              ) : (
                                <Icon icon="lucide:x-circle" className="h-4 w-4 text-red-500" />
                              )}
                            </div>
                          )}
                        </div>
                        {formData.vatId && (
                          <div className="text-gray-500 text-xs">
                            {t('AddCustomerModal.vatIdFormatHint', {
                              format: getVATFormat(formData.country),
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="taxNumber">
                        {t('AddCustomerModal.localTaxNumberLabel')}
                      </Label>
                      <Input
                        id="taxNumber"
                        name="tax-number"
                        value={formData.taxNumber}
                        onChange={e => handleTaxNumberChange(e.target.value)}
                        placeholder={t('AddCustomerModal.localTaxNumberPlaceholder')}
                        autoComplete="off"
                      />

                      <div className="mt-1 text-gray-500 text-xs">
                        {t('AddCustomerModal.localTaxNumberHint')}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Ansprechpartner Sektion */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold text-base">
                    {t('AddCustomerModal.contactPersonsSectionLabel')}
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addContactPerson}
                    className="h-8"
                  >
                    <Icon icon="lucide:user-plus" className="mr-1 h-3 w-3" />
                    {t('AddCustomerModal.addContactPerson')}
                  </Button>
                </div>

                {contactPersons.map((contact, index) => (
                  <div key={index} className="space-y-3 rounded-lg border bg-gray-50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700 text-sm">
                        {t('AddCustomerModal.contactPersonHeading', { number: index + 1 })}
                        {contact.isPrimary && (
                          <Icon
                            icon="lucide:star"
                            className="ml-1 inline h-3 w-3 fill-current text-yellow-500"
                          />
                        )}
                      </span>
                      <div className="flex gap-2">
                        {!contact.isPrimary && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setPrimaryContact(index)}
                            className="h-6 px-2 text-xs"
                          >
                            {t('AddCustomerModal.setAsPrimaryContact')}
                          </Button>
                        )}
                        {contactPersons.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeContactPerson(index)}
                            className="h-6 px-2 text-red-600 hover:text-red-700"
                          >
                            <Icon icon="lucide:trash2" className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor={`firstName-${index}`}>
                          {t('AddCustomerModal.firstNameLabel')}
                        </Label>
                        <Input
                          id={`firstName-${index}`}
                          name={`contact-firstName-${index}`}
                          value={contact.firstName}
                          onChange={e =>
                            handleContactPersonChange(index, 'firstName', e.target.value)
                          }
                          placeholder="Max"
                          className="text-sm"
                          autoComplete="given-name"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`lastName-${index}`}>
                          {t('AddCustomerModal.lastNameLabel')}
                        </Label>
                        <Input
                          id={`lastName-${index}`}
                          name={`contact-lastName-${index}`}
                          value={contact.lastName}
                          onChange={e =>
                            handleContactPersonChange(index, 'lastName', e.target.value)
                          }
                          placeholder="Mustermann"
                          className="text-sm"
                          autoComplete="family-name"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor={`contactEmail-${index}`}>
                          {t('AddCustomerModal.contactEmailLabel')}
                        </Label>
                        <Input
                          id={`contactEmail-${index}`}
                          name={`contact-email-${index}`}
                          type="email"
                          value={contact.email}
                          onChange={e => handleContactPersonChange(index, 'email', e.target.value)}
                          placeholder="max.mustermann@kunde.de"
                          className="text-sm"
                          autoComplete="email"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`contactPhone-${index}`}>
                          {t('AddCustomerModal.phoneLabel')}
                        </Label>
                        <Input
                          id={`contactPhone-${index}`}
                          name={`contact-phone-${index}`}
                          type="tel"
                          value={contact.phone}
                          onChange={e => handleContactPersonChange(index, 'phone', e.target.value)}
                          placeholder="+49 123 456789"
                          className="text-sm"
                          autoComplete="tel"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor={`position-${index}`}>
                          {t('AddCustomerModal.positionLabel')}
                        </Label>
                        <Input
                          id={`position-${index}`}
                          name={`contact-position-${index}`}
                          value={contact.position}
                          onChange={e =>
                            handleContactPersonChange(index, 'position', e.target.value)
                          }
                          placeholder={t('AddCustomerModal.positionPlaceholder')}
                          className="text-sm"
                          autoComplete="organization-title"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`department-${index}`}>
                          {t('AddCustomerModal.departmentLabel')}
                        </Label>
                        <Input
                          id={`department-${index}`}
                          name={`contact-department-${index}`}
                          value={contact.department}
                          onChange={e =>
                            handleContactPersonChange(index, 'department', e.target.value)
                          }
                          placeholder={t('AddCustomerModal.departmentPlaceholder')}
                          className="text-sm"
                          autoComplete="off"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                >
                  {t('AddCustomerModal.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-accent hover:bg-[#0f9d84]"
                >
                  {loading && <Icon icon="lucide:loader2" className="mr-2 h-4 w-4 animate-spin" />}
                  {t('AddCustomerModal.submitAddCustomer')}
                </Button>
              </DialogFooter>
            </form>
          )}

          {activeTab === 'history' && (
            <div className="py-12 text-center text-gray-500">
              <Icon icon="lucide:history" className="mx-auto mb-3 h-12 w-12 text-gray-300" />
              <h3 className="mb-1 font-medium text-gray-900 text-lg">
                {t('AddCustomerModal.historyEmptyTitle')}
              </h3>
              <p>{t('AddCustomerModal.historyEmptyDescription')}</p>
            </div>
          )}

          {activeTab === 'persons' && (
            <div className="py-12 text-center text-gray-500">
              <Icon icon="lucide:users" className="mx-auto mb-3 h-12 w-12 text-gray-300" />
              <h3 className="mb-1 font-medium text-gray-900 text-lg">
                {t('AddCustomerModal.personsEmptyTitle', { count: contactPersons.length })}
              </h3>
              <p>{t('AddCustomerModal.personsEmptyDescription')}</p>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="py-12 text-center text-gray-500">
              <Icon icon="lucide:folder" className="mx-auto mb-3 h-12 w-12 text-gray-300" />
              <h3 className="mb-1 font-medium text-gray-900 text-lg">
                {t('AddCustomerModal.ordersEmptyTitle')}
              </h3>
              <p>{t('AddCustomerModal.ordersEmptyDescription')}</p>
            </div>
          )}

          {activeTab === 'invoices' && (
            <div className="py-12 text-center text-gray-500">
              <Icon icon="lucide:receipt" className="mx-auto mb-3 h-12 w-12 text-gray-300" />
              <h3 className="mb-1 font-medium text-gray-900 text-lg">
                {t('AddCustomerModal.invoicesEmptyTitle')}
              </h3>
              <p>{t('AddCustomerModal.invoicesEmptyDescription')}</p>
            </div>
          )}

          {activeTab === 'credits' && (
            <div className="py-12 text-center text-gray-500">
              <Icon icon="lucide:credit-card" className="mx-auto mb-3 h-12 w-12 text-gray-300" />
              <h3 className="mb-1 font-medium text-gray-900 text-lg">
                {t('AddCustomerModal.creditsEmptyTitle')}
              </h3>
              <p>{t('AddCustomerModal.creditsEmptyDescription')}</p>
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="py-12 text-center text-gray-500">
              <Icon icon="lucide:file-text" className="mx-auto mb-3 h-12 w-12 text-gray-300" />
              <h3 className="mb-1 font-medium text-gray-900 text-lg">
                {t('AddCustomerModal.documentsEmptyTitle')}
              </h3>
              <p>{t('AddCustomerModal.documentsEmptyDescription')}</p>
            </div>
          )}

          {activeTab === 'files' && (
            <div className="py-12 text-center text-gray-500">
              <Icon icon="lucide:upload" className="mx-auto mb-3 h-12 w-12 text-gray-300" />
              <h3 className="mb-1 font-medium text-gray-900 text-lg">
                {t('AddCustomerModal.filesEmptyTitle')}
              </h3>
              <p>{t('AddCustomerModal.filesEmptyDescription')}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AddCustomerModal;
