-- Realtime funktionsfähig machen, wo es abonniert wird (Wurzel 6 respektiert).
--
-- BEFUND (live gegen die Server-DB geprüft): von 52 per useRealtime abonnierten
-- Tabellen liefern 8 nie ein Event. Postgres-Changes braucht ZWEI Dinge — das
-- Tabellen-SELECT-Grant für `authenticated` (die RLS-Policy entscheidet dann,
-- WELCHE Zeilen) UND Mitgliedschaft in der Publikation `supabase_realtime`.
-- Fehlt eines, ist das Abo ein stummer no-op: die UI wirkt live, aktualisiert
-- aber nie. Genau das war der Fall bei:
--
--   properties                  → publiziert, aber KEIN select    (hier behoben)
--   property_seasons            → select, aber NICHT publiziert   (hier behoben)
--   property_season_assignments → select, aber NICHT publiziert   (hier behoben)
--   payments, invoices, invoice_line_items, commission_ledger,
--   owner_statements            → KEIN select, und das MUSS so bleiben
--
-- Die fünf Finanztabellen bekommen ABSICHTLICH kein Grant: Wurzel 6 verlangt
-- den SELECT-Entzug genau für Finanzdaten (0187), sonst liest sie ein
-- eingeloggter cleaner per anon-Key direkt über /rest/v1. Dort ist nicht das
-- Grant der Fehler, sondern das Abo — die betroffenen UIs müssen auf eine
-- erlaubte Quelle hören (z. B. reservations) statt auf die Finanztabelle.

-- 1) properties: SELECT für authenticated wiederherstellen.
--
-- 0207 hat den SCHREIB-Pfad geschlossen und dazu ausdrücklich festgehalten:
-- „Was bleibt: SELECT (für Realtime + Lesen, weiterhin durch RLS gescopt)."
-- Das Grant war live trotzdem nicht gesetzt — die sieben RLS-Policies auf
-- properties liefen dadurch ins Leere, weil ohne Tabellen-Grant gar nichts
-- ankommt.
--
-- Sicher, weil der Lesepfad restriktiv gescopt ist (live geprüft):
--   properties_tenant             permissive, for all → eigener Mandant
--   properties_owner_scope        RESTRICTIVE, select → owner nur eigene Objekte
--   properties_staff_scope        RESTRICTIVE, select → staff nur zugewiesene
--   properties_platform_admin_read permissive, select
-- Der Schreibpfad bleibt zu (0207: insert/update/delete entzogen), anon bleibt
-- ohne SELECT — der öffentliche Marktplatz liest über public_portal
-- (service_role), nicht direkt.
grant select on public.properties to authenticated;

-- 2) Saison-Tabellen in die Realtime-Publikation.
--
-- Beide haben SELECT für anon/authenticated und werden vom Saison-Kalender
-- abonniert (web/components/objekte/season-calendar.tsx), fehlten aber in der
-- Publikation. `add table` ist nicht idempotent → vorher prüfen.
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public'
          and tablename = 'property_seasons'
    ) then
        alter publication supabase_realtime add table public.property_seasons;
    end if;

    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public'
          and tablename = 'property_season_assignments'
    ) then
        alter publication supabase_realtime add table public.property_season_assignments;
    end if;
end
$$;

-- Realtime liefert bei UPDATE/DELETE nur die Primärschlüssel im old-Record,
-- solange REPLICA IDENTITY auf DEFAULT steht. Das genügt hier: die abonnierenden
-- Ansichten laden auf ein Event hin neu und werten `old` nicht feldweise aus.

comment on table public.property_seasons is
    'Saisons je Objekt. In supabase_realtime publiziert (0234) — der '
    'Saison-Kalender abonniert die Tabelle direkt.';
