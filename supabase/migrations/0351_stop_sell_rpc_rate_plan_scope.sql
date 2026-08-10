-- 0351_stop_sell_rpc_rate_plan_scope.sql — die atomare Buchung prüft Stop-Sell
-- mit demselben Scope wie der Python-Pfad davor
--
-- BEFUND: `create_reservation_atomic` (0275, zuletzt 0318) prüft Stop-Sell mit
-- `where property_id = v_property and date >= ... and date < ...` — ohne
-- `rate_plan_id`. Die Vorprüfungen im Python-Pfad sind dagegen plan-bewusst:
-- `reservations/writes.py` lässt einen Stopp durch, dessen `rate_plan_id`
-- weder null noch der gebuchte Plan ist. Damit gelten zwei verschiedene
-- Wahrheiten für dieselbe Tabelle: Python lässt die Buchung zu, die RPC eine
-- Zeile später wirft RS409.
--
-- Fehlszenario (Hotel): Zimmertyp Twin, Rate BAR am 14.11. plan-genau gestoppt
-- (rate_plan_id gesetzt). Ein Gast bucht dieselbe Nacht auf der Rate B&B.
-- Python prüft korrekt und lässt durch; die RPC sieht nur „irgendein Stop-Sell
-- an diesem Tag" und bricht mit „Bitte zuerst den Stop-Sell aufheben" ab — für
-- einen Stopp, der die gebuchte Rate gar nicht betrifft. Die Buchung ist
-- unmöglich, und die Fehlermeldung zeigt auf die falsche Ursache.
--
-- Die Objekt-Ebene (rate_plan_id is null) sperrt weiterhin ALLE Raten und damit
-- alle Einheiten des Typs — das ist die dokumentierte Semantik („Stop-Sell
-- sperrt überall") und bleibt unverändert. Neu ist nur, dass ein plan-genauer
-- Stopp auch plan-genau wirkt.
--
-- Nicht geändert: Signatur, Einheitenwahl, Outbox-Wert (0318), Fehlercodes,
-- Rückgabe. Nur die where-Klausel der Stop-Sell-Prüfung.

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
    v_units      integer;
    v_frei       integer;
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

    -- Stop-Sell sperrt NUR auf der Objekt-Ebene (rate_plan_id is null).
    -- Ein plan-genauer Stopp (0152) betrifft eine einzelne Rate, nicht den Typ;
    -- die Python-Vorprüfungen (reservations/writes.py, booking_engine/service.py)
    -- filtern deshalb auf den gebuchten Rate-Plan. Ohne denselben Filter hier
    -- wies die RPC danach Buchungen einer GANZ ANDEREN Rate mit RS409 ab —
    -- zwei Wahrheiten für dieselbe Zeile (Wurzel 3).
    if exists (
        select 1 from public.stop_sell s
         where s.property_id = v_property
           and s.date >= v_check_in and s.date < v_check_out
           and (
               s.rate_plan_id is null
               or s.rate_plan_id = nullif(p_reservation->>'rate_plan_id', '')::uuid
           )
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
        -- Freie Einheiten je Nacht: Gesamtzahl minus der Einheiten, deren Tag
        -- im Kalender nicht `open` ist (die eben geschriebene Belegung zählt
        -- damit bereits mit). Über die Nächte das Minimum, weil eine
        -- Outbox-Zeile nur EINEN Wert trägt (Begründung im Kopf).
        select count(*) into v_units
          from public.property_units u
         where u.property_id = v_property;
        -- Ohne Einheiten-Zeile ist das ein Datenfehler; er darf aber nicht dazu
        -- führen, dass wir eine erfundene Stückzahl melden. 1 ist hier keine
        -- Erfindung, sondern die Untergrenze des Modells (n >= 1) und
        -- deckungsgleich mit `einheiten_verfuegbar.einheiten_zahl`. Der
        -- Buchungspfad oben hat den Fall ohnehin schon mit 22023 abgelehnt.
        v_units := greatest(coalesce(v_units, 0), 1);
        select coalesce(min(v_units - t.belegt), 0)
          into v_frei
          from (
                select (select count(distinct a.unit_id)
                          from public.availability a
                         where a.property_id = v_property
                           and a.date = d::date
                           and a.status <> 'open') as belegt
                  from generate_series(v_check_in, v_check_out - 1, interval '1 day') as d
          ) as t;
        v_frei := greatest(coalesce(v_frei, 0), 0);

        insert into public.ari_outbox
            (tenant_id, property_id, date_from, date_to, availability, status)
        values
            (v_row.tenant_id, v_property, v_check_in, v_check_out - 1, v_frei, 'pending')
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
    'schreibt Reservierung + availability je Einheit, legt die ARI-Outbox-Zeile '
    'mit der echten Zahl freier Einheiten an (0318) und prüft Stop-Sell mit dem '
    'Rate-Plan-Scope des Python-Pfades (0351).';
