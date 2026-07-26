-- Plattform-Backoffice: Betreiber-Rollen + Audit-Log (AP1 des Admin-Dashboards).
--
-- AUSGANGSLAGE: Bis hierher ist ALLES mandantengebunden. AuthContext kennt nur
-- user_id/tenant_id/role; jeder der 44 Slices scopet hart auf tenant_id
-- (Wurzel 3). Die Rolle „admin" ist der Gründer EINES Betriebs — NICHT der
-- Plattformbetreiber. Tenant-übergreifend gab es bisher nur den service_role-Key
-- und die Cron-Endpunkte mit INTERNAL_CRON_SECRET.
--
-- Diese Migration führt die ERSTE Rolle ein, die bewusst über Mandanten hinweg
-- sehen darf. Das ist der sicherheitskritischste Punkt des Systems: ein Fehler
-- hier öffnet alle Betriebe gegenseitig. Daher:
--
--   • Die Berechtigung lebt AUSSCHLIESSLICH in dieser Tabelle — NICHT im JWT
--     app_metadata. Der Server prüft sie bei JEDEM Request frisch gegen die DB
--     (Wurzel 7: eine entzogene Rolle darf nicht bis zum Token-Ablauf gelten).
--   • Kein anon/authenticated-Grant: nur service_role liest/schreibt. Ein Client
--     kann sich per anon-Key-curl weder eintragen noch die Liste lesen (Wurzel 6).
--   • Jede Admin-Aktion wird in platform_audit_log protokolliert — auch lesende,
--     weil das Einsehen fremder Mandantendaten selbst der Vorgang ist, der
--     nachvollziehbar sein muss.
--
-- Rollen:
--   platform_admin   — voller Backoffice-Zugriff inkl. schreibender Aktionen
--                      (Freigaben, Sperren, Ticket-Bearbeitung).
--   platform_support — nur lesend + Support-Tickets; keine Freigaben/Sperren.

create table if not exists public.platform_admins (
    -- Verweis auf den GoTrue-Nutzer. Ein Plattform-Admin ist ein ganz normaler
    -- Auth-User, der ZUSÄTZLICH hier steht — er kann daneben Tenant-Nutzer sein.
    user_id uuid primary key references auth.users (id) on delete cascade,

    role text not null default 'platform_support'
        check (role in ('platform_admin', 'platform_support')),

    -- Klartext-Notiz, wer das ist (Betriebsdoku, kein Auth-Feld).
    note text,

    -- Wer den Zugang vergeben hat (Audit; NULL wenn der Vergebende gelöscht wird).
    granted_by uuid references auth.users (id) on delete set null,
    created_at timestamptz not null default now(),

    -- Zugang temporär deaktivieren, ohne die Zeile (und damit die Historie) zu
    -- verlieren. Der Guard prüft aktiv = true (fail-closed).
    active boolean not null default true
);

comment on table public.platform_admins is
    'Plattform-Betreiber mit mandantenübergreifendem Backoffice-Zugriff. Die '
    'Berechtigung wird bei JEDEM Request serverseitig gegen diese Tabelle '
    'geprüft (nie nur aus dem JWT). Nur service_role liest/schreibt.';

-- --- Audit-Log ---------------------------------------------------------------
-- Protokolliert JEDE Backoffice-Aktion. Bewusst append-only gedacht: es gibt
-- keinen Update-/Delete-Pfad im Service. Zeilen bleiben auch, wenn der Admin
-- später entfernt wird (deshalb kein on delete cascade auf actor_user_id).

create table if not exists public.platform_audit_log (
    id uuid primary key default gen_random_uuid(),

    -- Wer hat gehandelt (bleibt erhalten, auch wenn der Zugang entzogen wird).
    actor_user_id uuid not null,
    actor_email text,

    -- Was wurde getan, z. B. 'tenant.view', 'property.approve', 'photo.reject'.
    action text not null,
    -- Worauf: Typ + ID des betroffenen Objekts (frei, weil über viele Domänen).
    target_type text,
    target_id text,
    -- Welcher Mandant war betroffen (für „wer hat in MEINE Daten geschaut").
    tenant_id uuid,

    -- Freies Detail-Feld (z. B. Ablehnungsgrund, geänderte Felder).
    detail jsonb not null default '{}'::jsonb,

    -- Herkunft des Requests (Missbrauchserkennung).
    ip text,
    user_agent text,

    created_at timestamptz not null default now()
);

create index if not exists platform_audit_log_actor_idx
    on public.platform_audit_log (actor_user_id, created_at desc);
create index if not exists platform_audit_log_tenant_idx
    on public.platform_audit_log (tenant_id, created_at desc);
create index if not exists platform_audit_log_action_idx
    on public.platform_audit_log (action, created_at desc);

comment on table public.platform_audit_log is
    'Append-only Protokoll aller Backoffice-Aktionen (auch lesender). Nur '
    'service_role schreibt; es gibt keinen Update-/Delete-Pfad im Service.';

-- --- Härtung (Wurzel 6): RLS + harter GRANT-Entzug ---------------------------
-- Beide Tabellen sind maximal sensibel: die eine VERGIBT mandantenübergreifende
-- Rechte, die andere enthält die Spur, wer welche fremden Daten gesehen hat.
alter table public.platform_admins enable row level security;
alter table public.platform_audit_log enable row level security;

revoke all on public.platform_admins from anon, authenticated;
revoke all on public.platform_audit_log from anon, authenticated;

-- Restriktive Deny-all-Policy für Nicht-service_role. Anders als bei den
-- tenant-Tabellen gibt es hier KEINEN legitimen Client-Direktpfad: weder ein
-- Tenant-Nutzer noch ein Plattform-Admin greift per anon-Key zu — der Zugriff
-- läuft ausschließlich über den FastAPI-Slice mit service_role. Selbst wenn
-- versehentlich ein Grant gesetzt würde, bliebe die Tabelle damit dicht.
create policy platform_admins_deny_all on public.platform_admins
    as restrictive for all
    using (false)
    with check (false);

create policy platform_audit_log_deny_all on public.platform_audit_log
    as restrictive for all
    using (false)
    with check (false);
