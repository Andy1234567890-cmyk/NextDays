-- Nachtrag zu 0268: expliziten payment_collect-Altbestand backfillen.
--
-- 0240 hat die Spalten nur ANGELEGT, nie aus channex_booking.raw befüllt —
-- Buchungen von VOR 0240, deren letzte Revision ein explizites
-- payment_collect='ota' trug (Airbnb/Expedia-Collect ohne VCC), stehen daher
-- noch auf NULL. 0268 Teil 1 füllte nur den VCC-Fall (guarantee.is_virtual);
-- hier zieht der explizite Fall nach, danach derselbe Bezahlt-Nachzug wie in
-- 0268 Teil 2 (idempotent: nur unberührte unpaid/0-Zustände, keine
-- abgeschlossenen oder stornierten Aufenthalte).

update public.reservations r
   set payment_collect = 'ota'
  from public.channex_booking cb
 where cb.tenant_id = r.tenant_id
   and cb.channex_booking_id = r.source_channex_booking_id
   and r.payment_collect is null
   and lower(cb.raw ->> 'payment_collect') = 'ota';

update public.reservations
   set paid_amount    = total_amount,
       payment_status = 'paid'
 where payment_collect = 'ota'
   and status <> 'cancelled'
   and checked_out_at is null
   and payment_status = 'unpaid'
   and paid_amount = 0;
