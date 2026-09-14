-- 0686_datev_exports.sql — Protokoll der DATEV-Exportläufe (Bereich »datev«)
--
-- Jeder Export (Buchungsstapel oder Debitoren/Kreditoren-Stammdaten) wird hier
-- festgehalten: Zeitraum, gewählte Belegarten, Anzahl der Datensätze, Hash des
-- Inhalts, Ablageort im privaten Bucket `datev-exports` (0687) und Status.
--
-- IDEMPOTENZ (Wurzel 2): Der Export ist ein Knopf, der doppelt gedrückt wird,
-- und ein Aufruf, der nach einem Timeout wiederholt wird. `content_hash` ist
-- die SHA-256 über die DATENZEILEN der Datei (ohne die Kopfzeile, die den
-- Erzeugungszeitpunkt trägt). Gleicher Zeitraum + gleicher Typ + gleicher Hash
-- = derselbe Lauf: der Service liefert die bestehende Zeile zurück, der
-- Unique-Index ist der DB-Backstop gegen das Rennen zweier gleichzeitiger
-- Aufrufe. Ändert sich der Inhalt (eine Rechnung kam dazu), entsteht ein NEUER
-- Lauf mit neuem Hash — beide bleiben nachvollziehbar (GoBD: was wurde wann an
-- den Berater gegeben).
--
-- `warnungen`: Liste von Hinweisen aus dem Lauf (Zeichen, die Windows-1252
-- nicht kennt und ersetzt wurden; gekürzte Buchungstexte). Sie brechen den
-- Export nicht, müssen aber sichtbar sein (Wurzel 5: nichts still kürzen).
--
-- Finanzdaten sind server-only (Wurzel 6): RLS + revoke, keine Realtime-
-- Publikation. Die Datei selbst kommt NUR über `GET /datev/exports/{id}/download`
-- aus dem Server, nie über eine Bucket-Adresse.

create table if not exists public.datev_exports (
    id             uuid primary key default gen_random_uuid(),
    tenant_id      uuid not null references public.tenants(id) on delete cascade,
    export_type    text not null check (export_type in ('buchungsstapel', 'stammdaten')),
    date_from      date not null,
    date_to        date not null,
    -- Gewählte Belegarten des Buchungsstapels (leer beim Stammdaten-Export).
    belegarten     text[] not null default '{}',
    anzahl         integer not null check (anzahl >= 0),
    content_hash   text not null check (content_hash ~ '^[0-9a-f]{64}$'),
    dateiname      text not null,
    storage_pfad   text not null,
    groesse        integer not null check (groesse >= 0),
    status         text not null check (status in ('erstellt', 'fehlgeschlagen')),
    kontenrahmen   text not null check (kontenrahmen in ('SKR03', 'SKR04')),
    warnungen      jsonb not null default '[]'::jsonb,
    created_by     uuid,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),
    constraint datev_exports_zeitraum check (date_to >= date_from),
    constraint datev_exports_idempotent unique (tenant_id, export_type, date_from, date_to, content_hash)
);

comment on table public.datev_exports is
    'DATEV-Exportläufe (EXTF-CSV). Gleicher Tenant+Typ+Zeitraum+Inhalts-Hash = '
    'derselbe Lauf (Unique-Backstop). Datei im privaten Bucket datev-exports.';

create index if not exists datev_exports_tenant_created_idx
    on public.datev_exports (tenant_id, created_at desc);

drop trigger if exists trg_datev_exports_updated on public.datev_exports;
create trigger trg_datev_exports_updated
    before update on public.datev_exports
    for each row execute function public.set_updated_at();

alter table public.datev_exports enable row level security;

drop policy if exists datev_exports_tenant on public.datev_exports;
create policy datev_exports_tenant on public.datev_exports
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke select, insert, update, delete on public.datev_exports from anon, authenticated;
