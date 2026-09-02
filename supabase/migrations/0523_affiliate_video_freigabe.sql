-- 0523 — Videofreigabe: kein Link ohne geprüftes Video.
--
-- ANLASS (Beschluss 02.09.2026): Ein Influencer, der über myNextDays wirbt,
-- spricht in unserem Namen. Bisher konnte er sich einen Beitragslink erzeugen
-- (0521) und ihn unter ein beliebiges Video setzen — wir sahen den Inhalt erst,
-- wenn er schon lief und Geld verdiente. Ab jetzt gilt die umgekehrte
-- Reihenfolge: Video hochladen → Backoffice prüft → DANN erst gibt es den Link.
--
-- WARUM DIE DATEI UND NICHT NUR EINE URL: geprüft wird VOR der
-- Veröffentlichung. Eine eingereichte URL setzt voraus, dass das Video bereits
-- öffentlich ist — dann ist der Schaden im Zweifel schon entstanden. Der
-- Upload dreht das um.
--
-- WO DIE SPERRE SITZT: `beitraege.link_bauen` gibt `None` zurück, solange
-- `review_status <> 'approved'`. Die Sperre gehört an die EINE Stelle, an der
-- der Link entsteht — nicht in die Oberfläche. Ein Partner, der die API direkt
-- anspricht, bekommt sonst genau den Link, den wir zurückhalten wollten
-- (Wurzel 3: dem Client nicht vertrauen).
--
-- WIDERRUF: `rejected` nach einer Freigabe macht den Link sofort tot (er wird
-- nicht mehr gebaut, und `/p/CODE` mit diesem utm_content leitet nicht weiter).
-- Bereits verdiente Provision aus echten Kunden bleibt bestehen — sie
-- rückwirkend zu streichen wäre ein Eingriff in einen erfüllten
-- Provisionsanspruch (Handelsvertreterrecht) und ist ausdrücklich NICHT
-- gewollt. Wurzel 1: der Gegenzustand ist der tote Link, nicht die Rücknahme
-- des Geldes.

-- --- 1. Prüfstand am Beitrag -------------------------------------------------
alter table public.affiliate_posts
    -- 'draft'      = angelegt, noch kein Video hochgeladen (kein Link)
    -- 'submitted'  = Video liegt, wartet auf das Backoffice (kein Link)
    -- 'approved'   = freigegeben → Link wird gebaut
    -- 'rejected'   = abgelehnt oder Freigabe widerrufen (kein Link)
    add column if not exists review_status text not null default 'draft'
        check (review_status in ('draft', 'submitted', 'approved', 'rejected')),
    -- Begründung der Ablehnung — der Partner MUSS erfahren, warum, sonst lädt
    -- er dasselbe Video noch einmal hoch.
    add column if not exists review_note text,
    add column if not exists reviewed_by uuid references auth.users (id) on delete set null,
    add column if not exists reviewed_at timestamptz,
    -- Pfad im privaten Bucket 'affiliate-videos'. NULL, solange nichts liegt.
    add column if not exists video_path text,
    add column if not exists video_size bigint,
    add column if not exists video_mime text,
    add column if not exists video_uploaded_at timestamptz,
    -- Wie oft der Partner nachgebessert hat. Rein informativ fürs Backoffice
    -- („dritter Anlauf") — kein Gate, damit niemand ausgesperrt wird.
    add column if not exists review_runde integer not null default 0;

create index if not exists affiliate_posts_review_idx
    on public.affiliate_posts (review_status, created_at desc);

comment on column public.affiliate_posts.review_status is
    'Freigabestand des Beitrags (0523). Nur bei ''approved'' baut '
    'beitraege.link_bauen einen Link — ohne Freigabe kein Link und damit kein '
    'Verdienst. ''rejected'' nach Freigabe macht den Link sofort tot; bereits '
    'verdiente Provision bleibt bestehen.';
comment on column public.affiliate_posts.video_path is
    'Pfad im privaten Bucket affiliate-videos. Zugriff NUR über kurzlebige '
    'signierte Adressen aus der API — der Bucket ist nicht öffentlich.';

-- Bestandsbeiträge (0521) haben noch keine Prüfung durchlaufen. Sie auf
-- 'approved' zu setzen wäre eine Freigabe, die nie jemand erteilt hat; sie auf
-- 'draft' zu lassen nimmt einem laufenden Beitrag rückwirkend den Link.
-- Deshalb: wer schon eine veröffentlichte URL trägt, gilt als bestandsgeschützt
-- ('approved' mit Vermerk), alles andere beginnt bei 'draft'.
update public.affiliate_posts
   set review_status = 'approved',
       review_note   = 'Bestand vor 0523 — ohne Prüfung übernommen.'
 where review_status = 'draft'
   and url is not null;

-- --- 2. Protokoll der Prüfschritte -------------------------------------------
-- Warum eine eigene Tabelle: „wer hat wann warum freigegeben oder widerrufen"
-- ist bei einem Werbevideo eine Haftungsfrage. Nur den aktuellen Stand zu
-- führen hieße, nach dem dritten Anlauf nicht mehr sagen zu können, was beim
-- ersten beanstandet wurde.
create table if not exists public.affiliate_post_reviews (
    id           uuid primary key default gen_random_uuid(),
    post_id      uuid not null references public.affiliate_posts (id) on delete cascade,
    affiliate_id uuid not null references public.affiliates (id) on delete cascade,
    -- 'submitted' (Partner reicht ein), 'approved', 'rejected', 'revoked'
    aktion       text not null check (aktion in ('submitted', 'approved', 'rejected', 'revoked')),
    note         text,
    actor        uuid references auth.users (id) on delete set null,
    created_at   timestamptz not null default now()
);

create index if not exists affiliate_post_reviews_post_idx
    on public.affiliate_post_reviews (post_id, created_at desc);

comment on table public.affiliate_post_reviews is
    'Protokoll der Videofreigabe je Beitrag (0523) — wer hat wann warum '
    'freigegeben, abgelehnt oder widerrufen. Haftungsrelevant. Nur service_role.';

-- --- 3. RLS + Grants (Wurzel 6) ----------------------------------------------
alter table public.affiliate_post_reviews enable row level security;

revoke all on public.affiliate_post_reviews from anon, authenticated;

drop policy if exists affiliate_post_reviews_deny on public.affiliate_post_reviews;
create policy affiliate_post_reviews_deny on public.affiliate_post_reviews
    as restrictive for all
    to anon, authenticated
    using (false)
    with check (false);

-- --- 4. Bucket für die Videos ------------------------------------------------
-- PRIVAT: ein unveröffentlichtes Video eines Influencers darf nicht über eine
-- ratbare Adresse abrufbar sein. Zugriff ausschließlich über kurzlebige
-- signierte Adressen aus der API (Muster site-form-uploads, 0445).
--
-- 200 MB: ein Reel/Short in guter Qualität liegt bei 20–80 MB, ein längeres
-- YouTube-Video darüber. Dieselbe Zahl steht in `video_freigabe.MAX_BYTES` —
-- die API weist früh und verständlich ab (413), der Bucket ist die
-- Rückfallebene.
--
-- MIME-Liste bewusst eng: mp4/quicktime/webm. Kein ZIP, kein Office-Format,
-- kein SVG. Die API prüft zusätzlich die Magic Bytes — ein `content_type` vom
-- Client ist eine Behauptung, keine Tatsache (Wurzel 8).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'affiliate-videos',
    'affiliate-videos',
    false,
    209715200,  -- 200 MB, wie video_freigabe.MAX_BYTES
    array['video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
