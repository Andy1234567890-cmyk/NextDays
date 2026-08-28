-- 0441 — `select` auf site_rules für die angemeldete Rolle
--
-- 0440 hat die Tabelle in die Publikation `supabase_realtime` aufgenommen, aber
-- kein `select` für `authenticated` gesetzt. Gegen die Live-Datenbank geprüft:
-- die Rolle hatte auf `site_rules` ausschließlich `REFERENCES`.
--
-- Damit wäre das Abo eine stumme Attrappe. Genau davor warnt CLAUDE.md: ein
-- Realtime-Abo wirkt nur, wenn BEIDES stimmt — Mitgliedschaft in der
-- Publikation UND `select` auf der Tabelle. Fehlt eines, sieht die Oberfläche
-- live aus und aktualisiert nie, ohne dass irgendwo ein Fehler erscheint.
--
-- Warum `select` hier unbedenklich ist, anders als bei den Finanz-Tabellen:
-- eine Regel beschreibt, was JEDER BESUCHER der Kundenwebsite ohnehin zu sehen
-- bekommt — welches Pop-up wann erscheint, welcher Satz in der Hinweisleiste
-- steht. Es sind keine personenbezogenen Daten und keine Betriebsgeheimnisse.
-- Die tenant-Policy aus 0440 begrenzt das Lesen weiterhin auf den eigenen
-- Betrieb.
--
-- SCHREIBEN BLEIBT ZU. Eine Regel kann `action_type = 'script'` tragen, also
-- ausführbaren Code im Browser jedes Gastes. Der Direktpfad darf ihn nicht
-- setzen können — die restriktiven Policies aus 0440 bleiben unangetastet.
--
-- Und die Lehre aus 0439, hier zum zweiten Mal: eine eingespielte Migration zu
-- ÄNDERN wirkt nicht. Die Korrektur ist immer eine neue Datei.

grant select on public.site_rules to authenticated;

comment on table public.site_rules is
    'Personalisierungs-Regeln einer Kunden-Website: Auslöser × Aktion. '
    'Lesbar für die angemeldete Rolle (Realtime im Dashboard), schreibbar '
    'ausschließlich über die API mit MANAGE_SITE_CONFIG — eine Regel kann '
    'ausführbares JavaScript tragen.';
