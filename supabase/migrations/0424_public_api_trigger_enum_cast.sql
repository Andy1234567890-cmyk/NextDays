-- 0424 — Die Ereignis-Trigger der öffentlichen API blockierten JEDES Update.
--
-- LIVE GEMESSEN am 23.08.2026, beide gegen die Kundendatenbank bewiesen:
--   update public.tasks set status = 'accepted' where id = …;
--   ERROR:  invalid input value for enum public.task_status: ""
--   update public.reservations set num_guests = num_guests where id = …;
--   ERROR:  invalid input value for enum public.reservation_status: ""
--
-- Beide Trigger aus 0418 verglichen den alten Status so:
--     coalesce(old.status, '') <> 'done'
-- `old.status` ist ein ENUM (`task_status` bzw. `reservation_status`); der
-- Leerstring ist darin kein gültiger Wert. Postgres castet den zweiten
-- coalesce-Parameter auf den Typ des ersten und wirft, sobald der Zweig
-- ausgewertet wird. Da `elsif` immer ausgewertet wird, sobald `tg_op` nicht
-- INSERT ist, traf es AUSNAHMSLOS jedes UPDATE.
--
-- WAS DAS IM BETRIEB HIESS:
--   * tasks:        kein Statuswechsel, kein Abschließen, kein Zuweisen, kein
--                   Umhängen. Live gemeldet als „ich kann Aufgaben nicht
--                   bearbeiten oder abschließen in der App" — es sah nach einem
--                   App-Fehler aus, weil die Oberfläche den Fehler verschluckte.
--   * reservations: keine Buchungsänderung. Verschieben, Gästezahl, Notiz,
--                   Check-in — alles brach ab.
-- Der INSERT-Pfad war nie betroffen (`tg_op = 'INSERT'` greift zuerst), neue
-- Buchungen und Aufgaben entstanden also weiter. Genau deshalb fiel es nicht
-- sofort auf: das System sah lebendig aus.
--
-- WARUM `coalesce` ENTFÄLLT UND NICHT NUR GECASTET WIRD:
-- Beide Spalten sind `not null` (verifiziert über information_schema,
-- is_nullable = NO), und in einem UPDATE-Trigger ist `old` immer belegt. Es gab
-- nie einen NULL-Fall abzufangen. Ein `coalesce(old.status::text, '')` würde
-- laufen, aber eine Absicherung vortäuschen, für die es keine Bedingung gibt.
--
-- SONST IST NICHTS GEÄNDERT. Die Rümpfe unten sind die LAUFENDEN Fassungen aus
-- `pg_proc` (nicht aus 0418 abgeschrieben — dort fehlten inzwischen ergänzte
-- Payload-Felder wie `unit_id`, die ein Abschreiben still verloren hätte).
-- Gegenüber dem laufenden Stand unterscheidet sich je Trigger GENAU EINE Zeile:
-- der Vergleich oben. Ereignis-Logik, Payload und Kommentare sind unberührt.

create or replace function public.public_api_trg_tasks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
 declare
     v_event text;
 begin
     if tg_op = 'INSERT' then
         v_event := 'task.created';
     elsif new.status = 'done' and old.status <> 'done' then
         v_event := 'task.completed';
     else
         -- Andere Änderungen an einer Aufgabe haben (noch) kein Ereignis. Es
         -- eines der beiden vorhandenen unterzuschieben wäre schlimmer als
         -- keines: der Empfänger würde eine verschobene Fälligkeit als
         -- „erledigt" verbuchen.
         return new;
     end if;
     perform public.public_api_ereignis(
         new.tenant_id,
         v_event,
         new.property_id,
         jsonb_build_object(
             'task_id', new.id,
             'property_id', new.property_id,
             'reservation_id', new.reservation_id,
             'title', new.title,
             'status', new.status,
             'assignee_id', new.assignee_id,
             'due_at', new.due_at
         )
     );
     return new;
 end;
$$;

create or replace function public.public_api_trg_reservations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
 declare
     v_event text;
 begin
     if tg_op = 'INSERT' then
         v_event := 'reservation.created';
     elsif new.status = 'cancelled' and old.status <> 'cancelled' then
         -- Storno ist ein EIGENES Ereignis, nicht „updated". Ein Empfänger, der
         -- eine Reinigung plant, muss darauf anders reagieren als auf eine
         -- geänderte Gästezahl.
         v_event := 'reservation.cancelled';
     else
         v_event := 'reservation.updated';
     end if;

     perform public.public_api_ereignis(
         new.tenant_id,
         v_event,
         new.property_id,
         jsonb_build_object(
             'reservation_id', new.id,
             'property_id', new.property_id,
             'unit_id', new.unit_id,
             'status', new.status,
             'channel', new.channel,
             'check_in', new.check_in,
             'check_out', new.check_out,
             -- Der Zeitpunkt der Buchung DES GASTES, aus der Quelle. Kann NULL
             -- sein; dann weiß der Empfänger, dass wir ihn nicht kennen. NIE
             -- durch `created_at` ersetzen — unsere Uhr ist nicht der Zeitpunkt
             -- einer fremden Handlung (Wurzel 5b).
             'booked_at', new.booked_at,
             'received_at', new.created_at
         )
     );
     return new;
 end;
$$;

-- Wie in 0418: die Trigger-Funktionen sind nicht für Clients.
revoke execute on function public.public_api_trg_tasks() from anon, authenticated;
revoke execute on function public.public_api_trg_reservations() from anon, authenticated;
