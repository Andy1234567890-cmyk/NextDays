-- =========================================================================
-- 0336 — Wurzel 6: DB-Direktpfad auf public.guests schliessen (Gast-PII).
-- =========================================================================
-- BELEGTER BEFUND (Live-Rollenwechsel gegen die Server-DB, 08.08.2026):
-- ein eingeloggter Nutzer mit app_metadata.role = "owner" und OHNE jede
-- Objekt-Zuordnung liest die komplette Gaesteliste seines Mandanten im
-- Klartext. Gegenprobe VORHER (psql, db-cdqxi):
--
--   begin;
--   select set_config('request.jwt.claims', '{"role":"authenticated",
--     "app_metadata":{"role":"owner","tenant_id":"69d24767-…"}}', true);
--   set local role authenticated;
--   select count(*) from public.guests;   -->  40   (Tenant-weit, ALLE Spalten)
--   rollback;
--
-- Der Angriffsweg braucht keinen Exploit, nur den oeffentlichen anon-Key:
--   curl -H "apikey: <anon>" -H "Authorization: Bearer <owner-JWT>" \
--        "$SUPABASE_URL/rest/v1/guests?select=*"
-- PostgREST antwortet direkt aus der DB — der FastAPI-Layer wird komplett
-- umgangen.
--
-- WAS DAMIT AUSGEHEBELT WAR: apps/api/src/features/auth/guest_masking.py
-- kuerzt fuer die Rolle owner bewusst auf den Vornamen und blendet Kontakt-,
-- Ausweis- und Umsatzdaten aus (§ 4.2/4.3). Solange der Direktpfad offen ist,
-- ist diese Maskierung reine Dekoration: ueber PostgREST kommen last_name,
-- email, phone, birth_date, birth_place, nationality, vat_id, block_reason
-- und total_revenue ungefiltert heraus — 35 Spalten, davon der ueberwiegende
-- Teil personenbezogen (Art. 9-nah: birth_date/nationality/gender).
--
-- WARUM RLS ALLEIN NICHT REICHT (Wurzel 6): guests hatte
--   guests_tenant          PERMISSIVE for all  (tenant_id = current_tenant_id())
--   guests_write_restrict  RESTRICTIVE for all (tenant_id = current_tenant_id())
-- Beide pruefen NUR den Mandanten. Die ROLLE innerhalb des Mandanten prueft
-- keine von beiden — genau die Luecke, vor der Wurzel 6 warnt. Der Schreibpfad
-- war seit 0224/0229 schon zu (kein insert/update/delete-Grant); OFFEN war
-- das pauschale SELECT fuer anon UND authenticated.
--
-- Alt/Neu-Gegenzustand (Wurzel 1): rein entziehende Haertung. Keine Datenzeile
-- wird angefasst, kein Schema geaendert.

-- -------------------------------------------------------------------------
-- 1) GRANT-Entzug — der eigentliche Riegel.
-- -------------------------------------------------------------------------
-- Vollstaendig alle vier Rechte, auch die schon fehlenden: der Entzug muss den
-- Endzustand beschreiben, nicht den Delta-Stand von heute. Sonst reisst ein
-- spaeteres, versehentliches `grant all` die Luecke unbemerkt wieder auf und
-- diese Migration liest sich, als haette sie es abgedeckt.
-- Gelesen und geschrieben wird guests ab hier AUSSCHLIESSLICH ueber die API
-- (service_role, rolbypassrls = t → vom Entzug nicht betroffen), mit der dort
-- erzwungenen Rollen-Maskierung aus guest_masking.py.
revoke select, insert, update, delete on public.guests from anon, authenticated;

-- -------------------------------------------------------------------------
-- 2) RESTRICTIVE for-all-Guard — der Backstop hinter dem Grant.
-- -------------------------------------------------------------------------
-- Bewusst `for all` und nicht `for select`: eine reine SELECT-Restriktion
-- laesst den SCHREIB-Pfad tenant-weit offen: genau der Fehler, den 0187 fuer
-- commission_ledger beschreibt. Der Guard greift erst, wenn jemand spaeter ein
-- Grant zurueckgibt — dann ist wenigstens der Mandant weiter hart erzwungen.
-- `guests_write_restrict` (0224) deckt dasselbe bereits ab und bleibt stehen;
-- diese Policy traegt den sprechenden Namen und den Kommentar zum Befund.
drop policy if exists guests_tenant_restrict on public.guests;
create policy guests_tenant_restrict on public.guests
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

comment on policy guests_tenant_restrict on public.guests is
  'Wurzel 6: RESTRICTIVE for-all-Guard + GRANT-Entzug (0336) — anon/'
  'authenticated haben keinen Direktzugriff auf Gast-PII. Gelesen wird nur '
  'ueber die API (service_role) mit der Rollen-Maskierung aus '
  'guest_masking.py. for all statt for select, sonst bleibt der Schreibpfad '
  'tenant-weit offen.';

-- -------------------------------------------------------------------------
-- 3) Realtime: guests aus der Publikation nehmen.
-- -------------------------------------------------------------------------
-- guests steht live in `supabase_realtime`. Ohne SELECT-Grant passt fuer
-- authenticated keine Policy mehr — das Abo waere ab jetzt eine stumme
-- Attrappe (verbindet sich, liefert nie ein Event). Die Attrappe zu belassen
-- ist schlimmer als kein Abo: die UI sieht live aus und ist es nicht.
-- Ein Re-Grant "zur Reparatur" ist ausdruecklich der falsche Weg (CLAUDE.md,
-- Realtime-Abschnitt) — bei gesperrten Tabellen ist das ABO der Fehler.
--
-- FOLGE IM FRONTEND (muss ein Frontend-Agent nachziehen, siehe Kommentar
-- unten): web/app/(dashboard)/gaeste/page.tsx:18 und
-- web/app/(dashboard)/gaeste/[id]/page.tsx:26 haben je ein
-- <RealtimeRefresh tables={["guests"]} />. Die DATEN dieser Seiten kommen
-- bereits ueber die API (listGuests/getGuest, maskiert) — nur das Live-Signal
-- haengt an guests. Erlaubter Ersatz ist `reservations` (dort entsteht die
-- ueberwiegende Zahl der Gaeste-Aenderungen: stays_count, last_stay_at,
-- total_revenue werden bei jeder Buchung fortgeschrieben) bzw. auf der
-- Detailseite zusaetzlich die bereits abonnierten Sub-Tabellen
-- guest_addresses/guest_contacts/guest_notes, die alle offen bleiben.
do $$
begin
    if exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'guests'
    ) then
        alter publication supabase_realtime drop table public.guests;
    end if;
end
$$;

-- -------------------------------------------------------------------------
-- 4) Backstop-Reparatur: Default Privileges — SELECT fehlte noch.
-- -------------------------------------------------------------------------
-- 0229 hat den supabase_admin-Backstop nachgezogen, aber nur fuer
-- insert/update/delete. Live-Gegenprobe (pg_default_acl, 08.08.2026):
--   supabase_admin | r | {… anon=rDxt/supabase_admin,
--                          authenticated=rDxt/supabase_admin …}
-- Das `r` ist SELECT: JEDE neue Tabelle bekommt bis heute automatisch
-- Lese-Grants fuer anon und authenticated. Genau so ist guests entstanden —
-- niemand hat das Grant je gesetzt, es war der Default. Ohne diese Zeile
-- reisst dieselbe Luecke bei der naechsten Tabelle mit PII wieder auf, und
-- 0336 waere ein Einzelfall-Pflaster statt einer Wurzel-Behebung (Wurzel 6:
-- "sicher per Default" statt "sicher, wenn dran gedacht").
--
-- Bewusst BEIDE Rollen, weil Migrationen als supabase_admin laufen
-- (supabase/apply-migrations.sh: MIGRATE_DB_USER=supabase_admin), Tabellen
-- aus anderen Wegen aber als postgres entstehen koennen. Default Privileges
-- wirken nur auf Objekte der GENANNTEN Rolle.
--
-- WAS DAS *NICHT* TUT: bestehende Tabellen aendern. pg_default_acl gilt nur
-- fuer kuenftige Objekte — der Bestand behaelt sein Grant und muss weiterhin
-- einzeln entzogen werden (die im Bericht gemeldeten Tabellen).
alter default privileges for role supabase_admin in schema public
    revoke select on tables from anon, authenticated;
alter default privileges for role postgres in schema public
    revoke select on tables from anon, authenticated;

comment on table public.guests is
  'Gast-Stammdaten (PII: Name, Kontakt, Geburtsdatum/-ort, Nationalitaet, '
  'USt-ID, Umsatz). KEIN Direktzugriff fuer anon/authenticated — Grants seit '
  '0336 entzogen, nicht in supabase_realtime. Zugriff ausschliesslich ueber '
  'die API (service_role) mit der Rollen-Maskierung aus guest_masking.py.';
