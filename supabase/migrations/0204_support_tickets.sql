-- Support-Bereich des Plattform-Backoffice (AP7 des Admin-Dashboards).
--
-- Ein Ticket verbindet einen Melder mit dem Betreiber-Team. Der Melder kann aus
-- BEIDEN Auth-Welten kommen (ADR-0015/0017) — sie bleiben getrennt:
--   • Betriebs-Nutzer (users.id)        → reporter_user_id + tenant_id
--   • Plattform-Gast (portal_guests.id) → reporter_guest_id, KEIN tenant_id
-- Genau eine der beiden Spalten ist gesetzt; der Check unten erzwingt das. Ein
-- gemeinsames „reporter_id"-Feld wäre mehrdeutig und würde die Trennung der
-- Auth-Welten verschleiern.
--
-- Sensibel (Support-Verläufe enthalten PII und Beschwerdeinhalte) → Wurzel 6:
-- RLS + harter GRANT-Entzug. Nur der Server (service_role) greift zu; weder ein
-- Gast noch ein Betriebs-Nutzer liest hier per anon-Key mit.

create table if not exists public.support_tickets (
    id uuid primary key default gen_random_uuid(),

    -- Melder: genau EINE der beiden Welten (siehe Check).
    reporter_user_id uuid references auth.users (id) on delete set null,
    reporter_guest_id uuid references public.portal_guests (id) on delete set null,
    -- Betrieb, um den es geht (bei Betriebs-Nutzern gesetzt; bei Gästen optional,
    -- z. B. Beschwerde über einen bestimmten Betrieb).
    tenant_id uuid references public.tenants (id) on delete set null,

    subject text not null,
    -- Frei wählbares Thema (z. B. 'zahlung', 'objekt', 'konto') — bewusst kein
    -- Enum: Support-Kategorien ändern sich häufiger als Schemata.
    category text,

    status text not null default 'open'
        check (status in ('open', 'waiting', 'resolved', 'closed')),
    priority text not null default 'normal'
        check (priority in ('low', 'normal', 'high', 'urgent')),

    -- Bearbeiter aus dem Betreiber-Team (platform_admins.user_id).
    assignee_user_id uuid references auth.users (id) on delete set null,

    -- Bezug auf einen konkreten Vorgang, falls vorhanden.
    reservation_id uuid references public.reservations (id) on delete set null,
    property_id uuid references public.properties (id) on delete set null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    -- Zeitpunkt der letzten Nachricht (für die Sortierung „zuletzt aktiv").
    last_message_at timestamptz,

    constraint support_tickets_genau_ein_melder check (
        (reporter_user_id is not null and reporter_guest_id is null)
        or (reporter_user_id is null and reporter_guest_id is not null)
    )
);

create index if not exists support_tickets_status_idx
    on public.support_tickets (status, last_message_at desc nulls last);
create index if not exists support_tickets_tenant_idx
    on public.support_tickets (tenant_id);
create index if not exists support_tickets_assignee_idx
    on public.support_tickets (assignee_user_id);

comment on table public.support_tickets is
    'Support-Tickets des Plattform-Backoffice. Melder ist ENTWEDER ein '
    'Betriebs-Nutzer ODER ein Plattform-Gast (getrennte Auth-Welten). '
    'Nur service_role liest/schreibt.';

-- --- Nachrichten eines Tickets ----------------------------------------------

create table if not exists public.support_messages (
    id uuid primary key default gen_random_uuid(),
    ticket_id uuid not null
        references public.support_tickets (id) on delete cascade,

    -- Wer schreibt: 'reporter' (der Melder) oder 'agent' (Betreiber-Team).
    author_kind text not null check (author_kind in ('reporter', 'agent')),
    author_user_id uuid references auth.users (id) on delete set null,

    body text not null,

    -- Interne Notiz: NUR für das Betreiber-Team sichtbar, nie für den Melder.
    -- Das Flag ist der einzige Unterschied — die Durchsetzung liegt im Service,
    -- der Melder-Endpunkte nur nicht-interne Zeilen ausliefern lässt.
    internal boolean not null default false,

    created_at timestamptz not null default now()
);

create index if not exists support_messages_ticket_idx
    on public.support_messages (ticket_id, created_at);

comment on column public.support_messages.internal is
    'Interne Team-Notiz — darf NIE an den Melder ausgeliefert werden.';

-- --- Härtung (Wurzel 6): RLS + harter GRANT-Entzug ---------------------------
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

revoke all on public.support_tickets from anon, authenticated;
revoke all on public.support_messages from anon, authenticated;

-- Deny-all für Nicht-service_role: es gibt keinen legitimen Client-Direktpfad.
-- Melder erreichen ihre Tickets ausschließlich über den FastAPI-Slice, der den
-- Scope (eigene Tickets, keine internen Notizen) erzwingt.
create policy support_tickets_deny_all on public.support_tickets
    as restrictive for all using (false) with check (false);

create policy support_messages_deny_all on public.support_messages
    as restrictive for all using (false) with check (false);
