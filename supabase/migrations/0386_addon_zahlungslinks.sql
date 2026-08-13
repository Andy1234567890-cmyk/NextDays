-- 0386_addon_zahlungslinks.sql — Zusatzleistungen per Stripe kassieren
--
-- Bis hierher gab es für gekaufte Zusatzleistungen (`reservation_addons`, 0075)
-- nur „manuell als bezahlt markieren". Diese Migration trägt den Zahlweg nach:
-- ein Stripe **Payment Link**, den der Betrieb dem Gast schickt.
--
-- GELDFLUSS (Entscheidung des Betriebs-Modells, nicht geraten):
--   Der Link wird als **Direct Charge IM VERBUNDENEN KONTO** des Betriebs
--   erzeugt (Stripe-Account-Header). Damit
--     * gehört der Charge dem Betrieb (Merchant of Record, seine Währung, sein
--       Name auf der Kartenabrechnung),
--     * landet das Geld direkt auf SEINEM Stripe-Saldo („wird dort
--       gutgeschrieben") und wird von dort ausgezahlt,
--     * behält die Plattform ihren Anteil über `application_fee_amount`
--       (Satz aus `tenants.addon_fee_bps`, Default 500 = 5 %) ein — Stripe
--       verbucht ihn direkt auf den Plattform-Saldo.
--   Der Auszahlungslauf (`features/payouts`, Plattform-Ledger) ist davon NICHT
--   betroffen: Er transferiert nur Marktplatz-Buchungen (`channel='portal'`)
--   vom Plattform-Saldo. Eine Zusatzleistung fließt nie über beide Wege.
--
-- IDEMPOTENZ (Wurzel 2): Doppelklick/Retry darf keinen zweiten Link und keine
-- zweite Zahlung erzeugen:
--   * partieller Unique-Index → höchstens EIN offener Link je Reservierung,
--   * Unique auf der Stripe-Link-ID und auf der Checkout-Session,
--   * am Link selbst hängt in Stripe `restrictions.completed_sessions.limit=1`,
--     der Link ist also nach der ersten erfolgreichen Zahlung tot.
--
-- SICHERHEIT (Wurzel 6): Finanzdaten. Pauschale GRANTs entziehen + restriktive
-- tenant-Policy für ALLE Richtungen — sonst könnte ein eingeloggter cleaner per
-- anon-Key `/rest/v1/addon_payment_links` lesen UND schreiben (Beträge,
-- Zahl-URLs, Plattform-Anteil). Nur service_role spricht diese Tabellen.
--
-- REALTIME: bewusst KEINE Publikations-Mitgliedschaft. Ohne `select` für
-- `authenticated` (siehe revoke) wäre ein Abo eine stumme Attrappe. Die UI hört
-- stattdessen auf `reservation_addons` — dessen Statuswechsel (pending → paid)
-- ist genau das Ereignis, das die Zahlung sichtbar macht.

-- ============================================================================
-- 1. Zahlungsart „addon" im payments-Enum
-- ============================================================================
-- Eine bezahlte Zusatzleistung ist weder Anzahlung noch Restzahlung der
-- Buchung. Ohne eigenen Typ liefe sie als 'full' und würde die Buchung als
-- vollständig bezahlt ausweisen (Falschaussage in Rechnung + Zeitleiste).
alter type public.payment_type add value if not exists 'addon';

-- ============================================================================
-- 2. Provisionssatz auf Zusatzleistungen — je Betrieb, nicht global
-- ============================================================================
-- Gleiches Muster wie `tenants.platform_fee_bps` (0180): Der Satz ist eine
-- Konditions-Frage des einzelnen Betriebs (Sonderkonditionen möglich), keine
-- Umgebungsvariable. 500 bps = 5,00 %.
alter table public.tenants
    add column if not exists addon_fee_bps integer not null default 500
        check (addon_fee_bps between 0 and 10000);

comment on column public.tenants.addon_fee_bps is
  'Plattform-Anteil an bezahlten Zusatzleistungen in Basispunkten '
  '(500 = 5,00 %). Wird beim Direct Charge im verbundenen Konto als '
  'application_fee einbehalten.';

-- ============================================================================
-- 3. Zahlungslinks
-- ============================================================================
create table if not exists public.addon_payment_links (
    id                     uuid primary key default gen_random_uuid(),
    tenant_id              uuid not null
                             references public.tenants (id) on delete cascade,
    reservation_id         uuid not null
                             references public.reservations (id) on delete cascade,
    -- Verbundenes Konto, in dem der Link entstanden ist. Festgehalten, weil ein
    -- späterer Abruf/Storno denselben Stripe-Account-Header braucht — der
    -- Betrieb könnte sein Konto zwischenzeitlich gewechselt haben.
    stripe_account_id      text not null,
    stripe_payment_link_id text not null,
    stripe_price_id        text not null,
    stripe_product_id      text not null,
    url                    text not null,
    -- Währung kommt aus der Buchung (Wurzel 4) — nie ein EUR-Ersatzwert.
    currency               text not null,
    amount_cents           bigint not null check (amount_cents > 0),
    -- Plattform-Anteil, der beim Charge einbehalten wird (application_fee).
    application_fee_cents  bigint not null default 0
                             check (application_fee_cents >= 0),
    -- Satz in Basispunkten (500 = 5,00 %), damit der historische Satz am Beleg
    -- steht und eine spätere Preisänderung alte Links nicht umdeutet.
    fee_bps                integer not null
                             check (fee_bps between 0 and 10000),
    status                 text not null default 'open'
                             check (status in ('open', 'paid', 'cancelled')),
    checkout_session_id    text,
    payment_intent_id      text,
    paid_at                timestamptz,
    created_at             timestamptz not null default now(),
    created_by             uuid references public.users (id) on delete set null,
    constraint addon_payment_links_fee_kleiner_betrag
        check (application_fee_cents <= amount_cents)
);

-- Höchstens EIN offener Link je Buchung (Wurzel 2): Der zweite Klick auf
-- „Zahlungslink erstellen" findet den vorhandenen und gibt ihn zurück.
create unique index if not exists addon_payment_links_offen_uidx
    on public.addon_payment_links (reservation_id)
    where status = 'open';
create unique index if not exists addon_payment_links_stripe_uidx
    on public.addon_payment_links (stripe_payment_link_id);
-- Eine Checkout-Session darf nur einen Link bezahlen (Webhook-Redelivery).
create unique index if not exists addon_payment_links_session_uidx
    on public.addon_payment_links (checkout_session_id)
    where checkout_session_id is not null;
create index if not exists addon_payment_links_tenant_idx
    on public.addon_payment_links (tenant_id, created_at desc);
create index if not exists addon_payment_links_reservation_idx
    on public.addon_payment_links (reservation_id);

comment on table public.addon_payment_links is
  'Stripe Payment Link je Buchung, mit dem der Gast offene Zusatzleistungen '
  'bezahlt. Direct Charge im verbundenen Konto des Betriebs; die Plattform '
  'behält application_fee_cents ein. Sensibel (Wurzel 6): nur service_role.';

-- ============================================================================
-- 4. Positionen des Links
-- ============================================================================
-- Welche gekauften Zusatzleistungen dieser Link abdeckt. Eigene Tabelle statt
-- Array-Spalte, damit die Zuordnung referenziell hält (eine gelöschte
-- Zusatzleistung reißt ihre Position mit) und der Webhook exakt weiß, welche
-- Zeilen auf 'paid' zu setzen sind.
create table if not exists public.addon_payment_link_items (
    link_id              uuid not null
                           references public.addon_payment_links (id)
                           on delete cascade,
    reservation_addon_id uuid not null
                           references public.reservation_addons (id)
                           on delete cascade,
    amount_cents         bigint not null check (amount_cents >= 0),
    primary key (link_id, reservation_addon_id)
);

create index if not exists addon_payment_link_items_addon_idx
    on public.addon_payment_link_items (reservation_addon_id);

comment on table public.addon_payment_link_items is
  'Positionen eines Zusatzleistungs-Zahlungslinks (Snapshot der Beträge).';

-- ============================================================================
-- 5. RLS + Direktpfad schließen (Wurzel 6)
-- ============================================================================
alter table public.addon_payment_links enable row level security;
alter table public.addon_payment_link_items enable row level security;

revoke all on public.addon_payment_links from anon, authenticated;
revoke all on public.addon_payment_link_items from anon, authenticated;

drop policy if exists addon_payment_links_tenant on public.addon_payment_links;
create policy addon_payment_links_tenant
    on public.addon_payment_links
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

drop policy if exists addon_payment_links_tenant_restrict
    on public.addon_payment_links;
create policy addon_payment_links_tenant_restrict
    on public.addon_payment_links
    as restrictive
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

-- Positionen erben den Scope über ihren Link.
drop policy if exists addon_payment_link_items_tenant
    on public.addon_payment_link_items;
create policy addon_payment_link_items_tenant
    on public.addon_payment_link_items
    for all
    using (
        exists (
            select 1
              from public.addon_payment_links l
             where l.id = link_id
               and l.tenant_id = public.current_tenant_id()
        )
    )
    with check (
        exists (
            select 1
              from public.addon_payment_links l
             where l.id = link_id
               and l.tenant_id = public.current_tenant_id()
        )
    );

drop policy if exists addon_payment_link_items_tenant_restrict
    on public.addon_payment_link_items;
create policy addon_payment_link_items_tenant_restrict
    on public.addon_payment_link_items
    as restrictive
    for all
    using (
        exists (
            select 1
              from public.addon_payment_links l
             where l.id = link_id
               and l.tenant_id = public.current_tenant_id()
        )
    )
    with check (
        exists (
            select 1
              from public.addon_payment_links l
             where l.id = link_id
               and l.tenant_id = public.current_tenant_id()
        )
    );
