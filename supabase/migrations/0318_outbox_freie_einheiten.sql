-- 0318_outbox_freie_einheiten.sql — die ARI-Outbox der atomaren Buchung meldet
-- die ECHTE Zahl freier Einheiten statt hart 0
--
-- BEFUND: `create_reservation_atomic` (0275) schreibt am Ende die
-- `ari_outbox`-Zeile mit `availability = 0`, fest verdrahtet. Das stammt aus
-- der Zeit vor 0265, als „1 property = 1 buchbare Einheit" galt: die eine
-- Einheit war weg, also war der Typ zu.
--
-- Seit 0265 ist ein Objekt ein Einheiten-TYP mit n >= 1 Einheiten, und die
-- Verfügbarkeit an die Portale ist eine ZAHL (freie Einheiten), keine 0/1.
-- Booking.com führt die Stückzahl am Zimmer-/Apartment-Typ, SiteMinder sendet
-- sie als `BookingLimit` je Typ. Eine hart geschriebene 0 heißt dort
-- „ausverkauft": bei einem Typ mit zwei identischen Einheiten war nach der
-- ERSTEN Buchung die zweite Einheit unverkäuflich.
--
-- Warum die Zeile trotz korrigiertem Python-Pfad zählt: `process_ari_outbox`
-- (ari_push.py) pusht `availability` der Zeile UNVERÄNDERT an Channex. Der
-- schnelle Push aus dem Service meldet inzwischen die echte Zahl, aber diese
-- Outbox-Zeile ist der Cron-Backstop derselben Buchung — sie würde die
-- korrigierte Zahl später wieder mit 0 überschreiben und die freien Einheiten
-- erneut aus dem Verkauf nehmen. Der Gegenzustand einer Änderung muss
-- mitgepflegt werden (Wurzel 1); genau daran ist schon 0275 hängengeblieben.
--
-- WIE die Zahl ermittelt wird: identisch zur Python-Seite
-- (`core/einheiten_verfuegbar.freie_einheiten_spannen`) auf dem KALENDER, nicht
-- auf den Reservierungen — der Kalender ist die Wahrheit für Belegung (Buchung,
-- Stop-Sell, Wartung, iCal) und ist an dieser Stelle bereits geschrieben (der
-- `availability`-Insert läuft ein paar Zeilen darüber, in derselben
-- Transaktion und unter demselben Advisory-Lock). Freie Stückzahl eines Tages
-- = Zahl der Einheiten des Objekts minus der Einheiten mit nicht-`open`-Tag.
--
-- Eine Outbox-Zeile trägt EINEN Wert für EINEN Datumsbereich. Der belegte
-- Zeitraum kann aber unterschiedlich viele freie Einheiten je Tag haben (eine
-- Schwestereinheit ist nur an manchen Tagen fremdbelegt). Deshalb wird das
-- MINIMUM über die Nächte geschrieben — der konservative Wert. Zu wenig
-- anzubieten kostet eine Buchung, zu viel erzeugt eine Überbuchung; im Zweifel
-- fail-closed (Wurzel 5). Der schnelle Push aus dem Service meldet ohnehin
-- tag-genau je Spanne und supersedet diese Zeile tag-genau; sie greift nur,
-- wenn der schnelle Weg ausgefallen ist.
--
-- Nicht geändert: Signatur, Einheitenwahl, Fehlercodes, Rückgabe. Nur der
-- Wert der Outbox-Zeile.

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
    'schreibt Reservierung + availability je Einheit und legt die ARI-Outbox-Zeile '
    'mit der echten Zahl freier Einheiten an (0318).';
