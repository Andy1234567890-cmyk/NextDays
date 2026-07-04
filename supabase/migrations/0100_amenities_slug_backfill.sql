-- 0100_amenities_slug_backfill.sql — Ausstattung: alte deutsche Labels → Slugs
--
-- Die Ausstattung ist jetzt der Channex-Facility-Katalog (301, slug-basiert), der
-- an Channex/die OTAs gepusht wird (property.facilities). Bestandsdaten trugen
-- freie deutsche Labels ("WLAN", "Pool", …) — die auf die passenden Channex-Slugs
-- umstellen, damit sie gemappt werden. Nicht mappbare Labels (TV, Balkon,
-- Waschmaschine, Trockner, Einzel-Küchengeräte) BLEIBEN als Rohwert erhalten
-- (kein Datenverlust; sie gehen nur nicht an Channex — unbekannt → weggelassen).
--
-- Idempotent: nur alte deutsche Labels werden ersetzt; bereits migrierte Slugs
-- bleiben unangetastet. `updated_at` wird NICHT angefasst (keine Realtime-Flut).

update public.properties
set amenities = (
    select array_agg(
        case a
            when 'WLAN'              then 'wifi'
            when 'Klimaanlage'       then 'air_conditioning'
            when 'Heizung'           then 'heating'
            when 'Pool'              then 'swimming_pool'
            when 'Terrasse'          then 'terrace'
            when 'Garten'            then 'garden'
            when 'Grill'             then 'bbq_picnic_area'
            when 'Parkplatz'         then 'street_parking'
            when 'Aufzug'            then 'elevators'
            when 'Nichtraucher'      then 'non_smoking_rooms'
            when 'Haustiere erlaubt' then 'pets_allowed'
            else a  -- nicht mappbar → Rohwert behalten (geht nicht an Channex)
        end
    )
    from unnest(amenities) as a
)
where amenities && array[
    'WLAN','Klimaanlage','Heizung','Pool','Terrasse','Garten','Grill',
    'Parkplatz','Aufzug','Nichtraucher','Haustiere erlaubt'
]::text[];
