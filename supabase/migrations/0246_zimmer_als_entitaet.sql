-- Zimmer werden eine eigene Entitaet (vorher: Zaehlwerk in type_attributes.rooms).
--
-- WARUM: Ein Zaehlwerk {"privat":{"schlafzimmer":2}} kann nicht sagen, WELCHES
-- Schlafzimmer welche Betten hat, welche Ausstattung darin liegt, welches Bad
-- an welches Schlafzimmer grenzt und welches Foto wozu gehoert. Genau das ist
-- der Unterschied zwischen "2 Schlafzimmer" und einem Listing, das ein Gast
-- versteht. Referenz ist Lodgifys Rooms-Bereich (Help-Center 21285360759324):
-- Zimmer = eigene Zeile mit Typ + privat/gemeinschaftlich, daran haengen
-- Schlafmoeglichkeiten, eigene Ausstattung und Fotos.
--
-- ABGRENZUNG ZUM AGGREGATOR: Channex nimmt davon nichts an — `beds`,
-- `bed_configuration`, `bedrooms`, `bathrooms` am Room-Type quittieren 200/201
-- und werden verworfen, `/bed_types` und `/room_type_content` gibt es nicht
-- (live gemessen, docs/CHANNEX-FELDER.md). Diese Daten sind daher lokal: eigene
-- Strecke und myBestDays. Nur die Zimmer-AUSSTATTUNG (P3) geht ueber
-- room_type.facilities hinaus zu den Portalen, und zwar als Vereinigungsmenge
-- ueber alle Zimmer — der Aggregator kennt nur EINEN Room-Type je Objekt.
--
-- Die Spalten fuer Betten, Ausstattung und en suite entstehen hier gleich mit,
-- statt in drei weiteren ALTER TABLEs: es ist dieselbe Entitaet, und eine
-- Tabelle, die dreimal nachtraeglich waechst, ist schwerer zu lesen als eine,
-- die einmal vollstaendig dasteht.

begin;

create table public.property_rooms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,

  -- Slug wie im Frontend (ZIMMER_SLUGS in web/lib/property-meta.ts). Bewusst
  -- text statt enum: die Liste waechst (Lodgify fuehrt u. a. "Schlafbereich"),
  -- und ein enum haette bei jedem neuen Raumtyp eine Migration erzwungen.
  raum_typ text not null,

  -- Lodgify fragt genau das ab: eigenes Bad oder Gemeinschaftsbad. In einer
  -- Anlage ist das der Unterschied, den ein Gast zuerst wissen will.
  privat boolean not null default true,

  -- Optionaler Eigenname ("Schlafzimmer Nord"). Leer = das Typ-Label zaehlt.
  name text,

  position integer not null default 0,

  -- P2: Schlafmoeglichkeiten dieses Zimmers als {slug: anzahl}, gleiche Form
  -- wie bisher type_attributes.beds (0242). Fachlich nur bei Schlafzimmer,
  -- Wohnzimmer und Schlafbereich sinnvoll — das erzwingt der Service mit einer
  -- klaren 422, nicht die DB: sonst waere die Typliste hier zementiert.
  betten jsonb not null default '{}'::jsonb,

  -- P3: Zimmer-Ausstattung (Channex /room_facilities-Slugs, getrennt vom
  -- Objekt-Katalog /property_facilities wie in 0243 begruendet).
  ausstattung text[] not null default '{}'::text[],

  -- P4: nur fuer Bad/WC. Die Kopplung zeigt auf ein Schlafzimmer DESSELBEN
  -- Objekts; das prueft der Service (die DB kann den Objektbezug ueber einen
  -- Selbstverweis nicht erzwingen, ohne einen Trigger zu erfinden).
  en_suite boolean not null default false,
  en_suite_schlafzimmer_id uuid references public.property_rooms(id)
    on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Eine Kopplung ohne en suite waere eine Aussage, die niemand getroffen hat.
  constraint property_rooms_kopplung_nur_mit_ensuite check (
    en_suite_schlafzimmer_id is null or en_suite
  ),
  -- Ein Zimmer, das an sich selbst grenzt, ist ein Datenfehler.
  constraint property_rooms_keine_selbstkopplung check (
    en_suite_schlafzimmer_id is null or en_suite_schlafzimmer_id <> id
  ),
  constraint property_rooms_betten_ist_objekt check (
    jsonb_typeof(betten) = 'object'
  )
);

comment on table public.property_rooms is
  'Zimmer eines Objekts als eigene Entitaet: Typ, privat/gemeinschaftlich, '
  'Betten, eigene Ausstattung, en-suite-Kopplung. Loest das Zaehlwerk in '
  'properties.type_attributes.rooms ab (0244).';
comment on column public.property_rooms.raum_typ is
  'Slug wie ZIMMER_SLUGS im Frontend (schlafzimmer, badezimmer, wc, ...).';
comment on column public.property_rooms.betten is
  'Schlafmoeglichkeiten {slug: anzahl}. Geht NICHT an Channex (Room-Type '
  'verwirft beds/bed_configuration) — lokal + myBestDays.';
comment on column public.property_rooms.ausstattung is
  'Zimmer-Ausstattung, Slugs aus dem Channex-Katalog /room_facilities.';

create index property_rooms_property_idx
  on public.property_rooms (property_id, position);
create index property_rooms_tenant_idx on public.property_rooms (tenant_id);
create index property_rooms_ensuite_idx
  on public.property_rooms (en_suite_schlafzimmer_id)
  where en_suite_schlafzimmer_id is not null;

-- === Datenuebernahme aus dem Zaehlwerk (Wurzel 1) ===========================
-- {"privat":{"schlafzimmer":2},"gemeinschaftlich":{"badezimmer":1}}
--   → 2 Zeilen schlafzimmer privat + 1 Zeile badezimmer gemeinschaftlich.
-- Das Altfeld bleibt vorerst stehen: der Lesepfad readZimmer faellt darauf
-- zurueck, solange die neue UI nicht ueberall ausgerollt ist. Aufgeraeumt wird
-- es in einer eigenen Migration, wenn nichts mehr darauf liest.
insert into public.property_rooms (tenant_id, property_id, raum_typ, privat, position)
select
  p.tenant_id,
  p.id,
  eintrag.slug,
  eintrag.privat,
  row_number() over (partition by p.id order by eintrag.privat desc, eintrag.slug)
from public.properties p
cross join lateral (
  select k.key as slug, true as privat, (k.value)::text::int as anzahl
  from jsonb_each(coalesce(p.type_attributes -> 'rooms' -> 'privat', '{}'::jsonb)) k
  where jsonb_typeof(k.value) = 'number'
  union all
  select k.key, false, (k.value)::text::int
  from jsonb_each(
    coalesce(p.type_attributes -> 'rooms' -> 'gemeinschaftlich', '{}'::jsonb)
  ) k
  where jsonb_typeof(k.value) = 'number'
) eintrag
cross join lateral generate_series(1, greatest(eintrag.anzahl, 0)) as stueck
where jsonb_typeof(p.type_attributes -> 'rooms') = 'object';

-- Altformat string[] (["Badezimmer","Kueche"]) → je 1 privates Zimmer. Dieselbe
-- Slug-Ableitung wie in 0244, damit nichts unter einem zweiten Namen landet.
insert into public.property_rooms (tenant_id, property_id, raum_typ, privat, position)
select
  p.tenant_id,
  p.id,
  case lower(btrim(raum.wert))
    when 'balkon'         then 'balkon'
    when 'badezimmer'     then 'badezimmer'
    when 'schlafzimmer'   then 'schlafzimmer'
    when 'esszimmer'      then 'esszimmer'
    when 'küche'          then 'kueche'
    when 'kueche'         then 'kueche'
    when 'wohnzimmer'     then 'wohnzimmer'
    when 'spielzimmer'    then 'spielzimmer'
    when 'terrasse'       then 'terrasse'
    when 'wc'             then 'wc'
    when 'arbeitszimmer'  then 'arbeitszimmer'
    else regexp_replace(lower(btrim(raum.wert)), '\s+', '_', 'g')
  end,
  true,
  row_number() over (partition by p.id order by raum.ord)
from public.properties p
cross join lateral jsonb_array_elements_text(p.type_attributes -> 'rooms')
  with ordinality as raum(wert, ord)
where jsonb_typeof(p.type_attributes -> 'rooms') = 'array'
  and btrim(raum.wert) <> '';

-- === Wurzel 6: RLS + Grants =================================================
alter table public.property_rooms enable row level security;

revoke all on public.property_rooms from anon, authenticated;

-- Lesen darf das eingeloggte Dashboard (RLS entscheidet, welche Zeilen).
-- Zimmerdaten sind operativ: auch Reinigungskraefte muessen wissen, wie viele
-- Baeder ein Objekt hat. Geschrieben wird ausschliesslich serverseitig ueber
-- die API (service_role) — deshalb KEIN insert/update/delete-Grant.
-- Ohne dieses select-Grant waere zudem jedes Realtime-Abo eine stumme Attrappe.
grant select on public.property_rooms to authenticated;

create policy property_rooms_tenant on public.property_rooms
  for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Restriktiv fuer ALLE Operationen, nicht nur select — sonst waere der
-- Schreibpfad tenant-weit offen (Wurzel 6).
create policy property_rooms_write_restrict on public.property_rooms
  as restrictive for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create trigger property_rooms_updated_at
  before update on public.property_rooms
  for each row execute function public.set_updated_at();

-- Realtime: ohne Publikations-Mitgliedschaft kommt trotz Grant kein Event.
alter publication supabase_realtime add table public.property_rooms;

commit;
