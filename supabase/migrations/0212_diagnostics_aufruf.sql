-- Ereignisart 'aufruf': vollständiger Aufruf inkl. gesendetem Inhalt.
--
-- HINTERGRUND: Bei einem fehlgeschlagenen Aufruf sah der Support bisher nur
-- "422 Unprocessable Entity" — nicht, welches Feld abgelehnt wurde und schon
-- gar nicht, was gesendet worden war. Ein realer 422 aus dem Objekt-Editor
-- musste deshalb von Hand nachgestellt werden, um überhaupt diagnostizierbar
-- zu sein.
--
-- Die neue Art hält Anfrage UND Antwort fest (context: methode, payload,
-- antwort, request_id). Sie ist damit die diagnosestärkste und zugleich
-- sensibelste Art des Slices: Schlägt ein Buchungs-Aufruf fehl, stehen dort
-- zwangsläufig Gastname, Adresse und Betrag.
--
-- SCHUTZ — bewusst mehrstufig, weil hier echte Kundendaten liegen:
--   • Einwilligungspflichtig wie navigation/aktion: Der Service nimmt sie nur
--     bei aktiver Freigabe an (_NUR_MIT_FREIGABE) und verwirft sie sonst.
--   • Der Client entfernt Zugangsdaten VOR dem Senden (Passwörter, Token,
--     Kartendaten) — die haben keinen Diagnosewert, ihr Verlust wäre aber ein
--     echter Schaden.
--   • Lesbar ausschließlich für Backoffice-Nutzer und nur solange die
--     Freigabe läuft (Policy aus 0210 gilt unverändert weiter).
--   • Aufbewahrung: purge_old() räumt wie gehabt nach 30 Tagen.
--
-- Der Umfang ist eine bewusste Entscheidung des Betreibers zugunsten der
-- Diagnosefähigkeit. Die Alternative (nur Feldnamen, keine Werte) wurde
-- verworfen, weil sich Fehler in verschachtelten Payloads damit oft nicht
-- eingrenzen lassen.

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
            'aktion',
            -- NUR während einer aktiven Debug-Freigabe (Anfrage + Antwort):
            'aufruf'
        )
    );

comment on column public.support_diagnostics.kind is
    'Ereignisart. error/api_error/slow_request/client_info laufen dauerhaft '
    '(technisch). navigation/aktion/aufruf sind einwilligungspflichtig und '
    'werden vom Service nur bei aktiver Debug-Freigabe angenommen; aufruf '
    'enthält zusätzlich den gesendeten Inhalt.';
