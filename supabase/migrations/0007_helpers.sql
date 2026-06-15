-- 0007_helpers.sql — Hilfsfunktionen für RLS und Timestamps
--
-- MUSS vor 0008_rls_policies.sql laufen (Policies nutzen current_tenant_id()).

-- Liest tenant_id aus dem JWT app_metadata. Quelle der Wahrheit für RLS.
-- stable: pro Statement einmal ausgewertet. Kein Zugriff auf Tabellen.
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(
    current_setting('request.jwt.claims', true)::jsonb
      -> 'app_metadata' ->> 'tenant_id',
    ''
  )::uuid
$$;

-- Generischer updated_at-Trigger.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

-- updated_at-Trigger auf alle Tabellen mit der Spalte legen.
do $$
declare
  t text;
begin
  foreach t in array array[
    'tenants', 'users', 'properties', 'rate_plans', 'guests',
    'availability', 'reservations', 'payments',
    'portal_guests', 'commissions'
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
