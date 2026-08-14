-- 0395 — Stop-Sells auf den Stand von 14.08.2026 02:05 Uhr wiederherstellen.
--
-- 0394 hat alle stop_sell-Zeilen mit source='channex' gelöscht — in der
-- Annahme, das seien ausschließlich Echo-Artefakte des ARI-Imports. Das war
-- falsch: Der Bug hatte auch vom Betrieb GEWOLLTE Verkaufsstopps unter diesem
-- Etikett abgelegt (Echo-Zyklus über Setzen/Aufheben), die Löschung nach
-- Etikett hat also Nutzer-Absicht mit entfernt. Lehre: Eine Bereinigung nach
-- `source` ist keine Bereinigung nach ABSICHT.
--
-- Wiederhergestellt wird der letzte an die Portale gemeldete Stand vor der
-- Löschung: die stop_sell=true-Spannen aus den Full-Sync-Pushes von heute
-- 02:00–02:15 UTC (channex_debug_log ist das vollständige Protokoll dieser
-- Sendungen). Die Zeilen kommen als source='manual' mit Vermerk zurück —
-- damit gehören sie dem Betrieb, sind im Kalender aufhebbar und werden vom
-- nächtlichen Full-Sync wieder als Stop gepusht. Bereits vorhandene Tage
-- (die 8 unberührten manuellen Stops) werden nicht doppelt angelegt.
--
-- Der Storno-Bug-Fix bleibt davon unberührt: der Import schreibt keine
-- stop_sell-Zeilen mehr, neue Artefakte können nicht entstehen.

insert into public.stop_sell (tenant_id, property_id, date, source, reason, scope)
select distinct d.tenant_id, d.property_id,
       gs.tag::date,
       'manual'::public.stop_sell_source,
       'wiederhergestellt 14.08.2026 (Stand vor Bereinigung 0394)',
       'all'
from public.channex_debug_log d
cross join lateral jsonb_array_elements(d.request_body->'values') v
cross join lateral generate_series(
    (v.value->>'date_from')::date, (v.value->>'date_to')::date, interval '1 day'
) gs(tag)
where d.channex_method = 'POST'
  and d.channex_path = 'restrictions'
  and d.created_at between '2026-08-14 02:00+00' and '2026-08-14 02:15+00'
  and (v.value->>'stop_sell')::boolean is true
  and not exists (
    select 1 from public.stop_sell s
    where s.property_id = d.property_id
      and s.date = gs.tag::date
      and s.rate_plan_id is null
  );
