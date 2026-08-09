-- =========================================================================
-- 0341 — Zwei-Faktor-Authentifizierung: Wiederherstellungscodes, Pflicht-
--        Erzwingung (AAL2) und der Direktpfad-Riegel dafuer.
-- =========================================================================
-- AUSGANGSLAGE (live gegen die Server-DB geprueft, 09.08.2026):
--
-- (1) GoTrue laeuft als v2.189.0 und kann alle drei echten Faktoren NATIV:
--     `auth.factor_type` traegt live die Werte totp, webauthn, phone, und
--     `auth.mfa_factors` hat die Spalten dafuer (secret / phone /
--     web_authn_credential + web_authn_aaguid). `auth.aal_level` kennt
--     aal1, aal2, aal3. Es wird deshalb KEIN Faktor selbst nachgebaut —
--     Enrollment, Challenge und Verify macht GoTrue, und der `aal`-Claim im
--     Token ist die einzige Quelle der Wahrheit.
--
-- (2) Die bisherige 2FA lag in `public.user_mfa` (0021) und war genau die
--     „App-2FA", die Wurzel 7 als wirkungslos beschreibt:
--       - Sie wurde ausschliesslich in `POST /api/v1/auth/login` geprueft.
--         Wer sich direkt gegen GoTrue anmeldet
--           curl -H "apikey: <anon>" "$SUPABASE_URL/auth/v1/token?grant_type=password" \
--                -d '{"email":"…","password":"…"}'
--         bekam ein voll gueltiges Token OHNE jede zweite Huerde. Die App-2FA
--         hat den Angreifer nie beruehrt.
--       - `totp_secret` lag im KLARTEXT in der Tabelle (Wurzel 6: Secrets).
--       - Die Session nach bestandener 2FA entstand ueber
--         `generate_link('magiclink')` + `verify_otp` — das Ergebnis traegt
--         `aal1`, weil GoTrue von dem zweiten Faktor nichts weiss. Der Claim
--         war also nicht nur ungeprueft, er war strukturell falsch.
--     Live-Bestandsaufnahme: `public.user_mfa` = 0 Zeilen, `auth.mfa_factors`
--     = 0 Zeilen. NIEMAND ist aktuell enrolled → diese Migration kann keinen
--     Nutzer aussperren, und es sind keine Secrets zu migrieren.
--
-- WAS DIESE MIGRATION ANLEGT:
--   - public.mfa_recovery_code   — der einzige Faktor, den GoTrue nicht kennt.
--   - public.mfa_enforcement     — Pflicht-Status + Uebergangsfrist je Nutzer.
--   - public.mfa_reset_audit     — jeder Admin-Reset eines fremden Faktors.
--
-- WURZEL 6 (Direktpfad) fuer alle drei: vollstaendiger `revoke` aller vier
-- Rechte fuer anon UND authenticated + RESTRICTIVE `for all`-Guard (nicht nur
-- `for select`, sonst bleibt der Schreibpfad offen). Diese Tabellen enthalten
-- den Rettungsweg ins Konto — sie sind mindestens so sensibel wie Finanzen.
-- Gelesen/geschrieben wird ausschliesslich per service_role (rolbypassrls = t).
--
-- WURZEL 4 (keine Fallbacks): `mfa_recovery_code.code_hash` ist NOT NULL, es
-- gibt keinen Klartext-Spiegel und keinen Default-Code. Fehlt der Hash, gibt
-- es keinen Code — nicht „irgendeinen".
--
-- Alt/Neu-Gegenzustand (Wurzel 1): `public.user_mfa` wird NICHT geloescht.
-- Sie ist leer und damit wirkungslos, aber ein `drop` in derselben Migration,
-- die den Ersatz einfuehrt, nimmt jede Rueckfallmoeglichkeit, falls beim
-- Ausrollen etwas klemmt. Sie wird stattdessen stillgelegt (Kommentar +
-- bereits bestehender Direktpfad-Riegel aus 0337) und in einer spaeteren
-- Migration entfernt, wenn AAL2 nachweislich traegt.
-- =========================================================================


-- -------------------------------------------------------------------------
-- 1) WIEDERHERSTELLUNGSCODES
-- -------------------------------------------------------------------------
-- Der Rettungsweg, wenn das Telefon weg ist. Bewusst EINE ZEILE JE CODE statt
-- eines text[]-Feldes wie in 0021: nur so kann die Einloesung ein
-- DB-seitiger, atomarer Claim sein (Wurzel 2 — `update … where used_at is
-- null` trifft genau eine Zeile, zwei parallele Einloesungen desselben Codes
-- koennen nicht beide gewinnen). Beim Array-Feld war „lesen, entfernen,
-- zurueckschreiben" ein Read-Modify-Write ohne Sperre.
--
-- Gespeichert wird NUR der SHA-256-Hash (Wurzel 6). Der Klartext existiert
-- genau einmal: in der HTTP-Antwort, die ihn erzeugt hat.
create table if not exists public.mfa_recovery_code (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references auth.users (id) on delete cascade,
    -- SHA-256 des normalisierten Codes (hex, 64 Zeichen). Nie Klartext.
    code_hash  text not null,
    created_at timestamptz not null default now(),
    -- Gesetzt beim Einloesen. Der einzige Zustandswechsel dieser Zeile und
    -- zugleich der Idempotenz-Riegel: eine Zeile mit used_at gilt nie wieder.
    used_at    timestamptz,
    used_ip    text
);

-- Backstop gegen doppelte Codes je Nutzer (Wurzel 2). Ohne den koennte eine
-- Kollision beim Erzeugen zwei gueltige Zeilen fuer denselben Code anlegen.
create unique index if not exists mfa_recovery_code_user_hash_uidx
    on public.mfa_recovery_code (user_id, code_hash);

-- Der heisse Pfad: „offene Codes dieses Nutzers".
create index if not exists mfa_recovery_code_offen_idx
    on public.mfa_recovery_code (user_id)
    where used_at is null;

comment on table public.mfa_recovery_code is
    'Einmal-Wiederherstellungscodes fuer 2FA. Nur SHA-256-Hash, nie Klartext. '
    'Einloesung ist ein atomarer Claim (used_at). Nur service_role.';


-- -------------------------------------------------------------------------
-- 2) PFLICHT-STATUS UND UEBERGANGSFRIST
-- -------------------------------------------------------------------------
-- Warum eine Frist und keine sofortige Sperre: admin/co_admin sind genau die
-- Konten, die das System betreiben. Wuerde die Pflicht mit dem Einspielen
-- dieser Migration sofort greifen, waere jeder bestehende Admin im selben
-- Moment ausgesperrt — einschliesslich desjenigen, der den Fehler beheben
-- muesste. Die Frist ist deshalb kein Aufweichen der Regel, sondern ihr
-- Einfuehrungspfad: waehrend der Frist kommt der Nutzer durch, bekommt aber
-- bei jedem Request die Aufforderung; danach ist der Zugang zu allem ausser
-- der 2FA-Einrichtung selbst zu.
--
-- Die Frist gilt AUSSCHLIESSLICH fuer das Fehlen eines Faktors. Wer einen
-- Faktor hat, muss ihn ab sofort loesen — dort gibt es keine Kulanz.
create table if not exists public.mfa_enforcement (
    user_id      uuid primary key references auth.users (id) on delete cascade,
    -- Ende der Einrichtungsfrist. Wird beim ersten Request eines
    -- pflichtigen Kontos ohne Faktor gesetzt (nicht vorab fuer alle), damit
    -- die Frist ab dem ersten Kontakt laeuft und nicht ab Migrationszeit.
    grace_until  timestamptz,
    -- Gesetzt, sobald der Nutzer den ersten Faktor verifiziert hat. Danach
    -- ist die Frist gegenstandslos und wird nie neu vergeben.
    enrolled_at  timestamptz,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

create trigger mfa_enforcement_set_updated_at
    before update on public.mfa_enforcement
    for each row execute function public.set_updated_at();

comment on table public.mfa_enforcement is
    'Pflicht-2FA je Nutzer: Ende der Einrichtungsfrist und Zeitpunkt des '
    'ersten verifizierten Faktors. Nur service_role.';


-- -------------------------------------------------------------------------
-- 3) AUDIT DES ADMIN-RESETS
-- -------------------------------------------------------------------------
-- Einen fremden zweiten Faktor zurueckzusetzen ist der maechtigste Eingriff
-- in diesem System: danach kommt jemand mit blossem Passwort in ein fremdes
-- Konto. Das MUSS nachvollziehbar sein, und zwar in einer Tabelle, die auch
-- der Ausfuehrende nicht aendern kann (revoke unten gilt fuer alle ausser
-- service_role; die FastAPI schreibt nur, sie loescht hier nie).
create table if not exists public.mfa_reset_audit (
    id             uuid primary key default gen_random_uuid(),
    -- Wer zurueckgesetzt hat (Plattform-Admin).
    actor_user_id  uuid not null,
    actor_email    text,
    -- Wessen Faktoren zurueckgesetzt wurden.
    target_user_id uuid not null,
    target_email   text,
    -- Was tatsaechlich entfernt wurde — Zahl UND Typen, damit im Nachhinein
    -- sichtbar ist, ob ein Passkey oder nur eine SMS-Nummer fiel.
    removed_factors jsonb not null default '[]'::jsonb,
    -- Pflicht-Begruendung (der Endpunkt lehnt ohne sie ab).
    reason         text not null,
    ip             text,
    user_agent     text,
    created_at     timestamptz not null default now()
);

create index if not exists mfa_reset_audit_target_idx
    on public.mfa_reset_audit (target_user_id, created_at desc);
create index if not exists mfa_reset_audit_actor_idx
    on public.mfa_reset_audit (actor_user_id, created_at desc);

comment on table public.mfa_reset_audit is
    'Revisionsspur: Plattform-Admin hat den zweiten Faktor eines fremden '
    'Kontos zurueckgesetzt. Nur service_role, kein Loeschrecht.';


-- -------------------------------------------------------------------------
-- 4) WURZEL 6 — DIREKTPFAD SCHLIESSEN
-- -------------------------------------------------------------------------
-- Muster aus 0336/0337 unveraendert uebernommen:
--   (a) revoke ALLER vier Rechte fuer anon UND authenticated — auch der
--       ohnehin fehlenden, damit der Entzug den ENDZUSTAND beschreibt und ein
--       spaeteres versehentliches `grant all` die Luecke nicht unbemerkt
--       wieder aufreisst.
--   (b) RESTRICTIVE `for all` (nicht `for select`) — sonst bleibt der
--       SCHREIB-Pfad offen. Genau der Fehler, den 0187 dokumentiert.
--   (c) Keine permissive Policy fuer irgendeine Rolle: es gibt keinen
--       legitimen Direktzugriff auf diese drei Tabellen. Der Nutzer sieht
--       seinen Faktor-Status ueber /auth/mfa/status, nicht ueber PostgREST.
--
-- Die Prueffrage aus Wurzel 6 („was kann ein eingeloggter cleaner mit dem
-- anon-Key per curl?") wird damit fuer alle drei Tabellen und alle vier
-- Verben mit `permission denied` beantwortet.

alter table public.mfa_recovery_code enable row level security;
alter table public.mfa_enforcement   enable row level security;
alter table public.mfa_reset_audit   enable row level security;

-- Force: auch der Tabelleneigentuemer unterliegt der Policy. Ohne das haette
-- ein Zugriff unter der Owner-Rolle die Restriktion umgangen.
alter table public.mfa_recovery_code force row level security;
alter table public.mfa_enforcement   force row level security;
alter table public.mfa_reset_audit   force row level security;

revoke select, insert, update, delete
    on public.mfa_recovery_code from anon, authenticated;
revoke select, insert, update, delete
    on public.mfa_enforcement   from anon, authenticated;
revoke select, insert, update, delete
    on public.mfa_reset_audit   from anon, authenticated;

drop policy if exists mfa_recovery_code_deny_all on public.mfa_recovery_code;
create policy mfa_recovery_code_deny_all
    on public.mfa_recovery_code
    as restrictive for all
    using (false) with check (false);

drop policy if exists mfa_enforcement_deny_all on public.mfa_enforcement;
create policy mfa_enforcement_deny_all
    on public.mfa_enforcement
    as restrictive for all
    using (false) with check (false);

drop policy if exists mfa_reset_audit_deny_all on public.mfa_reset_audit;
create policy mfa_reset_audit_deny_all
    on public.mfa_reset_audit
    as restrictive for all
    using (false) with check (false);


-- -------------------------------------------------------------------------
-- 5) ZUGRIFF AUF auth.mfa_factors FUER DIE FASTAPI
-- -------------------------------------------------------------------------
-- Das `auth`-Schema ist ueber PostgREST nicht erreichbar (und soll es auch
-- nicht sein). Die FastAPI braucht aber zwei Operationen darauf:
--   - lesen, WELCHE verifizierten Faktoren ein Nutzer hat (Pflichtpruefung),
--   - alle Faktoren eines Nutzers entfernen (Admin-Rettung bei Aussperrung).
-- Beides als SECURITY DEFINER mit der Haertung aus Wurzel 6:
--   `set search_path = ''` + voll schema-qualifizierte Bezeichner (sonst
--   koennte ein untergeschobener search_path eine eigene `mfa_factors`
--   unterschieben) und `revoke execute` fuer anon/authenticated, damit die
--   Funktionen nicht selbst zum Direktpfad werden.
--
-- Bewusst NUR verifizierte Faktoren: eine angefangene, nie bestaetigte
-- Enrollment-Zeile ist kein zweiter Faktor. Sie mitzuzaehlen wuerde die
-- Pflicht aushebeln (Enrollment starten, abbrechen, durchkommen).
-- Das Secret / die WebAuthn-Credentials werden NICHT zurueckgegeben — die
-- Pflichtpruefung braucht sie nicht, und was nicht rausgeht, kann nicht
-- leaken (Wurzel 6).
create or replace function public.mfa_faktoren_lesen(p_user_id uuid)
returns table (
    id            uuid,
    factor_type   text,
    friendly_name text,
    status        text,
    created_at    timestamptz,
    updated_at    timestamptz
)
language sql
security definer
set search_path = ''
as $$
    select f.id,
           f.factor_type::text,
           f.friendly_name,
           f.status::text,
           f.created_at,
           f.updated_at
      from auth.mfa_factors f
     where f.user_id = p_user_id
       and f.status = 'verified'
     order by f.created_at;
$$;

-- Aussperr-Rettung: entfernt ALLE Faktoren eines Kontos. Die zugehoerigen
-- `auth.mfa_challenges` haengen per `on delete cascade` daran und gehen
-- automatisch mit (live gegen die FK-Definition geprueft).
create or replace function public.mfa_faktoren_loeschen(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_anzahl integer;
begin
    delete from auth.mfa_factors where user_id = p_user_id;
    get diagnostics v_anzahl = row_count;
    return v_anzahl;
end;
$$;

-- Beide Funktionen sind ausschliesslich fuer die FastAPI (service_role).
-- Ohne diesen Entzug waere `mfa_faktoren_loeschen` per anon-Key aufrufbar und
-- damit ein Weg, JEDEM Konto die 2FA abzuschalten.
revoke all on function public.mfa_faktoren_lesen(uuid)    from public, anon, authenticated;
revoke all on function public.mfa_faktoren_loeschen(uuid) from public, anon, authenticated;
grant execute on function public.mfa_faktoren_lesen(uuid)    to service_role;
grant execute on function public.mfa_faktoren_loeschen(uuid) to service_role;


-- -------------------------------------------------------------------------
-- 6) ALTBESTAND user_mfa STILLLEGEN (nicht loeschen)
-- -------------------------------------------------------------------------
-- Live 0 Zeilen. Der Direktpfad ist ueber 0337 bereits geschlossen. Sie wird
-- hier nur als abgeloest markiert; das `drop` folgt separat, wenn AAL2 im
-- Betrieb nachweislich traegt (Wurzel 1: kein Ersatz ohne Rueckweg).
comment on table public.user_mfa is
    'ABGELOEST durch GoTrue-natives MFA (auth.mfa_factors) + '
    'public.mfa_recovery_code, siehe Migration 0341. Die hier gespeicherte '
    'App-2FA war ueber den direkten GoTrue-Login umgehbar (Wurzel 7) und '
    'hielt das TOTP-Secret im Klartext. Live leer, wird nicht mehr gelesen. '
    'Entfernen in einer spaeteren Migration.';


-- -------------------------------------------------------------------------
-- 7) NACHTRAG — EINZELNEN FAKTOR ENTFERNEN
-- -------------------------------------------------------------------------
-- Gegenzustand zum Enrollment (Wurzel 1): Wer einen Faktor hinzufuegen kann,
-- muss ihn auch wieder loesen koennen — sonst ist ein verlorenes Telefon eine
-- dauerhafte Sperre. Die Erlaubnis prueft die FastAPI davor
-- (`faktor_entfernen_erlaubt`: der letzte Faktor eines Pflicht-Kontos geht nur
-- mit uebrigen Wiederherstellungscodes).
--
-- Der Filter enthaelt BEIDES, user_id und id (Wurzel 3/9): so ist ein fremder
-- Faktor auch bei manipulierter factor_id nicht erreichbar — die Autorisierung
-- haengt nicht allein an der vorgelagerten Pruefung im Service.
create or replace function public.mfa_faktor_loeschen(
    p_user_id uuid, p_factor_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_anzahl integer;
begin
    delete from auth.mfa_factors
     where user_id = p_user_id
       and id = p_factor_id;
    get diagnostics v_anzahl = row_count;
    return v_anzahl;
end;
$$;

revoke all on function public.mfa_faktor_loeschen(uuid, uuid)
    from public, anon, authenticated;
grant execute on function public.mfa_faktor_loeschen(uuid, uuid) to service_role;
