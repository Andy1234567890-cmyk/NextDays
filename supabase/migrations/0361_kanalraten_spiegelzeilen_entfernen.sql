-- 0361 — Gespiegelte Channex-Kanalraten aus rate_plans entfernen (Datenfix)
--
-- BEFUND (live gelesen am 11.08.2026 über alle 19 Channex-Properties):
-- Channex' Inventar hat drei Ebenen — Zimmertyp → Zimmerpreis → KANALRATE. Die
-- dritte legt Channex selbst an, je Eintrag im Kanal-Mapping, als Kind unseres
-- Plans: `relationships.channel` gesetzt, `relationships.parent_rate_plan` auf
-- unseren Grundpreis-Plan, `rate_mode: derived`, Eigenpreis `0.00` (eine
-- abgeleitete Rate hat keinen eigenen Preis — sie erbt). Der Titel ist unser
-- Planname plus Channex' Suffix: „Grundpreis (von Airbnb) - AirBNB Airbnb".
-- Channex' eigene Oberfläche blendet diese Ebene in „Rooms & Rates" aus.
--
-- `import_rooms_rates_for_property` hielt sie für fremden Portalbestand und
-- spiegelte 32 davon (13 Objekte) als lokale rate_plans mit base_price 0. Folgen:
--   * Preise-Seite: `multiPlan` wurde wahr → die Grundpreis-Eingabe verschwand,
--     obwohl das Objekt genau EINEN Verkaufsplan hat.
--   * sync_content schrieb die Kanalraten danach mit `rate_mode: manual` zurück
--     und nahm ihnen die Ableitung vom echten Grundpreis-Plan (live messbar:
--     genau die 32 gespiegelten stehen auf `manual`, die 12 nicht gespiegelten
--     weiterhin auf `derived`).
--   * ARI: 500 Tage `min_stay` gingen zusätzlich an die Kanalrate (Preis nicht —
--     0 wird auf beiden Push-Wegen gefiltert).
-- Ursache geschlossen in common.kanal_plan_id + bookings_sync (Import),
-- content_sync (Titel-Suche, Prune). Diese Migration räumt den Altbestand.
--
-- Warum die Map-Zeile soft-deleted statt gelöscht wird: der FK
-- channex_rate_plan_map.local_rate_plan_id ist ON DELETE SET NULL. Bliebe sie
-- aktiv, sähe `_prune_orphan_rate_plans` eine Map ohne lokalen Plan — und würde
-- Channex' Kanalrate löschen. Die Kanalrate IST das Kanal-Mapping des Portals:
-- ein Löschen nähme dem Objekt den Kanal. (Wurzel 1: Gegenzustand mitpflegen.)
--
-- Merkmale der Auswahl, alle drei müssen zutreffen — es wird NICHTS gelöscht,
-- was ein Mensch angelegt hat:
--   1. der Plan hat eine channex_rate_plan_map (kam also aus dem Import),
--   2. sein Name trägt Channex' Kanal-Suffix,
--   3. base_price = 0 und portal_scope IS NULL (kein „·"-Kanalplan von uns).
-- Reservierungen hängen an keinem davon (geprüft: 0); rate_plan_sync_state und
-- channex_ari_shadow hängen per ON DELETE CASCADE mit ab.

begin;

create temporary table _kanalraten_spiegel on commit drop as
select rp.id as rate_plan_id, m.id as map_id
from public.rate_plans rp
join public.channex_rate_plan_map m on m.local_rate_plan_id = rp.id
where (rp.name like '% - AirBNB %' or rp.name like '% - BookingCom %')
  and rp.portal_scope is null
  and rp.base_price = 0;

update public.channex_rate_plan_map
   set deleted_at = now()
 where id in (select map_id from _kanalraten_spiegel)
   and deleted_at is null;

delete from public.rate_plans
 where id in (select rate_plan_id from _kanalraten_spiegel);

commit;
