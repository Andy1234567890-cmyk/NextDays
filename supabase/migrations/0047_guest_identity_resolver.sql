-- 0047_guest_identity_resolver.sql
-- Zentrale, kanalübergreifende Nachricht→Gast-Zuordnung (Resolver).
-- Bisher matchte nur channel_manager._upsert_guest per E-Mail und nur bei OTA-
-- Import; Inbox-Threads (channex_booking) trugen keinen guest_id-Link, WhatsApp/
-- Direkt liefen daran vorbei. Diese Migration legt die DB-Grundlage für EINEN
-- Resolver-Pfad (guests/identity.py):
--   1) channex_booking.guest_id  → Inbox-Thread direkt mit Gast verknüpfen
--   2) guest_external_ids        → kanal-spezifische externe IDs (OTA-Guest-ID,
--                                  WhatsApp-Nummer, external_ref) eindeutig je Kanal
--   3) guests.needs_review       → mehrdeutige Treffer markieren (manuelles Merge)
-- Tenant-scoped + RLS via public.current_tenant_id() (Muster 0023/0046).

-- ---------------------------------------------------------------------------
-- 1) channex_booking.guest_id — direkter Link Thread → Gast.
--    nullable (Alt-Zeilen ohne Gast; Backfill füllt sie nach), FK + Index.
-- ---------------------------------------------------------------------------
alter table public.channex_booking
    add column if not exists guest_id uuid
        references public.guests(id) on delete set null;

create index if not exists channex_booking_guest_idx
    on public.channex_booking(tenant_id, guest_id);

-- ---------------------------------------------------------------------------
-- 2) guests.needs_review — bei mehrdeutigem Treffer gesetzt (Resolver legt dann
--    konservativ neu an, statt falsch zu mergen). Manuelles Merge über /guests/merge.
-- ---------------------------------------------------------------------------
alter table public.guests
    add column if not exists needs_review boolean not null default false;

create index if not exists guests_needs_review_idx
    on public.guests(tenant_id, needs_review) where needs_review;

-- ---------------------------------------------------------------------------
-- 3) guest_external_ids — kanal-spezifische externe Identität (1:n je Gast).
--    Eindeutig pro (tenant, channel, external_id): dieselbe Kanal-ID gehört nie
--    zwei Gästen. DSGVO: gilt als personenbezogen → bei Anonymisierung mit löschen.
-- ---------------------------------------------------------------------------
create table if not exists public.guest_external_ids (
    id          uuid primary key default gen_random_uuid(),
    tenant_id   uuid not null references public.tenants(id) on delete cascade,
    guest_id    uuid not null references public.guests(id) on delete cascade,
    channel     text not null,                  -- ota|whatsapp|email|direct|… (Kanal-Quelle)
    external_id text not null,                  -- OTA-Guest-ID|WhatsApp-Nummer|external_ref
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    unique (tenant_id, channel, external_id)
);
create index if not exists guest_external_ids_guest_idx
    on public.guest_external_ids(guest_id);

-- ---------------------------------------------------------------------------
-- 4) whatsapp_conversation.guest_id — WhatsApp-Konversation an Gast knüpfen
--    (über den Resolver beim Inbound gesetzt). nullable, FK + Index.
-- ---------------------------------------------------------------------------
alter table public.whatsapp_conversation
    add column if not exists guest_id uuid
        references public.guests(id) on delete set null;

create index if not exists whatsapp_conversation_guest_idx
    on public.whatsapp_conversation(tenant_id, guest_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.guest_external_ids enable row level security;

create policy guest_external_ids_tenant on public.guest_external_ids
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
