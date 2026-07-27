-- =========================================================================
-- 0229 — Wurzel 6: letzte offene Schreibpfade + Backstop-Reparatur
-- =========================================================================
-- ANLASS (Live-Pruefung gegen die Server-DB, 27.07.2026): trotz 0187 und
-- 0224 haben 32 Tabellen weiterhin pauschale INSERT/UPDATE/DELETE-Grants
-- fuer anon UND authenticated. Abfrage gegen information_schema.role_table_grants
-- lieferte 34 Treffer, davon 2 bewusste Ausnahmen (siehe unten).
--
-- WARUM DAS TROTZ RLS EIN RISIKO IST: Die Rollen-Restriktionen aus 0059
-- (owner), 0136/0155 (staff) und 0128 (Dossier) sind AUSNAHMSLOS
-- `as restrictive FOR SELECT`. Eine restriktive SELECT-Policy wirkt nicht
-- auf INSERT/UPDATE/DELETE. Uebrig bleibt die permissive tenant-`for all`-
-- Policy — die jede Aenderung INNERHALB des eigenen Mandanten erlaubt.
-- Ein eingeloggter cleaner mit dem oeffentlichen anon-Key kann also per
-- `curl /rest/v1/<tabelle>` am FastAPI-Layer vorbei schreiben.
--
-- KONKRET NACHGEWIESENE ANGRIFFE (die drei schwersten):
--   staff_property_assignments — sich selbst jedem Objekt zuweisen und damit
--     den eigenen staff_can_see_property-Scope auf Tuercodes, Dossier und
--     Reservierungen ausweiten (Rechteausweitung per INSERT).
--   property_guest_portal — door_code/self_checkin FREMDER Objekte setzen:
--     einen selbst gewaehlten Tuercode hinterlegen = physischer Zugang.
--   reservations — fremde Buchungen aendern/stornieren, Betraege und
--     Gast-PII manipulieren.
--
-- VORGEHEN (Muster wie 0187/0224):
--   (a) revoke insert, update, delete  -> Schreiben nur noch ueber service_role
--   (b) SELECT bleibt bestehen         -> Realtime-Abos und lesende Frontends
--                                         brechen NICHT
--   (c) RESTRICTIVE `for all`-Guard    -> wo tenant_id existiert; wirkt
--                                         zusaetzlich zur permissiven Policy
--
-- BEWUSST AUSGENOMMEN (unveraendert aus 0224):
--   storybook_chat    — einziger echter Frontend-Schreibpfad (interne
--                       Doku-Seite, storybook/components/docs/team-chat.tsx).
--   schema_migrations — Tracking-Tabelle des Migrations-Runners.
--
-- Alt/Neu-Gegenzustand (Wurzel 1): rein additive Haertung, keine Daten
-- werden veraendert.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1) Tabellen MIT tenant_id — Entzug + RESTRICTIVE Tenant-Guard
-- -------------------------------------------------------------------------
revoke insert, update, delete on public.ari_outbox from anon, authenticated;
drop policy if exists ari_outbox_write_restrict on public.ari_outbox;
create policy ari_outbox_write_restrict on public.ari_outbox
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.block_requests from anon, authenticated;
drop policy if exists block_requests_write_restrict on public.block_requests;
create policy block_requests_write_restrict on public.block_requests
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.channex_channel_connection from anon, authenticated;
drop policy if exists channex_channel_connection_write_restrict on public.channex_channel_connection;
create policy channex_channel_connection_write_restrict on public.channex_channel_connection
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.channex_property_map from anon, authenticated;
drop policy if exists channex_property_map_write_restrict on public.channex_property_map;
create policy channex_property_map_write_restrict on public.channex_property_map
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.inventory_items from anon, authenticated;
drop policy if exists inventory_items_write_restrict on public.inventory_items;
create policy inventory_items_write_restrict on public.inventory_items
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.message_template from anon, authenticated;
-- message_template hat aus 0037 bereits je eine RESTRICTIVE Policy fuer
-- INSERT/UPDATE/DELETE; ein zusaetzlicher `for all`-Guard waere redundant.

revoke insert, update, delete on public.meter_readings from anon, authenticated;
-- Gegenzustand (Wurzel 1): die permissive `meter_readings_insert`-Policy aus
-- 0013 erlaubte Eigentuemern das direkte Erfassen per PostgREST. Der Weg
-- laeuft heute ueber POST /public-portal/meter-readings (public_portal-Slice),
-- also service_role — die Policy wird mit dem Grant-Entzug wirkungslos und
-- verschwindet hier, damit kein toter Schreibpfad dokumentiert bleibt.
drop policy if exists meter_readings_insert on public.meter_readings;
drop policy if exists meter_readings_write_restrict on public.meter_readings;
create policy meter_readings_write_restrict on public.meter_readings
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.property_pricing_config from anon, authenticated;
drop policy if exists property_pricing_config_write_restrict on public.property_pricing_config;
create policy property_pricing_config_write_restrict on public.property_pricing_config
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.reservations from anon, authenticated;
drop policy if exists reservations_write_restrict on public.reservations;
create policy reservations_write_restrict on public.reservations
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.staff_property_assignments from anon, authenticated;
drop policy if exists staff_property_assignments_write_restrict on public.staff_property_assignments;
create policy staff_property_assignments_write_restrict on public.staff_property_assignments
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.stop_sell from anon, authenticated;
drop policy if exists stop_sell_write_restrict on public.stop_sell;
create policy stop_sell_write_restrict on public.stop_sell
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.tasks from anon, authenticated;
drop policy if exists tasks_write_restrict on public.tasks;
create policy tasks_write_restrict on public.tasks
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- -------------------------------------------------------------------------
-- 2) Tabellen OHNE tenant_id — reiner Grant-Entzug
-- -------------------------------------------------------------------------
-- Alle 20 haengen per property_id an einer Elterntabelle (live gegen
-- information_schema.columns geprueft). Ein tenant_id-Guard ist hier nicht
-- formulierbar; der Entzug wirkt trotzdem: geschrieben wird ausschliesslich
-- ueber service_role im Backend.

-- Kalender / Preise — Sabotage wirkt via Sync auf ALLE Vertriebskanaele
revoke insert, update, delete on public.availability from anon, authenticated;
revoke insert, update, delete on public.price_overrides from anon, authenticated;
revoke insert, update, delete on public.rate_plans from anon, authenticated;
revoke insert, update, delete on public.dynamic_prices from anon, authenticated;
revoke insert, update, delete on public.dp_settings from anon, authenticated;
revoke insert, update, delete on public.dp_pickup_snapshots from anon, authenticated;
revoke insert, update, delete on public.season_assignments from anon, authenticated;
revoke insert, update, delete on public.surcharges from anon, authenticated;

-- Objekt-Dossier (0127) — SELECT ist seit 0128/0155 gescoped, Schreiben war offen
revoke insert, update, delete on public.property_access from anon, authenticated;
revoke insert, update, delete on public.property_emergency_authority from anon, authenticated;
revoke insert, update, delete on public.property_guest_portal from anon, authenticated;
revoke insert, update, delete on public.property_housebook from anon, authenticated;
revoke insert, update, delete on public.property_marketing from anon, authenticated;
revoke insert, update, delete on public.property_platform_launches from anon, authenticated;
revoke insert, update, delete on public.property_process from anon, authenticated;
revoke insert, update, delete on public.property_service_agreements from anon, authenticated;
revoke insert, update, delete on public.property_tradespeople from anon, authenticated;

-- Operatives / Altbestand ohne Service-Anbindung
revoke insert, update, delete on public.task_rule_assignments from anon, authenticated;
revoke insert, update, delete on public.co_owners from anon, authenticated;
revoke insert, update, delete on public.content_assignments from anon, authenticated;

-- -------------------------------------------------------------------------
-- 3) SECURITY DEFINER: PUBLIC-execute entziehen
-- -------------------------------------------------------------------------
-- 0213 enthaelt `revoke execute ... from anon, authenticated` fuer beide
-- Cohost-Helper — wirkungslos, weil das Recht ueber das implizite
-- PUBLIC-Grant kommt und ein revoke von anon/authenticated ein PUBLIC-Grant
-- nicht entfernt. Live-Gegenprobe (27.07.2026):
--   has_function_privilege('authenticated','public.is_cohost_of(uuid)','execute') = true
-- Beide Funktionen sind SECURITY DEFINER auf property_cohosts, das fuer
-- anon/authenticated gesperrt ist — also ein Umgehungspfad auf gesperrte
-- Daten. Erst PUBLIC entziehen, dann gezielt service_role gewaehren.
revoke execute on function public.is_cohost_of(uuid) from public, anon, authenticated;
grant execute on function public.is_cohost_of(uuid) to service_role;

revoke execute on function public.cohost_access_of(uuid) from public, anon, authenticated;
grant execute on function public.cohost_access_of(uuid) to service_role;

-- next_document_number laeuft mit `set search_path = public` statt ''
-- (Regelverstoss Wurzel 6). Execute ist seit 0107 entzogen, die Funktion ist
-- damit nur ueber service_role erreichbar — trotzdem auf das sichere Muster
-- umstellen: leerer search_path + schema-qualifizierte Referenzen.
alter function public.next_document_number(uuid, text, text) set search_path = '';

-- current_db_role, is_platform_admin, diagnostics_freigabe_laeuft,
-- owner_can_see_property und staff_can_see_property behalten PUBLIC-execute
-- BEWUSST: sie werden live in 12 RLS-Policies ausgewertet (pg_policies
-- gegengeprueft) und muessen fuer authenticated aufrufbar bleiben, sonst
-- schlagen die Policies fehl.

-- -------------------------------------------------------------------------
-- 4) Backstop-Reparatur: Default Privileges fuer supabase_admin
-- -------------------------------------------------------------------------
-- 0187 hat den Backstop nur `for role postgres` gesetzt. Die Migrationen
-- laufen aber als supabase_admin (supabase/apply-migrations.sh:33,
-- MIGRATE_DB_USER=supabase_admin) — und Default Privileges wirken nur auf
-- Objekte, die von der GENANNTEN Rolle erzeugt werden. Live-Gegenprobe
-- (pg_default_acl, 27.07.2026): fuer supabase_admin standen Tabellen noch
-- auf `anon=arwdDxt`, also volle Schreibrechte fuer JEDE neue Tabelle.
-- Genau deshalb riss die Luecke nach 0187 und nach 0224 immer wieder auf.
alter default privileges for role supabase_admin in schema public
    revoke insert, update, delete on tables from anon, authenticated;

alter default privileges for role supabase_admin in schema public
    revoke execute on functions from anon, authenticated;

-- -------------------------------------------------------------------------
-- 5) Einmaliger Backstop aus CLAUDE.md
-- -------------------------------------------------------------------------
-- Ohne diesen Entzug koennte ein eingeloggter Nutzer eigene Objekte im
-- public-Schema anlegen (und damit z.B. Funktionen unter eigener Kontrolle).
revoke create on schema public from anon, authenticated;
