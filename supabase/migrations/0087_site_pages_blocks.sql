-- 0087_site_pages_blocks.sql — Page-Builder: Seiten + Blöcke (Phase 1b)
--
-- Macht aus builder/ einen echten visuellen Page-Builder: jede Agentur (Tenant)
-- baut im Dashboard ihre eigene mehrseitige Website aus Blöcken. Zwei Tabellen:
--
--   site_pages   = die Seiten einer Agentur-Website (Home + Unterseiten), mit
--                  Slug, SEO-Feldern und Veröffentlichungs-Status.
--   site_blocks  = die Blöcke einer Seite (Hero, Text, Galerie, Objekt-Grid,
--                  Kontakt …), je Block ein type + position + content/settings
--                  (jsonb). Der Block-Baum wird vom Renderer in builder/ pro
--                  Custom-Domain ausgegeben.
--
-- WICHTIG (RLS-Reichweite, wie 0086): Beide Policies scopen über
-- public.current_tenant_id() (tenant aus JWT). Die ÖFFENTLICHE Agentur-Site hat
-- KEIN JWT → diese Policies greifen dort nicht. Der öffentliche Resolver
-- (resolve_page) läuft daher über die service_role und gibt NUR VERÖFFENTLICHTE
-- Seiten (is_published) + nur öffentliche Felder zurück (kein Cross-Tenant-Leak,
-- keine Entwürfe). Die RLS hier ist der default-deny-Backstop fürs Dashboard.

-- == site_pages: die Seiten einer Agentur-Website ==
create table if not exists public.site_pages (
    id              uuid primary key default gen_random_uuid(),
    tenant_id       uuid not null
                    references public.tenants (id) on delete cascade,
    -- Slug der Seite (lowercase, [a-z0-9-]). Leerstring = Home-Route "/".
    slug            text not null default '',
    title           text not null,
    seo_title       text,
    seo_description text,
    og_image_url    text,
    is_home         boolean not null default false,
    is_published    boolean not null default false,
    nav_order       integer not null default 0,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    constraint site_pages_tenant_slug_key unique (tenant_id, slug)
);

create index if not exists site_pages_tenant_idx
    on public.site_pages (tenant_id);
-- Genau EINE Home-Seite pro Tenant (harter DB-Backstop; der Service setzt beim
-- set_home_page alle anderen zuerst auf false).
create unique index if not exists site_pages_one_home_idx
    on public.site_pages (tenant_id) where is_home;

create trigger set_updated_at before update on public.site_pages
    for each row execute function public.set_updated_at();

-- == site_blocks: die Blöcke einer Seite ==
create table if not exists public.site_blocks (
    id          uuid primary key default gen_random_uuid(),
    -- tenant_id denormalisiert mitgeführt, damit die RLS-Policy direkt scopen
    -- kann (Muster wie 0086) und Realtime clientseitig pro Tenant filtert.
    tenant_id   uuid not null references public.tenants (id) on delete cascade,
    page_id     uuid not null
                references public.site_pages (id) on delete cascade,
    -- check statt enum: ohne `alter type` um weitere Block-Typen erweiterbar.
    type        text not null check (type in (
                    'hero', 'rich_text', 'image', 'gallery', 'button',
                    'spacer', 'contact', 'search', 'properties_grid',
                    'featured_properties'
                )),
    position    integer not null default 0,
    content     jsonb not null default '{}'::jsonb,
    settings    jsonb not null default '{}'::jsonb,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index if not exists site_blocks_page_position_idx
    on public.site_blocks (page_id, position);

create trigger set_updated_at before update on public.site_blocks
    for each row execute function public.set_updated_at();

-- == RLS: beide tenant-direkt (Agentur verwaltet ihre eigene Website).
-- default-deny für anon/authenticated ohne passenden tenant; service_role
-- bypassed (öffentlicher Resolver). ==
alter table public.site_pages enable row level security;
create policy site_pages_tenant on public.site_pages
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

alter table public.site_blocks enable row level security;
create policy site_blocks_tenant on public.site_blocks
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- == Realtime: Dashboard-Editor aktualisiert live, wenn Blöcke/Seiten sich
-- ändern (Projekt-Grundsatz: alles über WebSocket). ==
alter table public.site_pages replica identity full;
alter table public.site_blocks replica identity full;
alter publication supabase_realtime add table public.site_pages;
alter publication supabase_realtime add table public.site_blocks;
