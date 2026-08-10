-- =========================================================================
-- 0352 — Protokoll der Eigentümer-Adresswechsel (alt → neu, wer, wann).
-- =========================================================================
-- AUSGANGSLAGE
-- Ändert ein Administrator im Eigentümer-Detail die E-Mail-Adresse, schrieb
-- das Speichern bis hierher AUSSCHLIESSLICH `owners.email`. Der Login läuft
-- aber gegen GoTrue (`auth.users.email`, `sign_in_with_password`);
-- `public.users.email` ist nur ein Spiegel. Ergebnis: die Adresse in der
-- Eigentümer-Maske lief von der Login-Adresse weg, und „Einladung erneut
-- senden" ging an die ALTE Adresse (auth/service.py liest `users.email`).
--
-- Die Entscheidung ist: die neue Adresse gilt für ALLES — Abrechnungen,
-- Benachrichtigungen UND den Login. Umgesetzt per Doppel-Opt-in: GoTrue
-- schickt die Bestätigung an die NEUE Adresse, der Login schaltet erst nach
-- dem Klick um (KEIN `email_confirm=True`). Bis dahin meldet sich der
-- Eigentümer weiter mit der bisherigen Adresse an.
--
-- WARUM EIN PROTOKOLL
-- Das ist ein Eingriff eines Administrators in die ANMELDEDATEN einer
-- ANDEREN Person. Der Betroffene kann den Vorgang nicht selbst im Postfach
-- nachvollziehen (er bekommt nur eine Bestätigungsmail), und der auslösende
-- Administrator ist im Nachhinein aus `owners.email` allein nicht ablesbar:
-- dort steht nur der Endzustand. Wer im Streitfall („meine Abrechnungen gehen
-- an eine fremde Adresse") rekonstruieren muss, wer wann welche Adresse durch
-- welche ersetzt hat, braucht die Zeile hier.
--
-- WARUM EINE EIGENE TABELLE statt Spalten auf `owners`
-- Es ist eine 1:n-Historie („dritter Wechsel innerhalb eines Jahres"), keine
-- Eigenschaft des Eigentümers. Spalten trügen genau EINEN Vorgang und
-- überschrieben ihn beim nächsten — dann wäre das Protokoll ein Zustand und
-- kein Protokoll. Zweiter Grund ist Wurzel 6: `owners` ist eine
-- Stammdatentabelle; diese Tabelle hier ist append-only und darf auch vom
-- Auslösenden nicht änderbar sein.
--
-- APPEND-ONLY: Es gibt hier bewusst KEINEN Update-/Delete-Pfad im Code. Der
-- `revoke` unten entzieht anon/authenticated alle vier Rechte; geschrieben
-- wird ausschliesslich über die service_role aus der FastAPI.

create table if not exists public.owner_email_changes (
    id uuid primary key default gen_random_uuid(),

    -- Mandant. Cascade: verschwindet der Betrieb, verschwindet seine Spur mit
    -- ihm — sie hat ausserhalb des Betriebs keinen Adressaten.
    tenant_id uuid not null references public.tenants(id) on delete cascade,

    -- Der betroffene Eigentümer-Stammdatensatz. Cascade aus demselben Grund
    -- wie oben: ohne den Eigentümer gibt es niemanden, für den die Spur
    -- geführt würde.
    owner_id uuid not null references public.owners(id) on delete cascade,

    -- Das Login-Konto, dessen Adresse mitgewechselt wurde. NULL heisst: der
    -- Eigentümer hatte (noch) keinen Portalzugang — dann war es ein reiner
    -- Stammdaten-Wechsel ohne Wirkung auf die Anmeldung. Kein FK auf
    -- `auth.users`: fremdes, von GoTrue verwaltetes Schema (Begründung wie in
    -- 0334) — ein FK dorthin machte jedes Löschen eines Auth-Nutzers von
    -- dieser Tabelle abhängig.
    user_id uuid,

    -- Die abgelöste und die neue Adresse. `alte_email` darf NULL sein: beim
    -- ERSTEN Erfassen einer Adresse gab es vorher keine. `neue_email` ist
    -- Pflicht — ein Wechsel ohne Ziel ist kein Wechsel.
    alte_email text,
    neue_email text not null,

    -- Hat GoTrue den Adresswechsel des LOGINS wirklich angenommen? False
    -- heisst: nur die Stammdaten wurden geändert (kein Portalzugang, oder
    -- GoTrue hat abgelehnt). Ohne dieses Feld liesse die Zeile offen, ob die
    -- Anmeldung überhaupt betroffen ist — und genau das ist die Frage, die
    -- man im Nachhinein stellt.
    login_wechsel_angestossen boolean not null default false,

    -- Wer den Wechsel ausgelöst hat (der Administrator, nicht der Eigentümer).
    actor_user_id uuid not null,

    -- Zeitpunkt UNSERER Verarbeitung. Das ist hier korrekt und keine
    -- Wurzel-5b-Falle: der Vorgang IST unsere Handlung — ein Administrator
    -- hat in unserem System gespeichert. Der Zeitpunkt der Bestätigung durch
    -- den Eigentümer ist ein FREMDES Ereignis und steht bewusst NICHT hier:
    -- ihn führt GoTrue (`auth.users.email_change_confirm_status` /
    -- `email_confirmed_at`), und ihn hier zu spiegeln hiesse, unsere Uhr für
    -- eine fremde Handlung auszugeben.
    created_at timestamptz not null default now()
);

create index if not exists owner_email_changes_owner_idx
    on public.owner_email_changes (owner_id, created_at desc);
create index if not exists owner_email_changes_tenant_idx
    on public.owner_email_changes (tenant_id, created_at desc);

comment on table public.owner_email_changes is
    'Append-only-Protokoll: ein Administrator hat die E-Mail-Adresse eines '
    'Eigentümers geändert (alt → neu, auslösender Nutzer, Zeitpunkt). Die '
    'Adresse gilt für Abrechnungen, Benachrichtigungen UND den Login; der '
    'Login schaltet erst nach dem Doppel-Opt-in in der neuen Mailbox um. '
    'Nur service_role, kein Lösch-/Änderungsrecht.';

comment on column public.owner_email_changes.login_wechsel_angestossen is
    'True = GoTrue hat den Adresswechsel des Logins angenommen und eine '
    'Bestätigungsmail an die NEUE Adresse verschickt (Doppel-Opt-in läuft). '
    'False = reiner Stammdaten-Wechsel ohne verknüpften Portalzugang.';


-- -------------------------------------------------------------------------
-- WURZEL 6 — DIREKTPFAD SCHLIESSEN
-- -------------------------------------------------------------------------
-- Muster aus 0337/0341 unverändert: (a) `revoke` ALLER vier Rechte für anon
-- UND authenticated — auch der ohnehin fehlenden, damit der Entzug den
-- ENDZUSTAND beschreibt und ein späteres versehentliches `grant all` die
-- Lücke nicht unbemerkt wieder aufreisst; (b) RESTRICTIVE `for all` (nicht
-- `for select`), sonst bliebe der SCHREIB-Pfad tenant-weit offen; (c) keine
-- permissive Policy für irgendeine Rolle: es gibt keinen legitimen
-- Direktzugriff. Die Zeilen enthalten Klartext-Adressen — ein eingeloggter
-- `cleaner` mit dem anon-Key hätte darüber sonst die Kontaktdaten aller
-- Eigentümer des Betriebs samt Historie (Wurzel 6 §4.3).
--
-- Prüffrage aus Wurzel 6 („was kann ein eingeloggter cleaner mit dem anon-Key
-- per curl gegen /rest/v1/owner_email_changes lesen UND schreiben?") wird
-- damit für alle vier Verben mit `permission denied` beantwortet.

alter table public.owner_email_changes enable row level security;

-- Force: auch der Tabelleneigentümer unterliegt der Policy.
alter table public.owner_email_changes force row level security;

revoke select, insert, update, delete
    on public.owner_email_changes from anon, authenticated;

drop policy if exists owner_email_changes_deny_all on public.owner_email_changes;
create policy owner_email_changes_deny_all
    on public.owner_email_changes
    as restrictive for all
    using (false) with check (false);
