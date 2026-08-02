-- Airbnb-Buchungen: das Portal kassiert IMMER.
--
-- Airbnb kennt strukturell keinen Vor-Ort-Zahlweg — der Gast zahlt bei der
-- Bestätigung an Airbnb, der Betrieb erhält den Payout. Der Aggregator
-- meldet dabei aber weder payment_collect noch eine virtuelle Kreditkarte
-- (Zahlungsdaten nur als Freitext in notes) — ohne Kanal-Regel stünden
-- Airbnb-Buchungen dauerhaft als „offen", obwohl das Geld längst floss.
-- Der Import leitet das ab jetzt aus dem Kanal ab; hier zieht der
-- Altbestand nach (gleiche Guards wie 0268/0269: nichts Abgeschlossenes,
-- nichts Storniertes, keine berührten Zahl-Zustände).

update public.reservations
   set payment_collect = 'ota'
 where channel = 'airbnb'
   and source_channex_booking_id is not null
   and payment_collect is null;

update public.reservations
   set paid_amount    = total_amount,
       payment_status = 'paid'
 where payment_collect = 'ota'
   and status <> 'cancelled'
   and checked_out_at is null
   and payment_status = 'unpaid'
   and paid_amount = 0;
