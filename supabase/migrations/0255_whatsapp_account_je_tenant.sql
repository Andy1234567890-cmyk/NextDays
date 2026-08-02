-- 0255_whatsapp_account_je_tenant.sql — eine WhatsApp-Nummer JE BETRIEB
--
-- Bisher lief der Kanal über EINE globale Nummer plus die Umgebungsvariable
-- WHATSAPP_DEFAULT_TENANT_ID: jede eingehende Nachricht einer unbekannten
-- Nummer wurde einem einzigen Mandanten zugeschlagen. Das war ein Provisorium
-- und ist im Tech-Provider-Modell falsch — dort bringt JEDER Kunde seine eigene
-- WABA und eigene Nummer mit (Embedded Signup).
--
-- Zuordnung eingehender Webhooks (Meta-Payload):
--   entry[].id                     = WABA-ID          -> waba_id
--   entry[].changes[].value
--        .metadata.phone_number_id = Nummer-ID        -> phone_number_id
-- Beides zusammen identifiziert den Betrieb eindeutig. Ein zentraler Endpunkt
-- demultiplext darüber — kein Callback je Kunde (Meta-Doku: Webhooks Overview).
--
-- WURZEL 6: Hier liegt ein Zugangstoken für die Kundenkonten. Das ist so
-- sensibel wie Zahlungsdaten — `authenticated`/`anon` bekommen KEIN select,
-- update, insert oder delete. Nur die service_role (FastAPI) liest und
-- schreibt. Ohne diesen Entzug könnte ein eingeloggter cleaner das Token per
-- `curl /rest/v1/whatsapp_account` abholen und im Namen des Betriebs senden.

create table if not exists public.whatsapp_account (
    id                   uuid primary key default gen_random_uuid(),
    tenant_id            uuid not null unique
                           references public.tenants(id) on delete cascade,
    -- Metas Kennungen. waba_id + phone_number_id kommen aus dem
    -- Embedded-Signup-Callback und sind global eindeutig.
    waba_id              text not null,
    phone_number_id      text not null,
    display_phone_number text,
    verified_name        text,
    -- Business-Integration-System-User-Token, auf DIESEN Kunden begrenzt.
    -- Verschlüsselt ablegen (pgsodium/Vault ist hier nicht eingerichtet) —
    -- deshalb kompensiert der Grant-Entzug unten: nur service_role sieht es.
    access_token         text,
    token_expires_at     timestamptz,
    -- Betriebszustand, gespiegelt aus Metas health_status/phone_numbers.
    -- Kein Default „darf senden": fehlt der Wert, ist er unbekannt und der
    -- Sendepfad muss ihn prüfen, nicht raten (Wurzel 4).
    can_send_message     boolean,
    send_block_reason    text,
    quality_rating       text,
    messaging_limit_tier text,
    -- Onboarding-Verlauf: pending → connected → suspended/disconnected.
    status               text not null default 'pending'
                           check (status in (
                             'pending', 'connected', 'suspended', 'disconnected'
                           )),
    connected_at         timestamptz,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now(),
    -- Dieselbe Nummer darf nicht zwei Betrieben gehören (Idempotenz-Backstop
    -- gegen doppeltes Onboarding, Wurzel 2).
    unique (phone_number_id)
);

create index if not exists whatsapp_account_waba_idx
    on public.whatsapp_account (waba_id);

create trigger trg_whatsapp_account_updated
    before update on public.whatsapp_account
    for each row execute function public.set_updated_at();

-- =========================================================================
-- RLS + Grant-Entzug (Wurzel 6)
-- =========================================================================
alter table public.whatsapp_account enable row level security;

-- Tenant-Policy als Backstop. Sie allein genügt NICHT — sie erlaubt dem
-- eigenen Tenant sonst das Lesen des Tokens.
drop policy if exists whatsapp_account_tenant on public.whatsapp_account;
create policy whatsapp_account_tenant on public.whatsapp_account
    for all using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Der eigentliche Schutz: kein Direktzugriff über PostgREST/Realtime.
revoke all on public.whatsapp_account from anon, authenticated;

-- Restriktive Policy zusätzlich zum Grant-Entzug (Gürtel und Hosenträger):
-- greift auch, falls ein späteres Migrationsskript versehentlich neu grantet.
-- Bewusst `false`: über RLS darf NIEMAND an diese Zeilen. Die service_role
-- umgeht RLS ohnehin komplett, deshalb sperrt das nur den Direktpfad
-- (anon/authenticated über PostgREST und Realtime) — und genau das ist gewollt.
drop policy if exists whatsapp_account_service_only on public.whatsapp_account;
create policy whatsapp_account_kein_direktzugriff on public.whatsapp_account
    as restrictive for all
    using (false)
    with check (false);

comment on table public.whatsapp_account is
    'WhatsApp-Business-Konto je Betrieb (Embedded Signup). Enthält ein '
    'Kundentoken — nur service_role, NIE per anon-Key erreichbar.';
