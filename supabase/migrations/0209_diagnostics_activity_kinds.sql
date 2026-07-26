-- Ablauf-Ereignisse in der Diagnose zulassen (Ergänzung zu 0208).
--
-- BEFUND: support_diagnostics.kind hatte einen CHECK-Constraint mit nur vier
-- Werten (error, api_error, slow_request, client_info). Die neuen Arten
-- 'navigation' und 'aktion' wurden zwar im Backend akzeptiert, beim INSERT
-- aber von der DB abgewiesen:
--
--     new row for relation "support_diagnostics" violates check constraint
--     "support_diagnostics_kind_check"
--
-- Ergebnis: Der Support sah nur die Umgebung, nie den Bedienablauf — obwohl
-- der Kunde die Freigabe erteilt hatte. Der Schreibfehler wurde vom
-- best-effort-Handler geschluckt (richtig so, damit Diagnose den Client nie
-- ausbremst), war dadurch aber nur im Server-Log sichtbar.
--
-- Die beiden neuen Arten sind einwilligungspflichtig: der Service nimmt sie
-- ausschließlich während einer aktiven Debug-Freigabe an (_NUR_MIT_FREIGABE)
-- und verwirft sie sonst. Diese Prüfung bleibt in der Anwendung — die DB
-- kennt den Freigabe-Kontext beim INSERT nicht.

alter table public.support_diagnostics
    drop constraint if exists support_diagnostics_kind_check;

alter table public.support_diagnostics
    add constraint support_diagnostics_kind_check check (
        kind in (
            -- Dauerhaft erfasst (rein technisch, keine Einwilligung nötig):
            'error',
            'api_error',
            'slow_request',
            'client_info',
            -- NUR während einer aktiven Debug-Freigabe (Bedienablauf):
            'navigation',
            'aktion'
        )
    );

comment on column public.support_diagnostics.kind is
    'Ereignisart. error/api_error/slow_request/client_info laufen dauerhaft '
    '(technisch). navigation/aktion zeichnen den Bedienablauf nach und werden '
    'vom Service nur bei aktiver Debug-Freigabe angenommen.';
