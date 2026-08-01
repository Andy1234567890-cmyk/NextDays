// Stammdaten für den Benutzer-Wizard: Rollen + Berechtigungsmatrix
// (Allgemein + PM-Module). Zentral hier, damit Wizard-Schritt 3 sie nur rendert.

// Rollen für den Wizard — die `value`s sind exakt die DB-UserRoles
// (admin | co_admin | owner | staff | cleaner), damit die Zuweisung beim
// Anlegen 1:1 ins Backend geht.
// Die Bezeichnung kommt aus i18n (account.roles.<value>); hier nur der Wert,
// der 1:1 die DB-Rolle ist.
export const ROLES = [
  { value: "admin" },
  { value: "co_admin" },
  { value: "owner" },
  { value: "staff" },
  { value: "cleaner" },
] as const;

// Gesprochene Sprachen: gespeichert wird weiterhin der deutsche Name (Altbestand
// in users.spoken_languages), angezeigt wird er über Intl.DisplayNames in der
// Sprache der Oberfläche — deshalb der ISO-Code daneben (useLanguageOptions).
export const LANGUAGES = [
  { value: "Arabisch", code: "ar" },
  { value: "Baskisch", code: "eu" },
  { value: "Bulgarisch", code: "bg" },
  { value: "Catalan", code: "ca" },
  { value: "Chinesisch", code: "zh" },
  { value: "Chinesisch (Traditionell)", code: "zh-Hant" },
  { value: "Deutsch", code: "de" },
  { value: "Dänisch", code: "da" },
  { value: "Englisch", code: "en" },
  { value: "Finnisch", code: "fi" },
  { value: "Französisch", code: "fr" },
  { value: "Griechisch", code: "el" },
  { value: "Hebräisch", code: "he" },
  { value: "Holländisch", code: "nl" },
  { value: "Italienisch", code: "it" },
  { value: "Japanisch", code: "ja" },
  { value: "Koreanisch", code: "ko" },
  { value: "Kroatisch", code: "hr" },
  { value: "Litauisch", code: "lt" },
  { value: "Norwegisch", code: "no" },
  { value: "Polnisch", code: "pl" },
  { value: "Portugiesisch", code: "pt" },
  { value: "Rumänisch", code: "ro" },
  { value: "Russisch", code: "ru" },
  { value: "Schwedisch", code: "sv" },
  { value: "Slowakisch", code: "sk" },
  { value: "Slowenisch", code: "sl" },
  { value: "Spanisch", code: "es" },
  { value: "Thai", code: "th" },
  { value: "Tschechisch", code: "cs" },
  { value: "Türkisch", code: "tr" },
  { value: "Ungarisch", code: "hu" },
  { value: "Vietnamesisch", code: "vi" },
  { value: "Serbisch", code: "sr" },
] as const;

// Bezeichnung und Hinweis liegen in i18n (permissions.<id>.label/.hint);
// hier steht nur die Backend-Permission-ID.
export type Permission = { id: string };

// Allgemeine Berechtigungen.
export const GENERAL_PERMISSIONS: Permission[] = [
  { id: "edit_property" },
  { id: "edit_property_contact" },
  { id: "manage_property_settings" },
  { id: "manage_property_conditions" },
  { id: "edit_calendar_bookings" },
  { id: "view_guest_name" },
  { id: "view_guest_contact" },
  { id: "view_guest_id_docs" },
  { id: "edit_guest" },
  { id: "view_booking_source" },
  { id: "sync_ical" },
  { id: "download_booking_report" },
  { id: "access_homepage_builder" },
  { id: "hide_prices" },
  { id: "manage_closed_periods" },
  { id: "access_pm_features" },
  { id: "owner_reporting" },
  { id: "manage_partners" },
];

// PM-Module-Berechtigungen.
export const PM_PERMISSIONS: Permission[] = [
  { id: "pm_manage_booking_images" },
  { id: "pm_manage_property_images" },
  { id: "pm_checkout_alerts" },
  { id: "pm_deposit_alerts" },
  { id: "pm_payment_alerts" },
  { id: "pm_alert_icons" },
  { id: "pm_chat" },
  { id: "pm_edit_comments" },
  { id: "pm_edit_checkin_times" },
  { id: "pm_guest_module" },
  { id: "pm_guest_portal_settings" },
  { id: "pm_revenue_charts" },
  { id: "pm_nonrevenue_charts" },
  { id: "pm_photo_album" },
  { id: "pm_property_area" },
  { id: "pm_guest_details" },
  { id: "pm_booking_total" },
  { id: "pm_owner_email" },
  { id: "pm_booking_payments" },
  { id: "pm_share_alerts" },
  { id: "pm_share_images" },
  { id: "pm_view_add_comments" },
  { id: "pm_view_notes" },
  { id: "pm_view_booking_images" },
  { id: "pm_detailed_payments" },
  { id: "pm_owner_details" },
  { id: "pm_view_property_images" },
  { id: "pm_website_access" },
];

// Posteingang-Berechtigungen (Enterprise: Scope + Aktionen getrennt steuerbar).
// IDs identisch zum Backend (granular_permissions.py) — Single Source of Truth.
// Zugriff selbst = pm_chat (oben). Diese vier steuern, was der Nutzer im
// Posteingang sehen und tun darf.
export const INBOX_PERMISSIONS: Permission[] = [
  { id: "inbox_view_all" },
  { id: "inbox_reply" },
  { id: "inbox_assign" },
  { id: "inbox_manage_config" },
];

// Schritt-Beschriftungen kommen aus i18n (account.userWizard.step*); hier nur
// die stabilen Schlüssel in der Reihenfolge des Wizards.
export const WIZARD_STEPS = [
  "stepContact",
  "stepExtra",
  "stepRole",
  "stepProperties",
] as const;

// Default-Berechtigungen je Rolle (gespiegelt aus dem Backend
// granular_permissions.py). Beim Rollenwechsel im Wizard vorausgewählt; admin =
// alle. Frei überschreibbar.
const ALL_PERMISSION_IDS = [
  ...GENERAL_PERMISSIONS.map((p) => p.id),
  ...PM_PERMISSIONS.map((p) => p.id),
  ...INBOX_PERMISSIONS.map((p) => p.id),
];

export const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  admin: ALL_PERMISSION_IDS,
  co_admin: [
    "edit_property", "edit_property_contact", "manage_property_settings",
    "manage_property_conditions", "edit_calendar_bookings", "view_guest_name",
    "view_guest_contact", "view_guest_id_docs", "edit_guest", "view_booking_source",
    "sync_ical",
    "download_booking_report", "access_homepage_builder", "access_pm_features",
    "pm_manage_booking_images", "pm_manage_property_images", "pm_chat",
    "pm_edit_comments", "pm_edit_checkin_times", "pm_guest_module",
    "pm_revenue_charts", "pm_nonrevenue_charts", "pm_property_area",
    "pm_guest_details", "pm_booking_total", "pm_booking_payments",
    "pm_view_add_comments", "pm_view_notes", "pm_view_booking_images",
    "pm_view_property_images", "pm_website_access",
    "inbox_view_all", "inbox_reply", "inbox_assign", "inbox_manage_config",
    "manage_partners",
  ],
  owner: [
    "owner_reporting", "view_booking_source", "pm_property_area",
    "pm_photo_album", "pm_view_property_images", "pm_nonrevenue_charts",
  ],
  staff: [
    "access_pm_features", "pm_property_area", "pm_alert_icons",
    "pm_checkout_alerts", "pm_view_property_images", "pm_view_notes",
  ],
  cleaner: [
    "access_pm_features", "pm_property_area", "pm_alert_icons",
    "pm_checkout_alerts", "pm_view_property_images", "pm_view_notes",
  ],
};
