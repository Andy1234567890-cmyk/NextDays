-- 0043_realtime_tenant.sql
-- Fix: Supabase-Realtime (selbst-gehostet) meldete "TenantNotFound: realtime".
-- Der Realtime-Server ist multi-tenant und sucht beim Channel-Join einen Tenant
-- mit external_id='realtime' in _realtime.tenants; das Coolify-Supabase-Template
-- legt aber nur 'realtime-dev' an. Ohne 'realtime'-Tenant schlägt JEDES Abo mit
-- CHANNEL_ERROR fehl → kein Realtime.
--
-- Lösung: Tenant 'realtime' als Klon von 'realtime-dev' anlegen (identischer,
-- bereits mit DB_ENC_KEY verschlüsselter jwt_secret — daher KEIN Klartext-Secret
-- nötig) inkl. der zugehörigen CDC-Extension. Idempotent. Realtime-Container
-- danach neu starten, damit der Tenant-Cache neu lädt.
--
-- Hinweis: läuft nur, wenn der Quell-Tenant 'realtime-dev' existiert (Standard
-- im Coolify-Supabase-Stack). Sonst no-op — dann Realtime-Env prüfen.

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = '_realtime')
     and exists (select 1 from _realtime.tenants where external_id = 'realtime-dev')
     and not exists (select 1 from _realtime.tenants where external_id = 'realtime')
  then
    insert into _realtime.tenants (
      id, name, external_id, jwt_secret, max_concurrent_users, max_events_per_second,
      postgres_cdc_default, inserted_at, updated_at, max_bytes_per_second,
      max_channels_per_client, max_joins_per_second, suspend, jwt_jwks,
      notify_private_alpha, private_only, migrations_ran, broadcast_adapter
    )
    select
      gen_random_uuid(), 'realtime', 'realtime', jwt_secret, max_concurrent_users,
      max_events_per_second, postgres_cdc_default, now(), now(), max_bytes_per_second,
      max_channels_per_client, max_joins_per_second, suspend, jwt_jwks,
      notify_private_alpha, private_only, migrations_ran, broadcast_adapter
    from _realtime.tenants where external_id = 'realtime-dev';

    insert into _realtime.extensions (id, type, settings, tenant_external_id, inserted_at, updated_at)
    select gen_random_uuid(), type, settings, 'realtime', now(), now()
    from _realtime.extensions where tenant_external_id = 'realtime-dev';
  end if;
end $$;
