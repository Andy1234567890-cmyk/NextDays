-- Steuerzahler-Informationen des Betriebs (Airbnb „Konto → Steuern → Steuerzahler").
--
-- RECHTLICHER HINTERGRUND: Als Buchungsplattform sind wir nach der EU-Richtlinie
-- 2021/514 (DAC7, in Deutschland umgesetzt als PStTG) verpflichtet, Angaben über
-- unsere Anbieter zu erheben und jaehrlich an die Steuerbehoerde zu melden.
-- Airbnb friert bei fehlenden Angaben die Auszahlungen ein — wir bilden dieselbe
-- Mechanik ab (siehe payouts-Slice), sperren aber nichts stillschweigend.
--
-- WARUM EIGENE TABELLE statt Spalten auf tenant_billing_profile:
--   1. MEHRERE Eintraege moeglich — DAC7 verlangt die Steuer-ID je Land, in dem
--      der Anbieter ansaessig ist ODER Objekte hat. Ein Betrieb mit Objekten in
--      DE und ES braucht zwei Eintraege. Eine Spalte kann das nicht.
--   2. tenant_billing_profile ist der RECHNUNGS-Stammsatz (USt-IdNr., Kleinunter-
--      nehmer, Steuersaetze). Steueransaessigkeit ist etwas anderes und wird
--      anders gemeldet — die Vermischung waere ein Datenmodell-Fehler.
--
-- ABGRENZUNG zur USt-IdNr.: Die bleibt auf tenant_billing_profile.vat_id (0023)
-- und wird gegen VIES geprueft (buchhaltung/vat_check.py). Airbnb zeigt beides
-- im selben Tab, es sind aber zwei verschiedene Dinge: die USt-IdNr. steuert die
-- Rechnungsstellung, die Steuer-ID hier die Meldung. NICHT zusammenlegen.

-- Rechtsstatus des Anbieters — DAC7 verlangt fuer natuerliche Personen und
-- Rechtstraeger unterschiedliche Felder.
do $$
begin
    if not exists (select 1 from pg_type where typname = 'taxpayer_kind') then
        create type public.taxpayer_kind as enum ('individual', 'entity');
    end if;
end$$;

create table if not exists public.taxpayer_info (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants (id) on delete cascade,

    -- Land der Steueransaessigkeit (ISO-3166-1 alpha-2). Je Land EIN Eintrag.
    country char(2) not null,

    kind public.taxpayer_kind not null,

    -- Steueridentifikationsnummer im jeweiligen Land (DAC7: „TIN").
    -- Kann fehlen: manche Laender vergeben keine an Privatpersonen. Dann
    -- greift die Geburtsort-Ausnahme (siehe birth_place_*).
    tin text,

    -- --- natuerliche Person -------------------------------------------------
    first_name text,
    last_name text,
    date_of_birth date,
    -- Ersatzangabe, wenn das Wohnsitzland keine TIN vergibt (DAC7 laesst das zu).
    birth_place_city text,
    birth_place_country char(2),

    -- --- Rechtstraeger ------------------------------------------------------
    legal_name text,
    -- Handelsregister-/Unternehmensnummer (DAC7: „business registration number").
    business_registration_number text,

    -- --- Anschrift (beide Formen) -------------------------------------------
    address_line1 text,
    address_line2 text,
    postal_code text,
    city text,

    -- Selbstauskunft: wann hat der Anbieter die Angaben bestaetigt? DAC7
    -- verlangt eine Erklaerung des Anbieters, nicht nur erfasste Daten.
    confirmed_at timestamptz,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    -- Ein Eintrag je Land — sonst konkurrieren zwei TINs fuer dasselbe Land.
    constraint taxpayer_info_tenant_country_unique unique (tenant_id, country),

    -- Pflichtfelder je Rechtsstatus. Ohne diesen CHECK koennte eine
    -- unvollstaendige Zeile entstehen, die die Meldung spaeter scheitern
    -- laesst — lieber beim Schreiben fehlschlagen (Wurzel 5).
    constraint taxpayer_info_kind_fields check (
        (kind = 'individual'
            and first_name is not null and last_name is not null
            and date_of_birth is not null)
        or
        (kind = 'entity' and legal_name is not null)
    ),

    -- Entweder TIN oder (bei natuerlichen Personen) der Geburtsort als
    -- Ersatzangabe — eine Zeile ohne beides ist nicht meldefaehig.
    constraint taxpayer_info_tin_oder_geburtsort check (
        tin is not null
        or (kind = 'individual'
            and birth_place_city is not null
            and birth_place_country is not null)
    )
);

comment on table public.taxpayer_info is
    'Steuerzahler-Angaben je Land (DAC7/PStTG-Meldepflicht der Plattform). '
    'Ein Eintrag je (tenant_id, country) — ein Betrieb mit Objekten in mehreren '
    'EU-Laendern braucht mehrere. Die USt-IdNr. liegt NICHT hier, sondern auf '
    'tenant_billing_profile.vat_id (Rechnungsstellung, nicht Meldung).';

comment on column public.taxpayer_info.tin is
    'Steueridentifikationsnummer im Land. Fehlt sie (manche Laender vergeben '
    'keine an Privatpersonen), sind birth_place_city/-country Pflicht.';

comment on column public.taxpayer_info.confirmed_at is
    'Zeitpunkt der Selbstauskunft. NULL = Angaben erfasst, aber vom Anbieter '
    'nicht bestaetigt — DAC7 verlangt seine Erklaerung.';

create index if not exists taxpayer_info_tenant_idx
    on public.taxpayer_info (tenant_id);

-- Wurzel 6: Steuerdaten sind hochsensible PII (Geburtsdatum, Steuer-ID).
-- RLS allein reicht nicht — der Schreib- UND Lesepfad wird fuer anon/
-- authenticated komplett entzogen; nur der Server (service_role) kommt daran.
alter table public.taxpayer_info enable row level security;

revoke select, insert, update, delete on public.taxpayer_info
    from anon, authenticated;

drop policy if exists taxpayer_info_tenant_restrict on public.taxpayer_info;
create policy taxpayer_info_tenant_restrict on public.taxpayer_info
    as restrictive for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());
