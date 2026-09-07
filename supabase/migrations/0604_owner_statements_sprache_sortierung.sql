-- 0604 — Sprache des Belegs und Sortierung der Buchungszeilen.
--
-- ═══ TEIL 1: Sprache (Etappe 13.5) ═══
--
-- WARUM: Der Beleg (`statement-pdf.ts`) war hart deutsch, und Zahlen/Datum
-- folgten der Oberflächensprache des BETRACHTERS (`useLocale()`). René Dahl
-- Nielsen hat `owners.language = 'da'` (0335) und bekam trotzdem eine deutsche
-- „Eigentümer-Abrechnung" — die Mitarbeiterin, die sie erzeugte, arbeitet auf
-- Deutsch. Der Beleg ist aber das Dokument des EIGENTÜMERS, nicht der
-- Mitarbeiterin.
--
-- SNAPSHOT, nicht Verweis: die Sprache wird beim Erzeugen über die bestehende
-- Kette `core.mail_sprache.aufloesen(owner.language, tenant.default_language)`
-- bestimmt (dieselbe Regel wie jede Mail; letzte Stufe Englisch) und hier
-- eingefroren. Wechselt der Eigentümer später die Sprache, bleibt ein
-- finalisierter Beleg in der Sprache, in der er ausgestellt wurde — bei
-- fortlaufender Nummer (§14 UStG) ist das Dokument unveränderlich, auch
-- sprachlich. Im Entwurf per PATCH änderbar.
--
-- NULL = Abrechnung von vor 0604. Der Lesepfad löst dann die Kette zur
-- Laufzeit auf — erfindet also kein Deutsch (Wurzel 4).

alter table public.owner_statements
    add column if not exists language text;

comment on column public.owner_statements.language is
    '0604: Sprache des Belegs (ISO 639-1, wie owners.language). Snapshot beim '
    'Erzeugen über core.mail_sprache.aufloesen(owner, tenant) → en. Im Entwurf '
    'änderbar, finalisiert eingefroren. NULL = vor 0604, Kette greift beim Lesen.';

-- ═══ TEIL 2: Sortierung (Etappe 13.6) ═══
--
-- WARUM: Vorschau und Beleg zeigten die Zeilen in Ladereihenfolge
-- (`.order("id")`) — praktisch zufällig. Wer nach Anreise oder nach Objekt
-- lesen will, konnte es nicht, und Vorschau und PDF hätten bei einer rein
-- clientseitigen Sortierung auseinanderlaufen können. Die Sortierung gehört
-- deshalb an die ABRECHNUNG, nicht an den Bildschirm: einmal gespeichert,
-- sortiert der Server für Vorschau und Beleg gleich.
--
-- CHECK statt Enum: die Menge ist klein und ändert sich mit der Tabelle, nicht
-- mit dem Datenmodell. Die Namen sind die Spalten der Buchungstabelle.

alter table public.owner_statements
    add column if not exists sort_key text not null default 'check_in';

alter table public.owner_statements
    add column if not exists sort_dir text not null default 'asc';

alter table public.owner_statements
    drop constraint if exists owner_statements_sort_key_check;

alter table public.owner_statements
    add constraint owner_statements_sort_key_check
    check (sort_key in (
        'check_in', 'check_out', 'property', 'guest', 'channel',
        'gross', 'owner_payout'
    ));

alter table public.owner_statements
    drop constraint if exists owner_statements_sort_dir_check;

alter table public.owner_statements
    add constraint owner_statements_sort_dir_check
    check (sort_dir in ('asc', 'desc'));

comment on column public.owner_statements.sort_key is
    '0604: Sortierspalte der Buchungszeilen — gilt für Vorschau UND Beleg. '
    'Werte = Spalten der Buchungstabelle (Pydantic SortKey deckungsgleich).';

comment on column public.owner_statements.sort_dir is
    '0604: Sortierrichtung asc|desc.';

-- Kein Grant-/RLS-Teil: `owner_statements` ist über 0187 für anon/authenticated
-- vollständig gesperrt (Wurzel 6).
