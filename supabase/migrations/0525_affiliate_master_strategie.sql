-- 0525 — Partnerprogramm: Master-Strategie (Plan Abschnitt 7, Entscheidung 02.09.2026)
--
-- WAS SICH ÄNDERT
--   1. Ränge neu: Einsteiger 0–4 · Aufsteiger 5–9 · Experte 10–19 · Elite-Partner ab 20.
--      Die IDs `semi_super`/`super` weichen `experte`/`elite`; alle Verweise
--      (affiliates.current_tier_id, affiliate_commissions.tier_id,
--      affiliate_tier_history.tier_id) werden umgehängt, dann fallen die alten
--      Zeilen. Gezählt wird ab jetzt die STRUKTUR (eigene + Team-Kunden, eine
--      Ebene) — das rechnet `stufen.py`, hier steht nur die Staffel.
--   2. `team_allowed`: Untervermittler erst ab Aufsteiger — als DATEN am Rang,
--      nicht als Zahl im Code (Wurzel 4).
--   3. Aufstiegsbonus: einmalig je erreichtem Rang, Betrag je Rang UND Währung
--      in `affiliate_tier_bonuses` (Muster `affiliate_payout_minimums`).
--      Beschluss: 50,00 EUR für alle Partner, unabhängig vom Land.
--   4. Team-Provision wird DIFFERENZ (Satz des Sponsors − Satz des Team-
--      Partners); `override_rate` bleibt als Spalte stehen, wird aber nicht
--      mehr gelesen (0 gesetzt, Kommentar „außer Dienst").
--   5. Drei neue Provisionsarten im Ledger:
--        bonus         — Aufstiegsbonus (keine Rechnung, kein Betrieb)
--        lifetime      — Superprovision 2,5 % ab Elite auf die ganze Struktur,
--                        ohne 12-Monats-Grenze
--        booking_share — Markt-Turbo 0,5 % je myBestDays-Buchung, Partner UND
--                        Sponsor je eine Zeile
--      Für `bonus` dürfen referral_id/tenant_id leer sein; für alles andere
--      bleiben sie Pflicht (CHECK). UNIQUE-Backstops je Art (Wurzel 2).
--
-- Idempotent: jede Anweisung prüft ihren Zustand; ein zweiter Lauf ändert nichts.

-- --- 1. Ränge ---------------------------------------------------------------------------
alter table public.affiliate_tiers
    add column if not exists team_allowed boolean not null default false;
comment on column public.affiliate_tiers.team_allowed is
    'Darf ein Partner dieses Rangs Team-Partner (Untervermittler) führen? '
    'Einsteiger nein, ab Aufsteiger ja (Master-Strategie 02.09.2026).';

insert into public.affiliate_tiers (id, name, min_customers, max_customers, rate, sort, override_rate, team_allowed) values
    ('experte', 'Experte',       10, 19,   0.2500, 3, 0, true),
    ('elite',   'Elite-Partner', 20, null, 0.3000, 4, 0, true)
on conflict (id) do nothing;

update public.affiliate_tiers set name = 'Einsteiger', min_customers = 0, max_customers = 4, team_allowed = false
    where id = 'einsteiger';
update public.affiliate_tiers set name = 'Aufsteiger', min_customers = 5, max_customers = 9, team_allowed = true
    where id = 'aufsteiger';

-- Verweise umhängen, dann die alten IDs entfernen.
update public.affiliates set current_tier_id = 'experte' where current_tier_id = 'semi_super';
update public.affiliates set current_tier_id = 'elite'   where current_tier_id = 'super';
update public.affiliate_commissions set tier_id = 'experte' where tier_id = 'semi_super';
update public.affiliate_commissions set tier_id = 'elite'   where tier_id = 'super';
update public.affiliate_tier_history set tier_id = 'experte' where tier_id = 'semi_super';
update public.affiliate_tier_history set tier_id = 'elite'   where tier_id = 'super';
delete from public.affiliate_tiers where id in ('semi_super', 'super');

-- Superprovision als DATEN am Rang: 2,5 % ab Elite, sonst 0 (Wurzel 4 — keine Zahl im Code).
alter table public.affiliate_tiers
    add column if not exists lifetime_rate numeric(5,4) not null default 0
        check (lifetime_rate >= 0 and lifetime_rate <= 1);
comment on column public.affiliate_tiers.lifetime_rate is
    'Superprovision (Faktor) auf den Netto-Abo-Umsatz ALLER Kunden der Struktur (eigene + Team), '
    'ohne 12-Monats-Grenze, solange der Partner diesen Rang zum Rechnungszeitpunkt hält. 0 = keine.';
update public.affiliate_tiers set lifetime_rate = 0.0250 where id = 'elite' and lifetime_rate <> 0.0250;

-- Programmweite Sätze ohne Rangbezug — der Markt-Turbo (0,5 % je myBestDays-Buchung).
create table if not exists public.affiliate_program_rates (
    key        text primary key,
    rate       numeric(6,5) not null check (rate >= 0 and rate <= 1),
    updated_at timestamptz not null default now()
);
comment on table public.affiliate_program_rates is
    'Programmweite Sätze des Partnerprogramms, die an keinem Rang hängen. '
    'booking_share = Anteil am Brutto-Buchungswert jeder myBestDays-Buchung eines geworbenen '
    'Betriebs, je für Partner UND Sponsor (Beschluss 02.09.2026: 0,5 %).';
insert into public.affiliate_program_rates (key, rate) values ('booking_share', 0.00500)
on conflict (key) do nothing;
alter table public.affiliate_program_rates enable row level security;
revoke all on public.affiliate_program_rates from anon, authenticated;
drop policy if exists affiliate_program_rates_deny_all on public.affiliate_program_rates;
create policy affiliate_program_rates_deny_all on public.affiliate_program_rates
    as restrictive for all using (false) with check (false);

-- --- 4. override_rate außer Dienst --------------------------------------------------------
update public.affiliate_tiers set override_rate = 0 where override_rate <> 0;
comment on column public.affiliate_tiers.override_rate is
    'AUSSER DIENST seit 0525: Team-Provision ist die Differenz rate(Sponsor) − rate(Team-Partner) '
    'zum Rechnungszeitpunkt (provision.override_buchen). Spalte bleibt für alte Auswertungen, wird nicht gelesen.';

-- --- 3. Aufstiegsbonus -------------------------------------------------------------------
create table if not exists public.affiliate_tier_bonuses (
    tier_id    text not null references public.affiliate_tiers (id) on delete cascade,
    currency   text not null,
    amount     numeric(12,2) not null check (amount >= 0),
    updated_at timestamptz not null default now(),
    primary key (tier_id, currency)
);
comment on table public.affiliate_tier_bonuses is
    'Einmaliger Aufstiegsbonus je erreichtem Rang, Betrag je Währung. Beschluss 02.09.2026: '
    '50,00 EUR für Aufsteiger/Experte/Elite, für alle Partner (auch außerhalb der Eurozone). '
    'Ein Rang ohne Zeile zahlt keinen Bonus (Einsteiger).';
insert into public.affiliate_tier_bonuses (tier_id, currency, amount) values
    ('aufsteiger', 'EUR', 50.00),
    ('experte',    'EUR', 50.00),
    ('elite',      'EUR', 50.00)
on conflict (tier_id, currency) do nothing;

alter table public.affiliate_tier_bonuses enable row level security;
revoke all on public.affiliate_tier_bonuses from anon, authenticated;
drop policy if exists affiliate_tier_bonuses_deny_all on public.affiliate_tier_bonuses;
create policy affiliate_tier_bonuses_deny_all on public.affiliate_tier_bonuses
    as restrictive for all using (false) with check (false);

-- --- 5. Provisionsarten ------------------------------------------------------------------
alter table public.affiliate_commissions
    drop constraint if exists affiliate_commissions_kind_check;
alter table public.affiliate_commissions
    add constraint affiliate_commissions_kind_check
        check (kind in ('earn', 'reversal', 'adjustment', 'override', 'bonus', 'lifetime', 'booking_share'));

alter table public.affiliate_commissions
    drop constraint if exists affiliate_commissions_sign;
alter table public.affiliate_commissions
    add constraint affiliate_commissions_sign check (
        (kind in ('earn', 'override', 'bonus', 'lifetime', 'booking_share') and amount >= 0 and base_amount >= 0)
        or (kind = 'reversal' and amount <= 0)
        or kind = 'adjustment'
    );

-- Der Bonus hängt an keinem Betrieb: referral_id/tenant_id dürfen NUR dort leer sein.
alter table public.affiliate_commissions alter column referral_id drop not null;
alter table public.affiliate_commissions alter column tenant_id drop not null;
alter table public.affiliate_commissions
    drop constraint if exists affiliate_commissions_bezug;
alter table public.affiliate_commissions
    add constraint affiliate_commissions_bezug check (
        kind = 'bonus' or (referral_id is not null and tenant_id is not null)
    );

-- Backstops (Wurzel 2): einmal je Rang, einmal je Ertragszeile und Partner, einmal je Charge und Partner.
create unique index if not exists affiliate_commissions_bonus_uq
    on public.affiliate_commissions (affiliate_id, tier_id)
    where kind = 'bonus';
create unique index if not exists affiliate_commissions_lifetime_uq
    on public.affiliate_commissions (parent_id, affiliate_id)
    where kind = 'lifetime';
create unique index if not exists affiliate_commissions_booking_share_uq
    on public.affiliate_commissions (stripe_charge_id, affiliate_id)
    where kind = 'booking_share' and stripe_charge_id is not null;

comment on column public.affiliate_commissions.kind is
    'earn = Ertrag aus bezahlter Abo-Rechnung (12 Monate) · override = Team-Provision des Sponsors '
    '(Differenz der Sätze, 12 Monate, parent_id = earn) · lifetime = Superprovision 2,5 % ab Elite auf '
    'eigene und Team-Kunden, ohne Laufzeitgrenze (parent_id = earn) · booking_share = Markt-Turbo 0,5 % je '
    'myBestDays-Buchung für Partner und Sponsor · bonus = Aufstiegsbonus je Rang (ohne Betrieb) · '
    'reversal = negative Gegenbuchung · adjustment = manuelle Korrektur.';
