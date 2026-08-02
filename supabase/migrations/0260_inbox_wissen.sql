-- 0260_inbox_wissen.sql — Wissensdatenbank für die KI-Antworten
--
-- Der KI-Vorschlag kannte bisher nur den Reservierungskontext (Objektname,
-- Datum, Portal) und den Gesprächsverlauf. Auf „Wie ist das WLAN-Passwort?"
-- konnte er deshalb nichts anderes tun als um Klärung zu bitten — der System-
-- Prompt verbietet ihm ausdrücklich, sich Fakten auszudenken (zu Recht).
--
-- Hier liegen die Fakten, die er nutzen DARF. property_id = NULL heißt: gilt
-- für den ganzen Betrieb; gesetzt heißt: nur für dieses Objekt.
--
-- `source` hält fest, woher ein Fakt kommt. Das ist keine Zierde: ein aus einer
-- alten Nachricht übernommener Fakt hat eine andere Verlässlichkeit als einer,
-- den jemand bewusst eingetragen hat, und beim Aufräumen muss man beides
-- unterscheiden können.

create table if not exists public.inbox_knowledge_fact (
    id          uuid primary key default gen_random_uuid(),
    tenant_id   uuid not null references public.tenants(id) on delete cascade,
    property_id uuid references public.properties(id) on delete cascade,
    fact        text not null,
    source      text not null default 'manual',
    source_ref  text,
    created_by  uuid references public.users(id) on delete set null,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    constraint inbox_knowledge_fact_source_chk
        check (source in ('manual', 'document', 'message')),
    -- Ein Fakt ohne Inhalt ist ein Datenfehler, kein leerer Zustand.
    constraint inbox_knowledge_fact_text_chk
        check (length(btrim(fact)) between 1 and 2000)
);

create index if not exists inbox_knowledge_fact_tenant_idx
    on public.inbox_knowledge_fact (tenant_id, property_id);

drop trigger if exists trg_inbox_knowledge_fact_updated on public.inbox_knowledge_fact;
create trigger trg_inbox_knowledge_fact_updated
    before update on public.inbox_knowledge_fact
    for each row execute function public.set_updated_at();

alter table public.inbox_knowledge_fact enable row level security;

create policy inbox_knowledge_fact_tenant on public.inbox_knowledge_fact
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Wurzel 6: In den Fakten stehen typischerweise WLAN-Passwort, Schlüsselversteck
-- und Alarmcode — also genau das, was ein cleaner mit gültigem JWT und dem
-- öffentlichen anon-Key per `curl /rest/v1/inbox_knowledge_fact` NICHT lesen
-- können darf. Der FastAPI-Layer wird dabei umgangen, also muss die Sperre auf
-- DB-Ebene sitzen: Grants entziehen UND restriktive Policy (auch für den
-- SCHREIB-Pfad, sonst könnte man der KI Fakten unterschieben).
revoke all on public.inbox_knowledge_fact from anon, authenticated;

create policy inbox_knowledge_fact_kein_direktzugriff on public.inbox_knowledge_fact
    as restrictive for all
    using (false)
    with check (false);

comment on table public.inbox_knowledge_fact is
    'Fakten, die der KI-Antwortvorschlag verwenden darf. property_id NULL = '
    'betriebsweit. Enthält Zugangsdaten → kein Direktzugriff für anon/authenticated.';
comment on column public.inbox_knowledge_fact.source is
    'manual = eingetragen, document = aus hochgeladenem Dokument, message = aus '
    'einer gesendeten Nachricht übernommen.';
