-- 0084_rls_close_unprotected_tables.sql — RLS-Backstop-Lücke schließen
--
-- Security-Audit (Infra-Runbook Punkt 8b) fand 6 public-Tabellen MIT vollen
-- anon/authenticated-Grants, aber OHNE aktiviertes RLS. Über PostgREST (/rest/v1/)
-- waren sie damit für jeden anon-Key tenant-übergreifend les- UND schreibbar —
-- ein methoden-unabhängiger Bypass (GET wie QUERY wie POST identisch betroffen).
--
-- Live verifiziert vor dem Fix: anon-Key GET /rest/v1/ari_outbox|stop_sell|
-- stripe_webhook_event lieferte echte Fremd-Tenant-Zeilen (HTTP 200).
--
-- Prinzip default-deny: RLS aktivieren; tenant-gebundene Tabellen erhalten die
-- Standard-tenant-Policy (wie alle Geschwister in 0008/0015), System-/globale
-- Tabellen erhalten KEINE permissive Policy für anon/authenticated → nur der
-- service_role (rolbypassrls=t, Backend) kommt heran. Bestehende RESTRICTIVE
-- owner-scope-Policies aus 0059 (ari_outbox/channex_tax_map/stop_sell) wirken
-- erst JETZT, da RLS auf diesen Tabellen überhaupt aktiv ist.
--
-- Idempotent: enable RLS ist wiederholbar; Policies via drop-if-exists vor create.

-- === 1) Tenant-gebundene Tabellen (tenant_id-Spalte) ========================
-- Gleiches Muster wie z. B. season_templates_tenant in 0015.
do $$
declare
  t text;
  tables text[] := array['ari_outbox', 'channex_tax_map', 'stop_sell'];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_tenant', t);
    execute format(
      'create policy %I on public.%I for all '
      || 'using (tenant_id = public.current_tenant_id()) '
      || 'with check (tenant_id = public.current_tenant_id())',
      t || '_tenant', t
    );
  end loop;
end
$$;

-- === 2) System-/globale Tabellen (kein tenant_id) ===========================
-- fx_rates           — Wechselkurs-Cache (Backend-Job schreibt via service_role)
-- schema_migrations  — Migrations-Tracking (apply-migrations.sh, service_role)
-- stripe_webhook_event — Webhook-Idempotenz (Backend-Webhook, service_role)
--
-- Diese dürfen für anon/authenticated weder les- noch schreibbar sein. RLS
-- aktivieren OHNE permissive Policy = default-deny für alle Nicht-bypassrls-
-- Rollen. service_role (rolbypassrls=t) bleibt voll funktionsfähig.
do $$
declare
  t text;
  tables text[] := array['fx_rates', 'schema_migrations', 'stripe_webhook_event'];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end
$$;

-- Hinweis: Realtime-Publication wird NICHT angefasst — keine dieser Tabellen
-- speist eine Live-UI (siehe 0077: ari_outbox/channex_tax_map/fx_rates sind
-- ausdrücklich rein technisch/intern). Kein neuer Realtime-Surface.
