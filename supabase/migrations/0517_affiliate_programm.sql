-- 0517 — Partnerprogramm (Affiliate): Partner werben Betriebe und erhalten
-- zwölf Monate lang einen Anteil am Abo-Umsatz, gestaffelt nach der Zahl
-- ihrer zahlenden Kunden. Plan: docs/AFFILIATE-PROGRAMM-PLAN.md (02.09.2026).
--
-- DIE DRITTE NUTZERWELT. Ein Partner ist weder Betriebs-Nutzer (users, hat
-- tenant_id) noch Plattform-Gast (portal_guests) noch Backoffice
-- (platform_admins). Er bekommt — wie der Gast (0181, ADR-0015) — einen
-- eigenen GoTrue-Login und eine eigene Stammdatenzeile mit id == auth.uid().
-- Erkennungsmerkmal im Token ist `app_metadata.affiliate = true`; der
-- Server prüft ZUSÄTZLICH bei jedem Request `affiliates.status` frisch aus
-- der DB (Wurzel 7: ein gesperrter Partner darf nicht bis zum Token-Ablauf
-- weiterarbeiten).
--
-- EINSTUFIG, BEWUSST: Provision entsteht ausschließlich aus dem Abo-Umsatz
-- selbst geworbener Betriebe, kein Verdienst an Unter-Partnern, kein
-- Teilnahmebeitrag. Genau dadurch greifen UCPD Anhang I Nr. 14, § 16 II UWG
-- und spilleloven § 24 nach ihrem Wortlaut nicht (Rechercheergebnis
-- 02.09.2026). Eine zweite Stufe wäre eine neue Entscheidung, keine Spalte.
--
-- WURZEL 6 — ALLES SERVER-VERWALTET: Finanzdaten (Provisionen, Auszahlungen,
-- Bankverbindung), Attribution und Freigabe-Status dürfen weder ein
-- Partner noch ein Betriebs-Nutzer per anon-Key lesen oder schreiben. Jede
-- Tabelle: RLS an, `revoke all` für anon/authenticated, restriktive
-- Deny-all-Policy als Backstop (Muster platform_admins, 0202). Der einzige
-- Weg ist der FastAPI-Slice `features/affiliates` mit service_role.
-- Bewusst KEINE Realtime-Publikation: ein Abo bräuchte `select` für
-- `authenticated`, genau das entzieht das revoke.
--
-- WURZEL 4 — KEINE HARDCODES: Die Staffel (5/20/50/100 Kunden → 15/20/25/30 %)
-- steht als DATEN in `affiliate_tiers`, nicht im Code. Jede Provisionszeile
-- speichert Satz UND Stufe zum Buchungszeitpunkt, damit eine spätere
-- Änderung der Staffel historische Beträge nicht neu interpretiert
-- (Muster dynpricing_ledger.rate, 0277). Beträge tragen IMMER ihre Währung;
-- es gibt keine Umrechnung im Ledger — ausgezahlt wird je Währung.
--
-- WURZEL 2 — ALLES KOMMT DOPPELT: Stripe liefert `invoice.paid` erneut
-- (Retry, Redelivery). UNIQUE (stripe_invoice_id) für Ertragszeilen und
-- UNIQUE (stripe_event_id) sind der Backstop unter der Anwendungsprüfung.
-- Ein Betrieb wird GENAU EINEM Partner zugeordnet (UNIQUE tenant_id) —
-- spätere Codes oder Klicks ändern die Zuordnung nicht.

-- =========================================================================
-- 1. Staffel — die Ränge als Daten
-- =========================================================================
create table if not exists public.affiliate_tiers (
    id            text primary key,
    -- Anzeigename des Rangs (deutsch; die Oberfläche übersetzt über den Key).
    name          text not null,
    -- Bereich zahlender Kunden, den dieser Rang abdeckt. max_customers NULL =
    -- offen nach oben (der höchste Rang).
    min_customers integer not null check (min_customers >= 0),
    max_customers integer check (max_customers is null or max_customers >= min_customers),
    -- Provisionssatz als Faktor (0.15 = 15 %).
    rate          numeric(5,4) not null check (rate >= 0 and rate <= 1),
    sort          integer not null,
    created_at    timestamptz not null default now()
);

comment on table public.affiliate_tiers is
    'Staffel des Partnerprogramms: Rang → Kundenbereich → Provisionssatz. '
    'Quelle der Wahrheit für den Satz; der Code hält keine Prozentzahl.';

insert into public.affiliate_tiers (id, name, min_customers, max_customers, rate, sort) values
    ('einsteiger', 'Einsteiger',  0,    5,   0.1500, 1),
    ('aufsteiger', 'Aufsteiger',  6,   20,   0.2000, 2),
    ('semi_super', 'Semi Super', 21,   50,   0.2500, 3),
    ('super',      'Super',      51, null,   0.3000, 4)
on conflict (id) do nothing;

-- =========================================================================
-- 2. Partner — Stammdaten, Status, Steuer- und Auszahlungsangaben
-- =========================================================================
create table if not exists public.affiliates (
    -- id == auth.uid() des Partner-Logins (Muster portal_guests). Kein
    -- tenant_id: ein Partner gehört zu keinem Betrieb.
    id                  uuid primary key references auth.users (id) on delete cascade,
    email               text not null,
    full_name           text not null,
    -- Firma optional; Privatpersonen (Influencer) haben keine.
    company             text,
    -- 'company' (Unternehmer, braucht USt-IdNr.) oder 'private' (Privatperson;
    -- Provision ist beim Empfänger zu versteuern, Hinweis im Portal).
    legal_form          text not null check (legal_form in ('company', 'private')),
    country             text not null,
    vat_id              text,
    -- Zeitpunkt der VIES-Bestätigung. NULL = nicht geprüft oder ungültig;
    -- eine Auszahlung an ein Unternehmen verlangt einen Wert (fail-closed).
    vat_id_verified_at  timestamptz,
    -- Sprache der Mails/Oberfläche (BCP-47-Basis, eine der 24 EU-Sprachen).
    language            text not null default 'en',
    -- Kanal, über den geworben wird (Website, Social-Profil) — Pflicht bei
    -- der Bewerbung, damit das Backoffice prüfen kann, wer da wirbt.
    channel_url         text,
    -- Freitext der Bewerbung („wie erreichen Sie Betriebe?").
    pitch               text,
    -- Auszahlungsweg. 'wise' und 'sepa' laufen als Sammel-CSV aus dem
    -- Backoffice (Stufe 1), 'paypal' ebenso. Stripe Connect kommt später.
    payout_method       text check (payout_method in ('wise', 'sepa', 'paypal')),
    -- Empfängerangaben je Weg (IBAN + Kontoinhaber, Wise-E-Mail, PayPal-
    -- E-Mail). Klartext in einer service_role-only-Tabelle — dieselbe
    -- Entscheidung wie tenant_billing_profile.iban (0023).
    payout_details      jsonb not null default '{}'::jsonb,
    -- Mindestbetrag je Auszahlung IN DER JEWEILIGEN WÄHRUNG steht in
    -- `affiliate_payout_minimums` (Abschnitt 7), nicht hier.
    status              text not null default 'pending_review'
        check (status in ('pending_review', 'approved', 'rejected', 'suspended')),
    status_reason       text,
    reviewed_by         uuid references auth.users (id) on delete set null,
    reviewed_at         timestamptz,
    -- Aktueller Rang (Kopie des letzten Eintrags in affiliate_tier_history,
    -- damit die Provisionsbuchung nicht jedes Mal die Historie liest).
    current_tier_id     text not null default 'einsteiger'
        references public.affiliate_tiers (id),
    -- Seit wann die Kundenzahl UNTER dem aktuellen Rang liegt. Der Monatslauf
    -- stuft erst zurück, wenn zwei Stichtage in Folge darunter lagen — ein
    -- einzelner Churn soll nicht sofort den Satz drücken. NULL = nicht darunter.
    tier_below_since    timestamptz,
    -- Zustimmung zu den Partner-AGB (Version + Zeitpunkt). Ohne sie keine
    -- Freigabe.
    terms_version       text,
    terms_accepted_at   timestamptz,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create unique index if not exists affiliates_email_lower_uq
    on public.affiliates (lower(email));
create index if not exists affiliates_status_idx
    on public.affiliates (status, created_at desc);

comment on table public.affiliates is
    'Partner des Affiliate-Programms (dritte Nutzerwelt, id == auth.uid()). '
    'Kein tenant_id. Freigabe manuell im Backoffice; status wird bei jedem '
    'Request frisch geprüft. Nur service_role liest/schreibt.';
comment on column public.affiliates.legal_form is
    'company = Unternehmer (Gutschrift mit Reverse-Charge-Vermerk, USt-IdNr. '
    'Pflicht für die Auszahlung); private = Privatperson (Gutschrift ohne USt, '
    'Steuerpflicht beim Empfänger).';

-- =========================================================================
-- 3. Empfehlungscodes — kurz, lesbar, eindeutig
-- =========================================================================
create table if not exists public.affiliate_referral_codes (
    id           uuid primary key default gen_random_uuid(),
    affiliate_id uuid not null references public.affiliates (id) on delete cascade,
    -- Der Code, wie er in Links (?ref=CODE) und im Registrierungsformular
    -- steht. Groß-/Kleinschreibung ist egal: gespeichert wird upper-case,
    -- der Server normalisiert die Eingabe.
    code         text not null,
    label        text,
    active       boolean not null default true,
    created_at   timestamptz not null default now(),
    constraint affiliate_referral_codes_code_format
        check (code ~ '^[A-Z0-9][A-Z0-9-]{2,30}$')
);

create unique index if not exists affiliate_referral_codes_code_uq
    on public.affiliate_referral_codes (code);
create index if not exists affiliate_referral_codes_affiliate_idx
    on public.affiliate_referral_codes (affiliate_id);

-- =========================================================================
-- 4. Klicks — was auf den Link kam (Diagnose + Betrugsprüfung)
-- =========================================================================
-- Kein Cookie-Tracking hier: der Klick landet, wenn jemand den Link
-- /api/v1/affiliates/r/{code} öffnet. IP und User-Agent werden NUR als
-- SHA-256 gespeichert (Vergleich auf Gleichheit reicht der Betrugsprüfung;
-- die Rohwerte braucht niemand). Aufbewahrung 90 Tage — der Worker räumt.
create table if not exists public.affiliate_clicks (
    id           uuid primary key default gen_random_uuid(),
    code_id      uuid not null references public.affiliate_referral_codes (id) on delete cascade,
    affiliate_id uuid not null references public.affiliates (id) on delete cascade,
    -- Zufallskennung, die als Query-Parameter bis zur Registrierung
    -- weitergereicht wird (`?ref=CODE&klick=...`), damit die Zuordnung den
    -- konkreten Klick benennen kann — ohne Cookie.
    click_token  text not null,
    ip_hash      text,
    ua_hash      text,
    referrer     text,
    utm          jsonb not null default '{}'::jsonb,
    landing      text,
    created_at   timestamptz not null default now()
);

create unique index if not exists affiliate_clicks_token_uq
    on public.affiliate_clicks (click_token);
create index if not exists affiliate_clicks_affiliate_idx
    on public.affiliate_clicks (affiliate_id, created_at desc);
create index if not exists affiliate_clicks_created_idx
    on public.affiliate_clicks (created_at);

-- =========================================================================
-- 5. Zuordnung — welcher Betrieb kam über welchen Partner
-- =========================================================================
create table if not exists public.affiliate_referrals (
    id                uuid primary key default gen_random_uuid(),
    affiliate_id      uuid not null references public.affiliates (id) on delete cascade,
    -- GENAU EIN Partner je Betrieb (Wurzel 2). Der erste gewinnt; spätere
    -- Codes werden protokolliert (Log), ändern aber nichts. Nur das
    -- Backoffice darf umhängen (manual, mit Audit).
    tenant_id         uuid not null references public.tenants (id) on delete cascade,
    code_id           uuid references public.affiliate_referral_codes (id) on delete set null,
    click_id          uuid references public.affiliate_clicks (id) on delete set null,
    -- Wie die Zuordnung zustande kam: 'url' (Code aus dem Link, sichtbar im
    -- Formular bestätigt), 'code' (von Hand eingetippt), 'manual' (Backoffice).
    method            text not null check (method in ('url', 'code', 'manual')),
    status            text not null default 'pending'
        check (status in ('pending', 'approved', 'held', 'rejected')),
    -- Ergebnis der Betrugsregeln beim Anlegen: gleiche E-Mail-Domain wie der
    -- Partner, gleiche IP wie der Klick des Partners, … Ein Treffer setzt
    -- status='held' und wird hier benannt — nie stumm verworfen (Wurzel 5).
    flags             jsonb not null default '[]'::jsonb,
    -- Der Betrieb hat bei der Registrierung erlaubt, dass sein Empfehler ihn
    -- über myNextDays kontaktieren darf (Chat, Etappe 5). Default false.
    contact_opt_in    boolean not null default false,
    -- Erste bezahlte Abo-Rechnung des Betriebs: ab hier laufen die zwölf
    -- Monate. NULL = noch nicht zahlend.
    first_paid_at     timestamptz,
    commission_until  timestamptz,
    reviewed_by       uuid references auth.users (id) on delete set null,
    reviewed_at       timestamptz,
    review_note       text,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

create unique index if not exists affiliate_referrals_tenant_uq
    on public.affiliate_referrals (tenant_id);
create index if not exists affiliate_referrals_affiliate_idx
    on public.affiliate_referrals (affiliate_id, created_at desc);

comment on column public.affiliate_referrals.commission_until is
    'first_paid_at + 12 Monate. Rechnungen mit period_start danach tragen '
    'keine Provision mehr. Aus der Zuordnung gerechnet, nicht aus dem Code.';

-- =========================================================================
-- 6. Provisions-Ledger — append-only, je Rechnung eine Ertragszeile
-- =========================================================================
create table if not exists public.affiliate_commissions (
    id                    uuid primary key default gen_random_uuid(),
    referral_id           uuid not null references public.affiliate_referrals (id) on delete cascade,
    affiliate_id          uuid not null references public.affiliates (id) on delete cascade,
    tenant_id             uuid not null references public.tenants (id) on delete cascade,
    -- 'earn' = Ertrag aus einer bezahlten Abo-Rechnung; 'reversal' =
    -- Gegenbuchung (Erstattung, Chargeback, Gutschrift), negativ, zeigt per
    -- parent_id auf die Ertragszeile; 'adjustment' = manuelle Korrektur aus
    -- dem Backoffice (Vorzeichen frei, Grund Pflicht).
    kind                  text not null check (kind in ('earn', 'reversal', 'adjustment')),
    parent_id             uuid references public.affiliate_commissions (id) on delete set null,
    stripe_invoice_id     text,
    -- Stripe-Event, das die Zeile erzeugt hat. UNIQUE = ein Event schreibt
    -- höchstens eine Zeile (Wurzel 2). NULL bei manuellen Korrekturen.
    stripe_event_id       text,
    -- Zahlungsreferenzen der Rechnung, damit eine spätere Erstattung
    -- (charge.refunded trägt seit API 2025 keine invoice mehr) den Ertrag
    -- wiederfindet.
    stripe_charge_id      text,
    stripe_payment_intent text,
    -- Provisionsbasis: Netto der ABO-Positionen der Rechnung (nach Rabatt,
    -- ohne Steuer, ohne OTA-Provisions-/Zusatzleistungs-Posten), in
    -- Rechnungswährung.
    currency              text not null,
    base_amount           numeric(12,2) not null,
    rate                  numeric(5,4) not null check (rate >= 0 and rate <= 1),
    tier_id               text not null references public.affiliate_tiers (id),
    amount                numeric(12,2) not null,
    status                text not null default 'pending'
        check (status in ('pending', 'approved', 'held', 'paid', 'reversed', 'cancelled')),
    -- Ab wann die Zeile auszahlbar ist (Ende des Erstattungsfensters).
    matures_at            timestamptz,
    payout_id             uuid,
    -- Abrechnungsperiode der Rechnung (YYYY-MM) für Monatsansichten.
    period                text,
    reason                text,
    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now(),
    constraint affiliate_commissions_sign check (
        (kind = 'earn' and amount >= 0 and base_amount >= 0)
        or (kind = 'reversal' and amount <= 0)
        or kind = 'adjustment'
    )
);

-- Eine Ertragszeile je Stripe-Rechnung — der Backstop gegen Redelivery.
create unique index if not exists affiliate_commissions_invoice_earn_uq
    on public.affiliate_commissions (stripe_invoice_id)
    where kind = 'earn' and stripe_invoice_id is not null;
create unique index if not exists affiliate_commissions_event_uq
    on public.affiliate_commissions (stripe_event_id)
    where stripe_event_id is not null;
create index if not exists affiliate_commissions_affiliate_idx
    on public.affiliate_commissions (affiliate_id, created_at desc);
create index if not exists affiliate_commissions_payout_idx
    on public.affiliate_commissions (affiliate_id, status, currency, matures_at);
create index if not exists affiliate_commissions_charge_idx
    on public.affiliate_commissions (stripe_charge_id)
    where stripe_charge_id is not null;

comment on table public.affiliate_commissions is
    'Provisions-Ledger des Partnerprogramms, append-only. Eine Ertragszeile je '
    'bezahlter Abo-Rechnung; Erstattungen als negative Gegenzeile. Satz und '
    'Rang zum Buchungszeitpunkt gespeichert. Nur service_role.';

-- =========================================================================
-- 7. Auszahlungen — je Partner und Währung, Stufe 1 als Sammel-CSV
-- =========================================================================
create table if not exists public.affiliate_payouts (
    id             uuid primary key default gen_random_uuid(),
    affiliate_id   uuid not null references public.affiliates (id) on delete cascade,
    currency       text not null,
    amount         numeric(12,2) not null check (amount > 0),
    method         text not null check (method in ('wise', 'sepa', 'paypal')),
    status         text not null default 'pending'
        check (status in ('pending', 'processing', 'paid', 'failed')),
    -- Referenz des Zahlungsdienstes (Wise-Batch-Nr., Überweisungs-Referenz).
    external_ref   text,
    -- Zeitraum der enthaltenen Provisionen.
    period_from    date,
    period_to      date,
    -- Nummer der Gutschrift (Self-Billing/afregningsbilag), fortlaufend.
    statement_no   text,
    statement_path text,
    created_by     uuid references auth.users (id) on delete set null,
    paid_at        timestamptz,
    failed_reason  text,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create unique index if not exists affiliate_payouts_statement_uq
    on public.affiliate_payouts (statement_no)
    where statement_no is not null;
create index if not exists affiliate_payouts_affiliate_idx
    on public.affiliate_payouts (affiliate_id, created_at desc);
create index if not exists affiliate_payouts_status_idx
    on public.affiliate_payouts (status, created_at desc);

-- Welche Provisionszeilen in welcher Auszahlung stecken — nachvollziehbar
-- statt nur eines payout_id-Feldes an der Zeile.
create table if not exists public.affiliate_payout_items (
    payout_id     uuid not null references public.affiliate_payouts (id) on delete cascade,
    commission_id uuid not null references public.affiliate_commissions (id) on delete restrict,
    primary key (payout_id, commission_id)
);
create unique index if not exists affiliate_payout_items_commission_uq
    on public.affiliate_payout_items (commission_id);

alter table public.affiliate_commissions
    add constraint affiliate_commissions_payout_fk
    foreign key (payout_id) references public.affiliate_payouts (id) on delete set null;

-- Mindestbetrag je Währung — Daten, kein Code (Wurzel 4). Fehlt die Währung
-- hier, wird NICHT ausgezahlt und der Mangel gemeldet.
create table if not exists public.affiliate_payout_minimums (
    currency   text primary key,
    minimum    numeric(12,2) not null check (minimum >= 0),
    updated_at timestamptz not null default now()
);
insert into public.affiliate_payout_minimums (currency, minimum) values
    ('EUR', 50.00), ('DKK', 375.00), ('SEK', 550.00), ('NOK', 550.00),
    ('PLN', 220.00), ('CZK', 1250.00), ('HUF', 20000.00), ('RON', 250.00),
    ('BGN', 100.00), ('CHF', 50.00), ('GBP', 45.00)
on conflict (currency) do nothing;

-- =========================================================================
-- 8. Rang-Verlauf
-- =========================================================================
create table if not exists public.affiliate_tier_history (
    id                        uuid primary key default gen_random_uuid(),
    affiliate_id              uuid not null references public.affiliates (id) on delete cascade,
    tier_id                   text not null references public.affiliate_tiers (id),
    valid_from                timestamptz not null default now(),
    valid_to                  timestamptz,
    -- Zahlende Kunden zum Stichtag, die zu dieser Einstufung führten.
    paying_customers          integer not null default 0,
    -- 'auto' (Monatslauf) oder 'manual' (Backoffice, mit Grund).
    trigger_kind              text not null check (trigger_kind in ('auto', 'manual')),
    changed_by                uuid references auth.users (id) on delete set null,
    note                      text
);
create index if not exists affiliate_tier_history_affiliate_idx
    on public.affiliate_tier_history (affiliate_id, valid_from desc);

-- =========================================================================
-- 9. Werbematerial (Videos, Banner, Texte) — vom Backoffice gepflegt
-- =========================================================================
create table if not exists public.affiliate_assets (
    id           uuid primary key default gen_random_uuid(),
    kind         text not null check (kind in ('video', 'image', 'text', 'link')),
    title        text not null,
    description  text,
    -- Sprache des Materials (eine der 24), NULL = sprachneutral.
    language     text,
    -- Öffentliche URL (Storage/CDN) bzw. Textinhalt bei kind='text'.
    url          text,
    body         text,
    sort         integer not null default 0,
    active       boolean not null default true,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

-- =========================================================================
-- 10. Härtung (Wurzel 6): RLS + harter GRANT-Entzug + Deny-all-Backstop
-- =========================================================================
do $$
declare
    t text;
begin
    foreach t in array array[
        'affiliate_tiers', 'affiliates', 'affiliate_referral_codes',
        'affiliate_clicks', 'affiliate_referrals', 'affiliate_commissions',
        'affiliate_payouts', 'affiliate_payout_items',
        'affiliate_payout_minimums', 'affiliate_tier_history',
        'affiliate_assets'
    ] loop
        execute format('alter table public.%I enable row level security', t);
        execute format('revoke all on public.%I from anon, authenticated', t);
        execute format(
            'drop policy if exists %I on public.%I', t || '_deny_all', t
        );
        execute format(
            'create policy %I on public.%I as restrictive for all '
            'using (false) with check (false)',
            t || '_deny_all', t
        );
    end loop;
end $$;

-- updated_at pflegen (dasselbe Muster wie überall: eine Funktion je Tabelle
-- wäre Doppelpflege; die vorhandene set_updated_at() wird wiederverwendet,
-- falls sie existiert — sonst eine schlanke eigene).
create or replace function public.affiliate_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end $$;

revoke execute on function public.affiliate_touch_updated_at() from anon, authenticated;

do $$
declare
    t text;
begin
    foreach t in array array[
        'affiliates', 'affiliate_referrals', 'affiliate_commissions',
        'affiliate_payouts', 'affiliate_assets'
    ] loop
        execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
        execute format(
            'create trigger %I before update on public.%I '
            'for each row execute function public.affiliate_touch_updated_at()',
            t || '_touch', t
        );
    end loop;
end $$;
