-- Ein Schaden kann BEHOBEN werden — unabhängig davon, wer ihn bezahlt.
--
-- Warum kein fünfter Status: `status` beschreibt die kaufmännische Kette
-- (gemeldet → bestaetigt → abgerechnet), `verworfen` heisst „war doch kein
-- Schaden". „Behoben" ist eine ANDERE Achse: ein Sessel kann bezahlt und
-- weiterhin kaputt sein, oder repariert und nie abgerechnet. Beides in eine
-- Spalte zu pressen hiesse, eine der beiden Aussagen zu verlieren — und die
-- Abrechnung würde einen Zustand mitschleppen, der sie nichts angeht.
--
-- Deshalb zwei eigene Spalten. `behoben_am is null` = offen; das ist
-- dieselbe Form wie `geprueft_am` an der Inventarzeile.

alter table public.inventory_damage
    add column if not exists behoben_am timestamptz,
    add column if not exists behoben_von uuid references public.users (id) on delete set null;

comment on column public.inventory_damage.behoben_am is
    'Wann der Schaden behoben wurde (repariert/ersetzt). Unabhängig vom '
    'Status: bezahlt und behoben sind zwei verschiedene Aussagen. '
    'NULL = noch offen.';

-- Ein verworfener Schaden kann nicht behoben sein: es gab keinen.
-- Ohne diese Bedingung stünde eine Zeile da, die beides behauptet.
alter table public.inventory_damage
    drop constraint if exists inventory_damage_verworfen_nicht_behoben;
alter table public.inventory_damage
    add constraint inventory_damage_verworfen_nicht_behoben
        check (status <> 'verworfen' or behoben_am is null);

-- Die offenen Schäden eines Objekts sind die Arbeitsliste. Der bestehende
-- Index (tenant, property, status, gemeldet_am) trägt `behoben_am` nicht;
-- ohne diesen hier filtert jede Ansicht der offenen Posten über den Heap.
create index if not exists inventory_damage_offen_idx
    on public.inventory_damage (tenant_id, property_id, gemeldet_am desc)
    where behoben_am is null;
