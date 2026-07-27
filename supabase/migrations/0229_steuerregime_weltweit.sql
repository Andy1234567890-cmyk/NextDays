-- Weltweite Steuer-Meldepflichten: Regeltabelle statt hartkodierter Gruppen.
--
-- Recherche-Ergebnis (Airbnb Art. 3633/122/3406, OECD DPI-MCAA Signatarliste
-- Stand 01.04.2026, HMRC IEIM902310, IRC § 6050W, LISR Art. 113-A,
-- ITA Sec. 194-O, Booking Compliance Center):
--
-- Airbnb verzweigt NICHT nach Steuerrecht, sondern nach MELDENDER ENTITY:
--   United States          -> IRS          (W-9/W-8, 1099-K/1042-S)
--   Mexico/Colombia/India  -> SAT/DIAN/ITD (nationale Sonderwege, lokale ID)
--   Another country/region -> Irish Revenue -> verteilt an alle MRDP-Staaten
--
-- Der dritte Fall ist KEIN Restposten: EU-27, UK, Kanada, Neuseeland, Island,
-- Norwegen und Costa Rica haben dieselben OECD Model Rules umgesetzt — ein
-- Feldkatalog, ein Datensatz, ein Meldeweg.
--
-- Warum eine TABELLE und keine drei Konstanten im Code:
--   1. Die US-Schwelle hat sich in vier Jahren ZWEIMAL gesetzlich geaendert
--      (ARPA 2021 -> 600 USD, One Big Beautiful Bill Act 04.07.2025 -> zurueck
--      auf 20.000 USD + 200 Transaktionen). Als Code-Konstante waere das eine
--      Zeitbombe; mit Gueltigkeitsdatum in der DB ist es pflegbar.
--   2. Eine fehlende lokale ID ist kein Schoenheitsfehler, sondern kostet Geld
--      (Mexiko 4 % -> 20 %, Indien 0,1 % -> 5 %). Die Saetze gehoeren dorthin,
--      wo man sie nachschlagen und datieren kann.

-- ---------------------------------------------------------------------------
-- 1. Regime
-- ---------------------------------------------------------------------------

do $$
begin
    if not exists (select 1 from pg_type where typname = 'tax_regime') then
        create type public.tax_regime as enum (
            'oecd_dpi',   -- DAC7 + OECD MRDP: ein Datensatz fuer ~35 Staaten
            'us_irs',     -- W-9 / W-8BEN / W-8BEN-E / W-8ECI, 1099-K / 1042-S
            'national',   -- eigener nationaler Weg (MX/IN/AU)
            -- Kein steuerliches Melderegime, aber eine REGULATORISCHE
            -- Registernummer, die geprueft und im Inserat angezeigt werden
            -- muss (Japan: Minpaku-Meldenummer).
            'registration',
            -- Die Erhebung des Personen-Steueridentifikators ist VERBOTEN
            -- (Japan My Number, Schweiz AHV-Nummer). Ein global gleiches
            -- Pflichtfeld baute hier einen Datenschutzverstoss ins Schema.
            'id_collection_prohibited',
            -- Keine Plattform-Meldepflicht bekannt.
            'none'
        );
    end if;
end $$;

-- Art des erwarteten Identifikators. Der Name der Nummer ist laenderabhaengig
-- (TIN, SSN, EIN, RFC, PAN, ABN …) — sie alle „TIN" zu nennen waere falsch und
-- wuerde dem Nutzer ein Feld zeigen, das er in seinem Land nicht kennt.
do $$
begin
    if not exists (select 1 from pg_type where typname = 'tax_id_kind') then
        create type public.tax_id_kind as enum (
            'tin',      -- allgemeine Steuer-ID (OECD/EU)
            'ssn',      -- US, natuerliche Person
            'itin',     -- US, natuerliche Person ohne SSN
            'ein',      -- US, Rechtstraeger
            'rfc',      -- Mexiko
            'curp',     -- Mexiko, natuerliche Person
            'pan',      -- Indien
            'gstin',    -- Indien, Umsatzsteuer
            'rut',      -- Kolumbien
            'abn',      -- Australien
            'vat'       -- Umsatzsteuer-Identifikationsnummer
        );
    end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Die Regeltabelle: eine Zeile je Land
-- ---------------------------------------------------------------------------

create table if not exists public.tax_country_rules (
    country char(2) primary key,
    regime public.tax_regime not null,

    -- Wer meldet. Bei uns spaeter die eigene Entity — hier steht, WOHIN.
    reporting_authority text,

    -- Erwartete Identifikatoren, in der Reihenfolge der Bevorzugung.
    -- Leer = das Land verlangt keinen eigenen Identifikator.
    required_ids public.tax_id_kind[] not null default '{}',

    -- Darf der Geburtsort die fehlende Steuer-ID ersetzen? Das ist eine
    -- OECD/DAC7-Besonderheit (§ 14 PStTG, HMRC IEIM902310) — in den USA gilt
    -- sie NICHT, dort ist die TIN immer Pflicht.
    birthplace_substitutes_id boolean not null default false,

    -- Quellensteuer bei FEHLENDER ID. Basispunkte, damit 0,1 % darstellbar
    -- bleibt (Indien) — als Prozent-Integer waere das nicht abbildbar.
    withholding_bps_with_id integer,
    withholding_bps_without_id integer,

    -- Meldeschwelle. NULL = keine Schwelle, jede Buchung ist meldepflichtig
    -- (so ist es bei Unterkunft im gesamten OECD-Raum).
    threshold_amount_minor bigint,
    threshold_currency char(3),
    threshold_transactions integer,

    -- Ab wann diese Regel gilt. Pflicht, weil sich Schwellen aendern und eine
    -- undatierte Regel rueckwirkend falsch waere.
    valid_from date not null,
    -- Rechtsgrundlage, damit die Zeile nachpruefbar bleibt.
    legal_basis text,
    notes text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    -- Eine Waehrung ohne Betrag (und umgekehrt) waere eine halbe Angabe.
    constraint tax_country_rules_schwelle_vollstaendig check (
        (threshold_amount_minor is null) = (threshold_currency is null)
    ),
    constraint tax_country_rules_bps_bereich check (
        (withholding_bps_with_id is null
            or withholding_bps_with_id between 0 and 10000)
        and (withholding_bps_without_id is null
            or withholding_bps_without_id between 0 and 10000)
    )
);

comment on table public.tax_country_rules is
    'Steuerliche Meldepflichten je Land. Quelle der Wahrheit fuer Regime, '
    'erwartete Identifikatoren, Quellensteuersaetze und Schwellen. Wird von '
    'Hand gepflegt (Migration), nie vom Nutzer geschrieben.';

comment on column public.tax_country_rules.withholding_bps_without_id is
    'Erhoehter Satz bei fehlender lokaler ID (MX 20 %, IN 5 %). Das ist der '
    'Grund, warum eine fehlende ID kein Schoenheitsfehler ist.';

-- ---------------------------------------------------------------------------
-- 3. Bestand: OECD-DPI-Staaten
-- ---------------------------------------------------------------------------

-- EU-27 + EWR: DAC7 gilt unmittelbar, gemeldet wird ueber EINEN Mitgliedstaat.
insert into public.tax_country_rules
    (country, regime, reporting_authority, required_ids,
     birthplace_substitutes_id, valid_from, legal_basis)
select
    c, 'oecd_dpi', 'EU-Mitgliedstaat (DAC7)', array['tin']::public.tax_id_kind[],
    true, date '2023-01-01',
    'RL (EU) 2021/514 (DAC7); DE: PStTG'
from unnest(array[
    'AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR','HU',
    'IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK'
]) as c
on conflict (country) do nothing;

-- OECD MRDP ausserhalb der EU. Belegt aus der DPI-MCAA-Signatarliste
-- (Stand 01.04.2026) und den jeweiligen nationalen Umsetzungen.
insert into public.tax_country_rules
    (country, regime, reporting_authority, required_ids,
     birthplace_substitutes_id, valid_from, legal_basis)
values
    ('GB', 'oecd_dpi', 'HMRC', array['tin']::public.tax_id_kind[], true,
     '2024-01-01', 'SI 2023/817 (UK DPRR); HMRC IEIM902310'),
    ('CA', 'oecd_dpi', 'CRA', array['tin']::public.tax_id_kind[], true,
     '2024-01-01', 'Part XX ITA (Bill C-47)'),
    ('NZ', 'oecd_dpi', 'Inland Revenue', array['tin']::public.tax_id_kind[],
     true, '2024-01-01', 'OECD Model Rules, NZ-Umsetzung'),
    ('NO', 'oecd_dpi', 'Skatteetaten', array['tin']::public.tax_id_kind[], true,
     '2023-01-01', 'OECD DPI-MCAA'),
    ('IS', 'oecd_dpi', 'Skatturinn', array['tin']::public.tax_id_kind[], true,
     '2024-01-01', 'OECD DPI-MCAA'),
    ('CR', 'oecd_dpi', 'DGT', array['tin']::public.tax_id_kind[], true,
     '2024-01-01', 'OECD DPI-MCAA'),
    ('LI', 'oecd_dpi', 'Steuerverwaltung', array['tin']::public.tax_id_kind[],
     true, '2024-01-01', 'OECD DPI-MCAA')
on conflict (country) do nothing;

-- ---------------------------------------------------------------------------
-- 4. USA — eigenes System, kein OECD-Rahmen
-- ---------------------------------------------------------------------------

-- Die Schwelle ist die AKTUELLE Fassung: der One Big Beautiful Bill Act vom
-- 04.07.2025 hat die ARPA-Absenkung auf 600 USD aufgehoben; es gilt wieder
-- die urspruengliche Doppelschwelle aus IRC § 6050W.
-- birthplace_substitutes_id = FALSE: in den USA ersetzt nichts die TIN.
insert into public.tax_country_rules
    (country, regime, reporting_authority, required_ids,
     birthplace_substitutes_id, withholding_bps_with_id,
     withholding_bps_without_id, threshold_amount_minor, threshold_currency,
     threshold_transactions, valid_from, legal_basis, notes)
values (
    'US', 'us_irs', 'IRS',
    array['ssn','itin','ein']::public.tax_id_kind[],
    false,
    0,      -- mit gueltigem W-9: kein Einbehalt
    2400,   -- ohne TIN: 24 % Backup Withholding (IRC § 3406)
    2000000, 'USD', 200,
    '2025-07-04',
    'IRC § 6050W (1099-K); IRC § 3406 (Backup Withholding); '
    'One Big Beautiful Bill Act (P.L. 119-21) § 70432 vom 04.07.2025',
    'Vier Formularpfade: W-9 (US-Person, laeuft nie ab), W-8ECI '
    '(Nicht-US-Person mit US-Objekt und 871(d)-Wahl, US-TIN ZWINGEND — '
    'ohne sie ist das Formular ungueltig), W-8BEN/-E (sonst, 30 % '
    'Quellensteuer auf den BRUTTObetrag nach IRC § 1441, Ausgabe 1042-S). '
    'Die Schwelle gilt UND-verknuepft: 50.000 USD aus 150 Buchungen ist '
    'NICHT meldepflichtig. Backup Withholding greift seit P.L. 119-21 '
    '§ 70432(b) ERST ab derselben Schwelle — ein frueherer Einbehalt waere '
    'selbst ein Fehler. Einzelstaaten haben eigene, niedrigere Schwellen '
    '(siehe tax_state_rules).'
)
on conflict (country) do nothing;

-- ---------------------------------------------------------------------------
-- 5. Nationale Sonderwege
-- ---------------------------------------------------------------------------

insert into public.tax_country_rules
    (country, regime, reporting_authority, required_ids,
     birthplace_substitutes_id, withholding_bps_with_id,
     withholding_bps_without_id, valid_from, legal_basis, notes)
values
    -- Mexiko: der Satz VERVIERFACHT sich ohne RFC. Zusaetzlich IVA-Einbehalt
    -- (50 % mit RFC, 100 % ohne) — der laeuft ueber die Umsatzsteuer, nicht
    -- ueber diese Tabelle.
    ('MX', 'national', 'SAT', array['rfc','curp']::public.tax_id_kind[], false,
     400, 2000, '2020-06-01', 'LISR Art. 113-A',
     'Zusaetzlich IVA-Einbehalt: 50 % mit RFC, 100 % ohne.'),

    -- Indien: TDS 0,1 % (seit 01.10.2024, NICHT 1 %), ohne PAN das
    -- Fuenfzigfache. Der eigentliche Hebel ist aber GST § 9(5): bei NICHT
    -- GST-registrierten Gastgebern schuldet die PLATTFORM die GST selbst
    -- (Notification 17/2017-CTR erfasst Unterkunft). Darum ist GSTIN hier
    -- Pflichtfeld — es steuert, wer die Steuer schuldet.
    ('IN', 'national', 'Income Tax Department',
     array['pan','gstin']::public.tax_id_kind[], false,
     10, 500, '2024-10-01',
     'Income Tax Act Sec. 194-O; CGST Act § 9(5) i.V.m. Notification '
     '17/2017-CTR',
     'Ohne GSTIN des Gastgebers schuldet die Plattform die GST selbst '
     '(§ 9(5)) — das ist keine Meldung, sondern eine eigene Steuerschuld.'),

    -- Australien: rein nationale Meldepflicht, KEIN OECD-MRDP (Australien hat
    -- das DPI-MCAA nicht unterzeichnet). Keine Sonderfelder, kein Einbehalt.
    ('AU', 'national', 'ATO', array['abn']::public.tax_id_kind[], false,
     null, null, '2023-07-01',
     'Taxation Administration Act (Sharing Economy Reporting Regime)',
     'Fehlende Nummer wird als "N/A" gemeldet, nie als Fantasiewert.')
on conflict (country) do nothing;

-- Kolumbien gehoert NICHT zu den Sonderwegen: es hat das DPI-MCAA am
-- 09.11.2022 unterzeichnet und mit Res. DIAN 000199/2024 (geaendert durch
-- 000228/2025) voll umgesetzt — inklusive `arrendamiento de bienes inmuebles`
-- und ausdruecklich fuer nicht-ansaessige Plattformbetreiber. Gemeldet werden
-- Objektadresse und matricula wie bei DAC7. KEIN Plattform-Einbehalt.
insert into public.tax_country_rules
    (country, regime, reporting_authority, required_ids,
     birthplace_substitutes_id, valid_from, legal_basis, notes)
values (
    'CO', 'oecd_dpi', 'DIAN', array['rut']::public.tax_id_kind[], true,
    '2025-01-01',
    'Art. 631-4 ET; Res. DIAN 000199/2024 i.d.F. 000228/2025; DPI-MCAA '
    '(unterzeichnet 09.11.2022)',
    'Erstes Meldejahr 2025, Abgabe 27.02.2026. Kein Plattform-Einbehalt — '
    'Registrierung (RUT) und Meldung, nicht Quellensteuer.'
)
on conflict (country) do nothing;

-- ---------------------------------------------------------------------------
-- 5b. Laender, in denen die ID-Erhebung VERBOTEN ist
-- ---------------------------------------------------------------------------

-- Das ist kein Sonderfall von „optional", sondern das Gegenteil: ein
-- Pflichtfeld waere hier rechtswidrig. Darum ein eigenes Regime statt eines
-- Flags — ein Flag haette man beim Bauen uebersehen.
insert into public.tax_country_rules
    (country, regime, reporting_authority, required_ids, valid_from,
     legal_basis, notes)
values
    -- Japan: My Number darf nicht erhoben werden. Statt dessen die
    -- Minpaku-Meldenummer (M + 9 Ziffern): pruefen, im Inserat ANZEIGEN,
    -- Objekte ohne gueltige Nummer sperren, Jahresmeldung an die JTA
    -- bis 15. April.
    ('JP', 'registration', 'JTA / Minpaku', '{}', '2018-06-15',
     'Jutaku Shukuhaku Jigyo Ho (Minpaku-Gesetz)',
     'My Number (Personen-ID) darf NICHT erhoben werden. Erhoben wird die '
     'Meldenummer des Objekts; ohne gueltige Nummer ist das Objekt zu '
     'sperren.'),

    -- Schweiz: keine DAC7-, keine DPI-Bindung. Auskunft nur auf Verlangen.
    -- Die AHV-Nummer ist als Personen-ID gesperrt; zulaessig ist die UID
    -- (Unternehmens-Identifikationsnummer).
    ('CH', 'id_collection_prohibited', 'ESTV', '{}', '2025-01-01',
     'Art. 73 MWSTG',
     'Weder DAC7 noch DPI-MCAA. AHV-Nummer darf nicht erhoben werden; '
     'zulaessig ist die UID. Auskunft nur auf behoerdliches Verlangen.'),

    -- Singapur: kein DPI. Kurzzeitvermietung unter 3 Monaten ist praktisch
    -- verboten — das ist ein Vertriebs-, kein Steuerthema, gehoert aber
    -- hierher, damit niemand ein Steuerfeld dafuer baut.
    ('SG', 'none', null, '{}', '2020-01-01',
     'Singapore Tax Administration; URA Short-Term Accommodation Rules',
     'Keine Plattform-Meldepflicht. Kurzzeitvermietung unter 3 Monaten '
     'ist genehmigungspflichtig bis unzulaessig.')
on conflict (country) do nothing;

-- ---------------------------------------------------------------------------
-- 5c. US-Bundesstaaten: eigene, NIEDRIGERE Schwellen
-- ---------------------------------------------------------------------------

-- Der One Big Beautiful Bill Act hat nur BUNDESrecht geaendert. Die Staaten
-- behalten ihre eigenen Schwellen — die Luecke ist dadurch groesser geworden,
-- nicht kleiner. Bund und Staat sind ZWEI UNABHAENGIGE Achsen: 700 USD in
-- Massachusetts loest eine MA-Pflicht aus, aber keine Bundesmeldung. Ein
-- einzelnes `threshold_met`-Flag waere darum falsch.
create table if not exists public.tax_state_rules (
    country char(2) not null,
    state char(2) not null,
    threshold_amount_minor bigint,
    threshold_currency char(3) not null,
    -- NULL = keine Transaktionszahl gefordert (Betrag allein genuegt).
    threshold_transactions integer,
    valid_from date not null,
    legal_basis text,
    notes text,
    created_at timestamptz not null default now(),
    primary key (country, state)
);

comment on table public.tax_state_rules is
    'Subnationale Meldeschwellen (derzeit nur US-Bundesstaaten). Zweite, '
    'vom Bund unabhaengige Achse — eine Buchung kann die Staatsschwelle '
    'reissen, ohne die Bundesschwelle zu erreichen.';

insert into public.tax_state_rules
    (country, state, threshold_amount_minor, threshold_currency,
     threshold_transactions, valid_from, legal_basis, notes)
values
    ('US', 'MA', 60000, 'USD', null, '2021-01-01',
     '830 CMR 62C.8.1', 'Betrag allein, keine Transaktionszahl.'),
    ('US', 'VA', 60000, 'USD', null, '2020-10-30',
     'Virginia Tax Bulletin 20-10', null),
    ('US', 'VT', 200000, 'USD', null, '2024-01-01',
     'tax.vermont.gov 1099-K FAQ',
     'NICHT 600 USD — dieser Wert wird von Sekundaerquellen veraltet '
     'weitergetragen.'),
    ('US', 'IL', 100000, 'USD', 4, '2026-01-01',
     'Illinois PUB-110 (R-01/26)',
     'UND-verknuepft: ueber 1.000 USD UND mindestens 4 Transaktionen.')
on conflict (country, state) do nothing;

alter table public.tax_state_rules enable row level security;
revoke all on public.tax_state_rules from anon, authenticated;

create policy tax_state_rules_service_only
    on public.tax_state_rules
    as restrictive
    for all
    using (false)
    with check (false);

-- ---------------------------------------------------------------------------
-- 6. Zugriff (Wurzel 6)
-- ---------------------------------------------------------------------------

alter table public.tax_country_rules enable row level security;

-- Nur der Server pflegt und liest diese Tabelle. Ein Client, der die
-- Quellensteuersaetze aendern koennte, koennte damit Geld umleiten.
revoke all on public.tax_country_rules from anon, authenticated;

create policy tax_country_rules_service_only
    on public.tax_country_rules
    as restrictive
    for all
    using (false)
    with check (false);

create index if not exists tax_country_rules_regime_idx
    on public.tax_country_rules (regime);

-- ---------------------------------------------------------------------------
-- 7. taxpayer_info: mehrere Identifikatoren statt EINER TIN
-- ---------------------------------------------------------------------------

-- Das DPI-XML-Schema fuehrt TIN als WIEDERHOLBARES Element mit dem Attribut
-- `issuedBy` und einem `unknown`-Flag (Sentinel "NOTIN"). Ein einzelnes
-- Textfeld kann das nicht abbilden: ein Gastgeber kann Steuernummern in
-- mehreren Staaten haben, und alle sind zu melden.
create table if not exists public.taxpayer_identifiers (
    id uuid primary key default gen_random_uuid(),
    taxpayer_info_id uuid not null
        references public.taxpayer_info(id) on delete cascade,
    tenant_id uuid not null references public.tenants(id) on delete cascade,

    kind public.tax_id_kind not null,
    value text,
    -- Ausstellungsstaat. Ohne ihn ist eine Nummer nicht eindeutig.
    issued_by char(2),
    -- Der Gastgeber erklaert, dass es in diesem Staat keine Nummer gibt.
    -- Entspricht dem DPI-Sentinel "NOTIN".
    unknown boolean not null default false,

    created_at timestamptz not null default now(),

    -- Entweder ein Wert oder die Erklaerung, dass keiner existiert.
    constraint taxpayer_identifiers_wert_oder_unbekannt check (
        (value is not null and unknown = false)
        or (value is null and unknown = true)
    ),
    -- Dieselbe Art im selben Staat nur einmal.
    constraint taxpayer_identifiers_eindeutig
        unique (taxpayer_info_id, kind, issued_by)
);

comment on table public.taxpayer_identifiers is
    'Steuer-Identifikatoren je Steuerzahler-Eintrag. Mehrfach, weil das '
    'DPI-Schema TIN als wiederholbares Element mit issuedBy fuehrt und ein '
    'Anbieter Nummern in mehreren Staaten haben kann.';

alter table public.taxpayer_identifiers enable row level security;
revoke all on public.taxpayer_identifiers from anon, authenticated;

create policy taxpayer_identifiers_tenant_restrict
    on public.taxpayer_identifiers
    as restrictive
    for all
    using (tenant_id = public.current_tenant_id())
    with check (tenant_id = public.current_tenant_id());

create index if not exists taxpayer_identifiers_info_idx
    on public.taxpayer_identifiers (taxpayer_info_id);
create index if not exists taxpayer_identifiers_tenant_idx
    on public.taxpayer_identifiers (tenant_id);

-- ---------------------------------------------------------------------------
-- 8. taxpayer_info: Regime, US-Formular, Nexus
-- ---------------------------------------------------------------------------

-- Welches Regime fuer diesen Eintrag gilt. Abgeleitet aus dem Land, aber
-- gespeichert: aendert sich die Regel spaeter, bleibt nachvollziehbar, unter
-- welcher Fassung der Gastgeber seine Selbstauskunft abgegeben hat.
alter table public.taxpayer_info
    add column if not exists regime public.tax_regime;

-- US-Formularpfad. Nur bei regime = 'us_irs' belegt.
do $$
begin
    if not exists (select 1 from pg_type where typname = 'us_tax_form') then
        create type public.us_tax_form as enum ('w9', 'w8ben', 'w8bene', 'w8eci');
    end if;
end $$;

alter table public.taxpayer_info
    add column if not exists us_form public.us_tax_form;

-- W-8-Formulare laufen nach DREI Kalenderjahren ab (31.12. des dritten
-- Jahres) oder frueher bei „change in circumstances". W-9 laeuft NIE ab —
-- darum nullable und nur fuer die W-8-Familie gesetzt.
alter table public.taxpayer_info
    add column if not exists us_form_valid_until date;

comment on column public.taxpayer_info.us_form_valid_until is
    'Ablauf des W-8-Zertifikats (3 Kalenderjahre). Bei W-9 immer NULL: das '
    'Formular laeuft nicht ab.';

alter table public.taxpayer_info
    drop constraint if exists taxpayer_info_w9_laeuft_nicht_ab;
alter table public.taxpayer_info
    add constraint taxpayer_info_w9_laeuft_nicht_ab check (
        us_form is distinct from 'w9' or us_form_valid_until is null
    );

-- EU-Pflichtfeld nach DPI-Schema: der Grund der Meldepflicht (RPONEX1..5).
alter table public.taxpayer_info
    add column if not exists nexus text;

comment on column public.taxpayer_info.nexus is
    'DPI-Schema `Nexus` (RPONEX1..5): Grund der Meldepflicht. EU-Pflichtfeld.';

-- Ein US-Formular ohne US-Regime waere widerspruechlich.
alter table public.taxpayer_info
    drop constraint if exists taxpayer_info_us_form_nur_us;
alter table public.taxpayer_info
    add constraint taxpayer_info_us_form_nur_us check (
        us_form is null or regime = 'us_irs'
    );

-- Der bisherige CHECK erzwang die DAC7-Regel „TIN ODER Geburtsort" fuer ALLE
-- Laender. Ausserhalb des OECD-Raums ist das falsch: in den USA ersetzt der
-- Geburtsort die TIN nie. Die Regel steht jetzt in tax_country_rules
-- (birthplace_substitutes_id) und wird im Service geprueft — ein CHECK kann
-- nicht ueber Tabellen hinweg nachschlagen.
alter table public.taxpayer_info
    drop constraint if exists taxpayer_info_tin_oder_geburtsort;
