-- 0519 — Social-Media-Kanäle des Partners (Affiliate-Programm, 0517).
--
-- Bisher EIN Kanal (`channel_url`, freie Adresse). Ein Partner wirbt aber
-- über mehrere Kanäle (Instagram, TikTok, YouTube, Website …), und das
-- Backoffice braucht je Kanal Plattform, Adresse, Handle und Reichweite, um
-- eine Bewerbung zu beurteilen. Die Liste ist eine jsonb-Spalte, kein
-- eigenes Modell: sie wird nur mit dem Partner gelesen und geschrieben, nie
-- gefiltert oder verknüpft.
--
-- `channel_url` bleibt als Altwert erhalten und trägt immer den ERSTEN Kanal
-- (der Service pflegt das mit) — Anzeigen, die ihn noch lesen, bleiben richtig.
-- Wurzel 6: die Spalte liegt in `affiliates` (RLS an, alle Grants entzogen,
-- deny-all) — es ändert sich nichts an den Rechten.

alter table public.affiliates
    add column if not exists channels jsonb not null default '[]'::jsonb;

alter table public.affiliates
    drop constraint if exists affiliates_channels_array;
alter table public.affiliates
    add constraint affiliates_channels_array
        check (jsonb_typeof(channels) = 'array' and jsonb_array_length(channels) <= 12);

-- Altbestand: den einen Kanal überführen, Plattform am Host erkennen
-- (Liste gespiegelt aus features/affiliates/kanaele.py).
update public.affiliates
set channels = jsonb_build_array(jsonb_build_object(
    'platform',
    case
        when channel_url ~* '://([a-z0-9-]+\.)*(instagram\.com|instagr\.am)/' then 'instagram'
        when channel_url ~* '://([a-z0-9-]+\.)*tiktok\.com/' then 'tiktok'
        when channel_url ~* '://([a-z0-9-]+\.)*(youtube\.com|youtu\.be)/' then 'youtube'
        when channel_url ~* '://([a-z0-9-]+\.)*(facebook\.com|fb\.com|fb\.me)/' then 'facebook'
        when channel_url ~* '://([a-z0-9-]+\.)*(x\.com|twitter\.com)/' then 'x'
        when channel_url ~* '://([a-z0-9-]+\.)*(linkedin\.com|lnkd\.in)/' then 'linkedin'
        when channel_url ~* '://([a-z0-9-]+\.)*(pinterest\.[a-z]+|pin\.it)/' then 'pinterest'
        when channel_url ~* '://([a-z0-9-]+\.)*threads\.(net|com)/' then 'threads'
        when channel_url ~* '://([a-z0-9-]+\.)*twitch\.tv/' then 'twitch'
        when channel_url ~* '://([a-z0-9-]+\.)*snapchat\.com/' then 'snapchat'
        when channel_url ~* '://([a-z0-9-]+\.)*(t\.me|telegram\.me)/' then 'telegram'
        when channel_url ~* '://([a-z0-9-]+\.)*(whatsapp\.com|wa\.me)/' then 'whatsapp'
        else 'website'
    end,
    'url', channel_url,
    'handle', null,
    'followers', null
))
where channel_url is not null
  and channels = '[]'::jsonb;

comment on column public.affiliates.channels is
    'Kanäle des Partners: [{platform, url, handle, followers}] — Plattformliste in '
    'features/affiliates/kanaele.py; channel_url = url des ersten Kanals (Altwert).';
