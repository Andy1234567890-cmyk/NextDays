-- Aufgaben zu Eigennutzungen wegräumen, die niemand bestellt hat (0510-Rest).
--
-- WAS 0510 GEREGELT HAT: Fährt der Eigentümer in sein eigenes Haus, entsteht
-- eine Reinigung nur, wenn er sie BESTELLT hat (`block_request_services`).
-- Ohne Bestellung ist es Arbeit ohne Auftrag: das Personal führt sie aus, der
-- Betrieb kann sie nicht abrechnen, und niemand hat sie angeordnet.
--
-- WAS 0510 NICHT GEREGELT HAT: den Bestand. `regel_erlaubt` verhindert das
-- ANLEGEN neuer Aufgaben; die vorher entstandenen blieben bewusst stehen, weil
-- das Wegräumen „dem Pfad gehört, der die Abbestellung kennt" — den gab es
-- aber nie. Live standen deshalb am 03.09.2026 noch 43 solche Aufgaben, 33
-- davon offen. Gemeldet hat es der Betrieb, nicht das System: „eigentlich
-- dürften die gar nicht sein, weil ein Eigentümer muss eine Reinigung buchen".
--
-- WAS BLEIBT:
--   * ERLEDIGTE (10) — die Arbeit ist geleistet, sie hängt an Kosten und
--     Fotos. Sie zu löschen wäre Geschichtsfälschung, und gerade sie belegen,
--     was unbestellt ausgeführt wurde.
--   * Alles zu gewöhnlichen Buchungen — hier geht es ausschliesslich um
--     `is_owner_stay`.
--   * Vom Eigentümer BESTELLTE (`ordered_by_owner` oder ein Eintrag in
--     `block_request_services`) — die sind beauftragt und sollen bleiben.

create table if not exists public.tasks_unbestellt_0537 as
select t.*
  from public.tasks t
  join public.reservations r on r.id = t.reservation_id
 where t.source = 'auto'
   and r.is_owner_stay = true
   and coalesce(t.ordered_by_owner, false) = false
   and t.status in ('open', 'in_progress')
   and not exists (
     select 1 from public.block_request_services s
      where s.block_request_id = r.block_request_id
        and s.rule_id = t.rule_id);

-- Nur der Server sieht die Sicherung (Wurzel 6): dieselben Gast- und
-- Objektbezüge wie `tasks`.
alter table public.tasks_unbestellt_0537 enable row level security;
revoke all on public.tasks_unbestellt_0537 from anon, authenticated;

delete from public.tasks t
 using public.reservations r
 where r.id = t.reservation_id
   and t.source = 'auto'
   and r.is_owner_stay = true
   and coalesce(t.ordered_by_owner, false) = false
   and t.status in ('open', 'in_progress')
   and not exists (
     select 1 from public.block_request_services s
      where s.block_request_id = r.block_request_id
        and s.rule_id = t.rule_id);
