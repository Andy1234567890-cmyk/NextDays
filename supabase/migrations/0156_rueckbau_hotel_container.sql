-- 0155_rueckbau_hotel_container.sql — „Hotel-Container"-Zweig zurückbauen
--
-- Modell (verbindlich, CLAUDE.md): 1 properties-Zeile = 1 buchbare Einheit
-- (ein Zimmer bei Hotel ODER ein Ferienobjekt). Der frühere Container-Zweig
-- (0140–0143: room_types mit count_of_rooms, count-basierte Verfügbarkeit) wird
-- entfernt. Verfügbarkeit ist wieder ausschließlich binär (availability).
--
-- REIHENFOLGE (WICHTIG): Erst einspielen, NACHDEM der Backend-Code deployt ist,
-- der room_type_id / room_types / count_of_rooms nicht mehr liest. (Dieser Code
-- ist im selben Commit; Deploy vor Migration.)
--
-- Live-Ausgangslage (verifiziert): Nur das Zert-Testobjekt 956747c8 nutzte den
-- Container-Zweig (2 room_types Twin/Double, count 8/4). Belegung liegt dort NUR
-- in room_type_availability (booked_count), NICHT in der binären availability.
-- Diese Migration:
--   1. bereinigt die 5 überlappenden Twin-Testbuchungen (sonst scheitert der
--      neue EXCLUDE-Constraint),
--   2. backfillt die binäre availability für die verbleibenden Ex-Container-
--      Buchungen (sonst wären sie nach dem Drop unsichtbar → Überbuchung),
--   3. baut RPC/Constraint/Spalten/Tabellen zurück.
-- Der Channex-Gegenzustand (verwaiste Kategorie-Room-Types) wird NICHT hier per
-- DELETE angefasst — der Content-Sync (Hotel→FeWo-Rückweg, prune_orphan_room_types)
-- legt nach dem Deploy den synthetischen Room-Type an und soft-deleted die
-- Kategorie-Maps inkl. Remote-Delete bei Channex.

-- ============================================================================
-- 1) Überlappende Ex-Container-Buchungen bereinigen (sonst 23P01 bei ADD)
-- ============================================================================
-- Von mehreren nicht-stornierten Reservierungen, die sich am selben Objekt im
-- Zeitraum überlappen, bleibt die ÄLTESTE bestehen; die übrigen werden storniert.
-- (Am Zert-Objekt sind das die 4 doppelten Twin-Testbuchungen 10.–16.11.)
with ranked as (
    select id,
           row_number() over (
               partition by property_id, daterange(check_in, check_out, '[)')
               order by created_at, id
           ) as rn
      from public.reservations
     where status <> 'cancelled'
       and source_channex_booking_id is null  -- OTA-Buchungen nie stornieren
)
update public.reservations r
   set status = 'cancelled',
       cancelled_at = now(),
       cancel_reason = 'Modell-Rückbau: überlappende Container-Buchung'
  from ranked
 where ranked.id = r.id and ranked.rn > 1;

-- Zusätzlicher Backstop: falls trotz Schritt 1 noch ein echter Overlap bleibt
-- (verschiedene Zeiträume, die sich schneiden), storniere die jeweils jüngere.
-- Konservativ: verhindert nur den Constraint-Abbruch, kippt keine gültigen Daten.
with pairs as (
    select a.id as younger_id
      from public.reservations a
      join public.reservations b
        on a.property_id = b.property_id
       and a.id <> b.id
       and a.status <> 'cancelled' and b.status <> 'cancelled'
       -- OTA-Buchungen NIE stornieren (existieren beim Portal verbindlich,
       -- Überbuchung wird sichtbar gemacht, nicht verworfen — Constraint-Design).
       and a.source_channex_booking_id is null
       and b.source_channex_booking_id is null
       and daterange(a.check_in, a.check_out, '[)')
           && daterange(b.check_in, b.check_out, '[)')
       -- Tiebreaker (created_at, id): auch bei gleichem created_at deterministisch
       -- die jüngere/größere id stornieren (sonst verfehlt strikt-> ein Paar).
       and (a.created_at, a.id) > (b.created_at, b.id)
)
update public.reservations r
   set status = 'cancelled',
       cancelled_at = now(),
       cancel_reason = 'Modell-Rückbau: Restüberlappung'
  from pairs
 where pairs.younger_id = r.id;

-- ============================================================================
-- 2) Binäre availability für verbleibende Ex-Container-Buchungen backfillen
-- ============================================================================
-- Container-Buchungen belegten NUR den count-Zähler, nicht die availability.
-- Nach dem Drop ist der Zähler weg → ohne Backfill stünden die Tage auf 'open'
-- und würden an Channex als frei gemeldet (Überbuchung). Für jede verbleibende
-- nicht-stornierte Reservierung mit room_type_id die Nächte auf 'booked' setzen.
insert into public.availability (property_id, date, status, source)
select r.property_id, d::date, 'booked', 'direct'
  from public.reservations r
 cross join lateral
       generate_series(r.check_in, r.check_out - 1, interval '1 day') as d
 where r.status <> 'cancelled'
   and r.room_type_id is not null
on conflict (property_id, date) do update
   set status = 'booked', updated_at = now()
 where public.availability.status = 'open';

-- ============================================================================
-- 3) RPC create_reservation_atomic auf den BINÄREN Single-Unit-Pfad zurück
-- ============================================================================
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
    v_check_in   date := (p_reservation->>'check_in')::date;
    v_check_out  date := (p_reservation->>'check_out')::date;
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

    return jsonb_build_object(
        'reservation', to_jsonb(v_row),
        'outbox_id', v_outbox_id
    );
end;
$$;

-- ============================================================================
-- 4) decrement_room_type_booked droppen (KORREKTE Signatur: uuid, date[])
-- ============================================================================
drop function if exists public.decrement_room_type_booked(uuid, date[]);

-- ============================================================================
-- 5) EXCLUDE-Constraint ohne room_type_id-Ausnahme, MIT Channex-Ausnahme
-- ============================================================================
-- 0104-Design bewahren: OTA-Buchungen (source_channex_booking_id gesetzt)
-- existieren beim Portal bereits verbindlich und MÜSSEN importierbar bleiben,
-- auch wenn sie lokal überlappen (Überbuchung wird sichtbar, nicht verworfen).
-- Nur die room_type_id-Ausnahme aus 0141 fällt weg.
alter table public.reservations
    drop constraint if exists reservations_no_local_overlap;

update public.reservations set room_type_id = null where room_type_id is not null;

alter table public.reservations
    add constraint reservations_no_local_overlap
    exclude using gist (
        property_id with =,
        daterange(check_in, check_out, '[)') with &&
    )
    where (status <> 'cancelled' and source_channex_booking_id is null);

-- ============================================================================
-- 6) rate_plans / reservations / ari_outbox von room_type_id lösen
-- ============================================================================
-- KRITISCH vor dem ari_outbox-Drop: pending Hotel-Outbox-Zeilen (mit room_type_id)
-- neutralisieren. Der alte Hotel-RPC schrieb Rest-Count-Zeilen (availability = z. B.
-- 7, eine je Nacht). Nach dem Spalten-Drop verlören sie ihre Kategorie-Dimension
-- und würden zu Objekt-Level-Absichten: process_ari_outbox pushte availability=7
-- an den synthetischen Room-Type UND unterdrückte tag-genau ein echtes
-- availability=0 („neuere Absicht") → gebuchte Tage wieder bei OTAs verkaufbar.
-- Als 'done' abhaken (nicht mehr pushen); der Post-Migrations-Full-Sync stellt
-- den korrekten binären Bestand her.
update public.ari_outbox
   set status = 'done', last_error = 'Modell-Rückbau: Hotel-Outbox neutralisiert'
 where status = 'pending' and room_type_id is not null;

update public.rate_plans set room_type_id = null where room_type_id is not null;

alter table public.rate_plans   drop column if exists room_type_id;
alter table public.reservations drop column if exists room_type_id;
alter table public.ari_outbox   drop column if exists room_type_id;

-- ============================================================================
-- 7) Container-Tabellen droppen (channex_room_type_map BLEIBT — 0027)
-- ============================================================================
-- channex_room_type_map wird NICHT angefasst: der synthetische Sync (1 Room-Type
-- je Objekt, local_unit_ref = property_id) nutzt sie weiter, und der Content-Sync
-- pruned die alten Kategorie-Maps sauber inkl. Remote-Delete bei Channex.
drop table if exists public.room_type_availability;
drop table if exists public.room_types cascade;
