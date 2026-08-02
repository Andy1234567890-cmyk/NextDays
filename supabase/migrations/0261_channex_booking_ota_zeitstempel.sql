-- 0261_channex_booking_ota_zeitstempel.sql — OTA-Zeitpunkt der Buchung festhalten
--
-- Das Ereignis „Gast macht Buchung · 13:47" im Posteingang stand bisher auf
-- channex_booking.created_at — dem Zeitpunkt, an dem UNSER Import die Zeile
-- geschrieben hat. Bei einem Feed-Nachlauf tragen 20 Buchungen aus drei Wochen
-- dieselbe Sekunde; der Gast hat aber am 11.05. um 23:08 gebucht. Angezeigt
-- werden muss die Angabe der Gegenseite, nicht unsere Uhr.
--
-- Channex liefert je Booking Revision `inserted_at` (Zeitpunkt des Eingangs bei
-- Channex, UTC — belegt: Doku „Bookings Collection", Feld inserted_at, und live
-- gegengeprüft gegen created_at unserer Zeilen). Das Feld steht in raw, wird
-- aber bei JEDER Revision überschrieben: nach einer Umbuchung stünde dort der
-- Zeitpunkt der Änderung, und das Buchungs-Ereignis würde nach vorn wandern.
-- Deshalb eine eigene, EINMAL beschreibbare Spalte: der erste Eingang bleibt
-- stehen, spätere Revisionen lesen ihre Zeit weiterhin aus raw->>'inserted_at'.

alter table public.channex_booking
    add column if not exists ota_inserted_at timestamptz;

comment on column public.channex_booking.ota_inserted_at is
    'Eingang der ERSTEN Booking Revision bei Channex (raw->>inserted_at, UTC). '
    'Write-once: spätere Revisionen lassen den Wert unverändert.';

-- Write-once. Der Import fährt upsert() und schickt bei jeder Revision den
-- aktuellen inserted_at mit — ohne diesen Trigger würde der Erstwert bei der
-- ersten Änderung verloren gehen (Wurzel 1: der alte Zustand muss mitgepflegt
-- werden). coalesce(old, new) hält ihn fest und lässt ihn nachtragen, falls er
-- beim Anlegen noch fehlte.
create or replace function public.channex_booking_ota_zeit_festhalten()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    new.ota_inserted_at := coalesce(old.ota_inserted_at, new.ota_inserted_at);
    return new;
end;
$$;

revoke execute on function public.channex_booking_ota_zeit_festhalten()
    from anon, authenticated;

drop trigger if exists channex_booking_ota_zeit_festhalten on public.channex_booking;
create trigger channex_booking_ota_zeit_festhalten
    before update on public.channex_booking
    for each row
    execute function public.channex_booking_ota_zeit_festhalten();

-- Bestand nachziehen: bei Zeilen mit status='new' ist raw->>'inserted_at' noch
-- die Erstrevision. Bei bereits geänderten/stornierten Zeilen ist es die letzte
-- bekannte Revision — trotzdem eine Angabe der Gegenseite und damit näher an der
-- Wahrheit als unsere Importuhr. Zeilen ganz ohne raw (Altbestand vor dem
-- Rohdaten-Feld) bleiben NULL; die Oberfläche fällt dort sichtbar auf den
-- Importzeitpunkt zurück, statt eine Uhrzeit zu erfinden (Wurzel 4).
-- Channex schickt den Zeitstempel OHNE Zonen-Suffix ("2026-08-01T11:47:16.13"),
-- gemeint ist UTC (live gegengeprüft: deckungsgleich mit unserem created_at in
-- UTC, Differenz ~1 s Importlaufzeit). Ohne explizites 'Z' würde Postgres die
-- Zeitzone der Sitzung annehmen — auf einem anders eingestellten Server wären
-- das stumme Stundensprünge.
update public.channex_booking
   set ota_inserted_at = case
         when (raw->>'inserted_at') ~ '(Z|[+-][0-9]{2}:?[0-9]{2})$'
             then (raw->>'inserted_at')::timestamptz
             else ((raw->>'inserted_at') || 'Z')::timestamptz
       end
 where ota_inserted_at is null
   and raw ? 'inserted_at'
   and (raw->>'inserted_at') <> '';
