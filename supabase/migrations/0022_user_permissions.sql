-- 0022_user_permissions.sql
-- Feingranulare Lodgify-Berechtigungen pro Nutzer (Konto → Benutzer).
-- Set aktivierter Berechtigungs-IDs (Allgemein + PM-Module). Admin = effektiv
-- alle (Durchsetzung im Backend, lodgify_permissions.py). Default: leer.

alter table public.users
  add column if not exists permissions jsonb not null default '[]'::jsonb;

comment on column public.users.permissions is
  'Lodgify-Berechtigungs-IDs (Allgemein + PM-Module). Admin = effektiv alle.';

-- Bestand: Admins erhalten alle 43 Berechtigungen.
update public.users set permissions = to_jsonb(array[
  'edit_property','edit_property_contact','manage_property_settings','manage_property_conditions',
  'edit_calendar_bookings','view_guest_name','view_guest_contact','view_booking_source','sync_ical',
  'download_booking_report','access_homepage_builder','hide_prices','manage_closed_periods',
  'access_pm_features','owner_reporting',
  'pm_manage_booking_images','pm_manage_property_images','pm_checkout_alerts','pm_deposit_alerts',
  'pm_payment_alerts','pm_alert_icons','pm_chat','pm_edit_comments','pm_edit_checkin_times',
  'pm_guest_module','pm_guest_portal_settings','pm_revenue_charts','pm_nonrevenue_charts',
  'pm_photo_album','pm_property_area','pm_guest_details','pm_booking_total','pm_owner_email',
  'pm_booking_payments','pm_share_alerts','pm_share_images','pm_view_add_comments','pm_view_notes',
  'pm_view_booking_images','pm_detailed_payments','pm_owner_details','pm_view_property_images','pm_website_access'
]) where role = 'admin' and permissions = '[]'::jsonb;
