-- 0073: Ein Objekt gehört genau EINEM Eigentümer.
--
-- Fachregel: Ist ein Objekt über die Stammdaten an einen Owner gebunden, darf es
-- keinem zweiten/dritten Owner zugeordnet werden. Bisher erlaubte nur
-- `unique (owner_id, property_id)` (Migration 0063) je Owner einen Eintrag pro
-- Objekt — dasselbe Objekt konnte aber bei mehreren Ownern liegen.
--
-- Mit `unique (property_id)` ist jedes Objekt höchstens in einem owner_properties-
-- Link. Das Backend (owners/service.assign_property) weist eine Zuordnung an einen
-- anderen Owner zudem mit 409 ab, bevor die DB anschlägt.
--
-- Voraussetzung: keine bestehenden Mehrfachzuordnungen mehr (vorher bereinigt).
-- Bricht mit klarer Meldung ab, falls noch ein Objekt mehreren Ownern gehört —
-- statt eines kryptischen Constraint-Fehlers (kein stilles Löschen von Daten).
do $$
declare
    v_count integer;
begin
    select count(*) into v_count from (
        select property_id
        from public.owner_properties
        group by property_id
        having count(*) > 1
    ) dup;
    if v_count > 0 then
        raise exception
            'Migration 0073: % Objekt(e) sind mehreren Eigentuemern zugeordnet. '
            'Erst bereinigen (je Objekt genau einen Owner behalten), dann erneut '
            'anwenden.', v_count;
    end if;
end $$;

alter table public.owner_properties
    add constraint owner_properties_property_id_key unique (property_id);

comment on constraint owner_properties_property_id_key on public.owner_properties is
    '0073: Ein Objekt gehört genau einem Eigentümer (keine Mehrfachzuordnung).';
