-- 0396 — Gegenzustand zu 0395 (Wurzel 1): die wiederhergestellten Stop-Sells
-- auch den Portalen melden.
--
-- Zwischen 0394 (Löschung) und 0395 (Wiederherstellung) haben Full-Syncs den
-- Portalen stop_sell=false gemeldet — die gestoppten Tage sind bei
-- Booking/Airbnb gerade BUCHBAR. 0395 hat nur die lokale Tabelle repariert;
-- ohne diesen Nachzug bliebe der Portal-Stand bis zum nächtlichen Sync
-- (02:05) falsch. Eingereiht wird der normale full_sync_property-Job je
-- gemapptem Objekt — derselbe Weg wie jede Nacht, keine Sonderbehandlung.
-- Idempotent über dedup_key.

insert into public.jobs (tenant_id, job_type, payload, dedup_key)
select m.tenant_id,
       'full_sync_property',
       jsonb_build_object('tenant_id', m.tenant_id, 'property_id', m.property_id),
       'stopsell-restore-0395-' || m.property_id
from public.channex_property_map m
where m.deleted_at is null
  and m.sync_enabled
  and not exists (
    select 1 from public.jobs j
    where j.dedup_key = 'stopsell-restore-0395-' || m.property_id
  );
