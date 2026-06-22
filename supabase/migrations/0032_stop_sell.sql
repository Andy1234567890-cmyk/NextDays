-- 0032_stop_sell.sql — Stop-Sell (gesperrte Verkaufstage) je Objekt/Tag
--
-- Eigene Tabelle (getrennt von availability), damit Stop-Sell verwaltbar und
-- auflösbar ist und nicht mit Buchungs-/Block-Status kollidiert. Quelle:
-- 'manual' (vom Betreiber gesetzt) oder 'channex' (aus ARI-Import, read-only).
-- availability bleibt die Wahrheit über belegt/frei; stop_sell steuert nur, ob
-- ein freier Tag aktiv zum Verkauf angeboten wird.

create type public.stop_sell_source as enum ('manual', 'channex');

create table public.stop_sell (
    id          uuid primary key default gen_random_uuid(),
    tenant_id   uuid not null references public.tenants (id) on delete cascade,
    property_id uuid not null references public.properties (id) on delete cascade,
    date        date not null,
    reason      text,
    source      public.stop_sell_source not null default 'manual',
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    unique (property_id, date)
);

create index stop_sell_tenant_id_idx on public.stop_sell (tenant_id);
create index stop_sell_property_date_idx on public.stop_sell (property_id, date);
