-- Vom Portal einbehaltene Steuern (collected_taxes) an der Buchung führen.
--
-- Booking.com behält in manchen Städten/Ländern Steuern (z. B. City Tax)
-- direkt ein und meldet sie über den Aggregator je Zimmer als
-- `collected_taxes` („Collected Taxes is also known as Withheld Taxes.
-- This is Taxes what is collected by OTA side.", nur Booking.com). Ohne
-- diesen Betrag ist die angezeigte Netto-Auszahlung (Brutto − Provision)
-- zu hoch — die echte Überweisung des Portals ist um die einbehaltenen
-- Steuern kleiner. Der Import summiert sie ab jetzt in diese Spalte;
-- null = nicht geliefert (nicht „0 einbehalten").

alter table public.reservations
    add column if not exists ota_withheld_taxes numeric(12, 2);

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'reservations_ota_withheld_taxes_check'
    ) then
        alter table public.reservations
            add constraint reservations_ota_withheld_taxes_check
            check (ota_withheld_taxes is null or ota_withheld_taxes >= 0);
    end if;
end $$;

comment on column public.reservations.ota_withheld_taxes is
    'Vom Portal einbehaltene Steuern (collected_taxes, Booking.com) in '
    'Buchungswährung, Summe über alle Zimmer. Mindert die Auszahlung '
    'zusätzlich zur Provision. null = nicht geliefert.';

-- Altbestand: aus der zuletzt gespeicherten Roh-Payload nachziehen.
update public.reservations r
   set ota_withheld_taxes = sub.summe
  from (
    select cb.tenant_id, cb.channex_booking_id,
           sum((tax ->> 'total_price')::numeric) as summe
      from public.channex_booking cb,
           jsonb_array_elements(
               case jsonb_typeof(cb.raw -> 'rooms')
                    when 'array' then cb.raw -> 'rooms'
                    else '[]'::jsonb end
           ) as room,
           jsonb_array_elements(
               case jsonb_typeof(room -> 'collected_taxes')
                    when 'array' then room -> 'collected_taxes'
                    else '[]'::jsonb end
           ) as tax
     where (tax ->> 'total_price') ~ '^[0-9]+(\.[0-9]+)?$'
     group by cb.tenant_id, cb.channex_booking_id
  ) sub
 where sub.tenant_id = r.tenant_id
   and sub.channex_booking_id = r.source_channex_booking_id
   and r.ota_withheld_taxes is null;
