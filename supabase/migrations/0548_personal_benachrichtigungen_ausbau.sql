-- 0548 — Benachrichtigungs-Kategorien des Personal-Ausbaus (0544–0547)
--
-- Eigene Datei wie 0542, weil `test_katalog_deckt_migration_exakt_ab` jede hier
-- gelistete Migration nach bool-Spalten durchsucht.
--
-- Vier Kategorien, je Empfänger eine:
--   schicht_tausch            → angefragte Person: Kollegin bietet Tausch an;
--                               Leitung: Tausch angenommen, Freigabe nötig
--   ueberstunden_antrag       → Leitung: Überstundenantrag eingegangen
--   ueberstunden_entscheidung → Antragsteller: genehmigt/abgelehnt
--   verspaetung               → Leitung: Schicht begonnen, keine Stempelung
--                               (Regel verspaetung_melden_min). Mail + Push,
--                               weil es JETZT jemanden braucht.
alter table public.notification_settings
    add column if not exists schicht_tausch_email boolean not null default true,
    add column if not exists schicht_tausch_push boolean not null default true,
    add column if not exists ueberstunden_antrag_email boolean not null default true,
    add column if not exists ueberstunden_antrag_push boolean not null default true,
    add column if not exists ueberstunden_entscheidung_email boolean not null default true,
    add column if not exists ueberstunden_entscheidung_push boolean not null default true,
    add column if not exists verspaetung_email boolean not null default true,
    add column if not exists verspaetung_push boolean not null default true;
