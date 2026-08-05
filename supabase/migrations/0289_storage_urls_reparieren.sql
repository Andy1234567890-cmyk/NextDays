-- 0289 — gespeicherte Storage-URLs von der INTERNEN auf die öffentliche Basis
-- umschreiben.
--
-- Ursache: Die Upload-Pfade bauten ihre URL über den Supabase-Storage-Client
-- (`get_public_url`). Der kennt nur SUPABASE_URL, und das ist im Container die
-- INTERNE Kong-Adresse (`http://kong:8000`). Diese URL landete in der DB und ist
-- im Browser unerreichbar — das Firmenlogo auf /konto war ein kaputtes Bild und
-- ging als toter Link an die Portale (Channex). Der Schreibpfad nutzt jetzt
-- `core.supabase.public_storage_url` (Basis = SUPABASE_PUBLIC_URL/
-- API_EXTERNAL_URL, ohne Rückfall auf die interne Adresse).
--
-- Diese Migration korrigiert die Altbestände. Die öffentliche Basis wird NICHT
-- hardcodet, sondern aus einer bereits korrekten Storage-URL derselben Datenbank
-- abgeleitet — so passt sie in jeder Umgebung. Lässt sie sich nicht ableiten,
-- obwohl kaputte URLs existieren, bricht die Migration ab (kein stiller
-- Nicht-Fix).
do $$
declare
  ziel record;
  kaputt bigint;
  basis text;
  gesamt bigint := 0;
begin
  -- Gibt es überhaupt betroffene Zeilen? Nur real vorhandene Spalten prüfen —
  -- die Storage-URL-Spalten unterscheiden sich je Umgebungsstand.
  for ziel in
    select table_name, column_name
      from information_schema.columns
     where table_schema = 'public'
       and data_type = 'text'
       and (table_name, column_name) in (
             ('tenant_billing_profile', 'company_logo_url'),
             ('host_profiles', 'avatar_url'),
             ('property_photos', 'url'),
             ('property_feature_media', 'url')
           )
  loop
    execute format(
      'select count(*) from public.%I where %I like %L',
      ziel.table_name, ziel.column_name, 'http://kong:8000/%'
    ) into kaputt;
    gesamt := gesamt + kaputt;
  end loop;

  if gesamt = 0 then
    raise notice '0289: keine intern gebauten Storage-URLs vorhanden';
    return;
  end if;

  -- Öffentliche Basis aus einer korrekten Storage-URL derselben DB ableiten.
  select regexp_replace(url, '/storage/v1/object/public/.*$', '')
    into basis
    from public.property_photos
   where url like 'https://%/storage/v1/object/public/%'
   limit 1;

  if basis is null then
    raise exception
      '0289: % Zeile(n) tragen eine interne Storage-URL, aber die öffentliche '
      'Basis ist aus den Daten nicht ableitbar — bitte manuell setzen.', gesamt;
  end if;

  for ziel in
    select table_name, column_name
      from information_schema.columns
     where table_schema = 'public'
       and data_type = 'text'
       and (table_name, column_name) in (
             ('tenant_billing_profile', 'company_logo_url'),
             ('host_profiles', 'avatar_url'),
             ('property_photos', 'url'),
             ('property_feature_media', 'url')
           )
  loop
    execute format(
      'update public.%I set %I = replace(%I, %L, %L) where %I like %L',
      ziel.table_name, ziel.column_name, ziel.column_name,
      'http://kong:8000', basis, ziel.column_name, 'http://kong:8000/%'
    );
  end loop;

  raise notice '0289: % Storage-URL(s) auf % umgeschrieben', gesamt, basis;
end $$;
