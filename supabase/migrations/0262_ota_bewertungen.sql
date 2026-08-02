-- 0262_ota_bewertungen.sql — OTA-Bewertungen (Booking.com, Airbnb, Expedia)
--
-- Bisher wurden Bewertungen der Portale bei jedem Aufruf LIVE durchgereicht
-- (channel_manager/ota_extras.list_reviews). Damit gibt es kein „unbeantwortet"-
-- Filter, keine Kennzahl, kein Realtime, keine Sortierung über Kanäle hinweg —
-- und jeder Seitenaufruf kostet Portal-Requests. Deshalb ein eigener Bestand
-- nach dem Muster von channex_booking: der Webhook ist nur der AUSLÖSER, den
-- Stand ziehen wir nach und legen ihn hier ab.
--
-- Marken-/Sichtbarkeitsgrenze: diese Zeilen sind INTERN (myNextDays-PMS).
-- Sie erscheinen weder auf dem myBestDays-Marktplatz noch auf der Website des
-- Betriebs — dort zählen ausschließlich eigene, verifizierte Bewertungen
-- (public.reviews). Booking.com und Airbnb erlauben das Weiterveröffentlichen
-- ihrer Bewertungen nur eingeschränkt.

create table if not exists public.channex_review (
    id                   uuid primary key default gen_random_uuid(),
    tenant_id            uuid not null references public.tenants (id) on delete cascade,
    -- Objektbezug doppelt: über die Portal-Zuordnung (Herkunft) und direkt
    -- (Owner-/Staff-Scope und Filter laufen über property_id).
    property_map_id      uuid references public.channex_property_map (id) on delete set null,
    property_id          uuid references public.properties (id) on delete set null,
    -- Idempotenz-Backstop (Wurzel 2): Webhook-Redelivery, Backstop-Pull und
    -- manueller Sync treffen dieselbe Bewertung. UNIQUE + upsert statt insert.
    channex_review_id    text not null,
    ota                  text,
    ota_reservation_id   text,
    channex_booking_id   text,
    guest_name           text,
    content              text,
    -- Gesamtnote der Portale: 0..10 (Booking-Skala; Airbnb wird von Channex
    -- darauf normalisiert). Bewusst NICHT auf 1..5 umgerechnet — die Skala
    -- gehört zum Kanal, umgerechnet wird erst in der Anzeige.
    overall_score        numeric(4, 2) check (overall_score between 0 and 10),
    -- Kategorie-Noten wie vom Kanal geliefert ([{category, score}, …]). Die
    -- Kategorien unterscheiden sich je Portal (Airbnb: accuracy/checkin/…,
    -- Booking: clean/comfort/facilities/…) — deshalb jsonb statt fester
    -- Spalten, sonst müsste bei jedem neuen Portal die Tabelle wandern.
    scores               jsonb not null default '[]'::jsonb,
    tags                 jsonb not null default '[]'::jsonb,
    -- Airbnb hält die Bewertung verdeckt, bis beide Seiten abgegeben haben.
    is_hidden            boolean not null default false,
    is_replied           boolean not null default false,
    -- Antwortfrist des Portals abgelaufen — danach ist reply zwecklos.
    is_expired           boolean not null default false,
    reply                text,
    reply_at             timestamptz,
    -- Host bewertet Gast (nur Airbnb) — gesetzt, sobald abgeschickt.
    guest_review_sent_at timestamptz,
    received_at          timestamptz,
    ota_updated_at       timestamptz,
    raw                  jsonb not null default '{}'::jsonb,
    -- Arbeitszustand im Cockpit (wie im Posteingang).
    is_read              boolean not null default false,
    is_archived          boolean not null default false,
    assigned_user_id     uuid references public.users (id) on delete set null,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now()
);

create unique index if not exists channex_review_channex_uidx
    on public.channex_review (channex_review_id);
create index if not exists channex_review_tenant_idx
    on public.channex_review (tenant_id);
create index if not exists channex_review_property_idx
    on public.channex_review (property_id);
-- Der Standardfilter des Cockpits: „was ist offen", neueste zuerst.
create index if not exists channex_review_offen_idx
    on public.channex_review (tenant_id, received_at desc)
    where is_replied = false and is_archived = false;
create index if not exists channex_review_empfang_idx
    on public.channex_review (tenant_id, received_at desc);

drop trigger if exists trg_channex_review_updated on public.channex_review;
create trigger trg_channex_review_updated
    before update on public.channex_review
    for each row execute function public.set_updated_at();

-- =========================================================================
-- RLS + Grants (Wurzel 6) — identisch zu channex_booking
-- =========================================================================
-- Lesen ist für authenticated erlaubt (RLS entscheidet, welche Zeilen); das
-- ist die Voraussetzung dafür, dass das Realtime-Abo im Cockpit überhaupt
-- Ereignisse liefert. Schreiben darf ausschließlich der Server: eine Antwort
-- muss zuerst beim Portal ankommen, bevor sie hier steht (Wurzel 1) — ein
-- Client, der direkt schreibt, würde eine Antwort vortäuschen, die nie beim
-- Gast landet.
alter table public.channex_review enable row level security;

create policy channex_review_tenant on public.channex_review
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

revoke insert, update, delete on public.channex_review from anon, authenticated;

create policy channex_review_write_restrict on public.channex_review
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Objekt-Scope wie bei reviews/reservations (0059/0136): ein Eigentümer sieht
-- nur Bewertungen SEINER Objekte, ein Mitarbeiter nur die zugewiesenen. Beide
-- Helfer sind fail-closed; eine Zeile ohne property_id (Portal-Objekt noch
-- nicht zugeordnet) ist damit für owner/staff unsichtbar — richtig so.
create policy channex_review_owner_scope on public.channex_review
    as restrictive for select
    using (public.owner_can_see_property(property_id));

create policy channex_review_staff_scope on public.channex_review
    as restrictive for select
    using (public.staff_can_see_property(property_id));

-- Realtime: das Cockpit hört auf diese Tabelle. Ohne BEIDES (Grant oben +
-- Publikation hier) wäre das Abo eine stumme Attrappe.
alter table public.channex_review replica identity full;

do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'channex_review'
    ) then
        alter publication supabase_realtime add table public.channex_review;
    end if;
end
$$;

comment on table public.channex_review is
    'Bewertungen der Portale (Booking.com/Airbnb/Expedia) als eigener Bestand. '
    'Quelle ist die Channex-Reviews-API; der Webhook ist nur der Auslöser. '
    'INTERN — erscheint nicht auf dem myBestDays-Marktplatz und nicht auf der '
    'Website des Betriebs.';
comment on column public.channex_review.overall_score is
    'Gesamtnote in der Portal-Skala 0..10. Umrechnung auf Sterne erst in der Anzeige.';
comment on column public.channex_review.scores is
    'Kategorie-Noten wie vom Portal geliefert: [{"category":"clean","score":10}, …]. '
    'Kategorien unterscheiden sich je Portal.';
