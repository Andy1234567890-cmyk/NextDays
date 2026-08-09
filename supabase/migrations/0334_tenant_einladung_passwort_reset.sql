-- 0334 — Echte Einladungs- und Passwort-Reset-Tokens für TENANT-Nutzer.
--
-- BISHER: `POST /auth/invite` nahm ein KLARTEXT-Passwort vom Client entgegen
-- (der Wizard in web/ würfelte „Nd-"+14 Zeichen im Browser) und legte den
-- GoTrue-Nutzer per `create_user(email_confirm=True)` an. Das eingeladene
-- Passwort ging danach durch den Browser des Einladenden, durch das HTTP-Log
-- und musste per Zuruf/Chat weitergegeben werden — jeder dieser Wege ist ein
-- Klartext-Kanal. Einen Weg „Passwort vergessen" gab es für Tenant-Nutzer gar
-- nicht: `reset_password_email()` läuft in diesem Setup ins Leere, weil
-- `GOTRUE_SMTP_HOST` leer ist (live geprüft, siehe 0279).
--
-- NEU: derselbe Weg, den das Backoffice seit 0237/0279 fährt — Einmal-Token von
-- uns, Versand über `core.mail` gegen den eigenen Mailcow, Passwort per
-- GoTrue-Admin-API gesetzt. Nur eben für Betriebs-Nutzer statt für
-- Plattform-Betreiber.
--
-- WARUM EINE EIGENE TABELLE statt Spalten auf `public.users` (0279-Muster):
-- `platform_admins` ist eine schmale Betreiber-Tabelle mit einer Handvoll
-- Zeilen; dort waren drei zusätzliche Spalten billig. `public.users` ist die
-- zentrale, breite Tenant-Tabelle, die JEDER Slice liest — sie trägt bereits
-- Profil, Rechte, Telefon, Adressen. Zwei Gründe geben hier den Ausschlag:
--   1. LESERECHTE. `users` ist für `authenticated` lesbar (Nutzerlisten,
--      Objekt-Kontakte, Aufgaben-Zuweisung). Ein Token-Hash als Spalte DORT
--      wäre über den DB-Direktpfad (PostgREST + anon-Key) für jeden
--      eingeloggten Nutzer des Mandanten sichtbar — der Hash allein ist zwar
--      nicht einlösbar, verrät aber, WER gerade einen offenen Reset hat, und
--      wäre für einen Offline-Angriff auf ein schwaches Token angreifbar.
--      Eine eigene, komplett gesperrte Tabelle löst das an der Wurzel
--      (Wurzel 6), ohne an den Grants von `users` zu drehen.
--   2. MEHRERE VORGÄNGE. Eine Spalte trägt genau EINEN offenen Token. Hier
--      brauchen wir Einladung UND Reset nebeneinander (eine Einladung kann
--      erneut versendet werden, während ein Reset läuft) plus die Historie
--      „wann wurde eingeladen/zurückgesetzt". Das ist eine 1:n-Beziehung und
--      gehört in Zeilen, nicht in Spalten.
--
-- EINE Tabelle für BEIDE Zwecke (nicht zwei): Lebenszyklus, Schutzbedarf und
-- Prüflogik sind identisch (Hash, Ablauf, Einmaligkeit, Claim). Der Unterschied
-- ist ausschließlich die Gültigkeitsdauer und der Zieltext der Mail — das ist
-- ein Wert, keine Struktur. Zwei Tabellen wären zweimal dieselbe RLS, zweimal
-- derselbe Claim-Code und zwei Stellen, an denen man das Aufräumen vergisst.
--
-- IN DER DB LIEGT NUR DER SHA-256 (Wurzel 6): wer die Tabelle liest, bekommt
-- keinen benutzbaren Link. Der Klartext existiert genau einmal — im Mail-Link.

create table if not exists public.user_auth_tokens (
    id uuid primary key default gen_random_uuid(),

    -- Wessen Zugang. Kein FK auf auth.users: die Tabelle liegt in einem
    -- fremden Schema, das GoTrue verwaltet, und ein FK dorthin macht jedes
    -- Löschen eines Auth-Nutzers von unserer Tabelle abhängig. Verwaiste
    -- Tokens sind unschädlich (sie lösen nur noch ins Leere ein) und werden
    -- vom Aufräum-Pfad mitgenommen.
    user_id uuid not null,

    -- Mandant des Nutzers. Nicht für die Prüfung nötig (der Token identifiziert
    -- den Nutzer), aber für Auswertung/Aufräumen und damit ein Blick in die
    -- Tabelle ohne Join zeigt, wen es betrifft. Ein Token ist NIE
    -- mandantenübergreifend.
    tenant_id uuid not null references public.tenants(id) on delete cascade,

    -- 'invite' = Erst-Passwort nach Einladung, 'reset' = Passwort vergessen.
    -- Als CHECK statt Enum: ein neuer Zweck soll eine bewusste Migration sein,
    -- aber kein `create type`-Umbau.
    zweck text not null check (zweck in ('invite', 'reset')),

    -- SHA-256 des Tokens, hex. NIE der Klartext.
    token_hash text not null,

    -- Ende der Gültigkeit. Danach fail-closed abgelehnt.
    expires_at timestamptz not null,

    -- Zeitpunkt der Einlösung. NULL = offen. Der Übergang NULL → jetzt ist der
    -- Einmaligkeits-Riegel: der Service setzt ihn per bedingtem UPDATE
    -- (`where used_at is null`), sodass die DB entscheidet, wer bei zwei
    -- gleichzeitigen Einlösungen gewinnt (Wurzel 2).
    used_at timestamptz,

    -- Wann der Vorgang angestoßen wurde. Fachlicher Zeitpunkt der Anforderung,
    -- Grundlage der Sperrfrist gegen Mail-Bombardement.
    created_at timestamptz not null default now(),

    -- Wer den Token ausgelöst hat: bei 'invite' der einladende Nutzer, bei
    -- 'reset' NULL (der Anfordernde ist per Definition nicht angemeldet und
    -- seine Identität ist an dieser Stelle unbewiesen — hier eine user_id
    -- einzutragen wäre eine erfundene Behauptung, Wurzel 4).
    created_by uuid
);

comment on table public.user_auth_tokens is
    'Einmal-Tokens für Einladung und Passwort-Reset von Tenant-Nutzern (0334). '
    'Nur der SHA-256 wird gespeichert; der Klartext existiert ausschliesslich im '
    'Mail-Link. Fuer anon/authenticated vollstaendig gesperrt (Wurzel 6).';
comment on column public.user_auth_tokens.zweck is
    'invite = Erst-Passwort nach Einladung, reset = Passwort vergessen.';
comment on column public.user_auth_tokens.token_hash is
    'SHA-256 (hex) des Tokens. Der Klartext steht nur im Mail-Link.';
comment on column public.user_auth_tokens.used_at is
    'Zeitpunkt der Einloesung; NULL = offen. Wird per bedingtem UPDATE gesetzt '
    '(where used_at is null) und ist damit der Einmaligkeits-Riegel (Wurzel 2).';
comment on column public.user_auth_tokens.created_by is
    'Einladender Nutzer bei zweck=invite; bei zweck=reset bewusst NULL (der '
    'Anfordernde ist nicht angemeldet, seine Identitaet waere geraten).';

-- Der Nachschlage-Weg: der Service kennt NUR den Hash und sucht damit die
-- Zeile. Unique, weil derselbe Hash zweimal ein Kollisionsfall wäre, den
-- niemand auflösen kann — und weil ein UNIQUE-Backstop billiger ist als die
-- Frage, welche der beiden Zeilen gilt (Wurzel 2).
create unique index if not exists user_auth_tokens_hash_uq
    on public.user_auth_tokens (token_hash);

-- Offene Tokens eines Nutzers: der Pfad „alle anderen Tokens dieses Nutzers
-- invalidieren" (nach Einlösung, nach erneutem Senden) und die Sperrfrist.
-- Partiell auf used_at is null, weil verbrauchte Tokens die dauerhaft wachsende
-- Mehrheit sind und für diese Abfragen nie in Frage kommen.
create index if not exists user_auth_tokens_offen_idx
    on public.user_auth_tokens (user_id, zweck, expires_at)
    where used_at is null;

-- Aufräumen/Auswertung je Mandant.
create index if not exists user_auth_tokens_tenant_idx
    on public.user_auth_tokens (tenant_id, created_at desc);

-- == Wurzel 6: DB-Direktpfad (PostgREST/Realtime mit anon-Key) ===============
-- Ein Client mit gültigem JWT + öffentlichem anon-Key spricht PostgREST DIREKT
-- an; jede Prüfung in FastAPI ist dagegen wirkungslos. Diese Tabelle darf für
-- anon/authenticated WEDER lesbar NOCH schreibbar sein:
--   • LESEN wäre die Liste, wer gerade einen offenen Zugangslink hat (und der
--     Hash für einen Offline-Angriff).
--   • SCHREIBEN wäre die Übernahme jedes Kontos des Mandanten: wer eine Zeile
--     mit selbstgewähltem token_hash für eine fremde user_id einfügen kann,
--     setzt anschließend über den öffentlichen Endpunkt deren Passwort.
-- Nur service_role (der Server) arbeitet hier.

alter table public.user_auth_tokens enable row level security;

-- (a) Grants entziehen. `enable rls` + Policy allein reicht NICHT — ohne
-- Grant-Entzug bliebe der Weg über eine spätere permissive Policy offen.
revoke all on public.user_auth_tokens from anon, authenticated;

-- (b) Restriktive Deny-all-Policy als zweiter, unabhängiger Riegel. Bewusst
-- `for all` (nicht nur `for select`): sonst wäre der SCHREIB-Pfad offen, sobald
-- irgendwann ein Grant zurückkommt. RESTRICTIVE heisst: diese Bedingung MUSS
-- zusätzlich erfüllt sein — `false` kann keine spätere permissive Policy
-- übersteuern. service_role umgeht RLS ohnehin und ist davon nicht betroffen.
drop policy if exists user_auth_tokens_deny_all on public.user_auth_tokens;
create policy user_auth_tokens_deny_all
    on public.user_auth_tokens
    as restrictive
    for all
    to anon, authenticated
    using (false)
    with check (false);
