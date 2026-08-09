-- =========================================================================
-- 0337 — Wurzel 6: DB-Direktpfad auf ALLE Tabellen mit sensiblen Daten
--        schliessen. Fortsetzung und Abschluss von 0336 (nur `guests`).
-- =========================================================================
-- AUSGANGSLAGE (Live-Bestandsaufnahme gegen die Server-DB, 08.08.2026):
-- 0336 hat public.guests geschlossen und den Default-Privileges-Backstop
-- repariert, aber ausdruecklich NUR diese eine Tabelle. Die Gegenprobe ueber
-- alle 195 Tabellen in `public` zeigte, dass daneben 130 weitere Tabellen ein
-- pauschales SELECT fuer anon UND authenticated tragen — darunter der komplette
-- Rest der Gast-Akte, alle Nachrichteninhalte, IBAN/CPR der Eigentuemer und
-- die Vertriebsdaten. Fast alle davon haben ausschliesslich Tenant-Policies
-- (`tenant_id = current_tenant_id()`) und pruefen die ROLLE innerhalb des
-- Mandanten nirgends — genau die Luecke aus Wurzel 6.
--
-- Der Angriffsweg ist derselbe wie bei guests und braucht keinen Exploit:
--   curl -H "apikey: <anon>" -H "Authorization: Bearer <cleaner-JWT>" \
--        "$SUPABASE_URL/rest/v1/owners?select=*"
-- PostgREST antwortet direkt aus der DB, der FastAPI-Layer mit seiner
-- Rollen-Maskierung (guest_masking.py) und dem Rollen-Datensplit (§ 4.2/4.3)
-- wird komplett umgangen.
--
-- WAS AUSGEWERTET WURDE, um „sensibel" zu entscheiden (CLAUDE.md, Wurzel 6):
-- personenbezogene Daten (Name/Adresse/Kontakt/Geburtsdatum/Ausweis/CPR/
-- Nationalitaet), Finanzdaten (Betraege/IBAN/Umsatz/Provision), Zugangsdaten
-- und Secrets, Tuercodes/Schluesselablage, Nachrichteninhalte, Vertriebsdaten.
-- Grundlage war die Spaltenliste JEDER Tabelle mit SELECT fuer authenticated,
-- nicht der Tabellenname.
--
-- MUSTER (aus 0172/0182/0187/0336, unveraendert uebernommen):
--   (a) revoke select, insert, update, delete from anon, authenticated
--       — vollstaendig alle vier Rechte, auch die schon fehlenden, damit der
--         Entzug den ENDZUSTAND beschreibt und ein spaeteres `grant all` die
--         Luecke nicht unbemerkt wieder aufreisst.
--   (b) RESTRICTIVE `for all`-Guard, NICHT `for select` — eine reine
--       SELECT-Restriktion laesst den SCHREIB-Pfad tenant-weit offen (der
--       Fehler, den 0187 fuer commission_ledger beschreibt).
--   (c) aus der Publikation `supabase_realtime` nehmen, wo das Abo dadurch
--       zur stummen Attrappe wuerde. Ein Re-Grant „zur Reparatur des Abos"
--       ist ausdruecklich der falsche Weg — bei gesperrten Tabellen ist das
--       ABO der Fehler und wird im Frontend auf eine erlaubte Quelle
--       umgehaengt (hier: `reservations`, siehe Abschnitt 9).
--
-- service_role (rolbypassrls = t, live gegengeprueft) ist vom Entzug NICHT
-- betroffen: die FastAPI liest und schreibt weiter unveraendert.
--
-- Alt/Neu-Gegenzustand (Wurzel 1): rein entziehende Haertung. Es wird KEINE
-- Datenzeile angefasst und KEIN Schema geaendert.
--
-- BEWUSST OFFEN GELASSEN (mit Begruendung, siehe Abschnitt 10 am Ende):
-- Stammdaten ohne Personenbezug (Preise, Verfuegbarkeit, Objekt-Ausstattung,
-- Aufgaben-Metadaten) und die gast-eigenen Selbst-Scopes, deren Policy an
-- `uid()` haengt statt am Mandanten.
-- =========================================================================


-- -------------------------------------------------------------------------
-- 1) GAST-AKTE — gleichwertig zum bereits geschlossenen `guests`.
-- -------------------------------------------------------------------------
-- Diese acht Tabellen sind die Gast-Akte, die 0336 an der Wurzel (guests)
-- geschlossen hat, ohne die Blaetter mitzunehmen. Der Schutz war damit
-- wirkungslos: wer guests nicht mehr lesen darf, holt Name und Anschrift
-- stattdessen aus guest_addresses (street, house_no, postal_code, city,
-- country), die Kontaktdaten aus guest_contacts (value = Mail/Telefon) und
-- die AUSWEISDATEN aus guest_identity_documents (doc_type, number,
-- issuing_country, valid_until) — alle mit guest_id, also verknuepfbar.
-- guest_notes traegt Freitext des Betriebs ueber den Gast, guest_documents
-- die storage_path-Verweise auf hochgeladene Ausweiskopien, guest_consents
-- den DSGVO-Einwilligungsstatus und guest_preferences u. a. `dietary`
-- (Ernaehrung → Art.-9-nah). guest_external_ids verknuepft den Gast mit
-- seiner OTA-Identitaet.
-- Alle acht haengen am Mandanten und werden ausschliesslich ueber die API
-- gelesen (guests-Slice, listAddresses/listContacts/listIdentityDocs/…),
-- kein Frontend liest sie direkt (live verifiziert: 0 Treffer auf `.from(`).

revoke select, insert, update, delete on public.guest_addresses from anon, authenticated;
drop policy if exists guest_addresses_tenant_restrict on public.guest_addresses;
create policy guest_addresses_tenant_restrict on public.guest_addresses
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke select, insert, update, delete on public.guest_contacts from anon, authenticated;
drop policy if exists guest_contacts_tenant_restrict on public.guest_contacts;
create policy guest_contacts_tenant_restrict on public.guest_contacts
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke select, insert, update, delete on public.guest_identity_documents from anon, authenticated;
drop policy if exists guest_identity_documents_tenant_restrict on public.guest_identity_documents;
create policy guest_identity_documents_tenant_restrict on public.guest_identity_documents
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke select, insert, update, delete on public.guest_documents from anon, authenticated;
drop policy if exists guest_documents_tenant_restrict on public.guest_documents;
create policy guest_documents_tenant_restrict on public.guest_documents
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke select, insert, update, delete on public.guest_notes from anon, authenticated;
drop policy if exists guest_notes_tenant_restrict on public.guest_notes;
create policy guest_notes_tenant_restrict on public.guest_notes
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke select, insert, update, delete on public.guest_consents from anon, authenticated;
drop policy if exists guest_consents_tenant_restrict on public.guest_consents;
create policy guest_consents_tenant_restrict on public.guest_consents
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke select, insert, update, delete on public.guest_preferences from anon, authenticated;
drop policy if exists guest_preferences_tenant_restrict on public.guest_preferences;
create policy guest_preferences_tenant_restrict on public.guest_preferences
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke select, insert, update, delete on public.guest_external_ids from anon, authenticated;
drop policy if exists guest_external_ids_tenant_restrict on public.guest_external_ids;
create policy guest_external_ids_tenant_restrict on public.guest_external_ids
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());


-- -------------------------------------------------------------------------
-- 2) NACHRICHTENINHALTE — Betriebs-Seite.
-- -------------------------------------------------------------------------
-- Nachrichten sind Kommunikationsinhalt zwischen Gast und Betrieb: Wurzel 6
-- nennt sie ausdruecklich als Beispiel fuer „nur der Server darf das lesen".
-- Alle folgenden Tabellen haben eine reine Tenant-Policy, also liest jede
-- Rolle im Mandanten (auch cleaner, auch owner) tenant-weit ALLE Nachrichten.
--
-- guest_messages / guest_message_threads sind der Sonderfall: sie tragen
-- ZWEI Zugriffswelten in EINER Policy —
--     guest_threads_guest_read :: portal_guest_id = uid() OR tenant_id = …
--     guest_messages_thread_read :: ueber den Thread, dieselbe Oder-Verzweigung
-- Der linke Zweig ist der GAST auf seinen EIGENEN Thread (Selbst-Scope am
-- uid(), dasselbe sichere Muster wie wishlists in 0235 — der Gast erreicht
-- ausschliesslich seine eigene Konversation). Der rechte Zweig ist der
-- tenant-weite Betriebszugriff ohne jede Rollenpruefung; genau der ist der
-- Befund. Er wird hier abgeschnitten, der Gast-Zweig bleibt.
-- Damit bleibt der Marktplatz-Chat des Gastes (plattform/) live, waehrend die
-- Betriebs-Seite (gastgeber/, web/) ausschliesslich ueber den host_messages-
-- Slice (service_role) liest — dort sitzt die Zugriffspruefung.

drop policy if exists guest_threads_guest_read on public.guest_message_threads;
create policy guest_threads_guest_read on public.guest_message_threads
    for select
    using (portal_guest_id = (select auth.uid()));

comment on policy guest_threads_guest_read on public.guest_message_threads is
  'Wurzel 6 (0337): NUR der Selbst-Scope des Gastes (portal_guest_id = uid()). '
  'Der frueher mit-veroderte Zweig tenant_id = current_tenant_id() gab jeder '
  'Rolle im Mandanten — auch cleaner — tenant-weit alle Konversationen ueber '
  'den DB-Direktpfad. Die Betriebs-Seite liest ausschliesslich ueber den '
  'host_messages-Slice (service_role) mit Zugriffspruefung.';

drop policy if exists guest_messages_thread_read on public.guest_messages;
create policy guest_messages_thread_read on public.guest_messages
    for select
    using (exists (
        select 1 from public.guest_message_threads t
        where t.id = guest_messages.thread_id
          and t.portal_guest_id = (select auth.uid())));

comment on policy guest_messages_thread_read on public.guest_messages is
  'Wurzel 6 (0337): NUR der eigene Thread des Gastes. Der tenant-weite Zweig '
  'ist entfallen — Nachrichteninhalt des Betriebs kommt ueber den '
  'host_messages-Slice (service_role), nicht ueber PostgREST.';

-- Schreiben bleibt in BEIDEN Welten serverseitig: der Gast soll keine
-- Nachricht an der Validierung/Sperrpruefung (guest_blocks) vorbei einstellen.
revoke insert, update, delete on public.guest_messages from anon, authenticated;
revoke insert, update, delete on public.guest_message_threads from anon, authenticated;
revoke select on public.guest_messages from anon;
revoke select on public.guest_message_threads from anon;

-- messages: Nachrichten an einer Reservierung (Freitext, Kanal). Reine
-- Tenant-Policy ueber die Eltern-Reservierung, kein Rollen-Guard, 0 restriktive
-- Policies. Gelesen wird ueber den reservations-/inbox-Slice.
revoke select, insert, update, delete on public.messages from anon, authenticated;
drop policy if exists messages_tenant_restrict on public.messages;
create policy messages_tenant_restrict on public.messages
    as restrictive for all
    using (exists (
        select 1 from public.reservations r
        where r.id = messages.reservation_id
          and r.tenant_id = public.current_tenant_id()))
    with check (exists (
        select 1 from public.reservations r
        where r.id = messages.reservation_id
          and r.tenant_id = public.current_tenant_id()));

-- whatsapp_conversation/-message: Gastname, Telefonnummer (wa_phone) und der
-- Nachrichtentext (body) im Klartext.
revoke select, insert, update, delete on public.whatsapp_conversation from anon, authenticated;
drop policy if exists whatsapp_conversation_tenant_restrict on public.whatsapp_conversation;
create policy whatsapp_conversation_tenant_restrict on public.whatsapp_conversation
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke select, insert, update, delete on public.whatsapp_message from anon, authenticated;
drop policy if exists whatsapp_message_tenant_restrict on public.whatsapp_message;
create policy whatsapp_message_tenant_restrict on public.whatsapp_message
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- portal_messages: OTA-Nachrichten (sender, body, raw-Payload).
revoke select, insert, update, delete on public.portal_messages from anon, authenticated;
drop policy if exists portal_messages_tenant_restrict on public.portal_messages;
create policy portal_messages_tenant_restrict on public.portal_messages
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- sandbox_message: Nachrichtentext im Channex-Sandbox-Kanal.
revoke select, insert, update, delete on public.sandbox_message from anon, authenticated;
drop policy if exists sandbox_message_tenant_restrict on public.sandbox_message;
create policy sandbox_message_tenant_restrict on public.sandbox_message
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- automation_scheduled_message / inbox_scheduled_message: der `body` der
-- geplanten Nachricht. Beide hatten einen RESTRICTIVE-Rollen-Guard nur `for
-- select`; das reine SELECT-Grant war der offene Rest.
revoke select, insert, update, delete on public.automation_scheduled_message from anon, authenticated;
revoke select, insert, update, delete on public.inbox_scheduled_message from anon, authenticated;

-- inbox_thread_note: interne Notiz zu einem Gast-Thread (Freitext).
revoke select, insert, update, delete on public.inbox_thread_note from anon, authenticated;
drop policy if exists inbox_thread_note_tenant_restrict on public.inbox_thread_note;
create policy inbox_thread_note_tenant_restrict on public.inbox_thread_note
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- inbox_ai_settings: `signature` und `extra_prompt` (Freitext des Betriebs).
revoke select, insert, update, delete on public.inbox_ai_settings from anon, authenticated;

-- inbox_assignment_log: wer welchen Thread an wen uebergeben hat (Personal-
-- Zuordnung, § 4.3 kein Vertriebs-/Personaleinblick fuer staff/cleaner).
revoke select, insert, update, delete on public.inbox_assignment_log from anon, authenticated;

-- message_template / message_templates / message_automation / message_triggers:
-- Vorlagentexte des Betriebs mit Platzhaltern. Keine Gast-PII, aber Betriebs-
-- Inhalt, den cleaner/owner nichts angeht (§ 4.3) — und der Schreibpfad war
-- ueber das pauschale Grant tenant-weit offen.
revoke select, insert, update, delete on public.message_template from anon, authenticated;
revoke select, insert, update, delete on public.message_templates from anon, authenticated;
revoke select, insert, update, delete on public.message_automation from anon, authenticated;
revoke select, insert, update, delete on public.message_triggers from anon, authenticated;
drop policy if exists message_templates_tenant_restrict on public.message_templates;
create policy message_templates_tenant_restrict on public.message_templates
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());


-- -------------------------------------------------------------------------
-- 3) OTA-INBOUND — Gastdaten und Betraege aus den Portalen.
-- -------------------------------------------------------------------------
-- channex_booking traegt die Spalte `customer` (jsonb) und `raw` (jsonb): der
-- KOMPLETTE Gast-Datensatz, wie ihn das Portal liefert (Name, Mail, Telefon,
-- Adresse) plus amount_cents/currency. Der RESTRICTIVE-Guard
-- channex_booking_thread_scope prueft nur die Thread-Zuweisung, nicht die
-- Rolle. Gelesen wird ueber den inbox-/channel_manager-Slice.
revoke select, insert, update, delete on public.channex_booking from anon, authenticated;

-- channex_review: guest_name + content (oeffentlicher Bewertungstext, aber
-- mit ota_reservation_id verknuepfbar) und die noch unveroeffentlichte reply.
revoke select, insert, update, delete on public.channex_review from anon, authenticated;

-- channex_debug_log: request_body/response_body — die ROHEN Channex-Payloads
-- inklusive Gastdaten und Zugangsdaten in Headern/Bodies. Die Policy erlaubte
-- admin/co_admin per SELECT; das pauschale Grant machte den Rollen-Guard aber
-- fuer den Schreibpfad wirkungslos.
revoke select, insert, update, delete on public.channex_debug_log from anon, authenticated;

-- channex_webhook_event: payload (jsonb) mit Buchungs-/Nachrichten-Ereignissen.
revoke select, insert, update, delete on public.channex_webhook_event from anon, authenticated;
drop policy if exists channex_webhook_event_tenant_restrict on public.channex_webhook_event;
create policy channex_webhook_event_tenant_restrict on public.channex_webhook_event
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- ota_account: die Portal-Kontoverbindung (ota_hotel_id, channex_channel_id,
-- display_name, token_invalid). Zugangs-/Verbindungsdaten, § 4.3.
revoke select, insert, update, delete on public.ota_account from anon, authenticated;

-- channex_channel_connection: dieselbe Klasse (ota_hotel_id, Kanal-Kennungen).
revoke select, insert, update, delete on public.channex_channel_connection from anon, authenticated;

-- channex_property_map / channex_room_type_map / channex_rate_plan_map /
-- channex_group_map: die Portal-Kennungen des Betriebs. Kein Personenbezug,
-- aber Vertriebsdaten (§ 4.3: staff/cleaner kein Vertriebseinblick) und der
-- Schreibpfad war ueber das Grant tenant-weit offen.
revoke select, insert, update, delete on public.channex_property_map from anon, authenticated;
revoke select, insert, update, delete on public.channex_room_type_map from anon, authenticated;
revoke select, insert, update, delete on public.channex_rate_plan_map from anon, authenticated;
revoke select, insert, update, delete on public.channex_group_map from anon, authenticated;
drop policy if exists channex_group_map_tenant_restrict on public.channex_group_map;
create policy channex_group_map_tenant_restrict on public.channex_group_map
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- airbnb_historie_lauf: Fortschritt des Historien-Imports (0 restriktive
-- Policies, Schreibpfad tenant-weit offen). Kein Personenbezug, aber ein
-- Angreifer kann den Lauf-Status fremd ueberschreiben und den Import kippen.
revoke select, insert, update, delete on public.airbnb_historie_lauf from anon, authenticated;
drop policy if exists airbnb_historie_lauf_tenant_restrict on public.airbnb_historie_lauf;
create policy airbnb_historie_lauf_tenant_restrict on public.airbnb_historie_lauf
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());


-- -------------------------------------------------------------------------
-- 4) RESERVIERUNGEN — Gastname/Kontakt + Betraege in einer Zeile.
-- -------------------------------------------------------------------------
-- reservations hatte drei RESTRICTIVE-Policies, aber der Scope stimmt NICHT
-- mit dem gedachten Schutz ueberein (Wurzel 9: Item-Scope = List-Scope):
--   reservations_owner_scope :: RESTRICTIVE for SELECT, owner_can_see_property
--   reservations_staff_scope :: RESTRICTIVE for SELECT, staff_can_see_property
--   reservations_write_restrict :: RESTRICTIVE for ALL, nur tenant_id
-- Die beiden Scope-Policies greifen NUR bei SELECT. Beim SCHREIBEN bleibt
-- allein der Tenant-Guard uebrig: ein owner ohne jede Objekt-Zuordnung konnte
-- ueber PostgREST jede Reservierung seines Mandanten AENDERN (status,
-- total_amount, paid_amount, cancel_reason) — obwohl § 4.2 ihn read-only
-- stellt. Und lesend liefert die Zeile ohnehin guest_email, guest_phone,
-- guest_country, total_amount, paid_amount, ota_commission und channel_fee im
-- Klartext, an der Maskierung aus guest_masking.py vorbei.
--
-- reservations bleibt bewusst in supabase_realtime NICHT enthalten? Doch —
-- siehe Abschnitt 10: reservations ist die EINE erlaubte Live-Quelle, auf die
-- die Frontends alle gesperrten Abos umhaengen. Das funktioniert nur, wenn
-- authenticated SELECT behaelt. Genau dieser Konflikt wird hier auf die
-- einzige Weise geloest, die beides erfuellt:
--   * SELECT bleibt fuer authenticated — aber die Rollen-Scopes greifen (sie
--     sind RESTRICTIVE for select und werden hier auf ALLE Rollen ausgeweitet,
--     nicht nur owner/staff),
--   * SCHREIBEN wird vollstaendig entzogen: kein insert/update/delete mehr
--     ueber den Direktpfad, das laeuft ausschliesslich ueber die API.
-- Damit ist die Zeile fuer den Direktpfad nur noch LESBAR und nur noch fuer
-- Rollen, die das Objekt sehen duerfen. Die verbleibende Klartext-Sicht auf
-- guest_email/guest_phone fuer admin/co_admin ist genau die Sicht, die die API
-- diesen Rollen ohnehin gibt (guest_masking.py maskiert erst ab owner/staff,
-- und fuer die greift jetzt der Objekt-Scope).
revoke insert, update, delete on public.reservations from anon, authenticated;
revoke select on public.reservations from anon;

-- reservation_addons / reservation_events / reservation_cancellation_log
-- haengen an der Reservierung und tragen Betraege bzw. Freitext-Gruende.
-- Lesen bleibt (Live-Quelle der Buchungs-Zeitleiste), Schreiben nicht.
revoke insert, update, delete on public.reservation_addons from anon, authenticated;
revoke insert, update, delete on public.reservation_events from anon, authenticated;
revoke select, insert, update, delete on public.reservation_cancellation_log from anon, authenticated;
revoke select on public.reservation_addons from anon;
revoke select on public.reservation_events from anon;


-- -------------------------------------------------------------------------
-- 5) EIGENTUEMER / VERTRIEB / BUCHHALTUNG — PII + Bankdaten + Umsatz.
-- -------------------------------------------------------------------------
-- owners ist die schwerste Einzeltabelle des Bestandes: name, company, email,
-- phone, street, house_number, postal_code, city, country, tax_id, vat_id,
-- IBAN, BIC, bank_name, account_holder, default_commission_pct, cpr_number.
-- IBAN und die daenische CPR-Nummer (Personennummer) sind ueber eine reine
-- Tenant-Policy fuer JEDE Rolle im Mandanten lesbar gewesen — auch fuer
-- cleaner. § 4.3 verbietet genau das.
revoke select, insert, update, delete on public.owners from anon, authenticated;

-- co_owners: name, email, phone, share_percent. Hatte owner-/staff-Scopes,
-- aber nur `for select` — Schreiben war tenant-weit offen.
revoke select, insert, update, delete on public.co_owners from anon, authenticated;
drop policy if exists co_owners_tenant_restrict on public.co_owners;
create policy co_owners_tenant_restrict on public.co_owners
    as restrictive for all
    using (exists (
        select 1 from public.properties p
        where p.id = co_owners.property_id
          and p.tenant_id = public.current_tenant_id()))
    with check (exists (
        select 1 from public.properties p
        where p.id = co_owners.property_id
          and p.tenant_id = public.current_tenant_id()));

-- owner_properties / owner_expenses: Beteiligungsquote, Provisions-Override,
-- Betraege je Ausgabe inkl. hidden_from_owner-Flag.
revoke select, insert, update, delete on public.owner_properties from anon, authenticated;
revoke select, insert, update, delete on public.owner_expenses from anon, authenticated;
drop policy if exists owner_properties_tenant_restrict on public.owner_properties;
create policy owner_properties_tenant_restrict on public.owner_properties
    as restrictive for all
    using (exists (
        select 1 from public.properties p
        where p.id = owner_properties.property_id
          and p.tenant_id = public.current_tenant_id()))
    with check (exists (
        select 1 from public.properties p
        where p.id = owner_properties.property_id
          and p.tenant_id = public.current_tenant_id()));

-- customers: name, email, phone, vat_id, tax_number, address, credit_limit,
-- notes. Debitoren-Stammdaten der Buchhaltung.
revoke select, insert, update, delete on public.customers from anon, authenticated;

-- quotes / quote_line_items: Angebotsbetraege je Position (net/tax/gross).
revoke select, insert, update, delete on public.quotes from anon, authenticated;
revoke select, insert, update, delete on public.quote_line_items from anon, authenticated;
drop policy if exists quote_line_items_tenant_restrict on public.quote_line_items;
create policy quote_line_items_tenant_restrict on public.quote_line_items
    as restrictive for all
    using (exists (
        select 1 from public.quotes q
        where q.id = quote_line_items.quote_id
          and q.tenant_id = public.current_tenant_id()))
    with check (exists (
        select 1 from public.quotes q
        where q.id = quote_line_items.quote_id
          and q.tenant_id = public.current_tenant_id()));

-- leads: name, address, phone, email, notes — Vertriebs-Pipeline (§ 4.3).
revoke select, insert, update, delete on public.leads from anon, authenticated;

-- partners / deals: Partner-Kontaktdaten und ihre Rabattkonditionen.
-- deals hatte NULL restriktive Policies: der Schreibpfad war ueber die
-- Partner-Verknuepfung tenant-weit offen (Rabattcodes fremd aenderbar).
revoke select, insert, update, delete on public.partners from anon, authenticated;
revoke select, insert, update, delete on public.deals from anon, authenticated;
drop policy if exists deals_tenant_restrict on public.deals;
create policy deals_tenant_restrict on public.deals
    as restrictive for all
    using (exists (
        select 1 from public.partners pa
        where pa.id = deals.partner_id
          and pa.tenant_id = public.current_tenant_id()))
    with check (exists (
        select 1 from public.partners pa
        where pa.id = deals.partner_id
          and pa.tenant_id = public.current_tenant_id()));

-- travel_agencies + Kontakte/Vertraege/Raten: Firmen-PII (email, phone,
-- vat_id, iata_number, Anschrift), Provisionssaetze und Vertrags-Dateipfade,
-- dazu die ausgehandelten Netto-Preise (travel_agency_rates.price). Kern des
-- Vertriebs (§ 4.3).
revoke select, insert, update, delete on public.travel_agencies from anon, authenticated;
revoke select, insert, update, delete on public.travel_agency_contacts from anon, authenticated;
revoke select, insert, update, delete on public.travel_agency_contracts from anon, authenticated;
revoke select, insert, update, delete on public.travel_agency_rates from anon, authenticated;

-- number_sequences: der naechste Rechnungs-/Angebotszaehler. Kein Personen-
-- bezug, aber tenant-weit BESCHREIBBAR — wer next_value verstellt, erzeugt
-- doppelte Rechnungsnummern (GoBD-Bruch).
revoke select, insert, update, delete on public.number_sequences from anon, authenticated;


-- -------------------------------------------------------------------------
-- 6) AUSZAHLUNGEN / MARKTPLATZ-FINANZEN.
-- -------------------------------------------------------------------------
-- Diese Tabellen tragen Betraege und Stripe-Kennungen und hatten teils NULL
-- restriktive Policies. Sie gehoeren in dieselbe Klasse wie payments/invoices/
-- commission_ledger/owner_statements, die 0172/0182/0187 bereits geschlossen
-- haben — sie sind nur spaeter entstanden und deshalb durchgerutscht.
revoke select, insert, update, delete on public.payouts from anon, authenticated;
drop policy if exists payouts_tenant_restrict on public.payouts;
create policy payouts_tenant_restrict on public.payouts
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke select, insert, update, delete on public.payout_adjustments from anon, authenticated;
drop policy if exists payout_adjustments_tenant_restrict on public.payout_adjustments;
create policy payout_adjustments_tenant_restrict on public.payout_adjustments
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke select, insert, update, delete on public.payout_settings from anon, authenticated;
drop policy if exists payout_settings_tenant_restrict on public.payout_settings;
create policy payout_settings_tenant_restrict on public.payout_settings
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke select, insert, update, delete on public.donations from anon, authenticated;
drop policy if exists donations_tenant_restrict on public.donations;
create policy donations_tenant_restrict on public.donations
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke select, insert, update, delete on public.tenant_donation_settings from anon, authenticated;
drop policy if exists tenant_donation_settings_tenant_restrict on public.tenant_donation_settings;
create policy tenant_donation_settings_tenant_restrict on public.tenant_donation_settings
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- cohost_payouts / cohost_stripe_accounts: Betraege und die Stripe-Account-ID
-- des Cohosts. cohost_payouts_read verodert `tenant_id = current_tenant_id()`
-- — also tenant-weit fuer jede Rolle. NULL restriktive Policies auf beiden.
revoke select, insert, update, delete on public.cohost_payouts from anon, authenticated;
drop policy if exists cohost_payouts_tenant_restrict on public.cohost_payouts;
create policy cohost_payouts_tenant_restrict on public.cohost_payouts
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke select, insert, update, delete on public.cohost_stripe_accounts from anon, authenticated;
drop policy if exists cohost_stripe_accounts_self_restrict on public.cohost_stripe_accounts;
create policy cohost_stripe_accounts_self_restrict on public.cohost_stripe_accounts
    as restrictive for all
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));

-- property_cohosts: share_bps/share_fixed_cents — die Beteiligung des Cohosts
-- an jeder Buchung. 0 restriktive Policies, Schreibpfad tenant-weit offen:
-- wer share_bps hochsetzt, leitet fremdes Geld um.
revoke select, insert, update, delete on public.property_cohosts from anon, authenticated;
drop policy if exists property_cohosts_tenant_restrict on public.property_cohosts;
create policy property_cohosts_tenant_restrict on public.property_cohosts
    as restrictive for all
    using (exists (
        select 1 from public.properties p
        where p.id = property_cohosts.property_id
          and p.tenant_id = public.current_tenant_id()))
    with check (exists (
        select 1 from public.properties p
        where p.id = property_cohosts.property_id
          and p.tenant_id = public.current_tenant_id()));

-- subscriptions / tenant_subscription / tenant_module_entitlement: das Abo des
-- Betriebs inkl. stripe_customer_id/stripe_subscription_id/-item_id. Wer die
-- Stripe-Kennungen kennt, kann sie in Support-Kontexten missbrauchen; wer sie
-- ueber den offenen Schreibpfad aendert, kippt die Abrechnung.
revoke select, insert, update, delete on public.subscriptions from anon, authenticated;
revoke select, insert, update, delete on public.tenant_subscription from anon, authenticated;
revoke select, insert, update, delete on public.tenant_module_entitlement from anon, authenticated;

-- plans: Preisliste der Tarife. Kein Personenbezug und fuer die Marketing-
-- Seite oeffentlich — aber 0 restriktive Policies, also war der SCHREIB-Pfad
-- fuer jeden eingeloggten Nutzer offen (Preis eines Tarifs fremd aenderbar).
-- Lesen bleibt, Schreiben nicht.
revoke insert, update, delete on public.plans from anon, authenticated;


-- -------------------------------------------------------------------------
-- 7) NUTZER / GEBAEUDE / OBJEKT-INTERNA.
-- -------------------------------------------------------------------------
-- users traegt Wohn- UND Postanschrift, Notfallkontakt, Telefon, den
-- Identitaets-Status und — sicherheitskritisch — `role` und `permissions`.
-- 0187 hat die users-Spalten bereits behandelt; live steht aber weiterhin ein
-- pauschales Table-SELECT fuer authenticated. Genau davor warnt CLAUDE.md:
-- „Spalten-revoke select (spalte) greift NICHT, solange das pauschale
-- Tabellen-GRANT besteht". Der RESTRICTIVE users_self_read_restrict begrenzt
-- SELECT auf die eigene Zeile — beim SCHREIBEN greift er nicht, dort blieb nur
-- der Tenant-Guard: `role` und `permissions` eines Kollegen waren tenant-weit
-- aenderbar. Das ist eine direkte Rechteausweitung (Wurzel 7).
revoke select, insert, update, delete on public.users from anon, authenticated;

-- user_mfa, user_auth_tokens, otp_challenge, login_devices, privacy_settings,
-- platform_admins, api_clients: haben bereits kein Grant (live geprueft) — die
-- Zeilen stehen hier nur, damit der Entzug den ENDZUSTAND beschreibt und ein
-- spaeteres versehentliches `grant all` nicht unbemerkt greift.
revoke select, insert, update, delete on public.user_mfa from anon, authenticated;
revoke select, insert, update, delete on public.user_auth_tokens from anon, authenticated;
revoke select, insert, update, delete on public.otp_challenge from anon, authenticated;
revoke select, insert, update, delete on public.login_devices from anon, authenticated;
revoke select, insert, update, delete on public.privacy_settings from anon, authenticated;
revoke select, insert, update, delete on public.platform_admins from anon, authenticated;
revoke select, insert, update, delete on public.api_clients from anon, authenticated;
revoke select, insert, update, delete on public.newsletter_subscribers from anon, authenticated;

-- notifications: titel/text/ziel_pfad einer Benachrichtigung. Die PERMISSIVE-
-- Policy begrenzt SELECT korrekt auf die eigene (user_id = uid()), der
-- RESTRICTIVE-Guard aber nur auf den Mandanten — der SCHREIB-Pfad liess also
-- zu, fremde Benachrichtigungen zu setzen oder als gelesen zu markieren.
-- Lesen bleibt (die Glocke ist eine Live-Ansicht mit sauberem Selbst-Scope),
-- Schreiben geht ueber die API.
revoke insert, update, delete on public.notifications from anon, authenticated;

-- dashboard_layouts: Selbst-Scope (user_id = uid()) und keine sensiblen Daten.
-- Schreiben bleibt trotzdem serverseitig: der RESTRICTIVE-Guard fehlt ganz.
revoke insert, update, delete on public.dashboard_layouts from anon, authenticated;

-- buildings: die Anschrift des Gebaeudes (address, city, postal_code).
-- Betriebs-Stammdaten, aber die Objekt-Adresse ist der Ort, an dem der Gast
-- wohnt — und traegt zusammen mit property_access den Zugangsweg.
revoke select, insert, update, delete on public.buildings from anon, authenticated;

-- property_access: key_status + key_placement — WO der Schluessel liegt.
-- Wurzel 6 nennt Tuercodes ausdruecklich. Die owner-/staff-Scopes greifen nur
-- `for select`, der Schreibpfad war tenant-weit offen.
revoke select, insert, update, delete on public.property_access from anon, authenticated;
drop policy if exists property_access_tenant_restrict on public.property_access;
create policy property_access_tenant_restrict on public.property_access
    as restrictive for all
    using (exists (
        select 1 from public.properties p
        where p.id = property_access.property_id
          and p.tenant_id = public.current_tenant_id()))
    with check (exists (
        select 1 from public.properties p
        where p.id = property_access.property_id
          and p.tenant_id = public.current_tenant_id()));

-- property_guest_portal: die Gastportal-Konfiguration eines Objekts. Hatte
-- bereits kein Grant (deshalb war das Abo darauf schon vor dieser Migration
-- eine Attrappe — siehe Abschnitt 9), bekommt hier den fehlenden
-- for-all-Guard und den vollstaendigen Entzug als Endzustand.
revoke select, insert, update, delete on public.property_guest_portal from anon, authenticated;
drop policy if exists property_guest_portal_tenant_restrict on public.property_guest_portal;
create policy property_guest_portal_tenant_restrict on public.property_guest_portal
    as restrictive for all
    using (exists (
        select 1 from public.properties p
        where p.id = property_guest_portal.property_id
          and p.tenant_id = public.current_tenant_id()))
    with check (exists (
        select 1 from public.properties p
        where p.id = property_guest_portal.property_id
          and p.tenant_id = public.current_tenant_id()));

-- property_tradespeople: Handwerker-Kontaktdaten (name, phone, notes) — PII
-- Dritter, die dem Betrieb anvertraut wurde.
revoke select, insert, update, delete on public.property_tradespeople from anon, authenticated;

-- property_emergency_authority: authority_limit + currency — bis zu welchem
-- Betrag der Verwalter ohne Rueckfrage handeln darf (Finanzvollmacht).
revoke select, insert, update, delete on public.property_emergency_authority from anon, authenticated;

-- property_service_agreements: price/currency der Dienstleistungsvertraege.
revoke select, insert, update, delete on public.property_service_agreements from anon, authenticated;

-- property_process / property_marketing / property_housebook /
-- property_platform_launches: Onboarding-/Vertragsverlauf eines Objekts
-- (contract_signed_at, onboarding_invoice_paid_at, Start-Termine).
-- Vertriebs-/Vertragsdaten, § 4.3.
revoke select, insert, update, delete on public.property_process from anon, authenticated;
revoke select, insert, update, delete on public.property_marketing from anon, authenticated;
revoke select, insert, update, delete on public.property_housebook from anon, authenticated;
revoke select, insert, update, delete on public.property_platform_launches from anon, authenticated;

-- meter_readings: Zaehlerstaende je Objekt. Kein Personenbezug, aber ein
-- Abrechnungswert — der Schreibpfad war tenant-weit offen (Nebenkosten
-- manipulierbar). Lesen bleibt fuer die Live-Ansicht des Eigentuemers, deren
-- owner-/staff-Scope korrekt greift.
revoke insert, update, delete on public.meter_readings from anon, authenticated;

-- inventory_items: Bestandslisten je Objekt. Schreibpfad schliessen.
revoke insert, update, delete on public.inventory_items from anon, authenticated;

-- tenants / tenant_billing_profile / tenant_custom_domains / tenant_onboarding
-- / tenant_site_config: Betriebs-Stammdaten inkl. platform_fee_bps (die
-- eigene Marktplatz-Gebuehr!) und der Domain-Konfiguration. tenants hatte
-- 0 restriktive Policies — platform_fee_bps war tenant-weit beschreibbar.
revoke select, insert, update, delete on public.tenants from anon, authenticated;
drop policy if exists tenants_self_restrict on public.tenants;
create policy tenants_self_restrict on public.tenants
    as restrictive for all
    using (id = public.current_tenant_id())
    with check (id = public.current_tenant_id());

revoke select, insert, update, delete on public.tenant_custom_domains from anon, authenticated;
revoke select, insert, update, delete on public.tenant_onboarding from anon, authenticated;
revoke insert, update, delete on public.tenant_site_config from anon, authenticated;
revoke insert, update, delete on public.tenant_pinned_channel from anon, authenticated;

-- staff_property_assignments / owner_property_assignments: WER welches Objekt
-- sehen darf. Das ist die Datengrundlage der Scope-Helfer
-- owner_can_see_property/staff_can_see_property — wer hier schreiben darf,
-- verschafft sich selbst Zugriff auf fremde Objekte (Rechteausweitung,
-- Wurzel 7). Beide hatten nur einen Tenant-Guard.
revoke select, insert, update, delete on public.staff_property_assignments from anon, authenticated;
revoke select, insert, update, delete on public.owner_property_assignments from anon, authenticated;

-- jobs: payload (jsonb) der Hintergrund-Jobs — enthaelt Objekt-/Buchungs-IDs
-- und bei Sync-Jobs die Nutzlast. Vor allem aber: locked_by/status waren
-- tenant-weit beschreibbar, ein Angreifer konnte fremde Jobs als erledigt
-- markieren und damit den Portal-Sync stillegen (Wurzel 5, fail-closed).
revoke select, insert, update, delete on public.jobs from anon, authenticated;

-- ari_outbox / ari_restriction_outbox: die ausgehende ARI-Nutzlast. Wer hier
-- schreibt, steuert, was an die Portale gemeldet wird (Verfuegbarkeit!).
revoke select, insert, update, delete on public.ari_outbox from anon, authenticated;
revoke select, insert, update, delete on public.ari_restriction_outbox from anon, authenticated;

-- external_calendar: ical_url — der Geheim-Link fremder Kalender. Wer ihn
-- liest, sieht die Belegung des Objekts beim anderen Anbieter; wer ihn
-- schreibt, leitet den Sync auf einen eigenen Server um (SSRF-Vektor,
-- Wurzel 8). Lesen bleibt fuer die Live-Statusanzeige, Schreiben nicht.
revoke insert, update, delete on public.external_calendar from anon, authenticated;

-- support_diagnostics: message/path/context einer Diagnose-Meldung samt
-- user_id/guest_id. Die PERMISSIVE-Policy erlaubt nur platform_admins mit
-- laufender Freigabe zu lesen — aber 0 restriktive Policies, also war der
-- SCHREIB-Pfad fuer jeden eingeloggten Nutzer offen.
revoke select, insert, update, delete on public.support_diagnostics from anon, authenticated;
drop policy if exists support_diagnostics_write_restrict on public.support_diagnostics;
create policy support_diagnostics_write_restrict on public.support_diagnostics
    as restrictive for all
    using (public.is_platform_admin())
    with check (public.is_platform_admin());

-- support_tickets / support_messages: der Ticket-Text und die Antworten,
-- inkl. reporter_email/reporter_phone/reporter_name und visitor_token_hash.
-- Die SELECT-Policies scopen korrekt (eigener Reporter ODER eigener Mandant
-- ODER platform_admin, `internal = false` bei Nachrichten) — aber es gab
-- 0 RESTRICTIVE-Policies, der SCHREIB-Pfad war damit komplett ungeschuetzt:
-- jeder eingeloggte Nutzer konnte fremde Tickets aendern oder loeschen.
-- Lesen bleibt (der Live-Chat lebt davon und der Scope ist sauber),
-- Schreiben geht ausschliesslich ueber die API.
revoke insert, update, delete on public.support_tickets from anon, authenticated;
revoke insert, update, delete on public.support_messages from anon, authenticated;
drop policy if exists support_tickets_write_restrict on public.support_tickets;
create policy support_tickets_write_restrict on public.support_tickets
    as restrictive for all
    using (
        reporter_user_id = (select auth.uid())
        or reporter_guest_id = (select auth.uid())
        or (tenant_id is not null and tenant_id = public.current_tenant_id())
        or public.is_platform_admin())
    with check (
        reporter_user_id = (select auth.uid())
        or reporter_guest_id = (select auth.uid())
        or (tenant_id is not null and tenant_id = public.current_tenant_id())
        or public.is_platform_admin());

drop policy if exists support_messages_write_restrict on public.support_messages;
create policy support_messages_write_restrict on public.support_messages
    as restrictive for all
    using (exists (
        select 1 from public.support_tickets t
        where t.id = support_messages.ticket_id
          and (t.reporter_user_id = (select auth.uid())
               or t.reporter_guest_id = (select auth.uid())
               or (t.tenant_id is not null and t.tenant_id = public.current_tenant_id())
               or public.is_platform_admin())))
    with check (exists (
        select 1 from public.support_tickets t
        where t.id = support_messages.ticket_id
          and (t.reporter_user_id = (select auth.uid())
               or t.reporter_guest_id = (select auth.uid())
               or (t.tenant_id is not null and t.tenant_id = public.current_tenant_id())
               or public.is_platform_admin())));

-- support_debug_sessions: eine laufende Support-Freigabe. Wer hier schreiben
-- kann, verlaengert sich selbst den Diagnose-Zugriff auf fremde Konten
-- (fail-open, Wurzel 5). 0 restriktive Policies.
revoke insert, update, delete on public.support_debug_sessions from anon, authenticated;
drop policy if exists support_debug_sessions_write_restrict on public.support_debug_sessions;
create policy support_debug_sessions_write_restrict on public.support_debug_sessions
    as restrictive for all
    using (public.is_platform_admin())
    with check (public.is_platform_admin());

-- storybook_chat: interner Doku-Chat mit `author` (Klarname) und Freitext,
-- `reviews_public_read`-artige Policy `using (true)` — also WELTWEIT lesbar
-- mit dem oeffentlichen anon-Key, und schreibbar dazu. Das ist die einzige
-- Tabelle, die ein Frontend wirklich direkt liest (storybook/), daher bleibt
-- der Lese-/Schreibpfad fuer authenticated bestehen; anon wird ausgesperrt,
-- damit der Chat wenigstens einen Login verlangt.
revoke select, insert, update, delete on public.storybook_chat from anon;
revoke update, delete on public.storybook_chat from authenticated;
drop policy if exists storybook_chat_read on public.storybook_chat;
create policy storybook_chat_read on public.storybook_chat
    for select using ((select auth.uid()) is not null);

-- deploy_spiegel: Deploy-Status inkl. commit + commit_nachricht. Die
-- PERMISSIVE-Policy verlangt is_platform_admin() und der RESTRICTIVE-Guard
-- ebenfalls — hier ist der Scope bereits korrekt. Der Entzug fuer anon bleibt
-- als Endzustand stehen.
revoke select, insert, update, delete on public.deploy_spiegel from anon;


-- -------------------------------------------------------------------------
-- 8) VERBLEIBENDE SCHREIB-PFADE OHNE ROLLEN-GUARD.
-- -------------------------------------------------------------------------
-- Diese Tabellen tragen keine PII und bleiben LESBAR (sie speisen Live-
-- Ansichten mit korrektem Scope), aber ihr Schreibpfad stand ueber das
-- pauschale Grant jedem eingeloggten Nutzer offen. Schreiben laeuft ab hier
-- ausschliesslich ueber die API, wo die Rollenpruefung sitzt (§ 4.2: owner
-- ist read-only — genau das war ueber PostgREST umgehbar).
revoke insert, update, delete on public.properties from anon, authenticated;
revoke insert, update, delete on public.property_units from anon, authenticated;
revoke insert, update, delete on public.property_photos from anon, authenticated;
revoke insert, update, delete on public.property_rooms from anon, authenticated;
revoke insert, update, delete on public.property_addons from anon, authenticated;
revoke insert, update, delete on public.property_pricing_config from anon, authenticated;
revoke insert, update, delete on public.property_seasons from anon, authenticated;
revoke insert, update, delete on public.property_season_assignments from anon, authenticated;
revoke insert, update, delete on public.property_discounts from anon, authenticated;
revoke insert, update, delete on public.availability from anon, authenticated;
revoke insert, update, delete on public.stop_sell from anon, authenticated;
revoke insert, update, delete on public.rate_plans from anon, authenticated;
revoke insert, update, delete on public.rate_plan_price_overrides from anon, authenticated;
revoke insert, update, delete on public.rate_plan_min_stay_overrides from anon, authenticated;
revoke insert, update, delete on public.rate_plan_restriction_overrides from anon, authenticated;
revoke insert, update, delete on public.rate_plan_sync_state from anon, authenticated;
revoke insert, update, delete on public.price_overrides from anon, authenticated;
revoke insert, update, delete on public.dynamic_prices from anon, authenticated;
revoke insert, update, delete on public.dp_settings from anon, authenticated;
revoke insert, update, delete on public.dp_pickup_snapshots from anon, authenticated;
revoke insert, update, delete on public.surcharges from anon, authenticated;
revoke insert, update, delete on public.events from anon, authenticated;
revoke insert, update, delete on public.event_periods from anon, authenticated;
revoke insert, update, delete on public.tasks from anon, authenticated;
revoke insert, update, delete on public.task_rules from anon, authenticated;
revoke insert, update, delete on public.task_rule_items from anon, authenticated;
revoke insert, update, delete on public.task_rule_assignments from anon, authenticated;
revoke insert, update, delete on public.task_substitutions from anon, authenticated;
revoke insert, update, delete on public.checklist_items from anon, authenticated;
revoke insert, update, delete on public.checklist_photos from anon, authenticated;
revoke insert, update, delete on public.service_types from anon, authenticated;
revoke insert, update, delete on public.site_pages from anon, authenticated;
revoke insert, update, delete on public.site_blocks from anon, authenticated;
revoke insert, update, delete on public.content_blocks from anon, authenticated;
revoke insert, update, delete on public.content_assignments from anon, authenticated;
revoke insert, update, delete on public.reviews from anon, authenticated;
revoke insert, update, delete on public.fx_rates from anon, authenticated;
revoke insert, update, delete on public.property_categories from anon, authenticated;
revoke insert, update, delete on public.property_subtypes from anon, authenticated;
revoke insert, update, delete on public.donation_recipients from anon, authenticated;
revoke insert, update, delete on public.sync_lease from anon, authenticated;
-- schema_migrations: das Migrations-Tracking selbst. Ein eingeloggter Nutzer
-- konnte Eintraege loeschen und damit beim naechsten Lauf nicht-idempotente
-- Migrationen erneut ausloesen.
revoke select, insert, update, delete on public.schema_migrations from anon, authenticated;
-- _sicherung_automail_0808: Sicherungskopie einer Tabelle, RLS AUS. Solche
-- Kopien duerfen den Direktpfad nie sehen.
revoke select, insert, update, delete on public._sicherung_automail_0808 from anon, authenticated;


-- -------------------------------------------------------------------------
-- 9) REALTIME — gesperrte Tabellen aus der Publikation nehmen.
-- -------------------------------------------------------------------------
-- Ohne SELECT-Grant passt fuer authenticated keine Policy mehr: das Abo waere
-- eine stumme Attrappe (verbindet sich, liefert nie ein Event). Die Attrappe
-- zu belassen ist schlimmer als kein Abo — die UI sieht live aus und ist es
-- nicht. Ein Re-Grant „zur Reparatur" ist der falsche Weg (CLAUDE.md).
--
-- Die betroffenen Abos in den Frontends werden im selben Zug auf die erlaubte
-- Quelle `reservations` umgehaengt bzw. ersatzlos gestrichen — siehe die
-- Kommentare an den jeweiligen useRealtime-Aufrufen. `reservations` behaelt
-- SELECT (Abschnitt 4) und bleibt in der Publikation.
do $$
declare
    t text;
begin
    foreach t in array array[
        'guest_addresses', 'guest_consents', 'guest_contacts', 'guest_documents',
        'guest_external_ids', 'guest_identity_documents', 'guest_notes',
        'guest_preferences',
        'messages', 'whatsapp_conversation', 'whatsapp_message',
        'automation_scheduled_message', 'inbox_scheduled_message',
        'inbox_thread_note', 'inbox_ai_settings', 'inbox_assignment_log',
        'message_template', 'message_templates', 'message_automation',
        'message_triggers',
        'channex_booking', 'channex_review', 'channex_debug_log',
        'channex_webhook_event', 'channex_property_map', 'channex_room_type_map',
        'channex_rate_plan_map', 'channex_group_map',
        'channex_channel_connection', 'ota_account', 'airbnb_historie_lauf',
        'reservation_cancellation_log',
        'owners', 'co_owners', 'owner_properties', 'owner_expenses',
        'customers', 'quotes', 'quote_line_items', 'leads', 'partners', 'deals',
        'travel_agencies', 'travel_agency_contacts', 'travel_agency_contracts',
        'travel_agency_rates', 'number_sequences',
        'payouts', 'payout_adjustments', 'payout_settings', 'donations',
        'tenant_donation_settings', 'cohost_payouts', 'cohost_stripe_accounts',
        'property_cohosts', 'subscriptions', 'tenant_subscription',
        'tenant_module_entitlement',
        'users', 'user_mfa', 'buildings', 'property_access',
        'property_guest_portal', 'property_tradespeople',
        'property_emergency_authority', 'property_service_agreements',
        'property_process', 'property_marketing', 'property_housebook',
        'property_platform_launches',
        'tenants', 'tenant_custom_domains', 'tenant_onboarding',
        'staff_property_assignments', 'owner_property_assignments',
        'support_diagnostics'
    ] loop
        if exists (
            select 1 from pg_publication_tables
            where pubname = 'supabase_realtime'
              and schemaname = 'public'
              and tablename = t
        ) then
            execute format('alter publication supabase_realtime drop table public.%I', t);
        end if;
    end loop;
end
$$;


-- -------------------------------------------------------------------------
-- 10) BEWUSST OFFEN — und warum.
-- -------------------------------------------------------------------------
-- Damit der naechste Leser nicht raten muss, welche Tabelle uebersehen wurde
-- und welche eine ENTSCHEIDUNG war:
--
-- LESBAR fuer authenticated, Schreiben entzogen (Abschnitt 4/7/8):
--   reservations, reservation_addons, reservation_events, properties,
--   property_units/-photos/-rooms/-addons/-pricing_config/-seasons/
--   -season_assignments/-discounts, availability, stop_sell, rate_plan*,
--   price_overrides, dynamic_prices, dp_settings, dp_pickup_snapshots,
--   surcharges, events, event_periods, tasks, task_*, checklist_*,
--   service_types, site_pages, site_blocks, content_*, reviews, fx_rates,
--   plans, property_categories, property_subtypes, donation_recipients,
--   external_calendar, meter_readings, inventory_items, tenant_site_config,
--   tenant_pinned_channel, notifications, dashboard_layouts, support_tickets,
--   support_messages, support_debug_sessions, deploy_spiegel, storybook_chat
--   BEGRUENDUNG: kein Personenbezug und kein Finanzdatum in den Spalten (die
--   Spaltenlisten wurden einzeln geprueft, nicht die Namen), ODER der Scope
--   haengt sauber am eigenen uid() statt am Mandanten (notifications,
--   dashboard_layouts, support_*). Diese Tabellen sind die Live-Quellen der
--   Kalender-, Preis-, Aufgaben- und Support-Ansichten; ein Entzug wuerde
--   dutzende Abos zu Attrappen machen, ohne ein Datenleck zu schliessen.
--   reservations ist der Sonderfall mit Begruendung in Abschnitt 4.
--
-- LESBAR fuer anon (oeffentlicher Marktplatz myBestDays):
--   property_categories, property_subtypes — die Taxonomie-Listen der
--   Objektsuche. Reine Nachschlagewerte ohne Mandantenbezug.
--
-- LESBAR fuer den GAST (portal_guest, Selbst-Scope am uid()):
--   guest_message_threads, guest_messages (auf den Selbst-Scope reduziert,
--   Abschnitt 2), wishlists, wishlist_items (0235), portal_guests (0181).
--   BEGRUENDUNG: dasselbe Muster, das 0235 fuer wishlists festgestellt hat —
--   auth.uid() ist der JWT-sub und portal_guests.id IST die auth.users.id, der
--   Gast erreicht ausschliesslich seine eigenen Zeilen.
--
-- SCHON DICHT vor dieser Migration (0172/0182/0187/0224/0229/0314/0336):
--   guests, payments, invoices, invoice_line_items, commissions,
--   commission_ledger, owner_statements, platform_fees, channex_tax_map,
--   tenant_billing_profile, taxpayer_info/-identifiers/-enforcement,
--   property_taxes, guest_review_queue, guest_reviews_by_host, blocked_guests,
--   host_profiles, portal_guests, review_automation(_log), ip_geo_ranges,
--   tax_country_rules, tax_state_rules, notification_settings, api_clients,
--   otp_challenge, login_devices, privacy_settings, platform_admins,
--   platform_audit_log, user_auth_tokens, user_mfa, newsletter_subscribers,
--   whatsapp_account, inbox_attachment, inbox_knowledge_fact, airbnb_foto_raum,
--   channex_ari_shadow, channex_tax_set_map, dynpricing_ledger, payout_holds,
--   paypal_webhook_event, stripe_webhook_event, property_custom_field(_value)s,
--   property_accessibility_photos, property_service_assignees, cohost_invitations.
--   Die Entzuege oben wiederholen sie teilweise bewusst als Endzustand.


-- -------------------------------------------------------------------------
-- 11) Backstop-Gegenprobe: Default Privileges.
-- -------------------------------------------------------------------------
-- 0336 hat `alter default privileges … revoke select` fuer supabase_admin und
-- postgres gesetzt. Live-Gegenprobe (pg_default_acl, 08.08.2026) nach 0336:
--   postgres       | public | r | {… anon=Dxt/postgres, authenticated=Dxt/postgres …}
--   supabase_admin | public | r | {… anon=Dxt/supabase_admin, …}
-- Nur noch D (TRUNCATE), x (REFERENCES), t (TRIGGER) — kein a/r/w/d mehr.
-- Und beide Rollen sind laut pg_class die EINZIGEN Eigentuemer von Tabellen in
-- `public` (live geprueft), es kann also keine dritte Rolle geben, die neue
-- Tabellen mit geerbten Lese-Grants anlegt. Der Backstop ist damit vollstaendig.
--
-- Trotzdem werden hier auch die verbleibenden Vererbungen entzogen: TRUNCATE
-- auf eine kuenftige Tabelle ist Datenverlust, TRIGGER erlaubt es, eigenen
-- Code an fremde Schreibvorgaenge zu haengen (Wurzel 6, „sicher per Default").
-- REFERENCES bleibt — es ist fuer Fremdschluessel noetig und gibt keine Daten
-- preis.
alter default privileges for role supabase_admin in schema public
    revoke insert, update, delete, truncate, trigger on tables from anon, authenticated;
alter default privileges for role postgres in schema public
    revoke insert, update, delete, truncate, trigger on tables from anon, authenticated;

-- Sequenzen: die Default-ACL gibt anon/authenticated bis heute rwU auf JEDE
-- neue Sequenz. `U` (USAGE) erlaubt nextval() — ein Angreifer kann damit die
-- Rechnungs-/Belegnummern eines Mandanten hochzaehlen und Luecken erzeugen.
alter default privileges for role supabase_admin in schema public
    revoke usage, select, update on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
    revoke usage, select, update on sequences from anon, authenticated;
revoke usage, select, update on all sequences in schema public from anon, authenticated;

-- Einmaliger Backstop aus CLAUDE.md (Wurzel 6): niemand ausser dem Server darf
-- in `public` Objekte anlegen. Idempotent.
revoke create on schema public from anon, authenticated;


-- -------------------------------------------------------------------------
-- 12) Tabellen-Kommentare an den schwersten Stellen.
-- -------------------------------------------------------------------------
comment on table public.owners is
  'Eigentuemer-Stammdaten (PII: Name, Anschrift, Kontakt; Finanzdaten: IBAN, '
  'BIC, Kontoinhaber, Steuer-/USt-ID, CPR-Nummer, Provisionssatz). KEIN '
  'Direktzugriff fuer anon/authenticated — Grants seit 0337 entzogen, nicht in '
  'supabase_realtime. Zugriff ausschliesslich ueber die API (service_role).';

comment on table public.guest_identity_documents is
  'Ausweisdaten des Gastes (doc_type, number, issuing_country, valid_until). '
  'KEIN Direktzugriff fuer anon/authenticated — Grants seit 0337 entzogen, '
  'nicht in supabase_realtime. Zugriff ausschliesslich ueber die API '
  '(service_role) mit der Rollen-Maskierung aus guest_masking.py.';

comment on table public.channex_booking is
  'OTA-Buchung aus Channex. Die Spalten customer/raw (jsonb) tragen den '
  'KOMPLETTEN Gast-Datensatz des Portals (Name, Mail, Telefon, Anschrift) '
  'plus Betraege. KEIN Direktzugriff fuer anon/authenticated seit 0337.';

comment on table public.property_access is
  'Schluesselstatus und Schluesselablage je Objekt. Wurzel 6 zaehlt '
  'Tuercodes/Zugangswege ausdruecklich zu den Daten, die nur der Server sehen '
  'darf. KEIN Direktzugriff fuer anon/authenticated seit 0337.';

comment on table public.users is
  'Nutzer des Betriebs (PII: Wohn-/Postanschrift, Telefon, Notfallkontakt, '
  'Identitaets-Status) UND die rechtevergebenden Spalten role/permissions. '
  'KEIN Direktzugriff fuer anon/authenticated seit 0337: der Schreibpfad war '
  'zuvor nur tenant-gescoped, role/permissions eines Kollegen also '
  'tenant-weit aenderbar (Rechteausweitung, Wurzel 7).';

comment on table public.reservations is
  'Reservierungen. Traegt guest_email/guest_phone/guest_country und die '
  'Betraege in einer Zeile. Lesen bleibt fuer authenticated (die EINE erlaubte '
  'Realtime-Live-Quelle, Objekt-Scope ueber owner/staff_can_see_property greift); '
  'SCHREIBEN ist seit 0337 entzogen — Aenderungen laufen ausschliesslich ueber '
  'die API, wo § 4.2 (owner read-only) erzwungen wird.';
