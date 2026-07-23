-- =========================================================================
-- 0190 — users.phone anlegen (fehlte) + Grants (Schreibpfad reparieren).
-- =========================================================================
-- Befund: public.users hatte NIE eine phone-Spalte (nur phone_verified_at aus
-- 0189 und emergency_contact_phone aus 0188). get_account las row.get("phone")
-- → immer leer; die reguläre Profil-Telefonnummer wurde nirgends gespeichert.
-- update_profile({phone}) und die SMS-Verifizierung (phone/verify) schrieben
-- daher ins Leere bzw. crashten mit „column 'phone' … not found".
-- (Die phone-Spalte existiert nur in auth.users/GoTrue — das ist eine ANDERE
-- Tabelle, für die App-Profildaten nicht der richtige Ort.)
--
-- Fix: echte phone-Spalte auf public.users + Grants wie die übrigen Profil-
-- Spalten (0188/0189). Nummer ist nicht geheim (wird im Konto angezeigt) →
-- anon/authenticated SELECT; Schreiben bleibt service_role-only (Wurzel 6).
-- =========================================================================

alter table public.users
    add column if not exists phone text;

comment on column public.users.phone is
    'Telefonnummer des Nutzers (E.164). Verifizierung über phone_verified_at '
    '(SMS-OTP). NICHT zu verwechseln mit auth.users.phone (GoTrue).';

grant select, insert, update, references (phone)
    on public.users to service_role;

grant select (phone)
    on public.users to authenticated, anon;

-- PostgREST-Schema-Cache neu laden, damit die Spalte sofort schreibbar ist.
notify pgrst, 'reload schema';
