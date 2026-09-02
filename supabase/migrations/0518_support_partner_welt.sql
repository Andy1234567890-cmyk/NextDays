-- 0518 — Chat Partner ↔ Partnerteam im vorhandenen Support-Modell (0517, Etappe 3).
--
-- Ausgangslage: support_tickets kennt drei Melder-Welten — Betriebs-Nutzer
-- (0204), Plattform-Gast (0204) und anonymer Website-Besucher (0238). Der
-- Partner des Affiliate-Programms ist die VIERTE: er hat ein eigenes Konto
-- (affiliates.id == auth.uid()), gehört zu keinem Betrieb und ist kein Gast.
--
-- Bewusst KEINE eigene Chat-Tabelle (dieselbe Begründung wie 0236/0238):
-- Verlauf, Zuweisung, Status, Ungelesen-Zähler, Tippt-Anzeige und die
-- Backoffice-Konsole existieren — ein Partner-Chat daneben würde alles
-- doppeln. Der Partner bekommt eine eigene Melder-Spalte, der CHECK erzwingt
-- weiter „genau eine Welt", die Lese-Policies (0205) und der Realtime-Helfer
-- (0236) kennen ihn zusätzlich.
--
-- Wurzel 6: an den Grants ändert sich NICHTS. Der Partner liest seine Tickets
-- per RLS (nur SELECT, wie jeder Melder — nötig für Realtime), schreibt aber
-- ausschließlich über /api/v1/support/partner/* mit service_role. Interne
-- Notizen bleiben durch `internal = false` in der Nachrichten-Policy hart
-- ausgeschlossen.

alter table public.support_tickets
    add column if not exists reporter_affiliate_id uuid
        references public.affiliates (id) on delete set null;

create index if not exists support_tickets_affiliate_idx
    on public.support_tickets (reporter_affiliate_id)
    where reporter_affiliate_id is not null;

-- Melder-Check: GENAU EINE der VIER Welten.
alter table public.support_tickets
    drop constraint if exists support_tickets_genau_ein_melder;

alter table public.support_tickets
    add constraint support_tickets_genau_ein_melder check (
        (case when reporter_user_id is not null then 1 else 0 end)
        + (case when reporter_guest_id is not null then 1 else 0 end)
        + (case when visitor_token_hash is not null then 1 else 0 end)
        + (case when reporter_affiliate_id is not null then 1 else 0 end)
        = 1
    );

-- Herkunft: 'partner' für Konversationen aus dem Partner-Dashboard — getrennt
-- vom Dashboard-Chat, weil das Backoffice sie anders behandelt (kein Betrieb,
-- Fragen zu Provision und Auszahlung).
alter table public.support_tickets
    drop constraint if exists support_tickets_source_check;

alter table public.support_tickets
    add constraint support_tickets_source_check
    check (source in ('form', 'chat', 'web', 'partner'));

-- --- Lese-Policies (0205) um die Partner-Welt erweitern ----------------------
drop policy if exists support_tickets_read on public.support_tickets;
create policy support_tickets_read on public.support_tickets
    as permissive for select
    using (
        reporter_user_id = auth.uid()
        or reporter_guest_id = auth.uid()
        or reporter_affiliate_id = auth.uid()
        or (
            tenant_id is not null
            and tenant_id = public.current_tenant_id()
        )
    );

drop policy if exists support_messages_read on public.support_messages;
create policy support_messages_read on public.support_messages
    as permissive for select
    using (
        internal = false
        and exists (
            select 1
            from public.support_tickets t
            where t.id = support_messages.ticket_id
              and (
                  t.reporter_user_id = auth.uid()
                  or t.reporter_guest_id = auth.uid()
                  or t.reporter_affiliate_id = auth.uid()
                  or (
                      t.tenant_id is not null
                      and t.tenant_id = public.current_tenant_id()
                  )
              )
        )
    );

-- --- Realtime-Teilnehmer (0236): der Partner ist Teilnehmer seines Topics ---
create or replace function public.support_topic_teilnehmer(topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.support_tickets t
        where 'support:' || t.id::text = topic
          and (
              t.reporter_user_id = (select auth.uid())
              or t.reporter_guest_id = (select auth.uid())
              or t.reporter_affiliate_id = (select auth.uid())
              or (
                  t.tenant_id is not null
                  and t.tenant_id = public.current_tenant_id()
              )
          )
    )
$$;

comment on column public.support_tickets.reporter_affiliate_id is
    'Melder ist ein Partner des Affiliate-Programms (affiliates.id == auth.uid()). '
    'Vierte Melder-Welt neben Betriebs-Nutzer, Gast und Website-Besucher.';
