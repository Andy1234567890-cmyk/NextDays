-- 0198 — Objekt-Taxonomie (Kategorie → Immobilientyp → Angebotsart), Airbnb∪Booking.
-- Bildet die Airbnb-„Property type"-UI ab: drei abhängige Dropdowns. Werte-Vorlage:
-- docs/OBJEKTTYP-LISTEN.md (vom Nutzer bestätigt, Vereinigung Airbnb+Booking).
--
-- Normalisiert für die spätere Open-API (Booking/Airbnb-Direktanbindung): jede
-- externe Mapping-Spalte (channex/booking_pct) ist eine DATENZEILE, nicht Code.
-- Rückwärtskompatibel: properties.property_type (Legacy-Enum) BLEIBT (Channex-
-- Fallback/Bestand); zusätzlich category_slug + subtype_slug + listing_type +
-- total_rooms. Etagen/Baujahr/Fläche existieren schon (0197).
-- Hinweis: kein eigenes begin/commit — apply-migrations.sh wrappt in eine Transaktion.

-- ── Angebotsart (Airbnb „Listing type") ───────────────────────────────────────
create type public.listing_type as enum (
  'entire_place',  -- Der gesamte Ort
  'private_room',  -- Zimmer
  'shared_room'    -- Geteiltes Zimmer
);

-- ── Kategorie (Ebene 1) ───────────────────────────────────────────────────────
create table if not exists public.property_categories (
  slug        text primary key,
  label_de    text not null,
  sort_order  smallint not null default 0
);

insert into public.property_categories (slug, label_de, sort_order) values
  ('wohnung',        'Wohnung',                 1),
  ('haus',           'Haus',                    2),
  ('sekundaer',      'Sekundäreinheit',         3),
  ('einzigartig',    'Einzigartiger Raum',      4),
  ('bnb',            'Übernachtung mit Frühstück', 5),
  ('hotel_betrieb',  'Hotel & Betriebe',        6)
on conflict (slug) do nothing;

-- ── Immobilientyp (Ebene 2) mit Kategorie + erlaubten Angebotsarten + Mappings ─
-- channex_property_type: EINER der 22 gültigen Channex-Codes (oder NULL). booking_pct:
-- Booking-PCT-Integer. listing_types: welche Angebotsarten dieser Typ erlaubt.
create table if not exists public.property_subtypes (
  slug                   text primary key,
  label_de               text not null,
  category_slug          text not null references public.property_categories(slug),
  listing_types          public.listing_type[] not null default '{}',
  channex_property_type  text,
  booking_pct            integer,
  sort_order             smallint not null default 0
);

-- Seed (docs/OBJEKTTYP-LISTEN.md). ALLE=entire+private+shared, GANZ=nur entire,
-- ZIMMER=private+shared, HOTEL=entire+private+shared.
insert into public.property_subtypes
  (slug, label_de, category_slug, listing_types, channex_property_type, booking_pct, sort_order) values
  -- Wohnung
  ('mietwohnung',      'Mietwohnung',        'wohnung', '{entire_place,private_room,shared_room}', 'apartment',    3,    10),
  ('eigentumswohnung', 'Eigentumswohnung',   'wohnung', '{entire_place,private_room,shared_room}', 'apartment',    3,    20),
  ('loft',             'Loft',               'wohnung', '{entire_place,private_room,shared_room}', 'apartment',    3,    30),
  ('serviced_apartment','Serviced Apartment','wohnung', '{entire_place}',                          'apart_hotel',  5000, 40),
  ('casa_particular',  'Casa particular',    'wohnung', '{entire_place,private_room}',             'homestay',     5004, 50),
  ('ferienwohnung',    'Ferienwohnung',      'wohnung', '{entire_place}',                          'apartment',    3,    60),
  -- Haus
  ('heim',             'Heim',               'haus',    '{entire_place,private_room,shared_room}', 'holiday_home', 5006, 70),
  ('reihenhaus',       'Reihenhaus',         'haus',    '{entire_place,private_room,shared_room}', 'holiday_home', 5006, 80),
  ('bungalow',         'Bungalow',           'haus',    '{entire_place,private_room}',             'holiday_home', 5006, 90),
  ('kabine',           'Kabine',             'haus',    '{entire_place,private_room}',             'chalet',       7,    100),
  ('chalet',           'Chalet',             'haus',    '{entire_place,private_room}',             'chalet',       7,    110),
  ('lehmhaus',         'Lehmhaus',           'haus',    '{entire_place,private_room}',             'holiday_home', 5006, 120),
  ('huette',           'Hütte',              'haus',    '{entire_place,private_room,shared_room}', 'chalet',       7,    130),
  ('leuchtturm',       'Leuchtturm',         'haus',    '{entire_place,private_room}',             'country_house',5007, 140),
  ('villa',            'Villa',              'haus',    '{entire_place,private_room}',             'villa',        35,   150),
  ('kuppel',           'Kuppel',             'haus',    '{entire_place,private_room}',             'holiday_home', 5006, 160),
  ('cottage',          'Cottage',            'haus',    '{entire_place,private_room}',             'holiday_home', 5006, 170),
  ('bauernhof_haus',   'Bauernhofurlaub',    'haus',    '{entire_place,private_room,shared_room}', 'farm_stay',    15,   180),
  ('hausboot',         'Hausboot',           'haus',    '{entire_place,private_room}',             'boat',         12,   190),
  ('minihaus',         'Minihaus',           'haus',    '{entire_place,private_room}',             'chalet',       5006, 200),
  ('landhaus',         'Landhaus',           'haus',    '{entire_place,private_room}',             'country_house',5007, 210),
  ('ferienpark',       'Ferienpark',         'haus',    '{entire_place}',                          'holiday_park', 5009, 220),
  -- Sekundäreinheit
  ('gaestehaus',       'Gästehaus',          'sekundaer','{entire_place,private_room}',            'guest_house',  40,   230),
  ('gaeste_suite',     'Gäste-Suite',        'sekundaer','{entire_place,private_room}',            'apartment',    3,    240),
  -- Einzigartiger Raum
  ('boot',             'Boot',               'einzigartig','{entire_place,private_room}',          'boat',         12,   250),
  ('schloss',          'Schloss',            'einzigartig','{entire_place,private_room}',          'country_house',5007, 260),
  ('hoehle',           'Höhle',              'einzigartig','{entire_place,private_room}',          'holiday_home', 5006, 270),
  ('erdhaus',          'Erdhaus',            'einzigartig','{entire_place,private_room}',          'holiday_home', 5006, 280),
  ('huette_einz',      'Hütte',              'einzigartig','{entire_place,private_room}',          'chalet',       7,    290),
  ('iglu',             'Iglu',               'einzigartig','{entire_place,private_room}',          'tent',         33,   300),
  ('insel',            'Insel',              'einzigartig','{entire_place}',                       'holiday_home', 5006, 310),
  ('leuchtturm_einz',  'Leuchtturm',         'einzigartig','{entire_place,private_room}',          'country_house',5007, 320),
  ('flugzeug',         'Flugzeug',           'einzigartig','{entire_place,private_room}',          'holiday_home', 5006, 330),
  ('wohnmobil',        'Wohnmobil / Camper', 'einzigartig','{entire_place,private_room}',          'camping',      6,    340),
  ('zelt',             'Zelt',               'einzigartig','{entire_place,private_room,shared_room}','tent',       33,   350),
  ('tipi',             'Tipi',               'einzigartig','{entire_place,private_room}',          'tent',         33,   360),
  ('zug',              'Zug',                'einzigartig','{entire_place,private_room}',          'holiday_home', 5006, 370),
  ('baumhaus',         'Baumhaus',           'einzigartig','{entire_place,private_room}',          'holiday_home', 5006, 380),
  ('jurte',            'Jurte',              'einzigartig','{entire_place,private_room}',          'tent',         33,   390),
  ('kuppel_einz',      'Kuppel',             'einzigartig','{entire_place,private_room}',          'holiday_home', 5006, 400),
  ('scheune',          'Scheune',            'einzigartig','{entire_place,private_room}',          'holiday_home', 5006, 410),
  ('campingplatz',     'Campingplatz / Stellplatz','einzigartig','{entire_place,private_room,shared_room}','camping',6,420),
  ('windmuehle',       'Windmühle',          'einzigartig','{entire_place,private_room}',          'country_house',5007, 430),
  ('sonstiges',        'Sonstiges',          'einzigartig','{entire_place,private_room,shared_room}','holiday_home',5006,440),
  -- Übernachtung mit Frühstück
  ('bnb_typ',          'Bed & Breakfast',    'bnb',     '{private_room,shared_room}',              'guest_house',  4,    450),
  ('naturlodge',       'Naturlodge',         'bnb',     '{private_room,shared_room}',              'lodge',        22,   460),
  ('bauernhof_bnb',    'Bauernhofurlaub',    'bnb',     '{entire_place,private_room,shared_room}', 'farm_stay',    15,   470),
  -- Hotel & Betriebe (Angebotsart: Zimmer + geteilt + ganzer Ort für Apart-Formen)
  ('hotel',            'Hotel',              'hotel_betrieb','{private_room,shared_room}',         'hotel',        20,   480),
  ('hotel_garni',      'Hotel garni',        'hotel_betrieb','{private_room,shared_room}',         'hotel',        20,   490),
  ('boutique_hotel',   'Boutique-Hotel',     'hotel_betrieb','{private_room,shared_room}',         'hotel',        20,   500),
  ('aparthotel',       'Aparthotel',         'hotel_betrieb','{entire_place,private_room}',        'apart_hotel',  5000, 510),
  ('hostel',           'Hostel',             'hotel_betrieb','{private_room,shared_room}',         'hostel',       19,   520),
  ('pension',          'Pension / Gästehaus','hotel_betrieb','{private_room,shared_room}',         'guest_house',  40,   530),
  ('gasthof',          'Gasthof',            'hotel_betrieb','{private_room,shared_room}',         'inn',          21,   540),
  ('motel',            'Motel',              'hotel_betrieb','{private_room,shared_room}',         'motel',        27,   550),
  ('resort',           'Resort',             'hotel_betrieb','{private_room,shared_room}',         'resort',       30,   560),
  ('nature_lodge',     'Nature lodge',       'hotel_betrieb','{private_room,shared_room}',         'lodge',        22,   570),
  ('riad',             'Riad',               'hotel_betrieb','{private_room,shared_room}',         'riad',         5001, 580),
  ('ryokan',           'Ryokan',             'hotel_betrieb','{private_room,shared_room}',         'ryokan',       5002, 590)
on conflict (slug) do nothing;

-- ── properties: Taxonomie-Spalten ─────────────────────────────────────────────
alter table public.properties
  add column if not exists category_slug text references public.property_categories(slug),
  add column if not exists subtype_slug  text references public.property_subtypes(slug),
  add column if not exists listing_type  public.listing_type,
  add column if not exists total_rooms   text;  -- Hotel-Betriebe: „2-5" … „50+"

-- Bestand grob migrieren (Legacy property_type → passender Subtyp).
update public.properties p set subtype_slug = m.slug, category_slug = m.cat
from (values
  ('ferienhaus','heim','haus'),
  ('appartement','mietwohnung','wohnung'),
  ('glamping','zelt','einzigartig'),
  ('tiny_house','minihaus','haus'),
  ('stellplatz','campingplatz','einzigartig'),
  ('hausboot','hausboot','haus'),
  ('einzelzimmer','hotel','hotel_betrieb'),
  ('doppelzimmer','hotel','hotel_betrieb'),
  ('zweibettzimmer','hotel','hotel_betrieb'),
  ('familienzimmer','hotel','hotel_betrieb'),
  ('junior_suite','hotel','hotel_betrieb'),
  ('suite','hotel','hotel_betrieb')
) as m(legacy, slug, cat)
where p.property_type::text = m.legacy and p.subtype_slug is null;

-- Angebotsart-Default: ganze Einheiten = entire_place, Hotel-Betriebe = private_room.
update public.properties p set listing_type = case
    when s.category_slug = 'hotel_betrieb' then 'private_room'::public.listing_type
    else 'entire_place'::public.listing_type
  end
from public.property_subtypes s
where p.subtype_slug = s.slug and p.listing_type is null;

-- ── RLS / Grants (öffentlicher Referenzkatalog: nur lesen, NIE schreiben) ──────
alter table public.property_categories enable row level security;
alter table public.property_subtypes  enable row level security;

drop policy if exists categories_read on public.property_categories;
create policy categories_read on public.property_categories for select using (true);
drop policy if exists subtypes_read on public.property_subtypes;
create policy subtypes_read on public.property_subtypes for select using (true);

-- Erst ALLE Rechte entziehen (Supabase gewährt beim CREATE TABLE pauschal auch
-- TRUNCATE — RLS greift dafür NICHT!), dann nur SELECT gezielt gewähren.
revoke all on public.property_categories from anon, authenticated;
revoke all on public.property_subtypes  from anon, authenticated;
grant select on public.property_categories to anon, authenticated;
grant select on public.property_subtypes  to anon, authenticated;
