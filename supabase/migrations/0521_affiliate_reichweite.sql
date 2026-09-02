-- 0521 — Reichweiten-Tracking je Kanal und Beitrag (Partnerprogramm, Etappe 6).
--
-- Bisher: Reichweite = Selbstauskunft (`affiliates.channels[].followers`),
-- Klicks und Kunden = gemessen (affiliate_clicks / affiliate_referrals). Diese
-- Migration bringt die drei Stufen aus docs/AFFILIATE-PROGRAMM-PLAN.md:
--
--   A  Beiträge (`affiliate_posts`): der Partner erzeugt je Reel/Video/Post
--      einen eigenen Link (bestehender Code + utm_content). Klicks stehen
--      schon in affiliate_clicks.utm; die Registrierung merkt sich den
--      Beitrag in `affiliate_referrals.post_id`, weil Klickzeilen nach 90
--      Tagen gelöscht werden (partner_laeufe.klicks_aufraeumen) — ohne die
--      Spalte verlöre der Beitrag seine Kunden mit dem Klick.
--   B  Plattform-Anbindung per OAuth (`affiliate_channel_connections`):
--      Follower/Views aus der Quelle (YouTube, Instagram/Facebook, TikTok),
--      täglich ein Snapshot je Kanal (`affiliate_channel_snapshots`) und je
--      Beitrag (`affiliate_post_metrics`).
--   C  Verdachtsprüfung: Schwellen als DATEN (`affiliate_reach_thresholds`,
--      Wurzel 4), Flags sind Hinweise, keine Sperre.
--
-- WURZEL 5b — measured_at ist der Zeitstempel der PLATTFORMANTWORT (HTTP-
-- Date-Header bzw. Zeitfeld der API), nie unsere Uhr. created_at beschreibt
-- unsere Verarbeitung und heißt auch so.
--
-- WURZEL 6 — alles service_role-only: RLS an, `revoke all`, deny-all-Backstop
-- wie 0517. Token liegen zusätzlich verschlüsselt (AES-GCM, Schlüssel
-- AFFILIATE_TOKEN_KEY aus der Umgebung) — anders als whatsapp_account (0255,
-- Klartext hinter dem Grant-Entzug): hier sind es Zugänge zu FREMDEN Konten
-- von Privatpersonen, ein Dump der Tabelle darf nicht reichen.

-- =========================================================================
-- 1. Beiträge (Stufe A)
-- =========================================================================
create table if not exists public.affiliate_posts (
    id               uuid primary key default gen_random_uuid(),
    affiliate_id     uuid not null references public.affiliates (id) on delete cascade,
    code_id          uuid not null references public.affiliate_referral_codes (id) on delete cascade,
    -- Plattform aus features/affiliates/kanaele.py (kein Enum: die Liste
    -- lebt im Code und in zwei Frontend-Kopien, ein DB-Enum wäre die vierte).
    platform         text not null,
    -- Adresse des veröffentlichten Beitrags. NULL, solange der Partner den
    -- Link erst erzeugt und den Beitrag danach veröffentlicht.
    url              text,
    title            text not null,
    -- Wert des utm_content-Parameters im Link — je Code eindeutig, damit
    -- Klicks (affiliate_clicks.utm->>'utm_content') genau EINEM Beitrag
    -- zugeordnet werden.
    utm_content      text not null,
    -- Kennung des Beitrags bei der Plattform (Video-ID, Media-ID), gesetzt
    -- sobald ein Snapshot ihn über die URL wiedergefunden hat.
    external_post_id text,
    -- Veröffentlichung laut Partner (Wurzel 5b: kein Ersatz durch unsere Uhr).
    published_at     timestamptz,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),
    constraint affiliate_posts_utm_content_format
        check (utm_content ~ '^[a-z0-9][a-z0-9._-]{1,79}$'),
    constraint affiliate_posts_title_len check (char_length(title) between 1 and 200)
);

create unique index if not exists affiliate_posts_code_utm_uq
    on public.affiliate_posts (code_id, utm_content);
create index if not exists affiliate_posts_affiliate_idx
    on public.affiliate_posts (affiliate_id, created_at desc);
create index if not exists affiliate_posts_external_idx
    on public.affiliate_posts (platform, external_post_id)
    where external_post_id is not null;

comment on table public.affiliate_posts is
    'Beiträge (Reel, Video, Post) eines Partners mit eigenem Link (Code + utm_content). '
    'Klicks aus affiliate_clicks.utm, Kunden über affiliate_referrals.post_id. Nur service_role.';

alter table public.affiliate_referrals
    add column if not exists post_id uuid references public.affiliate_posts (id) on delete set null;
create index if not exists affiliate_referrals_post_idx
    on public.affiliate_referrals (post_id)
    where post_id is not null;

comment on column public.affiliate_referrals.post_id is
    'Beitrag, über dessen Link die Registrierung kam (aus click.utm.utm_content beim '
    'Anlegen aufgelöst). Bleibt stehen, wenn der Klick nach 90 Tagen gelöscht wird.';

-- =========================================================================
-- 2. Verbundene Plattform-Konten (Stufe B)
-- =========================================================================
create table if not exists public.affiliate_channel_connections (
    id                   uuid primary key default gen_random_uuid(),
    affiliate_id         uuid not null references public.affiliates (id) on delete cascade,
    -- OAuth-Anbieter ('youtube', 'meta', 'tiktok') — EIN Meta-Login liefert
    -- Instagram- UND Facebook-Konten, deshalb getrennt von `platform`.
    provider             text not null check (provider in ('youtube', 'meta', 'tiktok')),
    platform             text not null check (platform in ('youtube', 'instagram', 'facebook', 'tiktok')),
    -- Kennung des Kontos bei der Plattform (Channel-ID, IG-User-ID, Page-ID, open_id).
    external_account_id  text not null,
    account_name         text,
    account_url          text,
    -- AES-GCM-verschlüsselt (base64: nonce || ciphertext), Schlüssel
    -- AFFILIATE_TOKEN_KEY. Entschlüsselt wird ausschließlich im Worker/Service.
    access_token_enc     text not null,
    refresh_token_enc    text,
    token_expires_at     timestamptz,
    scopes               text[] not null default '{}',
    connected_at         timestamptz not null default now(),
    -- Widerruf: durch den Partner („Verbindung trennen") oder weil die
    -- Plattform den Zugriff entzogen hat (401/403 beim Abruf). Snapshots
    -- bleiben als Historie stehen.
    revoked_at           timestamptz,
    revoked_reason       text,
    last_sync_at         timestamptz,
    last_error           text,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now()
);

create unique index if not exists affiliate_channel_connections_konto_uq
    on public.affiliate_channel_connections (affiliate_id, platform, external_account_id);
create index if not exists affiliate_channel_connections_aktiv_idx
    on public.affiliate_channel_connections (platform, last_sync_at)
    where revoked_at is null;

comment on table public.affiliate_channel_connections is
    'Vom Partner freiwillig verbundene Plattform-Konten (OAuth). Token AES-GCM-verschlüsselt. '
    'revoked_at gesetzt = getrennt/entzogen; Historie in affiliate_channel_snapshots bleibt.';

-- =========================================================================
-- 3. Tages-Snapshots je Kanal
-- =========================================================================
create table if not exists public.affiliate_channel_snapshots (
    id               uuid primary key default gen_random_uuid(),
    connection_id    uuid not null references public.affiliate_channel_connections (id) on delete cascade,
    affiliate_id     uuid not null references public.affiliates (id) on delete cascade,
    platform         text not null,
    -- Zeitpunkt der Plattformantwort (HTTP-Date bzw. API-Zeitfeld), Wurzel 5b.
    measured_at      timestamptz not null,
    -- Tag von measured_at (UTC) — EIN Snapshot je Kanal und Tag.
    snapshot_date    date not null,
    followers        integer check (followers is null or followers >= 0),
    -- Views der letzten 28 Tage. Instagram liefert den Kontowert; YouTube und
    -- TikTok liefern ohne Analytics-Scope nur Views je Video — dort ist es
    -- die Summe über die in den 28 Tagen veröffentlichten Beiträge (im
    -- Backoffice so beschriftet, nicht als Kontowert ausgegeben).
    views_28d        bigint check (views_28d is null or views_28d >= 0),
    -- (Likes + Kommentare [+ Shares + Saves]) / Views der letzten Beiträge,
    -- als Faktor (0.0312 = 3,12 %).
    engagement_rate  numeric(7,5) check (engagement_rate is null or engagement_rate >= 0),
    posts_count      integer check (posts_count is null or posts_count >= 0),
    raw              jsonb not null default '{}'::jsonb,
    created_at       timestamptz not null default now()
);

create unique index if not exists affiliate_channel_snapshots_tag_uq
    on public.affiliate_channel_snapshots (connection_id, snapshot_date);
create index if not exists affiliate_channel_snapshots_affiliate_idx
    on public.affiliate_channel_snapshots (affiliate_id, snapshot_date desc);

-- =========================================================================
-- 4. Kennzahlen je Beitrag
-- =========================================================================
create table if not exists public.affiliate_post_metrics (
    id            uuid primary key default gen_random_uuid(),
    post_id       uuid not null references public.affiliate_posts (id) on delete cascade,
    measured_at   timestamptz not null,
    metric_date   date not null,
    views         bigint check (views is null or views >= 0),
    likes         integer check (likes is null or likes >= 0),
    comments      integer check (comments is null or comments >= 0),
    shares        integer check (shares is null or shares >= 0),
    saves         integer check (saves is null or saves >= 0),
    raw           jsonb not null default '{}'::jsonb,
    created_at    timestamptz not null default now()
);

create unique index if not exists affiliate_post_metrics_tag_uq
    on public.affiliate_post_metrics (post_id, metric_date);

-- =========================================================================
-- 5. Schwellen der Verdachtsprüfung (Stufe C) — Daten, kein Code
-- =========================================================================
-- value NULL = Regel aus. Die Startwerte sind bewusst konservativ und werden
-- nach den ersten Wochen mit echten Daten festgelegt (Plan, Abschnitt 7).
create table if not exists public.affiliate_reach_thresholds (
    key         text primary key,
    value       numeric(12,4),
    description text not null,
    updated_at  timestamptz not null default now()
);

insert into public.affiliate_reach_thresholds (key, value, description) values
    ('follower_jump_pct_7d', 30,
     'Follower-Sprung in 7 Tagen in Prozent, ab dem geflaggt wird, wenn die Views nicht mitwachsen'),
    ('follower_jump_min_followers', 1000,
     'Mindest-Followerzahl, ab der der Follower-Sprung überhaupt geprüft wird'),
    ('low_engagement_rate_pct', 0.5,
     'Engagement-Rate in Prozent, unter der bei großer Followerzahl geflaggt wird'),
    ('low_engagement_min_followers', 50000,
     'Followerzahl, ab der „große Followerzahl" für die Engagement-Regel gilt'),
    ('self_report_deviation_pct', 25,
     'Abweichung Selbstauskunft zu verifizierter Followerzahl in Prozent, ab der geflaggt wird'),
    ('views_without_click_min', 5000,
     'Views eines Beitrags, ab denen ohne einen einzigen Klick geflaggt wird')
on conflict (key) do nothing;

comment on table public.affiliate_reach_thresholds is
    'Schwellen der Reichweiten-Verdachtsprüfung. value NULL = Regel aus. Flags sind Hinweise '
    'fürs Backoffice, keine automatische Sperre.';

-- =========================================================================
-- 6. Härtung (Wurzel 6) + updated_at
-- =========================================================================
do $$
declare
    t text;
begin
    foreach t in array array[
        'affiliate_posts', 'affiliate_channel_connections',
        'affiliate_channel_snapshots', 'affiliate_post_metrics',
        'affiliate_reach_thresholds'
    ] loop
        execute format('alter table public.%I enable row level security', t);
        execute format('revoke all on public.%I from anon, authenticated', t);
        execute format('drop policy if exists %I on public.%I', t || '_deny_all', t);
        execute format(
            'create policy %I on public.%I as restrictive for all '
            'using (false) with check (false)',
            t || '_deny_all', t
        );
    end loop;
end $$;

do $$
declare
    t text;
begin
    foreach t in array array['affiliate_posts', 'affiliate_channel_connections'] loop
        execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
        execute format(
            'create trigger %I before update on public.%I '
            'for each row execute function public.affiliate_touch_updated_at()',
            t || '_touch', t
        );
    end loop;
end $$;
