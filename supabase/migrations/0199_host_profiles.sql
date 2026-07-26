-- Gastgeber-Profil (Airbnb „Über den Gastgeber" / „About the host").
--
-- EINE Zeile pro Nutzer mit den optionalen Profil-Angaben, die Airbnb im
-- Listing-Editor unter „Über den Gastgeber" abfragt. Diese Daten gehören zum
-- USER (nicht zum Objekt) — Airbnb zeigt dasselbe Host-Profil objektübergreifend,
-- im Editor nur eingebettet. Name („full_name") und „Hosting begann {Jahr}"
-- werden NICHT hier gehalten, sondern aus public.users abgeleitet (full_name,
-- created_at) — kein Doppelwert (Wurzel 4).
--
-- Fehlt die Zeile, gilt ein leeres Profil (alle Felder null/[]); ein Update legt
-- sie lazy per Upsert an (idempotent, Wurzel 2). Die Toggles (Jahrzehnt-Sicht,
-- Reisestempel-Sicht) sind reine Sichtbarkeits-Schalter mit Airbnb-Default AUS.
--
-- Feld-Herkunft (1:1 aus dem Airbnb-Editor-UI):
--   intro              „Schreib etwas Witziges und Schlagfertiges" (Bio-Intro)
--   work               „Was machst du beruflich? / Meine Arbeit"
--   dream_destination  „Wohin ich schon immer mal wollte"
--   spend_time_on      „Ich verbringe zu viel Zeit"
--   pets               „Haustiere"
--   decade_born        „Jahrzehnt, in dem ich geboren wurde" (Jahrzehnt, z. B. 1980)
--   show_decade        Toggle „Zeige das Jahrzehnt …" (Default AUS)
--   school             „Wo ich zur Schule ging"
--   useless_skill      „Meine nutzloseste Fähigkeit"
--   favorite_song      „Mein Lieblingslied aus der High School"
--   fun_fact           „Meine lustige Tatsache"
--   languages          „Sprachen, die ich spreche" (ISO-Sprach-Codes)
--   obsessed_with      „Ich bin besessen von"
--   bio_title          „Mein Biografietitel wäre"
--   lives_in           „Wo ich wohne" (Freitext-Stadt)
--   show_travel_stamps Toggle „Wo ich gewesen bin" (Reisestempel, Default AUS)
--   interests          „Meine Interessen / Worauf stehst du?" (Interessen-Slugs)
--   avatar_url         Profilfoto (Storage-URL)
--
-- Sensibel (nutzergebunden, PII-nah) → Wurzel 6: RLS + harter GRANT-Entzug. Nur
-- service_role (der Server über den FastAPI-Slice) schreibt/liest; ein
-- eingeloggter Client käme per anon-Key-curl NICHT an fremde Profile.

create table if not exists public.host_profiles (
    user_id uuid primary key references auth.users (id) on delete cascade,

    avatar_url text,
    intro text,
    work text,
    dream_destination text,
    spend_time_on text,
    pets text,

    -- Jahrzehnt als vierstelliges Startjahr (z. B. 1980 = „80er"). NULL = nicht
    -- angegeben. show_decade steuert nur die Sichtbarkeit im Profil (Airbnb-
    -- Toggle), nicht den Wert.
    decade_born integer,
    show_decade boolean not null default false,

    school text,
    useless_skill text,
    favorite_song text,
    fun_fact text,

    -- Gesprochene Sprachen als ISO-639-Codes (z. B. {"de","en"}). Leer = keine.
    languages text[] not null default '{}',

    obsessed_with text,
    bio_title text,
    lives_in text,

    -- Reisestempel-Sichtbarkeit (Airbnb „Wo ich gewesen bin"). Die Stempel selbst
    -- sind ein separates, hier NICHT modelliertes Feature — nur der Sicht-Toggle.
    show_travel_stamps boolean not null default false,

    -- Interessen als Slug-Liste (Katalog im Frontend, Airbnb „Worauf stehst du?").
    interests text[] not null default '{}',

    updated_at timestamptz not null default now(),

    -- Plausibilitäts-Grenze fürs Jahrzehnt (kein Fantasiewert): 1900–2020er.
    constraint host_profiles_decade_range
        check (decade_born is null or (decade_born between 1900 and 2020))
);

comment on table public.host_profiles is
    'Gastgeber-Profil pro Nutzer (Airbnb „Über den Gastgeber"). Name + '
    '"Hosting begann" kommen aus public.users (nicht hier). Fehlende Zeile = '
    'leeres Profil. Vom Server (service_role) über den host_profiles-Slice '
    'geschrieben.';

-- --- Härtung (Wurzel 6): RLS + harter GRANT-Entzug --------------------------
alter table public.host_profiles enable row level security;

-- Kein pauschales Grant an anon/authenticated — nur der Server (service_role)
-- greift zu. Falls Default-Privilegien etwas gesetzt haben: entziehen.
revoke all on public.host_profiles from anon, authenticated;

-- Restriktive Guard für ALLE Operationen: streng per-User. Selbst wenn je ein
-- Grant hinzukäme, sähe/änderte ein Client nur die EIGENE Zeile.
create policy host_profiles_self_restrict on public.host_profiles
    as restrictive for all
    using (user_id = auth.uid())
    with check (user_id = auth.uid());
