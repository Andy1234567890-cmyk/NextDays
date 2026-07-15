-- 0139_ari_restriction_kind_rows.sql — neuer Restriktions-Outbox-Typ
--
-- push_restriction_rows_for_property bündelt mehrere HETEROGENE Restriktions-
-- Zeilen (rate/min_stay/max_stay/CTA/CTD/stop_sell je Zeile eigen) in EINEM
-- Channex-restrictions-Call (Zertifizierung Test 3-8). Die Outbox persistiert
-- die Absicht unter kind='restriction_rows' — der Enum muss den Wert kennen,
-- sonst schlägt der Insert fehl (22P02 invalid enum value).

do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'ari_restriction_kind' and e.enumlabel = 'restriction_rows'
  ) then
    alter type public.ari_restriction_kind add value 'restriction_rows';
  end if;
end
$$;
