-- Durchsetzung der Steuer-Mitwirkungspflicht (§ 23 PStTG / DAC7).
--
-- GESETZLICHE VORGABE, wörtlich aus § 23 PStTG:
--   „…hat der meldende Plattformbetreiber den Anbieter ZWEI MAL an die Vorlage
--    zu erinnern. Legt der Anbieter die ersuchten Informationen auch nach der
--    zweiten Erinnerung nicht vor, hat der meldende Plattformbetreiber
--    SPÄTESTENS NACH 180 TAGEN, NICHT ABER VOR ABLAUF VON 60 TAGEN, seit der
--    ursprünglichen Aufforderung
--      1. die weitere Nutzung der Plattform durch den Anbieter zu verhindern […] oder
--      2. Zahlungen der Vergütung an den Anbieter einzubehalten.
--    Die Maßnahmen […] sind AUFZUHEBEN, sobald der Anbieter die ersuchten
--    Informationen vorgelegt hat."
--
-- WAHL DER MASSNAHME: Nummer 2 (Einbehalt) — das Airbnb-Modell. Booking wählt
-- Nummer 1 (Objekt für den EWR sperren). Der Einbehalt ist milder und
-- reversibel: er trifft nur den säumigen Betrieb, während eine Objektsperre
-- auch bereits gebuchte Gäste und den Kanal-Sync zu den Portalen träfe.
-- Nummer 1 verlangt zudem, eine erneute Registrierung technisch zu verhindern —
-- das wäre ein eigener, deutlich invasiverer Mechanismus.
--
-- WICHTIG — KEINE BAGATELLGRENZE: Die oft zitierte Grenze „unter 30 Fälle UND
-- unter 2.000 EUR" (§ 4 Abs. 5 Nr. 4 PStTG) verweist auf § 5 Abs. 1 Satz 1
-- NUMMER 3 = „der Verkauf von Waren". Vermietung ist NUMMER 1 und damit ab der
-- ERSTEN Buchung meldepflichtig. Eine Untergrenze einzubauen wäre rechtlich
-- falsch (und ein Fantasie-Wert, Wurzel 4).
--
-- Das Unterlassen dieser Maßnahme ist selbst bußgeldbewehrt: § 25 Abs. 1 Nr. 6
-- PStTG, bis 30.000 EUR.

-- Neuer Hold-Grund. Bewusst eigener Wert statt 'manual': der Auszahlungslauf
-- und der Support müssen erkennen, dass hier eine GESETZLICHE Pflicht greift,
-- die nicht per Hand freigegeben werden darf — sie endet allein mit der
-- Vorlage der Angaben.
do $$
begin
    if not exists (
        select 1 from pg_enum e
        join pg_type t on t.oid = e.enumtypid
        where t.typname = 'payout_hold_reason' and e.enumlabel = 'tax_info_missing'
    ) then
        alter type public.payout_hold_reason add value 'tax_info_missing';
    end if;
end $$;

-- Verfolgt die Kaskade je Betrieb und Land: Aufforderung → 2 Erinnerungen →
-- Maßnahme. Ein Eintrag je (tenant_id, country), passend zu taxpayer_info.
create table if not exists public.taxpayer_enforcement (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants (id) on delete cascade,

    -- Land, für das die Angaben fehlen (dort hat der Betrieb Objekte).
    country char(2) not null,

    -- Start der Frist. § 23 rechnet ab „der ursprünglichen Aufforderung".
    requested_at timestamptz not null default now(),

    -- Die zwei gesetzlich vorgeschriebenen Erinnerungen.
    reminder_1_at timestamptz,
    reminder_2_at timestamptz,

    -- Wann der Einbehalt gesetzt wurde (frühestens 60, spätestens 180 Tage
    -- nach requested_at).
    enforced_at timestamptz,

    -- Wann die Maßnahme aufgehoben wurde. § 23 Satz 3 macht das zur PFLICHT,
    -- sobald die Angaben vorliegen — nicht zur Kulanz.
    resolved_at timestamptz,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint taxpayer_enforcement_tenant_country_unique
        unique (tenant_id, country),

    -- Reihenfolge erzwingen: die zweite Erinnerung kann nicht vor der ersten
    -- liegen, die Maßnahme nicht vor der zweiten Erinnerung.
    constraint taxpayer_enforcement_reihenfolge check (
        (reminder_2_at is null or reminder_1_at is not null)
        and (enforced_at is null or reminder_2_at is not null)
    )
);

comment on table public.taxpayer_enforcement is
    'Mahnstufen der Steuer-Mitwirkungspflicht je (Betrieb, Land) nach § 23 '
    'PStTG: Aufforderung, zwei Erinnerungen, dann Einbehalt der Auszahlungen. '
    'resolved_at wird gesetzt, sobald die Angaben vorliegen — die Aufhebung '
    'ist gesetzlich Pflicht, nicht Kulanz.';

comment on column public.taxpayer_enforcement.enforced_at is
    'Zeitpunkt des Auszahlungs-Einbehalts (§ 23 Satz 2 Nr. 2). Frühestens 60, '
    'spätestens 180 Tage nach requested_at.';

create index if not exists taxpayer_enforcement_offen_idx
    on public.taxpayer_enforcement (tenant_id)
    where resolved_at is null;

-- Wurzel 6: Der Mahnstand ist geschäftskritisch und darf vom Client weder
-- gelesen noch verändert werden — sonst könnte ein Betrieb seinen eigenen
-- Einbehalt aufheben.
alter table public.taxpayer_enforcement enable row level security;

revoke select, insert, update, delete on public.taxpayer_enforcement
    from anon, authenticated;

drop policy if exists taxpayer_enforcement_tenant_restrict
    on public.taxpayer_enforcement;
create policy taxpayer_enforcement_tenant_restrict
    on public.taxpayer_enforcement
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
