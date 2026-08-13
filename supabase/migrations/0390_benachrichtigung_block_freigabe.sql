-- 0390 — Benachrichtigungs-Einstellung für die Eigentümer-Freigabe (zu 0389).
--
-- Der Katalog (notification_settings/katalog.py) leitet die SPALTENNAMEN aus
-- den Kategorien ab (`{schluessel}_{kanal}`) und liest sie in einem
-- gemeinsamen `select()`. Eine Kategorie ohne ihre Spalten ist deshalb kein
-- fehlendes Häkchen, sondern ein Fehler auf JEDEM Aufruf der
-- Benachrichtigungs-Seite — auch für Nutzer, die mit Familienzugängen nichts
-- zu tun haben.
--
-- Getrennt von 0389, weil das eine andere Tabelle in einem anderen Slice ist:
-- 0389 rückgängig zu machen, ohne die Benachrichtigungs-Seite zu beschädigen,
-- muss möglich bleiben.
--
-- Default true wie bei block_request/block_decision (0332): Wer Zugänge
-- vergeben hat, WILL wissen, dass jemand das Haus möchte — sonst wartet der
-- Antrag stumm, und die Familie hält den Eigentümer für unhöflich. Abwählbar
-- ist es trotzdem; die Glocke bleibt ohnehin an.

alter table public.notification_settings
    add column if not exists block_freigabe_email boolean not null default true,
    add column if not exists block_freigabe_sms boolean not null default false;

comment on column public.notification_settings.block_freigabe_email is
    'Mail an den Eigentümer, wenn ein Familienmitglied eine Sperrzeit wünscht '
    'und auf seine Freigabe wartet (Stufe 1, 0389).';

comment on column public.notification_settings.block_freigabe_sms is
    'Dasselbe per SMS. Default aus — SMS kostet und ist für eine Abstimmung '
    'innerhalb der Familie selten nötig.';
