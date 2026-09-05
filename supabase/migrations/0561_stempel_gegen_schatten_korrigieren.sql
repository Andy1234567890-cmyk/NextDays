-- 0561 — Der Stempel gehört an den Schatten, nicht an die Outbox-Zeile.
--
-- FEHLER IN 0560 (selbe Sitzung, 04.09.2026)
-- ==========================================
-- 0560 stempelte jeden Tag, für den eine `ari_restriction_outbox`-Zeile mit
-- kind='rate' und status='done' existierte. Das ist KEIN Preis-Beleg:
--
--   * Eine 'rate'-Zeile kann ausschliesslich `min_stay`-Segmente enthalten.
--     Genau das war der letzte Push (20:52) — sieben Segmente, alle ohne
--     `rate_cents`. Kein einziger Preis ging hinaus, die Zeile stand
--     trotzdem auf 'done'.
--   * Der Reconciler sendet nur die DIFFERENZ gegen den Schatten. Ein Tag
--     ohne Drift erzeugt gar kein Segment — und ohne Segment keinen Preis.
--
-- Messbar wurde es im Vergleich Soll gegen Schatten: 435 von 540 Tagen
-- weichen ab (04.09.2026: DP 710,94 · Channex 577,50 · Kalender zeigte
-- 541,45 gegen 433 bei Channex). 0560 hatte alle 540 als gesendet markiert.
--
-- WAS DIESE MIGRATION TUT
-- =======================
-- `channex_ari_shadow` ist der lokale Schatten des zuletzt erfolgreich
-- GEPUSHTEN Stands — die einzige belastbare Aussage darüber, welcher Preis
-- bei Channex steht. Der Stempel wird daran ausgerichtet:
--
--   * Stimmt der Schatten mit dem berechneten Preis überein (auf den Cent,
--     über IRGENDEINEN Rate-Plan des Objekts), bleibt/wird gestempelt.
--   * Weicht er ab, wird der Stempel ENTFERNT — der Tag wartet zu Recht.
--
-- Damit sieht der Betrieb wieder, was wirklich aussteht, statt einer 0, die
-- Übereinstimmung behauptet, wo keine ist.
update public.dynamic_prices dp
   set gesendet_am = null
 where dp.gesendet_am is not null
   and not exists (
         select 1
           from public.channex_ari_shadow s
           join public.rate_plans rp on rp.id = s.rate_plan_id
          where rp.property_id = dp.property_id
            and s.date         = dp.date
            and s.rate_cents is not null
            and abs(s.rate_cents - round(dp.price * 100)) <= 1
       );
