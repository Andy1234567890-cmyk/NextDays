-- Fotos einem Zimmer zuordnen (Folge von 0246).
--
-- WARUM: Ein Gast entscheidet an den Bildern, und "welches Bad ist das?" ist die
-- haeufigste stumme Frage einer Galerie. Lodgify loest das ueber einen Reiter
-- "nach Zimmern" im Fotobereich (Help-Center 21285360759324): jedes Foto haengt
-- an genau EINEM Zimmer, dasselbe Motiv darf fuer ein zweites Zimmer erneut
-- hochgeladen werden.
--
-- Genau ein Zimmer, nicht mehrere: eine n:m-Zuordnung waere technisch moeglich,
-- aber sie beantwortet die Frage nicht mehr eindeutig — ein Foto, das zu drei
-- Zimmern gehoert, gehoert zu keinem.
--
-- An die Portale geht das nicht: der Aggregator kennt je Objekt einen Room-Type
-- und nimmt die Zimmerstruktur ohnehin nicht an (docs/CHANNEX-FELDER.md). Die
-- Galerie-Reihenfolge (Cover zuerst) bleibt davon voellig unberuehrt.

alter table public.property_photos
  add column if not exists room_id uuid
    references public.property_rooms(id) on delete set null;

comment on column public.property_photos.room_id is
  'Zimmer, zu dem dieses Foto gehoert (property_rooms, 0246). NULL = keinem '
  'Zimmer zugeordnet. Wird das Zimmer geloescht, bleibt das Foto in der '
  'Galerie und verliert nur die Zuordnung.';

create index if not exists property_photos_room_idx
  on public.property_photos (room_id) where room_id is not null;

-- Wurzel 6: property_photos traegt kein pauschales Tabellen-GRANT mehr, sondern
-- spaltenweise. Eine neue Spalte erbt das NICHT — ohne dieses Grant waere die
-- Zuordnung fuer das Dashboard unlesbar und das Realtime-Abo eine stumme
-- Attrappe. Nur SELECT und nur authenticated: geschrieben wird ausschliesslich
-- serverseitig ueber die API (service_role).
do $$
begin
  if exists (
    select 1 from information_schema.role_column_grants
    where table_schema = 'public' and table_name = 'property_photos'
      and grantee = 'authenticated' and privilege_type = 'SELECT'
  ) then
    grant select (room_id) on public.property_photos to authenticated;
  end if;
end $$;
