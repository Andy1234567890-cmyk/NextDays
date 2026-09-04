-- Marktpunkte: jedes beobachtete Objekt der Region als Preis auf der Karte.
--
-- WARUM ZUSAETZLICH ZU DEN RASTERTABELLEN
-- =======================================
-- Das Feinraster (0557) fasst Objekte zu Teilgebieten zusammen und zeigt nur
-- Gruppen ab fuenf Objekten. In duenn besiedelten Ferienregionen faellt damit
-- fast alles weg: live gemessen am 04.09.2026 verteilten sich 15 Objekte auf
-- fuenf Teilgebiete mit 4/3/3/3/2 Haeusern — kein einziges erreichte die
-- Schwelle, die Karte blieb leer. Fuer die KARTE ist das der falsche Zuschnitt.
--
-- Hier steht deshalb jeder beobachtete Preis als eigener Punkt. Der MEDIAN fuer
-- den Preisfaktor kommt weiterhin aus `markt_beobachtung` (0556) — diese
-- Tabelle speist die Anzeige, nicht die Preisberechnung.
--
-- WAS NICHT DRINSTEHT
-- ===================
-- Kein Objektname, keine Objekt-ID, kein Link, kein Gastgeber. Nur Ort und
-- Preis. Ein Punkt auf der Karte ist damit "hier kostet eine Nacht X", nicht
-- "das ist das Haus von Y". Die Entscheidung vom 04.09.2026 (aggregiert statt
-- benannt) bleibt gewahrt: aus diesen Zeilen laesst sich keine
-- Wettbewerberliste rekonstruieren.

create table if not exists public.markt_punkt (
  id            uuid primary key default gen_random_uuid(),
  -- Grobzelle, zu der der Punkt gehoert (Verbindung zum Preisfaktor).
  zelle_lat     numeric(9,5) not null,
  zelle_lng     numeric(9,5) not null,
  tag           date not null,
  objekt_art    text not null default 'entire_home',
  -- Ort des Angebots, auf ~100 m gerundet: genau genug fuer die Karte, zu grob,
  -- um eine Adresse daraus zu machen.
  lat           numeric(8,3) not null,
  lng           numeric(8,3) not null,
  preis         numeric(12,2) not null,
  waehrung      text not null,
  abgerufen_am  timestamptz not null default now(),
  quelle        text not null,
  constraint markt_punkt_preis_positiv check (preis > 0)
);

-- Die Karte fragt immer nach Grobzelle + Tag.
create index if not exists markt_punkt_gebiet
  on public.markt_punkt (zelle_lat, zelle_lng, tag);

-- Ein Ort kann mehrere Angebote tragen (Mehrfamilienhaus, benachbarte Huetten),
-- deshalb KEIN unique auf (lat,lng,tag). Der Lauf raeumt seinen Tag stattdessen
-- vor dem Schreiben ab — siehe `beobachtung_service._punkte_schreiben`.

alter table public.markt_punkt enable row level security;

drop policy if exists markt_punkt_lesen on public.markt_punkt;
create policy markt_punkt_lesen
  on public.markt_punkt for select
  to authenticated
  using (true);

revoke insert, update, delete on public.markt_punkt from anon, authenticated;
revoke all on public.markt_punkt from anon;

comment on table public.markt_punkt is
  'Einzelne beobachtete Angebotspreise der Region fuer die Karte — nur Ort und '
  'Preis, nie Name oder ID. Schreibt nur der Server.';
