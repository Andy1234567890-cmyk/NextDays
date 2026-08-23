-- 0424 — site_media: den BEFORE-UPDATE-Trigger entfernen (latenter Crash).
--
-- 0422 legte `set_updated_at_site_media` auf `public.site_media` — die Tabelle
-- hat aber KEINE Spalte `updated_at`. Die Triggerfunktion setzt
-- `new.updated_at = now()`, also scheitert JEDES künftige UPDATE mit
--   record "new" has no field "updated_at"
--
-- Aktuell latent, weil der Service nur INSERT und DELETE macht. Genau das macht
-- es gefährlich: der erste, der ein Feld dieser Tabelle aktualisieren will
-- (etwa einen Anzeigenamen), bekommt einen Fehler, dessen Ursache eine
-- Migration von heute ist.
--
-- Entfernen statt Spalte nachziehen: ein Bild wird hochgeladen und gelöscht,
-- nicht bearbeitet. Eine `updated_at`-Spalte, die nie einen anderen Wert als
-- `created_at` trägt, wäre toter Ballast.
--
-- Zusätzlich: 0422 verwendete `create trigger` ohne Existenzprüfung und war
-- damit nicht wiederholbar. Hier wird das `drop` idempotent geschrieben.
drop trigger if exists set_updated_at_site_media on public.site_media;

-- Restriktive Schreib-Policy wie bei den Schwestertabellen (0224/0337).
--
-- `site_media` hatte als einzige Tabelle des Slices nur die permissive
-- tenant-Policy. Heute unschädlich, weil `insert/update/delete` für
-- anon/authenticated ohnehin entzogen sind — aber sobald jemand ein Grant
-- nachzieht, wäre der Direktpfad offen. Der Riegel gehört zur Tabelle, nicht
-- zum Zufall, dass gerade kein Grant existiert (Wurzel 6).
drop policy if exists site_media_write_restrict on public.site_media;
create policy site_media_write_restrict on public.site_media
    as restrictive
    for all
    to anon, authenticated
    using (false)
    with check (false);

comment on policy site_media_write_restrict on public.site_media is
    'Schreiben ausschließlich über die API (service_role). Restriktiv, damit ein '
    'später nachgezogenes Tabellen-GRANT den Direktpfad nicht öffnet.';
