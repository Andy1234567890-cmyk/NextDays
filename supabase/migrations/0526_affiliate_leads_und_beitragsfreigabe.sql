-- 0526 — Partnerprogramm: Lead-Liste im Backoffice + Prüfliste der Beitragsfreigabe
-- (Plan Abschnitt 7, Schritte 7f/7g, Entscheidung 02.09.2026)
--
--   1. `affiliate_leads`: mögliche Multiplikatoren (Coaches, Podcaster, Creator,
--      Co-Hosting-Agenturen), die das Team gezielt anspricht. Reine Backoffice-
--      Tabelle: RLS + deny-all, Lesen/Schreiben NUR über FastAPI mit
--      platform_admin (Wurzel 6). Klarnamen stehen hier in der DB, nie im Repo.
--      Nach Gewinn zeigt `affiliate_id` auf den angelegten Partner.
--   2. Beitragsfreigabe: fester Ablehnungsgrund (`reason_code`) neben dem
--      Freitext — die drei Content-Regeln des Zettels (nur offizielles Material,
--      keine Garantieversprechen, Kennzeichnung) werden damit auswertbar.
--   3. Bucket `affiliate-videos` nimmt jetzt auch Bild- und PDF-Beiträge an:
--      JEDER Beitrag wird vor Veröffentlichung vorgelegt, nicht nur Videos.
--      Kein SVG (Skripte), kein Office; Magic-Byte-Prüfung in
--      `video_freigabe.dateityp` bleibt die erste Instanz (Wurzel 8).

-- --- 1. Leads ---------------------------------------------------------------------------
create table if not exists public.affiliate_leads (
    id             uuid primary key default gen_random_uuid(),
    name           text not null,
    organisation   text,
    -- A = Coaches/Akademien, B = FeWo-Berater/Podcaster, C = Micro-Influencer/
    -- Side-Hustle, D = Co-Hosting-Agenturen/Property Manager (Zettel Abschnitt 6).
    category       text not null check (category in ('A', 'B', 'C', 'D')),
    -- Kanäle als jsonb-Liste {platform, url, handle, followers} — gleiche Form wie
    -- affiliates.channels (0519), damit Bewerbung und Lead vergleichbar bleiben.
    channels       jsonb not null default '[]'::jsonb,
    reach          integer check (reach is null or reach >= 0),
    country        text,
    language       text,
    status         text not null default 'open'
        check (status in ('open', 'contacted', 'in_talks', 'won', 'declined', 'parked')),
    owner_user_id  uuid references auth.users (id) on delete set null,
    next_step      text,
    next_step_at   date,
    notes          text,
    -- Nach Gewinn: der daraus entstandene Partner.
    affiliate_id   uuid references public.affiliates (id) on delete set null,
    created_by     uuid references auth.users (id) on delete set null,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);
create index if not exists affiliate_leads_status_idx
    on public.affiliate_leads (status, category, next_step_at);
create index if not exists affiliate_leads_owner_idx
    on public.affiliate_leads (owner_user_id)
    where owner_user_id is not null;
comment on table public.affiliate_leads is
    'Multiplikatoren-Liste des Partnerprogramms (Backoffice). Personenbezogene Daten '
    'öffentlicher Personen/Firmen — nur platform_admin über FastAPI; Aufbewahrung: '
    'declined/parked-Einträge werden nach 24 Monaten gelöscht (Datensparsamkeit).';

drop trigger if exists affiliate_leads_touch on public.affiliate_leads;
create trigger affiliate_leads_touch
    before update on public.affiliate_leads
    for each row execute function public.affiliate_touch_updated_at();

alter table public.affiliate_leads enable row level security;
revoke all on public.affiliate_leads from anon, authenticated;
drop policy if exists affiliate_leads_deny_all on public.affiliate_leads;
create policy affiliate_leads_deny_all on public.affiliate_leads
    as restrictive for all using (false) with check (false);

-- --- 2. Prüfliste ------------------------------------------------------------------------
alter table public.affiliate_posts
    add column if not exists review_reason_code text
        check (review_reason_code is null or review_reason_code in
               ('material', 'promise', 'disclosure', 'brand', 'other'));
comment on column public.affiliate_posts.review_reason_code is
    'Fester Ablehnungsgrund der letzten Entscheidung: material = nicht nur offizielles '
    'Material / eigene Bildschirmaufnahmen · promise = Garantie-/Erfolgsversprechen · '
    'disclosure = Kennzeichnung als Werbung fehlt · brand = Markenverstoß · other = Freitext.';
alter table public.affiliate_post_reviews
    add column if not exists reason_code text
        check (reason_code is null or reason_code in
               ('material', 'promise', 'disclosure', 'brand', 'other'));

-- --- 3. Bucket: Bild + PDF ----------------------------------------------------------------
update storage.buckets
   set allowed_mime_types = array[
        'video/mp4', 'video/quicktime', 'video/webm',
        'image/jpeg', 'image/png', 'application/pdf'
   ]
 where id = 'affiliate-videos';
