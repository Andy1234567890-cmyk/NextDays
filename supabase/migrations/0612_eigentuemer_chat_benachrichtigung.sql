-- 0612 — Benachrichtigungs-Kategorien für den Eigentümer-Chat (0611, ADR-0029)
--
-- ZWEI Kategorien, nicht eine, weil sie an verschiedene APPS gehen — dieselbe
-- Begründung wie bei `block_request`/`block_decision`:
--   * `owner_chat`   → an den EIGENTÜMER, dass die Verwaltung geschrieben hat
--                      (Push in die Eigentümer-App, `push_app=mynextdaysowner`)
--   * `betrieb_chat` → an den BETRIEB, dass der Eigentümer geschrieben hat
--                      (Push in die Verwaltungs-App)
-- Eine gemeinsame Kategorie ließe sich nur für beide Richtungen zugleich
-- abschalten: wer die Meldungen über eingehende Eigentümerfragen nicht mehr
-- will, verlöre auch die Antworten auf seine eigenen.
--
-- KANÄLE: E-Mail und Push, KEINE SMS. Der Inhalt ist Ende-zu-Ende
-- verschlüsselt (ADR-0029) — der Server kennt ihn nicht. Eine Meldung kann
-- deshalb nur sagen, DASS jemand geschrieben hat, nie WAS. Dafür ist eine SMS
-- zu teuer und zu aufdringlich. Die Glocke läuft immer mit (Kanal.INAPP hat
-- keine Spalte).
--
-- E-MAIL NICHT PFLICHT: Anders als bei `owner_booking` (Buchung am eigenen
-- Objekt = vertragliche Kerninformation) ist eine Chat-Nachricht eine
-- Absprache. Wer täglich schreibt, darf den Mail-Kanal abwählen — die Glocke
-- bleibt ohnehin an, und eine Mail ohne Inhalt ist ein Klick-Anreiz, keine
-- Information.
--
-- VORGABE TRUE für alle vier: Ein Chat, dessen Nachrichten niemanden
-- erreichen, ist kein Chat. Wer eine Frage stellt, wartet auf Antwort.
--
-- Die Kategorien stehen in `notification_settings/katalog.py`;
-- `test_katalog_deckt_migration_exakt_ab` hält Katalog und Spalten
-- deckungsgleich — genau dieser Test hat diese Migration eingefordert.
alter table public.notification_settings
    add column if not exists owner_chat_email boolean not null default true,
    add column if not exists owner_chat_push boolean not null default true,
    add column if not exists betrieb_chat_email boolean not null default true,
    add column if not exists betrieb_chat_push boolean not null default true;

comment on column public.notification_settings.owner_chat_email is
  'Eigentümer-Chat (0611): Mail an den EIGENTÜMER, wenn die Verwaltung '
  'schreibt. Ohne Inhalt — die Nachricht ist Ende-zu-Ende verschlüsselt.';
comment on column public.notification_settings.betrieb_chat_email is
  'Eigentümer-Chat (0611): Mail an den BETRIEB, wenn der Eigentümer schreibt. '
  'Ohne Inhalt — die Nachricht ist Ende-zu-Ende verschlüsselt.';
