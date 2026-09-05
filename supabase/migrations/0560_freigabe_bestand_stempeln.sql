-- 0560 — Altbestand: bereits gesendete Preise tragen ihren Stempel nach.
--
-- ANLASS (04.09.2026, gemeldet vom Nutzer)
-- ========================================
-- Die Leiste zeigte "540 Tage nicht gesendet", obwohl der Kalender 30 Tage
-- zeigt und alle Preise längst an den Portalen lagen. Drei Fehler trafen
-- zusammen; die ersten beiden sind im Code behoben (freigabe.py,
-- recompute.py, settings_service.py), dieser hier räumt die Datenspur auf.
--
--  1. Die Zählung kannte keinen Horizont. Der Recompute schreibt 540 Tage
--     voraus, der Push bedient 365 — 174 Tage konnten also nie gesendet
--     werden und warteten trotzdem für immer auf eine Freigabe.
--
--  2. `recompute` stempelte nur bei `not gesperrt`. Bei eingeschalteter
--     Freigabe ist `gesperrt` nie leer, also stempelte der Lauf nie, also
--     blieben die Tage gesperrt. Ein Zirkel ohne Ausgang.
--
--  3. Das Einschalten der Freigabe pflegte seinen Gegenzustand nicht
--     (Wurzel 1): der zu diesem Zeitpunkt bereits gesendete Bestand galt
--     ab dem Klick rückwirkend als "wartet".
--
-- WAS DIESE MIGRATION TUT
-- =======================
-- Sie stempelt NUR Tage, für die ein erfolgreicher Rate-Push belegt ist:
-- eine `ari_restriction_outbox`-Zeile mit kind='rate', status='done', deren
-- Zeitraum den Tag enthält. Kein pauschales Update über die ganze Tabelle —
-- ein Tag ohne Beleg bleibt offen und wartet zu Recht.
--
-- Idempotent (Wurzel 2): `gesendet_am is null` als Bedingung, ein zweiter
-- Lauf findet nichts mehr.
update public.dynamic_prices dp
   set gesendet_am = now()
 where dp.gesendet_am is null
   and exists (
         select 1
           from public.ari_restriction_outbox o
          where o.property_id = dp.property_id
            and o.kind        = 'rate'
            and o.status      = 'done'
            and dp.date between o.date_from and o.date_to
       );
