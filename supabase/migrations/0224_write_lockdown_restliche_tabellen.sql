-- =========================================================================
-- 0224 — Wurzel 6: Schreibpfad schliessen auf den verbliebenen Tabellen
-- =========================================================================
-- ANLASS (Live-Pruefung gegen die Server-DB, 26.07.2026): 0187 hat die
-- Finanz- und PII-Tabellen gehaertet, aber 118 weitere Tabellen hatten
-- weiterhin pauschale INSERT/UPDATE/DELETE-Grants fuer anon UND authenticated.
-- Darunter Gaeste-Daten (guests, guest_documents, guest_identity_documents),
-- Abo-/Tarifdaten (subscriptions, tenant_subscription, plans) und Vertrieb
-- (customers, leads, deals, quotes).
--
-- WARUM DAS EIN RISIKO IST: Ein Client mit gueltigem JWT + oeffentlichem
-- anon-Key spricht PostgREST DIREKT an (`curl /rest/v1/<tabelle>`) und umgeht
-- den FastAPI-Layer komplett. Eine PERMISSIVE tenant-Policy erlaubt dabei
-- jede Aenderung INNERHALB des eigenen Mandanten — ein Betriebs-Mitarbeiter
-- (staff/cleaner) koennte so z.B. seinen eigenen Tarif umschreiben, Gaeste-
-- Dokumente aendern oder Rechnungsnummern-Sequenzen manipulieren, ohne dass
-- eine einzige Service-Layer-Pruefung greift.
--
-- VORGEHEN (Muster wie 0187):
--   (a) revoke insert, update, delete  -> Schreiben nur noch ueber service_role
--   (b) SELECT bleibt bestehen         -> Realtime-Abos (71 Tabellen) und
--                                         lesende Frontends brechen NICHT
--   (c) RESTRICTIVE `for all`-Guard    -> wo tenant_id existiert; wirkt
--                                         zusaetzlich zur permissiven Policy
--
-- BEWUSST AUSGENOMMEN:
--   storybook_chat  — einziger echter Frontend-Schreibpfad im ganzen Repo
--                     (storybook/components/docs/team-chat.tsx:87, anon-Key).
--                     Interne Doku-Seite; Haertung braucht erst einen
--                     API-Endpunkt, sonst ist der Team-Chat sofort kaputt.
--   schema_migrations — Tracking-Tabelle des Migrations-Runners.
--
-- VERIFIZIERT VOR DER AENDERUNG: Im gesamten Repo gibt es genau ZWEI direkte
-- Supabase-Tabellenzugriffe (`.from(...)`), beide auf storybook_chat. Alle
-- anderen Frontends holen Daten ausschliesslich ueber die FastAPI; ihre
-- supabase-js-Clients dienen nur dem Realtime-SIGNAL (postgres_changes),
-- das lediglich SELECT braucht.
--
-- Alt/Neu-Gegenzustand (Wurzel 1): rein additive Haertung, keine Daten
-- werden veraendert.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1) Tabellen MIT tenant_id — Entzug + RESTRICTIVE Tenant-Guard
-- -------------------------------------------------------------------------
revoke insert, update, delete on public.ari_restriction_outbox from anon, authenticated;
drop policy if exists ari_restriction_outbox_write_restrict on public.ari_restriction_outbox;
create policy ari_restriction_outbox_write_restrict on public.ari_restriction_outbox
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.automation_scheduled_message from anon, authenticated;
drop policy if exists automation_scheduled_message_write_restrict on public.automation_scheduled_message;
create policy automation_scheduled_message_write_restrict on public.automation_scheduled_message
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.channex_booking from anon, authenticated;
drop policy if exists channex_booking_write_restrict on public.channex_booking;
create policy channex_booking_write_restrict on public.channex_booking
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.channex_debug_log from anon, authenticated;
drop policy if exists channex_debug_log_write_restrict on public.channex_debug_log;
create policy channex_debug_log_write_restrict on public.channex_debug_log
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.channex_group_map from anon, authenticated;
drop policy if exists channex_group_map_write_restrict on public.channex_group_map;
create policy channex_group_map_write_restrict on public.channex_group_map
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.channex_rate_plan_map from anon, authenticated;
drop policy if exists channex_rate_plan_map_write_restrict on public.channex_rate_plan_map;
create policy channex_rate_plan_map_write_restrict on public.channex_rate_plan_map
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.channex_room_type_map from anon, authenticated;
drop policy if exists channex_room_type_map_write_restrict on public.channex_room_type_map;
create policy channex_room_type_map_write_restrict on public.channex_room_type_map
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.channex_webhook_event from anon, authenticated;
drop policy if exists channex_webhook_event_write_restrict on public.channex_webhook_event;
create policy channex_webhook_event_write_restrict on public.channex_webhook_event
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.content_blocks from anon, authenticated;
drop policy if exists content_blocks_write_restrict on public.content_blocks;
create policy content_blocks_write_restrict on public.content_blocks
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.customers from anon, authenticated;
drop policy if exists customers_write_restrict on public.customers;
create policy customers_write_restrict on public.customers
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.events from anon, authenticated;
drop policy if exists events_write_restrict on public.events;
create policy events_write_restrict on public.events
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.external_calendar from anon, authenticated;
drop policy if exists external_calendar_write_restrict on public.external_calendar;
create policy external_calendar_write_restrict on public.external_calendar
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.guest_addresses from anon, authenticated;
drop policy if exists guest_addresses_write_restrict on public.guest_addresses;
create policy guest_addresses_write_restrict on public.guest_addresses
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.guest_consents from anon, authenticated;
drop policy if exists guest_consents_write_restrict on public.guest_consents;
create policy guest_consents_write_restrict on public.guest_consents
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.guest_contacts from anon, authenticated;
drop policy if exists guest_contacts_write_restrict on public.guest_contacts;
create policy guest_contacts_write_restrict on public.guest_contacts
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.guest_documents from anon, authenticated;
drop policy if exists guest_documents_write_restrict on public.guest_documents;
create policy guest_documents_write_restrict on public.guest_documents
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.guest_external_ids from anon, authenticated;
drop policy if exists guest_external_ids_write_restrict on public.guest_external_ids;
create policy guest_external_ids_write_restrict on public.guest_external_ids
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.guest_identity_documents from anon, authenticated;
drop policy if exists guest_identity_documents_write_restrict on public.guest_identity_documents;
create policy guest_identity_documents_write_restrict on public.guest_identity_documents
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.guest_notes from anon, authenticated;
drop policy if exists guest_notes_write_restrict on public.guest_notes;
create policy guest_notes_write_restrict on public.guest_notes
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.guest_preferences from anon, authenticated;
drop policy if exists guest_preferences_write_restrict on public.guest_preferences;
create policy guest_preferences_write_restrict on public.guest_preferences
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.guests from anon, authenticated;
drop policy if exists guests_write_restrict on public.guests;
create policy guests_write_restrict on public.guests
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.inbox_ai_settings from anon, authenticated;
drop policy if exists inbox_ai_settings_write_restrict on public.inbox_ai_settings;
create policy inbox_ai_settings_write_restrict on public.inbox_ai_settings
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.inbox_assignment_log from anon, authenticated;
drop policy if exists inbox_assignment_log_write_restrict on public.inbox_assignment_log;
create policy inbox_assignment_log_write_restrict on public.inbox_assignment_log
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.inbox_scheduled_message from anon, authenticated;
drop policy if exists inbox_scheduled_message_write_restrict on public.inbox_scheduled_message;
create policy inbox_scheduled_message_write_restrict on public.inbox_scheduled_message
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.inbox_thread_note from anon, authenticated;
drop policy if exists inbox_thread_note_write_restrict on public.inbox_thread_note;
create policy inbox_thread_note_write_restrict on public.inbox_thread_note
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.jobs from anon, authenticated;
drop policy if exists jobs_write_restrict on public.jobs;
create policy jobs_write_restrict on public.jobs
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.leads from anon, authenticated;
drop policy if exists leads_write_restrict on public.leads;
create policy leads_write_restrict on public.leads
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.message_automation from anon, authenticated;
drop policy if exists message_automation_write_restrict on public.message_automation;
create policy message_automation_write_restrict on public.message_automation
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.message_templates from anon, authenticated;
drop policy if exists message_templates_write_restrict on public.message_templates;
create policy message_templates_write_restrict on public.message_templates
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.message_triggers from anon, authenticated;
drop policy if exists message_triggers_write_restrict on public.message_triggers;
create policy message_triggers_write_restrict on public.message_triggers
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.number_sequences from anon, authenticated;
drop policy if exists number_sequences_write_restrict on public.number_sequences;
create policy number_sequences_write_restrict on public.number_sequences
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.owner_expenses from anon, authenticated;
drop policy if exists owner_expenses_write_restrict on public.owner_expenses;
create policy owner_expenses_write_restrict on public.owner_expenses
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.owner_property_assignments from anon, authenticated;
drop policy if exists owner_property_assignments_write_restrict on public.owner_property_assignments;
create policy owner_property_assignments_write_restrict on public.owner_property_assignments
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.owners from anon, authenticated;
drop policy if exists owners_write_restrict on public.owners;
create policy owners_write_restrict on public.owners
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.partners from anon, authenticated;
drop policy if exists partners_write_restrict on public.partners;
create policy partners_write_restrict on public.partners
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.quotes from anon, authenticated;
drop policy if exists quotes_write_restrict on public.quotes;
create policy quotes_write_restrict on public.quotes
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.reservation_addons from anon, authenticated;
drop policy if exists reservation_addons_write_restrict on public.reservation_addons;
create policy reservation_addons_write_restrict on public.reservation_addons
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.reservation_cancellation_log from anon, authenticated;
drop policy if exists reservation_cancellation_log_write_restrict on public.reservation_cancellation_log;
create policy reservation_cancellation_log_write_restrict on public.reservation_cancellation_log
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.reservation_events from anon, authenticated;
drop policy if exists reservation_events_write_restrict on public.reservation_events;
create policy reservation_events_write_restrict on public.reservation_events
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.sandbox_message from anon, authenticated;
drop policy if exists sandbox_message_write_restrict on public.sandbox_message;
create policy sandbox_message_write_restrict on public.sandbox_message
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.season_templates from anon, authenticated;
drop policy if exists season_templates_write_restrict on public.season_templates;
create policy season_templates_write_restrict on public.season_templates
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.site_blocks from anon, authenticated;
drop policy if exists site_blocks_write_restrict on public.site_blocks;
create policy site_blocks_write_restrict on public.site_blocks
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.site_pages from anon, authenticated;
drop policy if exists site_pages_write_restrict on public.site_pages;
create policy site_pages_write_restrict on public.site_pages
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.subscriptions from anon, authenticated;
drop policy if exists subscriptions_write_restrict on public.subscriptions;
create policy subscriptions_write_restrict on public.subscriptions
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.task_rule_items from anon, authenticated;
drop policy if exists task_rule_items_write_restrict on public.task_rule_items;
create policy task_rule_items_write_restrict on public.task_rule_items
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.task_rules from anon, authenticated;
drop policy if exists task_rules_write_restrict on public.task_rules;
create policy task_rules_write_restrict on public.task_rules
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.task_substitutions from anon, authenticated;
drop policy if exists task_substitutions_write_restrict on public.task_substitutions;
create policy task_substitutions_write_restrict on public.task_substitutions
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.tenant_custom_domains from anon, authenticated;
drop policy if exists tenant_custom_domains_write_restrict on public.tenant_custom_domains;
create policy tenant_custom_domains_write_restrict on public.tenant_custom_domains
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.tenant_module_entitlement from anon, authenticated;
drop policy if exists tenant_module_entitlement_write_restrict on public.tenant_module_entitlement;
create policy tenant_module_entitlement_write_restrict on public.tenant_module_entitlement
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.tenant_onboarding from anon, authenticated;
drop policy if exists tenant_onboarding_write_restrict on public.tenant_onboarding;
create policy tenant_onboarding_write_restrict on public.tenant_onboarding
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.tenant_site_config from anon, authenticated;
drop policy if exists tenant_site_config_write_restrict on public.tenant_site_config;
create policy tenant_site_config_write_restrict on public.tenant_site_config
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.tenant_subscription from anon, authenticated;
drop policy if exists tenant_subscription_write_restrict on public.tenant_subscription;
create policy tenant_subscription_write_restrict on public.tenant_subscription
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.travel_agencies from anon, authenticated;
drop policy if exists travel_agencies_write_restrict on public.travel_agencies;
create policy travel_agencies_write_restrict on public.travel_agencies
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.travel_agency_contacts from anon, authenticated;
drop policy if exists travel_agency_contacts_write_restrict on public.travel_agency_contacts;
create policy travel_agency_contacts_write_restrict on public.travel_agency_contacts
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.travel_agency_contracts from anon, authenticated;
drop policy if exists travel_agency_contracts_write_restrict on public.travel_agency_contracts;
create policy travel_agency_contracts_write_restrict on public.travel_agency_contracts
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.travel_agency_rates from anon, authenticated;
drop policy if exists travel_agency_rates_write_restrict on public.travel_agency_rates;
create policy travel_agency_rates_write_restrict on public.travel_agency_rates
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.whatsapp_conversation from anon, authenticated;
drop policy if exists whatsapp_conversation_write_restrict on public.whatsapp_conversation;
create policy whatsapp_conversation_write_restrict on public.whatsapp_conversation
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.whatsapp_message from anon, authenticated;
drop policy if exists whatsapp_message_write_restrict on public.whatsapp_message;
create policy whatsapp_message_write_restrict on public.whatsapp_message
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- -------------------------------------------------------------------------
-- 2) Tabellen OHNE tenant_id — reiner Grant-Entzug
-- -------------------------------------------------------------------------
-- Ihr Mandanten-Bezug laeuft ueber eine Elterntabelle (property_id,
-- reservation_id, user_id). Ein tenant_id-Guard ist hier nicht
-- formulierbar; der Entzug des Schreibrechts wirkt trotzdem: geschrieben
-- wird ausschliesslich ueber service_role im Backend.

revoke insert, update, delete on public.checklist_items from anon, authenticated;
revoke insert, update, delete on public.checklist_photos from anon, authenticated;
revoke insert, update, delete on public.dashboard_layouts from anon, authenticated;
revoke insert, update, delete on public.deals from anon, authenticated;
revoke insert, update, delete on public.event_periods from anon, authenticated;
revoke insert, update, delete on public.fx_rates from anon, authenticated;
revoke insert, update, delete on public.messages from anon, authenticated;
revoke insert, update, delete on public.owner_properties from anon, authenticated;
revoke insert, update, delete on public.plans from anon, authenticated;
revoke insert, update, delete on public.property_addons from anon, authenticated;
revoke insert, update, delete on public.property_photos from anon, authenticated;
revoke insert, update, delete on public.property_season_assignments from anon, authenticated;
revoke insert, update, delete on public.property_seasons from anon, authenticated;
revoke insert, update, delete on public.quote_line_items from anon, authenticated;
revoke insert, update, delete on public.rate_plan_min_stay_overrides from anon, authenticated;
revoke insert, update, delete on public.rate_plan_price_overrides from anon, authenticated;
revoke insert, update, delete on public.rate_plan_restriction_overrides from anon, authenticated;
revoke insert, update, delete on public.rate_plan_sync_state from anon, authenticated;
revoke insert, update, delete on public.season_periods from anon, authenticated;
revoke insert, update, delete on public.seasons from anon, authenticated;
revoke insert, update, delete on public.sync_lease from anon, authenticated;
revoke insert, update, delete on public.tenants from anon, authenticated;
revoke insert, update, delete on public.user_mfa from anon, authenticated;
