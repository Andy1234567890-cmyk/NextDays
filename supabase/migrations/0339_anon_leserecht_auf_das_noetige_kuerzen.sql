-- =========================================================================
-- 0339 — Wurzel 6: anon-Leserechte in `public` auf das Noetige kuerzen.
-- =========================================================================
-- ANLASS: Nach 0337 stand `anon` (der Rolle OHNE jeden Login, erreichbar mit
-- dem oeffentlichen anon-Key allein) noch auf 45 Tabellen ein SELECT-Grant zu:
-- tasks, checklist_items, dashboard_layouts, support_tickets, support_messages,
-- meter_readings, external_calendar, site_pages, tenant_site_config und der
-- gesamte Preis-/Verfuegbarkeits-Block.
--
-- GEGENPROBE (Live-Rollenwechsel, 08.08.2026, `set local role anon` ohne JWT):
-- keine dieser Tabellen liefert eine Zeile — RLS haelt, weil
-- current_tenant_id() ohne JWT NULL ist und jede Policy daran scheitert. Die
-- Tabellen mit Policy-Unterabfragen auf properties werfen sogar sauber
-- 42501 permission denied.
--
-- WARUM DER ENTZUG TROTZDEM KOMMT: Das Grant ist die falsche Verteidigungs-
-- linie. Es haelt heute nur, weil ZUFAELLIG keine permissive Policy `using
-- (true)` daneben steht. Genau diese Konstruktion — „Grant offen, RLS haelt
-- schon" — ist der Fehler, vor dem Wurzel 6 warnt: eine einzige spaeter
-- ergaenzte oeffentliche Policy (etwa fuer den Marktplatz) macht aus dem
-- ungenutzten Grant sofort ein Leck, und niemand sieht den Zusammenhang.
-- Der Entzug beschreibt den ENDZUSTAND: anon liest in `public` nur das, was
-- oeffentlich sein SOLL.
--
-- WAS ANON BEHAELT und warum:
--   property_categories, property_subtypes — die Objekttyp-Taxonomie des
--   Marktplatzes myBestDays. Reine Nachschlagewerke (slug, Label, Sortierung),
--   kein Mandantenbezug, keine Personendaten. Sie speisen die Filter der
--   oeffentlichen Objektsuche, bevor der Gast eingeloggt ist.
--
-- Kein Frontend liest als anon eine der entzogenen Tabellen (live verifiziert:
-- die Frontends holen Daten ausschliesslich ueber die FastAPI, der Supabase-
-- Client dient nur Auth + Realtime). Realtime-Abos laufen als authenticated
-- bzw. mit Gast-JWT, nicht als anon — kein Abo wird dadurch zur Attrappe.
--
-- Alt/Neu-Gegenzustand (Wurzel 1): rein entziehende Haertung, keine Datenzeile
-- und kein Schema beruehrt. service_role bleibt unberuehrt.
-- =========================================================================

do $$
declare
    t record;
begin
    for t in
        select c.oid::regclass::text as name
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relkind = 'r'
          and has_table_privilege('anon', c.oid, 'select')
          -- Die beiden oeffentlichen Taxonomie-Tabellen bleiben.
          and c.relname not in ('property_categories', 'property_subtypes')
    loop
        execute format('revoke select, insert, update, delete on %s from anon', t.name);
    end loop;
end
$$;

comment on table public.property_categories is
    'Oeffentliche Objekttyp-Taxonomie (Oberkategorien) des Marktplatzes '
    'myBestDays. Bewusst fuer anon lesbar: Nachschlagewerk ohne Mandanten- '
    'oder Personenbezug, speist die Filter der Objektsuche vor dem Login. '
    'Schreiben ist entzogen (0337).';

comment on table public.property_subtypes is
    'Oeffentliche Objekttyp-Taxonomie (Unterarten, Portal-Mapping) des '
    'Marktplatzes myBestDays. Bewusst fuer anon lesbar: Nachschlagewerk ohne '
    'Mandanten- oder Personenbezug. Schreiben ist entzogen (0337).';
