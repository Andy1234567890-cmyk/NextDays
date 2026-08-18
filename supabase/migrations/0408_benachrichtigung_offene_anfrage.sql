-- 0408 — Benachrichtigungs-Kategorie „offene Portal-Anfrage" (0398).
--
-- Muster: 0225/0331. Der Katalog in notification_settings/katalog.py ist die
-- EINE Quelle der Wahrheit; die Spalten hier folgen strikt
-- `<schluessel>_<kanal>`. Ohne sie liefe `soll_senden` für die neue Kategorie
-- ins Leere und die Mail ginge nie raus.
--
-- WOZU EINE EIGENE KATEGORIE UND NICHT `messages` MITBENUTZEN:
-- Weil Nichtstun hier etwas anderes bedeutet. Eine Gastnachricht kann man
-- morgen beantworten. Eine Airbnb-Anfrage LÄUFT AB — das Portal nennt die
-- Frist selbst (`booking_details.non_response_at`, live gemessen: exakt 24
-- Stunden) und lehnt danach in eigener Regie ab. Die versäumte Antwort ist
-- also eine Entscheidung gegen die Buchung, und sie sieht in keiner Liste
-- anders aus als eine gelesene.
--
-- Zusätzlich gibt es Anfragen ganz OHNE Nachricht. Dann meldet die
-- `messages`-Kategorie nichts, und ohne diese Zeile erführe der Betrieb von
-- dem Vorgang überhaupt nichts.
--
-- email_pflicht = JA (im Katalog-Code, nicht in der DB):
-- Wer diese Meldung abschalten könnte, verlöre Buchungen, ohne je zu erfahren,
-- dass es sie gab. Dieselbe Begründung wie bei `owner_booking` in 0331 — nur
-- ist der Verlust hier unbemerkt statt nachträglich sichtbar. SMS bleibt
-- wählbar (Vorgabe aus), weil die Frist knapp sein kann und manche Betriebe
-- genau dafür einen zweiten Kanal wollen.
--
-- Tab „Konto" (Betrieb), Gruppe „aktivitaet": eine operative Meldung, kein
-- Newsletter.

alter table public.notification_settings
    add column if not exists anfrage_offen_email boolean not null default true,
    add column if not exists anfrage_offen_sms   boolean not null default false;

comment on column public.notification_settings.anfrage_offen_email is
    'Meldung über eine offene Portal-Anfrage mit Antwortfrist (0398/0408). '
    'E-Mail NICHT abwählbar: das Portal lehnt nach Fristablauf selbst ab, eine '
    'verpasste Anfrage ist damit eine verlorene Buchung ohne jede Spur.';
comment on column public.notification_settings.anfrage_offen_sms is
    'Zweiter Kanal für dieselbe Meldung (0408). Vorgabe aus; sinnvoll für '
    'Betriebe, die Anfragen außerhalb der Bürozeit beantworten wollen.';
