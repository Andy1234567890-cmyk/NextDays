-- 0542 — Benachrichtigungs-Kategorien des Personalbereichs (Slice `personal`)
--
-- Eigene Datei, weil `test_katalog_deckt_migration_exakt_ab` jede hier
-- gelistete Migration nach bool-Spalten durchsucht — die Personal-Tabellen in
-- 0541 tragen eigene Booleans (halbtag_start, ganztags, aktiv), die keine
-- Benachrichtigungs-Spalten sind.
--
-- Fünf Kategorien, je Empfänger eine — dieselbe Regel wie bei Aufgaben und
-- Sperranträgen: wer eine Meldung abschaltet, darf damit keine fremde
-- mit-abschalten.
--   dienstplan               → Mitarbeitende: Plan veröffentlicht/geändert
--   abwesenheit_antrag       → Leitung: Antrag eingegangen
--   abwesenheit_entscheidung → Antragsteller: genehmigt/abgelehnt
--   schicht_offen            → passende Mitarbeitende: offene Schicht
--   zeit_hinweis             → Leitung: Stempelung fehlt/auffällig
alter table public.notification_settings
    add column if not exists dienstplan_email boolean not null default true,
    add column if not exists dienstplan_push boolean not null default true,
    add column if not exists abwesenheit_antrag_email boolean not null default true,
    add column if not exists abwesenheit_antrag_push boolean not null default true,
    add column if not exists abwesenheit_entscheidung_email boolean not null default true,
    add column if not exists abwesenheit_entscheidung_push boolean not null default true,
    add column if not exists schicht_offen_email boolean not null default true,
    add column if not exists schicht_offen_push boolean not null default true,
    add column if not exists zeit_hinweis_email boolean not null default true;

