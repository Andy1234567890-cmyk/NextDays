-- 0520 — Team-Provision (zweistufiges Partnerprogramm), Beschluss 02.09.2026.
--
-- Ein Partner (Sponsor) kann ein Team aus geworbenen Partnern aufbauen und
-- verdient am Netto-Abo-Umsatz der Team-Kunden einen Override — nach SEINEM
-- Rang (affiliate_tiers.override_rate), genau EINE Ebene tief, ohne
-- Teilnahmebeitrag, ohne Geld fürs Anwerben. Die Override-Zeile hängt über
-- parent_id an der Ertragszeile des Team-Partners und wird mit ihr zurück-
-- genommen (Wurzel 1). Hebt die Einstufigkeit aus ADR-0020 auf (dort
-- nachgetragen).

-- --- Sponsor am Partner --------------------------------------------------------
alter table public.affiliates
    add column if not exists sponsor_affiliate_id uuid
        references public.affiliates (id) on delete set null,
    add column if not exists sponsor_joined_at timestamptz,
    -- Betrugsflags der Team-Zuordnung (same_email_domain, same_iban, …).
    add column if not exists sponsor_flags jsonb not null default '[]'::jsonb;

alter table public.affiliates
    drop constraint if exists affiliates_sponsor_nicht_selbst;
alter table public.affiliates
    add constraint affiliates_sponsor_nicht_selbst
        check (sponsor_affiliate_id is null or sponsor_affiliate_id <> id);

create index if not exists affiliates_sponsor_idx
    on public.affiliates (sponsor_affiliate_id)
    where sponsor_affiliate_id is not null;

-- Genau eine Ebene: ein Sponsor hat selbst keinen Sponsor, und wer schon ein
-- Team führt, kann nicht Team-Mitglied werden. Ein CHECK kann keine anderen
-- Zeilen lesen — deshalb ein Trigger. Keine coalesce()-Fallen auf Enums,
-- keine Bedingung, die bei einem Update ohne Sponsor-Bezug werfen könnte.
create or replace function public.affiliate_sponsor_eine_ebene()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if new.sponsor_affiliate_id is null then
        return new;
    end if;
    if tg_op = 'UPDATE' and new.sponsor_affiliate_id is not distinct from old.sponsor_affiliate_id then
        return new;
    end if;
    if exists (
        select 1 from public.affiliates s
        where s.id = new.sponsor_affiliate_id and s.sponsor_affiliate_id is not null
    ) then
        raise exception 'Sponsor % hat selbst einen Sponsor — nur eine Ebene erlaubt.',
            new.sponsor_affiliate_id using errcode = 'check_violation';
    end if;
    if exists (
        select 1 from public.affiliates m where m.sponsor_affiliate_id = new.id
    ) then
        raise exception 'Partner % führt bereits ein Team und kann kein Team-Mitglied werden.',
            new.id using errcode = 'check_violation';
    end if;
    return new;
end;
$$;

revoke execute on function public.affiliate_sponsor_eine_ebene() from anon, authenticated;

drop trigger if exists affiliates_sponsor_eine_ebene on public.affiliates;
create trigger affiliates_sponsor_eine_ebene
    before insert or update of sponsor_affiliate_id on public.affiliates
    for each row execute function public.affiliate_sponsor_eine_ebene();

-- --- Override-Staffel als Daten ---------------------------------------------------
alter table public.affiliate_tiers
    add column if not exists override_rate numeric(5,4) not null default 0
        check (override_rate >= 0 and override_rate <= 1);

update public.affiliate_tiers set override_rate = 0.0100 where id = 'einsteiger';
update public.affiliate_tiers set override_rate = 0.0200 where id = 'aufsteiger';
update public.affiliate_tiers set override_rate = 0.0350 where id = 'semi_super';
update public.affiliate_tiers set override_rate = 0.0500 where id = 'super';

-- --- Provisionsart override -----------------------------------------------------------
alter table public.affiliate_commissions
    drop constraint if exists affiliate_commissions_kind_check;
alter table public.affiliate_commissions
    add constraint affiliate_commissions_kind_check
        check (kind in ('earn', 'reversal', 'adjustment', 'override'));

alter table public.affiliate_commissions
    drop constraint if exists affiliate_commissions_sign;
alter table public.affiliate_commissions
    add constraint affiliate_commissions_sign check (
        (kind in ('earn', 'override') and amount >= 0 and base_amount >= 0)
        or (kind = 'reversal' and amount <= 0)
        or kind = 'adjustment'
    );

-- Eine Override-Zeile je Ertragszeile (Idempotenz-Backstop, Wurzel 2).
create unique index if not exists affiliate_commissions_override_parent_uq
    on public.affiliate_commissions (parent_id)
    where kind = 'override';

comment on column public.affiliates.sponsor_affiliate_id is
    'Sponsor (Team-Führung) dieses Partners — genau eine Ebene (Trigger). Override-Satz '
    'nach dem Rang des Sponsors zum Buchungszeitpunkt (affiliate_tiers.override_rate).';

-- --- Team-Chat Sponsor ↔ Team-Mitglied -------------------------------------------------
-- Eigene Tabellen, NICHT die Support-Welt: dort sitzt das Partnerteam von
-- myNextDays, hier reden zwei Partner miteinander. Ein Thread je Paar.
create table if not exists public.affiliate_team_threads (
    id                    uuid primary key default gen_random_uuid(),
    sponsor_affiliate_id  uuid not null references public.affiliates (id) on delete cascade,
    member_affiliate_id   uuid not null references public.affiliates (id) on delete cascade,
    last_message_at       timestamptz,
    created_at            timestamptz not null default now(),
    constraint affiliate_team_threads_paar check (sponsor_affiliate_id <> member_affiliate_id)
);
create unique index if not exists affiliate_team_threads_paar_uq
    on public.affiliate_team_threads (sponsor_affiliate_id, member_affiliate_id);

create table if not exists public.affiliate_team_messages (
    id                   uuid primary key default gen_random_uuid(),
    thread_id            uuid not null references public.affiliate_team_threads (id) on delete cascade,
    sender_affiliate_id  uuid not null references public.affiliates (id) on delete cascade,
    body                 text not null check (char_length(body) between 1 and 4000),
    read_at              timestamptz,
    created_at           timestamptz not null default now()
);
create index if not exists affiliate_team_messages_thread_idx
    on public.affiliate_team_messages (thread_id, created_at);

-- Wurzel 6: RLS an, alle Grants weg, dann NUR select für die beiden Beteiligten
-- (nötig für Realtime postgres_changes). Schreiben ausschließlich service_role
-- über /affiliates/team/threads.
alter table public.affiliate_team_threads enable row level security;
alter table public.affiliate_team_messages enable row level security;
revoke all on public.affiliate_team_threads from anon, authenticated;
revoke all on public.affiliate_team_messages from anon, authenticated;
grant select on public.affiliate_team_threads to authenticated;
grant select on public.affiliate_team_messages to authenticated;

drop policy if exists affiliate_team_threads_read on public.affiliate_team_threads;
create policy affiliate_team_threads_read on public.affiliate_team_threads
    as permissive for select to authenticated
    using (sponsor_affiliate_id = (select auth.uid()) or member_affiliate_id = (select auth.uid()));

drop policy if exists affiliate_team_messages_read on public.affiliate_team_messages;
create policy affiliate_team_messages_read on public.affiliate_team_messages
    as permissive for select to authenticated
    using (
        exists (
            select 1 from public.affiliate_team_threads t
            where t.id = affiliate_team_messages.thread_id
              and (t.sponsor_affiliate_id = (select auth.uid())
                   or t.member_affiliate_id = (select auth.uid()))
        )
    );

-- Restriktive Sperre für alles außer select (Backstop, falls je ein Grant dazukommt).
drop policy if exists affiliate_team_threads_deny_write on public.affiliate_team_threads;
create policy affiliate_team_threads_deny_write on public.affiliate_team_threads
    as restrictive for insert to authenticated with check (false);
drop policy if exists affiliate_team_messages_deny_write on public.affiliate_team_messages;
create policy affiliate_team_messages_deny_write on public.affiliate_team_messages
    as restrictive for insert to authenticated with check (false);

do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'affiliate_team_messages'
    ) then
        alter publication supabase_realtime add table public.affiliate_team_messages;
    end if;
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'affiliate_team_threads'
    ) then
        alter publication supabase_realtime add table public.affiliate_team_threads;
    end if;
end $$;

-- updated_at braucht keine der beiden Tabellen (append-only bzw. last_message_at vom Server).
