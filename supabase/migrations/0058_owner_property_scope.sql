-- 0058_owner_property_scope.sql — Eigentümer-Portal: Objekt-Zuordnung (Lastenheft §4.2)
--
-- Bildet ab, dass ein eingeloggter EIGENTÜMER (Rolle 'owner') nur SEINE Objekte
-- sieht, während die Agentur (admin/co_admin/staff/cleaner) wie bisher den ganzen
-- Tenant sieht. Das Fundament (Rolle 'owner', read-only-Rechte, Daten-Split über
-- guest_masking) besteht bereits — hier kommt die fehlende OBJEKT-Einschränkung.
--
-- Dieser Schritt legt NUR Datenmodell + Helper an. Die eigentliche RLS-Filterung
-- der Objekt-/Preis-/Kalender-Tabellen folgt in 0059 (eine Schicht, einzeln
-- verifizierbar). Rein additiv, ändert kein bestehendes Verhalten.

-- == Helper: Rolle aus dem JWT (app_metadata.role) ==========================
-- Analog zu current_tenant_id() (0007). Quelle der Wahrheit für rollenbasierte
-- RLS. stable + kein Tabellenzugriff; leere/fehlende Rolle → NULL.
create or replace function public.current_user_role()
returns text
language sql
stable
as $$
  select nullif(
    current_setting('request.jwt.claims', true)::jsonb
      -> 'app_metadata' ->> 'role',
    ''
  )
$$;

-- Gehärtet wie die übrigen RLS-Helper (0017): leerer search_path.
alter function public.current_user_role() set search_path = '';

-- == Zuordnung Eigentümer → Objekte =========================================
-- Vorbild: staff_property_assignments (0019). Ein owner-User kann mehreren
-- Objekten zugeordnet sein; ein Objekt mehreren Miteigentümern. Die Zuordnung
-- ist unabhängig von der co_owners-Kontaktliste (die kein Login trägt).
create table if not exists public.owner_property_assignments (
    id          uuid primary key default gen_random_uuid(),
    tenant_id   uuid not null references public.tenants (id) on delete cascade,
    user_id     uuid not null references public.users (id) on delete cascade,
    property_id uuid not null references public.properties (id) on delete cascade,
    created_at  timestamptz not null default now(),
    unique (user_id, property_id)
);

create index if not exists owner_property_assignments_tenant_id_idx
    on public.owner_property_assignments (tenant_id);
create index if not exists owner_property_assignments_user_id_idx
    on public.owner_property_assignments (user_id);
create index if not exists owner_property_assignments_property_id_idx
    on public.owner_property_assignments (property_id);

-- == Helper: Darf der aktuelle Nutzer dieses Objekt sehen? ===================
-- Kern der Eigentümer-Einschränkung, in 0059 von allen objektbezogenen Policies
-- genutzt:
--   * Nicht-owner (Agentur) → immer true (tenant-weite Sicht bleibt).
--   * owner → nur true, wenn ihm das Objekt in owner_property_assignments
--     zugeordnet ist (auf seinen Tenant + seine user_id gebunden).
-- security definer, damit die Policy die Zuordnungstabelle lesen darf, ohne dass
-- deren eigene RLS rekursiv greift. stable; leerer search_path → Tabellen voll
-- qualifiziert.
create or replace function public.owner_can_see_property(p_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    case
      when public.current_user_role() is distinct from 'owner' then true
      else exists (
        select 1
        from public.owner_property_assignments a
        where a.property_id = p_property_id
          and a.user_id = auth.uid()
          and a.tenant_id = public.current_tenant_id()
      )
    end
$$;

-- == RLS auf die Zuordnungstabelle selbst ====================================
-- Verwaltung tenant-direkt (Admin/Co-Admin pflegen die Zuordnung). Ein owner
-- darf zusätzlich SEINE eigenen Zuordnungen lesen (für die Objekt-Liste seines
-- Portals), aber nichts ändern.
alter table public.owner_property_assignments enable row level security;

create policy owner_property_assignments_tenant
  on public.owner_property_assignments
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy owner_property_assignments_self_read
  on public.owner_property_assignments
  for select
  using (
    tenant_id = public.current_tenant_id()
    and user_id = auth.uid()
  );
