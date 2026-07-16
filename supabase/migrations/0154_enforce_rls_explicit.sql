-- 0154_enforce_rls_explicit.sql — RLS explizit in der Migrationskette verankern
--
-- Security-Audit (docs/SECURITY-AUDIT-AUTH.md, V12): 13 public-Tabellen hatten
-- KEIN explizites `enable row level security` in den Migrationen. Ihr Schutz hing
-- allein an der Event-Trigger-Funktion public.rls_auto_enable() (ensure_rls), die
-- aus dem externen Supabase-Advisor-Setup stammt und NICHT versioniert war. In
-- jeder Umgebung ohne diesen Trigger (frische DB, Self-Hosting, CI, Recovery aus
-- reinen Migrationen) blieb RLS AUS → anon-/authenticated-Lesbarkeit über
-- PostgREST (CVE-2025-48757-Muster).
--
-- Dieser Fix ist zweistufig:
--   Teil A: RLS + tenant-scoped Policies EXPLIZIT je Tabelle (garantierter Schutz,
--           unabhängig von jedem Trigger).
--   Teil B: die rls_auto_enable()-Funktion + Event-Trigger versioniert nachziehen,
--           damit auch KÜNFTIGE Tabellen automatisch abgesichert sind — idempotent,
--           robust falls die Advisor-Variante bereits existiert.
--
-- Der Service-Role-Key umgeht RLS generell (BYPASSRLS) → Backend-Zugriffe über
-- get_service_client() bleiben unberührt. Tenant-Isolation via
-- public.current_tenant_id() (aus JWT app_metadata), Stil wie 0008_rls_policies.

-- ============================================================================
-- Teil A — Explizite RLS + Policies
-- ============================================================================

-- --- Direkt tenant-gebundene Tabellen (tenant_id-Spalte vorhanden) ---

alter table public.ari_outbox enable row level security;
drop policy if exists ari_outbox_tenant on public.ari_outbox;
create policy ari_outbox_tenant on public.ari_outbox
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

alter table public.channex_tax_map enable row level security;
drop policy if exists channex_tax_map_tenant on public.channex_tax_map;
create policy channex_tax_map_tenant on public.channex_tax_map
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

alter table public.stop_sell enable row level security;
drop policy if exists stop_sell_tenant on public.stop_sell;
create policy stop_sell_tenant on public.stop_sell
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- --- Über den Parent (properties) abgeleitete Tabellen (nur property_id) ---
-- property_dossier-Slice (0127): sensible Objektdaten (Zugang, Notfallvollmacht,
-- Hausbuch, Handwerker …) → Tenant über die zugehörige property ableiten.

do $$
declare
  tbl text;
  dossier_tables text[] := array[
    'property_access',
    'property_emergency_authority',
    'property_housebook',
    'property_marketing',
    'property_platform_launches',
    'property_process',
    'property_service_agreements',
    'property_tradespeople'
  ];
begin
  foreach tbl in array dossier_tables loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || '_via_property', tbl);
    execute format($f$
      create policy %I on public.%I
        for all
        using (exists (
          select 1 from public.properties p
          where p.id = %I.property_id
            and p.tenant_id = public.current_tenant_id()
        ))
        with check (exists (
          select 1 from public.properties p
          where p.id = %I.property_id
            and p.tenant_id = public.current_tenant_id()
        ))
    $f$, tbl || '_via_property', tbl, tbl, tbl);
  end loop;
end $$;

-- --- System-/Referenztabellen ohne Tenant → nur Service-Role ---
-- RLS aktiv, KEINE permissive Policy → anon/authenticated sehen nichts
-- (deny-all/fail-closed). Backend liest ausschließlich via service_role.

alter table public.stripe_webhook_event enable row level security;
-- Idempotenz-/Claim-Tabelle für Stripe-Webhooks: darf für Clients NIE lesbar sein.

alter table public.fx_rates enable row level security;
-- Globale Wechselkurs-Referenzdaten: Zugriff nur serverseitig (service_role).

-- ============================================================================
-- Teil B — rls_auto_enable() + Event-Trigger versionieren (Schutz für neue Tabellen)
-- ============================================================================
-- Idempotent: create-or-replace + drop-if-exists. Harmlos, falls die
-- Advisor-Variante zusätzlich existiert (beide aktivieren nur RLS = idempotent).

create or replace function public.rls_auto_enable()
  returns event_trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  obj record;
begin
  for obj in
    select * from pg_event_trigger_ddl_commands()
    where command_tag = 'CREATE TABLE' and object_type = 'table'
  loop
    if obj.schema_name = 'public' then
      execute format('alter table %s enable row level security', obj.object_identity);
    end if;
  end loop;
end;
$$;

-- SECURITY DEFINER-Funktion darf NICHT per REST-RPC aufrufbar sein (Advisor-Fix,
-- vgl. 0018). Event-Trigger nutzt sie intern, unabhängig von EXECUTE-Grants.
revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;

drop event trigger if exists nextdays_rls_auto_enable;
create event trigger nextdays_rls_auto_enable
  on ddl_command_end
  when tag in ('CREATE TABLE')
  execute function public.rls_auto_enable();
