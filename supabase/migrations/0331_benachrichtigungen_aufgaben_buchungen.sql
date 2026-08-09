-- 0331 — Benachrichtigungs-Kategorien für Aufgaben und Buchungen (Etappe E).
--
-- Muster: 0225. Der Katalog in notification_settings/katalog.py ist die EINE
-- Quelle der Wahrheit; die Spalten hier folgen strikt `<schluessel>_<kanal>`.
-- Ohne diese Spalten liefe `soll_senden` für die neuen Kategorien ins Leere.
--
-- WARUM DREI NEUE KATEGORIEN UND NICHT `listing_activity` MITBENUTZEN:
-- Die Empfänger sind verschieden. `task_assigned` geht an einen MITARBEITER
-- („du bist dran"), `owner_booking` und `owner_service` an den EIGENTÜMER. Ein
-- Reinigungskraft-Handy, das bei jeder Buchung eines fremden Objekts SMS
-- bekommt, wäre der Fehler — und ein Eigentümer, der die Aufgaben-Mails nicht
-- abschalten kann, ohne auch seine Buchungsmeldungen zu verlieren, ebenso.
--
-- Tab „Konto" (Betrieb), nicht „Angebote" (Marketing): das sind operative
-- Meldungen, kein Newsletter.
--
-- email_pflicht (im Katalog-Code, nicht in der DB):
--   * owner_booking = JA. Buchung/Änderung/Storno am eigenen Objekt ist die
--     vertragliche Kerninformation des Eigentümers — er darf sie nicht
--     stillschweigend abschalten können (wie guest_policies in 0225).
--   * task_assigned und owner_service = NEIN. Wer täglich Aufträge bekommt,
--     muss den Mail-Kanal abwählen dürfen, ohne den Auftrag zu verlieren —
--     die Glocke bleibt ohnehin an (Kanal INAPP ist nicht abwählbar).

alter table public.notification_settings
    -- Mitarbeiter: „dir wurde eine Aufgabe zugewiesen".
    add column if not exists task_assigned_email boolean not null default true,
    add column if not exists task_assigned_sms   boolean not null default false,
    -- Eigentümer: Buchungseingang / Änderung / Storno am eigenen Objekt.
    add column if not exists owner_booking_email boolean not null default true,
    add column if not exists owner_booking_sms   boolean not null default false,
    -- Eigentümer: Statuswechsel einer von ihm beauftragten Dienstleistung.
    add column if not exists owner_service_email boolean not null default true,
    add column if not exists owner_service_sms   boolean not null default false;

comment on column public.notification_settings.task_assigned_email is
    'Mitarbeiter-Benachrichtigung bei Aufgaben-Zuweisung (0331). Abwählbar — '
    'die Glocke bleibt.';
comment on column public.notification_settings.owner_booking_email is
    'Eigentümer-Benachrichtigung bei Buchung/Änderung/Storno am eigenen Objekt '
    '(0331). E-Mail nicht abwählbar: vertragliche Kerninformation.';
comment on column public.notification_settings.owner_service_email is
    'Eigentümer-Benachrichtigung zum Fortschritt einer beauftragten Leistung '
    '(0331).';

-- == Jahresbericht (Etappe E4) =============================================
-- `owners.statement_frequency` kannte bisher nur 'none'|'monthly' (0063:53).
-- 'yearly' ergänzen, ohne den Bestand anzufassen: der CHECK wird ersetzt, die
-- vorhandenen Werte bleiben gültig (die neue Menge ist eine Obermenge).
alter table public.owners
    drop constraint if exists owners_statement_frequency_check;

alter table public.owners
    add constraint owners_statement_frequency_check
    check (statement_frequency in ('none', 'monthly', 'yearly'));

comment on column public.owners.statement_frequency is
    'Rhythmus der automatischen Abrechnung: none | monthly | yearly (0331). '
    'Der Auto-Run erzeugt je Rhythmus genau ein Statement pro Zeitraum.';
