-- Glocken-Meldung mit Bezug auf eine Posteingang-Konversation (0406).
--
-- WOZU: Neue Gastnachrichten sollen in der Glocke erscheinen (Kategorie
-- `messages`, seit jeher im Katalog, aber bis heute ohne Ausloeser). Sobald der
-- Betrieb den Thread im Posteingang liest, muss die zugehoerige Meldung
-- verschwinden — sonst leuchtet die Glocke fuer etwas, das laengst erledigt
-- ist, und der Nutzer lernt, sie zu ignorieren.
--
-- WARUM EINE EIGENE SPALTE UND NICHT `ziel_pfad`:
-- Der Bezug liesse sich aus `ziel_pfad` (`/posteingang/<thread>`) oder aus
-- `dedup_key` herauslesen. Beides waere eine Textsuche auf einer nicht
-- indizierten Spalte, ausgefuehrt bei JEDEM Als-gelesen-Markieren, und beide
-- Felder haben einen anderen Zweck: `ziel_pfad` ist ein Anzeige-Detail (wohin
-- der Klick fuehrt) und `dedup_key` regelt Doppelmeldungen. Einen fachlichen
-- Fremdschluessel aus einem Anzeige-String zu rekonstruieren ist genau die Art
-- verstecktes Wissen, die beim naechsten Pfad-Umbau still bricht.
--
-- WARUM KEIN ECHTER FOREIGN KEY:
-- Ein Thread IST eine Zeile in `channex_booking` — aber nur, solange die
-- Buchung existiert. Threads werden ueber `inbox_status='deleted'` weich
-- geloescht, und der Bezug soll die Meldung nicht mitreissen. Wichtiger: die
-- Meldung ist eine Momentaufnahme („Gast X hat geschrieben"); sie bleibt
-- korrekt, auch wenn der Thread spaeter verschwindet. Ein `on delete cascade`
-- wuerde Historie loeschen, ein `restrict` das Aufraeumen blockieren. Deshalb
-- ein loser Verweis, wie `thread_ref` in `portal_messages` (0293) — dort aus
-- demselben Grund.
--
-- KEINE NEUEN GRANTS (Wurzel 6): `notifications` traegt bereits genau ein Recht
-- fuer `authenticated` — `select`, begrenzt durch die Policy auf die EIGENEN
-- Meldungen (0287). Geschrieben wird ausschliesslich vom Server. Eine neue
-- Spalte aendert daran nichts und darf es nicht: `thread_ref` verraet, mit wem
-- ein Betrieb im Gespraech ist.

alter table public.notifications
    add column if not exists thread_ref text;

comment on column public.notifications.thread_ref is
    'Lose Referenz auf die Posteingang-Konversation (channex_booking.id), zu '
    'der diese Meldung gehoert. Erlaubt, die Meldung beim Lesen des Threads '
    'stillzulegen. Kein Fremdschluessel: die Meldung ist eine Momentaufnahme '
    'und soll einen geloeschten Thread ueberleben (0406).';

-- Der Zugriffsweg ist immer derselbe: „alle OFFENEN Meldungen dieses Nutzers zu
-- diesem Thread". Partiell auf `gelesen_am is null`, weil gelesene Meldungen
-- nie wieder gesucht werden — der Index bleibt damit klein, auch wenn die
-- Historie waechst.
create index if not exists notifications_thread_offen_idx
    on public.notifications (user_id, thread_ref)
    where thread_ref is not null and gelesen_am is null;
