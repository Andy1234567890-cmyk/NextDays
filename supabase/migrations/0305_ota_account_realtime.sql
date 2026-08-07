-- `ota_account` in die Realtime-Publikation aufnehmen (0304).
--
-- Die Kontoliste lud bisher nur beim Öffnen des Panels. Beim Verbinden eines
-- Kontos läuft der Kunde aber ZU AIRBNB und kommt zurück — der Zustand ändert
-- sich also, während das Panel offen steht. Ohne Abo bleibt dort der alte
-- Stand, und der Betrieb hält eine gelungene Autorisierung für gescheitert
-- (oder umgekehrt).
--
-- Beide Bedingungen aus CLAUDE.md sind damit erfüllt: `select` für
-- `authenticated` besteht bereits (0304 vergibt es, RLS entscheidet dann über
-- die Zeilen), die Mitgliedschaft in der Publikation kommt hier dazu. Fehlt
-- eines von beidem, ist das Abo eine stumme Attrappe.
--
-- Kein Widerspruch zur Wurzel-6-Sperre: `ota_account` ist keine Finanztabelle.
-- Sie trägt Portal-Kennung, Anzeigename und Verbindungszustand — Angaben, die
-- der Betrieb ohnehin in seinem Kanalmanager sieht. Geschrieben wird weiterhin
-- ausschließlich serverseitig (0304 entzieht insert/update/delete).

do $$
begin
    if not exists (
        select 1 from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = 'ota_account'
    ) then
        alter publication supabase_realtime add table public.ota_account;
    end if;
end
$$;

-- Realtime liefert bei UPDATE nur die geänderten Spalten, solange keine
-- REPLICA IDENTITY gesetzt ist. Die Kontoliste braucht die ganze Zeile (Name,
-- Kennung, Zustand) — ohne FULL käme ein Ereignis ohne die Felder an, die
-- angezeigt werden sollen.
alter table public.ota_account replica identity full;
