-- 0691_gobd_settings.sql — GoBD-Einstellungen je Betrieb (Bereich »gobd« der Buchhaltung)
--
-- WARUM: Das alte Werkzeug hatte `gobd_settings` (auto_lock_on_send,
-- lock_delay_days, auto_lock_on_export, lock_deadline_days, allow_storno_after_lock,
-- require_approval_for_unlock, notification_settings) — mit `USING (true)`-RLS und
-- einem Frontend, das `gobd/settings` ins Leere rief
-- (docs/buchhaltung/TASKILO-ABGLEICH-NEXTDAYS.md §3d). Hier bekommt die Einstellung
-- eine Tabelle mit Mandanten-Scope, und die Fachregel wandert auf den Server:
--
--   * `auto_lock_mode` ist EIN Wert, keine Kombination aus drei Bools, die sich
--     widersprechen können: `on_send` (festschreiben, sobald der Beleg versendet
--     ist), `after_days` (N Tage nach Ausstellung), `manual` (nur per Hand).
--     Deckungsgleich mit dem Pydantic-Literal in
--     apps/api/src/features/buchhaltung/bereiche/gobd/schemas.py.
--   * `lock_after_days` ist nur bei `after_days` Pflicht (Check-Klausel).
--   * `retention_years` (Aufbewahrungsfrist) hat KEINEN Default — sie ist je
--     Land verschieden (DE 8/10 Jahre, DK 5, AT 7 …) und wird vom Betrieb
--     gesetzt. Ein erfundener „10"-Ersatzwert wäre eine falsche Rechtsauskunft
--     (Wurzel 4). Bis sie gesetzt ist, meldet GET `configured=false`.
--   * `audit_log_enabled` steuert nur die ZUSÄTZLICHEN Protokolleinträge
--     (`change`, `export`). `lock`, `unlock_denied` und `storno` werden IMMER
--     protokolliert — ein abschaltbares Festschreibungsprotokoll wäre keins.
--   * `auto_lock_on_export`, `allow_storno_after_lock`,
--     `require_approval_for_unlock`, `notification_settings` tragen die Form des
--     Bestands-Frontends (web/types/gobdTypes.ts), damit AutoLockSettings.tsx
--     ohne Umbau lesen und schreiben kann.
--
-- Eine Zeile je Mandant (tenant_id ist Primärschlüssel) — der Upsert im Service
-- ist damit idempotent (Wurzel 2).
--
-- Finanz-/Compliance-Daten sind server-only (Wurzel 6): RLS + revoke für
-- anon/authenticated, KEINE Realtime-Publikation.

create table if not exists public.gobd_settings (
    tenant_id                   uuid primary key references public.tenants(id) on delete cascade,
    auto_lock_mode              text not null default 'manual'
                                check (auto_lock_mode in ('on_send', 'after_days', 'manual')),
    lock_after_days             smallint check (lock_after_days between 0 and 366),
    retention_years             smallint check (retention_years between 1 and 30),
    audit_log_enabled           boolean not null default true,
    auto_lock_on_export         boolean not null default false,
    allow_storno_after_lock     boolean not null default true,
    require_approval_for_unlock boolean not null default true,
    notification_settings       jsonb not null default '{}'::jsonb,
    updated_by                  uuid,
    created_at                  timestamptz not null default now(),
    updated_at                  timestamptz not null default now(),
    constraint gobd_settings_tage_bei_after_days
        check (auto_lock_mode <> 'after_days' or lock_after_days is not null)
);

comment on table public.gobd_settings is
    'GoBD-Festschreibung je Betrieb: Modus der Auto-Festschreibung, Aufbewahrungsfrist '
    '(vom Betrieb gesetzt, kein Default), Prüfprotokoll. Server-only (Wurzel 6).';

drop trigger if exists trg_gobd_settings_updated on public.gobd_settings;
create trigger trg_gobd_settings_updated
    before update on public.gobd_settings
    for each row execute function public.set_updated_at();

alter table public.gobd_settings enable row level security;

drop policy if exists gobd_settings_tenant on public.gobd_settings;
create policy gobd_settings_tenant on public.gobd_settings
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Wurzel 6: der Direktpfad (PostgREST mit anon-Key + JWT) bleibt zu. Nur der
-- Server (service_role) liest und schreibt die Einstellung.
revoke select, insert, update, delete on public.gobd_settings from anon, authenticated;
