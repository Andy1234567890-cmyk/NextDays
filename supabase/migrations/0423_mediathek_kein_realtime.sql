-- 0423 — Mediathek: Realtime-Publikation zurücknehmen (Attrappe vermeiden).
--
-- In 0422 wurde `site_media` in die Publikation `supabase_realtime` aufgenommen.
-- Live gegengeprüft ergab die Rechtelage danach:
--
--   grant anon:          REFERENCES
--   grant authenticated: REFERENCES
--
-- Also KEIN `select`. Ein Abo wirkt aber nur, wenn BEIDES stimmt: `select` für
-- `authenticated` auf der Tabelle UND Mitgliedschaft in der Publikation. Fehlt
-- eines, ist das Abo eine stumme Attrappe — die Oberfläche sieht live aus und
-- aktualisiert nie.
--
-- Die Wahl ist damit: `select` nachgewähren, oder die Publikation entfernen.
-- Entfernen ist hier richtig, denn Realtime bringt der Mediathek nichts:
--   • Der Bestand wird beim Öffnen des Auswahl-Dialogs geladen.
--   • Ein selbst hochgeladenes Bild ergänzt die Oberfläche sofort aus der
--     Antwort des Upload-Aufrufs — dafür braucht es kein Abo.
--   • Der einzige Fall, den ein Abo abdecken würde, ist „derselbe Betrieb lädt
--     in einem zweiten Tab hoch, während der Dialog hier offen steht". Dafür ein
--     zusätzliches Tabellen-GRANT zu öffnen, ist der schlechtere Tausch.
--
-- Ohne Publikation ist auch nichts vorgetäuscht: es gibt kein Abo im Frontend,
-- das ins Leere läuft.

do $$
begin
    if exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'site_media'
    ) then
        alter publication supabase_realtime drop table public.site_media;
    end if;
end $$;

comment on table public.site_media is
    'Bildbestand des Website-Baukastens je Betrieb (Bucket site-media). '
    'Schreiben nur über die API (service_role); Direktpfad per revoke gesperrt. '
    'BEWUSST KEIN Realtime: ohne select-Grant für authenticated wäre ein Abo eine '
    'stumme Attrappe, und der Bestand wird beim Öffnen des Dialogs geladen (0423).';
