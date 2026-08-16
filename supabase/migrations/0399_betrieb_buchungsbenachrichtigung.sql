-- 0399 — Buchungsmeldung an den BETRIEB (eigene Kategorie `betrieb_buchung`)
--
-- Muster: 0331. Der Katalog in notification_settings/katalog.py ist die EINE
-- Quelle der Wahrheit; die Spalten hier folgen strikt `<schluessel>_<kanal>`.
-- Ohne sie liefe `soll_senden` fuer die neue Kategorie ins Leere.
--
-- WARUM NICHT `owner_booking` MITBENUTZEN — derselbe Grund wie in 0331, der
-- EMPFAENGER: `owner_booking` geht an die Eigentuemer des betroffenen Objekts,
-- `betrieb_buchung` an die Betriebsleitung (admin/co_admin), die alle Objekte
-- fuehrt. Bis hierher kannte `melde_buchungs_ereignis` nur den ersten Kreis
-- (`eigentuemer_nutzer_ids`) — ein Property-Manager, der nicht zufaellig auch
-- als Eigentuemer eingetragen war, erfuhr von einer neuen Portal-Buchung
-- ueberhaupt nichts. Bei einem selbst verwalteten Betrieb ohne hinterlegte
-- Eigentuemer fiel die Meldung sogar komplett aus.
--
-- email_pflicht (im Katalog-Code, nicht in der DB): NEIN — und das ist der
-- Unterschied zu `owner_booking`. Fuer den Eigentuemer ist die Buchung an
-- seinem Objekt die vertragliche Kerninformation, fuer den Betrieb ist sie
-- Tagesgeschaeft. Wer 200 Buchungen im Monat hat, muss den Mail-Kanal
-- abwaehlen duerfen; die Glocke bleibt ohnehin an (Kanal INAPP ist nicht
-- abwaehlbar) und ist hier der eigentliche Zweck.
--
-- Default fuer SMS `false`: eine SMS je Buchung waere bei diesem Volumen eine
-- Kostenfalle, die niemand bestellt hat.

alter table public.notification_settings
    add column if not exists betrieb_buchung_email boolean not null default true,
    add column if not exists betrieb_buchung_sms   boolean not null default false;

comment on column public.notification_settings.betrieb_buchung_email is
    'Betriebs-Benachrichtigung bei Buchung/Aenderung/Storno an einem beliebigen '
    'Objekt des Mandanten (0399). Empfaenger: admin/co_admin. Abwaehlbar — '
    'anders als owner_booking, das die vertragliche Kerninformation des '
    'Eigentuemers ist.';
comment on column public.notification_settings.betrieb_buchung_sms is
    'SMS-Kanal derselben Kategorie (0399). Default aus: bei hohem '
    'Buchungsvolumen sonst eine Kostenfalle.';
