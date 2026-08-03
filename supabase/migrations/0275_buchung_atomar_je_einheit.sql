-- 0275_buchung_atomar_je_einheit.sql — atomare Buchung schreibt je EINHEIT
--
-- BEFUND (live gemessen 03.08.2026): seit 0267 wirft JEDE Buchung über
-- `create_reservation_atomic` den Fehler
--   42P10 „there is no unique or exclusion constraint matching the ON CONFLICT
--   specification".
-- Die Funktion stammt aus 0156 und schreibt `availability` weiterhin mit
-- `on conflict (property_id, date)`. 0266 hat die Einheiten-Dimension ergänzt,
-- 0267 die alte Bedingung planmäßig entfernt — beides hat den PYTHON-Code
-- mitgezogen (`core/einheiten.py: AVAILABILITY_CONFLICT`), die SQL-Funktion
-- aber nicht. Genau das ist Wurzel 1: der Gegenzustand einer Änderung muss
-- mitgepflegt werden, und eine Funktion im Datenbank-Schema ist einer.
--
-- Zweiter, gleich schwerer Fehler derselben Ursache: der Insert füllt `unit_id`
-- nicht, die Spalte ist seit 0266 `not null`. Selbst mit passendem
-- Konfliktziel schlüge er fehl.
--
-- WAS DIE FUNKTION JETZT TUT: sie wählt die Einheit, die gebucht wird — das ist
-- der atomare Ort dafür, denn nur unter dem Advisory-Lock ist „diese Einheit
-- ist im ganzen Zeitraum frei" eine haltbare Aussage. Trägt die Reservierung
-- bereits eine `unit_id` (Umbuchung auf eine bestimmte Einheit), gilt sie und
-- wird geprüft; sonst gewinnt die erste freie nach `position`. Ist keine frei,
-- ist der Zeitraum belegt (RS409) — dieselbe Meldung wie bisher, nur jetzt
-- korrekt je Einheit statt je Objekt.

create or replace function public.create_reservation_atomic(
    p_reservation jsonb,
    p_source public.availability_source,
    p_with_outbox boolean default true
)
returns jsonb
language plpgsql
set search_path = 'public'
as $function$
declare
    v_property   uuid := (p_reservation->>'property_id')::uuid;
    v_check_in   date := (p_reservation->>'check_in')::date;
    v_check_out  date := (p_reservation->>'check_out')::date;
    v_unit       uuid := nullif(p_reservation->>'unit_id', '')::uuid;
    v_cols       text;
    v_row        public.reservations;
    v_affected   integer;
    v_nights     integer := v_check_out - v_check_in;
    v_outbox_id  uuid;
begin
    if v_property is null or v_check_in is null or v_check_out is null then
        raise exception 'property_id, check_in und check_out sind Pflicht'
            using errcode = '22023';
    end if;
    if v_check_out <= v_check_in then
        raise exception 'check_out muss nach check_in liegen'
            using errcode = '22023';
    end if;

    perform pg_advisory_xact_lock(
        hashtextextended('reservation:' || v_property::text, 0)
    );

    if exists (
        select 1 from public.stop_sell
         where property_id = v_property
           and date >= v_check_in and date < v_check_out
    ) then
        raise exception 'Zeitraum enthält Stop-Sell-Tage. Bitte zuerst den Stop-Sell aufheben.'
            using errcode = 'RS409';
    end if;

    -- Welche Einheit wird belegt? Vorgabe gewinnt, sonst die erste freie.
    -- Frei heißt: im GANZEN Zeitraum keine Zeile, die nicht `open` ist.
    if v_unit is not null then
        if not exists (
            select 1 from public.property_units u
             where u.id = v_unit and u.property_id = v_property
        ) then
            raise exception 'Einheit gehört nicht zu diesem Objekt'
                using errcode = '22023';
        end if;
        if exists (
            select 1 from public.availability a
             where a.property_id = v_property
               and a.unit_id = v_unit
               and a.date >= v_check_in and a.date < v_check_out
               and a.status <> 'open'
        ) then
            raise exception 'Zeitraum enthält bereits belegte/gesperrte Tage.'
                using errcode = 'RS409';
        end if;
    else
        select u.id into v_unit
          from public.property_units u
         where u.property_id = v_property
           and not exists (
                select 1 from public.availability a
                 where a.property_id = v_property
                   and a.unit_id = u.id
                   and a.date >= v_check_in and a.date < v_check_out
                   and a.status <> 'open'
           )
         order by u.position, u.id
         limit 1;
        if v_unit is null then
            -- Entweder alle Einheiten belegt, oder das Objekt hat gar keine.
            -- Die beiden Fälle sind fachlich verschieden und dürfen nicht
            -- dieselbe Meldung tragen (Wurzel 4/5: kein Sammel-Fehler, der
            -- einen Datenfehler als Ausbuchung tarnt).
            if not exists (
                select 1 from public.property_units u where u.property_id = v_property
            ) then
                raise exception 'Objekt hat keine Einheit (property_units) — Buchung nicht möglich.'
                    using errcode = '22023';
            end if;
            raise exception 'Zeitraum enthält bereits belegte/gesperrte Tage.'
                using errcode = 'RS409';
        end if;
    end if;

    -- Die gewählte Einheit gehört in die Reservierung selbst, sonst wüsste
    -- hinterher niemand, welche belegt ist.
    p_reservation := p_reservation || jsonb_build_object('unit_id', v_unit);

    select string_agg(format('%I', key), ', ')
      into v_cols
      from jsonb_object_keys(p_reservation) as t(key);
    begin
        execute format(
            'insert into public.reservations (%s) '
            'select %s from jsonb_populate_record(null::public.reservations, $1) '
            'returning *',
            v_cols, v_cols
        ) using p_reservation into v_row;
    exception
        when exclusion_violation then
            raise exception 'Zeitraum enthält bereits belegte/gesperrte Tage.'
                using errcode = 'RS409';
    end;

    insert into public.availability (property_id, unit_id, date, status, source)
    select v_property, v_unit, d::date, 'booked', p_source
      from generate_series(v_check_in, v_check_out - 1, interval '1 day') as d
    on conflict (property_id, unit_id, date) do update
        set status = 'booked', source = excluded.source, updated_at = now()
      where availability.status = 'open';
    get diagnostics v_affected = row_count;
    if v_affected < v_nights then
        raise exception 'Zeitraum enthält bereits belegte/gesperrte Tage.'
            using errcode = 'RS409';
    end if;

    if p_with_outbox then
        insert into public.ari_outbox
            (tenant_id, property_id, date_from, date_to, availability, status)
        values
            (v_row.tenant_id, v_property, v_check_in, v_check_out - 1, 0, 'pending')
        returning id into v_outbox_id;
    end if;

    return jsonb_build_object(
        'reservation', to_jsonb(v_row),
        'outbox_id', v_outbox_id
    );
end;
$function$;

comment on function public.create_reservation_atomic(jsonb, public.availability_source, boolean) is
    'Atomare Buchung: wählt unter dem Advisory-Lock die freie Einheit (0275), '
    'schreibt Reservierung + availability je Einheit und legt die ARI-Outbox-Zeile an.';
