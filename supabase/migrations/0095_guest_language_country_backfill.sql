-- 0095_guest_language_country_backfill.sql — Sprache/Land aus Buchungen in die
-- Gästemappe nachziehen
--
-- Der Buchungs-Wizard erfasst Sprache + Land des Gastes; beides lag bisher nur
-- denormalisiert an der Reservierung (guest_language/guest_country) und fehlte
-- in der Gästekartei. Neuanlagen schreiben seit guests/identity.py:
--   * Sprache → guests.language (0046)
--   * Land    → guest_addresses.country (Wohnsitzland, NICHT nationality)
-- Dieser Backfill zieht die Daten deterministisch aus der JÜNGSTEN Buchung des
-- Gastes nach — nur wo noch nichts gepflegt ist (nie kuratierte Daten
-- überschreiben), anonymisierte Gäste ausgenommen.

-- 1) Sprache
with latest as (
    select distinct on (guest_id)
        guest_id, tenant_id, guest_language
    from public.reservations
    where guest_id is not null
      and guest_language is not null
      and btrim(guest_language) <> ''
    order by guest_id, created_at desc
)
update public.guests g
set language = btrim(l.guest_language)
from latest l
where g.id = l.guest_id
  and g.tenant_id = l.tenant_id
  and g.language is null
  and g.anonymized_at is null;

-- 2) Land → Adresse (nur für Gäste, die noch GAR KEINE Adresse haben)
with latest as (
    select distinct on (guest_id)
        guest_id, tenant_id, guest_country
    from public.reservations
    where guest_id is not null
      and guest_country is not null
      and btrim(guest_country) <> ''
    order by guest_id, created_at desc
)
insert into public.guest_addresses (tenant_id, guest_id, type, country, is_primary)
select l.tenant_id, l.guest_id, 'private', btrim(l.guest_country), true
from latest l
join public.guests g on g.id = l.guest_id and g.tenant_id = l.tenant_id
where g.anonymized_at is null
  and not exists (
      select 1 from public.guest_addresses a where a.guest_id = l.guest_id
  );
