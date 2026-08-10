-- 0356 — Benutzerverwaltung: die Profilfelder, die der Code schon behauptet,
--        plus Deaktivieren/Aktivieren eines Zugangs
--
-- ANLASS (10.08.2026): Die Nutzerverwaltung (/konto/nutzer) sollte den Umfang
-- einer ausgereiften Oberfläche bekommen: Detailseite je Benutzer mit
-- Kontaktdaten, Zusatzinformationen, Rolle/Rechten, zugewiesenen Objekten und
-- einem Zugang, den man vorübergehend abschalten kann, ohne ihn zu löschen.
--
-- BEIM NACHSEHEN KAM EIN ÄLTERER FEHLER MIT HERAUS:
-- `AccountResponse`/`UpdateProfileRequest` (apps/api, features/auth/schemas.py)
-- führen seit Monaten `additional_phone`, `hide_phones`, `spoken_languages`,
-- `website`, `description` und `avatar_url` — in `public.users` gibt es KEINE
-- dieser Spalten (live geprüft, 27 Spalten, keine davon dabei; auch in keiner
-- Migration). Folgen:
--   * `GET /auth/account` liest sie per `row.get(...)` → immer None/[]/false.
--     Die Oberfläche zeigt „nicht gesetzt", obwohl jemand etwas eingetragen hat.
--   * `PATCH /auth/account/profile` mit einem dieser Felder schickt PostgREST
--     eine Spalte, die es nicht gibt → Fehler statt Speichern.
--   * `POST /auth/account/avatar` schreibt `users.avatar_url` → derselbe Fehler;
--     das Profilbild war nie speicherbar.
-- Die Spalten hier anzulegen ist deshalb kein Zusatzwunsch, sondern die
-- Reparatur einer Zusage, die der Contract längst macht (Wurzel 4: kein
-- plausibel aussehender Ersatzwert — entweder das Feld existiert und trägt die
-- Wahrheit, oder es hat im Contract nichts zu suchen).
--
-- WARUM `deactivated_at` UND KEIN `is_active`-FLAG:
-- Ein Zeitpunkt beantwortet zusätzlich „seit wann" und lässt sich in der
-- Oberfläche benennen („Deaktiviert am 10.08.2026"). NULL = aktiv ist der
-- gleiche Ausdruck wie überall sonst im Schema (contract_end_date, 0355).
-- `deactivated_by` hält fest, WER abgeschaltet hat — bei einem Zugang, der
-- damit sofort nichts mehr sieht, ist das die Frage, die danach kommt.
--
-- WICHTIG ZUR DURCHSETZUNG (Wurzel 7): Diese Spalte allein sperrt NIEMANDEN.
-- Wer sich direkt gegen GoTrue anmeldet (`POST /auth/v1/token`, öffentlicher
-- anon-Key), sieht kein FastAPI. Die Sperre passiert deshalb an zwei Stellen
-- zusätzlich zum Feld:
--   1. GoTrue-`ban_duration` auf dem Auth-User (blockt neue Logins UND das
--      Erneuern des Tokens) — gesetzt vom Service beim Deaktivieren.
--   2. `core.security.get_current_user` (aktiv_gate) wirft 401, solange
--      `deactivated_at` steht — damit fällt auch ein bereits ausgestelltes
--      Token sofort, nicht erst nach seiner Restlaufzeit.
-- Das Feld ist die Wahrheit, die beide Wege lesen.
--
-- KEINE NEUEN GRANTS (Wurzel 6): `public.users` trägt Rolle, Berechtigungen und
-- jetzt auch Anmerkungen zur Person. anon/authenticated haben auf der Tabelle
-- weder select noch insert/update/delete (0337, live gegengeprüft: nur
-- TRUNCATE/REFERENCES/TRIGGER stehen dort, also keine Datenrechte). Diese
-- Migration ändert daran nichts und darf es nicht — sonst läse jeder
-- eingeloggte Reinigungskraft-Zugang per `curl /rest/v1/users` die
-- Anmerkungen und Telefonnummern aller Kollegen.
--
-- REALTIME: `users` ist bewusst NICHT in `supabase_realtime` (0337). Ein Abo
-- darauf wäre eine stumme Attrappe; die Nutzerverwaltung lädt daher serverseitig.

alter table public.users
    add column if not exists additional_phone text,
    add column if not exists hide_phones      boolean not null default false,
    add column if not exists spoken_languages jsonb   not null default '[]'::jsonb,
    add column if not exists notes            text,
    add column if not exists website          text,
    add column if not exists description      text,
    add column if not exists avatar_url       text,
    add column if not exists deactivated_at   timestamptz,
    add column if not exists deactivated_by   uuid references public.users (id)
        on delete set null;

comment on column public.users.additional_phone is
    'Zweite Telefonnummer der Person (E.164). Ergaenzt phone; getrennte Spalte, '
    'weil beide Nummern unabhaengig gepflegt und angezeigt werden (0356).';

comment on column public.users.hide_phones is
    'Telefonnummern dieser Person nicht auf der oeffentlichen Website zeigen. '
    'Betrifft NUR die Anzeige nach aussen, nicht die Sichtbarkeit im PMS (0356).';

comment on column public.users.spoken_languages is
    'Sprachen, die diese Person spricht (JSON-Array). Rein informativ fuer die '
    'Zuteilung von Gaesten/Aufgaben — NICHT die Sprache ihrer E-Mails, die '
    'steht in preferred_language (0356).';

comment on column public.users.notes is
    'Interne Anmerkung des Betriebs zu dieser Person. Nur fuer die '
    'Konto-Fuehrung sichtbar (Tabelle ist fuer authenticated gesperrt, 0356).';

comment on column public.users.deactivated_at is
    'Zeitpunkt der Deaktivierung des Zugangs; NULL = aktiv. Durchgesetzt wird '
    'die Sperre zusaetzlich per GoTrue-ban_duration und im aktiv_gate '
    '(core.security) — das Feld allein sperrt nichts (Wurzel 7, 0356).';

comment on column public.users.deactivated_by is
    'Wer den Zugang deaktiviert hat. NULL, wenn der Deaktivierende selbst '
    'geloescht wurde (0356).';

-- Das JSON-Array MUSS ein Array bleiben: ein Objekt oder ein String darin
-- braeche jede Leseseite (Frontend erwartet string[]). Fail-closed an den
-- Daten, nicht erst im Service (Wurzel 6 — der Direktpfad kommt an derselben
-- Stelle vorbei).
do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'users_spoken_languages_array'
    ) then
        alter table public.users
            add constraint users_spoken_languages_array
            check (jsonb_typeof(spoken_languages) = 'array');
    end if;
end
$$;

-- Nur die deaktivierten Zugaenge — die Liste in der Nutzerverwaltung fragt
-- „wer ist gesperrt", nie „wer ist aktiv" (das ist der Normalfall und braucht
-- keinen Index).
create index if not exists users_deactivated_at_idx
    on public.users (tenant_id, deactivated_at)
    where deactivated_at is not null;
