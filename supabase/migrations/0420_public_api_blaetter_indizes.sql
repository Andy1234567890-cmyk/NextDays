-- 0420_public_api_blaetter_indizes.sql — Indizes für das Cursor-Blättern der
-- öffentlichen API (apps/public-api).
--
-- WARUM: Die Listen der Partner-API blättern seit dem Umbau über einen Cursor
-- („Keyset"): jede Seite filtert mit `(sortierfeld, id) > (letzter Wert,
-- letzte id)` und sortiert nach genau diesem Paar. Das ist nur dann schnell,
-- wenn ein Index in EXAKT dieser Spaltenfolge existiert. Fehlt er, muss
-- Postgres für JEDE Seite die ganze Treffermenge sortieren — ein Full Scan pro
-- Aufruf, und die öffentliche API wird von Maschinen im Takt gerufen, nicht von
-- Menschen.
--
-- Gegen die Live-Datenbank geprüft (22.08.2026): für keine der fünf
-- Blätter-Sortierungen existierte ein passender Index. Bei den heutigen Größen
-- (43 Objekte, ~300 Buchungen je Betrieb) fällt das nicht auf — genau deshalb
-- entsteht der Index jetzt und nicht erst, wenn der erste Partner mit 4000
-- Buchungen blättert und niemand die Ursache sucht.
--
-- SPALTENFOLGE IST NICHT BELIEBIG: sie MUSS der Sortierung des Endpunkts
-- entsprechen, inklusive Richtung. `tenant_id` steht vorne, weil jede Abfrage
-- der API auf den Mandanten gefiltert ist (Wurzel 3) — ein Index ohne diese
-- erste Spalte hilft nur, wenn es genau einen Betrieb gibt.
--
-- Richtung: Postgres kann einen B-Tree in beide Richtungen lesen, ein Index
-- `(a ASC, b ASC)` deckt also auch `ORDER BY a DESC, b DESC` ab. Was NICHT
-- funktioniert, sind GEMISCHTE Richtungen — deshalb sortiert kein Endpunkt der
-- API gemischt, und die Buchungsliste hat ihren Index bewusst als
-- `(check_in DESC, id DESC)`, damit die Absicht am Index ablesbar bleibt.
--
-- KEIN `concurrently`: der Migrations-Runner fährt das Skript über `psql -f -`
-- mit `ON_ERROR_STOP`, und `create index concurrently` darf nicht in einem
-- Transaktionsblock laufen. Bei diesen Tabellengrößen ist der Aufbau eine
-- Sache von Millisekunden. Sollte eine dieser Tabellen einmal Millionen Zeilen
-- tragen, wird der Index von Hand mit `concurrently` gebaut und hier
-- nachgetragen — nicht in einem Migrationslauf, der die Tabelle sperrt.

-- Objekte: GET /v1/properties, sortiert nach (title, id) aufsteigend.
create index if not exists properties_api_blaettern_idx
    on public.properties (tenant_id, title, id)
    where archived_at is null;

comment on index public.properties_api_blaettern_idx is
  'Cursor-Blaettern der oeffentlichen API (GET /v1/properties). Spaltenfolge = '
  'Sortierung des Endpunkts; archivierte Objekte sind ausgenommen, weil die '
  'API sie nie ausliefert.';

-- Buchungen: GET /v1/reservations, sortiert nach (check_in, id) ABSTEIGEND.
-- Bewusst mit DESC im Index, obwohl ein ASC-Index rückwärts gelesen werden
-- könnte: so ist die Absicht am Index ablesbar, und ein späterer zweiter
-- Sortierweg würde nicht versehentlich denselben Index beanspruchen.
create index if not exists reservations_api_blaettern_idx
    on public.reservations (tenant_id, check_in desc, id desc)
    where archived_at is null;

comment on index public.reservations_api_blaettern_idx is
  'Cursor-Blaettern der oeffentlichen API (GET /v1/reservations, neueste '
  'Anreise zuerst).';

-- Gäste: GET /v1/guests, sortiert nach (name, id) aufsteigend. Anonymisierte
-- Gäste liefert die API nie aus — der Teilindex bleibt damit klein und trifft
-- genau die Abfrage.
create index if not exists guests_api_blaettern_idx
    on public.guests (tenant_id, name, id)
    where anonymized_at is null;

comment on index public.guests_api_blaettern_idx is
  'Cursor-Blaettern der oeffentlichen API (GET /v1/guests). Anonymisierte '
  'Gaeste sind ausgenommen (die API liefert sie nicht aus).';

-- Aufgaben: GET /v1/tasks, sortiert nach (due_at, id) aufsteigend mit NULLS
-- LAST. Die Richtungsangabe `nulls last` gehört IN den Index: ohne sie steht
-- die NULL-Gruppe im Index vorne, die Abfrage will sie hinten, und Postgres
-- sortiert trotz Index nach. Genau die NULL-Gruppe ist der Teil, den das
-- Cursor-Blättern gesondert behandelt (Aufgaben ohne Fälligkeit).
create index if not exists tasks_api_blaettern_idx
    on public.tasks (tenant_id, due_at asc nulls last, id);

comment on index public.tasks_api_blaettern_idx is
  'Cursor-Blaettern der oeffentlichen API (GET /v1/tasks). `nulls last` muss '
  'zur Sortierung des Endpunkts passen, sonst sortiert Postgres trotz Index '
  'nach.';

-- Ereignisse: GET /v1/events, sortiert nach (created_at, id) AUFSTEIGEND
-- (älteste zuerst, damit ein Nachholer sie in Entstehungsreihenfolge
-- verarbeitet). Der vorhandene Index aus 0418 ist `(tenant_id, created_at
-- DESC)` — ohne `id` als zweite Sortierspalte und in der anderen Richtung
-- gedacht. Er bleibt für den Zusteller nützlich; für das Blättern kommt dieser
-- hinzu.
create index if not exists public_api_events_blaettern_idx
    on public.public_api_events (tenant_id, created_at, id);

comment on index public.public_api_events_blaettern_idx is
  'Cursor-Blaettern der oeffentlichen API (GET /v1/events, aelteste zuerst).';

-- Aufräumen der Idempotenz-Zeilen: der Job läuft über `created_at`, und ohne
-- Index wäre das ein Full Scan über eine Tabelle, die je Buchung eine Zeile
-- bekommt. 0418 hat den Index schon angelegt; hier bewusst NICHT doppelt.
