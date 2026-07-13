-- 0128_property_dossier_rls.sql — RLS + updated_at-Trigger + owner-scope + Realtime
-- für die 8 neuen Objektkartei-Tabellen aus 0127.
--
-- Muster: 0015 (tenant via property), 0059 (RESTRICTIVE owner-scope), 0052
-- (replica identity full + Publication). Jede neue public-Tabelle MUSS RLS
-- bekommen (CLAUDE.md). owners/properties bleiben unberührt — die ergänzten
-- Spalten aus 0127 sind von deren bestehenden Policies abgedeckt.

-- === updated_at-Trigger ===
do $$
declare
  t text;
begin
  foreach t in array array[
    'property_process', 'property_access', 'property_service_agreements',
    'property_tradespeople', 'property_emergency_authority', 'property_marketing',
    'property_housebook', 'property_platform_launches'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()',
      t
    );
  end loop;
end
$$;

-- === RLS (tenant via property) + owner-scope + Realtime ===
do $$
declare
  t text;
begin
  foreach t in array array[
    'property_process', 'property_access', 'property_service_agreements',
    'property_tradespeople', 'property_emergency_authority', 'property_marketing',
    'property_housebook', 'property_platform_launches'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);

    -- tenant-Sicht: nur Objekte des eigenen Tenants (via properties).
    execute format(
      'create policy %I on public.%I
         for all using (exists (
           select 1 from public.properties p
           where p.id = %I.property_id and p.tenant_id = public.current_tenant_id()))
         with check (exists (
           select 1 from public.properties p
           where p.id = %I.property_id and p.tenant_id = public.current_tenant_id()))',
      t || '_via_property', t, t, t
    );

    -- owner-Sicht: eingeloggter Eigentümer sieht nur seine Objekte
    -- (RESTRICTIVE, UND-verknüpft; für Nicht-owner true).
    execute format(
      'create policy %I on public.%I
         as restrictive for select
         using (public.owner_can_see_property(property_id))',
      t || '_owner_scope', t
    );

    -- Realtime: alte Zeilenwerte bei UPDATE/DELETE + Publication (idempotent).
    execute format('alter table public.%I replica identity full', t);
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;
