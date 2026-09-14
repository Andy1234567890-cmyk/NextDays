-- 0689_erechnung_e_invoice_transmissions.sql — Übertragungsprotokoll je E-Rechnung
--
-- WARUM: Ob und wohin eine E-Rechnung gegangen ist, muss nachweisbar sein
-- (GoBD, Streit mit dem Empfänger). Bisher stand `transmissionStatus` als
-- EIN Feld an der E-Rechnung — ein zweiter Versand überschrieb den ersten.
-- Hier ist jede Übertragung eine eigene Zeile:
--
--   * `channel`: `email` (Bereich »versand« schickt, wir protokollieren),
--     `peppol_manuell` (der Betrieb hat das XML in ein Peppol-Portal
--     hochgeladen und trägt es hier nach), `download` (jeder XML-Abruf über
--     GET /einvoices/{id}/xml wird automatisch protokolliert).
--   * `status`: `pending|sent|failed|downloaded`; `error` trägt den Fehlertext
--     eines fehlgeschlagenen Versands sichtbar, statt ihn zu verschlucken
--     (Wurzel 5).
--   * `e_invoice_id … on delete cascade`: das Protokoll gehört zur E-Rechnung;
--     die selbst hängt per restrict an der Rechnung und wird nie gelöscht.
--
-- Werte deckungsgleich mit den Pydantic-Literalen in
-- apps/api/src/features/buchhaltung/bereiche/erechnung/schemas.py.
-- Finanzdaten: server-only (Wurzel 6).

create table if not exists public.e_invoice_transmissions (
    id               uuid primary key default gen_random_uuid(),
    tenant_id        uuid not null references public.tenants(id) on delete cascade,
    e_invoice_id     uuid not null references public.e_invoices(id) on delete cascade,
    channel          text not null check (channel in ('email', 'peppol_manuell', 'download')),
    recipient        text,
    status           text not null check (status in ('pending', 'sent', 'failed', 'downloaded')),
    transmitted_at   timestamptz not null default now(),
    message_id       text,
    error            text,
    created_by       uuid,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create index if not exists e_invoice_transmissions_tenant_einvoice_idx
    on public.e_invoice_transmissions (tenant_id, e_invoice_id, transmitted_at desc);

drop trigger if exists trg_e_invoice_transmissions_updated on public.e_invoice_transmissions;
create trigger trg_e_invoice_transmissions_updated
    before update on public.e_invoice_transmissions
    for each row execute function public.set_updated_at();

alter table public.e_invoice_transmissions enable row level security;

drop policy if exists e_invoice_transmissions_tenant on public.e_invoice_transmissions;
create policy e_invoice_transmissions_tenant on public.e_invoice_transmissions
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke select, insert, update, delete on public.e_invoice_transmissions from anon, authenticated;
