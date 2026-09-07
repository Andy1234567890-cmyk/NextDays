-- 0606 — Gästezahl am Sperrantrag (Eigentümer-Aufenthalt).
--
-- WARUM: Die Eigentümer-App bucht den eigenen Aufenthalt wie eine Buchung
-- (Objekt · Zeitraum · Gäste · Notizen, Vorlage Hostaway Owner App,
-- 07.09.2026). Die Verwaltung braucht die Personenzahl für Bettwäsche,
-- Reinigungsumfang und Meldeschein — bisher stand sie, wenn überhaupt, als
-- Freitext in `reason` und war weder filterbar noch für die Reinigungsregel
-- lesbar.
--
-- NULL heißt „nicht angegeben" (Altbestand und Web-Portal, das das Feld noch
-- nicht führt) — keine erfundene 1 (Wurzel 4).
alter table public.block_requests
    add column if not exists gaeste smallint
        check (gaeste is null or (gaeste between 1 and 50));

comment on column public.block_requests.gaeste is
    'Personenzahl des Eigentümer-Aufenthalts; NULL = nicht angegeben.';
