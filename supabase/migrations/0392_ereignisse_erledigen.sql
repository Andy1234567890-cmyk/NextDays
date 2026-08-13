-- 0392_ereignisse_erledigen.sql — Fehler-Ereignisse abhaken können
--
-- DER BEFUND (13.08.2026): `channex_webhook_event.resolved` existiert seit
-- Anbeginn, wird aber NIRGENDS gesetzt — bei allen 603 Ereignissen steht `false`.
-- Die Backoffice-Liste zeigt deshalb 18 Fehler dauerhaft als „Eingriff nötig",
-- obwohl live geprüft alle Booking-Kanäle wieder aktiv sind (`is_active: true`).
--
-- Warum das schadet und nicht nur unordentlich ist: Eine Warnung, die nie
-- verschwindet, wird zur Tapete. Wenn 18 alte Einträge dauerhaft rot stehen,
-- übersieht man den einen, der heute wirklich zählt — ein getrenntes Inserat
-- verkauft dann tagelang nichts, und die Seite sah schon vorher so aus.
--
-- Der Worker-Verlauf (`worker_ereignis`, 0379) hat dasselbe Problem, nur noch
-- gar keine Spalten dafür: Ein fehlgeschlagener Job bleibt für immer als Fehler
-- stehen, auch wenn der nächste Lauf längst durchlief.

-- --------------------------------------------------------------------------
-- worker_ereignis: dieselben vier Spalten wie beim Webhook-Verlauf
-- --------------------------------------------------------------------------
--
-- Bewusst dieselben Namen wie in `channex_webhook_event` (0378/0379): zwei
-- Monitore, dieselbe Geste, dieselbe Form. Wer den einen kennt, versteht den
-- anderen ohne nachzusehen.
alter table public.worker_ereignis
    add column if not exists resolved boolean not null default false,
    -- Was der Mensch beim Abhaken notiert hat („Kanal wieder verbunden").
    -- `jsonb` wie in `channex_webhook_event` (0378) und NICHT `text`: dort
    -- steht bereits eine strukturierte Notiz, und zwei Monitore mit derselben
    -- Geste sollen nicht zwei Datentypen haben — sonst braucht jede Auswertung
    -- zwei Wege. NULL heisst „ohne Notiz erledigt", kein Platzhalter.
    add column if not exists resolution jsonb,
    add column if not exists resolved_at timestamptz,
    -- Wer abgehakt hat. `auth.users`-Verweis bewusst OHNE Fremdschlüssel: der
    -- Verlauf ist ein Protokoll und darf einen gelöschten Nutzer überleben,
    -- statt die Zeile mitzureissen.
    add column if not exists resolved_by uuid;

comment on column public.worker_ereignis.resolved is
    'Vom Menschen abgehakt. Ein Fehler bleibt sonst für immer als offen stehen, '
    'auch wenn der nächste Lauf längst durchlief — und dauerhafte Warnungen '
    'werden übersehen.';

-- Die Liste fragt genau eine Sache: „welche Fehler sind noch offen?".
-- Teilindex, weil nur diese Kombination gesucht wird.
create index if not exists worker_ereignis_offen_idx
    on public.worker_ereignis (erfasst_at desc)
    where ergebnis = 'fehler' and not resolved;

-- --------------------------------------------------------------------------
-- channex_webhook_event: fehlender Index für dieselbe Frage
-- --------------------------------------------------------------------------
--
-- Die Spalten sind da (0378), der Index für „offene Fehler, gesamt" fehlte —
-- die Kachel zählt zeitfenster-UNABHÄNGIG über die ganze Tabelle.
create index if not exists channex_webhook_event_offen_idx
    on public.channex_webhook_event (created_at desc)
    where severity = 'error' and not resolved;

-- --------------------------------------------------------------------------
-- Wurzel 6: geschrieben wird NUR vom Server
-- --------------------------------------------------------------------------
--
-- Beide Tabellen sind für anon/authenticated ohnehin schreibgesperrt (0224,
-- 0337) und tragen restriktive Policies. Das Abhaken läuft über den
-- FastAPI-Endpunkt mit `platform_admin`-Prüfung und der Service-Role — es gibt
-- bewusst KEINEN Client-Pfad, der `resolved` direkt setzen könnte.
-- Hier steht deshalb kein neues Grant; die vorhandene Sperre gilt weiter.
