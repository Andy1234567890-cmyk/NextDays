-- „Wo ich wohne" strukturiert (host_profiles). Bisher lag der Wohnort nur als
-- Freitext in lives_in („Stadt, Land"). Für eine echte Adresse (Places-Auswahl)
-- werden die Bestandteile getrennt gespeichert — analog zu properties
-- (street/house_number/postal_code/city/country/lat/lng), damit nichts aus
-- einem String zurückgeparst werden muss (kein Regex-Raten, Wurzel 4).
--
-- lives_in BLEIBT als Anzeigetext („Stadt, Land") erhalten: das ist der Wert,
-- der im Profil öffentlich gezeigt wird. Airbnb zeigt beim Gastgeber-Wohnort
-- bewusst nur Stadt-Ebene — die genauen Bestandteile (Straße/Hausnummer/lat/lng)
-- sind interne Daten des Kontos, KEINE Profilanzeige.
--
-- Die Tabelle ist bereits Wurzel-6-gehärtet (0199): RLS an, keine Grants an
-- anon/authenticated, restriktive self-Policy. Neue Spalten erben das — es sind
-- keine zusätzlichen Grants/Policies nötig (der Schutz sitzt auf Tabellenebene).

alter table public.host_profiles
    add column if not exists lives_in_street text,
    add column if not exists lives_in_house_number text,
    add column if not exists lives_in_postal_code text,
    add column if not exists lives_in_city text,
    -- Länder-Code ISO-3166-1 alpha-2 (wie properties.country).
    add column if not exists lives_in_country text,
    add column if not exists lives_in_lat double precision,
    add column if not exists lives_in_lng double precision;

comment on column public.host_profiles.lives_in is
    'Anzeigetext des Wohnorts („Stadt, Land") — das im Profil sichtbare Feld. '
    'Die strukturierten Bestandteile liegen in lives_in_*.';
comment on column public.host_profiles.lives_in_street is
    'Strukturierter Wohnort aus der Places-Auswahl. NICHT öffentlich im Profil.';
comment on column public.host_profiles.lives_in_lat is
    'Koordinate des Wohnorts aus der Places-Auswahl. NICHT öffentlich im Profil.';

-- Plausibilitäts-Grenzen für die Koordinaten (kein Fantasiewert).
do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'host_profiles_lives_in_latlng_range'
    ) then
        alter table public.host_profiles
            add constraint host_profiles_lives_in_latlng_range check (
                (lives_in_lat is null or lives_in_lat between -90 and 90)
                and (lives_in_lng is null or lives_in_lng between -180 and 180)
            );
    end if;
end $$;
