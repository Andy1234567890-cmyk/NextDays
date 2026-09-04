-- Feinraster der Marktbeobachtung: Preisniveau je Teilgebiet, fuer die Karte.
--
-- WARUM ZUSAETZLICH ZUM GROBRASTER
-- ================================
-- `markt_beobachtung` traegt EINEN Median je Zelle (~28 km) und Tag — genug
-- fuer den Preisfaktor, zu grob fuer eine Karte. Live gemessen am 04.09.2026
-- rund um Tversted: innerhalb einer einzigen Grobzelle reicht das Niveau von
-- 689 DKK im Binnenland bis 2.574 DKK an der Kueste. Ein Betrieb, der nur den
-- Gesamtmedian sieht, verkauft Kuestenlage zum Binnenlandpreis.
--
-- Es bleibt bei Aggregaten: je Teilgebiet ein Median ueber mindestens fuenf
-- Objekte, nie ein Einzelinserat und nie ein fremder Name.

create table if not exists public.markt_beobachtung_zelle (
  id            uuid primary key default gen_random_uuid(),
  -- Grobzelle, zu der dieses Teilgebiet gehoert (Verbindung zum Preisfaktor).
  zelle_lat     numeric(9,5) not null,
  zelle_lng     numeric(9,5) not null,
  -- Teilgebiet: auf _FEIN_GRAD gerundete Mitte (~5,5 km).
  fein_lat      numeric(9,5) not null,
  fein_lng      numeric(9,5) not null,
  tag           date not null,
  objekt_art    text not null default 'entire_home',
  median_preis  numeric(12,2) not null,
  waehrung      text not null,
  anzahl        integer not null,
  abgerufen_am  timestamptz not null default now(),
  quelle        text not null,
  constraint markt_zelle_anzahl_positiv check (anzahl > 0),
  constraint markt_zelle_preis_positiv check (median_preis > 0)
);

create unique index if not exists markt_beobachtung_zelle_eindeutig
  on public.markt_beobachtung_zelle
     (fein_lat, fein_lng, tag, objekt_art, quelle);

-- Die Karte fragt immer nach Grobzelle + Tag.
create index if not exists markt_beobachtung_zelle_gebiet
  on public.markt_beobachtung_zelle (zelle_lat, zelle_lng, tag);

alter table public.markt_beobachtung_zelle enable row level security;

drop policy if exists markt_beobachtung_zelle_lesen on public.markt_beobachtung_zelle;
create policy markt_beobachtung_zelle_lesen
  on public.markt_beobachtung_zelle for select
  to authenticated
  using (true);

revoke insert, update, delete on public.markt_beobachtung_zelle from anon, authenticated;
revoke all on public.markt_beobachtung_zelle from anon;

comment on table public.markt_beobachtung_zelle is
  'Feinraster (~5,5 km) der Marktbeobachtung fuer die Karte. Nur Mediane ueber '
  'mehrere Objekte, nie Einzelinserate oder Fremdnamen. Schreibt nur der Server.';
