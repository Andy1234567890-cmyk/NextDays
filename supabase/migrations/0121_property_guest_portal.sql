-- 0121_property_guest_portal.sql — Gästeportal je Objekt: Gastmodul + Gästemappe
--
-- Zwei objektbezogene Tabellen für den PM-Objektbereich (Lodgify „Gastmodul" +
-- „Gästemappe"):
--   * property_guest_portal — Portal-Einstellungen (Kontakt, WiFi, Self-Check-in,
--     Türcode + Anzeige-Regeln, Wartungs-Telefon, Kopfbild). Genau EINE Zeile je
--     Objekt (property_id UNIQUE).
--   * property_guidebook — redigierbare Info-Mappe (Abschnitte), die im
--     Gästeportal erscheint. Genau EINE Zeile je Objekt.
--
-- Beide: RLS über property -> tenant (Muster property_addons 0074 / property_photos
-- 0061), set_updated_at-Trigger, Realtime-Publication. WiFi-Passwort/Türcode sind
-- sensibel — die Maskierung/Rechteprüfung passiert im Service (nicht in der DB).

-- === Gastmodul: Portal-Einstellungen je Objekt =============================
create table public.property_guest_portal (
    id                     uuid primary key default gen_random_uuid(),
    property_id            uuid not null unique
                           references public.properties (id) on delete cascade,
    enabled                boolean not null default false,
    contact_name           text,
    contact_phone          text,
    self_checkin           boolean not null default false,
    -- Türcode + Anzeige-Regeln. Der Türzugangs-TEXT (Anfahrt zur Tür, Lage des
    -- Schlüssels …) liegt bewusst in messaging.doorInstructions, NICHT hier —
    -- diese Tabelle hält nur den strukturierten Code + die Regeln.
    door_code              text,
    show_code_only_if_paid boolean not null default false,
    hide_code_until_checkin boolean not null default false,
    code_visible_from      time,          -- ab welcher Uhrzeit am Check-in-Tag
    maintenance_phone      text,
    header_image_path      text,          -- Storage-Key des Kopfbilds
    created_at             timestamptz not null default now(),
    updated_at             timestamptz not null default now()
);

-- Hinweis WLAN: Der WLAN-TEXT (SSID/Passwort/Verbindungshinweis) liegt in
-- messaging.wifi (mehrsprachig, mit Shortcode {{WifiInformation}}), NICHT hier.
-- Diese Tabelle ist ausschließlich für strukturierte Schalter/Regeln.

create trigger set_updated_at before update on public.property_guest_portal
    for each row execute function public.set_updated_at();

alter table public.property_guest_portal enable row level security;
create policy property_guest_portal_via_property on public.property_guest_portal
  for all using (exists (
    select 1 from public.properties p
    where p.id = property_guest_portal.property_id
      and p.tenant_id = public.current_tenant_id()))
  with check (exists (
    select 1 from public.properties p
    where p.id = property_guest_portal.property_id
      and p.tenant_id = public.current_tenant_id()));

-- Hinweis Gästemappe: KEINE eigene Tabelle — die Gästemappe-Inhalte
-- (Hausordnung, Check-in, WLAN, Reiseführer, …) laufen über die bereits
-- vorhandenen content_blocks (kind=house_rules/checkin/guide/… + body_i18n
-- mehrsprachig, Lastenheft §5) und content_assignments (Block → Objekt),
-- Migration 0014. Diese Tabellen haben RLS + Realtime, waren nur noch nicht
-- angebunden. Kein Doppel-Datenmodell.

-- === Realtime (idempotenter Guard, Muster 0048/0120) =======================
do $$
declare
  t text;
  tables text[] := array['property_guest_portal'];
begin
  foreach t in array tables loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
