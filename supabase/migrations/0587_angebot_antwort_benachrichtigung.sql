-- 0587 — Benachrichtigungs-Kategorie „Antwort auf ein Buchungsangebot" (0586)
--
-- Der Gast sagt zu oder ab (Lastenheft §2.2, Migration 0586). Bisher gab es
-- dafür keinen Kanal: die Leitung hätte die Zusage erst gesehen, wenn die
-- Buchung im Kalender steht — oder bei einer Absage gar nicht und weiter auf
-- Antwort gewartet.
--
-- WARUM DAS DRINGT: Zwischen Zusage und Zahlung liegen Minuten bis Stunden, in
-- denen der Zeitraum noch frei verkäuflich ist. Das Angebot reserviert nichts
-- (0586, dieselbe Entscheidung wie bei der Buchungsabsicht 0409). Wer in
-- diesem Fenster dieselben Nächte anderweitig verkauft, nimmt dem zahlenden
-- Gast die Buchung weg — er bekommt sein Geld zurück, aber der Ärger bleibt.
--
-- KANÄLE: E-Mail und SMS. SMS ist hier ausnahmsweise richtig (sonst
-- `anfrage_offen` vorbehalten), weil genau dieses Zeitfenster kurz ist und der
-- Betrieb in ihm NICHTS tun soll. Die Glocke läuft immer mit (Kanal.INAPP hat
-- keine Spalte).
--
-- E-MAIL NICHT PFLICHT: Nichtstun ist hier keine Entscheidung mit Geldfolge —
-- die Zusage führt von selbst weiter (Zahlung → Buchung entsteht über den
-- bestehenden Webhook-Pfad). Anders als bei `anfrage_offen`, wo Airbnb nach
-- Fristablauf selbst ablehnt, verfällt hier nichts unbemerkt.
--
-- VORGABE TRUE für beide: wer ein Angebot verschickt, wartet auf die Antwort.
-- Ein stiller Vorgabewert wäre die falsche Richtung.
--
-- Die Kategorie steht in `notification_settings/katalog.py` als
-- `Kategorie("angebot_antwort", Tab.KONTO, "aktivitaet", _MAIL_SMS)`;
-- `test_katalog_deckt_migration_exakt_ab` hält Katalog und Spalten
-- deckungsgleich — genau dieser Test hat die fehlende Migration gefunden.

alter table public.notification_settings
    add column if not exists angebot_antwort_email boolean not null default true,
    add column if not exists angebot_antwort_sms boolean not null default true;

comment on column public.notification_settings.angebot_antwort_email is
    'Der Gast hat ein Buchungsangebot angenommen oder abgelehnt (0586/0587). '
    'Abwählbar: der Zustand steht in der Angebotsliste, die live aktualisiert.';
comment on column public.notification_settings.angebot_antwort_sms is
    'Dieselbe Meldung als SMS — das Fenster zwischen Zusage und Zahlung ist '
    'kurz, und in ihm soll der Zeitraum nicht anderweitig verkauft werden.';
