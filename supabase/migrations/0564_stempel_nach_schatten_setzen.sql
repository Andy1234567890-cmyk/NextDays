-- 0564 — Der Stempel folgt dem Schatten, auch in die andere Richtung.
--
-- ANLASS (05.09.2026)
-- ===================
-- 0561 entfernte den Stempel `gesendet_am`, wo der Schatten (`channex_ari_shadow`,
-- der lokale Stand des zuletzt GEPUSHTEN Preises) vom berechneten Preis abwich.
-- Danach stellte der Betrieb die Freigabe auf „Sofort"; der Umschalt-Push
-- schickte alle Preise hinaus — der Schatten stimmt seither auf den Cent für
-- 1000 von 1000 Zeilen — setzte aber KEINEN Stempel (nur der Recompute-Push
-- kannte ihn). Ergebnis: Objektseite „AKTIV – 366 TAGE NICHT GESENDET" und
-- ein Sende-Knopf, obwohl nichts ausstand und der Betrieb die Freigabe gerade
-- abgeschaltet hatte.
--
-- Der Code stempelt seit heute auf beiden Wegen (`freigabe.gesendet_stempeln`).
-- Diese Migration zieht den BESTAND nach: wo der Schatten mit dem berechneten
-- Preis übereinstimmt, IST der Preis draußen — der Stempel sagt es jetzt auch.
-- Sie ist die Gegenrichtung von 0561 und dieselbe Wahrheit: der Schatten
-- entscheidet, nicht die Outbox, nicht die Uhr.
update public.dynamic_prices dp
   set gesendet_am = now()
 where dp.gesendet_am is null
   and exists (
         select 1
           from public.channex_ari_shadow s
           join public.rate_plans rp on rp.id = s.rate_plan_id
          where rp.property_id = dp.property_id
            and s.date         = dp.date
            and s.rate_cents is not null
            and abs(s.rate_cents - round(dp.price * 100)) <= 1
       );
