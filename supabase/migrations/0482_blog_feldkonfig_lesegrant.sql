-- 0482 — Nachtrag zu 0481: das fehlende SELECT-Grant fuer `authenticated`.
--
-- WAS SCHIEFGING
-- ==============
-- 0481 legt `site_post_field_config` an, schaltet RLS ein und definiert eine
-- permissive Lese-Policy fuer `authenticated`. Das `grant select` dazu fehlte
-- aber — es ging beim Umbau des RLS-Blocks verloren.
--
-- Eine Policy OHNE Grant ist wirkungslos: PostgreSQL prueft erst das Recht auf
-- der Tabelle, dann die Policy. Ohne Tabellen-Grant kommt der Aufrufer gar
-- nicht bis zur Zeile — die Policy stand da und tat nichts. Genau die
-- Umkehrung des Falls aus CLAUDE.md („Column-REVOKE braucht Table-Grant-
-- Entzug"): dort verhindert ein pauschales Grant, dass ein Spalten-Revoke
-- greift, hier verhindert ein fehlendes Grant, dass eine Policy greift.
--
-- Gemessen an der Live-DB nach dem Einspielen von 0481:
--     grant: anon REFERENCES
--     grant: authenticated REFERENCES        ← kein SELECT
-- gegen die Vergleichstabelle `site_page_translations` (0476):
--     authenticated SELECT                   ← so muss es aussehen
--
-- WARUM EINE NEUE NUMMER UND KEINE KORREKTUR IN 0481
-- ==================================================
-- 0481 ist angewendet und steht in `schema_migrations`. Der Runner laesst eine
-- angewendete Datei nie wieder laufen — eine Korrektur darin waere eine
-- Aenderung, die auf keinem System ankommt, auf dem sie gebraucht wird.

grant select on public.site_post_field_config to authenticated;

-- Schreiben bleibt entzogen. Ausdruecklich wiederholt und nicht „steht ja
-- schon in 0481": ein Grant und ein Revoke auf derselben Tabelle in zwei
-- Dateien liest sich sonst wie ein Widerspruch, und beim naechsten Lesen
-- weiss niemand, welche der beiden gilt. Beide zusammen an einer Stelle
-- sagen, was gemeint ist — lesen ja, schreiben nur ueber den Server
-- (Wurzel 6).
revoke insert, update, delete on public.site_post_field_config
    from anon, authenticated;
