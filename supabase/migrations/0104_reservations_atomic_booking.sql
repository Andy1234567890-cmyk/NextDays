-- 0104_reservations_atomic_booking.sql — Doppelbuchungs-Schutz DB-seitig
--
-- Bisher liefen Verfügbarkeits-Check (SELECT), Reservierungs-INSERT und
-- availability-UPSERT als getrennte PostgREST-Statements ohne Transaktion.
-- Zwei gleichzeitige Buchungen desselben Zeitraums lasen beide 'open',
-- bestanden beide den Check und buchten beide → Doppelbuchung (TOCTOU).
-- Zusätzlich ging der Channex-Availability-Push ersatzlos verloren, wenn das
-- Job-Enqueue nach dem Commit scheiterte: der ari_outbox-Eintrag entstand erst
-- IM Worker — kein Job, keine Outbox-Zeile, kein Reconcile (der Abgleich
-- spiegelt nur Channex→DB, nie lokal→Channex).
--
-- Fix in zwei Schichten:
--  1) EXCLUDE-Constraint: keine zwei überlappenden, nicht stornierten LOKALEN
--     Reservierungen je Objekt (ein Objekt = eine Einheit, auch Hotelzimmer).
--     OTA-Buchungen (source_channex_booking_id gesetzt) sind ausgenommen: sie
--     existieren beim Portal bereits verbindlich und MÜSSEN importiert werden —
--     eine echte Überbuchung soll lokal sichtbar sein, nicht am Import scheitern.
--  2) RPC create_reservation_atomic: Stop-Sell-Check, Reservierungs-INSERT,
--     availability→booked (nur offene Tage, guarded) UND ari_outbox-Eintrag in
--     EINER Transaktion, serialisiert per Advisory-Lock je Objekt. Damit ist der
--     availability=0-Push persistiert, bevor der Request zurückkehrt — schlägt
--     das Job-Enqueue fehl, zieht der process_ari_outbox-Tick die Zeile nach.
--
-- Live-DB vor Einführung verifiziert: 0 Bestands-Überlappungen (Constraint
-- kann ohne Datenbereinigung angelegt werden), btree_gist verfügbar (PG 15.14).

create extension if not exists btree_gist;

alter table public.reservations
    add constraint reservations_no_local_overlap
    exclude using gist (
        property_id with =,
        daterange(check_in, check_out, '[)') with &&
    )
    where (status <> 'cancelled' and source_channex_booking_id is null);

-- Atomare Buchung: p_reservation trägt die Spalten der reservations-Zeile als
-- jsonb (nur übergebene Spalten werden inserted → Spalten-Defaults bleiben
-- aktiv, künftige Spalten brechen die RPC nicht). Fehler-Codes:
--   RS409 = Zeitraum belegt/gesperrt bzw. Stop-Sell (vom Service auf HTTP 409
--           gemappt); die Message unterscheidet die beiden Fälle.
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
    v_property  uuid := (p_reservation->>'property_id')::uuid;
    v_check_in  date := (p_reservation->>'check_in')::date;
    v_check_out date := (p_reservation->>'check_out')::date;
    v_cols      text;
    v_row       public.reservations;
    v_affected  integer;
    v_outbox_id uuid;
begin
    if v_property is null or v_check_in is null or v_check_out is null then
        raise exception 'property_id, check_in und check_out sind Pflicht'
            using errcode = '22023';
    end if;
    if v_check_out <= v_check_in then
        raise exception 'check_out muss nach check_in liegen'
            using errcode = '22023';
    end if;

    -- Buchungen desselben Objekts serialisieren. Der Lock endet automatisch mit
    -- der Transaktion; andere Objekte buchen ungebremst parallel.
    perform pg_advisory_xact_lock(
        hashtextextended('reservation:' || v_property::text, 0)
    );

    -- Stop-Sell sperrt den Tag auf ALLEN Kanälen — auch die interne Buchung.
    if exists (
        select 1 from public.stop_sell
         where property_id = v_property
           and date >= v_check_in and date < v_check_out
    ) then
        raise exception 'Zeitraum enthält Stop-Sell-Tage. Bitte zuerst den Stop-Sell aufheben.'
            using errcode = 'RS409';
    end if;

    -- Reservierung anlegen — nur die im jsonb vorhandenen Spalten. Trifft der
    -- INSERT den EXCLUDE-Constraint (überlappende lokale Reservierung), wird
    -- das als fachlicher RS409 gemeldet — ein Vertrag für die Aufrufer.
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

    -- Nächte belegen: NUR offene Tage kippen (guard im DO UPDATE). Wurde ein
    -- Tag übersprungen (booked/blocked), zählt row_count ihn nicht → 409 und
    -- die GANZE Transaktion (inkl. Reservierung) rollt zurück.
    insert into public.availability (property_id, date, status, source)
    select v_property, d::date, 'booked', p_source
      from generate_series(v_check_in, v_check_out - 1, interval '1 day') as d
    on conflict (property_id, date) do update
        set status = 'booked', source = excluded.source, updated_at = now()
      where availability.status = 'open';
    get diagnostics v_affected = row_count;
    if v_affected < (v_check_out - v_check_in) then
        raise exception 'Zeitraum enthält bereits belegte/gesperrte Tage.'
            using errcode = 'RS409';
    end if;

    -- Push-Absicht persistieren (availability=0, date_to inklusiv): garantiert
    -- in derselben Transaktion wie die Reservierung. Der Sofort-Push (Job)
    -- arbeitet genau diese Zeile ab; scheitert das Enqueue, zieht der
    -- process_ari_outbox-Tick sie nach. Für nicht mit Channex verbundene
    -- Objekte hakt der Tick die Zeile als übersprungen ab.
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

-- Nur das Backend (service_role) darf buchen — wie enqueue_job (0103).
revoke all on function public.create_reservation_atomic(jsonb, public.availability_source, boolean) from public;
grant execute on function public.create_reservation_atomic(jsonb, public.availability_source, boolean) to service_role;
