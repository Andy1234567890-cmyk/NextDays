-- 0692_gobd_audit_log.sql — GoBD-Prüfprotokoll, append-only mit Hash-Kette
--
-- WARUM: Die GoBD verlangen, dass Festschreibung, Storno und Datenexport
-- NACHVOLLZIEHBAR und UNVERÄNDERBAR protokolliert sind (Rz. 58 ff., 107 ff.).
-- Das alte Werkzeug hatte eine `gobd_audit_log` (document_type, document_id,
-- action, old_data, new_data, user_id, ip_address) — ohne Schutz gegen
-- UPDATE/DELETE und ohne Verkettung: jede Zeile war für sich, und eine gelöschte
-- fehlte einfach. Hier gilt:
--
--   * APPEND-ONLY: der Trigger `gobd_audit_log_unveraenderlich` wirft bei JEDEM
--     UPDATE oder DELETE — auch für service_role. Es gibt keinen Korrekturweg
--     außer einem neuen Eintrag.
--   * HASH-KETTE: `hash` = sha256 über prev_hash + Mandant + Objekt + Aktion +
--     Nutzer + Zeit (sekundengenau) + Diff (kanonisches JSON, Schlüssel
--     sortiert). `prev_hash` ist der Hash des VORGÄNGERS desselben Mandanten;
--     der erste Eintrag trägt den Genesis-Wert (64 Nullen). Eine nachträglich
--     gelöschte oder geänderte Zeile bricht die Kette an genau EINER Stelle —
--     `GET /gobd/audit-log/verify` findet sie.
--   * `unique (tenant_id, prev_hash)`: zwei gleichzeitige Einträge, die denselben
--     Vorgänger sehen, kollidieren hier (23505); der Service liest den neuen
--     Kopf und hängt sich noch einmal an (Wurzel 2). Ohne diesen Backstop
--     entstünde eine Gabel, die die Kettenprüfung als Bruch meldet.
--   * `seq` ist die Verarbeitungsreihenfolge (Kettenprüfung läuft darüber);
--     `created_at` wird vom Service gesetzt und geht in den Hash ein — die
--     Prüfung rechnet sie sekundengenau zurück (Wurzel 5b: die Sekunde ist
--     unsere Verarbeitung, nicht das Fremdereignis; die fachlichen Zeitpunkte
--     stehen im Diff).
--
-- Aktionen deckungsgleich mit dem Pydantic-Literal in
-- apps/api/src/features/buchhaltung/bereiche/gobd/schemas.py:
--   lock            Beleg festgeschrieben (manuell oder automatisch)
--   unlock_denied   Entsperrung angefragt und verweigert (Festschreibung ist
--                   unumkehrbar; Korrektur nur per Storno)
--   storno          Stornobeleg zum festgeschriebenen Original erzeugt
--   export          Datenträgerüberlassung erzeugt (Zeitraum, Belegzahl, ZIP-Hash)
--   change          Einstellungen geändert (Vorher/Nachher)
--
-- Server-only (Wurzel 6): RLS + revoke für anon/authenticated, KEINE Realtime-
-- Publikation. Ein eingeloggter cleaner sieht per `curl /rest/v1/gobd_audit_log`
-- weder Zeilen noch kann er welche schreiben.

create table if not exists public.gobd_audit_log (
    id            uuid primary key default gen_random_uuid(),
    seq           bigserial not null,
    tenant_id     uuid not null references public.tenants(id) on delete restrict,
    object_type   text not null
                  check (object_type in ('invoice', 'settings', 'export', 'audit_log')),
    object_id     text not null,
    action        text not null
                  check (action in ('lock', 'unlock_denied', 'storno', 'export', 'change')),
    user_id       uuid,
    created_at    timestamptz not null,
    diff          jsonb not null default '{}'::jsonb,
    prev_hash     text not null check (prev_hash ~ '^[0-9a-f]{64}$'),
    hash          text not null check (hash ~ '^[0-9a-f]{64}$'),
    constraint gobd_audit_log_seq_eindeutig unique (seq),
    constraint gobd_audit_log_hash_eindeutig unique (tenant_id, hash),
    constraint gobd_audit_log_kette_eindeutig unique (tenant_id, prev_hash)
);

comment on table public.gobd_audit_log is
    'GoBD-Prüfprotokoll: append-only (Trigger), Hash-Kette je Mandant '
    '(prev_hash → hash). Kein UPDATE/DELETE, auch nicht für service_role.';

create index if not exists gobd_audit_log_tenant_seq_idx
    on public.gobd_audit_log (tenant_id, seq);
create index if not exists gobd_audit_log_tenant_objekt_idx
    on public.gobd_audit_log (tenant_id, object_type, object_id);
create index if not exists gobd_audit_log_tenant_zeit_idx
    on public.gobd_audit_log (tenant_id, created_at);

-- Append-only. `set search_path = ''` + Schema-Qualifikation wie bei jeder
-- Trigger-Funktion des Repos; kein SECURITY DEFINER nötig (wirft nur).
create or replace function public.gobd_audit_log_unveraenderlich()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    raise exception 'gobd_audit_log ist append-only: % auf Eintrag % (seq %) ist nicht erlaubt.',
        tg_op, old.id, old.seq
        using errcode = 'P0001',
              hint = 'Korrekturen werden als NEUER Protokolleintrag angehängt.';
end;
$$;

drop trigger if exists trg_gobd_audit_log_unveraenderlich on public.gobd_audit_log;
create trigger trg_gobd_audit_log_unveraenderlich
    before update or delete on public.gobd_audit_log
    for each row execute function public.gobd_audit_log_unveraenderlich();

-- Auch TRUNCATE ist ein Löschen.
create or replace function public.gobd_audit_log_kein_truncate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    raise exception 'gobd_audit_log ist append-only: TRUNCATE ist nicht erlaubt.'
        using errcode = 'P0001';
end;
$$;

drop trigger if exists trg_gobd_audit_log_kein_truncate on public.gobd_audit_log;
create trigger trg_gobd_audit_log_kein_truncate
    before truncate on public.gobd_audit_log
    for each statement execute function public.gobd_audit_log_kein_truncate();

alter table public.gobd_audit_log enable row level security;

drop policy if exists gobd_audit_log_tenant on public.gobd_audit_log;
create policy gobd_audit_log_tenant on public.gobd_audit_log
    for select
    using (tenant_id = public.current_tenant_id());

-- Wurzel 6: nur der Server schreibt und liest das Protokoll.
revoke select, insert, update, delete, truncate on public.gobd_audit_log from anon, authenticated;
revoke execute on function public.gobd_audit_log_unveraenderlich() from anon, authenticated;
revoke execute on function public.gobd_audit_log_kein_truncate() from anon, authenticated;
