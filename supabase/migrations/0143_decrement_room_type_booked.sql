-- 0143_decrement_room_type_booked.sql — Hotel-Gegenzustand: Zähler senken
--
-- Storno/Move einer Hotel-Reservierung MUSS den booked_count der Zimmerkategorie
-- je freigegebener Nacht wieder senken (Wurzel 1: jede Belegung hat einen
-- Gegenzustand, der mitgepflegt werden muss). create_reservation_atomic (0141)
-- zählt beim Buchen atomar hoch; hier das symmetrische Herunterzählen.
--
-- Atomar + geguarded (booked_count > 0), damit nebenläufige Buchungen/Stornos
-- den Zähler nicht unter 0 drücken (Wurzel 2). Advisory-Lock je Zimmertyp wie im
-- Buchungs-RPC, damit Increment und Decrement serialisiert sind.

create or replace function public.decrement_room_type_booked(
    p_room_type_id uuid,
    p_dates        date[]
)
returns void
language plpgsql
set search_path = public
as $$
begin
    if p_room_type_id is null or p_dates is null or array_length(p_dates, 1) is null then
        return;
    end if;
    perform pg_advisory_xact_lock(
        hashtextextended('reservation:' || p_room_type_id::text, 0)
    );
    -- Nur existierende Zeilen mit booked_count > 0 senken; fehlt eine Zeile,
    -- gibt es nichts freizugeben (kein Erfinden von Negativ-Zählern).
    update public.room_type_availability
       set booked_count = booked_count - 1,
           updated_at = now()
     where room_type_id = p_room_type_id
       and date = any(p_dates)
       and booked_count > 0;
end;
$$;

revoke all on function public.decrement_room_type_booked(uuid, date[]) from public;
grant execute on function public.decrement_room_type_booked(uuid, date[]) to service_role;
