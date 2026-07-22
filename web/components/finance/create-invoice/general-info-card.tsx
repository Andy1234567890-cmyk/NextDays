'use client';

// Kopfbereich der Rechnungserstellung (aus create-invoice-page.tsx extrahiert):
// InvoiceHeaderBar (Titel + Aktionen oben) und GeneralInfoCard (Card „Allgemeine
// Angaben" + Kopf-Text-Abschnitt). Zwei Render-Positionen, weil Banner und
// Compliance-Sheet im Container dazwischen liegen.
// Alle geteilten States kommen als Props; showAddressAddition und
// deliveryDatePopoverOpen sind lokale UI-States (lebten vorher im selben JSX-Block).

import { Icon } from '@iconify/react';
import {
  Button,
  Calendar,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@tasko/ui';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useTranslations } from 'next-intl';
import { type Dispatch, type SetStateAction, useState } from 'react';
import { toast } from 'sonner';
import type { Customer as CustomerType } from '@/components/finance/AddCustomerModal';
import InvoiceHeaderTextSection from '@/components/finance/InvoiceHeaderTextSection';
import { formatDateDE } from '@/components/finance/create-invoice/calc';
import { COUNTRIES } from '@/constants/countries';
import type { CreateInvoiceFormData } from '@/types/formData';

// Header-Bar oben: Titel, E-Rechnung-Toggle, Entwurf/Vorschau/Erstellen-Aktionen
export function InvoiceHeaderBar({
  eInvoiceEnabled,
  handleEInvoiceToggle,
  loading,
  handleSubmit,
  setShowLivePreview,
  handleOpenSendModal,
}: {
  eInvoiceEnabled: boolean;
  handleEInvoiceToggle: (enabled: boolean) => Promise<void>;
  loading: boolean;
  handleSubmit: (asDraft?: boolean) => Promise<void>;
  setShowLivePreview: Dispatch<SetStateAction<boolean>>;
  handleOpenSendModal: () => void;
}) {
  const t = useTranslations('finance');
  return (
    <header className="w-full" style={{ maxWidth: '1440px' }}>
      <div className="flex items-center justify-between border-gray-200 border-b py-4">
        {/* Left side - Title */}
        <div className="flex items-center">
          <div>
            <h2 className="font-bold text-2xl text-gray-900">
              {t('generalInfoCard.newInvoiceTitle')}
            </h2>
          </div>
        </div>

        {/* Right side - Controls and Actions */}
        <div className="flex items-center gap-4">
          {/* E-Rechnung Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Switch
                checked={eInvoiceEnabled}
                onCheckedChange={handleEInvoiceToggle}
                style={{
                  backgroundColor: eInvoiceEnabled ? 'var(--accent)' : undefined,
                }}
                className=""
              />

              <span className="font-medium text-gray-700 text-sm">
                {t('generalInfoCard.eInvoice')}
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-gray-300"></div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="default"
              onClick={() => handleSubmit(true)}
              disabled={loading}
            >
              {loading ? (
                <Icon icon="lucide:loader2" className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Icon icon="lucide:save" className="mr-2 h-4 w-4" />
              )}
              {t('generalInfoCard.saveAsDraft')}
            </Button>

            <Button
              variant="outline"
              size="default"
              onClick={() => setShowLivePreview(true)}
              className="border-accent text-accent hover:bg-accent hover:text-white"
            >
              <Icon icon="lucide:eye" className="mr-2 h-4 w-4" />
              {t('generalInfoCard.livePreview')}
            </Button>

            <Button
              className="bg-accent text-white hover:bg-accent/90"
              size="default"
              onClick={handleOpenSendModal}
              disabled={loading}
            >
              {loading ? (
                <Icon icon="lucide:loader2" className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Icon icon="lucide:send" className="mr-2 h-4 w-4" />
              )}
              {t('generalInfoCard.createInvoice')}
            </Button>

            {/* More Options Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="default" className="px-2">
                  <Icon icon="lucide:more-horizontal" className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => {
                    toast.success(t('generalInfoCard.createTaskComingSoon'));
                  }}
                  className="w-full"
                >
                  <div className="w-full">
                    <Button
                      variant="default"
                      className="w-full justify-center bg-accent text-white hover:bg-accent/90"
                      size="sm"
                    >
                      {t('generalInfoCard.createTask')}
                    </Button>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    toast.success(t('generalInfoCard.deleteComingSoon'));
                  }}
                  className="w-full"
                >
                  <div className="w-full">
                    <Button
                      variant="default"
                      className="w-full justify-center bg-gray-600 text-white hover:bg-gray-700"
                      size="sm"
                    >
                      {t('generalInfoCard.delete')}
                    </Button>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}

type GeneralInfoCardProps = {
  uid: string;
  userUid: string;
  formData: CreateInvoiceFormData;
  setFormData: Dispatch<SetStateAction<CreateInvoiceFormData>>;
  customers: CustomerType[];
  selectCustomer: (customer: CustomerType) => void;
  contactType: 'organisation' | 'person';
  setContactType: Dispatch<SetStateAction<'organisation' | 'person'>>;
  showCustomerSearchPopup: boolean;
  setShowCustomerSearchPopup: Dispatch<SetStateAction<boolean>>;
  setCreateCustomerOpen: Dispatch<SetStateAction<boolean>>;
  getFieldErrorClass: (fieldName: string) => string;
  nextInvoiceNumber: string;
  nextNumberLoading: boolean;
  nextNumberError: string | null;
  setShowNumberingModal: Dispatch<SetStateAction<boolean>>;
  handleValidUntilChange: (newValidUntil: string) => void;
  paymentDays: number;
  setPaymentDays: Dispatch<SetStateAction<number>>;
  deliveryDateType: 'single' | 'range';
  setDeliveryDateType: Dispatch<SetStateAction<'single' | 'range'>>;
  deliveryDateRange: { from?: Date; to?: Date };
  setDeliveryDateRange: Dispatch<SetStateAction<{ from?: Date; to?: Date }>>;
};

// Card „Allgemeine Angaben" (Empfänger + Rechnungsinformationen) + Kopf-Text
export default function GeneralInfoCard({
  uid,
  userUid,
  formData,
  setFormData,
  customers,
  selectCustomer,
  contactType,
  setContactType,
  showCustomerSearchPopup,
  setShowCustomerSearchPopup,
  setCreateCustomerOpen,
  getFieldErrorClass,
  nextInvoiceNumber,
  nextNumberLoading,
  nextNumberError,
  setShowNumberingModal,
  handleValidUntilChange,
  paymentDays,
  setPaymentDays,
  deliveryDateType,
  setDeliveryDateType,
  deliveryDateRange,
  setDeliveryDateRange,
}: GeneralInfoCardProps) {
  // Lokale UI-States (lebten vorher im selben JSX-Block)
  const [showAddressAddition, setShowAddressAddition] = useState(false);
  const [deliveryDatePopoverOpen, setDeliveryDatePopoverOpen] = useState(false);
  const t = useTranslations('finance');

  return (
    <>
      {/* Allgemeine Angaben - SevDesk Style */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Icon icon="lucide:user" className="mr-2 h-5 w-5 text-accent" />
            {t('generalInfoCard.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 2-Spalten Grid für Empfänger und Rechnungsinformationen */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* Empfänger Sektion - Links */}
            <div className="space-y-4">
              <div>
                <h3 className="mb-4 font-semibold text-gray-900 text-lg">
                  {t('generalInfoCard.recipient')}
                </h3>

                {/* Kontakttyp Toggle */}
                <div className="mb-4 flex items-center gap-2">
                  <Label className="font-medium text-gray-700 text-sm">
                    {t('generalInfoCard.contact')}
                  </Label>
                  <span className="text-red-500">*</span>
                  <div className="ml-auto flex">
                    <Button
                      type="button"
                      variant={contactType === 'organisation' ? 'default' : 'outline'}
                      size="sm"
                      className={`rounded-r-none ${contactType === 'organisation'
                          ? 'bg-accent text-white hover:bg-accent/90'
                          : 'hover:bg-gray-50'
                        }`}
                      onClick={() => setContactType('organisation')}
                    >
                      {t('generalInfoCard.organisation')}
                    </Button>
                    <Button
                      type="button"
                      variant={contactType === 'person' ? 'default' : 'outline'}
                      size="sm"
                      className={`rounded-l-none ${contactType === 'person'
                          ? 'bg-accent text-white hover:bg-accent/90'
                          : 'hover:bg-gray-50'
                        }`}
                      onClick={() => setContactType('person')}
                    >
                      {t('generalInfoCard.person')}
                    </Button>
                  </div>
                </div>

                {/* Kontakt Name Input */}
                <div className="mb-4 space-y-2">
                  {contactType === 'organisation' ? (
                    /* Organisation - Ein Feld für Organisationsname */
                    <div className="customer-search-container relative">
                      <Input
                        type="text"
                        value={formData.customerName}
                        onChange={e => {
                          const value = e.target.value;
                          setFormData(prev => ({
                            ...prev,
                            customerName: value,
                          }));

                          // Zeige Popup nur wenn mindestens 2 Zeichen eingegeben wurden
                          if (value.length >= 2) {
                            setShowCustomerSearchPopup(true);
                          } else {
                            setShowCustomerSearchPopup(false);
                          }
                        }}
                        placeholder={t('generalInfoCard.organisationNamePlaceholder')}
                        className={`flex-1 ${getFieldErrorClass('customerName')}`}
                        required
                      />

                      {/* Intelligenter Such-Popup */}
                      {showCustomerSearchPopup && formData.customerName.length >= 2 && (
                        <div className="absolute top-full right-0 left-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                          {/* Gefilterte Kunden anzeigen */}
                          {customers
                            .filter(customer =>
                              customer.name
                                .toLowerCase()
                                .includes(formData.customerName.toLowerCase()),
                            )
                            .slice(0, 5)
                            .map(customer => (
                              <div
                                key={customer.id}
                                className="cursor-pointer p-2 text-sm hover:bg-gray-100"
                                onClick={() => selectCustomer(customer)}
                              >
                                <div className="font-medium">{customer.name}</div>
                                {customer.email && (
                                  <div className="text-gray-500">{customer.email}</div>
                                )}
                              </div>
                            ))}

                          {/* "Neuen Kunden erstellen" Option (setShowNewCustomerModal-Alias aufgelöst) */}
                          <div
                            className="cursor-pointer rounded-md p-2 hover:bg-gray-100"
                            onClick={() => {
                              setCreateCustomerOpen(true);
                              setShowCustomerSearchPopup(false);
                            }}
                          >
                            {t('generalInfoCard.createNewCustomer', { name: formData.customerName })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Person - Zwei Felder für Vor- und Nachname mit Kundensuche */
                    <div className="customer-search-container relative">
                      <div className="mb-3 grid grid-cols-2 gap-3">
                        <div>
                          <Label className="font-medium text-gray-700 text-sm">
                            {t('generalInfoCard.firstName')}
                          </Label>
                          <span className="text-red-500">*</span>
                          <Input
                            type="text"
                            value={formData.customerFirstName || ''}
                            onChange={e => {
                              const value = e.target.value;
                              setFormData(prev => ({
                                ...prev,
                                customerFirstName: value,
                                // Kombiniere Vor- und Nachname für customerName
                                customerName: `${value} ${prev.customerLastName || ''}`.trim(),
                              }));

                              // Trigger Kundensuche wenn kombinierter Name >= 2 Zeichen
                              const combinedName =
                                `${value} ${formData.customerLastName || ''}`.trim();
                              if (combinedName.length >= 2) {
                                setShowCustomerSearchPopup(true);
                              } else {
                                setShowCustomerSearchPopup(false);
                              }
                            }}
                            placeholder={t('generalInfoCard.firstName')}
                            className={getFieldErrorClass('customerName')}
                            required
                          />
                        </div>
                        <div>
                          <Label className="font-medium text-gray-700 text-sm">
                            {t('generalInfoCard.lastName')}
                          </Label>
                          <span className="text-red-500">*</span>
                          <Input
                            type="text"
                            value={formData.customerLastName || ''}
                            onChange={e => {
                              const value = e.target.value;
                              setFormData(prev => ({
                                ...prev,
                                customerLastName: value,
                                // Kombiniere Vor- und Nachname für customerName
                                customerName: `${prev.customerFirstName || ''} ${value}`.trim(),
                              }));

                              // Trigger Kundensuche wenn kombinierter Name >= 2 Zeichen
                              const combinedName =
                                `${formData.customerFirstName || ''} ${value}`.trim();
                              if (combinedName.length >= 2) {
                                setShowCustomerSearchPopup(true);
                              } else {
                                setShowCustomerSearchPopup(false);
                              }
                            }}
                            placeholder={t('generalInfoCard.lastName')}
                            className={getFieldErrorClass('customerName')}
                            required
                          />
                        </div>
                      </div>

                      {/* Intelligenter Such-Popup für Person - gleiche Struktur wie Organisation */}
                      {showCustomerSearchPopup && formData.customerName.length >= 2 && (
                        <div className="absolute top-full right-0 left-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                          {/* Gefilterte Kunden anzeigen */}
                          {customers
                            .filter(customer =>
                              customer.name
                                .toLowerCase()
                                .includes(formData.customerName.toLowerCase()),
                            )
                            .slice(0, 5)
                            .map(customer => (
                              <div
                                key={customer.id}
                                className="cursor-pointer p-2 text-sm hover:bg-gray-100"
                                onClick={() => {
                                  // Bei Person-Auswahl Namen splitten
                                  const nameParts = customer.name.split(' ');
                                  const firstName = nameParts[0] || '';
                                  const lastName = nameParts.slice(1).join(' ') || '';

                                  setFormData(prev => ({
                                    ...prev,
                                    customerName: customer.name,
                                    customerFirstName: firstName,
                                    customerLastName: lastName,
                                    customerEmail: customer.email,
                                    customerNumber: customer.customerNumber || '',
                                    customerAddress:
                                      customer.street && customer.city
                                        ? `${customer.street}\n${customer.postalCode || ''} ${customer.city}\n${customer.country || 'Deutschland'}`
                                        : prev.customerAddress,
                                  }));
                                  setShowCustomerSearchPopup(false);
                                }}
                              >
                                <div className="font-medium">{customer.name}</div>
                                {customer.email && (
                                  <div className="text-gray-500">{customer.email}</div>
                                )}
                              </div>
                            ))}

                          {/* "Neuen Kunden erstellen" Option */}
                          <div
                            className="cursor-pointer rounded-md p-2 hover:bg-gray-100"
                            onClick={() => {
                              setCreateCustomerOpen(true);
                              setShowCustomerSearchPopup(false);
                            }}
                          >
                            {t('generalInfoCard.createNewCustomer', { name: formData.customerName })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Anschrift */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Label className="font-medium text-gray-700 text-sm">
                        {t('generalInfoCard.address')}
                      </Label>
                      <span className="text-red-500">*</span>
                    </div>
                    <button
                      type="button"
                      className="font-medium text-accent text-sm hover:text-accent/90"
                      onClick={() => setShowAddressAddition(true)}
                    >
                      {t('generalInfoCard.addressAddition')}
                    </button>
                  </div>

                  {/* Straße und Hausnummer */}
                  <Input
                    placeholder={t('generalInfoCard.streetAndNumberPlaceholder')}
                    value={formData.customerAddress?.split('\n')[0] || ''}
                    onChange={e => {
                      const lines = formData.customerAddress?.split('\n') || ['', '', '', ''];
                      lines[0] = e.target.value;
                      setFormData(prev => ({ ...prev, customerAddress: lines.join('\n') }));
                    }}
                    className={getFieldErrorClass('customerAddress')}
                  />

                  {/* Adresszusatz (optional) */}
                  {showAddressAddition && (
                    <div className="relative">
                      <Input
                        placeholder={t('generalInfoCard.addressAdditionPlaceholder')}
                        value={formData.customerAddress?.split('\n')[1] || ''}
                        onChange={e => {
                          const lines = formData.customerAddress?.split('\n') || ['', '', '', ''];
                          lines[1] = e.target.value;
                          setFormData(prev => ({ ...prev, customerAddress: lines.join('\n') }));
                        }}
                      />

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2 p-0 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                        onClick={() => {
                          setShowAddressAddition(false);
                          // Entferne den Adresszusatz aus der Adresse
                          const lines = formData.customerAddress?.split('\n') || ['', '', '', ''];
                          lines[1] = ''; // Leere den Adresszusatz
                          setFormData(prev => ({ ...prev, customerAddress: lines.join('\n') }));
                        }}
                        title={t('generalInfoCard.removeAddressAddition')}
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </Button>
                    </div>
                  )}

                  {/* PLZ und Ort */}
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder={t('generalInfoCard.postalCodePlaceholder')}
                      value={
                        formData.customerAddress
                          ?.split('\n')
                        [showAddressAddition ? 2 : 1]?.split(' ')[0] || ''
                      }
                      onChange={e => {
                        const lines = formData.customerAddress?.split('\n') || ['', '', '', ''];
                        const lineIndex = showAddressAddition ? 2 : 1;
                        const city = lines[lineIndex]?.split(' ').slice(1).join(' ') || '';
                        lines[lineIndex] = `${e.target.value} ${city}`.trim();
                        setFormData(prev => ({ ...prev, customerAddress: lines.join('\n') }));
                      }}
                      className={getFieldErrorClass('customerAddress')}
                    />

                    <Input
                      placeholder={t('generalInfoCard.cityPlaceholder')}
                      value={
                        formData.customerAddress
                          ?.split('\n')
                        [showAddressAddition ? 2 : 1]?.split(' ')
                          .slice(1)
                          .join(' ') || ''
                      }
                      onChange={e => {
                        const lines = formData.customerAddress?.split('\n') || ['', '', '', ''];
                        const lineIndex = showAddressAddition ? 2 : 1;
                        const zip = lines[lineIndex]?.split(' ')[0] || '';
                        lines[lineIndex] = `${zip} ${e.target.value}`.trim();
                        setFormData(prev => ({ ...prev, customerAddress: lines.join('\n') }));
                      }}
                      className={getFieldErrorClass('customerAddress')}
                    />
                  </div>

                  {/* Land */}
                  <Select
                    value={
                      formData.customerAddress?.split('\n')[showAddressAddition ? 3 : 2] ||
                      'Deutschland'
                    }
                    onValueChange={value => {
                      const lines = formData.customerAddress?.split('\n') || ['', '', '', ''];
                      const lineIndex = showAddressAddition ? 3 : 2;
                      lines[lineIndex] = value;
                      setFormData(prev => ({ ...prev, customerAddress: lines.join('\n') }));
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('generalInfoCard.pleaseSelect')} />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map(country => (
                        <SelectItem key={country.value} value={country.value}>
                          {country.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Rechnungsinformationen Sektion - Rechts */}
            <div className="space-y-4">
              <div>
                <h3 className="mb-4 font-semibold text-gray-900 text-lg">
                  {t('generalInfoCard.invoiceInformation')}
                </h3>

                {/* 2x2 Grid für Rechnungsfelder */}
                <div className="mb-4 grid grid-cols-2 gap-4">
                  {/* Rechnungsdatum */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <Label className="font-medium text-gray-700 text-sm">
                        {t('generalInfoCard.invoiceDate')}
                      </Label>
                      <span className="text-red-500">*</span>
                    </div>
                    <Input
                      type="date"
                      value={formData.invoiceDate}
                      onChange={e => {
                        setFormData(prev => ({ ...prev, invoiceDate: e.target.value }));
                      }}
                      required
                    />
                  </div>

                  {/* Leistungsdatum (Hotel/Ferienobjekt: einzelner Tag) bzw.
                      Aufenthalt/Leistungszeitraum (von–bis, Standard bei
                      Zimmerrechnungen aus Buchungen) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Label
                          className={`cursor-pointer font-medium text-sm ${deliveryDateType === 'single' ? 'text-gray-900' : 'text-gray-500'
                            }`}
                          onClick={() => {
                            setDeliveryDateType('single');
                            // Leere servicePeriod und deliveryDateRange wenn Einzeldatum-Modus aktiviert wird
                            setFormData(prev => ({ ...prev, servicePeriod: '' }));
                            setDeliveryDateRange({});
                          }}
                        >
                          {t('generalInfoCard.serviceDate')}
                        </Label>
                        <span className="text-red-500">*</span>
                      </div>
                      <button
                        type="button"
                        className={`cursor-pointer font-medium text-sm ${deliveryDateType === 'range' ? 'text-gray-900' : 'text-gray-500'
                          }`}
                        onClick={() => {
                          setDeliveryDateType('range');
                          // Leere deliveryDate wenn Zeitraum-Modus aktiviert wird
                          setFormData(prev => ({ ...prev, deliveryDate: '' }));
                        }}
                      >
                        {t('generalInfoCard.stayOrPeriod')}
                      </button>
                    </div>

                    {deliveryDateType === 'single' ? (
                      <Input
                        type="date"
                        value={formData.deliveryDate}
                        onChange={e => {
                          setFormData(prev => ({
                            ...prev,
                            deliveryDate: e.target.value,
                            servicePeriod: '', // Leere servicePeriod wenn Einzeldatum verwendet wird
                          }));
                        }}
                        required
                      />
                    ) : (
                      <Popover
                        open={deliveryDatePopoverOpen}
                        onOpenChange={setDeliveryDatePopoverOpen}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                            onClick={() => setDeliveryDatePopoverOpen(true)}
                          >
                            <Icon icon="lucide:calendar" className="mr-2 h-4 w-4" />
                            {deliveryDateRange.from ? (
                              deliveryDateRange.to ? (
                                <>
                                  {format(deliveryDateRange.from, 'dd.MM.yyyy', { locale: de })} -{' '}
                                  {format(deliveryDateRange.to, 'dd.MM.yyyy', { locale: de })}
                                </>
                              ) : (
                                format(deliveryDateRange.from, 'dd.MM.yyyy', { locale: de })
                              )
                            ) : (
                              t('generalInfoCard.selectPeriod')
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={deliveryDateRange.from}
                            selected={{
                              from: deliveryDateRange.from,
                              to: deliveryDateRange.to,
                            }}
                            onSelect={range => {
                              setDeliveryDateRange(range || {});
                              // Aktualisiere servicePeriod in formData wenn Zeitraum komplett ist
                              if (range?.from && range?.to) {
                                const servicePeriodText = `${formatDateDE(range.from)} - ${formatDateDE(range.to)}`;
                                setFormData(prev => ({
                                  ...prev,
                                  servicePeriod: servicePeriodText,
                                }));
                                setDeliveryDatePopoverOpen(false);
                              }
                            }}
                            numberOfMonths={2}
                            locale={de}
                            className="rounded-md border"
                          />
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>

                  {/* Rechnungsnummer */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <Label className="font-medium text-gray-700 text-sm">
                        {t('generalInfoCard.invoiceNumber')}
                      </Label>
                      <span className="text-red-500">*</span>
                    </div>
                    <div className="relative">
                      <Input
                        placeholder={
                          nextNumberLoading
                            ? t('generalInfoCard.loadingNextInvoiceNumber')
                            : nextNumberError
                              ? t('generalInfoCard.loadingError', { error: nextNumberError })
                              : nextInvoiceNumber
                                ? `${nextInvoiceNumber}`
                                : t('generalInfoCard.assignedAutomaticallyOnSave')
                        }
                        value={
                          formData.title ||
                          (nextInvoiceNumber && !nextNumberLoading && !nextNumberError
                            ? nextInvoiceNumber
                            : '')
                        }
                        onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        className="bg-gray-50 pr-10 text-gray-600"
                        readOnly
                        title={t('generalInfoCard.invoiceNumberAutoAssignHint')}
                      />

                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2 p-0 hover:bg-gray-100"
                        type="button"
                        onClick={() => setShowNumberingModal(true)}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <circle cx="12" cy="12" r="3" />
                          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1.06 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1.06H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1.06-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.06 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1.06H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1.06z" />
                        </svg>
                      </Button>
                    </div>
                  </div>

                  {/* Referenznummer */}
                  <div className="space-y-2">
                    <Label className="font-medium text-gray-700 text-sm">
                      {t('generalInfoCard.referenceNumber')}
                    </Label>
                    <Input
                      placeholder={t('generalInfoCard.optional')}
                      value={formData.customerOrderNumber}
                      onChange={e =>
                        setFormData(prev => ({ ...prev, customerOrderNumber: e.target.value }))
                      }
                    />
                  </div>
                </div>

                {/* Zahlungsziel - Ganze Zeile */}
                <div className="space-y-2">
                  <Label className="font-medium text-gray-700 text-sm">
                    {t('generalInfoCard.paymentTerm')}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={formData.validUntil}
                      onChange={e => handleValidUntilChange(e.target.value)}
                      className="flex-1"
                    />

                    <span className="text-gray-500 text-sm">{t('generalInfoCard.in')}</span>
                    <Input
                      type="number"
                      placeholder="14"
                      value={paymentDays}
                      onChange={e => setPaymentDays(Number(e.target.value) || 0)}
                      className="w-16 text-center"
                    />

                    <span className="text-gray-500 text-sm">{t('generalInfoCard.days')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Kopf-Text & Textvorlagen */}
      <InvoiceHeaderTextSection
        title={formData.title}
        headTextHtml={formData.headTextHtml}
        onTitleChange={value => setFormData(prev => ({ ...prev, title: value }))}
        onHeadTextChange={html => setFormData(prev => ({ ...prev, headTextHtml: html }))}
        companyId={uid}
        userId={userUid}
        getFieldErrorClass={getFieldErrorClass}
      />
    </>
  );
}
