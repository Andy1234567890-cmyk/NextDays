-- 0086_tenant_site_config.sql — White-Label-Site-Fundament (Phase 1a)
--
-- Macht aus der bisher global-gemischten Buchungsplattform (plattform/) per-
-- Agentur white-label Sites: jede Agentur (Tenant) bekommt eigenes Branding und
-- eine eigene Custom-Domain. Zwei Tabellen:
--
--   tenant_site_config   = Branding + Site-Texte + Buchungsmodus, 1:1 pro Tenant.
--   tenant_custom_domains = die Custom-Domains der Agentur, EINE Zeile pro Domain
--                           (nicht als Array), mit Cloudflare-Custom-Hostname-ID
--                           und gespiegeltem Status. unique(domain) garantiert:
--                           eine Domain gehört genau EINEM Tenant (Hijacking-Schutz).
--
-- Edge/TLS läuft über Cloudflare for SaaS (Custom Hostnames) — der Zert-Lebens-
-- zyklus liegt bei Cloudflare; hier wird nur dessen Status gespiegelt.
--
-- WICHTIG (RLS-Reichweite): Beide Policies scopen über public.current_tenant_id(),
-- das den tenant aus dem JWT liest. Die ÖFFENTLICHE Buchungs-Site hat KEIN JWT →
-- diese Policies greifen dort nicht. Der öffentliche „resolve_site_by_domain"-
-- Lesepfad läuft daher bewusst über die service_role (wie der booking_engine-
-- Slice) und gibt NUR öffentliche Branding-Felder zurück (kein cf_*-Feld, kein
-- Status). Die RLS hier ist der default-deny-Backstop für den Dashboard-Zugriff.

-- == tenant_site_config: Branding + Site-Texte + Buchungsmodus (1:1 pro Tenant) ==
create table if not exists public.tenant_site_config (
    id              uuid primary key default gen_random_uuid(),
    tenant_id       uuid not null unique
                    references public.tenants (id) on delete cascade,
    site_name       text,
    tagline         text,
    logo_url        text,
    hero_image_url  text,
    -- Markenfarben als 6-stelliger Hex; KEIN Default (NULL = nicht gesetzt, das
    -- Frontend fällt dann auf die Marktplatz-Defaults zurück — kein erfundener Wert).
    primary_color   text check (primary_color is null
                                or primary_color ~ '^#[0-9a-fA-F]{6}$'),
    secondary_color text check (secondary_color is null
                                or secondary_color ~ '^#[0-9a-fA-F]{6}$'),
    font_family     text,
    -- Mehrsprachige Texte: Locale → Text (Muster property_addons.name). Leeres
    -- Objekt = noch nichts gepflegt.
    about_text      jsonb not null default '{}'::jsonb,
    contact_text    jsonb not null default '{}'::jsonb,
    -- {"instagram":"…","facebook":"…", …}
    social_links    jsonb not null default '{}'::jsonb,
    -- Buchungsmodus pro Site. Backend kann aktuell nur 'instant' (Sofortbuchung);
    -- 'inquiry'/'both' werden gespeichert + im UI vorbereitet, der Anfrage-Flow
    -- selbst kommt in Phase 1c.
    booking_mode    text not null default 'instant'
                    check (booking_mode in ('instant', 'inquiry', 'both')),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create trigger set_updated_at before update on public.tenant_site_config
    for each row execute function public.set_updated_at();

-- == tenant_custom_domains: eine Zeile pro Custom-Domain ==
create table if not exists public.tenant_custom_domains (
    id                   uuid primary key default gen_random_uuid(),
    tenant_id            uuid not null
                         references public.tenants (id) on delete cascade,
    -- Im Service immer lowercase normalisiert; unique verhindert, dass dieselbe
    -- Domain zwei Tenants zugeordnet wird (zentrale Sicherheitsgarantie).
    domain               text not null,
    constraint tenant_custom_domains_domain_key unique (domain),
    -- Cloudflare-Custom-Hostname-ID (Referenz für sync/delete gegen die CF-API).
    cf_custom_hostname_id text,
    -- Gespiegelter Cloudflare-Status. 'pending' bis CF validiert + Zert aktiv ist.
    status               text not null default 'pending'
                         check (status in ('pending', 'active', 'error')),
    ssl_status           text,            -- CF-SSL-Detailstatus (Debug)
    last_synced_at       timestamptz,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now()
);

create index if not exists tenant_custom_domains_tenant_idx
    on public.tenant_custom_domains (tenant_id);
create index if not exists tenant_custom_domains_domain_idx
    on public.tenant_custom_domains (domain);

create trigger set_updated_at before update on public.tenant_custom_domains
    for each row execute function public.set_updated_at();

-- == RLS: beide tenant-direkt (Agentur verwaltet ihre eigene Site). default-deny
-- für anon/authenticated ohne passenden tenant; service_role bypassed (öffentlicher
-- Resolver). ==
alter table public.tenant_site_config enable row level security;
create policy tenant_site_config_tenant on public.tenant_site_config
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

alter table public.tenant_custom_domains enable row level security;
create policy tenant_custom_domains_tenant on public.tenant_custom_domains
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- == Realtime: Dashboard aktualisiert live, sobald ein Domain-Status von
-- 'pending' auf 'active' springt (Projekt-Grundsatz: alles über WebSocket). ==
alter table public.tenant_site_config replica identity full;
alter table public.tenant_custom_domains replica identity full;
alter publication supabase_realtime add table public.tenant_site_config;
alter publication supabase_realtime add table public.tenant_custom_domains;
