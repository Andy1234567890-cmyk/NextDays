-- 0181_guest_dashboard.sql — Gast-/Kunden-Dashboard der Plattform (/plattform)
--
-- Baut die Demand-Seite aus (portal_guests aus 0006 war reines Phase-2-Gerüst):
-- Gäste bekommen ein echtes Konto (Supabase-Session, E-Mail+Passwort), sehen ihre
-- Buchungen, das Gastmodul (Check-in/Türcode), chatten mit dem Gastgeber, führen
-- Merkzettel und schreiben Bewertungen.
--
-- ARCHITEKTUR-ENTSCHEID (bestätigt): Buchungs-Zuordnung per E-MAIL-MATCH
-- (portal_guests.email ↔ reservations.guest_email, case-insensitiv). Keine harte
-- reservations.portal_guest_id-Spalte — so tauchen Alt-/OTA-Buchungen (Booking/
-- Airbnb-Importe mit derselben E-Mail) automatisch im Dashboard auf.
--
-- SICHERHEIT (Wurzel 6): portal_guests trägt kein Secret (Passwort liegt in
-- auth.users), ist aber personenbezogen und muss server-verwaltet bleiben — der
-- Gast liest/schreibt seine Stammdaten NUR über den FastAPI-Layer (service_role),
-- nicht per anon-curl. Reviews sind öffentlich lesbar (Produktbewertungen), aber
-- Schreiben nur durch den verifizierten Autor. Merkzettel/Chat sind privat je Gast.

-- =========================================================================
-- 1. RLS-Helfer: E-Mail des eingeloggten Portal-Gasts (für E-Mail-Match)
-- =========================================================================
-- Analog zu current_tenant_id(): liest die E-Mail aus dem JWT. Der reguläre
-- Supabase-Access-Token trägt die E-Mail als Top-Level-Claim `email`.
-- stable, kein Tabellenzugriff, search_path leer + schema-qualifiziert (Wurzel 6).
create or replace function public.current_portal_guest_email()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(
    lower(current_setting('request.jwt.claims', true)::jsonb ->> 'email'),
    ''
  )
$$;

revoke execute on function public.current_portal_guest_email() from anon, authenticated;

comment on function public.current_portal_guest_email() is
  'Lower-case-E-Mail des eingeloggten Portal-Gasts aus dem JWT. Anker für den '
  'E-Mail-Match portal_guests.email ↔ reservations.guest_email.';

-- =========================================================================
-- 2. portal_guests härten (Wurzel 6) + Profilfelder
-- =========================================================================
-- Zusätzliche Stammdaten fürs Konto (Kontakt/Präferenzen). Kein Secret hier.
alter table public.portal_guests
    add column if not exists phone            text,
    add column if not exists preferred_locale text,
    add column if not exists preferred_currency text,
    add column if not exists marketing_opt_in boolean not null default false;

-- E-Mail case-insensitiv eindeutig halten (ein Konto je Adresse) und für den
-- Match indexieren.
create unique index if not exists portal_guests_email_lower_key
    on public.portal_guests (lower(email));

-- Harter GRANT-Entzug: der Gast verwaltet sein Profil über den Server, nicht per
-- anon-curl. Die Self-Policy aus 0008 bleibt als Backstop bestehen.
revoke select, insert, update, delete on public.portal_guests from anon;
revoke select, insert, update, delete on public.portal_guests from authenticated;

-- E-Mail-Match-Index auf der Reservierungsseite (case-insensitiv).
create index if not exists reservations_guest_email_lower_idx
    on public.reservations (lower(guest_email));

comment on column public.portal_guests.preferred_currency is
  'Anzeige-Währung des Gasts; NIE Fallback für Objektwährung (Wurzel 4).';

-- =========================================================================
-- 3. reviews härten: nur verifizierte Gäste, Antwort des Gastgebers
-- =========================================================================
-- 0006 legte reviews an; hier: Gastgeber-Antwort + Bindung an eine konkrete
-- Reservierung (Nachweis „echter Gast", analog Booking/Airbnb).
alter table public.reviews
    add column if not exists reservation_id uuid
        references public.reservations (id) on delete set null,
    add column if not exists host_reply     text,
    add column if not exists host_reply_at  timestamptz,
    add column if not exists updated_at      timestamptz not null default now();

-- Ein Gast bewertet eine Reservierung höchstens einmal.
create unique index if not exists reviews_reservation_guest_key
    on public.reviews (reservation_id, portal_guest_id)
    where reservation_id is not null;

create trigger set_updated_at before update on public.reviews
    for each row execute function public.set_updated_at();

-- reviews: öffentlich lesbar (Read-Policy aus 0008 bleibt), aber der pauschale
-- Schreibpfad wird entzogen — Insert/Update laufen server-seitig (verifiziert der
-- Server, dass die Reservierung dem Gast gehört + abgeschlossen ist).
--
-- WICHTIG (Wurzel 6/9): Ein BLANKES `grant select on public.reviews` würde die
-- Spalten `portal_guest_id` (== auth.uid des Gasts) und `reservation_id` über den
-- PostgREST-Direktpfad ausliefern — genau die Recon-Kette Gast↔Objekt↔Reservierung,
-- die der API-Lesepfad (guest_reviews.public_reviews) bewusst maskiert. Column-
-- REVOKE greift nur, wenn zuerst das Tabellen-GRANT entzogen wird. Also: SELECT
-- vollständig entziehen, dann NUR die unbedenklichen Spalten wieder gewähren.
revoke insert, update, delete on public.reviews from anon, authenticated;
revoke select on public.reviews from anon, authenticated;
grant select (id, property_id, rating, text, host_reply, host_reply_at, created_at)
    on public.reviews to anon, authenticated;

comment on column public.reviews.reservation_id is
  'Nachweis „echter Gast": Bewertung hängt an einer abgeschlossenen Reservierung.';

-- =========================================================================
-- 4. Merkzettel (wishlists + items) — privat je Gast
-- =========================================================================
create table if not exists public.wishlists (
    id              uuid primary key default gen_random_uuid(),
    portal_guest_id uuid not null references public.portal_guests (id) on delete cascade,
    name            text not null,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists wishlists_guest_idx on public.wishlists (portal_guest_id);

create table if not exists public.wishlist_items (
    id          uuid primary key default gen_random_uuid(),
    wishlist_id uuid not null references public.wishlists (id) on delete cascade,
    property_id uuid not null references public.properties (id) on delete cascade,
    note        text,
    created_at  timestamptz not null default now(),
    unique (wishlist_id, property_id)
);

create index if not exists wishlist_items_wishlist_idx on public.wishlist_items (wishlist_id);

create trigger set_updated_at before update on public.wishlists
    for each row execute function public.set_updated_at();

alter table public.wishlists enable row level security;
alter table public.wishlist_items enable row level security;

-- Self-Policy: der Gast sieht/ändert nur seine eigenen Merkzettel.
create policy wishlists_self on public.wishlists
    for all
    using (portal_guest_id = auth.uid())
    with check (portal_guest_id = auth.uid());

-- Items erben den Scope über die Wishlist.
create policy wishlist_items_self on public.wishlist_items
    for all
    using (exists (
        select 1 from public.wishlists w
        where w.id = wishlist_items.wishlist_id and w.portal_guest_id = auth.uid()
    ))
    with check (exists (
        select 1 from public.wishlists w
        where w.id = wishlist_items.wishlist_id and w.portal_guest_id = auth.uid()
    ));

-- Server verwaltet (kein anon-Direktpfad). Self-Policy bleibt Backstop.
revoke select, insert, update, delete on public.wishlists from anon;
revoke select, insert, update, delete on public.wishlists from authenticated;
revoke select, insert, update, delete on public.wishlist_items from anon;
revoke select, insert, update, delete on public.wishlist_items from authenticated;

-- =========================================================================
-- 5. Gast↔Host-Chat (guest_message_threads + guest_messages)
-- =========================================================================
-- Eigenes Thread-Modell mit Gast-Bindung (das bestehende inbox/ baut auf
-- channex_booking auf und ist tenant-seitig — hier braucht es einen Gast-Absender).
-- Ein Thread hängt an einer Reservierung; Tenant-Seite liest über tenant_id,
-- Gast-Seite über portal_guest_id.
create table if not exists public.guest_message_threads (
    id              uuid primary key default gen_random_uuid(),
    tenant_id       uuid not null references public.tenants (id) on delete cascade,
    reservation_id  uuid not null references public.reservations (id) on delete cascade,
    portal_guest_id uuid not null references public.portal_guests (id) on delete cascade,
    property_id     uuid not null references public.properties (id) on delete cascade,
    last_message_at timestamptz,
    created_at      timestamptz not null default now(),
    unique (reservation_id, portal_guest_id)
);

create index if not exists guest_threads_guest_idx  on public.guest_message_threads (portal_guest_id);
create index if not exists guest_threads_tenant_idx on public.guest_message_threads (tenant_id);

create table if not exists public.guest_messages (
    id         uuid primary key default gen_random_uuid(),
    thread_id  uuid not null references public.guest_message_threads (id) on delete cascade,
    -- Absenderseite: 'guest' oder 'host' (kein Freitext wie in messages).
    sender     text not null check (sender in ('guest', 'host')),
    body       text not null,
    read_at    timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists guest_messages_thread_idx on public.guest_messages (thread_id, created_at);

alter table public.guest_message_threads enable row level security;
alter table public.guest_messages enable row level security;

-- Gast sieht seine Threads; Tenant-Seite läuft server-seitig (service_role) —
-- daher nur die Gast-Self-Policy als Realtime-Backstop, plus tenant-Lesbarkeit
-- für die Manager-Realtime (tenant_id-Match).
create policy guest_threads_guest_read on public.guest_message_threads
    for select
    using (portal_guest_id = auth.uid() or tenant_id = public.current_tenant_id());

create policy guest_messages_thread_read on public.guest_messages
    for select
    using (exists (
        select 1 from public.guest_message_threads t
        where t.id = guest_messages.thread_id
          and (t.portal_guest_id = auth.uid() or t.tenant_id = public.current_tenant_id())
    ));

-- Schreiben ausschließlich server-seitig (der Server setzt sender korrekt und
-- prüft Reservierungsbesitz) — kein Direkt-Insert per anon/authenticated.
revoke insert, update, delete on public.guest_message_threads from anon, authenticated;
revoke insert, update, delete on public.guest_messages from anon, authenticated;
-- SELECT bleibt (für Realtime mit RLS), Insert/Update/Delete gesperrt.
grant select on public.guest_message_threads to authenticated;
grant select on public.guest_messages to authenticated;

comment on table public.guest_messages is
  'Gast↔Host-Chat je Reservierung. sender=guest|host wird server-seitig gesetzt; '
  'Direkt-Insert per anon-Key gesperrt (Wurzel 6).';

-- =========================================================================
-- 6. Realtime-Publikation für den Gast-Chat
-- =========================================================================
-- Muster wie 0042_inbox_realtime: neue Chat-Tabellen an die Realtime-Publikation
-- hängen, damit das Dashboard live aktualisiert (WebSocket-Pflicht, kein Polling).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.guest_messages';
    execute 'alter publication supabase_realtime add table public.guest_message_threads';
  end if;
end $$;
