-- 0142_ari_outbox_room_type.sql — ari_outbox um die Zimmerkategorie-Dimension
--
-- Der Availability-Push (ari_outbox, 0033) trägt EINEN absoluten Wert je Tag und
-- war bisher rein binär (0/1, Ferienwohnungs-Modell, eine Einheit je Objekt). Für
-- HOTELS ist die Verfügbarkeit die ZAHL freier Zimmer je Zimmerkategorie
-- (room_type_availability.booked_count, count_of_rooms − booked, 0140/0141). Damit
-- der Push den richtigen Channex-Room-Type trifft, MUSS die Outbox-Zeile die
-- room_type_id mitführen.
--
-- Additiv, Ferienwohnungs-Pfad UNVERÄNDERT:
--   room_type_id IS NULL  → binärer Push an den synthetischen Room-Type
--                           (local_unit_ref = property_id), wie bisher.
--   room_type_id gesetzt  → Rest-Count-Push an den Channex-Room-Type der Kategorie
--                           (local_unit_ref = room_type_id).
--
-- 0141 setzte im Hotel-Zweig bewusst v_outbox_id := null (kein binärer 0-Push, der
-- den ganzen Zimmertyp gesperrt hätte). Jetzt schreibt der Hotel-Zweig je Nacht
-- eine Outbox-Zeile mit dem tag-genauen Rest-Count (count_of_rooms − booked_count
-- NACH dem Zähler-Update). Pro Nacht eine Zeile, weil der Rest-Count über den
-- Zeitraum variieren kann (andere Buchungen überlappen unterschiedlich) — ein
-- Range-Wert wäre für Teile des Zeitraums falsch.

-- ---------------------------------------------------------------------------
-- 1) Spalte + Index (partiell, nur Hotel-Zeilen).
-- ---------------------------------------------------------------------------
alter table public.ari_outbox
    add column if not exists room_type_id uuid references public.room_types(id);

create index if not exists ari_outbox_room_type_idx
    on public.ari_outbox (property_id, room_type_id, status)
    where room_type_id is not null;

-- ---------------------------------------------------------------------------
-- 2) create_reservation_atomic: Hotel-Zweig schreibt Rest-Count-Outbox je Nacht.
--    Der Rückgabewert 'outbox_id' bleibt für den Ferienwohnungs-Pfad die EINE
--    Zeile; bei Hotels sind es mehrere (eine je Nacht) — die Aufrufer im
--    Buchungspfad pushen dann über die room_type_id, nicht über die einzelne
--    outbox_id. Deshalb gibt der Hotel-Zweig zusätzlich 'room_type_id' zurück,
--    damit der Aufrufer den count-Push je Kategorie anstoßen kann.
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
        -- Rest-Count-Outbox je Nacht: der freie Bestand (count_of_rooms −
        -- booked_count) kann über den Zeitraum variieren (andere Buchungen
        -- überlappen unterschiedlich), darum je Tag eine Zeile mit dem
        -- tag-genauen Rest-Count. Kein binärer 0-Push (der den ganzen Zimmertyp
        -- fälschlich sperren würde). date_from = date_to (ein Tag je Zeile).
        if p_with_outbox then
            insert into public.ari_outbox
                (tenant_id, property_id, room_type_id,
                 date_from, date_to, availability, status)
            select v_row.tenant_id, v_property, v_room_type,
                   rta.date, rta.date,
                   greatest(0, v_capacity - rta.booked_count), 'pending'
              from public.room_type_availability rta
             where rta.room_type_id = v_room_type
               and rta.date >= v_check_in and rta.date < v_check_out;
            -- Mehrere Zeilen (eine je Nacht): der Aufrufer pusht über room_type_id,
            -- nicht über eine einzelne outbox_id → v_outbox_id bleibt null.
        end if;
        v_outbox_id := null;
    end if;

    return jsonb_build_object(
        'reservation', to_jsonb(v_row),
        'outbox_id', v_outbox_id,
        'room_type_id', v_room_type
    );
end;
$$;

revoke all on function public.create_reservation_atomic(jsonb, public.availability_source, boolean) from public;
grant execute on function public.create_reservation_atomic(jsonb, public.availability_source, boolean) to service_role;
