// /Users/andystaudinger/Taskilo/src/types/types.ts

import type * as React from 'react';
import type { DateRange } from 'react-day-picker';

// --- INVOICE API RESPONSE (FastAPI Backend) ---
export interface InvoiceApiResponse {
  id: string;
  company_id: string;
  customer_id: string | null;
  order_id: string | null;
  invoice_number: string;
  invoice_prefix: string | null;
  invoice_sequence: number | null;
  invoice_year: number | null;
  invoice_type: string | null;
  document_type: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_address: string | null;
  customer_tax_number: string | null;
  customer_vat_id: string | null;
  customer_notes: string | null;
  invoice_date: string;
  due_date: string | null;
  delivery_date: string | null;
  paid_at: string | null;
  sent_at: string | null;
  last_reminder_at: string | null;
  net_amount: number;
  tax_amount: number;
  gross_amount: number;
  paid_amount: number | null;
  tax_rate: number | null;
  line_items: Record<string, unknown>[];
  is_kleinunternehmer: boolean | null;
  kleinunternehmer_text: string | null;
  e_invoice_format: string | null;
  e_invoice_xml: string | null;
  leitweg_id: string | null;
  payment_terms_days: number | null;
  payment_terms_text: string | null;
  internal_notes: string | null;
  pdf_url: string | null;
  pdf_generated_at: string | null;
  status: string | null;
  reminder_count: number | null;
  original_invoice_id: string | null;
  storno_reason: string | null;
  storno_document_id: string | null;
  gobd_status: string | null;
  is_locked: boolean;
  locked_at: string | null;
  locked_by: string | null;
  synced_from_order: boolean | null;
  sync_metadata: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
}

// --- COMPANY API RESPONSE (FastAPI Backend) ---
export interface CompanyApiResponse {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  industry: string | null;
  website: string | null;
  logo_url: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  postal_code: string | null;
  country: string;
  tax_id: string | null;
  vat_id: string | null;
  is_active: boolean;
  verified: boolean;
  created_at: string;
  updated_at: string;
  tax_profile: Record<string, unknown> | null;
  profit_estimation: Record<string, unknown> | null;
}

// --- BENUTZER & AUTH ---
/**
 * Interface für die Profildaten eines Benutzers.
 * Vervollständigt mit allen Feldern, die in der App verwendet werden.
 */
export interface UserProfileData {
  uid: string; // Hinzufügen
  email: string; // Hinzufügen
  firstname: string;
  lastname?: string; // Hinzufügen
  user_type?: 'kunde' | 'firma'; // Hinzufügen
  savedPaymentMethods?: SavedPaymentMethod[];
  savedAddresses?: SavedAddress[];
  [key: string]: unknown;
}

/**
 * Interface für eine gespeicherte Adresse eines Benutzers.
 */
export interface SavedAddress {
  id: string;
  name: string;
  line1: string;
  line2?: string;
  city: string;
  postal_code: string;
  country: string;
  isDefault?: boolean;
  type?: 'billing' | 'shipping' | 'other';
}

/**
 * Interface für eine gespeicherte Zahlungsmethode.
 */
export interface SavedPaymentMethod {
  id: string;
  brand?: string;
  last4?: string;
  exp_month?: number;
  exp_year?: number;
  type: string;
}

// --- ANBIETER / TASKER ---

export interface CompanyTaskCategory {
  name: string;
  count: number;
  icon?: React.ReactNode;
}

export interface CompanyHighlightReview {
  text: string;
  reviewerName: string;
  reviewDate: string;
}

/**
 * Definiert die Details eines Anbieters/Unternehmens für das Frontend.
 * Basiert auf deiner Definition, aber `companyName` ist für die UI ein Pflichtfeld.
 */
export interface AnbieterDetails {
  id: string;
  companyName: string; // Gemacht zum Pflichtfeld für stabile UI
  firmenname?: string; // Beibehalten für Kompatibilität
  profilePictureURL?: string;
  profilbildUrl?: string;
  hourlyRate?: number | string;
  description?: string;
  selectedSubcategory?: string;
  subCategory?: string;
  languages?: string;
  skills?: string[]; // Hinzugefügt für Skills/Fähigkeiten Badges
  postalCode?: string;
  city?: string;
  address?: string;
  minimumHours?: number;
  projectImages?: string[];
  location?: string;
  estimatedDuration?: string;
  taskRequiresCar?: boolean;
  taskCategories?: CompanyTaskCategory[];
  vehicleInfo?: string;
  highlightReview?: CompanyHighlightReview;
  country?: string;
  state?: string;
  totalCalculatedPrice?: number;
}

// ====================================================================
// HIER IST DIE HINZUGEFÜGTE ÄNDERUNG
// ====================================================================
/**
 * Erstellt einen Alias namens 'Company', der auf 'AnbieterDetails' verweist.
 * Dies löst den Import-Fehler in anderen Dateien, ohne sie ändern zu müssen.
 */
export type Company = AnbieterDetails;
// ====================================================================

/**
 * Repräsentiert die Rohdaten von der API. Enthält alle möglichen Feldnamen.
 */
export interface ApiAnbieter {
  id: string;
  firmenname?: string;
  companyName?: string;
  profilbildUrl?: string;
  profilePictureURL?: string;
  hourlyRate?: number | string;
  description?: string;
  stripeAccountId?: string;
  // Hier können bei Bedarf weitere API-Felder hinzugefügt werden
}

export interface RatingInfo {
  avg: number;
  count: number;
  subCounts?: Record<string, number>;
  category?: string;
}

export interface RatingMap {
  [companyId: string]: RatingInfo;
}

export interface ExpandedDescriptionsMap {
  [companyId: string]: boolean;
}

// --- BUCHUNG & AUFTRAG ---

export interface TaskDetails {
  description: string;
}

export interface BookingCharacteristics {
  datePickerMode: 'single' | 'range';
  durationLabel: string;
  durationPlaceholder: string;
  durationHint: string;
  isDurationPerDay: boolean;
  defaultDurationHours: number;
}

export interface DateTimeSelectionPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (dateSelection?: Date | DateRange, time?: string, duration?: string) => void;
  initialDateRange?: DateRange;
  initialTime?: string;
  initialDuration?: string;
  contextCompany?: AnbieterDetails | null;
  bookingSubcategory?: string | null;
}

export interface OrderListItem {
  id: string;
  selectedSubcategory: string;
  status: string;
  totalPriceInCents: number;
  jobDateFrom?: string;
  jobTimePreference?: string;
  providerName?: string;
}

export interface AngebotDetails {
  price: number;
  description?: string;
}

export interface OrderSummaryProps {
  anbieterDetails: AnbieterDetails | null;
  angebotDetails: AngebotDetails | null;
  dateFrom: string | null;
  dateTo: string | null;
  time: string | null;
}

export interface PaymentDetailsFormProps {
  checkoutData?: Record<string, unknown>;
  onCheckoutAttempted?: (error?: string) => void;
}
