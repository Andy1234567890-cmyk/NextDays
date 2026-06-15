-- 0008_rls_policies.sql — Row-Level-Security auf allen Tabellen
--
-- Tenant-Isolation über public.current_tenant_id() (aus JWT app_metadata).
-- Tabellen ohne eigene tenant_id (rate_plans, availability, messages, payments)
-- leiten den Tenant über ihren Parent ab.
-- Der Service-Role-Key umgeht RLS generell (für register-Flow, System-Jobs).

-- === Direkt tenant-gebundene Tabellen ===

alter table public.tenants enable row level security;
create policy tenants_self on public.tenants
  for all
  using (id = public.current_tenant_id())
  with check (id = public.current_tenant_id());

alter table public.users enable row level security;
create policy users_tenant on public.users
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

alter table public.properties enable row level security;
create policy properties_tenant on public.properties
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

alter table public.guests enable row level security;
create policy guests_tenant on public.guests
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

alter table public.reservations enable row level security;
create policy reservations_tenant on public.reservations
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

alter table public.commissions enable row level security;
create policy commissions_tenant on public.commissions
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- === Über Parent abgeleitete Tabellen ===

alter table public.rate_plans enable row level security;
create policy rate_plans_via_property on public.rate_plans
  for all
  using (exists (
    select 1 from public.properties p
    where p.id = rate_plans.property_id
      and p.tenant_id = public.current_tenant_id()
  ))
  with check (exists (
    select 1 from public.properties p
    where p.id = rate_plans.property_id
      and p.tenant_id = public.current_tenant_id()
  ));

alter table public.availability enable row level security;
create policy availability_via_property on public.availability
  for all
  using (exists (
    select 1 from public.properties p
    where p.id = availability.property_id
      and p.tenant_id = public.current_tenant_id()
  ))
  with check (exists (
    select 1 from public.properties p
    where p.id = availability.property_id
      and p.tenant_id = public.current_tenant_id()
  ));

alter table public.messages enable row level security;
create policy messages_via_reservation on public.messages
  for all
  using (exists (
    select 1 from public.reservations r
    where r.id = messages.reservation_id
      and r.tenant_id = public.current_tenant_id()
  ))
  with check (exists (
    select 1 from public.reservations r
    where r.id = messages.reservation_id
      and r.tenant_id = public.current_tenant_id()
  ));

alter table public.payments enable row level security;
create policy payments_via_reservation on public.payments
  for all
  using (exists (
    select 1 from public.reservations r
    where r.id = payments.reservation_id
      and r.tenant_id = public.current_tenant_id()
  ))
  with check (exists (
    select 1 from public.reservations r
    where r.id = payments.reservation_id
      and r.tenant_id = public.current_tenant_id()
  ));

-- === Marktplatz (Phase 2): RLS aktiviert, Policies bewusst minimal ===
-- portal_guests: jeder Portal-Gast sieht nur sich selbst.
alter table public.portal_guests enable row level security;
create policy portal_guests_self on public.portal_guests
  for all
  using (id = auth.uid())
  with check (id = auth.uid());

-- reviews: öffentlich lesbar; Schreiben nur durch den verfassenden Portal-Gast.
alter table public.reviews enable row level security;
create policy reviews_public_read on public.reviews
  for select
  using (true);
create policy reviews_author_write on public.reviews
  for insert
  with check (portal_guest_id = auth.uid());
