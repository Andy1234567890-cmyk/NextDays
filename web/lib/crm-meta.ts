// CRM: Typen und Wertelisten (KEIN "use server" — hier stehen Konstanten).
// Spiegel von apps/api/src/features/crm/common.py und den CHECK-Constraints
// aus Migration 0597. Ein neuer Status/Quelle gehört an BEIDE Stellen.

export type LeadStatus =
  | "new"
  | "contacted"
  | "visit_scheduled"
  | "offer_sent"
  | "contract_sent"
  | "won"
  | "lost";

export const LEAD_STATUSES: readonly LeadStatus[] = [
  "new",
  "contacted",
  "visit_scheduled",
  "offer_sent",
  "contract_sent",
  "won",
  "lost",
];

// Zustandsgraph (common.LEAD_TRANSITIONS) — die Oberfläche bietet nur an,
// was der Server annimmt; `won` gibt es ausschließlich über die Konvertierung.
export const LEAD_TRANSITIONS: Record<LeadStatus, readonly LeadStatus[]> = {
  new: ["contacted", "lost"],
  contacted: ["visit_scheduled", "offer_sent", "lost"],
  visit_scheduled: ["contacted", "offer_sent", "lost"],
  offer_sent: ["visit_scheduled", "contract_sent", "lost"],
  contract_sent: ["offer_sent", "lost"],
  lost: ["contacted"],
  won: [],
};

export type LeadSource =
  | "website"
  | "referral"
  | "portal"
  | "event"
  | "cold_call"
  | "social"
  | "other";

export const LEAD_SOURCES: readonly LeadSource[] = [
  "website",
  "referral",
  "portal",
  "event",
  "cold_call",
  "social",
  "other",
];

export type Lead = {
  id: string;
  tenant_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  lead_source: LeadSource | null;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  object_street: string | null;
  object_house_number: string | null;
  object_postal_code: string | null;
  object_city: string | null;
  object_country: string | null;
  object_sqm: number | null;
  object_max_guests: number | null;
  assigned_user_id: string | null;
  next_action_at: string | null;
  status: LeadStatus;
  lost_reason: string | null;
  // Altfelder (0013), nur lesbar.
  address: string | null;
  object_address: string | null;
  notes: string | null;
  converted_owner_id: string | null;
  converted_property_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type LeadNote = {
  id: string;
  lead_id: string;
  author_id: string | null;
  body: string;
  created_at: string | null;
};

export type LeadConvertResult = {
  lead: Lead;
  owner_id: string;
  property_id: string | null;
  bereits_konvertiert: boolean;
};

export type Partner = {
  id: string;
  tenant_id: string;
  name: string;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  // Altfelder (0013), nur lesbar.
  address: string | null;
  contact_info: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type DiscountKind = "percent" | "fixed";

export type Deal = {
  id: string;
  tenant_id: string;
  partner_id: string;
  discount_kind: DiscountKind;
  discount_value: number;
  currency: string | null;
  discount_code: string | null;
  gueltig_von: string | null;
  gueltig_bis: string | null;
  im_gastportal_sichtbar: boolean;
  hat_qr_bild: boolean;
  created_at: string | null;
  updated_at: string | null;
};
