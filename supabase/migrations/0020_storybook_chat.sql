-- Storybook-Austausch-Chat (Design-System-Werkstatt).
-- Bewusst GETRENNT von den PMS-Daten: eigene Tabelle, kein tenant_id, kein Bezug
-- zu Reservierungen/Gästen. Dient nur dem Austausch zwischen Team & Designer im
-- öffentlichen Storybook. Zugang im Frontend zusätzlich per gemeinsamem Code.

create table if not exists public.storybook_chat (
    id          uuid primary key default gen_random_uuid(),
    author      text not null check (char_length(author) between 1 and 60),
    body        text not null check (char_length(body) between 1 and 2000),
    -- optionaler Bezug auf eine Komponente/Seite (z. B. "PMS-Komponenten/Multi-Kalender")
    topic       text check (char_length(topic) <= 120),
    created_at  timestamptz not null default now()
);

create index if not exists storybook_chat_created_at_idx
    on public.storybook_chat (created_at);

-- RLS: nur diese Tabelle, nur Lesen + Einfügen über den anon-key. Kein Update/Delete.
alter table public.storybook_chat enable row level security;

drop policy if exists storybook_chat_read on public.storybook_chat;
create policy storybook_chat_read
    on public.storybook_chat for select
    to anon, authenticated
    using (true);

drop policy if exists storybook_chat_insert on public.storybook_chat;
create policy storybook_chat_insert
    on public.storybook_chat for insert
    to anon, authenticated
    with check (
        char_length(author) between 1 and 60
        and char_length(body) between 1 and 2000
    );

-- Realtime aktivieren: Tabelle der supabase_realtime-Publication hinzufügen.
do $$
begin
    if not exists (
        select 1 from pg_publication where pubname = 'supabase_realtime'
    ) then
        create publication supabase_realtime;
    end if;
end $$;

alter publication supabase_realtime add table public.storybook_chat;
