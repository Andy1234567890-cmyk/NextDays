-- Suchmaschinen-Indexierung pro Objekt (Airbnb „Konto → Datenschutz → Objekte in
-- Suchmaschinen aufnehmen") + Schließen einer Wurzel-6-Schreibpfad-Lücke auf
-- public.properties, die beim Einbau dieses Features live nachgewiesen wurde.
--
-- ============================================================================
-- Teil 1 — Objekt-Flag search_engine_indexing
-- ============================================================================
-- Vierte Sichtbarkeits-Achse neben listed_on_marketplace / listed_on_website.
-- Steuert, ob die öffentliche Inserat-Seite (/plattform/inserat/[id]) für
-- Suchmaschinen indexierbar ist. Ist es AUS, rendert das Frontend
--   <meta name="robots" content="noindex, nofollow, noimageindex">
-- (exakt Airbnbs Mechanik: der Schalter entfernt/setzt genau diesen Tag).
--
-- Default FALSE — wie Airbnb: Objektseiten sind standardmäßig NICHT indexierbar
-- (noindex), erst wenn der Betrieb es aktiv anschaltet. Bewusst anders als die
-- anderen Achsen (die default true sind), weil Suchmaschinen-Sichtbarkeit eine
-- eigene, datenschutzfreundlich per Default abgeschaltete Entscheidung ist.
alter table public.properties
    add column if not exists search_engine_indexing boolean not null default false;

comment on column public.properties.search_engine_indexing is
    'Ob die öffentliche Inserat-Seite für Suchmaschinen indexierbar ist (Airbnb '
    '„Objekte in Suchmaschinen aufnehmen"). Default false = noindex-Meta-Tag. Der '
    'Konto-Schalter schaltet diese Spalte für ALLE Objekte des Tenants (Bulk).';

-- ============================================================================
-- Teil 2 — Wurzel 6: Schreibpfad tenant-weit offen → restriktiv schließen
-- ============================================================================
-- BEFUND (live per anon-Key-curl bewiesen): Ein Client mit gültigem JWT +
-- öffentlichem anon-Key spricht PostgREST direkt an und umgeht den FastAPI-Layer.
-- Die bestehende Policy properties_tenant (PERMISSIVE, FOR ALL) prüft NUR
-- tenant_id = current_tenant_id(); die restriktiven Rollen-Policies waren aber
-- NUR `for select`. Ergebnis: JEDER authentifizierte Nutzer im Tenant (auch
-- owner/staff/cleaner) konnte per `curl -X PATCH/POST /rest/v1/properties`
-- (Prefer: return=minimal, umgeht die SELECT-Grant-Hürde) fremde Objekte
-- ÄNDERN/ANLEGEN — nachgewiesen: UPDATE→204, INSERT→201.
--
-- FIX: restriktive `for all`-Policy, die den SCHREIB-Pfad (insert/update/delete)
-- auf verwaltende Rollen (admin/co_admin) beschränkt. SELECT bleibt unberührt
-- (die bestehenden *_scope-SELECT-Policies gelten weiter). service_role umgeht
-- RLS und ist nicht betroffen (der FastAPI-Layer schreibt darüber).
--
-- Fail-CLOSED: nur wenn die Rolle explizit admin/co_admin ist, wird Schreiben
-- erlaubt — bei unbekannter/fehlender Rolle (nicht service_role) NICHT.
-- Die Rolle kommt aus der DB (users.role), NICHT nur aus dem JWT-Claim, damit
-- eine entzogene Rolle sofort greift (Wurzel 7). current_db_role() unten.

create or replace function public.current_db_role()
    returns text
    language sql
    stable
    security definer
    set search_path = ''
as $function$
    select u.role::text
    from public.users u
    where u.id = auth.uid()
    limit 1
$function$;

comment on function public.current_db_role() is
    'Rolle des eingeloggten Nutzers aus der DB (users.role) — Quelle der Wahrheit '
    'für Schreib-Guards, damit eine entzogene Rolle sofort gilt (Wurzel 7).';

revoke execute on function public.current_db_role() from anon, authenticated;

-- INSERT: nur admin/co_admin dürfen neue Objekte im eigenen Tenant anlegen.
create policy properties_write_insert on public.properties
    as restrictive for insert
    with check (public.current_db_role() in ('admin', 'co_admin'));

-- UPDATE: nur admin/co_admin. owner/staff/cleaner sind read-only (§4.2/§4.3).
create policy properties_write_update on public.properties
    as restrictive for update
    using (public.current_db_role() in ('admin', 'co_admin'))
    with check (public.current_db_role() in ('admin', 'co_admin'));

-- DELETE: nur admin/co_admin.
create policy properties_write_delete on public.properties
    as restrictive for delete
    using (public.current_db_role() in ('admin', 'co_admin'));

-- ============================================================================
-- Teil 3 — privacy_settings.listings_search_engine_indexing entfernen
-- ============================================================================
-- Diese Spalte (aus 0193) wird NICHT mehr verwendet: „Objekte in Suchmaschinen
-- aufnehmen" ist eine Objekt-Eigenschaft (properties.search_engine_indexing),
-- kein gespeicherter User-Wert. Sie hier zu halten würde divergieren (Wurzel 4).
-- Der Service leitet den Konto-Schalter aus dem Objekt-Zustand ab.
alter table public.privacy_settings
    drop column if exists listings_search_engine_indexing;
