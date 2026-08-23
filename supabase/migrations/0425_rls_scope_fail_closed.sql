-- 0425 — Die beiden RLS-Scope-Funktionen waren FAIL-OPEN.
--
-- LIVE BEWIESEN am 23.08.2026 gegen die Kundendatenbank:
--     select owner_can_see_property(…) as owner_null_rolle,
--            staff_can_see_property(…) as staff_null_rolle;
--     owner_null_rolle | staff_null_rolle
--     t                | t
-- Beide gaben für eine FEHLENDE Rolle `true` zurück.
--
-- WARUM:
--   0058: `when current_user_role() is distinct from 'owner' then true`
--         → `NULL is distinct from 'owner'` ist TRUE.
--   0136: `when current_user_role() is null … then true`  (ausdrücklich so)
--
-- `current_user_role()` liest `request.jwt.claims → app_metadata →> 'role'`.
-- Ein JWT ohne oder mit unbekanntem Role-Claim passierte damit BEIDE
-- restriktiven SELECT-Policies für jede `properties`-Zeile und alles, was daran
-- hängt (0136 listet: reservations, reviews, price_overrides, rate_plans,
-- inventory_items, meter_readings …). Genau der Weg, den Wurzel 6 beschreibt:
-- anon-Key plus `curl /rest/v1/<tabelle>` am FastAPI-Layer vorbei.
--
-- DIE UMSTELLUNG: von „alles, was nicht die eingeschränkte Rolle ist" auf eine
-- ALLOWLIST der Rollen, die tenant-weit sehen dürfen. Damit ist ein fehlender,
-- leerer oder unbekannter Claim automatisch eingeschränkt statt automatisch
-- erlaubt — die Fehlerrichtung dreht sich.
--
-- Es wird NICHTS entfernt: der Zuordnungs-Zweig (owner_property_assignments
-- bzw. staff_property_assignments) bleibt unverändert, und die Rollen, die
-- vorher tenant-weit sehen durften (admin, co_admin), dürfen es weiter. Neu ist
-- allein, dass NULL/unbekannt nicht mehr dazugehört.
--
-- WELCHE ROLLEN TENANT-WEIT SEHEN: admin und co_admin — dieselbe Menge, die
-- `capabilities_for` im Backend als Verwalter führt (`auth/permissions.py`).
-- `owner` sieht seine zugeordneten Objekte, `staff`/`cleaner` ihre freigegebenen.
-- Eine Rolle, die keiner der drei Gruppen angehört, sieht nichts.

create or replace function public.owner_can_see_property(p_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    case
      -- ALLOWLIST statt Negativ-Prüfung: nur diese Rollen sehen tenant-weit.
      -- Vorher stand hier `is distinct from 'owner'`, was bei NULL TRUE ergab.
      when public.current_user_role() in ('admin', 'co_admin') then true
      when public.current_user_role() = 'owner' then exists (
        select 1
        from public.owner_property_assignments a
        where a.property_id = p_property_id
          and a.user_id = auth.uid()
          and a.tenant_id = public.current_tenant_id()
      )
      -- staff/cleaner regelt `staff_can_see_property`; alles andere (NULL,
      -- unbekannt) sieht hier nichts. Fail-closed (Wurzel 6).
      when public.current_user_role() in ('staff', 'cleaner') then true
      else false
    end
$$;

create or replace function public.staff_can_see_property(p_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    case
      when public.current_user_role() in ('admin', 'co_admin') then true
      when public.current_user_role() in ('staff', 'cleaner') then exists (
        select 1
        from public.staff_property_assignments a
        where a.property_id = p_property_id
          and a.user_id = auth.uid()
          and a.tenant_id = public.current_tenant_id()
      )
      -- owner regelt `owner_can_see_property`; NULL/unbekannt sieht nichts.
      when public.current_user_role() = 'owner' then true
      else false
    end
$$;

-- Wie in 0058/0136: die Funktionen sind Policy-Bausteine, nicht für Clients.
revoke execute on function public.owner_can_see_property(uuid) from anon, authenticated;
revoke execute on function public.staff_can_see_property(uuid) from anon, authenticated;
