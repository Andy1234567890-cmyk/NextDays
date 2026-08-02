-- 0267_bewertungs_warteschlange.sql — geplante Gast-Bewertungen sichtbar machen
--
-- Bisher lief die Automatik BLIND: der Tick berechnete die fälligen Gäste und
-- schickte die Bewertung im selben Atemzug ab. Der Betrieb sah vorher nichts,
-- konnte nichts anpassen und nichts auslassen — und eine abgeschickte
-- öffentliche Bewertung lässt sich bei keinem Portal zurücknehmen.
--
-- Deshalb eine echte Warteschlange: der Tick LEGT die Bewertung erst an
-- (status='geplant', mit Fälligkeit), die Oberfläche zeigt sie mit Restfrist,
-- man kann sie bearbeiten, überspringen oder sofort abschicken. Erst ein
-- späterer Tick versendet, was fällig und noch 'geplant' ist.

create table if not exists public.guest_review_queue (
    id             uuid primary key default gen_random_uuid(),
    tenant_id      uuid not null references public.tenants (id) on delete cascade,
    -- 'marketplace' = myBestDays (guest_reviews_by_host), 'ota' = Portal über
    -- Channex. Der Schreibpfad hängt daran, deshalb als CHECK festgenagelt.
    source         text not null check (source in ('marketplace', 'ota')),
    -- Marktplatz-Zeile: hängt an der Reservierung.
    reservation_id uuid references public.reservations (id) on delete cascade,
    -- Portal-Zeile: hängt an der gespiegelten Portal-Bewertung (Channex nimmt
    -- die Gast-Bewertung nur zu einer bestehenden Review entgegen).
    review_id      uuid references public.channex_review (id) on delete cascade,
    property_id    uuid references public.properties (id) on delete set null,
    guest_name     text,

    status         text not null default 'geplant'
                   check (status in ('geplant', 'gesendet', 'uebersprungen',
                                     'abgelaufen', 'fehler')),
    -- Wann sie rausgeht (aus review_automation.auto_review_after_days).
    send_at        timestamptz not null,
    -- Wann das Fenster des Kanals zu ist. NULL = unbekannt (dann entscheidet
    -- beim Portal `channex_review.is_expired`) — kein geratenes Datum.
    expires_at     timestamptz,

    -- Inhalt: aus der Konfiguration vorbelegt, danach PRO ZEILE editierbar.
    rating              smallint not null check (rating between 1 and 5),
    text                text,
    private_text        text,
    score_cleanliness   smallint check (score_cleanliness   between 1 and 5),
    score_communication smallint check (score_communication between 1 and 5),
    score_house_rules   smallint check (score_house_rules   between 1 and 5),
    recommended         boolean not null default true,
    -- Airbnb-Schlagworte je Kategorie (host_review_guest_positive_*).
    tags                jsonb not null default '[]'::jsonb,

    sent_at        timestamptz,
    error          text,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),

    -- Genau EINE geplante Bewertung je Vorgang (Wurzel 2): der Tick läuft
    -- stündlich, ein Retry oder ein zweiter Worker darf keine zweite Zeile
    -- anlegen. Zwei Teil-Indizes, weil je nach Quelle ein anderes Feld trägt.
    constraint guest_review_queue_quelle_belegt check (
        (source = 'marketplace' and reservation_id is not null)
        or (source = 'ota' and review_id is not null)
    )
);

create unique index if not exists guest_review_queue_reservation_uidx
    on public.guest_review_queue (reservation_id)
    where reservation_id is not null;
create unique index if not exists guest_review_queue_review_uidx
    on public.guest_review_queue (review_id)
    where review_id is not null;
create index if not exists guest_review_queue_tenant_idx
    on public.guest_review_queue (tenant_id, status, send_at);
-- Der Versandpfad des Ticks: nur was geplant und fällig ist.
create index if not exists guest_review_queue_faellig_idx
    on public.guest_review_queue (send_at)
    where status = 'geplant';

drop trigger if exists trg_guest_review_queue_updated on public.guest_review_queue;
create trigger trg_guest_review_queue_updated
    before update on public.guest_review_queue
    for each row execute function public.set_updated_at();

-- =========================================================================
-- RLS + harter Grant-Entzug (Wurzel 6)
-- =========================================================================
-- Kein Lesen, kein Schreiben über den DB-Direktpfad: die Zeile enthält den
-- Namen des Gasts und einen Text ÜBER ihn, und sie steuert einen unumkehrbaren
-- Außeneffekt. Beides verlässt die DB nur über den Server.
--
-- Bewusst KEIN Realtime-Abo: ohne SELECT-Grant wäre es eine stumme Attrappe,
-- und der Grant kommt hier nicht in Frage. Die Warteschlange lädt beim Öffnen —
-- sie ändert sich stündlich, nicht sekündlich.
alter table public.guest_review_queue enable row level security;

revoke all on public.guest_review_queue from anon, authenticated;

create policy guest_review_queue_tenant on public.guest_review_queue
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

comment on table public.guest_review_queue is
    'Geplante Bewertungen des Betriebs über seine Gäste. Der Tick legt sie an, '
    'die Oberfläche zeigt/ändert/überspringt sie, ein späterer Tick versendet. '
    'Nur service_role (Wurzel 6), kein Realtime (wäre ohne Grant eine Attrappe).';
comment on column public.guest_review_queue.expires_at is
    'Ende des Bewertungsfensters des Kanals. NULL = unbekannt; beim Portal '
    'entscheidet dann channex_review.is_expired.';
