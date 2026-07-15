-- 0141_hotel_atomic_booking.sql — Doppelbuchungsschutz für Hotels (count-Modell)
--
-- Ferienwohnungen buchen binär (eine Einheit je Objekt, availability 0/1); der
-- EXCLUDE-Constraint reservations_no_local_overlap (0104) verbietet dort zwei
-- überlappende lokale Reservierungen. Für HOTELS (Reservierung trägt eine
-- room_type_id, 0140) ist genau das falsch: ein Zimmertyp mit count_of_rooms=5
-- darf 5 überlappende Buchungen haben. Statt binärem availability-Flip wird
-- room_type_availability.booked_count atomar hochgezählt, geguarded gegen
-- count_of_rooms.
--
-- Zwei Änderungen, beide additiv fürs Ferienwohnungs-Modell:
--  1) EXCLUDE-Constraint nur noch für Reservierungen OHNE room_type_id — Hotel-
--     Reservierungen sind ausgenommen (Bestand wird per Zähler geschützt).
--  2) create_reservation_atomic bekommt einen Room-Type-Zweig: hat p_reservation
--     eine room_type_id, wird der Zähler statt der binären availability geführt.
--     Ohne room_type_id läuft der bisherige Pfad UNVERÄNDERT.

-- ---------------------------------------------------------------------------
-- 1) EXCLUDE-Constraint neu ziehen: Hotel-Reservierungen ausnehmen.
-- ---------------------------------------------------------------------------
alter table public.reservations
    drop constraint if exists reservations_no_local_overlap;
alter table public.reservations
    add constraint reservations_no_local_overlap
    exclude using gist (
        property_id with =,
        daterange(check_in, check_out, '[)') with &&
    )
    where (
        status <> 'cancelled'
        and source_channex_booking_id is null
        and room_type_id is null            -- Hotels: Zähler statt Overlap-Verbot
    );

-- ---------------------------------------------------------------------------
-- 2) create_reservation_atomic um den Room-Type-Zweig erweitern.
-- ---------------------------------------------------------------------------
create or replace function public.create_reservation_atomic(
    p_reservation jsonb,
    p_source      public.availability_source,
    p_with_outbox boolean default true
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
    v_property   uuid := (p_reservation->>'property_id')::uuid;
    v_room_type  uuid := (p_reservation->>'room_type_id')::uuid;
    v_check_in   date := (p_reservation->>'check_in')::date;
    v_check_out  date := (p_reservation->>'check_out')::date;
    v_cols       text;
    v_row        public.reservations;
    v_affected   integer;
    v_capacity   integer;
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

    -- Serialisierung: bei Hotels je Zimmertyp, sonst je Objekt. So buchen
    -- verschiedene Zimmertypen desselben Hotels ungebremst parallel.
    perform pg_advisory_xact_lock(
        hashtextextended(
            'reservation:' || coalesce(v_room_type::text, v_property::text), 0
        )
    );

    -- Stop-Sell sperrt den Tag auf ALLEN Kanälen (auch Hotels, property-weit).
    if exists (
        select 1 from public.stop_sell
         where property_id = v_property
           and date >= v_check_in and date < v_check_out
    ) then
        raise exception 'Zeitraum enthält Stop-Sell-Tage. Bitte zuerst den Stop-Sell aufheben.'
            using errcode = 'RS409';
    end if;

    -- Reservierung anlegen — nur übergebene Spalten. Der EXCLUDE-Constraint
    -- greift nur für Nicht-Hotel-Reservierungen (room_type_id is null).
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

    if v_room_type is null then
        -- === Ferienwohnungs-Pfad (unverändert): binäre availability ===
        insert into public.availability (property_id, date, status, source)
        select v_property, d::date, 'booked', p_source
          from generate_series(v_check_in, v_check_out - 1, interval '1 day') as d
        on conflict (property_id, date) do update
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
    else
        -- === Hotel-Pfad: room_type_availability.booked_count hochzählen ===
        select count_of_rooms into v_capacity
          from public.room_types where id = v_room_type;
        if v_capacity is null then
            raise exception 'Zimmerkategorie nicht gefunden.' using errcode = '22023';
        end if;
        -- Zähler je Nacht atomar erhöhen, NUR wenn noch ein Zimmer frei ist.
        insert into public.room_type_availability (room_type_id, date, booked_count)
        select v_room_type, d::date, 1
          from generate_series(v_check_in, v_check_out - 1, interval '1 day') as d
        on conflict (room_type_id, date) do update
            set booked_count = room_type_availability.booked_count + 1,
                updated_at = now()
          where room_type_availability.booked_count < v_capacity;
        get diagnostics v_affected = row_count;
        if v_affected < v_nights then
            raise exception 'Zimmerkategorie ist im Zeitraum ausgebucht.'
                using errcode = 'RS409';
        end if;
        -- Outbox trägt den Rest-Count (count_of_rooms − booked) pro Tag NICHT hier:
        -- der Room-Type-Availability-Push kommt aus dem count-fähigen Push-Pfad
        -- (Folge-PR ari_push room-type-aware). Für jetzt: kein binärer 0-Push,
        -- der den ganzen Zimmertyp fälschlich sperren würde.
        v_outbox_id := null;
    end if;

    return jsonb_build_object(
        'reservation', to_jsonb(v_row),
        'outbox_id', v_outbox_id
    );
end;
$$;

revoke all on function public.create_reservation_atomic(jsonb, public.availability_source, boolean) from public;
grant execute on function public.create_reservation_atomic(jsonb, public.availability_source, boolean) to service_role;
