/**
 * Die gemeinsamen Typen und Vorgabewerte der Kundenanlage.
 *
 * Eigene Datei, weil Hauptkomponente UND alle vier Reiter sie brauchen.
 * Blieben sie in `NewCustomerModal.tsx`, importierte jeder Reiter aus der
 * Datei, die ihn selbst einbindet — ein Ringschluss, der beim Bauen als
 * schwer lesbarer Fehler erscheint.
 */

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

export interface Address {
  id: string;
  type: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
}

// Erweiterte Form-Daten Struktur basierend auf der Create-Page
export interface ExtendedFormData {
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

export type CustomerType = 'person' | 'organisation';
export type SubTabType = 'overview' | 'contacts' | 'payment' | 'skonto';

// Tab Definitionen
export interface TabDefinition {
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


export const createDefaultAddress = (): Address => ({
  id: Math.random().toString(36).substr(2, 9),
  type: 'Arbeit',
  street: '',
  postalCode: '',
  city: '',
  country: 'Deutschland',
});

export const DEFAULT_FORM_DATA: ExtendedFormData = {
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

export const COUNTRY_OPTIONS = [
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
