-- 0263_bewertungs_automatik.sql — Auto-Bewertung des Gasts + Bewertungs-Erinnerung
--
-- Zwei zeitgesteuerte Vorgänge nach der Abreise, beide je Betrieb konfigurierbar:
--   1) Der Betrieb bewertet den Gast automatisch (Airbnb über die Portale,
--      myBestDays über guest_reviews_by_host). Grund für die Automatik: Airbnb
--      veröffentlicht die Gast-Bewertung erst, wenn beide Seiten abgegeben haben
--      oder die 14-Tage-Frist abläuft — wer von Hand bewertet, verpasst das Fenster.
--   2) Der Gast bekommt eine Erinnerung, seinen Aufenthalt auf myBestDays zu
--      bewerten (Booking.com verschickt seine Einladung ~48 h nach Abreise).
--
-- Beides ist geldnah genug, um NUR über den Server zu laufen: eine automatisch
-- abgeschickte öffentliche Bewertung lässt sich nicht zurücknehmen.

create table if not exists public.review_automation (
    tenant_id             uuid primary key references public.tenants (id) on delete cascade,
    -- Betrieb bewertet Gast
    auto_review_active    boolean not null default false,
    -- Tage nach Abreise bis zum Absenden. 0 = am Abreisetag. Deckel 30, weil
    -- die Portale ihr Bewertungsfenster nach 14 Tagen (Airbnb) bzw. 3 Monaten
    -- (Booking.com) schließen — ein größerer Wert wäre stiller Leerlauf.
    auto_review_after_days integer not null default 3
        check (auto_review_after_days between 0 and 30),
    -- Regel: nur bewerten, wenn der Aufenthalt mindestens so gut lief. NULL =
    -- immer bewerten. Bezieht sich auf die eigene Bewertung des Gasts, sofern
    -- vorhanden — liegt keine vor, greift die Regel nicht (kein Rateschluss).
    auto_review_min_rating smallint check (auto_review_min_rating between 1 and 5),
    -- Was abgeschickt wird. Öffentlich sieht jeder, privat nur der Gast.
    auto_review_rating     smallint not null default 5
        check (auto_review_rating between 1 and 5),
    auto_review_public     text,
    auto_review_private    text,
    -- Erinnerung an den Gast (nur myBestDays — die Portale laden selbst ein).
    guest_reminder_active  boolean not null default false,
    guest_reminder_after_days integer not null default 2
        check (guest_reminder_after_days between 0 and 30),
    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now()
);

-- Idempotenz-Backstop (Wurzel 2): der Tick läuft alle paar Minuten, ein Retry
-- oder ein zweiter Worker darf denselben Gast NICHT zweimal bewerten und keine
-- zweite Mail schicken. UNIQUE erzwingt das in der DB, nicht nur im Code.
create table if not exists public.review_automation_log (
    id             uuid primary key default gen_random_uuid(),
    tenant_id      uuid not null references public.tenants (id) on delete cascade,
    reservation_id uuid not null references public.reservations (id) on delete cascade,
    -- 'guest_rating' = Betrieb hat den Gast bewertet
    -- 'guest_reminder' = Erinnerungsmail an den Gast
    kind           text not null check (kind in ('guest_rating', 'guest_reminder')),
    -- Fehlgeschlagene Versuche bleiben stehen: die Zeile ist der Beweis, dass
    -- es versucht wurde, und der Grund macht sichtbar warum (Wurzel 5).
    error          text,
    created_at     timestamptz not null default now(),
    unique (reservation_id, kind)
);

create index if not exists review_automation_log_tenant_idx
    on public.review_automation_log (tenant_id, created_at desc);

drop trigger if exists trg_review_automation_updated on public.review_automation;
create trigger trg_review_automation_updated
    before update on public.review_automation
    for each row execute function public.set_updated_at();

-- =========================================================================
-- RLS + harter Grant-Entzug (Wurzel 6)
-- =========================================================================
-- Kein Lesen, kein Schreiben über den DB-Direktpfad: die Konfiguration steuert
-- einen unumkehrbaren Außeneffekt (öffentliche Bewertung beim Portal), das Log
-- enthält Gast-/Reservierungsbezug. Beides verlässt die DB nur über den Server.
alter table public.review_automation enable row level security;
alter table public.review_automation_log enable row level security;

revoke all on public.review_automation from anon, authenticated;
revoke all on public.review_automation_log from anon, authenticated;

create policy review_automation_tenant on public.review_automation
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

create policy review_automation_log_tenant on public.review_automation_log
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

comment on table public.review_automation is
    'Je Betrieb: automatische Gast-Bewertung nach Abreise + Bewertungs-'
    'Erinnerung an den Gast. Nur service_role (Wurzel 6).';
comment on table public.review_automation_log is
    'Ein Eintrag je (Reservierung, Art) — UNIQUE verhindert doppelte '
    'Bewertungen/Mails bei Retry oder zweitem Worker (Wurzel 2).';
