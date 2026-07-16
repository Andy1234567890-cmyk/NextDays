-- 0155_dossier_portal_mfa_rls_hardening.sql — Mega-Audit R-1/R-2/R-4
--
-- Drei RLS-Lücken aus dem Domänen-Audit (2026-07-16), alle DB-seitig geschlossen,
-- damit weder PostgREST (anon-key + Rollen-JWT) noch Realtime sie umgehen kann:
--
--   R-1  property_guest_portal (0121) hatte NUR die tenant-weite for-all-Policy →
--        staff/cleaner/owner sahen door_code/maintenance_phone ALLER Objekte des
--        Mandanten (auch via Realtime, am Service-Masking vorbei). Owner- UND
--        Staff-SELECT-Scope fehlten komplett.
--
--   R-2  Die 8 Objektkartei-Tabellen (0127/0128) haben owner_scope (0128), aber
--        KEINEN staff_scope — 0136 listete sie nicht. Asymmetrie: owner gefiltert,
--        staff/cleaner sahen Zugangsdaten/Notfallvollmachten/Handwerker aller
--        Objekte. Hier wird der fehlende Staff-Scope nachgezogen.
--
--   R-4  user_mfa (0021): die SELECT-Policy (user_id = auth.uid()) ist row-level,
--        nicht column-level → der Row-Owner konnte per PostgREST totp_secret
--        (Klartext) + recovery_codes seiner eigenen Zeile abrufen. Ein gekaperter
--        1.-Faktor hätte damit den 2. Faktor abgezogen. Column-REVOKE als
--        DB-Backstop; das Backend liest die Spalten ausschließlich über
--        service_role (BYPASSRLS + eigene Grants) und ist nicht betroffen.
--
-- Mechanik wie 0059/0136: RESTRICTIVE SELECT-Policies, UND-verknüpft mit den
-- permissiven tenant-Policies → können nur einschränken, nie öffnen. Der
-- Service-Role-Pfad (System-Jobs, API mit service-role) umgeht RLS generell.

-- ============================================================================
-- R-1 — property_guest_portal: owner + staff Scope
-- ============================================================================
-- Der Objektbezug ist property_id. owner_can_see_property (0058) und
-- staff_can_see_property (0136) geben für admin/co_admin true zurück, sodass die
-- deren Sicht weiterhin allein die tenant-Policy regelt.
drop policy if exists property_guest_portal_owner_scope on public.property_guest_portal;
create policy property_guest_portal_owner_scope
  on public.property_guest_portal
  as restrictive
  for select
  using (public.owner_can_see_property(property_id));

drop policy if exists property_guest_portal_staff_scope on public.property_guest_portal;
create policy property_guest_portal_staff_scope
  on public.property_guest_portal
  as restrictive
  for select
  using (public.staff_can_see_property(property_id));

-- ============================================================================
-- R-2 — Objektkartei: fehlender Staff-Scope (owner_scope existiert bereits, 0128)
-- ============================================================================
do $$
declare
  t text;
  tables text[] := array[
    'property_process', 'property_access', 'property_service_agreements',
    'property_tradespeople', 'property_emergency_authority', 'property_marketing',
    'property_housebook', 'property_platform_launches'
  ];
begin
  foreach t in array tables loop
    -- Nur wenn die Tabelle existiert (Migrationsstände können abweichen).
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format(
      'drop policy if exists %I on public.%I',
      t || '_staff_scope', t
    );
    execute format(
      'create policy %I on public.%I
         as restrictive for select
         using (public.staff_can_see_property(property_id))',
      t || '_staff_scope', t
    );
  end loop;
end
$$;

-- ============================================================================
-- R-4 — user_mfa: totp_secret + recovery_codes vor dem Row-Owner verbergen
-- ============================================================================
-- Achtung: authenticated/anon haben aus dem pauschalen Supabase-Grant ein
-- TABELLEN-weites SELECT. Ein reiner column-REVUKE greift dann nicht
-- (has_column_privilege bleibt true, das Tabellen-Grant überstimmt). Deshalb:
-- erst das tabellen-weite SELECT entziehen, dann SELECT NUR auf den unkritischen
-- Spalten zurückgeben — totp_secret/recovery_codes bleiben so dem Row-Owner
-- verborgen. Das Backend nutzt service_role (BYPASSRLS + eigene Grants) und ist
-- nicht betroffen. anon braucht keinen Self-Read → gar kein SELECT.
revoke select on public.user_mfa from authenticated;
revoke select on public.user_mfa from anon;
grant select (user_id, totp_enabled, created_at, updated_at)
  on public.user_mfa to authenticated;
